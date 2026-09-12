// apps/web/src/components/admin/MockDataBanner.tsx
//
// "이 화면의 숫자는 실측이 아니다" 를 **항상 보이게** 말하는 고지 배너.
//
// 왜 접히지 않는가:
//   2026-09-05 이전, 목업 화면들의 유일한 고지는 화면도움말(AdminScreenHelp) 안에 있었다.
//   그 패널은 기본이 접힘이라 누르지 않으면 한 글자도 보이지 않는다 — 즉 고지가 사실상 없었다.
//   그동안 /admin/users 는 "총 사용자 1,247" 을 그리고 있었고 실제 user_profiles 는 3 이었다.
//   415 배 어긋난 숫자를 운영 화면 첫 장에서 읽으면 "수요 검증이 끝났다" 는 반대 결론이 난다.
//   그래서 이 배너는 헤더 바로 아래, 접히지 않는 자리에 고정한다.
//
// 왜 role="status" 인가:
//   눈으로 읽는 사람에게만 경고가 가면 화면낭독기 사용자는 KPI 숫자를 실측으로 읽는다.
//   페이지 로드 시점에 이미 존재하는 정적 고지이므로 폴라이트 라이브 리전으로 충분하다.
//
// 색은 --warning 계열 토큰만 쓴다 — 하드코딩 hex 는 다크 테마에서 대비가 무너진다
// (globals.css 가 [data-theme="dark"] 에서 --warning / --warning-light / --warning-ink 를 다시 정의한다).
//
// 연동이 끝나면: 해당 화면에서 이 컴포넌트를 지우고, admin/__tests__/mock-data-banner.test.tsx 의
// MOCK_SCREENS 목록에서도 그 화면을 빼면 된다. 목록에 남아 있는 한 배너는 회귀 테스트가 지킨다.

import { AlertTriangle } from 'lucide-react'
import Link from 'next/link'

export interface MockDataBannerLink {
  label: string
  href: string
}

export interface MockDataBannerProps {
  /** 이 화면에서 실측이 아닌 것. 한 문장으로 — "무엇을" 만. */
  what: string
  /** 왜 실측이 아닌가. 근거(테이블 부재 · 미연동)를 검증 가능한 형태로. */
  why: string
  /** 대신 실제 수치를 볼 수 있는 화면. 빈 배열이면 링크 줄을 그리지 않는다. */
  instead?: MockDataBannerLink[]
  /** 연동 예정 여부. 모르면 넘기지 않는다 — 근거 없는 "곧 연동" 은 또 다른 거짓이다. */
  plan?: string
  className?: string
}

export function MockDataBanner({ what, why, instead = [], plan, className }: MockDataBannerProps) {
  return (
    <aside
      role="status"
      aria-label="실측 아님 안내"
      className={`flex items-start gap-3 rounded-[var(--r-md)] border border-[var(--warning)] bg-[var(--warning-light)] px-4 py-3 ${className ?? ''}`}
    >
      <AlertTriangle
        size={16}
        strokeWidth={2}
        aria-hidden
        className="mt-0.5 shrink-0 text-[var(--warning-ink)]"
      />
      <div className="min-w-0 font-body text-[13px] leading-[1.65] text-[var(--t1)]">
        <p>
          <b className="font-display font-[700]">이 화면의 수치는 실측이 아닙니다.</b> {what}
        </p>
        <p className="mt-1 text-[var(--t2)]">{why}</p>

        {instead.length > 0 && (
          <p className="mt-2">
            <span className="text-[var(--t2)]">실측은 여기서 봅니다 · </span>
            {instead.map((l, i) => (
              <span key={l.href}>
                {i > 0 && <span className="text-[var(--t2)]"> · </span>}
                <Link
                  href={l.href}
                  className="font-display font-[700] text-[var(--warning-ink)] underline decoration-[var(--warning)] underline-offset-2 transition-colors duration-[var(--dur-normal)] hover:text-[var(--t1)] hover:decoration-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--warning)]"
                >
                  {l.label}
                </Link>
              </span>
            ))}
          </p>
        )}

        {plan && <p className="mt-1 font-mono text-[11px] text-[var(--t2)]">{plan}</p>}
      </div>
    </aside>
  )
}
