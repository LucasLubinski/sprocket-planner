"use strict";
// The right-hand pane: summary and chips, the big-picture visuals, fit
// meters, every drawing, saved designs and comparing, measurements, and the
// Make-it (export) box. This file only builds the boxes; main.js fills them.
const { h } = require("./dom.js");

function group(id, title, ...kids) {
  return h("fieldset.group.vgroup", { id }, h("legend", title), ...kids);
}

function drawingBox(id, caption) {
  return h("figure.drawbox", h("div.drawing", { id, tabindex: "-1" }), caption ? h("figcaption", caption) : null);
}

function buildViews(pane) {
  pane.innerHTML = "";
  const how = group("sec-how", "How it works",
    h("div.how",
      h("div.how-anim", { id: "how-anim" }),
      h("div.how-text",
        h("p", "Pins on the wheel poke up through holes in the plastic sheet."),
        h("p", "When the servo turns the wheel, the pins push the sheet along."),
        h("p", "One full turn slides the sheet by pins × hole spacing."),
        h("button.how-play", { type: "button", id: "how-play", "aria-pressed": "false" }, "▶ Show me"))));

  const summary = group("sec-summary", "Your design",
    h("p.summary", { id: "summary", "aria-live": "polite" }),
    h("ul.facts", { id: "facts" }),
    h("ul.chips", { id: "chips", "aria-label": "Checks" }),
    h("ul.warnings", { id: "warnings", "aria-label": "Warnings" }));

  const big = group("sec-big", "Turn → slide",
    h("div.bigpic",
      h("div.drawing.dialbox", { id: "d-dial" }),
      h("div.turnslide", { "aria-hidden": "true" }, h("span.ts-arrow", "→"), h("span.ts-word", "turn → slide")),
      h("div.drawing.rulerbox", { id: "d-ruler" })));

  const meters = group("sec-meters", "Fit meters", h("div.meters", { id: "meters" }));

  const layout = group("sec-layout", "Wheel and sheet, to scale",
    drawingBox("d-layout", "Side view. All sizes in mm. The dark pin is pin 1. The arrow follows one hole."),
    h("div.playbar",
      h("button.play-btn", { type: "button", id: "play", "aria-pressed": "false" }, "▶ Play"),
      h("label.sr-only", { for: "slider" }, "Wheel position"),
      h("input", { type: "range", id: "slider", min: "0", max: "360", step: "0.1", value: "0", "aria-describedby": "readout" }),
      h("output.readout", { id: "readout", for: "slider" })));

  const row1 = h("div.row2",
    group("sec-closeup", "Close-up where the pins meet the sheet", drawingBox("d-closeup", "Turn the wheel with the slider. The closest gap is marked.")),
    group("sec-pinhole", "One pin in its hole", drawingBox("d-pinhole", "Cut through the middle of one pin and hole.")));

  const chart = group("sec-chart", "Squeeze room while turning", drawingBox("d-chart", "Closest gap between a pin and a hole edge, over one pin step. The pattern repeats for every pin."));

  const row2 = h("div.rows",
    group("sec-hub", "Hub side of the sprocket", drawingBox("d-hubface", "Face view with the goBILDA hub in blue outline, and a cut through two bolt holes.")),
    group("sec-sheet", "Sheet pattern and drill guide", drawingBox("d-sheet", "Top view of the sheet for cutting, and the printed drill guide at the same scale.")));

  const saved = group("sec-saved", "Saved designs",
    h("p.storage-note", { id: "storage-note", hidden: true }),
    h("div.saved-actions",
      h("button", { type: "button", id: "btn-save" }, "Save design…"),
      h("button", { type: "button", id: "btn-savefile" }, "Save to a file…"),
      h("button", { type: "button", id: "btn-openfile" }, "Open a design file…"),
      h("input", { type: "file", id: "file-in", accept: ".json,application/json", hidden: true })),
    h("div.sunken-panel.saved-wrap", h("table.saved", { id: "saved-list" })),
    h("p.hint", "Check two to four Compare boxes to see them side by side."));

  const compare = group("sec-compare", "Compare",
    h("div.cmp-controls", { id: "cmp-controls" }),
    h("div.panels", { id: "panels" }),
    h("div.sunken-panel.tablewrap", h("table.cmp", { id: "compare-table" })));

  const measure = group("sec-measure", "Measurements",
    h("div.sunken-panel.tablewrap", h("table.measure", { id: "measure" })));

  const exportBox = group("sec-export", "Make it", h("div.export", { id: "export" }));

  pane.append(how, summary, big, meters, layout, row1, chart, row2, saved, compare, measure, exportBox);
}

module.exports = { buildViews };
