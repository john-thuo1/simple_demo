
(function (root, entry) {
  if (typeof module === 'object' && module.exports) module.exports = entry;
  else (root.MSE_MODEL_LIBRARY = root.MSE_MODEL_LIBRARY || []).push(entry);
})(typeof self !== 'undefined' ? self : this,
 {
   "id": "cema-county",
   "reviewed": true,
   "reviewer": "CEMA Malaria Team (transcription pending their review)",
   "grid": true,
   "runtime_ms": 900,
   "costs": true,
   "blurb": "The eight-county model behind the 2027 net-campaign and IRS questions. Eight fitted parameter sets, three interventions.",
   "package": {
    "model_id": "919bbecd",
    "model": {
     "name": "CEMA county malaria model",
     "standing": "fitted",
     "start": 2017,
     "source": "CEMA Malaria Team, 2 Oct 2026. Simplified transcription with illustrative values",
     "notes": ""
    },
    "standing": "fitted",
    "compartments": [
     {
      "id": "S",
      "label": "Susceptible",
      "init": 0.52,
      "group": "human",
      "absorbing": false
     },
     {
      "id": "E",
      "label": "Exposed",
      "init": 0.03,
      "group": "human",
      "absorbing": false
     },
     {
      "id": "I_a",
      "label": "Asymptomatic infection",
      "init": 0.22,
      "group": "human",
      "absorbing": false
     },
     {
      "id": "I_un",
      "label": "Uncomplicated malaria",
      "init": 0.03,
      "group": "human",
      "absorbing": false
     },
     {
      "id": "I_sev",
      "label": "Severe malaria",
      "init": 0.002,
      "group": "human",
      "absorbing": false
     },
     {
      "id": "T",
      "label": "Treated (outpatient)",
      "init": 0.018,
      "group": "human",
      "absorbing": false
     },
     {
      "id": "R",
      "label": "Recovered, temporary immunity",
      "init": 0.18,
      "group": "human",
      "absorbing": false
     }
    ],
    "parameters": [
     {
      "id": "p_t",
      "type": "fraction",
      "default": 0.6,
      "annotation": {
       "label": "Treatment coverage",
       "unit": "share of uncomplicated cases treated",
       "range": [
        0.2,
        0.95
       ],
       "tier": "user",
       "lever": true,
       "source": "county fit, 2 Oct slides"
      }
     },
     {
      "id": "itn",
      "type": "campaign",
      "default": {
       "coverage": 0.62,
       "peak": 0.4,
       "decay": 0.75,
       "every": 3,
       "from": 2024,
       "month": 0
      },
      "annotation": {
       "label": "Net campaign",
       "unit": "",
       "range": null,
       "tier": "user",
       "lever": true,
       "source": "product efficacy × access × usage. PBO curve shaped to the 2 Oct figure"
      }
     },
     {
      "id": "irs",
      "type": "campaign",
      "default": {
       "coverage": 0,
       "peak": 0.5,
       "decay": 1.8,
       "every": 1,
       "from": 2027,
       "month": 2
      },
      "annotation": {
       "label": "Indoor residual spraying",
       "unit": "",
       "range": null,
       "tier": "user",
       "lever": true,
       "source": "yearly rounds. Coverage 0 = stopped"
      }
     },
     {
      "id": "alpha",
      "type": "number",
      "default": 0.55,
      "annotation": {
       "label": "Seasonal amplitude",
       "unit": "—",
       "range": [
        0,
        1
       ],
       "tier": "advanced",
       "lever": false,
       "source": "county fit"
      }
     },
     {
      "id": "phi",
      "type": "number",
      "default": 0.32,
      "annotation": {
       "label": "Seasonal phase (peak month as a fraction of the year)",
       "unit": "fraction of year",
       "range": [
        0,
        1
       ],
       "tier": "advanced",
       "lever": false,
       "source": "county fit"
      }
     },
     {
      "id": "m",
      "type": "number",
      "default": 0.9,
      "annotation": {
       "label": "Mosquito-to-human ratio",
       "unit": "mosquitoes per person",
       "range": [
        0.2,
        3
       ],
       "tier": "advanced",
       "lever": false,
       "source": "county fit"
      }
     },
     {
      "id": "b",
      "type": "fraction",
      "default": 0.35,
      "annotation": {
       "label": "Mosquito-to-human transmission probability",
       "unit": "probability per bite",
       "range": [
        0.2,
        0.6
       ],
       "tier": "advanced",
       "lever": false,
       "source": "literature"
      }
     },
     {
      "id": "c",
      "type": "fraction",
      "default": 0.5,
      "annotation": {
       "label": "Human-to-mosquito transmission probability",
       "unit": "probability per bite",
       "range": [
        0.3,
        0.7
       ],
       "tier": "advanced",
       "lever": false,
       "source": "literature"
      }
     },
     {
      "id": "mu_m",
      "type": "rate",
      "default": 0.1,
      "annotation": {
       "label": "Mosquito mortality",
       "unit": "per day",
       "range": [
        0.05,
        0.2
       ],
       "tier": "advanced",
       "lever": false,
       "source": "literature"
      }
     },
     {
      "id": "gamma_m",
      "type": "rate",
      "default": 0.1,
      "annotation": {
       "label": "Mosquito incubation rate",
       "unit": "per day",
       "range": [
        0.07,
        0.14
       ],
       "tier": "advanced",
       "lever": false,
       "source": "literature"
      }
     },
     {
      "id": "zeta_a",
      "type": "number",
      "default": 0.6,
      "annotation": {
       "label": "Relative infectiousness, asymptomatic",
       "unit": "—",
       "range": [
        0.2,
        1
       ],
       "tier": "advanced",
       "lever": false,
       "source": "literature"
      }
     },
     {
      "id": "zeta_t",
      "type": "number",
      "default": 0.3,
      "annotation": {
       "label": "Relative infectiousness, treated",
       "unit": "—",
       "range": [
        0.1,
        0.6
       ],
       "tier": "advanced",
       "lever": false,
       "source": "literature"
      }
     },
     {
      "id": "a",
      "type": "rate",
      "default": 0.33,
      "annotation": {
       "label": "Biting rate",
       "unit": "bites per mosquito per day",
       "range": [
        0.3,
        0.36
       ],
       "tier": "varied",
       "lever": false,
       "source": "range agreed with the modelling team (illustrative)"
      }
     },
     {
      "id": "rho",
      "type": "rate",
      "default": 0.0111,
      "annotation": {
       "label": "Loss of immunity",
       "unit": "per day",
       "range": [
        0.0083,
        0.0167
       ],
       "tier": "varied",
       "lever": false,
       "source": "immunity lasts 60–120 days (illustrative)"
      }
     },
     {
      "id": "gamma_h",
      "type": "rate",
      "default": 0.1,
      "annotation": {
       "label": "Progression from exposure",
       "unit": "per day",
       "range": null,
       "tier": "fixed",
       "lever": false,
       "source": "10-day incubation"
      }
     },
     {
      "id": "p_a",
      "type": "fraction",
      "default": 0.55,
      "annotation": {
       "label": "Share of infections asymptomatic",
       "unit": "proportion",
       "range": null,
       "tier": "fixed",
       "lever": false,
       "source": "literature"
      }
     },
     {
      "id": "p_u",
      "type": "fraction",
      "default": 0.95,
      "annotation": {
       "label": "Share of symptomatic cases uncomplicated",
       "unit": "proportion",
       "range": null,
       "tier": "fixed",
       "lever": false,
       "source": "literature"
      }
     },
     {
      "id": "omega",
      "type": "rate",
      "default": 0.5,
      "annotation": {
       "label": "Onset-to-treatment rate",
       "unit": "per day",
       "range": null,
       "tier": "fixed",
       "lever": false,
       "source": "about 2 days from onset to the clinic"
      }
     },
     {
      "id": "tau",
      "type": "rate",
      "default": 0.33,
      "annotation": {
       "label": "Recovery after treatment",
       "unit": "per day",
       "range": null,
       "tier": "fixed",
       "lever": false,
       "source": "3-day course"
      }
     },
     {
      "id": "r",
      "type": "rate",
      "default": 0.143,
      "annotation": {
       "label": "Natural recovery, uncomplicated",
       "unit": "per day",
       "range": null,
       "tier": "fixed",
       "lever": false,
       "source": ""
      }
     },
     {
      "id": "r_s",
      "type": "rate",
      "default": 0.071,
      "annotation": {
       "label": "Recovery from severe malaria",
       "unit": "per day",
       "range": null,
       "tier": "fixed",
       "lever": false,
       "source": ""
      }
     },
     {
      "id": "delta",
      "type": "rate",
      "default": 0.0167,
      "annotation": {
       "label": "Clearance of asymptomatic infection",
       "unit": "per day",
       "range": null,
       "tier": "fixed",
       "lever": false,
       "source": ""
      }
     },
     {
      "id": "mu_h",
      "type": "rate",
      "default": 0.0000442,
      "annotation": {
       "label": "Birth and death rate",
       "unit": "per day",
       "range": null,
       "tier": "fixed",
       "lever": false,
       "source": "life expectancy 62 years"
      }
     }
    ],
    "parameter_sets": [
     {
      "id": "Homa Bay",
      "values": {
       "m": 1,
       "alpha": 0.5,
       "phi": 0.3,
       "p_t": 0.55
      }
     },
     {
      "id": "Busia",
      "values": {
       "m": 1.1,
       "alpha": 0.45,
       "phi": 0.33,
       "p_t": 0.6
      }
     },
     {
      "id": "Siaya",
      "values": {
       "m": 0.9,
       "alpha": 0.55,
       "phi": 0.31,
       "p_t": 0.58
      }
     },
     {
      "id": "Migori",
      "values": {
       "m": 1,
       "alpha": 0.6,
       "phi": 0.29,
       "p_t": 0.52
      }
     },
     {
      "id": "Kisumu",
      "values": {
       "m": 0.8,
       "alpha": 0.65,
       "phi": 0.34,
       "p_t": 0.62
      }
     },
     {
      "id": "Kakamega",
      "values": {
       "m": 0.75,
       "alpha": 0.6,
       "phi": 0.36,
       "p_t": 0.6
      }
     },
     {
      "id": "Bungoma",
      "values": {
       "m": 0.8,
       "alpha": 0.55,
       "phi": 0.35,
       "p_t": 0.57
      }
     },
     {
      "id": "Vihiga",
      "values": {
       "m": 0.7,
       "alpha": 0.7,
       "phi": 0.37,
       "p_t": 0.63
      }
     }
    ],
    "functions": [
     {
      "id": "seas",
      "expr": "1 + alpha * cos ( 2 * pi * ( year - phi ) )"
     },
     {
      "id": "inf",
      "expr": "( I_sev + zeta_a * I_a + I_un + zeta_t * T ) / N"
     },
     {
      "id": "lambda",
      "expr": "seas * ( a * a * b * c * m * inf / ( a * c * inf + mu_m ) ) * ( gamma_m / ( gamma_m + mu_m ) ) * ( 1 - itn ) * ( 1 - irs )"
     }
    ],
    "flows": [
     {
      "id": "S->E",
      "from": "S",
      "to": "E",
      "rate": "lambda * S",
      "label": "Infection"
     },
     {
      "id": "E->I_a",
      "from": "E",
      "to": "I_a",
      "rate": "p_a * gamma_h * E",
      "label": "Asymptomatic infection"
     },
     {
      "id": "E->I_un",
      "from": "E",
      "to": "I_un",
      "rate": "( 1 - p_a ) * p_u * gamma_h * E",
      "label": "Uncomplicated illness"
     },
     {
      "id": "E->I_sev",
      "from": "E",
      "to": "I_sev",
      "rate": "( 1 - p_a ) * ( 1 - p_u ) * gamma_h * E",
      "label": "Severe illness"
     },
     {
      "id": "I_un->T",
      "from": "I_un",
      "to": "T",
      "rate": "p_t * omega * I_un",
      "label": "Outpatient treatment"
     },
     {
      "id": "I_un->R",
      "from": "I_un",
      "to": "R",
      "rate": "( 1 - p_t ) * r * I_un",
      "label": "Natural recovery"
     },
     {
      "id": "I_sev->R",
      "from": "I_sev",
      "to": "R",
      "rate": "r_s * I_sev",
      "label": "Recovery from severe"
     },
     {
      "id": "T->R",
      "from": "T",
      "to": "R",
      "rate": "tau * T",
      "label": "Recovery after treatment"
     },
     {
      "id": "I_a->R",
      "from": "I_a",
      "to": "R",
      "rate": "delta * I_a",
      "label": "Clearance"
     },
     {
      "id": "R->S",
      "from": "R",
      "to": "S",
      "rate": "rho * R",
      "label": "Loss of immunity"
     },
     {
      "id": "*->S",
      "from": "*",
      "to": "S",
      "rate": "mu_h * N",
      "label": "Births"
     },
     {
      "id": "S->*",
      "from": "S",
      "to": "*",
      "rate": "mu_h * S",
      "label": "Deaths"
     },
     {
      "id": "E->*",
      "from": "E",
      "to": "*",
      "rate": "mu_h * E",
      "label": "Deaths"
     },
     {
      "id": "I_a->*",
      "from": "I_a",
      "to": "*",
      "rate": "mu_h * I_a",
      "label": "Deaths"
     },
     {
      "id": "I_un->*",
      "from": "I_un",
      "to": "*",
      "rate": "mu_h * I_un",
      "label": "Deaths"
     },
     {
      "id": "I_sev->*",
      "from": "I_sev",
      "to": "*",
      "rate": "mu_h * I_sev",
      "label": "Deaths"
     },
     {
      "id": "T->*",
      "from": "T",
      "to": "*",
      "rate": "mu_h * T",
      "label": "Deaths"
     },
     {
      "id": "R->*",
      "from": "R",
      "to": "*",
      "rate": "mu_h * R",
      "label": "Deaths"
     }
    ],
    "observables": [
     {
      "id": "clinical",
      "label": "Clinical cases",
      "kind": "flow",
      "expr": "",
      "flow": "E->I_un + E->I_sev",
      "flows": [
       "E->I_un",
       "E->I_sev"
      ],
      "unit": "per 1,000 people per month"
     },
     {
      "id": "treated",
      "label": "Outpatient-treated cases (the fitted series)",
      "kind": "flow",
      "expr": "",
      "flow": "I_un->T",
      "flows": [
       "I_un->T"
      ],
      "unit": "per 1,000 people per month"
     },
     {
      "id": "severe",
      "label": "Severe cases",
      "kind": "flow",
      "expr": "",
      "flow": "E->I_sev",
      "flows": [
       "E->I_sev"
      ],
      "unit": "per 1,000 people per month"
     },
     {
      "id": "prevalence",
      "label": "Share of people infected",
      "kind": "expr",
      "expr": "E + I_a + I_un + I_sev + T",
      "flow": null,
      "flows": [],
      "unit": "proportion"
     }
    ],
    "assumptions": [
     "Deterministic extended SEIR at county level. One fitted profile per county.",
     "Mosquito population at quasi-equilibrium, entering through the force of infection rather than as compartments.",
     "No superinfection. Closed human population (births equal deaths).",
     "Vector control multiplies the force of infection by (1 − protection). Protection decays between campaign rounds.",
     "Vaccination of under-fives is in the team's model but left out of this transcription."
    ],
    "validation": {
     "valid": true,
     "rules": [
      {
       "id": "unique",
       "ok": true,
       "soft": false
      },
      {
       "id": "defined",
       "ok": true,
       "soft": false
      },
      {
       "id": "ends",
       "ok": true,
       "soft": false
      },
      {
       "id": "absorbing",
       "ok": true,
       "soft": false
      },
      {
       "id": "init",
       "ok": true,
       "soft": false
      },
      {
       "id": "conserve",
       "ok": true,
       "soft": true
      },
      {
       "id": "ranges",
       "ok": true,
       "soft": false
      },
      {
       "id": "fractions",
       "ok": true,
       "soft": false
      },
      {
       "id": "dates",
       "ok": true,
       "soft": false
      },
      {
       "id": "reach",
       "ok": true,
       "soft": true
      },
      {
       "id": "observe",
       "ok": true,
       "soft": false
      },
      {
       "id": "annotated",
       "ok": true,
       "soft": true
      },
      {
       "id": "sets",
       "ok": true,
       "soft": false
      }
     ]
    }
   }
 });
