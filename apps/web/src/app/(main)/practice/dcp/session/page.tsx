// apps/web/src/app/(main)/practice/dcp/session/page.tsx
//
// CTP DCP(구문 연습) **세션** — 문항을 푸는 동안의 화면(2026-10-19 · learner-tines-audit S4).
// 전체화면 세션 틀(SessionFrame — 오른쪽 위 「세션 닫기」 · Esc · `?from=` 복귀)이 감싼다.
// 흐름·채점·기록은 예전 `/practice/dcp` 와 같은 `DcpPlayer` 그대로다:
//   문항 → grade_dcp_item 서버 채점 → 피드백 → 오답 시 error_cause → 요약.
// 풀 문항이 없으면(직접 들어왔거나 그 사이 다 풀었으면) 안내 화면 `/practice/dcp` 로 돌려보낸다(from 유지).

import { redirect } from 'next/navigation'

import { DcpPlayer } from '@/components/practice/DcpPlayer'
import { Screen } from '@/components/ui/ios'
import { fetchDcpPracticeItems } from '@/lib/learner/dcp-actions'
import { resolveSessionReturnHref } from '@/lib/layout/session-return'

// 탭 제목은 안내 화면(구문 연습)과 달라야 한다 — 탭 여럿을 열어 둔 학습자가 구분한다(page-titles.test)
export const metadata = {
  title: '구문 연습 세션',
  description: '문장의 순서와 위치로 글의 논리 구조를 훈련해요',
}

/** 요약 화면의 복귀 단추 이름 — 안내 화면(`/practice/dcp`)과 같은 규칙 */
const BACK_LABEL: Record<string, string> = {
  '/practice': '연습',
  '/hub': '오늘',
}

export default async function DcpPracticeSessionPage({
  searchParams,
}: {
  searchParams?: { from?: string }
}) {
  const { active, items } = await fetchDcpPracticeItems()
  const from = searchParams?.from
  if (!active || items.length === 0) {
    redirect(from ? `/practice/dcp?from=${encodeURIComponent(from)}` : '/practice/dcp')
  }
  const backHref = resolveSessionReturnHref(from, null, '/hub')
  const backLabel = BACK_LABEL[backHref.split('?')[0] ?? ''] ?? null
  const backCta = backLabel ? backLabel + '로 돌아가기' : '돌아가기'

  return (
    <Screen width="compact" background="bg2" padX="md">
      <div className="flex flex-col gap-4 py-6 md:py-8">
        {/* 나가기는 세션 틀이 맡는다 — 화면 안에는 이름과 한 줄만 둔다 */}
        <header className="flex flex-col gap-1">
          <h1 className="font-editorial text-[20px] font-[800] text-[var(--t1)]">구문 연습</h1>
          <p className="break-keep font-body text-[13px] text-[var(--t2)]">
            문장의 순서와 위치로 글의 논리 구조를 훈련해요.
          </p>
        </header>
        <DcpPlayer items={items} backHref={backHref} backCta={backCta} />
      </div>
    </Screen>
  )
}
