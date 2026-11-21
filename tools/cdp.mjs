// A small Chrome DevTools Protocol driver with no dependencies (Node 22+ has
// WebSocket built in). Used for screenshots and the UI acceptance tests.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  path.join(process.env.LOCALAPPDATA || "", "Google/Chrome/Application/chrome.exe"),
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
].filter(Boolean);

export function findChrome() { return CANDIDATES.find(p => { try { return fs.statSync(p).isFile(); } catch { return false; } }) || null; }

const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function launch({ headless = true, extraArgs = [] } = {}) {
  const exe = findChrome();
  if (!exe) return null;
  if (typeof WebSocket === "undefined") throw new Error("Node 22 or newer is needed (built-in WebSocket).");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sprocket-chrome-"));
  const args = [
    headless ? "--headless=new" : "", "--remote-debugging-port=0", "--user-data-dir=" + dir,
    "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--disable-background-networking",
    "--disable-component-update", "--disable-sync", "--allow-file-access-from-files", "--force-color-profile=srgb",
    ...extraArgs, "about:blank"
  ].filter(Boolean);
  const proc = spawn(exe, args, { stdio: "ignore" });
  const portFile = path.join(dir, "DevToolsActivePort");
  for (let i = 0; i < 200 && !fs.existsSync(portFile); i++) await sleep(50);
  let text = "";
  for (let i = 0; i < 40; i++) { try { text = fs.readFileSync(portFile, "utf8"); if (text.includes("\n")) break; } catch {} await sleep(50); }
  const [port, wsPath] = text.trim().split("\n");
  const ws = new WebSocket("ws://127.0.0.1:" + port + wsPath);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map(), listeners = [];
  ws.onmessage = ev => {
    const msg = JSON.parse(typeof ev.data === "string" ? ev.data : Buffer.from(ev.data).toString());
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id); pending.delete(msg.id);
      msg.error ? rej(new Error(msg.error.message + " " + (msg.error.data || ""))) : res(msg.result);
    } else for (const l of listeners) l(msg);
  };
  const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const mid = ++id;
    pending.set(mid, { res, rej });
    ws.send(JSON.stringify({ id: mid, method, params, sessionId }));
  });
  const browser = {
    send,
    async newPage() {
      const { targetId } = await send("Target.createTarget", { url: "about:blank" });
      const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
      return makePage(send, listeners, sessionId, targetId);
    },
    async close() {
      try { await send("Browser.close"); } catch {}
      try { ws.close(); } catch {}
      try { proc.kill(); } catch {}
      for (let i = 0; i < 20; i++) { try { fs.rmSync(dir, { recursive: true, force: true }); break; } catch { await sleep(100); } }
    }
  };
  return browser;
}

async function makePage(send, listeners, sessionId, targetId) {
  const s = (m, p) => send(m, p, sessionId);
  const errors = [];
  const waiters = [];
  listeners.push(msg => {
    if (msg.sessionId !== sessionId) return;
    if (msg.method === "Runtime.exceptionThrown") errors.push(msg.params.exceptionDetails.exception ? msg.params.exceptionDetails.exception.description : msg.params.exceptionDetails.text);
    if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") errors.push(msg.params.args.map(a => a.value || a.description).join(" "));
    if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") errors.push(msg.params.entry.text + " " + (msg.params.entry.url || ""));
    for (const w of waiters.slice()) if (w.method === msg.method) { waiters.splice(waiters.indexOf(w), 1); w.res(msg.params); }
  });
  await s("Page.enable"); await s("Runtime.enable"); await s("Log.enable");
  const waitFor = method => new Promise(res => waiters.push({ method, res }));
  const page = {
    errors, send: s,
    async viewport(width, height, { mobile = false, dpr = 1, touch = false } = {}) {
      await s("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: dpr, mobile });
      await s("Emulation.setTouchEmulationEnabled", { enabled: touch, maxTouchPoints: touch ? 5 : 1 });
    },
    async media(features) { await s("Emulation.setEmulatedMedia", { features }); },
    async goto(url) {
      const loaded = waitFor("Page.loadEventFired");
      await s("Page.navigate", { url });
      await loaded;
      await sleep(150);
    },
    async eval(expr) {
      const r = await s("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true });
      if (r.exceptionDetails) throw new Error("eval failed: " + (r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text) + "\n" + expr.slice(0, 300));
      return r.result.value;
    },
    async screenshot(file, { full = false } = {}) {
      let clip;
      if (full) {
        const m = await s("Page.getLayoutMetrics");
        const c = m.cssContentSize || m.contentSize;
        clip = { x: 0, y: 0, width: Math.ceil(c.width), height: Math.ceil(c.height), scale: 1 };
      }
      const r = await s("Page.captureScreenshot", { format: "png", captureBeyondViewport: full, clip });
      fs.writeFileSync(file, Buffer.from(r.data, "base64"));
      return file;
    },
    async mouse(type, x, y, opts = {}) {
      await s("Input.dispatchMouseEvent", { type, x, y, button: opts.button || "left", buttons: opts.buttons !== undefined ? opts.buttons : (type === "mouseReleased" ? 0 : 1), clickCount: opts.clickCount || 1, modifiers: opts.modifiers || 0 });
    },
    async click(x, y) { await page.mouse("mouseMoved", x, y, { buttons: 0 }); await page.mouse("mousePressed", x, y); await page.mouse("mouseReleased", x, y); },
    async key(key, { code, text, modifiers = 0, keyCode } = {}) {
      const base = { key, code: code || key, modifiers, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode };
      await s("Input.dispatchKeyEvent", { type: text ? "keyDown" : "rawKeyDown", text, ...base });
      await s("Input.dispatchKeyEvent", { type: "keyUp", ...base });
    },
    async type(text) { for (const ch of text) await s("Input.insertText", { text: ch }); },
    sleep,
    async close() { try { await send("Target.closeTarget", { targetId }); } catch {} }
  };
  return page;
}
