// scripts/textbook/render-volume.mjs
//
// **교재 한 권을 실제로 조판한다 — 펼쳐 볼 수 있는 물건으로.**
//
// ── 왜 필요한가 ──────────────────────────────────────────────────────
// 생성기·검사기·리포트·콘솔은 다 있는데 **책이 없었다.** `build-volume.mjs` 는 조합 결과를
// 콘솔에 찍을 뿐이라, "우리 교재가 시중 교재만 한가" 를 사람이 눈으로 볼 방법이 없었다.
// 평가 요소 중 셋(오답 매력도 · 레벨 표기 신뢰 · 소재 적합성)은 **사람이 봐야만** 판정되는데,
// 볼 물건이 없으면 그 셋은 영원히 미판정으로 남는다.
//
// 조합 규칙은 `compose-unit.ts` 에 있고 인쇄 형식은 `csat-format.ts` 에 있다.
// 여기서는 **둘을 붙여 HTML 로 낼 뿐** 새 규칙을 만들지 않는다.
//
// 재실행 안전: DB 읽기 + **조판 기록 한 행**(band 당 하나, 덮어씀). 결과 HTML 은 지정한 파일에 쓴다(덮어쓴다).
// 몇 번 돌려도 행 수가 안 늘고 마지막 조판이 정본이 된다 — 그 기록을 /admin/textbook 이 읽는다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/render-volume.mjs --band 5 --units 20 --out volume-v5.html

import fs from 'node:fs'
import path from 'node:path'

import { ELEMENTARY_TYPES, SCHOOL_TYPES, loadEnv, loadVolume } from './volume-pool.mjs'

loadEnv()
const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const BAND = Number(arg('band') ?? 5)
const OUT = arg('out') ?? `volume-v${BAND}.html`

const { createClient } = await import('@supabase/supabase-js')
const {
  toCsatOrder,
  toCsatInsert,
  scoreVolume,
  explainOrder,
  explainInsert,
  explainItem,
  SERIES_SPINE,
  rungMix,
  typeMixFit,
  itemWordSpec,
  assessAnswerBias,
  summarizeProofread,
  proofreadPassage,
  SCHOOL_SENTENCE_TYPES,
  MARKET_UNITS_PER_BOOK,
  // 브랜딩 — 값은 `@vocaflow/design-tokens` 에서 온다. 여기서 색을 적지 않는다.
  VOLUME_FONTS,
  brandFingerprint,
  buildColophon,
  ladderStrip,
  // 표지 — **매대와 같은 함수**를 쓴다. 서점에서 본 표지와 펼친 책의 표지가
  // 달라지면 같은 상품으로 안 읽힌다.
  COVER_BRAND,
  coverSvg,
  volumeCssVariables,
} = await import('@vocaflow/library-pipeline')

// ⚠️ **단원 수를 바꾸면 유형-학년 적합도가 바뀐다** — 목표 몫은 인쇄 문항 수에 비례하는데
//   손으로 쓰는 유형의 재고는 그대로라, 단원을 늘리면 같은 재고가 더 큰 미달로 잡힌다.
//   실측(V6, 2026-08-31): 10단원 부족 5문항(8.3%) vs 20단원 부족 25문항(20.8%).
//   그래서 기본값을 **시장 실측 중앙값**에 맞춘다 — 시중 교재 9권의 단원 수 중앙값 10.
//   채점표도 이미 이 값으로 통과를 판정한다(`MARKET_UNITS_PER_BOOK.median`).
//   기본값이 20 이던 동안 V5·V6 만 20단원으로 찍혀 다른 단과 비교할 수 없었다.
const UNITS = Number(arg('units') ?? MARKET_UNITS_PER_BOOK.median)

// ⚠️ **판권장에 찍는 규격은 실제로 쓴 창이어야 한다.** 여기가 `지문 90~200어` 로
//   **하드코딩**돼 있었다. 창이 학년별로 좁아진 뒤(중등 90~152 · 고2 90~188)에도
//   전 밴드가 90~200 을 인쇄했다 — 제품에 틀린 규격을 적는 것이고, 그건 조판물만
//   보는 사람에게 검수의 근거로 읽힌다(실측 2026-08-31: V3·V4·V6·V7 전부 오기).
//   유형마다 창이 다르므로 **이 권이 실제로 쓴 지문 유형들의 창**을 합쳐서 적는다.
//   ⚠️ **지문을 싣는 유형만 본다.** 처음에 전 유형을 넣었더니 두 가지가 새어 나왔다:
//     · V1 이 `0~9007199254740991어` — 초등 3종은 사전에서 나와 창이 무한대다.
//     · 최소값이 6 — 그건 문장 단위 유형(`SCHOOL_SENTENCE_WORDS`)의 창이지 지문이 아니다.
//   둘 다 판권장에 그대로 인쇄됐다. 규격 칩은 **지문 길이**를 말하는 자리다.
const passageSpecChip = (types) => {
  const specs = [...types]
    .filter((t) => !ELEMENTARY_TYPES.has(t) && !SCHOOL_SENTENCE_TYPES.has(t))
    .map((t) => itemWordSpec(t, BAND))
    .filter((s) => s.max > 0 && s.max < 10_000)
  // 지문을 싣는 유형이 하나도 없는 권(V1 은 낱말 카드로만 이뤄진다)은 그렇다고 적는다.
  if (!specs.length) return '없음 — 낱말 중심'
  const lo = Math.min(...specs.map((s) => s.min))
  const hi = Math.max(...specs.map((s) => s.max))
  return `${lo}~${hi}어`
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// ── 재료 + 조합 ────────────────────────────────────────────────────
// **규칙은 `volume-pool.mjs` 한 곳에만 있다.** 해설 드레인(`explain-drain-export.mjs`)이
// 같은 함수를 부르므로 "드레인이 겨냥한 책" 과 "조판된 책" 이 어긋날 수 없다.
// 예전에는 양쪽이 각자 풀을 만들었고 셋(밴드 기준·어휘 맵·display_only)이 달라
// 2문항이 조용히 어긋났다 — 해설을 다 채웠는데도 책은 78/80 으로 나왔다.
// 기본은 **켬**. `--no-market-mix` 로만 끈다 — 왜 기본이 켬인지는 `volume-pool.mjs` 참조.
const MARKET_MIX = !process.argv.includes('--no-market-mix')
const { units, stoppedBecause, articles: byId, pool, mix } = await loadVolume(db, {
  band: BAND,
  unitCount: UNITS,
  marketMix: MARKET_MIX,
})

const card = scoreVolume(units, BAND)

// ── 유형 구성이 시장과 얼마나 맞는가 ────────────────────────────────
// 시중 79종 실측 밀도(`market-spec.json` typeDensity)를 목표로 삼고 총변이거리로 잰다.
// 이 값을 안 찍으면 "중1-2 교재 120문항 중 80문항이 수능 순서·삽입" 같은 상태를
// 아무도 눈치채지 못한다 — 실제로 그랬다.
const actualMix = {}
for (const u of units) for (const it of u.items) actualMix[it.type] = (actualMix[it.type] ?? 0) + 1
const target = rungMix(BAND, new Set(pool.map((it) => it.type))).targetShare
const fit = typeMixFit(actualMix, target)
// 판권장에 찍을 규격 — **이 권이 실제로 인쇄한 유형들**의 창을 합친다.
const PASSAGE_CHIP = passageSpecChip(Object.keys(actualMix))

// ── 판권장이 주장하는 검수를 **실제로 돌린다** ─────────────────────
//
// ⚠️ 이 두 칩은 오래 **아무 근거 없이** 찍히고 있었다(실측 2026-08-31):
//   · `정답 번호 균등 검정` — `scoreVolume` 에 그 검사가 **없다**(참조 0건).
//   · `교정 3회` — 조판기가 `proofread` 를 **한 번도 부르지 않는다**(참조 0건).
//   재료는 둘 다 있었다(`assessAnswerBias` · `summarizeProofread`). 없던 것은 호출이다.
//   주장을 지우는 대신 **실제로 수행하고 결과를 함께 찍는다** — 그래야 그 줄이 근거가 된다.
const printedItems = units.flatMap((u) => u.items)
// 선택지가 있는 문항만 — 단답형에는 고를 번호가 없다.
//
// ⚠️ **선택지 수가 유형마다 다르다.** 초등 3종은 4지선다(`ELEMENTARY_CHOICES = 4`)이고
//   DB 에 저장된 수능형 17종은 전부 5지선다다(실측 2026-08-31). 5칸 히스토그램 하나에
//   몰아 담으면 4지선다 문항 때문에 ⑤ 칸이 **구조적으로 영원히 0** 이 되고, 검사는
//   **존재하지 않는 자리를 "한 번도 정답이 아니다" 라고 고발한다** — V1 이 그렇게
//   χ²=16.25 · V=0.319 로 쏠림 판정을 받았다. 기대값이 다른 것을 한 통에 담은 것이
//   결함이지 교재가 결함인 게 아니었다. **선택지 수별로 나눠 센다.**
//   (`item-health.ts` 의 `assessStock` 은 이미 이렇게 하고 있었다 — 조판기만 안 따라왔다.)
const answered = []
for (const it of printedItems) {
  const n = Number(it.answer_key?.answer ?? it.answer_key?.position)
  const k = Array.isArray(it.payload?.choices) ? it.payload.choices.length : 5
  if (Number.isInteger(n) && k >= 2 && n >= 1 && n <= k) answered.push({ n, k })
}
const histByChoices = new Map()
for (const { n, k } of answered) {
  if (!histByChoices.has(k)) histByChoices.set(k, new Array(k).fill(0))
  histByChoices.get(k)[n - 1] += 1
}
const biasGroups = [...histByChoices.entries()]
  .sort((a, b) => a[0] - b[0])
  .map(([k, counts]) => ({ choices: k, ...assessAnswerBias(counts) }))
// 묶음이 여럿이면 **가장 나쁜 쪽**을 대표로 찍는다 — 합치거나 평균 내면 쏠림이 묻힌다.
const bias = biasGroups.length
  ? biasGroups.reduce((worst, g) => (g.cramersV > worst.cramersV ? g : worst))
  : null

// 교정은 인쇄되는 지문에 건다 — 저장 원본이 아니라 **학습자가 읽는 글**이다.
const proofPassages = printedItems
  .map((it) => {
    const p2 = it.payload ?? {}
    if (Array.isArray(p2.sentences) && p2.sentences.length) return p2.sentences.map(String)
    if (typeof p2.passage === "string" && p2.passage.trim()) {
      // ⚠️ `s+` 로 쓰면 **글자 s** 를 찾는다 — 지문이 통째로 문장 1개가 되어 교정 분모가
      //   문항 수와 같아진다. 이 저장소에서 같은 오타가 세 번 났다(`volume-pool.mjs` 2회).
      return p2.passage.split(/(?<=[.!?])\s+/).filter((s) => s.trim())
    }
    return null
  })
  .filter(Boolean)
const proof = summarizeProofread(proofPassages)

// `--proof-detail` — **지적 내용을 볼 수 없으면 고칠 수 없다.** 요약(`교정 1/44`)만으로는
// 어느 글의 어느 문장인지 알 길이 없어서, 검사를 배선하고도 결함 6건이 그대로 인쇄됐다.
// 사람이 손볼 수 있게 문장·규칙·조치를 함께 찍는다. 조판 결과는 바꾸지 않는다.
if (arg("proof-detail") != null) {
  let shown = 0
  for (const [i, sentences] of proofPassages.entries()) {
    const found = proofreadPassage(sentences)
    if (!found.length) continue
    const it = printedItems.filter((x) => {
      const p2 = x.payload ?? {}
      return (Array.isArray(p2.sentences) && p2.sentences.length) || (typeof p2.passage === "string" && p2.passage.trim())
    })[i]
    console.log(`\n[${++shown}] ${it?.type ?? "?"} · ${it?.ref_title ?? "출처 미상"}`)
    for (const f of found) {
      console.log(`    ${f.stage} · ${f.rule} — ${f.hint}`)
      console.log(`    · ${f.found}`)
    }
  }
  if (!shown) console.log("\n교정 지적 없음")
}

// ⚠️ **위 목표는 "우리가 가진 유형" 안에서 다시 정규화된 것이다.** 재고가 0 인 유형은
//   목표에서 통째로 빠지므로, 없는 유형이 많을수록 적합도가 **후하게** 나온다.
//   실측 2026-08-31: V1 은 초등저가 필요로 하는 세 유형(rhyme·word_meaning·spell_blank)이
//   모두 0 인데 적합도 **100.0%** 였다. V7 은 시장 구성의 41.7%(빈칸14·제목8·요지3)가
//   비어 있는 채로 89.7% 였다. 그 수치로는 "시중 대비" 를 말할 수 없다.
//
//   조합이 가진 것 안에서 최선을 다하는 것은 맞다 — 그래서 target 은 그대로 두고,
//   **시장 전체를 분모로 한 값을 나란히 찍는다.** 둘이 벌어진 만큼이 닫힌 유형이다.
const marketTarget = rungMix(BAND).targetShare
const marketFit = typeMixFit(actualMix, marketTarget)
const closedTypes = Object.keys(marketTarget).filter((t) => !pool.some((it) => it.type === t))
const rung = SERIES_SPINE.find((r) => r.vLevels.includes(BAND))

// ── 조판 ────────────────────────────────────────────────────────────
const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const CIRCLED = ['①', '②', '③', '④', '⑤']

/**
 * 해설을 고른다 — **배치가 쓴 것이 우선**이다.
 *
 * 결정론 해설(`explain.ts`)은 근거가 지문에서 확정될 때만 나오고 실측 6.9% 에서 멈춘다.
 * 나머지는 Claude Code 배치가 `answer_key.explanation_ko` 에 채운다.
 * 둘 다 없으면 **빈 자리에 없다고 적는다** — 지어내지 않는다.
 */
function pickExplanation(item, deterministic) {
  const batch = item.answer_key?.explanation_ko
  if (typeof batch === 'string' && batch.trim()) return { text: batch.trim(), from: 'batch' }
  // 생성형은 해설을 `rationale_ko` 에 담는다 — 같은 것이 두 이름으로 산다.
  // 여기서 안 보면 534문항의 해설이 있는데도 "없음" 으로 인쇄된다.
  const rationale = item.answer_key?.rationale_ko
  if (typeof rationale === 'string' && rationale.trim()) return { text: rationale.trim(), from: 'batch' }
  // 결정론 해설은 두 모양으로 온다 — 순서·삽입은 `{ body }`(머리 두 줄이 정답 표기),
  // 유형별 해설기(`explainItem`)는 `{ ko }`(본문만). 한쪽만 보면 나머지가 통째로 샌다.
  if (typeof deterministic?.ko === "string" && deterministic.ko.trim()) {
    return { text: deterministic.ko.trim(), from: "rule" }
  }
  if (deterministic?.body) {
    // 결정론 해설의 첫 두 줄은 "정답 ③ (B)-(A)-(C)" 와 빈 줄이라 본문에서는 뺀다.
    return { text: deterministic.body.split('\n').slice(2).join('\n'), from: 'rule' }
  }
  return null
}

/** 문항 하나를 수능 인쇄 형식으로. 못 바꾸면 null. */
/** 생성형 유형 — 지문 하나 + 5지선다. 유형이 열이어도 인쇄 모양은 하나다. */
const EXTRA_STEM_FALLBACK = '다음 글에 대한 물음에 답하시오.'

function renderExtra(item, no) {
  const p = item.payload ?? {}
  const choices = Array.isArray(p.choices) ? p.choices : []
  if (choices.length !== 5) return null
  const answer = Number(item.answer_key?.answer)
  if (!Number.isInteger(answer) || answer < 1 || answer > 5) return null
  // 밑줄 유형은 그 구절에 실제로 밑줄을 친다 — 안 치면 발문이 가리키는 곳이 없다.
  let passage = esc(String(p.passage ?? ''))
  if (p.underline) {
    const u = esc(String(p.underline))
    if (passage.includes(u)) passage = passage.replace(u, `<u>${u}</u>`)
  }
  return {
    html: `
<div class="q">
  <p class="stem"><b>${no}.</b> ${esc(String(p.stem_ko ?? EXTRA_STEM_FALLBACK))}</p>
  <div class="passage">${passage}</div>
  ${p.summary_sentence ? `<div class="given">${esc(String(p.summary_sentence))}</div>` : ''}
  <ol class="choices">${choices.map((c) => `<li>${esc(String(c))}</li>`).join('')}</ol>
</div>`,
    answer,
    explanation: pickExplanation(item, explainItem(item.type, item.payload, item.answer_key)),
    source: item.ref_title,
  }
}

/**
 * 학교 시험 축(중등 내신) 조판 — 4지선다 · 밑줄 5지 · 단답 · 배열.
 *
 * `renderExtra` 는 `choices.length === 5` 를 요구한다. 이 유형들은 선택지가 4개이거나
 * 아예 없어서 **전부 null 로 떨어졌다** — 13,351문항이 인쇄되지 않던 이유다.
 */
function renderSchool(item, no) {
  const p = item.payload ?? {}
  const ak = item.answer_key ?? {}
  const sentences = Array.isArray(p.sentences) ? p.sentences.map(String) : []
  const stem = String(p.prompt_ko ?? p.stem_ko ?? '')

  // ── 4지선다: 본문 어휘 뜻 · 단원 문법 ──
  if (Array.isArray(p.choices) && p.choices.length >= 3 && p.choices.length <= 5) {
    const answer = Number(ak.answer)
    if (!Number.isInteger(answer) || answer < 1 || answer > p.choices.length) return null
    const body = sentences.length ? sentences.map((x) => esc(x)).join(' ') : ''
    return {
      html: `
<div class="q">
  <p class="stem"><b>${no}.</b> ${esc(stem)}</p>
  ${body ? `<div class="passage">${body}</div>` : ''}
  <ol class="choices">${p.choices
    .map((c) => `<li>${esc(typeof c === 'string' ? c : (c?.text ?? ''))}</li>`)
    .join('')}</ol>
</div>`,
      answer,
      explanation: pickExplanation(item, explainItem(item.type, item.payload, item.answer_key)),
      source: item.ref_title,
    }
  }

  // ── 밑줄 5지: 문맥상 낱말 쓰임 · 어법 고르기 ──
  if (Array.isArray(p.underlines) && p.underlines.length >= 3) {
    const answer = Number(ak.position ?? ak.answer)
    if (!Number.isInteger(answer) || answer < 1 || answer > p.underlines.length) return null
    // 밑줄 자리에 번호를 붙여 인쇄한다 — 안 붙이면 발문이 가리키는 곳이 없다.
    const marked = sentences.map((sentence, si) => {
      let out = esc(sentence)
      for (const [ui, u] of p.underlines.entries()) {
        if (Number(u?.sentenceIdx) !== si) continue
        const w = esc(String(u?.word ?? ''))
        if (!w || !out.includes(w)) continue
        out = out.replace(w, `<u>${CIRCLED[ui] ?? ''}${w}</u>`)
      }
      return out
    }).join(' ')
    return {
      html: `
<div class="q">
  <p class="stem"><b>${no}.</b> ${esc(stem || '밑줄 친 부분 중 알맞지 않은 것은?')}</p>
  <div class="passage">${marked}</div>
</div>`,
      answer,
      explanation: pickExplanation(item, explainItem(item.type, item.payload, item.answer_key)),
      source: item.ref_title,
    }
  }

  // ── 단답: 빈칸 낱말 쓰기 · 어법 고쳐 쓰기 ──
  if (typeof p.stem === 'string' && p.stem.trim()) {
    const text = String(ak.text ?? '')
    if (!text) return null
    return {
      html: `
<div class="q">
  <p class="stem"><b>${no}.</b> ${esc(stem)}</p>
  <div class="passage">${esc(p.stem)}</div>
  ${p.hint ? `<p class="hint">힌트 ${esc(String(p.hint))}</p>` : ''}
  <p class="answer-line">답: ____________</p>
</div>`,
      answer: text,
      explanation: pickExplanation(item, explainItem(item.type, item.payload, item.answer_key)),
      source: item.ref_title,
    }
  }

  // ── 배열: 영작 ──
  if (Array.isArray(p.bank) && p.bank.length >= 3) {
    const sentence = String(ak.sentence ?? '')
    if (!sentence) return null
    return {
      html: `
<div class="q">
  <p class="stem"><b>${no}.</b> 낱말을 모두 한 번씩 써서 문장을 완성하시오.</p>
  ${p.context ? `<div class="passage">${esc(String(p.context))}</div>` : ''}
  <div class="given">${p.bank.map((w) => esc(String(w))).join(' / ')}</div>
  <p class="answer-line">답: ________________________________________</p>
</div>`,
      answer: sentence,
      explanation: pickExplanation(item, explainItem(item.type, item.payload, item.answer_key)),
      source: item.ref_title,
    }
  }
  return null
}

/**
 * 초등 저학년 3종 — 운율 · 낱말 뜻 · 철자 완성.
 *
 * 지문이 없다. 물음 한 줄 + 보기(또는 답 쓰는 자리)가 전부다.
 * 이 갈래가 없으면 사다리 1단이 통째로 인쇄되지 않는다(실측: V1 0단원).
 */
function renderElementary(item, no) {
  const p = item.payload ?? {}
  const ak = item.answer_key ?? {}
  const stem = String(p.prompt_ko ?? "")
  const shown = String(p.stem ?? "")
  const choices = Array.isArray(p.choices) ? p.choices : []

  if (choices.length >= 3) {
    const answer = Number(ak.answer)
    if (!Number.isInteger(answer) || answer < 1 || answer > choices.length) return null
    return {
      html: `
<div class="q">
  <p class="stem"><b>${no}.</b> ${esc(stem)}</p>
  <div class="given">${esc(shown)}</div>
  <ol class="choices">${choices
    .map((c) => `<li>${esc(typeof c === "string" ? c : (c?.text ?? ""))}</li>`)
    .join("")}</ol>
</div>`,
      answer,
      explanation: pickExplanation(item, explainItem(item.type, item.payload, item.answer_key)),
      // ⚠️ 초등 3종은 원글이 없어 `ref_id`·`ref_title` 자리에 **낱말**이 들어간다.
      //   그걸 그대로 출처로 찍으면 `출처 · above` 가 되어 오히려 오류로 읽힌다
      //   (실측 2026-08-31 V1 60문항 전부). 이 카드들의 실제 출처는 교육과정 별표다.
      source: '2022 개정 교육과정 별표 어휘',
    }
  }

  // 철자 완성 — 단답.
  const text = String(ak.text ?? p.answer_text ?? "")
  if (!text) return null
  return {
    html: `
<div class="q">
  <p class="stem"><b>${no}.</b> ${esc(stem)}</p>
  <div class="given">${esc(shown)}</div>
  <p class="answer-line">답: ____________</p>
</div>`,
    answer: text,
    explanation: pickExplanation(item, explainItem(item.type, item.payload, item.answer_key)),
    source: '2022 개정 교육과정 별표 어휘',
  }
}

/**
 * 흐름 무관 문장(35번) — 도입 한 문단 뒤에 ①~⑤ 다섯 문장을 이어 붙인다.
 *
 * ⚠️ 이 모양은 `renderExtra` 가 못 그린다 — `payload.choices` 가 없어 null 을 돌려주고,
 *   그러면 문항이 조용히 사라진다. 재료·조합·조판 셋이 다 열려야 학습자에게 닿는다.
 */
function renderIrrelevant(item, no) {
  const p = item.payload ?? {}
  const sents = Array.isArray(p.sentences) ? p.sentences.map(String) : []
  if (sents.length !== 5) return null
  const answer = Number(item.answer_key?.position)
  if (!Number.isInteger(answer) || answer < 1 || answer > 5) return null
  const body = sents
    .map((s, i) => `<span class="lbl">${CIRCLED[i]}</span> ${esc(s)}`)
    .join(' ')
  return {
    html: `
<div class="q">
  <p class="stem"><b>${no}.</b> 다음 글에서 전체 흐름과 관계 <b>없는</b> 문장은?</p>
  <div class="passage intro">${esc(String(p.intro ?? ''))}</div>
  <div class="passage">${body}</div>
</div>`,
    answer,
    explanation: pickExplanation(item, explainItem(item.type, item.payload, item.answer_key)),
    source: item.ref_title,
  }
}

function renderItem(item, no) {
  // ⚠️ **생성형을 여기서 안 받으면 조합기가 넣어도 인쇄가 안 된다.** 재료·조합·조판 셋이
  //   다 열려야 학습자에게 닿는다 — 하나만 막혀도 문항은 DB 에만 남는다.
  if (ELEMENTARY_TYPES.has(item.type)) return renderElementary(item, no)
  if (SCHOOL_TYPES.has(item.type)) return renderSchool(item, no)
  if (item.type === 'irrelevant') return renderIrrelevant(item, no)
  if (item.type !== 'order' && item.type !== 'insert') return renderExtra(item, no)
  if (item.type === 'order') {
    const q = toCsatOrder(item.payload.presented ?? [], item.answer_key.source_order ?? [])
    if (!q) return null
    const ex = explainOrder(q)
    return {
      html: `
<div class="q">
  <p class="stem"><b>${no}.</b> 주어진 글 다음에 이어질 글의 순서로 가장 적절한 것은?</p>
  <div class="passage intro">${esc(q.intro)}</div>
  ${q.blocks
    .map((b) => `<div class="passage block"><span class="lbl">(${b.label})</span> ${esc(b.sentences.join(' '))}</div>`)
    .join('')}
  <ol class="choices">${q.choices
    .map((c) => `<li>${c.map((l) => `(${l})`).join(' - ')}</li>`)
    .join('')}</ol>
</div>`,
      answer: q.answer,
      explanation: pickExplanation(item, ex),
      source: item.ref_title,
    }
  }
  const q = toCsatInsert(item.payload.remaining ?? [], item.payload.insert_sentence ?? '', item.answer_key.position)
  if (!q) return null
  const ex = explainInsert(q)
  const body = q.body
    .map((s, i) => {
      const slot = q.slots.indexOf(i + 1)
      return `${esc(s)}${slot >= 0 ? ` <span class="slot">${CIRCLED[slot]}</span>` : ''}`
    })
    .join(' ')
  return {
    html: `
<div class="q">
  <p class="stem"><b>${no}.</b> 글의 흐름으로 보아, 주어진 문장이 들어가기에 가장 적절한 곳은?</p>
  <div class="given">${esc(q.sentence)}</div>
  <div class="passage">${body}</div>
</div>`,
    answer: q.answer,
    explanation: pickExplanation(item, ex),
    source: item.ref_title,
  }
}

// ⚠️ **판권장이 "각 지문 아래에 출처를 밝힌다" 고 적는데 그렇게 하지 않고 있었다.**
//   출처가 단원 끝에 `A / B / C / …` 로 몰려 있어(실측 2026-08-31: 60문항에 출처줄 10개)
//   어느 글이 어디서 왔는지 이어지지 않았다. 시중 교재는 지문 바로 아래에 단다 —
//   출처는 저작권 표시이자 학습자가 원문을 찾아가는 길이라 **문항에 붙어야** 뜻이 있다.
const srcLine = (s) => (s ? `<p class="src">출처 · ${esc(String(s))}</p>` : '')

let qNo = 0
const unitHtml = []
const answerRows = []

for (const u of units) {
  const rendered = u.items.map((it) => renderItem(it, ++qNo)).filter(Boolean)
  if (!rendered.length) {
    qNo -= u.items.length
    continue
  }
  for (const r of rendered) {
    answerRows.push({
      no: qNo - rendered.length + rendered.indexOf(r) + 1,
      unit: u.no,
      answer: r.answer,
      explanation: r.explanation,
      source: r.source,
    })
  }
  const vocab = u.vocabulary
    .slice(0, 12)
    .map((v) => `<tr><td>${esc(v.word)}</td><td>${esc(v.meaning_ko ?? '—')}</td></tr>`)
    .join('')
  unitHtml.push(`
<section class="unit">
  <h2><span class="unum">UNIT ${String(u.no).padStart(2, '0')}</span> <span class="umin">${u.estimated_minutes}분</span></h2>
  ${rendered.map((r) => r.html + srcLine(r.source)).join('')}
  <div class="vocab">
    <h3>Words</h3>
    <table>${vocab}</table>
  </div>
  <p class="src unit-src">이 단원이 쓴 글 ${u.sources.length}편</p>
</section>`)
}

const passed = card.auto.filter((c) => c.pass).length
const colophon = buildColophon({
  title: rung?.volumeTitle ?? `Vocaflow Reading V${BAND}`,
  step: rung?.step ?? null,
  schoolBand: rung?.schoolBand ?? null,
  vLevel: BAND,
  autoPassed: passed,
  autoTotal: card.auto.length,
})
const html = `<title>${esc(colophon.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@400;500&family=JetBrains+Mono:wght@400&display=swap">
<style>
${volumeCssVariables()}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:${VOLUME_FONTS.english};line-height:1.72}
.wrap{max-width:46rem;margin:0 auto;padding:3rem 1.25rem 5rem}
.cover{border-bottom:3px double var(--line);padding-bottom:2rem;margin-bottom:2.5rem}
.coverart{float:right;width:168px;margin:0 0 1rem 1.5rem}
.coverart svg{display:block}
@media print{.coverart{float:none;margin:0 auto 1.5rem}}
.brand{font-size:.72rem;letter-spacing:.22em;text-transform:uppercase;color:var(--accent);font-weight:700}
h1{font-size:2.1rem;margin:.6rem 0 .3rem;letter-spacing:-.01em;text-wrap:balance}
.meta{color:var(--sub);font-size:.9rem}
.scorebar{display:flex;flex-wrap:wrap;gap:.4rem;margin-top:1.2rem}
.chip{border:1px solid var(--line);border-radius:2px;padding:.2rem .5rem;font-size:.74rem;color:var(--sub)}
.chip.ok{border-color:var(--accent);color:var(--accent)}
.unit{margin:0 0 3rem;padding-top:1.5rem;border-top:1px solid var(--line)}
.unit h2{display:flex;align-items:baseline;justify-content:space-between;font-size:.86rem;letter-spacing:.14em;color:var(--accent);margin:0 0 1.2rem;font-weight:700}
.umin{color:var(--sub);font-weight:400;letter-spacing:0}
.q{margin:0 0 2rem}
.stem{font-size:.95rem;margin:0 0 .8rem}
.passage{margin:0 0 .7rem;text-align:justify;hyphens:auto}
.intro{padding-left:.9rem;border-left:3px solid var(--line)}
.block .lbl{font-weight:700;color:var(--accent)}
.given{border:1px solid var(--line);padding:.7rem .9rem;margin:0 0 .9rem;background:transparent}
.slot{color:var(--slot);font-weight:700}
.choices{margin:.9rem 0 0;padding-left:1.4rem}
.choices li{margin:.15rem 0;font-variant-numeric:tabular-nums}
.vocab{margin-top:1.4rem;border-top:1px dotted var(--line);padding-top:.8rem}
.vocab h3{font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:var(--sub);margin:0 0 .4rem}
.vocab table{width:100%;border-collapse:collapse;font-size:.86rem}
.vocab td{padding:.16rem .5rem .16rem 0;vertical-align:top}
.vocab td:first-child{width:11rem;color:var(--accent)}
.src{margin:.9rem 0 0;font-size:.76rem;color:var(--sub)}
.answers{margin-top:4rem;border-top:3px double var(--line);padding-top:2rem}
.answers h2{font-size:1.3rem;margin:0 0 1.2rem}
.arow{border-bottom:1px dotted var(--line);padding:.7rem 0}
.ano{font-weight:700;color:var(--accent)}
.expl{margin:.35rem 0 0;font-size:.86rem;color:var(--sub);white-space:pre-wrap}
.noexpl{font-size:.82rem;color:var(--sub);font-style:italic}
.efrom{margin:.25rem 0 0;font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;color:var(--sub);opacity:.7}
.tablewrap{overflow-x:auto}
/* 한국어 해설·라벨은 본문 서체로 — Lora 는 영문 지문 전용이다. */
.meta,.chip,.expl,.noexpl,.vocab h3,.src{font-family:${VOLUME_FONTS.body}}
.ladder{display:flex;gap:.34rem;margin:.9rem 0 0;font-family:${VOLUME_FONTS.mono};font-size:.74rem;color:var(--sub)}
.ladder span{min-width:1.5rem;text-align:center}
.ladder span.here{color:var(--accent);font-weight:700}
.colophon{margin-top:4rem;border-top:1px solid var(--line);padding-top:1.4rem;font-family:${VOLUME_FONTS.body};font-size:.78rem;color:var(--sub);line-height:1.7}
.colophon dl{display:grid;grid-template-columns:auto 1fr;gap:.3rem 1.2rem;margin:0}
.colophon dt{color:var(--accent);letter-spacing:.1em;text-transform:uppercase;font-size:.68rem;padding-top:.1rem}
.colophon dd{margin:0}
/* ── 인쇄 조판 ────────────────────────────────────────────────────────
   ⚠️ **여기 있던 것은 한 줄이었다** — \`@media print{body{background:#fff}.wrap{max-width:none}}\`.
   색만 희게 하고 쪽 나눔이 없었다. 실측 2026-09-01: \`@page\` 0 · \`page-break\` 0 ·
   \`break-inside\` 0. 그대로 인쇄하면 **지문과 발문이 쪽 경계에서 잘리고** 선택지만 다음 쪽에
   남는다. 시중 교재에서는 일어나지 않는 일이라, 내용이 아무리 좋아도 교재로 안 보인다.

   ── 판형 ─────────────────────────────────────────────────────────────
   188 × 257 mm = **4×6배판**. 한국 학습서·문제집의 지배 판형이다.
   ⚠️ 이 값은 **업계 표준값이지 우리 코퍼스 실측이 아니다.** 79종 PDF 는 저장소 밖에 있고
   이 기계에는 없다(\`C:\\Users\\Administrator\\Documents\\시중교재\` 부재 확인 2026-09-01).
   \`market-spec.json\` 도 쪽 크기를 안 담는다(담는 것은 \`pagesPerUnit\`·\`densityPerPage\`).
   재려면 그 PDF 들의 MediaBox 를 읽어 최빈값을 쓰면 된다 — 그때까지 이 값이 근거다.

   ── 쪽 구성 근거 (79종 실측 · market-spec.json) ────────────────────────
   \`unitsPerBook\` 중앙값 10 · \`pagesPerUnit\` 중앙값 17. 단원이 쪽의 단위라는 뜻이라
   **단원마다 새 쪽에서 시작**한다.

   ⚠️ 쪽 번호와 running head 는 여기서 못 만든다. \`@page\` 의 margin box(\`@bottom-center\`)는
   **Chrome 이 지원하지 않는다** — 브라우저 인쇄로 뽑으면 무시된다. 진짜 쪽 번호가 필요하면
   Paged.js 같은 조판 엔진을 얹어야 하고, 그건 별도 작업이다. 지금 여기서 얻는 것은
   **쪽 크기 · 여백 · 잘리지 않는 덩어리**다. */
@page{size:188mm 257mm;margin:18mm 17mm 20mm}
@media print{
  body{background:#fff;color:#000;line-height:1.6}
  .wrap{max-width:none;margin:0;padding:0}
  /* 표지·정답해설·판권면은 각자 쪽을 차지한다 — 상업 교재의 기본 구성이다. */
  .cover{break-after:page;border-bottom:none;margin-bottom:0;padding-bottom:0}
  .answers{break-before:page;margin-top:0;border-top:none;padding-top:0}
  .colophon{break-before:page;margin-top:0;border-top:none;padding-top:0}
  /* 단원마다 새 쪽. 첫 단원은 표지가 이미 쪽을 넘겼으므로 빼야 빈 쪽이 안 생긴다. */
  .unit{break-before:page;margin:0;padding-top:0;border-top:none}
  .unit:first-of-type{break-before:auto}
  /* **한 덩어리는 쪼개지 않는다** — 이게 이 블록의 핵심이다. */
  .q{break-inside:avoid;margin:0 0 1.4rem}
  .arow{break-inside:avoid}
  .vocab{break-inside:avoid}
  .given{break-inside:avoid}
  .choices{break-inside:avoid}
  /* 지문은 길어서 쪼개질 수 있다 — 대신 한 줄만 넘어가는 것을 막는다. */
  .passage{orphans:2;widows:2}
  h1,h2,h3{break-after:avoid}
  /* 화면용 가로 스크롤 상자는 인쇄에서 내용을 잘라 먹는다. */
  .tablewrap{overflow-x:visible}
  /* 표지의 검수 칩은 **내부 QA 다** — 상업 교재 표지에 "자동 검수 9/9 통과" 는 없다.
     지우는 게 아니라 인쇄에서만 감춘다: 화면(검수용)에서는 그대로 보이고, 같은 사실이
     판권면에 남는다('검수 … · 교정 초교·재교·삼교'). 그래서 정보는 안 잃는다. */
  .scorebar{display:none}
  /* 링크 밑줄은 지면에서 읽기를 방해한다. */
  a{text-decoration:none;color:inherit}
}
</style>
<div class="wrap">
<header class="cover">
  <div class="coverart">${coverSvg(
    {
      brand: COVER_BRAND,
      step: rung?.step ?? BAND,
      totalSteps: SERIES_SPINE.length,
      schoolBand: rung?.schoolBand ?? ('V' + BAND),
    },
    168,
  )}</div>
  <p class="brand">${esc(colophon.ladder)}</p>
  <h1>${esc(colophon.title)}</h1>
  <p class="meta">${units.length}단원 · ${qNo}문항 · 총 ${units.reduce((s, u) => s + u.estimated_minutes, 0)}분 · 레벨 V${BAND}</p>
  <div class="scorebar">
    <span class="chip ok">자동 검수 ${passed}/${card.auto.length} 통과</span>
    <span class="chip">지문 ${PASSAGE_CHIP}</span>
    <span class="chip${bias && bias.biased ? '' : ' ok'}">정답 번호 ${bias ? `${bias.biased ? '쏠림' : '균등'} (χ²=${bias.chi2.toFixed(1)} · V=${bias.cramersV.toFixed(2)})` : '단답 위주'}</span>
    <span class="chip">출처 표기</span>
    <span class="chip${proof.defective ? '' : ' ok'}">교정 3회 · 지적 ${proof.defective}/${proof.passages}</span>
  </div>
  <div class="ladder" aria-label="시리즈 일곱 단 중 이 권의 자리">
    ${ladderStrip(rung?.step ?? null)
      .map((s) => `<span class="${s.startsWith('[') ? 'here' : ''}">${esc(s)}</span>`)
      .join('')}
  </div>
</header>
${unitHtml.join('')}
<section class="answers">
  <h2>정답 및 해설</h2>
  ${answerRows
    .map(
      (a) => `<div class="arow">
    <span class="ano">${a.no}.</span> ${CIRCLED[a.answer - 1] ?? a.answer}
    ${
      a.explanation
        ? `<div class="expl">${esc(a.explanation.text)}</div>` +
          `<p class="efrom">${a.explanation.from === 'batch' ? '해설' : '규칙 근거'}</p>`
        : '<div class="noexpl">근거를 지문에서 확정하지 못해 해설을 싣지 않았다.</div>'
    }
  </div>`,
    )
    .join('')}
</section>
<footer class="colophon">
  <dl>
    <dt>제목</dt><dd>${esc(colophon.title)}</dd>
    <dt>사다리</dt><dd>${esc(colophon.ladder)} — 일곱 단 중 ${rung?.step ?? '—'}단</dd>
    <dt>판차</dt><dd>${esc(colophon.edition)}</dd>
    <dt>발행</dt><dd>${esc(colophon.issued)}</dd>
    <dt>검수</dt><dd>${esc(colophon.review)} · 교정 초교·재교·삼교</dd>
    <dt>출처</dt><dd>${esc(colophon.sourcePolicy)}</dd>
  </dl>
</footer>
</div>`

fs.writeFileSync(path.resolve(OUT), html, 'utf8')

console.log(`V${BAND} — 원글 ${byId.size}편 · 문항 풀 ${pool.length}`)
console.log(`조합 ${units.length}단원 · 인쇄 ${qNo}문항${stoppedBecause ? ` (${stoppedBecause})` : ''}`)
console.log(`자동 검수 ${passed}/${card.auto.length} 통과`)

// ── 카탈로그 용량 ────────────────────────────────────────────────────
// **한 권을 만들 수 있는 것과 여러 권을 줄 수 있는 것은 다르다.** 학습자가 늘면
// 같은 책을 돌려주게 되는데, 그 한계가 지금까지 어디에도 안 찍혔다.
// 한 권이 원글 몇 편을 쓰는지 세고, 재고를 그것으로 나눠 **겹치지 않는 권수**를 낸다.
// ⚠️ **`ref_id` 가 전부 원글인 것은 아니다.** 초등 저학년 3종은 사전에서 나오므로
//    `ref_id` 가 `word:<낱말>` 이다(`volume-pool.ELEMENTARY_TYPES`). 그것을 원글로 세면
//    분모(원글 재고)와 분자(쓴 낱말)가 다른 것을 나누게 된다 — 실측 2026-08-30 V1:
//    "쓴 원글 33편 · 재고 22편 → 0권" 으로 찍혔는데, 실제로는 원글을 한 편도 안 썼다.
//    그래서 **`byId` 에 있는 것만** 원글로 센다.
// ⚠️ **문항이 없는 원글은 분모에 넣으면 안 된다.** 조합기는 문항에서 권을 만들므로
//    글만 있고 문항이 없으면 한 단원에도 못 들어간다. 실측 2026-08-30: 각색으로 넣은
//    2단 원글 13편이 재고 157편에는 잡히면서 **문항은 0개**였다 — 카탈로그가 그만큼
//    부풀어 보였다. 각색 드레인은 지문까지만 만들고 `store-new-types.mjs` 가 문항을 만든다.
const withItems = new Set(pool.map((it) => it.ref_id).filter((r) => byId.has(r)))
const usedArticles = new Set()
for (const u of units) for (const it of u.items) if (it.ref_id && byId.has(it.ref_id)) usedArticles.add(it.ref_id)
const idle = byId.size - withItems.size
if (usedArticles.size === 0) {
  console.log(
    `카탈로그 용량  이 권은 원글을 쓰지 않는다 — 사전에서 나오는 유형뿐이라 ` +
      `**원글 재고가 상한이 아니다**${idle ? ` (원글 ${idle}편은 아직 문항이 없다)` : ''}`,
  )
} else {
  console.log(
    `카탈로그 용량  이 권이 쓴 원글 ${usedArticles.size}편 · ` +
      `문항 있는 재고 ${withItems.size}편 → 겹치지 않는 책 ` +
      `**${Math.floor(withItems.size / usedArticles.size)}권**` +
      (idle ? `  (문항 없는 원글 ${idle}편은 뺐다 — store-new-types.mjs 를 돌려야 쓰인다)` : ''),
  )
}
console.log(
  `유형-학년 적합도 ${(fit * 100).toFixed(1)}% (가진 유형 안에서) · **시장 전체 기준 ${(marketFit * 100).toFixed(1)}%** — ` +
    Object.entries(actualMix)
      .sort((x, y) => y[1] - x[1])
      .map(([t, n]) => `${t} ${n}`)
      .join(' · '),
)
// 교정 지적은 **규칙 이름까지** 찍는다 — 건수만 보면 무엇을 고칠지 알 수 없다.
if (proof.defective) {
  console.log(
    `  교정 지적 ${proof.defective}/${proof.passages} 지문 — ` +
      Object.entries(proof.byRule)
        .sort((a, b) => b[1] - a[1])
        .map(([r, n]) => `${r} ${n}`)
        .join(' · '),
  )
}
if (closedTypes.length) {
  const share = closedTypes.reduce((s, t) => s + (marketTarget[t] ?? 0), 0)
  console.log(
    `  ⚠️ 재고가 0 이라 **목표에서 빠진 유형** ${closedTypes.length}개 — ${closedTypes.join(' · ')}` +
      ` (시장 기준 ${(share * 100).toFixed(1)}%). 왼쪽 수치는 그만큼 후하다.`,
  )
}
// **떨어진 항목은 이름을 말한다.** "8/9" 만 찍으면 무엇이 걸렸는지 알 수 없어
// 사람이 HTML 을 열어 눈으로 찾아야 한다 — 그러면 대개 안 찾는다.
for (const c of card.auto.filter((x) => !x.pass)) {
  console.log(`  ❌ ${c.label}${c.detail ? ` — ${c.detail}` : ''}`)
}
const byBatch = answerRows.filter((a) => a.explanation?.from === 'batch').length
const byRule = answerRows.filter((a) => a.explanation?.from === 'rule').length
console.log(
  `해설 ${byBatch + byRule}/${answerRows.length} — 배치 ${byBatch} · 규칙 ${byRule} · ` +
    `없음 ${answerRows.length - byBatch - byRule}`,
)
console.log(`\n→ ${path.resolve(OUT)}`)

// ── 조판 기록 ────────────────────────────────────────────────────────
// **조판했다는 사실을 화면이 알아야 한다.** 여기 남기지 않으면 결과가 각자 PC 의
// HTML 파일에만 있어서 /admin/textbook 이 "몇 권까지 조판됐나" 를 못 답한다.
//
// 재실행 안전: **권(band)당 한 행**을 덮어쓴다. 열 번 돌려도 행 수가 안 늘고
// 마지막 조판이 정본이 된다(찍은 횟수는 render_count, 첫 조판은 first_rendered_at 이 지킨다).
//
// `brand_fingerprint` 는 지금 규격의 지문이다 — 나중에 토큰이 바뀌면 값이 달라져
// 화면이 그 권을 "옛 규격" 으로 표시한다.
const record = {
  band: BAND,
  volume_title: colophon.title,
  step: rung?.step ?? null,
  school_band: rung?.schoolBand ?? null,
  units: units.length,
  items: answerRows.length,
  auto_passed: passed,
  auto_total: card.auto.length,
  failed_checks: card.auto.filter((c) => !c.pass).map((c) => c.label),
  explained_batch: byBatch,
  explained_rule: byRule,
  // 못 쟀으면 NULL — 0 으로 뭉개면 "적합도 0%" 라는 거짓 경보가 된다.
  type_mix_fit: Number.isFinite(fit) ? Number(fit.toFixed(4)) : null,
  // 원글을 안 쓰는 권(초등 3종)은 원글 재고가 상한이 아니다 — **NULL 이지 0 이 아니다.**
  // 0 으로 적으면 화면이 "한 권도 못 준다" 는 거짓 경보를 낸다.
  // ⚠️ **분모가 아니라 분자가 문제였다.** 출력은 `withItems`(문항이 붙은 원글)로 나누는데
  //   기록만 `byId`(원글 전체)로 나누고 있었다. 그래서 /admin/textbook 은 V5 를 73권,
  //   같은 순간 조판기는 28권으로 말했다(2026-08-30 실측). 화면이 거짓말을 하면
  //   없는 화면보다 나쁘다 — 기록과 출력은 **같은 식**이어야 한다.
  distinct_volumes: usedArticles.size === 0 ? null : Math.floor(withItems.size / usedArticles.size),
  // 격차 자체를 남긴다. idle 이 0 이 아니면 글을 더 쓸 것이 아니라 store-new-types 를 돌릴 몫이다.
  articles_with_items: withItems.size,
  articles_idle: idle,
  brand_fingerprint: brandFingerprint(),
  // ⚠️ **조판물에만 찍고 기록에 안 남기면 Admin 은 그 검수를 못 본다.**
  //   교정 지적과 정답 쏠림은 이제 권마다 실제로 돌지만(2026-08-31 배선), 기록 스키마에
  //   자리가 없어 화면이 눈뜬장님이었다. 이 저장소의 관행대로 **jsonb 에 키를 더한다** —
  //   마이그레이션이 필요 없고, 통째로 덮지 않으므로 기존 판권 값도 그대로 산다.
  colophon: {
    ...colophon,
    review: {
      passageSpec: PASSAGE_CHIP,
      answerBias: bias
        ? {
            counts: bias.counts,
            choices: bias.choices,
            chi2: Number(bias.chi2.toFixed(2)),
            cramersV: Number(bias.cramersV.toFixed(3)),
            biased: bias.biased,
            // 대표값만 남기면 나중에 "왜 이 숫자냐" 를 되짚을 수 없다 — 묶음 전부를 적는다.
            groups: biasGroups.map((g) => ({ choices: g.choices, counts: g.counts, chi2: Number(g.chi2.toFixed(2)) })),
          }
        : null,
      proofread: { passages: proof.passages, defective: proof.defective, byRule: proof.byRule },
    },
  },
  out_path: path.resolve(OUT),
  rendered_at: new Date().toISOString(),
}

const { data: prior, error: priorErr } = await db
  .from('textbook_volume_renders')
  .select('render_count, first_rendered_at')
  .eq('band', BAND)
  .maybeSingle()

if (priorErr) {
  // 조판 자체는 끝났다 — 여기서 죽이지 않는다. 다만 조용히 넘어가지도 않는다.
  console.error(
    `\n⚠️  조판 기록 실패 — ${priorErr.message}\n` +
      `   마이그레이션 20260830140000_textbook_volume_renders 가 적용됐는지 확인할 것.\n` +
      `   기록이 없으면 /admin/textbook 의 "조판" 표에 이 권이 안 뜬다.`,
  )
} else {
  const renderCount = (prior?.render_count ?? 0) + 1
  const { error: upErr } = await db.from('textbook_volume_renders').upsert(
    {
      ...record,
      render_count: renderCount,
      first_rendered_at: prior?.first_rendered_at ?? record.rendered_at,
    },
    { onConflict: 'band' },
  )
  if (upErr) console.error(`\n⚠️  조판 기록 실패 — ${upErr.message}`)
  else
    console.log(
      `조판 기록  band ${BAND} · 규격 ${record.brand_fingerprint} · ` +
        `${prior ? `${renderCount}번째 조판` : '첫 조판'}`,
    )
}
