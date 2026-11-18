let downloadsFn = null;
async function initDownloads() { try { if (window.claude && typeof window.claude.use === 'function') downloadsFn = await window.claude.use('downloads'); } catch (e) { downloadsFn = null; } }
async function saveFile(filename, data, mime) {
  if (downloadsFn) { try { await downloadsFn.save({ filename, data }); return; } catch (e) { if (e && e.code === 'cancelled') return; } }
  try { const blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'application/octet-stream' }); const url = URL.createObjectURL(blob); const a = el('a', { href: url, download: filename }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000); } catch (e) { console.warn('download failed', e); }
}
function resolveVars(str) { const cs = getComputedStyle(document.documentElement); return str.replace(/var\(--([\w-]+)\)/g, (m, v) => cs.getPropertyValue('--' + v).trim() || '#888'); }
function stamp() { return new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC'; }
function fileBase(F) { const s = active(); return 'mse-' + F.id + '-' + s.id + '-' + getResult(s).scenario_id; }
function figureSVGs(section) { return $$('svg', section).filter(x => !x.closest('.aside')); }
/** Compose the figure's chart(s) into one standalone SVG with title and footer, colours resolved. */
function composeSVG(section, F) {
  const svgs = figureSVGs(section); if (!svgs.length) return null;
  const cs = getComputedStyle(document.documentElement); const font = cs.getPropertyValue('--font').trim();
  const W = Math.max(...svgs.map(x => +x.getAttribute('width'))); const Hs = svgs.map(x => +x.getAttribute('height')); const gap = 24, title = 60, foot = 28;
  const H = title + Hs.reduce((a, b) => a + b + gap, 0) + foot;
  const s = active(); const r = getResult(s);
  let out = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" style="font-family:' + font.replace(/"/g, "'") + '">';
  out += '<rect width="' + W + '" height="' + H + '" fill="' + cs.getPropertyValue('--surface').trim() + '"/>';
  out += '<text x="12" y="22" font-size="15" font-weight="600" fill="' + cs.getPropertyValue('--ink').trim() + '">' + escapeXml(F.title) + '</text>';
  out += '<text x="12" y="38" font-size="11" fill="' + cs.getPropertyValue('--muted').trim() + '">' + escapeXml(F.unit + ' · scenario ' + s.id + ' · ' + scenarioName(s)) + '</text>';
  out += '<text x="12" y="52" font-size="11" fill="' + cs.getPropertyValue('--muted').trim() + '">' + escapeXml(r.scenario_id + ' · ' + 'model ' + E.MODEL_VERSION + ' · prototype, stand-in engine') + '</text>';
  let y = title;
  svgs.forEach((x, k) => { const c = x.cloneNode(true); c.setAttribute('style', 'font-family:' + font.replace(/"/g, "'") + ';font-size:11px'); c.setAttribute('x', 0); c.setAttribute('y', y); c.setAttribute('width', W); c.setAttribute('height', Hs[k]); let str = new XMLSerializer().serializeToString(c); str = resolveVars(str).replace(/font-family:var\(--font\)/g, 'font-family:' + font.replace(/"/g, "'")).replace(/font-family:var\(--mono\)/g, 'font-family:' + cs.getPropertyValue('--mono').trim().replace(/"/g, "'")); out += str; y += Hs[k] + gap; });
  out += '<text x="12" y="' + (H - 10) + '" font-size="10.5" fill="' + cs.getPropertyValue('--muted').trim() + '">' + escapeXml('Malaria Scenario Explorer · prototype · not a forecast · ' + stamp()) + '</text></svg>';
  return { svg: out, W, H };
}
function escapeXml(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function rasterize(section, F, type, scale) {
  return new Promise((resolve, reject) => {
    const c = composeSVG(section, F); if (!c) return reject(new Error('no chart'));
    const img = new Image(); const canvas = el('canvas', { width: c.W * scale, height: c.H * scale }); const g = canvas.getContext('2d');
    img.onload = () => { g.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() || '#fff'; g.fillRect(0, 0, canvas.width, canvas.height); g.drawImage(img, 0, 0, canvas.width, canvas.height); canvas.toBlob(b => b ? resolve(b) : reject(new Error('raster failed')), type === 'jpeg' ? 'image/jpeg' : 'image/png', 0.92); };
    img.onerror = () => reject(new Error('svg image failed'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(c.svg);
  });
}
async function exportImage(section, F, type) { try { const b = await rasterize(section, F, type, 2); saveFile(fileBase(F) + '.' + (type === 'jpeg' ? 'jpg' : 'png'), b, type === 'jpeg' ? 'image/jpeg' : 'image/png'); } catch (e) { console.warn(e); } }
function exportSVG(section, F) { const c = composeSVG(section, F); if (c) saveFile(fileBase(F) + '.svg', c.svg, 'image/svg+xml'); }
function csvOf(F) { const d = F.data(buildCtx(active())); const q = v => { const t = String(v == null ? '' : v); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; }; const rows = [['period'].concat(d.cols.map(c => c.name)).map(q).join(',')]; d.xs.forEach((x, i) => rows.push([q(x)].concat(d.cols.map(c => { const v = c.values[i]; return v == null || !isFinite(v) ? '' : (Math.abs(v) < 1 && v !== 0 ? v.toPrecision(6) : +v.toFixed(3)); })).join(','))); return rows.join('\n'); }
function metadataOf(F) {
  const s = active(); const r = getResult(s); const ctx = buildCtx(s);
  return { schema: 'mse-chart-metadata/0.1', generated: new Date().toISOString(), chart: { id: F.id, title: F.title, unit: F.unit, measures: F.measures, view: state.view, currency: state.currency, rate_per_usd: MSE.CURRENCIES[state.currency].perUSD },
    scenario: scenarioRecord(s), compared_scenarios: state.scenarios.filter(x => x !== s && scenarioReady(x) && x.ran).map(x => ({ id: x.id, name: scenarioName(x), scenario_id: getResult(x).scenario_id, inputs: engineInputs(x) })),
    assumptions_text: F.context(ctx).slice(-1)[0], varied: variedList(ctx).map(x => ({ parameter: x[0], range: x[1] })), set: setList(ctx).map(x => ({ input: x[0], value: x[1] })), note: 'Prototype output from a stand-in engine with illustrative county profiles. Not a forecast.' };
}
function summaryOf(F) {
  const s = active(); const r = getResult(s); const ctx = buildCtx(s); const notes = (F.notes ? F.notes(ctx) : '').replace(/<[^>]+>/g, '');
  const L = ['# ' + F.title, '', '_' + F.unit + '_', '', '**Scenario ' + s.id + ' · ' + scenarioName(s) + '** (' + r.scenario_id + ', ' + 'model ' + E.MODEL_VERSION + ')', '', '## What it shows', '', F.measures, '', ...(notes ? ['## Notes', '', notes, ''] : []), '## Inputs set in this scenario', ''];
  for (const [k, v] of setList(ctx)) L.push('- ' + k + ': ' + v);
  const adv = advList(ctx); if (adv.length) { L.push('', '## Advanced overrides', ''); for (const [k, v] of adv) L.push('- ' + k + ' = ' + v); }
  L.push('', '## Varied automatically (the bands)', ''); for (const [k, v] of variedList(ctx)) L.push('- ' + k + ': ' + v);
  const S = r.summary; const C = MSE.CURRENCIES[state.currency];
  L.push('', '## Computed, 2027–' + s.inputs.horizon, '', '- Outpatient-treated cases: ' + fmt.int(S.cases.median) + ' (90% range ' + fmt.int(S.cases.q05) + '–' + fmt.int(S.cases.q95) + ')', '- Baseline cases: ' + fmt.int(S.baseCases.median), '- Cases averted: ' + fmt.int(S.averted.median) + ' (' + fmt.pct(S.avertedPct.median, 1) + '. 90% range ' + fmt.pct(S.avertedPct.q05, 1) + ' to ' + fmt.pct(S.avertedPct.q95, 1) + ')', '- Severe episodes: ' + fmt.int(S.severe.median), '- Peak month: ' + fmt.ym(S.peak.t) + ' at ' + fmt.int(S.peak.value), '- Share infected in ' + s.inputs.horizon + ': ' + fmt.pct(S.prevEnd, 1) + ' (baseline ' + fmt.pct(S.bprevEnd, 1) + ')', '- Cost (illustrative, ' + state.currency + ' at 1 USD = ' + C.perUSD + '): ' + fmt.moneyFull(S.costs.total) + ' vs baseline ' + fmt.moneyFull(S.bcosts.total) + (S.costPerAverted == null ? '' : S.costPerAverted < 0 ? ' (dominates the baseline)' : ' (' + fmt.moneyUnit(S.costPerAverted) + ' per case averted)'));
  L.push('', '## Assumptions and limits', '', F.context(ctx).slice(-1)[0].replace(/^Assumptions and limits: /, ''), '', '---', 'Malaria Scenario Explorer · prototype · ' + stamp() + ' · not a forecast');
  return L.join('\n');
}
function exportMetadata(F) { saveFile(fileBase(F) + '-metadata.json', JSON.stringify(metadataOf(F), null, 2), 'application/json'); }
function exportSummary(section, F) { saveFile(fileBase(F) + '-summary.md', summaryOf(F), 'text/markdown'); }
function exportData(F) { saveFile(fileBase(F) + '-data.csv', csvOf(F), 'text/csv'); }
async function exportBundle(section, F) {
  const s = active(); const r = getResult(s); const base = fileBase(F);
  const files = [];
  const enc = t => new TextEncoder().encode(t);
  try { files.push([base + '.png', new Uint8Array(await (await rasterize(section, F, 'png', 2)).arrayBuffer())]); } catch (e) { console.warn(e); }
  const c = composeSVG(section, F); if (c) files.push([base + '.svg', enc(c.svg)]);
  files.push(['metadata.json', enc(JSON.stringify(metadataOf(F), null, 2))]);
  files.push(['summary.md', enc(summaryOf(F))]);
  files.push(['data.csv', enc(csvOf(F))]);
  files.push(['scenario.json', enc(JSON.stringify(scenarioRecord(s), null, 2))]);
  files.push(['model.json', enc(JSON.stringify({ model: r.model, engine: r.engine, fixed: E.FIXED, advanced_defaults: E.ADVANCED, varied_defaults: E.VARIED, varied_ranges: E.RANGES, products: E.PRODUCTS, irs: E.IRS, historical_campaigns: E.HIST_CAMPAIGNS, historical_irs_rounds: E.HIST_IRS_ROUNDS, counties: MSE.COUNTIES }, null, 2))]);
  files.push(['parameters.csv', enc('id,name,symbol,tier,unit,value_in_use,enters_model_as,source,set_by\n' + MSE.REGISTRY.map(x => { let v; try { v = x.value(buildCtx(s)); } catch (e) { v = ''; } return [x.id, x.name, x.sym, x.tier, x.unit, v, x.how, x.source, x.who].map(t => '"' + String(t).replace(/"/g, '""') + '"').join(','); }).join('\n'))]);
  files.push(['series.csv', enc(seriesCSV(s))]);
  files.push(['citations.bib', enc('@misc{cema2026model,\n  title={County-level malaria transmission model and intervention analysis for eight western Kenya counties},\n  author={{CEMA Malaria Team}},\n  year={2026},\n  note={Presentation of 2 October 2026}\n}\n@misc{mse2026prototype,\n  title={Malaria Scenario Explorer: interface prototype},\n  author={{CEMA software team}},\n  year={2026},\n  note={Stand-in engine. Not a forecast}\n}\n')]);
  const readme = '# ' + F.title + ' — export bundle\n\nScenario ' + s.id + ' · ' + scenarioName(s) + ' · ' + r.scenario_id + '\nGenerated ' + stamp() + ' by the Malaria Scenario Explorer prototype.\n\nFiles:\n- ' + base + '.png / .svg — the chart as shown\n- metadata.json — chart, scenario, inputs, parameters, execution record\n- summary.md — plain-language summary with the headline numbers\n- data.csv — the chart\'s data (the table view)\n- scenario.json — the full scenario record (inputs, translated parameters, summaries)\n- model.json — model and engine versions, fixed and default parameters, ranges, product curves, county profiles\n- parameters.csv — the parameter registry with the values in use\n- series.csv — monthly series for the scenario and its baseline\n- citations.bib — references\n- checksums.txt — SHA-256 of every file above\n\nAll numbers come from a stand-in engine with illustrative county profiles. They are explorations of the model under its assumptions, not forecasts.\n';
  files.push(['README.md', enc(readme)]);
  const sums = []; for (const [name, data] of files) sums.push((await sha256(data)) + '  ' + name); files.push(['checksums.txt', enc(sums.join('\n') + '\n')]);
  saveFile(base + '-bundle.zip', zipFiles(files), 'application/zip');
}
async function sha256(bytes) { try { if (crypto && crypto.subtle) { const h = await crypto.subtle.digest('SHA-256', bytes); return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join(''); } } catch (e) {} return 'crc32:' + crc32(bytes).toString(16).padStart(8, '0'); }
/* minimal ZIP writer (stored entries, no compression) */
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(bytes) { let c = 0xFFFFFFFF; for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zipFiles(files) {
  const parts = []; const central = []; let offset = 0; const enc = new TextEncoder();
  const d = new Date(); const dosTime = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF; const dosDate = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;
  const u16 = v => [v & 255, (v >>> 8) & 255], u32 = v => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
  for (const [name, data] of files) {
    const n = enc.encode(name); const crc = crc32(data);
    const local = new Uint8Array([...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(dosTime), ...u16(dosDate), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(n.length), ...u16(0), ...n]);
    parts.push(local, data);
    central.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(dosTime), ...u16(dosDate), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(n.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...n]));
    offset += local.length + data.length;
  }
  const cdSize = central.reduce((a, b) => a + b.length, 0);
  const end = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cdSize), ...u32(offset), ...u16(0)]);
  return new Blob([...parts, ...central, end], { type: 'application/zip' });
}
function scenarioRecord(s) {
  const r = getResult(s); const S = r.summary; const C = MSE.CURRENCIES[state.currency];
  return { schema: 'cema-scenario-record/0.1', scenario_id: r.scenario_id, id: s.id, name: scenarioName(s), preset: s.preset || null, created: new Date().toISOString(), model: r.model, engine: r.engine, execution: { mode: r.execution.computedMode, draws: r.execution.draws, seed: r.execution.seed, onGrid: r.execution.onGrid, approxError: r.execution.approxError },
    inputs: r.inputs, advanced: cleanAdvanced(s.advanced), pins: cleanPins(s.pins), parameters: r.parameters,
    summary: { window: windowRange(s), cases: S.cases, baseline_cases: S.baseCases, averted: S.averted, averted_pct: S.avertedPct, severe: S.severe, peak: S.peak, share_infected_end: S.prevEnd, costs_usd: S.costs, baseline_costs_usd: S.bcosts, cost_per_case_averted_usd: S.costPerAverted, display_currency: state.currency, rate_per_usd: C.perUSD }, note: 'Prototype output from a stand-in engine with illustrative county profiles. Not a forecast.' };
}
function seriesCSV(s) {
  const r = getResult(s); const t = r.t; const S = r.sim.series; const B = r.base.series; const rows = ['month,year,month_name,treated_median,treated_q05,treated_q95,baseline_treated_median,uncomplicated_median,severe_median,asymptomatic_median,infections_median,share_infected_median,net_protection,irs_protection,seasonality'];
  for (let k = 0; k < t.length; k++) { if (t[k] < 2015) continue; const y = Math.floor(t[k] + 1e-6), mo = Math.round((t[k] - y) * 12) % 12; rows.push([t[k].toFixed(4), y, MSE.MONTHS[mo], S.treated.median[k].toFixed(1), S.treated.q05[k].toFixed(1), S.treated.q95[k].toFixed(1), B.treated.median[k].toFixed(1), S.uncomp.median[k].toFixed(1), S.severe.median[k].toFixed(1), S.asym.median[k].toFixed(1), S.infections.median[k].toFixed(1), S.prev.median[k].toFixed(5), r.sim.central.itnProt[k].toFixed(4), r.sim.central.irsProt[k].toFixed(4), r.sim.central.seas[k].toFixed(4)].join(',')); }
  return rows.join('\n');
}
function exportJSON() { const s = active(); saveFile('mse-scenario-' + s.id + '-' + getResult(s).scenario_id + '.json', JSON.stringify(scenarioRecord(s), null, 2), 'application/json'); }
function exportCSV() { const s = active(); saveFile('mse-series-' + s.id + '-' + getResult(s).scenario_id + '.csv', seriesCSV(s), 'text/csv'); }
