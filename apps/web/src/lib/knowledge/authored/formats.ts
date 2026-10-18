// apps/web/src/lib/knowledge/authored/formats.ts
// FINAL §5 — 창작 산출물 **과제 형식**(능력별 채점 계약). R5 의 주장·근거 계약을 다른 능력에 복사하지 않는다:
// 형식마다 측정 능력 · 응답 모양 · 정답 조건 · 오개념(오답 설계) 분류 · 응답 뒤 해설이 다르다. 순수(DB · 시계 없음).
// 형식 id 는 DB 행 body.format 에 함께 저장된다(스키마 변경 없음) — 본문 · Gold 해시에 들어가므로 형식을 바꾸면 revision 이 바뀐다.
import { RELATIONS, type Relation } from '../claim-support-labels'
import { gradeClaimSupport, parseResponse, type ClaimSupportAnnotation } from '../claim-support'
import { PATTERNS as STRUCT_PATTERNS, ROLES as STRUCT_ROLES, gradeStructure, parseStructureResponse } from '@/lib/csat/inquiry/structure-check'
import type { PassageDesign, Pattern, Role } from '@/lib/csat/design'

export const FORMATS = ['central_meaning', 'choice_evidence', 'option_correspondence', 'contextual_sense', 'sentence_relation', 'form_scope', 'discourse_roles', 'demand_choice', 'segment_choice', 'equivalence'] as const
export type FormatId = (typeof FORMATS)[number]

/** 형식별 무엇을 재나(학습자 화면 · 승인 패킷 · 원장이 같은 문장을 쓴다) */
export const FORMAT_MEASURES: Record<FormatId, string> = {
  central_meaning: '중심과 부연을 가르고 핵심 주장을 한 줄로 압축한다 — 한 줄 요지 + 중심 문장',
  choice_evidence: '판단을 정하는 본문 근거 문장을 특정한다 — 선택 + 결정 근거 문장',
  option_correspondence: '선지가 본문의 어떤 의미를 다시 말했는지 · 바꿨는지 판정한다 — 선지별 대응 판정 + 대응 문장',
  contextual_sense: '다의어에서 이 문장에 맞는 의미를 고른다 — 문맥 의미 선택 + 근거 문장',
  sentence_relation: '인접 문장의 관계를 구성한다 — 문장 쌍마다 관계 종류',
  form_scope: '문법 형태와 그 범위를 판단한다 — 틀린 형태 + 틀린 이유',
  discourse_roles: '문장마다 하는 일(주제문 · 근거 · 예시 …)과 글 전체 전개 구조를 재구성한다 — 문장 역할 + 구조 패턴',
  demand_choice: '발문이 요구하는 판단(무엇을 · 어느 범위에서)을 정확히 말한다 — 요구 진술 선택',
  segment_choice: '문장 안에서 뼈대 · 수식 · 경계 · 구조를 찾는다 — 해당 덩어리 + 그 이유',
  equivalence: '두 표현의 의미가 같은지 · 어떤 관계인지 판단한다 — 같음 여부 + 의미 관계',
}

// ── 공통 ─────────────────────────────────────────────────────────────
export const DISTRACTOR_DESIGNS = ['opposed_view', 'too_narrow', 'off_text', 'distorted', 'reversed'] as const
export type DistractorDesign = (typeof DISTRACTOR_DESIGNS)[number]
export const SENSE_TRAPS = ['basic_meaning', 'nearby_word', 'wrong_part_of_speech', 'collocation_mismatch', 'opposite_sense'] as const
export const PAIR_RELATIONS = ['cause_effect', 'contrast', 'example', 'restatement', 'addition', 'sequence', 'conclusion'] as const
export type PairRelation = (typeof PAIR_RELATIONS)[number]
export const FORM_REASONS = ['agreement', 'tense_aspect', 'voice', 'relative_clause', 'participle', 'parallelism', 'comparison_scope', 'negation_scope', 'infinitive_gerund', 'pronoun_reference', 'inversion', 'noun_clause'] as const
export type FormReason = (typeof FORM_REASONS)[number]
export const DEMAND_TRAPS = ['wrong_operation', 'wrong_scope', 'detail_focus', 'wrong_unit', 'extra_condition'] as const
export const SEGMENT_REASONS = ['main_subject', 'main_verb', 'object', 'complement', 'modifies_noun', 'modifies_verb', 'clause_boundary', 'phrase_boundary', 'parallel_member', 'ellipsis_restored', 'inserted_clause', 'inverted_order', 'subject_and_verb', 'clause_internal'] as const
export type SegmentReason = (typeof SEGMENT_REASONS)[number]
export const SEGMENT_ASKS = ['subject', 'verb', 'attachment', 'boundary', 'structure'] as const
export const MEANING_RELATIONS = ['synonym', 'paraphrase', 'antonym', 'hypernym', 'hyponym', 'unrelated'] as const
export type MeaningRelation = (typeof MEANING_RELATIONS)[number]
export const OPTION_VERDICTS = ['matches', 'distorted', 'not_in_text', 'reversed', 'too_narrow'] as const
export type OptionVerdict = (typeof OPTION_VERDICTS)[number]

const isInt = (n: unknown, lo: number, hi: number): n is number => Number.isInteger(n) && (n as number) >= lo && (n as number) < hi
const ints = (a: unknown, lo: number, hi: number, max = 30): a is number[] => Array.isArray(a) && a.length <= max && a.every((x) => isInt(x, lo, hi)) && new Set(a).size === a.length
const sorted = (a: number[]) => [...a].sort((x, y) => x - y)

export interface Graded { response: Record<string, unknown>; grade: Record<string, unknown> & { isCorrect: boolean } }

/** 형식 계약 — 검증(오류 목록) · 채점(형식 밖 응답 = null) · 응답 뒤 해설 */
export interface FormatSpec {
  id: FormatId
  validate(body: Record<string, unknown>, gold: Record<string, unknown>): string[]
  grade(body: Record<string, unknown>, gold: Record<string, unknown>, raw: unknown, version: string): Graded | null
  reveal(gold: Record<string, unknown>): Record<string, unknown>
}

const n = (body: Record<string, unknown>) => (Array.isArray(body.sentences) ? body.sentences.length : 0)
const choicesOk = (body: Record<string, unknown>, k = 5) => Array.isArray(body.choices) && body.choices.length === k && body.choices.every((c) => typeof c === 'string' && c.length > 0)

function distractorErrors(gold: Record<string, unknown>, designs: readonly string[], k = 5): string[] {
  const d = gold.distractors as { choice: number; design: string; why: string }[] | undefined
  if (!Array.isArray(d)) return ['오답 설계가 없다']
  const want = [...Array(k).keys()].filter((i) => i !== gold.answer)
  const got = sorted(d.map((x) => x.choice))
  const out: string[] = []
  if (JSON.stringify(got) !== JSON.stringify(want)) out.push('오답 설계가 정답 외 선택지를 모두 덮지 않는다')
  if (!d.every((x) => designs.includes(x.design) && typeof x.why === 'string' && x.why.length >= 8)) out.push('오답 설계 유형/이유')
  return out
}

// ── central_meaning (R5) ─────────────────────────────────────────────
const centralMeaning: FormatSpec = {
  id: 'central_meaning',
  validate(body, g) {
    const errs: string[] = []
    const len = n(body)
    if (!choicesOk(body)) errs.push('선택지는 5개')
    const gg = g as { claim: number; claimRestated: number[]; support: number[]; supportDisputed: number[]; opposed: number[]; relationProbe: { sentence: number; relation: Relation }; answer: number; gist: string }
    const all = [gg.claim, ...gg.claimRestated, ...gg.support, ...gg.supportDisputed, ...gg.opposed, gg.relationProbe?.sentence]
    if (!all.every((k) => isInt(k, 0, len))) errs.push('문장 번호 범위 밖')
    const seen = new Set<number>([gg.claim])
    for (const b of [gg.claimRestated, gg.support, gg.supportDisputed, gg.opposed]) for (const k of b ?? []) { if (seen.has(k)) errs.push(`문장 ${k} 가 두 범주에 있다`); seen.add(k) }
    if (!gg.support?.length) errs.push('뒷받침 문장이 없다')
    if (!RELATIONS.includes(gg.relationProbe?.relation)) errs.push('관계')
    if (gg.relationProbe?.sentence === gg.claim) errs.push('관계 질문이 주장 문장을 묻는다')
    const probeIn = gg.relationProbe?.relation === 'opposed' ? gg.opposed : gg.relationProbe?.relation === 'restatement' ? gg.claimRestated : gg.support
    if (!probeIn?.includes(gg.relationProbe?.sentence)) errs.push('관계 질문 문장이 그 관계 범주에 없다')
    if (!isInt(gg.answer, 0, 5)) errs.push('정답 번호')
    if (typeof gg.gist !== 'string' || gg.gist.trim().length < 8) errs.push('한 줄 요지가 비었다')
    return [...errs, ...distractorErrors(g, DISTRACTOR_DESIGNS)]
  },
  grade(body, g, raw, version) {
    const gg = g as unknown as { answer: number; claim: number; claimRestated: number[]; support: number[]; supportDisputed: number[]; opposed: number[]; relationProbe: { sentence: number; relation: Relation }; distractors: { choice: number; design: DistractorDesign }[] }
    const ann: ClaimSupportAnnotation = {
      version, itemId: '', skeletonSig: '', sentenceCount: n(body), claim: gg.claim, claimRestated: gg.claimRestated, support: gg.support,
      // 주장 · 다시 말하기 문장은 뒷받침으로 골라도 감점하지 않는다 — 맹검 2인이 주장 문장을 서로 다르게 고른 문항이 있다(리뷰 기록)
      supportDisputed: [...gg.supportDisputed, ...gg.claimRestated, gg.claim], opposed: gg.opposed, relationProbe: gg.relationProbe,
      answerAnchorOverlap: { answerAnchorSentences: [gg.claim], note: 'authored' },
      provenance: { annotator: '', independentReviewer: '', reviewerBlind: true, agreement: '', resolved: '', reviewedAt: '' },
    }
    const cs = parseResponse(raw, ann)
    if (!cs) return null
    const choice = (raw as { choice?: unknown }).choice
    if (!isInt(choice, 0, 5)) return null
    const base = gradeClaimSupport(ann, cs)
    const choiceOk = choice === gg.answer
    // 주장을 다른 말로 다시 한 문장도 중심 문장이다 — 합리적인 해석을 오답 처리하지 않는다(FINAL §4.3)
    const centralOk = base.claimOk || gg.claimRestated.includes(cs.claim)
    return {
      response: { ...cs, choice },
      grade: { ...base, claimRestated: !base.claimOk && gg.claimRestated.includes(cs.claim), choiceOk,
        choiceDesign: choiceOk ? null : gg.distractors.find((d) => d.choice === choice)?.design ?? null, isCorrect: choiceOk && centralOk },
    }
  },
  reveal: (g) => ({ gist: g.gist, answer: g.answer, claim: g.claim, claimRestated: g.claimRestated, support: g.support, opposed: g.opposed, distractors: g.distractors }),
}

// ── choice_evidence (e.evidence_location · r.inference) ──────────────
// 정답 = 선택 ✓ + 결정 근거 문장(decisive) 포함 + 근거 범주(evidence ∪ evidenceAlt) 밖 문장 없음.
const choiceEvidence: FormatSpec = {
  id: 'choice_evidence',
  validate(body, g) {
    const errs: string[] = []
    const len = n(body)
    if (!choicesOk(body)) errs.push('선택지는 5개')
    const gg = g as { answer: number; decisive: number; evidence: number[]; evidenceAlt: number[]; rationale: string }
    if (!isInt(gg.answer, 0, 5)) errs.push('정답 번호')
    if (!isInt(gg.decisive, 0, len)) errs.push('결정 근거 문장')
    if (!ints(gg.evidence, 0, len) || !gg.evidence.includes(gg.decisive)) errs.push('근거 문장에 결정 근거가 없다')
    if (!ints(gg.evidenceAlt ?? [], 0, len) || (gg.evidenceAlt ?? []).some((k) => gg.evidence?.includes(k))) errs.push('대체 근거 범위')
    if (typeof gg.rationale !== 'string' || gg.rationale.length < 12) errs.push('근거 설명')
    return [...errs, ...distractorErrors(g, DISTRACTOR_DESIGNS)]
  },
  grade(body, g, raw) {
    const r = (raw ?? {}) as { choice?: unknown; evidence?: unknown }
    const len = n(body)
    if (!isInt(r.choice, 0, 5) || !ints(r.evidence, 0, len, 6) || (r.evidence as number[]).length === 0) return null
    const gg = g as unknown as { answer: number; decisive: number; evidence: number[]; evidenceAlt: number[]; distractors: { choice: number; design: DistractorDesign }[] }
    const ev = sorted(r.evidence as number[])
    const allowed = new Set([...gg.evidence, ...(gg.evidenceAlt ?? [])])
    const choiceOk = r.choice === gg.answer
    const decisiveOk = ev.includes(gg.decisive)
    const extra = ev.filter((k) => !allowed.has(k))
    return {
      response: { choice: r.choice, evidence: ev },
      grade: { choiceOk, decisiveOk, evidenceExtra: extra, choiceDesign: choiceOk ? null : gg.distractors.find((d) => d.choice === r.choice)?.design ?? null,
        isCorrect: choiceOk && decisiveOk && extra.length === 0 },
    }
  },
  reveal: (g) => ({ answer: g.answer, decisive: g.decisive, evidence: g.evidence, rationale: g.rationale, distractors: g.distractors }),
}

// ── option_correspondence (e.option_correspondence) ──────────────────
// 선지 5개 각각: 판정(matches · distorted · not_in_text · reversed · too_narrow) + 대응 문장(본문에 없으면 null).
// 정답 = 고른 정답 ✓ + 모든 선지 판정 ✓ + 정답 선지의 대응 문장 ✓.
const optionCorrespondence: FormatSpec = {
  id: 'option_correspondence',
  validate(body, g) {
    const errs: string[] = []
    const len = n(body)
    if (!choicesOk(body)) errs.push('선택지는 5개')
    const gg = g as { answer: number; options: { verdict: OptionVerdict; sentence: number | null; why: string }[] }
    if (!isInt(gg.answer, 0, 5)) errs.push('정답 번호')
    if (!Array.isArray(gg.options) || gg.options.length !== 5) return [...errs, '선지 판정 5개']
    gg.options.forEach((o, i) => {
      if (!OPTION_VERDICTS.includes(o.verdict)) errs.push(`선지 ${i} 판정`)
      if (o.verdict === 'not_in_text' ? o.sentence !== null : !isInt(o.sentence, 0, len)) errs.push(`선지 ${i} 대응 문장`)
      if (typeof o.why !== 'string' || o.why.length < 8) errs.push(`선지 ${i} 이유`)
    })
    const stem = String(body.stem ?? '')
    const wantMatch = /일치하지 않는|맞지 않는|NOT/.test(stem) ? 'mismatch' : 'match'
    const matches = gg.options.filter((o) => o.verdict === 'matches').length
    if (wantMatch === 'match' && (matches !== 1 || gg.options[gg.answer]?.verdict !== 'matches')) errs.push('일치 발문인데 정답만 matches 가 아니다')
    if (wantMatch === 'mismatch' && (matches !== 4 || gg.options[gg.answer]?.verdict === 'matches')) errs.push('불일치 발문인데 정답 외 4개가 matches 가 아니다')
    return errs
  },
  grade(body, g, raw) {
    const r = (raw ?? {}) as { choice?: unknown; options?: unknown }
    const len = n(body)
    if (!isInt(r.choice, 0, 5) || !Array.isArray(r.options) || r.options.length !== 5) return null
    const opts = r.options as { verdict?: unknown; sentence?: unknown }[]
    if (!opts.every((o) => OPTION_VERDICTS.includes(o?.verdict as OptionVerdict) && (o.sentence === null || isInt(o.sentence, 0, len)))) return null
    const gg = g as unknown as { answer: number; options: { verdict: OptionVerdict; sentence: number | null }[] }
    const verdictOk = opts.map((o, i) => o.verdict === gg.options[i].verdict)
    const sentenceOk = gg.options[gg.answer].sentence === null ? true : opts[gg.answer].sentence === gg.options[gg.answer].sentence
    const choiceOk = r.choice === gg.answer
    return {
      response: { choice: r.choice, options: opts.map((o) => ({ verdict: o.verdict, sentence: o.sentence ?? null })) },
      grade: { choiceOk, verdictOk, sentenceOk, isCorrect: choiceOk && verdictOk.every(Boolean) && sentenceOk },
    }
  },
  reveal: (g) => ({ answer: g.answer, options: g.options }),
}

// ── contextual_sense (v.contextual_sense) ─────────────────────────────
// body.target = { sentence, word } — 그 문장의 그 낱말. 선택지 = 뜻 5개. 정답 = 뜻 ✓ + 근거 문장(cue) 중 하나 이상 · cue 밖 문장 없음.
const contextualSense: FormatSpec = {
  id: 'contextual_sense',
  validate(body, g) {
    const errs: string[] = []
    const len = n(body)
    if (!choicesOk(body)) errs.push('선택지는 5개')
    const t = body.target as { sentence?: number; word?: string } | undefined
    if (!t || !isInt(t.sentence, 0, len) || typeof t.word !== 'string' || !String((body.sentences as string[])[t.sentence!] ?? '').toLowerCase().includes(t.word.toLowerCase())) errs.push('목표 낱말이 그 문장에 없다')
    const gg = g as { answer: number; cue: number[]; senseGloss: string; distractors: { choice: number; design: string; why: string }[] }
    if (!isInt(gg.answer, 0, 5)) errs.push('정답 번호')
    if (!ints(gg.cue, 0, len) || gg.cue.length === 0) errs.push('근거 문장')
    if (typeof gg.senseGloss !== 'string' || gg.senseGloss.trim().length < 2) errs.push('뜻풀이')
    return [...errs, ...distractorErrors(g, SENSE_TRAPS)]
  },
  grade(body, g, raw) {
    const r = (raw ?? {}) as { choice?: unknown; cue?: unknown }
    if (!isInt(r.choice, 0, 5) || !ints(r.cue, 0, n(body), 4) || (r.cue as number[]).length === 0) return null
    const gg = g as unknown as { answer: number; cue: number[]; distractors: { choice: number; design: string }[] }
    const cue = sorted(r.cue as number[])
    const choiceOk = r.choice === gg.answer
    const cueOk = cue.some((k) => gg.cue.includes(k)) && cue.every((k) => gg.cue.includes(k))
    return {
      response: { choice: r.choice, cue },
      grade: { choiceOk, cueOk, choiceDesign: choiceOk ? null : gg.distractors.find((d) => d.choice === r.choice)?.design ?? null, isCorrect: choiceOk && cueOk },
    }
  },
  reveal: (g) => ({ answer: g.answer, cue: g.cue, senseGloss: g.senseGloss, distractors: g.distractors }),
}

// ── sentence_relation (r.relation) ───────────────────────────────────
// body.pairs = [[i, i+1], …] 묻는 인접 문장 쌍. 정답 = 모든 쌍 관계 ✓(대체 관계 허용 목록 포함).
const sentenceRelation: FormatSpec = {
  id: 'sentence_relation',
  validate(body, g) {
    const errs: string[] = []
    const len = n(body)
    const pairs = body.pairs as [number, number][] | undefined
    if (!Array.isArray(pairs) || pairs.length < 2 || pairs.length > 5 || !pairs.every((p) => isInt(p?.[0], 0, len) && p[1] === p[0] + 1 && isInt(p[1], 0, len))) errs.push('묻는 문장 쌍(인접 · 2~5개)')
    const gg = g as { pairs: { relation: PairRelation; alt: PairRelation[]; cue: string }[] }
    if (!Array.isArray(gg.pairs) || gg.pairs.length !== (pairs?.length ?? -1)) return [...errs, 'Gold 쌍 수']
    gg.pairs.forEach((p, i) => {
      if (!PAIR_RELATIONS.includes(p.relation) || !(p.alt ?? []).every((a) => PAIR_RELATIONS.includes(a) && a !== p.relation)) errs.push(`쌍 ${i} 관계`)
      if (typeof p.cue !== 'string' || p.cue.length < 2) errs.push(`쌍 ${i} 단서`)
    })
    return errs
  },
  grade(body, g, raw) {
    const r = (raw ?? {}) as { pairs?: unknown }
    const pairs = body.pairs as unknown[]
    if (!Array.isArray(r.pairs) || r.pairs.length !== pairs.length || !r.pairs.every((x) => PAIR_RELATIONS.includes(x as PairRelation))) return null
    const gg = g as unknown as { pairs: { relation: PairRelation; alt: PairRelation[] }[] }
    const ok = (r.pairs as PairRelation[]).map((x, i) => x === gg.pairs[i].relation || (gg.pairs[i].alt ?? []).includes(x))
    return { response: { pairs: r.pairs }, grade: { pairOk: ok, isCorrect: ok.every(Boolean) } }
  },
  reveal: (g) => ({ pairs: g.pairs }),
}

// ── form_scope (s.form_scope) ─────────────────────────────────────────
// body.marks = 밑줄 5개 [{ sentence, text }]. 정답 = 틀린 밑줄 ✓ + 틀린 이유(문법 범주) ✓. 선택만 맞고 이유가 틀리면 오답(우연 방지).
const formScope: FormatSpec = {
  id: 'form_scope',
  validate(body, g) {
    const errs: string[] = []
    const len = n(body)
    const marks = body.marks as { sentence: number; text: string }[] | undefined
    if (!Array.isArray(marks) || marks.length !== 5) return ['밑줄 5개']
    marks.forEach((m, i) => { if (!isInt(m.sentence, 0, len) || !String((body.sentences as string[])[m.sentence]).includes(m.text)) errs.push(`밑줄 ${i} 이 그 문장에 없다`) })
    const gg = g as { answer: number; reason: FormReason; correction: string; marks: { reason: FormReason; why: string }[] }
    if (!isInt(gg.answer, 0, 5)) errs.push('정답 번호')
    if (!FORM_REASONS.includes(gg.reason)) errs.push('틀린 이유 범주')
    if (typeof gg.correction !== 'string' || gg.correction.length < 1) errs.push('고친 형태')
    if (!Array.isArray(gg.marks) || gg.marks.length !== 5 || !gg.marks.every((m) => FORM_REASONS.includes(m.reason) && m.why.length >= 6)) errs.push('밑줄별 판단 근거')
    return errs
  },
  grade(_body, g, raw) {
    const r = (raw ?? {}) as { choice?: unknown; reason?: unknown }
    if (!isInt(r.choice, 0, 5) || !FORM_REASONS.includes(r.reason as FormReason)) return null
    const gg = g as unknown as { answer: number; reason: FormReason }
    const choiceOk = r.choice === gg.answer
    const reasonOk = r.reason === gg.reason
    return { response: { choice: r.choice, reason: r.reason }, grade: { choiceOk, reasonOk, isCorrect: choiceOk && reasonOk } }
  },
  reveal: (g) => ({ answer: g.answer, reason: g.reason, correction: g.correction, marks: g.marks }),
}

// ── discourse_roles (r.discourse_function · r.discourse_structure) ───
// 정답 = 모든 문장 역할 ✓(허용 대안 포함) + 구조 패턴 ✓. 채점은 기출분석 ⑤ 구조 예측과 같은 함수(gradeStructure).
const discourseRoles: FormatSpec = {
  id: 'discourse_roles',
  validate(body, g) {
    const errs: string[] = []
    const len = n(body)
    const gg = g as { roles: Role[]; alternatives: { index: number; role: Role }[]; pattern: Pattern; rationale: string }
    if (!Array.isArray(gg.roles) || gg.roles.length !== len || !gg.roles.every((r) => STRUCT_ROLES.includes(r))) errs.push('문장 수만큼 역할')
    if (!Array.isArray(gg.alternatives) || !gg.alternatives.every((a) => isInt(a.index, 0, len) && STRUCT_ROLES.includes(a.role) && a.role !== gg.roles?.[a.index])) errs.push('허용 대안')
    if (!STRUCT_PATTERNS.includes(gg.pattern)) errs.push('구조 패턴')
    if (typeof gg.rationale !== 'string' || gg.rationale.length < 12) errs.push('구조 설명')
    return errs
  },
  grade(body, g, raw) {
    const r = parseStructureResponse(raw, n(body))
    if (!r) return null
    const gg = g as unknown as { roles: Role[]; alternatives: { index: number; role: Role }[]; pattern: Pattern }
    const design: PassageDesign = { roles: gg.roles, alternatives: gg.alternatives, pattern: gg.pattern, selection: '', transform: 'paraphrase' as PassageDesign['transform'], transform_note: '', cues: [] }
    const grade = gradeStructure(design, r)
    return { response: { roles: r.roles, pattern: r.pattern }, grade: { ...grade } }
  },
  reveal: (g) => ({ roles: g.roles, alternatives: g.alternatives, pattern: g.pattern, rationale: g.rationale }),
}

// ── demand_choice (e.task_demand) ────────────────────────────────────
// body.taskStem = 분석할 발문. 선택지 = 그 발문이 요구하는 판단 진술 5개. 정답 = 요구 진술 ✓. 오답 = 연산 · 범위 · 세부 · 단위 · 조건 착오.
const demandChoice: FormatSpec = {
  id: 'demand_choice',
  validate(body, g) {
    const errs: string[] = []
    const gg = g as { answer: number; rationale: string }
    if (!choicesOk(body)) errs.push('선택지는 5개')
    if (typeof body.taskStem !== 'string' || body.taskStem.length < 6) errs.push('분석할 발문(taskStem)')
    if (!isInt(gg.answer, 0, 5)) errs.push('정답 번호')
    if (typeof gg.rationale !== 'string' || gg.rationale.length < 12) errs.push('요구 설명')
    return [...errs, ...distractorErrors(g, DEMAND_TRAPS)]
  },
  grade(_body, g, raw) {
    const r = (raw ?? {}) as { choice?: unknown }
    if (!isInt(r.choice, 0, 5)) return null
    const gg = g as unknown as { answer: number; distractors: { choice: number; design: string }[] }
    const ok = r.choice === gg.answer
    return { response: { choice: r.choice }, grade: { choiceOk: ok, choiceDesign: ok ? null : gg.distractors.find((d) => d.choice === r.choice)?.design ?? null, isCorrect: ok } }
  },
  reveal: (g) => ({ answer: g.answer, rationale: g.rationale, distractors: g.distractors }),
}

// ── segment_choice (s.sentence_core · s.attachment · s.chunk_boundary · s.structural_relation) ──
// body.focus.sentence 문장을 body.segments(그 문장의 연속 부분 문자열, 순서대로)로 나눠 보이고 body.ask 를 묻는다.
// 정답 = 해당 덩어리 ✓ + 이유 ✓(위치만 맞힌 우연 정답 구별). 덩어리는 문장에 실제로 있는 글자여야 한다.
const segmentChoice: FormatSpec = {
  id: 'segment_choice',
  validate(body, g) {
    const errs: string[] = []
    const len = n(body)
    const f = body.focus as { sentence?: number } | undefined
    const segs = body.segments as string[] | undefined
    if (!f || !isInt(f.sentence, 0, len)) return ['초점 문장']
    if (!(SEGMENT_ASKS as readonly string[]).includes(String(body.ask))) errs.push('묻는 것(ask)')
    if (!Array.isArray(segs) || segs.length < 3 || segs.length > 8) return [...errs, '덩어리 3~8개']
    const sent = String((body.sentences as string[])[f.sentence as number])
    let at = 0
    segs.forEach((sg, i) => {
      const k = typeof sg === 'string' && sg.trim() ? sent.indexOf(sg, at) : -1
      if (k < 0) errs.push(`덩어리 ${i} 가 문장에 순서대로 없다`)
      else at = k + sg.length
    })
    const gg = g as { answer: number; reason: SegmentReason; why: string; segments: { reason: SegmentReason; why: string }[] }
    if (!isInt(gg.answer, 0, segs.length)) errs.push('정답 덩어리')
    if (!SEGMENT_REASONS.includes(gg.reason)) errs.push('이유 범주')
    if (typeof gg.why !== 'string' || gg.why.length < 8) errs.push('정답 설명')
    if (!Array.isArray(gg.segments) || gg.segments.length !== segs.length || !gg.segments.every((x) => SEGMENT_REASONS.includes(x.reason) && typeof x.why === 'string' && x.why.trim().length >= 2)) errs.push('덩어리별 판단 근거')
    return errs
  },
  grade(body, g, raw) {
    const r = (raw ?? {}) as { choice?: unknown; reason?: unknown }
    const segs = (body.segments as string[] | undefined) ?? []
    if (!isInt(r.choice, 0, segs.length) || !SEGMENT_REASONS.includes(r.reason as SegmentReason)) return null
    const gg = g as unknown as { answer: number; reason: SegmentReason }
    const choiceOk = r.choice === gg.answer
    const reasonOk = r.reason === gg.reason
    return { response: { choice: r.choice, reason: r.reason }, grade: { choiceOk, reasonOk, isCorrect: choiceOk && reasonOk } }
  },
  reveal: (g) => ({ answer: g.answer, reason: g.reason, why: g.why, segments: g.segments }),
}

// ── equivalence (v.semantic_relation) ────────────────────────────────
// body.pair = { a: {sentence, text}, b: {sentence, text} } — 두 표현이 이 글에서 같은 뜻인가 + 의미 관계. 정답 = 같음 여부 ✓ + 관계 ✓.
// 관계 방향: relation = 「표현 A 가 표현 B 에 대해」 갖는 관계(A 가 더 넓은 말이면 hypernym). 학습자 화면도 이 방향으로 묻는다.
const equivalence: FormatSpec = {
  id: 'equivalence',
  validate(body, g) {
    const errs: string[] = []
    const len = n(body)
    const p = body.pair as { a?: { sentence: number; text: string }; b?: { sentence: number; text: string } } | undefined
    for (const k of ['a', 'b'] as const) {
      const x = p?.[k]
      if (!x || !isInt(x.sentence, 0, len) || typeof x.text !== 'string' || !String((body.sentences as string[])[x.sentence]).includes(x.text)) errs.push(`표현 ${k} 가 그 문장에 없다`)
    }
    const gg = g as { same: boolean; relation: MeaningRelation; cue: number[]; why: string }
    if (typeof gg.same !== 'boolean') errs.push('같음 여부')
    if (!MEANING_RELATIONS.includes(gg.relation)) errs.push('의미 관계')
    if (gg.same !== (gg.relation === 'synonym' || gg.relation === 'paraphrase')) errs.push('같음 여부와 관계가 어긋난다')
    if (!ints(gg.cue, 0, len) || gg.cue.length === 0) errs.push('근거 문장')
    if (typeof gg.why !== 'string' || gg.why.length < 8) errs.push('설명')
    return errs
  },
  grade(_body, g, raw) {
    const r = (raw ?? {}) as { same?: unknown; relation?: unknown }
    if (typeof r.same !== 'boolean' || !MEANING_RELATIONS.includes(r.relation as MeaningRelation)) return null
    const gg = g as unknown as { same: boolean; relation: MeaningRelation }
    const sameOk = r.same === gg.same
    const relationOk = r.relation === gg.relation
    return { response: { same: r.same, relation: r.relation }, grade: { sameOk, relationOk, isCorrect: sameOk && relationOk } }
  },
  reveal: (g) => ({ same: g.same, relation: g.relation, cue: g.cue, why: g.why }),
}

export const FORMAT_SPECS: Record<FormatId, FormatSpec> = {
  discourse_roles: discourseRoles,
  demand_choice: demandChoice,
  segment_choice: segmentChoice,
  equivalence,
  central_meaning: centralMeaning,
  choice_evidence: choiceEvidence,
  option_correspondence: optionCorrespondence,
  contextual_sense: contextualSense,
  sentence_relation: sentenceRelation,
  form_scope: formScope,
}

/** 형식 id — body.format 이 없으면 R5 최초 세트(central_meaning) */
export const formatOf = (body: Record<string, unknown>): FormatId => (FORMATS.includes(body.format as FormatId) ? (body.format as FormatId) : 'central_meaning')
