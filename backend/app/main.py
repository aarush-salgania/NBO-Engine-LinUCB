#api layer only talks to the web, the math is present in the core

from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from core.data_engine import N_ARMS, OFFERS, customer_profile
from core.simulator import Simulation

app = FastAPI(title="NBO Personalization Engine", version="0.1.0")
app.add_middleware(                      #vite dev server -> API
    CORSMiddleware, allow_origins=["*"],
    allow_methods=["*"], allow_headers=["*"],
)

SIM = Simulation(n_customers=5000, seed=42)     #single global simulation


class ResetRequest(BaseModel):
    n_customers: int = Field(5000, ge=100, le=50000)
    seed: int = 42


class StepRequest(BaseModel):
    n_steps: int = Field(200, ge=1, le=5000)


@app.get("/health")
def health():
    return {"status": "ok", "t": SIM.t, "offers": OFFERS}


@app.post("/simulate/reset")
def reset(req: ResetRequest):
    global SIM
    SIM = Simulation(n_customers=req.n_customers, seed=req.seed)
    return {"status": "reset", "n_customers": req.n_customers, "t": 0}


@app.post("/simulate/step")
def step(req: StepRequest):
    SIM.step(req.n_steps)
    return SIM.summary()


@app.get("/metrics")
def metrics(max_points: int = 300):
    return {"summary": SIM.summary(), "history": SIM.history(max_points)}


@app.get("/segments/distribution")
def segment_distribution(policy: str = "linucb"):
    if policy not in SIM.policies:
        raise HTTPException(404, f"unknown policy '{policy}'")
    return {
        "policy": policy,
        "offers": [o["name"] for o in OFFERS],
        "segments": [
            {"segment": s, "counts": SIM.seg_arm_counts[policy][s]}
            for s in SIM.segments
        ],
    }


@app.get("/customers")
def customers(limit: int = 50):
    return [customer_profile(SIM.data, i)
            for i in range(min(limit, SIM.n_customers))]


@app.get("/customer/{cid}/decision")
def decision(cid: int):
    if not 0 <= cid < SIM.n_customers:
        raise HTTPException(404, "customer not found")
    x = SIM.data["X"][cid]
    per_policy = {}
    for name, pol in SIM.policies.items():
        chosen = pol.select(x)                  # inspect-only; no update()
        per_policy[name] = {
            "chosen_arm": chosen,
            "chosen_offer": OFFERS[chosen]["name"],
            "arm_scores": pol.scores(x),
        }
    return {
        "profile": customer_profile(SIM.data, cid),
        "decisions": per_policy,
        # ground truth exposed for demo transparency — flag it as such in UI
        "true_reward_probs": [round(float(p), 4)
                              for p in SIM.data["true_probs"][cid]],
        "oracle_arm": int(SIM.data["true_probs"][cid].argmax()),
    }
