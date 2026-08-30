// scripts/csat/score-articles.mjs
//
// **원문마다 수능 적합도를 재서 DB 에 남긴다.**
//
// ── 왜 필요한가 ──────────────────────────────────────────────────────
// `corpus-window-yield` · `discourse-band` 는 **자**다 — 돌릴 때마다 전수를 다시 계산한다.
// 6,500편에 수 분, 5만편이면 수십 분이다. 그래서 "지금 적합 원문이 몇 편인가" 를
// 물을 때마다 전수 계산을 해야 하고, 화면에서 걸러 보거나 감시할 수도 없다.
// 그건 측정이지 **관리**가 아니다.
//
// 이 스크립트는 같은 자를 한 번 대고 **결과를 원문에 붙인다.** 그러면
//   · `where (csat_fit->>'pass')::int > 0` 으로 즉시 질의된다 (부분 인덱스 있음)
//   · 새로 들어온 원문만 채점하면 되므로 비용이 누적되지 않는다
//   · 기준(대역)이 바뀌면 `bandsHash` 가 달라지므로 **재채점 대상을 알 수 있다**
//
// ⚠️ **전용 컬럼을 쓴다**(마이그레이션 20260830120000). 처음에는 CLAUDE.md 규약대로
//   `syntax_score`(jsonb)에 키를 더했는데, `process-queue.mjs:148` 이 부르는
//   `compute_article_syntax` RPC 가 그 컬럼을 **통째로 덮어써** 재처리마다 조용히 사라졌다.
//   "키만 더하면 마이그레이션이 필요 없다" 는 규약은 그 컬럼에 통째로 쓰는 주인이 없을 때만 성립한다.
//
// 저장 형태:
//   csat_fit = {
//     v: 1,                      // 채점기 판 — 로직이 바뀌면 올린다
//     bandsHash: "773d679f463c", // 기준 대역 값의 해시. 다르면 재채점 대상
//     shape: 12,                 // 모양+산문 게이트를 통과한 창 수 (R-BLANK 기준)
//     pass: 7,                   // 담화 대역까지 통과한 창 수  ← 이게 적합 여부
//     measuredAt: "..."
//   }
//
// 실행:
//   pnpm dlx tsx scripts/csat/score-articles.mjs                 # 밀린 양만 센다(읽기 전용)
//   pnpm dlx tsx scripts/csat/score-articles.mjs --commit [--limit 2000] [--force]
//
// 재실행 안전: 이미 같은 판·같은 대역으로 채점된 원문은 건너뛴다. `--force` 로만 다시 한다.

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { allRows, itemBlocks, passageOf } from './lib-passage.mjs'
import { cleanPassage, looksInterleaved } from './clean-passage.mjs'
import { looksLikeProse } from './prose-gate.mjs'

const SCORER_VERSION = 1
const TYPE = 'R-BLANK' // 수능 최다 출제 · 기출 표본 n=55 로 가장 두껍다

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const commit = process.argv.includes('--commit')
const force = process.argv.includes('--force')
const LIMIT = arg('limit') ? Number(arg('limit')) : Infinity

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const bandsFile = JSON.parse(
  fs.readFileSync(path.resolve('scripts/csat/data/type-bands-all.json'), 'utf8'),
)
const SHAPE = bandsFile.bands[TYPE]
/**
 * ⚠️ bandsFile.builtAt 은 시각이 아니라 **생성 스크립트 이름**('build-bands-all.mjs')이다.
 *   그걸 판별자로 쓰면 대역을 다시 만들어 값이 바뀌어도 같은 문자열이라 **재채점 대상을
 *   못 가린다.** 그래서 대역 값 자체를 해시한다 — 값이 바뀌면 해시가 바뀐다.
 */
const BANDS_HASH = crypto.createHash('sha256').update(JSON.stringify(SHAPE)).digest('hex').slice(0, 12)

const W = (s) => s.match(/[A-Za-z][A-Za-z'-]*/g) ?? []
const splitSentences = (s) =>
  s.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter((x) => x.length > 3)

const CONNECTIVE =
  /\b(however|therefore|thus|hence|moreover|furthermore|nevertheless|nonetheless|consequently|accordingly|meanwhile|instead|rather|although|though|whereas|while|because|since|so that|as a result|for example|for instance|in contrast|on the other hand|in other words|that is|in fact|indeed|by contrast|similarly|likewise|in addition|on the contrary|in short|in sum)\b/gi
const ANAPHORA = /\b(this|these|those|such|its|their|his|her|they|them|it)\b/gi

/** 기출에서 담화 하한을 뽑는다 — `discourse-band.mjs` 와 같은 방법·같은 표본. */
function discourseFloor() {
  const rows = []
  for (const r of allRows()) {
    if (r.type !== TYPE) continue
    const b = itemBlocks(r.exam, r.no)[0]
    if (!b) continue
    const p = cleanPassage(passageOf(b))
    if (!p || p.length < 150 || looksInterleaved(p)) continue
    const w = W(p)
    rows.push({
      conn: (100 * (p.match(CONNECTIVE) ?? []).length) / Math.max(1, w.length),
      ana: (100 * (p.match(ANAPHORA) ?? []).length) / Math.max(1, w.length),
    })
  }
  const q = (a, x) => { const s = [...a].sort((m, n) => m - n); return s[Math.floor(x * (s.length - 1))] }
  return {
    n: rows.length,
    conn: q(rows.map((r) => r.conn), 0.1),
    ana: q(rows.map((r) => r.ana), 0.1),
  }
}
const FLOOR = discourseFloor()

function scoreArticle(text) {
  const sents = splitSentences(text)
  const wp = sents.map(W)
  let shape = 0
  let pass = 0
  let i = 0
  while (i < sents.length) {
    let acc = []
    let j = i
    let hit = -1
    while (j < sents.length) {
      acc = acc.concat(wp[j])
      j++
      if (acc.length > SHAPE.words.hi) break
      if (acc.length < SHAPE.words.lo) continue
      const sentLen = acc.length / (j - i)
      const wordLen = acc.reduce((s, x) => s + x.length, 0) / acc.length
      if (
        sentLen < SHAPE.sentLen.lo || sentLen > SHAPE.sentLen.hi ||
        wordLen < SHAPE.wordLen.lo || wordLen > SHAPE.wordLen.hi
      ) continue
      if (!looksLikeProse(sents.slice(i, j).join(' '), acc)) continue
      hit = j
      break
    }
    if (hit < 0) { i++; continue }
    shape++
    const text2 = sents.slice(i, hit).join(' ')
    const w = W(text2)
    const conn = (100 * (text2.match(CONNECTIVE) ?? []).length) / Math.max(1, w.length)
    const ana = (100 * (text2.match(ANAPHORA) ?? []).length) / Math.max(1, w.length)
    const hasBoth = (text2.match(CONNECTIVE) ?? []).length > 0 && (text2.match(ANAPHORA) ?? []).length > 0
    if (conn >= FLOOR.conn && ana >= FLOOR.ana && hasBoth) pass++
    i = hit
  }
  return { shape, pass }
}

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

console.log(
  `수능 적합도 채점 v${SCORER_VERSION} · 기준 ${TYPE} · 대역 해시 ${BANDS_HASH}\n` +
    `담화 하한 (기출 ${FLOOR.n}편 10분위) 연결사 ${FLOOR.conn.toFixed(2)} · 지시어 ${FLOOR.ana.toFixed(2)}\n`,
)

// ⚠️ PostgREST 는 한 번에 1,000행만 준다 — range 로 끝까지 읽는다.
//   (이 상한 때문에 수집 배치가 이미 가진 글을 다시 GET 하던 적이 있다.)
const rows = []
for (let from = 0; ; from += 500) {
  const { data, error } = await db
    .from('library_articles')
    .select('id, content, csat_fit')
    .not('content', 'is', null)
    .range(from, from + 499)
  if (error) throw new Error('조회 실패: ' + error.message)
  if (!data || data.length === 0) break
  rows.push(...data)
  if (data.length < 500) break
}

const needScore = rows.filter((r) => {
  if (force) return true
  const f = r.csat_fit
  return !f || f.v !== SCORER_VERSION || f.bandsHash !== BANDS_HASH
})
const targets = needScore.slice(0, LIMIT === Infinity ? undefined : LIMIT)

console.log(`원문 ${rows.length.toLocaleString()} · 채점 필요 ${needScore.length.toLocaleString()}` +
  `${commit ? ` · 이번에 ${targets.length.toLocaleString()}편` : ' (읽기 전용 — --commit 을 붙이면 쓴다)'}\n`)

let fit = 0
let written = 0
const failures = []
for (const a of targets) {
  const s = scoreArticle(a.content)
  if (s.pass > 0) fit++
  if (!commit) continue
  const record = {
    v: SCORER_VERSION,
    bandsHash: BANDS_HASH,
    type: TYPE,
    shape: s.shape,
    pass: s.pass,
    measuredAt: new Date().toISOString(),
  }
  const { error } = await db.from('library_articles').update({ csat_fit: record }).eq('id', a.id)
  if (error) failures.push(`${a.id}: ${error.message}`)
  else written++
}

console.log(`적합 원문(지문 1개 이상) ${fit.toLocaleString()} / ${targets.length.toLocaleString()}` +
  ` (${((100 * fit) / Math.max(1, targets.length)).toFixed(1)}%)`)
if (commit) console.log(`기록 ${written.toLocaleString()}편`)
if (failures.length) {
  console.log(`\n실패 ${failures.length}:`)
  for (const f of failures.slice(0, 10)) console.log('  · ' + f)
}
console.log(
  `\n질의: select count(*) from library_articles where (csat_fit->>'pass')::int > 0;`,
)
