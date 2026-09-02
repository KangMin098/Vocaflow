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

// T1 회차마다 45문항. 45를 넘으면 홀/짝이 겹쳐 들어온 것이고, 모자라면 추출이 샌 것이다.
const byExam = new Map()
for (const it of items) byExam.set(it.exam, (byExam.get(it.exam) ?? 0) + 1)
const over = [...byExam].filter(([, n]) => n > 45)
const under = [...byExam].filter(([, n]) => n < 45)
ok('T1a 회차당 45문항 초과 없음', over.length === 0, over.map(([e, n]) => `${e}=${n}`).join(' '))
soft('T1b 회차당 45문항 미달 없음', under.length === 0, under.map(([e, n]) => `${e}=${n}`).join(' '))

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

// T5 정답표가 있는 회차는 45문항 전부 정답이 있어야 한다 — 일부만 있으면 파싱이 샌 것이다
const keyed = new Map()
for (const it of items) {
  const e = keyed.get(it.exam) ?? { n: 0, k: 0 }
  e.n += 1
  if (it.answer != null) e.k += 1
  keyed.set(it.exam, e)
}
const partial = [...keyed].filter(([, v]) => v.k > 0 && v.k < v.n)
ok('T5 정답표는 전부 또는 전무', partial.length === 0, partial.map(([e, v]) => `${e}=${v.k}/${v.n}`).join(' '))

// T6 회차 배점 합 — 평가원 영어는 100점 만점이다. 정답표가 있는 회차는 정확히 100 이어야 한다.
const badSum = []
for (const [exam, v] of keyed) {
  if (v.k !== v.n) continue
  const s = items.filter((it) => it.exam === exam).reduce((a, it) => a + (it.points ?? 0), 0)
  if (s !== 100) badSum.push(`${exam}=${s}`)
}
ok('T6 회차 배점 합 100', badSum.length === 0, badSum.join(' '))

// T7 유형 배정률 — 분석 파이프라인의 입력이므로 여기가 새면 유형별 통계가 통째로 틀어진다
const typed = items.filter((it) => it.type_id).length
soft('T7 유형 배정 99% 이상', typed / items.length >= 0.99, `${typed}/${items.length}`)

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

// T10 report 의 수치가 items 와 일치 — 리포트만 고쳐 놓고 원장은 그대로인 사고를 막는다
ok('T10 report.items == items.length', report.items === items.length, `${report.items} vs ${items.length}`)
ok('T10b report.typed 일치', report.typed === typed, `${report.typed} vs ${typed}`)

console.log('── 기출 원장 무결성 ──')
for (const w of warns) console.log(`  ⚠ ${w}`)
for (const f of fails) console.log(`  ✗ ${f}`)
if (!fails.length && !warns.length) console.log('  ✓ 전부 통과')
console.log(`\n  검사 통과 ${fails.length === 0 ? 'PASS' : 'FAIL'} · 경고 ${warns.length}`)
process.exit(fails.length ? 1 : 0)
