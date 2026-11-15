import {
   dayStart,
   DISPLAY_WEEKS,
   type Timeline,
   WEEK_DAYS,
   weekStartDay,
} from './activity'
import { formatMonth, formatShortDate } from './format'

export interface WeekLabel {
   week: number
   range: string
   month: string | null
}

export function weekLabels(timeline: Timeline): WeekLabel[] {
   return Array.from({ length: DISPLAY_WEEKS }, (_, week) => {
      const firstDay = weekStartDay(timeline, week)
      const from = dayStart(timeline, firstDay)
      const to = dayStart(timeline, firstDay + WEEK_DAYS - 1)
      return {
         week,
         range: `${formatShortDate(from)} – ${formatShortDate(to)}`,
         month: monthStartingIn(timeline, firstDay),
      }
   })
}

function monthStartingIn(timeline: Timeline, firstDay: number) {
   for (let offset = 0; offset < WEEK_DAYS; offset += 1) {
      const timestamp = dayStart(timeline, firstDay + offset)
      if (new Date(timestamp).getDate() === 1) {
         return formatMonth(timestamp)
      }
   }
   return null
}

export function cursorFraction(timeline: Timeline, day: number) {
   const elapsed = day - timeline.firstDisplayDay + 1
   return Math.min(1, Math.max(0, elapsed / (DISPLAY_WEEKS * WEEK_DAYS)))
}
