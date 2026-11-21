// Inlines every module, the styles, 98.css and its fonts into one
// self-contained dist/planner.html. No network, no dependencies.
//   node tools/build.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODULE_DIRS = ["core", "state", "draw", "ui"];
const ENTRY = "ui/main.js";
const VENDOR = "vendor/98.css-0.1.21";
const STYLES = ["styles/win98.css"];

const read = p => fs.readFileSync(path.join(ROOT, p), "utf8").replace(/\r\n/g, "\n");

function collectModules() {
  const mods = {};
  for (const dir of MODULE_DIRS) {
    for (const f of fs.readdirSync(path.join(ROOT, dir)).sort()) {
      if (!f.endsWith(".js")) continue;
      const id = dir + "/" + f;
      mods[id] = read(id);
    }
  }
  // The OpenSCAD model travels inside the page, unchanged.
  if (mods["core/scad-template.js"] !== undefined) {
    mods["core/scad-template.js"] = "module.exports = " + JSON.stringify(read("reference/polycarb_sprocket.scad")) + ";\n";
  }
  return mods;
}

function resolve(from, req) {
  if (!req.startsWith(".")) throw new Error(`${from}: can't bundle require("${req}")`);
  const base = path.posix.dirname(from);
  let id = path.posix.normalize(path.posix.join(base, req));
  if (!id.endsWith(".js")) id += ".js";
  return id;
}

function bundle(mods) {
  const table = {};
  for (const [id, src] of Object.entries(mods)) {
    const map = {};
    for (const m of src.matchAll(/require\(\s*["']([^"']+)["']\s*\)/g)) {
      if (id === "core/scad-template.js") continue;
      const target = resolve(id, m[1]);
      if (!(target in mods)) throw new Error(`${id}: require("${m[1]}") -> ${target} not found`);
      map[m[1]] = target;
    }
    table[id] = { src, map };
  }
  const parts = [];
  parts.push("(function () {\n\"use strict\";\nvar defs = {};\n");
  for (const [id, { src, map }] of Object.entries(table)) {
    parts.push("defs[" + JSON.stringify(id) + "] = { map: " + JSON.stringify(map) + ", fn: function (module, exports, require) {\n" + src + "\n} };\n");
  }
  parts.push(
    "var cache = {};\n" +
    "function load(id) {\n" +
    "  if (cache[id]) return cache[id].exports;\n" +
    "  var d = defs[id]; if (!d) throw new Error('missing module ' + id);\n" +
    "  var m = { exports: {} }; cache[id] = m;\n" +
    "  d.fn(m, m.exports, function (r) { var t = d.map[r]; if (!t) throw new Error(id + ': unknown require ' + r); return load(t); });\n" +
    "  return m.exports;\n" +
    "}\n" +
    "load(" + JSON.stringify(ENTRY) + ");\n" +
    "})();\n");
  return parts.join("");
}

function vendorCSS() {
  let css = read(VENDOR + "/98.css");
  css = css.replace(/\/\*#\s*sourceMappingURL=[^*]*\*\//g, "");
  css = css.replace(/url\((ms_sans_serif(?:_bold)?\.woff2?)\)/g, (m, file) => {
    const buf = fs.readFileSync(path.join(ROOT, VENDOR, "fonts", file));
    const type = file.endsWith(".woff2") ? "font/woff2" : "font/woff";
    return "url(data:" + type + ";base64," + buf.toString("base64") + ")";
  });
  return css;
}

// Windows sometimes holds a just-closed file for a moment (a virus scan, or
// Chrome from the last test still letting go). Try again briefly.
function writeRetry(file, text) {
  for (let i = 0; ; i++) {
    try { fs.writeFileSync(file, text); return; } catch (e) {
      if (i >= 20 || !["UNKNOWN", "EBUSY", "EPERM"].includes(e.code)) throw e;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
  }
}

export function build({ write = true } = {}) {
  const mods = collectModules();
  if (!mods[ENTRY]) throw new Error("missing entry " + ENTRY);
  let js = bundle(mods);
  js = js.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");
  const css = [vendorCSS(), ...STYLES.map(read)].join("\n");
  let html = read("index.html");
  const stamp = new Date().toISOString().slice(0, 10);
  html = html.replace("<!-- build:css -->", () => "<style>\n" + css.replace(/<\/style/gi, "<\\/style") + "\n</style>");
  html = html.replace("<!-- build:js -->", () => "<script>\n/* Sprocket Planner, built " + stamp + ". Source: core/, state/, draw/, ui/. */\n" + js + "</script>");
  if (write) {
    fs.mkdirSync(path.join(ROOT, "dist"), { recursive: true });
    writeRetry(path.join(ROOT, "dist", "planner.html"), html);
    // Same page for GitHub Pages (Settings > Pages > main, /docs).
    fs.mkdirSync(path.join(ROOT, "docs"), { recursive: true });
    writeRetry(path.join(ROOT, "docs", "index.html"), html);
  }
  return { html, bytes: Buffer.byteLength(html), modules: Object.keys(mods).length };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = build();
  console.log(`dist/planner.html and docs/index.html: ${(r.bytes / 1024).toFixed(1)} KB, ${r.modules} modules`);
}
