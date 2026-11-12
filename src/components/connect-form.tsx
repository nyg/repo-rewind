import { useId, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const NEW_TOKEN_URL = "https://github.com/settings/personal-access-tokens/new"

export interface ConnectionInput {
  login: string
  token: string
}

interface ConnectFormProps {
  initial: ConnectionInput
  submitLabel: string
  onSubmit: (connection: ConnectionInput) => void
}

export function ConnectForm({
  initial,
  submitLabel,
  onSubmit,
}: ConnectFormProps) {
  const [login, setLogin] = useState(initial.login)
  const [token, setToken] = useState(initial.token)
  const loginId = useId()
  const tokenId = useId()
  const ready = login.trim() !== "" || token.trim() !== ""

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
      <Button type="submit" disabled={!ready}>
        {submitLabel}
      </Button>
    </form>
  )
}
