// apps/web/src/lib/csat/ec-pilot/probes.ts
//
// targeted probe 정의 — 저장소의 버전 산출물(DB 표가 아니다 · PILOT_DATA_MODEL §F).
// 학생 증거 행에는 probe_key · probe_version · prompt_hash · 고른 글자(A–D) · skipped 만 남는다 — 원인 이름은 남기지 않는다.
// 판을 바꾸면 새 version 항목을 더하고 옛 판은 지우지 않는다(이미 저장된 응답이 어떤 문구에 답했는지 재현해야 한다).
// `analysis` 는 분석 계층의 해석 메모 — 학생 화면 · API 응답으로 내보내지 않는다.

import { createHash } from 'node:crypto'

export type ProbeOption = 'A' | 'B' | 'C' | 'D'

export interface ProbeDefinition {
  key: string
  version: string
  /** 학생 화면 문구 — 원인 · 경계 · taxonomy 용어 금지 */
  intro: string
  question: string
  options: Readonly<Record<ProbeOption, string>>
  analysis: Readonly<Record<ProbeOption, string>>
}

export const PROBE_DEFINITIONS: readonly ProbeDefinition[] = [
  {
    key: 'r6_derivation_probe',
    version: '1.0.0',
    intro: '한 가지만 더 확인할게요',
    question: '방금 적은 뜻은 어떻게 떠올렸나요?',
    options: {
      A: '그 단어가 원래 그런 뜻이라고 생각했어요',
      B: '단어의 기본 뜻에서 문맥이나 비유를 따라가 그렇게 생각했어요',
      C: '둘 다 조금씩 영향을 줬어요',
      D: '잘 모르겠어요',
    },
    analysis: {
      A: '사전 뜻 직접 선택 쪽 증거(V.wrong_sense 방향) — 단독으로 판정을 바꾸지 않는다',
      B: '기본 뜻에서의 도출 쪽 증거(R.inference 방향) — 단독으로 판정을 바꾸지 않는다',
      C: '두 경로 모두 — 구별 증거 아님',
      D: '정보 없음',
    },
  },
]

/** 학생이 본 문구(intro · question · options)의 정규화 해시 — 문구가 바뀌면 바뀐다 */
export function promptHash(def: Pick<ProbeDefinition, 'key' | 'version' | 'intro' | 'question' | 'options'>): string {
  const canonical = JSON.stringify([def.key, def.version, def.intro, def.question, (['A', 'B', 'C', 'D'] as const).map((k) => [k, def.options[k]])])
  return createHash('sha256').update(canonical).digest('hex')
}

/** 최신 판(같은 key 중 마지막 항목) — 새로 띄울 때만 쓴다 */
export function currentProbe(key: string): ProbeDefinition | null {
  const list = PROBE_DEFINITIONS.filter((d) => d.key === key)
  return list[list.length - 1] ?? null
}

/** 제출 검증 — 학생이 본 판 · 해시가 저장소 정의(옛 판 포함)와 맞아야 한다 */
export function findProbe(key: string, version: string, hash: string): ProbeDefinition | null {
  const def = PROBE_DEFINITIONS.find((d) => d.key === key && d.version === version)
  return def && promptHash(def) === hash ? def : null
}

/** 학생에게 보내는 형태 — analysis 는 빼고 판 · 해시를 묶는다 */
export function studentProbe(def: ProbeDefinition) {
  return { key: def.key, version: def.version, promptHash: promptHash(def), intro: def.intro, question: def.question, options: def.options }
}
export type StudentProbe = ReturnType<typeof studentProbe>
