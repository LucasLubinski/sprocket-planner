"use strict";
// Summary line, key facts with badges, status chips and the warnings list.
const { h } = require("./dom.js");
const { svgIcon } = require("./icons.js");
const F = require("../core/format.js");

const LEVEL_ICON = { ok: "ok", warn: "warn", stop: "stopSign" };
const LEVEL_WORD = { ok: "OK", warn: "Warning", stop: "Problem" };
const CHIP_KEYS = { holes: "play holeD pinW", fit: "tight", web: "web teeth", hub: "drumD hubMinD boltSquare", inSheet: "inSheet", servo: "rotation", height: "gap" };

function turnText(vm) {
  const p = vm.design;
  const turn = F.trim(p.rotation, 2) + "°";
  const slide = vm.settings.units === "in" ? F.trim(p.travel / 25.4, 3) + " in" : F.trim(p.travel, 2) + " mm";
  return { turn, slide };
}

function renderSummary(els, vm) {
  const m = vm.model;
  const { turn, slide } = turnText(vm);
  els.summary.textContent = "";
  els.summary.append("Turning ", h("b", turn), " moves the sheet ", h("b", slide), ".");
  els.facts.innerHTML = "";
  if (m.ok) {
    const facts = [
      ["drumD", vm.word("Wheel size", "Drum diameter"), vm.num("drumD") + " mm"],
      ["P", vm.word("Holes", "Pitch"), vm.num("P") + " mm apart"],
      ["holes", vm.word("Holes to drill", "Holes needed"), vm.num("holes")],
      ["web", vm.word("Plastic between holes", "Web"), vm.num("web") + " mm"],
      ["play", vm.word("Wiggle room", "Play"), "±" + vm.num("play") + " mm"],
      ["tight", vm.word("Squeeze room", "Clearance"), vm.num("tight") + " mm"]
    ];
    for (const [key, name, val] of facts) {
      const b = vm.badge(key);
      els.facts.appendChild(h("li", { "data-hl": key }, name + " ", h("b", val), b ? h("span", { class: "bdg " + b.cls, "aria-label": b.aria }, " " + b.text) : null));
    }
  }
  els.chips.innerHTML = "";
  for (const c of m.chips || []) {
    els.chips.appendChild(h("li", { class: "chip " + c.level, "data-hl": CHIP_KEYS[c.id] || c.id, title: LEVEL_WORD[c.level] },
      h("span.chip-ic", { html: svgIcon(LEVEL_ICON[c.level], 16) }), h("span.sr-only", LEVEL_WORD[c.level] + ": "), c.text));
  }
  els.warnings.innerHTML = "";
  for (const c of m.checks || []) {
    els.warnings.appendChild(h("li", { class: "warn-item " + c.level },
      h("span.w-ic", { html: svgIcon(LEVEL_ICON[c.level], 16) }),
      h("span", h("b", (c.level === "stop" ? "Problem: " : "Warning: ") + c.title + ". "), c.text)));
  }
}

function statusText(vm) {
  const { turn, slide } = turnText(vm);
  const c = vm.model.counts || { stop: 0, warn: 0 };
  const n = c.stop + c.warn;
  return {
    turn: "Turn " + turn + " → slide " + slide,
    warnings: n === 0 ? "No warnings" : n + (n === 1 ? " warning" : " warnings") + (c.stop ? " (" + c.stop + " must be fixed)" : ""),
    level: c.stop ? "stop" : c.warn ? "warn" : "ok"
  };
}

module.exports = { renderSummary, statusText, turnText, LEVEL_ICON };
