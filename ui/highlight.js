"use strict";
// "Selecting a box points to it in the pictures."
// Focusing an input lights up its dimension in every drawing (highlight color,
// soft glow), fades everything else to about 30%, and shows a callout bubble
// in plain words. It works the other way too: hovering or tapping a dimension
// lights up its input box and scrolls it into view.
const { h, $$ } = require("./dom.js");
const { FIELD, METRICS } = require("../state/fields.js");

function createHighlighter({ root, inputsPane, getSettings, isVisibleField }) {
  let focusKey = null, hoverKey = null;
  const bubbles = new Map();

  const keyNow = () => hoverKey || focusKey;
  const textFor = key => (FIELD[key] && FIELD[key].callout) || (METRICS[key] && METRICS[key].name + (METRICS[key].term ? " (" + METRICS[key].term + ")" : "")) || key;

  function clearBubbles() { for (const b of bubbles.values()) b.remove(); bubbles.clear(); }

  function apply() {
    const key = keyNow();
    clearBubbles();
    for (const svg of $$("svg.drw", root)) {
      for (const el of svg.querySelectorAll(".hl")) el.classList.remove("hl");
      if (!key) { svg.classList.remove("focus-mode"); continue; }
      const hits = svg.querySelectorAll('[data-key~="' + key + '"]');
      svg.classList.toggle("focus-mode", hits.length > 0);
      for (const el of hits) el.classList.add("hl");
      if (hits.length) bubble(svg, hits, key);
    }
    for (const el of $$(".hl-row", root)) el.classList.remove("hl-row");
    if (key) for (const el of $$('[data-hl~="' + key + '"]', root)) el.classList.add("hl-row");
    for (const el of $$(".field.pointed", inputsPane)) el.classList.remove("pointed");
    if (hoverKey) { const f = inputsPane.querySelector('.field[data-field="' + hoverKey + '"]'); if (f) f.classList.add("pointed"); }
  }

  // One bubble per drawing, beside the first lit part, kept inside the box.
  function bubble(svg, hits, key) {
    const box = svg.closest(".drawing");
    if (!box) return;
    let target = null;
    for (const el of hits) { const r = el.getBoundingClientRect(); if (r.width + r.height > 2) { target = r; if (el.matches(".dim")) break; } }
    if (!target) return;
    const br = box.getBoundingClientRect();
    const b = h("div.callout", { role: "note" }, textFor(key));
    box.appendChild(b);
    const bw = Math.min(b.offsetWidth, br.width - 8), bh = b.offsetHeight;
    let x = target.left - br.left + target.width / 2 - bw / 2;
    let y = target.top - br.top - bh - 10;
    let below = false;
    if (y < 2) { y = target.bottom - br.top + 10; below = true; }
    if (y + bh > br.height - 2) { y = Math.max(2, br.height - bh - 2); }
    x = Math.max(4, Math.min(br.width - bw - 4, x));
    b.style.left = x + "px"; b.style.top = y + "px"; b.style.maxWidth = (br.width - 8) + "px";
    const tail = Math.max(10, Math.min(bw - 14, target.left - br.left + target.width / 2 - x));
    b.style.setProperty("--tail", tail + "px");
    b.classList.toggle("below", below);
    bubbles.set(box, b);
  }

  // First key on an element that has a visible input box.
  function inputKeyOf(el) {
    const keys = (el.getAttribute("data-key") || "").split(/\s+/).filter(Boolean);
    return keys.find(k => FIELD[k] && isVisibleField(k)) || keys[0] || null;
  }

  function pointFromDrawing(el, scroll) {
    const key = inputKeyOf(el);
    if (!key) return;
    hoverKey = key;
    apply();
    const f = inputsPane.querySelector('.field[data-field="' + key + '"]');
    if (f && scroll) scrollIntoViewIfNeeded(f);
  }

  function scrollIntoViewIfNeeded(el) {
    const pane = el.closest(".pane");
    if (pane && getComputedStyle(pane).overflowY === "auto") {
      const pr = pane.getBoundingClientRect(), r = el.getBoundingClientRect();
      if (r.top < pr.top || r.bottom > pr.bottom) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } else {
      const r = el.getBoundingClientRect();
      if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }

  // hover over drawings
  root.addEventListener("pointerover", e => {
    if (e.pointerType === "touch" || !getSettings().hover) return;
    const el = e.target.closest && e.target.closest("svg.drw [data-key]");
    if (!el) return;
    pointFromDrawing(el, true);
  });
  root.addEventListener("pointerout", e => {
    if (!hoverKey) return;
    const to = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest("svg.drw [data-key]");
    if (to) return;
    hoverKey = null; apply();
  });
  // tap on a drawing part: light up its box and scroll to it
  root.addEventListener("click", e => {
    if (e.target.closest("[data-dim-label]") && e.target.closest(".editing-on")) return;
    const el = e.target.closest && e.target.closest("svg.drw [data-key]");
    if (!el || e.defaultPrevented) return;
    pointFromDrawing(el, true);
    if (e.pointerType === "touch" || (e.detail && e.detail > 0)) setTimeout(() => { if (hoverKey) { hoverKey = null; apply(); } }, 2500);
  });
  // hover over an input row points at its dimension (Highlight on hover)
  inputsPane.addEventListener("pointerover", e => {
    if (e.pointerType === "touch" || !getSettings().hover) return;
    const f = e.target.closest(".field[data-field]");
    if (!f || focusKey) return;
    const k = f.getAttribute("data-field");
    if (k !== hoverKey) { hoverKey = k; apply(); }
  });
  inputsPane.addEventListener("pointerleave", () => { if (hoverKey) { hoverKey = null; apply(); } });

  return {
    setFocus(key) { focusKey = key; hoverKey = null; apply(); },
    clearFocus(key) { if (!key || focusKey === key) { focusKey = null; apply(); } },
    get key() { return keyNow(); },
    apply,
    // re-apply on freshly drawn parts (animation regenerates some groups)
    refresh(el) {
      const key = keyNow();
      if (!key || !el) return;
      for (const x of el.querySelectorAll('[data-key~="' + key + '"]')) x.classList.add("hl");
    }
  };
}

module.exports = { createHighlighter };
