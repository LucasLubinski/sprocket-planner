"use strict";
// Slide ruler in inches: the sheet drawn as a bar with its holes at true
// spacing, so more pins visibly puts the holes closer together. Bars for the
// last version and the designs checked for Compare sit below it.
const F = require("../core/format.js");

const IN = 25.4;

function bar(sk, y, T, P, h, cls, key) {
  const H = 4.2;
  sk.rect(0, y - H, T, y, cls + (key ? " d part" : ""), key ? { "data-key": "travel" } : {});
  if (isFinite(P) && P > 0) {
    const n = Math.min(400, Math.floor(T / P + 1e-9));
    for (let k = 0; k <= n; k++) sk.circle(k * P, y - H / 2, Math.min(h / 2, H * 0.42), cls + "-hole" + (key ? " d part" : ""), key ? { "data-key": "P teeth holeD" } : {});
  }
  return H;
}

function build(sk, vm) {
  const m = vm.model, p = vm.design;
  const marks = vm.marks || [];
  const maxT = Math.max(p.travel || 0, ...marks.map(g => g.m.p.travel));
  const inches = Math.max(1, Math.ceil(maxT / IN - 1e-6));
  const L = inches * IN;
  const labelX = -sk.px(8);
  // ruler body with tick marks every 1/4 inch
  const top = 7;
  sk.rect(0, 0, L, top, "ruler-body");
  for (let q = 0; q <= inches * 4; q++) {
    const x = q * IN / 4, len = q % 4 === 0 ? 3.2 : q % 2 === 0 ? 2.1 : 1.3;
    sk.line(x, top, x, top - len, "ruler-tick", { noGrow: true });
    if (q % 4 === 0 && (inches <= 24 || (q / 4) % 2 === 0)) sk.text(x + (q === 0 ? sk.px(3) : 0), top - 3.4, String(q / 4), { anchor: q === 0 ? "start" : "middle", v: "top", px: 13, cls: "ruler-n" });
  }
  sk.text(L, top + sk.px(4), "inches", { anchor: "end", v: "bottom", px: 13, cls: "note" });
  // the slide marker that follows the wheel
  sk.open({ id: "ruler-now", class: "ruler-now" });
  sk.line(0, top + 0.6, 0, -2, "now-l", { noGrow: true });
  sk.arrow(0, top - 0.2, -90, "now-a", 9);
  sk.close();

  // now
  let y = -1.6;
  const dirWord = vm.dir > 0 ? "slides →" : "← slides";
  const H = bar(sk, y, p.travel, m.ok ? m.d.P : NaN, p.holeD, "rnow", true);
  sk.text(labelX, y - H / 2, "now", { anchor: "end", v: "mid", bold: true, px: 13 });
  const b = vm.badge(vm.settings.units === "in" ? "travelIn" : "travel");
  const slideTxt = vm.settings.units === "in" ? F.trim(p.travel / IN, 2) + " in" : F.trim(p.travel, 1) + " mm";
  sk.text(p.travel + sk.px(6), y - H / 2, dirWord + " " + slideTxt + (m.ok ? " · holes " + vm.num("P") + " mm apart" : ""), { anchor: "start", v: "mid", px: 13, badge: b, a: { "data-key": "travel" } });
  y -= H + 2.2;
  for (const g of marks) {
    sk.open({ class: "ghost rghost " + g.cls });
    const h2 = bar(sk, y, g.m.p.travel, g.m.d.P, g.m.p.holeD, "gbar", false);
    sk.text(labelX, y - h2 / 2, g.short, { anchor: "end", v: "mid", px: 13, cls: "glbl" });
    sk.text(g.m.p.travel + sk.px(6), y - h2 / 2, (vm.settings.units === "in" ? F.trim(g.m.p.travel / IN, 2) + " in" : F.trim(g.m.p.travel, 1) + " mm") + " · " + vm.fmt("P", g.m.d.P) + " mm apart", { anchor: "start", v: "mid", px: 13, cls: "glbl" });
    sk.close();
    y -= h2 + 2.2;
  }
  sk.grow(L + sk.px(6), 0);
  sk.dim({ key: "travel", kind: "length", level: "key", editable: true, value: p.travel, handle: [p.travel, -1.6 - H / 2],
    drag: { type: "axis", origin: [0, 0], axis: [1, 0], factor: 1 }, step: 1, bigStep: 10 });
}

function animate(svg, vm, theta, sk) {
  const g = svg && svg.querySelector("#ruler-now");
  const m = vm.model;
  if (!g || !m.ok) return;
  const slide = m.d.Rp * theta * Math.PI / 180;
  g.setAttribute("transform", "translate(" + slide.toFixed(3) + " 0)");
  g.classList.toggle("moving", theta > 0.01);
  void sk;
}

module.exports = { id: "ruler", build, animate, fitOpts: () => ({ maxHeightPx: 260, maxScale: 8 }) };
