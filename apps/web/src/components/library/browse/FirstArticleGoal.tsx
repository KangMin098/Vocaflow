// apps/web/src/components/library/browse/FirstArticleGoal.tsx
//
// R0-C2-01 — 서가 진입면의 **선택적** 임시 목표: 「짧은 글 한 편을 고르고 핵심 내용 확인해 보기」.
// - 누르면 지금 받은 발행 목록 ∩ 연습 문항이 있는 글(서버 1회 조회 결과)을 기존 ArticleCard 로 보여 주고, 고르는 것은 학습자다.
// - 이 방문의 React 상태만 쓴다 — DB · 주소 · 쿠키 · localStorage 저장 없음, 자동 선택 · 학습 기록 없음, 추가 요청 없음(패널 링크는 prefetch={false} — 카드마다 RSC 요청이 생기지 않게).
// - 진단 · 수준 적합 · 성취를 말하지 않는다. 문항이 있다는 사실만 말한다(카드의 적합 표지도 hideFit 으로 숨긴다).
// - 아래 전체 탐색은 열려 있든 닫혀 있든 그대로 남는다. 닫으면 초점을 여는 단추로 돌려준다.

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ClipboardCheck, X } from 'lucide-react'

import type { PublishedArticle } from '@/lib/articles/types'
import { practiceReadyArticles, type ArticlePracticeAvailability } from '@/lib/learner/article-practice-availability'

import { ArticleCard } from './ArticleCard'

export const FIRST_ARTICLE_GOAL_LABEL = '짧은 글 한 편을 고르고 핵심 내용 확인해 보기'

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]'

export function FirstArticleGoal({
  articles,
  practice,
  userVLevel,
  initialOpen = false,
}: {
  articles: PublishedArticle[]
  practice: ArticlePracticeAvailability | null
  userVLevel: number
  /** 테스트용 — 화면은 언제나 닫힌 채로 시작한다. */
  initialOpen?: boolean
}) {
  const [open, setOpen] = useState(initialOpen)
  const openerRef = useRef<HTMLButtonElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  // 학습자가 연 직후에만 초점을 제목으로 옮긴다(여는 단추가 사라지므로). 첫 렌더에는 옮기지 않는다.
  const openedByUser = useRef(false)
  useEffect(() => {
    if (open && openedByUser.current) {
      openedByUser.current = false
      titleRef.current?.focus()
    }
  }, [open])
  const ready = useMemo(() => practiceReadyArticles(articles, practice), [articles, practice])

  const close = () => {
    setOpen(false)
    // 닫는 단추가 사라지므로 초점을 여는 단추로 돌린다(초점이 body 로 떨어지지 않게).
    requestAnimationFrame(() => openerRef.current?.focus())
  }

  if (!open) {
    return (
      <section aria-label="이 방문에서 해 볼 임시 목표" className="px-1">
        <button
          ref={openerRef}
          type="button"
          onClick={() => {
            openedByUser.current = true
            setOpen(true)
          }}
          data-testid="first-article-goal-open"
          className={`inline-flex min-h-11 w-full max-w-full items-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-4 py-2 text-left font-display text-[13.5px] font-[700] text-[var(--t1)] transition-colors duration-[var(--dur-normal)] hover:border-[var(--t1)] sm:w-fit ${FOCUS}`}
        >
          <ClipboardCheck size={16} aria-hidden className="shrink-0 text-[var(--p)]" />
          <span className="break-keep">{FIRST_ARTICLE_GOAL_LABEL}</span>
        </button>
      </section>
    )
  }

  return (
    <section
      aria-labelledby="first-article-goal-title"
      data-testid="first-article-goal"
      className="flex flex-col gap-4 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-display text-[11px] font-[800] uppercase tracking-[0.09em] text-[var(--p)]">이 방문에서 해 볼 임시 목표</span>
          <h2 id="first-article-goal-title" ref={titleRef} tabIndex={-1} className="break-keep outline-none font-display text-[16px] font-[800] leading-[1.3] text-[var(--t1)]">
            {FIRST_ARTICLE_GOAL_LABEL}
          </h2>
          <p className="break-keep font-body text-[13px] leading-[1.45] text-[var(--t2)]">
            연습 문항이 준비된 글만 모았어요. 한 편을 직접 골라 읽고 문항으로 핵심을 확인해 보세요.
          </p>
        </div>
        <button
          type="button"
          onClick={close}
          data-testid="first-article-goal-close"
          className={`inline-flex min-h-11 shrink-0 items-center gap-1 rounded-[var(--r-md)] px-3 font-display text-[12.5px] font-[700] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] hover:bg-[color-mix(in_srgb,var(--t1)_6%,transparent)] hover:text-[var(--t1)] ${FOCUS}`}
        >
          <X size={14} aria-hidden /> 전체 탐색으로 돌아가기
        </button>
      </div>

      {ready.state === 'signed_out' && (
        <p data-testid="first-article-goal-signed-out" className="break-keep font-body text-[13.5px] text-[var(--t1)]">
          연습이 준비된 글은 로그인한 뒤에 볼 수 있어요.{' '}
          <Link href="/login?next=%2Flibrary%2Fscripts" prefetch={false} className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--r-sm)] px-1 font-[700] text-[var(--p)] underline underline-offset-2 ${FOCUS}`}>
            로그인
          </Link>
        </p>
      )}
      {ready.state === 'failed' && (
        <p data-testid="first-article-goal-failed" role="status" className="break-keep font-body text-[13.5px] text-[var(--t1)]">
          연습 준비 여부를 지금 불러오지 못했어요. 「없다」는 뜻은 아니에요 — 아래 전체 목록에서 글을 골라도 돼요.
        </p>
      )}
      {ready.state === 'ok' && ready.items.length === 0 && (
        <p data-testid="first-article-goal-empty" role="status" className="break-keep font-body text-[13.5px] text-[var(--t1)]">
          지금 서가에는 연습 문항이 준비된 글이 없어요. 아래 전체 목록에서 읽을 글을 골라 보세요.
        </p>
      )}
      {ready.state === 'ok' && ready.items.length > 0 && (
        <>
          <p className="font-mono text-[11.5px] font-[600] text-[var(--t2)]">연습이 준비된 글 {ready.items.length}편</p>
          <ul data-testid="first-article-goal-list" className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {ready.items.map(({ article, count }) => (
              <li key={article.id} className="min-w-0">
                <ArticleCard article={article} userVLevel={userVLevel} practiceCount={count} hideFit prefetch={false} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
