// apps/web/src/lib/admin/vrl/view-state.ts
//
// VRL 화면의 "0건" 과 "못 읽음" 을 갈라 놓는 순수 층.
//
// 왜 필요한가 — 2026-09-05 실측:
//   taxonomy·diagnostic·snapshots·users 는 조회가 실패해도 `error` 를 보지 않고 빈 배열을
//   넘겼다. 그래서 RLS 거부·statement_timeout 이 화면에서는 **"아직 아무것도 없음"** 과
//   글자 하나 다르지 않게 그려졌다. 관리자는 "채워 넣어야 하는 상태"로 읽고 마이그레이션을
//   찾거나, 반대로 12·6·8·5 가 있어야 할 자리의 0 을 보고 데이터가 날아갔다고 판단한다.
//   둘 다 잘못된 조작으로 이어진다.
//
// 규칙은 하나다: **에러가 하나라도 있으면 그 화면은 "못 읽음" 이다.** 부분적으로 읽힌
// 행이 있어도 마찬가지 — 일부만 보이는 표를 전부인 것처럼 그리면 그게 더 위험하다.

/** 화면 한 덩이(표·카드 그룹)의 적재 상태. */
export type VrlLoadState =
  | { kind: 'unreadable'; detail: string }
  | { kind: 'empty' }
  | { kind: 'ready'; count: number }

/**
 * 여러 조회의 error 를 한 줄로 합친다. 전부 비었으면 null.
 * (한 화면이 4개 테이블을 읽는 taxonomy 같은 경우가 있다.)
 */
export function mergeQueryErrors(
  errors: ReadonlyArray<string | null | undefined>,
): string | null {
  const found = errors
    .map((e) => (typeof e === 'string' ? e.trim() : ''))
    .filter((e) => e.length > 0)
  if (found.length === 0) return null
  // 같은 원인(RLS 거부 등)이 4번 반복되는 경우가 흔해 중복은 접는다.
  const unique = [...new Set(found)]
  return unique.join(' · ')
}

/**
 * 적재 상태 판정 — 화면은 이 결과 하나만 보고 분기한다.
 *
 * `count` 는 "실제로 손에 들어온 행 수" 다. 에러가 있으면 count 는 보지 않는다.
 */
export function resolveVrlLoadState(input: {
  error?: string | null
  count: number
}): VrlLoadState {
  const detail = typeof input.error === 'string' ? input.error.trim() : ''
  if (detail.length > 0) return { kind: 'unreadable', detail }
  if (input.count <= 0) return { kind: 'empty' }
  return { kind: 'ready', count: input.count }
}

/** 못 읽음 상태인가 — 화면에서 `state.kind === 'unreadable'` 대신 쓰는 축약. */
export function isUnreadable(state: VrlLoadState): boolean {
  return state.kind === 'unreadable'
}

/**
 * 사람이 읽는 한 줄. 화면마다 다르게 쓰면 같은 사고를 다르게 설명하게 되므로 여기서 만든다.
 * `subject` 는 "분류 기준표" 처럼 그 화면이 다루는 대상.
 */
export function describeLoadState(state: VrlLoadState, subject: string): string {
  if (state.kind === 'unreadable') {
    return `${subject}를 읽지 못했습니다 — 데이터가 없는 것이 아니라 조회가 실패한 상태입니다.`
  }
  if (state.kind === 'empty') {
    return `${subject}가 아직 없습니다.`
  }
  return `${subject} ${state.count.toLocaleString()}건.`
}
