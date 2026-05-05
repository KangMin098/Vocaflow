// apps/web/src/app/(main)/spellforge/play/page.tsx
// SpellForge 학습 세션 — hub(/spellforge) 에서 진입

import { ResourceContext } from '@/components/layout/ResourceContext'
import { SpellForge } from '@/components/spellforge/SpellForge'
import type { SpellForgeWord } from '@/types/spellforge'

const MOCK_TEXT_TITLE = 'The Great Gatsby'

const MOCK_WORDS: SpellForgeWord[] = [
  {
    id: 'w1',
    text: 'advantages',
    meaning: '유리한 점, 이점',
    pronunciation: '/ədˈvæntɪdʒɪz/',
    pos: 'Noun · Plural',
    status: 'shaky',
    exampleSentence: '"All the people in this world haven\'t had the advantages that you\'ve had."',
  },
  {
    id: 'w2',
    text: 'criticizing',
    meaning: '비판하는',
    pronunciation: '/ˈkrɪtɪˌsaɪzɪŋ/',
    pos: 'Verb · Gerund',
    status: 'shaky',
    exampleSentence: '"Whenever you feel like criticizing any one..."',
  },
  {
    id: 'w3',
    text: 'communicative',
    meaning: '의사 소통의',
    pronunciation: '/kəˈmjuːnɪkətɪv/',
    pos: 'Adjective',
    status: 'risk',
    exampleSentence: '"...we\'ve always been unusually communicative in a reserved way..."',
  },
]

export const metadata = {
  title: 'SpellForge 학습 · Vocaflow',
}

export default function SpellForgePlayPage() {
  return (
    <>
      <ResourceContext
        resource={{
          type: 'script',
          label: MOCK_TEXT_TITLE,
          position: `${MOCK_WORDS.length}개 단어`,
          href: '/text',
        }}
        total={MOCK_WORDS.length}
      />
      <SpellForge textId="all" textTitle={MOCK_TEXT_TITLE} words={MOCK_WORDS} />
    </>
  )
}
