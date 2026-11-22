"use strict";
// "?" explainers: a short explanation and a tiny animation for every setting.
// The animation runs only while the explainer is open (opening it is the
// press), and stays still when motion is off.
const { h } = require("./dom.js");
const { openDialog } = require("./dialogs.js");
const { FIELD, METRICS } = require("../state/fields.js");

const W = 220, H = 110;
const r1 = v => Math.round(v * 10) / 10;
const ping = (t, period) => 0.5 - 0.5 * Math.cos(2 * Math.PI * t / period); // 0..1..0
const C = { ink: "var(--ink)", part: "var(--part)", edge: "var(--part-edge)", plastic: "var(--plastic)", plasticEdge: "var(--plastic-edge)", hl: "var(--hl)", pitch: "var(--pitch)" };

function wheel(cx, cy, r, n, rot, pinH = 6, pinW = 5) {
  let s = '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + C.part + '" stroke="' + C.edge + '"/>';
  for (let j = 0; j < n; j++) {
    const a = (j * 360 / n + rot) * Math.PI / 180;
    const x = cx + (r + pinH / 2) * Math.sin(a), y = cy - (r + pinH / 2) * Math.cos(a);
    s += '<rect x="' + r1(-pinW / 2) + '" y="' + r1(-pinH / 2 - 1) + '" width="' + pinW + '" height="' + (pinH + 1) + '" rx="2" fill="' + (j === 0 ? "var(--index)" : "var(--pin)") + '" stroke="' + C.edge + '" transform="translate(' + r1(x) + " " + r1(y) + ") rotate(" + r1(a * 180 / Math.PI) + ')"/>';
  }
  return s;
}
function holesBar(x0, y, len, P, hole, shift = 0) {
  let s = '<rect x="' + x0 + '" y="' + y + '" width="' + len + '" height="12" fill="' + C.plastic + '" stroke="' + C.plasticEdge + '"/>';
  for (let x = x0 + ((shift % P) + P) % P; x <= x0 + len; x += P) s += '<circle cx="' + r1(x) + '" cy="' + (y + 6) + '" r="' + hole + '" fill="var(--paper)" stroke="' + C.plasticEdge + '"/>';
  return s;
}
function label(x, y, text, anchor = "middle") {
  return '<text x="' + x + '" y="' + y + '" font-size="14" text-anchor="' + anchor + '" fill="' + C.ink + '" class="lbl">' + text + "</text>";
}

const ANIMS = {
  // a sprocket turning clockwise: the pie on the drum and the arrow outside it
  // grow with the turn, and the dark index pin rides along the pie's edge
  turn: t => {
    const f = Math.min((t * 90) % 420, 360);
    const cx = 110, cy = 56, r = 30, ra = 44, end = f * Math.PI / 180, large = f > 180 ? 1 : 0;
    const at = rr => r1(cx + rr * Math.sin(end)) + " " + r1(cy - rr * Math.cos(end));
    const pie = f >= 359.9 ? '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + C.hl + '" opacity=".35"/>' :
      f > 0.5 ? '<path d="M' + cx + " " + cy + " L" + cx + " " + (cy - r) + " A" + r + " " + r + " 0 " + large + " 1 " + at(r) + ' Z" fill="' + C.hl + '" opacity=".35"/>' : "";
    // arrow along the outside: a full ring once the turn reaches 360°
    let arc = "";
    if (f >= 359.9) arc = '<circle cx="' + cx + '" cy="' + cy + '" r="' + ra + '" fill="none" stroke="' + C.hl + '" stroke-width="2.5"/>';
    else if (f > 0.5) arc = '<path d="M' + cx + " " + (cy - ra) + " A" + ra + " " + ra + " 0 " + large + " 1 " + at(ra) + '" fill="none" stroke="' + C.hl + '" stroke-width="2.5"/>';
    if (f > 0.5) {
      const ex = cx + ra * Math.sin(end), ey = cy - ra * Math.cos(end);
      const tx = Math.cos(end), ty = Math.sin(end), nx = Math.sin(end), ny = -Math.cos(end);
      arc += '<path d="M' + r1(ex + 6 * tx) + " " + r1(ey + 6 * ty) + " L" + r1(ex - 3 * tx + 5 * nx) + " " + r1(ey - 3 * ty + 5 * ny) +
        " L" + r1(ex - 3 * tx - 5 * nx) + " " + r1(ey - 3 * ty - 5 * ny) + ' Z" fill="' + C.hl + '"/>';
    }
    const start = '<path d="M' + cx + " " + (cy - r + 4) + " V" + (cy - ra - 6) + '" stroke="' + C.ink + '" stroke-dasharray="2 2"/>';
    return wheel(cx, cy, r, 16, f, 6, 4) + pie + start + arc +
      '<circle cx="' + cx + '" cy="' + cy + '" r="17" fill="var(--paper)" stroke="' + C.edge + '"/>' + label(cx, cy + 5, Math.round(f) + "°");
  },
  slide: t => {
    const s = 60 * ping(t, 3);
    return holesBar(20 + s, 40, 120, 20, 4) + '<path d="M20 80 H' + r1(20 + s) + '" stroke="' + C.hl + '" stroke-width="3"/>' +
      '<path d="M' + r1(14 + s) + " 74 L" + r1(22 + s) + " 80 L" + r1(14 + s) + ' 86" fill="none" stroke="' + C.hl + '" stroke-width="3"/>' + label(110, 104, "slide");
  },
  pins: t => {
    const counts = [8, 12, 16, 24], n = counts[Math.floor(t / 1.6) % 4];
    return wheel(60, 62, 30, n, 0, 7, 4) + holesBar(110, 30, 100, 2 * Math.PI * 34 / n, 2.6) + label(160, 70, n + " pins") + label(160, 90, "closer holes");
  },
  spacing: t => {
    const g = 0.5 + 0.5 * ping(t, 2);
    return holesBar(10, 40, 200, 50, 8) + '<path d="M35 30 H85" stroke="' + C.hl + '" stroke-width="' + (2 + 2 * g) + '"/>' +
      '<path d="M35 24 V36 M85 24 V36" stroke="' + C.hl + '" stroke-width="2"/>' + label(60, 20, "center to center") + label(110, 86, "hole spacing");
  },
  play: t => {
    const dx = 7 * Math.sin(t * 3);
    return '<rect x="20" y="30" width="70" height="20" fill="' + C.plastic + '" stroke="' + C.plasticEdge + '"/><rect x="130" y="30" width="70" height="20" fill="' + C.plastic + '" stroke="' + C.plasticEdge + '"/>' +
      '<rect x="' + r1(93 + dx) + '" y="14" width="34" height="62" rx="14" fill="var(--pin)" stroke="' + C.edge + '"/>' +
      '<rect x="10" y="76" width="200" height="14" fill="' + C.part + '" stroke="' + C.edge + '"/>' + label(110, 106, "wiggle room");
  },
  gap: t => {
    const g = 6 + 10 * ping(t, 3);
    return '<rect x="10" y="80" width="200" height="16" fill="' + C.part + '" stroke="' + C.edge + '"/>' +
      '<rect x="10" y="' + r1(80 - g - 14) + '" width="200" height="14" fill="' + C.plastic + '" stroke="' + C.plasticEdge + '"/>' +
      '<path d="M190 ' + r1(80 - g) + ' V80" stroke="' + C.hl + '" stroke-width="3"/>' + label(110, 24, "sheet thickness and gap");
  },
  roll: t => {
    const x = 40 + (t * 40) % 140, rot = (x - 40) / 30 * 180 / Math.PI;
    return '<path d="M10 90 H210" stroke="' + C.plasticEdge + '" stroke-width="3"/><path d="M40 98 H' + r1(x) + '" stroke="' + C.hl + '" stroke-width="3"/>' +
      '<g transform="translate(' + r1(x) + ' 60) rotate(' + r1(rot) + ')"><circle r="30" fill="none" stroke="' + C.pitch + '" stroke-width="2" stroke-dasharray="8 3 2 3"/><path d="M0 0 V30" stroke="' + C.hl + '" stroke-width="3"/></g>' +
      label(110, 18, "push circle rolling along the sheet");
  },
  drum: t => wheel(110, 60, 36, 16, t * 30, 6, 4) + '<path d="M' + r1(110 - 36) + ' 60 H' + r1(110 + 36) + '" stroke="' + C.hl + '" stroke-width="3"/>' + label(110, 108, "wheel size, no pins"),
  pinshape: t => {
    const k = ping(t, 3), a = 4 + 22 * k, top = 22;
    const d = "M80 92 L80 " + r1(50 - 18 * (1 - k)) + " Q" + r1(80 + a) + " " + top + " 110 " + top + " Q" + r1(140 - a) + " " + top + " 140 " + r1(50 - 18 * (1 - k)) + " L140 92 Z";
    return '<path d="' + d + '" fill="var(--pin)" stroke="' + C.edge + '"/><rect x="40" y="92" width="140" height="12" fill="' + C.part + '" stroke="' + C.edge + '"/>' + label(110, 14, k > 0.5 ? "straight sides" : "tapered sides");
  },
  flat: t => {
    const f = 22 * ping(t, 3);
    return '<circle cx="110" cy="56" r="34" fill="var(--pin)" stroke="' + C.edge + '"/>' +
      '<rect x="60" y="0" width="100" height="' + r1(22 + f * 0.3 - 0) + '" fill="var(--paper)"/><rect x="60" y="' + r1(90 - f * 0.3) + '" width="100" height="30" fill="var(--paper)"/>' +
      '<path d="M60 ' + r1(22 + f * 0.3) + ' H160 M60 ' + r1(90 - f * 0.3) + ' H160" stroke="' + C.hl + '" stroke-width="2"/>' + label(110, 108, "trimmed flat to print");
  },
  hub: t => {
    let s = '<g transform="rotate(' + r1(t * 25) + ' 110 56)"><circle cx="110" cy="56" r="44" fill="' + C.part + '" stroke="' + C.edge + '"/>';
    for (const a of [45, 135, 225, 315]) { const r = a * Math.PI / 180; s += '<circle cx="' + r1(110 + 22 * Math.cos(r)) + '" cy="' + r1(56 + 22 * Math.sin(r)) + '" r="5" fill="var(--paper)" stroke="' + C.edge + '"/>'; }
    return s + '<circle cx="110" cy="56" r="9" fill="var(--paper)" stroke="' + C.edge + '"/></g><circle cx="110" cy="56" r="34" fill="none" stroke="#0060ff" stroke-dasharray="6 3"/>' + label(110, 108, "four screws on a square");
  },
  edge: t => {
    const y = 18 * (1 - ping(t, 3));
    return '<rect x="30" y="70" width="160" height="26" fill="#d8d8d8" stroke="' + C.edge + '"/><rect x="88" y="70" width="44" height="8" fill="var(--paper)" stroke="' + C.edge + '"/>' +
      '<g transform="translate(0 ' + r1(-y) + ')"><rect x="40" y="40" width="140" height="22" fill="' + C.part + '" stroke="' + C.edge + '"/><rect x="90" y="62" width="40" height="8" fill="' + C.hl + '" opacity=".6" stroke="' + C.edge + '"/></g>' + label(110, 20, "sprocket drops onto the hub");
  },
  guide: t => {
    const k = Math.floor(t * 1.2) % 6, x = 30 + k * 32, dy = 10 * ping(t * 1.2 % 1, 1);
    return holesBar(14, 60, 192, 32, 5) + '<rect x="14" y="54" width="192" height="6" fill="#e8e0c8" stroke="' + C.edge + '"/>' +
      '<rect x="' + (x - 3) + '" y="' + r1(18 + dy) + '" width="6" height="36" fill="#909090" stroke="' + C.edge + '"/>' + label(110, 100, "drill through each guide hole");
  },
  sheet: t => {
    const n = 1 + Math.floor(t * 2) % 7;
    let s = '<rect x="15" y="25" width="190" height="56" fill="' + C.plastic + '" stroke="#0000ff"/>';
    for (let i = 0; i < n; i++) s += '<circle cx="' + (35 + i * 25) + '" cy="53" r="6" fill="var(--paper)" stroke="#ff0000"/>';
    return s + label(110, 104, "outline (blue) and holes (red)");
  },
  track: t => {
    const dx = 8 * Math.sin(t * 2);
    return '<path d="M30 30 H70 V50 H150 V30 H190 V90 H30 Z" fill="#d0c8b0" stroke="' + C.edge + '"/>' +
      '<rect x="' + r1(62 + dx) + '" y="56" width="96" height="10" fill="' + C.plastic + '" stroke="' + C.plasticEdge + '"/>' +
      '<rect x="60" y="54" width="100" height="14" fill="none" stroke="' + C.hl + '" stroke-dasharray="4 3"/>' + label(110, 108, "sheet sliding in its slot");
  }
};

function explainFor(key) {
  const f = FIELD[key];
  if (f && f.explain) return { title: f.name + " (" + f.term + ")", lines: f.explain.text, anim: f.explain.anim, hint: f.hint };
  const m = METRICS[key];
  if (m) return { title: m.name + (m.term ? " (" + m.term + ")" : ""), lines: [hintFor(key)].filter(Boolean), anim: null };
  return null;
}
function hintFor(key) {
  return {
    play: "The space between a pin and its hole, on each side.",
    tight: "The closest a pin gets to a hole edge while the wheel turns.",
    web: "The plastic left between two holes. Thin plastic can crack.",
    inSheet: "How many pins poke into the sheet at the same time.",
    holes: "How many holes to drill for the full slide.",
    hubMinD: "The smallest wheel that still has room for the hub screws."
  }[key] || "";
}

function openExplainer(key, { motionOk }) {
  const ex = explainFor(key);
  if (!ex) return null;
  const svgBox = h("div.ex-anim");
  let raf = 0, t0 = performance.now(), open = true;
  const paint = t => { svgBox.innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="Small animation for ' + ex.title + '">' + ANIMS[ex.anim](t) + "</svg>"; };
  if (ex.anim && ANIMS[ex.anim]) {
    paint(1.2);
    if (motionOk()) {
      const step = now => { if (!open) return; paint((now - t0) / 1000); raf = requestAnimationFrame(step); };
      raf = requestAnimationFrame(step);
    }
  }
  return openDialog({
    title: ex.title, cls: "explainer",
    body: h("div.ex", ex.anim ? svgBox : null, h("div.ex-text", ex.lines.map(t => h("p", t)), ex.hint && !ex.lines.includes(ex.hint) ? h("p.term", ex.hint) : null)),
    buttons: [{ label: "OK", value: "ok", primary: true }],
    onClose: () => { open = false; cancelAnimationFrame(raf); }
  });
}

// Title-bar "?": click it, then click any part of the window to explain it.
function whatsThis(root, { onPick, onChange }) {
  let on = false;
  function set(v) { on = v; document.body.classList.toggle("whats-this", on); onChange(on); }
  root.addEventListener("click", e => {
    if (!on) return;
    if (e.target.closest("#tb-help")) return;
    const el = e.target.closest("[data-explain], [data-field], [data-hl], svg.drw [data-key]");
    e.preventDefault(); e.stopPropagation();
    set(false);
    if (!el) return;
    const keys = (el.getAttribute("data-explain") || el.getAttribute("data-field") || el.getAttribute("data-key") || el.getAttribute("data-hl") || "").split(/\s+/);
    const key = keys.find(k => explainFor(k)) || null;
    if (key) onPick(key);
  }, true);
  document.addEventListener("keydown", e => { if (on && e.key === "Escape") set(false); });
  return { toggle() { set(!on); }, get on() { return on; }, set };
}

module.exports = { openExplainer, whatsThis, explainFor, ANIMS };
