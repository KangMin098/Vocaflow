// scripts/dict/w0816-meaningfix.mjs
// T7 — `meaning_ko` / `meanings_ko` 보완. T6(예문 정합성) 배치가 남긴 `meaning_issue` 968건이 입력이다.
//   T6 이 확인한 것: 결함의 대부분은 예문이 아니라 **뜻이 빈약한 것**이었다.
//   `meaning_ko` 가 `all_meanings` 첫 뜻만 잘라 담아, 예문이 쓰는 흔한 sense 를 빠뜨린 패턴이 지배적.
//   진단: docs/AI_CONTEXT/diagnostics/dict_field_consistency_20260815.md
//
// ⚠️ 게이트 설계 — 이 배치는 **더하는 배치이지 바꾸는 배치가 아니다.**
//   (1) **기존 sense 보존 필수** — 기존 `meanings_ko` 의 모든 meaning 문자열이 새 배열에 그대로 남아야 한다.
//       하나라도 사라지면 그 항목 전체를 거부한다. 맞는 뜻을 덮어쓰는 사고가 이 배치의 최대 위험이다.
//   (2) **`meaning_ko` ≡ `meanings_ko[0].meaning` 정합** — 두 필드를 따로 쓰면 조용히 어긋난다.
//       (실제로 2026-08-16 수동 수정에서 이 사고가 났다: absently 의 meaning_ko 만 고치고 meanings_ko 는 "결석하게" 로 남았다.)
//   (3) pos 화이트리스트 · v_level 0~11 · 한글 포함 · 길이 상한.
//   (4) 예문 되돌리기(`revert_example`) — T6 에서 "뜻 고치면 예문도 되돌려야 함" 으로 표시된 항목은
//       w0816-exmatch 입력 청크의 원본 예문을 복원한다.
//
// 실행: node scripts/dict/w0816-meaningfix.mjs chunk [--dir D] [--size 60]
//       node scripts/dict/w0816-meaningfix.mjs apply [--dir D] [--commit]
import fs from 'node:fs'
import path from 'node:path'
import { db, dictRows, writeChunks, readOuts } from './w0815-pubvocab.mjs'

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const MODE = process.argv[2]
const DIR = arg('--dir', 'scripts/dict/w0816-meaningfix')
const SRC = arg('--src', 'scripts/dict/w0816-exmatch')
const SIZE = parseInt(arg('--size', '60'), 10)
const COMMIT = process.argv.includes('--commit')

const POS_OK = new Set(['noun', 'verb', 'adjective', 'adverb', 'interjection', 'preposition', 'conjunction', 'pronoun', 'determiner'])

/** T6 산출물에서 meaning_issue 수집 → Map(word → issue). */
function collectIssues() {
  const m = new Map()
  for (const f of fs.readdirSync(SRC)) {
    if (!/\.out\.json$/.test(f)) continue
    let arr; try { arr = JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8')) } catch { continue }
    for (const e of arr) {
      if (e && e.meaning_issue && String(e.meaning_issue).trim()) m.set(e.word.toLowerCase(), String(e.meaning_issue).trim())
    }
  }
  return m
}

/** T6 입력 청크의 원본 예문 → Map(word → example_en). 예문 되돌리기용. */
function originalExamples() {
  const m = new Map()
  for (const f of fs.readdirSync(SRC)) {
    if (!/^chunk-\d+\.json$/.test(f)) continue
    let arr; try { arr = JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8')) } catch { continue }
    for (const e of arr) if (e && e.word) m.set(e.word.toLowerCase(), e.example_en)
  }
  return m
}

if (MODE === 'chunk') {
  const issues = collectIssues()
  const words = [...issues.keys()]
  const rows = await dictRows(words, 'word, pos, pos_set, meaning_ko, meanings_ko, example_en, cefr_level, v_level, frequency_rank')
  const targets = []
  for (const [w, issue] of issues) {
    const r = rows.get(w)
    if (!r) continue
    targets.push({
      word: w,
      issue,
      pos: r.pos,
      pos_set: r.pos_set ?? [],
      meaning_ko: r.meaning_ko,
      meanings_ko: Array.isArray(r.meanings_ko) ? r.meanings_ko : [],
      example_en: r.example_en,
      cefr: r.cefr_level,
      v: r.v_level,
      rank: r.frequency_rank,
    })
  }
  const n = writeChunks(DIR, targets, SIZE)
  console.log(`meaningfix targets: ${targets.length} · chunks: ${n} → ${DIR}/chunk-NN.json`)
  process.exit(0)
}

if (MODE === 'apply') {
  // 현재 DB 상태(기존 sense 보존 검증의 기준)
  const inputWords = new Set()
  for (const f of fs.readdirSync(DIR)) {
    if (!/^chunk-\d+\.json$/.test(f)) continue
    for (const e of JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))) inputWords.add(e.word.toLowerCase())
  }
  // ⚠️ v_level 을 반드시 select 할 것 — 아래 sense 검증에서 폴백으로 쓴다.
  //    빠뜨리면 c.v_level 이 undefined 라 v_level 없는 sense 가 전부 malformed 로 거부된다(2026-08-16 실제 발생).
  const cur = await dictRows([...inputWords], 'word, meaning_ko, meanings_ko, example_en, v_level')
  const origEx = originalExamples()

  // 청크 입력이 담은 **원본 sense**(부가 필드 포함) — 재구성 시 example/register/sense_en 등을 보존한다.
  //   apply 가 {pos,meaning,v_level} 로만 다시 쓰면 그 부가 메타데이터가 조용히 사라진다(2026-08-16 실제 손실).
  const origSenses = new Map()
  for (const f of fs.readdirSync(DIR)) {
    if (!/^chunk-\d+\.json$/.test(f)) continue
    for (const e of JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))) {
      const m = new Map()
      for (const s of e.meanings_ko ?? []) if (s?.meaning) m.set(String(s.meaning).trim(), s)
      origSenses.set(e.word.toLowerCase(), m)
    }
  }

  const { files, rows } = readOuts(DIR)
  const updates = new Map()
  let bad = 0, senseLost = 0, mismatchHead = 0, skipped = 0, reverted = 0, posFixed = 0
  for (const e of rows) {
    if (!e || typeof e.word !== 'string') { bad++; continue }
    const w = e.word.toLowerCase().trim()
    const c = cur.get(w)
    if (!c) { bad++; continue }
    if (e.skip === true) { skipped++; continue }
    if (!Array.isArray(e.meanings_ko) || !e.meanings_ko.length || typeof e.meaning_ko !== 'string') { bad++; continue }

    // 형식 검증
    const senses = []
    let ok = true
    for (const m of e.meanings_ko) {
      if (!m || !POS_OK.has(m.pos) || typeof m.meaning !== 'string' || !m.meaning.trim()) { ok = false; break }
      const v = Number.isInteger(m.v_level) ? m.v_level : c.v_level
      if (!Number.isInteger(v) || v < 0 || v > 11) { ok = false; break }
      // 같은 meaning 문자열의 원본 sense 가 있으면 부가 필드(example·register·sense_en …)를 물려받는다.
      const keep = origSenses.get(w)?.get(m.meaning.trim())
      senses.push({ ...(keep ?? {}), ...m, pos: m.pos, meaning: m.meaning.trim(), v_level: v })
    }
    const head = e.meaning_ko.trim()
    if (!ok || !head || head.length > 200 || !/[가-힣]/.test(head)) { bad++; continue }

    // ⚠️ 게이트 (1) 기존 sense 보존 — 하나라도 사라지면 항목 전체 거부
    const existing = (Array.isArray(c.meanings_ko) ? c.meanings_ko : [])
      .map((m) => String(m?.meaning ?? '').trim()).filter(Boolean)
    const joined = senses.map((s) => s.meaning).join(' ¶ ')
    if (existing.some((old) => !joined.includes(old))) { senseLost++; continue }

    // ⚠️ 게이트 (2) meaning_ko 의 대표 뜻 = meanings_ko[0]
    //   sense 문자열은 `(화학) 납 (Pb) — 무겁고 부드러운 …` 처럼 설명이 붙는 긴 형식이고
    //   meaning_ko 는 카드 앞면용 짧은 글이다. 전문 포함을 요구하면 meaning_ko 가 비대해진다 —
    //   설명부(— 이후)와 선행 괄호 라벨을 걷어낸 **핵심어**만 비교한다.
    //   ⚠️ 후행 괄호도 걷어야 한다 — `환자들 (patient의 복수형)` 처럼 **문법 메타데이터가 뒤에 붙는** 형식이
    //   흔한데, 앞쪽 괄호만 벗기면 core 가 통째로 남아 head 와 절대 일치하지 않는다(T13 에서 10건 헛되이 탈락).
    //   괄호는 **위치를 가리지 않고 전부** 걷는다. `활인화(설명) (tableau의 복수형)` 처럼 두 개가
    //   연달아 붙는 형식이 있어 한 번만 벗기면 여전히 남는다.
    const core = (s) => s.split(/[—–]/)[0]
      .replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ')
      .split(/[,;]/)[0].trim()
    //   비교는 **양쪽을 같은 방식으로 정규화한 뒤** 한다. core 만 괄호를 벗기면 `달(月)` ↔ `달 (月)` 처럼
    //   공백 차이 하나로 어긋난다(T13 `mes` 에서 발생).
    const norm = (s) => s.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()
    const c0 = core(senses[0].meaning)
    if (c0 && !norm(head).includes(norm(c0))) { mismatchHead++; continue }

    // `meaning_ko` 정규화 — 카드 앞면은 짧아야 한다(Calm UI · 인지 부하).
    //   sense 문자열의 설명부(`— …`)가 head 로 딸려 들어오면 정의문 덤프가 된다.
    //   세미콜론 구획마다 설명부를 걷어내고, 3구획·90자로 자른다. 전체 정의는 meanings_ko 가 보관한다.
    const shortHead = head.split(';')
      .map((s) => s.split(/[—–]/)[0].trim())
      .filter(Boolean).slice(0, 3).join('; ').slice(0, 90).replace(/[;,\s]+$/, '')
    const patch = { meaning_ko: shortHead || head.slice(0, 90), meanings_ko: senses, primary_pos: senses[0].pos }
    // ⚠️ 게이트 (5) `pos` 교정 — 이 백로그의 큰 갈래가 "`pos`=noun 인데 뜻은 동사부터"(`lead`·`hide`·`high`·`lay`)다.
    //   에이전트가 `pos` 를 보내면 **새 sense 목록에 실제로 존재하는 품사일 때만** 받는다(임의 변경 차단).
    //   `pos_set` 은 합집합으로 다시 만든다 — 셋을 따로 쓰면 조용히 어긋난다(2026-08-16 실제 사고).
    if (typeof e.pos === 'string' && POS_OK.has(e.pos) && senses.some((s) => s.pos === e.pos)) {
      patch.pos = e.pos
      patch.primary_pos = e.pos
      patch.pos_set = [...new Set(senses.map((s) => s.pos).concat(e.pos))]
      posFixed++
    }
    // ⚠️ 게이트 (4) 예문 되돌리기
    if (e.revert_example === true) {
      const o = origEx.get(w)
      if (o && o !== c.example_en) { patch.example_en = o; reverted++ }
    }
    updates.set(w, patch)
  }
  console.log(`files: ${files} · 적용 대상: ${updates.size} · 기존 sense 소실(거부): ${senseLost} · head 불일치(거부): ${mismatchHead} · malformed: ${bad} · agent-skip: ${skipped}`)
  console.log(`예문 되돌림: ${reverted} · pos 교정: ${posFixed}`)

  if (!COMMIT) {
    console.log('DRY-RUN (--commit 로 적용). 샘플:')
    let n = 0
    for (const [w, p] of updates) {
      if (n++ >= 8) break
      console.log(` ${w}\n   before: ${cur.get(w).meaning_ko}\n   after : ${p.meaning_ko}  (senses ${p.meanings_ko.length})`)
    }
    process.exit(0)
  }

  let done = 0, failed = 0
  for (const [w, patch] of updates) {
    const { error } = await db.from('shared_dictionary').update(patch).eq('word', w)
    if (error) { failed++; if (failed < 5) console.warn(w, error.message) } else done++
    if (done % 200 === 0 && done) console.log(`  … ${done}`)
  }
  console.log(`updated: ${done} · failed: ${failed}`)
  process.exit(0)
}

console.error('usage: node scripts/dict/w0816-meaningfix.mjs chunk|apply [--dir D] [--src D] [--size N] [--commit]')
process.exit(1)
