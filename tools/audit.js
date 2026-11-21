// Runs inside the page (injected by test/ui.test.mjs and by hand): finds
// visible text under 13 px, and (on touch screens) controls smaller than a
// 44 px tap target. Returns short descriptions of each problem.
window.__audit = function ({ touch = false } = {}) {
  const out = [];
  const name = el => {
    const t = (el.getAttribute("aria-label") || el.textContent || el.value || "").trim().replace(/\s+/g, " ").slice(0, 30);
    return el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/)[0] : "") + (t ? ' "' + t + '"' : "");
  };
  const seen = new Set();
  // text: every element that directly holds visible text
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent.trim()) continue;
    const el = n.parentElement;
    if (!el || seen.has(el) || el.closest("svg, .sr-only, [aria-hidden=true] svg") || !el.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue;
    seen.add(el);
    const px = parseFloat(getComputedStyle(el).fontSize);
    if (px < 12.95) out.push("text " + px + "px: " + name(el));
  }
  // SVG labels: rendered size on screen
  for (const t of document.querySelectorAll("svg text")) {
    if (!t.textContent.trim() || !t.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue;
    const fs = parseFloat(t.getAttribute("font-size") || getComputedStyle(t).fontSize);
    const ctm = t.getScreenCTM();
    if (!ctm) continue;
    const px = fs * Math.hypot(ctm.a, ctm.b);
    if (px < 12.5) out.push("svg text " + px.toFixed(1) + "px: " + (t.closest("svg").classList[1] || "svg") + ' "' + t.textContent.trim().slice(0, 30) + '"');
  }
  if (touch) {
    for (const el of document.querySelectorAll("button, select, input:not([type=hidden]), [role=menuitem], [role=tab], a[href], .menu-btn")) {
      if (!el.checkVisibility({ visibilityProperty: true }) || el.closest("[hidden], .title-bar-controls")) continue;
      let r = el.getBoundingClientRect();
      if (el.type === "checkbox" || el.type === "radio") { const l = el.labels && el.labels[0]; if (!l) continue; r = l.getBoundingClientRect(); }
      if (r.width < 1) continue;
      if (r.height < 43.5 || r.width < 43.5) out.push("tap " + Math.round(r.width) + "x" + Math.round(r.height) + ": " + name(el));
    }
  }
  return [...new Set(out)];
};

// Accessibility basics: every visible control has a name, every drawing is an
// image with a description, keyboard focus is visible, and the page never
// scrolls sideways.
window.__a11y = function () {
  const out = [];
  const nameOf = el => {
    if (el.getAttribute("aria-label")) return el.getAttribute("aria-label");
    if (el.getAttribute("aria-labelledby")) return el.getAttribute("aria-labelledby").split(/\s+/).map(id => (document.getElementById(id) || {}).textContent || "").join(" ").trim();
    if (el.labels && el.labels.length) return [...el.labels].map(l => l.textContent).join(" ").trim();
    if (el.title) return el.title;
    return (el.textContent || "").trim();
  };
  for (const el of document.querySelectorAll("button, input:not([type=hidden]), select, textarea, [role=slider], [role=radio], [role=menuitem]")) {
    if (!el.checkVisibility({ visibilityProperty: true })) continue;
    if (!nameOf(el)) out.push("no name: " + el.outerHTML.slice(0, 80));
  }
  for (const svg of document.querySelectorAll("svg.drw")) {
    if (!svg.checkVisibility()) continue;
    if (svg.getAttribute("role") !== "img" || !svg.getAttribute("aria-label")) out.push("drawing without a description: " + svg.getAttribute("class"));
  }
  const se = document.scrollingElement;
  if (se.scrollWidth > window.innerWidth + 1) out.push("sideways scroll: " + se.scrollWidth + " > " + window.innerWidth);
  return out;
};
// Focus ring: the outline a focused control draws.
window.__focusRing = function (el) {
  el.focus();
  const cs = getComputedStyle(el);
  return { outline: cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0, shadow: cs.boxShadow !== "none" };
};
