"use strict";
// Badge baselines, badges, undo, saved designs, settings, and storage.
const test = require("node:test");
const assert = require("node:assert/strict");
const { createStore, letterName } = require("../state/store.js");
const { createStorage, designFile, readDesignFile, KEY } = require("../state/storage.js");
const { badge } = require("../state/badges.js");
const { analyze } = require("../core/analyze.js");
const { defaultDesign } = require("../core/params.js");

function fakeLS(opts = {}) {
  const m = new Map();
  return {
    getItem: k => { if (opts.block) throw new Error("SecurityError"); return m.has(k) ? m.get(k) : null; },
    setItem: (k, v) => { if (opts.block || opts.full) throw new Error("QuotaExceeded"); m.set(k, String(v)); },
    removeItem: k => m.delete(k),
    _map: m
  };
}
const b = (store, key) => {
  const now = analyze(store.design), base = analyze(store.session.base);
  const r = badge(key, now.v[key], base.v[key], { decimals: 2 });
  return r ? r.text : "";
};

test("turn 360 -> 180: drum ▲ +48.51, spacing ▲ +9.525, holes ▼ −9", () => {
  const s = createStore();
  s.beginEdit("field:rotation");
  s.setField("rotation", 180);
  assert.equal(b(s, "drumD"), "▲ +48.51");
  assert.equal(b(s, "P"), "▲ +9.525");
  assert.equal(b(s, "holes"), "▼ −9");
  assert.deepEqual(s.session.changed, ["rotation"]);
});

test("typing 1, 18, 180 badges the change from 360, not from 18", () => {
  const s = createStore();
  s.beginEdit("field:rotation");
  for (const v of [1, 18, 180]) s.setField("rotation", v);
  assert.equal(s.session.base.rotation, 360);
  assert.equal(b(s, "drumD"), "▲ +48.51");
});

test("focusing another box keeps the badges until something changes", () => {
  const s = createStore();
  s.beginEdit("field:rotation"); s.setField("rotation", 180);
  s.beginEdit("field:teeth"); // focus only
  assert.equal(b(s, "drumD"), "▲ +48.51");
  s.setField("teeth", 24); // the new edit starts now
  assert.equal(s.session.base.rotation, 180);
  assert.equal(b(s, "drumD"), "");
  assert.equal(b(s, "P"), "▼ −6.350"); // 19.05 -> 12.70 mm
});

test("pins 16 -> 24: spacing and plastic both ▼ −3.175", () => {
  const s = createStore();
  s.beginEdit("field:teeth"); s.setField("teeth", 24);
  assert.equal(b(s, "P"), "▼ −3.175");
  assert.equal(b(s, "web"), "▼ −3.175");
});

test("badges use the same decimals and hide changes too small to show", () => {
  assert.equal(badge("drumD", 46.212, 46.2104), null, "0.0016 rounds to 0.00");
  assert.equal(badge("drumD", 46.2204, 46.2104).text, "▲ +0.01");
  assert.equal(badge("gap", 0.0, 0.4).text, "▼ −0.40");
  assert.equal(badge("drumD", 94.72, 46.21, { decimals: 1 }).text, "▲ +48.5");
  assert.equal(badge("drumD", 94.72085, 46.21043, { decimals: 3 }).text, "▲ +48.510");
});

test("better/worse colors follow the meters' green zones", () => {
  assert.equal(badge("web", 1.85, 5.025, { colors: "betterworse" }).cls, "worse");
  assert.equal(badge("tight", 0.2, -0.01, { colors: "betterworse" }).cls, "better");
  assert.equal(badge("play", 0.3, 0.466, { colors: "betterworse" }).cls, "better");
  assert.equal(badge("drumD", 94, 46, { colors: "betterworse" }).cls, "same");
  assert.equal(badge("drumD", 94, 46).cls, "up");
});

test("buttons (examples, loading) start a new edit from the design before", () => {
  const s = createStore();
  s.setDesign({ ...defaultDesign(), teeth: 24 }, "example");
  assert.equal(b(s, "P"), "▼ −3.175");
  assert.deepEqual(s.session.changed, []);
});

test("undo and redo", () => {
  const s = createStore();
  s.beginEdit("a"); s.setField("rotation", 180);
  s.beginEdit("b"); s.setField("teeth", 20);
  assert.ok(s.canUndo);
  s.undo(); assert.equal(s.design.teeth, 16); assert.equal(s.design.rotation, 180);
  s.undo(); assert.equal(s.design.rotation, 360);
  s.redo(); assert.equal(s.design.rotation, 180);
  s.redo(); assert.equal(s.design.teeth, 20);
  assert.equal(s.canRedo, false);
});

test("save, load, rename, delete and compare (up to four)", () => {
  const s = createStore();
  const a = s.saveDesign(s.nextName());
  assert.equal(a.name, "Design A");
  s.beginEdit("x"); s.setField("rotation", 180);
  const bb = s.saveDesign(s.nextName());
  assert.equal(bb.name, "Design B");
  s.loadSaved(a.id);
  assert.equal(s.design.rotation, 360);
  assert.equal(s.session.base.rotation, 180, "loading badges the change from the design before");
  assert.ok(s.renameSaved(bb.id, "Half turn"));
  assert.equal(s.getSaved(bb.id).name, "Half turn");
  const ids = [a.id, bb.id, s.saveDesign("C").id, s.saveDesign("D").id, s.saveDesign("E").id];
  for (const id of ids.slice(0, 4)) assert.ok(s.setCompare(id, true));
  assert.equal(s.setCompare(ids[4], true), false, "a fifth is refused");
  assert.equal(s.compared().length, 4);
  s.deleteSaved(a.id);
  assert.equal(s.saved.length, 4);
  assert.equal(letterName(26), "Design AA");
});

test("settings: change, remember, reset; badge base falls back when deleted", () => {
  const ls = fakeLS();
  const s = createStore({ storage: createStorage(ls) });
  const e = s.saveDesign("Home");
  s.setSettings({ units: "mm", decimals: 3, badgeBase: e.id, ghost: true, bogus: 1 });
  assert.equal(s.settings.units, "mm"); assert.equal(s.settings.bogus, undefined);
  const s2 = createStore({ storage: createStorage(ls) });
  assert.equal(s2.settings.units, "mm"); assert.equal(s2.settings.badgeBase, e.id); assert.equal(s2.settings.ghost, true);
  s2.deleteSaved(e.id);
  assert.equal(s2.settings.badgeBase, "last");
  s2.resetSettings();
  assert.equal(s2.settings.units, "in"); assert.equal(s2.settings.ghost, false);
});

test("reloading keeps the current design, saved designs and settings", () => {
  const ls = fakeLS();
  const s = createStore({ storage: createStorage(ls) });
  s.beginEdit("x"); s.setField("teeth", 20);
  s.saveDesign("Twenty");
  s.setSettings({ detail: "expert" });
  assert.ok(ls._map.has(KEY));
  const s2 = createStore({ storage: createStorage(ls) });
  assert.equal(s2.design.teeth, 20);
  assert.equal(s2.saved[0].name, "Twenty");
  assert.equal(s2.settings.detail, "expert");
});

test("blocked storage: everything still works, and the store says so", () => {
  const st = createStorage(fakeLS({ block: true }));
  assert.equal(st.ok, false);
  const s = createStore({ storage: st });
  s.beginEdit("x"); s.setField("teeth", 20);
  s.saveDesign("A");
  assert.equal(s.storageOk, false);
  assert.equal(s.design.teeth, 20);
  const none = createStore({ storage: createStorage(null) });
  assert.equal(none.storageOk, false);
});

test("older saved data missing newer keys still loads (carries over)", () => {
  const ls = fakeLS();
  const old = { design: { rotation: 270, travel: 101.6, teeth: 12 }, saved: [{ id: "x1", name: "Old one", design: { rotation: 90, travel: 50 } }], settings: { units: "mm" } };
  ls.setItem(KEY, JSON.stringify(old));
  const s = createStore({ storage: createStorage(ls) });
  assert.equal(s.design.rotation, 270);
  assert.equal(s.design.holeD, 4.5, "missing keys come from the defaults");
  assert.equal(s.saved[0].design.teeth, 16);
  assert.equal(s.settings.units, "mm");
});

test("design files round-trip; other files are refused", () => {
  const d = { ...defaultDesign(), teeth: 18 };
  const r = readDesignFile(designFile("My design", d));
  assert.ok(r.ok); assert.equal(r.name, "My design"); assert.equal(r.design.teeth, 18);
  assert.equal(readDesignFile("{ not json").ok, false);
  assert.equal(readDesignFile(JSON.stringify({ hello: 1 })).ok, false);
});
