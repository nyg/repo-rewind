const fullNumber = new Intl.NumberFormat('en-US')
const compactNumber = new Intl.NumberFormat('en-US', {
   notation: 'compact',
   maximumFractionDigits: 1,
})
const longDate = new Intl.DateTimeFormat('en-US', {
   month: 'long',
   day: 'numeric',
   year: 'numeric',
})
const shortDate = new Intl.DateTimeFormat('en-US', {
   month: 'short',
   day: 'numeric',
})
const monthOnly = new Intl.DateTimeFormat('en-US', { month: 'short' })
const clock = new Intl.DateTimeFormat('en-US', {
   hour: 'numeric',
   minute: '2-digit',
})

export function formatNumber(value: number) {
   return Math.abs(value) >= 10_000
      ? compactNumber.format(value)
      : fullNumber.format(value)
}

export function formatCompact(value: number) {
   return compactNumber.format(value)
}

export function formatAdded(value: number) {
   return value === 0 ? '0' : `+${formatNumber(value)}`
}

export function formatRemoved(value: number) {
   return value === 0 ? '0' : `−${formatNumber(value)}`
}

export function formatScore(value: number) {
   if (value >= 100) {
      return fullNumber.format(Math.round(value))
   }
   return value.toFixed(1)
}

export function formatLongDate(timestamp: number) {
   return longDate.format(timestamp)
}

export function formatShortDate(timestamp: number) {
   return shortDate.format(timestamp)
}

export function formatMonth(timestamp: number) {
   return monthOnly.format(timestamp)
}

export function formatClock(timestamp: number) {
   return clock.format(timestamp)
}

export function formatDuration(days: number) {
   if (days === 1) {
      return '1 day'
   }
   if (days < 14) {
      return `${days} days`
   }
   if (days < 60) {
      return `${Math.round(days / 7)} weeks`
   }
   return `${Math.round(days / 30)} months`
}

export function formatDaysAgo(days: number) {
   if (days <= 0) {
      return 'today'
   }
   if (days === 1) {
      return 'yesterday'
   }
   return `${formatDuration(days)} ago`
}

export function formatElapsed(milliseconds: number) {
   const minutes = Math.floor(milliseconds / 60_000)
   if (minutes < 1) {
      return 'just now'
   }
   if (minutes < 60) {
      return `${minutes} min ago`
   }
   const hours = Math.floor(minutes / 60)
   if (hours < 24) {
      return `${hours} h ago`
   }
   return formatDaysAgo(Math.floor(hours / 24))
}

export function formatChange(current: number, previous: number) {
   if (previous === 0) {
      return current === 0 ? 'no change' : 'new'
   }
   const change = ((current - previous) / previous) * 100
   if (Math.abs(change) < 0.5) {
      return 'no change'
   }
   const sign = change > 0 ? '+' : '−'
   return `${sign}${fullNumber.format(Math.round(Math.abs(change)))}%`
}
