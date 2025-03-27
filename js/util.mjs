import d3 from "./d3-loader.js";

// Constants for chart dimensions and margins.
const CHART_WIDTH = 640;
const CHART_HEIGHT = 400;
const MARGIN = { top: 20, right: 20, bottom: 80, left: 80 };

//TODO: use a separate file to load all the data
const RGBperWavelength = await cmpRGBfromXYZ();
const LinearRGBperWavelength = await cmptLinearRGBfromXYZ();
export const xySpectralLocus = await cmpt_xySpectralLocus();
export const rgbChromCoefRawData = await loadData("data/CIE_rgb_coef.csv");
export const photopicRawData = await loadData("data/CIE_sle_photopic.csv");

// Load and preprocess the data.
export async function loadData(url) {
  return d3.csv(url).then(function (data) {
    const headers = Object.keys(data[0]);
    const rawData = data.map((d) => {
      let rowObject = {};
      headers.forEach((h) => {
        rowObject[h] = +d[h];
      });
      return rowObject;
    });

    return rawData;
  });
}

export function formatByGroup(data) {
  const headers = Object.keys(data[0]);
  const curveNames = headers.slice(1);
  const formattedData = curveNames.map((curveName) => {
    return {
      label: curveName,
      values: data.map(function (d) {
        return { x: +d.Wavelength, y: +d[curveName] };
      }),
    };
  });
  return formattedData;
}

// Create scales for the axes.
export function createScales(domainX, domainY) {
  const xScale = d3
    .scaleLinear()
    .domain(domainX)
    .range([MARGIN.left, CHART_WIDTH - MARGIN.right]);

  const yScale = d3
    .scaleLinear()
    .domain(domainY)
    .range([CHART_HEIGHT - MARGIN.bottom, MARGIN.top]);

  return { xScale, yScale };
}

// Create the SVG container.
export function createSvg() {
  return d3
    .create("svg")
    .attr("width", CHART_WIDTH)
    .attr("height", CHART_HEIGHT);
}

// Draw the axes and labels.
export function drawAxes(
  svg,
  xScale,
  yScale,
  xAxisName = "Wavelength λ[nm]",
  yAxisName = "Sensitivity"
) {
  svg
    .append("g")
    .attr("transform", `translate(0,${yScale(0)})`)
    .call(d3.axisBottom(xScale));

  svg
    .append("g")
    .attr(
      "transform",
      `translate(${CHART_WIDTH / 2},${CHART_HEIGHT - MARGIN.bottom + 40})`
    )
    .append("text")
    .attr("fill", "black")
    .style("text-anchor", "middle")
    .text(xAxisName);

  svg
    .append("g")
    .attr("transform", `translate(${MARGIN.left}, 0)`)
    .call(d3.axisLeft(yScale));

  svg
    .append("g")
    .attr("transform", `translate(${MARGIN.left - 40}, ${CHART_HEIGHT / 2})`)
    .append("text")
    .attr("text-anchor", "middle")
    .attr("transform", "rotate(-90)")
    .attr("fill", "black")
    .text(yAxisName);
}

// Create legend.
export function createLegend(svg, labelToColorMap) {
  const legend = svg
    .append("g")
    .attr("transform", `translate(${CHART_WIDTH - 100}, 10)`);

  let i = 0;
  labelToColorMap.domain().forEach((label) => {
    legend
      .append("circle")
      .attr("cx", 0)
      .attr("cy", i * 25)
      .attr("r", 7)
      .style("fill", labelToColorMap(label));

    legend
      .append("text")
      .attr("x", 10)
      .attr("y", i * 25)
      .style("fill", labelToColorMap(label))
      .text(label)
      .style("alignment-baseline", "middle");

    i++;
  });
}

export function plotData(svg, data, lineGenerator, colorMap) {
  return svg
    .selectAll(".curves")
    .data(data)
    .join("path")
    .attr("class", "curves")
    .transition()
    .duration(1000)
    .attr("d", (curve) => lineGenerator(curve.values))
    .attr("stroke", (curve) => colorMap(curve.label))
    .attr("fill", "none");
}

export function plotSingleLine(svg, data, lineGenerator, color) {
  return svg
    .selectAll(`#${data.label}`)
    .data([data.values])
    .join("path")
    .attr("class", "curves")
    .attr("id", data.label)
    .transition()
    .duration(1000)
    .attr("d", lineGenerator)
    .attr("stroke", color)
    .attr("fill", "none")
    .selection();
}

class Tooltip {
  constructor(cssClassName) {
    this.d3Selection = d3.create("div").attr("class", cssClassName);
  }

  update(closestPoint, pagePos) {
    this.d3Selection.transition().duration(50).style("opacity", 1);
    const closestPointCoordinates = Object.keys(closestPoint).map((k) => {
      return `${k}: ${closestPoint[k].toFixed(2)}`;
    });

    const htmlText = closestPointCoordinates.join("</br>");
    this.d3Selection
      .html(htmlText)
      .style("left", `${pagePos.x + 5}px`)
      .style("top", `${pagePos.y}px`);
  }

  remove() {
    this.d3Selection.transition().duration(50).style("opacity", 0);
  }

  node() {
    return this.d3Selection.node();
  }
}

class Marker {
  constructor(svg, xScale, yScale, color) {
    this.d3Selection = svg
      .append("circle")
      .attr("r", 2)
      .style("opacity", 0)
      .style("fill", color);
    this.xScale = xScale;
    this.yScale = yScale;
  }

  update(dataPos) {
    this.d3Selection
      .attr("cx", this.xScale(dataPos.x))
      .attr("cy", this.yScale(dataPos.y))
      .style("opacity", 1);
  }

  remove() {
    this.d3Selection.style("opacity", 0);
  }
}

export function AddInteractiveElements(
  data,
  colorMap,
  xScale,
  yScale,
  svg,
  div
) {
  const tooltip = new Tooltip("tooltip");
  const labels = data.map((d) => d.label);
  const labelTocircleMarkerMap = new Map();
  labels.forEach((l) => {
    labelTocircleMarkerMap.set(l, new Marker(svg, xScale, yScale, colorMap[l]));
  });

  const bisectX = d3.bisector(function (d) {
    return d.x;
  }).left;

  svg.on("mousemove", (event) => {
    const curDataPointX = xScale.invert(d3.pointer(event)[0]);

    const allClosestPoints = {};
    // For each group, find the closest data point
    data.forEach((group) => {
      const idxOfX = bisectX(group.values, curDataPointX);
      const d0 = group.values[Math.max(0, idxOfX - 1)];
      const d1 = group.values[Math.min(idxOfX, group.values.length - 1)];
      const closestPoint =
        curDataPointX - d0.x > d1.x - curDataPointX ? d1 : d0;
      labelTocircleMarkerMap.get(group.label).update(closestPoint);
      allClosestPoints.x = closestPoint.x;
      allClosestPoints[group.label] = closestPoint.y;
    });

    // Update interactive elements depending on closestPoint
    tooltip.update(allClosestPoints, { x: event.pageX, y: event.pageY });
  });

  svg.on("mouseleave", () => {
    tooltip.remove();
    labelTocircleMarkerMap.forEach((d) => d.remove());
  });

  // Add interactive element to the div if not part of the svg
  div.node().appendChild(tooltip.node());
}

export function addCheckBox(
  { curveId, checkboxText, checkboxColor = "black" },
  domSelection
) {
  const CheckBoxDiv = domSelection.append("div");
  const CheckBoxInput = CheckBoxDiv.append("input")
    .attr("type", "checkbox")
    .attr("id", `${curveId}-checkbox`)
    .property("checked", true);
  CheckBoxDiv.append("label")
    .attr("for", `${curveId}-checkbox`)
    .text(checkboxText)
    .style("color", checkboxColor);

  CheckBoxInput.on("change", () => {
    if (CheckBoxInput.node().checked) {
      d3.select(`#${curveId}`).style("opacity", 1);
    } else {
      d3.select(`#${curveId}`).style("opacity", 0);
    }
  });
}

export async function cmptLinearRGBfromXYZ() {
  const CIE_XYZ_CMFs = await loadData("data/CIE_xyz_1931_2deg.csv");

  // Normalize so that coefficients are in [0, 1]
  const maxValue = CIE_XYZ_CMFs.reduce((max, obj) => {
    // Compare max with both obj.x and obj.y
    return Math.max(max, obj.X, obj.Y, obj.Z);
  }, -Infinity);

  CIE_XYZ_CMFs.forEach((d) => {
    d.X /= maxValue;
    d.Y /= maxValue;
    d.Z /= maxValue;
  });

  const XYZtoRGB_M = [
    [3.2404542, -1.5371385, -0.4985314],
    [-0.969266, 1.8760108, 0.041556],
    [0.0556434, -0.2040259, 1.0572252],
  ];

  const LinearRGB = CIE_XYZ_CMFs.map((d) => {
    const XYZVec = [d.X, d.Y, d.Z];
    //const XYZVec = [d.X/d.Y, 1, d.Z/d.Y];
    const LinRGBVec = math.multiply(XYZtoRGB_M, XYZVec);
    return {
      Wavelength: d.Wavelength,
      R: LinRGBVec[0],
      G: LinRGBVec[1],
      B: LinRGBVec[2],
    };
  });

  return LinearRGB;
}

export async function cmpRGBfromXYZ() {
  const LinearRGB = await cmptLinearRGBfromXYZ();
  const displayRGB = LinearRGB.map((d) => {
    const sR = correctGamma(d.R) * 255;
    const sG = correctGamma(d.G) * 255;
    const sB = correctGamma(d.B) * 255;
    return { Wavelength: d.Wavelength, R: sR, G: sG, B: sB };
  });

  return displayRGB;
}

export function correctGamma(value) {
  if (value <= 0.0031308) {
    return 12.92 * value;
  } else {
    return 1.055 * Math.pow(value, 1 / 2.4) - 0.055;
  }
}

export function scaleLinearForD3ColorRgb(domain, colorRange) {
  const rScale = d3.scaleLinear(domain, [colorRange[0].r, colorRange[1].r]);
  const gScale = d3.scaleLinear(domain, [colorRange[0].g, colorRange[1].g]);
  const bScale = d3.scaleLinear(domain, [colorRange[0].b, colorRange[1].b]);
  const opacityScale = d3.scaleLinear(domain, [
    colorRange[0].opacity,
    colorRange[1].opacity,
  ]);

  return function (v) {
    return d3.rgb(rScale(v), gScale(v), bScale(v), opacityScale(v));
  };
}

export function cvtWavelengthToLinearRGB(lambda) {
  const idxOfX = d3
    .bisector((d) => d.Wavelength)
    .left(LinearRGBperWavelength, lambda);
  const prev = LinearRGBperWavelength[Math.max(0, idxOfX - 1)];
  const next =
    LinearRGBperWavelength[Math.min(idxOfX, LinearRGBperWavelength.length - 1)];

  const prevRGB = d3.rgb(prev.R, prev.G, prev.B);
  const nextRGB = d3.rgb(next.R, next.G, next.B);

  const colorScale = scaleLinearForD3ColorRgb(
    [prev.Wavelength, next.Wavelength],
    [prevRGB, nextRGB]
  );
  const interpolatedColor = colorScale(lambda);
  return {
    R: interpolatedColor.r,
    G: interpolatedColor.g,
    B: interpolatedColor.b,
  };
}

export function cvtWavelengthToDisplayRGB(lambda) {
  return cvtLinearRGBtoRGB(cvtWavelengthToLinearRGB(lambda));
}

export function cvtXYZtoRGB({ X, Y, Z }) {
  if (X > 1 || X < 0 || Y > 1 || Y < 0 || Z > 1 || Z < 0) {
    return { R: 0, G: 0, B: 0 }; //throw new RangeError(`X, Y, Z should be in range [0, 1], your input are ${X}, ${Y}, ${Z}`);
  }

  const XYZtoRGB_M = [
    [3.2404542, -1.5371385, -0.4985314],
    [-0.969266, 1.8760108, 0.041556],
    [0.0556434, -0.2040259, 1.0572252],
  ];

  const LinRGBVec = math.multiply(XYZtoRGB_M, [X, Y, Z]);
  const displayRGBVec = LinRGBVec.map((v) => correctGamma(v) * 255);
  return { R: displayRGBVec[0], G: displayRGBVec[1], B: displayRGBVec[2] };
}

export function cvtRGBtoD3rgb({ R, G, B }) {
  return d3.rgb(R, G, B);
}

export function cvtLinearRGBtoRGB({ R, G, B }) {
  const displayRGB = [R, G, B].map((v) => correctGamma(v) * 255);
  return { R: displayRGB[0], G: displayRGB[1], B: displayRGB[2] };
}

export function cvtXYZtoLinearRGB({ X, Y, Z }) {
  if (X > 1 || X < 0 || Y > 1 || Y < 0 || Z > 1 || Z < 0) {
    throw new RangeError(
      `X, Y, Z should be in range [0, 1], your input are ${X}, ${Y}, ${Z}`
    );
  }

  const XYZtoRGB_M = [
    [3.2404542, -1.5371385, -0.4985314],
    [-0.969266, 1.8760108, 0.041556],
    [0.0556434, -0.2040259, 1.0572252],
  ];

  const LinRGBVec = math.multiply(XYZtoRGB_M, [X, Y, Z]);

  return { R: LinRGBVec[0], G: LinRGBVec[1], B: LinRGBVec[2] };
}

export function cvt_xyYtoXYZ({ x, y, Y }) {
  const XpYpZ = Y / y;
  const X = x * XpYpZ;
  const Z = (1 - x - y) * XpYpZ;
  return { X: X, Y: Y, Z: Z };
}

export function cvt_xyYtoRGB({ x, y, Y }) {
  const XYZ = cvt_xyYtoXYZ({ x, y, Y });
  return cvtXYZtoRGB(XYZ);
}

async function cmpt_xySpectralLocus() {
  const CIE_XYZ_CMFs = await loadData("data/CIE_xyz_1931_2deg.csv");

  const locus_coord = [];
  CIE_XYZ_CMFs.forEach((d) => {
    const XpYpZ = d.X + d.Y + d.Z;
    const x = d.X / XpYpZ;
    const y = d.Y / XpYpZ;
    locus_coord.push({ x: x, y: y });
  });
  return locus_coord;
}

export async function createCMFs() {
  const rgbCoefsData = await loadData("data/CIE_rgb_coef.csv");
  const VData = await loadData("data/CIE_sle_photopic.csv");

  const lambdaToRgbCoefsMap = new Map(
    rgbCoefsData.map((d) => [d.Wavelength, { r: d.r, g: d.g, b: d.b }])
  );
  const lambdaToVMap = new Map(VData.map((d) => [d.Wavelength, d.V]));

  const CMFsData = [
    {
      label: "R",
      values: rgbCoefsData.map((d) => ({ x: d.Wavelength, y: 0 })),
    },
    {
      label: "G",
      values: rgbCoefsData.map((d) => ({ x: d.Wavelength, y: 0 })),
    },
    {
      label: "B",
      values: rgbCoefsData.map((d) => ({ x: d.Wavelength, y: 0 })),
    },
  ];

  updateCMFs(lambdaToRgbCoefsMap, lambdaToVMap, undefined, CMFsData);
  return [CMFsData, lambdaToRgbCoefsMap, lambdaToVMap];
}

export function updateCMFs(
  lambdaToRgbCoefsMap,
  lambdaToVMap,
  { Lr = 1.0, Lg = 4.5907, Lb = 0.0601 } = {},
  CMFsData
) {
  const CMF_R = CMFsData.find((group) => group.label === "R").values;
  const CMF_G = CMFsData.find((group) => group.label === "G").values;
  const CMF_B = CMFsData.find((group) => group.label === "B").values;

  const nbWavelength = CMF_R.length; // TODO: assert all CMF have same length
  for (let i = 0; i < nbWavelength; ++i) {
    const l = CMF_R[i].x;
    const curRgbCoef = lambdaToRgbCoefsMap.get(l);
    const curLuminance =
      Lr * curRgbCoef.r + Lg * curRgbCoef.g + Lb * curRgbCoef.b;
    const k = lambdaToVMap.get(l) / curLuminance;
    CMF_R[i].y = k * curRgbCoef.r;
    CMF_G[i].y = k * curRgbCoef.g;
    CMF_B[i].y = k * curRgbCoef.b;
  }
}

export function unzipArrayOfObject(arrayOfObjects) {
  const nbElem = arrayOfObjects.length;
  const keys = Object.keys(arrayOfObjects[0]);
  const outArray = Array.from({ length: keys.length }, () => []);

  arrayOfObjects.forEach((obj) => {
    keys.forEach((key, keyIdx) => {
      outArray[keyIdx].push(obj[key]);
    });
  });
  return outArray;
}

/**
 * Converts an RGB string to an RGBA string with the specified alpha value.
 * @param {string} rgb - The RGB color string (e.g., "rgb(1, 2, 3)").
 * @param {number} alpha - The alpha value (e.g., 0.5).
 * @returns {string} - The RGBA color string (e.g., "rgba(1, 2, 3, 0.5)").
 */
export function addAlphaToRgb(rgb, alpha) {
  // Match the RGB values from the input string
  const match = rgb.match(
    /rgba?\(\s*(-?[\d.]+),\s*(-?[\d.]+),\s*(-?[\d.]+)(?:,\s*([\d.]+))?\s*\)/
  );

  if (!match) {
    throw new Error("Invalid RGB color format");
  }

  const [r, g, b] = match.slice(1).map(Number); // Extract R, G, B as numbers
  return `rgba(${r}, ${g}, ${b}, ${alpha})`; // Construct the RGBA string
}

/**
 * Converts an RGBA string to an object representation.
 * @param {string} rgbaColor - The RGBA color string (e.g., "rgba(255, 128, 64, 0.5)").
 * @returns {Object} - An object with properties {r, g, b, a}.
 */
export function parseRgba(rgbaColor) {
  const regex =
    /rgba?\(\s*(-?[\d.]+),\s*(-?[\d.]+),\s*(-?[\d.]+)(?:,\s*([\d.]+))?\s*\)/;
  const match = rgbaColor.match(regex);
  if (!match) {
    throw new Error("Invalid RGBA color format");
  }
  return {
    r: parseFloat(match[1]),
    g: parseFloat(match[2]),
    b: parseFloat(match[3]),
    a: match[4] !== undefined ? parseFloat(match[4]) : 1, // Default alpha to 1 if not present
  };
}

/**
 * Converts an RGBA object to a string representation.
 * @param {Object} rgbaObject - An object with properties {r, g, b, a}.
 * @returns {string} - The RGBA color string (e.g., "rgba(255, 128, 64, 0.5)").
 */
export function toRgbaString(rgbaObject) {
  return `rgba(${rgbaObject.r}, ${rgbaObject.g}, ${rgbaObject.b}, ${rgbaObject.a})`;
}

/**
 * input: [{x:x1, y:y1}, {x:x2, y:y2}, ...]
 * output: {x: [x1, x2, ...], y:[y1, y2, ...]}
 */
export function unzipXY(arrayOf_xy) {
  const out = { x: [], y: [] };
  arrayOf_xy.forEach((d) => {
    out.x.push(d.x);
    out.y.push(d.y);
  });
  return out;
}

/**
 *
 * @param {Array} xArray
 * @param {Array} yArray
 * @returns {Array} [{x, y}]
 */
export function zipXY(xArray, yArray) {
  return xArray.map((x, i) => {
    return { x: x, y: yArray[i] };
  });
}

/**
 * Compute the integral using Trapezoid method.
 * @param {Array} values_xy [{x, y}].
 * @return {Number}
 */
export function integralTrapezoid(values_xy) {
  let result = 0.0;
  for (let i = 0; i < values_xy.length - 1; ++i) {
    result +=
      (values_xy[i + 1].x - values_xy[i].x) *
      (values_xy[i + 1].y + values_xy[i].y) *
      0.5;
  }
  return result;
}

/**
 * Interpolate each values in valuesToBeInterpolated using data_xy
 * @param {Array} data_xy [{x, y}] sorted by x
 * @param {Array} valuesToBeInterpolated [x].
 * @return {Array} Interpolated values
 */
export function interpolate(data_xy, valuesToBeInterpolated) {
  const interpolatedValues = valuesToBeInterpolated.map((x) => {
    // Find the lower and higher closest value of x in data_xy
    const idxOfX = d3.bisector((d) => d.x).left(data_xy, x);
    const leftPoint = data_xy[Math.max(0, idxOfX - 1)];
    const rightPoint = data_xy[Math.min(idxOfX, data_xy.length - 1)];

    // Interpolate x
    return d3.scaleLinear(
      [leftPoint.x, rightPoint.x],
      [leftPoint.y, rightPoint.y]
    )(x);
  });
  return interpolatedValues;
}

/**
 *
 * @param  {...any} arrays
 * @returns
 */
export function multiplyArrays(...arrays) {
  return arrays[0].map((_, i) =>
    arrays.reduce((prod, array) => prod * array[i], 1)
  );
}

/**
 *
 * @param  {...any} arrays
 * @returns
 */
export function addArrays(...arrays) {
  return arrays[0].map((_, i) =>
    arrays.reduce((sum, array) => sum + array[i], 0)
  );
}

export function addCoordinates(p1, p2) {
  return { x: p1.x + p2.x, y: p1.y + p2.y };
}

export function degToRad(angleDeg) {
  return (angleDeg / 180.0) * Math.PI;
}

export function radToDeg(angleRad) {
  return (angleRad / Math.PI) * 180.0;
}

export function getCurrentRotation(selection) {
  const transform = selection.attr("transform"); // Get transform string
  const match = transform ? transform.match(/rotate\((-?\d+\.?\d*)\)/) : null;
  return match ? parseFloat(match[1]) : 0; // Return rotation angle or 0 if not found
}

export function limitDecimal(str, decimals = 2) {
  return str.replace(/[-+]?\d*\.?\d+/g, (num) => Number(num).toFixed(decimals));
}

export function intersect(array1, array2) {
  const set1 = new Map(array1.map((v, i) => [v, i]));
  const indexes = [];
  array2.filter((e, index2) => {
    if (set1.has(e)) {
      const index1 = set1.get(e);
      indexes.push({ value: e, index1, index2 });
    }
  });

  return indexes;
}

export class Slider {
  constructor({
    label = "label",
    min = 0,
    max = 1.0,
    step = 0.1,
    value = 0.5,
    id = "",
  } = {}) {
    this.div = document.createElement("div");
    this.div.id = id;
    const labelElement = document.createElement("label");
    labelElement.textContent = label;
    const sliderWithRangeContainer = document.createElement("div");
    this.sliderInput = document.createElement("input");
    this.sliderInput.type = "range";
    this.sliderInput.min = min;
    this.sliderInput.max = max;
    this.sliderInput.step = step;
    this.sliderInput.value = value;
    this.minValueText = document.createElement("span");
    this.minValueText.id = "min-value-text";
    this.minValueText.textContent = min;
    this.maxValueText = document.createElement("span");
    this.maxValueText.textContent = max;
    this.thumbText = document.createElement("span");

    sliderWithRangeContainer.append(
      this.minValueText,
      this.sliderInput,
      this.maxValueText,
      this.thumbText
    );
    this.div.appendChild(sliderWithRangeContainer);
    this.div.appendChild(labelElement);

    // Style
    this.div.style.display = "flex";
    this.div.style.flexDirection = "column";
    this.div.style.alignItems = "center";
    this.div.style.margin = "30px";
    sliderWithRangeContainer.style.display = "flex";
    sliderWithRangeContainer.style.alignItems = "center";
    sliderWithRangeContainer.style.position = "relative";
    this.thumbText.style.position = "absolute";
    this.thumbText.style.top = "-25px";
    this.thumbText.style.visibility = "hidden";

    // Attach thumbText to the moving thumb
    const updateThumbText = () => {
      this.thumbText.style.visibility = "visible";
      const sliderRect = this.sliderInput.getBoundingClientRect();
      const thumbPosition =
        ((this.sliderInput.value - this.sliderInput.min) /
          (this.sliderInput.max - this.sliderInput.min)) *
        sliderRect.width;
      this.thumbText.style.left = `${thumbPosition}px`;
      this.thumbText.textContent = this.sliderInput.value; // Update displayed value
    }
    requestAnimationFrame(() => updateThumbText());
    this.sliderInput.addEventListener("input", updateThumbText);
  }

  addEventListener(eventType, cb) {
    this.sliderInput.addEventListener(eventType, cb);
  }

  setMax(value) {
    this.sliderInput.max = value;
    this.maxValueText.textContent = value.toFixed(2);
    this.setValue(value)
  }

  setMin(value) {
    this.sliderInput.min = value;
    this.minValueText.textContent = value.toFixed(2);
    this.setValue(value)
  }

  setValue(value){
    if(this.sliderInput.min<=value && value<=this.sliderInput.max){
      this.sliderInput.value = value;
      this.thumbText.textContent = value.toFixed(2);
      this.sliderInput.dispatchEvent(new Event('input'));
    }
  }

  get value(){
    return this.sliderInput.value;
  }

  setDisable(value){
    this.sliderInput.disabled = value;
  }

}
