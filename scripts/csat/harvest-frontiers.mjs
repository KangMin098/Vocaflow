// scripts/csat/harvest-frontiers.mjs
//
// **교육·언어 칸을 겨냥한 수확 — 적재하기 전에 채점한다.**
//
// @harvest-source: frontiers   ← `harvest-cursor-contract.test.ts` 가 이 선언으로 등록부를 검사한다
//
// ── 왜 이 소스인가 (실측 2026-09-07) ────────────────────────────────
// `lib-topic.mjs` 분류기를 고쳐 오분류 23.6% → 8.3% 로 만든 뒤 소재 칸을 다시 재니
// 「8칸 전부 부족 0」이 **부족 3,010편**으로 바뀌었고, 병목은 **교육·언어**였다
// (배율 0.57 · 3단계 5만 기준 부족 1,464편). 그 칸을 PLOS 는 못 채운다 —
// `harvest-plos.mjs` 의 `SUBJECT_QUERY` 에 대응 주제가 아예 없다. PMC 500만 편도 못 채운다
// (NLM 수집 범위가 생명·의학이라 교육은 의학교육뿐).
//
// Frontiers 의 **PMC 밖 저널**에 교육·언어·사회 계열이 **12,618편** 있다(PMC 수록률 0.4%):
// Education 8,079 · Communication 2,288 · Political Science 1,478 · Human Dynamics 561 ·
// Language Sciences 212. 근거는 `docs/reports/source-probe/frontiers.md`.
//
// ── 구조는 `harvest-plos.mjs` 와 같다 — 버릴 것을 담지 않는다 ────────
// 목록에서 받은 자리에서 ① 제목 유형 ② 중복 ③ 라이선스 ④ 본문 길이 ⑤ 비ASCII
// ⑥ 창 게이트(`lib-fit.mjs`) ⑦ 소재 몫(`lib-topic.mjs`) 을 다 보고 **통과한 것만** 넣는다.
// 같은 자를 안 대면 같은 구멍이 생긴다.
//
// ⚠️ PLOS 와 다른 점 하나: **본문이 목록에 안 딸려 온다.** Crossref 는 서지만 주므로
//   편당 `/xml/nlm` GET 이 한 번 든다. 그래서 **중복 확인을 본문 GET 앞에** 둔다 —
//   순서를 뒤집으면 이미 가진 글을 받아 오느라 대역폭을 태운다(PLOS 에서 600편 중 326편이
//   그랬다).
//
// ── 인용 제거 피해를 **고치지 않고 센다** ────────────────────────────
// 교육·사회 계열은 인용을 문장 성분으로 쓴다(`<xref>Wood et al. (1976)</xref>, who coined…`).
// 어댑터가 **괄호 인용은 괄호째 지우고, 주어 자리 인용이 남은 문장만 버린다**.
// 버린 문장 수를 편마다 세어 마지막에 합계로 보고한다 — 정찰이 이 손실을 **별도 작업**으로
// 남겨 뒀으므로, 여기서는 규모를 재는 것까지가 몫이다(SUMMARY §5).
//
// ── ⚠️ `applySourceLevelCap` 은 이 경로에 없다 (확인하고 적는다) ─────
// 새 소스가 `preferredFeedMix` 에 없으면 quota 0 을 받아 Admin 대량 GET 에서 **오류 없이
// 사라진다.** 여기서는 그 일이 일어날 수 없다 — 그 캡은 `BulkArticlesTab` 이 `SourceKey` ·
// `SOURCE_SPECS` 로 고른 항목에만 걸리는데, `frontiers` 는 `_curation-spec.ts` 의 `SourceKey`
// 가 **아니다**(수확기가 DB 에 직접 넣는다 — `plos` · `gutenberg` 와 같은 경로).
// 그래서 Admin 화면의 선택지로도 뜨지 않고, 캡을 지나가지도 않는다.
// 언젠가 이 소스를 대량 GET 화면에 올리려면 `SourceKey` + `SOURCE_SPECS` + `preferredFeedMix`
// **셋을 함께** 더해야 한다. 하나라도 빠지면 조용히 0건이 된다.
//
// ── 재실행 안전 ──────────────────────────────────────────────────────
//   Crossref 목록  안전. 커서를 지워도 처음부터 훑을 뿐 결과가 같다
//   중복 판정      안전. `(source, source_id)` 로 DB 조회 — 건너뛴 수를 출력한다
//   본문 GET       안전. 부수효과 없음
//   게이트 채점    안전. 통과분만 적재하므로 실패분이 재고로 남지 않는다
//   적재           `--commit` 없이는 DB 에도 커서에도 쓰지 않는다(기본 dry-run).
//                  빈 본문·짧은 본문은 넣지 않고 건너뛴 수를 출력한다
//   커서           **판정 뒤에** 쓴다. 중간에 죽으면 그 페이지를 다시 보는데
//                  중복 판정이 걸러 주므로 결과가 같다
//
// ⚠️ **`seen` 에는 「처분이 끝난 것」만 넣는다.** 통과시켰는데 적재가 실패한 편을 `seen` 에
//   넣으면 다음 실행이 그것을 「이미 봤다」로 세어 **구멍이 영영 남는다** — CLAUDE.md §🤖 가
//   드레인에서 경고하는 그 실패 모드와 같다. 그래서
//     넣는다  비논문 제목 · 이미 있음 · 라이선스 밖 · 짧음 · 비ASCII · 창 게이트 탈락 · **적재 성공**
//     안 넣는다 본문 GET 실패(일시적일 수 있다) · 몫이 차서 미룬 것(우리 예산 사정이지 글의 흠이 아니다)
//   그리고 **적재가 실패하면 커서를 전진시키지 않는다** — 토큰만 밀면 그 페이지의 통과분이
//   `seen` 에 없어도 다시 목록에 안 나온다.
//
// 실행:
//   pnpm dlx tsx scripts/csat/harvest-frontiers.mjs                          # 계획만(읽기 전용)
//   pnpm dlx tsx scripts/csat/harvest-frontiers.mjs --journal feduc --pages 1 --max 5
//   pnpm dlx tsx scripts/csat/harvest-frontiers.mjs --journal feduc --pages 6 --max 400 --commit
//   pnpm dlx tsx scripts/csat/harvest-frontiers.mjs --journal feduc --fresh   # 커서 무시하고 처음부터

import fs from 'node:fs'
import path from 'node:path'

import { fitRecord, scoreArticle } from './lib-fit.mjs'
import { classify, TOPIC_KEYS, TOPIC_V } from './lib-topic.mjs'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const COMMIT = process.argv.includes('--commit')
const FRESH = process.argv.includes('--fresh')
const JOURNAL = arg('journal')
const PAGES = Number(arg('pages') ?? 2)
const ROWS = Math.min(500, Number(arg('rows') ?? 200))
const MAX = Number(arg('max') ?? Infinity)
const STAGE = Number(arg('stage') ?? 3)
const STAGE_GOAL = { 1: 10000, 2: 30000, 3: 50000 }[STAGE] ?? 50000
/** 편당 `/xml/nlm` GET 사이 간격(ms). 정찰 중 25회에 차단·챌린지 없었으나 넉넉히 둔다. */
const GAP_MS = Number(arg('gap') ?? 400)

// ⚠️ **배럴(`src/index.ts`)을 거치지 않는다.** 이 수확기가 쓰는 것은 어댑터 세 파일뿐인데
//   배럴을 부르면 어댑터 20여 개가 통째로 평가된다 — 그중 하나가 깨지면 관계없는 이 스크립트가
//   함께 죽는다. 배럴은 패키지의 공개 API 로 남기고, 스크립트는 필요한 모듈을 직접 부른다.
const {
  FRONTIERS_JOURNALS,
  FRONTIERS_MAX_NON_ASCII,
  FRONTIERS_MIN_WORDS,
  fetchFrontiersArticle,
  frontiersIsResearchTitle,
  frontiersLicenseAllowed,
  frontiersLicenseCode,
  listFrontiersFeedPage,
} = await import('../../packages/library-pipeline/src/ingest-article/frontiers.ts')
const { harvestCursorPath, readHarvestCursor, writeHarvestCursor } = await import(
  '../../packages/library-pipeline/src/ingest-article/harvest-cursor.ts'
)
const { sourceKey } = await import('../../packages/library-pipeline/src/ingest-article/source-key.ts')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── 목표 배합 (기출) + 현재 재고 ─────────────────────────────────────
const DATA = path.resolve('scripts/csat/data')
const dist = JSON.parse(fs.readFileSync(path.join(DATA, 'topic-distribution.json'), 'utf8'))
const TARGET_KEYS = TOPIC_KEYS.filter((k) => k !== '분류불가')
const denom = TARGET_KEYS.reduce((s, k) => s + (dist.total[k] ?? 0), 0)
const share = Object.fromEntries(TARGET_KEYS.map((k) => [k, (dist.total[k] ?? 0) / denom]))

const gapFile = path.resolve('docs/reports/topic-gap.json')
if (!fs.existsSync(gapFile)) {
  console.error(
    '소재별 재고를 모른다 — 먼저 돌릴 것: node scripts/csat/topic-gap.mjs --out docs/reports/topic-gap.json',
  )
  process.exit(1)
}
const gap = JSON.parse(fs.readFileSync(gapFile, 'utf8'))
const stock = Object.fromEntries(gap.rows.map((r) => [r.topic, r.estStock]))

console.log(`Frontiers 겨냥 수확 — 몫이 남은 칸\n${'='.repeat(78)}`)
console.log(
  `  목표 ${STAGE}단계 ${STAGE_GOAL.toLocaleString()}편 · 배합 기출 ${gap.examClassified}지문 · ` +
    `재고 ${gap.measuredAt.slice(0, 10)} 실측\n`,
)
console.log(`  ${'소재'.padEnd(11)}${'목표'.padStart(8)}${'재고'.padStart(8)}${'부족'.padStart(8)}${'배율'.padStart(8)}`)
console.log('  ' + '-'.repeat(50))
const quota = {}
for (const k of TARGET_KEYS) {
  const want = Math.round(STAGE_GOAL * share[k])
  const have = stock[k] ?? 0
  quota[k] = Math.max(0, want - have)
  const ratio = (gap.rows.find((r) => r.topic === k)?.ratio ?? 0).toFixed(2)
  // ⚠️ 병목은 **고정이 아니다.** 2026-09-08 전수 집계 전까지 여기에 «교육·언어» 를 박아 뒀는데,
  //   주제 재분류 백필이 끝나자 실제 병목은 **심리·인지** 였다(그전 표본은 «기술·매체» 로 오인시켰다).
  //   이름을 박아 두면 화면이 틀린 칸을 가리키고도 멀쩡해 보인다 — 그래서 **몫이 남은 칸**을 표시한다.
  const flag = quota[k] > 0 ? '  ← 병목' : '  (참)'
  console.log(
    `  ${k.padEnd(11)}${want.toLocaleString().padStart(8)}${have.toLocaleString().padStart(8)}` +
      `${quota[k].toLocaleString().padStart(8)}${ratio.padStart(8)}${flag}`,
  )
}
console.log()

if (!JOURNAL) {
  console.log('  저널을 지정해 수확한다 — 목표 칸에 직결되는 순서:\n')
  for (const j of FRONTIERS_JOURNALS) {
    console.log(`    --journal ${j.id.padEnd(7)} ${j.label.padEnd(38)} Crossref ${String(j.crossref).padStart(6)}편 · ${j.aimsAt}`)
  }
  console.log('\n  예: pnpm dlx tsx scripts/csat/harvest-frontiers.mjs --journal feduc --pages 2 --max 20')
  process.exit(0)
}

const journal = FRONTIERS_JOURNALS.find((j) => j.id === JOURNAL)
if (!journal) {
  console.error(`저널 '${JOURNAL}' 를 모른다. 쓸 수 있는 것: ${FRONTIERS_JOURNALS.map((j) => j.id).join(' · ')}`)
  process.exit(1)
}

// ── DB ───────────────────────────────────────────────────────────────
const { createScriptClient } = await import('../lib/supabase-client.mjs')
const db = createScriptClient()

// ── 커서 ─────────────────────────────────────────────────────────────
// ⚠️ **판정 뒤에 쓴다.** 받자마자 쓰면 중간에 죽었을 때 안 본 것을 본 것으로 센다.
const CURSOR_FILE = arg('cursor-file') ?? harvestCursorPath('csat', 'frontiers', JOURNAL)
let cursor = FRESH
  ? {
      version: 1,
      source: 'frontiers',
      feed: JOURNAL,
      updated_at: new Date(0).toISOString(),
      token: null,
      seen: [],
      exhausted: false,
    }
  : readHarvestCursor(CURSOR_FILE, 'frontiers', JOURNAL)
const seenSet = new Set(cursor.seen)

console.log(
  `  ${journal.label} (${journal.id}) — ${PAGES}쪽 × ${ROWS}편 · 상한 ${MAX === Infinity ? '없음' : MAX}` +
    `${COMMIT ? ' · **적재한다**' : ' (읽기 전용)'}`,
)
console.log(`  커서 ${path.relative(process.cwd(), CURSOR_FILE)} — 이미 판정 ${cursor.seen.length}편${FRESH ? ' (무시: --fresh)' : ''}\n`)

// ── 집계 ─────────────────────────────────────────────────────────────
const n = {
  listed: 0,
  seenSkip: 0,
  titleSkip: 0,
  dup: 0,
  bodyFail: 0,
  licenseSkip: 0,
  shortSkip: 0,
  nonAsciiSkip: 0,
  fitFail: 0,
  quotaFull: 0,
  inserted: 0,
}
/** 인용 제거 피해 — 고치지 않고 센다. */
const dmg = { articles: 0, harmed: 0, dropped: 0, totalSents: 0, parens: 0 }
const byTopic = {}
const samples = []
const failures = []
let token = cursor.token

pageLoop: for (let p = 0; p < PAGES; p++) {
  let page
  try {
    page = await listFrontiersFeedPage(JOURNAL, ROWS, token)
  } catch (e) {
    failures.push(`목록 실패(${p + 1}쪽): ${e.message}`)
    break
  }
  if (p === 0) console.log(`  상류 총량 ${page.total.toLocaleString()}편\n`)
  if (page.items.length === 0) {
    cursor = { ...cursor, exhausted: true }
    break
  }

  // ① 제목 유형 + 이미 판정한 것 걸러 내기 (네트워크 0)
  /** 이번 페이지에서 **처분이 끝난** DOI. 통과분은 적재에 성공해야 여기 들어간다. */
  const disposed = new Set()
  const fresh = []
  for (const it of page.items) {
    n.listed++
    if (seenSet.has(it.doi)) {
      n.seenSkip++
      continue
    }
    if (!frontiersIsResearchTitle(it.title)) {
      n.titleSkip++
      disposed.add(it.doi)
      continue
    }
    fresh.push(it)
  }

  // ② **본문 GET 앞에** 중복을 걸러 낸다 — 편당 GET 이 드는 소스라 순서가 비용을 정한다.
  if (fresh.length) {
    const ids = fresh.map((f) => f.source_id)
    const { data: existing, error } = await db
      .from('library_articles')
      .select('source_id')
      .eq('source', 'frontiers')
      .in('source_id', ids)
    if (error) failures.push(`중복 확인 실패: ${error.message}`)
    else {
      const have = new Set((existing ?? []).map((r) => r.source_id))
      for (let i = fresh.length - 1; i >= 0; i--) {
        if (have.has(fresh[i].source_id)) {
          n.dup++
          disposed.add(fresh[i].doi)
          fresh.splice(i, 1)
        }
      }
    }
  }

  // ③ 편마다 본문을 받아 채점한다
  const passed = []
  for (const it of fresh) {
    const took = Object.values(byTopic).reduce((a, b) => a + b, 0)
    if (took >= MAX) break

    let got = null
    try {
      got = await fetchFrontiersArticle(it.doi, { crossrefLicenseUrl: it.licenseUrl, title: it.title })
    } catch (e) {
      failures.push(`본문 실패 ${it.doi}: ${String(e.message).slice(0, 90)}`)
    }
    await sleep(GAP_MS)
    if (!got) {
      // **`seen` 에 넣지 않는다** — 404 면 다음에도 실패할 뿐이지만, 일시적 장애를
      //   영구 제외로 굳히는 쪽이 훨씬 비싸다(GET 한 번 vs 영영 구멍).
      n.bodyFail++
      continue
    }

    dmg.articles++
    dmg.dropped += got.body.sentencesDropped
    dmg.totalSents += got.body.sentencesTotal
    dmg.parens += got.body.parenRemoved
    if (got.body.sentencesDropped > 0) dmg.harmed++

    // 아래 넷은 **글 자체에 대한 안정된 판정**이라 처분으로 친다 — 다시 GET 하지 않는다.
    if (!frontiersLicenseAllowed(got.licenseUrl)) {
      n.licenseSkip++
      disposed.add(it.doi)
      continue
    }
    if (got.words < FRONTIERS_MIN_WORDS) {
      n.shortSkip++
      disposed.add(it.doi)
      continue
    }
    if (got.body.nonAsciiRatio > FRONTIERS_MAX_NON_ASCII) {
      n.nonAsciiSkip++
      disposed.add(it.doi)
      continue
    }
    const sc = scoreArticle(got.content)
    if (sc.pass <= 0) {
      n.fitFail++
      disposed.add(it.doi)
      continue
    }
    // 제목은 소재의 가장 강한 단서다 — 분류기에 **반드시 함께 넘긴다**.
    const tp = classify(got.content.slice(0, 6000), { title: got.title })
    const room = (quota[tp.topic] ?? 0) - (byTopic[tp.topic] ?? 0)
    if (room <= 0) {
      // **미룬 것이지 거절한 것이 아니다** — `seen` 에 넣으면 몫이 열려도 다시 못 본다.
      n.quotaFull++
      continue
    }
    byTopic[tp.topic] = (byTopic[tp.topic] ?? 0) + 1
    if (samples.length < 6) {
      samples.push({ title: got.title.slice(0, 58), topic: tp.topic, pass: sc.pass, words: got.words })
    }
    passed.push({
      source: 'frontiers',
      source_id: sourceKey('frontiers', { doi: got.doi }),
      title: got.title,
      author: null,
      source_url: got.url,
      published_at: it.published_at,
      license: frontiersLicenseCode(got.licenseUrl) ?? 'CC-BY-4.0',
      content: got.content,
      status: 'queued',
      feed_id: 'harvest',
      feed_label: `겨냥 수확 · ${journal.label} · ${tp.topic}`,
      // 소재를 **적재 시점에 함께 적는다** — 안 적으면 전수 집계에서 이 행들이 빠진다.
      csat_fit: { ...fitRecord(got.content), topic: tp.topic, topicMargin: tp.margin, topicV: TOPIC_V },
      _topic: tp.topic,
    })
    process.stderr.write(
      `\r  ${p + 1}/${PAGES}쪽 · 목록 ${n.listed} · 본문 ${dmg.articles} · 받음 ${passed.length + n.inserted}   `,
    )
  }

  // ④ 적재
  if (COMMIT && passed.length) {
    const toWrite = passed.map(({ _topic, ...row }) => row)
    const { error } = await db.from('library_articles').insert(toWrite)
    if (error) {
      failures.push(`적재 실패: ${error.message}`)
      for (const r of passed) byTopic[r._topic] = (byTopic[r._topic] ?? 1) - 1
      // **커서를 전진시키지 않고 멈춘다.** 토큰만 밀면 이 페이지의 통과분이 `seen` 에
      //   없어도 다시 목록에 안 나온다 — 오류 없이 구멍이 남는 그 꼴이다.
      console.log('\n  ⚠️ 적재가 실패해 커서를 전진시키지 않았다 — 다음 실행이 이 페이지를 다시 본다.')
      break
    }
    n.inserted += toWrite.length
    // 적재에 **성공한 것만** 처분으로 친다.
    for (const r of passed) disposed.add(r.source_id.replace(/^frontiers:/, ''))
  }

  // ⑤ 커서는 **여기서** 전진한다 — 이 페이지를 다 판정하고 적재까지 끝낸 뒤.
  for (const d of disposed) seenSet.add(d)
  token = page.nextCursor
  cursor = { ...cursor, token, seen: [...seenSet] }
  if (COMMIT) writeHarvestCursor(CURSOR_FILE, cursor)
  if (!token) {
    cursor = { ...cursor, exhausted: true }
    if (COMMIT) writeHarvestCursor(CURSOR_FILE, cursor)
    break
  }
  const took = Object.values(byTopic).reduce((a, b) => a + b, 0)
  if (took >= MAX) {
    console.log(`\n  이번 실행 상한 ${MAX}편을 채웠다 — 중단.`)
    break pageLoop
  }
}
process.stderr.write('\r' + ' '.repeat(78) + '\r')

// ── 보고 ─────────────────────────────────────────────────────────────
console.log(`\n  ── 이번 실행 ${'─'.repeat(58)}`)
console.log(`    목록 ${n.listed} · 이미 판정 ${n.seenSkip} · 비논문 제목 ${n.titleSkip} · 이미 있음 ${n.dup}`)
console.log(
  `    본문 받음 ${dmg.articles} · 본문 실패 ${n.bodyFail} · 라이선스 밖 ${n.licenseSkip} · ` +
    `${FRONTIERS_MIN_WORDS}어 미만 ${n.shortSkip} · 비ASCII 초과 ${n.nonAsciiSkip}`,
)
console.log(`    창 게이트 탈락 ${n.fitFail} · 몫 참 ${n.quotaFull} · **적재 ${n.inserted}**`)
if (Object.keys(byTopic).length) {
  console.log(
    `    소재별 받음: ${Object.entries(byTopic)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ${v}`)
      .join(' · ')}`,
  )
}

console.log(`\n  ── 인용 제거 피해 (고치지 않고 센다) ${'─'.repeat(38)}`)
if (dmg.articles === 0) console.log('    본문을 한 편도 안 받았다 — 잴 것이 없다.')
else {
  const pct = (100 * dmg.dropped) / Math.max(1, dmg.totalSents)
  console.log(
    `    본문 ${dmg.articles}편 중 **문장을 잃은 편 ${dmg.harmed}편**(${((100 * dmg.harmed) / dmg.articles).toFixed(1)}%) · ` +
      `버린 문장 ${dmg.dropped}/${dmg.totalSents} (${pct.toFixed(1)}%)`,
  )
  console.log(`    괄호째 지운 인용 묶음 ${dmg.parens}개 (이쪽은 문장이 그대로 산다)`)
}

if (samples.length) {
  console.log(`\n  ── 표본 ${'─'.repeat(60)}`)
  for (const s of samples) console.log(`    [${s.topic}] 창 ${s.pass} · ${s.words}어 · ${s.title}`)
}
if (failures.length) {
  console.log(`\n  ⚠️ 실패 ${failures.length}건`)
  for (const f of failures.slice(0, 10)) console.log(`    · ${f}`)
}
if (!COMMIT) console.log(`\n  읽기 전용이었다 — DB 에도 커서에도 쓰지 않았다. 넣으려면 --commit`)
