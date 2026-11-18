/* Stand-in engine with the CEMA county model's structure.
   Compartments S, V, E, Ia, Iun, Isev, T, R (per capita). Daily Euler steps.
   Works in Node (module.exports) and in the browser (window.MSE_ENGINE). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MSE_ENGINE = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MODEL_VERSION = 'cema-county-standin/0.3';
  const ENGINE_VERSION = 'browser-euler/0.3';

  // ---- Product catalogue (illustrative, shaped after the 2 Oct efficacy figure) ----
  // peak: protective efficacy right after a campaign. k: decay per year (exp(-k t)).
  const PRODUCTS = {
    pyrethroid:  { label: 'Pyrethroid-only', short: 'Pyrethroid', peak: 0.16, k: 0.80, cost: 2.1, note: 'standard net. Reduced by pyrethroid resistance' },
    pyrethroid_hist: { label: 'Pyrethroid-only (before resistance)', short: 'Pyrethroid (pre-2024)', peak: 0.40, k: 0.75, cost: 2.1, note: 'historical campaigns 2012–2021', hidden: true },
    pbo:         { label: 'Pyrethroid-PBO (Olyset)', short: 'PBO', peak: 0.40, k: 0.75, cost: 2.6, note: 'current product in all eight counties since 2024' },
    ig2:         { label: 'Interceptor G2', short: 'IG2', peak: 0.58, k: 0.22, cost: 3.4, note: 'dual active ingredient (chlorfenapyr)' },
    royalguard:  { label: 'Royal Guard', short: 'Royal Guard', peak: 0.56, k: 0.25, cost: 3.3, note: 'dual active ingredient (pyriproxyfen)' },
    tsaraboost:  { label: 'Tsara Boost', short: 'Tsara Boost', peak: 0.55, k: 0.27, cost: 3.1, note: 'dual active ingredient' },
  };
  const IRS = { peak: 0.50, k: 1.8, costPerPerson: 5.5 };
  const HIST_CAMPAIGNS = [ [2012.0, 'pyrethroid_hist'], [2015.0, 'pyrethroid_hist'], [2018.0, 'pyrethroid_hist'], [2021.0, 'pyrethroid_hist'], [2024.0, 'pbo'] ];
  const HIST_IRS_ROUNDS = [2024.2, 2025.2, 2026.2];

  // ---- Fixed-tier parameters (per day) ----
  const FIXED = {
    mu_h: 1 / (62 * 365), gamma_h: 1 / 10, p_a: 0.55, p_u: 0.95,
    omega: 1 / 10, tau: 1 / 5, r: 1 / 7, r_s: 1 / 14, delta: 1 / 60,
  };
  // Varied-tier defaults (per day unless noted)
  const VARIED = { a: 0.33, rho: 1 / 90 };
  // Advanced-tier defaults shared across counties (county profiles override alpha, beta, phi, m)
  const ADVANCED = { eps: 0.40, b: 0.35, c: 0.50, mu_m: 0.10, gamma_m: 0.10, zeta_a: 0.60, zeta_t: 0.30, p_under5: 0.14 };

  function campaignsFor(inputs) {
    // historical campaigns up to the user's first campaign, then the user's schedule
    const list = HIST_CAMPAIGNS.filter(c => c[0] < inputs.campaignYear).slice();
    const interval = Math.max(1, inputs.interval || 3);
    for (let y = inputs.campaignYear; y <= inputs.horizon + 0.01; y += interval) list.push([y, inputs.product]);
    return list;
  }
  function irsRoundsFor(inputs, county) {
    // each round: [time, coverage]. Historical rounds use the county's recorded coverage.
    const rounds = county.irsHistory ? HIST_IRS_ROUNDS.map(t => [t, county.irsCoverageHist || 0.8]) : [];
    if (inputs.irsOn && inputs.irsMode === 'maintain') {
      const m = (inputs.irsMonth == null ? 2 : inputs.irsMonth) / 12;
      for (let y = 2027; y <= inputs.horizon; y++) rounds.push([y + m, inputs.irsCoverage]);
    }
    return rounds;
  }
  function itnEfficacy(t, campaigns, effMult, decayMult) {
    let best = null;
    for (let i = 0; i < campaigns.length; i++) if (campaigns[i][0] <= t) best = campaigns[i]; else break;
    if (!best) return 0;
    const p = PRODUCTS[best[1]];
    return p.peak * effMult * Math.exp(-p.k * decayMult * (t - best[0]));
  }
  function irsEfficacy(t, rounds, effMult) {
    // protection = efficacy(t) x coverage of the most recent round
    let last = null;
    for (let i = 0; i < rounds.length; i++) if (rounds[i][0] <= t) last = rounds[i]; else break;
    if (!last) return 0;
    return IRS.peak * effMult * Math.exp(-IRS.k * (t - last[0])) * last[1];
  }

  /** Build the full parameter set for one run from county profile + inputs + overrides. */
  function buildParams(county, inputs, advanced, draw) {
    advanced = advanced || {};
    draw = draw || {};
    const P = Object.assign({}, FIXED, VARIED, ADVANCED, {
      alpha: county.alpha, beta: county.beta, phi: county.phi, m: county.m,
    });
    for (const k in advanced) if (advanced[k] != null && !Number.isNaN(advanced[k])) P[k] = advanced[k];
    if (draw.a != null) P.a = draw.a;
    if (draw.rho != null) P.rho = draw.rho;
    P.p_t = inputs.pt;
    P.c_v = inputs.cv;
    P.vrate = P.p_under5 * P.c_v / 365; // S -> V per day (eligible cohort over a year)
    P.itn = { access: inputs.access, usage: inputs.usage, campaigns: campaignsFor(inputs), effMult: draw.itnEff == null ? 1 : draw.itnEff, decayMult: draw.itnDecay == null ? 1 : draw.itnDecay };
    P.irs = { rounds: irsRoundsFor(inputs, county), effMult: draw.irsEff == null ? 1 : draw.irsEff };
    P.N = county.population;
    P.tStart = 2008; P.tEnd = inputs.horizon + 1; // run to end of horizon year
    return P;
  }

  /** Run the model. Returns monthly aggregates from tStart to tEnd. */
  function run(P) {
    const dt = 1; // day
    const nDays = Math.round((P.tEnd - P.tStart) * 365);
    const nMonths = Math.round((P.tEnd - P.tStart) * 12);
    const out = {
      t: new Float64Array(nMonths), // decimal year at month start
      treated: new Float64Array(nMonths), uncomp: new Float64Array(nMonths), severe: new Float64Array(nMonths), asym: new Float64Array(nMonths), infections: new Float64Array(nMonths),
      prev: new Float64Array(nMonths), itnProt: new Float64Array(nMonths), irsProt: new Float64Array(nMonths), seas: new Float64Array(nMonths),
      S: new Float64Array(nMonths), V: new Float64Array(nMonths), R: new Float64Array(nMonths), Ia: new Float64Array(nMonths),
    };
    for (let k = 0; k < nMonths; k++) out.t[k] = P.tStart + k / 12;
    let S = 0.45, V = 0, E = 0.03, Ia = 0.25, Iun = 0.03, Isev = 0.002, T = 0.02, R = 0.218;
    const { mu_h, gamma_h, p_a, p_u, omega, tau, r, r_s, delta, rho, a, b, c, m, mu_m, gamma_m, zeta_a, zeta_t, eps, alpha, beta, phi, p_t, vrate } = P;
    const a2bcm = a * a * b * c * m, ac = a * c, vec = (gamma_m + mu_m) / gamma_m;
    const camps = P.itn.campaigns, rounds = P.irs.rounds, cover = P.itn.access * P.itn.usage;
    let ei = 0, ir = 0; // protection terms refreshed every day
    const monthCount = new Int32Array(nMonths);
    for (let d = 0; d < nDays; d++) {
      const t = P.tStart + d / 365;
      const k = Math.min(nMonths - 1, Math.floor((t - P.tStart) * 12 + 1e-9));
      ei = itnEfficacy(t, camps, P.itn.effMult, P.itn.decayMult);
      ir = rounds.length ? irsEfficacy(t, rounds, P.irs.effMult) : 0;
      const seas = 1 + alpha * beta * Math.cos(2 * Math.PI * (t - phi));
      const i = Isev + zeta_a * Ia + Iun + zeta_t * T;
      let lam = seas * (a2bcm * i / (ac * i + mu_m)) * vec;
      lam *= (1 - ei * cover) * (1 - ir);
      const infS = lam * S, infV = lam * (1 - eps) * V, toI = gamma_h * E;
      const fAsym = p_a * toI, fUn = p_u * (1 - p_a) * toI, fSev = (1 - p_u) * (1 - p_a) * toI;
      const fTreat = p_t * tau * Iun, fUntreat = (1 - p_t) * omega * Iun;
      const dS = mu_h - infS - vrate * S - mu_h * S + rho * R;
      const dV = vrate * S - infV - mu_h * V;
      const dE = infS + infV - toI - mu_h * E;
      const dIa = fAsym + fUntreat - delta * Ia - mu_h * Ia;
      const dIun = fUn - fTreat - fUntreat - mu_h * Iun;
      const dIsev = fSev - r_s * Isev - mu_h * Isev;
      const dT = fTreat - r * T - mu_h * T;
      const dR = delta * Ia + r * T + r_s * Isev - rho * R - mu_h * R;
      S += dS * dt; V += dV * dt; E += dE * dt; Ia += dIa * dt; Iun += dIun * dt; Isev += dIsev * dt; T += dT * dt; R += dR * dt;
      out.treated[k] += fTreat * dt; out.uncomp[k] += fUn * dt; out.severe[k] += fSev * dt; out.asym[k] += fAsym * dt; out.infections[k] += (infS + infV) * dt;
      out.prev[k] += Ia + Iun + Isev + T; out.itnProt[k] += ei * cover; out.irsProt[k] += ir; out.seas[k] += seas;
      out.S[k] += S; out.V[k] += V; out.R[k] += R; out.Ia[k] += Ia; monthCount[k]++;
    }
    for (let k = 0; k < nMonths; k++) {
      const n = monthCount[k] || 1;
      out.prev[k] /= n; out.itnProt[k] /= n; out.irsProt[k] /= n; out.seas[k] /= n; out.S[k] /= n; out.V[k] /= n; out.R[k] /= n; out.Ia[k] /= n;
      out.treated[k] *= P.N; out.uncomp[k] *= P.N; out.severe[k] *= P.N; out.asym[k] *= P.N; out.infections[k] *= P.N;
    }
    return out;
  }

  // ---- deterministic RNG (so a scenario id reproduces its draws) ----
  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return (s >>> 0) / 4294967296; };
  }
  function hash32(str) { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }

  /** Draws for the varied tier. pins: {itnEff, irsEff, a, rho} with null = varied. Latin-hypercube-ish stratified draws. */
  function makeDraws(n, seed, pins) {
    pins = pins || {};
    const r = rng(seed);
    const strat = (i, lo, hi) => lo + (hi - lo) * ((i + r()) / n);
    const perm = () => { const p = []; for (let i = 0; i < n; i++) p.push(i); for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; } return p; };
    const p1 = perm(), p2 = perm(), p3 = perm(), p4 = perm(), p5 = perm();
    const draws = [];
    for (let i = 0; i < n; i++) {
      draws.push({
        itnEff: pins.itnEff != null ? pins.itnEff : strat(p1[i], 0.90, 1.10),
        itnDecay: pins.itnEff != null ? 1 : strat(p2[i], 0.90, 1.15),
        irsEff: pins.irsEff != null ? pins.irsEff : strat(p3[i], 0.90, 1.10),
        a: pins.a != null ? pins.a : VARIED.a * strat(p4[i], 0.94, 1.06),
        rho: pins.rho != null ? pins.rho : 1 / strat(p5[i], 80, 110),
      });
    }
    return draws;
  }
  const RANGES = { itnEff: [0.90, 1.10], itnDecay: [0.90, 1.15], irsEff: [0.90, 1.10], a: [+(VARIED.a * 0.94).toFixed(3), +(VARIED.a * 1.06).toFixed(3)], rho_days: [80, 110] };

  function quantile(sorted, q) { const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos); return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo); }
  function summarise(runs, key) {
    const n = runs[0][key].length, res = { median: new Float64Array(n), q05: new Float64Array(n), q25: new Float64Array(n), q75: new Float64Array(n), q95: new Float64Array(n) };
    const tmp = new Float64Array(runs.length);
    for (let k = 0; k < n; k++) {
      for (let j = 0; j < runs.length; j++) tmp[j] = runs[j][key][k];
      const s = Array.from(tmp).sort((x, y) => x - y);
      res.median[k] = quantile(s, 0.5); res.q05[k] = quantile(s, 0.05); res.q25[k] = quantile(s, 0.25); res.q75[k] = quantile(s, 0.75); res.q95[k] = quantile(s, 0.95);
    }
    return res;
  }

  /** Simulate a scenario with n draws (n=1 -> deterministic with central values). */
  function simulate(county, inputs, advanced, pins, nDraws, seed) {
    const draws = nDraws > 1 ? makeDraws(nDraws, seed, pins) : [{ itnEff: pins && pins.itnEff != null ? pins.itnEff : 1, itnDecay: 1, irsEff: pins && pins.irsEff != null ? pins.irsEff : 1, a: pins && pins.a != null ? pins.a : undefined, rho: pins && pins.rho != null ? pins.rho : undefined }];
    const runs = draws.map(d => run(buildParams(county, inputs, advanced, d)));
    const t = runs[0].t;
    const series = {};
    for (const key of ['treated', 'uncomp', 'severe', 'asym', 'infections', 'prev']) series[key] = summarise(runs, key);
    // central run: pinned values where pinned, otherwise the central values of the varied tier
    const central = nDraws > 1 ? run(buildParams(county, inputs, advanced, { itnEff: pins && pins.itnEff != null ? pins.itnEff : 1, itnDecay: 1, irsEff: pins && pins.irsEff != null ? pins.irsEff : 1, a: pins && pins.a != null ? pins.a : undefined, rho: pins && pins.rho != null ? pins.rho : undefined })) : runs[0];
    return { t, series, central, draws, runs };
  }

  // Synthetic "observed" outpatient-treated cases 2017-2025 for a county (fixed per county).
  function observed(county, fittedInputs) {
    const base = run(buildParams(county, fittedInputs, null, null));
    const r = rng(hash32('obs:' + county.id));
    const pts = [];
    let ar = 0;
    for (let k = 0; k < base.t.length; k++) {
      const t = base.t[k];
      if (t < 2017 || t >= 2026) continue;
      // AR(1) deviation + lognormal noise
      const u1 = Math.max(1e-9, r()), u2 = r();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      ar = 0.6 * ar + 0.10 * z;
      const u3 = Math.max(1e-9, r()), u4 = r();
      const z2 = Math.sqrt(-2 * Math.log(u3)) * Math.cos(2 * Math.PI * u4);
      pts.push({ t, value: base.treated[k] * Math.exp(ar + 0.12 * z2) });
    }
    return pts;
  }

  return { MODEL_VERSION, ENGINE_VERSION, PRODUCTS, IRS, FIXED, VARIED, ADVANCED, RANGES, HIST_CAMPAIGNS, HIST_IRS_ROUNDS,
    buildParams, run, simulate, makeDraws, observed, hash32, rng, itnEfficacy, irsEfficacy, campaignsFor, irsRoundsFor, summarise };
});
