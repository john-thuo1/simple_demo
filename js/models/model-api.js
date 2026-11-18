/* ===================== Model service API (in-page stand-in) =====================
     GET  /models                      → list of library models (id, name, standing, review, runtime, purpose, structure_id, values_id)
     GET  /families                    → the four model clusters (name, description, strength, limitation)
     GET  /models/{id}                 → the package: structure, parameters + annotations, sets, observables, validation
     GET  /models/{id}/inputs          → the user-facing input form derived from the package (levers, tiers, sets, outputs)
     POST /models                      → import a package file (custom model: unreviewed, live runs only; same_structure_as names a library model with the same structure)
     POST /scenarios                   → {model_id, parameter_set, overrides, pins, horizon, mode} → mse-result (served by the scenario service below)

   Library packages were compiled from the team's model text by the service and are kept as one file each in js/models/library/. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(['cema-county', 'seirs-treatment', 'sir'].map(id => require('./library/' + id + '.js')));
  else root.ModelAPI = factory(root.MSE_MODEL_LIBRARY || []);
})(typeof self !== 'undefined' ? self : this, function (LIBRARY) {
  'use strict';
  const clone = x => JSON.parse(JSON.stringify(x));
  const store = new Map(LIBRARY.map(e => [e.id, e]));
  const log = [];
  const record = (method, path, ms, note) => { log.unshift({ method, path, ms: +ms.toFixed(2), note: note || '', at: Date.now() }); if (log.length > 30) log.pop(); };
  /* Families by purpose, after the team's review of 102 models (wording to confirm with the review's author).
     "informs" is phrased as the discussion a model feeds, never as a decision the tool makes. */
  const FAMILIES = [
    { id: 'intervention', name: 'Intervention models', description: 'Models that represent interventions such as nets, IRS, SMC and treatment, alone or combined. They compare strategies and coverage levels, and they assume ideal coverage and adherence.', label: 'Intervention model', question: 'Compare intervention strategies', strength: 'Compares strategies and coverage levels.', limitation: 'Assumes ideal coverage and adherence.', informs: 'Discussion of the intervention mix by national and county programmes.' },
    { id: 'cost-effectiveness', name: 'Cost-effectiveness models', description: 'Intervention models with costs attached, setting health gains against spending. They show value for money, and their results depend on the quality of the cost data.', label: 'Cost-effectiveness model', question: 'Weigh health gains against costs', strength: 'Value for money and sustainability.', limitation: 'Depends on the quality of the cost data.', informs: 'Budget discussions by government and donors.' },
    { id: 'optimal-control', name: 'Optimal-control models', description: 'Models that search for the timing and intensity of interventions under constraints. They are often theoretical and ignore logistics. This tool shows their schedules as scenarios and does not optimise.', label: 'Optimal-control model', question: 'Plan timing and intensity under constraints', strength: 'Prioritises timing and intensity under constraints.', limitation: 'Often theoretical and ignores logistics. This tool shows such a model\'s schedules as scenarios and does not optimise.', informs: 'Medium-term planning on limited budgets.' },
    { id: 'transmission', name: 'Transmission models', description: 'Disease dynamics only: human–vector transmission, climate and immunity. They explain what drives transmission and where its thresholds lie (R0, equilibria). They have limited direct operational use because they declare no interventions to compare.', label: 'Transmission model', question: 'Understand what drives transmission', strength: 'Explains drivers and thresholds (R0, equilibria).', limitation: 'Limited direct operational use: it declares no interventions to compare.', informs: 'Understanding persistence, especially in high-transmission settings.' },
  ];
  const fnv = str => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return ('00000000' + h.toString(16)).slice(-8); };
  const squash = x => String(x == null ? '' : x).replace(/\s+/g, '');
  /* Identity in three parts. structure_id covers compartments, flows, functions and which parameters exist;
     values_id covers defaults and parameter sets; annotations (labels, tiers, ranges) are in neither.
     A change of values therefore keeps the structure_id: same model, different numbers.
     Prototype hash: still sensitive to names and order; the model service's will not be. */
  const structureId = P => fnv(JSON.stringify({ c: (P.compartments || []).map(c => [c.id, c.group || '', !!c.absorbing]), f: (P.flows || []).map(f => [f.from, f.to, squash(f.rate)]), fn: (P.functions || []).map(f => [f.id, squash(f.expr)]), p: (P.parameters || []).map(p => [p.id, p.type]) }));
  const valuesId = P => fnv(JSON.stringify({ d: (P.parameters || []).map(p => [p.id, p.default]), s: P.parameter_sets || [] }));
  /* purpose is computed from the layers a package carries, not assigned by hand */
  const purposeOf = e => { const levers = (e.package.parameters || []).some(p => (p.annotation || {}).lever); if (e.objective) return 'optimal-control'; if (levers && e.costs) return 'cost-effectiveness'; return levers ? 'intervention' : 'transmission'; };
  const sameStructure = e => { if (!e.custom) return null; const sid = structureId(e.package); for (const o of store.values()) if (!o.custom && structureId(o.package) === sid) return o.id; return null; };
  const summary = e => ({ id: e.id, model_id: e.package.model_id, name: e.package.model.name, standing: e.custom ? 'custom' : e.package.standing, reviewed: !!e.reviewed, reviewer: e.reviewer || null, grid: !!e.grid, runtime_ms: e.runtime_ms, blurb: e.blurb || '', custom: !!e.custom, purpose: purposeOf(e), structure_id: structureId(e.package), values_id: valuesId(e.package), parameter_sets: (e.package.parameter_sets || []).length, same_structure_as: sameStructure(e) });
  const api = {
    base: '/api/v1',
    log,
    listModels() { const t = performance.now(); const out = Array.from(store.values()).map(summary); record('GET', '/models', performance.now() - t, out.length + ' models'); return out; },
    listFamilies() { const t = performance.now(); const out = clone(FAMILIES); record('GET', '/families', performance.now() - t, out.length + ' families'); return out; },
    getModel(id) { const t = performance.now(); const e = store.get(id); if (!e) throw new Error('404 model ' + id); const out = clone(e.package); record('GET', '/models/' + id, performance.now() - t, 'package ' + out.model_id); return out; },
    getInputs(id) {
      const t = performance.now(); const e = store.get(id); if (!e) throw new Error('404 model ' + id); const P = e.package;
      const field = p => { const a = p.annotation || {}; const isC = p.type === 'campaign' || (p.default && typeof p.default === 'object'); return Object.assign({ id: p.id, label: a.label || p.id, type: p.type, unit: a.unit || '', default: p.default, range: a.range || null, tier: a.tier || null, lever: !!a.lever, source: a.source || '' }, isC ? { control: 'campaign', fields: ['coverage', 'every', 'from', 'month'] } : { control: a.range ? 'slider' : 'readonly' }); };
      const byTier = tier => P.parameters.filter(p => (p.annotation || {}).tier === tier).map(field);
      const out = { model_id: P.model_id, name: P.model.name, standing: P.standing, start: P.model.start,
        levers: P.parameters.filter(p => (p.annotation || {}).lever).map(field),
        user: byTier('user').filter(f => !f.lever), advanced: byTier('advanced'), varied: byTier('varied'), fixed: byTier('fixed'),
        unannotated: P.parameters.filter(p => !(p.annotation || {}).tier).map(field),
        parameter_sets: (P.parameter_sets || []).map(s => ({ id: s.id, parameters: Object.keys(s.values || {}) })),
        outputs: (P.observables || []).map(o => ({ id: o.id, label: o.label, unit: o.unit || '', kind: o.kind })),
        horizon: { unit: 'years', min: 1, max: 15 }, assumptions: P.assumptions || [], valid: !!(P.validation && P.validation.valid) };
      record('GET', '/models/' + id + '/inputs', performance.now() - t, out.levers.length + ' levers · ' + out.user.length + ' user · ' + out.advanced.length + ' advanced · ' + out.varied.length + ' varied · ' + out.fixed.length + ' fixed');
      return out;
    },
    importPackage(json, label) {
      const t = performance.now();
      if (!json || typeof json !== 'object') throw new Error('400 not a package');
      if (!Array.isArray(json.parameters) || !Array.isArray(json.compartments) || !Array.isArray(json.flows)) { if (json.dsl_source) throw new Error('422 this file holds model text, not a compiled package. Compile it with the model service first.'); throw new Error('400 package needs compartments, parameters and flows'); }
      const pkg = clone(json); delete pkg.dsl_source;
      if (!pkg.model_id) { let h = 0x811c9dc5; const s = JSON.stringify(pkg); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } pkg.model_id = ('00000000' + h.toString(16)).slice(-8); }
      const id = 'custom-' + pkg.model_id; const e = { id, custom: true, reviewed: false, reviewer: null, grid: false, runtime_ms: 10, blurb: label || 'imported in this session', package: pkg }; store.set(id, e);
      record('POST', '/models', performance.now() - t, '201 ' + id); return summary(e);
    },
    scenarioRequest(modelId, s, mode) { return { model_id: modelId, parameter_set: s.set || null, overrides: s.overrides, pins: s.pins, horizon_years: s.horizon, mode: mode || 'deterministic', draws: null }; },
    recordScenario(id, ms, mode) { record('POST', '/scenarios', ms, id + ' · ' + mode); },
  };
  return api;
});
