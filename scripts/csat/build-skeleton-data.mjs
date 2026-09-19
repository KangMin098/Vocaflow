// scripts/csat/build-skeleton-data.mjs
//
// **지문 골격을 구워 낸다 — 런타임이 `passage` 를 영영 안 만지게.**
//
// ── 왜 빌드 시점인가 ──────────────────────────────────────────────────
// 학습자 경로(`lib/csat/learner.ts`)는 RLS 를 따르는 클라이언트를 **일부러** 쓴다.
// service_role 을 들이면 실수 한 번에 지문이 샌다. 그런데 `csat_items.passage` 는 RLS 가
// 걸려 있어 그 클라이언트로는 못 읽는다 — 공개 뷰(`csat_items_public`)에 컬럼 자체가 없다.
//
// 그래서 골격을 **미리 구워 커밋한다**(`lib/csat/anchor-data/` 와 같은 방식):
//   · 런타임은 `passage` 를 만질 길이 아예 없다 — 주석이 아니라 **구조**가 막는다
//   · 유출 검사가 빌드 시점에 돌고, 산출물은 사람이 열어 볼 수 있다
//   · 조회 왕복 0
//
// ── 나가는 것 ─────────────────────────────────────────────────────────
// 문장마다 **길이(문자 수)** 와, 분석이 근거로 든 **인용문**뿐이다. 인용문은 이미
// `learner.ts` 가 `evidence_quote` 로 내보내던 것이고 우리 저작물인 해설의 일부다.
//
// ⚠️ **유출이 한 건이라도 잡히면 아무것도 쓰지 않는다.** 부분 산출물을 남기면 다음 사람이
//    그걸 «정상» 으로 여긴다. 검사는 정규화해서 견준다 — 그대로 견주면 지문의 don’t 와
//    인용문의 don't 가 달라 43문항이 거짓 양성으로 잡히고, 그 속에 진짜 유출이 묻힌다.
//
// ── 앵커 ──────────────────────────────────────────────────────────────
//   · `answer_locus.quote`            — 정답 근거. body_ok=true 589/589 로 찾힌다
//   · `choice_analysis[].how_to_reject` 속 영어 조각 — 오답 **배제** 근거(`from: 'reject'`)
//   · 못 찾으면 `why_tempting` 속 영어 조각 — 그 자리는 이 선지를 지우지 않고 **끌어당긴다**
//     (`from: 'tempt'`). 화면이 다르게 말해야 하므로 출처를 함께 굽는다
//   · `sentence_index` 는 **쓰지 않는다** — 일치율 65% 라 3문항 중 1문항이 틀린 문장을
//     칠한다(`scripts/csat/anchor-inventory.mjs` 머리말 참조)
//
// 재실행 안전하다. 같은 DB 에 대해 몇 번을 돌려도 같은 파일이 나온다.
//
//   node scripts/csat/build-skeleton-data.mjs            # 예행 — 쓰지 않고 수치만
//   node scripts/csat/build-skeleton-data.mjs --write    # 실제로 쓴다

import fs from 'node:fs'
import path from 'node:path'

for (const f of ['apps/web/.env.local', '.env.local']) {
  try {
    for (const line of fs.readFileSync(path.resolve(f), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch {
    /* 없으면 다음 후보 */
  }
}

const WRITE = process.argv.includes('--write')
const OUT = path.resolve('apps/web/src/lib/csat/skeleton-data')

const { createClient } = await import('@supabase/supabase-js')
const { findQuote, normalizeForMatch } = await import('../../apps/web/src/lib/csat/quote-match.ts')
const { buildSkeleton } = await import('../../apps/web/src/lib/csat/passage-skeleton.ts')

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// ⚠️ 페이징한다 — PostgREST 는 1,000행에서 조용히 끊는다(오류가 아니라 «적게 받음»).
const PAGE = 1000
async function page(table, sel, tune = (q) => q) {
  const out = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await tune(db.from(table).select(sel)).range(from, from + PAGE - 1)
    if (error) {
      console.error(`${table} 조회 실패:`, error.message)
      process.exit(1)
    }
    out.push(...data)
    if (data.length < PAGE) break
  }
  return out
}

const analyses = await page('csat_item_analyses', 'item_id, version, answer_locus, choice_analysis', (q) =>
  q.eq('status', 'published').order('item_id').order('version', { ascending: false }),
)
const latest = new Map()
for (const r of analyses) if (!latest.has(r.item_id)) latest.set(r.item_id, r)

// ⚠️ `type_id` 를 함께 굽는다 — 없으면 «이 유형은 근거가 지문의 어디에 있나» 같은 분석이
//    **매번 DB 를 타야** 하고, 망이 끊기면 못 한다(실측: 그 이유로 3사이클 미뤄졌다).
//    골격이 스스로를 설명하게 두면 그 분석은 영원히 오프라인이다.
const items = await page('csat_items', 'id, exam_id, no, type_id, passage, body_ok', (q) => q.order('id'))

// 한국어 산문에 박힌 영어 조각. 낱말 하나는 지문 어디에나 있어 «아무 데나 칠하기» 가 되므로
// 구(句) 이상만 쓴다.
const MIN = 20
const FRAG = new RegExp(`[A-Za-z][A-Za-z0-9 ,.;:'"()\-‘’“”–—]{${MIN - 1},}`, 'g')
function fragments(text) {
  const out = []
  for (const m of text.matchAll(FRAG)) {
    const s = m[0].trim().replace(/[\s,.;:]+$/, '')
    if (s.length >= MIN) out.push(s)
  }
  return out.sort((a, b) => b.length - a.length)
}

// ── 노출 예산 — 임계값을 지어내지 않는다 ────────────────────────────────
//
// 규칙은 하나다: **새 화면은 어느 지문에서도 지금보다 더 드러내지 않는다.**
// 지금 배포 중인 화면(`learner.ts` 의 `evidence_quote` 단독)이 실제로 얼마나 드러내는지
// **매번 다시 재서**(1차 통과) 그 최대치를 예산으로 쓴다. 손으로 고른 수는 없다.
//
// 예산을 넘으면 **오답 조각부터 긴 것을 뺀다.** 정답 인용문은 손대지 않는다 — 그건 이미
// 배포 중인 동작이고, 줄이면 기존 화면의 퇴행이다. 오답 조각은 «어디인지» 를 가리키는
// 표지라서 짧아도 제 일을 한다.
//
// ⚠️ 예산이 없으면 평균 뒤에 최악이 숨는다. 실측: 전체 18.0% 인데 한 문항은 **59.5%** 였다
//    (내용일치 유형은 선지 다섯이 각기 다른 줄에 대응하는 것이 설계라 다섯을 합치면 지문
//     대부분이 덮인다). 평균만 보면 영영 안 보인다.
// ⚠️ **임계값을 손으로 박지 않는다 — 산출물에서 유도한다.**
//    2026-09-15 에는 `0.371` 을 박아 두었는데, 그것은 그날 잰 값의 **스냅샷**이었다.
//    기출이 늘고 지문이 복구되면서 실제 「answer 단독 최대」는 0.36786 으로 **내려갔고**,
//    박아 둔 수는 그만큼 헐거워져 한 문항이 0.36882 로 상한을 넘었다. 회귀
//    (`skeleton-data.test.ts`)는 같은 값을 **데이터에서 유도**하므로 그것이 잡아냈다 —
//    즉 검사는 옳았고 **굽는 쪽만 옛날 숫자를 들고 있었다.** 그래서 여기서도 유도한다.
const REJECT_MAX = 35

/** 낱말 경계에서 자른다 — 말 중간에서 끊으면 표지 구실을 못 한다. */
function clip(quote, max) {
  if (quote.length <= max) return quote
  const cut = quote.slice(0, max)
  const sp = cut.lastIndexOf(' ')
  return (sp > max * 0.5 ? cut.slice(0, sp) : cut).trim()
}

/**
 * 예산 안으로 앵커를 줄인다. 정답은 그대로, 오답은 `REJECT_MAX` 로 자르고,
 * 그래도 넘으면 **긴 오답부터** 뺀다. 못 지키면 정답만 남긴다(= 현행과 같아진다).
 */
function fitBudget(anchors, passageLen, ceiling) {
  const budget = Math.floor(passageLen * ceiling)
  const answer = anchors.filter((a) => a.id === 'answer')
  const rejects = anchors
    .filter((a) => a.id !== 'answer')
    .map((a) => ({ ...a, quote: clip(a.quote, REJECT_MAX) }))
    .sort((x, y) => y.quote.length - x.quote.length)

  let used = answer.reduce((n, a) => n + a.quote.length, 0)
  const kept = []
  // 짧은 것부터 담아 **개수를 최대화**한다 — 앵커 하나가 선지 하나이므로,
  // 긴 것 하나보다 짧은 것 여럿이 학습자에게 낫다.
  //
  // ⚠️ **`reject` 를 먼저 다 담고 나서 `tempt` 를 담는다.** 섞어서 길이만으로 고르면
  //    「끌리는 자리」가 「지우는 근거」를 예산에서 밀어낼 수 있고, 그건 새 기능이 기존
  //    앵커를 조용히 빼앗는 것이다 — 화면은 멀쩡해 보이고 대응만 약해진다.
  const shortestFirst = (xs) => [...xs].reverse()
  for (const r of [
    ...shortestFirst(rejects.filter((x) => x.from !== 'tempt')),
    ...shortestFirst(rejects.filter((x) => x.from === 'tempt')),
  ]) {
    if (used + r.quote.length > budget) continue
    kept.push(r)
    used += r.quote.length
  }
  return [...answer, ...kept].sort((a, b) => a.id.localeCompare(b.id))
}

function allStrings(v, out = []) {
  if (typeof v === 'string') out.push(v)
  else if (Array.isArray(v)) for (const x of v) allStrings(x, out)
  else if (v && typeof v === 'object') for (const x of Object.values(v)) allStrings(x, out)
  return out
}

// ── 1차 통과: 상한을 잰다 ────────────────────────────────────────────
//
// 배포 중인 화면(`learner.ts` 의 `evidence_quote`)이 어느 지문에서 가장 많이 드러내는가.
// **인용문 길이가 아니라 골격이 실제로 칠하는 글자 수**로 잰다 — 정규화 때문에 둘이 다르고,
// 회귀도 칠해진 글자로 재기 때문이다(다르게 재면 상한이 미묘하게 어긋난다).
let CEILING = 0
let ceilingId = ''
for (const it of items) {
  const a = latest.get(it.id)
  if (!a?.answer_locus?.quote || !it.passage || !it.body_ok) continue
  const { skeleton } = buildSkeleton(it.passage, [{ id: 'answer', quote: a.answer_locus.quote, from: 'answer' }])
  const shown = skeleton.sentences.reduce((b, sn) => b + sn.reveals.reduce((c, r) => c + r.text.length, 0), 0)
  const ratio = shown / skeleton.chars
  if (ratio > CEILING) {
    CEILING = ratio
    ceilingId = it.id
  }
}
if (!(CEILING > 0)) {
  console.error('상한을 못 쟀다 — answer 앵커가 붙는 문항이 하나도 없다. 아무것도 쓰지 않는다.')
  process.exit(1)
}

const byExam = new Map()
let built = 0
let skippedNoBody = 0
let skippedNoAnchor = 0
let leaks = []
let revealed = 0
let passageChars = 0
let anchorsTotal = 0
let droppedByBudget = 0
let worstRatio = 0
let worstId = ''

for (const it of items) {
  const a = latest.get(it.id)
  if (!a || !it.passage) continue
  if (!it.body_ok) {
    // 지문이 잘린 문항이다. 골격을 그리면 **막대 개수부터 거짓말**이 된다.
    skippedNoBody += 1
    continue
  }

  const anchors = []
  if (a.answer_locus?.quote) anchors.push({ id: 'answer', quote: a.answer_locus.quote, from: 'answer' })
  for (const ch of a.choice_analysis || []) {
    if (ch.n == null) continue
    // ① **「지우는 근거」가 먼저다.** 그 자리가 이 선지를 버린다 — 가장 강한 대응이다.
    const fr = ch.how_to_reject ? fragments(ch.how_to_reject).find((f) => findQuote(it.passage, f)) : null
    if (fr) {
      anchors.push({ id: `reject:${ch.n}`, quote: fr, from: 'reject' })
      continue
    }
    // ② 못 찾으면 **「끌리는 이유」**에서 찾는다. 그 자리는 이 선지를 지우지 않는다 —
    //    이 선지로 **끌어당긴다.** 그래서 `from` 으로 갈라 두고 화면이 다르게 말한다.
    //    (같은 말로 칠하면 학습자는 «여기가 지우는 근거» 로 읽는다. 조용한 거짓말이다.)
    //
    //    정답 선지에는 붙이지 않는다 — `reject:n` 은 «버릴 것» 의 id 다.
    if (ch.verdict === 'correct') continue
    const fr2 = ch.why_tempting ? fragments(ch.why_tempting).find((f) => findQuote(it.passage, f)) : null
    if (fr2) anchors.push({ id: `reject:${ch.n}`, quote: fr2, from: 'tempt' })
  }
  if (!anchors.length) {
    skippedNoAnchor += 1
    continue
  }

  const fitted = fitBudget(anchors, it.passage.length, CEILING)
  const { skeleton, placements } = buildSkeleton(it.passage, fitted)

  // 유출 검사 — 정규화해서 견준다.
  const ids = new Set(fitted.map((x) => x.id))
  const normQuotes = fitted.map((x) => normalizeForMatch(x.quote).text)
  const maxQuote = Math.max(...fitted.map((x) => x.quote.length))
  for (const str of allStrings(skeleton)) {
    if (ids.has(str)) continue
    const ns = normalizeForMatch(str).text
    if (!normQuotes.some((q) => q.includes(ns)) || str.length > maxQuote) {
      leaks.push({ id: it.id, sample: str.slice(0, 60) })
      break
    }
  }

  passageChars += it.passage.length
  let itemRevealed = 0
  for (const s of skeleton.sentences) for (const r of s.reveals) itemRevealed += r.text.length
  revealed += itemRevealed
  if (itemRevealed / it.passage.length > worstRatio) {
    worstRatio = itemRevealed / it.passage.length
    worstId = it.id
  }
  anchorsTotal += fitted.length
  droppedByBudget += anchors.length - fitted.length

  if (!byExam.has(it.exam_id)) byExam.set(it.exam_id, [])
  byExam.get(it.exam_id).push({
    id: it.id,
    no: it.no,
    type_id: it.type_id ?? null,
    chars: skeleton.chars,
    sentences: skeleton.sentences,
    anchors: placements,
  })
  built += 1
}

const pct = (x, y) => (y ? ((100 * x) / y).toFixed(1) : '—')
console.log(`\n골격 ${built}문항 · 앵커 ${anchorsTotal}개 · 회차 ${byExam.size}`)
console.log(`  지문 잘림(body_ok=false)으로 건너뜀   ${skippedNoBody}`)
console.log(`  앵커가 하나도 안 붙어 건너뜀          ${skippedNoAnchor}`)
console.log(`  드러난 글자 / 지문 글자               ${revealed} / ${passageChars} (${pct(revealed, passageChars)}%)`)
console.log(`  한 문항 최대 노출                     ${(worstRatio * 100).toFixed(1)}% (${worstId})  [상한 ${(CEILING * 100).toFixed(2)}% — answer 단독 최대, ${ceilingId}]`)
console.log(`  예산 때문에 뺀 오답 앵커              ${droppedByBudget}`)

if (leaks.length) {
  // **아무것도 쓰지 않는다.** 부분 산출물은 다음 사람에게 «정상» 으로 보인다.
  console.error(`\n❌ 원문 유출 ${leaks.length}건 — 아무것도 쓰지 않는다`)
  for (const l of leaks.slice(0, 5)) console.error(`   ${l.id}: ${JSON.stringify(l.sample)}`)
  process.exit(1)
}
console.log('  원문 유출                             0  <- 경계 지켜짐')

if (!WRITE) {
  console.log('\n예행이다. 아무것도 안 썼다. 실제로 구우려면 --write 를 붙일 것.')
  await new Promise((r) => setTimeout(r, 100))
  process.exit(0)
}

fs.mkdirSync(OUT, { recursive: true })
let bytes = 0
const index = []
// 회차 이름. 한 번만 읽는다(29행).
const { data: examRows } = await db.from('csat_exams').select('id, label')
const examLabel = new Map((examRows ?? []).map((e) => [e.id, e.label]))

for (const [examId, list] of [...byExam].sort((a, b) => a[0].localeCompare(b[0]))) {
  list.sort((x, y) => x.no - y.no)
  const file = path.join(OUT, `${examId}.json`)
  // 회차 이름을 함께 굽는다 — 이것이 없으면 「다음 기출」이 이름 하나 때문에 DB 를 쳐야 하고,
  // 그 한 번이 유형 전체 분석 **432행·633 kB** 를 끌고 온다(실측 2026-09-15 · R-BLANK).
  const json = JSON.stringify({ exam_id: examId, exam_label: examLabel.get(examId) ?? examId, items: list })
  fs.writeFileSync(file, json)
  bytes += json.length
  index.push({ exam_id: examId, items: list.length })
}
fs.writeFileSync(
  path.join(OUT, 'index.json'),
  JSON.stringify({ built: new Date().toISOString(), exams: index }, null, 2),
)
console.log(`\n✅ ${byExam.size}개 파일 · ${(bytes / 1024).toFixed(0)} KB → ${path.relative(process.cwd(), OUT)}`)

await new Promise((r) => setTimeout(r, 100))
process.exit(0)
