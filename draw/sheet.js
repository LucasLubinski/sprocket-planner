"use strict";
// Sheet pattern for cutting (top view): outline and holes with their
// dimensions. Below it, the printed drill guide at the same scale.

function build(sk, vm) {
  const m = vm.model;
  if (!m.ok) { sk.text(0, 0, "Fix the red boxes to see the sheet.", { v: "mid", cls: "msg" }); sk.grow(-30, -6); sk.grow(30, 6); return; }
  const p = m.p, d = m.d, s = m.sheet;
  const L = s.L, W = s.W, h = p.holeD / 2;
  sk.grow(0, 0); sk.grow(L, W);

  if (vm.settings.grid) {
    const parts = [];
    for (let x = 0; x <= L; x += 5) parts.push("M" + sk.P(x, 0) + "L" + sk.P(x, W));
    for (let y = 0; y <= W; y += 5) parts.push("M" + sk.P(0, y) + "L" + sk.P(L, y));
    sk.push('<path class="grid major" d="' + parts.join("") + '"/>');
  }
  sk.rect(0, 0, L, W, "d part sheet-o", { "data-key": "sheetLen sheetW sheetT" });
  for (const c of s.holes) sk.circle(c.x, c.y, c.r, "d part hole-o", { "data-key": "holeD holes" });
  // drill guide hole line on the sheet (guide fence on the bottom edge)
  if (p.edgeOffset < W) sk.line(0, p.edgeOffset, L, p.edgeOffset, "d part guideline", { "data-key": "edgeOffset", noGrow: true });

  const lane = sk.fs * 1.8;
  const h0 = s.holes[0], h1 = s.holes[1];
  if (h1) {
    sk.linear([h0.x, h0.y], [h1.x, h1.y], [0, W - h0.y + sk.px(12)], {
      key: "P", level: "key", label: vm.word("hole spacing ", "pitch ") + vm.num("P"), badge: vm.badge("P"), anchor: "start", shift: 0,
      editable: true, value: d.P, drag: { type: "axis", origin: [h0.x, 0], axis: [1, 0], factor: 1 }, handle: [h1.x, W + sk.px(12)], step: 0.1, bigStep: 1
    });
  }
  sk.leader([h0.x - h * 0.7, h0.y + h * 0.7], [h0.x - h - sk.px(10), W + lane * 1.6], { key: "holeD", level: "key", label: "hole Ø" + vm.num("holeD"), badge: vm.badge("holeD") });
  sk.linear([0, 0], [L, 0], [0, -sk.px(14)], {
    key: "sheetLen", level: "key", label: vm.word("sheet length ", "length ") + vm.num("sheetLen") + (p.sheetLen == null ? vm.word(" (auto)", " (auto)") : ""), badge: vm.badge("sheetLen"),
    editable: true, value: L, drag: { type: "axis", origin: [0, 0], axis: [1, 0], factor: 1 }, handle: [L, -sk.px(14)], step: 1, bigStep: 10
  });
  sk.linear([L, 0], [L, W], [sk.px(14), 0], {
    key: "sheetW", level: "key", label: vm.word("width ", "width ") + vm.num("sheetW"), badge: vm.badge("sheetW"), anchor: "start",
    editable: true, value: W, drag: { type: "axis", origin: [0, 0], axis: [0, 1], factor: 1 }, handle: [L + sk.px(14), W], step: 1, bigStep: 5
  });
  sk.linear([0, 0], [0, s.rowY], [-sk.px(14), 0], {
    key: "rowOffset", level: "all", label: vm.word("row ", "row ") + vm.num("rowOffset"), badge: vm.badge("rowOffset"), anchor: "end",
    editable: true, value: s.rowY, drag: { type: "axis", origin: [0, 0], axis: [0, 1], factor: 1 }, handle: [-sk.px(14), s.rowY], step: 0.5, bigStep: 2
  });
  if (s.endGap > sk.px(30)) sk.linear([0, s.rowY], [h0.x - h, s.rowY], [0, -h - sk.px(8)], { key: "endMargin", level: "all", label: vm.word("end ", "end ") + vm.fmt("endMargin", s.endGap), badge: null, ext: false });
  sk.text(L / 2, W / 2 + h + sk.px(6), s.n + " holes", { v: "bottom", cls: "note", px: 13 });

  // drill guide, same scale, below
  const gy = -lane * 2.6 - 4 - (p.edgeOffset + h + 6);
  guide(sk, vm, gy);
}

function guide(sk, vm, oy) {
  const m = vm.model, p = m.p, d = m.d;
  const margin = 6, n = d.nGuide;
  const len = (n - 1) * d.P + 2 * margin, width = p.edgeOffset + p.holeD / 2 + margin, fence = 4;
  const Y = y => oy + y;
  sk.text(0, Y(width) + sk.px(6), vm.word("Drill guide (lay it on the sheet, fence on the edge)", "Drill guide, top view"), { anchor: "start", v: "bottom", cls: "note", px: 13 });
  sk.rect(0, Y(0), len, Y(width), "d part guide", { "data-key": "guideT guideHoles" });
  sk.rect(0, Y(-fence), len, Y(0), "d part fence", { "data-key": "edgeOffset" });
  for (let k = 0; k < n; k++) sk.circle(margin + k * d.P, Y(p.edgeOffset), p.guideHoleD / 2, "d part hole-o", { "data-key": "guideHoleD guideHoles" });
  sk.linear([0, Y(-fence)], [len, Y(-fence)], [0, -sk.px(12)], { key: "guideHoles", level: "key", label: n + " holes, " + vm.fmt("guideLen", d.guideLen) + " long · " + vm.num("guideT") + " thick", badge: vm.badge("nGuide") });
  sk.linear([len, Y(0)], [len, Y(p.edgeOffset)], [sk.px(14), 0], { key: "edgeOffset", level: "all", label: vm.word("edge to holes ", "edge offset ") + vm.num("edgeOffset"), badge: vm.badge("edgeOffset"), anchor: "start" });
  sk.leader([margin + d.P + p.guideHoleD / 2 * 0.7, Y(p.edgeOffset + p.guideHoleD / 2 * 0.7)], [margin + d.P * 2.2, Y(width) + sk.fs * 1.4], { key: "guideHoleD", level: "all", label: vm.word("guide hole Ø", "guide hole Ø") + vm.num("guideHoleD"), badge: vm.badge("guideHoleD") });
}

module.exports = { id: "sheet", build, fitOpts: () => ({ maxHeightPx: 560 }) };
