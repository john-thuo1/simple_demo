function sameCountyScenarios(ctx) { const ch = chartedScenarios(); return ctx.all.filter(x => x.s.inputs.county === ctx.s.inputs.county && (ch.includes(x.s) || x.s === ctx.s)); }
function mkData(xs, cols) { return { xs, cols }; }
function bandsFor(res, key, color) {
  const b = []; const S = res.sim.series[key];
  if (state.bands.b90) b.push({ lo: S.q05, hi: S.q95, opacity: 0.10 });
  if (state.bands.b50) b.push({ lo: S.q25, hi: S.q75, opacity: 0.18 });
  if (res.execution.mode === 'emulator') { const e = res.execution.approxError; b.push({ lo: S.median.map(v => v * (1 - e)), hi: S.median.map(v => v * (1 + e)), opacity: 0.06, hatch: true }); }
  return b;
}
function setList(ctx) {
  const i = ctx.inputs, c = ctx.county, p = E.PRODUCTS[i.product];
  return [
    ['County', c.name + ' · ' + MSE.GROUPS[c.group]],
    ['Nets', p.short + ' · access ' + fmt.pct(i.access) + ' × usage ' + fmt.pct(i.usage) + ' · campaign ' + i.campaignYear + ', every ' + i.interval + ' y'],
    ['IRS', i.irsMode === 'maintain' ? 'yearly from 2027 · ' + fmt.pct(i.irsCoverage) + ' coverage · ' + MSE.MONTHS[i.irsMonth] : (c.irsHistory ? 'rounds 2024–2026, stopped from 2027' : 'none')],
    ['Treatment', fmt.pct(i.pt) + ' of uncomplicated cases' + (state.view === 'normal' ? '' : ' (p_t)')],
    ['Vaccination', fmt.pct(i.cv) + ' of under-fives per year' + (state.view === 'normal' ? '' : ' (c_v)')],
    ['Horizon', String(i.horizon)],
  ];
}
function variedList(ctx) {
  const p = ctx.pins; const out = [];
  out.push(['Net efficacy', p.itnEff != null ? 'pinned ×' + p.itnEff : MSE.RANGE_TEXT.itnEff + ' of the product curve']);
  if (ctx.inputs.irsMode === 'maintain' || ctx.county.irsHistory) out.push(['IRS efficacy', p.irsEff != null ? 'pinned ×' + p.irsEff : MSE.RANGE_TEXT.irsEff]);
  out.push(['Biting rate a', p.a != null ? 'pinned ' + p.a : MSE.RANGE_TEXT.a]);
  out.push(['Loss of immunity', p.rho != null ? 'pinned ' + Math.round(1 / p.rho) + ' days' : MSE.RANGE_TEXT.rho]);
  return out;
}
function advList(ctx) { const o = []; for (const f of MSE.ADV_FIELDS) { const v = ctx.advanced[f.id]; if (v != null && v !== f.def(ctx.county)) o.push([f.sym, v + ' (fitted ' + (+f.def(ctx.county).toFixed(4)) + ')']); } return o; }
function briefSetting(ctx) { const i = ctx.inputs, c = ctx.county, p = E.PRODUCTS[i.product]; return c.name + ' · ' + p.short + ' · ' + fmt.pct(i.access) + ' × ' + fmt.pct(i.usage) + ' · campaign ' + i.campaignYear + ' · ' + (i.irsMode === 'maintain' ? 'IRS yearly ' + fmt.pct(i.irsCoverage) : (c.irsHistory ? 'IRS stopped' : 'no IRS')) + ' · p_t ' + fmt.pct(i.pt) + ' · c_v ' + fmt.pct(i.cv) + ' · to ' + i.horizon; }
function asideBlock(ctx, extra) {
  const a = el('div', { class: 'aside' }); extra = extra || {};
  if (extra.measures) { a.append(el('h3', { text: 'What this chart measures' })); a.append(el('p', { text: extra.measures })); }
  if (extra.brief) {
    // later charts do not repeat what is varied: it is listed once, on the first chart, for the Modeller
  } else {
    // the scenario's own settings are not repeated here: they are the chips at the top of the scenario (18 Nov 2026)
    if (extra.varied !== false && ctx.view !== 'normal') { a.append(el('h3', { text: 'Varied inputs · shown in bands' })); const d3 = el('dl'); for (const [k, v] of variedList(ctx)) d3.append(el('dt', { text: k }), el('dd', { text: v })); a.append(d3); }
  }
  return a;
}
function monthsLabels(t, lo, hi) { const out = []; for (let k = 0; k < t.length; k++) if (t[k] >= lo - 1e-9 && t[k] < hi - 1e-9) out.push(k); return out; }
function sliceIdx(arr, idx) { return idx.map(k => arr[k]); }
function baseContext(ctx, chartTitle, measures) {
  const r = ctx.res, S = r.summary, i = ctx.inputs, c = ctx.county, h = i.horizon;
  const lines = [];
  lines.push('Tool: Malaria Scenario Explorer (prototype). Engine: stand-in with the structure of the CEMA county model. Illustrative county profiles shaped to the magnitudes shown on 2 Oct 2026. Not the fitted model, not a forecast.');
  if (window.EXT && window.EXT.familyLine) lines.push(window.EXT.familyLine());
  lines.push('Audience: ' + (ctx.view === 'normal' ? 'a programme user without modelling expertise' : ctx.view === 'student' ? 'a student learning malaria modelling' : 'a researcher who knows the model'));
  lines.push('Chart: ' + chartTitle + '. ' + measures);
  lines.push('Scenario ' + ctx.s.id + ' "' + scenarioName(ctx.s) + '": ' + setList(ctx).map(x => x[0] + ' = ' + x[1]).join(' · ') + '.');
  lines.push('Baseline for comparison: PBO nets at current county coverage (access ' + fmt.pct(c.access) + ', usage ' + fmt.pct(c.usage) + '), campaigns from 2027 every 3 years, ' + (c.irsHistory ? 'IRS stopped after 2026' : 'no IRS') + ', treatment ' + fmt.pct(c.pt) + ', vaccination ' + fmt.pct(c.cv) + '.');
  const adv = advList(ctx); lines.push('Advanced overrides: ' + (adv.length ? adv.map(x => x[0] + ' = ' + x[1]).join(' · ') : 'none (fitted values)') + '.');
  lines.push('Varied inputs (source of the bands, ' + MSE.N_DRAWS + ' stratified draws): ' + variedList(ctx).map(x => x[0] + ' ' + x[1]).join(' · ') + '.');
  lines.push('Computed for 2027–' + h + ': outpatient-treated cases median ' + fmt.int(S.cases.median) + ' (90% range ' + fmt.int(S.cases.q05) + '–' + fmt.int(S.cases.q95) + '). Baseline median ' + fmt.int(S.baseCases.median) + '. Cases averted vs baseline median ' + fmt.int(S.averted.median) + ' (' + fmt.pct(S.avertedPct.median, 1) + '. 90% range ' + fmt.pct(S.avertedPct.q05, 1) + ' to ' + fmt.pct(S.avertedPct.q95, 1) + '). Severe episodes median ' + fmt.int(S.severe.median) + '. Peak month ' + fmt.ym(S.peak.t) + ' at ' + fmt.int(S.peak.value) + ' cases. Mean share infected in ' + h + ': ' + fmt.pct(S.prevEnd, 1) + ' (baseline ' + fmt.pct(S.bprevEnd, 1) + ').');
  lines.push('Execution: mode ' + r.execution.mode + (r.execution.mode === 'emulator' ? ' (approximation error ±5%, reported separately from model uncertainty)' : '') + '. Model ' + E.MODEL_VERSION + '.');
  lines.push('Assumptions and limits: deterministic extended SEIR at county level. Seasonal force of infection seas(t) = 1 + αβ·cos(2π(t−φ)). Mosquito population at equilibrium. No superinfection. Closed population. Vaccinated children partially protected (ε). Temporary immunity after recovery (ρ). Vector control enters as λ × (1 − E_net·access·usage) × (1 − E_IRS·coverage) with product-specific net decay that resets at each campaign and IRS decaying within a year. Costs are illustrative unit costs.');
  return lines;
}

const FIGS = [
  {
    group: 'results', id: 'cases', title: 'Monthly outpatient-treated malaria cases', unit: 'cases per month · county total', views: ['normal', 'student', 'researcher'],
    measures: 'New outpatient-treated malaria cases each month, the quantity the model was fitted to. Lines are medians. Bands show where the runs fall.',
    render(chartEl, ctx) {
      const t = ctx.res.t; const h = ctx.inputs.horizon; const sc = sameCountyScenarios(ctx);
      const series = [];
      if (state.showBaseline) series.push({ name: 'Baseline (PBO nets, ' + (ctx.county.irsHistory ? 'IRS stopped' : 'no IRS') + ')', color: 'var(--muted)', values: ctx.res.base.series.treated.median, dash: '5 4', width: 1.5 });
      for (const o of sc) {
        const isA = o.s.id === ctx.s.id;
        series.push({ name: 'Scenario ' + o.s.id + (isA ? '' : ' · ' + scenarioName(o.s)), color: scenarioColor(o.s), values: o.res.sim.series.treated.median, width: isA ? 2.2 : 1.6, opacity: isA ? 1 : .8, bands: isA ? bandsFor(o.res, 'treated', scenarioColor(o.s)) : null, endLabel: o.s.id });
      }
      lineChart(chartEl, { x: t, xDomain: [2024, h + 1], series, height: 250, endLabels: true, markers: [{ x: ctx.inputs.campaignYear, label: 'Next campaign' + (ctx.county.irsHistory ? ' · IRS decision' : '') }], yTitle: 'cases / month', aria: 'Monthly outpatient-treated cases by scenario' });
      const items = series.map(s => ({ name: s.name.replace(/ · .*/, ''), color: s.color, kind: s.dash ? 'dash' : 'line' }));
      chartEl.append(legend(items, [
        { id: 'tg-b50-' + ctx.s.id, label: '50% band', checked: state.bands.b50, onChange: v => { state.bands.b50 = v; renderFigures(); } },
        { id: 'tg-b90-' + ctx.s.id, label: '90% band', checked: state.bands.b90, onChange: v => { state.bands.b90 = v; renderFigures(); } },
        { id: 'tg-base-' + ctx.s.id, label: 'Baseline', checked: state.showBaseline, onChange: v => { state.showBaseline = v; renderFigures(); } },
      ]));
    },
    aside(ctx) { return asideBlock(ctx, { measures: this.measures }); },
    data(ctx) { const t = ctx.res.t; const idx = monthsLabels(t, 2024, ctx.inputs.horizon + 1); const cols = [{ name: 'Baseline', values: sliceIdx(ctx.res.base.series.treated.median, idx) }]; for (const o of sameCountyScenarios(ctx)) { cols.push({ name: o.s.id + ' median', values: sliceIdx(o.res.sim.series.treated.median, idx) }); if (o.s.id === ctx.s.id) { cols.push({ name: o.s.id + ' 5%', values: sliceIdx(o.res.sim.series.treated.q05, idx) }, { name: o.s.id + ' 95%', values: sliceIdx(o.res.sim.series.treated.q95, idx) }); } } return mkData(idx.map(k => fmt.ym(t[k])), cols); },
    questions: ['Why do cases change after 2027?', 'Why is the band wider in some years?', 'What does the baseline represent?'],
    context(ctx) { return baseContext(ctx, this.title, this.measures); },
    prepared(q, ctx) {
      const S = ctx.res.summary, i = ctx.inputs, p = E.PRODUCTS[i.product];
      if (/after 2027/i.test(q)) return 'In ' + i.campaignYear + ' the model resets net efficacy to the ' + p.short + ' peak (' + p.peak.toFixed(2) + ') and then lets it decay' + (i.irsMode === 'maintain' ? ', and each yearly IRS round adds a short, strong drop in the force of infection' : (ctx.county.irsHistory ? ', while the IRS protection from the 2024–2026 rounds fades away' : '')) + '. Fewer infections mean fewer people reach the uncomplicated and treated classes, so monthly treated cases fall relative to the baseline: over 2027–' + i.horizon + ' the median is ' + fmt.int(S.cases.median) + ' against ' + fmt.int(S.baseCases.median) + ' (' + fmt.pct(S.avertedPct.median, 1) + ' fewer). The size of the change depends on the assumed efficacy curve, access × usage and the county\'s transmission level.';
      if (/band/i.test(q)) return 'The band collects ' + MSE.N_DRAWS + ' runs in which the tool varied net efficacy within the product\'s range, IRS efficacy, the biting rate and the duration of immunity. Right after a campaign the runs disagree most about how well the new nets work, so the band is widest there. As efficacy decays the runs converge and the band narrows. Seasonal peaks also scale the spread, because the same relative uncertainty is larger in absolute cases at the peak.';
      if (/baseline/i.test(q)) return 'The baseline continues the county\'s current strategy: PBO nets at current access (' + fmt.pct(ctx.county.access) + ') and usage (' + fmt.pct(ctx.county.usage) + '), campaigns from 2027 every three years, ' + (ctx.county.irsHistory ? 'IRS stopped after 2026' : 'no IRS') + ', and current treatment and vaccination coverage. It is run with the same parameter draws as the scenario, so "cases averted" compares like with like.';
      return null;
    },
  },
  {
    group: 'results', id: 'totals', title: 'Cases 2027 to horizon, by scenario', unit: 'outpatient-treated cases · total over the window', views: ['normal', 'student', 'researcher'],
    measures: 'Total outpatient-treated cases from 2027 to the end of the horizon for each scenario, with the reduction against the baseline.',
    render(chartEl, ctx) {
      const sc = sameCountyScenarios(ctx); const S = ctx.res.summary;
      const cats = [{ label: ['Baseline', 'PBO · ' + (ctx.county.irsHistory ? 'IRS stopped' : 'no IRS')], value: S.baseCases.median, color: 'var(--muted)' }];
      for (const o of sc) cats.push({ label: ['Scenario ' + o.s.id, E.PRODUCTS[o.s.inputs.product].short + ' · ' + (o.s.inputs.irsMode === 'maintain' ? 'IRS yearly' : (ctx.county.irsHistory ? 'IRS stopped' : 'no IRS'))], value: o.res.summary.cases.median, color: scenarioColor(o.s), note: fmt.signedPct(-o.res.summary.avertedPct.median, 1) + ' vs baseline', noteColor: o.res.summary.avertedPct.median > 0 ? 'var(--good-text)' : 'var(--crit)', tipNote: '90% range ' + fmt.int(o.res.summary.cases.q05) + '–' + fmt.int(o.res.summary.cases.q95) });
      barChart(chartEl, { categories: cats, height: 230, noteRow: true, labelRows: true, valueName: 'Cases 2027–' + ctx.inputs.horizon, aria: 'Total cases by scenario' });
    },
    aside(ctx) { return asideBlock(ctx, { measures: this.measures, brief: true }); },
    data(ctx) { const sc = sameCountyScenarios(ctx); const rows = [['Baseline', ctx.res.summary.baseCases]].concat(sc.map(o => ['Scenario ' + o.s.id, o.res.summary.cases])); return mkData(rows.map(r => r[0]), [{ name: 'median', values: rows.map(r => r[1].median) }, { name: '5%', values: rows.map(r => r[1].q05) }, { name: '95%', values: rows.map(r => r[1].q95) }]); },
    questions: ['How is the reduction calculated?', 'Why do counties respond differently?', 'Is a bigger reduction always better?'],
    context(ctx) { return baseContext(ctx, this.title, this.measures); },
    prepared(q, ctx) {
      const S = ctx.res.summary;
      if (/calculated/i.test(q)) return 'For each of the ' + MSE.N_DRAWS + ' runs the tool adds up monthly treated cases from January 2027 to December ' + ctx.inputs.horizon + ' for the scenario and for the baseline run with the same parameter draw, takes the difference, and reports the median and the 5th–95th percentiles across runs: ' + fmt.int(S.averted.median) + ' cases averted (' + fmt.int(S.averted.q05) + '–' + fmt.int(S.averted.q95) + '). Pairing the draws removes the uncertainty that both runs share.';
      if (/counties/i.test(q)) return 'Each county profile carries its own fitted transmission level (m), seasonality and coverage. Where transmission is lower, the same protection pushes the force of infection closer to the point where cases fall steeply. Where transmission is high, infections saturate and the same protection removes a smaller share, even though absolute numbers can still be large. This is the pattern the modelling team described for high- and low-burden counties.';
      if (/better/i.test(q)) return 'The chart only reports simulated cases. It does not weigh cost, feasibility or side effects, and the stand-in numbers are illustrative. The costs chart adds illustrative unit costs. A judgement about strategy belongs to the programme and the modelling team, not to this chart.';
      return null;
    },
  },
  {
    group: 'why', id: 'protection', title: 'Protection from nets and spraying over time', unit: 'protective efficacy · 0 to 1', views: ['normal', 'student', 'researcher'],
    measures: 'Top: the efficacy curve of each net product, which resets at every campaign and decays until the next. Bottom: IRS protection (efficacy × coverage) after each spray round, for the schedule set and for the alternative.',
    render(chartEl, ctx) {
      const i = ctx.inputs, c = ctx.county, h = i.horizon;
      const x = []; for (let t = 2015; t < h + 1; t += 1 / 24) x.push(+t.toFixed(4));
      const series = [];
      for (const pid of MSE.PRODUCT_ORDER) {
        const inp = Object.assign({}, i, { product: pid }); const camps = E.campaignsFor(inp);
        const vals = x.map(t => E.itnEfficacy(t, camps, 1, 1));
        const chosen = pid === i.product;
        series.push({ name: E.PRODUCTS[pid].short, color: MSE.PRODUCT_COLOR[pid], values: vals, width: chosen ? 2.4 : 1.2, opacity: chosen ? 1 : .55, dash: chosen ? null : (pid === 'pyrethroid' ? '4 3' : null) });
      }
      const top = el('div', { class: 'chart' }); const bottom = el('div', { class: 'chart' });
      chartEl.innerHTML = ''; chartEl.append(el('p', { class: 'small muted', text: 'Net efficacy by product (bold = the product set in this scenario)' }), top, el('p', { class: 'small muted', style: 'margin-top:6px', text: 'IRS protection = efficacy × coverage' }), bottom);
      lineChart(top, { x, xDomain: [2015, h + 1], series, height: 190, yMax: 0.6, yFmt: v => v.toFixed(1), tipFmt: v => v.toFixed(2), xLabel: t => fmt.ym(t), markers: [{ x: i.campaignYear, label: 'Dual ITN · ' + i.campaignYear }], aria: 'Net efficacy by product over time' });
      top.append(legend(MSE.PRODUCT_ORDER.map(pid => ({ name: E.PRODUCTS[pid].short, color: MSE.PRODUCT_COLOR[pid], kind: pid === 'pyrethroid' ? 'dash' : 'line' }))));
      const cur = Object.assign({}, i, { irsOn: i.irsMode === 'maintain' }); const alt = Object.assign({}, i, { irsMode: i.irsMode === 'maintain' ? 'stop' : 'maintain', irsOn: i.irsMode !== 'maintain', irsCoverage: i.irsCoverage });
      const rc = E.irsRoundsFor(cur, c), ra = E.irsRoundsFor(alt, c);
      const vc = x.map(t => rc.length ? E.irsEfficacy(t, rc, 1) : 0), va = x.map(t => ra.length ? E.irsEfficacy(t, ra, 1) : 0);
      const s2 = [{ name: 'As set: ' + (i.irsMode === 'maintain' ? 'maintained yearly' : (c.irsHistory ? 'stopped after 2026' : 'no IRS')), color: 'var(--s1)', values: vc, width: 2.2 }, { name: 'Alternative: ' + (i.irsMode === 'maintain' ? (c.irsHistory ? 'stopped after 2026' : 'no IRS') : 'maintained yearly at ' + fmt.pct(i.irsCoverage)), color: 'var(--muted)', values: va, dash: '5 4', width: 1.5 }];
      lineChart(bottom, { x, xDomain: [2015, h + 1], series: s2, height: 170, yMax: 0.5, yFmt: v => v.toFixed(1), tipFmt: v => v.toFixed(2), xLabel: t => fmt.ym(t), markers: [{ x: 2027, label: 'Decision on IRS · 2027' }], aria: 'IRS protection over time' });
      bottom.append(legend(s2.map(s => ({ name: s.name, color: s.color, kind: s.dash ? 'dash' : 'line' }))));
    },
    aside(ctx) { const a = asideBlock(ctx, { measures: this.measures, varied: false, brief: true }); const p = E.PRODUCTS[ctx.inputs.product]; const d = el('dl'); d.append(el('dt', { text: 'Product' }), el('dd', { text: p.label }), el('dt', { text: 'Peak efficacy' }), el('dd', { text: p.peak.toFixed(2) + ' (varied ' + MSE.RANGE_TEXT.itnEff + ' in runs)' }), el('dt', { text: 'Decay' }), el('dd', { text: p.k.toFixed(2) + ' per year (half-life ' + (Math.log(2) / p.k).toFixed(1) + ' y)' }), el('dt', { text: 'IRS peak' }), el('dd', { text: E.IRS.peak.toFixed(2) + ', decays within the year' })); a.append(el('h3', { text: 'Curves in use' }), d); return a; },
    data(ctx) { const i = ctx.inputs; const x = []; for (let t = 2015; t < i.horizon + 1; t += 1 / 12) x.push(+t.toFixed(4)); const cols = MSE.PRODUCT_ORDER.map(pid => { const camps = E.campaignsFor(Object.assign({}, i, { product: pid })); return { name: E.PRODUCTS[pid].short, values: x.map(t => E.itnEfficacy(t, camps, 1, 1)), fmt: v => v.toFixed(3) }; }); const rc = E.irsRoundsFor(Object.assign({}, i, { irsOn: i.irsMode === 'maintain' }), ctx.county); cols.push({ name: 'IRS as set', values: x.map(t => rc.length ? E.irsEfficacy(t, rc, 1) : 0), fmt: v => v.toFixed(3) }); return mkData(x.map(fmt.ym), cols); },
    questions: ['Why does the curve jump every three years?', 'Why do the products differ after 2027?', 'How does coverage enter?'],
    context(ctx) { const p = E.PRODUCTS[ctx.inputs.product]; return baseContext(ctx, this.title, this.measures).concat(['Product curves (peak, decay per year): ' + MSE.PRODUCT_ORDER.map(pid => E.PRODUCTS[pid].short + ' ' + E.PRODUCTS[pid].peak.toFixed(2) + ', ' + E.PRODUCTS[pid].k.toFixed(2)).join(' · ') + '. Chosen: ' + p.short + '. IRS peak ' + E.IRS.peak + ', decay ' + E.IRS.k + ' per year.']); },
    prepared(q, ctx) {
      const p = E.PRODUCTS[ctx.inputs.product];
      if (/jump|three/i.test(q)) return 'Each mass campaign replaces the nets, so the model resets efficacy to the product\'s peak (' + p.peak.toFixed(2) + ' for ' + p.short + '). Between campaigns the nets wear, lose insecticide and are lost, which the model represents as an exponential decay with a half-life of about ' + (Math.log(2) / p.k).toFixed(1) + ' years. The historical campaigns in 2015, 2018, 2021 and 2024 and the schedule from ' + ctx.inputs.campaignYear + ' every ' + ctx.inputs.interval + ' years fix where the jumps are.';
      if (/products|differ/i.test(q)) return 'Until the next campaign every scenario shares the same history (pyrethroid nets, then PBO nets from 2024). From ' + ctx.inputs.campaignYear + ' the chosen product\'s own curve applies. Dual-active-ingredient nets start higher and decay more slowly in these illustrative curves. Pyrethroid-only nets start low because of insecticide resistance. The curves are placeholders shaped after the modelling team\'s figure and will be replaced by theirs.';
      if (/coverage/i.test(q)) return 'Efficacy is what a net does for the person under it. The model multiplies it by access (share of people with a net) and usage (share of those who sleep under it) to get the protection applied to the whole population, here ' + fmt.pct(ctx.inputs.access) + ' × ' + fmt.pct(ctx.inputs.usage) + ' = ' + fmt.pct(ctx.inputs.access * ctx.inputs.usage) + '. IRS works the same way with efficacy × households sprayed.';
      return null;
    },
  },
  {
    group: 'why', id: 'prevalence', title: 'Share of the population infected', unit: 'proportion infected (asymptomatic, uncomplicated, severe and treated) · monthly mean', views: ['normal', 'student', 'researcher'],
    measures: 'Prevalence of infection in the model: everyone in the I_a, I_un, I_sev and T classes as a share of the population.',
    render(chartEl, ctx) {
      const t = ctx.res.t, h = ctx.inputs.horizon; const sc = sameCountyScenarios(ctx); const series = [];
      if (state.showBaseline) series.push({ name: 'Baseline', color: 'var(--muted)', values: ctx.res.base.series.prev.median, dash: '5 4', width: 1.5 });
      for (const o of sc) { const isA = o.s.id === ctx.s.id; series.push({ name: 'Scenario ' + o.s.id, color: scenarioColor(o.s), values: o.res.sim.series.prev.median, width: isA ? 2.2 : 1.4, opacity: isA ? 1 : .8, bands: isA ? bandsFor(o.res, 'prev') : null, endLabel: o.s.id }); }
      lineChart(chartEl, { x: t, xDomain: [2024, h + 1], series, height: 220, endLabels: true, yFmt: v => fmt.pct(v, 0), tipFmt: v => fmt.pct(v, 1), markers: [{ x: ctx.inputs.campaignYear, label: 'Next campaign' }], aria: 'Share infected by scenario' });
      chartEl.append(legend(series.map(s => ({ name: s.name, color: s.color, kind: s.dash ? 'dash' : 'line' }))));
    },
    aside(ctx) { return asideBlock(ctx, { measures: this.measures, brief: true }); },
    data(ctx) { const t = ctx.res.t; const idx = monthsLabels(t, 2024, ctx.inputs.horizon + 1); const cols = [{ name: 'Baseline', values: sliceIdx(ctx.res.base.series.prev.median, idx), fmt: v => fmt.pct(v, 2) }]; for (const o of sameCountyScenarios(ctx)) cols.push({ name: o.s.id + ' median', values: sliceIdx(o.res.sim.series.prev.median, idx), fmt: v => fmt.pct(v, 2) }); return mkData(idx.map(k => fmt.ym(t[k])), cols); },
    questions: ['Why does prevalence fall more slowly than cases?', 'Who counts as infected here?', 'Why does prevalence lag the season?'],
    context(ctx) { return baseContext(ctx, this.title, this.measures); },
    prepared(q, ctx) {
      if (/slowly/i.test(q)) return 'Treated cases are a flow: they respond as soon as the force of infection drops. Prevalence is a stock: asymptomatic infections clear at rate δ (about ' + Math.round(1 / E.FIXED.delta) + ' days on average), so the pool of carriers drains gradually after protection improves. That is why the prevalence line bends later and more gently than the cases line.';
      if (/who counts/i.test(q)) return 'Everyone in the asymptomatic (I_a), uncomplicated (I_un), severe (I_sev) and treated (T) classes. Exposed people (E), who are infected but not yet infectious, are not counted. Because p_a = ' + E.FIXED.p_a + ' of infections are asymptomatic and they last longest, I_a dominates the stock.';
      if (/lag/i.test(q)) return 'seas(t) peaks at φ = ' + (ctx.advanced.phi != null ? ctx.advanced.phi : ctx.county.phi) + ' of the year. New infections follow the force of infection with the human incubation delay (1/γ_h ≈ 10 days), and the infected stock then builds up over the following weeks, so prevalence peaks some weeks after transmission does.';
      return null;
    },
  },
  {
    group: 'why', id: 'severity', title: 'Monthly cases by severity', unit: 'episodes per month · active scenario · median run', views: ['normal', 'student', 'researcher'],
    measures: 'Monthly episodes in the active scenario split into severe, uncomplicated treated at the outpatient clinic, and uncomplicated not treated (median run).',
    render(chartEl, ctx) {
      const t = ctx.res.t, h = ctx.inputs.horizon; const S = ctx.res.sim.series;
      const untreated = S.uncomp.median.map((v, k) => Math.max(0, v - S.treated.median[k]));
      stackedArea(chartEl, { x: t, xDomain: [2024, h + 1], height: 220, layers: [
        { name: 'Severe (I_sev)', color: 'var(--seq4)', values: S.severe.median },
        { name: 'Uncomplicated, treated (T)', color: 'var(--seq3)', values: S.treated.median },
        { name: 'Uncomplicated, not treated', color: 'var(--seq2)', values: untreated },
      ], markers: [{ x: ctx.inputs.campaignYear, label: 'Next campaign' }], aria: 'Monthly cases by severity' });
      chartEl.append(legend([{ name: 'Severe', color: 'var(--seq4)', kind: 'box' }, { name: 'Uncomplicated, treated', color: 'var(--seq3)', kind: 'box' }, { name: 'Uncomplicated, not treated', color: 'var(--seq2)', kind: 'box' }]));
    },
    aside(ctx) { return asideBlock(ctx, { measures: this.measures, varied: false, brief: true }); },
    data(ctx) { const t = ctx.res.t; const idx = monthsLabels(t, 2024, ctx.inputs.horizon + 1); const S = ctx.res.sim.series; return mkData(idx.map(k => fmt.ym(t[k])), [{ name: 'Severe', values: sliceIdx(S.severe.median, idx) }, { name: 'Treated', values: sliceIdx(S.treated.median, idx) }, { name: 'Uncomplicated (all)', values: sliceIdx(S.uncomp.median, idx) }, { name: 'Asymptomatic', values: sliceIdx(S.asym.median, idx) }, { name: 'All infections', values: sliceIdx(S.infections.median, idx) }]); },
    questions: ['Where do severe cases come from in the model?', 'What happens to untreated cases?', 'Does raising treatment coverage reduce transmission?'],
    context(ctx) { return baseContext(ctx, this.title, this.measures); },
    prepared(q, ctx) {
      if (/severe/i.test(q)) return 'When an exposed person becomes infectious, a share p_a = ' + E.FIXED.p_a + ' is asymptomatic. Of the symptomatic rest, p_u = ' + E.FIXED.p_u + ' are uncomplicated and 1 − p_u severe. Severe cases recover at r_s and are not treated at the outpatient clinic in this structure, so interventions reduce them only by reducing infections.';
      if (/untreated/i.test(q)) return 'Uncomplicated cases that are not treated (share 1 − p_t) stay symptomatic for about 1/ω ≈ ' + Math.round(1 / E.FIXED.omega) + ' days and then move to the asymptomatic class, where they keep infecting mosquitoes at ζ_a = ' + E.ADVANCED.zeta_a + ' of a clinical case\'s infectiousness until they clear at δ.';
      if (/treatment coverage/i.test(q)) return 'Yes, indirectly. Treated people clear parasites faster (r) and are less infectious while treated (ζ_t = ' + E.ADVANCED.zeta_t + '), so a higher p_t removes infectiousness from the population and lowers λ(t). The direct effect is on who gets counted as a treated case, which is why treated cases can rise with p_t even as infections fall. Use "Vary one input" to see both effects.';
      return null;
    },
  },
  {
    group: 'confidence', id: 'fit', title: 'Model fit to outpatient-treated cases, 2017 to 2025', unit: 'cases per month · observed and modelled', views: ['normal', 'student', 'researcher'],
    measures: 'The county\'s historical record of outpatient-treated cases (dots) against the model with the county\'s fitted parameters (line). The prototype uses a synthetic record. The tool shows the team\'s calibration.',
    render(chartEl, ctx) {
      const obs = observedFor(ctx.county); const t = ctx.res.t;
      const series = [{ name: 'Modelled (fitted parameters' + (advList(ctx).length ? ' with your overrides' : '') + ')', color: 'var(--s1)', values: ctx.res.base.central.treated, width: 2 }, { name: 'Observed (synthetic in this prototype)', color: 'var(--s8)', type: 'dots', x: obs.map(p => p.t), values: obs.map(p => p.value) }];
      lineChart(chartEl, { x: t, xDomain: [2017, 2026], series, height: 220, aria: 'Observed and modelled cases 2017–2025' });
      chartEl.append(legend([{ name: 'Modelled', color: 'var(--s1)', kind: 'line' }, { name: 'Observed', color: 'var(--s8)', kind: 'dot' }]));
    },
    aside(ctx) { const a = asideBlock(ctx, { measures: this.measures, varied: false, brief: true }); const obs = observedFor(ctx.county); const t = ctx.res.t; const co = obs.reduce((s, p) => s + p.value, 0); const cs = cumulative(ctx.res.base.central, t, 'treated', 2017, 2026); const mini = el('div', { class: 'chart' }); a.append(el('h3', { text: 'Cumulative cases 2017–2025' }), mini); setTimeout(() => barChart(mini, { categories: [{ label: 'Observed', value: co, color: 'var(--s8)' }, { label: 'Modelled', value: cs, color: 'var(--s1)' }], height: 150, marginLeft: 40, maxBar: 24, aria: 'Cumulative observed vs modelled' }), 0); return a; },
    data(ctx) { const obs = observedFor(ctx.county); const t = ctx.res.t; const idx = monthsLabels(t, 2017, 2026); return mkData(idx.map(k => fmt.ym(t[k])), [{ name: 'Observed', values: obs.map(p => p.value) }, { name: 'Modelled', values: sliceIdx(ctx.res.base.central.treated, idx) }]); },
    questions: ['What does a good fit tell me?', 'Why do the dots scatter around the line?', 'What changed in 2024?'],
    context(ctx) { const obs = observedFor(ctx.county); const t = ctx.res.t; const co = obs.reduce((s, p) => s + p.value, 0); const cs = cumulative(ctx.res.base.central, t, 'treated', 2017, 2026); return baseContext(ctx, this.title, this.measures).concat(['Cumulative 2017–2025: observed ' + fmt.int(co) + ', modelled ' + fmt.int(cs) + ', difference ' + fmt.signedPct(cs / co - 1, 2) + '. The observed series in this prototype is synthetic (model plus noise).']); },
    prepared(q, ctx) {
      if (/good fit/i.test(q)) return 'A close match between the line and the dots means the county profile reproduces the level and the seasonal shape of recorded cases over 2017–2025. It does not prove that the model will reproduce the effect of a new intervention, because the record contains only the interventions that actually happened. That is why results for 2027 onward are explorations under assumptions, not forecasts.';
      if (/scatter/i.test(q)) return 'Monthly records vary with reporting completeness, care-seeking, stock-outs and weather that a smooth seasonal curve cannot follow. The model is fitted to the overall level and pattern, so individual months sit above or below the line while the cumulative totals stay close (here within ' + fmt.signedPct(cumulative(ctx.res.base.central, ctx.res.t, 'treated', 2017, 2026) / observedFor(ctx.county).reduce((s, p) => s + p.value, 0) - 1, 1) + ').';
      if (/2024/i.test(q)) return 'All eight counties moved to PBO nets in the 2024 campaign, which the model represents as a higher efficacy peak than the pyrethroid nets before it' + (ctx.county.irsHistory ? ', and the ITN + IRS counties also had spray rounds in 2024, 2025 and 2026, which add short, strong drops in the force of infection' : '') + '. Those changes are in the history of every scenario.';
      return null;
    },
  },
  {
    group: 'confidence', id: 'sweep', title: 'Vary one input', unit: 'cases 2027 to horizon against one input · other inputs as set', views: ['normal', 'student', 'researcher'],
    measures: 'Total outpatient-treated cases over 2027 to the horizon as one input is moved across its range while everything else stays as set. Band = 90% of runs (10 draws per point).',
    render(chartEl, ctx) {
      const sw = sweepFor(ctx.s, state.sweepInput); const pts = sw.points; const xs = pts.map(p => p.x);
      const baseV = ctx.res.summary.baseCases.median;
      const wrap = el('div'); const sel = el('select', { id: 'sweep-select', 'aria-label': 'Input to vary' });
      for (const k in MSE.SWEEPS) { const o = el('option', { value: k, text: MSE.SWEEPS[k].label }); if (k === state.sweepInput) o.selected = true; sel.append(o); }
      sel.addEventListener('change', () => { state.sweepInput = sel.value; renderFigures(); });
      const ch = el('div', { class: 'chart' }); chartEl.innerHTML = ''; chartEl.append(el('div', { class: 'run-row small', style: 'margin-bottom:6px' }, [el('span', { text: 'Input to vary: ' }), sel]), ch);
      const curVal = state.sweepInput === 'irsCoverage' ? (ctx.inputs.irsMode === 'maintain' ? ctx.inputs.irsCoverage : null) : ctx.inputs[state.sweepInput];
      lineChart(ch, { x: xs, xDomain: [xs[0], xs[xs.length - 1]], xTicks: xs.map(v => ({ v, label: sw.fmt(v) })), xLabel: v => sw.label + ' ' + sw.fmt(v), series: [
        { name: 'Baseline (PBO, current coverage)', color: 'var(--muted)', values: xs.map(() => baseV), dash: '5 4', width: 1.5 },
        { name: 'Cases 2027–' + ctx.inputs.horizon + ' (median)', color: scenarioColor(ctx.s), values: pts.map(p => p.median), width: 2.2, endDot: false, bands: [{ lo: pts.map(p => p.q05), hi: pts.map(p => p.q95), opacity: .12 }] },
      ], markers: curVal != null ? [{ x: curVal, label: 'as set' }] : [], height: 220, aria: 'Cases against ' + sw.label });
      ch.append(legend([{ name: 'Scenario ' + ctx.s.id + ' with the input varied', color: scenarioColor(ctx.s), kind: 'line' }, { name: 'Baseline', color: 'var(--muted)', kind: 'dash' }]));
      chartEl._sweep = sw;
    },
    aside(ctx) { return asideBlock(ctx, { measures: this.measures, brief: true }); },
    data(ctx) { const sw = sweepFor(ctx.s, state.sweepInput); return mkData(sw.points.map(p => sw.fmt(p.x)), [{ name: 'median', values: sw.points.map(p => p.median) }, { name: '5%', values: sw.points.map(p => p.q05) }, { name: '95%', values: sw.points.map(p => p.q95) }]); },
    questions: ['Why is the curve not a straight line?', 'Which input matters most?', 'Can I vary two inputs at once?'],
    context(ctx) { const sw = sweepFor(ctx.s, state.sweepInput); return baseContext(ctx, this.title, this.measures).concat(['Sweep of ' + sw.label + ': ' + sw.points.map(p => sw.fmt(p.x) + ' → ' + fmt.int(p.median) + ' (' + fmt.int(p.q05) + '–' + fmt.int(p.q95) + ')').join(' · ') + '.']); },
    prepared(q, ctx) {
      const sw = sweepFor(ctx.s, state.sweepInput);
      if (/straight/i.test(q)) return 'Coverage enters the force of infection as a multiplier, and cases respond to the force of infection non-linearly: with high transmission many bites are redundant, so the first steps in coverage remove few cases, while near the point where each infection produces about one new infection the same step removes many. The slope of the curve therefore changes along the range.';
      if (/matters most/i.test(q)) return 'Over this sweep, ' + sw.label.toLowerCase() + ' moves cases from ' + fmt.int(sw.points[0].median) + ' to ' + fmt.int(sw.points[sw.points.length - 1].median) + '. The sensitivity chart (student and researcher views) compares the varied and advanced parameters on the same footing with one-at-a-time swings.';
      if (/two inputs/i.test(q)) return 'Not in this prototype. The tool\'s design includes a two-input grid (a heatmap of cases averted across, say, access and usage). Here, set the second input in the scenario panel and sweep the first, or add a scenario B with the second input changed and compare.';
      return null;
    },
  },
  {
    group: 'confidence', id: 'tornado', title: 'Which assumptions move the result', unit: 'change in cases 2027 to horizon when one parameter is moved to the end of its range · central run', views: ['student', 'researcher'],
    measures: 'One-at-a-time sensitivity: each varied parameter is set to the ends of its agreed range, and each advanced parameter to ±15% of its fitted value, with everything else as set. Bars show the resulting change in total cases.',
    render(chartEl, ctx) {
      const T = tornadoFor(ctx.s, ctx.res); chartEl._tornado = T;
      tornado(chartEl, { rows: T.rows });
      chartEl.append(legend([{ name: 'Fewer cases', color: 'var(--s3)', kind: 'box' }, { name: 'More cases', color: 'var(--s2)', kind: 'box' }]));
    },
    aside(ctx) { return asideBlock(ctx, { measures: this.measures, brief: true }); },
    data(ctx) { const T = tornadoFor(ctx.s, ctx.res); return mkData(T.rows.map(r => r.label), [{ name: 'low end', values: T.rows.map(r => r.low), fmt: v => fmt.signedPct(v, 1) }, { name: 'high end', values: T.rows.map(r => r.high), fmt: v => fmt.signedPct(v, 1) }]); },
    questions: ['Why is the biting rate so influential?', 'Why does loss of immunity matter?', 'Is ±15% the right range for advanced parameters?'],
    context(ctx) { const T = tornadoFor(ctx.s, ctx.res); return baseContext(ctx, this.title, this.measures).concat(['Sensitivity (change in cases 2027–' + ctx.inputs.horizon + ' vs central ' + fmt.int(T.base) + '): ' + T.rows.map(r => r.label + ': ' + r.lowLbl + ' ' + fmt.signedPct(r.low, 1) + ', ' + r.highLbl + ' ' + fmt.signedPct(r.high, 1)).join(' · ') + '.']); },
    prepared(q, ctx) {
      if (/biting/i.test(q)) return 'The biting rate appears squared in the force of infection (a mosquito must bite twice to pass an infection on), and it also sits in the denominator a·c·i + μ_m. A 10% change in a therefore moves λ(t) by more than 10% in low-saturation settings, which is why its agreed range produces one of the widest swings.';
      if (/immunity/i.test(q)) return 'ρ sets how quickly recovered people become susceptible again. Faster loss of immunity (' + E.RANGES.rho_days[0] + ' days) keeps the susceptible pool large, so the same force of infection yields more infections and more treated cases. Slower loss (' + E.RANGES.rho_days[1] + ' days) does the opposite. Because cases over several years depend on how often people can be re-infected, this parameter has leverage on cumulative totals.';
      if (/15%/i.test(q)) return 'No. ±15% is a convention used here only to compare the leverage of the advanced parameters on one scale. The ranges that matter are the ones the modelling team agrees for the varied tier and for any parameter a researcher chooses to vary. Those replace the convention in the tool.';
      return null;
    },
  },
  {
    group: 'costs', id: 'costs', title: 'Cost by component, 2027 to horizon', unit: 'illustrative unit costs · shown in the selected currency', views: ['normal', 'student', 'researcher'],
    measures: 'Treatment, vector control (nets and IRS) and vaccination costs over 2027 to the horizon for each scenario, from illustrative unit costs, with cost per case averted against the baseline.',
    render(chartEl, ctx) {
      const sc = sameCountyScenarios(ctx); const B = ctx.res.summary.bcosts;
      const mk = (lbl, C, color) => ({ label: lbl, value: 0, stack: [{ name: 'Treatment', value: C.treatment, color: 'var(--seq4)' }, { name: 'Vector control (nets + IRS)', value: C.vector, color: 'var(--seq2)' }, { name: 'Vaccination', value: C.vaccine, color: 'var(--seq1)' }] });
      const cats = [mk(['Baseline'], B)]; for (const o of sc) cats.push(mk(['Scenario ' + o.s.id, E.PRODUCTS[o.s.inputs.product].short + (o.s.inputs.irsMode === 'maintain' ? ' + IRS' : '')], o.res.summary.costs));
      barChart(chartEl, { categories: cats, height: 230, labelRows: true, valFmt: fmt.money, yFmt: v => fmt.money(v), valueName: 'Total', aria: 'Costs by component and scenario' });
      chartEl.append(legend([{ name: 'Treatment', color: 'var(--seq4)', kind: 'box' }, { name: 'Vector control (nets + IRS)', color: 'var(--seq2)', kind: 'box' }, { name: 'Vaccination', color: 'var(--seq1)', kind: 'box' }]));
    },
    aside(ctx) {
      const a = asideBlock(ctx, { measures: this.measures, varied: false, brief: true });
      const U = state.costs; const dl = el('dl'); const C = MSE.CURRENCIES[state.currency];
      const rows = [['treatedCase', 'Per treated case'], ['netDelivery', 'Net delivery, per net'], ['netsPerPerson', 'Nets per person'], ['irsPerPerson', 'IRS per person per round'], ['vaccinePerChild', 'Vaccine per child per year']];
      for (const [k, lbl] of rows) { dl.append(el('dt', { text: lbl })); const money = k !== 'netsPerPerson'; if (ctx.view === 'researcher') { const shown = money ? +(U[k] * C.perUSD).toFixed(2) : U[k]; const inp = el('input', { type: 'number', step: money ? (C.perUSD >= 50 ? '1' : '0.1') : '0.01', min: '0', value: shown, id: 'cost-' + k, 'aria-label': lbl + (money ? ' in ' + state.currency : ''), style: 'width:92px;padding:2px 6px;font-family:var(--mono);font-size:12px' }); inp.addEventListener('change', () => { state.costs[k] = money ? toUSD(+inp.value) : +inp.value; state.results.clear(); state.baseCache.clear(); runAll(); }); dl.append(el('dd', null, inp)); } else dl.append(el('dd', { text: money ? fmt.moneyUnit(U[k]) : String(U[k]) })); }
      a.append(el('h3', { text: 'Unit costs (illustrative, ' + state.currency + ')' }), dl);
      return a;
    },
    data(ctx) { const sc = sameCountyScenarios(ctx); const C = MSE.CURRENCIES[state.currency]; const rows = [['Baseline', ctx.res.summary.bcosts]].concat(sc.map(o => ['Scenario ' + o.s.id, o.res.summary.costs])); const cv = k => rows.map(r => r[1][k] * C.perUSD); return mkData(rows.map(r => r[0]), [{ name: 'Treatment (' + state.currency + ')', values: cv('treatment'), fmt: fmt.int }, { name: 'Nets', values: cv('nets'), fmt: fmt.int }, { name: 'IRS', values: cv('irs'), fmt: fmt.int }, { name: 'Vaccination', values: cv('vaccine'), fmt: fmt.int }, { name: 'Total', values: cv('total'), fmt: fmt.int }]); },
    questions: ['How is cost per case averted calculated?', 'Why is vector control the largest component?', 'Where do the unit costs come from?'],
    context(ctx) { const S = ctx.res.summary; const C = MSE.CURRENCIES[state.currency]; const m = v => fmt.int(v * C.perUSD); return baseContext(ctx, this.title, this.measures).concat(['Costs 2027–' + ctx.inputs.horizon + ' (' + state.currency + ', illustrative. 1 USD = ' + C.perUSD + ' ' + state.currency + '): scenario treatment ' + m(S.costs.treatment) + ', nets ' + m(S.costs.nets) + ', IRS ' + m(S.costs.irs) + ', vaccination ' + m(S.costs.vaccine) + ', total ' + m(S.costs.total) + '. Baseline total ' + m(S.bcosts.total) + '. Cost per case averted ' + (S.costPerAverted == null ? 'undefined' : fmt.moneyUnit(S.costPerAverted)) + '. Unit costs: per treated case ' + fmt.moneyUnit(state.costs.treatedCase) + ', net delivery ' + fmt.moneyUnit(state.costs.netDelivery) + ', nets per person ' + state.costs.netsPerPerson + ', IRS per person ' + fmt.moneyUnit(state.costs.irsPerPerson) + ', vaccine per child ' + fmt.moneyUnit(state.costs.vaccinePerChild) + '. Net unit costs ' + MSE.PRODUCT_ORDER.map(p => E.PRODUCTS[p].short + ' ' + fmt.moneyUnit(E.PRODUCTS[p].cost)).join(', ') + '.']); },
    prepared(q, ctx) {
      const S = ctx.res.summary;
      if (/calculated/i.test(q)) return 'Cost per case averted = (scenario cost − baseline cost) ÷ cases averted, both over 2027–' + ctx.inputs.horizon + ': (' + fmt.money(S.costs.total) + ' − ' + fmt.money(S.bcosts.total) + ') ÷ ' + fmt.int(S.averted.median) + (S.costPerAverted == null ? ', undefined because no cases are averted.' : S.costPerAverted < 0 ? ' is negative: the scenario averts cases and costs less, so it dominates.' : ' = ' + fmt.moneyUnit(S.costPerAverted) + '.') + ' Treatment costs fall when cases fall, which partly pays for the intervention.';
      if (/largest/i.test(q)) return 'A mass campaign buys about ' + state.costs.netsPerPerson + ' nets per person covered at ' + fmt.moneyUnit(E.PRODUCTS[ctx.inputs.product].cost) + ' plus ' + fmt.moneyUnit(state.costs.netDelivery) + ' delivery, and each IRS round costs ' + fmt.moneyUnit(state.costs.irsPerPerson) + ' per person protected, every year. Against that, treatment costs ' + fmt.moneyUnit(state.costs.treatedCase) + ' per case. This matches the team\'s finding that vector control drives most costs.';
      if (/unit costs/i.test(q)) return 'They are placeholders typed into this prototype so the chart has a shape. None comes from the team\'s economic analysis. The tool will take unit costs from that analysis where available and show "costing data not available" otherwise.';
      return null;
    },
  },
];
