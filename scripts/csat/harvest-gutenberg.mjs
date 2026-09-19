// scripts/csat/harvest-gutenberg.mjs
//
// @harvest-source: gutenberg
//   ↑ 이 선언으로 `harvest-cursor-contract.test.ts` 가 이 파일을 **목록기로 세어**
//     `HARVEST_CURSOR_REGISTRY` 에 있는지 검사한다. 지우면 검사 밖으로 빠진다.
//
// **Project Gutenberg 인문 논픽션 겨냥 수확** — 적재 전에 정제하고 채점한다.
//
// 2단계(30,000)의 부족분은 대부분 인문 칸이고, 학술 소스는 전부 막혔다(§20~26).
// Gutenberg 실측(§44·§45)에서 정제 후 권당 병목 3칸 19편이 나왔으므로 약 400권이면
// 닿는다. PD 라 라이선스도 깨끗하다.
//
// 흐름은 PLOS 수확기와 같다:
//   책 목록 → 본문 → `cleanBookText` → 조각 → `looksLikeBookMatter` 배제 → 채점 →
//   몫이 남은 칸만 적재. 소재는 **적재 시점에 함께 적는다**(안 적으면 전수 집계에서 빠진다).
//
// ⚠️ **node 의 fetch 로는 gutenberg.org 에 못 붙는다**(§44). 같은 URL 을 curl 은 200 으로
//   받는데 node 는 매번 ECONNRESET 이다. 그래서 받는 일은 전부 curl 에 넘긴다.
//
// ⚠️ **재실행 안전.** 처리한 책 번호를 커서 파일에 적고 다음 실행에서 건너뛴다.
//   조각의 `source_id` 는 본문 해시라 파일을 다시 돌려도 같은 글이 두 번 안 들어간다.
//
// ── 2026-09-07 개정 — 목록을 검색이 아니라 **카탈로그**에서 만든다 ──────
//
// 옛 목록 경로는 `ebooks/search/?query=…&start_index=N` 이었다. 두 가지가 잘못돼 있었다:
//
//   ① **정렬 없는 offset 페이징.** 검색 순위는 우리가 정하는 것이 아니라 상류가 정한다.
//      순위가 흔들리면 같은 `start_index` 가 다른 책을 가리켜 **중복과 누락이 동시에**
//      생긴다 — 2026-08-16 IA 수집에서 214건이 겹치고 그만큼 빠진 그 방식이다.
//   ② **커서가 규약 밖.** `{ done: [...], offset: {...} }` 은 이 저장소의 다른 어떤
//      수확기와도 모양이 다르고, 그래서 "이 소스는 어디까지 봤나" 를 공통으로 못 묻는다
//      (`packages/library-pipeline/src/ingest-article/harvest-cursor.ts`).
//      실제로 그 파일은 867권을 적고 있었는데 DB 에는 **1,631권**이 들어 있었다 —
//      커서가 진실의 절반만 아는 채로 764권을 다시 받을 수 있는 상태였다.
//
// 지금은 Gutenberg 자체 카탈로그(`pg_catalog.csv.gz`)를 받아 **책 번호 오름차순**으로
// 훑는다. 번호는 발급 후 안 바뀌므로 좌표계가 흔들리지 않고, 페이지네이션 자체가 없다.
// 고를 때는 **LoCC(의회도서관 분류)** 로 부족한 칸을 겨냥한다 — 주제 문자열로 고르면
// 「Psychological fiction」 같은 소설이 딸려 온다(§실측).
//
//   node scripts/csat/harvest-gutenberg.mjs --plan                       # 재고·몫만
//   node scripts/csat/harvest-gutenberg.mjs --survey                     # 남은 카탈로그 실측
//   node scripts/csat/harvest-gutenberg.mjs --feed edu --books 20        # 읽기 전용
//   node scripts/csat/harvest-gutenberg.mjs --feed edu --books 20 --commit
//   node scripts/csat/harvest-gutenberg.mjs --search --narrative --books 20   # 옛 검색 경로

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fitRecord } from './lib-fit.mjs'
import { classify, TOPIC_KEYS, TOPIC_V } from './lib-topic.mjs'
import { cleanBookText, looksLikeBookMatter } from './lib-clean.mjs'
import { looksNarrative, peopleRatio, NARRATIVE_FLOOR } from './lib-narrative.mjs'
import { catalogRows, catalogByLocc } from '../textbook/lib/pg-catalog.mjs'

// ⚠️ 배럴(`src/index.ts`)이 아니라 **파일을 직접** 부른다. 배럴은 확장자 없는 import 가
//   섞여 있어 `node` 의 타입 스트리핑만으로는 안 풀린다(tsx 가 필요해진다). 이 파일은
//   `node:fs`·`node:path` 밖에 안 쓰므로 그대로 열린다 — 규약의 정본은 여전히 저 파일 하나다.
const { harvestCursorPath, readHarvestCursor, writeHarvestCursor, emptyHarvestCursor } =
  await import('../../packages/library-pipeline/src/ingest-article/harvest-cursor.ts')

const run = promisify(execFile)
const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d
}
const BOOKS = Number(arg('books', 12))
const STAGE = Number(arg('stage', 2))
const MAX = Number(arg('max', 100000))
const COMMIT = process.argv.includes('--commit')
const PLAN_ONLY = process.argv.includes('--plan')
const SURVEY = process.argv.includes('--survey')
const SEARCH = process.argv.includes('--search')
const FEED = arg('feed', 'edu')
const DATA = path.resolve('scripts/csat/data')
/** 옛 커서 — 규약 이전 형식. 읽어서 `seen` 에 흡수만 하고 더는 쓰지 않는다. */
const LEGACY_CURSOR_FILE = path.join(DATA, 'gutenberg-cursor.json')
const STAGE_GOAL = { 1: 10000, 2: 30000, 3: 50000 }[STAGE] ?? 30000
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * **부족한 칸 → LoCC 접두어.** 카탈로그 모드의 피드 정의다.
 *
 * 값은 2026-09-07 실측으로 정했다(`docs/reports/source-probe/gutenberg-remainder.md`).
 * 피드 이름을 ASCII 로 두는 이유는 커서 파일 이름이 되기 때문이다
 * (`harvestCursorPath` 가 한글을 `-` 로 바꾼다 — 그러면 다섯 피드가 한 파일을 덮어쓴다).
 */
const FEEDS = {
  edu: { bin: '교육·언어', prefixes: ['L', 'PE', 'PB', 'PC', 'PD', 'PF', 'PG', 'PH', 'PJ', 'PK', 'PL', 'PM'] },
  social: { bin: '사회·경제', prefixes: ['H', 'J', 'K'] },
  tech: { bin: '기술·매체', prefixes: ['T', 'Z'] },
  psych: { bin: '심리·인지', prefixes: ['BF'] },
  art: { bin: '예술·문화', prefixes: ['N', 'ML', 'MT'] },
}

/** 인문 칸을 노린 검색 질의. 한 칸에 여러 질의를 두어 한쪽으로 쏠리지 않게 한다. */
const QUERIES = {
  // ⚠️ 질의 하나가 한 회에 25권만 준다(검색 한 쪽). 병목 칸은 질의 수가 곧 회당 수확량이다.
  '예술·문화': ['art history', 'music history', 'architecture essays', 'folklore customs', 'theatre history', 'painting', 'sculpture', 'opera', 'musical instruments', 'ornament design', 'pottery ceramics', 'costume dress history', 'festivals ceremonies', 'engraving prints', 'cathedral art'],
  '역사·인류': ['ancient history', 'anthropology', 'medieval history', 'archaeology', 'travel exploration'],
  '철학·윤리': ['philosophy', 'ethics', 'logic essays', 'political philosophy', 'aesthetics'],
  '교육·언어': ['education', 'language essays', 'rhetoric', 'literary criticism', 'grammar history'],
}

/**
 * **서사 겨냥 질의** — `--narrative` 를 줄 때 쓴다.
 *
 * 위 `QUERIES` 는 소재 칸(예술·역사·철학·교육)의 **부족분**을 메우려고 만든 것이라,
 * 그 칸이 다 차면 아무것도 안 뽑는다(실측 2026-09-06: "노리는 몫 0편"). 그런데 비어 있던
 * 것은 소재가 아니라 **인물이 나오는 글**이었다(`lib-narrative.mjs` 머리말).
 * 그래서 소재 몫과 무관한 길을 따로 낸다.
 */
/**
 * ⚠️ **전기·서한·회고는 뺐다** (2026-09-06). 인물은 나오지만 **이야기가 아니라 평론**인
 *   조각이 대부분이었다 — 그 질의로 받은 책에서 뽑힌 심경 몫 다섯 편 중 넷이 미술사·
 *   자유론·가톨릭 비평이었다. 사람이 나오는 것과 사건이 벌어지는 것은 다르다.
 */
const NARRATIVE_QUERIES = [
  'short stories', 'folk tales', 'fairy tales', 'fables',
  'adventure stories', 'childrens stories', 'ghost stories',
  'detective stories', 'sea stories', 'humorous stories',
]
const NARRATIVE = process.argv.includes('--narrative')

async function get(u, attempt = 0) {
  try {
    const { stdout } = await run(
      'curl',
      ['-sSL', '--max-time', '120', '-A', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', '--fail', u],
      { maxBuffer: 96 * 1024 * 1024 },
    )
    if (!stdout || stdout.length < 200) throw new Error('본문이 너무 짧다')
    return stdout
  } catch (e) {
    if (attempt >= 2) throw new Error(String(e.message).slice(0, 60))
    await sleep(2500 * 2 ** attempt)
    return get(u, attempt + 1)
  }
}

function stripBoilerplate(t) {
  const s = t.indexOf('*** START OF')
  const e = t.indexOf('*** END OF')
  let body = t
  if (s > 0) body = body.slice(body.indexOf('\n', s) + 1)
  if (e > 0) body = body.slice(0, body.lastIndexOf('*** END OF'))
  return body
}

/**
 * 본문을 지문 크기 조각으로 자른다.
 *
 * ⚠️ **문단 경계에서만** 자른다. 문장 중간에서 끊으면 그 조각의 문장 평균이 망가져서
 *   소스의 성질이 아니라 자르는 방식을 재게 된다. (§45 에서 정제기가 빈 줄을 삼켰을 때
 *   조각이 73 → 5 로 무너진 것도 같은 이유다 — 이 함수는 빈 줄에 전적으로 의존한다.)
 */
function chop(body, lo = 300, hi = 340) {
  const paras = body
    .split(/\n\s*\n/)
    .map((x) => x.replace(/\s+/g, ' ').trim())
    .filter((x) => x.length > 80 && /[.!?]/.test(x))
  const out = []
  let buf = []
  let n = 0
  for (const para of paras) {
    const w = para.split(/\s+/).length
    if (w > hi) continue
    buf.push(para)
    n += w
    if (n >= lo) {
      if (n <= hi + 60) out.push(buf.join(' '))
      buf = []
      n = 0
    }
  }
  return out
}

// ── 목표 배합과 현재 재고 ────────────────────────────────────────────
const dist = JSON.parse(fs.readFileSync(path.join(DATA, 'topic-distribution.json'), 'utf8'))
const TARGET_KEYS = TOPIC_KEYS.filter((k) => k !== '분류불가')
const denom = TARGET_KEYS.reduce((s, k) => s + (dist.total[k] ?? 0), 0)
const share = Object.fromEntries(TARGET_KEYS.map((k) => [k, (dist.total[k] ?? 0) / denom]))

const gapFile = path.resolve('docs/reports/topic-gap.json')
if (!fs.existsSync(gapFile)) {
  console.error('소재별 재고를 모른다 — 먼저: node scripts/csat/topic-gap.mjs --out docs/reports/topic-gap.json')
  process.exit(1)
}
const gap = JSON.parse(fs.readFileSync(gapFile, 'utf8'))
const stock = Object.fromEntries(gap.rows.map((r) => [r.topic, r.estStock]))

console.log(`Gutenberg 인문 수확 — 정제하고 채점한 뒤 적재한다\n${'='.repeat(78)}`)
console.log(`  목표 ${STAGE}단계 ${STAGE_GOAL.toLocaleString()}편 · 재고 ${String(gap.measuredAt).slice(0, 10)} 실측\n`)
console.log(`  ${'소재'.padEnd(11)}${'목표'.padStart(8)}${'재고'.padStart(8)}${'부족'.padStart(8)}   질의`)
console.log('  ' + '-'.repeat(74))
const quota = {}
for (const k of TARGET_KEYS) {
  const want = Math.round(STAGE_GOAL * share[k])
  const have = stock[k] ?? 0
  quota[k] = Math.max(0, want - have)
  const qs = QUERIES[k]
  console.log(
    `  ${k.padEnd(11)}${want.toLocaleString().padStart(8)}${have.toLocaleString().padStart(8)}` +
      `${quota[k].toLocaleString().padStart(8)}   ${qs ? qs.slice(0, 3).join(' · ').slice(0, 40) : '— 이 소스로는 안 노린다'}`,
  )
}
console.log('  ' + '-'.repeat(74))
const covered = Object.keys(QUERIES).reduce((s, k) => s + quota[k], 0)
console.log(`  이 소스로 노리는 몫 **${covered.toLocaleString()}편**`)
console.log(`  ⚠️ 다른 칸에 떨어진 조각도 버리지 않는다 — 3단계 보관에는 그대로 쓰인다.`)
console.log(`     다만 균형 사정권은 병목 칸만 올린다(§41).\n`)
if (PLAN_ONLY) process.exit(0)

// ── DB ───────────────────────────────────────────────────────────────
// 읽기 전용 실행에서도 붙는다 — **이미 가진 책을 다시 받지 않기 위해서**다.
// (옛 코드는 `--commit` 일 때만 붙었고, 그래서 예행이 매번 같은 책을 다시 GET 했다.)
let db = null
try {
  for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  const { createClient } = await import('@supabase/supabase-js')
  db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
} catch (e) {
  if (COMMIT) throw e
  console.log(`  ⚠️ DB 에 못 붙었다(${String(e.message).slice(0, 40)}) — 보유 목록 없이 진행한다.`)
}

/**
 * 이미 조각을 뽑아 온 책 번호. **커서가 아니라 DB 가 정본이다.**
 *
 * ⚠️ PostgREST 는 기본 1,000행만 준다 — `range` 로 끝까지 읽지 않으면 잘린 만큼이
 *   매번 "새 책" 으로 보여 다시 GET 된다.
 */
async function booksInDb() {
  const ids = new Set()
  if (!db) return ids
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from('library_articles')
      .select('source_id')
      .eq('source', 'gutenberg')
      .range(from, from + 999)
    if (error) throw new Error('보유 목록 조회 실패: ' + error.message)
    for (const r of data ?? []) {
      const n = Number(String(r.source_id ?? '').split(':')[1])
      if (n) ids.add(n)
    }
    if (!data || data.length < 1000) break
  }
  return ids
}

// ── 책 목록 ──────────────────────────────────────────────────────────
fs.mkdirSync(DATA, { recursive: true })
/** 옛 형식 커서. 이제 읽기만 한다 — 여기 적힌 867권을 `seen` 으로 흡수한다. */
const legacy = fs.existsSync(LEGACY_CURSOR_FILE)
  ? JSON.parse(fs.readFileSync(LEGACY_CURSOR_FILE, 'utf8'))
  : { done: [], offset: {} }
const cursors = legacy
const done = new Set((legacy.done ?? []).map(String))

// ── 남은 카탈로그 실측 (--survey) ────────────────────────────────────
if (SURVEY) {
  const have = await booksInDb()
  const rows = await catalogRows()
  const rest = rows.filter((r) => !have.has(r.id))
  console.log(`  카탈로그 영어 도서 ${rows.length.toLocaleString()}권 · 이미 소비 ${have.size.toLocaleString()} · **남은 ${rest.length.toLocaleString()}권**\n`)
  console.log(`  ${'피드'.padEnd(8)}${'칸'.padEnd(11)}${'후보'.padStart(8)}${'비율'.padStart(8)}   LoCC`)
  console.log('  ' + '-'.repeat(74))
  const union = new Set()
  for (const [slug, f] of Object.entries(FEEDS)) {
    const pool = await catalogByLocc({ prefixes: f.prefixes, skip: have })
    for (const r of pool) union.add(r.id)
    console.log(
      `  ${slug.padEnd(8)}${f.bin.padEnd(11)}${pool.length.toLocaleString().padStart(8)}` +
        `${((pool.length / rest.length) * 100).toFixed(2).padStart(7)}%   ${f.prefixes.join(' ')}`,
    )
  }
  console.log('  ' + '-'.repeat(74))
  console.log(`  ${'합집합'.padEnd(19)}${union.size.toLocaleString().padStart(8)}${((union.size / rest.length) * 100).toFixed(2).padStart(7)}%`)
  console.log(`\n  ⚠️ 이것은 **후보 권수**이지 수확량이 아니다. 실제로 그 칸에 떨어지는 조각 비율은`)
  console.log(`     책을 받아 봐야 안다 — docs/reports/source-probe/gutenberg-remainder.md §2.`)
  process.exit(0)
}

const picked = []
/** 카탈로그 모드에서 이번 실행이 쓰는 커서(규약 형식). 검색 모드면 null. */
let cursor = null
let cursorFile = null

if (!SEARCH) {
  // ── 카탈로그 모드 (기본) ───────────────────────────────────────────
  const f = FEEDS[FEED]
  if (!f) {
    console.error(`알 수 없는 피드: ${FEED} — 쓸 수 있는 것: ${Object.keys(FEEDS).join(' · ')}`)
    process.exit(1)
  }
  cursorFile = harvestCursorPath('csat', 'gutenberg', `catalog-${FEED}`)
  cursor = fs.existsSync(cursorFile)
    ? readHarvestCursor(cursorFile, 'gutenberg', `catalog-${FEED}`)
    : emptyHarvestCursor('gutenberg', `catalog-${FEED}`)
  // 옛 커서의 `done` + DB 보유분을 **처음 한 번** 흡수한다. 둘 다 "이미 판정했다" 는 뜻이고,
  // 흡수하지 않으면 1,631권을 처음부터 다시 받는다.
  const have = await booksInDb()
  const seen = new Set([...cursor.seen.map(String), ...done, ...[...have].map(String)])
  // ⚠️ **`after` 로 자르지 않는다.** 책 번호로 창을 밀면 못 받은 책(상류 5xx)이 창 뒤로
  //   빠져 영영 안 돌아온다. 진행은 `seen` 차집합이 만든다 — 목록이 번호순이라 결과는
  //   같고, 실패한 책만 다음 실행에서 한 번 더 시도된다. `token` 은 어디까지 갔는지를
  //   사람이 읽기 위한 기록이다.
  const after = Number(cursor.token ?? 0) || 0
  const pool = await catalogByLocc({ prefixes: f.prefixes, skip: new Set([...seen].map(Number)) })
  for (const r of pool.slice(0, BOOKS)) picked.push({ id: String(r.id), slot: f.bin, q: `locc:${r.locc}`, title: r.title })
  cursor = { ...cursor, seen: [...seen] }
  console.log(
    `  피드 ${FEED}(${f.bin}) · 커서 ${path.relative(process.cwd(), cursorFile)} — ` +
      `판정 완료 ${seen.size.toLocaleString()}권 · 마지막 훑은 책 번호 ${after || '없음(처음)'}\n` +
      `  후보 ${pool.length.toLocaleString()}권 중 ${picked.length}권 고름` +
      (pool.length === 0 ? ' — **이 피드는 소진됐다**' : ''),
  )
  if (!picked.length) {
    if (COMMIT) writeHarvestCursor(cursorFile, { ...cursor, exhausted: true })
    console.log('  받을 책이 없다.')
    process.exit(0)
  }
  console.log('')
}

const flatQ = []
if (SEARCH && NARRATIVE) {
  // 소재 몫을 보지 않는다 — 겨냥하는 것이 소재가 아니라 글의 결이다.
  for (const q of NARRATIVE_QUERIES) flatQ.push({ slot: '서사', q })
  console.log(`  --narrative — 인물이 나오는 글만 남긴다(인물 대명사 비율 ≥ ${NARRATIVE_FLOOR}).`)
  console.log(`     그 문턱은 이미 만든 장문 지칭 39편의 실측 최솟값(0.0382)에서 왔다.
`)
} else if (SEARCH) {
  for (const [slot, qs] of Object.entries(QUERIES)) {
    if (!quota[slot]) continue
    for (const q of qs) flatQ.push({ slot, q })
  }
}
if (SEARCH && !flatQ.length) {
  console.log('  노릴 칸이 없다 — 모든 인문 칸의 몫이 찼다. 서사가 필요하면 --narrative.')
  process.exit(0)
}

const perQuery = Math.max(1, Math.ceil(BOOKS / Math.max(1, flatQ.length)))
for (const { slot, q } of flatQ) {
  if (picked.length >= BOOKS) break
  // ⚠️ 같은 질의를 다시 돌리면 같은 첫 쪽이 온다. 질의마다 시작 위치를 기억한다.
  const off = cursors.offset?.[q] ?? 1
  let html
  try {
    html = await get(`https://www.gutenberg.org/ebooks/search/?query=${encodeURIComponent(q)}&start_index=${off}`)
  } catch (e) {
    console.log(`  ❌ 목록 ${q} — ${e.message}`)
    continue
  }
  const ids = [...html.matchAll(/href="\/ebooks\/(\d+)"/g)].map((m) => m[1])
  let taken = 0
  for (const id of ids) {
    if (done.has(id) || picked.some((p) => p.id === id) || taken >= perQuery || picked.length >= BOOKS) continue
    picked.push({ id, slot, q })
    taken += 1
  }
  // ⚠️ **읽기 전용 실행은 커서를 건드리지 않는다.** 안 그러면 예행으로 훑은 질의가
  //   전진해 버려, 정작 `--commit` 으로 돌릴 때 그 쪽을 건너뛴다.
  if (COMMIT) {
    cursors.offset = cursors.offset ?? {}
    cursors.offset[q] = off + 25
  }
  await sleep(700)
}
if (SEARCH) console.log(`  질의 ${flatQ.length}개에서 ${picked.length}권 골랐다 (이미 처리한 ${done.size}권 제외)\n`)

// ── 수확 ─────────────────────────────────────────────────────────────
let chunksAll = 0
let droppedAll = 0
let narrativeDropped = 0
let fitAll = 0
let inserted = 0
let dup = 0
const byTopic = {}
const failures = []

console.log(`  ${'책'.padEnd(30)}${'조각'.padStart(7)}${'배제'.padStart(6)}${'적합'.padStart(6)}${'적재'.padStart(6)}  소재`)
console.log('  ' + '-'.repeat(74))

for (const b of picked) {
  if (inserted >= MAX) break
  let raw
  try {
    raw = await get(`https://www.gutenberg.org/cache/epub/${b.id}/pg${b.id}.txt`)
  } catch (e) {
    failures.push(`#${b.id} — ${e.message}`)
    // 못 받는 책도 커서에 적지 않는다 — 상류의 일시적 장애일 수 있고,
    // 영구 실패라면 다음 실행에서 한 번 더 실패할 뿐이다(비용이 작다).
    continue
  }
  const title = ((raw.match(/^Title:\s*(.+)$/m) ?? [])[1] ?? `#${b.id}`).trim()
  const author = ((raw.match(/^Author:\s*(.+)$/m) ?? [])[1] ?? '').trim() || null

  const all = chop(cleanBookText(stripBoilerplate(raw)))
  const kept = all.filter((c) => !looksLikeBookMatter(c))
  const rows = []
  const mine = {}
  let notNarrative = 0
  for (const text of kept) {
    const f = fitRecord(text)
    if (f.pass <= 0) continue
    // ⚠️ 서사를 겨냥해 책을 골라도 **조각은 대부분 설명문이다** — 서문·해설·목차 뒤에
    //   이야기가 온다. 여기서 거르지 않으면 겨냥한 뜻이 사라진다.
    if (NARRATIVE && !looksNarrative(text)) {
      notNarrative += 1
      continue
    }
    const tp = classify(text, { title })
    // ⚠️ 몫이 없는 칸도 **버리지 않는다** — 3단계 보관에는 쓰인다. 다만 세어만 둔다.
    mine[tp.topic] = (mine[tp.topic] ?? 0) + 1
    rows.push({
      source: 'gutenberg',
      source_id: `pg:${b.id}:${crypto.createHash('sha256').update(text).digest('hex').slice(0, 16)}`,
      title: `${title.slice(0, 90)}`,
      author,
      source_url: `https://www.gutenberg.org/ebooks/${b.id}`,
      published_at: null,
      license: 'Public Domain',
      content: text,
      status: 'queued',
      feed_id: 'harvest',
      feed_label: `Gutenberg 수확 · ${tp.topic}`,
      csat_fit: { ...f, topic: tp.topic, topicMargin: tp.margin, topicV: TOPIC_V },
    })
  }
  chunksAll += all.length
  droppedAll += all.length - kept.length
  fitAll += rows.length
  narrativeDropped += notNarrative
  for (const [k, v] of Object.entries(mine)) byTopic[k] = (byTopic[k] ?? 0) + v

  let wrote = 0
  if (COMMIT && rows.length) {
    const { data: exist, error: exErr } = await db
      .from('library_articles')
      .select('source_id')
      .eq('source', 'gutenberg')
      .in('source_id', rows.map((r) => r.source_id))
    if (exErr) {
      failures.push(`#${b.id} 중복 확인 — ${exErr.message}`)
    } else {
      // ⚠️ **한 책 안에서도 같은 조각이 두 번 나온다.** `source_id` 가 본문 해시라
      //   같은 문단 묶음이 반복되면 열쇠가 겹치고, DB 조회는 「아직 없음」이라 답한다
      //   (아직 없으니까). 그러면 같은 batch 안에서 unique 제약에 걸려 **그 책의 적재가
      //   통째로 중단된다** — 실측 2026-09-07: #18 『The Federalist Papers』 936편 중
      //   41편이 그렇게 날아갔다. 그러니 DB 대조 **전에** 배치 안에서 먼저 접는다.
      const have = new Set((exist ?? []).map((r) => r.source_id))
      const inBatch = new Set()
      const fresh = rows.filter((r) => {
        if (have.has(r.source_id) || inBatch.has(r.source_id)) return false
        inBatch.add(r.source_id)
        return true
      })
      dup += rows.length - fresh.length
      for (let i = 0; i < fresh.length; i += 200) {
        const { error } = await db.from('library_articles').insert(fresh.slice(i, i + 200))
        if (error) { failures.push(`#${b.id} 적재 — ${error.message}`); break }
        wrote += Math.min(200, fresh.length - i)
      }
      inserted += wrote
    }
  }
  // ⚠️ **실제로 끝난 책만 처리 완료로 적는다.**
  //
  //   첫 판은 예행에서도 적었다. 두 번째 판은 예행은 막았지만 **적재가 실패해도** 적었고,
  //   그래서 CHECK 제약에 걸려 0편이 들어간 12권이 전부 "처리 완료" 가 됐다.
  //   둘 다 오류 없이 조용히 책을 잃는 종류의 손실이다.
  //
  //   끝났다고 말할 수 있는 경우는 둘뿐이다: 적합분을 실제로 적재했거나,
  //   적합분이 애초에 없었거나. (CLAUDE.md §🤖: "몇 번 돌려도 결과가 같아야 한다")
  const settled = rows.length === 0 || wrote > 0
  if (COMMIT && settled) {
    if (cursor) {
      // 규약 커서 — **판정한 뒤에** 쓴다. `token` 은 여기까지 훑은 책 번호(오름차순 좌표),
      // `seen` 은 적재분과 「적합 0」 둘 다 담는다(안 그러면 빈 책을 영원히 다시 받는다).
      cursor = { ...cursor, token: String(b.id), seen: [...new Set([...cursor.seen, String(b.id)])] }
      writeHarvestCursor(cursorFile, cursor)
    } else {
      done.add(b.id)
      cursors.done = [...done]
      fs.writeFileSync(LEGACY_CURSOR_FILE, JSON.stringify(cursors, null, 2))
    }
  }

  const top = Object.entries(mine).sort((a, c) => c[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${v}`).join(' · ')
  console.log(
    `  ${title.slice(0, 29).padEnd(30)}${String(all.length).padStart(7)}${String(all.length - kept.length).padStart(6)}` +
      `${String(rows.length).padStart(6)}${String(wrote).padStart(6)}  ${top}`,
  )
  await sleep(600)
}

console.log('  ' + '-'.repeat(74))
console.log(`  조각 ${chunksAll.toLocaleString()} · 배제 ${droppedAll.toLocaleString()} · 적합 ${fitAll.toLocaleString()} (${chunksAll ? ((fitAll / chunksAll) * 100).toFixed(1) : 0}%)`)
if (NARRATIVE) {
  console.log(`  서사가 아니어서 버린 조각 ${narrativeDropped.toLocaleString()} — 인물 대명사 비율 < ${NARRATIVE_FLOOR}`)
}
if (COMMIT) console.log(`  중복 ${dup.toLocaleString()} · **적재 ${inserted.toLocaleString()}편**`)
console.log(`  소재: ${Object.entries(byTopic).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ') || '없음'}`)
const bottleneck = ['예술·문화', '역사·인류', '철학·윤리'].reduce((s, k) => s + (byTopic[k] ?? 0), 0)
console.log(`  그중 병목 3칸 **${bottleneck.toLocaleString()}편**${picked.length ? ` (권당 ${(bottleneck / picked.length).toFixed(1)})` : ''}`)
if (failures.length) {
  console.log(`\n  ⚠️ 실패 ${failures.length}건`)
  for (const f of failures.slice(0, 5)) console.log(`    · ${f}`)
}
if (COMMIT && inserted > 0) {
  console.log(`\n  다음 수확 전에 재고를 다시 잰다:`)
  console.log(`    node scripts/csat/topic-gap.mjs --out docs/reports/topic-gap.json`)
}
