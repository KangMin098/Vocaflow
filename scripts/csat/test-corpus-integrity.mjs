// scripts/csat/test-corpus-integrity.mjs
//
// **기출 원장이 스스로를 속이지 않는지 검사한다.**
//
// 이 원장 위에 "유형별 분석 100%" · "회차당 99점 커버" 같은 주장을 얹을 것이므로,
// 분모가 조용히 줄어드는 것을 여기서 막는다. 세 가지가 실제로 겪은 함정이다:
//   ① 회차 손목록 — 폴더에 18회분이 있는데 4회분만 넣고 "전체" 라고 적었다
//   ② 파일명 신뢰 — `_정답표.pdf` 인데 내용이 듣기 대본인 회차가 7개
//   ③ 단 나누기 실패 — 한 페이지가 안 갈리면 그 페이지 오른쪽 단이 통째로 사라진다
//
// 실행: node scripts/csat/test-corpus-integrity.mjs
// 실패하면 exit 1.

import fs from 'node:fs'
import path from 'node:path'

const DIR = path.resolve('scripts/csat/data')
const corpus = JSON.parse(fs.readFileSync(path.join(DIR, 'corpus.json'), 'utf8'))
const { items, report } = corpus

const fails = []
const warns = []
const ok = (name, cond, detail) => (cond ? true : (fails.push(`${name} — ${detail}`), false))
const soft = (name, cond, detail) => (cond ? true : (warns.push(`${name} — ${detail}`), false))

// **듣기는 이 검사에서 전부 빠진다** (사용자 지시 2026-09-03 「듣기는 전체에서 제외」).
// 비율을 내는 검사는 예외 없이 **사정권(독해·장문)** 을 분모로 쓴다 — 듣기를 섞으면
// 우리가 손대지도 않는 520문항이 달성률을 조용히 희석한다.
//
// 딱 하나 예외가 T3* 다: **경계 자체를 확인하는 검사**라 듣기 행을 봐야 성립한다.
// 그것은 듣기를 다루는 것이 아니라 **듣기 자리가 비었는지** 보는 것이다.
const inScope = items.filter((it) => it.in_scope)

// T1 회차마다 독해 문항 수. 2014학년도는 듣기가 22번까지라 23문항, 나머지는 28문항이다.
// 넘으면 홀/짝이 겹쳐 들어온 것이고, 모자라면 추출이 샌 것이다.
const wantScope = (exam) => (exam.startsWith('2014') ? 23 : 28)
const byExam = new Map()
for (const it of inScope) byExam.set(it.exam, (byExam.get(it.exam) ?? 0) + 1)
const over = [...byExam].filter(([e, n]) => n > wantScope(e))
const under = [...byExam].filter(([e, n]) => n < wantScope(e))
ok('T1a 회차당 사정권 문항 초과 없음', over.length === 0, over.map(([e, n]) => `${e}=${n}/${wantScope(e)}`).join(' '))
soft('T1b 회차당 사정권 문항 미달 없음', under.length === 0, under.map(([e, n]) => `${e}=${n}/${wantScope(e)}`).join(' '))

// T2 문항 id 유일
const ids = new Set()
const dup = []
for (const it of items) { if (ids.has(it.id)) dup.push(it.id); ids.add(it.id) }
ok('T2 문항 id 유일', dup.length === 0, dup.slice(0, 5).join(' '))

// T3 번호는 1~45, 영역은 번호와 일치
const badNo = items.filter((it) => it.no < 1 || it.no > 45)
ok('T3a 번호 1~45', badNo.length === 0, badNo.slice(0, 5).map((it) => it.id).join(' '))
// 듣기 마지막 번호는 2014학년도만 22, 나머지는 17 (A/B 수준별 시행 회차)
const lend = (exam) => (exam.startsWith('2014') ? 22 : 17)
const badSec = items.filter((it) => it.section !== (it.no <= lend(it.exam) ? '듣기' : it.no <= 40 ? '독해' : '장문'))
ok('T3b 영역이 번호와 일치', badSec.length === 0, badSec.slice(0, 5).map((it) => it.id).join(' '))

// T3c 사정권(듣기 제외) 딱지가 영역과 일치 — 두 자리에 규칙을 적어 두면 반드시 어긋난다
const badScope = items.filter((it) => it.in_scope !== (it.section !== '듣기'))
ok('T3c in_scope 가 영역과 일치', badScope.length === 0, badScope.slice(0, 5).map((it) => it.id).join(' '))

// T3d 사정권 안에 듣기 유형(L-)이 남아 있으면 경계를 잘못 그은 것이다
const lInScope = items.filter((it) => it.in_scope && it.type_id?.startsWith('L-'))
ok('T3d 사정권에 듣기 유형 없음', lInScope.length === 0, `${lInScope.length}개: ${lInScope.slice(0, 5).map((it) => it.id).join(' ')}`)

// T4 정답이 있으면 1~5, 배점은 2 또는 3
const badAns = items.filter((it) => it.answer != null && (it.answer < 1 || it.answer > 5))
ok('T4a 정답 1~5', badAns.length === 0, badAns.slice(0, 5).map((it) => it.id).join(' '))
const badPt = items.filter((it) => it.points != null && it.points !== 2 && it.points !== 3)
ok('T4b 배점 2 또는 3', badPt.length === 0, badPt.slice(0, 5).map((it) => it.id).join(' '))

// T5 정답표가 있는 회차는 사정권 문항 전부에 정답이 있어야 한다 — 일부만 있으면 파싱이 샌 것이다
const keyed = new Map()
for (const it of inScope) {
  const e = keyed.get(it.exam) ?? { n: 0, k: 0 }
  e.n += 1
  if (it.answer != null) e.k += 1
  keyed.set(it.exam, e)
}
const partial = [...keyed].filter(([, v]) => v.k > 0 && v.k < v.n)
ok('T5 정답표는 전부 또는 전무', partial.length === 0, partial.map(([e, v]) => `${e}=${v.k}/${v.n}`).join(' '))

// T6 **우리가 책임지는 배점의 합.**
//
// 예전에는 「회차 배점 합 100」을 봤다. 그것은 듣기를 더해야 성립하는 수다. 듣기를 전면
// 제외한 지금은 **독해 배점 합**을 본다 — 2015학년도 이후 63점, 2014학년도 A/B형은
// 듣기가 22번까지라 **53점**이다. 이 값이 곧 "실점 0" 의 분모이고, 회차마다 다르다는 사실
// 자체가 학습자에게 중요하다(2014 기출로 「63점 만점」을 연습하면 분모가 틀린다).
const wantPoints = (exam) => (exam.startsWith('2014') ? 53 : 63)
const badSum = []
for (const [exam, v] of keyed) {
  if (v.k !== v.n) continue
  const s = inScope.filter((it) => it.exam === exam).reduce((a, it) => a + (it.points ?? 0), 0)
  if (s !== wantPoints(exam)) badSum.push(`${exam}=${s}/${wantPoints(exam)}`)
}
ok('T6 회차 독해 배점 합', badSum.length === 0, badSum.join(' '))

// T7 유형 배정률 — 분석 파이프라인의 입력이므로 여기가 새면 유형별 통계가 통째로 틀어진다
const typed = inScope.filter((it) => it.type_id).length
soft('T7 유형 배정 99% 이상', typed / inScope.length >= 0.99, `${typed}/${inScope.length}`)

// T8 독해·장문은 지문이 있어야 한다 (듣기는 문제지에 지문이 없다 — 대본은 별도 파일)
const readItems = items.filter((it) => it.in_scope)
const noPass = readItems.filter((it) => !it.passage)
soft('T8 독해 지문 97% 이상', 1 - noPass.length / readItems.length >= 0.97, `없음 ${noPass.length}/${readItems.length}`)

// T9 지문이 있으면 최소 길이가 있어야 한다 — 빈 문자열이 "있음" 으로 세어지는 것을 막는다
const shortPass = readItems.filter((it) => it.passage && it.passage.length < 120)
soft('T9 지문 길이 120자 이상', shortPass.length === 0, `${shortPass.length}개: ${shortPass.slice(0, 5).map((it) => it.id).join(' ')}`)

// T11 **두 회차가 같은 문항 본문을 갖지 않는다.**
// 실측 2026-09-02: `202009_영어영역_문제지.pdf` 와 `202106_영어영역_문제지.pdf` 가 md5 동일이라
// 2020학년도 9월 45문항이 통째로 2021학년도 6월 것으로 채워져 있었다. 두 정답표가 45문항 중
// 31문항에서 어긋나므로 **31문항의 정답이 거짓**이었고, 그걸로 분석하면 학습자를 반대로 훈련시킨다.
// 검사 아홉 개를 통과하면서도 이게 남아 있었다 — 서브에이전트가 문항을 읽다 잡았다.
const stemSig = new Map()
const twins = []
for (const [exam] of byExam) {
  const sig = items
    .filter((it) => it.exam === exam)
    .sort((a, b) => a.no - b.no)
    .map((it) => `${it.no}:${(it.stem ?? '').slice(0, 40)}|${(it.passage ?? '').slice(0, 60)}`)
    .join('\n')
  if (!sig) continue
  if (stemSig.has(sig)) twins.push(`${stemSig.get(sig)}=${exam}`)
  else stemSig.set(sig, exam)
}
ok('T11 두 회차가 같은 본문을 갖지 않음', twins.length === 0, twins.join(' '))

// T12 사정권 문항은 **지문이든 선지든** 하나는 있어야 분석이 가능하다.
// 둘 다 null 이면 그 문항은 원문 블록도 못 뜨는 상태라 드레인이 손댈 수 없다
// (실측 2026-09-02: 22문항 → itemBlocks 에 줄 가운데·세트 머리글 대체를 넣어 3문항).
const noBody = readItems.filter((it) => !it.passage && !it.choices)
soft('T12 사정권 문항에 본문이 있다', noBody.length === 0, `둘 다 없음 ${noBody.length}: ${noBody.slice(0, 5).map((it) => it.id).join(' ')}`)

// T13 **한 회차 안에서 지문이 겹치면 안 된다.**
// 장문 세트(41~45)만 예외다 — 거기서는 두세 문항이 한 지문을 공유하는 것이 설계다.
//
// 실측 2026-09-02: `itemBlocks` 에 세트 머리글 대체 진입점을 넣으면서 `[31~34]`(발문만 묶은 것)를
// 지문 공유로 오인해 **31번 지문이 32·33·34번에 복사됐다.** 지문은 멀쩡해 보이고 길이도 정상이라
// 눈으로는 안 보인다 — 드레인 게이트의 인용 대조 23건이 한꺼번에 어긋나서야 드러났다.
// 그 신호는 우연이었으므로(분석이 이미 있어야 한다) 원장 쪽에 직접 검사를 둔다.
{
  const dupPassage = []
  const byExamPassage = new Map()
  for (const it of items) {
    if (!it.passage || it.passage.length < 200) continue
    if (it.no >= 41) continue // 장문 세트는 공유가 설계다
    // 이미 `body_suspect` 로 표시된 문항은 뺀다 — 드레인이 원문 블록을 함께 실어 보내므로
    // 분석이 잘못될 경로가 막혀 있다. 여기서 세면 **이미 처리한 것을 계속 실패로 부르게** 된다.
    if (it.body_suspect) continue
    const key = `${it.exam}|${it.passage.slice(0, 200)}`
    if (byExamPassage.has(key)) dupPassage.push(`${byExamPassage.get(key)}↔${it.id}`)
    else byExamPassage.set(key, it.id)
  }
  ok('T13 한 회차 안 지문 중복 없음(장문 제외)', dupPassage.length === 0, dupPassage.slice(0, 6).join(' '))
}

// T14 **선지가 옆 문항 것이면 반드시 딱지가 붙어 있어야 한다.**
//
// 실측 2026-09-02: M2406#40·M2306#40(요약 유형)의 선지 다섯 개가 **37번 순서 배열**
// (`(A) － (C) － (B)` …)이었는데 `body_suspect` 는 `false` 였다. 지문이 `null` 이라
// 지문 쪽 신호가 하나도 안 걸렸기 때문이다. 그 상태로 드레인에 나가면 분석자는
// "요약 유형인데 선지가 순서 배열" 이라는 말이 안 되는 문항을 손에 쥐고,
// 원문 창도 못 받는다(딱지가 없으니 export 가 안 싣는다).
//
// 검사는 **딱지가 붙었는지**만 본다 — 파서가 이것을 고치기를 요구하지 않는다.
// 단이 안 갈린 페이지가 12회차에 남아 있고, 그것을 고치는 일은 이미 발행된 분석의
// 인용 좌표를 통째로 흔든다. 지금 필요한 것은 **모른다고 말하는 것**이다.
{
  const orderShape = /^\(([ABC])\)(?:\s*[-‐-―－]\s*\(([ABC])\)){2}/
  const stemTail = /(?:것은\?|고르시오|하시오)$/
  const unflagged = items.filter((it) => {
    if (it.body_suspect) return false
    const cs = (it.choices ?? []).map((c) => String(c).trim())
    if (!cs.length) return false
    if (!/ORDER/.test(it.type_id ?? '') && cs.filter((c) => orderShape.test(c)).length >= 3) return true
    return cs.some((c) => stemTail.test(c))
  })
  ok(
    'T14 옆 문항 선지가 섞였는데 딱지가 없는 문항 없음',
    unflagged.length === 0,
    `${unflagged.length}건: ${unflagged.slice(0, 6).map((it) => it.id).join(' ')}`,
  )
}

// T15 **같은 해 두 문제지가 공유하는 문항은 표시돼 있어야 한다.**
//
// 2014학년도 수준별(A/B형) 시행에서 `2014A#24 ≡ 2014B#23`(요지) · `2014A#32 ≡ 2014B#29`(도표)가
// 지문 문자열까지 같다. 번호가 다르니 원장은 서로 다른 문항으로 보고, 유형별 통계는 한 문항을
// 두 번 센다 — "이 유형 n문항" 이 그만큼 부푼다.
//
// 지우지 않는 이유는 회차 배점 합 100 검사(T6)가 양쪽을 다 필요로 하기 때문이다.
// 그러니 **표시가 붙었는지**만 본다.
{
  const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim()
  const byYear = new Map()
  for (const it of readItems) {
    if (!it.passage || it.passage.length < 150) continue
    const k = `${it.year}|${norm(it.passage)}`
    if (!byYear.has(k)) byYear.set(k, [])
    byYear.get(k).push(it)
  }
  const unmarked = []
  for (const group of byYear.values()) {
    if (group.length < 2) continue
    if (new Set(group.map((it) => it.exam)).size < group.length) continue // 같은 회차 중복은 T13 소관
    for (const it of group) if (!(it.same_item_as ?? []).length) unmarked.push(it.id)
  }
  ok(
    'T15 회차 간 공통 문항에 same_item_as 표시',
    unmarked.length === 0,
    `표시 없음 ${unmarked.length}: ${unmarked.slice(0, 6).join(' ')}`,
  )
}

// T10 report 의 수치가 items 와 일치 — 리포트만 고쳐 놓고 원장은 그대로인 사고를 막는다.
// **최상위 수치는 사정권이다**(듣기 전면 제외). 듣기를 섞은 수는 `report.paper` 안에만 있고,
// 그것은 파서 점검 전용이라 여기서도 화면에서도 보고하지 않는다.
ok('T10 report.in_scope.items 일치', report.in_scope.items === inScope.length, `${report.in_scope.items} vs ${inScope.length}`)
ok('T10b report.in_scope.typed 일치', report.in_scope.typed === typed, `${report.in_scope.typed} vs ${typed}`)
ok(
  'T10c 최상위에 듣기 섞인 수치 없음',
  report.items === undefined && report.typed === undefined,
  '`report.items`/`report.typed` 는 듣기를 포함한다 — 최상위에 두면 반드시 보고된다',
)

console.log('── 기출 원장 무결성 ──')
for (const w of warns) console.log(`  ⚠ ${w}`)
for (const f of fails) console.log(`  ✗ ${f}`)
if (!fails.length && !warns.length) console.log('  ✓ 전부 통과')
console.log(`\n  검사 통과 ${fails.length === 0 ? 'PASS' : 'FAIL'} · 경고 ${warns.length}`)
process.exit(fails.length ? 1 : 0)
