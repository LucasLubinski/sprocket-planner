"use strict";
// One full analysis of a design: geometry, the clearance sweep, the two
// sheet-height sweeps, every limit check, and a flat map of numbers (v) that
// the tables, badges, meters and drawings all read. Nothing else computes
// geometry.
const G = require("./geometry.js");
const T = require("./taper.js");
const S = require("./sheetfiles.js");

const SAMPLES = 240;
const SERVO_STD = 300, SERVO_5TURN = 1800;
const HEIGHT_STEP = 0.2;

function sweep(p, n) {
  const d = G.derive(p);
  const tr = G.trace(p, d, n);
  let k = 0;
  for (let i = 1; i < tr.length; i++) if (tr[i][1] < tr[k][1]) k = i;
  return { d, trace: tr, tight: tr[k][1], tightAt: tr[k][0], play: d.play };
}

// Zones for the four fit meters. Each returns "red", "amber" or "green".
const ZONES = {
  play: v => (v < 0.05 || v > 0.6) ? "red" : (v < 0.15 || v > 0.35) ? "amber" : "green",
  tight: v => v < 0 ? "red" : v <= 0.08 ? "amber" : "green",
  web: v => v < 1.5 ? "red" : v <= 2.5 ? "amber" : "green",
  inSheet: v => v < 1 ? "red" : v < 1.5 ? "amber" : "green"
};

function f(v, dp) { return (Math.round(v * 10 ** dp) / 10 ** dp).toFixed(dp).replace("-", "−"); }

function inputValues(p) {
  const v = {};
  for (const k of Object.keys(p)) if (typeof p[k] === "number") v[k] = p[k];
  v.travelIn = p.travel / 25.4;
  return v;
}

function analyze(p) {
  const errors = G.validate(p);
  const v = inputValues(p);
  if (errors.length) {
    return {
      ok: false, p, v, errors,
      checks: errors.map((t, i) => ({ id: "input" + i, level: "stop", title: "Fix this number", text: t })),
      chips: [], counts: { stop: errors.length, warn: 0 }
    };
  }

  const main = sweep(p, SAMPLES);
  const d = main.d;
  const loGap = Math.max(0, p.gap - HEIGHT_STEP), hiGap = p.gap + HEIGHT_STEP;
  const lo = sweep({ ...p, gap: loGap }, SAMPLES);
  const hi = sweep({ ...p, gap: hiGap }, SAMPLES);
  const sheet = S.sheetLayout(p, d);
  const geoTaper = T.taperFromTip(p.pinW, p.pinStraight, p.pinH, p.tipD);
  const heldTip = isFinite(p.taper) ? T.tipFromTaper(p.pinW, p.pinStraight, p.pinH, p.taper) : null;

  Object.assign(v, {
    tpr: d.tpr, perDeg: d.perDeg, P: d.P, Rp: d.Rp, pitchD: d.pitchD, drumD: d.drumD, r0: d.r0,
    overD: d.overD, tipR: d.tipR, yb: d.yb, web: d.web, wUnder: d.wUnder, play: d.play,
    tight: main.tight, tightAt: main.tightAt, inSheet: d.inSheet, win: d.win, holes: d.holes,
    run: d.run, guideLen: d.guideLen, nGuide: d.nGuide, step: d.step,
    hubMinD: d.hubMinD, hubRoom: d.r0 - d.hubMinR, boltR: d.boltR,
    screwL: d.screwL === undefined ? NaN : d.screwL, pinGapOnDrum: d.pinGapOnDrum,
    loGap, loPlay: lo.play, loTight: lo.tight, hiGap, hiPlay: hi.play, hiTight: hi.tight,
    sheetLen: sheet.L, rowOffset: sheet.rowY, sheetHoles: sheet.n,
    slotH: p.sheetT + p.trackClearT, slotW: p.sheetW + p.trackClearW,
    rowFromWall: sheet.rowY + p.trackClearW / 2,
    turns: p.rotation / 360, slab: p.pinFlat * p.pinW,
    taperGeo: geoTaper.ok ? geoTaper.deg : NaN,
    guideBoxL: (d.nGuide - 1) * d.P + 12, guideBoxW: p.edgeOffset + p.holeD / 2 + 6 + 4,
    guideBoxH: p.guideT + p.sheetT * 0.8
  });

  // ---------- checks: each one plain words plus how to fix it ----------
  const checks = [];
  const add = (id, level, title, text) => checks.push({ id, level, title, text });

  if (!(d.play > 0)) add("holes", "stop", "Pins wider than the holes",
    "Pins are " + f(d.wUnder, 2) + " mm wide where they enter " + f(p.holeD, 2) + " mm holes. Use thinner pins or bigger holes.");
  if (main.tight < 0) add("fit", "stop", "Pins hit the hole edges",
    "Pins hit the hole edges while turning. Use thinner pins, a steeper taper, or bigger holes.");
  else if (main.tight <= 0.08) add("fit", "warn", "Tight while turning",
    "Pins clear the holes by only " + f(main.tight, 3) + " mm. Thinner pins or bigger holes give more room.");
  if (d.web < 1.5) add("web", "stop", "Holes too close",
    "Holes too close: use fewer pins or a bigger turn-to-slide ratio.");
  else if (d.web <= 2.5) add("web", "warn", "Thin plastic between holes",
    "Only " + f(d.web, 2) + " mm of plastic between holes. It may crack. Use fewer pins.");
  if (d.r0 < d.hubMinR) add("hub", "stop", "Wheel too small for the hub screws",
    "The wheel must be at least " + f(d.hubMinD, 2) + " mm across for the screws. Slide farther per turn, or turn less.");
  if (d.inSheet < 1) add("inSheet", "stop", "No pin holds the sheet at times",
    "At times no pin is in the sheet. Use more pins or taller pins.");
  else if (d.inSheet < 1.5) add("inSheet", "warn", "Few pins in the sheet",
    "Sometimes only one pin pushes the sheet. More pins share the push.");
  if (p.rotation > SERVO_5TURN) add("servo", "stop", "Past the 5-turn servo",
    "A 5-turn servo stops at 1800°. Continuous mode turns farther but loses position control.");
  else if (p.rotation > SERVO_STD) add("servo", "warn", "Needs a 5-turn servo",
    "A standard servo turns only 300°. Use a 5-turn servo for this design.");
  const loBad = lo.tight < 0 || !(lo.play > 0), hiBad = hi.tight < 0 || !(hi.play > 0);
  if (loBad || hiBad) add("height", "warn", "Fussy about sheet height",
    "If the sheet sits " + (loBad ? f(p.gap - loGap, 1) + " mm lower" : HEIGHT_STEP + " mm higher") +
    ", pins rub. Build the track carefully, or use straight pins.");

  if (!(p.pinH > p.gap + p.sheetT)) add("reach", "stop", "Pins too short",
    "Pins don't reach through the sheet. Make them taller than " + f(p.gap + p.sheetT, 2) + " mm.");
  if (!(p.pinStraight < p.pinH)) add("straight", "stop", "Straight part too tall",
    "The straight part is taller than the pin. Shorten it or make the pin taller.");
  else if (!(p.tipD > 0)) add("tip", "stop", "Pin comes to a point",
    "Pin comes to a point; lower the angle or the height.");
  else if (!geoTaper.ok || (heldTip && heldTip.reason === "tooBig")) {
    const minDeg = T.minTaper(p.pinW, p.pinStraight, p.pinH);
    add("tip", "stop", "Tip too big",
      p.tipD > p.pinW
        ? "The tip is wider than the pin. Make the tip smaller than " + f(p.pinW, 2) + " mm."
        : "The tip is too big for this angle. Use at least " + f(minDeg, 1) + "°, or make the pin taller.");
  }
  if (!(2 * Math.PI * d.r0 / p.teeth > p.pinW + 1)) add("merge", "stop", "Pins run together",
    "Pins run together on the wheel. Use fewer pins or thinner pins.");

  // hub mount
  const boltInner = d.boltR - p.boltHoleD / 2;
  if (!(boltInner > p.centerD / 2 + 1)) add("hubCenter", "stop", "Bolt holes hit the center hole",
    "Bolt holes run into the center hole. Make the center hole smaller or the bolt pattern bigger.");
  if (p.pilot && !(p.pilotD / 2 < boltInner)) add("hubPilot", "stop", "Pilot ring hits the bolt holes",
    "The pilot ring runs into the bolt holes. Make the pilot ring smaller.");
  if (p.pilot && !(p.centerD <= p.pilotD - 2)) add("hubPilotCenter", "stop", "Center hole too big for the pilot ring",
    "The center hole must be at least 2 mm smaller than the pilot ring (" + f(p.pilotD, 1) + " mm).");
  if (!(p.counterbore <= p.drumW - 1)) add("hubCounterbore", "stop", "Counterbore too deep",
    "Less than 1 mm of plastic is left under the screw heads. Make the counterbore shallower.");
  if (!(v.slab < p.drumW)) add("hubFlat", "stop", "Pins thicker than the wheel",
    "Flattened pins (" + f(v.slab, 2) + " mm) must be thinner than the wheel (" + f(p.drumW, 2) + " mm).");
  if (d.screwL === undefined) add("hubScrew", "stop", "No screw long enough",
    "No standard M4 screw is long enough. Make the wheel thinner or add a counterbore.");
  if (p.counterbore > 0 && !(p.boltHeadD > p.boltHoleD)) add("hubHead", "warn", "Screw head room too small",
    "The counterbore must be wider than the bolt hole. Raise the screw head room.");

  // drill guide and sheet file
  if (p.guideHoleD < p.holeD) add("guideHole", "warn", "Guide holes too small",
    "Guide holes are smaller than the sheet holes. Make them a bit bigger than the drill.");
  if (sheet.edgeGap < 0) add("sheetEdge", "stop", "Holes run off the sheet",
    "Holes run off the edge of the sheet. Move the hole row or widen the sheet.");
  if (sheet.endGap < 0) add("sheetEnd", "stop", "Sheet too short for the holes",
    "The sheet is too short for all the holes. Make it longer or use fewer holes.");
  if (p.edgeOffset - p.holeD / 2 < 0) add("guideEdge", "stop", "Guide holes off the edge",
    "The drill guide puts holes past the sheet edge. Raise the edge distance.");

  const level = id => { const c = checks.find(x => x.id === id); return c ? c.level : "ok"; };
  const chips = [
    { id: "holes", level: level("holes"), text: level("holes") === "ok" ? "Pins fit the holes" : "Pins wider than holes" },
    { id: "fit", level: level("fit"), text: { ok: "Turns freely", warn: "Tight while turning", stop: "Pins hit hole edges" }[level("fit")] },
    { id: "web", level: level("web"), text: { ok: "Strong plastic between holes", warn: "Thin plastic between holes", stop: "Holes too close" }[level("web")] },
    { id: "hub", level: level("hub"), text: level("hub") === "ok" ? "Hub screws fit" : "Wheel too small for hub screws" },
    { id: "inSheet", level: level("inSheet"), text: f(d.inSheet, 1) + " pins in the sheet at once" },
    { id: "servo", level: level("servo"), text: { ok: "Standard servo is enough", warn: "Needs a 5-turn servo", stop: "Past 5-turn servo range" }[level("servo")] },
    { id: "height", level: level("height"), text: level("height") === "ok" ? "Not fussy about sheet height" : "Fussy about sheet height" }
  ];

  const order = { stop: 0, warn: 1 };
  checks.sort((a, b) => order[a.level] - order[b.level]);
  const counts = { stop: checks.filter(c => c.level === "stop").length, warn: checks.filter(c => c.level === "warn").length };
  const zones = { play: ZONES.play(d.play), tight: ZONES.tight(main.tight), web: ZONES.web(d.web), inSheet: ZONES.inSheet(d.inSheet) };
  const servo = p.rotation <= SERVO_STD ? "standard" : p.rotation <= SERVO_5TURN ? "5-turn" : "continuous";

  return {
    ok: true, p, d, v, errors: [], checks, chips, counts, zones, servo, sheet,
    trace: main.trace, lo, hi, geoTaper, heldTip
  };
}

module.exports = { analyze, sweep, ZONES, SAMPLES, SERVO_STD, SERVO_5TURN, HEIGHT_STEP };
