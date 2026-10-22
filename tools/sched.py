# python3 tools/sched.py <project>
# Places every VO line on the film timeline (gap before each line, optional snap to the music's beat)
# and writes <project>/film/data.js = window.PROJECT + window.VO (absolute word times) + window.MUSIC (beat grid).
import json, math, os, sys

proj = sys.argv[1]
P = json.load(open(os.path.join(proj, "project.json")))
lp = os.path.join(proj, "vo/lines.json")
L = json.load(open(lp)) if os.path.exists(lp) else {}
M = P.get("music", {})

grid_path = os.path.join(proj, "music/grid.json")
track = M.get("file") and os.path.exists(os.path.join(proj, M["file"]))
if track and os.path.exists(grid_path):
    g = json.load(open(grid_path))
    beat = g["beat"]
    # film t=0 = source time music.start (pick a downbeat), so beats land on t0 + k*beat in film time
    t0 = (g["t0"] - M.get("start", 0)) % beat
    music = {"source": "track", "bpm": g["bpm"], "beat": beat, "bar": 4 * beat, "t0": round(t0, 4)}
else:
    if track:
        print("warning: music/track.mp3 found but no music/grid.json — run tools/beatgrid.py first; using synth grid")
    bpm = M.get("bpm", 100)
    music = {"source": "synth", "bpm": bpm, "beat": 60 / bpm, "bar": 240 / bpm, "t0": 0.0}

t = P.get("lead", 0.8)
vo = {}
for ln in P["lines"]:
    lid = ln["id"]
    w = L[lid]["words"]
    t += ln.get("gap", 0.6)
    if P.get("snapToBeat") and ln.get("snap", True):
        b = music["beat"]
        t = music["t0"] + math.ceil((t - music["t0"]) / b - 0.01) * b   # speech starts on the next beat
    at = t - w[0]["t"]                                                   # file start so the first word lands on t
    vo[lid] = {"at": round(at, 3), "start": round(t, 3), "end": round(at + w[-1]["t"] + w[-1]["d"], 3),
               "text": ln["text"], "words": [{"w": x["w"], "t": round(at + x["t"], 3), "d": x["d"]} for x in w]}
    t = vo[lid]["end"]
speech_end = t
music.update({k: M[k] for k in ("drop_bar", "end_bar", "style") if k in M})
data = {"PROJECT": {k: P[k] for k in ("title", "fps", "lead", "tail", "width", "height") if k in P}, "VO": vo, "MUSIC": music}
data["PROJECT"]["speechEnd"] = round(speech_end, 3)
with open(os.path.join(proj, "film/data.js"), "w") as f:
    for k, v in data.items():
        f.write(f"window.{k}={json.dumps(v)};\n")
for lid, v in vo.items():
    print(f"{lid:10} {v['start']:7.2f} → {v['end']:7.2f}  {v['text'][:60]}")
print("speech ends", round(speech_end, 2), "s · music", music["source"], round(music["bpm"], 2), "BPM")
