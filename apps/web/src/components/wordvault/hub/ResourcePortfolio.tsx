// apps/web/src/components/wordvault/hub/ResourcePortfolio.tsx
//
// WordVault Section 3 (v06.35 iOS) — 학습 자산 (Settings 인셋 그룹 list).
//
// iOS Settings 감성:
//   · 캡슐 세그먼트로 도서/스크립트/단어장 전환
//   · 흰 카드 위에 인셋 그룹 list (rounded-[14px], divider, disclosure chevron)
//   · 행 좌측 SF Symbol 컬러 사각형 아이콘
//   · 우측 chevron + 메타 텍스트
//
// 3 그룹: 도서 (texts.library_book_id) / 스크립트 (user_book_group_id) / 공용 단어장 (book grouped).

'use client'

import { BookOpen, ChevronRight, FileText, Library } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
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

type Tab = 'books' | 'scripts' | 'sets'

const NF = new Intl.NumberFormat('en-US')

const TAB_META: Record<Tab, { label: string; icon: LucideIcon; color: string }> = {
  books: { label: '도서', icon: BookOpen, color: '#FF9F0A' /* iOS orange */ },
  scripts: { label: '스크립트', icon: FileText, color: 'var(--p)' /* iOS blue */ },
  sets: { label: '단어장', icon: Library, color: '#AF52DE' /* iOS purple */ },
}

export function ResourcePortfolio() {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [tab, setTab] = useState<Tab>('books')

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
        <EmptyState text={state.kind === 'loading' ? '불러오는 중…' : '학습 자산이 없어요.'} />
      </Frame>
    )
  }

  const { books, scripts, sets } = state
  const counts = { books: books.length, scripts: scripts.length, sets: sets.length }
  const isEmpty = counts.books === 0 && counts.scripts === 0 && counts.sets === 0

  if (isEmpty) {
    return (
      <Frame title="학습 자산">
        <EmptyState text="아직 학습 중인 자산이 없어요." href="/library/books" linkLabel="라이브러리 둘러보기" />
      </Frame>
    )
  }

  return (
    <Frame title="학습 자산">
      {/* iOS Segment Control */}
      <nav aria-label="자산 종류" className="mb-5 inline-flex w-full items-center gap-0.5 rounded-[var(--r-full)] bg-[var(--bg2)] p-[3px]">
        {(['books', 'scripts', 'sets'] as Tab[]).map((t) => {
          const meta = TAB_META[t]
          const isActive = tab === t
          const Icon = meta.icon
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-[var(--r-full)] py-[7px] font-display text-[12.5px] font-[600] transition-all duration-[var(--dur-fast)] ${
                isActive
                  ? 'bg-[var(--bg)] text-[var(--t1)] shadow-[0_1px_2px_rgba(0,0,0,0.06),0_2px_8px_rgba(0,0,0,0.04)]'
                  : 'text-[var(--t3)] hover:text-[var(--t2)]'
              }`}
            >
              <Icon size={14} className="opacity-80" />
              <span>{meta.label}</span>
              <span
                className={`rounded-[var(--r-full)] px-1.5 py-px font-mono text-[10px] tabular-nums ${
                  isActive ? 'bg-[var(--bg2)] text-[var(--t2)]' : 'text-[var(--t3)]'
                }`}
              >
                {counts[t]}
              </span>
            </button>
          )
        })}
      </nav>

      {/* List body */}
      {tab === 'books' && (
        <InsetGroup color={TAB_META.books.color}>
          {books.length === 0 ? (
            <EmptyRow text="라이브러리 도서를 학습 시작하세요." href="/library/books" />
          ) : (
            books.slice(0, 5).map((b) => (
              <Row
                key={b.bookId}
                href={b.resumeTextId ? `/text/${b.resumeTextId}?mode=read` : `/library/books/${b.bookId}`}
                icon={<BookOpen size={14} aria-hidden />}
                iconBg={TAB_META.books.color}
                title={b.title}
                subtitle={`${relativeTimeKo(b.lastStudiedAt)}${b.author ? ` · ${b.author}` : ''}`}
                progress={{ done: b.completedChapters, total: b.totalChapters, unit: '장' }}
              />
            ))
          )}
        </InsetGroup>
      )}

      {tab === 'scripts' && (
        <InsetGroup color={TAB_META.scripts.color}>
          {scripts.length === 0 ? (
            <EmptyRow text="스크립트를 입력해 보세요." href="/text/new" />
          ) : (
            scripts.slice(0, 5).map((s) => (
              <Row
                key={s.id}
                href={s.href}
                icon={<FileText size={14} aria-hidden />}
                iconBg={TAB_META.scripts.color}
                title={s.title}
                subtitle={`${relativeTimeKo(s.lastStudiedAt)} · ${s.isUserBook ? '내 책' : '직접 입력'}`}
                progress={
                  s.isUserBook
                    ? { done: s.completedChapters, total: s.chapterCount, unit: '장' }
                    : undefined
                }
                metaRight={s.isUserBook ? undefined : '단일'}
              />
            ))
          )}
        </InsetGroup>
      )}

      {tab === 'sets' && (
        <InsetGroup color={TAB_META.sets.color}>
          {sets.length === 0 ? (
            <EmptyRow text="진단 후 단어장을 구독해 보세요." href="/library/vocab" />
          ) : (
            sets.slice(0, 5).map((s, i) => (
              <Row
                key={s.bookId ?? `set-${i}`}
                href={s.href}
                icon={<Library size={14} aria-hidden />}
                iconBg={TAB_META.sets.color}
                title={s.title}
                subtitle={s.chapters != null ? `${s.chapters}장${s.author ? ` · ${s.author}` : ''}` : '공용 단어장'}
                metaRight={`${NF.format(s.wordCount)}개`}
              />
            ))
          )}
        </InsetGroup>
      )}
    </Frame>
  )
}

// ─── iOS Inset Group ─────────────────────────────────────
function InsetGroup({
  color,
  children,
}: {
  color: string
  children: React.ReactNode
}) {
  void color
  return (
    <div className="overflow-hidden rounded-[14px] bg-[var(--bg2)]">
      <div className="bg-[var(--bg)] divide-y divide-[var(--bd)]/60">
        {children}
      </div>
    </div>
  )
}

// ─── Row (iOS Settings cell) ─────────────────────────────
function Row({
  href,
  icon,
  iconBg,
  title,
  subtitle,
  progress,
  metaRight,
}: {
  href: string
  icon: React.ReactNode
  iconBg: string
  title: string
  subtitle: string
  progress?: { done: number; total: number; unit: string }
  metaRight?: string
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 px-4 py-3 transition-colors duration-[var(--dur-fast)] hover:bg-[var(--bg2)] active:bg-[var(--bg3)]"
    >
      <span
        aria-hidden
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-white"
        style={{ backgroundColor: iconBg }}
      >
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="line-clamp-1 font-display text-[14px] font-[600] tracking-[-0.012em] text-[var(--t1)] group-hover:text-[var(--p)]">
          {title}
        </span>
        <div className="flex items-center gap-2">
          <span className="line-clamp-1 font-body text-[11.5px] text-[var(--t3)]">
            {subtitle}
          </span>
          {progress && (
            <span className="shrink-0 rounded-[var(--r-full)] bg-[var(--bg2)] px-2 py-0.5 font-mono text-[10px] tabular-nums text-[var(--t2)]">
              {progress.done}/{progress.total}{progress.unit}
            </span>
          )}
        </div>
        {progress && progress.total > 0 && (
          <div className="h-[3px] w-full overflow-hidden rounded-full bg-[var(--bg3)]">
            <div
              className="h-full rounded-full transition-[width] duration-[var(--dur-slow)]"
              style={{
                width: `${Math.min(100, (progress.done / progress.total) * 100)}%`,
                backgroundColor: progress.done >= progress.total ? '#34C759' : 'var(--p)',
              }}
            />
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {metaRight && (
          <span className="font-mono text-[11px] tabular-nums text-[var(--t3)]">
            {metaRight}
          </span>
        )}
        <ChevronRight size={16} className="text-[var(--t3)]/70" aria-hidden />
      </div>
    </Link>
  )
}

function EmptyRow({ text, href }: { text: string; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between px-4 py-4 transition-colors duration-[var(--dur-fast)] hover:bg-[var(--bg2)]"
    >
      <span className="font-body text-[13px] text-[var(--t3)]">{text}</span>
      <ChevronRight size={16} className="text-[var(--t3)]/70" aria-hidden />
    </Link>
  )
}

function EmptyState({
  text,
  href,
  linkLabel,
}: {
  text: string
  href?: string
  linkLabel?: string
}) {
  return (
    <p className="font-body text-[13px] text-[var(--t3)]">
      {text}
      {href && linkLabel && (
        <>
          {' '}
          <Link
            href={href}
            className="font-display font-[600] text-[var(--p)] underline-offset-2 hover:underline"
          >
            {linkLabel} →
          </Link>
        </>
      )}
    </p>
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
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section
      aria-label={title}
      className="rounded-[24px] bg-[var(--bg)] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.08)] md:p-7"
    >
      <header className="mb-4">
        <h2 className="font-display text-[20px] font-[700] tracking-[-0.022em] text-[var(--t1)]">
          {title}
        </h2>
      </header>
      {children}
    </section>
  )
}
