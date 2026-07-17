// Pure presentational chart. Data comes ONLY from the `segments` prop, which
// matches the /segments/distribution contract (client.js mock). Each segment
// row's counts[] is spread into { segment, <offer>: count, ... } keyed by
// segments.offers, then drawn as one stacked Bar per offer.

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

// 6 distinct but cohesive hues (dark-surface categorical steps). Deliberately
// excludes the accent blue so the accent stays unique to LinUCB. All six clear
// 3:1 on the slate surface.
const COLORS = ["#008300", "#d55181", "#c98500", "#199e70", "#d95926", "#9085e9"];
const SURFACE = "#0f172a"; // separator between stacked segments (= card bg)
const AXIS = "#64748b";
const AXIS_LINE = "#334155";
const GRID = "#1e293b";
const TOOLTIP_STYLE = {
  backgroundColor: "#0f172a",
  border: "1px solid #334155",
  borderRadius: 8,
  fontSize: 12,
};

const TITLE = "Offers served per segment (LinUCB)";

function Shell({ children }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-200">{TITLE}</h3>
      {children}
    </div>
  );
}

export default function SegmentDistribution({ segments }) {
  const ok =
    segments &&
    Array.isArray(segments.offers) &&
    segments.offers.length > 0 &&
    Array.isArray(segments.segments) &&
    segments.segments.length > 0;

  if (!ok) {
    return (
      <Shell>
        <div className="flex h-[320px] items-center justify-center rounded-lg bg-slate-800/40 text-sm text-slate-500">
          No segment data yet.
        </div>
      </Shell>
    );
  }

  const offers = segments.offers;
  const data = segments.segments.map((row) => {
    const obj = { segment: row.segment };
    offers.forEach((offer, i) => {
      obj[offer] = row.counts?.[i] ?? 0;
    });
    return obj;
  });

  return (
    <Shell>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="segment"
            tick={{ fill: AXIS, fontSize: 11 }}
            stroke={AXIS_LINE}
            interval={0}
            tickMargin={8}
          />
          <YAxis tick={{ fill: AXIS, fontSize: 12 }} stroke={AXIS_LINE} width={56} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={{ color: "#cbd5e1" }}
            itemStyle={{ color: "#e2e8f0" }}
            cursor={{ fill: "#ffffff10" }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "#cbd5e1" }} />
          {offers.map((offer, i) => (
            <Bar
              key={offer}
              dataKey={offer}
              stackId="a"
              fill={COLORS[i % COLORS.length]}
              stroke={SURFACE}
              strokeWidth={1}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </Shell>
  );
}
