"use strict";
// The OpenSCAD model, unchanged, as one string. In Node it is read from
// reference/polycarb_sprocket.scad; tools/build.mjs replaces this module with
// the file's text so the page carries the whole model inside it.
const fs = require("fs");
const path = require("path");
module.exports = fs.readFileSync(path.join(__dirname, "..", "reference", "polycarb_sprocket.scad"), "utf8").replace(/\r\n/g, "\n");
