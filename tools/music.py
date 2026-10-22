# python3 tools/music.py <project>
# Builds <project>/music/bed.wav, exactly the film's length (timeline.json DUR):
#   • if project.json music.file exists: that track from music.start, faded out at the end
#   • otherwise: an original synth bed at music.bpm — style "chill" (default) or "drive" (drop at music.drop_bar,
#     final hit at music.end_bar). Royalty-free by construction.
import json, os, subprocess, sys
import numpy as np

proj = sys.argv[1]
P = json.load(open(os.path.join(proj, "project.json")))
M = P.get("music", {})
TL = json.load(open(os.path.join(proj, "timeline.json")))
DUR = TL["DUR"]
M = {**M, **(TL.get("music") or {})}         # the film may decide e.g. end_bar (KIT.start({ music: { end_bar } }))
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

bpm = M.get("bpm", 100); beat = 60 / bpm; bar = 4 * beat
t = np.arange(N) / SR
rng = np.random.default_rng(3)
note = lambda m: 440 * 2 ** ((m - 69) / 12)


def lowpass(x, fc, order=4):          # FFT low-pass (fast, zero-phase)
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X / (1 + (f / fc) ** order), len(x))


def add(y, at, sig, g=1.0):
    i = int(at * SR)
    if i >= len(y): return
    j = min(len(y), i + len(sig)); y[i:j] += sig[: j - i] * g


if M.get("style", "chill") == "drive":
    # ── drive: four-on-the-floor, Fm–Db–Ab–Eb, filtered intro + riser, drop at drop_bar, end hit at end_bar ──
    drop, endb = M.get("drop_bar", 2), M.get("end_bar", int(DUR / bar) - 1)
    prog = [[53, 56, 60], [49, 53, 56], [56, 60, 63], [51, 55, 58]]
    roots = [41, 37, 44, 39]
    kick = np.zeros(N); body = np.zeros(N); top = np.zeros(N)
    def saw(f, L, det=(-0.11, -0.04, 0, 0.05, 0.12)):
        tt = np.arange(L) / SR
        return sum(2 * ((f * 2 ** (d / 12) * tt + rng.random()) % 1) - 1 for d in det) / len(det)
    for b in range(int(DUR / bar) + 1):
        b0 = b * bar
        if b > endb: break
        ch, rt = prog[b % 4], roots[b % 4]
        if b == endb:                                   # final hit: big chord + boom, rings out
            L = int(min(3.0, DUR - b0) * SR); tt = np.arange(L) / SR
            env = np.exp(-tt * 1.4)
            add(body, b0, sum(saw(note(m + 12), L) for m in ch) * env * 0.22)
            add(body, b0, np.sin(2 * np.pi * note(rt - 12) * tt) * env * 0.5)
            add(kick, b0, np.sin(2 * np.pi * np.cumsum(45 + 120 * np.exp(-tt * 25)) / SR) * np.exp(-tt * 3) * 1.0)
            break
        L = int(bar * SR); tt = np.arange(L) / SR
        if b < drop:                                    # intro: soft pad + offbeat hats + riser in the last bar
            add(body, b0, sum(saw(note(m), L) for m in ch) * np.minimum(1, tt / 0.3) * 0.08)
            for q in range(8):
                if q % 2: add(top, b0 + q * beat / 2, rng.standard_normal(int(0.03 * SR)) * np.exp(-np.arange(int(0.03 * SR)) / SR * 120) * 0.1)
            if b == drop - 1:
                u = tt / bar
                add(top, b0, rng.standard_normal(L) * u ** 2 * 0.25)        # noise riser
                for q in range(16):                                         # snare roll, 16ths, rising
                    if q >= 8: add(top, b0 + q * beat / 4, rng.standard_normal(int(0.06 * SR)) * np.exp(-np.arange(int(0.06 * SR)) / SR * 50) * (0.1 + 0.25 * q / 16))
            continue
        for q in range(4):                              # drop: kick every beat, bass on offbeats, clap on 2 & 4
            s0 = b0 + q * beat; Lk = int(0.3 * SR); tk = np.arange(Lk) / SR
            add(kick, s0, np.sin(2 * np.pi * np.cumsum(48 + 130 * np.exp(-tk * 35)) / SR) * np.exp(-tk * 10))
            Lb = int(beat / 2 * SR); tb = np.arange(Lb) / SR
            add(body, s0 + beat / 2, saw(note(rt), Lb, (0, 0.08)) * np.exp(-tb * 4) * 0.35)
            if q % 2:
                Lc = int(0.15 * SR); tc = np.arange(Lc) / SR
                add(top, s0, rng.standard_normal(Lc) * (np.exp(-tc * 30) + 0.5 * np.exp(-np.maximum(0, tc - 0.012) * 30) * (tc > 0.012)) * 0.25)
            for h in range(2):
                Lh = int((0.09 if h else 0.03) * SR)
                add(top, s0 + h * beat / 2, rng.standard_normal(Lh) * np.exp(-np.arange(Lh) / SR * (35 if h else 120)) * 0.08)
        for q in (0, 1.5, 2.5):                          # supersaw stabs
            Ls = int(beat * 0.45 * SR); ts = np.arange(Ls) / SR
            add(body, b0 + q * beat, sum(saw(note(m + 12), Ls) for m in ch) * np.exp(-ts * 6) * 0.16)
    hi = top - lowpass(top, 3000)
    body = lowpass(body, 4200)
    # sidechain pump: everything except the kick dips on each beat after the drop
    ph = (t / beat) % 1
    pump = np.where(t >= drop * bar, 0.35 + 0.65 * np.minimum(1, ph / 0.45) ** 1.5, 1.0)
    # intro filter: body opens up toward the drop
    intro = t < drop * bar
    body[intro] = lowpass(body, 900)[intro] * 1.4
    mixd = kick * 0.9 + (body * 1.0 + hi * 1.2) * pump
    # small room reverb on the non-kick parts
    ir = rng.standard_normal(int(0.8 * SR)) * np.exp(-np.arange(int(0.8 * SR)) / SR * 6) * 0.02
    wet = np.fft.irfft(np.fft.rfft(body * pump, N + len(ir)) * np.fft.rfft(ir, N + len(ir)), N + len(ir))[:N]
    y = mixd + wet
    y *= np.clip((DUR - t) / 0.5, 0, 1)
    st = np.stack([y + 0.3 * np.roll(wet, 300), y + 0.3 * np.roll(wet, 700)], 1)
    save(st / max(1e-6, np.abs(st).max()) * 0.85, out)
    print(f"bed.wav = drive synth {bpm} BPM, drop bar {drop} ({drop * bar:.2f}s), end hit bar {endb} ({endb * bar:.2f}s)")
    sys.exit()

# ── chill (default): Am7 – Fmaj7 – C – G, pad + pluck arpeggio + kick/bass/hats, grid starts at t = 0 ──
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
