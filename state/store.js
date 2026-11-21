"use strict";
// Design state, edit sessions, undo, saved designs and settings, in one place.
// No DOM here: the UI subscribes and redraws.
const { createSession, beginEdit, noteChange, resetBaseline, clone } = require("./session.js");
const { route, LOCKABLE } = require("./link.js");
const { defaultDesign, normalizeDesign } = require("../core/params.js");
const { normalizeSettings } = require("./settings.js");

const MAX_COMPARE = 4;
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
  let design = loaded && loaded.design ? normalizeDesign(loaded.design) : defaultDesign();
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
  const session = createSession(design);
  const undoStack = [], redoStack = [];
  const listeners = new Set();
  if (settings.badgeBase !== "last" && !saved.some(s => s.id === settings.badgeBase)) settings = { ...settings, badgeBase: "last" };

  const emit = kind => { for (const fn of listeners) fn(kind); };
  const persist = () => { if (storage) storage.save({ design, settings, saved, nextLetter, locks }); };

  function change(nd, key, opts = {}) {
    const started = noteChange(session, key);
    if (started && !opts.noUndo) {
      undoStack.push(clone(session.base));
      if (undoStack.length > 200) undoStack.shift();
      redoStack.length = 0;
    }
    design = nd;
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
      design = r.design;
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
      persist(); emit("saved");
      return entry;
    },
    addSaved(name, d) {
      const entry = { id: "d" + clock().toString(36) + (seq++).toString(36), name: (name || "").trim().slice(0, 40) || letterName(nextLetter++), design: normalizeDesign(d), created: clock(), compare: false };
      saved = [...saved, entry];
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
      saved = saved.map(s => s.id === id ? { ...s, design: clone(design) } : s);
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

module.exports = { createStore, letterName, MAX_COMPARE };
