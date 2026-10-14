// apps/web/src/lib/textbook/__tests__/practice-gate-sql.test.ts
// v6.2 P-F6a — 보류 마이그레이션(연습 RPC 발행 결속)이 카탈로그와 일치하고, 호출자 V레벨을 받지 않는지(위조 방지)
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { SERIES_CATALOG } from '@vocaflow/library-pipeline/textbook-series-catalog'

const FILE = path.resolve(__dirname, '../../../../../../supabase/migrations/_pending_textbook_practice_publish_gate.sql')
const sql = fs.readFileSync(FILE, 'utf8')

describe('연습 RPC 발행 결속 보류 SQL', () => {
  it('권 → V레벨 대응 행 = 카탈로그(생성물 · 손으로 고치지 않음)', () => {
    const want = SERIES_CATALOG.flatMap((s) => s.rungs.flatMap((r) => r.vLevels.map((v) => `('${s.id}', ${r.step}, ${v})`))).sort()
    const got = [...sql.matchAll(/^\('([a-z]+)', (\d+), (\d+)\)/gm)].map((m) => `('${m[1]}', ${m[2]}, ${m[3]})`).sort()
    expect(got).toEqual(want)
  })
  it('새 함수는 (series, step, limit) 만 받는다 — 호출자 V레벨 매개변수 없음(이전 제안의 위조 경로 제거)', () => {
    const sig = sql.match(/function public\.textbook_practice_items_for\(([^)]*)\)/)![1]
    expect(sig).not.toMatch(/v_level/)
    expect(sql).toMatch(/r\.status = 'published'/)
    expect(sql).toMatch(/i\.v_level in \(select l\.v_level from textbook_rung_level/)
  })
  it('anon 실행 회수 · 옛 함수 회수는 앱 배포 뒤 별도 단계(주석)', () => {
    expect(sql).toMatch(/from public, anon/)
    expect(sql).toMatch(/^-- revoke execute on function public\.textbook_practice_items\(smallint, integer\) from authenticated;/m)
  })
})
