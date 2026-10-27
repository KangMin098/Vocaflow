// apps/web/src/lib/recommend/own-reading.ts
//
// 추천 P2 입력 — **본인이 이미 열어 둔 개인 글** 하나(순수 선택 · 서버 조회는 get-next-action).
//
// 무엇을 진행 중으로 보나: `texts.status='in_progress'` 는 Workspace 를 열 때 not_started → in_progress 로 바뀌는 **열기 상태**다
//   (lib/library/mark-progress). 읽기 완주 · 이해가 아니다 — 그래서 라벨은 「이어 보기」까지만 말한다.
// 이번 범위: 라이브러리 도서(library_book_id) · 묶음(user_book_group_id) · 출처 표지(source_url — 기사 `article:<id>` 등)가 **없는**
//   개인 글만. 그런 자료의 재개는 권리 · 발행 조건이 따로 걸려 있어 이 입력으로 대신하지 않는다.
// 고르는 순서: updated_at 최신 → id. updated_at 은 행이 마지막으로 바뀐 시각이지 「마지막으로 읽은 시각」이 아니다.

export interface OwnTextRow {
  id: unknown
  title: unknown
  user_id: unknown
  status: unknown
  source_url: unknown
  library_book_id: unknown
  user_book_group_id: unknown
  updated_at: unknown
}

export interface OwnInProgressText {
  id: string
  title: string
}

const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0

/** 조건에 맞는 첫 행 — 소유자 · 상태 · 연결 자료 · 출처 표지 · id/제목을 **행마다 다시** 확인한다(쿼리 조건만 믿지 않는다). */
export function pickOwnInProgressText(rows: ReadonlyArray<OwnTextRow> | null | undefined, ownerId: string): OwnInProgressText | null {
  if (!rows || !ownerId) return null
  const ok = rows.filter(
    (r) =>
      r.user_id === ownerId &&
      r.status === 'in_progress' &&
      r.library_book_id == null &&
      r.user_book_group_id == null &&
      !nonEmpty(r.source_url) &&
      nonEmpty(r.id) &&
      nonEmpty(r.title),
  )
  const time = (r: OwnTextRow) => {
    const t = typeof r.updated_at === 'string' ? Date.parse(r.updated_at) : NaN
    return Number.isFinite(t) ? t : -Infinity
  }
  ok.sort((a, b) => time(b) - time(a) || String(a.id).localeCompare(String(b.id)))
  const top = ok[0]
  return top ? { id: String(top.id), title: String(top.title).trim() } : null
}
