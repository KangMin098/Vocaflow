// scripts/csat/__tests__/meaning-support-schema.test.mjs
//
// v3.1 교수 sidecar 형식 · 참조 · 결속 · 인용 예산 — 실패 사례가 실제로 막히는가(C1 · C5 표의 schema · binding 행).
// 실제 배포 inquiry 레코드(2026#34)를 base 로 쓴다. 원문은 이 테스트 안의 짧은 가짜 문장(실제 원문 아님).
//   node --test scripts/csat/__tests__/meaning-support-schema.test.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

import { basePublicHash, canonicalJson, normSpace, sha256Hex, sourceSnapshotHash, supportContentHash, validateSupport } from '../lib-meaning-support.mjs'

const pub = JSON.parse(readFileSync(join(process.cwd(), 'apps/web/src/lib/csat/inquiry-data.json'), 'utf8')).items
const record = pub['2026#34']
const expr = record.v3.meanings[0].expression // 기존 공개 표현(재사용 허용)
const meaningId = record.v3.meanings[0].id
const sentN = record.v3.meanings[0].sentences[0]
// 가짜 입력 — 해당 문장에 기존 표현을 그대로 넣어 원문 대조 경로를 시험한다
const input = { id: '2026#34', stem: 's', choices: ['a', 'b', 'c', 'd', 'e'], sentences: Array.from({ length: 7 }, (_, i) => ({ n: i + 1, text: i + 1 === sentN ? `If so, ${expr} restrained here.` : `Filler sentence number ${i + 1}.` })) }

const choiceWith = record.v3.choices.find((c) => (c.meaning_ids ?? []).includes(meaningId))
const ok = () => ({
  schema: 'meaning-support/1', itemId: '2026#34',
  binding: { analysisVersion: record.analysis_version, unitsHash: record.v3.units_hash, basePublicHash: basePublicHash(record), sourceSnapshotHash: sourceSnapshotHash(input) },
  sourceRef: { organizer: 'kice', examId: '2026', itemNo: 34, inputRef: 'inquiry-origin:test' },
  defaultUnitId: 'u1',
  anchors: [{ id: 'a1', sentence: sentN, quote: expr.split(' ').slice(0, 3).join(' '), occurrence: 1, mode: 'original' }],
  propositions: [{ id: 'p1', textKo: '조건이 성립하면 그 법은 구속으로 볼 수 없다', basis: 'source_observation', anchorIds: ['a1'], warrantsKo: [], limitKo: '' }],
  units: [
    { id: 'u1', sentences: [sentN], legacyMeaningIds: [meaningId], labelKo: '조건과 부정', exactKo: '정확한 뜻', simpleKo: '쉬운 말', propositionIds: ['p1'], preserves: [{ facet: 'polarity', valueKo: '부정', anchorIds: ['a1'], explanationKo: '부정이 걸리는 범위' }] },
    { id: 'u2', sentences: [6], legacyMeaningIds: [], labelKo: '이상적 법', exactKo: '정확한 뜻 2', simpleKo: '쉬운 말 2', propositionIds: [], preserves: [] },
  ],
  relations: [{ id: 'r1', from: ['u2'], to: ['u1'], kind: 'condition', beforeKo: '앞', afterKo: '뒤', changeKo: '조건이 붙어 결론의 범위가 좁아진다', propositionIds: ['p1'], anchorIds: ['a1'], basis: 'source_observation', warrantsKo: [], limitKo: '' }],
  whole: { genre: 'argument', summaryKo: '전체의 생각', propositionIds: ['p1'], relationIds: ['r1'], limitsKo: [] },
  bridges: choiceWith ? [{ unitId: 'u1', meaningIds: [meaningId], choiceNumbers: [choiceWith.n], designClaimIndices: [0] }] : [],
})
const v = (s, withInput = true) => validateSupport(s, { input: withInput ? input : null, record })
const has = (errs, frag) => errs.some((x) => x.includes(frag))

test('정상 sidecar 는 오류 0(원문 대조 포함)', () => assert.deepEqual(v(ok()), []))

test('dangling 참조 · 빈 의미 · unknown schema 는 막힌다', () => {
  const s = ok(); s.units[0].propositionIds = ['p9']; assert.ok(has(v(s), 'proposition p9 없음'))
  const t = ok(); t.relations[0].to = ['u9']; assert.ok(has(v(t), 'unit u9 없음'))
  const u = ok(); u.units[0].preserves[0].anchorIds = ['a9']; assert.ok(has(v(u), 'anchor a9 없음'))
  const w = ok(); w.units[0].legacyMeaningIds = ['m99']; assert.ok(has(v(w), 'legacyMeaningId m99'))
  const x = ok(); x.units[0].simpleKo = ' '; assert.ok(has(v(x), 'simpleKo 빔'))
  const y = ok(); y.schema = 'meaning-support/2'; assert.ok(has(v(y), 'schema'))
  const z = ok(); z.defaultUnitId = 'u9'; assert.ok(has(v(z), 'defaultUnitId'))
  const q = ok(); q.bridges = [{ unitId: 'u1', meaningIds: [meaningId], choiceNumbers: [], designClaimIndices: [99] }]; assert.ok(has(v(q), 'designClaimIndex 99'))
})

test('새 영어 인용 · 8단어 초과 · 원문에 없는 구절 · 잘못된 occurrence 는 막힌다', () => {
  const s = ok(); s.anchors[0].quote = 'a brand new English phrase'; assert.ok(has(v(s), '새 영어 인용 금지'))
  const t = ok(); t.anchors[0].quote = 'one two three four five six seven eight nine'; assert.ok(has(v(t), '단어 이하'))
  const u = ok(); u.anchors[0].occurrence = 2; assert.ok(has(v(u), '2번째 등장에 없음'))
  const w = ok(); w.anchors[0].sentence = 99; assert.ok(has(v(w), '범위 밖'))
})

test('sourceRange — 같은 길이 다른 원문이면 구간 해시가 달라 막힌다', () => {
  const s = ok()
  const sent = normSpace(input.sentences[sentN - 1].text)
  s.anchors.push({ id: 'a2', sentence: sentN, sourceRange: { start: 0, end: 5, spanHash: sha256Hex(sent.slice(0, 5)) }, mode: 'original' })
  assert.deepEqual(v(s), [])
  const other = { ...input, sentences: input.sentences.map((x) => (x.n === sentN ? { ...x, text: 'XXXXX' + x.text.slice(5) } : x)) }
  s.binding.sourceSnapshotHash = sourceSnapshotHash(other)
  assert.ok(validateSupport(s, { input: other, record }).some((x) => x.includes('구간 해시가 원문과 다름')))
})

test('결속 — 분석 버전 · units · 배포 레코드 해시 · 원문 스냅숏이 다르면 막힌다', () => {
  const s = ok(); s.binding.analysisVersion = 99; assert.ok(has(v(s), 'analysisVersion'))
  const t = ok(); t.binding.unitsHash = 'x'; assert.ok(has(v(t), 'unitsHash'))
  const u = ok(); u.binding.sourceSnapshotHash = 'x'; assert.ok(has(v(u), 'sourceSnapshotHash ≠ 원문'))
})

test('basePublicHash — 같은 분석 버전 · 같은 문장 분할에서 문맥 뜻(meaning_ko) 하나만 바뀌어도 stale', () => {
  const changed = JSON.parse(JSON.stringify(record))
  changed.v3.meanings[0].meaning_ko += ' (수정)'
  assert.equal(changed.analysis_version, record.analysis_version)
  assert.equal(changed.v3.units_hash, record.v3.units_hash)
  assert.notEqual(basePublicHash(changed), basePublicHash(record))
  assert.ok(validateSupport(ok(), { input, record: changed }).some((x) => x.includes('basePublicHash')))
})

test('canonical — 키 순서가 달라도 같은 해시 · 문자열은 정규화하지 않는다', () => {
  assert.equal(canonicalJson({ b: 1, a: { d: 2, c: 3 } }), canonicalJson({ a: { c: 3, d: 2 }, b: 1 }))
  assert.notEqual(canonicalJson({ a: 'x  y' }), canonicalJson({ a: 'x y' }))
  assert.equal(supportContentHash(ok()), supportContentHash(JSON.parse(JSON.stringify(ok()))))
})

test('추론 · 확장 명제는 근거(warrants)와 한계(limit) 필수 · 보편 단정 금지', () => {
  const s = ok(); s.propositions[0].basis = 'bridging_inference'; assert.ok(has(v(s), 'warrantsKo 와 limitKo'))
  const t = ok(); t.whole.summaryKo = '이 원리는 항상 통한다'; assert.ok(has(v(t), '보편 단정'))
})
