// apps/web/src/app/(main)/library/vocab/page.tsx
//
// /library/vocab — 공용 단어장 (실 데이터 · Supabase shared_word_sets).
// Server Component: 게시된 세트 + 현재 사용자 구독 상태 fetch → 클라이언트 그리드로 전달.

import { Layers } from 'lucide-react'

import { ModuleHero } from '@/components/hub/ModuleHero'
import { VocabSetGrid } from '@/components/library/vocab/VocabSetGrid'
import { VOCAB_CATEGORIES } from '@/components/library/vocab/categories'
import { createClient } from '@/lib/supabase/server'
import { fetchPublishedSets, fetchUserSubscriptions } from '@/lib/library/vocab/queries'

export const metadata = {
  title: '공용 단어장 · Vocaflow',
  description: '함께 만든 어휘 자산 — 큐레이션된 단어 컬렉션을 내 단어장에 추가하세요.',
}

export const dynamic = 'force-dynamic' // 로그인 상태/구독 상태가 사용자별로 다름

export default async function LibraryVocabPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [sets, subscribedSet] = await Promise.all([
    fetchPublishedSets(supabase),
    fetchUserSubscriptions(supabase, user?.id ?? null),
  ])

  const setCount = sets.length
  const totalWords = sets.reduce((sum, s) => sum + s.wordCount, 0)
  const subscribedCount = subscribedSet.size
  const categoryCount = VOCAB_CATEGORIES.length - 1 // 'all' 제외

  const note =
    setCount === 0
      ? '곧 다양한 단어장이 추가될 예정이에요'
      : subscribedCount > 0
        ? `${setCount}개 세트 · 내가 구독 ${subscribedCount}개 · 총 ${totalWords.toLocaleString()}개 단어`
        : `${setCount}개 세트 · 카테고리 ${categoryCount}종 · 총 ${totalWords.toLocaleString()}개 단어`

  return (
    <div className="flex flex-col gap-6">
      <ModuleHero
        eyebrow="라이브러리 · 단어장"
        title="📚 공용 단어장"
        note={note}
        gradient={{ from: '#1F2937', to: '#0F172A' }}
        icon={Layers}
      />
      <VocabSetGrid
        sets={sets}
        subscribedIds={Array.from(subscribedSet)}
        isLoggedIn={!!user}
      />
    </div>
  )
}
