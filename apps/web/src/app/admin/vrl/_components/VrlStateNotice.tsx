// apps/web/src/app/admin/vrl/_components/VrlStateNotice.tsx
//
// VRL 화면 공통 — "아직 없음" 과 "못 읽음" 을 **다르게** 그린다.
//
// 두 상태는 아이콘·색·문구·다음 걸음이 전부 다르다:
//   empty      → 점선 테두리 · 중립색 · "다음에 할 일" 링크 (막다른 화면을 만들지 않는다)
//   unreadable → 실선 경고 테두리 · role="alert" · 실패 원인 원문 + 확인 경로
//
// 색만으로 구분하지 않는다(아이콘 + 문구 + role). 링크는 44px 터치 타깃.

import Link from 'next/link'
import { AlertTriangle, ArrowRight, Inbox, type LucideIcon } from 'lucide-react'

export interface VrlNextStep {
  href: string
  label: string
}

/** 조회 실패 — 데이터가 없는 것이 아니라 못 읽은 것. */
export function VrlUnreadableNotice({
  subject,
  detail,
  hint,
  nextStep,
}: {
  /** "분류 기준표" 처럼 이 화면이 다루는 대상 */
  subject: string
  /** Supabase 가 돌려준 원문 — 권한인지 타임아웃인지 여기서만 알 수 있다 */
  detail: string
  /** 관리자가 실제로 확인할 곳 한 줄 */
  hint?: string
  nextStep?: VrlNextStep
}) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-[var(--r-xl)] border border-[var(--error)]/35 bg-[var(--error-light)] p-5"
    >
      <p className="flex items-center gap-2 font-display text-[14px] font-[700] text-[var(--error-ink)]">
        <AlertTriangle size={16} strokeWidth={2} aria-hidden />
        {subject}를 읽지 못했습니다
      </p>
      <p className="font-body text-[12.5px] leading-[1.7] text-[var(--t2)]">
        비어 있는 것이 아니라 <strong className="text-[var(--t1)]">조회가 실패</strong>했습니다.
        {hint ? ` ${hint}` : ' 권한(RLS)·세션·타임아웃을 먼저 확인하세요.'}
      </p>
      <p className="overflow-x-auto rounded-[var(--r-md)] bg-[var(--bg)] px-3 py-2 font-mono text-[11px] text-[var(--t2)]">
        {detail}
      </p>
      {nextStep && <NextStepLink {...nextStep} />}
    </div>
  )
}

/** 진짜로 아직 없음 — 다음 한 걸음을 반드시 같이 준다. */
export function VrlEmptyNotice({
  icon: Icon = Inbox,
  title,
  body,
  nextStep,
}: {
  icon?: LucideIcon
  title: string
  body: string
  nextStep: VrlNextStep
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[var(--r-xl)] border border-dashed border-[var(--bd)] px-4 py-14 text-center">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#8B5CF6]/10 text-[#8B5CF6]">
        <Icon size={18} strokeWidth={1.75} aria-hidden />
      </span>
      <p className="font-display text-[14px] font-[700] text-[var(--t1)]">{title}</p>
      <p className="max-w-[46ch] font-body text-[12.5px] leading-[1.7] text-[var(--t2)]">
        {body}
      </p>
      <NextStepLink {...nextStep} />
    </div>
  )
}

function NextStepLink({ href, label }: VrlNextStep) {
  return (
    <Link
      href={href}
      className="mt-1 inline-flex min-h-[44px] items-center gap-2 self-center rounded-[var(--r-md)] border border-[#8B5CF6]/40 bg-[var(--bg)] px-4 font-display text-[12.5px] font-[700] text-[#6D28D9] transition-colors duration-[var(--dur-normal)] hover:border-[#8B5CF6] hover:bg-[#8B5CF6]/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] active:scale-[0.98] motion-reduce:transition-none"
    >
      {label}
      <ArrowRight size={13} strokeWidth={2} aria-hidden />
    </Link>
  )
}
