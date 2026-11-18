/* ===================== scenarios strip, header, KPIs, comparison ===================== */
/* "Start over" lives in the Scenario inputs panel, beside the control that resets one scenario.
   It is greyed out while there is nothing to clear, and asks once, in place, before discarding anything. */
function renderStartOver(slot, canClear, onYes) {
  if (!slot) return; const row = slot.parentElement;
  const idle = () => { slot.innerHTML = ''; row.classList.remove('confirming'); const b = el('button', { type: 'button', class: 'linkbtn', text: 'Start over', title: canClear ? 'Remove every scenario and every chart made from a question' : 'Nothing to clear yet' }); b.disabled = !canClear; b.addEventListener('click', confirmStep); slot.append(b); };
  const confirmStep = () => { slot.innerHTML = ''; row.classList.add('confirming'); const yes = el('button', { type: 'button', class: 'linkbtn danger', text: 'Yes', 'aria-label': 'Yes, start over' }); const no = el('button', { type: 'button', class: 'linkbtn', text: 'Cancel' }); yes.addEventListener('click', () => { row.classList.remove('confirming'); onYes(); }); no.addEventListener('click', idle); slot.append(el('span', { class: 'q', text: 'Remove everything?' }), yes, no); yes.focus(); };
  idle();
}
function canStartOver() { return state.hasRun || state.scenarios.length > 1 || state.asked.length > 0 || !!active().inputs.county; }
function startOver() {
  state.scenarios = [blankScenario('A')]; state.activeId = 'A'; state.referenceId = 'A'; state.hasRun = false; state.dirty = false;
  state.asked = []; state.askStatus = ''; state.askPrecheck = null; state.figGroup = 'results'; state.explainerOpen = {}; if (state.map) state.map.source = null;
  renderRail(); renderAll(); window.scrollTo({ top: 0 });
}
function renderStrip() {
  const host = $('#scn-strip'); host.innerHTML = '';
  const charted = chartedScenarios();
  for (const s of state.scenarios) {
    const chip = el('button', { type: 'button', class: 'scn-chip' + (charted.includes(s) ? '' : ' off'), 'aria-pressed': String(s.id === state.activeId), title: scenarioName(s) });
    const dot = el('span', { class: 'dot' }); dot.style.background = scenarioColor(s); if (!charted.includes(s)) dot.style.opacity = .35;
    chip.append(dot, el('span', { text: s.id + (s.id === state.referenceId && scenarioReady(s) ? ' · reference' : '') + (!scenarioReady(s) ? ' · pending' : (s.ran ? '' : ' · not run')) }));
    if (state.scenarios.length > 1) { const x = el('span', { class: 'x', text: '×', title: 'Remove scenario ' + s.id, role: 'button', tabindex: 0 }); x.addEventListener('click', ev => { ev.stopPropagation(); removeScenario(s.id); }); chip.append(x); }
    chip.addEventListener('click', () => { state.activeId = s.id; renderRail(); renderAll(); });
    host.append(chip);
  }
  const add = el('button', { type: 'button', class: 'btn small', text: '+ Add scenario (copy of ' + state.activeId + ')' }); add.disabled = !nextScenarioId(); add.addEventListener('click', addScenario); host.append(add);
  const preset = el('button', { type: 'button', class: 'btn small quiet', text: 'Load the team\'s strategy set for this county' }); preset.disabled = !active().inputs.county; preset.addEventListener('click', loadPresets); host.append(preset);
  if (state.scenarios.length > 1) {
    const refSel = el('select', { id: 'ref-select', 'aria-label': 'Reference scenario for comparisons', class: 'small' });
    for (const s of readyScenarios()) { const o = el('option', { value: s.id, text: 'Compare against ' + s.id }); if (s.id === state.referenceId) o.selected = true; refSel.append(o); }
    refSel.addEventListener('change', () => { state.referenceId = refSel.value; renderAll(); }); host.append(refSel);
  }
  if (state.scenarios.length > MSE.MAX_CHARTED || state.scenarios.some(x => !x.shown)) {
    host.append(el('span', { class: 'small muted', text: 'Charts overlay up to ' + MSE.MAX_CHARTED + ' scenarios (' + charted.length + ' shown). The table compares all ' + state.scenarios.length + '. Use "Show on charts" in the header to choose.' }));
  }
}
function addScenario() { const id = nextScenarioId(); if (!id) return; const a = active(); const s = newScenario(id, clone(a.inputs)); s.advanced = clone(a.advanced); s.pins = clone(a.pins); s.shown = chartedScenarios().length < MSE.MAX_CHARTED; state.scenarios.push(s); state.activeId = id; renderRail(); runAll(); }
function removeScenario(id) { state.scenarios = state.scenarios.filter(s => s.id !== id); if (state.activeId === id) state.activeId = state.scenarios[0].id; if (!state.scenarios.find(s => s.id === state.referenceId)) state.referenceId = state.scenarios[0].id; renderRail(); runAll(); }
function loadPresets() {
  const a = active(); if (!a.inputs.county) return; const c = county(a.inputs.county); const set = MSE.PRESETS[c.group];
  state.scenarios = set.map((p, k) => newScenario('ABCDEFGH'[k], defaultInputs(c, { product: p.product, irsMode: p.irsMode, horizon: a.inputs.horizon }), p.label));
  state.activeId = 'B'; state.referenceId = 'A'; state.hasRun = true; renderRail(); runAll();
}
function renderHeader(ctx) {
  const s = ctx.s, r = ctx.res; $('.scn-head').hidden = false; $('#btn-export-json').disabled = false; $('#btn-export-csv').disabled = false; const nameInp = $('#scn-name'); nameInp.value = scenarioName(s); nameInp.placeholder = scenarioName(Object.assign({}, s, { name: '' }));
  nameInp.onchange = () => { s.name = nameInp.value.trim(); renderStrip(); renderComparison(); renderHeader(buildCtx(active())); };
  const idh = $('#scn-id'); idh.innerHTML = '';
  // how a result was computed (cache, grid, live run, timing, draws, seed) is the analysis layer's business and is not shown
  if (state.view !== 'normal') idh.append(el('span', { class: 'mono', text: r.scenario_id }));
  if (s.preset) idh.append(el('span', { class: 'chip', text: presetMatches(s) ? 'Team strategy set: ' + s.preset : 'Started from team set "' + s.preset + '", now changed' }));
  const show = el('label', { class: 'toggle' }); const cb = el('input', { type: 'checkbox', id: 'show-on-charts' }); cb.checked = !!s.shown; cb.addEventListener('change', () => { s.shown = cb.checked; renderAll(); }); show.append(cb, el('span', { text: 'Show on charts' })); idh.append(show);
  const chips = $('#scn-chips'); chips.innerHTML = '';
  for (const [k, v] of setList(ctx)) chips.append(el('span', { class: 'chip', html: '<b>' + k + '</b> ' + v }));
  for (const [k, v] of advList(ctx)) chips.append(el('span', { class: 'chip', html: '<b>' + k + '</b> ' + v }));
}
function kpi(label, value, range, delta, deltaClass, barFrac) {
  const k = el('div', { class: 'kpi' }); k.append(el('div', { class: 'label', text: label }), el('div', { class: 'value', text: value }));
  if (range) k.append(el('div', { class: 'range', text: range })); if (delta) k.append(el('div', { class: 'delta ' + (deltaClass || ''), text: delta }));
  if (barFrac) { const b = el('div', { class: 'bar' }); const fill = el('i'); fill.style.left = Math.max(0, Math.min(100, barFrac[0] * 100)) + '%'; fill.style.width = Math.max(0, Math.min(100, (barFrac[1] - barFrac[0]) * 100)) + '%'; const m = el('b'); m.style.left = Math.max(0, Math.min(100, barFrac[2] * 100)) + '%'; b.append(fill, m); k.append(b); }
  return k;
}
function renderKPIs(ctx) {
  const S = ctx.res.summary, h = ctx.inputs.horizon; const host = $('#kpis'); host.innerHTML = '';
  const bc = S.baseCases.median;
  host.append(kpi('Outpatient-treated cases, 2027–' + h, fmt.compact(S.cases.median), '90% range ' + fmt.compact(S.cases.q05) + ' – ' + fmt.compact(S.cases.q95), 'baseline ' + fmt.compact(bc), null, [S.cases.q05 / (bc * 1.3), S.cases.q95 / (bc * 1.3), S.cases.median / (bc * 1.3)]));
  host.append(S.averted.median < 0 ? kpi('More cases than baseline', fmt.compact(-S.averted.median), '90% range ' + fmt.compact(-S.averted.q95) + ' – ' + fmt.compact(-S.averted.q05), fmt.signedPct(-S.avertedPct.median, 1) + ' cases', 'bad', null) : kpi('Cases averted vs baseline', fmt.compact(S.averted.median), '90% range ' + fmt.compact(S.averted.q05) + ' – ' + fmt.compact(S.averted.q95), fmt.signedPct(-S.avertedPct.median, 1) + ' cases', S.avertedPct.median > 0 ? 'good' : 'bad', [Math.max(0, S.avertedPct.q05), Math.max(0, S.avertedPct.q95), Math.max(0, S.avertedPct.median)]));
  host.append(kpi('Peak month', fmt.compact(S.peak.value), fmt.ym(S.peak.t), 'highest monthly cases, 2024–' + h, null, null));
  host.append(kpi('Share infected in ' + h, fmt.pct(S.prevEnd, 1), 'baseline ' + fmt.pct(S.bprevEnd, 1), 'mean over the year, all infections', null, null));
  host.append(kpi('Cost 2027–' + h + ' (illustrative)', fmt.money(S.costs.total), 'baseline ' + fmt.money(S.bcosts.total) + ' · ' + state.currency, S.costPerAverted == null ? 'no cases averted' : S.costPerAverted < 0 ? 'averts cases and costs less' : fmt.moneyUnit(S.costPerAverted) + ' per case averted', null, null));
}
function renderComparison() {
  const host = $('#cmp-wrap'); host.innerHTML = '';
  const all = readyScenarios().filter(x => x.ran).map(s => ({ s, res: getResult(s) })).filter(o => o.res); if (all.length < 2) return;
  const ref = all.find(o => o.s.id === state.referenceId) || all[0];
  const wrap = el('div', { class: 'table-wrap' }); const t = el('table', { class: 'cmp' });
  t.append(el('thead', null, el('tr', null, [el('th', { text: 'Scenario' }), el('th', { text: 'What differs from ' + ref.s.id }), el('th', { class: 'num', text: 'Cases 2027–horizon' }), el('th', { class: 'num', text: 'Averted vs baseline' }), el('th', { class: 'num', text: 'Peak month' }), el('th', { class: 'num', text: 'Infected at end' }), el('th', { class: 'num', text: 'Cost (' + state.currency + ', illustrative)' }), el('th', { class: 'num', text: 'Cost per case averted' })])));
  const tb = el('tbody');
  for (const o of all) {
    const S = o.res.summary; const tr = el('tr'); if (o.s.id === state.activeId) tr.classList.add('active');
    const sw = el('span', { class: 'sw' }); sw.style.background = scenarioColor(o.s); if (!chartedScenarios().includes(o.s)) sw.style.opacity = .35;
    const nameTd = el('td'); nameTd.append(sw, document.createTextNode(o.s.id + ' · ' + scenarioName(o.s))); { const sub = [state.view === 'normal' ? '' : o.res.scenario_id, chartedScenarios().includes(o.s) ? '' : 'table only'].filter(Boolean).join(' · '); if (sub) nameTd.append(el('small', { text: sub })); }
    const diffs = differences(o.s, ref.s);
    tr.append(nameTd, el('td', { text: o === ref ? 'Reference' : (diffs.length ? diffs.join(' · ') : 'Identical inputs') }));
    const c1 = el('td', { class: 'num', text: fmt.int(S.cases.median) }); c1.append(el('small', { text: fmt.int(S.cases.q05) + ' to ' + fmt.int(S.cases.q95) })); tr.append(c1);
    const c2 = el('td', { class: 'num', text: fmt.int(S.averted.median) + ' (' + fmt.pct(S.avertedPct.median, 1) + ')' }); c2.append(el('small', { text: fmt.pct(S.avertedPct.q05, 1) + ' to ' + fmt.pct(S.avertedPct.q95, 1) })); tr.append(c2);
    const c3 = el('td', { class: 'num', text: fmt.int(S.peak.value) }); c3.append(el('small', { text: fmt.ym(S.peak.t) })); tr.append(c3);
    tr.append(el('td', { class: 'num', text: fmt.pct(S.prevEnd, 1) }));
    const c5 = el('td', { class: 'num', text: fmt.money(S.costs.total) }); c5.append(el('small', { text: 'baseline ' + fmt.money(S.bcosts.total) })); tr.append(c5);
    tr.append(el('td', { class: 'num', text: S.costPerAverted == null ? 'n/a' : S.costPerAverted < 0 ? 'dominates' : fmt.moneyUnit(S.costPerAverted) }));
    tb.append(tr);
  }
  t.append(tb); wrap.append(t); host.append(wrap);
}
