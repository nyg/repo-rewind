import {
   ChartColumnIcon,
   ExternalLinkIcon,
   StarIcon,
   Table2Icon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import {
   Area,
   Bar,
   CartesianGrid,
   ComposedChart,
   ReferenceLine,
   XAxis,
   YAxis,
} from 'recharts'

import { RepoFlags } from '@/components/repo-row'
import {
   type ChartConfig,
   ChartContainer,
   ChartTooltip,
} from '@/components/ui/chart'
import {
   Sheet,
   SheetContent,
   SheetDescription,
   SheetHeader,
   SheetTitle,
} from '@/components/ui/sheet'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
   DISPLAY_WEEKS,
   lastDay,
   type RankedRepo,
   type RepoSeries,
   type Timeline,
   TRAILING_DAYS,
   WEEK_DAYS,
   weekOfDay,
   weekStartDay,
} from '@/lib/activity'
import {
   formatAdded,
   formatCompact,
   formatNumber,
   formatRemoved,
   formatScore,
} from '@/lib/format'
import { type Actor,ACTORS } from '@/lib/github/types'
import type { WeekLabel } from '@/lib/weeks'

const ACTOR_NAMES: Record<Actor, string> = {
   you: 'You',
   agent: 'AI agents',
   automation: 'Automation',
   other: 'Other people',
}

const chartConfig = {
   score: { label: 'Activity score', color: 'var(--viz-accent)' },
   commits: { label: 'Commits', color: 'var(--viz-commits)' },
   additions: { label: 'Lines added', color: 'var(--viz-additions)' },
   deletions: { label: 'Lines removed', color: 'var(--viz-deletions)' },
   pullsOpened: { label: 'PRs opened', color: 'var(--viz-pulls-soft)' },
   pullsMerged: { label: 'PRs merged', color: 'var(--viz-pulls)' },
} satisfies ChartConfig

interface WeekRow {
   week: number
   score: number
   commits: number
   additions: number
   deletions: number
   additionsRoot: number
   deletionsRoot: number
   pullsOpened: number
   pullsMerged: number
}

function weekRows(series: RepoSeries, timeline: Timeline): WeekRow[] {
   return Array.from({ length: DISPLAY_WEEKS }, (_, week) => {
      const endDay = Math.min(
         lastDay(timeline),
         weekStartDay(timeline, week) + WEEK_DAYS - 1
      )
      const additions = series.weekly.additions[week]
      const deletions = series.weekly.deletions[week]
      return {
         week,
         score: Number(series.score[endDay].toFixed(2)),
         commits: series.weekly.commits[week],
         additions,
         deletions,
         additionsRoot: Math.sqrt(additions),
         deletionsRoot: -Math.sqrt(deletions),
         pullsOpened: series.weekly.pullsOpened[week],
         pullsMerged: series.weekly.pullsMerged[week],
      }
   })
}

function niceCeiling(value: number) {
   const magnitude = Math.pow(10, Math.floor(Math.log10(Math.max(1, value))))
   const step = [1, 2, 5, 10].find((factor) => factor * magnitude >= value) ?? 10
   return step * magnitude
}

interface RepoSheetProps {
   item: RankedRepo | null
   weeks: WeekLabel[]
   timeline: Timeline
   day: number
   hasLineStats: boolean
   onClose: () => void
}

export function RepoSheet({
   item,
   weeks,
   timeline,
   day,
   hasLineStats,
   onClose,
}: RepoSheetProps) {
   return (
      <Sheet open={item !== null} onOpenChange={(open) => !open && onClose()}>
         <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
            {item && (
               <RepoDetail
                  item={item}
                  weeks={weeks}
                  timeline={timeline}
                  day={day}
                  hasLineStats={hasLineStats}
               />
            )}
         </SheetContent>
      </Sheet>
   )
}

function RepoDetail({
   item,
   weeks,
   timeline,
   day,
   hasLineStats,
}: Omit<RepoSheetProps, 'item' | 'onClose'> & { item: RankedRepo }) {
   const [view, setView] = useState<'charts' | 'table'>('charts')
   const { series, recent } = item
   const { repo } = series
   const rows = useMemo(() => weekRows(series, timeline), [series, timeline])
   const cursorWeek = Math.max(0, weekOfDay(timeline, day))

   return (
      <>
         <SheetHeader className="gap-2 border-b pr-12">
            <SheetTitle className="flex items-center gap-2 text-lg">
               <a
                  href={repo.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-w-0 items-center gap-1.5 hover:underline"
               >
                  <span className="truncate">{repo.nameWithOwner}</span>
                  <ExternalLinkIcon className="size-4 shrink-0 text-muted-foreground" />
               </a>
               <RepoFlags repo={repo} />
            </SheetTitle>
            <SheetDescription>
               {repo.description ?? 'No description.'}
            </SheetDescription>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
               {repo.language && (
                  <span className="flex items-center gap-1.5">
                     <span
                        className="size-2 rounded-full ring-1 ring-foreground/10"
                        style={{
                           backgroundColor: repo.language.color ?? 'transparent',
                        }}
                     />
                     {repo.language.name}
                  </span>
               )}
               <span className="flex items-center gap-1">
                  <StarIcon className="size-3" />
                  {formatNumber(repo.stars)}
               </span>
               {repo.truncated && (
                  <span>History truncated to the latest commits</span>
               )}
               {repo.error && <span>Could not load everything: {repo.error}</span>}
            </div>
         </SheetHeader>

         <div className="grid grid-cols-1 gap-6 p-4">
            <dl className="grid grid-cols-3 gap-x-4 gap-y-3 sm:grid-cols-5">
               <Stat
                  label="Score"
                  value={formatScore(item.score)}
                  detail={item.score > 0 ? `rank ${item.rank}` : 'quiet'}
               />
               <Stat label="Commits" value={formatNumber(recent.commits)} />
               {hasLineStats && (
                  <Stat
                     label="Lines"
                     value={formatAdded(recent.additions)}
                     detail={formatRemoved(recent.deletions)}
                  />
               )}
               <Stat label="PRs opened" value={formatNumber(recent.pullsOpened)} />
               <Stat label="PRs merged" value={formatNumber(recent.pullsMerged)} />
               <p className="col-span-full text-xs text-muted-foreground">
                  Score on the selected date; counts for the {TRAILING_DAYS} days
                  before it.
               </p>
            </dl>

            <div className="flex items-center justify-between gap-3">
               <h3 className="text-sm font-medium">Last 52 weeks</h3>
               <ToggleGroup
                  type="single"
                  size="sm"
                  variant="outline"
                  spacing={0}
                  value={view}
                  onValueChange={(value) => {
                     if (value) {
                        setView(value as 'charts' | 'table')
                     }
                  }}
                  aria-label="View"
               >
                  <ToggleGroupItem value="charts" aria-label="Charts">
                     <ChartColumnIcon />
                     Charts
                  </ToggleGroupItem>
                  <ToggleGroupItem value="table" aria-label="Table">
                     <Table2Icon />
                     Table
                  </ToggleGroupItem>
               </ToggleGroup>
            </div>

            {view === 'charts' ? (
               <Charts
                  rows={rows}
                  weeks={weeks}
                  cursorWeek={cursorWeek}
                  hasLineStats={hasLineStats}
               />
            ) : (
               <WeekTable rows={rows} weeks={weeks} hasLineStats={hasLineStats} />
            )}

            <div className="grid gap-2 border-t pt-4">
               <h3 className="text-sm font-medium">
                  Commits by author, last 52 weeks
               </h3>
               <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {ACTORS.map((actor) => (
                     <Stat
                        key={actor}
                        label={ACTOR_NAMES[actor]}
                        value={formatNumber(series.commitsByActor[actor])}
                     />
                  ))}
               </dl>
               {repo.isFork && (
                  <p className="text-xs text-muted-foreground">
                     This is a fork, so only the owner's commits were fetched.
                  </p>
               )}
            </div>
         </div>
      </>
   )
}

function Stat({
   label,
   value,
   detail,
}: {
   label: string
   value: string
   detail?: string
}) {
   return (
      <div>
         <dt className="text-xs text-muted-foreground">{label}</dt>
         <dd className="mt-0.5 text-lg leading-tight font-semibold">{value}</dd>
         {detail && (
            <dd className="text-xs text-muted-foreground tabular-nums">{detail}</dd>
         )}
      </div>
   )
}

interface ChartsProps {
   rows: WeekRow[]
   weeks: WeekLabel[]
   cursorWeek: number
   hasLineStats: boolean
}

function Charts({ rows, weeks, cursorWeek, hasLineStats }: ChartsProps) {
   const lineCeiling = niceCeiling(
      Math.max(1, ...rows.map((row) => Math.max(row.additions, row.deletions)))
   )
   const lineTicks = [
      -lineCeiling,
      -lineCeiling / 4,
      0,
      lineCeiling / 4,
      lineCeiling,
   ]
   const formatLineTick = lineCeiling >= 10_000 ? formatCompact : formatNumber

   return (
      <div className="grid grid-cols-1 gap-5">
         <Panel
            title="Activity score"
            rows={rows}
            weeks={weeks}
            cursorWeek={cursorWeek}
            keys={['score']}
         >
            <Area
               dataKey="score"
               type="monotone"
               stroke="var(--color-score)"
               strokeWidth={2}
               fill="var(--color-score)"
               fillOpacity={0.1}
               isAnimationActive={false}
            />
         </Panel>

         <Panel
            title="Commits per week"
            rows={rows}
            weeks={weeks}
            cursorWeek={cursorWeek}
            keys={['commits']}
         >
            <Bar
               dataKey="commits"
               fill="var(--color-commits)"
               radius={[2, 2, 0, 0]}
               maxBarSize={24}
               isAnimationActive={false}
            />
         </Panel>

         {hasLineStats && (
            <Panel
               title="Lines added and removed per week"
               note="Square-root scale, so small weeks stay visible next to large ones"
               rows={rows}
               weeks={weeks}
               cursorWeek={cursorWeek}
               keys={['additions', 'deletions']}
               yAxis={
                  <YAxis
                     width={44}
                     tickLine={false}
                     axisLine={false}
                     domain={[-Math.sqrt(lineCeiling), Math.sqrt(lineCeiling)]}
                     interval={0}
                     ticks={lineTicks.map(
                        (tick) => Math.sign(tick) * Math.sqrt(Math.abs(tick))
                     )}
                     tickFormatter={(root: number) =>
                        formatLineTick(Math.round(root * root))
                     }
                  />
               }
            >
               <Bar
                  dataKey="additionsRoot"
                  stackId="lines"
                  fill="var(--color-additions)"
                  radius={[2, 2, 0, 0]}
                  maxBarSize={24}
                  isAnimationActive={false}
               />
               <Bar
                  dataKey="deletionsRoot"
                  stackId="lines"
                  fill="var(--color-deletions)"
                  radius={[2, 2, 0, 0]}
                  maxBarSize={24}
                  isAnimationActive={false}
               />
               <ReferenceLine y={0} stroke="var(--border)" />
            </Panel>
         )}

         <Panel
            title="Pull requests per week"
            rows={rows}
            weeks={weeks}
            cursorWeek={cursorWeek}
            keys={['pullsOpened', 'pullsMerged']}
            legend
         >
            <Bar
               dataKey="pullsOpened"
               fill="var(--color-pullsOpened)"
               radius={[2, 2, 0, 0]}
               maxBarSize={10}
               isAnimationActive={false}
            />
            <Bar
               dataKey="pullsMerged"
               fill="var(--color-pullsMerged)"
               radius={[2, 2, 0, 0]}
               maxBarSize={10}
               isAnimationActive={false}
            />
         </Panel>
      </div>
   )
}

type SeriesKey = keyof typeof chartConfig

interface PanelProps {
   title: string
   note?: string
   rows: WeekRow[]
   weeks: WeekLabel[]
   cursorWeek: number
   keys: SeriesKey[]
   legend?: boolean
   yAxis?: React.ReactNode
   children: React.ReactNode
}

function Panel({
   title,
   note,
   rows,
   weeks,
   cursorWeek,
   keys,
   legend,
   yAxis,
   children,
}: PanelProps) {
   const monthTicks = weeks.filter((week) => week.month).map((week) => week.week)
   return (
      <figure className="grid grid-cols-1 gap-1.5">
         <figcaption className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="text-xs font-medium">{title}</span>
            {note && <span className="text-xs text-muted-foreground">{note}</span>}
            {(legend || keys.length > 1) && (
               <span className="flex items-center gap-3 text-xs text-muted-foreground">
                  {keys.map((key) => (
                     <span key={key} className="flex items-center gap-1.5">
                        <span
                           className="size-2 rounded-[2px]"
                           style={{ backgroundColor: chartConfig[key].color }}
                        />
                        {chartConfig[key].label}
                     </span>
                  ))}
               </span>
            )}
         </figcaption>
         <ChartContainer config={chartConfig} className="aspect-auto h-32 w-full">
            <ComposedChart
               data={rows}
               syncId="repo-detail"
               margin={{ top: 6, right: 4, bottom: 0, left: 0 }}
               barCategoryGap="18%"
               barGap={1}
               stackOffset="sign"
            >
               <CartesianGrid vertical={false} />
               <XAxis
                  dataKey="week"
                  height={22}
                  tickLine={false}
                  axisLine={false}
                  ticks={monthTicks}
                  interval="equidistantPreserveStart"
                  minTickGap={14}
                  tickFormatter={(week: number) => weeks[week]?.month ?? ''}
               />
               {yAxis ?? (
                  <YAxis
                     width={44}
                     tickLine={false}
                     axisLine={false}
                     tickCount={4}
                     allowDecimals={false}
                     tickFormatter={(value: number) => formatNumber(value)}
                  />
               )}
               <ChartTooltip
                  cursor={{ fill: 'var(--muted)', stroke: 'var(--border)' }}
                  isAnimationActive={false}
                  content={<PanelTooltip rows={rows} weeks={weeks} keys={keys} />}
               />
               <ReferenceLine x={cursorWeek} stroke="var(--foreground)" />
               {children}
            </ComposedChart>
         </ChartContainer>
      </figure>
   )
}

function readout(row: WeekRow, key: SeriesKey) {
   switch (key) {
      case 'score':
         return formatScore(row.score)
      case 'additions':
         return formatAdded(row.additions)
      case 'deletions':
         return formatRemoved(row.deletions)
      default:
         return formatNumber(row[key as 'commits' | 'pullsOpened' | 'pullsMerged'])
   }
}

function PanelTooltip({
   active,
   label,
   rows,
   weeks,
   keys,
}: {
   active?: boolean
   label?: string | number
   rows: WeekRow[]
   weeks: WeekLabel[]
   keys: SeriesKey[]
}) {
   const row = rows[Number(label)]
   if (!active || !row) {
      return null
   }
   return (
      <div className="grid min-w-40 gap-1.5 rounded-lg border border-border/60 bg-popover px-2.5 py-2 text-xs text-popover-foreground shadow-lg">
         <div className="font-medium">{weeks[row.week].range}</div>
         {keys.map((key) => (
            <div key={key} className="flex items-center gap-2 leading-none">
               <span
                  className="h-0.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: chartConfig[key].color }}
               />
               <span className="text-muted-foreground">
                  {chartConfig[key].label}
               </span>
               <span className="ml-auto font-medium tabular-nums">
                  {readout(row, key)}
               </span>
            </div>
         ))}
      </div>
   )
}

function WeekTable({
   rows,
   weeks,
   hasLineStats,
}: {
   rows: WeekRow[]
   weeks: WeekLabel[]
   hasLineStats: boolean
}) {
   return (
      <div className="max-h-[32rem] overflow-auto rounded-lg border">
         <table className="w-full text-xs tabular-nums">
            <thead className="sticky top-0 bg-muted text-muted-foreground">
               <tr className="[&>th]:px-2.5 [&>th]:py-2 [&>th]:text-right [&>th]:font-medium [&>th:first-child]:text-left">
                  <th scope="col">Week</th>
                  <th scope="col">Score</th>
                  <th scope="col">Commits</th>
                  {hasLineStats && <th scope="col">Added</th>}
                  {hasLineStats && <th scope="col">Removed</th>}
                  <th scope="col">PRs opened</th>
                  <th scope="col">PRs merged</th>
               </tr>
            </thead>
            <tbody>
               {[...rows].reverse().map((row) => (
                  <tr
                     key={row.week}
                     className="border-t [&>td]:px-2.5 [&>td]:py-1.5 [&>td]:text-right [&>td:first-child]:text-left"
                  >
                     <td className="whitespace-nowrap">{weeks[row.week].range}</td>
                     <td>{formatScore(row.score)}</td>
                     <td>{formatNumber(row.commits)}</td>
                     {hasLineStats && <td>{formatAdded(row.additions)}</td>}
                     {hasLineStats && <td>{formatRemoved(row.deletions)}</td>}
                     <td>{formatNumber(row.pullsOpened)}</td>
                     <td>{formatNumber(row.pullsMerged)}</td>
                  </tr>
               ))}
            </tbody>
         </table>
      </div>
   )
}
