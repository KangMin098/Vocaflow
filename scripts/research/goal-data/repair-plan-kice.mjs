// scripts/research/goal-data/repair-plan-kice.mjs
//
// 평가원 원문 결손 5건의 수리 계획(scripts/csat/source-repair.mjs --file 형식)을 만든다 — DB 는 읽기만, 쓰지 않는다.
//   - #41 4건(2014A · 2014B · 2016 · M1809): 장문 제목 문항 지문에서 빈칸 표시만 빠짐 → 같은 세트 #42 지문의 빈칸을 같은 자리에 넣는다
//   - M1809#26: 각주 「* No cash donations will be accepted.」 줄 소실 → 그 줄만 넣는다
// 고친 뒤 지문에서 넣은 문자열을 빼면 고치기 전 지문과 바이트가 같아야 한다(다른 글자를 건드리지 않았다는 검사).
//   node --env-file=<web .env.local> scripts/research/goal-data/repair-plan-kice.mjs <out.json>
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const out = process.argv[2]
if (!out) throw new Error('repair-plan-kice <out.json>')
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_ || !KEY) throw new Error('DB 접속 정보 없음')
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex')

const ids = ['2014A#41', '2014A#42', '2014B#41', '2014B#42', '2016#41', '2016#42', 'M1809#41', 'M1809#42', 'M1809#26']
const list = ids.map((i) => `"${i}"`).join(',')
const res = await fetch(`${URL_}/rest/v1/csat_items?select=id,passage&id=in.(${encodeURIComponent(list)})`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } })
if (!res.ok) throw new Error(`csat_items ${res.status}`)
const byId = new Map((await res.json()).map((r) => [r.id, r.passage]))

const SUNEUNG = process.env.CSAT_KICE_SUNEUNG_DIR ?? 'C:/Users/Administrator/Documents/영어/수능영어기출/수능기출'
const MOCK = process.env.CSAT_KICE_MOCK_DIR ?? 'C:/Users/Administrator/Documents/영어/모의평가'
const PDF = { '2014A': [SUNEUNG, '2014_영어A-홀수형_문제.pdf'], '2014B': [SUNEUNG, '2014_영어B-홀수형_문제.pdf'], '2016': [SUNEUNG, '2016_영어영역-홀수.pdf'], 'M1809': [MOCK, '201809_영어영역_문제지.pdf'] }
const pdfOf = (id) => { const [dir, file] = PDF[id.split('#')[0]]; return { pdf_file: file, pdf_sha256: sha(fs.readFileSync(path.join(dir, file))) } }

const repairs = []
// #41: #42 의 빈칸(밑줄 2개 이상)을 앞뒤 문맥으로 찾아 #41 의 같은 자리에 넣는다
for (const exam of ['2014A', '2014B', '2016', 'M1809']) {
  const id = `${exam}#41`, before = byId.get(id), sib = byId.get(`${exam}#42`)
  const m = /\s*_{2,}\s*/.exec(sib)
  if (!m) throw new Error(`${exam}#42 빈칸 없음`)
  const left = sib.slice(Math.max(0, m.index - 40), m.index).trimEnd(), right = sib.slice(m.index + m[0].length, m.index + m[0].length + 40).trimStart()
  const at = before.indexOf(`${left} ${right}`)
  if (at < 0 || before.indexOf(`${left} ${right}`, at + 1) >= 0) throw new Error(`${id}: 빈칸 자리를 하나로 찾지 못함`)
  const blank = sib.slice(m.index, m.index + m[0].length).trim()
  const after = `${before.slice(0, at + left.length)} ${blank} ${before.slice(at + left.length + 1)}`
  if (after.replace(` ${blank}`, '') !== before) throw new Error(`${id}: 빈칸 말고 다른 글자가 바뀜`)
  repairs.push({ item_id: id, ...pdfOf(id), before: { passage: before }, after: { passage: after }, note: `장문 제목 문항 빈칸 표시 소실 — 같은 세트 ${exam}#42 지문 · 공식 문제지 대조(goal-data b21 source_gap_suspected)` })
}
{
  const id = 'M1809#26', before = byId.get(id), anchor = 'small electronics How to donate', ins = ' * No cash donations will be accepted.'
  if (before.split(anchor).length !== 2) throw new Error(`${id}: 앵커가 하나가 아님`)
  const after = before.replace(anchor, `small electronics${ins} How to donate`)
  if (after.replace(ins, '') !== before) throw new Error(`${id}: 각주 말고 다른 글자가 바뀜`)
  repairs.push({ item_id: id, ...pdfOf(id), before: { passage: before }, after: { passage: after }, note: '각주 줄 소실(정답 ③ 근거) — 추출 텍스트 columns2/M1809.txt:299 · 공식 문제지 대조(goal-data T-0132)' })
}
fs.writeFileSync(out, JSON.stringify({ repairs }, null, 1) + '\n')
console.log(JSON.stringify(repairs.map((r) => ({ id: r.item_id, pdf: r.pdf_file, before_md5: crypto.createHash('md5').update(r.before.passage).digest('hex'), after_len: r.after.passage.length - r.before.passage.length }))))
