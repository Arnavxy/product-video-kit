# python3 tools/qa.py <project>
# Checks rendered frames: biggest frame-to-frame jumps (should sit on cuts / beats, not mid-shot) and
# blank or near-uniform frames (a missing image, a scene that faded to nothing). Then look at the times it prints.
import os, sys
from PIL import Image, ImageChops, ImageStat

proj = sys.argv[1]
fps = int(os.environ.get("FPS", 60))
D = os.path.join(proj, "frames")
files = sorted(f for f in os.listdir(D) if f.endswith(".jpg"))
prev, diffs, flat = None, [], []
for i, f in enumerate(files):
    im = Image.open(os.path.join(D, f)).convert("L").resize((192, 108))
    st = ImageStat.Stat(im)
    if st.stddev[0] < 3:
        flat.append(i / fps)
    if prev is not None:
        diffs.append((ImageStat.Stat(ImageChops.difference(im, prev)).mean[0], i / fps))
    prev = im
diffs.sort(reverse=True)
print(f"{len(files)} frames ({len(files) / fps:.1f}s)")
print("largest frame-to-frame changes (expect these on cuts/beats; anything else = a blip):")
for d, t in diffs[:12]:
    print(f"  {t:7.2f}s  {d:6.2f}")
if flat:
    runs, s = [], flat[0]
    for a, b in zip(flat, flat[1:] + [None]):
        if b is None or b - a > 1.5 / fps: runs.append((s, a)); s = b
    print("near-blank stretches:", ", ".join(f"{a:.2f}–{b:.2f}s" for a, b in runs))
else:
    print("no blank frames")
