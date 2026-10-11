// scripts/csat/inquiry-drain-validate.mjs
//
// **탐구 데이터 검증기 — 형식만이 아니라 내용을 대조한다.** (vNext2 · inquiry v1)
// 형식 검증만 주면 작성 에이전트가 지름길로 통과한다(2026-10 실측 4/4) — 그래서 아래를 원문과 맞춘다:
//   · 정답이 아닌 선지 전부가 정확히 한 번씩 · 정답 번호는 없음
//   · truth 가 유형 계약(distractors_are_true)과 맞음 · false 오답은 유지/변경 성분이 다 있음
//   · 영어 인용(from · text)은 지문 문장에, 영어 to 는 그 선지에 그대로 있음 · 8단어 이하
//   · 원리: 조건부(when_applies · when_not 각 1~3) · 보편 법칙/내부 사고 단정 금지 · statement 와 경계가 같은 말 아님
//   · analysis_version 이 청크 입력과 같음
//
//   node scripts/csat/inquiry-drain-validate.mjs --chunk inq-01     (한 청크)
//   node scripts/csat/inquiry-drain-validate.mjs --all              (출력이 있는 모든 청크)
// 종료 코드: 오류가 하나라도 있으면 1. 재실행 안전(읽기만).

import fs from 'node:fs'
import path from 'node:path'

const WORK = path.resolve('scripts/csat/inquiry-drain')
export const COMPONENTS = ['대상', '관계', '극성', '범위', '시점', '강도', '수치', '역할', '위치', '형태', '화자', '인과 방향']
export const OPERATIONS = [
  'paraphrase', 'abstraction', 'compression', 'inference', 'polarity', 'scope', 'agent', 'reference', 'temporal',
  'degree', 'causal_direction', 'syntactic_form', 'order', 'numeric_relation', 'unsupported', 'none',
]
const WORD_SET_TYPES = new Set(['R-BLANK', 'R-BLANK2', 'R-SUMMARY', 'R-VOCAB', 'R-GRAMMAR', 'X-BLANK', 'X-BLANK2'])
const BANNED = /항상|무조건|반드시|출제자(는|가)[^.]{0,20}(생각|의도했|노렸)/
const LATIN = /[A-Za-z]{2,}/
const norm = (s) => String(s ?? '').toLowerCase().replace(/[‘’']/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim()
const words = (s) => norm(s).split(' ').filter(Boolean).length
const choiceText = (c) => (typeof c === 'string' ? c : (c?.text ?? JSON.stringify(c ?? '')))

export function validateItem(input, out) {
  const errs = []
  const e = (m) => errs.push(`${input.id}: ${m}`)
  if (!out) return [`${input.id}: 출력 없음`]
  if (out.analysis_version !== input.analysis_version) e(`analysis_version ${out.analysis_version} ≠ 입력 ${input.analysis_version}`)
  if (!['ok', 'needs_review', 'needs_source'].includes(out.status)) e(`status 값 ${out.status}`)
  if (out.status !== 'ok') {
    if (!String(out.review_note ?? '').trim()) e('needs_* 인데 review_note 없음')
    if (out.status === 'needs_source') return errs
  }
  const passage = norm(input.sentences.map((s) => s.text).join(' '))
  const choices = (input.choices ?? []).map(choiceText)
  const expected = choices.map((_, i) => i + 1).filter((n) => n !== input.answer)
  const got = (out.distractors ?? []).map((d) => d.n)
  if (input.answer != null && got.includes(input.answer)) e(`정답 번호 ${input.answer} 가 distractors 에 있음`)
  const missing = expected.filter((n) => !got.includes(n))
  if (missing.length) e(`빠진 선지 ${missing.join(',')}`)
  if (new Set(got).size !== got.length) e('같은 선지 번호가 두 번')

  for (const d of out.distractors ?? []) {
    const tag = `선지 ${d.n}`
    const want = input.slot_type ? ['not_applicable', 'unknown'] : input.distractors_are_true ? ['true', 'unknown'] : ['false', 'unknown']
    if (!want.includes(d.truth)) e(`${tag} truth=${d.truth} — 이 유형은 ${want.join('/')}`)
    if (!OPERATIONS.includes(d.operation)) e(`${tag} operation 값 ${d.operation}`)
    if (!String(d.note ?? '').trim() || String(d.note).length < 12) e(`${tag} note 가 비었거나 너무 짧음`)
    if (BANNED.test(d.note ?? '')) e(`${tag} note 에 금지 표현`)
    const pres = Array.isArray(d.preserved) ? d.preserved : []
    const alt = Array.isArray(d.altered) ? d.altered : []
    if (d.truth === 'false') {
      if (!alt.length) e(`${tag} 거짓 오답인데 altered 없음`)
      // 낱말 묶음 선지(빈칸 · 요약 · 낱말 상자)에서 모든 칸이 틀리면 남은 성분이 없다 — 그때만 빈 preserved 를 허용한다(note 에 밝힌다)
      if (!pres.length && !(WORD_SET_TYPES.has(input.type_id) && /남은 지문 성분이 없/.test(d.note ?? ''))) e(`${tag} 거짓 오답인데 preserved 없음`)
      if (d.operation === 'none') e(`${tag} 거짓 오답인데 operation=none`)
    }
    if (d.truth === 'not_applicable' && !['order', 'reference', 'none'].includes(d.operation)) e(`${tag} 위치·지칭 선지인데 operation=${d.operation}`)
    if (d.truth === 'true') {
      if (alt.length) e(`${tag} 맞는 선지에 altered 를 지어냄`)
      if (d.operation !== 'none') e(`${tag} 맞는 선지인데 operation=${d.operation}`)
    }
    const myChoice = norm(choices[d.n - 1] ?? '')
    for (const p of pres) {
      if (!COMPONENTS.includes(p.component)) e(`${tag} preserved component 값 ${p.component}`)
      if (!String(p.text ?? '').trim()) e(`${tag} preserved text 비어 있음`)
      if (LATIN.test(p.text ?? '') && words(p.text) > 8) e(`${tag} preserved 영어 인용 8단어 초과`)
      if (LATIN.test(p.text ?? '') && !passage.includes(norm(p.text)) && !myChoice.includes(norm(p.text))) e(`${tag} preserved 인용 「${p.text}」 이 지문 · 선지에 없음`)
    }
    for (const a of alt) {
      if (!COMPONENTS.includes(a.component)) e(`${tag} altered component 값 ${a.component}`)
      if (!String(a.from ?? '').trim() || !String(a.to ?? '').trim()) e(`${tag} altered from/to 비어 있음`)
      if (norm(a.from) === norm(a.to)) e(`${tag} altered from 과 to 가 같음`)
      for (const [k, v] of [['from', a.from], ['to', a.to]]) {
        if (!LATIN.test(v ?? '')) continue
        if (words(v) > 8) e(`${tag} altered ${k} 영어 인용 8단어 초과`)
        const hay = k === 'from' ? passage : myChoice
        if (v !== '(지문에 없음)' && !hay.includes(norm(v))) e(`${tag} altered ${k} 인용 「${v}」 이 ${k === 'from' ? '지문' : '그 선지'}에 없음`)
      }
    }
  }

  const pr = out.principle
  if (!pr || typeof pr !== 'object') e('principle 없음')
  else {
    if (!String(pr.statement ?? '').trim() || pr.statement.length < 15) e('principle.statement 비었거나 너무 짧음')
    for (const k of ['when_applies', 'when_not']) {
      const v = pr[k]
      if (!Array.isArray(v) || v.length < 1 || v.length > 3) e(`principle.${k} 는 1~3개`)
      else if (v.some((x) => !String(x ?? '').trim() || String(x).length < 8)) e(`principle.${k} 에 빈/짧은 항목`)
    }
    const all = [pr.statement, ...(pr.when_applies ?? []), ...(pr.when_not ?? [])].join(' ')
    if (BANNED.test(all)) e('principle 에 금지 표현(보편 법칙 · 출제자 내부 사고 단정)')
    if ((pr.when_applies ?? []).some((x) => (pr.when_not ?? []).some((y) => norm(x) === norm(y)))) e('when_applies 와 when_not 이 같은 항목')
    if ((pr.when_not ?? []).some((y) => norm(y) === norm(pr.statement))) e('when_not 이 statement 를 반복')
  }
  return errs
}

export function validateChunk(name) {
  const input = JSON.parse(fs.readFileSync(path.join(WORK, `chunk-${name}.json`), 'utf8'))
  const outPath = path.join(WORK, `chunk-${name}.out.json`)
  if (!fs.existsSync(outPath)) return { name, errors: [`${name}: 출력 파일 없음`], n: input.items.length }
  const out = JSON.parse(fs.readFileSync(outPath, 'utf8'))
  const byId = new Map((out.items ?? []).map((r) => [r.id, r]))
  const errors = input.items.flatMap((it) => validateItem(it, byId.get(it.id)))
  const extra = [...byId.keys()].filter((id) => !input.items.some((it) => it.id === id))
  if (extra.length) errors.push(`${name}: 입력에 없는 문항 ${extra.join(',')}`)
  return { name, errors, n: input.items.length, statuses: [...byId.values()].reduce((m, r) => ((m[r.status] = (m[r.status] ?? 0) + 1), m), {}) }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
  const i = process.argv.indexOf('--chunk')
  const names =
    i >= 0
      ? [process.argv[i + 1]]
      : fs.readdirSync(WORK).filter((f) => /^chunk-inq-\d+\.out\.json$/.test(f)).map((f) => f.replace(/^chunk-|\.out\.json$/g, ''))
  let bad = 0
  for (const name of names.sort()) {
    const r = validateChunk(name)
    bad += r.errors.length
    console.log(`${name}: 문항 ${r.n} · 오류 ${r.errors.length}${r.statuses ? ` · ${JSON.stringify(r.statuses)}` : ''}`)
    for (const x of r.errors.slice(0, 40)) console.log(`  - ${x}`)
  }
  process.exit(bad ? 1 : 0)
}
