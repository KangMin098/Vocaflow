// apps/web/src/app/(main)/flashcard/play/page.tsx
// Flashcard 학습 세션 — hub(/flashcard) 또는 워크스페이스 "카드" pill 에서 진입.
//
// ?set={챕터 단어장 id} | ?text={스크립트 texts.id} 가 있으면 그 자료의 단어를
// 실제로 fetch (lib/flashcard/scoped-words). 없으면 기존 mock (hub 일반 진입 호환).

import type { SupabaseClient } from '@supabase/supabase-js'

import { FlashcardSession } from '@/components/flashcard/FlashcardSession'
import { MOCK_FLASHCARD_WORDS } from '@/components/flashcard/mock-data'
import { ResourceContext } from '@/components/layout/ResourceContext'
import { fetchScopedFlashcardWords } from '@/lib/flashcard/scoped-words'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'Flashcard 학습 · Vocaflow',
}

interface PageProps {
  searchParams?: { set?: string; text?: string }
}

export default async function FlashcardPlayPage({ searchParams }: PageProps) {
  const set = searchParams?.set
  const text = searchParams?.text

  // 스코프 진입 (워크스페이스 "카드" pill) — 자료의 실제 단어 fetch
  if (set || text) {
    const client = (await createClient()) as unknown as SupabaseClient
    const {
      data: { user },
    } = await client.auth.getUser()
    const scoped = await fetchScopedFlashcardWords(client, {
      set,
      text,
      userId: user?.id ?? null,
    })

    if (scoped && scoped.words.length > 0) {
      return (
        <>
          <ResourceContext
            resource={{
              type: set ? 'vocab' : 'script',
              label: scoped.title,
              position: scoped.subtitle,
              href: '/text',
            }}
            total={scoped.words.length}
          />
          <FlashcardSession initialWords={scoped.words} />
        </>
      )
    }

    // 스코프는 유효하나 단어 0개 — mock 대신 빈 상태 안내
    return <ScopedEmpty title={scoped?.title ?? null} />
  }

  // 일반 진입 (hub) — 기존 mock 유지
  return (
    <>
      <ResourceContext
        resource={{
          type: 'vocab',
          label: '내 단어 자산 · SRS 큐',
          position: `오늘 ${MOCK_FLASHCARD_WORDS.length}개`,
          href: '/wordvault',
        }}
        total={MOCK_FLASHCARD_WORDS.length}
      />
      <FlashcardSession initialWords={MOCK_FLASHCARD_WORDS} />
    </>
  )
}

function ScopedEmpty({ title }: { title: string | null }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-24 text-center">
      <div className="select-none text-4xl" aria-hidden>
        🃏
      </div>
      <h1 className="font-display text-[16px] font-[700] text-[var(--t1)]">
        {title ? `"${title}" 에 학습할 단어가 아직 없어요` : '학습할 단어가 없어요'}
      </h1>
      <p className="font-body text-[13px] leading-relaxed text-[var(--t3)]">
        이 자료의 단어장이 비어 있어요. 본문에서 단어를 추가하거나 단어장을 먼저 살펴보세요.
      </p>
      <a
        href="/wordvault"
        className="rounded-[var(--r-md)] bg-[var(--p)] px-5 py-2.5 font-display text-[13px] font-[700] text-[var(--ti)] transition-colors hover:bg-[var(--p-hover)]"
      >
        내 단어장으로
      </a>
    </div>
  )
}
