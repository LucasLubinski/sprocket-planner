"use strict";
// Linked inputs: when one field is edited, which others stay fixed and which
// follow (the "Field edited / Stays fixed / Changes" table in CLAUDE.md), and
// what moves instead when a lock is in the way (the "Which number moves
// instead" table). Typing, spinner arrows, drag handles, type-in-place and
// buttons all come through route().
const T = require("../core/taper.js");
const { GOBILDA_HUB, HUB_KEYS } = require("../core/params.js");
const { METRICS } = require("./fields.js");

// Boxes that can be locked (hub, drill guide and sheet-file boxes don't
// interact with anything, so they have no lock).
const LOCKABLE = ["rotation", "travel", "teeth", "P", "pitchD", "drumD", "holeD", "sheetT", "gap",
  "pinW", "pinH", "taper", "tipD", "pinStraight"];
const MOTION = ["rotation", "travel", "teeth", "P", "pitchD", "drumD", "sheetT", "gap"];
const PIN = ["pinW", "pinH", "pinStraight", "taper", "tipD"];

// For each edited field: the number that normally moves, then what moves
// instead, left to right. Pins on the wheel is never picked (it must stay whole).
const MOVERS = {
  rotation: ["drumD", "travel"],
  travel: ["drumD", "rotation"],
  teeth: ["P", "rotation", "travel"],
  P: ["travel", "rotation"],
  pitchD: ["travel", "rotation"],
  drumD: ["travel", "rotation"],
  sheetT: ["drumD", "travel", "rotation"],
  gap: ["drumD", "travel", "rotation"],
  pinW: ["tipD", "taper"],
  pinH: ["tipD", "taper"],
  pinStraight: ["tipD", "taper"],
  straightPast: ["tipD", "taper"],
  shape: ["tipD", "taper"],
  taper: ["tipD", "pinH"],
  tipD: ["taper", "pinH"]
};

// The one-line "why" for each relation a lock reason uses.
const WHY = {
  motion: "Slide = push circle × π × turn ÷ 360.",
  spacing: "Hole spacing = slide per full turn ÷ pins.",
  sheet: "Push circle = wheel size + 2 × gap + sheet thickness.",
  pin: "Tip size and slant are tied by the pin's width and height."
};
function whyFor(key, mover) {
  if (PIN.includes(key) || key === "shape" || key === "straightPast") return WHY.pin;
  if (key === "teeth" || key === "P" || mover === "P") return WHY.spacing;
  if (key === "sheetT" || key === "gap") return WHY.sheet;
  return WHY.motion;
}

const nameOf = k => (METRICS[k] && METRICS[k].name) || k;

// ---------- values, including the derived ones ----------
const trevOf = d => d.travel * 360 / d.rotation;
function valueOf(d, key) {
  switch (key) {
    case "P": return trevOf(d) / d.teeth;
    case "pitchD": return trevOf(d) / Math.PI;
    case "drumD": return trevOf(d) / Math.PI - 2 * d.gap - d.sheetT;
    default: return d[key];
  }
}
function same(a, b) {
  if (typeof a !== "number" || typeof b !== "number") return a === b;
  if (Number.isNaN(a) && Number.isNaN(b)) return true;
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}

// ---------- the pin: tip size <-> side slant, holding width, straight part, height ----------
// Move `mover` so the pin stays consistent after its width, height or straight part changed.
function settlePin(d, mover) {
  if (mover === "tipD") {
    if (isFinite(d.taper)) {
      const r = T.tipFromTaper(d.pinW, d.pinStraight, d.pinH, d.taper);
      if (isFinite(r.tipD)) { d.tipD = r.tipD; return d; }
    }
    // no usable angle (the tip was too big): keep the tip and re-measure the angle
    d.taper = T.taperFromTip(d.pinW, d.pinStraight, d.pinH, d.tipD).deg;
    return d;
  }
  if (mover === "taper") {
    const r = T.taperFromTip(d.pinW, d.pinStraight, d.pinH, d.tipD);
    if (!r.ok) return null; // this tip can't fit on this pin: let the next option try
    d.taper = r.deg;
    return d;
  }
  return d;
}
// Pin height that gives tip d at slant alpha (width and straight part held).
function heightFor(w, s, deg, tipD) {
  const al = deg * Math.PI / 180, sn = Math.sin(al);
  if (!(sn > 1e-6)) return NaN;
  const H = s + (w / 2 * Math.cos(al) - tipD / 2 * (1 - sn)) / sn;
  return H > s ? H : NaN;
}

function straightFor(d) { return Math.max(0, d.gap + d.sheetT + (d.straightPast || 0)); }

// "Straight through the sheet" keeps the straight part = gap + thickness (+ extra).
function followStraight(d, locks = []) {
  if (d.shape !== "straight" || locks.includes("pinStraight")) return d;
  const s = straightFor(d);
  if (same(s, d.pinStraight)) return d;
  for (const m of ["tipD", "taper"]) {
    if (locks.includes(m)) continue;
    const nd = settlePin({ ...d, pinStraight: s }, m);
    if (nd && !violated(d, nd, locks).length) return nd;
  }
  return d; // nothing can follow without breaking a lock: leave the pin as it is
}

// ---------- one edit with one chosen mover (no lock checks here) ----------
function solve(design, key, value, mover, locks = []) {
  let d = { ...design };
  const trev0 = trevOf(design);
  const fromTrev = trev => {
    if (!(trev > 0) || !isFinite(trev)) return null;
    if (mover === "travel") d.travel = trev * d.rotation / 360;
    else if (mover === "rotation") d.rotation = d.travel * 360 / trev;
    else return null;
    return d;
  };
  switch (key) {
    case "rotation":
      d.rotation = value;
      if (mover === "travel") d.travel = trev0 * value / 360;
      return d;
    case "travel":
      d.travel = value;
      if (mover === "rotation") { if (!(value > 0)) return null; d.rotation = value * 360 / trev0; }
      return d;
    case "teeth":
      d.teeth = value;
      if (mover === "P") return d;
      return fromTrev(value * valueOf(design, "P"));
    case "P": return fromTrev(value * d.teeth);
    case "pitchD": return fromTrev(Math.PI * value);
    case "drumD": return fromTrev(Math.PI * (value + 2 * d.gap + d.sheetT));
    case "sheetT": case "gap": {
      d[key] = value;
      if (mover !== "drumD") {
        const drum0 = valueOf(design, "drumD");
        if (!fromTrev(Math.PI * (drum0 + 2 * d.gap + d.sheetT))) return null;
      }
      return followStraight(d, locks);
    }
    case "pinW": case "pinH": d[key] = value; return settlePin(d, mover);
    case "pinStraight": d.pinStraight = value; d.shape = "custom"; return settlePin(d, mover);
    case "straightPast":
      d.straightPast = value;
      if (d.shape !== "straight") return d;
      d.pinStraight = straightFor(d);
      return settlePin(d, mover);
    case "shape":
      d.shape = value;
      d.pinStraight = value === "straight" ? straightFor(d) : 0;
      return settlePin(d, mover);
    case "taper": {
      d.taper = value;
      if (mover === "pinH") {
        const H = heightFor(d.pinW, d.pinStraight, value, d.tipD);
        if (!isFinite(H)) return null;
        d.pinH = H;
        return d;
      }
      const r = T.tipFromTaper(d.pinW, d.pinStraight, d.pinH, value);
      if (isFinite(r.tipD)) d.tipD = r.tipD;
      return d;
    }
    case "tipD": {
      d.tipD = value;
      if (mover === "pinH") {
        const H = heightFor(d.pinW, d.pinStraight, d.taper, value);
        if (!isFinite(H)) return null;
        d.pinH = H;
        return d;
      }
      d.taper = T.taperFromTip(d.pinW, d.pinStraight, d.pinH, value).deg;
      return d;
    }
    case "hub":
      d.hub = value;
      if (value === "gobilda") Object.assign(d, GOBILDA_HUB);
      return d;
    case "pilot": d.pilot = !!value; return d;
    case "sheetLen": case "rowOffset": d[key] = value === null ? null : value; return d;
    default: d[key] = value; return d;
  }
}

// Locked numbers that an edit would change.
function violated(before, after, locks) {
  return locks.filter(k => !same(valueOf(before, k), valueOf(after, k)));
}

// ---------- held boxes: numbers the locks fix together ----------
// Returns { key: [lock keys] } for boxes that aren't locked themselves but
// can't change while these locks are on.
function heldBy(locks) {
  const L = new Set(locks), K = new Set(locks);
  let trev = false, grew = true;
  while (grew) {
    grew = false;
    const add = k => { if (!K.has(k)) { K.add(k); grew = true; } };
    if (!trev && ((K.has("rotation") && K.has("travel")) || K.has("pitchD") || (K.has("teeth") && K.has("P")) ||
      (K.has("drumD") && K.has("gap") && K.has("sheetT")))) { trev = true; grew = true; }
    if (trev) {
      add("pitchD"); add("drumD");
      if (K.has("rotation")) add("travel");
      if (K.has("travel")) add("rotation");
      if (K.has("teeth")) add("P");
    }
    const pinKnown = PIN.filter(k => K.has(k));
    if (pinKnown.length === 4) for (const k of PIN) add(k);
  }
  const out = {};
  for (const k of K) {
    if (L.has(k)) continue;
    const group = PIN.includes(k) ? PIN : MOTION;
    out[k] = locks.filter(x => group.includes(x));
  }
  return out;
}

// ---------- routing ----------
// route(design, key, value, { locks, mover }) ->
//   { design, mover, normal, options: [{ mover, design }], blocked: { mover: [lock keys] }, refused, by }
// `mover` is the student's pick from the chooser; it falls back to the first
// free option. When nothing can move, refused is true and design is unchanged.
function route(design, key, value, { locks = [], mover = null } = {}) {
  const movers = MOVERS[key] || [null];
  const options = [], blocked = {};
  for (const m of movers) {
    if (m && locks.includes(m)) { blocked[m] = [m]; continue; }
    const nd = solve(design, key, value, m, locks);
    if (!nd) { blocked[m] = []; continue; }
    const v = violated(design, nd, locks);
    if (v.length) { blocked[m] = v; continue; }
    options.push({ mover: m, design: nd });
  }
  if (!options.length) {
    const by = [...new Set(Object.values(blocked).flat())];
    return { design, mover: null, normal: movers[0], options, blocked, refused: true, by, key, value };
  }
  const pick = options.find(o => o.mover === mover) || options[0];
  return { design: pick.design, mover: pick.mover, normal: movers[0], options, blocked, refused: false, by: [], key, value };
}

// Returns a new design with `key` set to `value` and the linked fields updated
// (no locks). Lengths are in mm; travel in mm (the UI converts inches first).
function applyField(design, key, value) { return route(design, key, value).design; }

// Pin width, straight part or height changed: hold the taper angle, move the tip.
function holdTaper(d) { return settlePin(d, "tipD"); }

// Hub mount settings are locked to the goBILDA preset unless the hub is Custom.
function isLocked(design, key) {
  return design.hub === "gobilda" && HUB_KEYS.includes(key);
}

// ---------- words ----------
function listNames(keys) {
  const n = keys.map(nameOf);
  return n.length <= 1 ? n.join("") : n.slice(0, -1).join(", ") + " and " + n[n.length - 1];
}

// The note beside the edited box when a lock sent the change somewhere else,
// or the message when nothing could move. fmt(key, value) -> "6 in".
// Returns null when the usual number moved.
function describeRoute(r, before, fmt, locks = []) {
  if (!r) return null;
  if (r.refused) {
    const by = r.by.length ? r.by : locks.filter(k => (MOTION.includes(r.key) ? MOTION : PIN).includes(k));
    const held = heldBy(locks)[r.key];
    const verb = by.length === 1 ? "is locked." : by.length === 2 ? "are both locked." : "are locked.";
    const why = held ? "Together they fix the " + nameOf(r.key).toLowerCase() + "." :
      r.key === "teeth" || MOTION.includes(r.key) ? "Pins must stay whole, so nothing else can move." : "No other number can move to make room.";
    const sentences = ["Can't change " + nameOf(r.key) + ".", by.length ? listNames(by) + " " + verb : "", by.length === 1 && !held ? whyFor(r.key) : why,
      by.length === 1 ? "Unlock it." : "Unlock one."].filter(Boolean);
    return { kind: "refused", text: sentences.join(" "), first: sentences.slice(0, 2).join(" ") };
  }
  if (!r.normal || r.mover === r.normal || !r.blocked[r.normal]) return null;
  const by = r.blocked[r.normal];
  let first;
  if (by.length === 1 && by[0] === r.normal) first = nameOf(r.normal) + " is locked at " + fmt(r.normal, valueOf(before, r.normal)) + ".";
  else if (by.length) first = nameOf(r.normal) + " is held by the " + (by.length === 1 ? "lock on " : "locks on ") + listNames(by) + ".";
  else first = nameOf(r.normal) + " can't move that far.";
  const so = "So " + nameOf(r.mover) + " is now " + fmt(r.mover, valueOf(r.design, r.mover)) + " instead of " + fmt(r.mover, valueOf(before, r.mover)) + ".";
  return { kind: "moved", text: [first, whyFor(r.key, r.mover), so].join(" "), first };
}

// One line per option for the chooser: "Sheet slides: 6 in → 7.71 in".
function optionLines(r, before, fmt) {
  return r.options.map(o => ({
    mover: o.mover, name: nameOf(o.mover),
    text: nameOf(o.mover) + ": " + fmt(o.mover, valueOf(before, o.mover)) + " → " + fmt(o.mover, valueOf(o.design, o.mover))
  }));
}

module.exports = {
  LOCKABLE, MOVERS, WHY, whyFor, applyField, route, solve, heldBy, valueOf, violated, describeRoute, optionLines,
  holdTaper, followStraight, isLocked, nameOf
};
