// scripts/csat/__tests__/analysis-rules.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { namedReferentExclusions } from '../lib-analysis-rules.mjs'
import { buildUnits, precheckAnalysis, PRECHECK_VERSION } from '../lib-evidence-units.mjs'

const bad = [
  '밑줄이 든 문장이 다른 인물을 이름·호칭으로 따로 부르면 밑줄은 그 사람이 아니라고 지운다',
  '밑줄 문장이 다른 사람을 이름·명사구로 따로 부르는지 확인한다 — 따로 불린 사람은 그 밑줄이 아니다',
  '그 문장이 다른 인물을 이름·호칭으로 따로 부르면 밑줄은 그 인물이 아니다',
  '같은 문장 안에서 다른 인물이 이름으로 따로 불리면 밑줄은 그 사람이 아니다',
  '같은 문장에 다른 인물이 이름으로 따로 불리면 밑줄은 그 인물이 아니다',
  '밑줄이 든 문장이 다른 인물을 이름으로 따로 부르면 밑줄은 그 인물이 아니라고 지운다',
  '그 문장 안에서 다른 인물을 이름(the girl·Cora)으로 따로 부르면 밑줄은 그 사람이 아니다',
]

test('the complete author prompt cannot recommend a named-referent exclusion rejected by V10', () => {
  const prompt = readFileSync(new URL('../analysis-drain/_PROMPT.md', import.meta.url), 'utf8')
  assert.deepEqual(namedReferentExclusions(prompt), [])
})

test('confirmed named-referent rule variants are rejected, including on_fail', () => {
  for (const text of bad) assert.deepEqual(namedReferentExclusions([{ on_fail: text }]), [text])
})

test('the correction forbids the invalid rule and remains admissible', () => {
  const valid = '같은 문장에 이름이 있다는 이유로 후보를 지우지 말고 after Dorothy dropped의 부사절을 별도 분리하여 주절 suspected·phoned의 주체와 비교한다.'
  assert.deepEqual(namedReferentExclusions([{ step: valid }]), [])
  assert.deepEqual(namedReferentExclusions([{ step: '같은 문장에 이름이 따로 나와도 밑줄은 그 사람이 아니라고 단정하지 않는다.' }]), [])
  assert.deepEqual(namedReferentExclusions([{ step: '이름을 따로 적고 문장 속 행위자·발화자·소유자를 비교한다.' }]), [])
})

test('a separate valid warning does not mask an invalid instruction', () => {
  assert.equal(namedReferentExclusions(`이름만으로 문장의 후보를 지우지 말고 별도 대조한다. ${bad[0]}`).length, 1)
})

test('DB precheck rejects a bad rule even when all references and quotes are valid', () => {
  const passage = 'The father realized that he had been wrong.'
  const { units } = buildUnits(passage)
  const analysis = { answer_locus: { quote: passage, sentence_index: [1] }, solve_procedure: [{ step: bad[0] }] }
  const result = precheckAnalysis(analysis, units)
  assert.equal(PRECHECK_VERSION, 4)
  assert.equal(result.errors.length, 1)
  assert.match(result.errors[0], /V10/)
})

test('V11 blocks the actual internal repair memo without banning original-PDF learning instructions', () => {
  const passage = 'The subject performs the action.'
  const { units } = buildUnits(passage)
  const a = { answer_locus: { quote: passage, sentence_index: [1] }, design_intent: '능동 관계를 판별하게 한다. 실제 밑줄은 doing · done이며 수리된 범위를 대상으로 검증한다.' }
  assert.match(precheckAnalysis(a, units).errors.join('\n'), /V11/)
  a.design_intent = '문제 화면 원본 PDF에서 밑줄 전체를 확인하여 동작 주체와 분사 태를 비교하게 한다.'
  assert.deepEqual(precheckAnalysis(a, units).errors, [])
})

// ── V12 · V13 (2026-10-11 평가원 802 의미 검수 실측) ───────────────────────────
import { analysisRuleErrors as rulesV12 } from '../lib-analysis-rules.mjs'

const base = { measured_ability: '도표 대조', design_intent: '비교 조건', answer_locus: { reasoning: '두 막대를 비교한다' }, choices: [] }

test('V12 — 학습자 칸의 작업 용어(코퍼스 · 파일 경로 · 파싱 잔여)를 막는다', () => {
  const hits = [
    { ...base, answer_locus: { reasoning: '값은 그림에만 있어 코퍼스 지문에도 columns2/2014A.txt 에도 없다' } },
    { ...base, choices: [{ why_tempting: '선지 뒤에 붙은 인쇄 잔여도 선지를 미덥지 않게 만든다' }] },
    { ...base, design_intent: '이 청크에서 유일하게 형태가 맞는 문항' },
  ]
  for (const a of hits) assert.ok(rulesV12(a).some((e) => e.startsWith('V12')), JSON.stringify(a))
})

test('V12 — 내부 기록 칸(confirmed_at)의 작업 메모와 정상 서술은 통과한다', () => {
  assert.deepEqual(rulesV12({ ...base, choices: [{ why_correct: '주제문과 대응한다', confirmed_at: { note: '코퍼스 지문 OCR 잔여 확인' } }] }), [])
  assert.deepEqual(rulesV12({ ...base, design_intent: '두 단락의 대조로 요지를 세운다' }), [])
})

test('V13 — 도표 문항이 정답표로 정답을 정하면 막는다 · 다른 유형 · 정상 서술은 통과', () => {
  const inferred = { ...base, answer_locus: { reasoning: '막대 값은 없지만 평가원 정답표가 ④를 불일치로 확정하므로 ④다' } }
  assert.ok(rulesV12(inferred, { typeId: 'R-CHART' }).some((e) => e.startsWith('V13')))
  assert.deepEqual(rulesV12(inferred, { typeId: 'R-BLANK' }).filter((e) => e.startsWith('V13')), [])
  assert.deepEqual(rulesV12({ ...base, answer_locus: { reasoning: '2015년 값 34는 2010년 12의 세 배 이하다' } }, { typeId: 'R-CHART' }), [])
})
