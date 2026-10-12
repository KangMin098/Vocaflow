// scripts/csat/lib-inquiry-review.mjs
//
// **탐구 데이터 공개 가드 — 「revise 가 아니다」가 아니라 「현재 내용에 대한 독립 pass 가 있다」.** (v3 M2 · CSAT_V3_IMPLEMENTATION_PLAN §5)
//
// 옛 빌드는 문항마다 마지막(파일 이름 순) 판정이 revise 가 아니면 넣었다 — 검수 누락 · 낡은 판정 · 작성자 자기 검수도 통과했다.
// 이 모듈은 판정을 **검수한 내용의 해시**에 묶는다:
//   verified  명시 pass + 검수자 ≠ 작성자 + content_hash = 지금 출력의 해시 + criteria = 현재 기준 버전
//   revise    지금 출력의 해시에 묶인 revise 가 하나라도 있다(같은 내용에 pass 와 revise 가 섞이면 revise 가 이긴다)
//   legacy    해시 결속이 없는 v1 판정만 있고 그 마지막이 revise 가 아니다 — 기존 공개분 보존용. 검증됨으로 승격하지 않는다
//   unreviewed 그 밖(판정 없음 · 해시 불일치뿐 · 자기 검수 · 기준 버전 다름)
// 파일 이름 정렬은 해시 결속 판정에 영향이 없다. 순수 함수 — 파일을 읽지 않는다.

import { createHash } from 'node:crypto'

/** 판정 기준 버전 — WRITER.md / REVIEWER.md 의 정의표가 바뀌면 올린다(올리면 기존 pass 는 unreviewed 가 된다) */
export const CRITERIA_VERSION = 'inquiry-v1.2'

/** 키 순서와 무관한 직렬화 — DB/에디터가 키 순서를 바꿔도 같은 해시(JSON.stringify 비교 금지 · AGENTS) */
export function stableStringify(v) {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`
  if (v && typeof v === 'object') {
    return `{${Object.keys(v)
      .filter((k) => v[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(v)
}

/** 검수 대상 내용 — 화면에 나가는 칸과 결속(analysis_version)만. 작성 메모(review_note 등)는 빼서 문체 수정이 판정을 깨지 않게 한다 */
export function contentHash(item) {
  const body = {
    id: item.id,
    analysis_version: item.analysis_version,
    status: item.status,
    distractors: (item.distractors ?? []).map((d) => ({
      n: d.n,
      truth: d.truth,
      operation: d.operation,
      preserved: d.preserved ?? [],
      altered: d.altered ?? [],
      note: d.note,
    })),
    principle: item.principle ?? null,
    // v3 의미 · 판단 · 설계 칸 — 없으면 undefined 라 직렬화에서 빠져 v1 문항의 해시는 그대로다
    v3: item.v3 ?? undefined,
  }
  return createHash('sha256').update(stableStringify(body)).digest('hex').slice(0, 16)
}

/**
 * @param item     작성 출력 한 문항(.out.json items[]) — writer_run 을 가질 수 있다
 * @param verdicts 이 문항에 대한 모든 판정 [{verdict, reviewer, content_hash?, criteria?, file}]
 * @returns {{ state: 'verified'|'revise'|'legacy'|'unreviewed', reason: string }}
 */
export function classifyReview(item, verdicts, { criteria = CRITERIA_VERSION } = {}) {
  const hash = contentHash(item)
  const writer = item.writer_run ?? null
  const bound = verdicts.filter((v) => v.content_hash === hash)
  if (bound.some((v) => v.verdict === 'revise')) return { state: 'revise', reason: '현재 내용에 revise 판정' }
  const passes = bound.filter((v) => v.verdict === 'pass')
  if (passes.length) {
    const good = passes.find((v) => v.criteria === criteria && v.reviewer && writer && v.reviewer !== writer)
    if (good) return { state: 'verified', reason: `${good.reviewer} pass` }
    if (passes.some((v) => v.criteria !== criteria)) return { state: 'unreviewed', reason: '기준 버전이 다른 pass' }
    if (!writer) return { state: 'unreviewed', reason: '작성 run 이 기록되지 않아 자기 검수를 배제할 수 없음' }
    return { state: 'unreviewed', reason: '작성자 자기 검수' }
  }
  // 해시 결속이 없는 옛(v1) 판정 — 파일 이름 순 마지막 판정. 보존용 legacy 로만 쓴다
  const legacy = verdicts.filter((v) => !v.content_hash).sort((a, b) => String(a.file).localeCompare(String(b.file)))
  if (legacy.length) {
    const last = legacy[legacy.length - 1]
    return last.verdict === 'revise' ? { state: 'revise', reason: 'v1 마지막 판정 revise' } : { state: 'legacy', reason: 'v1 판정(해시 결속 없음)' }
  }
  if (verdicts.length) return { state: 'unreviewed', reason: '판정이 지금 내용과 다름(해시 불일치)' }
  return { state: 'unreviewed', reason: '판정 없음' }
}
