import { afterEach, describe, expect, it, vi } from 'vitest'

import {
   createGraphqlTransport,
   type GraphqlTransport,
   loadWithToken,
   QueryTimeout,
} from './graphql'
import { type Dataset,GitHubError } from './types'

afterEach(() => {
   vi.unstubAllGlobals()
})

describe('createGraphqlTransport', () => {
   it('reports a blocked response as a timeout', async () => {
      // Given
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed')))
      const transport = createGraphqlTransport('token')

      // When
      const result = transport('query', {})

      // Then
      await expect(result).rejects.toBeInstanceOf(QueryTimeout)
   })

   it('reports a failed request while offline as a network error', async () => {
      // Given
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed')))
      vi.stubGlobal('navigator', { onLine: false })
      const transport = createGraphqlTransport('token')

      // When
      const result = transport('query', {})

      // Then
      await expect(result).rejects.toBeInstanceOf(GitHubError)
      await expect(result).rejects.toHaveProperty('kind', 'network')
   })
})

describe('loadWithToken', () => {
   it('retries the repository list with smaller pages after a timeout', async () => {
      // Given
      const pageSizes: number[] = []
      const transport: GraphqlTransport = async (query, variables) => {
         const pageSize = variables.first as number
         if (query.includes('query Owner')) {
            pageSizes.push(pageSize)
         }
         if (pageSize > 50) {
            throw new QueryTimeout()
         }
         return ownerPage()
      }

      // When
      const dataset = await loadWithToken({
         transport,
         login: 'nyg',
         since: 0,
         cached: null,
      })

      // Then
      expect(pageSizes).toEqual([100, 50])
      expect(dataset.repos.map((repo) => repo.name)).toEqual(['dotfiles'])
   })

   it('requests the commit pages after the first one side by side', async () => {
      // Given
      const history = fakeHistory(120, (index) => `abc ${index}`)

      // When
      const dataset = await loadWithToken({
         transport: history.transport,
         login: 'nyg',
         since: 0,
         cached: null,
      })

      // Then
      expect(history.requests).toEqual([
         { after: null, first: 50 },
         { after: 'abc 49', first: 50 },
         { after: 'abc 99', first: 20 },
      ])
      expect(history.peak()).toBe(2)
      expect(commitTimes(dataset)).toEqual(history.times)
   })

   it('follows the cursors one page at a time when it cannot read them', async () => {
      // Given
      const history = fakeHistory(120, (index) => `page-${index}`)

      // When
      const dataset = await loadWithToken({
         transport: history.transport,
         login: 'nyg',
         since: 0,
         cached: null,
      })

      // Then
      expect(history.requests).toEqual([
         { after: null, first: 50 },
         { after: 'page-49', first: 50 },
         { after: 'page-99', first: 50 },
      ])
      expect(history.peak()).toBe(1)
      expect(commitTimes(dataset)).toEqual(history.times)
   })

   it('splits a commit page that times out', async () => {
      // Given
      const history = fakeHistory(
         120,
         (index) => `abc ${index}`,
         ({ after, first }) => after !== null && first > 25
      )

      // When
      const dataset = await loadWithToken({
         transport: history.transport,
         login: 'nyg',
         since: 0,
         cached: null,
      })

      // Then
      expect(history.requests).toContainEqual({ after: 'abc 49', first: 25 })
      expect(history.requests).toContainEqual({ after: 'abc 74', first: 25 })
      expect(commitTimes(dataset)).toEqual(history.times)
   })
})

interface HistoryRequest {
   after: string | null
   first: number
}

function fakeHistory(
   total: number,
   cursorOf: (index: number) => string,
   timesOut: (request: HistoryRequest) => boolean = () => false
) {
   const times = Array.from(
      { length: total },
      (_, index) => (total - index) * 1000
   )
   const requests: HistoryRequest[] = []
   let active = 0
   let peak = 0

   const transport: GraphqlTransport = async (query, variables) => {
      if (!query.includes('query Commits')) {
         return ownerPage({
            pushedAt: '2026-01-01T00:00:00Z',
            defaultBranchRef: { target: { oid: 'abc' } },
         })
      }
      const request = variables as unknown as HistoryRequest
      requests.push({ after: request.after, first: request.first })
      active += 1
      peak = Math.max(peak, active)
      await new Promise((resolve) => setTimeout(resolve))
      active -= 1
      if (timesOut(request)) {
         throw new QueryTimeout()
      }
      const cursors = times.map((_, index) => cursorOf(index))
      const start = request.after ? cursors.indexOf(request.after) + 1 : 0
      const end = Math.min(total, start + request.first)
      return {
         repository: {
            defaultBranchRef: {
               target: {
                  history: {
                     totalCount: total,
                     pageInfo: {
                        hasNextPage: end < total,
                        endCursor: cursors[end - 1],
                     },
                     nodes: times.slice(start, end).map((time) => ({
                        committedDate: new Date(time).toISOString(),
                        additions: 1,
                        deletions: 0,
                        parents: { totalCount: 1 },
                        author: { name: 'nyg', user: { login: 'nyg' } },
                     })),
                  },
               },
            },
         },
      }
   }

   return { transport, requests, times, peak: () => peak }
}

function commitTimes(dataset: Dataset) {
   return dataset.repos[0].commits.map((commit) => commit.at)
}

function ownerPage(repo: Record<string, unknown> = {}) {
   return {
      viewer: { login: 'nyg' },
      rateLimit: null,
      repositoryOwner: {
         __typename: 'User',
         id: 'U_1',
         login: 'nyg',
         avatarUrl: '',
         url: '',
         name: null,
         repositories: {
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes: [
               {
                  id: 'R_1',
                  name: 'dotfiles',
                  nameWithOwner: 'nyg/dotfiles',
                  description: null,
                  url: '',
                  isPrivate: false,
                  isFork: false,
                  isArchived: false,
                  pushedAt: null,
                  stargazerCount: 0,
                  primaryLanguage: null,
                  defaultBranchRef: null,
                  pullRequests: { totalCount: 0 },
                  openPullRequests: { totalCount: 0 },
                  ...repo,
               },
            ],
         },
      },
   }
}
