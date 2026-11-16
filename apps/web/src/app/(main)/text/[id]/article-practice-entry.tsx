// apps/web/src/app/(main)/text/[id]/article-practice-entry.tsx
// R0 — Reader 본문 아래 기사 연습 진입(T-0204). 세 상태:
//   available → 기존 링크 「다 읽었다면 · 발췌문으로 제목 · 주제 골라 보기」(문구 그대로)
//   none      → 아무것도 그리지 않음(예전과 같다)
//   failed    → 「연습 여부를 확인하지 못했어요」 + 연습 페이지로 가는 링크 하나(그 loader 가 다시 확인). 화면 안 재호출 · 자동 재시도 없음.
// 에러 원문 · 계정 · SQL 은 쓰지 않는다. 기사 글이 아니면 호출부가 상태를 만들지 않는다(null).

import Link from 'next/link'

import type { ReaderArticlePractice } from '@/lib/learner/reader-article-practice'

const BOX = 'inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-4 font-display text-[13px] font-[700] text-[var(--t1)] transition-colors hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]'

export function ArticlePracticeEntry({ practice }: { practice: ReaderArticlePractice | null | undefined }) {
  if (!practice || practice.state === 'none') return null
  return (
    <div className="mx-auto max-w-[680px] px-6 pb-6 md:px-8" data-testid="reader-article-practice-entry" data-state={practice.state}>
      {practice.state === 'available' ? (
        <Link href={practice.href} data-testid="reader-article-practice" className={BOX}>
          다 읽었다면 · 발췌문으로 제목 · 주제 골라 보기
        </Link>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <p className="break-keep font-body text-[13px] text-[var(--t2)]" data-testid="reader-article-practice-failed">
            연습 여부를 확인하지 못했어요
          </p>
          <Link href={practice.href} data-testid="reader-article-practice-recheck" className={BOX}>
            연습 페이지에서 다시 확인하기
          </Link>
        </div>
      )}
    </div>
  )
}
