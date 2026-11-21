"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const T = require("../core/taper.js");
const G = require("../core/geometry.js");
const { defaultDesign } = require("../core/params.js");

const near = (a, e, tol, what) => assert.ok(Math.abs(a - e) <= tol, `${what}: got ${a}, expected ${e}`);

test("default tapered pin is about 28.4 degrees", () => {
  near(T.taperFromTip(4, 0, 2.6, 2).deg, 28.4, 0.05, "default");
  near(defaultDesign().taper, 28.36, 0.01, "default design taper");
});

test("straight 4.0 pin tapers about 51.8 degrees above its straight section", () => {
  near(T.taperFromTip(4, 1.9, 3.2, 2).deg, 51.8, 0.05, "straight");
});

test("20 degrees gives a 3.01 mm tip, and 3.01 mm gives back 20.0 degrees", () => {
  const tip = T.tipFromTaper(4, 0, 2.6, 20);
  assert.ok(tip.ok);
  assert.equal(tip.tipD.toFixed(2), "3.01");
  assert.equal(T.taperFromTip(4, 0, 2.6, 3.01).deg.toFixed(1), "20.0");
});

test("formula and tangent-point route agree (round trip)", () => {
  for (const [w, s, H] of [[4, 0, 2.6], [4, 1.9, 3.2], [4.5, 0, 2.6], [3, 0.5, 4], [6, 1, 5]]) {
    const lo = Math.max(T.minTaper(w, s, H), 0) + 0.5, hi = T.maxTaper(w, s, H) - 0.5;
    for (let deg = lo; deg < hi; deg += 1.7) {
      const tip = T.tipFromTaper(w, s, H, deg);
      assert.ok(tip.ok, `tip for ${deg} on ${w}/${s}/${H}`);
      near(T.taperFromTip(w, s, H, tip.tipD).deg, deg, 1e-7, `round trip ${deg} on ${w}/${s}/${H}`);
    }
  }
});

test("the angle matches the real side of the hull (same as OpenSCAD pin_w_at)", () => {
  const p = { ...defaultDesign(), tipD: 3.0096 };
  const loc = G.pinLocal(p);
  // Above the straight section the width shrinks by 2 tan(alpha) per mm of height.
  const w1 = G.widthAt(loc, 0.2), w2 = G.widthAt(loc, 0.6);
  const alpha = Math.atan((w1 - w2) / 2 / 0.4) * 180 / Math.PI;
  near(alpha, 20, 0.05, "hull side angle");
});

test("0 degrees means straight sides with a fully round end", () => {
  const tip = T.tipFromTaper(4, 0, 2.6, 0);
  assert.ok(tip.ok); near(tip.tipD, 4, 1e-12, "tip");
  near(T.taperFromTip(4, 0, 2.6, 4).deg, 0, 1e-9, "angle");
});

test("too steep: the pin comes to a point (b <= 0)", () => {
  const r = T.tipFromTaper(4, 0, 2.6, 40);
  assert.equal(r.ok, false); assert.equal(r.reason, "pointed");
  assert.ok(r.tipD <= 0);
  near(r.maxDeg, 37.57, 0.01, "steepest round-tip angle");
});

test("tip too big for the angle, or wider than the pin", () => {
  // Straight section 1.9 on a 2.6 mm pin at the default 28.4 degrees.
  assert.equal(T.tipFromTaper(4, 1.9, 2.6, 28.36).reason, "tooBig");
  assert.equal(T.taperFromTip(4, 0, 2.6, 4.5).reason, "tooBig");
  near(T.minTaper(4, 1.9, 3.2), 38.58, 0.01, "smallest angle for the straight pin");
  assert.equal(T.minTaper(4, 0, 2.6), 0);
});
