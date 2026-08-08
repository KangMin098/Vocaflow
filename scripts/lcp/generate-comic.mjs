// scripts/lcp/generate-comic.mjs
//
// CCP 드레인 helper — comic_gen task (book→comic). plan/content/insert 3동사.
//   자기발전 폐루프(scripts/comic gen-verified)의 산출물(컷 이미지 URL + 대사)을
//   comic_pages 로 적재하고, comic_books 헤더의 QC 게이트/판정을 고정하며,
//   book_curation_jobs(comic_gen) 진행을 write-back 한다.
//
//     node scripts/lcp/generate-comic.mjs plan   <book_id>
//     node scripts/lcp/generate-comic.mjs content <book_id> <chapter_idx>
//     node scripts/lcp/generate-comic.mjs insert <book_id> --file pages.json [--commit]
//
//   pages.json 형식:
//     { "style":"gonick", "backend":"gpt-image-2",
//       "qc": { "panels_pass": true, "verbatim_mismatch": [], "rule_violations": [] },
//       "pages": [ { "chapter_idx":1, "page_order":1, "image_url":"https://…",
//                    "stave_label":"Stave I", "book_v_level":7,
//                    "bubbles":[{ "speaker":"Scrooge","text":"Bah! Humbug!","kind":"shout",
//                                 "pos":"tc","verbatim":true }],
//                    "target_vocab":["humbug"] } ] }
//   실제 아트 생성 = scripts/comic (gen-gptimage.mjs GONICK). insert 는 생성물 등록 단계.

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
if (!url || !key) { console.error('Missing SUPABASE env'); process.exit(1) }
const db = createClient(url, key, { auth: { persistSession: false } })

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? null : process.argv[i + 1] }
const has = (n) => process.argv.includes(`--${n}`)

// ── plan ────────────────────────────────────────────────────────
async function plan(bookId) {
  const { data: book } = await db.from('library_books')
    .select('id, title, author, status, book_v_level, chapter_count').eq('id', bookId).maybeSingle()
  if (!book) { console.error('book not found'); process.exit(1) }
  const { data: pages } = await db.from('comic_pages')
    .select('chapter_idx, page_order').eq('library_book_id', bookId)
  const { data: header } = await db.from('comic_books')
    .select('status, panels_total, panels_pass').eq('library_book_id', bookId).maybeSingle()
  const byCh = {}
  for (const p of pages ?? []) byCh[p.chapter_idx] = (byCh[p.chapter_idx] ?? 0) + 1
  console.log(JSON.stringify({
    book: { id: book.id, title: book.title, author: book.author, status: book.status, v_level: book.book_v_level, chapters: book.chapter_count },
    header: header ?? { status: 'none' },
    existing_pages: byCh,
    total_pages: (pages ?? []).length,
    guidance: '각색 스크립트(scripts/comic/examples/*.adapted.json) 기준 컷 생성 → pages.json 조립 → insert',
  }, null, 2))
}

// ── content ─────────────────────────────────────────────────────
async function content(bookId, ch) {
  const { data: master } = await db.from('library_chapters_master')
    .select('chapter_title, content_hash').eq('library_book_id', bookId).eq('chapter_idx', +ch).maybeSingle()
  if (!master) { console.error('chapter master not found'); process.exit(1) }
  let body = ''
  if (master.content_hash) {
    const { data: chunk } = await db.from('content_chunks').select('content').eq('hash', master.content_hash).maybeSingle()
    body = chunk?.content ?? ''
  }
  console.log(`# ${master.chapter_title ?? `Chapter ${ch}`}\n\n${body}`)
}

// ── validate ────────────────────────────────────────────────────
const KIND = new Set(['caption', 'speech', 'shout'])
const POS = new Set(['tl', 'tr', 'bl', 'br', 'tc', 'bc'])
function validate(doc) {
  const errs = []
  if (!Array.isArray(doc.pages) || doc.pages.length === 0) errs.push('pages 비어 있음')
  const seen = new Set()
  for (const [i, p] of (doc.pages ?? []).entries()) {
    const tag = `page[${i}]`
    if (p.chapter_idx == null || p.page_order == null) errs.push(`${tag}: chapter_idx/page_order 필수`)
    if (!p.image_url || !/^https?:\/\//.test(p.image_url)) errs.push(`${tag}: image_url 은 http(s) URL`)
    const nk = `${p.chapter_idx}/${p.page_order}`
    if (seen.has(nk)) errs.push(`${tag}: 중복 (chapter_idx,page_order)=${nk}`); seen.add(nk)
    for (const [j, b] of (p.bubbles ?? []).entries()) {
      if (!b.text) errs.push(`${tag}.bubble[${j}]: text 필수`)
      if (b.kind && !KIND.has(b.kind)) errs.push(`${tag}.bubble[${j}]: kind 불명(${b.kind})`)
      if (b.pos && !POS.has(b.pos)) errs.push(`${tag}.bubble[${j}]: pos 불명(${b.pos})`)
    }
    // target_vocab 은 verbatim=true 버블 텍스트 안에서만(원문 정합) — 경고
    const verbatimText = (p.bubbles ?? []).filter((b) => b.verbatim).map((b) => (b.text || '').toLowerCase()).join(' ')
    for (const w of p.target_vocab ?? []) {
      if (verbatimText && !verbatimText.includes(String(w).toLowerCase()))
        console.error(`  ⚠ ${tag}: target_vocab "${w}" 가 verbatim 버블에 없음(원문 괴리 가능)`)
    }
  }
  return errs
}

// ── insert ──────────────────────────────────────────────────────
async function insert(bookId, file, commit) {
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'))
  const errs = validate(doc)
  if (errs.length) { console.error('검증 실패:\n' + errs.map((e) => '  ✗ ' + e).join('\n')); process.exit(1) }
  const qc = doc.qc ?? {}
  const panelsPass = qc.panels_pass === true && (qc.verbatim_mismatch ?? []).length === 0
  const rows = doc.pages.map((p) => ({
    library_book_id: bookId, chapter_idx: p.chapter_idx, page_order: p.page_order,
    image_url: p.image_url, bubbles: p.bubbles ?? [], target_vocab: p.target_vocab ?? [],
    stave_label: p.stave_label ?? null, book_v_level: p.book_v_level ?? null,
  }))
  console.log(`검증 OK · ${rows.length}컷 · panels_pass=${panelsPass} · verbatim_mismatch=${(qc.verbatim_mismatch ?? []).length} · rule_violations=${(qc.rule_violations ?? []).length}`)
  if (!commit) { console.log('(dry-run) --commit 로 실제 적재'); return }

  // 멱등: 도서 전 컷 교체
  const { error: delErr } = await db.from('comic_pages').delete().eq('library_book_id', bookId)
  if (delErr) { console.error('delete 실패:', delErr.message); process.exit(1) }
  const { error: insErr } = await db.from('comic_pages').insert(rows)
  if (insErr) { console.error('insert 실패:', insErr.message); process.exit(1) }

  // 헤더 upsert(발행은 admin_set_comic_published 로 별도 — 여기선 draft + QC 판정만)
  const { error: cbErr } = await db.from('comic_books').upsert({
    library_book_id: bookId, style: doc.style ?? null, backend: doc.backend ?? null,
    book_v_level: rows[0]?.book_v_level ?? null, panels_total: rows.length,
    panels_pass: panelsPass, qc_verdict: qc,
  }, { onConflict: 'library_book_id' })
  if (cbErr) { console.error('comic_books upsert 실패:', cbErr.message); process.exit(1) }

  // job write-back
  await refreshJob(bookId, rows.length)
  console.log(`✓ 적재 완료 — ${rows.length}컷${panelsPass ? ' · QC 통과(발행 가능)' : ' · QC 미통과(발행 차단)'}`)
}

async function refreshJob(bookId, panelsDone) {
  const { data: job } = await db.from('book_curation_jobs')
    .select('id, panels_total').eq('book_id', bookId).eq('task_type', 'comic_gen').maybeSingle()
  if (!job) { console.error('  (comic_gen job 없음 — write-back skip)'); return }
  const total = job.panels_total ?? panelsDone
  await db.from('book_curation_jobs').update({
    panels_total: total, panels_done: panelsDone,
    status: panelsDone >= total ? 'done' : 'running', claimed_at: new Date().toISOString(),
  }).eq('id', job.id)
}

// ── main ────────────────────────────────────────────────────────
const [, , cmd, bookId, maybeCh] = process.argv
try {
  if (cmd === 'plan' && bookId) await plan(bookId)
  else if (cmd === 'content' && bookId && maybeCh) await content(bookId, maybeCh)
  else if (cmd === 'insert' && bookId) await insert(bookId, arg('file'), has('commit'))
  else { console.error('commands: plan <book_id> | content <book_id> <ch> | insert <book_id> --file pages.json [--commit]'); process.exit(1) }
} catch (e) { console.error(`[error] ${e.message}`); process.exit(1) }
