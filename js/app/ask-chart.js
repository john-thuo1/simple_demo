MSE.GRAMMAR = {
  measures: {
    treated:   { label: 'outpatient-treated cases', unit: 'cases', kind: 'flow', words: ['treated', 'cases', 'case', 'outpatient', 'clinic'] },
    uncomp:    { label: 'uncomplicated episodes', unit: 'episodes', kind: 'flow', words: ['uncomplicated'] },
    severe:    { label: 'severe episodes', unit: 'episodes', kind: 'flow', words: ['severe', 'hospital'] },
    asym:      { label: 'asymptomatic infections', unit: 'infections', kind: 'flow', words: ['asymptomatic', 'carriers'] },
    infections:{ label: 'new infections', unit: 'infections', kind: 'flow', words: ['infections', 'infection', 'incidence'] },
    prev:      { label: 'share of the population infected', unit: 'share', kind: 'share', words: ['prevalence', 'infected', 'share infected', 'parasite'] },
    itnProt:   { label: 'net protection (efficacy × access × usage)', unit: 'protection', kind: 'share', words: ['net protection', 'net efficacy', 'nets', 'itn', 'bed net', 'protection'] },
    irsProt:   { label: 'IRS protection (efficacy × coverage)', unit: 'protection', kind: 'share', words: ['irs', 'spray', 'spraying'] },
    cost:      { label: 'cost (illustrative)', unit: 'money', kind: 'cost', words: ['cost', 'costs', 'money', 'budget', 'ksh', 'usd', 'spend', 'expensive', 'cheap'] },
  },
  transforms: ['monthly', 'cumulative', 'per1000', 'diff_baseline', 'pct_baseline'],
  groups: ['scenario', 'county', 'severity', 'year'],
  forms: ['line', 'bars'],
};
state.asked = []; state.askedSeq = 0;
const NOT_IN_MODEL = [['death', 'deaths', 'mortality', 'die', 'dalys', 'daly'], ['resistance', 'insecticide resistance'], ['age', 'children', 'under-five', 'under five', 'adults'], ['rainfall', 'temperature', 'climate', 'weather'], ['anaemia', 'anemia', 'hospitalisation', 'hospitalization', 'admissions'], ['mosquito density', 'mosquitoes', 'vector density']];
const NOT_IN_MODEL_WHY = ['The model has no mortality: deaths and DALYs are not among its outputs.', 'Insecticide resistance is not a variable. It is implied by each product\'s efficacy curve.', 'The model is not age-structured beyond the vaccinated under-five class, so age breakdowns are not available.', 'Climate enters only through the fitted seasonal curve seas(t). There is no rainfall or temperature input.', 'Admissions and anaemia are not modelled. Severe episodes (I_sev) are the closest output.', 'The mosquito population is at equilibrium. Only the human-side force of infection is simulated.'];

/** Rule-based composer (used when no language model is connected). Returns a spec or {error}. */
function parseQuestion(q) {
  const t = ' ' + q.toLowerCase().replace(/(\d),(\d{3})/g, '$1$2').replace(/[?!.,;:]/g, ' ').replace(/\s+/g, ' ') + ' ';
  for (let k = 0; k < NOT_IN_MODEL.length; k++) if (NOT_IN_MODEL[k].some(w => t.includes(' ' + w + ' ') || t.includes(' ' + w + 's '))) return { error: NOT_IN_MODEL_WHY[k] };
  const spec = { question: q, measure: null, transform: 'monthly', by: 'scenario', form: null, window: null, scenarios: null, counties: null, bands: true };
  // measure
  const order = ['cost', 'irsProt', 'itnProt', 'severe', 'uncomp', 'asym', 'infections', 'prev', 'treated'];
  for (const m of order) { const M = MSE.GRAMMAR.measures[m]; if (M.words.some(w => t.includes(' ' + w + ' '))) { spec.measure = m; break; } }
  if ((spec.measure === 'irsProt' || spec.measure === 'itnProt') && !/(protection|efficacy|protect)/.test(t)) spec.measure = 'treated'; // "with IRS" is about cases, not the protection curve
  if (/(averted|avoided|prevented|saved|reduction|reduce|fewer|difference|vs baseline|versus baseline|against baseline|compared (with|to) (the )?baseline)/.test(t)) { if (!spec.measure || spec.measure === 'cost') spec.measure = spec.measure || 'treated'; spec.transform = /(percent|per cent|%|share|relative)/.test(t) ? 'pct_baseline' : 'diff_baseline'; }
  if (!spec.measure && /severity/.test(t)) spec.measure = 'treated';
  if (!spec.measure) return { error: null, unknown: true };
  if (/(per 1 ?000|per thousand|per capita|per person|per head)/.test(t)) spec.transform = 'per1000';
  if (/(cumulative|in total|total|sum|overall|altogether|how many)/.test(t) && spec.transform === 'monthly') spec.transform = 'cumulative';
  // grouping
  const named = MSE.COUNTIES.filter(c => t.includes(' ' + c.name.toLowerCase() + ' '));
  if (/(by county|across counties|per county|each county|all counties|counties|county level|which county|county has|map)/.test(t) || named.length >= 2) { spec.by = 'county'; spec.counties = named.length ? named.map(c => c.id) : MSE.COUNTIES.map(c => c.id); }
  else if (named.length === 1) spec.county = named[0].id;
  if (/(by severity|severity|severe and uncomplicated|breakdown)/.test(t) && spec.measure === 'treated') { spec.by = 'severity'; spec.measure = 'treated'; }
  if (/(per year|each year|by year|yearly|annual|annually)/.test(t)) spec.by = 'year';
  const letters = Array.from(t.matchAll(/scenario(?:s)? ([a-z](?:\s*(?:,|and|vs|versus|against|&)\s*[a-z])*)/g)).flatMap(m => m[1].split(/[^a-z]+/).filter(Boolean));
  const single = Array.from(t.matchAll(/\b([a-z])\b(?= (and|vs|versus|against|&) )/g)).map(m => m[1]).concat(Array.from(t.matchAll(/(?:and|vs|versus|against|&) ([a-z])\b/g)).map(m => m[1]));
  const ids = Array.from(new Set(letters.concat(single).map(x => x.toUpperCase()))).filter(id => state.scenarios.find(s => s.id === id));
  if (ids.length) spec.scenarios = ids;
  // window
  const years = Array.from(t.matchAll(/\b(20[2-3]\d)\b/g)).map(m => +m[1]);
  const h = active().inputs.horizon;
  if (years.length >= 2) spec.window = [Math.min(...years), Math.min(h, Math.max(...years))];
  else if (years.length === 1) { if (/\b(after|from|since)\b/.test(t)) spec.window = [years[0], h]; else if (/\b(before|until|up to|to)\b/.test(t)) spec.window = [2024, years[0]]; else spec.window = [years[0], years[0]]; }
  // form
  if (/(over time|trend|trajectory|monthly|month|curve|time series|evolve|change over)/.test(t)) spec.form = 'line';
  if (/(compare|comparison|which|bar|total|how many|rank|highest|lowest|most|least)/.test(t) && !/(over time|trend|trajectory)/.test(t)) spec.form = 'bars';
  if (spec.by === 'year' || spec.measure === 'cost') spec.form = 'bars';
  if (spec.by === 'county' && !spec.form) spec.form = 'bars';
  if (!spec.form) spec.form = (spec.transform === 'cumulative' || spec.transform === 'pct_baseline') ? 'bars' : 'line';
  if (spec.form === 'bars' && spec.transform === 'monthly' && MSE.GRAMMAR.measures[spec.measure].kind === 'flow') spec.transform = 'cumulative';
  if (spec.form === 'line' && spec.transform === 'cumulative') spec.transform = 'cumulative';
  return spec;
}

/* ---- What-if extraction: the question may define scenarios that do not exist yet.
   The composer may only set user-facing inputs (and, in researcher view, advanced parameters) — the same form a person fills. ---- */
const PRODUCT_WORDS = { pyrethroid: ['pyrethroid-only', 'pyrethroid only', 'standard net', 'pyrethroid net', 'pyrethroid'], pbo: ['pbo', 'olyset'], ig2: ['interceptor g2', 'interceptor', 'ig2', 'g2'], royalguard: ['royal guard', 'royalguard'], tsaraboost: ['tsara boost', 'tsara', 'tsaraboost'] };
const ADV_WORDS = { eps: ['vaccine efficacy', 'vaccine effectiveness'], m: ['mosquito density', 'mosquito-to-human ratio', 'vector density'], mu_m: ['mosquito mortality', 'mosquito lifespan', 'mosquito survival'], alpha: ['seasonal amplitude', 'seasonality strength'], zeta_a: ['asymptomatic infectiousness'] };
function pctNear(t, words) { // first percentage that appears within a few words of any of the words, before or after
  for (const w of words) { const re = new RegExp('(?:(\\d{1,3})\\s?%\\s+(?:\\w+\\s+){0,2}' + w + '|' + w + '\\s+(?:\\w+\\s+){0,3}?(?:of|at|to|=|is|about|around)?\\s*(\\d{1,3})\\s?%)'); const m = t.match(re); if (m) { const v = +(m[1] || m[2]); if (v >= 0 && v <= 100) return v / 100; } }
  return null;
}
function parseWhatIf(t, spec) {
  const base = {}; const found = [];
  const prods = []; for (const pid in PRODUCT_WORDS) if (PRODUCT_WORDS[pid].some(w => t.includes(' ' + w + ' ') || t.includes(' ' + w + 's '))) prods.push(pid);
  if (/\bdual\b/.test(t) && !prods.length) prods.push('ig2');
  if (prods.length === 1) { base.product = prods[0]; found.push('nets ' + E.PRODUCTS[prods[0]].short); }
  const usage = pctNear(t, ['usage', 'use', 'used', 'sleep under', 'net coverage', 'coverage']); if (usage != null && !/irs coverage|spray(?:ing)? coverage|treatment|vaccin/.test(t)) { base.usage = usage; found.push('usage ' + fmt.pct(usage)); }
  const access = pctNear(t, ['access']); if (access != null) { base.access = access; found.push('access ' + fmt.pct(access)); }
  const irsCov = pctNear(t, ['irs coverage', 'spraying coverage', 'spray coverage', 'households sprayed', 'irs at', 'irs']); if (irsCov != null) { base.irsCoverage = irsCov; base.irsMode = 'maintain'; found.push('IRS yearly at ' + fmt.pct(irsCov)); }
  const pt = pctNear(t, ['treatment coverage', 'treatment', 'treated', 'p_t']); if (pt != null) { base.pt = pt; found.push('treatment ' + fmt.pct(pt)); }
  const cv = pctNear(t, ['vaccination coverage', 'vaccination', 'vaccinated', 'vaccine coverage', 'c_v']); if (cv != null) { base.cv = cv; found.push('vaccination ' + fmt.pct(cv)); }
  if (/(with irs|irs maintained|maintain(?:ing)? irs|keep(?:ing)? irs|continue(?:s|d)? irs|spray(?:ing)? every year|yearly spraying|annual spraying|introduce irs|with spraying|add irs)/.test(t) && base.irsMode == null) { base.irsMode = 'maintain'; found.push('IRS yearly'); }
  if (/(without irs|no irs|stop(?:ping|ped)? irs|irs stopped|irs stops|without spraying|no spraying|end irs)/.test(t)) { base.irsMode = 'stop'; found.push('IRS stopped'); }
  const cy = t.match(/campaign\D{0,14}?(202[7-9])/); if (cy) { base.campaignYear = +cy[1]; found.push('campaign ' + cy[1]); }
  const iv = t.match(/every (\d) years?/); if (iv) { base.interval = +iv[1]; found.push('every ' + iv[1] + ' y'); }
  const hz = t.match(/\b(?:to|until|till|through|up to) (203[0-5])\b/); if (hz && /(horizon|run|simulate|project|until|through|up to)/.test(t) && !spec.window) { base.horizon = +hz[1]; found.push('to ' + hz[1]); }
  // advanced parameters: allowed only in researcher view
  const adv = {}; const advFound = [];
  for (const k in ADV_WORDS) { const w = ADV_WORDS[k].find(x => t.includes(' ' + x + ' ')); if (w) { const v = pctNear(t, [w]); const num = t.match(new RegExp(w + '\\s+(?:of|at|to|=|is)?\\s*(\\d+(?:\\.\\d+)?)')); const val = v != null && (k === 'eps' || k === 'alpha') ? v : (num ? +num[1] : null); if (val != null) { adv[k] = val; advFound.push(MSE.ADV_FIELDS.find(f => f.id === k).sym + ' = ' + val); } } }
  // variants: several products, with-and-without IRS, or two coverage values
  let variants = [];
  if (prods.length >= 2) variants = prods.map(pid => ({ product: pid, label: E.PRODUCTS[pid].short }));
  else if (/(with and without|with or without|with vs without|versus without)/.test(t) && /(irs|spray)/.test(t)) variants = [{ irsMode: 'maintain', label: 'IRS yearly' }, { irsMode: 'stop', label: 'IRS stopped' }];
  else { const two = t.match(/(\d{1,3})\s?% (?:vs|versus|against|and|or|to) (\d{1,3})\s?%/); if (two && (base.usage != null || /usage|use|coverage/.test(t))) { variants = [+two[1], +two[2]].map(v => ({ usage: v / 100, label: 'usage ' + v + '%' })); delete base.usage; } }
  // county for the what-if: one county named and no "by county" grouping
  let countyId = spec.county || null; const named = MSE.COUNTIES.filter(c => t.includes(' ' + c.name.toLowerCase() + ' '));
  if (named.length === 1 && spec.by !== 'county') countyId = named[0].id;
  if (named.length === 1 && spec.by === 'county' && (Object.keys(base).length || variants.length)) { countyId = named[0].id; spec.by = 'scenario'; spec.counties = null; }
  const any = Object.keys(base).length || variants.length || countyId || Object.keys(adv).length;
  return { any, base, variants, countyId, adv, found, advFound };
}
function sanitizeOverrides(o) { // whitelist and clamp what a composer (rules or a language model) may set
  const out = {}; if (!o || typeof o !== 'object') return out;
  if (o.product && E.PRODUCTS[o.product] && !E.PRODUCTS[o.product].hidden) out.product = o.product;
  for (const k of ['access', 'usage', 'irsCoverage', 'pt', 'cv']) if (o[k] != null && isFinite(+o[k])) out[k] = Math.max(0, Math.min(1, +o[k] > 1 ? +o[k] / 100 : +o[k]));
  if (o.irsMode === 'maintain' || o.irsMode === 'stop') out.irsMode = o.irsMode;
  if (o.irsMonth != null && isFinite(+o.irsMonth)) out.irsMonth = Math.max(0, Math.min(11, Math.round(+o.irsMonth)));
  if (o.campaignYear != null && [2027, 2028, 2029].includes(+o.campaignYear)) out.campaignYear = +o.campaignYear;
  if (o.interval != null && [2, 3, 4].includes(+o.interval)) out.interval = +o.interval;
  if (o.horizon != null && [2030, 2032, 2035].includes(+o.horizon)) out.horizon = +o.horizon;
  if (o.county && county(o.county)) out.county = o.county;
  return out;
}
function sanitizeAdvanced(o) { const out = {}; if (!o || typeof o !== 'object') return out; for (const f of MSE.ADV_FIELDS) if (o[f.id] != null && isFinite(+o[f.id])) out[f.id] = Math.max(f.min, Math.min(f.max, +o[f.id])); return out; }
/** Create the scenarios a question needs. Returns ids, or {error}. */
function materialiseScenarios(wi, q) {
  if (Object.keys(wi.adv).length && state.view !== 'researcher') return { error: 'That question changes an advanced parameter (' + wi.advFound.join(', ') + '), which only the researcher view may set. Switch view, or ask with user-facing inputs (nets, coverage, spraying, treatment, vaccination).' };
  const src = active(); const cid = wi.countyId || wi.base.county || src.inputs.county;
  if (!cid) return { error: 'Which county? Name one in the question (' + MSE.COUNTIES.map(c => c.name).join(', ') + ') or choose it on the left.' };
  const c = county(cid);
  const sets = wi.variants.length ? wi.variants.map(v => Object.assign({}, wi.base, v)) : [wi.base];
  const ids = []; const made = []; const filled = [];
  for (const o of sets) {
    const id = nextScenarioId(); if (!id) break;
    const inputs = defaultInputs(c, { horizon: src.inputs.horizon || 2032 });
    if (src.inputs.county === c.id) for (const k in src.inputs) if (src.inputs[k] != null) inputs[k] = src.inputs[k];
    const ov = sanitizeOverrides(o); delete ov.county; Object.assign(inputs, ov);
    if (!ov.product && !src.inputs.product) filled.push('PBO nets (current product)'); if (!ov.irsMode && !src.inputs.irsMode) filled.push(c.irsHistory ? 'spraying stopped (current plan)' : 'no spraying (current)');
    inputs.product = inputs.product || 'pbo'; inputs.irsMode = inputs.irsMode || 'stop'; inputs.irsOn = inputs.irsMode === 'maintain';
    const s = newScenario(id, inputs); s.advanced = Object.assign({}, src.advanced, sanitizeAdvanced(wi.adv)); s.pins = clone(src.pins); s.fromQuestion = q; s.shown = chartedScenarios().length < MSE.MAX_CHARTED;
    state.scenarios.push(s); ids.push(id); made.push(id + ' = ' + scenarioName(s) + (o.label ? ' (' + o.label + ')' : ''));
  }
  if (filled.length) made.push('unstated choices taken from the county\'s current situation: ' + Array.from(new Set(filled)).join(', '));
  return { ids, made, county: c };
}

function specTitle(spec) {
  const M = MSE.GRAMMAR.measures[spec.measure]; const tr = { monthly: M.kind === 'flow' ? 'per month' : 'monthly mean', cumulative: 'cumulative', per1000: 'per 1,000 people', diff_baseline: spec.measure === 'cost' ? 'extra vs baseline' : 'averted vs baseline', pct_baseline: '% change vs baseline' }[spec.transform];
  const by = spec.by === 'scenario' ? 'by scenario' : spec.by === 'county' ? 'by county' : spec.by === 'severity' ? 'by severity' : 'by year';
  return M.label.charAt(0).toUpperCase() + M.label.slice(1) + ' ' + tr + ', ' + by + (spec.window ? ', ' + (spec.window[0] === spec.window[1] ? spec.window[0] : spec.window[0] + '–' + spec.window[1]) : '');
}
function specWords(spec) {
  const M = MSE.GRAMMAR.measures[spec.measure];
  return 'measure: ' + M.label + ' · transform: ' + spec.transform.replace('_', ' ') + ' · grouped by: ' + spec.by + (spec.scenarios ? ' (' + spec.scenarios.join(', ') + ')' : '') + (spec.counties ? ' (' + spec.counties.length + ' counties)' : '') + ' · form: ' + spec.form + ' · window: ' + (spec.window ? spec.window.join('–') : 'default');
}
/* ---- data assembly ---- */
function seriesFor(run, key) { return run[key]; }
function countyStrategyRun(c, src) { if (!scenarioReady(src)) src = readyScenarios()[0]; const st = strategyOf(src); const opts = { scope: state.map.scope, uniform: state.map.uniform }; const inputs = countyInputsFor(c, st, opts); const bi = defaultInputs(c, { horizon: st.horizon }); bi.irsOn = false; const key = JSON.stringify([c.id, inputs, state.costs]); state.askCache = state.askCache || new Map(); if (state.askCache.has(key)) return state.askCache.get(key); const v = { run: E.run(E.buildParams(c, inputs, null, null)), base: E.run(E.buildParams(c, bi, null, null)), inputs, county: c }; state.askCache.set(key, v); return v; }
function windowOf(spec, h) { return spec.window ? [spec.window[0], spec.window[1] + 1] : (spec.form === 'bars' || spec.transform !== 'monthly' ? [2027, h + 1] : [2024, h + 1]); }
function entities(spec) {
  const src = active();
  if (spec.by === 'county') {
    const list = (spec.counties || MSE.COUNTIES.map(c => c.id)).map(id => county(id)).filter(Boolean);
    if (!readyScenarios().length) return [];
    return list.map((c, k) => { const r = countyStrategyRun(c, src); return { label: c.name, color: MSE.SLOT_COLORS[k % 8], t: r.run.t, run: r.run, base: r.base, pop: c.population, isActive: c.id === src.inputs.county, bandsFrom: null }; });
  }
  const list = (spec.scenarios ? spec.scenarios.map(id => state.scenarios.find(s => s.id === id)).filter(s => s && scenarioReady(s)) : chartedScenarios());
  return list.map(s => { const r = getResult(s); return { label: 'Scenario ' + s.id, color: scenarioColor(s), t: r.t, run: r.sim.central, median: r.sim.series, base: r.base.central, baseMedian: r.base.series, pop: county(s.inputs.county).population, isActive: s.id === state.activeId, s }; });
}
function valuesFor(ent, spec, key, which) {
  // which: 'median' | 'q05' | 'q95' | 'central'
  const useSeries = ent.median && ent.median[key] && which !== 'central'; const base = ent.baseMedian && ent.baseMedian[key] ? ent.baseMedian[key].median : (ent.base ? ent.base[key] : null);
  let v = useSeries ? ent.median[key][which] : ent.run[key]; if (!v) return null;
  v = Array.from(v);
  if (spec.transform === 'diff_baseline' && base) v = v.map((x, k) => base[k] - x);
  if (spec.transform === 'pct_baseline' && base) v = v.map((x, k) => base[k] > 0 ? (base[k] - x) / base[k] : 0);
  if (spec.transform === 'per1000') v = v.map(x => x / ent.pop * 1000);
  return v;
}
function composeChart(container, spec) {
  const M = MSE.GRAMMAR.measures[spec.measure]; const h = active().inputs.horizon; const [lo, hi] = windowOf(spec, h);
  if (spec.measure === 'cost') return composeCostChart(container, spec, lo, hi);
  if (spec.by === 'severity') return composeSeverity(container, spec, lo, hi);
  const ents = entities(spec); if (!ents.length) { container.textContent = 'No scenario or county matched.'; return null; }
  const isShare = M.kind === 'share'; const fmtY = spec.transform === 'pct_baseline' || isShare ? (v => fmt.pct(v, 1)) : fmt.compact;
  const tipFmt = spec.transform === 'pct_baseline' || isShare ? (v => fmt.pct(v, 1)) : fmt.int;
  if (spec.form === 'line' || spec.by === 'year') {
    if (spec.by === 'year') {
      const ent = ents.find(e => e.isActive) || ents[0]; const t = ent.t; const vals = valuesFor(ent, spec, spec.measure, ent.median ? 'median' : 'central'); const cats = [];
      for (let y = lo; y < hi; y++) { let s = 0, n = 0; for (let k = 0; k < t.length; k++) if (t[k] >= y - 1e-9 && t[k] < y + 1 - 1e-9) { s += vals[k]; n++; } cats.push({ label: String(y), value: isShare || spec.transform === 'pct_baseline' ? s / Math.max(1, n) : s, color: ent.color }); }
      barChart(container, { categories: cats, height: 220, valFmt: isShare || spec.transform === 'pct_baseline' ? tipFmt : fmt.compact, yFmt: fmtY, valueName: M.label, aria: specTitle(spec) });
      container.append(legend([{ name: ent.label, color: ent.color, kind: 'box' }])); return { table: () => mkData(cats.map(c => c.label), [{ name: M.label, values: cats.map(c => c.value), fmt: tipFmt }]) };
    }
    const series = []; const t = ents[0].t;
    for (const e of ents) { let v = valuesFor(e, spec, spec.measure, e.median ? 'median' : 'central'); if (!v) continue; if (spec.transform === 'cumulative') { let acc = 0; v = v.map((x, k) => { if (t[k] >= lo - 1e-9 && t[k] < hi - 1e-9) { acc += x; return acc; } return null; }); }
      const bands = (spec.bands && e.isActive && e.median && spec.transform !== 'cumulative') ? [{ lo: valuesFor(e, spec, spec.measure, 'q05'), hi: valuesFor(e, spec, spec.measure, 'q95'), opacity: 0.12 }] : null;
      if (bands && spec.transform === 'diff_baseline') { const a = bands[0].lo, b = bands[0].hi; bands[0].lo = a.map((x, k) => Math.min(x, b[k])); bands[0].hi = a.map((x, k) => Math.max(x, b[k])); }
      series.push({ name: e.label, color: e.color, values: v, width: e.isActive ? 2.2 : 1.6, bands, endLabel: e.label.replace('Scenario ', '') }); }
    lineChart(container, { x: t, xDomain: [lo, hi], series, height: 230, endLabels: ents.length > 1, yFmt: fmtY, tipFmt, markers: [{ x: active().inputs.campaignYear, label: 'Next campaign' }], yMin: spec.transform === 'diff_baseline' ? undefined : 0, aria: specTitle(spec) });
    container.append(legend(series.map(s => ({ name: s.name, color: s.color, kind: 'line' }))));
    const idx = monthsLabels(t, lo, hi);
    return { table: () => mkData(idx.map(k => fmt.ym(t[k])), series.map(s => ({ name: s.name, values: sliceIdx(s.values, idx), fmt: tipFmt }))) };
  }
  // bars: aggregate over the window per entity
  const cats = ents.map(e => { const t = e.t; const v = valuesFor(e, spec, spec.measure, e.median ? 'median' : 'central'); let s = 0, n = 0; for (let k = 0; k < t.length; k++) if (t[k] >= lo - 1e-9 && t[k] < hi - 1e-9) { s += v[k]; n++; } const val = (isShare || spec.transform === 'pct_baseline') ? s / Math.max(1, n) : s; return { label: e.label, value: val, color: spec.by === 'county' ? 'var(--s1)' : e.color }; });
  barChart(container, { categories: cats, height: 230, valFmt: isShare || spec.transform === 'pct_baseline' ? tipFmt : fmt.compact, yFmt: fmtY, valueName: M.label, aria: specTitle(spec) });
  return { table: () => mkData(cats.map(c => c.label), [{ name: M.label, values: cats.map(c => c.value), fmt: tipFmt }]) };
}
function composeSeverity(container, spec, lo, hi) {
  const r = getResult(active()); const t = r.t; const S = r.sim.series; const untreated = S.uncomp.median.map((v, k) => Math.max(0, v - S.treated.median[k]));
  if (spec.form === 'line') { stackedArea(container, { x: t, xDomain: [lo, hi], height: 220, layers: [{ name: 'Severe', color: 'var(--seq4)', values: S.severe.median }, { name: 'Uncomplicated, treated', color: 'var(--seq3)', values: S.treated.median }, { name: 'Uncomplicated, not treated', color: 'var(--seq2)', values: untreated }], aria: specTitle(spec) }); container.append(legend([{ name: 'Severe', color: 'var(--seq4)', kind: 'box' }, { name: 'Uncomplicated, treated', color: 'var(--seq3)', kind: 'box' }, { name: 'Uncomplicated, not treated', color: 'var(--seq2)', kind: 'box' }])); const idx = monthsLabels(t, lo, hi); return { table: () => mkData(idx.map(k => fmt.ym(t[k])), [{ name: 'Severe', values: sliceIdx(S.severe.median, idx) }, { name: 'Treated', values: sliceIdx(S.treated.median, idx) }, { name: 'Untreated', values: sliceIdx(untreated, idx) }]) }; }
  const sum = a => { let s = 0; for (let k = 0; k < t.length; k++) if (t[k] >= lo - 1e-9 && t[k] < hi - 1e-9) s += a[k]; return s; };
  const cats = [{ label: 'Severe', value: sum(S.severe.median), color: 'var(--seq4)' }, { label: ['Uncomplicated', 'treated'], value: sum(S.treated.median), color: 'var(--seq3)' }, { label: ['Uncomplicated', 'not treated'], value: sum(untreated), color: 'var(--seq2)' }, { label: 'Asymptomatic', value: sum(S.asym.median), color: 'var(--seq1)' }];
  barChart(container, { categories: cats, height: 230, labelRows: true, valueName: 'Episodes', aria: specTitle(spec) });
  return { table: () => mkData(cats.map(c => [].concat(c.label).join(' ')), [{ name: 'Episodes', values: cats.map(c => c.value) }]) };
}
function composeCostChart(container, spec, lo, hi) {
  const ents = spec.by === 'county' ? entities(spec).map(e => ({ label: e.label, color: e.color, c: county(MSE.COUNTIES.find(x => x.name === e.label).id), run: e.run, base: e.base, inputs: countyStrategyRun(county(MSE.COUNTIES.find(x => x.name === e.label).id), active()).inputs })) : (spec.scenarios ? spec.scenarios.map(id => state.scenarios.find(s => s.id === id)).filter(s => s && scenarioReady(s)) : chartedScenarios()).map(s => { const r = getResult(s); return { label: 'Scenario ' + s.id, color: scenarioColor(s), c: county(s.inputs.county), run: r.sim.central, base: r.base.central, inputs: engineInputs(s) }; });
  const C = MSE.CURRENCIES[state.currency];
  const cats = ents.map(e => { const cs = costsFor(e.c, e.inputs, e.run, e.run.t, lo, hi); const bs = costsFor(e.c, Object.assign(defaultInputs(e.c, { horizon: hi - 1 }), { irsOn: false }), e.base, e.base.t, lo, hi); const v = spec.transform === 'diff_baseline' ? cs.total - bs.total : cs.total; return { label: e.label, value: v * C.perUSD, color: e.color, tipNote: 'baseline ' + fmt.money(bs.total) }; });
  barChart(container, { categories: cats, height: 230, valFmt: v => C.symbol + ' ' + fmt.compact(v), yFmt: v => C.symbol + ' ' + fmt.compact(v), valueName: spec.transform === 'diff_baseline' ? 'Extra cost vs baseline' : 'Cost', aria: specTitle(spec) });
  return { table: () => mkData(cats.map(c => c.label), [{ name: 'Cost (' + state.currency + ')', values: cats.map(c => c.value), fmt: fmt.int }]) };
}
/* ---- figure object for a composed chart (so Explain / Table / Export work the same way) ---- */
function askedFigure(item) {
  const spec = item.spec; const M = MSE.GRAMMAR.measures[spec.measure];
  return { id: 'asked-' + item.id, title: specTitle(spec), unit: 'composed from: "' + item.question + '"', measures: 'A chart composed from the question above over the model\'s outputs: ' + specWords(spec) + '.', questions: ['How was this chart built?', 'What is the main message here?', 'What would I need to answer this more precisely?'],
    data() { return item.last ? item.last.table() : mkData([], []); },
    context() { const d = item.last ? item.last.table() : null; const base = baseContext(buildCtx(active()), specTitle(spec), this.measures); const rows = d ? d.xs.slice(0, 60).map((x, i) => x + ': ' + d.cols.map(c => c.name + ' ' + ((c.fmt || fmt.int)(c.values[i]))).join(', ')).join(' · ') : ''; return base.concat(['Chart specification: ' + JSON.stringify(spec) + '.', 'Chart data (first rows): ' + rows]); },
    prepared(q) { if (/built/i.test(q)) return 'The question was mapped to a chart specification over the model\'s outputs: ' + specWords(spec) + '. The tool then drew it from the same runs as the standard charts. Nothing was computed outside the model.'; if (/message/i.test(q)) { const d = item.last ? item.last.table() : null; if (!d || !d.cols.length) return 'No data.'; const col = d.cols[0]; let best = 0; col.values.forEach((v, i) => { if (v != null && v > (col.values[best] || -1e18)) best = i; }); return 'The largest value of ' + M.label + ' in this chart is ' + ((col.fmt || fmt.int)(col.values[best])) + ' at ' + d.xs[best] + (d.cols.length > 1 ? ', comparing ' + d.cols.length + ' series' : '') + '. Read it with the assumptions of the scenario it was built from. The stand-in engine makes it illustrative.'; } if (/precisely/i.test(q)) return 'A composed chart uses central runs for counties and medians for scenarios. For a band, ask for a single scenario over time. For the full uncertainty treatment use the standard charts, which run the varied tier with paired draws.'; return null; },
  };
}
function renderAskBox(host) {
  const box = el('section', { class: 'fig ask' });
  box.append(el('div', { class: 'fig-head' }, el('div', { class: 't' }, [el('h2', { text: 'Ask for a chart' })])));
  const form = el('form', { style: 'display:flex;gap:6px;margin-top:8px;flex-wrap:wrap' }); const inp = el('input', { type: 'text', id: 'ask-input', placeholder: 'e.g. severe cases per month under scenarios A and B', 'aria-label': 'Question for a chart', style: 'flex:1 1 320px' }); const go = el('button', { type: 'submit', class: 'btn primary', text: 'Compose chart' }); form.append(inp, go); box.append(form);
  const chips = el('div', { class: 'chips', style: 'margin-top:8px' });
  const examples = ['What if net usage were 80% in Siaya with Interceptor G2 nets?', 'Compare Royal Guard with Tsara Boost in Kakamega', 'Cases with and without IRS in Homa Bay', 'Cases averted vs baseline over time', 'Cases per 1,000 people by county', 'Share infected over time in Busia and Siaya', 'Extra cost vs baseline by scenario', 'Breakdown by severity, 2027 to 2032', 'Deaths averted by scenario', 'Cases if vaccine efficacy were 60%'].concat(state.savedQuestions || []);
  for (const q of examples) { const b = el('button', { type: 'button', class: 'qchip', text: q }); b.addEventListener('click', () => { inp.value = q; submit(q); }); chips.append(b); }
  box.append(chips);
  const status = el('p', { class: 'small muted ask-status', style: 'margin-top:8px', text: state.askStatus || (sampleFn ? '' : '') }); box.append(status);
  async function submit(q) {
    q = (q || '').trim(); if (!q) return; status.textContent = 'Composing…';
    let spec = null; let wi = null;
    const t = ' ' + q.toLowerCase().replace(/(\d),(\d{3})/g, '$1$2').replace(/[?!.;:]/g, ' ').replace(/\s+/g, ' ') + ' ';
    if (sampleFn) {
      try {
        const prompt = 'Map this question about a malaria scenario tool to JSON with two parts. Part "chart": measure: ' + Object.keys(MSE.GRAMMAR.measures).join('|') + ' (treated = outpatient-treated cases, prev = share infected, itnProt/irsProt = protection curves, cost = illustrative cost). Transform: monthly|cumulative|per1000|diff_baseline|pct_baseline. By: scenario|county|severity|year. Form: line|bars. Window: [startYear, endYear] or null. Scenarios: existing scenario ids among ' + state.scenarios.map(s => s.id).join(',') + ' or null. Counties: array among ' + MSE.COUNTIES.map(c => c.id).join(',') + ' or null. Part "new_scenarios": an array (possibly empty) of scenarios the question needs that do not exist yet, each with only the inputs the question sets: county (id), product (pyrethroid|pbo|ig2|royalguard|tsaraboost), access, usage, irsCoverage, pt, cv (0–1), irsMode (maintain|stop), irsMonth (0–11), campaignYear (2027–2029), interval (2|3|4), horizon (2030|2032|2035), label. Unset inputs keep the current scenario\'s values' + (state.view === 'researcher' ? '. "advanced" may set ' + MSE.ADV_FIELDS.map(f => f.id).join(',') : '. Advanced parameters may not be set in this view: if the question needs one, reply {"error": "..."}') + '. If the question needs something the model does not produce (deaths, DALYs, age groups, climate, admissions, mosquito density, resistance), reply {"error": "<one sentence: what is missing and the closest available output>"}. Reply with only JSON. Question: ' + q;
        const out = await sampleFn.json(prompt, { modelTier: 'quick' });
        if (out && out.error) spec = { error: out.error };
        else if (out && out.chart) { spec = Object.assign({ transform: 'monthly', by: 'scenario', form: 'line', bands: true }, out.chart, { question: q }); const list = Array.isArray(out.new_scenarios) ? out.new_scenarios : [];
          if (list.length) { wi = { any: true, base: {}, variants: list.map(o => Object.assign(sanitizeOverrides(o), { label: o.label || '' })), countyId: list[0].county && county(list[0].county) ? list[0].county : null, adv: sanitizeAdvanced(list[0].advanced), found: [], advFound: Object.keys(sanitizeAdvanced(list[0].advanced)) }; } }
        else spec = parseQuestion(q);
      } catch (e) { spec = parseQuestion(q); }
    } else spec = parseQuestion(q);
    if (spec && spec.unknown) { const probe = parseWhatIf(t, { by: 'scenario' }); if (probe.any) { spec = { question: q, measure: 'treated', transform: probe.variants.length ? 'cumulative' : 'monthly', by: 'scenario', form: probe.variants.length ? 'bars' : 'line', window: null, scenarios: null, counties: null, bands: true }; } }
    if (!spec || spec.unknown) { state.askStatus = 'I could not find a measure in that question. Try naming one of: ' + Object.values(MSE.GRAMMAR.measures).map(m => m.label).join(', ') + '.'; status.textContent = state.askStatus; return; }
    if (spec.error) { status.textContent = 'Not in the model: ' + spec.error + ' Available outputs: ' + Object.values(MSE.GRAMMAR.measures).map(m => m.label).join(', ') + '.'; return; }
    if (!MSE.GRAMMAR.measures[spec.measure]) { status.textContent = 'The composer returned a measure the model does not have (' + spec.measure + ').'; return; }
    if (!wi) wi = parseWhatIf(t, spec);
    if (!scenarioReady(active()) && !(wi.any && (Object.keys(wi.base).length || wi.variants.length || wi.countyId))) { if (!active().inputs.county) { state.askStatus = 'Which county? Name one in the question or choose it on the left, then ask again.'; status.textContent = state.askStatus; return; } wi.any = true; wi.base = wi.base || {}; wi.countyId = wi.countyId || active().inputs.county; }
    let made = null;
    if (wi.any && (Object.keys(wi.base).length || wi.variants.length || wi.countyId || Object.keys(wi.adv).length)) {
      const r = materialiseScenarios(wi, q); if (r.error) { status.textContent = r.error; return; }
      made = r.made; if (r.ids.length) { spec.scenarios = r.ids; if (spec.by === 'county') { spec.by = 'scenario'; spec.counties = null; } state.scenarios = state.scenarios.filter(x => scenarioReady(x)); state.activeId = r.ids[0]; if (!state.scenarios.find(x => x.id === state.referenceId)) state.referenceId = state.scenarios[0].id; renderRail(); }
    }
    state.hasRun = true; state.dirty = false; $('#stale').hidden = true;
    if (!scenarioReady(active())) { state.askStatus = 'Finish the choices on the left (or name them in the question) and ask again.'; status.textContent = state.askStatus; return; }
    for (const x of state.scenarios) if (scenarioReady(x) && (made || x === active())) x.ran = true;   // asking is the run
    state.asked.unshift({ id: ++state.askedSeq, question: q, spec, last: null, made }); state.figGroup = 'asked'; runAll(); inp.value = '';
    const nMade = made ? made.filter(x => /^[A-Z]+ = /.test(x)).length : 0;
    state.askStatus = '';
    const st = $('.fig.ask .ask-status'); if (st) st.textContent = state.askStatus;
  }
  form.addEventListener('submit', ev => { ev.preventDefault(); submit(inp.value); });
  host.append(box);
}
function renderAskedCharts(host, startN) {
  let n = startN;
  for (const item of state.asked) {
    n++; const F = askedFigure(item); const sec = el('section', { class: 'fig', id: 'fig-asked-' + item.id });
    const head = el('div', { class: 'fig-head' });
    head.append(el('div', { class: 't' }, [el('h2', { html: '<span class="muted" style="font-weight:400;margin-right:6px">' + n + '</span>' + F.title }), el('div', { class: 'unit', text: F.unit })]));
    const acts = el('div', { class: 'fig-actions' }); const askBtn = el('button', { type: 'button', class: 'btn small primary', text: explainerAvailable() ? '✦ Ask about this chart' : '✦ Explain this chart' }); const tblBtn = el('button', { type: 'button', class: 'btn small', text: 'Table' }); const save = el('button', { type: 'button', class: 'btn small', text: 'Save as a default question' }); const rm = el('button', { type: 'button', class: 'btn small quiet', text: 'Remove' });
    acts.append(askBtn, tblBtn, exportMenu(F, sec), save, rm); head.append(acts); sec.append(head);
    const body = el('div', { class: 'fig-body noaside' }); const chart = el('div', { class: 'chart' }); body.append(chart); sec.append(body); host.append(sec);
    try { item.last = composeChart(chart, item.spec); } catch (e) { chart.append(el('p', { class: 'small', text: 'Could not compose: ' + e.message })); console.error(e); }
    const tbl = el('div', { hidden: '' }); sec.append(tbl);
    tblBtn.addEventListener('click', () => { if (tbl.hidden) { tbl.innerHTML = ''; const d = F.data(); tbl.append(tableView(d.xs, d.cols)); tbl.hidden = false; tblBtn.textContent = 'Hide table'; } else { tbl.hidden = true; tblBtn.textContent = 'Table'; } });
    const ex = buildExplainer(F, buildCtx(active())); ex.hidden = !state.explainerOpen[F.id]; sec.append(ex);
    askBtn.addEventListener('click', () => { ex.hidden = !ex.hidden; state.explainerOpen[F.id] = !ex.hidden; if (!ex.hidden) $('input', ex).focus(); });
    save.addEventListener('click', () => { state.savedQuestions = state.savedQuestions || []; if (!state.savedQuestions.includes(item.question)) state.savedQuestions.push(item.question); save.textContent = 'Saved to the question list'; save.disabled = true; });
    rm.addEventListener('click', () => { state.asked = state.asked.filter(x => x !== item); renderFigures(); });
  }
}
