// apps/web/src/components/game/scriptquiz/__tests__/result-screen.test.tsx
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }), usePathname: () => '/scriptquiz/play' }))

import { ResultScreen, resultFeedback } from '../ScriptQuiz'

const CLAIMS = /깊이 이해|기억을 단단하게|인지적 분투|곧 익숙해질|잘 다뤘어요|오답 단어/
const Q = (id: string) => ({ id, type: 'multiple' as const, question: `Q ${id}?`, options: [{ text: 'A' }, { text: 'B' }] })
const A = (id: string, ok: boolean) => ({ questionId: id, selectedIndex: ok ? 0 : 1, correctIndex: 0, isCorrect: ok, sourceSnippet: 'S', timeMs: 1000 })
const render = (answers: ReturnType<typeof A>[], returnTo?: { href: string; label: string }) => {
  const correct = answers.filter((a) => a.isCorrect).length
  return renderToString(
    <ResultScreen
      totalQ={answers.length}
      stats={{ correct, wrong: answers.length - correct, accuracy: Math.round((correct / answers.length) * 100), avgTimeSec: 1 }}
      questions={answers.map((a) => Q(a.questionId))}
      answers={answers}
      onRetry={() => {}}
      returnTo={returnTo}
    />,
  )
}

describe('resultFeedback — 관측된 결과만', () => {
  it('전부·부분·0·문항 없음', () => {
    expect(resultFeedback(5, 5)).toBe('5문제 모두 맞혔어요. 이번 퀴즈의 결과예요.')
    expect(resultFeedback(3, 5)).toContain('5문제 중 3문제를 맞혔어요')
    expect(resultFeedback(3, 5)).toContain('아래 2문제')
    expect(resultFeedback(0, 5)).toContain('맞힌 문항이 없어요')
    expect(resultFeedback(0, 0)).toContain('채점된 문항이 없어요')
    for (const [c, t] of [[5, 5], [3, 5], [0, 5]]) expect(resultFeedback(c, t)).not.toMatch(CLAIMS)
  })
})

describe('ResultScreen — 목적지를 사실대로', () => {
  it('오답 0개여도 「오답 단어」 를 말하지 않고 전체 단어장이라고 부른다', () => {
    const html = render([A('1', true), A('2', true)])
    expect(html).not.toMatch(CLAIMS)
    expect(html).toContain('전체 단어장으로')
    expect(html).toContain('href="/wordvault"')
  })
  it('확인된 읽기 맥락이 있으면 「읽던 글로」 , 없으면 버튼 없음', () => {
    expect(render([A('1', false)], { href: '/text/t-1', label: '읽던 글로' })).toContain('href="/text/t-1"')
    expect(render([A('1', false)])).not.toContain('data-testid="result-return"')
  })
  it('오답 문항은 내 답·정답과 함께 남는다', () => {
    const html = render([A('1', true), A('2', false)])
    expect(html).toContain('Q 2?')
    expect(html).toContain('2문제 중 1문제를 맞혔어요')
  })
})
