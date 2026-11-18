const SVGNS = 'http://www.w3.org/2000/svg';
function svg(tag, attrs, children) {
  const n = document.createElementNS(SVGNS, tag);
  if (attrs) for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
  if (children) for (const c of [].concat(children)) if (c != null) n.append(c);
  return n;
}
function niceStep(range, n) { const raw = range / n; const p = Math.pow(10, Math.floor(Math.log10(raw))); const r = raw / p; return (r < 1.5 ? 1 : r < 3.5 ? 2 : r < 7.5 ? 5 : 10) * p; }
function ticksFor(min, max, n) { const step = niceStep(max - min || 1, n); const out = []; for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(+v.toFixed(10)); return { step, ticks: out }; }
function widthOf(container, fallback) { const w = container.clientWidth || (container.parentElement && container.parentElement.clientWidth) || fallback || 640; return Math.max(280, w); }
function pathFrom(points) { let d = ''; for (let i = 0; i < points.length; i++) d += (i ? 'L' : 'M') + points[i][0].toFixed(1) + ' ' + points[i][1].toFixed(1); return d; }
const TXT = 'font-family:var(--font);';

/** Line chart with optional bands, dots, markers, crosshair tooltip and table view. */
function lineChart(container, spec) {
  container.innerHTML = '';
  const W = widthOf(container, spec.width), H = spec.height || 240;
  const mL = spec.marginLeft || 52, mR = spec.marginRight || (spec.endLabels ? 70 : 18), mT = 16, mB = 30;
  const pw = W - mL - mR, ph = H - mT - mB;
  const x0 = spec.xDomain[0], x1 = spec.xDomain[1];
  let yMax = -Infinity, yMin = spec.yMin == null ? 0 : spec.yMin;
  const inDom = (xx) => xx >= x0 - 1e-9 && xx <= x1 + 1e-9;
  for (const s of spec.series) {
    const xs = s.x || spec.x;
    for (let k = 0; k < xs.length; k++) if (inDom(xs[k])) {
      const v = s.values[k]; if (v != null && isFinite(v)) yMax = Math.max(yMax, v);
      if (s.bands) for (const b of s.bands) { const h = b.hi[k]; if (h != null && isFinite(h)) yMax = Math.max(yMax, h); }
    }
  }
  if (spec.yMax != null) yMax = Math.max(yMax, spec.yMax);
  if (!isFinite(yMax) || yMax <= 0) yMax = 1;
  const yt = ticksFor(yMin, yMax, 4); yMax = Math.max(yMax, yt.ticks[yt.ticks.length - 1]);
  const sx = x => mL + (x - x0) / (x1 - x0) * pw, sy = y => mT + ph - (y - yMin) / (yMax - yMin) * ph;
  const root = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img', 'aria-label': spec.aria || 'chart', style: TXT + 'font-size:11px' });
  // grid + y labels
  for (const v of yt.ticks) {
    root.append(svg('line', { x1: mL, x2: mL + pw, y1: sy(v), y2: sy(v), style: 'stroke:var(--grid);stroke-width:1' }));
    root.append(svg('text', { x: mL - 8, y: sy(v) + 3.5, 'text-anchor': 'end', style: 'fill:var(--muted);font-variant-numeric:tabular-nums' }, (spec.yFmt || fmt.compact)(v)));
  }
  // x ticks
  const xt = spec.xTicks || (() => { const out = []; for (let y = Math.ceil(x0); y <= x1; y++) out.push({ v: y, label: String(y) }); return out; })();
  const every = xt.length > 10 ? Math.ceil(xt.length / 10) : 1;
  xt.forEach((tk, i) => {
    root.append(svg('line', { x1: sx(tk.v), x2: sx(tk.v), y1: mT + ph, y2: mT + ph + 4, style: 'stroke:var(--axis);stroke-width:1' }));
    if (i % every === 0) root.append(svg('text', { x: sx(tk.v), y: mT + ph + 16, 'text-anchor': 'middle', style: 'fill:var(--muted)' }, tk.label));
  });
  root.append(svg('line', { x1: mL, x2: mL + pw, y1: mT + ph, y2: mT + ph, style: 'stroke:var(--axis);stroke-width:1' }));
  if (spec.yTitle) root.append(svg('text', { x: mL, y: 10, style: 'fill:var(--muted)' }, spec.yTitle));
  // clip
  const clipId = 'clip' + Math.random().toString(36).slice(2, 8);
  root.append(svg('defs', null, svg('clipPath', { id: clipId }, svg('rect', { x: mL, y: mT - 2, width: pw, height: ph + 2 }))));
  const g = svg('g', { 'clip-path': 'url(#' + clipId + ')' }); root.append(g);
  // markers
  for (const mk of spec.markers || []) {
    if (!inDom(mk.x)) continue;
    g.append(svg('line', { x1: sx(mk.x), x2: sx(mk.x), y1: mT, y2: mT + ph, style: 'stroke:var(--axis);stroke-width:1;stroke-dasharray:3 3' }));
    root.append(svg('text', { x: sx(mk.x) + 4, y: mT + 10, style: 'fill:var(--muted);font-size:10.5px' }, mk.label));
  }
  const endLabels = [];
  // bands then lines
  for (const s of spec.series) {
    const xs = s.x || spec.x;
    if (s.bands) for (const b of s.bands) {
      const up = [], dn = [];
      for (let k = 0; k < xs.length; k++) if (inDom(xs[k]) && b.hi[k] != null && b.lo[k] != null) { up.push([sx(xs[k]), sy(b.hi[k])]); dn.push([sx(xs[k]), sy(b.lo[k])]); }
      if (!up.length) continue;
      const d = pathFrom(up) + 'L' + dn.reverse().map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') + 'Z';
      g.append(svg('path', { d, style: 'fill:' + s.color + ';fill-opacity:' + (b.opacity || 0.12) + ';stroke:none' + (b.hatch ? ';stroke:' + s.color + ';stroke-opacity:.35;stroke-width:1;stroke-dasharray:2 3' : '') }));
    }
  }
  for (const s of spec.series) {
    const xs = s.x || spec.x;
    if (s.type === 'dots') {
      for (let k = 0; k < xs.length; k++) if (inDom(xs[k]) && s.values[k] != null) g.append(svg('circle', { cx: sx(xs[k]), cy: sy(s.values[k]), r: 3, style: 'fill:' + s.color + ';stroke:var(--surface);stroke-width:1.5' }));
      continue;
    }
    const pts = []; for (let k = 0; k < xs.length; k++) if (inDom(xs[k]) && s.values[k] != null && isFinite(s.values[k])) pts.push([sx(xs[k]), sy(s.values[k])]);
    if (!pts.length) continue;
    g.append(svg('path', { d: pathFrom(pts), style: 'fill:none;stroke:' + s.color + ';stroke-width:' + (s.width || 2) + ';stroke-linejoin:round;stroke-linecap:round;' + (s.dash ? 'stroke-dasharray:' + s.dash + ';' : '') + (s.opacity != null ? 'stroke-opacity:' + s.opacity + ';' : '') }));
    if (s.endDot) { const last = pts[pts.length - 1]; g.append(svg('circle', { cx: last[0], cy: last[1], r: 4, style: 'fill:' + s.color + ';stroke:var(--surface);stroke-width:2' })); }
    if (spec.endLabels && s.endLabel) { const last = pts[pts.length - 1]; endLabels.push({ x: last[0], y: last[1], text: s.endLabel }); }
  }
  // end labels: group the ones that would collide (within 11px) into one label
  endLabels.sort((a, b) => a.y - b.y);
  let grp = [];
  const flush = () => { if (!grp.length) return; const y = grp.reduce((a, b) => a + b.y, 0) / grp.length; const names = grp.map(e => e.text); const text = names.length > 3 ? names.slice(0, 2).join(', ') + ' +' + (names.length - 2) : names.join(', '); root.append(svg('text', { x: Math.max(...grp.map(e => e.x)) + 6, y: y + 3.5, style: 'fill:var(--ink-2);font-size:11px' }, text)); grp = []; };
  for (const e of endLabels) { if (grp.length && e.y - grp[grp.length - 1].y > 11) flush(); grp.push(e); }
  flush();
  // hover layer
  const tip = el('div', { class: 'tip', hidden: '' });
  const cross = svg('line', { x1: 0, x2: 0, y1: mT, y2: mT + ph, style: 'stroke:var(--ink-2);stroke-width:1;stroke-opacity:.5', visibility: 'hidden' }); root.append(cross);
  const hitDots = svg('g'); root.append(hitDots);
  const overlay = svg('rect', { x: mL, y: mT, width: pw, height: ph, style: 'fill:transparent', tabindex: 0 }); root.append(overlay);
  container.append(root, tip);
  const X = spec.x; let idx = -1;
  function show(i) {
    if (i < 0 || i >= X.length || !inDom(X[i])) { hide(); return; }
    idx = i; const xx = sx(X[i]); cross.setAttribute('x1', xx); cross.setAttribute('x2', xx); cross.setAttribute('visibility', 'visible');
    tip.innerHTML = ''; hitDots.innerHTML = '';
    tip.append(el('div', { class: 'tt', text: (spec.xLabel || fmt.ym)(X[i]) }));
    for (const s of spec.series) {
      if (s.noTip) continue;
      const xs = s.x || spec.x; let v = null; const vals = s.tipValues || s.values;
      if (xs === spec.x) v = vals[i]; else { let best = -1, bd = 1e9; for (let k = 0; k < xs.length; k++) { const d = Math.abs(xs[k] - X[i]); if (d < bd) { bd = d; best = k; } } if (bd < 0.03) v = vals[best]; }
      if (v == null || !isFinite(v)) continue;
      const row = el('div', { class: 'row' }); const kk = el('span', { class: 'k' }); kk.style.background = s.color; if (s.dash) kk.style.opacity = .6;
      const name = el('span', { text: s.name }); name.prepend(kk); row.append(name, el('span', { class: 'v', text: (spec.tipFmt || spec.yFmt || fmt.int)(v) })); tip.append(row);
      const vy = s.tipValues && xs === spec.x ? s.values[i] : v;
      hitDots.append(svg('circle', { cx: xx, cy: sy(vy), r: 3.5, style: 'fill:' + s.color + ';stroke:var(--surface);stroke-width:2' }));
    }
    tip.hidden = false;
    const cw = container.clientWidth || W; const tw = tip.offsetWidth; const left = xx / W * cw; const px = left + 12 + tw > cw ? left - tw - 12 : left + 12;
    tip.style.left = Math.max(0, px) + 'px'; tip.style.top = (mT + 4) / H * (container.clientHeight || H) + 'px';
  }
  function hide() { idx = -1; cross.setAttribute('visibility', 'hidden'); tip.hidden = true; hitDots.innerHTML = ''; }
  overlay.addEventListener('pointermove', ev => {
    const r = root.getBoundingClientRect(); const px = (ev.clientX - r.left) * (W / r.width); const xv = x0 + (px - mL) / pw * (x1 - x0);
    let best = 0, bd = 1e9; for (let k = 0; k < X.length; k++) { const d = Math.abs(X[k] - xv); if (d < bd) { bd = d; best = k; } }
    show(best);
  });
  overlay.addEventListener('pointerleave', hide);
  overlay.addEventListener('keydown', ev => { if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') { ev.preventDefault(); let i = idx < 0 ? X.findIndex(v => inDom(v)) : idx + (ev.key === 'ArrowRight' ? 1 : -1); show(i); } if (ev.key === 'Escape') hide(); });
  overlay.addEventListener('blur', hide);
  return { svg: root };
}

/** Bar chart: categories with value labels on the cap and an optional note above (e.g. % vs baseline). */
function barChart(container, spec) {
  container.innerHTML = '';
  const W = widthOf(container, spec.width), H = spec.height || 220;
  const mL = spec.marginLeft || 52, mR = 12, mT = spec.noteRow ? 34 : 24, mB = spec.labelRows ? 44 : 30;
  const pw = W - mL - mR, ph = H - mT - mB;
  const cats = spec.categories; const n = cats.length;
  let yMax = Math.max(...cats.map(c => Math.max(c.value, (c.stack || []).reduce((a, b) => a + b.value, 0))), 1);
  const yt = ticksFor(0, yMax, 4); yMax = Math.max(yMax, yt.ticks[yt.ticks.length - 1]);
  const sy = y => mT + ph - y / yMax * ph; const band = pw / n; const bw = Math.min(spec.maxBar || 28, band * 0.6);
  const root = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img', 'aria-label': spec.aria || 'bar chart', style: TXT + 'font-size:11px' });
  for (const v of yt.ticks) { root.append(svg('line', { x1: mL, x2: mL + pw, y1: sy(v), y2: sy(v), style: 'stroke:var(--grid)' })); root.append(svg('text', { x: mL - 8, y: sy(v) + 3.5, 'text-anchor': 'end', style: 'fill:var(--muted);font-variant-numeric:tabular-nums' }, (spec.yFmt || fmt.compact)(v))); }
  root.append(svg('line', { x1: mL, x2: mL + pw, y1: mT + ph, y2: mT + ph, style: 'stroke:var(--axis)' }));
  const tip = el('div', { class: 'tip', hidden: '' });
  cats.forEach((c, i) => {
    const cx = mL + band * (i + 0.5); const x = cx - bw / 2;
    const group = svg('g', { style: 'cursor:default' });
    if (c.stack) {
      let acc = 0;
      c.stack.forEach((seg, j) => { const y1 = sy(acc), y2 = sy(acc + seg.value); const h = Math.max(0, y1 - y2 - (j < c.stack.length - 1 ? 2 : 0)); group.append(svg('rect', { x, y: y2 + (j < c.stack.length - 1 ? 2 : 0), width: bw, height: h, rx: j === c.stack.length - 1 ? 3 : 0, style: 'fill:' + seg.color })); acc += seg.value; });
      c.value = acc;
    } else {
      const h = Math.max(0, mT + ph - sy(c.value));
      group.append(svg('path', { d: 'M' + x + ' ' + (mT + ph) + 'V' + (sy(c.value) + 3) + 'a3 3 0 0 1 3 -3h' + (bw - 6) + 'a3 3 0 0 1 3 3V' + (mT + ph) + 'Z', style: 'fill:' + (c.color || 'var(--s1)') + (h < 3 ? ';display:none' : '') }));
    }
    root.append(svg('text', { x: cx, y: sy(c.value) - 5, 'text-anchor': 'middle', style: 'fill:var(--ink);font-weight:600' }, (spec.valFmt || fmt.compact)(c.value)));
    if (c.note) root.append(svg('text', { x: cx, y: sy(c.value) - 18, 'text-anchor': 'middle', style: 'fill:' + (c.noteColor || 'var(--ink-2)') + ';font-size:10.5px' }, c.note));
    const lines = [].concat(c.label);
    lines.forEach((ln, li) => root.append(svg('text', { x: cx, y: mT + ph + 15 + li * 12, 'text-anchor': 'middle', style: 'fill:var(--ink-2);font-size:' + (lines.length > 1 ? 10.5 : 11) + 'px' }, ln)));
    group.append(svg('rect', { x: cx - band / 2, y: mT, width: band, height: ph, style: 'fill:transparent' }));
    group.addEventListener('pointerenter', () => {
      tip.innerHTML = ''; tip.append(el('div', { class: 'tt', text: lines.join(' ') }));
      if (c.stack) for (const seg of c.stack) { const row = el('div', { class: 'row' }); const k = el('span', { class: 'k' }); k.style.background = seg.color; const nm = el('span', { text: seg.name }); nm.prepend(k); row.append(nm, el('span', { class: 'v', text: (spec.valFmt || fmt.int)(seg.value) })); tip.append(row); }
      const row = el('div', { class: 'row' }); row.append(el('span', { text: spec.valueName || 'Value' }), el('span', { class: 'v', text: (spec.valFmt || fmt.int)(c.value) })); tip.append(row);
      if (c.tipNote) tip.append(el('div', { class: 'muted', text: c.tipNote }));
      tip.hidden = false; const cw = container.clientWidth || W; const left = cx / W * cw; tip.style.left = Math.min(left, cw - tip.offsetWidth - 4) + 'px'; tip.style.top = '4px';
    });
    group.addEventListener('pointerleave', () => { tip.hidden = true; });
    root.append(group);
  });
  container.append(root, tip);
  return { svg: root };
}

/** Stacked area for ordered categories (severity). */
function stackedArea(container, spec) {
  const layers = spec.layers; const n = spec.x.length; const cum = []; let prev = new Float64Array(n);
  for (const L of layers) { const next = new Float64Array(n); for (let k = 0; k < n; k++) next[k] = prev[k] + L.values[k]; cum.push({ lo: prev, hi: next }); prev = next; }
  const series = layers.map((L, j) => ({ name: L.name, color: L.color, values: cum[j].hi, width: 1, opacity: .9, bands: [{ lo: cum[j].lo, hi: cum[j].hi, opacity: 0.85 }], tipValues: L.values }));
  // tooltip should show the layer's own value, not the cumulative: wrap values
  const spec2 = Object.assign({}, spec, { series: series.map(s => Object.assign({}, s, { values: s.values })) });
  const out = lineChart(container, spec2);
  return out;
}

/** Tornado: horizontal swings around a base value. */
function tornado(container, spec) {
  container.innerHTML = '';
  const W = widthOf(container, spec.width); const rows = spec.rows; const rh = 26; const mT = 22, mB = 8, mL = 200, mR = 54; const H = mT + rows.length * rh + mB;
  const pw = W - mL - mR; const ext = Math.max(0.02, ...rows.map(r => Math.max(Math.abs(r.low), Math.abs(r.high)))); const sx = v => mL + pw / 2 + v / ext * (pw / 2);
  const root = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img', 'aria-label': 'sensitivity', style: TXT + 'font-size:11px' });
  for (const v of [-ext, -ext / 2, 0, ext / 2, ext]) { root.append(svg('line', { x1: sx(v), x2: sx(v), y1: mT - 4, y2: H - mB, style: 'stroke:var(--grid)' })); root.append(svg('text', { x: sx(v), y: 10, 'text-anchor': 'middle', style: 'fill:var(--muted)' }, fmt.signedPct(v))); }
  root.append(svg('line', { x1: sx(0), x2: sx(0), y1: mT - 4, y2: H - mB, style: 'stroke:var(--axis)' }));
  rows.forEach((r, i) => {
    const y = mT + i * rh + 4; const h = rh - 10;
    const lab = r.label.length > 36 ? r.label.slice(0, 34) + '…' : r.label;
    root.append(svg('text', { x: mL - 10, y: y + h / 2 + 4, 'text-anchor': 'end', style: 'fill:var(--ink-2)' }, lab));
    for (const [v, lbl] of [[r.low, r.lowLbl], [r.high, r.highLbl]]) {
      const x1 = Math.min(sx(0), sx(v)), w = Math.abs(sx(v) - sx(0));
      root.append(svg('rect', { x: x1, y, width: Math.max(w, 0.5), height: h, rx: 2, style: 'fill:' + (v < 0 ? 'var(--s3)' : 'var(--s2)') + ';fill-opacity:.85' }));
      root.append(svg('text', { x: v < 0 ? sx(v) - 4 : sx(v) + 4, y: y + h / 2 + 4, 'text-anchor': v < 0 ? 'end' : 'start', style: 'fill:var(--muted);font-size:10px' }, lbl + ' ' + fmt.signedPct(v, 1)));
    }
  });
  container.append(root);
  return { svg: root };
}

/** Legend row builder. items: [{name, color, kind:'line'|'dash'|'box'|'dot'}] */
function legend(items, toggles) {
  const L = el('div', { class: 'legend' });
  for (const it of items) { const k = el('span', { class: 'k ' + (it.kind || '') }); k.style.borderColor = it.color; if (it.kind === 'box' || it.kind === 'dot') k.style.background = it.color; if (it.kind === 'box' && it.opacity) k.style.opacity = it.opacity; L.append(el('span', { class: 'it' }, [k, el('span', { text: it.name })])); }
  for (const t of toggles || []) { const cb = el('input', { type: 'checkbox', id: t.id }); cb.checked = !!t.checked; cb.addEventListener('change', () => t.onChange(cb.checked)); L.append(el('label', { for: t.id }, [cb, el('span', { text: t.label })])); }
  return L;
}
/** Table view twin for a chart. columns: [{name, values, fmt}], xs: labels */
function tableView(xs, columns) {
  const wrap = el('div', { class: 'table-view' }); const t = el('table'); const thead = el('thead'); const tr = el('tr'); tr.append(el('th', { text: 'Period' }));
  for (const c of columns) tr.append(el('th', { text: c.name })); thead.append(tr); t.append(thead);
  const tb = el('tbody');
  xs.forEach((x, i) => { const r = el('tr'); r.append(el('td', { text: x })); for (const c of columns) { const v = c.values[i]; r.append(el('td', { text: v == null || !isFinite(v) ? '' : (c.fmt || fmt.int)(v) })); } tb.append(r); });
  t.append(tb); wrap.append(t); return wrap;
}
