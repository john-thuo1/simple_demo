/* ===================== Model & registry tab ===================== */
function renderDiagram() {
  const host = $('#diagram'); host.innerHTML = '';
  const W = 860, H = 330;
  const root = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Compartment diagram of the model', style: 'font-family:var(--font);font-size:12px' });
  root.append(svg('defs', null, svg('marker', { id: 'arr', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, svg('path', { d: 'M0 0L10 5L0 10z', style: 'fill:var(--ink-2)' }))));
  const boxes = {
    S: [40, 125, 'Susceptible', 'S', 'var(--accent)'], V: [40, 235, 'Vaccinated', 'V', 'var(--accent)'], E: [205, 125, 'Exposed', 'E', 'var(--ink-2)'],
    Ia: [370, 30, 'Asymptomatic', 'I_a', 'var(--s8)'], Iun: [370, 125, 'Uncomplicated', 'I_un', 'var(--s8)'], Isev: [370, 235, 'Severe', 'I_sev', 'var(--s8)'],
    T: [540, 125, 'Outpatient treated', 'T', 'var(--s3)'], R: [705, 125, 'Recovered', 'R', 'var(--s3)'] };
  const bw = 110, bh = 54;
  for (const k in boxes) { const [x, y, name, sym, col] = boxes[k]; root.append(svg('rect', { x, y, width: bw, height: bh, rx: 8, style: 'fill:var(--surface-2);stroke:' + col + ';stroke-width:1.5' })); root.append(svg('text', { x: x + bw / 2, y: y + 22, 'text-anchor': 'middle', style: 'fill:var(--ink);font-size:11.5px' }, name)); root.append(svg('text', { x: x + bw / 2, y: y + 42, 'text-anchor': 'middle', style: 'fill:var(--ink);font-weight:600;font-family:var(--mono);font-size:13px' }, sym)); }
  const line = (x1, y1, x2, y2, extra) => root.append(svg('path', { d: 'M' + x1 + ' ' + y1 + 'L' + x2 + ' ' + y2, style: 'fill:none;stroke:var(--ink-2);stroke-width:1.3;' + (extra || ''), 'marker-end': 'url(#arr)' }));
  const label = (x, y, txt, anchor) => root.append(svg('text', { x, y, 'text-anchor': anchor || 'middle', style: 'fill:var(--ink-2);font-family:var(--mono);font-size:11px' }, txt));
  const c = k => ({ x: boxes[k][0], y: boxes[k][1], cx: boxes[k][0] + bw / 2, cy: boxes[k][1] + bh / 2, r: boxes[k][0] + bw, b: boxes[k][1] + bh });
  // births
  line(4, c('S').cy, c('S').x, c('S').cy); label(20, c('S').cy - 8, 'μ_h');
  // S -> E
  line(c('S').r, c('S').cy, c('E').x, c('E').cy); label((c('S').r + c('E').x) / 2, c('S').cy - 8, 'λ');
  // S -> V
  line(c('S').cx, c('S').b, c('V').cx, c('V').y); label(c('S').cx + 8, (c('S').b + c('V').y) / 2 + 4, 'p_under5·c_v', 'start');
  // V -> E
  line(c('V').r, c('V').cy, c('E').cx, c('E').b); label(c('V').r + 40, c('V').cy - 30, 'λ(1−ε)', 'start');
  // E -> Ia, Iun, Isev
  line(c('E').r, c('E').y + 12, c('Ia').x, c('Ia').cy); label(c('E').r + 45, c('E').y - 2, 'p_a·γ_h', 'start');
  line(c('E').r, c('E').cy, c('Iun').x, c('Iun').cy); label((c('E').r + c('Iun').x) / 2, c('E').cy - 8, 'p_u(1−p_a)γ_h');
  line(c('E').r, c('E').b - 12, c('Isev').x, c('Isev').cy); label(c('E').r + 10, c('Isev').cy - 6, '(1−p_u)(1−p_a)γ_h', 'start');
  // Iun -> T
  line(c('Iun').r, c('Iun').cy, c('T').x, c('T').cy); label((c('Iun').r + c('T').x) / 2, c('Iun').cy - 8, 'p_t·τ');
  // Iun -> Ia
  line(c('Iun').cx, c('Iun').y, c('Ia').cx, c('Ia').b); label(c('Iun').cx + 8, (c('Iun').y + c('Ia').b) / 2 + 4, '(1−p_t)·ω', 'start');
  // T -> R
  line(c('T').r, c('T').cy, c('R').x, c('R').cy); label((c('T').r + c('R').x) / 2, c('T').cy - 8, 'r');
  // Ia -> R
  line(c('Ia').r, c('Ia').cy, c('R').cx, c('R').y); label(c('Ia').r + 90, c('Ia').cy + 2, 'δ', 'start');
  // Isev -> R
  line(c('Isev').r, c('Isev').cy, c('R').cx, c('R').b); label(c('Isev').r + 90, c('Isev').cy - 6, 'r_s', 'start');
  // R -> S (immunity loss) over the top
  root.append(svg('path', { d: 'M' + c('R').cx + ' ' + c('R').y + 'V14H' + c('S').cx + 'V' + (c('S').y - 2), style: 'fill:none;stroke:var(--s2);stroke-width:1.3', 'marker-end': 'url(#arr)' })); label((c('R').cx + c('S').cx) / 2, 10, 'ρ · loss of immunity');
  root.append(svg('text', { x: W - 8, y: H - 8, 'text-anchor': 'end', style: 'fill:var(--muted);font-size:11px' }, 'μ_h deaths leave every class (closed population). Schematic after the 2 Oct model-formulation slide.'));
  host.append(root);
}
function renderTiers() {
  const t = $('#tiers-table'); if (!t) return; t.innerHTML = '';
  t.append(el('thead', null, el('tr', null, [el('th', { text: 'Tier' }), el('th', { text: 'Parameters in the CEMA model' }), el('th', { text: 'Who sets it' })])));
  const tb = el('tbody'); for (const r of MSE.TIERS) tb.append(el('tr', null, [el('td', null, el('span', { class: 'tier-pill ' + r.tier, text: r.name })), el('td', { text: r.params }), el('td', { text: r.who })])); t.append(tb);
}
let regTier = 'all';
function safeCtx() {
  const s = active(); if (scenarioReady(s) && state.hasRun) return buildCtx(s);
  const c = s.inputs.county ? county(s.inputs.county) : null;
  return { s, res: null, all: [], county: c, inputs: Object.assign({}, s.inputs), advanced: cleanAdvanced(s.advanced), pins: cleanPins(s.pins), view: state.view, partial: true };
}
function renderRegistry() {
  const ctx = safeCtx(); const q = ($('#reg-search').value || '').toLowerCase();
  const tiersAllowed = state.view === 'normal' ? ['user', 'varied', 'fixed'] : ['user', 'advanced', 'varied', 'fixed'];
  const tf = $('#reg-tiers'); tf.innerHTML = '';
  for (const [k, lbl] of [['all', 'All'], ['user', 'User-facing'], ['advanced', 'Advanced'], ['varied', 'Varied automatically'], ['fixed', 'Fixed']]) { if (k !== 'all' && !tiersAllowed.includes(k)) continue; const b = el('button', { type: 'button', text: lbl, 'aria-pressed': String(regTier === k) }); b.addEventListener('click', () => { regTier = k; renderRegistry(); }); tf.append(b); }
  const where = ctx.county ? ctx.county.name : 'the county you choose'; const pend = ctx.partial ? ' Values marked — appear once a county is chosen and a scenario has run.' : '';
  $('#reg-intro').textContent = (state.view === 'normal' ? 'What each input means, the value in use for ' + where + ', where it comes from, and which parameters the tool varies or holds fixed on your behalf.' : 'Every parameter with the value in use for ' + where + '.') + pend;
  const t = $('#reg-table'); t.innerHTML = '';
  const cols = state.view === 'normal' ? ['Parameter', 'Tier', 'What it means', 'Value in use', 'Source', 'Who sets it'] : ['Parameter', 'Symbol', 'Tier', 'What it means', 'Unit', 'Value in use', 'How it enters the model', 'Source', 'Who sets it'];
  t.append(el('thead', null, el('tr', null, cols.map(cn => el('th', { text: cn })))));
  const tb = el('tbody');
  for (const r of MSE.REGISTRY) {
    if (!tiersAllowed.includes(r.tier)) continue; if (regTier !== 'all' && r.tier !== regTier) continue;
    if (q && !(r.name + ' ' + r.sym + ' ' + r.meaning + ' ' + r.how).toLowerCase().includes(q)) continue;
    let v; try { v = ctx.partial && (r.tier === 'user' || r.tier === 'advanced' || r.tier === 'varied') && !(r.tier === 'varied' && ctx.county) ? r.value(ctx) : r.value(ctx); } catch (e) { v = '—'; }
    const pill = el('span', { class: 'tier-pill ' + r.tier, text: r.tier === 'user' ? 'User-facing' : r.tier === 'advanced' ? 'Advanced' : r.tier === 'varied' ? 'Varied' : 'Fixed' });
    const cells = state.view === 'normal' ? [el('td', { text: r.name }), el('td', null, pill), el('td', { text: r.meaning }), el('td', { class: 'val', text: v }), el('td', { text: r.source }), el('td', { text: r.who })]
      : [el('td', { text: r.name }), el('td', { class: 'sym', text: r.sym }), el('td', null, pill), el('td', { text: r.meaning }), el('td', { text: r.unit }), el('td', { class: 'val', text: v }), el('td', { text: r.how }), el('td', { text: r.source }), el('td', { text: r.who })];
    tb.append(el('tr', null, cells));
  }
  t.append(tb);
}
