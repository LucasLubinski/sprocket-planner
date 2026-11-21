const SPR = (() => {
  const D2R = Math.PI / 180;
  const HUB_MIN_R = 16 / Math.SQRT2 + 7.5 / 2 + 0.5;
  const DRUM_W = 5;

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
    for (let k = 0; k <= 32; k++) { const t = Math.PI * k / 32; pts.push([b * Math.cos(t), c + b * Math.sin(t)]); }
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

  function validate(p) {
    const e = [];
    const pos = (k, name) => { if (!(p[k] > 0) || !isFinite(p[k])) e.push(name + " must be above 0"); };
    pos("rotation", "Turn"); pos("travel", "Travel"); pos("sheetT", "Sheet thickness"); pos("holeD", "Hole diameter");
    pos("pinW", "Pin width"); pos("pinH", "Pin height"); pos("tipD", "Tip diameter");
    if (!(p.teeth >= 3) || Math.round(p.teeth) !== p.teeth) e.push("Teeth must be a whole number, 3 or more");
    if (!(p.gap >= 0)) e.push("Gap can't be negative");
    if (!(p.pinStraight >= 0)) e.push("Straight section can't be negative");
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
    const screwL = [6, 8, 10, 12, 14, 16, 20, 25].find(l => l >= DRUM_W + 4);
    return {
      tpr, Rp, P, yb, r0, tipR, phiIn, win, holes, loc, wUnder,
      web: P - p.holeD, inSheet: win / P, step: 360 / p.teeth, perDeg: tpr / 360,
      play: (p.holeD - wUnder) / 2, pitchD: 2 * Rp, drumD: 2 * r0, overD: 2 * tipR,
      run: (holes - 1) * P, guideLen: (holes - 1) * P + 12, screwL,
      pinGapOnDrum: 2 * Math.PI * r0 / p.teeth - p.pinW
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
        const g = gap(pin, w);
        if (g.d < best.d) best = { ...g, j };
      }
    }
    return best;
  }

  function trace(p, d, n = 240) {
    const out = [];
    for (let i = 0; i <= n; i++) { const th = d.step * i / n; out.push([th, minGap(p, d, th).d]); }
    return out;
  }

  return { D2R, HUB_MIN_R, DRUM_W, pinLocal, widthAt, validate, derive, pinWorld, webs, minGap, trace };
})();
if (typeof module !== "undefined") module.exports = SPR;
