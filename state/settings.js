"use strict";
// Settings dialog choices. Remembered between visits, with their own
// "Reset settings" button (separate from "Reset design").

const CHOICES = {
  compareWith: ["both", "last", "saved"],     // what the ghosts show: last change, checked saved designs, or both
  ghost: [false, true],                        // ghost overlay on the drawings (off by default)
  sideBySide: [true, false],                   // side-by-side panels when 2+ Compare boxes are checked
  lineUp: ["shafts", "sheets"],
  animateBy: ["turn", "slide"],
  ghostStrength: ["medium", "faint", "strong"],
  badges: [true, false],
  badgeBase: null,                             // "last" or a saved design's id (checked by the store)
  badgeColors: ["updown", "betterworse"],
  units: ["in", "mm"],
  decimals: [2, 1, 3],
  detail: ["student", "expert"],
  dimLabels: ["key", "all", "none"],
  grid: [false, true],
  speed: ["auto", "off", "slow", "normal", "fast"],
  hover: [true, false],
  direction: ["cw", "ccw"],
  scheme: ["standard", "contrast"],
  part: ["sprocket", "drill_guide"]
};

const DEFAULT_SETTINGS = Object.freeze(Object.fromEntries(
  Object.entries(CHOICES).map(([k, v]) => [k, v ? v[0] : "last"])
));

function normalizeSettings(s) {
  const out = { ...DEFAULT_SETTINGS };
  if (!s || typeof s !== "object") return out;
  for (const k of Object.keys(out)) {
    if (!(k in s)) continue;
    if (k === "badgeBase") { if (typeof s[k] === "string" && s[k]) out[k] = s[k]; continue; }
    if (CHOICES[k].includes(s[k])) out[k] = s[k];
  }
  return out;
}

// "auto" plays at normal speed unless the device asks for reduced motion.
function effectiveSpeed(settings, reducedMotion) {
  if (settings.speed === "auto") return reducedMotion ? "off" : "normal";
  return settings.speed;
}

module.exports = { CHOICES, DEFAULT_SETTINGS, normalizeSettings, effectiveSpeed };
