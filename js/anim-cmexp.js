import d3 from "./d3-loader.js";
import * as util from "./util.mjs";

const [, , lambdaToVMap] = await util.createCMFs();
const chromCoefRawData = await util.loadData("data/CIE_rgb_coef.csv");

const SCENE_WIDTH = 750;
const SCENE_HEIGHT = 400;
const SCENE_BGND = d3.rgb(200, 200, 200);

class Scene {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.animationDiv = d3.create("div");
    this.animationDiv.style("position", "relative");
    this.svgContainer = this.animationDiv
      .append("svg")
      .attr("width", this.width)
      .attr("height", this.height);

    this.svgContainer
      .append("rect")
      .attr("width", this.width)
      .attr("height", this.height)
      .attr("fill", SCENE_BGND);
  }

  add(svgElement) {
    this.svgContainer.node().appendChild(svgElement);
  }

  getDiv() {
    return this.animationDiv.node();
  }
}

function createSvgButton(buttonWidth = 10, buttonHeight = 10, name = "button") {
  const button = d3
    .create("svg:g")
    .attr("class", "button")
    .style("cursor", "pointer");

  // Draw button background (rectangle)
  button
    .append("svg:rect")
    .attr("width", buttonWidth)
    .attr("height", buttonHeight)
    .style("fill", "none");

  // Add button text
  button
    .append("svg:text")
    .attr("x", buttonWidth / 2)
    .attr("y", buttonHeight / 2)
    .attr("dy", "0.35em")
    .style("fill", "black")
    .style("font-size", buttonHeight - 4)
    .style("text-anchor", "middle")
    .text(name);

  return button;
}

class Dial {
  constructor({
    position = { x: 0, y: 0 },
    color = d3.rgb(0, 0, 0),
    unit = { min: 0.0, max: 1.0 },
    name = "",
  }) {
    this.position = position;
    this.name = name;
    this.radius = 20;
    this.value = unit.min;
    this.incrementStep = 1.0;
    this.min = unit.min;
    this.max = unit.max;
    this.nbDecimalToDisplay = 0;
    this.controlFunc = () => {};
    const startAngleDeg = 135.0;
    const endAngleDeg = startAngleDeg + 270.0;
    this.valueToAngleDeg = d3
      .scaleLinear()
      .domain([unit.min, unit.max])
      .range([startAngleDeg, endAngleDeg]);

    this.unitToNormValue = d3
      .scaleLinear()
      .domain([unit.min, unit.max])
      .range([0.0, 1.0]);

    // Static elements
    this.circle = d3
      .create("svg:circle")
      .attr("cx", 0)
      .attr("cy", 0)
      .attr("r", this.radius)
      .attr("fill", color)
      .attr("fill-opacity", 1.0)
      .attr("stroke", "black")
      .attr("stroke-opacity", 1.0);

    const unitLabelY = -this.radius - 20;
    const buttonWidth = 10;
    const buttonHeight = 10;
    this.#createControlButtons(buttonWidth, buttonHeight);
    this.increaseButton.attr(
      "transform",
      `translate(${20 - buttonWidth / 2.0}, ${unitLabelY})`
    );

    this.decreaseButton.attr(
      "transform",
      `translate(${-20 - buttonWidth / 2.0}, ${unitLabelY})`
    );

    this.unitLabel = d3
      .create("svg:text")
      .attr("fill", "black")
      .attr("x", 0)
      .attr("y", unitLabelY)
      .attr("text-anchor", "middle")
      .text("Unit");

    this.nameLabel = d3
      .create("svg:text")
      .attr("fill", "black")
      .attr("x", 0)
      .attr("y", this.radius + 20)
      .attr("text-anchor", "middle")
      .text(this.name);

    this.group = d3
      .create("svg:g")
      .attr("transform", `translate(${position.x}, ${position.y})`);

    this.group.node().appendChild(this.circle.node());
    this.group.node().appendChild(this.increaseButton.node());
    this.group.node().appendChild(this.decreaseButton.node());
    this.group.node().appendChild(this.unitLabel.node());
    this.group.node().appendChild(this.nameLabel.node());

    // Optional, add ticks marker to the static group
    this.group.node().appendChild(this.createTicks());

    // Rotating element
    this.line = d3
      .create("svg:line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", this.radius)
      .attr("y2", 0)
      .attr("stroke", "black")
      .attr("stroke-width", 3);

    this.dynamicGroup = d3.create("svg:g");
    this.dynamicGroup.node().appendChild(this.line.node());
    this.group.node().appendChild(this.dynamicGroup.node());

    // Initialize the dial to current value
    this.setValue(this.value);
  }

  #createControlButtons(buttonWidth, buttonHeight) {
    this.decreaseButton = createSvgButton(buttonWidth, buttonHeight, "◀");
    this.increaseButton = createSvgButton(buttonWidth, buttonHeight, "▶");

    const decreaseCb = () => {
      const nextValue = this.value - this.incrementStep;
      if (nextValue >= this.min) {
        this.setValue(nextValue);
      }
    };

    const increaseCb = () => {
      const nextValue = this.value + this.incrementStep;
      if (nextValue <= this.max) {
        this.setValue(nextValue);
      }
    };

    [
      { button: this.decreaseButton, cb: decreaseCb },
      { button: this.increaseButton, cb: increaseCb },
    ].forEach((b) => {
      let intervalId = null;
      b.button.on("click", b.cb);

      b.button.on("mousedown", () => {
        if (!intervalId) {
          intervalId = setInterval(b.cb, 50);
        }
      });
      b.button.on("mouseup", () => {
        clearInterval(intervalId);
        intervalId = null;
      });
      b.button.on("mouseleave", () => {
        clearInterval(intervalId);
        intervalId = null;
      });
    });
  }

  hideControls() {
    this.increaseButton.attr("visibility", "hidden");
    this.decreaseButton.attr("visibility", "hidden");
  }

  /**
   *
   * @param {Number} value given in the unit specified in constructor in [unit.min, unit.max]
   */
  setValue(value) {
    this.value = value;
    const curAngleDeg = this.valueToAngleDeg(value);
    this.dynamicGroup.attr("transform", `rotate(${curAngleDeg})`);
    this.unitLabel.text(`${value.toFixed(this.nbDecimalToDisplay)}`);

    // apply the user provided control functions
    this.controlFunc(this.value);
  }

  createTicks() {
    const nbValues = 20.0;
    const intensityTicks = Array.from(
      { length: nbValues },
      (e, i) => i / nbValues
    );
    const intensityTicksCoords = intensityTicks.map((intensity) => {
      const angleRad = util.degToRad(
        this.valueToAngleDeg(this.unitToNormValue.invert(intensity))
      );
      const r1 = this.radius + 3;
      const r2 = this.radius + 5;
      return {
        x1: r1 * Math.cos(angleRad),
        x2: r2 * Math.cos(angleRad),
        y1: r1 * Math.sin(angleRad),
        y2: r2 * Math.sin(angleRad),
      };
    });

    const ticks = d3.create("svg:g");
    ticks
      .selectAll("tick-markers")
      .data(intensityTicksCoords)
      .enter()
      .append("svg:line")
      .attr("x1", (d) => d.x1)
      .attr("x2", (d) => d.x2)
      .attr("y1", (d) => d.y1)
      .attr("y2", (d) => d.y2)
      .attr("stroke", "black");

    return ticks.node();
  }

  transitionTo(states) {
    const duration = 1000;
    const animate = (stateIdx) => {
      if (stateIdx >= states.length) return;
      const newIntensity = states[stateIdx].intensity;
      this.dynamicGroup
        .transition()
        .duration(duration)
        .attrTween("transform", () => {
          const interpolate = d3.interpolateNumber(
            this.normValue,
            newIntensity
          );

          return (t) => {
            const interpolatedIntensity = interpolate(t);
            const curUnit = this.normValueToUnit(interpolatedIntensity);
            this.unitLabel.text(curUnit.toFixed(0));
            return `rotate(${this.normValueToAngleDeg(interpolatedIntensity)})`;
          };
        })
        .on("end", () => {
          this.normValue = newIntensity;
          animate(stateIdx + 1);
        });
    };
    animate(0);
  }

  getNode() {
    return this.group.node();
  }
}

function createSpotLight(color) {
  const spotLightSvg = `<svg xmlns="http://www.w3.org/2000/svg" style="background: transparent; background-color: transparent; color-scheme: light;" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="120px" height="120px" viewBox="-0.5 -0.5 120 120"><defs/><g><g data-cell-id="0"><g data-cell-id="1"><g data-cell-id="tixh68NpkHl_DsJVLdB--2"><g><path d="M 0 0 L 120 60 L 0 120 Z" fill="#0000ff" stroke="none" pointer-events="all" style="fill: rgb(0, 0, 255);"/></g></g><g data-cell-id="tixh68NpkHl_DsJVLdB--1"><g><rect x="40" y="20" width="80" height="80" fill="#0000ff" stroke="none" pointer-events="all" style="fill: rgb(0, 0, 255);"/></g></g></g></g></g></svg>`;
  const group = d3.create("svg:g");
  const parser = new DOMParser();
  const doc = parser.parseFromString(spotLightSvg, "image/svg+xml");
  Array.from(doc.documentElement.children).forEach((el) =>
    group.node().appendChild(el)
  );

  group.attr("transform", `rotate(180) translate(0, -60)`);
  group.selectAll("rect").style("fill", color).attr("stroke", "black");
  group.selectAll("path").style("fill", color).attr("stroke", "black");

  return group;
}

function createEyeAndWall() {
  const eyeSvg = `
  <svg width="800px" height="800px" fill="none" xmlns="http://www.w3.org/2000/svg">
<path fill-rule="evenodd" clip-rule="evenodd" d="M11.9944 15.5C13.9274 15.5 15.4944 13.933 15.4944 12C15.4944 10.067 13.9274 8.5 11.9944 8.5C10.0614 8.5 8.49439 10.067 8.49439 12C8.49439 13.933 10.0614 15.5 11.9944 15.5ZM11.9944 13.4944C11.1691 13.4944 10.5 12.8253 10.5 12C10.5 11.1747 11.1691 10.5056 11.9944 10.5056C12.8197 10.5056 13.4888 11.1747 13.4888 12C13.4888 12.8253 12.8197 13.4944 11.9944 13.4944Z" fill="#0F0F0F"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M12 5C7.18879 5 3.9167 7.60905 2.1893 9.47978C0.857392 10.9222 0.857393 13.0778 2.1893 14.5202C3.9167 16.391 7.18879 19 12 19C16.8112 19 20.0833 16.391 21.8107 14.5202C23.1426 13.0778 23.1426 10.9222 21.8107 9.47978C20.0833 7.60905 16.8112 5 12 5ZM3.65868 10.8366C5.18832 9.18002 7.9669 7 12 7C16.0331 7 18.8117 9.18002 20.3413 10.8366C20.9657 11.5128 20.9657 12.4872 20.3413 13.1634C18.8117 14.82 16.0331 17 12 17C7.9669 17 5.18832 14.82 3.65868 13.1634C3.03426 12.4872 3.03426 11.5128 3.65868 10.8366Z" fill="#0F0F0F"/>
</svg>
  `;

  const group = d3.create("svg:g");
  const parser = new DOMParser();
  const doc = parser.parseFromString(eyeSvg, "image/svg+xml");
  Array.from(doc.documentElement.children).forEach((el) =>
    group.node().appendChild(el)
  );

  //TODO: Add two bar as the wall
  group
    .append("line")
    .attr("x1", 16)
    .attr("x2", 100)
    .attr("y1", 0)
    .attr("y2", 0)
    .attr("stroke", "black");
  group
    .append("line")
    .attr("x1", 8)
    .attr("x2", -76)
    .attr("y1", 0)
    .attr("y2", 0)
    .attr("stroke", "black");

  group.attr("transform", `scale(2) translate(-12, -12)`);
  return group;
}

class Light {
  constructor({
    position = { x: 0, y: 0 },
    orientationDeg = 0.0,
    color = d3.rgb(0, 0, 0),
  }) {
    this.normValue = 0.0;
    this.position = position;
    this.orientation = orientationDeg;
    this.color = color;
    this.rayLength = 100;
    this.maxRayWidth = 50;

    this.normValueToRayWidth = d3
      .scaleLinear()
      .domain([0.0, 1.0])
      .range([0.0, this.maxRayWidth]);

    this.rectangle = d3
      .create("svg:rect")
      .attr("x", 0)
      .attr("y", -this.maxRayWidth / 2.0)
      .attr("width", this.rayLength)
      .attr("height", this.maxRayWidth)
      .attr("fill", color);

    this.spotLight = d3.create("svg:g");
    this.spotLight.node().appendChild(createSpotLight(color).node());
    this.spotLight.attr("transform", `scale(0.4)`);
    d3.create("svg:g");

    this.group = d3
      .create("svg:g")
      .attr(
        "transform",
        `translate(${position.x}, ${[position.y]}) rotate(${orientationDeg})`
      );

    this.group.node().appendChild(this.rectangle.node());
    this.group.node().appendChild(this.spotLight.node());

    // Initialize RayWidth
    this.setNormalizedValue(0.0);
  }

  setColor(d3color) {
    this.rectangle.attr("fill", d3color);
  }

  setSpotLightColor(d3color) {
    this.spotLight.selectAll("rect").style("fill", d3color);
    this.spotLight.selectAll("path").style("fill", d3color);
  }

  setNormalizedValue(value) {
    this.normValue = value;
    const rayWidth = this.normValueToRayWidth(value);
    this.rectangle.attr("y", -rayWidth / 2.0).attr("height", rayWidth);
  }

  transitionTo(states) {
    const duration = 1000;
    const animate = (index) => {
      if (index >= states.length) return;
      const updatedWidth = this.normValueToRayWidth(states[index].intensity);
      this.rectangle
        .transition()
        .duration(duration)
        .attr("height", updatedWidth)
        .attr("y", -updatedWidth / 2.0)
        .on("end", () => animate(index + 1));
    };
    animate(0);
  }

  setVisibility(isVisible) {
    isVisible
      ? this.group.attr("opacity", 1.0)
      : this.group.attr("opacity", 0.0);
  }

  getNode() {
    return this.group.node();
  }
}

class LightProjection {
  constructor({ position, orientationDeg, color }) {
    this.radius = 40;
    const arcGenerator = d3
      .arc()
      .innerRadius(0)
      .outerRadius(this.radius)
      .startAngle(0)
      .endAngle(Math.PI);

    this.arc = d3
      .create("svg:path")
      .attr("d", arcGenerator)
      .attr(
        "transform",
        `translate(${position.x}, ${position.y}) rotate(${orientationDeg})`
      )
      .attr("fill", color)
      .attr("stroke", "black");
  }

  setColor(d3color) {
    this.arc.attr("fill", d3color);
  }

  transitionTo(states) {
    const duration = 1000;
    const animate = (index) => {
      if (index >= states.length) return;
      this.arc
        .transition()
        .duration(duration)
        .attr("fill", states[index].color)
        .on("end", () => animate(index + 1));
    };
    animate(0);
  }

  getNode() {
    return this.arc.node();
  }
}

/**
 * Change primaries in some predefined order to show that we are trying to match
 * the white reference. The last positions should correspond to the calibrated values.
 */
function animateCalibration({ primaries, projections, dials }) {
  const refWhiteRatio = { r: 0.6, g: 0.3, b: 0.9 };

  const redStates = [
    { intensity: 0.2 },
    { intensity: 0.7 },
    { intensity: 0.9 },
    { intensity: 0.6 },
    { intensity: refWhiteRatio.r },
  ];

  const greenStates = [
    { intensity: 0.7 },
    { intensity: 0.3 },
    { intensity: 0.4 },
    { intensity: 0.1 },
    { intensity: refWhiteRatio.g },
  ];

  const blueStates = [
    { intensity: 0.3 },
    { intensity: 0.1 },
    { intensity: 0.4 },
    { intensity: 0.9 },
    { intensity: refWhiteRatio.b },
  ];

  const mixColor = redStates.map((rI, i) => {
    const gI = greenStates[i].intensity;
    const bI = blueStates[i].intensity;
    const rgbColor = d3.rgb(0, 0, 0);
    rgbColor.r = (255 / refWhiteRatio.r) * rI.intensity;
    rgbColor.g = (255 / refWhiteRatio.g) * gI;
    rgbColor.b = (255 / refWhiteRatio.b) * bI;
    return { color: rgbColor };
  });

  primaries.r.transitionTo(redStates);
  primaries.g.transitionTo(greenStates);
  primaries.b.transitionTo(blueStates);

  dials.r.transitionTo(redStates);
  dials.g.transitionTo(greenStates);
  dials.b.transitionTo(blueStates);

  projections.mix.transitionTo(mixColor);
}

function getChromCoefEquation(Ri = 0, Gi = 0, Bi = 0) {
  const RpGpB = Ri + Gi + Bi;
  const ri = RpGpB == 0 ? 0 : Ri / RpGpB;
  const gi = RpGpB == 0 ? 0 : Gi / RpGpB;
  const bi = RpGpB == 0 ? 0 : Bi / RpGpB;

  const [R, G, B] = [Ri, Gi, Bi].map((e) => e.toFixed(2));
  const [r, g, b] = [ri, gi, bi].map((e) => e.toFixed(4));

  const equation = `$$
  \\begin{array}{}
  r(\\lambda) = \\frac{R(\\lambda)}{R(\\lambda)+G(\\lambda)+B(\\lambda)} =& \\frac{${R}}{${R}+${G}+${B}} &=& {\\color{red}${r}} \\\\
  g(\\lambda) = \\frac{G(\\lambda)}{R(\\lambda)+G(\\lambda)+B(\\lambda)} =& \\frac{${G}}{${R}+${G}+${B}} &=& {\\color{green}${g}} \\\\
  b(\\lambda) = \\frac{B(\\lambda)}{R(\\lambda)+G(\\lambda)+B(\\lambda)} =& \\frac{${B}}{${R}+${G}+${B}} &=& {\\color{blue}${b}} \\\\
  \\end{array}
  $$
  `;

  return equation;
}

function getUnitPrimEquation(
  Rp = 0,
  Gp = 0,
  Bp = 0,
  CalibratedValue = { R: 1, G: 1, B: 1 }
) {
  const R = Rp / CalibratedValue.R;
  const G = Gp / CalibratedValue.G;
  const B = Bp / CalibratedValue.B;

  const equation = `$$
   \\begin{array}{}
  R(\\lambda) = \\frac{R_p(\\lambda)}{R_c} =& \\frac{${Rp.toFixed(
    2
  )}}{${CalibratedValue.R.toFixed(2)}} &=& ${R.toFixed(2)} \\\\
  G(\\lambda) = \\frac{G_p(\\lambda)}{G_c} =& \\frac{${Gp.toFixed(
    2
  )}}{${CalibratedValue.G.toFixed(2)}} &=& ${G.toFixed(2)} \\\\
  B(\\lambda) = \\frac{B_p(\\lambda)}{B_c} =& \\frac{${Bp.toFixed(
    2
  )}}{${CalibratedValue.B.toFixed(2)}} &=& ${B.toFixed(2)} \\\\
  \\end{array}
  $$`;

  return equation;
}

function createChromCoefGraph2d() {
  const chromCoefGraphDiv = document.createElement("div");

  const [lambdas, rCoefs, gCoefs, bCoefs] =
    util.unzipArrayOfObject(chromCoefRawData);

  const rChromCoefTrace = {
    type: "scatter",
    mode: "lines",
    x: lambdas,
    y: rCoefs,
    name: "r",
    line: { color: "red" },
  };

  const gChromCoefTrace = {
    type: "scatter",
    mode: "lines",
    x: lambdas,
    y: gCoefs,
    name: "g",
    line: { color: "green" },
  };

  const bChromCoefTrace = {
    type: "scatter",
    mode: "lines",
    x: lambdas,
    y: bCoefs,
    name: "b",
    line: { color: "blue" },
  };

  const layout = {
    hovermode: "x",
    xaxis: { title: "λ" },
    yaxis: { title: "Chromaticity Coefficient" },
  };

  Plotly.newPlot(
    chromCoefGraphDiv,
    [rChromCoefTrace, gChromCoefTrace, bChromCoefTrace],
    layout
  );

  return chromCoefGraphDiv;
}

function createCalibButton(rDial, gDial, bDial, position = { x: 0, y: 0 }) {
  const group = d3.create("svg:g");
  const calibButtonSelection = createSvgButton(100, 20, "Calibrate");
  calibButtonSelection.attr(
    "transform",
    `translate(${position.x}, ${position.y})`
  );
  calibButtonSelection
    .select("rect")
    .style("fill", "lightgrey")
    .style("stroke", "black")
    .style("rx", 2)
    .style("ry", 2);

  const calibText = d3
    .create("svg:foreignObject")
    .attr("x", position.x)
    .attr("y", position.y + 20)
    .attr("width", 100)
    .attr("height", 100)
    .style("font-size", "75%");

  calibButtonSelection.on("click", () => {
    const Rc = rDial.value;
    const Gc = gDial.value;
    const Bc = bDial.value;

    const equation = String.raw`$$
    \begin{align}
    R_c = ${Rc} \\
    G_c = ${Gc} \\
    B_c = ${Bc}
    \end{align}
    $$`;

    //calibText.text(equation);
    calibText.html(equation);
    MathJax.typeset();
    calibText.style("visibility", "visible");
  });

  group.node().append(calibButtonSelection.node(), calibText.node());
  return group.node();
}

function createCMCalibration() {
  // I want to create a scene where I can place object wherever I want
  const sceneWidth = 600;
  const sceneHeight = 400;
  const scene = new Scene(sceneWidth, sceneHeight);
  const sceneCenter = { x: sceneWidth / 2.0, y: sceneHeight / 2.0 };
  const projectionPos = { x: 0.3 * sceneWidth, y: 0.5 * sceneHeight };

  // Place the primaries around the center at -45, 0, 45 degrees at distance d
  const distanceFromCenter = 120;
  const rPosition = util.addCoordinates(projectionPos, {
    x: distanceFromCenter * Math.cos(util.degToRad(-45)),
    y: distanceFromCenter * Math.sin(util.degToRad(-45)),
  });

  const gPosition = util.addCoordinates(projectionPos, {
    x: distanceFromCenter * Math.cos(util.degToRad(0)),
    y: distanceFromCenter * Math.sin(util.degToRad(0)),
  });

  const bPosition = util.addCoordinates(projectionPos, {
    x: distanceFromCenter * Math.cos(util.degToRad(45)),
    y: distanceFromCenter * Math.sin(util.degToRad(45)),
  });

  const wPosition = util.addCoordinates(projectionPos, {
    x: distanceFromCenter * Math.cos(util.degToRad(135)),
    y: distanceFromCenter * Math.sin(util.degToRad(135)),
  });

  const rPrimary = new Light({
    position: rPosition,
    orientationDeg: 135,
    color: d3.rgb(255, 0, 0),
  });
  const gPrimary = new Light({
    position: gPosition,
    orientationDeg: 180,
    color: d3.rgb(0, 255, 0),
  });
  const bPrimary = new Light({
    position: bPosition,
    orientationDeg: 225,
    color: d3.rgb(0, 0, 255),
  });
  const whiteReference = new Light({
    position: wPosition,
    orientationDeg: -45,
    color: d3.rgb(255, 255, 240),
  });
  whiteReference.setNormalizedValue(0.5);

  const testProjection = new LightProjection({
    position: projectionPos,
    orientationDeg: 180.0,
    color: whiteReference.color,
  });

  const mixProjection = new LightProjection({
    position: projectionPos,
    orientationDeg: 0.0,
    color: d3.rgb(0, 0, 0),
  });

  const yPosPrimaryDial = 0.5 * sceneHeight;
  const xPosPrimaryDial = 0.6 * sceneWidth;
  const rDial = new Dial({
    position: { x: 50 + xPosPrimaryDial, y: yPosPrimaryDial },
    color: d3.rgb(255, 0, 0),
    unit: { min: 0.0, max: 100.0 },
    name: `Rp [W]`,
  });

  const gDial = new Dial({
    position: { x: 120 + xPosPrimaryDial, y: yPosPrimaryDial },
    color: d3.rgb(0, 255, 0),
    unit: { min: 0.0, max: 100.0 },
    name: "Gp [W]",
  });
  const bDial = new Dial({
    position: { x: 190 + xPosPrimaryDial, y: yPosPrimaryDial },
    color: d3.rgb(0, 0, 255),
    unit: { min: 0.0, max: 100.0 },
    name: "Bp [W]",
  });

  const refWhiteValue = { r: 60, g: 30, b: 90 };
  const refWhiteRatio = {
    r: refWhiteValue.r / rDial.max,
    g: refWhiteValue.g / gDial.max,
    b: refWhiteValue.b / bDial.max,
  };

  // Connect Dial to Light
  const updateMixProjection = () => {
    const rgbColor = d3.rgb();
    rgbColor.r =
      (whiteReference.color.r / refWhiteRatio.r) * rPrimary.normValue;
    rgbColor.g =
      (whiteReference.color.g / refWhiteRatio.g) * gPrimary.normValue;
    rgbColor.b =
      (whiteReference.color.b / refWhiteRatio.b) * bPrimary.normValue;
    mixProjection.setColor(rgbColor);
  };

  rDial.controlFunc = (value) => {
    rPrimary.setNormalizedValue(rDial.unitToNormValue(value));
    updateMixProjection();
  };
  gDial.controlFunc = (value) => {
    gPrimary.setNormalizedValue(gDial.unitToNormValue(value));
    updateMixProjection();
  };
  bDial.controlFunc = (value) => {
    bPrimary.setNormalizedValue(bDial.unitToNormValue(value));
    updateMixProjection();
  };

  // Add decoration
  const eyeAndWallIcons = d3.create("svg:g");
  eyeAndWallIcons.node().appendChild(createEyeAndWall().node());
  eyeAndWallIcons.attr(
    "transform",
    `translate(${projectionPos.x}, ${0.9 * scene.height})`
  );

  const calibButton = createCalibButton(rDial, gDial, bDial, {
    x: 0.7 * sceneWidth,
    y: 0.7 * sceneHeight,
  });

  scene.add(rPrimary.getNode());
  scene.add(gPrimary.getNode());
  scene.add(bPrimary.getNode());
  scene.add(whiteReference.getNode());
  scene.add(testProjection.getNode());
  scene.add(mixProjection.getNode());
  scene.add(rDial.getNode());
  scene.add(gDial.getNode());
  scene.add(bDial.getNode());
  scene.add(eyeAndWallIcons.node());
  scene.add(calibButton);

  //// Add button for calibration
  //addCalibButton(scene.getDiv(), rDial, gDial, bDial, {
  //  x: 0.7 * sceneWidth,
  //  y: 0.7 * sceneHeight,
  //});

  // Add animation by setting timestamp and fixed values
  //animateCalibration({
  //  primaries: { r: rPrimary, g: gPrimary, b: bPrimary },
  //  projections: { test: testProjection, mix: mixProjection },
  //  dials: { r: rDial, g: gDial, b: bDial },
  //});

  return scene.getDiv();
}

function createCMExp() {
  // I want to create a scene where I can place object wherever I want
  const scene = new Scene(SCENE_WIDTH, SCENE_HEIGHT);
  const sceneCenter = { x: SCENE_WIDTH / 2.0, y: SCENE_HEIGHT / 2.0 };
  const projectionPos = { x: 0.45 * SCENE_WIDTH, y: 0.5 * SCENE_HEIGHT };

  // Place the primaries around the center at -45, 0, 45 degrees at distance d
  const distanceFromCenter = 120;
  const rPosition = util.addCoordinates(projectionPos, {
    x: distanceFromCenter * Math.cos(util.degToRad(-45)),
    y: distanceFromCenter * Math.sin(util.degToRad(-45)),
  });

  const gPosition = util.addCoordinates(projectionPos, {
    x: distanceFromCenter * Math.cos(util.degToRad(0)),
    y: distanceFromCenter * Math.sin(util.degToRad(0)),
  });

  const bPosition = util.addCoordinates(projectionPos, {
    x: distanceFromCenter * Math.cos(util.degToRad(45)),
    y: distanceFromCenter * Math.sin(util.degToRad(45)),
  });

  const wPosition = util.addCoordinates(projectionPos, {
    x: distanceFromCenter * Math.cos(util.degToRad(135)),
    y: distanceFromCenter * Math.sin(util.degToRad(135)),
  });

  const negativePrimaryPosition = util.addCoordinates(projectionPos, {
    x: distanceFromCenter * Math.cos(util.degToRad(180)),
    y: distanceFromCenter * Math.sin(util.degToRad(180)),
  });

  const rPrimary = new Light({
    position: rPosition,
    orientationDeg: 135,
    color: d3.rgb(255, 0, 0),
  });

  const gPrimary = new Light({
    position: gPosition,
    orientationDeg: 180,
    color: d3.rgb(0, 255, 0),
  });
  const bPrimary = new Light({
    position: bPosition,
    orientationDeg: 225,
    color: d3.rgb(0, 0, 255),
  });
  const testLight = new Light({
    position: wPosition,
    orientationDeg: -45,
    color: d3.rgb(222, 222, 222),
  });
  testLight.setNormalizedValue(0.5);
  testLight.setColor(SCENE_BGND);
  const negativePrimary = new Light({
    position: negativePrimaryPosition,
    orientationDeg: 0,
    color: d3.rgb(255, 0, 0),
  });
  negativePrimary.setVisibility(false);

  const testProjection = new LightProjection({
    position: projectionPos,
    orientationDeg: 180.0,
    color: d3.rgb(255, 255, 255),
  });

  const mixProjection = new LightProjection({
    position: projectionPos,
    orientationDeg: 0.0,
    color: d3.rgb(0, 0, 0),
  });

  const yPosPrimaryDial = 200;
  const xPosPrimaryDial = SCENE_WIDTH * 0.7;
  const rDial = new Dial({
    position: { x: 50 + xPosPrimaryDial, y: yPosPrimaryDial },
    color: d3.rgb(255, 0, 0),
    unit: { min: 0.0, max: 100.0 },
    name: `Rp [W]`,
  });
  rDial.hideControls();

  const gDial = new Dial({
    position: { x: 120 + xPosPrimaryDial, y: yPosPrimaryDial },
    color: d3.rgb(0, 255, 0),
    unit: { min: 0.0, max: 100.0 },
    name: "Gp [W]",
  });
  gDial.hideControls();

  const bDial = new Dial({
    position: { x: 190 + xPosPrimaryDial, y: yPosPrimaryDial },
    color: d3.rgb(0, 0, 255),
    unit: { min: 0.0, max: 100.0 },
    name: "Bp [W]",
  });
  bDial.hideControls();

  const calibratedValue = { R: 60, G: 30, B: 90 };

  const testLightDial = new Dial({
    position: { x: SCENE_WIDTH / 8.0, y: yPosPrimaryDial },
    color: d3.rgb(222, 222, 222),
    unit: { min: 300.0, max: 800.0 },
    name: "λ [nm]",
  });
  testLightDial.hideControls();

  const eyeAndWallIcons = d3.create("svg:g");
  eyeAndWallIcons.node().appendChild(createEyeAndWall().node());
  eyeAndWallIcons.attr(
    "transform",
    `translate(${projectionPos.x}, ${0.9 * scene.height})`
  );

  scene.add(rPrimary.getNode());
  scene.add(gPrimary.getNode());
  scene.add(bPrimary.getNode());
  scene.add(testLight.getNode());
  scene.add(negativePrimary.getNode());
  scene.add(testProjection.getNode());
  scene.add(mixProjection.getNode());
  scene.add(rDial.getNode());
  scene.add(gDial.getNode());
  scene.add(bDial.getNode());
  scene.add(testLightDial.getNode());
  scene.add(eyeAndWallIcons.node());

  // Create the 2d graph of the chromaticity coefficients
  const chromCoefGraphDiv = createChromCoefGraph2d();

  // Create div to contains the chromaticity coefficients equations
  const eqChromCoefDiv = d3.create("div");
  eqChromCoefDiv.append("h3").text("Chromaticity Coefficients");
  const eqChromCoefEquation = eqChromCoefDiv
    .append("div")
    .attr("id", "tex-equation-cc");
  eqChromCoefEquation.html(getChromCoefEquation(0, 0, 0));

  const eqUnitPrimaryDiv = d3.create("div");
  eqUnitPrimaryDiv.append("h3").text("Unit of Primaries");
  const eqUnitPrimaryEquation = eqUnitPrimaryDiv
    .append("div")
    .attr("id", "tex-equation-up");
  eqUnitPrimaryEquation.html(getUnitPrimEquation(0, 0, 0));

  const eqDiv = document.createElement("div");
  eqDiv.appendChild(eqUnitPrimaryDiv.node());
  eqDiv.appendChild(eqChromCoefDiv.node());
  eqDiv.style.display = "flex";
  eqDiv.style.gap = "50px";
  eqDiv.style.fontSize = "75%";

  // Synchronize every element according to the hovered element in the graph
  chromCoefGraphDiv.on("plotly_hover", function (data) {
    const lambda = data.points[0].x;
    let r, g, b;
    data.points.forEach((pt) => {
      switch (pt.curveNumber) {
        case 0:
          r = pt.y;
          break;
        case 1:
          g = pt.y;
          break;
        case 2:
          b = pt.y;
          break;
      }
    });
    updateElementsWithChromCoef(lambda, r, g, b);
  });

  function updateElementsWithChromCoef(lambda, r, g, b) {
    const LinearRGB = util.cvtWavelengthToLinearRGB(lambda);

    const spectralColorDisplayRgb = util.cvtRGBtoD3rgb(
      util.cvtLinearRGBtoRGB(LinearRGB)
    );

    // Change test light
    testLight.setColor(spectralColorDisplayRgb);
    testLightDial.setValue(lambda);

    // Change amount of primaries
    // I could have used any factor here for R+G+B but I used the one
    // from the RGB CMF because we could say that it matches a monochromatic test ligh of 1 watt
    const Lr = 1.0;
    const Lg = 4.5907;
    const Lb = 0.0601;
    const curLuminance = Lr * r + Lg * g + Lb * b;
    const k = lambdaToVMap.get(lambda) / curLuminance;
    const R = k * r;
    const G = k * g;
    const B = k * b;

    const RinUnit = R * calibratedValue.R;
    const GinUnit = G * calibratedValue.G;
    const BinUnit = B * calibratedValue.B;
    rDial.setValue(RinUnit);
    gDial.setValue(GinUnit);
    bDial.setValue(BinUnit);

    const rNormValue = rDial.unitToNormValue(RinUnit);
    const gNormValue = gDial.unitToNormValue(GinUnit);
    const bNormValue = bDial.unitToNormValue(BinUnit);
    if (R < 0 || G < 0 || B < 0) {
      const curNegPrim =
        R < 0
          ? { c: d3.rgb(255, 0, 0), v: rNormValue }
          : G < 0
          ? { c: d3.rgb(0, 255, 0), v: gNormValue }
          : { c: d3.rgb(0, 0, 255), v: bNormValue };
      negativePrimary.setColor(curNegPrim.c);
      negativePrimary.setSpotLightColor(curNegPrim.c);

      negativePrimary.setVisibility(true);
      negativePrimary.setNormalizedValue(-curNegPrim.v);
      // this amount need to be removed from the test projection
    } else {
      negativePrimary.setVisibility(false);
    }
    rPrimary.setNormalizedValue(R >= 0 ? rNormValue : 0.0);
    gPrimary.setNormalizedValue(G >= 0 ? gNormValue : 0.0);
    bPrimary.setNormalizedValue(B >= 0 ? bNormValue : 0.0);

    // Negative value will be clamped to 0
    const displayRGBcolorProjection = util.cvtRGBtoD3rgb(
      util.cvtLinearRGBtoRGB({ R: R, G: G, B: B })
    );
    mixProjection.setColor(displayRGBcolorProjection);
    testProjection.setColor(displayRGBcolorProjection);

    // Update the equation
    eqChromCoefEquation.html(getChromCoefEquation(R, G, B));
    eqUnitPrimaryEquation.html(
      getUnitPrimEquation(RinUnit, GinUnit, BinUnit, calibratedValue)
    );

    MathJax.typeset();
  }

  // Return a div containing the scene, graph and equations
  const CMExpDiv = document.createElement("div");
  const sceneAndGraphDiv = d3
    .create("div")
    .style("display", "flex")
    .style("align-items", "center");
  sceneAndGraphDiv.node().appendChild(scene.getDiv());
  sceneAndGraphDiv.node().appendChild(chromCoefGraphDiv);
  CMExpDiv.appendChild(sceneAndGraphDiv.node());
  CMExpDiv.appendChild(eqDiv);

  return CMExpDiv;
}

function main() {
  const cmexpCalibration = createCMCalibration();
  const cmexpDiv = createCMExp();
  d3.select("#anim-cmexp-calibration").node().append(cmexpCalibration);
  d3.select("#anim-cmexp").node().append(cmexpDiv);

  MathJax.typeset();
}

main();
