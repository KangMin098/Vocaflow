// scripts/lexicon/p5-watcher.mjs
//
// P5 outputs regression checker
//
// 용도:
//   - P5 enrichment 결과 outputs/ 폴더 정합 검증
//   - chunk count mismatch 자동 감지 (chunk-038 case 같은 LLM 분할 사고)
//   - sub-agent 빈 결과 종료 감지 (이전 chunk 291 환각 사례 방지)
//   - 향후 P6/P7 enrichment 라운드 회귀 검증 도구로 재사용
//
// 실행:
//   node scripts/lexicon/p5-watcher.mjs
//
// 참고:
//   - P5 본 import 도구: scripts/dict-fill/p5-import-to-db.ts (TypeScript 트랙)
//   - P5 sprint는 commit f047d5e (2026-05-20 22:40 KST)에 완료됨
//   - 본 watcher는 그 결과의 archive 검증 + 향후 회귀 도구
//
// Scans data/dict-fill/p5/outputs/ and reports:
//   - which chunks (1-433) are missing or malformed
//   - last/next plan reset time (Asia/Seoul 4:50am daily)
//
// Pure status tool — does not launch anything. Read by user or future
// regression scripts.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHUNKS_DIR = path.resolve(__dirname, '../../data/dict-fill/p5/chunks')
const OUTPUTS_DIR = path.resolve(__dirname, '../../data/dict-fill/p5/outputs')
const TOTAL_CHUNKS = 433
const RESET_HOUR_SEOUL = 4
const RESET_MIN_SEOUL = 50

function pad(n) { return String(n).padStart(3, '0') }

function inspectChunk(n) {
  const inPath = path.join(CHUNKS_DIR, `chunk-${pad(n)}.jsonl`)
  const outPath = path.join(OUTPUTS_DIR, `chunk-${pad(n)}-output.jsonl`)
  if (!fs.existsSync(outPath)) return { n, status: 'missing' }
  const inLines = fs.existsSync(inPath)
    ? fs.readFileSync(inPath, 'utf-8').split('\n').filter((l) => l.trim()).length
    : null
  const outLines = fs.readFileSync(outPath, 'utf-8').split('\n').filter((l) => l.trim()).length
  if (inLines !== null && inLines !== outLines) {
    return { n, status: 'mismatch', in: inLines, out: outLines }
  }
  // Spot-check JSON validity + required fields on first/last line.
  try {
    const lines = fs.readFileSync(outPath, 'utf-8').split('\n').filter((l) => l.trim())
    for (const idx of [0, lines.length - 1]) {
      const obj = JSON.parse(lines[idx])
      if (!obj.word || !obj.pos || !obj.meaning_ko || !obj.ipa) {
        return { n, status: 'invalid', missing_field: !obj.word ? 'word' : !obj.pos ? 'pos' : !obj.meaning_ko ? 'meaning_ko' : 'ipa' }
      }
    }
  } catch (e) {
    return { n, status: 'parse_error', error: String(e.message) }
  }
  return { n, status: 'ok', lines: outLines }
}

function nextResetSeoul() {
  const now = new Date()
  // Seoul = UTC+9
  const seoulNow = new Date(now.getTime() + 9 * 3600 * 1000)
  const reset = new Date(seoulNow)
  reset.setUTCHours(RESET_HOUR_SEOUL, RESET_MIN_SEOUL, 0, 0)
  if (seoulNow >= reset) reset.setUTCDate(reset.getUTCDate() + 1)
  return { resetUtc: new Date(reset.getTime() - 9 * 3600 * 1000), minsUntil: Math.round((reset.getTime() - seoulNow.getTime()) / 60000) }
}

function main() {
  if (!fs.existsSync(OUTPUTS_DIR)) {
    console.error(`MISSING outputs dir: ${OUTPUTS_DIR}`)
    process.exit(1)
  }

  const results = []
  for (let n = 1; n <= TOTAL_CHUNKS; n++) results.push(inspectChunk(n))

  const ok = results.filter((r) => r.status === 'ok')
  const missing = results.filter((r) => r.status === 'missing')
  const mismatch = results.filter((r) => r.status === 'mismatch')
  const invalid = results.filter((r) => r.status === 'invalid')
  const parseErr = results.filter((r) => r.status === 'parse_error')

  console.log('=== P5 enrichment status ===')
  console.log(`OK         : ${ok.length} / ${TOTAL_CHUNKS}  (${(ok.length * 100 / TOTAL_CHUNKS).toFixed(1)}%)`)
  console.log(`Missing    : ${missing.length}`)
  console.log(`Mismatch   : ${mismatch.length}`)
  console.log(`Invalid    : ${invalid.length}`)
  console.log(`ParseError : ${parseErr.length}`)
  console.log()

  if (missing.length > 0) {
    const nums = missing.map((r) => r.n)
    console.log(`Missing chunks (first 20): ${nums.slice(0, 20).join(', ')}${nums.length > 20 ? '…' : ''}`)
    // Next 5 launchable as a wave
    const nextWave = nums.slice(0, 5)
    console.log(`Next wave candidates    : ${nextWave.join(', ')}`)
  }

  if (mismatch.length > 0) {
    console.log('\nMismatch samples (1:1 broken — manual review required):')
    for (const m of mismatch.slice(0, 5)) console.log(`  chunk-${pad(m.n)}: in=${m.in}, out=${m.out}`)
  }
  if (invalid.length > 0) {
    console.log('\nInvalid samples (missing required field):')
    for (const v of invalid.slice(0, 5)) console.log(`  chunk-${pad(v.n)}: missing ${v.missing_field}`)
  }
  if (parseErr.length > 0) {
    console.log('\nParseError samples:')
    for (const p of parseErr.slice(0, 5)) console.log(`  chunk-${pad(p.n)}: ${p.error}`)
  }

  const { resetUtc, minsUntil } = nextResetSeoul()
  console.log()
  console.log(`Next plan reset (Asia/Seoul 04:50): in ~${minsUntil} min   (UTC ${resetUtc.toISOString()})`)

  if (ok.length === TOTAL_CHUNKS) {
    console.log('\n*** P5 100% COMPLETE — outputs archive ready for verification ***')
  } else if (missing.length > 0 || mismatch.length > 0 || invalid.length > 0 || parseErr.length > 0) {
    console.log('\nNot yet complete. Resume waves from next missing chunk.')
  }
}

main()
