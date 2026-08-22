// scripts/csat/classify-types.mjs
//
// **630 기출 문항을 유형에 배정하고, 배정이 완전·배타적인지 잰다 — 읽기 전용.**
//
// "설계도가 모든 기출에 100% 맞는다" 를 주장하려면 먼저 두 가지가 0 이어야 한다:
//   · **미배정** — 어느 유형에도 안 걸리는 문항
//   · **중복 매칭** — 두 유형 이상에 걸리는 문항 (유형 정의가 서로 겹친다는 뜻)
// 둘 중 하나라도 남으면 "100%" 는 셀 수 없다.
//
// 규칙은 **지시문에서 귀납**했다(148개 고유 패턴 실측). 문항 번호는 판정에 쓰지 않는다 —
// 번호는 해마다 밀리므로(예: 어법이 27~29 사이를 오간다) 번호로 가르면 옛 회차에서 깨진다.
// 번호는 **검증에만** 쓴다: 유형별 번호 분포가 실제로 좁은지 확인해 규칙이 헛돌지 않았는지 본다.
//
// 실행: pnpm dlx tsx scripts/csat/classify-types.mjs

import fs from 'node:fs'
import path from 'node:path'

const IN = 'scripts/csat/data/questions.json'
const OUT_DIR = path.resolve('scripts/csat/data')

/**
 * 유형 정의 — `id`, `이름`, `영역`, `match`(지시문 정규식).
 * 규칙은 **서로 배타적**이어야 한다. 겹치면 아래 중복 매칭 검사가 잡는다.
 */
const TYPES = [
  // ── 듣기 ────────────────────────────────────────────────────────
  { id: 'L-PURPOSE', name: '담화 목적', sec: '듣기', match: /하는 말의 목적으로/ },
  { id: 'L-OPINION', name: '의견', sec: '듣기', match: /의견으로 가장 적절한/ },
  { id: 'L-MAIN', name: '요지', sec: '듣기', match: /하는 말의 요지로/ },
  { id: 'L-RELATION', name: '관계', sec: '듣기', match: /두 사람의 관계를/ },
  { id: 'L-PICTURE', name: '그림 불일치', sec: '듣기', match: /그림에서 대화의 내용과 일치하지 않는/ },
  { id: 'L-TODO', name: '할 일', sec: '듣기', match: /할 일로 가장 적절한/ },
  { id: 'L-FAVOR', name: '부탁한 일', sec: '듣기', match: /부탁한 일로 가장 적절한/ },
  { id: 'L-MONEY', name: '지불 금액', sec: '듣기', match: /지불할 금액을/ },
  { id: 'L-REASON', name: '이유', sec: '듣기', match: /(이유로 가장 적절한|없는 이유를)/ },
  { id: 'L-NOTMENTION', name: '언급되지 않은 것', sec: '듣기', match: /언급되지 않은 것을 고르시오/ },
  { id: 'L-TABLE', name: '표 보고 선택', sec: '듣기', match: /표를 보면서 대화를 듣고/ },
  { id: 'L-ANNOUNCE', name: '담화 내용 불일치', sec: '듣기', match: /다음 내용을 듣고, 일치하지 않는/ },
  { id: 'L-RESPONSE', name: '짧은 응답', sec: '듣기', match: /마지막 말에 대한 .*응답으로/ },
  { id: 'L-SITUATION', name: '상황 후 할 말', sec: '듣기', match: /상황 설명을 듣고/ },
  { id: 'L-SET-TOPIC', name: '세트 주제', sec: '듣기', match: /하는 말의 주제로 가장 적절한 것은\?/ },
  { id: 'L-SET-NOT', name: '세트 불포함', sec: '듣기', match: /^언급된 .*아닌 것은\?/ },

  // ── 독해 ────────────────────────────────────────────────────────
  { id: 'R-PURPOSE', name: '글의 목적', sec: '독해', match: /다음 글의 목적으로/ },
  { id: 'R-MOOD', name: '심경·분위기', sec: '독해', match: /(심경|분위기)(의 변화)?로 가장 적절한/ },
  { id: 'R-CLAIM', name: '필자 주장', sec: '독해', match: /필자가 주장하는 바로/ },
  { id: 'R-IMPLY', name: '함축 의미', sec: '독해', match: /밑줄 친 .*(의미하는 바로|뜻하는 바로)/ },
  { id: 'R-GIST', name: '요지', sec: '독해', match: /다음 글의 요지로/ },
  { id: 'R-TOPIC', name: '주제', sec: '독해', match: /다음 글의 주제로/ },
  { id: 'R-TITLE', name: '제목', sec: '독해', match: /다음 글의 제목으로/ },
  { id: 'R-CHART', name: '도표', sec: '독해', match: /다음 도표의 내용과/ },
  { id: 'R-FACT', name: '내용 일치(글)', sec: '독해', match: /관한 다음 글의 내용과/ },
  { id: 'R-NOTICE', name: '안내문 일치', sec: '독해', match: /관한 다음 (안내문|글\(안내문\))의 내용과/ },
  { id: 'R-GRAMMAR', name: '어법', sec: '독해', match: /어법상 틀린/ },
  { id: 'R-VOCAB', name: '어휘(문맥)', sec: '독해', match: /(문맥상 낱말의 쓰임이 적절하지 않은|네모 안에서 문맥에 맞는 낱말)/ },
  { id: 'R-BLANK', name: '빈칸 추론', sec: '독해', match: /빈칸에 들어갈 (말|것)로 가장 적절한/ },
  { id: 'R-IRRELEVANT', name: '무관한 문장', sec: '독해', match: /전체 흐름과 관계 없는 문장/ },
  { id: 'R-ORDER', name: '글의 순서', sec: '독해', match: /이어질 글의 순서로/ },
  { id: 'R-INSERT', name: '문장 삽입', sec: '독해', match: /주어진 문장이 들어가기에/ },
  { id: 'R-SUMMARY', name: '요약문 완성', sec: '독해', match: /한 문장으로 요약하고자/ },

  // ── 장문 (41~45) ────────────────────────────────────────────────
  { id: 'X-TITLE', name: '장문 제목', sec: '장문', match: /윗글의 제목으로/ },
  { id: 'X-VOCAB', name: '장문 어휘', sec: '장문', match: /밑줄 친 \(a\).*낱말의 쓰임이 적절하지 않은/ },
  { id: 'X-ORDER', name: '장문 순서', sec: '장문', match: /주어진 글 \(A\)에 이어질 내용을 순서에 맞게/ },
  { id: 'X-REFER', name: '장문 지칭', sec: '장문', match: /가리키는 대상이 나머지 넷과 다른/ },
  { id: 'X-FACT', name: '장문 내용 일치', sec: '장문', match: /윗글에 관한 내용으로/ },
]

const data = JSON.parse(fs.readFileSync(IN, 'utf8'))
const rows = []
const unassigned = []
const multi = []

for (const q of data.questions) {
  const hits = TYPES.filter((t) => t.match.test(q.stem))
  if (hits.length === 0) unassigned.push(q)
  else if (hits.length > 1) multi.push({ ...q, hits: hits.map((h) => h.id) })
  rows.push({ ...q, type: hits.length === 1 ? hits[0].id : null, hit_count: hits.length })
}

const assigned = rows.filter((r) => r.hit_count === 1).length
const pct = (100 * assigned) / rows.length

// 유형별 집계 — 번호 분포가 좁아야 규칙이 제대로 걸린 것이다.
const byType = new Map()
for (const r of rows) {
  if (!r.type) continue
  if (!byType.has(r.type)) byType.set(r.type, { n: 0, nos: new Set(), exams: new Set(), high: 0 })
  const e = byType.get(r.type)
  e.n += 1
  e.nos.add(r.no)
  e.exams.add(r.exam)
  if (r.high_score) e.high += 1
}

console.log('유형  이름              문항  회분  번호 범위        3점')
console.log('─'.repeat(74))
for (const t of TYPES) {
  const e = byType.get(t.id)
  if (!e) {
    console.log(`${t.id.padEnd(13)} ${t.name.padEnd(14)}  ⚠️ 0건 — 규칙이 아무것도 못 잡았다`)
    continue
  }
  const nos = [...e.nos].sort((a, b) => a - b)
  const range = nos.length === 1 ? `${nos[0]}` : `${nos[0]}~${nos[nos.length - 1]}`
  console.log(
    `${t.id.padEnd(13)} ${t.name.padEnd(14)} ${String(e.n).padStart(4)}  ${String(e.exams.size).padStart(3)}  ` +
      `${range.padEnd(14)} ${String(e.high).padStart(3)}`,
  )
}

console.log('')
console.log(`배정 ${assigned}/${rows.length} = ${pct.toFixed(1)}%  ·  미배정 ${unassigned.length}  ·  중복매칭 ${multi.length}`)
if (unassigned.length) {
  console.log('\n미배정 표본:')
  for (const q of unassigned.slice(0, 15)) console.log(`  ${q.exam} #${q.no}  ${q.stem.slice(0, 68)}`)
  if (unassigned.length > 15) console.log(`  … 외 ${unassigned.length - 15}건`)
}
if (multi.length) {
  console.log('\n중복 매칭 표본:')
  for (const q of multi.slice(0, 10)) console.log(`  ${q.exam} #${q.no}  [${q.hits.join(' + ')}]  ${q.stem.slice(0, 52)}`)
}

fs.writeFileSync(
  path.join(OUT_DIR, 'classified.json'),
  JSON.stringify(
    {
      total: rows.length,
      assigned,
      unassigned: unassigned.length,
      multi: multi.length,
      types: TYPES.map((t) => ({ ...t, match: String(t.match) })),
      rows,
      unassigned_rows: unassigned,
      multi_rows: multi,
    },
    null,
    1,
  ),
)
console.log(`\n→ ${path.join(OUT_DIR, 'classified.json')}`)
process.exit(unassigned.length === 0 && multi.length === 0 ? 0 : 1)
