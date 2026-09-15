// apps/web/src/app/(auth)/verify-email/page.tsx
// 이메일 인증 대기 화면 v3
//
// 흐름:
//   1) /signup 에서 signUp 성공 + **세션이 없을 때만** ?email=... 로 이 화면에 도달
//      (세션이 있으면 이미 로그인된 것이므로 signup 이 /hub 로 바로 보낸다)
//   2) 메일의 confirm 링크 클릭 → /api/auth/callback → verifyOtp → /hub
//   3) "인증 메일 다시 보내기" → supabase.auth.resend({ type: 'signup', email })
//
// v06.140 수정:
//   - ?email 이 없으면 재발송 버튼이 눌려도 조용히 아무 일도 안 했다 → 버튼을 비활성화하고
//     다시 가입하도록 안내한다.
//   - resend 예외를 삼키던 try/finally 에 catch 추가 + 에러 문구를 lib/auth/errors 로 통일.

'use client'

import { ArrowRight, CheckCircle2, Mail, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'

import { Card } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import { mapResendError } from '@/lib/auth/errors'
import { RETURN_PARAM, loginUrlWithReturn, resolveReturnTo } from '@/lib/auth/redirect'
import { isValidEmail } from '@/lib/auth/validation'
import { createClient } from '@/lib/supabase/client'

function VerifyEmailInner() {
  const toast = useToast()
  const searchParams = useSearchParams()
  const [resending, setResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  // 가입 시 사용한 이메일 — /signup 에서 ?email=... 로 전달
  const email = searchParams.get('email') ?? ''
  /**
   * 인증을 마친 뒤 갈 곳 — `/signup` 이 `?next=` 로 실어 보낸다.
   *
   * ⚠️ 이 값을 **읽지 않고 주소창에만 두고 있었다.** 그래서 첫 인증 메일은 복귀 경로를
   *    싣는데(가입 화면이 `emailRedirectTo` 에 넣는다) **재발송 메일에는 없었다** —
   *    메일이 안 와서 다시 보낸 학생은 인증을 마치고 `/hub` 로 떨어졌고,
   *    `/join/<code>` 초대 링크가 사라져 학급에 들어가지 못했다.
   *    초대받은 학생은 전원 신규 가입자라 이 경로가 정확히 그들의 경로다.
   *    안전하지 않은 값이면 `resolveReturnTo` 가 `/hub` 로 떨어뜨린다(open redirect 차단).
   */
  const returnTo = resolveReturnTo(searchParams)
  /** 재발송을 시도할 수 있는 상태인가 — 주소가 없거나 형식이 깨졌으면 불가 */
  const canResend = isValidEmail(email)

  // 재발송 쿨다운 타이머
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown((s) => Math.max(0, s - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  const handleResend = async () => {
    if (resendCooldown > 0 || resending || !canResend) return

    setResending(true)
    try {
      const supabase = createClient()
      const origin = typeof window !== 'undefined' ? window.location.origin : ''

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          // 재발송 메일도 복귀 경로를 실어야 한다 — 콜백(`/api/auth/callback`)이
          // `safeInternalPath(next)` 를 type 별 기본값보다 우선한다.
          emailRedirectTo:
            `${origin}/api/auth/callback?${RETURN_PARAM}=${encodeURIComponent(returnTo)}`,
        },
      })

      if (error) {
        toast.error(mapResendError(error.message))
        return
      }

      setResendCooldown(60) // 60초 쿨다운
      toast.success('인증 메일을 다시 보냈습니다')
    } catch (err) {
      toast.error(mapResendError(err instanceof Error ? err.message : null))
    } finally {
      setResending(false)
    }
  }

  return (
    <Card variant="elevated" padding="lg" className="rounded-xl">
      {/* 헤더 — 큰 메일 아이콘 */}
      <div className="mb-s-6 text-center">
        <div className="relative mb-s-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-p-light">
          <Mail size={32} className="text-p" />
          <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-bg bg-active">
            <span className="h-1.5 w-1.5 rounded-full bg-bg" />
          </div>
        </div>

        <p className="mb-s-3 font-mono text-[10px] uppercase tracking-[0.15em] text-t3">
          마지막 한 단계만 남았어요
        </p>

        <h1 className="mb-s-3 font-display text-2xl font-extrabold leading-[1.1] tracking-[-0.02em] text-t1 sm:text-3xl">
          이메일을 확인해주세요
        </h1>

        <p className="mb-s-2 font-body text-sm leading-relaxed text-t2">
          {canResend
            ? '아래 주소로 인증 메일을 발송했습니다.'
            : '회원가입 시 입력한 이메일을 확인해주세요.'}
        </p>
        {canResend && <p className="break-all font-mono text-sm text-t1">{email}</p>}
      </div>

      {/* 단계 안내 */}
      <div className="mb-s-6 rounded-lg border border-bd bg-bg2 p-s-4">
        <p className="mb-s-3 font-mono text-[10px] uppercase tracking-[0.15em] text-t3">다음 단계</p>

        <ol className="space-y-s-3">
          <li className="flex items-start gap-s-3">
            <div className="mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-p font-mono text-[10px] font-bold text-[var(--on-p)]">
              1
            </div>
            <div className="flex-1">
              <p className="font-body text-sm leading-relaxed text-t1">
                메일함에서 <span className="font-semibold">Vocaflow</span>가 보낸 메일을 찾으세요
              </p>
              <p className="mt-s-1 font-body text-xs text-t3">보이지 않으면 스팸함도 확인해주세요</p>
            </div>
          </li>

          <li className="flex items-start gap-s-3">
            <div className="mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-p font-mono text-[10px] font-bold text-[var(--on-p)]">
              2
            </div>
            <div className="flex-1">
              <p className="font-body text-sm leading-relaxed text-t1">
                메일에 있는 <span className="font-semibold">&quot;인증하기&quot;</span> 버튼을
                클릭하세요
              </p>
              <p className="mt-s-1 font-body text-xs text-t3">링크는 24시간 동안 유효합니다</p>
            </div>
          </li>

          <li className="flex items-start gap-s-3">
            <div className="mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success font-mono text-[10px] font-bold text-ti">
              <CheckCircle2 size={12} />
            </div>
            <div className="flex-1">
              <p className="font-body text-sm leading-relaxed text-t1">
                인증 완료 후 자동으로 로그인됩니다
              </p>
            </div>
          </li>
        </ol>
      </div>

      {/* 메일 안 왔을 때 — 재발송 */}
      <div className="mb-s-6 space-y-s-3">
        <button
          type="button"
          onClick={handleResend}
          disabled={resending || resendCooldown > 0 || !canResend}
          className={`flex h-11 w-full items-center justify-center gap-s-2 rounded-md border border-bd bg-bg font-display text-sm font-medium text-t1 transition-all duration-normal hover:border-t2 hover:bg-bg2 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {resending ? (
            <>
              <RefreshCw size={14} className="animate-spin" />
              <span>발송 중...</span>
            </>
          ) : resendCooldown > 0 ? (
            <span className="text-t2">
              <span className="font-mono tabular-nums">{resendCooldown}</span>초 후 다시 보내기
            </span>
          ) : (
            <>
              <RefreshCw size={14} />
              <span>인증 메일 다시 보내기</span>
            </>
          )}
        </button>

        {/* 주소를 모르면 재발송할 대상이 없다 — 버튼만 죽여두지 말고 이유를 말한다 */}
        {!canResend && (
          <p className="text-center font-body text-xs text-t3">
            인증할 주소를 알 수 없어 재발송할 수 없어요. 아래에서 다시 가입해주세요.
          </p>
        )}

        <Link
          href={`/signup?${RETURN_PARAM}=${encodeURIComponent(returnTo)}`}
          className="flex h-11 w-full items-center justify-center rounded-md font-display text-sm font-medium text-t2 transition-colors duration-normal hover:bg-bg2 hover:text-t1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:scale-[0.99]"
        >
          다른 이메일로 다시 가입하기
        </Link>
      </div>

      {/* 하단 — 로그인 가능 안내 */}
      <div className="border-t border-bd pt-s-6 text-center">
        <p className="mb-s-3 font-body text-sm text-t2">이미 인증을 완료하셨나요?</p>
        {/* 복귀 경로를 그대로 넘긴다 — 여기서 흘리면 인증을 마친 학생이 학급이 아니라 `/hub` 로 간다.
            높이 44px: `text-sm` 무패딩이라 약 20px 였다(CLAUDE.md 절대 금지 · 실측 390px). */}
        <Link
          href={loginUrlWithReturn(returnTo)}
          className="group inline-flex min-h-[44px] items-center gap-s-2 font-display text-sm font-semibold text-p transition-colors duration-normal hover:text-p-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
        >
          <span>로그인 화면으로</span>
          <ArrowRight
            size={14}
            className="transition-transform duration-normal group-hover:translate-x-0.5"
          />
        </Link>
      </div>

      <p className="pt-s-6 text-center font-mono text-[10px] uppercase tracking-[0.1em] text-t3">
        문의: support@vocaflow.com
      </p>
    </Card>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <Card variant="elevated" padding="lg" className="rounded-xl">
          <div className="flex h-40 items-center justify-center">
            <span
              className="border-current/30 h-5 w-5 animate-spin rounded-full border-2 border-t-current text-t3"
              role="status"
              aria-label="확인 중"
            />
          </div>
        </Card>
      }
    >
      <VerifyEmailInner />
    </Suspense>
  )
}
