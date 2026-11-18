let ucBuilt = false;
function renderUseCase() {
  const host = $('#uc-grid'); host.innerHTML = ''; ucBuilt = true;
  // one legend per county group, above its panels, instead of the same legend under each panel
  const cards = []; for (const g of MSE.COUNTIES.map(c => c.group).filter((x, k, arr) => arr.indexOf(x) === k)) {
    const set = MSE.PRESETS[g]; const head = el('div', { class: 'uc-group' }); head.append(el('h3', { text: MSE.GROUPS[g].replace(/county$/, 'counties') }), legend(set.map((p, k) => ({ name: p.label, color: MSE.SLOT_COLORS[k], kind: k === 0 ? 'dash' : 'line' })))); host.append(head);
    MSE.COUNTIES.filter(c => c.group === g).forEach(c => { const card = el('div', { class: 'uc' }); card.append(el('h3', null, [el('span', { text: c.name }), el('small', { text: MSE.GROUPS[c.group] + ' · ' + fmt.compact(c.population) + ' people' })])); const ch = el('div', { class: 'chart' }); const bars = el('div', { class: 'chart bars' }); card.append(ch, bars); host.append(card); cards.push({ c, card, ch, bars }); });
  }
  for (const { c, card, ch, bars } of cards) {
    const set = MSE.PRESETS[c.group]; const h = 2032;
    const runs = set.map(p => { const inp = defaultInputs(c, { product: p.product, irsMode: p.irsMode, horizon: h }); inp.irsOn = inp.irsMode === 'maintain'; const P = E.buildParams(c, inp, null, null); return { p, run: E.run(P) }; });
    const t = runs[0].run.t;
    const series = runs.map((o, k) => ({ name: o.p.label, color: MSE.SLOT_COLORS[k], values: o.run.treated, width: k === 0 ? 1.6 : 1.8, dash: k === 0 ? '5 4' : null }));
    lineChart(ch, { x: t, xDomain: [2024, h + 1], series, height: 150, marginLeft: 44, markers: [{ x: 2027, label: '2027' }], aria: c.name + ' monthly cases by strategy' });
    const base = cumulative(runs[0].run, t, 'treated', 2027, h + 1);
    const cats = runs.map((o, k) => { const v = cumulative(o.run, t, 'treated', 2027, h + 1); return { label: o.p.label.split(' · ')[0], value: v, color: MSE.SLOT_COLORS[k], note: k ? fmt.signedPct(v / base - 1, 1) : null, noteColor: 'var(--good-text)', tipNote: o.p.label }; });
    barChart(bars, { categories: cats, height: 150, marginLeft: 44, noteRow: true, maxBar: 24, valueName: 'Cases 2027–2032', aria: c.name + ' total cases by strategy' });
    const open = el('button', { type: 'button', class: 'btn small open', text: 'Open in builder' }); open.addEventListener('click', () => { state.scenarios = set.map((p, k) => newScenario('ABCDEFGH'[k], defaultInputs(c, { product: p.product, irsMode: p.irsMode, horizon: h }), p.label)); state.activeId = 'B'; state.referenceId = 'A'; state.hasRun = true; syncCurrency(); switchTab('build'); renderRail(); runAll(); window.scrollTo({ top: 0 }); }); card.append(open);
  }
}
