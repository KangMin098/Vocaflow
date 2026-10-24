// docs/csat-learner/lecture-audit-c-20261024/g/db-fix/make-recipes.mjs
// 정정 범위 A(선지 잔여물 3)·B(2014A#29 각주)의 **후보** 수리 기록을 만든다. 저장소 수리 목록(scripts/csat/data/kice-source-repairs.json)에는
// 넣지 않는다 — DB 적용 승인 뒤 그 목록에 합친다. 각 기록의 「수리 후」 해시가 SQL 의 「정정 후」 기대값과 같은지 확인한다.
//   node docs/csat-learner/lecture-audit-c-20261024/g/db-fix/make-recipes.mjs <2014A#29 의 현재 DB 지문 파일>
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { applySourceRepair, repairPdfFolder, sourceDigest } from '../../../../../scripts/csat/lib-source-repair.mjs'

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const md5 = (s) => crypto.createHash('md5').update(s).digest('hex')
// Postgres jsonb::text 와 같은 직렬화(원소 사이 「, 」) — DB 의 md5(choices::text) 와 비교한다
const jsonbText = (a) => '[' + a.map((x) => JSON.stringify(x)).join(', ') + ']'
const corpus = JSON.parse(fs.readFileSync('scripts/csat/data/corpus.json', 'utf8'))
const item = (id) => corpus.items.find((x) => x.id === id)
const dbPassage2014A29 = fs.readFileSync(process.argv[2], 'utf8')
if (md5(dbPassage2014A29) !== '354dba3df716d6db04d6cc643afeec3e') throw new Error('2014A#29 DB 지문이 승인 시점 값과 다르다')

const pdf = (id, file) => {
  const bytes = fs.readFileSync(path.join(repairPdfFolder(id), file))
  return { pdf_file: file, pdf_sha256: sourceDigest(bytes), bytes }
}
const strip = (c, re) => c.map((x, i) => (i === 4 ? x.replace(re, '') : x))

const A = [
  ['2017#24', '2017_영어_짝.pdf', /\s+8$/, '964f24d99fd78f83d0c1665f207fc654'],
  ['2018#24', '2018_영어_짝.pdf', /\s+8$/, 'f380f7ee5dfa8b569414d54a8b5182af'],
  ['M2509#25', '202509_영어영역_문제지.pdf', /\s+\*\s*augmented reality: 증강 현실$/, '764a83418a6b8862f08b594322f33960'],
].map(([id, file, re, want]) => {
  const p = pdf(id, file)
  const before = item(id).choices
  const after = strip(before, re)
  if (md5(jsonbText(after)) !== want) throw new Error(`${id}: 수리 후 선지가 SQL 기대값과 다르다`)
  const repair = { item_id: id, pdf_file: p.pdf_file, pdf_sha256: p.pdf_sha256, before: { choices: before }, after: { choices: after }, note: '선지 ⑤ 끝 추출 잔여물 제거(공식 문제지 대조)' }
  applySourceRepair({ id, ...item(id) }, repair, p.bytes)
  return repair
})

const b = pdf('2014A#29', '2014_영어A-홀수형_문제.pdf')
const afterPassage = dbPassage2014A29.replace('5:00 p.m. month. Fees', '5:00 p.m. * The museum is closed on the first Monday of every month. Fees')
if (md5(afterPassage) !== '6b4dd8818f63a6c9086b06dd8833027a') throw new Error('2014A#29: 수리 후 지문이 SQL 기대값과 다르다')
// 원장(파서 출력) 지문은 DB 와 띄어쓰기가 다르다 — 「파서 입력 → 확인된 지문」으로 기록해 재생성이 DB 정정값을 만들게 한다.
const B = [{ item_id: '2014A#29', pdf_file: b.pdf_file, pdf_sha256: b.pdf_sha256, before: { passage: item('2014A#29').passage }, after: { passage: afterPassage }, note: 'Hours 각주 복원(공식 문제지 6쪽 아래 164~165행 「* The museum is closed on the first Monday of every month.」)' }]
applySourceRepair({ id: '2014A#29', ...item('2014A#29') }, B[0], b.bytes)

fs.writeFileSync(path.join(here, 'recipe-A-choices.json'), JSON.stringify({ repairs: A }, null, 1) + '\n')
fs.writeFileSync(path.join(here, 'recipe-B-2014A29.json'), JSON.stringify({ repairs: B }, null, 1) + '\n')
console.log(JSON.stringify({ A: A.map((r) => r.item_id), B: B.map((r) => r.item_id), after_md5_match: true }))
