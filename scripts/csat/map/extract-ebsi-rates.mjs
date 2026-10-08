// scripts/csat/map/extract-ebsi-rates.mjs
//
// EBSi 오답률 TOP15 원장(Codex 산출물: ebsi-wrong-rate-top15.json) → source/item-rates-ebsi.json (csat_map_item_rate 적재용).
// 계약(원장 semantics): EBSi 응답자 집계 · 평가원 공식 오답률 아님 · 시험별 TOP15 만 제공(나머지는 미관측 — 0 · 평균 아님) ·
// 선택지 비율 합 미달분(unreportedChoiceRate)은 재정규화하지 않고 보존.
//
//   node scripts/csat/map/extract-ebsi-rates.mjs <원장.json>
//
// 대상: 평가원 모의평가 · 수능(홀수형)만 — 학평은 지도의 기준 시험이 아니다.
// 회차 id: 원장 canonicalExamId 가 DB csat_exams.id 와 그대로 같은 것만. 예외 한 건(ID_FIX)은 같은 시험의 표기 차이다.
// DB 에 없는 회차는 seed.mjs 가 적재 때 건너뛰고 수를 출력한다(외래키 위반으로 시드 전체가 롤백되지 않게).

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'source', 'item-rates-ebsi.json')

/** 원장 id → DB id. M2308 = 2023학년도 9월 모평(2022-08-31 시행 — 원장은 시행 월 8, DB 는 학년도 9월 모평 표기. 등급컷 코드 2023N09 로 같은 시험) */
const ID_FIX = { M2308: 'M2309' }

const src = process.argv[2]
if (!src) {
  console.error('사용: node scripts/csat/map/extract-ebsi-rates.mjs <ebsi-wrong-rate-top15.json>')
  process.exit(1)
}
const led = JSON.parse(fs.readFileSync(src, 'utf8'))
const retrievedAt = String(led.retrievedAt).slice(0, 10)

const rows = []
const skipped = { notKice: 0, even: 0, noRows: 0, noId: 0, invalid: 0 }
const idMap = {}
for (const e of led.exams) {
  if (!['kice_mock', 'suneung'].includes(e.series)) { skipped.notKice++; continue }
  if (e.evenForm) { skipped.even++; continue }
  if (!(e.rows ?? []).length) { skipped.noRows++; continue }
  const canonical = e.canonicalExamId
  if (!canonical) { skipped.noId++; continue }
  const examId = ID_FIX[canonical] ?? canonical
  if (examId !== canonical) idMap[canonical] = examId
  for (const r of e.rows) {
    const ok = Number.isInteger(r.no) && r.no >= 1 && r.no <= 45 && typeof r.wrongRate === 'number' && r.wrongRate >= 0 && r.wrongRate <= 1 && Number.isInteger(r.rank) && r.rank >= 1 && r.rank <= 45
    if (!ok) { skipped.invalid++; continue }
    rows.push({
      exam: examId,
      no: r.no,
      rate: r.wrongRate,
      rank: r.rank,
      unreported: typeof r.unreportedChoiceRate === 'number' && r.unreportedChoiceRate >= 0 && r.unreportedChoiceRate <= 1 ? r.unreportedChoiceRate : null,
      source: 'ebsi-error-rate',
      metric: 'wrong_rate_top15',
      retrieved_at: retrievedAt,
    })
  }
}

const exams = [...new Set(rows.map((r) => r.exam))]
const out = {
  note: 'EBSi 응답자 집계(평가원 공식 아님) · 시험별 오답률 상위 15문항만 — 나머지는 미관측. 원장: Codex feat/ebsi-wrong-rate 055933d0',
  retrievedAt,
  idFix: idMap,
  exams: exams.length,
  rows,
}
fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(out) + '\n')
console.log(`시험 ${exams.length}회 · 행 ${rows.length} (회차당 최대 15) · 수집일 ${retrievedAt}`)
console.log('id 변환:', JSON.stringify(idMap))
console.log('건너뜀:', JSON.stringify(skipped))
