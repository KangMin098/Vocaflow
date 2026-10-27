// apps/web/src/components/practice/ArticlePracticeBridge.tsx
// R0 — 읽은 같은 기사의 중심 의미 안내 연습을 기존 DcpPlayer 로 그린다(/practice/article/[articleId]).
// 채점은 서버 제출(submitArticlePractice → submit_article_practice)로만, 복귀는 그 본인 글로.
// DcpPlayer 자체는 바꾸지 않는다 — grade·doneCopy·backHref prop 만 쓴다.
//
// ⚠️ 계정 경계: loader 가 확인한 계정(ownerId)과 브라우저 신원이 **같다고 확인된 때만** 문항을 그리고 제출한다(useStoryAuthGuard).
//   확인 중 · 바뀜이면 문항 · 결과를 숨긴다. 그려 둔 채점 콜백을 나중에 불러도, 응답이 늦게 와도 그 사이 신원이 바뀌었으면 결과를 버린다.

'use client'

import Link from 'next/link'

import { DcpPlayer } from '@/components/practice/DcpPlayer'
import { useStoryAuthGuard, type StoryAuthGuard } from '@/components/library/story/use-story-auth-guard'
import type { DcpGradeResult, DcpItem } from '@/lib/learner/dcp'
import { submitArticlePractice, type ArticlePracticeContext } from '@/lib/learner/article-practice-actions'

type Submit = (context: ArticlePracticeContext, itemId: string, answer: { choice?: unknown }) => Promise<DcpGradeResult>

const CHANGED: DcpGradeResult = { ok: false, error: '로그인 상태가 바뀌었어요. 글을 다시 열어 주세요.' }

/** DcpPlayer 의 grade(itemId, answer) → 이 문맥(기사 · 본인 글 · 계정)의 제출. 신원이 같을 때만 보내고, 돌아와서도 같을 때만 받는다. */
export function makeArticleGrade(context: ArticlePracticeContext, guard: Pick<StoryAuthGuard, 'getStatus'>, submit: Submit = submitArticlePractice) {
  return async (itemId: string, answer: Record<string, unknown>): Promise<DcpGradeResult> => {
    if (guard.getStatus() !== 'same') return CHANGED
    const res = await submit(context, itemId, { choice: answer.choice })
    return guard.getStatus() === 'same' ? res : CHANGED
  }
}

/** 완료 문구 — 관측한 결과만. 원문을 읽은 뒤 발췌문으로 하는 안내 연습이라 이해 · 실력 향상을 말하지 않는다. */
export function articlePracticeDoneCopy({ total, correct }: { total: number; correct: number }) {
  return {
    title: `${total}문제 중 ${correct}문제를 맞혔어요`,
    body: '읽은 글의 발췌문으로 중심 의미를 고르는 안내 연습이었어요. 글로 돌아가 근거를 다시 확인할 수 있어요.',
  }
}

export function ArticlePracticeBridge({
  articleId,
  textId,
  ownerId,
  items,
  submit,
}: {
  articleId: string
  textId: string
  ownerId: string
  items: DcpItem[]
  /** 개발 확인 화면만 바꾼다(기본 = 실제 서버 제출) */
  submit?: Submit
}) {
  const { guard, status } = useStoryAuthGuard(ownerId)
  if (status !== 'same') {
    return (
      <div className="flex flex-col gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5" data-testid="article-practice-identity" role="status">
        <p className="break-keep font-body text-[13.5px] leading-relaxed text-[var(--t1)]">
          {status === 'checking' ? '로그인 상태를 확인하고 있어요.' : '로그인 상태가 바뀌었어요. 지금 계정으로 글을 다시 열어 주세요.'}
        </p>
        {status === 'changed' && (
          <Link
            href="/library/scripts"
            className="inline-flex min-h-[44px] items-center self-start rounded-[var(--r-md)] border border-[var(--bd)] px-4 font-display text-[13px] font-[700] text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            글 목록으로
          </Link>
        )}
      </div>
    )
  }
  return (
    <DcpPlayer
      key={articleId}
      revisit
      items={items}
      grade={makeArticleGrade({ articleId, textId, ownerId }, guard, submit)}
      backHref={`/text/${textId}`}
      backCta="읽던 글로"
      doneCopy={articlePracticeDoneCopy}
    />
  )
}
