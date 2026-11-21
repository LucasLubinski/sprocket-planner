// UI acceptance checks: builds dist/planner.html, opens it from disk in
// headless Chrome and drives it like a student would.
// Skipped (not failed) when Chrome isn't installed.
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "../tools/build.mjs";
import { launch, findChrome } from "../tools/cdp.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const URL = pathToFileURL(path.join(ROOT, "dist", "planner.html")).href;
const chrome = findChrome();
const OVERLAP = fs.readFileSync(path.join(ROOT, "tools", "overlap.js"), "utf8");
const AUDIT = fs.readFileSync(path.join(ROOT, "tools", "audit.js"), "utf8");

// Helpers that run inside the page.
const HELPERS = `
window.__t = {
  settle: () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))),
  f: k => document.getElementById("f-" + k),
  val: k => document.getElementById("f-" + k).value,
  badge: k => (document.querySelector('.field[data-field="' + k + '"] .bdg-slot') || {}).textContent || "",
  changed: k => document.querySelector('.field[data-field="' + k + '"]').classList.contains("changed"),
  row: k => document.querySelector('#measure tr[data-key="' + k + '"]'),
  rowBadge: k => { const r = document.querySelector('#measure tr[data-key="' + k + '"] td.bdg-cell'); return r ? r.textContent : ""; },
  rowVal: k => { const r = document.querySelector('#measure tr[data-key="' + k + '"] td.num'); return r ? r.textContent : ""; },
  hl: () => [...document.querySelectorAll("svg.drw")].map(s => (s.classList[1] || "") + ":" + s.querySelectorAll(".hl").length),
  sp: () => window.SprocketPlanner
};
1`;

test("planner UI in headless Chrome", { skip: !chrome && "Chrome not found", timeout: 240000 }, async t => {
  build();
  const browser = await launch();
  const page = await browser.newPage();
  const ev = s => page.eval(s);
  const settle = () => ev("__t.settle()");
  async function fresh(width = 1366, height = 768) {
    await page.viewport(width, height, { mobile: width < 600, touch: width < 600 });
    await page.goto(URL);
    await ev("localStorage.clear(); 1");
    await page.goto(URL);
    await ev(HELPERS);
    await settle();
  }
  // Focus a box, select its text, then type one character at a time.
  async function typeInto(key, text) {
    await ev(`(__t.f("${key}").focus(), __t.f("${key}").select(), 1)`);
    await page.type(text);
    await settle();
  }
  async function blur() { await ev("document.activeElement && document.activeElement.blur(), 1"); await settle(); }

  try {
    await fresh();

    await t.test("opens with no page errors and the default design", async () => {
      assert.deepEqual(page.errors, []);
      assert.equal(await ev(`__t.val("rotation")`), "360");
      assert.equal(await ev(`__t.val("travel")`), "6");
      assert.equal(await ev(`__t.val("teeth")`), "16");
    });

    await t.test("taper angle: default about 28.4°, 20° gives a 3.01 mm tip and back", async () => {
      assert.equal(await ev(`__t.val("taper")`), "28.4");
      await ev(`__t.sp().store.setSettings({ detail: "expert" }); 1`); await settle();
      await typeInto("taper", "20"); await blur();
      assert.equal(await ev(`__t.val("tipD")`), "3.01");
      await typeInto("tipD", "3.01"); await blur();
      assert.equal(await ev(`__t.val("taper")`), "20.0");
    });

    await t.test("focusing Pitch diameter lights the pitch circle everywhere and shows a callout", async () => {
      await fresh();
      await ev(`__t.f("pitchD").focus(); 1`); await settle(); await page.sleep(300);
      const r = await ev(`({
        hl: __t.hl(),
        layout: !!document.querySelector("svg.layout .pitch.hl"),
        faded: getComputedStyle(document.querySelector("svg.layout .drum")).opacity,
        callout: [...document.querySelectorAll(".callout")].map(c => c.textContent)
      })`);
      assert.ok(r.layout, "pitch circle lit in the layout");
      assert.ok(r.hl.find(x => x.startsWith("closeup:")).split(":")[1] > 0, "lit in the close-up");
      assert.ok(r.hl.find(x => x.startsWith("pinhole:")).split(":")[1] > 0, "lit in the pin drawing");
      assert.equal(+r.faded, 0.3, "everything else fades to 30%");
      assert.ok(r.callout.some(c => /circle where the pins push the sheet/.test(c)), "plain-words callout");
      await blur();
    });

    await t.test("hovering the pitch circle highlights the Pitch diameter box", async () => {
      const pos = await ev(`(() => { const el = document.querySelector("#pane-views"); el.scrollTop = document.querySelector("#sec-layout").offsetTop; const c = document.querySelector("svg.layout .pitch").getBoundingClientRect(); return [c.left + 3, c.top + c.height / 2]; })()`);
      await settle();
      // a point on the pitch circle halfway between two pins (pins every 22.5°, first at the top)
      const p2 = await ev(`(() => { const c = document.querySelector("svg.layout .pitch"); const r = c.getBoundingClientRect(); const R = r.width / 2 - 1; const a = (-90 + 11.25 + 7 * 22.5) * Math.PI / 180; return [r.left + r.width / 2 + R * Math.cos(a), r.top + r.height / 2 + R * Math.sin(a)]; })()`);
      await page.mouse("mouseMoved", p2[0], p2[1], { buttons: 0 });
      await settle();
      const lit = await ev(`document.querySelector('.field[data-field="pitchD"]').classList.contains("pointed")`);
      assert.ok(lit, "Pitch diameter box is highlighted");
      await page.mouse("mouseMoved", 5, 5, { buttons: 0 });
      void pos;
    });

    await t.test("every input lights up at least one part of a drawing (expert detail)", async () => {
      await ev(`__t.sp().store.setSettings({ detail: "expert", hub: "custom" }); __t.sp().store.setField("hub", "custom"); __t.sp().store.setField("shape", "straight"); 1`); await settle();
      const missing = await ev(`(async () => {
        const miss = [];
        for (const f of document.querySelectorAll(".field[data-field]")) {
          const key = f.getAttribute("data-field");
          const el = f.querySelector("input[type=text], select, input[type=checkbox], button.shape-btn");
          if (!el || f.closest("[hidden]")) continue;
          el.focus();
          await __t.settle();
          const n = [...document.querySelectorAll("svg.drw .hl")].length;
          if (!n) miss.push(key);
          el.blur();
        }
        return miss;
      })()`);
      assert.deepEqual(missing, [], "inputs with nothing to light up");
    });

    await t.test("measurements table lists the derived numbers", async () => {
      await fresh();
      assert.equal(await ev(`__t.rowVal("holes")`), "20");
      assert.equal(await ev(`__t.rowVal("P")`), "9.525 mm");
      assert.equal(await ev(`__t.rowVal("guideLen")`), "192.98 mm");
    });

    // ---------------- comparing (phase 3) ----------------
    await t.test("turn 360 -> 180: badges on drum, spacing and holes; ghost of the 360° wheel", async () => {
      await fresh();
      await typeInto("rotation", "180"); await blur();
      const r = await ev(`({ drum: __t.val("drumD"), drumB: __t.badge("drumD"), pB: __t.badge("P"), holes: __t.rowVal("holes"), holesB: __t.rowBadge("holes"), changed: __t.changed("rotation"), turnB: __t.badge("rotation") })`);
      assert.equal(r.drum, "94.72");
      assert.equal(r.drumB, "▲ +48.51");
      assert.equal(r.pB, "▲ +9.525");
      assert.equal(r.holes, "11");
      assert.equal(r.holesB, "▼ −9");
      assert.ok(r.changed, "the edited box gets the 'you changed this' outline");
      assert.equal(r.turnB, "", "and no badge");
      await ev(`__t.sp().run("toggleGhost"); 1`); await settle();
      const g = await ev(`(() => { const c = document.querySelector("svg.layout .ghost .turn circle"); return c ? +c.getAttribute("r") : null; })()`);
      assert.ok(Math.abs(g - 23.105) < 0.01, "ghost wheel is the 360° wheel (r 23.105), got " + g);
    });

    await t.test("typing 1, 18, 180 in one go badges the change from 360°", async () => {
      await fresh();
      await ev(`(__t.f("rotation").focus(), __t.f("rotation").select(), 1)`);
      await page.type("1"); await settle();
      await page.type("8"); await settle();
      await page.type("0"); await settle();
      assert.equal(await ev(`__t.val("rotation")`), "180");
      assert.equal(await ev(`__t.badge("drumD")`), "▲ +48.51");
      await blur();
    });

    await t.test("pins 16 -> 24: spacing and plastic ▼ −3.175, plastic now 1.850 mm and amber", async () => {
      await fresh();
      await typeInto("teeth", "24"); await blur();
      const r = await ev(`({ pB: __t.badge("P"), web: __t.rowVal("web"), webB: __t.rowBadge("web"), chip: [...document.querySelectorAll("#chips .chip")].map(c => c.className + "|" + c.textContent) })`);
      assert.equal(r.pB, "▼ −3.175");
      assert.equal(r.webB, "▼ −3.175");
      assert.equal(r.web, "1.850 mm");
      assert.ok(r.chip.some(c => /warn/.test(c) && /Thin plastic/.test(c)), "amber thin-plastic chip");
    });

    await t.test("save A, set 180°, save B, compare side by side at one scale", async () => {
      await fresh();
      await ev(`(async () => {
        const sp = __t.sp(), st = sp.store;
        st.saveDesign(st.nextName());
        st.beginEdit("t"); st.setField("rotation", 180);
        st.saveDesign(st.nextName());
        await __t.settle();
        for (const cb of document.querySelectorAll("#saved-list input[type=checkbox]")) cb.click();
        await __t.settle();
        return 1;
      })()`);
      const r = await ev(`(async () => {
        const st = __t.sp().store;
        st.setSettings({ animateBy: "slide" }); await __t.settle();
        __t.sp().compare.turn(1);
        const slide = [...document.querySelectorAll(".panel-read")].map(e => e.textContent);
        st.setSettings({ animateBy: "turn" }); await __t.settle();
        __t.sp().compare.turn(1);
        const turn = [...document.querySelectorAll(".panel-read")].map(e => e.textContent);
        const boxes = [...document.querySelectorAll("svg.panel")].map(s => s.getAttribute("viewBox") + "|" + s.style.width);
        const names = [...document.querySelectorAll(".panel-name")].map(e => e.textContent.trim());
        const table = [...document.querySelectorAll("#compare-table tbody tr")].map(tr => tr.textContent);
        return { slide, turn, boxes, names, table };
      })()`);
      assert.deepEqual(r.names, ["Design A", "Design B"]);
      assert.equal(r.boxes.length, 2);
      assert.equal(r.boxes[0], r.boxes[1], "same viewBox and width = same mm per pixel");
      assert.match(r.slide[0], /Turned 360°/); assert.match(r.slide[1], /Turned 180°/);
      assert.match(r.turn[0], /Turned 180° · slid 3\.00 in/); assert.match(r.turn[1], /Turned 180° · slid 6\.00 in/);
      const wheel = r.table.find(x => x.startsWith("Wheel size"));
      assert.match(wheel, /46\.21 mm ▼ −48\.51/, "Design A's difference from Now");
    });

    await t.test("settings dialog: units to mm with OK; remembered after reload", async () => {
      await ev(`__t.sp().run("settings"); 1`); await settle();
      await ev(`document.querySelector('.settings-dlg .tabpanel:not([hidden])') && 1`);
      await ev(`document.querySelector('#tab-disp').click(); 1`); await settle();
      await ev(`document.querySelector('#set-units-1').click(); 1`);
      await ev(`[...document.querySelectorAll('.settings-dlg .dlg-buttons button')].find(b => b.textContent === "OK").click(); 1`); await settle();
      assert.equal(await ev(`__t.val("travel")`), "152.4");
      await page.goto(URL); await ev(HELPERS); await settle();
      assert.equal(await ev(`__t.val("travel")`), "152.4", "units remembered");
      assert.equal(await ev(`__t.sp().store.saved.length`), 2, "saved designs remembered");
      assert.equal(await ev(`__t.val("rotation")`), "180", "current design remembered");
    });

    // ---------------- making it (phase 5) ----------------
    await t.test("Copy OpenSCAD file copies the whole model with the current numbers", async () => {
      await fresh();
      await typeInto("rotation", "180"); await blur();
      const r = await ev(`(async () => {
        let got = null;
        navigator.clipboard.writeText = async t => { got = t; };
        const how = await __t.sp().run("copyScad");
        const file = got;
        document.querySelector("#part-drill_guide").click(); await __t.settle();
        await __t.sp().run("copySettings");
        return { how, file, settings: got, status: document.querySelector(".st-msg").textContent };
      })()`);
      assert.equal(r.how, "clipboard");
      assert.match(r.file, /^rotation_deg = 180;/m);
      assert.match(r.file, /^part = "sprocket";/m);
      assert.match(r.file, /module sprocket\(\)/, "the whole model");
      assert.match(r.settings, /^part = "drill_guide";/m);
      assert.doesNotMatch(r.settings, /module /, "settings only");
      assert.match(r.status, /Paste them over/);
    });

    await t.test("when the clipboard is blocked, a Select all dialog shows the text", async () => {
      const r = await ev(`(async () => {
        navigator.clipboard.writeText = async () => { throw new Error("blocked"); };
        document.execCommand = () => false;
        const how = await __t.sp().run("copyScad");
        await __t.settle();
        const ta = document.querySelector(".copyfb textarea");
        const sel = [...document.querySelectorAll(".copyfb button")].find(b => b.textContent === "Select all");
        const out = { how, text: ta && ta.value.slice(0, 300), sel: !!sel };
        [...document.querySelectorAll(".dialog button")].find(b => b.textContent === "Close").click();
        return out;
      })()`);
      assert.equal(r.how, "dialog");
      assert.ok(r.sel, "Select all button");
      assert.match(r.text, /Pin sprocket/);
    });

    await t.test("Save sheet SVG and DXF download true-scale files named with the key numbers", async () => {
      await fresh();
      const r = await ev(`(async () => {
        const got = [];
        const blobs = []; const mk = URL.createObjectURL; URL.createObjectURL = b => { blobs.push(b); return mk.call(URL, b); };
        HTMLAnchorElement.prototype.click = function () { got.push({ name: this.download, blob: blobs[blobs.length - 1] }); };
        __t.sp().run("saveSVG"); __t.sp().run("saveDXF");
        const svg = await got[0].blob.text();
        const dxf = await got[1].blob.text();
        return { names: got.map(g => g.name), svgHead: svg.split(String.fromCharCode(10)).slice(1, 3).join(" "), circles: (svg.match(/<circle/g) || []).length,
          layers: [/id="holes"/.test(svg), /id="outline"/.test(svg)], dxfCircles: dxf.split(String.fromCharCode(13, 10) + "CIRCLE" + String.fromCharCode(13, 10)).length - 1, dxfLayers: /HOLES/.test(dxf) && /OUTLINE/.test(dxf) };
      })()`);
      assert.deepEqual(r.names, ["sheet_16pins_9.525mm_20holes.svg", "sheet_16pins_9.525mm_20holes.dxf"]);
      assert.match(r.svgHead, /width="[\d.]+mm" height="40mm" viewBox="0 0 [\d.]+ 40"/);
      assert.equal(r.circles, 20);
      assert.deepEqual(r.layers, [true, true]);
      assert.equal(r.dxfCircles, 20);
      assert.ok(r.dxfLayers);
    });

    await t.test("track box gives shaft-to-sheet, slot height and slot width", async () => {
      const r = await ev(`[...document.querySelectorAll("#trackbox .tb-row")].map(e => e.querySelector("dt").textContent + "=" + e.querySelector("dd b").textContent)`);
      assert.deepEqual(r.slice(0, 3), ["Shaft center to sheet underside=23.51 mm", "Slot height=1.80 mm", "Slot width=41.00 mm"]);
      assert.ok(await ev(`!!document.querySelector("svg.track")`), "track drawing");
    });

    await t.test("Help dialogs: STL steps and How to use", async () => {
      const r = await ev(`(async () => {
        const out = [];
        for (const cmd of ["stlHelp", "howToUse"]) {
          __t.sp().run(cmd); await __t.settle();
          const d = document.querySelector(".helpdlg");
          out.push(d ? d.querySelector(".title-bar-text").textContent + "|" + d.querySelectorAll("li").length : "none");
          d.querySelector(".dlg-buttons button").click(); await __t.settle();
        }
        return out;
      })()`);
      assert.deepEqual(r, ["How to make the STL|7", "How to use Sprocket Planner|8"]);
    });

    // ---------------- student visuals (phase 4) ----------------
    await t.test("turn dial: pie, a ring per extra turn, the 300° tick, and a legend for the ghost", async () => {
      await fresh();
      const r = await ev(`(async () => {
        const st = __t.sp().store, q = s => document.querySelectorAll("svg.dial " + s).length;
        const at360 = { pie: q(".dial-pie"), rings: q(".dial-ring"), servo: q(".servo300"), num: document.querySelector("svg.dial .dial-num").textContent };
        st.beginEdit("t"); st.setField("rotation", 720); await __t.settle();
        const at720 = { rings: q(".dial-ring"), sub: document.querySelector("svg.dial .dial-sub").textContent,
          legend: [...document.querySelectorAll("svg.dial .dial-ghost .glbl")].map(e => e.textContent) };
        return { at360, at720 };
      })()`);
      assert.deepEqual(r.at360, { pie: 1, rings: 0, servo: 1, num: "360°" });
      assert.equal(r.at720.rings, 1, "one extra ring for the second turn");
      assert.equal(r.at720.sub, "2 turns");
      assert.deepEqual(r.at720.legend, ["before 360°"]);
    });

    await t.test("slide ruler: holes at true spacing, so more pins puts more holes on the bar", async () => {
      await fresh();
      const holes = () => ev(`document.querySelectorAll("svg.ruler .rnow-hole").length`);
      assert.equal(await holes(), 17, "6 in / 9.525 mm = 16 gaps");
      await typeInto("teeth", "24"); await blur();
      assert.equal(await holes(), 25, "6 in / 6.35 mm = 24 gaps");
      const r = await ev(`(() => {
        const svg = document.querySelector("svg.ruler"), bar = svg.querySelector(".rnow").getBoundingClientRect();
        const ruler = svg.querySelector(".ruler-body").getBoundingClientRect();
        const ghost = [...svg.querySelectorAll(".rghost .glbl")].map(e => e.textContent);
        return { barW: bar.width, rulerW: ruler.width, ghost };
      })()`);
      assert.ok(Math.abs(r.barW - r.rulerW) < 2, "the 6 in bar spans the whole 6 in ruler (labels sit above it)");
      assert.deepEqual(r.ghost, ["before: 6 in · 9.525 mm apart"]);
    });

    await t.test("fit meters: 24 pins thin plastic is amber; tapered 4.8 pin turns squeeze room red", async () => {
      await fresh();
      const zone = k => ev(`(() => { const z = document.querySelector('.meter[data-hl="${k}"] .m-zone'); return z.className.replace("m-zone ", "") + "|" + z.textContent; })()`);
      assert.equal(await zone("tight"), "z-green|Turns freely");
      await typeInto("teeth", "24"); await blur();
      assert.equal(await zone("web"), "z-amber|Thin");
      await fresh();
      await typeInto("pinW", "4.8"); await blur();
      assert.equal(await zone("tight"), "z-red|Pins hit");
      const warn = await ev(`[...document.querySelectorAll("#chips .chip")].map(c => c.textContent).join("|")`);
      assert.match(warn, /Pins hit hole edges/);
    });

    await t.test("fit meters: markers at the same value stack instead of overlapping", async () => {
      await fresh();
      await typeInto("rotation", "180"); await blur(); // wiggle room doesn't change: before = now
      const r = await ev(`(() => {
        const m = document.querySelector('.meter[data-hl="play"]');
        const [a, b] = [...m.querySelectorAll(".mk-t")].map(e => e.getBoundingClientRect());
        const overlap = !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
        return { n: m.querySelectorAll(".mk").length, overlap };
      })()`);
      assert.equal(r.n, 2, "now and before");
      assert.equal(r.overlap, false);
    });

    await t.test('every "?" button opens a plain-words explainer', async () => {
      await fresh();
      await ev(`__t.sp().store.setSettings({ detail: "expert", hub: "custom" }); __t.sp().store.setField("hub", "custom"); 1`); await settle();
      const bad = await ev(`(async () => {
        const bad = [];
        for (const q of document.querySelectorAll("button.qmark[data-explain]")) {
          if (!q.checkVisibility()) continue;
          q.click(); await __t.settle();
          const dlg = document.querySelector(".explainer");
          const words = dlg ? [...dlg.querySelectorAll(".ex-text p")].map(p => p.textContent).join(" ") : "";
          if (!dlg || words.length < 20) bad.push(q.getAttribute("data-explain"));
          const ok = dlg && [...dlg.querySelectorAll("button")].find(b => b.textContent === "OK");
          if (ok) ok.click(); await __t.settle();
        }
        return bad;
      })()`);
      assert.deepEqual(bad, [], "buttons with no explainer");
      assert.equal(await ev(`document.querySelectorAll(".explainer").length`), 0, "OK closes it");
    });

    await t.test("try-these examples load with badges like any edit", async () => {
      await fresh();
      await ev(`[...document.querySelectorAll(".try button")].find(b => /Half turn/.test(b.textContent)).click(); 1`); await settle();
      assert.equal(await ev(`__t.val("rotation")`), "180");
      assert.equal(await ev(`__t.badge("drumD")`), "▲ +48.51");
    });

    // ---------------- locks, choosing what moves, pin options (phase 7) ----------------
    const lockBtn = k => `document.querySelector('.lockbtn[data-lock="${k}"]').click()`;
    const routeText = k => ev(`(document.querySelector('.field[data-field="${k}"] .f-route:not([hidden])') || {}).textContent || ""`);
    const near = (a, e, tol, what) => assert.ok(Math.abs(parseFloat(a) - e) <= tol, what + ": got " + a + ", expected " + e);

    await t.test("lock Sheet slides, Wheel size 60: slide stays 6 in, the wheel turns 280.3°, with a note saying why", async () => {
      await fresh();
      await ev(lockBtn("travel") + "; 1"); await settle();
      assert.equal(await ev(`document.querySelector('.lockbtn[data-lock="travel"]').getAttribute("aria-pressed")`), "true");
      assert.equal(await ev(`__t.f("travel").readOnly`), true, "a locked box can't be typed in");
      await typeInto("drumD", "60");
      assert.equal(await ev(`__t.val("travel")`), "6");
      near(await ev(`__t.val("rotation")`), 280.3, 0.05, "Wheel turns");
      const note = await routeText("drumD");
      assert.match(note, /Sheet slides is locked at 6 in\./);
      assert.match(note, /So Wheel turns is now 280\.3° instead of 360°\./);
      assert.equal(await ev(`document.querySelector(".st-msg").textContent`), "Sheet slides is locked at 6 in.", "status repeats the first sentence");
      await blur();
    });

    await t.test("lock Hole spacing, Pins 16 → 24: spacing stays 9.525 and the wheel turns 240°", async () => {
      await fresh();
      await ev(lockBtn("P") + "; 1"); await settle();
      await typeInto("teeth", "24"); await blur();
      assert.equal(await ev(`__t.val("P")`), "9.525");
      near(await ev(`__t.val("rotation")`), 240, 0.01, "Wheel turns");
    });

    await t.test("lock Wheel turns and Sheet slides: Wheel size is refused, Push circle and Wheel size are held", async () => {
      await fresh();
      await ev(lockBtn("rotation") + "; " + lockBtn("travel") + "; 1"); await settle();
      const held = await ev(`["pitchD", "drumD", "P"].map(k => document.querySelector('.field[data-field="' + k + '"]').classList.contains("is-held") + ":" + __t.f(k).readOnly)`);
      assert.deepEqual(held, ["true:true", "true:true", "false:false"]);
      // a held box can't be typed in, so try the edit through the store, as a drag would
      const r = await ev(`(async () => { const st = __t.sp().store; st.beginEdit("t"); const ok = st.setField("drumD", 60); await __t.settle(); return { ok, drum: __t.val("drumD"), msg: (document.querySelector('.field[data-field="drumD"] .f-route') || {}).textContent }; })()`);
      assert.equal(r.ok, false);
      assert.equal(r.drum, "46.21");
      assert.equal(r.msg, "Can't change Wheel size. Sheet slides and Wheel turns are both locked. Together they fix the wheel size. Unlock one.");
      await ev(lockBtn("teeth") + "; 1"); await settle();
      assert.ok(await ev(`document.querySelector('.field[data-field="P"]').classList.contains("is-held")`), "adding a lock on Pins also holds Hole spacing");
    });

    await t.test("lock Tip size, Pin width 4.0 → 4.4: tip stays 2.00, slant becomes 32.4°", async () => {
      await fresh();
      await ev(`__t.sp().store.setSettings({ detail: "expert" }); 1`); await settle();
      await ev(lockBtn("tipD") + "; 1"); await settle();
      await typeInto("pinW", "4.4"); await blur();
      assert.equal(await ev(`__t.val("tipD")`), "2.00");
      assert.equal(await ev(`__t.val("taper")`), "32.4");
      assert.equal(await ev(`document.getElementById("f-keepTip").checked`), true, "Keep the tip round shows the same lock");
    });

    await t.test("a locked or held box has no drag handle", async () => {
      await fresh();
      await ev(lockBtn("rotation") + "; " + lockBtn("travel") + "; 1"); await settle();
      const r = await ev(`[...document.querySelectorAll(".dhandle")].map(e => e.getAttribute("data-key"))`);
      for (const k of ["rotation", "travel", "drumD", "pitchD"]) assert.ok(!r.includes(k), k + " has no handle");
    });

    await t.test("choosing what moves: Wheel size 60 offers Sheet slides (picked) or Wheel turns; the pick sticks", async () => {
      await fresh();
      await ev(`(__t.f("drumD").focus(), __t.f("drumD").select(), 1)`);
      await page.type("60"); await settle();
      const opts = await ev(`[...document.querySelectorAll('.field[data-field="drumD"] .rt-opt')].map(b => b.getAttribute("aria-checked") + "|" + b.textContent)`);
      assert.deepEqual(opts, ["true|Sheet slides: 6 in → 7.71 in", "false|Wheel turns: 360° → 280.3°"]);
      await ev(`document.querySelector('.field[data-field="drumD"] .rt-opt[data-mover="rotation"]').click(); 1`); await settle();
      assert.equal(await ev(`__t.val("travel")`), "6");
      near(await ev(`__t.val("rotation")`), 280.3, 0.05, "picked Wheel turns");
      // keep typing in the same edit: the pick stays
      await ev(`(__t.f("drumD").focus(), __t.f("drumD").setSelectionRange(2, 2), 1)`);
      await page.type("0"); await settle();
      assert.equal(await ev(`__t.sp().store.route.mover`), "rotation");
      assert.equal(await ev(`__t.val("travel")`), "6");
      await blur();
      // a locked number never appears as an option
      await ev(lockBtn("travel") + "; 1"); await settle();
      await typeInto("rotation", "180");
      const opts2 = await ev(`[...document.querySelectorAll('.field[data-field="rotation"] .rt-opt')].map(b => b.textContent)`);
      assert.ok(!opts2.some(t => /Sheet slides/.test(t)), "no Sheet slides option: " + opts2.join(" / "));
      await blur();
    });

    await t.test("Pick for me: no chooser, and the result matches the usual rule", async () => {
      await fresh();
      await ev(`__t.sp().run("moveChoice", "auto"); 1`); await settle();
      await typeInto("drumD", "60");
      assert.equal(await ev(`document.querySelectorAll('.rt-opt').length`), 0);
      assert.equal(await ev(`__t.val("rotation")`), "360");
      assert.equal(await ev(`__t.val("travel")`), "7.7056"); // push circle 60 + 2 × 0.4 + 1.5 = 62.3 mm
      await blur();
    });

    await t.test("Keep the tip round: height 2.6 → 4.0 keeps the 2.00 tip, slant 17.6° (unchecked, the pin comes to a point)", async () => {
      await fresh();
      await typeInto("pinH", "4"); await blur();
      const chips = await ev(`[...document.querySelectorAll("#warnings li, #chips li")].map(c => c.textContent).join("|")`);
      assert.match(chips, /comes to a point/i);
      await fresh();
      await ev(`document.getElementById("f-keepTip").click(); 1`); await settle();
      await typeInto("pinH", "4"); await blur();
      assert.equal(await ev(`__t.val("taper")`), "17.6");
      assert.equal(await ev(`__t.sp().store.design.tipD.toFixed(2)`), "2.00");
    });

    await t.test("Straight through the sheet + Straight past the sheet 0.5: straight part 2.4, follows the thickness", async () => {
      await fresh();
      assert.equal(await ev(`!!document.querySelector('.field[data-field="straightPast"]').closest("[hidden]") || document.querySelector('.field[data-field="straightPast"]').hidden`), true, "hidden for tapered pins");
      await ev(`document.querySelector('.shape-btn[data-shape="straight"]').click(); 1`); await settle();
      await typeInto("straightPast", "0.5"); await blur();
      assert.equal(await ev(`__t.sp().store.design.pinStraight.toFixed(2)`), "2.40");
      await typeInto("sheetT", "2"); await blur();
      assert.equal(await ev(`__t.sp().store.design.pinStraight.toFixed(2)`), "2.90");
    });

    await t.test("Straight with Keep the tip round: the 2 mm tip stays and the slant becomes 68.9°", async () => {
      await fresh();
      await ev(`document.getElementById("f-keepTip").click(); 1`); await settle();
      await ev(`document.querySelector('.shape-btn[data-shape="straight"]').click(); 1`); await settle();
      assert.equal(await ev(`__t.val("taper")`), "68.9");
      assert.equal(await ev(`__t.sp().store.design.tipD.toFixed(2)`), "2.00");
    });

    await t.test("locks stay through examples and reloads, but aren't part of saved designs", async () => {
      await fresh();
      await ev(lockBtn("travel") + "; 1"); await settle();
      await ev(`[...document.querySelectorAll(".try button")].find(b => /Half turn/.test(b.textContent)).click(); 1`); await settle();
      assert.equal(await ev(`document.querySelector('.lockbtn[data-lock="travel"]').getAttribute("aria-pressed")`), "true");
      await ev(`__t.sp().store.saveDesign("A"); 1`);
      await page.goto(URL); await ev(HELPERS); await settle();
      assert.equal(await ev(`document.querySelector('.lockbtn[data-lock="travel"]').getAttribute("aria-pressed")`), "true", "remembered");
      assert.equal(await ev(`"locks" in __t.sp().store.saved[0] || "locks" in __t.sp().store.saved[0].design`), false);
    });

    await t.test("dragging the spacing bar changes the travel exactly as typing the same spacing", async () => {
      await fresh();
      await typeInto("P", "10"); await blur();
      const typed = await ev(`__t.sp().store.design.travel`);
      await fresh();
      const pos = await ev(`(() => {
        document.querySelector("#sec-sheet").scrollIntoView();
        const h = document.querySelector('svg.sheet .dhandle[data-key="P"] .dh-dot');
        const r = h.getBoundingClientRect(), m = h.closest("svg").getScreenCTM();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, pxPerMm: Math.hypot(m.a, m.b) };
      })()`);
      const dx = 0.475 * pos.pxPerMm; // 9.525 -> 10.0 mm
      await page.mouse("mouseMoved", pos.x, pos.y, { buttons: 0 });
      await page.mouse("mousePressed", pos.x, pos.y);
      for (let i = 1; i <= 5; i++) await page.mouse("mouseMoved", pos.x + dx * i / 5, pos.y);
      await page.mouse("mouseReleased", pos.x + dx, pos.y);
      await settle();
      assert.equal(await ev(`__t.val("P")`), "10.000");
      assert.equal(await ev(`__t.sp().store.design.travel`), typed);
    });

    await t.test("type-in-place on a dimension label: Enter applies, Escape cancels", async () => {
      await fresh();
      const click = async () => {
        const p = await ev(`(() => { document.querySelector("#sec-layout").scrollIntoView(); const l = document.querySelector('svg.layout [data-dim="' + __t.sp().drawings.layout.dims.find(d => d.key === "drumD").id + '"] text.dl-edit'); const r = l.getBoundingClientRect(); return [r.left + 10, r.top + r.height / 2]; })()`);
        await page.click(p[0], p[1]); await settle();
      };
      await click();
      assert.ok(await ev(`!!document.querySelector(".tip-edit")`), "a box opens on the label");
      await page.type("60"); await page.key("Escape", { code: "Escape", keyCode: 27 }); await settle();
      assert.equal(await ev(`__t.val("drumD")`), "46.21", "Escape cancels");
      assert.ok(!(await ev(`!!document.querySelector(".tip-edit")`)));
      await click();
      await ev(`document.querySelector(".tip-edit").select(); 1`);
      await page.type("60"); await page.key("Enter", { code: "Enter", keyCode: 13, text: "\r" }); await settle();
      assert.equal(await ev(`__t.val("drumD")`), "60.00", "Enter applies");
      assert.equal(await ev(`__t.val("rotation")`), "360", "the usual rule: the slide moved, not the turn");
      assert.match(await ev(`(document.querySelector("#sec-layout .drag-route:not([hidden])") || {}).textContent || ""`), /Sheet slides: 6 in → 7\.71 in/, "the chooser shows beside the drawing");
    });

    await t.test("arrow keys nudge a focused handle (Shift for bigger steps)", async () => {
      await fresh();
      await ev(`document.querySelector('svg.dial .dhandle[data-key="rotation"]').focus(); 1`);
      await page.key("ArrowUp", { code: "ArrowUp", keyCode: 38 }); await settle();
      assert.equal(await ev(`__t.val("rotation")`), "361");
      await page.key("ArrowUp", { code: "ArrowUp", keyCode: 38, modifiers: 8 }); await settle();
      assert.equal(await ev(`__t.val("rotation")`), "376");
      assert.equal(await ev(`document.activeElement.getAttribute("data-key")`), "rotation", "focus stays on the handle");
      assert.equal(await ev(`__t.badge("drumD")`), "▼ −2.06", "one edit: badges compare with 360°, not 361°");
    });

    // ---------------- Windows 98 look, readable sizes (phase 6) ----------------
    await t.test("no text under 13 px, tap targets 44 px on touch screens, also in menus and dialogs", async () => {
      const found = [];
      for (const [w, h] of [[1366, 768], [390, 844]]) {
        await fresh(w, h);
        await ev(AUDIT + "; 1");
        const touch = await ev(`matchMedia("(any-pointer: coarse)").matches`);
        const steps = [
          ["student", ""],
          ["expert", `__t.sp().store.setSettings({ detail: "expert", dimLabels: "all" }); __t.sp().store.setField("hub", "custom")`],
          ["high contrast", `__t.sp().store.setSettings({ scheme: "contrast" })`],
          ["Export menu", `__t.sp().store.setSettings({ scheme: "standard" }); document.dispatchEvent(new KeyboardEvent("keydown", { key: "e", altKey: true, bubbles: true }))`],
          ["Settings", `document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); __t.sp().run("settings")`]
        ];
        for (const [name, setup] of steps) {
          const r = await ev(`(async () => { ${setup}; await new Promise(r => setTimeout(r, 120)); return __audit({ touch: ${touch} }); })()`);
          for (const x of r) found.push(w + " px, " + name + ": " + x);
        }
        await ev(`document.querySelectorAll(".dialog, .dlg-backdrop").forEach(d => d.remove()); 1`);
      }
      assert.deepEqual(found, []);
    });

    await t.test("Alt+E opens the Export menu; toolbar tooltips are Windows yellow", async () => {
      await fresh();
      const r = await ev(`(async () => {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "e", altKey: true, bubbles: true }));
        await __t.settle();
        const menu = [...document.querySelectorAll("[role=menu]")].find(m => m.checkVisibility());
        const items = menu ? [...menu.querySelectorAll("[role=menuitem], [role=menuitemradio]")].map(i => i.textContent.trim()) : [];
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        const b = document.querySelector('.tb-btn[aria-label="Save design"]') || document.querySelector(".tb-btn");
        b.focus(); await new Promise(r => setTimeout(r, 600));
        const tip = document.querySelector("#tooltip");
        const out = { items, tipShown: !tip.hidden, bg: getComputedStyle(tip).backgroundColor, text: tip.textContent };
        b.blur();
        return out;
      })()`);
      assert.ok(r.items.some(t => /Copy OpenSCAD file/.test(t)), "Export menu items: " + r.items.join(", "));
      assert.ok(r.tipShown);
      assert.equal(r.bg, "rgb(255, 255, 225)");
    });

    await t.test("drawing labels never cover a pin, a hole or each other (8 to 40 pins, 1366 and 390 px)", async () => {
      const found = [];
      for (const [w, h] of [[1366, 768], [390, 844]]) {
        await fresh(w, h);
        await ev(OVERLAP + "; 1");
        for (const detail of ["student", "expert"]) for (const teeth of [8, 16, 24, 40]) {
          const r = await ev(`(async () => {
            const sp = __t.sp(), st = sp.store;
            st.setSettings({ detail: "${detail}", dimLabels: "all" });
            st.beginEdit(); st.setField("teeth", 16); sp.renderNow();
            st.beginEdit(); st.setField("teeth", ${teeth}); sp.renderNow();
            await __t.settle();
            const step = 360 / ${teeth}, all = [];
            for (const f of [0, 0.25, 0.5, 0.75]) { sp.turnTo(step * f); for (const x of __labelHits().concat(__labelClashes())) all.push(x); }
            sp.turnTo(0);
            return [...new Set(all)];
          })()`);
          for (const x of r) found.push(w + " px, " + detail + ", " + teeth + " pins: " + x);
        }
      }
      assert.deepEqual(found, []);
    });

    assert.deepEqual(page.errors, [], "no page errors during the run");
  } finally {
    await browser.close();
  }
});
