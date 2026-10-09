// apps/web/src/lib/knowledge/review-date.ts
//
// 복습 예약 날짜 — 학습자에게 「1 · 3 · 7일 뒤」는 **한국(Asia/Seoul) 달력 날짜**다(E11 · 2026-10-09).
// 날짜 계산(KST 달력)과 저장 시각(그 KST 날짜의 00:00 = UTC 전날 15:00 timestamptz)을 나눈다.
// UTC 자정으로 내리면 KST 오전에 누른 「1일 뒤」가 당일로 당겨진다(Codex P2) — 그래서 KST 날짜로 센다.
// 한국은 서머타임이 없어 +9시간 고정이다. 시계는 읽지 않는다(호출자가 시각을 넘긴다).

const KST_MS = 9 * 3_600_000

/** ISO 시각 → 그 순간의 KST 날짜 'YYYY-MM-DD' */
export function kstDateOf(iso: string): string {
  return new Date(Date.parse(iso) + KST_MS).toISOString().slice(0, 10)
}

/** 마친 시각의 KST 날짜에서 days 달력일 뒤 — { date: KST 'YYYY-MM-DD', iso: 그 날 KST 00:00 의 UTC ISO } */
export function kstReviewDate(finishedAtIso: string, days: number): { date: string; iso: string } {
  const [y, m, d] = kstDateOf(finishedAtIso).split('-').map(Number)
  // 달력 연산은 UTC 날짜로(월말 · 연말 넘김은 Date.UTC 가 처리) — 시간대 영향 없음
  const date = new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
  return { date, iso: new Date(Date.parse(`${date}T00:00:00+09:00`)).toISOString() }
}
