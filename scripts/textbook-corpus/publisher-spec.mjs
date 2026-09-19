// scripts/textbook-corpus/publisher-spec.mjs
//
// **출판사별 시장 규격** — `publisher-spec.json`.
//
// ── 왜 합본 규격만으로는 부족한가 (실측 2026-08-31) ──────────────────
// `market-spec.json` 은 79종을 **한 덩어리로 합쳐** 하나의 기준선을 만든다. 그런데
// 이 코퍼스의 구성은 고르지 않다:
//
//   NE능률   60종 3,486쪽   ← 전체 쪽수의 67%
//   EBS       3종   698쪽
//   쎄듀       3종   564쪽
//   미상       9종   438쪽
//   수경출판사   1종    25쪽
//
// 즉 **합본 기준선은 사실상 NE능률의 규격이다.** 합본을 이겼다는 것은 "가중평균을
// 이겼다" 는 뜻이지 "모든 출판사를 이겼다" 는 뜻이 아니다. 평균을 이기면서 특정
// 출판사에 지는 것은 얼마든지 가능하다 — 그리고 그 출판사가 하필 EBS(수능 연계교재
// 발행처)라면 그 패배가 가장 아픈 자리에서 일어난다.
//
// ⚠️ 더 심각한 것 — **해설 축(A1~A4, 7축 중 4축)의 근거는 NE능률 단독이다.**
//   정답해설 문서를 가진 출판사가 NE능률(21종)과 미상(4종)뿐이다. EBS·쎄듀·수경은
//   해설지가 이 코퍼스에 0건이다. 그런데도 리포트는 "79종 5,214쪽 대비" 라고 적어
//   왔다. 4축은 그 표본을 쓰지 않았다. 여기서 그 사실을 **축마다 명시**한다.
//
// ── 표본이 작은 출판사를 어떻게 다루는가 ────────────────────────────
// 임의의 "표본 N개 이상" 문턱을 두지 않는다 — 근거 없는 임계값이기 때문이다.
// 대신 비율 축은 **Wilson 95% 신뢰구간**을 함께 싣고, 벤치마크는 상대의
// **상한(가장 유리한 해석)** 을 기준선으로 쓴다. 표본이 작으면 구간이 넓어져
// 저절로 이기기 어려워진다 — 문턱 없이도 작은 표본이 과대주장을 막는다.
//
// 분위수 축(지문 어수)은 비율이 아니라 구간이라 CI 를 쓸 수 없다. 여기서는
// `market-spec.mjs` 가 이미 쓰는 규칙(학년당 표본 10 미만은 규격으로 보지 않는다)을
// 그대로 따른다. 사본을 만들지 않으려고 추출기를 **인자로 재사용**한다.
//
// 저작권 경계는 `market-spec.mjs` 와 같다 — 집계 통계만 담고 원문은 담지 않는다.
//
// 재실행 안전: 읽기만 한다. 같은 corpus.db 면 결과가 같다.
// 실행: npx tsx --tsconfig apps/web/tsconfig.json scripts/textbook-corpus/publisher-spec.mjs [--print]

import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { HERE, hasFlag, loadSources, log, storePaths, writeJson } from './lib.mjs'
import { wilson95 } from '@vocaflow/library-pipeline'
import {
  extractChoiceCount,
  extractExplanationSpec,
  extractPassageSpec,
  perDocumentTypeSpread,
  extractStems,
} from './market-spec.mjs'

/**
 * 경쟁자로 세울 수 없는 `publisher` 값.
 *
 * - `미상` — 분류기가 출판사를 못 찾은 묶음이다. **"각 출판사를 이겼다" 의 상대가
 *   될 수 없다**(이름을 못 대는 상대는 경쟁자가 아니다). 다만 표본은 버리지 않고
 *   `excluded` 에 근거와 함께 남긴다.
 * - `참고자료` — 3종 3쪽, 학교급 `공통`. 교재가 아니다.
 */
const NOT_A_COMPETITOR = {
  미상: '출판사를 특정할 수 없다 — 이름 있는 경쟁자로 세울 수 없다',
  참고자료: '교재가 아니다 (3종 3쪽 · 학교급 공통)',
  // ── 왜 평가원을 경쟁자 행에 넣지 않는가 ────────────────────────
  //   목표는 "평가원·교육청·출판사를 모두 뛰어넘는" 것이지만, 평가원을 **같은 자로**
  //   견주는 것은 뜻이 없다:
  //     · 해설을 내지 않는다(정답표만) → A1~A4 는 기준선이 0 이라 비율이 성립하지 않는다.
  //     · 남는 A6·A7 만으로는 천장이 1.199 라, EBS 와 똑같이 막힌 행이 하나 더 늘 뿐이다.
  //
  //   평가원의 쓸모는 **경쟁자가 아니라 기준**이다. 우리 교재도 시중 교재도 전부
  //   "수능을 얼마나 닮았는가" 로 평가받는다. 지금 우리 규격은 **수능을 흉내 낸 시중
  //   교재**에서 뽑은 2차 자료인데, 이제 1차 자료(문제지 원본)가 있다.
  //   특히 **고3 지문 창은 존재한 적이 없다** — 코퍼스의 상용 교재가 고2 까지라
  //   V7(고3) 권을 고2 규격으로 재고 있었다.
  평가원: '출제 기관이지 출판사가 아니다 — 경쟁자가 아니라 규격의 원본으로 쓴다 (해설을 내지 않아 해설 축으로는 견줄 수도 없다)',
}

// Wilson 구간은 테스트가 있는 한 벌을 쓴다 (publisher-index.test.ts).
// ⚠️ 그래서 이 스크립트는 `tsx` 로 돌린다 — 순수 node 는 패키지의 TS 를 못 읽는다.

/** 한 출판사의 기본 제원 — 몇 종·몇 쪽·몇 시리즈이며 어떤 역할의 문서를 갖고 있는가. */
function publisherProfile(db, pub) {
  const base = db.prepare(`
    SELECT count(*) docs, sum(pages) pages, count(DISTINCT series) series
    FROM docs WHERE publisher = ? AND status IN ('ok','ocr')`).get(pub)
  const roles = db.prepare(`
    SELECT role, count(*) n, sum(pages) pages
    FROM docs WHERE publisher = ? AND status IN ('ok','ocr')
    GROUP BY role ORDER BY pages DESC`).all(pub)
  const schools = db.prepare(`
    SELECT DISTINCT school FROM docs WHERE publisher = ? AND school IS NOT NULL`).all(pub)
  return {
    docs: base.docs,
    pages: base.pages ?? 0,
    series: base.series,
    schools: schools.map((r) => r.school),
    roles: Object.fromEntries(roles.map((r) => [r.role, { docs: r.n, pages: r.pages }])),
  }
}

/**
 * 해설 축에 CI 를 붙인다. `extractExplanationSpec` 은 비율만 돌려주므로
 * 분자를 되살려야 하는데, 비율 × 표본수는 반올림 때문에 원본과 어긋날 수 있다.
 * 그래서 반올림 오차가 ±0.5 건을 넘지 않도록 **round** 로 되살리고, 그 사실을 적는다.
 */
function withExplanationCi(exp) {
  if (!exp || exp.insufficient) return exp
  const n = exp.blocksMeasured
  return {
    ...exp,
    wrongOptionMentionCi: wilson95(Math.round(exp.wrongOptionMentionRate * n), n),
    sourceCitationCi: wilson95(Math.round(exp.sourceCitationRate * n), n),
    ciNote: '분자는 비율×표본수를 반올림해 되살린 값이다 (오차 ±0.5건). 구간 폭에는 영향이 없다',
  }
}

/** 선택지 축에 CI 를 붙인다 — 학교급마다 따로. */
function withChoiceCi(choice) {
  const out = {}
  for (const [band, v] of Object.entries(choice)) {
    out[band] = {
      ...v,
      fiveChoiceCi: wilson95(v.byCount?.['5'] ?? v.byCount?.[5] ?? 0, v.itemsMeasured),
    }
  }
  return out
}

function main() {
  const src = loadSources()
  const sp = storePaths(src.store)
  const db = new DatabaseSync(sp.db, { readOnly: true })

  const rows = db.prepare(`
    SELECT publisher, count(*) docs, sum(pages) pages
    FROM docs WHERE status IN ('ok','ocr') AND publisher IS NOT NULL
    GROUP BY publisher ORDER BY sum(pages) DESC`).all()

  const publishers = []
  const excluded = []

  for (const r of rows) {
    const pub = r.publisher
    if (NOT_A_COMPETITOR[pub]) {
      excluded.push({ publisher: pub, docs: r.docs, pages: r.pages, why: NOT_A_COMPETITOR[pub] })
      continue
    }
    const stems = extractStems(db, pub)
    publishers.push({
      publisher: pub,
      profile: publisherProfile(db, pub),
      passageWords: extractPassageSpec(db, pub),
      explanation: withExplanationCi(extractExplanationSpec(db, pub)),
      choiceCount: withChoiceCi(extractChoiceCount(db, pub)),
      typeCoverage: {
        standardStems: stems.length,
        distinctOurTypesCovered: [...new Set(stems.map((s) => s.ourType).filter(Boolean))].sort(),
        perDocument: perDocumentTypeSpread(db, pub),
      },
    })
  }

  const spec = {
    $schema: 'publisher-spec/1',
    generatedAt: new Date().toISOString(),
    method: {
      why: '합본 기준선은 쪽수 가중평균이라 특정 출판사에 지는 것을 감춘다. 출판사마다 따로 잰다',
      baselineRule: '비율 축은 상대의 Wilson 95% 상한을 기준선으로 쓴다 — 상대에게 가장 유리한 해석으로도 이겨야 우위로 친다',
      quantileRule: '분위수 축(지문 어수)은 학년당 표본 10 미만이면 규격으로 세지 않는다 (market-spec.mjs 와 같은 규칙)',
      copyright: '집계 통계만 담는다. 지문·해설 원문은 담지 않는다',
      notCompetitor: Object.keys(NOT_A_COMPETITOR),
    },
    publishers,
    excluded,
  }

  db.close()

  if (hasFlag('--print')) {
    console.log(JSON.stringify(spec, null, 2))
    return
  }

  const out = path.resolve(HERE, '../../packages/library-pipeline/src/textbook/publisher-spec.json')
  writeJson(out, spec)
  writeJson(path.join(sp.root, 'publisher-spec.json'), spec)

  log(`출판사별 규격 → ${out}`)
  for (const p of publishers) {
    const exp = p.explanation
    const expTxt = exp.insufficient
      ? '해설 —'
      : `해설 ${exp.blocksMeasured}블록 · 오답배제 ${(exp.wrongOptionMentionRate * 100).toFixed(1)}%`
    log(`  ${p.publisher.padEnd(8)} ${String(p.profile.docs).padStart(2)}종 ${String(p.profile.pages).padStart(5)}쪽 · 지문규격 ${Object.keys(p.passageWords).length}학년대 · ${expTxt}`)
  }
  for (const e of excluded) log(`  (제외) ${e.publisher} ${e.docs}종 ${e.pages}쪽 — ${e.why}`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main()
