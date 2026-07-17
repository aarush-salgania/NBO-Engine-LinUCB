// Pure presentational KPI row. Data comes ONLY from the `summary` prop, which
// matches the `summary` object in the /metrics contract (client.js mock).

const ORDER = ["linucb", "thompson", "greedy_rules", "random"];

const DISPLAY = {
  linucb: "LinUCB",
  thompson: "Thompson Sampling",
  greedy_rules: "Greedy Rules",
  random: "Random",
};

const pct = (x) => `${(x * 100).toFixed(1)}%`;

function UpliftPill({ value }) {
  const positive = value >= 0;
  return (
    <span
      className={
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums " +
        (positive ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400")
      }
    >
      {positive ? "+" : ""}
      {value.toFixed(1)}% vs rules
    </span>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="h-4 w-24 rounded bg-slate-800" />
      <div className="mt-4 h-8 w-20 rounded bg-slate-800" />
      <div className="mt-3 h-3 w-28 rounded bg-slate-800/70" />
      <div className="mt-5 h-3 w-16 rounded bg-slate-800/70" />
    </div>
  );
}

export default function StatCards({ summary }) {
  if (!summary) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {ORDER.map((key) => {
        const p = summary.policies?.[key];
        if (!p) return <SkeletonCard key={key} />;

        const isLinucb = key === "linucb";
        const showPill = key !== "greedy_rules";

        return (
          <div
            key={key}
            className={
              "rounded-xl bg-slate-900 p-4 " +
              (isLinucb
                ? "border border-blue-500 ring-1 ring-blue-500/30"
                : "border border-slate-800")
            }
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-medium text-slate-300">{DISPLAY[key]}</span>
              {showPill && <UpliftPill value={p.uplift_vs_rules_pct} />}
            </div>

            <div className="mt-3 text-3xl font-semibold tabular-nums text-slate-100">
              {pct(p.trailing_rate)}
            </div>
            <div className="text-[11px] uppercase tracking-wide text-slate-500">
              Trailing rate
            </div>

            <div className="mt-2 text-sm text-slate-400">
              Redemption <span className="tabular-nums">{pct(p.redemption_rate)}</span>
            </div>

            <div className="mt-4 text-xs text-slate-500">
              Regret <span className="tabular-nums">{p.cumulative_regret.toFixed(1)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
