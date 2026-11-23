"use strict";
// "Make it": the Part choice, Copy OpenSCAD file / Copy settings only, the
// sheet SVG and DXF files for CNC, the track box, and the help dialogs for
// getting a part into OpenSCAD and a slicer.
const { h, download } = require("./dom.js");
const D = require("./dialogs.js");
const { scadFile, scadSettings } = require("../core/scad.js");
const { sheetSVG, sheetDXF, fileName } = require("../core/sheetfiles.js");
const { svgIcon } = require("./icons.js");

// Copy from a button click. Try the clipboard, then the old copy command,
// then show the text with a Select all button so Ctrl+C works.
async function copyText(text, title) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); return "clipboard"; }
  } catch (e) { /* blocked: try the next way */ }
  try {
    const ta = h("textarea", { readonly: true, style: { position: "fixed", left: "-9999px", top: "0" } });
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand && document.execCommand("copy");
    ta.remove();
    if (ok) return "execCommand";
  } catch (e) { /* blocked too */ }
  D.copyFallback(title, text);
  return "dialog";
}

const partName = part => part === "drill_guide" ? "drill guide" : "sprocket";

function createExport(box, { store, getVM, setStatus }) {
  const model = () => getVM().model;
  // Problems OpenSCAD will stop on: the page says so before copying.
  function stopNote() {
    const m = model();
    if (!m.ok) return " The design has numbers to fix first; OpenSCAD will stop on them.";
    const n = m.counts.stop;
    return n ? " Note: " + n + (n === 1 ? " problem needs" : " problems need") + " fixing. OpenSCAD will report " + (n === 1 ? "it." : "them.") : "";
  }
  const api = {
    async copyScad() {
      const part = store.settings.part;
      const how = await copyText(scadFile(store.design, part), "Copy OpenSCAD file (" + partName(part) + ")");
      if (how !== "dialog") setStatus("Copied the OpenSCAD file for the " + partName(part) + ". Paste it into OpenSCAD." + stopNote());
      return how;
    },
    async copySettings() {
      const part = store.settings.part;
      const how = await copyText(scadSettings(store.design, part), "Copy settings only (" + partName(part) + ")");
      if (how !== "dialog") setStatus("Copied the settings. Paste them over the top of the OpenSCAD file." + stopNote());
      return how;
    },
    saveSVG() { return saveSheet("svg"); },
    saveDXF() { return saveSheet("dxf"); },
    stlHelp() {
      D.openDialog({
        title: "How to make the STL",
        cls: "wide helpdlg",
        body: h("div.help",
          h("p", "OpenSCAD turns the copied file into a part you can print. It is free and needs no internet."),
          h("ol",
            h("li", "Pick Sprocket or Drill guide, then press ", h("b", "Copy OpenSCAD file"), "."),
            h("li", "Open OpenSCAD. Choose ", h("b", "File > New"), "."),
            h("li", "Click in the left side and press ", h("b", "Ctrl+V"), " to paste."),
            h("li", "Press ", h("b", "F6"), " to render. Wait for it to finish."),
            h("li", "Read the console at the bottom. It lists the hole spacing and the screws to buy."),
            h("li", "Choose ", h("b", "File > Export > Export as STL"), " and save it."),
            h("li", "Open the STL in your slicer (PrusaSlicer, Cura or Bambu Studio). It prints flat with no supports.")),
          h("p.term", "Already have the file open? Use Copy settings only and paste over the lines at the top."),
          h("p.term", "If OpenSCAD shows a red ERROR, it names the problem in plain words. The same warning shows here too.")),
        buttons: [{ label: "OK", value: "ok", primary: true }]
      });
    },
    howToUse() {
      D.openDialog({
        title: "How to use Sprocket Planner",
        cls: "wide helpdlg",
        body: h("div.help",
          h("ol",
            h("li", "Type how far the wheel ", h("b", "turns"), " and how far the sheet ", h("b", "slides"), "."),
            h("li", "Watch the pictures change. Green ▲ and red ▼ badges show what went up or down."),
            h("li", "Click any box. Its part lights up in every drawing. Press ", h("b", "?"), " to learn what it means."),
            h("li", "Check the ", h("b", "fit meters"), ". Green is good. Red needs a fix, and the warning says how."),
            h("li", "Press ", h("b", "Play"), " to watch the pins push the sheet."),
            h("li", h("b", "Save design"), " to keep it. It gets its own tab, and you can change it there. Check two Compare boxes to see designs side by side."),
            h("li", "Lock a box with its padlock to keep that number while you change others."),
            h("li", "When it looks good, use ", h("b", "Make it"), " to copy the OpenSCAD file and save the sheet files.")),
          h("p.term", "Try the buttons under Try these to see what goes wrong, and why.")),
        buttons: [{ label: "OK", value: "ok", primary: true }]
      });
    },
    render(vm) { paint(vm); }
  };

  function saveSheet(kind) {
    const m = model();
    if (!m.ok) { D.messageBox("Save sheet " + kind.toUpperCase(), ["Fix the red boxes first. Then the sheet can be saved."], svgIcon("stopSign", 16)); return null; }
    const name = fileName(m.p, m.d, kind);
    if (kind === "svg") download(name, sheetSVG(m.p, m.d), "image/svg+xml");
    else download(name, sheetDXF(m.p, m.d), "application/dxf");
    setStatus("Saved " + name + ". Look in your Downloads folder.");
    return name;
  }

  // ---------- the box ----------
  const partRadios = ["sprocket", "drill_guide"].map(v => {
    const id = "part-" + v;
    const input = h("input", { type: "radio", name: "part", id, value: v });
    input.addEventListener("change", () => { if (input.checked) store.setSettings({ part: v }); });
    return { v, input, el: h("div.field-row", input, h("label", { for: id }, v === "sprocket" ? "Sprocket" : "Drill guide")) };
  });
  const btn = (label, cmd, iconName) => {
    const b = h("button", { type: "button", "data-cmd": cmd }, iconName ? h("span.btn-ic", { html: svgIcon(iconName, 16) }) : null, label);
    b.addEventListener("click", () => api[cmd]());
    return b;
  };
  const scadNote = h("p.hint");
  const sheetNote = h("p.hint");
  const trackList = h("dl.trackbox", { id: "trackbox", "aria-label": "Track sizes" });

  box.innerHTML = "";
  box.append(
    h("div.exp-col",
      h("h3", "3D print (OpenSCAD)"),
      h("fieldset.part-pick", h("legend", "Part"), partRadios.map(r => r.el)),
      h("div.exp-btns", btn("Copy OpenSCAD file", "copyScad", "scad"), btn("Copy settings only", "copySettings", "settingsCopy")),
      scadNote,
      h("div.exp-btns", btn("How to make the STL…", "stlHelp"))),
    h("div.exp-col",
      h("h3", "Sheet for CNC cutting"),
      h("div.exp-btns", btn("Save sheet SVG", "saveSVG", "svg"), btn("Save sheet DXF", "saveDXF", "dxf")),
      sheetNote,
      h("h3", "Track for the sheet"),
      trackList,
      h("figure.drawbox", h("div.drawing", { id: "d-track", tabindex: "-1" }), h("figcaption", "End view: the sheet in its track, with the sprocket below. Sizes in mm."))));

  function paint(vm) {
    for (const r of partRadios) r.input.checked = store.settings.part === r.v;
    const m = vm.model;
    scadNote.textContent = "Copies the whole " + partName(store.settings.part) + " file with your numbers filled in." +
      (m.ok && m.counts.stop ? " Fix the red warnings first, or OpenSCAD will stop." : "");
    sheetNote.textContent = m.ok ? "Files: " + fileName(m.p, m.d, "svg") + " and .dxf. True size in mm. Holes and outline are separate layers." : "Fix the red boxes to save the sheet.";
    trackList.innerHTML = "";
    if (!m.ok) return;
    for (const [key, name, hint] of [
      ["yb", "Shaft center to sheet underside", "Set the track this far above the servo shaft."],
      ["slotH", "Slot height", "Sheet thickness plus room to slide."],
      ["slotW", "Slot width", "Sheet width plus room to slide."],
      ["rowFromWall", "Slot wall to hole row", "Line the sprocket up with this."]
    ]) {
      const b = vm.badge(key);
      trackList.append(h("div.tb-row", { "data-hl": key },
        h("dt", name), h("dd", h("b", vm.num(key) + " mm"), b ? h("span", { class: "bdg " + b.cls, "aria-label": b.aria }, " " + b.text) : null, h("span.hint", " " + hint))));
    }
  }
  return api;
}

module.exports = { createExport, copyText };
