// scripts/dict/base-word-backfill.mjs
//
// 전체 사전 base_word 백필 — 굴절형·파생형이 "어떤 표제어(base)에서 왔는지" 관계 정보를
// shared_dictionary.base_word 에 채운다. 학습자에게 "went ← go (과거형)" 처럼 base 를 노출하기 위한 A 단계.
//
// 두 attested 소스만 사용(규칙 대량생성 금지 = abashederness 교훈):
//   1) 굴절: shared_dictionary.inflected_forms 역인덱스 (in-DB 사실, 다중 base 는 최빈 primary)
//   2) 파생: data/seed/derivational-candidates.json (freq>=50 검증 form→base)
//
// 불변식: NULL 인 base_word 만 채움(기존 값 절대 덮지 않음) · 멱등(재실행 안전) · self-ref 제외.
//   base 자신(자체 inflected_forms 보유 lemma)은 form 이 아니므로 대상 아님.
//
// Usage:
//   node scripts/dict/base-word-backfill.mjs --dry-run   # 계획만 출력(쓰기 없음)
//   node scripts/dict/base-word-backfill.mjs             # 실제 적용(멱등)

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { makeClient, arg } from '../dict-common.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')
const CANDIDATES = resolve(ROOT, 'data/seed/derivational-candidates.json')

const DRY = process.argv.includes('--dry-run')
const PAGE = 1000

const sb = makeClient()

/** 페이지네이션으로 전체 행 fetch (PostgREST 1000 cap 우회) */
async function fetchAll(select, filter) {
  const rows = []
  for (let from = 0; ; from += PAGE) {
    let q = sb.from('shared_dictionary').select(select).range(from, from + PAGE - 1)
    if (filter) q = filter(q)
    const { data, error } = await q
    if (error) throw new Error(`fetch ${select}: ${error.message}`)
    rows.push(...data)
    if (data.length < PAGE) break
  }
  return rows
}

async function main() {
  console.log(`base_word 백필 ${DRY ? '(DRY-RUN)' : '(APPLY)'}\n`)

  // ── 1. 굴절 역인덱스 (form → primary base = 최빈) ──
  const infRows = await fetchAll('word, inflected_forms, frequency_rank', (q) =>
    q.not('inflected_forms', 'is', null),
  )
  const inflMap = new Map() // form → { base, rank }
  for (const r of infRows) {
    const rank = r.frequency_rank ?? Number.MAX_SAFE_INTEGER
    for (const f of r.inflected_forms ?? []) {
      const form = String(f).toLowerCase().trim()
      if (!form || form === r.word) continue
      const cur = inflMap.get(form)
      if (!cur || rank < cur.rank) inflMap.set(form, { base: r.word, rank })
    }
  }
  console.log(`  굴절 역인덱스: ${infMapSize(inflMap)} form (from ${infRows.length} base 엔트리)`)

  // ── 2. 파생 candidates (form → base) ──
  const cands = JSON.parse(readFileSync(CANDIDATES, 'utf8'))
  const derivMap = new Map()
  for (const c of cands) {
    const form = String(c.form).toLowerCase().trim()
    const base = String(c.base).toLowerCase().trim()
    if (form && base && form !== base) derivMap.set(form, base)
  }
  console.log(`  파생 candidates: ${derivMap.size} form`)

  // ── 3. 병합 (굴절 우선 — 문법 관계가 더 근본) ──
  const merged = new Map() // form → base
  for (const [form, base] of derivMap) merged.set(form, base)
  for (const [form, { base }] of inflMap) merged.set(form, base) // 굴절이 덮음
  console.log(`  병합 대상: ${merged.size} form\n`)

  // ── 4. 실제로 base_word 가 NULL 인 헤드워드만 (덮어쓰기 금지) ──
  const headwords = await fetchAll('word', (q) => q.is('base_word', null))
  const nullSet = new Set(headwords.map((r) => r.word))
  const toFill = [] // { form, base }
  for (const [form, base] of merged) {
    if (nullSet.has(form)) toFill.push({ form, base })
  }
  console.log(`  base_word NULL 이면서 매핑 있는 form: ${toFill.length}`)

  if (toFill.length === 0) {
    console.log('\n  채울 대상 없음(이미 완료). 종료.')
    return
  }

  // 샘플 출력
  console.log('  샘플:', toFill.slice(0, 8).map((x) => `${x.form}←${x.base}`).join(', '))

  if (DRY) {
    console.log(`\n  [DRY-RUN] ${toFill.length} form 에 base_word 채울 예정. 쓰기 없음.`)
    return
  }

  // ── 5. base 별 그룹 UPDATE (distinct base 당 1 UPDATE, NULL-only 가드) ──
  const byBase = new Map() // base → [forms]
  for (const { form, base } of toFill) {
    if (!byBase.has(base)) byBase.set(base, [])
    byBase.get(base).push(form)
  }
  let updated = 0
  let failed = 0
  const bases = [...byBase.keys()]
  for (let i = 0; i < bases.length; i += 50) {
    const chunk = bases.slice(i, i + 50)
    await Promise.all(
      chunk.map(async (base) => {
        const forms = byBase.get(base)
        const { data, error } = await sb
          .from('shared_dictionary')
          .update({ base_word: base })
          .in('word', forms)
          .is('base_word', null)
          .select('word')
        if (error) { failed += forms.length; console.error(`  ✗ ${base}: ${error.message}`) }
        else updated += data.length
      }),
    )
    process.stdout.write(`\r  적용: ${updated} form (base ${Math.min(i + 50, bases.length)}/${bases.length})`)
  }
  console.log(`\n\n  ✅ 완료 — base_word 채움 ${updated} form · 실패 ${failed}`)
}

function infMapSize(m) { return m.size }

main().catch((e) => { console.error(e); process.exit(1) })
