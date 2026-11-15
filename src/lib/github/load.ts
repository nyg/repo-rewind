import { createGraphqlTransport, loadWithToken } from './graphql'
import { loadPublic } from './rest'
import type { Dataset, LoadProgress } from './types'

export interface LoadOptions {
   token: string
   login: string
   since: number
   cached: Dataset | null
   signal?: AbortSignal
   onProgress?: (progress: LoadProgress) => void
   onUpdate?: (dataset: Dataset) => void
}

export function loadDataset(options: LoadOptions): Promise<Dataset> {
   const { token, login, ...shared } = options
   if (token) {
      return loadWithToken({
         ...shared,
         transport: createGraphqlTransport(token),
         login: login || null,
      })
   }
   return loadPublic({ ...shared, login })
}
