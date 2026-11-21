"use strict";
// Side-by-side panels: one small layout drawing per checked design, all at the
// same scale (same mm per pixel), each with its own sheet and holes. One
// slider turns them together, by the same turn or the same slide.
const G = require("../core/geometry.js");
const L = require("./layout.js");
const { Sketch, D2R, esc, n } = require("./svg.js");

// How far each design turns for a slider position f (0..1).
function positions(models, by, f) {
  if (by === "slide") {
    const S = f * Math.min(...models.map(m => m.p.travel));
    return models.map(m => ({ theta: S / m.d.Rp / D2R, slide: S }));
  }
  const th = f * Math.min(...models.map(m => m.p.rotation));
  return models.map(m => ({ theta: th, slide: m.d.Rp * th * D2R }));
}

function renderPanels(container, vm, entries) {
  const models = entries.map(e => e.m);
  const ok = models.every(m => m.ok);
  container.innerHTML = "";
  if (!ok) {
    container.textContent = "One of the checked designs has a problem number. Load it and fix it to compare.";
    return { animate() {} };
  }
  const colW = container.clientWidth >= 700 ? (container.clientWidth - 12) / 2 : container.clientWidth;
  const Rmax = Math.max(...models.map(m => m.d.tipR));
  const Tmax = Math.max(...models.map(m => m.p.travel));
  const topMax = Math.max(...models.map(m => m.d.yb + m.p.sheetT));
  const x0 = -Rmax - 6, x1 = Tmax + 10, y0 = -Rmax - 4;
  const scale = Math.max(0.5, (colW - 8) / (x1 - x0));
  const lane = 14 * 1.6 / scale;
  const y1 = topMax + lane * 1.6;
  const W = x1 - x0, H = y1 - y0;
  const dir = vm.dir;
  const views = [];
  entries.forEach((e, i) => {
    const m = e.m, p = m.p, d = m.d;
    const sk = new Sketch({ scale, dir, id: "pn" + i });
    // sheet
    const sp = L.sheetPieces(p, d, p.endMargin);
    sk.open({ class: "slide", "data-part": "sheet" });
    for (const [a, b] of sp.pieces) sk.rect(a, d.yb, b, d.yb + p.sheetT, "part sheet", { noGrow: true });
    sk.line(0, d.yb + p.sheetT + lane * 0.9, 0, d.yb + p.sheetT + 0.3, "follow-line", { noGrow: true });
    sk.arrow(0, d.yb + p.sheetT + 0.2, -90, "follow-arw", 9);
    sk.close();
    // end of this design's slide
    sk.line(p.travel, d.yb - 1, p.travel, d.yb + p.sheetT + lane, "endmark", { noGrow: true });
    sk.circle(0, 0, d.Rp, "part pitch", { noGrow: true });
    sk.open({ class: "turn", "data-part": "wheel" });
    L.drawWheel(sk, p, d, "wheel", false);
    for (const a of [45, 135, 225, 315]) sk.circle(d.boltR * Math.cos(a * D2R), d.boltR * Math.sin(a * D2R), p.boltHoleD / 2, "part bolt", { noGrow: true });
    sk.circle(0, 0, p.centerD / 2, "part hole-c", { noGrow: true });
    sk.close();
    const vx = dir > 0 ? x0 : -x1;
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" class="drw panel" viewBox="' + [vx, -y1, W, H].map(n).join(" ") +
      '" style="width:' + Math.round(W * scale) + 'px" role="img" aria-label="' + esc(e.name + " turning and sliding") + '">' + sk.out.join("") + "</svg>";
    const fig = document.createElement("figure");
    fig.className = "panel-fig";
    fig.innerHTML = '<figcaption class="panel-name">' + esc(e.name) + ' <span class="panel-sub">' + esc(e.sub || "") + '</span></figcaption><div class="drawing">' + svg + '</div><p class="panel-read" aria-live="off"></p>';
    container.appendChild(fig);
    views.push({ fig, m, read: fig.querySelector(".panel-read"), wheel: fig.querySelector('[data-part="wheel"]'), sheet: fig.querySelector('[data-part="sheet"]') });
  });
  return {
    scale,
    animate(f, by) {
      const pos = positions(models, by, f);
      views.forEach((v, i) => {
        const { theta, slide } = pos[i];
        v.wheel.setAttribute("transform", "rotate(" + (dir * theta).toFixed(3) + ")");
        v.sheet.setAttribute("transform", "translate(" + (dir * slide).toFixed(3) + " 0)");
        v.read.textContent = "Turned " + theta.toFixed(0) + "° · slid " + vm.fmtIn(slide);
      });
      return pos;
    }
  };
}

module.exports = { id: "panels", renderPanels, positions };
