import { ChevronDownIcon, RefreshCwIcon } from "lucide-react"
import { useState } from "react"

import { ConnectForm, type ConnectionInput } from "@/components/connect-form"
import { Logo } from "@/components/logo"
import { SourceLink } from "@/components/source-link"
import { ThemeToggle } from "@/components/theme-toggle"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useNow } from "@/hooks/use-now"
import type { SignIn } from "@/hooks/use-sign-in"
import { formatClock, formatElapsed } from "@/lib/format"
import { isSignInToken } from "@/lib/github/auth"
import type { Dataset, LoadProgress } from "@/lib/github/types"

interface AppHeaderProps {
  dataset: Dataset | null
  connection: ConnectionInput
  loading: boolean
  progress: LoadProgress | null
  signIn: SignIn
  onRefresh: () => void
  onConnect: (connection: ConnectionInput) => void
  onDisconnect: () => void
}

export function AppHeader({
  dataset,
  connection,
  loading,
  progress,
  signIn,
  onRefresh,
  onConnect,
  onDisconnect,
}: AppHeaderProps) {
  const percent =
    progress && progress.total > 0 ? (progress.done / progress.total) * 100 : 0

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2.5 px-4 sm:px-6">
        <Logo className="size-6" />
        <span className="font-semibold tracking-tight">Repo Rewind</span>
        <SourceLink />

        <div className="ml-auto flex items-center gap-1">
          <span
            className="hidden text-xs text-muted-foreground sm:block"
            aria-live="polite"
          >
            <LoadStatus
              dataset={dataset}
              loading={loading}
              progress={progress}
            />
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            disabled={loading}
            aria-label="Refresh from GitHub"
          >
            <RefreshCwIcon className={loading ? "animate-spin" : ""} />
          </Button>
          <ThemeToggle />
          <AccountMenu
            dataset={dataset}
            connection={connection}
            signIn={signIn}
            onConnect={onConnect}
            onDisconnect={onDisconnect}
          />
        </div>
      </div>
      <div
        className="absolute inset-x-0 -bottom-px h-0.5 origin-left bg-viz-accent transition-[transform,opacity] duration-300"
        style={{
          transform: `scaleX(${loading ? Math.max(0.04, percent / 100) : 1})`,
          opacity: loading ? 1 : 0,
        }}
      />
    </header>
  )
}

function LoadStatus({
  dataset,
  loading,
  progress,
}: Pick<AppHeaderProps, "dataset" | "loading" | "progress">) {
  const now = useNow(30_000)
  if (loading) {
    return progress && progress.total > 0
      ? `Loading ${progress.done} of ${progress.total} repositories`
      : "Contacting GitHub…"
  }
  if (!dataset) {
    return null
  }
  const quota = dataset.rateLimit
    ? ` · ${dataset.rateLimit.remaining} API calls left until ${formatClock(dataset.rateLimit.resetAt)}`
    : ""
  return (
    <span title={`Fetched at ${formatClock(dataset.fetchedAt)}${quota}`}>
      Updated {formatElapsed(now - dataset.fetchedAt)}
    </span>
  )
}

function describeConnection(token: string, canSignIn: boolean) {
  if (isSignInToken(token)) {
    return "Signed in with GitHub: every public repository, with line counts. Use a token instead to include private repositories."
  }
  if (token) {
    return "Using your access token: private repositories and line counts included."
  }
  return canSignIn
    ? "Public data only. Sign in or add a token for the full picture."
    : "Public data only. Add a token for the full picture."
}

function AccountMenu({
  dataset,
  connection,
  signIn,
  onConnect,
  onDisconnect,
}: Pick<
  AppHeaderProps,
  "dataset" | "connection" | "signIn" | "onConnect" | "onDisconnect"
>) {
  const [open, setOpen] = useState(false)
  const login = dataset?.owner.login ?? connection.login
  const label = login || "Connecting"

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="gap-2 pr-2 pl-1.5">
          <Avatar size="sm">
            {dataset && <AvatarImage src={dataset.owner.avatarUrl} alt="" />}
            <AvatarFallback>{label.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-32 truncate sm:block">{label}</span>
          <ChevronDownIcon className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="grid w-96 gap-4">
        <div>
          <p className="font-medium">Connection</p>
          <p className="text-sm text-muted-foreground">
            {describeConnection(connection.token, signIn.available)}
          </p>
        </div>
        <ConnectForm
          key={`${connection.login}|${connection.token}`}
          initial={connection}
          submitLabel="Apply"
          signIn={signIn}
          onSubmit={(next) => {
            setOpen(false)
            onConnect(next)
          }}
        />
        <Button
          variant="ghost"
          className="text-muted-foreground"
          onClick={onDisconnect}
        >
          {isSignInToken(connection.token) ? "Sign out" : "Disconnect"} and
          clear cached data
        </Button>
      </PopoverContent>
    </Popover>
  )
}
