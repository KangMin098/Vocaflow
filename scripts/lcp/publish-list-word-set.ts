// scripts/lcp/publish-list-word-set.ts
//
// ⚠️ SUPERSEDED (2026-08-15) — 컴포저가 같은 세트를 만든다:
//     pnpm vcb:compose --blueprint curriculum-grade --tag kcurr2022_2 [--commit]
//     pnpm vcb:compose --blueprint exam-list --tag csat-prep-core-2k --count 2000 [--commit]
//   차이: 컴포저는 레시피·7지표 점수를 curation_query 에 남기고 통과선 미달이면 발행을 막는다.
//   `--chapter-size N` 처럼 순서를 N개씩 끊는 목차는 `day-pacing` blueprint 가 담당한다.
//   새 유형은 이 파일 복사가 아니라 blueprints.ts 한 항목으로 (docs/VCB_REDESIGN.md §0).
//
// list_tags 필터 → 공용단어장 발행기 (범용 · 세트 1개 안에 내부 챕터 구성).
//
// shared_dictionary.list_tags 에 특정 태그(예: kcurr2022_1)가 붙은 단어들을 뽑아
// shared_word_sets 1개(헤더) + shared_words(단어, 각 단어에 chapter 번호) 로 발행한다.
// ★ 하나의 공용단어장은 여러 챕터로 "내부 구성" — 챕터별로 세트를 나눠 발행하지 않는다.
//
// 구성(파이프라인):
//   1) 필터 — meaning_ko 보유 + (기본)content POS + 길이≥3.  --all 로 원문 전량.
//   2) 분류·정렬 — --order=freq(빈도, 기본) | cefr(A1→C2 후 빈도, 급별 진행) | alpha.
//   3) 챕터 — --chapter-size=N 이면 정렬된 순서를 N개씩 끊어 shared_words.chapter(1..N) 배정
//      (세트는 1개 유지). 미지정 시 chapter=NULL(단일).
//
// 기본 is_published=false(초안) — 검수 후 게시하거나 --publish 로 즉시 게시.
//
// Usage:
//   pnpm tsx scripts/lcp/publish-list-word-set.ts \
//     --list-id=kcurr2022_1 --slug=curriculum-2022-elem --title="교육과정 기본어휘 (초등)" \
//     --category=elementary --cover-emoji=🏫 --order=cefr --chapter-size=40 [--cap=N] [--all] \
//     [--min-cefr=B1] [--publish] [--replace] [--dry-run]
//
// category 유효값(예): csat / eng_test / elementary / middle / high / civil / business / themed.

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
  else w.sort((a, b) => freqRank(a) - freqRank(b) || a.word.localeCompare(b.word))
  return w
}

/** 정렬된 위치(0-based)의 챕터 번호. chapterSize 미지정 시 null. */
function chapterOf(index: number): number | null {
  return chapterSize ? Math.floor(index / chapterSize) + 1 : null
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

/** 기존 세트 정리(--replace) — 단일 slug + 과거 챕터별 세트(slug-ch-*) 모두 삭제. */
async function deleteExisting(client: SupabaseClient): Promise<number> {
  const { data } = await client
    .from('shared_word_sets')
    .select('id')
    .or(`slug.eq.${slug},slug.like.${slug}-ch-%`)
  const ids = ((data ?? []) as { id: string }[]).map((r) => r.id)
  for (const id of ids) {
    await client.from('shared_words').delete().eq('set_id', id)
    await client.from('shared_word_sets').delete().eq('id', id)
  }
  return ids.length
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
  const chapterCount = chapterSize ? Math.ceil(words.length / chapterSize) : 0
  console.log(
    `📊 [${listId}] ${all.length} tagged(meaning_ko) → ${filtered.length} after ${filterDesc} → ${words.length} selected (cap=${cap ?? 'none'})`,
  )
  console.log(
    `📖 1 set · ${chapterSize ? `${chapterCount} chapter(s) × ~${chapterSize}` : 'no chapters (flat)'} · order=${order}`,
  )
  if (words.length === 0) {
    console.error('  ⚠️  0 words matched — nothing to publish.')
    process.exit(1)
  }

  if (dryRun) {
    if (chapterSize) {
      for (let c = 1; c <= Math.min(chapterCount, 20); c++) {
        const seg = words.slice((c - 1) * chapterSize, c * chapterSize)
        const head = seg[0]
        const tail = seg[seg.length - 1]
        console.log(
          `   Ch.${String(c).padStart(2)} (${seg.length}) — ${head.word}(${head.cefr_level ?? '?'}) … ${tail.word}(${tail.cefr_level ?? '?'})`,
        )
      }
      if (chapterCount > 20) console.log(`   … +${chapterCount - 20} more chapters`)
    } else {
      words.slice(0, 15).forEach((w, i) =>
        console.log(`   ${String(i + 1).padStart(3)}. ${w.word} — ${w.meaning_ko} (${w.cefr_level ?? '?'})`),
      )
    }
    return
  }

  // 기존 세트 정리 / 중복 체크
  if (replace) {
    const n = await deleteExisting(client)
    if (n) console.log(`  ♻️  replaced ${n} existing set(s) (single + legacy chapter sets)`)
  } else {
    const { data: dup } = await client
      .from('shared_word_sets')
      .select('id')
      .or(`slug.eq.${slug},slug.like.${slug}-ch-%`)
      .limit(1)
    if (dup && dup.length) {
      console.error(`  ❌ slug "${slug}" (or legacy chapters) already exists. Use --replace to rebuild.`)
      process.exit(1)
    }
  }

  // 세트 1개 생성
  const curationQuery = {
    source: 'shared_dictionary',
    filters: { list_tags: [listId], meaning_ko: 'present', content_pos_only: !includeAll },
    order,
    cap: cap ?? null,
    chapter_size: chapterSize,
    chapter_count: chapterSize ? chapterCount : null,
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

  // 단어 삽입 — 각 단어에 chapter(1..N) + 전역 sort_order
  let inserted = 0
  for (let i = 0; i < words.length; i += BATCH) {
    const chunk = words.slice(i, i + BATCH).map((w, j) => {
      const idx = i + j
      return {
        set_id: setId,
        word: w.word,
        lemma: w.word,
        meaning_ko: w.meaning_ko,
        part_of_speech: w.primary_pos ?? w.pos ?? null,
        cefr_level: w.cefr_level,
        example_en: w.example_en,
        ipa: w.ipa ?? w.ipa_us ?? w.ipa_uk ?? null,
        sort_order: idx + 1,
        chapter: chapterOf(idx),
      }
    })
    const { error: wErr } = await client.from('shared_words').insert(chunk)
    if (wErr) throw wErr
    inserted += chunk.length
    console.log(`  ${inserted}/${words.length} words inserted`)
  }
  await client.from('shared_word_sets').update({ word_count: inserted }).eq('id', setId)

  console.log(
    `\n✅ Done — "${slug}" (${setId}) · 1 set · ${inserted} words · ${chapterSize ? `${chapterCount} chapters` : 'flat'} · is_published=${publish}${publish ? '' : ' (draft — 검수 후 게시)'}`,
  )
}

main().catch((err) => {
  console.error('💥 Failed:', err)
  process.exit(1)
})
