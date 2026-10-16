// apps/web/src/lib/csat/map/v62/factory-bridge/crosswalk.ts
//
// I0-1 — TASK ↔ 교재공장 Crosswalk(순수 · 버전). 학습지도 정본 TASK 와 공장 Academic Reading 스킬 · 제품군을 잇는 **후보** 표.
// 공장 정본(origin/feat/textbook-factory-main 663f2eee8 · packages/library-pipeline/src/textbook/academic-reading.ts)의 스킬 이름 · 제품군을 그대로 옮겼다.
// 불변식:
//   · 문자열 id 가 같다고 같은 스킬이 아니다 — 학습지도 R5(r.central_meaning · 중심 의미)와 공장 Academic R5(Function)는 다르다. id 로 잇지 않는다.
//   · status 'candidate' 는 **자료 검색**에만 쓴다. 직접 평가 · 공급 적합성 · 주문 봉인 근거가 아니다.
//   · 'validated' 는 검증 증거 id 와 검수자가 있을 때만 — 지금 0건.

import { CANON_VERSION, type TaskId } from '../../v4/definition'

export const CROSSWALK_VERSION = 'vf.task-factory-crosswalk/1' as const
/** 공장에 별도 분류 버전 문자열이 없다 — 엔진 버전 + 브랜치 HEAD 를 출처로 묶는다 */
export const FACTORY_TAXONOMY_VERSION = 'academic-reading/READING_ENGINE_VERSION=1@663f2eee8' as const

export type FactorySkillId = 'R0' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7' | 'R8' | 'R9' | 'R10' | 'R11' | 'R12' | 'R13'
export type ProductFamily = `P${'01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10' | '11' | '12' | '13' | '14' | '15' | '16' | '17' | '18' | '19' | '20'}`

/** 공장 스킬 이름(academic-reading.ts:6-21 그대로) */
export const FACTORY_SKILL_NAME: Record<FactorySkillId, string> = {
  R0: 'Fluency', R1: 'Vocabulary in Context', R2: 'Sentence Meaning', R3: 'Relation', R4: 'Main Idea', R5: 'Function', R6: 'Structure',
  R7: 'Paraphrase', R8: 'Inference', R9: 'Evidence', R10: 'Argument', R11: 'Multi-text', R12: 'Data Integration', R13: 'Timed Judgment',
}

export type CrosswalkRelation = 'overlaps' | 'narrower' | 'broader' | 'related'
export type MaterialRoleScope = 'guided_practice' | 'source_analysis' | 'model_explanation'

export interface TaskFactoryCrosswalk {
  canonTaskId: TaskId
  taskDefinitionVersion: string
  factorySkillId: FactorySkillId
  factoryTaxonomyVersion: string
  productFamily: ProductFamily
  /** 공장 PRODUCT_CAPABILITIES 의 허용 문항 유형 */
  itemType: string[]
  /** 이 대응으로 찾을 수 있는 자료 역할 — 평가 역할(독립 확인 · 전이 · 지연)은 넣지 않는다 */
  materialRole: MaterialRoleScope[]
  relation: CrosswalkRelation
  /** 이 대응이 말할 수 있는 범위 — 검색 후보까지 */
  claimScope: 'search_only'
  status: 'candidate' | 'validated' | 'rejected'
  validationEvidenceId: string | null
  reviewer: string | null
  effectiveRevision: string
  note: string
}

const C = (o: Omit<TaskFactoryCrosswalk, 'taskDefinitionVersion' | 'factoryTaxonomyVersion' | 'claimScope' | 'status' | 'validationEvidenceId' | 'reviewer' | 'effectiveRevision'>): TaskFactoryCrosswalk => ({
  ...o, taskDefinitionVersion: CANON_VERSION, factoryTaxonomyVersion: FACTORY_TAXONOMY_VERSION, claimScope: 'search_only', status: 'candidate', validationEvidenceId: null, reviewer: null, effectiveRevision: `${CROSSWALK_VERSION}#0`,
})

/** 초기 후보 — 사람 · 맹검 검수 전. 지시서의 후보를 공장 정본 이름과 대 보며 관계를 좁혔다 */
export const CROSSWALK: readonly TaskFactoryCrosswalk[] = [
  C({ canonTaskId: 'v.contextual_sense', factorySkillId: 'R1', productFamily: 'P05', itemType: ['vocab_choice', 'long_vocab'], materialRole: ['guided_practice'], relation: 'overlaps', note: '공장 vocab_choice 는 「문맥에 맞지 않는 낱말」 — V2 의 B 판별과 겹치나 D 문맥 뜻 · C 근거는 다루지 않는다' }),
  C({ canonTaskId: 's.form_scope', factorySkillId: 'R2', productFamily: 'P06', itemType: ['grammar_choice', 'grammar_fix', 'word_order'], materialRole: ['guided_practice'], relation: 'related', note: '공장 R2 는 Sentence Meaning, P06 문항은 어법 형태 — S5 의미 범위 능력으로 승격하지 않는다(S04)' }),
  C({ canonTaskId: 'r.central_meaning', factorySkillId: 'R4', productFamily: 'P07', itemType: ['topic', 'title', 'main_point'], materialRole: ['guided_practice'], relation: 'overlaps', note: '학습지도 R5(중심 의미) ↔ 공장 R4(Main Idea). 공장 R5(Function)와 잇지 않는다' }),
  C({ canonTaskId: 'e.evidence_location', factorySkillId: 'R9', productFamily: 'P11', itemType: ['content_match', 'long_match'], materialRole: ['guided_practice'], relation: 'related', note: '공장 P11 은 내용 일치 — 빈칸 근거 위치(E1)와 같은 수행이 아니다' }),
  C({ canonTaskId: 'e.option_correspondence', factorySkillId: 'R7', productFamily: 'P06', itemType: ['grammar_choice', 'grammar_fix', 'word_order'], materialRole: ['guided_practice'], relation: 'related', note: 'R7 Paraphrase 제품군(P06 · P17 · P18) 중 P06 문항 유형은 선지 대응과 다르다 — 후보 검토 필요' }),
  C({ canonTaskId: 'e.option_correspondence', factorySkillId: 'R9', productFamily: 'P11', itemType: ['content_match', 'long_match'], materialRole: ['guided_practice'], relation: 'related', note: '내용 일치 선지 대응 — R7/R9 중 어느 쪽인지 미결' }),
]

export function crosswalkFor(task: TaskId): TaskFactoryCrosswalk[] {
  return CROSSWALK.filter((c) => c.canonTaskId === task && c.status !== 'rejected')
}

export type CrosswalkUse = 'search' | 'supply_fit' | 'assessment' | 'seal_order'

/** 이 대응을 이 용도로 쓸 수 있는가 — 후보는 검색만, 평가는 어떤 상태로도 불가 */
export function crosswalkUsable(c: TaskFactoryCrosswalk, use: CrosswalkUse): { ok: boolean; why: string } {
  if (c.status === 'rejected') return { ok: false, why: 'rejected' }
  if (use === 'assessment') return { ok: false, why: 'factory_material_not_assessment' }
  if (use === 'search') return { ok: true, why: 'candidate_search' }
  if (c.status !== 'validated' || !c.validationEvidenceId || !c.reviewer) return { ok: false, why: 'crosswalk_not_validated' }
  return { ok: true, why: 'validated' }
}
