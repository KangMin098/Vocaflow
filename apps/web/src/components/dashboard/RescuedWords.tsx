// apps/web/src/components/dashboard/RescuedWords.tsx
//
// 이번 주에 **다시 붙잡은 단어** — 회고 화면의 정서 축.
//
// 왜 이 카드가 필요한가:
//   /hub 재설계 때 확인한 결함이 회고 쪽에도 그대로 있었다 — **어휘 학습 플랫폼인데
//   화면에 단어가 한 개도 없었다.** 이전 /dashboard 에는 개수(0개·252개·117개)와
//   막대만 있었고, 학습자가 실제로 붙잡은 단어는 한 글자도 나오지 않았다.
//   개수는 노동을 말하고 단어는 결과를 말한다. 회고는 결과를 봐야 회고다.
//
// 왜 "되찾은" 인가 (추세선 대신):
//   회고 화면의 수치는 대부분 오르내린다. 오르면 기분 좋고 내리면 압박이다(철학 ③).
//   "이번 주에 다시 만나 맞힌 서로 다른 단어 수" 는 **한 번 벌면 사라지지 않는 값**이라
//   어떤 주에도 학습자를 탓하지 않는다. 0이면 숫자를 그리지 않고 문장으로 바꾼다.

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import type { RescuedWords as RescuedWordsData } from '@/lib/learner/growth-math'

export function RescuedWords({ rescued }: { rescued: RescuedWordsData }) {
  // ⚠️ 루트에 `min-w-0` 필수. 그리드 자식은 기본 `min-width:auto` 라 안쪽 긴 뜻풀이가
  // 칸을 밀어내고, 그 결과 **문서 전체가 가로로 넘친다**(390px 실측 20px).
  // 넘침은 카드 안이 아니라 페이지 바닥에서 드러나서 원인을 찾기 어렵다 —
  // 캡처 하네스의 `overflowCulprits` 가 이 두 카드를 지목해서야 알았다.
  return (
    <section
      aria-label="이번 주에 다시 만난 단어"
      // 캡처 하네스(91-hub-design-capture)의 균질성 계측에 참여한다 — 오른쪽
      // `ActivityTrace` 와 한 줄에 서는 형제라 높이가 갈리면 곧바로 보인다.
      data-design-card=""
      className="flex min-w-0 flex-col rounded-ios-2xl bg-[var(--bg)] px-5 py-5 shadow-ios-2 md:px-6"
    >
      <p className="font-mono text-[10px] font-[700] uppercase tracking-[0.18em] text-[var(--t3)]">
        이번 주에 다시 만난 단어
      </p>

      {rescued.count === 0 ? (
        <>
          <p className="mt-3 max-w-[34ch] font-editorial text-[19px] font-[500] leading-[1.35] tracking-[-0.01em] text-[var(--t1)] [word-break:keep-all]">
            이번 주엔 아직 다시 만난 단어가 없어요.
          </p>
          <p className="mt-2 font-body text-[13px] leading-[1.7] text-[var(--t2)] [word-break:keep-all]">
            한 번 만난 단어를 다시 만나는 순간부터 기억이 길어져요.
          </p>
          <Link
            href="/flashcard"
            className="group mt-4 inline-flex min-h-[44px] w-fit items-center gap-2 rounded-[var(--r-full)] bg-[var(--p-light)] px-4 font-display text-[13px] font-[700] text-[var(--on-p-tint)] no-underline transition-colors duration-[var(--dur-normal)] hover:bg-[var(--p)] hover:text-[var(--on-p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            복습 열기
            <ArrowRight
              size={13}
              aria-hidden
              className="motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5"
            />
          </Link>
        </>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-3">
            <span className="font-editorial text-[34px] font-[500] leading-none tabular-nums text-[var(--t1)]">
              {rescued.count.toLocaleString()}
            </span>
            <span className="font-body text-[13px] text-[var(--t2)]">개를 다시 만나 맞혔어요</span>
          </div>

          {/* 실물 단어 — 이 카드의 존재 이유. */}
          {rescued.sample.length > 0 && (
            <ul className="mt-4 flex flex-col divide-y divide-[var(--bd)] border-t border-[var(--bd)]">
              {rescued.sample.map((w) => (
                <li key={w.word} className="flex items-baseline gap-3 py-3">
                  <span className="font-editorial text-[17px] font-[500] text-[var(--t1)]">
                    {w.word}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-body text-[12px] text-[var(--t2)]">
                    {w.meaning}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {rescued.count > rescued.sample.length && (
            <Link
              href="/wordvault"
              className="group mt-3 inline-flex min-h-[44px] w-fit items-center gap-1 font-display text-[12px] font-[700] text-[var(--p)] no-underline transition-colors hover:text-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
            >
              단어장에서 모두 보기
              <ArrowRight
                size={12}
                aria-hidden
                className="motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5"
              />
            </Link>
          )}
        </>
      )}
    </section>
  )
}
