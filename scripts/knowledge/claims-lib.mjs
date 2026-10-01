// scripts/knowledge/claims-lib.mjs
// 강사 영상 → 학습 원리 등록부: **주장 단위** 검토 파일의 계약과 검증(순수). 형식 설명은 docs/methodology/claim-extraction.md.
//
// 한 줄 = 주장 하나(영상 하나가 아니다). 사람이나 원문을 가진 검토자가 영상과 대조해 판정을 적는다.
// 가져오기는 verdict 가 'import' 이고 이 검증을 통과한 줄만 받는다 — 판정 없는 후보는 한 줄도 안 들어간다.
// 자막 원문은 이 파일에 두지 않는다: 방법·절차·구간은 전부 재서술이다.

/** 주장 종류 → 근거 귀속. 수업 순서(관찰)를 강사의 권고(stated)로 바꾸지 않는다. */
export const KIND_ATTRIBUTION = {
  recommendation: 'stated', // 명시적 권고 — 강사가 「이렇게 하라」고 말했다
  observation: 'observed', // 수업 진행 관찰 — 영상의 수업 순서에서 보이는 것(권고가 아니다)
  inference: 'inferred', // 분석자 추론
}
export const KINDS = Object.keys(KIND_ATTRIBUTION)
export const VERDICTS = ['import', 'hold', 'exclude']
export const SCOPES = ['full', 'excerpt']
export const UNSPECIFIED = '미명시'

const PARAPHRASE_MAX = 300

/** 영역·대상·조건: 분류 id 배열이거나 '미명시'. 빈 배열은 받지 않는다(언급 없음과 확인 안 함을 가른다). */
function checkAxis(name, value, taxonomy, dims, errors) {
  if (value === UNSPECIFIED) return []
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`${name}: 분류 id 배열 또는 '${UNSPECIFIED}'`)
    return []
  }
  for (const id of value) {
    const dim = taxonomy.get(id)
    if (!dim) errors.push(`${name}: 없는 분류 id ${id}`)
    else if (!dims.includes(dim)) errors.push(`${name}: ${id} 는 ${dims.join('/')} 차원이 아니다(${dim})`)
  }
  return value
}

/**
 * 한 줄 검증 — **형식만 본다.** taxonomy = Map<id, dimension>. 반환 { ok, errors, claim }.
 *
 * 보장하지 않는 것(Codex 리뷰 P2, 2026-10-01):
 *   · 절차가 실제로 실행 가능한지 — 「영상이 강좌 구성을 소개한다」 같은 문장도 형식상 통과한다
 *   · 원문을 옮겨 적지 않았는지 — 300자 제한은 긴 인용을 줄일 뿐 복사를 막지 못한다
 *   · 구간 재서술이 그 초 구간의 내용과 맞는지
 * 이 셋은 원문을 가진 검토자가 판정한다. 검증을 통과했다고 「확인된 방법」이 아니다.
 * import 판정은 방법·절차·등급이 있어야 하고, A 는 대조 구간(시작<종료 초 + 재서술)이 있어야 한다.
 */
export function validateClaim(raw, taxonomy) {
  const errors = []
  const c = raw ?? {}
  if (!/^[A-Za-z0-9_-]{11}$/.test(String(c.videoId ?? ''))) errors.push('videoId: YouTube 영상 ID 11자')
  if (typeof c.claimId !== 'string' || !c.claimId.startsWith(`${c.videoId}#`)) errors.push('claimId: "<videoId>#<번호>"')
  if (!KINDS.includes(c.kind)) errors.push(`kind: ${KINDS.join(' | ')}`)
  if (!VERDICTS.includes(c.verdict)) errors.push(`verdict: ${VERDICTS.join(' | ')}`)
  if (!SCOPES.includes(c.reviewScope)) errors.push(`reviewScope: ${SCOPES.join(' | ')}`)
  if (typeof c.reviewer !== 'string' || c.reviewer.trim() === '') errors.push('reviewer: 누가 대조했는가')

  checkAxis('skill', c.skill, taxonomy, ['skill'], errors)
  checkAxis('audience', c.audience, taxonomy, ['age', 'proficiency'], errors)
  checkAxis('conditions', c.conditions, taxonomy, ['exam', 'process', 'question'], errors)

  const seg = c.segment
  if (seg != null) {
    if (!Number.isFinite(seg.startSec) || !Number.isFinite(seg.endSec) || seg.startSec < 0 || seg.endSec <= seg.startSec) {
      errors.push('segment: 0 ≤ startSec < endSec (영상 초)')
    }
    if (typeof seg.paraphrase !== 'string' || seg.paraphrase.trim() === '' || seg.paraphrase.length > PARAPHRASE_MAX) {
      errors.push(`segment.paraphrase: 구간 재서술 1~${PARAPHRASE_MAX}자(원문 인용 금지)`)
    }
  }

  if (c.verdict === 'import') {
    if (typeof c.method !== 'string' || c.method.trim().length < 5) errors.push('method: 방법 문장(재서술)')
    if (!Array.isArray(c.procedure) || c.procedure.length === 0 || c.procedure.some((s) => typeof s !== 'string' || s.trim() === '')) {
      errors.push('procedure: 실제 실행 절차 단계 배열(1개 이상)')
    }
    if (!['A', 'B', 'C'].includes(c.grade)) errors.push('grade: import 는 A | B | C')
    if (c.grade === 'A' && seg == null) errors.push('grade A: 대조한 segment(시작·종료 초 + 재서술)가 있어야 한다')
    // 적재기는 방법 + 절차를 한 문장으로 합친다. DB 한도를 넘으면 잘라 넣지 않고 여기서 돌려보낸다 —
    // 잘린 채 들어가면 재실행도 「이미 있음」으로 건너뛰어 잘린 상태가 굳는다(Codex 리뷰 P2, 2026-10-01).
    if (errors.length === 0) {
      const len = composeStatement(c).length
      if (len > STATEMENT_MAX) errors.push(`method + procedure: 합친 문장 ${len}자 > ${STATEMENT_MAX}자 — 주장을 나누거나 줄인다(잘라 넣지 않는다)`)
    }
  } else if (typeof c.reason !== 'string' || c.reason.trim() === '') {
    errors.push(`reason: ${c.verdict} 는 사유 필수`)
  }

  return { ok: errors.length === 0, errors, claim: c }
}

/** 초 → "m:ss–m:ss" (등록부 locator 형식). */
/** 등록부 statement 한도 — knowledge_items.statement CHECK(1~1500). */
export const STATEMENT_MAX = 1500

/** 방법 + 절차 → 등록부 statement. 적재기와 검증기가 **같은 함수**를 쓴다(길이 판정이 어긋나지 않게). */
export function composeStatement(c) {
  return `${c.method.trim()} — 절차: ${c.procedure.map((s, k) => `${k + 1}) ${s.trim()}`).join(' ')}`
}

export function formatSegment(seg) {
  const t = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  return `${t(seg.startSec)}–${t(seg.endSec)}`
}
