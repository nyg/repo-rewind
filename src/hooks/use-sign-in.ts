import { useCallback, useEffect, useEffectEvent, useState } from "react"

import {
  buildAuthorizeUrl,
  codeChallenge,
  exchangeCode,
  parseCallback,
  randomToken,
  readAuthConfig,
  savePending,
  SignInError,
  takePending,
  type AuthConfig,
} from "@/lib/github/auth"

const authConfig = readAuthConfig(import.meta.env)

export interface SignIn {
  available: boolean
  pending: boolean
  error: string | null
  begin: () => void
}

type Outcome = { token: string } | { error: string } | null

// The sign-in code works once, so StrictMode's second mount must reuse the first exchange.
let completion: Promise<Outcome> | null = null

function redirectUri() {
  return window.location.origin + window.location.pathname
}

function describe(error: unknown) {
  return error instanceof SignInError
    ? error.message
    : "Sign-in failed. Try again."
}

async function start(config: AuthConfig) {
  const state = randomToken()
  const verifier = randomToken()
  const returnTo = window.location.search + window.location.hash
  try {
    savePending({ state, verifier, returnTo })
  } catch {
    throw new SignInError(
      "Sign-in needs session storage, which this browser is blocking."
    )
  }
  const challenge = await codeChallenge(verifier)
  window.location.assign(
    buildAuthorizeUrl(config, redirectUri(), state, challenge)
  )
}

async function complete(): Promise<Outcome> {
  const callback = parseCallback(window.location.search)
  if (!callback) {
    return null
  }
  const pending = takePending()
  window.history.replaceState(
    null,
    "",
    window.location.pathname + (pending?.returnTo ?? "")
  )

  if (callback.kind === "denied") {
    return { error: "Sign-in cancelled." }
  }
  if (!authConfig || !pending || pending.state !== callback.state) {
    return { error: "Sign-in could not be verified. Try again." }
  }
  try {
    const token = await exchangeCode(authConfig, {
      code: callback.code,
      verifier: pending.verifier,
      redirectUri: redirectUri(),
    })
    return { token }
  } catch (error) {
    return { error: describe(error) }
  }
}

export function useSignIn(onToken: (token: string) => void): SignIn {
  const [pending, setPending] = useState(
    () => parseCallback(window.location.search)?.kind === "code"
  )
  const [error, setError] = useState<string | null>(null)

  const settle = useEffectEvent((outcome: Outcome) => {
    setPending(false)
    if (!outcome) {
      return
    }
    if ("token" in outcome) {
      onToken(outcome.token)
    } else {
      setError(outcome.error)
    }
  })

  useEffect(() => {
    let current = true
    completion ??= complete()
    void completion.then((outcome) => {
      if (current) {
        settle(outcome)
      }
    })
    return () => {
      current = false
    }
  }, [])

  const begin = useCallback(() => {
    if (!authConfig) {
      return
    }
    setError(null)
    start(authConfig).catch((reason: unknown) => setError(describe(reason)))
  }, [])

  return { available: authConfig !== null, pending, error, begin }
}
