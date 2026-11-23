const E = window.MSE_ENGINE;
const MSE = window.MSE = {};

MSE.COUNTIES = [
  { id: 'kisumu',   name: 'Kisumu',   group: 'itn',     population: 1155000, m: 0.1781, alpha: 0.50, beta: 0.80, phi: 0.42, access: 0.78, usage: 0.62, pt: 0.55, cv: 0.30 },
  { id: 'kakamega', name: 'Kakamega', group: 'itn',     population: 1868000, m: 0.2148, alpha: 0.45, beta: 0.80, phi: 0.45, access: 0.80, usage: 0.66, pt: 0.58, cv: 0.30 },
  { id: 'bungoma',  name: 'Bungoma',  group: 'itn',     population: 1670000, m: 0.1447, alpha: 0.50, beta: 0.75, phi: 0.47, access: 0.76, usage: 0.60, pt: 0.52, cv: 0.30 },
  { id: 'vihiga',   name: 'Vihiga',   group: 'itn',     population: 590000,  m: 0.1606, alpha: 0.45, beta: 0.80, phi: 0.44, access: 0.82, usage: 0.68, pt: 0.56, cv: 0.30 },
  { id: 'homabay',  name: 'Homa Bay', group: 'itn_irs', population: 1131000, m: 0.1557, alpha: 0.55, beta: 0.80, phi: 0.40, access: 0.74, usage: 0.58, pt: 0.55, cv: 0.30, irsHistory: true, irsCoverageHist: 0.85 },
  { id: 'busia',    name: 'Busia',    group: 'itn_irs', population: 893000,  m: 0.1468, alpha: 0.50, beta: 0.80, phi: 0.43, access: 0.75, usage: 0.60, pt: 0.55, cv: 0.30, irsHistory: true, irsCoverageHist: 0.85 },
  { id: 'siaya',    name: 'Siaya',    group: 'itn_irs', population: 993000,  m: 0.2739, alpha: 0.55, beta: 0.80, phi: 0.41, access: 0.72, usage: 0.56, pt: 0.55, cv: 0.30, irsHistory: true, irsCoverageHist: 0.85 },
  { id: 'migori',   name: 'Migori',   group: 'itn_irs', population: 1117000, m: 0.1888, alpha: 0.50, beta: 0.80, phi: 0.46, access: 0.70, usage: 0.55, pt: 0.52, cv: 0.30, irsHistory: true, irsCoverageHist: 0.85 },
];
MSE.COUNTIES.forEach(c => { c.country = 'KE'; c.currency = 'KES'; });
MSE.GROUPS = { itn: 'ITN-only county', itn_irs: 'ITN + IRS county' };
// Money: unit costs are stored in USD. Display converts with indicative rates (editable in researcher view).
MSE.CURRENCIES = {
  KES: { name: 'Kenyan shilling', symbol: 'KSh', perUSD: 129 },
  USD: { name: 'US dollar', symbol: '$', perUSD: 1 },
  EUR: { name: 'Euro', symbol: '€', perUSD: 0.92 },
  GBP: { name: 'Pound sterling', symbol: '£', perUSD: 0.78 },
  UGX: { name: 'Ugandan shilling', symbol: 'USh', perUSD: 3700 },
  TZS: { name: 'Tanzanian shilling', symbol: 'TSh', perUSD: 2600 },
  RWF: { name: 'Rwandan franc', symbol: 'RF', perUSD: 1400 },
};
MSE.COUNTRY_CURRENCY = { KE: 'KES', UG: 'UGX', TZ: 'TZS', RW: 'RWF' };
MSE.PRODUCT_ORDER = ['pyrethroid', 'pbo', 'ig2', 'royalguard', 'tsaraboost'];
MSE.PRODUCT_COLOR = { pyrethroid: 'var(--s1)', pbo: 'var(--s2)', ig2: 'var(--s3)', royalguard: 'var(--s4)', tsaraboost: 'var(--s5)' };
MSE.SLOT_COLORS = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)', 'var(--s8)'];
MSE.MAX_CHARTED = 8; // categorical hues: scenarios beyond the first eight shown on charts stay in the table
MSE.MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
MSE.N_DRAWS = 20;
MSE.RANGE_TEXT = { itnEff: '×' + E.RANGES.itnEff[0].toFixed(2) + '–' + E.RANGES.itnEff[1].toFixed(2), irsEff: '×' + E.RANGES.irsEff[0].toFixed(2) + '–' + E.RANGES.irsEff[1].toFixed(2), a: E.RANGES.a[0].toFixed(2) + '–' + E.RANGES.a[1].toFixed(2) + ' per day', rho: E.RANGES.rho_days[0] + '–' + E.RANGES.rho_days[1] + ' days', decay: '×' + E.RANGES.itnDecay[0].toFixed(2) + '–' + E.RANGES.itnDecay[1].toFixed(2) };

// Grid steps for the precomputed-results path (what the router checks)
MSE.GRID = { access: 0.10, usage: 0.10, irsCoverage: 0.10, pt: 0.10, cv: 0.10, campaignYear: [2027, 2028, 2029], interval: [2, 3, 4], horizon: [2030, 2032, 2035] };

// Illustrative unit costs (USD). Editable in researcher view. Placeholders until the team's costing data are available.
MSE.COSTS = { treatedCase: 3.5, netDelivery: 1.0, netsPerPerson: 0.56, irsPerPerson: 5.5, vaccinePerChild: 15 };

MSE.ADV_FIELDS = [
  { id: 'eps',      sym: 'ε',   label: 'Vaccine efficacy', unit: 'proportion', step: 0.01, min: 0, max: 1, def: () => E.ADVANCED.eps, how: 'V → E at λ(1−ε)' },
  { id: 'alpha',    sym: 'α',   label: 'Seasonal amplitude', unit: '0–1', step: 0.01, min: 0, max: 1, def: c => c.alpha, how: 'seas(t) = 1 + αβ·cos(2π(t−φ))' },
  { id: 'beta',     sym: 'β',   label: 'Seasonal scaling', unit: '0–1', step: 0.01, min: 0, max: 1, def: c => c.beta, how: 'seas(t) = 1 + αβ·cos(2π(t−φ))' },
  { id: 'phi',      sym: 'φ',   label: 'Seasonal phase (peak)', unit: 'fraction of year', step: 0.01, min: 0, max: 1, def: c => c.phi, how: 'seas(t) = 1 + αβ·cos(2π(t−φ))' },
  { id: 'b',        sym: 'b',   label: 'Mosquito → human transmission probability', unit: 'per bite', step: 0.01, min: 0, max: 1, def: () => E.ADVANCED.b, how: 'numerator of λ(t)' },
  { id: 'c',        sym: 'c',   label: 'Human → mosquito transmission probability', unit: 'per bite', step: 0.01, min: 0, max: 1, def: () => E.ADVANCED.c, how: 'numerator and denominator of λ(t)' },
  { id: 'm',        sym: 'm',   label: 'Mosquito-to-human ratio', unit: 'mosquitoes per person', step: 0.001, min: 0, max: 5, def: c => c.m, how: 'numerator of λ(t). Carries the county\'s fitted transmission level' },
  { id: 'mu_m',     sym: 'μ_m', label: 'Mosquito mortality', unit: 'per day', step: 0.005, min: 0.01, max: 0.5, def: () => E.ADVANCED.mu_m, how: 'denominator of λ(t) and the (γ_m+μ_m)/γ_m term' },
  { id: 'gamma_m',  sym: 'γ_m', label: 'Mosquito incubation rate', unit: 'per day', step: 0.005, min: 0.01, max: 0.5, def: () => E.ADVANCED.gamma_m, how: '(γ_m+μ_m)/γ_m term of λ(t)' },
  { id: 'zeta_a',   sym: 'ζ_a', label: 'Relative infectiousness, asymptomatic', unit: 'relative to I_un', step: 0.05, min: 0, max: 1, def: () => E.ADVANCED.zeta_a, how: 'I(t) = I_sev + ζ_a·I_a + I_un + ζ_t·T' },
  { id: 'zeta_t',   sym: 'ζ_t', label: 'Relative infectiousness, treated', unit: 'relative to I_un', step: 0.05, min: 0, max: 1, def: () => E.ADVANCED.zeta_t, how: 'I(t) = I_sev + ζ_a·I_a + I_un + ζ_t·T' },
  { id: 'p_under5', sym: 'p_under5', label: 'Share of children under five', unit: 'proportion', step: 0.01, min: 0, max: 0.5, def: () => E.ADVANCED.p_under5, how: 'S → V at p_under5·c_v' },
];

MSE.PIN_FIELDS = [
  { id: 'itnEff', label: 'Net efficacy (× product peak)', unit: 'multiplier', range: E.RANGES.itnEff, step: 0.01, def: 1 },
  { id: 'irsEff', label: 'IRS efficacy (× peak)', unit: 'multiplier', range: E.RANGES.irsEff, step: 0.01, def: 1 },
  { id: 'a',      label: 'Biting rate a', unit: 'bites per mosquito per day', range: E.RANGES.a, step: 0.005, def: E.VARIED.a },
  { id: 'rho',    label: 'Loss of immunity ρ', unit: 'days (1/ρ)', range: E.RANGES.rho_days, step: 1, def: Math.round(1 / E.VARIED.rho), days: true },
];

// Registry: one entry per parameter or input. tier: user | advanced | varied | fixed | structural
MSE.REGISTRY = [
  { id: 'county', tier: 'user', name: 'County', sym: '—', unit: '—', meaning: 'Which fitted county profile is used: baseline transmission (m), seasonality (α, β, φ), population and current coverage levels.', how: 'Selects the parameter set. All other entries read their defaults from it.', source: 'Model fitted to outpatient-treated cases 2017–2025 (modelling team). Illustrative profiles in this prototype.', who: 'Any user', value: ctx => ctx.county ? ctx.county.name + ' (' + MSE.GROUPS[ctx.county.group] + ')' : '—' },
  { id: 'product', tier: 'user', name: 'Net type or product', sym: '—', unit: '—', meaning: 'The net distributed from the next mass campaign. Each product has its own protective efficacy curve: a peak right after distribution and a decay until the next campaign.', how: 'Sets E_net(t): peak and decay rate. The curve resets at every campaign.', source: 'Product-specific efficacy curves (modelling team, shaped after the 2 Oct figure in this prototype).', who: 'Any user', value: ctx => ctx.inputs.product ? E.PRODUCTS[ctx.inputs.product].label + ' · peak ' + E.PRODUCTS[ctx.inputs.product].peak.toFixed(2) : '—' },
  { id: 'access', tier: 'user', name: 'Net access', sym: '—', unit: '% of people', meaning: 'Share of the population with access to a net in the household.', how: 'Multiplies net efficacy: protection = E_net(t) × access × usage.', source: 'Household survey coverage (county). Illustrative here.', who: 'Any user', value: ctx => ctx.inputs.access == null ? '—' : Math.round(ctx.inputs.access * 100) + '%' },
  { id: 'usage', tier: 'user', name: 'Net usage', sym: '—', unit: '% of those with access', meaning: 'Share of people with access who slept under the net the previous night.', how: 'Multiplies net efficacy: protection = E_net(t) × access × usage.', source: 'Household survey coverage (county). Illustrative here.', who: 'Any user', value: ctx => ctx.inputs.usage == null ? '—' : Math.round(ctx.inputs.usage * 100) + '%' },
  { id: 'campaign', tier: 'user', name: 'Campaign schedule', sym: '—', unit: 'year, years between campaigns', meaning: 'When the next mass distribution happens and how often it repeats. Efficacy returns to the product\'s peak at each campaign.', how: 'Reset times of E_net(t). Historical campaigns (2015, 2018, 2021, 2024 with PBO) are fixed.', source: 'National programme plan (2027 campaign). User choice.', who: 'Any user', value: ctx => ctx.inputs.campaignYear + ', every ' + ctx.inputs.interval + ' years' },
  { id: 'irs', tier: 'user', name: 'Indoor residual spraying', sym: '—', unit: 'on/off, % households, month', meaning: 'Whether yearly spray rounds continue (or start) from 2027, how many households are sprayed and in which month.', how: 'Protection = E_IRS(t) × coverage. E_IRS peaks at each round and decays within the year. Historical rounds 2024–2026 are fixed for the four ITN + IRS counties.', source: 'Programme records. User choice from 2027.', who: 'Any user', value: ctx => !ctx.county || !ctx.inputs.irsMode ? '—' : ctx.inputs.irsMode === 'maintain' ? 'yearly rounds, ' + Math.round(ctx.inputs.irsCoverage * 100) + '% coverage, ' + MSE.MONTHS[ctx.inputs.irsMonth] : (ctx.county.irsHistory ? 'stopped after 2026' : 'none') },
  { id: 'pt', tier: 'user', name: 'Treatment coverage', sym: 'p_t', unit: '% of symptomatic uncomplicated cases', meaning: 'Share of uncomplicated symptomatic cases that receive outpatient treatment.', how: 'I_un → T at p_t·τ. The untreated share moves to I_a at (1−p_t)·ω.', source: 'Derived from data over time (modelling team). County default.', who: 'Any user', value: ctx => ctx.inputs.pt == null ? '—' : Math.round(ctx.inputs.pt * 100) + '%' },
  { id: 'cv', tier: 'user', name: 'Vaccination coverage of under-fives', sym: 'c_v', unit: '% of under-fives per year', meaning: 'Share of the target population (children under five) receiving the vaccine over time.', how: 'S → V at p_under5·c_v.', source: 'Derived from data over time (modelling team). County default.', who: 'Any user', value: ctx => ctx.inputs.cv == null ? '—' : Math.round(ctx.inputs.cv * 100) + '%' },
  { id: 'horizon', tier: 'user', name: 'Simulation horizon', sym: '—', unit: 'year', meaning: 'Last year simulated.', how: 'Length of the run. Summaries cover 2027 to this year.', source: 'User choice.', who: 'Any user', value: ctx => String(ctx.inputs.horizon) },
  { id: 'eps', tier: 'advanced', name: 'Vaccine efficacy', sym: 'ε', unit: 'proportion', meaning: 'Proportionate reduction in the risk of infection for vaccinated individuals compared to unvaccinated ones.', how: 'V → E at λ(1−ε).', source: 'Vaccine trials. Modelling team default.', who: 'Researchers. Students with a modelling background', value: ctx => fmtAdv(ctx, 'eps') },
  { id: 'alpha', tier: 'advanced', name: 'Seasonal amplitude', sym: 'α', unit: '0–1', meaning: 'How strongly transmission rises and falls over the year.', how: 'seas(t) = 1 + αβ·cos(2π(t−φ)).', source: 'Fitted per county.', who: 'Researchers. Students with a modelling background', value: ctx => fmtAdv(ctx, 'alpha') },
  { id: 'beta', tier: 'advanced', name: 'Seasonal scaling', sym: 'β', unit: '0–1', meaning: 'Scales the seasonal amplitude.', how: 'seas(t) = 1 + αβ·cos(2π(t−φ)).', source: 'Fitted per county.', who: 'Researchers. Students with a modelling background', value: ctx => fmtAdv(ctx, 'beta') },
  { id: 'phi', tier: 'advanced', name: 'Seasonal phase', sym: 'φ', unit: 'fraction of year', meaning: 'When in the year transmission peaks (0.42 ≈ early June).', how: 'seas(t) = 1 + αβ·cos(2π(t−φ)).', source: 'Fitted per county (rainfall-driven).', who: 'Researchers. Students with a modelling background', value: ctx => fmtAdv(ctx, 'phi') },
  { id: 'b', tier: 'advanced', name: 'Mosquito → human transmission probability', sym: 'b', unit: 'per infectious bite', meaning: 'Probability that a bite from an infectious mosquito infects a person.', how: 'Numerator of λ(t).', source: 'Literature. Modelling team default.', who: 'Researchers. Students with a modelling background', value: ctx => fmtAdv(ctx, 'b') },
  { id: 'c', tier: 'advanced', name: 'Human → mosquito transmission probability', sym: 'c', unit: 'per bite', meaning: 'Probability that a bite on an infectious person infects the mosquito.', how: 'Numerator and denominator of λ(t).', source: 'Literature. Modelling team default.', who: 'Researchers. Students with a modelling background', value: ctx => fmtAdv(ctx, 'c') },
  { id: 'm', tier: 'advanced', name: 'Mosquito-to-human ratio', sym: 'm', unit: 'mosquitoes per person', meaning: 'Vector density relative to the population. Carries most of the county\'s fitted transmission level.', how: 'Numerator of λ(t).', source: 'Fitted per county.', who: 'Researchers. Students with a modelling background', value: ctx => fmtAdv(ctx, 'm') },
  { id: 'mu_m', tier: 'advanced', name: 'Mosquito mortality', sym: 'μ_m', unit: 'per day', meaning: 'Death rate of adult mosquitoes (1/μ_m is the mean lifespan).', how: 'Denominator of λ(t) and the (γ_m+μ_m)/γ_m term.', source: 'Literature. Modelling team default.', who: 'Researchers. Students with a modelling background', value: ctx => fmtAdv(ctx, 'mu_m') },
  { id: 'gamma_m', tier: 'advanced', name: 'Mosquito incubation rate', sym: 'γ_m', unit: 'per day', meaning: 'Rate at which an infected mosquito becomes infectious (1/γ_m is the extrinsic incubation period).', how: '(γ_m+μ_m)/γ_m term of λ(t).', source: 'Literature. Modelling team default.', who: 'Researchers. Students with a modelling background', value: ctx => fmtAdv(ctx, 'gamma_m') },
  { id: 'zeta_a', tier: 'advanced', name: 'Relative infectiousness of asymptomatic cases', sym: 'ζ_a', unit: 'relative to I_un', meaning: 'How infectious an asymptomatic infection is to mosquitoes compared with an uncomplicated case.', how: 'I(t) = I_sev + ζ_a·I_a + I_un + ζ_t·T.', source: 'Literature. Modelling team default.', who: 'Researchers. Students with a modelling background', value: ctx => fmtAdv(ctx, 'zeta_a') },
  { id: 'zeta_t', tier: 'advanced', name: 'Relative infectiousness of treated cases', sym: 'ζ_t', unit: 'relative to I_un', meaning: 'How infectious a treated case is while parasites clear.', how: 'I(t) = I_sev + ζ_a·I_a + I_un + ζ_t·T.', source: 'Literature. Modelling team default.', who: 'Researchers. Students with a modelling background', value: ctx => fmtAdv(ctx, 'zeta_t') },
  { id: 'p_under5', tier: 'advanced', name: 'Share of children under five', sym: 'p_under5', unit: 'proportion', meaning: 'Proportion of children under 5 years old in the population.', how: 'S → V at p_under5·c_v.', source: 'Census.', who: 'Researchers. Students with a modelling background', value: ctx => fmtAdv(ctx, 'p_under5') },
  { id: 'itnEff', tier: 'varied', name: 'Net efficacy within the product\'s range', sym: 'E_net', unit: '× product peak and decay', meaning: 'Each run draws the product\'s efficacy curve from its range (peak ' + MSE.RANGE_TEXT.itnEff + ', decay ' + MSE.RANGE_TEXT.decay + ') so the band reflects how well the net works.', how: 'Scales E_net(t).', source: 'Ranges agreed with the modelling team (placeholders here).', who: 'The tool. A researcher may pin it', value: ctx => ctx.pins.itnEff != null ? 'pinned at ×' + ctx.pins.itnEff : 'varied ' + MSE.RANGE_TEXT.itnEff },
  { id: 'irsEff', tier: 'varied', name: 'IRS efficacy within its range', sym: 'E_IRS', unit: '× peak', meaning: 'Each run draws the spray round\'s efficacy from its range (' + MSE.RANGE_TEXT.irsEff + ').', how: 'Scales E_IRS(t).', source: 'Ranges agreed with the modelling team (placeholders here).', who: 'The tool. A researcher may pin it', value: ctx => ctx.pins.irsEff != null ? 'pinned at ×' + ctx.pins.irsEff : 'varied ' + MSE.RANGE_TEXT.irsEff },
  { id: 'a', tier: 'varied', name: 'Biting rate', sym: 'a', unit: 'bites per mosquito per day', meaning: 'How often a mosquito bites people. Enters λ(t) squared, so small changes matter.', how: 'a²·b·c·m·i / (a·c·i + μ_m).', source: 'Range agreed with the modelling team (' + MSE.RANGE_TEXT.a + ' here).', who: 'The tool. A researcher may pin it', value: ctx => ctx.pins.a != null ? 'pinned at ' + ctx.pins.a : 'varied ' + MSE.RANGE_TEXT.a },
  { id: 'rho', tier: 'varied', name: 'Loss of immunity', sym: 'ρ', unit: 'per day (1/ρ in days)', meaning: 'Rate at which recovered people lose temporary immunity and become susceptible again.', how: 'R → S at ρ.', source: 'Range agreed with the modelling team (' + MSE.RANGE_TEXT.rho + ' here).', who: 'The tool. A researcher may pin it', value: ctx => ctx.pins.rho != null ? 'pinned at ' + Math.round(1 / ctx.pins.rho) + ' days' : 'varied ' + MSE.RANGE_TEXT.rho },
  { id: 'gamma_h', tier: 'fixed', name: 'Progression from exposure', sym: 'γ_h', unit: 'per day', meaning: 'Human progression rate from exposed to infected (1/γ_h ≈ 10 days).', how: 'E → I_a, I_un, I_sev at γ_h split by p_a and p_u.', source: 'Literature (modelling team).', who: 'Modelling team', value: () => E.FIXED.gamma_h.toFixed(3) },
  { id: 'p_a', tier: 'fixed', name: 'Asymptomatic share', sym: 'p_a', unit: 'proportion', meaning: 'Proportion of infections expected to develop asymptomatic malaria.', how: 'E → I_a at p_a·γ_h.', source: 'Literature (modelling team).', who: 'Modelling team', value: () => E.FIXED.p_a.toFixed(2) },
  { id: 'p_u', tier: 'fixed', name: 'Uncomplicated share', sym: 'p_u', unit: 'proportion', meaning: 'Of symptomatic infections, the proportion that are uncomplicated rather than severe.', how: 'E → I_un at p_u(1−p_a)γ_h. E → I_sev at (1−p_u)(1−p_a)γ_h.', source: 'Literature (modelling team).', who: 'Modelling team', value: () => E.FIXED.p_u.toFixed(2) },
  { id: 'omega', tier: 'fixed', name: 'Symptom duration, untreated', sym: 'ω', unit: 'per day', meaning: 'Duration of symptoms in an untreated clinical infection (rate).', how: 'I_un → I_a at (1−p_t)·ω.', source: 'Literature (modelling team).', who: 'Modelling team', value: () => E.FIXED.omega.toFixed(3) },
  { id: 'tau', tier: 'fixed', name: 'Symptom duration before treatment', sym: 'τ', unit: 'per day', meaning: 'Duration of symptoms in a symptomatic clinical infection that is treated (rate).', how: 'I_un → T at p_t·τ.', source: 'Literature (modelling team).', who: 'Modelling team', value: () => E.FIXED.tau.toFixed(3) },
  { id: 'r', tier: 'fixed', name: 'Parasite clearance after treatment', sym: 'r', unit: 'per day', meaning: 'Time taken to clear parasites after treatment (rate).', how: 'T → R at r.', source: 'Literature (modelling team).', who: 'Modelling team', value: () => E.FIXED.r.toFixed(3) },
  { id: 'r_s', tier: 'fixed', name: 'Recovery from severe malaria', sym: 'r_s', unit: 'per day', meaning: 'Spontaneous recovery from severe infection (rate).', how: 'I_sev → R at r_s.', source: 'Literature (modelling team).', who: 'Modelling team', value: () => E.FIXED.r_s.toFixed(3) },
  { id: 'delta', tier: 'fixed', name: 'Clearance of asymptomatic infection', sym: 'δ', unit: 'per day', meaning: 'Rate at which asymptomatic infections clear.', how: 'I_a → R at δ.', source: 'Literature (modelling team).', who: 'Modelling team', value: () => E.FIXED.delta.toFixed(4) },
  { id: 'mu_h', tier: 'fixed', name: 'Births (and deaths)', sym: 'μ_h', unit: 'per day', meaning: 'Recruitment rate of humans by birth. Equal deaths keep the population closed.', how: 'Inflow to S. Outflow from every class.', source: 'Demographic data.', who: 'Modelling team', value: () => E.FIXED.mu_h.toExponential(2) },
  { id: 'struct', tier: 'fixed', name: 'Structural assumptions', sym: '—', unit: '—', meaning: 'Mosquito population at equilibrium. No superinfection. Closed human population. Deterministic dynamics.', how: 'Shape of the equations.', source: 'Model formulation (modelling team).', who: 'Modelling team', value: () => 'as formulated' },
];
function fmtAdv(ctx, id) {
  const f = MSE.ADV_FIELDS.find(x => x.id === id); if (!ctx.county) return '— (fitted per county)'; const d = f.def(ctx.county);
  const v = ctx.advanced[id]; const s = (x) => (Math.abs(x) < 0.01 ? x.toExponential(2) : String(+x.toFixed(4)));
  return v != null && v !== d ? s(v) + ' (fitted ' + s(d) + ')' : s(d) + ' (fitted)';
}

MSE.TIERS = [
  { tier: 'user', name: 'User-facing', params: 'County (carries fitted baseline transmission and seasonality). Net type or product (pyrethroid, PBO, Royal Guard, Interceptor G2, Tsara Boost). Net coverage (access and usage) and campaign schedule. IRS on or off, with its coverage and spraying schedule. Treatment coverage (p_t). Vaccination coverage of under-fives (c_v). Simulation horizon (a run setting, not a model parameter)', who: 'Any user: normal users, students and researchers' },
  { tier: 'advanced', name: 'Advanced user-facing', params: 'Vaccine efficacy (ε). Seasonal amplitude and phase (α, β, φ). Transmission probabilities (b, c). Mosquito-to-human ratio (m). Mosquito mortality and incubation (μ_m, γ_m). Relative infectiousness of asymptomatic and treated cases (ζ_a, ζ_t). Share of children under five', who: 'Researchers, and students with a modelling background, with the fitted value as default' },
  { tier: 'varied', name: 'Varied automatically', params: 'Net and IRS efficacy within each product\'s range. Biting rate (a). Loss of immunity (ρ)', who: 'The tool, from ranges agreed with the modelling team. A researcher may pin any of them to a single value' },
  { tier: 'fixed', name: 'Fixed', params: 'Progression from exposure (γ_h). Asymptomatic and uncomplicated shares (p_a, p_u). Symptom durations (ω, τ). Recovery and clearance (r, r_s, δ). Births (μ_h). Structural assumptions such as mosquito population at equilibrium, no superinfection and a closed human population', who: 'The modelling team and available literature' },
];

// The team's strategy sets (2 Oct slides)
MSE.PRESETS = {
  itn: [
    { label: 'Baseline · PBO nets', product: 'pbo', irsMode: 'stop' },
    { label: 'S1 · Dual ITN, Interceptor G2', product: 'ig2', irsMode: 'stop' },
    { label: 'S2 · Dual ITN, Royal Guard', product: 'royalguard', irsMode: 'stop' },
    { label: 'S3 · Dual ITN, Tsara Boost', product: 'tsaraboost', irsMode: 'stop' },
  ],
  itn_irs: [
    { label: 'Baseline · PBO nets, IRS stopped', product: 'pbo', irsMode: 'stop' },
    { label: 'S1 · Interceptor G2, IRS stopped', product: 'ig2', irsMode: 'stop' },
    { label: 'S2 · PBO nets, IRS maintained yearly', product: 'pbo', irsMode: 'maintain' },
  ],
};

MSE.FIG_GROUPS = [
  { id: 'results', label: 'What happens', q: 'Are cases lower, and by how much?' },
  { id: 'why', label: 'Why it changes', q: 'Where does the change come from?' },
  { id: 'confidence', label: 'How sure', q: 'What moves the result, and how well is the model fitted?' },
  { id: 'costs', label: 'What it costs', q: 'What does the strategy cost per case averted?' },
  { id: 'asked', label: 'Your questions', q: 'Charts composed from your own questions, over the model\'s outputs' },
  { id: 'all', label: 'All charts', q: 'Everything on one page' },
];
/* Start screen (18 Nov 2026). true: the tool opens with no model selected and shows the list of models to choose from.
   The Policymaker sees every reviewed model but not "Open a model file". false: the previous behaviour, the CEMA county
   model is preselected. This one switch turns the whole feature on or off. */
MSE.START_WITH_CHOOSER = true;
/* One view (23 Nov 2026). true: there is no Policymaker / Modeller switch. Everyone sees every input, chart and model
   detail, and the advanced and varied inputs sit under "More controls", closed until opened. false: the two views and
   the switch come back as before. This one switch turns the whole feature on or off. */
MSE.SINGLE_VIEW = true;
MSE.VIEW_HELP = {
  normal: '',
  student: 'User-facing inputs plus the model, equations and full registry to learn from.',
  researcher: '',
};
