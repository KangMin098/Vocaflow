// scripts/research/goal-data/d2-validate.check.mjs
//
// d2-validate 반례 검사 — 선택 이유 반복 검출(T-0107: 2행 완전 반복 · 템플릿 · 청크 간)이 실제로 잡는지 확인한다.
//   node scripts/research/goal-data/d2-validate.check.mjs   (실패 시 exit 1)
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { loadTrack, makeValidator } from './d2-validate.mjs'

const input = { contract: 'v2.4', tasks: ['r.central_meaning'], rows: [] }
const V = makeValidator(input, [])
const cases = [
  { name: '2행 완전 반복', rows: [{ item_id: 'X#1', primary_reason: '빈칸 명제를 본문 결론 문장에서 바로 압축한다' }, { item_id: 'Y#2', primary_reason: '빈칸 명제를 본문 결론 문장에서 바로 압축한다' }], expect: true },
  { name: '템플릿 3행(영어 · 인용만 바꿈)', rows: [1, 2, 3].map((n) => ({ item_id: `Z#${n}`, primary_reason: `「word${n}」 를 본문 retell${n} 문장과 대조해 정답 ${n} 을 고른다` })), expect: true },
  { name: 'direct 단일(실제 direct 1 · primary 일치)은 템플릿 검사 제외', rows: [1, 2, 3].map((n) => ({ item_id: `S#${n}`, primary_task: 'r.central_meaning', links: [{ task_id: 'r.central_meaning', relevance: 'direct' }], primary_reason: `direct 단일 — 결정 지점 point${n} 문장` })), expect: false },
  { name: '허위 direct 단일(다중 direct) 거부(T-0108)', rows: [{ item_id: 'F#1', primary_task: 'r.central_meaning', links: [{ task_id: 'r.central_meaning', relevance: 'direct' }, { task_id: 'e.evidence_location', relevance: 'direct' }], primary_reason: 'direct 단일 — 결정 지점 끝 문장' }], expect: true },
  { name: 'direct 단일인데 primary 와 다른 TASK 거부', rows: [{ item_id: 'G#1', primary_task: 'e.task_demand', links: [{ task_id: 'r.central_meaning', relevance: 'direct' }], primary_reason: 'direct 단일 — 결정 지점 첫 문장' }], expect: true },
  { name: '서로 다른 이유', rows: [{ item_id: 'A#1', primary_reason: '중심 문장이 마지막 단락에 명시돼 압축만 필요하다' }, { item_id: 'B#1', primary_reason: '선지 셋이 본문 낱말을 재사용해 대조 없이는 둘이 남는다' }], expect: false },
]
let bad = 0
for (const c of cases) {
  const got = V.reasons(c.rows).length > 0
  console.log(`${got === c.expect ? 'ok ' : 'FAIL'} ${c.name} → 검출 ${got}`)
  if (got !== c.expect) bad++
}
// 공용 로더(T-0115 RECHECK-P1-01): 청크 반복 검사 실패 → 그 청크 행 전부 배제 · 행 결함 → 그 행만 배제 · 트랙 이유 반복 → 전부 배제
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-loader-'))
const rows = (p) => Array.from({ length: 3 }, (_, k) => ({ item_id: `${p}#${k}` }))
fs.writeFileSync(path.join(dir, 'chunk-A-01.out.json'), JSON.stringify({ rows: rows('X') }))
fs.writeFileSync(path.join(dir, 'chunk-A-02.out.json'), JSON.stringify({ rows: rows('Y') }))
const stub = (o) => ({ chunk: (r) => (o.chunkFail && r[0].item_id.startsWith('X') ? ['반복'] : []), row: (r) => (o.rowFail === r.item_id ? ['결함'] : []), reasons: () => (o.reasonFail ? ['이유 반복'] : []) })
const ids = [...rows('X'), ...rows('Y')].map((r) => r.item_id)
const loaderCases = [
  { name: '청크 반복 실패 → 그 청크 3행 배제', o: { chunkFail: true }, expect: 3 },
  { name: '행 결함 → 그 행만 배제', o: { rowFail: 'Y#1' }, expect: 5 },
  { name: '트랙 이유 반복 → 전부 배제', o: { reasonFail: true }, expect: 0 },
  { name: '결함 없음 → 6행', o: {}, expect: 6 },
]
for (const c of loaderCases) {
  const got = loadTrack(dir, 'A', 2, stub(c.o), ids).out.size
  console.log(`${got === c.expect ? 'ok ' : 'FAIL'} 로더: ${c.name} → 통과 ${got}`)
  if (got !== c.expect) bad++
}
fs.rmSync(dir, { recursive: true, force: true })
// prereg-compare 가 공용 로더를 쓰는지(정적 확인) — 자체 행 필터로 되돌아가면 청크 검사를 다시 빠뜨린다
const cmp = fs.readFileSync(new URL('./prereg-compare.mjs', import.meta.url), 'utf8')
const usesLoader = cmp.includes('loadTrack(') && !cmp.includes('V.row(r)')
console.log(`${usesLoader ? 'ok ' : 'FAIL'} prereg-compare 가 공용 로더만 쓴다`)
if (!usesLoader) bad++
process.exit(bad ? 1 : 0)
