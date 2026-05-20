// apps/web/src/components/wordvault/hooks/useHubStats.ts
//
// WordVault 허브 실 데이터 fetcher (Phase 2 단계 진입).
// - vocabularies 최소 projection (FSRS 6 + text_id + shared_set_id + created_at)
// - 클라이언트 측에서 R(t) 계산하여 4-bucket 산출
// - 컬렉션 수 = 보유 단어가 있는 스크립트(text_id) + 구독 단어장(shared_set_id) distinct 합
// - 누적일 = 가장 오래된 vocab.created_at 부터 오늘까지 일수
// - books = 구독 공용 단어장 + 스크립트 책 (BookShelfSection 용 VaultBook 변환)
//
// 본 훅으로 Hero/VaultBar + BookShelfSection 까지 실 데이터화.
// CEFRDistribution·LearningDimension·WordPeek 은 여전히 mock.

'use client'

import { useEffect, useState } from 'react'

import type { VaultBook } from '@/components/wordvault/hub/BookShelfSection'
import { getMemoryState, type MemoryState, type ModuleId } from '@/lib/srs'
import { createClient } from '@/lib/supabase/client'

export interface HubStats {
  total: number
  buckets: Record<MemoryState, number>
  collectionsCount: number
  accumulatedDays: number
  /** BookShelfSection 용 실 데이터 책 — 구독 공용 단어장 + 스크립트 */
  books: VaultBook[]
}

export type HubStatsState =
  | { status: 'loading'; data: null }
  | { status: 'unauthenticated'; data: null }
  | { status: 'error'; data: null; message: string }
  | { status: 'ready'; data: HubStats }

interface PerBucket {
  stable: number
  shaky: number
  risk: number
  new: number
}
const emptyBucket = (): PerBucket => ({ stable: 0, shaky: 0, risk: 0, new: 0 })

export function useHubStats(): HubStatsState {
  const [state, setState] = useState<HubStatsState>({ status: 'loading', data: null })

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancelled) return
      if (!user) {
        setState({ status: 'unauthenticated', data: null })
        return
      }

      const { data: rows, error } = await supabase
        .from('vocabularies')
        .select(
          'id, difficulty, stability, last_review_at, next_review_at, module_history, review_count, text_id, shared_set_id, created_at',
        )
        .eq('user_id', user.id)

      if (cancelled) return
      if (error) {
        setState({ status: 'error', data: null, message: error.message })
        return
      }

      // 전체 4-bucket + per-text/per-set 분포 동시 집계
      const buckets = emptyBucket()
      const byText = new Map<string, PerBucket>()
      const bySet = new Map<string, PerBucket>()
      let earliest = Number.POSITIVE_INFINITY

      for (const r of rows ?? []) {
        const ms = getMemoryState({
          id: r.id,
          difficulty: r.difficulty ?? 6.0,
          stability: r.stability ?? 0,
          lastReviewAt: r.last_review_at ? new Date(r.last_review_at) : null,
          nextReviewAt: r.next_review_at ? new Date(r.next_review_at) : null,
          moduleHistory: (r.module_history ?? []) as ModuleId[],
          reviewCount: r.review_count ?? 0,
        })
        buckets[ms] += 1

        if (r.text_id) {
          const b = byText.get(r.text_id) ?? emptyBucket()
          b[ms] += 1
          byText.set(r.text_id, b)
        }
        if (r.shared_set_id) {
          const b = bySet.get(r.shared_set_id) ?? emptyBucket()
          b[ms] += 1
          bySet.set(r.shared_set_id, b)
        }
        if (r.created_at) {
          const t = new Date(r.created_at).getTime()
          if (t < earliest) earliest = t
        }
      }

      const total = rows?.length ?? 0
      const accumulatedDays =
        total === 0 || !isFinite(earliest)
          ? 0
          : Math.max(1, Math.floor((Date.now() - earliest) / 86_400_000))

      // ── books: 구독 공용 단어장 + 스크립트 (각 metadata fetch) ──
      const setIds = Array.from(bySet.keys())
      const textIds = Array.from(byText.keys())

      // v06.25 — category_id 컬럼이 마이그레이션 미적용 환경에서도 안전하도록
      // try-catch + fallback. 컬럼 존재 시 dictionary_categories.name_ko 조인.
      let setsData: Array<{
        id: string
        title: string
        cover_emoji: string | null
        category: string | null
        cefr_level: string | null
        category_id?: string | null
      }> = []
      if (setIds.length > 0) {
        const withBridge = await supabase
          .from('shared_word_sets')
          .select('id, title, cover_emoji, category, cefr_level, category_id')
          .in('id', setIds)
        if (withBridge.error) {
          // 컬럼 미존재 — legacy fallback
          const legacy = await supabase
            .from('shared_word_sets')
            .select('id, title, cover_emoji, category, cefr_level')
            .in('id', setIds)
          setsData = (legacy.data ?? []) as typeof setsData
        } else {
          setsData = (withBridge.data ?? []) as unknown as typeof setsData
        }
      }

      const textsRes =
        textIds.length === 0
          ? { data: [] as Array<{ id: string; title: string; status: string | null; cefr_level: string | null }>, error: null }
          : await supabase
              .from('texts')
              .select('id, title, status, cefr_level')
              .eq('user_id', user.id)
              .in('id', textIds)
      if (cancelled) return

      // category_id 노드 lookup (한 번에 fetch — 한국어 이름 보강)
      const categoryIds = setsData
        .map((s) => s.category_id)
        .filter((v): v is string => typeof v === 'string')
      const catNameMap = new Map<string, { nameKo: string | null; nameEn: string; coverEmoji: string | null }>()
      if (categoryIds.length > 0) {
        const { data: cats } = await supabase
          .from('dictionary_categories')
          .select('id, name_ko, name_en, cover_emoji')
          .in('id', categoryIds)
        for (const c of cats ?? []) {
          catNameMap.set(c.id, {
            nameKo: c.name_ko,
            nameEn: c.name_en,
            coverEmoji: c.cover_emoji,
          })
        }
      }

      const books: VaultBook[] = []

      // 1) 공용 단어장 책 (보라 'shared' 타입)
      for (const s of setsData) {
        const d = bySet.get(s.id) ?? emptyBucket()
        const wc = d.stable + d.shaky + d.risk + d.new
        const node = s.category_id ? catNameMap.get(s.category_id) : null
        // 이모지: dictionary_categories.cover_emoji > shared_word_sets.cover_emoji > 📚
        const emoji = node?.coverEmoji ?? s.cover_emoji ?? '📚'
        // subtitle: 카테고리 한국어 이름(name_ko) > name_en > CEFR > 공용 단어장
        const categoryLabel = node ? (node.nameKo ?? node.nameEn) : null
        const subtitle = categoryLabel
          ? s.cefr_level
            ? `${categoryLabel} · CEFR ${s.cefr_level}`
            : categoryLabel
          : s.cefr_level
            ? `CEFR ${s.cefr_level}`
            : '공용 단어장'
        books.push({
          id: `set-${s.id}`,
          type: 'shared',
          title: `${emoji} ${s.title}`,
          subtitle,
          wordCount: wc,
          distribution: d,
          href: `/wordvault/browse?filter=set:${s.id}`,
        })
      }

      // 2) 스크립트 책 (파란 'text' 타입)
      for (const t of textsRes.data ?? []) {
        const d = byText.get(t.id) ?? emptyBucket()
        const wc = d.stable + d.shaky + d.risk + d.new
        const status = t.status
        const textStatus: VaultBook['textStatus'] =
          status === 'conquered' || status === 'completed'
            ? 'conquered'
            : status === 'extracted'
              ? 'extracted'
              : 'in-progress'
        books.push({
          id: `text-${t.id}`,
          type: 'text',
          title: t.title,
          subtitle: t.cefr_level ? `CEFR ${t.cefr_level}` : '스크립트',
          wordCount: wc,
          distribution: d,
          textStatus,
          href: `/wordvault/browse?filter=text:${t.id}`,
        })
      }

      setState({
        status: 'ready',
        data: {
          total,
          buckets,
          collectionsCount: textIds.length + setIds.length,
          accumulatedDays,
          books,
        },
      })
    })().catch((e: unknown) => {
      if (cancelled) return
      setState({ status: 'error', data: null, message: e instanceof Error ? e.message : String(e) })
    })

    return () => {
      cancelled = true
    }
  }, [])

  return state
}
