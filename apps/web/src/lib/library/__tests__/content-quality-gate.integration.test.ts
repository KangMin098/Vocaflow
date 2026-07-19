// apps/web/src/lib/library/__tests__/content-quality-gate.integration.test.ts
// 콘텐츠 품질 게이트 자체 테스트 — run_content_quality_gates 함수 계약·회귀·결함검출 검증.
// 환경변수(SERVICE_ROLE_KEY) 없으면 skip (CI 정상). service-role → auth.uid()=NULL 이라 게이트 admin 가드 통과.
// 핵심: 통과만 하는 약한 테스트가 아니라, "주입한 결함을 게이트가 실제로 잡는가"까지 검증(결함검출 스위트).

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL']
const SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']
const skipIfNoEnv = !SUPABASE_URL || !SERVICE_KEY

/** book scope 픽스처 — Pride and Prejudice (published·재발행됨·추출후보 충분).
 *  파일 직렬 실행(fileParallelism:false)으로 extraction.integration 과 경합 없음. */
const GOLDEN_BOOK = 'ac506006-6147-4d23-8dba-72698eb7e9ae'

interface GateRow {
  pipeline: string
  invariant: string
  severity: 'critical' | 'warning'
  fail_count: number
  verdict: 'PASS' | 'FAIL' | 'WARN'
  detail: Record<string, unknown> | null
}

async function gate(db: SupabaseClient, scope: string, id?: string): Promise<GateRow[]> {
  const { data, error } = await db.rpc('run_content_quality_gates', {
    p_scope: scope,
    p_id: id ?? null,
  })
  if (error) throw new Error(`gate(${scope}) failed: ${error.message}`)
  return (data ?? []) as GateRow[]
}

const criticalFails = (rows: GateRow[]) =>
  rows.filter((r) => r.severity === 'critical' && r.verdict === 'FAIL')

describe.skipIf(skipIfNoEnv)('content quality gate (integration · 자체 테스트)', () => {
  let db: SupabaseClient
  let articleId: string
  let vcbSetId: string
  // 결함 주입용 임시 세트(미발행 — 전역 게이트 오염 방지, word_set scope 는 is_published 무관 검사)
  let defectSetId: string
  let emptySetId: string

  beforeAll(async () => {
    db = createClient(SUPABASE_URL!, SERVICE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // 픽스처 id 확보
    const { data: art } = await db
      .from('library_articles')
      .select('id')
      .eq('status', 'published')
      .limit(1)
      .single()
    articleId = (art as { id: string }).id

    const { data: set } = await db
      .from('shared_word_sets')
      .select('id')
      .eq('is_published', true)
      .in('category', ['csat', 'themed', 'high', 'middle', 'elementary'])
      .limit(1)
      .single()
    vcbSetId = (set as { id: string }).id

    // 결함 주입 세트 A: 노이즈(mph=abbreviation) + 뜻결측 단어
    const { data: dset } = await db
      .from('shared_word_sets')
      .insert({
        title: 'GATE TEST — defect', category: 'themed', is_published: false,
        auto_curated: false, slug: `gatetest-defect-${randomUUID()}`, version: 1,
      })
      .select('id')
      .single()
    defectSetId = (dset as { id: string }).id
    // 개별 insert (meaning_ko NOT NULL — 배치 실패 방지). 뜻결측은 '' (length=0) 로 주입.
    const e1 = await db
      .from('shared_words')
      .insert({ set_id: defectSetId, word: 'mph', lemma: 'mph', meaning_ko: '시속 마일', sort_order: 1 })
    if (e1.error) throw new Error(`noise insert failed: ${e1.error.message}`)
    const e2 = await db
      .from('shared_words')
      .insert({ set_id: defectSetId, word: 'fortune', lemma: 'fortune', meaning_ko: '', sort_order: 2 })
    if (e2.error) throw new Error(`empty-meaning insert failed: ${e2.error.message}`)

    // 결함 주입 세트 B: 빈 세트
    const { data: eset } = await db
      .from('shared_word_sets')
      .insert({
        title: 'GATE TEST — empty', category: 'themed', is_published: false,
        auto_curated: false, slug: `gatetest-empty-${randomUUID()}`, version: 1,
      })
      .select('id')
      .single()
    emptySetId = (eset as { id: string }).id
  }, 60_000)

  afterAll(async () => {
    // 임시 세트 정리 (shared_words 는 set_id CASCADE)
    if (defectSetId) await db.from('shared_word_sets').delete().eq('id', defectSetId)
    if (emptySetId) await db.from('shared_word_sets').delete().eq('id', emptySetId)
  })

  // ── 계약: 각 scope 가 기대 불변식을 반환하고 verdict 가 유효 ──
  it('global scope: 핵심 불변식 반환 + verdict 유효', { timeout: 60_000 }, async () => {
    const rows = await gate(db, 'global')
    const names = rows.map((r) => r.invariant)
    expect(names.some((n) => n.startsWith('I1'))).toBe(true)
    expect(names.some((n) => n.startsWith('I5'))).toBe(true)
    expect(names.some((n) => n.startsWith('I7'))).toBe(true)
    expect(names.some((n) => n.startsWith('I8'))).toBe(true)
    expect(names.some((n) => n.startsWith('I9'))).toBe(true)
    expect(names.some((n) => n.startsWith('I11'))).toBe(true) // ACP 라이선스
    for (const r of rows) {
      expect(['PASS', 'FAIL', 'WARN']).toContain(r.verdict)
      expect(['critical', 'warning']).toContain(r.severity)
      expect(r.fail_count).toBeGreaterThanOrEqual(0)
    }
  })

  // ── 회귀: 현재 발행 콘텐츠는 critical 결함 0 (누가 깨뜨리면 실패) ──
  it('global scope: critical FAIL 0 (발행 콘텐츠 건강)', { timeout: 60_000 }, async () => {
    const fails = criticalFails(await gate(db, 'global'))
    expect(fails, `critical fails: ${fails.map((f) => f.invariant).join(', ')}`).toHaveLength(0)
  })

  it('book scope: I8/I10 반환 + P&P critical PASS(재발행 후 SSoT 동기)', { timeout: 60_000 }, async () => {
    const rows = await gate(db, 'book', GOLDEN_BOOK)
    expect(rows.some((r) => r.invariant.startsWith('I8'))).toBe(true)
    expect(rows.some((r) => r.invariant.startsWith('I10'))).toBe(true)
    expect(criticalFails(rows)).toHaveLength(0)
  })

  it('article scope: I9/I11 반환 + critical PASS', async () => {
    const rows = await gate(db, 'article', articleId)
    expect(rows.some((r) => r.invariant.startsWith('I9'))).toBe(true)
    expect(rows.some((r) => r.invariant.startsWith('I11'))).toBe(true)
    expect(criticalFails(rows)).toHaveLength(0)
  })

  it('word_set scope: VCB 세트 critical PASS', async () => {
    const rows = await gate(db, 'word_set', vcbSetId)
    expect(rows.length).toBeGreaterThan(0)
    expect(criticalFails(rows)).toHaveLength(0)
  })

  // ── 행동: scope 가 p_id 없으면 예외 ──
  it('book scope: p_id 없으면 예외', async () => {
    await expect(gate(db, 'book')).rejects.toThrow()
  })

  // ── 결함 검출(핵심): 주입한 결함을 게이트가 실제로 잡는가 ──
  it('결함검출: 노이즈(mph) 주입 → word_set I7 FAIL', async () => {
    const rows = await gate(db, 'word_set', defectSetId)
    const i7 = rows.find((r) => r.invariant.startsWith('I7'))
    expect(i7?.verdict).toBe('FAIL')
    expect(i7?.fail_count).toBeGreaterThanOrEqual(1)
  })

  it('결함검출: 뜻결측 주입 → word_set 뜻결측 FAIL', async () => {
    const rows = await gate(db, 'word_set', defectSetId)
    const m = rows.find((r) => r.invariant.includes('뜻'))
    expect(m?.verdict).toBe('FAIL')
    expect(m?.fail_count).toBeGreaterThanOrEqual(1)
  })

  it('결함검출: 빈 세트 → word_set 비어있음 FAIL', async () => {
    const rows = await gate(db, 'word_set', emptySetId)
    const empty = rows.find((r) => r.invariant.includes('비어있음'))
    expect(empty?.verdict).toBe('FAIL')
  })

  // ── content_gate_publishable 일관성 ──
  it('content_gate_publishable: 건강한 도서 true', { timeout: 60_000 }, async () => {
    const { data, error } = await db.rpc('content_gate_publishable', {
      p_scope: 'book',
      p_id: GOLDEN_BOOK,
    })
    expect(error).toBeNull()
    expect(data).toBe(true)
  })

  it('content_gate_publishable: critical FAIL 세트... 는 word_set 미지원 — book 게이트가 gate 로직 신뢰 검증', async () => {
    // publishable 은 book/article scope 대상. 결함 book 픽스처가 없으므로
    // 건강한 book=true 만 회귀로 두고, 결함검출은 word_set 직접 게이트가 담당(위 테스트).
    const { data } = await db.rpc('content_gate_publishable', { p_scope: 'article', p_id: articleId })
    expect(data).toBe(true)
  })
})
