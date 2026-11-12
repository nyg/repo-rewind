import { describe, expect, it } from "vitest"

import {
  DISPLAY_WEEKS,
  buildRepoSeries,
  commitPoints,
  createTimeline,
  dayIndex,
  dayStart,
  decayedScore,
  lastDay,
  rankAt,
  totalsAt,
  trailing,
  weeklyOverview,
  type SeriesOptions,
} from "./activity"
import type { Actor, CommitEvent, PullEvent, Repo } from "./github/types"

const NOW = new Date(2026, 10, 12, 15, 30).getTime()
const timeline = createTimeline(NOW)
const today = lastDay(timeline)

const options: SeriesOptions = {
  timeline,
  actors: new Set<Actor>(["you", "agent"]),
  halfLife: 14,
  hasLineStats: true,
}

function daysAgo(days: number) {
  return dayStart(timeline, today - days) + 12 * 3_600_000
}

function commit(ago: number, lines = 0, actor: Actor = "you"): CommitEvent {
  return { at: daysAgo(ago), additions: lines, deletions: 0, actor }
}

function pull(
  openedAgo: number,
  mergedAgo: number | null,
  actor: Actor = "you"
): PullEvent {
  return {
    createdAt: daysAgo(openedAgo),
    mergedAt: mergedAgo === null ? null : daysAgo(mergedAgo),
    closedAt: mergedAgo === null ? null : daysAgo(mergedAgo),
    actor,
  }
}

function repo(
  name: string,
  commits: CommitEvent[],
  pulls: PullEvent[] = []
): Repo {
  return {
    id: name,
    name,
    nameWithOwner: `me/${name}`,
    description: null,
    url: `https://github.com/me/${name}`,
    isPrivate: false,
    isFork: false,
    isArchived: false,
    stars: 0,
    pushedAt: NOW,
    language: null,
    signature: name,
    commits,
    pulls,
    loaded: true,
    truncated: false,
    error: null,
  }
}

describe("timeline", () => {
  it("puts the current moment on the last day", () => {
    // When
    const index = dayIndex(timeline, NOW)

    // Then
    expect(index).toBe(today)
  })

  it("indexes each earlier day one step back across daylight-saving changes", () => {
    // When
    const indexes = [1, 30, 200, 400].map((ago) =>
      dayIndex(timeline, daysAgo(ago))
    )

    // Then
    expect(indexes).toEqual([today - 1, today - 30, today - 200, today - 400])
  })
})

describe("commitPoints", () => {
  it("gives one point to an empty commit and caps large ones at two", () => {
    // When
    const points = [0, 999, 500_000].map((lines) => commitPoints(lines, true))

    // Then
    expect(points).toEqual([1, 2, 2])
  })

  it("gives every commit one point when line stats are unavailable", () => {
    // When
    const points = commitPoints(5_000, false)

    // Then
    expect(points).toBe(1)
  })
})

describe("decayedScore", () => {
  it("halves a burst of activity after one half-life", () => {
    // Given
    const points = new Float64Array(30)
    points[0] = 8

    // When
    const score = decayedScore(points, 7)

    // Then
    expect(score[0]).toBe(8)
    expect(score[7]).toBeCloseTo(4)
    expect(score[14]).toBeCloseTo(2)
  })
})

describe("buildRepoSeries", () => {
  it("counts only events from the selected actors", () => {
    // Given
    const subject = repo(
      "app",
      [commit(1, 10), commit(1, 20, "automation"), commit(2, 0, "agent")],
      [pull(3, 2), pull(3, 2, "automation")]
    )

    // When
    const series = buildRepoSeries(subject, options)

    // Then
    expect(trailing(series, today)).toEqual({
      commits: 2,
      additions: 10,
      deletions: 0,
      pullsOpened: 1,
      pullsMerged: 1,
    })
    expect(series.commitsByActor).toEqual({
      you: 1,
      agent: 1,
      automation: 1,
      other: 0,
    })
  })

  it("groups the displayed year into 52 weeks ending today", () => {
    // Given
    const subject = repo("app", [commit(0), commit(6), commit(7), commit(363)])

    // When
    const { weekly } = buildRepoSeries(subject, options)

    // Then
    expect(weekly.commits).toHaveLength(DISPLAY_WEEKS)
    expect(weekly.commits[DISPLAY_WEEKS - 1]).toBe(2)
    expect(weekly.commits[DISPLAY_WEEKS - 2]).toBe(1)
    expect(weekly.commits[0]).toBe(1)
  })

  it("scores an open and a merged pull request on their own days", () => {
    // Given
    const subject = repo("app", [], [pull(10, 4)])

    // When
    const { points } = buildRepoSeries(subject, options)

    // Then
    expect(points[today - 10]).toBe(1)
    expect(points[today - 4]).toBe(1)
  })
})

describe("rankAt", () => {
  const steady = repo("steady", [commit(40), commit(41), commit(42)])
  const recent = repo("recent", [commit(1), commit(2)])
  const silent = repo("silent", [])
  const allSeries = [steady, recent, silent].map((subject) =>
    buildRepoSeries(subject, options)
  )

  it("ranks the most recently active repository first today", () => {
    // When
    const ranking = rankAt(allSeries, today)

    // Then
    expect(ranking.active.map((item) => item.series.repo.name)).toEqual([
      "recent",
      "steady",
    ])
    expect(ranking.quiet.map((item) => item.series.repo.name)).toEqual([
      "silent",
    ])
    expect(ranking.active[0].share).toBe(1)
  })

  it("ranks by the activity known on an earlier date", () => {
    // When
    const ranking = rankAt(allSeries, today - 30)

    // Then
    expect(ranking.active.map((item) => item.series.repo.name)).toEqual([
      "steady",
    ])
  })

  it("reports the rank a repository held a week earlier", () => {
    // When
    const [first, second] = rankAt(allSeries, today).active

    // Then
    expect(first.previousRank).toBeNull()
    expect(second.previousRank).toBe(1)
    expect(second.idleDays).toBe(40)
  })
})

describe("totals", () => {
  const allSeries = [
    repo("a", [commit(3, 5), commit(40, 7)], [pull(5, 4)]),
    repo("b", [commit(35)]),
  ].map((subject) => buildRepoSeries(subject, options))

  it("compares the trailing 30 days with the 30 days before", () => {
    // When
    const totals = totalsAt(allSeries, today)

    // Then
    expect(totals.current.commits).toBe(1)
    expect(totals.previous.commits).toBe(2)
    expect(totals.current.pullsMerged).toBe(1)
    expect(totals.activeRepos).toBe(1)
    expect(totals.previousActiveRepos).toBe(2)
  })

  it("lists the busiest repositories of each week", () => {
    // When
    const overview = weeklyOverview(allSeries)

    // Then
    expect(overview[DISPLAY_WEEKS - 1].values.commits).toBe(1)
    expect(overview[DISPLAY_WEEKS - 1].top).toEqual([{ name: "a", commits: 1 }])
  })
})
