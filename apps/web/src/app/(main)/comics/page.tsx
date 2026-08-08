// apps/web/src/app/(main)/comics/page.tsx
//
// /comics — 만화 (사이드바 Scripts 그룹의 최상위 메뉴).
// 설계: docs/CCP_LIBRARY_INTEGRATION.md — 만화는 새 장르가 아니라 "같은 책의 다른 표현형(Expression)"이라
// 데이터는 library_books 에 앵커된 채, 탐색 UI 에서만 독립 코너로 제시한다.
// 위치는 /library 하위 탭 → 최상위 메뉴로 승격(사용자 결정 2026-08-09). 데이터 축은 그대로.
//
// 진도(comic_read_progress)와 등록(texts)은 축이 다르다:
//   · 등록 = 부모 도서 등록 여부 → 리더 라우트(/text/[id]/comic) 진입 가능 여부
//   · 진도 = 만화 컷 위치 → "이어서 보기". 챕터 완료(texts.status)와 분리 회계(설계서 R1).

import { BookImage } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'

import { Capsule, Screen } from '@/components/ui/ios'
import { createClient } from '@/lib/supabase/server'
import { fetchComicCatalog } from '@/lib/comic/catalog'
import {
  ComicsBrowser,
  type ComicBrowseItem,
} from '@/components/library/browse/ComicsBrowser'

export const metadata = {
  title: '만화 — Vocaflow Library',
  description: '큐레이션된 영어 원서를 만화로 — 같은 책, 그림으로 먼저 만나는 입구',
}

// 등록/진도가 사용자별이라 정적 캐시 불가
export const dynamic = 'force-dynamic'

export default async function LibraryComicsPage() {
  const client = (await createClient()) as unknown as SupabaseClient

  const catalog = await fetchComicCatalog(client)

  const {
    data: { user },
  } = await client.auth.getUser()

  // 등록 상태 — 부모 도서의 texts(챕터) 행. 첫 미완료 챕터가 만화 재개 지점.
  const enrollment = new Map<string, { firstTextId: string; resumeTextId: string | null }>()
  // 만화 진도 — 컷 위치 (기기 간 이어보기)
  const progress = new Map<string, { lastIndex: number; total: number; completed: boolean }>()

  if (user && catalog.length > 0) {
    const ids = catalog.map((c) => c.bookId)
    const [textsRes, progRes] = await Promise.all([
      client
        .from('texts')
        .select('id, library_book_id, chapter_idx, status')
        .eq('user_id', user.id)
        .in('library_book_id', ids)
        .order('chapter_idx', { ascending: true }),
      client
        .from('comic_read_progress')
        .select('library_book_id, last_index, panels_total, completed_at')
        .in('library_book_id', ids),
    ])

    for (const r of (textsRes.data ?? []) as Array<{
      id: string
      library_book_id: string
      status: string
    }>) {
      const cur = enrollment.get(r.library_book_id) ?? {
        firstTextId: r.id,
        resumeTextId: null as string | null,
      }
      if (r.status !== 'completed' && cur.resumeTextId == null) cur.resumeTextId = r.id
      enrollment.set(r.library_book_id, cur)
    }

    for (const r of (progRes.data ?? []) as Array<{
      library_book_id: string
      last_index: number | null
      panels_total: number | null
      completed_at: string | null
    }>) {
      progress.set(r.library_book_id, {
        lastIndex: r.last_index ?? 0,
        total: r.panels_total ?? 0,
        completed: r.completed_at != null,
      })
    }
  }

  const items: ComicBrowseItem[] = catalog.map((c) => {
    const e = enrollment.get(c.bookId) ?? null
    const p = progress.get(c.bookId) ?? null
    // 컷 총량은 카탈로그(발행 시점 확정)를 우선 — 진도 행의 panels_total 은 이전 발행분일 수 있음
    const total = c.panelsTotal > 0 ? c.panelsTotal : (p?.total ?? 0)
    const completed = p?.completed ?? false
    const progressPct =
      completed || !p || total <= 0
        ? completed
          ? 100
          : 0
        : Math.min(100, Math.round((p.lastIndex / total) * 100))

    // 미등록 학습자는 리더에 바로 들어갈 수 없다(라우트가 texts.id 요구) →
    // 프리뷰 + 포맷 선택(등록 후 진입)을 거친다 (설계서 D4).
    const href = e
      ? `/text/${e.resumeTextId ?? e.firstTextId}/comic`
      : `/comics/book/${c.bookId}`

    const ctaLabel = !e
      ? '만화 미리보기'
      : completed
        ? '다시 보기'
        : progressPct > 0
          ? '이어서 보기'
          : '만화로 읽기'

    return {
      bookId: c.bookId,
      title: c.title,
      author: c.author,
      vLevel: c.vLevel,
      panelsTotal: total,
      coverArt: c.coverArt,
      href,
      ctaLabel,
      enrolled: !!e,
      progressPct,
      completed,
    }
  })

  const totalPanels = items.reduce((s, i) => s + i.panelsTotal, 0)
  const readingCount = items.filter((i) => i.progressPct > 0 && !i.completed).length

  return (
    <Screen width="wide" background="bg2" padX="md">
      <div className="flex flex-col gap-5 py-6 md:py-8">
        <header className="flex flex-col gap-3 px-1">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="inline-flex h-8 w-8 items-center justify-center rounded-ios-sm"
              style={{ background: 'var(--active)', color: '#231a09' }}
            >
              <BookImage size={16} />
            </span>
            <h1 className="font-editorial text-[44px] font-[500] tracking-[-0.012em] leading-[1.02] text-[var(--t1)] md:text-[56px]">
              만화
            </h1>
          </div>
          <p className="font-body text-[15px] text-[var(--t2)]">
            같은 책, 그림으로 먼저 만나는 입구 — 줄거리를 잡고 나면 본문이 한결 수월해져요.
          </p>
          {items.length > 0 && (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Capsule label="만화" value={`${items.length}편`} />
              {totalPanels > 0 && <Capsule label="컷" value={`${totalPanels}`} />}
              {readingCount > 0 && (
                <Capsule tone="green" label="보는 중" value={`${readingCount}편`} />
              )}
            </div>
          )}
        </header>

        <ComicsBrowser items={items} />
      </div>
    </Screen>
  )
}
