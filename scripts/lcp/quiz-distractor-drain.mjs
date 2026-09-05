// scripts/lcp/quiz-distractor-drain.mjs
//
// **ScriptQuiz 오답을 정답만큼 구체적으로 다시 쓴다.**
//
// ── 왜 ────────────────────────────────────────────────────────────────
// 실측 2026-09-05: 「가장 긴 선지를 누른다」 전략의 정답률이 **95.1%(2,288/2,406)**.
// 우연이면 25% 다. 정답 평균 89.8자 vs 오답 35.8자(2.5배). 챕터 342개 중 246개(71.9%)는
// 그 전략만으로 전문항 정답이고, 문항 10개 이상인 57권이 전부 50%를 넘었다.
// 화면은 보기를 섞지 않지만(`ScriptQuiz.tsx`) **섞어도 소용없다 — 단서가 자리가 아니라
// 길이**다. 지문을 한 줄도 안 읽고 95점이 나온다.
//
// 저장소 규약은 이미 이것을 정해 두고 있었다 — CONVENTIONS 「선택지를 만들면 길이 편향을
// 반드시 잰다」(문항 1.25배 / 배치 40%). `generate-chapter-quiz.mjs` 만 안 따랐다.
//
// ── 고치는 방향 ──────────────────────────────────────────────────────
// **정답을 줄이지 않는다.** 정답을 뭉개면 답이 흐려진다. 오답을 정답만큼 구체적으로 쓰되
// 내용이 틀리게 만든다. 그래서 이 드레인은 `options` 중 **오답만** 바꾸고 정답 문장과
// `correct_index` 는 건드리지 않는다.
//
// ── 3단 ──────────────────────────────────────────────────────────────
//   export           도서별로 편향 문항을 뽑는다 → chunk-NN.json
//   Claude Code      오답 3개를 다시 써 chunk-NN.out.json
//   import --commit  게이트 통과분만 적재 (우회 플래그 없음)
//
// export 는 **이미 고쳐진 문항을 건너뛴다** — 몇 번을 돌려도 결과가 같다.
// import 는 정답이 최장이면 **그 문항을 넣지 않는다** — 안 고쳐진 것을 고쳤다고 세면
// 다음 export 가 「완료」로 보고 구멍이 영영 남는다. 건너뛴 수를 반드시 출력한다.
//
// 실행:
//   node scripts/lcp/quiz-distractor-drain.mjs export [--dir D] [--size 40]
//   node scripts/lcp/quiz-distractor-drain.mjs import [--dir D] [--commit]
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const CMD = process.argv[2]
const arg = (k, d) => {
  const i = process.argv.indexOf(k)
  return i > 0 ? process.argv[i + 1] : d
}
const DIR = arg('--dir', 'scripts/lcp/quiz-distractor')
const SIZE = parseInt(arg('--size', '40'), 10)
const COMMIT = process.argv.includes('--commit')

const t = fs.readFileSync('apps/web/.env.local', 'utf8')
const g = (k) => (t.match(new RegExp(`^${k}\\s*=\\s*(.+)$`, 'm')) ?? [])[1]?.trim().replace(/^["']|["']$/g, '')
const db = createClient(g('NEXT_PUBLIC_SUPABASE_URL'), g('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })

async function retry(fn, tries = 8) {
  let last
  for (let i = 0; i < tries; i += 1) {
    try { const r = await fn(); if (!r.error) return r; last = r } catch (e) { last = { error: e } }
    await new Promise((r) => setTimeout(r, Math.min(20000, 800 * 2 ** i)))
  }
  return last
}

const len = (o) => String(o?.text ?? '').trim().length

/** 이 문항이 길이로 풀리는가 — 정답이 최장이거나 오답 평균의 1.25배를 넘는다 */
function isBiased(q) {
  const opts = q.options ?? []
  if (q.type === 'truefalse' || opts.length < 3) return false
  const lens = opts.map(len)
  const c = lens[q.correct_index] ?? 0
  const others = lens.filter((_, i) => i !== q.correct_index)
  const avg = others.reduce((s, x) => s + x, 0) / Math.max(1, others.length)
  return c === Math.max(...lens) || (avg > 0 && c > avg * 1.25)
}

async function allRows() {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await retry(() => db
      .from('library_chapter_quiz')
      .select('id, library_book_id, chapter_idx, type, question, question_ko, options, correct_index, source_snippet')
      .order('id').range(from, from + 999))
    if (error) throw new Error(String(error.message ?? error))
    rows.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }
  return rows
}

async function doExport() {
  const rows = await allRows()
  const targets = rows.filter(isBiased)
  const { data: books } = await retry(() => db.from('library_books').select('id, title').order('id'))
  const title = new Map((books ?? []).map((b) => [b.id, b.title]))
  // 도서·챕터를 섞지 않고 붙여 둔다 — 한 청크 안이 같은 맥락이어야 오답을 제대로 쓴다
  targets.sort((a, b) => String(a.library_book_id).localeCompare(String(b.library_book_id)) || a.chapter_idx - b.chapter_idx)
  fs.mkdirSync(DIR, { recursive: true })
  for (const f of fs.readdirSync(DIR)) if (/^chunk-\d+\.json$/.test(f)) fs.unlinkSync(path.join(DIR, f))
  let n = 0
  for (let i = 0; i < targets.length; i += SIZE) {
    const items = targets.slice(i, i + SIZE).map((q) => ({
      id: q.id,
      book: title.get(q.library_book_id) ?? '?',
      chapter: q.chapter_idx,
      question: q.question,
      question_ko: q.question_ko,
      source_snippet: q.source_snippet,
      correct_index: q.correct_index,
      options: q.options,
      correct_len: len(q.options[q.correct_index]),
      distractor_lens: q.options.map(len).filter((_, k) => k !== q.correct_index),
    }))
    fs.writeFileSync(path.join(DIR, `chunk-${String(n).padStart(2, '0')}.json`), JSON.stringify(items, null, 1))
    n += 1
  }
  console.log(`  전체 ${rows.length} · 길이로 풀리는 문항 ${targets.length} · 청크 ${n} → ${DIR}/chunk-NN.json`)
  console.log(`  (정답이 최장인 비율 ${((rows.filter((q) => q.type !== 'truefalse' && (q.options ?? []).length >= 3 && len(q.options[q.correct_index]) === Math.max(...q.options.map(len))).length / rows.filter((q) => q.type !== 'truefalse' && (q.options ?? []).length >= 3).length) * 100).toFixed(1)}%)`)
}

async function doImport() {
  const files = fs.readdirSync(DIR).filter((f) => /^chunk-\d+\.out\.json$/.test(f)).sort()
  if (!files.length) { console.log('  채워진 청크가 없다.'); return }
  const rows = await allRows()
  const byId = new Map(rows.map((r) => [r.id, r]))
  let ok = 0, badShape = 0, stillBiased = 0, missing = 0, touchedAnswer = 0
  const updates = []
  for (const f of files) {
    let arr
    try { arr = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) } catch { console.log(`  ✗ ${f}: JSON 파손`); continue }
    for (const it of arr ?? []) {
      const src = byId.get(it.id)
      if (!src) { missing += 1; continue }
      const opts = it.options
      if (!Array.isArray(opts) || opts.length !== src.options.length || opts.some((o) => typeof o?.text !== 'string' || !o.text.trim())) { badShape += 1; continue }
      // **정답 문장은 건드리지 않는다** — 정답을 줄여 편향을 맞추는 것을 막는다
      if (String(opts[src.correct_index]?.text ?? '').trim() !== String(src.options[src.correct_index]?.text ?? '').trim()) { touchedAnswer += 1; continue }
      const cand = { ...src, options: opts }
      if (isBiased(cand)) { stillBiased += 1; continue }
      updates.push({ id: it.id, options: opts })
      ok += 1
    }
  }
  console.log(`  파일 ${files.length} · 적재 가능 ${ok}`)
  console.log(`  건너뜀 — 모양 불량 ${badShape} · 여전히 길이로 풀림 ${stillBiased} · 정답을 고침 ${touchedAnswer} · 원본 없음 ${missing}`)
  if (!COMMIT) { console.log('\n  미리보기다 — 아무것도 쓰지 않았다. 반영하려면 --commit'); return }
  let done = 0
  for (let i = 0; i < updates.length; i += 4) {
    await Promise.all(updates.slice(i, i + 4).map(async (u) => {
      const { error } = await retry(() => db.from('library_chapter_quiz').update({ options: u.options }).eq('id', u.id))
      if (error) throw new Error(String(error.message ?? error))
      done += 1
    }))
    process.stdout.write(`\r  반영 ${done}/${updates.length}`)
  }
  console.log('\n→ 반영 완료')
}

if (CMD === 'export') await doExport()
else if (CMD === 'import') await doImport()
else console.error('usage: node scripts/lcp/quiz-distractor-drain.mjs export|import [--dir D] [--size N] [--commit]')
