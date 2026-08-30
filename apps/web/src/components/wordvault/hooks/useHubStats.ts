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
// CEFRDistribution·WordPeek 은 여전히 mock.
// (LearningDimension 은 폐기 — 면 상태는 `useFacetSummary` + `FacetProgressSection` 이 실데이터로 한다.)

'use client'

import { useEffect, useState } from 'react'

import type { VaultBook } from '@/components/wordvault/hub/BookShelfSection'
import { getMemoryState, type MemoryState, type ModuleId } from '@/lib/srs'
import { createClient } from '@/lib/supabase/client'
import { pagedSelect } from '@/lib/supabase/paged-select'

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
/** 허브 통계가 쓰는 `vocabularies` 열만. 페이지네이션 헬퍼가 제네릭이라 여기서 형을 준다. */
interface VocabStatRow {
  id: string
  difficulty: number | null
  stability: number | null
  last_review_at: string | null
  next_review_at: string | null
  module_history: string[] | null
  review_count: number | null
  text_id: string | null
  shared_set_id: string | null
  created_at: string | null
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

      // ⚠️ 상한을 안 적으면 되는 것이 아니다 — PostgREST 는 **1,000행에서 끊는다**
      //    (실측 2026-08-30). 여기 수치는 허브 히어로의 총계와 4버킷이라, 잘리면
      //    학습자가 자기 자산을 적게 본다. 이미 1,945행인 계정이 있다.
      //    같은 분포를 서버에서 따로 세는 `growth-stats`(상태 띠)와 **행 집합이 달라지면**
      //    한 화면 안에서 두 수가 어긋난다 — 이 저장소가 이미 겪은 사고다(리본 135 vs Vault 20).
      let rows: VocabStatRow[] = []
      let error: { message: string } | null = null
      try {
        rows = await pagedSelect<VocabStatRow>(
          (lo, hi) =>
            supabase
              .from('vocabularies')
              .select(
                'id, difficulty, stability, last_review_at, next_review_at, module_history, review_count, text_id, shared_set_id, created_at',
              )
              .eq('user_id', user.id)
              .range(lo, hi),
          'wordvault hub vocabularies',
        )
      } catch (e) {
        error = { message: e instanceof Error ? e.message : String(e) }
      }

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
      // v06.35 — curation_query 도 fetch (도서 챕터 단어장 그룹화 기준)
      let setsData: Array<{
        id: string
        title: string
        cover_emoji: string | null
        category: string | null
        cefr_level: string | null
        category_id?: string | null
        curation_query: Record<string, unknown> | null
      }> = []
      if (setIds.length > 0) {
        // ⚠️ 예외로 스키마를 탐지하지 않는다 — 이전 구현은 category_id 를 먼저 select 하고
        //    실패하면 legacy 로 폴백했는데, 이 DB 는 브릿지 마이그레이션
        //    (20260518130000_shared_word_sets_category_bridge.sql)이 미적용이라
        //    **구독 세트가 있는 모든 사용자의 허브 로드마다 400 이 확정 발생**했다
        //    (2026-08-09 실측: column shared_word_sets.category_id does not exist).
        //    한 번은 폴백돼 화면은 멀쩡했지만 왕복 1회 낭비 + 콘솔/모니터링 오염.
        //    브릿지 적용 시 아래 select 에 category_id 를 되돌리고 실패 폴백을 다시 붙일 것.
        const legacy = await supabase
          .from('shared_word_sets')
          .select('id, title, cover_emoji, category, cefr_level, curation_query')
          .in('id', setIds)
        setsData = (legacy.data ?? []) as typeof setsData
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

      // v06.35 — 도서 챕터 단어장 그룹화
      //   category='library_book' 인 set 들은 curation_query->>'book_id' 별로 그룹.
      //   한 도서당 카드 1개로 (61개 챕터 단어장 → 1개 카드) emit.
      //   group meta: 도서 제목/저자/cover 는 library_books 에서 fetch.
      const libraryBookGroups = new Map<
        string,
        {
          setIds: string[]
          firstSetId: string
          firstChapterIdx: number
          distribution: PerBucket
        }
      >()
      const nonBookSets: typeof setsData = []
      for (const s of setsData) {
        const isLibraryBook = s.category === 'library_book'
        const bookId =
          isLibraryBook && s.curation_query
            ? (s.curation_query['book_id'] as string | undefined) ?? null
            : null
        const chapterIdx =
          isLibraryBook && s.curation_query
            ? Number(s.curation_query['chapter_idx'] ?? 0) || 0
            : 0
        if (bookId) {
          const d = bySet.get(s.id) ?? emptyBucket()
          const g = libraryBookGroups.get(bookId)
          if (g) {
            g.setIds.push(s.id)
            g.distribution.stable += d.stable
            g.distribution.shaky += d.shaky
            g.distribution.risk += d.risk
            g.distribution.new += d.new
            if (chapterIdx > 0 && chapterIdx < g.firstChapterIdx) {
              g.firstChapterIdx = chapterIdx
              g.firstSetId = s.id
            }
          } else {
            libraryBookGroups.set(bookId, {
              setIds: [s.id],
              firstSetId: s.id,
              firstChapterIdx: chapterIdx > 0 ? chapterIdx : Number.POSITIVE_INFINITY,
              distribution: { ...d },
            })
          }
        } else {
          nonBookSets.push(s)
        }
      }

      // 도서 메타 일괄 fetch (id, title, author, cover_image_url)
      const bookIds = Array.from(libraryBookGroups.keys())
      const bookMetaMap = new Map<
        string,
        { title: string; author: string | null; cover_image_url: string | null; cefr_band: string | null }
      >()
      if (bookIds.length > 0) {
        const { data: bookMeta } = await supabase
          .from('library_books')
          .select('id, title, author, cover_image_url, cefr_band')
          .in('id', bookIds)
        if (cancelled) return
        for (const b of (bookMeta ?? []) as Array<{
          id: string
          title: string
          author: string | null
          cover_image_url: string | null
          cefr_band: string | null
        }>) {
          bookMetaMap.set(b.id, {
            title: b.title,
            author: b.author,
            cover_image_url: b.cover_image_url,
            cefr_band: b.cefr_band,
          })
        }
      }

      // 1a) 도서 1권당 단어장 카드 1개 (챕터 합산)
      for (const [bookId, g] of libraryBookGroups) {
        const wc = g.distribution.stable + g.distribution.shaky + g.distribution.risk + g.distribution.new
        const meta = bookMetaMap.get(bookId)
        const title = meta?.title ?? '도서 단어장'
        const subtitle = meta?.author
          ? meta.cefr_band
            ? `${meta.author} · CEFR ${meta.cefr_band} · ${g.setIds.length}장`
            : `${meta.author} · ${g.setIds.length}장`
          : `도서 · ${g.setIds.length}장`
        books.push({
          id: `book-${bookId}`,
          type: 'shared',
          title,
          subtitle,
          wordCount: wc,
          distribution: g.distribution,
          // 도서의 첫 챕터 set 으로 link + book context (browse 가 prev/next 챕터 nav 활성)
          href: `/wordvault/browse?filter=set:${g.firstSetId}&book=${bookId}`,
        })
      }

      // 1b) 도서 외 공용 단어장 (category != 'library_book')
      for (const s of nonBookSets) {
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

      // v06.35 — 도서 단어장은 챕터별로 X, 도서 단위로 1 (libraryBookGroups.size)
      const collectionsCount =
        textIds.length + libraryBookGroups.size + nonBookSets.length

      setState({
        status: 'ready',
        data: {
          total,
          buckets,
          collectionsCount,
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
