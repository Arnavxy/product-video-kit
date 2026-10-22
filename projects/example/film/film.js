// Example film: hook → logo → app walkthrough on a phone (recorded take retimed to the VO) → end card.
// Every timing is derived from VO words (W) and recorder marks/taps, so re-recording the voice or the take
// re-flows the film. Copy this file's patterns for your own scenes.
'use strict';
const { el, css, show, seg, win, E, V, W, WE, cue } = KIT;

// ── 1. hook: big words appear as they are spoken ─────────────────────────
const hook = el('div', 'big');
const hookW = KIT.words(hook, 'hook');
const HOOK_OUT = V('intro').start - 0.35;

// ── 2. logo reveal on "Tidy" ─────────────────────────────────────────────
const logo = el('div', 'logo', undefined, '<div class="mark"></div><span>Tidy</span>');
const LOGO_IN = W('intro', 'Tidy');
const APP_IN = V('add').start - 0.9;
cue(HOOK_OUT - 0.1, 'whoosh'); cue(LOGO_IN, 'impact');

// ── 3. app walkthrough ───────────────────────────────────────────────────
const clip = KIT.clip(CLIP, [
  [CLIP.marks.open + 0.4, APP_IN + 0.5],
  [clipTap('field'), W('add', 'one')],           // the field is tapped on "one tap"
  [clipTap('add_btn'), W('add', 'list')],        // the task lands on "list"
  [CLIP.marks.tick, V('tick').start - 0.1],
  [clipTap('tick4'), WE('tick', 'up')],          // last tick on "fill up"
  [CLIP.marks.end, V('end').start - 0.6],        // the "all done" toast plays out under the "done" line
]);
function clipTap(name) { return CLIP.taps.find((q) => q.name === name).t; }
const phoneWrap = el('div');
css(phoneWrap, { position: 'absolute', left: '1150px', top: '60px' });
const phone = KIT.phone({ parent: phoneWrap });
const APP_OUT = V('end').start - 0.3;
const tapF = clip.filmAt(clipTap('field')), addF = clip.filmAt(clipTap('add_btn'));
// punch in on the phone while typing (the whole phone scales around the input bar).
// To zoom INSIDE the screen instead (a small button, a price), pass camera keys to phone.set — see KIT.camAt.
const punch = (t) => E.inOut(seg(t, tapF - 0.45, tapF + 0.05)) * (1 - E.inOut(seg(t, addF + 0.35, addF + 0.95)));
clip.taps.forEach((q) => cue(q.ft, 'tap', 0.8));
cue(APP_IN, 'whoosh'); cue(W('done', 'celebrates'), 'chime');

// left-hand captions, one per VO line
const CAPS = [
  { id: 'add', n: '01', h: 'Add in one tap', s: 'Type it. Done. It’s on today’s list.' },
  { id: 'tick', n: '02', h: 'Watch your day fill up', s: 'Every tick moves the bar.' },
  { id: 'done', n: '03', h: 'Finish, and celebrate', s: 'A little moment for a cleared list.' },
].map((c, i, a) => {
  const e = el('div', 'cap', undefined, `<div class="n">${c.n}</div><div class="h">${c.h}</div><div class="s">${c.s}</div>`);
  const a0 = i === 0 ? APP_IN + 0.4 : V(c.id).start - 0.35;
  const a1 = i === a.length - 1 ? APP_OUT : V(a[i + 1].id).start - 0.35;
  if (i > 0) cue(a0, 'pop', 0.7);
  return { e, a0, a1 };
});
const subs = KIT.subtitles(['add', 'tick', 'done']);

// ── 4. end card ──────────────────────────────────────────────────────────
const endLogo = el('div', 'logo', undefined, '<div class="mark"></div><span>Tidy</span>');
const tag = el('div', 'tag');
const tagW = KIT.words(tag, 'tag');
const END_IN = W('end', 'Tidy') - 0.1;            // logo lands on the spoken name
cue(APP_OUT - 0.25, 'whoosh'); cue(W('end', 'Tidy'), 'impact', 0.8);
const DUR = window.PROJECT.speechEnd + window.PROJECT.tail;

function render(t) {
  // hook
  const ho = 1 - seg(t, HOOK_OUT - 0.25, HOOK_OUT);
  show(hook, ho); hookW.set(t);
  hook.style.transform = `translateY(-50%) scale(${1 + 0.03 * seg(t, 0, HOOK_OUT) - 0.06 * seg(t, HOOK_OUT - 0.25, HOOK_OUT)})`;

  // logo: pops in on the word, slides away as the phone arrives
  const lp = E.outBack(seg(t, LOGO_IN - 0.05, LOGO_IN + 0.45)), lo = 1 - seg(t, APP_IN - 0.1, APP_IN + 0.35);
  show(logo, Math.min(seg(t, LOGO_IN - 0.05, LOGO_IN + 0.15), lo));
  logo.style.transform = `translate(-50%, -50%) scale(${(0.6 + 0.4 * lp) * (1 + 0.04 * KIT.pulse(t) * (t < APP_IN ? 1 : 0))}) translateY(${-160 * E.in(1 - lo)}px)`;

  // phone in from below, out to the right
  const pin = E.outExpo(seg(t, APP_IN, APP_IN + 0.9)), pout = E.in(seg(t, APP_OUT - 0.4, APP_OUT));
  show(phoneWrap, Math.min(seg(t, APP_IN, APP_IN + 0.2), 1 - pout));
  const pz = punch(t);
  phoneWrap.style.transformOrigin = '50% 90%';
  phoneWrap.style.transform = `translate(${pout * 300 - pz * 120}px, ${(1 - pin) * 700 - pz * 40}px) scale(${(1.04 - 0.04 * pin) * (1 + 0.32 * pz)})`;
  if (t > APP_IN - 0.1 && t < APP_OUT + 0.1) {
    const ct = Math.min(clip.clipAt(t), CLIP.marks.end);
    phone.set(t, clip.frameAt(ct), undefined, clip.taps);
  }
  for (const c of CAPS) {
    const op = win(t, c.a0, c.a1, 0.35, 0.3);
    show(c.e, op);
    c.e.style.transform = `translateY(${(1 - E.out(seg(t, c.a0, c.a0 + 0.5))) * 40}px)`;
  }
  subs.set(t, t > APP_IN && t < APP_OUT ? 1 : 0);

  // end card
  const ei = E.outBack(seg(t, END_IN, END_IN + 0.6));
  show(endLogo, seg(t, END_IN, END_IN + 0.2)); show(tag, seg(t, END_IN, END_IN + 0.2));
  endLogo.style.transform = `translate(-50%, -50%) translateY(-90px) scale(${0.7 + 0.3 * ei})`;
  tagW.set(t);
  // last 0.6 s: fade to the background colour
  KIT.stage.style.opacity = 1 - seg(t, DUR - 0.6, DUR);
}
KIT.start({ dur: DUR, render });
