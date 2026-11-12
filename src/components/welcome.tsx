import { ConnectForm, type ConnectionInput } from "@/components/connect-form"
import { Logo } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"

const PREVIEW_ROWS = [
  { name: "storefront", share: 1, seed: 7 },
  { name: "billing-api", share: 0.72, seed: 19 },
  { name: "design-tokens", share: 0.46, seed: 31 },
  { name: "infra", share: 0.3, seed: 43 },
  { name: "docs", share: 0.14, seed: 59 },
]

const PREVIEW_WEEKS = 30

function previewBars(seed: number, share: number) {
  return Array.from({ length: PREVIEW_WEEKS }, (_, week) => {
    const wave = Math.sin((week + seed) * 0.55) + Math.sin((week * seed) % 5)
    const recency = 0.35 + (0.65 * week) / PREVIEW_WEEKS
    return Math.max(0, (wave + 1.2) / 3.2) * recency * (0.4 + 0.6 * share)
  })
}

export function Welcome({
  onConnect,
}: {
  onConnect: (connection: ConnectionInput) => void
}) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2.5 px-4 sm:px-6">
        <Logo className="size-6" />
        <span className="font-semibold tracking-tight">Repo Activity</span>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-16">
        <div className="grid gap-8">
          <div className="grid gap-3">
            <h1 className="text-4xl font-semibold tracking-tight text-balance">
              See which repositories you are actually working on
            </h1>
            <p className="text-base leading-relaxed text-muted-foreground">
              Every repository you own, ranked by recent commits, line changes
              and pull requests. Drag the date back to see what had your
              attention last month, or last spring.
            </p>
          </div>
          <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
            <ConnectForm
              initial={{ login: "", token: "" }}
              submitLabel="Show activity"
              onSubmit={onConnect}
            />
          </div>
        </div>

        <Preview />
      </main>
    </div>
  )
}

function Preview() {
  return (
    <div
      className="hidden rounded-2xl bg-card p-2 shadow-xl ring-1 shadow-foreground/5 ring-foreground/10 lg:block"
      aria-hidden
    >
      {PREVIEW_ROWS.map((row, index) => (
        <div
          key={row.name}
          className="grid grid-cols-[1.5rem_8rem_minmax(0,1fr)_4.5rem] items-center gap-4 border-t border-border/60 px-4 py-4 first:border-t-0"
        >
          <span className="text-center text-base font-semibold text-muted-foreground tabular-nums">
            {index + 1}
          </span>
          <span className="truncate text-sm font-medium">{row.name}</span>
          <div className="flex h-9 items-end gap-0.5">
            {previewBars(row.seed, row.share).map((height, week) => (
              <span
                key={week}
                className="flex-1 rounded-t-[2px] bg-viz-commits"
                style={{ height: `${Math.max(4, height * 100)}%` }}
              />
            ))}
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-viz-accent-soft">
            <div
              className="h-full rounded-full bg-viz-accent"
              style={{ width: `${row.share * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
