// apps/web/src/app/admin/compose/publish-gate.ts
//
// ⑦ 발행 가능 여부 판정 — 화면 안이 아니라 여기서 한다.
//
// 왜 순수 함수로 떼어 두는가: 이 판정이 틀리면 화면은 "발행 가능" 이라 말하고 서버는 거부한다.
// 실제로 그랬다 — 콘텐츠 품질 게이트를 **앞의 20건만** 조회하면서 21번째부터는 조회 자체를
// 안 한 것을 "FAIL 이 없다" 로 셌다(2026-09-06 발견). null(모름)을 0(없음)으로 뭉갠 것이고,
// 이 저장소가 반복해서 겪은 실패 모드다(`safeCount` 의 `?? 0` 주석과 같은 병).
//
// 그래서 규칙 하나를 함수로 못 박는다: **검사하지 못한 글은 통과가 아니라 '미확인' 이고,
// 미확인은 발행을 막는다.** 화면에 그 사유가 그대로 뜬다.

/** 재저작 게이트(I12~I17) 판정 1행. */
export interface ArticleGateRow {
  article_id: string
  invariant: string
  severity: string
  verdict: string
  detail?: string
  content_hash: string
}

/** 콘텐츠 품질 게이트 판정 1행 — 재저작 게이트와 **다른 계열**이고 따로 막는다. */
export interface ArticleContentGateRow {
  article_id: string
  invariant: string
  severity: string
  verdict: string
}

export type PublishBlockReason =
  /** 재저작 게이트 판정이 아예 없다 — 드레인에서 게이트를 돌린 적이 없다 */
  | 'no_gates'
  /** 판정 이후에 본문이 바뀌었다 — 해시가 어긋난다 */
  | 'stale'
  /** 재저작 게이트 critical FAIL */
  | 'gate_failed'
  /** 콘텐츠 품질 게이트 critical FAIL */
  | 'content_gate_failed'
  /** 콘텐츠 품질 게이트를 **조회하지 못했다** — 통과가 아니라 모름 */
  | 'content_gate_unchecked'

export const PUBLISH_BLOCK_LABEL: Record<PublishBlockReason, string> = {
  no_gates: '게이트 판정이 없습니다 — 드레인에서 게이트를 실행해야 발행할 수 있습니다.',
  stale: '본문이 판정 이후에 바뀌었습니다 — 게이트를 다시 실행해야 합니다.',
  gate_failed: '재저작 게이트가 막고 있습니다.',
  content_gate_failed: '콘텐츠 품질 게이트가 막고 있습니다.',
  content_gate_unchecked:
    '콘텐츠 품질 게이트 미확인 — 이 글은 이번 조회 범위 밖이라 판정을 읽지 못했습니다. 통과했다는 뜻이 아니므로 발행을 막습니다. 검수 대기 건수를 줄이거나(먼저 발행·폐기) 잠시 뒤 다시 여세요.',
}

export interface PublishVerdict {
  /** 이 글의 재저작 게이트 판정 전부 */
  gates: ArticleGateRow[]
  /** 본문 해시가 어긋난 판정 */
  stale: ArticleGateRow[]
  /** critical FAIL 인 재저작 게이트 */
  failed: ArticleGateRow[]
  /** critical FAIL 인 콘텐츠 품질 게이트 */
  contentFailed: ArticleContentGateRow[]
  /** 콘텐츠 품질 게이트를 실제로 조회했는가. false = 모름(통과 아님) */
  contentGateChecked: boolean
  blocked: boolean
  reasons: PublishBlockReason[]
}

export interface PublishGateInput {
  articleId: string
  /** library_articles.content_hash — 판정이 이 해시로 찍혔는지 본다 */
  contentHash: string | null
  /** 화면이 들고 있는 재저작 게이트 전체(글별로 걸러 준다) */
  gates: readonly ArticleGateRow[]
  /** 화면이 들고 있는 콘텐츠 게이트 전체(글별로 걸러 준다) */
  contentGates: readonly ArticleContentGateRow[]
  /** 콘텐츠 게이트를 **실제로 조회한** 글 id 집합. 여기 없으면 미확인이다. */
  contentGateCheckedIds: ReadonlySet<string>
}

/**
 * 한 글의 발행 차단 사유를 전부 모은다.
 *
 * `contentGateCheckedIds` 에 없는 글은 `content_gate_unchecked` 로 **막는다** —
 * 조회하지 않은 것을 통과로 세면 화면이 서버와 다른 답을 하게 된다.
 */
export function evaluatePublishGate(input: PublishGateInput): PublishVerdict {
  const gates = input.gates.filter((g) => g.article_id === input.articleId)
  const stale = gates.filter((g) => g.content_hash !== input.contentHash)
  const failed = gates.filter((g) => g.severity === 'critical' && g.verdict === 'FAIL')
  const contentGateChecked = input.contentGateCheckedIds.has(input.articleId)
  const contentFailed = contentGateChecked
    ? input.contentGates.filter(
        (g) =>
          g.article_id === input.articleId && g.severity === 'critical' && g.verdict === 'FAIL',
      )
    : []

  const reasons: PublishBlockReason[] = []
  if (gates.length === 0) reasons.push('no_gates')
  if (stale.length > 0) reasons.push('stale')
  if (failed.length > 0) reasons.push('gate_failed')
  if (!contentGateChecked) reasons.push('content_gate_unchecked')
  else if (contentFailed.length > 0) reasons.push('content_gate_failed')

  return {
    gates,
    stale,
    failed,
    contentFailed,
    contentGateChecked,
    blocked: reasons.length > 0,
    reasons,
  }
}

// ── 콘텐츠 게이트 조회 범위 ──────────────────────────────────────────
//
// 판정 1건마다 RPC 1회다(run_content_quality_gates 는 글 하나만 받는다). 전량을 한 줄로
// 돌리면 화면이 열리지 않으므로 **묶어서 병렬로** 돌리고, 그래도 넘치면 남은 것을
// '미확인' 으로 **말한다**. 조용히 자르는 것과 잘랐다고 말하는 것의 차이가 이 결함의 전부였다.

/** 한 번의 화면 렌더에서 조회할 최대 글 수. */
export const CONTENT_GATE_SCAN_MAX = 60
/** 동시에 던지는 RPC 수 — 커넥션 풀을 다 쓰지 않을 만큼만. */
export const CONTENT_GATE_SCAN_CHUNK = 20

export interface ContentGateScanPlan {
  /** 실제로 조회할 id — CONTENT_GATE_SCAN_CHUNK 묶음으로 잘라 둔다 */
  chunks: string[][]
  /** 조회 대상 전체(평탄) */
  scanned: string[]
  /** 상한을 넘겨 조회하지 못하는 id — 화면에서 '미확인' 이 된다 */
  skipped: string[]
}

export function planContentGateScan(ids: readonly string[]): ContentGateScanPlan {
  const scanned = ids.slice(0, CONTENT_GATE_SCAN_MAX)
  const skipped = ids.slice(CONTENT_GATE_SCAN_MAX)
  const chunks: string[][] = []
  for (let i = 0; i < scanned.length; i += CONTENT_GATE_SCAN_CHUNK) {
    chunks.push(scanned.slice(i, i + CONTENT_GATE_SCAN_CHUNK))
  }
  return { chunks, scanned: [...scanned], skipped: [...skipped] }
}
