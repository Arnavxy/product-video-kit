# Playbook — what makes these films work

Lessons from a dozen product films (launch films, creator pitches, manager walkthroughs, explainers).
Read once before your first real film.

## Story before pixels

- **Sell a story, not a feature list.** The film that worked: hook (the pain, in the viewer's words) →
  the grind (show how bad the old way is — a stopwatch, a repeated chore) → reveal → 3–6 features on real
  footage → payoff (before vs after, in numbers) → end card. A montage of features "looked bad and didn't sell".
- **Know the audience before writing a line.** Same product, different films:
  - *Users / launch*: emotion + benefit, fast, music-led, 30–90 s.
  - *Partners* (another company's team): trust and clarity — show permissions, what is and isn't done
    on their behalf. Calm, simple, no hype.
  - *Manager / founder in a meeting room*: **slow**. Each step visibly finishes before the next starts.
    Show the real thing (real data, real files, real flow), don't describe it. Two earlier cuts were
    rejected as "too fast" before a 0.7 s gap between lines and a −3% voice rate landed.
- **Write the VO first**, read it aloud, then build the picture to it. Short sentences. One idea per line.
- **Length**: 30 s (promo), 60–90 s (product demo), 2–5 min (explainer). If it's longer, it needs chapters.

## Truthfulness

- Numbers on screen that aren't real get a small **"Illustrative data"** label — unless the stakeholder
  explicitly decides otherwise for a dramatized film.
- Don't claim what the product doesn't do. Check claims against the code/product before the VO is recorded
  (e.g. a limit is 20, not 24; a feature is live, not "coming soon").
- Use fictional people, phone numbers and IDs (`+1 415 555 01xx`, "Maya Brooks") — never a real user's or
  a real test account's ID on screen.
- **Never let a recording really publish, pay, post or message.** Mock write calls (Playwright
  `page.route('**/api/**', …)` answering non-GET requests with a fake success) or use a demo build.

## Picture

- **Isolate the UI.** The best-looking shots put the app (or one panel of it) on a clean background, window
  chrome hidden. A full browser page with a dim overlay leaves half-words and white edges.
- **Phone apps go in a phone frame on a plain stage**; captions on the other side. Desktop: a browser frame.
- **Camera moves are slow and purposeful**: punch in on the thing being talked about, hold, pull back.
  No swooping. If you zoom into a full-width element (an input bar), it gets cropped — scale the whole
  device instead.
- **Every visual change happens on a word or a beat.** Use `W('line', 'word')` and `KIT.snap()`; never
  hand-typed seconds.
- Captions: few words, big. Subtitles (karaoke highlight) help when the audience may watch muted.
- Wait for images to load before a recorded tap, or the layout shifts and the tap lands on the wrong thing.

## Sound

- **Voice**: edge-tts Andrew (warm, US male) or Ava (bright, US female) at +4–8% rate for promos, −3 to
  −8% for explainers. Hindi: `hi-IN-SwaraNeural` at −6%, and spell English UI words in Devanagari for
  correct pronunciation, keeping the on-screen captions in English.
- **Music** sets the energy. Find free tracks on Mixkit (licence: free use, no attribution). Always measure
  the beat grid (`beatgrid`) — listed BPMs are often wrong, and a 0.5% error drifts a beat in two minutes.
- Start the music so the **drop lands on the reveal**, and let the song's final hit (or silence) land on
  the end card.
- If you cut music to shorten it, cut on bar lines between sections that sound alike, with a short
  crossfade — otherwise the jump is audible.
- Music ducks ~10 dB under the voice (automatic). Final loudness −14 LUFS (automatic).
- SFX: quiet. A tap click per tap, a whoosh per transition, one impact for the logo, one chime for the
  payoff. More than that gets tiring.

## Process

- **Ship a v1 fast, then iterate.** Render stills (`./video.sh stills`) and a contact sheet before a full
  render; it's seconds instead of minutes.
- **Watch it yourself before sending.** `./video.sh qa` lists blank frames and frame-to-frame jumps; every
  big jump should be on a cut. Then scrub the mp4 at the times it prints.
- Re-recorded the take? Re-run `sched` and `info` — anchors and SFX times derive from the take's marks;
  stale ones give blank white frames.
- Keep only the final mp4. Frames are ~1 GB per minute: `./video.sh clean <project>`.
- Make re-cuts in a copy (`./video.sh new v2` and copy files over) so the approved version stays reproducible.

## Engine rules (when writing film.js)

- `render(t)` sets every style from `t` alone. No CSS transitions/animations, no `requestAnimationFrame`,
  no state carried between frames — frames render out of order across parallel pages.
- Build all elements once at load; in `render(t)` only change `opacity`, `transform`, `src`, text.
- Use `KIT.show(el, opacity)` (also sets visibility) and `KIT.img(img, src)` (waits for decode).
- An element with a `z-index` inside a flex container can paint over overlays — give overlays their own
  higher `z-index`.
- Fonts: system fonts render offline. For a brand font, put the `.woff2` in the project and use `@font-face`
  — the renderer waits for fonts before the first frame.
