// Website promo. Timeline = music bars (BAR(k)); the page scroll is a list of stops, each with its pop-outs.
'use strict';
const { el, css, show, seg, lerp, E, cue, bar: BAR, beat: B } = KIT;
const S = window.SITE, VIEW_H = 900;
const DUR = BAR(7) + 0.4;

// scroll stops: [time, page y]; between stops the page glides (ease in/out)
const secTop = (k, pad = 60) => Math.min(S.sections[k] - pad, S.h - VIEW_H);
const STOPS = [[0, 0], [BAR(1) - 0.2, 0], [BAR(1) + 0.5, secTop('features')], [BAR(2.5) - 0.2, secTop('features')],
               [BAR(2.5) + 0.5, secTop('stats', 220)], [BAR(3.5) - 0.2, secTop('stats', 220)], [BAR(3.5) + 0.5, secTop('pricing')], [BAR(5), secTop('pricing') + 120]];
const scrollAt = (t) => {
  for (let i = 1; i < STOPS.length; i++) if (t <= STOPS[i][0]) {
    const [a, ya] = STOPS[i - 1], [b, yb] = STOPS[i];
    return lerp(ya, yb, E.inOut(seg(t, a, b)));
  }
  return STOPS[STOPS.length - 1][1];
};
STOPS.forEach(([t, y], i) => { if (i && y !== STOPS[i - 1][1]) cue(STOPS[i - 1][0], 'whoosh', 0.6); });

// pop-outs: [item, beat time] — lifts toward the camera on its beat, holds, sinks back
const POPS = [['headline', B(2)], ['phone', B(3)], ['f1', BAR(1) + 2 * KIT.MUSIC.beat], ['f2', BAR(1) + 3 * KIT.MUSIC.beat], ['f3', BAR(2)],
              ['stats', BAR(3)], ['pro', BAR(4)]];
POPS.forEach(([, t]) => cue(t, 'pop', 0.9));

// ── layers ──
const cam = el('div', 'cam'), rig = el('div', 'rig', cam);
const br = KIT.browser({ w: 1440, h: VIEW_H, url: 'tidy.example', parent: rig });
br.root.style.position = 'absolute';
const page = el('img', 'page', br.view); KIT.img(page, '../assets/site/full.jpg'); page.style.height = S.h + 'px';
const pops = POPS.map(([k, t]) => {
  const it = S.items[k], e = el('img', 'pop', rig);
  KIT.img(e, it.file); css(e, { width: it.w + 'px', height: it.h + 'px', left: it.x + 'px' });
  return { it, e, t };
});
// tilted full-page flyover
const wallStart = BAR(5) - 0.3, END0 = BAR(6) - 0.2;
const wall = el('div', 'wall'), wimg = el('img', '', wall); KIT.img(wimg, '../assets/site/full.jpg'); wimg.style.height = S.h + 'px';
cue(wallStart, 'whoosh', 0.9); cue(END0, 'impact', 0.7); cue(END0 + 0.4, 'chime', 0.7);
const end = el('div', 'end', undefined, '<div class="logo"><div class="m"></div>Tidy</div><div class="url">tidy.example</div>');

function render(t) {
  // browser: rises in from a steep tilt, then a gentle drift; leaves by tilting away into the flyover
  const inP = E.outExpo(seg(t, 0, 1.4)), outP = E.in(seg(t, wallStart - 0.4, wallStart + 0.2));
  show(cam, 1 - seg(t, wallStart, wallStart + 0.15));
  rig.style.transform = `translateY(${(1 - inP) * 500 + outP * -300}px) translateZ(${-700 + 540 * inP - 900 * outP}px) ` +
    `rotateX(${lerp(38, 10, inP) + 30 * outP}deg) rotateY(${lerp(-18, -6, inP) + 4 * Math.sin(t * 0.35)}deg)`;
  const sy = scrollAt(t);
  page.style.transform = `translateY(${-sy}px)`;
  for (const p of pops) {
    const up = E.outBack(seg(t, p.t, p.t + 0.45)) * (1 - E.inOut(seg(t, p.t + 1.3, p.t + 1.8)));
    const y = 52 + p.it.y - sy;
    const visible = y + p.it.h > 52 && y < 52 + VIEW_H;
    show(p.e, up > 0.001 && visible ? 1 : 0);
    p.e.style.top = y + 'px';
    p.e.style.transform = `translateZ(${up * 160}px) scale(${1 + 0.05 * up}) rotateX(${-6 * up}deg)`;
    p.e.style.boxShadow = `0 ${30 * up}px ${80 * up}px rgba(40,30,80,${0.35 * up})`;
  }
  // flyover: the page as a long tilted plane, the camera glides down it
  const wp = seg(t, wallStart, END0 + 0.3);
  show(wall, t >= wallStart && t < END0 + 0.35 ? Math.min(1, seg(t, wallStart, wallStart + 0.25)) * (1 - seg(t, END0, END0 + 0.35)) : 0);
  wall.style.transform = `translateY(${200 - E.inOut(wp) * (S.h * 0.55)}px) perspective(2000px) rotateX(52deg) rotateZ(${-24 + 10 * wp}deg) scale(${0.95 + 0.15 * wp})`;
  wimg.style.top = '0px';
  // end card
  const ep = E.outBack(seg(t, END0, END0 + 0.6));
  show(end, seg(t, END0, END0 + 0.25));
  end.style.transform = `scale(${0.85 + 0.15 * ep})`;
  KIT.stage.style.opacity = 1 - seg(t, DUR - 0.4, DUR);
}
KIT.start({ dur: DUR, render });
