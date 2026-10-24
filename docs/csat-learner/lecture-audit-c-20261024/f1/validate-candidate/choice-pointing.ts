// docs/csat-learner/lecture-audit-c-20261024/f1/validate-candidate/choice-pointing.ts
// validate.ts 후보(owner csat-lecture-disclosure 결정 전 — 제품 코드에 넣지 않았다).
// 「여기 사 번 문장」처럼 선지 번호로 문장을 가리키면, 화면이 켠 anchor 가 그 원문자 ⓝ 이 붙은 문장이어야 한다.
// 기존 `pointing`(「여기 N번째 문장」 서수 ↔ anchor k+1)의 짝이다 — 35번 29강의 중 9강의가 도입 문장을 켰다(대량작업 C).

const CHOICE: Record<string, number> = { 일: 1, 이: 2, 삼: 3, 사: 4, 오: 5 }
// 「여기 사 번 문장」 · 「여기, 삼 번 문장」. 「번째」가 붙으면 서수라 기존 검사 몫이다.
const HERE_CHOICE = /여기[,\s]*(일|이|삼|사|오)\s*번\s+문장/g

/** 「여기 사 번 문장을 보세요」 → [4]. 「사 번째 문장」 · 「여기」 없는 언급은 세지 않는다. */
export function spokenHereChoices(ko: string): number[] {
  return [...ko.matchAll(HERE_CHOICE)].map((m) => CHOICE[m[1]])
}

export interface ChoicePointingIssue {
  code: 'pointing-choice'
  cue: string
  msg: string
}

/**
 * choiceSentence: 선지 번호 → 원문자 ⓝ 이 붙은 문장 index(0-기준). 모르면 검사하지 않는다(건너뜀은 통과가 아니다 — 호출 측이 센다).
 */
export function checkChoicePointing(
  cues: { id: string; target?: { kind: string; id: string }; segments?: { lang: string; text: string }[] }[],
  choiceSentence: Record<number, number> | null,
): ChoicePointingIssue[] {
  if (!choiceSentence) return []
  const out: ChoicePointingIssue[] = []
  for (const c of cues) {
    const ko = (c.segments ?? []).filter((g) => g.lang === 'ko-KR').map((g) => g.text).join(' ')
    for (const n of spokenHereChoices(ko)) {
      const want = choiceSentence[n]
      if (want == null) continue
      const k = c.target?.kind === 'anchor' && /^sentence:\d+$/.test(c.target.id) ? Number(c.target.id.split(':')[1]) : NaN
      if (k !== want)
        out.push({ code: 'pointing-choice', cue: c.id, msg: `「여기 ${n}번 문장」이라 말하는데 화면은 ${c.target?.kind}:${c.target?.id} 를 켠다(ⓝ 문장 sentence:${want})` })
    }
  }
  return out
}
