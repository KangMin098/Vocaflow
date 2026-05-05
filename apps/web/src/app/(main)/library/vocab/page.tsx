// apps/web/src/app/(main)/library/vocab/page.tsx
//
// /library/vocab — 공용 단어장.
// ModuleHero(보라 gradient) + VocabSetGrid(CategoryFilter + Grid).

import { Layers } from 'lucide-react'

import { ModuleHero } from '@/components/hub/ModuleHero'
import { VocabSetGrid } from '@/components/library/vocab/VocabSetGrid'
import { MOCK_VOCAB_SETS } from '@/components/library/vocab/mock-data'
import { VOCAB_CATEGORIES } from '@/components/library/vocab/categories'

export const metadata = {
  title: '공용 단어장 · Vocaflow',
  description: '함께 만든 어휘 자산',
}

export default function LibraryVocabPage() {
  const setCount = MOCK_VOCAB_SETS.length
  const categoryCount = VOCAB_CATEGORIES.length - 1 // 'all' 제외

  return (
    <div className="flex flex-col gap-6">
      <ModuleHero
        eyebrow="라이브러리 · 단어장"
        title="📚 공용 단어장"
        note={`총 ${setCount}개 세트 · 카테고리 ${categoryCount}종`}
        gradient={{ from: '#8B5CF6', to: '#6D28D9' }}
        icon={Layers}
      />
      <VocabSetGrid />
    </div>
  )
}
