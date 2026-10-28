// apps/web/src/components/practice/ArticlePracticeBridge.tsx
// R0 — 읽은 같은 기사의 중심 의미 안내 연습을 기존 DcpPlayer 로 그린다(/practice/article/[articleId]).
// 채점은 서버 제출(submitArticlePractice → submit_article_practice)로만, 복귀는 그 본인 글로.
// DcpPlayer 의 기존 prop 만 쓴다 — grade·doneCopy·backHref·nextChoice(완료 뒤 「다른 글 살펴보기」, opt-in).
//
// ⚠️ 계정 경계: loader 가 확인한 계정(ownerId)과 브라우저 신원이 **같다고 확인된 때만** 문항을 그리고 제출한다(useStoryAuthGuard).
//   확인 중 · 바뀜이면 문항 · 결과를 숨긴다. 그려 둔 채점 콜백을 나중에 불러도, 응답이 늦게 와도 그 사이 신원이 바뀌었으면 결과를 버린다.

'use client'

import Link from 'next/link'

import { ArticleReadingReference } from '@/components/practice/ArticleReadingReference'
import { DcpPlayer } from '@/components/practice/DcpPlayer'
import { useStoryAuthGuard, type StoryAuthGuard } from '@/components/library/story/use-story-auth-guard'
import type { DcpGradeResult, DcpItem } from '@/lib/learner/dcp'
import { submitArticlePractice, type ArticlePracticeContext, type ArticleVocabSource } from '@/lib/learner/article-practice-actions'
import { NEXT_READING_CHOICE } from '@/lib/learner/next-reading-choice'
import { readerSource, textSourceFilter } from '@/lib/wordvault/source-filter'

/**
 * 「단어를 몰랐어요」 → 이 기사의 내 단어 목록. 출처는 서버 loader 가 정한 것(vocab)으로 Reader 「단어」 와 **같은 결정**(readerSource)을 쓴다:
 *   발행 기사 세트가 있으면 set: (구독 단어는 text_id 가 비어 있어 text: 로는 0 이었다) · 실제로 없으면 본인 글 text:.
 *   조회 실패(unknown)면 단어 목록을 짐작하지 않고 읽던 글로 보낸다 — 그 화면의 「단어」 가 같은 결정으로 다시 고른다.
 * `from` = 이 글 본문 — SessionFrame 이 sanitizeInternalPath 로 검증해 닫기 · Esc 복귀에 쓴다.
 * 복귀 대상은 읽던 글이지 연습 진행 상태가 아니다(이어 풀기 아님). 전체 Flashcard · 전체 단어장으로 보내지 않는다.
 */
export function articleVocabHref(textId: string, vocab: ArticleVocabSource): string {
  if (vocab.kind === 'unknown') return `/text/${textId}`
  const src = readerSource({ textId, libraryBookId: null, currentChapterWordSet: vocab.kind === 'set' ? { id: vocab.setId } : null })
  const filter = src.kind === 'article-set' ? `set:${src.setId}` : textSourceFilter(textId)
  const qs = new URLSearchParams({ filter, from: `/text/${textId}` })
  return `/wordvault/browse?${qs.toString()}`
}

export const ARTICLE_VOCAB_UNKNOWN_LABEL = '읽던 글에서 단어 다시 보기'

/** 조회 실패(unknown)면 목적지가 읽던 글이므로 「복습하기」 대신 그 이동을 말한다. set · text 는 기본 문구. */
export function articleVocabLabel(vocab: ArticleVocabSource): { vocab: string } | undefined {
  return vocab.kind === 'unknown' ? { vocab: ARTICLE_VOCAB_UNKNOWN_LABEL } : undefined
}

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

/** 완료 뒤 자율 선택 — 기존 내부 서가로 고정. 특정 글 · 샘플로 자동 전환하지 않는다(다른 글에 연습이 있다고 말하지 않는다). */
export const ARTICLE_NEXT_CHOICE = NEXT_READING_CHOICE

export function ArticlePracticeBridge({
  articleId,
  textId,
  ownerId,
  items,
  vocab,
  submit,
  readingText = null,
}: {
  articleId: string
  textId: string
  ownerId: string
  items: DcpItem[]
  /** 단어 출처 — 서버 loader 가 정한 값만(set · text · unknown) */
  vocab: ArticleVocabSource
  /** 개발 확인 화면만 바꾼다(기본 = 실제 서버 제출) */
  submit?: Submit
  /** 「읽은 글 참고」 본문 — loader 가 관문에서 검증한 본인 글만(없으면 참고 영역 없음) */
  readingText?: string | null
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
      causeHref={{ vocab: articleVocabHref(textId, vocab) }}
      causeLabel={articleVocabLabel(vocab)}
      doneCopy={articlePracticeDoneCopy}
      nextChoice={ARTICLE_NEXT_CHOICE}
      afterFeedback={readingText ? <ArticleReadingReference text={readingText} /> : undefined}
    />
  )
}
