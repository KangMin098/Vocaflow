// apps/web/src/lib/learner/dcp-underline.ts
//
// v6.2 P-F8d — 「밑줄 다섯 중 하나」 유형의 화면 계약(순수 · client/server 공용). 첫 수직 경로 = 어휘 `vocab_choice`.
//
// 실측 2026-10-15(개발 DB, 읽기 전용):
//   payload    `{sentences: string[], underlines: [{word, label:'①'…'⑤', sentenceIdx, tokenIdx?}×5]}`
//   answer_key `{position: 1..5, original: 정답 자리에 원래 있던 낱말, explanation_ko}` — position 은 1부터(②=2)
//   재고 V2~V7 49,353문항(해설 있는 것 46,227). 어법 `grammar_choice` 도 같은 모양(+ tokenIdx · rule).
// 제출은 기존 선택지 계약과 같은 `{choice: 1..5}` — 기록(`csat_item_attempts`) · 오답 원인 1-tap 을 그대로 쓴다.
//
// ⚠️ **아직 학습자 화면에 나가지 않는다.** DB 채점(`grade_dcp_item`)이 이 유형을 모른다('Unknown type' 예외) —
//   채점 확장은 RPC 변경이라 승인 대상(`supabase/migrations/_pending_grade_dcp_underline_choice.sql`).
//   그 전까지 `PLAYABLE_DCP_TYPES` 에 넣지 않고, 격리 개발 화면(/dev/vocab-practice)에서 합성 문항으로만 돌린다.
// ⚠️ 화면에서 풀 수 있다는 사실은 공급 자격이 아니다 — 지도 연습(guided_practice) 후보일 뿐, 독립 확인 · 전이 평가가 아니다.

export const UNDERLINE_CHOICE_DCP_TYPES = ['vocab_choice'] as const
export type UnderlineChoiceDcpType = (typeof UNDERLINE_CHOICE_DCP_TYPES)[number]

export function isUnderlineChoiceDcpType(type: unknown): type is UnderlineChoiceDcpType {
  return typeof type === 'string' && (UNDERLINE_CHOICE_DCP_TYPES as readonly string[]).includes(type)
}

export const UNDERLINE_LABELS = ['①', '②', '③', '④', '⑤'] as const

export interface DcpUnderline {
  word: string
  label: (typeof UNDERLINE_LABELS)[number]
  sentenceIdx: number
  /** 같은 낱말이 한 문장에 두 번 나올 때 몇 번째 토큰인지(어법 유형). 없으면 그 문장의 첫 등장 */
  tokenIdx: number | null
}

export interface DcpUnderlinePayload {
  sentences: string[]
  /** ①~⑤ 순서로 정확히 5개 */
  underlines: DcpUnderline[]
  /** 묻는 말 — 유형마다 다르다(저장 payload 에는 없다) */
  stemKo: string
}

const STEM: Record<UnderlineChoiceDcpType, string> = {
  vocab_choice: '밑줄 친 낱말 중 문맥상 쓰임이 적절하지 않은 것은?',
}

/** 낱말이 문장 안에 실제로 있는가(대소문자 무시 · 단어 경계) */
function occurs(sentence: string, word: string): boolean {
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^A-Za-z])${esc}([^A-Za-z]|$)`, 'i').test(sentence)
}

/**
 * 저장 payload → 화면 payload. 성립하지 않으면 null(그 문항을 내보내지 않는다).
 * 거르는 것: 밑줄 5개가 아님 · 라벨 순서가 ①~⑤ 가 아님 · 문장 범위 밖 · 밑줄 낱말이 그 문장에 없음 · 같은 자리 중복.
 */
export function parseUnderlinePayload(type: string, raw: unknown): DcpUnderlinePayload | null {
  if (!isUnderlineChoiceDcpType(type) || !raw || typeof raw !== 'object') return null
  const p = raw as { sentences?: unknown; underlines?: unknown }
  if (!Array.isArray(p.sentences) || !p.sentences.every((s) => typeof s === 'string' && s.trim().length > 0)) return null
  if (!Array.isArray(p.underlines) || p.underlines.length !== 5) return null
  const sentences = p.sentences as string[]
  const underlines: DcpUnderline[] = []
  const seen = new Set<string>()
  for (const [i, u] of (p.underlines as Record<string, unknown>[]).entries()) {
    const word = typeof u?.word === 'string' ? u.word.trim() : ''
    const sentenceIdx = typeof u?.sentenceIdx === 'number' ? u.sentenceIdx : -1
    const tokenIdx = typeof u?.tokenIdx === 'number' ? u.tokenIdx : null
    if (!word || u?.label !== UNDERLINE_LABELS[i]) return null
    if (sentenceIdx < 0 || sentenceIdx >= sentences.length || !occurs(sentences[sentenceIdx]!, word)) return null
    const at = `${sentenceIdx}:${word.toLowerCase()}:${tokenIdx ?? ''}`
    if (seen.has(at)) return null
    seen.add(at)
    underlines.push({ word, label: UNDERLINE_LABELS[i]!, sentenceIdx, tokenIdx })
  }
  return { sentences, underlines, stemKo: STEM[type] }
}

/** 한 문장을 [평문 · 밑줄] 조각으로 — 그 문장에 걸린 밑줄을 앞에서부터 찾는다(tokenIdx 가 있으면 그 토큰) */
export function splitSentence(sentence: string, marks: DcpUnderline[]): { text: string; mark: DcpUnderline | null }[] {
  const tokens = sentence.split(/(\s+)/)
  const out: { text: string; mark: DcpUnderline | null }[] = []
  let wordIdx = 0
  const pending = [...marks]
  for (const tok of tokens) {
    if (/^\s+$/.test(tok) || tok === '') {
      out.push({ text: tok, mark: null })
      continue
    }
    const core = tok.replace(/^[^A-Za-z]+|[^A-Za-z'-]+$/g, '')
    const hit = pending.findIndex((m) => m.word.toLowerCase() === core.toLowerCase() && (m.tokenIdx === null || m.tokenIdx === wordIdx))
    if (hit >= 0 && core) {
      const m = pending.splice(hit, 1)[0]!
      const lead = tok.slice(0, tok.indexOf(core))
      const tail = tok.slice(tok.indexOf(core) + core.length)
      if (lead) out.push({ text: lead, mark: null })
      out.push({ text: core, mark: m })
      if (tail) out.push({ text: tail, mark: null })
    } else {
      out.push({ text: tok, mark: null })
    }
    wordIdx++
  }
  return out
}

/**
 * 채점 규칙 — 보류 SQL(`grade_dcp_item` 확장)과 같은 규칙: 고른 번호 = answer_key.position.
 * 격리 화면이 쓰고, PGlite 시험이 SQL 과 같은지 대조한다.
 */
export function gradeUnderlineChoice(answerKey: { position?: unknown }, answer: { choice?: unknown }): boolean {
  const c = typeof answer.choice === 'number' ? answer.choice : Number(answer.choice)
  if (!Number.isInteger(c) || c < 1 || c > 5) throw new Error('Bad choice')
  return c === Number(answerKey.position)
}
