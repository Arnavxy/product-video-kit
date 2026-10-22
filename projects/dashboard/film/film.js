// Desktop walkthrough. Page coordinates (from the recorder) map to the stage through the camera:
// stage = (tx + s·x, ty + s·(52 + y)), where 52 px is the browser's title bar.
'use strict';
const { el, css, show, seg, lerp, E, V, W, WE, cue } = KIT;
const tap = (n) => CLIP.taps.find((q) => q.name === n);
const clip = KIT.clip(CLIP, [
  [CLIP.marks.open + 0.2, V('d1').start - 0.4],
  [tap('design').t, W('d2', 'team')],                 // click "Design" on "team"
  [tap('all').t, WE('d2', 'click') + 0.25],
  [tap('riskcard').t, W('d3', 'spot')],               // click "At risk" on "spot"
  [CLIP.marks.inspect, W('d3', 'before')],            // lens opens on "before it slips"
  [CLIP.marks.end, V('end').start + 0.3],
]);
const IN = 0, OUT = V('end').start - 0.15, DUR = window.PROJECT.speechEnd + window.PROJECT.tail;

const rig = el('div', 'rig');
const br = KIT.browser({ w: 1440, h: 900, url: 'app.tidy.example/projects', parent: rig });
const screen = el('img', '', br.view); css(screen, { width: '1440px', height: '900px' });
const cursor = KIT.cursor(rig);
const ripple = el('div', 'ripple', rig);
const mag = KIT.magnifier(KIT.stage, 380);
const cap = el('div', 'cap');
const CAPS = [['d1', 'One calm dashboard'], ['d2', 'Filter in one click'], ['d3', 'Spot risk early']]
  .map(([id, txt]) => ({ a: V(id).start - 0.2, b: V(id).end + 0.5, txt }));
const end = el('div', 'end', undefined, '<div class="row"><div class="m"></div>Tidy <small>for Teams</small></div>');

// camera keys in page coordinates: s = scale, (fx, fy) = page point at the frame centre
const dT = clip.filmAt(tap('design').t), aT = clip.filmAt(tap('all').t), rT = clip.filmAt(tap('riskcard').t), iT = clip.filmAt(CLIP.marks.inspect);
const D = tap('design'), R = tap('riskcard');
const WIDE = { s: 1.04, fx: 720, fy: 440 };
const CAM = [
  { t: 0, s: 0.86, fx: 720, fy: 470 }, { t: 1.4, ...WIDE },
  { t: dT - 0.9, ...WIDE }, { t: dT - 0.1, s: 1.75, fx: D.x - 120, fy: D.y + 90 }, { t: aT + 0.2, s: 1.75, fx: D.x - 120, fy: D.y + 90 },
  { t: aT + 0.9, ...WIDE }, { t: rT - 0.6, ...WIDE }, { t: rT + 0.4, s: 1.35, fx: R.x - 150, fy: R.y + 200 },
  { t: OUT, s: 1.35, fx: R.x - 150, fy: R.y + 200 },
];
const camAt = (t) => {
  if (t <= CAM[0].t) return CAM[0];
  for (let i = 1; i < CAM.length; i++) if (t <= CAM[i].t) {
    const a = CAM[i - 1], b = CAM[i], p = E.inOut(seg(t, a.t, b.t));
    return { s: lerp(a.s, b.s, p), fx: lerp(a.fx, b.fx, p), fy: lerp(a.fy, b.fy, p) };
  }
  return CAM[CAM.length - 1];
};
clip.taps.forEach((q) => cue(q.ft, 'click', 1.2));
cue(dT - 0.9, 'whoosh', 0.4); cue(rT - 0.6, 'whoosh', 0.4); cue(iT, 'pop', 0.8); cue(OUT, 'whoosh', 0.7); cue(W('end', 'Tidy'), 'impact', 0.7);

function render(t) {
  const c = camAt(t), s = c.s;
  const tx = 960 - s * c.fx, ty = 540 - s * (52 + c.fy);
  const out = E.in(seg(t, OUT - 0.3, OUT + 0.2));
  show(rig, 1 - out);
  rig.style.transform = `translate(${tx}px, ${ty + out * 80}px) scale(${s * (1 - 0.08 * out)})`;
  const ct = Math.min(clip.clipAt(t), CLIP.marks.end);
  KIT.img(screen, clip.frameAt(ct));
  // cursor from the recorded path; presses on clicks
  const p = clip.pointerAt(ct);
  let down = 0, rip = null;
  for (const q of clip.taps) { if (t >= q.ft - 0.08 && t < q.ft + 0.12) down = 1; if (t >= q.ft && t < q.ft + 0.5) rip = q; }
  cursor.set(p.x, p.y + 52, down, 1);
  if (rip) { const k = (t - rip.ft) / 0.5; css(ripple, { left: rip.x + 'px', top: rip.y + 52 + 'px', opacity: 1 - k, transform: `scale(${0.4 + 1.2 * k})` }); }
  else ripple.style.opacity = 0;
  // magnifier: follows the inspected row while the VO says "before it slips"
  const mo = seg(t, iT - 0.1, iT + 0.35) * (1 - seg(t, OUT - 0.25, OUT));
  const sx = tx + s * p.x, sy = ty + s * (52 + p.y);
  mag.set(clip.frameAt(ct), 1440, 900, p.x, p.y, 2.4, Math.min(sx + 380, 1700), sy - 150, mo);
  // captions
  let cur = null; for (const k of CAPS) if (t >= k.a && t < k.b) cur = k;
  if (cur) { cap.textContent = cur.txt; const o = Math.min(seg(t, cur.a, cur.a + 0.3), 1 - seg(t, cur.b - 0.25, cur.b)); show(cap, o); cap.style.transform = `translateY(${(1 - E.out(seg(t, cur.a, cur.a + 0.4))) * 30}px)`; }
  else show(cap, 0);
  const e = E.outBack(seg(t, OUT, OUT + 0.6));
  show(end, seg(t, OUT, OUT + 0.25)); end.style.transform = `scale(${0.85 + 0.15 * e})`;
  KIT.stage.style.opacity = 1 - seg(t, DUR - 0.4, DUR);
}
KIT.start({ dur: DUR, render });
