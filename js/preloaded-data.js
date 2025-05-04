import * as util from "./util.mjs"

export const photopicRawData = await util.loadData("data/CIE_sle_photopic.csv");
export const chromCoefRawData = await util.loadData("data/CIE_rgb_coef.csv");
export const cieXyzCmfRawData = await util.loadData("data/CIE_xyz_1931_2deg.csv");

// Load only a part of this file because it is too large
export const munsellSpdRawData = await util.loadData(
  "data/munsell_380_780_1_glossy_selection.csv"
);



