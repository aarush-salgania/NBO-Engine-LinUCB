"""
Phase 1 — Synthetic Data Engine & Simulated Environment.

Generates a population of synthetic cardmembers and defines the HIDDEN
"true preference" function that maps (customer context, offer) -> reward
probability. The bandit never sees this function; it only observes
Bernoulli rewards. Pure NumPy — zero FastAPI imports (testable via CLI).
"""

from __future__ import annotations

import numpy as np

# ----------------------------------------------------------------------
# Offer catalog (the bandit's arms)
# ----------------------------------------------------------------------
OFFERS = [
    {"id": 0, "name": "5% Dining Cashback",     "category": "dining"},
    {"id": 1, "name": "3x Travel Points",        "category": "travel"},
    {"id": 2, "name": "4% Grocery Rebate",       "category": "grocery"},
    {"id": 3, "name": "10\u00a2/gal Fuel Rewards", "category": "fuel"},
    {"id": 4, "name": "6% Online Shopping",      "category": "online"},
    {"id": 5, "name": "$5 Streaming Credit",     "category": "streaming"},
]
N_ARMS = len(OFFERS)

CREDIT_BANDS = ["standard", "gold", "platinum"]

# Context vector layout (D = 10)
FEATURE_NAMES = [
    "band_standard", "band_gold", "band_platinum",   # one-hot credit band
    "tenure",                                        # years / 25, in [0, 1]
    "velocity",                                      # txns/mo normalized [0, 1]
    "pref_dining", "pref_travel", "pref_grocery",    # Dirichlet category
    "pref_fuel", "pref_online",                      # preferences (sum to 1)
]
D = len(FEATURE_NAMES)


def _sigmoid(z: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-z))


# ----------------------------------------------------------------------
# HIDDEN ground truth: theta matrix (N_ARMS x D) + per-arm bias.
# Encodes realistic interactions the Greedy Rules baseline can't see:
#   * travel offer needs travel pref AND premium band AND tenure
#   * streaming skews to NEW cardmembers (negative tenure weight)
#   * dining/online respond to transaction velocity
# ----------------------------------------------------------------------
def true_theta() -> tuple[np.ndarray, np.ndarray]:
    T = np.zeros((N_ARMS, D))
    #        std   gold  plat  tenur veloc dine  trav  groc  fuel  onln
    T[0] = [ 0.0,  0.2,  0.4,  0.2,  2.2,  2.2,  0.0,  0.0,  0.0,  0.3]
    T[1] = [-1.2,  0.3,  2.2,  0.8,  0.3,  0.2,  2.6,  0.0,  0.0,  0.0]
    T[2] = [ 0.6,  0.2, -0.3,  0.3,  0.5,  0.0,  0.0,  2.8,  0.4,  0.0]
    T[3] = [ 0.5,  0.1, -0.4,  0.2,  0.4,  0.0,  0.0,  0.5,  2.6,  0.0]
    T[4] = [ 0.1,  0.2,  0.3, -0.2,  1.8,  0.0,  0.2,  0.0,  0.0,  2.4]
    T[5] = [ 0.4,  0.2,  0.2, -3.0,  0.6,  0.0,  0.0,  0.0,  0.0,  1.8]
    bias = np.array([-2.4, -2.5, -2.1, -2.1, -2.5, -1.3])
    return T, bias


def true_reward_probs(X: np.ndarray) -> np.ndarray:
    """(n, D) contexts -> (n, N_ARMS) redemption probabilities."""
    T, bias = true_theta()
    return _sigmoid(X @ T.T + bias)


# ----------------------------------------------------------------------
# Population generator
# ----------------------------------------------------------------------
def generate_customers(n: int = 5000, seed: int = 42) -> dict:
    rng = np.random.default_rng(seed)

    band_idx = rng.choice(3, size=n, p=[0.50, 0.35, 0.15])
    band_onehot = np.eye(3)[band_idx]

    tenure_years = np.clip(rng.gamma(shape=2.0, scale=3.0, size=n), 0.1, 25.0)
    tenure = tenure_years / 25.0

    velocity_raw = rng.lognormal(mean=3.0, sigma=0.5, size=n)   # txns/month
    velocity = np.clip(velocity_raw / 80.0, 0.0, 1.0)

    # Band-conditioned Dirichlet: platinum skews travel/dining,
    # standard skews grocery/fuel — creates learnable segment structure.
    alphas = np.array([
        [1.5, 0.6, 2.5, 2.0, 1.4],   # standard: dine trav groc fuel onln
        [2.0, 1.5, 1.8, 1.2, 1.8],   # gold
        [2.5, 3.0, 1.0, 0.6, 1.9],   # platinum
    ])
    prefs = np.vstack([rng.dirichlet(alphas[b]) for b in band_idx])

    X = np.hstack([band_onehot, tenure[:, None], velocity[:, None], prefs])
    P = true_reward_probs(X)                      # hidden from the bandit
    segments = np.array([
        _segment(band_idx[i], tenure_years[i], velocity[i], prefs[i])
        for i in range(n)
    ])

    return {
        "X": X,                          # (n, D) context matrix
        "true_probs": P,                 # (n, N_ARMS) — environment only
        "band": np.array(CREDIT_BANDS)[band_idx],
        "tenure_years": tenure_years,
        "velocity_txn_mo": velocity_raw,
        "prefs": prefs,
        "segment": segments,
    }


def _segment(band_idx: int, tenure_years: float,
             velocity: float, prefs: np.ndarray) -> str:
    top = int(np.argmax(prefs))          # 0 dine 1 trav 2 groc 3 fuel 4 onln
    if tenure_years < 2.0:
        return "New Cardmember"
    if band_idx == 2 and top == 1:
        return "Premium Traveler"
    if top == 0 and velocity > 0.35:
        return "Urban Spender"
    if top in (2, 3):
        return "Everyday Essentials"
    if top == 4:
        return "Digital Native"
    return "Balanced"


def customer_profile(data: dict, i: int) -> dict:
    """JSON-safe profile for the Customer Inspector panel."""
    return {
        "customer_id": int(i),
        "credit_band": str(data["band"][i]),
        "tenure_years": round(float(data["tenure_years"][i]), 1),
        "txns_per_month": round(float(data["velocity_txn_mo"][i]), 1),
        "segment": str(data["segment"][i]),
        "category_prefs": {
            c: round(float(p), 3)
            for c, p in zip(["dining", "travel", "grocery", "fuel", "online"],
                            data["prefs"][i])
        },
    }
