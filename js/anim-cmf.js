import d3 from "./d3-loader.js";
import * as util from "./util.mjs";

const GRAPH2D_WIDTH = 450;
const GRAPH2D_HEIGHT = 350;

function createChromCoefGraph() {
  const chromCoefGraphDiv = document.createElement("div");
  const [lambdas, rCoefs, gCoefs, bCoefs] = util.unzipArrayOfObject(
    util.rgbChromCoefRawData
  );

  const rChromCoefTrace = {
    type: "scatter",
    mode: "lines",
    x: lambdas,
    y: rCoefs,
    name: "r",
    line: { color: "red" },
    hoverinfo: "x+y",
  };

  const gChromCoefTrace = {
    type: "scatter",
    mode: "lines",
    x: lambdas,
    y: gCoefs,
    name: "g",
    line: { color: "green" },
    hoverinfo: "x+y",
  };

  const bChromCoefTrace = {
    type: "scatter",
    mode: "lines",
    x: lambdas,
    y: bCoefs,
    name: "b",
    line: { color: "blue" },
    hoverinfo: "x+y",
  };

  const layout = {
    hovermode: "x",
    xaxis: { title: "λ" },
    title: "Chromaticity Coefficient",
    width: GRAPH2D_WIDTH,
    height: GRAPH2D_HEIGHT,
  };

  Plotly.newPlot(
    chromCoefGraphDiv,
    [rChromCoefTrace, gChromCoefTrace, bChromCoefTrace],
    layout
  );

  return chromCoefGraphDiv;
}

function createPhotopicGraph(layoutWidth, layoutHeight) {
  const div = document.createElement("div");
  const [rawLambdas, rawVs] = util.unzipArrayOfObject(util.photopicRawData);

  // Only select the same lambdas as in the chromaticity coefficients data
  const selectedIndexes = rawLambdas
    .map((l, i) => {
      return util.rgbChromCoefRawData.find((d) => {
        return d.Wavelength == l;
      }) !== undefined
        ? i
        : -1;
    })
    .filter((index) => index != -1);

  const lambdas = selectedIndexes.map((i) => rawLambdas[i]);
  const vs = selectedIndexes.map((i) => rawVs[i]);

  const vTrace = {
    type: "scatter",
    x: lambdas,
    y: vs,
  };

  const layout = {
    title: "Photopic Luminous Efficiency",
    hovermode: true,
    xaxis: { title: "λ" },
    yaxis: { title: "V(λ)" },
  };
  if(layoutWidth) layout.width=layoutWidth;
  if(layoutHeight) layout.height = layoutHeight;

  Plotly.newPlot(div, [vTrace], layout);

  return div;
}

function createCmfGraph() {
  const div = document.createElement("div");
  const LumCoef = { r: 1.0, g: 4.5907, b: 0.0601 };
  const [lambdas, rCoefs, gCoefs, bCoefs] = util.unzipArrayOfObject(
    util.rgbChromCoefRawData
  );

  const lambdaToVMap = new Map(
    util.photopicRawData.map((e) => [e.Wavelength, e.V])
  );

  // For each chromaticity coefficients available
  const RCmf = new Array(lambdas.length);
  const GCmf = new Array(lambdas.length);
  const BCmf = new Array(lambdas.length);
  for (let i = 0; i < lambdas.length; ++i) {
    const l = lambdas[i];
    const curRgbCoef = { r: rCoefs[i], g: gCoefs[i], b: bCoefs[i] };
    const curLuminance =
      LumCoef.r * curRgbCoef.r +
      LumCoef.g * curRgbCoef.g +
      LumCoef.b * curRgbCoef.b;
    const k = lambdaToVMap.get(l) / curLuminance;
    RCmf[i] = k * curRgbCoef.r;
    GCmf[i] = k * curRgbCoef.g;
    BCmf[i] = k * curRgbCoef.b;
  }

  const RCmfTrace = {
    type: "scatter",
    x: lambdas,
    y: RCmf,
    line: { color: "red" },
    name: `$$ \\bar{r} $$`,
    hoverinfo: "x+y",
  };
  const GCmfTrace = {
    type: "scatter",
    x: lambdas,
    y: GCmf,
    line: { color: "green" },
    name: `$$ \\bar{g} $$`,
    hoverinfo: "x+y",
  };
  const BCmfTrace = {
    type: "scatter",
    x: lambdas,
    y: BCmf,
    line: { color: "blue" },
    name: `$$ \\bar{b} $$`,
    hoverinfo: "x+y",
  };
  const layout = {
    title: "Color Matching Functions",
    xaxis: { title: "λ" },
    yaxis: { title: "Amount of Primary" },
    hovermode: "x",
    width: GRAPH2D_WIDTH,
    height: GRAPH2D_HEIGHT,
  };
  Plotly.newPlot(div, [RCmfTrace, GCmfTrace, BCmfTrace], layout);

  return div;
}

function createCmfEquationContent(r = 0, g = 0, b = 0, v = 0) {
  const LumCoef = { r: 1.0, g: 4.5907, b: 0.0601 };

  const k = v / (LumCoef.r * r + LumCoef.g * g + LumCoef.b * b);
  const equation = `$$ 
  \\begin{array}{}
  k(\\lambda) &=& \\frac{V(\\lambda)}{(L^rr(\\lambda)+L^gg(\\lambda)+L^bb(\\lambda))}\\\\ 
              &=& \\frac{${v}}{${LumCoef.r}\\cdot${r} + ${
    LumCoef.g
  }\\cdot${g} + ${LumCoef.b}\\cdot${b}}=${k} \\\\
  \\end{array}
  $$
  $$
  \\begin{array}{}
  \\bar{r}(\\lambda) = k(\\lambda)r(\\lambda) =& ${k}\\cdot ${r} &=& \\textcolor{red}{${
    k * r
  }}\\\\
  \\bar{g}(\\lambda) = k(\\lambda)g(\\lambda) =& ${k}\\cdot ${g} &=& \\textcolor{green}{${
    k * g
  }}\\\\
  \\bar{b}(\\lambda) = k(\\lambda)b(\\lambda) =& ${k}\\cdot ${b} &=& \\textcolor{blue}{${
    k * b
  }}\\\\
  \\end{array}
   $$`;

  return util.limitDecimal(equation);
}

function createChromCoefToCmfAnimation() {
  const chromCoefGraph = createChromCoefGraph();
  const photopicGraph = createPhotopicGraph(GRAPH2D_WIDTH, GRAPH2D_HEIGHT);
  const CmfGraph = createCmfGraph();
  const equations = d3.create("div").style("text-align", "center");
  equations.style("font-size", "80%");
  equations.append("h3").text("Color Matching Functions Equations");
  const cmfEquations = d3.create("div").html(createCmfEquationContent());
  equations.node().appendChild(cmfEquations.node());

  CmfGraph.on("plotly_hover", function (data) {
    // Display hover info on chromCoefGraph
    const getHoverdPoint = (p) => {
      return { curveNumber: p.curveNumber, pointNumber: p.pointNumber };
    };
    const bHover = getHoverdPoint(data.points[0]);
    const gHover = getHoverdPoint(data.points[1]);
    const rHover = getHoverdPoint(data.points[2]);
    Plotly.Fx.hover(chromCoefGraph, [rHover, gHover, bHover]);

    // Display hover info on photopicGraph
    Plotly.Fx.hover(photopicGraph, [rHover]);

    // Update the equations
    const r = chromCoefGraph.data[0].y[rHover.pointNumber];
    const g = chromCoefGraph.data[1].y[gHover.pointNumber];
    const b = chromCoefGraph.data[2].y[bHover.pointNumber];
    const v = photopicGraph.data[0].y[rHover.pointNumber];
    cmfEquations.html(createCmfEquationContent(r, g, b, v));
    MathJax.typeset();
  });

  const animation = document.createElement("div");
  animation.style.display = "grid";
  animation.style.width = "85%";
  animation.style.margin = "0 auto";
  animation.style.gridTemplateColumns = "repeat(2, 1fr)";
  chromCoefGraph.style.width = "100%";
  photopicGraph.style.width = "100%";
  equations.node().style.width = "100%";
  CmfGraph.style.width = "100%";
  animation.appendChild(chromCoefGraph);
  animation.appendChild(photopicGraph);
  animation.appendChild(equations.node());
  animation.appendChild(CmfGraph);

  return animation;
}

function main() {
  const photopicGraph = createPhotopicGraph();
  d3.select("#photopic-graph").node().append(photopicGraph);
  const chromCoefToCmfAnimation = createChromCoefToCmfAnimation();
  d3.select("#anim-chrom2cmf").node().append(chromCoefToCmfAnimation);

  MathJax.typeset();
}

main();
