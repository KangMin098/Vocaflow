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
  // ⚠️ **`base_format` 은 두 가지를 뜻한다** — 「짧아서 지문이 못 된다」와 「길어서 발췌가 필요하다」.
  //    앞은 되돌릴 수 없지만 뒤는 **발췌 생성이 하는 일**이다. 둘을 같이 차단으로 세면 발췌 대기분이
  //    통째로 `policy_exclusion`(「자동 변경 없음 · 수리 큐가 아님」)으로 분류돼 **다음 사람이 그 일을 못 찾는다.**
  //    실측 2026-09-23: 내용 판정 5,011편을 적재하자 그중 3,578편이 `excerpt-blind`(내용 수용 · 발췌 미생성)가
  //    되었는데 전부 `base_format` 을 달고 있어 `excerpt_materialization` 이 0만큼 늘었다(4,071 그대로).
  //    기존 `excerpt-blind` 10,861편도 같은 이유로 오래 묻혀 있었다.
  //    가르는 축은 `excerptStatus` 다 — 어수가 창 상한 이하면 `not-required`(그때의 format 은 진짜 결격),
  //    상한을 넘으면 `candidate`/`missing`(발췌로 푼다).
  const excerptRecoverable = result.contentStatus === 'accepted' &&
    (result.excerptStatus === 'missing' || result.excerptStatus === 'candidate')
  const hardBlockers = ['base_legal', 'base_safety', 'harmful_genre', 'cefr_above_band', 'base_format']
  const excluded = result.contentStatus === 'rejected' ||
    result.blockers.some(x => hardBlockers.includes(x) && !(x === 'base_format' && excerptRecoverable))
  if (!excluded && result.analysisStatus !== 'complete') work.push('analysis_repair')
  if (excluded) work.push('policy_exclusion')
  // Do not spend judgment/generation on sources already excluded by stable policy.
  if (!excluded && result.contentStatus === 'unjudged') work.push(row.gate?.purpose === 'raw' ? 'raw_extraction' : 'content_judgment')
  if (!excluded && result.contentStatus === 'accepted' && result.blockers.includes('excerpt_not_materialized')) work.push('excerpt_materialization')
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
