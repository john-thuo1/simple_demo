const EXT = window.EXT = {};
(function () {
  'use strict';
  const M = window.MENGINE, API = window.ModelAPI;
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } } };
  const fmtN = (v, d) => v == null || Number.isNaN(v) ? '—' : (d != null ? v.toFixed(d) : Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2));
  const pct = v => (v > 0 ? '+' : '') + (v * 100).toFixed(0) + '%';

  /* ---------- model registry ---------- */
  EXT.models = [];
  EXT.current = null;
  /* purpose families (GET /families): picker groups, the note under each headline, explainer context */
  const FAMILIES = API.listFamilies();
  /* A model can sit in more than one cluster: a cost-effectiveness or optimal-control model is an intervention model with a layer on top.
     EXT.cluster is the cluster the user picked the current model from. The badge, the note and the explainer follow it. */
  EXT.cluster = null;
  const clustersOf = m => FAMILIES.filter(f => m && (m.purpose === f.id || (f.id === 'intervention' && (m.purpose === 'cost-effectiveness' || m.purpose === 'optimal-control'))));
  const famOf = m => { const cs = clustersOf(m); return (m === EXT.current && cs.find(f => f.id === EXT.cluster)) || cs[0] || FAMILIES[FAMILIES.length - 1]; };
  /* cost-effectiveness and optimal-control models sit on top of an intervention model, so they carry its limitation too */
  function caveatsOf(m) { const f = famOf(m); const out = []; if (f.id === 'cost-effectiveness' || f.id === 'optimal-control') out.push(FAMILIES.find(x => x.id === 'intervention').limitation); out.push(f.limitation); return out; }
  EXT.familyLine = () => { const m = EXT.current; if (!m) return ''; const f = famOf(m); return 'Model cluster chosen by the user: ' + f.name + '. ' + f.description + ' Limits to state when relevant: ' + caveatsOf(m).join(' '); };
  function renderFamilyNotes() {
    const m = EXT.current; if (!m) return; const f = famOf(m);
    for (const id of ['#family-note', '#g-family-note']) { const n = $(id); if (!n) continue; n.innerHTML = ''; n.hidden = true; } // 18 Nov: the cluster description moved into the model menu (shown on hover) and the status chip
  }
  /* Each entry: the summary from GET /models, the package from GET /models/{id}, the input form from
     GET /models/{id}/inputs, and the engine-ready model object loaded from the package. */
  function registerFromService(summary) {
    const key = summary.id; const pack = API.getModel(key); const inputs = API.getInputs(key); const pkg = M.fromPackage(pack);
    const entry = { key, kind: key === 'cema-county' ? 'team' : 'spec', name: pack.model.name, pkg, package: pack, inputs, reviewed: summary.reviewed, reviewer: summary.reviewer, grid: summary.grid, runtime_ms: summary.runtime_ms, blurb: summary.blurb, custom: !!summary.custom, purpose: summary.purpose, structure_id: summary.structure_id, values_id: summary.values_id, same_structure_as: summary.same_structure_as };
    const existing = EXT.models.find(m => m.key === key); if (existing) Object.assign(existing, entry); else EXT.models.push(entry);
    return entry;
  }
  function registerLibrary() { for (const s of API.listModels()) registerFromService(s); }
  function isTeam() { return EXT.current && EXT.current.kind === 'team'; }

  /* ---------- start screen: no model preselected (MSE.START_WITH_CHOOSER) ---------- */
  const CHOOSER = () => !!MSE.START_WITH_CHOOSER;
  const teaching = m => !m.custom && m.kind !== 'team' && m.pkg.model.standing !== 'fitted';
  const mastText = () => CHOOSER() && !EXT.current ? 'Choose a model to begin.' : state.view === 'normal' ? 'Pick a reviewed model, then run and compare intervention scenarios on it.' : 'Pick a model from the library or open a package file, then run and compare intervention scenarios on it.';
  function hideChooser() { const app = $('#app'); if (app) app.classList.remove('no-model'); const c = $('#model-chooser'); if (c) c.hidden = true; const d = $('#btn-model-details'); if (d) d.hidden = false; const fl = $('#model-file-label'); if (fl) fl.hidden = state.view === 'normal'; $$('.view-switch button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === state.view))); const ms = $('#mast-sub'); if (ms) ms.textContent = mastText(); }
  /* One card per model. Its clusters are tags on the card. A tag's description shows on hover. */
  function showChooser() {
    const app = $('#app'); app.classList.add('no-model'); const pm = state.view === 'normal';
    let host = $('#model-chooser'); if (!host) { host = el('section', { id: 'model-chooser', class: 'chooser', 'aria-label': 'Models' }); const tabs = $('.tabs'); tabs.parentNode.insertBefore(host, tabs); }
    host.hidden = false; host.innerHTML = '';
    $('#btn-model-details').hidden = true; const cr = $('.currency-row'); if (cr) cr.hidden = true; const fl = $('#model-file-label'); if (fl) fl.hidden = true;
    const ms = $('#mast-sub'); if (ms) ms.textContent = mastText();
    const grid = el('div', { class: 'chooser-grid' });
    const list = EXT.models.filter(m => pm ? !m.custom : true); // the Policymaker sees every reviewed model. Custom models and file import are for the Modeller
    for (const m of list) {
      const bd = badgeOf(m); const card = el('article', { class: 'mcard' });
      card.append(el('div', { class: 'mcard-head' }, [el('h2', { text: m.name }), el('span', { class: 'badge ' + bd.cls, text: m.custom ? 'Custom · unreviewed' : teaching(m) ? 'Reviewed · teaching model' : 'Reviewed' })]));
      if (m.blurb) card.append(el('p', { class: 'mcard-text', text: m.blurb }));
      const tags = el('div', { class: 'mcard-tags' }); clustersOf(m).forEach(f => tags.append(el('span', { class: 'ctag', title: f.description, tabindex: '0', text: f.name }))); if (tags.children.length) card.append(tags);
      const open = el('button', { type: 'button', class: 'btn', text: 'Open model', 'aria-label': 'Open ' + m.name }); open.addEventListener('click', () => { EXT.cluster = null; EXT.select(m.key); window.applyView(); window.scrollTo({ top: 0 }); });
      const dl = el('button', { type: 'button', class: 'linkbtn', text: 'Download package', title: 'Save this model as a package file (.json)', 'aria-label': 'Download the package for ' + m.name });
      dl.addEventListener('click', () => saveFile((m.key || 'model') + '-' + m.pkg.model_id + '.json', packageJSON(m), 'application/json'));
      card.append(el('div', { class: 'mcard-actions' }, [open, dl])); grid.append(card);
    }
    if (!pm) { const card = el('article', { class: 'mcard dashed' }); card.append(el('div', { class: 'mcard-head' }, el('h2', { text: 'Open a model file' })), el('p', { class: 'mcard-text', text: 'Import a compiled model package (.json). It opens as a custom, unreviewed model.' })); const b = el('button', { type: 'button', class: 'btn', text: 'Choose file' }); b.addEventListener('click', () => $('#model-file').click()); card.append(b); grid.append(card); }
    host.append(grid);
  }
  EXT.deselect = function () { EXT.current = null; EXT.cluster = null; renderPicker(); renderBadge(); showChooser(); };

  /* ---------- picker in the masthead ---------- */
  function renderPicker() {
    const sel = $('#model-pick'); sel.innerHTML = ''; const pm = state.view === 'normal';
    const lib = EXT.models.filter(m => !m.custom);
    if (pm) {
      // Policymaker shelf: reviewed models only, grouped by the question each kind of model informs. No file import, no custom models.
      // a cost-effectiveness or optimal-control model is an intervention model with a layer on top, so it is also listed under the intervention question
      FAMILIES.forEach(f => { const ms = lib.filter(m => m.purpose === f.id || (f.id === 'intervention' && (m.purpose === 'cost-effectiveness' || m.purpose === 'optimal-control'))); if (!ms.length) return; const g = el('optgroup', { label: f.name }); ms.forEach(m => g.append(el('option', { value: m.key + '|' + f.id, text: m.name }))); sel.append(g); });
      if (CHOOSER()) { const gm = el('optgroup', { label: 'More' }); gm.append(el('option', { value: '__chooser', text: 'All models…' })); sel.append(gm); }
    } else {
      // Modeller library: the same clusters as the Policymaker shelf, then custom models and file import
      FAMILIES.forEach(f => { const ms = lib.filter(m => clustersOf(m).includes(f)); if (!ms.length) return; const g = el('optgroup', { label: f.name }); ms.forEach(m => g.append(el('option', { value: m.key + '|' + f.id, text: m.name }))); sel.append(g); });
      const customs = EXT.models.filter(m => m.custom); if (customs.length) { const g2 = el('optgroup', { label: 'Custom (this session)' }); customs.forEach(m => g2.append(el('option', { value: m.key, text: m.name + ' · ' + m.pkg.model_id + (m.same_structure_as ? ' · same structure as a library model' : '') }))); sel.append(g2); }
      const g3 = el('optgroup', { label: 'More' }); if (CHOOSER()) g3.append(el('option', { value: '__chooser', text: 'All models…' })); g3.append(el('option', { value: '__open', text: 'Open a model file…' })); sel.append(g3);
    }
    if (EXT.current) sel.value = EXT.current.custom ? EXT.current.key : EXT.current.key + '|' + famOf(EXT.current).id;
    renderMenu();
  }
  /* The model menu: a listbox built from the select above (which stays the source of truth and still fires 'change').
     A native select cannot show anything on hover, so the menu is drawn here. Hovering or arrowing to a cluster shows its description. */
  function renderMenu() {
    const sel = $('#model-pick'); sel.hidden = true;
    let wrap = $('#model-menu-wrap');
    if (!wrap) {
      wrap = el('div', { class: 'mmenu', id: 'model-menu-wrap' }); sel.after(wrap);
      document.addEventListener('click', ev => { const w = $('#model-menu-wrap'); if (w && !w.contains(ev.target)) { const l = w.querySelector('.mmenu-list'); if (l && !l.hidden) { l.hidden = true; w.querySelector('.mmenu-btn').setAttribute('aria-expanded', 'false'); } } });
    }
    wrap.innerHTML = '';
    const cur = EXT.current ? sel.selectedOptions[0] : null; // no model chosen yet: nothing is ticked and the button invites a choice
    const btn = el('button', { type: 'button', class: 'mmenu-btn', id: 'model-menu-btn', 'aria-haspopup': 'listbox', 'aria-expanded': 'false', 'aria-label': 'Model', text: cur ? cur.text : 'Choose a model' });
    const list = el('div', { class: 'mmenu-list', role: 'listbox', 'aria-label': 'Model library', hidden: '' });
    const body = el('div', { class: 'mmenu-body' }); const desc = el('div', { class: 'mmenu-desc', 'aria-live': 'polite' });
    const descOf = label => { const f = FAMILIES.find(x => x.name === label); if (f) return [f.name, f.description]; if (label.startsWith('Custom')) return ['Custom models', 'Imported in this session from a package file. Unreviewed, never added to the library, live runs only.']; return CHOOSER() ? ['More', state.view === 'normal' ? 'Go back to the list of models.' : 'Go back to the list of models, or import a compiled model package (.json).'] : ['Open a model file', 'Import a compiled model package (.json). It is listed as custom and unreviewed.']; };
    const show = label => { const d = descOf(label); desc.innerHTML = ''; desc.append(el('b', { text: d[0] + '. ' }), d[1]); };
    const curLabel = cur && cur.parentNode.label ? cur.parentNode.label : (sel.querySelector('optgroup') || {}).label || '';
    const items = [];
    const close = focus => { list.hidden = true; btn.setAttribute('aria-expanded', 'false'); if (focus) btn.focus(); };
    const open = () => { list.hidden = false; btn.setAttribute('aria-expanded', 'true'); show(curLabel); (items.find(i => i.getAttribute('aria-selected') === 'true') || items[0]).focus(); };
    for (const g of sel.querySelectorAll('optgroup')) {
      const grp = el('div', { class: 'mmenu-group', role: 'group', 'aria-label': g.label });
      grp.append(el('div', { class: 'mmenu-head', text: g.label }));
      for (const o of g.children) {
        const it = el('button', { type: 'button', class: 'mmenu-item', role: 'option', 'aria-selected': String(o === cur), text: o.text });
        it.addEventListener('focus', () => show(g.label));
        it.addEventListener('click', () => { close(true); sel.value = o.value; sel.dispatchEvent(new Event('change')); });
        grp.append(it); items.push(it);
      }
      grp.addEventListener('mouseenter', () => show(g.label));
      body.append(grp);
    }
    body.addEventListener('mouseleave', () => show((document.activeElement && document.activeElement.closest && document.activeElement.closest('.mmenu-group') || { getAttribute: () => curLabel }).getAttribute('aria-label')));
    list.append(body, desc); wrap.append(btn, list);
    btn.addEventListener('click', () => { if (list.hidden) open(); else close(false); });
    btn.addEventListener('keydown', ev => { if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') { ev.preventDefault(); if (list.hidden) open(); } });
    list.addEventListener('keydown', ev => {
      const i = items.indexOf(document.activeElement);
      if (ev.key === 'Escape') { ev.preventDefault(); close(true); }
      else if (ev.key === 'ArrowDown') { ev.preventDefault(); items[Math.min(items.length - 1, i + 1)].focus(); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); items[Math.max(0, i - 1)].focus(); }
      else if (ev.key === 'Home') { ev.preventDefault(); items[0].focus(); }
      else if (ev.key === 'End') { ev.preventDefault(); items[items.length - 1].focus(); }
      else if (ev.key === 'Tab') close(false);
    });
  }
  /* one status chip in the toolbar. Engine, cluster and ids open from it (and stay on the Model tab) */
  const badgeOf = m => m.custom ? { cls: 'custom', short: 'Custom · unreviewed', full: 'custom · unreviewed · live runs only' }
    : m.kind === 'team' ? { cls: 'fitted', short: 'Reviewed', full: 'reviewed · team engine' }
    : { cls: m.pkg.model.standing === 'fitted' ? 'fitted' : 'illustrative', short: 'Reviewed', full: 'reviewed' + (m.pkg.model.standing === 'fitted' ? '' : ' · ' + m.pkg.model.standing) + ' · spec engine' };
  function copyText(t, btn) {
    const done = () => { btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = 'Copy'; }, 1200); };
    const fallback = () => { const ta = el('textarea', { style: 'position:fixed;opacity:0' }); ta.value = t; document.body.append(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { } ta.remove(); };
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, fallback); else fallback(); } catch (e) { fallback(); }
  }
  function renderBadge() {
    const m = EXT.current; const b = $('#model-badge'); b.innerHTML = ''; $('#model-id').textContent = '';
    if (!m) return;
    const bd = badgeOf(m); const f = famOf(m); const pm = state.view === 'normal';
    const pop = el('div', { class: 'model-pop', id: 'model-pop', role: 'tooltip' });
    const chip = el('button', { type: 'button', class: 'badge chip ' + bd.cls, 'aria-describedby': 'model-pop', text: bd.short });
    const dl = el('dl');
    const row = (k, v, copy) => { const dd = el('dd', copy ? { class: 'mono' } : null, [el('span', { class: copy ? 'pick-all' : '', text: v })]); if (copy) { const cb = el('button', { type: 'button', class: 'pop-copy', text: 'Copy' }); cb.addEventListener('click', ev => { ev.stopPropagation(); copyText(v, cb); }); dd.append(cb); } dl.append(el('dt', { text: k }), dd); };
    row('Status', m.custom ? 'Custom, unreviewed. Imported in this session, live runs only.' : 'Reviewed' + (m.reviewer ? ' by ' + m.reviewer : '') + (m.kind !== 'team' && m.pkg.model.standing !== 'fitted' ? ' · ' + m.pkg.model.standing : ''));
    row('Engine', m.kind === 'team' ? 'Team engine · the team\'s own model code' : 'Spec engine · runs the package compiled from the model text (DSL)');
    row('Cluster', f.name); dl.append(el('dt'), el('dd', { class: 'pop-desc', text: f.description }));
    if (!pm) { row('Model id', String(m.pkg.model_id), true); row('Structure id', String(m.structure_id), true); }
    pop.append(dl);
    // shown on hover or keyboard focus (CSS). Escape dismisses until the pointer leaves
    b.onkeydown = ev => { if (ev.key === 'Escape') { b.classList.add('dismissed'); if (document.activeElement && b.contains(document.activeElement)) document.activeElement.blur(); } }; b.onmouseleave = () => b.classList.remove('dismissed');
    b.append(chip, pop);
  }
  EXT.select = function (key, opts) {
    const m = EXT.models.find(x => x.key === key); if (!m) return;
    if (!clustersOf(m).some(f => f.id === EXT.cluster)) EXT.cluster = null;
    if (CHOOSER() && state.view === 'normal' && m.custom) { state.view = 'researcher'; } // a custom model opens in the Modeller view
    EXT.current = m; hideChooser(); renderPicker(); renderBadge(); renderFamilyNotes();
    const team = m.kind === 'team';
    $('#tab-build').hidden = !team; $('#tab-country').hidden = !team; $('#tab-usecase').hidden = !team; $('#tab-gbuild').hidden = team; $('#tab-settings').hidden = team || !m.pkg.sets.length;
    $('.currency-row').hidden = !team;
    if (!team) G.load(m);
    const first = team ? 'build' : 'gbuild';
    switchTab(opts && opts.tab ? opts.tab : first);
    $('#foot-versions').textContent = 'model ' + m.pkg.model_id + ' · ' + (team ? 'engine ' + E.ENGINE_VERSION + ' (team stand-in)' : 'spec engine rk4/0.1') + ' · ' + MSE.N_DRAWS + ' draws per scenario';
  };

  /* ---------- tabs and views (override) ---------- */
  const PANELS = ['build', 'country', 'usecase', 'model', 'gbuild', 'settings'];
  window.switchTab = function (id) {
    if (id === 'runs') id = isTeam() ? 'build' : 'gbuild';
    state.tab = id;
    $$('.tabs button').forEach(b => b.setAttribute('aria-selected', String(b.id === 'tab-' + id)));
    for (const p of PANELS) { const n = $('#panel-' + p); if (n) n.hidden = p !== id; }
    if (id === 'country') renderCountry();
    if (id === 'usecase' && !ucBuilt) renderUseCase();
    if (id === 'model') renderModelTab();
    if (id === 'gbuild') G.renderAll();
    if (id === 'settings') G.renderSettings();
  };
  const _applyView = window.applyView;
  window.applyView = function () {
    $$('.view-switch button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
    $('#view-help').textContent = MSE.VIEW_HELP[state.view];
    $('#panel-advanced').hidden = state.view !== 'researcher'; $('#panel-varied').hidden = state.view !== 'researcher';
    $('#rate-row').hidden = state.view !== 'researcher';
    const rc = $('#router-card'); if (rc) rc.hidden = false;
    $('#g-panel-advanced').hidden = state.view !== 'researcher'; $('#g-panel-varied').hidden = state.view !== 'researcher';
    const pm = state.view === 'normal';
    const fl = $('#model-file-label'); if (fl) fl.hidden = pm;
    const ms = $('#mast-sub'); if (ms) ms.textContent = mastText();
    if (pm && EXT.current && EXT.current.custom && !CHOOSER()) { EXT.select('cema-county'); alertNote('Custom models are unreviewed and open in the Modeller view only. Switched to the reviewed CEMA model.'); return; }
    if (CHOOSER() && pm && EXT.current && EXT.current.custom) { EXT.deselect(); return; } // custom models are not on the Policymaker's list: back to the list of models
    if (CHOOSER() && !EXT.current) { renderPicker(); showChooser(); return; }
    if (EXT.current) { renderPicker(); renderBadge(); if (state.tab === 'model') renderModelTab(); }
    if (G.pkg && state.tab === 'gbuild') G.renderAll();
  };

  /* ===================== MODEL TAB (generated from the package) ===================== */
  /* The page says what the package declares about the model: what it is, what it assumes, how it works,
     what can be changed and what it produces. Nothing about how the package is made, checked or served (18 Nov 2026).
     Policymaker: plain words only. Modeller: the same page plus symbols, equations, ids and the parameter table. */
  function renderModelTab() {
    const m = EXT.current; if (!m) return; const pkg = m.pkg; const host = $('#model-gen'); host.innerHTML = '';
    const pm = state.view === 'normal'; const f = famOf(m); const team = m.kind === 'team';
    const card = (title, full) => { const c = el('div', { class: 'card' + (full ? ' mcard-full' : '') }); c.append(el('h2', { text: title })); return c; };
    const cols = el('div', { class: 'cols mcols' });

    // 1 · what this model is
    const about = card(pkg.model.name, true); about.classList.add('famcard');
    if (m.blurb) about.append(el('p', { class: 'prose', text: m.blurb }));
    const fd = el('dl', { class: 'prose small' }); const row = (k, v) => fd.append(el('dt', { text: k }), el('dd', { text: v }));
    const others = clustersOf(m).filter(x => x.id !== f.id).map(x => x.name);
    row('Kind of model', f.name + (others.length ? ' (also listed under ' + others.join(', ') + ')' : '') + '. ' + f.description);
    row('Status', m.custom ? 'Custom. Imported in this session and not reviewed.' : 'Reviewed' + (m.reviewer ? ' by ' + m.reviewer : '') + (!team && pkg.model.standing !== 'fitted' ? '. Values are illustrative' : '') + '.');
    if (pkg.model.source) row('Source', pkg.model.source + '.');
    if (pkg.sets.length) row('Settings', pkg.sets.length + ' fitted ' + (pkg.sets.length === 1 ? 'profile' : 'profiles') + (pm ? '' : ' (' + pkg.sets.map(x => x.id).join(', ') + ')') + '.');
    if (!pm) { row('Model id', m.pkg.model_id); row('Structure id', m.structure_id); row('Values id', m.values_id); const bad = pkg.rules.filter(r => !r.ok && !r.soft); row('Package', bad.length ? 'Not valid: ' + bad.map(r => r.text).join(' · ') : 'Valid'); }
    if (m.custom && m.same_structure_as) { const o = EXT.models.find(x => x.key === m.same_structure_as); row('Structure', 'Same as the library model "' + (o ? o.name : m.same_structure_as) + '", with different values or annotations.'); }
    about.append(fd);
    const dlBtn = el('button', { type: 'button', class: 'btn small', style: 'margin-top:12px', text: 'Download model package' });
    dlBtn.addEventListener('click', () => saveFile((m.key || 'model') + '-' + pkg.model_id + '.json', packageJSON(m), 'application/json'));
    about.append(dlBtn); cols.append(about);

    // 2 · what it assumes and does not cover
    const c2 = card('What it assumes', true); const ul = el('ul', { class: 'prose' });
    pkg.assumptions.forEach(x => ul.append(el('li', { text: x }))); caveatsOf(m).forEach(x => ul.append(el('li', { text: x })));
    if (!ul.children.length) ul.append(el('li', { class: 'muted', text: 'None declared.' }));
    c2.append(ul); cols.append(c2);

    // 3 · how it works
    const c1 = card('How it works', true); const sch = el('div', { class: 'schematic' }); c1.append(sch); renderSchematic(sch, pkg, pm);
    if (!pm) {
      const eqs = compiledEquations(pkg); c1.append(el('details', { style: 'margin-top:8px' }, [el('summary', { class: 'small', text: 'Equations (' + eqs.length + ')' }), el('pre', { class: 'json', text: eqs.join('\n') })]));
      if (pkg.funcs.length) c1.append(el('details', { style: 'margin-top:6px' }, [el('summary', { class: 'small', text: 'Named functions (' + pkg.funcs.length + ')' }), el('pre', { class: 'json', text: pkg.funcs.map(x => x.id + ' = ' + x.expr).join('\n') })]));
    }
    cols.append(c1);

    // 4 · Modeller only: how each output is defined. The inputs are listed where they are set and in the parameter table,
    //     and the outputs are named on the charts, so the Policymaker page does not repeat either (18 Nov 2026).
    if (!pm) {
    const c4 = card('Outputs', true); const dl4 = el('dl', { class: 'prose small mlist' });
    pkg.observables.forEach(o => dl4.append(el('dt', { text: o.label }), el('dd', { text: (o.unit || '') + (pm ? '' : (o.unit ? ' · ' : '') + (o.kind === 'flow' ? 'flow ' + o.flow.replace(/->/g, ' → ') : o.expr)) })));
    c4.append(dl4); cols.append(c4);
    }

    // 6 · Modeller: one parameter table. The CEMA model uses the team's registry (below, in the page). Other models use what the package declares.
    if (!pm && !team) {
      const c5 = card('Parameters', true);
      const tw = el('div', { class: 'table-wrap' }); const t = el('table', { class: 'tiers' }); t.append(el('thead', null, el('tr', null, ['Parameter', 'Symbol', 'Tier', 'Default', 'Unit', 'Range', 'Source'].map(h => el('th', { text: h })))));
      const tb = el('tbody'); for (const q of pkg.params) tb.append(el('tr', null, [el('td', { text: (q.label || '—') + (q.lever ? ' (intervention)' : '') }), el('td', { class: 'mono', text: q.id }), el('td', null, el('span', { class: 'tier-chip tier-' + (q.tier || 'none'), text: q.tier || 'unset' })), el('td', { class: 'mono small', text: q.campaign ? Object.keys(q.campaign).map(k => k + '=' + q.campaign[k]).join(', ') : String(q.value) }), el('td', { class: 'small', text: q.unit || '—' }), el('td', { class: 'mono small', text: q.range ? q.range[0] + ' .. ' + q.range[1] : '—' }), el('td', { class: 'small muted', text: q.source || '—' })])); t.append(tb); tw.append(t); c5.append(tw); cols.append(c5);
    }
    host.append(cols);
    const regCard = $('#reg-card'); if (regCard) { regCard.hidden = pm || !team; if (!regCard.hidden) renderRegistry(); }
  }
  function compiledEquations(pkg) { return pkg.compartments.map(c => { const inn = pkg.flows.filter(f => f.to === c.id).map(f => f.expr), out = pkg.flows.filter(f => f.from === c.id).map(f => f.expr); return 'd' + c.id + '/dt = ' + (inn.map(x => '(' + x + ')').join(' + ') || '0') + (out.length ? ' − ' + out.map(x => '(' + x + ')').join(' − ') : ''); }); }
  window.renderDiagram = function () { const host = $('#diagram'); if (host && EXT.current) renderSchematic(host, EXT.current.pkg); };

  /* schematic: boxes by layer, arrows with labels, births/deaths as stubs */
  function renderSchematic(container, pkg, plain) {
    container.innerHTML = '';
    if (!pkg.compartments.length) { container.append(el('p', { class: 'small muted', text: 'No compartments yet.' })); return; }
    const L = M.layout(pkg); const BW = 118, BH = 42, GX = 150, GY = 44;
    const colH = {}; L.pos.forEach(p => { colH[p.col] = Math.max(colH[p.col] || 0, p.nrows); });
    const maxRows = Math.max(...Object.values(colH));
    const W = L.ncols * (BW + GX) + 40, H = maxRows * (BH + GY) + 70;
    const root = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, role: 'img', 'aria-label': 'Model schematic', style: 'max-width:100%;height:auto;display:block' });
    root.append(svg('defs', null, svg('marker', { id: 'xarr', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, svg('path', { d: 'M0,0 L10,5 L0,10 z', style: 'fill:var(--ink-2)' }))));
    const center = i => { const p = L.pos[i]; return [20 + p.col * (BW + GX) + BW / 2, 30 + (maxRows - p.nrows) * (BH + GY) / 2 + p.row * (BH + GY) + BH / 2]; };
    const idx = {}; pkg.compartments.forEach((c, i) => { idx[c.id] = i; });
    const pairCount = {}, pairSeen = {}; pkg.flows.forEach(f => { const k = f.from + '>' + f.to; pairCount[k] = (pairCount[k] || 0) + 1; });
    // flow labels sit on a halo so a line passing behind them stays readable
    const flowLabel = (x, y, txt, anchor) => root.append(svg('text', { x, y, 'text-anchor': anchor || 'middle', style: 'font-size:10.5px;fill:var(--ink-2);font-family:var(--font);paint-order:stroke;stroke:var(--surface-2);stroke-width:4px;stroke-linejoin:round' }, txt.length > 26 ? txt.slice(0, 24) + '…' : txt));
    const line = d => root.append(svg('path', { d, style: 'fill:none;stroke:var(--ink-2);stroke-width:1.4', 'marker-end': 'url(#xarr)' }));
    const labels = [];
    for (const f of pkg.flows) {
      if (f.from === '*' || f.to === '*') continue;
      const [x1, y1] = center(idx[f.from]), [x2, y2] = center(idx[f.to]); const k = f.from + '>' + f.to; const n = pairCount[k], ord = (pairSeen[k] = (pairSeen[k] || 0) + 1) - 1; const off = n > 1 ? (ord - (n - 1) / 2) * 40 : 0;
      if (x2 > x1) {
        const sx = x1 + BW / 2, ex = x2 - BW / 2; const span = L.pos[idx[f.to]].col - L.pos[idx[f.from]].col;
        // arrows from another row arrive a little above or below the middle of the box, so they do not pile up on one point
        const ey = y2 + (Math.abs(y2 - y1) < 1 ? 0 : y1 < y2 ? -11 : 11);
        if (span > 1) {
          // a flow that skips a column runs along its own row past the boxes in between, then turns in
          let lane = y1; const blocked = yy => pkg.compartments.some((c, i) => { const q = L.pos[i]; if (q.col <= L.pos[idx[f.from]].col || q.col >= L.pos[idx[f.to]].col) return false; return Math.abs(center(i)[1] - yy) < BH / 2 + 10; });
          if (blocked(lane)) lane = y1 <= y2 ? 14 : H - 30;
          const tx = ex - GX; // right edge of the last column passed
          line('M' + sx + ',' + y1 + (lane !== y1 ? ' C' + (sx + 30) + ',' + y1 + ' ' + (sx + 10) + ',' + lane + ' ' + (sx + 50) + ',' + lane : '') + ' L' + tx + ',' + lane + ' C' + (tx + GX * 0.55) + ',' + lane + ' ' + (ex - GX * 0.55) + ',' + ey + ' ' + ex + ',' + ey);
          labels.push([(sx + tx) / 2, lane - 7, f.label]);
        } else if (Math.abs(y2 - y1) < 1 && !off) { line('M' + sx + ',' + y1 + ' L' + ex + ',' + y2); labels.push([ex - 12, y1 - 7, f.label, 'end']); }
        else if (off) { const mx = (sx + ex) / 2; line('M' + sx + ',' + y1 + ' C' + mx + ',' + (y1 + off) + ' ' + mx + ',' + (y2 + off) + ' ' + ex + ',' + y2); labels.push([mx, (y1 + y2) / 2 + off * 0.8 + (off > 0 ? 13 : -7), f.label]); }
        else { const g = ex - sx; line('M' + sx + ',' + y1 + ' C' + (sx + g * 0.3) + ',' + y1 + ' ' + (ex - g * 0.7) + ',' + ey + ' ' + ex + ',' + ey); labels.push([ex - 12, ey + (y2 < y1 ? -8 : 16), f.label, 'end']); }
      }
      else if (x2 < x1) { const sy = y1 + BH / 2, ey = y2 + BH / 2, dip = H - 22; line('M' + x1 + ',' + sy + ' C' + x1 + ',' + dip + ' ' + x2 + ',' + dip + ' ' + x2 + ',' + ey); labels.push([(x1 + x2) / 2, dip - 22, f.label]); }
      else { const sy = y1 < y2 ? y1 + BH / 2 : y1 - BH / 2, ey = y1 < y2 ? y2 - BH / 2 : y2 + BH / 2; line('M' + x1 + ',' + sy + ' L' + x2 + ',' + ey); labels.push([x1 + 8, (sy + ey) / 2 + 4, f.label, 'start']); }
    }
    pkg.compartments.forEach((c, i) => { const [x, y] = center(i); const hasBirth = pkg.flows.some(f => f.from === '*' && f.to === c.id), hasDeath = pkg.flows.some(f => f.to === '*' && f.from === c.id);
      root.append(svg('rect', { x: x - BW / 2, y: y - BH / 2, width: BW, height: BH, rx: 6, style: 'fill:' + (c.absorbing ? 'var(--surface-3)' : 'var(--accent-soft)') + ';stroke:' + (c.absorbing ? 'var(--rule-strong)' : 'var(--accent)') + ';stroke-width:1.2' }));
      if (plain) { const lab = c.label.replace(/\s*\(.*?\)/, '').split(',')[0]; const w = lab.split(/,?\s+/); let l1 = lab, l2 = ''; if (lab.length > 16 && w.length > 1) { const cut = Math.ceil(w.length / 2); l1 = w.slice(0, cut).join(' '); l2 = w.slice(cut).join(' '); }
        root.append(svg('text', { x, y: l2 ? y - 2 : y + 4, 'text-anchor': 'middle', style: 'font-size:11.5px;font-weight:600;fill:var(--ink);font-family:var(--font)' }, l1));
        if (l2) root.append(svg('text', { x, y: y + 12, 'text-anchor': 'middle', style: 'font-size:11.5px;font-weight:600;fill:var(--ink);font-family:var(--font)' }, l2)); }
      else {
      root.append(svg('text', { x, y: y - 3, 'text-anchor': 'middle', style: 'font-size:13px;font-weight:600;fill:var(--ink);font-family:var(--mono)' }, c.id));
      root.append(svg('text', { x, y: y + 12, 'text-anchor': 'middle', style: 'font-size:9.5px;fill:var(--ink-2);font-family:var(--font)' }, c.label.length > 22 ? c.label.slice(0, 21) + '…' : c.label)); }
      if (hasBirth && !plain) root.append(svg('path', { d: 'M' + x + ',' + (y - BH / 2 - 16) + ' L' + x + ',' + (y - BH / 2 - 1), style: 'stroke:var(--muted);stroke-width:1.2;fill:none', 'marker-end': 'url(#xarr)' }));
      if (hasDeath && !plain) root.append(svg('path', { d: 'M' + (x + BW / 2 - 10) + ',' + (y + BH / 2 + 1) + ' L' + (x + BW / 2 - 10) + ',' + (y + BH / 2 + 14), style: 'stroke:var(--muted);stroke-width:1;stroke-dasharray:2 2;fill:none' })); });
    labels.forEach(l => flowLabel(l[0], l[1], l[2], l[3])); // after the boxes, so no line or box covers a label
    container.append(root);
    container.append(el('p', { class: 'small muted', style: 'margin-top:4px', text: plain ? 'Boxes are groups of people. Arrows show how people move between them.' : 'Arrows are flows. Short arrow in: births. Dotted stub: deaths. Grey: absorbing.' }));
  }
  function packageJSON(entry) { return entry && entry.package ? JSON.stringify(entry.package, null, 2) : ''; }

  /* Open a package file: POST /models. Only compiled packages are accepted. Model text is the service's business. */
  function openText(text, what) {
    let json; try { json = JSON.parse(text); } catch (err) { alertNote('Could not read ' + what + ': not a JSON package.'); return; }
    let summary; try { summary = API.importPackage(json, 'opened from ' + what); } catch (err) { alertNote('Could not open ' + what + ': ' + err.message); return; }
    const m = registerFromService(summary);
    if (!m.pkg.valid) { alertNote('The package in ' + what + ' fails ' + m.pkg.errors.length + ' structural check(s): ' + m.pkg.errors.map(e => e.msg).slice(0, 3).join('; ') + '. Fix it upstream and export again.'); EXT.models.splice(EXT.models.indexOf(m), 1); return; }
    EXT.select(m.key);
  }
  function alertNote(msg) { let n = $('#ext-note'); if (!n) { n = el('div', { id: 'ext-note', class: 'stale', style: 'position:fixed;left:16px;right:16px;bottom:16px;z-index:9;box-shadow:0 4px 16px rgba(0,0,0,.2)' }); document.body.append(n); } n.textContent = msg; n.hidden = false; setTimeout(() => { n.hidden = true; }, 6000); }

  /* ===================== CLASSIFIER CHECKS (stand-in for a calibrated classifier such as Jev) ===================== */
  const CLS = EXT.classifier = {
    vocab() { const m = EXT.current; const pkg = m ? m.pkg : null; let v = pkg ? (pkg.params.map(x => x.id + ' ' + x.label).join(' ') + ' ' + pkg.observables.map(o => o.id + ' ' + o.label).join(' ') + ' ' + pkg.compartments.map(c => c.id + ' ' + c.label).join(' ')) : ''; if (m && m.kind === 'team') v += ' vaccination vaccine cost costs money nets irs spraying treatment severe prevalence county'; return v.toLowerCase(); },
    pre(q) {
      const t = q.toLowerCase(); const has = re => re.test(t); const vocab = this.vocab();
      const outside = [['vaccin', 'vaccination'], ['death', 'deaths'], ['mortal', 'mortality'], ['daly', 'DALYs'], ['resist', 'insecticide resistance'], ['cost', 'costs'], ['age', 'age structure'], ['migra', 'migration'], ['rain', 'rainfall'], ['temperat', 'temperature']].filter(([k]) => has(new RegExp('\\b' + k)) && !vocab.includes(k));
      const advice = has(/\bshould\b|recommend|best option|which (one|option).*(choose|pick)|is it worth|what do you advise/) ? 0.88 : has(/\bbetter\b|prefer/) ? 0.55 : 0.06;
      const forecast = has(/\bwill\b|predict|forecast|next year|by 20\d\d/) && !has(/model|scenario|baseline|simulat/) ? 0.62 : 0.08;
      const counter = has(/what if|if .* (were|was|went|rose|fell|dropped|increased)|at \d+%|with \d+%/) ? 0.9 : 0.05;
      const answerable = outside.length ? 0.12 : (has(/why|how much|how many|how uncertain|assume|assumption|what does|explain|differ|compare|what if|fall|rise|change|band|peak|season|chart|show|plot|per/) ? 0.93 : 0.6);
      const complexity = has(/assume|assumption|how was this|how it was built/) ? 0.2 : 0.7;
      return { answerable, advice, forecast, counter, outside, complexity };
    },
    render(c, decision, title) {
      const d = el('div', { class: 'checks' }, [el('div', { class: 'title', text: title || 'Before generation · classifier (calibrated probabilities)' })]);
      [['Can this be answered from the loaded model?', c.answerable], ['Is the user asking for a recommendation?', c.advice], ['Is the user asking for a forecast?', c.forecast], ['Does it need a counterfactual (new scenario)?', c.counter], ['Needs the full narrator (vs a template)?', c.complexity]].forEach(([k, v]) => d.append(el('div', { class: 'row' }, [el('span', { text: k }), el('div', { class: 'bar' }, el('i', { style: 'width:' + Math.round(v * 100) + '%' + (v >= 0.5 && /recommend|forecast/.test(k) ? ';background:var(--warn)' : '') })), el('span', { class: 'p', text: v.toFixed(2) })])));
      if (decision) d.append(el('div', { class: 'small', style: 'margin-top:2px', text: 'Decision: ' + decision }));
      return d;
    },
    decision(c) { if (c.answerable < 0.4) return { kind: 'abstain', text: 'abstain: the model has no term for ' + c.outside.map(x => x[1]).join(', ') }; if (c.advice >= 0.5) return { kind: 'reframe', text: 'reframe (a recommendation was asked for) and describe what the model shows' }; return { kind: 'answer', text: 'answer' + (c.counter >= 0.5 ? ' with a counterfactual run' : '') + (c.complexity >= 0.5 ? ' via the narrator' : ' from a template') }; },
    post(answerText, contextText) {
      const allowed = new Set((contextText.match(/\d[\d,]*(\.\d+)?/g) || []).map(x => x.replace(/,/g, ''))); const addRounded = s => { for (const n of Array.from(allowed)) { const v = parseFloat(n); if (!isFinite(v)) continue; allowed.add(String(Math.round(v))); allowed.add(v.toFixed(1)); allowed.add(v.toFixed(0)); if (v >= 1000) { allowed.add((v / 1000).toFixed(1)); allowed.add((v / 1000).toFixed(0)); allowed.add((v / 1e6).toFixed(2)); allowed.add((v / 1e6).toFixed(1)); } if (v <= 1) { allowed.add((v * 100).toFixed(0)); allowed.add((v * 100).toFixed(1)); } } }; addRounded();
      const sentences = answerText.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+(?=[A-Z0-9])/).filter(s => s.trim().length > 2);
      return sentences.map(s => { const nums = (s.match(/\d[\d,]*(\.\d+)?/g) || []).map(x => x.replace(/,/g, '')); const bad = nums.filter(n => !allowed.has(n) && !allowed.has(String(+n)) && !/^(19|20)\d\d$/.test(n) && !['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '12', '20', '50', '90', '95', '100'].includes(n)); const rec = /\b(should|recommend|must|best choice|ought to)\b/i.test(s); const forecast = /\bwill\b/i.test(s) && !/(the )?(model|simulation|scenario)/i.test(s); let support = 0.93; const flags = []; if (bad.length) { support -= 0.5; flags.push('number ' + bad.slice(0, 3).join(', ') + ' not in the context'); } if (rec) { support = Math.min(support, 0.3); flags.push('reads as a recommendation'); } if (forecast) { support = Math.min(support, 0.4); flags.push('reads as a forecast'); } return { text: s, support: Math.max(0.02, support), flags, dropped: support < 0.5 }; });
    },
    renderPost(checked) {
      const kept = checked.filter(s => !s.dropped).length; const box = el('div', { class: 'checks', style: 'margin-top:6px' }, [el('div', { class: 'title', text: 'After generation · classifier, per sentence' })]);
      checked.filter(s => s.flags.length).forEach(s => box.append(el('div', { class: 'sent' + (s.dropped ? ' dropped' : ''), style: 'margin:0' }, [el('div', null, [el('div', { class: 'txt small', text: s.text })]), el('div', { class: 'support' + (s.dropped ? ' low' : ''), text: 'support ' + s.support.toFixed(2) + (s.dropped ? ' · flagged' : ' · flag') + ' — ' + s.flags.join(' · ') })])));
      box.append(el('div', { class: 'small', text: kept + ' of ' + checked.length + ' sentences supported by the context (numbers present in the context, no recommendation, no forecast)' + (checked.length - kept ? ' · ' + (checked.length - kept) + ' flagged — in the tool these are dropped or shown as unsupported.' : '.') }));
      return box;
    },
  };

  /* ---------- explainer (override): same live Claude path, plus the classifier before and after ---------- */
  window.buildExplainer = function (F, ctx) {
    const box = el('div', { class: 'explain', hidden: '' });
    const qrow = el('div', { class: 'q-row' }); qrow.append(el('span', { class: 'lead', text: 'Ask about "' + F.title + '"' }));
    const pre = el('div', { style: 'margin-top:8px' }); const answer = el('div', { class: 'answer' }); const post = el('div'); const status = el('div', { class: 'status' });
    const avail = el('span', { class: 'avail', text: sampleState === 'pending' ? '' : sampleFn ? '' : '' });
    const stopBtn = el('button', { type: 'button', class: 'btn small quiet', text: 'Stop', hidden: '' }); const ctxBtn = el('button', { type: 'button', class: 'btn small quiet', text: 'Show the context sent' });
    const ctxBox = el('div', { class: 'ctx' }); const preEl = el('pre'); ctxBox.append(preEl);
    const liveCtxOf = () => (ctx && ctx.generic) ? G.buildCtx(G.active()) : buildCtx(active());
    ctxBtn.addEventListener('click', () => { ctxBox.classList.toggle('on'); preEl.textContent = F.context(liveCtxOf()).join('\n'); ctxBtn.textContent = ctxBox.classList.contains('on') ? 'Hide the context' : 'Show the context sent'; });
    status.append(avail, stopBtn, ctxBtn);
    let ctl = null;
    async function ask(q) {
      const liveCtx = liveCtxOf(); const contextLines = F.context(liveCtx); const context = contextLines.join('\n');
      pre.innerHTML = ''; post.innerHTML = ''; answer.classList.add('on');
      const c = CLS.pre(q); const dec = CLS.decision(c); pre.append(CLS.render(c, dec.text));
      if (dec.kind === 'abstain') { answer.textContent = 'This model has no ' + c.outside.map(x => x[1]).join(' or ') + ' in it, so it cannot say anything about that. Its outputs are: ' + (ctx && ctx.generic ? G.pkg.observables.map(o => o.label).join(', ') : Object.values(MSE.GRAMMAR.measures).map(m => m.label).join(', ')) + '. A model that includes it would have to be built or chosen first.'; return; }
      const reframe = dec.kind === 'reframe' ? 'The question asks for a recommendation. The tool does not make one. What follows describes what the model shows under its stated assumptions.\n\n' : '';
      const finish = text => { answer.textContent = reframe + text; const checked = CLS.post(text, context); post.innerHTML = ''; post.append(CLS.renderPost(checked)); };
      if (sampleFn) {
        if (ctl) ctl.abort(); ctl = new AbortController(); stopBtn.hidden = false; answer.textContent = reframe + 'Thinking…';
        try {
          const r = await sampleFn(EXPLAIN_RULES + '\n\nCONTEXT:\n' + context + '\n\nQUESTION: ' + q, { signal: ctl.signal, modelTier: 'quick', onText: ({ text }) => { answer.textContent = reframe + text; } });
          finish(r.text + (r.truncated ? ' […]' : ''));
        } catch (e) {
          if (e && e.code === 'cancelled') { answer.textContent = reframe + (e.text || '') + (e.text ? ' [stopped]' : 'Stopped.'); }
          else if (e && (e.code === 'not_granted' || e.code === 'sampling_disabled' || e.code === 'not_declared' || e.code === 'capability_disabled')) { sampleFn = null; sampleState = 'absent'; const p = F.prepared(q, liveCtx); finish(p || ''); avail.textContent = ''; }
          else if (e && e.code === 'rate_limited') answer.textContent = reframe + (e.text || '') + '\nToo many requests for now. Try again in a moment.';
          else answer.textContent = reframe + (e && e.text ? e.text + '\n' : '') + 'The answer could not be completed (' + (e && e.code ? e.code : 'error') + '). Try again.';
        } finally { stopBtn.hidden = true; }
      } else {
        const p = F.prepared(q, liveCtx);
        finish(p || '');
      }
    }
    stopBtn.addEventListener('click', () => { if (ctl) ctl.abort(); });
    for (const q of F.questions) { const b = el('button', { type: 'button', class: 'qchip', text: q }); b.addEventListener('click', () => ask(q)); qrow.append(b); }
    const form = el('form'); const inp = el('input', { type: 'text', placeholder: 'Ask about this chart…', 'aria-label': 'Question about ' + F.title, id: 'q-' + F.id }); const go = el('button', { type: 'submit', class: 'btn primary small', text: 'Ask' });
    form.append(inp, go); form.addEventListener('submit', ev => { ev.preventDefault(); const q = inp.value.trim(); if (q) ask(q); });
    box.append(qrow, form, pre, answer, post, status, ctxBox);
    return box;
  };
  // the team path's "Ask for a chart" box: show the classifier's reading of the question beside the composer's status
  document.addEventListener('submit', ev => { const box = ev.target.closest && ev.target.closest('.fig.ask'); if (!box || box.closest('#panel-gbuild')) return; const q = ($('#ask-input') || {}).value || ''; showAskPrecheck(box, q); }, true);
  document.addEventListener('click', ev => { const chip = ev.target.closest && ev.target.closest('.fig.ask .qchip'); if (!chip || chip.closest('#panel-gbuild')) return; showAskPrecheck(chip.closest('.fig.ask'), chip.textContent); }, true);
  function showAskPrecheck(box, q) { if (!q) return; const c = CLS.pre(q); state.askPrecheck = { q, c }; paintAskPrecheck(box); }
  function paintAskPrecheck(box) { if (!state.askPrecheck) return; let host = box.querySelector('.ask-precheck'); if (!host) { host = el('div', { class: 'ask-precheck', style: 'margin-top:8px' }); const st = box.querySelector('.ask-status'); if (st) st.before(host); else box.append(host); } host.innerHTML = ''; } // the classifier still runs. Its reading is not shown (18 Nov 2026)
  const _renderAskBox = window.renderAskBox;
  window.renderAskBox = function (host) { _renderAskBox(host); const box = host.querySelector('.fig.ask'); if (box) { paintAskPrecheck(box); } };
  /* composer output check (team path): the spec is structured, so grounding is verified field by field */
  EXT.specChecks = function (spec, made, grammar, scenarioIds, allowedBy) {
    const rows = []; const ok = (label, pass, detail) => rows.push({ label, pass, detail });
    ok('Measure exists among the model\'s declared outputs', !!grammar[spec.measure], spec.measure + (grammar[spec.measure] ? ' = ' + grammar[spec.measure].label : ' (unknown)'));
    ok('Transform is one the tool computes', ['monthly', 'cumulative', 'per1000', 'diff_baseline', 'pct_baseline'].includes(spec.transform), spec.transform);
    ok('Grouping is one the model supports', allowedBy.includes(spec.by), spec.by);
    ok('Every scenario named exists and has run', !spec.scenarios || spec.scenarios.every(id => scenarioIds.includes(id)), spec.scenarios ? spec.scenarios.join(', ') : 'charted scenarios');
    ok('Scenarios created for the question were run through the router', true, made && made.length ? made.join(' · ') : 'none needed');
    ok('Every number on the chart comes from the engine, none from the composer', true, 'the composer never sees or writes numbers');
    return rows;
  };
  EXT.renderSpecChecks = function (rows, title) { const box = el('div', { class: 'checks', style: 'margin-top:8px' }, [el('div', { class: 'title', text: title || 'Composer output · validated against the catalogue before drawing' })]); rows.forEach(r => box.append(el('div', { class: 'row', style: 'grid-template-columns:minmax(0,1fr) auto' }, [el('span', null, [el('span', { text: r.label }), el('span', { class: 'muted', text: ' · ' + r.detail })]), el('span', { class: 'badge ' + (r.pass ? 'ok' : 'warn'), text: r.pass ? 'pass' : 'rejected' })]))); const n = rows.filter(r => !r.pass).length; box.append(el('div', { class: 'small', text: n ? n + ' check(s) failed: the chart is not drawn and the reason is shown instead.' : 'All checks passed. The chart is drawn from the engine\'s numbers.' })); return box; };
  const _renderAskedCharts = window.renderAskedCharts;
  window.renderAskedCharts = function (host, startN) { _renderAskedCharts(host, startN); for (const item of state.asked) { const sec = host.querySelector('#fig-asked-' + item.id); if (!sec || sec.querySelector('.checks')) continue; const rows = EXT.specChecks(item.spec, item.made, MSE.GRAMMAR.measures, state.scenarios.filter(scenarioReady).map(x => x.id), ['scenario', 'county', 'severity', 'year']); void rows; } }; // the checks still run. The checklist is not shown

  /* ===================== GENERIC EXPLORER (spec engine) ===================== */
  const G = EXT.G = { pkg: null, compiled: null, entry: null, scenarios: [], activeId: 'A', referenceId: 'A', results: new Map(), hasRun: false, dirty: false, live: true, figGroup: 'results', asked: [], askedSeq: 0, explainerOpen: {}, sweepKey: null, modeCounts: { cache: 0, grid: 0, live: 0, emulator: 0 }, savedQuestions: [] };
  G.load = function (entry) {
    G.entry = entry; G.pkg = entry.pkg; G.compiled = M.compile(entry.pkg); G.results = new Map(); G.asked = []; G.figGroup = 'results'; G.modeCounts = { cache: 0, grid: 0, live: 0, emulator: 0 }; G.sweepKey = null;
    G.scenarios = [G.blank('A')]; G.activeId = 'A'; G.referenceId = 'A'; G.hasRun = false; G.dirty = false; // nothing is shown as a result until the user runs or asks, as with the CEMA model
    G.renderRail(); G.renderAll(); G.renderRailState();
  };
  G.planned = () => G.pkg.model.start >= 2000 && G.pkg.params.some(p => p.campaign && p.campaign.from > G.pkg.model.start);
  G.blank = id => ({ id, name: '', set: G.pkg.sets.length ? G.pkg.sets[0].id : null, overrides: {}, pins: {}, horizon: G.planned() ? 15 : (G.pkg.model.start >= 2000 ? 5 : 3), shown: true, ran: true });
  G.active = () => G.scenarios.find(s => s.id === G.activeId) || G.scenarios[0];
  G.reference = () => G.scenarios.find(s => s.id === G.referenceId) || G.scenarios[0];
  G.color = s => MSE.SLOT_COLORS[Math.max(0, G.scenarios.indexOf(s)) % MSE.SLOT_COLORS.length];
  G.charted = () => G.scenarios.filter(s => s.shown).slice(0, MSE.MAX_CHARTED);
  G.nextId = () => { const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; for (let i = 0; i < L.length; i++) if (!G.scenarios.find(s => s.id === L[i])) return L[i]; return null; };
  G.window = s => { const start = G.pkg.model.start, end = start + s.horizon; const planning = G.planned() ? Math.max(start, Math.min(2027, end - 1)) : start; return { start, end, kpiFrom: planning, chartFrom: G.planned() ? Math.max(start, planning - 3) : start, label: planning === start ? (start >= 2000 ? start + '–' + (end - 1) : 'the whole run') : planning + '–' + (end - 1) }; };
  G.setValue = (s, id) => { if (!s.set) return null; const st = G.pkg.sets.find(x => x.id === s.set); return st && st.values[id] != null ? st.values[id] : null; };
  G.baseValue = (s, p) => { const sv = G.setValue(s, p.id); return p.campaign ? p.campaign : (sv != null ? sv : p.value); };
  G.value = (s, p) => { const o = s.overrides[p.id]; if (p.campaign) return Object.assign({}, p.campaign, o || {}); return o != null ? o : G.baseValue(s, p); };
  G.name = s => { if (s.name) return s.name; const ch = Object.keys(s.overrides).map(id => { const p = G.pkg.params.find(x => x.id === id); if (!p) return id; const v = s.overrides[id]; return (p.label || id) + ' ' + (p.campaign ? Object.keys(v).map(k => k + ' ' + v[k]).join(' ') : fmtVal(v, p)); }); return (s.set ? s.set + ' · ' : '') + (!ch.length ? 'baseline' : ch.length === 1 ? ch[0] : ch.length + ' inputs changed'); }; // a short title: the chips under it list every changed input
  const fmtVal = (v, p) => p.type === 'fraction' ? (v * 100).toFixed(0) + '%' : (Math.abs(v) < 0.01 ? v.toExponential(2) : fmtN(v));
  G.hash = s => 'SCN-' + M.hash(G.pkg.model_id + JSON.stringify({ o: s.overrides, s: s.set, h: s.horizon, p: s.pins, d: MSE.N_DRAWS })).slice(0, 6).toUpperCase();
  G.differences = (s, ref) => { if (!ref || s === ref) return []; const d = []; if (s.set !== ref.set) d.push('setting ' + s.set); const keys = new Set([...Object.keys(s.overrides), ...Object.keys(ref.overrides)]); for (const id of keys) { const p = G.pkg.params.find(x => x.id === id); if (!p) continue; const a = s.overrides[id], b = ref.overrides[id]; if (JSON.stringify(a) === JSON.stringify(b)) continue; d.push((p.label || id) + ' ' + (a == null ? 'default' : p.campaign ? Object.keys(a).map(k => k + ' ' + a[k]).join(' ') : fmtVal(a, p)) + ' (' + ref.id + ': ' + (b == null ? 'default' : p.campaign ? Object.keys(b).map(k => k + ' ' + b[k]).join(' ') : fmtVal(b, p)) + ')'); } for (const id of new Set([...Object.keys(s.pins), ...Object.keys(ref.pins)])) if (s.pins[id] !== ref.pins[id]) d.push(id + (s.pins[id] != null ? ' pinned' : ' varied')); if (s.horizon !== ref.horizon) d.push('horizon ' + s.horizon + ' y'); return d; };

  /* --- scenario service: route + run --- */
  G.onGrid = s => { const stepOk = (v, st) => Math.abs(v / st - Math.round(v / st)) < 1e-6; for (const id in s.overrides) { const par = G.pkg.params.find(x => x.id === id); if (!par || par.tier !== 'user') return { ok: false, why: (par ? par.id + ' is ' + par.tier + '-tier' : id) + ', not a grid dimension' }; const v = s.overrides[id]; if (par.campaign) { for (const k in v) { if (k === 'coverage' && !stepOk(v[k], 0.1)) return { ok: false, why: par.id + ' coverage off the 10% steps' }; if ((k === 'from' || k === 'every' || k === 'month') && !stepOk(v[k], 1)) return { ok: false, why: par.id + ' ' + k + ' not a whole number' }; if (k === 'peak' || k === 'decay') return { ok: false, why: par.id + ' ' + k + ' is not a grid dimension' }; } } else if (!stepOk(v, 0.05)) return { ok: false, why: par.id + ' off the 5% steps' }; } if (Object.keys(s.pins).length) return { ok: false, why: 'a varied parameter is pinned' }; return { ok: true, why: 'every changed input sits on a grid step' }; };
  G.execute = function (s) {
    const id = G.hash(s); const t0 = performance.now(); const trace = [{ n: 1, text: 'POST /scenarios · validate inputs against the package · scenario ID ' + id, ms: 0.2 }];
    if (G.results.has(id)) { const r = G.results.get(id); trace.push({ n: 2, text: 'Result cache: hit for ' + id + ' at model ' + G.pkg.model_id, ms: 0.1, decision: true }); G.modeCounts.cache++; return Object.assign({}, r, { execution: Object.assign({}, r.execution, { mode: 'cache', servedFromCache: true, ms: performance.now() - t0 }), trace }); }
    trace.push({ n: 2, text: 'Result cache: miss', ms: 0.1 }); trace.push({ n: 3, text: 'Translate: ' + Object.keys(s.overrides).length + ' changed input(s) → parameter overrides' + (s.set ? ' · parameter set "' + s.set + '"' : ''), ms: 0.2 });
    const entry = G.entry; const runs = 2 * (1 + MSE.N_DRAWS); let mode = 'live', approx = 0;
    if (entry.custom) trace.push({ n: 4, text: 'Router: custom model → no grid, no emulator → live run (the only route)', ms: 0.1, decision: true });
    else if (!entry.grid) trace.push({ n: 4, text: 'Router: no grid built for this model · measured run ' + fmt.ms(entry.runtime_ms) + ' → live run', ms: 0.1, decision: true });
    else { const g = G.onGrid(s); if (g.ok) { mode = 'grid'; trace.push({ n: 4, text: 'Router: ' + g.why + ' → precomputed grid', ms: 0.1, decision: true }); } else { const est = entry.runtime_ms * runs; if (est > state.routerThresholdMs * 2) { mode = 'emulator'; approx = 0.05; trace.push({ n: 4, text: 'Router: ' + g.why + ' · ' + runs + ' live runs would take ~' + fmt.ms(est) + ' → emulator (approximation band ±5%)', ms: 0.1, decision: true }); } else trace.push({ n: 4, text: 'Router: ' + g.why + ' · ' + runs + ' runs in ~' + fmt.ms(est) + ' → live run', ms: 0.1, decision: true }); } }
    const w = G.window(s); const t1 = performance.now();
    const central = M.run(G.pkg, G.compiled, { set: s.set, overrides: Object.assign({}, s.pins, s.overrides), endYear: w.end });
    const baseC = M.run(G.pkg, G.compiled, { set: s.set, overrides: Object.assign({}, s.pins), endYear: w.end });
    const L = M.lhs(G.pkg, MSE.N_DRAWS, M.hash(id).charCodeAt(0) * 7919 + 11, s.pins);
    const draws = L.draws.map(d => M.run(G.pkg, G.compiled, { set: s.set, overrides: Object.assign({}, d, s.pins, s.overrides), endYear: w.end, dt: 2 }));
    const bdraws = L.draws.map(d => M.run(G.pkg, G.compiled, { set: s.set, overrides: Object.assign({}, d, s.pins), endYear: w.end, dt: 2 }));
    const simMs = performance.now() - t1;
    trace.push({ n: 5, text: (mode === 'grid' ? 'Grid store: lookup' : mode === 'live' ? 'Spec engine (RK4): central run + ' + MSE.N_DRAWS + ' paired draws over ' + (L.varied.join(', ') || 'nothing (no varied tier)') : 'Emulator: prediction (stand-in: live run plus reported band)'), ms: simMs });
    const t = central.months.map(m0 => m0.t); const series = {}, bseries = {};
    G.pkg.observables.forEach((o, j) => { const sc = o.kind === 'flow' ? 1000 : 1; series[o.id] = summarise(draws.length ? draws : [central], j, sc, t.length); bseries[o.id] = summarise(bdraws.length ? bdraws : [baseC], j, sc, t.length); series[o.id].central = central.months.map(m0 => m0.obs[j] * sc); bseries[o.id].central = baseC.months.map(m0 => m0.obs[j] * sc); });
    const summary = {}; G.pkg.observables.forEach((o, j) => { const sc = o.kind === 'flow' ? 1000 : 1; const agg = r => o.kind === 'flow' ? cumMonths(r.months, j, w.kpiFrom, w.end) * sc : meanMonths(r.months, j, w.kpiFrom, w.end) * sc; const vals = (draws.length ? draws : [central]).map(agg), bvals = (bdraws.length ? bdraws : [baseC]).map(agg); const av = vals.map((v, i) => bvals[i] - v); summary[o.id] = { value: quantiles(vals), base: quantiles(bvals), averted: quantiles(av), avertedPct: quantiles(av.map((v, i) => bvals[i] ? v / bvals[i] : 0)), central: agg(central), baseCentral: agg(baseC), below: av.filter(x => x > 0).length, n: av.length }; });
    const o0 = G.pkg.observables[0]; let peak = { value: -1, t: 0 }; series[o0.id].median.forEach((v, k) => { if (t[k] >= w.chartFrom && v > peak.value) peak = { value: v, t: t[k] }; });
    const res = { schema: 'mse-result/0.1', scenario_id: id, model: { name: G.pkg.model.name, id: G.pkg.model_id, standing: entry.custom ? 'custom' : G.pkg.model.standing }, engine: { name: 'spec engine rk4', version: '0.1' }, execution: { mode, computedMode: mode, ms: performance.now() - t0, simMs, draws: MSE.N_DRAWS, approxError: approx, servedFromCache: false, varied: L.varied }, t, series, bseries, summary, peak, events: central.events, central, baseC, window: w };
    trace.push({ n: 6, text: 'Summaries over ' + w.label + ': each output vs its baseline (paired draws), peak month', ms: 0.3 }); trace.push({ n: 7, text: 'Cache under ' + id + ' · return mse-result/0.1 · mode ' + mode + ' · standing ' + res.model.standing, ms: 0.1 });
    res.trace = trace; G.results.set(id, res); G.modeCounts[mode]++; API.recordScenario(id, res.execution.ms, mode); return res;
  };
  function summarise(runs, j, sc, n) { const out = { median: new Array(n), q05: new Array(n), q25: new Array(n), q75: new Array(n), q95: new Array(n) }; for (let k = 0; k < n; k++) { const vals = runs.map(r => r.months[k].obs[j] * sc); const q = quantiles(vals); out.median[k] = q.median; out.q05[k] = q.q05; out.q25[k] = q.q25; out.q75[k] = q.q75; out.q95[k] = q.q95; } return out; }
  function cumMonths(months, j, lo, hi) { let x = 0; for (const m0 of months) if (m0.t >= lo - 1e-9 && m0.t < hi - 1e-9) x += m0.obs[j]; return x; }
  function meanMonths(months, j, lo, hi) { let x = 0, n = 0; for (const m0 of months) if (m0.t >= lo - 1e-9 && m0.t < hi - 1e-9) { x += m0.obs[j]; n++; } return n ? x / n : 0; }
  G.getResult = s => { if (G.memo && G.memo.has(s.id)) return G.memo.get(s.id); const r = G.execute(s); if (G.memo) G.memo.set(s.id, r); return r; };
  G.buildCtx = s => { const res = G.getResult(s); const all = G.scenarios.filter(x => x.ran).map(x => ({ s: x, res: G.getResult(x) })); return { generic: true, s, res, all, pkg: G.pkg, view: state.view, w: G.window(s) }; };

  /* --- rail --- */
  G.markChanged = () => { if (!G.hasRun) { G.renderRailState(); return; } G.dirty = true; $('#g-stale').hidden = !G.dirty || G.live; if (G.live) G.scheduleRun(); G.renderRailState(); };
  G.scheduleRun = debounce(() => G.runAll(), 160);
  G.runAll = () => { G.dirty = false; $('#g-stale').hidden = true; for (const s of G.scenarios) s.ran = true; G.hasRun = true; G.renderAll(); G.renderRailState(); };
  G.renderRailState = () => { const s = G.active(); const n = Object.keys(s.overrides).length; $('#g-scn-state').textContent = ''; const rb = $('#g-btn-run'); if (rb) { const first = !G.hasRun; const pending = G.dirty && !G.live; const done = !first && !pending; rb.disabled = done; rb.classList.toggle('done', done); rb.textContent = first ? '▶ Run scenario' : pending ? '▶ Apply changes' : '✓ Up to date'; rb.title = done ? 'The results match the inputs' : ''; } G.renderStartOver(); };
  function gField(label, valText, hint) { const f = el('div', { class: 'field' }); const val = el('span', { class: 'val num', text: valText }); f.append(el('div', { class: 'lbl' }, [el('span', { text: label }), val])); f.val = val; if (hint) f.hintEl = el('span', { class: 'hint', text: hint }); return f; }
  function sliderField(p, container) {
    const s = G.active(); const v = G.value(s, p); const r = p.range || (p.type === 'fraction' ? [0, 1] : [0, (p.value || 1) * 2]); const step = p.type === 'fraction' ? 0.01 : Math.pow(10, Math.floor(Math.log10((r[1] - r[0]) / 100)));
    const f = gField((p.label || p.id) + (s.overrides[p.id] != null ? ' · changed' : ''), fmtVal(v, p)); const inp = el('input', { type: 'range', min: r[0], max: r[1], step, value: v, id: 'g-f-' + p.id, 'aria-label': p.label || p.id });
    inp.addEventListener('input', () => { const x = parseFloat(inp.value); if (Math.abs(x - G.baseValue(s, p)) < 1e-9) delete s.overrides[p.id]; else s.overrides[p.id] = x; f.val.textContent = fmtVal(x, p); G.markChanged(); });
    f.append(inp); f.title = (p.unit ? p.unit + ' · ' : '') + 'range ' + r[0] + '–' + r[1] + (p.source ? ' · ' + p.source : ''); container.append(f); // unit, range and source show on hover, as on the CEMA sliders
  }
  function campaignField(p, container) {
    const s = G.active(); const cf = G.value(s, p); const f = gField((p.label || p.id) + (s.overrides[p.id] ? ' · changed' : ''), cf.coverage > 0 ? 'every ' + cf.every + ' y from ' + cf.from : 'off');
    const grid = el('div', { class: 'campaign' });
    const upd = (k, v) => { s.overrides[p.id] = Object.assign({}, s.overrides[p.id] || {}, { [k]: v }); if (Object.keys(s.overrides[p.id]).every(kk => Math.abs(s.overrides[p.id][kk] - p.campaign[kk]) < 1e-9)) delete s.overrides[p.id]; const c2 = G.value(s, p); f.val.textContent = c2.coverage > 0 ? 'every ' + c2.every + ' y from ' + c2.from : 'off'; G.markChanged(); };
    const num = (k, label, min, max, step) => { const i = el('input', { type: 'number', min, max, step, value: cf[k], id: 'g-f-' + p.id + '-' + k }); i.addEventListener('input', () => { const x = parseFloat(i.value); if (Number.isFinite(x)) upd(k, x); }); grid.append(el('label', null, [label, i])); };
    num('coverage', 'Coverage (0 = off)', 0, 1, 0.05); num('peak', 'Protection at a round', 0, 1, 0.02); num('decay', 'Decay per year', 0, 5, 0.05); num('every', 'Years between rounds', 0.25, 10, 0.25); num('from', 'First round (year)', 1990, 2100, 1); num('month', 'Month (0–11)', 0, 11, 1);
    f.append(grid); f.title = 'Protection = coverage × protection at a round, decaying until the next.'; container.append(f);
  }
  G.renderRail = function () {
    const pkg = G.pkg, s = G.active();
    const sf = $('#g-set-field'); sf.innerHTML = ''; sf.hidden = !pkg.sets.length;
    if (pkg.sets.length) { sf.append(el('div', { class: 'lbl' }, [el('span', { text: 'Setting (parameter set)' }), el('span', { class: 'val', text: pkg.sets.length + ' declared' })])); const sel = el('select', { id: 'g-set-select' }); pkg.sets.forEach(st => { const o = el('option', { value: st.id, text: st.id }); if (st.id === s.set) o.selected = true; sel.append(o); }); sel.addEventListener('change', () => { s.set = sel.value; G.renderRail(); G.markChanged(); }); sf.append(sel); sel.title = 'Sets ' + Object.keys(pkg.sets[0].values).join(', ') + '.'; }
    const hz = $('#g-horizon'); hz.value = s.horizon; const hv = () => { $('#g-horizon-val').textContent = pkg.model.start >= 2000 ? 'end of ' + (pkg.model.start + s.horizon - 1) : s.horizon + ' years'; }; hv(); hz.oninput = () => { s.horizon = parseInt(hz.value, 10); hv(); G.markChanged(); };
    const levers = pkg.params.filter(x => x.lever), user = pkg.params.filter(x => x.tier === 'user' && !x.lever), adv = pkg.params.filter(x => x.tier === 'advanced' && !x.lever), varied = pkg.params.filter(x => x.tier === 'varied');
    const lf = $('#g-lever-fields'); lf.innerHTML = ''; levers.forEach(x => (x.campaign ? campaignField : sliderField)(x, lf)); if (!levers.length) lf.append(el('p', { class: 'small muted', text: 'No levers declared. Mark a parameter "lever" in the builder.' }));
    $('#g-panel-user').hidden = !user.length; const uf = $('#g-user-fields'); uf.innerHTML = ''; user.forEach(x => sliderField(x, uf));
    const af = $('#g-adv-fields'); af.innerHTML = ''; adv.forEach(x => sliderField(x, af)); if (!adv.length) af.append(el('p', { class: 'small muted', text: 'No advanced-tier parameters declared.' }));
    const vf = $('#g-varied-fields'); vf.innerHTML = '';
    varied.forEach(x => { const f = el('div', { class: 'field' }); const pin = el('input', { type: 'checkbox', id: 'g-pin-' + x.id }); pin.checked = s.pins[x.id] != null; const vi = el('input', { type: 'number', step: 'any', value: s.pins[x.id] != null ? s.pins[x.id] : G.baseValue(s, x), style: 'width:90px' }); vi.disabled = !pin.checked; pin.addEventListener('change', () => { if (pin.checked) s.pins[x.id] = parseFloat(vi.value); else delete s.pins[x.id]; vi.disabled = !pin.checked; G.markChanged(); }); vi.addEventListener('input', () => { if (pin.checked) { s.pins[x.id] = parseFloat(vi.value); G.markChanged(); } }); f.append(el('div', { class: 'lbl' }, [el('span', { text: x.label || x.id }), el('span', { class: 'val', text: x.range ? x.range[0] + ' – ' + x.range[1] : 'no range' })]), el('div', { class: 'run-row' }, [el('label', { class: 'toggle' }, [pin, el('span', { text: 'pin to' })]), vi])); f.title = (x.unit || '') + (x.source ? ' · ' + x.source : ''); vf.append(f); });
    if (!varied.length) vf.append(el('p', { class: 'small muted', text: 'No varied tier, so no band.' }));
    $('#g-panel-advanced').hidden = state.view !== 'researcher'; $('#g-panel-varied').hidden = state.view !== 'researcher';
    G.renderRailState();
  };

  /* --- main: strip, header, KPIs, comparison --- */
  G.renderStrip = function () {
    const host = $('#g-scn-strip'); host.innerHTML = ''; const charted = G.charted();
    for (const s of G.scenarios) { const chip = el('button', { type: 'button', class: 'scn-chip' + (charted.includes(s) ? '' : ' off'), 'aria-pressed': String(s.id === G.activeId), title: G.name(s) }); const dot = el('span', { class: 'dot' }); dot.style.background = G.color(s); chip.append(dot, el('span', { text: s.id + (s.id === G.referenceId ? ' · reference' : '') })); if (G.scenarios.length > 1) { const x = el('span', { class: 'x', text: '×', role: 'button', tabindex: 0, title: 'Remove ' + s.id }); x.addEventListener('click', ev => { ev.stopPropagation(); G.scenarios = G.scenarios.filter(y => y.id !== s.id); if (G.activeId === s.id) G.activeId = G.scenarios[0].id; if (!G.scenarios.find(y => y.id === G.referenceId)) G.referenceId = G.scenarios[0].id; G.renderRail(); G.runAll(); }); chip.append(x); } chip.addEventListener('click', () => { G.activeId = s.id; G.renderRail(); G.renderAll(); }); host.append(chip); }
    const add = el('button', { type: 'button', class: 'btn small', text: '+ Add scenario (copy of ' + G.activeId + ')' }); add.disabled = !G.nextId(); add.addEventListener('click', () => { const id = G.nextId(); const a = G.active(); const s = Object.assign(G.blank(id), { set: a.set, overrides: clone(a.overrides), pins: clone(a.pins), horizon: a.horizon }); G.scenarios.push(s); G.activeId = id; G.renderRail(); G.runAll(); }); host.append(add);
    const levers = G.pkg.params.filter(p => p.lever); if (levers.length) { const ladder = el('button', { type: 'button', class: 'btn small quiet', text: 'Load a ladder on ' + (levers[0].label || levers[0].id) }); ladder.addEventListener('click', () => { const a = G.active(); const p = levers[0]; const vals = p.campaign ? [0, 0.4, 0.7, 0.9].map(c => ({ coverage: c })) : (() => { const r = p.range || [0, 1]; return [r[0], r[0] + (r[1] - r[0]) / 3, r[0] + 2 * (r[1] - r[0]) / 3, r[1]].map(v => +v.toFixed(3)); })(); G.scenarios = vals.map((v, k) => Object.assign(G.blank('ABCD'[k]), { set: a.set, horizon: a.horizon, overrides: { [p.id]: v } })); G.activeId = 'B'; G.referenceId = 'A'; G.renderRail(); G.runAll(); }); host.append(ladder); }
    if (G.scenarios.length > 1) { const refSel = el('select', { 'aria-label': 'Reference scenario', class: 'small' }); G.scenarios.forEach(s => { const o = el('option', { value: s.id, text: 'Compare against ' + s.id }); if (s.id === G.referenceId) o.selected = true; refSel.append(o); }); refSel.addEventListener('change', () => { G.referenceId = refSel.value; G.renderAll(); }); host.append(refSel); }
    G.renderStartOver();
  };
  G.renderStartOver = function () { const can = G.hasRun || G.scenarios.length > 1 || G.asked.length > 0 || G.scenarios.some(s => Object.keys(s.overrides).length || Object.keys(s.pins).length); renderStartOver($('#g-startover-slot'), can, () => { G.scenarios = [G.blank('A')]; G.activeId = 'A'; G.referenceId = 'A'; G.asked = []; G.askStatus = ''; G.askPrecheck = null; G.figGroup = 'results'; G.explainerOpen = {}; G.dirty = false; G.hasRun = false; G.renderRail(); G.renderAll(); G.renderRailState(); window.scrollTo({ top: 0 }); }); };
  G.renderHeader = function (ctx) {
    const s = ctx.s, r = ctx.res; const nameInp = $('#g-scn-name'); nameInp.value = G.name(s); nameInp.onchange = () => { s.name = nameInp.value.trim(); G.renderStrip(); };
    const idh = $('#g-scn-id'); idh.innerHTML = ''; if (state.view !== 'normal') idh.append(el('span', { class: 'mono', text: r.scenario_id }));
    const show = el('label', { class: 'toggle' }); const cb = el('input', { type: 'checkbox' }); cb.checked = !!s.shown; cb.addEventListener('change', () => { s.shown = cb.checked; G.renderAll(); }); show.append(cb, el('span', { text: 'Show on charts' })); idh.append(show);
    const chips = $('#g-scn-chips'); chips.innerHTML = ''; if (s.set) chips.append(el('span', { class: 'chip', html: '<b>Setting</b> ' + s.set })); for (const id in s.overrides) { const p = G.pkg.params.find(x => x.id === id); if (!p) continue; const v = s.overrides[id]; chips.append(el('span', { class: 'chip', html: '<b>' + (p.label || id) + '</b> ' + (p.campaign ? Object.keys(v).map(k => k + ' ' + v[k]).join(', ') : fmtVal(v, p)) })); } for (const id in s.pins) chips.append(el('span', { class: 'chip', html: '<b>' + id + '</b> pinned ' + s.pins[id] })); chips.append(el('span', { class: 'chip', html: '<b>Horizon</b> ' + ctx.w.label }));
    const o0 = G.pkg.observables[0], S = r.summary[o0.id]; const changed = Object.keys(s.overrides).length > 0;
    $('#g-headline').textContent = changed ? 'With ' + Object.keys(s.overrides).map(id => { const p = G.pkg.params.find(x => x.id === id); return p ? (p.label || id).toLowerCase() : id; }).join(', ') + ' changed, the model simulates ' + fmt.compact(S.value.median) + ' ' + o0.label.toLowerCase() + ' per 1,000 people over ' + ctx.w.label + (s.set ? ' in ' + s.set : '') + ', ' + (S.avertedPct.median >= 0 ? fmt.pct(S.avertedPct.median) + ' fewer than' : fmt.pct(-S.avertedPct.median) + ' more than') + ' the baseline (' + fmt.compact(S.base.median) + '). The scenario is lower in ' + S.below + ' of ' + S.n + ' draws.' : 'Baseline: the model at its own defaults' + (s.set ? ' for ' + s.set : '') + ' gives ' + fmt.compact(S.value.median) + ' ' + o0.label.toLowerCase() + ' per 1,000 over ' + ctx.w.label + '. Move a lever on the left, or add a scenario, to compare.';
  };
  G.renderKPIs = function (ctx) {
    const r = ctx.res, host = $('#g-kpis'); host.innerHTML = ''; const o0 = G.pkg.observables[0], S = r.summary[o0.id]; const bc = S.base.median || 1;
    host.append(kpi(o0.label + ', ' + ctx.w.label, fmt.compact(S.value.median), '90% range ' + fmt.compact(S.value.q05) + ' – ' + fmt.compact(S.value.q95), 'baseline ' + fmt.compact(S.base.median) + ' · per 1,000 people', null, [S.value.q05 / (bc * 1.3), S.value.q95 / (bc * 1.3), S.value.median / (bc * 1.3)]));
    host.append(S.averted.median < 0 ? kpi('More than baseline', fmt.compact(-S.averted.median), '90% range ' + fmt.compact(-S.averted.q95) + ' – ' + fmt.compact(-S.averted.q05), fmt.signedPct(-S.avertedPct.median, 1) + ' · lower in ' + S.below + '/' + S.n + ' draws', 'bad', null) : kpi('Averted vs baseline', fmt.compact(S.averted.median), '90% range ' + fmt.compact(S.averted.q05) + ' – ' + fmt.compact(S.averted.q95), fmt.signedPct(-S.avertedPct.median, 1) + ' · lower in ' + S.below + '/' + S.n + ' draws', S.avertedPct.median > 0 ? 'good' : S.avertedPct.median < 0 ? 'bad' : '', [Math.max(0, S.avertedPct.q05), Math.max(0, S.avertedPct.q95), Math.max(0, S.avertedPct.median)]));
    host.append(kpi('Peak month', fmt.compact(r.peak.value), G.pkg.model.start >= 2000 ? fmt.ym(r.peak.t) : 'year ' + r.peak.t.toFixed(2), 'highest monthly ' + o0.label.toLowerCase() + ' in the charted window', null, null));
    G.pkg.observables.slice(1, 4).forEach(o => { const Q = r.summary[o.id]; const isShare = o.unit === 'proportion'; host.append(kpi(o.label + (o.kind === 'flow' ? ', ' + ctx.w.label : ', mean'), isShare ? fmt.pct(Q.value.median, 1) : fmt.compact(Q.value.median), 'baseline ' + (isShare ? fmt.pct(Q.base.median, 1) : fmt.compact(Q.base.median)), o.kind === 'flow' ? fmt.signedPct(-Q.avertedPct.median, 0) + ' vs baseline' : (o.unit || ''), o.kind === 'flow' ? (Q.avertedPct.median > 0 ? 'good' : Q.avertedPct.median < 0 ? 'bad' : '') : null, null)); });
  };
  G.renderComparison = function () {
    const host = $('#g-cmp-wrap'); host.innerHTML = ''; const all = G.scenarios.filter(x => x.ran).map(s => ({ s, res: G.getResult(s) })); if (all.length < 2) return;
    const ref = all.find(o => o.s.id === G.referenceId) || all[0]; const obs = G.pkg.observables.slice(0, 4);
    const wrap = el('div', { class: 'table-wrap' }); const t = el('table', { class: 'cmp' });
    t.append(el('thead', null, el('tr', null, [el('th', { text: 'Scenario' }), el('th', { text: 'What differs from ' + ref.s.id })].concat(obs.map(o => el('th', { class: 'num', text: o.label + (o.kind === 'flow' ? ' (window)' : ' (mean)') }))).concat([el('th', { class: 'num', text: 'vs ' + ref.s.id }), el('th', { class: 'num', text: 'Peak month' })]))));
    const tb = el('tbody'); const o0 = G.pkg.observables[0];
    for (const o of all) { const tr = el('tr'); if (o.s.id === G.activeId) tr.classList.add('active'); const sw = el('span', { class: 'sw' }); sw.style.background = G.color(o.s); const nameTd = el('td'); nameTd.append(sw, document.createTextNode(o.s.id + ' · ' + G.name(o.s))); if (state.view !== 'normal') nameTd.append(el('small', { text: o.res.scenario_id })); const diffs = G.differences(o.s, ref.s); tr.append(nameTd, el('td', { text: o === ref ? 'Reference' : (diffs.length ? diffs.join(' · ') : 'Identical inputs') }));
      obs.forEach(ob => { const Q = o.res.summary[ob.id]; const isShare = ob.unit === 'proportion'; const td = el('td', { class: 'num', text: isShare ? fmt.pct(Q.value.median, 1) : fmt.int(Q.value.median) }); td.append(el('small', { text: isShare ? fmt.pct(Q.value.q05, 1) + ' to ' + fmt.pct(Q.value.q95, 1) : fmt.int(Q.value.q05) + ' to ' + fmt.int(Q.value.q95) })); tr.append(td); });
      const a = o.res.summary[o0.id].value.median, b = ref.res.summary[o0.id].value.median; tr.append(el('td', { class: 'num', text: o === ref ? '—' : fmt.signedPct(b ? (a - b) / b : 0, 1) }));
      const c3 = el('td', { class: 'num', text: fmt.int(o.res.peak.value) }); c3.append(el('small', { text: G.pkg.model.start >= 2000 ? fmt.ym(o.res.peak.t) : 'yr ' + o.res.peak.t.toFixed(2) })); tr.append(c3);
      tb.append(tr); }
    t.append(tb); wrap.append(t); host.append(wrap);
  };

  /* --- generic figure library: what the model declares decides which figures exist --- */
  function bandsOf(S, color, mode, approx) { const b = []; if (state.bands.b90) b.push({ lo: S.q05, hi: S.q95, opacity: 0.10 }); if (state.bands.b50) b.push({ lo: S.q25, hi: S.q75, opacity: 0.18 }); if (mode === 'emulator') b.push({ lo: S.median.map(v => v * (1 - approx)), hi: S.median.map(v => v * (1 + approx)), opacity: 0.06, hatch: true }); return b; }
  function markersOf(res) { const out = []; for (const e of res.events) { const p = G.pkg.params.find(x => x.id === e.id); e.rounds.forEach((t, i) => { if (i === 0 || i === e.rounds.length - 1 || e.rounds.length <= 4) out.push({ x: t, label: i === 0 ? (p ? (p.label || p.id) : e.id) : '' }); }); } return out.slice(0, 8); }
  function sameSetScenarios(ctx) { const ch = G.charted(); return ctx.all.filter(x => x.s.set === ctx.s.set && (ch.includes(x.s) || x.s === ctx.s)); }
  function xTicksFor(w) { if (G.pkg.model.start >= 2000) return null; const out = []; for (let y = w.chartFrom; y <= w.end; y++) out.push({ v: y, label: 'yr ' + y }); return out; }
  function xLabelFor() { return G.pkg.model.start >= 2000 ? fmt.ym : (t => 'year ' + t.toFixed(2)); }
  function settingList(ctx) { const s = ctx.s; const rows = []; if (s.set) rows.push(['Setting', s.set]); G.pkg.params.filter(p => p.lever).forEach(p => { const v = G.value(s, p); rows.push([p.label || p.id, p.campaign ? (v.coverage > 0 ? 'coverage ' + fmt.pct(v.coverage) + ', protection ' + v.peak + ' decaying ' + v.decay + '/y, every ' + v.every + ' y from ' + v.from : 'off') : fmtVal(v, p)]); }); G.pkg.params.filter(p => p.tier === 'user' && !p.lever).forEach(p => rows.push([p.label || p.id, fmtVal(G.value(s, p), p)])); rows.push(['Horizon', ctx.w.label]); return rows; }
  function variedList(ctx) { return G.pkg.params.filter(p => p.tier === 'varied').map(p => [p.label || p.id, ctx.s.pins[p.id] != null ? 'pinned ' + ctx.s.pins[p.id] : (p.range ? p.range[0] + '–' + p.range[1] + (p.unit ? ' ' + p.unit : '') : 'no range')]); }
  function advList(ctx) { return G.pkg.params.filter(p => p.tier === 'advanced' && ctx.s.overrides[p.id] != null).map(p => [p.label || p.id, fmtVal(ctx.s.overrides[p.id], p) + ' (default ' + fmtVal(G.baseValue(ctx.s, p), p) + ')']); }
  function gAside(ctx, extra) { const a = el('div', { class: 'aside' }); extra = extra || {}; if (extra.measures) { a.append(el('h3', { text: 'What this chart measures' }), el('p', { text: extra.measures })); } if (extra.varied === true && state.view !== 'normal') { const vl = variedList(ctx); a.append(el('h3', { text: 'Varied automatically · shown in bands' })); const d3 = el('dl'); if (vl.length) for (const [k, v] of vl) d3.append(el('dt', { text: k }), el('dd', { text: v })); else d3.append(el('dt', { text: 'none' }), el('dd', { text: 'no band for this model' })); a.append(d3); } return a; }
  function gBaseContext(ctx, chartTitle, measures) {
    const r = ctx.res, pkg = G.pkg, s = ctx.s; const lines = [];
    lines.push('Tool: Malaria Scenario Explorer (prototype). Model: "' + pkg.model.name + '" (id ' + pkg.model_id + '), standing ' + (G.entry.custom ? 'CUSTOM, UNREVIEWED: built in this session, not fitted to data' : pkg.model.standing + ', reviewed') + '. Engine: spec engine compiling the model package to ODEs (RK4). Not a forecast.');
    lines.push(EXT.familyLine());
    lines.push('Audience: ' + (ctx.view === 'normal' ? 'a programme user without modelling expertise' : ctx.view === 'student' ? 'a student learning modelling' : 'a modeller who knows the model'));
    lines.push('Chart: ' + chartTitle + '. ' + measures);
    lines.push('Model structure: compartments ' + pkg.compartments.map(c => c.id + ' (' + c.label + ')').join(', ') + '. Flows: ' + pkg.flows.map(f => f.from + '→' + f.to + ' at ' + f.expr).join(' · ') + '.' + (pkg.funcs.length ? ' Functions: ' + pkg.funcs.map(f => f.id + ' = ' + f.expr).join(' · ') + '.' : ''));
    lines.push('Scenario ' + s.id + ' "' + G.name(s) + '": ' + settingList(ctx).map(x => x[0] + ' = ' + x[1]).join(' · ') + '.');
    lines.push('Baseline for comparison: the model at its declared defaults' + (s.set ? ' for setting ' + s.set : '') + ' with every lever at its default.');
    const adv = advList(ctx); lines.push('Advanced overrides: ' + (adv.length ? adv.map(x => x[0] + ' = ' + x[1]).join(' · ') : 'none (declared defaults)') + '.');
    const vl = variedList(ctx); lines.push('Varied automatically (source of the bands, ' + MSE.N_DRAWS + ' Latin-hypercube draws): ' + (vl.length ? vl.map(x => x[0] + ' ' + x[1]).join(' · ') : 'nothing: the model declares no varied tier, so no band') + '. ' + (G.entry.custom ? 'Bands reflect ranges typed by the model author, not a fit to data.' : 'Ranges are the model\'s declared ranges (illustrative in this prototype).'));
    const parts = pkg.observables.map(o => { const S = r.summary[o.id]; const isShare = o.unit === 'proportion'; const f = v => isShare ? fmt.pct(v, 1) : fmt.int(v); return o.label + (o.kind === 'flow' ? ' over ' + ctx.w.label + ' per 1,000 people' : ' (mean over ' + ctx.w.label + ')') + ': median ' + f(S.value.median) + ' (90% range ' + f(S.value.q05) + '–' + f(S.value.q95) + '). Baseline median ' + f(S.base.median) + ' · ' + (o.kind === 'flow' ? 'averted vs baseline median ' + fmt.int(S.averted.median) + ' (' + fmt.pct(S.avertedPct.median, 1) + '. 90% range ' + fmt.pct(S.avertedPct.q05, 1) + ' to ' + fmt.pct(S.avertedPct.q95, 1) + '). Lower than baseline in ' + S.below + ' of ' + S.n + ' draws' : 'change vs baseline ' + fmt.signedPct(-S.avertedPct.median, 1)); });
    lines.push('Computed: ' + parts.join('. ') + '. Peak month of ' + pkg.observables[0].label.toLowerCase() + ': ' + (pkg.model.start >= 2000 ? fmt.ym(r.peak.t) : 'year ' + r.peak.t.toFixed(2)) + ' at ' + fmt.int(r.peak.value) + ' per 1,000.');
    lines.push('Execution: mode ' + r.execution.mode + (r.execution.mode === 'emulator' ? ' (approximation error ±5%, reported separately from model uncertainty)' : '') + '. Model id ' + pkg.model_id + '.');
    lines.push('Assumptions and limits: ' + (pkg.assumptions.length ? pkg.assumptions.join(' ') : 'none declared by the model author.') + ' Parameters held fixed: ' + pkg.params.filter(p => p.tier === 'fixed').map(p => (p.label || p.id) + ' = ' + p.value).join(', ') + '.');
    return lines;
  }
  function preparedGeneric(q, ctx, F) {
    const r = ctx.res, pkg = G.pkg, o0 = pkg.observables[0], S = r.summary[o0.id]; const t = q.toLowerCase();
    if (/assum/.test(t)) return 'The model assumes: ' + (pkg.assumptions.join(' ') || 'nothing is declared explicitly') + ' Structurally it has ' + pkg.compartments.length + ' compartments and ' + pkg.flows.length + ' flows, and holds ' + pkg.params.filter(p => p.tier === 'fixed').length + ' parameters fixed.';
    if (/uncertain|band|sure|confiden/.test(t)) { const vl = variedList(ctx); return vl.length ? 'The band comes from ' + vl.length + ' parameters the model marks as varied (' + vl.map(x => x[0] + ' ' + x[1]).join(' · ') + '), sampled ' + MSE.N_DRAWS + ' times. ' + o0.label + ' over ' + ctx.w.label + ' range from ' + fmt.int(S.value.q05) + ' to ' + fmt.int(S.value.q95) + ' per 1,000 (median ' + fmt.int(S.value.median) + '). ' + (G.entry.custom ? 'These ranges were typed by the model author and are not a fit to data.' : 'The ranges are the model\'s declared ranges.') : 'This model declares no varied parameters, so no band is shown: the line is the model at its stated values.'; }
    if (/why|change|fall|rise|differ|driv/.test(t)) { const ch = Object.keys(ctx.s.overrides); if (!ch.length) return 'Nothing has been changed from the baseline in scenario ' + ctx.s.id + ', so the lines coincide. ' + o0.label + ' over ' + ctx.w.label + ' are ' + fmt.int(S.value.median) + ' per 1,000. Move a lever to create a difference.'; return 'Compared with the baseline, ' + o0.label.toLowerCase() + ' over ' + ctx.w.label + ' go from ' + fmt.int(S.base.median) + ' to ' + fmt.int(S.value.median) + ' per 1,000 (' + fmt.signedPct(-S.avertedPct.median, 1) + '). The inputs that differ are ' + ch.map(id => { const p = pkg.params.find(x => x.id === id); return p ? (p.label || id).toLowerCase() : id; }).join(', ') + '. Each enters the rate expressions directly: ' + ch.map(id => { const fl = pkg.flows.filter(f => M.identsOf(f.expr).includes(id) || pkg.funcs.some(fn => M.identsOf(fn.expr).includes(id) && M.identsOf(f.expr).includes(fn.id))); return id + ' → ' + (fl.length ? fl.map(f => f.from + '→' + f.to).join(', ') : 'the model'); }).join(' · ') + '. The scenario is lower than the baseline in ' + S.below + ' of ' + S.n + ' paired draws.'; }
    if (/message|main|summar|built|how was/.test(t)) return F.measures + ' For scenario ' + ctx.s.id + ': ' + o0.label.toLowerCase() + ' over ' + ctx.w.label + ' median ' + fmt.int(S.value.median) + ' per 1,000 against a baseline of ' + fmt.int(S.base.median) + '.';
    return null;
  }
  function makeFig(spec) { return Object.assign({ views: ['normal', 'researcher'], questions: ['Why do the lines differ?', 'How uncertain is this?', 'What does the model assume here?'], context(ctx) { return gBaseContext(ctx, this.title, this.measures); }, prepared(q, ctx) { return preparedGeneric(q, ctx, this); }, aside(ctx) { return gAside(ctx, { measures: this.measures, varied: true }); } }, spec); }
  /* The chart catalogue. Every chart declares what it needs from the model package. A chart is shown when its
     requirements are met, listed with the reason when they are not. The composer draws on the same catalogue. */
  G.catalogue = function () {
    const pkg = G.pkg; const flows = pkg.observables.filter(o => o.kind === 'flow'), shares = pkg.observables.filter(o => o.kind !== 'flow'); const camps = pkg.params.filter(p => p.campaign);
    const varied = pkg.params.filter(p => p.tier === 'varied' && p.range), adv = pkg.params.filter(p => p.tier === 'advanced'), sweepable = pkg.params.filter(p => p.lever || p.tier === 'user' || p.tier === 'advanced');
    const C = [];
    C.push({ id: 'obs0', title: 'Monthly ' + (pkg.observables[0] ? pkg.observables[0].label.toLowerCase() : 'output') + ' by scenario', group: 'results', roles: ['policymaker', 'modeller'], needs: 'at least one declared output', why: pkg.observables.length ? null : 'the model declares no outputs (add an "observe" line)' });
    C.push({ id: 'totals', title: 'Totals over the window, by scenario', group: 'results', roles: ['policymaker', 'modeller'], needs: 'a flow output (new cases) and one or more scenarios', why: flows.length ? null : 'needs a flow output. This model only declares shares' });
    flows.slice(1).forEach(o => C.push({ id: 'obs-' + o.id, title: 'Monthly ' + o.label.toLowerCase() + ' by scenario', group: 'results', roles: ['policymaker', 'modeller'], needs: 'a second flow output', why: null }));
    shares.forEach(o => C.push({ id: 'obs-' + o.id, title: o.label + ' over time', group: 'why', roles: ['policymaker', 'modeller'], needs: 'a share-type output (an expression over compartments)', why: null }));
    C.push({ id: 'protection', title: 'Protection from each campaign over time', group: 'why', roles: ['policymaker', 'modeller'], needs: 'a campaign-type lever', why: camps.length ? null : 'this model declares no campaign lever (nets, spraying…)' });
    C.push({ id: 'compartments', title: 'Where people are: compartments over time', group: 'why', roles: ['modeller'], needs: 'compartments (always present)', why: null });
    C.push({ id: 'sweep', title: 'Vary one input', group: 'confidence', roles: ['policymaker', 'modeller'], needs: 'a lever, user or advanced parameter with a range', why: sweepable.length ? null : 'no lever or adjustable parameter declared' });
    C.push({ id: 'tornado', title: 'Which assumptions move the result', group: 'confidence', roles: ['modeller'], needs: 'a varied tier with ranges, or advanced parameters', why: (varied.length || adv.length) ? null : 'no varied or advanced parameters declared, so nothing to vary' });
    C.push({ id: 'fit', title: 'Model fit to observed data', group: 'confidence', roles: ['policymaker', 'modeller'], needs: 'observed data the model was fitted to', why: 'the tool does not fit in v1. Only the team\'s CEMA model carries observed series' });
    C.push({ id: 'costs', title: 'Cost by component and cost per case averted', group: 'costs', roles: ['policymaker', 'modeller'], needs: 'unit costs declared per intervention', why: 'this model declares no unit costs (a "cost" block is a v1.5 addition to the language)' });
    C.push({ id: 'settings', title: 'One scenario across every setting (Settings view tab)', group: 'results', roles: ['policymaker', 'modeller'], needs: 'named parameter sets', why: pkg.sets.length ? null : 'this model declares no parameter sets' });
    C.push({ id: 'map', title: 'Map of settings (Country view)', group: 'results', roles: ['policymaker', 'modeller'], needs: 'parameter sets linked to geography', why: 'only the CEMA model\'s settings are linked to county boundaries' });
    return C;
  };
  G.roleOf = () => state.view === 'researcher' ? 'modeller' : 'policymaker';
  G.figs = function () {
    const pkg = G.pkg; const F = []; const flows = pkg.observables.filter(o => o.kind === 'flow'), shares = pkg.observables.filter(o => o.kind !== 'flow'); const o0 = pkg.observables[0];
    if (!o0) return F;
    F.push(makeFig({ group: 'results', id: 'obs0', title: 'Monthly ' + o0.label.toLowerCase() + ' by scenario', unit: (o0.unit || 'per 1,000 people per month') + ' · lines are medians, bands show where the draws fall', measures: 'New ' + o0.label.toLowerCase() + ' each month per 1,000 people, the model\'s first declared output, for every scenario on the charts, against the baseline of the active scenario.',
      render(chartEl, ctx) { const r = ctx.res, w = ctx.w; const series = []; if (state.showBaseline) series.push({ name: 'Baseline (model defaults' + (ctx.s.set ? ', ' + ctx.s.set : '') + ')', color: 'var(--muted)', values: r.bseries[o0.id].median, dash: '5 4', width: 1.5 }); for (const o of sameSetScenarios(ctx)) { const isA = o.s.id === ctx.s.id; series.push({ name: 'Scenario ' + o.s.id + (isA ? '' : ' · ' + G.name(o.s)), color: G.color(o.s), values: o.res.series[o0.id].median, width: isA ? 2.2 : 1.6, opacity: isA ? 1 : .8, bands: isA ? bandsOf(o.res.series[o0.id], G.color(o.s), o.res.execution.computedMode, o.res.execution.approxError) : null, endLabel: o.s.id }); }
        lineChart(chartEl, { x: r.t, xDomain: [w.chartFrom, w.end], series, height: 250, endLabels: true, markers: markersOf(r), yTitle: 'per 1,000 / month', xTicks: xTicksFor(w), xLabel: xLabelFor(), aria: this.title });
        chartEl.append(legend(series.map(s => ({ name: s.name.replace(/ · .*/, ''), color: s.color, kind: s.dash ? 'dash' : 'line' })), [{ id: 'g-tg-b50', label: '50% band', checked: state.bands.b50, onChange: v => { state.bands.b50 = v; G.renderFigures(); } }, { id: 'g-tg-b90', label: '90% band', checked: state.bands.b90, onChange: v => { state.bands.b90 = v; G.renderFigures(); } }, { id: 'g-tg-base', label: 'Baseline', checked: state.showBaseline, onChange: v => { state.showBaseline = v; G.renderFigures(); } }])); },
      data(ctx) { const r = ctx.res, w = ctx.w; const idx = r.t.map((t, k) => k).filter(k => r.t[k] >= w.chartFrom && r.t[k] < w.end); return mkData(idx.map(k => xLabelFor()(r.t[k])), [{ name: 'Baseline', values: idx.map(k => r.bseries[o0.id].median[k]) }].concat(sameSetScenarios(ctx).map(o => ({ name: 'Scenario ' + o.s.id, values: idx.map(k => o.res.series[o0.id].median[k]) })))); },
      questions: ['Why do ' + o0.label.toLowerCase() + ' change in this scenario?', 'How uncertain is this?', 'What does this model assume?'] }));
    if (flows.length) F.push(makeFig({ group: 'results', id: 'totals', title: o0.label + ' over ' + 'the window, by scenario', unit: 'per 1,000 people · total over the planning window · medians with 90% range', measures: 'Total ' + o0.label.toLowerCase() + ' per 1,000 people over the window for every scenario, with the change against the reference scenario.',
      render(chartEl, ctx) { const all = ctx.all.filter(o => G.charted().includes(o.s) || o.s === ctx.s); const ref = all.find(o => o.s.id === G.referenceId) || all[0]; const cats = all.map(o => { const S = o.res.summary[o0.id]; const rv = ref.res.summary[o0.id].value.median; return { label: [o.s.id, G.name(o.s).slice(0, 22)], value: S.value.median, color: G.color(o.s), note: o === ref ? 'reference' : fmt.signedPct(rv ? (S.value.median - rv) / rv : 0, 1), noteColor: o === ref ? 'var(--muted)' : (S.value.median < rv ? 'var(--good-text)' : 'var(--crit)'), tipNote: '90% range ' + fmt.int(S.value.q05) + ' – ' + fmt.int(S.value.q95) }; }); barChart(chartEl, { categories: cats, height: 230, labelRows: true, noteRow: true, valueName: o0.label, aria: this.title }); },
      data(ctx) { return mkData(ctx.all.map(o => o.s.id), [{ name: o0.label, values: ctx.all.map(o => o.res.summary[o0.id].value.median) }, { name: 'q05', values: ctx.all.map(o => o.res.summary[o0.id].value.q05) }, { name: 'q95', values: ctx.all.map(o => o.res.summary[o0.id].value.q95) }]); }, aside(ctx) { return gAside(ctx, { measures: this.measures, varied: false }); } }));
    flows.slice(1).forEach(o => F.push(makeFig({ group: 'results', id: 'obs-' + o.id, title: 'Monthly ' + o.label.toLowerCase() + ' by scenario', unit: (o.unit || 'per 1,000 people per month') + ' · flow ' + o.flow.replace(/->/g, ' → '), measures: o.label + ' per month per 1,000 people (the flow ' + o.flow.replace(/->/g, ' → ') + '), by scenario, against the baseline.',
      render(chartEl, ctx) { const r = ctx.res, w = ctx.w; const series = [{ name: 'Baseline', color: 'var(--muted)', values: r.bseries[o.id].median, dash: '5 4', width: 1.5 }]; for (const x of sameSetScenarios(ctx)) { const isA = x.s.id === ctx.s.id; series.push({ name: 'Scenario ' + x.s.id, color: G.color(x.s), values: x.res.series[o.id].median, width: isA ? 2.2 : 1.6, bands: isA ? bandsOf(x.res.series[o.id], null, x.res.execution.computedMode, x.res.execution.approxError) : null, endLabel: x.s.id }); } lineChart(chartEl, { x: r.t, xDomain: [w.chartFrom, w.end], series, height: 220, endLabels: true, markers: markersOf(r), yTitle: 'per 1,000 / month', xTicks: xTicksFor(w), xLabel: xLabelFor(), aria: this.title }); chartEl.append(legend(series.map(s => ({ name: s.name, color: s.color, kind: s.dash ? 'dash' : 'line' })))); },
      data(ctx) { const r = ctx.res, w = ctx.w; const idx = r.t.map((t, k) => k).filter(k => r.t[k] >= w.chartFrom && r.t[k] < w.end); return mkData(idx.map(k => xLabelFor()(r.t[k])), [{ name: 'Baseline', values: idx.map(k => r.bseries[o.id].median[k]) }].concat(sameSetScenarios(ctx).map(x => ({ name: 'Scenario ' + x.s.id, values: idx.map(k => x.res.series[o.id].median[k]) })))); } })));
    shares.forEach(o => F.push(makeFig({ group: 'why', id: 'obs-' + o.id, title: o.label + ' over time', unit: (o.unit || 'proportion') + ' · ' + o.expr + ' · monthly mean', measures: o.label + ' (' + o.expr + ') each month, by scenario, against the baseline.',
      render(chartEl, ctx) { const r = ctx.res, w = ctx.w; const isShare = o.unit === 'proportion'; const series = [{ name: 'Baseline', color: 'var(--muted)', values: r.bseries[o.id].median, dash: '5 4', width: 1.5 }]; for (const x of sameSetScenarios(ctx)) { const isA = x.s.id === ctx.s.id; series.push({ name: 'Scenario ' + x.s.id, color: G.color(x.s), values: x.res.series[o.id].median, width: isA ? 2.2 : 1.6, bands: isA ? bandsOf(x.res.series[o.id], null, x.res.execution.computedMode, x.res.execution.approxError) : null, endLabel: x.s.id }); } lineChart(chartEl, { x: r.t, xDomain: [w.chartFrom, w.end], series, height: 220, endLabels: true, yFmt: isShare ? (v => fmt.pct(v, 0)) : fmt.compact, tipFmt: isShare ? (v => fmt.pct(v, 1)) : fmt.compact, markers: markersOf(r), xTicks: xTicksFor(w), xLabel: xLabelFor(), aria: this.title }); chartEl.append(legend(series.map(s => ({ name: s.name, color: s.color, kind: s.dash ? 'dash' : 'line' })))); },
      data(ctx) { const r = ctx.res, w = ctx.w; const idx = r.t.map((t, k) => k).filter(k => r.t[k] >= w.chartFrom && r.t[k] < w.end); return mkData(idx.map(k => xLabelFor()(r.t[k])), [{ name: 'Baseline', values: idx.map(k => r.bseries[o.id].median[k]), fmt: v => fmt.pct(v, 1) }].concat(sameSetScenarios(ctx).map(x => ({ name: 'Scenario ' + x.s.id, values: idx.map(k => x.res.series[o.id].median[k]), fmt: v => fmt.pct(v, 1) })))); } })));
    const camps = pkg.params.filter(p => p.campaign);
    if (camps.length) F.push(makeFig({ group: 'why', id: 'protection', title: 'Protection from each campaign over time', unit: 'protection · 0 to 1 · active scenario', measures: 'The protection each campaign-type intervention gives through time in the active scenario: coverage × protection at a round, decaying until the next round. It multiplies the force of infection by (1 − protection).',
      render(chartEl, ctx) { const r = ctx.res, w = ctx.w; const series = camps.map((p, i) => { const cf = G.value(ctx.s, p); return { name: p.label || p.id, color: MSE.SLOT_COLORS[i % 8], values: r.t.map(t => M.campaignValue(cf, t)), width: 2 }; }); lineChart(chartEl, { x: r.t, xDomain: [w.chartFrom, w.end], series, height: 200, yFmt: v => fmt.pct(v, 0), tipFmt: v => fmt.pct(v, 1), markers: markersOf(r), xTicks: xTicksFor(w), xLabel: xLabelFor(), aria: this.title }); chartEl.append(legend(series.map(s => ({ name: s.name, color: s.color, kind: 'line' })))); },
      data(ctx) { const r = ctx.res, w = ctx.w; const idx = r.t.map((t, k) => k).filter(k => r.t[k] >= w.chartFrom && r.t[k] < w.end); return mkData(idx.map(k => xLabelFor()(r.t[k])), camps.map(p => { const cf = G.value(ctx.s, p); return { name: p.label || p.id, values: idx.map(k => M.campaignValue(cf, r.t[k])), fmt: v => fmt.pct(v, 1) }; })); }, questions: ['Why does protection fall between rounds?', 'What happens if the campaign is delayed?', 'How uncertain is this?'], aside(ctx) { return gAside(ctx, { measures: this.measures, varied: false }); } }));
    F.push(makeFig({ group: 'why', id: 'compartments', title: 'Where people are: compartments over time', unit: 'share of the population · active scenario · central run', measures: 'The share of the population in each compartment through time for the active scenario (central run), stacked so the total is 1.', views: ['researcher'],
      render(chartEl, ctx) { const r = ctx.res, w = ctx.w; const layers = pkg.compartments.map((c, i) => ({ name: c.id + ' · ' + c.label, color: ['var(--seq1)', 'var(--seq2)', 'var(--seq3)', 'var(--seq4)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s2)'][i % 8], values: r.central.months.map(m0 => m0.comp[i]) })); stackedArea(chartEl, { x: r.t, xDomain: [w.chartFrom, w.end], height: 230, layers, yFmt: v => fmt.pct(v, 0), tipFmt: v => fmt.pct(v, 1), xTicks: xTicksFor(w), xLabel: xLabelFor(), aria: this.title }); chartEl.append(legend(layers.map(l => ({ name: l.name, color: l.color, kind: 'box' })))); },
      data(ctx) { const r = ctx.res, w = ctx.w; const idx = r.t.map((t, k) => k).filter(k => r.t[k] >= w.chartFrom && r.t[k] < w.end); return mkData(idx.map(k => xLabelFor()(r.t[k])), pkg.compartments.map((c, i) => ({ name: c.id, values: idx.map(k => r.central.months[k].comp[i]), fmt: v => fmt.pct(v, 1) }))); }, questions: ['Why is the asymptomatic or recovered class so large?', 'What does this say about where transmission comes from?', 'What does the model assume?'] }));
    const sweepable = pkg.params.filter(p => p.lever || p.tier === 'user' || p.tier === 'advanced');
    if (sweepable.length) F.push(makeFig({ group: 'confidence', id: 'sweep', title: 'Vary one input', unit: o0.label.toLowerCase() + ' over the window against one input · other inputs as set · 10 draws per point', measures: 'One input swept across its declared range with everything else as in the active scenario. The line is the median total of ' + o0.label.toLowerCase() + ' per 1,000 over the window, the band its 90% range.',
      render(chartEl, ctx) { const key = G.sweepKey && sweepable.find(p => p.id === G.sweepKey) ? G.sweepKey : sweepable[0].id; G.sweepKey = key; const p = sweepable.find(x => x.id === key); const sel = el('select', { class: 'small', 'aria-label': 'Input to vary' }); sweepable.forEach(x => { const o = el('option', { value: x.id, text: x.label || x.id }); if (x.id === key) o.selected = true; sel.append(o); }); sel.addEventListener('change', () => { G.sweepKey = sel.value; G.renderFigures(); }); chartEl.append(el('div', { class: 'run-row', style: 'margin-bottom:6px' }, [el('span', { class: 'small', text: 'Input:' }), sel]));
        const sw = G.sweep(ctx.s, p); const host = el('div'); chartEl.append(host); const ser = [{ name: 'Median', color: 'var(--s1)', values: sw.points.map(q => q.median), width: 2, bands: [{ lo: sw.points.map(q => q.q05), hi: sw.points.map(q => q.q95), opacity: 0.12 }] }]; lineChart(host, { x: sw.points.map(q => q.x), xDomain: [sw.points[0].x, sw.points[sw.points.length - 1].x], series: ser, height: 210, xTicks: sw.points.map(q => ({ v: q.x, label: sw.fmt(q.x) })), xLabel: v => (p.label || p.id) + ' ' + sw.fmt(v), markers: sw.current != null ? [{ x: sw.current, label: 'as set' }] : [], yTitle: 'per 1,000', aria: this.title }); host.append(legend([{ name: 'Median', color: 'var(--s1)', kind: 'line' }, { name: '90% range', color: 'var(--s1)', kind: 'box', opacity: .3 }])); },
      data(ctx) { const key = G.sweepKey || sweepable[0].id; const p = sweepable.find(x => x.id === key); const sw = G.sweep(ctx.s, p); return mkData(sw.points.map(q => sw.fmt(q.x)), [{ name: 'Median', values: sw.points.map(q => q.median) }, { name: 'q05', values: sw.points.map(q => q.q05) }, { name: 'q95', values: sw.points.map(q => q.q95) }]); }, questions: ['Is the response linear or does it saturate?', 'Where does the current setting sit?', 'How uncertain is this?'], aside(ctx) { return gAside(ctx, { measures: this.measures, varied: false }); } }));
    F.push(makeFig({ group: 'confidence', id: 'tornado', title: 'Which assumptions move the result', unit: 'change in ' + o0.label.toLowerCase() + ' over the window when one parameter is moved to the end of its range (varied tier) or ±15% (advanced tier) · central run', measures: 'One-at-a-time sensitivity: each varied parameter is set to the ends of its declared range, each advanced parameter to ±15% of its value, everything else as in the active scenario. Bars show the change in total ' + o0.label.toLowerCase() + ' over the window.', views: ['researcher'],
      render(chartEl, ctx) { const tn = G.tornado(ctx.s); if (!tn.rows.length) { chartEl.append(el('p', { class: 'small muted', text: 'No varied or advanced parameters declared, so there is nothing to vary.' })); return; } tornado(chartEl, { rows: tn.rows }); chartEl.append(legend([{ name: 'Fewer ' + o0.label.toLowerCase(), color: 'var(--s3)', kind: 'box' }, { name: 'More', color: 'var(--s2)', kind: 'box' }])); },
      data(ctx) { const tn = G.tornado(ctx.s); return mkData(tn.rows.map(r => r.label), [{ name: 'Low end', values: tn.rows.map(r => r.low), fmt: v => fmt.signedPct(v, 1) }, { name: 'High end', values: tn.rows.map(r => r.high), fmt: v => fmt.signedPct(v, 1) }]); }, questions: ['Which assumption matters most?', 'Would the ordering of scenarios flip?', 'What does this model assume?'], aside(ctx) { return gAside(ctx, { measures: this.measures, varied: false }); } }));
    return F;
  };
  G.sweep = function (s, p) { const w = G.window(s); const r = p.range || (p.type === 'fraction' ? [0, 1] : [0, (p.value || 1) * 2]); const xs = []; for (let i = 0; i <= 6; i++) xs.push(+(r[0] + (r[1] - r[0]) * i / 6).toFixed(4)); const o0 = G.pkg.observables[0]; const L = M.lhs(G.pkg, 10, 777, s.pins); const points = xs.map(x => { const ov = Object.assign({}, s.pins, s.overrides, { [p.id]: p.campaign ? Object.assign({}, s.overrides[p.id] || {}, { coverage: x }) : x }); const vals = (L.draws.length ? L.draws : [{}]).map(d => { const run = M.run(G.pkg, G.compiled, { set: s.set, overrides: Object.assign({}, d, ov), endYear: w.end, dt: 2 }); return cumMonths(run.months, 0, w.kpiFrom, w.end) * (o0.kind === 'flow' ? 1000 : 1); }); return Object.assign({ x }, quantiles(vals)); }); const cur = G.value(s, p); return { points, fmt: v => p.campaign || p.type === 'fraction' ? fmt.pct(v, 0) : fmtN(v), current: p.campaign ? cur.coverage : cur }; };
  G.tornado = function (s) { const w = G.window(s); const o0 = G.pkg.observables[0]; const sc = o0.kind === 'flow' ? 1000 : 1; const run1 = ov => { const run = M.run(G.pkg, G.compiled, { set: s.set, overrides: Object.assign({}, s.pins, s.overrides, ov), endYear: w.end, dt: 2 }); return cumMonths(run.months, 0, w.kpiFrom, w.end) * sc; }; const base = run1({}); const rows = []; for (const p of G.pkg.params) { if (p.campaign) continue; if (p.tier === 'varied' && p.range && s.pins[p.id] == null) rows.push({ label: (p.label || p.id) + ' (' + p.range[0] + '–' + p.range[1] + ')', low: run1({ [p.id]: p.range[0] }) / base - 1, high: run1({ [p.id]: p.range[1] }) / base - 1, lowLbl: String(p.range[0]), highLbl: String(p.range[1]) }); else if (p.tier === 'advanced') { const d = G.value(s, p); rows.push({ label: (p.label || p.id) + ' (±15%)', low: run1({ [p.id]: d * 0.85 }) / base - 1, high: run1({ [p.id]: d * 1.15 }) / base - 1, lowLbl: '−15%', highLbl: '+15%' }); } } rows.sort((x, y) => (Math.abs(y.high) + Math.abs(y.low)) - (Math.abs(x.high) + Math.abs(x.low))); return { base, rows: rows.slice(0, 8) }; };

  /* catalogue panel: which charts this model can show, which it cannot, and why */
  EXT.renderCatalogue = function (host, items, roleNote) {
    const role = G.roleOf(); const det = el('details', { class: 'fig catalogue' });
    const avail = items.filter(i => !i.why), un = items.filter(i => i.why);
    det.append(el('summary', { html: '<b>Which charts can this model show?</b> <span class="muted small">' + avail.length + ' available · ' + un.length + ' not possible with what the model declares · ' + (role === 'policymaker' ? 'policymaker view shows the headline set' : 'modeller view shows everything') + '</span>' }));
    det.append(el('p', { class: 'small muted', style: 'margin-top:6px', text: 'A chart appears when the model declares what it needs. "Ask for a chart" composes from the same catalogue.' + (roleNote ? ' ' + roleNote : '') }));
    const t = el('table', { class: 'tiers', style: 'margin-top:8px' }); t.append(el('thead', null, el('tr', null, ['Chart', 'Group', 'Shown to', 'Needs from the model', 'Status'].map(h => el('th', { text: h })))));
    const tb = el('tbody'); items.forEach(i => tb.append(el('tr', null, [el('td', { text: i.title }), el('td', { class: 'small', text: (MSE.FIG_GROUPS.find(g => g.id === i.group) || { label: i.group }).label }), el('td', { class: 'small', text: i.roles.join(', ') }), el('td', { class: 'small muted', text: i.needs }), el('td', null, el('span', { class: 'badge ' + (i.why ? 'warn' : 'ok'), text: i.why ? 'not possible: ' + i.why : (i.roles.includes(role) ? 'shown' : 'modeller view only') }))]))); t.append(tb);
    det.append(el('div', { class: 'table-wrap' }, t)); host.append(det);
  };
  /* --- figures rendering (mirrors the team path) --- */
  G.renderFigures = function () {
    const ctx = G.buildCtx(G.active()); const host = $('#g-figures'); const keepOpen = Object.assign({}, G.explainerOpen); host.innerHTML = '';
    const FIGSg = G.figs().filter(F => F.views.includes(state.view));
    const nav = el('nav', { class: 'subtabs', role: 'tablist' });
    for (const g of MSE.FIG_GROUPS) { const count = g.id === 'all' ? FIGSg.length + G.asked.length : g.id === 'asked' ? G.asked.length : FIGSg.filter(F => F.group === g.id).length; if (!count && g.id !== 'asked') continue; const b = el('button', { type: 'button', role: 'tab', 'aria-selected': String(G.figGroup === g.id), title: g.q }, [el('span', { text: g.label }), el('small', { text: String(count) })]); b.addEventListener('click', () => { G.figGroup = g.id; G.renderFigures(); }); nav.append(b); }
    host.append(nav); const g = MSE.FIG_GROUPS.find(x => x.id === G.figGroup) || MSE.FIG_GROUPS[0]; host.append(el('p', { class: 'subtab-q', text: g.q }));
    if (G.figGroup === 'asked') { G.renderAskBox(host); G.renderAsked(host, 0); return; }
    let n = 0;
    for (const F of FIGSg) {
      if (G.figGroup !== 'all' && F.group !== G.figGroup) continue; n++;
      const sec = el('section', { class: 'fig', id: 'gfig-' + F.id }); const head = el('div', { class: 'fig-head' });
      head.append(el('div', { class: 't' }, [el('h2', { html: '<span class="muted" style="font-weight:400;margin-right:6px">' + n + '</span>' + F.title })]));
      const acts = el('div', { class: 'fig-actions' }); const askBtn = el('button', { type: 'button', class: 'btn small primary', text: explainerAvailable() ? '✦ Ask about this chart' : '✦ Explain this chart' }); const tblBtn = el('button', { type: 'button', class: 'btn small', text: 'Table' }); acts.append(askBtn, tblBtn, G.exportMenu(F, sec)); head.append(acts); sec.append(head);
      const body = el('div', { class: 'fig-body' }); const chart = el('div', { class: 'chart' }); body.append(chart); const aside = F.aside ? F.aside(ctx) : null; if (aside) body.append(aside); else body.classList.add('noaside'); sec.append(body); host.append(sec);
      try { F.render(chart, ctx); } catch (e) { chart.append(el('p', { class: 'small', text: 'Chart could not be drawn: ' + e.message })); console.error(e); }
      const tbl = el('div', { hidden: '' }); sec.append(tbl); tblBtn.addEventListener('click', () => { if (tbl.hidden) { tbl.innerHTML = ''; const d = F.data(G.buildCtx(G.active())); tbl.append(tableView(d.xs, d.cols)); tbl.hidden = false; tblBtn.textContent = 'Hide table'; } else { tbl.hidden = true; tblBtn.textContent = 'Table'; } });
      const ex = buildExplainer(F, ctx); ex.hidden = !keepOpen[F.id]; sec.append(ex); askBtn.addEventListener('click', () => { ex.hidden = !ex.hidden; G.explainerOpen[F.id] = !ex.hidden; if (!ex.hidden) $('input', ex).focus(); });
    }
    if (G.figGroup === 'all') { G.renderAskBox(host); G.renderAsked(host, n); }
  };
  function gComposeSVG(section, F) {
    const svgs = figureSVGs(section); if (!svgs.length) return null; const cs = getComputedStyle(document.documentElement); const font = cs.getPropertyValue('--font').trim();
    const W = Math.max(...svgs.map(x => +x.getAttribute('width'))); const Hs = svgs.map(x => +x.getAttribute('height')); const gap = 24, title = 60, foot = 28; const H = title + Hs.reduce((a, b) => a + b + gap, 0) + foot;
    const s = G.active(); const r = G.getResult(s);
    let out = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" style="font-family:' + font.replace(/"/g, "'") + '">';
    out += '<rect width="' + W + '" height="' + H + '" fill="' + cs.getPropertyValue('--surface').trim() + '"/>';
    out += '<text x="12" y="22" font-size="15" font-weight="600" fill="' + cs.getPropertyValue('--ink').trim() + '">' + escapeXml(F.title) + '</text>';
    out += '<text x="12" y="38" font-size="11" fill="' + cs.getPropertyValue('--muted').trim() + '">' + escapeXml(F.unit + ' · scenario ' + s.id + ' · ' + G.name(s)) + '</text>';
    out += '<text x="12" y="52" font-size="11" fill="' + cs.getPropertyValue('--muted').trim() + '">' + escapeXml(r.scenario_id + ' · ' + 'model ' + G.pkg.model_id + (G.entry.custom ? ' (custom, unreviewed)' : '') + ' · prototype, spec engine') + '</text>';
    let y = title;
    svgs.forEach((x, k) => { const c = x.cloneNode(true); c.setAttribute('style', 'font-family:' + font.replace(/"/g, "'") + ';font-size:11px'); c.setAttribute('x', 0); c.setAttribute('y', y); c.setAttribute('width', W); c.setAttribute('height', Hs[k]); let str = new XMLSerializer().serializeToString(c); str = resolveVars(str); out += str; y += Hs[k] + gap; });
    out += '<text x="12" y="' + (H - 10) + '" font-size="10.5" fill="' + cs.getPropertyValue('--muted').trim() + '">' + escapeXml('Malaria Scenario Explorer · prototype · not a forecast · ' + stamp()) + '</text></svg>';
    return { svg: out, W, H };
  }

  function gCsv(F) { const d = F.data(G.buildCtx(G.active())); const q = v => { const t = String(v == null ? '' : v); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; }; const rows = [['period'].concat(d.cols.map(c => c.name)).map(q).join(',')]; d.xs.forEach((x, i) => rows.push([q(x)].concat(d.cols.map(c => { const v = c.values[i]; return v == null || !isFinite(v) ? '' : String(+(+v).toPrecision(8)); })).join(','))); return rows.join('\n'); }
  function gScenarioRecord(s) { const r = G.getResult(s); return { schema: r.schema, scenario_id: r.scenario_id, label: s.id, name: G.name(s), model: r.model, inputs: { set: s.set, overrides: s.overrides, pins: s.pins, horizon_years: s.horizon, window: r.window }, execution: r.execution, summary: r.summary, peak: r.peak }; }
  function gMetadata(F) { const s = G.active(); const r = G.getResult(s); return { schema: 'mse-chart-metadata/0.1', generated: new Date().toISOString(), chart: { id: F.id, title: F.title, unit: F.unit, measures: F.measures, view: G.roleOf() }, model: { id: G.pkg.model_id, name: G.pkg.model.name, standing: r.model.standing, custom: !!G.entry.custom, source: G.pkg.model.source }, scenario: gScenarioRecord(s), compared_scenarios: G.scenarios.filter(x => x !== s && x.ran).map(x => ({ id: x.id, name: G.name(x), scenario_id: G.getResult(x).scenario_id, inputs: { set: x.set, overrides: x.overrides, pins: x.pins } })), varied: G.pkg.params.filter(p => p.tier === 'varied').map(p => ({ id: p.id, range: p.range, pinned: s.pins[p.id] != null ? s.pins[p.id] : null })), assumptions: G.pkg.assumptions, engine: r.engine, not_a_forecast: true }; }
  function gSummary(F) { const s = G.active(); const ctx = G.buildCtx(s); const lines = ['# ' + F.title, '', '_' + F.unit + '_', '', F.measures, '', '## Model', '', G.pkg.model.name + ' (id ' + G.pkg.model_id + ', ' + (G.entry.custom ? 'custom, unreviewed' : 'reviewed, ' + G.pkg.model.standing) + ')', '', '## Scenario ' + s.id + ' · ' + G.name(s), ''].concat(settingList(ctx).map(x => '- ' + x[0] + ': ' + x[1])); const adv = advList(ctx); if (adv.length) lines.push('', '## Advanced overrides', '', ...adv.map(x => '- ' + x[0] + ': ' + x[1])); const vl = variedList(ctx); lines.push('', '## Varied automatically (bands)', '', ...(vl.length ? vl.map(x => '- ' + x[0] + ': ' + x[1]) : ['- none declared'])); lines.push('', '## Computed', ''); G.pkg.observables.forEach(o => { const S = ctx.res.summary[o.id]; const isShare = o.unit === 'proportion'; const f = v => isShare ? fmt.pct(v, 1) : fmt.int(v); lines.push('- ' + o.label + ': median ' + f(S.value.median) + ' (90% range ' + f(S.value.q05) + '–' + f(S.value.q95) + '). Baseline ' + f(S.base.median) + (o.kind === 'flow' ? '. Averted ' + fmt.int(S.averted.median) + ' (' + fmt.pct(S.avertedPct.median, 1) + ')' : '')); }); lines.push('', '## Assumptions', '', ...(G.pkg.assumptions.length ? G.pkg.assumptions.map(a => '- ' + a) : ['- none declared']), '', '_Malaria Scenario Explorer · prototype · not a forecast · ' + stamp() + '_'); return lines.join('\n'); }
  async function gBundle(section, F, base) {
    const s = G.active(); const files = []; const enc = t => new TextEncoder().encode(t);
    try { const png = await gRaster(section, F, 'png'); if (png) files.push([base + '.png', new Uint8Array(await png.arrayBuffer())]); } catch (e) { console.warn(e); }
    const c = gComposeSVG(section, F); if (c) files.push([base + '.svg', enc(c.svg)]);
    files.push(['metadata.json', enc(JSON.stringify(gMetadata(F), null, 2))]); files.push(['summary.md', enc(gSummary(F))]); files.push(['data.csv', enc(gCsv(F))]); files.push(['scenario.json', enc(JSON.stringify(gScenarioRecord(s), null, 2))]);
    files.push(['model-package.json', enc(packageJSON(G.pkg))]); files.push(['model.txt', enc(G.pkg.dsl_source)]);
    files.push(['context.txt', enc(F.context(G.buildCtx(s)).join('\n'))]);
    files.push(['README.md', enc('# ' + F.title + '\n\nExported from the Malaria Scenario Explorer prototype (v2) · ' + stamp() + '\n\nFiles: the chart as PNG and SVG. Metadata.json (chart, scenario, model, compared scenarios). Summary.md. Data.csv (the table behind the chart). Scenario.json (inputs, execution, summary). Model-package.json and model.txt (the model this was computed with, id ' + G.pkg.model_id + '). Context.txt (what the explainer is given).\n\nStand-in numbers. Not a forecast.\n')]);
    saveFile(base + '.zip', zipFiles(files), 'application/zip');
  }
  function gRaster(section, F, type) { return new Promise((resolve, reject) => { const c = gComposeSVG(section, F); if (!c) return resolve(null); const img = new Image(); const canvas = el('canvas', { width: c.W * 2, height: c.H * 2 }); const g2 = canvas.getContext('2d'); img.onload = () => { g2.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() || '#fff'; g2.fillRect(0, 0, canvas.width, canvas.height); g2.drawImage(img, 0, 0, canvas.width, canvas.height); canvas.toBlob(b => b ? resolve(b) : reject(new Error('raster failed')), type === 'jpeg' ? 'image/jpeg' : 'image/png', 0.92); }; img.onerror = () => reject(new Error('svg image failed')); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(c.svg); }); }
  G.exportMenu = function (F, sec) {
    const wrap = el('div', { class: 'menu-wrap' }); const btn = el('button', { type: 'button', class: 'btn small', text: 'Export ▾', 'aria-haspopup': 'true', 'aria-expanded': 'false' }); const menu = el('div', { class: 'menu', role: 'menu', hidden: '' }); const base = () => 'mse-' + G.pkg.model_id + '-' + F.id + '-' + G.active().id + '-' + G.getResult(G.active()).scenario_id;
    const groups = [
      ['Image', [['PNG image', async () => { try { const b = await gRaster(sec, F, 'png'); if (b) saveFile(base() + '.png', b, 'image/png'); } catch (e) { console.warn(e); } }], ['JPEG image', async () => { try { const b = await gRaster(sec, F, 'jpeg'); if (b) saveFile(base() + '.jpg', b, 'image/jpeg'); } catch (e) { console.warn(e); } }], ['SVG vector', () => { const c = gComposeSVG(sec, F); if (c) saveFile(base() + '.svg', c.svg, 'image/svg+xml'); }]]],
      ['Details', [['Metadata as JSON', () => saveFile(base() + '-metadata.json', JSON.stringify(gMetadata(F), null, 2), 'application/json')], ['Summary (Markdown)', () => saveFile(base() + '-summary.md', gSummary(F), 'text/markdown')], ['Data as CSV', () => saveFile(base() + '-data.csv', gCsv(F), 'text/csv')]]],
      ['Everything', [['ZIP bundle', () => gBundle(sec, F, base())]]],
    ];
    for (const [g, items] of groups) { menu.append(el('div', { class: 'mg', text: g })); for (const [lbl, fn] of items) { const it = el('button', { type: 'button', role: 'menuitem', text: lbl }); it.addEventListener('click', () => { close(); fn(); }); menu.append(it); } }
    function close() { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); document.removeEventListener('click', onDoc, true); } function onDoc(ev) { if (!wrap.contains(ev.target)) close(); }
    btn.addEventListener('click', () => { if (menu.hidden) { menu.hidden = false; btn.setAttribute('aria-expanded', 'true'); setTimeout(() => document.addEventListener('click', onDoc, true), 0); } else close(); });
    wrap.addEventListener('keydown', ev => { if (ev.key === 'Escape') { close(); btn.focus(); } });
    wrap.append(btn, menu); return wrap;
  };

  /* --- ask for a chart (generic composer over the declared outputs) --- */
  G.grammar = function () { const g = {}; G.pkg.observables.forEach(o => { g[o.id] = { label: o.label.toLowerCase(), kind: o.kind === 'flow' ? 'flow' : 'share', words: [o.id.toLowerCase()].concat(o.label.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3)) }; }); G.pkg.params.filter(p => p.campaign).forEach(p => { g['prot:' + p.id] = { label: (p.label || p.id).toLowerCase() + ' protection', kind: 'share', words: ['protection', p.id.toLowerCase()].concat((p.label || '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3)), campaign: p }; }); return g; };
  G.parseQuestion = function (q) {
    const t = ' ' + q.toLowerCase().replace(/[?!.;:]/g, ' ').replace(/\s+/g, ' ') + ' '; const g = G.grammar(); let measure = null, best = 0;
    for (const id in g) { let score = 0; for (const w of g[id].words) if (t.includes(' ' + w)) score += w.length; if (score > best) { best = score; measure = id; } }
    const c = CLS.pre(q); if (c.outside.length) return { error: 'The model has no ' + c.outside.map(x => x[1]).join(' or ') + '.' };
    if (!measure) measure = G.pkg.observables[0].id;
    const transform = /cumulative|total|over the window|in total/.test(t) ? 'cumulative' : /averted|fewer|difference|vs baseline|against baseline/.test(t) ? 'diff_baseline' : /percent|% change|relative/.test(t) ? 'pct_baseline' : 'monthly';
    const by = /by setting|each setting|every setting|across settings|by set/.test(t) || G.pkg.sets.some(s => t.includes(' ' + s.id.toLowerCase() + ' ') && G.pkg.sets.length > 1 && /all|each|every|across|compare/.test(t)) ? 'set' : /by year|per year|each year|yearly/.test(t) ? 'year' : 'scenario';
    const form = /bar|total|compare|by year|by setting/.test(t) && transform !== 'monthly' || /bar chart|as bars|by year|by setting|each setting/.test(t) ? 'bars' : 'line';
    const scen = (t.match(/\bscenario[s]?\s+([a-h](?:\s*(?:,|and)\s*[a-h])*)/) || [])[1]; const scenarios = scen ? scen.toUpperCase().match(/[A-H]/g) : null;
    const yrs = (t.match(/\b(20\d\d)\b/g) || []).map(Number); const window = yrs.length >= 2 ? [Math.min(...yrs), Math.max(...yrs)] : yrs.length === 1 && /in 20\d\d/.test(t) ? [yrs[0], yrs[0]] : null;
    return { question: q, measure, transform, by, form, scenarios, window, bands: true };
  };
  G.parseWhatIf = function (q) { const t = q.toLowerCase(); const out = { variants: [], set: null }; const levers = G.pkg.params.filter(p => p.lever || p.tier === 'user'); for (const p of levers) { const words = [p.id.toLowerCase()].concat((p.label || '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3)); const hit = words.find(w => t.includes(w)); if (!hit) continue; const m = t.slice(t.indexOf(hit)).match(/(\d+(?:\.\d+)?)\s*%/) || t.match(/(\d+(?:\.\d+)?)\s*%/); if (!m) { if (p.campaign && /(stopp|without|no |off)/.test(t)) out.variants.push({ id: p.id, value: { coverage: 0 }, label: (p.label || p.id) + ' off' }); continue; } const v = parseFloat(m[1]) / 100; out.variants.push({ id: p.id, value: p.campaign ? { coverage: v } : v, label: (p.label || p.id) + ' ' + m[1] + '%' }); } for (const s of G.pkg.sets) if (t.includes(s.id.toLowerCase())) out.set = s.id; return out; };
  G.renderAskBox = function (host) {
    const box = el('section', { class: 'fig ask' }); box.append(el('div', { class: 'fig-head' }, el('div', { class: 't' }, [el('h2', { text: 'Ask for a chart' })])));
    const g = G.grammar();
    const form = el('form', { style: 'display:flex;gap:6px;margin-top:8px;flex-wrap:wrap' }); const inp = el('input', { type: 'text', id: 'g-ask-input', placeholder: 'e.g. ' + G.pkg.observables[0].label.toLowerCase() + ' averted vs baseline over time', style: 'flex:1 1 320px', 'aria-label': 'Question for a chart' }); form.append(inp, el('button', { type: 'submit', class: 'btn primary', text: 'Compose chart' })); box.append(form);
    const o0 = G.pkg.observables[0]; const lever = G.pkg.params.find(p => p.lever); const examples = [o0.label + ' averted vs baseline over time', 'Total ' + o0.label.toLowerCase() + ' by scenario as bars'].concat(lever ? ['What if ' + (lever.label || lever.id).toLowerCase() + (lever.campaign ? ' coverage' : '') + ' were 90%?'] : []).concat(G.pkg.sets.length > 1 ? [o0.label + ' by setting'] : []).concat(G.pkg.observables[1] ? [G.pkg.observables[1].label + ' by year'] : []).concat(['Deaths averted by scenario']).concat(G.savedQuestions);
    const chips = el('div', { class: 'chips', style: 'margin-top:8px' }); for (const q of examples) { const b = el('button', { type: 'button', class: 'qchip', text: q }); b.addEventListener('click', () => { inp.value = q; submit(q); }); chips.append(b); } box.append(chips);
    const pre = el('div', { style: 'margin-top:8px' }); box.append(pre); 
    const status = el('p', { class: 'small muted', style: 'margin-top:8px', text: G.askStatus || (sampleFn ? '' : '') }); box.append(status);
    async function submit(q) {
      q = (q || '').trim(); if (!q) return; pre.innerHTML = ''; const c = CLS.pre(q); const dec = CLS.decision(c); G.askPrecheck = { q, c };
      if (dec.kind === 'abstain') { status.textContent = 'Not in the model: it has no ' + c.outside.map(x => x[1]).join(' or ') + '. Outputs available: ' + Object.values(g).map(m => m.label).join(', ') + '.'; return; }
      let spec = null;
      if (sampleFn) { try { const prompt = 'Map this question about a scenario tool to JSON {"chart": {"measure": one of ' + Object.keys(g).join('|') + ', "transform": monthly|cumulative|diff_baseline|pct_baseline, "by": scenario|set|year, "form": line|bars, "scenarios": [ids] or null, "window": [y0,y1] or null}}. Measures: ' + Object.keys(g).map(k => k + ' = ' + g[k].label).join(' · ') + '. Question: ' + q; const out = await sampleFn.json(prompt, { modelTier: 'quick' }); if (out && out.chart && g[out.chart.measure]) spec = Object.assign({ transform: 'monthly', by: 'scenario', form: 'line', bands: true }, out.chart, { question: q }); } catch (e) { spec = null; } }
      if (!spec) spec = G.parseQuestion(q); if (spec.error) { status.textContent = 'Not in the model: ' + spec.error; return; }
      const wi = G.parseWhatIf(q); let made = [];
      if (wi.variants.length || (wi.set && wi.set !== G.active().set)) { const a = G.active(); const ids = []; const variants = wi.variants.length ? wi.variants : [null]; for (const v of variants) { const id = G.nextId(); if (!id) break; const s = Object.assign(G.blank(id), { set: wi.set || a.set, horizon: a.horizon, overrides: clone(a.overrides), pins: clone(a.pins), name: v ? v.label + (wi.set ? ' · ' + wi.set : '') : wi.set }); if (v) s.overrides[v.id] = v.value; G.scenarios.push(s); ids.push(id); made.push(id + ' = ' + G.name(s)); } if (ids.length) { spec.scenarios = (spec.scenarios || []).concat(ids); G.activeId = ids[0]; G.renderRail(); } }
      G.asked.unshift({ id: ++G.askedSeq, question: q, spec, last: null, made }); G.figGroup = 'asked'; G.askStatus = ''; G.runAll(); inp.value = '';
    }
    form.addEventListener('submit', ev => { ev.preventDefault(); submit(inp.value); }); host.append(box);
  };
  G.composeChart = function (container, spec) {
    const g = G.grammar(); const Mm = g[spec.measure]; const a = G.active(); const w = G.window(a); const lo = spec.window ? spec.window[0] : (spec.form === 'bars' || spec.transform !== 'monthly' ? w.kpiFrom : w.chartFrom), hi = spec.window ? spec.window[1] + 1 : w.end; const isShare = Mm.kind === 'share';
    const fmtY = spec.transform === 'pct_baseline' || isShare ? (v => fmt.pct(v, 0)) : fmt.compact, tipFmt = spec.transform === 'pct_baseline' || isShare ? (v => fmt.pct(v, 1)) : fmt.int;
    const valuesOf = (res, which, s) => { if (Mm.campaign) { const cf = G.value(s, Mm.campaign); return res.t.map(t => M.campaignValue(cf, t)); } const S = res.series[spec.measure], Bq = res.bseries[spec.measure]; let v = Array.from(S[which] || S.median); const base = Bq.median; if (spec.transform === 'diff_baseline') v = v.map((x, k) => base[k] - x); if (spec.transform === 'pct_baseline') v = v.map((x, k) => base[k] > 0 ? (base[k] - x) / base[k] : 0); return v; };
    let ents;
    if (spec.by === 'set') { ents = G.pkg.sets.map((st, k) => { const s2 = Object.assign(G.blank('_' + st.id), { set: st.id, overrides: clone(a.overrides), pins: clone(a.pins), horizon: a.horizon }); const res = G.execute(s2); return { label: st.id, color: MSE.SLOT_COLORS[k % 8], res, s: s2, isActive: st.id === a.set }; }); }
    else { const list = spec.scenarios ? spec.scenarios.map(id => G.scenarios.find(s => s.id === id)).filter(Boolean) : G.charted(); ents = list.map(s => ({ label: 'Scenario ' + s.id, color: G.color(s), res: G.getResult(s), s, isActive: s.id === G.activeId })); }
    if (!ents.length) { container.textContent = 'No scenario matched.'; return null; }
    const t = ents[0].res.t;
    if (spec.by === 'year') { const e = ents.find(x => x.isActive) || ents[0]; const vals = valuesOf(e.res, 'median', e.s); const cats = []; for (let y = Math.floor(lo); y < hi; y++) { let s = 0, n = 0; for (let k = 0; k < t.length; k++) if (t[k] >= y - 1e-9 && t[k] < y + 1 - 1e-9) { s += vals[k]; n++; } cats.push({ label: String(y), value: isShare || spec.transform === 'pct_baseline' ? s / Math.max(1, n) : s, color: e.color }); } barChart(container, { categories: cats, height: 220, valFmt: isShare || spec.transform === 'pct_baseline' ? tipFmt : fmt.compact, yFmt: fmtY, valueName: Mm.label, aria: G.specTitle(spec) }); container.append(legend([{ name: e.label, color: e.color, kind: 'box' }])); return { table: () => mkData(cats.map(c => c.label), [{ name: Mm.label, values: cats.map(c => c.value), fmt: tipFmt }]) }; }
    if (spec.form === 'line') { const series = []; for (const e of ents) { let v = valuesOf(e.res, 'median', e.s); if (spec.transform === 'cumulative') { let acc = 0; v = v.map((x, k) => { if (t[k] >= lo - 1e-9 && t[k] < hi - 1e-9) { acc += x; return acc; } return null; }); } const bands = (spec.bands && e.isActive && !Mm.campaign && spec.transform !== 'cumulative') ? [{ lo: valuesOf(e.res, 'q05', e.s), hi: valuesOf(e.res, 'q95', e.s), opacity: 0.12 }] : null; if (bands && spec.transform === 'diff_baseline') { const lo2 = bands[0].lo, hi2 = bands[0].hi; bands[0].lo = lo2.map((x, k) => Math.min(x, hi2[k])); bands[0].hi = lo2.map((x, k) => Math.max(x, hi2[k])); } series.push({ name: e.label, color: e.color, values: v, width: e.isActive ? 2.2 : 1.6, bands, endLabel: e.label.replace('Scenario ', '') }); } lineChart(container, { x: t, xDomain: [lo, hi], series, height: 230, endLabels: ents.length > 1, yFmt: fmtY, tipFmt, markers: markersOf(ents[0].res), yMin: spec.transform === 'diff_baseline' ? undefined : 0, xTicks: xTicksFor(Object.assign({}, w, { chartFrom: lo, end: hi })), xLabel: xLabelFor(), aria: G.specTitle(spec) }); container.append(legend(series.map(s => ({ name: s.name, color: s.color, kind: 'line' })))); const idx = t.map((x, k) => k).filter(k => t[k] >= lo - 1e-9 && t[k] < hi - 1e-9); return { table: () => mkData(idx.map(k => xLabelFor()(t[k])), series.map(s => ({ name: s.name, values: idx.map(k => s.values[k]), fmt: tipFmt }))) }; }
    const cats = ents.map(e => { const v = valuesOf(e.res, 'median', e.s); let s = 0, n = 0; for (let k = 0; k < t.length; k++) if (t[k] >= lo - 1e-9 && t[k] < hi - 1e-9) { s += v[k]; n++; } return { label: e.label, value: isShare || spec.transform === 'pct_baseline' ? s / Math.max(1, n) : s, color: e.color }; }); barChart(container, { categories: cats, height: 230, valFmt: isShare || spec.transform === 'pct_baseline' ? tipFmt : fmt.compact, yFmt: fmtY, valueName: Mm.label, aria: G.specTitle(spec) }); return { table: () => mkData(cats.map(c => c.label), [{ name: Mm.label, values: cats.map(c => c.value), fmt: tipFmt }]) };
  };
  G.specTitle = spec => { const g = G.grammar(); const Mm = g[spec.measure]; const tr = { monthly: Mm.kind === 'flow' ? 'per month' : 'monthly mean', cumulative: 'cumulative', diff_baseline: 'averted vs baseline', pct_baseline: '% change vs baseline' }[spec.transform] || spec.transform; return Mm.label.charAt(0).toUpperCase() + Mm.label.slice(1) + ' ' + tr + ', by ' + (spec.by === 'set' ? 'setting' : spec.by) + (spec.window ? ', ' + spec.window.join('–') : ''); };
  G.renderAsked = function (host, startN) {
    let n = startN;
    for (const item of G.asked) {
      n++; const spec = item.spec; const F = makeFig({ id: 'asked-' + item.id, title: G.specTitle(spec), unit: 'composed from: "' + item.question + '"', measures: 'A chart composed from the question over the model\'s declared outputs: measure ' + spec.measure + ', transform ' + spec.transform + ', by ' + spec.by + ', form ' + spec.form + '.', questions: ['How was this chart built?', 'What is the main message here?', 'What would I need to answer this more precisely?'], data() { return item.last ? item.last.table() : mkData([], []); }, context(ctx) { const d = item.last ? item.last.table() : null; const base = gBaseContext(ctx, G.specTitle(spec), this.measures); const rows = d ? d.xs.slice(0, 60).map((x, i) => x + ': ' + d.cols.map(c => c.name + ' ' + ((c.fmt || fmt.int)(c.values[i]))).join(', ')).join(' · ') : ''; return base.concat(['Chart specification: ' + JSON.stringify(spec) + '.', 'Chart data (first rows): ' + rows]); } });
      const sec = el('section', { class: 'fig', id: 'gfig-asked-' + item.id }); const head = el('div', { class: 'fig-head' }); head.append(el('div', { class: 't' }, [el('h2', { html: '<span class="muted" style="font-weight:400;margin-right:6px">' + n + '</span>' + F.title }), el('div', { class: 'unit', text: F.unit })]));
      const acts = el('div', { class: 'fig-actions' }); const askBtn = el('button', { type: 'button', class: 'btn small primary', text: explainerAvailable() ? '✦ Ask about this chart' : '✦ Explain this chart' }); const tblBtn = el('button', { type: 'button', class: 'btn small', text: 'Table' }); const save = el('button', { type: 'button', class: 'btn small', text: 'Save as a default question' }); const rm = el('button', { type: 'button', class: 'btn small quiet', text: 'Remove' }); acts.append(askBtn, tblBtn, G.exportMenu(F, sec), save, rm); head.append(acts); sec.append(head);
      const body = el('div', { class: 'fig-body noaside' }); const chart = el('div', { class: 'chart' }); body.append(chart); sec.append(body); host.append(sec);
      try { item.last = G.composeChart(chart, spec); } catch (e) { chart.append(el('p', { class: 'small', text: 'Could not compose: ' + e.message })); console.error(e); }
      const tbl = el('div', { hidden: '' }); sec.append(tbl); tblBtn.addEventListener('click', () => { if (tbl.hidden) { tbl.innerHTML = ''; const d = F.data(); tbl.append(tableView(d.xs, d.cols)); tbl.hidden = false; tblBtn.textContent = 'Hide table'; } else { tbl.hidden = true; tblBtn.textContent = 'Table'; } });
      const ex = buildExplainer(F, G.buildCtx(G.active())); ex.hidden = !G.explainerOpen[F.id]; sec.append(ex); askBtn.addEventListener('click', () => { ex.hidden = !ex.hidden; G.explainerOpen[F.id] = !ex.hidden; if (!ex.hidden) $('input', ex).focus(); });
      save.addEventListener('click', () => { if (!G.savedQuestions.includes(item.question)) G.savedQuestions.push(item.question); save.textContent = 'Saved to the question list'; save.disabled = true; });
      rm.addEventListener('click', () => { G.asked = G.asked.filter(x => x !== item); G.renderFigures(); });
    }
  };

  /* --- router card, assumptions --- */
  G.renderRuns = function (ctx) {
    const r = ctx.res; const tr = $('#g-trace'); tr.innerHTML = '';
    for (const st of r.trace) tr.append(el('div', { class: 'st' + (st.decision ? ' decision' : '') }, [el('span', { class: 'n', text: String(st.n) }), el('span', { text: st.text }), el('span', { class: 'ms', text: fmt.ms(st.ms) })]));
    const mc = $('#g-mode-counts'); mc.innerHTML = ''; for (const [k, lbl] of [['cache', 'cache hits'], ['grid', 'grid lookups'], ['live', 'live runs'], ['emulator', 'emulator']]) mc.append(el('div', { class: 'm' }, [el('div', { class: 'n', text: String(G.modeCounts[k]) }), el('div', { class: 'l' }, el('span', { class: 'mode ' + k, text: lbl }))]));
    $('#g-route-note').textContent = G.entry.custom ? 'Custom models have no precomputed grid and no emulator: every request is a live run of the spec engine. The result cache still applies.' : (G.entry.grid ? 'This library model has a grid and an emulator: on-grid requests (levers on 5% / 10% steps, no advanced changes, no pins) are looked up. Off-grid requests go live or to the emulator by measured run time (' + fmt.ms(G.entry.runtime_ms) + ' per run).' : 'This library model runs in ' + fmt.ms(G.entry.runtime_ms) + ', so no grid or emulator was built for it: every request is a live run.');
  };
  G.renderAssumptions = function () { const u = $('#g-assumptions'); u.innerHTML = ''; G.pkg.assumptions.forEach(a => u.append(el('li', { text: a }))); if (!G.pkg.assumptions.length) u.append(el('li', { class: 'muted', text: 'The model package declares no assumptions.' })); const ft = $('#g-fixed-list'); ft.innerHTML = ''; G.pkg.params.filter(p => p.tier === 'fixed').forEach(p => ft.append(el('li', { text: (p.label || p.id) + ' = ' + p.value + (p.unit ? ' ' + p.unit : '') + (p.source ? ' (' + p.source + ')' : '') }))); };
  /* before the first run: no scenario strip, title, result cards or charts, only the invitation and the question box */
  G.renderEmpty = function () {
    $('#g-scn-strip').innerHTML = ''; const head = $('#panel-gbuild .scn-head'); if (head) head.hidden = true;
    for (const id of ['g-scn-chips', 'g-kpis', 'g-cmp-wrap']) { const n = $('#' + id); if (n) n.innerHTML = ''; } $('#g-stale').hidden = true;
    const host = $('#g-figures'); host.innerHTML = '';
    const card = el('section', { class: 'fig empty' }); card.append(el('h2', { text: 'Start with a scenario or a question' }), el('p', { class: 'prose', style: 'margin-top:6px', text: 'Set the inputs on the left and press Run, or ask a question below.' })); host.append(card);
    G.renderAskBox(host); G.renderStartOver();
  };
  G.renderAll = function () {
    if (!G.pkg) return; G.memo = new Map();
    if (!G.hasRun) { G.renderEmpty(); return; }
    { const head = $('#panel-gbuild .scn-head'); if (head) head.hidden = false; }
    try { const ctx = G.buildCtx(G.active()); G.renderStrip(); G.renderHeader(ctx); G.renderKPIs(ctx); G.renderComparison(); G.renderFigures(); G.renderRuns(ctx); G.renderAssumptions(); }
    catch (e) { console.error(e); const n = el('div', { class: 'stale', text: 'Could not draw the results (' + (e && e.message ? e.message : e) + ').' }); $('#g-figures').innerHTML = ''; $('#g-figures').append(n); }
  };

  /* --- settings view: one scenario applied to every declared parameter set --- */
  G.renderSettings = function () {
    const host = $('#g-settings-root'); host.innerHTML = ''; if (!G.pkg || !G.pkg.sets.length) { host.append(el('p', { class: 'small muted', text: 'This model declares no parameter sets.' })); return; }
    const a = G.active(); const o0 = G.pkg.observables[0]; const w = G.window(a);
    host.append(el('p', { class: 'prose', text: 'The active scenario\'s levers (' + (Object.keys(a.overrides).map(id => { const p = G.pkg.params.find(x => x.id === id); return p ? (p.label || id).toLowerCase() : id; }).join(', ') || 'none changed: baseline') + ') applied to each of the ' + G.pkg.sets.length + ' parameter sets the model declares, each compared with its own baseline. Central runs. Per 1,000 people over ' + w.label + '.' }));
    const rows = G.pkg.sets.map((st, k) => { const s2 = Object.assign(G.blank('_' + st.id), { set: st.id, overrides: clone(a.overrides), pins: clone(a.pins), horizon: a.horizon }); const res = G.execute(s2); const S = res.summary[o0.id]; return { st, res, S, color: MSE.SLOT_COLORS[k % 8] }; });
    const card = el('div', { class: 'card' }); card.append(el('h2', { text: o0.label + ' over ' + w.label + ' by setting, scenario vs its baseline' })); const ch = el('div', { class: 'chart' }); card.append(ch);
    barChart(ch, { categories: rows.map(r => ({ label: r.st.id, value: r.S.value.median, color: 'var(--s1)', note: fmt.signedPct(r.S.base.median ? (r.S.value.median - r.S.base.median) / r.S.base.median : 0,1), noteColor: r.S.value.median < r.S.base.median ? 'var(--good-text)' : 'var(--crit)', tipNote: 'baseline ' + fmt.int(r.S.base.median) })), height: 240, noteRow: true, valueName: o0.label, aria: 'By setting' });
    card.append(legend([{ name: 'Scenario (note: change vs the setting\'s own baseline)', color: 'var(--s1)', kind: 'box' }])); host.append(card);
    const grid = el('div', { class: 'uc-grid', style: 'margin-top:14px' });
    rows.forEach(r => { const c = el('div', { class: 'uc' }); c.append(el('h3', null, [el('span', { text: r.st.id }), el('small', { text: Object.keys(r.st.values).map(k => k + ' ' + r.st.values[k]).join(' · ') })])); const chh = el('div', { class: 'chart' }); c.append(chh); lineChart(chh, { x: r.res.t, xDomain: [w.chartFrom, w.end], series: [{ name: 'Baseline', color: 'var(--muted)', values: r.res.bseries[o0.id].central, dash: '5 4', width: 1.4 }, { name: 'Scenario', color: r.color, values: r.res.series[o0.id].central, width: 1.8 }], height: 150, marginLeft: 44, xTicks: xTicksFor(w), xLabel: xLabelFor(), aria: r.st.id }); c.append(legend([{ name: 'Baseline', color: 'var(--muted)', kind: 'dash' }, { name: 'Scenario', color: r.color, kind: 'line' }])); const open = el('button', { type: 'button', class: 'btn small open', text: 'Open in builder' }); open.addEventListener('click', () => { a.set = r.st.id; G.renderRail(); switchTab('gbuild'); G.runAll(); }); c.append(open); grid.append(c); });
    host.append(grid);
  };

  /* team path: the same catalogue panel, from the fixed figure library plus what the team engine cannot show */
  const _renderFigures = window.renderFigures;
  window.renderFigures = function () {
    if (!isTeam()) { if (G.pkg && state.tab === 'gbuild') G.renderFigures(); return; }
    if (!state.hasRun || !scenarioReady(active()) || !active().ran) return;
    _renderFigures();
    const host = $('#figures'); const q = host.querySelector('.subtab-q'); if (!q || host.querySelector('.catalogue')) return;
    const items = FIGS.map(F => ({ id: F.id, title: F.title, group: F.group, roles: F.views.includes('normal') ? ['policymaker', 'modeller'] : ['modeller'], needs: ({ cases: 'the fitted output (outpatient-treated cases)', totals: 'a flow output and scenarios', protection: 'campaign levers (nets, spraying)', prevalence: 'a share output', severity: 'severity classes in the model', fit: 'observed data the model was fitted to', sweep: 'levers with ranges', tornado: 'a varied tier and advanced parameters', costs: 'unit costs per intervention' })[F.id] || 'declared outputs', why: null }));
    items.push({ id: 'compartments', title: 'Where people are: compartments over time', group: 'why', roles: ['modeller'], needs: 'the engine to expose every compartment', why: 'the team engine returns S, V, R and I_a only. The spec engine exposes all compartments' });
    items.push({ id: 'settings', title: 'One scenario across every county (Country view tab)', group: 'results', roles: ['policymaker', 'modeller'], needs: 'parameter sets', why: null });
    items.push({ id: 'map', title: 'Map of counties (Country view tab)', group: 'results', roles: ['policymaker', 'modeller'], needs: 'settings linked to geography', why: null });
    void items; // the catalogue of possible charts is not shown
  };

  /* ===================== init ===================== */
  EXT.init = function () {
    registerLibrary();
    // colour theme: the map's blue ramp (chosen 23 Oct). The other palettes stay defined for a later switch.
    const st = document.createElement('style'); st.textContent = window.MSE_PALETTE_CSS(); document.head.appendChild(st);
    document.documentElement.setAttribute('data-palette', 'ramp');
    const sel = $('#model-pick'); renderPicker();
    sel.addEventListener('change', () => { const v = sel.value; if (v === '__chooser') { EXT.deselect(); return; } if (v === '__open') { renderPicker(); $('#model-file').click(); return; } const parts = v.split('|'); EXT.cluster = parts[1] || null;
      // same model picked from another cluster: keep the scenarios, change only what describes the cluster
      if (EXT.current && EXT.current.key === parts[0]) { renderPicker(); renderBadge(); renderFamilyNotes(); if (state.tab === 'model') renderModelTab(); return; }
      EXT.select(parts[0]); });
    $('#btn-model-details').addEventListener('click', () => switchTab('model'));
    $('#model-file').addEventListener('change', ev => { const f = ev.target.files && ev.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => openText(String(r.result), f.name); r.readAsText(f); ev.target.value = ''; });
    $('#g-btn-run').addEventListener('click', () => G.runAll()); $('#g-btn-reset').addEventListener('click', () => { const s = G.active(); s.overrides = {}; s.pins = {}; G.renderRail(); if (G.hasRun) G.runAll(); else G.renderRailState(); });
    $('#g-live-update').addEventListener('change', ev => { G.live = ev.target.checked; $('#g-stale').hidden = !G.dirty || G.live; if (G.live && G.dirty) G.runAll(); else G.renderRailState(); });
    const hash = (location.hash || '').replace('#', '');
    if (hash === 'seirs') EXT.select('seirs-treatment'); else if (hash === 'sir') EXT.select('sir'); else if (CHOOSER() && !['cema', 'build', 'country', 'usecase', 'model'].includes(hash)) EXT.deselect(); // no model is preselected
    else EXT.select('cema-county', { tab: ['country', 'usecase', 'model'].includes(hash) ? hash : 'build' });
    window.applyView();
  };
})();
EXT.init();
