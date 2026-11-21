"use strict";
// Taper angle <-> tip diameter for the pin profile.
//
// The pin is the convex hull of its base rectangle (+-w/2, up to the straight
// section s) and a tip semicircle of radius b = d/2 centred at H - b.
// The taper angle is the angle of the pin's sides from straight up, above the
// straight section. Holding w, s and H:
//
//     b = (a cos(alpha) - (H - s) sin(alpha)) / (1 - sin(alpha)),   a = w/2, d = 2b
//
// For tip -> angle we use the tangent point on the tip circle (the same
// construction as OpenSCAD's pin_w_at), then alpha = atan((a - Tx) / (Ty - s)).
//
// A shape is valid when 0 < b <= a (the tip is no wider than the pin) and the
// tangent point sits above the straight section. That works out to
// alpha >= minTaper(w, s, H) and alpha < maxTaper(w, s, H).

const D2R = Math.PI / 180;

// Smallest angle that still gives a round tip no wider than the pin.
// When the pin is short for its width (a > H - s), small angles would need a
// tip wider than the pin.
function minTaper(w, s, H) {
  const a = w / 2, k = H - s;
  if (!(k > 0) || !(a > 0)) return NaN;
  return a > k ? 2 * Math.atan2(a - k, a) / D2R : 0;
}

// Angle at which the sides meet exactly at the top (tip shrinks to nothing).
function maxTaper(w, s, H) {
  const a = w / 2, k = H - s;
  if (!(k > 0) || !(a > 0)) return NaN;
  return Math.atan2(a, k) / D2R;
}

function tipRadius(w, s, H, deg) {
  const a = w / 2, k = H - s, al = deg * D2R, sn = Math.sin(al);
  return (a * Math.cos(al) - k * sn) / (1 - sn);
}

// The tip can never be wider than the pin.
function maxTip(w) { return w; }

// Tip diameter for a taper angle.
// reason: "range" (angle outside 0..90), "height" (straight part not below the
// top), "pointed" (b <= 0: the sides meet below the top), "tooBig" (the tip
// circle would be wider than the pin, or too big for this angle).
function tipFromTaper(w, s, H, deg) {
  if (!(deg >= 0) || !(deg < 90)) return { tipD: NaN, ok: false, reason: "range" };
  if (!(H - s > 0)) return { tipD: NaN, ok: false, reason: "height" };
  const a = w / 2, al = deg * D2R, sn = Math.sin(al);
  const b = tipRadius(w, s, H, deg);
  if (!(b > 1e-9)) {
    const apex = al > 0 ? s + a / Math.tan(al) : H;
    return { tipD: 2 * b, ok: false, reason: "pointed", apex: Math.min(H, apex), maxDeg: maxTaper(w, s, H) };
  }
  const ty = H - b * (1 - sn); // height of the tangent point on the tip circle
  if (b > a + 1e-9 || ty < s - 1e-9) return { tipD: 2 * b, ok: false, reason: "tooBig", minDeg: minTaper(w, s, H) };
  return { tipD: 2 * b, ok: true };
}

// Tangent point on the tip circle, as in OpenSCAD's pin_w_at. null if none.
function tangentPoint(w, s, H, d) {
  const a = w / 2, b = d / 2, c = H - b;
  const dd = Math.sqrt(a * a + (c - s) * (c - s));
  if (!(dd > b)) return null;
  const ang = Math.atan2(s - c, a) + Math.acos(b / dd);
  return [b * Math.cos(ang), c + b * Math.sin(ang)];
}

// Taper angle for a tip diameter.
function taperFromTip(w, s, H, d) {
  if (!(d > 0)) return { deg: NaN, ok: false, reason: "pointed" };
  if (!(H - s > 0)) return { deg: NaN, ok: false, reason: "height" };
  const a = w / 2;
  if (d / 2 > a + 1e-9) return { deg: NaN, ok: false, reason: "tooBig", maxTipD: maxTip(w) };
  const t = tangentPoint(w, s, H, d);
  if (!t || t[1] - s <= 1e-12) return { deg: NaN, ok: false, reason: "tooBig", maxTipD: maxTip(w) };
  const deg = Math.atan2(a - t[0], t[1] - s) / D2R;
  return { deg: Math.max(0, deg), ok: true };
}

module.exports = { minTaper, maxTaper, maxTip, tipRadius, tipFromTaper, taperFromTip, tangentPoint };
