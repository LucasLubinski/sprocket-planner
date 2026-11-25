"use strict";
// Toolbar: beveled icon buttons with a short caption under each icon
// (Windows 98 "Show text labels"), plus yellow tooltips with the full name.
const { h } = require("./dom.js");
const { svgIcon } = require("./icons.js");

function createTooltip(layer) {
  const tip = h("div.tooltip", { role: "tooltip", id: "tooltip", hidden: true });
  layer.appendChild(tip);
  let timer = null, owner = null;
  function show(el, text) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      owner = el;
      tip.textContent = text; tip.hidden = false;
      const r = el.getBoundingClientRect();
      const tw = tip.offsetWidth;
      tip.style.left = Math.max(4, Math.min(window.innerWidth - tw - 4, r.left + r.width / 2 - tw / 2)) + "px";
      tip.style.top = (r.bottom + 6) + "px";   // fixed: stays under its button while the page scrolls
      el.setAttribute("aria-describedby", "tooltip");
    }, 450);
  }
  function hide() { clearTimeout(timer); tip.hidden = true; if (owner) owner.removeAttribute("aria-describedby"); owner = null; }
  document.addEventListener("keydown", e => { if (e.key === "Escape") hide(); });
  return {
    attach(el, text) {
      el.addEventListener("pointerenter", e => { if (e.pointerType !== "touch") show(el, typeof text === "function" ? text() : text); });
      el.addEventListener("pointerleave", hide);
      el.addEventListener("focus", () => show(el, typeof text === "function" ? text() : text));
      el.addEventListener("blur", hide);
      el.addEventListener("click", hide);
    },
    hide
  };
}

function createToolbar(bar, { buttons, run, tooltip }) {
  const els = {};
  for (const b of buttons) {
    if (b === "|") { bar.appendChild(h("span.tb-sep", { role: "separator", "aria-orientation": "vertical" })); continue; }
    const btn = h("button.tb-btn", { type: "button", "aria-label": b.label, "data-cmd": b.cmd });
    btn.innerHTML = svgIcon(b.icon, 32);
    btn.appendChild(h("span.tb-cap", { "aria-hidden": "true" }, b.caption || b.label));
    if (b.toggle) btn.setAttribute("aria-pressed", "false");
    btn.addEventListener("click", () => run(b.cmd));
    tooltip.attach(btn, () => btn.getAttribute("aria-label"));
    bar.appendChild(btn);
    els[b.cmd] = btn;
  }
  return {
    set(cmd, { pressed, label, caption, icon, disabled } = {}) {
      const el = els[cmd]; if (!el) return;
      if (pressed !== undefined) el.setAttribute("aria-pressed", String(!!pressed));
      if (label) el.setAttribute("aria-label", label);
      if (caption) el.querySelector(".tb-cap").textContent = caption;
      if (icon && el.dataset.icon !== icon) { el.dataset.icon = icon; el.querySelector(".px-icon").outerHTML = svgIcon(icon, 32); }
      if (disabled !== undefined) el.disabled = !!disabled;
    }
  };
}

module.exports = { createToolbar, createTooltip };
