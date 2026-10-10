// apps/web/src/lib/csat/map/__tests__/evidence.test.ts
//
// 지도 지표 게이트 · 실패 격리 — 미설치 · 시드 전 · 후속 조회 실패에도 던지지 않고, 기존 스냅샷 키를 건드리지 않는다.

import type { SupabaseClient } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { EngineInput, EngineSettings } from '../../diagnosis/engine/types'
import { mapEvidenceFor } from '../evidence'

// 보류 판정(embargo-gate)은 service role RPC — 여기서는 보류 없음으로 둔다(판정 자체는 embargo-gate.test.ts)
vi.mock('../../embargo-gate', () => ({ embargoedExamIds: async () => new Set<string>(), embargoedItemIds: async () => new Set<string>() }))

type Resp = { data: unknown; error: { message: string; code?: string } | null }

/** 표 이름별 응답을 돌려주는 가짜 클라이언트(체인은 전부 같은 응답으로 끝난다) */
function fakeDb(tables: Record<string, Resp | (() => Resp)>): SupabaseClient {
  const make = (table: string) => {
    const chain: Record<string, unknown> = {}
    const done = () => {
      const r = tables[table]
      return Promise.resolve(typeof r === 'function' ? r() : (r ?? { data: [], error: null }))
    }
    for (const m of ['select', 'in', 'limit', 'eq']) chain[m] = () => chain
    chain.then = (res: (v: Resp) => unknown, rej: (e: unknown) => unknown) => done().then(res, rej)
    return chain
  }
  return { from: (table: string) => make(table) } as unknown as SupabaseClient
}

const SETTINGS = {
  grade_cuts: [90],
  half_life_days: 60,
  credit: { sure: 1, unsure: 0.7, guess: 0.3, timeout: 0.3 },
  retake_weight: 0.5,
  min_observations: 1,
  listening: { attribute: 'A7', weight: 2 },
  trap: { min_exposure: 1, vulnerable_ratio: 0.3 },
  habits: {
    time_collapse: { from_no: 41, to_no: 45, ratio: 1.5, timeout_count: 2 },
    guessing: { guess_ratio: 0.15, easy_error_rate: 0.2, easy_wrong_count: 2 },
    word_reuse: { family: 'C1', ratio: 0.4 },
    cutline_90: { sessions: 3, lo: 86, hi: 93 },
    ebs: { gap: 0.2 },
    listening: { to_no: 17, wrong_count: 2, consecutive: 2 },
  },
} as unknown as EngineSettings

const INPUT: EngineInput = {
  now: new Date('2026-10-01T00:00:00Z'),
  settings: SETTINGS,
  sessions: [{ id: 's', examId: 'E', mode: 'live', takenAt: '2026-10-01', rawScore: null, responses: [{ itemNo: 1, itemId: null, chosen: 1, isCorrect: true, confidence: 'sure' }] }],
  exams: { E: { id: 'E', ready: true, key: [], items: {} } },
  items: {},
  trapFamily: {},
  target: null,
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('mapEvidenceFor', () => {
  it('테이블이 없으면(미설치) off — 던지지 않는다', async () => {
    for (const code of ['42P01', 'PGRST205']) {
      const db = fakeDb({ csat_map_line_link: { data: null, error: { message: 'relation does not exist', code } } })
      expect(await mapEvidenceFor(db, INPUT)).toEqual({ status: 'off', evidence: null })
    }
  })

  it('시드 전(행 0)이면 off', async () => {
    const db = fakeDb({ csat_map_line_link: { data: [], error: null } })
    expect((await mapEvidenceFor(db, INPUT)).status).toBe('off')
  })

  it('게이트 통과 뒤 후속 조회가 실패하면 failed 이고 던지지 않는다(기존 저장 계속)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    let n = 0
    const db = fakeDb({
      csat_map_line_link: () => (++n === 1 ? { data: [{ line_code: 'A1' }], error: null } : { data: [], error: null }),
      csat_items: { data: null, error: { message: 'boom' } },
    })
    const r = await mapEvidenceFor(db, INPUT)
    expect(r).toEqual({ status: 'failed', evidence: null })
  })

  it('게이트의 그 밖의 오류도 off 가 아니라 failed 로 남긴다(오류를 0 으로 삼키지 않음)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const db = fakeDb({ csat_map_line_link: { data: null, error: { message: 'permission denied', code: '42501' } } })
    expect((await mapEvidenceFor(db, INPUT)).status).toBe('failed')
  })

  it('정상이면 ok 와 지도 지표를 돌려준다', async () => {
    const db = fakeDb({
      csat_map_line_link: { data: [{ line_code: 'B6', link_kind: 'type', ref: 'R-GIST' }], error: null },
      csat_items: { data: [], error: null },
      csat_dx_answer_key: { data: [{ exam_id: 'E', no: 1, points: 2 }], error: null },
    })
    const r = await mapEvidenceFor(db, INPUT)
    expect(r.status).toBe('ok')
    expect(r.evidence).toMatchObject({ lineAccuracy: {}, attributePoints: {}, trapAvoidance: {} })
  })
})
