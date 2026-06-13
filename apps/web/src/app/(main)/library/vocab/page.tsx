// apps/web/src/app/(main)/library/vocab/page.tsx
//
// /library/vocab — 공용 단어장 (실 데이터 · Supabase shared_word_sets).
// Server Component: 게시된 세트 + 현재 사용자 구독 상태 fetch → 클라이언트 그리드로 전달.

import { Layers } from 'lucide-react'

import { Capsule, Screen } from '@/components/ui/ios'
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

  return (
    <Screen width="wide" background="bg2" padX="md">
      <div className="flex flex-col gap-5 py-6 md:py-8">
        <header className="flex flex-col gap-3 px-1">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="inline-flex h-8 w-8 items-center justify-center rounded-ios-sm bg-ios-purple text-white"
            >
              <Layers size={16} />
            </span>
            <h1 className="font-display text-[32px] font-[700] tracking-[-0.028em] leading-[1.05] text-[var(--t1)] md:text-[34px]">
              공용 단어장
            </h1>
          </div>
          <p className="font-body text-[15px] text-[var(--t2)]">
            함께 만든 어휘 자산 — 큐레이션된 단어 컬렉션을 내 단어장에 추가하세요.
          </p>
          {setCount > 0 && (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Capsule label="세트" value={`${setCount}개`} />
              <Capsule label="단어" value={`${totalWords.toLocaleString()}`} />
              <Capsule label="카테고리" value={`${categoryCount}종`} />
              {subscribedCount > 0 && (
                <Capsule tone="green" label="구독" value={`${subscribedCount}개`} />
              )}
            </div>
          )}
        </header>

        <VocabSetGrid
          sets={sets}
          subscribedIds={Array.from(subscribedSet)}
          isLoggedIn={!!user}
        />
      </div>
    </Screen>
  )
}
