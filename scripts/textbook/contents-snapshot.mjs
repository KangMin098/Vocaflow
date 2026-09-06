// scripts/textbook/contents-snapshot.mjs
//
// **조판된 권의 목차와 미리보기 단원을 스냅샷으로 굽는다.**
//
// ── 왜 필요한가 (2026-09-06) ────────────────────────────────────────
// 학습자 상세면에 **목차가 없었다.** 이 저장소는 오랫동안 목차를 일부러 막아 왔는데
// 이유가 옳았다 — 재고 수만으로 목차를 지으면 실제보다 부풀려진다(한 단원의 문항은
// 서로 다른 원글에서 와야 하고, 지문은 학년 길이 창에 들어야 한다).
//
// 그 금지는 **재고로 짓지 말라**는 것이지 목차를 내지 말라는 것이 아니었다.
// 그래서 여기서는 **조판과 같은 코드 경로**(`loadVolume`)로 실제 단원을 조합한 뒤
// 그 결과만 적는다. 화면은 이 파일을 읽을 뿐 아무것도 짓지 않는다.
//
// ── 왜 DB 가 아니라 스냅샷 파일인가 ─────────────────────────────────
// ① 상세면은 **비로그인에 열린 공개 표면**이라 조회가 늘면 그대로 비용이 된다.
//    조합은 밴드 하나에 수천 편을 훑는 일이라 요청마다 할 수 없다.
// ② 이 저장소에 이미 같은 패턴이 있다 — `lib/textbook/source-eligibility-snapshot.json`.
// ③ 마이그레이션이 필요 없다. 굽는 시점이 파일에 적히므로 낡으면 낡은 것이 보인다.
//
// ── 지어내지 않는 것 ────────────────────────────────────────────────
// · **단원 제목을 짓지 않는다.** 한 단원의 네 문항은 서로 다른 원글에서 오므로
//   단원을 대표하는 제목이 존재하지 않는다. 대신 그 단원이 쓴 **지문들의 실제 제목**을 적는다.
// · **전문 해석·직독직해는 넣지 않는다.** 재고에 그 열이 없다(실측 2026-09-06:
//   `answer_key` 의 키는 explanation_ko · rationale_ko … 뿐이고 해석 열이 없다).
//   없는 것을 화면이 약속하면 그 순간 과장이 된다.
// · **해설이 없는 문항은 없다고 적는다.** 조판기와 같은 `pickExplanation` 규칙을 쓴다.
//
// 재실행 안전: DB **읽기만** 한다. 산출물은 지정한 JSON 한 개를 덮어쓴다.
// 몇 번 돌려도 결과가 같다(재고가 바뀌면 바뀌는 것이 맞다 — 굽는 시점을 함께 적는다).
//
// 실행:
//   npx tsx --tsconfig apps/web/tsconfig.json scripts/textbook/contents-snapshot.mjs
//   ... --bands 4,5 --units 10 --out <경로>

import fs from 'node:fs'
import path from 'node:path'

import { loadEnv, loadVolume } from './volume-pool.mjs'

loadEnv()

const arg = (n, fallback = null) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const { createClient } = await import('@supabase/supabase-js')
const {
  SERIES_SPINE,
  MARKET_UNITS_PER_BOOK,
  toCsatOrder,
  toCsatInsert,
  explainOrder,
  explainInsert,
  explainItem,
  countPassageWords,
} = await import('@vocaflow/library-pipeline')

const BANDS = (arg('bands') ?? SERIES_SPINE.map((r) => r.vLevels[0]).join(','))
  .split(',')
  .map((x) => Number(x.trim()))
  .filter(Number.isInteger)
const UNITS = Number(arg('units') ?? MARKET_UNITS_PER_BOOK.median)
const OUT = path.resolve(arg('out') ?? 'apps/web/src/lib/textbook/volume-contents.json')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 없다 (apps/web/.env.local)')
  process.exit(1)
}
const db = createClient(url, key, { auth: { persistSession: false } })

/**
 * 해설을 고른다 — **조판기와 같은 규칙.**
 * 두 곳이 다르면 책과 화면이 서로 다른 말을 한다.
 */
function pickExplanation(item, deterministic) {
  const batch = item.answer_key?.explanation_ko
  if (typeof batch === 'string' && batch.trim()) return { text: batch.trim(), from: 'batch' }
  const rationale = item.answer_key?.rationale_ko
  if (typeof rationale === 'string' && rationale.trim()) return { text: rationale.trim(), from: 'batch' }
  if (typeof deterministic?.ko === 'string' && deterministic.ko.trim()) {
    return { text: deterministic.ko.trim(), from: 'rule' }
  }
  if (deterministic?.body) {
    return { text: deterministic.body.split('\n').slice(2).join('\n').trim(), from: 'rule' }
  }
  return null
}

/**
 * 문항 하나를 **구조로** 낸다 — HTML 이 아니다.
 *
 * 조판기는 HTML 을 뽑지만 화면은 React 로 그리므로, 여기서 HTML 을 구우면 화면이
 * `dangerouslySetInnerHTML` 을 쓰게 된다. 같은 값을 두 모양으로 내는 대신 구조만 낸다.
 *
 * **화면이 그릴 수 있는 모양만 낸다** — 순서 · 삽입 · 지문+5지선다 셋. 나머지(중등 단답·배열
 * 등)는 모양이 제각각이라 지금 화면이 못 그린다. 못 그리는 것을 스냅샷에 넣으면
 * 미리보기가 빈 자리로 나오므로 **아예 빼고**, 그만큼 미리보기 문항 수가 줄어든 것을 밝힌다.
 */
function structureItem(item, no) {
  if (item.type === 'order') {
    const q = toCsatOrder(item.payload?.presented ?? [], item.answer_key?.source_order ?? [])
    if (!q) return null
    return {
      no,
      type: 'order',
      stem: '주어진 글 다음에 이어질 글의 순서로 가장 적절한 것은?',
      intro: q.intro,
      blocks: q.blocks.map((b) => ({ label: b.label, text: b.sentences.join(' ') })),
      choices: q.choices.map((c) => c.map((l) => `(${l})`).join(' - ')),
      answer: q.answer,
      explanation: pickExplanation(item, explainOrder(q)),
      source: item.ref_title ?? null,
    }
  }
  if (item.type === 'insert') {
    const q = toCsatInsert(
      item.payload?.remaining ?? [],
      item.payload?.insert_sentence ?? '',
      item.answer_key?.position,
    )
    if (!q) return null
    return {
      no,
      type: 'insert',
      stem: '글의 흐름으로 보아, 주어진 문장이 들어가기에 가장 적절한 곳은?',
      given: q.sentence ?? item.payload?.insert_sentence ?? '',
      // 슬롯이 몇 번째 문장 뒤에 오는지 함께 준다 — 화면이 번호를 다시 세지 않게.
      body: q.body.map((s, i) => ({ text: s, slot: q.slots.indexOf(i + 1) })),
      answer: q.answer,
      explanation: pickExplanation(item, explainInsert(q)),
      source: item.ref_title ?? null,
    }
  }
  // 생성형 — 지문 하나 + 5지선다. 유형이 열이어도 화면이 그리는 모양은 하나다.
  // 조판기(`renderExtra`)와 **같은 조건**을 건다: 선택지 5개 + 정답 1~5.
  const p = item.payload ?? {}
  const choices = Array.isArray(p.choices) ? p.choices : []
  const answer = Number(item.answer_key?.answer)
  // ⚠️ **선택지가 문자열인지 본다.** `unit_vocab` 은 선택지를 객체로 담는데,
  //   `String(c)` 로 넘기면 화면에 **[object Object]** 가 다섯 줄 찍힌다(실측 2026-09-06 —
  //   band 4 미리보기 5번 문항이 그랬다). 조판기는 이 유형을 `renderSchool` 로 따로
  //   그리지만 화면에는 그 그림이 없다 — **못 그리는 것은 뺀다.**
  const printable = choices.every((c) => typeof c === 'string' && c.trim().length > 0)
  if (printable && choices.length === 5 && Number.isInteger(answer) && answer >= 1 && answer <= 5) {
    return {
      no,
      type: item.type,
      stem: String(p.stem_ko ?? '다음 글에 대한 물음에 답하시오.'),
      passage: String(p.passage ?? ''),
      // 밑줄 유형은 그 구절을 따로 준다 — 안 주면 발문이 가리키는 곳이 없다.
      underline: typeof p.underline === 'string' && p.underline ? p.underline : null,
      given: typeof p.summary_sentence === 'string' && p.summary_sentence ? p.summary_sentence : null,
      choices: choices.map((c) => String(c)),
      answer,
      explanation: pickExplanation(item, explainItem(item.type, item.payload, item.answer_key)),
      source: item.ref_title ?? null,
    }
  }
  return null
}

/**
 * 지문 길이.
 *
 * ⚠️ `countPassageWords` 는 **문자열**을 받는다. 처음에 문항을 그대로 넘겼더니
 *   `[object Object]` 를 세어 **전 단원이 2어**로 나왔다(실측 2026-09-06).
 *   숫자가 나왔다고 잰 것이 아니다 — 유형마다 지문이 사는 자리를 여기서 편다.
 */
function passageTextOf(item) {
  const p = item.payload ?? {}
  if (item.type === 'order') {
    return [p.intro, ...(Array.isArray(p.presented) ? p.presented.map((b) => (Array.isArray(b) ? b.join(' ') : b)) : [])]
      .filter(Boolean)
      .join(' ')
  }
  if (item.type === 'insert') {
    const rest = Array.isArray(p.remaining) ? p.remaining.join(' ') : ''
    return [rest, p.insert_sentence].filter(Boolean).join(' ')
  }
  return String(p.passage ?? p.text ?? '')
}

function wordsOf(item) {
  const text = passageTextOf(item)
  // 지문이 없는 유형(초등 3종 · 문장 단위)은 **0 이 아니라 못 잼**이다.
  if (!text || text.length < 40) return null
  const n = countPassageWords(text)
  return Number.isFinite(n) && n > 0 ? n : null
}

const volumes = {}
const problems = []

for (const band of BANDS) {
  const rung = SERIES_SPINE.find((r) => r.vLevels.includes(band))
  process.stdout.write(`band ${band} … `)
  let loaded
  try {
    loaded = await loadVolume(db, { band, unitCount: UNITS })
  } catch (e) {
    problems.push({ band, error: String(e?.message ?? e) })
    console.log(`실패 — ${e?.message ?? e}`)
    continue
  }
  const { units, stoppedBecause } = loaded

  const toc = units.map((u) => {
    const words = u.items.map(wordsOf).filter((n) => n !== null)
    // 지문 제목 — **단원 제목을 짓지 않고 실제 원글 제목을 적는다.**
    const titles = [...new Set(u.items.map((it) => it.ref_title).filter(Boolean))]
    return {
      no: u.no,
      types: [...new Set(u.items.map((it) => it.type))],
      items: u.items.length,
      minutes: u.estimated_minutes ?? null,
      words: words.length ? [Math.min(...words), Math.max(...words)] : null,
      passages: titles,
    }
  })

  // ── 미리보기 단원 ────────────────────────────────────────────────
  // **화면이 그릴 수 있는 문항이 든 첫 단원**을 고른다. 무조건 1단원을 쓰면
  // 그 단원이 전부 생성형일 때 미리보기가 빈 자리로 나온다.
  let sample = null
  for (const u of units) {
    const items = u.items.map((it, i) => structureItem(it, i + 1)).filter(Boolean)
    if (items.length === 0) continue
    sample = {
      no: u.no,
      minutes: u.estimated_minutes ?? null,
      // 어휘 — 조합기가 그 단원에 실은 것 그대로. 없으면 빈 배열이지 지어내지 않는다.
      vocabulary: (u.vocabulary ?? [])
        .map((v) => ({ word: v.word ?? v.lemma ?? null, meaningKo: v.meaningKo ?? v.meaning_ko ?? null }))
        .filter((v) => v.word && v.meaningKo),
      items,
    }
    break
  }
  if (!sample) problems.push({ band, error: '화면이 그릴 수 있는 문항이 든 단원이 없다' })

  volumes[String(band)] = {
    band,
    step: rung?.step ?? null,
    title: rung?.volumeTitle ?? null,
    schoolBand: rung?.schoolBand ?? null,
    units: toc,
    totalItems: units.reduce((s, u) => s + u.items.length, 0),
    totalMinutes: units.reduce((s, u) => s + (u.estimated_minutes ?? 0), 0),
    stoppedBecause: stoppedBecause ?? null,
    sample,
  }
  console.log(`단원 ${toc.length} · 문항 ${volumes[String(band)].totalItems}${sample ? ` · 미리보기 UNIT ${sample.no}(문항 ${sample.items.length})` : ' · 미리보기 없음'}`)
}

const snapshot = {
  // ⚠️ 굽는 시점을 반드시 적는다 — 스냅샷은 낡는다. 낡은 것이 보여야 다시 굽는다.
  generatedAt: new Date().toISOString(),
  unitsPerVolume: UNITS,
  bands: BANDS,
  volumes,
  problems,
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, `${JSON.stringify(snapshot, null, 2)}\n`)
const bytes = fs.statSync(OUT).size
console.log(
  `\n스냅샷 ${path.relative(process.cwd(), OUT)} — ${Object.keys(volumes).length}권 · ${(bytes / 1024).toFixed(1)} KB` +
    (problems.length ? ` · ⚠ 문제 ${problems.length}건` : ''),
)
for (const p of problems) console.log(`  ⚠ band ${p.band} — ${p.error}`)
