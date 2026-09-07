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
import { useState } from 'react'

import { unsubscribeSet } from '@/app/(main)/library/vocab/actions'
import { VocabSetPreviewModal } from '@/components/library/vocab/VocabSetPreviewModal'
import { Frame, InsetGroup, InsetRow, SegmentControl } from '@/components/ui/ios'
import type { SegmentItem } from '@/components/ui/ios'
import { MATERIAL_LABEL } from '@/lib/learner/plan-activities'
import type { PublishedVocabSet } from '@/lib/library/vocab/queries'

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

type Tab = 'books' | 'scripts' | 'sets'

const NF = new Intl.NumberFormat('en-US')

// 라벨 출처 = `MATERIAL_LABEL`. 'scripts' 는 학습자가 넣은 본문(script)이므로 **Texts**,
// 라이브러리의 공개 짧은 글(Dispatches)과는 다른 것이다. (내부 키는 'scripts' 유지 — 이름만 확정.)
const TAB_META: Record<Tab, { label: string; icon: LucideIcon; color: string }> = {
  books: { label: MATERIAL_LABEL.book, icon: BookOpen, color: 'var(--ios-orange)' },
  scripts: { label: MATERIAL_LABEL.script, icon: FileText, color: 'var(--p)' },
  sets: { label: MATERIAL_LABEL.word_set, icon: Library, color: 'var(--ios-purple)' },
}

interface ResourcePortfolioProps {
  books: BookEntry[]
  scripts: ScriptEntry[]
  sets: SetEntry[]
}

/**
 * ⚠️ **스스로 조회하지 않는다** — `lib/wordvault/hub-query.ts` 가 서버에서 한 벌로 읽는다.
 *
 * 예전에는 이 컴포넌트 하나가 마운트 후 `auth.getUser()` → `texts` → 챕터 진행 →
 * 구독 세트 → 세트 메타까지 스스로 왕복했다. 허브의 다른 섹션들도 저마다 같은 일을 해서
 * `/wordvault` 한 화면이 `auth.getUser()` 를 **8번** 부르고 단어 전량을 **두 번** 내려받았다
 * (실측 2026-09-05). 여기에 조회를 다시 붙이면 그 낭비가 되살아난다 — props 를 늘려라.
 */
export function ResourcePortfolio({
  books,
  scripts,
  sets: allSets,
}: ResourcePortfolioProps) {
  /** 이번 화면에서 해지한 세트 id — 서버가 다시 읽어 올 때까지 화면에서만 뺀다. */
  const [unsubscribed, setUnsubscribed] = useState<Set<string>>(() => new Set())
  const [tab, setTab] = useState<Tab>('books')
  // 학습자가 탭을 실제로 눌렀는가 — 누르기 전에는 화면이 가장 많이 가진 종류를 연다.
  const [touched, setTouched] = useState(false)
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
      // 모달은 id/title/wordCount/coverEmoji 만 쓴다 — 유형 줄은 카탈로그 카드에서만 보인다.
      kind: null,
      coverImageUrl: null,
      coverImageMeta: null,
      // 이 자리는 내 구독 목록이라 출판 정보를 싣지 않는다(판권면은 카탈로그에서 본다).
      brandFingerprint: null,
      ladderStep: null,
      // 표지 계열·슬러그도 같은 이유로 안 싣는다 — 이 승격은 모달의 최소 형태다.
      brandFamily: null,
      slug: null,
      // 판권면 3종 — 이 승격은 모달의 최소 형태라 각인값을 갖고 오지 않는다.
      //   판권면은 그 줄들을 통째로 뺀다(없는 것을 지어내지 않는다).
      imprintCode: null,
      qa: null,
      level: null,
    })
  }

  // 모달 CTA(구독 해지) — 확인 후 해지, 성공 시 목록에서 제거 + 모달 닫기. 학습 기록은 서버에서 보존.
  async function handleUnsub(set: PublishedVocabSet) {
    const ok = window.confirm(
      `"${set.title}" 구독을 해지할까요?\n· 단어장이 내 목록에서 빠집니다.\n· 이미 학습한 단어·기록은 보존돼요.`
    )
    if (!ok) return
    setPendingUnsub(true)
    try {
      const res = await unsubscribeSet(set.id)
      if (res.ok) {
        setUnsubscribed((prev) => new Set(prev).add(set.id))
        setPreview(null)
      }
    } finally {
      setPendingUnsub(false)
    }
  }

  // 구독을 해지한 세트는 서버가 다음 렌더에서 빼 준다. 그전까지 화면에서만 미리 지운다 —
  // 지우지 않으면 해지했는데 그대로 남아 "안 먹었다" 로 읽힌다.
  const sets = allSets.filter((s) => !s.setId || !unsubscribed.has(s.setId))
  const counts = { books: books.length, scripts: scripts.length, sets: sets.length }
  const isEmpty = counts.books === 0 && counts.scripts === 0 && counts.sets === 0

  if (isEmpty) {
    return (
      <Frame title="학습 자산">
        <EmptyState
          text="아직 학습 중인 자산이 없어요."
          href="/library/books"
          linkLabel="라이브러리 둘러보기"
        />
      </Frame>
    )
  }

  /*
    탭은 **가진 것만** 판다.

    이전에는 셋을 항상 세우고 기본값이 언제나 `books` 였다. 그래서 두 가지가 났다:
      ① 0개인 종류도 탭으로 팔았다 — 눌러 보면 빈 목록이다(거짓 어포던스).
      ② 이 계정(Books 1 · Scripts 1 · Decks 2)에서 **4개 중 1개만 보이는 곳**에 착지했다.
         탭 막대가 한 행만큼 자리를 먹는데 그 아래 내용이 한 줄인 셈이다.
    → 0개 탭은 세우지 않고, 시작 탭은 **가장 많이 가진 종류**로 연다.
      (탭이 하나만 남으면 막대 자체를 렌더하지 않는다 — 고를 것이 없는 컨트롤은 장식이다.)
  */
  const available = (['books', 'scripts', 'sets'] as Tab[]).filter((t) => counts[t] > 0)
  const segmentItems: SegmentItem<Tab>[] = available.map((t) => ({
    key: t,
    label: TAB_META[t].label,
    icon: TAB_META[t].icon,
    count: counts[t],
  }))
  // 사용자가 아직 안 고른 상태에서만 자동 선택한다 — 고른 뒤에 바뀌면 조작이 무시된 것으로 읽힌다.
  const fullest = available.reduce((a, b) => (counts[b] > counts[a] ? b : a), available[0]!)
  const activeTab: Tab = touched && counts[tab] > 0 ? tab : fullest

  return (
    <>
      <Frame title="학습 자산">
        {/* 탭이 하나뿐이면 막대를 세우지 않는다 — 고를 것이 없는 컨트롤은 장식이다. */}
        {segmentItems.length > 1 && (
          <SegmentControl
            ariaLabel="자산 종류"
            active={activeTab}
            onChange={(t) => {
              setTouched(true)
              setTab(t)
            }}
            items={segmentItems}
            block
            className="mb-5"
          />
        )}

        {/* List body */}
        {activeTab === 'books' && (
          <InsetGroup>
            {books.length === 0 ? (
              <EmptyRow text="라이브러리 도서를 학습 시작하세요." href="/library/books" />
            ) : (
              books
                .slice(0, 5)
                .map((b) => (
                  <InsetRow
                    key={b.bookId}
                    href={
                      b.resumeTextId
                        ? `/text/${b.resumeTextId}?mode=read`
                        : `/library/books/${b.bookId}`
                    }
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

        {activeTab === 'scripts' && (
          <InsetGroup>
            {scripts.length === 0 ? (
              <EmptyRow text="스크립트를 입력해 보세요." href="/text/new" />
            ) : (
              scripts
                .slice(0, 5)
                .map((s) => (
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

        {activeTab === 'sets' && (
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
