"use strict";
// "How it works": a tiny loop of one pin pushing the sheet. It only moves
// after "Show me" is pressed, and stays still when motion is turned off.
const { Sketch, D2R, n } = require("./svg.js");

const R = 30, N = 12, STEP = 360 / N, PIN = 2.6, SHEET_T = 1.8;
const P = 2 * Math.PI * (R + PIN * 0.45) / N; // hole spacing to match the wheel

function frame(theta) {
  const sk = new Sketch({ scale: 4, id: "how" });
  const Rp = R + PIN * 0.45, yb = Rp - SHEET_T / 2;
  sk.grow(-28, R - 8); sk.grow(28, yb + SHEET_T + 3);
  const slide = Rp * theta * D2R;
  // sheet with holes, sliding
  const pieces = [];
  for (let k = -12; k <= 12; k++) {
    const c = k * P + (slide % P), a = c + 1.4, b = c + P - 1.4;
    pieces.push('<rect class="sheet" x="' + n(a) + '" y="' + n(-(yb + SHEET_T)) + '" width="' + n(b - a) + '" height="' + n(SHEET_T) + '"/>');
  }
  sk.push(pieces.join(""));
  // wheel and pins, turning
  const rot = theta % STEP;
  let pins = "";
  for (let j = 0; j < N; j++) {
    const a = (j * STEP + rot - 90) * D2R;
    const x = (R + PIN / 2) * Math.cos(a), y = (R + PIN / 2) * Math.sin(a);
    const lead = j === 0 ? " lead" : "";
    pins += '<rect class="pin' + lead + '" x="' + n(-1.1) + '" y="' + n(-PIN / 2 - 0.3) + '" width="2.2" height="' + n(PIN + 0.6) + '" rx="0.9" transform="translate(' + n(x) + " " + n(y) + ") rotate(" + n(a / D2R + 90) + ')"/>';
  }
  sk.push('<circle class="drum" cx="0" cy="0" r="' + R + '"/>' + pins);
  sk.push('<text class="lbl how-t" x="22" y="' + n(-(yb + SHEET_T) - 1) + '" font-size="3.4" text-anchor="end">sheet →</text>');
  return sk;
}

function mount(box, button, { motionOk }) {
  let raf = 0, t0 = 0, playing = false;
  const draw = theta => {
    const sk = frame(theta);
    box.innerHTML = sk.svg({ cls: "how-svg", label: "A pin on the wheel pushes the sheet one hole along", padPx: 2 });
  };
  draw(STEP * 0.35);
  function stop() {
    playing = false; cancelAnimationFrame(raf);
    button.setAttribute("aria-pressed", "false"); button.textContent = "▶ Show me";
  }
  button.addEventListener("click", () => {
    if (playing) { stop(); return; }
    if (!motionOk()) { draw(STEP * 0.7); button.textContent = "▶ Show me (motion is off)"; return; }
    playing = true; t0 = performance.now();
    button.setAttribute("aria-pressed", "true"); button.textContent = "❚❚ Stop";
    const step = now => {
      if (!playing) return;
      const t = (now - t0) / 1000;
      draw(t * 20);
      if (t > 20) { stop(); return; }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  });
  return { stop };
}

module.exports = { mount, frame };
