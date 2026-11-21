"use strict";
// The linked-field rules table from CLAUDE.md, row by row.
const test = require("node:test");
const assert = require("node:assert/strict");
const { applyField } = require("../state/link.js");
const { defaultDesign } = require("../core/params.js");
const G = require("../core/geometry.js");
const T = require("../core/taper.js");

const near = (a, e, tol, what) => assert.ok(Math.abs(a - e) <= tol, `${what}: got ${a}, expected ${e}`);
const der = p => G.derive(p);
const D0 = () => defaultDesign();

test("Wheel turns: travel and pins fixed; wheel size and spacing change", () => {
  const a = D0(), b = applyField(a, "rotation", 180);
  assert.equal(b.travel, a.travel); assert.equal(b.teeth, a.teeth);
  near(der(b).drumD, 94.72, 0.005, "drum"); near(der(b).P, 19.05, 1e-9, "spacing");
});

test("Sheet slides: turn and pins fixed", () => {
  const a = D0(), b = applyField(a, "travel", 203.2);
  assert.equal(b.rotation, 360); assert.equal(b.teeth, 16);
  near(der(b).P, 12.7, 1e-9, "spacing");
});

test("Pins: turn, travel and wheel size fixed; spacing and plastic change", () => {
  const a = D0(), b = applyField(a, "teeth", 24);
  assert.equal(b.rotation, a.rotation); assert.equal(b.travel, a.travel);
  near(der(b).drumD, der(a).drumD, 1e-12, "wheel size");
  near(der(b).P - der(a).P, -3.175, 1e-9, "spacing change");
  near(der(b).web - der(a).web, -3.175, 1e-9, "plastic change");
});

test("Hole spacing: turn and pins fixed; travel follows T_rev = N x P", () => {
  const b = applyField(D0(), "P", 10);
  assert.equal(b.rotation, 360); assert.equal(b.teeth, 16);
  near(b.travel, 160, 1e-9, "travel");
  const c = applyField({ ...D0(), rotation: 180 }, "P", 10);
  near(c.travel, 80, 1e-9, "travel at 180");
});

test("Pitch diameter: travel follows T_rev = pi x D", () => {
  const b = applyField(D0(), "pitchD", 50);
  near(b.travel, Math.PI * 50, 1e-9, "travel");
  near(der(b).pitchD, 50, 1e-9, "pitch back");
});

test("Drum diameter: travel follows R_p = D/2 + g + t/2", () => {
  const b = applyField(D0(), "drumD", 60);
  near(der(b).drumD, 60, 1e-9, "drum back");
  near(b.travel, 2 * Math.PI * (30 + 0.4 + 0.75), 1e-9, "travel");
});

test("Sheet thickness or gap: turn and travel fixed; drum and play change", () => {
  const a = D0();
  const b = applyField(a, "sheetT", 2);
  assert.equal(b.travel, a.travel); assert.equal(b.rotation, a.rotation);
  assert.ok(der(b).drumD < der(a).drumD);
  const c = applyField(a, "gap", 0.6);
  assert.ok(der(c).play > der(a).play, "tapered pin gets looser as the sheet rises");
});

test("Pin width, straight part or height: taper angle fixed, tip follows", () => {
  const a = D0();
  for (const [k, v] of [["pinW", 4.4], ["pinH", 3], ["pinStraight", 0.3]]) {
    const b = applyField(a, k, v);
    near(b.taper, a.taper, 1e-12, k + " keeps the angle");
    near(T.taperFromTip(b.pinW, b.pinStraight, b.pinH, b.tipD).deg, a.taper, 1e-7, k + " tip matches the angle");
    assert.notEqual(b.tipD, a.tipD);
  }
});

test("Taper angle: width, straight and height fixed; tip follows", () => {
  const b = applyField(D0(), "taper", 20);
  assert.equal(b.pinW, 4); assert.equal(b.pinH, 2.6); assert.equal(b.pinStraight, 0);
  assert.equal(b.tipD.toFixed(2), "3.01");
});

test("Tip diameter: width, straight and height fixed; angle follows", () => {
  const b = applyField(D0(), "tipD", 3.01);
  assert.equal(b.taper.toFixed(1), "20.0");
});

test("Shape buttons change only the straight section", () => {
  const a = D0();
  const s = applyField(a, "shape", "straight");
  near(s.pinStraight, a.gap + a.sheetT, 1e-12, "straight = g + t");
  for (const k of ["pinW", "pinH", "taper", "rotation", "travel", "teeth", "holeD", "sheetT", "gap"]) assert.equal(s[k], a[k], k);
  const t2 = applyField(s, "shape", "tapered");
  assert.equal(t2.pinStraight, 0);
});

test("Straight follows later changes to sheet thickness and gap", () => {
  const s = applyField(D0(), "shape", "straight");
  const t2 = applyField(s, "sheetT", 2);
  near(t2.pinStraight, 2.4, 1e-12, "follows thickness");
  const g2 = applyField(t2, "gap", 0.5);
  near(g2.pinStraight, 2.5, 1e-12, "follows gap");
  const tap = applyField(D0(), "sheetT", 2);
  assert.equal(tap.pinStraight, 0, "tapered stays 0");
});

test("Typing a straight section makes the shape custom", () => {
  const b = applyField(applyField(D0(), "shape", "straight"), "pinStraight", 1.0);
  assert.equal(b.shape, "custom");
  const c = applyField(D0(), "pinStraight", 0);
  assert.equal(c.shape, "custom");
});

test("Hub settings change only the hub", () => {
  const a = { ...D0(), hub: "custom" };
  const b = applyField(a, "boltSquare", 20);
  for (const k of Object.keys(a)) if (k !== "boltSquare") assert.deepEqual(b[k], a[k], k);
  const back = applyField(b, "hub", "gobilda");
  assert.equal(back.boltSquare, 16);
});

// ---------------- locks: what moves instead ----------------
const L = require("../state/link.js");
const { defaultDesign: dd } = require("../core/params.js");
const val = (r, k) => L.valueOf(r.design, k);
const close = (a, e, tol, what) => assert.ok(Math.abs(a - e) <= tol, `${what}: got ${a}, expected ${e}`);

test("locks: slide locked, wheel size 60 -> the wheel turns 280.3°", () => {
  const r = L.route(dd(), "drumD", 60, { locks: ["travel"] });
  assert.equal(r.mover, "rotation");
  close(val(r, "rotation"), 280.32, 0.01, "turn");
  assert.equal(r.design.travel, 152.4);
});

test("locks: hole spacing locked, pins 16 -> 24 -> 240°, spacing 9.525", () => {
  const r = L.route(dd(), "teeth", 24, { locks: ["P"] });
  close(val(r, "rotation"), 240, 1e-9, "turn");
  close(val(r, "P"), 9.525, 1e-9, "spacing");
});

test("locks: turn and slide locked fix the wheel; changing it is refused with a plain message", () => {
  const locks = ["rotation", "travel"];
  const r = L.route(dd(), "drumD", 60, { locks });
  assert.equal(r.refused, true);
  assert.deepEqual(Object.keys(L.heldBy(locks)).sort(), ["drumD", "pitchD"]);
  assert.deepEqual(Object.keys(L.heldBy([...locks, "teeth"])).sort(), ["P", "drumD", "pitchD"]);
  const m = L.describeRoute(r, dd(), (k, v) => v.toFixed(1), locks);
  assert.equal(m.text, "Can't change Wheel size. Sheet slides and Wheel turns are both locked. Together they fix the wheel size. Unlock one.");
});

test("locks: pins are never picked to move", () => {
  for (const movers of Object.values(L.MOVERS)) assert.ok(!movers.includes("teeth"));
});

test("locks: tip locked, width 4.4 -> slant 32.4°; height 4.0 -> slant 17.6°", () => {
  close(val(L.route(dd(), "pinW", 4.4, { locks: ["tipD"] }), "taper"), 32.4, 0.05, "width");
  close(val(L.route(dd(), "pinH", 4.0, { locks: ["tipD"] }), "taper"), 17.6, 0.05, "height");
  close(val(L.route(dd(), "pinH", 4.0), "tipD"), -0.53, 0.005, "unlocked: the pin comes to a point");
});

test("chooser: wheel size 60 offers Sheet slides 7.71 in (usual) or Wheel turns 280.3°", () => {
  const r = L.route(dd(), "drumD", 60);
  const fmt = (k, v) => k === "travel" ? (v / 25.4).toFixed(2) + " in" : v.toFixed(1) + "°";
  assert.deepEqual(L.optionLines(r, dd(), fmt).map(o => o.text), ["Sheet slides: 6.00 in → 7.71 in", "Wheel turns: 360.0° → 280.3°"]);
  assert.equal(L.route(dd(), "drumD", 60, { mover: "rotation" }).mover, "rotation");
  assert.deepEqual(L.route(dd(), "drumD", 60, { locks: ["travel"] }).options.map(o => o.mover), ["rotation"], "a locked number is never an option");
});

test("pin options: straight past the sheet, and Straight with the tip kept round", () => {
  let d = L.applyField(dd(), "shape", "straight");
  d = L.applyField(d, "straightPast", 0.5);
  close(d.pinStraight, 2.4, 1e-9, "gap + thickness + 0.5");
  close(L.applyField(d, "sheetT", 2).pinStraight, 2.9, 1e-9, "follows the thickness");
  close(L.applyField(d, "straightPast", -5).pinStraight, 0, 1e-9, "never below 0");
  const r = L.route(dd(), "shape", "straight", { locks: ["tipD"] });
  close(r.design.taper, 68.9, 0.05, "slant"); close(r.design.tipD, 2, 1e-9, "tip");
});
