// apps/web/src/lib/reader/public-source-href.ts
// 학습자 화면에 내보낼 원문 출처 주소 — 공개 http(s) 절대 URL 만 통과시킨다.
// javascript:·data:·상대 경로·내부 마커(article:<uuid>)·형식 오류는 null.

export function publicSourceHref(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const s = raw.trim()
  if (!s) return null
  let u: URL
  try {
    u = new URL(s)
  } catch {
    return null
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
  if (!u.hostname) return null
  return u.href
}
