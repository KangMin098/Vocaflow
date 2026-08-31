// scripts/textbook/item-health-report.mjs
//
// **문항 건강 리포트 — 상업 교재 제작 8단계 중 8번(평가·개정).**
//
// 저장된 문항 전체를 훑어 "고쳐야 할 것" 을 낸다. 학습자 관측이 없어도 넷은 지금 볼 수 있다:
//
//   ① 정답 번호 쏠림   — 카이제곱으로 본다(비중이 아니라). 쏠리면 읽지 않고 찍어서 맞는다
//   ② 지문 규격        — 수능 지문 90~200어 밖이면 시험지에 못 싣는다
//   ③ 밴드 분포        — 비어 있는 학년이 곧 못 만드는 교재다
//   ④ 관측 유무        — **없으면 없다고 적는다.** 안 적으면 다음 사람이 평가 단계가 있다고 오해한다
//
// 관측(`csat_item_attempts`)이 들어오면 난이도·변별도가 자동으로 붙는다.
//
// 재실행 안전: 읽기만 한다.
// 실행: pnpm dlx tsx scripts/textbook/item-health-report.mjs

import fs from 'node:fs'
import path from 'node:path'

import { fetchAllKeyset } from './volume-pool.mjs'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const { createClient } = await import('@supabase/supabase-js')
// **인쇄 형식으로 바꿔서 잰다.** 저장 형식의 숫자는 학습자가 보는 번호가 아니다 —
// 첫 판에서 이걸 틀렸다(아래 SHAPE 주석 참조).
const {
  assessStock, CSAT_ITEM_WORDS, itemWordSpec, toCsatOrder, toCsatInsert,
  dropRepeatedTail, stripSectionLabels,
} = await import(
  '@vocaflow/library-pipeline'
)

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// 1,000행 조용한 절단에 두 번 당했다 — 페이지로 받는다.
//
// ⚠️ **OFFSET 으로 넘기면 안 된다 — 자가 먼저 부러진다.** 제 손으로 짠 500행 `range()`
//   루프가 재고 42만 행에서 `statement timeout` 으로 죽어 **검수 도구가 아예 안 도는
//   상태**였다. 페이지를 500 → 25 로 줄여도 살아나지 않았다. 원인은 부하가 아니라
//   OFFSET 그 자체다 — 실측 2026-08-31 `explain analyze`:
//
//     offset 400000 limit 500  →  인덱스 스캔이 400,500행을 훑고 **97.6초**
//
//   커서(keyset)는 pk 인덱스를 그대로 타 페이지 깊이와 무관하다. 재시도·페이지 축소
//   정책도 `volume-pool` 것을 그대로 쓴다 — 사본을 두면 한쪽만 고쳐진다.
const raw = await fetchAllKeyset(db, 'csat_dcp_items', 'id, type, payload, answer_key, v_level')

/**
 * 유형마다 답지 수·정답·지문이 다른 자리에 있다. 한 곳에 모아 둔다.
 *
 * ── 첫 판에서 두 번 틀렸다 (2026-08-21) ─────────────────────────────
 * ① `order` 는 저장 형식에 번호가 없다고 보고 판정에서 뺐다. **틀렸다** — `toCsatOrder` 를
 *    돌리면 번호가 나온다. "못 잰다" 가 아니라 **안 재고 있었다.**
 * ② `insert` 는 `answer_key.position` 을 번호로 썼다. **그건 문단 안 위치(1..n)이지
 *    인쇄되는 ①~⑤ 가 아니다.** 실측 결과 위치가 9까지 있었고, 6~9 인 **76건이 히스토그램에서
 *    조용히 빠져** 있었다. 그렇게 나온 χ²=208.6 은 엉뚱한 분포를 잰 숫자였다.
 *
 * 그래서 **인쇄 형식으로 바꿔서 잰다** — 학습자가 보는 것이 그것이다.
 * 변환이 실패하면(규격 밖) 그 문항은 애초에 교재에 못 실으므로 따로 센다.
 */
const SHAPE = {
  order: {
    choices: 5,
    answer: (a, p) => toCsatOrder(p?.presented ?? [], a?.source_order ?? [])?.answer ?? null,
    passage: (p) => (p?.presented ?? []).join(' '),
  },
  insert: {
    choices: 5,
    answer: (a, p) =>
      toCsatInsert(p?.remaining ?? [], p?.insert_sentence ?? '', a?.position)?.answer ?? null,
    passage: (p) => [...(p?.remaining ?? []), p?.insert_sentence].filter(Boolean).join(' '),
  },
  irrelevant: {
    choices: 5,
    answer: (a) => a?.position ?? 0,
    passage: (p) => [p?.intro, ...(p?.sentences ?? [])].filter(Boolean).join(' '),
  },
  vocab_choice: {
    choices: 5,
    answer: (a) => a?.position ?? 0,
    passage: (p) => (p?.sentences ?? []).join(' '),
  },
  grammar_choice: {
    choices: 5,
    answer: (a) => a?.position ?? 0,
    passage: (p) => (p?.sentences ?? []).join(' '),
  },
  // 단답이라 답지가 없다 — 쏠림을 잴 대상이 아니다.
  word_order: { choices: 0, answer: () => 0, passage: () => null },
}

/**
 * 드레인으로 만드는 생성형 유형 — **모양이 하나다**
 * (`item-drain-export.mjs`: payload `{ passage, choices[5] }` · answer_key `{ answer }`).
 *
 * ⚠️ 2026-08-30 까지 이 열다섯이 `SHAPE` 에 없어서 **전부 "단답이라 답지가 없다" 로
 *    분류되어 정답 쏠림 검정에서 빠져 있었다.** 5지선다인데 안 재고 있었던 것이라,
 *    위 ① 과 **같은 실수**다("못 잰다" 가 아니라 "안 재고 있었다").
 *    드레인으로 수천 건을 넣을 참이라 지금 막지 않으면 쏠림이 조용히 쌓인다.
 */
for (const type of [
  'purpose', 'mood', 'claim', 'implication', 'main_point', 'topic', 'title',
  'blank', 'summary', 'content_match',
  'long_order', 'long_reference', 'long_title', 'long_vocab', 'long_match',
]) {
  SHAPE[type] = {
    choices: 5,
    answer: (a) => a?.answer ?? 0,
    passage: (p) => p?.passage ?? null,
  }
}

// ⚠️ **학습자가 보는 지문으로 잰다.** 조판은 절 이름을 떼고 반복 꼬리를 자른 사본을
//   인쇄한다(volume-pool 의 cleanPayload). 리포트가 저장 원본을 재면 이미 고친 결함을
//   계속 결함이라고 말한다 — 실측 2026-08-31: topic 8건 · title 8건이 그 이유로
//   "규격 밖" 이었는데, 전부 중복된 초록이 창에 딸려 들어가 200어를 넘긴 것이었다.
//   이 파일 머리말이 이미 같은 원칙을 적어 두었다("인쇄 형식으로 바꿔서 잰다").
const printed = (t) => (t == null ? null : dropRepeatedTail(stripSectionLabels(t)))
const words = (t) => {
  const p = printed(t)
  return p == null ? null : p.split(/\s+/).filter(Boolean).length
}

// 인쇄 변환이 실패한 문항 — 교재에 실을 수 없다. 히스토그램에서 조용히 빼지 않고 센다.
const unprintable = new Map()

const items = raw.map((r) => {
  const shape = SHAPE[r.type]
  const answer = shape ? shape.answer(r.answer_key, r.payload) : null
  if (shape && shape.choices > 0 && answer == null) {
    unprintable.set(r.type, (unprintable.get(r.type) ?? 0) + 1)
  }
  return {
    id: r.id,
    type: r.type,
    answer: answer ?? 0,
    choiceCount: shape ? shape.choices : 0,
    passageWords: shape ? words(shape.passage(r.payload)) : null,
    vLevel: r.v_level ?? null,
  }
})

// 관측 — `dcp_item_id` 로 읽는다. `question_id` 는 quiz_questions 전용이라,
// 거기에 문항 id 를 넣던 동안 모든 INSERT 가 FK 위반으로 죽어 0행이었다
// (마이그레이션 20260822013136 에서 컬럼을 나눴다).
// ⚠️ `.limit(50000)` 을 붙여도 서버는 1000행에서 자른다. 관측이 쌓이기 시작하면
//   그 절단이 곧바로 **난이도·변별도를 왜곡**한다 — 앞 1000건만 본 P 값은 진짜 P 가 아니다.
//   여기는 `.in()` 조회가 아니라 전수라서 페이징을 직접 돈다.
const attemptRows = []
{
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('csat_item_attempts')
      .select('dcp_item_id, is_correct')
      // 페이지가 겹치거나 새지 않도록 정렬을 고정한다.
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw new Error('관측 조회 실패: ' + error.message)
    attemptRows.push(...(data ?? []))
    if (!data || data.length < PAGE) break
  }
}
const agg = new Map()
for (const a of attemptRows ?? []) {
  // 문항 재생성으로 링크가 끊긴 행(ON DELETE SET NULL)은 난이도·변별도에 못 쓴다.
  if (!a.dcp_item_id) continue
  const s = agg.get(a.dcp_item_id) ?? { id: a.dcp_item_id, attempts: 0, correct: 0 }
  s.attempts++
  if (a.is_correct) s.correct++
  agg.set(a.dcp_item_id, s)
}
const stats = [...agg.values()]

// 유형마다 자가 다르다 — 장문은 260~400어다. 한 자로 재면 장문이 전량 오탐이 된다.
const health = assessStock(items, itemWordSpec, stats)

const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1) + '%' : '—')
const line = '─'.repeat(76)
console.log(`${line}\n문항 건강 리포트 — 제작 8단계 중 8번(평가·개정)\n`)
console.log(`  저장 문항 ${health.total}  ·  지문 규격 ${CSAT_ITEM_WORDS.min}~${CSAT_ITEM_WORDS.max}어\n`)

const flags = []
for (const t of health.byType) {
  console.log(`  ── ${t.type}  (${t.count}) ${'─'.repeat(Math.max(0, 46 - t.type.length))}`)

  // **겸용 유형은 규격 밖이 결함이 아니다.**
  // `order`·`insert` 는 DCP 가 학습 화면(구문 연습)을 위해 만든 것이기도 하다.
  // 그쪽은 문단 4문장부터 받으므로 수능 지문 규격(90~200어)을 벗어나는 재고가 **의도된 것**이다.
  // 교재는 그중 규격에 드는 것만 쓴다 — 매번 "고칠 것" 으로 세면 리포트가 늑대를 부른다.
  const dual = t.type === 'order' || t.type === 'insert'
  const bad = unprintable.get(t.type) ?? 0
  if (bad) {
    const mark = dual ? 'ℹ️ 학습 화면 전용 재고' : '⚠️ 교재에 못 싣는다'
    console.log(`     인쇄 변환  실패 ${bad} / ${t.count} = ${pct(bad, t.count)}  ${mark}`)
    if (!dual) flags.push(`${t.type}: 인쇄 변환 실패 ${bad}건 (${pct(bad, t.count)})`)
  }

  if (t.answerBias) {
    const b = t.answerBias
    const printable = b.counts.reduce((s, n) => s + n, 0)
    const mark = b.biased ? '⚠️ 쏠림' : '✅ 고름'
    console.log(
      `     정답 번호  ${b.counts.join(' · ')}   (인쇄 가능 ${printable})  최다 ${pct(Math.max(...b.counts), printable)}` +
        `   χ²=${b.chi2.toFixed(1)} (df ${b.df}, 임계 9.5) · V=${b.cramersV.toFixed(3)} (기준 0.10)  ${mark}`,
    )
    if (b.biased) flags.push(`${t.type}: 정답 번호 쏠림 (χ²=${b.chi2.toFixed(1)} · V=${b.cramersV.toFixed(3)})`)
  } else {
    console.log(`     정답 번호  단답이라 답지가 없다`)
  }

  if (t.outOfSpecPassage != null) {
    const out = t.outOfSpecPassage
    const mark = out === 0 ? '✅' : dual ? 'ℹ️ 학습 화면 전용 재고' : '⚠️'
    const usable = t.count - out
    console.log(
      `     지문 규격  밖 ${out} / ${t.count}  = ${pct(out, t.count)}  ${mark}` +
        (dual ? `   교재에 쓸 수 있는 것 ${usable}` : ''),
    )
    if (out > 0 && !dual) flags.push(`${t.type}: 지문 규격 밖 ${out}건 (${pct(out, t.count)})`)
  }

  const levels = Object.entries(t.byLevel).sort((a, b) => a[0].localeCompare(b[0], 'en', { numeric: true }))
  console.log(`     밴드      ${levels.map(([k, n]) => `${k} ${n}`).join(' · ')}`)
  console.log(`     관측      ${t.observed}${t.observed ? ` (변별 0 인 문항 ${t.degenerate})` : ' — 없음'}`)
  console.log()
}

console.log(line)
if (health.noObservations) {
  console.log(
    '\n  ⚠️ **학습자 관측이 한 건도 없다.** 난이도·변별도는 계산되지 않았다.\n' +
      '     이 리포트가 지금 보는 것은 "만들어진 모양" 이지 "가르쳐 본 결과" 가 아니다.\n' +
      '     `csat_item_attempts` 에 행이 쌓이면 같은 스크립트가 난이도(P)와 변별도(D)를 함께 낸다.',
  )
}
console.log(`\n  고칠 것 ${flags.length}건`)
for (const f of flags) console.log(`    · ${f}`)
if (!flags.length) console.log('    (없음)')
