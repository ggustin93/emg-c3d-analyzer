import * as React from 'react'
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

export interface DonutGaugeProps {
  /** 0-100 percent */
  percent: number
  /** Overall square size in px */
  size?: number
  /** Ring thickness in px */
  thickness?: number
  /** Hex color for the filled arc (e.g., #059669) */
  colorHex?: string
  /** Optional center render override */
  centerRender?: (percent: number) => React.ReactNode
  /** Optional below-center subtext */
  subtext?: React.ReactNode
}

export default function DonutGauge({
  percent,
  size = 120,
  thickness = 12,
  colorHex = '#059669',
  centerRender,
  subtext,
}: DonutGaugeProps) {
  const p = Number.isFinite(percent) ? Math.max(0, Math.min(100, Math.round(percent))) : 0
  const innerRadius = size / 2 - thickness - 6
  const outerRadius = size / 2 - 6

  return (
    <div style={{ width: size, height: size }} className="relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={[{ value: p }, { value: 100 - p }]}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            startAngle={90}
            endAngle={-270}
            dataKey="value"
            stroke="none"
          >
            <Cell fill={colorHex} />
            <Cell fill="#e5e7eb" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        {centerRender ? (
          centerRender(p)
        ) : (
          <>
            <div className="text-2xl font-bold text-slate-800">{p}%</div>
            {subtext && <div className="text-xs text-muted-foreground mt-0.5">{subtext}</div>}
          </>
        )}
      </div>
    </div>
  )
}


