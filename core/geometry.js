"use strict";
// Geometry and clearance simulation (no DOM).
//
// Built from reference/core.js, which matches an independent Python/Shapely
// simulation to 3 decimals. Function names and math are kept as they were.
// What changed:
//   * The fixed HUB_MIN_R and DRUM_W are gone. hubMinR(p) and screwLength(p)
//     use the design's hub mount settings (bolt_square, bolt_head_d, drum_w,
//     counterbore).
//   * pinLocal also draws a pointed pin when the taper is too steep for a
//     round tip (tip diameter <= 0), so the drawings can show the problem.
//   * validate checks the new inputs too, in plain words.

const D2R = Math.PI / 180;
const SCREW_LENGTHS = [6, 8, 10, 12, 14, 16, 20, 25];

function hull(pts) {
  pts = pts.slice().sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  up.pop(); lo.pop();
  return lo.concat(up);
}

function pinLocal(p) {
  const a = p.pinW / 2, b = p.tipD / 2, s = p.pinStraight, c = p.pinH - b;
  const pts = [[-a, -1], [a, -1], [a, s], [-a, s]];
  if (b > 0) {
    for (let k = 0; k <= 32; k++) { const t = Math.PI * k / 32; pts.push([b * Math.cos(t), c + b * Math.sin(t)]); }
  } else {
    // Pointed pin: the sides at the taper angle meet below the set height.
    const al = (p.taper || 0) * D2R;
    const apex = al > 0 ? s + a / Math.tan(al) : p.pinH;
    pts.push([0, Math.max(s + 1e-6, Math.min(p.pinH, apex))]);
  }
  return hull(pts);
}

function widthAt(loc, u) {
  const xs = [];
  for (let i = 0; i < loc.length; i++) {
    const A = loc[i], B = loc[(i + 1) % loc.length];
    if ((A[1] - u) * (B[1] - u) <= 0 && A[1] !== B[1]) xs.push(A[0] + (B[0] - A[0]) * (u - A[1]) / (B[1] - A[1]));
  }
  return xs.length ? Math.max(...xs) - Math.min(...xs) : 0;
}

// Smallest drum radius that leaves room for the hub screw heads.
function hubMinR(p) { return p.boltSquare / Math.SQRT2 + p.boltHeadD / 2 + 0.5; }

// Shortest standard M4 screw that is at least (thickness - counterbore + 4) mm.
function screwLength(p) {
  const grip = p.drumW - p.counterbore;
  return SCREW_LENGTHS.find(l => l >= grip + 4);
}

function validate(p) {
  const e = [];
  const pos = (k, name) => { if (!(p[k] > 0) || !isFinite(p[k])) e.push(name + " must be above 0."); };
  const nonNeg = (k, name) => { if (!(p[k] >= 0) || !isFinite(p[k])) e.push(name + " can't be below 0."); };
  pos("rotation", "Wheel turns"); pos("travel", "Sheet slides"); pos("sheetT", "Sheet thickness"); pos("holeD", "Hole size");
  pos("pinW", "Pin width"); pos("pinH", "Pin height");
  if (!(p.tipD > 0) && !(p.taper > 0 && p.taper < 90)) e.push("Tip size must be above 0.");
  if (!(p.teeth >= 3) || Math.round(p.teeth) !== p.teeth) e.push("Pins on the wheel must be a whole number, 3 or more.");
  nonNeg("gap", "Gap under the sheet");
  nonNeg("pinStraight", "Straight part");
  pos("pinFlat", "Pin flattening"); pos("drumW", "Sprocket thickness");
  pos("boltSquare", "Bolt pattern"); pos("boltHoleD", "Bolt hole size"); pos("boltHeadD", "Screw head room");
  nonNeg("counterbore", "Counterbore depth"); nonNeg("centerD", "Center hole size");
  if (p.pilot) { pos("pilotD", "Pilot ring size"); pos("pilotH", "Pilot ring height"); }
  if (!(p.guideHoles >= 0) || Math.round(p.guideHoles) !== p.guideHoles) e.push("Guide holes must be a whole number (0 = enough for the travel).");
  if (p.guideHoles === 1) e.push("Guide holes must be 0 (automatic) or at least 2.");
  pos("edgeOffset", "Sheet edge to hole line"); pos("guideT", "Guide thickness"); pos("guideHoleD", "Guide hole size");
  pos("sheetW", "Sheet width");
  if (p.sheetLen !== null && p.sheetLen !== undefined) pos("sheetLen", "Sheet length");
  if (p.rowOffset !== null && p.rowOffset !== undefined) nonNeg("rowOffset", "Hole row from the edge");
  nonNeg("endMargin", "Plastic past the end holes");
  nonNeg("trackClearT", "Track slot clearance (height)"); nonNeg("trackClearW", "Track slot clearance (width)");
  return e;
}

function derive(p) {
  const tpr = p.travel * 360 / p.rotation;
  const Rp = tpr / (2 * Math.PI);
  const P = tpr / p.teeth;
  const yb = Rp - p.sheetT / 2;
  const r0 = yb - p.gap;
  const tipR = r0 + p.pinH;
  const phiIn = Math.acos(Math.min(1, yb / tipR));
  const win = 2 * tipR * Math.sin(phiIn);
  const holes = Math.ceil(p.travel / P - 1e-9) + Math.ceil(win / P - 1e-9) + 1;
  const loc = pinLocal(p);
  const wUnder = widthAt(loc, p.gap);
  const nGuide = p.guideHoles > 0 ? p.guideHoles : holes;
  const minR = hubMinR(p);
  const screwL = screwLength(p);
  return {
    tpr, Rp, P, yb, r0, tipR, phiIn, win, holes, loc, wUnder,
    web: P - p.holeD, inSheet: win / P, step: 360 / p.teeth, perDeg: tpr / 360,
    play: (p.holeD - wUnder) / 2, pitchD: 2 * Rp, drumD: 2 * r0, overD: 2 * tipR,
    run: (holes - 1) * P, guideLen: (nGuide - 1) * P + 12, nGuide, screwL,
    pinGapOnDrum: 2 * Math.PI * r0 / p.teeth - p.pinW,
    boltR: p.boltSquare / Math.SQRT2, hubMinR: minR, hubMinD: 2 * minR, grip: p.drumW - p.counterbore
  };
}

function pinWorld(p, d, j, th) {
  const al = (j * 360 / p.teeth + th) * D2R, d0 = Math.sin(al), d1 = Math.cos(al), n0 = Math.cos(al), n1 = -Math.sin(al);
  return d.loc.map(([q, u]) => [(d.r0 + u) * d0 + q * n0, (d.r0 + u) * d1 + q * n1]);
}

function webs(p, d, th, x1, x2) {
  const s = d.Rp * th * D2R, o = [];
  const k1 = Math.floor((x1 - s) / d.P) - 1, k2 = Math.ceil((x2 - s) / d.P) + 1;
  for (let k = k1; k <= k2; k++) {
    const c = k * d.P + s, a = c + p.holeD / 2, b = c + d.P - p.holeD / 2;
    if (b > a) o.push([[a, d.yb], [b, d.yb], [b, d.yb + p.sheetT], [a, d.yb + p.sheetT]]);
  }
  return o;
}

function proj(pl, ax) { let mn = 1e9, mx = -1e9; for (const q of pl) { const v = q[0] * ax[0] + q[1] * ax[1]; if (v < mn) mn = v; if (v > mx) mx = v; } return [mn, mx]; }
function sat(A, B) {
  let m = 1e9;
  for (const Q of [A, B]) for (let i = 0; i < Q.length; i++) {
    const a = Q[i], b = Q[(i + 1) % Q.length];
    let ax = [a[1] - b[1], b[0] - a[0]]; const L = Math.hypot(ax[0], ax[1]); if (L < 1e-12) continue;
    ax = [ax[0] / L, ax[1] / L];
    const [a1, a2] = proj(A, ax), [b1, b2] = proj(B, ax);
    const o = Math.min(a2, b2) - Math.max(a1, b1);
    if (o <= 0) return 0;
    if (o < m) m = o;
  }
  return m;
}
function ptSeg(pt, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  let t = ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / (dx * dx + dy * dy || 1);
  t = Math.max(0, Math.min(1, t));
  const c = [a[0] + t * dx, a[1] + t * dy];
  return [Math.hypot(pt[0] - c[0], pt[1] - c[1]), c];
}
function gap(A, B) {
  const pen = sat(A, B);
  if (pen > 0) return { d: -pen };
  let best = { d: 1e9 };
  const run = (X, Y, swap) => {
    for (const pt of X) for (let i = 0; i < Y.length; i++) {
      const [dd, c] = ptSeg(pt, Y[i], Y[(i + 1) % Y.length]);
      if (dd < best.d) best = swap ? { d: dd, p: c, q: pt } : { d: dd, p: pt, q: c };
    }
  };
  run(A, B, false); run(B, A, true);
  return best;
}

// Same arithmetic as sat() and gap() above, without the per-call arrays, so a
// full edit (three sweeps) stays well under 60 ms on a school laptop.
// test/reference.test.js checks that it gives the reference numbers.
function satFast(A, B) {
  let m = 1e9;
  for (let s = 0; s < 2; s++) {
    const Q = s ? B : A, n = Q.length;
    for (let i = 0; i < n; i++) {
      const a = Q[i], b = Q[(i + 1) % n];
      let ax = a[1] - b[1], ay = b[0] - a[0];
      const L = Math.hypot(ax, ay); if (L < 1e-12) continue;
      ax = ax / L; ay = ay / L;
      let a1 = 1e9, a2 = -1e9, b1 = 1e9, b2 = -1e9;
      for (let k = 0; k < A.length; k++) { const v = A[k][0] * ax + A[k][1] * ay; if (v < a1) a1 = v; if (v > a2) a2 = v; }
      for (let k = 0; k < B.length; k++) { const v = B[k][0] * ax + B[k][1] * ay; if (v < b1) b1 = v; if (v > b2) b2 = v; }
      const o = Math.min(a2, b2) - Math.max(a1, b1);
      if (o <= 0) return 0;
      if (o < m) m = o;
    }
  }
  return m;
}
function gapFast(A, B) {
  const pen = satFast(A, B);
  if (pen > 0) return { d: -pen };
  let best = 1e18, bx = 0, by = 0, cx = 0, cy = 0, swap = false;
  for (let s = 0; s < 2; s++) {
    const X = s ? B : A, Y = s ? A : B, n = Y.length;
    for (let k = 0; k < X.length; k++) {
      const px = X[k][0], py = X[k][1];
      for (let i = 0; i < n; i++) {
        const a = Y[i], b = Y[(i + 1) % n];
        const dx = b[0] - a[0], dy = b[1] - a[1];
        let t = ((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy || 1);
        t = Math.max(0, Math.min(1, t));
        const qx = a[0] + t * dx, qy = a[1] + t * dy;
        const ex = px - qx, ey = py - qy, d2 = ex * ex + ey * ey;
        if (d2 < best) { best = d2; bx = px; by = py; cx = qx; cy = qy; swap = s === 1; }
      }
    }
  }
  const d = Math.hypot(bx - cx, by - cy);
  return swap ? { d, p: [cx, cy], q: [bx, by] } : { d, p: [bx, by], q: [cx, cy] };
}

function minGap(p, d, th) {
  let best = { d: 1e9 };
  const lim = d.phiIn / D2R + 25;
  for (let j = 0; j < p.teeth; j++) {
    const al = ((j * 360 / p.teeth + th) % 360 + 540) % 360 - 180;
    if (Math.abs(al) > lim) continue;
    const pin = pinWorld(p, d, j, th);
    let x1 = 1e9, x2 = -1e9;
    for (const q of pin) { if (q[0] < x1) x1 = q[0]; if (q[0] > x2) x2 = q[0]; }
    for (const w of webs(p, d, th, x1 - 2, x2 + 2)) {
      if (w[1][0] < x1 - 2 || w[0][0] > x2 + 2) continue;
      const g = gapFast(pin, w);
      if (g.d < best.d) best = { d: g.d, p: g.p, q: g.q, j };
    }
  }
  return best;
}

function trace(p, d, n = 240) {
  const out = [];
  for (let i = 0; i <= n; i++) { const th = d.step * i / n; out.push([th, minGap(p, d, th).d]); }
  return out;
}

module.exports = {
  D2R, SCREW_LENGTHS, hull, pinLocal, widthAt, hubMinR, screwLength,
  validate, derive, pinWorld, webs, minGap, trace, gap
};
