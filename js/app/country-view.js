MSE.MAP_METRICS = {
  avertedPct: { label: 'Cases averted vs baseline (%)', fmt: v => fmt.pct(v, 1), fmtLong: v => fmt.pct(v, 1), diverging: false },
  averted: { label: 'Cases averted (number)', fmt: v => fmt.compact(v), fmtLong: v => fmt.int(v) },
  casesPer1000: { label: 'Cases 2027–horizon per 1,000 people', fmt: v => fmt.int(v), fmtLong: v => fmt.int(v) + ' per 1,000' },
  cpa: { label: 'Cost per case averted (illustrative)', fmt: v => v == null ? 'n/a' : v < 0 ? 'dominates' : fmt.moneyUnit(v), fmtLong: v => v == null ? 'no cases averted' : v < 0 ? 'averts cases and costs less' : fmt.moneyUnit(v) + ' per case averted' },
  prevEnd: { label: 'Share infected at the end of the horizon', fmt: v => fmt.pct(v, 1), fmtLong: v => fmt.pct(v, 1) },
};
state.map = { source: null, scope: 'irs_counties', uniform: false, metric: 'avertedPct' };

function strategyOf(s) { const i = s.inputs; return { product: i.product, campaignYear: i.campaignYear, interval: i.interval, irsMode: i.irsMode, irsCoverage: i.irsCoverage, irsMonth: i.irsMonth, horizon: i.horizon, access: i.access, usage: i.usage, pt: i.pt, cv: i.cv }; }
function strategyText(st, uniform) {
  const p = E.PRODUCTS[st.product];
  return p.short + ' nets from ' + st.campaignYear + ' every ' + st.interval + ' y · ' + (st.irsMode === 'maintain' ? 'IRS yearly at ' + fmt.pct(st.irsCoverage) : 'IRS stopped / none') + (uniform ? ' · access ' + fmt.pct(st.access) + ' × usage ' + fmt.pct(st.usage) + ' · p_t ' + fmt.pct(st.pt) + ' · c_v ' + fmt.pct(st.cv) + ' everywhere' : ' · each county\'s own coverage, treatment and vaccination levels') + ' · to ' + st.horizon;
}
/** Inputs for a county under a strategy. */
function countyInputsFor(c, st, opts) {
  const base = defaultInputs(c, { horizon: st.horizon });
  const i = Object.assign(base, { product: st.product, campaignYear: st.campaignYear, interval: st.interval, irsMonth: st.irsMonth, irsCoverage: st.irsCoverage });
  const irsApplies = st.irsMode === 'maintain' && (opts.scope === 'all' || c.irsHistory);
  i.irsMode = irsApplies ? 'maintain' : 'stop'; i.irsOn = irsApplies;
  if (opts.uniform) { i.access = st.access; i.usage = st.usage; i.pt = st.pt; i.cv = st.cv; }
  return i;
}
function countryRun(st, opts) {
  const key = JSON.stringify([st, opts, state.costs]); if (state.countryCache && state.countryCache.key === key) return state.countryCache.rows;
  const rows = [];
  for (const c of MSE.COUNTIES) {
    const inputs = countyInputsFor(c, st, opts); const bi = defaultInputs(c, { horizon: st.horizon }); bi.irsOn = false;
    const run = E.run(E.buildParams(c, inputs, null, null)); const base = E.run(E.buildParams(c, bi, null, null));
    const lo = 2027, hi = st.horizon + 1; const t = run.t;
    const cases = cumulative(run, t, 'treated', lo, hi), bcases = cumulative(base, t, 'treated', lo, hi);
    const kEnd = monthIndex(hi, t); let prevEnd = 0, bprev = 0; for (let k = kEnd - 12; k < kEnd; k++) { prevEnd += run.prev[k] / 12; bprev += base.prev[k] / 12; }
    const costs = costsFor(c, inputs, run, t, lo, hi), bcosts = costsFor(c, bi, base, t, lo, hi);
    const averted = bcases - cases;
    rows.push({ county: c, inputs, cases, bcases, averted, avertedPct: averted / bcases, casesPer1000: cases / c.population * 1000, prevEnd, bprev, costs, bcosts, cpa: averted > 0 ? (costs.total - bcosts.total) / averted : null, severe: cumulative(run, t, 'severe', lo, hi) });
  }
  state.countryCache = { key, rows }; return rows;
}
function rampColor(v, lo, hi) { const steps = ['var(--ramp1)', 'var(--ramp2)', 'var(--ramp3)', 'var(--ramp4)', 'var(--ramp5)']; if (!(hi > lo)) return steps[2]; const f = Math.max(0, Math.min(0.999, (v - lo) / (hi - lo))); return steps[Math.floor(f * steps.length)]; }
function mapMetricValue(r, metric) { return metric === 'cpa' ? (r.cpa == null ? null : r.cpa) : r[metric]; }

function mapSource() { const r = state.scenarios.filter(x => scenarioReady(x) && x.ran); const s = r.find(x => x.id === state.map.source) || (r.includes(active()) ? active() : r[0]) || null; state.map.source = s ? s.id : null; return s; }
function renderCountry() {
  const host = $('#country-root'); host.innerHTML = '';
  if (!state.hasRun || !mapSource()) { const ready = scenarioReady(active()); const card = el('section', { class: 'fig empty' }); card.append(el('h2', { text: 'Run a scenario first' }), el('p', { class: 'prose', style: 'margin-top:6px', text: 'The country view applies the strategy of a scenario you have run to every modelled county. ' + (ready ? 'Run the current choices now, or build more in Build & compare.' : 'In Build & compare, choose ' + missingChoices(active()).join(', ') + ', then run.') })); if (ready) { const b = el('button', { type: 'button', class: 'btn primary', style: 'margin-top:10px', text: '▶ Run the current choices and show the map' }); b.addEventListener('click', () => { state.hasRun = true; renderAll(); renderCountry(); }); card.append(b); } host.append(card); return; }
  const src = mapSource(); const st = strategyOf(src); const opts = { scope: state.map.scope, uniform: state.map.uniform };
  const rows = countryRun(st, opts); const M = MSE.MAP_METRICS[state.map.metric];
  // controls row
  const ctl = el('div', { class: 'map-controls' });
  const srcSel = el('select', { id: 'map-source', 'aria-label': 'Strategy to apply' });
  for (const s of state.scenarios.filter(x => scenarioReady(x) && x.ran)) { const o = el('option', { value: s.id, text: 'Strategy of scenario ' + s.id + ' · ' + scenarioName(s) }); if (s.id === src.id) o.selected = true; srcSel.append(o); }
  srcSel.addEventListener('change', () => { state.map.source = srcSel.value; renderCountry(); });
  const metSel = el('select', { id: 'map-metric', 'aria-label': 'Metric to colour' });
  for (const k in MSE.MAP_METRICS) { const o = el('option', { value: k, text: MSE.MAP_METRICS[k].label }); if (k === state.map.metric) o.selected = true; metSel.append(o); }
  metSel.addEventListener('change', () => { state.map.metric = metSel.value; renderCountry(); });
  const scopeSel = el('select', { id: 'map-scope', 'aria-label': 'Where the IRS policy applies' });
  for (const [k, lbl] of [['irs_counties', 'IRS policy applies where IRS is already used'], ['all', 'IRS policy applies to all modelled counties']]) { const o = el('option', { value: k, text: lbl }); if (k === state.map.scope) o.selected = true; scopeSel.append(o); }
  scopeSel.addEventListener('change', () => { state.map.scope = scopeSel.value; renderCountry(); });
  const uni = el('label', { class: 'toggle' }); const ucb = el('input', { type: 'checkbox', id: 'map-uniform' }); ucb.checked = state.map.uniform; ucb.addEventListener('change', () => { state.map.uniform = ucb.checked; renderCountry(); }); uni.append(ucb, el('span', { text: 'Apply the scenario\'s coverage, treatment and vaccination levels to every county' }));
  ctl.append(el('div', { class: 'field', style: 'margin:0;min-width:260px;flex:1 1 260px' }, [el('label', { for: 'map-source', text: 'Strategy' }), srcSel]), el('div', { class: 'field', style: 'margin:0;min-width:220px;flex:1 1 220px' }, [el('label', { for: 'map-metric', text: 'Colour counties by' }), metSel]), el('div', { class: 'field', style: 'margin:0;min-width:240px;flex:1 1 240px' }, [el('label', { for: 'map-scope', text: 'Spraying' }), scopeSel]), uni);
  host.append(ctl);
  // figure: map + side panel
  const sec = el('section', { class: 'fig', id: 'fig-map', style: 'margin-top:12px' });
  const head = el('div', { class: 'fig-head' });
  head.append(el('div', { class: 't' }, [el('h2', { text: M.label + ' · strategy of scenario ' + src.id })]));
  const acts = el('div', { class: 'fig-actions' }); const F = mapFigure(); const askBtn = el('button', { type: 'button', class: 'btn small primary', text: explainerAvailable() ? '✦ Ask about this map' : '✦ Explain this map' }); const tblBtn = el('button', { type: 'button', class: 'btn small', text: 'Table' });
  acts.append(askBtn, tblBtn, exportMenu(F, sec)); head.append(acts); sec.append(head);
  const body = el('div', { class: 'map-body' }); const mapEl = el('div', { class: 'chart map' }); const side = el('div', { class: 'aside' }); body.append(mapEl, side); sec.append(body);
  drawMap(mapEl, rows, st, src);
  // side: totals
  const T = rows.reduce((a, r) => ({ cases: a.cases + r.cases, bcases: a.bcases + r.bcases, averted: a.averted + r.averted, cost: a.cost + r.costs.total, bcost: a.bcost + r.bcosts.total, severe: a.severe + r.severe, pop: a.pop + r.county.population }), { cases: 0, bcases: 0, averted: 0, cost: 0, bcost: 0, severe: 0, pop: 0 });
  const cpaT = T.averted > 0 ? (T.cost - T.bcost) / T.averted : null;
  side.append(el('h3', { text: 'Across the eight modelled counties, 2027–' + st.horizon }));
  const dl = el('dl');
  for (const [k, v] of [['Population', fmt.compact(T.pop)], ['Outpatient-treated cases', fmt.int(T.cases)], ['Baseline cases', fmt.int(T.bcases)], (T.averted >= 0 ? ['Cases averted', fmt.int(T.averted) + ' (' + fmt.pct(T.averted / T.bcases, 1) + ')'] : ['More cases than baseline', fmt.int(-T.averted) + ' (' + fmt.pct(-T.averted / T.bcases, 1) + ')']), ['Severe episodes', fmt.int(T.severe)], ['Cost (illustrative)', fmt.money(T.cost) + ' vs baseline ' + fmt.money(T.bcost)], ['Cost per case averted', cpaT == null ? 'n/a' : cpaT < 0 ? 'dominates' : fmt.moneyUnit(cpaT)]]) dl.append(el('dt', { text: k }), el('dd', { text: v }));
  side.append(dl);
  const best = rows.slice().sort((a, b) => b.avertedPct - a.avertedPct);
  side.append(el('h3', { text: 'Largest and smallest relative reductions' }), el('p', { text: (() => { const rel = r => r.county.name + ' ' + (r.avertedPct >= 0 ? fmt.pct(r.avertedPct, 1) + ' averted' : fmt.pct(-r.avertedPct, 1) + ' more cases'); const w = best[best.length - 1]; if (best[0].avertedPct < 0) return 'Every county has more cases than its baseline, from ' + fmt.pct(-best[0].avertedPct, 1) + ' in ' + best[0].county.name + ' to ' + fmt.pct(-w.avertedPct, 1) + ' in ' + w.county.name + '. That happens where this strategy protects a county less than its current nets and coverage do.'; return rel(best[0]) + ' and ' + rel(best[1]) + ' at the top. ' + (w.avertedPct >= 0 ? rel(w) + ' at the bottom. The same strategy removes a smaller share where transmission is highest, while absolute numbers can still be large there.' : w.county.name + ' has ' + fmt.pct(-w.avertedPct, 1) + ' more cases than its baseline. That happens where this strategy protects a county less than its current nets and coverage do.'); })() }));
  const tbl = el('div', { hidden: '' }); sec.append(tbl);
  tblBtn.addEventListener('click', () => { if (tbl.hidden) { tbl.innerHTML = ''; const d = F.data(); tbl.append(tableView(d.xs, d.cols)); tbl.hidden = false; tblBtn.textContent = 'Hide table'; } else { tbl.hidden = true; tblBtn.textContent = 'Table'; } });
  const ex = buildExplainer(F, buildCtx(src)); ex.hidden = !state.explainerOpen.map; sec.append(ex);
  askBtn.addEventListener('click', () => { ex.hidden = !ex.hidden; state.explainerOpen.map = !ex.hidden; if (!ex.hidden) $('input', ex).focus(); });
  host.append(sec);
  // ranked bars
  const rank = el('section', { class: 'fig', style: 'margin-top:12px' });
  rank.append(el('div', { class: 'fig-head' }, el('div', { class: 't' }, [el('h2', { text: 'Counties ranked by ' + M.label.toLowerCase() })])));
  const bars = el('div', { class: 'chart', style: 'margin-top:8px' }); rank.append(bars); host.append(rank);
  const sorted = rows.slice().sort((a, b) => { const va = mapMetricValue(a, state.map.metric), vb = mapMetricValue(b, state.map.metric); return (vb == null ? -1e18 : vb) - (va == null ? -1e18 : va); });
  const vals = sorted.map(r => mapMetricValue(r, state.map.metric)).filter(v => v != null && v >= 0); const lo = Math.min(...vals), hi = Math.max(...vals);
  barChart(bars, { categories: sorted.map(r => { const v = mapMetricValue(r, state.map.metric); return { label: [r.county.name, r.county.group === 'itn' ? 'ITN only' : 'ITN + IRS'], value: v == null || v < 0 ? 0 : v, color: v == null || v < 0 ? 'var(--muted)' : rampColor(v, lo, hi), note: v == null ? 'no cases averted' : v < 0 ? (state.map.metric === 'cpa' ? 'dominates' : state.map.metric === 'avertedPct' ? fmt.pct(-v, 1) + ' more cases' : fmt.compact(-v) + ' more cases') : null, tipNote: 'cases ' + fmt.int(r.cases) + ' · baseline ' + fmt.int(r.bcases) + ' · ' + (r.avertedPct >= 0 ? 'averted ' + fmt.pct(r.avertedPct, 1) : fmt.pct(-r.avertedPct, 1) + ' more cases') }; }), height: 220, labelRows: true, noteRow: true, valFmt: v => (state.map.metric === 'cpa' ? fmt.moneyUnit(v) : state.map.metric === 'avertedPct' || state.map.metric === 'prevEnd' ? fmt.pct(v, 1) : fmt.compact(v)), yFmt: v => (state.map.metric === 'cpa' ? fmt.money(v) : state.map.metric === 'avertedPct' || state.map.metric === 'prevEnd' ? fmt.pct(v, 0) : fmt.compact(v)), valueName: M.label, aria: 'Counties ranked by ' + M.label });
}
/* Close-up of the modelled counties at their true shapes, with a small Kenya locator (18 Nov 2026).
   The frame is the bounding box of the modelled counties, so it widens as more counties get a fitted profile. */
function drawMap(mapEl, rows, st, src) {
  const box = MSE.MAP.box; const COL = 190, FH = 600; let FW = 600, W = COL + FW; const H = FH;
  const svgRoot = svg('svg', { role: 'img', 'aria-label': 'Map of the modelled counties coloured by the selected metric, with a locator map of Kenya', style: 'font-family:var(--font);font-size:15px' });
  const byName = {}; for (const r of rows) byName[r.county.name] = r;
  const metric = state.map.metric; const M = MSE.MAP_METRICS[metric];
  const vals = rows.map(r => mapMetricValue(r, metric)).filter(v => v != null && v >= 0); const lo = Math.min(...vals), hi = Math.max(...vals);
  const tip = el('div', { class: 'tip', hidden: '' });
  // extent of the modelled counties, padded and fitted to the frame's shape
  const ext = d => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; const n = d.match(/-?\d+(\.\d+)?/g) || []; for (let k = 0; k + 1 < n.length; k += 2) { const x = +n[k], y = +n[k + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return [x0, y0, x1, y1]; };
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (const c of MSE.MAP.counties) { if (!byName[c.name]) continue; const e = ext(c.d); bx0 = Math.min(bx0, e[0]); by0 = Math.min(by0, e[1]); bx1 = Math.max(bx1, e[2]); by1 = Math.max(by1, e[3]); }
  if (!isFinite(bx0)) { bx0 = 0; by0 = 0; bx1 = box[0]; by1 = box[1]; }
  const pad = 0.09 * Math.max(bx1 - bx0, by1 - by0); bx0 -= pad; by0 -= pad; bx1 += pad; by1 += pad;
  let vw = bx1 - bx0, vh = by1 - by0;
  FW = Math.round(Math.max(400, Math.min(600, FH * vw / vh))); W = COL + FW; // the frame takes the shape of the modelled area
  svgRoot.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svgRoot.setAttribute('width', W); svgRoot.setAttribute('height', H); svgRoot.style.maxWidth = Math.round(W * 1.15) + 'px';
  if (vw / vh < FW / FH) { const w = vh * FW / FH; bx0 -= (w - vw) / 2; vw = w; } else { const h = vw * FH / FW; by0 -= (h - vh) / 2; vh = h; }
  const k = FW / vw; const X = x => COL + (x - bx0) * k, Y = y => (y - by0) * k;
  // main frame
  const main = svg('svg', { x: COL, y: 0, width: FW, height: FH, viewBox: bx0 + ' ' + by0 + ' ' + vw + ' ' + vh });
  main.append(svg('rect', { x: bx0, y: by0, width: vw, height: vh, style: 'fill:var(--surface-2)' }));
  const modelled = [], context = [];
  // outline drawn over the county under the pointer. The other modelled counties fade while it shows
  const hiPath = svg('path', { d: '', 'vector-effect': 'non-scaling-stroke', style: 'fill:none;stroke:var(--ink);stroke-width:2.5;stroke-linejoin:round;pointer-events:none;visibility:hidden' });
  const grey = [], coloured = [];
  for (const c of MSE.MAP.counties) {
    const r = byName[c.name];
    const path = svg('path', { d: c.d, 'vector-effect': 'non-scaling-stroke', style: r ? 'fill:' + ((v => v == null || v < 0 ? 'var(--muted)' : rampColor(v, lo, hi))(mapMetricValue(r, metric))) + ';stroke:var(--surface);stroke-width:1.5;cursor:pointer' : 'fill:var(--surface-3);stroke:var(--axis);stroke-width:0.8' });
    const fill = () => {
      tip.innerHTML = ''; tip.append(el('div', { class: 'tt', text: c.name }));
      if (r) {
        tip.append(el('div', { class: 'tsub', text: r.county.group === 'itn' ? 'ITN only county' : 'ITN + IRS county' }));
        const g = el('dl');
        const mv = mapMetricValue(r, metric); const more = r.averted < 0; // a negative "averted" means more cases than the baseline, and is worded that way
        const rowsT = [more && metric === 'avertedPct' ? ['More cases than baseline (%)', fmt.pct(-mv, 1), true] : more && metric === 'averted' ? ['More cases than baseline (number)', fmt.int(-mv), true] : [M.label, M.fmtLong(mv), true], ['Cases 2027–' + st.horizon, fmt.int(r.cases)], ['Baseline cases', fmt.int(r.bcases)], more ? ['More cases than baseline', fmt.int(-r.averted) + ' (' + fmt.pct(-r.avertedPct, 1) + ')'] : ['Cases averted', fmt.int(r.averted) + ' (' + fmt.pct(r.avertedPct, 1) + ')'], ['Cost', fmt.money(r.costs.total)], ['IRS', r.inputs.irsOn ? 'yearly' : (r.county.irsHistory ? 'stopped' : 'none')]];
        for (const [kk, v, lead] of rowsT) g.append(el('dt', { class: lead ? 'lead' : '', text: kk }), el('dd', { class: lead ? 'lead' : '', text: v }));
        tip.append(g);
      } else tip.append(el('div', { class: 'tsub', text: 'Not modelled. No fitted profile for this county yet.' }));
      tip.hidden = false;
    };
    const place = ev => { const rect = mapEl.getBoundingClientRect(); const tw = tip.offsetWidth, th = tip.offsetHeight; let x = ev.clientX - rect.left + 16, y = ev.clientY - rect.top + 14; if (x + tw > rect.width - 4) x = ev.clientX - rect.left - tw - 16; if (y + th > rect.height - 4) y = ev.clientY - rect.top - th - 14; tip.style.left = Math.max(4, x) + 'px'; tip.style.top = Math.max(4, y) + 'px'; };
    const light = on => { if (!r) return; hiPath.setAttribute('d', on ? c.d : ''); hiPath.style.visibility = on ? 'visible' : 'hidden'; for (const q of coloured) q.style.opacity = on && q !== path ? '0.5' : '1'; };
    path.addEventListener('pointerenter', ev => { fill(); place(ev); light(true); });
    path.addEventListener('pointermove', place);
    path.addEventListener('pointerleave', () => { tip.hidden = true; light(false); });
    if (r) { path.addEventListener('focus', () => light(true)); path.addEventListener('blur', () => light(false)); }
    if (r) { path.addEventListener('click', () => openCountyInBuilder(r.county, r.inputs, src)); path.setAttribute('tabindex', '0'); path.setAttribute('role', 'button'); path.setAttribute('aria-label', c.name + ': ' + M.fmtLong(mapMetricValue(r, metric))); path.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openCountyInBuilder(r.county, r.inputs, src); } }); modelled.push({ c, r }); coloured.push(path); }
    else { grey.push(path); if (c.cx > bx0 + 0.06 * vw && c.cx < bx0 + 0.94 * vw && c.cy > by0 + 0.05 * vh && c.cy < by0 + 0.95 * vh) context.push(c); }
  }
  grey.forEach(p => main.append(p)); coloured.forEach(p => main.append(p)); // coloured on top so their outlines stay crisp
  main.append(hiPath);
  svgRoot.append(main);
  svgRoot.append(svg('rect', { x: COL + 0.5, y: 0.5, width: FW - 1, height: FH - 1, style: 'fill:none;stroke:var(--rule-strong);stroke-width:1' }));
  // labels in screen units: neighbours in muted text, modelled counties with name and value
  const halo = 'paint-order:stroke;stroke:var(--surface);stroke-width:3.5px;stroke-linejoin:round;pointer-events:none';
  for (const c of context) svgRoot.append(svg('text', { x: X(c.cx), y: Y(c.cy) + 4, 'text-anchor': 'middle', style: 'fill:var(--muted);font-size:11.5px;pointer-events:none' }, c.name));
  for (const m of modelled) { const v = mapMetricValue(m.r, metric); const x = X(m.c.cx), y = Y(m.c.cy);
    svgRoot.append(svg('text', { x, y: y - 2, 'text-anchor': 'middle', style: 'fill:var(--ink);font-weight:600;font-size:14px;' + halo }, m.c.name));
    svgRoot.append(svg('text', { x, y: y + 15, 'text-anchor': 'middle', style: 'fill:var(--ink);font-size:13px;' + halo }, (v < 0 && (metric === 'avertedPct' || metric === 'averted') ? M.fmt(-v) + ' more cases' : M.fmt(v) + (metric === 'avertedPct' ? ' averted' : ''))));
  }
  // locator: all of Kenya, the modelled counties filled, the close-up frame outlined
  const IW = 150, IH = IW * box[1] / box[0];
  svgRoot.append(svg('text', { x: 10, y: 16, style: 'fill:var(--muted);font-size:12px' }, 'Area shown'));
  const inset = svg('svg', { x: 10, y: 24, width: IW, height: IH, viewBox: '0 0 ' + box[0] + ' ' + box[1], 'aria-hidden': 'true' });
  for (const c of MSE.MAP.counties) inset.append(svg('path', { d: c.d, 'vector-effect': 'non-scaling-stroke', style: byName[c.name] ? 'fill:var(--ramp4);stroke:var(--ramp4);stroke-width:.4' : 'fill:var(--surface-3);stroke:var(--axis);stroke-width:.4' }));
  inset.append(svg('rect', { x: bx0, y: by0, width: vw, height: vh, 'vector-effect': 'non-scaling-stroke', style: 'fill:none;stroke:var(--ink);stroke-width:1.4' }));
  svgRoot.append(inset);
  // legend
  const lx = 10, ly = H - 70; const steps = ['var(--ramp1)', 'var(--ramp2)', 'var(--ramp3)', 'var(--ramp4)', 'var(--ramp5)'];
  steps.forEach((col, kk) => svgRoot.append(svg('rect', { x: lx + kk * 30, y: ly, width: 30, height: 12, style: 'fill:' + col })));
  svgRoot.append(svg('text', { x: lx, y: ly - 6, style: 'fill:var(--muted);font-size:12px' }, M.label.length > 28 ? M.label.slice(0, 26) + '…' : M.label));
  svgRoot.append(svg('text', { x: lx, y: ly + 26, style: 'fill:var(--ink-2);font-size:12px' }, isFinite(lo) ? M.fmt(lo) : ''));
  svgRoot.append(svg('text', { x: lx + 150, y: ly + 26, 'text-anchor': 'end', style: 'fill:var(--ink-2);font-size:12px' }, isFinite(hi) ? M.fmt(hi) : ''));
  svgRoot.append(svg('rect', { x: lx, y: ly + 34, width: 14, height: 12, style: 'fill:var(--surface-3);stroke:var(--axis);stroke-width:.6' }));
  svgRoot.append(svg('text', { x: lx + 18, y: ly + 44, style: 'fill:var(--muted);font-size:12px' }, 'not modelled'));
  if ((metric === 'avertedPct' || metric === 'averted') && rows.some(r => mapMetricValue(r, metric) < 0)) { svgRoot.append(svg('rect', { x: lx, y: ly + 52, width: 14, height: 12, style: 'fill:var(--muted)' })); svgRoot.append(svg('text', { x: lx + 18, y: ly + 62, style: 'fill:var(--muted);font-size:12px' }, 'more cases than baseline')); }
  svgRoot.append(svg('text', { x: W - 6, y: H - 8, 'text-anchor': 'end', style: 'fill:var(--muted);font-size:11px;' + halo }, 'Boundaries: geoBoundaries (CC BY 4.0), simplified'));
  mapEl.innerHTML = ''; mapEl.append(svgRoot, tip);
}
function openCountyInBuilder(c, inputs, src) {
  const id = nextScenarioId(); if (!id) return;
  const s = newScenario(id, Object.assign({}, inputs, { county: c.id })); s.shown = chartedScenarios().length < MSE.MAX_CHARTED; state.scenarios.push(s); state.activeId = id; state.hasRun = true;
  switchTab('build'); renderRail(); runAll(); window.scrollTo({ top: 0 });
}
function mapFigure() {
  const src = mapSource(); const st = strategyOf(src); const opts = { scope: state.map.scope, uniform: state.map.uniform }; const M = MSE.MAP_METRICS[state.map.metric];
  return {
    id: 'map', title: 'Country view · ' + M.label, unit: 'strategy of scenario ' + src.id + ' applied to the eight modelled counties · 2027–' + st.horizon, measures: 'Each fitted county run with the same strategy and compared with its own baseline. Counties without a fitted profile are shown grey.', questions: ['Why does the same strategy avert more in some counties?', 'What do the grey counties mean?', 'What do the totals include?'],
    data() { const rows = countryRun(st, opts); return mkData(rows.map(r => r.county.name), [{ name: 'Group', values: rows.map(r => r.county.group === 'itn' ? 1 : 2), fmt: v => v === 1 ? 'ITN only' : 'ITN + IRS' }, { name: 'Population', values: rows.map(r => r.county.population) }, { name: 'Cases 2027–' + st.horizon, values: rows.map(r => r.cases) }, { name: 'Baseline cases', values: rows.map(r => r.bcases) }, { name: 'Averted', values: rows.map(r => r.averted) }, { name: 'Averted %', values: rows.map(r => r.avertedPct), fmt: v => fmt.pct(v, 1) }, { name: 'Cases per 1,000', values: rows.map(r => r.casesPer1000), fmt: fmt.int }, { name: 'Severe', values: rows.map(r => r.severe) }, { name: 'Share infected end', values: rows.map(r => r.prevEnd), fmt: v => fmt.pct(v, 2) }, { name: 'Cost (' + state.currency + ')', values: rows.map(r => r.costs.total * MSE.CURRENCIES[state.currency].perUSD), fmt: fmt.int }, { name: 'Baseline cost', values: rows.map(r => r.bcosts.total * MSE.CURRENCIES[state.currency].perUSD), fmt: fmt.int }, { name: 'Cost per case averted', values: rows.map(r => r.cpa == null ? null : r.cpa * MSE.CURRENCIES[state.currency].perUSD), fmt: v => v.toFixed(1) }]); },
    context() { const rows = countryRun(st, opts); const C = MSE.CURRENCIES[state.currency]; return ['Tool: Malaria Scenario Explorer (prototype). Engine: stand-in with the structure of the CEMA county model. Illustrative county profiles. Not the fitted model, not a forecast.', 'Audience: ' + (state.view === 'normal' ? 'a programme user without modelling expertise' : state.view === 'student' ? 'a student learning malaria modelling' : 'a researcher who knows the model'), 'View: country map of Kenya with the eight fitted counties coloured by ' + M.label + '. The other 39 counties are not modelled. Strategy applied: ' + strategyText(st, opts.uniform) + '. IRS policy scope: ' + (opts.scope === 'all' ? 'all modelled counties' : 'only counties already using IRS') + '. Each county compared with its own baseline (PBO nets at current coverage, IRS stopped or none). Central runs, no uncertainty bands.', 'Per county (cases 2027–' + st.horizon + ', baseline, averted %, cost ' + state.currency + '): ' + rows.map(r => r.county.name + ' (' + (r.county.group === 'itn' ? 'ITN only' : 'ITN+IRS') + ', pop ' + fmt.compact(r.county.population) + '): ' + fmt.int(r.cases) + ', ' + fmt.int(r.bcases) + ', ' + fmt.pct(r.avertedPct, 1) + ', ' + fmt.int(r.costs.total * C.perUSD)).join(' · ') + '.', 'Assumptions and limits: deterministic extended SEIR per county. Seasonal force of infection. Mosquito population at equilibrium. No superinfection. Closed population. Vector control enters as λ × (1 − E_net·access·usage) × (1 − E_IRS·coverage). Product-specific net decay resetting at campaigns. IRS decaying within a year. County profiles illustrative. Costs from illustrative unit costs.']; },
    prepared(q) { const rows = countryRun(st, opts); const best = rows.slice().sort((a, b) => b.avertedPct - a.avertedPct);
      if (/avert more|some counties/i.test(q)) return 'Every county carries its own fitted transmission level and seasonality. Where transmission is lower (' + best[0].county.name + ', ' + fmt.pct(best[0].avertedPct, 1) + ' averted), the same protection pushes the force of infection close to the point where cases fall steeply. Where it is highest (' + best[best.length - 1].county.name + ', ' + fmt.pct(best[best.length - 1].avertedPct, 1) + '), infections saturate and the same protection removes a smaller share, even though absolute numbers can still be large. Coverage levels also differ by county unless you apply the scenario\'s levels everywhere.';
      if (/grey/i.test(q)) return 'Grey counties have no fitted profile in the model: the CEMA model was fitted to outpatient-treated cases for eight western counties, so the tool cannot simulate the others. Showing them grey keeps the tool\'s scope visible. Extending to a county means fitting its profile with the modelling team, not changing the interface.';
      if (/totals/i.test(q)) return 'The totals add the eight modelled counties only: cases and baseline cases over 2027–' + st.horizon + ', cases averted and their share, severe episodes, illustrative costs and the aggregate cost per case averted (total extra cost divided by total cases averted). They are not national figures: 39 counties are outside the model.';
      return null; },
  };
}
