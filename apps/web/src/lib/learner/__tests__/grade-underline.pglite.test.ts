// apps/web/src/lib/learner/__tests__/grade-underline.pglite.test.ts
// v6.2 P-F8d — 보류 SQL(grade_dcp_item 에 vocab_choice 분기)을 격리 Postgres(PGlite)에서 실행해
// ① 앱 `gradeUnderlineChoice` 와 같은 판정인지 ② 기존 유형 채점이 그대로인지 ③ 기록 · 정답 공개 규칙이 같은지 본다. 개발 DB 무관.
import fs from 'node:fs'
import path from 'node:path'

import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'

import { gradeUnderlineChoice } from '../dcp-underline'

const SQL = fs.readFileSync(path.resolve(__dirname, '../../../../../../supabase/migrations/_pending_grade_dcp_underline_choice.sql'), 'utf8')
const STUB = `
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table public.csat_dcp_items (id uuid primary key, kind text, ref_id uuid, type text, answer_key jsonb);
create table public.csat_item_attempts (id uuid primary key default gen_random_uuid(), user_id uuid, dcp_item_id uuid, text_id uuid, is_correct boolean, item_role text);
create table public.closed_sources (id uuid primary key);
create function public.csat_source_is_gradeable(p uuid) returns boolean language sql stable as $$ select not exists (select 1 from public.closed_sources where id = p) $$;
`
const U = '00000000-0000-4000-8000-0000000000b1'
const V = '11111111-1111-4111-8111-111111111111'
const T = '22222222-2222-4222-8222-222222222222'
const NOPOS = '33333333-3333-4333-8333-333333333333'
const SRC = '44444444-4444-4444-8444-444444444444'
let db: PGlite

const grade = async (id: string, answer: object) =>
  (await db.query<{ r: { correct: boolean; attempt_id: string; answer_key: Record<string, unknown> } }>(`select public.grade_dcp_item($1, $2::jsonb) r`, [id, JSON.stringify(answer)])).rows[0]!.r

async function err(p: Promise<unknown>): Promise<string | null> {
  try { await p; return null } catch (e) { return (e as Error).message }
}

beforeAll(async () => {
  db = new PGlite()
  await db.exec(STUB)
  await db.exec(SQL)
  await db.query(`insert into public.csat_dcp_items values
    ($1, 'article', $4, 'vocab_choice', '{"position":2,"original":"provide","explanation_ko":"② 해설"}'),
    ($2, 'article', $4, 'topic', '{"answer":4,"explanation_ko":"주제 해설"}'),
    ($3, 'article', $4, 'vocab_choice', '{"original":"x"}')`, [V, T, NOPOS, SRC])
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [U])
}, 60000)

describe('grade_dcp_item + vocab_choice(보류 SQL)', () => {
  it('SQL 판정 = 앱 gradeUnderlineChoice (1~5 전부)', async () => {
    for (const choice of [1, 2, 3, 4, 5]) {
      const r = await grade(V, { choice })
      expect(r.correct, `choice ${choice}`).toBe(gradeUnderlineChoice({ position: 2 }, { choice }))
    }
  })
  it('정답이면 해설만, 오답이면 정답 키 전체(위치 · 원래 낱말) — 기존 정답 공개 규칙 그대로', async () => {
    expect((await grade(V, { choice: 2 })).answer_key).toEqual({ explanation_ko: '② 해설' })
    expect((await grade(V, { choice: 5 })).answer_key).toMatchObject({ position: 2, original: 'provide' })
  })
  it('시도가 기존 표에 같은 모양으로 기록된다(practice 역할 · 원천 id)', async () => {
    const before = (await db.query<{ n: number }>(`select count(*)::int n from public.csat_item_attempts where dcp_item_id = $1`, [V])).rows[0]!.n
    const r = await grade(V, { choice: 1 })
    const row = (await db.query(`select user_id, text_id, is_correct, item_role from public.csat_item_attempts where id = $1`, [r.attempt_id])).rows[0]
    expect(row).toEqual({ user_id: U, text_id: SRC, is_correct: false, item_role: 'practice' })
    expect((await db.query<{ n: number }>(`select count(*)::int n from public.csat_item_attempts where dcp_item_id = $1`, [V])).rows[0]!.n).toBe(before + 1)
  })
  it('잘못된 선택 · 정답 위치 없는 문항 · 로그아웃 · 닫힌 원천은 거절', async () => {
    expect(await err(grade(V, { choice: 6 }))).toMatch(/Bad choice/)
    expect(await err(grade(V, { choice: 'x' }))).toMatch(/Bad choice/)
    expect(await err(grade(NOPOS, { choice: 1 }))).toMatch(/no answer position/)
    await db.query(`insert into public.closed_sources values ($1)`, [SRC])
    expect(await err(grade(V, { choice: 2 }))).toMatch(/unavailable/)
    await db.query(`delete from public.closed_sources`)
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`)
    expect(await err(grade(V, { choice: 2 }))).toMatch(/Forbidden/)
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [U])
  })
  it('기존 선택지 유형 채점은 그대로(answer 열) · 다른 교재 유형은 여전히 Unknown type', async () => {
    expect((await grade(T, { choice: 4 })).correct).toBe(true)
    expect((await grade(T, { choice: 2 })).correct).toBe(false)
    await db.query(`insert into public.csat_dcp_items values (gen_random_uuid(), 'article', $1, 'grammar_choice', '{"position":1}')`, [SRC])
    const g = (await db.query<{ id: string }>(`select id from public.csat_dcp_items where type = 'grammar_choice'`)).rows[0]!.id
    expect(await err(grade(g, { choice: 1 }))).toMatch(/Unknown type/)
  })
})

describe('함께 고친 기존 결함 — 선택이 없으면 NULL 로 검사를 통과하던 것', () => {
  it('choice 가 없는 제출은 기존 선택지 유형에서도 거절(이전 정의는 is_correct=NULL 을 기록했다)', async () => {
    expect(await err(grade(T, {}))).toMatch(/Bad choice/)
    expect(await err(grade(V, {}))).toMatch(/Bad choice/)
  })
})
