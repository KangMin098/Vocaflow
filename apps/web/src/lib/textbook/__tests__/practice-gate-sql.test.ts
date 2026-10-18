// apps/web/src/lib/textbook/__tests__/practice-gate-sql.test.ts
// v6.2 P-F7a — 보류 마이그레이션(연습 RPC 발행 결속 2판)이 카탈로그와 일치하고, 호출자 V레벨을 받지 않는지(위조 방지)
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { SERIES_CATALOG } from '@vocaflow/library-pipeline/textbook-series-catalog'

const FILE = path.resolve(__dirname, '../../../../../../supabase/migrations/_pending_textbook_practice_publish_gate.sql')
const sql = fs.readFileSync(FILE, 'utf8')
const fn = sql.slice(sql.indexOf('create or replace function public.textbook_practice_items_for'), sql.indexOf('$$;'))

describe('연습 RPC 발행 결속 보류 SQL(2판)', () => {
  it('권 → V레벨 대응 행 = 카탈로그(생성물 · 손으로 고치지 않음)', () => {
    const want = SERIES_CATALOG.flatMap((s) => s.rungs.flatMap((r) => r.vLevels.map((v) => `('${s.id}', ${r.step}, ${v})`))).sort()
    const got = [...sql.matchAll(/^\('([a-z]+)', (\d+), (\d+)\)/gm)].map((m) => `('${m[1]}', ${m[2]}, ${m[3]})`).sort()
    expect(got).toEqual(want)
  })
  it('권 → 유형 대응 행 = 카탈로그', () => {
    const want = SERIES_CATALOG.flatMap((s) => s.rungs.flatMap((r) => r.types.map((t) => `${s.id}/${r.step}/${t}`))).sort()
    const got = [...sql.matchAll(/^\('([a-z]+)', (\d+), '([a-z_]+)'\)/gm)].map((m) => `${m[1]}/${m[2]}/${m[3]}`).sort()
    expect(got).toEqual(want)
  })
  it('새 함수는 (series, step, limit) 만 받는다 — 호출자 V레벨 매개변수 없음(이전 제안의 위조 경로 제거)', () => {
    const sig = sql.match(/function public\.textbook_practice_items_for\(([^)]*)\)/)![1]
    expect(sig).not.toMatch(/v_level/)
  })
  it('함수 본문: 로그인 · 발행 · 대응 V레벨 · 권 유형 · 출처 적격 — 모두 AND(하나라도 없으면 0행)', () => {
    expect(fn).toMatch(/auth\.uid\(\) is not null/)
    expect(fn).toMatch(/r\.status = 'published'/)
    expect(fn).toMatch(/i\.v_level in \(select l\.v_level from textbook_rung_level/)
    expect(fn).toMatch(/i\.type in \(select t\.type from textbook_rung_type/)
    expect(fn).toMatch(/csat_source_is_eligible\(a\.id\)/)
    expect(fn.slice(fn.indexOf('where'))).not.toMatch(/\bor\b/i)
    expect(fn).toMatch(/security definer set search_path to 'public'/)
  })
  it('대응 표는 학습자가 직접 못 읽는다 · anon 실행 회수 · 옛 함수 회수는 앱 배포 뒤 별도 단계(주석)', () => {
    expect(sql).toMatch(/revoke all on public\.textbook_rung_level, public\.textbook_rung_type from anon, authenticated;/)
    expect(sql).toMatch(/from public, anon/)
    expect(sql).toMatch(/^-- revoke execute on function public\.textbook_practice_items\(smallint, integer\) from authenticated;/m)
  })
})
