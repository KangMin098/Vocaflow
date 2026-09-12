// scripts/csat/classify-types.mjs
//
// **기출 문항을 유형에 배정하고, 배정이 완전·배타적인지 잰다 — 읽기 전용.**
//
// "설계도가 모든 기출에 100% 맞는다" 를 주장하려면 먼저 두 가지가 0 이어야 한다:
//   · **미배정** — 어느 유형에도 안 걸리는 문항
//   · **중복 매칭** — 두 유형 이상에 걸리는 문항 (유형 정의가 서로 겹친다는 뜻)
// 둘 중 하나라도 남으면 "100%" 는 셀 수 없다.
//
// 규칙은 **지시문에서 귀납**했다(148개 고유 패턴 실측). 문항 번호는 판정에 쓰지 않는다 —
// 번호는 해마다 밀리므로(어법이 27~29 를 오간다) 번호로 가르면 옛 회차에서 깨진다.
// 번호는 **검증에만** 쓴다: 유형별 번호 분포가 좁은지 봐서 규칙이 헛돌지 않았는지 확인한다.
//
// 분모: **13개년(2014~2026)**. 2014 는 수준별 A/B 두 회분이라 **B형을 2014 대표**로 쓴다
// (현행 통합 수능은 난이도·구성 면에서 B형 계열). A형 45문항은 폐지된 형식이라 참고로만 센다.
//
// 실행: pnpm dlx tsx scripts/csat/classify-types.mjs

import fs from 'node:fs'
import path from 'node:path'

const IN = 'scripts/csat/data/questions.json'
const OUT_DIR = path.resolve('scripts/csat/data')

/** 13개년 분모에서 뺄 회분 — 2014 A형(수준별, 폐지). 참고 수치로는 따로 낸다. */
const OUT_OF_SCOPE = new Set(['2014A'])

/**
 * 지시문을 **공백을 모두 지운 형태**로 맞춰 비교한다.
 * 원문 PDF 는 줄바꿈 지점에서 한글 단어 한가운데에 공백을 넣는다 —
 * `일치 하지 않는` · `의미 하는 바로` (실측 8건). 공백을 살린 채 규칙을 쓰면
 * 같은 유형이 회차마다 갈린다. 그래서 규칙도 전부 공백 없는 형태로 쓴다.
 */
const key = (stem) => String(stem).replace(/\s+/g, '')

/**
 * 유형 정의 — 규칙은 **서로 배타적**이어야 한다(겹치면 아래 중복 검사가 잡는다).
 * 표기 변이는 규칙 안에서 흡수한다 — `위글`↔`윗글`(2015 이전) · `심경변화`↔`심경의변화` 등.
 */
const TYPES = [
  // ── 듣기 ────────────────────────────────────────────────────────
  { id: 'L-PURPOSE', name: '담화 목적', sec: '듣기', match: /하는말의목적으로/ },
  { id: 'L-OPINION', name: '의견', sec: '듣기', match: /의견으로가장적절한/ },
  { id: 'L-MAIN', name: '요지', sec: '듣기', match: /하는말의요지로/ },
  { id: 'L-TOPIC', name: '담화 주제(단독)', sec: '듣기', match: /하는말의주제로가장적절한것을고르시오/ },
  { id: 'L-RELATION', name: '관계', sec: '듣기', match: /두사람의관계를/ },
  { id: 'L-PICTURE', name: '그림', sec: '듣기', match: /그림에서(대화의내용과일치하지않는|.*위치를)/ },
  { id: 'L-TODO', name: '할 일', sec: '듣기', match: /할일로가장적절한/ },
  { id: 'L-FAVOR', name: '부탁한 일', sec: '듣기', match: /부탁한일로가장적절한/ },
  { id: 'L-MONEY', name: '지불 금액', sec: '듣기', match: /지불할금액을/ },
  { id: 'L-REASON', name: '이유', sec: '듣기', match: /이유(로가장적절한|를고르시오)/ },
  { id: 'L-NOTMENTION', name: '언급되지 않은 것', sec: '듣기', match: /언급(되지|하지)않은것을고르시오/ },
  // `언급한 계약서상의 오류를 고르시오` 처럼 목적격 조사가 `를` 인 경우가 있다.
  // `언급하지않은`(L-NOTMENTION)과는 어간이 달라 겹치지 않는다.
  { id: 'L-MENTIONED', name: '언급한 것 고르기', sec: '듣기', match: /언급한[^,]*(을|를)고르시오/ },
  { id: 'L-TABLE', name: '표 보고 선택', sec: '듣기', match: /표를보면서대화를듣고/ },
  { id: 'L-ANNOUNCE', name: '담화 내용 불일치', sec: '듣기', match: /다음내용을듣고,일치하지않는/ },
  { id: 'L-RESPONSE', name: '짧은 응답', sec: '듣기', match: /마지막말에대한.*응답으로/ },
  { id: 'L-SITUATION', name: '상황 후 할 말', sec: '듣기', match: /상황설명을듣고/ },
  { id: 'L-SET-TOPIC', name: '세트 주제', sec: '듣기', match: /하는말의주제로가장적절한것은\?/ },
  { id: 'L-SET-NOT', name: '세트 불포함', sec: '듣기', match: /^언급된.*아닌것은\?/ },

  // ── 독해 ────────────────────────────────────────────────────────
  { id: 'R-PURPOSE', name: '글의 목적', sec: '독해', match: /다음글의목적으로/ },
  // `심경으로` · `심경변화로` · `심경의변화로` 를 모두 받는다(회차마다 표기가 다르다).
  { id: 'R-MOOD', name: '심경·분위기', sec: '독해', match: /(심경|분위기)(의)?(변화)?(으)?로가장적절한/ },
  { id: 'R-CLAIM', name: '필자 주장', sec: '독해', match: /필자가주장하는바로/ },
  { id: 'R-IMPLY', name: '함축 의미', sec: '독해', match: /밑줄친.*(의미하는바로|뜻하는바로)/ },
  { id: 'R-GIST', name: '요지', sec: '독해', match: /다음글의요지로/ },
  { id: 'R-TOPIC', name: '주제', sec: '독해', match: /다음글의주제로/ },
  { id: 'R-TITLE', name: '제목', sec: '독해', match: /다음글의제목으로/ },
  { id: 'R-CHART', name: '도표', sec: '독해', match: /다음(도표|표)의내용과/ },
  // 「안내문」 한 낱말로 충분하다 — 사정권 전수에서 이 낱말이 든 발문 55건이 **전부** 이 유형이고
  // 다른 유형과 한 건도 겹치지 않는다. 좁게 잡았더니(`안내문의내용과`) 단이 안 갈린 페이지에서
  // 발문이 `…다음 안내문의 / 지 않는 것은?` 으로 두 조각 난 M2506#27 이 유형 없이 남았다.
  { id: 'R-NOTICE', name: '안내문 일치', sec: '독해', match: /(안내문|Notice의내용과)/ },
  { id: 'R-FACT', name: '내용 일치(글)', sec: '독해', match: /관한다음글의내용과/ },
  { id: 'R-GRAMMAR', name: '어법', sec: '독해', match: /어법상틀린/ },
  {
    id: 'R-VOCAB',
    name: '어휘(문맥)',
    sec: '독해',
    // 장문 42번(`밑줄 친 (a)~(e)`)까지 삼키지 않도록 배타 조건을 건다.
    match: /^(?!.*밑줄친\(a\)).*(문맥상낱말의쓰임이적절하지않은|네모안에서문맥에맞는낱말)/,
  },
  {
    id: 'R-BLANK',
    name: '빈칸 추론',
    sec: '독해',
    // 40번 요약문(`빈칸 (A),(B)`)과 겹치지 않게 `요약` 을 배제하고,
    // 장문 빈칸(`윗글/위글의 빈칸`, 42번)도 뺀다 — 번호 분포 검사가 42번 5건을 잡아냈다.
    match: /^(?!.*요약)(?!.*(윗글|위글)의빈칸).*빈칸에들어갈(말|것)로가장적절한/,
  },
  {
    id: 'R-REFER',
    name: '지칭 추론(단문·폐지)',
    sec: '독해',
    // 2014~2018 에 26~30 번에 있던 단문 지칭. 장문 44번(`밑줄 친 (a)～(e)`)과 다른 유형이다.
    match: /^(?!.*밑줄친\(a\)).*가리키는대상이나머지넷과다른/,
  },
  {
    id: 'R-BLANK2',
    name: '빈칸 추론(2개·폐지)',
    sec: '독해',
    match: /^(?!.*요약)(?!.*윗글)(?!.*위글).*빈칸\(A\),?\(B\)에들어갈말로/,
  },
  { id: 'R-IRRELEVANT', name: '무관한 문장', sec: '독해', match: /전체흐름과관계없는문장/ },
  { id: 'R-ORDER', name: '글의 순서', sec: '독해', match: /이어질글의순서로/ },
  { id: 'R-INSERT', name: '문장 삽입', sec: '독해', match: /주어진문장이들어가기에/ },
  { id: 'R-SUMMARY', name: '요약문 완성', sec: '독해', match: /한문장으로요약하고자/ },

  // ── 장문 (41~45) ────────────────────────────────────────────────
  { id: 'X-TITLE', name: '장문 제목', sec: '장문', match: /(윗글|위글)의제목으로/ },
  // `낱말의` 를 요구하면 안 된다 — 평가원이 2021·2022학년도 9월 모평에서
  //   `밑줄 친 (a)~(e) 중에서 문맥상 쓰임이 적절하지 않은 것은?` 로 낱말을 빼고 냈다.
  //   그 두 문항이 13년째 미배정으로 남아 있었다(수능 회차엔 없어서 안 보였다).
  { id: 'X-VOCAB', name: '장문 어휘', sec: '장문', match: /밑줄친\(a\).*(낱말의)?쓰임이적절하지않은/ },
  { id: 'X-BLANK2', name: '장문 빈칸(2개)', sec: '장문', match: /(윗글|위글)의빈칸\(A\),?\(B\)에들어갈말로/ },
  { id: 'X-ORDER', name: '장문 순서', sec: '장문', match: /주어진글\(A\)에이어질내용을순서에맞게/ },
  { id: 'X-REFER', name: '장문 지칭', sec: '장문', match: /밑줄친\(a\).*가리키는대상이나머지넷과다른/ },
  { id: 'X-BLANK', name: '장문 빈칸(1개·폐지)', sec: '장문', match: /(윗글|위글)의빈칸에들어갈(말|것)로가장적절한/ },
  {
    id: 'X-FACT',
    name: '장문 내용 일치',
    sec: '장문',
    match: /(윗글|위글)(에관한|의).*(내용과일치하지않는|내용으로적절하지않은)/,
  },
]

const data = JSON.parse(fs.readFileSync(IN, 'utf8'))
const rows = []
for (const q of data.questions) {
  const hits = TYPES.filter((t) => t.match.test(key(q.stem)))
  rows.push({ ...q, type: hits.length === 1 ? hits[0].id : null, hit_count: hits.length, hits: hits.map((h) => h.id) })
}

const scoped = rows.filter((r) => !OUT_OF_SCOPE.has(r.exam))
const stat = (list) => ({
  n: list.length,
  ok: list.filter((r) => r.hit_count === 1).length,
  un: list.filter((r) => r.hit_count === 0).length,
  mu: list.filter((r) => r.hit_count > 1).length,
})
const S = stat(scoped)
const A = stat(rows)

// 유형별 집계 — 번호 분포가 좁아야 규칙이 제대로 걸린 것이다.
const byType = new Map()
for (const r of scoped) {
  if (!r.type) continue
  if (!byType.has(r.type)) byType.set(r.type, { n: 0, nos: new Set(), exams: new Set(), high: 0 })
  const e = byType.get(r.type)
  e.n += 1
  e.nos.add(r.no)
  e.exams.add(r.exam)
  if (r.high_score) e.high += 1
}

console.log('유형          이름               문항 회분 번호범위      3점')
console.log('─'.repeat(70))
for (const t of TYPES) {
  const e = byType.get(t.id)
  if (!e) {
    console.log(`${t.id.padEnd(13)} ${t.name.padEnd(16)} ⚠️ 0건 — 규칙이 아무것도 못 잡았다`)
    continue
  }
  const nos = [...e.nos].sort((a, b) => a - b)
  const range = nos.length === 1 ? String(nos[0]) : `${nos[0]}~${nos[nos.length - 1]}`
  console.log(
    `${t.id.padEnd(13)} ${t.name.padEnd(16)} ${String(e.n).padStart(4)} ${String(e.exams.size).padStart(4)} ` +
      `${range.padEnd(12)} ${String(e.high).padStart(3)}`,
  )
}

const unassigned = scoped.filter((r) => r.hit_count === 0)
const multi = scoped.filter((r) => r.hit_count > 1)

console.log('')
console.log(`13개년(2014=B형)  배정 ${S.ok}/${S.n} = ${((100 * S.ok) / S.n).toFixed(1)}%  ·  미배정 ${S.un}  ·  중복 ${S.mu}`)
console.log(`참고 14회분 전체  배정 ${A.ok}/${A.n} = ${((100 * A.ok) / A.n).toFixed(1)}%  ·  미배정 ${A.un}  ·  중복 ${A.mu}`)

if (unassigned.length) {
  console.log('\n미배정:')
  for (const q of unassigned.slice(0, 20)) console.log(`  ${q.exam} #${q.no}  ${q.stem.slice(0, 66)}`)
  if (unassigned.length > 20) console.log(`  … 외 ${unassigned.length - 20}건`)
}
if (multi.length) {
  console.log('\n중복 매칭:')
  for (const q of multi.slice(0, 12)) console.log(`  ${q.exam} #${q.no}  [${q.hits.join(' + ')}]  ${q.stem.slice(0, 46)}`)
}

fs.writeFileSync(
  path.join(OUT_DIR, 'classified.json'),
  JSON.stringify(
    {
      scope: { primary: '13개년(2014=B형)', out_of_scope: [...OUT_OF_SCOPE] },
      scoped: S,
      all: A,
      types: TYPES.map((t) => ({ id: t.id, name: t.name, sec: t.sec, match: String(t.match) })),
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
