// node record.mjs → records the app as CDP screencast frames + a mark/tap log into clips/flow/
// One continuous take in real time; the director (film/film.js) retimes it to the voiceover.
// For your product: change URL, the viewport, and the steps between startScreencast and stopScreencast.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launch } from "../../tools/browser.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const URL = process.env.URL || "file://" + path.join(HERE, "../example/demo-app/index.html");
const W = 390, H = 797;                          // phone screen in CSS px (iPhone 14-ish minus status bar)
const dir = path.join(HERE, "clips/flow");
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });

const browser = await launch(["--force-device-scale-factor=2", "--hide-scrollbars"]);
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR", e.message.slice(0, 200)));

const frames = [], marks = {}, taps = [];
let T0 = 0;
const now = () => Date.now() / 1000;
const rel = () => +(now() - T0).toFixed(3);
const mark = (name) => { marks[name] = rel(); console.log("mark", name, marks[name]); };
const wait = (ms) => page.waitForTimeout(ms);
const tap = async (loc, name) => {
  await loc.waitFor({ state: "visible", timeout: 15000 });
  const b = await loc.boundingBox();
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  await page.mouse.move(x, y);
  taps.push({ name, x: +x.toFixed(1), y: +y.toFixed(1), t: rel() });
  await page.mouse.click(x, y);
};
const type = async (text, ms = 70) => { for (const ch of text) { await page.keyboard.type(ch); await wait(ms); } };

await page.goto(URL);
await page.waitForLoadState("networkidle").catch(() => {});
// wait for every image so nothing pops in mid-take
await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 20000 }).catch(() => {});
await wait(800);

const cdp = await ctx.newCDPSession(page);
let n = 0;
cdp.on("Page.screencastFrame", (f) => {
  const name = `f${String(n++).padStart(5, "0")}.jpg`;
  fs.writeFileSync(path.join(dir, name), Buffer.from(f.data, "base64"));
  frames.push({ name, t: f.metadata.timestamp });
  cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
});
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, everyNthFrame: 1, maxWidth: W * 2, maxHeight: H * 2 });
T0 = now();
await wait(300);

// ── the take ────────────────────────────────────────────────────────────────
mark("open");
await wait(1500);
mark("add");
await tap(page.getByLabel("New task"), "field");
await wait(300);
await type("Plan the weekend trip");
await wait(400);
await tap(page.getByRole("button", { name: "Add" }), "add_btn");
await wait(1400);
mark("tick");
for (let i = 0; i < 5; i++) {
  await tap(page.locator(`li[data-i="${i}"]`), "tick" + i);
  await wait(i < 4 ? 650 : 400);
}
mark("done");
await wait(2600);
mark("end");
// ────────────────────────────────────────────────────────────────────────────

await cdp.send("Page.stopScreencast").catch(() => {});
await wait(300);
// CDP only sends a frame when the page changes; frame i is shown from t[i] until t[i+1].
const index = { w: W, h: H, scale: 2, files: frames.map((f) => f.name), t: frames.map((f) => +(f.t - T0).toFixed(3)), marks, taps };
fs.writeFileSync(path.join(dir, "index.json"), JSON.stringify(index));
fs.mkdirSync(path.join(HERE, "film"), { recursive: true });
fs.writeFileSync(path.join(HERE, "film/clip.js"), "window.CLIP=" + JSON.stringify({ ...index, dir: "../clips/flow/" }) + ";\n");
console.log("frames", frames.length, "take", marks.end, "s → clips/flow + film/clip.js");
await browser.close();
