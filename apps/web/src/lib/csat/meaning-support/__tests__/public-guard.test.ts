// apps/web/src/lib/csat/meaning-support/__tests__/public-guard.test.ts
//
// v3.1 공개 조회 가드 — 서버가 결속만이 아니라 schema · 검수 기준 · 필수 검수 메타 · **지금 본문의 contentHash** 를 다시 확인한다.
// 검수 정보 없음 · 잘못된 해시 · 본문 변경 · 모르는 schema · 기준 다름은 공개하지 않고(state 'invalid'), 기존 v3 설명은 그대로 쓴다.
// 서버 해시와 빌드 해시(scripts/csat/lib-meaning-support.mjs)는 배포 산출물 전 항목에서 같은 값을 낸다.
import { describe, expect, it } from 'vitest'

import inquiry from '../../inquiry-data.json'
import artifact from '../../meaning-support-data.json'
import { supportContentHash as scriptContentHash } from '../../../../../../../scripts/csat/lib-meaning-support.mjs'
import { lookupMeaningSupport, supportContentHash } from '../data'

type Entry = Record<string, unknown> & { review?: { criteria?: string; contentHash?: string; reviewer?: string }; schema?: string; units: { simpleKo: string }[] }
const records = (inquiry as unknown as { items: Record<string, { analysis_version: number }> }).items
const entries = (artifact as unknown as { items: Record<string, Entry> }).items
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))
const ids = Object.keys(entries)

describe('contentHash — 서버 = 빌드 = 검수 판정에 묶인 값', () => {
  it('배포 산출물 전 항목', () => {
    expect(ids.length).toBeGreaterThan(0)
    for (const id of ids) {
      expect(supportContentHash(entries[id]), id).toBe(scriptContentHash(entries[id]))
      expect(supportContentHash(entries[id]), id).toBe(entries[id].review?.contentHash)
    }
  })
  it('본문 한 글자만 바뀌어도 해시가 바뀐다', () => {
    const e = clone(entries[ids[0]])
    e.units[0].simpleKo += '.'
    expect(supportContentHash(e)).not.toBe(entries[ids[0]].review?.contentHash)
  })
})

describe('lookupMeaningSupport — 검수 · schema 가드', () => {
  const id = ids[0]
  const v = records[id].analysis_version
  const look = (e: Entry) => lookupMeaningSupport(id, v, true, { supports: { [id]: e } as never })
  it('정상 항목은 ready', () => {
    expect(look(clone(entries[id])).state).toBe('ready')
  })
  it('검수 정보 없음 → invalid', () => {
    const e = clone(entries[id]); delete e.review
    expect(look(e)).toEqual({ state: 'invalid', view: null })
  })
  it('검수자 없음 · 기준 다름 → invalid', () => {
    const a = clone(entries[id]); a.review = { ...a.review, reviewer: '' }
    const b = clone(entries[id]); b.review = { ...b.review, criteria: 'meaning-support-v0.9' }
    expect(look(a).state).toBe('invalid')
    expect(look(b).state).toBe('invalid')
  })
  it('잘못된 해시 → invalid', () => {
    const e = clone(entries[id]); e.review = { ...e.review, contentHash: '0000000000000000' }
    expect(look(e).state).toBe('invalid')
  })
  it('검수 뒤 본문 변경(해시는 옛 값) → invalid', () => {
    const e = clone(entries[id]); e.units[0].simpleKo = '검수받지 않은 설명'
    expect(look(e).state).toBe('invalid')
  })
  it('모르는 schema → invalid', () => {
    const e = clone(entries[id]); e.schema = 'meaning-support/2'
    expect(look(e).state).toBe('invalid')
  })
})
