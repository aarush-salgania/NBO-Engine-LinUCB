# NBO Personalization Engine

A Next-Best-Offer simulation and decision service that compares contextual-bandit offer selection against rule-based and random baselines on a population of 5,000 synthetic cardmembers. On each step a customer context is drawn, every policy selects one of six offers, and a synthetic environment returns a redemption (0/1) reward sampled from hidden per-customer probabilities. A FastAPI service exposes the running simulation — cumulative and trailing redemption rates, regret against the oracle, per-segment offer allocation, and per-customer decision breakdowns — and a React/Vite dashboard renders those metrics. The core simulation is pure NumPy with no web dependency, so the same code runs headless for reproducible evaluation.

## Architecture

```
  frontend/  (React + Vite + Tailwind + Recharts)
  useSimulation() hook  ->  StatCards | RewardChart | SegmentDistribution | CustomerInspector
        |
        |  HTTP / JSON on :8000
        |     GET  /metrics, /segments/distribution, /customer/{id}/decision
        |     POST /simulate/step, /simulate/reset
        v
  +-------------------------------------------------------------------+
  |  backend/app/   FastAPI  (main.py)                                |
  |  routing + serialization ONLY -- no math                          |
  +---------------------------------+---------------------------------+
                                    |  imports core/   (one direction)
                                    v
  +-------------------------------------------------------------------+
  |  backend/core/   pure NumPy, zero FastAPI imports                 |
  |    data_engine.py   synthetic customers, offers, true probs       |
  |    policies.py      Policy interface: Random, GreedyRules,        |
  |                     LinUCB, Thompson   (+ DQN hook)               |
  |    simulator.py     Simulation: step / summary / history          |
  +-------------------------------------------------------------------+

  backend/scripts/run_headless.py  ->  imports core/ directly (no API, no UI)
```

`core/` is isolated from `app/`: the dependency runs one way only. `app/` imports
`core/`, `core/` imports nothing from `app/`, and the headless script drives
`core/` with no web layer at all — so the decision logic is testable and runnable
without FastAPI.

## Results

Headless run, 20,000 steps, seed 42:

| Policy | Cum. rate | Trailing rate | vs Random | Regret (20k steps) |
|---|---|---|---|---|
| Random | 0.2504 | 0.2534 | — | 4,172 |
| Greedy Rules | 0.4134 | 0.4160 | +65% | 936 |
| LinUCB | 0.4511 | 0.4684 | +80% | 215 |
| Thompson | 0.4426 | 0.4558 | +77% | 350 |

Converged uplift (trailing 5k window): LinUCB +12.6% over the rules baseline, 4.4x lower regret. Reproduce with: python -m scripts.run_headless --steps 20000 (seed 42).

## Quickstart

### Backend (FastAPI + core simulation)

```bash
cd nbo-engine/backend
python -m venv .venv                 # a .venv may already be present
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Headless evaluation (no API, no UI):

```bash
cd nbo-engine/backend
python -m scripts.run_headless --steps 20000    # seed 42
```

### Frontend (React + Vite)

```bash
cd nbo-engine/frontend
npm install
npm run dev                          # http://localhost:5173
```

The frontend reads two environment variables (see `src/api/client.js`):

- `VITE_MOCK=1` — serve canned payloads that match the API contracts, so the UI
  runs without a backend. `VITE_MOCK=0` (or unset) calls the live API.
- `VITE_API_URL` — API base URL; defaults to `http://localhost:8000`.

## Design decisions

- **Policy interface.** Every policy implements the same three-method contract —
  `select(x)`, `update(x, arm, reward)`, `scores(x)` — defined as an ABC in
  `core/policies.py`. The simulator, the API, and any future learner are
  interchangeable; non-learning baselines simply no-op `update()`.
- **Singleton simulation.** The API holds one in-process `Simulation` instance
  (`SIM` in `app/main.py`), seeded at startup; `POST /simulate/reset` replaces it.
  State is in-memory per server process (no database), so `/metrics`, `/step`, and
  the inspector all read the same object.
- **Frozen JSON contracts.** Endpoint response shapes are fixed and treated as a
  contract. `core/` computes, `app/` only serializes, and the frontend renders the
  fields as-is without adding or renaming any. Endpoints: `/metrics`,
  `/segments/distribution`, `/simulate/step`, `/simulate/reset`,
  `/customer/{id}/decision`, plus `/health` and `/customers`.
- **Mock mode.** `src/api/client.js` has a `VITE_MOCK=1` path that returns canned
  payloads shaped exactly like those contracts (after a short delay), so the UI can
  be built and demonstrated with no backend running.
- **DQN hook.** `core/policies.py` includes a `DQNPolicy` stub documenting a
  drop-in PyTorch Deep Q-Network behind the identical `select/update/scores`
  interface. Each interaction is a length-1 episode (contextual bandit), so the
  discount is 0 and the TD target is the reward itself; adding it means
  implementing the class and registering it in `make_policies()`.

## What changes with real data

The simulation makes four simplifying assumptions that do not hold in production.

- **Exploration cost on live customers.** In simulation, exploration is free — a
  suboptimal offer only accrues simulated regret. On live cardmembers, every
  exploratory offer is shown to a real person and can reduce redemption, margin, or
  satisfaction. Deployment needs bounded exploration (for example, capping the
  share of traffic a bandit may explore, restricting the per-customer offer set, or
  warm-starting from logged data) plus monitoring to pause exploration when needed.
- **Delayed / attributed rewards.** The simulator returns an immediate binary
  redemption on the same step as the decision. Real redemption arrives after a lag
  (days to a billing cycle), may be partial, and must be attributed to the offer
  that caused it rather than to concurrent campaigns or organic behavior. This
  requires an attribution window, handling of censored or still-pending outcomes,
  and learners that update on delayed feedback instead of assuming reward at `t`.
- **Fairness constraints on offer allocation.** The demo lets each policy allocate
  offers purely to maximize redemption, and the segment chart shows the resulting
  skew. In production, allocation is subject to regulatory constraints (equal
  treatment across protected classes), budget constraints (finite offer inventory
  and cost caps), and business rules (eligibility, frequency capping). These become
  explicit constraints on the selection step, with allocation audited across
  segments rather than left unconstrained.
- **Off-policy evaluation replacing oracle regret.** Regret here is measured
  against a known oracle — the argmax of the hidden true probabilities — which does
  not exist with real data. Evaluation must instead be off-policy: estimate a
  candidate policy's value from logged decisions using inverse-propensity or
  doubly-robust estimators, which require logging the acting policy's action
  probabilities at decision time. Randomized holdout or interleaving experiments
  become the ground truth in place of oracle regret.
```
