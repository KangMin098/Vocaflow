// scripts/lcp/publish-list-word-set.ts
//
// list_tags 필터 → 공용단어장 발행기 (범용).
//
// shared_dictionary.list_tags 에 특정 태그(예: kcurr2022_1)가 붙은 단어들을 뽑아
// shared_word_sets(헤더) + shared_words(단어) 로 발행한다. VCB 큐레이션의 코드 경로 버전 —
// specialty-* / auto-vlevel-* 세트와 동일한 shape(word·meaning_ko·pos·cefr·example_en·ipa·sort_order).
//
// 품질 게이트: meaning_ko 보유 단어만. 정렬: frequency_rank ASC(빈도 상위 먼저).
// 기본 is_published=false(초안) — 검수 후 별도로 게시하거나 --publish 로 즉시 게시.
//
// Usage:
//   pnpm tsx scripts/lcp/publish-list-word-set.ts \
//     --list-id=kcurr2022_1 --slug=curriculum-2022-elem --title="교육과정 기본어휘 (초등 *)" \
//     --category=elementary --cover-emoji=🏫 [--cap=500] [--publish] [--replace] [--dry-run]
//
// category 유효값(예): csat / eng_test / elementary / middle / high / themed (DB CHECK 준수).

import { config as dotenvConfig } from 'dotenv'
import { resolve } from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

dotenvConfig({ path: resolve(process.cwd(), '.env.local') })
dotenvConfig({ path: resolve(process.cwd(), '.env') })

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length)
}
const listId = getArg('list-id')
const slug = getArg('slug')
const title = getArg('title')
const category = getArg('category') ?? 'themed'
const coverEmoji = getArg('cover-emoji') ?? null
const description = getArg('description') ?? null
const capRaw = getArg('cap')
const cap = capRaw ? parseInt(capRaw, 10) : null
const publish = process.argv.includes('--publish')
const replace = process.argv.includes('--replace')
const dryRun = process.argv.includes('--dry-run')
// 품질 필터 (기본 ON) — 학습용 단어장에서 기능어(대명사/전치사/관사/조동사…) 배제.
//   auto-vlevel-* 관례: pos in (noun,verb,adjective,adverb) + 길이 ≥ 3.  --all 로 전량(원문 그대로).
const includeAll = process.argv.includes('--all')
const minLength = getArg('min-length') ? parseInt(getArg('min-length')!, 10) : 3
const minCefr = getArg('min-cefr')?.toUpperCase() ?? null

if (!listId || !slug || !title) {
  console.error(
    'usage: pnpm tsx scripts/lcp/publish-list-word-set.ts --list-id=<tag> --slug=<slug> --title=<title> [--category=themed] [--cover-emoji=📚] [--description=..] [--cap=N] [--min-length=3] [--min-cefr=B1] [--all] [--publish] [--replace] [--dry-run]',
  )
  process.exit(1)
}

interface DictRow {
  word: string
  meaning_ko: string | null
  primary_pos: string | null
  pos: string | null
  cefr_level: string | null
  example_en: string | null
  ipa: string | null
  ipa_us: string | null
  ipa_uk: string | null
  frequency_rank: number | null
}

const BATCH = 500

async function fetchWords(client: SupabaseClient): Promise<DictRow[]> {
  const rows: DictRow[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client
      .from('shared_dictionary')
      .select('word, meaning_ko, primary_pos, pos, cefr_level, example_en, ipa, ipa_us, ipa_uk, frequency_rank')
      .contains('list_tags', [listId!])
      .not('meaning_ko', 'is', null)
      .order('frequency_rank', { ascending: true, nullsFirst: false })
      .order('word', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    const page = (data ?? []) as DictRow[]
    rows.push(...page)
    if (page.length < PAGE) break
  }
  return rows
}

const CONTENT_POS = ['noun', 'verb', 'adjective', 'adverb']
const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
function isContentPos(r: DictRow): boolean {
  const p = (r.primary_pos ?? r.pos ?? '').toLowerCase()
  return CONTENT_POS.some((c) => p === c || p.startsWith(c.slice(0, 3)))
}
function cefrOk(r: DictRow): boolean {
  if (!minCefr) return true
  const i = CEFR_ORDER.indexOf((r.cefr_level ?? '').toUpperCase())
  return i >= 0 && i >= CEFR_ORDER.indexOf(minCefr)
}

async function main(): Promise<void> {
  console.log(
    `📚 publish word set — ${dryRun ? 'DRY RUN' : publish ? 'LIVE + PUBLISH' : 'LIVE (draft)'} — list_id="${listId}" slug="${slug}"\n`,
  )

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  const client = createClient(url, key)

  const all = await fetchWords(client)
  const filtered = includeAll
    ? all
    : all.filter((r) => r.word.length >= minLength && isContentPos(r) && cefrOk(r))
  const words = cap ? filtered.slice(0, cap) : filtered
  const filterDesc = includeAll
    ? 'no filter (--all)'
    : `content-pos + len≥${minLength}${minCefr ? ` + cefr≥${minCefr}` : ''}`
  console.log(
    `📊 [${listId}] ${all.length} tagged(meaning_ko) → ${filtered.length} after ${filterDesc} → ${words.length} selected (cap=${cap ?? 'none'})`,
  )
  if (words.length === 0) {
    console.error('  ⚠️  0 words matched — nothing to publish.')
    process.exit(1)
  }

  if (dryRun) {
    console.log('📋 Sample (first 15):')
    words.slice(0, 15).forEach((w, i) =>
      console.log(`   ${String(i + 1).padStart(3)}. ${w.word} — ${w.meaning_ko} (${w.primary_pos ?? w.pos ?? '?'}, ${w.cefr_level ?? '?'})`),
    )
    return
  }

  // slug 충돌 처리
  const { data: existing } = await client.from('shared_word_sets').select('id').eq('slug', slug!).maybeSingle()
  if (existing?.id) {
    if (!replace) {
      console.error(`  ❌ slug "${slug}" already exists (${existing.id}). Use --replace to rebuild.`)
      process.exit(1)
    }
    await client.from('shared_words').delete().eq('set_id', existing.id)
    await client.from('shared_word_sets').delete().eq('id', existing.id)
    console.log(`  ♻️  replaced existing set ${existing.id}`)
  }

  const curationQuery = {
    source: 'shared_dictionary',
    filters: { list_tags: [listId], meaning_ko: 'present' },
    order: 'frequency_rank ASC NULLS LAST',
    cap: cap ?? null,
    generated_by: 'scripts/lcp/publish-list-word-set.ts',
  }

  const { data: setRow, error: setErr } = await client
    .from('shared_word_sets')
    .insert({
      slug,
      title,
      category,
      description,
      cover_emoji: coverEmoji,
      is_published: publish,
      auto_curated: false,
      word_count: words.length,
      curation_query: curationQuery,
      source_attributions: [{ kind: 'list_tag', tag: listId }],
    })
    .select('id')
    .single()
  if (setErr) throw setErr
  const setId = (setRow as { id: string }).id
  console.log(`  ✅ set created: ${setId}`)

  let inserted = 0
  for (let i = 0; i < words.length; i += BATCH) {
    const chunk = words.slice(i, i + BATCH).map((w, j) => ({
      set_id: setId,
      word: w.word,
      lemma: w.word,
      meaning_ko: w.meaning_ko,
      part_of_speech: w.primary_pos ?? w.pos ?? null,
      cefr_level: w.cefr_level,
      example_en: w.example_en,
      ipa: w.ipa ?? w.ipa_us ?? w.ipa_uk ?? null,
      sort_order: i + j + 1,
    }))
    const { error: wErr } = await client.from('shared_words').insert(chunk)
    if (wErr) throw wErr
    inserted += chunk.length
    console.log(`  ${inserted}/${words.length} words inserted`)
  }

  await client.from('shared_word_sets').update({ word_count: inserted }).eq('id', setId)
  console.log(
    `\n✅ Done — set "${slug}" (${setId}) · ${inserted} words · is_published=${publish}${publish ? '' : ' (draft — 검수 후 게시)'}`,
  )
}

main().catch((err) => {
  console.error('💥 Failed:', err)
  process.exit(1)
})
