import { describe, expect, it } from 'vitest'

import { limitConcurrency } from './pool'

describe('limitConcurrency', () => {
   it('runs no more calls at once than the limit', async () => {
      // Given
      let active = 0
      let peak = 0
      const double = limitConcurrency(
         async (value: number) => {
            active += 1
            peak = Math.max(peak, active)
            await new Promise((resolve) => setTimeout(resolve))
            active -= 1
            return value * 2
         },
         2,
         () => false
      )

      // When
      const results = await Promise.all([1, 2, 3, 4, 5].map(double))

      // Then
      expect(peak).toBe(2)
      expect(results).toEqual([2, 4, 6, 8, 10])
   })

   it('rejects the waiting calls without running them after a fatal error', async () => {
      // Given
      const fatal = new Error('fatal')
      const started: number[] = []
      const fail = limitConcurrency(
         async (value: number) => {
            started.push(value)
            throw fatal
         },
         1,
         (error) => error === fatal
      )

      // When
      const outcomes = await Promise.allSettled([1, 2, 3].map(fail))

      // Then
      expect(started).toEqual([1])
      expect(outcomes).toEqual([
         { status: 'rejected', reason: fatal },
         { status: 'rejected', reason: fatal },
         { status: 'rejected', reason: fatal },
      ])
   })
})
