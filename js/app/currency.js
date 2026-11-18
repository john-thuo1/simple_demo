function syncCurrency() { if (!state.currencyExplicit) { const c = county(active().inputs.county); state.currency = c ? (c.currency || MSE.COUNTRY_CURRENCY[c.country] || 'USD') : 'KES'; } const sel = $('#currency'); if (sel && sel.value !== state.currency) sel.value = state.currency; const hint = $('#currency-hint'); if (hint) { const C = MSE.CURRENCIES[state.currency]; hint.textContent = (state.currencyExplicit ? 'chosen' : 'follows the location') + (state.currency === 'USD' ? ' · unit costs are entered in USD' : ' · 1 USD = ' + C.perUSD + ' ' + state.currency + (state.view === 'researcher' ? ' (edit the rate below)' : ' (indicative)')); } }
function renderCurrencyControl() {
  const sel = $('#currency'); if (!sel || sel.options.length) return;
  for (const code in MSE.CURRENCIES) sel.append(el('option', { value: code, text: code + ' · ' + MSE.CURRENCIES[code].name }));
  sel.addEventListener('change', () => { state.currency = sel.value; state.currencyExplicit = true; syncCurrency(); renderAll(); });
  const rate = $('#rate'); rate.addEventListener('change', () => { const v = parseFloat(rate.value); if (v > 0) { MSE.CURRENCIES[state.currency].perUSD = v; syncCurrency(); renderAll(); } });
  const follow = $('#currency-follow'); if (follow) follow.addEventListener('click', () => { state.currencyExplicit = false; syncCurrency(); renderAll(); });
}
function renderRateBox() { const rate = $('#rate'); if (rate) { rate.value = MSE.CURRENCIES[state.currency].perUSD; rate.disabled = state.currency === 'USD'; } }
