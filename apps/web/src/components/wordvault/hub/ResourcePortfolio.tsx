// apps/web/src/components/wordvault/hub/ResourcePortfolio.tsx
//
// WordVault Portfolio — 학습 자산 이력 + 진행 상태 (v06.35).
//
// 3 그룹 표시:
//   · 도서 — texts.library_book_id (curated 도서, 챕터 그룹)
//   · 스크립트 — texts.user_book_group_id (사용자 책) + 직접 입력
//   · 공용 단어장 — user_word_set_subscriptions (도서 단위로 그룹 — useHubStats 동일 로직)
//
// 각 row: 제목 + 진행도 (장수/완독율) + 마지막 학습 시점. 클릭 → /text/[id] or /wordvault/browse.
// "한눈에" — 그룹별 카운트 + 상위 3-5 항목만 (전체는 별도 라우트로).

'use client'

import { ArrowRight, BookOpen, FileText, Library } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { createClient } from '@/lib/supabase/client'

interface BookEntry {
  bookId: string
  title: string
  author: string | null
  totalChapters: number
  completedChapters: number
  inProgressChapters: number
  resumeTextId: string | null
  lastStudiedAt: number | null
}

interface ScriptEntry {
  id: string
  title: string
  isUserBook: boolean
  chapterCount: number
  completedChapters: number
  lastStudiedAt: number | null
  href: string
}

interface SetEntry {
  bookId?: string | null
  title: string
  author?: string | null
  wordCount: number
  chapters?: number
  href: string
}

type State =
  | { kind: 'loading' }
  | { kind: 'unauth' }
  | { kind: 'ready'; books: BookEntry[]; scripts: ScriptEntry[]; sets: SetEntry[] }
  | { kind: 'error'; message: string }

const NF = new Intl.NumberFormat('en-US')

export function ResourcePortfolio() {
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancelled) return
      if (!user) {
        setState({ kind: 'unauth' })
        return
      }

      // 1) texts (사용자 enrolled chapter 또는 직접 입력)
      const { data: textsData } = await supabase
        .from('texts')
        .select(
          'id, title, author, library_book_id, user_book_group_id, chapter_idx, status, progress_percent, last_opened',
        )
        .eq('user_id', user.id)
        .order('last_opened', { ascending: false, nullsFirst: false })

      if (cancelled) return
      const texts = (textsData ?? []) as Array<{
        id: string
        title: string
        author: string | null
        library_book_id: string | null
        user_book_group_id: string | null
        chapter_idx: number | null
        status: string | null
        progress_percent: number | null
        last_opened: string | null
      }>

      // 도서 그룹화 (library_book_id)
      const bookGroups = new Map<string, typeof texts>()
      const userBookGroups = new Map<string, typeof texts>()
      const standalone: typeof texts = []
      for (const r of texts) {
        if (r.library_book_id) {
          const arr = bookGroups.get(r.library_book_id) ?? []
          arr.push(r)
          bookGroups.set(r.library_book_id, arr)
        } else if (r.user_book_group_id) {
          const arr = userBookGroups.get(r.user_book_group_id) ?? []
          arr.push(r)
          userBookGroups.set(r.user_book_group_id, arr)
        } else {
          standalone.push(r)
        }
      }

      // 도서 메타 fetch
      const bookIds = Array.from(bookGroups.keys())
      const bookMetaMap = new Map<string, { title: string; author: string | null }>()
      if (bookIds.length > 0) {
        const { data: bookMeta } = await supabase
          .from('library_books')
          .select('id, title, author')
          .in('id', bookIds)
        for (const b of (bookMeta ?? []) as Array<{ id: string; title: string; author: string | null }>) {
          bookMetaMap.set(b.id, { title: b.title, author: b.author })
        }
      }

      const books: BookEntry[] = []
      for (const [bid, rows] of bookGroups) {
        const sorted = [...rows].sort((a, b) => (a.chapter_idx ?? 0) - (b.chapter_idx ?? 0))
        const meta = bookMetaMap.get(bid)
        const completed = sorted.filter((r) => Number(r.progress_percent ?? 0) >= 100).length
        const inProgress = sorted.filter((r) => {
          const p = Number(r.progress_percent ?? 0)
          return p > 0 && p < 100
        }).length
        const resume = sorted.find((r) => r.status === 'in_progress')
          ?? sorted.find((r) => !r.status || r.status === 'not_started')
          ?? sorted[0]
        const last = sorted.reduce<number | null>((acc, r) => {
          const t = r.last_opened ? new Date(r.last_opened).getTime() : null
          return t == null ? acc : acc == null || t > acc ? t : acc
        }, null)
        books.push({
          bookId: bid,
          title: meta?.title ?? sorted[0]?.title ?? '제목 없음',
          author: meta?.author ?? sorted[0]?.author ?? null,
          totalChapters: sorted.length,
          completedChapters: completed,
          inProgressChapters: inProgress,
          resumeTextId: resume?.id ?? null,
          lastStudiedAt: last,
        })
      }
      books.sort((a, b) => (b.lastStudiedAt ?? 0) - (a.lastStudiedAt ?? 0))

      const scripts: ScriptEntry[] = []
      for (const [gid, rows] of userBookGroups) {
        const sorted = [...rows].sort((a, b) => (a.chapter_idx ?? 0) - (b.chapter_idx ?? 0))
        const completed = sorted.filter((r) => Number(r.progress_percent ?? 0) >= 100).length
        const resume = sorted.find((r) => r.status === 'in_progress') ?? sorted[0]
        const last = sorted.reduce<number | null>((acc, r) => {
          const t = r.last_opened ? new Date(r.last_opened).getTime() : null
          return t == null ? acc : acc == null || t > acc ? t : acc
        }, null)
        scripts.push({
          id: gid,
          title: sorted[0]?.title ?? '내 책',
          isUserBook: true,
          chapterCount: sorted.length,
          completedChapters: completed,
          lastStudiedAt: last,
          href: resume ? `/text/${resume.id}?mode=read` : '/text',
        })
      }
      for (const r of standalone) {
        scripts.push({
          id: r.id,
          title: r.title,
          isUserBook: false,
          chapterCount: 1,
          completedChapters: Number(r.progress_percent ?? 0) >= 100 ? 1 : 0,
          lastStudiedAt: r.last_opened ? new Date(r.last_opened).getTime() : null,
          href: `/text/${r.id}?mode=read`,
        })
      }
      scripts.sort((a, b) => (b.lastStudiedAt ?? 0) - (a.lastStudiedAt ?? 0))

      // 2) 공용 단어장 (도서 단위 그룹화 — useHubStats 동일 로직 간소화)
      const { data: subsData } = await supabase
        .from('user_word_set_subscriptions')
        .select('set_id')
        .eq('user_id', user.id)
      const setIds = ((subsData ?? []) as Array<{ set_id: string }>).map((s) => s.set_id)

      let setsRows: Array<{
        id: string
        title: string
        category: string | null
        curation_query: Record<string, unknown> | null
        cefr_level: string | null
      }> = []
      if (setIds.length > 0) {
        const { data } = await supabase
          .from('shared_word_sets')
          .select('id, title, category, curation_query, cefr_level')
          .in('id', setIds)
        setsRows = (data ?? []) as typeof setsRows
      }

      // 도서 단위 그룹화 — library_book sets 만
      const setBookGroups = new Map<string, typeof setsRows>()
      const otherSets: typeof setsRows = []
      for (const s of setsRows) {
        const bookId =
          s.category === 'library_book' && s.curation_query
            ? (s.curation_query['book_id'] as string | undefined) ?? null
            : null
        if (bookId) {
          const arr = setBookGroups.get(bookId) ?? []
          arr.push(s)
          setBookGroups.set(bookId, arr)
        } else {
          otherSets.push(s)
        }
      }

      // 도서 메타 (setBookGroups 용 — books map 와 합쳐 fetch)
      const setBookIds = Array.from(setBookGroups.keys()).filter((id) => !bookMetaMap.has(id))
      if (setBookIds.length > 0) {
        const { data: bookMeta } = await supabase
          .from('library_books')
          .select('id, title, author')
          .in('id', setBookIds)
        for (const b of (bookMeta ?? []) as Array<{ id: string; title: string; author: string | null }>) {
          bookMetaMap.set(b.id, { title: b.title, author: b.author })
        }
      }

      // 사용자 vocab counts per set (개략적으로 별도 쿼리)
      let countsPerSet = new Map<string, number>()
      if (setIds.length > 0) {
        const { data: vocabsBySet } = await supabase
          .from('vocabularies')
          .select('shared_set_id')
          .eq('user_id', user.id)
          .in('shared_set_id', setIds)
        for (const v of (vocabsBySet ?? []) as Array<{ shared_set_id: string }>) {
          countsPerSet.set(v.shared_set_id, (countsPerSet.get(v.shared_set_id) ?? 0) + 1)
        }
      }

      const sets: SetEntry[] = []
      for (const [bid, rows] of setBookGroups) {
        const meta = bookMetaMap.get(bid)
        const wc = rows.reduce((s, r) => s + (countsPerSet.get(r.id) ?? 0), 0)
        const firstSet = [...rows].sort((a, b) => {
          const ai = Number(a.curation_query?.['chapter_idx'] ?? 0)
          const bi = Number(b.curation_query?.['chapter_idx'] ?? 0)
          return ai - bi
        })[0]
        sets.push({
          bookId: bid,
          title: meta?.title ?? '도서 단어장',
          author: meta?.author ?? null,
          wordCount: wc,
          chapters: rows.length,
          href: firstSet
            ? `/wordvault/browse?filter=set:${firstSet.id}&book=${bid}`
            : '/wordvault/browse',
        })
      }
      for (const s of otherSets) {
        const wc = countsPerSet.get(s.id) ?? 0
        sets.push({
          title: s.title,
          wordCount: wc,
          href: `/wordvault/browse?filter=set:${s.id}`,
        })
      }
      sets.sort((a, b) => b.wordCount - a.wordCount)

      setState({ kind: 'ready', books, scripts, sets })
    })().catch((e: unknown) => {
      if (cancelled) return
      setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) })
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (state.kind !== 'ready') {
    return (
      <Frame title="학습 자산">
        <p className="font-body text-[13px] text-[var(--t3)]">
          {state.kind === 'loading' ? '불러오는 중…' : '아직 학습 자산이 없어요.'}
        </p>
      </Frame>
    )
  }

  const { books, scripts, sets } = state
  const isEmpty = books.length === 0 && scripts.length === 0 && sets.length === 0

  if (isEmpty) {
    return (
      <Frame title="학습 자산">
        <p className="font-body text-[13px] text-[var(--t3)]">
          아직 학습 중인 자산이 없어요.{' '}
          <Link href="/library/books" className="font-display font-[600] text-[var(--p)] underline-offset-2 hover:underline">
            라이브러리 둘러보기 →
          </Link>
        </p>
      </Frame>
    )
  }

  return (
    <Frame
      title="학습 자산"
      meta={`도서 ${books.length} · 스크립트 ${scripts.length} · 단어장 ${sets.length}`}
    >
      <div className="grid gap-5 sm:grid-cols-3">
        <ResourceGroup
          icon={<BookOpen size={13} aria-hidden />}
          title="도서"
          count={books.length}
          emptyText="라이브러리 도서를 학습 추가하세요."
          emptyHref="/library/books"
        >
          {books.slice(0, 4).map((b) => (
            <Link
              key={b.bookId}
              href={b.resumeTextId ? `/text/${b.resumeTextId}?mode=read` : `/library/books/${b.bookId}`}
              className="group flex flex-col gap-1 border-b border-[var(--bd)] py-2 last:border-b-0 last:pb-0 hover:bg-[var(--bg2)]"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="line-clamp-1 font-display text-[12.5px] font-[600] text-[var(--t1)] group-hover:text-[var(--p)]">
                  {b.title}
                </span>
                <span className="shrink-0 font-mono text-[10px] tabular-nums text-[var(--t3)]">
                  {b.completedChapters}/{b.totalChapters}장
                </span>
              </div>
              <ProgressBar value={b.completedChapters} total={b.totalChapters} />
              <span className="font-mono text-[9.5px] text-[var(--t3)]">
                {relativeTimeKo(b.lastStudiedAt)}
                {b.author ? ` · ${b.author}` : ''}
              </span>
            </Link>
          ))}
        </ResourceGroup>

        <ResourceGroup
          icon={<FileText size={13} aria-hidden />}
          title="스크립트"
          count={scripts.length}
          emptyText="스크립트를 입력해 보세요."
          emptyHref="/text/new"
        >
          {scripts.slice(0, 4).map((s) => (
            <Link
              key={s.id}
              href={s.href}
              className="group flex flex-col gap-1 border-b border-[var(--bd)] py-2 last:border-b-0 last:pb-0 hover:bg-[var(--bg2)]"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="line-clamp-1 font-display text-[12.5px] font-[600] text-[var(--t1)] group-hover:text-[var(--p)]">
                  {s.title}
                </span>
                <span className="shrink-0 font-mono text-[10px] tabular-nums text-[var(--t3)]">
                  {s.isUserBook ? `${s.completedChapters}/${s.chapterCount}장` : '단일'}
                </span>
              </div>
              {s.isUserBook && <ProgressBar value={s.completedChapters} total={s.chapterCount} />}
              <span className="font-mono text-[9.5px] text-[var(--t3)]">
                {relativeTimeKo(s.lastStudiedAt)} · {s.isUserBook ? '내 책' : '직접 입력'}
              </span>
            </Link>
          ))}
        </ResourceGroup>

        <ResourceGroup
          icon={<Library size={13} aria-hidden />}
          title="공용 단어장"
          count={sets.length}
          emptyText="진단 후 단어장을 구독해 보세요."
          emptyHref="/library/vocab"
        >
          {sets.slice(0, 4).map((s, i) => (
            <Link
              key={s.bookId ?? `set-${i}`}
              href={s.href}
              className="group flex flex-col gap-1 border-b border-[var(--bd)] py-2 last:border-b-0 last:pb-0 hover:bg-[var(--bg2)]"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="line-clamp-1 font-display text-[12.5px] font-[600] text-[var(--t1)] group-hover:text-[var(--p)]">
                  {s.title}
                </span>
                <span className="shrink-0 font-mono text-[10px] tabular-nums text-[var(--t3)]">
                  {NF.format(s.wordCount)}개
                </span>
              </div>
              <span className="font-mono text-[9.5px] text-[var(--t3)]">
                {s.chapters != null ? `${s.chapters}장` : '공용 단어장'}
                {s.author ? ` · ${s.author}` : ''}
              </span>
            </Link>
          ))}
        </ResourceGroup>
      </div>
    </Frame>
  )
}

function ResourceGroup({
  icon,
  title,
  count,
  emptyText,
  emptyHref,
  children,
}: {
  icon: React.ReactNode
  title: string
  count: number
  emptyText: string
  emptyHref: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2 border-b border-[var(--bd)] pb-2">
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-[700] uppercase tracking-[0.16em] text-[var(--t3)]">
          {icon}
          {title}
        </span>
        <span className="font-display text-[12px] font-[700] tabular-nums text-[var(--t1)]">
          {NF.format(count)}
        </span>
      </div>
      {count > 0 ? (
        children
      ) : (
        <Link
          href={emptyHref}
          className="block py-3 font-body text-[11.5px] text-[var(--t3)] hover:text-[var(--p)]"
        >
          {emptyText}{' '}
          <ArrowRight size={11} className="inline" aria-hidden />
        </Link>
      )}
    </div>
  )
}

function ProgressBar({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0
  const complete = value >= total && total > 0
  return (
    <div className="h-[3px] w-full overflow-hidden rounded-full bg-[var(--bg3)]">
      <div
        className="h-full rounded-full transition-[width] duration-[var(--dur-slow)]"
        style={{ width: `${pct}%`, backgroundColor: complete ? '#22C55E' : 'var(--p)' }}
      />
    </div>
  )
}

function relativeTimeKo(t: number | null): string {
  if (!t) return '학습 시작 전'
  const diff = Date.now() - t
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)
  if (hours < 1) return '방금'
  if (hours < 24) return `${hours}시간 전`
  if (days < 2) return '어제'
  if (days < 7) return `${days}일 전`
  if (days < 14) return '1주일 전'
  if (days < 30) return `${Math.floor(days / 7)}주 전`
  return '오래 전'
}

function Frame({
  title,
  meta,
  children,
}: {
  title: string
  meta?: string
  children: React.ReactNode
}) {
  return (
    <section
      aria-label={title}
      className="rounded-[var(--r-2xl)] border border-[var(--bd)] bg-[var(--bg)] p-6 md:p-7"
    >
      <header className="mb-4 flex items-baseline justify-between gap-3">
        <span className="font-mono text-[10px] font-[700] uppercase tracking-[0.18em] text-[var(--t3)]">
          {title}
        </span>
        {meta && (
          <span className="font-mono text-[10px] tabular-nums text-[var(--t3)]">{meta}</span>
        )}
      </header>
      {children}
    </section>
  )
}
