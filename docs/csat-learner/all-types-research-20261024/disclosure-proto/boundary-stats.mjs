// 전 강의 정지 경계 집계 — node boundary-stats.mjs
import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveAnswerBoundary } from './adapter.mjs'
const here = path.dirname(fileURLToPath(import.meta.url))
const sha256 = async (s) => 'sha256:' + crypto.createHash('sha256').update(s).digest('hex')
const dir = path.join(here, '..', 'cue-audit', 'sidecar-final')
const out = { lectures: 0, VERIFIED: 0, UNVERIFIED: 0, preStopRisk: {}, stopBefore: {}, moved_earlier_than_rule: 0, unverified_reasons: {}, list: [] }
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.disclosure.json')).sort()) {
  const side = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
  const src = JSON.parse(execFileSync('git', ['-C', 'D:/workspace/Vocaflow', 'show', `main:${side.source.repo_path}`], { encoding: 'utf8', maxBuffer: 1 << 26 }))
  for (const s of side.lectures) {
    const r = await resolveAnswerBoundary(src.lectures[s.lecture_id], s, sha256)
    out.lectures++; out[r.status]++
    if (r.status === 'VERIFIED') { out.preStopRisk[r.preStopRisk] = (out.preStopRisk[r.preStopRisk] ?? 0) + 1; out.stopBefore[r.stopBefore] = (out.stopBefore[r.stopBefore] ?? 0) + 1; if (/먼저 답을/.test(r.reasons[0])) out.moved_earlier_than_rule++ }
    else for (const x of r.reasons) { const k = x.replace(/ [^ ]+$/, ''); out.unverified_reasons[k] = (out.unverified_reasons[k] ?? 0) + 1 }
    out.list.push({ lecture_id: s.lecture_id, status: r.status, stopBefore: r.stopBefore, preStopRisk: r.preStopRisk, reasons: r.reasons })
  }
}
fs.writeFileSync(path.join(here, 'boundary-list.json'), JSON.stringify(out, null, 1))
console.log(JSON.stringify({ ...out, list: undefined }))
