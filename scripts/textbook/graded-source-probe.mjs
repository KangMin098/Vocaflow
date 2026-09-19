// scripts/textbook/graded-source-probe.mjs
//
// **비PD 후보까지 넓혀 본 초·중 지문 소스** — 두 관문을 따로 통과해야 쓸 수 있다.
//
// ── 이 조사에서 배운 것 하나 ─────────────────────────────────────────
// **robots.txt 는 라이선스가 아니다.**
//
// Breaking News English 는 robots 가 `User-agent: * / Disallow:` — 전면 허용이다.
// 그것만 보고 "재저작 경로 대상" 으로 적어 두었는데, 저작권 고지를 열어 보니 정반대였다:
//
//     "NONE OF THE MATERIALS ON THIS WEBSITE CAN BE SOLD OR MONETIZED IN ANY FORM."
//     "Permission is not granted to reproduce the Article … on any other website, … app, LMS …"
//     "Permission is not granted to copy and paste sections of the materials to create
//      different versions or formats of the materials."
//     "This site uses anti-plagiarism software."
//
// 크롤을 막지 않는 것과 쓰게 해 주는 것은 **다른 일**이다. 그래서 이 프로브는 후보마다
// **① robots ② 저작권 고지** 를 따로 적고, 둘 다 통과한 것만 측정한다.
//
// ── 무엇을 재고 무엇을 재지 않는가 ───────────────────────────────────
// 재는 것: 어수 · FK · 문장 길이 (통계는 저작물이 아니다).
// **재지 않는 것: 본문.** 저장하지 않고 DB 에 넣지 않는다.
// 라이선스가 막은 곳은 **측정도 하지 않는다** — 뜻이 분명한 신호를 넓게 읽지 않는다.
//
// 재실행 안전: GET 만 한다. UA 를 밝히고 요청 사이를 띄운다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/graded-source-probe.mjs
//   pnpm dlx tsx scripts/textbook/graded-source-probe.mjs --sample 24

import fs from 'node:fs'
import path from 'node:path'

import { readability, bandOf } from '../../packages/library-pipeline/src/textbook/readability.ts'

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const SAMPLE = Number(arg('sample') ?? 16)
const outPath = arg('out') ?? 'docs/reports/graded-source-probe.json'

const UA =
  'Vocaflow-SourceProbe/1.0 (+https://vocaflow.app; educational corpus research; contact killerapp51@empal.com)'

async function get(url) {
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA } })
    if (!res.ok) return { ok: false, status: res.status, body: '' }
    return { ok: true, status: res.status, body: await res.text() }
  } catch (e) {
    return { ok: false, status: 0, error: String(e.message), body: '' }
  }
}

/**
 * 문단만 모은다 — 사이트 크롬(메뉴·꼬리말)을 낱말로 세면 어수와 FK 가 함께 부푼다.
 * 8낱말 미만 문단은 캡션·버튼이라 뺀다.
 */
function paragraphs(html) {
  const h = String(html)
    .replace(/<head[\s\S]*?<\/head>/i, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
  return [...h.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) =>
      m[1]
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
        .replace(/&[a-z]+;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter((t) => t.split(/\s+/).filter(Boolean).length > 8)
}

/**
 * 시중 실측 지문 길이 — **출판사가 스스로 인쇄한 어수**(n=59 · 6시리즈).
 * 최소 97 · 중앙 132 · p90 177. 검출기 추정(42~173)이 아니라 이쪽을 쓴다.
 */
const TARGET_WORDS = { min: 97, max: 200 }

const SOURCES = {
  nasa_space_place: {
    label: 'NASA Space Place — 어린이·청소년 우주 설명글',
    license: 'Public Domain (미 연방정부 저작물) — 판매·변형·재배포 제한 없음',
    robots: 'User-agent: * / Disallow: /magic/ (본문 허용)',
    note: '문단 구조가 뚜렷해 발췌 경로(`excerptForBand`)를 그대로 쓸 수 있다.',
    async list(n) {
      const slugs = new Set()
      for (const m of ['', 'menu/sun/', 'menu/earth/', 'menu/solar-system/', 'menu/universe/', 'menu/space/']) {
        const r = await get(`https://spaceplace.nasa.gov/${m}`)
        if (!r.ok) continue
        for (const x of r.body.matchAll(/href="\/([a-z0-9-]+)\/en\/"/g)) {
          if (x[1] !== 'glossary') slugs.add(x[1])
        }
        await new Promise((z) => setTimeout(z, 500))
      }
      return { total: slugs.size, items: [...slugs].slice(0, n).map((s) => ({ id: s })) }
    },
    urlFor: (id) => `https://spaceplace.nasa.gov/${id}/en/`,
  },
}

/**
 * **쓰지 않는 곳 — 이유와 함께 남긴다.** 다음 사람이 같은 길을 다시 걷지 않게.
 * 등급이 매겨진 학습용 사이트는 수준이 딱 맞아 자꾸 후보로 올라오는데,
 * 막는 것은 대부분 robots 가 아니라 **저작권 고지**다.
 */
const UNAVAILABLE = [
  {
    id: 'breaking_news_english',
    level: '같은 기사를 난이도별로 다시 쓴다 — 수준은 후보 중 가장 알맞다',
    robots: '전면 허용 (`Disallow:` 빈 값)',
    why:
      '저작권 고지가 **판매·수익화 전면 금지**, 앱·LMS·타 사이트 게재 금지, ' +
      '**"부분을 복사해 다른 형태로 만드는 것" 도 명시적으로 금지**한다(anti-plagiarism 소프트웨어 사용 명시). ' +
      'robots 만 보고 후보로 적었다가 고지를 열어 보고 뺐다.',
  },
  {
    id: 'news_in_levels',
    level: '같은 기사 3단계',
    robots: '전면 허용',
    why: '공개 라이선스 고지를 못 찾았다 = 기본값은 전부 보유. 서면 허락 없이는 쓸 수 없다.',
  },
  {
    id: 'bbc_newsround',
    level: '어린이 뉴스 — 수준은 맞다',
    robots: '**명시적 금지**',
    why: 'robots.txt 가 scraping·AI 학습·RAG·데이터셋 생성을 조목조목 금지한다. 측정도 하지 않았다.',
  },
  {
    id: 'commonlit',
    level: '학년별 읽기 지문 — 수준이 매우 알맞다',
    robots: '크롤 허용 · `Content-Signal: ai-train=no, use=reference`',
    why: '크롤은 허용이나 AI 학습 거부를 선언했다. 뜻이 분명해 **측정도 하지 않는다**.',
  },
  { id: 'dogonews', level: '어린이 뉴스', robots: '`ai-train=no`', why: 'CommonLit 과 같은 선언.' },
  {
    id: 'science_news_explores',
    level: '학생용 과학 기사',
    robots: 'GPTBot·ChatGPT-User 차단',
    why: '우리 UA 는 차단 대상이 아니지만 뜻이 분명하다.',
  },
]

/** 아직 확인 못 한 곳 — robots 는 허용이나 **저작권 고지를 안 읽었다.** 읽기 전엔 후보가 아니다. */
const UNCHECKED = [
  { id: 'nasa_climate_kids', why: 'PD 일 가능성이 높으나(미 연방정부) 기사 목록을 못 뽑았다 — sitemap 이 없고 메뉴가 JS 다.' },
  { id: 'natgeo_kids', why: 'robots 는 허용. 저작권 고지 미확인.' },
  { id: 'time_for_kids', why: 'robots 는 허용. 저작권 고지 미확인.' },
  { id: 'british_council_teens', why: 'robots 는 허용. 저작권 고지 미확인.' },
  { id: 'newsela', why: 'robots 는 허용이나 본문이 로그인 뒤에 있다.' },
]

// ── 실행 ─────────────────────────────────────────────────────────────
const report = {
  measuredAt: new Date().toISOString(),
  targetWords: TARGET_WORDS,
  lesson: 'robots.txt 는 라이선스가 아니다 — 크롤 허용과 이용 허락은 다른 일이다.',
  sources: [],
  unavailable: UNAVAILABLE,
  unchecked: UNCHECKED,
}

for (const [id, src] of Object.entries(SOURCES)) {
  console.log(`\n▶ ${id} — ${src.label}`)
  console.log(`  라이선스: ${src.license}`)
  const list = await src.list(SAMPLE)
  if (!list.items?.length) {
    console.log('  ✗ 목록 실패')
    report.sources.push({ id, label: src.label, ok: false })
    continue
  }
  console.log(`  전체 ${list.total} · 표본 ${list.items.length}\n`)

  const measured = []
  for (const item of list.items) {
    const r = await get(src.urlFor(item.id))
    await new Promise((z) => setTimeout(z, 700))
    if (!r.ok) continue
    const m = readability(paragraphs(r.body).join(' '))
    if (!m) continue
    measured.push({ id: item.id, words: m.words, fk: m.fk, sent: m.sentenceLength, band: bandOf(m.fk) })
  }

  const med = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : null)
  const inSpec = measured.filter((x) => x.words >= TARGET_WORDS.min && x.words <= TARGET_WORDS.max)
  const bands = {}
  for (const x of measured) bands[x.band] = (bands[x.band] ?? 0) + 1

  console.log(`  표본 ${measured.length} · 어수 중앙 ${med(measured.map((x) => x.words))} · FK 중앙 ${med(measured.map((x) => x.fk))} · 문장 ${med(measured.map((x) => x.sent))}어`)
  console.log(`  규격(${TARGET_WORDS.min}~${TARGET_WORDS.max}어) 안 ${inSpec.length}/${measured.length} — 나머지는 **발췌하면 든다**`)
  console.log(`  학년 칸 분포: ${Object.entries(bands).map(([k, v]) => `${k} ${v}`).join(' · ')}`)

  report.sources.push({
    id,
    label: src.label,
    ok: true,
    license: src.license,
    robots: src.robots,
    note: src.note,
    total: list.total,
    sampled: measured.length,
    wordsMedian: med(measured.map((x) => x.words)),
    fkMedian: med(measured.map((x) => x.fk)),
    sentMedian: med(measured.map((x) => x.sent)),
    inSpec: inSpec.length,
    bands,
    items: measured,
  })
}

console.log(`\n${'─'.repeat(64)}`)
console.log('쓰지 않는 곳 — robots 가 아니라 **저작권 고지**가 막는 경우가 대부분이다:\n')
for (const u of UNAVAILABLE) console.log(`  ✗ ${u.id}\n      robots: ${u.robots}\n      ${u.why}\n`)
console.log('아직 저작권 고지를 안 읽은 곳(후보 아님):')
for (const u of UNCHECKED) console.log(`  · ${u.id} — ${u.why}`)

fs.writeFileSync(path.resolve(outPath), JSON.stringify(report, null, 2))
console.log(`\n기록 → ${outPath}`)
