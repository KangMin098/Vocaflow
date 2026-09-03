// scripts/csat/harvest-plos.mjs
//
// **적재하기 전에 채점한다 — 통과한 것만 넣는다.**
//
// ── 지금 경로가 왜 부족한가 ─────────────────────────────────────────
// 지금은 「목록을 받아 → 글마다 HTML 을 다시 GET → 적재 → 나중에 채점」이다. 그래서
//   ① 적재한 것의 **42%가 채점에서 떨어진다**(재고 24,870 중 적합 14,252) — 버릴 것을 담느라
//      DB 를 쓰고, 그 42%가 "재고" 로 세어져 남는다
//   ② 소재를 안 보고 담아 **기술·매체 배율이 3.18 까지 부풀었다**(`topic-gap.mjs` 실측)
//   ③ 글마다 HTML GET 이라 5만 편이면 GET 5만 번이다
//
// 셋 다 같은 자리에서 풀린다. **PLOS Solr 가 `fl=body` 로 본문 전문을 목록 응답에 준다**
// (실측 2026-09-03: 1건 30,429자 · `numFound` 399,344). 한 요청에 50편씩 본문째로 오므로
// **받은 자리에서 채점·분류하고, 통과한 것만 적재**할 수 있다. 그게 이 파일이다.
//
// ── 「적합도 100%」 의 조작적 의미 ───────────────────────────────────
// 적재되는 모든 행이 `csat_fit.pass > 0` 이고, 소재 몫이 남은 칸에만 들어간다.
// 즉 **적재 후 채점률 100% · 배합 준수 100%** 다. 이건 자가 좋아졌다는 뜻이 아니라
// **버릴 것을 담지 않는다**는 뜻이다 — 자는 `lib-fit.mjs` 로 재고 채점과 동일하다.
//
// ── 소재를 겨냥해 가져온다 (기출 근거) ───────────────────────────────
// `subject_facet` 이 열려 있어(실측: Social sciences 103,950 · Psychology 70,780 ·
// Neuroscience 70,207) **부족한 칸을 직접 질의**할 수 있다. 무엇이 부족한지는 기출 배합
// (`topic-distribution.json`, 회차×소재 독립 p=0.26 → 고정 배합)에서 온다.
//
// ⚠️ **PLOS 가 못 채우는 칸이 있다** — 예술·문화 · 철학·윤리 · 역사·인류 · 교육·언어.
//   그 넷은 여기서 안 나온다. 이 스크립트가 「목표 달성」을 말하지 않는 이유다
//   (`docs/reports/csat-source-fit-20260903.md` §7·§9).
//
// 재실행 안전:
//   · 기본은 **읽기 전용**(`--commit` 없이는 아무것도 쓰지 않는다)
//   · `source_id` 로 DB 와 대조해 이미 있는 것은 건너뛴다 — 몇 번 돌려도 중복이 안 생긴다
//   · cursorMark 를 `data/plos-harvest-cursor.json` 에 남겨 다음 실행이 이어서 훑는다.
//     ⚠️ 커서는 **최적화일 뿐 안전장치가 아니다** — 커서 파일을 지워도 dedup 이 막는다
//
// 실행:
//   node scripts/csat/harvest-plos.mjs                          # 계획만 낸다(읽기 전용)
//   node scripts/csat/harvest-plos.mjs --slot 심리·인지 --pages 4
//   node scripts/csat/harvest-plos.mjs --slot 심리·인지 --pages 40 --commit
//   node scripts/csat/harvest-plos.mjs --stage 3 --plan           # 3단계 5만 기준 몫 계산

import fs from 'node:fs'
import path from 'node:path'

import { fitRecord, scoreArticle } from './lib-fit.mjs'
import { classify, TOPIC_KEYS } from './lib-topic.mjs'

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const COMMIT = process.argv.includes('--commit')
const PLAN_ONLY = process.argv.includes('--plan')
const SLOT = arg('slot')
const PAGES = Number(arg('pages') ?? 2)
const ROWS = Math.min(50, Number(arg('rows') ?? 50))
const STAGE = Number(arg('stage') ?? 3)
const STAGE_GOAL = { 1: 10000, 2: 30000, 3: 50000 }[STAGE] ?? 50000

const DATA = path.resolve('scripts/csat/data')
const CURSOR_FILE = path.join(DATA, 'plos-harvest-cursor.json')

/**
 * 우리 소재 칸 → PLOS `subject_facet` 질의.
 *
 * ⚠️ 이 표는 **PLOS 가 실제로 가진 것**(facet 실측 2026-09-03)에서 왔지, 소재 칸의 정의에서
 *   오지 않았다. 그래서 빈 칸이 있다 — 예술·문화 · 철학·윤리 · 역사·인류 · 교육·언어는
 *   PLOS 에 대응하는 주제가 없다. **없는 것을 있는 척 매핑하지 않는다.**
 */
const SUBJECT_QUERY = {
  '과학·자연': ['Biology and life sciences', 'Physical sciences', 'Ecology and environmental sciences', 'Earth sciences'],
  '심리·인지': ['Psychology', 'Neuroscience'],
  '사회·경제': ['Social sciences', 'Economics'],
  '기술·매체': ['Engineering and technology', 'Computer and information sciences'],
}

const SOLR = 'https://api.plos.org/search'
const UA = 'Vocaflow/1.0 (+https://vocaflow.app; CSAT source harvest)'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function solr(params) {
  const u = new URL(SOLR)
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v)
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), 40000)
  try {
    const r = await fetch(u, { headers: { 'User-Agent': UA }, signal: c.signal })
    if (!r.ok) throw new Error(`solr ${r.status}`)
    return JSON.parse(await r.text())
  } finally {
    clearTimeout(t)
  }
}

/**
 * Solr `body` → 지문이 될 수 있는 산문.
 *
 * body 는 이미 평문이지만 **논문 뒤꼬리가 붙어 온다** — 참고문헌·사사·저자기여·자료공개.
 * 창 게이트(`looksLikeProse`)가 서지 블록은 걸러 내지만, 그건 창 하나씩 거르는 것이라
 * **뒤꼬리를 통째로 남겨 두면 창 탐색이 헛돈다.** 여기서 먼저 자른다.
 *
 * ⚠️ 자르는 위치를 문서 앞쪽에서 찾으면 안 된다 — 본문 중간에 "Acknowledgments" 를 인용한
 *   글이 있으면 본문이 통째로 날아간다. **뒷 40% 안에서 나온 첫 표식**만 자른다.
 */
export function cleanBody(body) {
  let s = String(body).replace(/\r/g, '')
  const TAIL = /\b(References|Supporting information|Acknowledg(?:e)?ments|Author Contributions|Competing interests|Data Availability)\b/g
  const floor = Math.floor(s.length * 0.6)
  let cut = -1
  for (const m of s.matchAll(TAIL)) {
    if (m.index >= floor) {
      cut = m.index
      break
    }
  }
  if (cut > 0) s = s.slice(0, cut)
  return s.replace(/[ \t]+/g, ' ').trim()
}

// ── 목표 배합 (기출) ─────────────────────────────────────────────────
const dist = JSON.parse(fs.readFileSync(path.join(DATA, 'topic-distribution.json'), 'utf8'))
const TARGET_KEYS = TOPIC_KEYS.filter((k) => k !== '분류불가')
const denom = TARGET_KEYS.reduce((s, k) => s + (dist.total[k] ?? 0), 0)
const share = Object.fromEntries(TARGET_KEYS.map((k) => [k, (dist.total[k] ?? 0) / denom]))

// ── 현재 소재별 재고 (topic-gap 리포트) ──────────────────────────────
const gapFile = path.resolve('docs/reports/topic-gap.json')
if (!fs.existsSync(gapFile)) {
  console.error('소재별 재고를 모른다 — 먼저 돌릴 것: node scripts/csat/topic-gap.mjs --out docs/reports/topic-gap.json')
  process.exit(1)
}
const gap = JSON.parse(fs.readFileSync(gapFile, 'utf8'))
const stock = Object.fromEntries(gap.rows.map((r) => [r.topic, r.estStock]))

console.log(`PLOS 겨냥 수확 — 적재 전에 채점한다\n${'='.repeat(78)}`)
console.log(`  목표 ${STAGE}단계 ${STAGE_GOAL.toLocaleString()}편 · 배합 기출 ${gap.examClassified}지문 · 재고 ${gap.measuredAt.slice(0, 10)} 실측\n`)
console.log(`  ${'소재'.padEnd(11)}${'목표'.padStart(8)}${'재고'.padStart(8)}${'부족'.padStart(8)}   PLOS 주제`)
console.log('  ' + '-'.repeat(74))
const quota = {}
for (const k of TARGET_KEYS) {
  const want = Math.round(STAGE_GOAL * share[k])
  const have = stock[k] ?? 0
  const need = Math.max(0, want - have)
  quota[k] = need
  const subj = SUBJECT_QUERY[k]
  console.log(
    `  ${k.padEnd(11)}${want.toLocaleString().padStart(8)}${have.toLocaleString().padStart(8)}` +
      `${need.toLocaleString().padStart(8)}   ${subj ? subj.join(' · ').slice(0, 44) : '— PLOS 에 없다'}`,
  )
}
const plosCovered = TARGET_KEYS.filter((k) => SUBJECT_QUERY[k]).reduce((s, k) => s + quota[k], 0)
const plosMissing = TARGET_KEYS.filter((k) => !SUBJECT_QUERY[k]).reduce((s, k) => s + quota[k], 0)
console.log('  ' + '-'.repeat(74))
console.log(`  PLOS 로 채울 수 있는 몫 **${plosCovered.toLocaleString()}편** · 다른 소스가 필요한 몫 **${plosMissing.toLocaleString()}편**`)
console.log(`  ⚠️ 뒤의 ${plosMissing.toLocaleString()}편은 이 스크립트가 못 만든다 — 목표 달성을 여기서 말하지 않는 이유다.\n`)

if (PLAN_ONLY || !SLOT) {
  if (!SLOT) console.log('  칸을 지정해 수확한다: --slot "심리·인지" --pages 4 [--commit]')
  process.exit(0)
}

if (!SUBJECT_QUERY[SLOT]) {
  console.error(`"${SLOT}" 은 PLOS 로 못 채운다. 가능한 칸: ${Object.keys(SUBJECT_QUERY).join(' · ')}`)
  process.exit(1)
}
if (quota[SLOT] <= 0) {
  console.log(`  ${SLOT} 은 이미 ${STAGE}단계 몫을 채웠다 — 더 담으면 배합이 깨진다. 중단.`)
  process.exit(0)
}

// ── DB (적재·중복 확인용) ────────────────────────────────────────────
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

const cursors = fs.existsSync(CURSOR_FILE) ? JSON.parse(fs.readFileSync(CURSOR_FILE, 'utf8')) : {}

/**
 * 지문이 될 수 없는 유형은 **질의에서 뺀다** — 받아서 버리면 그만큼 헛돈다.
 * (실측 2026-09-03, Psychology∪Neuroscience 97,790편의 유형 분포: research article 93,750 ·
 *  study protocol 1,099 · synopsis 300 · issue image 243 · editorial 252 …)
 */
const EXCLUDE_TYPES = [
  'Correction', 'Issue Image', 'Editorial', 'Correspondence', 'Formal Comment',
  'Message from ISCB', 'Book Review/Science in the Media', 'Retraction',
  'Expression of Concern', 'Lab Protocol', 'Software', 'Symposium',
]
const fq =
  `doc_type:full AND subject_facet:(${SUBJECT_QUERY[SLOT].map((s) => `"${s}"`).join(' OR ')})` +
  EXCLUDE_TYPES.map((t) => ` AND !article_type:"${t}"`).join('')

console.log(`  ${SLOT} 수확 — ${PAGES}쪽 × ${ROWS}편${COMMIT ? ' · **적재한다**' : ' (읽기 전용)'}`)
console.log(`  주제: ${SUBJECT_QUERY[SLOT].join(' OR ')}\n`)

let cursor = cursors[SLOT] ?? '*'
let seen = 0
let fitOk = 0
let slotOk = 0
let dup = 0
let inserted = 0
const spill = {}
/** 소재별로 이번 실행에서 받아들인 수 — 몫을 넘지 않게 막는다. */
const accepted = {}
/** 몫이 이미 차서 되돌려보낸 수 — 이 값이 크면 다른 칸을 질의할 때다. */
const full = {}
const failures = []
const samples = []

for (let p = 0; p < PAGES; p++) {
  const res = await solr({
    q: '*:*',
    fq,
    fl: 'id,title_display,journal,article_type,publication_date,body',
    rows: String(ROWS),
    wt: 'json',
    // ⚠️ **`id asc` 로 정렬하면 안 된다.** cursorMark 는 유일 정렬키만 요구하므로 `id asc` 가
    //   되기는 하는데, PLOS 의 id 는 DOI 라 오름차순 머리에 `10.1371/annotation/…` 과
    //   issue image 가 몰린다. 실측 2026-09-03: 그렇게 200편을 훑어 **적합 2.5%**(표본 제목이
    //   "PLoS Computational Biology Issue Image")였다. 발행일 내림차순으로 바꾸자 **70%**.
    //   유일성은 `id desc` 를 덧붙여 확보한다.
    sort: 'publication_date desc,id desc',
    cursorMark: cursor,
  })
  const docs = res.response?.docs ?? []
  const next = res.nextCursorMark
  if (p === 0) console.log(`  상류 총량 ${(res.response?.numFound ?? 0).toLocaleString()}편\n`)
  if (docs.length === 0) break

  // 이 쪽에서 통과한 것만 모아 한 번에 중복 확인·적재한다 — 편마다 왕복하면 5만 편에서 죽는다.
  const passed = []
  for (const d of docs) {
    seen++
    if (!d.body || !d.id) continue
    const text = cleanBody(Array.isArray(d.body) ? d.body.join('\n') : d.body)
    if (text.length < 800) continue
    const sc = scoreArticle(text)
    if (sc.pass <= 0) continue
    fitOk++
    const tp = classify(text.slice(0, 6000))
    // ⚠️ 질의한 칸으로 안 떨어진 글을 **버리지 않는다.** 실측 2026-09-03: Psychology 질의
    //   200편 중 적합 125편인데 그중 심리·인지 판정은 45편뿐이고, 나머지 80편도 전부 적합한
    //   글이다(기술·매체 31 · 과학·자연 26 · 교육·언어 10 …). 버리면 순 수율이 62.5% → 22.5%
    //   로 떨어진다. **자기 칸에 몫이 남아 있으면 담는다** — 배합은 그래도 안 깨진다.
    if (tp.topic === SLOT) slotOk++
    else spill[tp.topic] = (spill[tp.topic] ?? 0) + 1
    const room = (quota[tp.topic] ?? 0) - (accepted[tp.topic] ?? 0)
    if (room <= 0) {
      full[tp.topic] = (full[tp.topic] ?? 0) + 1
      continue
    }
    accepted[tp.topic] = (accepted[tp.topic] ?? 0) + 1
    const title = String(d.title_display ?? '').replace(/<[^>]+>/g, '').trim()
    if (samples.length < 6) samples.push({ title: title.slice(0, 62), pass: sc.pass, words: text.split(/\s+/).length })
    passed.push({
      source: 'plos',
      source_id: `plos:${d.id}`,
      title,
      author: null,
      source_url: `https://journals.plos.org/plosone/article?id=${d.id}`,
      published_at: d.publication_date ?? null,
      license: 'CC BY 4.0',
      content: text,
      status: 'queued',
      feed_id: 'harvest',
      feed_label: `겨냥 수확 · ${tp.topic}`,
      csat_fit: fitRecord(text),
      // 적재 직전에 떼어 낸다 — 컬럼이 아니다. 중복으로 안 들어간 글의 몫을 돌려주는 데 쓴다.
      _topic: tp.topic,
    })
  }

  if (COMMIT && passed.length) {
    const ids = passed.map((r) => r.source_id)
    const { data: existing, error: exErr } = await db
      .from('library_articles')
      .select('source_id')
      .eq('source', 'plos')
      .in('source_id', ids)
    if (exErr) {
      failures.push(`중복 확인 실패: ${exErr.message}`)
    } else {
      const have = new Set((existing ?? []).map((r) => r.source_id))
      const fresh = []
      for (const r of passed) {
        if (have.has(r.source_id)) {
          dup++
          // ⚠️ 몫을 **돌려준다.** 훑는 자리에서 `accepted` 를 올렸는데 중복이라 안 들어갔으면,
          //   돌려주지 않는 한 그 칸이 실제보다 찬 것으로 세어져 **몫이 영영 안 찬다.**
          accepted[r._topic] = (accepted[r._topic] ?? 1) - 1
          continue
        }
        fresh.push(r)
      }
      const toWrite = fresh.map(({ _topic, ...row }) => row)
      if (toWrite.length) {
        const { error } = await db.from('library_articles').insert(toWrite)
        if (error) {
          failures.push(`적재 실패: ${error.message}`)
          for (const r of fresh) accepted[r._topic] = (accepted[r._topic] ?? 1) - 1
        } else inserted += toWrite.length
      }
    }
  }

  const room = Object.keys(quota).reduce((s, k) => s + Math.max(0, quota[k] - (accepted[k] ?? 0)), 0)
  if (room <= 0) {
    console.log(`  모든 칸의 몫을 채웠다 — 중단.`)
    cursor = next
    break
  }
  cursor = next
  if (!next || next === cursors[SLOT]) break
  const took = Object.values(accepted).reduce((a, b) => a + b, 0)
  process.stderr.write(`\r  ${p + 1}/${PAGES}쪽 · 훑음 ${seen} · 적합 ${fitOk} · 받음 ${took}${COMMIT ? ` · 적재 ${inserted}` : ''}   `)
  await sleep(600)
}
process.stderr.write('\r' + ' '.repeat(76) + '\r')

if (COMMIT) {
  cursors[SLOT] = cursor
  fs.writeFileSync(CURSOR_FILE, JSON.stringify(cursors, null, 1))
}

const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1) : '0.0')
console.log(`  훑음 ${seen.toLocaleString()}편`)
console.log(`  모양·담화 적합 ${fitOk.toLocaleString()} (${pct(fitOk, seen)}%)`)
console.log(`  그중 질의한 칸(${SLOT}) 판정 ${slotOk.toLocaleString()} (${pct(slotOk, fitOk)}%)`)
if (Object.keys(spill).length) {
  console.log(
    `  다른 칸으로 샌 것: ` +
      Object.entries(spill).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · '),
  )
}
const took = Object.values(accepted).reduce((a, b) => a + b, 0)
console.log(`\n  ${'받아들인 소재'.padEnd(13)}${'편수'.padStart(6)}${'몫'.padStart(8)}`)
console.log('  ' + '-'.repeat(30))
for (const [k, v] of Object.entries(accepted).sort((a, b) => b[1] - a[1])) {
  if (!v) continue
  console.log(`  ${k.padEnd(13)}${String(v).padStart(6)}${quota[k].toLocaleString().padStart(8)}`)
}
if (Object.keys(full).length) {
  console.log(
    `  몫이 차서 돌려보낸 것: ` +
      Object.entries(full).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · '),
  )
}
console.log(`  **순 수율 ${took.toLocaleString()}/${seen.toLocaleString()} = ${pct(took, seen)}%** (적합률 ${pct(fitOk, seen)}% × 몫 여유)`)
if (COMMIT) {
  console.log(`  중복(이미 있음) ${dup.toLocaleString()} · **적재 ${inserted.toLocaleString()}편**`)
} else {
  console.log(`  → 적재 가능 ${took.toLocaleString()}편 (읽기 전용 — --commit 을 붙이면 쓴다)`)
}
if (samples.length) {
  console.log(`\n  표본:`)
  for (const s of samples) console.log(`    창 ${String(s.pass).padStart(2)} · ${String(s.words).padStart(5)}어  ${s.title}`)
}
if (failures.length) {
  console.log(`\n  실패 ${failures.length}:`)
  for (const f of failures.slice(0, 5)) console.log('    · ' + f)
}
if (COMMIT && inserted > 0) {
  console.log(
    `\n  ⚠️ 몫의 기준이 된 재고 수치는 ${gap.measuredAt.slice(0, 10)} 표본 추정이다. ` +
      `이번에 ${inserted.toLocaleString()}편을 넣었으므로\n` +
      `     다음 수확 전에 다시 재야 몫이 어긋나지 않는다:\n` +
      `       node scripts/csat/topic-gap.mjs --sample 3000 --out docs/reports/topic-gap.json`,
  )
}
