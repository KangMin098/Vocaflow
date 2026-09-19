// scripts/textbook/epmc-yield-probe.mjs
//
// **Europe PMC 에서 교재 지문 규격에 드는 단락이 몇 % 나오는가 — 실측.**
//
// ── 왜 이 경로인가 (실측 2026-09-13) ─────────────────────────────────
// Cycle 1 재검증은 DOAB 를 최대 지렛대로 꼽았다(127,677권 · 변형 가능 33.6%). 그런데 축을 더
// 넣고 재니 값이 달라졌다:
//   · **언어** — DOAB 는 다국어다. 영어는 51.1% 뿐이라 「변형 가능 × 영어」는 22.7%(약 28,983권)
//   · **단위** — 81.5% 가 book, chapter 는 8.1%. 즉 대부분 **PDF 를 장으로 쪼개야** 지문이 된다
//
// 같은 목표(변형 가능 · 논증 · C1–C2)를 훨씬 싸게 채우는 경로가 Europe PMC 다:
//   `LICENSE:"cc by" AND LANG:"eng" AND IN_EPMC:y` → **5,218,944편**(2026-09-13 실측)
//   그중 `PUB_TYPE:"review"` → **618,171편**. 리뷰는 주장 + 근거 + 반론이라 기출 논증문에 가깝다.
// 결정적 차이는 **라이선스 필터가 질의 파라미터**라는 것이다 — DOAB 처럼 편당 판정을 따로 만들
// 필요가 없고, 본문도 PDF 가 아니라 `/{PMCID}/fullTextXML` 로 바로 나온다.
//
// ── 이 프로브가 답하는 것 ────────────────────────────────────────────
// "5,218,944편" 은 상류이고 지문 수가 아니다. 논문 한 편에서 교재 어수 창에 드는 덩어리가
// 나오는지는 별 문제다. 그래서 **서론을 실제로 떼어 어수를 센다**:
//   csat-short  90~200어   (`compose-unit.CSAT_ITEM_WORDS`)
//   csat-long   260~400어  (`compose-unit.CSAT_LONG_ITEM_WORDS`)
// 창의 정본은 저 파일이다 — 여기서 숫자를 새로 정하지 않고 **읽어 온다**.
//
// ⚠️ 수확률은 규격만 본다. 내용 판정(철회 논문 · 민감 소재 · 전문용어 밀도)은
//    `source-eligibility.ts` 7축과 게이트 소관이다. 여기 수치는 **상한**이다.
//
// 재실행 안전: 읽기만 한다. DB 를 건드리지 않고 외부에는 GET 만 한다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/epmc-yield-probe.mjs
//   pnpm dlx tsx scripts/textbook/epmc-yield-probe.mjs --n 60 --type review
//   pnpm dlx tsx scripts/textbook/epmc-yield-probe.mjs --n 40 --out <경로.json>

import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const N = Number(arg('n') ?? 40)
const PUB_TYPE = arg('type') ?? 'review'
const outPath = arg('out')

// **창은 조판의 정본에서 읽어 온다.** 여기 숫자를 적으면 자가 두 벌이 된다.
const { CSAT_ITEM_WORDS, CSAT_LONG_ITEM_WORDS } = await import(
  '../../packages/library-pipeline/src/textbook/compose-unit.ts'
)

const REST = 'https://www.ebi.ac.uk/europepmc/webservices/rest'

/** curl 로 받는다 — 이 머신은 일부 호스트에서 node fetch 만 ECONNRESET 을 낸다. */
async function get(url, extra = []) {
  const { stdout } = await run('curl', ['-sL', '--max-time', '45', ...extra, url], {
    maxBuffer: 64 * 1024 * 1024,
  })
  return stdout
}

/**
 * **균형 잡힌 `<sec>` 블록을 읽는다.** 정규식으로 `<sec …>[\s\S]*?</sec>` 를 쓰면 중첩된
 * 하위 절의 닫는 태그에서 끊긴다 — 실측 2026-09-13 에 그렇게 해서 Introduction 이 있는 논문을
 * "Introduction 절 없음" 으로 셌다. 절 안에 절이 있는 문서에서는 **깊이를 세야** 한다.
 */
function topLevelSections(xml) {
  const body = xml.match(/<body\b[^>]*>([\s\S]*)<\/body>/)?.[1] ?? xml
  const out = []
  const open = /<sec\b[^>]*>/g
  let m
  while ((m = open.exec(body)) !== null) {
    let depth = 1
    let i = open.lastIndex
    while (depth > 0 && i < body.length) {
      const nextOpen = body.indexOf('<sec', i)
      const nextClose = body.indexOf('</sec>', i)
      if (nextClose === -1) break
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++
        i = nextOpen + 4
      } else {
        depth--
        i = nextClose + 6
      }
    }
    const block = body.slice(m.index, i)
    // `<label>1.</label><title>Introduction</title>` — label 이 사이에 끼는 문서가 많다.
    const title = block.match(/<title\b[^>]*>([\s\S]*?)<\/title>/)?.[1] ?? ''
    out.push({ title: strip(title), block })
    open.lastIndex = i // 하위 절을 다시 최상위로 세지 않는다
  }
  return out
}

const strip = (s) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const words = (s) => (s ? s.split(/\s+/).filter(Boolean).length : 0)

/**
 * 서론에 해당하는 절. 제목이 없는 문서는 **첫 절**을 쓴다(JATS 에서 흔하다).
 *
 * ⚠️ `<sec>` 이 **하나도 없는 문서**가 있다 — 실측 2026-09-13 에 표본 40편 중 6편(15%)이 그랬고,
 *   본문이 `<body><p>…` 로 곧장 이어진다. 이걸 "서론 없음" 으로 세면 멀쩡한 논문을
 *   수확률에서 통째로 깎는다. 절이 없으면 **본문 자체를 서론 풀로** 본다.
 */
function introSection(secs, xml) {
  const named = secs.find((s) => /^(?:\d+\.?\s*)?(introduction|background)\b/i.test(s.title))
  if (named) return named
  if (secs.length) return secs[0]
  const body = xml.match(/<body\b[^>]*>([\s\S]*)<\/body>/)?.[1]
  return body ? { title: '(절 없음 — 본문 앞머리)', block: body } : null
}

/** 인용 표시·그림 참조가 걷힌 문단들. **표·그림 캡션은 지문이 아니다** — 뺀다. */
function paragraphs(block) {
  const cleaned = block
    .replace(/<table-wrap[\s\S]*?<\/table-wrap>/g, ' ')
    .replace(/<fig[\s\S]*?<\/fig>/g, ' ')
    .replace(/<xref\b[^>]*>[\s\S]*?<\/xref>/g, ' ') // [12] 꼴 인용 번호
  return [...cleaned.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)].map((m) => strip(m[1])).filter(Boolean)
}

const inWindow = (n, w) => n >= w.min && n <= w.max

/** 연속 문단을 이어 붙여 창에 드는 덩어리를 찾는다 — 한 문단이 짧아도 둘을 붙이면 든다. */
function bestChunk(paras, w) {
  for (let len = 1; len <= Math.min(4, paras.length); len++) {
    for (let i = 0; i + len <= paras.length; i++) {
      const text = paras.slice(i, i + len).join(' ')
      if (inWindow(words(text), w)) return { start: i, len, wordCount: words(text) }
    }
  }
  return null
}

// ── 표본 수집 ────────────────────────────────────────────────────────
const query = `OPEN_ACCESS:y AND IN_EPMC:y AND LICENSE:"cc by" AND LANG:"eng" AND PUB_TYPE:"${PUB_TYPE}"`
const searchUrl =
  `${REST}/search?query=${encodeURIComponent(query)}&format=json&pageSize=${Math.min(N, 100)}&resultType=core`
const search = JSON.parse(await get(searchUrl))
const hitCount = search.hitCount
const items = (search.resultList?.result ?? []).slice(0, N)

console.log(
  `Europe PMC — ${PUB_TYPE} · CC BY · 영어 · 전문 보유: 상류 ${hitCount.toLocaleString()}편 / 표본 ${items.length}편`,
)
console.log(
  `창(정본 compose-unit): 짧은 지문 ${CSAT_ITEM_WORDS.min}~${CSAT_ITEM_WORDS.max}어 · ` +
    `장문 ${CSAT_LONG_ITEM_WORDS.min}~${CSAT_LONG_ITEM_WORDS.max}어\n`,
)

const rows = []
let noXml = 0
let noIntro = 0
let fitShort = 0
let fitLong = 0

for (const it of items) {
  const pmcid = it.pmcid
  if (!pmcid) {
    noXml++
    continue
  }
  let xml
  try {
    xml = await get(`${REST}/${pmcid}/fullTextXML`)
  } catch {
    noXml++
    continue
  }
  if (!/<body\b/.test(xml)) {
    noXml++
    rows.push({ pmcid, ok: false, why: '전문 XML 에 body 없음' })
    continue
  }
  const secs = topLevelSections(xml)
  const intro = introSection(secs, xml)
  if (!intro) {
    noIntro++
    rows.push({ pmcid, ok: false, why: '서론 절을 못 찾음', sections: secs.map((s) => s.title).slice(0, 6) })
    continue
  }
  // 절 없는 문서는 본문 전체가 블록이다 — **앞 6문단까지만** 서론으로 본다.
  const allParas = paragraphs(intro.block)
  const paras = secs.length ? allParas : allParas.slice(0, 6)
  const short = bestChunk(paras, CSAT_ITEM_WORDS)
  const long = bestChunk(paras, CSAT_LONG_ITEM_WORDS)
  if (short) fitShort++
  if (long) fitLong++
  rows.push({
    pmcid,
    ok: !!(short || long),
    license: it.license ?? null,
    introTitle: intro.title,
    paraWords: paras.map(words),
    short,
    long,
  })
}

const n = items.length
const pct = (x) => `${((100 * x) / n).toFixed(1)}%`
console.log(`전문 XML 없음        ${String(noXml).padStart(4)}  ${pct(noXml)}`)
console.log(`서론 절 못 찾음      ${String(noIntro).padStart(4)}  ${pct(noIntro)}`)
console.log(`짧은 지문 창에 듦    ${String(fitShort).padStart(4)}  ${pct(fitShort)}`)
console.log(`장문 창에 듦         ${String(fitLong).padStart(4)}  ${pct(fitLong)}`)
const either = rows.filter((r) => r.ok).length
console.log(`둘 중 하나라도 듦    ${String(either).padStart(4)}  ${pct(either)}  ← 규격 수확률`)
if (hitCount)
  console.log(
    `\n→ 상류 ${hitCount.toLocaleString()}편 × 수확률 ${pct(either)} = 약 ` +
      `${Math.round((hitCount * either) / n).toLocaleString()}편의 지문 후보` +
      `\n  (규격만 본 상한이다 — 내용 판정·중복·주제 편중은 별 게이트)`,
  )

if (outPath) {
  fs.writeFileSync(
    path.resolve(outPath),
    JSON.stringify(
      {
        source: 'europe_pmc',
        measured_at: new Date().toISOString(),
        query,
        hit_count: hitCount,
        sample_size: n,
        windows: { short: CSAT_ITEM_WORDS, long: CSAT_LONG_ITEM_WORDS },
        no_xml: noXml,
        no_intro: noIntro,
        fit_short: fitShort,
        fit_long: fitLong,
        fit_either: either,
        projected_passages: hitCount ? Math.round((hitCount * either) / n) : null,
        rows,
      },
      null,
      2,
    ),
  )
  console.log(`→ ${outPath}`)
}
