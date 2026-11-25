"use strict";
// Every input box and every displayed number: plain name first, real term
// second, unit, decimals, hint, callout and "?" explainer. Inputs, tables,
// badges and drawings all look numbers up here, so one edit changes the words
// everywhere.

// Decimals at "normal" (2). Simple shows one less, precise one more.
// Counts are always whole numbers.
const GROUPS = [
  { id: "motion", title: "Turn and slide", level: "student" },
  { id: "sheet", title: "Sheet and holes", level: "student" },
  { id: "wheel", title: "Wheel size", level: "student" },
  { id: "pins", title: "Pins", level: "student" },
  { id: "hub", title: "Hub mount", level: "expert" },
  { id: "guide", title: "Drill guide", level: "expert" },
  { id: "cnc", title: "Sheet file for CNC", level: "expert" },
  { id: "track", title: "Track", level: "expert" }
];

// type: "num" (default), "check", "shape", "hub"
const FIELDS = [
  // ---- motion ----
  { key: "rotation", group: "motion", name: "Wheel turns", term: "turn", unit: "°", step: 1, big: 15, maxDp: 2,
    hint: "How far the servo turns the wheel.",
    callout: "Wheel turns: how far the servo turns the wheel, in degrees.",
    explain: { anim: "turn", text: ["The servo turns the wheel this many degrees.", "360° is one full turn.", "A standard servo stops at 300°."] } },
  { key: "travel", group: "motion", name: "Sheet slides", term: "travel", unit: "mm", step: 1, big: 10, maxDp: 3,
    stepIn: 0.25, bigIn: 1,
    hint: "How far the sheet moves during that turn.",
    callout: "Sheet slides: how far the sheet moves while the wheel turns.",
    explain: { anim: "slide", text: ["The sheet moves this far while the wheel turns.", "More slide for the same turn needs a bigger wheel."] } },
  { key: "teeth", group: "motion", name: "Pins on the wheel", term: "teeth", unit: "", step: 1, big: 4, int: true, maxDp: 0,
    hint: "More pins put the holes closer together.",
    callout: "Pins on the wheel: how many pins stick out around the wheel.",
    explain: { anim: "pins", text: ["Each pin pushes the sheet through one hole.", "More pins put the holes closer together.", "Too many pins leave thin plastic between holes."] } },

  // ---- sheet ----
  { key: "P", group: "sheet", name: "Hole spacing", term: "pitch", unit: "mm", step: 0.1, big: 1, maxDp: 4, derived: true,
    hint: "Center of one hole to the center of the next.",
    callout: "Hole spacing: center of one hole to the center of the next.",
    explain: { anim: "spacing", text: ["Measure from one hole's center to the next hole's center.", "Pins × hole spacing = slide for one full turn."] } },
  { key: "holeD", group: "sheet", name: "Hole size", term: "hole diameter", unit: "mm", step: 0.1, big: 0.5, maxDp: 3,
    hint: "Drill bit size for the holes in the sheet.",
    callout: "Hole size: how wide each hole in the sheet is.",
    explain: { anim: "play", text: ["Each pin pokes up through one hole.", "Bigger holes give more wiggle room.", "Too big, and the sheet rattles."] } },
  { key: "sheetT", group: "sheet", name: "Sheet thickness", term: "sheet_t", unit: "mm", step: 0.1, big: 0.5, maxDp: 3,
    hint: "How thick the plastic sheet is.",
    callout: "Sheet thickness: how thick the polycarbonate sheet is.",
    explain: { anim: "thickness", text: ["Measure the sheet with calipers.", "A thicker sheet sits a little higher on the wheel."] } },
  { key: "gap", group: "sheet", level: "expert", name: "Gap under the sheet", term: "sheet gap", unit: "mm", step: 0.05, big: 0.2, maxDp: 3,
    hint: "Space between the wheel and the sheet's underside.",
    callout: "Gap under the sheet: the space between the wheel and the sheet.",
    explain: { anim: "gap", text: ["The track holds the sheet just above the wheel.", "Tapered pins get tighter when the sheet sits lower."] } },

  // ---- wheel ----
  { key: "pitchD", group: "wheel", name: "Push circle", term: "pitch diameter", unit: "mm", step: 0.1, big: 1, maxDp: 3, derived: true,
    hint: "The circle where the pins push the sheet.",
    callout: "Pitch diameter: the circle where the pins push the sheet.",
    explain: { anim: "roll", text: ["Picture this circle rolling along the middle of the sheet.", "One turn rolls out pins × hole spacing.", "A bigger circle slides the sheet farther per turn."] } },
  { key: "drumD", group: "wheel", name: "Wheel size", term: "drum diameter", unit: "mm", step: 0.1, big: 1, maxDp: 3, derived: true,
    hint: "How wide the round wheel is, not counting pins.",
    callout: "Wheel size: the round part of the sprocket, without the pins.",
    explain: { anim: "drum", text: ["This is the wheel's width without the pins.", "The hub screws need room inside the wheel."] } },

  // ---- pins ----
  { key: "shape", group: "pins", type: "shape", name: "Pin shape", term: "profile",
    hint: "Tapered pins lean in. Straight pins stay full width through the sheet.",
    callout: "Pin shape: tapered sides, or straight through the sheet.",
    explain: { anim: "pinshape", text: ["Tapered pins find the holes easily.", "Straight pins don't mind if the sheet sits high or low."] } },
  { key: "pinW", group: "pins", name: "Pin width", term: "pin_d", unit: "mm", step: 0.1, big: 0.5, maxDp: 3,
    hint: "How wide each pin is where it meets the wheel.",
    callout: "Pin width: how wide each pin is at the wheel.",
    explain: { anim: "play", text: ["Wider pins are stronger.", "Pins must be thinner than the holes.", "The space left over is the wiggle room."] } },
  { key: "pinH", group: "pins", name: "Pin height", term: "pin_h", unit: "mm", step: 0.1, big: 0.5, maxDp: 3,
    hint: "How far each pin sticks out of the wheel.",
    callout: "Pin height: how far each pin sticks up from the wheel.",
    explain: { anim: "pinshape", text: ["Pins must poke all the way through the sheet.", "Taller pins hold the sheet better."] } },
  { key: "taper", group: "pins", name: "Side slant", term: "taper angle", unit: "°", step: 1, big: 5, maxDp: 2, derived: true,
    hint: "How much the pin's sides lean in. 0° is straight.",
    callout: "Taper angle: how much the pin's sides lean in from straight up.",
    explain: { anim: "pinshape", text: ["0° gives straight sides and a round end.", "More slant makes a pointier pin.", "Too much slant and the pin comes to a point."] } },
  { key: "tipD", group: "pins", level: "expert", name: "Tip size", term: "tip diameter", unit: "mm", step: 0.1, big: 0.5, maxDp: 3,
    hint: "How wide the rounded end of the pin is.",
    callout: "Tip diameter: the rounded end of the pin.",
    explain: { anim: "pinshape", text: ["A round tip helps the pin find its hole.", "A bigger tip means less slant."] } },
  { key: "pinStraight", group: "pins", level: "expert", name: "Straight part", term: "straight section", unit: "mm", step: 0.1, big: 0.5, maxDp: 3,
    hint: "The pin stays full width this far up, then slants.",
    callout: "Straight section: the part of the pin that stays full width.",
    explain: { anim: "pinshape", text: ["Straight pins stay full width through the sheet.", "Then the sheet height doesn't matter much."] } },
  { key: "keepTip", group: "pins", type: "lockcheck", lockKey: "tipD", hl: "tipD", name: "Keep the tip round", term: "hold tip size",
    hint: "Keeps the tip's size. Then the side slant changes instead.",
    callout: "Keep the tip round: the tip stays the same size when you change the pin.",
    explain: { anim: "pinshape", text: ["A taller pin with the same slant gets a smaller tip.", "Too tall and the tip shrinks to a point.", "Check this to keep the tip round. The slant changes instead."] } },
  { key: "straightPast", group: "pins", name: "Straight past the sheet", term: "extra straight", unit: "mm", step: 0.1, big: 0.5, maxDp: 3, hl: "pinStraight",
    showIf: d => d.shape === "straight",
    hint: "How far the full-width part goes above the sheet before the slant starts.",
    callout: "Straight past the sheet: how far the pin stays full width above the sheet.",
    explain: { anim: "pinshape", text: ["Straight pins stay full width through the sheet.", "This adds a little more straight part above it.", "Use a minus number to end it inside the sheet."] } },
  { key: "pinFlat", group: "pins", level: "expert", name: "Pin flattening", term: "pin_flat", unit: "× width", step: 0.05, big: 0.1, maxDp: 3,
    hint: "Pins are trimmed flat so they print without supports.",
    callout: "Pin flattening: pins are trimmed flat to print without supports.",
    explain: { anim: "flat", text: ["Round pins would need supports to print.", "Trimming them flat top and bottom fixes that."] } },
  { key: "pinCenter", group: "pins", type: "check", name: "Center the pins", term: "pin_center",
    hint: "Off: pins sit flush with the outer face. On: they sit in the middle of the wheel.",
    callout: "Center the pins: where the pins sit across the wheel's thickness.",
    explain: { anim: "pinpos", text: ["Off, the pins line up with the outer face.", "They print flat on the bed with no supports.", "On, they sit in the middle of the wheel.", "Then they may need supports to print."] } },

  // ---- hub mount ----
  { key: "hub", group: "hub", type: "hub", name: "Hub", term: "preset",
    hint: "goBILDA locks these to its 32 mm hub. Custom unlocks them.",
    callout: "Hub: the servo hub the sprocket bolts onto.",
    explain: { anim: "hub", text: ["The sprocket bolts to a 32 mm servo hub.", "Pick Custom to change the hole sizes."] } },
  { key: "boltSquare", group: "hub", hubLocked: true, name: "Bolt pattern", term: "bolt square", unit: "mm", step: 0.5, big: 2, maxDp: 3,
    hint: "Four M4 screws sit on the corners of this square.",
    callout: "Bolt pattern: the square the four hub screws sit on.",
    explain: { anim: "hub", text: ["Four screws hold the sprocket to the hub.", "They sit on the corners of a square."] } },
  { key: "boltHoleD", group: "hub", hubLocked: true, name: "Bolt hole size", term: "bolt_hole_d", unit: "mm", step: 0.1, big: 0.5, maxDp: 3,
    hint: "Room for M4 screws. Raise it if holes print tight.",
    callout: "Bolt hole size: the holes the hub screws pass through.",
    explain: { anim: "hub", text: ["M4 screws are 4 mm thick.", "Printed holes come out a bit small, so add room."] } },
  { key: "boltHeadD", group: "hub", hubLocked: true, name: "Screw head room", term: "bolt_head_d", unit: "mm", step: 0.1, big: 0.5, maxDp: 3,
    hint: "Room for the screw heads. Sets the smallest wheel.",
    callout: "Screw head room: space for the M4 screw heads.",
    explain: { anim: "hub", text: ["Screw heads must fit inside the wheel.", "Bigger head room needs a bigger wheel."] } },
  { key: "counterbore", group: "hub", hubLocked: true, name: "Counterbore depth", term: "counterbore", unit: "mm", step: 0.5, big: 1, maxDp: 3,
    hint: "Sinks the screw heads into the outer face.",
    callout: "Counterbore: a pocket that sinks the screw heads into the wheel.",
    explain: { anim: "edge", text: ["A counterbore is a pocket for the screw head.", "Deeper pockets use shorter screws."] } },
  { key: "centerD", group: "hub", hubLocked: true, name: "Center hole size", term: "center_d", unit: "mm", step: 0.5, big: 1, maxDp: 3,
    hint: "Lets the servo screw and a screwdriver through.",
    callout: "Center hole: lets the servo screw and a screwdriver through.",
    explain: { anim: "hub", text: ["The servo screw sits in the middle.", "The screwdriver reaches it through this hole."] } },
  { key: "pilot", group: "hub", type: "check", hubLocked: true, name: "Pilot ring", term: "pilot",
    hint: "A short ring that centers the sprocket on the hub.",
    callout: "Pilot ring: a short ring that drops into the hub to center the sprocket.",
    explain: { anim: "edge", text: ["The ring drops into the hub's 14 mm recess.", "It keeps the sprocket centered."] } },
  { key: "pilotD", group: "hub", hubLocked: true, name: "Pilot ring size", term: "pilot_d", unit: "mm", step: 0.1, big: 0.5, maxDp: 3,
    hint: "Fits the hub's 14 mm recess.",
    callout: "Pilot ring size: how wide the centering ring is.",
    explain: { anim: "hub", text: ["The hub has a 14 mm recess.", "The ring is a little smaller so it fits."] } },
  { key: "pilotH", group: "hub", hubLocked: true, name: "Pilot ring height", term: "pilot_h", unit: "mm", step: 0.1, big: 0.5, maxDp: 3,
    hint: "Short, so it clears the servo screw head.",
    callout: "Pilot ring height: how far the ring sticks out of the hub side.",
    explain: { anim: "edge", text: ["The ring only needs to be short.", "Too tall and it hits the servo screw."] } },
  { key: "drumW", group: "hub", name: "Sprocket thickness", term: "drum_w", unit: "mm", step: 0.5, big: 1, maxDp: 3,
    hint: "How thick the wheel's body is. Sets the screw length.",
    callout: "Sprocket thickness: how thick the wheel's body is.",
    explain: { anim: "edge", text: ["A thicker wheel is stronger.", "It also needs longer screws."] } },

  // ---- drill guide ----
  { key: "guideHoles", group: "guide", name: "Holes in the guide and sheet", term: "guide_holes", unit: "", step: 1, big: 5, int: true, maxDp: 0,
    hint: "0 means enough holes for the full travel.",
    callout: "Guide holes: how many holes the drill guide (and sheet file) has.",
    explain: { anim: "guide", text: ["The guide is a strip with holes at the exact spacing.", "Clamp it to the sheet and drill through each hole."] } },
  { key: "edgeOffset", group: "guide", name: "Sheet edge to hole line", term: "edge_offset", unit: "mm", step: 0.5, big: 2, maxDp: 3,
    hint: "How far the guide puts the holes from the sheet's edge.",
    callout: "Edge offset: the sheet's edge to the line of holes.",
    explain: { anim: "guide", text: ["The guide's fence rests on the sheet's edge.", "The holes land this far in from the edge."] } },
  { key: "guideT", group: "guide", name: "Guide thickness", term: "guide_t", unit: "mm", step: 0.5, big: 1, maxDp: 3,
    hint: "How thick the printed drill guide is.",
    callout: "Guide thickness: how thick the printed drill guide is.",
    explain: { anim: "guide", text: ["A thicker guide keeps the drill straighter."] } },
  { key: "guideHoleD", group: "guide", name: "Guide hole size", term: "guide_hole_d", unit: "mm", step: 0.1, big: 0.5, maxDp: 3,
    hint: "Printed holes shrink. 4.7 suits a 4.5 mm bit.",
    callout: "Guide hole size: the holes the drill bit goes through.",
    explain: { anim: "guide", text: ["Printed holes come out a bit small.", "Make them a little bigger than the drill bit."] } },

  // ---- sheet file ----
  { key: "sheetLen", group: "cnc", auto: true, name: "Sheet length", term: "length", unit: "mm", step: 1, big: 10, maxDp: 3,
    hint: "Automatic: the row of holes plus plastic at each end.",
    callout: "Sheet length: how long to cut the sheet.",
    explain: { anim: "sheet", text: ["The sheet must be long enough for every hole.", "Automatic adds plastic past the end holes."] } },
  { key: "endMargin", group: "cnc", name: "Plastic past the end holes", term: "end margin", unit: "mm", step: 1, big: 5, maxDp: 3,
    hint: "Used by the automatic sheet length.",
    callout: "End margin: plastic left past the first and last holes.",
    explain: { anim: "sheet", text: ["Plastic past the last hole keeps the end strong."] } },
  { key: "sheetW", group: "cnc", name: "Sheet width", term: "width", unit: "mm", step: 1, big: 5, maxDp: 3,
    hint: "How wide to cut the sheet.",
    callout: "Sheet width: how wide to cut the sheet.",
    explain: { anim: "sheet", text: ["The track slot must be a bit wider than this."] } },
  { key: "rowOffset", group: "cnc", auto: true, name: "Hole row from the edge", term: "row offset", unit: "mm", step: 0.5, big: 2, maxDp: 3,
    hint: "Automatic: the holes run down the middle.",
    callout: "Row offset: the sheet's bottom edge to the line of holes.",
    explain: { anim: "sheet", text: ["Automatic puts the holes down the middle.", "The pins must line up with this row."] } },

  // ---- track ----
  { key: "trackClearT", group: "track", name: "Slot height room", term: "clearance", unit: "mm", step: 0.05, big: 0.2, maxDp: 3,
    hint: "Extra room above the sheet in the track slot.",
    callout: "Slot height room: extra space so the sheet slides freely.",
    explain: { anim: "track", text: ["The sheet slides in a slot.", "A little extra room stops it from sticking."] } },
  { key: "trackClearW", group: "track", name: "Slot width room", term: "clearance", unit: "mm", step: 0.1, big: 0.5, maxDp: 3,
    hint: "Extra room beside the sheet in the track slot.",
    callout: "Slot width room: extra space beside the sheet.",
    explain: { anim: "track", text: ["Cut sheets are never perfectly straight.", "Extra width keeps the edges from rubbing."] } }
];

// Distance to a meter's green zone (0 = in the green). Used for better/worse badges.
const toGreen = {
  play: v => v < 0.15 ? 0.15 - v : v > 0.35 ? v - 0.35 : 0,
  tight: v => v > 0.08 ? 0 : 0.08 - v,
  web: v => v > 2.5 ? 0 : 2.5 - v,
  inSheet: v => v >= 1.5 ? 0 : 1.5 - v
};

// Every displayed number.
const METRICS = {
  rotation: { name: "Wheel turns", term: "turn", unit: "°", dp: 0 },
  travel: { name: "Sheet slides", term: "travel", unit: "mm", dp: 1 },
  travelIn: { name: "Sheet slides", term: "travel", unit: "in", dp: 2 },
  teeth: { name: "Pins on the wheel", term: "teeth", unit: "", dp: 0, count: true },
  P: { name: "Hole spacing", term: "pitch", unit: "mm", dp: 3 },
  holeD: { name: "Hole size", term: "hole diameter", unit: "mm", dp: 2 },
  sheetT: { name: "Sheet thickness", term: "sheet_t", unit: "mm", dp: 2 },
  gap: { name: "Gap under the sheet", term: "sheet gap", unit: "mm", dp: 2 },
  pitchD: { name: "Push circle", term: "pitch diameter", unit: "mm", dp: 2 },
  drumD: { name: "Wheel size", term: "drum diameter", unit: "mm", dp: 2 },
  pinW: { name: "Pin width", term: "pin_d", unit: "mm", dp: 2 },
  pinH: { name: "Pin height", term: "pin_h", unit: "mm", dp: 2 },
  taper: { name: "Side slant", term: "taper angle", unit: "°", dp: 1 },
  tipD: { name: "Tip size", term: "tip diameter", unit: "mm", dp: 2 },
  pinStraight: { name: "Straight part", term: "straight section", unit: "mm", dp: 2 },
  straightPast: { name: "Straight past the sheet", term: "extra straight", unit: "mm", dp: 2 },
  pinFlat: { name: "Pin flattening", term: "pin_flat", unit: "× width", dp: 2 },
  pinZ: { name: "Pin center from the outer face", term: "pin_z", unit: "mm", dp: 2, level: "expert" },
  drumW: { name: "Sprocket thickness", term: "drum_w", unit: "mm", dp: 2 },
  boltSquare: { name: "Bolt pattern", term: "bolt square", unit: "mm", dp: 2 },
  boltHoleD: { name: "Bolt hole size", term: "bolt_hole_d", unit: "mm", dp: 2 },
  boltHeadD: { name: "Screw head room", term: "bolt_head_d", unit: "mm", dp: 2 },
  counterbore: { name: "Counterbore depth", term: "counterbore", unit: "mm", dp: 2 },
  centerD: { name: "Center hole size", term: "center_d", unit: "mm", dp: 2 },
  pilotD: { name: "Pilot ring size", term: "pilot_d", unit: "mm", dp: 2 },
  pilotH: { name: "Pilot ring height", term: "pilot_h", unit: "mm", dp: 2 },
  guideHoles: { name: "Holes in the guide and sheet", term: "guide_holes", unit: "", dp: 0, count: true },
  edgeOffset: { name: "Sheet edge to hole line", term: "edge_offset", unit: "mm", dp: 2 },
  guideT: { name: "Guide thickness", term: "guide_t", unit: "mm", dp: 2 },
  guideHoleD: { name: "Guide hole size", term: "guide_hole_d", unit: "mm", dp: 2 },
  sheetLen: { name: "Sheet length", term: "length", unit: "mm", dp: 2 },
  endMargin: { name: "Plastic past the end holes", term: "end margin", unit: "mm", dp: 2 },
  sheetW: { name: "Sheet width", term: "width", unit: "mm", dp: 2 },
  rowOffset: { name: "Hole row from the edge", term: "row offset", unit: "mm", dp: 2 },
  trackClearT: { name: "Slot height room", term: "clearance", unit: "mm", dp: 2 },
  trackClearW: { name: "Slot width room", term: "clearance", unit: "mm", dp: 2 },

  tpr: { name: "Slide per full turn", term: "travel per turn", unit: "mm", dp: 2 },
  perDeg: { name: "Slide per degree", term: "travel per degree", unit: "mm", dp: 3 },
  turns: { name: "Full turns", term: "turns", unit: "", dp: 2 },
  overD: { name: "Size over the pins", term: "outside diameter", unit: "mm", dp: 2 },
  yb: { name: "Shaft to sheet underside", term: "axis to sheet", unit: "mm", dp: 2 },
  pinGapOnDrum: { name: "Space between pins on the wheel", term: "pin gap", unit: "mm", dp: 2 },
  web: { name: "Plastic between holes", term: "web", unit: "mm", dp: 3, better: toGreen.web },
  holes: { name: "Holes to drill", term: "holes needed", unit: "", dp: 0, count: true },
  run: { name: "Hole row length", term: "first to last hole", unit: "mm", dp: 2 },
  win: { name: "Contact window", term: "engagement length", unit: "mm", dp: 2 },
  inSheet: { name: "Pins in the sheet at once", term: "engagement", unit: "", dp: 2, better: toGreen.inSheet },
  wUnder: { name: "Pin width where it enters the sheet", term: "w at gap", unit: "mm", dp: 3 },
  play: { name: "Wiggle room", term: "play per side", unit: "mm", dp: 3, better: toGreen.play },
  tight: { name: "Squeeze room", term: "tightest clearance", unit: "mm", dp: 3, better: toGreen.tight },
  tightAt: { name: "Tightest at", term: "angle in one pin step", unit: "°", dp: 1 },
  loPlay: { name: "Sheet lower: wiggle room", term: "play", unit: "mm", dp: 3, better: toGreen.play, level: "expert" },
  loTight: { name: "Sheet lower: squeeze room", term: "clearance", unit: "mm", dp: 3, better: toGreen.tight, level: "expert" },
  hiPlay: { name: "Sheet higher: wiggle room", term: "play", unit: "mm", dp: 3, better: toGreen.play, level: "expert" },
  hiTight: { name: "Sheet higher: squeeze room", term: "clearance", unit: "mm", dp: 3, better: toGreen.tight, level: "expert" },
  step: { name: "Pin step", term: "degrees between pins", unit: "°", dp: 2 },
  hubMinD: { name: "Smallest wheel for the hub screws", term: "min drum diameter", unit: "mm", dp: 2 },
  hubRoom: { name: "Hub screw room", term: "drum radius past the minimum", unit: "mm", dp: 2 },
  boltR: { name: "Center to each bolt hole", term: "bolt radius", unit: "mm", dp: 2 },
  screwL: { name: "Hub screws", term: "4 × M4 socket head", unit: "mm", dp: 0, count: true },
  slab: { name: "Pin thickness across the wheel", term: "pin_flat × pin_d", unit: "mm", dp: 2 },
  nGuide: { name: "Holes in the drill guide", term: "n_guide", unit: "", dp: 0, count: true },
  guideLen: { name: "Drill guide length", term: "guide length", unit: "mm", dp: 2 },
  sheetHoles: { name: "Holes in the sheet file", term: "holes", unit: "", dp: 0, count: true },
  slotH: { name: "Track slot height", term: "sheet + room", unit: "mm", dp: 2 },
  slotW: { name: "Track slot width", term: "sheet + room", unit: "mm", dp: 2 },
  rowFromWall: { name: "Hole row from the slot wall", term: "pin line", unit: "mm", dp: 2 }
};

const MEASURE_ROWS = [
  { title: "Turn and slide", keys: ["tpr", "perDeg", "turns", "step"] },
  { title: "Wheel", keys: ["pitchD", "drumD", "overD", "yb", "pinGapOnDrum"] },
  { title: "Sheet and holes", keys: ["P", "web", "holes", "run", "win", "inSheet"] },
  { title: "Fit", keys: ["wUnder", "play", "tight", "tightAt", "loPlay", "loTight", "hiPlay", "hiTight"] },
  { title: "Hub", keys: ["hubMinD", "hubRoom", "boltR", "screwL", "slab", "pinZ"] },
  { title: "Drill guide and sheet file", keys: ["nGuide", "guideLen", "sheetLen", "sheetW", "rowOffset"] },
  { title: "Track", keys: ["slotH", "slotW", "rowFromWall"] }
];

const COMPARE_ROWS = ["rotation", "travel", "teeth", "P", "drumD", "pitchD", "web", "play", "tight", "inSheet", "holes", "guideLen", "pinW", "pinH", "taper"];

const FIELD = Object.fromEntries(FIELDS.map(f => [f.key, f]));

function levelOf(key) {
  const f = FIELD[key];
  if (f) return f.level || (GROUPS.find(g => g.id === f.group) || {}).level || "student";
  return (METRICS[key] && METRICS[key].level) || "student";
}

// Decimal places for a number at the chosen setting (1 simple, 2 normal, 3 precise).
function dpFor(key, decimals = 2) {
  const m = METRICS[key];
  if (!m) return 2;
  if (m.count) return 0;
  return Math.max(0, m.dp + (decimals - 2));
}

module.exports = { GROUPS, FIELDS, FIELD, METRICS, MEASURE_ROWS, COMPARE_ROWS, toGreen, levelOf, dpFor };
