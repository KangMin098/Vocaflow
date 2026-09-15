// scripts/acp/plos-abstract-repair.mjs
//
// **초록이 두 번 들어간 채 저장된 PLOS 본문을 고친다.**
//
// ── 무엇을 고치나 ───────────────────────────────────────────────────
// 추출기는 2026-09-06 에 이미 고쳐졌다(`plos.ts` 의 `joinAbstractAndBody` 가 본문에
// 초록이 이미 있으면 앞에 붙이지 않는다). 그런데 **그 전에 적재된 행은 그대로다** —
// 실측 2026-09-15: scope 안 PLOS 45,096편이 **전부 09-05 이전 적재**이고 09-06 이후
// 적재는 0편이다. 즉 이것은 추출기 결함이 아니라 **재고 수리** 문제다.
//
// 저장된 모양은 한 가지다(실측 pgph.0001922):
//
//   1행  [초록 1,315자]      ← 앞에 한 번 더 붙은 복사본
//   2행  (빈 줄)
//   3행  Abstract
//   4행  [같은 초록 1,315자]  ← article-text 안쪽의 원본
//   5행  (빈 줄)
//   6행~ Citation: / doi / Editor / Published / Copyright / Funding …
//
// 그래서 수리는 **`\nAbstract\n` 앞을 잘라내는 것**이고, 그 결과는 고쳐진 추출기가
// 오늘 만들었을 산출물과 같다.
//
// ── 왜 이 결함이 조용한가 ───────────────────────────────────────────
// 산출물은 문법적으로 멀쩡하고 길이만 늘어난다. 대신 `word_count` 가 부풀고(실측 평균
// +6.2%) **학령 판정과 지문 규격 판정이 그만큼 틀린 분모 위에서 돈다.** 그래서 본문만
// 고치고 끝내면 안 된다 — 아래 §다음 단계.
//
// ── 안전 장치 (이 스크립트가 지키는 것) ─────────────────────────────
//   ① **기본이 dry-run.** `--commit` 이 없으면 한 행도 쓰지 않는다.
//   ② **고칠 수 있는 것만 고친다** — 자른 뒤 중복이 0 이 되는 행만. 안 되면 건너뛰고
//      이유와 함께 센다. (실측 표본 2,000: 결함 847 중 803(94.8%)이 여기 해당)
//   ③ **멀쩡한 행은 건드리지 않는다** — 중복이 없으면 `\nAbstract\n` 가 있어도 통과.
//      (표본에서 오탐 0)
//   ④ **재실행 안전** — 고친 행은 다음 실행에서 「중복 없음」으로 걸러진다.
//   ⑤ **바닥 길이** — 자른 뒤 본문이 `MIN_CHARS` 미만이면 건너뛴다. 「본문 div 없이
//      초록만 있는 편」을 통째로 비우지 않기 위해서다(`plos-abstract-duplication.test.ts`
//      머리말이 그 사고를 적고 있다 — 20편 중 1편).
//
// 실행:
//   pnpm dlx tsx scripts/acp/plos-abstract-repair.mjs              ← 세기만 한다
//   pnpm dlx tsx scripts/acp/plos-abstract-repair.mjs --limit 200  ← 앞 200편만
//   pnpm dlx tsx scripts/acp/plos-abstract-repair.mjs --commit     ← 실제로 쓴다
//
// ── 다음 단계 (이 스크립트가 **하지 않는** 것) ──────────────────────
// `word_count`·`content_hash` 는 여기서 같이 고치지만, `article_v_level`·`cefr_level`·
// `lexical_noise`·어휘 목록은 **재분석해야** 맞다:
//   pnpm dlx tsx scripts/acp/reprocess.mjs --commit
// 그리고 재고 수치가 바뀌므로 적격·결함 스캔을 다시 돌린다.

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const COMMIT = process.argv.includes('--commit')
const LIMIT = Number(arg('limit') ?? 0) || Infinity
const PAGE = 500
/** 자른 뒤 이만큼도 안 남으면 건드리지 않는다 — 초록만 있는 편을 비우지 않기 위해. */
const MIN_CHARS = 400

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const sha256 = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex')

/**
 * 중복한 긴 줄이 있는가 — **결함 스캐너와 같은 자**를 쓴다.
 * (`scripts/textbook/extraction-defect-scan.mjs` 의 `dup-paragraph`: 80자 이상 줄의 앞 120자)
 * ⚠️ 사본을 두면 「스캐너는 결함이라는데 수리기는 아니라고 한다」가 된다.
 */
function hasDupParagraph(body) {
  const seen = new Set()
  for (const raw of String(body ?? '').split(/\n+/)) {
    const line = raw.trim()
    if (line.length < 80) continue
    const key = line.slice(0, 120)
    if (seen.has(key)) return true
    seen.add(key)
  }
  return false
}

const wordCount = (s) => (String(s ?? '').trim().match(/\S+/g) ?? []).length

/**
 * 수리 시도. 고칠 수 있으면 새 본문을, 아니면 `null` 과 이유를 돌려준다.
 * **한 행도 스스로 판단하지 않는다** — 자른 뒤 중복이 0 이 되는지로만 판정한다.
 */
function repair(content) {
  if (!content) return { body: null, reason: 'empty' }
  if (!hasDupParagraph(content)) return { body: null, reason: 'clean' }

  const at = content.indexOf('\nAbstract\n')
  if (at < 0) return { body: null, reason: 'no-abstract-heading' }

  const cut = content.slice(at + 1)
  if (cut.length < MIN_CHARS) return { body: null, reason: 'too-short-after-cut' }
  if (hasDupParagraph(cut)) return { body: null, reason: 'still-duplicated' }

  return { body: cut, reason: 'repaired' }
}

// ── 훑기 ────────────────────────────────────────────────────────────
const tally = { scanned: 0, clean: 0, repaired: 0, written: 0, failed: 0 }
const skipped = new Map()
let removedChars = 0
let removedWords = 0
let cursor = null
let lastError = ''
let aborted = ''

console.log(`PLOS 초록 중복 수리 — ${COMMIT ? '쓰기(--commit)' : 'dry-run (아무것도 안 쓴다)'}`)

while (tally.scanned < LIMIT) {
  // ⚠️ **한 쪽이 8초 statement timeout 에 걸린다** (실측 2026-09-15: 42,000편째에서 끊겼다).
  //   본문이 큰 쪽이 걸리므로 재시도할 때 **쪽을 줄인다** — 같은 크기로 다시 물으면 같은 답이 온다.
  //   이 저장소가 이미 쓰는 패턴이다(admin-queries.ts 의 countRows 는 백오프만 쓰는데,
  //   거기 주석이 "느린 게 아니라 이 크기에서는 되지 않는다" 고 적고 있다 — 크기를 줄여야 한다).
  // ⚠️ 끊기는 방식이 **두 가지**이고 처방이 다르다(실측 2026-09-15, 둘 다 겪었다):
  //   · `statement timeout` — 본문이 큰 쪽이라 **쪽을 줄여야** 한다. 기다려도 소용없다.
  //   · `TypeError: fetch failed` — 이 머신의 네트워크/TLS 가 순간 끊긴 것이라
  //     **기다려야** 한다(쪽 크기와 무관하다 · memory: Node TLS ALPN).
  //   그래서 둘을 같이 쓴다 — 쪽을 줄이면서 점점 오래 기다린다.
  const BACKOFF = [0, 1000, 3000, 8000, 20000]
  let data = null
  for (let attempt = 0; attempt < BACKOFF.length && !data; attempt += 1) {
    const size = Math.max(50, Math.floor(PAGE / 2 ** attempt))
    if (attempt > 0) await new Promise((r) => setTimeout(r, BACKOFF[attempt]))
    let q = db
      .from('library_articles')
      .select('id, content, word_count')
      .eq('source', 'plos')
      .in('status', ['ready', 'published'])
      .order('id', { ascending: true })
      .limit(size)
    if (cursor) q = q.gt('id', cursor)
    const res = await q
    if (res.error) {
      lastError = res.error.message || '(메시지 없음)'
      continue
    }
    data = res.data
  }
  if (!data) {
    // **멈추되 지금까지 센 것은 버리지 않는다** — 끊긴 자리를 밝히고 아래 집계로 내려간다.
    // 0 은 성과일 수도 측정 실패일 수도 있다(§CONVENTIONS): 부분 집계라고 말해야 한다.
    aborted = `${lastError} (커서 ${cursor ?? '처음'} · 훑은 ${tally.scanned.toLocaleString()}편에서)`
    break
  }
  if (data.length === 0) break

  for (const row of data) {
    if (tally.scanned >= LIMIT) break
    tally.scanned += 1
    const { body, reason } = repair(row.content)

    if (!body) {
      if (reason === 'clean') tally.clean += 1
      else skipped.set(reason, (skipped.get(reason) ?? 0) + 1)
      continue
    }

    tally.repaired += 1
    removedChars += row.content.length - body.length
    const wc = wordCount(body)
    removedWords += (row.word_count ?? wordCount(row.content)) - wc

    if (COMMIT) {
      const { error: werr } = await db
        .from('library_articles')
        .update({ content: body, content_hash: sha256(body), word_count: wc })
        .eq('id', row.id)
      if (werr) {
        tally.failed += 1
        console.error(`  쓰기 실패 ${row.id}: ${werr.message || '(메시지 없음)'}`)
      } else {
        tally.written += 1
      }
    }
  }

  cursor = data[data.length - 1].id
  if (data.length < 50) break // 마지막 쪽 — 가장 작은 재시도 크기보다 적게 왔다
  process.stdout.write(`\r  훑음 ${tally.scanned.toLocaleString()} …`)
}

// ── 보고 ────────────────────────────────────────────────────────────
const defective = tally.repaired + [...skipped.values()].reduce((a, b) => a + b, 0)
const pct = (n, d) => (d ? ((n / d) * 100).toFixed(1) : '0.0')

console.log('\n')
if (aborted) console.log(`  ⚠️ 중간에 끊겼다 — 아래는 **부분 집계**다: ${aborted}\n`)
console.log(`  훑은 편수        ${tally.scanned.toLocaleString()}`)
console.log(`  중복 없음        ${tally.clean.toLocaleString()} (${pct(tally.clean, tally.scanned)}%)`)
console.log(`  중복 있음        ${defective.toLocaleString()} (${pct(defective, tally.scanned)}%)`)
console.log(`    └ 고칠 수 있음 ${tally.repaired.toLocaleString()} (중복분의 ${pct(tally.repaired, defective)}%)`)
for (const [reason, n] of [...skipped.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`    └ 건너뜀 ${reason.padEnd(20)} ${n.toLocaleString()}`)
}
console.log(`  줄어드는 글자    ${removedChars.toLocaleString()} (편당 평균 ${tally.repaired ? Math.round(removedChars / tally.repaired) : 0})`)
console.log(`  줄어드는 낱말    ${removedWords.toLocaleString()} (편당 평균 ${tally.repaired ? Math.round(removedWords / tally.repaired) : 0})`)

if (COMMIT) {
  console.log(`\n  쓴 편수          ${tally.written.toLocaleString()}${tally.failed ? ` · 실패 ${tally.failed}` : ''}`)
  console.log('\n  ⚠️ 아직 안 끝났다 — 학령·CEFR·어휘는 옛 본문 위에서 계산된 값이다:')
  console.log('     pnpm dlx tsx scripts/acp/reprocess.mjs --commit')
  console.log('     pnpm dlx tsx scripts/textbook/extraction-defect-scan.mjs --all')
  console.log('     pnpm dlx tsx scripts/textbook/source-eligibility-scan.mjs')
} else {
  console.log('\n  아무것도 쓰지 않았다. 실제로 고치려면 --commit 을 붙인다.')
}
