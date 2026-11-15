export const ACTORS = ['you', 'agent', 'automation', 'other'] as const

export type Actor = (typeof ACTORS)[number]

export type DataMode = 'token' | 'public'

export interface CommitEvent {
   at: number
   additions: number
   deletions: number
   actor: Actor
}

export interface PullEvent {
   createdAt: number
   mergedAt: number | null
   closedAt: number | null
   actor: Actor
}

export interface RepoLanguage {
   name: string
   color: string | null
}

export interface Repo {
   id: string
   name: string
   nameWithOwner: string
   description: string | null
   url: string
   isPrivate: boolean
   isFork: boolean
   isArchived: boolean
   stars: number
   pushedAt: number
   language: RepoLanguage | null
   signature: string
   commits: CommitEvent[]
   pulls: PullEvent[]
   loaded: boolean
   truncated: boolean
   error: string | null
}

export interface Owner {
   login: string
   name: string | null
   avatarUrl: string
   url: string
   isOrganization: boolean
}

export interface RateLimit {
   remaining: number
   resetAt: number
}

export interface Dataset {
   version: number
   mode: DataMode
   owner: Owner
   since: number
   fetchedAt: number
   hasLineStats: boolean
   repos: Repo[]
   rateLimit: RateLimit | null
}

export interface LoadProgress {
   done: number
   total: number
   current: string | null
}

export class GitHubError extends Error {
   readonly kind: 'auth' | 'rate-limit' | 'not-found' | 'network' | 'unknown'
   readonly resetAt: number | null

   constructor(
      kind: GitHubError['kind'],
      message: string,
      resetAt: number | null = null
   ) {
      super(message)
      this.name = 'GitHubError'
      this.kind = kind
      this.resetAt = resetAt
   }
}
