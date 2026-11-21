// Runs inside the page (injected by test/ui.test.mjs): lists drawing labels
// that cover a pin or a hole. Each visible label's screen box is sampled on a
// grid, and every sample is tested against the real shape of each pin and hole
// (isPointInFill), honoring clip paths. Ghosts don't count.
window.__labelHits = function () {
  const hits = [];
  const toUser = (el, x, y) => new DOMPoint(x, y).matrixTransform(el.getScreenCTM().inverse());
  const clipOf = el => {
    for (let a = el.parentElement; a && a.tagName !== "svg"; a = a.parentElement) {
      const c = a.getAttribute("clip-path");
      if (c) { const id = /#([^)]+)/.exec(c); const cp = id && document.getElementById(id[1]); return cp && cp.querySelector("rect,path,circle,polygon"); }
    }
    return null;
  };
  const inside = (el, x, y) => el.isPointInFill(toUser(el, x, y));
  for (const svg of document.querySelectorAll("svg.drw")) {
    if (!svg.checkVisibility()) continue;
    const parts = [...svg.querySelectorAll(".pin, .hole, .hole-c, .hole-o")]
      .filter(el => el.isPointInFill && !el.closest(".ghost") && el.checkVisibility())
      .map(el => ({ el, clip: clipOf(el) }));
    for (const t of svg.querySelectorAll("text.lbl")) {
      if (t.closest(".ghost") || !t.checkVisibility() || !t.textContent.trim()) continue;
      const r = t.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      let hit = null;
      for (let i = 0; i <= 8 && !hit; i++) for (let k = 0; k <= 2 && !hit; k++) {
        const x = r.left + 1.5 + (r.width - 3) * i / 8, y = r.top + 2 + (r.height - 4) * k / 2;
        for (const { el, clip } of parts) {
          if (clip && !inside(clip, x, y)) continue;
          if (inside(el, x, y)) { hit = el; break; }
        }
      }
      if (hit) hits.push((svg.classList[1] || "svg") + ": \"" + t.textContent.trim() + "\" covers " + (hit.getAttribute("class") || hit.tagName));
    }
  }
  return hits;
};
