// apps/web/src/lib/csat/ec-pilot/__tests__/run-gate.test.ts
//
// G6 시작 게이트(fail-closed) — 항목 하나씩 빠뜨린 메타 → 닫힘 · 모두 있으면 열림 · 해시 불일치 → 닫힘 ·
// 메타에 이메일/UUID 꼴 → 가드 실패 · probeCap null → 닫힘 · 모드 분리 · 활성 메타 = docs 정본 · 감지기 판 = 마이그레이션 상수.

import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { ACTIVE_RUN } from '../active-run'
import { DETECTOR_VERSION, pilotMode } from '../gate'
import { captureProbeConfig } from '../probes'
import {
  answerKeyHash, canonicalJson, corpusHash, evaluateRunGate, itemSetHash, metaSeal, probeConfigHash, validateRunMeta,
  type ExamRow, type ItemRow, type LiveState, type RunMeta,
} from '../run-gate'

const ROOT = path.resolve(__dirname, '../../../../../../..')
const H = (c: string) => c.repeat(64)
const COMMIT = 'a'.repeat(40)

function baseMeta(): RunMeta {
  const m: Omit<RunMeta, 'seal'> = {
    format: 'ec-pilot-run-1',
    runId: 'ec-pilot-run-20261020-1',
    status: 'sealed',
    taxonomy: { version: 'v0.1', definitionsHash: H('1') },
    detectorVersion: 'bd-0.1.0',
    probe: { capPerSession: 3, configHash: probeConfigHash(captureProbeConfig(), 3) },
    appCommit: COMMIT,
    db: { latestMigration: '20261006120000', migrationCount: 694 },
    exams: [
      { examId: '2019', itemSetHash: H('2'), answerKeyHash: H('3'), corpusHash: H('4') },
      { examId: '2020', itemSetHash: H('5'), answerKeyHash: H('6'), corpusHash: H('7') },
    ],
    participants: [
      { key: 'P001', exams: ['2019', '2020'] },
      { key: 'P002', exams: ['2019', '2020'] },
      { key: 'P003', exams: ['2020'] },
    ],
    verification: {
      piiGuard: { commit: COMMIT, rulesHash: H('8'), passed: 53, failed: 0, at: '2026-10-19T09:00:00Z', recordSha256: H('9') },
      e2e: { commit: COMMIT, passed: 9, failed: 0, skipped: 0, at: '2026-10-19T10:00:00Z', recordSha256: H('a') },
    },
    sealedAt: '2026-10-19T11:00:00Z',
  }
  return { ...m, seal: metaSeal(m) }
}
const reseal = (m: RunMeta): RunMeta => ({ ...m, seal: metaSeal(m) })

function baseLive(m: RunMeta = baseMeta()): LiveState {
  return {
    configTaxonomyVersion: 'v0.1',
    dbTaxonomy: { status: 'sealed', note: 'v0.1 conditional seed', definitionsHash: m.taxonomy.definitionsHash },
    detectorVersion: 'bd-0.1.0',
    probeCap: 3,
    probeConfigHash: probeConfigHash(captureProbeConfig(), 3),
    participantIdCount: 3,
    appCommit: COMMIT,
    exams: Object.fromEntries(m.exams.map((e) => [e.examId, { ...e }])),
  }
}

describe('evaluateRunGate — 모두 있으면 열림', () => {
  it('열림 · 수집 대상 시험 = run 의 exam ids', () => {
    const r = evaluateRunGate(baseMeta(), baseLive())
    expect(r.failures).toEqual([])
    expect(r.open).toBe(true)
    expect(r.exams).toEqual(['2019', '2020'])
  })
})

describe('메타 항목 하나씩 빠뜨리면 닫힘(fail-closed)', () => {
  const drops: [string, (m: Record<string, unknown>) => void][] = [
    ['메타 없음', () => undefined],
    ['participants', (m) => { delete m.participants }],
    ['exams', (m) => { delete m.exams }],
    ['taxonomy', (m) => { delete m.taxonomy }],
    ['detectorVersion', (m) => { delete m.detectorVersion }],
    ['probe', (m) => { delete m.probe }],
    ['appCommit', (m) => { delete m.appCommit }],
    ['db', (m) => { delete m.db }],
    ['verification.piiGuard', (m) => { delete (m.verification as Record<string, unknown>).piiGuard }],
    ['verification.e2e', (m) => { delete (m.verification as Record<string, unknown>).e2e }],
    ['exam itemSetHash', (m) => { delete (m.exams as Record<string, unknown>[])[0].itemSetHash }],
    ['exam answerKeyHash', (m) => { delete (m.exams as Record<string, unknown>[])[1].answerKeyHash }],
    ['exam corpusHash', (m) => { delete (m.exams as Record<string, unknown>[])[0].corpusHash }],
    ['sealedAt', (m) => { delete m.sealedAt }],
  ]
  for (const [name, drop] of drops) {
    it(name, () => {
      const m = JSON.parse(JSON.stringify(baseMeta())) as Record<string, unknown>
      drop(m)
      const meta = name === '메타 없음' ? null : reseal(m as unknown as RunMeta)
      const r = evaluateRunGate(meta, baseLive())
      expect(r.open).toBe(false)
      expect(r.failures.length).toBeGreaterThan(0)
      expect(r.exams).toEqual([])
    })
  }
  it('seal 없음 · 봉인 뒤 수정', () => {
    const m = baseMeta()
    expect(evaluateRunGate({ ...m, seal: undefined }, baseLive()).failures).toContain('seal:missing')
    expect(evaluateRunGate({ ...m, appCommit: 'b'.repeat(40) }, baseLive()).failures).toContain('seal:mismatch')
  })
  it('시험이 1개 · 3개 · 중복이면 닫힘(결정 B — 2회차 고정)', () => {
    const m = baseMeta()
    expect(evaluateRunGate(reseal({ ...m, exams: m.exams.slice(0, 1), participants: m.participants.map((p) => ({ ...p, exams: ['2019'] })) }), baseLive()).open).toBe(false)
    expect(evaluateRunGate(reseal({ ...m, exams: [...m.exams, { ...m.exams[0], examId: '2021' }] }), baseLive()).open).toBe(false)
    expect(evaluateRunGate(reseal({ ...m, exams: [m.exams[0], m.exams[0]] }), baseLive()).failures).toContain('exams:duplicate')
  })
  it('참가자 2명 · 9명 · run 밖 시험 assignment → 닫힘(결정 A)', () => {
    const m = baseMeta()
    expect(evaluateRunGate(reseal({ ...m, participants: m.participants.slice(0, 2) }), { ...baseLive(), participantIdCount: 2 }).failures).toContain('participants:count')
    const nine = Array.from({ length: 9 }, (_, i) => ({ key: `P00${i + 1}`, exams: ['2019'] }))
    expect(evaluateRunGate(reseal({ ...m, participants: nine }), { ...baseLive(), participantIdCount: 9 }).open).toBe(false)
    expect(evaluateRunGate(reseal({ ...m, participants: [...m.participants.slice(0, 2), { key: 'P003', exams: ['2099'] }] }), baseLive()).failures).toContain('participants:P003.assignment')
  })
  it('검증 기록 — E2E 실패 · 건너뜀 · 다른 커밋 → 닫힘', () => {
    const m = baseMeta()
    const v = m.verification
    expect(evaluateRunGate(reseal({ ...m, verification: { ...v, e2e: { ...v.e2e, failed: 1 } } }), baseLive()).open).toBe(false)
    expect(evaluateRunGate(reseal({ ...m, verification: { ...v, e2e: { ...v.e2e, skipped: 1 } } }), baseLive()).open).toBe(false)
    expect(evaluateRunGate(reseal({ ...m, verification: { ...v, piiGuard: { ...v.piiGuard, commit: 'c'.repeat(40) } } }), baseLive()).failures).toContain('verify:piiGuard.commit')
  })
})

describe('live 와 다르면 닫힘', () => {
  const cases: [string, (l: LiveState) => LiveState, string][] = [
    ['taxonomy 해시', (l) => ({ ...l, dbTaxonomy: { ...l.dbTaxonomy!, definitionsHash: H('f') } }), 'live:taxonomy.hash'],
    ['taxonomy 미봉인', (l) => ({ ...l, dbTaxonomy: { ...l.dbTaxonomy!, status: 'draft' } }), 'live:taxonomy.hash'],
    ['taxonomy TEST 표기', (l) => ({ ...l, dbTaxonomy: { ...l.dbTaxonomy!, note: 'TEST — smoke' } }), 'live:taxonomy.hash'],
    ['taxonomy 못 읽음', (l) => ({ ...l, dbTaxonomy: null }), 'live:taxonomy.hash'],
    ['설정 taxonomy v99', (l) => ({ ...l, configTaxonomyVersion: 'v99.1' }), 'live:taxonomy.config'],
    ['감지기 판', (l) => ({ ...l, detectorVersion: 'bd-0.2.0' }), 'live:detector'],
    ['probeCap null', (l) => ({ ...l, probeCap: null }), 'live:probe.cap'],
    ['probeCap 5', (l) => ({ ...l, probeCap: 5 }), 'live:probe.cap'],
    ['probe config 해시', (l) => ({ ...l, probeConfigHash: H('e') }), 'live:probe.config'],
    ['참가자 env 개수', (l) => ({ ...l, participantIdCount: 4 }), 'live:participants.count'],
    ['참가자 env 비어 있음', (l) => ({ ...l, participantIdCount: 0 }), 'live:participants.count'],
    ['앱 커밋 다름', (l) => ({ ...l, appCommit: 'b'.repeat(40) }), 'live:app.commit'],
    ['앱 커밋 env 없음', (l) => ({ ...l, appCommit: null }), 'live:app.commit'],
    ['item set 해시', (l) => ({ ...l, exams: { ...l.exams, '2019': { ...l.exams['2019']!, itemSetHash: H('0') } } }), 'live:exam.2019.itemSetHash'],
    ['정답표 해시', (l) => ({ ...l, exams: { ...l.exams, '2020': { ...l.exams['2020']!, answerKeyHash: H('0') } } }), 'live:exam.2020.answerKeyHash'],
    ['코퍼스 해시', (l) => ({ ...l, exams: { ...l.exams, '2020': { ...l.exams['2020']!, corpusHash: H('0') } } }), 'live:exam.2020.corpusHash'],
    ['시험 못 읽음', (l) => ({ ...l, exams: { ...l.exams, '2019': null } }), 'live:exam.2019.missing'],
    ['마이그레이션 상태(점검 스크립트)', (l) => ({ ...l, db: { latestMigration: '20261107000000', migrationCount: 695 } }), 'live:db.migrations'],
  ]
  for (const [name, f, code] of cases) {
    it(name, () => {
      const r = evaluateRunGate(baseMeta(), f(baseLive()))
      expect(r.open).toBe(false)
      expect(r.failures).toContain(code)
    })
  }
  it('메타의 probeCap 이 3 이 아니면 메타부터 실패(결정 C)', () => {
    const m = baseMeta()
    expect(evaluateRunGate(reseal({ ...m, probe: { ...m.probe, capPerSession: null as unknown as number } }), baseLive()).failures).toContain('probe:cap')
  })
})

describe('메타 식별정보 가드', () => {
  it('participant key 자리에 UUID → 실패', () => {
    const m = baseMeta()
    const r = validateRunMeta(reseal({ ...m, participants: [{ key: '1b4e28ba-2fa1-41d2-883f-0016d3cca427', exams: ['2019'] }, ...m.participants.slice(1)] }))
    expect(r.some((x) => x.startsWith('pii:uuid@'))).toBe(true)
  })
  it('어느 필드든 이메일 · 전화 꼴 → 실패', () => {
    const m = baseMeta() as unknown as Record<string, unknown>
    expect(validateRunMeta(reseal({ ...m, note: 'kim@example.com' } as unknown as RunMeta)).some((x) => x.startsWith('pii:email@'))).toBe(true)
    expect(validateRunMeta(reseal({ ...m, note: '연락 010-1234-5678' } as unknown as RunMeta)).some((x) => x.startsWith('pii:phone@'))).toBe(true)
  })
  it('계정 id · 이메일 키 이름 → 실패(값이 비어도)', () => {
    const m = baseMeta()
    const parts = m.participants.map((p, i) => (i === 0 ? { ...p, userId: '' } : p))
    expect(validateRunMeta(reseal({ ...m, participants: parts })).some((x) => x.startsWith('pii:forbidden_key@'))).toBe(true)
  })
  it('정상 메타의 해시(hex)는 전화 · UUID 로 오탐하지 않는다', () => {
    const m = baseMeta()
    const odd = reseal({ ...m, exams: [{ ...m.exams[0], corpusHash: '0101234567800000000000000000000000000000000000000000000000000000' }, m.exams[1]] })
    expect(validateRunMeta(odd).filter((x) => x.startsWith('pii:'))).toEqual([])
  })
})

describe('정규화 해시 — 결정적 · 순서 무관', () => {
  const item = (no: number, over: Partial<ItemRow> = {}): ItemRow => ({ id: `I${no}`, no, section: 'reading', in_scope: true, type_id: 't', stem: 's', passage: 'p', choices: ['a', 'b'], body_ok: true, raw_block: 'raw', ...over })
  const exam: ExamRow = { id: '2019', organizer: 'kice', source_note: 'x', item_count: 45, listening_end: 17 }
  it('행 순서 · 키 순서가 달라도 같다', () => {
    expect(itemSetHash([item(18), item(19)])).toBe(itemSetHash([item(19), item(18)]))
    expect(canonicalJson({ b: 1, a: [1, { d: 2, c: 3 }] })).toBe('{"a":[1,{"c":3,"d":2}],"b":1}')
    expect(answerKeyHash([{ no: 2, answers: [3], points: 2 }, { no: 1, answers: [1], points: 2 }])).toBe(answerKeyHash([{ no: 1, answers: [1], points: 2 }, { no: 2, answers: [3], points: 2 }]))
  })
  it('원문 · 정답 · 함정이 바뀌면 바뀐다', () => {
    expect(itemSetHash([item(18)])).not.toBe(itemSetHash([item(18, { passage: 'p2' })]))
    expect(answerKeyHash([{ no: 1, answers: [1], points: 2 }])).not.toBe(answerKeyHash([{ no: 1, answers: [2], points: 2 }]))
    const t = [{ item_id: 'I18', option_no: 1, trap_key: 'x', source: 's', analysis_version: 1 }]
    expect(corpusHash(exam, [item(18)], t)).not.toBe(corpusHash(exam, [item(18)], [{ ...t[0], trap_key: 'y' }]))
    expect(corpusHash(exam, [item(18)], t)).not.toBe(corpusHash(exam, [item(18, { raw_block: 'raw2' })], t))
  })
  it('probe config 해시 — 상한이 바뀌면 바뀐다', () => {
    expect(probeConfigHash(captureProbeConfig(), 3)).not.toBe(probeConfigHash(captureProbeConfig(), null))
  })
})

describe('모드 분리 — run · verification 은 서로 배타', () => {
  it('메타 없음 + env 없음 → 닫힘(실제 v0.1 은 게이트 없이 열리지 않는다)', () => {
    expect(pilotMode(null, undefined)).toBe('closed')
    expect(pilotMode(null, 'run')).toBe('closed')
  })
  it('메타 없음 + verification → 검증 모드', () => expect(pilotMode(null, 'verification')).toBe('verification'))
  it('메타 있음 → run, verification env 가 있으면 닫힘(테스트 계정이 run 기간에 열지 못하게)', () => {
    expect(pilotMode(baseMeta(), undefined)).toBe('run')
    expect(pilotMode(baseMeta(), 'verification')).toBe('closed')
  })
})

describe('저장소 정합', () => {
  it('ACTIVE_RUN 은 null 이거나 docs/csat-learner/pilot-runs/<run id>.json 과 같고 가드를 통과한다', () => {
    if (ACTIVE_RUN === null) return
    const file = path.join(ROOT, 'docs/csat-learner/pilot-runs', `${ACTIVE_RUN.runId}.json`)
    expect(fs.existsSync(file)).toBe(true)
    expect(canonicalJson(JSON.parse(fs.readFileSync(file, 'utf8')))).toBe(canonicalJson(ACTIVE_RUN))
    expect(validateRunMeta(ACTIVE_RUN)).toEqual([])
  })
  it('pilot-runs 의 모든 메타가 식별정보 가드를 통과한다', () => {
    const dir = path.join(ROOT, 'docs/csat-learner/pilot-runs')
    if (!fs.existsSync(dir)) return
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      const v = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
      const pii = validateRunMeta(v).filter((x) => x.startsWith('pii:'))
      expect(pii, f).toEqual([])
    }
  })
  it('감지기 판 상수 = 최신 감지기 마이그레이션의 c_version', () => {
    const dir = path.join(ROOT, 'supabase/migrations')
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
    const versions = files.map((f) => fs.readFileSync(path.join(dir, f), 'utf8').match(/c_version constant text := '(bd-[0-9.]+)'/)?.[1]).filter(Boolean)
    expect(versions.at(-1)).toBe(DETECTOR_VERSION)
  })
})
