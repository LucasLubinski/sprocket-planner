"use strict";
// Hub side of the sprocket to scale: bolt pattern, hole sizes, center hole and
// pilot ring, with the goBILDA hub (32 mm circle, 14 mm recess, M4 holes)
// drawn over it in outline. Below it, a cut through two bolt holes shows the
// thickness, pilot ring, counterbores and the flattened pins.
const G = require("../core/geometry.js");
const L = require("./layout.js");
const { D2R } = require("./svg.js");

const HUB = { d: 32, recess: 14, square: 16, hole: 4 };

function build(sk, vm) {
  const m = vm.model;
  if (!m.ok) { sk.text(0, 0, "Fix the red boxes to see the hub.", { v: "mid", cls: "msg" }); sk.grow(-30, -6); sk.grow(30, 6); return; }
  const p = m.p, d = m.d;
  const R = d.tipR;
  sk.grow(-R, -R); sk.grow(R, R);

  for (const gh of vm.ghosts) {
    if (!gh.m.ok) continue;
    sk.open({ class: "ghost " + gh.cls });
    sk.circle(0, 0, gh.m.d.r0, "gl", { noGrow: true });
    for (const a of [45, 135, 225, 315]) sk.circle(gh.m.d.boltR * Math.cos(a * D2R), gh.m.d.boltR * Math.sin(a * D2R), gh.m.p.boltHoleD / 2, "gl", { noGrow: true });
    sk.close();
  }

  // body and pins
  sk.circle(0, 0, d.r0, "d part drum", { "data-key": "drumD" });
  for (let j = 0; j < p.teeth; j++) sk.push('<path class="d part pin' + (j === 0 ? " index" : "") + '" data-key="pinW pinH teeth" d="' + L.pinPath(sk, G.pinWorld(p, d, j, 0)) + '"/>');
  // smallest wheel the screws allow
  sk.circle(0, 0, d.hubMinR, "d part minr" + (d.r0 < d.hubMinR ? " bad" : ""), { "data-key": "hubMinD boltSquare boltHeadD", noGrow: true });
  // pilot ring (raised, on this side)
  if (p.pilot) sk.circle(0, 0, p.pilotD / 2, "d part pilot-f", { "data-key": "pilotD pilot" });
  // bolt holes and head room (the heads sit on the far face)
  const bolts = [45, 135, 225, 315].map(a => [d.boltR * Math.cos(a * D2R), d.boltR * Math.sin(a * D2R)]);
  for (const [x, y] of bolts) {
    sk.circle(x, y, p.boltHeadD / 2, "d part head" + (p.counterbore > 0 ? " cb" : ""), { "data-key": "boltHeadD counterbore" });
    sk.circle(x, y, p.boltHoleD / 2, "d part bolt", { "data-key": "boltHoleD boltSquare" });
  }
  if (p.centerD > 0) sk.circle(0, 0, p.centerD / 2, "d part hole-c", { "data-key": "centerD" });
  sk.poly(bolts, "d part bsq", { "data-key": "boltSquare", noGrow: true });

  // the goBILDA hub, in outline
  sk.open({ class: "d gob", "data-key": "hub" });
  sk.circle(0, 0, HUB.d / 2, "gob-l", { noGrow: true });
  sk.circle(0, 0, HUB.recess / 2, "gob-l", { noGrow: true });
  const hr = HUB.square / Math.SQRT2;
  for (const a of [45, 135, 225, 315]) sk.circle(hr * Math.cos(a * D2R), hr * Math.sin(a * D2R), HUB.hole / 2, "gob-l", { noGrow: true });
  sk.close();

  // bolt square across the top
  const out = R + sk.px(10);
  sk.linear(bolts[1], bolts[0], [0, out - bolts[0][1]], {
    key: "boltSquare", level: "key", label: vm.word("bolt square ", "bolt square ") + vm.num("boltSquare"), badge: vm.badge("boltSquare"),
    editable: vm.design.hub === "custom", value: p.boltSquare, drag: { type: "axis", origin: [0, 0], axis: [1, 0], factor: 2, abs: true },
    handle: [bolts[0][0], out], step: 0.5, bigStep: 2
  });

  // one column of labels on the right, each with a leader to its part
  const at = (r, deg) => [r * Math.cos(deg * D2R), r * Math.sin(deg * D2R)];
  const labels = [
    { key: "hub", level: "all", text: "goBILDA hub (blue outline)", from: at(HUB.d / 2, 25) },
    { key: "boltHoleD", level: "key", text: "bolt hole Ø" + vm.num("boltHoleD"), from: [bolts[0][0] + p.boltHoleD / 2 * 0.71, bolts[0][1] + p.boltHoleD / 2 * 0.71] },
    { key: "boltHeadD", level: "all", text: vm.word("screw head room Ø", "head Ø") + vm.num("boltHeadD"), from: [bolts[3][0] + p.boltHeadD / 2 * 0.71, bolts[3][1] - p.boltHeadD / 2 * 0.71] },
    { key: "pilotD", level: "all", text: vm.word("pilot ring Ø", "pilot Ø") + vm.num("pilotD"), from: at(p.pilotD / 2, -10), skip: !p.pilot },
    { key: "centerD", level: "key", text: vm.word("center hole Ø", "center Ø") + vm.num("centerD"), from: at(p.centerD / 2, -60), skip: !(p.centerD > 0) },
    { key: "hubMinD", level: "key", text: vm.word("smallest wheel Ø", "min drum Ø") + vm.num("hubMinD"), from: at(d.hubMinR, -32) },
    { key: "drumD", level: "all", text: vm.word("wheel Ø", "drum Ø") + vm.num("drumD"), from: at(d.r0, -52) }
  ].filter(x => !x.skip);
  const colX = R + sk.px(18);
  const gapY = sk.fs * 1.45;
  labels.sort((a, b) => b.from[1] - a.from[1]);
  let prev = R + gapY * 0.5;
  for (const L1 of labels) { L1.y = Math.min(L1.from[1], prev - gapY); prev = L1.y; }
  // if the stack ran off the bottom, push it back up
  const floor = -R + sk.fs * 0.5;
  for (let i = labels.length - 1; i >= 0; i--) {
    const below = i === labels.length - 1 ? floor - gapY : labels[i + 1].y;
    labels[i].y = Math.max(labels[i].y, below + gapY);
  }
  for (const L1 of labels) {
    sk.leader(L1.from, [colX, L1.y], { key: L1.key, level: L1.level, label: L1.text, badge: vm.badge(L1.key) });
  }

  edgeView(sk, vm, -R - sk.px(26) - sk.fs * 1.6);
}

// Cut through two opposite bolt holes. z is up (hub side up).
function edgeView(sk, vm, top) {
  const m = vm.model, p = m.p, d = m.d;
  const hz = p.drumW + (p.pilot ? p.pilotH : 0);
  const z0 = top - hz;
  const Z = z => z0 + z;
  const r0 = d.r0, br = d.boltR, slab = p.pinFlat * p.pinW;
  sk.text(0, Z(hz) + sk.px(8), vm.word("Cut through two bolt holes (hub side up)", "Section through the bolt holes (hub side up)"), { v: "bottom", cls: "note", px: 13 });
  sk.rect(-r0, Z(0), r0, Z(p.drumW), "d part drum", { "data-key": "drumW drumD" });
  for (const sx of [-1, 1]) sk.rect(sx * r0, Z(0), sx * (r0 + p.pinH), Z(slab), "d part pin", { "data-key": "pinFlat pinH pinW" });
  if (p.pilot) sk.rect(-p.pilotD / 2, Z(p.drumW), p.pilotD / 2, Z(p.drumW + p.pilotH), "d part pilot-e", { "data-key": "pilotH pilotD pilot" });
  if (p.centerD > 0) sk.rect(-p.centerD / 2, Z(-0.01), p.centerD / 2, Z(hz + 0.01), "d part cut", { "data-key": "centerD" });
  for (const sx of [-1, 1]) {
    sk.rect(sx * br - p.boltHoleD / 2, Z(-0.01), sx * br + p.boltHoleD / 2, Z(p.drumW + 0.01), "d part cut", { "data-key": "boltHoleD boltSquare" });
    if (p.counterbore > 0) sk.rect(sx * br - p.boltHeadD / 2, Z(-0.01), sx * br + p.boltHeadD / 2, Z(Math.min(p.counterbore, p.drumW)), "d part cut", { "data-key": "counterbore boltHeadD" });
  }
  sk.linear([-r0 - p.pinH, Z(0)], [-r0 - p.pinH, Z(p.drumW)], [-sk.px(12), 0], { key: "drumW", level: "key", label: vm.word("thickness ", "drum_w ") + vm.num("drumW"), badge: vm.badge("drumW"), anchor: "end" });
  sk.linear([r0 + p.pinH, Z(0)], [r0 + p.pinH, Z(slab)], [sk.px(12), 0], { key: "pinFlat", level: "all", label: "pin " + vm.fmt("slab", slab) + " thick (" + vm.num("pinFlat") + " × width)", badge: vm.badge("slab"), anchor: "start" });
  if (p.pilot) {
    const dd = sk.dim({ key: "pilotH", level: "all", kind: "length" });
    sk.open(sk.groupFor(dd));
    sk.line(p.pilotD / 2, Z(p.drumW + p.pilotH), r0 + p.pinH + sk.px(10), Z(hz) + sk.px(8), "dl");
    dd.labelBox = sk.text(r0 + p.pinH + sk.px(13), Z(hz) + sk.px(8), vm.word("pilot ring ", "pilot ") + vm.num("pilotH") + " tall", { anchor: "start", v: "mid", badge: vm.badge("pilotH"), a: { "data-dim-label": dd.id } });
    sk.close();
  }
  const dd = sk.dim({ key: "counterbore", level: "key", kind: "length" });
  sk.open(sk.groupFor(dd));
  sk.text(0, Z(0) - sk.px(6), (p.counterbore > 0 ? "counterbore " + vm.num("counterbore") : vm.word("no counterbore", "counterbore 0")) +
    " · " + (isFinite(m.v.screwL) ? "screws: 4 × M4 × " + m.v.screwL + " mm" : "no screw is long enough"), { anchor: "middle", v: "top", badge: vm.badge("counterbore"), a: { "data-dim-label": dd.id } });
  sk.close();
}

module.exports = { id: "hubface", build, fitOpts: () => ({ maxHeightPx: 560 }) };
