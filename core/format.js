"use strict";
// Number formatting shared by inputs, tables, badges and drawings.
const MINUS = "−";

function round(v, dp) { const m = 10 ** dp; return Math.round(v * m) / m; }

// Fixed decimals, real minus sign, "—" for missing numbers.
function fixed(v, dp) {
  if (v === null || v === undefined || !isFinite(v)) return "—";
  let s = round(v, dp).toFixed(dp);
  if (s[0] === "-") s = /^-0(\.0+)?$/.test(s) ? s.slice(1) : MINUS + s.slice(1);
  return s;
}

// For input boxes: no trailing zeros ("6", "4.5", "9.525"), plain ASCII minus.
function trim(v, maxDp) {
  if (v === null || v === undefined || !isFinite(v)) return "";
  let s = round(v, maxDp).toFixed(maxDp);
  if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
  if (s === "-0") s = "0";
  return s;
}

// Accepts "1.5", "-2", "−2", "1,5", " 3 ". Anything else (including "", "1.", "-") is NaN.
function parse(str) {
  if (typeof str === "number") return str;
  if (typeof str !== "string") return NaN;
  const t = str.trim().replace(/−/g, "-").replace(/,/g, ".");
  if (!/^[-+]?(\d+(\.\d+)?|\.\d+)$/.test(t)) return NaN;
  return parseFloat(t);
}

// Number for the OpenSCAD file: up to 6 decimals, trimmed, no exponent.
function scadNum(v) {
  let s = round(v, 6).toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
  if (s === "-0") s = "0";
  return s;
}

module.exports = { MINUS, round, fixed, trim, parse, scadNum };
