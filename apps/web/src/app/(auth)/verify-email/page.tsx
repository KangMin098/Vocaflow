// apps/web/src/app/(auth)/verify-email/page.tsx
// 이메일 인증 대기 화면
// 회원가입 직후 도달하는 페이지

'use client'

import { ArrowRight, CheckCircle2, Mail, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { Card } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'

export default function VerifyEmailPage() {
  const toast = useToast()
  const [resending, setResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  // 가입 시 사용한 이메일 (목업) — 실제로는 router state 또는 supabase user에서 가져옴
  const email = 'user@vocaflow.com'

  // 재발송 쿨다운 타이머
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown((s) => Math.max(0, s - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  const handleResend = () => {
    if (resendCooldown > 0 || resending) return

    setResending(true)
    setTimeout(() => {
      setResending(false)
      setResendCooldown(60) // 60초 쿨다운
      toast.success('인증 메일을 다시 보냈습니다')
    }, 800)
  }

  const handleChangeEmail = () => {
    toast.info('이메일 변경은 Phase 2에서 구현됩니다')
  }

  return (
    <Card variant="elevated" padding="lg" className="rounded-xl">
      {/* 헤더 — 큰 메일 아이콘 */}
      <div className="mb-s-6 text-center">
        <div className="relative mb-s-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-p-light">
          <Mail size={32} className="text-p" />
          {/* 작은 알림 점 */}
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
          아래 주소로 인증 메일을 발송했습니다.
        </p>
        <p className="break-all font-mono text-sm text-t1">{email}</p>
      </div>

      {/* 단계 안내 */}
      <div className="mb-s-6 rounded-lg border border-bd bg-bg2 p-s-4">
        <p className="mb-s-3 font-mono text-[10px] uppercase tracking-[0.15em] text-t3">
          다음 단계
        </p>

        <ol className="space-y-s-3">
          <li className="flex items-start gap-s-3">
            <div className="mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-p font-mono text-[10px] font-bold text-ti">
              1
            </div>
            <div className="flex-1">
              <p className="font-body text-sm leading-relaxed text-t1">
                메일함에서 <span className="font-semibold">Vocaflow</span>가 보낸 메일을 찾으세요
              </p>
              <p className="mt-s-1 font-body text-xs text-t3">
                보이지 않으면 스팸함도 확인해주세요
              </p>
            </div>
          </li>

          <li className="flex items-start gap-s-3">
            <div className="mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-p font-mono text-[10px] font-bold text-ti">
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
          disabled={resending || resendCooldown > 0}
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

        <button
          type="button"
          onClick={handleChangeEmail}
          className="h-11 w-full rounded-md font-display text-sm font-medium text-t2 transition-colors duration-normal hover:bg-bg2 hover:text-t1 active:scale-[0.99]"
        >
          다른 이메일 주소로 변경
        </button>
      </div>

      {/* 하단 — 로그인 가능 안내 */}
      <div className="border-t border-bd pt-s-6 text-center">
        <p className="mb-s-3 font-body text-sm text-t2">이미 인증을 완료하셨나요?</p>
        <Link
          href="/login"
          className="group inline-flex items-center gap-s-2 font-display text-sm font-semibold text-p transition-colors duration-normal hover:text-p-hover"
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
