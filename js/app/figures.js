function buildCtx(s) {
  const res = getResult(s); if (!res) throw new Error('Scenario ' + s.id + ' has no results yet'); const all = readyScenarios().filter(x => x.ran || x === s).map(x => ({ s: x, res: getResult(x) })).filter(o => o.res);
  return { s, res, all, county: county(s.inputs.county), inputs: engineInputs(s), advanced: cleanAdvanced(s.advanced), pins: cleanPins(s.pins), view: state.view };
}
function exportMenu(F, sec) {
  const wrap = el('div', { class: 'menu-wrap' });
  const btn = el('button', { type: 'button', class: 'btn small', text: 'Export ▾', 'aria-haspopup': 'true', 'aria-expanded': 'false' });
  const menu = el('div', { class: 'menu', role: 'menu', hidden: '' });
  const groups = [
    ['Image', [['PNG image', () => exportImage(sec, F, 'png')], ['JPEG image', () => exportImage(sec, F, 'jpeg')], ['SVG vector', () => exportSVG(sec, F)]]],
    ['Details', [['Metadata as JSON', () => exportMetadata(F)], ['Summary (Markdown)', () => exportSummary(sec, F)], ['Data as CSV', () => exportData(F)]]],
    ['Everything', [['ZIP bundle', () => exportBundle(sec, F)]]],
  ];
  for (const [g, items] of groups) { menu.append(el('div', { class: 'mg', text: g })); for (const [lbl, fn] of items) { const it = el('button', { type: 'button', role: 'menuitem', text: lbl }); it.addEventListener('click', () => { close(); fn(); }); menu.append(it); } }
  function close() { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); document.removeEventListener('click', onDoc, true); }
  function onDoc(ev) { if (!wrap.contains(ev.target)) close(); }
  btn.addEventListener('click', () => { if (menu.hidden) { menu.hidden = false; btn.setAttribute('aria-expanded', 'true'); setTimeout(() => document.addEventListener('click', onDoc, true), 0); } else close(); });
  wrap.addEventListener('keydown', ev => { if (ev.key === 'Escape') { close(); btn.focus(); } });
  wrap.append(btn, menu); return wrap;
}
function renderFigures() {
  const ctx = buildCtx(active()); const host = $('#figures');
  const keepOpen = Object.assign({}, state.explainerOpen); host.innerHTML = '';
  const visible = FIGS.filter(F => F.views.includes(state.view));
  const nav = el('nav', { class: 'subtabs', role: 'tablist', 'aria-label': 'Result sections' });
  for (const g of MSE.FIG_GROUPS) {
    const count = g.id === 'all' ? visible.length + state.asked.length : g.id === 'asked' ? state.asked.length : visible.filter(F => F.group === g.id).length; if (!count && g.id !== 'asked') continue;
    const b = el('button', { type: 'button', role: 'tab', 'aria-selected': String(state.figGroup === g.id), title: g.q }, [el('span', { text: g.label }), el('small', { text: String(count) })]);
    b.addEventListener('click', () => { state.figGroup = g.id; renderFigures(); }); nav.append(b);
  }
  host.append(nav);
  const g = MSE.FIG_GROUPS.find(x => x.id === state.figGroup) || MSE.FIG_GROUPS[0];
  host.append(el('p', { class: 'subtab-q', text: g.q }));
  if (state.figGroup === 'asked') { renderAskBox(host); renderAskedCharts(host, 0); return; }
  let n = 0;
  for (const F of visible) {
    if (state.figGroup !== 'all' && F.group !== state.figGroup) continue; n++;
    const sec = el('section', { class: 'fig', id: 'fig-' + F.id });
    const head = el('div', { class: 'fig-head' });
    head.append(el('div', { class: 't' }, [el('h2', { html: '<span class="muted" style="font-weight:400;margin-right:6px">' + n + '</span>' + F.title })]));
    const acts = el('div', { class: 'fig-actions' });
    const askBtn = el('button', { type: 'button', class: 'btn small primary', text: explainerAvailable() ? '✦ Ask about this chart' : '✦ Explain this chart' });
    const tblBtn = el('button', { type: 'button', class: 'btn small', text: 'Table' });
    acts.append(askBtn, tblBtn, exportMenu(F, sec)); head.append(acts); sec.append(head);
    const body = el('div', { class: 'fig-body' }); const chart = el('div', { class: 'chart' }); body.append(chart);
    const aside = F.aside ? F.aside(ctx) : null; if (aside) body.append(aside); else body.classList.add('noaside');
    sec.append(body); host.append(sec);
    try { F.render(chart, ctx); } catch (e) { chart.append(el('p', { class: 'small', text: 'Chart could not be drawn: ' + e.message })); console.error(e); }
    if (F.notes) { const nt = F.notes(ctx); if (nt && !(state.view === 'normal' && /^<b>(In the model|Reading):/.test(nt))) sec.append(el('p', { class: 'fig-notes', html: nt })); }
    const tbl = el('div', { hidden: '' }); sec.append(tbl);
    tblBtn.addEventListener('click', () => { if (tbl.hidden) { tbl.innerHTML = ''; const d = F.data(buildCtx(active())); tbl.append(tableView(d.xs, d.cols)); tbl.hidden = false; tblBtn.textContent = 'Hide table'; } else { tbl.hidden = true; tblBtn.textContent = 'Table'; } });
    const ex = buildExplainer(F, ctx); ex.hidden = !keepOpen[F.id]; sec.append(ex);
    askBtn.addEventListener('click', () => { ex.hidden = !ex.hidden; state.explainerOpen[F.id] = !ex.hidden; if (!ex.hidden) $('input', ex).focus(); });
  }
  if (state.figGroup === 'all') { renderAskBox(host); renderAskedCharts(host, n); }
}
