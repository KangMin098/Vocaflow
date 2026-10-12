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
// 낱말 묶음 선지 — 심경(R-MOOD)도 두 낱말 쌍이라 둘 다 틀리면 남은 지문 성분이 없다(2026-10-12 rv-v3-12 · 2019#19)
const WORD_SET_TYPES = new Set(['R-BLANK', 'R-BLANK2', 'R-SUMMARY', 'R-VOCAB', 'R-GRAMMAR', 'R-MOOD', 'X-BLANK', 'X-BLANK2'])
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
    // v3 가 붙은 문항은 「내용은 지문과 맞지만 요구를 충족하지 못하는」 비선정 선지를 v1 에서도 true 로 쓸 수 있다(요지 · 주제류) —
    // v1 의 false 강제가 v3 판정과 충돌한 결함(2026-10-12 검수 rv-v3-02). 대신 v1 · v3 의 내용 판정이 같아야 한다(validateV3 일관성 검사).
    const v3True = Boolean(out.v3) && !input.slot_type
    const want = input.slot_type ? ['not_applicable', 'unknown'] : input.distractors_are_true || v3True ? ['true', 'false', 'unknown'].filter((t) => input.distractors_are_true ? t !== 'false' : true) : ['false', 'unknown']
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
    // 부정형 선택 유형의 맞는 선지는 왜곡을 지어내지 않는다. v3 문항의 「내용 참 · 요구 미충족」은 범위 · 추상 수준 같은 바뀐 조건을 적을 수 있다
    if (d.truth === 'true' && input.distractors_are_true) {
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

// ── v3 칸(의미 · 판단 · 설계) — WRITER_V3.md · docs/csat-learner/v3/CSAT_REASONING_DATA_V3.md §3 ──
export const SCOPE_KINDS = ['negation', 'condition', 'agent', 'time', 'quantity', 'contrast', 'reference', 'none']
// 부정 · 제한 낱말(어휘적 부정 포함) — 부정 범위 인용 검사용
const NEG_WORD = /\b(not|no|never|nor|none|nothing|nobody|neither|without|cannot|hardly|rarely|rare|seldom|little|few|fail\w*|lack\w*|unless|absence|absent|missing|myth|too|only|unlikely|impossible|unknown|unfit|nonsensical|non-\w+|un\w+able|eliminat\w*|interfer\w*|declin\w*|beyond|unnecessary|give up)\b|n['’]t\b/i
export const BASES =['official', 'source_observation', 'design_hypothesis']

export function validateV3(input, out) {
  const errs = []
  const e = (m) => errs.push(`${input.id}: v3 ${m}`)
  if (!out || out.status !== 'ok') return errs
  const v = out.v3
  if (!v || typeof v !== 'object') return [`${input.id}: v3 없음`]
  if (v.units_hash !== input.units_hash) e(`units_hash ${v.units_hash} ≠ 입력 ${input.units_hash}`)
  const nSent = input.sentences.length
  const okSent = (arr) => Array.isArray(arr) && arr.length > 0 && arr.every((n) => Number.isInteger(n) && n >= 1 && n <= nSent)
  const sentText = (n) => norm(input.sentences.find((s) => s.n === n)?.text ?? '')
  const r = v.requirement
  if (!r || !String(r.requested ?? '').trim()) e('requirement.requested 없음')
  else {
    if (!['positive', 'negative'].includes(r.polarity)) e(`requirement.polarity ${r.polarity}`)
    if (!Array.isArray(r.conditions) || r.conditions.length < 1 || r.conditions.length > 3) e('requirement.conditions 는 1~3개')
  }
  const meanings = Array.isArray(v.meanings) ? v.meanings : []
  if (meanings.length < 2 || meanings.length > 6) e(`meanings ${meanings.length}개 — 2~6개`)
  const ids = new Set()
  for (const m of meanings) {
    if (!m.id || ids.has(m.id)) e(`meaning id 비었거나 중복 ${m.id}`)
    ids.add(m.id)
    if (!okSent(m.sentences)) e(`${m.id} sentences 범위 밖/비어 있음`)
    if (!String(m.meaning_ko ?? '').trim() || m.meaning_ko.length < 8) e(`${m.id} meaning_ko 비었거나 짧음`)
    if (!SCOPE_KINDS.includes(m.scope?.kind)) e(`${m.id} scope.kind ${m.scope?.kind}`)
    if (m.scope?.kind !== 'none' && !String(m.scope?.note ?? '').trim()) e(`${m.id} scope.note 없음`)
    const ex = String(m.expression ?? '')
    if (!ex.trim()) e(`${m.id} expression 없음`)
    else {
      if (words(ex) > 8) e(`${m.id} expression 8단어 초과`)
      // 인용은 그 문장(들)에 그대로 있어야 한다 — 다른 문장 · 지어낸 영어를 의미 주석으로 위장하지 않는다
      if (okSent(m.sentences) && !m.sentences.some((n) => sentText(n).includes(norm(ex)))) e(`${m.id} expression 「${ex}」 이 ${m.sentences.join(',')}번 문장에 없음`)
      // 부정 범위는 부정어가 인용 안에 있거나, note 가 그 문장에 실제로 있는 부정어를 영어로 짚어야 한다 —
      // 8단어로 줄이다 not · only 가 인용 밖으로 빠진 결함(2026-10-12 rv-v3-3738 · 2526, 전량 323건 중 6건)
      if (m.scope?.kind === 'negation' && !NEG_WORD.test(ex)) {
        const sent = (m.sentences ?? []).map(sentText).join(' ')
        const cited = (String(m.scope?.note ?? '').match(/[A-Za-z][A-Za-z’'-]*/g) ?? []).some((w) => NEG_WORD.test(w) && sent.toLowerCase().includes(norm(w).toLowerCase()))
        if (!cited) e(`${m.id} 부정 범위인데 인용 「${ex}」 에 부정어가 없고 note 도 문장의 부정어를 짚지 않음`)
      }
    }
    if (BANNED.test(`${m.meaning_ko} ${m.scope?.note ?? ''}`)) e(`${m.id} 금지 표현`)
  }
  const choices = Array.isArray(v.choices) ? v.choices : []
  const nChoices = (input.choices ?? []).length || 5
  const got = choices.map((c) => c.n).sort((a, b) => a - b)
  const want = Array.from({ length: nChoices }, (_, k) => k + 1)
  if (got.join() !== want.join()) e(`choices 는 1~${nChoices}번 전부 한 번씩 (받은 것 ${got.join(',')})`)
  for (const c of choices) {
    const tag = `선지 ${c.n}`
    if (c.selected_as_answer !== (input.answer != null && c.n === input.answer)) e(`${tag} selected_as_answer 가 공식 정답과 다름`)
    if (!['true', 'false', 'n_a', 'unknown'].includes(c.content_truth)) e(`${tag} content_truth ${c.content_truth}`)
    if (!['satisfies', 'fails', 'unknown'].includes(c.requirement_fit)) e(`${tag} requirement_fit ${c.requirement_fit}`)
    if (input.slot_type && c.content_truth !== 'n_a' && c.content_truth !== 'unknown') e(`${tag} 위치·지칭 유형인데 content_truth=${c.content_truth}`)
    if (c.selected_as_answer && c.requirement_fit === 'fails') e(`${tag} 정답인데 요구 충족 fails`)
    if (!c.selected_as_answer && c.requirement_fit === 'satisfies') e(`${tag} 비선정인데 요구 충족 satisfies`)
    if (!String(c.decisive ?? '').trim() || c.decisive.length < 12) e(`${tag} decisive 비었거나 짧음`)
    if (BANNED.test(c.decisive ?? '')) e(`${tag} decisive 금지 표현`)
    if (!okSent(c.sentences)) e(`${tag} sentences 범위 밖/비어 있음`)
    for (const id of c.meaning_ids ?? []) if (!ids.has(id)) e(`${tag} 없는 meaning_id ${id}`)
  }
  // v1 · v3 내용 판정 일관성 — 같은 문항 안에서 한 선지가 v1 은 거짓, v3 는 참이면 학습자가 모순을 본다
  const V1_OF = { true: 'true', false: 'false', n_a: 'not_applicable', unknown: 'unknown' }
  for (const c of choices) {
    const d1 = (out.distractors ?? []).find((x) => x.n === c.n)
    if (d1 && V1_OF[c.content_truth] && d1.truth !== V1_OF[c.content_truth]) e(`선지 ${c.n} 내용 판정이 v1(${d1.truth}) 과 v3(${c.content_truth}) 에서 다름`)
  }
  const d = v.design
  if (!d || !Array.isArray(d.claims) || !d.claims.length) e('design.claims 없음')
  else {
    for (const [k, c] of d.claims.entries()) {
      if (!BASES.includes(c.basis)) e(`design.claims[${k}].basis ${c.basis}`)
      if (!String(c.text ?? '').trim()) e(`design.claims[${k}].text 없음`)
      if (c.basis !== 'official' && !okSent(c.sentences)) e(`design.claims[${k}] 근거 문장 없음`)
      if (BANNED.test(c.text ?? '')) e(`design.claims[${k}] 금지 표현(보편 규칙 · 출제자 내부 사고 단정)`)
    }
    if (!d.claims.some((c) => c.basis === 'design_hypothesis')) e('design 에 설계 가설(design_hypothesis)이 없음 — 관찰만 있으면 설계 장면이 아니다')
    if (!String(d.limitation ?? '').trim()) e('design.limitation 없음')
  }
  return errs
}

export function validateChunk(name, { v3 = false } = {}) {
  const input = JSON.parse(fs.readFileSync(path.join(WORK, `chunk-${name}.json`), 'utf8'))
  const outPath = path.join(WORK, `chunk-${name}.out.json`)
  if (!fs.existsSync(outPath)) return { name, errors: [`${name}: 출력 파일 없음`], n: input.items.length }
  const out = JSON.parse(fs.readFileSync(outPath, 'utf8'))
  const byId = new Map((out.items ?? []).map((r) => [r.id, r]))
  const errors = input.items.flatMap((it) => [...validateItem(it, byId.get(it.id)), ...(v3 ? validateV3(it, byId.get(it.id)) : [])])
  const extra = [...byId.keys()].filter((id) => !input.items.some((it) => it.id === id))
  if (extra.length) errors.push(`${name}: 입력에 없는 문항 ${extra.join(',')}`)
  return { name, errors, n: input.items.length, statuses: [...byId.values()].reduce((m, r) => ((m[r.status] = (m[r.status] ?? 0) + 1), m), {}) }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
  const i = process.argv.indexOf('--chunk')
  const V3 = process.argv.includes('--v3')
  const pattern = V3 ? /^chunk-v3-\d+\.out\.json$/ : /^chunk-inq-\d+\.out\.json$/
  const names =
    i >= 0 ? [process.argv[i + 1]] : fs.readdirSync(WORK).filter((f) => pattern.test(f)).map((f) => f.replace(/^chunk-|\.out\.json$/g, ''))
  let bad = 0
  for (const name of names.sort()) {
    const r = validateChunk(name, { v3: V3 || name.startsWith('v3-') })
    bad += r.errors.length
    console.log(`${name}: 문항 ${r.n} · 오류 ${r.errors.length}${r.statuses ? ` · ${JSON.stringify(r.statuses)}` : ''}`)
    for (const x of r.errors.slice(0, 40)) console.log(`  - ${x}`)
  }
  process.exit(bad ? 1 : 0)
}
