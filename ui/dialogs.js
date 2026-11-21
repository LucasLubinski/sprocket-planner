"use strict";
// Windows 98 style dialogs: a small window with a title bar and
// OK / Cancel / Apply buttons. Modal, keeps focus inside, Escape cancels.
const { h } = require("./dom.js");

let layerEl = null;
function setLayer(el) { layerEl = el; }

function openDialog({ title, body, buttons = [{ label: "OK", value: "ok", primary: true }], onButton, onClose, cls = "", width, modal = true, icon }) {
  const prev = document.activeElement;
  const backdrop = modal ? h("div.dlg-backdrop") : null;
  const closeBtn = h("button", { type: "button", "aria-label": "Close" });
  const titleId = "dlg-t-" + Math.random().toString(36).slice(2, 8);
  const btnRow = h("div.dlg-buttons");
  const win = h("div.window.dialog" + (cls ? "." + cls.split(" ").join(".") : ""), { role: "dialog", "aria-modal": modal ? "true" : "false", "aria-labelledby": titleId },
    h("div.title-bar",
      h("div.title-bar-text", { id: titleId }, icon ? h("span.dlg-icon", { html: icon }) : null, title),
      h("div.title-bar-controls", closeBtn)),
    h("div.window-body", body, btnRow));
  if (width) win.style.width = width;
  let done = false;
  const api = {
    el: win,
    close(value) {
      if (done) return;
      done = true;
      win.remove(); if (backdrop) backdrop.remove();
      document.removeEventListener("keydown", onKey, true);
      if (onClose) onClose(value);
      if (prev && prev.focus && document.contains(prev)) prev.focus({ preventScroll: true });
    }
  };
  for (const b of buttons) {
    const el = h("button", { type: "button", class: b.primary ? "default" : "" }, b.label);
    el.addEventListener("click", () => {
      const keep = onButton ? onButton(b.value, api) : false;
      if (keep !== true) api.close(b.value);
    });
    btnRow.appendChild(el);
  }
  closeBtn.addEventListener("click", () => api.close("cancel"));
  function onKey(e) {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); api.close("cancel"); return; }
    if (e.key === "Tab" && modal) {
      const f = Array.from(win.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(x => !x.disabled && x.offsetParent !== null);
      if (!f.length) return;
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
    if (e.key === "Enter" && e.target.tagName === "INPUT" && e.target.type !== "checkbox" && e.target.type !== "radio") {
      const primary = buttons.find(b => b.primary);
      if (primary) { e.preventDefault(); const keep = onButton ? onButton(primary.value, api) : false; if (keep !== true) api.close(primary.value); }
    }
  }
  document.addEventListener("keydown", onKey, true);
  const host = layerEl || document.body;
  if (backdrop) host.appendChild(backdrop);
  host.appendChild(win);
  const first = win.querySelector("[autofocus]") || win.querySelector(".window-body input, .window-body select, .window-body textarea, .window-body button") || btnRow.querySelector("button");
  if (first) setTimeout(() => first.focus(), 0);
  return api;
}

function messageBox(title, lines, icon) {
  return openDialog({
    title, icon,
    body: h("div.msgbox", lines.map(t => typeof t === "string" ? h("p", t) : t)),
    buttons: [{ label: "OK", value: "ok", primary: true }]
  });
}

// "Name this design" box.
function promptBox(title, label, value, onOk) {
  const input = h("input", { type: "text", value, maxlength: "40", autofocus: true, id: "prompt-in" });
  return openDialog({
    title,
    body: h("div.prompt", h("label", { for: "prompt-in" }, label), input),
    buttons: [{ label: "OK", value: "ok", primary: true }, { label: "Cancel", value: "cancel" }],
    onButton: v => { if (v === "ok") { if (!input.value.trim()) { input.focus(); return true; } onOk(input.value.trim()); } }
  });
}

// Clipboard fallback: show the text with a "Select all" button so Ctrl+C works.
function copyFallback(title, text) {
  const ta = h("textarea.copybox", { readonly: true, spellcheck: "false", "aria-label": title, rows: "14" });
  ta.value = text;
  const sel = h("button", { type: "button", class: "default" }, "Select all");
  const d = openDialog({
    title,
    body: h("div.copyfb",
      h("p", "The browser blocked copying. Press Select all, then Ctrl+C to copy."),
      ta, h("div.copy-row", sel)),
    buttons: [{ label: "Close", value: "close" }],
    cls: "wide"
  });
  sel.addEventListener("click", () => { ta.focus(); ta.select(); });
  setTimeout(() => { ta.focus(); ta.select(); }, 0);
  return d;
}

module.exports = { setLayer, openDialog, messageBox, promptBox, copyFallback };
