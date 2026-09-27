// packages/library-pipeline/src/textbook/standalone-narrative.test.ts
//
// **자족성 게이트가 유형을 보게 된 자리를 고정한다.**
//
// ── 왜 (실측 2026-09-24 · 기출 802문항) ──────────────────────────────
// `STANDALONE_GATE.maxQuotedPct = 9` 는 **시중 초·중 「설명문」 지문** p95(8.5·7.6)에서
// 왔다. 그런데 그 문턱이 모든 유형에 쓰이고 있었고, 서사 계열에 대면 **기출 자체가
// 탈락한다**:
//
//   심경·분위기     대화 9% 초과 **53.6%**  (중앙 16.04%)
//   장문 순서·지칭·내용일치  **79.3%**  (중앙 23.44%)
//   서사 계열 전체          **73.0%**
//   나머지 유형              3.9%   ← 여기는 문턱 9 가 맞다(p95 7.23)
//
// 규칙이 정당한 글을 걸면 코드가 아니라 **규칙을 고친다**(AGENTS.md).
// 서사 문턱은 같은 방식(p95)으로, 다만 **분모를 바꿔** 기출 서사에서 뽑았다 — 46.65 → 47.
//
// ⚠️ 이 게이트를 서사 재고에 `narrative: true` 없이 걸면 그 원천은
//    "대화가 많아 못 쓴다" 는 **없는 진단**을 받는다. StoryWeaver(대화 중앙 15.9%)와
//    gutenberg fiction(9% 초과 83.7%)이 실제로 그렇게 걸렸다.

import { describe, expect, it } from 'vitest'

import {
  STANDALONE_GATE,
  STANDALONE_NARRATIVE_SPEC,
  STANDALONE_SPEC,
  standaloneFit,
  standaloneSignals,
} from './standalone'

/**
 * 대화 비중이 목표치인 글을 만든다 — 서술 문장과 대사를 섞는다.
 *
 * ⚠️ **대사 문장의 낱말이 전부 인용부호 안에 있는 것이 아니다.** `he said quietly to
 *   his sister` 는 밖이다. 첫 판은 대사 문장 전체를 인용으로 세어 `passage(75)` 가
 *   실제로는 42.7% 를 냈고, 그래서 검사가 틀리게 실패했다 — **코드가 아니라 픽스처가
 *   틀린 것**이었다. 지금은 **인용부호 안 낱말만** 세어 역산한다.
 */
function passage(quotedShare: number): string {
  const narration =
    'The boy walked to the edge of the field and looked at the sky. ' +
    'Clouds had gathered since morning and the air felt heavy against his skin. ' +
    'He counted the rows of corn that his father had planted in the spring. ' +
    'Somewhere behind the barn a door closed and then opened again. '
  const dialogue = '"We should go back home before the heavy rain finally starts," he said. '
  const words = (s: string) => (s.match(/[A-Za-z][A-Za-z'-]*/g) ?? []).length
  const inQuotes = (s: string) =>
    words((s.match(/"[^"]{3,}"/g) ?? []).join(' '))

  const n = words(narration)
  const dAll = words(dialogue)
  const dIn = inQuotes(dialogue)
  // (dIn·k) / (n + dAll·k) = share/100  →  k = share·n / (100·dIn − share·dAll)
  const denom = 100 * dIn - quotedShare * dAll
  if (denom <= 0) throw new Error(`이 대사로는 ${quotedShare}% 를 못 만든다 — 픽스처를 고칠 것`)
  const k = Math.max(1, Math.round((quotedShare * n) / denom))
  return narration + dialogue.repeat(k)
}

describe('자족성 게이트 — 서사 문턱', () => {
  it('문턱 둘이 서로 다른 분모에서 왔다', () => {
    // 설명문 문턱은 시중 설명문 p95 위, 서사 문턱은 기출 서사 p95 위.
    expect(STANDALONE_GATE.maxQuotedPct).toBeGreaterThan(STANDALONE_SPEC.market.elementary.quotedP95)
    expect(STANDALONE_GATE.maxQuotedPctNarrative).toBeGreaterThan(STANDALONE_NARRATIVE_SPEC.quotedP95)
  })

  it('서사 문턱이 설명문 문턱보다 훨씬 높다 — 분포가 다르기 때문이다', () => {
    expect(STANDALONE_GATE.maxQuotedPctNarrative).toBeGreaterThan(STANDALONE_GATE.maxQuotedPct * 4)
    // 기출 서사 중앙(18.44)이 설명문 문턱(9)의 두 배다 — 같은 자로 잴 수 없다.
    expect(STANDALONE_NARRATIVE_SPEC.quotedP50).toBeGreaterThan(STANDALONE_GATE.maxQuotedPct)
  })

  it('기출 서사 중앙 수준의 대화는 서사 모드에서 통과하고 기본 모드에서 걸린다', () => {
    const text = passage(STANDALONE_NARRATIVE_SPEC.quotedP50)
    const s = standaloneSignals(text)
    expect(s, '신호를 못 쟀다').toBeTruthy()
    expect(s!.quotedPct).toBeGreaterThan(STANDALONE_GATE.maxQuotedPct)

    expect(standaloneFit(text).pass, '기본(설명문) 모드는 걸러야 한다').toBe(false)
    expect(standaloneFit(text, { narrative: true }).pass, '서사 모드는 통과해야 한다').toBe(true)
  })

  it('서사 모드에서도 대화만 있는 장면 조각은 걸린다', () => {
    // 기출 서사조차 p99 가 57.47 이다 — 60% 짜리는 지문이 아니라 장면이다.
    const text = passage(75)
    const s = standaloneSignals(text)
    expect(s!.quotedPct).toBeGreaterThan(STANDALONE_GATE.maxQuotedPctNarrative)
    expect(standaloneFit(text, { narrative: true }).pass).toBe(false)
  })

  it('탈락 사유가 어느 분모를 썼는지 말한다', () => {
    const text = passage(75)
    expect(standaloneFit(text, { narrative: true }).reason).toContain('기출 서사 p95')
    expect(standaloneFit(passage(30)).reason).toContain('시중 p95')
  })

  it('기본값은 설명문 모드다 — 기존 호출부의 판정이 안 바뀐다', () => {
    const text = passage(20)
    expect(standaloneFit(text)).toEqual(standaloneFit(text, {}))
    expect(standaloneFit(text).pass).toBe(false)
  })

  it('대화 문턱만 바뀐다 — 나머지 검사는 서사 모드에서도 그대로다', () => {
    // 앞 문맥을 가리키는 첫 문장은 서사든 아니든 탈락이다.
    const anaphoric = 'However, he did not answer her at all. ' + passage(20)
    expect(standaloneFit(anaphoric, { narrative: true }).pass).toBe(false)
  })
})
