const AUTHORIZE_URL = 'https://github.com/login/oauth/authorize'
const PENDING_KEY = 'repo-rewind:sign-in'
const OAUTH_TOKEN_PREFIX = 'gho_'
const PRIVATE_ACCESS_SCOPE = 'repo'
const RANDOM_BYTES = 32

export interface AuthConfig {
   clientId: string
   exchangeUrl: string
}

export interface AuthEnv {
   VITE_GITHUB_CLIENT_ID?: string
   VITE_TOKEN_EXCHANGE_URL?: string
}

export interface AuthorizeRequest {
   redirectUri: string
   state: string
   challenge: string
   privateAccess: boolean
}

export interface Access {
   token: string
   privateAccess: boolean
}

export interface PendingSignIn {
   state: string
   verifier: string
   returnTo: string
}

export type Callback =
   { kind: 'code', code: string, state: string } | { kind: 'denied' }

export class SignInError extends Error {
   constructor(message: string) {
      super(message)
      this.name = 'SignInError'
   }
}

export function readAuthConfig(env: AuthEnv): AuthConfig | null {
   const clientId = env.VITE_GITHUB_CLIENT_ID?.trim()
   const exchangeUrl = env.VITE_TOKEN_EXCHANGE_URL?.trim()
   return clientId && exchangeUrl ? { clientId, exchangeUrl } : null
}

export function isSignInToken(token: string) {
   return token.startsWith(OAUTH_TOKEN_PREFIX)
}

export function randomToken() {
   return base64Url(crypto.getRandomValues(new Uint8Array(RANDOM_BYTES)))
}

export async function codeChallenge(verifier: string) {
   const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(verifier)
   )
   return base64Url(new Uint8Array(digest))
}

export function buildAuthorizeUrl(
   config: AuthConfig,
   request: AuthorizeRequest
) {
   const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: request.redirectUri,
      state: request.state,
      code_challenge: request.challenge,
      code_challenge_method: 'S256',
   })
   if (request.privateAccess) {
      params.set('scope', PRIVATE_ACCESS_SCOPE)
   }
   return `${AUTHORIZE_URL}?${params}`
}

export function parseCallback(search: string): Callback | null {
   const params = new URLSearchParams(search)
   if (params.has('error')) {
      return { kind: 'denied' }
   }
   const code = params.get('code')
   const state = params.get('state')
   return code && state ? { kind: 'code', code, state } : null
}

export function savePending(
   pending: PendingSignIn,
   storage: Storage = sessionStorage
) {
   storage.setItem(PENDING_KEY, JSON.stringify(pending))
}

export function takePending(
   storage: Storage = sessionStorage
): PendingSignIn | null {
   try {
      const raw = storage.getItem(PENDING_KEY)
      storage.removeItem(PENDING_KEY)
      return raw ? (JSON.parse(raw) as PendingSignIn) : null
   } catch {
      return null
   }
}

export async function exchangeCode(
   config: AuthConfig,
   grant: { code: string, verifier: string, redirectUri: string },
   fetchFn: typeof fetch = fetch
): Promise<Access> {
   let response: Response
   try {
      response = await fetchFn(config.exchangeUrl, {
         method: 'POST',
         body: new URLSearchParams({
            code: grant.code,
            code_verifier: grant.verifier,
            redirect_uri: grant.redirectUri,
         }),
      })
   } catch {
      throw new SignInError('The sign-in service is out of reach. Try again.')
   }

   const payload = (await response.json().catch(() => ({}))) as {
      access_token?: unknown
      scope?: unknown
      error?: unknown
   }
   if (!response.ok || typeof payload.access_token !== 'string') {
      const reason =
         typeof payload.error === 'string' ? `: ${payload.error}` : '. Try again.'
      throw new SignInError(`GitHub sign-in failed${reason}`)
   }
   return {
      token: payload.access_token,
      privateAccess: grantsPrivateAccess(payload.scope),
   }
}

function grantsPrivateAccess(scope: unknown) {
   return (
      typeof scope === 'string' &&
      scope.split(/[\s,]+/).includes(PRIVATE_ACCESS_SCOPE)
   )
}

function base64Url(bytes: Uint8Array) {
   return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
}
