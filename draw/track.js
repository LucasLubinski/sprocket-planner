"use strict";
// The sheet's track, seen end-on (looking along the slide): the slot the
// sheet runs in, the servo shaft below it, and the sprocket's pins poking up
// through the hole row. Sizes for building the track: shaft center to the
// sheet's underside, slot height and slot width.

function build(sk, vm) {
  const m = vm.model;
  if (!m.ok) { sk.text(0, 0, "Fix the red boxes to see the track.", { v: "mid", cls: "msg" }); sk.grow(-30, -6); sk.grow(30, 6); return; }
  const p = m.p, d = m.d, s = m.sheet;
  const W = s.W, t = p.sheetT, yb = d.yb, ct = p.trackClearT, cw = p.trackClearW;
  const slotW = W + cw, slotH = t + ct, wall = 4;
  // x = 0 at the slot's left wall; the sheet sits centered in the slot
  const sx = cw / 2, rowX = sx + s.rowY;            // hole row across the sheet
  const y0 = yb - ct / 2, y1 = y0 + slotH;          // slot bottom and top
  // track walls (C shape, both sides)
  for (const [a, b] of [[-wall, 0], [slotW, slotW + wall]]) sk.rect(a, y0 - wall, b, y1 + wall, "d part track", { "data-key": "trackClearW slotW" });
  sk.rect(0, y1, slotW, y1 + wall, "d part track lip", { "data-key": "trackClearT slotH", noGrow: true });
  sk.rect(0, y0 - wall, Math.max(0, rowX - m.v.pinZ - 1.5), y0, "d part track lip", { "data-key": "trackClearT slotH", noGrow: true });
  sk.rect(Math.min(slotW, rowX - m.v.pinZ + p.drumW + 1.5), y0 - wall, slotW, y0, "d part track lip", { "data-key": "trackClearT slotH", noGrow: true });
  // the sheet in its slot
  sk.rect(sx, yb, sx + W, yb + t, "d part sheet", { "data-key": "sheetT sheetW" });
  // sprocket seen edge-on: the drum (sprocket thickness wide) up to the drum radius, pins above it
  // The pins ride in the hole row, so the pins (not the drum) center on it.
  // z0 is the outer face (away from the hub); the pin center is pinZ from it.
  const slab = m.v.slab, z0 = rowX - m.v.pinZ;
  sk.rect(z0, 0, z0 + p.drumW, d.r0, "d part drum", { "data-key": "drumW drumD" });
  sk.rect(rowX - slab / 2, d.r0, rowX + slab / 2, d.r0 + p.pinH, "d part pin", { "data-key": "pinW pinH pinFlat pinCenter" });
  // the shaft mark sits at the middle of the drum's thickness
  const cx = z0 + p.drumW / 2;
  sk.circle(cx, 0, 1.2, "d part shaft", { "data-key": "yb" });
  sk.line(cx - 2.5, 0, cx + 2.5, 0, "cline", { noGrow: true });
  sk.line(cx, -2.5, cx, 2.5, "cline", { noGrow: true });
  sk.text(cx + 2, -sk.px(6), vm.word("servo shaft", "shaft axis"), { anchor: "start", v: "top", cls: "note", px: 13 });

  // dimensions
  sk.linear([rowX, 0], [rowX, yb], [-(rowX + wall + sk.px(18)), 0], {
    key: "yb", level: "key", label: vm.word("shaft to sheet ", "axis to sheet ") + vm.num("yb"), badge: vm.badge("yb"), rot: true,
    editable: true, show: "yb", set: { key: "pitchD", from: (v, p) => 2 * v + p.sheetT }
  });
  sk.linear([slotW + wall, y0], [slotW + wall, y1], [sk.px(14), 0], {
    key: "trackClearT slotH", level: "key", editable: true, show: "slotH", set: { key: "trackClearT", from: (v, p) => v - p.sheetT }, label: vm.word("slot height ", "slot height ") + vm.num("slotH"), badge: vm.badge("slotH"), anchor: "start"
  });
  sk.linear([0, y1 + wall], [slotW, y1 + wall], [0, sk.px(12)], {
    key: "trackClearW slotW", level: "key", editable: true, show: "slotW", set: { key: "trackClearW", from: (v, p) => v - p.sheetW }, label: vm.word("slot width ", "slot width ") + vm.num("slotW"), badge: vm.badge("slotW")
  });
  sk.linear([0, y0 - wall], [rowX, y0 - wall], [0, -sk.px(12)], {
    key: "rowOffset rowFromWall", level: "all", editable: true, show: "rowFromWall", set: { key: "rowOffset", from: (v, p) => v - p.trackClearW / 2 }, label: vm.word("wall to hole row ", "wall to pin line ") + vm.num("rowFromWall"), badge: vm.badge("rowFromWall")
  });
}

module.exports = { id: "track", build, fitOpts: () => ({ maxHeightPx: 340, maxScale: 12 }) };
