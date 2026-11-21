"use strict";
// Mounts each drawing module in its box, redraws it when the design or the
// box width changes, and turns it (by transforms only) when the wheel moves.
const { fit } = require("../draw/svg.js");

const MIRRORED = new Set(["layout", "closeup", "panels", "dial"]);

function createDrawing(container, mod, label) {
  let sk = null, svg = null, lastW = 0, custom = null;
  const api = {
    id: mod.id, mod, container, dims: [],
    get svg() { return svg; },
    get sketch() { return sk; },
    render(vm) {
      const w = Math.max(200, Math.floor(container.clientWidth || 600));
      lastW = w;
      if (mod.render) {
        custom = mod.render(container, vm);
        svg = container.querySelector("svg");
        sk = custom && custom.sketch || null;
        api.dims = custom && custom.dims || [];
      } else {
        const opts = { dir: MIRRORED.has(mod.id) ? vm.dir : 1, id: mod.id, ...(mod.fitOpts ? mod.fitOpts(vm, w) : {}) };
        sk = fit(w, s => mod.build(s, vm), opts);
        container.innerHTML = sk.svg({ cls: mod.id, label: typeof label === "function" ? label(vm) : label });
        svg = container.firstChild;
        svg.style.width = Math.min(w, Math.round(sk.view[2] * sk.s)) + "px";
        api.dims = sk.dims;
      }
      api.animate(vm, vm.theta);
    },
    animate(vm, theta) {
      if (custom && custom.animate) return custom.animate(theta);
      if (mod.animate && svg && sk) return mod.animate(svg, vm, theta, sk);
      return null;
    },
    widthChanged() { return Math.abs(Math.floor(container.clientWidth || 0) - lastW) > 3; },
    // world mm <-> client pixels, for drag handles
    toWorld(clientX, clientY) {
      if (!svg || !sk) return null;
      const pt = svg.createSVGPoint(); pt.x = clientX; pt.y = clientY;
      const ctm = svg.getScreenCTM(); if (!ctm) return null;
      const q = pt.matrixTransform(ctm.inverse());
      return [q.x / sk.dir, -q.y];
    }
  };
  return api;
}

module.exports = { createDrawing, MIRRORED };
