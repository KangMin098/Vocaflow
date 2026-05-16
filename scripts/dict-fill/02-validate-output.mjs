// scripts/dict-fill/02-validate-output.mjs
// Dict-fill output JSONL 검증. /dict-enrich 종료 시 자동 호출.
//
// 사용:
//   node scripts/dict-fill/02-validate-output.mjs <output-path>...
//
// 검증 항목:
//   - 라인이 JSON 객체
//   - 필수 키: word, pos, ok (boolean)
//   - ok=true 면 data: { example_en, synonyms, antonyms, ipa, collocations }
//   - ok=false 면 error: string
//   - example_en 에 lemma 또는 inflection 포함 (R3 stem-stripping)
//   - synonyms/antonyms 가 lemma 자체 미포함 (R8)
//   - ipa 가 `/.../` 형식
//   - 입력 단어 셋과 출력 단어 셋 일치 (input 파일이 같은 폴더에 있을 때)
//
// 결과: <output>.validation.json 생성

import fs from 'node:fs'
import path from 'node:path'

function fail(msg) { console.error(msg); process.exit(1) }

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) fail(`file not found: ${filePath}`)
  const text = fs.readFileSync(filePath, 'utf8')
  if (text.charCodeAt(0) === 0xfeff) fail(`UTF-8 BOM detected: ${filePath}`)
  if (text.includes('\r\n')) fail(`CRLF detected (LF only required): ${filePath}`)
  return text.split('\n').filter((l) => l.trim().length > 0)
}

// R3-style inflection check (mirrors packages/wlp/src/qa/rules.ts lemmaInExample)
const IRREGULAR = {
  bind:['bound'], bring:['brought'], buy:['bought'], catch:['caught'], come:['came'],
  do:['does','did','done'], drink:['drank','drunk'], drive:['drove','driven'], eat:['ate','eaten'],
  fall:['fell','fallen'], feel:['felt'], fight:['fought'], find:['found'], fly:['flew','flown'],
  freeze:['froze','frozen'], get:['got','gotten'], give:['gave','given'], go:['goes','went','gone'],
  grow:['grew','grown'], hang:['hung'], have:['has','had'], hear:['heard'], hold:['held'],
  keep:['kept'], know:['knew','known'], leave:['left'], light:['lit'], lose:['lost'], make:['made'],
  mean:['meant'], meet:['met'], overcome:['overcame'], pay:['paid'], ride:['rode','ridden'],
  run:['ran','running'], say:['said'], see:['saw','seen'], sell:['sold'], send:['sent'],
  shrink:['shrank','shrunk'], sing:['sang','sung'], sit:['sat'], sleep:['slept'], speak:['spoke','spoken'],
  spring:['sprang','sprung'], stand:['stood'], swim:['swam','swum'], take:['took','taken'],
  teach:['taught'], tell:['told'], think:['thought'], throw:['threw','thrown'], understand:['understood'],
  wear:['wore','worn'], win:['won'], write:['wrote','written'],
  child:['children'], foot:['feet'], goose:['geese'], man:['men'], mouse:['mice'],
  person:['people'], tooth:['teeth'], woman:['women'],
}

function containsWholeWord(text, word) {
  if (word.length === 0) return false
  const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
  return re.test(text)
}

function lemmaInExample(en, lemma) {
  if (!en || !lemma) return false
  const e = en.toLowerCase()
  const l = lemma.toLowerCase()
  if (e.includes(l)) return true
  const irreg = IRREGULAR[l]
  if (irreg) for (const f of irreg) if (containsWholeWord(e, f)) return true
  if (l.length >= 3 && e.includes(l.slice(0, -1))) return true
  if (l.length >= 4 && e.includes(l.slice(0, -2))) return true
  return false
}

function validateLine(obj, lineNo) {
  const errs = []
  const push = (code, message) => errs.push({ line: lineNo, code, message })

  if (typeof obj !== 'object' || obj === null) { push('NOT_OBJECT', 'line must be a JSON object'); return errs }
  if (typeof obj.word !== 'string' || !obj.word) push('BAD_WORD', 'word required')
  if (typeof obj.pos !== 'string' || !obj.pos) push('BAD_POS', 'pos required')
  if (typeof obj.ok !== 'boolean') push('BAD_OK', 'ok must be boolean')

  if (obj.ok === false) {
    if (typeof obj.error !== 'string' || !obj.error) push('BAD_ERROR', 'ok=false requires error string')
    return errs
  }

  const d = obj.data
  if (!d || typeof d !== 'object') { push('BAD_DATA', 'ok=true requires data object'); return errs }

  // example_en
  if (typeof d.example_en !== 'string' || !d.example_en) push('BAD_EXAMPLE', 'example_en required')
  else if (!lemmaInExample(d.example_en, obj.word)) push('R3_LEMMA_MISSING', `example_en lacks "${obj.word}" or inflection`)

  // synonyms / antonyms
  for (const k of ['synonyms', 'antonyms']) {
    if (!Array.isArray(d[k])) { push(`BAD_${k.toUpperCase()}`, `${k} must be array`); continue }
    if (d[k].some((x) => typeof x !== 'string')) push(`BAD_${k.toUpperCase()}_ITEM`, `${k} items must be string`)
    if (d[k].includes(obj.word)) push(`R8_${k.toUpperCase()}_SELF`, `${k} contains lemma itself`)
  }

  // ipa
  if (typeof d.ipa !== 'string' || !d.ipa) push('BAD_IPA', 'ipa required')
  else if (!/^\/.*\/$/.test(d.ipa)) push('BAD_IPA_FORMAT', 'ipa must be /.../ wrapped')

  // collocations
  if (!Array.isArray(d.collocations)) push('BAD_COLLOCATIONS', 'collocations must be array')
  else if (d.collocations.some((x) => typeof x !== 'string')) push('BAD_COLLOCATION_ITEM', 'collocations items must be string')

  return errs
}

function validateOne(outputPath) {
  const lines = readJsonl(outputPath)
  let okTrue = 0, okFalse = 0, errored = 0
  const allErrors = []
  const seenKeys = new Set()
  for (let i = 0; i < lines.length; i++) {
    let obj
    try { obj = JSON.parse(lines[i]) } catch (e) {
      allErrors.push({ line: i + 1, code: 'INVALID_JSON', message: String(e.message) })
      errored++; continue
    }
    const errs = validateLine(obj, i + 1)
    if (errs.length > 0) { allErrors.push(...errs); errored++; continue }
    if (obj.ok === true) okTrue++; else okFalse++
    seenKeys.add(`${obj.word}|${obj.pos}`)
  }

  // input ↔ output 일치 검사
  const inputPath = outputPath.replace(/output/g, 'input')
  let inputMismatch = null
  if (fs.existsSync(inputPath)) {
    const inLines = readJsonl(inputPath)
    const inKeys = new Set(inLines.map((l) => { try { const o = JSON.parse(l); return `${o.word}|${o.pos}` } catch { return null } }).filter(Boolean))
    const missing = [...inKeys].filter((k) => !seenKeys.has(k))
    const extra = [...seenKeys].filter((k) => !inKeys.has(k))
    if (missing.length > 0 || extra.length > 0) inputMismatch = { missing, extra }
  }

  return {
    ok: errored === 0 && !inputMismatch,
    path: outputPath,
    total: lines.length,
    ok_true: okTrue,
    ok_false: okFalse,
    errored,
    errors: allErrors.slice(0, 30),
    error_truncated: allErrors.length > 30,
    input_mismatch: inputMismatch,
  }
}

function main() {
  const args = process.argv.slice(2)
  if (args.length === 0) fail('usage: node 02-validate-output.mjs <output-path>...')

  const reports = args.map(validateOne)
  for (const r of reports) {
    const reportPath = r.path.replace(/\.jsonl$/, '.validation.json')
    fs.writeFileSync(reportPath, JSON.stringify(r, null, 2) + '\n', 'utf8')
    console.log(JSON.stringify({
      ok: r.ok, file: path.basename(r.path),
      total: r.total, ok_true: r.ok_true, ok_false: r.ok_false, errored: r.errored,
      errors_count: r.errors.length,
      input_mismatch: r.input_mismatch ? { missing: r.input_mismatch.missing.length, extra: r.input_mismatch.extra.length } : null,
      report: reportPath,
    }, null, 2))
  }
  const allOk = reports.every((r) => r.ok)
  process.exit(allOk ? 0 : 3)
}

main()
