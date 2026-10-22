// Beat-synced teaser. No voice: the music grid is the timeline. B(k) = time of beat k, BAR(k) = bar k.
'use strict';
const { el, css, show, seg, lerp, E, cue, beat: B, bar: BAR, pulse } = KIT;
const MU = KIT.MUSIC, DROP = BAR(MU.drop_bar), END = BAR(MU.end_bar);
const DUR = END + 2.2;
const COLORS = ['#2fd08a', '#8b5cf6', '#ff7a1a', '#ff4f9a'];
// deterministic pseudo-random (same t → same value, in any frame order)
const rnd = (n) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };

// ── intro: one word per beat ─────────────────────────────────────────────
const WORDS = [[0, 'Too'], [1, 'many'], [2, 'tabs.'], [4, 'Too'], [5, 'many'], [6, 'tasks.'], [7, 'Breathe.']];
const words = WORDS.map(([b, w]) => ({ b, e: el('div', 'word', undefined, w) }));
WORDS.forEach(([b], i) => cue(B(b), i === WORDS.length - 1 ? 'whoosh' : 'tap', 1.2));

// ── drop: flash + shockwave + 3D field of UI cards ───────────────────────
const scene = el('div', 'scene'), world = el('div', 'world', scene);
const ring = el('div', 'ring'), flash = el('div', 'flash');
const CARD_HTML = [
  `<div class="row"><div class="ck" data-on="1"></div>Reply to Sam</div><div class="row"><div class="ck" data-on="2"></div>Book dentist</div><div class="row"><div class="ck" data-on="3"></div>Groceries</div>`,
  `<div class="muted">Today</div><div class="big" data-count="5">0 / 5</div><div class="bar"><i></i></div>`,
  `<div>🎉 All done for today</div><div class="muted">Thursday · 5 of 5</div>`,
  `<div class="muted">Streak</div><div class="big">🔥 12 days</div>`,
  `<div class="row"><div class="ck" data-on="4"></div>Water the plants</div><div class="row"><div class="ck" data-on="5"></div>Plan the trip</div>`,
  `<div class="muted">This week</div><div class="big">+40%</div><div class="muted">tasks finished</div>`,
  `<div class="row"><div class="ck" data-on="6"></div>Call mum</div><div class="row"><div class="ck" data-on="7"></div>Pay rent</div>`,
  `<div class="muted">Focus time</div><div class="big">3h 20m</div>`,
];
const cards = [];
for (let i = 0; i < 16; i++) {
  const c = el('div', 'card', world, CARD_HTML[i % CARD_HTML.length]);
  const a = (i / 16) * Math.PI * 2, r = 560 + 220 * rnd(i);
  c.style.setProperty('--c', COLORS[i % 4]);
  cards.push({ c, x: Math.cos(a) * r, y: (rnd(i + 7) - 0.5) * 700, z: Math.sin(a) * r, rot: (rnd(i + 3) - 0.5) * 30,
               checks: [...c.querySelectorAll('.ck')], bar: c.querySelector('.bar i'), big: c.querySelector('[data-count]') });
}
cue(DROP, 'impact', 1.3);

// big beat words over the cards, one per bar
const SIDE = [[MU.drop_bar + 1, 'Add.'], [MU.drop_bar + 2, 'Tick.'], [MU.drop_bar + 3, 'Done.']];
const side = SIDE.map(([b, w]) => ({ b, e: el('div', 'side', undefined, w) }));
SIDE.forEach(([b]) => cue(BAR(b), 'pop', 1));
cue(END - 0.05, 'riser', 0.8);

// ── end: glitch-in logo on the final hit ─────────────────────────────────
const logoLayers = ['#00e5ff', '#ff2d95', null].map((col) => {
  const l = el('div', 'logo', undefined, '<div class="mark"></div><span>Tidy</span>');
  if (col) { l.style.color = col; l.querySelector('.mark').style.background = col; l.style.mixBlendMode = 'screen'; }
  return l;
});
const tag = el('div', 'tag', undefined, 'Your day, finally calm.');
cue(END, 'glitch', 1.2); cue(END, 'impact', 1);

function render(t) {
  const bi = (t - MU.t0) / MU.beat;                  // beat index (float)
  // intro words: slam in on their beat, gone on the next word
  words.forEach((w, i) => {
    const t0 = B(w.b), t1 = i + 1 < words.length ? B(words[i + 1].b) : DROP;
    const p = E.outExpo(seg(t, t0, t0 + 0.22));
    const last = i === words.length - 1;
    show(w.e, t >= t0 && t < t1 ? 1 : 0);
    const grow = last ? 1 + 1.6 * E.in(seg(t, t0, DROP)) : 1;       // "Breathe." rushes at the camera into the drop
    w.e.style.transform = `translateY(-50%) scale(${(1.7 - 0.7 * p) * grow})`;
    w.e.style.filter = last ? `blur(${18 * E.in(seg(t, t0 + 0.6, DROP))}px)` : 'none';
    w.e.style.color = i === 2 || i === 5 ? '#ff4f5e' : last ? '#2fd08a' : '#f4f2ee';
  });
  // flash + ring on the drop
  show(flash, t >= DROP ? 1 - seg(t, DROP, DROP + 0.35) : 0);
  const rp = seg(t, DROP, DROP + 0.9);
  show(ring, rp > 0 && rp < 1 ? 1 - rp : 0);
  ring.style.transform = `scale(${1 + 14 * E.out(rp)})`; ring.style.borderWidth = 10 * (1 - rp) + 2 + 'px';

  // card field: in after the drop, orbiting, pumping on the kick, exploding at the last bar
  const inP = E.outExpo(seg(t, DROP, DROP + 1.2)), boom = E.in(seg(t, END - BAR(1) + BAR(0) - 0.4, END));
  show(scene, t > DROP && t < END + 0.1 ? 1 : 0);
  const spin = (t - DROP) * 22 + 40 * (1 - inP);
  world.style.transform = `translateZ(${-1300 + 950 * inP + 2400 * boom}px) rotateX(${-8 + 4 * Math.sin(t)}deg) rotateY(${spin}deg) scale(${1 + 0.035 * pulse(t)})`;
  cards.forEach((k, i) => {
    const sp = 1 + 1.8 * boom;
    k.c.style.transform = `translate(-50%, -50%) translate3d(${k.x * sp}px, ${k.y * sp}px, ${k.z * sp}px) rotateY(${-spin}deg) rotateZ(${k.rot}deg)`;
    k.c.style.opacity = Math.min(inP * 1.5, 1);
    // checkboxes tick on successive beats after the drop; progress bar and counter follow
    k.checks.forEach((ck) => ck.classList.toggle('on', bi >= MU.drop_bar * 4 + 2 + Number(ck.dataset.on)));
    if (k.bar) k.bar.style.width = 100 * E.out(seg(t, DROP + 0.5, DROP + 3 * MU.bar)) + '%';
    if (k.big) k.big.textContent = Math.min(5, Math.floor(seg(t, DROP + 0.5, DROP + 3 * MU.bar) * 5.99)) + ' / 5';
  });
  side.forEach((s, i) => {
    const t0 = BAR(s.b), t1 = i + 1 < side.length ? BAR(side[i + 1].b) : END - 0.3;
    const p = E.outBack(seg(t, t0, t0 + 0.3));
    show(s.e, t >= t0 && t < t1 ? 1 : 0);
    s.e.style.transform = `translateY(-50%) translateX(${(1 - p) * -120}px) scale(${1 + 0.05 * pulse(t)})`;
    s.e.style.color = COLORS[i + 1];
  });

  // glitch logo: RGB layers jitter for 0.5 s, then lock together
  const g = 1 - seg(t, END + 0.05, END + 0.55), f = Math.floor(t * 30);
  logoLayers.forEach((l, i) => {
    show(l, t >= END ? 1 : 0);
    const dx = i < 2 ? (rnd(f + i * 5) - 0.5) * 70 * g : 0, dy = i < 2 ? (rnd(f + i * 9) - 0.5) * 20 * g : 0;
    const sl = rnd(f + 31) * 100;
    l.style.clipPath = g > 0.05 && i < 2 ? `inset(${sl}% 0 ${Math.max(0, 100 - sl - 30)}% 0)` : 'none';
    l.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(${1 + 0.15 * g})`;
  });
  show(tag, seg(t, END + 0.5, END + 0.9));
  tag.style.transform = `translateY(${(1 - E.out(seg(t, END + 0.5, END + 1))) * 30}px)`;
  KIT.stage.style.opacity = 1 - seg(t, DUR - 0.4, DUR);
}
KIT.start({ dur: DUR, render });
