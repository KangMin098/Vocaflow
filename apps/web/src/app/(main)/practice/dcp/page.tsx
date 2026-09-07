// apps/web/src/app/(main)/practice/dcp/page.tsx
//
// CTP DCP(구문 연습) 플레이 화면 — 오늘 처방 practice 문항(order/insert/선택지)의 세션.
// 흐름: 문항 → grade_dcp_item 서버 채점 → 피드백 → 오답 시 error_cause → 요약.
//
// ⚠️ **진입점이 둘이다** — hub 「오늘」 처방 ④ 연습 블록과 `/practice`(연습 단일 진입면,
//    라우트 계층상 이 화면의 부모). 예전에는 복귀 링크 세 곳이 전부 `/hub` 하드코딩이라
//    `/practice` 에서 들어온 학습자는 **온 곳으로 돌아갈 수단이 화면에 하나도 없었다**.
//    이제 `?from=` 을 `resolveSessionReturnHref` 로 읽는다(오픈 리다이렉트는 그 안에서 차단).

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { DcpPlayer } from '@/components/practice/DcpPlayer'
import { Screen } from '@/components/ui/ios'
import { fetchDcpPracticeItems } from '@/lib/learner/dcp-actions'
import { resolveSessionReturnHref } from '@/lib/layout/session-return'

export const metadata = {
  title: '구문 연습',
  description: '문장의 순서와 위치로 글의 논리 구조를 훈련해요',
}

/** 복귀 링크에 붙는 이름 — 어디로 가는지 말하지 않는 화살표는 되돌아갈 곳을 숨긴다. */
const BACK_LABEL: Record<string, string> = {
  '/practice': '연습',
  '/hub': '오늘',
}

export default async function DcpPracticePage({
  searchParams,
}: {
  searchParams?: { from?: string }
}) {
  const { active, items, doneToday } = await fetchDcpPracticeItems()
  const backHref = resolveSessionReturnHref(searchParams?.from, null, '/hub')
  const backLabel = BACK_LABEL[backHref.split('?')[0] ?? ''] ?? null
  const backCta = backLabel ? backLabel + '로 돌아가기' : '돌아가기'

  return (
    <Screen width="compact" background="bg2" padX="md">
      <div className="flex flex-col gap-4 py-6 md:py-8">
        <header className="flex flex-col gap-1">
          <Link
            href={backHref}
            /* 41×18 이었다 — 44px 미만 탭 대상이었다(CLAUDE.md 절대 금지 · 실측 390px). 세션에서 나가는 유일한 링크다. */
            className="inline-flex min-h-[44px] w-fit min-w-[44px] items-center gap-1 font-display text-[12px] font-[700] text-[var(--t2)] no-underline transition-colors duration-[var(--dur-normal)] hover:text-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            <ArrowLeft size={13} strokeWidth={2} aria-hidden />
            {backLabel ?? '돌아가기'}
          </Link>
          <h1 className="font-display text-[20px] font-[800] text-[var(--t1)]">구문 연습</h1>
          <p className="break-keep font-body text-[13px] text-[var(--t2)]">
            문장의 순서와 위치로 글의 논리 구조를 훈련해요.
          </p>
        </header>

        {active && items.length > 0 ? (
          <DcpPlayer items={items} backHref={backHref} backCta={backCta} />
        ) : (
          /* ⚠️ **다 푼 날과 아직 안 열린 날을 갈라 말한다.** 하나로 뭉개던 동안 오늘 몫을
             방금 마친 학습자에게 "학습 단계가 무르익으면 열려요"(잠김 안내)라고 말했다. */
          <section
            aria-label={doneToday ? '오늘 구문 연습 완료' : '구문 연습 없음'}
            className="flex flex-col items-center gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-8 text-center shadow-[var(--sh-sm)]"
          >
            <p className="break-keep font-display text-[15px] font-[700] text-[var(--t1)]">
              {doneToday ? '오늘 구문 연습은 다 했어요' : '오늘 준비된 구문 연습이 없어요'}
            </p>
            <p className="break-keep font-body text-[13px] leading-relaxed text-[var(--t2)]">
              {doneToday
                ? '내일 새 문항으로 다시 만나요. 오늘은 읽기와 복습으로 흐름을 이어가 볼까요?'
                : '구문 연습은 학습 단계가 무르익으면 열려요. 오늘은 읽기와 복습으로 흐름을 이어가 볼까요?'}
            </p>
            <Link
              href={backHref}
              className="inline-flex min-h-[44px] items-center rounded-[var(--r-md)] bg-[var(--p)] px-5 font-display text-[14px] font-[700] text-[var(--on-p)] no-underline shadow-[var(--sh-xs)] transition-all duration-[var(--dur-normal)] hover:bg-[var(--p-hover)] active:bg-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
            >
              {backCta}
            </Link>
          </section>
        )}
      </div>
    </Screen>
  )
}
