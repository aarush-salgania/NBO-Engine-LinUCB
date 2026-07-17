// Pure presentational chart. Data comes ONLY from the `series` prop, which
// matches history.series in the /metrics contract (client.js mock). A local
// toggle switches the four lines between the reward_* and regret_* keys.

import { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

// linucb = app accent (blue), thompson = second strong hue (orange); baselines
// are two muted slate grays separated by lightness.
const SERIES = [
  { key: "linucb", name: "LinUCB", color: "#3b82f6", width: 2 },
  { key: "thompson", name: "Thompson Sampling", color: "#ea580c", width: 2 },
  { key: "greedy_rules", name: "Greedy Rules", color: "#94a3b8", width: 1.5 },
  { key: "random", name: "Random", color: "#64748b", width: 1.5 },
];

const METRICS = {
  reward: { label: "Cumulative Reward", prefix: "reward_" },
  regret: { label: "Cumulative Regret", prefix: "regret_" },
};

const AXIS = "#64748b";
const AXIS_LINE = "#334155";
const GRID = "#1e293b";
const TOOLTIP_STYLE = {
  backgroundColor: "#0f172a",
  border: "1px solid #334155",
  borderRadius: 8,
  fontSize: 12,
};

export default function RewardChart({ series }) {
  const [metric, setMetric] = useState("reward");
  const hasData = Array.isArray(series) && series.length > 0;
  const { prefix } = METRICS[metric];

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="mb-3 flex items-center gap-2">
        {Object.entries(METRICS).map(([key, m]) => {
          const active = key === metric;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setMetric(key)}
              className={
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors " +
                (active
                  ? "bg-slate-700 text-slate-100"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200")
              }
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {hasData ? (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={series} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              domain={["dataMin", "dataMax"]}
              tick={{ fill: AXIS, fontSize: 12 }}
              stroke={AXIS_LINE}
              tickMargin={8}
            />
            <YAxis tick={{ fill: AXIS, fontSize: 12 }} stroke={AXIS_LINE} width={56} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelStyle={{ color: "#cbd5e1" }}
              itemStyle={{ color: "#e2e8f0" }}
              labelFormatter={(t) => `t = ${t}`}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: "#cbd5e1" }} />
            {SERIES.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={`${prefix}${s.key}`}
                name={s.name}
                stroke={s.color}
                strokeWidth={s.width}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-[320px] items-center justify-center rounded-lg bg-slate-800/40 text-sm text-slate-500">
          No data yet — start the simulation to see results.
        </div>
      )}
    </div>
  );
}
