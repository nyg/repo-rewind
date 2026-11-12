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
