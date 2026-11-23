"use strict";
// Saved designs list: each with a Compare check box, Open tab, Rename, Delete
// and Save to a file.
const { h } = require("./dom.js");
const F = require("../core/format.js");

function shortSummary(d, units) {
  const slide = units === "in" ? F.trim(d.travel / 25.4, 2) + " in" : F.trim(d.travel, 1) + " mm";
  return F.trim(d.rotation, 1) + "° → " + slide + " · " + d.teeth + " pins · " + F.trim(d.pinW, 2) + " mm " + d.shape + " pins";
}

function renderSaved(table, { store, actions }) {
  const list = store.saved;
  table.innerHTML = "";
  if (!list.length) {
    table.appendChild(h("tbody", h("tr", h("td.empty", "No saved designs yet. Press Save design to keep this one as Design A."))));
    return;
  }
  table.appendChild(h("thead", h("tr",
    h("th", { scope: "col" }, "Compare"), h("th", { scope: "col" }, "Name"), h("th", { scope: "col" }, "Design"), h("th", { scope: "col" }, h("span.sr-only", "Actions")))));
  const tb = h("tbody");
  for (const s of list) {
    const id = "cmp-" + s.id;
    const cb = h("input", { type: "checkbox", id, checked: s.compare });
    cb.addEventListener("change", () => actions.compare(s.id, cb.checked, cb));
    const mk = (text, fn, label) => { const b = h("button", { type: "button", "aria-label": label + " " + s.name }, text); b.addEventListener("click", fn); return b; };
    tb.appendChild(h("tr", { class: s.compare ? "cmp-on" : "" },
      h("td.cmpcell", cb, h("label", { for: id }, h("span.sr-only", "Compare " + s.name))),
      h("th.sname", { scope: "row" }, s.name),
      h("td.ssum", shortSummary(s.design, store.settings.units)),
      h("td.sbtns",
        s.id === store.activeTab ? h("span.this-tab", "This tab") : mk(store.isOpen(s.id) ? "Show tab" : "Open tab", () => actions.open(s.id), store.isOpen(s.id) ? "Show the tab for" : "Open a tab for"),
        mk("Rename", () => actions.rename(s.id), "Rename"),
        mk("Delete", () => actions.remove(s.id), "Delete"),
        mk("Save file", () => actions.saveFile(s.id), "Save to a file:"))));
  }
  table.appendChild(tb);
}

module.exports = { renderSaved, shortSummary };
