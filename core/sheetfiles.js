"use strict";
// The drilled polycarbonate sheet: its layout, and the SVG and DXF files for
// CNC cutting. All sizes in mm. Holes and outline go in separate named
// groups / layers with different colors, with no fills and no text.

// Where the holes sit on the sheet.
//   n      holes: guide_holes, or enough for the full travel (0 = automatic)
//   L, W   sheet length and width (length defaults to the row of holes plus
//          endMargin of plastic past the end holes' edges)
//   rowY   hole row's distance from the bottom edge (default: centered)
function sheetLayout(p, d) {
  const n = d.nGuide;
  const rowLen = (n - 1) * d.P;
  const autoLen = rowLen + p.holeD + 2 * p.endMargin;
  const L = p.sheetLen != null ? p.sheetLen : autoLen;
  const W = p.sheetW;
  const rowY = p.rowOffset != null ? p.rowOffset : W / 2;
  const x0 = (L - rowLen) / 2;
  const holes = [];
  for (let i = 0; i < n; i++) holes.push({ x: x0 + i * d.P, y: rowY, r: p.holeD / 2 });
  return {
    n, L, W, rowY, x0, rowLen, autoLen, holes,
    endGap: x0 - p.holeD / 2,                 // plastic from the sheet end to the first hole's edge
    edgeGap: Math.min(rowY, W - rowY) - p.holeD / 2 // plastic from the hole edge to the nearer long edge
  };
}

function num(v) {
  // Plain decimal, up to 4 places, no exponent.
  let s = (Math.round(v * 1e4) / 1e4).toFixed(4);
  s = s.replace(/\.?0+$/, "");
  return s === "-0" ? "0" : s;
}

function fileName(p, d, ext) {
  return "sheet_" + p.teeth + "pins_" + num(Math.round(d.P * 1000) / 1000) + "mm_" + d.nGuide + "holes." + ext;
}

// True-scale SVG: width, height and viewBox all in millimeters.
// SVG y runs down, so the hole row's distance from the bottom edge becomes H - rowY.
function sheetSVG(p, d) {
  const s = sheetLayout(p, d);
  const L = num(s.L), W = num(s.W);
  const lines = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" version="1.1"');
  lines.push('     width="' + L + 'mm" height="' + W + 'mm" viewBox="0 0 ' + L + " " + W + '">');
  lines.push('  <g id="outline" inkscape:groupmode="layer" inkscape:label="outline" fill="none" stroke="#0000FF" stroke-width="0.1">');
  lines.push('    <path d="M 0 0 H ' + L + " V " + W + ' H 0 Z"/>');
  lines.push("  </g>");
  lines.push('  <g id="holes" inkscape:groupmode="layer" inkscape:label="holes" fill="none" stroke="#FF0000" stroke-width="0.1">');
  for (const h of s.holes) lines.push('    <circle cx="' + num(h.x) + '" cy="' + num(s.W - h.y) + '" r="' + num(h.r) + '"/>');
  lines.push("  </g>");
  lines.push("</svg>");
  return lines.join("\n") + "\n";
}

// DXF (AutoCAD R12 ASCII) in millimeters: holes as CIRCLE entities on layer
// HOLES, the outline as one closed POLYLINE on layer OUTLINE.
function sheetDXF(p, d) {
  const s = sheetLayout(p, d);
  const out = [];
  const g = (code, value) => { out.push(String(code)); out.push(String(value)); };
  g(0, "SECTION"); g(2, "HEADER");
  g(9, "$ACADVER"); g(1, "AC1009");
  g(9, "$INSUNITS"); g(70, 4);          // 4 = millimeters
  g(9, "$MEASUREMENT"); g(70, 1);       // metric
  g(9, "$EXTMIN"); g(10, 0); g(20, 0); g(30, 0);
  g(9, "$EXTMAX"); g(10, num(s.L)); g(20, num(s.W)); g(30, 0);
  g(0, "ENDSEC");
  g(0, "SECTION"); g(2, "TABLES");
  g(0, "TABLE"); g(2, "LTYPE"); g(70, 1);
  g(0, "LTYPE"); g(2, "CONTINUOUS"); g(70, 0); g(3, "Solid line"); g(72, 65); g(73, 0); g(40, 0);
  g(0, "ENDTAB");
  g(0, "TABLE"); g(2, "LAYER"); g(70, 2);
  g(0, "LAYER"); g(2, "HOLES"); g(70, 0); g(62, 1); g(6, "CONTINUOUS");     // red
  g(0, "LAYER"); g(2, "OUTLINE"); g(70, 0); g(62, 5); g(6, "CONTINUOUS");   // blue
  g(0, "ENDTAB");
  g(0, "ENDSEC");
  g(0, "SECTION"); g(2, "ENTITIES");
  for (const h of s.holes) {
    g(0, "CIRCLE"); g(8, "HOLES"); g(10, num(h.x)); g(20, num(h.y)); g(30, 0); g(40, num(h.r));
  }
  g(0, "POLYLINE"); g(8, "OUTLINE"); g(66, 1); g(10, 0); g(20, 0); g(30, 0); g(70, 1);
  for (const [x, y] of [[0, 0], [s.L, 0], [s.L, s.W], [0, s.W]]) {
    g(0, "VERTEX"); g(8, "OUTLINE"); g(10, num(x)); g(20, num(y)); g(30, 0);
  }
  g(0, "SEQEND"); g(8, "OUTLINE");
  g(0, "ENDSEC");
  g(0, "EOF");
  return out.join("\r\n") + "\r\n";
}

module.exports = { sheetLayout, sheetSVG, sheetDXF, fileName };
