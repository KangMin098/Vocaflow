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

import { unsubscribeSet } from '@/app/(main)/library/vocab/actions'
import { VocabSetPreviewModal } from '@/components/library/vocab/VocabSetPreviewModal'
import {
  Frame,
  InsetGroup,
  InsetRow,
  SegmentControl,
} from '@/components/ui/ios'
import type { SegmentItem } from '@/components/ui/ios'
import { MATERIAL_LABEL } from '@/lib/learner/plan-activities'
import type { PublishedVocabSet } from '@/lib/library/vocab/queries'
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
  /** 단일 공용단어장이면 그 set_id — 있으면 행 탭 시 챕터 학습 모달(VocabSetPreviewModal) 오픈. */
  setId?: string
  coverEmoji?: string | null
  category?: string | null
  cefrLevel?: string | null
}

type State =
  | { kind: 'loading' }
  | { kind: 'unauth' }
  | { kind: 'ready'; books: BookEntry[]; scripts: ScriptEntry[]; sets: SetEntry[] }
  | { kind: 'error'; message: string }

type Tab = 'books' | 'scripts' | 'sets'

const NF = new Intl.NumberFormat('en-US')

// 라벨 출처 = `MATERIAL_LABEL`. 'scripts' 는 학습자가 넣은 글(script)이므로 Scripts,
// 라이브러리의 공개 짧은 글(Dispatches)과는 다른 것이다.
const TAB_META: Record<Tab, { label: string; icon: LucideIcon; color: string }> = {
  books: { label: MATERIAL_LABEL.book, icon: BookOpen, color: 'var(--ios-orange)' },
  scripts: { label: MATERIAL_LABEL.script, icon: FileText, color: 'var(--p)' },
  sets: { label: MATERIAL_LABEL.word_set, icon: Library, color: 'var(--ios-purple)' },
}

export function ResourcePortfolio() {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [tab, setTab] = useState<Tab>('books')
  // 단일 공용단어장 행 탭 → 챕터 학습 모달(게임 런처). 학습자는 이미 구독 → 모달 CTA=구독 해지.
  const [preview, setPreview] = useState<PublishedVocabSet | null>(null)
  const [pendingUnsub, setPendingUnsub] = useState(false)

  // SetEntry(경량 메타) → 모달이 요구하는 PublishedVocabSet 최소 형태로 승격(모달은 id/title/wordCount/coverEmoji만 사용).
  function openSet(s: SetEntry) {
    if (!s.setId) return
    setPreview({
      id: s.setId,
      title: s.title,
      description: null,
      category: (s.category ?? 'themed') as PublishedVocabSet['category'],
      categoryNode: null,
      additionalCategoryIds: [],
      cefrLevel: s.cefrLevel ?? null,
      coverEmoji: s.coverEmoji ?? null,
      sortOrder: 0,
      wordCount: s.wordCount,
      subscriberCount: 0,
      createdAt: new Date(0).toISOString(),
    })
  }

  // 모달 CTA(구독 해지) — 확인 후 해지, 성공 시 목록에서 제거 + 모달 닫기. 학습 기록은 서버에서 보존.
  async function handleUnsub(set: PublishedVocabSet) {
    const ok = window.confirm(
      `"${set.title}" 구독을 해지할까요?\n· 단어장이 내 목록에서 빠집니다.\n· 이미 학습한 단어·기록은 보존돼요.`,
    )
    if (!ok) return
    setPendingUnsub(true)
    try {
      const res = await unsubscribeSet(set.id)
      if (res.ok) {
        setState((prev) =>
          prev.kind === 'ready'
            ? { ...prev, sets: prev.sets.filter((x) => x.setId !== set.id) }
            : prev,
        )
        setPreview(null)
      }
    } finally {
      setPendingUnsub(false)
    }
  }

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
        cover_emoji: string | null
      }> = []
      if (setIds.length > 0) {
        const { data } = await supabase
          .from('shared_word_sets')
          .select('id, title, category, curation_query, cefr_level, cover_emoji')
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

      const countsPerSet = new Map<string, number>()
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
      // 내부 챕터(shared_words.chapter) 보유 세트만 학습 모달(챕터 런처)로 라우팅 — 챕터 없는 세트는
      //   모달이 10개 미리보기뿐이라 기존 '단어 브라우저' 링크가 더 유용. 표준 subscribed 세트는 소수라
      //   set_id만 선택하는 단일 쿼리로 충분(챕터형 세트=교육과정류 ≤1184단어).
      const chapteredSetIds = new Set<string>()
      const otherSetIds = otherSets.map((s) => s.id)
      if (otherSetIds.length > 0) {
        const { data: chRows } = await supabase
          .from('shared_words')
          .select('set_id')
          .in('set_id', otherSetIds)
          .not('chapter', 'is', null)
          .limit(10000)
        for (const r of (chRows ?? []) as Array<{ set_id: string }>) {
          chapteredSetIds.add(r.set_id)
        }
      }

      for (const s of otherSets) {
        const wc = countsPerSet.get(s.id) ?? 0
        const chaptered = chapteredSetIds.has(s.id)
        sets.push({
          title: s.title,
          wordCount: wc,
          href: `/wordvault/browse?filter=set:${s.id}`,
          // 챕터형 세트만 setId 부여 → 행 탭 시 챕터 학습 모달. 그 외는 href(단어 브라우저) 유지.
          ...(chaptered
            ? { setId: s.id, coverEmoji: s.cover_emoji, category: s.category, cefrLevel: s.cefr_level }
            : {}),
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

  const segmentItems: SegmentItem<Tab>[] = (['books', 'scripts', 'sets'] as Tab[]).map((t) => ({
    key: t,
    label: TAB_META[t].label,
    icon: TAB_META[t].icon,
    count: counts[t],
  }))

  return (
    <>
    <Frame title="학습 자산">
      <SegmentControl
        ariaLabel="자산 종류"
        active={tab}
        onChange={setTab}
        items={segmentItems}
        block
        className="mb-5"
      />

      {/* List body */}
      {tab === 'books' && (
        <InsetGroup>
          {books.length === 0 ? (
            <EmptyRow text="라이브러리 도서를 학습 시작하세요." href="/library/books" />
          ) : (
            books.slice(0, 5).map((b) => (
              <InsetRow
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
        <InsetGroup>
          {scripts.length === 0 ? (
            <EmptyRow text="스크립트를 입력해 보세요." href="/text/new" />
          ) : (
            scripts.slice(0, 5).map((s) => (
              <InsetRow
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
        <InsetGroup>
          {sets.length === 0 ? (
            <EmptyRow text="진단 후 단어장을 구독해 보세요." href="/library/vocab" />
          ) : (
            sets.slice(0, 5).map((s, i) => (
              <InsetRow
                key={s.setId ?? s.bookId ?? `set-${i}`}
                // 단일 세트 → 챕터 학습 모달 오픈 · 도서 묶음 세트 → 단어 브라우저로 이동(기존)
                {...(s.setId ? { onClick: () => openSet(s) } : { href: s.href })}
                icon={<Library size={14} aria-hidden />}
                iconBg={TAB_META.sets.color}
                title={s.title}
                subtitle={
                  s.chapters != null
                    ? `${s.chapters}장${s.author ? ` · ${s.author}` : ''}`
                    : s.setId
                      ? '공용 단어장 · 탭하면 챕터 학습'
                      : '공용 단어장'
                }
                metaRight={`${NF.format(s.wordCount)}개`}
              />
            ))
          )}
        </InsetGroup>
      )}
    </Frame>

      {/* 챕터 학습 모달 — /library/vocab 과 동일 컴포넌트 재사용(챕터 아코디언 + 게임별 런처). from=/wordvault 복귀. */}
      <VocabSetPreviewModal
        set={preview}
        isSubscribed
        isPending={pendingUnsub}
        onToggle={handleUnsub}
        onClose={() => setPreview(null)}
        fromPath="/wordvault"
      />
    </>
  )
}

function EmptyRow({ text, href }: { text: string; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between px-4 py-4 transition-colors duration-[var(--dur-ios-fast)] hover:bg-[var(--bg2)]"
    >
      <span className="font-body text-[13px] text-[var(--t2)]">{text}</span>
      <ChevronRight size={16} className="text-[var(--t2)]/70" aria-hidden />
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
    <p className="font-body text-[13px] text-[var(--t2)]">
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

