// scripts/vocab/backfill-pronunciation.mjs
//
// **발행 단어장에 발음기호를 싣는다** (`shared_words.pronunciation` ← `shared_dictionary.ipa`).
//
// ── 왜 필요한가 (실측 2026-08-30) ───────────────────────────────────
// 사전은 카탈로그 표제어의 **95.7%** 에 발음기호를 갖고 있다(`vocab/market-benchmark.mjs`
// B2 축). 그런데 단어장 쪽 `shared_words.pronunciation` 은 32,790칸 중 17,134칸만 차 있다.
// **15,136칸이 사전에 있는데 안 실려 있었다.**
//
// 그래서 선택 지수(`vocab/choice-benchmark.mts`)의 `extras` 신호가 70권 중 29권에만
// 섰다 — 학습자가 서가에서 "이 권은 발음을 준다" 를 알 수 있는 권이 41% 뿐이었다는 뜻이다.
// 재고가 없어서가 아니라 **옮겨 담지 않아서**였다.
//
// ── 안전 ────────────────────────────────────────────────────────────
// · **빈 칸만 채운다.** `pronunciation is not null` 인 행은 손대지 않는다 — 이미 실린 값이
//   더 정확할 수 있고(발행 당시 다른 출처), 덮으면 그 사실을 되돌릴 수 없다.
// · `ipa` 를 먼저 쓰고 없으면 `ipa_us`. 둘 다 없으면 **건너뛴다** — 빈 문자열을 넣으면
//   다음 실행이 "채워졌다" 로 세어 구멍이 영영 남는다(CLAUDE.md §드레인 규칙).
// · 대소문자는 사전 쪽에서 맞춘다(`lower(word)` 매칭) — 표제어가 `Apple` 로 실린 세트가 있다.
// · 기본은 드라이런. 실제로 쓰려면 `--commit`.
// · **재실행 안전** — 몇 번을 돌려도 결과가 같다. 두 번째 실행은 "채울 것 0" 을 낸다.
//
// 실행: node scripts/vocab/backfill-pronunciation.mjs [--commit] [--set <uuid>]

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const { createClient } = await import('@supabase/supabase-js')

const COMMIT = process.argv.includes('--commit')
const ONLY_SET = (() => {
  const i = process.argv.indexOf('--set')
  return i >= 0 ? process.argv[i + 1] : null
})()

/** 학습자의 공용 서가에 뜨지 않는 칸 — `lib/library/vocab/queries.ts` 와 같아야 한다. */
const HIDDEN = ['library_book', 'library_article']
/** 사전 조회 묶음. 너무 크면 URL 이 터진다(`market-benchmark.mjs` 와 같은 이유). */
const DICT_CHUNK = 300
/** 갱신 묶음 — 한 번에 보내는 UPDATE 수. */
const WRITE_CHUNK = 200

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

let q = supabase
  .from('shared_word_sets')
  .select('id, title')
  .eq('is_published', true)
  .not('category', 'in', `(${HIDDEN.join(',')})`)
if (ONLY_SET) q = q.eq('id', ONLY_SET)
const { data: sets, error: setErr } = await q
if (setErr) throw new Error(`shared_word_sets: ${setErr.message}`)

/**
 * 사전에서 발음기호를 가져온다. **소문자 키로 접는다** — 세트마다 표제어 대소문자가 다르다.
 */
async function ipaFor(words) {
  const map = new Map()
  for (let i = 0; i < words.length; i += DICT_CHUNK) {
    const { data, error } = await supabase
      .from('shared_dictionary')
      .select('word, ipa, ipa_us')
      .in('word', words.slice(i, i + DICT_CHUNK))
    if (error) throw new Error(`shared_dictionary: ${error.message}`)
    for (const d of data) {
      const v = d.ipa || d.ipa_us
      if (v) map.set(d.word.toLowerCase(), v)
    }
  }
  return map
}

let totalBlank = 0
let totalFillable = 0
let totalWritten = 0
let totalNoDict = 0

for (const s of sets) {
  // 빈 칸만 읽는다 — 이미 실린 값은 후보가 아니다.
  const blanks = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('shared_words')
      .select('id, word')
      .eq('set_id', s.id)
      .is('pronunciation', null)
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`shared_words(${s.id}): ${error.message}`)
    blanks.push(...data)
    if (data.length < PAGE) break
  }
  if (blanks.length === 0) continue
  totalBlank += blanks.length

  // 사전 조회는 **낱말 단위로 접어서** 한다 — 한 세트 안에 같은 낱말이 여러 번 있을 수 있다.
  const uniq = [...new Set(blanks.map((b) => b.word))]
  const map = await ipaFor(uniq)

  const writes = blanks
    .map((b) => ({ id: b.id, ipa: map.get(b.word.toLowerCase()) }))
    .filter((w) => !!w.ipa)
  totalFillable += writes.length
  totalNoDict += blanks.length - writes.length

  console.info(
    `  ${s.title.slice(0, 30).padEnd(32)} 빈칸 ${String(blanks.length).padStart(5)}`
    + ` · 사전에 있음 ${String(writes.length).padStart(5)}`,
  )

  if (!COMMIT || writes.length === 0) continue

  for (let i = 0; i < writes.length; i += WRITE_CHUNK) {
    const batch = writes.slice(i, i + WRITE_CHUNK)
    // 값이 낱말마다 달라 한 번의 UPDATE 로 못 묶는다. 병렬로 보내되 묶음마다 기다린다 —
    // 전량 동시 발사는 커넥션을 고갈시킨다.
    const results = await Promise.all(
      batch.map((w) =>
        supabase.from('shared_words').update({ pronunciation: w.ipa }).eq('id', w.id),
      ),
    )
    const failed = results.filter((r) => r.error)
    if (failed.length > 0) throw new Error(`갱신 실패 ${failed.length}건: ${failed[0].error.message}`)
    totalWritten += batch.length
  }
}

console.info('')
console.info(`세트 ${sets.length} · 빈칸 ${totalBlank.toLocaleString()}`)
console.info(`  사전에 있음  ${totalFillable.toLocaleString()}`)
console.info(`  사전에 없음  ${totalNoDict.toLocaleString()}  ← 건너뜀 (빈 값을 넣지 않는다)`)
console.info(COMMIT ? `  기록함      ${totalWritten.toLocaleString()}` : '  드라이런 — --commit 으로 실제 기록')
