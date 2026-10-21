// scripts/design/lib/capture-report.mjs
import fs from 'node:fs'
import path from 'node:path'
import {randomUUID} from 'node:crypto'

/** 실패 재실행은 이전 성공 보고서를 덮지 않는다. 최신 시도와 실행별 원본도 함께 보존한다. */
export function saveCaptureReport(outDir, report, expectedRenders) {
  fs.mkdirSync(outDir, {recursive: true})
  const json = JSON.stringify(report, null, 2)
  fs.writeFileSync(path.join(outDir, `_run-${randomUUID()}.json`), json)
  fs.writeFileSync(path.join(outDir, '_report.json'), json)
  const rows = Array.isArray(report) ? report : report.renders ?? []
  const complete = expectedRenders > 0 && rows.length === expectedRenders && rows.every(row => row.ok === true && !row.error && !row.errorLike && !row.loadingLike && row.normalContent !== false)
    && (report.checks ?? []).every(check => check.ok === true)
  if (complete) fs.writeFileSync(path.join(outDir, '_last-success.json'), json)
  return complete
}
