// packages/library-pipeline/src/textbook/insert-coordinates.ts
//
// 삽입 해설의 후보 번호(①~⑤) → 학습 화면의 실제 이음매.
//
// 왜: 학습 화면(DcpInsertItem)은 첫 문장 앞부터 끝까지 **모든 이음매(0..n)** 를 후보로 내고 그 순번으로 제출한다.
//   그런데 `insert_seam` 해설은 해설을 만들 때 쓴 **인쇄 후보 번호**로 말한다 — 5~9문장은 `pickSlots` 가 고른
//   다섯 자리, 그보다 짧으면 1..n(explain-fill.mjs `explainSeamItem` 과 같은 갈래). 그래서 해설의 「③」은
//   화면의 세 번째 자리가 아니다. 숫자 정답(position)이 틀린 것이 아니라 **좌표계가 둘**이다.
//
// ⚠️ 정답(position)으로 후보를 만든다 — **채점 뒤에만** 부른다. 채점 전에 그리면 정답이 든 후보 묶음이 힌트가 된다.
// ⚠️ 추정 번호를 붙이지 않는다. 저장된 해설의 문장 조각이 그 자리의 실제 앞뒤 문장과 **모두 맞을 때만** 대응을 돌려준다.
//   배치 해설로 덮어쓴 것 · 옛 형식 · 인용 잔해 · 범위 밖 key 는 null — 화면은 해설 문장만 그대로 보인다.

import { CSAT_INSERT_BODY, hasCitationResidue, pickSlots } from './csat-format'
import { CIRCLED, head, tail } from './seam-fragments'

export interface InsertSeamCandidate {
  /** 해설이 쓰는 번호(①~⑤) */
  label: string
  /** 화면 이음매 — remaining[seam-1] 과 remaining[seam] 사이(제출 position 과 같은 좌표) */
  seam: number
  correct: boolean
}

/** 해설을 만들 때의 후보 자리 — explain-fill 의 갈래(인쇄 규격 → 짧은 문항)를 그대로 따른다. */
function seamSlots(remaining: ReadonlyArray<string>, insertSentence: string, position: number): number[] | null {
  const n = remaining.length
  if (!Number.isInteger(position) || position < 1 || position > n) return null
  if (hasCitationResidue(`${remaining.join(' ')} ${insertSentence}`)) return null
  if (n >= CSAT_INSERT_BODY.min && n <= CSAT_INSERT_BODY.max) return pickSlots(n, position)
  if (n < 2 || n > CIRCLED.length) return null // 5곳 넘게 1..n 으로 매기면 ①~⑤ 로 부를 수 없다
  return Array.from({ length: n }, (_, i) => i + 1)
}

/** 오답 자리 문장 — `① 는 "앞 조각" 와 "뒤 조각" 사이를 가른다`. 원문 인용 안의 원문자는 따옴표 안이라 잡히지 않는다. */
const WRONG_CLAUSE = /(?:^|; |\. )([①②③④⑤]) 는 "([^"]*)" 와 "([^"]*)" 사이를 가른다/g

export function insertSeamCandidates(input: {
  remaining: ReadonlyArray<string>
  insertSentence: string
  position: unknown
  explanation: unknown
  writer: unknown
}): InsertSeamCandidate[] | null {
  const { remaining, insertSentence, position, explanation, writer } = input
  if (writer !== 'insert_seam' || typeof explanation !== 'string' || typeof position !== 'number') return null
  const slots = seamSlots(remaining, insertSentence, position)
  if (!slots) return null
  const answerLabel = CIRCLED[slots.indexOf(position)]
  const text = explanation.replace(/\s+/g, ' ').trim()
  if (!answerLabel || !text.startsWith(`정답은 ${answerLabel} 다.`)) return null
  // 정답 자리도 **현재 본문 · 삽입 문장**과 묶는다 — 번호와 오답 조각만 보면 key 가 한 칸 옮겨지거나 삽입 문장이
  //   바뀌어도 옛 해설을 새 자리에 붙인다(Codex 반례: USGS position 6→5 · 삽입 문장 교체). 생성기(explainInsertSeam)가
  //   쓰는 그 문구 그대로 확인하고, 길이 예산으로 빠져 확인할 근거가 없으면 대응하지 않는다.
  const before = remaining[position - 1]
  const after = remaining[position]
  if (!before) return null
  const seamPhrase = after
    ? `거기 넣으면 "${tail(before, 30)}" → "${head(insertSentence, 45)}" → "${head(after, 30)}" 로 이어진다.`
    : `글의 끝자리다 — 앞 문장 "${tail(before, 30)}" 뒤에 놓인다.`
  if (!text.includes(seamPhrase)) return null

  const out: InsertSeamCandidate[] = [{ label: answerLabel, seam: position, correct: true }]
  for (const m of text.matchAll(WRONG_CLAUSE)) {
    const label = m[1] as (typeof CIRCLED)[number]
    const seam = slots[CIRCLED.indexOf(label)]
    if (seam == null || label === answerLabel) return null
    const before = remaining[seam - 1]
    const after = remaining[seam]
    // 조각이 하나라도 그 자리의 앞뒤 문장과 다르면 이 해설은 이 좌표로 쓰인 것이 아니다 — 통째로 대응하지 않는다
    if (!before || !after || m[2] !== tail(before, 26) || m[3] !== head(after, 26)) return null
    out.push({ label, seam, correct: false })
  }
  return out.sort((a, b) => a.seam - b.seam)
}
