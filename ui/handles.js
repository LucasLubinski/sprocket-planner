"use strict";
// Edit right in the drawings, on top of the dimension model: drag handles on
// editable dimensions, arrow keys on a focused handle (Shift for bigger
// steps), and type-in-place on a dimension's label (Enter applies, Escape
// cancels). Every change goes through store.setField, so drags follow the same
// linked rules and locks as typing. Locked and held numbers get no handle.
const { heldBy, valueOf, isLocked, nameOf } = require("../state/link.js");
const F = require("../core/format.js");

const NS = "http://www.w3.org/2000/svg";
const D2R = Math.PI / 180;

// The number a label shows (dim.show) and the input it changes (dim.set.key).
// Both default to the dimension's own key.
const showKeyOf = dim => dim.show || dim.key;
const setKeyOf = dim => (dim.set && dim.set.key) || dim.key;

function svgEl(tag, attrs) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v !== undefined && v !== null) el.setAttribute(k, String(v));
  return el;
}

function createHandles({ store, getVM, setStatus, onRoute }) {
  let refocus = null;   // { drawing, key } to focus again after a redraw
  let dragging = null;
  let editor = null;    // the type-in-place box

  const canEdit = key => !store.locks.includes(key) && !heldBy(store.locks)[key] && !isLocked(store.design, key);
  // the value as the model knows it (mm for travel), including derived numbers
  const current = key => {
    const m = getVM().model;
    if (m.ok && key in m.v && isFinite(m.v[key])) return m.v[key];
    const v = valueOf(store.design, key);
    return isFinite(v) ? v : 0;
  };
  const snap = (dim, v) => {
    const step = dim.step || 0.1;
    let s = Math.round(v / step) * step;
    s = +s.toFixed(6);
    const d = dim.drag || {};
    if (d.min !== undefined) s = Math.max(d.min, s);
    if (d.max !== undefined) s = Math.min(d.max, s);
    if (dim.key === "teeth") s = Math.max(3, Math.round(s));
    else if (dim.kind !== "angle" && dim.key !== "rotation") s = Math.max(step, s); // lengths stay above 0
    return s;
  };
  // v is the number the label shows. Most labels show their own input; some
  // show a result tied to one input (slot height = sheet + track clearance),
  // and dim.set says which input to change and how.
  function apply(dim, v) {
    if (Math.abs(v - current(showKeyOf(dim))) < 1e-9) return false;
    const key = setKeyOf(dim);
    const ok = store.setField(key, dim.set && dim.set.from ? dim.set.from(v, store.design) : v);
    if (onRoute) onRoute(key, dim.drawing);
    return ok;
  }

  // ---------- handles on one drawing ----------
  function decorate(drawing) {
    const svg = drawing.svg, sk = drawing.sketch;
    if (!svg || !sk || !drawing.dims) return;
    drawing.container.classList.add("editing-on");
    const layer = svgEl("g", { class: "handles" });
    const rVis = 6 / sk.s, rHit = 22 / sk.s;
    for (const dim of drawing.dims) {
      if (!dim.editable) continue;
      const key = setKeyOf(dim);
      // only when its dimension is showing (detail level and label setting)
      const grp = svg.querySelector('[data-dim="' + dim.id + '"]');
      if (grp && !grp.checkVisibility()) continue;
      const label = grp && grp.querySelector("[data-dim-label]");
      if (!canEdit(key)) { if (label) label.classList.remove("dl-edit"); continue; }
      // every editable label takes type-in-place; only some also get a drag handle
      if (label) { label.classList.add("dl-edit"); label.setAttribute("aria-label", "Change " + nameOf(showKeyOf(dim)) + ": " + label.textContent); }
      if (!dim.handle || !dim.drag) continue;
      const [hx, hy] = dim.handle;
      const g = svgEl("g", {
        class: "dhandle", "data-key": key, "data-dim-handle": dim.id, tabindex: "0", role: "slider",
        "aria-label": "Drag to change " + nameOf(key) + ". Arrow keys nudge it.", "aria-valuenow": +current(key).toFixed(4)
      });
      g.appendChild(svgEl("circle", { class: "dh-hit", cx: sk.X(hx), cy: sk.Y(hy), r: rHit }));
      g.appendChild(svgEl("circle", { class: "dh-dot", cx: sk.X(hx), cy: sk.Y(hy), r: rVis }));
      g.addEventListener("pointerdown", e => startDrag(e, drawing, dim, g));
      g.addEventListener("focus", () => {
        if (refocus && refocus.key === key) { refocus = null; return; } // same edit, after a redraw
        store.beginEdit("handle:" + key);
      });
      g.addEventListener("keydown", e => nudge(e, drawing, dim));
      layer.appendChild(g);
    }
    svg.appendChild(layer);
    if (refocus && refocus.drawing === drawing.id) {
      const h = layer.querySelector('[data-key="' + refocus.key + '"]');
      if (h) h.focus({ preventScroll: true }); else refocus = null;
    }
  }

  function nudge(e, drawing, dim) {
    const up = e.key === "ArrowUp" || e.key === "ArrowRight", down = e.key === "ArrowDown" || e.key === "ArrowLeft";
    if (!up && !down) return;
    e.preventDefault();
    const step = e.shiftKey ? (dim.bigStep || (dim.step || 0.1) * 10) : (dim.step || 0.1);
    refocus = { drawing: drawing.id, key: dim.key };
    if (!apply(dim, snap(dim, current(dim.key) + (up ? step : -step)))) refocus = null;
  }

  // ---------- dragging ----------
  // Values follow the pointer relative to where the drag began, in the
  // drawing's world (mm), using the drawing as it was at the start (it
  // refits as the design changes).
  function startDrag(e, drawing, dim, g) {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    const svg = drawing.svg, sk = drawing.sketch;
    const inv = svg.getScreenCTM().inverse(), dir = sk.dir;
    const toW = (cx, cy) => { const p = new DOMPoint(cx, cy).matrixTransform(inv); return [p.x / dir, -p.y]; };
    store.beginEdit("drag:" + dim.key);
    const d = dim.drag, w0 = toW(e.clientX, e.clientY), v0 = current(dim.key);
    const angOf = (w, c) => Math.atan2(w[1] - c[1], w[0] - c[0]) / D2R;
    const cwFromTop = w => (Math.atan2(w[0] - d.center[0], w[1] - d.center[1]) / D2R + 360) % 360;
    const st = { last: null, prevA: d.type === "turn" ? cwFromTop(w0) : d.type === "angle" ? angOf(w0, d.center) : 0, total: 0 };
    const side = d.abs ? Math.sign((w0[0] - d.origin[0]) * d.axis[0] + (w0[1] - d.origin[1]) * d.axis[1]) || 1 : 1;
    dragging = { key: dim.key };
    document.body.classList.add("dragging");
    g.classList.add("active");
    const move = ev => {
      const w = toW(ev.clientX, ev.clientY);
      let v = v0;
      if (d.type === "axis") v = v0 + ((w[0] - w0[0]) * d.axis[0] + (w[1] - w0[1]) * d.axis[1]) * (d.factor || 1) * side;
      else if (d.type === "radial") v = v0 + (Math.hypot(w[0] - d.center[0], w[1] - d.center[1]) - Math.hypot(w0[0] - d.center[0], w0[1] - d.center[1])) * (d.factor || 1);
      else if (d.type === "angle" || d.type === "turn") {
        const a = d.type === "turn" ? cwFromTop(w) : angOf(w, d.center);
        let da = a - st.prevA; da = ((da + 540) % 360) - 180; // unwrap past a full turn
        st.prevA = a; st.total += da;
        v = v0 + st.total * (d.sense || 1); // toW already undoes the mirror
      }
      v = snap(dim, v);
      if (v !== st.last) { st.last = v; apply(dim, v); }
    };
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      document.body.classList.remove("dragging");
      dragging = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }

  // ---------- type-in-place ----------
  function editLabel(drawing, label) {
    const id = label.getAttribute("data-dim-label");
    const dim = (drawing.dims || []).find(x => x.id === id);
    if (!dim || !dim.editable) return false;
    const key = setKeyOf(dim), show = showKeyOf(dim);
    if (!canEdit(key)) {
      if (isLocked(store.design, key)) setStatus("Set Hub to Custom to change the hub settings.");
      else setStatus(nameOf(key) + (store.locks.includes(key) ? " is locked." : " is held by the locks.") + " Unlock it to change it.");
      return true;
    }
    closeEditor();
    const inch = show === "travel" && store.settings.units === "in";
    const box = drawing.container;
    const r = label.getBoundingClientRect(), b = box.getBoundingClientRect();
    const input = document.createElement("input");
    input.type = "text"; input.className = "tip-edit"; input.inputMode = "decimal";
    input.setAttribute("aria-label", "New " + nameOf(show) + (inch ? " in inches" : dim.kind === "angle" ? " in degrees" : dim.kind === "count" ? "" : " in mm") + ". Enter applies, Escape cancels.");
    const v = current(show);
    input.value = F.trim(inch ? v / 25.4 : v, 4);
    input.style.left = Math.max(0, r.left - b.left + box.scrollLeft) + "px";
    input.style.top = Math.max(0, r.top - b.top + box.scrollTop - 4) + "px";
    input.style.width = Math.max(90, r.width + 16) + "px";
    box.appendChild(input);
    editor = { input, drawing, key };
    input.focus(); input.select();
    store.beginEdit("inplace:" + key);
    input.addEventListener("keydown", ev => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        const n = F.parse(input.value);
        if (!isFinite(n)) { input.classList.add("partial"); return; }
        closeEditor();
        apply(dim, inch ? n * 25.4 : n);
      } else if (ev.key === "Escape") { ev.preventDefault(); ev.stopPropagation(); closeEditor(); setStatus("Change canceled."); }
    });
    input.addEventListener("blur", () => setTimeout(() => { if (editor && editor.input === input) closeEditor(); }, 0));
    return true;
  }
  function closeEditor() { if (editor) { const e = editor; editor = null; e.input.remove(); } }

  function attach(drawing) {
    drawing.container.addEventListener("click", e => {
      const label = e.target.closest && e.target.closest("text[data-dim-label]");
      if (!label || !label.classList.contains("dl-edit")) return;
      if (editLabel(drawing, label)) e.preventDefault();
    });
  }

  return { decorate, attach, editLabel, canEdit, get dragging() { return dragging; }, get editor() { return editor; } };
}

module.exports = { createHandles };
