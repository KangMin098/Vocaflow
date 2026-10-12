// apps/web/src/lib/csat/meaning-support/__tests__/model.test.ts
//
// v3.1 원문 이해 — 서버 해시 ↔ 빌드 해시 동치(전 문항) · 결속 stale · URL 파서/빌더(allowlist · 맥락 보존) · 선택 헬퍼
import { describe, expect, it } from 'vitest'

import inquiry from '../../inquiry-data.json'
import artifact from '../../meaning-support-data.json'
// 빌드 · CI 가 쓰는 정본 해시 — 서버 구현과 같은 값을 내야 한다
import { basePublicHash as scriptHash } from '../../../../../../../scripts/csat/lib-meaning-support.mjs'
import { basePublicHash, lookupMeaningSupport } from '../data'
import type { MeaningSupportView } from '../labels'
import { bridgeOf, buildItemUrl, draftTooLong, parseMeaningParams, phraseRowsOf, relationSentences, sentencesOf, unitsForSentence } from '../model'

const records = (inquiry as unknown as { items: Record<string, { analysis_version: number; v3?: { units_hash: string } }> }).items

describe('basePublicHash — 서버와 빌드 스크립트가 같은 함수', () => {
  it('배포된 전 문항에서 값이 같다', () => {
    const ids = Object.keys(records)
    expect(ids.length).toBeGreaterThan(700)
    for (const id of ids) expect(basePublicHash(records[id]), id).toBe(scriptHash(records[id]))
  })
})

const view: MeaningSupportView = {
  itemId: '2026#34', defaultUnitId: 'u1', anchors: [], propositions: [],
  units: [
    { id: 'u1', sentences: [6], legacyMeaningIds: [], labelKo: 'a', exactKo: 'b', simpleKo: 'c', propositionIds: [], preserves: [] },
    { id: 'u2', sentences: [7], legacyMeaningIds: [], labelKo: 'a', exactKo: 'b', simpleKo: 'c', propositionIds: [], preserves: [] },
    { id: 'u3', sentences: [7, 1], legacyMeaningIds: [], labelKo: 'a', exactKo: 'b', simpleKo: 'c', propositionIds: [], preserves: [] },
  ],
  relations: [{ id: 'r1', from: ['u1'], to: ['u2'], kind: 'condition', beforeKo: 'x', afterKo: 'y', changeKo: 'z', propositionIds: [], anchorIds: [], basis: 'source_observation', warrantsKo: [], limitKo: '' }],
  whole: { genre: 'argument', summaryKo: 's', propositionIds: [], relationIds: ['r1'], limitsKo: [] },
  bridges: [],
}

describe('lookupMeaningSupport — 결속', () => {
  const rec = records['2026#34']
  // 검수 메타까지 갖춘 실제 배포 항목 — 여기서는 결속만 시험한다(검수 · schema 가드는 public-guard.test.ts)
  const supports = { '2026#34': (artifact as unknown as { items: Record<string, never> }).items['2026#34'] }
  it('결속이 맞으면 ready · 화면용 projection 에는 결속 · 검수 메타가 없다', () => {
    const r = lookupMeaningSupport('2026#34', rec.analysis_version, true, { supports })
    expect(r.state).toBe('ready')
    expect(r.view).not.toHaveProperty('binding')
    expect(r.view).not.toHaveProperty('review')
  })
  it('확장 없음 · 탐구 stale · live 분석 버전 다름 · 배포 레코드 내용이 바뀜은 ready 아님', () => {
    expect(lookupMeaningSupport('2026#99', 1, true, { supports }).state).toBe('missing')
    expect(lookupMeaningSupport('2026#34', rec.analysis_version, false, { supports }).state).toBe('stale')
    expect(lookupMeaningSupport('2026#34', rec.analysis_version + 1, true, { supports }).state).toBe('stale')
    const changed = JSON.parse(JSON.stringify(rec)); changed.v3.meanings[0].meaning_ko += '!'
    expect(lookupMeaningSupport('2026#34', rec.analysis_version, true, { supports, records: { '2026#34': changed } as never }).state).toBe('stale')
  })
})

describe('URL 파서 · 빌더', () => {
  it('allowlist 밖 unit · 모르는 depth 는 기본으로 정규화', () => {
    expect(parseMeaningParams({ meaning: 'u2', depth: 'why' }, ['u1', 'u2'], 'u1')).toEqual({ unitId: 'u2', depth: 'why', relationId: null, bridge: false, normalized: false })
    expect(parseMeaningParams({ meaning: 'evil', depth: 'max' }, ['u1', 'u2'], 'u1')).toEqual({ unitId: 'u1', depth: 'brief', relationId: null, bridge: false, normalized: true })
    expect(parseMeaningParams({}, ['u1'], 'u1')).toEqual({ unitId: 'u1', depth: 'brief', relationId: null, bridge: false, normalized: false })
    // 기본값 depth=brief 는 주소에 싣지 않는다 → 정규화 대상
    expect(parseMeaningParams({ depth: 'brief' }, ['u1'], 'u1').normalized).toBe(true)
  })
  it('rel 은 그 의미에 이어진 관계만 · bridge 는 1 이고 meaning 이 있을 때만', () => {
    const rels = (u: string) => (u === 'u1' ? ['r1'] : [])
    expect(parseMeaningParams({ meaning: 'u1', rel: 'r1' }, ['u1', 'u2'], 'u1', rels)).toMatchObject({ relationId: 'r1', normalized: false })
    expect(parseMeaningParams({ meaning: 'u2', rel: 'r1' }, ['u1', 'u2'], 'u1', rels)).toMatchObject({ relationId: null, normalized: true })
    expect(parseMeaningParams({ meaning: 'u1', rel: 'zzz' }, ['u1', 'u2'], 'u1', rels)).toMatchObject({ relationId: null, normalized: true })
    expect(parseMeaningParams({ meaning: 'u1', bridge: '1' }, ['u1'], 'u1')).toMatchObject({ bridge: true, normalized: false })
    expect(parseMeaningParams({ bridge: '1' }, ['u1'], 'u1')).toMatchObject({ bridge: false, normalized: true })
    expect(parseMeaningParams({ meaning: 'u1', bridge: 'yes' }, ['u1'], 'u1')).toMatchObject({ bridge: false, normalized: true })
  })
  it('빌더 — rel · bridge 는 meaning 이 있을 때만 싣는다', () => {
    const cur = new URL('http://x/csat/item/2026-34?scene=meaning&from=map')
    const a = new URL(`http://x${buildItemUrl(cur, { scene: 'judgment', meaning: 'u1', depth: 'brief', rel: 'r1', bridge: true })}`)
    expect(a.searchParams.get('rel')).toBe('r1')
    expect(a.searchParams.get('bridge')).toBe('1')
    expect(a.searchParams.get('depth')).toBeNull()
    const b = new URL(`http://x${buildItemUrl(cur, { scene: 'judgment', meaning: null, rel: 'r1', bridge: true })}`)
    expect(b.searchParams.get('rel')).toBeNull()
    expect(b.searchParams.get('bridge')).toBeNull()
  })
  it('장면을 옮겨도 from=map · check · pair · back 은 남고 모르는 키 · 자유 문자열은 빠진다', () => {
    const cur = new URL('http://x/csat/item/2026-34?scene=meaning&from=map&pair=a~b&back=2026-38&check=1&evil=1&meaning=u1')
    const next = new URL(`http://x${buildItemUrl(cur, { scene: 'judgment', meaning: 'u2', depth: 'deep' })}`)
    expect(next.searchParams.get('scene')).toBe('judgment')
    expect(next.searchParams.get('from')).toBe('map')
    expect(next.searchParams.get('pair')).toBe('a~b')
    expect(next.searchParams.get('back')).toBe('2026-38')
    expect(next.searchParams.get('check')).toBe('1')
    expect(next.searchParams.get('meaning')).toBe('u2')
    expect(next.searchParams.get('depth')).toBe('deep')
    expect(next.searchParams.get('evil')).toBeNull()
  })
})

describe('선택 헬퍼 · 초안', () => {
  it('문장 → unit 0 · 1 · 여러 개(설명을 만들지 않음)', () => {
    expect(unitsForSentence(view, 3)).toEqual([])
    expect(unitsForSentence(view, 6).map((u) => u.id)).toEqual(['u1'])
    expect(unitsForSentence(view, 7).map((u) => u.id)).toEqual(['u2', 'u3'])
  })
  it('unit · 관계의 문장 — 같은 근거를 지도와 원문이 함께 가리킨다', () => {
    expect(sentencesOf(view, 'u3')).toEqual([7, 1])
    expect(relationSentences(view, 'r1')).toEqual([6, 7])
    expect(sentencesOf(view, 'nope')).toEqual([])
  })
  it('초안 600자 — 넘으면 오류(자르지 않음) · 한글 글자 수 기준', () => {
    expect(draftTooLong('가'.repeat(600))).toBe(false)
    expect(draftTooLong('가'.repeat(601))).toBe(true)
  })
})

describe('이어 가기 · 구절 대응 행', () => {
  it('bridgeOf — 같은 unit 의 bridge 여럿을 합치고 정렬', () => {
    const v = { ...view, bridges: [
      { unitId: 'u2', meaningIds: ['m2'], choiceNumbers: [5, 2], designClaimIndices: [3] },
      { unitId: 'u2', meaningIds: ['m3'], choiceNumbers: [3, 5], designClaimIndices: [3, 1] },
    ] }
    expect(bridgeOf(v, 'u2')).toEqual({ choices: [2, 3, 5], claims: [1, 3] })
    expect(bridgeOf(v, 'u1')).toEqual({ choices: [], claims: [] })
  })
  it('phraseRowsOf — 구문 부분 순서, 없으면 보존 조건 앵커, 앵커 없는 행은 뺀다', () => {
    const withSyntax = { ...view.units[0], syntax: { parts: [
      { id: 's1', role: 'main' as const, anchorIds: ['a1'], meaningKo: '핵심' },
      { id: 's2', role: 'modifier' as const, anchorIds: [], meaningKo: '빠짐' },
    ], attachments: [], recombinedKo: 'r' } }
    expect(phraseRowsOf(withSyntax).map((r) => r.key)).toEqual(['s1'])
    const noSyntax = { ...view.units[0], preserves: [{ facet: 'condition' as const, valueKo: '조건', anchorIds: ['a2'], explanationKo: 'e' }] }
    expect(phraseRowsOf(noSyntax)).toEqual([{ key: 'pv0', anchorIds: ['a2'], role: null, meaningKo: '조건' }])
  })
  it('배포 8문항 — 모든 unit 에 구절 대응 행이 하나 이상', () => {
    const items = (artifact as unknown as { items: Record<string, MeaningSupportView> }).items
    for (const [id, v] of Object.entries(items)) for (const u of v.units) expect(phraseRowsOf(u).length, `${id} ${u.id}`).toBeGreaterThan(0)
  })
})
