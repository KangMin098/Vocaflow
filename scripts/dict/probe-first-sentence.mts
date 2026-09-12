// scripts/dict/probe-first-sentence.mts
//
// **저장된 `first_sentence` 가 지금 코드로 다시 뽑아도 같은가.**
//
// 실측 2026-09-05: `library_book_vocabularies` 1,678,029행 중 **89,177행(5.31%)** 의
// `first_sentence` 가 그 낱말을 담고 있지 않다(글 쪽은 31,494행/1.73%). 이 값은
// 학습자 화면에 그대로 간다 — `chapter-words-queries` → `exampleSentence` → 플래시카드,
// 그리고 리더의 `ChapterContent` 가 직접 그린다. **낱말이 없는 예문**을 보여 주는 셈이다.
//
// 고칠 곳이 둘 중 어디인지부터 갈라야 한다:
//   · 지금 코드로 다시 뽑아도 같으면 → **추출기 버그** (코드를 고친다)
//   · 다시 뽑으면 옳으면       → **낡은 행** (다시 돌려 덮는다)
//
// 실행: npx tsx --tsconfig apps/web/tsconfig.json scripts/dict/probe-first-sentence.mts <book_id>
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { extractBookLemmas } from '../../packages/library-pipeline/src/analyze/extract-lemmas'

const BOOK = process.argv[2]
if (!BOOK) throw new Error('사용법: probe-first-sentence.mts <library_book_id>')

const t = fs.readFileSync('apps/web/.env.local', 'utf8')
const g = (k: string) => (t.match(new RegExp(`^${k}\\s*=\\s*(.+)$`, 'm')) ?? [])[1]?.trim().replace(/^["']|["']$/g, '')
const db = createClient(g('NEXT_PUBLIC_SUPABASE_URL')!, g('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()

async function main() {
  // 챕터 본문은 `library_chapters_master.content_hash` → `content_chunks.content` 로 나뉘어 있다
  const { data: chs, error: cErr } = await db
    .from('library_chapters_master')
    .select('chapter_idx, content_hash')
    .eq('library_book_id', BOOK)
    .order('chapter_idx')
  if (cErr) throw new Error(cErr.message)
  const hashes = [...new Set((chs ?? []).map((c: any) => c.content_hash))]
  const text = new Map<string, string>()
  for (let i = 0; i < hashes.length; i += 50) {
    const { data, error } = await db.from('content_chunks').select('hash, content').in('hash', hashes.slice(i, i + 50))
    if (error) throw new Error(error.message)
    for (const r of (data ?? []) as any[]) text.set(r.hash, r.content ?? '')
  }
  const chapters = (chs ?? []).map((c: any) => ({ chapter_idx: c.chapter_idx, content: text.get(c.content_hash) ?? '' }))
  console.log(`  챕터 ${chapters.length} · 총 ${chapters.reduce((s, c) => s + c.content.length, 0).toLocaleString()}자`)
  if (!chapters.length) return

  const idx = extractBookLemmas(chapters as any)

  // DB 행
  const rows: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from('library_book_vocabularies')
      .select('word, lemma, chapter_idx, first_sentence')
      .eq('library_book_id', BOOK).order('id').range(from, from + 999)
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }
  console.log(`  DB 행 ${rows.length}`)

  let same = 0, diff = 0, missing = 0
  let dbBad = 0, freshBad = 0, fixed = 0, broke = 0
  const samples: string[] = []
  for (const r of rows) {
    const key = String(r.lemma ?? r.word).toLowerCase()
    const occ = (idx.occurrences?.get?.(key) ?? []) as any[]
    const hit = occ.find((o) => o.chapter_idx === r.chapter_idx)
    if (!hit) { missing += 1; continue }
    const fresh = String(hit.first_sentence_in_chapter ?? '')
    const stem = key.slice(0, Math.max(3, key.length - 3))
    const dbHas = norm(String(r.first_sentence ?? '')).includes(stem)
    const frHas = norm(fresh).includes(stem)
    if (!dbHas) dbBad += 1
    if (!frHas) freshBad += 1
    if (!dbHas && frHas) { fixed += 1; if (samples.length < 8) samples.push(`  ${key}\n    DB : ${String(r.first_sentence).slice(0, 84)}\n    지금: ${fresh.slice(0, 84)}`) }
    if (dbHas && !frHas) broke += 1
    if (norm(fresh) === norm(String(r.first_sentence ?? ''))) same += 1
    else diff += 1
  }
  console.log(`\n  대조 가능 ${same + diff} (재추출에 없는 낱말 ${missing})`)
  console.log(`  같음 ${same} · 다름 ${diff}`)
  console.log(`\n  낱말 없는 예문 — DB ${dbBad} · 지금 코드 ${freshBad}`)
  console.log(`  재추출로 고쳐짐 ${fixed} · 재추출이 망가뜨림 ${broke}`)
  if (samples.length) { console.log('\n  ── 고쳐진 표본 ──'); for (const s of samples) console.log(s) }

  // ── 어긋난 사례를 끝까지 따라간다 ──────────────────────────────────
  // 기록된 문장과, 그 챕터에서 **실제로 그 낱말이 처음 나오는 문장**을 나란히 놓으면
  // 인덱스가 몇 칸 밀렸는지(또는 아예 다른 기준계인지)가 드러난다.
  const { processText } = await import('../../packages/wlp/src/processor')
  let traced = 0
  for (const r of rows) {
    if (traced >= 6) break
    const key = String(r.lemma ?? r.word).toLowerCase()
    const occ = (idx.occurrences?.get?.(key) ?? []) as any[]
    const hit = occ.find((o) => o.chapter_idx === r.chapter_idx)
    if (!hit) continue
    const fresh = String(hit.first_sentence_in_chapter ?? '')
    const stem = key.slice(0, Math.max(3, key.length - 3))
    if (norm(fresh).includes(stem)) continue
    const ch = chapters.find((c) => c.chapter_idx === r.chapter_idx)
    if (!ch) continue
    const p = processText(ch.content)
    const realIdx = p.sentences.findIndex((s) => norm(s.text).includes(stem))
    const recIdx = p.sentences.findIndex((s) => norm(s.text) === norm(fresh))
    traced += 1
    console.log(`\n  [${key}] 챕터 ${r.chapter_idx} · 문장 ${p.sentences.length}개`)
    console.log(`    기록된 문장의 위치  ${recIdx}`)
    console.log(`    실제 첫 등장 위치   ${realIdx}${realIdx >= 0 ? ` : ${norm(p.sentences[realIdx]!.text).slice(0, 80)}` : ' (챕터 어디에도 없음)'}`)
  }
}
main()
