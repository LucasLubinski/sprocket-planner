"use strict";
// One pin standing in its hole (cross-section): hole Ø, sheet thickness, gap,
// pin width, straight section, taper angle, height, tip Ø and the play on each
// side. Ghost pin and hole edges line up on the hole center.
const T = require("../core/taper.js");
const { D2R, textWidth } = require("./svg.js");

function pinPts(sk, loc) { return "M" + loc.map(([x, y]) => sk.P(x, y)).join("L") + "Z"; }

// The pin's root sits inside the wheel; draw it from the surface up.
function clipBase(loc) {
  const out = [];
  for (let i = 0; i < loc.length; i++) {
    const A = loc[i], B = loc[(i + 1) % loc.length];
    if (A[1] >= 0) out.push(A);
    if (A[1] * B[1] < 0) out.push([A[0] + (B[0] - A[0]) * (0 - A[1]) / (B[1] - A[1]), 0]);
  }
  return out.length > 2 ? out : loc;
}

function build(sk, vm) {
  const m = vm.model;
  if (!m.ok) { sk.text(0, 0, "Fix the red boxes to see the pin.", { v: "mid", cls: "msg" }); sk.grow(-20, -4); sk.grow(20, 4); return; }
  const p = m.p, d = m.d;
  const a = p.pinW / 2, h2 = p.holeD / 2, g = p.gap, t = p.sheetT, H = p.pinH, s = p.pinStraight;
  const X = Math.max(h2, a) + Math.max(1.4, p.holeD * 0.3);
  const topY = Math.max(H, g + t);
  const base = -0.8;
  sk.grow(-X, base); sk.grow(X, topY);

  // ghosts: pin outline and hole edges, centered on the same hole
  for (const gh of vm.ghosts) {
    if (!gh.m.ok) continue;
    const gp = gh.m.p, gd = gh.m.d, gh2 = gp.holeD / 2;
    sk.open({ class: "ghost " + gh.cls });
    sk.push('<path class="gl" d="' + pinPts(sk, clipBase(gd.loc)) + '"/>');
    for (const sx of [-1, 1]) {
      sk.line(sx * gh2, gp.gap, sx * gh2, gp.gap + gp.sheetT, "gl", { noGrow: true });
      sk.line(sx * gh2, gp.gap, sx * X, gp.gap, "gl", { noGrow: true });
      sk.line(sx * gh2, gp.gap + gp.sheetT, sx * X, gp.gap + gp.sheetT, "gl", { noGrow: true });
    }
    sk.close();
  }

  // sheet webs and the pitch line through the sheet's middle
  sk.rect(-X, g, -h2, g + t, "d part sheet", { "data-key": "sheetT", noGrow: true });
  sk.rect(h2, g, X, g + t, "d part sheet", { "data-key": "sheetT", noGrow: true });
  sk.rect(-h2, g, h2, g + t, "d part hole", { "data-key": "holeD", noGrow: true });
  sk.line(-X, g + t / 2, X, g + t / 2, "d part pitchline", { "data-key": "pitchD", noGrow: true });
  // pin, then the wheel surface over its root
  sk.push('<path class="d part pin" data-key="pinW pinH taper tipD pinStraight" d="' + pinPts(sk, clipBase(d.loc)) + '"/>');
  sk.rect(-X, base, X, 0, "d part drum", { "data-key": "drumD" });
  if (p.tipD > 0) sk.circle(0, H - p.tipD / 2, p.tipD / 2, "d part tipc", { "data-key": "tipD", noGrow: true });
  if (s > 0) sk.line(-a - 0.2, s, a + 0.2, s, "d part sline", { "data-key": "pinStraight", noGrow: true });
  if (vm.ghosts.length) sk.text(-X + sk.px(4), topY + sk.px(4), vm.ghosts.map(x => x.label).join(", ") + " (dashed)", { anchor: "start", v: "bottom", cls: "glbl-t note", px: 13 });

  // hole diameter above everything, tip label above that
  const holeY = topY + sk.px(12);
  sk.linear([-h2, g + t], [h2, g + t], [0, holeY - (g + t)], {
    key: "holeD", level: "key", label: "hole Ø" + vm.num("holeD"), badge: vm.badge("holeD"),
    editable: true, value: p.holeD, drag: { type: "axis", origin: [0, 0], axis: [1, 0], factor: 2, abs: true }, handle: [h2, holeY], step: 0.1, bigStep: 0.5
  });

  // right column: gap, sheet, slant, tip
  const rx = X + sk.px(12);
  const rowH = sk.fs * 1.35;
  sk.linear([X, 0], [X, g], [rx - X, 0], { key: "gap", level: "all", editable: true, label: "gap " + vm.num("gap"), badge: vm.badge("gap"), anchor: "start", dy: -Math.max(0, rowH - g) / 2 });
  sk.linear([X, g], [X, g + t], [rx - X, 0], { key: "sheetT", level: "key", editable: true, label: "sheet " + vm.num("sheetT"), badge: vm.badge("sheetT"), anchor: "start", dy: Math.max(0, rowH - t) / 2 });

  // taper angle at the top of the straight part, right side, with a leader
  const slantY = Math.max(g + t + rowH * 0.9, s + 0.6);
  {
    const alpha = isFinite(p.taper) ? p.taper : 0;
    const r = Math.max(0.5, Math.min(1.2, (H - s) * 0.5));
    const dd = sk.dim({
      kind: "angle", key: "taper", level: "key", c: [a, s], r, editable: true, value: alpha,
      drag: { type: "angle", center: [a, s], zero: 90, sense: 1, min: 0, max: 89 },
      handle: [a + r * Math.cos((90 + alpha) * D2R), s + r * Math.sin((90 + alpha) * D2R)], step: 1, bigStep: 5
    });
    sk.open(sk.groupFor(dd));
    sk.line(a, s, a, s + r * 1.3, "ext");
    if (alpha > 0.5) {
      sk.arc(a, s, r, 90, 90 + alpha, "dl");
      if (alpha > 4) sk.arrow(a + r * Math.cos((90 + alpha) * D2R), s + r * Math.sin((90 + alpha) * D2R), 180 + alpha, "arw", 7);
    }
    const am = (90 + alpha / 2) * D2R;
    const from = [a + r * Math.cos(am) * 1.02, s + r * Math.sin(am) * 1.02];
    sk.line(from[0], from[1], rx - sk.px(3), slantY, "dl");
    dd.labelBox = sk.text(rx, slantY, vm.word("slant ", "taper ") + (isFinite(p.taper) ? vm.num("taper") + "°" : "—"), {
      anchor: "start", v: "mid", badge: vm.badge("taper"), a: { "data-dim-label": dd.id }
    });
    sk.close();
  }

  // tip diameter
  const tipY = slantY + rowH;
  if (p.tipD > 0) {
    const b = p.tipD / 2, c = H - b, ang = 40 * D2R;
    const dd = sk.dim({ kind: "diameter", key: "tipD", level: "all", editable: true });
    sk.open(sk.groupFor(dd));
    const from = [b * Math.cos(ang), c + b * Math.sin(ang)];
    sk.line(from[0], from[1], rx - sk.px(3), tipY, "dl");
    sk.circle(from[0], from[1], sk.px(2), "dot");
    dd.labelBox = sk.text(rx, tipY, "tip Ø" + vm.num("tipD"), { anchor: "start", v: "mid", badge: vm.badge("tipD"), a: { "data-dim-label": dd.id } });
    sk.close();
  } else {
    const dd = sk.dim({ key: "tipD", level: "key", kind: "diameter", editable: true });
    sk.open(sk.groupFor(dd));
    sk.text(rx, tipY, vm.word("pointed tip!", "pointed tip ") + (vm.settings.detail === "expert" ? vm.num("tipD") : ""), { anchor: "start", v: "mid", cls: "bad-t", a: { "data-dim-label": dd.id } });
    sk.close();
  }

  // left: pin height and straight part, labels running up the lines
  const lx1 = -X - sk.px(10), lx2 = lx1 - sk.px(10) - sk.fs * 1.2;
  sk.linear([-a, 0], [-a, H], [lx2 + a, 0], {
    key: "pinH", level: "key", rot: true, label: "height " + vm.num("pinH"), badge: vm.badge("pinH"),
    editable: true, value: H, drag: { type: "axis", origin: [0, 0], axis: [0, 1], factor: 1 }, handle: [lx2, H], step: 0.1, bigStep: 0.5
  });
  if (s > 0) {
    sk.linear([-a, 0], [-a, s], [lx1 + a, 0], { key: "pinStraight", level: "all", editable: true, rot: true, label: "straight " + vm.num("pinStraight"), badge: vm.badge("pinStraight") });
  } else {
    const dd = sk.dim({ key: "pinStraight", level: "all", kind: "length", editable: true });
    sk.open(sk.groupFor(dd));
    sk.text(-X, base - sk.px(4), "straight part 0", { anchor: "start", v: "top", badge: vm.badge("pinStraight"), a: { "data-dim-label": dd.id } });
    sk.close();
  }

  // pin width below the wheel surface
  const wY = base - sk.px(10) - (s > 0 ? 0 : sk.fs * 1.3);
  sk.linear([-a, 0], [a, 0], [0, wY], {
    key: "pinW", level: "key", label: vm.word("pin width ", "pin ") + vm.num("pinW"), badge: vm.badge("pinW"),
    editable: true, value: p.pinW, drag: { type: "axis", origin: [0, 0], axis: [1, 0], factor: 2, abs: true }, handle: [a, wY], step: 0.1, bigStep: 0.5
  });

  // play on each side, where the pin enters the sheet
  {
    const wg = d.wUnder / 2;
    const dd = sk.dim({ key: "play", level: "key", kind: "length" });
    sk.open(sk.groupFor(dd));
    for (const sx of [-1, 1]) sk.line(sx * Math.min(wg, h2), g, sx * h2, g, "dl playl");
    const ly = wY - sk.fs * 1.9;
    sk.line((Math.min(wg, h2) + h2) / 2, g, X * 0.4, ly + sk.fs * 0.3, "dl");
    dd.labelBox = sk.text(X * 0.4, ly, vm.word("wiggle room ±", "play ±") + vm.num("play") + vm.word(" each side", " per side"), {
      anchor: "middle", v: "top", badge: vm.badge("play"), cls: d.play > 0 ? "" : "bad-t", a: { "data-dim-label": dd.id }
    });
    sk.close();
  }
  // "wheel" note inside the drum strip, on whichever side has room beside the pin
  {
    const word = vm.word("wheel", "drum"), w = textWidth(word, 13) / sk.s, room = X - a - sk.px(8);
    if (w <= room && sk.px(14) <= -base + 0.05) sk.text(X - sk.px(3), base / 2, word, { anchor: "end", v: "mid", cls: "note", px: 13 });
  }
}

module.exports = { id: "pinhole", build, clipBase, fitOpts: () => ({ maxHeightPx: 460, maxScale: 70 }) };
