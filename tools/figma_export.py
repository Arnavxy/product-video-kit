# Export Figma frames as PNGs for a film made from designs (no recording needed).
#
#   export FIGMA_TOKEN=figd_...      (Figma → Settings → Security → Personal access tokens, scope: file_content:read)
#   python3 tools/figma_export.py "<figma file or node URL>" <out_dir> [--scale 2] [--min-width 300]
#
# With a node URL (…?node-id=12-345, e.g. a section or page you right-clicked → Copy link) it exports every
# top-level screen frame inside that node, ordered by row then x, as 01_<name>.png, 02_… plus frames.json
# (id, name, size). View access to the file is enough.
import json, os, re, sys, time, urllib.parse, urllib.request

args = sys.argv[1:]
if len(args) < 2 or not os.environ.get("FIGMA_TOKEN"):
    sys.exit(open(__file__).read().split("import json")[0].replace("# ", "").replace("#", ""))
url, out = args[0], args[1]
scale = float(args[args.index("--scale") + 1]) if "--scale" in args else 2
minw = float(args[args.index("--min-width") + 1]) if "--min-width" in args else 300
m = re.search(r"figma\.com/(?:file|design|proto)/([A-Za-z0-9]+)", url)
key = m.group(1) if m else url
nm = re.search(r"node-id=([0-9]+[-:][0-9]+)", url)
node = nm.group(1).replace("-", ":") if nm else None
H = {"X-Figma-Token": os.environ["FIGMA_TOKEN"]}


def get(path):
    for k in range(5):
        try:
            req = urllib.request.Request("https://api.figma.com/v1/" + path, headers=H)
            return json.load(urllib.request.urlopen(req, timeout=120))
        except urllib.error.HTTPError as e:
            if e.code == 429: time.sleep(10 * (k + 1)); continue   # rate limited
            sys.exit(f"Figma API {e.code}: {e.read()[:300]!r}  (token valid? access to the file?)")
    sys.exit("Figma API kept rate-limiting; try again in a minute")


if node:
    root = get(f"files/{key}/nodes?ids={urllib.parse.quote(node)}&depth=3")["nodes"][node]["document"]
else:
    root = get(f"files/{key}?depth=2")["document"]["children"][0]       # first page

frames = []
def walk(n, depth):
    for c in n.get("children", []):
        bb = c.get("absoluteBoundingBox") or {}
        if c["type"] in ("FRAME", "COMPONENT", "INSTANCE") and bb.get("width", 0) >= minw:
            frames.append({"id": c["id"], "name": c["name"], "x": bb["x"], "y": bb["y"], "w": bb["width"], "h": bb["height"]})
        elif c["type"] in ("SECTION", "GROUP", "CANVAS", "FRAME") and depth < 3:
            walk(c, depth + 1)
walk(root, 0)
if not frames:
    sys.exit("no frames found under that node (try --min-width 100, or link a section/page)")
frames.sort(key=lambda f: (round(f["y"] / 400), f["x"]))
os.makedirs(out, exist_ok=True)
print(f"{len(frames)} frames under {root.get('name')}")
for i in range(0, len(frames), 20):
    batch = frames[i:i + 20]
    urls = get(f"images/{key}?ids={','.join(f['id'] for f in batch)}&scale={scale}&format=png")["images"]
    for j, f in enumerate(batch):
        safe = re.sub(r"[^A-Za-z0-9]+", "_", f["name"]).strip("_")[:40] or "frame"
        f["file"] = f"{i + j + 1:02d}_{safe}.png"
        if not urls.get(f["id"]):
            print("  skipped (Figma could not render)", f["name"]); continue
        urllib.request.urlretrieve(urls[f["id"]], os.path.join(out, f["file"]))
        print("  ", f["file"], f"{int(f['w'])}×{int(f['h'])}")
json.dump(frames, open(os.path.join(out, "frames.json"), "w"), indent=1)
print("→", out)
