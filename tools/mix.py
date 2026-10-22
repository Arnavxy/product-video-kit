# python3 tools/mix.py <project>
# Final soundtrack → <project>/mix.wav: voiceover placed per timeline.json, music bed ducked under the voice,
# synth UI sounds at the film's SFX cues (KIT.cue in film.js), loudness-normalised (project.json loudness, default −14 LUFS).
import json, os, subprocess, sys
import numpy as np

proj = sys.argv[1]
P = json.load(open(os.path.join(proj, "project.json")))
TL = json.load(open(os.path.join(proj, "timeline.json")))
SR = 48000
DUR = TL["DUR"]; N = int(DUR * SR)
rng = np.random.default_rng(7)


def load(path, ch):
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", str(ch), "-ar", str(SR), "-"])
    return np.frombuffer(raw, np.float32).reshape(-1, ch).astype(np.float64)


def mavg(x, w):  # fast moving average (np.convolve with a huge window hangs on long films)
    c = np.cumsum(np.concatenate([[0.0], x])); y = (c[w:] - c[:-w]) / w
    pad = len(x) - len(y); return np.concatenate([np.full(pad // 2, y[0]), y, np.full(pad - pad // 2, y[-1])])


# ── voice ──
vo = np.zeros(N)
for lid, v in (TL.get("VO") or {}).items():
    x = load(os.path.join(proj, f"vo/{lid}.mp3"), 1)[:, 0]
    i = int(round(v["at"] * SR)); j = min(N, i + len(x))
    if i < 0: x = x[-i:]; i = 0
    vo[i:j] += x[: j - i]

# ── music, ducked while the voice speaks (attack 0.15 s, release 0.5 s, holds through short pauses) ──
bed_path = os.path.join(proj, "music/bed.wav")
music = load(bed_path, 2)[:N] if os.path.exists(bed_path) else np.zeros((N, 2))
music = np.pad(music, ((0, N - len(music)), (0, 0)))
speaking = (mavg(np.abs(vo), int(0.05 * SR)) > 0.004).astype(float)
speaking = (mavg(speaking, int(0.6 * SR)) > 0.01).astype(float)       # bridge gaps < 0.6 s
env = mavg(speaking, int(0.3 * SR))
duck = 10 ** (P.get("music", {}).get("duck_db", -10) / 20)
music *= (1 - env * (1 - duck))[:, None]

# ── SFX library (all synthesised, no samples) ──
def lp(x, fc):  # one-pole low-pass with a moving cutoff
    a = np.exp(-2 * np.pi * np.asarray(fc) / SR) * np.ones(len(x)); y = np.zeros_like(x); s = 0.0
    for i in range(len(x)): s = (1 - a[i]) * x[i] + a[i] * s; y[i] = s
    return y
def whoosh(d=0.45, up=True):
    n = int(d * SR); u = np.linspace(0, 1, n)
    fc = 300 + 5000 * (u if up else 1 - u) ** 2
    return lp(rng.standard_normal(n), fc) * (np.sin(np.pi * u) ** 1.5 if up else (1 - u) ** 2) * 0.9
def pop(f=880):
    tt = np.arange(int(0.12 * SR)) / SR
    return np.sin(2 * np.pi * (f + 500 * np.exp(-tt * 60)) * tt) * np.exp(-tt * 38) * 0.5
def tap():
    tt = np.arange(int(0.05 * SR)) / SR
    return (np.sin(2 * np.pi * 2200 * tt) * 0.25 + lp(rng.standard_normal(len(tt)), 4000) * 0.6) * np.exp(-tt * 140) * 0.6
def impact():
    tt = np.arange(int(0.9 * SR)) / SR
    return np.sin(2 * np.pi * np.cumsum(48 + 90 * np.exp(-tt * 18)) / SR) * np.exp(-tt * 5) * 0.9 + lp(rng.standard_normal(len(tt)), 2500) * np.exp(-tt * 30) * 0.6
def chime():
    tt = np.arange(int(1.4 * SR)) / SR
    return sum(np.sin(2 * np.pi * f * tt) * np.exp(-tt * 3.2) for f in (1046.5, 1318.5, 1568.0)) * 0.16
def riser(d=1.5):
    n = int(d * SR); u = np.linspace(0, 1, n)
    return lp(rng.standard_normal(n), 200 + 7000 * u ** 2) * u ** 2 * 0.7
def click():
    tt = np.arange(int(0.03 * SR)) / SR
    return (lp(rng.standard_normal(len(tt)), 6000) * np.exp(-tt * 300) + np.sin(2 * np.pi * 1500 * tt) * np.exp(-tt * 200) * 0.3) * 0.7
def glitch():
    n = int(0.25 * SR); y = np.zeros(n)
    for k in range(6):
        a = int(rng.uniform(0, 0.2) * SR); L = int(rng.uniform(0.01, 0.04) * SR); tt = np.arange(L) / SR
        y[a:a + L] += np.sign(np.sin(2 * np.pi * rng.uniform(200, 2000) * tt)) * 0.25
    return y
LIB = {"click": click, "glitch": glitch, "whoosh": lambda: whoosh(), "whooshdown": lambda: whoosh(0.4, False), "pop": pop, "tap": tap,
       "impact": impact, "chime": chime, "riser": riser}
LEAD = {"whoosh": 0.3, "riser": 1.45}   # these peak at the end, so they start early to land on the cue

fx = np.zeros(N)
for c in TL.get("cues", []):
    if c["kind"] not in LIB:
        print("unknown SFX kind", c["kind"], "— known:", ", ".join(LIB)); continue
    s = LIB[c["kind"]]()
    a = int((c["t"] - LEAD.get(c["kind"], 0)) * SR)
    if a < 0: s = s[-a:]; a = 0
    b = min(N, a + len(s)); fx[a:b] += s[: b - a] * c.get("gain", 1)

out = music * 0.85 + ((vo * 1.3) + fx * 0.45)[:, None]
f = int(0.3 * SR); out[-f:] *= np.linspace(1, 0, f)[:, None]
out = np.tanh(out * 1.05) / np.tanh(1.05)               # soft-clip guard
tmp = os.path.join(proj, "mix.f32"); out.astype(np.float32).tofile(tmp)
lufs = P.get("loudness", -14)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", tmp,
                "-af", f"loudnorm=I={lufs}:TP=-1.5:LRA=11", "-ar", str(SR), os.path.join(proj, "mix.wav")], check=True)
os.remove(tmp)
print(f"mix.wav: {DUR:.2f}s, {len(TL.get('VO') or {})} VO lines, {len(TL.get('cues', []))} SFX cues, {lufs} LUFS")
