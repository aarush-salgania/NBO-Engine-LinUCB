// API client for the NBO engine backend.
//
// All app state lives in useSimulation.js; this module only knows how to talk
// to the backend (or serve canned data when VITE_MOCK=1). Response shapes here
// mirror the backend contracts exactly — do not add or rename fields.

export const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
export const MOCK = import.meta.env.VITE_MOCK === "1";

// ---------------------------------------------------------------------------
// low-level helpers
// ---------------------------------------------------------------------------

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getJSON(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status} ${res.statusText}`);
  return res.json();
}

async function postJSON(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} -> ${res.status} ${res.statusText}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// mock data (used only when MOCK === true)
// ---------------------------------------------------------------------------

const MOCK_SUMMARY = {
  t: 6000,
  policies: {
    random: { cumulative_reward: 1492.0, redemption_rate: 0.2487, trailing_rate: 0.2534, cumulative_regret: 1262.9, uplift_vs_random_pct: 0.0, uplift_vs_rules_pct: -40.0 },
    greedy_rules: { cumulative_reward: 2488.0, redemption_rate: 0.4147, trailing_rate: 0.4160, cumulative_regret: 276.8, uplift_vs_random_pct: 66.8, uplift_vs_rules_pct: 0.0 },
    linucb: { cumulative_reward: 2605.0, redemption_rate: 0.4342, trailing_rate: 0.4684, cumulative_regret: 157.6, uplift_vs_random_pct: 74.6, uplift_vs_rules_pct: 4.7 },
    thompson: { cumulative_reward: 2536.0, redemption_rate: 0.4227, trailing_rate: 0.4558, cumulative_regret: 231.5, uplift_vs_random_pct: 70.0, uplift_vs_rules_pct: 1.9 },
  },
};

// Real history only ships t=0 and t=6000. For a legible mock chart we
// interpolate ~12 points. Everything scales linearly with t EXCEPT the bandit
// reward series (linucb, thompson): they get a mild upward curvature so that
// after the midpoint (t=3000) they grow faster than the linear greedy_rules
// series, while still landing exactly on the summary finals. The curvature is
// tuned so linucb trails greedy_rules early (t <= 1500) and has clearly
// overtaken it well before t=5000 — the intended demo crossover story.
function mockHistorySeries() {
  const FINAL = {
    reward_random: 1492.0, regret_random: 1262.9,
    reward_greedy_rules: 2488.0, regret_greedy_rules: 276.8,
    reward_linucb: 2605.0, regret_linucb: 157.6,
    reward_thompson: 2536.0, regret_thompson: 231.5,
  };
  const T = 6000;
  const POINTS = 13; // t = 0, 500, 1000, ... 6000
  const round1 = (x) => Math.round(x * 10) / 10;

  // g(0)=0, g(1)=1; mild convexity so the bandit lags early and overtakes
  // greedy_rules before t=5000. W too large delays the crossover past t=5000.
  const W = 0.15;
  const bandit = (f) => (1 - W) * f + W * f * f;

  const series = [];
  for (let i = 0; i < POINTS; i++) {
    const f = i / (POINTS - 1);
    series.push({
      t: Math.round(T * f),
      reward_random: round1(FINAL.reward_random * f),
      regret_random: round1(FINAL.regret_random * f),
      reward_greedy_rules: round1(FINAL.reward_greedy_rules * f),
      regret_greedy_rules: round1(FINAL.regret_greedy_rules * f),
      reward_linucb: round1(FINAL.reward_linucb * bandit(f)),
      regret_linucb: round1(FINAL.regret_linucb * f),
      reward_thompson: round1(FINAL.reward_thompson * bandit(f)),
      regret_thompson: round1(FINAL.regret_thompson * f),
    });
  }
  return series;
}

const MOCK_SEGMENTS = {
  policy: "linucb",
  offers: ["5% Dining Cashback", "3x Travel Points", "4% Grocery Rebate", "10¢/gal Fuel Rewards", "6% Online Shopping", "$5 Streaming Credit"],
  segments: [
    { segment: "Balanced", counts: [180, 344, 392, 128, 52, 56] },
    { segment: "Digital Native", counts: [38, 155, 108, 113, 143, 332] },
    { segment: "Everyday Essentials", counts: [119, 68, 1563, 546, 96, 143] },
    { segment: "New Cardmember", counts: [138, 120, 225, 39, 41, 241] },
    { segment: "Premium Traveler", counts: [2, 317, 0, 0, 7, 0] },
    { segment: "Urban Spender", counts: [131, 47, 90, 6, 14, 6] },
  ],
};

const MOCK_DECISION = {
  profile: {
    customer_id: 17,
    credit_band: "standard",
    tenure_years: 1.9,
    txns_per_month: 14.7,
    segment: "New Cardmember",
    category_prefs: { dining: 0.051, travel: 0.002, grocery: 0.67, fuel: 0.201, online: 0.076 },
  },
  decisions: {
    random: { chosen_arm: 1, chosen_offer: "3x Travel Points", arm_scores: [{ arm: 0, expected: null, bonus: null, score: null }, { arm: 1, expected: null, bonus: null, score: null }, { arm: 2, expected: null, bonus: null, score: null }, { arm: 3, expected: null, bonus: null, score: null }, { arm: 4, expected: null, bonus: null, score: null }, { arm: 5, expected: null, bonus: null, score: null }] },
    greedy_rules: { chosen_arm: 2, chosen_offer: "4% Grocery Rebate", arm_scores: [{ arm: 0, expected: null, bonus: null, score: null }, { arm: 1, expected: null, bonus: null, score: null }, { arm: 2, expected: null, bonus: null, score: null }, { arm: 3, expected: null, bonus: null, score: null }, { arm: 4, expected: null, bonus: null, score: null }, { arm: 5, expected: null, bonus: null, score: null }] },
    linucb: { chosen_arm: 2, chosen_offer: "4% Grocery Rebate", arm_scores: [{ arm: 0, expected: 0.2884, bonus: 0.01, score: 0.2984 }, { arm: 1, expected: 0.2422, bonus: 0.01, score: 0.2522 }, { arm: 2, expected: 0.6646, bonus: 0.01, score: 0.6746 }, { arm: 3, expected: 0.3476, bonus: 0.01, score: 0.3576 }, { arm: 4, expected: 0.312, bonus: 0.01, score: 0.322 }, { arm: 5, expected: 0.4458, bonus: 0.01, score: 0.4558 }] },
    thompson: { chosen_arm: 2, chosen_offer: "4% Grocery Rebate", arm_scores: [{ arm: 0, expected: 0.29, bonus: 0.02, score: 0.29 }, { arm: 1, expected: 0.25, bonus: 0.02, score: 0.25 }, { arm: 2, expected: 0.66, bonus: 0.02, score: 0.66 }, { arm: 3, expected: 0.35, bonus: 0.02, score: 0.35 }, { arm: 4, expected: 0.31, bonus: 0.02, score: 0.31 }, { arm: 5, expected: 0.44, bonus: 0.02, score: 0.44 }] },
  },
  true_reward_probs: [0.1362, 0.0274, 0.6389, 0.3423, 0.1299, 0.2939],
  oracle_arm: 2,
};

// ---------------------------------------------------------------------------
// exported API
// ---------------------------------------------------------------------------

export async function getMetrics() {
  if (MOCK) {
    await delay(150);
    return { summary: MOCK_SUMMARY, history: { t: 6000, series: mockHistorySeries() } };
  }
  return getJSON(`/metrics?max_points=300`);
}

export async function getSegments() {
  if (MOCK) {
    await delay(150);
    return MOCK_SEGMENTS;
  }
  return getJSON(`/segments/distribution?policy=linucb`);
}

export async function postStep(nSteps = 200) {
  if (MOCK) {
    await delay(150);
    return { ok: true };
  }
  return postJSON(`/simulate/step`, { n_steps: nSteps });
}

export async function postReset() {
  if (MOCK) {
    await delay(150);
    return { ok: true };
  }
  return postJSON(`/simulate/reset`, { n_customers: 5000, seed: 42 });
}

export async function getDecision(id) {
  if (MOCK) {
    await delay(150);
    // Canned for any id, but reflect the requested id so the inspector shows
    // the customer that was actually asked for.
    return { ...MOCK_DECISION, profile: { ...MOCK_DECISION.profile, customer_id: Number(id) } };
  }
  return getJSON(`/customer/${id}/decision`);
}
