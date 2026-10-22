// node record.mjs → captures the site for the film: a 2× full-page image plus every element we pop out,
// with its exact position on the page → assets/site/ + film/site.js. (For a real site: change URL and POP.)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launch } from "../../tools/browser.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const URL = process.env.URL || "file://" + path.join(HERE, "site/index.html");
const OUT = path.join(HERE, "assets/site");
const POP = { headline: ".hero > div:first-child", phone: ".phone", f1: ".feature:nth-child(1)", f2: ".feature:nth-child(2)",
  f3: ".feature:nth-child(3)", stats: ".stat", q1: ".quote:nth-child(1)", pro: ".price.pro", cta: ".cta" };
const SECTIONS = { hero: "nav", features: "#features", stats: "#stats", quotes: "#quotes", pricing: "#pricing", cta: "#cta" };

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const b = await launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await p.goto(URL, { waitUntil: "networkidle" });
// scroll through once so scroll-triggered animations and lazy images fire
const H = await p.evaluate(() => document.documentElement.scrollHeight);
for (let y = 0; y < H; y += 400) { await p.evaluate((y) => scrollTo(0, y), y); await p.waitForTimeout(60); }
await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(500);
await p.screenshot({ path: path.join(OUT, "full.jpg"), fullPage: true, type: "jpeg", quality: 90 });
const site = { w: 1440, h: H, items: {}, sections: {} };
for (const [k, sel] of Object.entries(POP)) {
  const loc = p.locator(sel).first();
  const bb = await p.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height }; }, sel);
  await loc.screenshot({ path: path.join(OUT, k + ".png"), omitBackground: true });
  site.items[k] = { ...bb, file: "../assets/site/" + k + ".png" };
}
for (const [k, sel] of Object.entries(SECTIONS)) site.sections[k] = await p.evaluate((s) => document.querySelector(s).getBoundingClientRect().y + scrollY, sel);
fs.writeFileSync(path.join(HERE, "film/site.js"), "window.SITE=" + JSON.stringify(site) + ";\n");
console.log(`page ${H}px, ${Object.keys(POP).length} pop-outs → assets/site + film/site.js`);
await b.close();
