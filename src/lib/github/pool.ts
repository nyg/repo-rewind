export async function runPool<T>(
   items: T[],
   limit: number,
   worker: (item: T) => Promise<void>,
   signal?: AbortSignal
) {
   let next = 0

   async function drain() {
      while (next < items.length) {
         signal?.throwIfAborted()
         const item = items[next]
         next += 1
         await worker(item)
      }
   }

   await Promise.all(
      Array.from({ length: Math.min(limit, items.length) }, drain)
   )
}

export function limitConcurrency<Args extends unknown[], Result>(
   run: (...args: Args) => Promise<Result>,
   limit: number,
   isFatal: (error: unknown) => boolean
): (...args: Args) => Promise<Result> {
   const waiting: (() => void)[] = []
   let active = 0
   let fatal: { error: unknown } | null = null

   async function acquire() {
      if (active < limit) {
         active += 1
         return
      }
      await new Promise<void>((resolve) => waiting.push(resolve))
   }

   function release() {
      const next = waiting.shift()
      if (next) {
         next()
      } else {
         active -= 1
      }
   }

   return async (...args) => {
      await acquire()
      try {
         if (fatal) {
            throw fatal.error
         }
         return await run(...args)
      } catch (error) {
         if (isFatal(error)) {
            fatal ??= { error }
         }
         throw error
      } finally {
         release()
      }
   }
}
