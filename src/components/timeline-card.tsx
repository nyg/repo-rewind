import { Slider as SliderPrimitive } from 'radix-ui'
import { useMemo } from 'react'
import { Bar, BarChart, BarStack, CartesianGrid, XAxis, YAxis } from 'recharts'

import { TooltipRow } from '@/components/repo-lanes'
import {
   type ChartConfig,
   ChartContainer,
   ChartTooltip,
} from '@/components/ui/chart'
import {
   lastDay,
   type RepoSeries,
   type Timeline,
   WEEK_DAYS,
   type WeekOverview,
   weekStartDay,
} from '@/lib/activity'
import { formatAdded, formatNumber, formatRemoved } from '@/lib/format'
import type { WeekLabel } from '@/lib/weeks'

const Y_AXIS_WIDTH = 36
const X_AXIS_HEIGHT = 24
const MARGIN = { top: 8, right: 8, bottom: 0, left: 0 }
const THUMB_SIZE = 18

const plotArea = {
   top: MARGIN.top,
   right: MARGIN.right,
   bottom: X_AXIS_HEIGHT,
   left: Y_AXIS_WIDTH,
}

// Radix keeps the thumb inside the track, so the track overhangs the plot by half a thumb to line both up.
const sliderInset = {
   marginLeft: Y_AXIS_WIDTH - THUMB_SIZE / 2,
   marginRight: MARGIN.right - THUMB_SIZE / 2,
}

interface TimelineCardProps {
   overview: WeekOverview[]
   weeks: WeekLabel[]
   timeline: Timeline
   day: number
   focus: RepoSeries | null
   hasLineStats: boolean
   onDayChange: (day: number) => void
}

export function TimelineCard({
   overview,
   weeks,
   timeline,
   day,
   focus,
   hasLineStats,
   onDayChange,
}: TimelineCardProps) {
   const data = useMemo(
      () =>
         overview.map(({ week, values }) => {
            const focused = focus ? focus.weekly.commits[week] : 0
            return { week, focus: focused, rest: values.commits - focused }
         }),
      [overview, focus]
   )
   const monthTicks = useMemo(
      () => weeks.filter((week) => week.month).map((week) => week.week),
      [weeks]
   )
   const config: ChartConfig = {
      focus: { label: focus?.repo.name ?? '', color: 'var(--viz-accent)' },
      rest: {
         label: focus ? 'Other repositories' : 'Commits',
         color: focus ? 'var(--viz-context)' : 'var(--viz-commits)',
      },
   }

   function selectWeek(label: unknown) {
      const week = Number(label)
      if (Number.isInteger(week)) {
         onDayChange(
            Math.min(
               lastDay(timeline),
               weekStartDay(timeline, week) + WEEK_DAYS - 1
            )
         )
      }
   }

   return (
      <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
         <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="text-sm font-medium">
               Commits per week, all repositories
            </h2>
            <p className="text-xs text-muted-foreground">
               {focus ? (
                  <span className="flex items-center gap-3">
                     <LegendMark mark="bg-viz-accent" label={focus.repo.name} />
                     <LegendMark mark="bg-viz-context" label="Other repositories" />
                  </span>
               ) : (
                  'Hover a repository to see its share. Click a week or drag the handle to move the date.'
               )}
            </p>
         </div>

         <div className="relative mt-3">
            <ChartContainer config={config} className="aspect-auto h-40 w-full">
               <BarChart
                  data={data}
                  margin={MARGIN}
                  barCategoryGap="18%"
                  onClick={(state) => selectWeek(state.activeLabel)}
                  className="cursor-pointer"
               >
                  <CartesianGrid vertical={false} />
                  <XAxis
                     dataKey="week"
                     height={X_AXIS_HEIGHT}
                     tickLine={false}
                     axisLine={false}
                     ticks={monthTicks}
                     interval="equidistantPreserveStart"
                     minTickGap={14}
                     tickFormatter={(week: number) => weeks[week]?.month ?? ''}
                  />
                  <YAxis
                     width={Y_AXIS_WIDTH}
                     tickLine={false}
                     axisLine={false}
                     tickCount={4}
                     allowDecimals={false}
                     tickFormatter={(value: number) => formatNumber(value)}
                  />
                  <ChartTooltip
                     cursor={{ fill: 'var(--muted)' }}
                     isAnimationActive={false}
                     wrapperStyle={{ zIndex: 20 }}
                     content={
                        <OverviewTooltip
                           overview={overview}
                           weeks={weeks}
                           focus={focus}
                           hasLineStats={hasLineStats}
                        />
                     }
                  />
                  <BarStack radius={[3, 3, 0, 0]}>
                     <Bar
                        dataKey="focus"
                        fill="var(--color-focus)"
                        maxBarSize={24}
                        isAnimationActive={false}
                     />
                     <Bar
                        dataKey="rest"
                        fill="var(--color-rest)"
                        maxBarSize={24}
                        isAnimationActive={false}
                     />
                  </BarStack>
               </BarChart>
            </ChartContainer>

            <div className="pointer-events-none absolute" style={plotArea}>
               <div
                  className="absolute inset-y-0 right-0 bg-card/70"
                  style={{ left: 'calc(var(--cursor) * 100%)' }}
               />
               <div
                  className="absolute -top-1 bottom-0 w-px bg-foreground"
                  style={{ left: 'calc(var(--cursor) * 100%)' }}
               />
            </div>
         </div>

         <SliderPrimitive.Root
            className="relative flex h-6 touch-none items-center select-none"
            style={sliderInset}
            min={timeline.firstDisplayDay - 1}
            max={lastDay(timeline)}
            step={1}
            value={[day]}
            onValueChange={([value]) => onDayChange(value)}
         >
            <SliderPrimitive.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-muted">
               <SliderPrimitive.Range className="absolute h-full bg-foreground/25" />
            </SliderPrimitive.Track>
            <SliderPrimitive.Thumb
               aria-label="Date"
               className="block cursor-grab rounded-full border-2 border-foreground bg-background shadow-sm ring-ring/40 transition-shadow outline-none hover:ring-4 focus-visible:ring-4 active:cursor-grabbing active:ring-4"
               style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
            />
         </SliderPrimitive.Root>
      </section>
   )
}

function LegendMark({ mark, label }: { mark: string, label: string }) {
   return (
      <span className="flex items-center gap-1.5">
         <span className={`size-2 rounded-[2px] ${mark}`} />
         {label}
      </span>
   )
}

interface OverviewTooltipProps {
   active?: boolean
   label?: string | number
   overview: WeekOverview[]
   weeks: WeekLabel[]
   focus: RepoSeries | null
   hasLineStats: boolean
}

function OverviewTooltip({
   active,
   label,
   overview,
   weeks,
   focus,
   hasLineStats,
}: OverviewTooltipProps) {
   const entry = overview[Number(label)]
   if (!active || !entry) {
      return null
   }
   const { values, top } = entry
   return (
      <div className="grid w-52 gap-1.5 rounded-lg border border-border/60 bg-popover px-2.5 py-2 text-xs text-popover-foreground shadow-lg">
         <div className="font-medium">{weeks[entry.week].range}</div>
         <TooltipRow
            mark={focus ? 'bg-viz-context' : 'bg-viz-commits'}
            label="Commits"
            value={formatNumber(values.commits)}
         />
         {focus && (
            <TooltipRow
               mark="bg-viz-accent"
               label={focus.repo.name}
               value={formatNumber(focus.weekly.commits[entry.week])}
            />
         )}
         {hasLineStats && (
            <>
               <TooltipRow
                  mark="bg-viz-additions"
                  label="Lines added"
                  value={formatAdded(values.additions)}
               />
               <TooltipRow
                  mark="bg-viz-deletions"
                  label="Lines removed"
                  value={formatRemoved(values.deletions)}
               />
            </>
         )}
         <TooltipRow
            mark="bg-viz-pulls"
            label="PRs merged"
            value={formatNumber(values.pullsMerged)}
         />
         {top.length > 0 && (
            <div className="mt-0.5 grid gap-1 border-t border-border/60 pt-1.5">
               <div className="text-muted-foreground">Busiest</div>
               {top.map((repo) => (
                  <div key={repo.name} className="flex gap-2 leading-none">
                     <span className="truncate">{repo.name}</span>
                     <span className="ml-auto font-medium tabular-nums">
                        {formatNumber(repo.commits)}
                     </span>
                  </div>
               ))}
            </div>
         )}
      </div>
   )
}
