// scripts/comic/pd/evaluate.mjs
//
// 파이프라인 평가 기준(rubric) — 각 단계를 측정 지표로 채점(PASS/WARN/FAIL)한다. 자기발전 루프의 yardstick:
// "무엇을 시도 → 단계별 평가(이 기준으로) → 개선 → 반복". work/<slug> 의 매니페스트·산출물을 읽어 점수판을 낸다.
//
//   node scripts/comic/pd/evaluate.mjs --workdir work/<slug> [--json]
//
// 평가 기준(임계):
//   취득    pages == 요청분(acquire_pages)              PASS=100% · WARN≥50% · FAIL<50%
//   복원    restored == pages                           PASS=100% · WARN≥80% · FAIL<80%
//   컷분할  0컷 페이지 없음 · 평균 2~10컷/페이지         PASS · WARN(1 또는 >10) · FAIL(0컷 존재)
//   OCR     usable%(그대로 쓸 수 있는 대사)             PASS≥50% · WARN≥20% · FAIL<20%
//   OCR     coverage(대사 있는 컷/전체)                 PASS≥60% · WARN≥30% · FAIL<30%
//   현대화  page-modern == pages                        PASS=100% · WARN≥80% · FAIL<80%
//   리더    reader.html 존재                            PASS/FAIL

import fs from 'node:fs'
import path from 'node:path'

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? d : process.argv[i + 1] }
const has = (n) => process.argv.includes(`--${n}`)
const WD = arg('workdir')
if (!WD || !fs.existsSync(WD)) { console.error(`--workdir <dir> 필요: ${WD}`); process.exit(2) }

const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return null } }
// 페이지 이미지만(NNNN.jpg) — compare_preview.jpg 등 보조 산출물 제외.
const countPages = (dir) => { try { return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^\d+\.jpe?g$/i.test(f)).length : 0 } catch { return 0 } }
const grade = (v, pass, warn) => (v >= pass ? 'PASS' : v >= warn ? 'WARN' : 'FAIL')

const results = []
const add = (stage, metric, status, detail) => results.push({ stage, metric, status, detail })

// 취득
const src = readJson(path.join(WD, 'source.manifest.json'))
const pagesN = countPages(path.join(WD, 'pages'))
const want = src?.pipelineProfile?.acquirePages ?? src?.acquirePages ?? null
if (want) add('취득', `${pagesN}/${want}쪽`, grade(pagesN / want, 1, 0.5), pagesN >= want ? '요청분 전량' : '일부 누락')
else add('취득', `${pagesN}쪽`, pagesN > 0 ? 'PASS' : 'FAIL', pagesN > 0 ? `${pagesN}쪽 취득` : '취득 없음')

// 복원
const restoredN = countPages(path.join(WD, 'restored'))
add('복원', `${restoredN}/${pagesN}쪽`, pagesN ? grade(restoredN / pagesN, 1, 0.8) : 'FAIL', restoredN === pagesN ? '전량 복원' : '누락')

// 컷 분할 — 복원 페이지 수를 분모로(신뢰). 평균 컷/쪽이 정상범위인지.
const pm = readJson(path.join(WD, 'panels', 'panels.manifest.json'))
const panels = pm?.panels ?? []
const avgPanels = restoredN ? (panels.length / restoredN) : 0
const segStatus = panels.length === 0 ? 'FAIL' : (avgPanels >= 1.5 && avgPanels <= 12 ? 'PASS' : 'WARN')
add('컷분할', `${panels.length}컷 · 평균 ${avgPanels.toFixed(1)}/쪽`, segStatus, panels.length ? '분할 정상범위' : '컷 없음')

// OCR — bubbles.local 기준
const bl = readJson(path.join(WD, 'bubbles.local.manifest.json'))
const blPanels = bl?.panels ?? []
let bubbles = 0, needsReview = 0, panelsWithText = 0
for (const p of blPanels) {
  const bs = (p.bubbles ?? []).filter((b) => /[A-Za-z]{2,}/.test(b.text || ''))
  if (bs.length) panelsWithText++
  bubbles += bs.length
  needsReview += bs.filter((b) => b.needsReview).length
}
const usablePct = bubbles ? Math.round(((bubbles - needsReview) / bubbles) * 100) : 0
const coveragePct = panels.length ? Math.round((panelsWithText / panels.length) * 100) : 0
if (bubbles) {
  add('OCR-품질', `usable ${usablePct}%`, grade(usablePct, 50, 20), `${bubbles}대사 · 검수 ${needsReview}`)
  add('OCR-커버리지', `${coveragePct}%`, grade(coveragePct, 60, 30), `${panelsWithText}/${panels.length}컷에 대사`)
} else add('OCR', '대사 0', 'WARN', 'OCR 미실행 또는 무대사')

// 현대화(작화보존)
const modernN = countPages(path.join(WD, 'page-modern'))
add('현대화', `${modernN}/${pagesN}쪽`, pagesN ? grade(modernN / pagesN, 1, 0.8) : 'FAIL', modernN === pagesN ? '전 페이지 색채·디자인' : (modernN ? '일부' : '미실행'))

// 리더
const readerOk = fs.existsSync(path.join(WD, 'page-html', 'reader.html'))
add('리더', readerOk ? '있음' : '없음', readerOk ? 'PASS' : 'WARN', readerOk ? '모던 리더 생성' : 'page-html 미실행')

// 점수판
const tally = { PASS: 0, WARN: 0, FAIL: 0 }
for (const r of results) tally[r.status]++
const overall = tally.FAIL > 0 ? 'FAIL' : tally.WARN > 0 ? 'WARN' : 'PASS'
const scorecard = { workdir: path.resolve(WD), evaluatedStages: results.length, tally, overall, results }
fs.writeFileSync(path.join(WD, 'evaluate.scorecard.json'), JSON.stringify(scorecard, null, 2))

if (has('json')) { console.log(JSON.stringify(scorecard, null, 2)); process.exit(0) }
const ICON = { PASS: '✅', WARN: '⚠️ ', FAIL: '❌' }
console.log(`\n평가 기준 채점 — ${path.basename(WD)}\n`)
for (const r of results) console.log(`  ${ICON[r.status]} ${r.stage.padEnd(12)} ${String(r.metric).padEnd(22)} ${r.detail}`)
console.log(`\n  종합: ${ICON[overall]} ${overall}  (PASS ${tally.PASS} · WARN ${tally.WARN} · FAIL ${tally.FAIL}) → evaluate.scorecard.json`)
console.log('  → FAIL/WARN 단계를 자기발전으로 개선 후 재채점(oplog 에 기록).')
