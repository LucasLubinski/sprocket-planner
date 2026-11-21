"use strict";
// Settings dialog (View > Settings): property-sheet tabs, OK / Cancel / Apply,
// and its own Reset settings button.
const { h } = require("./dom.js");
const { openDialog } = require("./dialogs.js");
const { DEFAULT_SETTINGS } = require("../state/settings.js");

const TABS = [
  { id: "cmp", title: "Compare", rows: [
    { key: "compareWith", label: "Compare with", type: "radio", opts: [["both", "Last change and picked saved designs"], ["last", "Last change"], ["saved", "Picked saved designs"]] },
    { key: "view", label: "Comparison view", type: "view" },
    { key: "lineUp", label: "Line up the overlay by", type: "radio", opts: [["shafts", "Shafts (shows the size difference)"], ["sheets", "Sheets (shows how pins meet holes)"]] },
    { key: "animateBy", label: "Animate together by", type: "radio", opts: [["turn", "Same turn (see how far each slides)"], ["slide", "Same slide (see how far each must turn)"]] },
    { key: "ghostStrength", label: "Ghost strength", type: "radio", opts: [["faint", "Faint"], ["medium", "Medium"], ["strong", "Strong"]] }
  ] },
  { id: "bdg", title: "Badges", rows: [
    { key: "badges", label: "Change badges", type: "radio", opts: [[true, "On"], [false, "Off"]] },
    { key: "badgeBase", label: "Badges compare to", type: "base" },
    { key: "badgeColors", label: "Badge colors", type: "radio", opts: [["updown", "Up green, down red"], ["betterworse", "Better green, worse red"]] }
  ] },
  { id: "disp", title: "Display", rows: [
    { key: "units", label: "Units for the slide", type: "radio", opts: [["in", "Inches"], ["mm", "Millimeters"]], note: "Parts are always in mm." },
    { key: "decimals", label: "Decimal places", type: "radio", opts: [[1, "Simple"], [2, "Normal"], [3, "Precise"]] },
    { key: "detail", label: "Detail level", type: "radio", opts: [["student", "Student"], ["expert", "Expert"]] },
    { key: "dimLabels", label: "Dimension labels", type: "radio", opts: [["all", "All"], ["key", "Key only"], ["none", "None"]] },
    { key: "grid", label: "Measuring grid", type: "radio", opts: [[false, "Off"], [true, "On (1 mm and 5 mm lines)"]] },
    { key: "hover", label: "Highlight on hover", type: "radio", opts: [[true, "On"], [false, "Off"]] },
    { key: "scheme", label: "Color scheme", type: "radio", opts: [["standard", "Windows Standard"], ["contrast", "High Contrast"]] }
  ] },
  { id: "mot", title: "Motion and hub", rows: [
    { key: "speed", label: "Animation speed", type: "radio", opts: [["auto", "Normal, or off if the device asks for less motion"], ["slow", "Slow"], ["normal", "Normal"], ["fast", "Fast"], ["off", "Off"]] },
    { key: "direction", label: "Turn direction", type: "radio", opts: [["cw", "Clockwise"], ["ccw", "Counterclockwise"]], note: "Only mirrors the drawings and which way the sheet slides." },
    { key: "hub", label: "Hub", type: "hub", opts: [["gobilda", "goBILDA 32 mm hub"], ["custom", "Custom (unlocks the hub mount settings)"]] }
  ] }
];

function openSettings({ store, onApplied, startTab }) {
  let draft = { ...store.settings };
  let hub = store.design.hub;
  let tab = startTab || "cmp";
  const tabBar = h("menu", { role: "tablist", "aria-label": "Settings pages" });
  const panels = {};
  const inputs = [];

  function radio(row, name) {
    const box = h("fieldset.setrow", h("legend", row.label));
    row.opts.forEach(([val, text], i) => {
      const id = "set-" + row.key + "-" + i;
      const cur = row.type === "hub" ? hub : draft[row.key];
      const inp = h("input", { type: "radio", name, id, checked: cur === val });
      inp.addEventListener("change", () => { if (row.type === "hub") hub = val; else draft[row.key] = val; });
      inputs.push(() => { inp.checked = (row.type === "hub" ? hub : draft[row.key]) === val; });
      box.appendChild(h("div.field-row", inp, h("label", { for: id }, text)));
    });
    if (row.note) box.appendChild(h("p.setnote", row.note));
    return box;
  }

  function viewRow(row) {
    const box = h("fieldset.setrow", h("legend", row.label));
    const g = h("input", { type: "checkbox", id: "set-ghost", checked: draft.ghost });
    const s = h("input", { type: "checkbox", id: "set-side", checked: draft.sideBySide });
    g.addEventListener("change", () => { draft.ghost = g.checked; });
    s.addEventListener("change", () => { draft.sideBySide = s.checked; });
    inputs.push(() => { g.checked = draft.ghost; s.checked = draft.sideBySide; });
    box.append(
      h("div.field-row", g, h("label", { for: "set-ghost" }, "Ghost overlay (dashed outlines behind the drawings)")),
      h("div.field-row", s, h("label", { for: "set-side" }, "Side by side panels when 2 or more Compare boxes are checked")),
      h("p.setnote", "Uncheck both for numbers only. The compare table is always shown."));
    return box;
  }

  function baseRow(row) {
    const box = h("fieldset.setrow", h("legend", row.label));
    const sel = h("select", { id: "set-base", "aria-label": row.label });
    sel.appendChild(h("option", { value: "last", text: "The last change" }));
    for (const s of store.saved) sel.appendChild(h("option", { value: s.id, text: s.name + " (home base)" }));
    sel.value = draft.badgeBase;
    sel.addEventListener("change", () => { draft.badgeBase = sel.value; });
    inputs.push(() => { sel.value = draft.badgeBase; });
    box.append(h("div.field-row", sel));
    if (!store.saved.length) box.appendChild(h("p.setnote", "Save a design to use it as home base."));
    return box;
  }

  TABS.forEach(t => {
    const a = h("a", { href: "#", role: "presentation" }, t.title);
    const li = h("li", { role: "tab", "aria-selected": String(t.id === tab), tabindex: t.id === tab ? "0" : "-1", id: "tab-" + t.id, "aria-controls": "tp-" + t.id }, a);
    li.addEventListener("click", e => { e.preventDefault(); show(t.id); li.focus(); });
    li.addEventListener("keydown", e => {
      const i = TABS.findIndex(x => x.id === tab);
      if (e.key === "ArrowRight") { e.preventDefault(); show(TABS[(i + 1) % TABS.length].id); tabBar.children[(i + 1) % TABS.length].focus(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); show(TABS[(i + TABS.length - 1) % TABS.length].id); tabBar.children[(i + TABS.length - 1) % TABS.length].focus(); }
    });
    tabBar.appendChild(li);
    const body = h("div.window-body");
    for (const row of t.rows) body.appendChild(row.type === "view" ? viewRow(row) : row.type === "base" ? baseRow(row) : radio(row, "set-" + row.key));
    panels[t.id] = h("div.window.tabpanel", { role: "tabpanel", id: "tp-" + t.id, "aria-labelledby": "tab-" + t.id, hidden: t.id !== tab }, body);
  });

  function show(id) {
    tab = id;
    for (const li of tabBar.children) { const on = li.id === "tab-" + id; li.setAttribute("aria-selected", String(on)); li.tabIndex = on ? 0 : -1; }
    for (const [k, p] of Object.entries(panels)) p.hidden = k !== id;
  }

  function apply() {
    store.setSettings(draft);
    if (hub !== store.design.hub) { store.beginEdit("hub"); store.setField("hub", hub); }
    if (onApplied) onApplied();
  }

  const reset = h("button", { type: "button" }, "Reset settings");
  reset.addEventListener("click", () => {
    draft = { ...DEFAULT_SETTINGS };
    for (const f of inputs) f();
  });
  const body = h("div.settings", tabBar, ...Object.values(panels), h("div.reset-row", reset, h("span.setnote", "Reset settings does not change your design.")));
  return openDialog({
    title: "Settings", body, cls: "wide settings-dlg",
    buttons: [{ label: "OK", value: "ok", primary: true }, { label: "Cancel", value: "cancel" }, { label: "Apply", value: "apply" }],
    onButton: v => { if (v === "ok" || v === "apply") apply(); return v === "apply"; }
  });
}

module.exports = { openSettings, TABS };
