// apps/web/src/app/(main)/library/textbooks/[step]/page.tsx
//
// 교재 한 권의 **상세** — 서점에서 책을 집어 펼쳐 보는 자리.
//
// ── 왜 만들었나 ─────────────────────────────────────────────────────
// 서가의 "지금 펼치기" 가 **아무 데도 가지 않는 죽은 버튼**이었다(v06.337 실측).
// 보이는데 눌리지 않는 것은 이 저장소가 가장 나쁜 결함으로 못 박은 종류다(CONVENTIONS).
//
// ── 무엇을 보여주고 무엇을 보여주지 않는가 ──────────────────────────
// 보여준다: 대상 학령 · 수록 유형과 **유형별 실제 문항 수** · 각 유형이 시키는 것 ·
//           단원 규격(순서 2 + 삽입 2 · 3분/문항) · 만들 수 있는 **최대** 단원 수.
// 보여주지 않는다: **가짜 목차.** 실제 단원 조합은 길이 게이트(90~200어)와
//           "한 단원의 문항은 서로 다른 원글에서" 규칙을 더 걸기 때문에, 재고만으로
//           목차를 지어내면 실제보다 부풀려진다. 상한만 말하고 그것이 상한임을 밝힌다.

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, BookOpen } from 'lucide-react'

import { Screen } from '@/components/ui/ios'
import { fetchTextbookShelf } from '@/lib/textbook/shelf-query'
import { TYPE_GUIDE } from '@/lib/textbook/type-guide'

export const metadata = {
  title: '교재 · Vocaflow',
}

export default async function TextbookVolumePage({ params }: { params: { step: string } }) {
  const step = Number(params.step)
  if (!Number.isInteger(step)) notFound()

  const shelf = await fetchTextbookShelf()
  const v = shelf.volumes.find((x) => x.step === step)
  if (!v) notFound()

  const minutes = v.maxUnits * 4 * 3 // 단원당 4문항 × 3분(compose-unit.MINUTES_PER_ITEM)

  return (
    <Screen width="wide" background="bg2" padX="md">
      <div className="flex flex-col gap-4 py-6 md:py-8">
        <Link
          href="/library/textbooks"
          className="inline-flex min-h-[44px] w-fit items-center gap-1.5 font-display text-[13px] font-[700] text-[var(--p)] no-underline transition-colors hover:text-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        >
          <ArrowLeft size={14} aria-hidden />
          교재 서가
        </Link>

        <section
          aria-label="교재 표지"
          className="rounded-ios-2xl bg-[var(--bg)] px-5 py-6 shadow-ios-2 md:px-8 md:py-8"
        >
          <p className="font-mono text-[10px] font-[700] uppercase tracking-[0.18em] text-[var(--t3)]">
            {shelf.brand} · STEP {v.step}
          </p>
          <h1 className="mt-2 font-editorial text-[30px] font-[500] leading-[1.1] tracking-[-0.018em] text-[var(--t1)] md:text-[38px]">
            {v.title}
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 font-mono text-[11.5px] tabular-nums text-[var(--t3)]">
            <span>{v.schoolBand}</span>
            <span>· V{v.vLevels.join('·V')}</span>
            <span>· 수록 문항 {v.itemCount.toLocaleString()}</span>
          </p>

          <p className="mt-4 max-w-[58ch] font-body text-[14px] leading-[1.75] text-[var(--t2)] [word-break:keep-all]">
            {v.rationale.replace(/\*\*/g, '')}
          </p>
        </section>

        <section
          aria-label="수록 구성"
          className="rounded-ios-2xl bg-[var(--bg)] px-5 py-6 shadow-ios-2 md:px-8"
        >
          <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">수록 구성</h2>
          <ul className="mt-4 flex flex-col divide-y divide-[var(--bd)]">
            {v.types.map((t) => {
              const g = TYPE_GUIDE[t]
              const n = v.byType[t] ?? 0
              return (
                <li key={t} className="flex items-baseline gap-3 py-3">
                  <span className="min-w-[92px] shrink-0 font-display text-[13.5px] font-[700] text-[var(--t1)]">
                    {g?.label ?? t}
                  </span>
                  <span className="min-w-0 flex-1 font-body text-[12.5px] leading-[1.7] text-[var(--t2)] [word-break:keep-all]">
                    {g?.says ?? '—'}
                  </span>
                  <span className="shrink-0 font-mono text-[12px] font-[700] tabular-nums text-[var(--t1)]">
                    {n > 0 ? n.toLocaleString() : '준비 중'}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>

        <section
          aria-label="분량"
          className="rounded-ios-2xl bg-[var(--bg)] px-5 py-6 shadow-ios-2 md:px-8"
        >
          <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">분량</h2>
          <p className="mt-3 flex flex-wrap items-baseline gap-x-2.5">
            <span className="font-editorial text-[32px] font-[500] leading-none tabular-nums text-[var(--t1)]">
              최대 {v.maxUnits.toLocaleString()}
            </span>
            <span className="font-body text-[13px] text-[var(--t2)]">단원</span>
            {minutes > 0 && (
              <span className="ml-2 font-mono text-[11.5px] tabular-nums text-[var(--t3)]">
                약 {Math.round(minutes / 60)}시간
              </span>
            )}
          </p>
          {/* 상한을 예측처럼 보이게 두지 않는다 — 그 순간 과장 광고가 된다. */}
          <p className="mt-3 max-w-[58ch] font-body text-[12.5px] leading-[1.75] text-[var(--t2)] [word-break:keep-all]">
            한 단원은 <strong className="font-display text-[var(--t1)]">문항 4개(약 12분)</strong>로
            짭니다. 위 숫자는 <strong className="font-display text-[var(--t1)]">상한</strong>이에요 —
            실제로는 지문 길이(90~200어)와 “한 단원의 문항은 서로 다른 글에서” 규칙을 더 걸기 때문에
            이보다 적게 나옵니다.
          </p>
        </section>

        <section
          aria-label="학습 시작"
          className="rounded-ios-2xl bg-[var(--bg)] px-5 py-6 shadow-ios-2 md:px-8"
        >
          <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">어떻게 학습하나요</h2>
          <p className="mt-3 max-w-[58ch] font-body text-[13px] leading-[1.75] text-[var(--t2)] [word-break:keep-all]">
            이 권의 문항은 <strong className="font-display text-[var(--t1)]">오늘의 학습</strong>에
            섞여 나옵니다. 지금 수준에 맞는 단원부터 자동으로 배정돼요.
          </p>
          <Link
            href="/hub"
            className="group mt-4 inline-flex min-h-[48px] w-fit items-center gap-2 rounded-ios-pill bg-[var(--p)] px-5 font-display text-[14px] font-[700] text-[var(--on-p)] no-underline motion-safe:transition-all motion-safe:hover:brightness-110 motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
          >
            <BookOpen size={15} aria-hidden />
            오늘의 학습으로
          </Link>
        </section>
      </div>
    </Screen>
  )
}
