// apps/web/src/app/(main)/spellforge/play/page.tsx
// SpellForge 학습 세션 — hub(/spellforge) 에서 진입.
// 사용자 SRS 큐의 due 단어를 실데이터로 제시 (lib/spellforge/hub-words).
// 영속화는 SpellForge 컴포넌트가 pushPendingResult → flushPendingSession 으로 처리.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@vocaflow/types'

import { ResourceContext } from '@/components/layout/ResourceContext'
import { SpellForge } from '@/components/spellforge/SpellForge'
import { fetchDueSpellForgeWords } from '@/lib/spellforge/hub-words'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'SpellForge 학습 · Vocaflow',
}

export default async function SpellForgePlayPage() {
  const client = (await createClient()) as unknown as SupabaseClient<Database>
  const {
    data: { user },
  } = await client.auth.getUser()

  if (!user) return <HubEmpty reason="auth" />

  const words = await fetchDueSpellForgeWords(client, user.id)
  if (words.length === 0) return <HubEmpty reason="empty" />

  return (
    <>
      <ResourceContext
        resource={{
          type: 'vocab',
          label: '내 단어 자산 · SRS 큐',
          position: `${words.length}개 단어`,
          href: '/wordvault',
        }}
        total={words.length}
      />
      <SpellForge textId="all" textTitle="내 단어장" words={words} />
    </>
  )
}

function HubEmpty({ reason }: { reason: 'auth' | 'empty' }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-24 text-center">
      <div className="select-none text-4xl" aria-hidden>
        ⌨️
      </div>
      <h1 className="font-display text-[16px] font-[700] text-[var(--t1)]">
        {reason === 'auth' ? '로그인이 필요해요' : '연습할 단어가 아직 없어요'}
      </h1>
      <p className="font-body text-[13px] leading-relaxed text-[var(--t3)]">
        {reason === 'auth'
          ? '로그인하면 내 단어장의 철자 연습 단어를 학습할 수 있어요.'
          : '단어장에 단어를 추가하면 SRS 큐에서 연습 단어가 채워져요. 본문에서 단어를 모으거나 단어장을 살펴보세요.'}
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
