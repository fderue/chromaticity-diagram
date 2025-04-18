import d3 from "./d3-loader.js";
import * as util from "./util.mjs";

const [CMFData, ,] = await util.createCMFs();

async function animateTransitionFromSrcToDst(
  graphDiv,
  SrcPoints,
  DstPoints,
  tArray,
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
      0
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

function addRgbEqual1Plane(graph3d) {
  // R in [-4, 1]
  // G in [0, 5]
  // B in [0, 1]

  const RGBeq1_plane = {
    type: "mesh3d",
    x: [2.5, -6, -6, 1],
    y: [-0.5, 8, 5, -2],
    z: [-1, -1, 2, 2],
    i: [0, 0],
    j: [1, 2],
    k: [2, 3],
    opacity: 0.15,
    color: "black",
    name: "R+G+B = 1",
    showlegend: true,
    hoverinfo: "none",
    visible: "legendonly",
  };

  Plotly.addTraces(graph3d, RGBeq1_plane);
  //addTraceWithSameLayout(graph3d, RGBeq1_plane);
  return graph3d.length - 1; // Index of new trace
}

function addIsoLines(graph3d) {
  const volumePoints = graph3d.data[0];

  // Take a point among the data
  const nbPoints = volumePoints.x.length;
  const points = [
    //Math.floor((volumePoints.x.length * 1) / 8),
    { index: Math.floor(nbPoints * 0.25), scaleFactor: 3 },
    { index: Math.floor(nbPoints * 0.3), scaleFactor: 10 },
    { index: Math.floor(nbPoints * 0.35), scaleFactor: 7 },
    { index: Math.floor(nbPoints * 0.45), scaleFactor: 1.2 },
    { index: Math.floor(nbPoints * 0.5), scaleFactor: 1.2 },
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
    line: { color: "steelblue" },
    visible: "legendonly",
  };

  Plotly.addTraces(graph3d, isoChromLineTrace);
}

function transitionLayoutRange(graphDiv, srcRange, dstRange, nbFrame = 100) {
  function interpolate(src, dst, t) {
    return src * (1 - t) + dst * t;
  }
  let t = 0;
  const stepSize = 1.0 / nbFrame;

  function updateAxis() {
    t += stepSize;

    const newXRange = [
      interpolate(srcRange.x[0], dstRange.x[0], t),
      interpolate(srcRange.x[1], dstRange.x[1], t),
    ];
    const newYRange = [
      interpolate(srcRange.y[0], dstRange.y[0], t),
      interpolate(srcRange.y[1], dstRange.y[1], t),
    ];
    const newZRange = [
      interpolate(srcRange.z[0], dstRange.z[0], t),
      interpolate(srcRange.z[1], dstRange.z[1], t),
    ];

    Plotly.relayout(graphDiv, {
      "scene.xaxis.range": newXRange,
      "scene.yaxis.range": newYRange,
      "scene.zaxis.range": newZRange,
    });
    if (t < 1.0) {
      requestAnimationFrame(updateAxis);
    }
  }

  updateAxis();
}

function ProjectOnRgbEq1(graph3d, volumePoints) {
  const nbPoints = volumePoints.x.length;

  const xpArray = new Array(nbPoints);
  const ypArray = new Array(nbPoints);
  const zpArray = new Array(nbPoints);

  for (let i = 0; i < nbPoints; i++) {
    const [x, y, z] = [volumePoints.x[i], volumePoints.y[i], volumePoints.z[i]];
    const sumXyz = x + y + z;

    xpArray[i] = x / sumXyz;
    ypArray[i] = y / sumXyz;
    zpArray[i] = z / sumXyz;
  }

  const projectionPoints = { x: xpArray, y: ypArray, z: zpArray };

  const nbFrame = 500;
  const startT = 0;
  const lastT = 1.0; // last interpolation factor where there is movement.

  const curLayout = graph3d._fullLayout;

  // Transition from one layout to another
  const curRanges = {
    x: curLayout.scene.xaxis.range,
    y: curLayout.scene.yaxis.range,
    z: curLayout.scene.zaxis.range,
  };
  const targetRanges = {
    x: [-3, 2],
    y: [-2, 8],
    z: [-0.5, 2],
  };

  transitionLayoutRange(graph3d, curRanges, targetRanges);

  // Move points
  let tArray = Array.from(
    { length: nbFrame },
    (_, i) => (i * (lastT - startT)) / nbFrame
  );
  animateTransitionFromSrcToDst(
    graph3d,
    volumePoints,
    projectionPoints,
    tArray,
    {}
  );
}

function ProjectOnRGPlane(graph3d) {
  const volumePoints = structuredClone(graph3d.data[0]);
  const nbPoints = volumePoints.x.length;

  const xpArray = new Array(nbPoints);
  const ypArray = new Array(nbPoints);
  const zpArray = new Array(nbPoints);

  for (let i = 0; i < nbPoints; i++) {
    const [x, y, z] = [volumePoints.x[i], volumePoints.y[i], volumePoints.z[i]];

    xpArray[i] = x;
    ypArray[i] = y;
    zpArray[i] = 0.0;
  }

  const projectionPoints = { x: xpArray, y: ypArray, z: zpArray };

  const curLayout = graph3d._fullLayout;
  const curXaxis = curLayout.scene.xaxis;
  const curYaxis = curLayout.scene.yaxis;
  const curZaxis = curLayout.scene.zaxis;
  const updatedLayout = {
    "scene.xaxis.range": curXaxis.range,
    "scene.yaxis.range": curYaxis.range,
    "scene.zaxis.range": curZaxis.range,
  };

  const nbFrame = 100;
  let tArray = Array.from({ length: nbFrame }, (_, i) => i / (nbFrame - 1));

  animateTransitionFromSrcToDst(
    graph3d,
    volumePoints,
    projectionPoints,
    tArray,
    updatedLayout
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

async function pointCameraOnRGPlane(graph3d) {
  const cameraOnRG = {
    eye: { x: 0, y: 0, z: 2 }, // Camera position
    up: { x: 0, y: 1, z: 0 }, // Keep the camera upright
    center: { x: 0, y: 0, z: 0 },
  };
  const curCamera = graph3d.layout.scene.camera;

  await animateCameraTransition(graph3d, curCamera, cameraOnRG, 2000);
}

function createRgbVisualGamutAnimation() {
  const animation = d3.create("div");
  const buttonPanel = d3.create("div");

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
  const powerFactor = 1.0;
  const brightenedColors = colorVolumePoints.map((c) =>
    d3.rgb(powerFactor * c.r, powerFactor * c.g, powerFactor * c.b)
  );
  const colorVolumePointsAsString = brightenedColors.map((c) => c.toString());
  const volumePointTrace = {
    type: "scatter3d",
    mode: "markers+lines",
    x: xVolumePoints,
    y: yVolumePoints,
    z: zVolumePoints,
    marker: { color: colorVolumePointsAsString, size: 3 },
    line: {
      color: colorVolumePointsAsString,
      width: 4,
    },
    name: "Spectral colors",
  };

  const layout = {
    title: "Human Visual Gamut",
    scene: {
      xaxis: {
        title: "R",
        //range: [-1, 2.0],
        //tickvals: [0.0, 0.5, 1.0],
        showspikes: false,
      },
      yaxis: {
        title: "G",
        //range: [-1, 2.0],
        //tickvals: [0.0, 0.5, 1.0],
        showspikes: false,
      },
      zaxis: {
        title: "B",
        //range: [-1, 2.0],
        //tickvals: [0.0, 0.5, 1.0],
        showspikes: false,
      },
      camera: {
        center: { x: 0, y: 0, z: 0 },
        eye: { x: 1, y: 1, z: 1 },
        up: { x: 0, y: 0, z: 1 },
        //projection: "perspective",
      },
      //aspectmode: "cube",
    },
    showlegend: true,
    hovermode: false,
    hoverdistance: -1,
  };

  const graph3Ddiv = document.createElement("div");
  Plotly.newPlot(graph3Ddiv, [volumePointTrace], layout).then((graph) => {
    const xAxisRange = graph._fullLayout.scene.xaxis.range;
    const yAxisRange = graph._fullLayout.scene.yaxis.range;
    const zAxisRange = graph._fullLayout.scene.zaxis.range;

    Plotly.relayout(graph3Ddiv, {
      "scene.xaxis.range": xAxisRange,
      "scene.yaxis.range": yAxisRange,
      "scene.zaxis.range": zAxisRange,
      "scene.aspectmode": "manual",
    });
  });

  // Add plane R+G+B = 1
  addRgbEqual1Plane(graph3Ddiv);

  // Add isochromatic line passing through the origin and the plane
  addIsoLines(graph3Ddiv);

  // Save this initial state
  let initialState = JSON.parse(JSON.stringify(graph3Ddiv.data));
  let initialLayout = JSON.parse(JSON.stringify(layout));

  // Project points on the plane R+G+B
  buttonPanel
    .append("button")
    .text("1.Project on R+G+B=1")
    .on("click", () => {
      ProjectOnRgbEq1(graph3Ddiv, {
        x: xVolumePoints,
        y: yVolumePoints,
        z: zVolumePoints,
      });
    });

  // Project points on the plane R+G+B
  buttonPanel
    .append("button")
    .text("2.Project on RG-plane")
    .on("click", () => {
      ProjectOnRGPlane(graph3Ddiv);
    });

  // Project points on the plane R+G+B
  buttonPanel
    .append("button")
    .text("3.Center camera on RG-plane")
    .on("click", () => {
      pointCameraOnRGPlane(graph3Ddiv);
    });

  buttonPanel
    .append("button")
    .text("Reset")
    .on("click", () => {
      const initialCopy = JSON.parse(JSON.stringify(initialState));
      const initialLayoutCopy = JSON.parse(JSON.stringify(initialLayout));
      Plotly.react(graph3Ddiv, initialCopy, initialLayoutCopy);
    });

  // Project points on the plane R-G and move the camera
  animation.node().append(graph3Ddiv);
  animation.node().append(buttonPanel.node());

  return animation.node();
}

function main() {
  const animationDiv = createRgbVisualGamutAnimation();
  document.getElementById("anim-RgbFrom3dTo2d").append(animationDiv);
}

main();
