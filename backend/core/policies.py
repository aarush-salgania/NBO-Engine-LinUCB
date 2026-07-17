"""
phase 2 - core decision policies.

all the policies share this one tiny interface so that the simulator, the api layer, and a future pytorch dqn are totally interchangeable:

arm = policy.select(x)       : x: (D,) context vector
policy.update(x, arm, reward): reward in {0, 1}
policy.scores(x)             : per-arm diagnostics for the inspector

kept it pure numpy for no zero fastapi imports at this stage.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

import numpy as np

from .data_engine import D, N_ARMS


class Policy(ABC):
    name: str = "base"

    @abstractmethod
    def select(self, x: np.ndarray) -> int: ...

    def update(self, x: np.ndarray, arm: int, reward: float) -> None:
        pass                                    # baselines don't learn

    def scores(self, x: np.ndarray) -> list[dict]:
        return [{"arm": a, "expected": None, "bonus": None, "score": None}
                for a in range(N_ARMS)]


# ----------------------------------------------------------------------
class RandomPolicy(Policy):
    name = "random"

    def __init__(self, seed: int = 0):
        self.rng = np.random.default_rng(seed)

    def select(self, x):
        return int(self.rng.integers(N_ARMS))


# ----------------------------------------------------------------------
class GreedyRulesPolicy(Policy):
    """
    for a solid 'marketing rules' baseline we can just map the users top spend category straight to 
    the matching offer. its deterministic with no learning involved - completely blind to stuff like 
    the credit band, tenure, and velocity interactions. thats exactly the gap the bandit exploits to 
    get better results anyway.

    context layout: prefs live at x = [dine, trav, groc, fuel, onln]
    """
    name = "greedy_rules"
    _PREF_TO_ARM = {0: 0, 1: 1, 2: 2, 3: 3, 4: 4}   # never picks streaming

    def select(self, x):
        return self._PREF_TO_ARM[int(np.argmax(x[5:10]))]


# ----------------------------------------------------------------------
class LinUCBPolicy(Policy):
    r"""
    Disjoint LinUCB Per arm a:
        A_a = I + sum x x^T
        b_a = sum r * x
        theta_a = A_a^-1 b_a
        score_a = theta_a . x  +  alpha * sqrt(x^T A_a^-1 x)
        exploit v explore
    A^-1 is maintained incrementally via shermanmorrison: O(d^2)/update.
    """
    name = "linucb"

    def __init__(self, alpha: float = 0.9, seed: int = 0):
        self.alpha = alpha
        self.rng = np.random.default_rng(seed)
        self.A_inv = np.stack([np.eye(D) for _ in range(N_ARMS)])
        self.b = np.zeros((N_ARMS, D))

    def _ucb(self, x):
        theta = np.einsum("adk,ak->ad", self.A_inv, self.b)   # (A, D)
        expected = theta @ x                                  # (A,)
        bonus = self.alpha * np.sqrt(
            np.einsum("d,adk,k->a", x, self.A_inv, x))
        return expected, bonus

    def select(self, x):
        expected, bonus = self._ucb(x)
        p = expected + bonus
        return int(self.rng.choice(np.flatnonzero(p >= p.max() - 1e-12)))

    def update(self, x, arm, reward):
        Ai = self.A_inv[arm]
        Ax = Ai @ x
        self.A_inv[arm] = Ai - np.outer(Ax, Ax) / (1.0 + x @ Ax)
        self.b[arm] += reward * x

    def scores(self, x):
        expected, bonus = self._ucb(x)
        return [{"arm": a,
                 "expected": round(float(expected[a]), 4),
                 "bonus": round(float(bonus[a]), 4),
                 "score": round(float(expected[a] + bonus[a]), 4)}
                for a in range(N_ARMS)]


# ----------------------------------------------------------------------
class ThompsonSamplingPolicy(Policy):
    """
    Thompson sampling:
    per arm keep a linear model,
    N(mu_a, v^2 * A_a^-1) to sample a theta and act greedily
    on the sample. 
    Exploration emerges from "posterior uncertainty" wotdoehell
    """
    name = "thompson"

    def __init__(self, v: float = 0.4, seed: int = 0):
        self.v = v
        self.rng = np.random.default_rng(seed)
        self.A_inv = np.stack([np.eye(D) for _ in range(N_ARMS)])
        self.b = np.zeros((N_ARMS, D))

    def select(self, x):
        vals = np.empty(N_ARMS)
        for a in range(N_ARMS):
            mu = self.A_inv[a] @ self.b[a]
            L = np.linalg.cholesky(
                self.v ** 2 * self.A_inv[a] + 1e-9 * np.eye(D))
            theta = mu + L @ self.rng.standard_normal(D)
            vals[a] = theta @ x
        return int(np.argmax(vals))

    def update(self, x, arm, reward):
        Ai = self.A_inv[arm]
        Ax = Ai @ x
        self.A_inv[arm] = Ai - np.outer(Ax, Ax) / (1.0 + x @ Ax)
        self.b[arm] += reward * x

    def scores(self, x):
        out = []
        for a in range(N_ARMS):
            mu = self.A_inv[a] @ self.b[a]
            sd = self.v * float(np.sqrt(x @ self.A_inv[a] @ x))
            out.append({"arm": a,
                        "expected": round(float(mu @ x), 4),
                        "bonus": round(sd, 4),
                        "score": round(float(mu @ x), 4)})
        return out


# ----------------------------------------------------------------------
class DQNPolicy(Policy):
    """
    Maybe could try DQN based policy later kinda
    to show bandit superiority (hypothesis)?
    """
    name = "dqn"

    def __init__(self, *_, **__):
        raise NotImplementedError(
            "implement with PyTorch, then add to make_policies()"
            "heeheehaa")


# ----------------------------------------------------------------------
def make_policies(seed: int = 7) -> dict[str, Policy]:
    """single reg used by both the CLI simulator and the API."""
    return {
        "random":       RandomPolicy(seed=seed),
        "greedy_rules": GreedyRulesPolicy(),
        "linucb":       LinUCBPolicy(alpha=0.9, seed=seed + 1),
        "thompson":     ThompsonSamplingPolicy(v=0.4, seed=seed + 2),
    }
