
(function (root, entry) {
  if (typeof module === 'object' && module.exports) module.exports = entry;
  else (root.MSE_MODEL_LIBRARY = root.MSE_MODEL_LIBRARY || []).push(entry);
})(typeof self !== 'undefined' ? self : this,
 {
   "id": "sir",
   "reviewed": true,
   "reviewer": "Teaching ladder, step 1",
   "grid": false,
   "runtime_ms": 4,
   "blurb": "Three compartments, two rates. The smallest model the engine can run.",
   "package": {
    "model_id": "46000493",
    "model": {
     "name": "SIR (minimal)",
     "standing": "illustrative",
     "start": 2024,
     "source": "Kermack–McKendrick structure",
     "notes": ""
    },
    "standing": "illustrative",
    "compartments": [
     {
      "id": "S",
      "label": "Susceptible",
      "init": 0.99,
      "group": "human",
      "absorbing": false
     },
     {
      "id": "I",
      "label": "Infectious",
      "init": 0.01,
      "group": "human",
      "absorbing": false
     },
     {
      "id": "R",
      "label": "Recovered",
      "init": 0,
      "group": "human",
      "absorbing": true
     }
    ],
    "parameters": [
     {
      "id": "beta",
      "type": "rate",
      "default": 0.25,
      "annotation": {
       "label": "Transmission rate",
       "unit": "per day",
       "range": [
        0.1,
        0.5
       ],
       "tier": "advanced",
       "lever": false,
       "source": ""
      }
     },
     {
      "id": "gamma",
      "type": "rate",
      "default": 0.1,
      "annotation": {
       "label": "Recovery rate",
       "unit": "per day",
       "range": null,
       "tier": "fixed",
       "lever": false,
       "source": ""
      }
     }
    ],
    "parameter_sets": [],
    "functions": [],
    "flows": [
     {
      "id": "S->I",
      "from": "S",
      "to": "I",
      "rate": "beta * S * I / N",
      "label": "Infection"
     },
     {
      "id": "I->R",
      "from": "I",
      "to": "R",
      "rate": "gamma * I",
      "label": "Recovery"
     }
    ],
    "observables": [
     {
      "id": "cases",
      "label": "New cases",
      "kind": "flow",
      "expr": "",
      "flow": "S->I",
      "flows": [
       "S->I"
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
     "No births or deaths. Immunity is permanent (R is absorbing)."
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
