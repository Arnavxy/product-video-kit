# python3 tools/beatgrid.py <project>
# Fits the beat grid of <project>/music/track.mp3 (or project.json music.file) from its drum hits
# → <project>/music/grid.json {bpm, beat, t0, downbeat, residual_ms}.
# Never trust a BPM from a website or a quick estimate: a 0.5% error drifts a whole beat in two minutes.
# Then set project.json music.start to a bar time (printed below) where you want the film to begin.
#
# How: rough tempo from autocorrelation, then a least-squares fit t = t0 + k·beat over sample-accurate onsets
# from two bands — kick drum (< 120 Hz) and transients (2–10 kHz: claps, hats, clicks). The band with the
# tighter fit sets the tempo; the kick (when steady) sets where the beat falls.
import json, os, subprocess, sys
import numpy as np

proj = sys.argv[1]
P = json.load(open(os.path.join(proj, "project.json")))
src = os.path.join(proj, P.get("music", {}).get("file") or "music/track.mp3")
if not os.path.exists(src):
    sys.exit(f"no music file at {src}")
SR = 22050
x = np.frombuffer(subprocess.check_output(["ffmpeg", "-v", "error", "-i", src, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"]), np.float32).astype(np.float64)
dur = len(x) / SR

# ── rough tempo: autocorrelation of spectral flux, 60–190 BPM, mild preference for 90–150 ──
HOP, NF = 256, 2048
n = 1 + (len(x) - NF) // HOP
fr = np.lib.stride_tricks.as_strided(x, (n, NF), (x.strides[0] * HOP, x.strides[0]))
S = np.log1p(100 * np.abs(np.fft.rfft(fr * np.hanning(NF), axis=1)))
flux = np.maximum(0, np.diff(S, axis=0)).sum(1)
env = np.maximum(flux - np.convolve(flux, np.ones(16) / 16, "same"), 0)
lags = np.arange(int(60 / 190 * SR / HOP), int(SR / HOP) + 1)
ac = np.array([np.dot(env[:-l], env[l:]) for l in lags])
bpm_l = 60 * SR / HOP / lags
beat0 = lags[int(np.argmax(ac * np.exp(-0.5 * ((bpm_l - 120) / 45) ** 2)))] * HOP / SR


# ── sample-accurate onsets in a frequency band: where each hit starts on the 5 ms envelope ──
X = np.fft.rfft(x); F = np.fft.rfftfreq(len(x), 1 / SR)
def onsets(lo, hi, refractory, start=False):
    Y = X.copy(); Y[(F < lo) | (F > hi)] = 0
    e = np.abs(np.fft.irfft(Y, len(x)))
    w = int(0.005 * SR); e = np.convolve(e, np.ones(w) / w, "same")
    out, W4 = [], int(4 * SR)
    for s0 in range(0, len(e), W4):
        seg = e[s0:s0 + W4]; th = 0.5 * seg.max()
        if seg.max() < 0.05 * e.max(): continue
        for c in np.flatnonzero((seg[1:] > th) & (seg[:-1] <= th)):
            j, lim = c, max(0, c - int(0.08 * SR))   # start=True: walk back to where the hit begins (10% of peak).
            while start and j > lim and seg[j] > 0.2 * th: j -= 1   # low bands rise slowly: half-rise reads ~40 ms late
            out.append((j + s0) / SR)
    kept = []
    for o in out:
        if not kept or o - kept[-1] > refractory: kept.append(o)
    return np.array(kept)


def fit(on, beat):
    if len(on) < 20: return None
    # fine tempo + phase: the period (±4% of the rough tempo) at which onsets line up best (circular coherence)
    cands = beat * np.linspace(0.96, 1.04, 4001)
    z = np.exp(2j * np.pi * on[None, :] / cands[:, None]).mean(1)
    i = int(np.argmax(np.abs(z))); beat = cands[i]
    t0 = (np.angle(z[i]) / (2 * np.pi) * beat) % beat
    for tol in (0.04, 0.025, 0.02):
        k = np.round((on - t0) / beat); m = np.abs(on - (t0 + k * beat)) < tol
        if m.sum() < 20: return None
        (t0, beat), *_ = np.linalg.lstsq(np.vstack([np.ones(m.sum()), k[m]]).T, on[m], rcond=None)
    k = np.round((on - t0) / beat); r = on - (t0 + k * beat); m = np.abs(r) < 0.02
    return {"t0": t0 % beat, "beat": beat, "res": float(np.sqrt(np.mean(r[m] ** 2))), "n": int(m.sum())}


kick = onsets(20, 120, 0.6 * beat0)
trans = onsets(2000, 10000, 0.2 * beat0)
nbeats = dur / beat0
fits = {}
for name, on in (("kick", kick), ("transients", trans)):
    f = fit(on, beat0)
    if f and f["n"] >= 0.2 * nbeats: fits[name] = f
if not fits:
    sys.exit("could not find a steady beat (no clear drums?). Use music without a beat grid: leave snapToBeat false.")
best = min(fits, key=lambda k: fits[k]["res"])
g = fits[best]; beat, t0 = g["beat"], g["t0"]
# phase: kicks sit on beats, claps/hats often on off-beats — so when the kick is consistent, it sets the phase
kick_start = onsets(20, 120, 0.6 * beat0, start=True)    # half-rise is steadier for tempo, hit start for phase
if len(kick_start) >= 20:
    zk = np.exp(2j * np.pi * (kick_start - t0) / beat).mean()
    if abs(zk) > 0.4:
        t0 = (t0 + np.angle(zk) / (2 * np.pi) * beat) % beat
# downbeat: which of the 4 beat phases carries the most kick
beats = t0 + beat * np.arange(int((dur - t0) / beat))
if len(kick) >= 20:
    near = lambda p: np.sum(np.min(np.abs(kick[:, None] - beats[p::4][None, :]), axis=1) < 0.04)
    down = beats[int(np.argmax([near(p) for p in range(4)]))]
else:
    down = beats[0]
out = {"file": os.path.relpath(src, proj), "bpm": round(60 / beat, 4), "beat": round(beat, 6), "bar": round(4 * beat, 6),
       "t0": round(t0, 4), "downbeat": round(down, 4), "residual_ms": round(1000 * g["res"], 2), "matched_onsets": g["n"],
       "method": best, "duration": round(dur, 2)}
json.dump(out, open(os.path.join(proj, "music/grid.json"), "w"), indent=1)
print(json.dumps(out, indent=1))
if g["res"] > 0.012:
    print("WARNING: loose fit (>12 ms). The track may have tempo changes or swing; check by ear.")
print("The downbeat (bar 1) is a best guess from the kick pattern — confirm by ear.")

rms = np.sqrt(np.convolve(x ** 2, np.ones(SR // 10) / (SR // 10), "same"))
print("\nbar  start(s)  loudness   (pick music.start = a bar start; a drop is where loudness jumps)")
b, i = down % (4 * beat), 0
while b < dur - 1:
    db = 20 * np.log10(rms[int(b * SR): int((b + 4 * beat) * SR)].mean() + 1e-9)
    print(f"{i:3}  {b:8.3f}  {db:6.1f} dB  " + "#" * max(0, int((db + 40) / 1.5)))
    b += 4 * beat; i += 1
