// apps/web/src/lib/csat/lecture/focus.ts
//
// **말한 문장 = 켜진 막대.** 큐가 분석 블록(정답·오답 칩, 지도 전체)을 가리키면 지문 지도는 그 블록에
// 붙은 문장을 켠다. 그런데 오답을 지우는 근거는 흔히 **다른 문장**에 있다 — 대본이 「일곱 번째 문장」이라고
// 말하는데 화면은 네 번째 막대를 켜 두는 일이 색인 775큐 중 145큐(120문항)에서 났다(2026-09-17 실측).
//
// 배제 큐는 규칙상 오답 블록을 가리켜야 하므로(`validate.ts` ROLE_TARGETS) 타깃을 문장으로 바꿀 수 없다.
// 그래서 큐에 **말한 문장 번호**(`focus`)를 따로 싣고, 지도가 켜려던 문장에 그것이 없으면 그쪽을 켠다.
// 지도(골격) 데이터가 나중에 바뀌어도 어긋나지 않도록, 판정은 적재 때가 아니라 **그릴 때** 한다.
//
// ⚠️ 이 파일은 `@/` 별칭을 쓰지 않는다 — 드레인 스크립트(tsx)가 그대로 import 한다.

import type { LectureCue } from './types'

const UNIT: Record<string, number> = { 한: 1, 두: 2, 세: 3, 네: 4, 다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8, 아홉: 9 }

/** 「첫」 「세」 「열한」 「스무」 「스물세」 「서른」 … → 수. 문장 번호로 쓰일 만한 1~49 만. */
const ORDINALS: Record<string, number> = (() => {
  const out: Record<string, number> = { 첫: 1, 두: 2, 세: 3, 네: 4, 다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8, 아홉: 9, 열: 10, 스무: 20, 서른: 30, 마흔: 40 }
  for (const [tens, base] of [['열', 10], ['스물', 20], ['서른', 30], ['마흔', 40]] as const)
    for (const [u, n] of Object.entries(UNIT)) out[`${tens}${u}`] = base + n
  return out
})()

const SPOKEN = new RegExp(
  `(?<![가-힣])(${Object.keys(ORDINALS).sort((a, b) => b.length - a.length).join('|')})(?:\\s*번째)?\\s*문장`,
  'g',
)

/**
 * 한국어 대본에서 「N번째 문장」·「첫 문장」으로 말한 문장을 0부터의 번호로 돌려준다(중복 없음, 말한 순서).
 * `count` 밖의 번호는 버린다 — 막대가 없는 곳을 켤 수는 없다.
 */
export function spokenSentenceIndices(ko: string, count: number): number[] {
  const out: number[] = []
  for (const m of ko.matchAll(SPOKEN)) {
    const k = ORDINALS[m[1]] - 1
    if (k >= 0 && k < count && !out.includes(k)) out.push(k)
  }
  return out
}

/**
 * 지도가 따라가는 분석 블록 — 지도 전체와 지도 칩(정답·오답). 도입·전략·정리 블록을 가리키는 큐는
 * 학습자의 눈이 그 블록에 있으므로 지도 막대를 바꾸지 않는다(눈이 없는 곳이 켜지면 소음이다).
 */
const MAP_FOLLOWS = /^(map|answer|reject:\d+)$/

/** 큐 하나의 `focus` — 지도 블록을 가리키는 큐만. 없으면 undefined(필드를 싣지 않는다). */
export function cueFocus(cue: Pick<LectureCue, 'target' | 'segments'>, sentenceCount: number): number[] | undefined {
  if (cue.target?.kind !== 'analysis' || !MAP_FOLLOWS.test(cue.target.id) || sentenceCount <= 0) return undefined
  const ko = cue.segments.filter((g) => g.lang === 'ko-KR').map((g) => g.text).join(' ')
  const ks = spokenSentenceIndices(ko, sentenceCount).slice(0, 3)
  return ks.length ? ks : undefined
}

/** 큐 목록에 `focus` 를 채운다(있던 값은 다시 계산해 덮는다 — 재실행 안전). */
export function withFocus<T extends Pick<LectureCue, 'target' | 'segments'> & { focus?: number[] }>(cues: T[], sentenceCount: number): T[] {
  return cues.map((c) => {
    const { focus: _old, ...rest } = c
    const f = cueFocus(c, sentenceCount)
    return (f ? { ...rest, focus: f } : rest) as T
  })
}

/**
 * 지도가 이번 큐에 켤 막대. 블록에 붙은 문장(`anchorLit`)이 말한 문장을 하나라도 품으면 그대로 두고,
 * 하나도 품지 않으면(또는 블록에 붙은 문장이 없으면) 말한 문장을 켠다.
 */
export function litForCue(anchorLit: number[], focus: number[] | null | undefined): number[] {
  if (!focus?.length) return anchorLit
  return focus.some((k) => anchorLit.includes(k)) ? anchorLit : focus
}
