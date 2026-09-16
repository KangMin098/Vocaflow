// apps/web/src/components/csat/ModePicker.tsx
//
// **「오늘 뭘 하러 왔나」 — 허브의 다음 문.**
//
// ── 왜 모드인가 ──────────────────────────────────────────────────────
// 허브에는 이미 증명(`TrapAtlas`)이 있다. 그다음에 필요한 것은 설명이 아니라 **문**이다.
// 수험생이 기출 화면을 여는 이유는 대개 넷 중 하나다 — 지형을 보러, 한 문제를 뜯으러,
// 범위를 좁히러, 묶으러. 그 넷을 그대로 네 칸으로 둔다.
//
// ⚠️ **카드 넷을 똑같이 만들지 않는다**(외부 스킬 공통 금지 — 동일 3카드 배치).
//   각 칸은 자기 단계 번호와 **동사**를 든다. 번호가 곧 방법론 순서라 카드가 순서를 말한다.
//
// ⚠️ 서버 컴포넌트다 — 상태가 없다. 고르는 순간 그냥 그 화면으로 간다(모달·확장 없음).
//   서버 HTML 에 네 링크가 그대로 남아 크롤러가 읽는다(I6).

import Link from 'next/link'

import { CSAT_STEPS } from '@/lib/csat/steps'

/**
 * 허브에 세울 네 모드 — **① 다음의 네 문**이다.
 *
 * ⚠️ ① 은 넣지 않는다. 이 컴포넌트가 사는 곳이 곧 `/csat`(① 지도)이라 자기 자신으로 가는
 *   카드가 된다. 처음엔 `[1,2,3,4]` 로 두었다가 그 자기 링크를 만들 뻔했다.
 * ⚠️ 번호가 아니라 **`href` 유무**로 한 번 더 거른다(아래 필터). 막힌 칸이 생겨도
 *   이 컴포넌트가 죽은 카드를 그리지 않는다 — 지금은 막힌 칸이 없다.
 */
const MODE_STEPS = [2, 3, 4, 5] as const  // 지형 · 사정권 · 겨루기 · 주파

export function ModePicker() {
  const modes = MODE_STEPS.map((no) => CSAT_STEPS.find((s) => s.no === no)).filter(
    (s): s is NonNullable<typeof s> => Boolean(s && s.href),
  )

  return (
    <section aria-labelledby="csat-mode-h" className="mt-8">
      <h2 id="csat-mode-h" className="text-base text-[var(--t1)]">
        오늘 뭘 하러 오셨어요?
      </h2>
      <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {modes.map((m) => (
          <li key={m.no}>
            <Link
              href={m.href as string}
              className="group flex h-full min-h-[44px] items-start gap-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-3 transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:border-[var(--p)] hover:bg-[var(--bg3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:bg-[var(--bd)] motion-reduce:transition-none"
            >
              <span
                aria-hidden
                className="mt-0.5 shrink-0 tabular-nums text-[11px] font-[800] text-[var(--t3)]"
              >
                {m.no}
              </span>
              <span className="min-w-0">
                <span className="block font-editorial text-[15px] font-[600] text-[var(--t1)]">
                  {m.label}
                  {/* 동사가 곧 이 화면에서 하는 일이다. 라벨만 두면 또 목록이 된다. */}
                  <span className="ml-1.5 font-body text-xs font-normal text-[var(--t3)]">
                    {m.verb}
                  </span>
                </span>
                <span className="mt-0.5 block break-keep text-[12.5px] leading-snug text-[var(--t2)]">
                  {m.says}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
