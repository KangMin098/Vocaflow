// apps/web/src/lib/csat/ec-pilot/__tests__/ec-pilot.test.ts
//
// 오답 원인 Pilot 학생 증거 수집 — 순수 규칙 회귀: 대상 선정(정오 비노출 · 정답 대조 설정 · 듣기 제외) ·
// 증거 입력 검증(interpretation 3상태 · 학생 범주 · 막힌 곳 범위는 서버 계산) · probe 판 · 해시 · 설정 관문(v99/TEST).

import { describe, expect, it } from 'vitest'

import { EC_PILOT, configTaxonomyAllowed, isPilotParticipant, pilotParticipants } from '../config'
import { PROBE_DEFINITIONS, currentProbe, findProbe, promptHash, studentProbe } from '../probes'
import { STUDENT_GROUPS, evidenceValue, parseEvidence, selectTargets, sentenceRanges, type TargetCandidate } from '../targets'

const cand = (itemNo: number, over: Partial<TargetCandidate> = {}): TargetCandidate => ({
  itemNo, chosen: 2, stem: '다음 글의 요지로 가장 적절한 것은?', passage: 'One. Two.', choices: ['a', 'b', 'c', 'd', 'e'], bodyOk: true, ...over,
})

describe('selectTargets — 정오 독립(봉인 대상 ∩ 내용 적격)', () => {
  it('봉인 대상만, 번호순', () => {
    const pool = [cand(18), cand(19), cand(20), cand(21)]
    expect(selectTargets(pool, [21, 18])).toEqual([18, 21])
  })

  it('P · N — 정답 · 오답만 다른 두 응답의 대상 집합이 같다(고른 답이 달라도)', () => {
    const sealed = [18, 19, 20, 21, 22]
    const P = [18, 19, 20, 21, 22].map((n) => cand(n, { chosen: 1 }))   // 예: 전부 오답
    const N = [18, 19, 20, 21, 22].map((n) => cand(n, { chosen: ((n * 3) % 5) + 1 }))   // 예: 전부 정답
    expect(selectTargets(P, sealed)).toEqual(selectTargets(N, sealed))
  })

  it('듣기(1–17) · 고른 답 없음 · 발문/선지 없음 · body_ok 거짓은 대상 밖', () => {
    const t = selectTargets([cand(5), cand(18, { chosen: null }), cand(19, { stem: ' ' }), cand(20, { choices: null }), cand(21, { bodyOk: false }), cand(22)], [5, 18, 19, 20, 21, 22])
    expect(t).toEqual([22])
  })
})

describe('parseEvidence · evidenceValue', () => {
  const item = { itemId: 'X#22', stem: '다음 글의 요지는?', passage: 'First sentence here. Second one follows! Third?', choices: ['one', 'two', 'three', 'four', 'five'] }

  it('interpretation 3상태 — answered 는 글 필수, unknown · skipped 는 글 없음', () => {
    expect(parseEvidence({ kind: 'interpretation', state: 'answered', text: ' 결과로 읽었어요 ' })).toEqual({ kind: 'interpretation', state: 'answered', text: '결과로 읽었어요' })
    expect(parseEvidence({ kind: 'interpretation', state: 'answered', text: '  ' })).toBeNull()
    expect(parseEvidence({ kind: 'interpretation', state: 'unknown' })).toEqual({ kind: 'interpretation', state: 'unknown' })
    expect(parseEvidence({ kind: 'interpretation', state: 'unknown', text: '모름' })).toBeNull()
    expect(parseEvidence({ kind: 'interpretation', state: 'skipped' })).toEqual({ kind: 'interpretation', state: 'skipped' })
    expect(parseEvidence({ kind: 'interpretation', state: 'maybe' })).toBeNull()
    expect(evidenceValue({ kind: 'interpretation', state: 'unknown' }, item)).toEqual({ state: 'unknown' })
  })

  it('학생 범주 — 결정된 7개(E 축 evidence · choice 포함, task 없음)만', () => {
    expect(STUDENT_GROUPS.map((g) => g.key)).toEqual(['word', 'sentence', 'flow', 'evidence', 'choice', 'time', 'unsure'])
    expect(parseEvidence({ kind: 'category', group: 'evidence' })).toEqual({ kind: 'category', group: 'evidence' })
    expect(parseEvidence({ kind: 'category', group: 'task' })).toBeNull()
    expect(parseEvidence({ kind: 'category', group: 'E.option_mismatch' })).toBeNull()
    expect(STUDENT_GROUPS.find((g) => g.key === 'choice')?.label).toBe('문제 · 선지 판단')
  })

  it('원인 claim · 알 수 없는 kind 는 받지 않는다(범주를 원인으로 바꾸는 경로 없음)', () => {
    expect(parseEvidence({ kind: 'claim', code: 'E.evidence_location' })).toBeNull()
    expect(parseEvidence({ kind: 'targeted_probe', option: 'A' })).toBeNull()
  })

  it('막힌 곳 — 학생은 문장 번호만, 문자 범위는 서버가 원문으로 계산', () => {
    const v = evidenceValue({ kind: 'blocked_span', part: 'passage', option: null, sentence: 1 }, item)!
    expect(item.passage.slice(v.start as number, v.end as number)).toBe('Second one follows!')
    expect(v).toMatchObject({ item_id: 'X#22', part: 'passage', option: null, sentence: 1 })
    const o = evidenceValue({ kind: 'blocked_span', part: 'option', option: 3, sentence: 0 }, item)!
    expect(o).toMatchObject({ part: 'option', option: 3, start: 0, end: 5 })
    expect(evidenceValue({ kind: 'blocked_span', part: 'passage', option: null, sentence: 9 }, item)).toBeNull()
    expect(parseEvidence({ kind: 'blocked_span', part: 'option', option: 6, sentence: 0 })).toBeNull()
    expect(parseEvidence({ kind: 'blocked_span', part: 'passage', sentence: 0, start: 0, end: 999 })).toEqual({ kind: 'blocked_span', part: 'passage', option: null, sentence: 0 })
  })

  it('지문 문장 분할은 빈 조각을 내지 않는다', () => {
    expect(sentenceRanges('A b. C d.', 'passage').every((r) => r.end > r.start)).toBe(true)
    expect(sentenceRanges('', 'stem')).toEqual([])
  })
})

describe('probe 정의', () => {
  const def = currentProbe('r6_derivation_probe')!

  it('R6 probe — A/B/C/D 의미 구조 · 판 · 해시', () => {
    expect(def.version).toBe('1.0.0')
    expect(Object.keys(def.options)).toEqual(['A', 'B', 'C', 'D'])
    expect(promptHash(def)).toMatch(/^[0-9a-f]{64}$/)
    expect(findProbe(def.key, def.version, promptHash(def))).toBe(def)
  })

  it('문구가 바뀌면 해시가 바뀌고, 다른 해시 · 판은 거부', () => {
    expect(promptHash({ ...def, question: def.question + ' ' })).not.toBe(promptHash(def))
    expect(findProbe(def.key, def.version, 'a'.repeat(64))).toBeNull()
    expect(findProbe(def.key, '9.9.9', promptHash(def))).toBeNull()
  })

  it('학생에게 보내는 형태에 분석 메모 · 원인 이름 · 경계 용어가 없다', () => {
    const sp = JSON.stringify(studentProbe(def))
    expect(sp).not.toMatch(/analysis|V\.wrong_sense|R\.inference|boundary|provisional|taxonomy|경계|원인/)
    for (const d of PROBE_DEFINITIONS) expect(JSON.stringify([d.intro, d.question, d.options])).not.toMatch(/[VSREBX]\.[a-z_]+|경계|원인|taxonomy/)
  })
})

describe('설정 관문', () => {
  it('taxonomy 는 v0.1 고정 · v99/형식 밖 거부', () => {
    expect(EC_PILOT.taxonomyVersion).toBe('v0.1')
    expect(configTaxonomyAllowed('v0.1')).toBe(true)
    expect(configTaxonomyAllowed('v99.0')).toBe(false)
    expect(configTaxonomyAllowed('v99.1')).toBe(false)
    expect(configTaxonomyAllowed('latest')).toBe(false)
  })

  it('상한 · 정답 대조는 미정(null) — 코드에 숫자를 박지 않는다', () => {
    expect(EC_PILOT.probeCapPerSession).toBeNull()
    expect(EC_PILOT.correctControls).toBeNull()
  })

  it('참가자 — 설정 + env, 형식 틀린 값은 버린다 · 비어 있으면 아무도 아님', () => {
    const id = '11111111-2222-4333-8444-555555555555'
    expect(pilotParticipants({ ...EC_PILOT, participants: [] }, '').size).toBe(0)
    expect(isPilotParticipant(id, { ...EC_PILOT, participants: [] }, `${id}, not-a-uuid`)).toBe(true)
    expect(isPilotParticipant(id.toUpperCase(), { ...EC_PILOT, participants: [id] }, '')).toBe(true)
    expect(pilotParticipants({ ...EC_PILOT, participants: ['x'] }, 'y,z').size).toBe(0)
  })
})
