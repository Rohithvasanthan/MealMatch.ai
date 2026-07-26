// The scraper service runs every request through one shared Playwright
// browser instance (a new context per request, not a new process — see
// scraper/app/main.py). On a memory-constrained instance, firing off many
// concurrent browser-based checks at once (e.g. all 7 platforms for an
// availability sweep) can starve each other for resources and time out,
// even though each would comfortably succeed on its own. This runs `fn`
// over `items` with at most `limit` in flight at a time, preserving the
// same PromiseSettledResult shape Promise.allSettled returns so it's a
// drop-in replacement at call sites.
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length)
  let cursor = 0

  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++
      try {
        const value = await fn(items[index], index)
        results[index] = { status: "fulfilled", value }
      } catch (reason) {
        results[index] = { status: "rejected", reason }
      }
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length))
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results
}
