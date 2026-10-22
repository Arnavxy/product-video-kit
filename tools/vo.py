# python3 tools/vo.py <project> [line_id ...]
# Voiceover with Microsoft Edge neural voices (edge-tts, free, no key): one mp3 per line in project.json
# + word timings → <project>/vo/lines.json. Unchanged lines are reused; pass ids to force a redo.
import asyncio, hashlib, json, os, subprocess, sys
import edge_tts

proj = sys.argv[1]
force = set(sys.argv[2:])
P = json.load(open(os.path.join(proj, "project.json")))
VOICE, RATE, PITCH = P.get("voice", "en-US-AndrewNeural"), P.get("rate", "+0%"), P.get("pitch", "+0Hz")
os.makedirs(os.path.join(proj, "vo"), exist_ok=True)
OUT = os.path.join(proj, "vo/lines.json")
old = json.load(open(OUT)) if os.path.exists(OUT) else {}


def key(text):
    return hashlib.sha1(f"{VOICE}|{RATE}|{PITCH}|{text}".encode()).hexdigest()[:12]


async def one(lid, text):
    mp3 = os.path.join(proj, f"vo/{lid}.mp3")
    words = []
    com = edge_tts.Communicate(text, VOICE, rate=RATE, pitch=PITCH, boundary="WordBoundary")
    with open(mp3, "wb") as f:
        async for ch in com.stream():
            if ch["type"] == "audio":
                f.write(ch["data"])
            elif ch["type"] == "WordBoundary":
                words.append({"w": ch["text"], "t": round(ch["offset"] / 1e7, 3), "d": round(ch["duration"] / 1e7, 3)})
    if not words:
        raise RuntimeError("no word timings")
    dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp3]))
    return {"text": text, "key": key(text), "dur": round(dur, 3), "words": words}


async def retry(lid, text):
    # edge-tts sometimes returns NoAudioReceived / 403 — wait and retry
    for k in range(12):
        try:
            return await one(lid, text)
        except Exception as e:
            print(f"  retry {lid} #{k + 1}: {e}", flush=True)
            await asyncio.sleep(2 + 2 * k)
    sys.exit(f"TTS failed for {lid}. If it keeps failing: pip3 install --user -U edge-tts")


async def main():
    res = {}
    if not P.get("lines"):
        json.dump({}, open(OUT, "w")); print("no VO lines (music-only film)"); return
    for ln in P["lines"]:
        lid, text = ln["id"], ln["text"]
        o = old.get(lid)
        if o and o.get("key") == key(text) and lid not in force and os.path.exists(os.path.join(proj, f"vo/{lid}.mp3")):
            res[lid] = o
            continue
        res[lid] = await retry(lid, text)
        print(f"{lid:10} {res[lid]['dur']:5.2f}s  {text}", flush=True)
        json.dump({**old, **res}, open(OUT, "w"), indent=1)
    json.dump(res, open(OUT, "w"), indent=1)
    print("vo ok:", len(res), "lines,", round(sum(v["dur"] for v in res.values()), 1), "s of audio")


asyncio.run(main())
