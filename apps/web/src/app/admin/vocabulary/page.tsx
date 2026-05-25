// apps/web/src/app/admin/vocabulary/page.tsx
// 사전 DB 직접 관리 (Dictionary Curation) — Server Component.
//
// URL params:
//   q          — 검색어 (word/meaning_ko/lemma_band ILIKE)
//   v          — v_level 0-11 또는 'null' (미분류)
//   cefr       — A1-C2
//   pos        — primary_pos
//   source     — imported/ai-generated/kice-orphan
//   verified   — true/false
//   page       — 1-based
//   selected   — 선택된 단어 (detail panel)

import { Suspense } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { BookMarked } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import {
  fetchDictSearchFacets,
  fetchDictWordDetail,
  searchDictWords,
} from '@/lib/admin/dict/word-search'

import { VocabularyBrowserClient } from './VocabularyBrowserClient'

export const metadata = {
  title: '사전 DB 직접 관리 — Vocaflow Admin',
  description: 'shared_dictionary 검색 + 다차원 분류 정합 검토',
}

export const revalidate = 0 // 항상 fresh (search interactive)

interface PageProps {
  searchParams?: {
    q?: string
    v?: string
    cefr?: string
    pos?: string
    source?: string
    verified?: string
    page?: string
    selected?: string
  }
}

export default async function AdminVocabularyPage({ searchParams }: PageProps) {
  await requireAdmin('/admin/vocabulary')
  const sp = searchParams ?? {}

  return (
    <div className="flex flex-col gap-6 p-6">
      <AdminPageHeader
        icon={BookMarked}
        title="사전 DB 직접 관리"
        description="shared_dictionary 검색 + 다차원 분류 정합 검토 (V-Level / Track / Domain / Skill / CEFR / register)"
      />
      <Suspense fallback={<PageFallback />}>
        <PageContent searchParams={sp} />
      </Suspense>
    </div>
  )
}

async function PageContent({ searchParams: sp }: { searchParams: NonNullable<PageProps['searchParams']> }) {
  const client = (await createClient()) as unknown as SupabaseClient

  // URL params parse
  const q = sp.q?.trim() || undefined
  const vLevel =
    sp.v === 'null'
      ? ('null' as const)
      : sp.v != null && /^\d+$/.test(sp.v)
        ? parseInt(sp.v, 10)
        : undefined
  const cefr = sp.cefr || undefined
  const pos = sp.pos || undefined
  const source = sp.source || undefined
  const verified =
    sp.verified === 'true' ? true : sp.verified === 'false' ? false : undefined
  const page = sp.page && /^\d+$/.test(sp.page) ? parseInt(sp.page, 10) : 1
  const selected = sp.selected?.trim() || undefined

  // 병렬 fetch
  const [result, facets, selectedDetail] = await Promise.all([
    searchDictWords(client, {
      q,
      vLevel,
      cefr,
      primaryPos: pos,
      source,
      verified,
      page,
    }),
    fetchDictSearchFacets(client),
    selected ? fetchDictWordDetail(client, selected) : Promise.resolve(null),
  ])

  return (
    <VocabularyBrowserClient
      result={result}
      facets={facets}
      selectedDetail={selectedDetail}
      currentFilters={{
        q: q ?? '',
        v: sp.v ?? '',
        cefr: cefr ?? '',
        pos: pos ?? '',
        source: source ?? '',
        verified: sp.verified ?? '',
        page,
        selected: selected ?? '',
      }}
    />
  )
}

function PageFallback() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-12 animate-pulse rounded-[var(--r-md)] bg-[var(--bg2)]" />
      <div className="h-96 animate-pulse rounded-[var(--r-xl)] bg-[var(--bg2)]" />
    </div>
  )
}
