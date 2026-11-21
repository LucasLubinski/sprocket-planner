"use strict";
// The handed-out file: self-contained (no network at all), and fast enough.
const test = require("node:test");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const path = require("node:path");
const { analyze } = require("../core/analyze.js");
const { defaultDesign } = require("../core/params.js");

test("planner.html loads nothing from other sites and forbids network calls", async () => {
  const { build } = await import(pathToFileURL(path.join(__dirname, "..", "tools", "build.mjs")).href);
  const { html, bytes } = build({ write: false });
  assert.doesNotMatch(html, /<(script|link|img|iframe)[^>]+(src|href)\s*=\s*["']?(https?:)?\/\//i, "no outside scripts, styles or images");
  assert.doesNotMatch(html, /url\(\s*["']?(https?:)?\/\//i, "no outside fonts or images in CSS");
  assert.doesNotMatch(html, /\bimport\s*\(|fetch\s*\(\s*["'`]http/i, "no dynamic imports or web requests");
  assert.match(html, /<meta[^>]+Content-Security-Policy[^>]+connect-src 'none'/i, "the browser blocks any network call");
  assert.ok(bytes < 2e6, "small enough to email: " + bytes + " bytes");
});

test("one edit (the design plus both sheet-height sweeps) takes under 60 ms", () => {
  for (const teeth of [16, 40]) {
    const d = { ...defaultDesign(), teeth };
    analyze(d); // warm up
    const times = [];
    for (let i = 0; i < 5; i++) { const t0 = performance.now(); analyze({ ...d, rotation: 360 + i }); times.push(performance.now() - t0); }
    times.sort((a, b) => a - b);
    assert.ok(times[2] < 60, teeth + " pins: median " + times[2].toFixed(1) + " ms");
  }
});
