import { classifyActor } from "./classify"
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

export const DATASET_VERSION = 1

const ENDPOINT = "https://api.github.com/graphql"
const CONCURRENCY = 5
const MAX_COMMITS_PER_REPO = 2000
const INITIAL_COMMIT_PAGE = 50
const MIN_COMMIT_PAGE = 5
const INITIAL_REPO_PAGE = 50
const MIN_REPO_PAGE = 10

export type GraphqlTransport = (
  query: string,
  variables: Record<string, unknown>,
  signal?: AbortSignal
) => Promise<unknown>

export class QueryTimeout extends Error {
  constructor(message = "GitHub took too long to answer.") {
    super(message)
    this.name = "QueryTimeout"
  }
}

export function createGraphqlTransport(token: string): GraphqlTransport {
  return async (query, variables, signal) => {
    let response: Response
    try {
      response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, variables }),
        signal,
      })
    } catch (error) {
      if (signal?.aborted) {
        throw error
      }
      if (globalThis.navigator?.onLine === false) {
        throw new GitHubError("network", "Could not reach api.github.com.")
      }
      // GitHub answers a query that runs past 10 s with a 502 that has no CORS headers, so the browser only reports a failed fetch.
      throw new QueryTimeout(
        "Could not reach api.github.com, or it took too long to answer."
      )
    }

    if (response.status === 401) {
      throw new GitHubError("auth", "GitHub rejected this token.")
    }
    if (response.status === 502 || response.status === 504) {
      throw new QueryTimeout()
    }
    if (response.status === 403 || response.status === 429) {
      const reset = Number(response.headers.get("x-ratelimit-reset")) * 1000
      throw new GitHubError(
        "rate-limit",
        "GitHub rate limit reached.",
        Number.isFinite(reset) && reset > 0 ? reset : null
      )
    }
    if (!response.ok) {
      throw new GitHubError(
        "unknown",
        `GitHub answered with HTTP ${response.status}.`
      )
    }

    const body = (await response.json()) as GraphqlBody
    if (body.data) {
      return body.data
    }
    throw toGitHubError(body.errors ?? [])
  }
}

interface GraphqlBody {
  data?: unknown
  errors?: { type?: string; message: string }[]
}

function toGitHubError(errors: { type?: string; message: string }[]) {
  const [first] = errors
  if (!first) {
    return new GitHubError("unknown", "GitHub returned an empty response.")
  }
  if (first.type === "RATE_LIMITED") {
    return new GitHubError("rate-limit", "GitHub rate limit reached.")
  }
  if (first.type === "NOT_FOUND") {
    return new GitHubError("not-found", first.message)
  }
  if (/timeout|something went wrong/i.test(first.message)) {
    return new QueryTimeout()
  }
  return new GitHubError("unknown", first.message)
}

const VIEWER_QUERY = /* GraphQL */ `
  query Viewer {
    viewer {
      login
    }
  }
`

const OWNER_QUERY = /* GraphQL */ `
  query Owner($login: String!, $first: Int!, $cursor: String) {
    viewer {
      login
    }
    rateLimit {
      remaining
      resetAt
    }
    repositoryOwner(login: $login) {
      __typename
      id
      login
      avatarUrl
      url
      ... on User {
        name
      }
      ... on Organization {
        name
      }
      repositories(
        first: $first
        after: $cursor
        ownerAffiliations: [OWNER]
        orderBy: { field: PUSHED_AT, direction: DESC }
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          name
          nameWithOwner
          description
          url
          isPrivate
          isFork
          isArchived
          pushedAt
          stargazerCount
          primaryLanguage {
            name
            color
          }
          defaultBranchRef {
            target {
              oid
            }
          }
          pullRequests {
            totalCount
          }
          openPullRequests: pullRequests(states: OPEN) {
            totalCount
          }
        }
      }
    }
  }
`

const COMMITS_QUERY = /* GraphQL */ `
  query Commits(
    $owner: String!
    $name: String!
    $since: GitTimestamp!
    $first: Int!
    $after: String
    $author: CommitAuthor
  ) {
    repository(owner: $owner, name: $name) {
      defaultBranchRef {
        target {
          ... on Commit {
            history(
              first: $first
              after: $after
              since: $since
              author: $author
            ) {
              pageInfo {
                hasNextPage
                endCursor
              }
              nodes {
                committedDate
                additions
                deletions
                parents {
                  totalCount
                }
                author {
                  name
                  user {
                    login
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`

const PULLS_QUERY = /* GraphQL */ `
  query Pulls($owner: String!, $name: String!, $after: String) {
    repository(owner: $owner, name: $name) {
      pullRequests(
        first: 100
        after: $after
        orderBy: { field: UPDATED_AT, direction: DESC }
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          createdAt
          updatedAt
          mergedAt
          closedAt
          author {
            __typename
            login
          }
        }
      }
    }
  }
`

interface PageInfo {
  hasNextPage: boolean
  endCursor: string | null
}

interface RepoNode {
  id: string
  name: string
  nameWithOwner: string
  description: string | null
  url: string
  isPrivate: boolean
  isFork: boolean
  isArchived: boolean
  pushedAt: string | null
  stargazerCount: number
  primaryLanguage: { name: string; color: string | null } | null
  defaultBranchRef: { target: { oid: string } | null } | null
  pullRequests: { totalCount: number } | null
  openPullRequests: { totalCount: number } | null
}

interface OwnerData {
  viewer: { login: string }
  rateLimit: { remaining: number; resetAt: string } | null
  repositoryOwner: {
    __typename: "User" | "Organization"
    id: string
    login: string
    avatarUrl: string
    url: string
    name?: string | null
    repositories: { pageInfo: PageInfo; nodes: RepoNode[] }
  } | null
}

interface CommitsData {
  repository: {
    defaultBranchRef: {
      target: {
        history?: {
          pageInfo: PageInfo
          nodes: {
            committedDate: string
            additions: number
            deletions: number
            parents: { totalCount: number }
            author: {
              name: string | null
              user: { login: string } | null
            } | null
          }[]
        }
      } | null
    } | null
  } | null
}

interface PullsData {
  repository: {
    pullRequests: {
      pageInfo: PageInfo
      nodes: {
        createdAt: string
        updatedAt: string
        mergedAt: string | null
        closedAt: string | null
        author: { __typename: string; login: string } | null
      }[]
    } | null
  } | null
}

export interface TokenLoadOptions {
  transport: GraphqlTransport
  login: string | null
  since: number
  cached: Dataset | null
  signal?: AbortSignal
  onProgress?: (progress: LoadProgress) => void
  onUpdate?: (dataset: Dataset) => void
}

interface RepoPlan {
  node: RepoNode
  ownerLogin: string
  authorId: string | null
}

export async function loadWithToken(
  options: TokenLoadOptions
): Promise<Dataset> {
  const { transport, since, cached, signal } = options
  const login = options.login ?? (await fetchViewerLogin(transport, signal))
  const { owner, ownerId, viewerLogin, nodes, rateLimit } = await fetchOwner(
    transport,
    login,
    signal
  )
  const selfLogins = owner.isOrganization
    ? [viewerLogin]
    : [owner.login, viewerLogin]
  const reusable = reusableRepos(cached, owner.login, since)

  const repos: Repo[] = nodes.map((node) => {
    const signature = signatureOf(node)
    const fresh = toRepo(node, signature)
    const previous = reusable.get(node.nameWithOwner)
    if (!previous) {
      return fresh
    }
    return {
      ...fresh,
      ...eventsWithin(previous, since),
      loaded: previous.signature === signature,
    }
  })

  const dataset: Dataset = {
    version: DATASET_VERSION,
    mode: "token",
    owner,
    since,
    fetchedAt: Date.now(),
    hasLineStats: true,
    repos,
    rateLimit,
  }

  const pending = repos
    .map((repo, index) => ({ repo, index }))
    .filter(({ repo }) => !repo.loaded)
  let done = 0
  options.onProgress?.({ done, total: pending.length, current: null })
  options.onUpdate?.(snapshot(dataset))

  await runPool(
    pending,
    CONCURRENCY,
    async ({ repo, index }) => {
      const node = nodes[index]
      const plan: RepoPlan = {
        node,
        ownerLogin: owner.login,
        authorId: node.isFork && !owner.isOrganization ? ownerId : null,
      }
      repos[index] = await loadRepoEvents(
        transport,
        plan,
        repo,
        since,
        selfLogins,
        signal
      )
      done += 1
      options.onProgress?.({
        done,
        total: pending.length,
        current: repo.nameWithOwner,
      })
      options.onUpdate?.(snapshot(dataset))
    },
    signal
  )

  return snapshot({ ...dataset, fetchedAt: Date.now() })
}

function snapshot(dataset: Dataset): Dataset {
  return { ...dataset, repos: [...dataset.repos] }
}

async function fetchViewerLogin(
  transport: GraphqlTransport,
  signal?: AbortSignal
) {
  const data = (await transport(VIEWER_QUERY, {}, signal)) as {
    viewer: { login: string }
  }
  return data.viewer.login
}

async function fetchOwner(
  transport: GraphqlTransport,
  login: string,
  signal?: AbortSignal
) {
  const nodes: RepoNode[] = []
  let pageSize = INITIAL_REPO_PAGE
  let cursor: string | null = null
  let first: OwnerData | null = null

  for (;;) {
    let data: OwnerData
    try {
      data = (await transport(
        OWNER_QUERY,
        { login, first: pageSize, cursor },
        signal
      )) as OwnerData
    } catch (error) {
      if (error instanceof QueryTimeout && pageSize > MIN_REPO_PAGE) {
        pageSize = Math.max(MIN_REPO_PAGE, Math.floor(pageSize / 2))
        continue
      }
      throw error
    }
    if (!data.repositoryOwner) {
      throw new GitHubError("not-found", `No GitHub account named “${login}”.`)
    }
    first ??= data
    nodes.push(...data.repositoryOwner.repositories.nodes)
    const pageInfo: PageInfo = data.repositoryOwner.repositories.pageInfo
    if (!pageInfo.hasNextPage || !pageInfo.endCursor) {
      break
    }
    cursor = pageInfo.endCursor
  }

  const account = first!.repositoryOwner!
  const owner: Owner = {
    login: account.login,
    name: account.name ?? null,
    avatarUrl: account.avatarUrl,
    url: account.url,
    isOrganization: account.__typename === "Organization",
  }
  const rateLimit: RateLimit | null = first!.rateLimit
    ? {
        remaining: first!.rateLimit.remaining,
        resetAt: Date.parse(first!.rateLimit.resetAt),
      }
    : null

  return {
    owner,
    ownerId: account.id,
    viewerLogin: first!.viewer.login,
    nodes,
    rateLimit,
  }
}

function signatureOf(node: RepoNode) {
  return [
    node.defaultBranchRef?.target?.oid ?? "empty",
    node.pushedAt ?? "never",
    node.pullRequests?.totalCount ?? 0,
    node.openPullRequests?.totalCount ?? 0,
  ].join("|")
}

function toRepo(node: RepoNode, signature: string): Repo {
  return {
    id: node.id,
    name: node.name,
    nameWithOwner: node.nameWithOwner,
    description: node.description,
    url: node.url,
    isPrivate: node.isPrivate,
    isFork: node.isFork,
    isArchived: node.isArchived,
    stars: node.stargazerCount,
    pushedAt: node.pushedAt ? Date.parse(node.pushedAt) : 0,
    language: node.primaryLanguage,
    signature,
    commits: [],
    pulls: [],
    loaded: false,
    truncated: false,
    error: null,
  }
}

function reusableRepos(cached: Dataset | null, login: string, since: number) {
  const usable =
    cached &&
    cached.version === DATASET_VERSION &&
    cached.mode === "token" &&
    cached.owner.login.toLowerCase() === login.toLowerCase() &&
    cached.since <= since
  const repos = usable
    ? cached.repos.filter((repo) => repo.loaded && !repo.error)
    : []
  return new Map(repos.map((repo) => [repo.nameWithOwner, repo]))
}

function eventsWithin(repo: Repo, since: number) {
  return {
    commits: repo.commits.filter((commit) => commit.at >= since),
    pulls: repo.pulls.filter((pull) => pullTouches(pull, since)),
    truncated: repo.truncated,
  }
}

function pullTouches(pull: PullEvent, since: number) {
  return (
    pull.createdAt >= since ||
    (pull.mergedAt ?? 0) >= since ||
    (pull.closedAt ?? 0) >= since
  )
}

async function loadRepoEvents(
  transport: GraphqlTransport,
  plan: RepoPlan,
  repo: Repo,
  since: number,
  selfLogins: string[],
  signal?: AbortSignal
): Promise<Repo> {
  if (repo.pushedAt < since) {
    return { ...repo, loaded: true }
  }
  try {
    const [history, pulls] = await Promise.all([
      plan.node.defaultBranchRef?.target
        ? fetchCommits(transport, plan, since, selfLogins, signal)
        : { commits: [], truncated: false },
      plan.node.pullRequests?.totalCount
        ? fetchPulls(transport, plan, since, selfLogins, signal)
        : [],
    ])
    return {
      ...repo,
      commits: history.commits,
      truncated: history.truncated,
      pulls,
      loaded: true,
    }
  } catch (error) {
    if (signal?.aborted || isFatal(error)) {
      throw error
    }
    return { ...repo, loaded: true, error: describe(error) }
  }
}

function isFatal(error: unknown) {
  return (
    error instanceof GitHubError &&
    (error.kind === "auth" || error.kind === "rate-limit")
  )
}

function describe(error: unknown) {
  if (error instanceof QueryTimeout) {
    return "GitHub timed out computing this repository's history."
  }
  return error instanceof Error ? error.message : "Unknown error"
}

async function fetchCommits(
  transport: GraphqlTransport,
  plan: RepoPlan,
  since: number,
  selfLogins: string[],
  signal?: AbortSignal
) {
  const commits: CommitEvent[] = []
  let pageSize = INITIAL_COMMIT_PAGE
  let after: string | null = null
  let truncated = false

  for (;;) {
    let data: CommitsData
    try {
      data = (await transport(
        COMMITS_QUERY,
        {
          owner: plan.ownerLogin,
          name: plan.node.name,
          since: new Date(since).toISOString(),
          first: pageSize,
          after,
          author: plan.authorId ? { id: plan.authorId } : null,
        },
        signal
      )) as CommitsData
    } catch (error) {
      if (error instanceof QueryTimeout && pageSize > MIN_COMMIT_PAGE) {
        pageSize = Math.max(MIN_COMMIT_PAGE, Math.floor(pageSize / 2))
        continue
      }
      throw error
    }

    const history = data.repository?.defaultBranchRef?.target?.history
    if (!history) {
      break
    }
    for (const node of history.nodes) {
      const isMerge = node.parents.totalCount > 1
      commits.push({
        at: Date.parse(node.committedDate),
        additions: isMerge ? 0 : node.additions,
        deletions: isMerge ? 0 : node.deletions,
        actor: classifyActor(
          {
            login: node.author?.user?.login ?? null,
            name: node.author?.name,
          },
          selfLogins
        ),
      })
    }
    if (!history.pageInfo.hasNextPage) {
      break
    }
    if (commits.length >= MAX_COMMITS_PER_REPO) {
      truncated = true
      break
    }
    after = history.pageInfo.endCursor
  }

  return { commits, truncated }
}

async function fetchPulls(
  transport: GraphqlTransport,
  plan: RepoPlan,
  since: number,
  selfLogins: string[],
  signal?: AbortSignal
) {
  const pulls: PullEvent[] = []
  let after: string | null = null

  for (;;) {
    const data = (await transport(
      PULLS_QUERY,
      { owner: plan.ownerLogin, name: plan.node.name, after },
      signal
    )) as PullsData
    const page = data.repository?.pullRequests
    if (!page) {
      break
    }

    let reachedOlder = false
    for (const node of page.nodes) {
      if (Date.parse(node.updatedAt) < since) {
        reachedOlder = true
        break
      }
      const pull: PullEvent = {
        createdAt: Date.parse(node.createdAt),
        mergedAt: node.mergedAt ? Date.parse(node.mergedAt) : null,
        closedAt: node.closedAt ? Date.parse(node.closedAt) : null,
        actor: classifyActor(
          {
            login: node.author?.login ?? null,
            isBot: node.author?.__typename === "Bot",
          },
          selfLogins
        ),
      }
      if (pullTouches(pull, since)) {
        pulls.push(pull)
      }
    }
    if (reachedOlder || !page.pageInfo.hasNextPage) {
      break
    }
    after = page.pageInfo.endCursor
  }

  return pulls
}
