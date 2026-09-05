// scripts/dict/repair-first-sentence.mts
//
// **낱말이 없는 예문을 고친다** — `library_book_vocabularies` · `library_article_vocabularies`
// 의 `first_sentence` 재계산.
//
// ── 왜 필요한가 ───────────────────────────────────────────────────────
// `extract-lemmas` 가 문장을 `slice(0, 300)` 으로 잘랐다. 낱말이 300자 뒤에 있으면
// **그 낱말이 없는 예문**이 저장된다. 그 값은 학습자 화면으로 그대로 간다 —
// `chapter-words-queries` → `exampleSentence` → 플래시카드(빈칸이 안 뚫려 **정답이 노출**),
// 리더의 `ChapterContent` 는 직접 그린다.
//
// 실측 2026-09-05 — 원인이 깨끗하게 갈렸다:
//   도서 절단 273,443행 중 **27.6%(75,570)** 불량 · 안 잘린 1,404,586행은 1.0%
//   글   절단 186,893행 중 **16.3%(30,526)** 불량 · 안 잘린 1,628,647행은 0.1%
// 코드는 `clipAroundWord` 로 고쳤다(표면형을 가운데 두는 창). 한 권 실측: 1,465 → 12.
//
// ── 이 스크립트가 하는 일이 아닌 것 ──────────────────────────────────
// **멀쩡한 행은 건드리지 않는다.** 고친 코드는 긴 문장을 다르게 자르므로 「달라지는」 행이
// 훨씬 많지만, 그걸 다 덮으면 수백만 행을 바꾸면서 얻는 것은 없다. 그래서
// **지금 값에 그 낱말이 없는 행만** 고친다. 그리고 새 값에도 낱말이 없으면 **건너뛴다** —
// 못 고치는 것을 고친 척하지 않는다.
//
// 재실행 안전: 멱등이다. 두 번 돌려도 두 번째는 고칠 것이 0이다.
//
// 실행:
//   npx tsx --tsconfig apps/web/tsconfig.json scripts/dict/repair-first-sentence.mts books      (미리보기)
//   npx tsx --tsconfig apps/web/tsconfig.json scripts/dict/repair-first-sentence.mts books --commit
//   npx tsx --tsconfig apps/web/tsconfig.json scripts/dict/repair-first-sentence.mts articles [--commit]
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { extractBookLemmas } from '../../packages/library-pipeline/src/analyze/extract-lemmas'
import { normalizePunctuation } from '../../packages/library-pipeline/src/normalize/punctuation'
import { reflowSoftHyphens } from '../../packages/library-pipeline/src/normalize/reflow'

const MODE = process.argv[2]
const COMMIT = process.argv.includes('--commit')
const LIMIT = Number((process.argv.find((a) => a.startsWith('--limit=')) ?? '').slice(8)) || 0
if (MODE !== 'books' && MODE !== 'articles') {
  console.error('사용법: repair-first-sentence.mts books|articles [--commit] [--limit=N]')
  process.exit(1)
}

const t = fs.readFileSync('apps/web/.env.local', 'utf8')
const g = (k: string) => (t.match(new RegExp(`^${k}\\s*=\\s*(.+)$`, 'm')) ?? [])[1]?.trim().replace(/^["']|["']$/g, '')
const db = createClient(g('NEXT_PUBLIC_SUPABASE_URL')!, g('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

async function retry<T extends { error: unknown }>(fn: () => PromiseLike<T>, tries = 5): Promise<T> {
  let last: T | undefined
  for (let i = 0; i < tries; i += 1) {
    try { const r = await fn(); if (!r.error) return r; last = r } catch (e) { last = { error: e } as T }
    await new Promise((r) => setTimeout(r, 800 * (i + 1)))
  }
  return last as T
}

/** 그 문장이 그 낱말을 담고 있는가 — DB 측 판정과 같은 자(어간 앞부분) */
function holds(word: string, sentence: string | null): boolean {
  if (!sentence) return false
  const w = word.toLowerCase()
  return sentence.toLowerCase().includes(w.slice(0, Math.max(3, w.length - 3)))
}

const stat = { rows: 0, bad: 0, fixed: 0, unfixable: 0, noLemma: 0, units: 0 }

async function repairUnit(
  chapters: Array<{ chapter_idx: number; content: string; word_count: number; paragraph_offsets: number[]; sentence_offsets: number[] }>,
  rows: Array<{ id?: string; library_article_id?: string; word: string; lemma?: string | null; chapter_idx?: number; first_sentence: string | null }>,
  table: 'library_book_vocabularies' | 'library_article_vocabularies',
) {
  const idx = extractBookLemmas(chapters as never)
  const updates: Array<{ row: (typeof rows)[number]; next: string }> = []
  for (const r of rows) {
    stat.rows += 1
    const key = String(r.lemma ?? r.word).toLowerCase()
    if (holds(key, r.first_sentence)) continue
    stat.bad += 1
    const occ = (idx.occurrences.get(key) ?? []) as Array<{ chapter_idx: number; first_sentence_in_chapter: string }>
    const hit = occ.find((o) => o.chapter_idx === (r.chapter_idx ?? 1)) ?? occ[0]
    if (!hit) { stat.noLemma += 1; continue }
    const next = hit.first_sentence_in_chapter
    // **새 값에도 낱말이 없으면 건너뛴다** — 못 고치는 것을 고친 척하지 않는다
    if (!holds(key, next) || next === r.first_sentence) { stat.unfixable += 1; continue }
    updates.push({ row: r, next })
  }
  stat.fixed += updates.length
  if (!COMMIT || !updates.length) return
  // PostgREST 는 행마다 값이 다른 일괄 UPDATE 를 못 한다(upsert 로 흉내 내면 안 넘긴 컬럼이
  // 기본값으로 덮여 다른 자산이 날아간다). 그래서 행 단위로 보내되 **동시성으로만** 줄인다.
  const CONC = 12
  for (let i = 0; i < updates.length; i += CONC) {
    await Promise.all(updates.slice(i, i + CONC).map(async (u) => {
      const q = db.from(table).update({ first_sentence: u.next })
      const { error } = await retry(() =>
        table === 'library_book_vocabularies'
          ? q.eq('id', u.row.id!)
          : q.eq('library_article_id', u.row.library_article_id!).eq('word', u.row.word),
      )
      if (error) throw new Error(String((error as { message?: string }).message ?? error))
    }))
  }
}

async function books() {
  const { data: bs, error } = await retry(() => db.from('library_books').select('id, title').order('id'))
  if (error) throw new Error(String((error as { message?: string }).message))
  const list = LIMIT ? (bs ?? []).slice(0, LIMIT) : (bs ?? [])
  for (const b of list as Array<{ id: string; title: string }>) {
    const { data: chs } = await retry(() => db.from('library_chapters_master')
      .select('chapter_idx, content_hash, word_count').eq('library_book_id', b.id).order('chapter_idx'))
    const hashes = [...new Set((chs ?? []).map((c: never) => (c as { content_hash: string }).content_hash))]
    if (!hashes.length) continue
    const text = new Map<string, string>()
    for (let i = 0; i < hashes.length; i += 50) {
      const { data } = await retry(() => db.from('content_chunks').select('hash, content').in('hash', hashes.slice(i, i + 50)))
      for (const r of (data ?? []) as Array<{ hash: string; content: string }>) text.set(r.hash, r.content ?? '')
    }
    const chapters = (chs ?? []).map((c: never) => {
      const cc = c as { chapter_idx: number; content_hash: string; word_count: number }
      return { chapter_idx: cc.chapter_idx, content: text.get(cc.content_hash) ?? '', word_count: cc.word_count ?? 0, paragraph_offsets: [0], sentence_offsets: [0] }
    })
    const rows: Array<{ id: string; word: string; lemma: string | null; chapter_idx: number; first_sentence: string | null }> = []
    for (let from = 0; ; from += 1000) {
      const { data } = await retry(() => db.from('library_book_vocabularies')
        .select('id, word, lemma, chapter_idx, first_sentence').eq('library_book_id', b.id).order('id').range(from, from + 999))
      rows.push(...((data ?? []) as never))
      if ((data ?? []).length < 1000) break
    }
    await repairUnit(chapters, rows, 'library_book_vocabularies')
    stat.units += 1
    process.stdout.write(`\r  책 ${stat.units}/${list.length} · 행 ${stat.rows} · 불량 ${stat.bad} · 고침 ${stat.fixed}   `)
  }
}

async function articles() {
  const { data: as_, error } = await retry(() => db.from('library_articles').select('id').order('id'))
  if (error) throw new Error(String((error as { message?: string }).message))
  const list = LIMIT ? (as_ ?? []).slice(0, LIMIT) : (as_ ?? [])
  for (const a of list as Array<{ id: string }>) {
    const { data: art } = await retry(() => db.from('library_articles').select('content').eq('id', a.id).limit(1))
    const raw = (art ?? [])[0]?.content as string | undefined
    if (!raw) continue
    // analyze-article 과 같은 전처리 — 다르면 문장 경계가 어긋나 재계산이 무의미해진다
    const body = reflowSoftHyphens(normalizePunctuation(raw))
    const chapters = [{ chapter_idx: 1, content: body, word_count: body.split(/\s+/).length, paragraph_offsets: [0], sentence_offsets: [0] }]
    const rows: Array<{ library_article_id: string; word: string; first_sentence: string | null }> = []
    for (let from = 0; ; from += 1000) {
      const { data } = await retry(() => db.from('library_article_vocabularies')
        .select('library_article_id, word, first_sentence').eq('library_article_id', a.id).order('word').range(from, from + 999))
      rows.push(...((data ?? []) as never))
      if ((data ?? []).length < 1000) break
    }
    await repairUnit(chapters, rows.map((r) => ({ ...r, chapter_idx: 1 })), 'library_article_vocabularies')
    stat.units += 1
    if (stat.units % 25 === 0) process.stdout.write(`\r  글 ${stat.units}/${list.length} · 행 ${stat.rows} · 불량 ${stat.bad} · 고침 ${stat.fixed}   `)
  }
}

async function main() {
  if (MODE === 'books') await books()
  else await articles()
  console.log(`\n\n  ${MODE} ${stat.units}건 · 행 ${stat.rows}`)
  console.log(`  낱말 없는 예문 ${stat.bad}`)
  console.log(`    고칠 수 있음   ${stat.fixed}`)
  console.log(`    재추출에 없음  ${stat.noLemma}   (표제어가 지금 추출에서 안 나온다 — 별건)`)
  console.log(`    새 값도 미포함 ${stat.unfixable}  (불규칙형 등 — 건드리지 않았다)`)
  console.log(COMMIT ? '\n→ 반영 완료' : '\n  미리보기다 — 아무것도 쓰지 않았다. 반영하려면 --commit')
}
main()
