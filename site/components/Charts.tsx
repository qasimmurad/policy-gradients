"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { chartColors, useResolvedTheme } from "@/lib/theme";
import { formatNumber, type ChartPoint, type ChartSeries } from "@/lib/runs";

/**
 * Charts for the runs page.
 *
 * Recharts needs real colour values rather than CSS variables, so every chart
 * asks `useResolvedTheme` which background it is drawing on. Animation is off
 * throughout: on a five thousand episode run it is slow and it adds nothing.
 */

type TooltipRow = { label: string; value: number | null; color: string };

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-60 w-full sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );
}

function TooltipBox({
  title,
  rows,
  background,
  border,
}: {
  title: string;
  rows: TooltipRow[];
  background: string;
  border: string;
}) {
  return (
    <div
      className="px-3 py-2 text-xs shadow-sm ring-1"
      style={{ background, borderColor: border, boxShadow: `0 0 0 1px ${border}` }}
    >
      <p className="mb-1 font-medium">{title}</p>
      {rows.map((row) => (
        <p key={row.label} className="tabular flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block size-2"
            style={{ background: row.color }}
          />
          <span className="text-muted">{row.label}</span>
          <span className="ml-auto font-medium">{formatNumber(row.value, 2)}</span>
        </p>
      ))}
    </div>
  );
}

const AXIS_PROPS = {
  tickLine: false,
  axisLine: false,
  tick: { fontSize: 11 },
} as const;

function BucketNote({ series }: { series: ChartSeries }) {
  if (!series.bucketed) return null;
  return (
    <p className="mt-2 text-xs text-muted">
      {series.episodes.toLocaleString("en-US")} episodes, averaged into groups of{" "}
      {series.bucketSize} so the chart stays readable. The moving average is
      computed on every episode before grouping.
    </p>
  );
}

export function RewardChart({ series, window }: { series: ChartSeries; window: number }) {
  const colors = chartColors(useResolvedTheme());

  return (
    <div>
      <Frame>
        <LineChart data={series.points} margin={{ top: 8, right: 8, bottom: 4, left: -12 }}>
          <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="episode"
            type="number"
            domain={["dataMin", "dataMax"]}
            stroke={colors.axis}
            {...AXIS_PROPS}
          />
          <YAxis stroke={colors.axis} width={48} {...AXIS_PROPS} />
          <Tooltip
            cursor={{ stroke: colors.axis, strokeWidth: 1, strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0].payload as ChartPoint;
              return (
                <TooltipBox
                  title={`Episode ${point.episode}`}
                  background={colors.tooltipBackground}
                  border={colors.tooltipBorder}
                  rows={[
                    { label: "reward", value: point.reward, color: colors.raw },
                    {
                      label: `average of ${window}`,
                      value: point.average,
                      color: colors.average,
                    },
                  ]}
                />
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="reward"
            stroke={colors.raw}
            strokeWidth={1}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="average"
            stroke={colors.average}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
        </LineChart>
      </Frame>
      <Legend
        items={[
          { label: "reward per episode", color: colors.raw },
          { label: `moving average, window ${window}`, color: colors.average },
        ]}
      />
      <BucketNote series={series} />
    </div>
  );
}

/**
 * Both rewards on one pair of axes, which is the whole point of Phase 2.
 *
 * The proxy is what the agent is paid and the true reward is what we actually
 * wanted. Drawn together, a reward hacking run shows the proxy climbing while
 * the true line stays flat near zero. They share a y axis deliberately: a
 * second axis would rescale the two until any pair of lines looked like it
 * diverged, which is exactly the claim the chart is supposed to be evidence for.
 */
export function RewardComparisonChart({
  series,
  window,
}: {
  series: ChartSeries;
  window: number;
}) {
  const colors = chartColors(useResolvedTheme());

  return (
    <div>
      <Frame>
        <LineChart data={series.points} margin={{ top: 8, right: 8, bottom: 4, left: -12 }}>
          <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="episode"
            type="number"
            domain={["dataMin", "dataMax"]}
            stroke={colors.axis}
            {...AXIS_PROPS}
          />
          <YAxis stroke={colors.axis} width={48} {...AXIS_PROPS} />
          <Tooltip
            cursor={{ stroke: colors.axis, strokeWidth: 1, strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0].payload as ChartPoint;
              return (
                <TooltipBox
                  title={`Episode ${point.episode}`}
                  background={colors.tooltipBackground}
                  border={colors.tooltipBorder}
                  rows={[
                    { label: "proxy", value: point.proxyReward, color: colors.proxyReward },
                    {
                      label: `proxy, avg ${window}`,
                      value: point.proxyAverage,
                      color: colors.proxyReward,
                    },
                    { label: "true", value: point.trueReward, color: colors.trueReward },
                    {
                      label: `true, avg ${window}`,
                      value: point.trueAverage,
                      color: colors.trueReward,
                    },
                  ]}
                />
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="proxyReward"
            stroke={colors.proxyReward}
            strokeOpacity={0.25}
            strokeWidth={1}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="trueReward"
            stroke={colors.trueReward}
            strokeOpacity={0.25}
            strokeWidth={1}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="proxyAverage"
            stroke={colors.proxyReward}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="trueAverage"
            stroke={colors.trueReward}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
        </LineChart>
      </Frame>
      <Legend
        items={[
          { label: `proxy reward, moving average ${window}`, color: colors.proxyReward },
          { label: `true reward, moving average ${window}`, color: colors.trueReward },
        ]}
      />
      <p className="mt-2 text-xs text-muted">
        Faint lines are the per episode values, solid lines their moving average.
        Both are drawn on the same axis so the gap between them is real.
      </p>
      <BucketNote series={series} />
    </div>
  );
}

export function LossChart({ series }: { series: ChartSeries }) {
  const colors = chartColors(useResolvedTheme());

  return (
    <div>
      <Frame>
        <LineChart data={series.points} margin={{ top: 8, right: 8, bottom: 4, left: -12 }}>
          <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="episode"
            type="number"
            domain={["dataMin", "dataMax"]}
            stroke={colors.axis}
            {...AXIS_PROPS}
          />
          <YAxis stroke={colors.axis} width={48} {...AXIS_PROPS} />
          <Tooltip
            cursor={{ stroke: colors.axis, strokeWidth: 1, strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0].payload as ChartPoint;
              return (
                <TooltipBox
                  title={`Episode ${point.episode}`}
                  background={colors.tooltipBackground}
                  border={colors.tooltipBorder}
                  rows={[{ label: "loss", value: point.loss, color: colors.loss }]}
                />
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="loss"
            stroke={colors.loss}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
        </LineChart>
      </Frame>
      <Legend items={[{ label: "policy loss", color: colors.loss }]} />
      <BucketNote series={series} />
    </div>
  );
}

export type CompareEntry = { name: string; series: ChartSeries };

/** Two runs on one pair of axes, comparing their moving averages. */
export function CompareChart({
  entries,
  window,
}: {
  entries: [CompareEntry, CompareEntry];
  window: number;
}) {
  const colors = chartColors(useResolvedTheme());

  // Merge on episode number, because the two runs need not be the same length.
  const byEpisode = new Map<number, Record<string, number | null>>();
  entries.forEach((entry, index) => {
    for (const point of entry.series.points) {
      const row = byEpisode.get(point.episode) ?? { episode: point.episode };
      row[`run${index}`] = point.average;
      byEpisode.set(point.episode, row);
    }
  });
  const data = [...byEpisode.values()].sort(
    (a, b) => (a.episode as number) - (b.episode as number),
  );

  return (
    <div>
      <Frame>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -12 }}>
          <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="episode"
            type="number"
            domain={["dataMin", "dataMax"]}
            stroke={colors.axis}
            {...AXIS_PROPS}
          />
          <YAxis stroke={colors.axis} width={48} {...AXIS_PROPS} />
          <Tooltip
            cursor={{ stroke: colors.axis, strokeWidth: 1, strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0].payload as Record<string, number | null>;
              return (
                <TooltipBox
                  title={`Episode ${row.episode}`}
                  background={colors.tooltipBackground}
                  border={colors.tooltipBorder}
                  rows={entries.map((entry, index) => ({
                    label: entry.name,
                    value: row[`run${index}`] ?? null,
                    color: colors.compare,
                  }))}
                />
              );
            }}
          />
          {entries.map((entry, index) => (
            <Line
              key={entry.name}
              type="monotone"
              dataKey={`run${index}`}
              stroke={colors.compare}
              strokeWidth={index === 0 ? 2 : 1.5}
              strokeDasharray={index === 0 ? undefined : "5 3"}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          ))}
        </LineChart>
      </Frame>
      <Legend
        items={entries.map((entry, index) => ({
          label: index === 0 ? entry.name : `${entry.name} (dashed)`,
          color: colors.compare,
          dashed: index === 1,
        }))}
      />
      <p className="mt-2 text-xs text-muted">
        Moving average of reward, window {window}. Raw episodes are left out so
        the two curves stay legible.
      </p>
    </div>
  );
}

function Legend({
  items,
}: {
  items: { label: string; color: string; dashed?: boolean }[];
}) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-0 w-4 border-t-2"
            style={{
              borderColor: item.color,
              borderTopStyle: item.dashed ? "dashed" : "solid",
            }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
