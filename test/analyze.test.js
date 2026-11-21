"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { analyze } = require("../core/analyze.js");
const { defaultDesign } = require("../core/params.js");

const near = (a, e, tol, what) => assert.ok(Math.abs(a - e) <= tol, `${what}: got ${a}, expected ${e}`);
const ids = m => m.checks.map(c => c.id);

test("default design: only the 5-turn servo warning, everything else fits", () => {
  const m = analyze(defaultDesign());
  assert.ok(m.ok);
  assert.deepEqual(ids(m), ["servo"]);
  assert.equal(m.checks[0].level, "warn");
  near(m.v.hubMinD, 31.13, 0.005, "smallest wheel for the hub");
  assert.equal(m.v.screwL, 10);
});

test("hub: bolt square 16 -> 20 mm raises the smallest drum to 36.78 mm", () => {
  const m = analyze({ ...defaultDesign(), hub: "custom", boltSquare: 20 });
  near(m.v.hubMinD, 36.78, 0.005, "smallest drum");
});

test("hub: 14 mm center hole triggers the pilot-ring warning", () => {
  const m = analyze({ ...defaultDesign(), hub: "custom", centerD: 14 });
  assert.ok(ids(m).includes("hubPilotCenter"));
  assert.ok(!ids(m).includes("hubCenter"), "bolt holes still clear the center hole");
});

test("hub: other checks", () => {
  const base = { ...defaultDesign(), hub: "custom" };
  assert.ok(ids(analyze({ ...base, centerD: 17 })).includes("hubCenter"));
  assert.ok(ids(analyze({ ...base, pilotD: 19 })).includes("hubPilot"));
  assert.ok(ids(analyze({ ...base, counterbore: 4.5 })).includes("hubCounterbore"));
  assert.ok(ids(analyze({ ...base, drumW: 2.5 })).includes("hubFlat"));
  assert.ok(ids(analyze({ ...base, drumW: 30 })).includes("hubScrew"));
  assert.equal(analyze({ ...base, counterbore: 2 }).v.screwL, 8);
});

test("tiny wheel: hub screws don't fit", () => {
  const m = analyze({ ...defaultDesign(), travel: 76.2, teeth: 8 });
  assert.ok(ids(m).includes("hub"));
  assert.equal(m.chips.find(c => c.id === "hub").level, "stop");
});

test("24 pins: thin plastic warning, amber zone", () => {
  const m = analyze({ ...defaultDesign(), teeth: 24 });
  near(m.v.web, 1.85, 1e-9, "web");
  assert.equal(m.zones.web, "amber");
  assert.equal(m.checks.find(c => c.id === "web").level, "warn");
});

test("wide pin binds: squeeze room red", () => {
  const m = analyze({ ...defaultDesign(), pinW: 4.8 });
  assert.equal(m.zones.tight, "red");
  assert.ok(m.checks.some(c => c.id === "fit" && c.level === "stop"));
});

test("servo range", () => {
  assert.equal(analyze({ ...defaultDesign(), rotation: 300, travel: 127 }).servo, "standard");
  assert.equal(analyze(defaultDesign()).servo, "5-turn");
  const m = analyze({ ...defaultDesign(), rotation: 2000, travel: 846.7 });
  assert.equal(m.servo, "continuous");
  assert.equal(m.checks.find(c => c.id === "servo").level, "stop");
});

test("invalid numbers stop the analysis with plain messages", () => {
  const m = analyze({ ...defaultDesign(), teeth: 2.5, sheetT: 0 });
  assert.equal(m.ok, false);
  assert.ok(m.errors.some(e => /whole number/.test(e)));
  assert.ok(m.errors.some(e => /Sheet thickness/.test(e)));
});

test("pointed pin still analyzes and warns", () => {
  const m = analyze({ ...defaultDesign(), taper: 40, tipD: -0.78 });
  assert.ok(m.ok);
  assert.ok(m.checks.some(c => c.id === "tip" && /point/.test(c.text)));
});

test("sheet file numbers: length, width, row offset, track", () => {
  const m = analyze(defaultDesign());
  near(m.v.sheetLen, 19 * 9.525 + 4.5 + 30, 1e-9, "auto length");
  near(m.v.rowOffset, 20, 1e-12, "centered row");
  near(m.v.slotH, 1.8, 1e-12, "slot height");
  near(m.v.slotW, 41, 1e-12, "slot width");
  near(m.v.yb, 23.5052, 0.0001, "shaft to sheet underside");
});

test("40 pins: holes run together, so there is no squeeze room to measure", () => {
  const m = analyze({ ...defaultDesign(), teeth: 40 });
  assert.ok(m.ok);
  assert.ok(m.v.web < 0, "hole spacing 3.81 is under the 4.5 mm hole");
  assert.ok(Number.isNaN(m.v.tight), "no 1e9 stand-in value");
  assert.ok(m.trace.every(([, g]) => Number.isNaN(g)));
  assert.equal(m.zones.tight, "red");
  assert.equal(m.checks.find(c => c.id === "web").title, "Holes run together");
  assert.equal(m.chips.find(c => c.id === "fit").level, "stop");
});
