// Director engine shared by every project (loaded by <project>/film/index.html).
//
// The one rule: render(t) must set EVERYTHING on screen from t alone. Frames are rendered out of order by
// several browser pages in parallel, so no state may carry from one frame to the next, no CSS transitions,
// no requestAnimationFrame, no Date.now(). Build the DOM once at load, then only change styles in render(t).
'use strict';
(function () {
  const K = {};
  // ── maths ────────────────────────────────────────────────────────────────
  K.clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  K.seg = (t, a, b) => K.clamp((t - a) / (b - a));              // 0 before a → 1 after b
  K.lerp = (a, b, p) => a + (b - a) * p;
  K.E = {
    inOut: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
    out: (p) => 1 - Math.pow(1 - p, 3),
    outExpo: (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)),
    in: (p) => p * p * p,
    outBack: (p) => { const c = 1.6; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); },
  };
  // fade in over [a, a+fi], hold, fade out over [b-fo, b]
  K.win = (t, a, b, fi = 0.4, fo = 0.4) => Math.min(K.seg(t, a, a + fi), 1 - K.seg(t, b - fo, b));

  // ── music grid (window.MUSIC from tools/sched.py) ────────────────────────
  const MU = window.MUSIC || { beat: 0.6, bar: 2.4, t0: 0 };
  K.MUSIC = MU;
  K.beat = (k) => MU.t0 + k * MU.beat;
  K.bar = (k) => MU.t0 + k * MU.bar;
  K.snap = (t, unit = MU.beat) => MU.t0 + Math.round((t - MU.t0) / unit) * unit;  // nearest beat (or bar)
  K.pulse = (t, decay = 9) => {                       // 1 on each beat, decaying — for kick "pumps"
    const x = (t - MU.t0) / MU.beat; if (x < 0) return 0;
    return Math.exp(-(x - Math.floor(x)) * MU.beat * decay);
  };

  // ── voiceover (window.VO from tools/sched.py) ────────────────────────────
  const VO = window.VO || {};
  K.VO = VO;
  K.V = (id) => { if (!VO[id]) throw new Error('no VO line ' + id); return VO[id]; };
  const norm = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '');
  // W('add', 'type') = time the word "type" starts in line "add"; nth for repeated words.
  // Throws when the word is missing, so a script edit that breaks a cue fails loudly at render time.
  K.W = (id, word, nth = 1) => {
    const ws = K.V(id).words; let n = 0;
    for (const w of ws) if (norm(w.w) === norm(word) && ++n === nth) return w.t;
    throw new Error(`word "${word}" (#${nth}) not in VO line ${id}: ${K.V(id).text}`);
  };
  // display tokens (text split on spaces) → start time of each, matched in order against the spoken words.
  // Tolerant of punctuation and of TTS splitting "to-do" / "₹500" differently from the text.
  K.align = (id) => {
    const v = K.V(id), ws = v.words, toks = v.text.split(/\s+/);
    let wi = 0;
    return toks.map((tok) => {
      const n = norm(tok);
      if (!n) return ws[Math.min(wi, ws.length - 1)].t;
      for (let j = wi; j < Math.min(ws.length, wi + 4); j++) {
        const m = norm(ws[j].w);
        if (m && (n.includes(m) || m.includes(n))) {
          const t = ws[j].t; wi = j + 1;
          let acc = m;                       // "to-do" spoken as "to" + "do": swallow the rest
          while (wi < ws.length && norm(ws[wi].w) && n.includes(acc + norm(ws[wi].w))) acc += norm(ws[wi++].w);
          return t;
        }
      }
      return ws[Math.min(wi, ws.length - 1)].t;
    });
  };
  K.WE = (id, word, nth = 1) => {        // end time of that word
    const ws = K.V(id).words; let n = 0;
    for (const w of ws) if (norm(w.w) === norm(word) && ++n === nth) return w.t + w.d;
    throw new Error(`word "${word}" not in VO line ${id}`);
  };

  // ── DOM helpers ──────────────────────────────────────────────────────────
  K.W_ = (window.PROJECT && window.PROJECT.width) || 1920;      // frame size (project.json width/height)
  K.H_ = (window.PROJECT && window.PROJECT.height) || 1080;
  K.stage = document.getElementById('stage');
  for (const e of [document.documentElement, document.body]) { e.style.width = K.W_ + 'px'; e.style.height = K.H_ + 'px'; }
  K.el = (tag, cls, parent = K.stage, html = '') => {
    const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html;
    parent.appendChild(e); return e;
  };
  K.css = (e, o) => { for (const k in o) e.style[k] = o[k]; };
  K.show = (e, op) => { e.style.opacity = op; e.style.visibility = op > 0.001 ? 'visible' : 'hidden'; };
  // Image swaps must finish decoding before the screenshot, so render() awaits them.
  const pending = [];
  K.img = (imgEl, src) => {
    if (imgEl.dataset.src === src) return;
    imgEl.dataset.src = src; imgEl.src = src;
    pending.push(imgEl.decode().catch(() => console.error('image failed ' + src)));
  };

  // ── recorded clip (window.CLIP from record.mjs) ──────────────────────────
  // anchors = [[clipTime, filmTime], ...] ascending. Between anchors the take plays at constant speed,
  // so "this tap lands on this word" is one anchor. Outside the anchors it plays at 1×.
  K.clip = (C, anchors) => {
    const A = anchors;
    const map = (x, from, to) => {
      if (x <= A[0][from]) return A[0][to] + (x - A[0][from]);
      for (let i = 1; i < A.length; i++) if (x <= A[i][from]) {
        const a = A[i - 1], b = A[i];
        return K.lerp(a[to], b[to], (x - a[from]) / (b[from] - a[from]));
      }
      const L = A[A.length - 1]; return L[to] + (x - L[from]);
    };
    const speeds = A.slice(1).map((b, i) => +((b[0] - A[i][0]) / (b[1] - A[i][1])).toFixed(2));
    const bad = speeds.filter((s) => s < 0.4 || s > 2.5);
    if (bad.length) console.error('clip speeds look wrong (want 0.4–2.5×): ' + speeds.join(', '));
    const clipAt = (ft) => map(ft, 1, 0), filmAt = (ct) => map(ct, 0, 1);
    const frameAt = (ct) => {        // last frame whose time ≤ ct (CDP sends frames only on change)
      const T = C.t; let lo = 0, hi = T.length - 1;
      if (ct <= T[0]) return C.dir + C.files[0];
      while (lo < hi) { const m = (lo + hi + 1) >> 1; if (T[m] <= ct) lo = m; else hi = m - 1; }
      return C.dir + C.files[lo];
    };
    const mark = (name) => { if (!(name in C.marks)) throw new Error('no clip mark ' + name); return C.marks[name]; };
    const tap = (name) => { const x = C.taps.find((q) => q.name === name); if (!x) throw new Error('no clip tap ' + name); return x; };
    // recorded pointer path (record.mjs logs C.moves = [{t, x, y}]) → position at clip time, eased between samples
    const pointerAt = (ct) => {
      const M = C.moves || []; if (!M.length) return null;
      if (ct <= M[0].t) return M[0];
      for (let i = 1; i < M.length; i++) if (ct <= M[i].t) {
        const a = M[i - 1], b = M[i], p = K.E.inOut((ct - a.t) / (b.t - a.t || 1));
        return { x: K.lerp(a.x, b.x, p), y: K.lerp(a.y, b.y, p) };
      }
      return M[M.length - 1];
    };
    return { C, clipAt, filmAt, frameAt, mark, tap, speeds, pointerAt, taps: C.taps.map((q) => ({ ...q, ft: filmAt(q.t) })) };
  };

  // ── phone mock-up showing a clip, with a camera ─────────────────────────
  // ph = K.phone({ x, y, scale }) → ph.set(t, clipTime, cam = { z, fx, fy }, taps)
  K.phone = ({ w = 390, h = 797, bar = 47, parent = K.stage, barColor = '#f6f4ef', barText = '#1d1b16' } = {}) => {
    const root = K.el('div', 'kit-phone', parent);
    K.css(root, { width: w + 'px', height: h + bar + 'px' });
    const sb = K.el('div', 'kit-status', root, `<b>9:41</b><span>▂▄▆ ᯤ ▮</span>`);
    K.css(sb, { height: bar + 'px', background: barColor, color: barText });
    const view = K.el('div', 'kit-view', root); K.css(view, { top: bar + 'px', width: w + 'px', height: h + 'px' });
    const cam = K.el('div', 'kit-cam', view); K.css(cam, { width: w + 'px', height: h + 'px' });
    const im = K.el('img', 'kit-screen', cam); K.css(im, { width: w + 'px', height: h + 'px' });
    const ring = K.el('div', 'kit-tap', cam);
    return {
      root,
      set(t, src, c = { z: 1, fx: w / 2, fy: h / 2 }, taps = []) {
        K.img(im, src);
        // bring app point (fx, fy) to the centre, zoomed z, clamped so no empty edge shows
        const z = Math.max(1, c.z);
        const tx = K.clamp(w / 2 - c.fx * z, w - w * z, 0), ty = K.clamp(h / 2 - c.fy * z, h - h * z, 0);
        cam.style.transform = `translate(${tx}px, ${ty}px) scale(${z})`;
        // tap ring: last tap within 0.6 s
        let r = null; for (const q of taps) if (t >= q.ft && t < q.ft + 0.6) r = q;
        if (r) {
          const p = (t - r.ft) / 0.6;
          K.css(ring, { left: r.x + 'px', top: r.y + 'px', opacity: (1 - p) * 0.9, transform: `translate(-50%,-50%) scale(${0.5 + p})` });
        } else ring.style.opacity = 0;
      },
    };
  };
  // camera keyframes [{t, z, fx, fy}] → smooth camera at t (ease in/out between keys)
  K.camAt = (keys, t) => {
    if (t <= keys[0].t) return keys[0];
    for (let i = 1; i < keys.length; i++) if (t <= keys[i].t) {
      const a = keys[i - 1], b = keys[i], p = K.E.inOut((t - a.t) / (b.t - a.t));
      return { z: K.lerp(a.z, b.z, p), fx: K.lerp(a.fx, b.fx, p), fy: K.lerp(a.fy, b.fy, p) };
    }
    return keys[keys.length - 1];
  };

  // ── words that appear as they are spoken ────────────────────────────────
  // K.words(container, 'hook') builds one span per VO word; call .set(t) each frame.
  K.words = (parent, id, cls = 'kit-word') => {
    const v = K.V(id);
    const parts = v.text.split(/\s+/);
    const spans = parts.map((p) => K.el('span', cls, parent, p.replace(/&/g, '&amp;').replace(/</g, '&lt;') + ' '));
    const times = K.align(id);
    return {
      spans,
      set(t) { spans.forEach((s, i) => { const p = K.E.out(K.seg(t, times[i] - 0.08, times[i] + 0.22)); s.style.opacity = p; s.style.transform = `translateY(${(1 - p) * 22}px)`; }); },
    };
  };

  // ── subtitles: the current VO line, spoken words highlighted ────────────
  K.subtitles = (ids, parent = K.stage) => {
    const box = K.el('div', 'kit-subs', parent);
    const rows = ids.map((id) => ({ id, v: K.V(id), row: K.el('div', 'kit-subrow', box), w: null, ts: K.align(id) }));
    rows.forEach((r) => { r.w = r.v.text.split(/\s+/).map((p) => { const s = K.el('span', '', r.row); s.textContent = p + ' '; return s; }); });
    return {
      box,
      set(t, on = 1) {
        let cur = null;
        for (const r of rows) if (t >= r.v.start - 0.15 && t <= r.v.end + 0.35) cur = r;
        rows.forEach((r) => {
          const op = r === cur ? K.win(t, r.v.start - 0.15, r.v.end + 0.35, 0.15, 0.2) * on : 0;
          K.show(r.row, op);
          if (r === cur) r.w.forEach((s, i) => { s.className = t >= r.ts[i] ? 'said' : ''; });
        });
      },
    };
  };

  // ── browser window mock-up: K.browser({ w, h, url }) → { root, view, img } (view = the page area, h tall) ──
  K.browser = ({ w = 1440, h = 900, url = 'example.com', parent = K.stage } = {}) => {
    const root = K.el('div', 'kit-browser', parent); K.css(root, { width: w + 'px', height: h + 52 + 'px' });
    const ch = K.el('div', 'kit-chrome', root, '<i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i>');
    const u = K.el('div', 'kit-url', ch); u.textContent = '🔒  ' + url;
    const view = K.el('div', 'kit-bview', root); K.css(view, { width: w + 'px', height: h + 'px' });
    return { root, view, url: u };
  };

  // ── mouse cursor: K.cursor(parent) → .set(x, y, pressed 0..1) ──
  K.cursor = (parent = K.stage) => {
    const c = K.el('div', 'kit-cursor', parent,
      '<svg viewBox="0 0 24 24" width="34" height="34"><path d="M4 2 L4 19 L8.6 14.8 L11.6 21.6 L14.5 20.4 L11.6 13.7 L17.8 13.7 Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>');
    return { el: c, set(x, y, down = 0, op = 1) { c.style.transform = `translate(${x - 6}px, ${y - 3}px) scale(${1 - 0.15 * down})`; K.show(c, op); } };
  };

  // ── magnifier bubble: a round lens showing part of an image enlarged ──
  // m = K.magnifier(parent, size) ; m.set(src, srcW, srcH, cx, cy, zoom, x, y, opacity)
  // shows the point (cx, cy) of the source (in source px of a srcW×srcH image) at `zoom`, lens centred at (x, y)
  K.magnifier = (parent = K.stage, size = 320) => {
    const m = K.el('div', 'kit-mag', parent); K.css(m, { width: size + 'px', height: size + 'px' });
    const im = K.el('img', '', m);
    return {
      el: m,
      set(src, sw, sh, cx, cy, zoom, x, y, op = 1) {
        K.img(im, src);
        K.css(im, { width: sw + 'px', height: sh + 'px', transform: `translate(${size / 2 - cx * zoom}px, ${size / 2 - cy * zoom}px) scale(${zoom})` });
        m.style.left = x - size / 2 + 'px'; m.style.top = y - size / 2 + 'px';
        m.style.transform = `scale(${0.3 + 0.7 * K.E.outBack(op)})`; K.show(m, op);
      },
    };
  };

  // ── number that counts up: K.count(el, to, t0, t1, fmt) → .set(t) ──
  K.count = (el, to, t0, t1, fmt = (v) => Math.round(v).toLocaleString('en-US'), from = 0) => ({
    set(t) { el.textContent = fmt(K.lerp(from, to, K.E.outExpo(K.seg(t, t0, t1)))); },
  });

  // ── SFX cues: registered once at load, exported to timeline.json for tools/mix.py ──
  // kinds: whoosh, whooshdown, pop, tap, click, impact, chime, riser, glitch
  const cues = [];
  K.cue = (t, kind, gain = 1) => { cues.push({ t: +t.toFixed(3), kind, gain }); };

  // ── start ───────────────────────────────────────────────────────────────
  // K.start({ dur, render(t), music }) — exposes window.render / window.FILM / window.READY for tools/render.mjs.
  // music: overrides for the generated soundtrack decided by the edit, e.g. { end_bar: 5 } puts the final hit there.
  K.start = ({ dur, render, music = {} }) => {
    window.FILM = { DUR: +dur.toFixed(3), FPS: (window.PROJECT && window.PROJECT.fps) || 60, cues: cues.sort((a, b) => a.t - b.t), VO: window.VO, MUSIC: MU, music };
    window.render = async (t) => {
      render(t);
      while (pending.length) await pending.shift();
    };
    window.READY = document.fonts.ready.then(() => window.render(0)).then(() => true);
    // open film/index.html#12.5 in a browser to preview a moment; #play to play in real time (approximate)
    const h = location.hash.slice(1);
    if (h === 'play') { const t0 = performance.now(); const loop = () => { render((performance.now() - t0) / 1000); requestAnimationFrame(loop); }; loop(); }
    else if (h) window.render(Number(h));
  };

  window.KIT = K;
})();
