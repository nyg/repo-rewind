import { afterEach, describe, expect, it, vi } from "vitest"

import {
  createGraphqlTransport,
  loadWithToken,
  QueryTimeout,
  type GraphqlTransport,
} from "./graphql"
import { GitHubError } from "./types"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("createGraphqlTransport", () => {
  it("reports a blocked response as a timeout", async () => {
    // Given
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed")))
    const transport = createGraphqlTransport("token")

    // When
    const result = transport("query", {})

    // Then
    await expect(result).rejects.toBeInstanceOf(QueryTimeout)
  })

  it("reports a failed request while offline as a network error", async () => {
    // Given
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed")))
    vi.stubGlobal("navigator", { onLine: false })
    const transport = createGraphqlTransport("token")

    // When
    const result = transport("query", {})

    // Then
    await expect(result).rejects.toBeInstanceOf(GitHubError)
    await expect(result).rejects.toHaveProperty("kind", "network")
  })
})

describe("loadWithToken", () => {
  it("retries the repository list with smaller pages after a timeout", async () => {
    // Given
    const pageSizes: number[] = []
    const transport: GraphqlTransport = async (_query, variables) => {
      const pageSize = variables.first as number
      pageSizes.push(pageSize)
      if (pageSize > 25) {
        throw new QueryTimeout()
      }
      return ownerPage()
    }

    // When
    const dataset = await loadWithToken({
      transport,
      login: "nyg",
      since: 0,
      cached: null,
    })

    // Then
    expect(pageSizes).toEqual([50, 25])
    expect(dataset.repos.map((repo) => repo.name)).toEqual(["dotfiles"])
  })
})

function ownerPage() {
  return {
    viewer: { login: "nyg" },
    rateLimit: null,
    repositoryOwner: {
      __typename: "User",
      id: "U_1",
      login: "nyg",
      avatarUrl: "",
      url: "",
      name: null,
      repositories: {
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: [
          {
            id: "R_1",
            name: "dotfiles",
            nameWithOwner: "nyg/dotfiles",
            description: null,
            url: "",
            isPrivate: false,
            isFork: false,
            isArchived: false,
            pushedAt: null,
            stargazerCount: 0,
            primaryLanguage: null,
            defaultBranchRef: null,
            pullRequests: { totalCount: 0 },
            openPullRequests: { totalCount: 0 },
          },
        ],
      },
    },
  }
}
