// apps/web/src/components/practice/TextbookPracticeBridge.tsx
// 교재 연습의 계정 경계 — loader 가 확인한 계정(ownerId)과 브라우저 신원이 **같다고 확인된 때만** 문항 · 답 · 해설을 그린다.
// 확인 중 · 바뀜이면 TextbookPracticeScope 전체를 내리고 다시 여는 길만 둔다. 같을 때만 「이미 본 해설 다시 보기」(revisit)를 켠다.
// 채점은 gradeTextbookPracticeItem(서버가 요청의 getUser 와 예상 주인을 다시 비교) — 보낼 때 · 받을 때 경계 세대를 확인한다.
// uid 는 비교에만 쓴다(화면 · URL · 분석에 싣지 않는다). 기사 연습 다리(ArticlePracticeBridge)와 같은 경계를 재사용한다.

'use client'

import Link from 'next/link'

import { TextbookPracticeScope } from '@/components/practice/TextbookPracticeScope'
import { useStoryAuthGuard, type StoryAuthGuard } from '@/components/library/story/use-story-auth-guard'
import type { DcpGradeResult, DcpItem } from '@/lib/learner/dcp'
import { gradeTextbookPracticeItem } from '@/lib/learner/dcp-actions'
import type { VolumePracticePath } from '@/lib/textbook/practice-rpc'

type Submit = (expectedOwner: string, itemId: string, answer: Record<string, unknown>) => Promise<DcpGradeResult>

const CHANGED: DcpGradeResult = { ok: false, error: '로그인 상태가 바뀌었어요. 연습을 다시 열어 주세요.' }

/** DcpPlayer 의 grade → 예상 주인을 붙인 서버 채점. 보낼 때 같은 세대 · same 이고, 돌아와서도 그 세대일 때만 받는다. */
export function makeTextbookGrade(ownerId: string, guard: Pick<StoryAuthGuard, 'token' | 'isCurrent'>, submit: Submit = gradeTextbookPracticeItem) {
  return async (itemId: string, answer: Record<string, unknown>): Promise<DcpGradeResult> => {
    const token = guard.token()
    if (!guard.isCurrent(token)) return CHANGED
    const res = await submit(ownerId, itemId, answer)
    return guard.isCurrent(token) ? res : CHANGED
  }
}

export function TextbookPracticeBridge({
  items,
  scope,
  ownerId,
  backHref,
  backCta,
  reopenHref,
  submit,
}: {
  items: DcpItem[]
  scope: VolumePracticePath | null
  ownerId: string
  backHref: string
  backCta: string
  /** 지금 계정으로 다시 여는 내부 경로(이 연습 화면) */
  reopenHref: string
  /** 격리 개발 화면만 바꾼다(기본 = 서버 채점 래퍼) */
  submit?: Submit
}) {
  const { guard, status } = useStoryAuthGuard(ownerId)
  if (status !== 'same') {
    return (
      <div className="flex flex-col gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5" data-testid="textbook-practice-identity" role="status">
        <p className="m-0 break-keep font-body text-[13.5px] leading-relaxed text-[var(--t1)]">
          {status === 'checking' ? '로그인 상태를 확인하고 있어요.' : '로그인 상태가 바뀌었어요. 지금 계정으로 연습을 다시 열어 주세요.'}
        </p>
        {status === 'changed' && (
          <div className="flex flex-wrap gap-2">
            {/* 새로 고침 진입이어야 서버 loader 가 지금 계정으로 문항을 다시 받는다 — 클라이언트 이동(Link)이 아니라 a */}
            <a
              href={reopenHref}
              className="inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[var(--bd)] px-4 font-display text-[13px] font-[700] text-[var(--t1)] no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
            >
              연습 다시 열기
            </a>
            <Link href={backHref} className="inline-flex min-h-[44px] items-center rounded-[var(--r-md)] px-4 font-display text-[13px] font-[700] text-[var(--t2)] no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]">
              {backCta}
            </Link>
          </div>
        )}
      </div>
    )
  }
  return (
    <TextbookPracticeScope
      items={items}
      scope={scope}
      backHref={backHref}
      backCta={backCta}
      grade={makeTextbookGrade(ownerId, guard, submit)}
      revisit
    />
  )
}
