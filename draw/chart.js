"use strict";
// Clearance chart over one pin step: squeeze room (closest gap) against the
// wheel's angle, with the tightest point and the current position marked.
// Drawn in screen pixels, not millimeters.
const { esc, n, textWidth } = require("./svg.js");

function niceStep(range, target) {
  const raw = range / Math.max(1, target);
  const p = 10 ** Math.floor(Math.log10(raw));
  for (const k of [1, 2, 2.5, 5, 10]) if (k * p >= raw) return k * p;
  return 10 * p;
}

function render(container, vm) {
  const m = vm.model;
  const W = Math.max(280, container.clientWidth || 600);
  const H = W < 480 ? 230 : 250;
  if (!m.ok || !isFinite(m.v.tight)) {
    const msg = !m.ok ? "Fix the red boxes to see the chart." : "Holes run together: no plastic between them. Use fewer pins.";
    container.innerHTML = '<svg class="drw chart" viewBox="0 0 ' + W + " " + 80 + '" style="width:' + W + 'px" role="img" aria-label="Chart unavailable"><text class="lbl msg" x="' + W / 2 + '" y="44" text-anchor="middle" font-size="14">' + esc(msg) + '</text></svg>';
    return { animate() {} };
  }
  const step = m.d.step;
  const expert = vm.settings.detail === "expert";
  const series = [{ tr: m.trace, cls: "main" }];
  if (expert) { series.push({ tr: m.lo.trace, cls: "lo" }); series.push({ tr: m.hi.trace, cls: "hi" }); }
  let ymin = Infinity, ymax = -Infinity;
  const span = g => { if (isFinite(g)) { ymin = Math.min(ymin, g); ymax = Math.max(ymax, g); } };
  for (const s of series) for (const [, g] of s.tr) span(g);
  for (const gh of vm.ghosts) if (gh.m.ok) for (const [, g] of gh.m.trace) span(g);
  ymin = Math.min(-0.05, ymin - 0.02); ymax = Math.max(0.3, ymax + 0.03);
  ymax = Math.min(ymax, Math.max(1.5, m.v.tight + 0.6));
  const ml = 58, mr = 14, mt = 14, mb = 44;
  const pw = W - ml - mr, ph = H - mt - mb;
  const X = th => ml + pw * th / step, Y = g => mt + ph * (1 - (Math.min(ymax, Math.max(ymin, g)) - ymin) / (ymax - ymin));
  const out = [];
  const lbl = (x, y, s, a = "middle", cls = "", extra = "") => out.push('<text class="lbl ' + cls + '" x="' + n(x) + '" y="' + n(y) + '" font-size="14" text-anchor="' + a + '"' + extra + ">" + s + "</text>");
  // zones
  out.push('<rect class="zone red" x="' + ml + '" y="' + n(Y(0)) + '" width="' + pw + '" height="' + n(Y(ymin) - Y(0)) + '"/>');
  out.push('<rect class="zone amber" x="' + ml + '" y="' + n(Y(0.08)) + '" width="' + pw + '" height="' + n(Y(0) - Y(0.08)) + '"/>');
  out.push('<rect class="zone green" x="' + ml + '" y="' + n(Y(ymax)) + '" width="' + pw + '" height="' + n(Y(0.08) - Y(ymax)) + '"/>');
  // axes and ticks
  const ys = niceStep(ymax - ymin, 5);
  for (let y = Math.ceil(ymin / ys) * ys; y <= ymax + 1e-9; y += ys) {
    out.push('<line class="tick" x1="' + ml + '" x2="' + (ml + pw) + '" y1="' + n(Y(y)) + '" y2="' + n(Y(y)) + '"/>');
    lbl(ml - 6, Y(y) + 5, esc(vm.fmt("tight", y, 2)), "end", "axis");
  }
  const xs = niceStep(step, W < 480 ? 4 : 6);
  for (let x = 0; x <= step + 1e-9; x += xs) {
    out.push('<line class="tick" x1="' + n(X(x)) + '" x2="' + n(X(x)) + '" y1="' + mt + '" y2="' + (mt + ph) + '"/>');
    lbl(X(x), mt + ph + 18, esc(+x.toFixed(2) + "°"), "middle", "axis");
  }
  out.push('<rect class="frame" x="' + ml + '" y="' + mt + '" width="' + pw + '" height="' + ph + '"/>');
  out.push('<line class="zero" x1="' + ml + '" x2="' + (ml + pw) + '" y1="' + n(Y(0)) + '" y2="' + n(Y(0)) + '"/>');
  lbl(ml + pw - 4, Y(0) + 16, vm.word("hits", "binds"), "end", "zone-t");
  lbl(ml + 6, mt + ph + 36, esc(vm.word("Wheel angle within one pin step", "Rotation within one pin step") + " (" + vm.fmt("step", step) + "°)"), "start", "axis-t");
  out.push('<text class="lbl axis-t" font-size="14" text-anchor="middle" transform="rotate(-90 14 ' + n(mt + ph / 2) + ')" x="14" y="' + n(mt + ph / 2 + 5) + '">' + esc(vm.word("squeeze room, mm", "clearance, mm")) + "</text>");
  // ghost traces
  for (const gh of vm.ghosts) {
    if (!gh.m.ok) continue;
    const gs = gh.m.d.step;
    const pts = gh.m.trace.filter(([th, g]) => th <= step + 1e-9 && isFinite(g)).map(([th, g]) => n(X(th * step / gs)) + "," + n(Y(g))).join(" ");
    out.push('<g class="ghost ' + gh.cls + '"><polyline class="gl" points="' + pts + '"/></g>');
  }
  // traces
  for (const s of series) {
    const pts = s.tr.filter(([, g]) => isFinite(g)).map(([th, g]) => n(X(th)) + "," + n(Y(g))).join(" ");
    out.push('<polyline class="d trace ' + s.cls + '" data-key="' + (s.cls === "main" ? "tight" : s.cls === "lo" ? "loTight gap" : "hiTight gap") + '" points="' + pts + '"/>');
  }
  if (expert) {
    lbl(ml + pw - 6, mt + 16, esc("dashed: sheet " + vm.fmt("gap", m.p.gap - m.v.loGap) + " mm lower / higher"), "end", "axis");
  }
  // tightest point
  const tx = X(m.v.tightAt), ty = Y(m.v.tight);
  const b = vm.badge("tight");
  const ttxt = vm.word("tightest ", "tightest ") + esc(vm.num("tight")) + " mm at " + esc(vm.fmt("tightAt", m.v.tightAt)) + "°";
  const tw = textWidth(ttxt.replace(/&[a-z]+;/g, "x"), 14) + (b ? textWidth(" " + b.text, 13, true) : 0);
  let lx = Math.min(Math.max(tx, ml + 4 + tw / 2), ml + pw - 4 - tw / 2);
  const ly = ty > mt + ph * 0.55 ? ty - 12 : ty + 24;
  out.push('<g class="d dim lvl-key" data-key="tight"><circle class="tmark" cx="' + n(tx) + '" cy="' + n(ty) + '" r="5"/>' +
    '<text class="lbl" x="' + n(lx) + '" y="' + n(ly) + '" font-size="14" text-anchor="middle">' + ttxt +
    (b ? '<tspan class="bdg ' + b.cls + '" font-size="13"> ' + esc(b.text) + "</tspan>" : "") + "</text></g>");
  // current position
  out.push('<g id="ch-now"><line class="nowl" x1="0" x2="0" y1="' + mt + '" y2="' + (mt + ph) + '"/><circle class="nowd" r="4" cx="0" cy="0"/></g>');
  container.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="drw chart" viewBox="0 0 ' + W + " " + H + '" style="width:' + W + 'px" role="img" aria-label="' +
    esc("Squeeze room while turning. Tightest " + vm.num("tight") + " mm.") + '">' + out.join("") + "</svg>";
  const svg = container.firstChild;
  const now = svg.querySelector("#ch-now");
  return {
    svg,
    animate(theta) {
      const th = ((theta % step) + step) % step;
      const i = Math.round(th / step * (m.trace.length - 1));
      const g = m.trace[Math.max(0, Math.min(m.trace.length - 1, i))][1];
      if (!isFinite(g)) return;
      now.setAttribute("transform", "translate(" + n(X(th)) + " 0)");
      now.querySelector("circle").setAttribute("cy", n(Y(g)));
    }
  };
}

module.exports = { id: "chart", render };
