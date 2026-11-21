"use strict";
// Edit sessions and badge baselines.
//
// The baseline is the design just before the current edit began. Focusing a
// field, starting a drag, or clicking a button begins a new edit, but the old
// badges stay until that new edit actually changes something. So typing 1, 18,
// 180 into "Wheel turns" badges the change from 360, not from 18, and tabbing
// through boxes doesn't wipe the badges.

const clone = d => JSON.parse(JSON.stringify(d));

function createSession(design) {
  return { base: clone(design), pending: null, changed: [], source: null, editId: 0 };
}

// Something may be about to change: remember the design as it is now.
function beginEdit(sess, design, source) {
  sess.pending = { base: clone(design), source: source || null };
}

// A change happened. Returns true if it started a new edit (so the caller can
// push the old baseline onto the undo stack).
function noteChange(sess, key) {
  let started = false;
  if (sess.pending) {
    sess.base = sess.pending.base;
    sess.source = sess.pending.source;
    sess.changed = [];
    sess.pending = null;
    sess.editId++;
    started = true;
  }
  if (key && !sess.changed.includes(key)) sess.changed.push(key);
  return started;
}

// Start over: no badges until the next edit.
function resetBaseline(sess, design) {
  sess.base = clone(design);
  sess.pending = null;
  sess.changed = [];
  sess.editId++;
}

module.exports = { createSession, beginEdit, noteChange, resetBaseline, clone };
