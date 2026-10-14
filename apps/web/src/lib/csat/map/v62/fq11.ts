// apps/web/src/lib/csat/map/v62/fq11.ts
//
// v6.2 P-F8c — FQ1.1 최종 선택 16개(연구 a658fa39a)를 자격 원장(`content_qualification`) 기록 입력으로 옮긴다(순수).
// 원칙:
//   · 연구 수정은 공개 적격이 아니다 — 승인 행을 만들지 않는다. AI 내용 검토(B · C · D pass)는 권리 · 출시 승인을 대신하지 않는다.
//   · 새 revision 은 이전 검수를 상속하지 않는다 — DCP 후보의 revision 은 연구 revision 이라 DB 문항의 현재 내용 해시와 다르고,
//     그래서 공급 함수가 「검수 뒤 내용이 바뀜」으로 거절한다(수정본이 실제로 적재되고 다시 검수돼야 한다).
//   · 연구 활동(cohort research)은 제품 표가 없는 종류(textbook_activity) — 공급 함수가 「지원 안 함」으로 거절한다.
//   · A(원천 계보) · E(Gold 완전 루브릭) · F(권리) · G(학습자) · H(실행)는 unknown 그대로 — pass 로 바꾸지 않는다.
//   · 7개 boolean/null 요약(`toSupplyQualification`)은 파생값일 뿐, 원장에는 축별 방법 · 검토 revision · 근거 해시 · 이유를 함께 남긴다.

import FQ11 from './fq11-candidates.data.json'
import type { Axis, AxisState } from './qualification'
import type { MaterialRole } from './demand'

export interface Fq11Candidate {
  content: { id: string; revision: string; sha256: string }
  task: string
  role: MaterialRole
  cohort: 'research' | 'DCP'
  issues: string[]
  review: string
  ambiguity: string | null
  axes: Record<Axis, { state: AxisState; method: string; reviewRevision: string; evidenceSha256: string | null; reason: string | null }>
}

/** `content_qualification_record(...)` 인자와 같은 모양 */
export interface LedgerRecordInput {
  rulesVersion: 'FQ1.1'
  kind: 'dcp_item' | 'textbook_activity'
  ref: string
  revision: string
  task: string
  role: MaterialRole
  axes: Record<Axis, { state: AxisState; method: string; review_revision: string; evidence_sha256: string | null; reason: string | null }>
  sourceRevision: null
  sourceHash: null
  analysisRevision: string
  goldRevision: null
  goldHash: null
  defects: string[]
  evidenceIds: string[]
  method: string
}

export const FQ11_CANDIDATES = FQ11.selected as unknown as Fq11Candidate[]

/** 'FQ11-DCP-<문항 uuid>' → 원래 DCP 문항 id. 연구 활동은 null */
export function dcpRefOf(c: Fq11Candidate): string | null {
  const m = /^FQ11-DCP-([0-9a-f-]{36})$/.exec(c.content.id)
  return c.cohort === 'DCP' && m ? m[1]! : null
}

export function toLedgerRecord(c: Fq11Candidate): LedgerRecordInput {
  const dcp = dcpRefOf(c)
  const axes = Object.fromEntries(Object.entries(c.axes).map(([k, v]) => [k, {
    state: v.state, method: v.method, review_revision: v.reviewRevision, evidence_sha256: v.evidenceSha256, reason: v.reason,
  }])) as LedgerRecordInput['axes']
  return {
    rulesVersion: 'FQ1.1',
    kind: dcp ? 'dcp_item' : 'textbook_activity',
    ref: dcp ?? c.content.id,
    revision: `${c.content.revision}:${c.content.sha256}`,
    task: c.task,
    role: c.role,
    axes,
    // A unknown — 원천 계보 · 생성 당시 provenance 미확인. 결속 값을 지어내지 않는다
    sourceRevision: null,
    sourceHash: null,
    analysisRevision: c.axes.B.reviewRevision,
    // E unknown — 등록 사례 루브릭 내용 지지는 Gold 완전 자격이 아니다
    goldRevision: null,
    goldHash: null,
    defects: [...c.issues, ...(c.ambiguity ? ['remaining_ambiguity'] : [])],
    evidenceIds: [...new Set(Object.values(c.axes).map((a) => a.evidenceSha256).filter((x): x is string => !!x))],
    method: 'FQ1.1 독립 AI 제한 검토(인간 전문가 · 학생 검증 0)',
  }
}
