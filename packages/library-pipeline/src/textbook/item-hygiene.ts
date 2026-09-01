// packages/library-pipeline/src/textbook/item-hygiene.ts
//
// **문항 하나를 학습자에게 내보내도 되는가 — 판정과 정제를 한 벌로 둔다.**
//
// ── 왜 이 파일이 생겼나 (실측 2026-09-01) ────────────────────────────
// 게이트 다섯(길이·기사 껍데기·인용 잔해·잘린 조각·소재)과 정제 체인(절 이름·반복 꼬리·
// 구두점·따옴표·눌어붙은 제목)을 여러 사이클에 걸쳐 세웠는데, **전부 조판 경로에만
// 걸려 있었다.** 학습자가 실제로 문제를 푸는 `/library/textbooks/[step]/practice` 는
// `textbook_practice_items` RPC 로 창고에서 곧장 가져오고, 그 RPC 는 유형 화이트리스트와
// `v_level` · 발행 상태만 본다. 그래서 연습 후보 안에 이만큼이 남아 있었다:
//
//   소재 부적합  **14,738문항**  (V6 12,567 · V7 1,610 · V5 526 · V4 17 · V8 18)
//   철회 논문      **168문항**  (V6 91 · V7 77)
//   절 이름 잔존      56문항
//
// 조판물은 깨끗한데 학습자가 받는 것은 아니었다 — 이 저장소가 되풀이해 온
// **"만든 것과 실리는 것은 다르다"** 의 가장 비싼 판이다.
//
// ⚠️ 정제는 **TypeScript 에서만** 할 수 있다(정규식 체인이다). RPC 안으로 넣을 수 없으므로
//   판정 일부를 DB 로 옮기더라도 이 파일은 남는다. 두 경로가 같은 함수를 부르게 하는 것이
//   목적이지, 어디서 거르느냐가 목적이 아니다.
import {
  dropDuplicatedLeadWord,
  dropRepeatedTail,
  hasArticleChrome,
  hasSensitiveTopic,
  hasUnbalancedParens,
  isPrintablePassage,
  normalizeQuotes,
  pairStraightQuotes,
  stripSectionLabels,
  stripSpaceBeforePunct,
} from './csat-format'

/**
 * 철회·취하된 논문인가 — **제목으로만 알 수 있다.**
 *
 * 재고에 `RETRACTED:` 로 시작하는 원글이 16편 있고 그중 10편에 문항 268개가 붙어 있었다
 * (한 편은 120개, 실측 2026-08-31). 철회된 연구를 지문으로 실으면 교재의 신뢰가 통째로
 * 깎이는데, **지문 자체는 멀쩡히 읽히므로 자동 검수로는 안 걸린다.**
 *
 * 철회를 **다룬** 글("Retraction studies in ethics")은 통과해야 한다 — 그래서 앞머리를 본다.
 */
export function isRetractedTitle(title: string | null | undefined): boolean {
  const t = String(title ?? '').trim()
  return /^(retracted|withdrawn)/i.test(t) || t.toLowerCase().includes('[retracted')
}

/**
 * 인쇄·출제에 쓰는 사본으로 다듬는다.
 *
 * ⚠️ **순서는 안에서 밖으로 읽는다.** 절 이름 → 반복 꼬리 → 눌어붙은 제목 →
 *   구두점 앞 공백 → 아포스트로피 → 큰따옴표. 제목 제거를 꼬리 절단보다 뒤에 두는 이유는,
 *   꼬리 대조가 **글머리와 글자 그대로** 같은지를 보기 때문이다 — 글머리를 먼저 손대면
 *   대조가 깨져 중복이 그대로 남는다.
 */
export function cleanPassageText(value: string): string {
  return pairStraightQuotes(
    normalizeQuotes(
      stripSpaceBeforePunct(dropDuplicatedLeadWord(dropRepeatedTail(stripSectionLabels(value)))),
    ),
  )
}

/** 지문이 담기는 payload 키. `presented` 를 빠뜨리면 순서 문항이 통째로 새어 나간다. */
export const PASSAGE_KEYS = [
  'passage',
  'intro',
  'stem',
  'context',
  'insert_sentence',
  'summary_sentence',
] as const

/** 문장 배열로 담기는 키. */
export const PASSAGE_ARRAY_KEYS = ['sentences', 'presented', 'remaining', 'choices'] as const

/** payload 전체를 정제한 사본으로 바꾼다. 저장은 건드리지 않는다. */
export function cleanItemPayload<T extends Record<string, unknown>>(raw: T): T {
  if (!raw || typeof raw !== 'object') return raw
  const out: Record<string, unknown> = { ...raw }
  for (const k of PASSAGE_KEYS) {
    if (typeof out[k] === 'string') out[k] = cleanPassageText(out[k] as string)
  }
  for (const k of PASSAGE_ARRAY_KEYS) {
    const v = out[k]
    if (Array.isArray(v)) {
      out[k] = v.map((x) => (typeof x === 'string' ? cleanPassageText(x) : x))
    }
  }
  return out as T
}

/** 이 문항이 품은 지문을 한 덩이로 모은다 — 판정은 그 위에서 한다. */
export function passageTextOf(payload: Record<string, unknown> | null | undefined): string {
  if (!payload) return ''
  let text = ''
  for (const k of PASSAGE_KEYS) {
    const v = payload[k]
    if (typeof v === 'string') text += ` ${v}`
  }
  for (const k of PASSAGE_ARRAY_KEYS) {
    const v = payload[k]
    if (Array.isArray(v)) {
      text += ` ${v.map((x) => (typeof x === 'string' ? x : '')).join(' ')}`
    }
  }
  return text.trim()
}

/** 왜 못 내보내는지 — 세어서 남기려고 이름을 붙인다. 통과면 `null`. */
export type HygieneReject =
  | 'retracted'
  | 'sensitive'
  | 'chrome'
  | 'residue'
  | 'nonProse'
  | 'cutFragment'

/**
 * **학습자에게 내보내도 되는 문항인가.** 조판의 게이트와 같은 판정을 쓴다.
 *
 * `refTitle` 도 본다 — 지문은 중립적인데 출처가 `…abortion care?` 인 경우가 있고,
 * 출처는 화면에도 인쇄물에도 함께 나가며 원문으로 가는 길이다.
 *
 * ⚠️ **초등 3종은 사전에서 나온다** — 원글이 없어 이 판정의 대상이 아니다.
 *   호출부가 그 유형을 넘기지 않도록 한다(넘겨도 지문이 비어 통과한다).
 */
export function itemHygieneReject(input: {
  payload: Record<string, unknown> | null | undefined
  refTitle?: string | null
}): HygieneReject | null {
  const title = String(input.refTitle ?? '')
  if (isRetractedTitle(title)) return 'retracted'
  if (hasSensitiveTopic(title)) return 'sensitive'

  const text = passageTextOf(input.payload)
  if (!text) return null
  if (hasSensitiveTopic(text)) return 'sensitive'
  if (hasArticleChrome(text)) return 'chrome'
  if (hasUnbalancedParens(text)) return 'cutFragment'
  // 인용 잔해·비산문은 `isPrintablePassage` 가 한 벌로 판정한다.
  if (!isPrintablePassage(text)) return 'residue'
  return null
}
