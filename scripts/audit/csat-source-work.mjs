// scripts/audit/csat-source-work.mjs
// Work discovery consumes canonical decisions; it never grants eligibility.
export const WORK = {
  cache_refresh: { group: 'A', priority: 'P0', asset: 'scripts/textbook/source-policy-refresh.mjs', risk: 'low', cost: 'DB reads + changed cache rows only', dependency: 'current source and item references' },
  analysis_repair: { group: 'B', priority: 'P1', asset: 'scripts/acp/reprocess.mjs', risk: 'medium', cost: 'lexicon reads and vocabulary writes', dependency: 'source integrity; inspect missing field before full reanalysis' },
  content_judgment: { group: 'B', priority: 'P1', asset: 'scripts/csat/gate-article-export.mjs / gate-book-export.mjs', risk: 'medium', cost: 'agent reading; no provider call required', dependency: 'source integrity; UUID/revision-bound judgment' },
  raw_extraction: { group: 'C', priority: 'P2', asset: 'scripts/csat/plos-extract.mjs', risk: 'high', cost: 'body reads, derivative insertion and analysis', dependency: 'demand; source deduplication; excerpt validation before judgment' },
  excerpt_materialization: { group: 'C', priority: 'P2', asset: 'scripts/textbook/store-new-types.mjs', risk: 'high', cost: 'question generation and review', dependency: 'accepted content, CEFR, demand and validated excerpt' },
  quality_review: { group: 'C', priority: 'P1', asset: 'scripts/textbook/extraction-defect-scan.mjs', risk: 'high for text changes', cost: 'source-stratified reading and anchor verification', dependency: 'parser fix and confirmed defect; flags alone never reject' },
  policy_exclusion: { group: 'D', priority: 'P3', asset: 'packages/library-pipeline/src/textbook/source-eligibility.ts', risk: 'high if relaxed', cost: 'no automatic mutation', dependency: 'only review for a concrete downstream requirement; not a repair queue' },
}

export function discoverWork(row, result, cache, cacheDrift) {
  const work = []
  if (cacheDrift) work.push('cache_refresh')
  if (cache?.quality_flags?.length) work.push('quality_review')
  // ⚠️ **길이는 원문 적격의 축이 아니다**(2026-09-23 사용자 결정). 원문에서 지문을 뜨는 것은
  //    교재 생성 단계의 별도 공정이고, 그 공정은 유형마다 다른 창을 쓴다(`compose-unit.itemWordSpec`:
  //    문장 6~40 · 학교 문단 40~200 · 수능 90~200 · 장문 260~400). 수능 창 하나로 원문을 거르면
  //    나머지 유형의 재료가 사라진다 — 실측 2026-09-23: 장문 창에 자르지 않고 그대로 맞는 22,209편이
  //    `excerpt-blind` 였고, 학교 문단 창에 맞는 108편이 하한 100어에 걸려 영구 탈락해 있었다.
  //    그래서 `base_format` 도 `excerpt_not_materialized` 도 **더 이상 차단으로 오지 않는다.**
  //    발췌 대기분을 세는 축은 이제 `excerptStatus` **관찰값** 하나다(상한 초과면 candidate/missing).
  const hardBlockers = ['base_legal', 'base_safety', 'harmful_genre', 'cefr_above_band']
  const excluded = result.contentStatus === 'rejected' || result.blockers.some(x => hardBlockers.includes(x))
  if (!excluded && result.analysisStatus !== 'complete') work.push('analysis_repair')
  if (excluded) work.push('policy_exclusion')
  // Do not spend judgment/generation on sources already excluded by stable policy.
  if (!excluded && result.contentStatus === 'unjudged') work.push(row.gate?.purpose === 'raw' ? 'raw_extraction' : 'content_judgment')
  if (!excluded && result.contentStatus === 'accepted' &&
    (result.excerptStatus === 'missing' || result.excerptStatus === 'candidate')) work.push('excerpt_materialization')
  return work
}

export function addWork(matrix, key, row, result, cache) {
  const bucket = matrix[key] ??= { ...WORK[key], count: 0, linkedSources: 0, recordedLinkedItems: 0, ids: [], bySource: {}, reasons: {} }
  bucket.count++
  bucket.ids.push(row.id)
  bucket.bySource[row.source] = (bucket.bySource[row.source] ?? 0) + 1
  if (cache?.linked_items > 0) bucket.linkedSources++
  bucket.recordedLinkedItems += cache?.linked_items ?? 0
  for (const reason of result.blockers) bucket.reasons[reason] = (bucket.reasons[reason] ?? 0) + 1
}
