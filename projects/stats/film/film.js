// Data story. Every number lands on the word that says it; panels swap between lines.
'use strict';
const { el, css, show, seg, lerp, win, E, V, W, cue } = KIT;
// first of several spellings the TTS might produce ("ninety-two" may come back as "ninety" + "two")
const Wany = (id, ...ws) => { for (const w of ws) { try { return W(id, w); } catch (e) {} } throw new Error('none of ' + ws + ' in ' + id); };
const svgNS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs, parent) => { const e = document.createElementNS(svgNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.appendChild(e); return e; };

const tag = el('div', 'tag', undefined, 'Illustrative data');
const spans = [];                                   // [in, out] per panel, from the VO
const P1 = V('s1').start - 0.5, P2 = V('s2').start - 0.4, P3 = V('s3').start - 0.4, P4 = V('end').start - 0.3;
const DUR = window.PROJECT.speechEnd + window.PROJECT.tail;

// ── panel 1: +40% — before/after bars ──
const p1 = el('div', 'panel');
const n1 = el('div', 'num', p1); n1.style.color = 'var(--g)';
el('div', 'lbl', p1, 'more tasks finished<br><span>after switching to Tidy</span>');
const bars = el('div', 'chart bars', p1);
const H1 = [38, 42, 40, 45, 58, 63, 61, 66];   // weekly tasks: 4 weeks before, 4 after
const bEls = H1.map((h, i) => { const b = el('div', i >= 4 ? 'after' : '', bars); b.style.height = h * 1.2 + '%'; b.style.position = 'relative'; return b; });
const lg = el('div', 'legend', p1, '<span><i style="background:#34385e"></i>4 weeks before</span><span><i style="background:var(--g)"></i>4 weeks with Tidy</span>');
const T40 = Wany('s1', 'forty', '40');
const c1 = KIT.count(n1, 40, T40 - 0.1, T40 + 0.9, (v) => '+' + Math.round(v) + '%');
cue(T40, 'pop'); cue(P1 + 0.2, 'whoosh', 0.5);

// ── panel 2: −50% — line chart drawn left to right ──
const p2 = el('div', 'panel');
const n2 = el('div', 'num', p2); n2.style.color = 'var(--o)';
el('div', 'lbl', p2, 'fewer missed deadlines<br><span>per team, per month</span>');
const s2 = svg('svg', { class: 'chart', viewBox: '0 0 880 600', width: 880, height: 600 }, p2); s2.style.position = 'absolute'; s2.style.left = '940px'; s2.style.top = '190px';
for (let i = 0; i < 5; i++) svg('line', { x1: 0, x2: 880, y1: 60 + i * 120, y2: 60 + i * 120, stroke: '#23264a', 'stroke-width': 2 }, s2);
const PTS = [[0, 120], [125, 140], [250, 110], [375, 150], [500, 300], [625, 380], [750, 400], [880, 420]];
const d = 'M' + PTS.map((p) => p.join(',')).join(' L');
const area = svg('path', { d: d + ' L880,600 L0,600 Z', fill: 'url(#gr)', opacity: 0 }, s2);
const defs = svg('defs', {}, s2); const gr = svg('linearGradient', { id: 'gr', x1: 0, x2: 0, y1: 0, y2: 1 }, defs);
svg('stop', { offset: 0, 'stop-color': '#ff9a4d', 'stop-opacity': 0.35 }, gr); svg('stop', { offset: 1, 'stop-color': '#ff9a4d', 'stop-opacity': 0 }, gr);
const line = svg('path', { d, fill: 'none', stroke: '#ff9a4d', 'stroke-width': 8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, s2);
const LEN = line.getTotalLength(); line.style.strokeDasharray = LEN;
const dot = svg('circle', { r: 14, fill: '#ff9a4d' }, s2);
svg('text', { x: 10, y: 590 }, s2).textContent = 'Before Tidy'; svg('text', { x: 700, y: 590 }, s2).textContent = 'With Tidy';
const THALF = W('s2', 'half');
const c2 = KIT.count(n2, 50, THALF - 0.1, THALF + 0.8, (v) => '−' + Math.round(v) + '%');
cue(P2, 'whoosh', 0.6); cue(THALF, 'pop');

// ── panel 3: 92% — donut ──
const p3 = el('div', 'panel');
const n3 = el('div', 'num', p3); n3.style.color = 'var(--v)';
el('div', 'lbl', p3, 'say their week<br>feels calmer<br><span>survey of Tidy users</span>');
const s3 = svg('svg', { viewBox: '0 0 600 600', width: 600, height: 600 }, p3); s3.style.position = 'absolute'; s3.style.left = '1060px'; s3.style.top = '210px';
svg('circle', { cx: 300, cy: 300, r: 230, fill: 'none', stroke: '#23264a', 'stroke-width': 56 }, s3);
const ring = svg('circle', { cx: 300, cy: 300, r: 230, fill: 'none', stroke: '#9b7bff', 'stroke-width': 56, 'stroke-linecap': 'round', transform: 'rotate(-90 300 300)' }, s3);
const C = 2 * Math.PI * 230; ring.style.strokeDasharray = C;
const T92 = Wany('s3', 'ninety-two', 'ninety', '92');
const c3 = KIT.count(n3, 92, T92 - 0.1, T92 + 1.0, (v) => Math.round(v) + '%');
cue(P3, 'whoosh', 0.6); cue(T92, 'pop'); cue(T92 + 1.0, 'chime', 0.6);

// ── end ──
const logo = el('div', 'logo', undefined, '<div class="m"></div>Tidy');
const etag = el('div', 'etag'); const etagW = KIT.words(etag, 'end');
etagW.spans[0].style.display = 'none';                      // "Tidy." is the logo itself
cue(W('end', 'Tidy'), 'impact', 0.7);
const subs = KIT.subtitles(['s1', 's2', 's3']);

// panel transitions: the old panel slides left and fades, the new one comes in from the right
const panelOp = (t, a, b) => {
  const i = E.outExpo(seg(t, a, a + 0.7)), o = E.in(seg(t, b - 0.35, b));
  return { op: Math.min(seg(t, a, a + 0.3), 1 - o), x: (1 - i) * 260 - o * 260 };
};
function place(p, t, a, b) { const s = panelOp(t, a, b); show(p, s.op); p.style.transform = `translateX(${s.x}px)`; }

function render(t) {
  place(p1, t, P1, P2); place(p2, t, P2, P3); place(p3, t, P3, P4);
  // 1: "before" bars grow first, "after" bars grow on "forty"
  bEls.forEach((b, i) => { const t0 = i < 4 ? P1 + 0.3 + i * 0.08 : T40 - 0.25 + (i - 4) * 0.1; b.style.transform = `scaleY(${E.outBack(seg(t, t0, t0 + 0.6))})`; });
  c1.set(t);
  // 2: line draws from "Missed" to "half", area fades in behind it
  const lp = E.inOut(seg(t, V('s2').start, THALF + 0.3));
  line.style.strokeDashoffset = LEN * (1 - lp);
  const pt = line.getPointAtLength(LEN * lp); dot.setAttribute('cx', pt.x); dot.setAttribute('cy', pt.y);
  area.setAttribute('opacity', seg(t, THALF, THALF + 0.6));
  c2.set(t);
  // 3: donut fills on "ninety-two"
  ring.style.strokeDashoffset = C * (1 - 0.92 * E.outExpo(seg(t, T92 - 0.1, T92 + 1.1)));
  c3.set(t);
  subs.set(t);
  const lo = E.outBack(seg(t, P4 + 0.1, P4 + 0.7));
  show(logo, seg(t, P4 + 0.1, P4 + 0.3)); logo.style.transform = `translate(-50%, -50%) translateY(-50px) scale(${0.7 + 0.3 * lo})`;
  etagW.set(t);
  show(tag, 1 - seg(t, P4 - 0.2, P4));
  KIT.stage.style.opacity = Math.min(seg(t, 0, 0.3), 1 - seg(t, DUR - 0.5, DUR));
}
KIT.start({ dur: DUR, render });
