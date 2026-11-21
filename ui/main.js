"use strict";
// Wires everything together: state -> analyze() -> view model -> every
// drawing, table and meter. Nothing here computes geometry.
const { h, $, $$, download } = require("./dom.js");
const { createStore } = require("../state/store.js");
const { createStorage, getLocalStorage, designFile, readDesignFile, safeFileName } = require("../state/storage.js");
const { effectiveSpeed } = require("../state/settings.js");
const { EXAMPLES } = require("../state/examples.js");
const { FIELD } = require("../state/fields.js");
const { buildVM } = require("./vm.js");
const { createDrawing } = require("./drawings.js");
const { createHighlighter } = require("./highlight.js");
const { createInputs } = require("./inputs.js");
const { createMenubar } = require("./menubar.js");
const { createToolbar, createTooltip } = require("./toolbar.js");
const { buildViews } = require("./views.js");
const { renderMeasure, renderCompare } = require("./tables.js");
const { renderSummary, statusText, LEVEL_ICON } = require("./summary.js");
const D = require("./dialogs.js");
const { svgIcon, dataUri } = require("./icons.js");
const F = require("../core/format.js");
const { renderSaved } = require("./saved.js");
const { openSettings } = require("./settingsdlg.js");
const { renderPanels } = require("../draw/panels.js");
const { renderMeters } = require("./meters.js");
const { openExplainer, whatsThis } = require("./explain.js");
const how = require("../draw/howitworks.js");
const { createExport } = require("./export.js");

const MODS = {
  dial: require("../draw/dial.js"),
  ruler: require("../draw/ruler.js"),
  layout: require("../draw/layout.js"),
  closeup: require("../draw/closeup.js"),
  pinhole: require("../draw/pinhole.js"),
  chart: require("../draw/chart.js"),
  hubface: require("../draw/hubface.js"),
  sheet: require("../draw/sheet.js"),
  track: require("../draw/track.js")
};
const LABELS = {
  dial: vm => "Turn dial: the wheel turns " + vm.design.rotation + " degrees",
  ruler: vm => "Slide ruler: the sheet slides " + (vm.design.travel / 25.4).toFixed(2) + " inches, holes " + vm.num("P") + " mm apart",
  layout: "Side view of the wheel and the sheet, to scale",
  closeup: "Close-up of the pins in the sheet holes",
  pinhole: "One pin standing in its hole, with its sizes",
  hubface: "Hub side of the sprocket with the goBILDA hub outline",
  sheet: "Sheet pattern for cutting, and the drill guide",
  track: "End view of the sheet in its track, with the servo shaft below"
};

function start() {
  const ls = getLocalStorage(window);
  const storage = createStorage(ls);
  const store = createStore({ storage });
  const reduced = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  const app = { store, theta: 0, playing: false, vm: null, drawings: {}, status: "Ready" };
  window.SprocketPlanner = app; // for tests and curious adults

  // ---------- frame ----------
  const layer = $("#layer");
  D.setLayer(layer);
  const tooltip = createTooltip(layer);
  buildViews($("#pane-views"));
  const status = {
    msg: h("p.status-bar-field.st-msg", { "aria-live": "polite" }, "Ready"),
    turn: h("p.status-bar-field.st-turn"),
    warn: h("p.status-bar-field.st-warn")
  };
  $("#statusbar").append(status.msg, status.turn, status.warn);
  const icon = $("link[rel=icon]");
  if (icon) icon.href = dataUri("app");
  $(".app-icon").innerHTML = svgIcon("app", 16);

  function setStatus(text) {
    app.status = text;
    status.msg.textContent = text;
    clearTimeout(setStatus.t);
    setStatus.t = setTimeout(() => { status.msg.textContent = "Ready"; app.status = "Ready"; }, 6000);
  }

  // ---------- highlighting and inputs ----------
  let inputs = null;
  const highlighter = createHighlighter({
    root: $("#app"), inputsPane: $("#pane-inputs"),
    getSettings: () => store.settings,
    isVisibleField: k => inputs ? inputs.isVisible(k) : true
  });
  inputs = createInputs($("#pane-inputs"), {
    store, getVM: () => app.vm, highlighter,
    onExplain: (key, btn) => commands.explain(key, btn),
    onStatus: setStatus,
    examples: EXAMPLES, onExample: id => commands.example(id)
  });
  const motionOk = () => effectiveSpeed(store.settings, reduced.matches) !== "off";
  how.mount($("#how-anim"), $("#how-play"), { motionOk });
  const wt = whatsThis($("#app"), {
    onPick: key => commands.explain(key),
    onChange: on => { $("#tb-help").setAttribute("aria-pressed", String(on)); app.whatsThis = on; if (on) setStatus("What's this? Click any part of the window. Esc cancels."); }
  });
  $("#tb-help").addEventListener("click", () => wt.toggle());

  // ---------- export box (holds the track drawing, so it comes first) ----------
  const exporter = createExport($("#export"), { store, getVM: () => app.vm, setStatus });
  app.exporter = exporter;

  // ---------- drawings ----------
  for (const [id, mod] of Object.entries(MODS)) app.drawings[id] = createDrawing($("#d-" + id), mod, LABELS[id] || "");
  app.vmHooks = { onAnimated: el => highlighter.refresh(el) };

  // ---------- render ----------
  let queued = false;
  function schedule() { if (!queued) { queued = true; queueMicrotask(() => { queued = false; render(); }); } }
  function makeVM() {
    const vm = buildVM(store, app.theta);
    Object.assign(vm, app.vmHooks);
    return vm;
  }
  function render() {
    const t0 = performance.now();
    const s = store.settings;
    document.body.classList.toggle("detail-student", s.detail === "student");
    document.body.classList.toggle("detail-expert", s.detail === "expert");
    document.body.dataset.labels = s.dimLabels;
    document.body.dataset.scheme = s.scheme;
    document.body.dataset.ghost = s.ghostStrength;
    const rot = store.design.rotation;
    if (!(app.theta <= rot)) app.theta = isFinite(rot) && rot > 0 ? Math.min(app.theta, rot) : 0;
    const vm = app.vm = makeVM();
    inputs.paint(vm);
    renderSummary({ summary: $("#summary"), facts: $("#facts"), chips: $("#chips"), warnings: $("#warnings") }, vm);
    renderMeters($("#meters"), vm);
    exporter.render(vm);
    for (const d of Object.values(app.drawings)) d.render(vm);
    renderMeasure($("#measure"), vm, key => inputs.focusField(key));
    renderSaved($("#saved-list"), { store, actions: savedActions });
    renderCompareArea(vm);
    paintPlaybar();
    paintStatus(vm);
    paintChrome();
    if (app.afterRender) for (const fn of app.afterRender) fn(vm);
    highlighter.apply();
    app.lastRenderMs = performance.now() - t0;
  }
  app.renderNow = render;
  app.afterRender = [];

  function paintStatus(vm) {
    const st = statusText(vm);
    status.turn.textContent = st.turn;
    status.warn.innerHTML = svgIcon(LEVEL_ICON[st.level], 16) + " ";
    status.warn.appendChild(document.createTextNode(st.warnings));
    status.warn.className = "status-bar-field st-warn " + st.level;
  }

  // ---------- turning the wheel ----------
  const slider = $("#slider"), readout = $("#readout"), playBtn = $("#play");
  function paintPlaybar() {
    const rot = store.design.rotation;
    slider.max = String(isFinite(rot) && rot > 0 ? rot : 360);
    slider.value = String(app.theta);
    const m = app.vm.model;
    const slide = m.ok ? m.d.Rp * app.theta * Math.PI / 180 : 0;
    readout.textContent = "Turned " + F.trim(app.theta, 1) + "° · moved " + app.vm.fmtIn(slide) + " (" + app.vm.fmtLen(slide) + ")";
    playBtn.textContent = app.playing ? "❚❚ Pause" : "▶ Play";
    playBtn.setAttribute("aria-pressed", String(app.playing));
  }
  function turnTo(theta) {
    app.theta = theta;
    if (!app.vm) return;
    app.vm.theta = theta;
    for (const d of Object.values(app.drawings)) d.animate(app.vm, theta);
    if (app.onTurn) for (const fn of app.onTurn) fn(theta);
    paintPlaybar();
  }
  app.onTurn = [];
  app.turnTo = turnTo;
  slider.addEventListener("input", () => { stop(); turnTo(parseFloat(slider.value) || 0); });
  playBtn.addEventListener("click", () => app.playing ? stop() : play());

  const SPEED = { slow: 0.5, normal: 1, fast: 2 };
  let raf = 0, last = 0;
  function play() {
    const rot = store.design.rotation;
    if (!(rot > 0)) return;
    const speed = effectiveSpeed(store.settings, reduced.matches);
    if (app.theta >= rot - 1e-6) turnTo(0);
    if (speed === "off") { turnTo(rot); setStatus("Animation is off, so the wheel jumped to the end."); return; }
    app.playing = true;
    const dur = Math.min(12, Math.max(2.5, rot / 90)) / SPEED[speed];
    const rate = rot / dur;
    last = performance.now();
    const step = now => {
      if (!app.playing) return;
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const next = Math.min(rot, app.theta + rate * dt);
      turnTo(next);
      if (next >= rot) { stop(); return; }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    paintPlaybar(); paintChrome();
  }
  function stop() { if (!app.playing) return; app.playing = false; cancelAnimationFrame(raf); paintPlaybar(); paintChrome(); }
  app.play = play; app.stop = stop;

  // ---------- saved designs and comparing ----------
  const storageNote = $("#storage-note");
  function paintStorageNote() {
    storageNote.hidden = store.storageOk;
    storageNote.textContent = "This browser is blocking storage, so designs won't be remembered after you close this page. Use Save to a file to keep them.";
  }
  const savedActions = {
    compare(id, on, cb) {
      if (!store.setCompare(id, on)) { cb.checked = false; setStatus("You can compare up to 4 designs at once."); return; }
      const n = store.compared().length;
      setStatus(n >= 2 ? "Comparing " + n + " designs. See the Compare box." : n === 1 ? "Check one more design to compare side by side." : "No designs checked.");
    },
    load(id) { const s = store.getSaved(id); stop(); store.loadSaved(id); setStatus("Loaded " + s.name + ". Badges show what changed."); },
    rename(id) { const s = store.getSaved(id); D.promptBox("Rename design", "New name:", s.name, name => { store.renameSaved(id, name); setStatus("Renamed to " + name + "."); }); },
    remove(id) {
      const s = store.getSaved(id);
      D.openDialog({
        title: "Delete design", icon: svgIcon("warn", 16),
        body: h("div.msgbox", h("p", "Delete " + s.name + "? This can't be undone.")),
        buttons: [{ label: "Delete", value: "del" }, { label: "Cancel", value: "cancel", primary: true }],
        onButton: v => { if (v === "del") { store.deleteSaved(id); setStatus("Deleted " + s.name + "."); } }
      });
    },
    saveFile(id) { const s = store.getSaved(id); download(safeFileName(s.name) + ".sprocket.json", designFile(s.name, s.design), "application/json"); setStatus("Saved " + s.name + " to a file."); }
  };

  const cmpState = { frac: 0, playing: false, raf: 0, panels: null, key: "" };
  function renderCompareArea(vm) {
    const ctl = $("#cmp-controls"), box = $("#panels");
    const picked = store.compared();
    const s = store.settings;
    const want = s.sideBySide && picked.length >= 2;
    ctl.innerHTML = "";
    const radio = (name, val, text, cur, fn) => {
      const id = "cmp-" + name + "-" + val;
      const inp = h("input", { type: "radio", name: "cmp-" + name, id, checked: cur === val });
      inp.addEventListener("change", () => fn(val));
      return h("span.field-row", inp, h("label", { for: id }, text));
    };
    const ghostCb = h("input", { type: "checkbox", id: "cmp-ghost", checked: s.ghost });
    ghostCb.addEventListener("change", () => store.setSettings({ ghost: ghostCb.checked }));
    ctl.append(
      h("div.cmp-row", h("span.cmp-lbl", "Animate together by:"),
        radio("by", "turn", "same turn", s.animateBy, v => store.setSettings({ animateBy: v })),
        radio("by", "slide", "same slide", s.animateBy, v => store.setSettings({ animateBy: v }))),
      h("div.cmp-row", h("span.field-row", ghostCb, h("label", { for: "cmp-ghost" }, "Ghost overlay on the drawings")), h("span.cmp-lbl", "Line up by:"),
        radio("lu", "shafts", "shafts", s.lineUp, v => store.setSettings({ lineUp: v })),
        radio("lu", "sheets", "sheets", s.lineUp, v => store.setSettings({ lineUp: v }))));
    if (!want) {
      cmpState.panels = null; cmpState.key = "";
      box.innerHTML = "";
      box.appendChild(h("p.hint", picked.length >= 2 ? "Side by side panels are off in Settings. The table below still compares them."
        : "Check two to four Compare boxes in Saved designs to see them side by side, at the same scale."));
    } else {
      const entries = picked.map(sv => ({ name: sv.name, sub: "", m: vm.analyze(sv.design) }));
      const key = JSON.stringify([picked.map(p => p.id + JSON.stringify(p.design)), s.direction, s.decimals, box.clientWidth]);
      if (key !== cmpState.key) {
        box.innerHTML = "";
        const bar = h("div.playbar.cmp-bar",
          h("button.play-btn", { type: "button", id: "cmp-play", "aria-pressed": "false" }, "▶ Play"),
          h("label.sr-only", { for: "cmp-slider" }, "Compare position"),
          h("input", { type: "range", id: "cmp-slider", min: "0", max: "1000", step: "1", value: String(Math.round(cmpState.frac * 1000)) }),
          h("output.readout", { id: "cmp-readout" }));
        const grid = h("div.panel-grid");
        box.append(grid, bar);
        cmpState.panels = renderPanels(grid, vm, entries);
        cmpState.key = key;
        $("#cmp-slider").addEventListener("input", e => { cmpStop(); cmpTurn(+e.target.value / 1000); });
        $("#cmp-play").addEventListener("click", () => cmpState.playing ? cmpStop() : cmpPlay());
      }
      cmpTurn(cmpState.frac);
    }
    renderCompare($("#compare-table"), vm, store.saved);
  }
  function cmpTurn(f) {
    cmpState.frac = f;
    if (!cmpState.panels) return;
    cmpState.panels.animate(f, store.settings.animateBy);
    const sl = $("#cmp-slider"); if (sl) sl.value = String(Math.round(f * 1000));
    const ro = $("#cmp-readout");
    if (ro) ro.textContent = store.settings.animateBy === "slide" ? "Same slide for every design" : "Same turn for every design";
    const pb = $("#cmp-play"); if (pb) { pb.textContent = cmpState.playing ? "❚❚ Pause" : "▶ Play"; pb.setAttribute("aria-pressed", String(cmpState.playing)); }
  }
  function cmpPlay() {
    const speed = effectiveSpeed(store.settings, reduced.matches);
    if (cmpState.frac >= 1) cmpState.frac = 0;
    if (speed === "off") { cmpTurn(1); return; }
    cmpState.playing = true;
    const dur = 5 / SPEED[speed];
    let last = performance.now();
    const step = now => {
      if (!cmpState.playing) return;
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const f = Math.min(1, cmpState.frac + dt / dur);
      cmpTurn(f);
      if (f >= 1) { cmpStop(); return; }
      cmpState.raf = requestAnimationFrame(step);
    };
    cmpState.raf = requestAnimationFrame(step);
    cmpTurn(cmpState.frac);
  }
  function cmpStop() { cmpState.playing = false; cancelAnimationFrame(cmpState.raf); cmpTurn(cmpState.frac); }
  app.compare = { turn: cmpTurn, state: cmpState };

  $("#btn-save").addEventListener("click", () => run("saveDesign"));
  $("#btn-savefile").addEventListener("click", () => run("saveFile"));
  $("#btn-openfile").addEventListener("click", () => run("openFile"));
  $("#file-in").addEventListener("change", e => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const rd = new FileReader();
    rd.onload = () => {
      const r = readDesignFile(String(rd.result));
      if (!r.ok) { D.messageBox("Open a design file", [r.error, "Pick a .sprocket.json file saved from Sprocket Planner."], svgIcon("stopSign", 16)); return; }
      const entry = store.addSaved(r.name, r.design);
      stop();
      store.loadSaved(entry.id);
      setStatus("Opened " + entry.name + " and added it to Saved designs.");
    };
    rd.onerror = () => D.messageBox("Open a design file", ["That file couldn't be read."]);
    rd.readAsText(file);
  });

  // ---------- resize ----------
  if (window.ResizeObserver) {
    let pending = false;
    const ro = new ResizeObserver(() => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        if (!app.vm) return;
        let any = false;
        for (const d of Object.values(app.drawings)) if (d.widthChanged()) { d.render(app.vm); any = true; }
        if (cmpState.panels) renderCompareArea(app.vm);
        if (app.onResize) for (const fn of app.onResize) fn(app.vm);
        if (any) highlighter.apply();
      });
    });
    for (const d of Object.values(app.drawings)) ro.observe(d.container);
    ro.observe($("#panels"));
    app.resizeObserver = ro;
  }
  app.onResize = [];

  // ---------- commands ----------
  const commands = {
    resetDesign() { store.resetDesign(); setStatus("Design reset to Our design."); },
    undo() { if (store.undo()) setStatus("Undone."); },
    redo() { if (store.redo()) setStatus("Redone."); },
    clearBadges() { store.clearBadges(); setStatus("Change badges cleared."); },
    toggleGhost() { store.setSettings({ ghost: !store.settings.ghost }); setStatus(store.settings.ghost ? "Ghost overlay on." : "Ghost overlay off."); },
    toggleGrid() { store.setSettings({ grid: !store.settings.grid }); },
    detail(level) { store.setSettings({ detail: level }); },
    labels(v) { store.setSettings({ dimLabels: v }); },
    lineUp(v) { store.setSettings({ lineUp: v }); },
    animateBy(v) { store.setSettings({ animateBy: v }); },
    part(v) { store.setSettings({ part: v }); },
    example(id) {
      const ex = EXAMPLES.find(e => e.id === id);
      if (!ex) return;
      stop();
      store.setDesign(ex.design(), "example:" + id);
      setStatus(ex.name + ": " + ex.look);
    },
    shape(v) { store.beginEdit("shape"); store.setField("shape", v); },
    play() { app.playing ? stop() : play(); },
    resetSettings() { store.resetSettings(); setStatus("Settings reset."); },
    settings() { stop(); openSettings({ store, onApplied: () => setStatus("Settings saved.") }); },
    saveDesign() {
      D.promptBox("Save design", "Name for this design:", store.nextName(), name => {
        const e = store.saveDesign(name);
        setStatus("Saved " + e.name + ". Check its Compare box to compare it.");
      });
    },
    saveFile() {
      const match = store.saved.find(s => JSON.stringify(s.design) === JSON.stringify(store.design));
      D.promptBox("Save design to a file", "File name (it ends in .sprocket.json):", match ? match.name : "My design", name => {
        download(safeFileName(name) + ".sprocket.json", designFile(name, store.design), "application/json");
        setStatus("Saved " + safeFileName(name) + ".sprocket.json. Look in your Downloads folder.");
      });
    },
    openFile() { $("#file-in").click(); },
    gotoCompare() {
      const sec = $("#sec-saved");
      sec.scrollIntoView({ block: "start", behavior: reduced.matches ? "auto" : "smooth" });
      const first = sec.querySelector("input[type=checkbox], button");
      if (first) first.focus({ preventScroll: true });
    },
    clearCompare() { store.clearCompare(); setStatus("Compare checks cleared."); },
    explain(key) { stop(); openExplainer(key, { motionOk }); },
    copyScad() { return exporter.copyScad(); },
    copySettings() { return exporter.copySettings(); },
    saveSVG() { return exporter.saveSVG(); },
    saveDXF() { return exporter.saveDXF(); },
    stlHelp() { stop(); exporter.stlHelp(); },
    howToUse() { stop(); exporter.howToUse(); },
    whatsThis() { wt.toggle(); },
    gotoHow() {
      const sec = $("#sec-how");
      sec.scrollIntoView({ block: "start", behavior: reduced.matches ? "auto" : "smooth" });
      $("#how-play").focus({ preventScroll: true });
    },
    about() {
      D.messageBox("About Sprocket Planner", [
        "Sprocket Planner designs a 3D-printed pin sprocket and the drilled sheet it drives.",
        "Everything runs inside this one file. It needs no internet.",
        "Look and controls use 98.css 0.1.21 by Jordan Scales (MIT license).",
        "Pixel font: “MS Sans Serif” FontStruction by “lou” (CC BY-SA 3.0).",
        "Icons and drawings were made for this app."
      ]);
    }
  };
  app.commands = commands;
  function run(cmd, arg) { if (commands[cmd]) return commands[cmd](arg); setStatus("Not available yet."); return undefined; }
  app.run = run;

  // ---------- menus and toolbar ----------
  const S = () => store.settings;
  const menus = [
    { id: "file", label: "&File", items: [
      { label: "&New design", cmd: "resetDesign" },
      { label: "&Save design…", cmd: "saveDesign", accel: "Ctrl+S" },
      { label: "Save design to a fi&le…", cmd: "saveFile" },
      { label: "&Open a design file…", cmd: "openFile" },
      "-",
      { label: "Reset se&ttings", cmd: "resetSettings" }
    ] },
    { id: "edit", label: "Edi&t", items: [
      { label: "&Undo", cmd: "undo", accel: "Ctrl+Z", enabled: () => store.canUndo },
      { label: "&Redo", cmd: "redo", accel: "Ctrl+Y", enabled: () => store.canRedo },
      "-",
      { label: "&Clear change badges", cmd: "clearBadges" },
      { label: "Reset &design", cmd: "resetDesign" }
    ] },
    { id: "view", label: "&View", items: [
      { label: "&Ghost overlay", cmd: "toggleGhost", checked: () => S().ghost },
      { label: "Measuring g&rid", cmd: "toggleGrid", checked: () => S().grid },
      "-",
      { label: "&Student detail", cmd: "detail", arg: "student", radio: true, checked: () => S().detail === "student" },
      { label: "&Expert detail", cmd: "detail", arg: "expert", radio: true, checked: () => S().detail === "expert" },
      "-",
      { label: "&All dimension labels", cmd: "labels", arg: "all", radio: true, checked: () => S().dimLabels === "all" },
      { label: "&Key labels only", cmd: "labels", arg: "key", radio: true, checked: () => S().dimLabels === "key" },
      { label: "&No labels", cmd: "labels", arg: "none", radio: true, checked: () => S().dimLabels === "none" },
      "-",
      { label: "Se&ttings…", cmd: "settings" }
    ] },
    { id: "design", label: "&Design", items: [
      { heading: "Try these" },
      ...EXAMPLES.map((e, i) => ({ label: "&" + (i + 1) + " " + e.name, cmd: "example", arg: e.id })),
      "-",
      { label: "&Tapered pins", cmd: "shape", arg: "tapered", radio: true, checked: () => store.design.shape === "tapered" },
      { label: "Straight through the s&heet", cmd: "shape", arg: "straight", radio: true, checked: () => store.design.shape === "straight" },
      "-",
      { label: "&Play / Pause", cmd: "play", accel: "Space" }
    ] },
    { id: "compare", label: "&Compare", items: [
      { label: "&Save design for comparing…", cmd: "saveDesign" },
      { label: "Go to &saved designs", cmd: "gotoCompare" },
      { label: "&Clear Compare checks", cmd: "clearCompare" },
      "-",
      { label: "Line up by s&hafts", cmd: "lineUp", arg: "shafts", radio: true, checked: () => S().lineUp === "shafts" },
      { label: "Line up by sh&eets", cmd: "lineUp", arg: "sheets", radio: true, checked: () => S().lineUp === "sheets" },
      "-",
      { label: "Animate by same &turn", cmd: "animateBy", arg: "turn", radio: true, checked: () => S().animateBy === "turn" },
      { label: "Animate by same s&lide", cmd: "animateBy", arg: "slide", radio: true, checked: () => S().animateBy === "slide" }
    ] },
    { id: "export", label: "&Export", items: [
      { label: "Part: &Sprocket", cmd: "part", arg: "sprocket", radio: true, checked: () => S().part === "sprocket" },
      { label: "Part: &Drill guide", cmd: "part", arg: "drill_guide", radio: true, checked: () => S().part === "drill_guide" },
      "-",
      { label: "Copy &OpenSCAD file", cmd: "copyScad" },
      { label: "Copy settings &only", cmd: "copySettings" },
      "-",
      { label: "Save sheet S&VG", cmd: "saveSVG" },
      { label: "Save sheet D&XF", cmd: "saveDXF" },
      "-",
      { label: "&How to make the STL…", cmd: "stlHelp" }
    ] },
    { id: "help", label: "&Help", items: [
      { label: "&How to use…", cmd: "howToUse", accel: "F1" },
      { label: "How it &works", cmd: "gotoHow" },
      { label: "&What's this? mode", cmd: "whatsThis", checked: () => !!app.whatsThis },
      "-",
      { label: "&About Sprocket Planner", cmd: "about" }
    ] }
  ];
  app.menubar = createMenubar($("#menubar"), { menus, run, state: () => ({}) });
  app.toolbar = createToolbar($("#toolbar"), {
    tooltip, run,
    buttons: [
      { cmd: "saveDesign", icon: "save", label: "Save design" },
      { cmd: "gotoCompare", icon: "compare", label: "Compare saved designs" },
      "|",
      { cmd: "play", icon: "play", label: "Play", toggle: true },
      "|",
      { cmd: "copyScad", icon: "scad", label: "Copy OpenSCAD file" },
      { cmd: "copySettings", icon: "settingsCopy", label: "Copy settings only" },
      { cmd: "saveSVG", icon: "svg", label: "Save sheet SVG" },
      { cmd: "saveDXF", icon: "dxf", label: "Save sheet DXF" },
      "|",
      { cmd: "undo", icon: "undo", label: "Undo" },
      { cmd: "redo", icon: "redo", label: "Redo" },
      "|",
      { cmd: "toggleGhost", icon: "ghost", label: "Ghost overlay", toggle: true },
      { cmd: "settings", icon: "gear", label: "Settings" }
    ]
  });
  function paintChrome() {
    const tb = app.toolbar;
    tb.set("play", { pressed: app.playing, icon: app.playing ? "stop" : "play", label: app.playing ? "Pause" : "Play" });
    tb.set("toggleGhost", { pressed: store.settings.ghost });
    tb.set("undo", { disabled: !store.canUndo });
    tb.set("redo", { disabled: !store.canRedo });
    tb.set("copyScad", { label: "Copy OpenSCAD file (" + (store.settings.part === "sprocket" ? "sprocket" : "drill guide") + ")" });
  }

  // keyboard shortcuts
  document.addEventListener("keydown", e => {
    const inField = e.target.closest && e.target.closest("input, textarea, select");
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === "z" && !inField) { e.preventDefault(); e.shiftKey ? commands.redo() : commands.undo(); }
      else if (k === "y" && !inField) { e.preventDefault(); commands.redo(); }
      else if (k === "s") { e.preventDefault(); run("saveDesign"); }
    } else if (e.key === "F1") { e.preventDefault(); run("howToUse"); }
    else if (e.key === " " && !inField && !e.target.closest("button, [role=slider], a")) { e.preventDefault(); commands.play(); }
  });

  // ---------- go ----------
  store.subscribe(kind => {
    if (kind === "design" && app.playing) { /* keep playing with the new design */ }
    schedule();
  });
  if (reduced.addEventListener) reduced.addEventListener("change", schedule);
  paintStorageNote();
  if (!store.storageOk) setStatus("This browser blocks storage. Designs won't be remembered after you close the page.");
  render();
  return app;
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
}

module.exports = { start };
