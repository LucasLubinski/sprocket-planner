Written: 2026-11-22 18:38 CST

## Goal
Build the Sprocket Planner described in `CLAUDE.md`. It is one self-contained `dist/planner.html` that a 7th grader opens in Chrome, offline, to design a 3D-printed pin sprocket and its drilled polycarbonate sheet. It hands out a filled-in OpenSCAD file and SVG/DXF sheet files for CNC. Luke also publishes the same file on GitHub Pages as `docs/index.html`.

## Next: saved designs as tabs (Luke's request, not started)
Luke wants each saved design to open as its own tab in the Windows 98 window. A student moves between tabs, and each tab is the full planner for that design: every input, drawing, meter, table and visual, fully editable.

**What exists now** (read these first):
- `state/store.js`: one live `design`, plus `saved`, an array of `{ id, name, design, created, compare }`.
  - Save and load: `saveDesign()` copies the live design into `saved`. `loadSaved(id)` replaces the live design through `setDesign(..., "load")`. `overwriteSaved(id)` copies the live design back into a saved entry.
  - One shared state: undo/redo (`undoStack`, `redoStack`), the edit session and badge baseline (`session`), and `locks` belong to the store, not to a design.
  - Persistence: `persist()` writes `{ design, settings, saved, nextLetter, locks }` under `sprocketPlanner.v1` (`state/storage.js`).
- `ui/saved.js` `renderSaved()`: the Saved designs table, with Compare check box, Load, Rename, Delete and Save to a file.
- `ui/settingsdlg.js` already builds Windows 98 property-sheet tabs (`menu[role=tablist]`, CSS in `styles/win98.css` around line 431). Reuse that look.
- `ui/main.js` wires everything; `ui/vm.js` builds the view model every drawing reads.

**Suggested design** (decide the details and log them in `DECISIONS.md` as Luke's request):
- **Tab strip:** a row of property-sheet tabs under the toolbar, above both panes. The first tab is "Current", the working design as today. Then there is one tab per saved design, named after it ("Design A", "Design B" ...).
- **Switching tabs:** clicking a tab swaps the whole workspace to that design, with nothing read-only. Edits in a saved design's tab save straight back into that saved entry, so the tab is the saved state, live.
- **Per-tab state:** each tab keeps its own undo/redo, edit session and badge baseline, so switching never mixes histories or badges.
  - Locks: keep them global, matching the brief's "a lock holds a box, not a value". The alternative is per tab; pick one and log it.
  - Switching a tab is not an edit: no badges and no undo step.
- **Save design:** adds a new tab with a copy of the current tab's design and switches to it. Alternatively it stays on the current tab; pick one and log it.
- **Saved designs table:** Load becomes "Open tab". Rename, Delete, Compare and Save to a file keep working. Deleting a design closes its tab. Optionally add a small close button on each tab that only closes the tab (the design stays in the list and can be reopened). Each close button needs a 44 px touch target.
- **Comparing:**
  - Compare check boxes, side-by-side panels, the compare table, ghosts and "Badges compare to a saved design" keep working.
  - "Now" means the active tab's design.
  - A design compared with itself should be skipped or marked.
- **Storage:** add the open tab ids and the active tab id to the persisted data. Old saved designs must still load (`CLAUDE.md`: saved designs carry over to newer files). If the stored format changes, bump the key and add the old one to `OLDER_KEYS`.
- **Layout:**
  - Tabs wrap or scroll inside the strip, with no sideways page scroll at 390 px.
  - Text is 13 px or more and tap targets 44 px (`tools/audit.js` checks both).
  - Keyboard: arrow keys move between tabs (the usual tablist pattern).
  - The active tab looks raised and joined to the panel, like the Settings dialog.
- **Brief conflict:** `CLAUDE.md` says loading a saved design replaces the whole design and counts as an edit for badges. Tabs change that. Log it in `DECISIONS.md` as Luke's request.
- **Tests:** add to `test/session.test.js` and `test/ui.test.mjs`. Cover these:
  - Opening a tab shows that design's numbers.
  - An edit in tab B changes saved B and leaves Current alone.
  - Undo stays within its tab.
  - Switching tabs makes no badges.
  - Tabs survive a reload.
  - Deleting a design closes its tab.
  - No sideways scroll at 390 px.

## Current Status
- All eight phases in `CLAUDE.md`'s Build order are built.
- Luke's six follow-up changes are done, committed and pushed to `origin/main` at `06f77f6`:
  1. Softer drawing highlight.
  2. Toolbar text captions.
  3. Spinning sprocket in the Wheel turns "?".
  4. Distance animation in the Sheet slides "?".
  5. Hover no longer scrolls the input list.
  6. Its own Sheet thickness "?" animation.
- `node --test` passes 118 of 118.
- The tabs feature above is next.
- Still open: Danielle's hand checks in `CHECKLIST.md` (real OpenSCAD, slicer and CNC imports, an offline school laptop, and a student usability session).

## Git State
- Branch `main`, pushed to `origin/main` (GitHub, `LucasLubinski/sprocket-planner`) at `06f77f6` on 2026-11-22.
- Last commit: `06f77f6 Sheet thickness "?": its own animation`.
- History was rewritten on 2026-11-22 to drop the "Co-Authored-By: Claude" lines; no commit on `main` has one. The pre-rewrite backup is still at `refs/original/refs/heads/main` locally (local only). Luke can delete it with `git update-ref -d refs/original/refs/heads/main`.
- Don't add attribution lines to commits or PRs.

## Completed
- **Phase 1, core math** (`core/`): geometry, taper angle and hub settings. Tests reproduce the brief's tables to ±0.002 mm.
- **Phase 2:** the Windows 98 window, linked inputs, the dimension model (`draw/svg.js`), every drawing, two-way highlighting, and the measurements table.
- **Phase 3:** badges, ghost overlay, saved designs, side-by-side panels, the compare table, and the settings dialog.
- **Phase 4:** turn dial, slide ruler, fit meters with stacked markers, Try-these examples, How it works, and the "?" explainers.
- **Phase 5:**
  - `core/scad.js` and `core/scad-template.js`: Copy OpenSCAD file and Copy settings only.
  - `ui/export.js`: the copy fallback dialog, SVG and DXF downloads, STL help and How to use.
  - `draw/track.js`: the track box drawing.
- **Phase 6:**
  - `tools/audit.js` checks for text under 13 px and touch targets under 44 px.
  - `tools/overlap.js` checks that labels never cover pins, holes or each other.
- **Phase 7, locks** (`state/link.js`, `state/store.js`, `ui/inputs.js`):
  - Lock routing, held marks, notes, the refusal message and the "Let me choose" chooser.
  - The "Keep the tip round" and "Straight past the sheet" options.
- **Phase 7, handles** (`ui/handles.js`): drag handles, arrow-key nudges, and type-in-place.
- **Phase 8:**
  - Tests for accessibility, blocked storage, the CSP and speed.
  - Docs: `README.md`, `CHECKLIST.md`, `DECISIONS.md`.
- **Follow-ups on 2026-11-22**, in commit order:
  - `b31c89d` `styles/win98.css`:
    - The highlight glow is one faint `drop-shadow(0 0 1px var(--hl-soft))`.
    - Highlighted sheet, drum and pin outlines are 1.5 px.
  - `84b81f5` `ui/toolbar.js`, `ui/main.js`, CSS:
    - Each toolbar button has a `caption` shown in `span.tb-cap`.
    - `set()` takes `caption`, so Play/Pause updates it.
    - The Copy OpenSCAD button's full name is now "Copy file for OpenSCAD (...)", so it contains its caption.
  - `f4f4ef0` `ui/explain.js` `turn`: a spinning 16-pin sprocket with a pie, an outer arrow and the degree label.
  - `823797e` `ui/explain.js` `slide`:
    - A small wheel pushes a long strip.
    - A fixed start mark and an end mark on a magenta hole.
    - A dimension line counting up to 6 in.
  - `8b1d907`, for item 5:
    - `ui/highlight.js`: hover calls `pointFromDrawing(el, false)`; a click still scrolls.
    - `test/ui.test.mjs`: a new test.
    - `DECISIONS.md`: a new row.
  - `06f77f6` `ui/explain.js`: a new `thickness` animation, with `state/fields.js` `sheetT` pointing at it.

## In Progress
Nothing.

## Running Processes
None. The UI tests start and stop their own headless Chrome through `tools/cdp.mjs`.

## Background Work
None.

## Key Decisions
- `DECISIONS.md` has the full log, with the five most worth Danielle's review at the top:
  1. Hub minimum radius is 15.56 mm.
  2. The Straight button holds the slant.
  3. The zones for pins in the sheet at once.
  4. The CNC sheet's hole count and length.
  5. What "held" means.
- Hover over a drawing highlights but doesn't scroll (Luke's change to the brief).
- Each keystroke in one edit routes from where the edit began (`before` in `store.setField`), so typing 6 then 60 doesn't compound.
- The lock refusal text matches the brief exactly: "Can't change Wheel size. Sheet slides and Wheel turns are both locked. Together they fix the wheel size. Unlock one."
- 40 pins: the squeeze room is NaN and the page shows "Holes run together", never a 1e9 value.
- SVG badge text uses `font-size: 0.93em`, not px, because px values become drawing units.
- The README must not mention where Node.js is installed.
- Don't edit `reference/core.js` or `reference/polycarb_sprocket.scad`.
- Follow "Decisions already made" in `CLAUDE.md`.
- Ask Luke before any push.

## Files Touched
Files for the tabs feature: `state/store.js`, `state/storage.js`, `state/session.js`, `ui/main.js`, `ui/saved.js`, `ui/views.js`, `ui/vm.js`, `styles/win98.css`, `index.html`, `test/session.test.js`, `test/ui.test.mjs`, `DECISIONS.md`, `README.md`.

## Dead Ends
- Don't hover-test the pitch circle at arbitrary angles, because pins sit on it. Use the point halfway between two pins, as the hover tests do.
- Opacity checks right after focus see values mid-transition. Wait about 300 ms first.
- Headless Chrome here matches `(any-pointer: coarse)`, so screenshots show the 44 px touch layout.
- The page's CSP (`connect-src 'none'`) blocks `fetch`, even for `blob:` URLs. In tests, read download Blobs through a `URL.createObjectURL` stub.
- Long Python here-docs or escaped JS inside one Bash call can fail to parse or add literal newlines. Write the script to the scratchpad first, then run it.
- Windows sometimes locks `dist/planner.html` for a moment. `tools/build.mjs` retries the write.
- CSS `display:` rules override the `hidden` attribute. Add `[hidden]{display:none}` overrides, as `.heldmark` and `.f-route` already have.
- `paintRoute` used to overwrite `className`. Keep `row.baseCls`.
- The built-in browser pane can't screenshot `file://` pages. To check an explainer animation, require `ui/explain.js`'s `ANIMS` in Node and write frames to an HTML file. Then screenshot it with headless Chrome (`chrome --headless=new --screenshot=...`). Or click its `.qmark[data-explain=KEY]` through `tools/shoot.mjs --eval`.

## Open Questions / Blockers
- The tabs feature's details (Save design behavior, per-tab vs global locks, tab close buttons) aren't settled. Pick reasonable answers and log them in `DECISIONS.md`.
- Danielle has to run `CHECKLIST.md` herself.

## Next Steps
1. Build saved designs as tabs (section at the top). Commit it, and ask Luke before pushing.
2. Once Danielle reports back on `CHECKLIST.md`, fix whatever it turns up. Then run `node --test` and `node tools/build.mjs`, and commit.

## Useful Commands
```
node tools/build.mjs                       # bundles into dist/planner.html and docs/index.html
node --test                                # 118 tests; UI tests skip without Chrome
node tools/shoot.mjs <outDir> <name> 1366 768 [--full] [--eval "js"]   # headless screenshot
git log --oneline origin/main..main        # commits not yet pushed
```
