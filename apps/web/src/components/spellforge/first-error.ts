// apps/web/src/components/spellforge/first-error.ts
// T-0238 — 이번 판에서 처음 틀리게 제출한 철자(완료 복기의 「처음 틀리게 제출한 입력 / 정답 철자」 대조용).
// - delayed · blind 의 제출이 기존 평가에서 incorrect 로 처리된 순간에만 부른다(realtime 미제출 타이핑 · 건너뜀 · 빈 입력은 넣지 않는다).
// - 낱말마다 첫 값 하나만 — 그 뒤 다른 오답 · 재시도 · 정답이 덮지 않는다. 입력은 기존 입력 처리(IME 검사 · 소문자화)를 거친 값이다.
// - 판 주인(owner = 본인 · 자료 · 판 시작)과 낱말 id + 철자에 묶는다. 주인이 바뀌면 처음부터, 같은 id 라도 철자가 다르면 붙이지 않는다.
// - 화면 메모리뿐 — URL · 이벤트 · 로그 · 저장소 · DB 로 보내지 않는다. 점수 · FSRS · SRS 와 무관하다.

export interface FirstErrors {
  owner: string
  entries: Readonly<Record<string, { text: string; input: string }>>
}

export const NO_FIRST_ERRORS: FirstErrors = { owner: '', entries: {} }

/** 지금 props 의 자료 · 낱말(id + 철자) 서명 — 같은 인스턴스에서 자료나 같은 id 의 철자가 바뀌면 달라진다. */
export function firstErrorMaterial(content: { type: string; id?: string; chapter?: number } | null | undefined, words: readonly { id: string; text: string }[]): string {
  const c = content ? `${content.type}:${content.id ?? ''}:${content.chapter ?? ''}` : '-'
  return `${c}#${words.map((w) => `${w.id}\u0000${w.text}`).join('\u0001')}`
}

/** 판 주인 — 본인(로그인 없음 · 주인 미지정 구분) · 자료 id · 판 시작 시각 · 지금 props 의 자료 · 낱말 서명(firstErrorMaterial). */
export function firstErrorOwner(viewerId: string | null | undefined, textId: string, startedAtMs: number, material = ''): string {
  const who = viewerId === undefined ? 'unbound' : viewerId === null ? 'anon' : `u:${viewerId}`
  return `${who}|${textId}|${startedAtMs}|${material}`
}

/** incorrect 로 처리된 제출 한 번 — 이 판 · 이 낱말의 첫 값이면 넣고, 아니면 그대로. */
export function recordFirstError(state: FirstErrors, owner: string, word: { id: string; text: string }, input: string): FirstErrors {
  const base = state.owner === owner ? state : { owner, entries: {} }
  if (input.trim() === '') return base
  const had = base.entries[word.id]
  if (had && had.text === word.text) return base
  return { owner, entries: { ...base.entries, [word.id]: { text: word.text, input } } }
}

/** 지금 판 · 지금 철자에 맞는 첫 오입력(없으면 null). */
export function firstErrorFor(state: FirstErrors, owner: string, word: { id: string; text: string }): string | null {
  if (state.owner !== owner) return null
  const e = state.entries[word.id]
  return e && e.text === word.text ? e.input : null
}
