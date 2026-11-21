# Sprocket Planner: hand checks for Danielle

These are the checks the automated tests can't do: real OpenSCAD, a real slicer, real CNC software, a real laptop with the internet off, and a real student. Tick each box. Expected numbers are for the starting design ("Our design", 360° → 6 in, 16 tapered 4.0 mm pins) unless a step says otherwise.

## 1. OpenSCAD makes the right part

Use a computer that has OpenSCAD and `planner.html`, and nothing else from this project.

1. Double-click `planner.html`. Press **Try these ▸ Our design**.
2. In **Make it**, pick **Sprocket**, then press **Copy OpenSCAD file**.
3. In OpenSCAD: **File > New**, click in the editor, **Ctrl+V**, then **F6**.
4. Check the console (bottom of the OpenSCAD window). It should say:
   - [ ] hole spacing in the sheet = **9.525** mm, web between holes = **5.025** mm
   - [ ] drum dia = **46.2104** (about 46.21), over pins = **51.4104**
   - [ ] axis to sheet underside = **23.5052** (about 23.51)
   - [ ] sheet needs at least **20** holes
   - [ ] hub screws: 4 × M4 × **10** mm
   - [ ] These match the page's **Measurements** table.
5. **File > Export > Export as STL**, then open the STL in PrusaSlicer, Cura or Bambu Studio.
   - [ ] It opens without errors or "repair" warnings.
6. Check size and volume. Your slicer shows these, for example in PrusaSlicer's Object info. Sizes should be within ±0.05 mm and volumes within ±1%:

| Part | How to set it up in the planner | Size (mm) | Volume (mm³) | ✓ |
| --- | --- | --- | --- | --- |
| Sprocket | Our design | 51.40 × 51.40 × 6.20 | 8,160 | [ ] |
| Sprocket | Try these ▸ Straight pin (straight 1.9, height 3.2) | 52.60 × 52.60 × 6.20 | 8,345 | [ ] |
| Sprocket | Our design, then View ▸ Expert detail, Hub = Custom, Counterbore depth = 2 | 51.40 × 51.40 × 6.20 | 7,935 | [ ] |
| Drill guide | Our design, Part = Drill guide | 192.97 × 20.25 × 5.20 | 15,173 | [ ] |

These numbers came from OpenSCAD 2021.01. Newer versions can differ slightly in the last digit of the volume.

## 2. Copy settings only

1. With the sprocket file still open in OpenSCAD, change something on the page (for example, **Wheel turns** to 180).
2. Press **Copy settings only**. In OpenSCAD, select the lines from `/* [What to make] */` down to just above `/* [Hidden] */`, then paste over them. Press **F6**.
   - [ ] It renders with no errors.
   - [ ] The console shows hole spacing **19.05**, drum dia **94.72**, at least **11** holes. These match the page.

## 3. Sheet files for CNC

1. Back on Our design, press **Save sheet SVG** and **Save sheet DXF**. The files are named `sheet_16pins_9.525mm_20holes.svg` and `.dxf`.
2. Import each one into your CNC software.
   - [ ] It comes in at true size: the outline is **215.48 × 40.00 mm**.
   - [ ] There are **20** holes of **Ø4.50 mm**. Center to center is **9.525 mm**, and first to last is **180.98 mm**. All within 0.05 mm.
   - [ ] The holes and the outline are on separate layers (`holes` / `outline` in the SVG, `HOLES` / `OUTLINE` in the DXF).

## 4. A school laptop with the internet off

1. Copy only `planner.html` to a USB stick, then onto a Windows laptop (and a Chromebook if you have one).
2. Turn Wi-Fi off. Double-click the file. It opens in Chrome. On a Chromebook, open it from the Files app.
   - [ ] Everything works: typing, Play, the drawings, Save design, Compare, and the "?" buttons.
   - [ ] **Copy OpenSCAD file** copies. If Chrome blocks it, a box with **Select all** appears instead.
   - [ ] **Save sheet SVG** downloads a file.
3. Change the design, save a design, change a setting, then close Chrome and open the file again.
   - [ ] The design, saved designs and settings are all still there.
4. If the school blocks site storage, the page should still work and say designs won't be remembered.

## 5. One 7th grader, no help

Give a student the file and these three questions. Don't explain anything. Write down what they say.

| Question | A good answer | ✓ |
| --- | --- | --- |
| How much bigger does the wheel get if it only turns half as far (180°) but the sheet still slides 6 in? | About twice as big: 46.21 mm → 94.72 mm (the badge shows ▲ +48.51). | [ ] |
| What goes wrong with 24 pins? | The holes get close together. The plastic between them is only 1.85 mm, so it might crack (amber warning). | [ ] |
| What is the pitch diameter? | The circle where the pins push the sheet. It's the "Push circle", 48.51 mm. | [ ] |

Notes from the session (what confused them, where they got stuck):

&nbsp;

&nbsp;
