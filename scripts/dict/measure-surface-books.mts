// scripts/dict/measure-surface-books.mts
//
// **원서 원문 문장에서 표면형을 못 찾는 비율.** 사전 예문(measure-surface-match)과 달리
// 여기 문장은 사람이 쓴 원문이라 굴절형이 그대로 나온다 — 학습자가 실제로 보는 조건이다.
// 실행: npx tsx --tsconfig apps/web/tsconfig.json scripts/dict/measure-surface-books.mts [표본수]
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { matchSurface } from '../../apps/web/src/lib/text/surface-match'

const N = Number(process.argv[2] ?? 30000)
const t = fs.readFileSync('apps/web/.env.local', 'utf8')
const g = (k: string) => (t.match(new RegExp(`^${k}\s*=\s*(.+)$`, 'm')) ?? [])[1]?.trim().replace(/^["']|["']$/g, '')
const db = createClient(g('NEXT_PUBLIC_SUPABASE_URL')!, g('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

async function main() {
  const pairs: Array<{ w: string; s: string }> = []
  let from = 0
  while (pairs.length < N) {
    const { data, error } = await db.from('library_book_vocabularies')
      .select('word, lemma, first_sentence').not('first_sentence', 'is', null)
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    const rows = data ?? []
    if (!rows.length) break
    for (const r of rows as any[]) {
      const w = String(r.lemma ?? r.word ?? '').toLowerCase()
      if (w.length >= 2 && r.first_sentence) pairs.push({ w, s: r.first_sentence })
    }
    from += 1000
    process.stdout.write(`\r  fetch ${pairs.length}`)
  }
  const words = [...new Set(pairs.map((p) => p.w))]
  const forms = new Map<string, string[] | null>()
  const pos = new Map<string, string>()
  for (let i = 0; i < words.length; i += 200) {
    const { data, error } = await db.from('shared_dictionary')
      .select('word, primary_pos, inflected_forms').in('word', words.slice(i, i + 200))
    if (error) throw new Error(error.message)
    for (const r of (data ?? []) as any[]) { forms.set(r.word.toLowerCase(), r.inflected_forms); pos.set(r.word.toLowerCase(), r.primary_pos ?? '(none)') }
    process.stdout.write(`\r  dict ${i + 200}/${words.length}`)
  }
  const stat = new Map<string, { n: number; miss: number }>()
  const samples: string[] = []
  let n = 0, miss = 0, nodict = 0
  for (const p of pairs) {
    if (!forms.has(p.w)) { nodict += 1; continue }
    n += 1
    const key = pos.get(p.w)!
    const k = stat.get(key) ?? { n: 0, miss: 0 }
    k.n += 1
    if (!matchSurface(p.s, p.w, forms.get(p.w) ?? null)) {
      k.miss += 1; miss += 1
      if (samples.length < 20) samples.push(`${key.padEnd(10)} ${p.w.padEnd(16)} ${p.s.slice(0, 78)}`)
    }
    stat.set(key, k)
  }
  console.log(`\n\n  원문 문장 ${n} (사전에 없는 낱말 ${nodict} 제외) · 미스 ${miss} (${((miss / n) * 100).toFixed(2)}%)\n`)
  for (const [k, v] of [...stat].sort((a, b) => b[1].miss - a[1].miss).slice(0, 10)) {
    console.log(`  ${k.padEnd(14)} ${String(v.miss).padStart(6)} / ${String(v.n).padStart(6)}  ${((v.miss / v.n) * 100).toFixed(1)}%`)
  }
  console.log('\n  ── 미스 표본 ──')
  for (const s of samples) console.log('  ' + s)
}
main()
