// apps/web/src/lib/csat/map/__tests__/choice-traps-artifact.test.ts
//
// Choice Trap 대응표(저장소 JSON) — 버전 파일 스키마 검사. 판정 · 검수는 이 파일의 「버전:sha256」을 provenance 로 남긴다.
// 파일을 덮어쓰지 않고 새 버전을 만든다 — 그래서 이미 있는 버전 파일의 해시는 아래 표에 고정한다(바뀌면 실패).

import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const DIR = join(process.cwd(), '..', '..', 'docs', 'csat-learner', 'choice-traps')
const CODES = ['lexical_overlap', 'irrelevant_truth', 'part_whole', 'cause_effect_reversal', 'scope_strength', 'relation_distortion', 'polarity_reversal', 'outside_text', 'structure_cue']

/** 봉인된 버전 파일의 내용 해시(줄바꿈 정규화 후). 새 버전을 더할 때만 이 표에 한 줄을 더한다 */
const SEALED: Record<string, string> = {}

interface Artifact {
  version: string
  status: 'provisional' | 'sealed'
  codes: { code: string; label: string; definition: string }[]
  map: Record<string, string>
  overrides: { item_id: string; option_no: number; trap_code: string | null; grammar_point: boolean }[]
}

const files = readdirSync(DIR).filter((f) => /^v\d+\.\d+\.json$/.test(f))
export const contentHash = (raw: string) => createHash('sha256').update(raw.replace(/\r\n/g, '\n')).digest('hex')

describe('choice-traps 버전 파일', () => {
  it('버전 파일이 있다', () => expect(files.length).toBeGreaterThan(0))

  for (const f of files) {
    const raw = readFileSync(join(DIR, f), 'utf8')
    const a = JSON.parse(raw) as Artifact
    it(`${f} — 스키마`, () => {
      expect(a.version).toBe(f.replace(/\.json$/, ''))
      expect(['provisional', 'sealed']).toContain(a.status)
      expect(a.codes.map((c) => c.code).sort()).toEqual([...CODES].sort())
      for (const c of a.codes) expect(c.label.length * c.definition.length).toBeGreaterThan(0)
      for (const [key, code] of Object.entries(a.map)) {
        expect(key.trim()).toBe(key)
        expect(CODES).toContain(code)
      }
      for (const o of a.overrides) {
        expect(o.item_id).toMatch(/^[A-Za-z0-9_]+#\d{1,2}$/)
        expect(o.option_no).toBeGreaterThanOrEqual(1)
        expect(o.option_no).toBeLessThanOrEqual(5)
        if (o.trap_code !== null) expect(CODES).toContain(o.trap_code)
        if (o.grammar_point) expect(o.trap_code).toBeNull()
      }
    })
    it(`${f} — DB manifest(csat_ec_choice_trap_map_approved)의 해시가 파일 실제 해시와 같다`, () => {
      // 마이그레이션이 승인 목록으로 박아 둔 「버전:sha256」 — 파일을 바꾸면(새 버전 없이) 여기서 실패한다
      const sql = readFileSync(join(process.cwd(), '..', '..', 'supabase', 'migrations', '_pending_csat_error_evidence.sql'), 'utf8')
      const fn = sql.slice(sql.indexOf('function public.csat_ec_choice_trap_map_approved'))
      const listed = [...fn.slice(0, fn.indexOf('$$;')).matchAll(/'(v\d+\.\d+):([0-9a-f]{64})'/g)].map((m) => ({ v: m[1], h: m[2] }))
      const entry = listed.find((x) => x.v === a.version)
      expect(entry, `${a.version} 가 DB manifest 에 없다`).toBeTruthy()
      expect(entry!.h).toBe(contentHash(raw))
    })
    it(`${f} — 봉인된 버전은 내용이 바뀌지 않는다`, () => {
      if (a.status === 'sealed') expect(SEALED[a.version], `${f} 해시를 SEALED 표에 고정한다`).toBe(contentHash(raw))
    })
  }
})
