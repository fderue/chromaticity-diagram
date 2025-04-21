import d3 from "./d3-loader.js";
import * as util from "./util.mjs";

const SVG_WIDTH = 700;
const SVG_HEIGHT = 400;

function createSpectralColorBar(barWidth, barHeight) {
  const canvas = d3
    .create("canvas")
    .attr("width", barWidth)
    .attr("height", barHeight);

  const ctx = canvas.node().getContext("2d");
  const imgData = ctx.createImageData(barWidth, barHeight);
  const pixels = imgData.data;

  function setPx(x, y, d3color) {
    const idx = (y * barWidth + x) * 4;
    pixels[idx] = d3color.r;
    pixels[idx + 1] = d3color.g;
    pixels[idx + 2] = d3color.b;
    pixels[idx + 3] = Math.round(d3color.opacity * 255);
  }

  const minLambda = 380;
  const maxLambda = 750;
  const intensity = 1;

  const xToLambdaScale = d3
    .scaleLinear()
    .range([minLambda, maxLambda])
    .domain([0, barWidth - 1]);

  for (let y = 0; y < barHeight; ++y) {
    for (let x = 0; x < barWidth; ++x) {
      const curLambda = xToLambdaScale(x);
      const curLinRGB = util.cvtWavelengthToLinearRGB(curLambda);
      Object.keys(curLinRGB).forEach((c) => {
        curLinRGB[c] *= intensity;
      });
      const curDispRGB = util.cvtLinearRGBtoRGB(curLinRGB);
      setPx(x, y, d3.rgb(curDispRGB.R, curDispRGB.G, curDispRGB.B));
    }
  }

  ctx.putImageData(imgData, 0, 0);

  return canvas.node();
}

function createIncreasingLambdaSinusoid(numPoints, width, height) {
  const A = height; // amplitude
  const centerY = height / 2;
  const data = new Array(numPoints);
  let phase = 0;
  for (let i = 0; i < numPoints; i++) {
    const x = i * (width / numPoints);

    // Increase wavelength by reducing frequency
    const freq = 0.3 / (0.5 + 0.01 * x);
    phase += freq;

    const y = centerY + A * Math.sin(phase);
    data[i] = { x, y };
  }

  return data;
}

function createEMspectrumDiagram() {
  // Create svg container
  const svg = d3
    .create("svg")
    .attr("width", SVG_WIDTH)
    .attr("height", SVG_HEIGHT);

  // Create x-axis for wavelength
  const axisLength = 0.8 * SVG_WIDTH;
  const axisPosition = { x: 0.1 * SVG_WIDTH, y: 0.4 * SVG_HEIGHT };
  const xScale = d3.scaleLog().domain([1e-18, 1e4]).range([0, axisLength]);
  const xAxis = d3.axisTop(xScale).tickFormat(d3.format(".0e"));
  const xAxisGroup = svg
    .append("g")
    .attr("transform", `translate(${axisPosition.x}, ${axisPosition.y})`)
    .call(xAxis);
  //xAxisGroup.append("svg:text").attr("transform", `translate(0, 10)`).text("Wavelength");
  xAxisGroup
    .append("text")
    .attr("x", axisLength / 2.0)
    .attr("y", -40)
    .attr("text-anchor", "middle")
    .attr("fill", "black") // Ensure it's visible
    .style("font-size", "12px")
    .text("Wavelength (λ) [m]");

  // Add boxes for different categories
  const emCategories = [
    { name: "Gamma Rays", range: [5e-17, 1e-11] },
    { name: "X-Rays", range: [1e-11, 8e-9] },
    { name: "UV", range: [8e-9, 1e-7] },
    { name: "IR", range: [8e-7, 1e-3] },
    { name: "Microwave", range: [1e-3, 1] },
    { name: "Radio waves", range: [1, 1e3] },
  ];

  const boxHeight = 40;
  const yBoxPosition = 20;
  xAxisGroup
    .selectAll(".emBox")
    .data(emCategories)
    .enter()
    .append("svg:rect")
    .attr("x", (d) => xScale(d.range[0]))
    .attr("y", yBoxPosition)
    .attr("width", (d) => xScale(d.range[1]) - xScale(d.range[0]))
    .attr("height", boxHeight)
    .style("fill", "#eeeeee")
    .style("stroke", "black");

  xAxisGroup
    .selectAll(".emName")
    .data(emCategories)
    .enter()
    .append("svg:text")
    .attr("x", (d) => (xScale(d.range[0]) + xScale(d.range[1])) / 2.0)
    .attr("y", yBoxPosition + boxHeight / 2.0)
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .attr("fill", "black")
    .style("font-size", "12px")
    .text((d) => d.name);

  // Create spectral color bar
  const spectralColorBarCanvas = createSpectralColorBar(
    0.5 * SVG_WIDTH,
    boxHeight
  );

  const barTopLeftPosition = {
    x: axisLength / 2.0 - spectralColorBarCanvas.width / 2.0,
    y: yBoxPosition + boxHeight + 50,
  };
  const spectralColrBarSvg = xAxisGroup
    .append("g")
    .attr(
      "transform",
      `translate(${barTopLeftPosition.x}, ${barTopLeftPosition.y})`
    );
  spectralColrBarSvg
    .append("image")
    .attr("xlink:href", spectralColorBarCanvas.toDataURL());

  xAxisGroup
    .append("text")
    .attr("x", axisLength / 2.0)
    .attr("y", yBoxPosition + boxHeight + 40)
    .attr("text-anchor", "middle")
    .attr("fill", "black")
    .style("font-size", "12px")
    .text("Visible Light");

  // Add linear axis under color bar
  const colorBarScale = d3
    .scaleLinear()
    .domain([380, 750])
    .range([0, spectralColorBarCanvas.width]);
  const colorBarAxis = d3.axisBottom(colorBarScale);
  spectralColrBarSvg
    .append("g")
    .attr("transform", `translate(0, ${boxHeight})`)
    .call(colorBarAxis);

  // Add two connecting line to the spectral color bar
  const UV = emCategories.find((e) => e.name === "UV");
  xAxisGroup
    .append("svg:line")
    .attr("x1", xScale(UV.range[1]))
    .attr("y1", yBoxPosition + boxHeight)
    .attr("x2", barTopLeftPosition.x)
    .attr("y2", barTopLeftPosition.y)
    .style("stroke", "black")
    .style("stroke-dasharray", "4, 4");

  const IR = emCategories.find((e) => e.name === "IR");

  xAxisGroup
    .append("svg:line")
    .attr("x1", xScale(IR.range[0]))
    .attr("y1", yBoxPosition + boxHeight)
    .attr("x2", barTopLeftPosition.x + spectralColorBarCanvas.width)
    .attr("y2", barTopLeftPosition.y)
    .style("stroke", "black")
    .style("stroke-dasharray", "4, 4");

  // Add variable sinusoid on top
  const sinusoidData = createIncreasingLambdaSinusoid(
    axisLength,
    axisLength,
    20
  );
  const lineGen = d3
    .line()
    .x((d) => d.x)
    .y((d) => d.y);
  xAxisGroup
    .append("svg:g")
    .attr("transform", `translate(0, ${-100})`)
    .append("svg:path")
    .datum(sinusoidData)
    .attr("fill", "none")
    .attr("stroke", "lightGray")
    .attr("stroke-width", 2)
    .attr("d", lineGen);

  const div = document.createElement("div");
  div.append(svg.node());
  return div;
}

function main() {
  const emSpectrumDiagram = createEMspectrumDiagram();
  document.getElementById("svg-em-spectrum").append(emSpectrumDiagram);
}

main();
