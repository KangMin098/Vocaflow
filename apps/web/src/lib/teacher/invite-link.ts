// apps/web/src/lib/teacher/invite-link.ts
//
// **초대 링크의 단일 출처** — 교사가 복사하는 것과 학생이 도착하는 곳이 같아야 한다.
//
// 왜 파일 하나를 따로 두나: 이 저장소는 같은 것을 두 곳에서 짓다가 갈라진 일을
// 여러 번 겪었다(이름 `axes.ts` · 경로 `protected-routes.ts` · 수치 `trust-signals.ts` ·
// 목록 `content-entries.ts` · 카드 쿼리 `og-queries.ts` · 만화 제목 `display-title.ts`).
// 초대는 **한 글자만 어긋나도 학생이 도착하지 못하고**, 그 실패는 교사 쪽에 보이지 않는다.
//
// ⚠️ 코드는 대문자로 고정한다. `join_class_by_code` 와 `peek_class_by_code` 가
//    `upper(trim(...))` 로 조회하므로, 링크가 소문자를 실어 보내도 동작은 한다.
//    그래도 대문자로 만드는 이유는 **사람이 눈으로 옮겨 적기 때문**이다 —
//    화면의 코드와 링크 속 코드가 다르게 보이면 옮겨 적다가 틀린다.

/** 학생이 도착할 경로. origin 없이 앱 안에서 쓸 때. */
export function invitePath(code: string): string {
  return `/join/${encodeURIComponent(normalizeInviteCode(code))}`
}

/** 클립보드·문자메시지에 들어갈 완전한 주소. */
export function inviteUrl(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, '')}${invitePath(code)}`
}

/** 화면·링크·조회가 같은 형태를 보게 한다. */
export function normalizeInviteCode(code: string): string {
  return (code ?? '').trim().toUpperCase()
}
