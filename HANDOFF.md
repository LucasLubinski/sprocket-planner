Written: 2026-11-21 12:59

## Goal
Build the Sprocket Planner described in `CLAUDE.md` (read it in full first; it is the brief and overrides defaults): one self-contained `dist/planner.html` that a 7th grader opens in Chrome, offline, to design a 3D-printed pin sprocket and its drilled polycarbonate sheet. All eight phases in CLAUDE.md's Build order must be finished, every runnable acceptance check passing, with `DECISIONS.md`, a README for adults and a one-page hand-check checklist for Danielle. The user (Luke, GitHub `LucasLubinski`) also publishes it on GitHub Pages.

## Current Status
Phases 1–3 are done, Phase 4 is mostly done, and Phases 5–8 are not built. `node --test` passes 69/69. Luke added new scope after Phase 4, written into `CLAUDE.md` but **not built**: locking inputs, choosing which number moves, two pin-shape options, and a close-up overlap bug. He is clearing the chat to continue coding in a new session from this file. The last session only planned; no planner code changed since commit `3ee01a6`.

## Git State
- Branch `main`, last commit `3ee01a6 Build writes docs/index.html` (previous `49ac8ae Sprocket Planner: phases 1-4`). Remote `origin` = https://github.com/LucasLubinski/sprocket-planner.git; the local `main` matched `origin/main` before these doc edits.
- Uncommitted (docs only; Luke interrupted an earlier commit attempt, so ask before committing):
  - ` M CLAUDE.md`: new "Locking inputs" section with "Choosing what moves" and "Pin shape options" subsections, a new Settings row, Phase 7 renamed "Edit in the drawings, and locks", and new acceptance checks.
  - ` M DECISIONS.md`: Phase 7 rows for locks, the chooser and the pin options.
  - ` M README.md`: "Added to the plan (not built yet)" list and the known close-up bug.
  - `?? HANDOFF.md`: this file.

## Completed
- **Phase 1, core math:** `core/geometry.js` (from `reference/core.js`; hub values from settings, pointed pins, `gapFast` matches the reference to 1e-9), `core/taper.js` (`tipFromTaper`, `taperFromTip`, `minTaper`, `maxTaper`), `core/analyze.js` (3 sweeps, checks, chips, flat `v` map, `ZONES`), `core/params.js`, `core/format.js`, `core/sheetfiles.js` (`sheetLayout`, `sheetSVG`, `sheetDXF`, `fileName`; not wired to buttons). All CLAUDE.md reference numbers reproduce.
- **Phase 2:** Win98 window on vendored 98.css 0.1.21 (`vendor/98.css-0.1.21/`, licenses kept), menu bar (`ui/menubar.js`), toolbar and pixel icons (`ui/toolbar.js`, `ui/icons.js`), linked inputs (`ui/inputs.js`, `state/link.js` `applyField`), and the dimension model in `draw/svg.js` (`Sketch.linear`, `angle` and `leader` register dims with key, kind, anchors, editable, drag spec and handle; `fit()` sizes labels at 14 px). Drawings: `draw/layout.js`, `closeup.js`, `pinhole.js`, `chart.js`, `hubface.js`, `sheet.js`. Two-way highlighting and callouts (`ui/highlight.js`), measurements table (`ui/tables.js`).
- **Phase 3:** badges (`state/badges.js`; baselines in `state/session.js`), ghost overlay (`ui/vm.js` `ghosts`), saved designs (`ui/saved.js`, `state/store.js`), same-scale side-by-side panels (`draw/panels.js`), compare table, Settings dialog (`ui/settingsdlg.js`), design files, undo/redo, localStorage `sprocketPlanner.v1` (`state/storage.js`).
- **Phase 4 (mostly):** dial (`draw/dial.js`), ruler (`draw/ruler.js`), fit meters (`ui/meters.js`), Try-these buttons (`state/examples.js`, 6 examples), How it works loop (`draw/howitworks.js`), "?" explainers and the "What's this?" mode (`ui/explain.js`). `vm.marks` gives the dial, ruler and meters their last-version and Compare markers.
- **Build:** `tools/build.mjs` bundles everything into `dist/planner.html` and the identical `docs/index.html` (GitHub Pages, branch `main`, folder `/docs`).
- **Tests:** `test/reference|taper|analyze|link|session.test.js` and `test/ui.test.mjs` (headless Chrome via `tools/cdp.mjs`; covers the Phase 2–3 acceptance checks).
- **Node.js 26.13.1 LTS** installed in `C:\Program Files\nodejs\` (on the PATH). Photoshop's bundled node is no longer used.

## In Progress
Nothing half-finished in code. Two parts of Phase 4 were left unfixed (Luke rejected those edits when he paused the build): meter "now" and "before" labels overlap when values match (`ui/meters.js`), and the ruler bars are small because their labels sit beside them (`draw/ruler.js`).

## Running Processes
None. `tools/shoot.mjs` and `test/ui.test.mjs` start and close headless Chrome each run.

## Background Work
None

## Key Decisions
Full list in `DECISIONS.md`. Most important:
- Smallest hub drum radius is 15.56 mm (31.13 Ø), not the brief's 15.06; the formula, code and the 36.78 acceptance number all use +0.5.
- Straight button holds the taper angle (rules table), so the default gets "tip too big"; there is a 6th example, "Straight pin". The new "Keep the tip round" option (planned) also fixes this.
- Pins-in-sheet meter: red <1, amber 1–1.5, green ≥1.5. Sheet file holes = `guide_holes` (0 = auto).
- Badges: focus begins an edit, but old badges stay until something changes; the edited field gets a dashed outline, not a badge.
- **Locks (planned, Luke's choices):** when an edit would move a locked number, move the next free one and explain why in plain words; refuse only when nothing can move; never move Pins. Locks on the main design boxes only. Locks stay on through examples, loads and resets, and aren't saved in saved designs.
- **Choosing what moves (planned):** an inline chooser under the edited box, the usual option pre-picked, asked once per edit, never a pop-up. Setting "When a change moves other numbers": Let me choose (default) or Pick for me.
- **Pin options (planned):** "Keep the tip round" (student check box that sets the Tip size lock; default off) and "Straight past the sheet" (mm, Straight mode only; straight part = gap + thickness + value).
- GitHub Pages serves `docs/index.html`; the root `index.html` stays the build template. Luke said that's fine; don't restructure.
- README must not mention where Node.js is installed.

## Files Touched
- Earlier and committed: the whole project (see `git ls-files`), `tools/build.mjs` writing `docs/index.html`.
- Since the last commit: `CLAUDE.md` (new scope and acceptance checks), `DECISIONS.md` (Phase 7 rows), `README.md` (planned list, known bug), `HANDOFF.md` (rewritten).

## Dead Ends
- Don't hover-test the pitch circle at arbitrary angles; pins sit on it. Aim between pins (`-90 + 11.25 + 7*22.5` degrees).
- Opacity checks right after focus see mid-transition values; wait about 300 ms.
- The repo root is `F:\Claude Code\sprocket`, not `F:\Claude Code` (a too-high `git init` was undone once).
- On Node 24+ the test totals start with `ℹ`; grep `(tests|pass|fail) \d+$`.
- Headless Chrome here matches `(any-pointer: coarse)`, so screenshots show the 44 px touch layout. That's expected.

## Open Questions / Blockers
- Luke interrupts tool calls often to redirect; confirm before committing or pushing.
- GitHub Pages `/docs` setting not confirmed (expected URL https://lucaslubinski.github.io/sprocket-planner/).
- Close-up bug cause not yet checked. Likely, not verified: `draw/closeup.js` `view()` narrows the window as pins increase (`W = max(12, min(2.4·P, 50))`, 15 mm at 24 pins), while the 14 px squeeze-room label, hole-spacing dimension (with its badge, e.g. "▼ −3.175") and notes stay the same size inside a box capped at `maxHeightPx: 360`, so they cover the pins.

## Next Steps
1. Ask Luke whether to commit the doc changes listed under Git State, then confirm where he wants to start; default order below.
2. Fix the close-up overlap: screenshot with `node tools/shoot.mjs <dir> cu24 1366 768 --eval` setting `teeth` to 24 and scrolling to `#sec-closeup`. Keep labels outside the pin and hole area (e.g. move them to lanes above and below the window, and grow the window or the height cap). Then check every drawing at 1366×768 and 390 px with 8, 16, 24 and 40 pins, and add a UI test that SVG label boxes don't overlap the pins or holes.
3. Finish Phase 4: meter marker stacking (`ui/meters.js`), ruler labels above the bars (`draw/ruler.js`), UI tests for the dial, ruler, meters and explainers.
4. Phase 5: `core/scad-template.js` (Node reads `reference/polycarb_sprocket.scad`; `tools/build.mjs` already swaps this module for a string), `core/scad.js` (fill values, keep formatting, settings-only block) and `test/scad.test.js` (defaults byte-identical). Then `ui/export.js`: Part radio, Copy OpenSCAD file / Copy settings only with `D.copyFallback`, Save sheet SVG/DXF via `download()` and `fileName()`, a track box drawing keyed `trackClearT trackClearW` (then remove `LATER` in `test/ui.test.mjs`), the STL help dialog. The commands `copyScad`, `copySettings`, `saveSVG`, `saveDXF`, `stlHelp` and `howToUse` are in the menus but missing from `ui/main.js` `commands`.
5. Phase 6 polish.
6. Phase 7, in this order: lock routing in `state/link.js` (route table in CLAUDE.md "Locking inputs"), lock state in `state/store.js` (persisted with the current design), padlocks and "held" marks in `ui/inputs.js`, "what moved and why" notes; then the "Choosing what moves" chooser and setting (`state/settings.js` CHOICES, `ui/settingsdlg.js`); then pin options ("Keep the tip round", "Straight past the sheet"; new design key with a default in `core/params.js`, rule in `followStraight`); then drag handles and type-in-place from `drawing.dims` (`ui/drawings.js` `toWorld`), using the same routing. Acceptance numbers (already checked): Wheel size 60 with slide locked → turn 280.3°; Hole spacing locked, Pins 24 → turn 240°; Tip locked, width 4.4 → slant 32.4°; chooser preview 7.71 in / 280.3°; Keep tip round, height 4.0 → slant 17.6°.
7. Phase 8: accessibility, 1366×768 and 390 px checks, adult README, `CHECKLIST.md` for Danielle (OpenSCAD reference sizes from CLAUDE.md), final DECISIONS top five.
8. After each step: `node tools/build.mjs`, `node --test`, then ask Luke before committing and pushing.

## Useful Commands
```
node tools/build.mjs                       # writes dist/planner.html and docs/index.html
node --test                                # all tests (UI tests need Chrome)
node tools/shoot.mjs <outDir> <name> 1366 768 [--full] [--eval "js"]   # screenshot from headless Chrome
git add . ; git commit -m "..." ; git push
```
In the page, `window.SprocketPlanner` exposes `store` (`setField`, `beginEdit`, `setDesign`, `setSettings`), `run(cmd)`, `turnTo(deg)`, `renderNow()` and `compare.turn(f)`. Scratch files go in the session scratchpad, not the project.
