"use strict";
// Tiny DOM helpers.

// h("div.cls#id", { attr: v, on: { click: fn } }, child, ...)
function h(spec, props, ...kids) {
  const m = /^([a-z0-9-]+)?((?:[.#][^.#]+)*)$/i.exec(spec) || [];
  const el = document.createElement(m[1] || "div");
  for (const part of (m[2] || "").match(/[.#][^.#]+/g) || []) {
    if (part[0] === ".") el.classList.add(part.slice(1)); else el.id = part.slice(1);
  }
  if (props && (typeof props !== "object" || props.nodeType || Array.isArray(props))) { kids.unshift(props); props = null; }
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === "on") { for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn); }
      else if (k === "text") el.textContent = v;
      else if (k === "html") el.innerHTML = v;
      else if (k === "dataset") Object.assign(el.dataset, v);
      else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
      else if (k in el && typeof v !== "string" && k !== "list") el[k] = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
  }
  for (const k of kids.flat(Infinity)) {
    if (k === null || k === undefined || k === false) continue;
    el.appendChild(k.nodeType ? k : document.createTextNode(String(k)));
  }
  return el;
}

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// "&Save design" -> Save design with S underlined; returns { el, key }
function accelLabel(label) {
  const i = label.indexOf("&");
  const frag = document.createDocumentFragment();
  if (i < 0) { frag.appendChild(document.createTextNode(label)); return { frag, key: null, text: label }; }
  const text = label.slice(0, i) + label.slice(i + 1);
  frag.appendChild(document.createTextNode(label.slice(0, i)));
  const u = document.createElement("u"); u.textContent = label[i + 1]; frag.appendChild(u);
  frag.appendChild(document.createTextNode(label.slice(i + 2)));
  return { frag, key: label[i + 1].toLowerCase(), text };
}

function download(name, text, type) {
  const blob = new Blob([text], { type: type || "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = h("a", { href: url, download: name, style: { display: "none" } });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
}

module.exports = { h, $, $$, accelLabel, download };
