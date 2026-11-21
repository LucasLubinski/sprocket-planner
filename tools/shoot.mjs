// Build dist/planner.html, open it from disk in headless Chrome, and save
// screenshots. Prints any page errors.
//   node tools/shoot.mjs <outDir> [name] [width] [height] [--full] [--eval "js"]
import path from "node:path";
import fs from "node:fs";
import { pathToFileURL, fileURLToPath } from "node:url";
import { build } from "./build.mjs";
import { launch } from "./cdp.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = n => { const i = args.indexOf(n); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const full = args.includes("--full"); if (full) args.splice(args.indexOf("--full"), 1);
const pre = flag("--eval");
const [outDir = ".", name = "shot", w = "1366", hgt = "768"] = args;

build();
const browser = await launch();
if (!browser) { console.error("Chrome not found"); process.exit(2); }
try {
  const page = await browser.newPage();
  const width = +w, height = +hgt;
  await page.viewport(width, height, { mobile: width < 600, touch: width < 600 });
  await page.goto(pathToFileURL(path.join(ROOT, "dist", "planner.html")).href);
  await page.eval("localStorage.clear(); location.reload(); 1");
  await page.sleep(600);
  if (pre) { const r = await page.eval(pre); if (r !== undefined) console.log("eval:", JSON.stringify(r)); await page.sleep(300); }
  fs.mkdirSync(outDir, { recursive: true });
  const file = await page.screenshot(path.join(outDir, name + ".png"), { full });
  const info = await page.eval(`({ scrollW: document.scrollingElement.scrollWidth, innerW: innerWidth, renderMs: window.SprocketPlanner && window.SprocketPlanner.lastRenderMs })`);
  console.log(file, JSON.stringify(info));
  if (page.errors.length) { console.log("PAGE ERRORS:"); for (const e of page.errors) console.log("  " + e); }
} finally {
  await browser.close();
}
