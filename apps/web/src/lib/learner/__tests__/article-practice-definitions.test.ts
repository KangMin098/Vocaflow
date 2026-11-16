// apps/web/src/lib/learner/__tests__/article-practice-definitions.test.ts
//
// T-0215 — 두 DB 함수의 검수 허용 목록이 같은 글 · 같은 문항을 내는가(동일성 회귀). 정본은 supabase/migrations 의 SQL 이다(사본 fixture 없음).
// - article_practice_items(p_article_id)  : 기사 화면 · 연습 화면이 문항을 받는 getter
// - article_practice_availability()       : 서가 목록 「연습 있음」 이 글별 문항 수를 받는 함수
// 파일명 순서상 마지막 CREATE OR REPLACE 를 최신 정의로 읽어 reviewed VALUES 6열(item_id, item_type, article_id, body_sha, payload_sha,
// key_sha) 행 집합 · 글별 문항 수 · 관문 조건 집합을 비교한다.
// ⚠️ Grass 적용 migration(20261028115511)은 Grass 두 행의 payload_sha · key_sha 를 같은 파일의 검수 상수(_grass_reviewed)에서
//    적용 시점에 계산해 %L 로 넣는다. 여기서는 그 상수를 PostgreSQL jsonb::text 와 같은 규칙으로 직렬화해 sha256 을 다시 계산한다 —
//    계산 결과가 availability 의 고정 상수와 같아야 통과한다(규칙이 틀리면 이 검사가 실패해 알려 준다).
// 변형 4종(해시 한 글자 · 행 누락 · 기사 id 변경 · 관문 제거)을 반드시 잡는지도 확인한다(pa-t215-identity.cjs 로직 이식).

import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const MIGRATIONS = path.resolve(__dirname, '../../../../../../supabase/migrations')
const COLS = ['item_id', 'item_type', 'article_id', 'body_sha', 'payload_sha', 'key_sha']
const GATES = [
  'auth.uid() IS NOT NULL',
  "up.status IN ('suspended', 'deleted')",
  "d.kind = 'article'",
  'd.type = r.item_type',
  "a.status = 'published'",
  'a.copyright_safe_in_kr IS TRUE',
  "encode(sha256(convert_to(a.content, 'UTF8')), 'hex') = r.body_sha",
  "encode(sha256(convert_to(d.payload::text, 'UTF8')), 'hex') = r.payload_sha",
  "encode(sha256(convert_to(d.answer_key::text, 'UTF8')), 'hex') = r.key_sha",
  'public.csat_source_is_gradeable(d.ref_id)',
  'JOIN public.csat_dcp_items d ON d.id = r.item_id',
  'JOIN public.library_articles a ON a.id = d.ref_id',
]
const norm = (s: string) => s.replace(/\s+/g, ' ')
const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex')

/** 그 함수를 CREATE OR REPLACE 하는 마지막 migration 의 정의 본문(파일명 순서). */
function latestDefinition(fn: string): { file: string; sql: string; body: string } {
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()
  let found: { file: string; sql: string; body: string } | null = null
  for (const file of files) {
    const sql = readFileSync(path.join(MIGRATIONS, file), 'utf8').replace(/\r\n/g, '\n')
    const re = new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\(`, 'g')
    let m: RegExpExecArray | null
    while ((m = re.exec(sql))) found = { file, sql, body: sql.slice(m.index) }
  }
  if (!found) throw new Error(`${fn} 정의를 migration 에서 찾지 못했다`)
  return found
}

/** reviewed CTE 의 열 이름 · 행(따옴표 값 · %L 자리표시는 '%L' 로) */
function reviewedRows(body: string): { cols: string[]; rows: string[][] } {
  const head = body.match(/WITH reviewed\(([^)]*)\) AS \(\s*VALUES([\s\S]*?)\n\s*\)\n/)
  if (!head) throw new Error('reviewed VALUES 를 찾지 못했다')
  const cols = head[1]!.split(',').map((c) => c.trim())
  const rows = head[2]!
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('('))
    .map((l) => [...l.matchAll(/'([^']*)'(?:::uuid)?|(%L)/g)].map((v) => v[1] ?? v[2]!))
  return { cols, rows }
}

// ── PostgreSQL jsonb::text 직렬화(검수 상수 → sha) ────────────────────────────────────────────────────────────
// jsonb 는 객체 키를 (길이, 바이트) 순으로 저장하고 `{"k": v, ...}` · `[a, b]` 로 낸다. 문자열은 \" \\ \b \f \n \r \t, 그 밖 제어문자는 \u00XX.
function pgString(s: string): string {
  let out = '"'
  for (const ch of s) {
    const c = ch.codePointAt(0)!
    if (ch === '"') out += '\\"'
    else if (ch === '\\') out += '\\\\'
    else if (ch === '\b') out += '\\b'
    else if (ch === '\f') out += '\\f'
    else if (ch === '\n') out += '\\n'
    else if (ch === '\r') out += '\\r'
    else if (ch === '\t') out += '\\t'
    else if (c < 0x20) out += '\\u' + c.toString(16).padStart(4, '0')
    else out += ch
  }
  return out + '"'
}
function pgJsonbText(v: unknown): string {
  if (v === null) return 'null'
  if (typeof v === 'string') return pgString(v)
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (Array.isArray(v)) return '[' + v.map(pgJsonbText).join(', ') + ']'
  const keys = Object.keys(v as object).sort((a, b) => {
    const la = Buffer.byteLength(a), lb = Buffer.byteLength(b)
    return la !== lb ? la - lb : Buffer.compare(Buffer.from(a), Buffer.from(b))
  })
  return '{' + keys.map((k) => `${pgString(k)}: ${pgJsonbText((v as Record<string, unknown>)[k])}`).join(', ') + '}'
}

/** Grass migration 의 %L 네 자리(tp, tk, pp, pk)를 같은 파일의 _grass_reviewed 상수에서 계산해 채운다. */
function resolvePlaceholders(file: { sql: string }, rows: string[][]): string[][] {
  if (!rows.some((r) => r.includes('%L'))) return rows
  if (!/\$f\$, tp, tk, pp, pk\);/.test(file.sql)) throw new Error('자리표시 인자 순서(tp, tk, pp, pk)를 확인할 수 없다')
  const block = file.sql.match(/CREATE TEMP TABLE _grass_reviewed[\s\S]*?\) AS v\(id, type, payload, answer_key\);/)
  if (!block) throw new Error('_grass_reviewed 상수를 찾지 못했다')
  const consts: Record<string, { p: string; k: string }> = {}
  for (const m of block[0].matchAll(/\('([0-9a-f-]{36})'::uuid, '(\w+)', '((?:[^']|'')*)'::jsonb, '((?:[^']|'')*)'::jsonb\)/g)) {
    const unq = (s: string) => s.replace(/''/g, "'")
    consts[m[2]!] = { p: sha256(pgJsonbText(JSON.parse(unq(m[3]!)))), k: sha256(pgJsonbText(JSON.parse(unq(m[4]!)))) }
  }
  if (!consts.title || !consts.topic) throw new Error('_grass_reviewed 의 title · topic 두 행이 필요하다')
  const fill = [consts.title.p, consts.title.k, consts.topic.p, consts.topic.k]
  let i = 0
  return rows.map((r) => r.map((v) => (v === '%L' ? fill[i++]! : v)))
}

function compare(a: string[][], b: string[][]) {
  const ka = a.map((r) => r.join('|')).sort(), kb = b.map((r) => r.join('|')).sort()
  return { same: ka.length === kb.length && ka.every((k, i) => k === kb[i]), onlyA: ka.filter((k) => !kb.includes(k)), onlyB: kb.filter((k) => !ka.includes(k)) }
}
const countsOf = (rows: string[][]) => rows.reduce<Record<string, number>>((m, r) => ((m[r[2]!] = (m[r[2]!] ?? 0) + 1), m), {})

const items = latestDefinition('article_practice_items')
const availability = latestDefinition('article_practice_availability')
const itemsR = reviewedRows(items.body)
const availR = reviewedRows(availability.body)
const itemsRows = resolvePlaceholders(items, itemsR.rows)
const availRows = availR.rows

describe('article_practice_items ↔ article_practice_availability — 같은 검수 허용 목록(migration 정본)', () => {
  it('최신 정의 파일(파일명 순서 마지막 CREATE OR REPLACE)', () => {
    expect(items.file).toBe('20261029035740_voa_getter_add_title_item.sql')
    expect(availability.file).toBe('20261029035740_voa_getter_add_title_item.sql')
  })
  it('reviewed 6열 · 같은 행 수', () => {
    expect(itemsR.cols).toEqual(COLS)
    expect(availR.cols).toEqual(COLS)
    expect(itemsRows).toHaveLength(availRows.length)
    expect(itemsRows.every((r) => r.length === 6 && r.every((v) => v && v !== '%L'))).toBe(true)
  })
  it('행 집합이 같다(Grass 해시는 같은 파일의 검수 상수에서 jsonb::text 규칙으로 다시 계산)', () => {
    const c = compare(itemsRows, availRows)
    expect({ onlyInItems: c.onlyA, onlyInAvailability: c.onlyB }).toEqual({ onlyInItems: [], onlyInAvailability: [] })
  })
  it('글별 문항 수가 같다', () => {
    expect(countsOf(itemsRows)).toEqual(countsOf(availRows))
  })
  it('관문 조건 집합이 양쪽에 모두 있고 기사 결속 줄이 있다', () => {
    expect(GATES.filter((g) => !norm(items.body).includes(norm(g)))).toEqual([])
    expect(GATES.filter((g) => !norm(availability.body).includes(norm(g)))).toEqual([])
    // items: p_article_id = r.article_id AND d.ref_id = p_article_id ⇒ d.ref_id = r.article_id(같은 결속)
    expect(items.body).toMatch(/p_article_id = r\.article_id/)
    expect(items.body).toMatch(/d\.ref_id = p_article_id/)
    expect(availability.body).toMatch(/d\.ref_id = r\.article_id/)
    expect(availability.body).toMatch(/GROUP BY r\.article_id/)
    expect(availability.body).toMatch(/count\(\*\)::integer AS item_count/)
  })
})

describe('자기 검사 — 변형을 반드시 잡는다', () => {
  const flip = (s: string) => s.replace(/.$/, (c) => (c === '0' ? '1' : '0'))
  it('한 행 key_sha 한 글자 · 한 행 빠짐 · article_id 바뀜', () => {
    expect(compare(itemsRows, availRows.map((r, i) => (i === 0 ? [...r.slice(0, 5), flip(r[5]!)] : r))).same).toBe(false)
    expect(compare(itemsRows, availRows.slice(1)).same).toBe(false)
    expect(compare(itemsRows, availRows.map((r, i) => (i === 2 ? [r[0]!, r[1]!, '11111111-1111-4111-8111-111111111111', ...r.slice(3)] : r))).same).toBe(false)
  })
  it('관문 하나 제거', () => {
    const removed = availability.body.replace('a.copyright_safe_in_kr IS TRUE', '')
    expect(GATES.filter((g) => !norm(removed).includes(norm(g)))).toEqual(['a.copyright_safe_in_kr IS TRUE'])
  })
  it('jsonb 직렬화 규칙이 틀리면 Grass 해시가 어긋난다(공백 없는 JSON.stringify 로는 다르다)', () => {
    // Grass 검수 상수(_grass_reviewed)는 Grass 적용 migration 에만 있다 — 최신 정의 파일이 아니라 그 파일을 읽는다.
    const grassSql = readFileSync(path.join(MIGRATIONS, '20261028115511_grass_r0_apply_v3.sql'), 'utf8').replace(/\r\n/g, '\n')
    const block = grassSql.match(/'ee5a3e66-ee79-489f-b639-5a74c9b97a71'::uuid, 'title', '((?:[^']|'')*)'::jsonb/)!
    const naive = sha256(JSON.stringify(JSON.parse(block[1]!.replace(/''/g, "'"))))
    expect(naive).not.toBe(availRows.find((r) => r[0] === 'ee5a3e66-ee79-489f-b639-5a74c9b97a71')![4])
  })
})
