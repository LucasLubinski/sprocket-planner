# Sprocket Planner

One self-contained web page (`dist/planner.html`) for designing a 3D-printed pin sprocket and the drilled polycarbonate sheet it drives. The full brief is in `CLAUDE.md`; judgment calls are in `DECISIONS.md`.

## Status (work in progress)

| Phase | State |
| --- | --- |
| 1. Core math | Done. Reproduces every reference number. |
| 2. Window, linked inputs, dimension model, drawings, two-way highlighting, measurements | Done. |
| 3. Badges, ghosts, saved designs, side-by-side panels, compare table, settings | Done. |
| 4. Turn dial, slide ruler, fit meters, How it works animation, "?" explainers | Done: dial (ghost names in a legend under it), ruler (labels above full-width bars), meters (markers at the same value stack), Try-these buttons, How it works loop, "?" explainers with small animations, and the title-bar "What's this?" mode. UI tests cover each. |
| 5. Copy OpenSCAD file / settings, sheet SVG and DXF, track box | Done: Make it box with the Part choice, both copy buttons (clipboard, then a Select all box if blocked), SVG and DXF downloads, the track sizes and end-view drawing, How to make the STL and How to use help. `test/scad.test.js` checks the copied file. |
| 6. Windows 98 polish | Done: 98.css look, title bar, menus with Alt letters, toolbar with yellow tooltips, group boxes, segmented meters, status bar, pixel icons, High Contrast scheme. Tests check that no text drops under 13 px, tap targets reach 44 px on touch screens, and drawing labels never cover pins, holes or each other. |
| 7. Drag handles and type-in-place | Not started. The dimension objects already carry drag and value info. |
| 8. Accessibility, phone checks, docs, Danielle's checklist | Not started. |

Test results right now: 69 of 69 pass (`node --test`).

### Locks and pin options (added after Phase 4)

- **Locking inputs:** padlocks on the main boxes. When a change would move a locked number, the planner moves another one and says why beside the box (and in the status bar). It refuses only when nothing can move. Boxes that the locks fix together show "held".
- **Choosing what moves:** with "Let me choose" (Settings, or View menu), a chooser under the edited box lists every free number that could balance the change, with a preview. "Pick for me" skips it.
- **Pin shape options:** "Keep the tip round" (sets the Tip size lock) and "Straight past the sheet" (Straight mode only).
- The routing table and its words live in `state/link.js`; the lock state in `state/store.js`.

## Commands

Building and testing need Node.js 22 or newer. Using the planner doesn't.

```
node --test              # all tests (the UI tests need Chrome; they skip without it)
node tools/build.mjs     # writes dist/planner.html and docs/index.html (the GitHub Pages copy)
node tools/shoot.mjs <outDir> <name> 1366 768   # screenshot from headless Chrome
```

## Folders

`reference/` the two verified files, unchanged · `core/` geometry and analysis · `state/` design, edits, badges, saved designs, settings, storage · `draw/` one module per drawing · `ui/` the page · `styles/win98.css` · `vendor/98.css-0.1.21/` (MIT; font CC BY-SA 3.0, licenses kept) · `tools/` build and Chrome driver · `test/`.
