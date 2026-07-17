# simulation object owns population, policy registry and all metric registry
#the fast api only holds one instance of this and only handles serialization
# Fairness design: Every policy faces the identical customer sequence each step; rewards are drawn from the hidden true probability of the chosen arm. 
# Regret is measured against the per-customer oracle

from __future__ import annotations

import numpy as np

from .data_engine import N_ARMS, generate_customers
from .policies import make_policies


class Simulation:
    def __init__(self, n_customers: int = 5000, seed: int = 42):
        self.n_customers = n_customers
        self.seed = seed
        self.data = generate_customers(n_customers, seed)
        self.oracle = self.data["true_probs"].max(axis=1)     # per customer
        self.policies = make_policies(seed=seed)
        self.rng = np.random.default_rng(seed + 999)          # env RNG
        self.t = 0
        # per-policy histories (cumulative, appended every step)
        self.cum_reward = {k: [0.0] for k in self.policies}
        self.cum_regret = {k: [0.0] for k in self.policies}
        # segment -> arm counts for the LEARNING policy views
        self.segments = sorted(set(self.data["segment"]))
        self.seg_arm_counts = {
            k: {s: [0] * N_ARMS for s in self.segments} for k in self.policies
        }

    # ------------------------------------------------------------------
    def step(self, n_steps: int = 1) -> None:
        X, P = self.data["X"], self.data["true_probs"]
        for _ in range(n_steps):
            i = int(self.rng.integers(self.n_customers))      # shared draw
            x, seg = X[i], self.data["segment"][i]
            for name, pol in self.policies.items():
                arm = pol.select(x)
                reward = float(self.rng.random() < P[i, arm])
                pol.update(x, arm, reward)
                self.cum_reward[name].append(
                    self.cum_reward[name][-1] + reward)
                self.cum_regret[name].append(
                    self.cum_regret[name][-1] + (self.oracle[i] - P[i, arm]))
                self.seg_arm_counts[name][seg][arm] += 1
            self.t += 1

    # ------------------------------------------------------------------
    def summary(self, trailing: int = 5000) -> dict:
        """Trailing-window rate = policy value AFTER learning (the honest
        deployment metric); cumulative rate includes exploration cost."""
        out = {"t": self.t, "policies": {}}
        w = min(trailing, self.t) or 1
        for k in self.policies:
            r = self.cum_reward[k][-1]
            out["policies"][k] = {
                "cumulative_reward": round(r, 1),
                "redemption_rate": round(r / max(self.t, 1), 4),
                "trailing_rate": round(
                    (r - self.cum_reward[k][-1 - w]) / w, 4),
                "cumulative_regret": round(self.cum_regret[k][-1], 1),
            }
        base = out["policies"]["random"]["redemption_rate"] or 1e-9
        rules = out["policies"]["greedy_rules"]["redemption_rate"] or 1e-9
        for k in self.policies:
            rate = out["policies"][k]["redemption_rate"]
            out["policies"][k]["uplift_vs_random_pct"] = round(
                100 * (rate / base - 1), 1)
            out["policies"][k]["uplift_vs_rules_pct"] = round(
                100 * (rate / rules - 1), 1)
        return out

    # ------------------------------------------------------------------
    def history(self, max_points: int = 300) -> dict:
        """Downsampled cumulative curves, ready for Recharts."""
        n = self.t + 1
        idx = np.unique(np.linspace(0, n - 1, min(max_points, n)).astype(int))
        series = []
        for j in idx:
            row = {"t": int(j)}
            for k in self.policies:
                row[f"reward_{k}"] = round(self.cum_reward[k][j], 1)
                row[f"regret_{k}"] = round(self.cum_regret[k][j], 1)
            series.append(row)
        return {"t": self.t, "series": series}
