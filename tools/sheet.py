# python3 tools/sheet.py <project>  → <project>/stills/sheet.jpg, a contact sheet of every still
# (run `video.sh stills <project>` first). Fast way to eyeball the whole film or send a review.
import os, sys
from PIL import Image

proj = sys.argv[1]
D = os.path.join(proj, "stills")
files = sorted(f for f in os.listdir(D) if f.startswith("t") and f.endswith(".jpg"))
per = 4
w, h = 480, 270
rows = (len(files) + per - 1) // per
sheet = Image.new("RGB", (per * w + (per - 1) * 8, rows * h + (rows - 1) * 8), "#222")
for i, f in enumerate(files):
    sheet.paste(Image.open(os.path.join(D, f)).convert("RGB").resize((w, h)), ((i % per) * (w + 8), (i // per) * (h + 8)))
sheet.save(os.path.join(D, "sheet.jpg"), quality=86)
print(os.path.join(D, "sheet.jpg"), len(files), "stills")
