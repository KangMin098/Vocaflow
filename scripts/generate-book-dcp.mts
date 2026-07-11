// scripts/generate-book-dcp.mts
//
// CTP DCP S4 드레인 — 발행 도서(v≥7·killer band) 챕터 본문 → 결정론 order/insert 문항 생성·upsert.
// 배경: dev-generate-items 는 article(S1~S3)만 처리 → S4(도서)는 practice 문항 공백이었다.
//   본 스크립트가 S4 를 채워 hub 처방 ④ 연습이 S4 학습자에게도 활성화되게 한다.
// 관행: Claude Code 수동 콘텐츠 드레인(content_chunks → INSERT). 런타임 LLM 0(generateDcpItems 결정론·멱등).
//
// 실행:  node_modules/.bin/tsx scripts/generate-book-dcp.mts
//   (idempotent — onConflict(kind,ref_id,type,paragraph_idx) upsert 로 재실행 안전)

import { readFileSync } from 'node:fs'

import { createClient } from '@supabase/supabase-js'
import { generateDcpItems, type DcpItem } from '@vocaflow/library-pipeline'

// ── env (.env.local 파싱 — dotenv 의존 없이) ──
function loadEnv(path: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/)
    if (m) out[m[1]!] = m[2]!.trim().replace(/^["']|["']$/g, '')
  }
  return out
}

const env = loadEnv('apps/web/.env.local')
const url = env['NEXT_PUBLIC_SUPABASE_URL']
const key = env['SUPABASE_SERVICE_ROLE_KEY']
if (!url || !key) {
  console.error('apps/web/.env.local 에 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요')
  process.exit(1)
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

// ── 대상 S4 도서 (register 다양성: 설명문 + 서사) ──
const BOOK_IDS = [
  '236e78ab-cb2c-477b-9efd-3b81faced48e', // The Decline and Fall of the Roman Empire (expository, v9)
  'ac506006-6147-4d23-8dba-72698eb7e9ae', // Pride and Prejudice (narrative, v8)
]
const MAX_PARAGRAPHS_PER_BOOK = 24 // 적격 문단 상한(문항 = ×2 = order+insert)

interface DcpRow {
  kind: 'book'
  ref_id: string
  type: string
  item_role: 'practice'
  payload: Record<string, unknown>
  answer_key: Record<string, unknown>
  paragraph_idx: number
  v_level: number | null
}

async function processBook(bookId: string): Promise<void> {
  const { data: book } = await db
    .from('library_books')
    .select('title, book_v_level')
    .eq('id', bookId)
    .single()
  const bookVLevel = (book as { book_v_level: number | null } | null)?.book_v_level ?? null
  const title = (book as { title: string } | null)?.title ?? bookId

  const { data: chapters } = await db
    .from('library_chapters_master')
    .select('chapter_idx, content_hash, chapter_v_level')
    .eq('library_book_id', bookId)
    .order('chapter_idx', { ascending: true })

  const rows: DcpRow[] = []
  let eligible = 0

  for (const ch of (chapters ?? []) as Array<{
    chapter_idx: number
    content_hash: string
    chapter_v_level: number | null
  }>) {
    if (eligible >= MAX_PARAGRAPHS_PER_BOOK) break

    const { data: chunk } = await db
      .from('content_chunks')
      .select('content')
      .eq('hash', ch.content_hash)
      .single()
    const content = (chunk as { content: string } | null)?.content
    if (!content) continue

    const items = generateDcpItems(content, `${bookId}:${ch.chapter_idx}`)

    // 문단(paragraph_idx) 단위로 order+insert 쌍 그룹핑 → 문단 상한 적용
    const byPara = new Map<number, DcpItem[]>()
    for (const it of items) {
      const g = byPara.get(it.paragraph_idx) ?? []
      g.push(it)
      byPara.set(it.paragraph_idx, g)
    }

    for (const [localIdx, pair] of [...byPara.entries()].sort((a, b) => a[0] - b[0])) {
      if (eligible >= MAX_PARAGRAPHS_PER_BOOK) break
      // ref_id=bookId 이므로 paragraph_idx 는 도서 전역 유일해야 함(챕터 오프셋).
      const globalIdx = ch.chapter_idx * 1000 + localIdx
      for (const it of pair) {
        rows.push({
          kind: 'book',
          ref_id: bookId,
          type: it.type,
          item_role: 'practice',
          payload: it.payload,
          answer_key: it.answer_key,
          paragraph_idx: globalIdx,
          v_level: ch.chapter_v_level ?? bookVLevel,
        })
      }
      eligible++
    }
  }

  if (rows.length === 0) {
    console.log(`  ${title}: 적격 문단 없음 (0 items)`)
    return
  }
  const { error } = await db
    .from('csat_dcp_items')
    .upsert(rows, { onConflict: 'kind,ref_id,type,paragraph_idx' })
  console.log(`  ${title}: ${rows.length} items (${eligible} paragraphs) — ${error ? `ERROR ${error.message}` : 'ok'}`)
}

console.log('CTP DCP S4 드레인 시작…')
for (const id of BOOK_IDS) {
  await processBook(id)
}
console.log('완료.')
