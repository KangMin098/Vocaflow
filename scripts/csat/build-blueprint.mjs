// scripts/csat/build-blueprint.mjs
//
// **유형별 출제 설계도를 실측에서 파생시킨다** — 손으로 적지 않는다.
//
// 제약을 사람이 타이핑하면 그건 설계도가 아니라 기억이다. 여기서는
// `blueprint-measured.json`(기출 실측)에서 규칙을 뽑고, 그 규칙이 다시
// 기출에 맞는지는 `verify-blueprint.mjs` 가 따로 잰다(만든 것과 재는 것을 분리).
//
// 기존 생성기 어휘(`csat_dcp_items.type`, 23종)와의 대응을 함께 싣는다 —
// 대응이 없으면 같은 유형을 두 이름으로 부르게 되고 곧 갈라진다.
//
// 실행: pnpm dlx tsx scripts/csat/build-blueprint.mjs

import fs from 'node:fs'
import path from 'node:path'

const OUT_DIR = path.resolve('scripts/csat/data')
const measured = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'blueprint-measured.json'), 'utf8'))

/**
 * 기존 문항 생성기 어휘와의 대응 (`csat_dcp_items.type` 실측 23종).
 * `null` = 생성기에 대응 유형이 없다(= 이 서비스가 아직 못 만드는 수능 유형).
 * 반대로 생성기에만 있고 수능에 없는 것(`word_order`·`unit_vocab`·`unit_grammar`·
 * `blank_word`·`grammar_choice`)은 **연습 전용**이라 여기 싣지 않는다.
 */
const DCP_MAP = {
  'R-PURPOSE': 'purpose',
  'R-MOOD': 'mood',
  'R-CLAIM': 'claim',
  'R-IMPLY': 'implication',
  'R-GIST': 'main_point',
  'R-TOPIC': 'topic',
  'R-TITLE': 'title',
  'R-FACT': 'content_match',
  'R-GRAMMAR': 'grammar_fix',
  'R-VOCAB': 'vocab_choice',
  'R-BLANK': 'blank',
  'R-IRRELEVANT': 'irrelevant',
  'R-ORDER': 'order',
  'R-INSERT': 'insert',
  'R-SUMMARY': 'summary',
  'X-ORDER': 'long_order',
  'X-REFER': 'long_reference',
  'X-FACT': 'long_match',
}

const RECENT = new Set(['2022', '2023', '2024', '2025', '2026'])
const rows = measured.measured.filter((r) => r.exam !== '2014A' && r.type)

const byType = new Map()
for (const r of rows) {
  if (!byType.has(r.type)) byType.set(r.type, [])
  byType.get(r.type).push(r)
}

const profileOf = new Map(measured.profiles.map((p) => [p.type, p]))

const blueprint = []
for (const [type, all] of byType) {
  const p = profileOf.get(type)
  const recent = all.filter((r) => RECENT.has(r.exam))
  const active = recent.length > 0

  // 회차당 문항 수 — 현행 유형은 최근 5회차 기준, 폐지 유형은 있던 시절 기준.
  const src = active ? recent : all
  const perExam = new Map()
  for (const r of src) perExam.set(r.exam, (perExam.get(r.exam) ?? 0) + 1)
  const counts = [...perExam.values()]

  const words = src.filter((r) => r.en_words > 0).map((r) => r.en_words)
  const nos = [...new Set(src.map((r) => r.no))].sort((a, b) => a - b)
  const langs = [...new Set(src.map((r) => r.choice_lang).filter(Boolean))]
  const choiceCounts = [...new Set(src.map((r) => r.choices))].sort((a, b) => a - b)

  blueprint.push({
    type,
    name: p?.name ?? type,
    section: p?.sec ?? '?',
    status: active ? 'active' : 'retired',
    dcp_type: DCP_MAP[type] ?? null,
    constraints: {
      // 출현 위치 — 관측된 번호 집합. 하나면 고정 슬롯, 여럿이면 이동 슬롯.
      question_nos: nos,
      slot_fixed: nos.length === 1,
      // 회차당 문항 수
      per_exam_min: Math.min(...counts),
      per_exam_max: Math.max(...counts),
      // 선택지 — 5개 고정이 원칙. 그림 유형만 0(선택지가 그림 위에 인쇄된다).
      choices: choiceCounts,
      choices_in_image: type === 'L-PICTURE',
      choice_lang: langs,
      // 지문 길이(영어 단어). 듣기는 지문이 음성이라 지면 길이가 의미 없다.
      passage_words_min: words.length ? Math.min(...words) : null,
      passage_words_max: words.length ? Math.max(...words) : null,
      passage_on_paper: p?.sec !== '듣기',
      // 배점 — 3점이 한 번이라도 붙은 유형인가
      high_score_possible: src.some((r) => r.high_score),
      high_score_rate: Number((src.filter((r) => r.high_score).length / src.length).toFixed(2)),
    },
    evidence: { exams: perExam.size, questions: src.length },
  })
}

blueprint.sort((a, b) => {
  if (a.status !== b.status) return a.status === 'active' ? -1 : 1
  return (a.constraints.question_nos[0] ?? 99) - (b.constraints.question_nos[0] ?? 99)
})

const active = blueprint.filter((b) => b.status === 'active')
const covered = active.filter((b) => b.dcp_type)

fs.writeFileSync(
  path.join(OUT_DIR, 'blueprint.json'),
  JSON.stringify(
    {
      scope: '13개년(2014~2026, 2014=B형) 585문항 실측 파생',
      built_from: 'blueprint-measured.json',
      totals: {
        types: blueprint.length,
        active: active.length,
        retired: blueprint.length - active.length,
        generator_covered: covered.length,
        generator_gap: active.length - covered.length,
      },
      blueprint,
    },
    null,
    1,
  ),
)

console.log(`유형 ${blueprint.length} — 현행 ${active.length} · 폐지 ${blueprint.length - active.length}`)
console.log(`생성기(csat_dcp_items) 대응: ${covered.length}/${active.length} = ${((100 * covered.length) / active.length).toFixed(0)}%`)
console.log('')
console.log('현행인데 생성기가 못 만드는 유형:')
for (const b of active.filter((x) => !x.dcp_type)) {
  console.log(`  ${b.type.padEnd(13)} ${b.name.padEnd(16)} ${b.section}  ${b.constraints.question_nos.join(',')}`)
}
console.log(`\n→ ${path.join(OUT_DIR, 'blueprint.json')}`)
