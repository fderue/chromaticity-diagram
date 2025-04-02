import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import * as util from "./util.mjs";

const CIE_XYZ_CMFs = await util.loadData(
  "data/CIE_xyz_1931_2deg_normalized.csv"
);

class Gamut3d {
  constructor() {
    this.div = document.createElement("div");
    const spectralXYZArrays = genXYZPoints(2.0);

    // Volume 3d
    const HumanGamutTrace = {
      x: spectralXYZArrays.xArray,
      y: spectralXYZArrays.yArray,
      z: spectralXYZArrays.zArray,
      mode: "markers",
      marker: {
        size: 3,
        color: spectralXYZArrays.colors,
        opacity: 1.0,
      },
      type: "scatter3d",
      name: "Human Visual Gamut",
      hoverinfo: "none",
      showlegend: false,
    };
    this.gamutTraceIdx = 0;

    // Add a sphere marker to show highlighted point
    const highlightedPointSize = 10;
    const highlightedPointTrace = {
      type: "scatter3d",
      mode: "markers",
      x: [],
      y: [],
      z: [],
      marker: { opacity: 0.0, size: highlightedPointSize },
      showlegend: false,
    };
    this.highlightedPointTraceIdx = 1;

    // Add an isochromatic line going throught the highlighted point
    const isochromLineTrace = {
      type: "scatter3d",
      mode: "lines",
      x: [],
      y: [],
      z: [],
      line: { color: "grey" },
      marker: {
        opacity: 0.0,
      },
      name: "isochromatic line",
      hoverinfo: "none",
    };
    this.isoLineTraceIdx = 2;

    const layout = {
      title: "Human Visual Gamut",
      scene: {
        xaxis: {
          title: "X",
          range: [0.0, 1.0],
        },
        yaxis: {
          title: "Y",
          showspikes: false,
          range: [0.0, 1.0],
        },
        zaxis: {
          title: "Z",
          showspikes: false,
          range: [0.0, 1.0],
        },
        aspectmode: "cube",
      
      },
      autosize: false,
      width:500,
      height:450
    };
    Plotly.newPlot(
      this.div,
      [HumanGamutTrace, highlightedPointTrace, isochromLineTrace],
      layout
    );
  }

  // Highlight point on the 3d human gamut
  // and draw the isochromatic line going through that point.
  // Make the highlighted sphere visible on the current selected point (X, Y, Z)
  // Update the isochromatic line by making it visible and changing its coordinates
  // so that it passes through (X, Y, Z)
  highlightPoint(point) {
    const displayRGB = util.cvtRGBtoD3rgb(util.cvtXYZtoRGB(point));
    const selectedPointUpdate = {
      x: [[point.X], [0.0, point.X]],
      y: [[point.Y], [0.0, point.Y]],
      z: [[point.Z], [0.0, point.Z]],
      "marker.color": [util.addAlphaToRgb(displayRGB.toString(), 1.0)],
      "marker.opacity": 1.0,
    };
    Plotly.restyle(this.div, selectedPointUpdate, [
      this.highlightedPointTraceIdx,
      this.isoLineTraceIdx,
    ]);
  }

  updateHighlightedPoint(point) {
    const displayRGB = util.cvtRGBtoD3rgb(util.cvtXYZtoRGB(point));
    const movingPointUpdate = {
      x: [[point.X]],
      y: [[point.Y]],
      z: [[point.Z]],
      "marker.color": [util.addAlphaToRgb(displayRGB.toString(), 1.0)],
      "marker.opacity": 1.0,
    };
    Plotly.restyle(this.div, movingPointUpdate, this.highlightedPointTraceIdx);
  }
}

function genXYZPoints(delta = 1.0) {
  const Xs = [];
  const Ys = [];
  const Zs = [];
  const spectralColors = [];
  // For each wavelength, scan all the others and and interpolate in-between
  // The longer the distance between two points, the more we should interpolate in-between.
  // We can actually fix a delta at which we interpolate between two points.
  const nbLambda = CIE_XYZ_CMFs.length;
  for (let i = 0; i < nbLambda; ++i) {
    const li = CIE_XYZ_CMFs[i];
    //0, 87, 168 are good index candidate to get the envelope point
    for (let j of [0, 87, 168]) {
      const lj = CIE_XYZ_CMFs[j];

      // Take points on the segment between li and lj
      const vx = lj.X - li.X;
      const vy = lj.Y - li.Y;
      const vz = lj.Z - li.Z;

      const vLength = Math.sqrt(vx * vx + vy * vy + vz * vz);
      const unitV =
        vLength !== 0
          ? { x: vx / vLength, y: vy / vLength, z: vz / vLength }
          : { x: 0, y: 0, z: 0 };

      const nbStep = Math.floor(vLength / delta);

      for (let s = 0; s <= nbStep; ++s) {
        const curX = li.X + s * delta * unitV.x;
        const curY = li.Y + s * delta * unitV.y;
        const curZ = li.Z + s * delta * unitV.z;
        const RGB = util.cvtXYZtoRGB({ X: curX, Y: curY, Z: curZ });
        Xs.push(curX);
        Ys.push(curY);
        Zs.push(curZ);
        spectralColors.push(`rgb(${RGB.R}, ${RGB.G}, ${RGB.B})`);
      }
    }
  }

  return { xArray: Xs, yArray: Ys, zArray: Zs, colors: spectralColors };
}

function CreateFullChromaticityDiagramXy() {
  const div = d3.create("div").attr("id", "chromdiagram-id");

  // Get the spectral locus as array of array
  const spectralLocus = util.xySpectralLocus.map((d) => [d.x, d.y]);

  const step = 0.01;
  const range = Array.from(
    { length: Math.floor(1 / step) + 1 },
    (_, i) => i * step
  );
  const xArray = [];
  const yArray = [];
  const colors = [];
  range.forEach((x) =>
    range.forEach((y) => {
      if (d3.polygonContains(spectralLocus, [x, y])) {
        xArray.push(x);
        yArray.push(y);

        const XYZ = util.cvt_xyYtoXYZ({ x: x, y: y, Y: 1.0 });
        const maxValue = Math.max(XYZ.X, XYZ.Y, XYZ.Z);
        // Normalize such that the max coordinates is one (corresponding to the max luminance possible of a color)
        const XYZNorm = {
          X: XYZ.X / maxValue,
          Y: XYZ.Y / maxValue,
          Z: XYZ.Z / maxValue,
        };
        const RGB = util.cvtXYZtoRGB(XYZNorm);
        colors.push(`rgb(${RGB.R}, ${RGB.G}, ${RGB.B})`);
      }
    })
  );

  const data = {
    x: xArray,
    y: yArray,
    mode: "markers",
    marker: {
      size: 4,
      color: colors,
      //opacity: 1,
    },
    hoverinfo: "x+y",
    showlegend: false,
    type: "scatter2d",
  };

  const layout = {
    title: "Chromaticity diagram",
    xaxis: { title: { text: "x" } },
    yaxis: { title: { text: "y" } },
    width: 400,
    height: 400,
  };
  Plotly.newPlot(div.node(), [data], layout);

  return div.node();
}

function changeColorWith_xyY(chromDiagramDiv, humanGamut) {
  const SVG_WIDTH = 100;
  const SVG_HEIGHT = 100;
  // Create SVG with circle of color defined by chromaticity (x,y)
  const svg = d3
    .create("svg")
    .attr("width", SVG_WIDTH)
    .attr("height", SVG_HEIGHT);
  const circle = svg
    .append("circle")
    .attr("cx", SVG_WIDTH / 2.0)
    .attr("cy", SVG_HEIGHT / 2.0);
  circle.attr("r", SVG_WIDTH / 2.0);

  // Selexted xyY
  let selectedY = 1.0;
  let selectedChromaticity_xy = { x: 0.2, y: 0.5 };

  // Create slider with Y [0, 1]
  const sliderY = new util.Slider({
    label: "Y",
    min: 0,
    max: 1.0,
    step: 0.01,
    value: 1.0,
    id: "sliderY",
  });

  const xyText = d3
    .create("span")
    .attr("id", "xy_text")
    .style("margin", "10px")
    .text(
      `(x, y) = (${selectedChromaticity_xy.x}, ${selectedChromaticity_xy.y})`
    );

  // Take the value of the slider and change the color of the circle
  sliderY.addEventListener("input", function () {
    selectedY = Number(this.value);
    updateCircle();

    //Move the point along the isochromatic line
    const XYZ = util.cvt_xyYtoXYZ({
      x: selectedChromaticity_xy.x,
      y: selectedChromaticity_xy.y,
      Y: selectedY,
    });
    humanGamut.updateHighlightedPoint(XYZ);
  });

  let circleTraceIndex = null;

  function onChromDiagramClick(points) {
    selectedChromaticity_xy = points;
    // Cmpt the max Y value and limit the slider
    const XYZ = util.cvt_xyYtoXYZ({
      x: selectedChromaticity_xy.x,
      y: selectedChromaticity_xy.y,
      Y: 1.0,
    });
    const maxValue = Math.max(XYZ.X, XYZ.Y, XYZ.Z);
    const XYZNorm = {
      X: XYZ.X / maxValue,
      Y: XYZ.Y / maxValue,
      Z: XYZ.Z / maxValue,
    };
    selectedY = XYZNorm.Y;
    sliderY.setMax(selectedY);

    const xText = selectedChromaticity_xy.x.toFixed(2);
    const yText = selectedChromaticity_xy.y.toFixed(2);
    xyText.text(`(x, y) = (${xText}, ${yText})`);

    // Add circle marker to indicate selected point
    if (circleTraceIndex !== null) {
      Plotly.update(
        chromDiagramDiv,
        {
          x: [[selectedChromaticity_xy.x]], // Update the x-coordinates
          y: [[selectedChromaticity_xy.y]], // Update the y-coordinates
        },
        {},
        [1]
      );
    } else {
      const circleMarker = {
        x: [selectedChromaticity_xy.x],
        y: [selectedChromaticity_xy.y],
        mode: "markers",
        type: "scatter",
        marker: {
          size: 10, // Circle size
          color: "rgba(0, 0, 0, 0)", // Circle color
          line: { color: "black", width: 1 },
        },
        showlegend: false,
        name: "Selected Point",
        hoverinfo: "none",
      };
      circleTraceIndex = 1;

      // Update the graph by adding the circle
      // Use Plotly.addTraces to append new traces to the existing plot
      Plotly.addTraces(chromDiagramDiv, circleMarker);
    }
    updateCircle();

    humanGamut.highlightPoint(XYZNorm);
  }

  chromDiagramDiv.on("plotly_click", function (data) {
    onChromDiagramClick(data.points[0]);
  });

  function updateCircle() {
    const rgbColor = util.cvt_xyYtoRGB({
      x: selectedChromaticity_xy.x,
      y: selectedChromaticity_xy.y,
      Y: selectedY,
    });
    circle.attr("fill", `rgb(${rgbColor.R},${rgbColor.G},${rgbColor.B})`);
  }

  // trigger an initial state
  onChromDiagramClick(selectedChromaticity_xy);

  // Add to a div that we add to the body
  const div = d3.select("body").append("div");

  const firstRow = div
    .append("div")
    .style("display", "flex")
    .style("align-items", "center");
  const circlePatchDiv = div
    .append("div")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("align-items", "center");
  circlePatchDiv.node().append(svg.node(), xyText.node());
  firstRow.node().append(chromDiagramDiv, circlePatchDiv.node());

  const secondRow = div
    .append("div")
    .style("display", "flex")
    .style("align-items", "center");
  secondRow.node().append(sliderY.div, humanGamut.div);
}

class ColorWithLabel {
  constructor() {
    this.div = document.createElement("div");
    const SVG_WIDTH = 100;
    const SVG_HEIGHT = 100;
    this.selectedColor = { x: 0, y: 0, Y: 0 };

    // Create SVG with circle of color defined by chromaticity (x,y)
    const svg = d3
      .create("svg")
      .attr("width", SVG_WIDTH)
      .attr("height", SVG_HEIGHT);
    this.circle = svg
      .append("circle")
      .attr("cx", SVG_WIDTH / 2.0)
      .attr("cy", SVG_HEIGHT / 2.0)
      .attr("r", SVG_WIDTH / 2.0);

    this.xyYText = d3
      .create("div")
      .attr("id", "xyY_text")
      .text(
        `(x, y, Y) = (${this.selectedColor.x}, ${this.selectedColor.y}, ${this.selectedColor.Y})`
      );

    this.div.style.display = "flex";
    this.div.style.flexDirection = "column";
    this.div.style.alignItems = "center";
    this.div.append(svg.node(), this.xyYText.node());
  }

  set_xyY(x, y, Y) {
    this.selectedColor.x = x;
    this.selectedColor.y = y;
    this.selectedColor.Y = Y;
    const rgbColor = util.cvt_xyYtoRGB({
      x: x,
      y: y,
      Y: Y,
    });
    this.circle.attr(
      "fill",
      `rgb(${rgbColor.R}, ${rgbColor.G}, ${rgbColor.B})`
    );
    this.xyYText.text(
      `(x, y, Y) = (${this.selectedColor.x.toFixed(2)}, ${this.selectedColor.y.toFixed(2)}, ${this.selectedColor.Y.toFixed(2)})`
    );
  }
}

function linkControls(chromDiagramDiv, humanGamut3d, sliderY, resultColor) {
  let selectedY = 1.0;

  // Take the value of the slider and change the color of the circle
  sliderY.addEventListener("input", function () {
    selectedY = Number(this.value);
    resultColor.set_xyY(resultColor.selectedColor.x, resultColor.selectedColor.y, selectedY);

    //Move the point along the isochromatic line
    const XYZ = util.cvt_xyYtoXYZ({
      x: resultColor.selectedColor.x,
      y: resultColor.selectedColor.y,
      Y: resultColor.selectedColor.Y,
    });
    humanGamut3d.updateHighlightedPoint(XYZ);
  });

  let circleTraceIndex = null;

  function onChromDiagramClick(points) {
    const selectedChromaticity_xy = points;
    // Cmpt the max Y value and limit the slider
    const XYZ = util.cvt_xyYtoXYZ({
      x: selectedChromaticity_xy.x,
      y: selectedChromaticity_xy.y,
      Y: 1.0,
    });
    const maxValue = Math.max(XYZ.X, XYZ.Y, XYZ.Z);
    const XYZNorm = {
      X: XYZ.X / maxValue,
      Y: XYZ.Y / maxValue,
      Z: XYZ.Z / maxValue,
    };
    resultColor.set_xyY(
      selectedChromaticity_xy.x,
      selectedChromaticity_xy.y,
      XYZNorm.Y
    );
    sliderY.setMax(XYZNorm.Y);

    // Add circle marker to indicate selected point
    if (circleTraceIndex !== null) {
      Plotly.update(
        chromDiagramDiv,
        {
          x: [[selectedChromaticity_xy.x]], // Update the x-coordinates
          y: [[selectedChromaticity_xy.y]], // Update the y-coordinates
        },
        {},
        [1]
      );
    } else {
      const circleMarker = {
        x: [selectedChromaticity_xy.x],
        y: [selectedChromaticity_xy.y],
        mode: "markers",
        type: "scatter",
        marker: {
          size: 10, // Circle size
          color: "rgba(0, 0, 0, 0)", // Circle color
          line: { color: "black", width: 1 },
        },
        showlegend: false,
        name: "Selected Point",
        hoverinfo: "none",
      };
      circleTraceIndex = 1;

      // Update the graph by adding the circle
      // Use Plotly.addTraces to append new traces to the existing plot
      Plotly.addTraces(chromDiagramDiv, circleMarker);
    }
    humanGamut3d.highlightPoint(XYZNorm);
  }

  chromDiagramDiv.on("plotly_click", function (data) {
    onChromDiagramClick(data.points[0]);
  });

  // Initialize with a click
  const initialChromaticity = { x: 0.2, y: 0.5 };
  onChromDiagramClick(initialChromaticity);
}

function createAnimationColorManipulation() {
  const chromDiagramDiv = CreateFullChromaticityDiagramXy();
  const humanGamut3d = new Gamut3d();
  const sliderY = new util.Slider({
    label: "Y",
    min: 0,
    max: 1.0,
    step: 0.01,
    value: 1.0,
    id: "sliderY",
  });
  const resultColor = new ColorWithLabel();

  linkControls(chromDiagramDiv, humanGamut3d, sliderY, resultColor);

  chromDiagramDiv.style.justifySelf = "right";
  humanGamut3d.div.style.justifySelf = "left";
  sliderY.div.style.justifySelf = "right";
  resultColor.div.style.justifySelf = "left";
  const animationDiv = d3
    .create("div")
    .style("display", "grid")
    .style("grid-template-columns", "1fr 1fr")
  animationDiv
    .node()
    .append(chromDiagramDiv, humanGamut3d.div, sliderY.div, resultColor.div);

  return animationDiv.node();
}

async function main() {
  const anim = createAnimationColorManipulation();
  document
    .getElementById("playing-with-chromaticity-and-luminance")
    .append(anim);
}

main();
