import d3 from "./d3-loader.js";
import * as util from "./util.mjs";

const [CMFData, ,] = await util.createCMFs();

function interpolatePoint(pt, newPt, t) {
  function lerp(src, dst, t) {
    return src * (1.0 - t) + dst * t;
  }
  const out = {};
  Object.keys(pt).forEach((k) => {
    out[k] = lerp(pt[k], newPt[k], t);
  });
  return out;
}

class TriAxis {
  static counter = 0;
  constructor({
    div,
    primaryPoints = [
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 0, z: 1 },
    ],
    name = "XYZ",
    color = "black",
    primaryNames = ["X", "Y", "Z"],
  }) {
    this.div = div;
    this.primaryPoints = primaryPoints;
    this.axisExtLength = 1.0;
    this.name = name;
    this.traceIndexes = [];
    this.color = color;

    /* Create each elements as a trace: points, line, arrows */
    // Create Points
    const [xPrimArray, yPrimArray, zPrimArray] = util.unzipArrayOfObject(
      this.primaryPoints
    );

    const xyzPrimaryPointTrace = {
      type: "scatter3d",
      mode: "markers+text",
      x: xPrimArray,
      y: yPrimArray,
      z: zPrimArray,
      text: primaryNames,
      //hovertemplate: "R: %{x}<br>G:%{y}<br>B:%{z}",
      marker: { color: this.color, size: 5.0 },
      name: `${this.name} primaries`,
    };

    // Add XYZ axis as line + arrow
    // Axis are arrow lines that pass through the primary points to some extent
    const axisComponents = this.cmptAxisComponents(this.primaryPoints);
    const [updatedLineX, updatedLineY, updatedLineZ] = util.unzipArrayOfObject(
      axisComponents.lines
    );
    const [updatedArrowX, updatedArrowY, updatedArrowZ] =
      util.unzipArrayOfObject(axisComponents.arrows.position);
    const [updatedArrowU, updatedArrowV, updatedArrowW] =
      util.unzipArrayOfObject(axisComponents.arrows.direction);

    const xyzAxisLine = {
      x: updatedLineX.flat(),
      y: updatedLineY.flat(),
      z: updatedLineZ.flat(),
      mode: "lines",
      line: { color: this.color, width: 5 },
      name: `${this.name} axis`,
      type: "scatter3d",
      hoverinfo: "none",
      legendgroup: `${this.name}`,
    };

    const arrowCones = {
      type: "cone",
      x: updatedArrowX,
      y: updatedArrowY,
      z: updatedArrowZ,
      u: updatedArrowU, // X arrow direction
      v: updatedArrowV, // Y arrow direction
      w: updatedArrowW, // Z arrow direction
      sizemode: "absolute",
      sizeref: 0.1, // Arrow size
      colorscale: [
        [0, this.color],
        [1, this.color],
      ],
      showscale: false,
      hoverinfo: "none",
      legendgroup: `${this.name}`,
    };

    const newTraceIndexes = Array.from(
      { length: 3 },
      (_, i) => 3 * TriAxis.counter + i
    );
    this.traceIndexes = newTraceIndexes;
    Plotly.addTraces(
      this.div,
      [xyzPrimaryPointTrace, xyzAxisLine, arrowCones],
      newTraceIndexes
    );

    TriAxis.counter++;
  }

  cmptAxisComponents(primaryPoints) {
    const primaryUnitVectors = primaryPoints.map((pt) => {
      const norm = Math.hypot(pt.x, pt.y, pt.z);
      return {
        x: pt.x / norm,
        y: pt.y / norm,
        z: pt.z / norm,
      };
    });

    const extPrimaries = primaryPoints.map((pt, i) => {
      return {
        x: pt.x + primaryUnitVectors[i].x * this.axisExtLength,
        y: pt.y + primaryUnitVectors[i].y * this.axisExtLength,
        z: pt.z + primaryUnitVectors[i].z * this.axisExtLength,
      };
    });

    const lineExtremities = extPrimaries.map((pt) => {
      return {
        x: [0, pt.x, null],
        y: [0, pt.y, null],
        z: [0, pt.z, null],
      };
    });

    const axisComponents = {
      lines: lineExtremities, //ex: [{x:[0, 1, null], y:[0, 1, null], z:[0, 1, null]}]
      arrows: {
        position: extPrimaries,
        direction: primaryUnitVectors,
      },
    };

    return axisComponents;
  }

  transitionTo(newTriAxis, nbFrame = 100) {
    return new Promise((resolve) => {
      const tStep = 1.0 / nbFrame;
      let t = 0;
      const animate = () => {
        t += tStep;

        const updatedPoints = this.primaryPoints.map((pt, ptIdx) => {
          return interpolatePoint(pt, newTriAxis[ptIdx], t);
        });
        const [updatedPointsX, updatedPointsY, updatedPointsZ] =
          util.unzipArrayOfObject(updatedPoints);

        const updatedAxis = this.cmptAxisComponents(updatedPoints);
        const [updatedLineX, updatedLineY, updatedLineZ] =
          util.unzipArrayOfObject(updatedAxis.lines);
        const [updatedArrowX, updatedArrowY, updatedArrowZ] =
          util.unzipArrayOfObject(updatedAxis.arrows.position);
        const [updatedArrowU, updatedArrowV, updatedArrowW] =
          util.unzipArrayOfObject(updatedAxis.arrows.direction);

        const updatedTraces = {
          x: [updatedPointsX, updatedLineX.flat(), updatedArrowX],
          y: [updatedPointsY, updatedLineY.flat(), updatedArrowY],
          z: [updatedPointsZ, updatedLineZ.flat(), updatedArrowZ],
          u: [[], [], updatedArrowU],
          v: [[], [], updatedArrowV],
          w: [[], [], updatedArrowW],
        };

        Plotly.restyle(this.div, updatedTraces, this.traceIndexes);

        if (t < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };
      animate();
    });
  }
}

function addRgbAxis(graph3d) {
  const rgbAxis = new TriAxis({
    div: graph3d,
    name: "RGB",
    color: "#EFB036",
    primaryNames: ["R", "G", "B"],
  });
  return rgbAxis;
}

function addXyzAxis(graph3d) {
  const Xprimary = {
    x: 2.3637509156557432,
    y: -0.895807708341233,
    z: -0.4679432073145103,
  };

  const Yprimary = {
    x: -0.513576753970226,
    y: 1.4249005714804774,
    z: 0.08867618248974839,
  };

  const Zprimary = {
    x: 0.005191389570818167,
    y: -0.014260846851179398,
    z: 1.0090694572803613,
  };

  const xyzAxis = new TriAxis({
    div: graph3d,
    primaryPoints: [Xprimary, Yprimary, Zprimary],
    name: "XYZ",
    color: "steelblue",
  });
  return xyzAxis;
}

function animateTransitionFromSrcToDst(
  graphDiv,
  SrcPoints,
  DstPoints,
  tArray,
  traceIndex = 0,
  updatedLayout = {}
) {
  const nbPoints = SrcPoints.x.length;

  function updateInterpolatedPoints(t, interpolatedPoints) {
    for (let i = 0; i < nbPoints; i++) {
      interpolatedPoints.x[i] = SrcPoints.x[i] * (1 - t) + DstPoints.x[i] * t;
      interpolatedPoints.y[i] = SrcPoints.y[i] * (1 - t) + DstPoints.y[i] * t;
      interpolatedPoints.z[i] = SrcPoints.z[i] * (1 - t) + DstPoints.z[i] * t;
    }
  }

  const interpolatedPoints = {
    x: new Array(nbPoints),
    y: new Array(nbPoints),
    z: new Array(nbPoints),
  };

  let t = 0;

  function animate() {
    updateInterpolatedPoints(tArray[t], interpolatedPoints);
    t++;

    Plotly.update(
      graphDiv,
      {
        x: [interpolatedPoints.x],
        y: [interpolatedPoints.y],
        z: [interpolatedPoints.z],
      },
      null,
      traceIndex
    );

    if (t < tArray.length) {
      requestAnimationFrame(animate);
    }
  }
  Plotly.relayout(graphDiv, updatedLayout).then(() => {
    animate();
  });
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

function genRgbSpectralColors() {
  const CMFDataR = util.unzipXY(CMFData[0].values);
  const CMFDataG = util.unzipXY(CMFData[1].values);
  const CMFDataB = util.unzipXY(CMFData[2].values);
  const nbSpectralColors = CMFDataR.x.length;
  const spectralPoints = Array.from({ length: nbSpectralColors }, () => {
    return { x: 0, y: 0, z: 0 };
  });

  const scaleFactor =
    1 /
    Math.max(
      Math.max(...CMFDataR.y),
      Math.max(...CMFDataG.y),
      Math.max(...CMFDataB.y)
    );

  for (let i = 0; i < nbSpectralColors; ++i) {
    spectralPoints[i].x = scaleFactor * CMFDataR.y[i];
    spectralPoints[i].y = scaleFactor * CMFDataG.y[i];
    spectralPoints[i].z = scaleFactor * CMFDataB.y[i];
  }

  // Create 3d visual gamut with only spectral colors
  const volumePoints = lerpPointsBetween(
    spectralPoints,
    ({ x, y, z }) => util.cvtLinearRGBtoRGB({ R: x, G: y, B: z }),
    2.0
  );
  const [xVolumePoints, yVolumePoints, zVolumePoints, colorVolumePoints] =
    util.unzipArrayOfObject(volumePoints);

  const colorVolumePointsAsString = colorVolumePoints.map((c)=>c.toString()) ;

  return {
    x: xVolumePoints,
    y: yVolumePoints,
    z: zVolumePoints,
    color: colorVolumePointsAsString,
  };
}

function cvtRgbToXyzArray(rgbArrays){
    const nbPoints = rgbArrays.x.length;
    const xArray = new Array(nbPoints);
    const yArray = new Array(nbPoints);
    const zArray = new Array(nbPoints);
    for (let i = 0; i < nbPoints; ++i) {
      const R = rgbArrays.x[i];
      const G = rgbArrays.y[i];
      const B = rgbArrays.z[i];
  
      const XYZ = util.cvtLinearRGBtoXYZ({ R, G, B});
      xArray[i]=(XYZ.X);
      yArray[i]=(XYZ.Y);
      zArray[i]=(XYZ.Z);
    }
  
    return { x:xArray, y:yArray, z:zArray, color:rgbArrays.color};
}

function addVisualGamut3d(graph3d) {
  const spectralRGBArrays = genRgbSpectralColors();
  const spectralXYZArrays = cvtRgbToXyzArray(spectralRGBArrays);

  const spectralRGBdata = {
    x: spectralRGBArrays.x,
    y: spectralRGBArrays.y,
    z: spectralRGBArrays.z,
    mode: "markers",
    marker: {
      size: 3,
      color: spectralRGBArrays.color,
      opacity: 1,
    },
    type: "scatter3d",
    name: "Human Visual Gamut",
    hoverinfo: "none",
  };

  // using TriAxis.counter is not safe because it assumes that
  // all the TriAxis have already been constructed.
  const traceIndex = TriAxis.counter * 3;
  Plotly.addTraces(graph3d, spectralRGBdata, traceIndex);
  return {
    rgbData: spectralRGBArrays,
    xyzData: spectralXYZArrays,
    traceIndex: traceIndex,
  };
}

function addXyzEq1Plane(graph3d) {
  const planeTrace = {
    type: "mesh3d",
    x: [3.5, -6, -6, 1],
    y: [-1.5, 8, 5, -2],
    z: [-1, -1, 2, 2],
    i: [0, 0],
    j: [1, 2],
    k: [2, 3],
    opacity: 0.15,
    color: "black",
    name: "X+Y+Z = 1",
    showlegend: true,
    hoverinfo: "none",
    visible: "legendonly",
  };

  Plotly.addTraces(graph3d, [planeTrace]);
}

function addIsoLines(graph3d, visualGamutPoints) {
  const volumePoints = visualGamutPoints;

  // Take a point among the data
  const nbPoints = volumePoints.x.length;
  const points = [
    //Math.floor((volumePoints.x.length * 1) / 8),
    { index: Math.floor(nbPoints * 0.25), scaleFactor: 3 },
    { index: Math.floor(nbPoints * 0.3), scaleFactor: 5 },
    { index: Math.floor(nbPoints * 0.35), scaleFactor: 4 },
    { index: Math.floor(nbPoints * 0.45), scaleFactor: 2 },
    { index: Math.floor(nbPoints * 0.5), scaleFactor: 2 },
  ];

  const lineCoordinates = points.map((point) => {
    const linePoint = {
      x: volumePoints.x[point.index],
      y: volumePoints.y[point.index],
      z: volumePoints.z[point.index],
    };

    // Draw a line from origin to linePoint
    return {
      x: [0.0, linePoint.x * point.scaleFactor],
      y: [0.0, linePoint.y * point.scaleFactor],
      z: [0.0, linePoint.z * point.scaleFactor],
    };
  });

  const linesX = lineCoordinates.flatMap((d) => [...d.x, null]);
  const linesY = lineCoordinates.flatMap((d) => [...d.y, null]);
  const linesZ = lineCoordinates.flatMap((d) => [...d.z, null]);

  const isoChromLineTrace = {
    type: "scatter3d",
    x: linesX,
    y: linesY,
    z: linesZ,
    mode: "lines",
    name: "isochromatic line",
    line: { color: "gray" },
    visible: "legendonly",
  };

  Plotly.addTraces(graph3d, isoChromLineTrace);
}

function animateXyzAxis(graph3d, xyzAxis, rgbAxis, visualGamut) {
  Plotly.relayout(graph3d, {
    "scene.xaxis.title": "R",
    "scene.yaxis.title": "G",
    "scene.zaxis.title": "B",
  });

  xyzAxis
    .transitionTo(
      [
        { x: 1, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
        { x: 0, y: 0, z: 1 },
      ],
      100
    )
    .then(() => {
      // Relayout to change the axis
      const updatedLayout = {
        "scene.xaxis.title": "X",
        "scene.yaxis.title": "Y",
        "scene.zaxis.title": "Z",
      };
      Plotly.relayout(graph3d, updatedLayout);
    });

  rgbAxis.transitionTo([
    { x: 0.48998087, y: 0.31004302, z: 0.19997611 },
    { x: 0.1766053, y: 0.8129364, z: 0.0104583 },
    { x: -0.00002491, y: 0.00989388, z: 0.99013104 },
  ]);

  // Add full volume animation
  const srcPoints = {
    x: visualGamut.rgbData.x,
    y: visualGamut.rgbData.y,
    z: visualGamut.rgbData.z,
  };
  const dstPoints = {
    x: visualGamut.xyzData.x,
    y: visualGamut.xyzData.y,
    z: visualGamut.xyzData.z,
  };
  const nbFrame = 100;
  const tArray = Array.from(
    { length: nbFrame },
    (_, i) => (1.0 / (nbFrame - 1)) * i
  );
  animateTransitionFromSrcToDst(
    graph3d,
    srcPoints,
    dstPoints,
    tArray,
    visualGamut.traceIndex
  );
}

function projectOnXyzEq1(srcPoints) {
  const nbPoints = srcPoints.x.length;
  const xpArray = new Array(nbPoints);
  const ypArray = new Array(nbPoints);
  const zpArray = new Array(nbPoints);
  for (let i = 0; i < nbPoints; i++) {
    const [x, y, z] = [srcPoints.x[i], srcPoints.y[i], srcPoints.z[i]];
    const sumXyz = x + y + z;
    xpArray[i] = x / sumXyz;
    ypArray[i] = y / sumXyz;
    zpArray[i] = z / sumXyz;
  }

  return {
    x: xpArray,
    y: ypArray,
    z: zpArray,
  };
}

function projectOnXyzEq1Animation(graph3d, visualGamut) {
  const srcPoints = {
    x: visualGamut.xyzData.x,
    y: visualGamut.xyzData.y,
    z: visualGamut.xyzData.z,
  };

  const dstPoints = projectOnXyzEq1(srcPoints);

  const nbFrame = 100;
  const tArray = Array.from(
    { length: nbFrame },
    (_, i) => (1.0 / (nbFrame - 1)) * i
  );
  animateTransitionFromSrcToDst(
    graph3d,
    srcPoints,
    dstPoints,
    tArray,
    visualGamut.traceIndex
  );
}

function projectOnXyPlaneAnimation(graph3d, visualGamut) {
  const xyzVolume = {
    x: visualGamut.xyzData.x,
    y: visualGamut.xyzData.y,
    z: visualGamut.xyzData.z,
  };

  const pointsOnXyzEq1 = projectOnXyzEq1(xyzVolume);
  const nbPoints = xyzVolume.x.length;
  const xpArray = new Array(nbPoints);
  const ypArray = new Array(nbPoints);
  const zpArray = new Array(nbPoints);
  for (let i = 0; i < nbPoints; i++) {
    xpArray[i] = pointsOnXyzEq1.x[i];
    ypArray[i] = pointsOnXyzEq1.y[i];
    zpArray[i] = 0.0;
  }
  const pointsOnXyPlane = {
    x: xpArray,
    y: ypArray,
    z: zpArray,
  };

  const nbFrame = 100;
  const tArray = Array.from(
    { length: nbFrame },
    (_, i) => (1.0 / (nbFrame - 1)) * i
  );
  animateTransitionFromSrcToDst(
    graph3d,
    pointsOnXyzEq1,
    pointsOnXyPlane,
    tArray,
    visualGamut.traceIndex
  );
}

function animateCameraTransition(graphDiv, startCamera, endCamera, durationMs) {
  function interpolate(start, end, t) {
    return start + (end - start) * t;
  }
  return new Promise((resolve) => {
    const fps = 30;
    const nbFrames = (durationMs / 1000.0) * fps;
    let t = 0.0;
    const dT = 1 / nbFrames;

    function updateCamera() {
      t += dT;
      // Interpolating camera position
      const newCamera = {
        eye: {
          x: interpolate(startCamera.eye.x, endCamera.eye.x, t),
          y: interpolate(startCamera.eye.y, endCamera.eye.y, t),
          z: interpolate(startCamera.eye.z, endCamera.eye.z, t),
        },
        up: {
          x: interpolate(startCamera.up.x, endCamera.up.x, t),
          y: interpolate(startCamera.up.y, endCamera.up.y, t),
          z: interpolate(startCamera.up.z, endCamera.up.z, t),
        },
        center: {
          x: interpolate(startCamera.center.x, endCamera.center.x, t),
          y: interpolate(startCamera.center.y, endCamera.center.y, t),
          z: interpolate(startCamera.center.z, endCamera.center.z, t),
        },
      };

      // Update the camera position
      Plotly.relayout(graphDiv, {
        "scene.camera": newCamera,
      });

      // Continue the animation if not finished
      if (t < 1) {
        requestAnimationFrame(updateCamera);
      } else {
        Plotly.relayout(graphDiv, {
          "scene.camera": endCamera,
        });
        resolve();
      }
    }

    // Start the animation
    requestAnimationFrame(updateCamera);
  });
}

function pointCameraOnXyPlane(graph3d) {
  const cameraOnXy = {
    eye: { x: 0, y: 0, z: 1 }, // Camera position
    up: { x: 0, y: 1, z: 0 }, // Keep the camera upright
    center: { x: 0, y: 0, z: 0 },
  };
  const curCamera = graph3d.layout.scene.camera;
  animateCameraTransition(graph3d, curCamera, cameraOnXy, 5000);
}

function createRgb2XyzAnimation() {
  const animationDiv = document.createElement("div");
  const graph3d = document.createElement("div");
  const buttonPanel = d3.create("div");
  const layout = {
    title: "Human Visual Gamut",
    scene: {
      xaxis: {
        title: "R",
        range: [-1.223289530750119, 3.654444614140031],
        showspikes: false,
      },
      yaxis: {
        title: "G",
        range: [-1.5990158836493458, 2.7187975388295467],
        showspikes: false,
      },
      zaxis: {
        title: "B",
        range: [-0.9750471956249968, 2.334034486445048],
        showspikes: false,
      },
      aspectmode: "cube",
      camera: {
        center: { x: 0, y: 0, z: 0 },
        eye: { x: 1, y: 1, z: 1 },
        up: { x: 0, y: 0, z: 1 },
      },
    },
    //hovermode: false,
  };
  Plotly.newPlot(graph3d, [], layout);

  const rgbAxis = addRgbAxis(graph3d);
  const xyzAxis = addXyzAxis(graph3d);
  const visualGamut = addVisualGamut3d(graph3d);
  addXyzEq1Plane(graph3d);
  addIsoLines(graph3d, {
    x: visualGamut.xyzData.x,
    y: visualGamut.xyzData.y,
    z: visualGamut.xyzData.z,
  });

  // Save this initial state
  let initialState = JSON.parse(JSON.stringify(graph3d.data));
  let initialLayout = JSON.parse(JSON.stringify(layout));
 
  // Animate the XyzAxis (line, points, arrows)
  buttonPanel
    .append("button")
    .text("1. RGB->XYZ")
    .on("click", () => {
      animateXyzAxis(graph3d, xyzAxis, rgbAxis, visualGamut);
    });

  // Add plane X+Y+Z = 1 (should be there already, just toggle it)

  // Project on X+Y+Z = 1
  buttonPanel
    .append("button")
    .text("2. Project on X+Y+Z=1")
    .on("click", () => {
      projectOnXyzEq1Animation(graph3d, visualGamut);
    });

  // Project on xy-plane
  buttonPanel
    .append("button")
    .text("3. Project on xy-plane")
    .on("click", () => {
      projectOnXyPlaneAnimation(graph3d, visualGamut);
    });

  // Point camera on xy-plane
  buttonPanel
    .append("button")
    .text("4. Point camera on xy-plane")
    .on("click", () => {
      pointCameraOnXyPlane(graph3d);
    });

    buttonPanel
    .append("button")
    .text("Reset")
    .on("click", () => {
      const initialCopy = JSON.parse(JSON.stringify(initialState));
      const initialLayoutCopy = JSON.parse(JSON.stringify(initialLayout));
      Plotly.react(graph3d, initialCopy, initialLayoutCopy);
    });

  animationDiv.append(graph3d);
  animationDiv.append(buttonPanel.node());
  return animationDiv;
}

function main() {
  const animationDiv = createRgb2XyzAnimation();
  document.getElementById("anim-cieRGBtoXYZ").append(animationDiv);
}

main();
