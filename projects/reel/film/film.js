// Vertical reel. One caption line at a time, words popping as spoken; the phone punches in on each beat-snapped line.
'use strict';
const { el, css, show, seg, lerp, E, V, W, WE, cue, bar: BAR, pulse } = KIT;
const tp = (n) => CLIP.taps.find((q) => q.name === n).t;
const END = BAR(Math.ceil((V('r4').end + 0.6) / KIT.MUSIC.bar));       // final hit: first bar after "Done."
const DUR = END + 2.4, DROP = BAR(KIT.MUSIC.drop_bar);
const clip = KIT.clip(CLIP, [
  [CLIP.marks.open + 0.4, DROP],
  [tp('field'), V('r2').start],
  [tp('add_btn'), WE('r2', 'it') + 0.8],
  [tp('tick0'), V('r3').start],
  [tp('tick4'), V('r4').start - 0.05],
  [CLIP.marks.done + 0.4, V('r4').end + 0.2],
]);
const rnd = (n) => { const x = Math.sin(n * 91.7) * 43758.5; return x - Math.floor(x); };

const blobs = ['#2fd08a', '#7c5cf6', '#ff7a1a'].map((c) => { const b = el('div', 'blob'); b.style.background = c; return b; });
const caps = ['r1', 'r2', 'r3', 'r4'].map((id) => { const c = el('div', 'cap'); return { id, c, w: KIT.words(c, id) }; });
const rig = el('div', 'rig'), phone = KIT.phone({ parent: rig });
const conf = Array.from({ length: 70 }, (_, i) => { const c = el('div', 'conf'); c.style.background = ['#2fd08a', '#7c5cf6', '#ff7a1a', '#ff4f9a', '#ffd23f'][i % 5]; return c; });
const logo = el('div', 'logo', undefined, '<div class="m"></div>Tidy');
const cta = el('div', 'cta', undefined, 'Try it today →');
const TDONE = W('r4', 'Done');
cue(DROP, 'impact', 1.1); clip.taps.forEach((q) => cue(q.ft, 'tap', 0.9)); cue(TDONE, 'chime', 1); cue(END, 'impact', 1.2); cue(END + 0.5, 'pop', 0.8);

// camera: punch in on the input while adding, onto the list while ticking, out for "Done."
const KEYS = [
  { t: DROP + 0.6, z: 1, y: 0 }, { t: V('r2').start - 0.2, z: 1.32, y: -300 }, { t: WE('r2', 'it') + 0.9, z: 1.32, y: -300 },
  { t: V('r3').start - 0.1, z: 1.22, y: 170 }, { t: V('r4').start - 0.1, z: 1.22, y: 170 }, { t: TDONE + 0.3, z: 1, y: 0 },
];
const camAt = (t) => {
  if (t <= KEYS[0].t) return KEYS[0];
  for (let i = 1; i < KEYS.length; i++) if (t <= KEYS[i].t) { const a = KEYS[i - 1], b = KEYS[i], p = E.inOut(seg(t, b.t - 0.45, b.t)); return { z: lerp(a.z, b.z, p), y: lerp(a.y, b.y, p) }; }
  return KEYS[KEYS.length - 1];
};

function render(t) {
  const bar = Math.floor(Math.max(0, t - KIT.MUSIC.t0) / KIT.MUSIC.bar);
  blobs.forEach((b, i) => {
    const a = t * 0.6 + i * 2.1 + bar * 0.9;
    b.style.transform = `translate(${-160 + 360 * Math.cos(a) + i * 120}px, ${200 + 700 * i + 200 * Math.sin(a * 1.3)}px) scale(${1 + 0.12 * pulse(t) * (t > DROP ? 1 : 0)})`;
  });
  // captions: current line only, words pop on their spoken time
  caps.forEach((c, i) => {
    const v = V(c.id), nxt = i + 1 < caps.length ? V(caps[i + 1].id).start - 0.15 : END - 0.1;
    show(c.c, t >= v.start - 0.1 && t < nxt ? 1 : 0);
    c.w.set(t);
    c.c.style.transform = `translateX(-50%) scale(${1 + 0.04 * pulse(t)})`;
    c.w.spans.forEach((s, k) => { s.style.color = (c.id === 'r1' && k >= 4) || (c.id !== 'r1' && k === 0) ? '#2fd08a' : '#fff'; });
  });
  // phone: rises on the drop, follows the camera, drops away before the end card
  const inP = E.outExpo(seg(t, DROP - 0.1, DROP + 0.8)), outP = E.in(seg(t, END - 0.35, END));
  const c = camAt(t);
  show(rig, t > DROP - 0.1 && t < END ? 1 : 0);
  rig.style.transform = `translateY(${(1 - inP) * 1300 + outP * 1500 + c.y}px) scale(${1.6 * c.z * (1 + 0.015 * pulse(t))}) rotate(${(1 - inP) * 12}deg)`;
  if (t > DROP - 0.2 && t < END) phone.set(t, clip.frameAt(Math.min(clip.clipAt(t), CLIP.marks.done + 1.2)), undefined, clip.taps);
  // confetti burst on "Done." (each piece: fixed launch angle/speed, gravity — pure function of t)
  const ct = t - TDONE;
  conf.forEach((p, i) => {
    if (ct < 0 || ct > 2.2) { p.style.opacity = 0; return; }
    const a = -Math.PI / 2 + (rnd(i) - 0.5) * 2.2, v = 1300 + 900 * rnd(i + 9);
    const x = 540 + Math.cos(a) * v * ct, y = 900 + Math.sin(a) * v * ct + 1600 * ct * ct;
    css(p, { opacity: 1 - seg(ct, 1.6, 2.2), transform: `translate(${x}px, ${y}px) rotate(${(rnd(i + 3) - 0.5) * 1440 * ct}deg)` });
  });
  // end card
  const e = E.outBack(seg(t, END, END + 0.45));
  show(logo, seg(t, END, END + 0.1)); logo.style.transform = `translate(-50%, -50%) scale(${(0.5 + 0.5 * e) * (1 + 0.04 * pulse(t))})`;
  const ce = E.outBack(seg(t, END + 0.5, END + 0.9));
  show(cta, seg(t, END + 0.5, END + 0.7)); cta.style.transform = `translateX(-50%) scale(${0.7 + 0.3 * ce})`;
  KIT.stage.style.opacity = 1 - seg(t, DUR - 0.4, DUR);
}
KIT.start({ dur: DUR, render, music: { end_bar: Math.round((END - KIT.MUSIC.t0) / KIT.MUSIC.bar) } });
