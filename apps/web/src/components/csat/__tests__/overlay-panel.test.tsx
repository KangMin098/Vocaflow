// apps/web/src/components/csat/__tests__/overlay-panel.test.tsx
//
// **「제출 전에는 해설이 없다」를 기계가 채점한다.**
//
// 이 계약은 눈으로는 절대 확인되지 않는다 — 감춰 둔 해설과 만들지 않은 해설은 화면이
// 똑같다. 그런데 둘의 차이가 이 화면의 전부다(감춰 두면 «스스로 답해 보기» 가 안 일어난다).
// 그래서 마크업을 문자열로 받아 **분석 문장이 한 조각이라도 들어 있는지** 를 센다.

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ALL_LAYERS_ON, OverlayPanel, type OverlayPanelMeta } from '@/components/csat/OverlayPanel'
import { buildRevealSteps, type RevealSource } from '@/lib/csat/overlay-reveal'

const QUOTE = 'The measured decline began long before the policy took effect.'
const WHY_CORRECT = '두 시점의 선후가 본문과 같다'
const REJECT_1 = '둘째 문단이 범위를 좁힌다'
const TRAP_1 = '범위 넘김'
const PROC = '시점을 먼저 표시한다'
const VOCAB = 'precede'

const source: RevealSource = {
  answer: 3,
  answer_quote: QUOTE,
  design_intent: '시점의 선후를 뒤집어 읽게 만드는 문항이다.',
  choice_analysis: [
    { n: 1, trap: TRAP_1, why_tempting: '첫 문단만 보면 맞다', how_to_reject: REJECT_1 },
    { n: 3, why_correct: WHY_CORRECT },
  ],
  solve_procedure: [{ step: PROC }],
  required_vocab: [VOCAB],
}

const meta: OverlayPanelMeta = {
  no: 30,
  slug: '2026-30',
  type_name: '어휘',
  points: 2,
  time_budget_sec: 90,
  measured_ability: '문맥 속 낱말 판단',
  ready: true,
  answer: 3,
}

const noop = () => {}

function markup(over: Partial<Parameters<typeof OverlayPanel>[0]> = {}) {
  return renderToStaticMarkup(
    <OverlayPanel
      item={meta}
      steps={null}
      picked={null}
      step={0}
      elapsed={0}
      layers={ALL_LAYERS_ON}
      onPick={noop}
      onSubmit={noop}
      onStep={noop}
      onLayer={noop}
      onClose={noop}
      {...over}
    />,
  )
}

const steps = buildRevealSteps(source)
/** 해설에 실리는 모든 조각. 풀기 단계에서는 이 중 **하나도** 나오면 안 된다. */
const ANALYSIS = [QUOTE, WHY_CORRECT, REJECT_1, TRAP_1, PROC, VOCAB]

describe('G5 — 풀기 단계에 해설이 렌더되지 않는다 (숨김이 아니라 부재)', () => {
  it('분석 문자열이 마크업에 한 조각도 없다', () => {
    const html = markup()
    for (const piece of ANALYSIS) {
      expect(html, `풀기 단계에 «${piece.slice(0, 20)}» 가 새어 나왔다`).not.toContain(piece)
    }
  })

  it('정답 번호도 아직 말하지 않는다 — 선지 버튼 다섯은 그대로 있다', () => {
    const html = markup()
    expect(html).not.toContain('답 ③')
    expect(html).not.toContain('맞았어요')
    // ①~⑤ 는 «고르는» 버튼이므로 있어야 한다. 다섯 개 다.
    for (const c of ['①', '②', '③', '④', '⑤']) expect(html).toContain(c)
  })

  it('감추기(hidden·display:none)로 해결하지 않았다 — 감춘 흔적이 없다', () => {
    const html = markup()
    expect(html).not.toMatch(/display:\s*none/i)
    expect(html).not.toMatch(/\shidden(=|\s|>)/)
  })
})

describe('순차 공개 — 한 겹씩만 열린다', () => {
  it('첫 겹은 근거뿐이고 오답 배제는 아직 없다', () => {
    const html = markup({ steps, picked: 1, step: 0 })
    expect(html).toContain(QUOTE)
    expect(html).not.toContain(REJECT_1)
    expect(html).not.toContain(PROC)
  })

  it('겹을 넘기면 그 겹만 바뀐다 — 앞 겹의 본문은 남지 않는다', () => {
    const i = steps.findIndex((s) => s.choice === 1)
    const html = markup({ steps, picked: 1, step: i })
    expect(html).toContain(REJECT_1)
    expect(html).toContain(TRAP_1)
    expect(html).not.toContain(QUOTE)
  })

  it('함정 겹을 끄면 함정 이름이 사라진다 (레이어 토글)', () => {
    const i = steps.findIndex((s) => s.choice === 1)
    const html = markup({
      steps,
      picked: 1,
      step: i,
      layers: { ...ALL_LAYERS_ON, traps: false },
    })
    expect(html).toContain(REJECT_1)
    expect(html).not.toContain(TRAP_1)
  })

  it('마지막 겹에서 어휘가 나온다', () => {
    const html = markup({ steps, picked: 3, step: steps.length - 1 })
    expect(html).toContain(VOCAB)
  })

  it('아직 안 연 겹의 단추는 눌리지 않는다 — 건너뛰면 순차가 아니다', () => {
    const html = markup({ steps, picked: 3, step: 0 })
    // 표시줄의 단추 수 = 겹 수. 그중 첫 겹을 뺀 나머지는 disabled.
    const disabled = (html.match(/disabled=""/g) ?? []).length
    expect(disabled).toBeGreaterThanOrEqual(steps.length - 1)
  })
})

describe('화면이 종이에 대해 거짓말하지 않는다', () => {
  const vocabStep = () => steps.length - 1

  it('종이가 없는 자리(링크 모드)에서는 밑줄·점선 이야기를 하지 않는다', () => {
    const ev = markup({ steps, picked: 3, step: 0, paper: null })
    expect(ev).toContain(QUOTE)
    expect(ev).not.toContain('밑줄')
    const vo = markup({ steps, picked: 3, step: vocabStep(), paper: null })
    expect(vo).toContain(VOCAB)
    expect(vo).not.toContain('점선')
  })

  it('근거를 찾았을 때만 「밑줄 친 자리」라고 말한다', () => {
    expect(markup({ steps, picked: 3, step: 0, paper: { quote: 'found', vocabFound: 0 } })).toContain(
      '밑줄 친 자리',
    )
    for (const quote of ['pending', 'missing'] as const) {
      expect(markup({ steps, picked: 3, step: 0, paper: { quote, vocabFound: 0 } })).not.toContain('밑줄 친 자리')
    }
  })

  it('못 찾은 것을 숨기지 않는다 — 직접 짚으라고 말한다', () => {
    const html = markup({ steps, picked: 3, step: 0, paper: { quote: 'missing', vocabFound: 0 } })
    expect(html).toContain('자동으로 찾지 못했어요')
  })

  it('어휘는 찾은 수만큼만 표시했다고 말한다', () => {
    const found = markup({ steps, picked: 3, step: vocabStep(), paper: { quote: 'found', vocabFound: 1 } })
    expect(found).toContain('1개 중 1개')
    const none = markup({ steps, picked: 3, step: vocabStep(), paper: { quote: 'found', vocabFound: 0 } })
    expect(none).not.toContain('점선')
    expect(none).toContain('찾지 못했어요')
  })
})

describe('같은 회차 다음 문항', () => {
  it('마지막 겹에서만 나타난다 — 중간에 두면 겹을 건너뛰는 출구가 된다', () => {
    const onNext = () => {}
    expect(markup({ steps, picked: 3, step: 0, nextNo: 31, onNext })).not.toContain('다음 문항 31번')
    expect(markup({ steps, picked: 3, step: steps.length - 1, nextNo: 31, onNext })).toContain('다음 문항 31번')
  })

  it('다음 문항이 없으면 단추도 없다', () => {
    expect(markup({ steps, picked: 3, step: steps.length - 1, nextNo: null, onNext: () => {} })).not.toContain(
      '다음 문항',
    )
  })

  it('풀기 단계에는 없다', () => {
    expect(markup({ nextNo: 31, onNext: () => {} })).not.toContain('다음 문항 31번')
  })
})

describe('압박하지 않는다', () => {
  it('틀린 답에 오류색·주묵을 쓰지 않는다', () => {
    const html = markup({ steps, picked: 1, step: 0 })
    expect(html).toContain('고른 답은 ①')
    expect(html).not.toContain('--error')
    expect(html).not.toContain('--ju')
    expect(html).not.toContain('--bde')
  })

  it('권장 시간을 넘겨도 시계 색이 변하지 않는다', () => {
    const under = markup({ elapsed: 10 })
    const over = markup({ elapsed: 600 })
    const clockClass = (h: string) => /<span class="([^"]*tabular-nums[^"]*)"/.exec(h)?.[1]
    expect(clockClass(over)).toBe(clockClass(under))
  })

  it('분석이 없는 문항은 막다른 화면이 아니다 — 다음 한 걸음이 함께 있다', () => {
    const html = markup({ item: { ...meta, ready: false } })
    expect(html).toContain('다른 문항 번호를 눌러 보세요')
  })
})

describe('손가락과 키보드', () => {
  it('모든 단추가 44px 이상이다', () => {
    for (const html of [markup(), markup({ steps, picked: 3, step: 0 })]) {
      const buttons = html.match(/<button[^>]*>/g) ?? []
      expect(buttons.length).toBeGreaterThan(0)
      for (const b of buttons) expect(b, `44px 미만 타깃: ${b.slice(0, 80)}`).toContain('min-h-[44px]')
    }
  })

  it('겹 스위치가 키보드로 찾아갈 수 있는 자리에 있다 (L 키가 여기로 보낸다)', () => {
    expect(markup({ steps, picked: 3, step: 0 })).toContain('id="csat-overlay-layers"')
  })
})
