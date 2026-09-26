// scripts/csat/checklist-exp/validate.mjs
//
// **체크리스트 답 파일 검사 — 판정자가 쓰고 나서 한 번 돌린다(읽기 전용).**
// 입력의 id 마다 답이 정확히 하나 · 같은 순서 · 빠진 질문 없음 · note 중복 없음. 판정자가 매번 검사기를 새로 짜지 않게
// 여기 둔다 — 서브에이전트 요청 수가 곧 비용이다(요청마다 컨텍스트 전체를 다시 읽는다 · docs/reports/checklist-exp-20260926.md).
//
// 실행: node scripts/csat/checklist-exp/validate.mjs <chunk.json> <out.json>   (통과 exit 0 · 실패 exit 1 과 사유)

import fs from 'node:fs'

import { missingAnswers } from './decide.mjs'

const [inPath, outPath] = process.argv.slice(2)
if (!inPath || !outPath) {
  console.error('사용: validate.mjs <chunk.json> <out.json>')
  process.exit(2)
}
const input = JSON.parse(fs.readFileSync(inPath, 'utf8'))
let out
try {
  out = JSON.parse(fs.readFileSync(outPath, 'utf8'))
} catch (e) {
  console.error(`출력을 읽지 못했다: ${e.message}`)
  process.exit(1)
}

const problems = []
if (!Array.isArray(out)) problems.push('출력이 배열이 아니다')
else {
  if (out.length !== input.length) problems.push(`개수 ${out.length} ≠ 입력 ${input.length}`)
  const notes = new Map()
  input.forEach((it, i) => {
    const o = out[i]
    if (!o) return
    if (o.id !== it.id) problems.push(`${i}번: id 가 입력 순서와 다르다 (${o.id})`)
    const miss = missingAnswers(o.answers)
    if (miss.length) problems.push(`${i}번 ${it.id.slice(0, 8)}: 빠지거나 형이 틀린 답 ${miss.join(',')}`)
    if (typeof o.note !== 'string' || o.note.length < 12) problems.push(`${i}번 ${it.id.slice(0, 8)}: note 가 없거나 12자 미만`)
    else if (notes.has(o.note)) problems.push(`${i}번: note 가 ${notes.get(o.note)}번과 같다`)
    else notes.set(o.note, i)
  })
}
if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}
console.log(`통과 — ${out.length}편`)
