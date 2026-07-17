// The ONE component that owns a fetch (per the app's data rules): it holds its
// own id/loading/error state and calls getDecision(id) directly. Everything it
// renders comes from that single /customer/{id}/decision response.

import { useEffect, useState } from "react";
import { getDecision } from "../api/client";

// Fixed offer order (arm index → offer name), matching the contract.
const OFFERS = [
  "5% Dining Cashback",
  "3x Travel Points",
  "4% Grocery Rebate",
  "10¢/gal Fuel Rewards",
  "6% Online Shopping",
  "$5 Streaming Credit",
];

const POLICY_ORDER = ["linucb", "thompson", "greedy_rules", "random"];
const POLICY_NAMES = {
  linucb: "LinUCB",
  thompson: "Thompson Sampling",
  greedy_rules: "Greedy Rules",
  random: "Random",
};

const PREFS = [
  ["dining", "Dining"],
  ["travel", "Travel"],
  ["grocery", "Grocery"],
  ["fuel", "Fuel"],
  ["online", "Online"],
];

const fmt = (x, d = 4) => (x == null ? "—" : Number(x).toFixed(d));
const pct0 = (x) => `${Math.round((x ?? 0) * 100)}%`;
const pct1 = (x) => (x == null ? "—" : `${(x * 100).toFixed(1)}%`);

function Chip({ children }) {
  return (
    <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
      {children}
    </span>
  );
}

export default function CustomerInspector() {
  const [id, setId] = useState(17);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function inspect(targetId) {
    setLoading(true);
    setError(null);
    try {
      const res = await getDecision(targetId);
      setData(res);
    } catch (e) {
      setError(e?.message ? String(e.message) : String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  // Auto-load the default customer once so the panel isn't empty on first paint.
  useEffect(() => {
    inspect(17);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const profile = data?.profile;
  const decisions = data?.decisions;
  const linucbScores = decisions?.linucb?.arm_scores ?? [];
  const maxScoreIdx = linucbScores.reduce(
    (best, s, i) =>
      s?.score != null && s.score > (linucbScores[best]?.score ?? -Infinity) ? i : best,
    0
  );

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      {/* controls */}
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="mr-2 text-sm font-semibold text-slate-200">Customer inspector</h3>
        <input
          type="number"
          min={0}
          max={4999}
          value={id}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isNaN(n)) return;
            setId(Math.max(0, Math.min(4999, Math.trunc(n))));
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") inspect(id);
          }}
          className="w-24 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-sm tabular-nums text-slate-100 outline-none focus:border-slate-500"
        />
        <button
          type="button"
          onClick={() => inspect(id)}
          disabled={loading}
          className="rounded-md bg-slate-700 px-3 py-1.5 text-sm font-medium text-slate-100 hover:bg-slate-600 disabled:opacity-60"
        >
          {loading ? "Inspecting…" : "Inspect"}
        </button>
        <span className="text-xs text-slate-500">id 0–4999</span>
      </div>

      {error && (
        <div className="mt-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {profile && (
        <div className="mt-4 space-y-5">
          {/* a) profile chips + category preferences */}
          <section>
            <div className="mb-2 text-sm font-semibold text-slate-200">
              Customer #{profile.customer_id}
            </div>
            <div className="flex flex-wrap gap-2">
              <Chip>Credit: {profile.credit_band}</Chip>
              <Chip>
                <span className="tabular-nums">{profile.tenure_years}</span> yrs
              </Chip>
              <Chip>
                <span className="tabular-nums">{profile.txns_per_month}</span>/mo
              </Chip>
              <Chip>{profile.segment}</Chip>
            </div>

            <div className="mt-3 space-y-1.5">
              {PREFS.map(([key, label]) => {
                const v = profile.category_prefs?.[key] ?? 0;
                return (
                  <div key={key} className="flex items-center gap-2">
                    <span className="w-16 text-xs text-slate-400">{label}</span>
                    <div className="h-2 flex-1 rounded bg-slate-800">
                      <div
                        className="h-2 rounded bg-slate-400"
                        style={{ width: `${v * 100}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-xs tabular-nums text-slate-400">
                      {pct0(v)}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* b) chosen offer per policy (LinUCB row uses the accent) */}
          <section>
            <div className="mb-2 text-sm font-semibold text-slate-200">
              Chosen offer by policy
            </div>
            <div className="space-y-1.5">
              {POLICY_ORDER.map((key) => {
                const d = decisions?.[key];
                const isLinucb = key === "linucb";
                return (
                  <div key={key} className="flex items-center justify-between gap-2">
                    <span
                      className={
                        "text-sm " +
                        (isLinucb ? "font-medium text-blue-400" : "text-slate-400")
                      }
                    >
                      {POLICY_NAMES[key]}
                    </span>
                    <span
                      className={
                        "rounded-md px-2 py-0.5 text-xs font-medium " +
                        (isLinucb
                          ? "border border-blue-500/40 bg-blue-500/10 text-blue-300"
                          : "bg-slate-800 text-slate-300")
                      }
                    >
                      {d?.chosen_offer ?? "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* c) LinUCB arm-score table (max-score row highlighted with the accent) */}
          <section>
            <div className="mb-2 text-sm font-semibold text-slate-200">LinUCB arm scores</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-1 font-medium">Offer</th>
                  <th className="py-1 text-right font-medium">Expected</th>
                  <th className="py-1 text-right font-medium">+ Bonus</th>
                  <th className="py-1 text-right font-medium">= Score</th>
                </tr>
              </thead>
              <tbody>
                {OFFERS.map((offer, i) => {
                  const s = linucbScores[i] ?? {};
                  const isMax = i === maxScoreIdx;
                  return (
                    <tr
                      key={offer}
                      className={
                        "border-t border-slate-800 " +
                        (isMax ? "bg-blue-500/10 font-bold text-slate-100" : "text-slate-400")
                      }
                    >
                      <td className="py-1">{offer}</td>
                      <td className="py-1 text-right tabular-nums">{fmt(s.expected)}</td>
                      <td className="py-1 text-right tabular-nums">{fmt(s.bonus)}</td>
                      <td className="py-1 text-right tabular-nums">{fmt(s.score)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          {/* d) hidden simulator ground truth — clearly separated */}
          <section className="rounded-lg border border-dashed border-amber-500/40 bg-amber-500/10 p-3">
            <div className="text-sm font-semibold text-amber-300">
              Hidden simulator ground truth (demo transparency)
            </div>
            <div className="mt-0.5 text-xs text-amber-400/80">
              The environment's true redemption probabilities — never visible to any policy.
            </div>
            <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
              {OFFERS.map((offer, i) => {
                const isOracle = i === data.oracle_arm;
                const prob = data.true_reward_probs?.[i];
                return (
                  <div
                    key={offer}
                    className="flex items-center justify-between gap-2 text-sm text-amber-200"
                  >
                    <span>
                      {isOracle && (
                        <span className="mr-1" title="oracle (best) arm">
                          ★
                        </span>
                      )}
                      {offer}
                    </span>
                    <span className="tabular-nums">{pct1(prob)}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {!profile && !error && loading && (
        <div className="mt-4 text-sm text-slate-500">Loading…</div>
      )}
    </div>
  );
}
