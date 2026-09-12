// scripts/dict/measure-surface-match.mts
//
// **예문에서 표제어 표면형을 못 찾는 비율을 전수로 잰다.**
//
// 왜 재나 — `matchSurface` 가 실패하면 `blankSurface` 는 문장을 **그대로 돌려준다**.
// 플래시카드 예문 빈칸이 안 생기고, 카드 앞면에 정답이 그대로 보인다. 렌더는 성공하므로
// 아무도 모른다. 이 저장소가 반복해 겪은 "조용한 결함" 이다.
//
// 실측 2026-09-05: 규칙에 **비교급·최상급(-er/-est)이 아예 없다.** 형용사 `inflected_forms`
// 는 9.3% 뿐이라 "happier" 가 든 문장에서 lemma `happy` 가 통째로 미스난다.
//
// 실행: npx tsx --tsconfig apps/web/tsconfig.json scripts/dict/measure-surface-match.mts
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { matchSurface } from '../../apps/web/src/lib/text/surface-match'

const t = fs.readFileSync('apps/web/.env.local', 'utf8')
const g = (k: string) => (t.match(new RegExp(`^${k}\s*=\s*(.+)$`, 'm')) ?? [])[1]?.trim().replace(/^["']|["']$/g, '')
const db = createClient(g('NEXT_PUBLIC_SUPABASE_URL')!, g('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

type Row = { word: string; primary_pos: string | null; inflected_forms: string[] | null; meanings_ko: Array<{ example?: string }> | null }

const stat = new Map<string, { n: number; miss: number }>()
const samples: string[] = []
let n = 0, miss = 0, cursor = ''
for (;;) {
  const { data, error } = await db
    .from('shared_dictionary')
    .select('word, primary_pos, inflected_forms, meanings_ko')
    .eq('archived', false)
    .gt('word', cursor).order('word').limit(1000)
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as Row[]
  if (!rows.length) break
  for (const r of rows) {
    for (const s of r.meanings_ko ?? []) {
      const ex = s?.example
      if (!ex || ex.length < 8) continue
      n += 1
      const key = r.primary_pos ?? '(none)'
      const k = stat.get(key) ?? { n: 0, miss: 0 }
      k.n += 1
      if (!matchSurface(ex, r.word, r.inflected_forms)) {
        k.miss += 1; miss += 1
        if (samples.length < 25) samples.push(`${(r.primary_pos ?? '?').padEnd(10)} ${r.word.padEnd(18)} ${ex.slice(0, 72)}`)
      }
      stat.set(key, k)
    }
  }
  cursor = rows[rows.length - 1].word
  process.stdout.write(`\r  scan ${n}`)
}
console.log(`\n\n  예문 ${n} · 표면형 미스 ${miss} (${((miss / n) * 100).toFixed(2)}%)\n`)
for (const [pos, k] of [...stat].sort((a, b) => b[1].miss - a[1].miss)) {
  console.log(`  ${pos.padEnd(14)} ${String(k.miss).padStart(6)} / ${String(k.n).padStart(6)}  ${((k.miss / k.n) * 100).toFixed(1)}%`)
}
console.log('\n  ── 미스 표본 ──')
for (const s of samples) console.log('  ' + s)
