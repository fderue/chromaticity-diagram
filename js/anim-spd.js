import d3 from "./d3-loader.js"
import * as util from "./util.mjs"


const [CMFData, ,] = await util.createCMFs();
const muller_glossy_data = await util.loadData(
  "data/munsell_380_780_1_glossy_all.csv"
);

const illuminantA_data = await util.loadData("data/CIE_std_illum_A_1nm.csv");
const illuminantD50_data = await util.loadData("data/CIE_std_illum_D50.csv");
const illuminantD65_data = await util.loadData("data/CIE_std_illum_D65.csv");
const illuminantNPL_data = await util.loadData("data/NPL.csv");

const muller_glossy_max_tristimulus = {
  R: 19.62,
  G: 16.66,
  B: 18.01,
};

function genGauss(xArray, mu, sigma, magnitude) {
  const twoXsigma2 = 2 * sigma * sigma;
  return xArray.map((x) => {
    return magnitude * Math.exp(-((x - mu) ** 2) / twoXsigma2);
  });
}

/**
 *
 * @returns
 */
function findMullerNormalizedFactor() {
  const muller_data = muller_glossy_data;
  const lambdaArray = new Array(muller_data.length);
  muller_data.forEach((e, i) => {
    lambdaArray[i] = e.Wavelength;
  });
  const rCMF = util.interpolate(CMFData[0].values, lambdaArray);
  const gCMF = util.interpolate(CMFData[1].values, lambdaArray);
  const bCMF = util.interpolate(CMFData[2].values, lambdaArray);

  let RtMax = 0.0;
  let GtMax = 0.0;
  let BtMax = 0.0;

  const powerArray = new Array(muller_data.length);
  for (const color of Object.keys(muller_data[0]).filter(
    (k) => k !== "Wavelength"
  )) {
    muller_data.forEach((e, i) => {
      powerArray[i] = e[color];
    });
    const spdXrCMF = util.multiplyArrays(powerArray, rCMF);
    const spdXgCMF = util.multiplyArrays(powerArray, gCMF);
    const spdXbCMF = util.multiplyArrays(powerArray, bCMF);
    const Rt = util.integralTrapezoid(util.zipXY(lambdaArray, spdXrCMF));
    const Gt = util.integralTrapezoid(util.zipXY(lambdaArray, spdXgCMF));
    const Bt = util.integralTrapezoid(util.zipXY(lambdaArray, spdXbCMF));
    RtMax = Math.max(RtMax, Rt);
    GtMax = Math.max(GtMax, Gt);
    BtMax = Math.max(BtMax, Bt);
  }
  return { R: RtMax, G: GtMax, B: BtMax };
}

function cmptTristimulusRgb(lambdaArray, powerArray, CMF) {
  const rCMF = util.interpolate(CMF.r, lambdaArray);
  const gCMF = util.interpolate(CMF.g, lambdaArray);
  const bCMF = util.interpolate(CMF.b, lambdaArray);
  const spdXrCMF = util.multiplyArrays(powerArray, rCMF);
  const spdXgCMF = util.multiplyArrays(powerArray, gCMF);
  const spdXbCMF = util.multiplyArrays(powerArray, bCMF);
  const Rt = util.integralTrapezoid(util.zipXY(lambdaArray, spdXrCMF));
  const Gt = util.integralTrapezoid(util.zipXY(lambdaArray, spdXgCMF));
  const Bt = util.integralTrapezoid(util.zipXY(lambdaArray, spdXbCMF));

  return { R: Rt, G: Gt, B: Bt };
}

/**
 *
 * @returns
 */
function createSPDyellowDiv() {
  const CMF = {
    r: CMFData[0].values,
    g: CMFData[1].values,
    b: CMFData[2].values,
  };
  const muller_data = muller_glossy_data;
  const rawLambdaArray = new Array(muller_data.length);

  // Muller SPD
  const rawPowerArray = new Array(muller_data.length);
  muller_data.forEach((e, i) => {
    rawLambdaArray[i] = e.Wavelength;
    //rawPowerArray[i] = e["BYY8514"];
    //rawPowerArray[i] = e["BYY8014"];
    //rawPowerArray[i] = e["AYY8016"];
    rawPowerArray[i] = e["BRP6012"];
    //rawPowerArray[i] = e["AYY7010"];
    //rawPowerArray[i] = e["AYY8016"];
    //rawPowerArray[i] = e["CYY8512"];
  });

  const totalPower = rawPowerArray.reduce((sum, v) => sum + v, 0);

  // Take a subset of the data because some can be inaccurate due to noise
  const lambdaArray = rawLambdaArray.slice(0);
  const powerArray = rawPowerArray.slice(0);

  const spdYellowTrace = {
    type: "scatter",
    x: lambdaArray,
    y: powerArray,
  };

  // Monochromatic light SPD
  const mu = 575; // yellow wavelength
  const sigma = 4;
  const magnitude = 8;
  const spdMonoLightTrace = {
    type: "scatter",
    x: lambdaArray,
    y: genGauss(lambdaArray, mu, sigma, magnitude),
    name: "Mono Yellow",
  };
  const tristimulusMonoLight = cmptTristimulusRgb(
    lambdaArray,
    spdMonoLightTrace.y,
    CMF
  );

  // CIE1931 RGB SPD
  // I need as much point in CMF as in the spd to be able to integrate
  const triValues = cmptTristimulusRgb(lambdaArray, powerArray, CMF);
  const [Rt, Gt, Bt] = [triValues.R, triValues.G, triValues.B];
  const maxTrist = muller_glossy_max_tristimulus;
  const [normRt, normGt, normBt] = [
    Rt / maxTrist.R,
    Gt / maxTrist.G,
    Bt / maxTrist.B,
  ];
  const displayRgb = util.cvtLinearRGBtoRGB({
    R: normRt,
    G: normGt,
    B: normBt,
  });

  // Generate a sum of three gaussian
  const lambdaR = 650;
  const lambdaG = 546;
  const lambdaB = 436;
  const rGauss = genGauss(lambdaArray, lambdaR, 10, 6);
  const gGauss = genGauss(lambdaArray, lambdaG, 10, 2.4);
  const bGauss = genGauss(lambdaArray, lambdaB, 20, 0.0);
  const spdTriPrimaries = util.addArrays(rGauss, gGauss, bGauss);

  const tristimulusSpdTriPrim = cmptTristimulusRgb(
    lambdaArray,
    spdTriPrimaries,
    CMF
  );

  //console.log(`SPD1    = ${triValues.R}, ${triValues.G}, ${triValues.B}`);
  //console.log(
  //  `SPDTri  = ${tristimulusSpdTriPrim.R}, ${tristimulusSpdTriPrim.G}, ${tristimulusSpdTriPrim.B}`
  //);
  //console.log(
  //  `SPDMono = ${tristimulusMonoLight.R}, ${tristimulusMonoLight.G}, ${tristimulusMonoLight.B}`
  //);

  const spdTriPrimariesTrace = {
    type: "scatter",
    x: lambdaArray,
    y: spdTriPrimaries,
    name: "Mono Red+Green",
  };

  const layout = {
    title:"SPD of two yellow colors",
    xaxis: { title: "λ" },
    yaxis: { title: "Φ(λ) [W/nm]" },
  };
  const plotDiv = document.createElement("div");
  Plotly.newPlot(plotDiv, [spdMonoLightTrace, spdTriPrimariesTrace], layout);

  return plotDiv;
}

function createSPDstandardIlluminant() {
  const illuminantA_arrays = util.unzipArrayOfObject(illuminantA_data);

  function divByScalar(array, scalar) {
    return array.map((v) => v / scalar);
  }

  const spdIlluminantATrace = {
    type: "scatter",
    x: illuminantA_arrays[0],
    y: divByScalar(illuminantA_arrays[1], Math.max(...illuminantA_arrays[1])),
    name: "A",
  };

  const illuminantD50_arrays = util.unzipArrayOfObject(illuminantD50_data);
  const spdIlluminantD50Trace = {
    type: "scatter",
    x: illuminantD50_arrays[0],
    y: divByScalar(
      illuminantD50_arrays[1],
      Math.max(...illuminantD50_arrays[1])
    ),
    name: "D50",
  };

  const illuminantD65_arrays = util.unzipArrayOfObject(illuminantD65_data);
  const spdIlluminantD65Trace = {
    type: "scatter",
    x: illuminantD65_arrays[0],
    y: divByScalar(
      illuminantD65_arrays[1],
      Math.max(...illuminantD65_arrays[1])
    ),
    name: "D65",
  };

  const illuminantNPL_arrays = util.unzipArrayOfObject(illuminantNPL_data);
  const spdIlluminantNPLTrace = {
    type: "scatter",
    x: illuminantNPL_arrays[0],
    y: divByScalar(
      illuminantNPL_arrays[1],
      Math.max(...illuminantNPL_arrays[1])
    ),
    name: "NPL",
  };

  const spdIlluminantETrace = {
    type: "scatter",
    x: illuminantD65_arrays[0],
    y: new Array(illuminantD65_arrays[0].length).fill(1.0),
    name: "E",
  };

  const layout = {
    title:"Standard Illuminants SPD"
  };
  const div = document.createElement("div");
  Plotly.newPlot(
    div,
    [
      spdIlluminantATrace,
      //spdIlluminantD50Trace,
      spdIlluminantD65Trace,
      spdIlluminantNPLTrace,
      spdIlluminantETrace
    ],
    layout
  );

  return div;
}

function cvtSpdToDisplayRgb(rawLambdaArray, rawPowerArray){
  const CMF = {
    r: CMFData[0].values,
    g: CMFData[1].values,
    b: CMFData[2].values,
  };
  const triValues = cmptTristimulusRgb(rawLambdaArray, rawPowerArray, CMF);
  const [Rt, Gt, Bt] = [triValues.R, triValues.G, triValues.B];
  const maxTrist = muller_glossy_max_tristimulus;
  const [normRt, normGt, normBt] = [
    Rt / maxTrist.R,
    Gt / maxTrist.G,
    Bt / maxTrist.B,
  ];
  const displayRgb = util.cvtLinearRGBtoRGB({
    R: normRt,
    G: normGt,
    B: normBt,
  });

  return d3.rgb(displayRgb.R, displayRgb.G, displayRgb.B);
}

function createSpdExamples(){
  const muller_data = muller_glossy_data;
  const colors = ["BRP6012", "NEUT500", "DBG6008"];

  const spdTraces = [];
  colors.forEach((color)=>{
    const rawLambdaArray = new Array(muller_data.length);
    const rawPowerArray = new Array(muller_data.length);
    muller_data.forEach((e, i) => {
      rawLambdaArray[i] = e.Wavelength;
      rawPowerArray[i] = e[color];
    });

    const spdTrace = {
      type: "scatter",
      x: rawLambdaArray,
      y: rawPowerArray,
      name: color,
      marker:{color:cvtSpdToDisplayRgb(rawLambdaArray, rawPowerArray)}
    };
    spdTraces.push(spdTrace);
  });

  const layout = {
    title:"Spectral Power Distribution (SPD)",
    xaxis: { title: "λ" },
    yaxis: { title: "Φ(λ) [W/nm]" },
  };
  const div = document.createElement("div");
  Plotly.newPlot(div, spdTraces, layout);
  return div;
}

function main() {
  const spdExamples = createSpdExamples();
  d3.select("#anim-spd").node().append(spdExamples);

  const spdYellow = createSPDyellowDiv();
  d3.select("#anim-spd-yellow").node().append(spdYellow);

  const illuminantSPDDiv = createSPDstandardIlluminant();
  d3.select("#anim-spd-illuminant").node().append(illuminantSPDDiv);

}

main();
