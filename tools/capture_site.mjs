// node tools/capture_site.mjs <url> <out_dir> [width=1440]
// Captures a website for a film: scrolls the whole page first (so scroll-reveal animations fire and lazy
// images load), then saves a 2× screenshot of every <section>, the full page, and the raw image files.
// Use the pieces as layers in film.js (a scrolling "browser" shot, cards popping out, etc.).
import fs from "node:fs";
import path from "node:path";
import { launch } from "./browser.mjs";

const [url, out, width = "1440"] = process.argv.slice(2);
if (!url || !out) { console.log("usage: node tools/capture_site.mjs <url> <out_dir> [width]"); process.exit(1); }
fs.mkdirSync(out, { recursive: true });
const b = await launch();
const p = await b.newPage({ viewport: { width: Number(width), height: 900 }, deviceScaleFactor: 2 });
await p.goto(url, { waitUntil: "networkidle" });
const H = await p.evaluate(() => document.documentElement.scrollHeight);
for (let y = 0; y < H; y += 300) { await p.evaluate((y) => scrollTo(0, y), y); await p.waitForTimeout(120); }
await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(1000);
await p.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 20000 }).catch(() => {});

const srcs = await p.evaluate(() => [...new Set([...document.images].map((i) => i.currentSrc).filter(Boolean))]);
fs.mkdirSync(path.join(out, "images"), { recursive: true });
for (const s of srcs) {
  try { const r = await p.request.get(s); fs.writeFileSync(path.join(out, "images", decodeURIComponent(s.split("/").pop().split("?")[0]).slice(-80)), await r.body()); } catch {}
}
const secs = p.locator("section");
const n = await secs.count();
for (let i = 0; i < n; i++) {
  const s = secs.nth(i); const bb = await s.boundingBox();
  if (!bb || bb.height < 40) continue;
  await s.scrollIntoViewIfNeeded(); await p.waitForTimeout(400);
  await s.screenshot({ path: path.join(out, `section${String(i).padStart(2, "0")}.png`) });
}
await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(600);
await p.screenshot({ path: path.join(out, "full.png"), fullPage: true });
console.log(`${n} sections, ${srcs.length} images, full.png → ${out}`);
console.log("check full.png: some sites repeat content in fullPage shots (sticky/virtual layouts) — crop if so");
await b.close();
