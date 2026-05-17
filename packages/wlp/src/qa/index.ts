// packages/wlp/src/qa/index.ts
// VCB QA Gate barrel — runQaGate 가 R1~R8 룰을 순차 적용.

import {
  checkR1Schema,
  checkR2MinDefinitionsKo,
  checkR3LemmaInExamples,
  checkR4KoLengthValid,
  checkR5CefrNgslConsistent,
  checkR6Confidence,
  checkR7Profanity,
  checkR8SelfReference,
  type QaItem,
  type QaResult,
  type QaFlag,
} from './rules'

export * from './rules'

/**
 * QA 룰 R1~R8 을 순차 적용한 결과 반환.
 *
 * R1 실패 시 즉시 reject (이후 룰 적용 불가).
 * R8 auto-fix 발생 시 fixed_item 반환 (synonyms/antonyms 에서 lemma 자기 자신 제거).
 *
 * @param item EnrichedItem (vcb-core 의 EnrichedItem 과 호환 형태)
 * @param ctx 외부 의존 데이터 (NGSL rank, denylist)
 */
export function runQaGate(
  item: unknown,
  ctx: {
    ngslRank?: number | null
    profanityDenylist?: ReadonlyArray<string>
  } = {}
): QaResult {
  const r1Flags = checkR1Schema(item)
  if (r1Flags.length > 0) {
    return {
      passed: false,
      flags: r1Flags,
    }
  }

  let currentItem = item as QaItem
  const allFlags: QaFlag[] = []

  allFlags.push(...checkR2MinDefinitionsKo(currentItem))
  allFlags.push(...checkR3LemmaInExamples(currentItem))
  allFlags.push(...checkR4KoLengthValid(currentItem))
  allFlags.push(...checkR5CefrNgslConsistent(currentItem, ctx.ngslRank ?? null))
  allFlags.push(...checkR6Confidence(currentItem))
  allFlags.push(...checkR7Profanity(currentItem, ctx.profanityDenylist ?? []))

  const r8 = checkR8SelfReference(currentItem)
  allFlags.push(...r8.flags)
  if (r8.fixed) {
    currentItem = r8.fixed
  }

  const hasReject = allFlags.some((f) => f.severity === 'reject')

  return {
    passed: !hasReject,
    flags: allFlags,
    fixed_item: r8.fixed ? currentItem : undefined,
  }
}
