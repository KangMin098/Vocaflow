// scripts/csat/extract-answers.mjs
//
// **정답표 PDF 에서 문항별 정답·배점을 뽑는다 — 읽기 전용.**
//
// 정답 키가 없으면 문항 분석이 뒤집혀도 알 수 없다. 오답을 정답으로 놓고
// "이게 왜 논리적 귀결인가" 를 그럴듯하게 쓰게 되고, 그 오류는 **어려운 문항에 몰린다**
// (쉬운 건 추론으로도 맞으니까). 어려운 문항이 정확히 분석 가치가 큰 것들이다.
//
// ⚠️ **형(form)을 맞춰야 한다.** 정답표에는 홀수형·짝수형이 따로 있고 선택지 순서가 달라
//    정답 번호가 다르다. 코퍼스가 쓴 형과 다른 형의 정답을 붙이면 전부 어긋난다.
//    `csat-source-verify.mjs` 가 확인한 원본 PDF 이름으로 형을 정한다.
//
// **부수 효과 — 파이프라인 독립 검증**: 정답표에는 배점이 있다. 문제지에서 뽑은 `[3점]`
// 표시와 대조하면 추출·분류 파이프라인이 맞는지 **다른 출처로** 확인된다.
//
// 실행: pnpm dlx tsx scripts/csat/extract-answers.mjs

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const SRC = 'C:/Users/Administrator/Document' + 's/수능영어기출/최종'
const OUT_DIR = path.resolve('scripts/csat/data')
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'csatans-'))

/**
 * 코퍼스가 쓴 형 — `csat-source-verify.mjs` 로 확인한 원본 PDF 이름에서 왔다.
 * 2023·2024·2026 은 한 파일에 두 형이 들어 있고 빌더가 **앞 블록(홀수형)** 만 쓴다.
 */
const FORM = {
  '2014A': '홀수', '2014B': '홀수',
  2015: '홀수', 2016: '홀수',
  2017: '짝수', 2018: '짝수', 2019: '짝수', 2020: '짝수', 2021: '짝수', 2022: '짝수',
  2023: '홀수', 2024: '홀수',
  2025: '짝수',
  2026: '홀수',
}

const CIRCLED = { '①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5 }

/**
 * `1③ 2   13 ②  3   …` 형태에서 (번호, 정답, 배점) 삼중쌍을 모두 뽑는다.
 *
 * ⚠️ **복수정답이 있다.** 2015 #25 는 `25 ④, ⑤ 2` 로 두 답이 인정됐다(이의신청 결과).
 *    한 답만 받는 정규식을 쓰면 그 문항이 통째로 누락되고, 더 나쁘게는 한 답만 정답으로
 *    잡아 오답 분석이 오염된다. 답을 배열로 받는다.
 */
function parseTable(text) {
  const out = new Map()
  const re = /(\d{1,2})\s*([①②③④⑤](?:\s*,\s*[①②③④⑤])*)\s+([23])(?!\d)/g
  let m
  while ((m = re.exec(text)) !== null) {
    const no = Number(m[1])
    if (no < 1 || no > 45) continue
    if (out.has(no)) continue
    const picks = [...m[2].matchAll(/[①②③④⑤]/g)].map((x) => CIRCLED[x[0]])
    out.set(no, { answer: picks[0], answers: picks, points: Number(m[3]) })
  }
  return out
}

/** 정답표는 한 PDF 에 홀수형·짝수형이 이어 붙어 있다. 형 표시로 구간을 자른다. */
function splitForms(text) {
  const marks = []
  const re = /\(\s*(홀수|짝수)\s*\)\s*형/g
  let m
  while ((m = re.exec(text)) !== null) marks.push({ form: m[1], at: m.index })
  if (!marks.length) return { 단일: text }
  const out = {}
  for (let i = 0; i < marks.length; i++) {
    const end = i + 1 < marks.length ? marks[i + 1].at : text.length
    out[marks[i].form] = text.slice(marks[i].at, end)
  }
  return out
}

const files = fs.readdirSync(SRC).filter((f) => /정답표.*\.pdf$/i.test(f)).sort()
const answers = []
const report = []

for (const f of files) {
  const year = f.slice(0, 4)
  // 2014 는 수준별 A/B 두 파일이다
  const examId = /2014/.test(f) ? (/_A형/.test(f) ? '2014A' : '2014B') : year
  const out = path.join(TMP, f.replace(/[^\w.]/g, '_') + '.txt')
  try {
    execFileSync('pdftotext', ['-enc', 'UTF-8', '-layout', path.join(SRC, f), out], { stdio: 'ignore' })
  } catch { /* 한글 CMap 경고로 0 이 아닌 코드를 낼 수 있다 — 파일이 생겼으면 계속한다 */ }
  if (!fs.existsSync(out)) {
    report.push({ exam: examId, file: f, error: '추출 실패' })
    continue
  }
  const text = fs.readFileSync(out, 'utf8')
  const forms = splitForms(text)
  const want = FORM[examId]
  const chosen = forms[want] ?? forms['단일'] ?? Object.values(forms)[0]
  const usedForm = forms[want] ? want : Object.keys(forms)[0] ?? '단일'
  const table = parseTable(chosen)

  const missing = []
  for (let i = 1; i <= 45; i++) if (!table.has(i)) missing.push(i)
  report.push({
    exam: examId, file: f, form_wanted: want, form_used: usedForm,
    parsed: table.size, missing, forms_in_pdf: Object.keys(forms),
  })
  for (const [no, v] of table) {
    answers.push({ exam: examId, no, answer: v.answer, answers: v.answers, points: v.points, multi: v.answers.length > 1 })
  }
  console.log(
    `${examId.padEnd(6)} ${usedForm}형 ${String(table.size).padStart(2)}/45` +
      (usedForm !== want ? `  ⚠️ 원한 형은 ${want}` : '') +
      (missing.length ? `  ⚠️ 누락 ${missing.join(',')}` : ''),
  )
}

// ── 파이프라인 독립 검증 — 문제지에서 뽑은 3점 표시 vs 정답표 배점 ──────
const measuredPath = path.join(OUT_DIR, 'blueprint-measured.json')
let crosscheck = null
if (fs.existsSync(measuredPath)) {
  const measured = JSON.parse(fs.readFileSync(measuredPath, 'utf8')).measured
  const key = new Map(answers.map((a) => [`${a.exam}#${a.no}`, a]))
  let both = 0, agree = 0
  const disagree = []
  for (const q of measured) {
    const a = key.get(`${q.exam}#${q.no}`)
    if (!a) continue
    both += 1
    const fromPaper = q.high_score ? 3 : 2
    if (fromPaper === a.points) agree += 1
    else disagree.push({ exam: q.exam, no: q.no, paper: fromPaper, key: a.points })
  }
  crosscheck = { compared: both, agree, disagree }
  console.log('')
  console.log(`배점 교차검증 ${agree}/${both} = ${((100 * agree) / both).toFixed(1)}%  ·  불일치 ${disagree.length}건`)
  for (const d of disagree.slice(0, 15)) console.log(`  ${d.exam} #${d.no}  문제지 ${d.paper}점 · 정답표 ${d.key}점`)
  if (disagree.length > 15) console.log(`  … 외 ${disagree.length - 15}건`)
}

fs.mkdirSync(OUT_DIR, { recursive: true })
fs.writeFileSync(path.join(OUT_DIR, 'answers.json'), JSON.stringify({ report, crosscheck, answers }, null, 1))
console.log(`\n정답 ${answers.length}개 → ${path.join(OUT_DIR, 'answers.json')}`)
try { fs.rmSync(TMP, { recursive: true, force: true }) } catch { /* 임시 폴더는 남아도 무해 */ }
