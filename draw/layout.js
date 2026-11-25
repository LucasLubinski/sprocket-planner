"use strict";
// Layout drawing to scale: wheel, pitch circle, pins (one marked as the index),
// hub screw holes that turn with the wheel, the sheet with its holes, and
// dimensions for shaft-to-sheet, drum, pitch, full travel and distance moved.
const G = require("../core/geometry.js");
const { Sketch, D2R } = require("./svg.js");

const pinPath = (sk, pts) => "M" + pts.map(([x, y]) => sk.P(x, y)).join("L") + "Z";

// Hole k sits at x = k * P (sheet coordinates) when the wheel is at 0°.
// Hole 0 is under the index pin; the holes still to come wait to its left.
function holeRange(d) {
  const a = Math.ceil(d.win / d.P - 1e-9);
  const kMax = Math.ceil(a / 2), kMin = kMax - (d.holes - 1);
  return { kMin, kMax };
}

function sheetPieces(p, d, endPad) {
  const { kMin, kMax } = holeRange(d);
  const h = p.holeD / 2, out = [];
  const x0 = kMin * d.P - h - endPad, x1 = kMax * d.P + h + endPad;
  let prev = x0;
  for (let k = kMin; k <= kMax; k++) { const c = k * d.P; if (c - h > prev) out.push([prev, c - h]); prev = c + h; }
  if (x1 > prev) out.push([prev, x1]);
  return { pieces: out, kMin, kMax, x0, x1 };
}

// A diameter shown as a line through the center with a leader to its label.
function diaDim(sk, r, angDeg, outR, spec) {
  const a = angDeg * D2R, c = Math.cos(a), s = Math.sin(a);
  const d = sk.dim({ kind: "diameter", center: [0, 0], r, angle: angDeg, handle: [r * c, r * s], ...spec });
  sk.open(sk.groupFor(d));
  sk.line(-r * c, -r * s, r * c, r * s, "dl");
  sk.arrow(r * c, r * s, angDeg); sk.arrow(-r * c, -r * s, angDeg + 180);
  const q = [outR * c, outR * s];
  sk.line(r * c, r * s, q[0], q[1], "dl");
  const right = c >= 0, shelf = sk.px(10) * (right ? 1 : -1);
  sk.line(q[0], q[1], q[0] + shelf, q[1], "dl");
  d.labelBox = sk.text(q[0] + shelf + sk.px(3) * (right ? 1 : -1), q[1], spec.label, { anchor: right ? "start" : "end", v: "mid", badge: spec.badge, a: { "data-dim-label": d.id } });
  sk.close();
  return d;
}

function drawWheel(sk, p, d, cls, keyed) {
  const k = name => keyed ? { "data-key": name } : {};
  sk.circle(0, 0, d.r0, (keyed ? "d part " : "") + "drum " + cls, { ...k("drumD"), noGrow: true });
  for (let j = 0; j < p.teeth; j++) {
    const pts = G.pinWorld(p, d, j, 0);
    sk.push('<path class="' + (keyed ? "d part " : "") + "pin" + (j === 0 ? " index" : "") + " " + cls + '" d="' + pinPath(sk, pts) + '"' +
      (keyed ? ' data-key="pinW pinH teeth taper tipD pinStraight"' : "") + ' data-pin="' + j + '"/>');
  }
}

function build(sk, vm) {
  const m = vm.model;
  if (!m.ok) { sk.text(0, 0, "Fix the red boxes to see the drawing.", { v: "mid", cls: "msg" }); sk.grow(-60, -10); sk.grow(60, 10); return; }
  const p = m.p, d = m.d, T = p.travel, fs = sk.fs;
  const top = d.yb + p.sheetT;
  const lane = fs * 1.9;

  // view: the wheel and the full travel
  const left = -d.tipR - sk.px(30) - fs * 2;
  sk.grow(left, -d.tipR - sk.px(6));
  sk.grow(T + Math.max(d.P, 10), top + lane * 2 + sk.px(4));
  if (vm.settings.grid) drawGrid(sk, left, -d.tipR - lane * 2, T + Math.max(d.P, 10), top + lane * 2);

  // ghosts behind everything
  for (const g of vm.ghosts) drawGhost(sk, vm, g);

  // sheet (slides)
  const sp = sheetPieces(p, d, p.endMargin);
  sk.open({ id: "lay-sheet", class: "slide" });
  for (const [a, b] of sp.pieces) sk.rect(a, d.yb, b, top, "d part sheet", { "data-key": "sheetT sheetW sheetLen", noGrow: true });
  for (let k = sp.kMin; k <= sp.kMax; k++) {
    const c = k * d.P;
    sk.rect(c - p.holeD / 2, d.yb, c + p.holeD / 2, top, "d part hole", { "data-key": "holeD P", noGrow: true });
  }
  // the arrow that follows hole 0
  const ah = sk.px(14);
  sk.open({ class: "d follow", "data-key": "travel" });
  sk.line(0, top + sk.px(3) + ah, 0, top + sk.px(3), "follow-line", { noGrow: true });
  sk.arrow(0, top + sk.px(2), -90, "follow-arw", 10);
  sk.close();
  sk.close();

  // pitch circle (does not turn), with a wider invisible ring that is easy to hover
  sk.circle(0, 0, d.Rp, "d part pitch", { "data-key": "pitchD", noGrow: true });
  sk.circle(0, 0, d.Rp, "hit", { "data-key": "pitchD", noGrow: true });

  // wheel (turns)
  sk.open({ id: "lay-wheel", class: "turn" });
  drawWheel(sk, p, d, "wheel", true);
  for (const a of [45, 135, 225, 315]) {
    sk.circle(d.boltR * Math.cos(a * D2R), d.boltR * Math.sin(a * D2R), p.boltHoleD / 2, "d part bolt", { "data-key": "boltSquare boltHoleD", noGrow: true });
  }
  if (p.centerD > 0) sk.circle(0, 0, p.centerD / 2, "d part hole-c", { "data-key": "centerD", noGrow: true });
  if (p.pilot) sk.circle(0, 0, p.pilotD / 2, "d part pilot", { "data-key": "pilotD pilot", noGrow: true });
  sk.close();
  sk.line(-sk.px(6), 0, sk.px(6), 0, "cmark", { noGrow: true }); sk.line(0, -sk.px(6), 0, sk.px(6), "cmark", { noGrow: true });

  // turn arrow under the wheel
  {
    const r = d.tipR + sk.px(8);
    const dd = sk.dim({ kind: "angle", key: "rotation", level: "key", c: [0, 0], r, editable: true });
    sk.open(sk.groupFor(dd));
    sk.arc(0, 0, r, 292, 248, "dl turnarc", { noGrow: false });
    sk.arrow(r * Math.cos(248 * D2R), r * Math.sin(248 * D2R), 248 - 90, "arw", 9);
    dd.labelBox = sk.text(0, -r - sk.px(4), vm.word("turns", "turn") + " " + vm.num("rotation") + "°", { v: "top", badge: vm.badge("rotation"), a: { "data-dim-label": dd.id } });
    sk.close();
  }

  // diameters
  const outR = d.tipR + sk.px(14);
  diaDim(sk, d.r0, 205, outR, { key: "drumD", level: "key", label: vm.word("wheel", "drum") + " Ø" + vm.num("drumD"), badge: vm.badge("drumD"),
    editable: true, value: d.drumD, drag: { type: "radial", center: [0, 0], factor: 2 }, step: 0.1, bigStep: 1 });
  diaDim(sk, d.Rp, 335, outR, { key: "pitchD", level: "key", label: vm.word("push circle", "pitch") + " Ø" + vm.num("pitchD"), badge: vm.badge("pitchD"),
    editable: true, value: d.pitchD, drag: { type: "radial", center: [0, 0], factor: 2 }, step: 0.1, bigStep: 1 });

  // shaft to sheet underside
  sk.line(0, 0, -d.tipR, 0, "cline", { noGrow: true });
  sk.linear([-d.tipR, 0], [-d.tipR, d.yb], [-sk.px(16), 0], { key: "yb", level: "all", label: vm.word("shaft to sheet", "axis to sheet") + " " + vm.num("yb"), badge: vm.badge("yb"),
    editable: true, show: "yb", set: { key: "pitchD", from: (v, p) => 2 * v + p.sheetT } });

  // full travel and distance moved so far
  const travelLabel = vm.word("slides", "travel") + " " + vm.num("travel") + " mm (" + vm.num("travelIn") + " in)";
  sk.linear([0, top], [T, top], [0, lane * 1.0 + sk.px(4)], { key: "travel", level: "key", label: travelLabel, badge: vm.badge(vm.settings.units === "in" ? "travelIn" : "travel"),
    editable: true, value: T, drag: { type: "axis", origin: [0, 0], axis: [1, 0], factor: 1 }, handle: [T, top + lane + sk.px(4)], step: 1, bigStep: 10 });
  sk.open({ id: "lay-moved" });
  sk.close();
  // room for the "moved" label that the animation draws
  sk.grow(0, top + lane * 2 + sk.px(8) + fs * 1.1);
}

function drawGrid(sk, x0, y0, x1, y1) {
  const parts = [];
  for (let x = Math.ceil(x0); x <= x1; x++) parts.push("M" + sk.P(x, y0) + "L" + sk.P(x, y1));
  for (let y = Math.ceil(y0); y <= y1; y++) parts.push("M" + sk.P(x0, y) + "L" + sk.P(x1, y));
  const major = [];
  for (let x = Math.ceil(x0 / 5) * 5; x <= x1; x += 5) major.push("M" + sk.P(x, y0) + "L" + sk.P(x, y1));
  for (let y = Math.ceil(y0 / 5) * 5; y <= y1; y += 5) major.push("M" + sk.P(x0, y) + "L" + sk.P(x1, y));
  if (sk.s >= 2.5) sk.push('<path class="grid" d="' + parts.join("") + '"/>');
  sk.push('<path class="grid major" d="' + major.join("") + '"/>');
}

function ghostShift(vm, g) {
  return vm.settings.lineUp === "sheets" ? vm.model.d.yb - g.m.d.yb : 0;
}

function drawGhost(sk, vm, g) {
  if (!g.m.ok) return;
  const gp = g.m.p, gd = g.m.d, dy = ghostShift(vm, g);
  sk.open({ class: "ghost " + g.cls, transform: dy ? "translate(0 " + (-dy) + ")" : undefined });
  sk.open({ class: "turn ghost-turn" });
  sk.circle(0, 0, gd.r0, "gl", { noGrow: true });
  for (let j = 0; j < gp.teeth; j++) sk.push('<path class="gl" d="' + pinPath(sk, G.pinWorld(gp, gd, j, 0)) + '"/>');
  sk.close();
  sk.circle(0, 0, gd.Rp, "gl gpitch", { noGrow: true });
  sk.line(-gd.tipR - 6, gd.yb, gp.travel + 6, gd.yb, "gl gsheet", { noGrow: true });
  const a = 150 * D2R;
  sk.text(gd.r0 * Math.cos(a) - sk.px(4), gd.r0 * Math.sin(a), g.label, { anchor: "end", v: "mid", cls: "glbl", px: 13 });
  sk.close();
}

// Turn the wheel to `theta` degrees and slide the sheet to match.
function animate(svg, vm, theta, sk) {
  const m = vm.model;
  if (!m.ok || !svg) return;
  const d = m.d, dir = sk.dir;
  const slide = d.Rp * theta * D2R;
  const wheel = svg.querySelector("#lay-wheel");
  if (wheel) wheel.setAttribute("transform", "rotate(" + (dir * theta).toFixed(3) + ")");
  for (const gw of svg.querySelectorAll(".ghost-turn")) gw.setAttribute("transform", "rotate(" + (dir * theta).toFixed(3) + ")");
  const sheet = svg.querySelector("#lay-sheet");
  if (sheet) sheet.setAttribute("transform", "translate(" + (dir * slide).toFixed(3) + " 0)");
  const moved = svg.querySelector("#lay-moved");
  if (moved) {
    const sub = new Sketch({ scale: sk.s, dir, fontPx: sk.fontPx, id: "lay-m" });
    const top = d.yb + m.p.sheetT, lane = sk.fs * 1.9;
    if (slide > sk.px(1)) {
      sub.linear([0, top], [slide, top], [0, lane * 2 + sk.px(4)], {
        key: "travel", level: "key", ext: false,
        label: vm.word("moved", "moved so far") + " " + vm.fmtLen(slide) + " (" + vm.fmtIn(slide) + ")",
        anchor: slide < sk.px(160) ? "start" : "middle", shift: slide < sk.px(160) ? -slide / 2 : 0
      });
    } else {
      sub.open({ class: "d dim lvl-key", "data-key": "travel" });
      sub.text(0, top + lane * 2 + sk.px(6), vm.word("moved", "moved so far") + " 0", { anchor: "start", v: "bottom" });
      sub.close();
    }
    moved.innerHTML = sub.out.join("");
    if (vm.onAnimated) vm.onAnimated(moved);
  }
}

module.exports = { id: "layout", build, animate, holeRange, sheetPieces, drawWheel, pinPath, fitOpts: () => ({ maxHeightPx: 520 }) };
