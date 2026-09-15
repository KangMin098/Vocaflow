'use client'

// apps/web/src/components/csat/CsatSteps.tsx
//
// **분석 7단계 레일 — 순서를 보여 주되 강제하지 않는다.**
//
// ── 왜 이 줄이 필요한가 ──────────────────────────────────────────────
// `/csat` 밑 화면들은 저마다 쓸모가 있었지만 **서로의 존재를 몰랐다.** 문항 해부에 들어간
// 학습자는 그다음에 무엇을 하는 것이 자연스러운지 알 길이 없었고, 뒤로 가기 말고는 나갈
// 문이 없었다. 방법론은 이미 7단계로 서 있으므로, 그 순서를 **화면 위에 그대로 깐다.**
//
// ⚠️ **순서를 강제하지 않는다.** 모든 열린 칸은 언제나 눌린다. 수험생은 매번 1단계부터
//   시작하지 않는다 — 오늘 할 일만 하러 온다(`steps.ts` 머리말).
//
// ⚠️ **안 지은 칸을 「준비 중」 링크로 만들지 않는다**(브리프 A4). ⑥⑦ 은 링크가 아니라
//   `<span>` 이고, 그 사실을 스크린리더에도 말한다. 눌러서 빈 화면에 닿는 것이
//   "아직 없다" 를 읽는 것보다 나쁘다.
//
// ⚠️ **색만으로 현재 위치를 말하지 않는다** — 현재 칸은 색 + 굵기 + `aria-current` 셋이다.

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { CSAT_STEPS, stepFor, type CsatStep } from '@/lib/csat/steps'

/** 칸 하나. 열린 칸은 링크, 아직인 칸은 글자. */
function Step({ step, current }: { step: CsatStep; current: boolean }) {
  const body = (
    <>
      <span
        aria-hidden
        className="tabular-nums text-[10px] font-[700] leading-none text-[var(--t3)]"
      >
        {step.no}
      </span>
      <span className="text-[12px] leading-none">{step.label}</span>
    </>
  )

  // 아직 안 지은 칸 — 누를 수 없고, 왜 누를 수 없는지 읽어 준다.
  if (step.state === 'later' || !step.href) {
    return (
      <li>
        <span
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-[var(--r-full)] border border-dashed border-[var(--bd)] px-2.5 py-1.5 text-[var(--t3)]"
          title={`${step.label} — 아직 열리지 않았어요. ${step.says}`}
        >
          {body}
          <span className="sr-only">(아직 열리지 않음)</span>
        </span>
      </li>
    )
  }

  return (
    <li>
      <Link
        href={step.href}
        aria-current={current ? 'step' : undefined}
        title={`${step.verb} — ${step.says}`}
        className={[
          'inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-[var(--r-full)] border px-2.5',
          'transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] motion-reduce:transition-none',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]',
          current
            ? 'border-[var(--p)] bg-[var(--p)] font-[700] text-[var(--bg)]'
            : 'border-[var(--bd)] bg-[var(--sf)] text-[var(--t2)] hover:border-[var(--p)] hover:bg-[var(--sf-2)] hover:text-[var(--t1)] active:bg-[var(--bd)]',
        ].join(' ')}
      >
        {body}
      </Link>
    </li>
  )
}

export function CsatSteps() {
  const pathname = usePathname() ?? ''
  const here = stepFor(pathname)

  return (
    // 칸 수를 라벨에 박지 않는다 — 단계가 늘거나 줄면 스크린리더만 옛 수를 읽는다
    // (실제로 7 → 6 이 됐다. 2026-09-16).
    <nav aria-label="기출 분석 단계">
      {/* ⚠️ **가로 스크롤 레일을 쓰지 않는다.** 처음엔 `-mx-4 overflow-x-auto` + `w-max` 로
          한 줄에 밀어 넣었는데, 375px 에서 문서가 **422px 로 벌어졌다**(실측 2026-09-15 —
          `document.scrollWidth` 422 vs client 375, 브리프 G7 위반). 더 중요한 것은
          가로 스크롤 레일이 **칸을 숨긴다**는 점이다 — 순서를 보여 주려고 만든 줄인데
          ⑥⑦ 이 화면 밖에 있으면 순서가 안 보인다. 줄바꿈이 옳다. */}
      <ol className="flex flex-wrap items-center gap-1.5">
        {CSAT_STEPS.map((s) => (
          <Step key={s.no} step={s} current={here?.no === s.no} />
        ))}
      </ol>
    </nav>
  )
}
