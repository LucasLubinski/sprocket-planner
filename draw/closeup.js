"use strict";
// Close-up where the pins meet the sheet: the closest gap between any pin and
// any hole edge, with its value. The closest pin turns amber under 0.1 mm and
// red when it hits. Hole-spacing dimension on the nearest two holes.
const G = require("../core/geometry.js");
const L = require("./layout.js");
const { Sketch, D2R, n, textWidth } = require("./svg.js");

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
  // Labels live in two lanes outside the frame so they never cover a pin or a
  // hole: the sheet note and hole spacing above, the wheel note and squeeze
  // room below. The notes sit at the left end of each lane.
  const ln = lanes(sk, v, vm);
  sk.text(v.x0 + sk.px(2), ln.topText, ln.sheetNote, { anchor: "start", v: "bottom", cls: "note", px: 13 });
  sk.text(v.x0 + sk.px(2), ln.botText, ln.wheelNote, { anchor: "start", v: "top", cls: "note", px: 13 });
  // dynamic: squeeze-room line and the hole-spacing dimension
  sk.open({ id: "cu-gap" }); sk.close();
  sk.open({ id: "cu-pitch" }); sk.close();
  // room for the lanes
  sk.grow(v.x0, ln.topText + sk.fs * 1.15);
  sk.grow(v.x0, ln.botText - sk.fs * 1.2);
}

// Lane positions (world mm) and the free span (left edge) for dynamic labels.
function lanes(sk, v, vm) {
  const sheetNote = vm.word("sheet", "sheet (side view)"), wheelNote = vm.word("wheel", "drum");
  const topLine = v.y1 + sk.px(10);
  return {
    sheetNote, wheelNote, topLine,
    topText: topLine + sk.px(5),
    botText: v.y0 - sk.px(6),
    topFree: v.x0 + sk.px(2) + textWidth(sheetNote, 13) / sk.s + sk.px(12),
    botFree: v.x0 + sk.px(2) + textWidth(wheelNote, 13) / sk.s + sk.px(12)
  };
}

// Center for a label of width w (mm) near cx, kept inside [lo, hi].
function clampCenter(cx, w, lo, hi) {
  if (hi - lo <= w) return (lo + hi) / 2;
  return Math.max(lo + w / 2, Math.min(hi - w / 2, cx));
}

function labelW(sk, str, badge) {
  return (textWidth(str, sk.fontPx) + (badge ? textWidth(" " + badge.text, sk.fontPx * 0.93, true) : 0)) / sk.s;
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
  const none = !(g.d < 1e8); // holes run together: no plastic to measure against
  const state = none || g.d <= 0 ? "hit" : g.d < 0.1 ? "near" : "ok";
  if (pinEl) { pinEl.classList.add("closest"); if (state !== "ok") pinEl.classList.add(state); }

  const sub = new Sketch({ scale: sk.s, dir, fontPx: sk.fontPx, id: "cu-g" });
  const ln = lanes(sk, v, vm);
  const label = none ? "holes overlap: no plastic left" : (g.d <= 0 ? vm.word("hits! overlap ", "binding: overlap ") + vm.fmt("tight", -g.d) : vm.word("squeeze room ", "clearance ") + vm.fmt("tight", g.d)) + " mm";
  // The squeeze-room label stays put in the lane under the frame (it doesn't
  // jump around while the wheel turns); a leader runs to the gap.
  const lw = labelW(sub, label), lx = clampCenter(0, lw, ln.botFree, v.x1);
  sub.open({ class: "d dim lvl-key gapline " + state, "data-key": "tight play pinW holeD" });
  if (g.p && g.q && g.d > 0) {
    sub.line(g.p[0], g.p[1], g.q[0], g.q[1], "gap-l");
    sub.circle(g.p[0], g.p[1], sub.px(2.5), "gap-dot"); sub.circle(g.q[0], g.q[1], sub.px(2.5), "gap-dot");
    const mx = (g.p[0] + g.q[0]) / 2, my = (g.p[1] + g.q[1]) / 2;
    const ex = Math.max(lx - lw / 2 + sub.px(6), Math.min(lx + lw / 2 - sub.px(6), mx));
    sub.line(mx, my, ex, ln.botText + sub.px(2), "dl");
  }
  sub.text(lx, ln.botText, label, { anchor: "middle", v: "top", cls: "gap-t" });
  sub.close();
  const gapEl = svg.querySelector("#cu-gap");
  if (gapEl) gapEl.innerHTML = sub.out.join("");

  // hole spacing on the two holes nearest the middle
  const sub2 = new Sketch({ scale: sk.s, dir, fontPx: sk.fontPx, id: "cu-p" });
  let k = Math.floor(-slide / d.P - 0.5);
  let c0 = k * d.P + slide;
  if (c0 < v.x0 + 0.5) { k++; c0 += d.P; }
  if (c0 + d.P <= v.x1 - 0.5) {
    // Drawn in the lane above the frame; extension lines start above the pin tips.
    const plabel = vm.word("hole spacing ", "pitch ") + vm.num("P"), pbadge = vm.badge("P");
    const from = Math.min(v.y1, Math.max(d.yb + p.sheetT, d.tipR)) + sub2.px(3);
    const cx = c0 + d.P / 2, lc = clampCenter(cx, labelW(sub2, plabel, pbadge), ln.topFree, v.x1);
    sub2.linear([c0, from], [c0 + d.P, from], [0, ln.topLine - from], {
      key: "P", level: "key", label: plabel, badge: pbadge, shift: lc - cx
    });
  }
  const pEl = svg.querySelector("#cu-pitch");
  if (pEl) pEl.innerHTML = sub2.out.join("");
  if (vm.onAnimated) { vm.onAnimated(gapEl); vm.onAnimated(pEl); }
  return g;
}

module.exports = { id: "closeup", build, animate, fitOpts: () => ({ maxHeightPx: 360 }) };
