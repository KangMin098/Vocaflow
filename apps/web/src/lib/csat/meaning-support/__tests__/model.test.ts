// apps/web/src/lib/csat/meaning-support/__tests__/model.test.ts
//
// v3.1 원문 이해 — 서버 해시 ↔ 빌드 해시 동치(전 문항) · 결속 stale · URL 파서/빌더(allowlist · 맥락 보존) · 선택 헬퍼
import { describe, expect, it } from 'vitest'

import inquiry from '../../inquiry-data.json'
// 빌드 · CI 가 쓰는 정본 해시 — 서버 구현과 같은 값을 내야 한다
import { basePublicHash as scriptHash } from '../../../../../../../scripts/csat/lib-meaning-support.mjs'
import { basePublicHash, lookupMeaningSupport } from '../data'
import type { MeaningSupportView } from '../labels'
import { buildItemUrl, draftTooLong, parseMeaningParams, relationSentences, sentencesOf, unitsForSentence } from '../model'

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
  const stored = { ...view, schema: 'meaning-support/1', binding: { analysisVersion: rec.analysis_version, unitsHash: rec.v3!.units_hash, basePublicHash: basePublicHash(rec), sourceSnapshotHash: 'x' } }
  const supports = { '2026#34': stored }
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
    expect(parseMeaningParams({ meaning: 'u2', depth: 'why' }, ['u1', 'u2'], 'u1')).toEqual({ unitId: 'u2', depth: 'why', normalized: false })
    expect(parseMeaningParams({ meaning: 'evil', depth: 'max' }, ['u1', 'u2'], 'u1')).toEqual({ unitId: 'u1', depth: 'brief', normalized: true })
    expect(parseMeaningParams({}, ['u1'], 'u1')).toEqual({ unitId: 'u1', depth: 'brief', normalized: false })
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
