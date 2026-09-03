// scripts/textbook/longform-pd-probe.mjs
//
// **장문 PD 를 발췌해 초·중 칸을 채울 수 있는가** — 이제야 물을 수 있는 질문.
//
// ── 왜 이제야인가 ────────────────────────────────────────────────────
// 2026-09-02 조사에서 Project Gutenberg 를 "열리지만 **단위가 책 한 권**이라 발췌해야
// 초·중 창에 든다" 며 후보에서 뺐다. 그때는 발췌 경로가 없었다.
// 지금은 `excerptForBand` 가 있고, **문단 경계에서 자르고 자른 뒤 다시 재는** 규칙까지
// 갖췄다. 그래서 그때 접었던 가장 큰 재고를 다시 꺼낸다.
//
//     Project Gutenberg 영어 아동물 **7,634권**
//     라이선스: "The vast majority of Project Gutenberg eBooks are in the public domain in
//               the US … 'As you please' includes **any commercial use, republishing in any
//               format, making derivative works** or performances"
//
// ── 무엇을 재는가 ────────────────────────────────────────────────────
// 책 한 권에서 **어느 학년 칸의 조각이 몇 개 나오는가.** 한 권에서 여러 칸이 나올 수 있다 —
// 도입부는 쉽고 뒤로 갈수록 문장이 길어지는 책이 흔하기 때문이다.
//
// ⚠️ **PG 머리말·꼬리말을 반드시 뗀다.** `*** START OF THE PROJECT GUTENBERG EBOOK ***`
//   사이만 본문이다. 안 떼면 라이선스 안내문(법률 문장 · FK 15+)이 지문으로 세어져
//   책 전체가 "중3 초과" 로 보인다.
//
// 재실행 안전: GET 만 한다. **PG 서버를 아끼려고 표본을 작게 잡고 사이를 넉넉히 띄운다.**
//
// 실행:
//   pnpm dlx tsx scripts/textbook/longform-pd-probe.mjs
//   pnpm dlx tsx scripts/textbook/longform-pd-probe.mjs --sample 12

import fs from 'node:fs'
import path from 'node:path'

import { excerptForBand } from '../../packages/library-pipeline/src/textbook/excerpt.ts'
import {
  READING_LEVEL_BANDS,
  readability,
} from '../../packages/library-pipeline/src/textbook/readability.ts'
// **FK 만으로는 19세기 영어를 못 거른다** — 교육과정 별표로 어휘를 함께 본다.
import { curriculumCoverage } from '../../packages/library-pipeline/src/textbook/curriculum.ts'

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const SAMPLE = Number(arg('sample') ?? 8)
const outPath = arg('out') ?? 'docs/reports/longform-pd-probe.json'

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
 * `node:https` 로 직접 받는다 — **`fetch` 로는 gutenberg.org 를 못 연다.**
 *
 * 실측: 같은 주소를 curl 은 1.7초에 174KB 받아 오는데 `fetch` 는 전부 `HTTP 0` 이었다.
 * undici 의 연결 타임아웃(기본 10초)은 `AbortController` 로 못 늘리고, 이 저장소엔
 * `undici` 패키지가 없어 Agent 로도 못 고친다. **소스가 죽은 게 아니라 클라이언트가
 * 못 기다린 것**이므로 기다릴 수 있는 클라이언트로 바꾼다.
 * (`kid-source-probe.mjs` 의 `getSlow` 와 같은 이유·같은 해법이다.)
 */
async function getSlow(url, { timeout = 120_000 } = {}) {
  const https = await import('node:https')
  return new Promise((resolve) => {
    const req = https.get(url, { headers: { 'user-agent': UA }, timeout }, (res) => {
      // 구텐베르크는 미러로 302 를 준다 — 따라간다.
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume()
        return resolve(getSlow(new URL(res.headers.location, url).toString(), { timeout }))
      }
      if (res.statusCode >= 400) {
        res.resume()
        return resolve({ ok: false, status: res.statusCode, body: '' })
      }
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (c) => (body += c))
      res.on('end', () => resolve({ ok: true, status: res.statusCode, body }))
    })
    req.on('timeout', () => {
      req.destroy()
      resolve({ ok: false, status: 0, error: `${timeout}ms 안에 응답 없음`, body: '' })
    })
    req.on('error', (e) => resolve({ ok: false, status: 0, error: String(e.message), body: '' }))
  })
}

/**
 * PG 본문만 남긴다. **머리말·꼬리말이 곧 라이선스 안내문**이고 법률 문장이라 FK 가 15 를 넘는다 —
 * 안 떼면 어떤 동화책이든 "중3 초과" 로 나온다.
 */
export function stripGutenbergWrapper(text) {
  const t = String(text ?? '')
  const start = t.search(/\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^*]*\*\*\*/i)
  const end = t.search(/\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^*]*\*\*\*/i)
  if (start < 0) return t
  const from = t.indexOf('***', t.indexOf('***', start) + 3) + 3
  return t.slice(from, end > 0 ? end : undefined).trim()
}

/**
 * 빈 줄로 나뉜 문단. 구텐베르크 평문은 줄바꿈이 문단 안에도 있어서 **빈 줄**이 경계다.
 * 8낱말 미만은 장 제목·삽화 캡션이라 뺀다.
 */
export function plainTextParagraphs(text) {
  return String(text ?? '')
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.split(/\s+/).filter(Boolean).length >= 8)
}

const report = {
  measuredAt: new Date().toISOString(),
  source: 'project_gutenberg',
  books: [],
  /** FK 창에만 든 조각 수. */
  bandTotals: {},
  /** 그중 **어휘 가드까지 통과한** 조각 수 — 실제로 쓸 수 있는 것은 이쪽이다. */
  bandKept: {},
}

const list = await get(`https://gutendex.com/books/?topic=children&languages=en`)
if (!list.ok) {
  console.error(`Gutendex 목록 실패: HTTP ${list.status}`)
  process.exit(1)
}
const json = JSON.parse(list.body)
console.log(
  `\nProject Gutenberg 영어 아동물 **${json.count.toLocaleString()}권** · 표본 ${SAMPLE}\n`
)

const pad = (s, w) => String(s).padEnd(w)
const lp = (s, w) => String(s).padStart(w)
console.log(pad('책', 40) + lp('본문어수', 9) + lp('문단', 6) + '  칸별 FK적중→어휘가드 통과')
console.log('─'.repeat(78))

for (const b of json.results.slice(0, SAMPLE)) {
  // **`www.gutenberg.org` 는 Node 의 TLS 핸드셰이크를 끊는다** — 공식 미러로 간다.
  //
  //   실측: 같은 주소를 curl 은 1.7초에 174KB 받아 오는데 Node 는
  //   "Client network socket disconnected before secure TLS connection was established" 로 죽는다.
  //   헤더를 보강해도 같고, `fetch` 든 `node:https` 든 같다.
  //   반면 공식 미러 `gutenberg.pglaf.org/cache/epub/<id>/pg<id>.txt` 는 그대로 열린다.
  //
  //   **소스가 죽은 게 아니라 클라이언트가 못 붙는 것**이다 — 이 저장소가 세 번째 겪는 꼴이라
  //   처음엔 `HTTP 0` 만 찍고 `error` 를 버려서 이유를 못 봤다. 이유를 찍게 고치고 나서야 보였다.
  const txtUrl = `https://gutenberg.pglaf.org/cache/epub/${b.id}/pg${b.id}.txt`

  const r = await getSlow(txtUrl)
  await new Promise((z) => setTimeout(z, 2_500)) // PG 서버를 아낀다
  if (!r.ok) {
    // **이유를 감추지 않는다** — 처음엔 `HTTP 0` 만 찍고 error 를 버려서
    //   연결 실패인지 TLS 문제인지 분간할 수 없었다.
    console.log(
      pad(b.title.slice(0, 38), 40) + lp(`HTTP ${r.status}`, 9) + (r.error ? `  ${r.error}` : '')
    )
    continue
  }

  const body = stripGutenbergWrapper(r.body)
  const paras = plainTextParagraphs(body)
  const whole = readability(body)

  // **책 전체를 한 덩이로 보지 않는다** — 앞에서부터 문단을 옮겨 가며 칸마다 조각을 찾는다.
  //   한 권에서 여러 칸이 나올 수 있다(도입부는 쉽고 뒤로 갈수록 문장이 길어지는 책이 흔하다).
  // ⚠️ **상한을 두지 않는다.** 처음엕 `hits < 20` 으로 끊었는데
  //   **모든 책이 모든 칸에서 정확히 20** 이 나왔다 — 그건 수율이 아니라 상한이다.
  //   수율로 읽힐 수가 상한에 닿아 있으면 그 표는 아무것도 말하지 않는다.
  //   지금은 끝까지 세고, **몷 번 시도해서 몇 번 들었는지(적중률)** 를 함께 낸다.
  // ⚠️ **상한을 두면 수율이 아니라 상한을 보고하게 된다.**
  //   처음엔 `hits < 20` 으로 끊었는데 **모든 책이 모든 칸에서 정확히 20** 이 나왔다.
  //
  // ⚠️ 그렇다고 `excerptForBand` 를 모든 시작점마다 부르면 **O(문단²)** 이다 —
  //   그 함수가 이미 모든 시작점을 훑기 때문이고, 4,126문단짜리 책에서 10분을 넘겨 죽었다.
  //   그래서 여기서는 **시작점마다 한 번만 앞으로 불려** 직접 센다(선형).
  const STEP = 5
  const MAX_WINDOWS = 400 // 한 책을 끝까지 보지 않는다 — 수율은 앞쪽만으로도 보인다
  const found = {}
  const found2 = {}
  const rate = {}
  let windows = 0
  const bandOfWindow = []
  for (let i = 0; i < paras.length && windows < MAX_WINDOWS; i += STEP) {
    windows++
    let acc = ''
    let w = 0
    for (let j = i; j < paras.length; j++) {
      acc = acc ? `${acc} ${paras[j]}` : paras[j]
      w = (acc.match(/[A-Za-z][A-Za-z'-]*/g) || []).length
      if (w < 100) continue
      if (w > 200) break
      const m = readability(acc)
      // **FK 와 어휘를 함께 재다.** FK 만 보면 19세기 영어가 초6~쥅1 로 통과한다.
      if (m) bandOfWindow.push({ fk: m.fk, outside: curriculumCoverage(acc)?.outsidePct ?? 100 })
      break
    }
  }
  for (const band of READING_LEVEL_BANDS) {
    const inBand = bandOfWindow.filter((x) => x.fk >= band.fkMin && x.fk <= band.fkMax)
    const hits = inBand.length
    // 어휘 가드까지 통과하는 조각 — **이쪽이 실제로 쓸 수 있는 수다.**
    const kept = inBand.filter((x) => x.outside <= 40).length
    found2[band.id] = kept
    report.bandKept[band.id] = (report.bandKept[band.id] ?? 0) + kept
    if (hits) found[band.id] = hits
    rate[band.id] = windows ? +((hits / windows) * 100).toFixed(0) : 0
    report.bandTotals[band.id] = (report.bandTotals[band.id] ?? 0) + hits
  }

  report.books.push({
    id: b.id,
    title: b.title,
    words: whole?.words ?? null,
    fkWhole: whole?.fk ?? null,
    paragraphs: paras.length,
    windows,
    bandHits: found,
    bandKeptAfterVocabGate: found2,
    bandHitRatePct: rate,
  })
  console.log(
    pad(b.title.slice(0, 38), 40) +
      lp((whole?.words ?? 0).toLocaleString(), 9) +
      lp(paras.length, 6) +
      '  ' +
      (Object.entries(found)
        .map(([k, v]) => `${k} ${v}→${found2[k] ?? 0}`)
        .join(' · ') || '(없음)')
  )
}

console.log('─'.repeat(78))
console.log('\n칸별 조각 합계 (표본 ' + report.books.length + '권):')
for (const band of READING_LEVEL_BANDS) {
  const n = report.bandTotals[band.id] ?? 0
  const k = report.bandKept[band.id] ?? 0
  const per = report.books.length ? (k / report.books.length).toFixed(1) : '0'
  const drop = n ? (((n - k) / n) * 100).toFixed(0) : '0'
  console.log(
    `  ${pad(band.id, 10)} FK적중 ${lp(n, 5)} → 어휘가드 통과 ${lp(k, 5)} (${drop}% 탈락) · 책당 ${per}`
  )
}
console.log(
  `\n전체 ${json.count.toLocaleString()}권 기준 추정 — 책당 조각 수 × 7,634. ` +
    `표본이 작으니 자릿수만 본다.`
)
console.log('⚠️ 발췌는 원문 그대로를 싣는 것이라 PD 라야 한다 — PG 는 상업 이용까지 명시 허용이다.')

fs.writeFileSync(path.resolve(outPath), JSON.stringify(report, null, 2))
console.log(`\n기록 → ${outPath}`)
