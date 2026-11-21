"use strict";
// The view model: one analysis of the current design plus everything the
// drawings, tables and meters need to show it (formatting, badges, ghosts).
// Analyses are cached by their settings, so saved designs cost nothing.
const { analyze } = require("../core/analyze.js");
const { badge } = require("../state/badges.js");
const { dpFor } = require("../state/fields.js");
const F = require("../core/format.js");

const cache = new Map();
function analyzeCached(design) {
  const k = JSON.stringify(design);
  let m = cache.get(k);
  if (!m) {
    m = analyze(design);
    cache.set(k, m);
    if (cache.size > 80) cache.delete(cache.keys().next().value);
  }
  return m;
}

const GHOST_CLASSES = ["g-a", "g-b", "g-c", "g-d"];

// "Design B" -> "B"; other names -> up to 6 letters.
function shortName(name) {
  const m = /^Design\s+(\S+)$/.exec(name || "");
  if (m) return m[1];
  const t = String(name || "").trim();
  return t.length <= 6 ? t : t.slice(0, 5) + "…";
}

function buildVM(store, theta) {
  const s = store.settings, design = store.design;
  const model = analyzeCached(design);
  const last = analyzeCached(store.session.base);
  const changed = JSON.stringify(store.session.base) !== JSON.stringify(design);
  let base = last, baseLabel = "the last change";
  if (s.badgeBase !== "last") {
    const sv = store.getSaved(s.badgeBase);
    if (sv) { base = analyzeCached(sv.design); baseLabel = sv.name; }
  }
  const compared = store.compared();
  const ghosts = [];
  if (s.ghost) {
    if ((s.compareWith === "last" || s.compareWith === "both") && changed) ghosts.push({ m: last, label: "before", cls: "g-last", kind: "last" });
    if (s.compareWith === "saved" || s.compareWith === "both") {
      compared.forEach((sv, i) => ghosts.push({ m: analyzeCached(sv.design), label: sv.name, cls: "g-saved " + GHOST_CLASSES[i % 4], kind: "saved", id: sv.id }));
    }
  }
  // The dial, ruler and meters always mark the last version (while it differs)
  // and the designs checked for Compare. The ghost overlay setting only
  // controls the dashed outlines in the drawings.
  const marks = [];
  if (changed && last.ok) marks.push({ m: last, label: "before", short: "before", cls: "g-last", kind: "last" });
  compared.forEach((sv, i) => {
    const m = analyzeCached(sv.design);
    if (m.ok) marks.push({ m, label: sv.name, short: shortName(sv.name), cls: "g-saved " + GHOST_CLASSES[i % 4], kind: "saved", id: sv.id });
  });
  const dec = s.decimals;
  const vm = {
    model, design, settings: s, base, baseLabel, last, changed, ghosts, marks, compared, theta: theta || 0,
    dir: s.direction === "ccw" ? -1 : 1,
    dp: key => dpFor(key, dec),
    num: (key, v) => F.fixed(v !== undefined ? v : model.v[key], dpFor(key, dec)),
    fmt: (key, v, dp) => F.fixed(v, dp !== undefined ? dp : dpFor(key, dec)),
    badge: key => s.badges ? badge(key, model.v[key], base.v[key], { decimals: dec, colors: s.badgeColors }) : null,
    edited: key => store.session.changed.includes(key),
    badgeVs: (key, now, ref) => badge(key, now, ref, { decimals: dec, colors: s.badgeColors }),
    word: (student, expert) => s.detail === "expert" ? expert : student,
    fmtLen: mm => F.fixed(mm, dpFor("travel", dec) + 1) + " mm",
    fmtIn: mm => F.fixed(mm / 25.4, dpFor("travelIn", dec)) + " in",
    analyze: analyzeCached
  };
  return vm;
}

module.exports = { buildVM, analyzeCached, GHOST_CLASSES };
