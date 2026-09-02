// scripts/csat/ingest-mock.mjs
//
// **평가원 6·9월 모의평가를 코퍼스에 넣는다 — 규칙 도출에 한 번도 쓰이지 않은 순수 홀드아웃.**
//
// 지금까지 이 저장소의 홀드아웃은 **2014A 한 회차**뿐이었고, 그래서
// "유형별 명제는 회차당 문항이 1~4개라 n=14 가 구조적 상한" 이라고 적어 두었다.
// 모의평가를 넣으면 그 상한이 풀린다 — 평가원이 같은 설계로 내는 시험이기 때문이다.
//
// ⚠️ **이 회차들은 어떤 규칙 도출에도 쓰이지 않았다.** 그러므로 여기에 HARD 10 을 걸면
//    사후 서술이 아니라 **예측**이다. 예측이 깨지면 그 규칙은 수능 전용 관행이지
//    평가원 설계의 일반 규칙이 아니라는 뜻이고, 그것도 발견이다.
//
// 2026-09-02 전면 재작업 — 회차 4개(손목록)에서 **폴더의 전 회차**로. 알아낸 것 셋:
//   ① 파일명이 내용을 말하지 않는다. `..._정답표.pdf` 인데 **듣기 대본**인 회차가 7,
//      `..._문제지.pdf` 인데 **듣기 대본**인 회차가 2 (2019학년도 6·9월 = 문제지 자체가 없다).
//      그래서 파일명이 아니라 **내용으로 판정**하고, 없는 것은 없다고 적는다.
//   ② pdftotext -layout 의 좌표계가 회차마다 다르다 — `lib-columns.mjs` 참조.
//   ③ 그래도 한 페이지씩 단 나누기가 실패하는 회차가 남는다. 그 페이지의 오른쪽 단 문항이
//      통째로 사라지므로, **못 찾은 번호에 한해** 줄 가운데 발문을 2차로 줍는다.
//
// 실행: node scripts/csat/ingest-mock.mjs
// 산출: data/mock-questions.json · data/mock-answers.json · data/mock-inventory.json · columns2/M*.txt

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { restoreColumnsBest } from './lib-columns.mjs'

// 원본 위치는 옮겨진 적이 있다(`Documents/수능영어기출/모의평가` → `Documents/영어/모의평가`).
// 하드코딩 하나만 두면 폴더가 움직인 날 스크립트가 조용히 0회분을 넣는다 — 후보를 훑는다.
const SRC_CANDIDATES = [
  process.env.CSAT_MOCK_DIR,
  'C:/Users/Administrator/Documents/영어/모의평가',
  'C:/Users/Administrator/Documents/수능영어기출/모의평가',
].filter(Boolean)
const SRC = SRC_CANDIDATES.find((d) => fs.existsSync(d))
if (!SRC) throw new Error(`모의평가 원본 폴더를 못 찾았다: ${SRC_CANDIDATES.join(' · ')}`)

const PDFTOTEXT = 'C:/Program Files/Git/mingw64/bin/pdftotext.exe'
const DIR = path.resolve('scripts/csat/data')
const COL = path.join(DIR, 'columns2')

function pdfText(file) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mock-'))
  const src = path.join(tmp, 'in.pdf')
  const dst = path.join(tmp, 'out.txt')
  try {
    fs.copyFileSync(path.join(SRC, file), src)
    execFileSync(PDFTOTEXT, ['-layout', '-enc', 'UTF-8', src, dst], { stdio: 'pipe' })
    return fs.readFileSync(dst, 'utf8').replace(/\r/g, '')
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

// ── 정답표 ────────────────────────────────────────────────────────────
const CIRC = { '①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5 }
function parseKey(raw) {
  const flat = raw.replace(/\n/g, ' ')
  const out = new Map()
  // `1②  2` · `10 ①  2` · `25 ④, ⑤ 2` (복수정답)
  const re = /(?<!\d)(\d{1,2})\s*([①②③④⑤](?:\s*,\s*[①②③④⑤])*)\s+([23])(?!\d)/g
  let m
  while ((m = re.exec(flat))) {
    const no = +m[1]
    if (no < 1 || no > 45) continue
    const answers = [...m[2].matchAll(/[①②③④⑤]/g)].map((x) => CIRC[x[0]])
    if (!out.has(no)) out.set(no, { no, answer: answers[0], answers, points: +m[3], multi: answers.length > 1 })
  }
  return [...out.values()].sort((a, b) => a.no - b.no)
}

// ── 유형 배정 — 본 코퍼스의 정규식표를 그대로 쓴다 ───────────────────
const TYPES = JSON.parse(fs.readFileSync(path.join(DIR, 'classified.json'), 'utf8')).types
  .map((t) => ({ ...t, re: new RegExp(t.match.replace(/^\/|\/$/g, '')) }))

const RE_SET = /^\s*\[\s*(\d{1,2})\s*[~～∼〜–—-]\s*(\d{1,2})\s*\]\s*(.*)$/

/**
 * 발문을 모은다. 세 가지를 처리해야 한다:
 *  ① **여러 줄로 이어지는 발문** — 빈 줄을 건너뛰고 한글 줄을 계속 붙인다.
 *  ② **세트 머리글** `[31~34] 다음 빈칸에 …` — 31~34 는 자기 발문이 없고 머리글이 발문이다.
 *  ③ **줄 가운데에서 시작하는 발문** — 단 나누기가 실패한 페이지의 잔해. ②까지로 못 찾은
 *     번호에 한해서만 줍는다(1차에 쓰면 지문 속 숫자를 발문으로 삼킨다).
 */
function stemsOf(text) {
  const ls = text.split('\n')

  const collect = (from) => {
    let s = ''
    for (let j = from, blanks = 0; j < ls.length && j < from + 6; j += 1) {
      const l = ls[j].trim()
      if (!l) { if (++blanks > 2) break; continue }
      if (/^[①②③④⑤]/.test(l)) break
      if (/^\s*\d{1,2}\s*[.．]/.test(ls[j])) break
      if (RE_SET.test(ls[j])) break
      if (!/[가-힣]/.test(l)) break // 영어 지문이 시작되면 발문 끝
      s += ' ' + l
    }
    return s
  }

  // ② 세트 머리글을 먼저 모은다
  const setStems = new Map()
  ls.forEach((l, i) => {
    const m = l.match(RE_SET)
    if (!m) return
    const from = +m[1]
    const to = +m[2]
    if (from < 1 || to > 45 || to < from) return
    const stem = (m[3] + collect(i + 1)).trim()
    if (!/[가-힣]/.test(stem)) return
    for (let n = from; n <= to; n += 1) if (!setStems.has(n)) setStems.set(n, stem)
  })

  // ②-b 세트 머리글도 줄 가운데에서 시작할 수 있다 — 단 나누기가 실패한 페이지에서
  //     `① affect our …        [36~37] 주어진 글 다음에 …` 처럼 앞 단 꼬리에 붙는다.
  //     이걸 놓치면 순서·삽입 세트의 첫 문항(36번)이 회차마다 통째로 빠진다(M2109·M2506 실측).
  ls.forEach((l, i) => {
    const m = l.match(/\s{2,}\[\s*(\d{1,2})\s*[~～∼〜–—-]\s*(\d{1,2})\s*\]\s*(.*)$/)
    if (!m) return
    const from = +m[1]
    const to = +m[2]
    if (from < 1 || to > 45 || to < from) return
    const stem = (m[3] + collect(i + 1)).trim()
    if (!/[가-힣]/.test(stem)) return
    for (let n = from; n <= to; n += 1) if (!setStems.has(n)) setStems.set(n, stem)
  })

  const out = new Map()
  for (let i = 0; i < ls.length; i += 1) {
    const m = ls[i].match(/^\s*(\d{1,2})\s*[.．]\s*(.*)$/)
    if (!m) continue
    const no = +m[1]
    if (no < 1 || no > 45 || out.has(no)) continue
    let stem = (m[2] + collect(i + 1)).trim()
    // **옆 단에서 넘어온 다음 문항의 발문을 잘라낸다.** 단이 안 갈린 페이지에서는
    // `Because the environment plays a significant role in      35. 다음 글에서 전체 흐름과…`
    // 처럼 이 문항의 지문 조각 뒤에 **다른 번호의 발문**이 붙는다. 그대로 두면 유형이
    // 그 발문으로 배정된다(실측 M2506#33 이 빈칸추론인데 R-IRRELEVANT 로 실렸다).
    stem = stem.replace(/\s{2,}\d{1,2}\s*[.．]\s*(?=[^\s])[\s\S]*$/, '').trim()
    // 자기 발문에 한글이 없으면(= 지문이 바로 시작) 세트 머리글이 발문이다
    if (!/[가-힣]/.test(stem) && setStems.has(no)) stem = setStems.get(no)
    out.set(no, { no, stem, high_score: /\[\s*3\s*점\s*\]/.test(stem) })
  }
  // 문항 번호 줄이 아예 없는 세트 문항도 살린다
  for (const [no, stem] of setStems) if (!out.has(no)) out.set(no, { no, stem, high_score: false })

  // ③ 줄 가운데 발문 — 못 찾은 번호에 한해
  for (let no = 1; no <= 45; no += 1) {
    if (out.has(no)) continue
    const re = new RegExp(String.raw`\s{2,}(` + no + String.raw`\s*[.．]\s*)(\S.*)$`)
    for (let i = 0; i < ls.length; i += 1) {
      const m = ls[i].match(re)
      if (!m || !/[가-힣]/.test(m[2])) continue
      const col = ls[i].length - m[2].length
      let stem = m[2]
      // 같은 단(= 같은 시작 열)에서 이어지는 한글 줄을 붙인다
      for (let j = i + 1, blanks = 0; j < ls.length && j < i + 5; j += 1) {
        const cont = ls[j].length > col - 4 ? ls[j].slice(Math.max(0, col - 4)).trim() : ''
        if (!cont) { if (++blanks > 1) break; continue }
        if (/^[①②③④⑤]/.test(cont) || /^\d{1,2}\s*[.．]/.test(cont)) break
        if (!/[가-힣]/.test(cont)) break
        stem += ' ' + cont
      }
      stem = stem.trim()
      out.set(no, { no, stem, high_score: /\[\s*3\s*점\s*\]/.test(stem), rescued: true })
      break
    }
  }

  return [...out.values()].sort((a, b) => a.no - b.no)
}

function classify(stem) {
  const norm = stem.replace(/\s+/g, '')
  return TYPES.filter((t) => t.re.test(norm))
}

/**
 * 문제지에서 **3점 문항 번호 집합**을 읽는다.
 *
 * 배점 자리는 회차마다 다르고, 그 자리는 그 회차 정답표에만 맞는다. 그래서 문제지가 누구
 * 것인지 가릴 때 이보다 나은 지문(指紋)이 없다 — 파일명이 아니라 내용끼리 대조하는 것이다.
 */
function threePointSet(text) {
  const ls = text.split('\n')
  const marks = []
  ls.forEach((l, i) => {
    const m = l.match(/^\s*(\d{1,2})\s*[.．]/)
    if (m && +m[1] >= 1 && +m[1] <= 45) marks.push({ i, no: +m[1] })
  })
  const out = new Set()
  for (let k = 0; k < marks.length; k += 1) {
    const from = marks[k].i
    const to = k + 1 < marks.length ? marks[k + 1].i : ls.length
    if (ls.slice(from, to).some((l) => /\[\s*3\s*점\s*\]/.test(l))) out.add(marks[k].no)
  }
  return out
}

/** 파일 하나가 무엇인지 — 파일명이 아니라 내용으로 판정한다 */
function kindOf(raw) {
  if (/듣기평가\s*대본/.test(raw)) return '대본'
  if (parseKey(raw).length >= 40) return '정답표'
  const stems = new Set([...raw.matchAll(/^\s*(\d{1,2})\s*[.．]/gm)].map((m) => +m[1]).filter((n) => n >= 1 && n <= 45))
  if (stems.size >= 18) return '문제지'
  return '미상'
}

// ── 회차 목록 — 폴더를 읽고 **내용으로** 역할을 정한다 ────────────────
// 손목록을 두면 폴더에 회차가 늘어도 그대로라 "전체를 넣었다" 가 조용히 거짓이 된다
// (실제로 18회분 중 4회분만 들어와 있었다).
const FILES = fs.readdirSync(SRC).filter((f) => /^\d{6}_영어영역_.+\.pdf$/.test(f)).sort()
const exams = new Map()
const inventory = []
for (const f of FILES) {
  const code = f.slice(0, 6)
  const raw = pdfText(f)
  const kind = kindOf(raw)
  inventory.push({ file: f, code, kind })
  const e = exams.get(code) ?? { id: 'M' + code.slice(2), code, paper: null, key: null, script: null }
  if (kind === '문제지' && !e.paper) e.paper = f
  if (kind === '정답표' && !e.key) e.key = f
  if (kind === '대본' && !e.script) e.script = f
  exams.set(code, e)
}
const EXAMS = [...exams.values()].sort((a, b) => a.code.localeCompare(b.code))
if (!EXAMS.length) throw new Error(`${SRC} 에 회차 PDF 가 없다`)

// ── 같은 문제지가 두 회차에 붙어 있으면 하나는 가짜다 ────────────────
//
// 실측 2026-09-02: `202009_영어영역_문제지.pdf` 와 `202106_영어영역_문제지.pdf` 가
// **md5 동일**이었다. 그래서 2020학년도 9월 모평 45문항이 통째로 2021학년도 6월 것으로
// 채워졌고, 두 정답표가 45문항 중 31문항에서 어긋나므로 **31문항의 정답이 거짓**이 됐다.
// 그 상태로 분석하면 학습자를 반대로 훈련시킨다.
//
// 어느 쪽이 진짜인지는 **문제지의 `[3점]` 표시가 정한다** — 배점은 회차마다 자리가 다르고,
// 그 자리는 그 회차 정답표에만 맞는다. 파일명이 아니라 내용끼리 대조하는 것이라 믿을 수 있다.
{
  const byHash = new Map()
  for (const e of EXAMS) {
    if (!e.paper) continue
    const h = crypto.createHash('md5').update(fs.readFileSync(path.join(SRC, e.paper))).digest('hex')
    if (!byHash.has(h)) byHash.set(h, [])
    byHash.get(h).push(e)
  }
  for (const [, group] of byHash) {
    if (group.length < 2) continue
    const raw = pdfText(group[0].paper)
    const pick = restoreColumnsBest(raw, (t) =>
      stemsOf(t).reduce((a, q) => a + (classify(q.stem).length === 1 ? 10 : 1), 0))
    // `[3점]` 은 발문 안에 있기도 하고 **별도 줄**에 있기도 하다(오른쪽 정렬로 조판된다).
    // 발문만 보면 이 회차에서 0개가 잡혔다 — 문항 번호로 구간을 갈라 구간마다 찾는다.
    const marked = threePointSet(pick.text)

    let best = null
    for (const e of group) {
      if (!e.key) continue
      const three = new Set(parseKey(pdfText(e.key)).filter((r) => r.points === 3).map((r) => r.no))
      let hit = 0
      for (const n of marked) if (three.has(n)) hit += 1
      const score = three.size ? hit / three.size : 0
      if (!best || score > best.score) best = { exam: e, score, hit, of: three.size }
    }
    const names = group.map((e) => e.id).join(' = ')
    if (!best || best.score < 0.9) {
      // 어느 쪽인지 못 가리면 **둘 다 버린다.** 절반의 확률로 맞는 자료는 자료가 아니다.
      console.log(`  ⚠ 같은 문제지가 ${names} 에 붙어 있고 주인을 못 가렸다 — 전부 제외`)
      for (const e of group) { e.paper = null; e.dup_note = `문제지 PDF 중복(${names}) · 주인 미상` }
      continue
    }
    console.log(`  ⚠ 같은 문제지가 ${names} — [3점] 대조로 ${best.exam.id} 것으로 판정 (${best.hit}/${best.of})`)
    for (const e of group) {
      if (e === best.exam) continue
      e.paper = null
      e.dup_note = `문제지 PDF 가 ${best.exam.id} 것과 동일 — 이 회차 문제지는 없다`
    }
  }
}

console.log(`  원본 ${SRC}`)
console.log(`  회차 ${EXAMS.length} — 문제지 ${EXAMS.filter((e) => e.paper).length} · 정답표 ${EXAMS.filter((e) => e.key).length} · 대본 ${EXAMS.filter((e) => e.script).length}`)
const noPaper = EXAMS.filter((e) => !e.paper).map((e) => e.id)
if (noPaper.length) console.log(`  ⚠ 문제지 없음: ${noPaper.join(' ')} — 이 회차는 문항을 못 넣는다`)
const noKey = EXAMS.filter((e) => e.paper && !e.key).map((e) => e.id)
if (noKey.length) console.log(`  ⚠ 정답표 없음: ${noKey.join(' ')} — 정답·배점 미상으로 남는다`)
console.log()

// ── 실행 ──────────────────────────────────────────────────────────────
const questions = []
const answers = []
const report = []
for (const e of EXAMS) {
  if (!e.paper) {
    report.push({ exam: e.id, file: null, space: null, stems: 0, assigned: 0, multi: 0, none: 0, keys: 0, missing_paper: true, note: e.dup_note ?? null })
    continue
  }
  const raw = pdfText(e.paper)
  // 좌표계는 회차마다 다르다 — 둘 다 돌려 **유형 배정이 많은 쪽**을 쓴다.
  // 발문 수만으로 고르면 안 된다: 단이 안 갈린 줄도 발문 하나로 세어져 점수가 높아진다.
  const pick = restoreColumnsBest(raw, (text) =>
    stemsOf(text).reduce((a, q) => a + (classify(q.stem).length === 1 ? 10 : 1), 0))
  const cols = pick.text
  fs.writeFileSync(path.join(COL, `${e.id}.txt`), cols)

  const stems = stemsOf(cols)
  let assigned = 0
  let multi = 0
  let none = 0
  for (const q of stems) {
    const hits = classify(q.stem)
    if (hits.length === 1) assigned += 1
    else if (hits.length > 1) multi += 1
    else none += 1
    questions.push({
      exam: e.id,
      no: q.no,
      stem: q.stem,
      high_score: q.high_score,
      rescued: q.rescued === true,
      section: q.no <= 17 ? '듣기' : q.no <= 40 ? '독해' : '장문',
      type: hits.length ? hits[0].id : null,
      hit_count: hits.length,
    })
  }

  let keyRows = []
  if (e.key) {
    keyRows = parseKey(pdfText(e.key))
    for (const r of keyRows) answers.push({ exam: e.id, ...r })
  }
  report.push({ exam: e.id, file: e.paper, space: pick.wide ? 'wide' : 'char', stems: stems.length, assigned, multi, none, keys: keyRows.length })
  console.log(`  ${e.id} ${pick.wide ? 'W' : 'C'} 발문 ${String(stems.length).padStart(2)}  배정 ${String(assigned).padStart(2)}  중복 ${multi}  미배정 ${none}  정답 ${keyRows.length}`)
}

fs.writeFileSync(path.join(DIR, 'mock-questions.json'), JSON.stringify({ report, rows: questions }, null, 1))
fs.writeFileSync(path.join(DIR, 'mock-answers.json'), JSON.stringify({ answers }, null, 1))
fs.writeFileSync(path.join(DIR, 'mock-inventory.json'), JSON.stringify({ src: SRC, files: inventory, exams: EXAMS }, null, 1))
console.log()
console.log(`  문항 ${questions.length} · 정답 ${answers.length}`)
console.log('→ mock-questions.json · mock-answers.json · mock-inventory.json · columns2/M*.txt')
