
(function (root, entry) {
  if (typeof module === 'object' && module.exports) module.exports = entry;
  else (root.MSE_MODEL_LIBRARY = root.MSE_MODEL_LIBRARY || []).push(entry);
})(typeof self !== 'undefined' ? self : this,
 {
   "id": "seirs-treatment",
   "reviewed": true,
   "reviewer": "Teaching ladder, step 2",
   "grid": false,
   "runtime_ms": 8,
   "blurb": "Latent period, temporary immunity and one treatment lever. No vector, no seasonality.",
   "package": {
    "model_id": "d976701b",
    "model": {
     "name": "SEIRS with treatment (teaching model)",
     "standing": "illustrative",
     "start": 2024,
     "source": "textbook structure. Illustrative values",
     "notes": ""
    },
    "standing": "illustrative",
    "compartments": [
     {
      "id": "S",
      "label": "Susceptible",
      "init": 0.8,
      "group": "human",
      "absorbing": false
     },
     {
      "id": "E",
      "label": "Exposed",
      "init": 0.02,
      "group": "human",
      "absorbing": false
     },
     {
      "id": "I",
      "label": "Infectious",
      "init": 0.08,
      "group": "human",
      "absorbing": false
     },
     {
      "id": "R",
      "label": "Recovered",
      "init": 0.1,
      "group": "human",
      "absorbing": false
     }
    ],
    "parameters": [
     {
      "id": "beta",
      "type": "rate",
      "default": 0.3,
      "annotation": {
       "label": "Transmission rate",
       "unit": "per day",
       "range": [
        0.1,
        0.6
       ],
       "tier": "advanced",
       "lever": false,
       "source": "illustrative"
      }
     },
     {
      "id": "sigma",
      "type": "rate",
      "default": 0.1,
      "annotation": {
       "label": "Progression from exposure",
       "unit": "per day",
       "range": null,
       "tier": "fixed",
       "lever": false,
       "source": "10-day latent period"
      }
     },
     {
      "id": "gamma",
      "type": "rate",
      "default": 0.07,
      "annotation": {
       "label": "Recovery rate",
       "unit": "per day",
       "range": [
        0.05,
        0.1
       ],
       "tier": "varied",
       "lever": false,
       "source": "illustrative"
      }
     },
     {
      "id": "rho",
      "type": "rate",
      "default": 0.005,
      "annotation": {
       "label": "Loss of immunity",
       "unit": "per day",
       "range": [
        0.003,
        0.01
       ],
       "tier": "varied",
       "lever": false,
       "source": "illustrative"
      }
     },
     {
      "id": "p_t",
      "type": "fraction",
      "default": 0.4,
      "annotation": {
       "label": "Treatment coverage",
       "unit": "share of cases treated",
       "range": [
        0,
        0.9
       ],
       "tier": "user",
       "lever": true,
       "source": "illustrative"
      }
     },
     {
      "id": "tau",
      "type": "rate",
      "default": 0.2,
      "annotation": {
       "label": "Recovery when treated",
       "unit": "per day",
       "range": null,
       "tier": "fixed",
       "lever": false,
       "source": ""
      }
     }
    ],
    "parameter_sets": [],
    "functions": [
     {
      "id": "lambda",
      "expr": "beta * I / N"
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
      "id": "E->I",
      "from": "E",
      "to": "I",
      "rate": "sigma * E",
      "label": "Onset"
     },
     {
      "id": "I->R",
      "from": "I",
      "to": "R",
      "rate": "( 1 - p_t ) * gamma * I",
      "label": "Natural recovery"
     },
     {
      "id": "I->R",
      "from": "I",
      "to": "R",
      "rate": "p_t * tau * I",
      "label": "Recovery after treatment"
     },
     {
      "id": "R->S",
      "from": "R",
      "to": "S",
      "rate": "rho * R",
      "label": "Loss of immunity"
     }
    ],
    "observables": [
     {
      "id": "cases",
      "label": "New cases",
      "kind": "flow",
      "expr": "",
      "flow": "E->I",
      "flows": [
       "E->I"
      ],
      "unit": "per 1,000 people per month"
     },
     {
      "id": "prevalence",
      "label": "Share infectious",
      "kind": "expr",
      "expr": "I",
      "flow": null,
      "flows": [],
      "unit": "proportion"
     }
    ],
    "assumptions": [
     "Direct transmission. No vector, no seasonality, no demography."
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
