"use strict";
// Change badges: "▲ +48.51" when a number went up, "▼ −0.40" when it went down.
// Same decimals as the number beside it; changes too small to show are hidden.
const { METRICS, dpFor } = require("./fields.js");
const F = require("../core/format.js");

// opts: { decimals: 1|2|3, colors: "updown"|"betterworse", unitKey }
function badge(key, now, base, opts = {}) {
  if (!isFinite(now) || !isFinite(base)) return null;
  const dp = opts.dp !== undefined ? opts.dp : dpFor(key, opts.decimals || 2);
  const delta = F.round(now - base, dp);
  if (delta === 0 || Object.is(delta, -0)) return null;
  const up = delta > 0;
  const text = (up ? "▲ +" : "▼ " + F.MINUS) + F.fixed(Math.abs(delta), dp);
  let cls = up ? "up" : "down";
  if (opts.colors === "betterworse") {
    const m = METRICS[opts.zoneKey || key];
    if (m && m.better) {
      const b0 = m.better(base), b1 = m.better(now);
      cls = b1 < b0 - 1e-12 ? "better" : b1 > b0 + 1e-12 ? "worse" : "same";
    } else cls = "same";
  }
  const words = (up ? "up " : "down ") + F.fixed(Math.abs(delta), dp);
  const judged = cls === "better" ? ", better" : cls === "worse" ? ", worse" : "";
  return { text, cls, delta, aria: "went " + words + judged };
}

module.exports = { badge };
