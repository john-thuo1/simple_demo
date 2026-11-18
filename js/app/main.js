function applyView() {
  $$('.view-switch button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
  $('#view-help').textContent = MSE.VIEW_HELP[state.view];
  $('#panel-advanced').hidden = state.view !== 'researcher'; $('#panel-varied').hidden = state.view !== 'researcher';
  $('#api-card').hidden = state.view === 'normal'; $('#router-card').hidden = false;
  $('#rate-row').hidden = state.view !== 'researcher';
}
function switchTab(id) {
  state.tab = id;
  $$('.tabs button').forEach(b => b.setAttribute('aria-selected', String(b.id === 'tab-' + id)));
  for (const p of ['build', 'country', 'usecase', 'model', 'runs']) $('#panel-' + p).hidden = p !== id;
  if (id === 'country') renderCountry();
  if (id === 'usecase' && !ucBuilt) renderUseCase();
  if (id === 'model') renderRegistry();
  if (id === 'runs') renderRuns();
}
function runAll() {
  state.dirty = false; $('#stale').hidden = true; $('#main').classList.remove('stale-results');
  for (const x of state.scenarios) if (scenarioReady(x)) x.ran = true;
  renderAll(); updateRailState();
}
function renderAll() {
  try { renderAllInner(); } catch (e) { console.error(e); try { renderEmptyState(); const n = el('div', { class: 'stale', style: 'margin-bottom:10px', text: 'Could not draw the results (' + (e && e.message ? e.message : e) + '). The inputs are kept. Change an input to try again.' }); $('#figures').prepend(n); } catch (e2) { console.error(e2); } }
}
function renderAllInner() {
  state.renderMemo = new Map();
  syncCurrency(); renderRateBox();
  if (!state.hasRun || !scenarioReady(active()) || !active().ran) { renderEmptyState(); if (state.tab === 'country') renderCountry(); if (!window.EXT || !EXT.current || EXT.current.kind === 'team') $('#foot-versions').textContent = 'model ' + E.MODEL_VERSION + ' · engine ' + E.ENGINE_VERSION; return; }
  const ctx = buildCtx(active());
  renderStrip(); renderHeader(ctx); renderKPIs(ctx); renderComparison(); renderFigures();
  renderRuns(); if (state.tab === 'model') renderRegistry(); if (state.tab === 'country') renderCountry();
  if (!window.EXT || !EXT.current || EXT.current.kind === 'team') $('#foot-versions').textContent = 'model ' + E.MODEL_VERSION + ' · engine ' + E.ENGINE_VERSION + ' · ' + MSE.N_DRAWS + ' draws per scenario';
}
function init() {
  state.scenarios = [blankScenario('A')];
  state.activeId = 'A';
  $$('.view-switch button').forEach(b => b.addEventListener('click', () => { state.view = b.dataset.view; applyView(); renderRail(); renderAll(); if (state.tab === 'model') renderRegistry(); if (state.tab === 'runs') renderRuns(); }));
  $$('.tabs button').forEach(b => b.addEventListener('click', () => switchTab(b.id.replace('tab-', ''))));
  $('#btn-run').addEventListener('click', () => { state.hasRun = true; runAll(); });
  $('#btn-reset').addEventListener('click', () => { const s = active(); const keepCounty = s.inputs.county; const b = blankScenario(s.id); if (keepCounty) Object.assign(b.inputs, defaultInputs(county(keepCounty), { horizon: s.inputs.horizon }), { product: null, irsMode: null, irsOn: false }); s.inputs = b.inputs; s.advanced = {}; s.pins = {}; s.name = ''; s.ran = false; state.dirty = false; $('#stale').hidden = true; renderRail(); renderAll(); });
  $('#live-update').addEventListener('change', ev => { state.live = ev.target.checked; updateRailState(); if (state.live && state.dirty && autoApplies()) runAll(); });
  $('#btn-export-json').addEventListener('click', exportJSON); $('#btn-export-csv').addEventListener('click', exportCSV);
  $('#reg-search').addEventListener('input', debounce(renderRegistry, 120));
  let rw = window.innerWidth; window.addEventListener('resize', debounce(() => { if (Math.abs(window.innerWidth - rw) > 40) { rw = window.innerWidth; renderFigures(); if (ucBuilt && state.tab === 'usecase') renderUseCase(); } }, 200));
  renderCurrencyControl(); applyView(); renderRail(); runAll();
  const hash = (location.hash || '').replace('#', ''); if (['country', 'usecase', 'model', 'runs'].includes(hash)) switchTab(hash);
  initSample(); initDownloads();
}
window.addEventListener('error', ev => { try { const m = ev && ev.message ? ev.message : String(ev); let n = $('#err-note'); if (!n) { n = el('div', { id: 'err-note', class: 'stale', style: 'position:fixed;left:16px;right:16px;bottom:16px;z-index:9;box-shadow:0 4px 16px rgba(0,0,0,.2)' }); document.body.append(n); } n.textContent = 'Something went wrong: ' + m + ' — the page keeps your inputs. Try the action again or press Run.'; setTimeout(() => n.remove(), 8000); } catch (e) {} });
init();

/* The input rail scrolls on its own. Its height is whatever is left of the window below its top edge,
   so every input can be reached with the rail's own scrollbar wherever the page is scrolled (18 Nov 2026). */
(function () {
  let queued = false;
  function fit() {
    queued = false;
    const wide = window.matchMedia('(min-width: 961px)').matches;
    for (const r of document.querySelectorAll('.rail')) {
      if (!wide) { r.style.maxHeight = ''; continue; }
      if (!r.offsetParent) continue; // hidden tab
      const top = Math.max(r.getBoundingClientRect().top, 10);
      r.style.maxHeight = Math.max(240, window.innerHeight - top - 10) + 'px';
      // while the panel has more than fits, the wheel stays with it at either end. The page does not start moving instead
      r.classList.toggle('scrolls', r.scrollHeight > r.clientHeight + 1);
    }
  }
  const ask = () => { if (!queued) { queued = true; requestAnimationFrame(fit); } };
  window.addEventListener('scroll', ask, { passive: true }); window.addEventListener('resize', ask);
  if (window.ResizeObserver) new ResizeObserver(ask).observe(document.body);
  document.addEventListener('click', ask); // tab and view switches move the rail
  document.addEventListener('input', ask); document.addEventListener('change', ask); // a choice can add or remove inputs
  // belt and braces: measure again the moment the pointer reaches the panel or the wheel turns, when the window regains focus,
  // after everything has loaded, and once a second, so the panel can never be left taller than the window
  document.addEventListener('wheel', ask, { passive: true }); document.addEventListener('pointerover', ev => { if (ev.target && ev.target.closest && ev.target.closest('.rail')) fit(); });
  window.addEventListener('load', ask); window.addEventListener('focus', ask); setInterval(fit, 1000);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ask); else ask();
})();
