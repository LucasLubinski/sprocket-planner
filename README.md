# Sprocket Planner

**▶ [Open the Sprocket Planner](https://lucaslubinski.github.io/sprocket-planner/)**

Design a 3D-printed pin sprocket and the drilled plastic sheet it pushes. Then get the files to print it and cut it.

The sprocket bolts to a servo. Its pins poke through a row of holes in a thin polycarbonate sheet. When the servo turns, the sheet slides, like a rack and pinion. The planner works out the wheel size, hole spacing and pin shape for you, and shows every change as a picture.

It runs in your web browser. There's nothing to install and no account to make.

## Getting started

1. **Open the planner** with the link above.
2. **Type how far the wheel turns and how far the sheet slides.** For example, turn 360° and slide 6 in. Everything else follows.
3. **Watch the drawings change.** Green ▲ and red ▼ badges show what went up or down, and by how much.
4. **Click any box** to see its part light up in the drawings. Press the **?** next to it to learn what it means.
5. **Change numbers right in the drawings.** Click any underlined number, type a new value and press Enter (Escape cancels). Some also have a pink dot you can drag.
6. **Check the fit meters.** Green is good. If one turns red, its warning tells you how to fix it.
7. **Press Play** to watch the pins push the sheet.

Not sure where to start? Try the buttons under **Try these**. Each one loads a design that shows a common problem.

## Saving and comparing designs

- **Save design** keeps a copy of what you have. It opens as its own tab under the toolbar.
- **Tabs:** "Current" is your working design. Click a saved design's tab to change it. Changes there save straight into that design. Each tab has its own undo.
- **Closing a tab (×)** doesn't delete the design. Use **Open tab** in the Saved designs list to bring it back.
- **Compare:** check the Compare box on two to four saved designs. They appear side by side at the same scale and move together when you press Play. A table underneath lists their numbers.
- **Locks:** click a box's padlock to keep that number fixed. The planner then changes a different number and tells you which one and why.

Your designs are saved in your browser, so they're still there next time you open the planner on the same computer. To move a design to another computer, use **File ▸ Save design to a file…**, then **File ▸ Open a design file…** on the other one.

## Making the parts

All of these are in the **Make it** panel and the **Export** menu.

- **Sprocket or drill guide (3D print):** pick the part, then press **Copy OpenSCAD file**. Paste it into [OpenSCAD](https://openscad.org/) (free), press F6, and export an STL for your slicer. **Help ▸ How to make the STL** walks through each step.
- **Already have the file open in OpenSCAD?** Use **Copy settings only** and paste it over the settings at the top of the file.
- **The sheet (CNC):** **Save sheet SVG** and **Save sheet DXF** download the hole pattern and the sheet outline at true size. Holes and outline are on separate layers.
- **The track:** the track box lists the slot sizes for the track that holds the sheet.

## Getting help

- **Help ▸ How to use** (or F1) gives the main steps.
- Every box has a **?** button with a short explanation and a small animation.
- The **?** in the title bar turns on "What's this?" mode. Click any drawing or meter to find out what it shows.
- **View ▸ Settings** sets units, decimal places, detail level, badge colors and more. **Student** detail level hides the advanced boxes.

---

## For developers

The planner is one self-contained HTML file. The source is in this repository. A build step bundles it into `dist/planner.html` and `docs/index.html`, and GitHub Pages serves `docs/` from the `main` branch.

The full brief is in `CLAUDE.md`.

### Building and testing

You need Node.js 22 or newer, and Chrome for the UI tests.

```
node tools/build.mjs     # bundles everything into dist/planner.html and docs/index.html
node --test              # every test; the UI tests skip if Chrome isn't installed
node tools/shoot.mjs <outDir> <name> 1366 768 [--full] [--eval "js"]   # screenshot from headless Chrome
```

To publish a new version, run the tests, run the build, then commit and push. The site updates from `docs/index.html`.

What the tests check:

| File | Checks |
| --- | --- |
| `test/reference.test.js`, `test/taper.test.js` | The brief's clearance tables to ±0.002 mm, hole counts, and taper angle ↔ tip size |
| `test/analyze.test.js` | Warnings, fit zones, the hub checks, and the "holes run together" case |
| `test/link.test.js`, `test/session.test.js` | Linked-field rules, locks and what moves instead, the chooser, pin options, badge baselines, saving and loading |
| `test/tabs.test.js` | Saved designs as tabs: per-tab undo and badges, switching, closing, and reloading |
| `test/scad.test.js` | The copied OpenSCAD file: every value filled in, nothing else changed, and byte-identical for the default design |
| `test/build.test.js` | The built file loads nothing from the internet, and one edit takes under 60 ms |
| `test/ui.test.mjs` | Opens the built file in headless Chrome and drives it like a student. Covers every acceptance check in `CLAUDE.md` that a machine can run, plus no text under 13 px, 44 px tap targets on touch screens, labels never covering pins, holes or each other (8 to 40 pins, 1366 and 390 px), named controls, no sideways scroll, and storage blocked |

### Saved data

Designs, settings and locks are kept in the browser's localStorage under `sprocketPlanner.v1` (`state/storage.js`). Every version reads the same key, so saved designs carry over when the site updates. If you ever change what's stored, add the old key to `OLDER_KEYS` and convert it in `migrate()`. If storage is blocked, the page still works and says designs won't be remembered.

### Updating the OpenSCAD model

- The model is `reference/polycarb_sprocket.scad`. The build copies it into the page unchanged. "Copy OpenSCAD file" changes only the values on the parameter lines, between `/* [What to make] */` and `/* [Hidden] */`.
- To add a parameter, add its line to the .scad file, then add its design key and OpenSCAD name to `SCAD_NAMES` and its default to `BASE` in `core/params.js`. Add an input in `state/fields.js` if students should see it.
- Keep the .scad defaults and the `BASE` defaults the same.
- The copied file adds one setting the reference file doesn't have: `withPinCenter()` in `core/scad.js` inserts a `pin_center` line after `pin_flat` and rewrites the `pin_z` line to use it. A test checks that the default design copies out as the .scad file plus exactly those two lines. If you rename `pin_flat` or `pin_z` in the .scad file, update `withPinCenter()` too.
- **Copy settings only** can't center the pins in a .scad file that was copied before `pin_center` existed, because that file's `pin_z` line ignores it. Use **Copy OpenSCAD file** instead.
- Run `node --test` and `node tools/build.mjs`, then publish. Then render the copied file in OpenSCAD and check that it still renders without errors.

### How it's built

One data flow: the design (`state/store.js`) goes through `analyze()` (`core/analyze.js`) to a view model (`ui/vm.js`) that every drawing, table and meter reads. No drawing works out geometry on its own. Every dimension in a drawing is an object (`draw/svg.js`) with its setting, anchors, label and drag rule. The same objects drive highlighting, badges on labels, drag handles and type-in-place (`ui/handles.js`). Set `editable: true` on a dimension to make its label clickable; add `drag` and `handle` for a drag dot too. A label that shows a result tied to one input uses `show` (the number it shows) and `set: { key, from }` (the input it changes and how), for example slot height sets the track clearance to slot height − sheet thickness.

| Folder | What's in it |
| --- | --- |
| `reference/` | The two verified files, unchanged |
| `core/` | Geometry and clearance sweep, taper angle, analysis and checks, the OpenSCAD and sheet files |
| `state/` | The design, tabs, edits and badge baselines, linked fields and lock routing (`link.js`), saved designs, settings, storage |
| `draw/` | One module per drawing |
| `ui/` | Window, menus, toolbar, tabs, inputs, dialogs, tables, meters, export box, drag handles |
| `styles/win98.css`, `vendor/98.css-0.1.21/` | The look. 98.css is MIT-licensed and its pixel font is CC BY-SA 3.0; both licenses are kept |
| `tools/` | The build, the Chrome driver, screenshots, and in-page audits used by the tests |

### Known limits

- The fit check is a 2D cut through the middle of the pins. It assumes perfectly placed holes and a rigid sheet, and ignores friction and print error. Holes drilled a little off will rub first at the tightest point the chart shows.
- The page doesn't make STL files or a 3D preview. OpenSCAD does that from the copied file. A "Download .scad file" button would be an easy addition.
