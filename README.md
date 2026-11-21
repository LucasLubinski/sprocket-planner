# Sprocket Planner

One self-contained web page (`dist/planner.html`) for designing a 3D-printed pin sprocket and the drilled polycarbonate sheet it drives. The full brief is in `CLAUDE.md`; judgment calls are in `DECISIONS.md`.

## Status (work in progress)

| Phase | State |
| --- | --- |
| 1. Core math | Done. Reproduces every reference number. |
| 2. Window, linked inputs, dimension model, drawings, two-way highlighting, measurements | Done. |
| 3. Badges, ghosts, saved designs, side-by-side panels, compare table, settings | Done. |
| 4. Turn dial, slide ruler, fit meters, How it works animation, "?" explainers | Mostly done: dial, ruler, meters, Try-these buttons, How it works loop, "?" explainers with small animations, and the title-bar "What's this?" mode all work. Left: meter labels overlap when two markers sit at the same value; ruler bars are small because their labels sit beside them; no UI tests for these yet. |
| 5. Copy OpenSCAD file / settings, sheet SVG and DXF, track box | Not started. `core/sheetfiles.js` already writes the SVG and DXF text; the buttons aren't wired. |
| 6. Windows 98 polish | Partly done (98.css look, menus, toolbar, status bar). |
| 7. Drag handles and type-in-place | Not started. The dimension objects already carry drag and value info. |
| 8. Accessibility, phone checks, docs, Danielle's checklist | Not started. |

Test results right now: 69 of 69 pass (`node --test`).

## Commands

Node.js 22 or newer is needed. It isn't installed on this laptop yet; install Node 22 LTS from nodejs.org.

```
node --test              # all tests (the UI tests need Chrome; they skip without it)
node tools/build.mjs     # writes dist/planner.html
node tools/shoot.mjs <outDir> <name> 1366 768   # screenshot from headless Chrome
```

Until Node is installed, the copy bundled with Photoshop works:

```
& "C:\Program Files\Adobe\Adobe Photoshop 2026\node.exe" --test
```

## Folders

`reference/` the two verified files, unchanged · `core/` geometry and analysis · `state/` design, edits, badges, saved designs, settings, storage · `draw/` one module per drawing · `ui/` the page · `styles/win98.css` · `vendor/98.css-0.1.21/` (MIT; font CC BY-SA 3.0, licenses kept) · `tools/` build and Chrome driver · `test/`.
