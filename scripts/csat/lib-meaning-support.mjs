// scripts/csat/lib-meaning-support.mjs
//
// **v3.1 원문 이해 교수 sidecar — 공용 순수 함수.** (C1 · docs/csat-learner/v31/MEANING_SUPPORT_DESIGN.md §5)
//
// 기존 inquiry v3 를 다시 쓰지 않는 **별도 데이터**다. 이 모듈은 파일을 읽지 않는다(빌드 · CI 가드 · 테스트가 공유).
//   - canonicalJson / sha256Hex — 객체 키 재귀 정렬 · 배열 순서 유지 · 문자열 원형 보존(문자열 정규화 없음)
//   - basePublicHash(record) — **배포된 inquiry-data.json 의 그 문항 전체 레코드**의 직접 해시(작성 결과 contentHash 와 다른 값)
//   - supportContentHash(support) — 검수 대상 교수 설명 본문의 해시(검수 메타 · writer_run 제외)
//   - validateSupport(support, ctx) — 형식 · 참조 · 결속 · 인용 예산 오류 목록(빈 배열 = 기계 검증 통과. 의미 정확성은 독립 검수 몫)
//   - quoteBaseline(input, record) — 기존 공개 v3.expression 의 인용 기준선(단어 수 · 중복 제거 구간 · 원문 대비 비율)
// 웹 서버의 같은 해시는 apps/web/src/lib/csat/meaning-support/model.ts 가 같은 규칙으로 구현하고, 동치 회귀가 전 문항으로 대조한다.

import { createHash } from 'node:crypto'

export const SCHEMA = 'meaning-support/1'
export const MS_CRITERIA_VERSION = 'meaning-support-v1.0'
export const DEPTHS = ['brief', 'why', 'deep']
export const FACETS = ['agent', 'polarity', 'condition', 'quantity', 'modality', 'time', 'reference', 'causality', 'comparison']
export const BASES = ['source_observation', 'bridging_inference', 'explanatory_elaboration']
export const ROLES = ['main', 'modifier', 'clause', 'connector']
export const RELATION_KINDS = ['add', 'example', 'contrast', 'concession', 'cause', 'condition', 'reference', 'temporal', 'purpose', 'other']
export const GENRES = ['argument', 'expository', 'narrative', 'practical', 'visual']
export const WRITER_STATUSES = ['ok', 'needs_source', 'needs_review', 'not_applicable']
const MAX_QUOTE_WORDS = 8

/** 키 재귀 정렬 · 배열 순서 유지 · undefined 키 생략 · 문자열은 JSON.stringify 그대로(원형 보존) */
export function canonicalJson(v) {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`
  if (v && typeof v === 'object') {
    return `{${Object.keys(v)
      .filter((k) => v[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(v[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(v)
}
export const sha256Hex = (s) => createHash('sha256').update(s, 'utf8').digest('hex')

/** 배포된 inquiry 레코드(analysis_version · review · distractors · principle · v3) 전체의 직접 해시. 필드를 생략하지 않는다 */
export const basePublicHash = (record) => sha256Hex(canonicalJson(record))

/** 교수 설명 본문 해시 — 공개 칸 + 결속. 작성 메모 · writer_run · status 사유는 뺀다(문체 메모가 검수를 깨지 않게) */
export function supportContentHash(s) {
  const body = {
    schema: s.schema, itemId: s.itemId, binding: s.binding, sourceRef: s.sourceRef, defaultUnitId: s.defaultUnitId,
    anchors: s.anchors, propositions: s.propositions, units: s.units, relations: s.relations, whole: s.whole, bridges: s.bridges,
    partial: s.partial ?? undefined,
  }
  return sha256Hex(canonicalJson(body)).slice(0, 16)
}

/** 원문 입력 스냅숏 해시 — 원문 · 발문 · 선지 · 도표 확인 상태(원문 본문은 산출물에 넣지 않고 해시만) */
export function sourceSnapshotHash(input, { chartChecked = false } = {}) {
  return sha256Hex(canonicalJson({
    id: input.id, stem: input.stem ?? '', sentences: (input.sentences ?? []).map((s) => ({ n: s.n, text: s.text })),
    choices: (input.choices ?? []).map((c) => (typeof c === 'string' ? c : c?.text ?? '')), chartChecked,
  })).slice(0, 16)
}

/** 공백 정규화(연속 공백 → 한 칸 · 양끝 trim) — sourceRange 기준 문자열 */
export const normSpace = (t) => String(t ?? '').replace(/\s+/g, ' ').trim()
const normQuote = (t) => normSpace(t).replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
const words = (t) => normSpace(t).split(' ').filter(Boolean).length
const nthIndex = (hay, needle, n) => {
  let i = -1
  for (let k = 0; k < n; k++) { i = hay.indexOf(needle, i + 1); if (i < 0) return -1 }
  return i
}

/** 기존 공개 v3.expression 인용 기준선 — 문항별 단어 수 · 문장별 중복 제거 구간 · 원문 대비 비율(원문 본문은 내보내지 않는다) */
export function quoteBaseline(input, record) {
  const exprs = (record?.v3?.meanings ?? []).map((m) => ({ text: normQuote(m.expression), sentences: m.sentences }))
  const spans = new Map() // 문장 n → [start,end][]
  let totalWords = 0
  for (const e of exprs) {
    totalWords += words(e.text)
    for (const n of e.sentences) {
      const s = normQuote(input.sentences.find((x) => x.n === n)?.text ?? '')
      const at = s.indexOf(e.text)
      if (at < 0) continue
      const list = spans.get(n) ?? []
      list.push([at, at + e.text.length])
      spans.set(n, list)
    }
  }
  let covered = 0
  for (const list of spans.values()) {
    list.sort((a, b) => a[0] - b[0])
    let [cs, ce] = [-1, -1]
    for (const [s, e] of list) {
      if (s > ce) { if (ce > cs) covered += ce - cs; [cs, ce] = [s, e] } else ce = Math.max(ce, e)
    }
    if (ce > cs) covered += ce - cs
  }
  const passageChars = input.sentences.reduce((a, s) => a + normQuote(s.text).length, 0)
  return { expressions: exprs.length, quoteWords: totalWords, coveredChars: covered, passageChars, ratio: passageChars ? +(covered / passageChars).toFixed(4) : 0 }
}

const txt = (v) => typeof v === 'string' && v.trim().length > 0
const arr = (v) => (Array.isArray(v) ? v : [])

/**
 * 형식 · 참조 · 결속 · 인용 예산 검증. ctx: { input?(원문 입력 — 있으면 원문 대조), record(배포 inquiry 레코드) }
 * 반환: 오류 문자열 배열(빈 배열 = 기계 검증 통과)
 */
export function validateSupport(s, { input = null, record = null } = {}) {
  const errs = []
  const e = (m) => errs.push(`${s?.itemId ?? '?'}: ${m}`)
  if (!s || s.schema !== SCHEMA) return [`${s?.itemId ?? '?'}: schema ${s?.schema} — ${SCHEMA} 만`]
  if (!txt(s.itemId)) e('itemId 없음')
  if (!record) e('배포 inquiry 레코드 없음(공개 base 없이 sidecar 불가)')
  const v3 = record?.v3
  // 결속
  const b = s.binding ?? {}
  if (record && b.analysisVersion !== record.analysis_version) e(`binding.analysisVersion ${b.analysisVersion} ≠ ${record.analysis_version}`)
  if (v3 && b.unitsHash !== v3.units_hash) e('binding.unitsHash ≠ 공개 units_hash')
  if (record && b.basePublicHash !== basePublicHash(record)) e('binding.basePublicHash ≠ 배포 레코드 직접 해시')
  if (!txt(b.sourceSnapshotHash)) e('binding.sourceSnapshotHash 없음')
  if (input && b.sourceSnapshotHash !== sourceSnapshotHash(input, { chartChecked: Boolean(s.sourceRef?.chartChecked) })) e('binding.sourceSnapshotHash ≠ 원문 입력')
  const sr = s.sourceRef ?? {}
  if (sr.organizer !== 'kice' || !txt(sr.examId) || !Number.isInteger(sr.itemNo) || !txt(sr.inputRef)) e('sourceRef 불완전(organizer=kice · examId · itemNo · inputRef)')

  const nSent = input ? input.sentences.length : null
  const okSent = (n) => Number.isInteger(n) && n >= 1 && (nSent == null || n <= nSent)
  const exprs = arr(v3?.meanings).map((m) => normQuote(m.expression))
  const meaningIds = new Set(arr(v3?.meanings).map((m) => m.id))
  const ids = new Set()
  const uniq = (kind, id) => { if (!txt(id)) e(`${kind} id 없음`); else if (ids.has(id)) e(`id 중복 ${id}`); ids.add(id) }

  // anchors — 실제 원문에만. quote 는 기존 공개 expression 의 연속 부분 · 8단어 이하 · 새 영어 구간 0
  const anchorIds = new Set()
  for (const a of arr(s.anchors)) {
    uniq('anchor', a.id); anchorIds.add(a.id)
    if (a.mode !== 'original') e(`${a.id} mode ${a.mode} — original 만`)
    if (!okSent(a.sentence)) e(`${a.id} sentence ${a.sentence} 범위 밖`)
    if (!a.quote && !a.sourceRange) e(`${a.id} quote · sourceRange 둘 다 없음`)
    if (a.quote != null) {
      const q = normQuote(a.quote)
      if (!q) e(`${a.id} quote 빔`)
      if (words(q) > MAX_QUOTE_WORDS) e(`${a.id} quote ${words(q)}단어 — ${MAX_QUOTE_WORDS}단어 이하`)
      if (!exprs.some((x) => x.includes(q))) e(`${a.id} quote 「${a.quote}」 가 기존 공개 expression 의 연속 구절이 아님(새 영어 인용 금지)`)
      if (input) {
        const sent = normQuote(input.sentences.find((x) => x.n === a.sentence)?.text ?? '')
        const occ = a.occurrence ?? 1
        if (nthIndex(sent, q, occ) < 0) e(`${a.id} quote 가 ${a.sentence}번 문장 ${occ}번째 등장에 없음`)
      }
    }
    if (a.sourceRange) {
      const { start, end, spanHash } = a.sourceRange
      if (!(Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end > start) || !txt(spanHash)) e(`${a.id} sourceRange 형식`)
      else if (input) {
        const sent = normSpace(input.sentences.find((x) => x.n === a.sentence)?.text ?? '')
        if (end > sent.length || sha256Hex(sent.slice(start, end)) !== spanHash) e(`${a.id} sourceRange 구간 해시가 원문과 다름`)
      }
    }
  }
  const refAnchors = (where, list) => { for (const id of arr(list)) if (!anchorIds.has(id)) e(`${where} 의 anchor ${id} 없음(dangling)`) }

  const propIds = new Set()
  for (const p of arr(s.propositions)) {
    uniq('proposition', p.id); propIds.add(p.id)
    if (!txt(p.textKo)) e(`${p.id} textKo 빔`)
    if (!BASES.includes(p.basis)) e(`${p.id} basis ${p.basis}`)
    refAnchors(p.id, p.anchorIds)
    if (p.basis !== 'source_observation' && (!arr(p.warrantsKo).filter(txt).length || !txt(p.limitKo))) e(`${p.id} 추론 · 확장은 warrantsKo 와 limitKo 필수`)
  }
  const refProps = (where, list) => { for (const id of arr(list)) if (!propIds.has(id)) e(`${where} 의 proposition ${id} 없음`) }

  const unitIds = new Set()
  const units = arr(s.units)
  if (units.length < 1) e('units 없음')
  for (const u of units) {
    uniq('unit', u.id); unitIds.add(u.id)
    if (!arr(u.sentences).length || !arr(u.sentences).every(okSent)) e(`${u.id} sentences 범위 밖/빔`)
    for (const m of arr(u.legacyMeaningIds)) if (!meaningIds.has(m)) e(`${u.id} legacyMeaningId ${m} 가 공개 v3 에 없음`)
    for (const k of ['labelKo', 'exactKo', 'simpleKo']) if (!txt(u[k])) e(`${u.id} ${k} 빔`)
    refProps(u.id, u.propositionIds)
    for (const pr of arr(u.preserves)) {
      if (!FACETS.includes(pr.facet)) e(`${u.id} preserves facet ${pr.facet}`)
      if (!txt(pr.valueKo) || !txt(pr.explanationKo)) e(`${u.id} preserves 빈 값`)
      refAnchors(`${u.id}.preserves`, pr.anchorIds)
    }
    if (u.syntax) {
      const partIds = new Set()
      for (const part of arr(u.syntax.parts)) {
        if (!txt(part.id) || partIds.has(part.id)) e(`${u.id} syntax part id`)
        partIds.add(part.id)
        if (!ROLES.includes(part.role)) e(`${u.id} syntax role ${part.role}`)
        if (!txt(part.meaningKo)) e(`${u.id} syntax part 뜻 빔`)
        refAnchors(`${u.id}.syntax`, part.anchorIds)
      }
      for (const at of arr(u.syntax.attachments)) if (!partIds.has(at.fromPart) || !partIds.has(at.toPart) || !txt(at.whyKo)) e(`${u.id} syntax attachment 참조/이유`)
      if (!txt(u.syntax.recombinedKo)) e(`${u.id} syntax recombinedKo 빔`)
      if (u.syntax.correction && (!txt(u.syntax.correction.form) || !txt(u.syntax.correction.explanationKo))) e(`${u.id} correction 불완전`)
    }
    if (u.misunderstanding) {
      const mu = u.misunderstanding
      if (!txt(mu.alteredKo) || !txt(mu.whyWrongKo) || !FACETS.includes(mu.lostFacet)) e(`${u.id} misunderstanding 불완전`)
      refAnchors(`${u.id}.misunderstanding`, mu.anchorIds)
    }
  }
  if (!unitIds.has(s.defaultUnitId)) e(`defaultUnitId ${s.defaultUnitId} 가 units 에 없음`)

  const relIds = new Set()
  for (const r of arr(s.relations)) {
    uniq('relation', r.id); relIds.add(r.id)
    if (!RELATION_KINDS.includes(r.kind)) e(`${r.id} kind ${r.kind}`)
    if (!arr(r.from).length || !arr(r.to).length) e(`${r.id} from/to 빔`)
    for (const id of [...arr(r.from), ...arr(r.to)]) if (!unitIds.has(id)) e(`${r.id} 의 unit ${id} 없음`)
    for (const k of ['beforeKo', 'afterKo', 'changeKo']) if (!txt(r[k])) e(`${r.id} ${k} 빔`)
    if (!BASES.includes(r.basis)) e(`${r.id} basis ${r.basis}`)
    if (r.basis !== 'source_observation' && (!arr(r.warrantsKo).filter(txt).length || !txt(r.limitKo))) e(`${r.id} 추론 관계는 warrantsKo 와 limitKo 필수`)
    refProps(r.id, r.propositionIds); refAnchors(r.id, r.anchorIds)
  }

  const w = s.whole ?? {}
  if (!GENRES.includes(w.genre)) e(`whole.genre ${w.genre}`)
  if (!txt(w.summaryKo)) e('whole.summaryKo 빔')
  refProps('whole', w.propositionIds)
  for (const id of arr(w.relationIds)) if (!relIds.has(id)) e(`whole 의 relation ${id} 없음`)

  const nClaims = arr(v3?.design?.claims).length
  for (const br of arr(s.bridges)) {
    if (!unitIds.has(br.unitId)) e(`bridge unit ${br.unitId} 없음`)
    for (const m of arr(br.meaningIds)) if (!meaningIds.has(m)) e(`bridge meaningId ${m} 가 공개 v3 에 없음`)
    for (const c of arr(br.choiceNumbers)) {
      if (!Number.isInteger(c) || c < 1 || c > 5) e(`bridge choice ${c} 범위 밖`)
      else if (v3 && !arr(v3.choices).some((x) => x.n === c && arr(x.meaning_ids).some((m) => arr(br.meaningIds).includes(m)))) e(`bridge 선지 ${c} 가 그 의미(meaning_ids)와 실제로 연결돼 있지 않음`)
    }
    for (const d of arr(br.designClaimIndices)) if (!Number.isInteger(d) || d < 0 || d >= nClaims) e(`bridge designClaimIndex ${d} 범위 밖`)
  }
  // 부분 공개(도표 등) — 공개하지 않는 부분은 사유가 있어야 한다
  if (s.partial != null && (!txt(s.partial.withheldKo) || !Array.isArray(s.partial.scope))) e('partial 은 withheldKo 와 scope 필수')
  // 금지 표현 — 출제자 내부 사고 단정 · 보편 단정
  const all = JSON.stringify([units, s.relations, s.whole, s.propositions])
  if (/출제자(는|가)[^.]{0,20}(생각|의도했|노렸)|항상|반드시|모든 문항/.test(all)) e('출제자 내부 사고 단정 · 보편 단정 표현')
  return errs
}

/** 공개 인용 합집합이 기준선(기존 expression 구간)의 부분집합인가 — validateSupport 의 quote 검사를 문항 단위로 묶은 요약 */
export function quoteUsage(s) {
  const qs = new Set(arr(s.anchors).filter((a) => a.quote).map((a) => normQuote(a.quote)))
  return { distinctQuotes: qs.size, quoteWords: [...qs].reduce((n, q) => n + words(q), 0) }
}

/**
 * 공개 판정(순수) — 빌드와 CI 가드가 같은 규칙을 쓴다.
 * @param out      작성 결과 { writer_run, status, support }
 * @param verdicts 이 문항 판정들 [{ verdict: pass|revise|hold, reviewer, content_hash, criteria }]
 * @param record   지금 배포된 inquiry 레코드
 * @param classify lib-inquiry-review.classifyReview (주입 — 순환 import 회피)
 * @returns {{ state: 'public'|'stale'|'review_hold'|'revise'|'unreviewed'|'not_ok', reason: string, hash?: string }}
 */
export function decidePublic(out, verdicts, record, classify) {
  if (!out || out.status !== 'ok' || !out.support) return { state: 'not_ok', reason: `작성 상태 ${out?.status}` }
  const s = out.support
  if (!record || s.binding?.analysisVersion !== record.analysis_version || s.binding?.unitsHash !== record.v3?.units_hash || s.binding?.basePublicHash !== basePublicHash(record)) {
    return { state: 'stale', reason: '배포 base 결속 불일치' }
  }
  const hash = supportContentHash(s)
  const bound = (verdicts ?? []).filter((v) => v.content_hash === hash)
  if (bound.some((v) => v.verdict === 'hold')) return { state: 'review_hold', reason: '현재 내용에 hold', hash }
  const folded = (verdicts ?? []).map((v) => ({ ...v, verdict: v.verdict === 'hold' ? 'revise' : v.verdict }))
  const c = classify({ ...s, writer_run: out.writer_run }, folded, { criteria: MS_CRITERIA_VERSION, hashOf: supportContentHash })
  if (c.state === 'revise') return { state: 'revise', reason: c.reason, hash }
  if (c.state !== 'verified') return { state: 'unreviewed', reason: c.reason, hash }
  return { state: 'public', reason: c.reason, hash }
}
