"use strict";
// Try-these examples: teaching designs. Each loads like any edit, with badges
// and a ghost of the design before it.
const { defaultDesign } = require("../core/params.js");
const T = require("../core/taper.js");

function make(over) {
  const d = { ...defaultDesign(), ...over };
  if (over.taper !== undefined && over.tipD === undefined) d.tipD = T.tipFromTaper(d.pinW, d.pinStraight, d.pinH, d.taper).tipD;
  if (over.tipD !== undefined && over.taper === undefined) d.taper = T.taperFromTip(d.pinW, d.pinStraight, d.pinH, d.tipD).deg;
  return d;
}

const EXAMPLES = [
  { id: "ours", name: "Our design (360° = 6 in)", look: "The design that printed well: 16 tapered 4 mm pins.", design: () => make({}) },
  { id: "half", name: "Half turn", look: "Same 6 in slide in half a turn. Watch the wheel grow.", design: () => make({ rotation: 180 }) },
  { id: "lots", name: "Lots of pins", look: "24 pins. The holes crowd together and the plastic gets thin.", design: () => make({ teeth: 24 }) },
  { id: "tiny", name: "Tiny wheel", look: "Only 3 in per turn. The wheel is too small for the hub screws.", design: () => make({ travel: 76.2, teeth: 8 }) },
  { id: "steep", name: "Steep pin", look: "A 40° side slant. The pin comes to a point.", design: () => make({ taper: 40 }) },
  { id: "straight", name: "Straight pin", look: "Straight 4 mm pins, full width through the sheet.", design: () => make({ shape: "straight", pinStraight: 1.9, pinH: 3.2, tipD: 2.0 }) }
];

module.exports = { EXAMPLES, make };
