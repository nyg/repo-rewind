import { useCallback, useEffect, useRef, useState } from 'react'

import { loadDataset } from '@/lib/github/load'
import type { Dataset, LoadProgress } from '@/lib/github/types'
import { readDataset, writeDataset } from '@/lib/storage'

const TOKEN_STALE_MS = 10 * 60_000
const PUBLIC_STALE_MS = 60 * 60_000
const UPDATE_INTERVAL_MS = 350

export interface DatasetState {
   dataset: Dataset | null
   loading: boolean
   progress: LoadProgress | null
   error: Error | null
}

export interface Connection {
   token: string
   login: string
   since: number
   onLogin: (login: string) => void
}

function needsLoad(dataset: Dataset | null, token: string) {
   if (!dataset) {
      return true
   }
   const expectedMode = token ? 'token' : 'public'
   const maxAge = token ? TOKEN_STALE_MS : PUBLIC_STALE_MS
   return (
      dataset.mode !== expectedMode || Date.now() - dataset.fetchedAt > maxAge
   )
}

// Mount under a key derived from token and login: the hook reads its cache once.
export function useDataset({ token, login, since, onLogin }: Connection) {
   const [state, setState] = useState<DatasetState>(() => {
      const dataset = login ? readDataset(login) : null
      return {
         dataset,
         loading: needsLoad(dataset, token),
         progress: null,
         error: null,
      }
   })
   const controller = useRef<AbortController | null>(null)
   const latest = useRef(state.dataset)

   const start = useCallback(() => {
      controller.current?.abort()
      const current = new AbortController()
      controller.current = current
      let lastUpdate = 0

      loadDataset({
         token,
         login,
         since,
         cached: latest.current,
         signal: current.signal,
         onProgress: (progress) => {
            if (!current.signal.aborted) {
               setState((previous) => ({ ...previous, progress }))
            }
         },
         onUpdate: (dataset) => {
            const now = Date.now()
            if (current.signal.aborted || now - lastUpdate < UPDATE_INTERVAL_MS) {
               return
            }
            lastUpdate = now
            setState((previous) => ({ ...previous, dataset }))
         },
      })
         .then((dataset) => {
            if (current.signal.aborted) {
               return
            }
            latest.current = dataset
            writeDataset(dataset)
            setState({ dataset, loading: false, progress: null, error: null })
            onLogin(dataset.owner.login)
         })
         .catch((error: unknown) => {
            if (current.signal.aborted) {
               return
            }
            setState((previous) => ({
               dataset: latest.current ?? previous.dataset,
               loading: false,
               progress: null,
               error: error instanceof Error ? error : new Error(String(error)),
            }))
         })
   }, [token, login, since, onLogin])

   const refresh = useCallback(() => {
      setState((previous) => ({
         ...previous,
         loading: true,
         progress: null,
         error: null,
      }))
      start()
   }, [start])

   useEffect(() => {
      // Deferred so StrictMode's throwaway first mount sends nothing: anonymous clients only get 60 requests an hour.
      const timer = needsLoad(latest.current, token)
         ? window.setTimeout(start, 0)
         : undefined
      return () => {
         window.clearTimeout(timer)
         controller.current?.abort()
      }
   }, [start, token])

   return { ...state, refresh }
}
