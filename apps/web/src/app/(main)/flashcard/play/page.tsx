// apps/web/src/app/(main)/flashcard/play/page.tsx
// Flashcard 학습 세션 — hub(/flashcard) 또는 워크스페이스 "카드" pill 에서 진입.
//
// ?set={챕터 단어장 id} | ?text={스크립트 texts.id} 가 있으면 그 자료의 단어를
// 실제로 fetch (lib/flashcard/scoped-words). 없으면 사용자 SRS 큐의 due 단어(lib/flashcard/hub-words).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@vocaflow/types'

import { FlashcardSession } from '@/components/flashcard/FlashcardSession'
import { ResourceContext } from '@/components/layout/ResourceContext'
import { fetchDueFlashcardWords } from '@/lib/flashcard/hub-words'
import { fetchScopedFlashcardWords } from '@/lib/flashcard/scoped-words'
import { resolveSessionReturnHref } from '@/lib/layout/session-return'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'Flashcard 학습 · Vocaflow',
}

interface PageProps {
  searchParams?: { set?: string; text?: string; chapter?: string; from?: string }
}

export default async function FlashcardPlayPage({ searchParams }: PageProps) {
  const set = searchParams?.set
  const text = searchParams?.text
  // 세트 내 특정 챕터만 학습 (?set=…&chapter=N) — 유효 양수만
  const chapterNum = searchParams?.chapter ? parseInt(searchParams.chapter, 10) : NaN
  const chapter = Number.isInteger(chapterNum) && chapterNum > 0 ? chapterNum : null
  // 닫기 복귀: ?from 우선 → 스코프 텍스트 → hub (스코프 단어 id 오용 방지)
  const backHref = resolveSessionReturnHref(searchParams?.from, text, '/flashcard')

  // 스코프 진입 (워크스페이스 "카드" pill) — 자료의 실제 단어 fetch
  if (set || text) {
    const client = (await createClient()) as unknown as SupabaseClient
    const {
      data: { user },
    } = await client.auth.getUser()
    const scoped = await fetchScopedFlashcardWords(client, {
      set,
      text,
      chapter,
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
          <FlashcardSession initialWords={scoped.words} backHref={backHref} />
        </>
      )
    }

    // 스코프는 유효하나 단어 0개 — mock 대신 빈 상태 안내
    return <ScopedEmpty title={scoped?.title ?? null} />
  }

  // 일반 진입 (hub) — 사용자 SRS 큐의 due 단어 (실데이터)
  const client = (await createClient()) as unknown as SupabaseClient<Database>
  const {
    data: { user },
  } = await client.auth.getUser()

  if (!user) return <HubEmpty reason="auth" />

  const words = await fetchDueFlashcardWords(client, user.id)
  if (words.length === 0) return <HubEmpty reason="empty" />

  return (
    <>
      <ResourceContext
        resource={{
          type: 'vocab',
          label: '내 단어 자산 · SRS 큐',
          position: `오늘 ${words.length}개`,
          href: '/wordvault',
        }}
        total={words.length}
      />
      <FlashcardSession initialWords={words} backHref={backHref} />
    </>
  )
}

function HubEmpty({ reason }: { reason: 'auth' | 'empty' }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-24 text-center">
      <div className="select-none text-4xl" aria-hidden>
        🃏
      </div>
      <h1 className="font-display text-[16px] font-[700] text-[var(--t1)]">
        {reason === 'auth' ? '로그인이 필요해요' : '복습할 단어가 아직 없어요'}
      </h1>
      <p className="font-body text-[13px] leading-relaxed text-[var(--t3)]">
        {reason === 'auth'
          ? '로그인하면 내 단어장의 복습 카드를 학습할 수 있어요.'
          : '단어장에 단어를 추가하면 SRS 큐에서 복습 카드가 채워져요. 본문에서 단어를 모으거나 단어장을 살펴보세요.'}
      </p>
      <a
        href={reason === 'auth' ? '/login' : '/wordvault'}
        className="rounded-[var(--r-md)] bg-[var(--p)] px-5 py-2.5 font-display text-[13px] font-[700] text-[var(--ti)] transition-colors hover:bg-[var(--p-hover)]"
      >
        {reason === 'auth' ? '로그인' : '내 단어장으로'}
      </a>
    </div>
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
