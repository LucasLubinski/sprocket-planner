"use strict";
// Linked inputs: when one field is edited, which others stay fixed and which
// follow. This is the "Field edited / Stays fixed / Changes" table in CLAUDE.md.
// Typing, drag handles, type-in-place and buttons all come through here.
const T = require("../core/taper.js");
const { GOBILDA_HUB, HUB_KEYS } = require("../core/params.js");

// Pin width, straight part or height changed: hold the taper angle, move the tip.
// If there is no usable angle (tip was too big), keep the tip and re-measure the angle.
function holdTaper(d) {
  if (isFinite(d.taper)) {
    const r = T.tipFromTaper(d.pinW, d.pinStraight, d.pinH, d.taper);
    if (isFinite(r.tipD)) { d.tipD = r.tipD; return; }
  }
  d.taper = T.taperFromTip(d.pinW, d.pinStraight, d.pinH, d.tipD).deg;
}

// "Straight through the sheet" keeps the straight part equal to gap + thickness.
function followStraight(d) {
  if (d.shape === "straight") {
    d.pinStraight = d.gap + d.sheetT;
    holdTaper(d);
  }
}

// Returns a new design with `key` set to `value` and the linked fields updated.
// Lengths are in mm; travel in mm (the UI converts inches before calling).
function applyField(design, key, value) {
  const d = { ...design };
  switch (key) {
    case "rotation": d.rotation = value; break;              // travel and pins fixed: wheel size and spacing follow
    case "travel": d.travel = value; break;                  // turn and pins fixed
    case "teeth": d.teeth = value; break;                    // turn, travel and wheel size fixed: spacing follows
    case "P": d.travel = value * d.teeth * d.rotation / 360; break;           // T_rev = N x P
    case "pitchD": d.travel = Math.PI * value * d.rotation / 360; break;      // T_rev = pi x D
    case "drumD": {                                                          // R_p = D/2 + g + t/2
      const Rp = value / 2 + d.gap + d.sheetT / 2;
      d.travel = 2 * Math.PI * Rp * d.rotation / 360;
      break;
    }
    case "sheetT": d.sheetT = value; followStraight(d); break; // turn and travel fixed: drum and play follow
    case "gap": d.gap = value; followStraight(d); break;
    case "pinW": d.pinW = value; holdTaper(d); break;
    case "pinH": d.pinH = value; holdTaper(d); break;
    case "pinStraight": d.pinStraight = value; d.shape = "custom"; holdTaper(d); break;
    case "taper": {
      d.taper = value;
      const r = T.tipFromTaper(d.pinW, d.pinStraight, d.pinH, value);
      if (isFinite(r.tipD)) d.tipD = r.tipD;
      break;
    }
    case "tipD": d.tipD = value; d.taper = T.taperFromTip(d.pinW, d.pinStraight, d.pinH, value).deg; break;
    case "shape":
      d.shape = value;
      d.pinStraight = value === "straight" ? d.gap + d.sheetT : 0;
      holdTaper(d);
      break;
    case "hub":
      d.hub = value;
      if (value === "gobilda") Object.assign(d, GOBILDA_HUB);
      break;
    case "pilot": d.pilot = !!value; break;
    case "sheetLen": case "rowOffset": d[key] = value === null ? null : value; break;
    default: d[key] = value;
  }
  return d;
}

// Hub mount settings are locked to the goBILDA preset unless the hub is Custom.
function isLocked(design, key) {
  return design.hub === "gobilda" && HUB_KEYS.includes(key);
}

module.exports = { applyField, holdTaper, followStraight, isLocked };
