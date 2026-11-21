Written: 2026-11-21

## Goal
Build the Sprocket Planner described in `CLAUDE.md`: one self-contained `dist/planner.html` that a 7th grader opens in Chrome, offline, to design a 3D-printed pin sprocket and its drilled polycarbonate sheet. Luke publishes it on GitHub Pages too (`docs/index.html`).

## Current Status
All eight phases are built and committed on `main`. `node --test` passes 117 of 117. The only open items are the two checks that belong to Danielle (`CHECKLIST.md`): real OpenSCAD, slicer and CNC imports, a real offline laptop, and a usability session with a student.

## Git State
- Branch `main`. Commits since `origin/main` (`153d50d`) are not pushed: Phase 4 finish, Phase 5, Phase 6, Phase 7 (locks), Phase 7 (drag handles), Phase 8. Luke asked for commits without check-ins; ask before pushing.

## Completed
- Phase 1 core math (`core/`), Phase 2 window, inputs, dimension model and drawings, Phase 3 comparing, Phase 4 student visuals.
- Phase 5: `core/scad.js` and `core/scad-template.js` (Copy OpenSCAD file, Copy settings only), `ui/export.js` (Make it box, SVG and DXF downloads, STL and How to use help), `draw/track.js`.
- Phase 6: `tools/audit.js` (text 13 px or more, 44 px touch targets), `tools/overlap.js` (labels never cover pins, holes or each other), many label and touch fixes.
- Phase 7: lock routing, held boxes, notes, chooser and pin options in `state/link.js`, `state/store.js` and `ui/inputs.js`; drag handles, arrow keys and type-in-place in `ui/handles.js`.
- Phase 8: accessibility, blocked-storage and offline tests (`test/build.test.js`, `test/ui.test.mjs`), adult `README.md`, `CHECKLIST.md`, `DECISIONS.md` top five.

## Key Decisions
See `DECISIONS.md`. The top five: hub minimum radius 15.56 mm; the Straight button holds the slant (use "Keep the tip round" or the Straight pin example); pins-in-sheet zones; CNC sheet hole count and length; what "held" means.

## Dead Ends
- Don't hover-test the pitch circle at arbitrary angles; pins sit on it.
- Opacity checks right after focus see mid-transition values; wait about 300 ms.
- Headless Chrome here matches `(any-pointer: coarse)`, so screenshots show the 44 px touch layout.
- The page's CSP blocks `fetch` (even `blob:` URLs); read download Blobs directly in tests.
- Long Python here-docs in one Bash call can fail to parse; write the script to the scratchpad first.
- Windows sometimes locks `dist/planner.html` for a moment; `tools/build.mjs` retries the write.

## Next Steps
1. Ask Luke whether to push `main`.
2. Danielle runs `CHECKLIST.md`; fix whatever it turns up.

## Useful Commands
```
node tools/build.mjs
node --test
node tools/shoot.mjs <outDir> <name> 1366 768 [--full] [--eval "js"]
```
