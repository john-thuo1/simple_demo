(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MENGINE = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TIERS = ['user', 'advanced', 'varied', 'fixed'];
  const TYPES = ['fraction', 'rate', 'count', 'number', 'campaign'];
  const BUILTINS = { cos: Math.cos, sin: Math.sin, exp: Math.exp, sqrt: Math.sqrt, min: Math.min, max: Math.max, abs: Math.abs, log: Math.log, pi: Math.PI, step: x => (x > 0 ? 1 : 0) };

  /* ---------- hash (FNV-1a, 32-bit, hex) for model_id and scenario ids ---------- */
  function hash(str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return ('00000000' + h.toString(16)).slice(-8); }

  /* ---------- loader: package JSON (the model-service contract) → internal model object ---------- */
  function fromPackage(json) {
    if (!json || typeof json !== 'object') throw new Error('not a package');
    if (!Array.isArray(json.compartments) || !Array.isArray(json.parameters) || !Array.isArray(json.flows)) throw new Error('package needs compartments, parameters and flows');
    const model = Object.assign({ name: 'Untitled model', standing: 'illustrative', start: 2017, source: '', notes: '' }, json.model || {});
    const pkg = { model, compartments: [], params: [], funcs: [], flows: [], observables: [], sets: [], assumptions: [], errors: [], warnings: [] };
    pkg.compartments = json.compartments.map(c => ({ id: c.id, label: c.label || c.id, init: c.init != null ? c.init : 0, group: c.group || 'human', absorbing: !!c.absorbing }));
    pkg.params = json.parameters.map(p => {
      const a = p.annotation || {}; const isCampaign = p.type === 'campaign' || (p.default && typeof p.default === 'object');
      const cf = isCampaign ? Object.assign({ coverage: 0, peak: 0, decay: 0, every: 1, from: 2027, month: 0 }, p.default || {}) : null;
      if (p.type && !TYPES.includes(p.type)) pkg.errors.push({ line: 0, msg: 'param ' + p.id + ' has unknown type ' + p.type });
      if (a.tier && !TIERS.includes(a.tier)) pkg.errors.push({ line: 0, msg: 'param ' + p.id + ' has unknown tier ' + a.tier });
      return { id: p.id, type: p.type || (isCampaign ? 'campaign' : 'number'), value: isCampaign ? cf.coverage : (p.default != null ? +p.default : null), label: a.label || '', unit: a.unit || '', range: a.range || null, tier: a.tier || null, lever: !!a.lever, source: a.source || '', annotated: {}, campaign: cf, line: null };
    });
    pkg.funcs = (json.functions || []).map(f => ({ id: f.id, expr: f.expr }));
    pkg.flows = json.flows.map(f => ({ id: f.id || (f.from + '->' + f.to), from: f.from, to: f.to, expr: f.rate != null ? f.rate : f.expr, label: f.label || (f.from + ' → ' + f.to), line: 0 }));
    pkg.observables = (json.observables || []).map(o => ({ id: o.id, label: o.label || o.id, kind: o.kind || (o.flow || (o.flows && o.flows.length) ? 'flow' : 'expr'), expr: o.expr || '', flow: o.flow || null, flows: o.flows || (o.flow ? o.flow.split('+').map(s => s.trim()) : []), unit: o.unit || '' }));
    pkg.sets = (json.parameter_sets || []).map(s => ({ id: s.id, values: Object.assign({}, s.values || {}) }));
    pkg.assumptions = (json.assumptions || []).slice();
    pkg.model_id = json.model_id || hash(JSON.stringify(json));
    pkg.upstream = json.validation || null;
    validate(pkg);
    return pkg;
  }

  /* ---------- validation: structural rules (hard) and advisories (soft) ---------- */
  function identsOf(expr) { const out = []; const re = /[A-Za-z_][A-Za-z0-9_]*/g; let m; while ((m = re.exec(expr))) out.push(m[0]); return out; }
  function validate(pkg) {
    const E = pkg.errors, W = pkg.warnings;
    const comp = new Set(pkg.compartments.map(c => c.id)), par = new Set(pkg.params.map(p => p.id)), fn = new Set(pkg.funcs.map(f => f.id));
    const known = id => comp.has(id) || par.has(id) || fn.has(id) || id in BUILTINS || id === 't' || id === 'year' || id === 'N';
    pkg.rules = [];
    const rule = (id, text, ok, detail, soft) => pkg.rules.push({ id, text, ok, detail: detail || '', soft: !!soft });
    const seen = new Set(); let dup = null;
    for (const c of pkg.compartments) { if (seen.has(c.id)) dup = c.id; seen.add(c.id); }
    for (const p of pkg.params) { if (seen.has(p.id)) dup = p.id; seen.add(p.id); }
    rule('unique', 'Every identifier is declared once', !dup, dup ? 'duplicate: ' + dup : '');
    if (dup) E.push({ line: 0, msg: 'duplicate identifier ' + dup });
    let undef = [];
    const checkExpr = (expr, where) => { for (const id of identsOf(expr)) if (!known(id)) undef.push(id + ' (' + where + ')'); };
    pkg.funcs.forEach(f => checkExpr(f.expr, 'func ' + f.id)); pkg.flows.forEach(f => checkExpr(f.expr, 'flow ' + f.id)); pkg.observables.filter(o => o.kind === 'expr').forEach(o => checkExpr(o.expr, 'observe ' + o.id));
    undef = [...new Set(undef)];
    rule('defined', 'Every symbol used in an expression is declared', !undef.length, undef.join(', '));
    undef.forEach(u => E.push({ line: 0, msg: 'undefined symbol ' + u }));
    const badEnds = pkg.flows.filter(f => (f.from !== '*' && !comp.has(f.from)) || (f.to !== '*' && !comp.has(f.to)));
    rule('ends', 'Every flow connects declared compartments (or * for births/deaths)', !badEnds.length, badEnds.map(f => f.id).join(', '));
    badEnds.forEach(f => E.push({ line: f.line, msg: 'flow ' + f.id + ' uses an undeclared compartment' }));
    const absorbingOut = pkg.flows.filter(f => { const c = pkg.compartments.find(x => x.id === f.from); return c && c.absorbing; });
    rule('absorbing', 'No flow leaves an absorbing compartment', !absorbingOut.length, absorbingOut.map(f => f.id).join(', '));
    absorbingOut.forEach(f => E.push({ line: f.line, msg: 'flow out of absorbing compartment ' + f.from }));
    const initSum = pkg.compartments.reduce((a, c) => a + (c.init || 0), 0);
    rule('init', 'Initial values sum to 1 (proportions of the population)', Math.abs(initSum - 1) < 1e-6 || !pkg.compartments.length, 'sum = ' + initSum.toFixed(4));
    if (Math.abs(initSum - 1) >= 1e-6 && pkg.compartments.length) W.push('initial values sum to ' + initSum.toFixed(3) + ', not 1');
    const hasBirth = pkg.flows.some(f => f.from === '*'), hasDeath = pkg.flows.some(f => f.to === '*');
    rule('conserve', 'Population is conserved (no births/deaths, or both declared)', hasBirth === hasDeath, hasBirth !== hasDeath ? (hasBirth ? 'births without deaths' : 'deaths without births') : '', true);
    if (hasBirth !== hasDeath) W.push(hasBirth ? 'births declared without deaths: population grows without bound' : 'deaths declared without births: population shrinks');
    const outRange = pkg.params.filter(p => p.range && p.value != null && (p.value < p.range[0] || p.value > p.range[1]));
    rule('ranges', 'Every default lies inside its declared range', !outRange.length, outRange.map(p => p.id).join(', '));
    outRange.forEach(p => E.push({ line: 0, msg: 'param ' + p.id + ' default ' + p.value + ' is outside its range' }));
    const badFrac = pkg.params.filter(p => p.type === 'fraction' && p.value != null && (p.value < 0 || p.value > 1));
    rule('fractions', 'Every fraction lies in 0..1', !badFrac.length, badFrac.map(p => p.id).join(', '));
    badFrac.forEach(p => E.push({ line: 0, msg: 'fraction ' + p.id + ' is outside 0..1' }));
    const badDates = pkg.params.filter(p => p.campaign && (p.campaign.from < 1990 || p.campaign.from > 2100 || p.campaign.every <= 0));
    rule('dates', 'Campaign dates and intervals are sensible', !badDates.length, badDates.map(p => p.id).join(', '));
    badDates.forEach(p => E.push({ line: 0, msg: 'campaign ' + p.id + ' has an impossible date or interval' }));
    const unreached = pkg.compartments.filter(c => !pkg.flows.some(f => f.to === c.id) && c.init === 0);
    rule('reach', 'Every compartment can be reached (has an inflow or an initial value)', !unreached.length, unreached.map(c => c.id).join(', '), true);
    unreached.forEach(c => W.push('compartment ' + c.id + ' has no inflow and starts empty'));
    const noFlowObs = pkg.observables.filter(o => o.kind === 'flow' && o.flows.some(fl => !pkg.flows.some(f => f.id === fl)));
    rule('observe', 'Every observed flow exists', !noFlowObs.length, noFlowObs.map(o => o.id).join(', '));
    noFlowObs.forEach(o => E.push({ line: 0, msg: 'observe ' + o.id + ' refers to a flow that does not exist' }));
    const unannotated = pkg.params.filter(p => !p.tier || !p.label);
    rule('annotated', 'Every parameter has a label and a tier', !unannotated.length, unannotated.map(p => p.id).join(', '), true);
    for (const s of pkg.sets) for (const id in s.values) if (!par.has(id)) { E.push({ line: 0, msg: 'set "' + s.id + '" assigns unknown parameter ' + id }); }
    rule('sets', 'Every parameter set assigns declared parameters', !pkg.sets.some(s => Object.keys(s.values).some(id => !par.has(id))));
    pkg.valid = !E.length;
  }

  /* ---------- compile: package → right-hand side ---------- */
  function compileExpr(expr, ctx) {
    // ctx: {comp:Set, par:Set, funcs:Map(id→expr)}. Produces JS source that reads X[], P{}, t, year
    const ids = identsOf(expr);
    for (const id of ids) if (!(ctx.comp.has(id) || ctx.par.has(id) || ctx.funcs.has(id) || id in BUILTINS || id === 't' || id === 'year' || id === 'N')) throw new Error('undefined symbol ' + id);
    if (!/^[\sA-Za-z0-9_+\-*/().,]*$/.test(expr.replace(/\*\*/g, '^').replace(/\^/g, ''))) throw new Error('unsupported characters in expression');
    let js = expr.replace(/\*\*/g, '**');
    js = js.replace(/[A-Za-z_][A-Za-z0-9_]*/g, id => {
      if (ctx.comp.has(id)) return 'X[' + ctx.compIndex[id] + ']';
      if (ctx.par.has(id)) return 'P.' + id;
      if (ctx.funcs.has(id)) return '(' + compileExpr(ctx.funcs.get(id), ctx) + ')';
      if (id === 'N') return '(' + ctx.compartments.map((c, i) => 'X[' + i + ']').join('+') + ')';
      if (id === 'pi') return 'Math.PI';
      if (id in BUILTINS) return 'B.' + id;
      return id; // t, year
    });
    return js;
  }
  function compile(pkg) {
    const ctx = { comp: new Set(pkg.compartments.map(c => c.id)), par: new Set(pkg.params.map(p => p.id)), funcs: new Map(pkg.funcs.map(f => [f.id, f.expr])), compIndex: {}, compartments: pkg.compartments };
    pkg.compartments.forEach((c, i) => { ctx.compIndex[c.id] = i; });
    const n = pkg.compartments.length;
    const flowJs = pkg.flows.map(f => compileExpr(f.expr, ctx));
    const obsFlows = pkg.observables.filter(o => o.kind === 'flow').map(o => o.flows.map(fl => pkg.flows.findIndex(f => f.id === fl)));
    const obsExpr = pkg.observables.filter(o => o.kind === 'expr').map(o => compileExpr(o.expr, ctx));
    let body = '';
    flowJs.forEach((js, i) => { body += 'F[' + i + '] = ' + js + ';\n'; });
    body += 'for (let i = 0;i < ' + n + ';i++) D[i] = 0;\n';
    pkg.flows.forEach((f, i) => { if (f.from !== '*') body += 'D[' + ctx.compIndex[f.from] + '] -= F[' + i + '];\n'; if (f.to !== '*') body += 'D[' + ctx.compIndex[f.to] + '] += F[' + i + '];\n'; });
    obsFlows.forEach((fis, j) => { body += 'D[' + (n + j) + '] = ' + fis.map(fi => 'F[' + fi + ']').join(' + ') + ';\n'; });
    body += 'return F;';
    const F = new Float64Array(pkg.flows.length);
    const rhsInner = new Function('X', 'D', 'P', 't', 'year', 'B', 'F', body); // eslint-disable-line no-new-func
    const rhs = (X, D, P, t, year, B) => rhsInner(X, D, P, t, year, B, F);
    const obsFn = new Function('X', 'P', 't', 'year', 'B', 'return [' + obsExpr.join(',') + '];'); // eslint-disable-line no-new-func
    return { rhs, obsFn, n, nObsFlow: obsFlows.length, flowLabels: pkg.flows.map(f => f.label) };
  }

  /* ---------- campaigns: protection(t) from rounds ---------- */
  function campaignValue(cf, year) {
    if (!cf || !cf.coverage || !cf.peak) return 0;
    const every = Math.max(cf.every || 1, 1 / 12), m = (cf.month || 0) / 12;
    let last = null; for (let y = cf.from + m; y <= year + 1e-9; y += every) last = y;
    if (last == null) return 0;
    return cf.coverage * cf.peak * Math.exp(-(cf.decay || 0) * (year - last));
  }

  /* ---------- run: RK4 over the horizon. Monthly outputs ---------- */
  function run(pkg, compiled, opts) {
    // opts: { overrides:{id:value|campaignFields}, set:name|null, startYear, endYear, dt(days) }
    const P = {}; for (const p of pkg.params) P[p.id] = p.campaign ? Object.assign({}, p.campaign) : p.value;
    if (opts.set) { const s = pkg.sets.find(x => x.id === opts.set); if (s) for (const id in s.values) P[id] = s.values[id]; }
    if (opts.overrides) for (const id in opts.overrides) { const v = opts.overrides[id]; if (v == null) continue; if (P[id] && typeof P[id] === 'object' && typeof v === 'object') Object.assign(P[id], v); else P[id] = v; }
    const camp = pkg.params.filter(p => p.campaign).map(p => p.id);
    const start = opts.startYear != null ? opts.startYear : (pkg.model.start || 0), end = opts.endYear != null ? opts.endYear : start + 5;
    const days = Math.round((end - start) * 365), dt = opts.dt || 1;
    const n = compiled.n, m = n + compiled.nObsFlow;
    let X = new Float64Array(m); pkg.compartments.forEach((c, i) => { X[i] = c.init; });
    const Pt = Object.assign({}, P); const B = BUILTINS;
    const k1 = new Float64Array(m), k2 = new Float64Array(m), k3 = new Float64Array(m), k4 = new Float64Array(m), tmp = new Float64Array(m);
    const evalP = t => { const yr = start + t / 365; for (const id of camp) Pt[id] = campaignValue(P[id], yr); return yr; };
    const f = (t, Y, D) => { const yr = evalP(t); compiled.rhs(Y, D, Pt, t, yr, B); };
    const months = []; const nextMonth = () => months.length * (365 / 12);
    const obsFlowIdx = pkg.observables.map((o, j) => o.kind === 'flow' ? n + pkg.observables.filter((q, i) => i < j && q.kind === 'flow').length : -1);
    let lastFlow = new Float64Array(m);
    const record = t => {
      const yr = evalP(t); const ex = compiled.obsFn(X, Pt, t, yr, B); let ei = 0;
      const row = { t: start + t / 365, comp: Array.from(X.slice(0, n)), obs: [] };
      pkg.observables.forEach((o, j) => { if (o.kind === 'flow') { row.obs.push(X[obsFlowIdx[j]] - lastFlow[obsFlowIdx[j]]); } else row.obs.push(ex[ei++]); });
      lastFlow = Float64Array.from(X); months.push(row);
    };
    record(0);
    for (let t = 0; t < days; t += dt) {
      f(t, X, k1); for (let i = 0; i < m; i++) tmp[i] = X[i] + 0.5 * dt * k1[i];
      f(t + 0.5 * dt, tmp, k2); for (let i = 0; i < m; i++) tmp[i] = X[i] + 0.5 * dt * k2[i];
      f(t + 0.5 * dt, tmp, k3); for (let i = 0; i < m; i++) tmp[i] = X[i] + dt * k3[i];
      f(t + dt, tmp, k4); for (let i = 0; i < m; i++) { X[i] += dt / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]); if (i < n && X[i] < 0) X[i] = 0; }
      if (t + dt >= nextMonth() - 1e-9) record(t + dt);
    }
    // campaign timeline for charts
    const events = camp.map(id => ({ id, rounds: (() => { const cf = P[id]; const out = []; if (!cf.coverage) return out; for (let y = cf.from + (cf.month || 0) / 12; y <= end; y += Math.max(cf.every, 1 / 12)) if (y >= start) out.push(y); return out; })() }));
    return { months, params: Pt, start, end, events };
  }

  /* ---------- Latin hypercube over the varied tier ---------- */
  function lhs(pkg, nDraws, seed, pins) {
    const varied = pkg.params.filter(p => p.tier === 'varied' && p.range && !(pins && pins[p.id] != null));
    let s = seed >>> 0 || 1; const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    const draws = []; for (let d = 0; d < nDraws; d++) draws.push({});
    for (const p of varied) {
      const perm = Array.from({ length: nDraws }, (_, i) => i); for (let i = nDraws - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
      for (let d = 0; d < nDraws; d++) draws[d][p.id] = p.range[0] + (perm[d] + rnd()) / nDraws * (p.range[1] - p.range[0]);
    }
    return { draws, varied: varied.map(p => p.id) };
  }
  function quantiles(arr, qs) { const s = arr.slice().sort((a, b) => a - b); return qs.map(q => { const pos = (s.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos); return s[lo] + (s[hi] - s[lo]) * (pos - lo); }); }

  /* ---------- schematic layout: layers by longest path from sources ---------- */
  function layout(pkg) {
    const ids = pkg.compartments.map(c => c.id); const idx = {}; ids.forEach((id, i) => { idx[id] = i; });
    const edges = pkg.flows.filter(f => f.from !== '*' && f.to !== '*').map(f => [idx[f.from], idx[f.to]]);
    const depth = ids.map(() => 0);
    for (let iter = 0; iter < ids.length; iter++) for (const [a, b] of edges) if (a !== b && depth[b] < depth[a] + 1 && !(ids.length > 2 && isBack(a, b))) depth[b] = depth[a] + 1;
    function isBack(a, b) { return pkg.compartments[b].init > 0.5 && pkg.compartments[a].init <= 0.5; }
    const cols = {}; ids.forEach((id, i) => { (cols[depth[i]] = cols[depth[i]] || []).push(i); });
    const pos = ids.map(() => ({ x: 0, y: 0 }));
    Object.keys(cols).forEach(d => { cols[d].forEach((i, r) => { pos[i] = { col: +d, row: r, nrows: cols[d].length }; }); });
    return { pos, ncols: Object.keys(cols).length };
  }

  return { fromPackage, validate, compile, run, lhs, quantiles, layout, campaignValue, hash, TIERS, TYPES, identsOf };
});
