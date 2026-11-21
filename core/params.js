"use strict";
// Every design number, its OpenSCAD name (when it has one) and its default.
const T = require("./taper.js");

// The goBILDA / ServoCity 32 mm 25T spline servo hub.
const GOBILDA_HUB = Object.freeze({
  boltSquare: 16, boltHoleD: 4.5, boltHeadD: 7.5, counterbore: 0,
  centerD: 8, pilot: true, pilotD: 13.7, pilotH: 1.2
});
const HUB_KEYS = Object.keys(GOBILDA_HUB);

// Design keys -> OpenSCAD parameter names, in the order of the .scad file.
const SCAD_NAMES = Object.freeze({
  rotation: "rotation_deg", travel: "travel",
  holeD: "hole_d", sheetT: "sheet_t", teeth: "teeth",
  pinW: "pin_d", pinStraight: "pin_straight", tipD: "pin_tip_d", pinH: "pin_h", gap: "sheet_gap", pinFlat: "pin_flat",
  drumW: "drum_w",
  boltSquare: "bolt_square", boltHoleD: "bolt_hole_d", boltHeadD: "bolt_head_d", counterbore: "counterbore",
  centerD: "center_d", pilot: "pilot", pilotD: "pilot_d", pilotH: "pilot_h",
  guideHoles: "guide_holes", edgeOffset: "edge_offset", guideT: "guide_t", guideHoleD: "guide_hole_d"
});

const BASE = {
  // motion
  rotation: 360, travel: 152.4, teeth: 16,
  // sheet
  holeD: 4.5, sheetT: 1.5, gap: 0.4,
  // pins
  pinW: 4.0, pinStraight: 0, pinH: 2.6, tipD: 2.0, pinFlat: 0.7, shape: "tapered",
  straightPast: 0,             // Straight shape: the straight part runs this far past the sheet top
  // body and hub
  drumW: 5, hub: "gobilda", ...GOBILDA_HUB,
  // drill guide
  guideHoles: 0, edgeOffset: 8, guideT: 4, guideHoleD: 4.7,
  // sheet file for CNC (null = automatic)
  sheetLen: null, sheetW: 40, rowOffset: null, endMargin: 15,
  // track
  trackClearT: 0.3, trackClearW: 1.0
};
BASE.taper = T.taperFromTip(BASE.pinW, BASE.pinStraight, BASE.pinH, BASE.tipD).deg;
const DEFAULT_DESIGN = Object.freeze(BASE);

function defaultDesign() { return { ...DEFAULT_DESIGN }; }

// Fill in anything missing (older saved designs) and drop unknown keys.
function normalizeDesign(d) {
  const out = defaultDesign();
  if (!d || typeof d !== "object") return out;
  for (const k of Object.keys(out)) {
    if (!(k in d)) continue;
    const v = d[k], def = out[k];
    if (k === "shape") { if (["tapered", "straight", "custom"].includes(v)) out.shape = v; continue; }
    if (k === "hub") { if (v === "gobilda" || v === "custom") out.hub = v; continue; }
    if (k === "pilot") { out.pilot = v === true || v === "true"; continue; }
    if (def === null || typeof def === "number") {
      if (v === null && def === null) { out[k] = null; continue; }
      const n = typeof v === "number" ? v : parseFloat(v);
      if (Number.isFinite(n)) out[k] = n;
    }
  }
  if (!Number.isFinite(out.taper)) {
    const t = T.taperFromTip(out.pinW, out.pinStraight, out.pinH, out.tipD);
    out.taper = t.deg;
  }
  return out;
}

module.exports = { GOBILDA_HUB, HUB_KEYS, SCAD_NAMES, DEFAULT_DESIGN, defaultDesign, normalizeDesign };
