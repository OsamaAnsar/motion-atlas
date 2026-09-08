"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface ChartPoint {
  t: number;
  value: number;
}

export function MetricChart({
  data,
  color = "#7c9cff",
  unit = "",
  domain,
  height = 160,
}: {
  data: ChartPoint[];
  color?: string;
  unit?: string;
  domain?: [number, number];
  height?: number;
}) {
  const id = `grad-${color.replace("#", "")}`;
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#232327" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(v: number) =>
              new Date(v).toLocaleTimeString(undefined, { minute: "2-digit", second: "2-digit" })
            }
            tick={{ fill: "#8b8b93", fontSize: 10 }}
            stroke="#232327"
            minTickGap={40}
          />
          <YAxis
            domain={domain ?? [0, "auto"]}
            tick={{ fill: "#8b8b93", fontSize: 10 }}
            stroke="#232327"
            width={44}
          />
          <Tooltip
            contentStyle={{
              background: "#151518",
              border: "1px solid #232327",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "#8b8b93" }}
            labelFormatter={(v) => new Date(Number(v)).toLocaleTimeString()}
            formatter={(v: number | string) => [`${Math.round(Number(v))}${unit}`, ""]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${id})`}
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
