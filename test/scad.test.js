"use strict";
// The copied OpenSCAD file: values filled in correctly, nothing else changed.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const S = require("../core/scad.js");
const { defaultDesign, SCAD_NAMES } = require("../core/params.js");
const { applyField } = require("../state/link.js");

const REF = fs.readFileSync(path.join(__dirname, "..", "reference", "polycarb_sprocket.scad"), "utf8").replace(/\r\n/g, "\n");
const ALL = ["part", ...Object.values(SCAD_NAMES)];
// name -> value text, from the parameter lines of a .scad text
function params(text) {
  const out = {};
  for (const l of text.split("\n")) {
    const m = /^([A-Za-z_]\w*)\s*=\s*([^;]*);/.exec(l);
    if (m && ALL.includes(m[1])) { assert.ok(!(m[1] in out), m[1] + " appears once"); out[m[1]] = m[2]; }
  }
  return out;
}

test("the page carries the reference model unchanged", () => {
  assert.equal(S.TEMPLATE, REF);
});

test("default design: the copied file is byte-identical to the reference", () => {
  assert.equal(S.scadFile(defaultDesign(), "sprocket"), REF);
});

test("every parameter is filled in, with the exact OpenSCAD names", () => {
  let d = defaultDesign();
  for (const [k, v] of [["rotation", 180], ["teeth", 24], ["holeD", 4.6], ["sheetT", 1.6], ["gap", 0.35], ["pinW", 4.25], ["pinH", 3.1],
    ["pinFlat", 0.65], ["drumW", 6], ["hub", "custom"], ["boltSquare", 20], ["boltHoleD", 4.7], ["boltHeadD", 8], ["counterbore", 2],
    ["centerD", 9], ["pilot", false], ["pilotD", 13.5], ["pilotH", 1], ["guideHoles", 25], ["edgeOffset", 9], ["guideT", 3.5], ["guideHoleD", 4.8]]) {
    d = applyField(d, k, v);
  }
  d = applyField(d, "travel", 100);
  const p = params(S.scadFile(d, "drill_guide"));
  assert.deepEqual(Object.keys(p).sort(), [...ALL].sort());
  assert.equal(p.part, '"drill_guide"');
  assert.equal(p.pilot, "false");
  for (const [key, name] of Object.entries(SCAD_NAMES)) {
    if (key === "pilot") continue;
    assert.ok(Math.abs(parseFloat(p[name]) - d[key]) < 5e-5, name + ": " + p[name] + " vs " + d[key]);
    assert.match(p[name], /^-?\d+(\.\d+)?$/, name + " is a plain decimal");
  }
});

test("only values change: every other line, comment and check stays the same", () => {
  const d = { ...applyField(defaultDesign(), "rotation", 123.456789), pinW: 4.4, counterbore: 1.5 };
  const a = REF.split("\n"), b = S.scadFile(d, "sprocket").split("\n");
  assert.equal(a.length, b.length);
  let changed = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    changed++;
    const ma = /^(\w+\s*=\s*)[^;]*;\s*(\/\/.*)$/.exec(a[i]), mb = /^(\w+\s*=\s*)[^;]*;\s*(\/\/.*)$/.exec(b[i]);
    assert.ok(ma && mb, "line " + (i + 1) + " is a parameter line");
    assert.equal(mb[1], ma[1]); assert.equal(mb[2], ma[2], "comment kept");
    assert.equal(b[i].indexOf("//"), a[i].indexOf("//"), "comment keeps its column");
  }
  assert.equal(changed, 3, "rotation_deg, pin_d and counterbore");
  assert.match(b.join("\n"), /^rotation_deg = 123\.4568;/m);
});

test("taper angle is not an OpenSCAD setting; it arrives through pin_tip_d", () => {
  const d = applyField(defaultDesign(), "taper", 20);
  const p = params(S.scadFile(d, "sprocket"));
  assert.equal(p.pin_tip_d, "3.0096"); // shows as 3.01 mm on the page
  assert.doesNotMatch(S.scadFile(d, "sprocket"), /taper\s*=/);
});

test("settings only: just the parameter block, pasted over gives the same file", () => {
  const d = applyField(applyField(defaultDesign(), "rotation", 180), "pinW", 4.2);
  const block = S.scadSettings(d, "sprocket");
  assert.deepEqual(Object.keys(params(block)).sort(), [...ALL].sort());
  assert.doesNotMatch(block, /\[Hidden\]|module |assert\(/);
  // paste each line over the matching line of the reference file
  const set = {};
  for (const l of block.split("\n")) { const m = /^(\w+)\s*=/.exec(l); if (m) set[m[1]] = l; }
  const pasted = REF.split("\n").map(l => { const m = /^(\w+)\s*=/.exec(l); return m && set[m[1]] && ALL.includes(m[1]) ? set[m[1]] : l; }).join("\n");
  assert.equal(pasted, S.scadFile(d, "sprocket"));
});

test("numbers never use exponents", () => {
  assert.equal(S.scadNum(1e-7), "0");
  assert.equal(S.scadNum(123456.78912), "123456.7891");
  assert.equal(S.scadNum(-0.00001), "0");
});
