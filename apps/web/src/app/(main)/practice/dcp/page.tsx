// apps/web/src/app/(main)/practice/dcp/page.tsx
//
// CTP DCP(구문 연습) 플레이 화면 — hub "오늘" 처방 ④ 연습 블록의 진입점.
// 오늘 처방 practice 문항(order/insert)을 세션으로 진행 → grade_dcp_item 채점 → 오답 시 error_cause.
// S3 미만/문항 없으면 빈 상태(Calm). 처방 정본화(META Opt A) Phase 2.

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { DcpPlayer } from '@/components/practice/DcpPlayer'
import { Screen } from '@/components/ui/ios'
import { fetchDcpPracticeItems } from '@/lib/learner/dcp-actions'

export const metadata = {
  title: '구문 연습 · Vocaflow',
  description: '문장의 순서와 위치로 글의 논리 구조를 훈련해요',
}

export default async function DcpPracticePage() {
  const { active, items } = await fetchDcpPracticeItems()

  return (
    <Screen width="compact" background="bg2" padX="md">
      <div className="flex flex-col gap-4 py-6 md:py-8">
        <header className="flex flex-col gap-1">
          <Link
            href="/hub"
            className="inline-flex w-fit items-center gap-1 font-display text-[12px] font-[700] text-[var(--t2)] no-underline transition-colors hover:text-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            <ArrowLeft size={13} strokeWidth={2} aria-hidden />
            오늘
          </Link>
          <h1 className="font-display text-[20px] font-[800] text-[var(--t1)]">구문 연습</h1>
          <p className="font-body text-[13px] text-[var(--t2)]">
            문장의 순서와 위치로 글의 논리 구조를 훈련해요.
          </p>
        </header>

        {active && items.length > 0 ? (
          <DcpPlayer items={items} />
        ) : (
          <section
            aria-label="구문 연습 없음"
            className="flex flex-col items-center gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-8 text-center shadow-[var(--sh-sm)]"
          >
            <p className="font-display text-[15px] font-[700] text-[var(--t1)]">
              오늘 준비된 구문 연습이 없어요
            </p>
            <p className="font-body text-[13px] leading-relaxed text-[var(--t2)]">
              구문 연습은 학습 단계가 무르익으면 열려요. 오늘은 읽기와 복습으로 흐름을 이어가 볼까요?
            </p>
            <Link
              href="/hub"
              className="inline-flex min-h-[44px] items-center rounded-[var(--r-md)] bg-[var(--p)] px-5 font-display text-[14px] font-[700] text-[var(--on-p)] no-underline shadow-[var(--sh-xs)] transition-all duration-[var(--dur-normal)] hover:bg-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
            >
              오늘로 돌아가기
            </Link>
          </section>
        )}
      </div>
    </Screen>
  )
}
