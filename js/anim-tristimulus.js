import d3 from "./d3-loader.js"
import * as util from "./util.mjs";

// Preload data
const munsellSpdRawData = await util.loadData(
  "data/munsell_380_780_1_glossy_all.csv"
);
const [CMFData, ,] = await util.createCMFs();

const muller_glossy_max_tristimulus = {
  r: 19.62,
  g: 16.66,
  b: 18.01,
};

/**
 * Updates the spd graph and spdXCmf graph with new ordinate data.
 * @param {Object} spd
 * @param {Object} spd.div - The div containing the spd graph
 * @param {Array<number>} spd.y - The spd ordinates values
 * @param {Object} spdXCmf
 * @param {Object} spdXCmf.div - The div containing the spdXCmf graph
 * @param {Array<number>} spdXCmf.y - The spdXCmf ordinates values
 */
function updateGraphs({ spd, spdXCmf }) {
  Plotly.animate(
    spd.div,
    { data: [{ y: spd.y }] },
    {
      transition: { duration: 1000, easing: "cubic-in-out" },
    }
  );

  Plotly.animate(
    spdXCmf.div,
    { data: [{ y: spdXCmf.r }, { y: spdXCmf.g }, { y: spdXCmf.b }] },
    {
      transition: { duration: 1000, easing: "cubic-in-out" },
    }
  );
}

class Equation {
  constructor(r, g, b) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.highlightColor = { r: "black", g: "black", b: "black" };
    this.tex = String.raw`$$ 
    \begin{array}{}
      R=\int{\Phi(\lambda)\bar{r}(\lambda)d\lambda} = ${this.r} \\
      G=\int{\Phi(\lambda)\bar{g}(\lambda)d\lambda} = ${this.g} \\ 
      B=\int{\Phi(\lambda)\bar{b}(\lambda)d\lambda} = ${this.b}
    \end{array}
    $$`;
  }

  getTex() {
    return String.raw`$$ 
    \begin{array}{}
      \textcolor{${this.highlightColor.r}}{R=\int{\Phi(\lambda)\bar{r}(\lambda)d\lambda} = ${this.r}} \\
      \textcolor{${this.highlightColor.g}}{G=\int{\Phi(\lambda)\bar{g}(\lambda)d\lambda} = ${this.g}} \\ 
      \textcolor{${this.highlightColor.b}}{B=\int{\Phi(\lambda)\bar{b}(\lambda)d\lambda} = ${this.b}}
    \end{array}
    $$`;
  }

  higlightRed() {
    this.removeHighlight();
    this.highlightColor.r = "red";
  }
  higlightGreen() {
    this.removeHighlight();
    this.highlightColor.g = "green";
  }
  higlightBlue() {
    this.removeHighlight();
    this.highlightColor.b = "blue";
  }

  removeHighlight() {
    this.highlightColor.r = "black";
    this.highlightColor.g = "black";
    this.highlightColor.b = "black";
  }
}

function updateEquation(tristimulusData) {
  tristimulusData.equation.r = tristimulusData.r;
  tristimulusData.equation.g = tristimulusData.g;
  tristimulusData.equation.b = tristimulusData.b;
  tristimulusData.div.style.visibility = "hidden";
  tristimulusData.div.innerHTML = util.limitDecimal(
    tristimulusData.equation.getTex()
  );
  MathJax.typesetPromise([tristimulusData.div]).then(() => {
    tristimulusData.div.style.visibility = "visible";
  });
}

function updatePatchColor(tristimulusData) {
  tristimulusData.patch.attr(
    "fill",
    cvtMunsellTristimulusToDisplayRgb(
      tristimulusData.r,
      tristimulusData.g,
      tristimulusData.b
    )
  );
}

/**
 *
 * @param {Array} preCmptedData Array of precomputed data {spdData, spdXCmfData, tristimulusData}
 * @returns Dropdown node
 */
function createSpdSelectionControl(preCmptedData) {
  const spdSelectionControl = d3.create("select");
  preCmptedData.forEach((e) => {
    spdSelectionControl.append("option").text(e.name);
  });

  spdSelectionControl.on("change", function () {
    const { spdData, spdXCmfData, tristimulusData } =
      preCmptedData[this.selectedIndex];
    updateGraphs({ spd: spdData, spdXCmf: spdXCmfData });
    updateEquation(tristimulusData);
    updatePatchColor(tristimulusData);
  });

  return spdSelectionControl.node();
}

function createTristimulusData() {
  return {
    name: "",
    spdData: { x: [], y: [], div: undefined },
    spdXCmfData: { x: [], r: [], g: [], b: [], div: undefined },
    tristimulusData: { r: 0, g: 0, b: 0, div: undefined, equation: undefined },
  };
}

function cmptTristimulusFromSpd() {
  // Select a few spd
  const colorNames = ["BYY8512", "ABB6002", "DPB4012", "BRP6012"];
  // Munsel are given for lambdas in [380, 780], increment of 1

  // Load CMF
  // CMF are given for lambdas in [360, 830], increment of 1.
  // Take only the subset corresponding to the spd values
  const rawCmfR = util.unzipXY(CMFData[0].values);
  const rawCmfG = util.unzipXY(CMFData[1].values);
  const rawCmfB = util.unzipXY(CMFData[2].values);

  // Find common lambdas between spd and CMF
  const lambdasFromSpdData = munsellSpdRawData.map((e) => e.Wavelength);
  const lambdasFromCmfData = rawCmfR.x;
  const lambdasWithIndex = util.intersect(
    lambdasFromCmfData,
    lambdasFromSpdData
  );
  const nbLambdas = lambdasWithIndex.length;
  // Keep only subset of the CMF corresponding to the lambdas found
  const cmf = {
    lambdas: new Array(nbLambdas),
    r: new Array(nbLambdas),
    g: new Array(nbLambdas),
    b: new Array(nbLambdas),
  };
  lambdasWithIndex.forEach((e, i) => {
    cmf.lambdas[i] = e.value;
    cmf.r[i] = rawCmfR.y[e.index1];
    cmf.g[i] = rawCmfG.y[e.index1];
    cmf.b[i] = rawCmfB.y[e.index1];
  });

  const outTristimulusData = Array.from({ length: colorNames.length }, () => {
    return createTristimulusData();
  });

  colorNames.forEach((colorName, spdIdx) => {
    const curSpdYs = new Array(nbLambdas);
    const curSpdXs = new Array(nbLambdas);
    lambdasWithIndex.forEach((e, i) => {
      curSpdXs[i] = munsellSpdRawData[e.index2].Wavelength;
      curSpdYs[i] = munsellSpdRawData[e.index2][colorName];
    });

    const curSpdXCmfR = curSpdYs.map((spdY, i) => spdY * cmf.r[i]);
    const curSpdXCmfG = curSpdYs.map((spdY, i) => spdY * cmf.g[i]);
    const curSpdXCmfB = curSpdYs.map((spdY, i) => spdY * cmf.b[i]);

    const tristimulus = {
      r: util.integralTrapezoid(util.zipXY(cmf.lambdas, curSpdXCmfR)),
      g: util.integralTrapezoid(util.zipXY(cmf.lambdas, curSpdXCmfG)),
      b: util.integralTrapezoid(util.zipXY(cmf.lambdas, curSpdXCmfB)),
    };

    outTristimulusData[spdIdx].name = colorName;
    outTristimulusData[spdIdx].spdData.x = curSpdXs;
    outTristimulusData[spdIdx].spdData.y = curSpdYs;
    outTristimulusData[spdIdx].spdXCmfData.x = curSpdXs;
    outTristimulusData[spdIdx].spdXCmfData.r = curSpdXCmfR;
    outTristimulusData[spdIdx].spdXCmfData.g = curSpdXCmfG;
    outTristimulusData[spdIdx].spdXCmfData.b = curSpdXCmfB;
    outTristimulusData[spdIdx].tristimulusData = tristimulus;
  });

  return outTristimulusData;
}

function createSpdGraph(spdData) {
  const spdTrace = {
    type: "scatter",
    x: spdData.x,
    y: spdData.y,
  };

  const layout = {
    title: "SPD",
    xaxis: { title: "λ" },
    yaxis: { title: "Φ(λ)" },
  };
  const div = document.createElement("div");
  Plotly.newPlot(div, [spdTrace], layout);
  return div;
}

function createCmfGraph() {
  const rawCmfR = util.unzipXY(CMFData[0].values);
  const rawCmfG = util.unzipXY(CMFData[1].values);
  const rawCmfB = util.unzipXY(CMFData[2].values);

  const RCmfTrace = {
    type: "scatter",
    x: rawCmfR.x,
    y: rawCmfR.y,
    line: { color: "red" },
    name: `$$ \\bar{r}(λ) $$`,
    hoverinfo: "x+y",
  };
  const GCmfTrace = {
    type: "scatter",
    x: rawCmfG.x,
    y: rawCmfG.y,
    line: { color: "green" },
    name: `$$ \\bar{g}(λ) $$`,
    hoverinfo: "x+y",
  };
  const BCmfTrace = {
    type: "scatter",
    x: rawCmfB.x,
    y: rawCmfB.y,
    line: { color: "blue" },
    name: `$$ \\bar{b}(λ) $$`,
    hoverinfo: "x+y",
  };
  const layout = {
    title: "Color Matching Functions",
    xaxis: { title: "λ" },
    yaxis: { title: "Amount of Primary" },
  };

  const div = document.createElement("div");
  Plotly.newPlot(div, [RCmfTrace, GCmfTrace, BCmfTrace], layout);

  return div;
}

function createSpdXCmfGraph(spdXCmfData) {
  const RCmfTrace = {
    type: "scatter",
    x: spdXCmfData.x,
    y: spdXCmfData.r,
    line: { color: "red" },
    name: `$$ \\Phi(λ) \\bar{r}(λ) $$`,
    hoverinfo: "x+y",
  };
  const GCmfTrace = {
    type: "scatter",
    x: spdXCmfData.x,
    y: spdXCmfData.g,
    line: { color: "green" },
    name: `$$ \\Phi(λ) \\bar{g}(λ) $$`,
    hoverinfo: "x+y",
  };
  const BCmfTrace = {
    type: "scatter",
    x: spdXCmfData.x,
    y: spdXCmfData.b,
    line: { color: "blue" },
    name: `$$ \\Phi(λ) \\bar{b}(λ) $$`,
    hoverinfo: "x+y",
  };

  const layout = {
    title: "SPD x Color Matching Functions",
    xaxis: { title: "λ" },
    yaxis: { title: "Amount of Primary" },
  };
  const div = document.createElement("div");
  Plotly.newPlot(div, [RCmfTrace, GCmfTrace, BCmfTrace], layout);

  return div;
}

function cvtMunsellTristimulusToDisplayRgb(r, g, b) {
  return d3.rgb(
    (r / muller_glossy_max_tristimulus.r) * 255,
    (g / muller_glossy_max_tristimulus.g) * 255,
    (b / muller_glossy_max_tristimulus.b) * 255
  );
}

function addHoverAnimation(spdXCmfGraph, spdGraph, cmfGraph, equation) {
  const opacity = 0.3;
  const fillColorWithOpacity = [
    `rgba(255, 0, 0, ${opacity})`,
    `rgba(0, 255, 0, ${opacity})`,
    `rgba(0, 0, 255, ${opacity})`,
  ];
  const fillStyle = { fillcolor: [], fill: "none" };
  const resetFillStyle = (style) => {
    style.fillcolor = [
      `rgba(255, 0, 0, 0)`,
      `rgba(0, 255, 0, 0)`,
      `rgba(0, 0, 255, 0)`,
    ];
    style.fill = "none";
  };
  resetFillStyle(fillStyle);

  // Show area under the curve when hovered
  spdXCmfGraph.on("plotly_hover", function (data) {
    const traceIdx = data.points[0].curveNumber;
    resetFillStyle(fillStyle);
    fillStyle.fillcolor[traceIdx] = fillColorWithOpacity[traceIdx];
    fillStyle.fill = "tozeroy";
    Plotly.restyle(spdXCmfGraph, fillStyle);

    // Highlight current color in the equation
    if (equation) {
      [
        equation.obj.higlightRed.bind(equation.obj),
        equation.obj.higlightGreen.bind(equation.obj),
        equation.obj.higlightBlue.bind(equation.obj),
      ][traceIdx]();
      equation.div.innerHTML = util.limitDecimal(equation.obj.getTex());
    }

    // Manually hover on the other graph
    const curHoverPoint = {
      curveNumber: 0,
      pointNumber: data.points[0].pointNumber,
    };
    Plotly.Fx.hover(cmfGraph, [
      {
        curveNumber: data.points[0].curveNumber,
        pointNumber: data.points[0].pointNumber,
      },
    ]);
    Plotly.Fx.hover(spdGraph, [
      { curveNumber: 0, pointNumber: data.points[0].pointNumber },
    ]);
  });

  spdXCmfGraph.on("plotly_unhover", function (data) {
    resetFillStyle(fillStyle);
    equation.obj.removeHighlight();
    equation.div.innerHTML = util.limitDecimal(equation.obj.getTex());
    Plotly.restyle(spdXCmfGraph, fillStyle);
  });
}

function createTristimulusFormSpdAnimation() {
  const preCmptedData = cmptTristimulusFromSpd();
  const spdGraph = createSpdGraph(preCmptedData[0].spdData);
  const cmfGraph = createCmfGraph();
  const spdXCmfGraph = createSpdXCmfGraph(preCmptedData[0].spdXCmfData);
  const equationTex = document.createElement("div");
  const tristEquation = new Equation(
    preCmptedData[0].tristimulusData.r,
    preCmptedData[0].tristimulusData.g,
    preCmptedData[0].tristimulusData.b
  );
  equationTex.innerHTML = util.limitDecimal(tristEquation.getTex());

  const patchColorDiv = d3.create("div");
  const patchColor = patchColorDiv
    .append("svg")
    .append("svg:rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", 50)
    .attr("height", 50)
    .attr(
      "fill",
      cvtMunsellTristimulusToDisplayRgb(
        tristEquation.r,
        tristEquation.g,
        tristEquation.b
      )
    );

  preCmptedData.forEach((p) => {
    p.spdData.div = spdGraph;
    p.spdXCmfData.div = spdXCmfGraph;
    p.tristimulusData.div = equationTex;
    p.tristimulusData.equation = tristEquation;
    p.tristimulusData.patch = patchColor;
  });

  const spdSelection = createSpdSelectionControl(preCmptedData);
  addHoverAnimation(spdXCmfGraph, spdGraph, cmfGraph, {
    obj: tristEquation,
    div: equationTex,
  });

  const animationDiv = document.createElement("div");
  animationDiv.style.display = "grid";
  animationDiv.style.gridTemplateColumns = "repeat(2, 1fr)";
  animationDiv.appendChild(cmfGraph);
  animationDiv.appendChild(spdGraph);
  animationDiv.appendChild(spdXCmfGraph);

  const eqDiv = d3.create("div").style("display","grid").style("justify-content","center");
  eqDiv
    .append("h3")
    .text("Tristimulus Values Equations")
    .style("text-align", "center");
  eqDiv.node().appendChild(equationTex);
  eqDiv.node().appendChild(spdSelection);
  eqDiv.node().appendChild(patchColorDiv.node());
  animationDiv.appendChild(eqDiv.node());

  return animationDiv;
}

function main() {
  const tristimulusAnimation = createTristimulusFormSpdAnimation();
  d3.select("#anim-tristimulus-from-spd").node().append(tristimulusAnimation);
}

main();
