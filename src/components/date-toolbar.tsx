import {
  ChevronDownIcon,
  InfoIcon,
  PauseIcon,
  PlayIcon,
  SkipForwardIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  HALF_LIVES,
  PULL_MERGED_POINTS,
  PULL_OPENED_POINTS,
  type HalfLife,
} from "@/lib/activity"
import { formatDaysAgo, formatLongDate } from "@/lib/format"
import { ACTORS, type Actor } from "@/lib/github/types"

const ACTOR_LABELS: Record<Actor, { name: string; hint: string }> = {
  you: { name: "You", hint: "Commits and PRs you authored" },
  agent: { name: "AI agents", hint: "Copilot, Claude, Codex, Cursor…" },
  automation: {
    name: "Automation",
    hint: "Renovate, Dependabot, GitHub Actions…",
  },
  other: { name: "Other people", hint: "Everyone else" },
}

interface DateToolbarProps {
  date: number
  daysBack: number
  playing: boolean
  halfLife: HalfLife
  actors: Actor[]
  hasLineStats: boolean
  onTogglePlay: () => void
  onToday: () => void
  onHalfLifeChange: (halfLife: HalfLife) => void
  onActorsChange: (actors: Actor[]) => void
}

export function DateToolbar({
  date,
  daysBack,
  playing,
  halfLife,
  actors,
  hasLineStats,
  onTogglePlay,
  onToday,
  onHalfLifeChange,
  onActorsChange,
}: DateToolbarProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div>
        <p className="text-sm text-muted-foreground">Activity as of</p>
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {formatLongDate(date)}
          </h1>
          <span className="text-sm text-muted-foreground">
            {formatDaysAgo(daysBack)}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <AuthorFilter actors={actors} onChange={onActorsChange} />
        <div className="flex items-center gap-1 rounded-lg border bg-card py-0.5 pr-0.5 pl-2.5">
          <span className="text-xs text-muted-foreground">Half-life</span>
          <ScoreInfo halfLife={halfLife} hasLineStats={hasLineStats} />
          <ToggleGroup
            type="single"
            size="sm"
            spacing={0}
            value={String(halfLife)}
            onValueChange={(value) => {
              if (value) {
                onHalfLifeChange(Number(value) as HalfLife)
              }
            }}
            aria-label="Half-life of the activity score"
          >
            {HALF_LIVES.map((days) => (
              <ToggleGroupItem
                key={days}
                value={String(days)}
                className="px-2 tabular-nums"
              >
                {days}d
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <Button variant="outline" onClick={onTogglePlay}>
          {playing ? <PauseIcon /> : <PlayIcon />}
          {playing ? "Pause" : "Replay the year"}
        </Button>
        <Button variant="outline" onClick={onToday} disabled={daysBack === 0}>
          <SkipForwardIcon />
          Today
        </Button>
      </div>
    </div>
  )
}

function AuthorFilter({
  actors,
  onChange,
}: {
  actors: Actor[]
  onChange: (actors: Actor[]) => void
}) {
  const summary =
    actors.length === ACTORS.length
      ? "Everyone"
      : ACTORS.filter((actor) => actors.includes(actor))
          .map((actor) => ACTOR_LABELS[actor].name)
          .join(" + ")

  function toggle(actor: Actor, checked: boolean) {
    const next = checked
      ? [...actors, actor]
      : actors.filter((current) => current !== actor)
    if (next.length > 0) {
      onChange(ACTORS.filter((candidate) => next.includes(candidate)))
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <span className="text-muted-foreground">Work by</span>
          {summary}
          <ChevronDownIcon className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Count activity from</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ACTORS.map((actor) => (
          <DropdownMenuCheckboxItem
            key={actor}
            checked={actors.includes(actor)}
            onCheckedChange={(checked) => toggle(actor, checked)}
            onSelect={(event) => event.preventDefault()}
          >
            <div className="grid">
              <span>{ACTOR_LABELS[actor].name}</span>
              <span className="text-xs text-muted-foreground">
                {ACTOR_LABELS[actor].hint}
              </span>
            </div>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ScoreInfo({
  halfLife,
  hasLineStats,
}: {
  halfLife: HalfLife
  hasLineStats: boolean
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="How the activity score works"
        >
          <InfoIcon className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 text-sm">
        <div className="grid gap-2.5">
          <p className="font-medium">How the activity score works</p>
          <p className="text-muted-foreground">
            Every event adds points on the day it happens. Points then fade:
            after {halfLife} days an event counts for half, after {halfLife * 2}{" "}
            days for a quarter. A repository's score on a date is what remains
            of everything before it.
          </p>
          <ul className="grid gap-1.5">
            <ScoreRule
              points={hasLineStats ? "1–2" : "1"}
              text={
                hasLineStats
                  ? "per commit: larger diffs earn more, up to 2 at 1,000 changed lines"
                  : "per commit"
              }
            />
            <ScoreRule
              points={String(PULL_OPENED_POINTS)}
              text="per pull request opened"
            />
            <ScoreRule
              points={String(PULL_MERGED_POINTS)}
              text="per pull request merged"
            />
          </ul>
          <p className="text-xs text-muted-foreground">
            Only commits on the default branch count. In forks, only the owner's
            commits are fetched. A short half-life favours what is hot right
            now; a long one favours sustained work.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function ScoreRule({ points, text }: { points: string; text: string }) {
  return (
    <li className="flex gap-2">
      <span className="w-8 shrink-0 font-medium tabular-nums">{points}</span>
      <span className="text-muted-foreground">{text}</span>
    </li>
  )
}
