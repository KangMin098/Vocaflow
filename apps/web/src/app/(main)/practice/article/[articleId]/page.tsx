// apps/web/src/app/(main)/practice/article/[articleId]/page.tsx
//
// R0 — 읽은 같은 기사의 **발췌문** 중심 의미 안내 연습. 진입은 그 기사를 연 본인 글 화면(/text/[id])의 링크.
// loader(loadArticlePractice)가 본인 글 · 현재 판본 · 계정 · 검수 후보를 확인하고, 실패 사유마다 그대로 말한다 —
// 다른 기사 · 레벨 풀 · 데모로 대신하지 않는다. 정답은 제출 전 보이지 않는다(조회 함수가 돌려주지 않는다).
// ⚠️ 원문을 읽은 뒤의 연습이다 — 독립 수행 · 새 자료 전이 · 학습 효과의 근거가 아니다.

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { ArticlePracticeBridge } from '@/components/practice/ArticlePracticeBridge'
import { Screen } from '@/components/ui/ios'
import { loadArticlePractice } from '@/lib/learner/article-practice-actions'
import { ARTICLE_PRACTICE_REASON } from '@/lib/learner/article-practice-copy'

export const metadata = {
  title: '글 중심 의미 연습',
  description: '읽은 글의 발췌문으로 제목 · 주제를 골라 보는 안내 연습',
}

export const dynamic = 'force-dynamic'

export default async function ArticlePracticePage({ params }: { params: { articleId: string } }) {
  const res = await loadArticlePractice(params.articleId)
  return (
    <Screen width="compact" background="bg2" padX="md">
      <div className="flex flex-col gap-4 py-6 md:py-8">
        <header className="flex flex-col gap-1">
          <Link
            href={res.ok ? `/text/${res.textId}` : '/library/scripts'}
            className="inline-flex min-h-[44px] w-fit min-w-[44px] items-center gap-1 font-display text-[12px] font-[700] text-[var(--t2)] no-underline transition-colors duration-[var(--dur-normal)] hover:text-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            <ArrowLeft size={13} strokeWidth={2} aria-hidden />
            {res.ok ? '읽던 글로' : '글 목록으로'}
          </Link>
          <h1 className="break-keep font-display text-[20px] font-[800] text-[var(--t1)]">글 중심 의미 연습</h1>
          <p className="break-keep font-body text-[12.5px] leading-relaxed text-[var(--t2)]">
            읽은 글의 <strong className="font-[700]">발췌문</strong>으로 제목 · 주제를 골라 봐요. 글 전체를 평가하는 시험이 아니라 읽은 뒤의 안내 연습이에요.
          </p>
        </header>
        {res.ok ? (
          <ArticlePracticeBridge articleId={params.articleId} textId={res.textId} ownerId={res.ownerId} items={res.items} vocab={res.vocab} />
        ) : (
          <p
            role="status"
            data-testid="article-practice-reason"
            data-reason={res.reason}
            className="break-keep rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 font-body text-[13.5px] leading-relaxed text-[var(--t1)]"
          >
            {ARTICLE_PRACTICE_REASON[res.reason]}
          </p>
        )}
      </div>
    </Screen>
  )
}
