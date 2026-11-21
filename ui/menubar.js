"use strict";
// Menu bar with drop-down menus and underlined keyboard letters.
// Alt+letter (or Alt+Shift+letter, in case Chrome keeps Alt+letter for its
// own menu) opens a menu; arrows move; Enter picks; Escape closes.
const { h, accelLabel } = require("./dom.js");

function createMenubar(bar, { menus, run, state }) {
  let open = null; // { idx, pop, btn, items }
  const tops = [];

  menus.forEach((m, idx) => {
    const lab = accelLabel(m.label);
    const btn = h("button.menu-btn", { type: "button", role: "menuitem", "aria-haspopup": "true", "aria-expanded": "false", id: "menu-" + m.id });
    btn.appendChild(lab.frag);
    const wrap = h("div.menu-top", btn);
    bar.appendChild(wrap);
    tops.push({ m, btn, wrap, key: lab.key });
    btn.addEventListener("click", () => (open && open.idx === idx) ? close() : show(idx, false));
    btn.addEventListener("pointerenter", () => { if (open && open.idx !== idx) show(idx, false); });
    btn.addEventListener("keydown", e => {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") { e.preventDefault(); show(idx, true); }
      else if (e.key === "ArrowRight") { e.preventDefault(); tops[(idx + 1) % tops.length].btn.focus(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); tops[(idx + tops.length - 1) % tops.length].btn.focus(); }
    });
  });
  bar.setAttribute("role", "menubar");

  function buildItems(m) {
    const pop = h("div.menu-pop", { role: "menu", "aria-labelledby": "menu-" + m.id });
    const items = [];
    for (const it of m.items) {
      if (it === "-") { pop.appendChild(h("div.menu-sep", { role: "separator" })); continue; }
      if (it.heading) { pop.appendChild(h("div.menu-head", it.heading)); continue; }
      const lab = accelLabel(it.label);
      const checked = it.checked ? it.checked(state()) : null;
      const role = it.radio ? "menuitemradio" : it.checked ? "menuitemcheckbox" : "menuitem";
      const dis = it.enabled ? !it.enabled(state()) : false;
      const b = h("button.menu-item", { type: "button", role, tabindex: "-1", "aria-disabled": dis ? "true" : undefined },
        h("span.mi-check", { "aria-hidden": "true" }, checked ? (it.radio ? "●" : "✓") : ""),
        h("span.mi-label", lab.frag), h("span.mi-accel", it.accel || ""));
      if (checked !== null) b.setAttribute("aria-checked", String(!!checked));
      b.addEventListener("click", () => { if (dis) return; close(); run(it.cmd, it.arg); });
      b.addEventListener("pointerenter", () => b.focus({ preventScroll: true }));
      pop.appendChild(b);
      items.push({ b, key: lab.key, it, dis });
    }
    return { pop, items };
  }

  function show(idx, focusFirst) {
    close(true);
    const t = tops[idx];
    const { pop, items } = buildItems(t.m);
    t.wrap.appendChild(pop);
    t.btn.setAttribute("aria-expanded", "true");
    open = { idx, pop, btn: t.btn, items };
    // keep the menu on screen
    const r = pop.getBoundingClientRect();
    if (r.right > window.innerWidth - 4) pop.style.left = Math.min(0, window.innerWidth - 4 - r.right) + "px";
    pop.addEventListener("keydown", onKey);
    if (focusFirst) { const first = items.find(x => !x.dis) || items[0]; if (first) first.b.focus(); }
    else t.btn.focus({ preventScroll: true });
  }

  function close(keepFocus) {
    if (!open) return;
    open.pop.remove();
    open.btn.setAttribute("aria-expanded", "false");
    const btn = open.btn;
    open = null;
    if (!keepFocus && document.activeElement && bar.contains(document.activeElement)) btn.focus({ preventScroll: true });
  }

  function onKey(e) {
    if (!open) return;
    const items = open.items, i = items.findIndex(x => x.b === document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); items[(i + 1) % items.length].b.focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); items[(i - 1 + items.length) % items.length].b.focus(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); show((open.idx + 1) % tops.length, true); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); show((open.idx - 1 + tops.length) % tops.length, true); }
    else if (e.key === "Escape") { e.preventDefault(); const b = open.btn; close(true); b.focus(); }
    else if (e.key === "Tab") { close(true); }
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      const hit = items.find(x => x.key === e.key.toLowerCase() && !x.dis);
      if (hit) { e.preventDefault(); hit.b.click(); }
    }
  }

  document.addEventListener("pointerdown", e => { if (open && !bar.contains(e.target)) close(true); });
  document.addEventListener("keydown", e => {
    if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.length === 1) {
      const t = tops.findIndex(x => x.key === e.key.toLowerCase());
      if (t >= 0) { e.preventDefault(); show(t, true); }
    } else if (e.key === "F10" && !e.shiftKey) {
      e.preventDefault(); tops[0].btn.focus();
    }
  });

  return { close, isOpen: () => !!open };
}

module.exports = { createMenubar };
