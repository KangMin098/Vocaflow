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
//   ... --bands 4,5 --units 10 --out <경로>   ← 그 밴드만 다시 굽고 **나머지는 그대로 둔다**
//   ... --fresh                                ← 기존 스냅샷을 버리고 통째로 다시

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
/** 기존 스냅샷을 버리고 통째로 다시 만든다. 기본은 **합치기**(§부분 실행). */
const FRESH = process.argv.includes('--fresh')

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
/**
 * 초등 3종 — 낱말 카드. 원글이 없고 **교육과정 별표 어휘**에서 나온다.
 *
 * ⚠️ 이 셋을 빼 두는 동안 **초등 저학년 권만 미리보기가 통째로 없었다**(9축 · 지수 1.125).
 *   가장 어린 학습자가 들어오는 첫 권인데 펼쳐 볼 것이 없었다.
 * ⚠️ 선택지가 **3~4개일 수 있고** 문자열이 아니라 `{ text }` 객체로 오기도 한다.
 *   5개·문자열만 받는 생성형 규칙으로는 전부 떨어진다.
 * ⚠️ 출처에 `ref_title` 을 찍으면 안 된다 — 이 셋은 그 자리에 **낱말**이 들어 있어
 *   `출처 · above` 가 되어 오히려 오류로 읽힌다(조판기가 같은 함정을 먼저 겪었다).
 */
const ELEMENTARY_TYPES_SNAPSHOT = new Set(['rhyme', 'word_meaning', 'spell_blank'])
const ELEMENTARY_SOURCE = '2022 개정 교육과정 별표 어휘'

function structureElementary(item, no) {
  const p = item.payload ?? {}
  const ak = item.answer_key ?? {}
  const stem = String(p.prompt_ko ?? '').trim()
  const shown = String(p.stem ?? '').trim()
  if (!stem) return null
  const raw = Array.isArray(p.choices) ? p.choices : []
  const choices = raw
    .map((c) => (typeof c === 'string' ? c : String(c?.text ?? '')))
    .map((c) => c.trim())

  if (choices.length >= 3 && choices.every((c) => c.length > 0)) {
    const answer = Number(ak.answer)
    if (!Number.isInteger(answer) || answer < 1 || answer > choices.length) return null
    return {
      no,
      type: item.type,
      kind: 'elementary',
      stem,
      shown,
      choices,
      answer,
      explanation: pickExplanation(item, explainItem(item.type, item.payload, item.answer_key)),
      source: ELEMENTARY_SOURCE,
    }
  }

  // 철자 완성 — 단답. 선택지가 없으므로 **정답을 글자로** 준다.
  const text = String(ak.text ?? p.answer_text ?? '').trim()
  if (!text) return null
  return {
    no,
    type: item.type,
    kind: 'elementary',
    stem,
    shown,
    choices: [],
    answerText: text,
    explanation: pickExplanation(item, explainItem(item.type, item.payload, item.answer_key)),
    source: ELEMENTARY_SOURCE,
  }
}

function structureItem(item, no) {
  if (ELEMENTARY_TYPES_SNAPSHOT.has(item.type)) return structureElementary(item, no)
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
  // ── 나머지 유형 ─────────────────────────────────────────────────
  // ⚠️ **여기가 좁으면 미리보기가 복불복이 된다.** 조합은 실행마다 다른 유형을 고르는데
  //   (실측 2026-09-06: 같은 밴드가 한 시간 사이에 title·blank·topic → word_order·unit_vocab
  //   ·vocab_choice·grammar_fix 로 통째로 바뀌었다), 화면이 세 모양만 알면 그날 뽑기에 따라
  //   **2·3·4권의 미리보기가 통째로 사라진다.** 실제로 그렇게 사라졌다.
  //
  //   그래서 조판기(`renderExtra`·`renderSchool`)가 그리는 **네 모양을 전부** 낸다.
  //   조건도 조판기와 같게 맞춘다 — 두 곳이 다르면 책과 화면이 서로 다른 말을 한다.
  const p = item.payload ?? {}
  const ak = item.answer_key ?? {}
  const stem = String(p.stem_ko ?? p.prompt_ko ?? '')
  const sentences = Array.isArray(p.sentences) ? p.sentences.map(String) : []
  const explanation = pickExplanation(item, explainItem(item.type, item.payload, item.answer_key))
  const source = item.ref_title ?? null

  // ① 선택지형 — 지문(또는 문장들) + 3~5지선다.
  //    선택지는 문자열이거나 `{ text }` 다(`unit_vocab` 이 후자라 예전에 [object Object] 가 찍혔다).
  const rawChoices = Array.isArray(p.choices) ? p.choices : []
  if (rawChoices.length >= 3 && rawChoices.length <= 5) {
    const choices = rawChoices.map((c) => (typeof c === 'string' ? c : String(c?.text ?? '')).trim())
    const answer = Number(ak.answer)
    if (
      choices.every((c) => c.length > 0) &&
      Number.isInteger(answer) &&
      answer >= 1 &&
      answer <= choices.length
    ) {
      return {
        no,
        type: item.type,
        stem: stem || '다음 글에 대한 물음에 답하시오.',
        passage: String(p.passage ?? sentences.join(' ') ?? ''),
        underline: typeof p.underline === 'string' && p.underline ? p.underline : null,
        given: typeof p.summary_sentence === 'string' && p.summary_sentence ? p.summary_sentence : null,
        choices,
        answer,
        explanation,
        source,
      }
    }
  }

  // ② 밑줄형 — 문장 안의 구절에 번호를 달고 그중 하나를 고른다.
  //    번호를 안 달면 발문이 가리키는 곳이 없다(조판기가 같은 이유로 `<u>①word</u>` 를 찍는다).
  if (Array.isArray(p.underlines) && p.underlines.length >= 3) {
    const answer = Number(ak.position ?? ak.answer)
    if (Number.isInteger(answer) && answer >= 1 && answer <= p.underlines.length) {
      return {
        no,
        type: item.type,
        kind: 'underline',
        stem: stem || '밑줄 친 부분 중 알맞지 않은 것은?',
        sentences,
        underlines: p.underlines.map((u) => ({
          sentenceIdx: Number(u?.sentenceIdx ?? -1),
          word: String(u?.word ?? ''),
        })),
        choices: [],
        answer,
        explanation,
        source,
      }
    }
  }

  // ③ 단답형 — 빈칸 낱말 쓰기 · 어법 고쳐 쓰기. 정답을 **글자로** 준다.
  if (typeof p.stem === 'string' && p.stem.trim()) {
    const text = String(ak.text ?? '').trim()
    if (text) {
      return {
        no,
        type: item.type,
        kind: 'short',
        stem: stem || '빈칸에 알맞은 말을 쓰시오.',
        shown: p.stem.trim(),
        hint: p.hint ? String(p.hint) : null,
        choices: [],
        answerText: text,
        explanation,
        source,
      }
    }
  }

  // ④ 배열형(영작) — 낱말 더미를 문장으로 세운다. 정답이 원문이라 확정된다.
  if (Array.isArray(p.bank) && p.bank.length >= 3) {
    const sentence = String(ak.sentence ?? '').trim()
    if (sentence) {
      return {
        no,
        type: item.type,
        kind: 'arrange',
        stem: stem || '주어진 낱말을 알맞게 배열하시오.',
        bank: p.bank.map((w) => String(w)),
        choices: [],
        answerText: sentence,
        explanation,
        source,
      }
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
  // ⚠️ **첫 단원이 아니라 가장 잘 그려지는 단원**을 고른다. 처음엔 "그릴 수 있는 문항이
  //   하나라도 있는 첫 단원" 을 썼는데, 그러면 1문항짜리 미리보기가 나오고 그 옆 단원에
  //   6문항이 있어도 못 본다(실측 2026-09-06: band 4 가 1문항이었다).
  let best = null
  for (const u of units) {
    const items = u.items.map((it, i) => structureItem(it, i + 1)).filter(Boolean)
    if (items.length === 0) continue
    if (!best || items.length > best.items.length) best = { u, items }
  }
  let sample = null
  if (best) {
    const u = best.u
    const items = best.items
    sample = {
      no: u.no,
      minutes: u.estimated_minutes ?? null,
      // 어휘 — 조합기가 그 단원에 실은 것 그대로. 없으면 빈 배열이지 지어내지 않는다.
      vocabulary: (u.vocabulary ?? [])
        .map((v) => ({ word: v.word ?? v.lemma ?? null, meaningKo: v.meaningKo ?? v.meaning_ko ?? null }))
        .filter((v) => v.word && v.meaningKo),
      items,
    }
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

// ── 부분 실행이 나머지를 날리지 않게 한다 ────────────────────────────
// ⚠️ 실측 2026-09-06: band 7 이 Supabase **522(업스트림 타임아웃)** 로 실패했는데,
//   산출물은 그 실행이 만든 것만 담아 **멀쩡하던 여섯 권이 파일에서 사라졌다.**
//   스크립트는 exit 0 이었다 — 실패한 밴드를 problems 에 적었으니 "성공" 이다.
//   한 밴드만 다시 구우려고 `--bands 7` 을 주는 것도 같은 사고를 낸다.
//
// 그래서 **덮어쓰기가 아니라 합치기가 기본**이다. 이번에 안 구운 밴드는 그대로 둔다.
// 통째로 다시 만들려면 `--fresh`.
let prior = null
if (!FRESH && fs.existsSync(OUT)) {
  try {
    prior = JSON.parse(fs.readFileSync(OUT, 'utf8'))
  } catch {
    prior = null // 읽을 수 없으면 새로 만든다 — 깨진 것을 물려받지 않는다
  }
}

const mergedVolumes = { ...(prior?.volumes ?? {}), ...volumes }
// 이번에 다시 구운 밴드의 옛 문제는 버린다(고쳤을 수 있다). 안 구운 밴드의 것은 남긴다.
const mergedProblems = [
  ...(prior?.problems ?? []).filter((x) => !BANDS.includes(x.band)),
  ...problems,
]
const kept = Object.keys(prior?.volumes ?? {}).filter((b) => !BANDS.includes(Number(b)))
if (kept.length) console.log(`
이번에 안 구운 ${kept.length}권은 그대로 둔다 — band ${kept.join(', ')}`)

const snapshot = {
  // ⚠️ 굽는 시점을 반드시 적는다 — 스냅샷은 낡는다. 낡은 것이 보여야 다시 굽는다.
  generatedAt: new Date().toISOString(),
  unitsPerVolume: UNITS,
  bands: Object.keys(mergedVolumes).map(Number).sort((a, b) => a - b),
  volumes: mergedVolumes,
  problems: mergedProblems,
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, `${JSON.stringify(snapshot, null, 2)}\n`)
const bytes = fs.statSync(OUT).size
console.log(
  `\n스냅샷 ${path.relative(process.cwd(), OUT)} — ${Object.keys(mergedVolumes).length}권 · ${(bytes / 1024).toFixed(1)} KB` +
    (mergedProblems.length ? ` · ⚠ 문제 ${mergedProblems.length}건` : ''),
)
// 오류 본문이 HTML 한 판일 수 있다(Cloudflare 522). 첫 줄만 보여 준다 — 전문은 파일에 있다.
for (const p of mergedProblems) console.log(`  ⚠ band ${p.band} — ${String(p.error).split(String.fromCharCode(10))[0].slice(0, 160)}`)
