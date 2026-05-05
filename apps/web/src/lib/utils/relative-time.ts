// apps/web/src/lib/utils/relative-time.ts
//
// 한국어 상대 시간 포맷터 — Intl.RelativeTimeFormat('ko') 단일 출처.
// ModuleCard / ContinueCard / RecentActivity 등 Hub 영역에서 공통 사용.

const KO_RTF =
  typeof Intl !== 'undefined' ? new Intl.RelativeTimeFormat('ko', { numeric: 'auto' }) : null

/**
 * "방금 전 / 5분 전 / 2시간 전 / 어제 / 3일 전 / 2주 전 / 5달 전 / 1년 전" 변환.
 * null/빈 값은 빈 문자열 반환.
 */
export function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date || !KO_RTF) return ''
  const target = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(target.getTime())) return ''

  const diffSec = Math.round((Date.now() - target.getTime()) / 1000)
  if (diffSec < 5) return '방금 전'
  if (diffSec < 60) return KO_RTF.format(-diffSec, 'second')
  const min = Math.round(diffSec / 60)
  if (min < 60) return KO_RTF.format(-min, 'minute')
  const hr = Math.round(min / 60)
  if (hr < 24) return KO_RTF.format(-hr, 'hour')
  const day = Math.round(hr / 24)
  if (day < 7) return KO_RTF.format(-day, 'day')
  if (day < 30) return KO_RTF.format(-Math.round(day / 7), 'week')
  if (day < 365) return KO_RTF.format(-Math.round(day / 30), 'month')
  return KO_RTF.format(-Math.round(day / 365), 'year')
}
