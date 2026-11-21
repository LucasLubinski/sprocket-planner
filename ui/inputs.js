"use strict";
// The input boxes: linked fields with spinner arrows, units, hints, "?"
// explainers, change badges and the "you changed this" outline.
// A box being typed in is never overwritten.
const { h, $$ } = require("./dom.js");
const { GROUPS, FIELDS, FIELD, levelOf, dpFor } = require("../state/fields.js");
const { isLocked } = require("../state/link.js");
const F = require("../core/format.js");

const FIXED_DP = new Set(["P", "pitchD", "drumD", "taper", "tipD"]);

function createInputs(pane, { store, getVM, highlighter, onExplain, onStatus, examples, onExample }) {
  const rows = new Map();
  let typing = null;     // key of the box being typed in
  let activeKey = null;  // key of the focused box

  const unitsIn = () => store.settings.units === "in";

  function displayValue(key, vm) {
    const m = vm.model, d = store.design;
    let v = key in m.v ? m.v[key] : d[key];
    if (key === "travel" && unitsIn()) v = d.travel / 25.4;
    if (key === "sheetLen" && d.sheetLen != null) v = d.sheetLen;
    if (key === "rowOffset" && d.rowOffset != null) v = d.rowOffset;
    if (!isFinite(v)) return "";
    const f = FIELD[key];
    if (FIXED_DP.has(key)) return F.fixed(v, dpFor(key, store.settings.decimals)).replace("−", "-");
    if (key === "travel") return F.trim(v, unitsIn() ? 4 : 3);
    return F.trim(v, f.maxDp !== undefined ? f.maxDp : 3);
  }

  function badgeKey(key) { return key === "travel" ? (unitsIn() ? "travelIn" : "travel") : key; }

  function toModel(key, v) { return key === "travel" && unitsIn() ? v * 25.4 : v; }

  function stepFor(key, big) {
    const f = FIELD[key];
    if (key === "travel" && unitsIn()) return big ? f.bigIn : f.stepIn;
    return big ? f.big : f.step;
  }

  function begin(key) {
    store.beginEdit("field:" + key);
    activeKey = key;
    highlighter.setFocus(key);
  }

  function commit(key, raw) {
    const v = F.parse(raw);
    if (!isFinite(v)) return false;
    if (FIELD[key].int && Math.round(v) !== v) return false;
    store.setField(key, toModel(key, v));
    return true;
  }

  function nudge(key, dir, big) {
    const f = FIELD[key];
    if (isLocked(store.design, key)) { onStatus("Set Hub to Custom to change the hub settings."); return; }
    const row = rows.get(key);
    const cur = F.parse(row.input.value);
    const step = stepFor(key, big);
    let base = isFinite(cur) ? cur : 0;
    let next = Math.round((base + dir * step) / step) * step;
    next = +next.toFixed(6);
    if (f.int) next = Math.round(next);
    if (key === "teeth" && next < 3) next = 3;
    if (key !== "taper" && next < 0) next = 0;
    if (key === "sheetLen" || key === "rowOffset") { const auto = row.auto; if (auto) auto.checked = false; }
    row.input.value = String(next);
    store.setField(key, toModel(key, next));
  }

  function numField(f) {
    const id = "f-" + f.key;
    const input = h("input", {
      id, type: "text", inputmode: f.int ? "numeric" : "decimal", autocomplete: "off", spellcheck: "false",
      "aria-describedby": "h-" + f.key, "data-key": f.key
    });
    const up = h("button.spin-up", { type: "button", tabindex: "-1", "aria-label": "Up one step", text: "▲" });
    const dn = h("button.spin-dn", { type: "button", tabindex: "-1", "aria-label": "Down one step", text: "▼" });
    const unit = h("span.f-unit", f.key === "travel" ? "" : f.unit);
    const slot = h("span.bdg-slot", { "aria-live": "polite" });
    const extra = [];
    let auto = null, unitBtns = null;
    if (f.key === "travel") {
      unitBtns = h("span.unit-switch", { role: "group", "aria-label": "Units for Sheet slides" },
        h("button", { type: "button", "data-u": "in", text: "in" }), h("button", { type: "button", "data-u": "mm", text: "mm" }));
      extra.push(unitBtns);
      unitBtns.addEventListener("click", e => {
        const b = e.target.closest("button[data-u]"); if (!b) return;
        store.setSettings({ units: b.getAttribute("data-u") });
      });
    }
    if (f.auto) {
      auto = h("input", { type: "checkbox", id: "a-" + f.key });
      extra.push(h("span.auto", auto, h("label", { for: "a-" + f.key, text: "Auto" })));
      auto.addEventListener("change", () => {
        store.beginEdit("auto:" + f.key);
        if (auto.checked) store.setField(f.key, null);
        else store.setField(f.key, F.parse(input.value) || getVM().model.v[f.key]);
      });
    }
    const box = h("span.numbox", input, h("span.spin", up, dn));
    const row = h("div.field", { "data-field": f.key, "data-hl": f.key },
      h("div.f-top",
        h("label", { for: id }, h("span.f-name", f.name), " ", h("span.f-term", "(" + f.term + ")")),
        h("button.qmark", { type: "button", "aria-label": "What is " + f.name + "?", title: "What is this?", "data-explain": f.key, text: "?" })),
      h("div.f-row", box, unit, ...extra, slot),
      h("div.f-hint", { id: "h-" + f.key }, f.hint),
      h("div.f-lock", { hidden: true }, "Locked to the goBILDA hub. Pick Custom hub to change it."));
    if (levelOf(f.key) === "expert") row.classList.add("lvl-expert");

    input.addEventListener("focus", () => { begin(f.key); typing = null; });
    input.addEventListener("blur", () => {
      typing = null; activeKey = null;
      highlighter.clearFocus(f.key);
      paintOne(f.key, getVM());
    });
    input.addEventListener("input", () => {
      if (input.readOnly) return;
      typing = f.key;
      if (auto && auto.checked) auto.checked = false;
      const ok = commit(f.key, input.value);
      input.classList.toggle("partial", !ok && input.value.trim() !== "");
    });
    input.addEventListener("keydown", e => {
      if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); typing = f.key; nudge(f.key, e.key === "ArrowUp" ? 1 : -1, e.shiftKey); }
      else if (e.key === "Enter") { typing = null; paintOne(f.key, getVM()); input.select(); }
    });
    const press = dir => e => {
      e.preventDefault();
      if (activeKey !== f.key) { input.focus({ preventScroll: true }); }
      typing = f.key;
      nudge(f.key, dir, e.shiftKey);
      let t = setTimeout(function rep() { nudge(f.key, dir, false); t = setTimeout(rep, 90); }, 450);
      const stop = () => { clearTimeout(t); window.removeEventListener("pointerup", stop); window.removeEventListener("pointercancel", stop); };
      window.addEventListener("pointerup", stop); window.addEventListener("pointercancel", stop);
    };
    up.addEventListener("pointerdown", press(1));
    dn.addEventListener("pointerdown", press(-1));
    rows.set(f.key, { f, row, input, slot, auto, unitBtns, unit, lock: row.querySelector(".f-lock") });
    return row;
  }

  function shapeField(f) {
    const mk = (val, text) => h("button.shape-btn", { type: "button", "data-shape": val, "aria-pressed": "false" }, text);
    const tapered = mk("tapered", "Tapered"), straight = mk("straight", "Straight through the sheet");
    const note = h("span.shape-note", "");
    const row = h("div.field.shape", { "data-field": "shape", "data-hl": "shape pinStraight" },
      h("div.f-top", h("span.f-name.lbl-like", { id: "lbl-shape" }, f.name), " ", h("span.f-term", "(" + f.term + ")"),
        h("button.qmark", { type: "button", "aria-label": "What is Pin shape?", "data-explain": "shape", text: "?" })),
      h("div.f-row.shape-row", { role: "group", "aria-labelledby": "lbl-shape" }, tapered, straight, note),
      h("div.f-hint", f.hint));
    for (const b of [tapered, straight]) {
      b.addEventListener("click", () => {
        store.beginEdit("shape");
        store.setField("shape", b.getAttribute("data-shape"));
        onStatus(b.getAttribute("data-shape") === "straight" ? "Straight part set to gap + sheet thickness." : "Straight part set to 0.");
      });
      b.addEventListener("focus", () => highlighter.setFocus("pinStraight"));
      b.addEventListener("blur", () => highlighter.clearFocus("pinStraight"));
    }
    rows.set("shape", { f, row, tapered, straight, note });
    return row;
  }

  function hubField(f) {
    const sel = h("select", { id: "f-hub", "aria-describedby": "h-hub" },
      h("option", { value: "gobilda", text: "goBILDA 32 mm hub" }), h("option", { value: "custom", text: "Custom" }));
    const row = h("div.field.lvl-expert", { "data-field": "hub", "data-hl": "hub" },
      h("div.f-top", h("label", { for: "f-hub" }, h("span.f-name", "Hub"), " ", h("span.f-term", "(preset)")),
        h("button.qmark", { type: "button", "aria-label": "What is Hub?", "data-explain": "hub", text: "?" })),
      h("div.f-row", sel), h("div.f-hint", { id: "h-hub" }, f.hint));
    sel.addEventListener("focus", () => { store.beginEdit("hub"); highlighter.setFocus("hub"); });
    sel.addEventListener("blur", () => highlighter.clearFocus("hub"));
    sel.addEventListener("change", () => store.setField("hub", sel.value));
    rows.set("hub", { f, row, sel });
    return row;
  }

  function checkField(f) {
    const cb = h("input", { type: "checkbox", id: "f-" + f.key });
    const row = h("div.field.check.lvl-expert", { "data-field": f.key, "data-hl": f.key },
      h("div.f-row", cb, h("label", { for: "f-" + f.key }, h("span.f-name", f.name), " ", h("span.f-term", "(" + f.term + ")")),
        h("button.qmark", { type: "button", "aria-label": "What is " + f.name + "?", "data-explain": f.key, text: "?" })),
      h("div.f-hint", f.hint));
    cb.addEventListener("focus", () => { store.beginEdit(f.key); highlighter.setFocus(f.key); });
    cb.addEventListener("blur", () => highlighter.clearFocus(f.key));
    cb.addEventListener("change", () => {
      if (isLocked(store.design, f.key)) { cb.checked = !!store.design[f.key]; onStatus("Set Hub to Custom to change the hub settings."); return; }
      store.setField(f.key, cb.checked);
    });
    rows.set(f.key, { f, row, cb });
    return row;
  }

  // ---- build ----
  pane.innerHTML = "";
  if (examples && examples.length) {
    const box = h("fieldset.group.try-box", h("legend", "Try these"));
    const row = h("div.try");
    for (const ex of examples) {
      const b = h("button", { type: "button", "data-example": ex.id, title: ex.look }, ex.name);
      b.addEventListener("click", () => onExample(ex.id));
      row.appendChild(b);
    }
    box.append(row, h("p.f-hint", "Each one loads a teaching design. Badges show what changed."));
    pane.appendChild(box);
  }
  const groupBoxes = {};
  for (const g of GROUPS) {
    const fs = h("fieldset.group", { "data-group": g.id }, h("legend", g.title));
    if (g.level === "expert") fs.classList.add("lvl-expert");
    groupBoxes[g.id] = fs;
  }
  for (const f of FIELDS) {
    const el = f.type === "shape" ? shapeField(f) : f.type === "hub" ? hubField(f) : f.type === "check" ? checkField(f) : numField(f);
    groupBoxes[f.group].appendChild(el);
  }
  const studentNote = h("p.student-note", "More settings (gap, tip, hub, drill guide, CNC sheet) are in Expert detail. Pick View ▸ Expert detail.");
  pane.append(...GROUPS.map(g => groupBoxes[g.id]), studentNote);

  pane.addEventListener("click", e => {
    const q = e.target.closest(".qmark");
    if (q) onExplain(q.getAttribute("data-explain"), q);
  });

  // ---- paint ----
  function paintOne(key, vm) {
    const r = rows.get(key); if (!r) return;
    const d = store.design;
    if (r.input) {
      const locked = isLocked(d, key);
      r.input.readOnly = locked;
      r.row.classList.toggle("locked", locked);
      if (r.lock) r.lock.hidden = !locked;
      if (typing !== key) { r.input.value = displayValue(key, vm); r.input.classList.remove("partial"); }
      if (key === "travel") {
        r.unit.textContent = "";
        for (const b of r.unitBtns.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.getAttribute("data-u") === store.settings.units));
      }
      if (r.auto) r.auto.checked = d[key] == null;
      const edited = vm.edited(key) || (key === "travel" && vm.edited("travel"));
      r.row.classList.toggle("changed", edited);
      r.input.title = edited ? "You changed this" : "";
      const b = edited ? null : vm.badge(badgeKey(key));
      r.slot.textContent = b ? b.text : "";
      r.slot.className = "bdg-slot" + (b ? " bdg " + b.cls : "");
      if (b) r.slot.setAttribute("aria-label", b.aria); else r.slot.removeAttribute("aria-label");
      const bad = vm.model.ok ? false : vm.model.errors.some(e => e.startsWith(FIELD[key].name));
      r.input.classList.toggle("bad", bad);
      r.input.setAttribute("aria-invalid", String(bad));
    } else if (r.tapered) {
      r.tapered.setAttribute("aria-pressed", String(d.shape === "tapered"));
      r.straight.setAttribute("aria-pressed", String(d.shape === "straight"));
      r.note.textContent = d.shape === "custom" ? "Custom shape" : "";
    } else if (r.sel) {
      r.sel.value = d.hub;
    } else if (r.cb) {
      r.cb.checked = !!d[key];
      r.row.classList.toggle("locked", isLocked(d, key));
    }
  }

  function paint(vm) { for (const key of rows.keys()) paintOne(key, vm); }

  return {
    paint,
    focusField(key) {
      const r = rows.get(key);
      if (!r) return false;
      const el = r.input || r.sel || r.cb || r.tapered;
      if (el) { el.focus(); if (el.select) el.select(); return true; }
      return false;
    },
    rowOf: key => rows.get(key) && rows.get(key).row,
    get typing() { return typing; },
    isVisible(key) {
      const r = rows.get(key);
      return !!r && r.row.offsetParent !== null;
    }
  };
}

module.exports = { createInputs };
