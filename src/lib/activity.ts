import { type Actor, ACTORS, type Repo } from './github/types'

export const DAY_MS = 86_400_000
export const WEEK_DAYS = 7
export const DISPLAY_WEEKS = 52
export const DISPLAY_DAYS = DISPLAY_WEEKS * WEEK_DAYS
export const WARMUP_DAYS = 92
export const FETCH_DAYS = DISPLAY_DAYS + WARMUP_DAYS
export const TRAILING_DAYS = 30
export const RANK_LOOKBACK_DAYS = 7
export const HALF_LIVES = [7, 14, 30] as const
export const ACTIVE_SCORE = 0.25

export const PULL_OPENED_POINTS = 1
export const PULL_MERGED_POINTS = 1

export type HalfLife = (typeof HALF_LIVES)[number]

export const METRICS = [
   'commits',
   'additions',
   'deletions',
   'pullsOpened',
   'pullsMerged',
] as const

export type Metric = (typeof METRICS)[number]

export type MetricValues = Record<Metric, number>

export interface Timeline {
   start: number
   days: number
   firstDisplayDay: number
}

export function startOfLocalDay(timestamp: number) {
   const date = new Date(timestamp)
   date.setHours(0, 0, 0, 0)
   return date.getTime()
}

export function addDays(dayStart: number, days: number) {
   const date = new Date(dayStart)
   date.setDate(date.getDate() + days)
   return date.getTime()
}

export function createTimeline(now: number): Timeline {
   return {
      start: addDays(startOfLocalDay(now), -(FETCH_DAYS - 1)),
      days: FETCH_DAYS,
      firstDisplayDay: FETCH_DAYS - DISPLAY_DAYS,
   }
}

export function lastDay(timeline: Timeline) {
   return timeline.days - 1
}

export function dayIndex(timeline: Timeline, timestamp: number) {
   // Rounding absorbs the 23h and 25h days around daylight-saving changes.
   return Math.round((startOfLocalDay(timestamp) - timeline.start) / DAY_MS)
}

export function dayStart(timeline: Timeline, day: number) {
   return addDays(timeline.start, day)
}

export function weekOfDay(timeline: Timeline, day: number) {
   return Math.floor((day - timeline.firstDisplayDay) / WEEK_DAYS)
}

export function weekStartDay(timeline: Timeline, week: number) {
   return timeline.firstDisplayDay + week * WEEK_DAYS
}

export function commitPoints(linesChanged: number, hasLineStats: boolean) {
   if (!hasLineStats) {
      return 1
   }
   return 1 + Math.min(1, Math.log10(1 + linesChanged) / 3)
}

export interface RepoSeries {
   repo: Repo
   daily: Record<Metric, Float64Array>
   cumulative: Record<Metric, Float64Array>
   weekly: Record<Metric, number[]>
   points: Float64Array
   score: Float64Array
   lastActiveDay: Int32Array
   totals: MetricValues
   commitsByActor: Record<Actor, number>
}

export interface SeriesOptions {
   timeline: Timeline
   actors: ReadonlySet<Actor>
   halfLife: number
   hasLineStats: boolean
}

export function buildRepoSeries(
   repo: Repo,
   options: SeriesOptions
): RepoSeries {
   const { timeline, actors, halfLife, hasLineStats } = options
   const { days } = timeline
   const daily = emptyDaily(days)
   const points = new Float64Array(days)
   const commitsByActor = Object.fromEntries(
      ACTORS.map((actor) => [actor, 0])
   ) as Record<Actor, number>

   for (const commit of repo.commits) {
      const day = dayIndex(timeline, commit.at)
      if (day < 0 || day >= days) {
         continue
      }
      if (day >= timeline.firstDisplayDay) {
         commitsByActor[commit.actor] += 1
      }
      if (!actors.has(commit.actor)) {
         continue
      }
      daily.commits[day] += 1
      daily.additions[day] += commit.additions
      daily.deletions[day] += commit.deletions
      points[day] += commitPoints(
         commit.additions + commit.deletions,
         hasLineStats
      )
   }

   for (const pull of repo.pulls) {
      if (!actors.has(pull.actor)) {
         continue
      }
      const opened = dayIndex(timeline, pull.createdAt)
      if (opened >= 0 && opened < days) {
         daily.pullsOpened[opened] += 1
         points[opened] += PULL_OPENED_POINTS
      }
      if (pull.mergedAt !== null) {
         const merged = dayIndex(timeline, pull.mergedAt)
         if (merged >= 0 && merged < days) {
            daily.pullsMerged[merged] += 1
            points[merged] += PULL_MERGED_POINTS
         }
      }
   }

   const cumulative = mapMetrics((metric) => prefixSums(daily[metric]))
   const weekly = mapMetrics((metric) =>
      weeklySums(cumulative[metric], timeline)
   )
   const totals = mapMetrics(
      (metric) =>
         cumulative[metric][days] - cumulative[metric][timeline.firstDisplayDay]
   )

   return {
      repo,
      daily,
      cumulative,
      weekly,
      points,
      score: decayedScore(points, halfLife),
      lastActiveDay: lastActiveDays(points),
      totals,
      commitsByActor,
   }
}

function emptyDaily(days: number) {
   return mapMetrics(() => new Float64Array(days))
}

function mapMetrics<T>(build: (metric: Metric) => T) {
   return Object.fromEntries(
      METRICS.map((metric) => [metric, build(metric)])
   ) as Record<Metric, T>
}

function prefixSums(values: Float64Array) {
   const sums = new Float64Array(values.length + 1)
   for (let i = 0; i < values.length; i += 1) {
      sums[i + 1] = sums[i] + values[i]
   }
   return sums
}

function weeklySums(cumulative: Float64Array, timeline: Timeline) {
   return Array.from({ length: DISPLAY_WEEKS }, (_, week) => {
      const from = weekStartDay(timeline, week)
      return cumulative[from + WEEK_DAYS] - cumulative[from]
   })
}

export function decayedScore(points: Float64Array, halfLife: number) {
   const keep = Math.pow(0.5, 1 / halfLife)
   const score = new Float64Array(points.length)
   let running = 0
   for (let day = 0; day < points.length; day += 1) {
      running = running * keep + points[day]
      score[day] = running
   }
   return score
}

function lastActiveDays(points: Float64Array) {
   const last = new Int32Array(points.length)
   let latest = -1
   for (let day = 0; day < points.length; day += 1) {
      if (points[day] > 0) {
         latest = day
      }
      last[day] = latest
   }
   return last
}

export function sumBetween(
   series: RepoSeries,
   metric: Metric,
   fromDay: number,
   toDay: number
) {
   const cumulative = series.cumulative[metric]
   const from = Math.max(0, fromDay)
   const to = Math.min(cumulative.length - 1, toDay + 1)
   return to > from ? cumulative[to] - cumulative[from] : 0
}

export function trailing(
   series: RepoSeries,
   day: number,
   windowDays = TRAILING_DAYS
): MetricValues {
   return mapMetrics((metric) =>
      sumBetween(series, metric, day - windowDays + 1, day)
   )
}

export interface RankedRepo {
   series: RepoSeries
   score: number
   rank: number
   previousRank: number | null
   share: number
   recent: MetricValues
   idleDays: number | null
}

export interface Ranking {
   active: RankedRepo[]
   quiet: RankedRepo[]
   topScore: number
}

export function rankAt(allSeries: RepoSeries[], day: number): Ranking {
   const previous = positions(allSeries, day - RANK_LOOKBACK_DAYS)
   const ordered = [...allSeries].sort((a, b) => compareAt(a, b, day))
   const topScore = ordered.length > 0 ? ordered[0].score[day] : 0

   const ranked = ordered.map((series, index): RankedRepo => {
      const score = series.score[day]
      const lastActive = series.lastActiveDay[day]
      return {
         series,
         score,
         rank: index + 1,
         previousRank: previous.get(series.repo.id) ?? null,
         share: topScore > 0 ? score / topScore : 0,
         recent: trailing(series, day),
         idleDays: lastActive < 0 ? null : day - lastActive,
      }
   })

   return {
      active: ranked.filter((item) => item.score >= ACTIVE_SCORE),
      quiet: ranked.filter((item) => item.score < ACTIVE_SCORE),
      topScore,
   }
}

function compareAt(a: RepoSeries, b: RepoSeries, day: number) {
   return (
      b.score[day] - a.score[day] ||
      b.lastActiveDay[day] - a.lastActiveDay[day] ||
      a.repo.name.localeCompare(b.repo.name)
   )
}

function positions(allSeries: RepoSeries[], day: number) {
   const ranks = new Map<string, number>()
   if (day < 0) {
      return ranks
   }
   const ordered = allSeries
      .filter((series) => series.score[day] >= ACTIVE_SCORE)
      .sort((a, b) => compareAt(a, b, day))
   ordered.forEach((series, index) => ranks.set(series.repo.id, index + 1))
   return ranks
}

export interface Totals {
   current: MetricValues
   previous: MetricValues
   activeRepos: number
   previousActiveRepos: number
}

export function totalsAt(allSeries: RepoSeries[], day: number): Totals {
   const sumWindow = (endDay: number) =>
      mapMetrics((metric) =>
         allSeries.reduce(
            (sum, series) =>
               sum + sumBetween(series, metric, endDay - TRAILING_DAYS + 1, endDay),
            0
         )
      )
   const activeIn = (endDay: number) =>
      allSeries.filter((series) => {
         const lastActive = endDay >= 0 ? series.lastActiveDay[endDay] : -1
         return lastActive >= 0 && lastActive > endDay - TRAILING_DAYS
      }).length

   return {
      current: sumWindow(day),
      previous: sumWindow(day - TRAILING_DAYS),
      activeRepos: activeIn(day),
      previousActiveRepos: activeIn(day - TRAILING_DAYS),
   }
}

export interface WeekOverview {
   week: number
   values: MetricValues
   top: { name: string, commits: number }[]
}

export function weeklyOverview(allSeries: RepoSeries[]): WeekOverview[] {
   return Array.from({ length: DISPLAY_WEEKS }, (_, week) => ({
      week,
      values: mapMetrics((metric) =>
         allSeries.reduce((sum, series) => sum + series.weekly[metric][week], 0)
      ),
      top: allSeries
         .map((series) => ({
            name: series.repo.name,
            commits: series.weekly.commits[week],
         }))
         .filter((entry) => entry.commits > 0)
         .sort((a, b) => b.commits - a.commits)
         .slice(0, 3),
   }))
}
