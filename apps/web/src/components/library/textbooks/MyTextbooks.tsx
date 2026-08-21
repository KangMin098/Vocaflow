// apps/web/src/components/library/textbooks/MyTextbooks.tsx
//
// **내 교재** — My Library 의 교재 면.
//
// 서가(`/library/textbooks`)가 고르는 곳이라면 여기는 **고른 것을 관리하는 곳**이다.
// 서점과 책장의 관계와 같다.
//
// ⚠️ 세 상태를 반드시 구별한다:
//   · 저장소를 못 읽음(`available: false`) → "확인 중". 고른 것이 없다고 말하면 거짓이다.
//   · 고른 것이 없음                        → 서가로 보낸다
//   · 고른 것이 있음                        → 권을 관리한다
// 앞의 둘을 한 문장으로 뭉개는 것이 이 저장소의 지배적 결함 유형이다(CONVENTIONS).

import { ArrowRight, BookOpen, Library, Plus } from 'lucide-react'
import Link from 'next/link'

import type { Shelf } from '@/lib/textbook/shelf'
import type { MySelection } from '@/lib/textbook/my-shelf-query'
import { TYPE_GUIDE } from '@/lib/textbook/type-guide'

export function MyTextbooks({ shelf, mine }: { shelf: Shelf; mine: MySelection }) {
  // ① 못 읽음 — 0 과 구별한다.
  if (!mine.available) {
    return (
      <Section>
        <p role="status" className="font-body text-[13px] leading-[1.75] text-[var(--t2)] [word-break:keep-all]">
          담은 교재를 <strong className="font-display text-[var(--t1)]">확인하지 못했어요</strong> —
          없다는 뜻이 아닙니다. 잠시 뒤 다시 열어 보세요.
        </p>
      </Section>
    )
  }

  const picked = shelf.volumes.filter((v) => mine.steps.includes(v.step))

  // ② 고른 것이 없음 — 서가로 보낸다.
  if (picked.length === 0) {
    return (
      <Section>
        <p className="max-w-[46ch] font-editorial text-[19px] font-[500] leading-[1.35] text-[var(--t1)] [word-break:keep-all]">
          아직 담은 교재가 없어요.
        </p>
        <p className="mt-2 max-w-[52ch] font-body text-[12.5px] leading-[1.75] text-[var(--t2)] [word-break:keep-all]">
          학년을 잇는 일곱 권 중 지금 수준에 맞는 것을 고르면 여기에 쌓여요.
        </p>
        <Link
          href="/library/textbooks"
          className="group mt-4 inline-flex min-h-[44px] w-fit items-center gap-1.5 rounded-[var(--r-full)] bg-[var(--p-light)] px-4 font-display text-[12.5px] font-[700] text-[var(--on-p-tint)] no-underline transition-colors hover:bg-[var(--p)] hover:text-[var(--on-p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        >
          <Library size={14} aria-hidden />
          교재 서가 둘러보기
          <ArrowRight size={13} aria-hidden className="motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5" />
        </Link>
      </Section>
    )
  }

  // ③ 관리 — 담은 권을 계단 순서로.
  //
  // ⚠️ 여기서 **진도를 그리지 않는다.** 교재 문항은 오늘의 학습에 섞여 나오므로 "이 권의 몇 %"
  //    라는 수치가 존재하지 않는다. 없는 진도 막대를 그리면 그 화면은 그 순간 거짓말이 된다.
  //    대신 실제로 아는 것만 말한다 — 합계와 **다음 계단**.
  const totalItems = picked.reduce((s, v) => s + v.itemCount, 0)
  const totalUnits = picked.reduce((s, v) => s + v.maxUnits, 0)

  // 다음 계단 = 담은 것 중 가장 높은 권 **바로 다음**의, 아직 안 담은 권.
  // 시리즈의 존재 이유가 "학년을 잇는" 것이므로, 이 한 줄이 이 면의 다음 행동이다.
  const highest = picked[picked.length - 1]!.step
  const nextUp = shelf.volumes.find((v) => v.step > highest && !mine.steps.includes(v.step))

  return (
    <Section>
      {/* 합계 — 상한임을 반드시 밝힌다(권 상세와 같은 규칙). 상한을 예측처럼 보이면 과장 광고다. */}
      <p className="flex flex-wrap items-baseline gap-x-2.5 font-mono text-[11px] tabular-nums text-[var(--t3)]">
        <span>{picked.length}권</span>
        <span>· 문항 {totalItems.toLocaleString()}</span>
        <span>· 최대 {totalUnits.toLocaleString()}단원</span>
      </p>

      <ol className="mt-1 flex flex-col divide-y divide-[var(--bd)]">
        {picked.map((v) => (
          <li key={v.step} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3.5">
            <span
              aria-hidden
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--r-sm)] bg-[var(--p)] font-display text-[12px] font-[800] tabular-nums text-[var(--on-p)]"
            >
              {v.step}
            </span>
            <span className="min-w-0 flex-1">
              <Link
                href={`/library/textbooks/${v.step}`}
                className="font-editorial text-[17px] font-[500] text-[var(--t1)] no-underline hover:text-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
              >
                {v.title}
              </Link>
              <span className="mt-0.5 block font-mono text-[10.5px] tabular-nums text-[var(--t3)]">
                {v.schoolBand} · 문항 {v.itemCount.toLocaleString()} · 최대 {v.maxUnits}단원
              </span>
            </span>
            <span className="flex flex-wrap gap-1">
              {v.types.slice(0, 3).map((t) => (
                <span
                  key={t}
                  className="rounded-[var(--r-full)] bg-[var(--bg2)] px-2 py-0.5 font-display text-[10.5px] font-[700] text-[var(--t2)]"
                >
                  {TYPE_GUIDE[t]?.label ?? t}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ol>

      {/* 다음 계단 — 시리즈의 존재 이유가 "학년을 잇는" 것이라 이 자리가 이 면의 다음 행동이다.
          없으면(마지막 권까지 담았으면) 내지 않는다. 빈 제안을 파는 것보다 아무 말도 안 하는 게 낫다. */}
      {nextUp && (
        <Link
          href={`/library/textbooks/${nextUp.step}`}
          className="group mt-4 flex items-center gap-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-4 py-3 no-underline transition-colors hover:border-[var(--p)] hover:bg-[var(--bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        >
          <span
            aria-hidden
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--r-sm)] bg-[var(--p-light)] text-[var(--on-p-tint)]"
          >
            <Plus size={15} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-[12.5px] font-[700] text-[var(--t1)]">
              다음 계단
            </span>
            {/* 제목과 학령을 조사 없이 잇는다 — 영문 권명에 한국어 조사를 붙일 수 없다. */}
            <span className="mt-0.5 block font-body text-[12px] leading-[1.6] text-[var(--t2)] [word-break:keep-all]">
              STEP {nextUp.step} · {nextUp.title} · {nextUp.schoolBand}
            </span>
          </span>
          <ArrowRight
            size={15}
            aria-hidden
            className="shrink-0 text-[var(--t3)] motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5"
          />
        </Link>
      )}

      <Link
        href="/library/textbooks"
        className="group mt-3 inline-flex min-h-[44px] w-fit items-center gap-1 font-display text-[12px] font-[700] text-[var(--p)] no-underline transition-colors hover:text-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
      >
        <BookOpen size={13} aria-hidden />
        교재 더 고르기
        <ArrowRight size={12} aria-hidden className="motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5" />
      </Link>
    </Section>
  )
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <section
      aria-label="내 교재"
      className="rounded-ios-2xl bg-[var(--bg)] px-5 py-5 shadow-ios-2 md:px-8"
    >
      <p className="font-mono text-[10px] font-[700] uppercase tracking-[0.18em] text-[var(--t3)]">
        내 교재
      </p>
      <div className="mt-3">{children}</div>
    </section>
  )
}
