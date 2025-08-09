import * as React from 'react'

export interface RadialProgressProps {
  /** Percent from 0 to 100 */
  value: number
  /** Size in px of the square SVG viewport */
  size?: number
  /** Stroke width in px */
  stroke?: number
  /** Optional class applied to the background track circle */
  trackClassName?: string
  /** Optional class applied to the progress circle (controls color via text-* classes) */
  progressClassName?: string
  /** Optional class for wrapper container */
  className?: string
  /** Render function for the center content (e.g., percentage text, value + unit) */
  centerRender?: (percent: number) => React.ReactNode
  /** When true, render subtle tick marks to emulate a clock gauge */
  showTicks?: boolean
  /** Inner padding as % of size to increase whitespace inside ring */
  innerPaddingPct?: number
}

/**
 * A minimal shadcn-style radial progress component.
 * Uses SVG circles; color is controlled via Tailwind text-* on the progress element (currentColor).
 */
export function RadialProgress({
  value,
  size = 112,
  stroke = 10,
  trackClassName,
  progressClassName,
  className,
  centerRender,
  showTicks = false,
  innerPaddingPct = 4,
}: RadialProgressProps) {
  const percent = Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0

  // Normalize to a 100x100 viewBox to keep math simple regardless of size
  const viewBoxSize = 100
  const center = viewBoxSize / 2
  const padding = (innerPaddingPct / 100) * viewBoxSize
  const radius = center - (stroke / size) * viewBoxSize - padding // keep visual thickness consistent and add inner whitespace

  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - percent / 100)

  return (
    <div className={className} style={{ width: size, height: size }}>
      <svg
        viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
        role="img"
        aria-label={`Progress ${percent}%`}
        className="block"
      >
        {/* Track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="transparent"
          strokeWidth={(stroke / size) * viewBoxSize}
          className={trackClassName ?? 'stroke-slate-200'}
        />

        {/* Optional ticks for a clock-like feel */}
        {showTicks && (
          <g className="stroke-slate-300">
            {Array.from({ length: 12 }).map((_, idx) => {
              const angle = (idx / 12) * 2 * Math.PI
              const inner = radius - 2
              const outer = radius
              const x1 = center + inner * Math.cos(angle)
              const y1 = center + inner * Math.sin(angle)
              const x2 = center + outer * Math.cos(angle)
              const y2 = center + outer * Math.sin(angle)
              return <line key={idx} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={0.6} />
            })}
          </g>
        )}

        {/* Progress */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={(stroke / size) * viewBoxSize}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
          className={progressClassName ?? 'text-teal-600'}
        />

        {/* Center content via foreignObject for layout flexibility */}
        <foreignObject x={0} y={0} width={viewBoxSize} height={viewBoxSize} pointerEvents="none">
          <div className="flex h-full w-full items-center justify-center">
            <div className="text-center">
              {centerRender ? (
                centerRender(percent)
              ) : (
                <>
                  <div className="text-xl font-bold text-slate-800">{percent}%</div>
                </>
              )}
            </div>
          </div>
        </foreignObject>
      </svg>
    </div>
  )
}

export default RadialProgress


