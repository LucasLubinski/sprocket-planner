# CLAUDE.md: Sprocket Planner

You are building the Sprocket Planner: one self-contained HTML file that a 7th grader opens on a laptop to design a 3D-printed pin sprocket and the drilled polycarbonate sheet it drives. This file is the complete brief. Everything you need is here, including the verified math and the OpenSCAD model in the Reference code section at the end.

## How to work and talk

- **Work straight through, no check-ins.** Build all eight phases in the Build order and hand back a finished product. When you would normally stop to ask Danielle something, pick the most reasonable answer, keep going, and log it in `DECISIONS.md` (format under Build order).
- **Never end a response with a question** unless that question is truly blocking your next step.
- **No engagement bait.** No "Would you like me to..." offers, no "Let me know if..." closers, no trailing curiosity questions.
- **Report results plainly:** what was built, what was tested and how, and what is left. Don't recap every step.
- **The Decisions already made section is settled.** Follow it; don't reopen those questions.
- **Don't edit the reference copies** of `core.js` and `polycarb_sprocket.scad`. Build from them.

## Goal and audience

Build one web page where a 7th grader can design a pin sprocket that slides a drilled plastic sheet, and see every change as a picture, not just a number.

- **Who uses it:** Danielle (designer and robotics mentor) and 7th-grade students on a school robotics team. Students should be able to use it without an adult explaining it.
- **The real build:** a 3D-printed pin sprocket bolts to a 32 mm goBILDA / ServoCity 25-tooth spline servo hub. Its pins poke up through 4.5 mm holes drilled in a 1.5 mm polycarbonate sheet. Turning the servo slides the sheet along a track, like a rack and pinion.
- **Starting design:** 360° of turn slides the sheet 6 in (152.4 mm), with 16 pins.
- **Success looks like:** a student types "turn 180°, slide 6 in", watches the wheel grow, sees which numbers went up or down and by how much, saves it as Design B, and checks Design A and Design B to compare them side by side.

## What you get at the end

The finished product is a tested web app in one HTML file that hands out print-ready OpenSCAD files and CNC files for the sheet.

- **The web app,** one HTML file Danielle can hand to anyone (USB stick, shared drive, email). Double-clicking it on a Windows laptop opens it in Chrome, with no internet, no install and no server. It also opens on Chromebooks.
- **Design tools:** linked inputs, change badges, drawings, fit meters, saved designs, compare views and a settings panel, in a Windows 98-style window.
- **Printing:** a Copy OpenSCAD file button (sprocket or drill guide) with the current numbers filled in, ready to paste into OpenSCAD and export as STL, plus SVG and DXF files of the sheet for CNC cutting.
- **Code and tests:** the source folder, automated tests that check the math and the copied OpenSCAD file, and the single-file page.
- **Guides:** a short in-app "How to use" for students, and a README for adults covering how to run tests, hand out and update the file, and update the OpenSCAD settings. A decision log (`DECISIONS.md`) lists every question you would have asked, the assumption you made instead, and why.

## Starting point

Two verified files are copied in full in the Reference code section at the end of this file. Phase 1 starts by saving them, unchanged, as `reference/core.js` and `reference/polycarb_sprocket.scad`.

| Source | How to use it |
| --- | --- |
| `core.js` | Geometry and clearance simulation, no DOM, about 140 lines. It matches an independent Python/Shapely simulation to 3 decimals. Use it for every number and keep its function names (`derive`, `pinLocal`, `widthAt`, `pinWorld`, `webs`, `minGap`, `trace`, `validate`). Replace its fixed `HUB_MIN_R` and `DRUM_W` with values from the hub mount settings. |
| `polycarb_sprocket.scad` | The OpenSCAD model. "Copy OpenSCAD file" hands it out with current values filled in, and "Copy settings only" pastes over its parameters. Don't rename its parameters. |
| Reference numbers | The tables in Clearance simulation and Getting the part into OpenSCAD. Tests must reproduce them. |

## The mechanism and its math

One full turn of the wheel slides the sheet exactly (pins × hole spacing), so the hole spacing sets the travel and the wheel size follows from it.

Inputs: turn θ (degrees), travel T, pins N, sheet thickness t, hole diameter h, gap under the sheet g, pin width at base w, straight section s, pin height above the drum H, tip diameter d. All lengths in mm.

```latex
\begin{aligned}
T_{rev} &= T \cdot 360 / \theta \\
R_p &= T_{rev} / 2\pi \quad \text{(pitch radius, at the sheet's mid-plane)} \\
P &= T_{rev} / N \quad \text{(hole spacing)} \\
y_b &= R_p - t/2 \quad \text{(shaft center to sheet underside)} \\
r_0 &= y_b - g \quad \text{(drum radius)} \\
r_{tip} &= r_0 + H \\
\varphi_{in} &= \arccos(\min(1,\ y_b / r_{tip})), \quad L_{win} = 2\, r_{tip} \sin\varphi_{in} \\
\text{holes} &= \lceil T/P \rceil + \lceil L_{win}/P \rceil + 1 \\
\text{web} &= P - h, \quad \text{play} = (h - w_{g})/2, \quad \text{pins in sheet} = L_{win}/P
\end{aligned}
```

- **Pin profile:** convex hull of the base rectangle (±w/2, from 1 mm below the drum up to s) and a tip semicircle of radius b = d/2 centered at H − b. `w_g` is the hull's width at height g, where the pin enters the sheet. `core.widthAt` and the OpenSCAD `pin_w_at` give the same value.
- **Taper angle α** (new input): the angle of the pin's sides from straight up, above the straight section. 0° means straight sides with a fully round end. The default tapered pin is about 28.4°; the straight 4.0 pin tapers about 51.8° above its straight section. Angle and tip diameter are linked, holding w, s and H:

```latex
b = \frac{a\cos\alpha - (H - s)\sin\alpha}{1 - \sin\alpha}, \qquad a = w/2,\quad d = 2b
```

- For tip → angle, the simplest exact route: find the tangent point T on the tip circle (same construction as `pin_w_at`), then α = atan((a − Tₓ) / (Tᵧ − s)). If b ≤ 0, the angle is too steep for the height (the sides meet below the top): show "pin comes to a point; lower the angle or the height".
- **Rounding:** subtract 1e-9 inside each ceiling so 152.4 / 9.525 counts as 16, not 17.

When one field is edited, the others follow these rules:

| Field edited | Stays fixed | Changes |
| --- | --- | --- |
| Wheel turns | Travel, pins | Wheel size, hole spacing |
| Sheet slides | Turn, pins | Wheel size, hole spacing |
| Pins on the wheel | Turn, travel, wheel size | Hole spacing, plastic between holes |
| Hole spacing | Turn, pins | Travel (T_rev = N × P), wheel size |
| Pitch diameter | Turn, pins | Travel (T_rev = π × D) |
| Drum diameter | Turn, pins | Travel (R_p = D/2 + g + t/2) |
| Sheet thickness or gap | Turn, travel | Drum diameter, play |
| Pin width, straight section or height | Taper angle | Tip diameter |
| Taper angle | Width, straight section, height | Tip diameter |
| Tip diameter | Width, straight section, height | Taper angle |
| Pin shape button | Width, height, taper angle | Straight section only: 0 for Tapered, g + t for Straight (and it follows later changes to g or t); tip diameter follows |
| Straight section typed in | Everything else | Shape becomes "custom", no button lit |
| Any hub mount setting | Everything else | Only the hub holes, the smallest allowed wheel, and screw length |

Limits the page must check, each with a plain warning and a fix:

- **Hub screws fit inside the wheel:** drum radius ≥ bolt square ÷ √2 + screw head room ÷ 2 + 0.5 mm (15.06 mm with the goBILDA defaults). All hub values come from the Hub mount settings section.
- **Pin is narrower than the hole where it enters the sheet,** pins reach through the sheet, the tip isn't too big or pointed for the angle, and pins don't run together on the drum.
- **Plastic between holes** is at least 1.5 mm (warn under 2.5 mm).
- **Servo range:** goBILDA dual-mode servos turn 300° in position mode; the 5-turn versions reach 1800° ([goBILDA standard servos](https://www.gobilda.com/standard-size-servos/)). Past 1800° needs continuous mode, which loses position control.

## Clearance simulation

The page checks fit by turning the wheel through one pin step in a 2D side view and measuring the closest gap between any pin and any hole edge; the new build must reproduce the numbers below.

**Method (already in `core.js`):**

1. Cut a side view through the pins' centerline. The wheel turns clockwise by θ; the sheet slides R_p × θ (radians) with no slip at its mid-plane.
2. The sheet is a row of rectangles (the plastic between holes) from y_b to y_b + t, hole k centered at k × P plus the slide.
3. Each pin is its convex profile rotated to its angle. Only pins within φ_in + 25° of straight up are checked.
4. Gap = shortest distance between a pin and a rectangle. If they overlap, the gap is negative (the overlap depth from the separating-axis test).
5. Sweep one pin step (360° / N) in 200 to 240 samples. The pattern repeats for every pin. The lowest value is "squeeze room" (tightest clearance).

**Numbers the build must match** (360° → 152.4 mm, 16 pins, sheet 1.5 mm, holes 4.5 mm, gap 0.4 mm, tip 2.0 mm):

| Pin | Width w | Straight s | Height H | Play per side | Tightest clearance |
| --- | --- | --- | --- | --- | --- |
| Tapered 4.0 | 4.0 | 0 | 2.6 | ±0.466 | 0.285 |
| Straight 4.0 | 4.0 | 1.9 | 3.2 | ±0.250 | 0.118 |
| Straight 4.2 | 4.2 | 1.9 | 3.2 | ±0.150 | 0.018 |
| Tapered 4.5 | 4.5 | 0 | 2.6 | ±0.263 | 0.093 |
| Tapered 4.8 | 4.8 | 0 | 2.6 | ±0.14 | −0.014 (binds) |

Other checks: the default design needs 20 holes and a 193 mm drill guide. With 24 pins, spacing is 6.35 mm, 29 holes, tightest 0.285. With 180° for 6 in, spacing is 19.05 mm, drum Ø 94.72 mm, 11 holes, tightest 0.346.

**Sheet height matters for tapered pins, not straight ones.** The page reruns the sweep with the gap 0.2 mm smaller and larger:

| Gap under sheet | Tapered 4.5: play / tightest | Straight 4.0: play / tightest |
| --- | --- | --- |
| 0.2 mm | ±0.13 / −0.017 (binds) | ±0.25 / 0.118 |
| 0.4 mm | ±0.26 / 0.093 | ±0.25 / 0.118 |
| 0.6 mm | ±0.39 / 0.203 | ±0.25 / 0.118 |

Limits of the model: it is 2D at the pin centerline, assumes perfectly placed holes and a rigid sheet, and ignores friction and print error. Real holes drilled slightly off position will rub first at the tightest point.

## Core features

A working prototype already had these; keep all of them. The new features layer on top.

- **Linked inputs** following the rules table above, with an in / mm switch for travel. While a field is being typed in, it is never overwritten.
- **Summary line and status chips:** "Turning 360° moves the sheet 6 in", plus chips for pins clearing the holes, fit, plastic between holes, hub screw room, pins in the sheet at once, servo range, and sheet-height sensitivity.
- **Layout drawing to scale:** wheel, pitch circle, pins (one marked as an index), hub screw holes that turn with the wheel, the sheet with its holes, and dimensions for shaft-to-sheet distance, drum Ø, pitch Ø, full travel, and distance moved so far.
- **Play and slider** that turn the wheel from 0 to the set turn, with an arrow following one hole.
- **Close-up at the sheet:** closest-gap line with its value; the closest pin turns amber under 0.1 mm and red when it hits; hole-spacing dimension.
- **Pin-in-the-hole drawing:** hole Ø, sheet thickness, gap, pin width, straight section, taper angle, height, tip Ø, and the play on each side.
- **Clearance chart** over one pin step with the tightest point and the current position marked.
- **Measurements table** with every derived number, including the two sheet-height rows.
- **Copy OpenSCAD file and Copy settings only** using the exact parameter names: `rotation_deg`, `travel`, `teeth`, `hole_d`, `sheet_t`, `sheet_gap`, `pin_d`, `pin_straight`, `pin_h`, `pin_tip_d`, `drum_w`, `bolt_square`, `bolt_hole_d`, `bolt_head_d`, `counterbore`, `center_d`, `pilot`, `pilot_d`, `pilot_h`. The taper angle is not an OpenSCAD setting; it reaches the model through `pin_tip_d`. If the clipboard is blocked, select the text and tell the user to press Ctrl+C.
- **Shape buttons** Tapered and Straight through the sheet, which change only the straight section.
- **Remembers the last design** in localStorage, wrapped in try/catch so it still works when storage is blocked.

## New features

The new work makes every change visible: badges say how much each number moved, ghosts show the old shape, and saved designs sit side by side.

**Everything is customizable.** Every number that shapes the sprocket, the sheet or the drill guide is an input; nothing is a hidden constant. Student detail level hides the advanced ones but never locks them. Besides the inputs already named, that includes:

- Pin flattening (`pin_flat`, 0.7 × pin width), which keeps pins printable without supports.
- Sprocket thickness (`drum_w`, 5 mm).
- Drill guide: number of holes (`guide_holes`, 0 = enough for the travel), sheet edge to hole line (`edge_offset`, 8 mm), guide thickness (`guide_t`, 4 mm), guide hole size (`guide_hole_d`, 4.7 mm).

All of these appear in both copy buttons.

1. **Change badges.** When one edit forces other values to update, each changed value shows a badge: green "▲ +48.51" when it went up, red "▼ −0.40" when it went down.
   - Same units and decimal places as the value it sits next to. Hide changes smaller than the last shown digit.
   - The baseline is the design just before the current edit began. Focusing a field, starting a drag, or clicking a button starts a new edit. Typing 1, 18, 180 shows the change from 360°, not from 18°.
   - Badges appear on every input, every measurements-table row, the summary facts, and the dimension labels in the drawings ("drum Ø94.72 ▲ +48.51").
   - They stay until the next edit. The field the student changed gets a neutral "you changed this" outline, not a badge.
   - Arrow plus sign, never color alone. The Settings panel can switch colors to better/worse.
2. **Ghosts and saved designs:** see Comparing designs below.
3. **Big-picture visuals at the top.**
   - Turn dial: a filled pie for the turn, an extra ring per full turn, a tick at 300° labeled "standard servo max", and ghost outlines.
   - Slide ruler in inches: the sheet drawn as a bar with its holes at true spacing, so more pins visibly puts holes closer together. Ghost bars for the last version and saved designs.
   - An arrow between them reading "turn → slide".
4. **Fit meters** with colored zones and plain names, each with markers for now, the last version and saved designs:

   | Meter | Red | Amber | Green |
   | --- | --- | --- | --- |
   | Wiggle room (play per side) | under 0.05 or over 0.6 mm | 0.05–0.15 or 0.35–0.6 mm | 0.15–0.35 mm |
   | Squeeze room while turning (tightest clearance) | under 0 mm | 0–0.08 mm | over 0.08 mm |
   | Plastic between holes | under 1.5 mm | 1.5–2.5 mm | over 2.5 mm |
   | Pins in the sheet at once | none | under 1.5 | 1.5 or more |
5. **Selecting a box points to it in the pictures.** This is how a student learns what "pitch diameter" means.
   - When any input is focused (clicked, tapped or tabbed into), its dimension in every drawing lights up in a highlight color with a soft glow. Everything else fades to about 30%, and a callout bubble beside it says what it is in plain words ("Pitch diameter: the circle where the pins push the sheet").
   - It works both ways: hovering or tapping a dimension in a drawing highlights its input box and scrolls it into view.
   - Every setting is covered, including the hub settings, taper angle, sheet and gap.
   - A small "?" beside each label opens a short explainer with a tiny animation, for example the pitch circle rolling along the sheet.
6. **Edit right in the drawings** (built last, but planned from the start; see Build order).
   - Drag handles on dimensions: drag the spacing bar between two holes, the wheel's edge, the pin's height or side angle, the turn arc. Values snap to sensible steps (0.1 mm, 1°, whole pins) and the badges update live.
   - Click a dimension label to type a new value right there. Enter applies, Escape cancels.
   - Keyboard: a focused handle moves with the arrow keys (Shift for bigger steps).
   - Drags follow the same linked rules as typing, so dragging the spacing bar changes the travel exactly as typing a new spacing does.
7. **Try-these examples.** Buttons that load teaching designs: "Our design (360° = 6 in)", "Half turn", "Lots of pins" (thin plastic warning), "Tiny wheel" (hub screws don't fit), "Steep pin" (taper angle too steep). Each shows its badges and ghost like any edit.

## Comparing designs

Use a ghost overlay to see what the last change did, and side-by-side panels to compare saved designs, because designs with different hole spacing don't line up on top of each other.

**Why overlays get messy:** two designs centered on the same shaft compare wheel size and pin positions well. But each design's sheet sits at a different height, with holes at a different spacing. Two sheets drawn over each other become a tangle of rectangles, so the ghost shows only its wheel, pins and one dashed line for its sheet.

| View | Best for | How it draws |
| --- | --- | --- |
| Ghost overlay | The last change, or one saved design | Ghost wheel, pitch circle and pins as dashed outlines behind the current design. The ghost sheet is one dashed line, no holes. In the pin-in-the-hole drawing, the ghost pin and hole edges line up on the hole center. |
| Side by side | Two to four saved designs, picked with their Compare check boxes | One small panel per design, all at the same scale (same mm per pixel), each with its own sheet and holes. Every panel animates together from one slider. |
| Numbers | Any number of designs | The compare table: key numbers in rows, Now plus each saved design in columns, with badges showing each design's difference from Now. Always shown under the views. |

Two choices make the views clearer:

- **Line up the overlay by:** shafts (shows the size difference) or sheets (moves the ghost so its sheet underside matches the current one, which shows how the pins meet the holes).
- **Animate together by:** same turn (every design turns the same degrees, so you see how far each slides) or same slide (every design slides the same distance, so you see how far each must turn).

Defaults: ghost overlays are off; students turn them on from the View menu or Settings, lined up by shafts. Each saved design has a Compare check box: check two (up to four) and they open side by side at the same scale, animating by the same turn. Students can switch any of these in the settings.

## Settings panel

A Settings dialog (View menu) holds these choices; they are remembered between visits and have their own "Reset settings" button, separate from "Reset design".

| Setting | Choices | Default | Why it helps |
| --- | --- | --- | --- |
| Compare with | Last change · picked saved designs · both | Ghost off; checked designs side by side | Decides which ghosts or panels appear |
| Comparison view | Ghost overlay · side by side · numbers only | Side by side when 2+ Compare boxes are checked; ghost overlay off until turned on | Overlays suit one comparison; panels suit several |
| Line up the overlay by | Shafts · sheets | Shafts | Size difference vs. pin-and-hole fit |
| Animate together by | Same turn · same slide | Same turn | Shows travel per turn, or turn needed for a distance |
| Ghost strength | Faint · medium · strong | Medium | Ghosts stay visible without hiding the current design |
| Change badges | On · off | On | Turns off the extra marks once a student knows the tool |
| Badges compare to | Last change · a chosen saved design | Last change | Lets a student hold one design as "home base" |
| Badge colors | Up green, down red · better green, worse red | Up green, down red | "Better" means moving toward a meter's green zone, which helps students judge a change, not just read it |
| Units | Inches · millimeters (travel); parts always in mm | Inches for travel | Matches how students measure the sheet |
| Decimal places | Simple (1) · normal (2) · precise (3) | Normal | Fewer digits for younger students |
| Detail level | Student · expert | Student | Student hides straight section, tip, gap, hub settings and the sheet-height rows, and uses plain names |
| Dimension labels | All · key only · none | Key only | Keeps drawings uncluttered |
| Measuring grid | On · off (1 mm and 5 mm lines) | Off | Lets students read sizes straight off a drawing |
| Animation speed | Slow · normal · fast | Normal; animation off if the device asks for reduced motion | Slow helps students watch a pin enter a hole |
| Highlight on hover | On · off | On | Points from a setting to its dimension in the drawings |
| Hub | goBILDA 32 mm hub · custom | goBILDA | Custom unlocks the hub mount settings below |
| Turn direction | Clockwise · counterclockwise | Clockwise | Matches how the servo is mounted; only mirrors the drawings and which way the sheet slides |

## Hub mount settings

The holes that bolt the sprocket to the hub become adjustable, with the goBILDA 32 mm 25T hub as the default preset, so a tight hole or a different hub can be fixed without touching code.

| Setting | OpenSCAD name | goBILDA default | What it does |
| --- | --- | --- | --- |
| Bolt pattern (square side) | `bolt_square` | 16 mm | Four M4 holes on the corners of this square, at 45°, 135°, 225°, 315°. Distance from center = side ÷ √2 (11.31 mm). |
| Bolt hole size | `bolt_hole_d` | 4.5 mm | Clearance for M4 screws. Raise it if printed holes come out tight. |
| Screw head room | `bolt_head_d` | 7.5 mm | M4 socket head (7 mm) plus room. Sets the counterbore size and the smallest allowed wheel. |
| Counterbore depth | `counterbore` | 0 mm | Sinks the screw heads into the outer face. |
| Center hole size | `center_d` | 8 mm | Lets the servo screw and a screwdriver pass through. |
| Pilot ring | `pilot`, `pilot_d`, `pilot_h` | on, 13.7 mm, 1.2 mm | Short ring on the hub side that drops into the hub's 14 mm recess to center the sprocket. |
| Sprocket thickness | `drum_w` | 5 mm | Body thickness. Screw length = the shortest of 6, 8, 10, 12, 14, 16, 20, 25 mm that is at least thickness − counterbore + 4. |

Checks, each with a plain warning and a fix:

- Wheel big enough for the screws: drum radius ≥ side ÷ √2 + head room ÷ 2 + 0.5 mm (15.06 mm with the defaults).
- Bolt holes clear of the center hole: side ÷ √2 − bolt hole ÷ 2 > center hole ÷ 2 + 1 mm.
- Pilot ring inside the bolt holes: pilot ÷ 2 < side ÷ √2 − bolt hole ÷ 2.
- Center hole smaller than the pilot ring by at least 2 mm.
- Counterbore leaves at least 1 mm of plastic under the screw heads.
- Pins thinner than the body: 0.7 × pin width < thickness.

A new **hub face drawing** shows the sprocket's hub side to scale: bolt pattern, hole sizes, center hole and pilot ring, with the goBILDA hub (32 mm circle, 14 mm recess, M4 holes) drawn over it in outline so students can see the fit. These values also feed the layout drawing and both copy buttons, and they get change badges like everything else.

## Getting the part into OpenSCAD

The page doesn't make STL files itself. It copies a ready-to-render OpenSCAD file to the clipboard, and OpenSCAD makes the STL, so a laptop needs only the planner file and OpenSCAD.

- **Buttons** (Export menu and toolbar):
  - "Copy OpenSCAD file": the whole `polycarb_sprocket.scad` from the Reference code section with every current value filled in. The page carries the full model inside it, so any computer gets a complete, working file from the page alone; it only needs OpenSCAD installed (free) to render it.
  - "Copy settings only": just the parameter lines, to paste over the top of a file already open in OpenSCAD.
  - A Part choice (Sprocket or Drill guide) sets `part` in the copied file.
- **Clipboard:** copying runs from the button click. If the browser blocks it, a dialog shows the text with a "Select all" button so Ctrl+C works.
- **Keep the file whole:** change only the values. Its comments, checks and console messages stay, so OpenSCAD also reports problems in plain words.
- **Help dialog with student steps:** open OpenSCAD, File > New, paste, press F6 to render, then File > Export > Export as STL, and open the STL in the slicer.
- **Reference numbers:** rendering the copied file in OpenSCAD 2021.01 with the defaults must give these sizes (±0.05 mm) and volumes (±1%):

| Part | Settings | Size (mm) | Volume (mm³) |
| --- | --- | --- | --- |
| Sprocket | Defaults (tapered 4.0 pins) | 51.40 × 51.40 × 6.20 | 8,160 |
| Sprocket | Straight 4.0 pins (straight 1.9, height 3.2) | 52.60 × 52.60 × 6.20 | 8,345 |
| Sprocket | Defaults + 2 mm counterbores | 51.40 × 51.40 × 6.20 | 7,935 |
| Drill guide | Defaults (20 holes) | 192.97 × 20.25 × 5.20 | 15,173 |

Not in scope for now: STL downloads and a 3D preview. A file opened on a laptop can download, so a "Download .scad file" button is an easy later addition.

## Sheet files for CNC

The planner saves the polycarbonate sheet as a true-scale SVG file, and a DXF if practical, so the holes and outline can be cut on a CNC router instead of drilled.

- **Buttons** (Export menu and toolbar): "Save sheet SVG" and "Save sheet DXF". They download files, which works because the planner runs as a file on the laptop. If DXF turns out much harder than SVG, ship SVG first and log the decision.
- **What's in the file:** the row of holes (circles at the hole diameter, at the hole spacing, as many as the travel needs) and the sheet's outline. Holes and outline sit in separate, named groups or layers (`holes`, `outline`) and different stroke colors, so CNC software can give them different cuts. No fills and no text.
- **Sheet size inputs** (new, editable like everything else): sheet length (default: the row of holes plus 15 mm at each end), sheet width (default 40 mm), and the hole row's distance from the edge (default: centered).
- **True scale:** SVG width, height and viewBox all in millimeters, so it imports at the right size. DXF in millimeters, with circles as CIRCLE entities and the outline as a closed polyline, on layers HOLES and OUTLINE.
- **Sheet pattern drawing:** a drawing in the planner shows the outline and holes with their dimensions, and it updates like the others.
- **Track box:** a read-only box gives the track's key sizes: shaft center to sheet underside, slot height (sheet thickness plus clearance) and slot width (sheet width plus clearance).
- **File names** carry the key numbers, for example `sheet_16pins_9.525mm_20holes.svg`.

## Visual style: Windows 98

The app should look like a Windows 98 desktop program, with classic gray 3D controls, a navy title bar and a menu bar, scaled up enough for 7th graders to read and tap.

- **Start from 98.css,** the open-source (MIT) stylesheet that recreates Windows 98 controls. Copy it into the repo at a pinned version, keep its license file, and build on it instead of hand-drawing every bevel.
- **App window:** one window on a classic teal desktop (#008080). Title bar with the navy-to-blue gradient (#000080 → #1084D0), white bold title "Sprocket Planner", a small pixel-style sprocket icon, and beveled minimize, maximize and close buttons (decoration only). Add the "?" title-bar button from Windows 98 dialogs; it turns on the "?" explainers.
- **Menu bar:** File, Edit, View, Design, Compare, Export, Help, with drop-down menus and underlined keyboard letters (Alt+E opens Export).
- **Toolbar** under the menus: small beveled icon buttons for Save design, Compare, Play, Copy OpenSCAD file, Copy settings only, with yellow tooltips (#FFFFE1, thin black border).
- **Panels as group boxes** with etched borders and titles set into the top edge; property-sheet tabs where a panel has pages.
- **Controls:** gray (#C0C0C0) raised push buttons that look pressed when clicked; white sunken number fields with spinner arrows; classic check boxes, option buttons and drop-down lists.
- **Fit meters as Windows 98 progress bars:** segmented blocks inside a sunken frame, colored by zone (green, yellow, red) instead of plain navy, with the zone name beside each.
- **Selection and highlight:** selected items in navy with white text, as in Windows 98 lists. The drawing highlight for a focused setting uses one bright color that stands out on the gray.
- **Status bar** at the bottom in sunken panels: "Ready", the current turn and slide, and the warning count.
- **Dialogs** in the Windows 98 style for Settings, Save design, and the copy fallback, each a small window with OK / Cancel / Apply buttons.
- **Type:** 98.css's pixel font for menus and title bars, or Tahoma / Arial, at 13–14 px minimum. Windows 98 used 11 px type, too small for students.
- **Feel:** thematically similar to Windows 98, not a pixel-exact copy, with sizes kept readable for students. Tap targets reach 44 px on touch screens.
- **Icons and art you make yourself,** in a 16 × 16 pixel style. Don't copy Microsoft's icons, logos, the Start button, wallpapers or sounds; the look is inspired by the era, not a copy.
- **Color schemes:** "Windows Standard" by default, plus an optional "High Contrast" scheme in Settings, as Windows 98 offered.

## Words and usability

Every number that matters also shows up as a picture or a meter, and the words read at a 6th to 7th grade level.

- **Plain names first, real term second.** "Wheel size (drum diameter)", "Wiggle room (play)", "Squeeze room (clearance)", "Sheet slides", "Pins on the wheel". Students learn the engineering words without needing them.
- **One-line hint under each input,** for example "Hole spacing: center of one hole to the center of the next."
- **Short sentences,** under 15 words, with units on every number.
- **Warnings say how to fix it:** "Holes too close: use fewer pins or a bigger turn-to-slide ratio." Check, warning and stop icons plus words; color is never the only signal.
- **A three-sentence "How it works"** at the top with a tiny looping animation of one pin pushing the sheet.
- **Tap targets at least 44 px.** Works on a school Chromebook (1366 × 768) and a phone (390 px wide) with no sideways scrolling and no clipped labels in the drawings.
- **Keyboard friendly** with a visible focus ring. Animation only plays when pressed, and respects reduced-motion settings.
- **Text never drops below 13 px, even where Windows 98 used smaller type**.
- **No account, no network calls, works offline** with no internet at all.

## Tech approach and constraints

Build one self-contained HTML file that runs on a laptop, keep the math pure and tested, and hang every drawing on one shared dimension model so highlighting, badges and drag-to-edit all use the same pieces.

- **Target: a laptop, not a website.** The final product is one self-contained `planner.html` that runs by double-clicking it on a Windows laptop, in Chrome, with no internet connection and no server. Everything is inside the file, including 98.css and its font; nothing loads from other sites. (The same file would also work on GitHub Pages or as a claude.ai link, but neither is the goal.)
- **Folders while building:** `core/` (geometry from `core.js` plus taper angle and hub settings; `scad.js` fills values into the OpenSCAD file), `state/` (design state, edit sessions and badge baselines, saved designs, settings), `draw/` (one module per drawing), `ui/` (menu bar, toolbar, inputs, panels, dialogs, tables, meters), `styles/win98.css`, `index.html`. A small script inlines everything into `planner.html`, the only file handed out.
- **One data flow:** state → `derive()` → a view model that every drawing, table and meter reads. No drawing computes geometry on its own.
- **Dimension model (build it in phase 2):** every dimension, handle and highlightable part is an object with its setting name, kind (length, diameter, angle), anchor points in mm, label, whether it is editable, its drag direction, and how a new value maps back to settings. Drawings render these objects. The same objects drive focus highlighting, hover-to-input linking, badges on labels, and later the drag handles and type-in-place editing, so phase 7 only adds event handling.
- **Drawings in SVG,** so each part is an element that can be hovered, focused and edited, and stays sharp at any zoom. Animate by updating transforms, not rebuilding the SVG. Fall back to canvas only if the layout animation measures too slow.
- **Libraries:** 98.css for the Windows 98 controls, inlined into the file. Nothing else.
- **Speed:** one edit (current design plus two sheet-height sweeps) under 60 ms; saved-design analyses cached by their settings.
- **Storage:** localStorage under a uniquely named, versioned key, in try/catch, with a note if storage is blocked. Saved designs live in that browser on that laptop and don't travel with the file.
- **Tests:** `node --test` for the reference numbers, taper angle ↔ tip diameter round trip, linked-field rules, badge baselines, save and load, and the copied OpenSCAD file (values filled in correctly, nothing else changed).

## Commands

- `node --test` runs every test.
- `node tools/build.mjs` inlines all modules, styles and 98.css into `dist/planner.html`, the only file handed out.
- Open `dist/planner.html` straight from disk in Chrome to check it (no server).

## Build order

Build in this order, ending each phase with tests passing and a screenshot (headless Chrome is fine), so the riskiest parts are checked early and the late features have their groundwork.

1. **Core math:** geometry with taper angle and hub settings; tests match the reference numbers.
2. **Skeleton and drawings:** Windows 98 window, menu bar and toolbar layout, linked inputs, the dimension model, every drawing in SVG, two-way focus highlighting, measurements table.
3. **Comparing:** change badges, last-version ghost, saved designs, side-by-side panels, compare table, settings panel.
4. **Student visuals:** turn dial, slide ruler, fit meters, try-these examples, How it works, "?" explainers.
5. **OpenSCAD export:** Copy OpenSCAD file (sprocket or drill guide), Copy settings only, the paste-into-OpenSCAD help, the sheet SVG and DXF export, and the track box.
6. **Windows 98 polish:** title bar gradient, beveled controls, segmented progress-bar meters, group boxes, tooltips, status bar, pixel icons.
7. **Edit in the drawings:** drag handles and type-in-place on top of the phase 2 dimension model.
8. **Finish:** accessibility, Chromebook and phone checks, README, copy planner.html to a fresh Windows laptop and test it with the internet off.

**Work straight through, no check-ins.** Build all eight phases and hand back the finished product. Whenever you would stop to ask Danielle something, pick the most reasonable answer, keep going, and add an entry to `DECISIONS.md`:

| Phase | Question you would have asked | Assumption made | Why | Where to change it |
| --- | --- | --- | --- | --- |
| 3 | Should loading a saved design count as an edit for badges? | Yes, badges show the change from the design before loading | Matches how every other edit works | `state/session.js` |

The row above is only an example of the format. Put the five assumptions most worth Danielle's review at the top of the file.

## Acceptance checks

Hand back only when every check below passes, with test output or a screenshot as proof. The two checks marked for Danielle are hers to run after delivery; write the checklist she needs.

- [ ] `node --test` reproduces the Clearance simulation tables to ±0.002 mm and the hole counts exactly.
- [ ] Taper angle: the default pin shows about 28.4°. Typing 20° sets the tip diameter to 3.01 mm, and typing 3.01 back gives 20.0°.
- [ ] Turn 360° → 180° with travel held at 6 in: Drum diameter shows ▲ +48.51 (46.21 → 94.72), Hole spacing ▲ +9.525, Holes to drill ▼ −9 (20 → 11), and, with the ghost overlay turned on, the 360° wheel shows as a ghost.
- [ ] Typing 1, 18, 180 in one go badges the change from 360°, not from 18°.
- [ ] Pins 16 → 24: Hole spacing ▼ −3.175 and Plastic between holes ▼ −3.175 (now 1.85 mm, amber).
- [ ] Tapered pin, width 4.0 → 4.8: Squeeze room meter turns red and the "pins hit the hole edges" warning appears.
- [ ] Shape buttons change only the straight section; Straight follows later changes to sheet thickness.
- [ ] Focusing Pitch diameter lights up the pitch circle in every drawing, fades the rest, and shows its plain-words callout. Hovering the pitch circle highlights the Pitch diameter box. The same works for every input.
- [ ] Hub: bolt square 16 → 20 mm raises the smallest allowed drum to 36.78 mm and updates the hub face drawing; center hole 14 mm triggers the pilot-ring warning.
- [ ] Save A (default), set 180°, save B, then check both Compare boxes: side-by-side panels show both at the same scale, "same slide" makes A turn 360° while B turns 180°, and the compare table shows each design's differences from Now.
- [ ] (Danielle, after delivery, using a one-page checklist you write with the expected numbers) on a computer with only OpenSCAD installed and no other files, the copied file renders with the reference sizes (±0.05 mm) and volumes (±1%), and its exported STL opens without errors in PrusaSlicer, Cura or Bambu Studio. The sheet SVG and DXF import into CNC software at true size, with hole spacing and diameter measuring within 0.05 mm.
- [ ] Copy settings only, pasted over the file, renders the same, and the console numbers (hole spacing, drum Ø, holes needed) match the page. When the clipboard is blocked, the Select all dialog appears.
- [ ] Dragging the spacing bar changes the travel exactly as typing the same spacing does; type-in-place applies on Enter and cancels on Escape; arrow keys nudge a focused handle.
- [ ] On a Windows laptop with the internet off, double-clicking planner.html opens it in Chrome with everything working, including copying. Reloading keeps the current design, saved designs and settings. With storage blocked, the page still works and says designs won't be remembered.
- [ ] At 1366 × 768 and 390 px wide: no sideways scroll, no clipped labels, every drawing readable. The Windows 98 theme reads clearly at normal laptop sizes.
- [ ] (Danielle, after delivery) Usability check with one 7th grader: without help, they can say how much bigger the wheel gets for a half turn, what goes wrong with 24 pins, and what the pitch diameter is.

## Decisions already made

Danielle answered these before the build. Follow them. For anything not covered here, make the most reasonable assumption and log it in `DECISIONS.md`.

| Topic | Question | Decision |
| --- | --- | --- |
| Hardware | Which servo will drive it? A standard goBILDA dual-mode servo turns only 300°, so the default 360° design will show a "needs a 5-turn servo" warning. | Fine as is; keep the 360° default and the warning. |
| Hardware | Which pin is the real build: straight 4.0 or tapered 4.5? It becomes the "Our design" example. | Keep the version Danielle printed (tapered 4.0). It printed well, so it is "Our design"; straight 4.0 stays available. |
| Hardware | Where should the pins sit across the sprocket's thickness: flush with the outer face (prints without supports) or centered? | Keep as is: flush with the outer face, as printed. |
| Hardware | How wide is the polycarbonate sheet, and how far from its edge should the row of holes sit? | Not important. Export the sheet as SVG and DXF for CNC cutting instead (see Sheet files for CNC). |
| Hardware | Should the page also give the sheet track's dimensions (slot height from the servo shaft, slot width)? | Yes. |
| Hardware | Which OpenSCAD version is on the laptops? The reference numbers came from 2021.01; newer versions can differ slightly. | Not sure; accept any version. |
| Students | Inches first or millimeters first? | Inches for travel, mm for parts. |
| Students | Should students save a design to a small file and open it on another laptop? | Yes. |
| Students | Do the laptops use Edge or Chrome, and are any school-managed in a way that blocks opening local files? | Chrome. |
| Students | Should the title bar or an About box show a team name or logo? | No name. |
| Students | Add a Print button for a one-page design summary with a true-scale hole-spacing strip (check it with a ruler) as a paper drilling template? | No; the SVG export covers it. |
| Students | Any click or alert sounds? | None. |
| Behavior | Should inputs have minimum and maximum limits, or accept any positive number and warn? | Accept and warn. |
| Behavior | Should the animation start by itself when the page opens? | No, wait for Play. |
| Behavior | When Danielle hands out a newer planner.html, should saved designs from the old one carry over? | Yes, carry them over. |
| Behavior | Should students be able to flip which way the wheel turns and the sheet slides? | Yes, a setting. |
| Behavior | Are the default comparison views right: last-change ghost on, saved designs side by side? | Ghost overlays are an option, off by default. Each saved design has a Compare check box; checking two puts them side by side. |
| Look | Windows 98 scaled to 125% for readability, or pixel-exact at 100%? | Thematically similar to Windows 98, not a pixel-exact copy. |
| Process | Stop after each phase for review, or build straight through? | No check-ins. Build straight through to a finished product, make reasonable assumptions, and log every question in `DECISIONS.md`. |
| Process | Install OpenSCAD to test the copied file automatically? | No. Test the copied file's text in `node --test`; Danielle renders it in OpenSCAD by hand using a checklist you provide. |
| Process | Who writes the How it works text and "?" explainers? | You write them; Danielle reviews them in the finished product. |

## Reference code

Save these two blocks unchanged as `reference/core.js` and `reference/polycarb_sprocket.scad`. The numbers in this brief came from this code.

### core.js

```javascript
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
```

### polycarb_sprocket.scad

```openscad
// ============================================================
//  Pin sprocket that drives a perforated polycarbonate sheet,
//  bolted to a 32 mm goBILDA / ServoCity 25T spline servo hub.
//  (OpenSCAD 2021.01 or newer)
//
//  Turning the sprocket rotation_deg moves the sheet travel
//  (default 360 degrees -> 6 in). Travel per full turn =
//  teeth x hole spacing, so the hole spacing in the sheet is what
//  sets the travel. The sprocket diameter is derived from it so
//  the pins line up.
//
//  The companion "Sprocket and sheet planner" page has a
//  "Copy OpenSCAD settings" button: paste its lines over the
//  matching lines below.
//
//  The sheet slides flat past the sprocket (like a rack and
//  pinion), held by a track so its underside sits
//  "axis to sheet underside" mm from the servo shaft (see console).
//
//  part = "sprocket"    : the sprocket
//  part = "drill_guide" : strip for drilling the sheet holes at the
//                         exact spacing. Butt the fence against the
//                         sheet edge, clamp, drill through every hole.
//
//  Modelled in print orientation, no supports needed.
//  Everything is in the Customizer (Window > Customizer).
// ============================================================

/* [What to make] */
part = "sprocket";            // [sprocket, drill_guide]

/* [Motion] */
rotation_deg = 360;           // how far the sprocket turns
travel       = 152.4;         // how far the sheet moves in that turn (mm), 6 in = 152.4

/* [Sheet] */
hole_d         = 4.5;         // holes in the sheet
sheet_t        = 1.5;         // sheet thickness
teeth          = 16;          // hole spacing = travel per full turn / teeth

/* [Pins] */
pin_d        = 4.0;           // pin width at the drum (0.25 mm clearance each side in a 4.5 hole)
pin_straight = 0;             // pin stays full width this far above the drum before tapering
pin_tip_d    = 2.0;           // rounded tip, helps the pin find the hole
pin_h        = 2.6;           // pin height above the drum
sheet_gap    = 0.4;           // gap between the drum and the underside of the sheet
pin_flat   = 0.7;             // pins are trimmed top and bottom to this fraction of pin_d so they print without supports

/* [Body] */
drum_w = 5;                   // sprocket thickness

/* [Hub mounting] */
bolt_square  = 16;            // M4 tapped holes on the hub, square pattern (mm)
bolt_hole_d  = 4.5;           // M4 clearance hole
bolt_head_d  = 7.5;           // M4 socket head plus a little room
counterbore  = 0;             // sink the screw heads this deep (0 = heads sit on the face)
center_d     = 8;             // centre hole, big enough to pass the servo screw head
pilot        = true;          // ring that drops into the hub's 14 mm recess
pilot_d      = 13.7;          // recess is 14 mm
pilot_h      = 1.2;           // short so it clears the servo screw head

/* [Drill guide] */
guide_holes   = 0;            // 0 = enough holes for the full travel
edge_offset   = 8;            // sheet edge to the centreline of the holes
guide_t       = 4;            // guide thickness
guide_hole_d  = 4.7;          // printed holes shrink a little; 4.7 suits a 4.5 mm bit

/* [Hidden] */
$fn  = 64;
eps  = 0.01;
N        = teeth;
travel_per_rev = travel * 360 / rotation_deg;
P        = travel_per_rev / N;            // hole spacing in the sheet
Rp       = travel_per_rev / (2 * PI);     // pitch radius = sheet mid-plane
yb       = Rp - sheet_t / 2;              // axis to sheet underside
r0       = yb - sheet_gap;                // drum radius
tip_r    = r0 + pin_h;
slab_h   = pin_flat * pin_d;              // pin height across the sprocket (Z)
pin_z    = slab_h / 2;                    // pin centreline above the bed face
bolt_r   = bolt_square / sqrt(2);

// how much of the sheet is in contact at once, and holes needed for the travel
phi_in       = acos(min(1, yb / tip_r));
window       = 2 * tip_r * sin(phi_in);
holes_needed = ceil(travel / P - 1e-9) + ceil(window / P - 1e-9) + 1;
n_guide      = guide_holes > 0 ? guide_holes : holes_needed;

// pin width at height u above the drum: the hull of the base cylinder and the tip ball.
// The base itself sits below the sheet; what matters for fit is the width at u = sheet_gap.
function pin_w_at(u) =
    let(a = pin_d / 2, b = pin_tip_d / 2, s = pin_straight, c = pin_h - b,
        dd = sqrt(a * a + (c - s) * (c - s)),
        ang = dd > b ? atan2(s - c, a) + acos(b / dd) : 90,
        tx = b * cos(ang), ty = c + b * sin(ang))
    u <= s ? pin_d
  : (dd > b && u <= ty) ? 2 * (a + (tx - a) * (u - s) / (ty - s))
  : u <= c + b ? 2 * sqrt(max(0, b * b - (u - c) * (u - c)))
  : 0;

grip     = drum_w - counterbore;
screw_l  = [for (l = [6, 8, 10, 12, 14, 16, 20, 25]) if (l >= grip + 4) l][0];

// ---------- sanity checks ----------
assert(part == "sprocket" || part == "drill_guide", "part must be sprocket or drill_guide");
assert(rotation_deg > 0 && travel > 0, "rotation_deg and travel must be above 0");
assert(pin_straight >= 0 && pin_straight < pin_h, "pin_straight must be between 0 and pin_h");
assert(pin_w_at(sheet_gap) < hole_d,
       str("pin is ", pin_w_at(sheet_gap), " mm wide where it enters the sheet: it must be narrower than hole_d"));
assert(P - hole_d >= 1.5, str("holes would be only ", P - hole_d, " mm apart: use fewer teeth"));
assert(pin_h > sheet_gap + sheet_t, "pins are too short to reach through the sheet");
assert(2 * PI * r0 / N > pin_d + 1, "too many teeth: pins would merge on the drum");
assert(r0 > bolt_r + bolt_head_d / 2 + 0.5, "drum too small for the hub screws");
assert(slab_h < drum_w, "pins are thicker than the drum");
assert(counterbore < drum_w - 1, "counterbore leaves less than 1 mm under the screw heads");

echo(str("SHEET DRIVE  ", rotation_deg, " deg of turn moves the sheet ", travel, " mm (", travel / 25.4, " in)"));
echo(str("  teeth=", N, "  travel per full turn=", travel_per_rev, " mm"));
echo(str("  hole spacing in the sheet = ", P, " mm (", P / 25.4, " in), web between holes = ", P - hole_d, " mm"));
echo(str("  pin is ", pin_w_at(sheet_gap), " mm wide where it enters the sheet, play +/-", (hole_d - pin_w_at(sheet_gap)) / 2, " mm"));
echo(str("  axis to sheet underside = ", yb, " mm   drum dia = ", 2 * r0, "   over pins = ", 2 * tip_r));
echo(str("  pin centreline is ", drum_w - pin_z, " mm from the hub face (", pin_z, " mm from the outer face)"));
echo(str("  sheet needs at least ", holes_needed, " holes for the full travel"));
echo(str("  hub screws: 4 x M4 x ", screw_l, " mm socket head"));

// ---------- sprocket ----------
module pin() {
    // tapered pin with a ball tip pointing along +X, trimmed flat top and bottom
    intersection() {
        hull() {
            translate([-1, 0, 0]) rotate([0, 90, 0]) cylinder(d = pin_d, h = 1 + pin_straight + eps);
            translate([pin_h - pin_tip_d / 2, 0, 0]) sphere(d = pin_tip_d, $fn = 32);
        }
        translate([-2, -pin_d, -slab_h / 2]) cube([pin_h + 4, 2 * pin_d, slab_h]);
    }
}

module sprocket() {
    difference() {
        union() {
            cylinder(r = r0, h = drum_w, $fn = 180);
            for (i = [0 : N - 1])
                rotate(i * 360 / N) translate([r0, 0, pin_z]) pin();
            if (pilot)
                translate([0, 0, drum_w - eps]) cylinder(d = pilot_d, h = pilot_h + eps);
        }
        // centre hole: reach / pass the servo screw
        translate([0, 0, -1]) cylinder(d = center_d, h = drum_w + pilot_h + 2);
        // M4 holes on the hub's 16 mm square (corners at 45 degrees)
        for (a = [45 : 90 : 315])
            rotate(a) translate([bolt_r, 0, 0]) {
                translate([0, 0, -1]) cylinder(d = bolt_hole_d, h = drum_w + 2, $fn = 32);
                if (counterbore > 0)
                    translate([0, 0, -1]) cylinder(d = bolt_head_d, h = counterbore + 1, $fn = 32);
            }
    }
}

// ---------- drill guide ----------
// Plate lies on the sheet; the fence catches the sheet edge.
// Printed fence-up: the face the fence sticks out of goes on the sheet.
module drill_guide() {
    margin  = 6;
    len     = (n_guide - 1) * P + 2 * margin;
    width   = edge_offset + hole_d / 2 + margin;
    fence_w = 4;
    fence_h = sheet_t * 0.8;               // a bit shy of the sheet so the guide sits flat
    difference() {
        union() {
            cube([len, width, guide_t]);
            translate([0, -fence_w, 0]) cube([len, fence_w, guide_t + fence_h]);
        }
        for (k = [0 : n_guide - 1])
            translate([margin + k * P, edge_offset, -1])
                cylinder(d = guide_hole_d, h = guide_t + 2, $fn = 48);
    }
    echo(str("  drill guide: ", n_guide, " holes, ", len, " mm long"));
}

if (part == "sprocket") sprocket();
else drill_guide();
```
