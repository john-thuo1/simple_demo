const state = MSE.state = {
  view: MSE.SINGLE_VIEW ? 'researcher' : 'normal', scenarios: [], activeId: 'A', live: true, dirty: false,
  bands: { b50: true, b90: true }, showBaseline: true,
  routerAssumedMs: 400, routerThresholdMs: 2000,
  results: new Map(), baseCache: new Map(), modeCounts: { cache: 0, grid: 0, live: 0, emulator: 0 }, lastTrace: [],
  sweepInput: 'usage', costs: Object.assign({}, MSE.COSTS), obsCache: new Map(), tab: 'build', explainerOpen: {},
  currency: 'KES', currencyExplicit: true, referenceId: 'A', figGroup: 'results', hasRun: false,
};
function toUSD(v) { const C = MSE.CURRENCIES[state.currency] || MSE.CURRENCIES.USD; return v / C.perUSD; }
function county(id) { return MSE.COUNTIES.find(c => c.id === id); }
function defaultInputs(c, over) {
  return Object.assign({ county: c.id, product: 'pbo', access: c.access, usage: c.usage, campaignYear: 2027, interval: 3,
    irsMode: 'stop', irsOn: false, irsCoverage: c.irsCoverageHist || 0.85, irsMonth: 2, pt: c.pt, cv: c.cv, horizon: 2032 }, over || {});
}
function blankScenario(id) { return { id, name: '', preset: '', ran: false, inputs: { county: null, product: null, irsMode: null, irsOn: false, access: null, usage: null, irsCoverage: null, irsMonth: 2, pt: null, cv: null, campaignYear: 2027, interval: 3, horizon: 2032 }, advanced: {}, pins: {}, shown: true }; }
function scenarioReady(s) { return !!(s && s.inputs.county && s.inputs.product && s.inputs.irsMode); }
function missingChoices(s) { const m = []; if (!s.inputs.county) m.push('a county'); if (!s.inputs.product) m.push('the net product'); if (!s.inputs.irsMode) m.push('the spraying decision'); return m; }
function newScenario(id, inputs, preset) {
  return { id, name: '', preset: preset || '', ran: false, inputs, advanced: {}, pins: {}, shown: true };
}
function scenarioColor(s) { const k = state.scenarios.indexOf(s); return MSE.SLOT_COLORS[(k < 0 ? 0 : k) % MSE.SLOT_COLORS.length]; }
function readyScenarios() { return state.scenarios.filter(scenarioReady); }
function chartedScenarios() { let n = 0; return state.scenarios.filter(s => { if (!s.shown || !scenarioReady(s)) return false; if (n >= MSE.MAX_CHARTED) return false; n++; return true; }); }
function reference() { const r = readyScenarios(); return r.find(s => s.id === state.referenceId) || r[0] || state.scenarios[0]; }
function presetMatches(s) {
  if (!s.preset) return false; const c = county(s.inputs.county); const set = MSE.PRESETS[c.group]; const p = set.find(x => x.label === s.preset); if (!p) return false;
  const d = defaultInputs(c, { product: p.product, irsMode: p.irsMode, horizon: s.inputs.horizon });
  for (const k of Object.keys(d)) { if (k === 'irsOn') continue; if ((k === 'irsCoverage' || k === 'irsMonth') && d.irsMode !== 'maintain') continue; if (d[k] !== s.inputs[k]) return false; }
  return !Object.keys(cleanAdvanced(s.advanced)).length && !Object.keys(cleanPins(s.pins)).length;
}
function active() { return state.scenarios.find(s => s.id === state.activeId) || state.scenarios[0]; }
function scenarioName(s) {
  if (s.name) return s.name;
  if (!scenarioReady(s)) return s.inputs.county ? county(s.inputs.county).name + ' · choices pending' : 'New scenario';
  const c = county(s.inputs.county), p = E.PRODUCTS[s.inputs.product];
  const irs = s.inputs.irsMode === 'maintain' ? 'IRS yearly' : (c.irsHistory ? 'IRS stopped' : 'no IRS');
  return c.name + ' · ' + p.short + ' nets · ' + irs;
}
function nextScenarioId() { const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; for (let i = 0; i < L.length; i++) if (!state.scenarios.find(s => s.id === L[i])) return L[i]; for (let i = 0; i < L.length; i++) for (let j = 0; j < L.length; j++) { const id = L[i] + L[j]; if (!state.scenarios.find(s => s.id === id)) return id; } return null; }
function cleanAdvanced(adv) { const o = {}; for (const k in adv) if (adv[k] != null && !Number.isNaN(adv[k])) o[k] = adv[k]; return o; }
function cleanPins(p) { const o = {}; for (const k in p) if (p[k] != null && !Number.isNaN(p[k])) o[k] = p[k]; return o; }
function engineInputs(s) { const i = Object.assign({}, s.inputs); i.irsOn = i.irsMode === 'maintain'; return i; }
function scenarioHash(s) {
  const payload = JSON.stringify({ inputs: engineInputs(s), advanced: cleanAdvanced(s.advanced), pins: cleanPins(s.pins), model: E.MODEL_VERSION, draws: MSE.N_DRAWS });
  return 'SCN-' + hex32(E.hash32(payload)).slice(0, 6).toUpperCase();
}
function baselineInputs(s) {
  const c = county(s.inputs.county);
  return defaultInputs(c, { horizon: s.inputs.horizon });
}
function differences(s, ref) {
  if (!ref || s === ref) return [];
  const d = [], a = s.inputs, b = ref.inputs;
  const pn = p => E.PRODUCTS[p].short;
  if (a.county !== b.county) d.push('county ' + county(a.county).name);
  if (a.product !== b.product) d.push(pn(a.product) + ' nets (' + ref.id + ': ' + pn(b.product) + ')');
  if (a.access !== b.access) d.push('access ' + fmt.pct(a.access) + ' (' + ref.id + ': ' + fmt.pct(b.access) + ')');
  if (a.usage !== b.usage) d.push('usage ' + fmt.pct(a.usage) + ' (' + ref.id + ': ' + fmt.pct(b.usage) + ')');
  if (a.campaignYear !== b.campaignYear || a.interval !== b.interval) d.push('campaign ' + a.campaignYear + ' every ' + a.interval + ' y');
  if (a.irsMode !== b.irsMode) d.push(a.irsMode === 'maintain' ? 'IRS maintained yearly' : 'IRS stopped');
  else if (a.irsMode === 'maintain' && (a.irsCoverage !== b.irsCoverage || a.irsMonth !== b.irsMonth)) d.push('IRS ' + fmt.pct(a.irsCoverage) + ' in ' + MSE.MONTHS[a.irsMonth]);
  if (a.pt !== b.pt) d.push('treatment ' + fmt.pct(a.pt) + ' (' + ref.id + ': ' + fmt.pct(b.pt) + ')');
  if (a.cv !== b.cv) d.push('vaccination ' + fmt.pct(a.cv) + ' (' + ref.id + ': ' + fmt.pct(b.cv) + ')');
  if (a.horizon !== b.horizon) d.push('horizon ' + a.horizon);
  const ad = cleanAdvanced(s.advanced), bd = cleanAdvanced(ref.advanced);
  const keys = new Set([...Object.keys(ad), ...Object.keys(bd)]);
  for (const k of keys) if (ad[k] !== bd[k]) { const f = MSE.ADV_FIELDS.find(x => x.id === k); d.push(f.sym + ' = ' + (ad[k] != null ? ad[k] : 'fitted')); }
  const ap = cleanPins(s.pins), bp = cleanPins(ref.pins);
  for (const k of new Set([...Object.keys(ap), ...Object.keys(bp)])) if (ap[k] !== bp[k]) d.push(k + (ap[k] != null ? ' pinned' : ' varied'));
  return d;
}
