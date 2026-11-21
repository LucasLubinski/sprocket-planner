# Decisions log

Questions I would have asked Danielle, the assumption made instead, and where to change it.
The five most worth reviewing come first.

## Top five for review

| Phase | Question you would have asked | Assumption made | Why | Where to change it |
| --- | --- | --- | --- | --- |
| 1 | The brief says the smallest hub drum radius is 15.06 mm, but its own formula (side ÷ √2 + head ÷ 2 + 0.5) gives 15.56 mm. Which is right? | 15.56 mm radius (31.13 mm drum Ø). | It matches `core.js`, the OpenSCAD `assert`, and the 36.78 mm acceptance number. 15.06 leaves out the 0.5 mm margin. | `core/geometry.js` `hubMinR` |
| 1 | The rules say the Straight button keeps the taper angle. On the default pin (28.4°, 2.6 mm tall) that makes a 5.44 mm tip, wider than the pin. OK? | Followed the rule. The page warns "tip too big" and says what angle fixes it. Added a 6th example, "Straight pin", which loads the straight 4.0 reference pin (straight 1.9, height 3.2, tip 2.0, 51.8°). | Keeps the linked rules exactly as written, and keeps straight 4.0 one click away. | `state/link.js`, `state/examples.js` |
| 4 | "Pins in the sheet: red = none." The number is an average (window ÷ spacing). When is it "none"? | Red under 1 (at times no pin holds the sheet), amber 1–1.5, green 1.5 or more. | Under 1 means there are moments when no pin is in the sheet. | `core/analyze.js` `ZONES.inSheet` |
| 5 | How many holes go in the CNC sheet file, and what is "the row of holes plus 15 mm at each end"? | The sheet uses the same count as the drill guide (`guide_holes`, 0 = enough for the travel). Auto length = row of holes edge to edge + 15 mm of plastic past each end hole. The 15 mm is an input. | The guide drills the sheet, so they should match. | `core/sheetfiles.js` `sheetLayout` |
| all | Node.js isn't installed on this laptop. Install it? | At first, used the Node runtime that ships inside Adobe Photoshop 2026 (v22.18.0) rather than install anything. Later, at Luke's request, installed Node.js 26 LTS to `C:\Program Files\nodejs\` with winget; all tests pass on it. | No system changes without asking. | README |

## Other decisions

| Phase | Question you would have asked | Assumption made | Why | Where to change it |
| --- | --- | --- | --- | --- |
| 1 | What makes a tip "too big for the angle"? | Valid when the tip is no wider than the pin and touches the side above the straight part. Gives the smallest valid angle in the warning. | Matches the hull the OpenSCAD model makes. | `core/taper.js` |
| 1 | Too-steep pins: what do the drawings show? | The pin is drawn coming to a point and the tip box shows the negative value, with a stop warning. | Students see the problem instead of a blank drawing. | `core/geometry.js` `pinLocal` |
| 1 | The brief gives some sheet-height numbers to 2 decimals (±0.13, ±0.26, ±0.39). Check them to ±0.002? | Numbers given to 3 decimals are checked to ±0.002 mm; numbers given to 2 decimals are checked at 2 decimals. | 0.2632 can't match "0.26" to ±0.002. | `test/reference.test.js` |
| 1 | The sheet-height sweep at a gap under 0.2 mm would go negative. | It uses a gap of 0 for the lower sweep and labels the real amount. | A negative gap can't exist. | `core/analyze.js` |
| 1 | Can the clearance math be made faster? | Same math without temporary arrays; tests prove it matches `reference/core.js` to 1e-9. A full edit (3 sweeps) takes about 10 ms. | The 60 ms budget needs room on slow Chromebooks. | `core/geometry.js` `gapFast` |
| 2 | Track box needs a clearance. How much? | Two inputs: slot height room 0.3 mm, slot width room 1.0 mm. | Printed slots need a little room; cut sheet edges vary more. | `core/params.js` |
| 2 | Is the hub preset a setting or part of the design? | Part of the design (saved with it, reset by Reset design). goBILDA locks the hub boxes; Custom unlocks them. Sprocket thickness is never locked. | The hub values go into the OpenSCAD file, so they belong to the design. | `state/link.js` `isLocked` |
| 2 | Decimal places: hole spacing must show 9.525 at "normal". | Each number has its own decimals at Normal (hole spacing, plastic, wiggle and squeeze room 3; sizes 2; angles 1). Simple shows one less, Precise one more. | Matches every acceptance number. | `state/fields.js` `METRICS` |
| 2 | Alt+E should open Export, but Edit also starts with E. | Export = Alt+E (as the brief says); Edit = Alt+T. Alt+Shift+letter also works in case Chrome keeps Alt+letter. | Follows the brief. | `ui/main.js` menus |
| 2 | Font: 98.css pixel font or Tahoma? | Tahoma / Arial at 14 px (13 px minimum). The pixel font is bundled but looks blurry at sizes other than 11 px. | Readability for students. | `styles/win98.css` |
| 2 | Plain names in the drawings? | Student detail uses plain words in labels ("wheel Ø", "push circle Ø"); Expert uses the real terms ("drum Ø", "pitch Ø"). | The brief asks for plain names in Student mode. | drawing modules, `vm.word` |
| 2 | Guarantee no network calls? | Added a Content-Security-Policy that blocks all network requests. | Proves "works offline" by construction. | `index.html` |
| 3 | Does focusing a box clear the badges? | No. A new edit starts on focus, but the old badges stay until the new edit changes something. | Tabbing through boxes shouldn't wipe what the student just learned. | `state/session.js` |
| 3 | Comparison view is listed as one choice, but its default mixes two. | Two check boxes: Ghost overlay (off) and Side by side (on when 2+ are checked). Both off = numbers only. The table always shows. | Covers every combination the brief describes. | `ui/settingsdlg.js` |
| 3 | "Same turn" panels: up to which turn? | The slider runs to the smallest turn among the checked designs, so each stays within its own range. | Shows how far each slides for the same turn. | `draw/panels.js` |
| 3 | Should loading a saved design count as an edit for badges? | Yes, badges show the change from the design before loading. | Matches every other edit. | `state/store.js` |
| 4 | Ghost overlays are off by default. Do the dial, ruler and meters still show the last version and saved designs? | Yes. They always mark the last version (while it differs) and the designs checked for Compare. The Ghost overlay setting only controls the dashed outlines in the drawings. | Those visuals exist to compare; markers are small and don't clutter. | `ui/vm.js` `marks` |
| 4 | How does the dial show more than one turn? | The pie shows the last turn (full or partial); each earlier full turn adds a ring outside it. The center says how many turns. | 360° reads as one full disc; 1800° as a full disc plus four rings. | `draw/dial.js` |
| 4 | What does the title-bar "?" do if every label already has a "?" button? | The small "?" buttons stay visible. The title-bar "?" turns on Windows 98 "What's this?" mode: click any part of the window to explain it. | Students find the small buttons; the title-bar button explains drawings and meters too. | `ui/explain.js` |
