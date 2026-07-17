"""
Phase 2 Verification Checkpoint — headless simulation, no API, no UI.
Run:  python -m scripts.run_headless --steps 20000     (from backend/)
PASS = LinUCB and Thompson beat BOTH baselines with meaningful uplift.
"""

import argparse
import time

from core.simulator import Simulation

parser = argparse.ArgumentParser()
parser.add_argument("--steps", type=int, default=20000)
parser.add_argument("--seed", type=int, default=42)
args = parser.parse_args()

sim = Simulation(n_customers=5000, seed=args.seed)
t0, chunk = time.time(), 2000

print(f"{'step':>7} | " + " | ".join(f"{k:>12}" for k in sim.policies))
for _ in range(args.steps // chunk):
    sim.step(chunk)
    print(f"{sim.t:>7} | " + " | ".join(
        f"{sim.cum_reward[k][-1]:>12.0f}" for k in sim.policies))

s = sim.summary()
print(f"\nFinished {sim.t} steps in {time.time() - t0:.1f}s\n")
print(f"{'policy':<14}{'cum rate':>10}{'trailing':>10}{'vs random':>11}"
      f"{'vs rules':>10}{'regret':>10}")
for k, m in s["policies"].items():
    print(f"{k:<14}{m['redemption_rate']:>10.4f}{m['trailing_rate']:>10.4f}"
          f"{m['uplift_vs_random_pct']:>10.1f}%"
          f"{m['uplift_vs_rules_pct']:>9.1f}%"
          f"{m['cumulative_regret']:>10.0f}")
rules_tr = s["policies"]["greedy_rules"]["trailing_rate"]
lin_tr = s["policies"]["linucb"]["trailing_rate"]
print(f"\nConverged uplift (trailing 5k): LinUCB "
      f"{100*(lin_tr/rules_tr-1):.1f}% over rules baseline")

lin, th = s["policies"]["linucb"], s["policies"]["thompson"]
assert lin["uplift_vs_random_pct"] > 30, "LinUCB must beat random by >30%"
assert lin["uplift_vs_rules_pct"] > 5,  "LinUCB must beat rules by >5%"
assert th["uplift_vs_random_pct"] > 30, "Thompson must beat random by >30%"
print("\nALL PHASE 2 ASSERTIONS PASSED — the math is sound. "
      "Proceed to Phase 3 (API).")
