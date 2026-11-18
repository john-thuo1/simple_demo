let sampleFn = null, sampleState = 'pending';
function explainerAvailable() { return !!sampleFn; }
async function initSample() {
  try {
    if (typeof window.claude === 'object' && window.claude && typeof window.claude.use === 'function') { sampleFn = await window.claude.use('sample'); }
  } catch (e) { sampleFn = null; }
  sampleState = sampleFn ? 'ready' : 'absent';
  $$('.explain .status .avail').forEach(x => { x.textContent = sampleFn ? '' : ''; });
  $$('.fig-actions .primary').forEach(b => { b.textContent = sampleFn ? '✦ Ask about this chart' : '✦ Explain this chart'; });
}
const EXPLAIN_RULES = 'You are the explainer inside the Malaria Scenario Explorer, a prototype of a scenario-exploration tool built on the CEMA Malaria Team\'s county model. Answer the QUESTION using only the CONTEXT. Rules: explain what the chart shows and why the model behaves this way, in plain language suited to the stated audience. Do not forecast what will happen in reality and do not recommend a policy, product or strategy. Describe what the simulation shows under its assumptions. Use only numbers that appear in the context and never invent figures. Name the assumptions that matter for the answer. If the context cannot support an answer, say so and say what input or data would be needed. Keep the answer under 140 words. Remember that the results come from a stand-in engine with illustrative county profiles, not from the fitted model. Reply as plain text without headings or bullet lists.';
function buildExplainer(F, ctx) {
  const box = el('div', { class: 'explain', hidden: '' });
  const qrow = el('div', { class: 'q-row' }); qrow.append(el('span', { class: 'lead', text: 'Ask about "' + F.title + '"' }));
  const answer = el('div', { class: 'answer' }); const status = el('div', { class: 'status' }); const avail = el('span', { class: 'avail', text: sampleState === 'pending' ? '' : sampleFn ? '' : '' });
  const stopBtn = el('button', { type: 'button', class: 'btn small quiet', text: 'Stop', hidden: '' }); const ctxBtn = el('button', { type: 'button', class: 'btn small quiet', text: 'Show the context sent' });
  const ctxBox = el('div', { class: 'ctx' }); const pre = el('pre'); ctxBox.append(pre);
  ctxBtn.addEventListener('click', () => { ctxBox.classList.toggle('on'); pre.textContent = F.context(buildCtx(active())).join('\n'); ctxBtn.textContent = ctxBox.classList.contains('on') ? 'Hide the context' : 'Show the context sent'; });
  status.append(avail, stopBtn, ctxBtn);
  let ctl = null;
  async function ask(q) {
    const liveCtx = buildCtx(active()); const context = F.context(liveCtx).join('\n');
    answer.classList.add('on');
    if (sampleFn) {
      if (ctl) ctl.abort(); ctl = new AbortController(); stopBtn.hidden = false; answer.textContent = 'Thinking…';
      try {
        const r = await sampleFn(EXPLAIN_RULES + '\n\nCONTEXT:\n' + context + '\n\nQUESTION: ' + q, { signal: ctl.signal, modelTier: 'quick', onText: ({ text }) => { answer.textContent = text; } });
        answer.textContent = r.text + (r.truncated ? ' […]' : '');
      } catch (e) {
        if (e && e.code === 'cancelled') { answer.textContent = (e.text || '') + (e.text ? ' [stopped]' : 'Stopped.'); }
        else if (e && (e.code === 'not_granted' || e.code === 'sampling_disabled' || e.code === 'not_declared' || e.code === 'capability_disabled')) { sampleFn = null; sampleState = 'absent'; const p = F.prepared(q, liveCtx); answer.textContent = p || ''; avail.textContent = ''; }
        else if (e && e.code === 'rate_limited') answer.textContent = (e.text || '') + '\nToo many requests for now. Try again in a moment.';
        else answer.textContent = (e && e.text ? e.text + '\n' : '') + 'The answer could not be completed (' + (e && e.code ? e.code : 'error') + '). Try again.';
      } finally { stopBtn.hidden = true; }
    } else {
      const p = F.prepared(q, liveCtx);
      answer.textContent = p || '';
    }
  }
  stopBtn.addEventListener('click', () => { if (ctl) ctl.abort(); });
  for (const q of F.questions) { const b = el('button', { type: 'button', class: 'qchip', text: q }); b.addEventListener('click', () => ask(q)); qrow.append(b); }
  const form = el('form'); const inp = el('input', { type: 'text', placeholder: 'Ask about this chart…', 'aria-label': 'Question about ' + F.title, id: 'q-' + F.id }); const go = el('button', { type: 'submit', class: 'btn primary small', text: 'Ask' });
  form.append(inp, go); form.addEventListener('submit', ev => { ev.preventDefault(); const q = inp.value.trim(); if (q) ask(q); });
  box.append(qrow, form, answer, status, ctxBox);
  return box;
}
