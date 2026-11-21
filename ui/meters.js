"use strict";
// Fit meters as Windows 98 progress bars: segmented blocks in a sunken frame,
// each block colored by its zone, with the zone named in words beside it.
// Markers show now, the last version, and the designs checked for Compare.
const { h } = require("./dom.js");
const { svgIcon } = require("./icons.js");

const SEGMENTS = 24;
const METERS = [
  { key: "play", name: "Wiggle room", term: "play per side", min: 0, max: 0.8, unit: "mm", prefix: "±",
    zone: v => v <= 0 ? ["red", "Pins too wide"] : v < 0.05 ? ["red", "Too tight"] : v < 0.15 ? ["amber", "Snug"] : v <= 0.35 ? ["green", "Just right"] : v <= 0.6 ? ["amber", "Loose"] : ["red", "Too loose"] },
  { key: "tight", name: "Squeeze room while turning", term: "tightest clearance", min: -0.2, max: 0.5, unit: "mm",
    zone: v => !isFinite(v) ? ["red", "No plastic between holes"] : v < 0 ? ["red", "Pins hit"] : v <= 0.08 ? ["amber", "Tight"] : ["green", "Turns freely"] },
  { key: "web", name: "Plastic between holes", term: "web", min: 0, max: 8, unit: "mm",
    zone: v => v < 1.5 ? ["red", "Too thin"] : v <= 2.5 ? ["amber", "Thin"] : ["green", "Strong"] },
  { key: "inSheet", name: "Pins in the sheet at once", term: "engagement", min: 0, max: 4, unit: "",
    zone: v => v < 1 ? ["red", "Not enough"] : v < 1.5 ? ["amber", "Few"] : ["green", "Plenty"] }
];
const ICON = { green: "ok", amber: "warn", red: "stopSign" };

const pos = (mt, v) => Math.max(0, Math.min(1, (v - mt.min) / (mt.max - mt.min))) * 100;

function renderMeters(box, vm) {
  box.innerHTML = "";
  const m = vm.model;
  if (!m.ok) { box.appendChild(h("p.hint", "Fix the red boxes to see the meters.")); return; }
  for (const mt of METERS) {
    const v = m.v[mt.key];
    const [zone, word] = mt.zone(v);
    const b = vm.badge(mt.key);
    const segs = h("div.m-segs", { "aria-hidden": "true" });
    for (let i = 0; i < SEGMENTS; i++) {
      const mid = mt.min + (mt.max - mt.min) * (i + 0.5) / SEGMENTS;
      const filled = (i + 0.5) / SEGMENTS * 100 <= pos(mt, v);
      segs.appendChild(h("span", { class: "seg z-" + mt.zone(mid)[0] + (filled ? " on" : "") }));
    }
    const markers = h("div.m-marks", { "aria-hidden": "true" });
    for (const g of vm.marks || []) {
      const gv = g.m.v[mt.key];
      if (!isFinite(gv)) continue;
      markers.appendChild(h("span", { class: "mk ghostmk " + g.cls, style: { left: pos(mt, gv) + "%" }, title: g.label + ": " + vm.fmt(mt.key, gv) }, h("span.mk-t", g.short), h("span.mk-stem")));
    }
    if (isFinite(v)) markers.appendChild(h("span", { class: "mk nowmk", style: { left: pos(mt, v) + "%" } }, h("span.mk-t", "now"), h("span.mk-stem")));
    const valTxt = (mt.prefix || "") + vm.fmt(mt.key, v) + (mt.unit ? " " + mt.unit : "");
    const ariaMarks = (vm.marks || []).map(g => g.label + " " + vm.fmt(mt.key, g.m.v[mt.key])).join(", ");
    box.appendChild(h("div.meter", { "data-hl": mt.key, role: "group", "aria-label": mt.name },
      h("div.m-head",
        h("span.m-name", mt.name, " ", h("span.term", "(" + mt.term + ")")),
        h("span.m-val", valTxt),
        b ? h("span", { class: "bdg " + b.cls, "aria-label": b.aria }, b.text) : null),
      h("div.m-body",
        h("div.m-track", { role: "meter", "aria-valuemin": String(mt.min), "aria-valuemax": String(mt.max), "aria-valuenow": isFinite(v) ? String(+v.toFixed(3)) : undefined,
          "aria-valuetext": valTxt + ", " + word + (ariaMarks ? ". Also: " + ariaMarks : "") }, markers, segs),
        h("span", { class: "m-zone z-" + zone }, h("span.m-ic", { html: svgIcon(ICON[zone], 16) }), word)),
      h("div.m-scale", { "aria-hidden": "true" }, h("span", (mt.prefix || "") + vm.fmt(mt.key, mt.min, 1)), h("span", vm.fmt(mt.key, mt.max, 1) + (mt.unit ? " " + mt.unit : "")))));
  }
  stackAll(box);
  watch(box);
}

// Marker labels that would touch move up a row, with a stem down to their
// arrow. "now" always keeps the bottom row. Needs layout, so it reruns when
// the meters change width.
const ROW_PX = 15, BASE_PX = 20;
function stackMarks(track) {
  const marks = [...track.querySelectorAll(".mk")];
  const box = track.querySelector(".m-marks");
  if (!box || !box.clientWidth) return;
  const items = marks.map(el => ({ el, c: el.offsetLeft, w: el.querySelector(".mk-t").offsetWidth, now: el.classList.contains("nowmk") }))
    .sort((a, b) => (b.now - a.now) || a.c - b.c);
  const rows = [];
  let top = 0;
  for (const it of items) {
    let r = 0;
    while ((rows[r] || []).some(o => Math.abs(o.c - it.c) < (o.w + it.w) / 2 + 6)) r++;
    (rows[r] = rows[r] || []).push(it);
    it.el.querySelector(".mk-stem").style.height = r * ROW_PX + "px";
    it.el.style.zIndex = String(20 - r); // lower labels cover the stems of higher ones
    top = Math.max(top, r);
  }
  track.style.paddingTop = BASE_PX + top * ROW_PX + "px";
  box.style.height = BASE_PX + top * ROW_PX + "px";
}
function stackAll(box) { for (const t of box.querySelectorAll(".m-track")) stackMarks(t); }

let observer = null, watched = null;
function watch(box) {
  if (typeof ResizeObserver === "undefined" || watched === box) return;
  // only width matters; stacking itself changes the height
  let lastW = -1;
  if (!observer) observer = new ResizeObserver(() => {
    if (!watched || watched.clientWidth === lastW) return;
    lastW = watched.clientWidth;
    requestAnimationFrame(() => watched && stackAll(watched));
  });
  if (watched) observer.unobserve(watched);
  watched = box;
  observer.observe(box);
}

module.exports = { renderMeters, METERS };
