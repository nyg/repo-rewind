import { classifyActor } from "./classify"
import { DATASET_VERSION } from "./graphql"
import { languageColor } from "./languages"
import { runPool } from "./pool"
import {
  GitHubError,
  type CommitEvent,
  type Dataset,
  type LoadProgress,
  type Owner,
  type PullEvent,
  type RateLimit,
  type Repo,
} from "./types"

const API = "https://api.github.com"
const CONCURRENCY = 4

// Unauthenticated clients get 60 requests per hour: 2 for the account, then 2 per repository.
export const PUBLIC_REPO_LIMIT = 12

interface RestUser {
  login: string
  name: string | null
  avatar_url: string
  html_url: string
  type: string
}

interface RestRepo {
  node_id: string
  name: string
  full_name: string
  description: string | null
  html_url: string
  private: boolean
  fork: boolean
  archived: boolean
  pushed_at: string | null
  stargazers_count: number
  language: string | null
}

interface RestCommit {
  commit: {
    author: { name: string | null; date: string } | null
    committer: { date: string } | null
  }
  author: { login: string; type: string } | null
}

interface RestPull {
  created_at: string
  updated_at: string
  merged_at: string | null
  closed_at: string | null
  user: { login: string; type: string } | null
}

export interface PublicLoadOptions {
  login: string
  since: number
  cached: Dataset | null
  signal?: AbortSignal
  onProgress?: (progress: LoadProgress) => void
  onUpdate?: (dataset: Dataset) => void
}

export async function loadPublic(options: PublicLoadOptions): Promise<Dataset> {
  const { login, since, cached, signal } = options
  const client = createRestClient(signal)

  const user = await client.get<RestUser>(`/users/${encodeURIComponent(login)}`)
  const listed = await client.get<RestRepo[]>(
    `/users/${encodeURIComponent(login)}/repos?type=owner&sort=pushed&per_page=100`
  )

  const owner: Owner = {
    login: user.login,
    name: user.name,
    avatarUrl: user.avatar_url,
    url: user.html_url,
    isOrganization: user.type === "Organization",
  }
  const selfLogins = owner.isOrganization ? [] : [owner.login]
  const reusable = reusableRepos(cached, owner.login, since)

  const repos = listed.map((item) => {
    const repo = toRepo(item)
    const previous = reusable.get(repo.nameWithOwner)
    if (previous) {
      return {
        ...repo,
        commits: previous.commits.filter((commit) => commit.at >= since),
        pulls: previous.pulls,
        truncated: previous.truncated,
        loaded: previous.signature === repo.signature,
      }
    }
    return repo.pushedAt < since ? { ...repo, loaded: true } : repo
  })

  const dataset: Dataset = {
    version: DATASET_VERSION,
    mode: "public",
    owner,
    since,
    fetchedAt: Date.now(),
    hasLineStats: false,
    repos,
    rateLimit: client.rateLimit(),
  }

  const alreadyLoaded = repos.filter(
    (repo) => repo.loaded && repo.pushedAt >= since
  ).length
  const pending = repos
    .map((repo, index) => ({ repo, index }))
    .filter(({ repo }) => !repo.loaded)
    .slice(0, Math.max(0, PUBLIC_REPO_LIMIT - alreadyLoaded))
  let done = 0
  options.onProgress?.({ done, total: pending.length, current: null })
  options.onUpdate?.(snapshot(dataset, client.rateLimit()))

  await runPool(
    pending,
    CONCURRENCY,
    async ({ repo, index }) => {
      repos[index] = await loadRepoEvents(client, repo, since, selfLogins)
      done += 1
      options.onProgress?.({
        done,
        total: pending.length,
        current: repo.nameWithOwner,
      })
      options.onUpdate?.(snapshot(dataset, client.rateLimit()))
    },
    signal
  )

  return snapshot({ ...dataset, fetchedAt: Date.now() }, client.rateLimit())
}

function snapshot(dataset: Dataset, rateLimit: RateLimit | null): Dataset {
  return { ...dataset, repos: [...dataset.repos], rateLimit }
}

function reusableRepos(cached: Dataset | null, login: string, since: number) {
  const usable =
    cached &&
    cached.version === DATASET_VERSION &&
    cached.mode === "public" &&
    cached.owner.login.toLowerCase() === login.toLowerCase() &&
    cached.since <= since
  const repos = usable
    ? cached.repos.filter((repo) => repo.loaded && !repo.error)
    : []
  return new Map(repos.map((repo) => [repo.nameWithOwner, repo]))
}

function toRepo(item: RestRepo): Repo {
  return {
    id: item.node_id,
    name: item.name,
    nameWithOwner: item.full_name,
    description: item.description,
    url: item.html_url,
    isPrivate: item.private,
    isFork: item.fork,
    isArchived: item.archived,
    stars: item.stargazers_count,
    pushedAt: item.pushed_at ? Date.parse(item.pushed_at) : 0,
    language: item.language
      ? { name: item.language, color: languageColor(item.language) }
      : null,
    signature: item.pushed_at ?? "never",
    commits: [],
    pulls: [],
    loaded: false,
    truncated: false,
    error: null,
  }
}

type RestClient = ReturnType<typeof createRestClient>

async function loadRepoEvents(
  client: RestClient,
  repo: Repo,
  since: number,
  selfLogins: string[]
): Promise<Repo> {
  try {
    const [commits, pulls] = await Promise.all([
      fetchCommits(client, repo, since, selfLogins),
      fetchPulls(client, repo, since, selfLogins),
    ])
    return {
      ...repo,
      commits,
      pulls,
      truncated: commits.length === 100,
      loaded: true,
    }
  } catch (error) {
    if (error instanceof GitHubError && error.kind === "rate-limit") {
      throw error
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error
    }
    return {
      ...repo,
      loaded: true,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

async function fetchCommits(
  client: RestClient,
  repo: Repo,
  since: number,
  selfLogins: string[]
): Promise<CommitEvent[]> {
  const sinceIso = encodeURIComponent(new Date(since).toISOString())
  const items = await client.get<RestCommit[]>(
    `/repos/${repo.nameWithOwner}/commits?since=${sinceIso}&per_page=100`,
    { emptyOn: [409] }
  )
  return items.map((item) => ({
    at: Date.parse(
      item.commit.committer?.date ?? item.commit.author?.date ?? ""
    ),
    additions: 0,
    deletions: 0,
    actor: classifyActor(
      {
        login: item.author?.login ?? null,
        name: item.commit.author?.name,
        isBot: item.author?.type === "Bot",
      },
      selfLogins
    ),
  }))
}

async function fetchPulls(
  client: RestClient,
  repo: Repo,
  since: number,
  selfLogins: string[]
): Promise<PullEvent[]> {
  const items = await client.get<RestPull[]>(
    `/repos/${repo.nameWithOwner}/pulls?state=all&sort=updated&direction=desc&per_page=100`
  )
  return items
    .filter((item) => Date.parse(item.updated_at) >= since)
    .map((item) => ({
      createdAt: Date.parse(item.created_at),
      mergedAt: item.merged_at ? Date.parse(item.merged_at) : null,
      closedAt: item.closed_at ? Date.parse(item.closed_at) : null,
      actor: classifyActor(
        { login: item.user?.login ?? null, isBot: item.user?.type === "Bot" },
        selfLogins
      ),
    }))
}

function createRestClient(signal?: AbortSignal) {
  let latest: RateLimit | null = null

  async function get<T>(
    path: string,
    options: { emptyOn?: number[] } = {}
  ): Promise<T> {
    let response: Response
    try {
      response = await fetch(`${API}${path}`, {
        headers: { Accept: "application/vnd.github+json" },
        signal,
      })
    } catch (error) {
      if (signal?.aborted) {
        throw error
      }
      throw new GitHubError("network", "Could not reach api.github.com.")
    }

    const remaining = Number(response.headers.get("x-ratelimit-remaining"))
    const reset = Number(response.headers.get("x-ratelimit-reset")) * 1000
    if (Number.isFinite(remaining) && reset > 0) {
      latest = { remaining, resetAt: reset }
    }

    if (options.emptyOn?.includes(response.status)) {
      return [] as T
    }
    if (response.status === 404) {
      throw new GitHubError(
        "not-found",
        "No public GitHub account or repository found."
      )
    }
    if (response.status === 403 || response.status === 429) {
      throw new GitHubError(
        "rate-limit",
        "GitHub's limit for anonymous requests is used up.",
        reset > 0 ? reset : null
      )
    }
    if (!response.ok) {
      throw new GitHubError(
        "unknown",
        `GitHub answered with HTTP ${response.status}.`
      )
    }
    return (await response.json()) as T
  }

  return { get, rateLimit: () => latest }
}
