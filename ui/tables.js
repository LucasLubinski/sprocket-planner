"use strict";
// Measurements table (every derived number) and the compare table
// (Now plus each saved design, with badges showing the difference from Now).
const { h } = require("./dom.js");
const { METRICS, MEASURE_ROWS, COMPARE_ROWS, FIELD, levelOf } = require("../state/fields.js");
const F = require("../core/format.js");

function valueText(vm, m, key) {
  const v = m.v[key];
  const meta = METRICS[key] || {};
  if (key === "screwL") return isFinite(v) ? "4 × M4 × " + v + " mm" : "none long enough";
  if (key === "play" || key === "loPlay" || key === "hiPlay") return "±" + vm.fmt(key, v) + " mm";
  if (key === "travel") return vm.fmt("travel", v) + " mm (" + vm.fmt("travelIn", v / 25.4) + " in)";
  const unit = meta.unit ? (meta.unit === "°" ? "°" : " " + meta.unit) : "";
  return vm.fmt(key, v) + unit;
}

function nameOf(vm, key) {
  const meta = METRICS[key] || {};
  let name = meta.name || key;
  if (key.startsWith("lo") || key.startsWith("hi")) {
    const amt = key.startsWith("lo") ? vm.model.p.gap - vm.model.v.loGap : vm.model.v.hiGap - vm.model.p.gap;
    name = "Sheet " + vm.fmt("gap", amt, 1) + " mm " + (key.startsWith("lo") ? "lower" : "higher") + ": " + (key.endsWith("Play") ? "wiggle room" : "squeeze room");
  }
  return name;
}

function renderMeasure(table, vm, onPick) {
  const m = vm.model;
  table.innerHTML = "";
  table.appendChild(h("thead", h("tr", h("th", { scope: "col" }, "Measurement"), h("th", { scope: "col" }, "Value"), h("th", { scope: "col" }, "Change"))));
  if (!m.ok) { table.appendChild(h("tbody", h("tr", h("td", { colspan: "3" }, "Fix the red boxes to see the numbers.")))); return; }
  for (const sec of MEASURE_ROWS) {
    const tb = h("tbody");
    tb.appendChild(h("tr.sec", h("th", { colspan: "3", scope: "rowgroup" }, sec.title)));
    for (const key of sec.keys) {
      const meta = METRICS[key] || {};
      if (levelOf(key) === "expert" && vm.settings.detail !== "expert") continue;
      const b = vm.badge(key);
      const tr = h("tr", { "data-hl": key, "data-key": key, tabindex: FIELD[key] ? "0" : undefined, class: FIELD[key] ? "pick" : undefined },
        h("th", { scope: "row" }, nameOf(vm, key), meta.term && vm.settings.detail === "expert" ? h("span.term", " (" + meta.term + ")") : meta.term ? h("span.term", " (" + meta.term + ")") : null),
        h("td.num", valueText(vm, m, key)),
        h("td.bdg-cell", b ? h("span", { class: "bdg " + b.cls, "aria-label": b.aria }, b.text) : ""));
      tb.appendChild(tr);
    }
    table.appendChild(tb);
  }
  table.onclick = e => { const tr = e.target.closest("tr.pick"); if (tr && onPick) onPick(tr.getAttribute("data-key")); };
  table.onkeydown = e => { if (e.key === "Enter") { const tr = e.target.closest("tr.pick"); if (tr && onPick) onPick(tr.getAttribute("data-key")); } };
}

// "Now" is the open tab's design. While a saved design's tab is open, the
// Current design gets its own column, and the open design's column is marked
// "this tab" with no badges (it is Now).
function renderCompare(table, vm, saved, { active = "current", current = null } = {}) {
  table.innerHTML = "";
  const head = h("tr", h("th", { scope: "col" }, ""), h("th.now", { scope: "col" }, "Now"));
  const cols = [];
  if (active !== "current" && current) cols.push({ id: "current", name: "Current", design: current, compare: false });
  cols.push(...saved);
  saved = cols;
  for (const s of saved) head.appendChild(h("th", { scope: "col", class: (s.compare ? "cmp-on" : "") + (s.id === active ? " this-tab" : "") }, s.id === active ? s.name + " (this tab)" : s.name));
  table.appendChild(h("thead", head));
  const tb = h("tbody");
  const now = vm.model;
  for (const key of COMPARE_ROWS) {
    const k = key === "travel" && vm.settings.units === "in" ? "travelIn" : key;
    const meta = METRICS[k] || {};
    const fmtv = (m) => {
      if (!m.ok) return "—";
      const v = m.v[k];
      if (k === "play") return "±" + vm.fmt(k, v);
      return vm.fmt(k, v) + (meta.unit === "°" ? "°" : meta.unit ? " " + meta.unit : "");
    };
    const tr = h("tr", { "data-hl": key }, h("th", { scope: "row" }, meta.name || k), h("td.num.now", fmtv(now)));
    for (const s of saved) {
      const m = vm.analyze(s.design);
      const b = now.ok && m.ok && s.id !== active ? vm.badgeVs(k, m.v[k], now.v[k]) : null;
      tr.appendChild(h("td.num", { class: (s.compare ? "cmp-on" : "") + (s.id === active ? " this-tab" : "") }, fmtv(m), b ? h("span", { class: "bdg " + b.cls, "aria-label": b.aria + " compared with now" }, " " + b.text) : null));
    }
    tb.appendChild(tr);
  }
  table.appendChild(tb);
}

module.exports = { renderMeasure, renderCompare, valueText };
