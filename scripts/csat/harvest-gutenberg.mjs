// scripts/csat/harvest-gutenberg.mjs
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
//   node scripts/csat/harvest-gutenberg.mjs --plan
//   node scripts/csat/harvest-gutenberg.mjs --books 20            # 읽기 전용
//   node scripts/csat/harvest-gutenberg.mjs --books 20 --commit

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fitRecord } from './lib-fit.mjs'
import { classify, TOPIC_KEYS } from './lib-topic.mjs'
import { cleanBookText, looksLikeBookMatter } from './lib-clean.mjs'
import { looksNarrative, peopleRatio, NARRATIVE_FLOOR } from './lib-narrative.mjs'

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
const DATA = path.resolve('scripts/csat/data')
const CURSOR_FILE = path.join(DATA, 'gutenberg-cursor.json')
const STAGE_GOAL = { 1: 10000, 2: 30000, 3: 50000 }[STAGE] ?? 30000
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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
const NARRATIVE_QUERIES = [
  'short stories', 'folk tales', 'fairy tales', 'fables',
  'adventure stories', 'sketches', 'memoirs', 'letters',
  'biography', 'childrens stories',
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

// ── 책 목록 ──────────────────────────────────────────────────────────
fs.mkdirSync(DATA, { recursive: true })
const cursors = fs.existsSync(CURSOR_FILE) ? JSON.parse(fs.readFileSync(CURSOR_FILE, 'utf8')) : { done: [], offset: {} }
const done = new Set(cursors.done ?? [])

const flatQ = []
if (NARRATIVE) {
  // 소재 몫을 보지 않는다 — 겨냥하는 것이 소재가 아니라 글의 결이다.
  for (const q of NARRATIVE_QUERIES) flatQ.push({ slot: '서사', q })
  console.log(`  --narrative — 인물이 나오는 글만 남긴다(인물 대명사 비율 ≥ ${NARRATIVE_FLOOR}).`)
  console.log(`     그 문턱은 이미 만든 장문 지칭 39편의 실측 최솟값(0.0382)에서 왔다.
`)
} else {
  for (const [slot, qs] of Object.entries(QUERIES)) {
    if (!quota[slot]) continue
    for (const q of qs) flatQ.push({ slot, q })
  }
}
if (!flatQ.length) {
  console.log('  노릴 칸이 없다 — 모든 인문 칸의 몫이 찼다. 서사가 필요하면 --narrative.')
  process.exit(0)
}

const picked = []
const perQuery = Math.max(1, Math.ceil(BOOKS / flatQ.length))
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
console.log(`  질의 ${flatQ.length}개에서 ${picked.length}권 골랐다 (이미 처리한 ${done.size}권 제외)\n`)

// ── DB ───────────────────────────────────────────────────────────────
let db = null
if (COMMIT) {
  for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  const { createClient } = await import('@supabase/supabase-js')
  db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
}

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
    const tp = classify(text)
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
      csat_fit: { ...f, topic: tp.topic, topicMargin: tp.margin, topicV: 1 },
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
      const have = new Set((exist ?? []).map((r) => r.source_id))
      const fresh = rows.filter((r) => !have.has(r.source_id))
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
    done.add(b.id)
    cursors.done = [...done]
    fs.writeFileSync(CURSOR_FILE, JSON.stringify(cursors, null, 2))
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
