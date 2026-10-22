#!/usr/bin/env bash
# One-time setup on macOS (Homebrew) or Debian/Ubuntu (apt). Safe to re-run.
# Installs ffmpeg, Node, Python, the Python libs (edge-tts, numpy, pillow), Playwright + its Chromium. Then checks everything works.
set -euo pipefail
cd "$(dirname "$0")"
ok() { printf '  \033[32m✔\033[0m %s\n' "$1"; }
bad() { printf '  \033[31m✘\033[0m %s\n' "$1"; }

if [[ "$(uname)" == "Darwin" ]]; then
  if ! command -v brew >/dev/null; then
    echo "Homebrew is missing. Install it first (paste in Terminal, then re-run ./setup.sh):"
    echo '  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
    exit 1
  fi
  for pkg in ffmpeg node python3; do
    if command -v "$pkg" >/dev/null; then ok "$pkg"; else echo "installing $pkg…"; brew install "${pkg/python3/python}"; fi
  done
elif command -v apt-get >/dev/null; then
  missing=()
  command -v ffmpeg >/dev/null || missing+=(ffmpeg)
  command -v node >/dev/null || missing+=(nodejs npm)
  command -v python3 >/dev/null || missing+=(python3)
  python3 -m pip --version >/dev/null 2>&1 || missing+=(python3-pip)
  if ((${#missing[@]})); then echo "installing ${missing[*]}…"; sudo apt-get update -q && sudo apt-get install -yq "${missing[@]}"; fi
  ok "system packages"
else
  echo "Install ffmpeg, Node 18+ and Python 3.9+ with your package manager, then re-run ./setup.sh"
fi

echo "Python libraries…"
python3 -m pip install --user -q -r requirements.txt 2>/dev/null || python3 -m pip install --user -q --break-system-packages -r requirements.txt

echo "Playwright…"
if command -v bun >/dev/null; then bun install --silent; else npm install --silent; fi
npx --yes playwright install $([[ "$(uname)" == "Linux" ]] && echo --with-deps) chromium || echo "(Chromium download failed — the kit falls back to your Google Chrome)"

echo; echo "Checks:"
command -v ffmpeg >/dev/null && ok "ffmpeg $(ffmpeg -version | head -1 | awk '{print $3}')" || bad ffmpeg
ok "node $(node -v)"
python3 -c "import edge_tts, numpy, PIL" && ok "python libs (edge-tts, numpy, pillow)" || bad "python libs — run: python3 -m pip install --user -r requirements.txt"
node -e "import('./tools/browser.mjs').then(async m=>{const b=await m.launch();await b.close();console.log('  \x1b[32m✔\x1b[0m headless browser')}).catch(e=>{console.log('  \x1b[31m✘\x1b[0m browser: '+e.message.split('\n')[0]);process.exit(1)})"
echo; echo "Ready. Make the example film:  ./video.sh all"
