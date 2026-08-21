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

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const { createClient } = await import('@supabase/supabase-js')
const { assessStock, CSAT_ITEM_WORDS } = await import('@vocaflow/library-pipeline')

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// 1,000행 조용한 절단에 두 번 당했다 — 페이지로 받는다.
const raw = []
for (let from = 0; ; from += 500) {
  const { data, error } = await db
    .from('csat_dcp_items')
    .select('id, type, payload, answer_key, v_level')
    .order('id')
    .range(from, from + 499)
  if (error) throw new Error('문항 조회 실패: ' + error.message)
  if (!data?.length) break
  raw.push(...data)
  if (data.length < 500) break
}

/** 유형마다 답지 수·정답·지문이 다른 자리에 있다. 한 곳에 모아 둔다. */
const SHAPE = {
  // ⚠️ `order` 는 정답이 답지 번호가 아니라 **배열**이라 저장 형식에 번호가 없다.
  //   번호는 `toCsatOrder` 가 인쇄할 때 정한다. 못 재는 것을 0 으로 재면 "✅ 고름" 이
  //   찍히는데, 그건 잰 게 아니라 **안 잰 것을 통과로 눙친 것**이다. 답지 수를 0 으로 둬서
  //   쏠림 판정 대상에서 뺀다.
  order: { choices: 0, answer: () => 0, passage: (p) => (p?.presented ?? []).join(' ') },
  insert: {
    choices: 5,
    answer: (a) => a?.position ?? 0,
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

const words = (t) => (t == null ? null : t.split(/\s+/).filter(Boolean).length)

const items = raw.map((r) => {
  const shape = SHAPE[r.type]
  return {
    id: r.id,
    type: r.type,
    // ⚠️ `order` 는 정답이 답지 번호가 아니라 배열이라 저장 형식에 번호가 없다.
    //   `toCsatOrder` 가 인쇄할 때 번호를 정하므로, 저장본만 보고는 쏠림을 못 잰다.
    //   그 사실을 0 으로 눙치지 않고 아래에서 따로 적는다.
    answer: shape ? shape.answer(r.answer_key) : 0,
    choiceCount: shape ? shape.choices : 0,
    passageWords: shape ? words(shape.passage(r.payload)) : null,
    vLevel: r.v_level ?? null,
  }
})

// 관측 — 지금은 0행이다. 들어오면 여기서 붙는다.
const { data: attemptRows, error: aErr } = await db
  .from('csat_item_attempts')
  .select('question_id, is_correct')
  .limit(50000)
if (aErr) throw new Error('관측 조회 실패: ' + aErr.message)
const agg = new Map()
for (const a of attemptRows ?? []) {
  const s = agg.get(a.question_id) ?? { id: a.question_id, attempts: 0, correct: 0 }
  s.attempts++
  if (a.is_correct) s.correct++
  agg.set(a.question_id, s)
}
const stats = [...agg.values()]

const health = assessStock(items, CSAT_ITEM_WORDS, stats)

const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1) + '%' : '—')
const line = '─'.repeat(76)
console.log(`${line}\n문항 건강 리포트 — 제작 8단계 중 8번(평가·개정)\n`)
console.log(`  저장 문항 ${health.total}  ·  지문 규격 ${CSAT_ITEM_WORDS.min}~${CSAT_ITEM_WORDS.max}어\n`)

const flags = []
for (const t of health.byType) {
  console.log(`  ── ${t.type}  (${t.count}) ${'─'.repeat(Math.max(0, 46 - t.type.length))}`)

  if (t.answerBias) {
    const b = t.answerBias
    const mark = b.biased ? '⚠️ 쏠림' : '✅ 고름'
    console.log(
      `     정답 번호  ${b.counts.join(' · ')}   최다 ${pct(Math.max(...b.counts), b.total)}` +
        `   χ²=${b.chi2.toFixed(1)} (df ${b.df}, 임계 9.5)  ${mark}`,
    )
    if (b.biased) flags.push(`${t.type}: 정답 번호 쏠림 (χ²=${b.chi2.toFixed(1)})`)
  } else if (t.type === 'order') {
    console.log(`     정답 번호  저장 형식에 번호가 없다 — 인쇄할 때 정해진다(못 잼)`)
  } else {
    console.log(`     정답 번호  단답이라 답지가 없다`)
  }

  if (t.outOfSpecPassage != null) {
    const bad = t.outOfSpecPassage
    console.log(
      `     지문 규격  밖 ${bad} / ${t.count}  = ${pct(bad, t.count)}  ${bad === 0 ? '✅' : '⚠️'}`,
    )
    if (bad > 0) flags.push(`${t.type}: 지문 규격 밖 ${bad}건 (${pct(bad, t.count)})`)
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
