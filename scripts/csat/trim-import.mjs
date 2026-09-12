// scripts/csat/trim-import.mjs
//
// **손질 결과를 적용한다. 기본은 예행 — `--commit` 이 있어야 쓴다.**
//
// ── 이 파일의 존재 이유는 자물쇠다 ──────────────────────────────────
// 손질은 "앞 한두 문장을 뗀다" 는 뜻이지 **다시 쓰는 것이 아니다.** 그런데 LLM 에게
// 텍스트를 주고 고쳐 오라고 하면 반드시 문장을 손본다 — 이 저장소가 이미 그 값을 치렀다:
//
//   `sfrequentlyed`(softened) · `a genuine hardy`(difficulty) · `unopen altogether`(unavailable)
//   `Greeks required it up`(took it up) · `a individual blade`
//
// 낱말 길이를 맞추려고 치환 스크립트를 돌린 결과였고, **채점기는 글자 수만 세므로 통과했다.**
// 사람이 읽어야만 보이는 종류다.
//
// 그래서 여기서는 **잘라내기만 허용한다**:
//   손질 결과는 원문의 **연속된 부분 문자열**이어야 한다(공백 정규화 후).
//   한 글자라도 다르면 거부한다. 이 검사는 LLM 의 선의에 기대지 않는다.
//
// ── 무엇을 쓰는가 ───────────────────────────────────────────────────
// `content` 를 손질본으로 바꾸고, `csat_fit.trim.before` 에 **원문을 그대로 남긴다**(되돌리기).
// `content_hash`·`source_id`·`word_count` 를 함께 갱신한다 — 안 하면 해시가 본문과 어긋난다.
//
// 실행: node scripts/csat/trim-import.mjs [--commit] [--curl]

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

import { fitRecord, W, splitSentences } from './lib-fit.mjs'
import { hardReject, purposeOf, decide, PURPOSE_RULE, RULES_VERSION, CODES_VERSION } from './gate-rules.mjs'
import { curlFetch } from './lib-curl-fetch.mjs'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const COMMIT = process.argv.includes('--commit')
const DRAIN = path.resolve('scripts/csat/trim-drain')

const trims = new Map()
let files = 0
for (const f of fs.readdirSync(DRAIN).filter((f) => f.endsWith('.out.json')).sort()) {
  files += 1
  for (const it of JSON.parse(fs.readFileSync(path.join(DRAIN, f), 'utf8'))) {
    if (it.trimmed && it.trimmed.trim()) trims.set(it.id, { trimmed: it.trimmed, note: it.note ?? '' })
  }
}
console.log('손질 적용' + (COMMIT ? ' — **쓴다**' : ' — 예행'))
console.log('='.repeat(78))
console.log(`  손질 파일 ${files}개 · 조각 **${trims.size}편**\n`)
if (!trims.size) {
  console.error('  ❌ 손질 결과가 없다. 먼저 trim-export.mjs 로 뽑고 채울 것.')
  process.exit(1)
}

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  ...(process.argv.includes('--curl') ? { global: { fetch: curlFetch } } : {}),
})
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function retry(fn, what, attempt = 0) {
  try {
    const r = await fn()
    if (r?.error) throw new Error(r.error.message)
    return r
  } catch (e) {
    if (attempt >= 4) throw new Error(`${what} — ${String(e.message).slice(0, 80)}`)
    await sleep(1500 * 2 ** attempt)
    return retry(fn, what, attempt + 1)
  }
}

/** 공백만 정규화한다 — 낱말은 건드리지 않는다. */
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim()

const reject = {}
const bump = (k) => (reject[k] = (reject[k] ?? 0) + 1)
let seen = 0
let ok = 0
let wrote = 0
const ids = [...trims.keys()]
const NOW = new Date().toISOString()

for (let i = 0; i < ids.length; i += 40) {
  const { data } = await retry(
    () =>
      db
        .from('library_articles')
        .select('id,title,content,status,status_message,feed_id,source,word_count,csat_fit')
        .in('id', ids.slice(i, i + 40)),
    '조회',
  )
  for (const row of data ?? []) {
    seen += 1
    const original = String(row.content ?? '')
    const t = norm(trims.get(row.id).trimmed)

    // ── 자물쇠 ① 잘라내기만 허용한다 ────────────────────────────────
    // 손질본이 원문의 연속된 부분 문자열이 아니면 **낱말이 바뀐 것**이다. 거부한다.
    if (!norm(original).includes(t)) {
      bump('원문에 없는 문자열 — 고쳐 썼다')
      continue
    }
    // ── 자물쇠 ② 앞만 떼야 한다 ─────────────────────────────────────
    // 가운데를 들어내면 논지가 끊긴다. 손질본은 원문의 **끝까지** 가야 한다.
    if (!norm(original).endsWith(t)) {
      bump('끝이 다르다 — 가운데를 들어냈다')
      continue
    }
    // ── 자물쇠 ③ 너무 많이 떼지 않았다 ──────────────────────────────
    const kept = W(t).length
    const before = W(original).length
    if (kept < before * 0.55) {
      bump(`절반 넘게 뗐다 (${before}→${kept}어)`)
      continue
    }
    if (kept < 120) {
      bump(`남은 것이 짧다 (${kept}어)`)
      continue
    }
    // ── 자물쇠 ④ 문장으로 시작하고 끝난다 ───────────────────────────
    if (!/^[A-Z"'“‘(]/.test(t) || !/[.!?]["'’”)]?$/.test(t)) {
      bump('문장 경계가 아니다')
      continue
    }
    // ── 자물쇠 ⑤ 게이트와 대역을 다시 통과해야 한다 ─────────────────
    const codes = hardReject(t)
    if (codes.length) {
      bump(`기계 규칙 ${codes[0]}`)
      continue
    }
    const purpose = purposeOf(row)
    const f = fitRecord(t)
    if (purpose === 'csat' && !f.pass) {
      bump('대역 미달')
      continue
    }
    const { publishable, blockedBy } = decide({ purpose, verdict: 'use', genre: 'essay', codes })
    if (!publishable) {
      bump(`게이트 ${blockedBy}`)
      continue
    }

    ok += 1
    if (!COMMIT) continue

    const hash = crypto.createHash('sha256').update(t).digest('hex').slice(0, 32)
    const gate = {
      v: 2,
      rv: RULES_VERSION,
      cv: CODES_VERSION,
      publishable: true,
      purpose,
      blockedBy: null,
      verdict: 'use',
      genre: 'essay',
      why: '앞 문장을 떼어 자족하게 만든 손질본',
      codes: [],
      by: 'chunk-llm+trim',
      at: NOW,
    }
    await retry(
      () =>
        db
          .from('library_articles')
          .update({
            content: t,
            content_hash: hash,
            source_id: hash,
            word_count: kept,
            status: 'queued',
            status_message: null,
            csat_fit: {
              ...(row.csat_fit ?? {}),
              ...f,
              gate,
              // ⚠️ **원문을 그대로 남긴다.** 손질이 틀렸을 때 되돌릴 유일한 길이다.
              trim: { v: 1, at: NOW, wordsBefore: before, wordsAfter: kept, before: original },
            },
          })
          .eq('id', row.id),
      `쓰기 ${row.id}`,
    )
    wrote += 1
  }
  process.stdout.write(`\r  ${seen}편 · 통과 ${ok} · 쓴 것 ${wrote}`)
}

console.log(`\n\n  훑음 ${seen} · **통과 ${ok}** · 쓴 것 ${wrote}\n`)
if (Object.keys(reject).length) {
  console.log('  거부한 자리:')
  for (const [k, n] of Object.entries(reject).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(n).padStart(4)}  ${k}`)
  }
}
if (!COMMIT) console.log(`\n  예행이었다. 실제로 쓰려면 --commit`)
