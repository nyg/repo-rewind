import { KeyRoundIcon, TriangleAlertIcon } from "lucide-react"
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react"

import { AppHeader } from "@/components/app-header"
import type { ConnectionInput } from "@/components/connect-form"
import { DateToolbar } from "@/components/date-toolbar"
import { RepoList } from "@/components/repo-list"
import { RepoSheet } from "@/components/repo-sheet"
import { StatTiles } from "@/components/stat-tiles"
import { TimelineCard } from "@/components/timeline-card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useDataset } from "@/hooks/use-dataset"
import {
  buildRepoSeries,
  createTimeline,
  dayStart,
  lastDay,
  rankAt,
  totalsAt,
  weeklyOverview,
} from "@/lib/activity"
import { formatClock } from "@/lib/format"
import { PUBLIC_REPO_LIMIT } from "@/lib/github/rest"
import { GitHubError, type Dataset } from "@/lib/github/types"
import type { Settings } from "@/lib/storage"
import { cursorFraction, weekLabels } from "@/lib/weeks"

const PLAY_INTERVAL_MS = 45

interface DashboardProps {
  settings: Settings
  now: number
  onSettingsChange: (patch: Partial<Settings>) => void
  onDisconnect: () => void
}

export function Dashboard({
  settings,
  now,
  onSettingsChange,
  onDisconnect,
}: DashboardProps) {
  const timeline = useMemo(() => createTimeline(now), [now])
  const today = lastDay(timeline)
  const onLogin = useCallback(
    (login: string) => onSettingsChange({ login }),
    [onSettingsChange]
  )
  const { dataset, loading, progress, error, refresh } = useDataset({
    token: settings.token,
    login: settings.login,
    since: timeline.start,
    onLogin,
  })

  const [day, setDay] = useState(today)
  const [playing, setPlaying] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const dayRef = useRef(day)
  const rankedDay = useDeferredValue(day)

  const moveTo = useCallback((next: number) => {
    dayRef.current = next
    setDay(next)
  }, [])

  useEffect(() => {
    if (!playing) {
      return undefined
    }
    const timer = window.setInterval(() => {
      const next = Math.min(today, dayRef.current + 1)
      moveTo(next)
      if (next >= today) {
        setPlaying(false)
      }
    }, PLAY_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [playing, today, moveTo])

  function togglePlay() {
    if (!playing && day >= today) {
      moveTo(timeline.firstDisplayDay)
    }
    setPlaying(!playing)
  }

  const weeks = useMemo(() => weekLabels(timeline), [timeline])
  const hasLineStats = dataset?.hasLineStats ?? true
  const allSeries = useMemo(() => {
    if (!dataset) {
      return []
    }
    const options = {
      timeline,
      actors: new Set(settings.actors),
      halfLife: settings.halfLife,
      hasLineStats: dataset.hasLineStats,
    }
    return dataset.repos.map((repo) => buildRepoSeries(repo, options))
  }, [dataset, timeline, settings.actors, settings.halfLife])

  const ranking = useMemo(
    () => rankAt(allSeries, rankedDay),
    [allSeries, rankedDay]
  )
  const totals = useMemo(
    () => totalsAt(allSeries, rankedDay),
    [allSeries, rankedDay]
  )
  const overview = useMemo(() => weeklyOverview(allSeries), [allSeries])

  const focusId = openId ?? hoveredId
  const focus = useMemo(
    () => allSeries.find((series) => series.repo.id === focusId) ?? null,
    [allSeries, focusId]
  )
  const opened = useMemo(
    () =>
      [...ranking.active, ...ranking.quiet].find(
        (item) => item.series.repo.id === openId
      ) ?? null,
    [ranking, openId]
  )

  const connection: ConnectionInput = {
    login: settings.login,
    token: settings.token,
  }
  const cursorStyle = {
    "--cursor": cursorFraction(timeline, day),
  } as CSSProperties

  return (
    <div className="min-h-svh" style={cursorStyle}>
      <AppHeader
        dataset={dataset}
        connection={connection}
        loading={loading}
        progress={progress}
        onRefresh={refresh}
        onConnect={onSettingsChange}
        onDisconnect={onDisconnect}
      />
      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 sm:py-8">
        {error && <LoadError error={error} onRetry={refresh} />}
        {dataset ? (
          <>
            {dataset.mode === "public" && !loading && (
              <PublicNotice dataset={dataset} />
            )}
            <DateToolbar
              date={dayStart(timeline, day)}
              daysBack={today - day}
              playing={playing}
              halfLife={settings.halfLife}
              actors={settings.actors}
              hasLineStats={hasLineStats}
              onTogglePlay={togglePlay}
              onToday={() => {
                setPlaying(false)
                moveTo(today)
              }}
              onHalfLifeChange={(halfLife) => onSettingsChange({ halfLife })}
              onActorsChange={(actors) => onSettingsChange({ actors })}
            />
            <TimelineCard
              overview={overview}
              weeks={weeks}
              timeline={timeline}
              day={day}
              focus={focus}
              hasLineStats={hasLineStats}
              onDayChange={(next) => {
                setPlaying(false)
                moveTo(next)
              }}
            />
            <StatTiles totals={totals} hasLineStats={hasLineStats} />
            <RepoList
              ranking={ranking}
              weeks={weeks}
              hasLineStats={hasLineStats}
              loading={loading}
              onOpen={setOpenId}
              onHover={setHoveredId}
            />
            <RepoSheet
              item={opened}
              weeks={weeks}
              timeline={timeline}
              day={day}
              hasLineStats={hasLineStats}
              onClose={() => setOpenId(null)}
            />
          </>
        ) : (
          loading && <LoadingPlaceholder />
        )}
      </main>
    </div>
  )
}

function LoadingPlaceholder() {
  return (
    <div className="grid gap-6" aria-busy>
      <div className="grid gap-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-10 w-80 max-w-full" />
      </div>
      <Skeleton className="h-56 rounded-xl" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  )
}

function PublicNotice({ dataset }: { dataset: Dataset }) {
  const skipped = dataset.repos.filter((repo) => !repo.loaded).length
  return (
    <Alert>
      <KeyRoundIcon />
      <AlertTitle>Public data only</AlertTitle>
      <AlertDescription>
        Showing up to {PUBLIC_REPO_LIMIT} recently pushed public repositories,
        without line counts
        {skipped > 0 ? `; ${skipped} more were not loaded` : ""}. Add an access
        token from the account menu to see everything, private repositories
        included.
      </AlertDescription>
    </Alert>
  )
}

function describeError(error: Error) {
  if (!(error instanceof GitHubError)) {
    return error.message
  }
  switch (error.kind) {
    case "auth":
      return "GitHub rejected the access token. It may have expired or been revoked: set a new one from the account menu."
    case "rate-limit":
      return error.resetAt
        ? `${error.message} It resets at ${formatClock(error.resetAt)}.`
        : error.message
    default:
      return error.message
  }
}

function LoadError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <Alert variant="destructive">
      <TriangleAlertIcon />
      <AlertTitle>Could not load from GitHub</AlertTitle>
      <AlertDescription>
        <p>{describeError(error)}</p>
        <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
          Try again
        </Button>
      </AlertDescription>
    </Alert>
  )
}
