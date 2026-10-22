// node record.mjs → desktop take of the dashboard (1440×900 at 2×) + marks, clicks and the mouse path
// (clips/flow/ + film/clip.js). The film draws its own cursor from the logged path.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launch } from "../../tools/browser.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const URL = process.env.URL || "file://" + path.join(HERE, "app/index.html");
const W = 1440, H = 900;
const dir = path.join(HERE, "clips/flow");
fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
const browser = await launch(["--force-device-scale-factor=2", "--hide-scrollbars"]);
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const frames = [], marks = {}, taps = [], moves = [];
let T0 = 0, mx = 720, my = 600;
const rel = () => +(Date.now() / 1000 - T0).toFixed(3);
const mark = (n) => { marks[n] = rel(); };
const wait = (ms) => page.waitForTimeout(ms);
// glide the mouse to an element over `ms`, logging the path; then optionally click
const moveTo = async (loc, ms = 700) => {
  const b = await loc.boundingBox(); const x = b.x + b.width / 2, y = b.y + b.height / 2;
  moves.push({ t: rel(), x: mx, y: my });
  const n = Math.max(2, Math.round(ms / 16));
  for (let i = 1; i <= n; i++) { await page.mouse.move(mx + (x - mx) * i / n, my + (y - my) * i / n); await wait(ms / n); }
  mx = x; my = y; moves.push({ t: rel(), x, y });
};
const click = async (loc, name, ms) => { await moveTo(loc, ms); await wait(120); taps.push({ name, x: mx, y: my, t: rel() }); await page.mouse.click(mx, my); };

await page.goto(URL); await wait(600);
const cdp = await ctx.newCDPSession(page);
let n = 0;
cdp.on("Page.screencastFrame", (f) => {
  const name = `f${String(n++).padStart(5, "0")}.jpg`;
  fs.writeFileSync(path.join(dir, name), Buffer.from(f.data, "base64"));
  frames.push({ name, t: f.metadata.timestamp });
  cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
});
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, everyNthFrame: 1, maxWidth: W * 2, maxHeight: H * 2 });
T0 = Date.now() / 1000; moves.push({ t: 0, x: mx, y: my });
await wait(300);
// ── the take ──
mark("open"); await wait(1500);
await page.mouse.move(mx + 1, my); await page.mouse.move(mx, my);   // nudge so CDP emits a frame
mark("filter");
await click(page.locator('.chip[data-team="design"]'), "design", 900); await wait(1300);
await click(page.locator('.chip[data-team="all"]'), "all", 500); await wait(900);
mark("risk");
await click(page.locator("#riskcard"), "riskcard", 800); await wait(600);
await moveTo(page.locator("tr.risk-row").nth(1).locator(".pill"), 700); mark("inspect"); await wait(2200);
mark("end");
// ──
await cdp.send("Page.stopScreencast").catch(() => {}); await wait(200);
const index = { w: W, h: H, scale: 2, files: frames.map((f) => f.name), t: frames.map((f) => +(f.t - T0).toFixed(3)), marks, taps, moves };
fs.writeFileSync(path.join(dir, "index.json"), JSON.stringify(index));
fs.writeFileSync(path.join(HERE, "film/clip.js"), "window.CLIP=" + JSON.stringify({ ...index, dir: "../clips/flow/" }) + ";\n");
console.log("frames", frames.length, "take", marks.end, "s, moves", moves.length, "→ clips/flow + film/clip.js");
await browser.close();
