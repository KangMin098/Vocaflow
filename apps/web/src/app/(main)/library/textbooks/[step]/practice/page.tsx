// apps/web/src/app/(main)/library/textbooks/[step]/practice/page.tsx
//
// 교재 한 권의 **문항을 실제로 푸는 자리.**
//
// ── 왜 만들었나 ─────────────────────────────────────────────────────
// 평가 요소 15개 중 열위 하나가 "실사용 난이도·변별도" 인데, 이것만은 **콘텐츠로 못 고친다** —
// 학습자가 풀어야 P(정답률)·D(변별도)가 나온다. 그런데 `csat_item_attempts` 는 0행이었다.
// 이유는 단순했다: 교재 서가가 재고를 보여 주고 `/hub` 로 돌려보낼 뿐 **풀 자리가 없었다.**
//
// ── 왜 오늘 처방(`/practice/dcp`)을 쓰지 않나 ───────────────────────
// 그쪽은 `prescribe_today` 를 읽어 **S3 이상에서만** 열린다. 교재는 학령 사다리를 따라
// 아무 계단이나 펼칠 수 있어야 하므로 경로가 다르다. 채점은 같은 `grade_dcp_item` 을 쓴다 —
// 정답 판정을 두 곳에 두지 않는다.
//
// ⚠️ **화면이 그릴 수 있는 유형만 나온다**(순서·삽입). 생성형 9유형(요지·주제·빈칸 …)은
//   `DcpPlayer` 가 아직 못 그리므로 RPC 가 아예 빼고 준다. 섞으면 빈 화면이 되는데,
//   그건 이 저장소가 이미 한 번 겪은 사고다(처방에 교재용 유형이 섞여 42.5% 가 샜다).

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { SERIES_SPINE } from '@vocaflow/library-pipeline'

import { DcpPlayer } from '@/components/practice/DcpPlayer'
import { Screen } from '@/components/ui/ios'
import { fetchTextbookPracticeItems } from '@/lib/learner/dcp-actions'

/** 한 번에 내주는 문항 수. 한 단원이 4문항이라 두 단원 분량으로 잡는다. */
const ITEM_LIMIT = 8

function rungOf(step: number) {
  return SERIES_SPINE.find((r) => r.step === step) ?? null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ step: string }>
}): Promise<Metadata> {
  const { step } = await params
  const rung = rungOf(Number(step))
  // 권마다 다른 제목을 준다 — 같은 제목이 여럿이면 탭·북마크·공유 카드에서 구별되지 않는다.
  return rung
    ? { title: `${rung.volumeTitle} 연습 · Vocaflow`, description: `${rung.schoolBand} 계단의 순서·삽입 문항을 풀어요` }
    : { title: '교재 연습 · Vocaflow' }
}

export default async function TextbookPracticePage({
  params,
}: {
  params: Promise<{ step: string }>
}) {
  const { step: raw } = await params
  const step = Number(raw)
  const rung = rungOf(step)
  if (!rung) notFound()

  // 한 계단이 여러 V-Level 을 덮을 수 있다 — 첫 밴드를 쓴다(권의 대표 난이도).
  const vLevel = rung.vLevels[0]
  const { items, unavailable } = await fetchTextbookPracticeItems(vLevel ?? 0, ITEM_LIMIT)

  return (
    <Screen width="compact" background="bg2" padX="md">
      <div className="flex flex-col gap-4 py-6 md:py-8">
        <header className="flex flex-col gap-1">
          <Link
            href={`/library/textbooks/${step}`}
            className="inline-flex w-fit items-center gap-1 font-display text-[12px] font-[700] text-[var(--t2)] no-underline transition-colors hover:text-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            <ArrowLeft size={13} strokeWidth={2} aria-hidden />
            {rung.volumeTitle}
          </Link>
          <h1 className="font-display text-[20px] font-[800] text-[var(--t1)]">연습</h1>
          <p className="font-body text-[13px] text-[var(--t2)]">
            {rung.schoolBand} 계단의 순서·삽입 문항이에요. 푼 기록은 다음 문항을 고르는 데 쓰여요.
          </p>
        </header>

        {items.length > 0 ? (
          <DcpPlayer items={items} />
        ) : (
          <section
            aria-label={unavailable ? '문항을 불러오지 못함' : '연습 문항 없음'}
            className="flex flex-col items-center gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-8 text-center shadow-[var(--sh-sm)]"
          >
            {/* ⚠️ **"못 불러왔다" 와 "없다" 를 한 문장으로 뭉개지 않는다.** 조회 실패를 빈 상태로
                덮으면 학습자는 "아직 문항이 없나 보다" 로 읽는다 — 이 저장소의 지배적 결함 유형이다. */}
            <p className="font-display text-[15px] font-[700] text-[var(--t1)]">
              {unavailable ? '문항을 불러오지 못했어요' : '이 계단에는 아직 연습 문항이 없어요'}
            </p>
            <p className="font-body text-[13px] leading-relaxed text-[var(--t2)]">
              {unavailable
                ? '로그인이 필요하거나 잠시 문제가 있었어요. 잠시 뒤 다시 열어 볼까요?'
                : '이 계단은 아직 순서·삽입 문항이 준비되지 않았어요. 다른 계단을 펼쳐 볼까요?'}
            </p>
            <Link
              href="/library/textbooks"
              className="inline-flex min-h-[44px] items-center rounded-[var(--r-md)] bg-[var(--p)] px-5 font-display text-[14px] font-[700] text-[var(--on-p)] no-underline shadow-[var(--sh-xs)] transition-all duration-[var(--dur-normal)] hover:bg-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
            >
              교재 서가로
            </Link>
          </section>
        )}
      </div>
    </Screen>
  )
}
