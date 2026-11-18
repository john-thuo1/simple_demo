function onGrid(s) {
  const i = s.inputs, g = MSE.GRID, c = county(i.county), near = (v, step) => Math.abs(v / step - Math.round(v / step)) < 1e-6;
  // the grid holds the 10% steps plus each county's current (fitted) coverage values
  const ok = (v, step, def) => near(v, step) || Math.abs(v - def) < 1e-9;
  if (!ok(i.access, g.access, c.access) || !ok(i.usage, g.usage, c.usage) || !ok(i.pt, g.pt, c.pt) || !ok(i.cv, g.cv, c.cv)) return false;
  if (i.irsMode === 'maintain' && (!ok(i.irsCoverage, g.irsCoverage, c.irsCoverageHist || 0.85) || i.irsMonth !== 2)) return false;
  if (!g.campaignYear.includes(i.campaignYear) || !g.interval.includes(i.interval) || !g.horizon.includes(i.horizon)) return false;
  if (Object.keys(cleanAdvanced(s.advanced)).length || Object.keys(cleanPins(s.pins)).length) return false;
  return true;
}
function translate(s) {
  // surface -> model parameters via the registry (what the service's "Translate" step returns)
  const c = county(s.inputs.county), adv = cleanAdvanced(s.advanced), pins = cleanPins(s.pins);
  const P = E.buildParams(c, engineInputs(s), adv, {});
  const prod = E.PRODUCTS[s.inputs.product];
  return {
    county: c.id, population: c.population,
    fixed: { gamma_h: E.FIXED.gamma_h, p_a: E.FIXED.p_a, p_u: E.FIXED.p_u, omega: E.FIXED.omega, tau: E.FIXED.tau, r: E.FIXED.r, r_s: E.FIXED.r_s, delta: E.FIXED.delta, mu_h: E.FIXED.mu_h },
    advanced: { eps: P.eps, alpha: P.alpha, beta: P.beta, phi: P.phi, b: P.b, c: P.c, m: P.m, mu_m: P.mu_m, gamma_m: P.gamma_m, zeta_a: P.zeta_a, zeta_t: P.zeta_t, p_under5: P.p_under5 },
    user: { p_t: P.p_t, c_v: P.c_v, net: { product: s.inputs.product, peak: prod.peak, decay_per_year: prod.k, access: s.inputs.access, usage: s.inputs.usage, campaigns: P.itn.campaigns.map(x => x[0]) }, irs: { rounds: P.irs.rounds.map(x => ({ t: +x[0].toFixed(3), coverage: x[1] })) }, horizon: s.inputs.horizon },
    varied: { itnEff: pins.itnEff != null ? { pinned: pins.itnEff } : { range: E.RANGES.itnEff }, irsEff: pins.irsEff != null ? { pinned: pins.irsEff } : { range: E.RANGES.irsEff }, a: pins.a != null ? { pinned: pins.a } : { range: E.RANGES.a }, rho_days: pins.rho != null ? { pinned: Math.round(1 / pins.rho) } : { range: E.RANGES.rho_days } },
    overrides: Object.keys(adv),
  };
}
function windowRange(s) { return [2027, s.inputs.horizon + 1]; }
function cumulative(run, t, key, lo, hi) { let x = 0; for (let k = 0; k < t.length; k++) if (t[k] >= lo - 1e-9 && t[k] < hi - 1e-9) x += run[key][k]; return x; }
function quantiles(arr) { const s = arr.slice().sort((a, b) => a - b); const q = p => { const pos = (s.length - 1) * p, lo = Math.floor(pos), hi = Math.ceil(pos); return s[lo] + (s[hi] - s[lo]) * (pos - lo); }; return { median: q(0.5), q05: q(0.05), q25: q(0.25), q75: q(0.75), q95: q(0.95) }; }

function simulateBaseline(s, seed) {
  const key = JSON.stringify({ b: baselineInputs(s), adv: cleanAdvanced(s.advanced), pins: cleanPins(s.pins), seed });
  if (state.baseCache.has(key)) return state.baseCache.get(key);
  const c = county(s.inputs.county);
  const bi = baselineInputs(s); bi.irsOn = false;
  const sim = E.simulate(c, bi, cleanAdvanced(s.advanced), cleanPins(s.pins), MSE.N_DRAWS, seed);
  state.baseCache.set(key, sim);
  return sim;
}
function costsFor(c, inputs, run, t, lo, hi) {
  const U = state.costs; const prod = E.PRODUCTS[inputs.product];
  const treated = cumulative(run, t, 'treated', lo, hi);
  const treatment = treated * U.treatedCase;
  let nets = 0; for (const cp of E.campaignsFor(inputs)) if (cp[0] >= lo && cp[0] < hi) nets += c.population * inputs.access * U.netsPerPerson * (E.PRODUCTS[cp[1]].cost + U.netDelivery);
  let irs = 0; for (const r of E.irsRoundsFor(inputs, c)) if (r[0] >= lo && r[0] < hi) irs += c.population * r[1] * U.irsPerPerson;
  const years = hi - lo; const vaccine = c.population * E.ADVANCED.p_under5 * inputs.cv * U.vaccinePerChild * years;
  return { treatment, nets, irs, vaccine, vector: nets + irs, total: treatment + nets + irs + vaccine, treated };
}

/** The router: returns the result record for a scenario (from cache, grid, live or emulator). */
function getResult(s) { if (!scenarioReady(s)) return null; const id = scenarioHash(s); if (state.renderMemo && state.renderMemo.has(id)) return state.renderMemo.get(id); const r = execute(s); if (state.renderMemo) state.renderMemo.set(id, r); return r; }
function execute(s) {
  if (!scenarioReady(s)) { console.warn('Scenario ' + s.id + ' is incomplete: choose ' + missingChoices(s).join(', ')); return null; }
  const t0 = performance.now();
  const id = scenarioHash(s);
  const trace = [{ n: 1, text: 'POST /scenarios · validate inputs · scenario ID ' + id, ms: 0.2 }];
  if (state.results.has(id)) {
    const r = state.results.get(id);
    trace.push({ n: 2, text: 'Result cache: hit for ' + id + ' at model ' + E.MODEL_VERSION, ms: 0.1, decision: true });
    trace.push({ n: 3, text: 'Return cached result · mode recorded: cache', ms: 0.1 });
    state.modeCounts.cache++;
    const rr = Object.assign({}, r, { execution: Object.assign({}, r.execution, { mode: 'cache', computedMode: r.execution.computedMode || r.execution.mode, ms: performance.now() - t0, servedFromCache: true }) });
    state.lastTrace = trace; return rr;
  }
  const tr = translate(s);
  trace.push({ n: 2, text: 'Result cache: miss', ms: 0.1 });
  trace.push({ n: 3, text: 'Translate: ' + Object.keys(tr.user).length + ' user inputs → model parameters via the registry' + (tr.overrides.length ? ' · advanced overrides: ' + tr.overrides.join(', ') : ''), ms: 0.3 });
  let mode, approx = 0;
  const grid = onGrid(s);
  if (grid) { mode = 'grid'; trace.push({ n: 4, text: 'Router: every input on a grid step and no overrides → look up precomputed results', ms: 0.1, decision: true }); }
  else if (state.routerAssumedMs <= state.routerThresholdMs) { mode = 'live'; trace.push({ n: 4, text: 'Router: off-grid request · measured live run ' + fmt.ms(state.routerAssumedMs) + ' ≤ ' + fmt.ms(state.routerThresholdMs) + ' → live run', ms: 0.1, decision: true }); }
  else { mode = 'emulator'; approx = 0.05; trace.push({ n: 4, text: 'Router: off-grid request · measured live run ' + fmt.ms(state.routerAssumedMs) + ' > ' + fmt.ms(state.routerThresholdMs) + ' → emulator (approximation band ±5%)', ms: 0.1, decision: true }); }
  const c = county(s.inputs.county);
  const seed = E.hash32(id);
  const t1 = performance.now();
  const sim = E.simulate(c, engineInputs(s), cleanAdvanced(s.advanced), cleanPins(s.pins), MSE.N_DRAWS, seed);
  const base = simulateBaseline(s, seed);
  const simMs = performance.now() - t1;
  trace.push({ n: 5, text: (mode === 'grid' ? 'Grid store: lookup' : mode === 'live' ? 'Engine: ' + MSE.N_DRAWS + ' draws over the varied tier, paired baseline' : 'Emulator: prediction for the request (stand-in: live run plus reported band)') + ' · ' + MSE.N_DRAWS + ' draws', ms: simMs });
  // summaries over the horizon window
  const [lo, hi] = windowRange(s); const t = sim.t;
  const cases = sim.runs.map(r => cumulative(r, t, 'treated', lo, hi));
  const bcases = base.runs.map(r => cumulative(r, t, 'treated', lo, hi));
  const averted = cases.map((v, j) => bcases[j] - v);
  const avertedPct = cases.map((v, j) => (bcases[j] - v) / bcases[j]);
  const severe = sim.runs.map(r => cumulative(r, t, 'severe', lo, hi));
  const k0 = monthIndex(2024, t), kEnd = monthIndex(hi, t);
  let peak = { value: -1, t: 0 }; for (let k = k0; k < kEnd; k++) if (sim.series.treated.median[k] > peak.value) peak = { value: sim.series.treated.median[k], t: t[k] };
  let prevEnd = 0; for (let k = kEnd - 12; k < kEnd; k++) prevEnd += sim.series.prev.median[k] / 12;
  let bprevEnd = 0; for (let k = kEnd - 12; k < kEnd; k++) bprevEnd += base.series.prev.median[k] / 12;
  const costs = costsFor(c, engineInputs(s), sim.central, t, lo, hi); const bcosts = costsFor(c, Object.assign(baselineInputs(s), { irsOn: false }), base.central, t, lo, hi);
  const summary = { cases: quantiles(cases), baseCases: quantiles(bcases), averted: quantiles(averted), avertedPct: quantiles(avertedPct), severe: quantiles(severe), peak, prevEnd, bprevEnd, costs, bcosts,
    costPerAverted: quantiles(averted).median > 0 ? (costs.total - bcosts.total) / quantiles(averted).median : null };
  const res = { schema: 'cema-scenario-result/0.1', scenario_id: id, model: { name: 'CEMA county model (stand-in)', version: E.MODEL_VERSION }, engine: { name: 'in-browser Euler', version: E.ENGINE_VERSION },
    execution: { mode, computedMode: mode, ms: performance.now() - t0, simMs, onGrid: grid, draws: MSE.N_DRAWS, seed, approxError: approx, servedFromCache: false },
    inputs: engineInputs(s), parameters: tr, t, sim, base, summary, county: c };
  trace.push({ n: 6, text: 'Summaries: cases 2027–' + s.inputs.horizon + ', cases averted vs baseline (paired draws), peak, prevalence, illustrative costs', ms: 0.4 });
  trace.push({ n: 7, text: 'Cache result under ' + id + ' · return in one schema · mode recorded: ' + mode, ms: 0.1 });
  res.trace = trace; state.results.set(id, res); state.modeCounts[mode]++; state.lastTrace = trace;
  return res;
}
function observedFor(c) {
  if (state.obsCache.has(c.id)) return state.obsCache.get(c.id);
  const obs = E.observed(c, defaultInputs(c)); state.obsCache.set(c.id, obs); return obs;
}

/* sensitivity: one-at-a-time swings on cases 2027–horizon (central runs) */
function tornadoFor(s, res) {
  const c = county(s.inputs.county), inputs = engineInputs(s), adv = cleanAdvanced(s.advanced), pins = cleanPins(s.pins);
  const [lo, hi] = windowRange(s);
  const run1 = (advO, draw) => { const P = E.buildParams(c, inputs, Object.assign({}, adv, advO || {}), draw || {}); const r = E.run(P); return cumulative(r, r.t, 'treated', lo, hi); };
  const base = run1(null, null);
  const rows = [];
  const R = E.RANGES;
  const tryRow = (label, lowRun, highRun, lowLbl, highLbl) => rows.push({ label, low: lowRun / base - 1, high: highRun / base - 1, lowLbl, highLbl });
  if (pins.itnEff == null) tryRow('Net efficacy (' + MSE.RANGE_TEXT.itnEff + ')', run1(null, { itnEff: R.itnEff[0] }), run1(null, { itnEff: R.itnEff[1] }), '×' + R.itnEff[0].toFixed(2), '×' + R.itnEff[1].toFixed(2));
  if (pins.irsEff == null && inputs.irsOn) tryRow('IRS efficacy (' + MSE.RANGE_TEXT.irsEff + ')', run1(null, { irsEff: R.irsEff[0] }), run1(null, { irsEff: R.irsEff[1] }), '×' + R.irsEff[0].toFixed(2), '×' + R.irsEff[1].toFixed(2));
  if (pins.a == null) tryRow('Biting rate a (' + MSE.RANGE_TEXT.a.replace(' per day', '') + ')', run1(null, { a: R.a[0] }), run1(null, { a: R.a[1] }), R.a[0].toFixed(2), R.a[1].toFixed(2));
  if (pins.rho == null) tryRow('Loss of immunity (' + MSE.RANGE_TEXT.rho + ')', run1(null, { rho: 1 / R.rho_days[0] }), run1(null, { rho: 1 / R.rho_days[1] }), R.rho_days[0] + ' d', R.rho_days[1] + ' d');
  for (const f of MSE.ADV_FIELDS) {
    const d = adv[f.id] != null ? adv[f.id] : f.def(c);
    if (f.id === 'phi') continue;
    const o = {}; o[f.id] = d * 0.85; const p = {}; p[f.id] = d * 1.15;
    tryRow(f.sym + ' · ' + f.label + ' (±15%)', run1(o), run1(p), '−15%', '+15%');
  }
  rows.sort((x, y) => (Math.abs(y.high) + Math.abs(y.low)) - (Math.abs(x.high) + Math.abs(x.low)));
  return { base, rows: rows.slice(0, 8) };
}
MSE.SWEEPS = {
  usage: { label: 'Net usage', values: [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9], fmt: v => fmt.pct(v) },
  access: { label: 'Net access', values: [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0], fmt: v => fmt.pct(v) },
  irsCoverage: { label: 'IRS coverage (yearly rounds)', values: [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9], fmt: v => fmt.pct(v) },
  pt: { label: 'Treatment coverage p_t', values: [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9], fmt: v => fmt.pct(v) },
  cv: { label: 'Vaccination coverage c_v', values: [0, 0.2, 0.4, 0.6, 0.8, 1.0], fmt: v => fmt.pct(v) },
  campaignYear: { label: 'Next campaign year', values: [2027, 2028, 2029], fmt: v => String(v) },
};
function sweepFor(s, key) {
  const sw = MSE.SWEEPS[key]; const c = county(s.inputs.county); const [lo, hi] = windowRange(s);
  const adv = cleanAdvanced(s.advanced), pins = cleanPins(s.pins);
  const points = sw.values.map(v => {
    const inputs = engineInputs(s); inputs[key] = v; if (key === 'irsCoverage') { inputs.irsMode = 'maintain'; inputs.irsOn = true; }
    const sim = E.simulate(c, inputs, adv, pins, 10, 777);
    const cases = sim.runs.map(r => cumulative(r, sim.t, 'treated', lo, hi));
    return Object.assign({ x: v }, quantiles(cases));
  });
  return { key, label: sw.label, points, fmt: sw.fmt };
}
