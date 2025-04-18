import d3 from "./d3-loader.js";
import * as util from "./util.mjs";
const [CMFData, ,] = await util.createCMFs();
const GRAPH2D_WIDTH = 500;
const GRAPH2D_HEIGHT = 400;

class Equation {
  constructor() {
    this.tristimulus = { r: 0, g: 0, b: 0 };
    this.scaleFactor = 1.0;
    this.equationContainers = this.#createEquationContainers();
  }

  #createEquationContainers() {
    const titles = [
      { key: "colorEqDiv", title: "Selected Color" },
      { key: "scaledColorEqDiv", title: "Color on the isochromatic line" },
      { key: "chromCoefDiv", title: "Chromaticity" },
    ];

    return titles.reduce((containers, { key, title }) => {
      containers[key] = this.#createEquationElement(title);
      return containers;
    }, {});
  }

  #createEquationElement(title) {
    const div = document.createElement("div");
    div.appendChild(document.createElement("span")).textContent = title;
    const eqDiv = div.appendChild(document.createElement("div"));
    //div.style.display = "none";

    // Style
    const commonStyle = {
      justifyContent: "center",
      flexDirection: "column",
      alignItems: "center",
      marginTop:"1em"
    };
    Object.assign(div.style, commonStyle);
    return { div, eqDiv };
  }

  render() {
    // Compute needed variable
    const scaledTristimulus = {
      r: this.tristimulus.r * this.scaleFactor,
      g: this.tristimulus.g * this.scaleFactor,
      b: this.tristimulus.b * this.scaleFactor,
    };

    const sumTristimulus =
      this.tristimulus.r + this.tristimulus.g + this.tristimulus.b;

    const chromCoef = {
      r: this.tristimulus.r / sumTristimulus,
      g: this.tristimulus.g / sumTristimulus,
      b: this.tristimulus.b / sumTristimulus,
    };

    Object.values(this.equationContainers).forEach(({ div, eqDiv }) => {
      div.style.display = "flex";
      eqDiv.style.visibility = "hidden";
    });

    // Alias
    const redR = String.raw`\textcolor{red}{${this.tristimulus.r}}`;
    const greenG = String.raw`\textcolor{green}{${this.tristimulus.g}}`;
    const blueB = String.raw`\textcolor{blue}{${this.tristimulus.b}}`;
    const grayS = String.raw`\textcolor{orange}{${this.scaleFactor}}`;
    const coloredS = String.raw`\textcolor{orange}{s}`;

    const equations = [
      {
        container: this.equationContainers.colorEqDiv.eqDiv,
        content: String.raw`$$ 
        \begin{array}{}
        C & \triangleq & R  \mathcal{R}+ G \mathcal{G}+ B \mathcal{B} \\
          & \triangleq & ${redR} \mathcal{R}+ ${greenG} \mathcal{G}+ ${blueB}\mathcal{B} 
        \end{array}
        $$`,
      },
      {
        container: this.equationContainers.scaledColorEqDiv.eqDiv,
        content: String.raw`$$ 
      \begin{array}{}
      C_s &\triangleq& \underbrace{${coloredS}R}_{R_s}\mathcal{R}+ \underbrace{${coloredS}G}_{G_s}\mathcal{G}+ \underbrace{${coloredS}B}_{B_s}\mathcal{B}\\
          &\triangleq& \underbrace{${grayS}\cdot${redR}}_{${scaledTristimulus.r}}\mathcal{R}+ \underbrace{${grayS}\cdot${greenG}}_{${scaledTristimulus.g}}\mathcal{G}+ \underbrace{${grayS}\cdot${blueB}}_{${scaledTristimulus.b}}\mathcal{B}
      \end{array}
      $$`,
      },
      {
        container: this.equationContainers.chromCoefDiv.eqDiv,
        content: String.raw`$$
      \begin{array}{}
      r = \frac{R}{R+G+B} = \frac{R_s}{R_s+G_s+B_s} = ${chromCoef.r} \\
      g = \frac{G}{R+G+B} = \frac{R_s}{R_s+G_s+B_s} = ${chromCoef.g} \\
      b = \frac{B}{R+G+B} = \frac{R_s}{R_s+G_s+B_s} = ${chromCoef.b}
      \end{array}
      $$
      `,
      },
    ];

    equations.forEach(({ container, content }) => {
      container.textContent = util.limitDecimal(content);
    });

    const eqContainers = equations.map((eq) => eq.container);

    MathJax.typesetPromise(eqContainers).then(() => {
      eqContainers.forEach((container) => {
        container.style.visibility = "visible";
      });
    });
  }
}

function lerpPointsBetween(srcPoints, xyzToDisplayRgbFunc, delta = 1.0) {
  // For each points, scan all the others and interpolate in-between
  // The longer the distance between two points, the more we should interpolate in-between.
  // We can actually fix a delta at which we interpolate between two points.
  const nbLambda = srcPoints.length;
  const interpolatedPoints = [];
  for (let i = 0; i < nbLambda; ++i) {
    const li = srcPoints[i];
    for (let j of [0, 13, 30]) {
      const lj = srcPoints[j];

      // Take points on the segment between li and lj
      const vx = lj.x - li.x;
      const vy = lj.y - li.y;
      const vz = lj.z - li.z;

      const vLength = Math.sqrt(vx * vx + vy * vy + vz * vz);
      const unitV =
        vLength !== 0
          ? { x: vx / vLength, y: vy / vLength, z: vz / vLength }
          : { x: 0, y: 0, z: 0 };

      const nbStep = Math.floor(vLength / delta);

      for (let s = 0; s <= nbStep; ++s) {
        const curX = li.x + s * delta * unitV.x;
        const curY = li.y + s * delta * unitV.y;
        const curZ = li.z + s * delta * unitV.z;
        const RGB = xyzToDisplayRgbFunc({ x: curX, y: curY, z: curZ });
        interpolatedPoints.push({
          x: curX,
          y: curY,
          z: curZ,
          color: d3.rgb(RGB.R, RGB.G, RGB.B),
        });
      }
    }
  }

  return interpolatedPoints;
}

function genPointsOnLine(pt1, pt2, nbPoint) {
  const lastIdx = nbPoint - 1;
  const xScale = d3.scaleLinear().domain([0, lastIdx]).range([pt1.x, pt2.x]);
  const yScale = d3.scaleLinear().domain([0, lastIdx]).range([pt1.y, pt2.y]);
  const zScale = d3.scaleLinear().domain([0, lastIdx]).range([pt1.z, pt2.z]);

  const rScale = d3
    .scaleLinear()
    .domain([0, lastIdx])
    .range([pt1.color.r, pt2.color.r]);
  const gScale = d3
    .scaleLinear()
    .domain([0, lastIdx])
    .range([pt1.color.g, pt2.color.g]);
  const bScale = d3
    .scaleLinear()
    .domain([0, lastIdx])
    .range([pt1.color.b, pt2.color.b]);
  const aScale = d3
    .scaleLinear()
    .domain([0, lastIdx])
    .range([pt1.color.a, pt2.color.a]);

  const outPoints = d3.range(nbPoint).map((i) => {
    return {
      x: xScale(i),
      y: yScale(i),
      z: zScale(i),
      color: { r: rScale(i), g: gScale(i), b: bScale(i), a: aScale(i) },
    };
  });

  return outPoints;
}

function createVolumePointGenerationAnimation() {
  const CMFDataR = util.unzipXY(CMFData[0].values);
  const CMFDataG = util.unzipXY(CMFData[1].values);
  const CMFDataB = util.unzipXY(CMFData[2].values);

  const nbSpectralColors = CMFDataR.x.length;
  const spectralPoints = Array.from({ length: nbSpectralColors }, () => {
    return { x: 0, y: 0, z: 0 };
  });
  for (let i = 0; i < nbSpectralColors; ++i) {
    spectralPoints[i].x = CMFDataR.y[i];
    spectralPoints[i].y = CMFDataG.y[i];
    spectralPoints[i].z = CMFDataB.y[i];
  }

  const powerFactor = 2.0; // for color to appear brighter
  const pointColors = Array.from({ length: CMFDataR.x.length }, (_, i) => {
    const RGB = util.cvtLinearRGBtoRGB({
      R: powerFactor * CMFDataR.y[i],
      G: powerFactor * CMFDataG.y[i],
      B: powerFactor * CMFDataB.y[i],
    });
    return `rgba(${RGB.R}, ${RGB.G}, ${RGB.B})`;
  });

  const traceLocus3D = {
    type: "scatter3d",
    mode: "markers+lines",
    x: CMFDataR.y,
    y: CMFDataG.y,
    z: CMFDataB.y,
    marker: {
      size: 3,
      color: pointColors,
    },
    line: {
      color: pointColors,
      width: 4,
    },
    showlegend: true,
    name: "Spectral colors",
  };

  const ptIdx1 = 13;
  const ptIdx2 = 45;

  const pt1ColorInvisible = util.parseRgba(pointColors[ptIdx1]);
  pt1ColorInvisible.a = 0;
  const pt2ColorInvisible = util.parseRgba(pointColors[ptIdx2]);
  pt2ColorInvisible.a = 0;
  const pt1 = {
    x: CMFDataR.y[ptIdx1],
    y: CMFDataG.y[ptIdx1],
    z: CMFDataB.y[ptIdx1],
    color: pt1ColorInvisible,
  };
  const pt2 = {
    x: CMFDataR.y[ptIdx2],
    y: CMFDataG.y[ptIdx2],
    z: CMFDataB.y[ptIdx2],
    color: pt2ColorInvisible,
  };

  const nbPoints = 20;
  const interpolatedPoints = genPointsOnLine(pt1, pt2, nbPoints);
  const unzippedInterpolatedPoints =
    util.unzipArrayOfObject(interpolatedPoints);

  const colorAsString = unzippedInterpolatedPoints[3].map((c) => {
    return util.toRgbaString(c);
  });

  const interpolationLine = {
    type: "scatter3d",
    mode: "markers+lines",
    x: unzippedInterpolatedPoints[0],
    y: unzippedInterpolatedPoints[1],
    z: unzippedInterpolatedPoints[2],
    marker: { color: colorAsString, size: 4, opacity: 1 },
    line: { color: "rgba(0, 0, 0, 0.3)", width: 2 },
    showlegend: false,
    name: "",
  };
  const lineCurveIdx = 1;

  // Add other points invisible by default
  const volumePoints = lerpPointsBetween(
    spectralPoints,
    ({ x, y, z }) => util.cvtLinearRGBtoRGB({ R: x, G: y, B: z }),
    0.01
  );
  const [xVolumePoints, yVolumePoints, zVolumePoints, colorVolumePoints] =
    util.unzipArrayOfObject(volumePoints);
  const brightenedColors = colorVolumePoints.map((c) =>
    d3.rgb(powerFactor * c.r, powerFactor * c.g, powerFactor * c.b)
  );
  const colorVolumePointsAsString = brightenedColors.map((c) => c.toString());
  const volumePointTrace = {
    type: "scatter3d",
    mode: "markers",
    x: xVolumePoints,
    y: yVolumePoints,
    z: zVolumePoints,
    marker: { color: colorVolumePointsAsString, size: 3 },
    name: "Other colors",
    visible: "legendonly",
  };

  const layout = {
    title: "Tristimulus Values in 3D",
    scene: {
      xaxis: { title: "R", showspikes: false },
      yaxis: { title: "G", showspikes: false },
      zaxis: { title: "B", showspikes: false },
    },
  };

  const div = document.createElement("div");
  Plotly.newPlot(
    div,
    [traceLocus3D, interpolationLine, volumePointTrace],
    layout
  );

  // When hovering on the line, make the interpolatedPoint appear
  let isUpdating = false;
  div.on("plotly_hover", function (eventData) {
    if (isUpdating) return;
    if (eventData.points[0].curveNumber == lineCurveIdx) {
      isUpdating = true;
      const hoveredPtIdx = eventData.points[0].pointNumber;
      const colorArray = eventData.points[0].data.marker.color;
      const updatedColorArray = colorArray.map((c) => {
        return util.addAlphaToRgb(c, 0.0);
      });
      updatedColorArray[hoveredPtIdx] = util.addAlphaToRgb(
        colorArray[hoveredPtIdx],
        1.0
      );
      const updatedColorPtInfo = { "marker.color": [updatedColorArray] };
      Plotly.restyle(div, updatedColorPtInfo, lineCurveIdx).then(() => {
        isUpdating = false;
      });
    }
  });

  return div;
}

function createCMFdiv() {
  const div = d3.create("div");
  const CMFDataR = util.unzipXY(CMFData[0].values);
  const CMFDataG = util.unzipXY(CMFData[1].values);
  const CMFDataB = util.unzipXY(CMFData[2].values);

  const traceR = {
    x: CMFDataR.x,
    y: CMFDataR.y,
    type: "scatter",
    mode: "lines+markers",
    name: "R",
    line: { color: "red" },
    marker: { size: 3 },
  };

  const traceG = {
    x: CMFDataG.x,
    y: CMFDataG.y,
    type: "scatter",
    mode: "lines+markers",
    name: "G",
    line: { color: "green" },
    marker: { size: 3 },
  };

  const traceB = {
    x: CMFDataB.x,
    y: CMFDataB.y,
    type: "scatter",
    mode: "lines+markers",
    name: "B",
    line: { color: "blue" },
    marker: { size: 3 },
  };

  const cmfData = [traceR, traceG, traceB];
  const layout = {
    title: "Color Matching Functions",
    hovermode: "x",
    xaxis: { title: "λ" },
    width: GRAPH2D_WIDTH,
    height: GRAPH2D_HEIGHT,
  };
  Plotly.newPlot(div.node(), cmfData, layout);

  return div;
}

function createSpectralLocus3Ddiv() {
  const CMFDataR = util.unzipXY(CMFData[0].values);
  const CMFDataG = util.unzipXY(CMFData[1].values);
  const CMFDataB = util.unzipXY(CMFData[2].values);

  const powerFactor = 1.5;
  const pointColors = Array.from({ length: CMFDataR.x.length }, (_, i) => {
    const RGB = util.cvtLinearRGBtoRGB({
      R: powerFactor * CMFDataR.y[i],
      G: powerFactor * CMFDataG.y[i],
      B: powerFactor * CMFDataB.y[i],
    });
    return `rgb(${RGB.R}, ${RGB.G}, ${RGB.B})`;
  });

  const traceLocus3D = {
    type: "scatter3d",
    x: CMFDataR.y,
    y: CMFDataG.y,
    z: CMFDataB.y,
    marker: {
      size: 3,
      color: pointColors,
    },
    line: {
      color: pointColors,
      colorscale: "Viridis", // Smooth color transition
      width: 4,
    },
    showlegend: false,
    hoverinfo: "none",
  };

  const traceMarker = {
    type: "scatter3d",
    x: [0.5],
    y: [0.5],
    z: [0.5],
    mode: "markers+text",
    text: ["hello"],
    showlegend: false,
    hoverinfo: "none",
    marker: { opacity: 0.5, color: "steelblue" },
    visible: false,
  };

  const locus3Ddata = [traceLocus3D, traceMarker];
  const layout = {
    scene: {
      xaxis: { title: { text: "R" } },
      yaxis: { title: { text: "G" } },
      zaxis: { title: { text: "B" } },
    },
    width: GRAPH2D_WIDTH,
    height: GRAPH2D_HEIGHT,
    title: "Tristimulus Values of Spectral Colors",
  };

  const div = d3.create("div");
  Plotly.newPlot(div.node(), locus3Ddata, layout);

  return div;
}

function getCMF2volumeRGBAnimation() {
  const CMFdiv = createCMFdiv();
  const locus3Ddiv = createSpectralLocus3Ddiv();

  // Associate each (x, y) to its (x, y, z) point in the 3D graph
  // then when the mouse is over on the 2D graph, highlight somehow the point
  // in the 3D graph.
  CMFdiv.node().on("plotly_hover", function (data) {
    let x, y, z;
    data.points.forEach((point) => {
      switch (point.curveNumber) {
        case 0:
          x = point.y;
          break;
        case 1:
          y = point.y;
          break;
        case 2:
          z = point.y;
          break;
      }
    });
    highlightPointOn3Dgraph({ x, y, z });
  });

  function highlightPointOn3Dgraph(point) {
    // text annotation is at traceIdx=1
    const updateInfo = {
      visible: true,
      x: [[point.x]],
      y: [[point.y]],
      z: [[point.z]],
      text: [
        [`${point.x.toFixed(2)}, ${point.y.toFixed(2)}, ${point.z.toFixed(2)}`],
      ],
    };

    Plotly.restyle(locus3Ddiv.node(), updateInfo, 1);
  }

  const div = d3.create("div");
  div.style("display", "flex").style("justify-content", "center");
  div.node().appendChild(CMFdiv.node());
  div.node().appendChild(locus3Ddiv.node());

  return div;
}

function createVisualGamut3dGraph() {
  const CMFDataR = util.unzipXY(CMFData[0].values);
  const CMFDataG = util.unzipXY(CMFData[1].values);
  const CMFDataB = util.unzipXY(CMFData[2].values);

  const nbSpectralColors = CMFDataR.x.length;
  const spectralPoints = Array.from({ length: nbSpectralColors }, () => {
    return { x: 0, y: 0, z: 0 };
  });
  for (let i = 0; i < nbSpectralColors; ++i) {
    spectralPoints[i].x = CMFDataR.y[i];
    spectralPoints[i].y = CMFDataG.y[i];
    spectralPoints[i].z = CMFDataB.y[i];
  }
  const powerFactor = 3.0;
  const volumePoints = lerpPointsBetween(
    spectralPoints,
    ({ x, y, z }) =>
      util.cvtLinearRGBtoRGB({
        R: powerFactor * x,
        G: powerFactor * y,
        B: powerFactor * z,
      }),
    0.01
  );
  const [xVolumePoints, yVolumePoints, zVolumePoints, colorVolumePoints] =
    util.unzipArrayOfObject(volumePoints);

  const colorVolumePointsAsString = colorVolumePoints.map((c) => c.toString());
  const volumePointTrace = {
    type: "scatter3d",
    mode: "markers",
    x: xVolumePoints,
    y: yVolumePoints,
    z: zVolumePoints,
    marker: { color: colorVolumePointsAsString, size: 1 },
    name: "",
    showlegend: false,
  };

  const layout = {
    title: "Human Visual Gamut",
    scene: {
      xaxis: { title: "R" },
      yaxis: { title: "G" },
      zaxis: { title: "B" },
    },
  };
  const graphDiv = document.createElement("div");
  Plotly.newPlot(graphDiv, [volumePointTrace], layout);

  return graphDiv;
}

function addClickAnimation(visualGamut3dDiv, slider, equation) {
  slider.div.style.display = "none";

  // Create an invisible trace for the isochromatic line that we will make visible once clicked on a point
  const isochromLineTrace = {
    type: "scatter3d",
    mode: "lines",
    x: [],
    y: [],
    z: [],
    line: { color: "black" },
    name: "isochromatic line",
    hoverinfo: "none",
  };
  const isoChromLineCurveIndex = visualGamut3dDiv.data.length;
  Plotly.addTraces(visualGamut3dDiv, isochromLineTrace);

  // Create an invisible trace for the moving point along the isochromatic line
  const movingPointTrace = {
    type: "scatter3d",
    mode: "markers",
    x: [],
    y: [],
    z: [],
    showlegend: false,
    name: "selected",
  };
  const movingPointCurveIndex = visualGamut3dDiv.data.length;
  Plotly.addTraces(visualGamut3dDiv, movingPointTrace);

  let isUpdatingIsoLine = false;
  let selectedPoint = null;

  const onGamutClick = (point) => {
    selectedPoint = point;
    if (isUpdatingIsoLine) return;
    isUpdatingIsoLine = true;

    // update isochromatic line
    const curveIdxToUpdate = [isoChromLineCurveIndex, movingPointCurveIndex];
    const extensionLineFactor = 0.5;
    const isoChromLine = {
      x: [
        [0.0, selectedPoint.x + selectedPoint.x * extensionLineFactor],
        [selectedPoint.x],
      ],
      y: [
        [0.0, selectedPoint.y + selectedPoint.y * extensionLineFactor],
        [selectedPoint.y],
      ],
      z: [
        [0.0, selectedPoint.z + selectedPoint.z * extensionLineFactor],
        [selectedPoint.z],
      ],
    };

    Plotly.restyle(visualGamut3dDiv, isoChromLine, curveIdxToUpdate).then(
      () => {
        isUpdatingIsoLine = false;
      }
    );

    // Update equation tristimulus value
    equation.tristimulus = {
      r: selectedPoint.x,
      g: selectedPoint.y,
      b: selectedPoint.z,
    };
    equation.render();

    // Add a slider that allows to move of the selected point along the isochromatic line
    slider.div.style.display = "flex";
    slider.setValue(1.0);
  };

  visualGamut3dDiv.on("plotly_click", function (event) {
    if (event.points[0].curveNumber !== 0) return;
    onGamutClick(event.points[0]);
  });

  let isMovingUpdate = false;
  function updateMovingPoint() {
    if (isMovingUpdate) return;
    isMovingUpdate = true;
    const newR = slider.value * selectedPoint.x;
    const newG = slider.value * selectedPoint.y;
    const newB = slider.value * selectedPoint.z;
    const displayRGB = util.cvtRGBtoD3rgb(
      util.cvtLinearRGBtoRGB({ R: newR, G: newG, B: newB })
    );
    const movingPointUpdate = {
      x: [[newR]],
      y: [[newG]],
      z: [[newB]],
      "marker.color": [util.addAlphaToRgb(displayRGB.toString(), 1.0)],
    };
    Plotly.restyle(
      visualGamut3dDiv,
      movingPointUpdate,
      movingPointCurveIndex
    ).then(() => {
      isMovingUpdate = false;
    });

    // Update the equation
    equation.scaleFactor = slider.value;
    equation.render();
  }
  slider.addEventListener("input", updateMovingPoint);

  // Initialize with a point
  requestAnimationFrame(() => {
    onGamutClick({ x: 0.02371177, y: 0.09235865, z: 0.002567437 });
  });

  // TODO: double click does not work with scatter3d, so I need a button to reset all the animation
}

function overlaySpectralLocus(graph3d){
  const CMFDataR = util.unzipXY(CMFData[0].values);
  const CMFDataG = util.unzipXY(CMFData[1].values);
  const CMFDataB = util.unzipXY(CMFData[2].values);

  const powerFactor = 2.0; // for color to appear brighter
  const pointColors = Array.from({ length: CMFDataR.x.length }, (_, i) => {
    const RGB = util.cvtLinearRGBtoRGB({
      R: powerFactor * CMFDataR.y[i],
      G: powerFactor * CMFDataG.y[i],
      B: powerFactor * CMFDataB.y[i],
    });
    return `rgba(${RGB.R}, ${RGB.G}, ${RGB.B})`;
  });

  const traceLocus3D = {
    type: "scatter3d",
    mode: "markers+lines",
    x: CMFDataR.y,
    y: CMFDataG.y,
    z: CMFDataB.y,
    marker: {
      size: 3,
      color: pointColors,
    },
    line: {
      color: pointColors,
      width: 4,
    },
    showlegend: false,
    name: "Spectral colors",
    hoverinfo:"none"
  };

  Plotly.addTraces(graph3d, traceLocus3D);

}

function createIsochromaticAnimation() {
  // Create the 3d visual gamut with only the envelop
  const visualGamut3dGraph = createVisualGamut3dGraph();
  const slider = new util.Slider({
    label: `s`,
    min: 0.0,
    max: 1.5,
    step: 0.1,
    value: 1.0,
  });
  const equation = new Equation();
  addClickAnimation(visualGamut3dGraph, slider, equation);
  overlaySpectralLocus(visualGamut3dGraph);
 

  const div = document.createElement("div");
  div.appendChild(visualGamut3dGraph);
  const secondColumnDiv = document.createElement("div");
  secondColumnDiv.style.fontSize="80%";
  secondColumnDiv.append(
    equation.equationContainers.colorEqDiv.div,
    equation.equationContainers.scaledColorEqDiv.div,
    slider.div,
    equation.equationContainers.chromCoefDiv.div
  );
  div.appendChild(secondColumnDiv);

  Object.assign(div.style, {
    display: "flex",
  });

  return div;
}

function main() {
  const cmf2VolumeDiv = getCMF2volumeRGBAnimation();
  d3.select("#anim-cmf2graph3d").node().appendChild(cmf2VolumeDiv.node());

  const volumePointGenAnim = createVolumePointGenerationAnimation();
  d3.select("#interpolate-tristimulus").node().appendChild(volumePointGenAnim);

  const isochromaticAnimation = createIsochromaticAnimation();
  d3.select("#anim-isochromatic-line-animation")
    .node()
    .appendChild(isochromaticAnimation);
}

main();
