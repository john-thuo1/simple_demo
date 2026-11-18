function fieldRange(id, label, hint, get, set, opts) {
  const f = el('div', { class: 'field' });
  const lab = el('label', { for: 'in-' + id }, [el('span', { text: label }), el('span', { class: 'val', id: 'val-' + id })]);
  const inp = el('input', { type: 'range', id: 'in-' + id, min: opts.min, max: opts.max, step: opts.step });
  const upd = () => { $('#val-' + id, f).textContent = opts.fmt(+inp.value); };
  inp.value = get(); f.append(lab, inp); if (hint) { lab.title = hint; inp.title = hint; } upd(); // the description shows on hover, not under the slider
  inp.addEventListener('input', () => { upd(); set(+inp.value); inputsChanged(true); });
  inp.addEventListener('change', () => { set(+inp.value); if (!state.live) inputsChanged(false); });
  return f;
}
/* The only tag a panel heading carries: shown on the three choices that Run waits for, gone once the choice is made. */
function requiredTag(missing) { return missing ? el('span', { class: 'req', text: 'Required' }) : null; }
function fieldSelect(id, label, hint, options, get, set) {
  const f = el('div', { class: 'field' }); const sel = el('select', { id: 'in-' + id });
  for (const o of options) { const op = el('option', { value: o.value, text: o.label }); if (String(o.value) === String(get())) op.selected = true; sel.append(op); }
  sel.addEventListener('change', () => { set(sel.value); inputsChanged(false); });
  f.append(el('label', { for: 'in-' + id, text: label }), sel); if (hint) f.append(el('span', { class: 'hint', text: hint })); return f;
}
function fieldChoice(id, label, hint, options, get, set, cols) {
  const f = el('div', { class: 'field' }); f.append(el('span', { class: 'lbl', text: label }));
  const box = el('div', { class: 'choice', id: 'in-' + id }); if (cols === 1) box.style.gridTemplateColumns = '1fr';
  for (const o of options) { const b = el('button', { type: 'button', 'aria-pressed': String(o.value === get()) }, [document.createTextNode(o.label), o.sub ? el('small', { text: o.sub }) : null]); b.addEventListener('click', () => { set(o.value); $$('button', box).forEach(x => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); inputsChanged(false); }); box.append(b); }
  f.append(box); if (hint) f.append(el('span', { class: 'hint', text: hint })); return f;
}
function renderRail() {
  const s = active(); const i = s.inputs; const host = $('#rail-fields'); host.innerHTML = '';
  const pct = v => v + '%';
  // Step 1: county. Nothing else is shown until it is chosen.
  const p1 = el('div', { class: 'panel' }); p1.append(el('div', { class: 'panel-head' }, [el('h2', { text: '1 · Where' }), requiredTag(!i.county)]));
  const opts = [{ value: '', label: 'Choose a county…' }].concat(MSE.COUNTIES.map(x => ({ value: x.id, label: x.name + ' · ' + (x.group === 'itn' ? 'ITN only' : 'ITN + IRS') })));
  p1.append(fieldSelect('county', 'County', null, opts, () => i.county || '', v => {
    if (!v) { i.county = null; renderRail(); return; }
    const nc = county(v); const keepProduct = i.product, keepIrs = nc.irsHistory ? i.irsMode : (i.irsMode === 'maintain' ? 'maintain' : (i.irsMode === 'stop' ? 'stop' : null));
    Object.assign(i, defaultInputs(nc, { horizon: i.horizon }), { product: keepProduct, irsMode: keepIrs, irsOn: keepIrs === 'maintain', campaignYear: i.campaignYear, interval: i.interval });
    s.advanced = {}; syncCurrency(); renderRail(); refreshEmpty();
  }));
  host.append(p1);
  if (!i.county) { renderAdvanced(); renderPins(); updateRailState(); return; }
  const c = county(i.county);
  // Current situation: facts carried by the county profile (not choices)
  const p0 = el('div', { class: 'panel current' }); p0.append(el('div', { class: 'panel-head' }, [el('h2', { text: 'Current situation in ' + c.name })]));
  const dl = el('dl', { class: 'facts' });
  for (const [k, v] of [['Population', fmt.compact(c.population)], ['Nets in use', 'PBO (Olyset) since the 2024 campaign. Pyrethroid nets before'], ['Net coverage', 'access ' + fmt.pct(c.access) + ' · usage ' + fmt.pct(c.usage)], ['Spraying', c.irsHistory ? 'yearly rounds 2024–2026 at ' + fmt.pct(c.irsCoverageHist) + ' of households' : 'not used'], ['Treatment', fmt.pct(c.pt) + ' of uncomplicated cases treated'], ['Vaccination', fmt.pct(c.cv) + ' of under-fives per year'], ['Model fit', 'outpatient-treated cases 2017–2025']]) dl.append(el('dt', { text: k }), el('dd', { text: v }));
  p0.append(dl);
  host.append(p0);
  // Step 2: decisions. No default choice.
  const p2 = el('div', { class: 'panel' }); p2.append(el('div', { class: 'panel-head' }, [el('h2', { text: '2 · Nets' }), requiredTag(!i.product)]));
  p2.append(fieldChoice('product', 'Net product for the ' + i.campaignYear + ' campaign', null, MSE.PRODUCT_ORDER.map(pid => ({ value: pid, label: E.PRODUCTS[pid].short, sub: E.PRODUCTS[pid].note })), () => i.product, v => { i.product = v; renderRail(); refreshEmpty(); }));
  p2.append(fieldRange('access', 'Net access', 'Share of people with a net. Now ' + fmt.pct(c.access) + '.', () => Math.round(i.access * 100), v => { i.access = v / 100; }, { min: 0, max: 100, step: 1, fmt: pct }));
  p2.append(fieldRange('usage', 'Net usage', 'Share of those with a net who sleep under it. Now ' + fmt.pct(c.usage) + '.', () => Math.round(i.usage * 100), v => { i.usage = v / 100; }, { min: 0, max: 100, step: 1, fmt: pct }));
  const row = el('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:8px' });
  row.append(fieldSelect('campaignYear', 'Next campaign', null, [2027, 2028, 2029].map(y => ({ value: y, label: String(y) })), () => i.campaignYear, v => { i.campaignYear = +v; }));
  row.append(fieldSelect('interval', 'Then every', null, [2, 3, 4].map(y => ({ value: y, label: y + ' years' })), () => i.interval, v => { i.interval = +v; }));
  p2.append(row); host.append(p2);
  const p3 = el('div', { class: 'panel' }); p3.append(el('div', { class: 'panel-head' }, [el('h2', { text: '3 · Spraying' }), requiredTag(!i.irsMode)]));
  p3.append(fieldChoice('irsMode', 'Decision on indoor residual spraying from 2027', null, [{ value: 'stop', label: c.irsHistory ? 'Stop after 2026' : 'Keep none', sub: c.irsHistory ? 'the current plan' : 'the current situation' }, { value: 'maintain', label: c.irsHistory ? 'Maintain yearly' : 'Introduce yearly', sub: 'one round per year' }], () => i.irsMode, v => { i.irsMode = v; i.irsOn = v === 'maintain'; renderRail(); refreshEmpty(); }));
  if (i.irsMode === 'maintain') {
    p3.append(fieldRange('irsCoverage', 'IRS coverage', 'Households sprayed per round' + (c.irsHistory ? '. Recently ' + fmt.pct(c.irsCoverageHist) : '') + '.', () => Math.round(i.irsCoverage * 100), v => { i.irsCoverage = v / 100; }, { min: 0, max: 100, step: 1, fmt: pct }));
    p3.append(fieldSelect('irsMonth', 'Spray month', null, MSE.MONTHS.map((m, k) => ({ value: k, label: m })), () => i.irsMonth, v => { i.irsMonth = +v; }));
  }
  host.append(p3);
  const p4 = el('div', { class: 'panel' }); p4.append(el('div', { class: 'panel-head' }, [el('h2', { text: '4 · Treatment and vaccination' })]));
  p4.append(fieldRange('pt', 'Treatment coverage' + (state.view === 'normal' ? '' : ' (p_t)'), 'Uncomplicated cases treated. Now ' + fmt.pct(c.pt) + '.', () => Math.round(i.pt * 100), v => { i.pt = v / 100; }, { min: 0, max: 100, step: 1, fmt: pct }));
  p4.append(fieldRange('cv', 'Vaccination coverage of under-fives' + (state.view === 'normal' ? '' : ' (c_v)'), 'Under-fives vaccinated per year. Now ' + fmt.pct(c.cv) + '.', () => Math.round(i.cv * 100), v => { i.cv = v / 100; }, { min: 0, max: 100, step: 1, fmt: pct }));
  host.append(p4);
  const p5 = el('div', { class: 'panel' }); p5.append(el('div', { class: 'panel-head' }, [el('h2', { text: '5 · Horizon' })]));
  p5.append(fieldSelect('horizon', 'Simulate to', null, [2030, 2032, 2035].map(y => ({ value: y, label: 'to ' + y })), () => i.horizon, v => { i.horizon = +v; }));
  host.append(p5);
  renderAdvanced(); renderPins(); updateRailState();
}
function updateRailState() {
  renderStartOver($('#startover-slot'), canStartOver(), startOver);
  const s = active(); const ready = scenarioReady(s); const runBtn = $('#btn-run');
  if (runBtn) { // three states: first run, changes waiting, nothing to do. Re-running unchanged inputs gives the same result, so there is no "Run again".
    const pending = state.dirty && !autoApplies(); const done = ready && s.ran && !pending;
    runBtn.disabled = !ready || done; runBtn.classList.toggle('done', done); runBtn.title = !ready ? 'Choose ' + missingChoices(s).join(', ') + ' first' : done ? 'The results match the inputs' : '';
    runBtn.textContent = !s.ran ? '▶ Run scenario' : pending ? '▶ Apply changes' : '✓ Up to date'; }
  const hint = $('#run-hint'); if (hint) { hint.hidden = ready && s.ran; hint.textContent = !ready ? 'To run, choose ' + missingChoices(s).join(', ') + '.' : 'Press Run to see this scenario. After that, changes ' + (autoApplies() ? 'apply automatically.' : 'wait for Apply changes.'); }
  const lu = $('#live-update'); if (lu) { lu.checked = state.live; const sp = lu.parentElement ? lu.parentElement.querySelector('span') : null; if (sp) sp.textContent = state.routerAssumedMs > state.routerThresholdMs ? 'Update automatically (paused: live runs are slow)' : 'Update automatically after the first run'; }
  $('#rail-state').textContent = ''; // the heading carries no status: each unset choice is tagged Required on its own panel
  if (!ready) return;
  const c = county(s.inputs.county); const d = defaultInputs(c, { horizon: s.inputs.horizon, product: s.inputs.product });
  let n = 0; for (const k of ['access', 'usage', 'campaignYear', 'interval', 'irsMode', 'irsCoverage', 'irsMonth', 'pt', 'cv']) if (s.inputs[k] !== d[k] && !(k === 'irsCoverage' && s.inputs.irsMode !== 'maintain') && !(k === 'irsMonth' && s.inputs.irsMode !== 'maintain')) n++;
  if (s.inputs.product !== 'pbo') n++;
  const adv = Object.keys(cleanAdvanced(s.advanced)).length, pins = Object.keys(cleanPins(s.pins)).length;
}
function renderAdvanced() {
  const s = active(); const host = $('#adv-fields'); host.innerHTML = ''; if (!s.inputs.county) { host.append(el('p', { class: 'hint', text: 'Choose a county first. The fitted values belong to it.' })); return; } const c = county(s.inputs.county);
  for (const f of MSE.ADV_FIELDS) {
    const d = f.def(c); const v = s.advanced[f.id];
    const row = el('div', { class: 'adv-row' + (v != null && v !== d ? ' changed' : '') });
    row.append(el('span', { class: 'name', html: '<b>' + f.sym + '</b> ' + f.label + ' <span class="muted">' + f.unit + '</span>' }));
    const inp = el('input', { type: 'number', id: 'adv-' + f.id, step: f.step, min: f.min, max: f.max, value: v != null ? v : +d.toFixed(4), 'aria-label': f.label });
    inp.addEventListener('change', () => { const x = parseFloat(inp.value); s.advanced[f.id] = Number.isNaN(x) ? null : x; row.classList.toggle('changed', x !== d); inputsChanged(false); });
    const rs = el('button', { type: 'button', class: 'reset', title: 'Reset to fitted value', 'aria-label': 'Reset ' + f.label, text: '↺' });
    rs.addEventListener('click', () => { s.advanced[f.id] = null; inp.value = +d.toFixed(4); row.classList.remove('changed'); inputsChanged(false); });
    row.append(inp, rs); host.append(row);
  }
}
function renderPins() {
  const s = active(); const host = $('#pin-fields'); host.innerHTML = '';
  for (const f of MSE.PIN_FIELDS) {
    const pinned = s.pins[f.id] != null; const row = el('div', { class: 'pin-row' });
    const cb = el('input', { type: 'checkbox', id: 'pin-' + f.id, 'aria-label': 'Pin ' + f.label }); cb.checked = pinned;
    const num = el('input', { type: 'number', id: 'pinv-' + f.id, step: f.step, min: f.range[0], max: f.range[1], value: pinned ? (f.days ? Math.round(1 / s.pins[f.id]) : s.pins[f.id]) : f.def, 'aria-label': f.label + ' pinned value' }); num.disabled = !pinned;
    const apply = () => { const x = parseFloat(num.value); s.pins[f.id] = cb.checked && !Number.isNaN(x) ? (f.days ? 1 / x : x) : null; num.disabled = !cb.checked; inputsChanged(false); };
    cb.addEventListener('change', apply); num.addEventListener('change', apply);
    row.append(cb, el('label', { for: 'pin-' + f.id, class: 'name', html: f.label + '<br><span class="range">varied ' + (f.days ? f.range[0] + '–' + f.range[1] + ' days' : f.range[0].toFixed(2) + '–' + f.range[1].toFixed(2)) + '</span>' }), num);
    host.append(row);
  }
}
function refreshEmpty() { const a = active(); if (!a.ran) renderAll(); }
function autoApplies() { return state.live && !(state.routerAssumedMs > state.routerThresholdMs && !onGrid(active())); }
function inputsChanged(live) {
  const s = active();
  if (!scenarioReady(s) || !s.ran) { updateRailState(); return; }               // the first run of a scenario is always explicit
  if (autoApplies()) { state.dirty = false; updateRailState(); if (live) scheduleRun(); else runAll(); }
  else { state.dirty = true; updateRailState(); const st = $('#stale'); st.hidden = false; st.innerHTML = 'Inputs changed since the last run' + (state.live ? ' (a live run would take ' + fmt.ms(state.routerAssumedMs) + ', so changes wait for you)' : '') + '. Press <b>Apply changes</b> to update the results.'; $('#main').classList.add('stale-results'); }
}
function renderEmptyState() {
  const main = $('#main'); main.classList.remove('stale-results');
  for (const id of ['scn-chips', 'kpis', 'cmp-wrap']) $('#' + id).innerHTML = '';
  if (state.scenarios.some(x => x.ran && x !== active())) renderStrip(); else $('#scn-strip').innerHTML = '';
  $('#scn-name').value = ''; $('#scn-name').placeholder = ''; $('.scn-head').hidden = true; $('#scn-id').innerHTML = ''; $('#headline').textContent = ''; $('#stale').hidden = true; $('#btn-export-json').disabled = true; $('#btn-export-csv').disabled = true;
  const host = $('#figures'); host.innerHTML = '';
  const card = el('section', { class: 'fig empty' });
  card.append(el('h2', { text: state.scenarios.some(x => x.ran && x !== active()) ? 'Scenario ' + active().id + ' has not been run yet' : 'Start with a scenario or a question' }));
  card.append(el('p', { class: 'prose', style: 'margin-top:6px', text: 'Set the inputs on the left and press Run, load the team\'s strategy set, or ask a question below.' }));
  const row = el('div', { class: 'run-row', style: 'margin-top:10px' });
  const a = active(); const ready = scenarioReady(a);
  const preset = el('button', { type: 'button', class: 'btn', text: a.inputs.county ? 'Load the team\'s strategy set for ' + county(a.inputs.county).name : 'Load the team\'s strategy set' }); preset.disabled = !a.inputs.county; if (!a.inputs.county) preset.title = 'Choose a county first'; preset.addEventListener('click', () => { state.hasRun = true; loadPresets(); });
  row.append(preset); card.append(row); host.append(card);
  renderAskBox(host);
}
const scheduleRun = debounce(() => runAll(), 140);
