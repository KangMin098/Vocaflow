// apps/web/src/components/layout/StatusRibbon.tsx
//
// 상태 띠 — 셸 최상단의 **유일한** 상태 표면 (ADR 0006 D2).
//
// 이전에는 같은 값이 여러 곳에 있었다: streak 이 Sidebar·FlowNav·HubHero 세 곳,
// 기억 4색이 FlowNav·Growth 두 곳. 신규 학습자에게는 그 19개 지표 중 18개가 0이었다.
// 이 컴포넌트가 셋을 흡수하고 나머지 자리에서는 제거한다.
//
// 답하는 질문은 셋뿐이다:
//   오늘 끝나려면 얼마나 남았나 · 지금 조치할 것이 있나 · 며칠째인가
//
// 설계 규칙 (ADR 0006 D2):
//   ① 0 은 숫자가 아니라 문장이다 — 셋이 전부 0이면 숫자를 하나도 그리지 않는다
//   ② `stable`·`new` 는 싣지 않는다 (조치 불가 → Growth 소관)
//   ③ 진행은 링 하나. 게이지 바·퍼센트 금지 (철학 ④ Implicit Progress)
//   ④ streak 은 숫자만, 0이면 표시하지 않는다 (철학 ③ 압박 금지)
//   ⑤ 띠는 셸에 하나 — 페이지가 자기 상태 헤더를 또 그리지 않는다
//   ⑥ 수는 99에서 자른다(`99+`) — 규칙 ② 의 "조치 가능한 것만" 은 **자릿수에도** 걸린다.
//     2026-08-31 실측으로 이 띠가 `새 단어 1858` 을 그리고 있었다: 오늘 할 수 있는 일이
//     아니라 못 한 일의 총량이라, 보는 사람이 할 수 있는 것은 닫는 것뿐이었다.
//     자르는 것은 **표시뿐이다** — 목적지 목록과 `isEmpty` 는 실수를 그대로 쓴다
//     (`today-status.RIBBON_COUNT_CAP`).

'use client'

import { Flame } from 'lucide-react'
import Link from 'next/link'

import { MEMORY_ATTENTION_LABEL, MEMORY_LABEL } from '@/lib/framework/memory-labels'
import { usePathname } from 'next/navigation'

import { isFullScreenRoute } from '@/lib/layout/full-screen-routes'
import {
  formatRibbonCount,
  ribbonCountAria,
  type TodayStatus,
} from '@/lib/learner/today-status'

export interface StatusRibbonProps {
  /** 비로그인이면 null — 띠를 그리지 않는다 */
  status: TodayStatus | null
}

export function StatusRibbon({ status }: StatusRibbonProps) {
  const pathname = usePathname() ?? ''

  // 학습 세션은 셸을 걷어낸다 — 작업기억 보호(학습원칙 ⑥). Sidebar·MobileTabBar 와 같은 판정.
  if (isFullScreenRoute(pathname) || !status) return null

  return (
    <div
      aria-label="오늘 상태"
      className="flex items-center gap-x-7 gap-y-2 border-b border-[var(--bd)] bg-[var(--bg)] px-4 py-3 md:px-6"
    >
      {status.isEmpty ? <EmptyState /> : <Metrics status={status} />}
    </div>
  )
}

// ── 규칙 ① — 전부 0이면 숫자 대신 문장 하나 ──────────────────────
function EmptyState() {
  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-3">
      <p className="font-english text-[14px] italic leading-snug text-[var(--t2)]">
        아직 시작 전이에요 — 5분이면 오늘 할 일이 생겨요
      </p>
      <Link
        href="/diagnostic"
        className="inline-flex min-h-[44px] items-center rounded-[var(--r-full)] bg-[var(--p)] px-4 font-display text-[13px] font-[700] text-[var(--on-p)] transition-[filter,transform] duration-[var(--dur-normal)] ease-[var(--ease)] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 active:scale-[0.98]"
      >
        진단 시작
      </Link>
    </div>
  )
}

function Metrics({ status }: { status: TodayStatus }) {
  return (
    <>
      {status.total > 0 && (
        <div className="flex items-center gap-3">
          <ProgressRing done={status.done} total={status.total} />
          <div className="flex flex-col leading-none">
            <span className="font-mono text-[10px] font-[700] uppercase tracking-[0.14em] text-[var(--t2)]">
              오늘
            </span>
            <span className="mt-1 font-display text-[15px] font-[700] tabular-nums text-[var(--t1)]">
              {status.done}
              <span className="font-[500] text-[var(--t2)]">/{status.total}</span>
            </span>
          </div>
        </div>
      )}

      {/*
        규칙 ② — 조치 가능한 것만. 0이면 칸 자체가 없다.

        **목적지는 허브가 아니라 걸러진 목록이다** (2026-08-29). 이전에는 두 칩 모두
        `/wordvault` 였다. 허브는 이 수를 다시 세어 4버킷으로 보여 주고, 거기서 다시
        CTA 를 눌러야 목록에 닿았다 — 세어 준 것을 두 번 더 눌러야 만나는 구조였다.
        칩이 "11" 이라고 말했으면 누른 자리에 11개가 있어야 한다.
      */}
      {status.attention > 0 && (
        <Link
          href="/wordvault/browse?filter=state:attention"
          aria-label={`${MEMORY_ATTENTION_LABEL} 단어 ${ribbonCountAria(status.attention)} 보기`}
          className="flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] px-2 transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        >
          {/* 색만으로 알리지 않는다 — 점 + 라벨 + 숫자 3중 (색맹 대응) */}
          <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-[var(--warning)]" />
          <span className="flex flex-col leading-none">
            <span className="font-mono text-[10px] font-[700] uppercase tracking-[0.14em] text-[var(--t2)]">
              {MEMORY_ATTENTION_LABEL}
            </span>
            <span className="mt-1 font-display text-[15px] font-[700] tabular-nums text-[var(--t1)]">
              {formatRibbonCount(status.attention)}
            </span>
          </span>
        </Link>
      )}

      {/*
        **아직 한 번도 만나지 않은 낱말** — 기억 4상태의 `new`.

        예전에는 이 칸이 없었다. `new` 를 "조치 불가" 로 보았기 때문인데,
        학습자가 스스로 뽑아 담던 시절엔 맞는 판단이었다(담은 사람은 이미 본 사람이다).
        **교사가 보낸 낱말이 생기면서 그 전제가 깨졌다** — 학생은 그 낱말을 본 적이 없고,
        그것이 가장 먼저 할 일이다. 2026-08-27 실측: 학생이 선생님이 보낸 3낱말을 담은
        직후에도 띠는 "아직 시작 전이에요" 였다.

        `attention` 과 색·라벨을 다르게 둔다 — "복습이 급하다" 와 "아직 안 배웠다" 는
        다른 일이고, 같아 보이면 학습자가 우선순위를 잘못 잡는다.
      */}
      {status.fresh > 0 && (
        <Link
          href="/wordvault/browse?filter=state:new"
          aria-label={`아직 안 배운 단어 ${ribbonCountAria(status.fresh)} 보기`}
          className="flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] px-2 transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        >
          {/* 색만으로 알리지 않는다 — 점 + 라벨 + 숫자 3중 (색맹 대응) */}
          <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-[var(--memory-new)]" />
          <span className="flex flex-col leading-none">
            {/*
              라벨을 여기서 짓지 않는다 — `memory-labels` 가 소유한다.
              2026-08-27 에 이 칸이 생길 때 `새 단어` 를 JSX 텍스트로 적었고,
              그것을 잡으라고 만들어 둔 회귀(`memory-labels.test.ts` "JSX 텍스트로 적은
              상태 라벨도 잡는다")가 그날부터 빨간불이었다 — 그 세션이 연결 끊김으로
              끝나 아무도 보지 않았다.
            */}
            <span className="font-mono text-[10px] font-[700] uppercase tracking-[0.14em] text-[var(--t2)]">
              {MEMORY_LABEL.new.label}
            </span>
            <span className="mt-1 font-display text-[15px] font-[700] tabular-nums text-[var(--t1)]">
              {formatRibbonCount(status.fresh)}
            </span>
          </span>
        </Link>
      )}

      {/* 규칙 ④ — 0이면 표시하지 않는다 */}
      {status.streak > 0 && (
        <div className="flex items-center gap-2" aria-label={`연속 ${status.streak}일`}>
          <Flame size={12} strokeWidth={2} className="text-[var(--active)]" aria-hidden />
          <span className="font-display text-[13px] font-[700] tabular-nums text-[var(--t1)]">
            {status.streak}
          </span>
        </div>
      )}
    </>
  )
}

// ── 규칙 ③ — 링 하나. 퍼센트 텍스트도 게이지 바도 없다 ────────────
function ProgressRing({ done, total }: { done: number; total: number }) {
  const ratio = total > 0 ? Math.min(1, Math.max(0, done / total)) : 0
  return (
    <span
      aria-hidden
      className="relative inline-block h-[22px] w-[22px] shrink-0 rounded-full"
      style={{
        background: `conic-gradient(var(--p) 0turn ${ratio}turn, var(--bg3) ${ratio}turn 1turn)`,
      }}
    >
      <span className="absolute inset-[4px] rounded-full bg-[var(--bg)]" />
    </span>
  )
}
