import { type CSSProperties,memo, useMemo, useState } from 'react'

import { useElementWidth } from '@/hooks/use-element-width'
import { DISPLAY_WEEKS, type RepoSeries } from '@/lib/activity'
import { formatAdded, formatNumber, formatRemoved } from '@/lib/format'
import type { WeekLabel } from '@/lib/weeks'

const HEIGHT = 74
const BAR_GAP = 2
const MIN_BAR = 1.5
const TOOLTIP_HALF_WIDTH = 92

interface Lane {
   base: number
   height: number
}

interface Layout {
   commits: Lane
   lines: Lane | null
   pulls: Lane
}

const WITH_LINES: Layout = {
   commits: { base: 28, height: 28 },
   lines: { base: 46, height: 12 },
   pulls: { base: 74, height: 10 },
}

const WITHOUT_LINES: Layout = {
   commits: { base: 44, height: 44 },
   lines: null,
   pulls: { base: 74, height: 20 },
}

// The future side of the date cursor fades out; --cursor is set by the dashboard.
const FADE_AFTER_CURSOR =
   'linear-gradient(to right, black calc(var(--cursor) * 100%), rgb(0 0 0 / 0.25) calc(var(--cursor) * 100%))'

const maskStyle: CSSProperties = {
   maskImage: FADE_AFTER_CURSOR,
   WebkitMaskImage: FADE_AFTER_CURSOR,
}

function columns(
   values: number[],
   toHeight: (value: number) => number,
   base: number,
   direction: 1 | -1,
   step: number
) {
   const width = Math.max(1, step - BAR_GAP)
   let path = ''
   values.forEach((value, index) => {
      if (value <= 0) {
         return
      }
      const height = Math.max(MIN_BAR, toHeight(value))
      const radius = Math.min(2, width / 2, height)
      const left = index * step + (step - width) / 2
      const right = left + width
      const end = base - direction * height
      const shoulder = end + direction * radius
      path +=
         `M${left} ${base}V${shoulder}Q${left} ${end} ${left + radius} ${end}` +
         `H${right - radius}Q${right} ${end} ${right} ${shoulder}V${base}Z`
   })
   return path
}

function peak(...lists: number[][]) {
   return Math.max(1, ...lists.flat())
}

interface RepoLanesProps {
   series: RepoSeries
   weeks: WeekLabel[]
   hasLineStats: boolean
}

export const RepoLanes = memo(function RepoLanes({
   series,
   weeks,
   hasLineStats,
}: RepoLanesProps) {
   const [ref, width] = useElementWidth<HTMLDivElement>()
   const [hovered, setHovered] = useState<number | null>(null)
   const layout = hasLineStats ? WITH_LINES : WITHOUT_LINES
   const step = width / DISPLAY_WEEKS
   const { weekly } = series

   const paths = useMemo(() => {
      if (width === 0) {
         return null
      }
      const commitPeak = peak(weekly.commits)
      const linePeak = Math.sqrt(peak(weekly.additions, weekly.deletions))
      const pullPeak = peak(weekly.pullsMerged)
      return {
         commits: columns(
            weekly.commits,
            (value) => (value / commitPeak) * layout.commits.height,
            layout.commits.base,
            1,
            step
         ),
         additions: layout.lines
            ? columns(
               weekly.additions,
               (value) => (Math.sqrt(value) / linePeak) * layout.lines!.height,
               layout.lines.base - 0.5,
               1,
               step
            )
            : '',
         deletions: layout.lines
            ? columns(
               weekly.deletions,
               (value) => (Math.sqrt(value) / linePeak) * layout.lines!.height,
               layout.lines.base + 0.5,
               -1,
               step
            )
            : '',
         pulls: columns(
            weekly.pullsMerged,
            (value) => (value / pullPeak) * layout.pulls.height,
            layout.pulls.base,
            1,
            step
         ),
      }
   }, [weekly, layout, step, width])

   function trackPointer(event: React.PointerEvent<HTMLDivElement>) {
      const bounds = event.currentTarget.getBoundingClientRect()
      const week = Math.floor(
         ((event.clientX - bounds.left) / bounds.width) * DISPLAY_WEEKS
      )
      setHovered(Math.min(DISPLAY_WEEKS - 1, Math.max(0, week)))
   }

   const tooltipCenter =
      hovered === null
         ? 0
         : Math.min(
            Math.max((hovered + 0.5) * step, TOOLTIP_HALF_WIDTH),
            Math.max(TOOLTIP_HALF_WIDTH, width - TOOLTIP_HALF_WIDTH)
         )

   return (
      <div
         ref={ref}
         className="relative"
         style={{ height: HEIGHT }}
         onPointerMove={trackPointer}
         onPointerLeave={() => setHovered(null)}
         role="img"
         aria-label={`Weekly activity of ${series.repo.name} over the last year: ${formatNumber(series.totals.commits)} commits, ${formatNumber(series.totals.pullsMerged)} pull requests merged.`}
      >
         {paths && (
            <svg
               width={width}
               height={HEIGHT}
               className="block overflow-visible"
               style={maskStyle}
               aria-hidden
            >
               {hovered !== null && (
                  <rect
                     x={hovered * step}
                     width={step}
                     height={HEIGHT}
                     className="fill-foreground/8"
                  />
               )}
               <line
                  x2={width}
                  y1={layout.commits.base + 0.5}
                  y2={layout.commits.base + 0.5}
                  className="stroke-border"
               />
               {layout.lines && (
                  <line
                     x2={width}
                     y1={layout.lines.base}
                     y2={layout.lines.base}
                     className="stroke-border"
                  />
               )}
               <path d={paths.commits} className="fill-viz-commits" />
               <path d={paths.additions} className="fill-viz-additions" />
               <path d={paths.deletions} className="fill-viz-deletions" />
               <path d={paths.pulls} className="fill-viz-pulls" />
            </svg>
         )}
         <div
            className="pointer-events-none absolute inset-y-0 w-px bg-foreground/45"
            style={{ left: 'calc(var(--cursor) * 100%)' }}
         />
         {hovered !== null && (
            <LaneTooltip
               series={series}
               week={weeks[hovered]}
               center={tooltipCenter}
               hasLineStats={hasLineStats}
            />
         )}
      </div>
   )
})

function LaneTooltip({
   series,
   week,
   center,
   hasLineStats,
}: {
   series: RepoSeries
   week: WeekLabel
   center: number
   hasLineStats: boolean
}) {
   const { weekly } = series
   const index = week.week
   return (
      <div
         className="pointer-events-none absolute bottom-full z-20 mb-1.5 grid w-46 -translate-x-1/2 gap-1.5 rounded-lg border border-border/60 bg-popover px-2.5 py-2 text-xs text-popover-foreground shadow-lg"
         style={{ left: center }}
      >
         <div className="font-medium">{week.range}</div>
         <TooltipRow
            mark="bg-viz-commits"
            label="Commits"
            value={formatNumber(weekly.commits[index])}
         />
         {hasLineStats && (
            <>
               <TooltipRow
                  mark="bg-viz-additions"
                  label="Lines added"
                  value={formatAdded(weekly.additions[index])}
               />
               <TooltipRow
                  mark="bg-viz-deletions"
                  label="Lines removed"
                  value={formatRemoved(weekly.deletions[index])}
               />
            </>
         )}
         <TooltipRow
            mark="bg-viz-pulls"
            label="PRs merged"
            value={formatNumber(weekly.pullsMerged[index])}
         />
      </div>
   )
}

export function TooltipRow({
   mark,
   label,
   value,
}: {
   mark: string
   label: string
   value: string
}) {
   return (
      <div className="flex items-center gap-2 leading-none">
         <span className={`h-0.5 w-2.5 shrink-0 rounded-full ${mark}`} />
         <span className="text-muted-foreground">{label}</span>
         <span className="ml-auto font-medium tabular-nums">{value}</span>
      </div>
   )
}
