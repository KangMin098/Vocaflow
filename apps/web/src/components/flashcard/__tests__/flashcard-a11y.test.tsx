// apps/web/src/components/flashcard/__tests__/flashcard-a11y.test.tsx
//
// T-0175 — /flashcard/play axe serious 3건(nested-interactive · aria-progressbar-name · aria-hidden-focus)의
// 마크업 계약을 잠근다. 숨은 판정 묶음의 inert(포커스 차단)는 ref 로 걸려 SSR 문자열에 나오지 않으므로
// 실제 Chromium 증거(runtime/t0175 after-axe.json)가 맡고, 여기서는 정적 마크업만 본다.

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { createInitialSRS } from '@/lib/srs/sm2'
import type { FlashcardWord } from '@/types/flashcard'

import { Card } from '../Card'
import { RecallPhase } from '../RecallPhase'

const word: FlashcardWord = {
  id: 'w1',
  text: 'luminous',
  meaning: '빛나는',
  pronunciation: '/ˈluːmɪnəs/',
  pos: 'adjective',
  exampleSentence: 'The dial has luminous markers.',
  exampleSentenceWithBlank: 'The dial has ____ markers.',
  textId: 't1',
  textTitle: '내 단어장',
  textChapter: '',
  srs: createInitialSRS(),
}

const card = (phase: 'recall' | 'flippable' | 'flipped') =>
  renderToString(
    <Card
      word={word}
      phase={phase}
      hintVisible={false}
      isAudioPlaying={false}
      canPlayAudio
      isExampleAudioPlaying={false}
      onPlayAudio={() => {}}
      onClick={() => {}}
      swipeDirection={null}
      cardChangeKey={0}
    />,
  )

describe('Flashcard 접근성 마크업', () => {
  it('카드 면은 역할 없는 클릭 면이다 — 안의 버튼과 상호작용이 겹치지 않는다(nested-interactive)', () => {
    const html = card('flippable')
    expect(html).not.toMatch(/role="button"/)
    // 안에는 북마크·발음 버튼과 뒤집기 버튼이 있다 — 바깥이 버튼 역할이면 중첩이다
    expect(html).toMatch(/aria-label="북마크 추가"/)
    expect(html).toMatch(/aria-label="발음 듣기"/)
  })

  it('키보드 뒤집기 컨트롤은 낱말을 이름에 담은 네이티브 버튼이다', () => {
    const html = card('flippable')
    expect(html).toMatch(/<button[^>]*data-card-flip[^>]*aria-label="luminous — 카드 뒤집어 정답 확인"[^>]*aria-disabled="false"/)
  })

  it('회상 중에는 뒤집기 버튼이 비활성으로 알려진다', () => {
    expect(card('recall')).toMatch(/<button[^>]*data-card-flip[^>]*aria-disabled="true"/)
  })

  it('회상 타이머 진행 막대에 접근 가능한 이름이 있다(aria-progressbar-name)', () => {
    const html = renderToString(<RecallPhase visible progress={42.7} label="머리 속에서 뜻을 떠올려보세요" />)
    expect(html).toMatch(/role="progressbar"[^>]*aria-label="회상 시간"[^>]*aria-valuenow="43"/)
  })
})
