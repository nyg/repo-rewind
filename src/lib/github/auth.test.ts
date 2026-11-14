import { describe, expect, it, vi } from "vitest"

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
} from "./auth"

const config = {
  clientId: "client-id",
  exchangeUrl: "https://exchange.example/api/token",
}
const grant = {
  code: "the-code",
  verifier: "the-verifier",
  redirectUri: "https://octocat.github.io/app/",
}

function memoryStorage(): Storage {
  const items = new Map<string, string>()
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
    clear: () => items.clear(),
    key: (index) => [...items.keys()][index] ?? null,
    get length() {
      return items.size
    },
  }
}

describe("readAuthConfig", () => {
  it("reads both settings", () => {
    // Given
    const env = {
      VITE_GITHUB_CLIENT_ID: " client-id ",
      VITE_TOKEN_EXCHANGE_URL: "https://exchange.example/api/token",
    }

    // Then
    expect(readAuthConfig(env)).toEqual(config)
  })

  it.each([
    {},
    { VITE_GITHUB_CLIENT_ID: "client-id" },
    { VITE_TOKEN_EXCHANGE_URL: "https://exchange.example/api/token" },
    { VITE_GITHUB_CLIENT_ID: "", VITE_TOKEN_EXCHANGE_URL: "" },
  ])("turns sign-in off for %o", (env) => {
    expect(readAuthConfig(env)).toBeNull()
  })
})

describe("isSignInToken", () => {
  it("recognises a token granted by signing in", () => {
    expect(isSignInToken("gho_16C7e42F292c6912E7710c838347Ae178B4a")).toBe(true)
  })

  it.each(["", "github_pat_11ABCDEFG0", "ghp_16C7e42F292c6912E7710c838347Ae"])(
    "does not mistake %j for one",
    (token) => {
      expect(isSignInToken(token)).toBe(false)
    }
  )
})

describe("randomToken", () => {
  it("is long enough to be a PKCE verifier and safe in a URL", () => {
    expect(randomToken()).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  it("differs on every call", () => {
    expect(randomToken()).not.toBe(randomToken())
  })
})

describe("codeChallenge", () => {
  it("matches the RFC 7636 example", async () => {
    // Given
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"

    // When
    const challenge = await codeChallenge(verifier)

    // Then
    expect(challenge).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM")
  })
})

describe("buildAuthorizeUrl", () => {
  const request = {
    redirectUri: "https://octocat.github.io/app/",
    state: "the-state",
    challenge: "the-challenge",
    privateAccess: false,
  }

  it("asks GitHub for a code without any scope", () => {
    // When
    const url = new URL(buildAuthorizeUrl(config, request))

    // Then
    expect(url.origin + url.pathname).toBe(
      "https://github.com/login/oauth/authorize"
    )
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: "client-id",
      redirect_uri: "https://octocat.github.io/app/",
      state: "the-state",
      code_challenge: "the-challenge",
      code_challenge_method: "S256",
    })
  })

  it("asks for repository access when private repositories are wanted", () => {
    // When
    const url = new URL(
      buildAuthorizeUrl(config, { ...request, privateAccess: true })
    )

    // Then
    expect(url.searchParams.get("scope")).toBe("repo")
  })
})

describe("parseCallback", () => {
  it("reads the code and state GitHub sends back", () => {
    expect(parseCallback("?code=abc&state=xyz")).toEqual({
      kind: "code",
      code: "abc",
      state: "xyz",
    })
  })

  it("recognises a refused sign-in", () => {
    expect(parseCallback("?error=access_denied&state=xyz")).toEqual({
      kind: "denied",
    })
  })

  it.each(["", "?code=abc", "?state=xyz", "?user=octocat"])(
    "ignores %j",
    (search) => {
      expect(parseCallback(search)).toBeNull()
    }
  )
})

describe("pending sign-in", () => {
  it("is handed back once", () => {
    // Given
    const storage = memoryStorage()
    const pending = {
      state: "the-state",
      verifier: "the-verifier",
      returnTo: "?user=octocat",
    }
    savePending(pending, storage)

    // When
    const first = takePending(storage)
    const second = takePending(storage)

    // Then
    expect(first).toEqual(pending)
    expect(second).toBeNull()
  })

  it("is absent when nothing was started", () => {
    expect(takePending(memoryStorage())).toBeNull()
  })
})

describe("exchangeCode", () => {
  it("returns the token from the exchange service", async () => {
    // Given
    const fetchFn = vi.fn<typeof fetch>(async () =>
      Response.json({ access_token: "gho_token", scope: "" })
    )

    // When
    const access = await exchangeCode(config, grant, fetchFn)

    // Then
    expect(access).toEqual({ token: "gho_token", privateAccess: false })
    const [url, init] = fetchFn.mock.calls[0] ?? []
    expect(url).toBe(config.exchangeUrl)
    expect(Object.fromEntries(init?.body as URLSearchParams)).toEqual({
      code: "the-code",
      code_verifier: "the-verifier",
      redirect_uri: "https://octocat.github.io/app/",
    })
  })

  it.each(["repo", "read:user,repo", "repo read:org"])(
    "reports private access for the scope %j",
    async (scope) => {
      // Given
      const fetchFn = vi.fn(async () =>
        Response.json({ access_token: "gho_token", scope })
      )

      // When
      const access = await exchangeCode(config, grant, fetchFn)

      // Then
      expect(access.privateAccess).toBe(true)
    }
  )

  it.each(["", "public_repo", "repo:status", undefined])(
    "reports no private access for the scope %j",
    async (scope) => {
      // Given
      const fetchFn = vi.fn(async () =>
        Response.json({ access_token: "gho_token", scope })
      )

      // When
      const access = await exchangeCode(config, grant, fetchFn)

      // Then
      expect(access.privateAccess).toBe(false)
    }
  )

  it("explains why GitHub refused", async () => {
    // Given
    const fetchFn = vi.fn(async () =>
      Response.json(
        { error: "The code is incorrect or expired." },
        { status: 400 }
      )
    )

    // When
    const attempt = exchangeCode(config, grant, fetchFn)

    // Then
    await expect(attempt).rejects.toThrow(
      new SignInError(
        "GitHub sign-in failed: The code is incorrect or expired."
      )
    )
  })

  it("fails when the answer is not JSON", async () => {
    // Given
    const fetchFn = vi.fn(
      async () => new Response("Bad gateway", { status: 502 })
    )

    // When
    const attempt = exchangeCode(config, grant, fetchFn)

    // Then
    await expect(attempt).rejects.toThrow(
      new SignInError("GitHub sign-in failed. Try again.")
    )
  })

  it("fails when the exchange service is unreachable", async () => {
    // Given
    const fetchFn = vi.fn(async () => {
      throw new TypeError("Failed to fetch")
    })

    // When
    const attempt = exchangeCode(config, grant, fetchFn)

    // Then
    await expect(attempt).rejects.toThrow(
      new SignInError("The sign-in service is out of reach. Try again.")
    )
  })
})
