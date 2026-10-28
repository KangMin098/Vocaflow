// apps/web/src/components/dictation/__tests__/results-relisten.test.tsx
// @vitest-environment node
// 결과 화면 문항 행 — 다시 듣기(현재 기기 음성 · 기록 없음)와 당시 피드백(단어 상태 라벨 + 오류 태그).
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const recordSpies = vi.hoisted(() => ({
  flush: vi.fn(),
  saveAttempt: vi.fn(),
  complete: vi.fn(),
}))
vi.mock('@/lib/supabase/client', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/recommend/use-next-action', () => ({ useNextAction: () => null }))
vi.mock('@/lib/dictation/persist', () => ({
  fetchDictationSessionDetail: vi.fn(),
  flushPendingSrsResults: recordSpies.flush,
  saveDictationAttempt: recordSpies.saveAttempt,
  completeDictationSession: recordSpies.complete,
}))

import { StoryAuthGuard } from '@/components/library/story/use-story-auth-guard'
import { ERROR_TAG_META } from '@/lib/dictation/error-tags'
import { ResultsRelisten } from '@/lib/dictation/results-relisten'
import { AttemptFeedback, DictationAttemptRows } from '../DictationResultsClient'

const base = {
  userInput: 'the cat sat',
  accuracy: 60,
  hintsUsed: 0,
  replayCount: 0,
  skipped: false,
  targetWords: [],
  targetHits: [],
}
const attempts = [
  {
    ...base,
    itemIdx: 0,
    expected: 'The cats sat down.',
    wordResults: [
      { expected: 'the', actual: 'the', status: 'correct' as const, similarity: 1 },
      { expected: 'cats', actual: 'cat', status: 'misspelled' as const, similarity: 0.8 },
      { expected: 'down', actual: '', status: 'missing' as const, similarity: 0 },
    ],
    errorTags: ['inflection', 'tail-drop'],
  },
  { ...base, itemIdx: 1, expected: 'Second one.', wordResults: [], errorTags: [] },
  { ...base, itemIdx: 2, expected: 'Third.', userInput: '', skipped: true, wordResults: [], errorTags: [] },
]

function deferredSpeaker() {
  const pending: Array<() => void> = []
  return {
    pending,
    speak: vi.fn(() => new Promise<void>((r) => pending.push(r))),
    cancel: vi.fn(),
  }
}
const flush = () => new Promise((r) => setTimeout(r, 0))

describe('ResultsRelisten', () => {
  it('행을 누르면 그 행 문장을 읽고, 같은 행을 다시 누르면 정지한다', () => {
    const sp = deferredSpeaker()
    const p = new ResultsRelisten(sp)
    p.toggle(1, 'Second one.')
    expect(sp.speak).toHaveBeenCalledWith('Second one.')
    expect(p.playingIdx).toBe(1)
    p.toggle(1, 'Second one.')
    expect(p.playingIdx).toBeNull()
    expect(sp.speak).toHaveBeenCalledTimes(1)
    expect(sp.cancel).toHaveBeenCalledTimes(2)
  })

  it('행을 바꾸면 이전 발화를 끊고, 늦게 끝난 옛 발화가 새 재생 상태를 지우지 않는다', async () => {
    const sp = deferredSpeaker()
    const p = new ResultsRelisten(sp)
    p.toggle(0, 'The cats sat down.')
    p.toggle(1, 'Second one.')
    expect(sp.speak).toHaveBeenLastCalledWith('Second one.')
    sp.pending[0]() // 옛 발화가 늦게 끝남
    await flush()
    expect(p.playingIdx).toBe(1)
    sp.pending[1]()
    await flush()
    expect(p.playingIdx).toBeNull()
  })

  it('정지 뒤 늦은 완료는 상태를 되살리지 않고 다시 읽지 않는다', async () => {
    const sp = deferredSpeaker()
    const p = new ResultsRelisten(sp)
    p.toggle(0, 'The cats sat down.')
    p.stop()
    sp.pending[0]()
    await flush()
    expect(p.playingIdx).toBeNull()
    expect(sp.speak).toHaveBeenCalledTimes(1)
  })

  it('발화 실패도 재생 상태를 푼다', async () => {
    const p = new ResultsRelisten({ speak: () => Promise.reject(new Error('x')), cancel: vi.fn() })
    p.toggle(0, 'a')
    await flush()
    expect(p.playingIdx).toBeNull()
  })
})

describe('DictationAttemptRows', () => {
  const speaker = { speak: vi.fn(() => Promise.resolve()), cancel: vi.fn() }

  it('주인 확인 시 행마다 44px 다시 듣기 · 당시 피드백 버튼과 focus 표시', () => {
    const html = renderToString(
      <DictationAttemptRows attempts={attempts} reviewEnabled speaker={speaker} voiceAvailable />,
    )
    expect((html.match(/data-testid="attempt-relisten"/g) ?? []).length).toBe(3)
    expect((html.match(/data-testid="attempt-feedback-toggle"/g) ?? []).length).toBe(3)
    expect(html).toContain('min-h-[44px]')
    expect(html).toContain('focus-visible:ring-2')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('이 기기 음성')
    expect(html).not.toContain('data-testid="attempt-feedback"')
  })

  it('주인 미확인(확인 중 · 다른 계정)이면 복습 조작을 그리지 않는다', () => {
    const html = renderToString(
      <DictationAttemptRows attempts={attempts} reviewEnabled={false} speaker={speaker} voiceAvailable />,
    )
    expect(html).not.toContain('attempt-relisten')
    expect(html).not.toContain('attempt-feedback-toggle')
    expect(html).toContain('The cats sat down.')
  })

  it('영어 음성이 없으면 알리고 다시 듣기만 감추며 피드백은 남긴다', () => {
    const html = renderToString(
      <DictationAttemptRows attempts={attempts} reviewEnabled speaker={speaker} voiceAvailable={false} />,
    )
    expect(html).toContain('data-testid="relisten-no-voice"')
    expect(html).not.toContain('data-testid="attempt-relisten"')
    expect((html.match(/data-testid="attempt-feedback-toggle"/g) ?? []).length).toBe(3)
  })

  it('렌더만으로 발화 · 기록 함수를 부르지 않는다', () => {
    renderToString(<DictationAttemptRows attempts={attempts} reviewEnabled speaker={speaker} voiceAvailable />)
    expect(speaker.speak).not.toHaveBeenCalled()
    expect(recordSpies.flush).not.toHaveBeenCalled()
    expect(recordSpies.saveAttempt).not.toHaveBeenCalled()
    expect(recordSpies.complete).not.toHaveBeenCalled()
  })
})

describe('AttemptFeedback', () => {
  it('단어 상태를 글자 라벨로, 오류 태그를 label · coach 로 보인다', () => {
    const html = renderToString(<AttemptFeedback attempt={attempts[0]} />)
    for (const l of ['정답', '철자', '누락', '정답 cats']) expect(html).toContain(l)
    expect(html).toContain(ERROR_TAG_META.inflection.label)
    expect(html).toContain(ERROR_TAG_META['tail-drop'].label)
  })
  it('기록 없는 옛 문항은 피드백 없음, 건너뜀은 따로 구분', () => {
    expect(renderToString(<AttemptFeedback attempt={attempts[1]} />)).toContain('피드백 없음')
    const skipped = renderToString(<AttemptFeedback attempt={attempts[2]} />)
    expect(skipped).toContain('건너뛴 문항')
    expect(skipped).not.toContain('피드백 없음')
  })
})

describe('주인 결속(StoryAuthGuard)', () => {
  it('다른 계정(B)로 바뀌면 changed — 결과 화면은 복습을 끄고 결과를 숨긴다', () => {
    const g = new StoryAuthGuard('user-a')
    expect(g.status).toBe('checking')
    g.observe({ event: 'KNOWN', userId: 'user-a' })
    expect(g.status).toBe('same')
    g.observe({ event: 'SIGNED_IN', userId: 'user-b' })
    expect(g.status).toBe('changed')
  })
})
