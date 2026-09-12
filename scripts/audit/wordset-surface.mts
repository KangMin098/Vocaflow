// scripts/audit/wordset-surface.mts
//
// 공용 단어장(shared_words / shared_word_sets) → 학습자 화면 "조용한 결함" 측정 (READ ONLY).
//
// 학습자 코드의 매처를 **그대로 import** 한다 — 근사치가 아니라 화면이 실제로 하는 판정.
//   apps/web/src/lib/text/surface-match.ts  ·  matchSurface / blankSurface
//
// 실행: npx tsx --tsconfig apps/web/tsconfig.json scripts/audit/wordset-surface.mts
//       (실행 디렉토리 = repo root)

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { matchSurface } from '../../apps/web/src/lib/text/surface-match'

// ── env (키는 절대 출력하지 않는다) ────────────────────────────────
for (const f of ['apps/web/.env.local', '.env.local']) {
  try {
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch {
    /* ignore */
  }
}
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_ || !KEY) {
  console.error('env 없음: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const sb: SupabaseClient = createClient(URL_, KEY, { auth: { persistSession: false } })

const PAGE = 1000

/** supabase-js 는 fetch 실패를 throw 가 아니라 { error } 로 준다 — 반환 error 로 재시도. */
async function retry<T>(fn: () => Promise<{ data: T | null; error: unknown }>, label: string): Promise<T> {
  let last: unknown = null
  for (let i = 0; i < 5; i++) {
    const r = await fn()
    if (!r.error) return (r.data ?? []) as T
    last = r.error
    await new Promise((res) => setTimeout(res, 400 * (i + 1)))
  }
  throw new Error(`${label} 실패: ${JSON.stringify(last)}`)
}

interface Row {
  id: string
  word: string
  lemma: string | null
  meaning_ko: string | null
  source_sentence: string | null
  example_en: string | null
  set_id: string
}

/**
 * ORDER BY id 로 명시 페이징 — 정렬이 없으면 실행마다 표본이 달라져 전후 비교가 잡음이 된다.
 * 커서(id > last)로 넘긴다: .range() 는 깊은 오프셋에서 느리고, 동시 쓰기에 흔들린다.
 */
async function pageBy(
  build: (q: ReturnType<SupabaseClient['from']>) => any,
  label: string,
): Promise<Row[]> {
  const out: Row[] = []
  let cursor = '00000000-0000-0000-0000-000000000000'
  for (;;) {
    const q = build(sb.from('shared_words')).gt('id', cursor).order('id', { ascending: true }).limit(PAGE)
    const batch = await retry<Row[]>(() => q as any, label)
    if (batch.length === 0) break
    out.push(...batch)
    cursor = batch[batch.length - 1].id
    if (batch.length < PAGE) break
    if (out.length % 20000 === 0) process.stderr.write(`  ${label}: ${out.length}\n`)
  }
  return out
}

/** lemma → shared_dictionary.inflected_forms (학습자 경로 loadInflectedForms 와 같은 키). */
async function loadForms(lemmas: string[]): Promise<Map<string, string[]>> {
  const uniq = [...new Set(lemmas.filter(Boolean))]
  const map = new Map<string, string[]>()
  for (let i = 0; i < uniq.length; i += 500) {
    const slice = uniq.slice(i, i + 500)
    const data = await retry<Array<{ word: string; inflected_forms: string[] | null }>>(
      () => sb.from('shared_dictionary').select('word, inflected_forms').in('word', slice) as any,
      'inflected_forms',
    )
    for (const r of data) if (r.inflected_forms?.length) map.set(r.word, r.inflected_forms)
  }
  return map
}

function clipped(s: string | null): boolean {
  return !!s && s.length >= 290 && s.length <= 300
}

async function main() {
  const outDir = 'scripts/audit'
  mkdirSync(outDir, { recursive: true })

  // ── 발행 세트 id (학습자에게 보이는 모집단) ──────────────────────
  const setRows: Array<{ id: string; title: string; category: string }> = []
  {
    let cursor = '00000000-0000-0000-0000-000000000000'
    for (;;) {
      const batch = await retry<Array<{ id: string; title: string; category: string }>>(
        () =>
          sb
            .from('shared_word_sets')
            .select('id, title, category')
            .eq('is_published', true)
            .gt('id', cursor)
            .order('id', { ascending: true })
            .limit(PAGE) as any,
        '발행 세트',
      )
      if (batch.length === 0) break
      setRows.push(...batch)
      cursor = batch[batch.length - 1].id
      if (batch.length < PAGE) break
    }
  }
  const setMeta = new Map(setRows.map((s) => [s.id, s]))
  console.log(`발행 세트 ${setRows.length}개`)

  // 길이 필터는 PostgREST 에서 안 되므로 전량을 훑되, 필요한 컬럼만 받는다.
  const all = await pageBy(
    (t) => t.select('id, word, lemma, meaning_ko, source_sentence, example_en, set_id'),
    'shared_words',
  )
  console.log(`shared_words 전량 ${all.length}행`)

  const published = all.filter((r) => setMeta.has(r.set_id))
  console.log(`발행 세트 소속 ${published.length}행`)

  const forms = await loadForms(published.map((r) => (r.lemma ?? r.word).toLowerCase()))
  console.log(`inflected_forms 보유 lemma ${forms.size}개`)

  // ── 판정 ────────────────────────────────────────────────────────
  const stat = {
    published: published.length,
    withExample: 0,
    clipped: 0,
    clippedMiss: 0,
    notClipped: 0,
    notClippedMiss: 0,
    // 문장에 낱말이 **문자열로는** 있는데 매처가 못 잡는 경우 = 하이라이트/빈칸 실패
    substringPresentButMatcherMiss: 0,
  }
  const samplesMiss: any[] = []
  const samplesBoundary: any[] = []
  const missBySet = new Map<string, number>()

  for (const r of published) {
    const example = (r.source_sentence ?? r.example_en ?? '').trim()
    if (!example) continue
    stat.withExample++
    const lemma = (r.lemma ?? r.word).toLowerCase()
    const knownForms = forms.get(lemma) ?? []
    // 학습자 경로: scoped-words 는 word(표면형) 로, hub-words 도 word 로 매칭한다.
    const m = matchSurface(example, r.word, knownForms)
    const isClipped = clipped(r.source_sentence)
    if (isClipped) stat.clipped++
    else stat.notClipped++

    if (!m) {
      if (isClipped) stat.clippedMiss++
      else stat.notClippedMiss++
      missBySet.set(r.set_id, (missBySet.get(r.set_id) ?? 0) + 1)
      const lex = example.toLowerCase()
      const substringPresent =
        lex.includes(r.word.toLowerCase()) ||
        lex.includes(lemma) ||
        knownForms.some((f) => lex.includes(f.toLowerCase()))
      if (substringPresent) {
        stat.substringPresentButMatcherMiss++
        if (samplesBoundary.length < 20)
          samplesBoundary.push({
            id: r.id,
            word: r.word,
            lemma: r.lemma,
            set: setMeta.get(r.set_id)?.title,
            len: example.length,
            example: example.slice(0, 180),
          })
      } else if (samplesMiss.length < 40) {
        samplesMiss.push({
          id: r.id,
          word: r.word,
          lemma: r.lemma,
          meaning_ko: r.meaning_ko,
          set: setMeta.get(r.set_id)?.title,
          category: setMeta.get(r.set_id)?.category,
          len: example.length,
          clipped: isClipped,
          example,
        })
      }
    }
  }

  // 세트 단위 피해 — 한 세트에서 몇 %가 깨졌나
  const setDamage = [...missBySet.entries()]
    .map(([id, n]) => ({ set: setMeta.get(id)?.title ?? id, n }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 15)

  console.log('\n=== ① 예문이 그 낱말을 담지 않는다 (학습자 매처 기준) ===')
  console.log(JSON.stringify(stat, null, 2))
  console.log('상위 피해 세트:', JSON.stringify(setDamage, null, 2))

  writeFileSync(
    `${outDir}/wordset-surface.result.json`,
    JSON.stringify({ stat, setDamage, samplesMiss, samplesBoundary }, null, 2),
    'utf8',
  )
  console.log(`\n→ ${outDir}/wordset-surface.result.json 에 표본 저장`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
