#!/usr/bin/env bash
# ./video.sh <command> [project]   (project defaults to projects/example)
#
#   new <name>       copy the example into projects/<name> to start your own film
#   record           run <project>/record.mjs → screen take (clips/) + film/clip.js
#   vo               voiceover from project.json lines (edge-tts) → vo/
#   beatgrid         fit the beat grid of music/track.mp3 → music/grid.json (only with a real track)
#   sched            place VO lines on the timeline → film/data.js
#   info             timeline.json (duration + SFX cues) from the director
#   music            music/bed.wav (your track, or the built-in synth bed)
#   mix              mix.wav (voice + ducked music + SFX)
#   stills [t,t,..]  preview frames → stills/ + stills/sheet.jpg
#   frames           render every frame → frames/
#   encode           frames + mix.wav → the mp4 in project.json "out"
#   qa               check frames for blips and blank frames
#   clean            delete frames/ stills/ and intermediate audio (keeps the mp4)
#   all              record → vo → (beatgrid) → sched → info → music → mix → frames → encode → qa
#   audio            vo → sched → info → music → mix   (after editing the script)
#   film             sched → info → mix → frames → encode   (after editing film.js)
set -euo pipefail
cd "$(dirname "$0")"
cmd="${1:-help}"; shift || true
proj="projects/example"
if [[ "$cmd" != "new" && $# -gt 0 && -d "$1" ]]; then proj="${1%/}"; shift
elif [[ "$cmd" != "new" && $# -gt 0 && -d "projects/$1" ]]; then proj="projects/$1"; shift; fi
PY=python3

step() { printf '\n\033[1;32m▶ %s\033[0m  (%s)\n' "$1" "$proj"; }
has_track() { $PY -c "import json,os,sys;p=json.load(open('$proj/project.json'));f=p.get('music',{}).get('file');sys.exit(0 if f and os.path.exists(os.path.join('$proj',f)) else 1)"; }

case "$cmd" in
  new)
    name="${1:?usage: ./video.sh new <name>}"
    [[ -e "projects/$name" ]] && { echo "projects/$name already exists"; exit 1; }
    mkdir -p "projects/$name"
    rsync -a --exclude clips --exclude frames --exclude stills --exclude vo --exclude out --exclude 'mix.wav' \
      --exclude timeline.json --exclude 'music/bed.wav' --exclude 'music/grid.json' --exclude 'film/data.js' --exclude 'film/clip.js' \
      projects/example/ "projects/$name/"
    echo "created projects/$name — edit project.json (script), record.mjs (the take), film/film.js (the edit)"
    echo "then: ./video.sh all $name" ;;
  record)   step record;   node "$proj/record.mjs" ;;
  vo)       step vo;       $PY tools/vo.py "$proj" "$@" ;;
  beatgrid) step beatgrid; $PY tools/beatgrid.py "$proj" ;;
  sched)    step sched;    $PY tools/sched.py "$proj" ;;
  info)     step info;     node tools/render.mjs "$proj" info ;;
  music)    step music;    $PY tools/music.py "$proj" ;;
  mix)      step mix;      $PY tools/mix.py "$proj" ;;
  stills)   step stills;   node tools/render.mjs "$proj" stills "$@" && $PY tools/sheet.py "$proj" ;;
  frames)   step frames;   node tools/render.mjs "$proj" frames "$@" ;;
  encode)   step encode;   node tools/render.mjs "$proj" encode ;;
  qa)       step qa;       $PY tools/qa.py "$proj" ;;
  clean)    rm -rf "$proj/frames" "$proj/stills" "$proj/mix.wav" "$proj/music/bed.wav"; echo "cleaned $proj (mp4 kept)" ;;
  audio)    "$0" vo "$proj"; "$0" sched "$proj"; "$0" info "$proj"; "$0" music "$proj"; "$0" mix "$proj" ;;
  film)     "$0" sched "$proj"; "$0" info "$proj"; "$0" mix "$proj"; rm -rf "$proj/frames"; "$0" frames "$proj"; "$0" encode "$proj" ;;
  all)
    "$0" record "$proj"; "$0" vo "$proj"
    if has_track; then "$0" beatgrid "$proj"; fi
    "$0" sched "$proj"; "$0" info "$proj"; "$0" music "$proj"; "$0" mix "$proj"
    rm -rf "$proj/frames"; "$0" frames "$proj"; "$0" encode "$proj"; "$0" qa "$proj"
    out=$($PY -c "import json;print(json.load(open('$proj/project.json')).get('out','out/film.mp4'))")
    printf '\n\033[1;32m✔ done:\033[0m %s/%s\n' "$proj" "$out" ;;
  *) sed -n '2,22p' "$0" | sed 's/^# \{0,1\}//' ;;
esac
