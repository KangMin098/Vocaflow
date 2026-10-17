// scripts/csat/review-audit/d2-v12-strip.mjs
//
// **D2 V12 교정(로컬 파일만).** 씨앗(.out.seed.json)의 학습자 칸에서 «원문 추출·수리 사정» 문장만 뺀다.
// 출제 설계 문장은 한 글자도 바꾸지 않는다 — 문장 단위로 지우고, 지운 문장과 남은 글을 모두 출력해 눈으로 확인한다.
// 지울 문장 = WORK_JARGON(V12 와 같은 정규식) 또는 원문 처리 메타(body_ok · body_recovered · 원문 블록 · 파서) 를 담은 문장.
// 사용: node scripts/csat/review-audit/d2-v12-strip.mjs <chunk 이름> <analyst_run>
import fs from 'node:fs'
import path from 'node:path'
import { WORK_JARGON, learnerTexts } from '../lib-analysis-rules.mjs'

const [name, run] = process.argv.slice(2)
if (!name || !run || run.length < 8) throw new Error('usage: <chunk 이름> <analyst_run ≥8자>')
const WORK = path.resolve('scripts/csat/analysis-drain-hakpyeong')
const seedFile = path.join(WORK, `chunk-${name}.out.seed.json`), outFile = path.join(WORK, `chunk-${name}.out.json`)
if (fs.existsSync(outFile)) throw new Error('out 이 이미 있다 — 덮지 않는다')
const seed = JSON.parse(fs.readFileSync(seedFile, 'utf8'))
const META = /body_ok|body_recovered|원문 블록|파서|원문 데이터 사정|원문 결함/
const bad = (s) => WORK_JARGON.test(s) || META.test(s)
// 문장 경계: 마침표 뒤 공백(따옴표 안 마침표는 드물다 — 결과를 눈으로 본다)
const split = (t) => t.split(/(?<=\.)\s+/)
const FIELDS = [['measured_ability'], ['design_intent'], ['answer_locus', 'reasoning']]
const CH = ['why_correct', 'why_tempting', 'how_to_reject', 'trap']
let changed = 0
for (const a of seed.analyses) {
  const strip = (t, where) => {
    if (typeof t !== 'string' || !bad(t)) return t
    const parts = split(t), keep = parts.filter((s) => !bad(s)), drop = parts.filter(bad)
    console.log(`\n■ ${a.item_id} ${where}\n  - 뺀 문장: ${drop.join(' ⏎ ')}\n  + 남은 끝: …${keep.join(' ').slice(-140)}`)
    changed++
    return keep.join(' ')
  }
  for (const f of FIELDS) {
    if (f.length === 1) a[f[0]] = strip(a[f[0]], f[0])
    else if (a[f[0]]) a[f[0]][f[1]] = strip(a[f[0]][f[1]], f.join('.'))
  }
  ;(a.choices ?? []).forEach((c, i) => { for (const k of CH) c[k] = strip(c[k], `choices[${i}].${k}`) })
  const left = learnerTexts(a).filter((t) => WORK_JARGON.test(t))
  if (left.length) throw new Error(`${a.item_id}: 작업 용어가 남았다`)
  a.analyst_run = run
  for (const k of ['base_analysis_id', 'base_version', 'base_status', 'precheck_errors_before']) delete a[k]
}
seed.analyst_run = run
seed.provenance_note = `V12 교정 — 학습자 칸의 원문 추출·수리 사정 문장만 삭제, 출제 설계 서술은 그대로(${name})`
fs.writeFileSync(outFile, JSON.stringify(seed, null, 1))
console.log(`\n수정 칸 ${changed} · 저장 ${path.basename(outFile)}`)
