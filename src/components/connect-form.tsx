import { useId, useState } from "react"

import { GitHubMark } from "@/components/github-mark"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { SignIn } from "@/hooks/use-sign-in"
import { isSignInToken } from "@/lib/github/auth"

const NEW_TOKEN_URL = "https://github.com/settings/personal-access-tokens/new"

export interface ConnectionInput {
  login: string
  token: string
}

interface ConnectFormProps {
  initial: ConnectionInput
  submitLabel: string
  signIn: SignIn
  onSubmit: (connection: ConnectionInput) => void
}

export function ConnectForm({
  initial,
  submitLabel,
  signIn,
  onSubmit,
}: ConnectFormProps) {
  const [login, setLogin] = useState(initial.login)
  const [token, setToken] = useState(initial.token)
  const loginId = useId()
  const tokenId = useId()
  const ready = login.trim() !== "" || token.trim() !== ""
  const offersSignIn = signIn.available && !isSignInToken(initial.token)

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (ready) {
          onSubmit({
            login: login.trim().replace(/^@/, ""),
            token: token.trim(),
          })
        }
      }}
    >
      {offersSignIn && <SignInOption signIn={signIn} />}
      <div className="grid gap-1.5">
        <Label htmlFor={loginId}>GitHub username or organization</Label>
        <Input
          id={loginId}
          value={login}
          onChange={(event) => setLogin(event.target.value)}
          placeholder={token ? "Defaults to the token's owner" : "octocat"}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={tokenId}>
          Access token
          <span className="font-normal text-muted-foreground">optional</span>
        </Label>
        <Input
          id={tokenId}
          type="password"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder="github_pat_…"
          autoComplete="off"
          spellCheck={false}
          className="font-mono"
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Without a token you get the 12 most recently pushed public
          repositories and no line counts. A{" "}
          <a
            href={NEW_TOKEN_URL}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-foreground underline underline-offset-2"
          >
            fine-grained token
          </a>{" "}
          with read-only Contents, Metadata and Pull requests unlocks private
          repositories, line counts and the full list. It stays in this browser
          and is sent only to api.github.com.
        </p>
      </div>
      <Button
        type="submit"
        variant={offersSignIn ? "outline" : "default"}
        disabled={!ready}
      >
        {submitLabel}
      </Button>
    </form>
  )
}

function SignInOption({ signIn }: { signIn: SignIn }) {
  return (
    <>
      <div className="grid gap-1.5">
        <Button type="button" disabled={signIn.pending} onClick={signIn.begin}>
          <GitHubMark />
          {signIn.pending ? "Signing in…" : "Sign in with GitHub"}
        </Button>
        {signIn.error && (
          <p role="alert" className="text-xs text-destructive">
            {signIn.error}
          </p>
        )}
        <p className="text-xs leading-relaxed text-muted-foreground">
          Asks for no permissions: you get every public repository, with line
          counts. Private repositories need a token.
        </p>
      </div>
      <p className="flex items-center gap-3 text-xs text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
        or enter a username or a token
      </p>
    </>
  )
}
