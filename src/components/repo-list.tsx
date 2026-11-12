import { ChevronDownIcon, SearchIcon } from "lucide-react"
import { useMemo, useState } from "react"

import { RepoFlags, RepoRow, ROW_GRID } from "@/components/repo-row"
import { Input } from "@/components/ui/input"
import { TRAILING_DAYS, type RankedRepo, type Ranking } from "@/lib/activity"
import { formatDuration } from "@/lib/format"
import type { WeekLabel } from "@/lib/weeks"

interface RepoListProps {
  ranking: Ranking
  weeks: WeekLabel[]
  hasLineStats: boolean
  loading: boolean
  onOpen: (repoId: string) => void
  onHover: (repoId: string | null) => void
}

function matches(item: RankedRepo, query: string) {
  const { repo } = item.series
  const text = `${repo.name} ${repo.description ?? ""} ${repo.language?.name ?? ""}`
  return text.toLowerCase().includes(query)
}

export function RepoList({
  ranking,
  weeks,
  hasLineStats,
  loading,
  onOpen,
  onHover,
}: RepoListProps) {
  const [query, setQuery] = useState("")
  const [showQuiet, setShowQuiet] = useState(false)
  const needle = query.trim().toLowerCase()

  const active = useMemo(
    () => ranking.active.filter((item) => matches(item, needle)),
    [ranking.active, needle]
  )
  const quiet = useMemo(
    () => ranking.quiet.filter((item) => matches(item, needle)),
    [ranking.quiet, needle]
  )

  return (
    <section className="grid grid-cols-1 gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Most active repositories</h2>
          <p className="text-sm text-muted-foreground">
            {ranking.active.length} active on this date, ranked by activity
            score. Commits, lines and merged PRs cover the {TRAILING_DAYS} days
            before it.
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter repositories"
            aria-label="Filter repositories"
            className="pl-8"
          />
        </div>
      </div>

      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <ListHeader hasLineStats={hasLineStats} />
        {active.length > 0 ? (
          <ul>
            {active.map((item) => (
              <RepoRow
                key={item.series.repo.id}
                item={item}
                weeks={weeks}
                hasLineStats={hasLineStats}
                onOpen={onOpen}
                onHover={onHover}
              />
            ))}
          </ul>
        ) : (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            {loading
              ? "Loading activity…"
              : needle
                ? "No active repository matches this filter."
                : "Nothing was active around this date."}
          </p>
        )}
      </div>

      {quiet.length > 0 && (
        <div>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md py-1 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            aria-expanded={showQuiet}
            onClick={() => setShowQuiet((open) => !open)}
          >
            <ChevronDownIcon
              className={`size-4 transition-transform ${showQuiet ? "" : "-rotate-90"}`}
            />
            {quiet.length} quiet on this date
          </button>
          {showQuiet && (
            <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {quiet.map((item) => (
                <QuietRepo
                  key={item.series.repo.id}
                  item={item}
                  onOpen={onOpen}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

function ListHeader({ hasLineStats }: { hasLineStats: boolean }) {
  const legend = (
    <>
      <span>Per week, last 52 weeks</span>
      <Legend mark="bg-viz-commits" label="Commits" />
      {hasLineStats && (
        <>
          <Legend mark="bg-viz-additions" label="Lines added" />
          <Legend mark="bg-viz-deletions" label="Lines removed" />
        </>
      )}
      <Legend mark="bg-viz-pulls" label="PRs merged" />
    </>
  )
  return (
    <div className="border-b border-border/60 px-4 py-2.5 text-xs text-muted-foreground">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 lg:hidden">
        {legend}
      </div>
      <div className={`${ROW_GRID} hidden lg:grid`}>
        <span className="text-center">#</span>
        <span>Repository</span>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {legend}
        </div>
        <span className="text-right">Commits</span>
        <span className="text-right">Lines</span>
        <span className="text-right">PRs</span>
        <span className="text-right">Score</span>
      </div>
    </div>
  )
}

function Legend({ mark, label }: { mark: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-2 rounded-[2px] ${mark}`} />
      {label}
    </span>
  )
}

function QuietRepo({
  item,
  onOpen,
}: {
  item: RankedRepo
  onOpen: (repoId: string) => void
}) {
  const { repo } = item.series
  const status = !repo.loaded
    ? "Not loaded"
    : item.idleDays === null
      ? "No activity in the last 15 months"
      : item.idleDays === 0
        ? "Active on this date"
        : `Idle for ${formatDuration(item.idleDays)}`
  return (
    <li>
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-lg bg-card px-3 py-2 text-left text-sm ring-1 ring-foreground/10 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => onOpen(repo.id)}
      >
        <span className="truncate font-medium">{repo.name}</span>
        <RepoFlags repo={repo} />
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
          {status}
        </span>
      </button>
    </li>
  )
}
