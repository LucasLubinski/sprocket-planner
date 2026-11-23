"use strict";
// Design state, edit sessions, undo, saved designs and settings, in one place.
// No DOM here: the UI subscribes and redraws.
const { createSession, beginEdit, noteChange, resetBaseline, clone } = require("./session.js");
const { route, LOCKABLE } = require("./link.js");
const { defaultDesign, normalizeDesign } = require("../core/params.js");
const { normalizeSettings } = require("./settings.js");

const MAX_COMPARE = 4;
// The working design's tab. Every other tab is a saved design's id.
const CURRENT = "current";
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function letterName(i) {
  let s = "", n = i;
  do { s = LETTERS[n % 26] + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return "Design " + s;
}

function normalizeSaved(e, i) {
  if (!e || typeof e !== "object" || !e.design) return null;
  return {
    id: typeof e.id === "string" && e.id ? e.id : "d" + Date.now().toString(36) + i,
    name: typeof e.name === "string" && e.name.trim() ? e.name.trim().slice(0, 40) : letterName(i),
    design: normalizeDesign(e.design),
    created: typeof e.created === "number" ? e.created : Date.now(),
    compare: e.compare === true
  };
}

function createStore({ storage = null, clock = () => Date.now() } = {}) {
  const loaded = storage ? storage.load() : null;
  let currentDesign = loaded && loaded.design ? normalizeDesign(loaded.design) : defaultDesign();
  let settings = normalizeSettings(loaded && loaded.settings);
  let saved = (loaded && Array.isArray(loaded.saved) ? loaded.saved : []).map(normalizeSaved).filter(Boolean);
  let nextLetter = loaded && Number.isInteger(loaded.nextLetter) ? loaded.nextLetter : saved.length;
  // Locks hold a box, not a value. They stay through examples, loads and
  // resets, are remembered with the current design, and are not part of
  // saved designs or the OpenSCAD file.
  let locks = (loaded && Array.isArray(loaded.locks) ? loaded.locks : []).filter(k => LOCKABLE.includes(k));
  // The routing of the current edit: what moved, the options, the student's pick.
  let lastRoute = null, choice = null;
  let seq = 0;
  // Tabs: "Current" plus one per open saved design. Data saved before tabs
  // existed has no tab list, so every saved design opens as a tab.
  let tabs = [...new Set((loaded && Array.isArray(loaded.tabs) ? loaded.tabs : saved.map(s => s.id))
    .filter(id => saved.some(s => s.id === id)))];
  let active = loaded && tabs.includes(loaded.activeTab) ? loaded.activeTab : CURRENT;
  const designOf = id => id === CURRENT ? currentDesign : (saved.find(s => s.id === id) || {}).design;
  // The active tab's design, edit session (badge baseline) and undo history.
  // Other tabs keep theirs in ctxs while they wait.
  let design = designOf(active);
  let session = createSession(design);
  let undoStack = [], redoStack = [];
  const ctxs = new Map();
  const listeners = new Set();
  if (settings.badgeBase !== "last" && !saved.some(s => s.id === settings.badgeBase)) settings = { ...settings, badgeBase: "last" };

  const emit = kind => { for (const fn of listeners) fn(kind); };
  const persist = () => { if (storage) storage.save({ design: currentDesign, settings, saved, nextLetter, locks, tabs, activeTab: active }); };

  // The active tab's design changes. A saved design's tab is that saved
  // design, live, so its edits go straight back into the saved entry.
  function commit(nd) {
    design = nd;
    if (active === CURRENT) currentDesign = nd;
    else saved = saved.map(s => s.id === active ? { ...s, design: nd } : s);
  }
  function stash() { ctxs.set(active, { session, undoStack, redoStack, lastRoute, choice }); }
  function enter(id) {
    const c = ctxs.get(id);
    active = id;
    design = designOf(id);
    if (c) ({ session, undoStack, redoStack, lastRoute, choice } = c);
    else { session = createSession(design); undoStack = []; redoStack = []; lastRoute = null; choice = null; }
  }
  const tabName = id => id === CURRENT ? "Current" : (saved.find(s => s.id === id) || {}).name || "";
  const openTabId = id => { if (!tabs.includes(id)) tabs = [...tabs, id]; };

  function change(nd, key, opts = {}) {
    const started = noteChange(session, key);
    if (started && !opts.noUndo) {
      undoStack.push(clone(session.base));
      if (undoStack.length > 200) undoStack.shift();
      redoStack.length = 0;
    }
    commit(nd);
    persist();
    emit("design");
  }

  const api = {
    get design() { return design; },
    get settings() { return settings; },
    get saved() { return saved; },
    get session() { return session; },
    get canUndo() { return undoStack.length > 0; },
    get canRedo() { return redoStack.length > 0; },
    get storageOk() { return storage ? storage.ok : false; },

    // ---- tabs ----
    get activeTab() { return active; },
    get currentDesign() { return currentDesign; },
    // [{ id, name }], "Current" first, then the open saved designs in order.
    tabList() { return [CURRENT, ...tabs].map(id => ({ id, name: tabName(id) })); },
    isOpen(id) { return id === CURRENT || tabs.includes(id); },
    // Switching is not an edit: no badges, no undo step. Each tab keeps its
    // own undo history and badge baseline.
    switchTab(id) {
      if (id === active) return true;
      if (!api.isOpen(id)) return false;
      stash(); enter(id);
      persist(); emit("tab");
      return true;
    },
    openTab(id) {
      if (!saved.some(s => s.id === id)) return false;
      openTabId(id);
      if (!api.switchTab(id)) return false;
      persist(); emit("tab");
      return true;
    },
    // Closes the tab only; the design stays in Saved designs.
    closeTab(id) {
      if (id === CURRENT || !tabs.includes(id)) return false;
      const list = [CURRENT, ...tabs];
      const i = list.indexOf(id);
      if (active === id) { stash(); enter(list[i - 1]); }
      tabs = tabs.filter(t => t !== id);
      ctxs.delete(id);
      persist(); emit("tab");
      return true;
    },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    get locks() { return locks; },
    get route() { return lastRoute; },
    // An edit may be starting (focus, drag start, button click). The chooser
    // starts again from the usual choice, and the last note goes away.
    beginEdit(source) { beginEdit(session, design, source); choice = null; lastRoute = null; },

    // One field edited, following the linked rules and the locks.
    // Returns true when the design changed.
    setField(key, value) {
      // Every keystroke of one edit routes from the design as the edit began
      // (typing 6 then 60 is one change to 60, not 6 then 60). That design also
      // gives the old values for notes and chooser previews.
      const sameEdit = !session.pending && lastRoute && lastRoute.key === key && lastRoute.editId === session.editId;
      const before = sameEdit ? lastRoute.before : design;
      const pick = settings.moveChoice === "choose" && choice && choice.key === key ? choice.mover : null;
      const r = route(before, key, value, { locks, mover: pick });
      lastRoute = { ...r, before, editId: -1 };
      if (r.refused || JSON.stringify(r.design) === JSON.stringify(design)) { emit("route"); return false; }
      change(r.design, key);
      lastRoute.editId = session.editId;
      return true;
    },
    // The student picked which number moves (chooser). Redo this edit from
    // where it began, with that pick; it stays for the rest of the edit.
    chooseMover(mover) {
      const lr = lastRoute;
      if (!lr || lr.refused || lr.editId !== session.editId) return false;
      choice = { key: lr.key, mover };
      const r = route(lr.before, lr.key, lr.value, { locks, mover });
      if (r.refused) return false;
      lastRoute = { ...r, before: lr.before, editId: session.editId };
      commit(r.design);
      persist();
      emit("design");
      return true;
    },
    get choice() { return choice; },
    toggleLock(key, on) {
      if (!LOCKABLE.includes(key)) return false;
      const want = on === undefined ? !locks.includes(key) : !!on;
      locks = want ? [...new Set([...locks, key])] : locks.filter(k => k !== key);
      persist();
      emit("locks");
      return want;
    },
    clearRoute() { lastRoute = null; emit("route"); },

    // A whole new design (example, saved design, opened file, reset).
    setDesign(nd, source) {
      beginEdit(session, design, source || "button");
      change(normalizeDesign(nd), null);
    },
    resetDesign() { api.setDesign(defaultDesign(), "reset"); },

    undo() {
      if (!undoStack.length) return false;
      const prev = undoStack.pop();
      redoStack.push(clone(design));
      beginEdit(session, design, "undo");
      change(prev, null, { noUndo: true });
      return true;
    },
    redo() {
      if (!redoStack.length) return false;
      const next = redoStack.pop();
      undoStack.push(clone(design));
      beginEdit(session, design, "redo");
      change(next, null, { noUndo: true });
      return true;
    },
    clearBadges() { resetBaseline(session, design); emit("design"); },

    setSettings(patch) {
      settings = normalizeSettings({ ...settings, ...patch });
      persist();
      emit("settings");
    },
    resetSettings() { settings = normalizeSettings(null); persist(); emit("settings"); },

    nextName() { return letterName(nextLetter); },
    saveDesign(name) {
      const entry = {
        id: "d" + clock().toString(36) + (seq++).toString(36),
        name: (name || "").trim().slice(0, 40) || letterName(nextLetter),
        design: clone(design), created: clock(), compare: false
      };
      if (entry.name === letterName(nextLetter)) nextLetter++;
      saved = [...saved, entry];
      openTabId(entry.id); // its tab opens beside this one; this tab stays active
      persist(); emit("saved");
      return entry;
    },
    addSaved(name, d) {
      const entry = { id: "d" + clock().toString(36) + (seq++).toString(36), name: (name || "").trim().slice(0, 40) || letterName(nextLetter++), design: normalizeDesign(d), created: clock(), compare: false };
      saved = [...saved, entry];
      openTabId(entry.id);
      persist(); emit("saved");
      return entry;
    },
    getSaved(id) { return saved.find(s => s.id === id) || null; },
    loadSaved(id) {
      const s = api.getSaved(id);
      if (s) api.setDesign(clone(s.design), "load");
      return !!s;
    },
    overwriteSaved(id) {
      if (id === active) return;
      saved = saved.map(s => s.id === id ? { ...s, design: clone(design) } : s);
      if (ctxs.has(id)) ctxs.delete(id); // its tab starts fresh with the new design
      persist(); emit("saved");
    },
    renameSaved(id, name) {
      const n = (name || "").trim().slice(0, 40);
      if (!n) return false;
      saved = saved.map(s => s.id === id ? { ...s, name: n } : s);
      persist(); emit("saved");
      return true;
    },
    deleteSaved(id) {
      api.closeTab(id); // deleting a design closes its tab
      saved = saved.filter(s => s.id !== id);
      if (settings.badgeBase === id) settings = { ...settings, badgeBase: "last" };
      persist(); emit("saved");
    },
    // Up to four designs can be compared at once.
    setCompare(id, on) {
      if (on && !saved.some(s => s.id === id && s.compare) && saved.filter(s => s.compare).length >= MAX_COMPARE) return false;
      saved = saved.map(s => s.id === id ? { ...s, compare: !!on } : s);
      persist(); emit("saved");
      return true;
    },
    clearCompare() { saved = saved.map(s => ({ ...s, compare: false })); persist(); emit("saved"); },
    compared() { return saved.filter(s => s.compare); }
  };
  return api;
}

module.exports = { createStore, letterName, MAX_COMPARE, CURRENT };
