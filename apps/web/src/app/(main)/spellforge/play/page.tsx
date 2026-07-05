// apps/web/src/app/(main)/spellforge/play/page.tsx
// SpellForge 학습 세션 — hub(/spellforge) 또는 계획 launch 에서 진입.
//
// ?set={단어장 id} | ?text={스크립트 texts.id} 가 있으면 그 자료의 단어를 실제로 fetch
// (lib/spellforge/scoped-words). 없으면 사용자 SRS 큐의 due 단어(lib/spellforge/hub-words).
// 영속화는 SpellForge 컴포넌트가 pushPendingResult → flushPendingSession 으로 처리.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@vocaflow/types'

import { ResourceContext } from '@/components/layout/ResourceContext'
import { SpellForge } from '@/components/spellforge/SpellForge'
import { resolveSessionReturnHref } from '@/lib/layout/session-return'
import { fetchDueSpellForgeWords } from '@/lib/spellforge/hub-words'
import { fetchScopedSpellForgeWords } from '@/lib/spellforge/scoped-words'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'SpellForge 학습 · Vocaflow',
}

interface PageProps {
  searchParams?: { set?: string; text?: string; from?: string }
}

export default async function SpellForgePlayPage({ searchParams }: PageProps) {
  const set = searchParams?.set
  const text = searchParams?.text
  // 닫기/완료 복귀: ?from 우선 → 스코프 텍스트 → hub
  const backHref = resolveSessionReturnHref(searchParams?.from, text, '/spellforge')
  const client = (await createClient()) as unknown as SupabaseClient<Database>
  const {
    data: { user },
  } = await client.auth.getUser()

  // 스코프 진입 (계획 launch) — 그 자료의 실제 단어
  if (set || text) {
    const scoped = await fetchScopedSpellForgeWords(client as unknown as SupabaseClient, {
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
              position: `${scoped.words.length}개 단어`,
              href: '/text',
            }}
            total={scoped.words.length}
          />
          <SpellForge
            textId={set ? 'vocab' : 'script'}
            textTitle={scoped.title}
            words={scoped.words}
            backHref={backHref}
          />
        </>
      )
    }
    return <HubEmpty reason="empty" />
  }

  // 일반 진입 (hub) — 사용자 SRS 큐의 due 단어
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
      <SpellForge textId="all" textTitle="내 단어장" words={words} backHref={backHref} />
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
