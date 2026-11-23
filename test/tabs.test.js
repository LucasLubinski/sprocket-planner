"use strict";
// Saved designs as tabs (Luke's request): each tab is the whole planner for
// one design, with its own undo history and badge baseline.
const test = require("node:test");
const assert = require("node:assert/strict");
const { createStore } = require("../state/store.js");
const { createStorage, KEY } = require("../state/storage.js");
const { badge } = require("../state/badges.js");
const { analyze } = require("../core/analyze.js");
const { defaultDesign } = require("../core/params.js");

function fakeLS() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), _map: m };
}
const b = (store, key) => {
  const now = analyze(store.design), base = analyze(store.session.base);
  const r = badge(key, now.v[key], base.v[key], { decimals: 2 });
  return r ? r.text : "";
};

test("saving opens a tab beside this one; opening a tab shows that design", () => {
  const s = createStore();
  const a = s.saveDesign(s.nextName());
  s.beginEdit("x"); s.setField("rotation", 180);
  const bb = s.saveDesign(s.nextName());
  assert.deepEqual(s.tabList().map(t => t.name), ["Current", "Design A", "Design B"]);
  assert.equal(s.activeTab, "current", "saving stays on the tab you are working in");
  assert.ok(s.switchTab(a.id));
  assert.equal(s.design.rotation, 360);
  assert.ok(s.switchTab(bb.id));
  assert.equal(s.design.rotation, 180);
  assert.equal(s.switchTab("nope"), false);
});

test("an edit in tab B changes saved B and leaves Current alone", () => {
  const s = createStore();
  const bb = s.saveDesign("B");
  s.switchTab(bb.id);
  s.beginEdit("field:teeth"); s.setField("teeth", 24);
  assert.equal(s.getSaved(bb.id).design.teeth, 24);
  assert.equal(s.currentDesign.teeth, 16);
  s.switchTab("current");
  assert.equal(s.design.teeth, 16);
  s.beginEdit("field:rotation"); s.setField("rotation", 180);
  assert.equal(s.getSaved(bb.id).design.rotation, 360, "Current's edits don't reach B");
});

test("the chooser's pick in a saved tab also saves into it", () => {
  const s = createStore();
  const bb = s.saveDesign("B");
  s.switchTab(bb.id);
  s.beginEdit("field:drumD"); s.setField("drumD", 60);
  assert.ok(s.chooseMover("rotation"));
  assert.equal(s.getSaved(bb.id).design.travel, 152.4);
  assert.ok(Math.abs(s.getSaved(bb.id).design.rotation - 280.3) < 0.1);
});

test("switching is not an edit; badges and undo stay inside their tab", () => {
  const s = createStore();
  const bb = s.saveDesign("B");
  s.beginEdit("field:rotation"); s.setField("rotation", 180); // Current: 360 -> 180
  s.switchTab(bb.id);
  assert.equal(b(s, "drumD"), "", "no badges on switching");
  assert.equal(s.canUndo, false, "B has its own (empty) undo history");
  s.beginEdit("field:teeth"); s.setField("teeth", 24);
  assert.equal(b(s, "P"), "▼ −3.175");
  s.switchTab("current");
  assert.equal(b(s, "drumD"), "▲ +48.51", "Current keeps its own badges");
  assert.ok(s.undo());
  assert.equal(s.design.rotation, 360);
  assert.equal(s.getSaved(bb.id).design.teeth, 24, "undo in Current leaves B alone");
  s.switchTab(bb.id);
  assert.ok(s.undo());
  assert.equal(s.getSaved(bb.id).design.teeth, 16);
  assert.equal(s.canUndo, false);
});

test("closing keeps the design; deleting closes its tab; locks stay global", () => {
  const s = createStore();
  const a = s.saveDesign("A"), bb = s.saveDesign("B");
  s.toggleLock("travel", true);
  s.switchTab(bb.id);
  assert.deepEqual(s.locks, ["travel"]);
  assert.ok(s.closeTab(bb.id));
  assert.equal(s.activeTab, a.id, "closing the open tab moves to the one on its left");
  assert.equal(s.saved.length, 2);
  assert.equal(s.closeTab("current"), false, "Current can't be closed");
  assert.ok(s.openTab(bb.id));
  assert.equal(s.activeTab, bb.id);
  s.deleteSaved(bb.id);
  assert.equal(s.isOpen(bb.id), false);
  assert.equal(s.activeTab, a.id);
  s.deleteSaved(a.id);
  assert.equal(s.activeTab, "current");
});

test("open tabs and the active tab survive a reload; old data opens every saved design", () => {
  const ls = fakeLS();
  const s = createStore({ storage: createStorage(ls) });
  const a = s.saveDesign("A"), bb = s.saveDesign("B");
  s.closeTab(a.id);
  s.switchTab(bb.id);
  s.beginEdit("x"); s.setField("teeth", 20);
  const s2 = createStore({ storage: createStorage(ls) });
  assert.deepEqual(s2.tabList().map(t => t.name), ["Current", "B"]);
  assert.equal(s2.activeTab, bb.id);
  assert.equal(s2.design.teeth, 20);
  assert.equal(s2.currentDesign.teeth, 16);
  const raw = JSON.parse(ls._map.get(KEY));
  assert.equal(raw.design.teeth, 16, "the stored design is still Current, so older planners read it");
  const ls2 = fakeLS();
  ls2.setItem(KEY, JSON.stringify({ design: defaultDesign(), saved: [{ id: "o1", name: "Old", design: defaultDesign() }] }));
  const s3 = createStore({ storage: createStorage(ls2) });
  assert.deepEqual(s3.tabList().map(t => t.name), ["Current", "Old"]);
  assert.equal(s3.activeTab, "current");
});
