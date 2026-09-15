// scripts/audit/reader-pp-probe.mts — READ ONLY. offsets/본문 어긋난 도서 정밀 확인.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

function loadEnv(): { url: string; key: string } {
  const raw = readFileSync('apps/web/.env.local', 'utf8')
  const pick = (n: string): string => {
    const m = raw.match(new RegExp('^' + n + '\\s*=\\s*"?([^"\\r\\n]+)"?\\s*$', 'm'))
    if (!m) throw new Error('missing ' + n)
    return m[1]!.trim()
  }
  return { url: pick('NEXT_PUBLIC_SUPABASE_URL'), key: pick('SUPABASE_SERVICE_ROLE_KEY') }
}

function computeParagraphOffsets(content: string): number[] {
  const offsets = [0]
  const re = /\n\s*\n+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) offsets.push(m.index + m[0].length)
  return offsets
}
function countWords(c: string): number {
  return (c.match(/\b[a-zA-Z][a-zA-Z'-]*\b/g) ?? []).length
}
function splitByOffsets(content: string, offsets: number[]): string[] {
  if (offsets.length === 0) return [content]
  const r: string[] = []
  for (let i = 0; i < offsets.length; i++) {
    const s = offsets[i]!
    const e = i + 1 < offsets.length ? offsets[i + 1]! : content.length
    r.push(content.slice(s, e).trim())
  }
  return r
}

async function retry<T>(fn: () => PromiseLike<T>, label: string, tries = 6): Promise<T> {
  let last: unknown
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fn()
      const err = (r as { error?: { message?: string } | null })?.error
      if (err && /fetch failed|network|ETIMEDOUT|ECONNRESET|socket/i.test(err.message ?? '')) throw new Error(err.message)
      return r
    } catch (e) {
      last = e
      await new Promise((r) => setTimeout(r, 700 * (i + 1)))
    }
  }
  throw new Error(label + ': ' + String(last))
}

async function main(): Promise<void> {
  const { url, key } = loadEnv()
  const db = createClient(url, key, { auth: { persistSession: false } })

  const { data: bks } = await retry(
    () => db.from('library_books').select('id, title, author, status, source, chapter_count, word_count').ilike('title', '%Pride and Prejudice%'),
    'books',
  )
  console.log('=== 후보 도서 ===')
  for (const b of bks as Array<Record<string, unknown>>) console.log(JSON.stringify(b))

  for (const b of bks as Array<{ id: string; title: string; status: string }>) {
    console.log(`\n=== ${b.title} (${b.status}) ${b.id} ===`)
    const { data: chs } = await retry(
      () =>
        db
          .from('library_chapters_master')
          .select('chapter_idx, chapter_title, word_count, content_hash, paragraph_offsets, sentence_offsets')
          .eq('library_book_id', b.id)
          .order('chapter_idx')
          .range(0, 999),
      'chapters',
    )
    const rows = chs as Array<{
      chapter_idx: number
      chapter_title: string | null
      word_count: number
      content_hash: string
      paragraph_offsets: number[]
      sentence_offsets: number[]
    }>
    let bad = 0
    const details: string[] = []
    for (let i = 0; i < rows.length; i += 10) {
      const slice = rows.slice(i, i + 10)
      const { data: cc } = await retry(
        () => db.from('content_chunks').select('hash, content').in('hash', slice.map((r) => r.content_hash)),
        'chunks',
      )
      const map = new Map((cc as Array<{ hash: string; content: string }>).map((r) => [r.hash, r.content]))
      for (const r of slice) {
        const content = map.get(r.content_hash) ?? ''
        const actual = countWords(content)
        const maxPo = r.paragraph_offsets[r.paragraph_offsets.length - 1] ?? 0
        const rpo = computeParagraphOffsets(content)
        const ok = maxPo < content.length && r.word_count === actual && rpo.length === r.paragraph_offsets.length
        if (!ok) {
          bad++
          const paras = splitByOffsets(content, r.paragraph_offsets)
          const empties = paras.filter((p) => p.length === 0).length
          details.push(
            `ch=${r.chapter_idx} "${(r.chapter_title ?? '').slice(0, 30)}" len=${content.length} maxPO=${maxPo} PO저장=${r.paragraph_offsets.length} PO실제=${rpo.length} WC저장=${r.word_count} WC실제=${actual} 렌더빈문단=${empties}/${paras.length}`,
          )
        }
      }
    }
    console.log(`챕터 ${rows.length} 중 어긋남 ${bad}`)
    details.slice(0, 40).forEach((d) => console.log('  ' + d))

    // 첫 어긋난 챕터의 실제 렌더 결과 앞부분
    if (bad > 0) {
      const first = rows.find((r) => details.some((d) => d.startsWith(`ch=${r.chapter_idx} `)))
      if (first) {
        const { data: cc } = await retry(
          () => db.from('content_chunks').select('content').eq('hash', first.content_hash).maybeSingle(),
          'chunk1',
        )
        const content = (cc as { content: string }).content
        const paras = splitByOffsets(content, first.paragraph_offsets)
        console.log(`\n  --- ch=${first.chapter_idx} 학습자가 실제로 보는 문단 (앞 6개 / 총 ${paras.length}) ---`)
        paras.slice(0, 6).forEach((p, i) => console.log(`  [${i + 1}] ${JSON.stringify(p.slice(0, 110))}`))
        console.log(`  --- 원문 앞 300자 ---\n  ${JSON.stringify(content.slice(0, 300))}`)
        console.log(`  --- 원문 끝 200자 ---\n  ${JSON.stringify(content.slice(-200))}`)
      }
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
