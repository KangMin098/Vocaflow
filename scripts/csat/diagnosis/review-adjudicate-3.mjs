// scripts/csat/diagnosis/review-adjudicate-3.mjs
//
// 진단 태깅 3자 조정(2026-10-11 · 6차) — 두 판정자(A · B)가 갈린 문항을 제3 맹검 판정자(C)가 따로 본 뒤 합친다. **DB 에 쓰지 않는다.**
//   규칙 final-v1.3: 셀마다 세 값의 중앙값(태그는 세 명 중 둘 이상이 1 이상일 때만 — 이중 판정 「둘 다 1 이상」 규칙의 3인 확장)
//     A · B 가 같은 셀(이견 없는 문항 포함)은 그 값 그대로 · C 는 이견 문항만 판정했다
//   품질: 「합의 셀」 = 세 명 중 둘 이상이 정확히 같은 값. 합의율 ≥ 0.85 일 때만 status=adjudicated-3(관리자 경로 반영 가능)
//     세 값이 모두 다른 셀(0 · 1 · 2)은 unsettled 로 남겨 보고한다(중앙값 1 이 들어가지만 근거가 약하다)
//   입력: scripts/csat/diagnosis/pilot/<exam>-review-final.json(A · B · 시드) · tmp/review/<exam>-review-C.json
//   출력: 같은 final 파일을 3자 판정으로 갱신(A · B · C · 근거 기록 보존)
//   node scripts/csat/diagnosis/review-adjudicate-3.mjs M2606
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../../..')
const exam = process.argv[2]
if (!exam) throw new Error('시험 id 가 필요하다')
const finalPath = path.join(ROOT, `scripts/csat/diagnosis/pilot/${exam}-review-final.json`)
const final = JSON.parse(fs.readFileSync(finalPath, 'utf8'))
const C = JSON.parse(fs.readFileSync(path.join(ROOT, `tmp/review/${exam}-review-C.json`), 'utf8'))
const byNo = new Map(C.items.map((it) => [Number(it.no), it]))
const CODES = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9']
const median = (xs) => [...xs].sort((a, b) => a - b)[1]
let cells = 0, settled = 0
const unsettled = []
for (const it of final.items) {
  const c = byNo.get(Number(it.no))
  const w = {}
  for (const code of CODES) {
    const a = it.claudeA[code], b = it.claudeB[code]
    cells++
    if (a === b) { w[code] = a; settled++; continue }
    if (!c) throw new Error(`${it.no} ${code}: A·B 가 갈렸는데 제3 판정이 없다`)
    const v = c.w[code]
    w[code] = median([a, b, v])
    if (v === a || v === b) settled++
    else unsettled.push(`${it.no} ${code} A${a}·B${b}·C${v}`)
  }
  it.w = w
  if (c) it.claudeC = c.w
}
const rate = Math.round((settled / cells) * 1000) / 1000
const pass = rate >= 0.85
final.version = 'final-v1.3'
final.rule = '셀마다 A · B · C 중앙값(태그는 둘 이상이 1 이상일 때만) · A=B 셀은 그대로 · C 는 이견 문항만 맹검 판정'
final.reviewers = { ...(typeof final.reviewers === 'object' ? final.reviewers : { note: final.reviewers }), C: 'claude-code 서브에이전트(맹검 · A·B·시드 미열람 · 이견 23문항 · 역량 정의표 · 강화 검증기 통과 · 표본 3문항 원문 대조) — 2026-10-11' }
final.agreement3 = { cells, settledCells: settled, rate, unsettled }
final.status = pass
  ? `adjudicated-3 — 3자 합의율 ${rate} ≥ 0.85 · 관리자 정상 경로 반영 가능`
  : `hold — 3자 합의율 ${rate} < 0.85 · 반영 안 함`
fs.writeFileSync(finalPath, JSON.stringify(final, null, 2) + '\n')
const seedSame = final.items.filter((it) => CODES.every((c) => it.w[c] === it.seedV2[c])).length
console.log(JSON.stringify({ exam, cells, settled, rate, pass, unsettled: unsettled.length, sameAsSeed: seedSame }))
if (unsettled.length) console.log('unsettled:', unsettled.join(' | '))
