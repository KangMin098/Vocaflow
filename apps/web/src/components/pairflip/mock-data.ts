// apps/web/src/components/pairflip/mock-data.ts
// 10쌍 mock — 5단계 난이도(최대 Master 10쌍) 모두 커버

import type { PairFlipCard } from './types'

export interface PairFlipMockWord {
  pairId: string
  word: string
  meaning: string
  partOfSpeech?: string
  phonetic?: string
}

export const MOCK_PAIRS: PairFlipMockWord[] = [
  {
    pairId: 'p1',
    word: 'evolution',
    meaning: '진화, 발전',
    partOfSpeech: 'noun',
    phonetic: '/ˌiː.vəˈluː.ʃən/',
  },
  {
    pairId: 'p2',
    word: 'adapt',
    meaning: '적응하다',
    partOfSpeech: 'verb',
    phonetic: '/əˈdæpt/',
  },
  {
    pairId: 'p3',
    word: 'thrive',
    meaning: '번창하다',
    partOfSpeech: 'verb',
    phonetic: '/θraɪv/',
  },
  {
    pairId: 'p4',
    word: 'predator',
    meaning: '포식자',
    partOfSpeech: 'noun',
    phonetic: '/ˈpred.ə.tər/',
  },
  {
    pairId: 'p5',
    word: 'survive',
    meaning: '살아남다',
    partOfSpeech: 'verb',
    phonetic: '/sərˈvaɪv/',
  },
  {
    pairId: 'p6',
    word: 'habitat',
    meaning: '서식지',
    partOfSpeech: 'noun',
    phonetic: '/ˈhæb.ɪ.tæt/',
  },
  {
    pairId: 'p7',
    word: 'prey',
    meaning: '먹이',
    partOfSpeech: 'noun',
    phonetic: '/preɪ/',
  },
  {
    pairId: 'p8',
    word: 'extinct',
    meaning: '멸종된',
    partOfSpeech: 'adj',
    phonetic: '/ɪkˈstɪŋkt/',
  },
  {
    pairId: 'p9',
    word: 'species',
    meaning: '종, 종류',
    partOfSpeech: 'noun',
    phonetic: '/ˈspiː.ʃiːz/',
  },
  {
    pairId: 'p10',
    word: 'mutation',
    meaning: '돌연변이',
    partOfSpeech: 'noun',
    phonetic: '/mjuːˈteɪ.ʃən/',
  },
]

/**
 * 카드 생성 + 짝 분리 + 랜덤 위치 배치 (Fisher-Yates shuffle)
 */
export function buildPairFlipCards(pairs: PairFlipMockWord[]): PairFlipCard[] {
  const cards: PairFlipCard[] = pairs.flatMap((p, idx) => [
    {
      id: `${p.pairId}-w`,
      pairId: p.pairId,
      type: 'word' as const,
      content: p.word,
      partOfSpeech: p.partOfSpeech,
      phonetic: p.phonetic,
      state: 'covered' as const,
      position: 0,
      attempts: 0,
      patternIndex: idx % 5,
    },
    {
      id: `${p.pairId}-m`,
      pairId: p.pairId,
      type: 'meaning' as const,
      content: p.meaning,
      partOfSpeech: p.partOfSpeech,
      state: 'covered' as const,
      position: 0,
      attempts: 0,
      patternIndex: idx % 5,
    },
  ])

  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[cards[i], cards[j]] = [cards[j], cards[i]]
  }
  cards.forEach((c, idx) => {
    c.position = idx
  })
  return cards
}
