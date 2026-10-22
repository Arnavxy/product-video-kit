// node tools/render.mjs <project> <mode>
//   info                 → <project>/timeline.json (duration, VO, SFX cues) — mix.py reads it
//   stills 1.2,8.5,...   → <project>/stills/t<time>.jpg   (check moments before a full render)
//   frames [from] [to]   → <project>/frames/f%05d.jpg      (PAGES browser pages in parallel, default 4)
//   encode               → <project>/<project.json "out">  (frames + mix.wav, H.264 + AAC)
// Env: PAGES=6 (more = faster, more RAM), FPS (default project.json fps or 60), BROWSER=chrome|chromium
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { launch } from "./browser.mjs";

const [proj, mode, a3, a4] = process.argv.slice(2);
if (!proj || !mode) { console.log("usage: node tools/render.mjs <project> info|stills|frames|encode"); process.exit(1); }
const DIR = path.resolve(proj);
const P = JSON.parse(fs.readFileSync(path.join(DIR, "project.json"), "utf8"));
const FPS = Number(process.env.FPS || P.fps || 60);
const N = Number(process.env.PAGES || 4);

async function openPages(n) {
  const browser = await launch(["--force-device-scale-factor=1", "--allow-file-access-from-files"]);
  const pages = [];
  let errors = 0;
  for (let i = 0; i < n; i++) {
    const p = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    p.on("pageerror", (e) => { errors++; console.error("PAGE ERROR:", e.message); });
    p.on("console", (m) => { if (m.type() === "error") { errors++; console.error("CONSOLE ERROR:", m.text()); } });
    await p.goto("file://" + path.join(DIR, "film/index.html"));
    const ok = await p.evaluate(() => window.READY).catch((e) => { console.error(e.message); return false; });
    if (!ok || errors) { await browser.close(); console.error("film/index.html failed to load — fix the errors above"); process.exit(1); }
    pages.push(p);
  }
  return { browser, pages };
}
async function shot(p, t, file) {
  await p.evaluate((t) => window.render(t), t);
  fs.writeFileSync(file, await p.screenshot({ type: "jpeg", quality: 94 }));
}

if (mode === "info") {
  const { browser, pages } = await openPages(1);
  const film = await pages[0].evaluate(() => window.FILM);
  await browser.close();
  fs.writeFileSync(path.join(DIR, "timeline.json"), JSON.stringify(film, null, 1));
  console.log(`timeline.json: ${film.DUR}s, ${film.cues.length} SFX cues, ${Object.keys(film.VO || {}).length} VO lines`);
} else if (mode === "stills") {
  const { browser, pages } = await openPages(1);
  const dur = await pages[0].evaluate(() => window.FILM.DUR);
  const ts = a3 ? a3.split(",").map(Number) : Array.from({ length: 12 }, (_, i) => +((i + 0.5) * dur / 12).toFixed(2));
  const out = path.join(DIR, "stills");
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  try { for (const t of ts) await shot(pages[0], t, path.join(out, "t" + t.toFixed(2).padStart(6, "0") + ".jpg")); }
  finally { await browser.close(); }
  console.log("stills →", out, ts.join(", "));
} else if (mode === "frames") {
  const { browser, pages } = await openPages(N);
  const dur = await pages[0].evaluate(() => window.FILM.DUR);
  const from = Number(a3 || 0), to = Number(a4 || Math.ceil(dur * FPS));
  const out = path.join(DIR, "frames");
  fs.mkdirSync(out, { recursive: true });
  const t0 = Date.now();
  let done = 0;
  try {
    const span = Math.ceil((to - from) / N);
    await Promise.all(pages.map(async (p, k) => {
      const a = from + k * span, b = Math.min(to, a + span);
      for (let f = a; f < b; f++) {
        await shot(p, f / FPS, path.join(out, "f" + String(f).padStart(5, "0") + ".jpg"));
        if (++done % 300 === 0) {
          const s = (Date.now() - t0) / 1000;
          console.log(`frame ${done}/${to - from}  ${s.toFixed(0)}s elapsed, ~${(s / done * (to - from - done)).toFixed(0)}s left`);
        }
      }
    }));
  } finally { await browser.close(); }
  console.log(`frames ${from}–${to} done in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
} else if (mode === "encode") {
  const outFile = path.join(DIR, P.out || "out/film.mp4");
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const audio = path.join(DIR, "mix.wav");
  const args = ["-y", "-v", "error", "-framerate", String(FPS), "-start_number", "0", "-i", path.join(DIR, "frames/f%05d.jpg")];
  if (fs.existsSync(audio)) args.push("-i", audio); else console.log("no mix.wav — encoding silent video");
  args.push("-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", "-profile:v", "high", "-movflags", "+faststart");
  if (fs.existsSync(audio)) args.push("-c:a", "aac", "-b:a", "256k", "-shortest");
  args.push(outFile);
  const r = spawnSync("ffmpeg", args, { stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status || 1);
  console.log("→", outFile);
} else {
  console.log("unknown mode", mode); process.exit(1);
}
