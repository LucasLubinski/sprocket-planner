// UI acceptance checks: builds dist/planner.html, opens it from disk in
// headless Chrome and drives it like a student would.
// Skipped (not failed) when Chrome isn't installed.
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "../tools/build.mjs";
import { launch, findChrome } from "../tools/cdp.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const URL = pathToFileURL(path.join(ROOT, "dist", "planner.html")).href;
const chrome = findChrome();

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
      await ev(`__t.sp().store.setSettings({ detail: "expert", hub: "custom" }); __t.sp().store.setField("hub", "custom"); 1`); await settle();
      const missing = await ev(`(async () => {
        const miss = [];
        for (const f of document.querySelectorAll(".field[data-field]")) {
          const key = f.getAttribute("data-field");
          const el = f.querySelector("input[type=text], select, input[type=checkbox], button.shape-btn");
          if (!el) continue;
          el.focus();
          await __t.settle();
          const n = [...document.querySelectorAll("svg.drw .hl")].length;
          if (!n) miss.push(key);
          el.blur();
        }
        return miss;
      })()`);
      const LATER = ["trackClearT", "trackClearW"]; // the track drawing arrives with the export box
      assert.deepEqual(missing.filter(k => !LATER.includes(k)), [], "inputs with nothing to light up");
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

    assert.deepEqual(page.errors, [], "no page errors during the run");
  } finally {
    await browser.close();
  }
});
