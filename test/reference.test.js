"use strict";
// The numbers in CLAUDE.md (Clearance simulation section) must come out of the
// new core exactly as they came out of reference/core.js.
const test = require("node:test");
const assert = require("node:assert/strict");
const G = require("../core/geometry.js");
const R = require("../reference/core.js");
const { defaultDesign } = require("../core/params.js");
const { analyze } = require("../core/analyze.js");

const near = (actual, expected, tol, what) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${what}: got ${actual}, expected ${expected} +-${tol}`);

// Values the brief gives to 3 decimals are checked to +-0.002 mm. Values it gives
// to 2 decimals (the sheet-height play column, "+-0.14") are checked at 2 decimals.
const tolFor = s => (s.split(".")[1] || "").length >= 3 ? 0.002 : 0.005;

function run(over, lib = G, n = 240) {
  const p = { ...defaultDesign(), ...over };
  const d = lib.derive(p);
  const tr = lib.trace(p, d, n);
  return { p, d, tight: Math.min(...tr.map(x => x[1])), tr };
}

const TABLE = [
  ["Tapered 4.0", { pinW: 4.0, pinStraight: 0, pinH: 2.6 }, "0.466", "0.285"],
  ["Straight 4.0", { pinW: 4.0, pinStraight: 1.9, pinH: 3.2 }, "0.250", "0.118"],
  ["Straight 4.2", { pinW: 4.2, pinStraight: 1.9, pinH: 3.2 }, "0.150", "0.018"],
  ["Tapered 4.5", { pinW: 4.5, pinStraight: 0, pinH: 2.6 }, "0.263", "0.093"],
  ["Tapered 4.8", { pinW: 4.8, pinStraight: 0, pinH: 2.6 }, "0.14", "-0.014"]
];

test("clearance table: play per side and tightest clearance", () => {
  for (const [name, over, play, tight] of TABLE) {
    const r = run(over);
    near(r.d.play, +play, tolFor(play), name + " play");
    near(r.tight, +tight, tolFor(tight), name + " tightest");
  }
  assert.ok(run({ pinW: 4.8 }).tight < 0, "Tapered 4.8 binds");
});

test("default design: 20 holes and a 193 mm drill guide", () => {
  const { d } = run({});
  assert.equal(d.holes, 20);
  assert.equal(Math.round(d.guideLen), 193);
  near(d.P, 9.525, 1e-9, "hole spacing");
});

test("152.4 / 9.525 counts as 16 hole spaces, not 17", () => {
  const { d } = run({});
  assert.equal(Math.ceil(152.4 / d.P - 1e-9), 16);
});

test("24 pins: 6.35 mm spacing, 29 holes, tightest 0.285", () => {
  const r = run({ teeth: 24 });
  near(r.d.P, 6.35, 1e-9, "spacing");
  assert.equal(r.d.holes, 29);
  near(r.tight, 0.285, 0.002, "tightest");
});

test("180 degrees for 6 in: 19.05 mm spacing, drum 94.72, 11 holes, tightest 0.346", () => {
  const r = run({ rotation: 180 });
  near(r.d.P, 19.05, 1e-9, "spacing");
  near(r.d.drumD, 94.72, 0.005, "drum diameter");
  assert.equal(r.d.holes, 11);
  near(r.tight, 0.346, 0.002, "tightest");
});

test("sheet-height table: gap 0.2 / 0.4 / 0.6 mm", () => {
  const rows = [
    [0.2, ["0.13", "-0.017"], ["0.25", "0.118"]],
    [0.4, ["0.26", "0.093"], ["0.25", "0.118"]],
    [0.6, ["0.39", "0.203"], ["0.25", "0.118"]]
  ];
  for (const [gap, [tp, tt], [sp, st]] of rows) {
    const t = run({ pinW: 4.5, gap });
    near(t.d.play, +tp, tolFor(tp), `tapered 4.5 play at ${gap}`);
    near(t.tight, +tt, tolFor(tt), `tapered 4.5 tightest at ${gap}`);
    const s = run({ pinW: 4.0, pinStraight: 1.9, pinH: 3.2, gap });
    near(s.d.play, +sp, tolFor(sp), `straight 4.0 play at ${gap}`);
    near(s.tight, +st, tolFor(st), `straight 4.0 tightest at ${gap}`);
  }
  assert.ok(run({ pinW: 4.5, gap: 0.2 }).tight < 0, "tapered 4.5 binds at 0.2");
});

test("analyze() reruns the sweep 0.2 mm lower and higher", () => {
  const m = analyze({ ...defaultDesign(), pinW: 4.5 });
  near(m.v.loTight, -0.017, 0.002, "lower");
  near(m.v.hiTight, 0.203, 0.002, "higher");
  near(m.v.loGap, 0.2, 1e-12, "lower gap"); near(m.v.hiGap, 0.6, 1e-12, "higher gap");
  assert.ok(m.checks.some(c => c.id === "height"), "sheet-height warning");
});

test("faster clearance routine gives the reference numbers", () => {
  const designs = [{}, { teeth: 24 }, { rotation: 180 }, { pinW: 4.8 }, { pinW: 4.0, pinStraight: 1.9, pinH: 3.2 }, { teeth: 9, rotation: 270, travel: 101.6 }];
  for (const over of designs) {
    const a = run(over, G, 60), b = run(over, R, 60);
    for (let i = 0; i < a.tr.length; i++) near(a.tr[i][1], b.tr[i][1], 1e-9, JSON.stringify(over) + " sample " + i);
  }
});

test("derive() matches the reference for the goBILDA hub", () => {
  const p = defaultDesign();
  const a = G.derive(p), b = R.derive(p);
  for (const k of Object.keys(b)) {
    if (k === "loc") continue;
    near(a[k], b[k], 1e-12, k);
  }
  near(G.hubMinR(p), R.HUB_MIN_R, 1e-12, "hub min radius");
});

test("one edit (current design plus two sheet-height sweeps) runs under 60 ms", () => {
  analyze(defaultDesign()); // warm up
  const times = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    analyze({ ...defaultDesign(), rotation: 300 + i });
    times.push(performance.now() - t0);
  }
  times.sort((x, y) => x - y);
  assert.ok(times[2] < 60, "median " + times[2].toFixed(1) + " ms");
});
