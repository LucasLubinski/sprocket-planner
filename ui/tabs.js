"use strict";
// Design tabs: "Current" plus one tab per open saved design, in a Windows 98
// property-sheet strip above the workspace. Each tab is the whole planner for
// that design. Arrow keys, Home and End move between tabs (tablist pattern).
const { h } = require("./dom.js");

function createTabs(strip, { store, onSwitch, onClose, panel }) {
  strip.setAttribute("role", "tablist");
  strip.setAttribute("aria-label", "Designs");
  let sig = "";

  function paint() {
    const list = store.tabList();
    const active = store.activeTab;
    const s = JSON.stringify([list, active]);
    if (s === sig) return;
    const hadFocus = strip.contains(document.activeElement) && document.activeElement.getAttribute("role") === "tab";
    sig = s;
    strip.innerHTML = "";
    for (const t of list) {
      const on = t.id === active;
      const tab = h("button.dtab", {
        type: "button", role: "tab", id: "tab-" + t.id, "data-tab": t.id,
        "aria-selected": String(on), "aria-controls": panel.id, tabindex: on ? "0" : "-1",
        title: t.id === "current" ? "Your working design" : t.name + ": edits here save into this saved design"
      }, t.name);
      tab.addEventListener("click", () => onSwitch(t.id));
      const li = h("li", { role: "presentation", class: on ? "on" : "" }, tab);
      if (t.id !== "current") {
        const x = h("button.dtab-x", { type: "button", "aria-label": "Close tab " + t.name, title: "Close tab (the design stays in Saved designs)", tabindex: on ? "0" : "-1" }, "×");
        x.addEventListener("click", e => { e.stopPropagation(); onClose(t.id); });
        li.appendChild(x);
      }
      strip.appendChild(li);
    }
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", "tab-" + active);
    const cur = strip.querySelector('[role=tab][aria-selected="true"]');
    if (cur) {
      // keep the active tab in view inside the strip, without scrolling the page
      const li = cur.parentElement;
      const l = li.offsetLeft, r = l + li.offsetWidth;
      if (l < strip.scrollLeft) strip.scrollLeft = l;
      else if (r > strip.scrollLeft + strip.clientWidth) strip.scrollLeft = r - strip.clientWidth;
      if (hadFocus) cur.focus({ preventScroll: true });
    }
  }

  strip.addEventListener("keydown", e => {
    const tab = e.target.closest("[role=tab]");
    if (!tab) return;
    const tabs = [...strip.querySelectorAll("[role=tab]")];
    const i = tabs.indexOf(tab);
    let j = -1;
    if (e.key === "ArrowRight") j = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") j = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = tabs.length - 1;
    else if (e.key === "Delete" && tab.dataset.tab !== "current") { e.preventDefault(); onClose(tab.dataset.tab); return; }
    if (j < 0) return;
    e.preventDefault();
    onSwitch(tabs[j].dataset.tab);
    const next = strip.querySelector('[data-tab="' + tabs[j].dataset.tab + '"]');
    if (next) next.focus({ preventScroll: true });
  });

  return { paint };
}

module.exports = { createTabs };
