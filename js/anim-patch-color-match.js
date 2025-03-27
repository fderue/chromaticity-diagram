/**
 *
 * Monochromatic Light Animation
 *
 */
import d3 from "./d3-loader.js";
import * as util from "./util.mjs";

function createMeshSpectralColorCanvas(
  CANVAS_WIDTH = 900,
  CANVAS_HEIGHT = 300
) {
  const canvas = d3
    .create("canvas")
    .attr("width", CANVAS_WIDTH)
    .attr("height", CANVAS_HEIGHT)
    .style("position", "absolute")
    .style("top", 0)
    .style("left", 0);

  const ctx = canvas.node().getContext("2d");
  const imgData = ctx.createImageData(CANVAS_WIDTH, CANVAS_HEIGHT);
  const pixels = imgData.data;

  function setPx(x, y, { R, G, B }, a = 255) {
    const idx = (y * CANVAS_WIDTH + x) * 4;
    pixels[idx] = R;
    pixels[idx + 1] = G;
    pixels[idx + 2] = B;
    pixels[idx + 3] = a;
  }

  const minLambda = 350;
  const maxLambda = 750;
  const minIntensity = 0;
  const maxIntensity = 1.0;

  const xToLambdaScale = d3
    .scaleLinear()
    .range([minLambda, maxLambda])
    .domain([0, CANVAS_WIDTH - 1]);
  const yToIntensityScale = d3
    .scaleLinear()
    .range([minIntensity, maxIntensity])
    .domain([CANVAS_HEIGHT - 1, 0]);

  for (let y = 0; y < CANVAS_HEIGHT; ++y) {
    for (let x = 0; x < CANVAS_WIDTH; ++x) {
      const curLambda = xToLambdaScale(x);
      const curIntensity = yToIntensityScale(y);
      const curLinRGB = util.cvtWavelengthToLinearRGB(curLambda);
      Object.keys(curLinRGB).forEach((c) => {
        curLinRGB[c] *= curIntensity;
      });
      const curDispRGB = util.cvtLinearRGBtoRGB(curLinRGB);

      setPx(x, y, curDispRGB, 255);
    }
  }

  ctx.putImageData(imgData, 0, 0);

  const lambdaToXscale = d3
    .scaleLinear()
    .domain([minLambda, maxLambda])
    .range([0, CANVAS_WIDTH - 1]);
  const intensityToYscale = d3
    .scaleLinear()
    .domain([minIntensity, maxIntensity])
    .range([CANVAS_HEIGHT - 1, 0]);

  return { canvas, lambdaToXscale, intensityToYscale };
}

function createSinusoidAnimationUsingD3Only(div) {
  const margin = { t: 10, r: 10, b: 10, l: 10 };
  const width = 640 - margin.r - margin.l;
  const height = 100 - margin.t - margin.b;
  const svgSinus = d3
    .create("svg")
    .attr("width", width + margin.l + margin.r)
    .attr("height", height + margin.t + margin.b);
  const svgGraph = svgSinus
    .append("g")
    .attr("transform", `translate(${margin.l}, ${margin.t})`);

  // Add circle which shows the projection of the light
  const svgCircle = d3
    .create("svg")
    .attr("width", width / 2)
    .attr("height", height + margin.t + margin.b);
  const svgGraphCircle = svgCircle
    .append("g")
    .attr("transform", `translate(${margin.l}, ${margin.t})`);

  const circleProjection = svgGraphCircle
    .append("circle")
    .attr("cx", width / 4.0)
    .attr("cy", height / 2.0)
    .attr("r", 50)
    .attr("fill", "blue");

  const minLambda = 380;
  let lambda = 500;
  let magnitude = 1.0;
  const speed = 400; //nm/s

  const lStart = 0;
  const lEnd = 4 * minLambda;
  const lStep = 10;
  const xArray = math.range(lStart, lEnd + lStep, lStep).toArray();

  function genSinusoid(xArray, Magnitude, phase) {
    return xArray.map((x) => {
      return {
        x: x,
        y: Magnitude * Math.sin(((2 * Math.PI) / lambda) * x - phase),
      };
    });
  }
  const xScale = d3.scaleLinear().domain([lStart, lEnd]).range([0, width]);
  const yScale = d3.scaleLinear().domain([-1.0, 1.0]).range([0, height]);

  // Generate the initial sinusoidal line path
  const lineGenerator = d3
    .line()
    .x((d) => xScale(d.x))
    .y((d) => yScale(d.y));

  // Append path for the sinusoid
  const path = svgGraph
    .append("path")
    .datum(genSinusoid(xArray, magnitude, 0))
    .attr("fill", "none")
    .attr(
      "stroke",
      util.cvtRGBtoD3rgb(
        util.cvtLinearRGBtoRGB(util.cvtWavelengthToLinearRGB(lambda))
      )
    )
    .attr("stroke-width", 5)
    .attr("d", lineGenerator);

  // Add 2d color map showing lambda vs intensity
  const MESH_WIDTH = 900;
  const MESH_HEIGHT = 300;
  const map2DColorLambdaVsIntensityDiv = d3
    .create("div")
    .style("width", `${MESH_WIDTH}px`)
    .style("height", `${MESH_HEIGHT}px`)
    .style("position", "relative");

  const spectralColorMesh = createMeshSpectralColorCanvas(
    MESH_WIDTH,
    MESH_HEIGHT
  );
  map2DColorLambdaVsIntensityDiv
    .node()
    .appendChild(spectralColorMesh.canvas.node());

  // Add a marker to overlaying the canvas to indicate the (lambda, intensity) position
  // of the current slider values
  const svgOverlayForMarker = map2DColorLambdaVsIntensityDiv
    .append("svg")
    .attr("width", MESH_WIDTH)
    .attr("height", MESH_HEIGHT)
    .style("position", "absolute");

  const LambdaIntensityMarker = svgOverlayForMarker
    .append("circle")
    .attr("cx", spectralColorMesh.lambdaToXscale(lambda))
    .attr("cy", spectralColorMesh.intensityToYscale(magnitude))
    .attr("r", 10)
    .style("stroke", "white")
    .style("fill", "none");

  function updateMarkerPosition() {
    LambdaIntensityMarker.attr("cx", spectralColorMesh.lambdaToXscale(lambda));
    LambdaIntensityMarker.attr(
      "cy",
      spectralColorMesh.intensityToYscale(magnitude)
    );
  }

  // Create Animation that shows the updated elements
  const frameDuration = 10;
  let lastTime = 0;
  function animate(timestamp) {
    if (timestamp - lastTime >= frameDuration) {
      lastTime = timestamp;
      const t = timestamp * 0.001; // t is in second
      const newPhase = ((2 * Math.PI) / lambda) * speed * t;
      const updatedData = genSinusoid(xArray, magnitude, newPhase);
      path.datum(updatedData).attr("d", lineGenerator);
      const waveLinearRgbColor = util.cvtWavelengthToLinearRGB(lambda);
      Object.keys(waveLinearRgbColor).forEach((c) => {
        waveLinearRgbColor[c] *= magnitude;
      });
      const waveDisplayRgbColor = util.cvtLinearRGBtoRGB(waveLinearRgbColor);
      const d3rgbWaveColor = util.cvtRGBtoD3rgb(waveDisplayRgbColor);
      path.attr("stroke", d3rgbWaveColor);
      circleProjection.attr("fill", d3rgbWaveColor);
    }

    requestAnimationFrame(animate);
  }

  // Add controls
  const controlDiv = document.createElement("div");
  controlDiv.style.display = "flex";

  // Add slider for wavelength
  const sliderWavelength = new util.Slider({
    label: "λ",
    min: spectralColorMesh.lambdaToXscale.domain()[0],
    max: spectralColorMesh.lambdaToXscale.domain()[1],
    step: 1,
    value: 500,
  });
  sliderWavelength.addEventListener("input", function () {
    lambda = this.value;
    updateMarkerPosition();
  });

  // Add slider for intensity
  const sliderMagnitude = new util.Slider({
    label: "Intensity",
    min: 0.01,
    max: 1.0,
    step: 0.01,
    value: magnitude,
  });

  sliderMagnitude.addEventListener("input", function () {
    magnitude = this.value;
    updateMarkerPosition();
  });

  controlDiv.append(sliderWavelength.div, sliderMagnitude.div);

  // Start sinusoid animation
  animate();

  const animDiv = document.createElement("div");
  animDiv.appendChild(svgSinus.node());
  animDiv.appendChild(svgCircle.node());
  animDiv.appendChild(map2DColorLambdaVsIntensityDiv.node());
  animDiv.appendChild(controlDiv);
  animDiv.appendChild(map2DColorLambdaVsIntensityDiv.node());

  return animDiv;
}

function createColorPatch() {
  const svgWidth = 400;
  const svgHeight = 160;
  const svg = d3.create("svg").attr("width", svgWidth);

  const colors = ["rgb(210, 144, 162)", "rgb(126, 138, 134)", "rgb(78, 173, 180)"];
  const radius = 50;
  const yPos = svgHeight / 2.0;

  colors.forEach((c, i) => {
    svg
      .append("circle")
      .attr("cx", (i * svgWidth) / 3.0 + svgWidth / 6)
      .attr("cy", yPos)
      .attr("r", radius)
      .attr("fill", `${c}`);
  });

  const div = document.createElement("div");
  div.append(svg.node());
  return div;
}

function main() {
  const div = d3.select("#anim-patch-color-match");
  const colorPatch = createColorPatch();
  const sinusAnimation = createSinusoidAnimationUsingD3Only();
  div.node().append(colorPatch, sinusAnimation);
}

main();
