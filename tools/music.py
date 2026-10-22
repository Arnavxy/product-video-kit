# python3 tools/music.py <project>
# Builds <project>/music/bed.wav, exactly the film's length (timeline.json DUR):
#   • if project.json music.file exists: that track from music.start, faded out at the end
#   • otherwise: an original synth bed at music.bpm (royalty-free by construction — fine for drafts and internal films)
import json, os, subprocess, sys
import numpy as np

proj = sys.argv[1]
P = json.load(open(os.path.join(proj, "project.json")))
M = P.get("music", {})
DUR = json.load(open(os.path.join(proj, "timeline.json")))["DUR"]
SR = 48000
N = int(DUR * SR)
os.makedirs(os.path.join(proj, "music"), exist_ok=True)
out = os.path.join(proj, "music/bed.wav")


def save(y, path):
    tmp = path + ".f32"
    y.astype(np.float32).tofile(tmp)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", tmp, "-ar", str(SR), path], check=True)
    os.remove(tmp)


track = M.get("file") and os.path.join(proj, M["file"])
if track and os.path.exists(track):
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-ss", str(M.get("start", 0)), "-i", track, "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"])
    y = np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)[:N]
    if len(y) < N:
        print(f"note: track runs out at {len(y) / SR:.1f}s of {DUR:.1f}s — the rest is silence (or pick an earlier music.start)")
        y = np.pad(y, ((0, N - len(y)), (0, 0)))
    f = int(0.01 * SR); y[:f] *= np.linspace(0, 1, f)[:, None]
    fo = int(min(2.5, DUR / 4) * SR); y[-fo:] *= (0.5 + 0.5 * np.cos(np.linspace(0, np.pi, fo)))[:, None]
    save(y, out)
    print(f"bed.wav ← {M['file']} from {M.get('start', 0)}s, {DUR:.2f}s")
    sys.exit()

# ── synth bed: Am7 – Fmaj7 – C – G, pad + pluck arpeggio + kick/bass/hats, grid starts at t = 0 ──
bpm = M.get("bpm", 100); beat = 60 / bpm; bar = 4 * beat
t = np.arange(N) / SR
rng = np.random.default_rng(3)
note = lambda m: 440 * 2 ** ((m - 69) / 12)
prog = [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 60], [55, 59, 62, 66]]
bass = [45, 41, 48, 43]
y = np.zeros(N)
for b in range(int(DUR / bar) + 2):                      # pad
    s0 = int(b * bar * SR)
    if s0 >= N: break
    L = min(int(bar * 1.25 * SR), N - s0); tt = np.arange(L) / SR
    env = np.minimum(1, tt / 0.6) * np.clip((bar * 1.25 - tt) / 0.5, 0, 1)
    sig = sum(np.sin(2 * np.pi * note(m + d) * h * tt + h) / h ** 2 for m in prog[b % 4] for d in (-0.08, 0.08) for h in (1, 2, 3))
    y[s0:s0 + L] += sig * env * 0.03
intro = 2 * bar                                          # drums enter after two bars
for i in range(int(DUR / (beat / 2))):                   # 8th-note pluck arpeggio
    st = i * beat / 2
    if st < intro or st > DUR - 1.5: continue
    ch = prog[int(st / bar) % 4]; m = ch[[0, 2, 1, 3, 2, 1, 3, 2][i % 8]] + 12
    s0 = int(st * SR); L = min(int(0.45 * SR), N - s0); tt = np.arange(L) / SR
    y[s0:s0 + L] += np.sin(2 * np.pi * note(m) * tt) * np.exp(-tt * 9) * 0.045
for i in range(int(DUR / beat)):
    st = i * beat; s0 = int(st * SR)
    if st < intro or st > DUR - 1.5: continue
    L = min(int(0.35 * SR), N - s0); tt = np.arange(L) / SR
    y[s0:s0 + L] += np.sin(2 * np.pi * np.cumsum(50 + 90 * np.exp(-tt * 30)) / SR) * np.exp(-tt * 9) * 0.22   # kick
    L = min(int(beat * SR), N - s0); tt = np.arange(L) / SR
    y[s0:s0 + L] += np.sin(2 * np.pi * note(bass[int(st / bar) % 4]) * tt) * np.minimum(1, tt / 0.02) * np.exp(-tt * 2.5) * 0.09
    h0 = int((st + beat / 2) * SR); L = int(0.05 * SR)
    if h0 + L < N:
        nz = rng.standard_normal(L); nz -= np.convolve(nz, np.ones(4) / 4, "same")
        y[h0:h0 + L] += nz * np.exp(-np.arange(L) / SR * 80) * 0.03
y *= np.minimum(1, t / 1.5) * np.clip((DUR - t) / 2.5, 0, 1)
st = np.stack([y, np.roll(y, int(0.012 * SR))], 1)       # a little width
save(st / max(1e-6, np.abs(st).max()) * 0.8, out)
print(f"bed.wav = synth bed {bpm} BPM, {DUR:.2f}s (drop a track at music/track.mp3 to use real music)")
