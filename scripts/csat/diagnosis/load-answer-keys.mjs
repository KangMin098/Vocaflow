// scripts/csat/diagnosis/load-answer-keys.mjs
//
// **진단 채점용 45문항 정답·배점을 csat_dx_answer_key 에 적재한다.**
//
// 왜 필요한가 — csat_items 에는 18~45번만 있다(듣기 1~17 없음). 학습자가 OMR 로 45문항을 넣으면
// 듣기까지 채점해야 원점수·등급이 나온다. 정답은 이미 검산을 통과한 파일에 있다:
//   · scripts/csat/data/answers.json            — 수능(평가원)
//   · scripts/csat/data/mock-answers.json       — 모의평가(주 파이프라인)
//   · scripts/csat/data/mock-answers-kice.json  — 모의평가(정답표 PDF 기계 해독, 위 파일에 없는 회차만)
//
// 손으로 옮겨 적지 않는다. 회차마다 다시 검산하고, 하나라도 어긋나면 그 회차는 넣지 않는다:
//   ① 1~45 빠짐없음 ② 정답 1~5 · 배점 2|3 ③ 배점 합 100 ④ csat_exams 에 있는 회차
//   ⑤ 18~45 정답이 DB 의 csat_items 정답과 같음(남의 회차 정답표가 붙는 사고를 막는다)
//
// 실행(저장소 루트 — .env.local 의 SUPABASE_SERVICE_ROLE_KEY 를 쓴다):
//   node --tls-max-v1.2 scripts/csat/diagnosis/load-answer-keys.mjs            (미리보기 — 쓰지 않는다)
//   node --tls-max-v1.2 scripts/csat/diagnosis/load-answer-keys.mjs --commit   (upsert)
//
// 재실행 안전: (exam_id, no) 기본키 upsert — 같은 값이면 그대로, 바뀐 값만 덮는다.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const DATA = path.resolve(HERE, '..', 'data')
const COMMIT = process.argv.includes('--commit')
// 회차마다 DB 정답과 최소 이만큼은 대조돼야 받는다(18~45 = 28문항, 폐지 유형으로 한두 개 빠진 회차가 있다)
const MIN_COMPARED = 25

// 앞의 파일이 우선 — 뒤 파일은 앞에서 못 채운 회차만 채운다
const SOURCES = ['answers.json', 'mock-answers.json', 'mock-answers-kice.json']

function env(name) {
  if (process.env[name]) return process.env[name]
  for (const f of ['.env.local', '.env', 'apps/web/.env.local', 'apps/web/.env']) {
    if (!fs.existsSync(f)) continue
    const m = fs.readFileSync(f, 'utf8').match(new RegExp(`^${name}\\s*=\\s*(.+)$`, 'm'))
    if (m) return m[1].trim().replace(/^["']|["']$/g, '')
  }
  return null
}

function rowsOf(json) {
  if (Array.isArray(json)) return json
  if (Array.isArray(json.answers)) return json.answers
  return []
}

/** 파일들을 읽어 회차 → 번호 → {answers, points, source} */
export function collectKeys(dataDir = DATA) {
  const byExam = new Map()
  for (const file of SOURCES) {
    const full = path.join(dataDir, file)
    if (!fs.existsSync(full)) continue
    const fileExams = new Map()
    for (const r of rowsOf(JSON.parse(fs.readFileSync(full, 'utf8')))) {
      if (!r || typeof r !== 'object' || !r.exam || !Number.isInteger(r.no)) continue
      const answers = Array.isArray(r.answers) && r.answers.length ? r.answers : [r.answer]
      if (!fileExams.has(r.exam)) fileExams.set(r.exam, new Map())
      fileExams.get(r.exam).set(r.no, { answers, points: r.points, source: file })
    }
    for (const [exam, rows] of fileExams) if (!byExam.has(exam)) byExam.set(exam, rows)
  }
  return byExam
}

/** 검산 ①~③. 실패 사유 문자열 또는 null */
export function checkKey(rows) {
  for (let no = 1; no <= 45; no++) {
    const r = rows.get(no)
    if (!r) return `${no}번 없음`
    if (!r.answers.every((a) => Number.isInteger(a) && a >= 1 && a <= 5)) return `${no}번 정답 범위`
    if (r.points !== 2 && r.points !== 3) return `${no}번 배점 ${r.points}`
  }
  if (rows.size !== 45) return `문항 수 ${rows.size}`
  const sum = [...rows.values()].reduce((s, r) => s + r.points, 0)
  if (sum !== 100) return `배점 합 ${sum}`
  return null
}

async function main() {
  const { createClient } = await import('@supabase/supabase-js')
  const url = env('NEXT_PUBLIC_SUPABASE_URL') ?? env('SUPABASE_URL')
  const key = env('SUPABASE_SERVICE_ROLE_KEY') ?? env('SUPABASE_SERVICE_KEY')
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요하다(저장소 루트에서 실행)')
  const db = createClient(url, key, { auth: { persistSession: false } })

  const { data: exams, error: e1 } = await db.from('csat_exams').select('id')
  if (e1) throw e1
  const known = new Set(exams.map((x) => x.id))

  const keys = collectKeys()
  const accepted = []
  let compared = 0
  const rejected = []
  for (const [exam, rows] of [...keys].sort(([a], [b]) => a.localeCompare(b))) {
    if (!known.has(exam)) { rejected.push([exam, 'csat_exams 에 없음']); continue }
    const why = checkKey(rows)
    if (why) { rejected.push([exam, why]); continue }
    // 회차별로 읽는다(행 상한에 잘리지 않게). DB 에 있는 18~45 문항은 전부 대조하고, 정답이 빈 문항이 있으면 거부
    const { data: items, error: e2 } = await db.from('csat_items').select('no, answer, answers').eq('exam_id', exam).gte('no', 18)
    if (e2) throw e2
    let mismatch = items.length < MIN_COMPARED ? `DB 대조 문항 ${items.length}개(최소 ${MIN_COMPARED})` : null
    for (const i of items) {
      if (mismatch) break
      const d = (i.answers?.length ? i.answers : [i.answer]).filter((a) => a !== null)
      const f = rows.get(i.no)?.answers ?? []
      if (d.length === 0) mismatch = `${i.no}번 DB 정답 없음`
      else if (d.length !== f.length || !d.every((a) => f.includes(a))) mismatch = `${i.no}번 DB ${d} ≠ 파일 ${f}`
    }
    if (mismatch) { rejected.push([exam, mismatch]); continue }
    compared += items.length
    accepted.push([exam, rows])
  }

  console.log(`받음 ${accepted.length}회 · 거부 ${rejected.length}회 · DB 대조 ${compared}문항`)
  for (const [exam, why] of rejected) console.log(`  거부 ${exam}: ${why}`)
  console.log(`  받음: ${accepted.map(([e]) => e).join(' ')}`)

  if (!COMMIT) {
    console.log('\n미리보기 — 쓰지 않았다. 적재는 --commit')
    return
  }
  // 회차 하나 = 요청 하나(PostgREST 요청은 한 트랜잭션) — 45문항이 반쯤만 바뀌는 일이 없다
  let written = 0
  for (const [exam, rows] of accepted) {
    const payload = [...rows].map(([no, r]) => ({ exam_id: exam, no, answers: r.answers, points: r.points, source: r.source }))
    const { error } = await db.from('csat_dx_answer_key').upsert(payload, { onConflict: 'exam_id,no' })
    if (error) throw new Error(`${exam} 적재 실패(이 회차는 바뀌지 않았다 · 앞 회차는 완료 · 재실행 안전): ${error.message}`)
    written += payload.length
  }
  const { count, error: e3 } = await db.from('csat_dx_answer_key').select('*', { count: 'exact', head: true })
  if (e3) throw e3
  console.log(`\n적재 ${written}행 · 표 전체 ${count}행`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
