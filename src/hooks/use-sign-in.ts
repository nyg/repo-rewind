import { useCallback, useEffect, useEffectEvent, useState } from "react"

import {
  buildAuthorizeUrl,
  codeChallenge,
  exchangeCode,
  isSignInToken,
  parseCallback,
  randomToken,
  readAuthConfig,
  savePending,
  SignInError,
  takePending,
  type Access,
  type AuthConfig,
} from "@/lib/github/auth"

const authConfig = readAuthConfig(import.meta.env)

export type SignInAccess = "none" | "public" | "private"

export interface SignIn {
  available: boolean
  access: SignInAccess
  pending: boolean
  error: string | null
  begin: (privateAccess: boolean) => void
}

type Outcome = { access: Access } | { error: string } | null

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

async function start(config: AuthConfig, privateAccess: boolean) {
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
    buildAuthorizeUrl(config, {
      redirectUri: redirectUri(),
      state,
      challenge,
      privateAccess,
    })
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
    const access = await exchangeCode(authConfig, {
      code: callback.code,
      verifier: pending.verifier,
      redirectUri: redirectUri(),
    })
    return { access }
  } catch (error) {
    return { error: describe(error) }
  }
}

function accessOf({ token, privateAccess }: Access): SignInAccess {
  if (!isSignInToken(token)) {
    return "none"
  }
  return privateAccess ? "private" : "public"
}

export function useSignIn(
  current: Access,
  onAccess: (access: Access) => void
): SignIn {
  const [pending, setPending] = useState(
    () => parseCallback(window.location.search)?.kind === "code"
  )
  const [error, setError] = useState<string | null>(null)

  const settle = useEffectEvent((outcome: Outcome) => {
    setPending(false)
    if (!outcome) {
      return
    }
    if ("access" in outcome) {
      onAccess(outcome.access)
    } else {
      setError(outcome.error)
    }
  })

  useEffect(() => {
    let mounted = true
    completion ??= complete()
    void completion.then((outcome) => {
      if (mounted) {
        settle(outcome)
      }
    })
    return () => {
      mounted = false
    }
  }, [])

  const begin = useCallback((privateAccess: boolean) => {
    if (!authConfig) {
      return
    }
    setError(null)
    start(authConfig, privateAccess).catch((reason: unknown) =>
      setError(describe(reason))
    )
  }, [])

  return {
    available: authConfig !== null,
    access: accessOf(current),
    pending,
    error,
    begin,
  }
}
