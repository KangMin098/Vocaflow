// scripts/csat/retire-source-snapshot.mjs
//
// **원천을 퇴출하기 전에 되돌릴 근거를 남긴다.** 읽기 전용.
//
// ── 왜 본문을 안 담나 ────────────────────────────────────────────────
// 지우려는 것이 본문이다. 본문을 통째로 복사해 두면 「지웠다」가 거짓말이 되고
// 파일만 12MB 커진다. 그리고 gutenberg·Standard Ebooks 는 **PD 라 언제든 다시 받을 수
// 있다** — `source_id` 에 책 번호가 박혀 있다(`pg:<책번호>:<본문해시>`).
//
// 되돌릴 수 없는 것은 **판정**이다. LLM 이 40,518건을 읽고 use/narrative/reject 를
// 매겼고, 그건 다시 만들려면 같은 비용이 또 든다. 그래서 판정과 좌표만 담는다.
//
// 사용:
//   node --tls-max-v1.2 scripts/csat/retire-source-snapshot.mjs --source gutenberg
//   node --tls-max-v1.2 scripts/csat/retire-source-snapshot.mjs --source gutenberg --out <경로>

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: 'apps/web/.env.local', quiet: true })

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d
}
const SOURCE = arg('source', '')
if (!SOURCE) throw new Error('--source 가 필요하다')
const STAMP = new Date().toISOString().slice(0, 10).replace(/-/g, '')
const OUT = arg('out', `.agent-logs/retire-${SOURCE}-${STAMP}.json`)

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const rows = []
const PAGE = 1000
for (let from = 0; ; from += PAGE) {
  const { data, error } = await db
    .from('library_articles')
    .select('id, source_id, source_url, title, author, word_count, cefr_level, article_v_level, register, status, feed_id, csat_fit, created_at')
    .eq('source', SOURCE)
    .order('source_id')
    .range(from, from + PAGE - 1)
  if (error) throw error
  if (!data.length) break
  for (const r of data) {
    const g = r.csat_fit?.gate ?? {}
    rows.push({
      id: r.id,
      source_id: r.source_id,
      source_url: r.source_url,
      title: r.title,
      author: r.author,
      words: r.word_count,
      cefr: r.cefr_level,
      v: r.article_v_level,
      register: r.register,
      status: r.status,
      feed: r.feed_id,
      // 되돌릴 수 없는 것 — LLM 판정
      verdict: g.verdict ?? null,
      genre: g.genre ?? null,
      blockedBy: g.blockedBy ?? null,
      judgedBy: g.by ?? null,
      topic: r.csat_fit?.topic ?? null,
      createdAt: r.created_at,
    })
  }
  process.stdout.write(`\r  받는 중 ${rows.length.toLocaleString()}행`)
  if (data.length < PAGE) break
}
process.stdout.write('\n')

const tally = (f) => {
  const m = new Map()
  for (const r of rows) m.set(f(r) ?? '(없음)', (m.get(f(r) ?? '(없음)') ?? 0) + 1)
  return Object.fromEntries([...m].sort((a, b) => b[1] - a[1]))
}

const books = new Set(rows.map((r) => String(r.source_id).split(':')[1]).filter(Boolean))
const snapshot = {
  contract: 'retire-source-snapshot/v1',
  source: SOURCE,
  takenAt: new Date().toISOString(),
  rows: rows.length,
  books: books.size,
  note:
    '본문은 담지 않는다 — PD 라 source_url 과 source_id 의 책 번호로 다시 받을 수 있다. ' +
    '되돌릴 수 없는 것은 LLM 판정이고 그것만 담았다.',
  byVerdict: tally((r) => r.verdict),
  byGenre: tally((r) => r.genre),
  byStatus: tally((r) => r.status),
  byFeed: tally((r) => r.feed),
  items: rows,
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(snapshot, null, 1))
console.log(`\n${SOURCE} — ${rows.length.toLocaleString()}행 · 책 ${books.size.toLocaleString()}권`)
console.log('판정:', JSON.stringify(snapshot.byVerdict))
console.log('상태:', JSON.stringify(snapshot.byStatus))
console.log(`→ ${OUT}`)
