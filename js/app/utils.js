const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
function el(tag, attrs, children) {
  const n = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    if (k === 'class') n.className = attrs[k];
    else if (k === 'text') n.textContent = attrs[k];
    else if (k === 'html') n.innerHTML = attrs[k];
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), attrs[k]);
    else if (attrs[k] != null) n.setAttribute(k, attrs[k]);
  }
  if (children) for (const c of [].concat(children)) if (c != null) n.append(c);
  return n;
}
const fmt = {
  int: n => Math.round(n).toLocaleString('en-US'),
  compact: n => { const a = Math.abs(n); if (a >= 1e9) return (n / 1e9).toFixed(a >= 1e10 ? 1 : 2) + 'B'; if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 1 : 2) + 'M'; if (a >= 1e3) return (n / 1e3).toFixed(a >= 1e5 ? 0 : 1) + 'k'; return Math.round(n).toString(); },
  pct: (x, d) => (x * 100).toFixed(d == null ? 0 : d) + '%',
  signedPct: (x, d) => (x >= 0 ? '+' : '−') + Math.abs(x * 100).toFixed(d == null ? 0 : d) + '%',
  usd: n => '$' + fmt.compact(n),
  money: usd => { const C = MSE.CURRENCIES[state.currency] || MSE.CURRENCIES.USD; return C.symbol + ' ' + fmt.compact(usd * C.perUSD); },
  moneyFull: usd => { const C = MSE.CURRENCIES[state.currency] || MSE.CURRENCIES.USD; return C.symbol + ' ' + fmt.int(usd * C.perUSD); },
  moneyUnit: usd => { const C = MSE.CURRENCIES[state.currency] || MSE.CURRENCIES.USD; const v = usd * C.perUSD; return C.symbol + ' ' + (v >= 100 ? fmt.int(v) : v.toFixed(2)); },
  ym: t => { const y = Math.floor(t + 1e-6); const mo = Math.round((t - y) * 12) % 12; return MSE.MONTHS[mo] + ' ' + y; },
  ms: ms => ms < 1 ? '<1 ms' : ms < 1000 ? Math.round(ms) + ' ms' : (ms / 1000).toFixed(1) + ' s',
};
function debounce(fn, ms) { let h; return function () { clearTimeout(h); const a = arguments; h = setTimeout(() => fn.apply(null, a), ms); }; }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function hex32(n) { return ('00000000' + n.toString(16)).slice(-8); }
function monthIndex(t, tArr) { for (let k = 0; k < tArr.length; k++) if (tArr[k] >= t - 1e-9) return k; return tArr.length; }
