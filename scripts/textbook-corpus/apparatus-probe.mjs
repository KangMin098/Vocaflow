// scripts/textbook-corpus/apparatus-probe.mjs
//
// **교재의 구성요소를 센다 — "우리 교재가 시중만 한가" 를 문항이 아니라 *책*으로 묻는다.**
//
// ── 왜 이 자가 필요한가 (2026-09-06) ────────────────────────────────
// `market-benchmark.mjs` 는 **문항과 해설**을 잰다(A1~A7). 그 자로 우리는 이미 1.2 근처다.
// 그런데 사용자가 지적한 것은 그 축이 아니다 — "교재 전체(표지부터 모든 구성요소)".
//
// 시중 교재는 문항만 파는 물건이 아니다. 표지 · 머리말 · 이 책의 구성과 특징 · 목차 ·
// 학습 계획표 · 단원 도입 · 어휘 정리 · 직독직해 · Review · 정답과 해설 · 부록 · 판권지 —
// 이 **껍데기 전부가 상품**이고, 학습자가 "진짜 교재" 로 인정하는 근거다.
// 문항 지수가 1.2 여도 껍데기가 0 이면 학습자에게는 교재가 아니라 문제 목록이다.
//
// ── 무엇을 세는가 ───────────────────────────────────────────────────
// 코퍼스 79종의 **본문 전체**에서 구성요소 표지(標識)를 찾는다. 문서 하나가 아니라
// **시리즈 하나**를 한 권으로 본다 — 시중 교재는 본책·해설·워크북·단어장이 따로 온다.
// 그 넷을 다른 책으로 세면 "정답해설이 없는 책" 이 만들어져 기준선이 낮아진다.
//
// ⚠️ **오탐을 먼저 잰다.** 표지어가 본문 한가운데 나오는 일이 흔하다("this book" 등).
//   그래서 ① 줄 시작 부근에서만 ② 최소 등장 쪽수를 요구하고 ③ 검출된 쪽 번호를 함께 낸다.
//   `--why <component>` 로 근거 쪽을 직접 볼 수 있다.
//
// 재실행 안전: 코퍼스 DB **읽기 전용**. 저장소 파일을 쓰지 않는다(--json 으로 stdout).
//
// 실행:
//   node scripts/textbook-corpus/apparatus-probe.mjs
//   node scripts/textbook-corpus/apparatus-probe.mjs --json
//   node scripts/textbook-corpus/apparatus-probe.mjs --why toc

import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'

import { loadSources, storePaths } from './lib.mjs'

const argOf = (flag, fallback = null) => {
  const i = process.argv.indexOf(flag)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const AS_JSON = process.argv.includes('--json')
const WHY = argOf('--why')

/**
 * 구성요소 사전.
 *
 * `any` 중 하나라도 걸리면 그 쪽은 그 요소의 후보다. `minPages` 는 **오탐 방어** —
 * 한 쪽에서 한 번 스친 말은 구성요소가 아니다(목차·해설처럼 여러 쪽을 먹는 것은 특히).
 *
 * ⚠️ 한국어 교재라 한글 표지어가 정본이고 영문은 보조다. `학습 계획표` 처럼 띄어쓰기가
 *   출판사마다 다른 것은 공백을 선택적으로 둔다.
 */
const COMPONENTS = [
  {
    key: 'preface',
    label: '머리말',
    minPages: 1,
    any: [/머\s*리\s*말/, /책을\s*펴내며/, /저자의\s*말/, /\bPreface\b/i, /들어가는\s*말/],
  },
  {
    key: 'features',
    label: '이 책의 구성과 특징',
    minPages: 1,
    any: [
      /이\s*책의\s*(구성|특징)/,
      /구성과\s*특징/,
      /이\s*책의\s*활용/,
      /\bHow\s+to\s+(Use|Study)\b/i,
      /\bFeatures\s+of\s+This\s+Book\b/i,
    ],
  },
  {
    key: 'toc',
    label: '목차',
    minPages: 1,
    any: [/^\s*목\s*차\s*$/m, /\bCONTENTS\b/, /\bTable\s+of\s+Contents\b/i],
  },
  {
    key: 'studyplan',
    label: '학습 계획표',
    minPages: 1,
    any: [/학습\s*계획표/, /학습\s*플래너/, /\bStudy\s*Plan(ner)?\b/i, /진도\s*표/],
  },
  {
    key: 'unitopener',
    label: '단원 도입 · 학습 목표',
    minPages: 2,
    any: [
      /학습\s*목표/,
      /\bLearning\s+Objectives?\b/i,
      /\bWarm[-\s]?up\b/i,
      /단원\s*(도입|미리보기)/,
    ],
  },
  {
    key: 'wordlist',
    // ⚠️ 첫 측정에서 이 축이 **0%** 였다 — 능률VOCA 가 있는 코퍼스에서 0 은 자가 틀렸다는 뜻이다.
    //   원인 둘: ① minPages 3 이 과했다(어휘 리스트는 별책이라 본책에는 안내 몇 줄만 남는다)
    //           ② 별책 자체는 `role='단어장'` 으로 이미 분류돼 있는데 본문만 보고 있었다.
    //   그래서 문턱을 2로 낮추고 **역할 증거**를 함께 인정한다(§roleEvidence).
    label: '어휘 정리',
    minPages: 2,
    roles: ['단어장'],
    any: [
      /\bWORD\s*LIST\b/i,
      /\bVocabulary\s+(List|Check|Preview|Test)\b/i,
      /어휘\s*(정리|리스트|노트|목록|테스트)/,
      /단어\s*(정리|목록|테스트)/,
    ],
  },
  {
    key: 'syntax',
    label: '직독직해 · 구문 분석',
    minPages: 3,
    any: [/직독\s*직해/, /구문\s*(분석|풀이|해설)/, /끊어\s*읽기/, /\bStructure\s+Analysis\b/i],
  },
  {
    key: 'review',
    label: '복습 · 단원 평가',
    minPages: 2,
    any: [/\bReview\s*(Test|Check|Quiz)\b/i, /단원\s*(평가|점검|마무리)/, /중간\s*점검/, /\bMini\s*Test\b/i],
  },
  {
    key: 'answerkey',
    label: '정답과 해설',
    minPages: 3,
    roles: ['정답해설', '빠른정답'],
    any: [/정답\s*(과|및)?\s*해설/, /빠른\s*정답/, /\bAnswer\s*(Key|s)\b/i, /해설\s*편/],
  },
  {
    key: 'translation',
    label: '전문 해석',
    minPages: 3,
    any: [/전문\s*해석/, /지문\s*해석/, /본문\s*해석/, /해석\s*[:：]/],
  },
  {
    key: 'appendix',
    label: '부록',
    minPages: 1,
    any: [/^\s*부\s*록/m, /\bAppendix\b/i, /불규칙\s*동사/, /어휘\s*색인/, /\bIndex\b/],
  },
  {
    key: 'colophon',
    label: '판권지',
    minPages: 1,
    any: [/\bISBN\b/, /펴낸\s*(이|곳)/, /발행\s*(인|처|일)/, /초판\s*\d*\s*쇄?\s*발행/],
  },
  {
    key: 'extras',
    label: '부가 자료 안내',
    minPages: 1,
    any: [
      /\bMP3\b/i,
      /무료\s*(부가|학습)\s*자료/,
      /부가\s*서비스/,
      /단어\s*시험지/,
      /온라인\s*학습/,
      /\bQR\s*코드/i,
    ],
  },
  {
    key: 'difficulty',
    label: '난이도 표시',
    minPages: 2,
    any: [/난이도\s*[:：★*]/, /★{2,}/, /\bLevel\s*[1-5]\b/i, /상\s*중\s*하/],
  },
]

function main() {
  const { db: dbPath } = storePaths(loadSources().store)
  if (!fs.existsSync(dbPath)) {
    console.error(`코퍼스 DB 가 없다: ${dbPath}\n먼저 node scripts/textbook-corpus/build-db.mjs`)
    process.exit(1)
  }
  const db = new DatabaseSync(dbPath, { readOnly: true })

  const docs = db
    .prepare(
      `SELECT id, series, publisher, role, school, category, pages
         FROM docs
        WHERE status IN ('ok','ocr') AND pages > 0`,
    )
    .all()

  // 시리즈 하나 = 책 한 종. 본책·해설·워크북이 따로 와도 학습자가 사는 것은 그 한 종이다.
  const bySeries = new Map()
  for (const d of docs) {
    // 시리즈가 비었으면 파일 하나를 한 종으로 본다 — 묶을 근거가 없다.
    const key = d.series && d.series !== '미상' ? `${d.publisher}::${d.series}` : `doc::${d.id}`
    if (!bySeries.has(key)) {
      bySeries.set(key, { key, publisher: d.publisher, series: d.series, docs: [], pages: 0 })
    }
    const s = bySeries.get(key)
    s.docs.push(d)
    s.pages += d.pages
  }

  const pageStmt = db.prepare(`SELECT p, text FROM pages WHERE doc_id = ?`)

  const whyHits = []

  for (const s of bySeries.values()) {
    const hits = new Map(COMPONENTS.map((c) => [c.key, new Set()]))
    for (const d of s.docs) {
      for (const row of pageStmt.all(d.id)) {
        const t = row.text
        if (!t) continue
        for (const c of COMPONENTS) {
          if (c.any.some((re) => re.test(t))) {
            hits.get(c.key).add(`${d.id}:${row.p}`)
            if (WHY === c.key && whyHits.length < 12) {
              whyHits.push({ series: s.series, doc: d.id, page: row.p, excerpt: excerptOf(t, c.any) })
            }
          }
        }
      }
    }
    // §roleEvidence — 별책은 본문 표지어가 아니라 **역할 분류**가 증거다.
    // 단어장·정답해설은 따로 오는 책이라, 본책 본문만 뒤지면 "없다" 는 틀린 답이 나온다.
    const roles = new Set(s.docs.map((d) => d.role))
    s.components = {}
    for (const c of COMPONENTS) {
      const n = hits.get(c.key).size
      const byRole = (c.roles ?? []).some((r) => roles.has(r))
      s.components[c.key] = n >= c.minPages || byRole
    }
    s.count = COMPONENTS.filter((c) => s.components[c.key]).length
  }

  // 참조 기준으로 쓸 만한 종만 남긴다 — 미리보기 몇 쪽짜리를 한 종으로 세면 중앙값이 무너진다.
  const MIN_PAGES = 20
  const shelf = [...bySeries.values()].filter((s) => s.pages >= MIN_PAGES)
  const thin = [...bySeries.values()].filter((s) => s.pages < MIN_PAGES)

  const counts = shelf.map((s) => s.count).sort((a, b) => a - b)
  const median = counts.length
    ? counts.length % 2
      ? counts[(counts.length - 1) / 2]
      : (counts[counts.length / 2 - 1] + counts[counts.length / 2]) / 2
    : 0
  const max = counts.length ? counts[counts.length - 1] : 0

  const perComponent = COMPONENTS.map((c) => ({
    key: c.key,
    label: c.label,
    seriesWith: shelf.filter((s) => s.components[c.key]).length,
    rate: shelf.length ? shelf.filter((s) => s.components[c.key]).length / shelf.length : 0,
  }))

  const out = {
    measuredAt: new Date().toISOString(),
    corpus: { docs: docs.length, series: bySeries.size, shelf: shelf.length, thin: thin.length, minPages: MIN_PAGES },
    market: { medianComponents: median, maxComponents: max, total: COMPONENTS.length },
    perComponent,
    series: shelf
      .map((s) => ({ publisher: s.publisher, series: s.series, pages: s.pages, count: s.count, components: s.components }))
      .sort((a, b) => b.count - a.count),
  }

  if (WHY) {
    out.why = whyHits
  }

  if (AS_JSON) {
    process.stdout.write(JSON.stringify(out, null, 2))
    return
  }

  console.log('\n교재 구성요소 실측 — 시리즈를 한 권으로 센다\n')
  console.log(
    `  코퍼스 ${out.corpus.docs}문서 → ${out.corpus.series}종 (${MIN_PAGES}쪽 이상 ${shelf.length}종 · 미달 ${thin.length}종 제외)`,
  )
  console.log(
    `  시중 구성요소 — 중앙값 ${median} / ${COMPONENTS.length}축 · 최다 ${max}축\n`,
  )
  console.log('  요소                        보유 종   비율')
  console.log('  ' + '─'.repeat(48))
  for (const c of perComponent.sort((a, b) => b.rate - a.rate)) {
    console.log(
      `  ${c.label.padEnd(22, ' ')} ${String(c.seriesWith).padStart(5)}   ${(c.rate * 100).toFixed(0).padStart(3)}%`,
    )
  }
  console.log('\n  상위 종')
  for (const s of out.series.slice(0, 10)) {
    console.log(`    ${String(s.count).padStart(2)}축  ${s.publisher} · ${s.series} (${s.pages}쪽)`)
  }
  if (WHY) {
    console.log(`\n  --why ${WHY} 근거`)
    for (const h of whyHits) console.log(`    ${h.series} p.${h.page} — ${h.excerpt}`)
  }
  console.log()
}

/** 검출 근거 한 줄 — 오탐 확인용. */
function excerptOf(text, regexes) {
  for (const re of regexes) {
    const m = re.exec(text)
    if (m) {
      const i = Math.max(0, m.index - 30)
      return text.slice(i, m.index + m[0].length + 40).replace(/\s+/g, ' ').trim()
    }
  }
  return ''
}

main()
