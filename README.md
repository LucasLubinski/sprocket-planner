# Sprocket Planner

One self-contained web page, `dist/planner.html`, where students design a 3D-printed pin sprocket and the drilled polycarbonate sheet it drives, then copy a print-ready OpenSCAD file and save CNC files for the sheet. It runs offline by double-clicking the file in Chrome. It needs no install, no server and no internet.

- The full brief is in `CLAUDE.md`.
- The judgment calls are in `DECISIONS.md`, with the five most worth a look at the top.
- The hand checks for Danielle are in `CHECKLIST.md`.

## Handing it out

- **Give students only `dist/planner.html`.** Everything is inside it: the code, the Windows 98 look and its font, and the full OpenSCAD model. Use a USB stick, a shared drive or email (it's about 0.4 MB).
- **Windows:** double-click it. It opens in Chrome. **Chromebook:** open it from the Files app.
- **Saved designs are tabs.** "Current" is the working design. Each saved design opens as its own tab under the toolbar, and edits there save straight into that design. Each tab keeps its own undo and change badges. Closing a tab (×) keeps the design; Open tab in Saved designs brings it back.
- **Saved designs live in that browser on that laptop.** They don't travel with the file. To move a design to another laptop, use **File ▸ Save design to a file…**, then **Open a design file…** on the other laptop.
- **Handing out a newer version:** replace the old `planner.html` with the new one. Saved designs, settings and locks carry over, because every version reads the same storage key (`sprocketPlanner.v1` in `state/storage.js`). If you ever change what's stored, add the old key to `OLDER_KEYS` and convert it in `migrate()`.
- **If storage is blocked** (some school setups), the page still works and says designs won't be remembered.
- A copy for the web is written to `docs/index.html` (GitHub Pages: Settings ▸ Pages ▸ branch `main`, folder `/docs`). It is the same file.

## For students

Help ▸ **How to use** (F1) explains the page in eight steps. Help ▸ **How to make the STL** walks through OpenSCAD and the slicer. Every box has a **?** button, and the title-bar **?** turns on "What's this?" mode for the drawings and meters. **Try these** loads teaching designs that each show one problem.

## Building and testing

You need Node.js 22 or newer (Chrome too for the UI tests). Students don't need either.

```
node tools/build.mjs     # bundles everything into dist/planner.html and docs/index.html
node --test              # every test (117); the UI tests skip if Chrome isn't installed
node tools/shoot.mjs <outDir> <name> 1366 768 [--full] [--eval "js"]   # screenshot from headless Chrome
```

What the tests check:

| File | Checks |
| --- | --- |
| `test/reference.test.js`, `test/taper.test.js` | The brief's clearance tables to ±0.002 mm, hole counts, and taper angle ↔ tip size |
| `test/analyze.test.js` | Warnings, fit zones, the hub checks, and the "holes run together" case |
| `test/link.test.js`, `test/session.test.js` | Linked-field rules, locks and what moves instead, the chooser, pin options, badge baselines, saving and loading |
| `test/scad.test.js` | The copied OpenSCAD file: every value filled in, nothing else changed, and byte-identical for the default design |
| `test/build.test.js` | The handed-out file loads nothing from the internet, and one edit takes under 60 ms |
| `test/ui.test.mjs` | Opens the built file in headless Chrome and drives it like a student. Covers every acceptance check in `CLAUDE.md` that a machine can run, plus no text under 13 px, 44 px tap targets on touch screens, labels never covering pins, holes or each other (8 to 40 pins, 1366 and 390 px), named controls, no sideways scroll, and storage blocked |

## Updating the OpenSCAD model

- The model is `reference/polycarb_sprocket.scad`. The build copies it into the page unchanged. "Copy OpenSCAD file" changes only the values on the parameter lines, between `/* [What to make] */` and `/* [Hidden] */`.
- To add a parameter, add its line to the .scad file, then add its design key and OpenSCAD name to `SCAD_NAMES` and its default to `BASE` in `core/params.js`. Add an input in `state/fields.js` if students should see it.
- Keep the .scad defaults and the `BASE` defaults the same. A test checks that the default design copies out byte-for-byte equal to the .scad file.
- Run `node --test`, then `node tools/build.mjs`, and hand out the new `dist/planner.html`. Then do section 1 of `CHECKLIST.md` again.

## How it's built

One data flow: the design (`state/store.js`) goes through `analyze()` (`core/analyze.js`) to a view model (`ui/vm.js`) that every drawing, table and meter reads. No drawing works out geometry on its own. Every dimension in a drawing is an object (`draw/svg.js`) with its setting, anchors, label and drag rule. The same objects drive highlighting, badges on labels, drag handles and type-in-place (`ui/handles.js`).

| Folder | What's in it |
| --- | --- |
| `reference/` | The two verified files, unchanged |
| `core/` | Geometry and clearance sweep, taper angle, analysis and checks, the OpenSCAD and sheet files |
| `state/` | The design, edits and badge baselines, linked fields and lock routing (`link.js`), saved designs, settings, storage |
| `draw/` | One module per drawing |
| `ui/` | Window, menus, toolbar, inputs, dialogs, tables, meters, export box, drag handles |
| `styles/win98.css`, `vendor/98.css-0.1.21/` | The look. 98.css is MIT-licensed and its pixel font is CC BY-SA 3.0; both licenses are kept |
| `tools/` | The build, the Chrome driver, screenshots, and in-page audits used by the tests |

## Known limits

- The fit check is a 2D cut through the middle of the pins. It assumes perfectly placed holes and a rigid sheet, and ignores friction and print error. Holes drilled a little off will rub first at the tightest point the chart shows.
- The page doesn't make STL files or a 3D preview. OpenSCAD does that from the copied file. A "Download .scad file" button would be an easy addition.
