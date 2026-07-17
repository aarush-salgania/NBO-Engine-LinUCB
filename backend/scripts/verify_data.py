"""
Phase 1 Verification Checkpoint.
Run:  python -m scripts.verify_data        (from backend/)
PASS = every assertion holds and the printed structure looks sane.
"""

import numpy as np
import pandas as pd

from core.data_engine import CREDIT_BANDS, OFFERS, generate_customers

data = generate_customers(5000, seed=42)
X, P = data["X"], data["true_probs"]

print("=" * 62)
print("PHASE 1 CHECK — population of", len(X), "cardmembers")
print("=" * 62)

band = pd.Series(data["band"]).value_counts(normalize=True)
print("\nCredit band mix:\n", band.round(3).to_string())

seg = pd.Series(data["segment"]).value_counts()
print("\nSegments:\n", seg.to_string())

print("\nMean true redemption prob per offer (overall):")
for o in OFFERS:
    print(f"  {o['name']:<24} {P[:, o['id']].mean():.3f}")

print("\nMean of BEST-arm prob (oracle):", round(P.max(axis=1).mean(), 3))
print("Mean of RANDOM-arm prob      :", round(P.mean(), 3))

print("\nOracle best-offer mix by segment (structure the bandit must find):")
best = P.argmax(axis=1)
tbl = pd.crosstab(pd.Series(data["segment"], name="segment"),
                  pd.Series([OFFERS[a]["category"] for a in best],
                            name="best offer"), normalize="index")
print(tbl.round(2).to_string())

# ---- hard assertions -------------------------------------------------
assert X.shape == (5000, 10) and P.shape == (5000, 6)
assert np.allclose(X[:, 5:10].sum(axis=1), 1.0), "prefs must sum to 1"
assert (P > 0).all() and (P < 1).all(), "probs must be in (0,1)"
assert P.max(axis=1).mean() > 1.6 * P.mean(), \
    "oracle must clearly beat random — else nothing to learn"
band_counts = pd.Series(data["band"]).value_counts()
assert set(band_counts.index) == set(CREDIT_BANDS)
print("\nALL PHASE 1 ASSERTIONS PASSED — proceed to Phase 2.")
