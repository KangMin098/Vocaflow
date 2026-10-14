// apps/web/src/app/dev/vocab-practice/fixtures.ts
//
// v6.2 P-F8d — 격리 개발 화면용 **합성** 어휘 문항(vocab_choice 모양). DB 문항 · 출판물 문장이 아니다(직접 지은 문장).
// 저장 payload 와 같은 모양으로 적고 `parseUnderlinePayload` 를 거쳐 화면에 낸다 — 파서 · 플레이어 · 채점 계약을 함께 시험한다.

import type { DcpItem } from '@/lib/learner/dcp'
import { parseUnderlinePayload } from '@/lib/learner/dcp-underline'

interface Fixture {
  id: string
  payload: { sentences: string[]; underlines: { word: string; label: string; sentenceIdx: number }[] }
  answerKey: { position: number; original: string; explanation_ko: string }
}

export const VOCAB_FIXTURES: Fixture[] = [
  {
    id: 'fixture-vocab-1',
    payload: {
      sentences: [
        'Our school garden started as a small project in a corner of the yard.',
        'Students planted beans and tomatoes, and they ignored them every morning.',
        'Because the soil was poor, the first harvest was disappointing.',
        'The next year, the class added compost and the plants grew much stronger.',
        'Now the garden supplies vegetables for the cafeteria twice a month.',
      ],
      underlines: [
        { word: 'small', label: '①', sentenceIdx: 0 },
        { word: 'ignored', label: '②', sentenceIdx: 1 },
        { word: 'disappointing', label: '③', sentenceIdx: 2 },
        { word: 'stronger', label: '④', sentenceIdx: 3 },
        { word: 'supplies', label: '⑤', sentenceIdx: 4 },
      ],
    },
    answerKey: {
      position: 2,
      original: 'watered',
      explanation_ko: '② "ignored" 가 문맥에 맞지 않는다. 학생들이 콩과 토마토를 심고 매일 아침 돌봤다는 흐름이므로 "물을 주었다(watered)" 가 와야 한다. 나머지 ① small · ③ disappointing · ④ stronger · ⑤ supplies 는 각 문장의 뜻과 맞는다.',
    },
  },
  {
    id: 'fixture-vocab-2',
    payload: {
      sentences: [
        'Many cities are planting trees to cool their streets in summer.',
        'Trees block sunlight and release water vapor through their leaves.',
        'As a result, shaded streets can be several degrees warmer than open ones.',
        'Residents also report that tree-lined streets feel calmer.',
        'For these reasons, urban forests are becoming a common part of city planning.',
      ],
      underlines: [
        { word: 'cool', label: '①', sentenceIdx: 0 },
        { word: 'release', label: '②', sentenceIdx: 1 },
        { word: 'warmer', label: '③', sentenceIdx: 2 },
        { word: 'calmer', label: '④', sentenceIdx: 3 },
        { word: 'common', label: '⑤', sentenceIdx: 4 },
      ],
    },
    answerKey: {
      position: 3,
      original: 'cooler',
      explanation_ko: '③ "warmer" 가 문맥에 맞지 않는다. 나무가 햇빛을 막고 수증기를 내보내 거리를 식힌다는 흐름이므로, 그늘진 거리는 탁 트인 거리보다 몇 도 "더 시원하다(cooler)" 가 와야 한다.',
    },
  },
]
// 정답이 하나뿐인 문항만 낸다(유일 정답 원칙) — position 이 1~5 밖이면 뺀다
const PLAYABLE = VOCAB_FIXTURES.filter((f) => f.answerKey.position >= 1 && f.answerKey.position <= 5)

export function fixtureItems(): DcpItem[] {
  return PLAYABLE.flatMap((f) => {
    const payload = parseUnderlinePayload('vocab_choice', f.payload)
    return payload ? [{ id: f.id, type: 'vocab_choice' as const, paragraphIdx: 0, payload }] : []
  })
}

export function fixtureKey(id: string): Fixture['answerKey'] | null {
  return PLAYABLE.find((f) => f.id === id)?.answerKey ?? null
}
