"use strict";
// Close-up where the pins meet the sheet: the closest gap between any pin and
// any hole edge, with its value. The closest pin turns amber under 0.1 mm and
// red when it hits. Hole-spacing dimension on the nearest two holes.
const G = require("../core/geometry.js");
const L = require("./layout.js");
const { Sketch, D2R, n } = require("./svg.js");

function view(m) {
  const d = m.d, p = m.p;
  const W = Math.max(12, Math.min(2.4 * d.P, 50));
  return { x0: -W / 2, x1: W / 2, y0: d.r0 - 2.2, y1: d.yb + p.sheetT + 2.2 };
}

function build(sk, vm) {
  const m = vm.model;
  if (!m.ok) { sk.text(0, 0, "Fix the red boxes to see the close-up.", { v: "mid", cls: "msg" }); sk.grow(-40, -6); sk.grow(40, 6); return; }
  const p = m.p, d = m.d, v = view(m);
  sk.grow(v.x0, v.y0); sk.grow(v.x1, v.y1);
  const X0 = Math.min(sk.X(v.x0), sk.X(v.x1)), Wc = Math.abs(sk.X(v.x1) - sk.X(v.x0));
  sk.push('<defs><clipPath id="cu-clip"><rect x="' + n(X0) + '" y="' + n(sk.Y(v.y1)) + '" width="' + n(Wc) + '" height="' + n(v.y1 - v.y0) + '"/></clipPath></defs>');
  sk.open({ "clip-path": "url(#cu-clip)" });
  for (const g of vm.ghosts) {
    if (!g.m.ok) continue;
    const dy = vm.settings.lineUp === "sheets" ? d.yb - g.m.d.yb : 0;
    sk.open({ class: "ghost " + g.cls, transform: dy ? "translate(0 " + n(-dy) + ")" : undefined });
    sk.open({ class: "turn ghost-turn" });
    sk.circle(0, 0, g.m.d.r0, "gl", { noGrow: true });
    for (let j = 0; j < g.m.p.teeth; j++) sk.push('<path class="gl" d="' + L.pinPath(sk, G.pinWorld(g.m.p, g.m.d, j, 0)) + '"/>');
    sk.close();
    sk.line(v.x0 - 1, g.m.d.yb, v.x1 + 1, g.m.d.yb, "gl gsheet", { noGrow: true });
    sk.close();
  }
  if (vm.settings.grid) {
    const parts = [];
    for (let x = Math.ceil(v.x0); x <= v.x1; x++) parts.push("M" + sk.P(x, v.y0) + "L" + sk.P(x, v.y1));
    for (let y = Math.ceil(v.y0); y <= v.y1; y++) parts.push("M" + sk.P(v.x0, y) + "L" + sk.P(v.x1, y));
    sk.push('<path class="grid" d="' + parts.join("") + '"/>');
  }
  const sp = L.sheetPieces(p, d, Math.max(p.endMargin, 3 * d.P));
  sk.open({ id: "cu-sheet", class: "slide" });
  for (const [a, b] of sp.pieces) sk.rect(a, d.yb, b, d.yb + p.sheetT, "d part sheet", { "data-key": "sheetT", noGrow: true });
  for (let k = sp.kMin; k <= sp.kMax; k++) {
    const c = k * d.P;
    sk.rect(c - p.holeD / 2, d.yb, c + p.holeD / 2, d.yb + p.sheetT, "d part hole", { "data-key": "holeD", noGrow: true });
  }
  sk.close();
  sk.line(v.x0 - 1, d.yb + p.sheetT / 2, v.x1 + 1, d.yb + p.sheetT / 2, "d part pitchline", { "data-key": "pitchD", noGrow: true });
  sk.circle(0, 0, d.Rp, "d part pitch", { "data-key": "pitchD", noGrow: true });
  sk.open({ id: "cu-wheel", class: "turn" });
  L.drawWheel(sk, p, d, "wheel", true);
  sk.close();
  sk.close();
  sk.rect(v.x0, v.y0, v.x1, v.y1, "frame", { noGrow: true });
  // labels that stay put
  sk.text(v.x0 + sk.px(6), d.yb + p.sheetT + sk.px(6), vm.word("sheet", "sheet (side view)"), { anchor: "start", v: "bottom", cls: "note", px: 13 });
  sk.text(v.x0 + sk.px(6), v.y0 + sk.px(6), vm.word("wheel", "drum"), { anchor: "start", v: "bottom", cls: "note", px: 13 });
  // dynamic: squeeze-room line and the hole-spacing dimension
  sk.open({ id: "cu-gap" }); sk.close();
  sk.open({ id: "cu-pitch" }); sk.close();
  // room for the dynamic labels
  sk.grow(v.x0, v.y1 + sk.fs * 2.4);
  sk.grow(v.x0, v.y0 - sk.fs * 1.6);
}

function animate(svg, vm, theta, sk) {
  const m = vm.model;
  if (!m.ok || !svg) return;
  const p = m.p, d = m.d, dir = sk.dir, v = view(m);
  const slide = d.Rp * theta * D2R;
  const wheel = svg.querySelector("#cu-wheel");
  if (wheel) wheel.setAttribute("transform", "rotate(" + (dir * theta).toFixed(3) + ")");
  for (const gw of svg.querySelectorAll(".ghost-turn")) gw.setAttribute("transform", "rotate(" + (dir * theta).toFixed(3) + ")");
  const sheet = svg.querySelector("#cu-sheet");
  if (sheet) sheet.setAttribute("transform", "translate(" + (dir * slide).toFixed(3) + " 0)");

  const g = G.minGap(p, d, theta);
  for (const el of svg.querySelectorAll("#cu-wheel .pin")) el.classList.remove("near", "hit", "closest");
  const pinEl = g.j !== undefined ? svg.querySelector('#cu-wheel .pin[data-pin="' + g.j + '"]') : null;
  const state = g.d <= 0 ? "hit" : g.d < 0.1 ? "near" : "ok";
  if (pinEl) { pinEl.classList.add("closest"); if (state !== "ok") pinEl.classList.add(state); }

  const sub = new Sketch({ scale: sk.s, dir, fontPx: sk.fontPx, id: "cu-g" });
  const top = d.yb + p.sheetT;
  const label = (g.d <= 0 ? vm.word("hits! overlap ", "binding: overlap ") + vm.fmt("tight", -g.d) : vm.word("squeeze room ", "clearance ") + vm.fmt("tight", g.d)) + " mm";
  sub.open({ class: "d dim lvl-key gapline " + state, "data-key": "tight play pinW holeD" });
  if (g.p && g.q && g.d > 0) {
    sub.line(g.p[0], g.p[1], g.q[0], g.q[1], "gap-l");
    sub.circle(g.p[0], g.p[1], sub.px(2.5), "gap-dot"); sub.circle(g.q[0], g.q[1], sub.px(2.5), "gap-dot");
    const mx = (g.p[0] + g.q[0]) / 2, my = (g.p[1] + g.q[1]) / 2;
    const lx = Math.max(v.x0 + sub.px(4), Math.min(v.x1 - sub.px(4), mx));
    sub.line(mx, my, lx, top + sub.fs * 1.4, "dl");
    sub.text(lx, top + sub.fs * 1.5, label, { anchor: lx > 0 ? "end" : "start", v: "bottom", cls: "gap-t" });
  } else {
    const pts = g.j !== undefined ? G.pinWorld(p, d, g.j, theta) : [[0, top]];
    let tip = pts[0]; for (const q of pts) if (q[1] > tip[1]) tip = q;
    sub.text(Math.max(v.x0, Math.min(v.x1, tip[0])), top + sub.fs * 1.5, label, { anchor: "middle", v: "bottom", cls: "gap-t" });
  }
  sub.close();
  const gapEl = svg.querySelector("#cu-gap");
  if (gapEl) gapEl.innerHTML = sub.out.join("");

  // hole spacing on the two holes nearest the middle
  const sub2 = new Sketch({ scale: sk.s, dir, fontPx: sk.fontPx, id: "cu-p" });
  let k = Math.floor(-slide / d.P - 0.5);
  let c0 = k * d.P + slide;
  if (c0 < v.x0 + 0.5) { k++; c0 += d.P; }
  if (c0 + d.P <= v.x1 - 0.5) {
    sub2.linear([c0, v.y0 + 0.1], [c0 + d.P, v.y0 + 0.1], [0, 0.0001], {
      key: "P", level: "key", ext: false, label: vm.word("hole spacing ", "pitch ") + vm.num("P"), badge: vm.badge("P")
    });
  }
  const pEl = svg.querySelector("#cu-pitch");
  if (pEl) pEl.innerHTML = sub2.out.join("");
  if (vm.onAnimated) { vm.onAnimated(gapEl); vm.onAnimated(pEl); }
  return g;
}

module.exports = { id: "closeup", build, animate, fitOpts: () => ({ maxHeightPx: 360 }) };
