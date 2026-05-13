// scripts/vcb/05c-validate-output.mjs
// VCB Step 5c — /vcb-enrich 출력 JSONL 외부 검증.
// 슬래시 명령 /vcb-enrich 종료 시 자동 호출.
// 결과: <input>.validation.json 생성.
//
// 순수 Node.js (npm install 불필요).
//
// 사용:
//   node scripts/vcb/05c-validate-output.mjs <path-to-enriched.jsonl>
//
// CLAUDE.md §19.5 정합. R1/R2/R7 사전 검사 일부 포함 (Step 6 QA Gate 보완).

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const VALID_POS = new Set(['NOUN', 'VERB', 'ADJ', 'ADV', 'PREP', 'CONJ', 'PRON', 'DET', 'INTJ'])
const VALID_CEFR = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2', null])
const VALID_REGISTER = new Set(['formal', 'neutral', 'informal'])

// R7 금칙어 (간이) — 본격 검사는 06-qa.ts.
// P3 (§19 미정 항목 #3 해소): scripts/vcb/data/profanity-denylist.json 외부 로딩.
function loadProfanityDenylist() {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url))
    const filePath = path.join(here, 'data', 'profanity-denylist.json')
    if (!fs.existsSync(filePath)) return []
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    const all = []
    if (Array.isArray(parsed.english)) all.push(...parsed.english)
    if (Array.isArray(parsed.korean)) all.push(...parsed.korean)
    return all
  } catch {
    return []
  }
}
const PROFANITY_DENYLIST = loadProfanityDenylist()

function readFileSafe(p) {
  if (!fs.existsSync(p)) {
    console.log(JSON.stringify({ ok: false, error: 'file not found', path: p }, null, 2))
    process.exit(1)
  }
  const buf = fs.readFileSync(p)
  return { buf, text: buf.toString('utf8') }
}

function checkEncoding(buf, text) {
  const hasBom = buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf
  const hasCrlf = text.includes('\r\n')
  return { hasBom, hasCrlf }
}

function validateEnrichedItem(obj, lineNumber, knownQueueIds, seenQueueIds) {
  const errors = []

  // skip item: queue_id, lemma, pos, error, skip:true 만 검사
  if (obj.skip === true) {
    if (typeof obj.queue_id !== 'number') {
      errors.push({ line: lineNumber, code: 'BAD_QUEUE_ID', message: 'queue_id must be number' })
    } else if (knownQueueIds.size > 0 && !knownQueueIds.has(obj.queue_id)) {
      errors.push({
        line: lineNumber,
        code: 'ORPHAN_QUEUE_ID',
        message: `queue_id ${obj.queue_id} not in input`,
      })
    } else if (seenQueueIds.has(obj.queue_id)) {
      errors.push({
        line: lineNumber,
        code: 'DUPLICATE_QUEUE_ID',
        message: `queue_id ${obj.queue_id} appears twice`,
      })
    } else {
      seenQueueIds.add(obj.queue_id)
    }
    if (typeof obj.error !== 'string' || obj.error.length === 0) {
      errors.push({
        line: lineNumber,
        code: 'BAD_SKIP_ERROR',
        message: 'skip item must have non-empty error',
      })
    }
    return { errors, isSkip: true, item: obj }
  }

  // queue_id
  if (typeof obj.queue_id !== 'number') {
    errors.push({ line: lineNumber, code: 'BAD_QUEUE_ID', message: 'queue_id must be number' })
  } else if (knownQueueIds.size > 0 && !knownQueueIds.has(obj.queue_id)) {
    errors.push({
      line: lineNumber,
      code: 'ORPHAN_QUEUE_ID',
      message: `queue_id ${obj.queue_id} not in input`,
    })
  } else if (seenQueueIds.has(obj.queue_id)) {
    errors.push({
      line: lineNumber,
      code: 'DUPLICATE_QUEUE_ID',
      message: `queue_id ${obj.queue_id} appears twice`,
    })
  } else {
    seenQueueIds.add(obj.queue_id)
  }

  // lemma
  if (typeof obj.lemma !== 'string' || obj.lemma.length === 0) {
    errors.push({ line: lineNumber, code: 'BAD_LEMMA', message: 'lemma must be non-empty string' })
  }

  // pos
  if (!VALID_POS.has(obj.pos)) {
    errors.push({ line: lineNumber, code: 'BAD_POS', message: `invalid pos: ${obj.pos}` })
  }

  // ipa
  if (obj.ipa !== null && typeof obj.ipa !== 'string') {
    errors.push({ line: lineNumber, code: 'BAD_IPA', message: 'ipa must be string or null' })
  }

  // cefr
  if (!VALID_CEFR.has(obj.cefr)) {
    errors.push({ line: lineNumber, code: 'BAD_CEFR', message: `invalid cefr: ${obj.cefr}` })
  }

  // definitions_ko (R2 사전 검사 — 최소 1개)
  if (!Array.isArray(obj.definitions_ko) || obj.definitions_ko.length === 0) {
    errors.push({
      line: lineNumber,
      code: 'R2_NO_DEF_KO',
      message: 'definitions_ko must have ≥1 entry',
    })
  } else if (obj.definitions_ko.length > 3) {
    errors.push({
      line: lineNumber,
      code: 'TOO_MANY_DEF_KO',
      message: `definitions_ko has ${obj.definitions_ko.length} (max 3)`,
    })
  } else {
    obj.definitions_ko.forEach((d, i) => {
      if (typeof d?.sense !== 'string' || d.sense.length === 0) {
        errors.push({
          line: lineNumber,
          code: 'BAD_DEF_KO_SENSE',
          message: `definitions_ko[${i}].sense invalid`,
        })
      }
      if (!VALID_REGISTER.has(d?.register)) {
        errors.push({
          line: lineNumber,
          code: 'BAD_REGISTER',
          message: `definitions_ko[${i}].register invalid: ${d?.register}`,
        })
      }
    })
  }

  // definitions_en
  if (!Array.isArray(obj.definitions_en)) {
    errors.push({ line: lineNumber, code: 'BAD_DEF_EN', message: 'definitions_en must be array' })
  }

  // examples (정확히 2개)
  if (!Array.isArray(obj.examples)) {
    errors.push({ line: lineNumber, code: 'BAD_EXAMPLES', message: 'examples must be array' })
  } else if (obj.examples.length !== 2) {
    errors.push({
      line: lineNumber,
      code: 'BAD_EXAMPLES_COUNT',
      message: `examples count = ${obj.examples.length} (expected 2)`,
    })
  } else {
    obj.examples.forEach((ex, i) => {
      if (typeof ex?.en !== 'string' || ex.en.length === 0) {
        errors.push({
          line: lineNumber,
          code: 'BAD_EXAMPLE_EN',
          message: `examples[${i}].en invalid`,
        })
      }
      if (typeof ex?.ko !== 'string' || ex.ko.length === 0) {
        errors.push({
          line: lineNumber,
          code: 'BAD_EXAMPLE_KO',
          message: `examples[${i}].ko invalid`,
        })
      }
    })
  }

  // synonyms / antonyms — 자기 자신 포함 검사 (R8 보조)
  if (Array.isArray(obj.synonyms) && obj.synonyms.includes(obj.lemma)) {
    errors.push({
      line: lineNumber,
      code: 'R8_SYN_SELF',
      message: 'synonyms contains lemma itself',
    })
  }
  if (Array.isArray(obj.antonyms) && obj.antonyms.includes(obj.lemma)) {
    errors.push({
      line: lineNumber,
      code: 'R8_ANT_SELF',
      message: 'antonyms contains lemma itself',
    })
  }

  // confidence
  if (typeof obj.confidence !== 'number' || obj.confidence < 0 || obj.confidence > 1) {
    errors.push({
      line: lineNumber,
      code: 'BAD_CONFIDENCE',
      message: `confidence out of [0,1]: ${obj.confidence}`,
    })
  }

  // R7 금칙어 (예문 + 정의에 한해 간이 검사)
  const textsToCheck = [
    ...(Array.isArray(obj.examples) ? obj.examples.flatMap((e) => [e?.en, e?.ko]) : []),
    ...(Array.isArray(obj.definitions_en) ? obj.definitions_en.map((d) => d?.sense) : []),
  ].filter((t) => typeof t === 'string')

  for (const text of textsToCheck) {
    const lower = text.toLowerCase()
    for (const bad of PROFANITY_DENYLIST) {
      if (lower.includes(bad)) {
        errors.push({
          line: lineNumber,
          code: 'R7_PROFANITY',
          message: `profanity detected: ${bad}`,
        })
        break
      }
    }
  }

  return { errors, isSkip: false, item: obj }
}

function loadKnownQueueIds(enrichedPath) {
  // 같은 디렉토리의 *-pending*.jsonl 파일에서 queue_id 추출
  const dir = path.dirname(enrichedPath)
  const enrichedBase = path.basename(enrichedPath)
  // <ts>-<slug>-enriched.jsonl 또는 -enriched-NNofMM.jsonl
  // 매칭 페어: enriched 부분을 pending 으로 치환
  const pendingBase = enrichedBase.replace(/-enriched(-\d+of\d+)?\.jsonl$/, (match, suffix) => {
    return `-pending${suffix ?? ''}.jsonl`
  })

  if (pendingBase === enrichedBase) {
    // 매칭 안되면 빈 set 반환 (orphan 검사 비활성)
    return new Set()
  }

  const pendingPath = path.join(dir, pendingBase)
  if (!fs.existsSync(pendingPath)) {
    return new Set()
  }

  const text = fs.readFileSync(pendingPath, 'utf8')
  const ids = new Set()
  for (const line of text.split('\n')) {
    if (line.trim().length === 0) continue
    try {
      const obj = JSON.parse(line)
      if (typeof obj.queue_id === 'number') ids.add(obj.queue_id)
    } catch {
      // ignore
    }
  }
  return ids
}

function main() {
  const arg = process.argv[2]
  if (!arg) {
    console.log(
      JSON.stringify({ ok: false, error: 'usage: node 05c-validate-output.mjs <path>' }, null, 2)
    )
    process.exit(1)
  }
  const inputPath = path.resolve(arg)

  const { buf, text } = readFileSafe(inputPath)
  const { hasBom, hasCrlf } = checkEncoding(buf, text)

  if (hasBom) {
    console.log(
      JSON.stringify({ ok: false, error: 'UTF-8 BOM detected', path: inputPath }, null, 2)
    )
    process.exit(2)
  }
  if (hasCrlf) {
    console.log(
      JSON.stringify(
        { ok: false, error: 'CRLF detected — must be LF only', path: inputPath },
        null,
        2
      )
    )
    process.exit(2)
  }

  const knownQueueIds = loadKnownQueueIds(inputPath)
  const seenQueueIds = new Set()
  const lines = text.split('\n').filter((l) => l.trim().length > 0)

  let totalPassed = 0
  let totalFailed = 0
  let totalSkipped = 0
  const allErrors = []

  lines.forEach((line, idx) => {
    const lineNumber = idx + 1
    let obj
    try {
      obj = JSON.parse(line)
    } catch (e) {
      allErrors.push({ line: lineNumber, code: 'INVALID_JSON', message: String(e.message) })
      totalFailed += 1
      return
    }
    if (typeof obj !== 'object' || obj === null) {
      allErrors.push({
        line: lineNumber,
        code: 'NOT_OBJECT',
        message: 'line must be a JSON object',
      })
      totalFailed += 1
      return
    }

    const { errors, isSkip } = validateEnrichedItem(obj, lineNumber, knownQueueIds, seenQueueIds)
    if (errors.length > 0) {
      allErrors.push(...errors)
      totalFailed += 1
    } else if (isSkip) {
      totalSkipped += 1
    } else {
      totalPassed += 1
    }
  })

  const report = {
    ok: totalFailed === 0,
    input_path: inputPath,
    pending_known: knownQueueIds.size,
    total_input: lines.length,
    total_passed: totalPassed,
    total_failed: totalFailed,
    total_skipped: totalSkipped,
    coverage:
      knownQueueIds.size > 0
        ? Math.round((seenQueueIds.size / knownQueueIds.size) * 1000) / 10 // 백분율 (소수점 1자리)
        : null,
    encoding: { hasBom, hasCrlf },
    errors: allErrors.slice(0, 100),
    error_truncated: allErrors.length > 100,
  }

  const outputPath = inputPath.replace(/\.jsonl$/, '.validation.json')
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2) + '\n', { encoding: 'utf8' })

  console.log(
    JSON.stringify(
      {
        ok: report.ok,
        summary: {
          total: lines.length,
          passed: totalPassed,
          failed: totalFailed,
          skipped: totalSkipped,
          coverage_pct: report.coverage,
        },
        validation_report: outputPath,
      },
      null,
      2
    )
  )

  process.exit(report.ok ? 0 : 3)
}

main()
