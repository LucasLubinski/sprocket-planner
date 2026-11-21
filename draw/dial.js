"use strict";
// Turn dial: a filled pie for the turn, an extra ring per full turn, a tick at
// 300° for the standard servo's limit, and dashed outlines for the last
// version and the designs checked for Compare. Not to scale: it shows angle.
const F = require("../core/format.js");
const { D2R, textWidth } = require("./svg.js");

const R = 10;            // dial radius (drawing units)
const RING_GAP = 1.25;   // distance between full-turn rings

// clockwise degrees from the top -> drawing point
const pt = (r, a) => [r * Math.cos((90 - a) * D2R), r * Math.sin((90 - a) * D2R)];

function wedge(sk, r, a) {
  if (a >= 359.999) {
    const [x0, y0] = pt(r, 0), [x1, y1] = pt(r, 180);
    return "M" + sk.P(x0, y0) + "L" + sk.P(x1, y1) + "L" + sk.P(x0, y0) + "Z" + circlePath(sk, r);
  }
  const n = Math.max(2, Math.ceil(a / 4));
  const pts = [[0, 0]];
  for (let k = 0; k <= n; k++) pts.push(pt(r, a * k / n));
  return "M" + pts.map(q => sk.P(q[0], q[1])).join("L") + "Z";
}
function circlePath(sk, r) {
  const pts = [];
  for (let k = 0; k <= 90; k++) pts.push(pt(r, k * 4));
  return "M" + pts.map(q => sk.P(q[0], q[1])).join("L") + "Z";
}

// Full turns before the last (partial or full) one, and what is left.
function split(theta) {
  if (!(theta > 0) || !isFinite(theta)) return { rings: 0, rem: 0 };
  const rings = Math.max(0, Math.ceil(theta / 360 - 1e-9) - 1);
  return { rings: Math.min(rings, 12), rem: theta - rings * 360, more: rings > 12 };
}

function build(sk, vm) {
  const theta = vm.design.rotation;
  const { rings, rem, more } = split(theta);
  const marks = vm.marks || [];
  const maxRings = Math.max(rings, ...marks.map(g => split(g.m.p.rotation).rings));
  const outer = R + 0.5 + maxRings * RING_GAP;
  sk.grow(-outer - 0.5, -outer - 0.5); sk.grow(outer + 0.5, outer + 0.5);

  sk.circle(0, 0, R, "dial-face");
  for (let a = 0; a < 360; a += 30) {
    const [x1, y1] = pt(R, a), [x2, y2] = pt(R - (a % 90 ? 0.55 : 1.0), a);
    sk.line(x1, y1, x2, y2, "dial-tick", { noGrow: true });
  }
  // marks behind the pie: dashed outlines
  for (const g of marks) {
    const s = split(g.m.p.rotation);
    sk.open({ class: "ghost dial-ghost " + g.cls });
    sk.push('<path class="gl" d="' + wedge(sk, R, s.rem) + '"/>');
    for (let i = 0; i < s.rings; i++) sk.circle(0, 0, R + 0.5 + RING_GAP * (i + 0.5), "gl", { noGrow: true });
    sk.close();
  }
  sk.push('<path class="d part dial-pie" data-key="rotation" d="' + wedge(sk, R, rem) + '"/>');
  for (let i = 0; i < rings; i++) sk.circle(0, 0, R + 0.5 + RING_GAP * (i + 0.5), "d part dial-ring", { "data-key": "rotation", noGrow: true });
  sk.circle(0, 0, R, "dial-rim", { noGrow: true });
  // standard servo limit at 300°
  {
    const [x1, y1] = pt(R * 0.86, 300), [x2, y2] = pt(outer + 1.1, 300);
    sk.open({ class: "d servo300", "data-key": "rotation" });
    sk.line(x1, y1, x2, y2, "servo-tick");
    const [lx, ly] = pt(outer + 1.5, 300);
    sk.text(lx, ly, "standard servo max", { anchor: "end", v: "bottom", px: 13, cls: "servo-t" });
    sk.text(lx, ly, "300°", { anchor: "end", v: "top", px: 13, cls: "servo-t" });
    sk.close();
  }
  // needle for the wheel's current position
  sk.open({ id: "dial-now", class: "dial-now" });
  const [nx, ny] = pt(R * 0.97, 0);
  sk.line(0, 0, nx, ny, "now-l", { noGrow: true });
  sk.circle(nx, ny, sk.px(4), "now-d", { noGrow: true });
  sk.close();
  // the number in the middle
  sk.circle(0, 0, R * 0.42, "dial-hub", { noGrow: true });
  sk.text(0, R * 0.05, F.trim(theta, 2) + "°", { v: "mid", px: 20, bold: true, cls: "dial-num", a: { "data-key": "rotation" } });
  const turns = theta / 360;
  sk.text(0, -R * 0.24, turns > 1.0001 ? F.trim(turns, 2) + " turns" + (more ? "+" : "") : turns > 0.999 ? "1 full turn" : "of a turn", { v: "mid", px: 13, cls: "dial-sub" });
  const b = vm.badge("rotation");
  let ly = -outer - sk.px(4);
  if (b) { sk.text(0, ly, "", { v: "top", px: 14, badge: b, anchor: "middle" }); ly -= sk.px(19); }
  // Legend for the dashed outlines, under the dial (labels inside the dial
  // would hide under the pie). Two per line, colored like their outline.
  const items = marks.map(g => ({ g, t: g.short + " " + F.trim(g.m.p.rotation, 1) + "°" }));
  for (let i = 0; i < items.length; i += 2) {
    const line = items.slice(i, i + 2), gap = sk.px(14);
    const ws = line.map(it => textWidth(it.t, 13, true) / sk.s);
    let x = -(ws.reduce((a, w) => a + w, 0) + gap * (line.length - 1)) / 2;
    line.forEach((it, k) => {
      sk.open({ class: "ghost dial-ghost " + it.g.cls });
      sk.text(x * sk.dir, ly, it.t, { anchor: sk.dir > 0 ? "start" : "end", v: "top", px: 13, cls: "glbl" });
      sk.close();
      x += ws[k] + gap;
    });
    ly -= sk.px(17);
  }
  sk.dim({ key: "rotation", kind: "angle", level: "key", editable: true, value: theta, c: [0, 0], r: R,
    handle: pt(R, rem), drag: { type: "turn", center: [0, 0], rings }, step: 1, bigStep: 15 });
}

function animate(svg, vm, theta, sk) {
  const g = svg && svg.querySelector("#dial-now");
  if (!g) return;
  // rotate about the center; the needle starts at the top
  g.setAttribute("transform", "rotate(" + (sk.dir * (theta % 360)).toFixed(2) + ")");
  g.classList.toggle("moving", theta > 0.01);
}

module.exports = { id: "dial", build, animate, split, fitOpts: () => ({ maxHeightPx: 230, maxScale: 12 }) };
