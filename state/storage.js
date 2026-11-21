"use strict";
// localStorage under one uniquely named, versioned key, always in try/catch.
// Saved designs live in this browser on this laptop. A newer planner.html
// reads the same key (and any older keys listed below), so saved designs carry
// over when Danielle hands out a new version.
const { normalizeDesign } = require("../core/params.js");

const KEY = "sprocketPlanner.v1";
const OLDER_KEYS = []; // add older keys here, newest first, when the format changes
const DATA_VERSION = 1;

function getLocalStorage(win) {
  try { return win && win.localStorage ? win.localStorage : null; } catch (e) { return null; }
}

function createStorage(ls) {
  const st = {
    ok: !!ls,
    key: KEY,
    load() {
      if (!ls) { st.ok = false; return null; }
      for (const k of [KEY, ...OLDER_KEYS]) {
        let raw = null;
        try { raw = ls.getItem(k); } catch (e) { st.ok = false; return null; }
        if (raw) {
          try { return migrate(JSON.parse(raw)); } catch (e) { return null; }
        }
      }
      return null;
    },
    save(data) {
      if (!ls) { st.ok = false; return false; }
      try { ls.setItem(KEY, JSON.stringify({ ...data, version: DATA_VERSION })); st.ok = true; return true; }
      catch (e) { st.ok = false; return false; }
    }
  };
  // Probe once so the page can say right away if designs won't be remembered.
  if (ls) {
    try { const t = "__sprocketPlanner_probe"; ls.setItem(t, "1"); ls.removeItem(t); }
    catch (e) { st.ok = false; }
  }
  return st;
}

// Bring older data up to the current shape. Version 1 is the first.
function migrate(data) {
  if (!data || typeof data !== "object") return null;
  return data;
}

// ---- design files (save to a small file, open it on another laptop) ----
function designFile(name, design) {
  return JSON.stringify({ app: "Sprocket Planner", kind: "design", version: DATA_VERSION, name, design }, null, 2) + "\n";
}

function readDesignFile(text) {
  let j;
  try { j = JSON.parse(text); } catch (e) { return { ok: false, error: "This file isn't a Sprocket Planner design." }; }
  if (!j || j.app !== "Sprocket Planner" || j.kind !== "design" || typeof j.design !== "object") {
    return { ok: false, error: "This file isn't a Sprocket Planner design." };
  }
  return { ok: true, name: typeof j.name === "string" && j.name.trim() ? j.name.trim().slice(0, 40) : "Opened design", design: normalizeDesign(j.design) };
}

function safeFileName(name) {
  return (name || "design").replace(/[^A-Za-z0-9 _.-]+/g, "").trim().replace(/\s+/g, "_").slice(0, 40) || "design";
}

module.exports = { KEY, OLDER_KEYS, DATA_VERSION, getLocalStorage, createStorage, designFile, readDesignFile, safeFileName };
