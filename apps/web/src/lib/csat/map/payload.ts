// apps/web/src/lib/csat/map/payload.ts
//
// 학습 지도 쓰기 입력 검증(순수 함수 — 서버 · 테스트 공용).

/** { target: 0~100 정수 } → 목표 점수. 모양이 다르면 null */
export function parseGoal(body: unknown): number | null {
  if (!body || typeof body !== 'object') return null
  const v = (body as Record<string, unknown>).target
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 100 ? v : null
}

/** 과제 id — `A1-1` · `B10-3` 형태(라인 코드 + 순번). 아니면 null */
export function parseTaskId(raw: string): string | null {
  return /^[A-J]\d{1,2}-\d{1,2}$/.test(raw) ? raw : null
}
