# Contributing

Thanks for helping! Bug reports, new engine components and better defaults are all welcome.

## Ground rules
- **Keep the pipeline free and local.** No paid APIs or accounts required for the default path
  (edge-tts, Playwright, ffmpeg, numpy). Optional integrations (Figma) must stay optional.
- **Determinism.** Anything in `tools/engine.js` must render the same frame for the same `t`, in any order.
  No CSS transitions, `requestAnimationFrame`, timers or state carried between frames.
- **No assets with unclear licences.** Don't commit music, fonts, images or footage you don't have the
  right to redistribute. Sounds and the music bed are synthesised for this reason.
- **Small, readable scripts.** Each tool is one file with a usage comment at the top. Match the existing style.

## Before opening a PR
```bash
./setup.sh
./video.sh all            # the example must still build end to end
./video.sh qa             # no new blank stretches
```
Describe what you changed and attach a still or short clip if it affects the picture or sound.

## Ideas we'd love help with
- More engine components: split screens, device frames (tablet, laptop), text-on-path, particle presets.
- Music section detection (find the drop in a real track automatically) and bar-aligned cuts for shortening tracks.
- More soundtrack styles in `tools/music.py`.
- Native Windows support (PowerShell versions of `setup.sh` / `video.sh`), and reports from WSL users.
