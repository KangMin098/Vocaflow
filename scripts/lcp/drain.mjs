// scripts/lcp/drain.mjs
//
// 큐레이션 드레인 오케스트레이터 — 단일 진입점 (book_curation_jobs 통합 큐).
//   4 task(voice_map/quiz_gen/level_verify/vocab_audit)는 모두 Claude Code(=LLM) 판단이
//   필요해 완전 자동 실행은 불가. 대신 "무엇을·어떻게 드레인하나"를 한 곳에서:
//
//     node scripts/lcp/drain.mjs list          # 미완 드레인 잡 전체를 책별로 (대시보드)
//     node scripts/lcp/drain.mjs next [book_id] # 다음(또는 지정) 책의 pending task 별 실행 런북
//
//   런북 = task 마다 실제 실행할 helper 커맨드 순서. 그대로 돌려 plan → 작업 → apply.

import fs from 'node:fs'
import path from 'node:path'

const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const { createClient } = await import('@supabase/supabase-js')

const url = process.env['NEXT_PUBLIC_SUPABASE_URL']
const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const db = createClient(url, key, { auth: { persistSession: false } })

const ACTIVE = ['pending', 'running', 'awaiting_mapping', 'failed']
const TASK_LABEL = {
  voice_map: '🔊 LibriVox 매핑',
  quiz_gen: '📝 스크립트 퀴즈',
  level_verify: '🔬 레벨 검토',
  vocab_audit: '🔬 어휘 감사',
  comic_gen: '🎞 만화 생성',
}
// task_type → 실행 helper 커맨드 순서 (id 삽입)
const RUNBOOK = {
  voice_map: (id) => [
    `pnpm dlx tsx scripts/lcp/librivox-align.mjs ${id}            # dry-run(정합 확인)`,
    `pnpm dlx tsx scripts/lcp/librivox-align.mjs ${id} --commit   # 문제 없으면 커밋`,
  ],
  quiz_gen: (id) => [
    `node scripts/lcp/generate-chapter-quiz.mjs plan ${id}`,
    `node scripts/lcp/generate-chapter-quiz.mjs content ${id} <ch>   # 챕터 본문 → 문항 저술`,
    `node scripts/lcp/generate-chapter-quiz.mjs insert ${id} <ch> --file q.json`,
  ],
  level_verify: (id) => [
    `node scripts/lcp/review-book.mjs plan ${id}`,
    `node scripts/lcp/review-book.mjs apply ${id} --file verdict.json [--correct]`,
  ],
  vocab_audit: (id) => [
    `node scripts/lcp/audit-vocab.mjs plan ${id} [ch]`,
    `node scripts/lcp/audit-vocab.mjs apply ${id} --file audit.json`,
  ],
  comic_gen: (id) => [
    `node scripts/lcp/generate-comic.mjs plan ${id}`,
    `node scripts/lcp/generate-comic.mjs content ${id} <ch>   # 각색 스크립트 → 컷 조립(scripts/comic)`,
    `node scripts/lcp/generate-comic.mjs insert ${id} --file pages.json --commit`,
  ],
}

async function loadJobs() {
  const { data, error } = await db
    .from('book_curation_jobs')
    .select('book_id, task_type, status, chapters_done, chapters_total, questions_created, panels_done, panels_total, error, note, created_at')
    .in('status', ACTIVE)
    .order('created_at', { ascending: true })
  if (error) throw new Error(`jobs lookup failed: ${error.message}`)
  const jobs = data ?? []
  if (jobs.length === 0) return { byBook: new Map(), titles: new Map() }
  const ids = Array.from(new Set(jobs.map((j) => j.book_id)))
  const { data: books, error: bErr } = await db
    .from('library_books')
    .select('id, title, status')
    .in('id', ids)
  if (bErr) throw new Error(`books lookup failed: ${bErr.message}`)
  const titles = new Map((books ?? []).map((b) => [b.id, b]))
  const byBook = new Map()
  for (const j of jobs) {
    if (!byBook.has(j.book_id)) byBook.set(j.book_id, [])
    byBook.get(j.book_id).push(j)
  }
  return { byBook, titles }
}

function progressStr(j) {
  if (j.task_type === 'quiz_gen') return ` (${j.chapters_done}/${j.chapters_total}ch·${j.questions_created}문)`
  if (j.task_type === 'comic_gen') return ` (${j.panels_done ?? 0}/${j.panels_total ?? '?'}컷)`
  return ''
}

// ── list ──────────────────────────────────────────────────────
async function cmdList() {
  const { byBook, titles } = await loadJobs()
  if (byBook.size === 0) {
    console.log('✓ 미완 드레인 잡 없음 (모두 done).')
    return
  }
  const counts = {}
  console.log(`드레인 대기 — ${byBook.size}권\n`)
  for (const [bookId, jobs] of byBook) {
    const b = titles.get(bookId)
    console.log(`• ${b?.title ?? '(삭제됨)'}  [${bookId.slice(0, 8)}] ${b?.status ?? ''}`)
    for (const j of jobs) {
      const mark = j.status === 'failed' ? '✗' : j.status === 'running' ? '▶' : '·'
      console.log(`    ${mark} ${TASK_LABEL[j.task_type] ?? j.task_type} : ${j.status}${progressStr(j)}${j.error ? ` — ${j.error}` : ''}`)
      counts[j.task_type] = (counts[j.task_type] ?? 0) + 1
    }
  }
  console.log(
    `\n합계: ${Object.entries(counts).map(([k, v]) => `${TASK_LABEL[k] ?? k} ${v}`).join(' · ')}`,
  )
  console.log(`\n다음 작업 런북:  node scripts/lcp/drain.mjs next`)
}

// ── next ──────────────────────────────────────────────────────
async function cmdNext(bookIdArg) {
  const { byBook, titles } = await loadJobs()
  if (byBook.size === 0) {
    console.log('✓ 드레인할 잡 없음.')
    return
  }
  const bookId = bookIdArg ?? byBook.keys().next().value
  const jobs = byBook.get(bookId)
  if (!jobs) {
    console.log(`해당 책에 미완 드레인 잡 없음: ${bookId}`)
    return
  }
  const b = titles.get(bookId)
  console.log(`━━ 드레인 런북: ${b?.title ?? '(삭제됨)'}  [${bookId}] ━━\n`)
  let n = 0
  for (const j of jobs) {
    n += 1
    console.log(`${n}) ${TASK_LABEL[j.task_type] ?? j.task_type}  (현재: ${j.status}${progressStr(j)})`)
    const cmds = RUNBOOK[j.task_type]?.(bookId) ?? ['(helper 없음 — MCP 처리)']
    for (const c of cmds) console.log(`     $ ${c}`)
    console.log('')
  }
  console.log('※ 각 task: plan 으로 컨텍스트 확보 → LLM(Claude Code) 작업 → apply/commit.')
  console.log('   책을 한 번 읽고 위 task 들을 연속 처리하면 컨텍스트 재사용 (드레인 한번에).')
}

// ── main ──────────────────────────────────────────────────────
const [, , cmd, arg] = process.argv
try {
  if (cmd === 'list' || cmd == null) await cmdList()
  else if (cmd === 'next') await cmdNext(arg && !arg.startsWith('--') ? arg : null)
  else {
    console.error('commands: list | next [book_id]')
    process.exit(1)
  }
} catch (e) {
  console.error(`[error] ${e.message}`)
  process.exit(1)
}
