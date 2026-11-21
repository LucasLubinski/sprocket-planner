"use strict";
// Fill the current design into the OpenSCAD model. Only values change: every
// comment, check and console message in the file stays as it is, so OpenSCAD
// still explains problems in plain words. "Settings only" is the parameter
// block, to paste over the top of a file already open in OpenSCAD.
const TEMPLATE = require("./scad-template.js");
const { SCAD_NAMES } = require("./params.js");

// Plain decimal, up to 4 places, never an exponent.
function scadNum(v) {
  let s = (Math.round(v * 1e4) / 1e4).toFixed(4).replace(/\.?0+$/, "");
  return s === "-0" ? "0" : s;
}

// name -> text value for every parameter the page controls.
function scadValues(design, part) {
  const out = { part: JSON.stringify(part === "drill_guide" ? "drill_guide" : "sprocket") };
  for (const [key, name] of Object.entries(SCAD_NAMES)) {
    const v = design[key];
    out[name] = typeof v === "boolean" ? String(v) : scadNum(v);
  }
  return out;
}

// One assignment line: `name = value;   // comment`. The comment keeps its
// column when it can. A value that already means the same number keeps its
// original spelling (4.0 stays 4.0), so an unchanged design is byte-identical.
const LINE = /^([A-Za-z_]\w*)(\s*=\s*)([^;]*?)(;)(\s*)(\/\/.*)?$/;
function fillLine(line, values) {
  const m = LINE.exec(line);
  if (!m || !(m[1] in values)) return line;
  const [, name, eq, old, semi, sp, comment] = m;
  const val = values[name];
  const same = old === val || (isFinite(parseFloat(old)) && /^[-\d.]+$/.test(old) && parseFloat(old) === parseFloat(val));
  if (same) return line;
  if (!comment) return name + eq + val + semi;
  const col = (name + eq + old + semi + sp).length;
  const head = name + eq + val + semi;
  return head + " ".repeat(Math.max(1, col - head.length)) + comment;
}

// The parameter section: from "/* [What to make] */" up to "/* [Hidden] */".
function sectionRange(lines) {
  const a = lines.findIndex(l => l.startsWith("/* [What to make] */"));
  const b = lines.findIndex(l => l.startsWith("/* [Hidden] */"));
  return [a, b];
}

function scadFile(design, part, template = TEMPLATE) {
  const values = scadValues(design, part);
  const lines = template.split("\n");
  const [a, b] = sectionRange(lines);
  return lines.map((l, i) => (i >= a && i < b) ? fillLine(l, values) : l).join("\n");
}

function scadSettings(design, part, template = TEMPLATE) {
  const lines = scadFile(design, part, template).split("\n");
  const [a, b] = sectionRange(lines);
  const body = lines.slice(a, b);
  while (body.length && !body[body.length - 1].trim()) body.pop();
  return ["// Sprocket Planner settings: paste these over the matching lines at the top of polycarb_sprocket.scad", ""]
    .concat(body).join("\n") + "\n";
}

module.exports = { scadNum, scadValues, fillLine, scadFile, scadSettings, TEMPLATE };
