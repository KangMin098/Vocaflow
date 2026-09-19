// scripts/csat/harvest-worldbank.mjs
//
// **World Bank OKR 겨냥 수확 — 사회·경제 칸을 채운다.**
//
// @harvest-source: worldbank   ← 등록부 검사(`harvest-cursor-contract.test.ts`)가 읽는다
//
// ── 왜 이 소스, 왜 이 칸 (실측 2026-09-07) ───────────────────────────
// 분류기(`lib-topic.mjs`)를 고친 뒤 다시 잰 소재 칸에서 **사회·경제 배율 0.686**(재고
// 12.59% vs 기출 18.35%)이 두 번째로 빈 칸이었다(`docs/reports/topic-gap.json`).
// 개발경제·사회과학을 대량으로 주면서 **변형이 허용되는** 곳은 정찰 25갈래 중 여기 하나다 —
// Pew·Brookings·RAND·World Bank **Blogs** 는 전부 저작권 유보다
// (`docs/reports/source-probe/policy-institutes.md` §1).
//
// ── `harvest-plos.mjs` 와 같은 골격, 다른 두 가지 ────────────────────
// 같은 것: **적재하기 전에 채점한다**(`lib-fit.mjs`) · 몫이 남은 칸에만 담는다 ·
//   `--commit` 없이는 아무것도 안 쓴다 · `source_id` 로 중복을 막는다.
// 다른 것:
//   ① **라이선스를 내려받기 전에 항목별로 거른다** — `dc:rights` 가 OAI 응답에 온다.
//      PLOS 는 전량 CC BY 라 이 단계가 없었다. 여기는 표본 100건 중 **NC 30 · ND 4** 다.
//   ② **본문이 「선형 읽기 순서」가 아니다** — 두 단 교차 초록 · 쪽 중간 각주 · 러닝헤더.
//      그래서 글 하나를 통째로 담지 않고 **연속 산문 런**(쪽 단위)으로 잘라 담는다.
//      상세 근거는 `packages/library-pipeline/src/ingest-article/world-bank-okr.ts` 머리.
//
// ── ⚠️ 두 가지 잠금장치가 아직 안 열렸다 ─────────────────────────────
//   **(1) DB 제약** — `library_articles_source_check` 에 `'worldbank'` 가 없다.
//        마이그레이션이 필요하고, 이 저장소 규칙상 **SQL 만 보이고 적용하지 않는다.**
//        제약이 열리기 전에 `--commit` 을 주면 23514 로 **한 행도 안 들어간다**(조용히
//        0건이 아니라 오류로 죽는다 — 그게 옳다).
//   **(2) robots.txt** — `openknowledge.worldbank.org/robots.txt` 는 `User-agent: *` 아래
//        `Disallow: /server/oai/` 와 `Crawl-delay: 10` 을 둔다(DSpace 기본값 그대로.
//        AI 크롤러 지목 차단·Content-Signal 은 없다). 정찰 리포트가 이 줄을 적지 않았다.
//        수확기는 신원을 밝히고 기본 간격을 **10초**로 두지만, **넘을지 말지는 사용자 결정**이다.
//        `--commit` 은 사람이 직접 붙인다 — 자동화하지 않는다.
//
// ── 재실행 안전 ──────────────────────────────────────────────────────
//   · 기본은 읽기 전용. `--commit` 없이는 DB 에도 커서에도 쓰지 않는다.
//   · 커서는 **한 페이지를 판정한 뒤에** 쓴다 — 중간에 죽으면 그 페이지를 다시 본다.
//   · `seen` 에 **거절한 handle 도 적는다** — 다시 GET 하지 않기 위해서다.
//   · `source_id` 로 DB 와 대조한다 — 커서 파일을 지워도 중복이 안 생긴다.
//
// 실행:
//   pnpm dlx tsx scripts/csat/harvest-worldbank.mjs --plan
//   pnpm dlx tsx scripts/csat/harvest-worldbank.mjs --pages 2 --max 20          # 읽기 전용
//   pnpm dlx tsx scripts/csat/harvest-worldbank.mjs --probe 10986/6318 10986/7287
//   pnpm dlx tsx scripts/csat/harvest-worldbank.mjs --pages 20 --max 300 --commit

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const argList = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  if (i < 0) return []
  const out = []
  for (let j = i + 1; j < process.argv.length && !process.argv[j].startsWith('--'); j++) out.push(process.argv[j])
  return out
}

const COMMIT = process.argv.includes('--commit')
const PLAN_ONLY = process.argv.includes('--plan')
const FRESH = process.argv.includes('--fresh')
const FEED = arg('feed') ?? 'working-paper'
const PAGES = Number(arg('pages') ?? 2)
const MAX = Number(arg('max') ?? 40)
/** 문서 하나에서 담을 런 상한. 보고서 한 건이 칸을 독차지하지 않게 한다. */
const PER_DOC = Number(arg('per-doc') ?? 3)
/** robots.txt `Crawl-delay: 10` 준수가 기본값이다. 줄이려면 근거를 갖고 명시할 것. */
const DELAY = Number(arg('delay') ?? 10000)
const FROM = arg('from')
const STAGE = Number(arg('stage') ?? 3)
const STAGE_GOAL = { 1: 10000, 2: 30000, 3: 50000 }[STAGE] ?? 50000
const PROBE = argList('probe')

const { scoreArticle, fitRecord } = await import(pathToFileURL(path.resolve('scripts/csat/lib-fit.mjs')).href)
const { classify, TOPIC_KEYS, TOPIC_V } = await import(pathToFileURL(path.resolve('scripts/csat/lib-topic.mjs')).href)
const {
  listWorldBankFeedPage,
  fetchWorldBankText,
  originalTextBitstream,
  proseRuns,
  runSourceKey,
  harvestCursorPath,
  readHarvestCursor,
  writeHarvestCursor,
  emptyHarvestCursor,
} = await import('../../packages/library-pipeline/src/index.ts')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1) : '0.0')

// ── 표본 정찰 모드 — `.txt` 품질만 본다 (DB·커서를 건드리지 않는다) ────
if (PROBE.length) {
  console.log(`OKR 평문 정찰 — ${PROBE.length}건 (읽기 전용 · 간격 ${DELAY / 1000}초)\n${'='.repeat(78)}`)
  for (const handle of PROBE) {
    // 개별 조회는 GetRecord 가 싸다 — 목록을 다 훑지 않는다.
    const xml = await (
      await fetch(
        `https://openknowledge.worldbank.org/server/oai/request?verb=GetRecord&metadataPrefix=xoai&identifier=oai:openknowledge.worldbank.org:${handle}`,
        { headers: { 'User-Agent': 'Vocaflow/1.0 (https://vocaflow.app; hello@vocaflow.app) library-pipeline' } },
      )
    ).text()
    const record = xml.match(/<record>[\s\S]*<\/record>/)?.[0] ?? xml
    const bits = originalTextBitstream(record)
    if (!bits) {
      console.log(`  ${handle} — ORIGINAL 번들에 .txt 없음 (PDF 를 받지 않는다)`)
      continue
    }
    const raw = await fetchWorldBankText(bits.url)
    const total = (raw.match(/[A-Za-z][A-Za-z'-]*/g) ?? []).length
    const runs = proseRuns(raw)
    const scored = runs.map((r) => ({ ...r, ...scoreArticle(r.text) })).filter((r) => r.pass > 0)
    const kept = scored.reduce((s, r) => s + r.words, 0)
    console.log(
      `  ${handle.padEnd(14)} 원문 ${String(total).padStart(7)}어 · 런 ${String(runs.length).padStart(4)} · ` +
        `pass런 ${String(scored.length).padStart(3)} · 채택 ${String(kept).padStart(6)}어 (${pct(kept, total)}%)`,
    )
    const best = scored.sort((a, b) => b.pass - a.pass || b.words - a.words)[0]
    if (best) console.log(`     최상 p${best.page} ${best.words}어: ${best.text.slice(0, 150)}…`)
    await sleep(DELAY)
  }
  process.exit(0)
}

// ── 몫 (기출 배합 × 재고) — `harvest-plos.mjs` 와 같은 계산을 쓴다 ────
const DATA = path.resolve('scripts/csat/data')
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
const ratioBefore = Object.fromEntries(gap.rows.map((r) => [r.topic, r.ratio]))

/**
 * OKR 이 실제로 채우는 칸. **없는 것을 있는 척 매핑하지 않는다** —
 * 개발기관 보고서에서 예술·문화나 철학·윤리가 나올 리 없고, 나온다면 오분류다.
 */
const OKR_SLOTS = ['사회·경제', '교육·언어', '과학·자연', '기술·매체', '역사·인류', '심리·인지']

const quota = {}
console.log(`World Bank OKR 겨냥 수확 — 적재 전에 채점한다\n${'='.repeat(78)}`)
console.log(`  목표 ${STAGE}단계 ${STAGE_GOAL.toLocaleString()}편 · 재고 ${gap.measuredAt.slice(0, 10)} 실측\n`)
console.log(`  ${'소재'.padEnd(11)}${'목표'.padStart(8)}${'재고'.padStart(8)}${'부족'.padStart(8)}${'배율'.padStart(8)}   OKR`)
console.log('  ' + '-'.repeat(66))
for (const k of TARGET_KEYS) {
  const want = Math.round(STAGE_GOAL * share[k])
  const have = stock[k] ?? 0
  quota[k] = OKR_SLOTS.includes(k) ? Math.max(0, want - have) : 0
  console.log(
    `  ${k.padEnd(11)}${want.toLocaleString().padStart(8)}${have.toLocaleString().padStart(8)}` +
      `${Math.max(0, want - have).toLocaleString().padStart(8)}${(ratioBefore[k] ?? 0).toFixed(3).padStart(8)}` +
      `   ${OKR_SLOTS.includes(k) ? '○' : '— 이 소스에 없다'}`,
  )
}
console.log('  ' + '-'.repeat(66))
console.log(`  이번 겨냥: **사회·경제**(배율 ${(ratioBefore['사회·경제'] ?? 0).toFixed(3)} · 부족 ${quota['사회·경제'].toLocaleString()}편)\n`)

if (PLAN_ONLY) process.exit(0)

// ── DB ────────────────────────────────────────────────────────────────
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

// ── 커서 ──────────────────────────────────────────────────────────────
const CURSOR_FILE = arg('cursor-file') ?? harvestCursorPath('csat', 'worldbank', FEED)
let cursor = FRESH ? emptyHarvestCursor('worldbank', FEED) : readHarvestCursor(CURSOR_FILE, 'worldbank', FEED)
const seen = new Set(cursor.seen)
console.log(
  `  커서 ${CURSOR_FILE.replace(process.cwd() + path.sep, '')} — 판정 완료 ${seen.size}건 · ` +
    `${cursor.exhausted ? '소진됨(--fresh 로 재훑기)' : cursor.token ? '이어서' : '처음부터'}`,
)
console.log(
  `  피드 ${FEED} · ${PAGES}쪽 · 상한 ${MAX}편 · 문서당 ${PER_DOC}런 · 간격 ${DELAY / 1000}초` +
    `${COMMIT ? ' · **적재한다**' : ' (읽기 전용)'}\n`,
)
if (COMMIT) {
  console.log(
    `  ⚠️ robots.txt 가 /server/oai/ 를 Disallow 한다(Crawl-delay 10). 이 실행은 그 판단을\n` +
      `     사람이 내렸다고 전제한다 — 자동 실행에 붙이지 말 것.\n`,
  )
}

let listed = 0
let licOk = 0
let fetched = 0
let runsTotal = 0
let fitOk = 0
let dup = 0
let inserted = 0
const dropTotals = { nc: 0, nd: 0, reserved: 0, missing: 0, notEnglish: 0, noText: 0, type: 0 }
const accepted = {}
const full = {}
const spill = {}
const failures = []
const samples = []

outer: for (let p = 0; p < PAGES; p++) {
  if (cursor.exhausted) break
  let page
  try {
    page = await listWorldBankFeedPage(FEED, cursor.token, { from: FROM })
  } catch (e) {
    failures.push(`목록 실패(${p + 1}쪽): ${e.message}`)
    break
  }
  if (p === 0 && page.completeListSize != null) console.log(`  상류 총 레코드 ${page.completeListSize.toLocaleString()}\n`)
  for (const k of Object.keys(dropTotals)) dropTotals[k] += page.dropped[k]
  listed += page.items.length + Object.values(page.dropped).reduce((a, b) => a + b, 0)
  licOk += page.items.length

  const judged = []
  for (const it of page.items) {
    if (seen.has(it.handle)) continue
    if (Object.values(accepted).reduce((a, b) => a + b, 0) >= MAX) break

    let raw
    try {
      raw = await fetchWorldBankText(it.textUrl)
      fetched++
    } catch (e) {
      // 네트워크 실패는 **판정이 아니다** — seen 에 적지 않는다(다음 회차가 다시 본다).
      failures.push(`${it.handle} 평문 실패: ${e.message}`)
      await sleep(DELAY)
      continue
    }
    judged.push(it.handle)

    const runs = proseRuns(raw)
    runsTotal += runs.length
    const scored = runs
      .map((r) => ({ ...r, ...scoreArticle(r.text) }))
      .filter((r) => r.pass > 0)
      .sort((a, b) => b.pass - a.pass || b.words - a.words)
    fitOk += scored.length

    let takenHere = 0
    for (const run of scored) {
      if (takenHere >= PER_DOC) break
      if (Object.values(accepted).reduce((a, b) => a + b, 0) >= MAX) break
      const tp = classify(run.text.slice(0, 6000), { title: it.title })
      if (tp.topic !== '사회·경제') spill[tp.topic] = (spill[tp.topic] ?? 0) + 1
      const room = (quota[tp.topic] ?? 0) - (accepted[tp.topic] ?? 0)
      if (room <= 0) {
        full[tp.topic] = (full[tp.topic] ?? 0) + 1
        continue
      }
      accepted[tp.topic] = (accepted[tp.topic] ?? 0) + 1
      takenHere++
      if (samples.length < 6) {
        samples.push({ handle: it.handle, page: run.page, words: run.words, pass: run.pass, topic: tp.topic, title: it.title.slice(0, 54) })
      }
      const row = {
        source: 'worldbank',
        source_id: runSourceKey(it.handle, run),
        title: `${it.title} (p.${run.page + 1} 발췌)`,
        author: it.authors[0] ?? null,
        source_url: it.url,
        published_at: it.published_at ? `${it.published_at}${it.published_at.length === 4 ? '-01-01' : it.published_at.length === 7 ? '-01' : ''}` : null,
        license: it.license,
        content: run.text,
        status: 'queued',
        feed_id: FEED,
        feed_label: `OKR 겨냥 수확 · ${tp.topic}`,
        csat_fit: { ...fitRecord(run.text), topic: tp.topic, topicMargin: tp.margin, topicV: TOPIC_V, okrPage: run.page },
        _topic: tp.topic,
      }
      if (COMMIT) {
        const { data: existing, error: exErr } = await db
          .from('library_articles')
          .select('source_id')
          .eq('source', 'worldbank')
          .eq('source_id', row.source_id)
        if (exErr) {
          failures.push(`중복 확인 실패: ${exErr.message}`)
          accepted[row._topic]--
          continue
        }
        if ((existing ?? []).length) {
          dup++
          accepted[row._topic]--
          continue
        }
        const { _topic, ...insertable } = row
        const { error } = await db.from('library_articles').insert(insertable)
        if (error) {
          failures.push(`적재 실패(${row.source_id}): ${error.code ?? ''} ${error.message}`)
          accepted[_topic]--
          // 제약 위반은 **한 번 나면 계속 난다** — 나머지를 태우지 않고 멈춘다.
          if (String(error.code) === '23514') {
            console.log(`\n  ⛔ library_articles_source_check 가 'worldbank' 를 모른다 — 마이그레이션이 먼저다. 중단.`)
            break outer
          }
        } else inserted++
      }
    }
    await sleep(DELAY)
  }

  // ⚠️ **판정한 뒤에** 커서를 전진시킨다. 받자마자 쓰면 안 본 것을 본 것으로 센다.
  for (const h of judged) seen.add(h)
  cursor = { ...cursor, token: page.nextCursor, exhausted: page.nextCursor === null, seen: [...seen] }
  if (COMMIT) writeHarvestCursor(CURSOR_FILE, cursor)
  if (page.nextCursor === null) break
  if (Object.values(accepted).reduce((a, b) => a + b, 0) >= MAX) break
}

// ── 보고 ──────────────────────────────────────────────────────────────
const took = Object.values(accepted).reduce((a, b) => a + b, 0)
const dropSum = Object.values(dropTotals).reduce((a, b) => a + b, 0)
console.log(`  열거 ${listed.toLocaleString()}건`)
console.log(
  `  라이선스·언어·유형·평문 필터 통과 ${licOk.toLocaleString()} (${pct(licOk, listed)}%) · ` +
    `떨어뜨림 ${dropSum.toLocaleString()}`,
)
console.log(
  `    NC ${dropTotals.nc} · ND ${dropTotals.nd} · 유보 ${dropTotals.reserved} · 표기없음 ${dropTotals.missing} · ` +
    `비영어 ${dropTotals.notEnglish} · 유형불일치 ${dropTotals.type} · 평문없음 ${dropTotals.noText}`,
)
console.log(`  평문 내려받음 ${fetched}편 · 산문 런 ${runsTotal.toLocaleString()} · 그중 창 통과 ${fitOk.toLocaleString()} (${pct(fitOk, runsTotal)}%)`)
if (Object.keys(spill).length) {
  console.log(`  사회·경제 밖으로 샌 런: ` + Object.entries(spill).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · '))
}
console.log(`\n  ${'받아들인 소재'.padEnd(13)}${'편수'.padStart(6)}${'몫'.padStart(8)}`)
console.log('  ' + '-'.repeat(30))
for (const [k, v] of Object.entries(accepted).sort((a, b) => b[1] - a[1])) {
  if (v > 0) console.log(`  ${k.padEnd(13)}${String(v).padStart(6)}${(quota[k] ?? 0).toLocaleString().padStart(8)}`)
}
if (Object.keys(full).length) {
  console.log(`  몫이 차서 돌려보낸 런: ` + Object.entries(full).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · '))
}
if (COMMIT) console.log(`\n  중복 ${dup} · **적재 ${inserted}편**`)
else console.log(`\n  → 적재 가능 ${took}편 (읽기 전용 — --commit 을 붙이면 쓴다 · 커서도 전진하지 않았다)`)
if (samples.length) {
  console.log(`\n  표본:`)
  for (const s of samples) {
    console.log(`    ${s.handle} p${s.page + 1} · 창 ${s.pass} · ${String(s.words).padStart(4)}어 · ${s.topic.padEnd(6)} ${s.title}`)
  }
}
if (failures.length) {
  console.log(`\n  실패 ${failures.length}:`)
  for (const f of failures.slice(0, 8)) console.log('    · ' + f)
}
if (COMMIT && inserted > 0) {
  console.log(
    `\n  ⚠️ 몫의 기준이 된 재고는 ${gap.measuredAt.slice(0, 10)} 표본 추정이다. 다시 재야 다음 수확이 어긋나지 않는다:\n` +
      `       node scripts/csat/topic-gap.mjs --sample 3000 --out docs/reports/topic-gap.json`,
  )
}
