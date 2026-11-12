import { ArrowDownIcon, ArrowUpIcon } from "lucide-react"

import { TRAILING_DAYS, type Totals } from "@/lib/activity"
import {
  formatAdded,
  formatChange,
  formatNumber,
  formatRemoved,
} from "@/lib/format"

interface StatTilesProps {
  totals: Totals
  hasLineStats: boolean
}

export function StatTiles({ totals, hasLineStats }: StatTilesProps) {
  const { current, previous } = totals
  const lines = current.additions + current.deletions
  const previousLines = previous.additions + previous.deletions

  return (
    <section
      aria-label={`Totals for the ${TRAILING_DAYS} days before the date`}
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label="Active repositories"
          value={formatNumber(totals.activeRepos)}
          current={totals.activeRepos}
          previous={totals.previousActiveRepos}
        />
        <Tile
          label="Commits"
          value={formatNumber(current.commits)}
          current={current.commits}
          previous={previous.commits}
        />
        {hasLineStats ? (
          <Tile
            label="Lines changed"
            value={formatNumber(lines)}
            current={lines}
            previous={previousLines}
            detail={
              <span className="flex items-center gap-2.5 tabular-nums">
                <Marked
                  mark="bg-viz-additions"
                  text={formatAdded(current.additions)}
                />
                <Marked
                  mark="bg-viz-deletions"
                  text={formatRemoved(current.deletions)}
                />
              </span>
            }
          />
        ) : (
          <Tile
            label="Pull requests opened"
            value={formatNumber(current.pullsOpened)}
            current={current.pullsOpened}
            previous={previous.pullsOpened}
          />
        )}
        <Tile
          label="Pull requests merged"
          value={formatNumber(current.pullsMerged)}
          current={current.pullsMerged}
          previous={previous.pullsMerged}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Totals for the {TRAILING_DAYS} days before the selected date, compared
        with the {TRAILING_DAYS} days before that.
      </p>
    </section>
  )
}

function Marked({ mark, text }: { mark: string; text: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`size-1.5 rounded-[2px] ${mark}`} />
      {text}
    </span>
  )
}

function Tile({
  label,
  value,
  current,
  previous,
  detail,
}: {
  label: string
  value: string
  current: number
  previous: number
  detail?: React.ReactNode
}) {
  const change = formatChange(current, previous)
  const Arrow =
    current > previous ? ArrowUpIcon : current < previous ? ArrowDownIcon : null

  return (
    <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-0.5">
          {Arrow && <Arrow className="size-3" />}
          {change}
        </span>
        {detail}
      </div>
    </div>
  )
}
