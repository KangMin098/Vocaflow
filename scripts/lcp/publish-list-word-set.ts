// scripts/lcp/publish-list-word-set.ts
//
// list_tags 필터 → 공용단어장 발행기 (범용 · 챕터 구성 지원).
//
// shared_dictionary.list_tags 에 특정 태그(예: kcurr2022_1)가 붙은 단어들을 뽑아
// shared_word_sets(헤더) + shared_words(단어) 로 발행한다. specialty-*/auto-vlevel-*/library_book
// 세트와 동일한 shape(word·meaning_ko·pos·cefr·example_en·ipa·sort_order).
//
// 구성(파이프라인):
//   1) 필터 — meaning_ko 보유 + (기본)content POS + 길이≥3.  --all 로 원문 전량.
//   2) 분류·정렬 — --order=freq(빈도, 기본) | cefr(A1→C2 후 빈도, 급별 진행) | alpha.
//   3) 챕터 — --chapter-size=N 이면 N개씩 끊어 챕터 세트 다수 생성(library_book 관례:
//      각 챕터=별도 shared_word_sets, 공통 group key + chapter_idx + sort_order). 미지정 시 단일 세트.
//
// 기본 is_published=false(초안) — 검수 후 게시하거나 --publish 로 즉시 게시.
//
// Usage:
//   pnpm tsx scripts/lcp/publish-list-word-set.ts \
//     --list-id=kcurr2022_1 --slug=curriculum-2022-elem --title="교육과정 기본어휘 (초등)" \
//     --category=elementary --cover-emoji=🏫 --order=cefr --chapter-size=40 [--cap=N] [--all] \
//     [--min-cefr=B1] [--publish] [--replace] [--dry-run]
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
const cap = getArg('cap') ? parseInt(getArg('cap')!, 10) : null
const chapterSize = getArg('chapter-size') ? parseInt(getArg('chapter-size')!, 10) : null
const order = (getArg('order') ?? 'freq').toLowerCase() // freq | cefr | alpha
const publish = process.argv.includes('--publish')
const replace = process.argv.includes('--replace')
const dryRun = process.argv.includes('--dry-run')
// 품질 필터 (기본 ON) — 학습용 단어장에서 기능어(대명사/전치사/관사/조동사…) 배제.
const includeAll = process.argv.includes('--all')
const minLength = getArg('min-length') ? parseInt(getArg('min-length')!, 10) : 3
const minCefr = getArg('min-cefr')?.toUpperCase() ?? null

if (!listId || !slug || !title) {
  console.error(
    'usage: pnpm tsx scripts/lcp/publish-list-word-set.ts --list-id=<tag> --slug=<slug> --title=<title> [--category=themed] [--cover-emoji=📚] [--order=freq|cefr|alpha] [--chapter-size=N] [--cap=N] [--min-length=3] [--min-cefr=B1] [--all] [--publish] [--replace] [--dry-run]',
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
function cefrRank(r: DictRow): number {
  const i = CEFR_ORDER.indexOf((r.cefr_level ?? '').toUpperCase())
  return i < 0 ? 99 : i
}
function freqRank(r: DictRow): number {
  return r.frequency_rank ?? Number.MAX_SAFE_INTEGER
}

/** 분류·정렬 — 챕터 진행 순서를 결정. cefr=급별(A1→C2) 후 빈도, alpha=사전순, freq=빈도. */
function orderWords(words: DictRow[]): DictRow[] {
  const w = [...words]
  if (order === 'cefr') w.sort((a, b) => cefrRank(a) - cefrRank(b) || freqRank(a) - freqRank(b) || a.word.localeCompare(b.word))
  else if (order === 'alpha') w.sort((a, b) => a.word.localeCompare(b.word))
  else w.sort((a, b) => freqRank(a) - freqRank(b) || a.word.localeCompare(b.word)) // freq
  return w
}

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

function wordRow(setId: string, w: DictRow, sortOrder: number) {
  return {
    set_id: setId,
    word: w.word,
    lemma: w.word,
    meaning_ko: w.meaning_ko,
    part_of_speech: w.primary_pos ?? w.pos ?? null,
    cefr_level: w.cefr_level,
    example_en: w.example_en,
    ipa: w.ipa ?? w.ipa_us ?? w.ipa_uk ?? null,
    sort_order: sortOrder,
  }
}

/** 한 세트(헤더+단어) 발행. chapter 지정 시 챕터 메타(group/chapter_idx/of) 포함. */
async function publishOneSet(
  client: SupabaseClient,
  s: { slug: string; title: string; sortOrder: number; chapter?: { idx: number; of: number } },
  chapterWords: DictRow[],
): Promise<{ id: string; count: number }> {
  const curationQuery: Record<string, unknown> = {
    source: 'shared_dictionary',
    filters: { list_tags: [listId], meaning_ko: 'present', content_pos_only: !includeAll },
    order,
    cap: cap ?? null,
    generated_by: 'scripts/lcp/publish-list-word-set.ts',
  }
  if (s.chapter) {
    curationQuery.group = slug
    curationQuery.chapter_idx = s.chapter.idx
    curationQuery.of = s.chapter.of
  }

  const { data: setRow, error: setErr } = await client
    .from('shared_word_sets')
    .insert({
      slug: s.slug,
      title: s.title,
      category,
      description,
      cover_emoji: coverEmoji,
      is_published: publish,
      auto_curated: false,
      sort_order: s.sortOrder,
      word_count: chapterWords.length,
      curation_query: curationQuery,
      source_attributions: [{ kind: 'list_tag', tag: listId }],
    })
    .select('id')
    .single()
  if (setErr) throw setErr
  const setId = (setRow as { id: string }).id

  let inserted = 0
  for (let i = 0; i < chapterWords.length; i += BATCH) {
    const chunk = chapterWords.slice(i, i + BATCH).map((w, j) => wordRow(setId, w, i + j + 1))
    const { error: wErr } = await client.from('shared_words').insert(chunk)
    if (wErr) throw wErr
    inserted += chunk.length
  }
  await client.from('shared_word_sets').update({ word_count: inserted }).eq('id', setId)
  return { id: setId, count: inserted }
}

/** 기존 세트 정리(--replace) — 단일 slug + 챕터 그룹(slug-ch-*) 모두. */
async function deleteExisting(client: SupabaseClient): Promise<string[]> {
  const ids: string[] = []
  const { data } = await client
    .from('shared_word_sets')
    .select('id')
    .or(`slug.eq.${slug},slug.like.${slug}-ch-%`)
  for (const r of (data ?? []) as { id: string }[]) ids.push(r.id)
  for (const id of ids) {
    await client.from('shared_words').delete().eq('set_id', id)
    await client.from('shared_word_sets').delete().eq('id', id)
  }
  return ids
}

async function main(): Promise<void> {
  const mode = dryRun ? 'DRY RUN' : publish ? 'LIVE + PUBLISH' : 'LIVE (draft)'
  console.log(`📚 publish word set — ${mode} — list_id="${listId}" slug="${slug}" order=${order}\n`)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  const client = createClient(url, key)

  const all = await fetchWords(client)
  const filtered = includeAll
    ? all
    : all.filter((r) => r.word.length >= minLength && isContentPos(r) && cefrOk(r))
  const capped = cap ? filtered.slice(0, cap) : filtered
  const words = orderWords(capped)
  const filterDesc = includeAll ? 'no filter (--all)' : `content-pos + len≥${minLength}${minCefr ? ` + cefr≥${minCefr}` : ''}`
  console.log(
    `📊 [${listId}] ${all.length} tagged(meaning_ko) → ${filtered.length} after ${filterDesc} → ${words.length} selected (cap=${cap ?? 'none'})`,
  )
  if (words.length === 0) {
    console.error('  ⚠️  0 words matched — nothing to publish.')
    process.exit(1)
  }

  // 챕터 분할
  const chapters: DictRow[][] = chapterSize
    ? Array.from({ length: Math.ceil(words.length / chapterSize) }, (_, i) => words.slice(i * chapterSize, (i + 1) * chapterSize))
    : [words]
  console.log(
    `📖 ${chapters.length} ${chapterSize ? `chapter(s) × ~${chapterSize}` : 'single set'} · order=${order}`,
  )

  if (dryRun) {
    chapters.slice(0, 20).forEach((ch, i) => {
      const head = ch[0]
      const tail = ch[ch.length - 1]
      console.log(
        `   Ch.${String(i + 1).padStart(2)} (${ch.length}) — ${head.word}(${head.cefr_level ?? '?'}) … ${tail.word}(${tail.cefr_level ?? '?'})`,
      )
    })
    if (chapters.length > 20) console.log(`   … +${chapters.length - 20} more chapters`)
    return
  }

  // slug 충돌 처리
  const existing = replace ? await deleteExisting(client) : []
  if (existing.length) console.log(`  ♻️  replaced ${existing.length} existing set(s)`)
  else {
    const { data: dup } = await client
      .from('shared_word_sets')
      .select('id')
      .or(`slug.eq.${slug},slug.like.${slug}-ch-%`)
      .limit(1)
    if (dup && dup.length) {
      console.error(`  ❌ slug "${slug}" (or its chapters) already exists. Use --replace to rebuild.`)
      process.exit(1)
    }
  }

  let totalWords = 0
  const setIds: string[] = []
  for (let i = 0; i < chapters.length; i++) {
    const isChap = chapterSize != null
    const s = {
      slug: isChap ? `${slug}-ch-${i + 1}` : slug!,
      title: isChap ? `${title} — Ch.${i + 1}` : title!,
      sortOrder: i,
      chapter: isChap ? { idx: i + 1, of: chapters.length } : undefined,
    }
    const res = await publishOneSet(client, s, chapters[i])
    setIds.push(res.id)
    totalWords += res.count
    console.log(`  ✅ ${s.slug} — ${res.count} words (${res.id})`)
  }

  console.log(
    `\n✅ Done — "${slug}" · ${chapters.length} set(s) · ${totalWords} words · is_published=${publish}${publish ? '' : ' (draft — 검수 후 게시)'}`,
  )
}

main().catch((err) => {
  console.error('💥 Failed:', err)
  process.exit(1)
})
