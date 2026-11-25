"use strict";
// Shared SVG drawing kit. Drawings work in world millimeters with y up; the
// Sketch flips y for SVG and mirrors x when the wheel turns counterclockwise.
// Labels are sized in screen pixels (never under 13 px), and every label grows
// the view box so nothing is clipped.
//
// Dimensions are objects (the dimension model): each has its setting key,
// kind, anchor points in mm, label, whether it is editable, its drag
// direction and how a new value maps back to a setting. Drawings register
// them here; highlighting, badges on labels, drag handles and type-in-place
// all read the same objects.

const FONT = 'Tahoma, Verdana, "Segoe UI", Arial, sans-serif';
const D2R = Math.PI / 180;

let measureCtx = null;
function textWidth(str, px, bold) {
  if (typeof document !== "undefined" && document.createElement) {
    if (!measureCtx) { const c = document.createElement("canvas"); measureCtx = c.getContext && c.getContext("2d"); }
    if (measureCtx) { measureCtx.font = (bold ? "bold " : "") + px + "px " + FONT; return measureCtx.measureText(str).width; }
  }
  return String(str).length * px * 0.58;
}

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n = v => { const r = Math.round(v * 1000) / 1000; return Object.is(r, -0) ? "0" : String(r); };
const attrs = a => a ? Object.entries(a).filter(([, v]) => v !== undefined && v !== null && v !== false).map(([k, v]) => " " + k + '="' + esc(v) + '"').join("") : "";

class Sketch {
  constructor({ scale = 4, dir = 1, fontPx = 14, id = "drw" } = {}) {
    this.s = scale; this.dir = dir; this.fontPx = fontPx; this.id = id;
    this.fs = fontPx / scale;
    this.out = [];
    this.bb = [Infinity, Infinity, -Infinity, -Infinity];
    this.dims = [];
    this.stack = [];
  }
  px(v) { return v / this.s; }
  X(x) { return this.dir * x; }
  Y(y) { return -y; }
  P(x, y) { return n(this.X(x)) + "," + n(this.Y(y)); }
  growSvg(x0, y0, x1, y1) {
    const b = this.bb;
    b[0] = Math.min(b[0], x0, x1); b[1] = Math.min(b[1], y0, y1);
    b[2] = Math.max(b[2], x0, x1); b[3] = Math.max(b[3], y0, y1);
  }
  grow(x, y, r = 0) { const X = this.X(x), Y = this.Y(y); this.growSvg(X - r, Y - r, X + r, Y + r); }
  push(s) { this.out.push(s); }
  open(a) { this.push("<g" + attrs(a) + ">"); }
  close() { this.push("</g>"); }

  line(x1, y1, x2, y2, cls, a = {}) {
    if (!a.noGrow) { this.grow(x1, y1); this.grow(x2, y2); }
    this.push("<line" + attrs({ class: cls, x1: n(this.X(x1)), y1: n(this.Y(y1)), x2: n(this.X(x2)), y2: n(this.Y(y2)), ...a, noGrow: undefined }) + "/>");
  }
  circle(cx, cy, r, cls, a = {}) {
    if (!a.noGrow) this.grow(cx, cy, r);
    this.push("<circle" + attrs({ class: cls, cx: n(this.X(cx)), cy: n(this.Y(cy)), r: n(Math.max(0, r)), ...a, noGrow: undefined }) + "/>");
  }
  poly(pts, cls, a = {}) {
    if (!a.noGrow) for (const [x, y] of pts) this.grow(x, y);
    this.push("<polygon" + attrs({ class: cls, points: pts.map(([x, y]) => this.P(x, y)).join(" "), ...a, noGrow: undefined }) + "/>");
  }
  polyline(pts, cls, a = {}) {
    if (!a.noGrow) for (const [x, y] of pts) this.grow(x, y);
    this.push("<polyline" + attrs({ class: cls, points: pts.map(([x, y]) => this.P(x, y)).join(" "), ...a, noGrow: undefined }) + "/>");
  }
  rect(x0, y0, x1, y1, cls, a = {}) {
    this.poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], cls, a);
  }
  // World angles: degrees counterclockwise from +x.
  arcPts(cx, cy, r, a0, a1, steps) {
    const k = steps || Math.max(8, Math.ceil(Math.abs(a1 - a0) / 4));
    const pts = [];
    for (let i = 0; i <= k; i++) { const a = (a0 + (a1 - a0) * i / k) * D2R; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    return pts;
  }
  arc(cx, cy, r, a0, a1, cls, a = {}) { this.polyline(this.arcPts(cx, cy, r, a0, a1), cls, a); }

  // Arrowhead with its tip at (x, y), pointing along world angle `ang`.
  arrow(x, y, ang, cls = "arw", sizePx = 8) {
    const L = this.px(sizePx), W = L * 0.38, a = ang * D2R;
    const bx = x - L * Math.cos(a), by = y - L * Math.sin(a);
    const nx = -Math.sin(a) * W, ny = Math.cos(a) * W;
    this.poly([[x, y], [bx + nx, by + ny], [bx - nx, by - ny]], cls);
  }

  // Text at world (x, y). anchor start/middle/end follows the mirror, so
  // "start" always reads away from the anchor point.
  // opts: { anchor, v: "base"|"mid"|"top"|"bottom", cls, badge: {text, cls}, rot (deg), px, bold, a: attrs }
  text(x, y, str, opts = {}) {
    const px = opts.px || this.fontPx;
    const fs = px / this.s;
    let anchor = opts.anchor || "middle";
    if (this.dir < 0 && !opts.rot) anchor = anchor === "start" ? "end" : anchor === "end" ? "start" : anchor;
    const main = String(str);
    const bt = opts.badge ? " " + opts.badge.text : "";
    const w = (textWidth(main, px, opts.bold) + (bt ? textWidth(bt, px * 0.93, true) : 0)) / this.s;
    const h = fs;
    const v = opts.v || "base";
    // baseline offset: SVG text sits on its baseline
    const dy = v === "mid" ? 0.35 * h : v === "top" ? 0.8 * h : v === "bottom" ? -0.22 * h : 0;
    const X = this.X(x), Y = this.Y(y);
    let x0 = anchor === "start" ? X : anchor === "end" ? X - w : X - w / 2;
    if (opts.rot) {
      // rotated -90: text runs bottom to top, centered on (X, Y)
      this.growSvg(X - h * 0.8, Y - w / 2 - h * 0.2, X + h * 0.35, Y + w / 2 + h * 0.2);
    } else {
      this.growSvg(x0 - h * 0.15, Y + dy - h * 0.85, x0 + w + h * 0.15, Y + dy + h * 0.25);
    }
    const tr = opts.rot ? "rotate(" + n(opts.rot) + " " + n(X) + " " + n(Y) + ")" : undefined;
    let inner = esc(main);
    if (bt) inner += '<tspan class="bdg ' + esc(opts.badge.cls) + '" font-size="' + n(fs * 0.93) + '">' + esc(bt) + "</tspan>";
    this.push("<text" + attrs({
      class: "lbl" + (opts.cls ? " " + opts.cls : ""), x: n(X), y: n(Y + (opts.rot ? 0.35 * h : dy)),
      "font-size": n(fs), "text-anchor": anchor, transform: tr, "font-weight": opts.bold ? "bold" : undefined, ...(opts.a || {})
    }) + ">" + inner + "</text>");
    return { x0, w, h };
  }

  // ---- the dimension model ----
  // Register a dimension object and open its group. Returns the object.
  dim(spec) {
    const d = { drawing: this.id, editable: false, ...spec };
    d.id = d.id || this.id + "." + d.key + "." + this.dims.length;
    this.dims.push(d);
    return d;
  }
  groupFor(d) {
    return {
      class: "d dim lvl-" + (d.level || "key"), "data-key": d.key, "data-dim": d.id,
      "data-editable": d.editable ? "1" : undefined
    };
  }

  // Linear dimension between world points a and b, drawn offset by `off`
  // (a world vector). Label in the middle, on the far side of the line.
  // spec: { key, id, label, badge, level, editable, drag, apply, value, kind }
  linear(a, b, off, spec) {
    const d = this.dim({ kind: "length", a, b, off, ...spec });
    const A = [a[0] + off[0], a[1] + off[1]], B = [b[0] + off[0], b[1] + off[1]];
    const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const ang = Math.atan2(B[1] - A[1], B[0] - A[0]) / D2R;
    this.open(this.groupFor(d));
    const offL = Math.hypot(off[0], off[1]);
    if (spec.ext !== false && offL > 1e-9) {
      const ux = off[0] / offL, uy = off[1] / offL, ov = this.px(4), gapPx = this.px(2);
      this.line(a[0] + ux * gapPx, a[1] + uy * gapPx, A[0] + ux * ov, A[1] + uy * ov, "ext");
      this.line(b[0] + ux * gapPx, b[1] + uy * gapPx, B[0] + ux * ov, B[1] + uy * ov, "ext");
    }
    const inside = L > this.px(22);
    if (inside) {
      this.line(A[0], A[1], B[0], B[1], "dl");
      this.arrow(A[0], A[1], ang + 180); this.arrow(B[0], B[1], ang);
    } else {
      const ex = this.px(14), c = Math.cos(ang * D2R), s = Math.sin(ang * D2R);
      this.line(A[0] - c * ex, A[1] - s * ex, B[0] + c * ex, B[1] + s * ex, "dl");
      this.arrow(A[0], A[1], ang); this.arrow(B[0], B[1], ang + 180);
    }
    // label: perpendicular to the line, away from the measured points
    let nx = -Math.sin(ang * D2R), ny = Math.cos(ang * D2R);
    if (offL > 1e-9 && nx * off[0] + ny * off[1] < 0) { nx = -nx; ny = -ny; }
    if (offL <= 1e-9 && ny < 0) { nx = -nx; ny = -ny; }
    const mx = (A[0] + B[0]) / 2 + (spec.shift || 0) * Math.cos(ang * D2R), my = (A[1] + B[1]) / 2;
    const vertical = Math.abs(Math.cos(ang * D2R)) < 0.3;
    let t;
    if (vertical && spec.rot) {
      // label runs along the line, reading bottom to top
      t = this.text(mx + nx * (this.px(5) + this.fs * 0.45), my, spec.label, { rot: -90, badge: spec.badge, cls: spec.labelCls, a: { "data-dim-label": d.id } });
    } else if (vertical) {
      const side = (nx * this.dir) >= 0 ? "start" : "end";
      t = this.text(mx + nx * this.px(6), my + (spec.dy || 0), spec.label, { anchor: spec.anchor || side, v: "mid", badge: spec.badge, cls: spec.labelCls, a: { "data-dim-label": d.id } });
    } else {
      const above = ny >= 0;
      t = this.text(mx + nx * this.px(5), my + ny * this.px(5), spec.label, { anchor: spec.anchor || "middle", v: above ? "bottom" : "top", badge: spec.badge, cls: spec.labelCls, a: { "data-dim-label": d.id } });
    }
    this.close();
    d.labelBox = t;
    return d;
  }

  // Angle dimension: arc around `c` from world angle a0 to a1 (degrees).
  angle(c, r, a0, a1, spec) {
    const d = this.dim({ kind: "angle", c, r, a0, a1, ...spec });
    this.open(this.groupFor(d));
    this.arc(c[0], c[1], r, a0, a1, "dl");
    const p1 = [c[0] + r * Math.cos(a1 * D2R), c[1] + r * Math.sin(a1 * D2R)];
    const p0 = [c[0] + r * Math.cos(a0 * D2R), c[1] + r * Math.sin(a0 * D2R)];
    const sgn = a1 >= a0 ? 1 : -1;
    this.arrow(p1[0], p1[1], a1 + 90 * sgn); this.arrow(p0[0], p0[1], a0 - 90 * sgn);
    const am = (spec.labelAt !== undefined ? spec.labelAt : (a0 + a1) / 2) * D2R;
    const lr = r + this.px(8);
    const lx = c[0] + lr * Math.cos(am), ly = c[1] + lr * Math.sin(am);
    const cosv = Math.cos(am) * this.dir;
    const t = this.text(lx, ly, spec.label, { anchor: spec.anchor || (cosv > 0.3 ? "start" : cosv < -0.3 ? "end" : "middle"), v: "mid", badge: spec.badge, a: { "data-dim-label": d.id } });
    this.close();
    d.labelBox = t;
    return d;
  }

  // A labelled leader from a point on a part to a label position.
  leader(from, to, spec) {
    const d = this.dim({ kind: spec.kind || "diameter", from, to, ...spec });
    this.open(this.groupFor(d));
    this.line(from[0], from[1], to[0], to[1], "dl");
    this.circle(from[0], from[1], this.px(2), "dot");
    const right = (to[0] - from[0]) * this.dir >= 0;
    const t = this.text(to[0] + (right ? 1 : -1) * this.px(3) * this.dir, to[1], spec.label, { anchor: right ? "start" : "end", v: "mid", badge: spec.badge, a: { "data-dim-label": d.id } });
    this.close();
    d.labelBox = t;
    return d;
  }

  // Finish: an <svg> string whose viewBox holds everything plus padding.
  svg({ padPx = 8, cls = "", label = "", minWmm = 0, minHmm = 0 } = {}) {
    const pad = this.px(padPx);
    let [x0, y0, x1, y1] = this.bb;
    if (!isFinite(x0)) { x0 = 0; y0 = 0; x1 = 10; y1 = 10; }
    if (x1 - x0 < minWmm) { const c = (x0 + x1) / 2; x0 = c - minWmm / 2; x1 = c + minWmm / 2; }
    if (y1 - y0 < minHmm) { const c = (y0 + y1) / 2; y0 = c - minHmm / 2; y1 = c + minHmm / 2; }
    x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
    this.view = [x0, y0, x1 - x0, y1 - y0];
    return '<svg xmlns="http://www.w3.org/2000/svg" class="drw ' + esc(cls) + '" viewBox="' + this.view.map(n).join(" ") +
      '" role="img" aria-label="' + esc(label) + '" data-scale="' + n(this.s) + '" data-dir="' + this.dir + '">' + this.out.join("") + "</svg>";
  }
}

// Build a drawing at the right scale: label sizes depend on the scale, and the
// scale depends on the overall size, so settle it in a few passes.
function fit(widthPx, build, opts = {}) {
  let scale = opts.guess || 4, sk = null;
  for (let pass = 0; pass < 4; pass++) {
    sk = new Sketch({ scale, dir: opts.dir || 1, fontPx: opts.fontPx || 14, id: opts.id });
    build(sk);
    const padMm = (opts.padPx || 8) / scale;
    const w = (sk.bb[2] - sk.bb[0]) + 2 * padMm;
    let next = widthPx / Math.max(w, 1e-6);
    if (opts.maxScale) next = Math.min(next, opts.maxScale);
    if (opts.maxHeightPx) {
      const h = (sk.bb[3] - sk.bb[1]) + 2 * padMm;
      next = Math.min(next, opts.maxHeightPx / Math.max(h, 1e-6));
    }
    if (Math.abs(next - scale) / scale < 0.015) { scale = next; break; }
    scale = next;
  }
  // The last pass may still come out wider (or taller) than allowed, and the
  // browser would then shrink the whole drawing, labels too (under 13 px).
  // Rebuild a little smaller until it fits at its real size.
  const over = s => {
    const padMm = (opts.padPx || 8) / s.s;
    const wPx = ((s.bb[2] - s.bb[0]) + 2 * padMm) * s.s;
    const hPx = ((s.bb[3] - s.bb[1]) + 2 * padMm) * s.s;
    return Math.max(wPx / widthPx, opts.maxHeightPx ? hPx / opts.maxHeightPx : 0);
  };
  // If the labels alone are wider than the box, shrinking can't help: stop
  // as soon as a step doesn't improve the fit and keep the best one.
  let best = sk, bestR = sk ? over(sk) : 1;
  for (let k = 0; k < 8 && bestR > 1.002; k++) {
    // labels don't shrink with the scale, so step the scale down a bit further than the ratio
    scale = best.s / (1 + (bestR - 1) * 1.6);
    const next = new Sketch({ scale, dir: opts.dir || 1, fontPx: opts.fontPx || 14, id: opts.id });
    build(next);
    const r = over(next);
    if (r > bestR - 0.002) break;
    best = next; bestR = r;
  }
  return best;
}

module.exports = { Sketch, fit, textWidth, esc, n, attrs, FONT, D2R };
