// scripts/csat/measure-order-template.mjs
//
// **순서 배열 유형(36·37·43)의 선택지 순열 세트가 고정인지 잰다 — 읽기 전용.**
//
// 왜: 설계도의 가장 큰 빈칸이 "오답을 어떻게 만드는가" 인데, 정답 키가 없어 정답/오답 대비는
// 불가능하다. 그런데 순서 유형만은 **선택지가 (A)(B)(C) 순열**이라 의미 분석 없이 형식만으로
// 규칙을 확인할 수 있다.
//
// 결과(실측): 같은 시기의 회차들이 **완전히 동일한 토큰 시퀀스**를 쓴다.
// 즉 순열 세트는 매 회차 설계하는 대상이 아니라 **양식**이고, 13년간 2017·2024 두 번 교체됐다.
//
// ⚠️ 2단 조판이 선택지를 흩어 놓아 순열 자체는 완전히 복원되지 않는다(토큰 11~15개만 회수).
//    "고정이다" 는 이 방법으로 증명되지만 "어떤 5개인가" 는 조판 좌표가 있는 PDF 파싱이 필요하다.
//
// 실행: pnpm dlx tsx scripts/csat/measure-order-template.mjs

import fs from 'node:fs'
import path from 'node:path'

const SRC = 'C:/Users/Administrator/Document' + 's/수능영어기출/최종'
const files = fs.readdirSync(SRC).filter((f) => /^\d{4}\.txt$/.test(f)).sort()

/** 문항 n 부터 다음 문항 직전까지의 `(A)`·`(B)`·`(C)` 토큰 시퀀스. */
function tokenSeq(lines, n, next) {
  const i = lines.findIndex((l) => new RegExp(`^\\s*${n}\\s*\\.`).test(l))
  const j = lines.findIndex((l, k) => k > i && new RegExp(`^\\s*${next}\\s*\\.`).test(l))
  if (i < 0 || j < 0) return null
  const t = lines.slice(i, j).join(' ').match(/\((?:A|B|C)\)/g)
  return t ? t.join('') : null
}

const QUESTIONS = [
  [36, 37, '글의 순서'],
  [37, 38, '글의 순서'],
  [43, 44, '장문 순서'],
]

const report = []
for (const [q, next, name] of QUESTIONS) {
  const groups = new Map()
  for (const f of files) {
    const lines = fs.readFileSync(path.join(SRC, f), 'utf8').replace(/\r/g, '').split('\n')
    const seq = tokenSeq(lines, q, next) ?? '(추출 실패)'
    if (!groups.has(seq)) groups.set(seq, [])
    groups.get(seq).push(f.slice(0, 4))
  }
  const real = [...groups].filter(([k]) => k !== '(추출 실패)')
  console.log(`#${q} ${name} — 고유 시퀀스 ${real.length}종 / 회차 ${files.length}`)
  for (const [seq, exams] of groups) {
    console.log(`   [${exams.join(',')}]  ${seq.slice(0, 46)}${seq.length > 46 ? '…' : ''}`)
  }
  console.log('')
  report.push({ question: q, name, groups: [...groups].map(([seq, exams]) => ({ seq, exams })) })
}

const fixed = report.every((r) => r.groups.filter((g) => g.seq !== '(추출 실패)').length <= 3)
console.log(fixed ? '판정: 순열 세트는 고정 템플릿이다(시기별 3구간 이하).' : '판정: 회차마다 다르다 — 템플릿 아님.')

fs.mkdirSync(path.resolve('scripts/csat/data'), { recursive: true })
fs.writeFileSync(path.resolve('scripts/csat/data/order-template.json'), JSON.stringify({ report, fixed }, null, 1))
console.log(`\n→ scripts/csat/data/order-template.json`)
