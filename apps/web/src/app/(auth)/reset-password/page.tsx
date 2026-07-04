// apps/web/src/app/(auth)/reset-password/page.tsx
// 비밀번호 재설정 — 실동작 2모드 (v06.126, 목업 → Supabase 연결)
//   request: 이메일 입력 → supabase.auth.resetPasswordForEmail (recovery 메일 발송)
//   update : recovery 링크로 진입(콜백이 세션 수립 후 이곳으로 리다이렉트) → 새 비밀번호 저장
// 콜백 경로: /api/auth/callback?token_hash=...&type=recovery → verifyOtp → /reset-password
// Parts Kit + Linear/Vercel 미니멀 톤

'use client'

import { ArrowRight, CheckCircle2, KeyRound, Mail } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { Card } from '@/components/ui/Card'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

type Mode = 'checking' | 'request' | 'update'

export default function ResetPasswordPage() {
  const toast = useToast()
  const router = useRouter()

  const [mode, setMode] = useState<Mode>('checking')

  // request 모드 상태
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [sent, setSent] = useState(false)

  // update 모드 상태
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [pwSubmitted, setPwSubmitted] = useState(false)

  // recovery 링크로 진입하면 콜백이 세션을 수립한 뒤 이 페이지로 보냄 → update 모드.
  // 세션이 없으면 발송 요청 모드.
  useEffect(() => {
    const supabase = createClient()
    supabase.auth
      .getSession()
      .then(({ data }) => setMode(data.session ? 'update' : 'request'))
      .catch(() => setMode('request'))
  }, [])

  const emailError =
    submitted && (!email || !isValidEmail(email))
      ? !email
        ? '이메일을 입력해주세요'
        : '올바른 이메일 형식이 아닙니다'
      : undefined

  const passwordError =
    pwSubmitted && password.length < 8 ? '비밀번호는 8자 이상이어야 합니다' : undefined
  const passwordConfirmError =
    pwSubmitted && passwordConfirm !== password ? '비밀번호가 일치하지 않습니다' : undefined

  // ── request: 재설정 메일 발송 ──
  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (!email || !isValidEmail(email)) return

    setLoading(true)
    try {
      const supabase = createClient()
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${origin}/api/auth/callback`,
      })
      if (error) {
        // rate limit 등 — 존재하지 않는 이메일은 Supabase 가 200 으로 침묵(enumeration 방지)
        toast.error(
          error.status === 429
            ? '요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.'
            : `발송에 실패했습니다: ${error.message}`,
        )
        return
      }
      setSent(true)
      toast.success('재설정 링크를 발송했습니다')
    } finally {
      setLoading(false)
    }
  }

  // ── update: 새 비밀번호 저장 ──
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwSubmitted(true)
    if (password.length < 8 || passwordConfirm !== password) return

    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        toast.error(
          error.message.includes('different from the old')
            ? '이전과 다른 비밀번호를 사용해주세요.'
            : `변경에 실패했습니다: ${error.message}`,
        )
        return
      }
      toast.success('비밀번호가 변경되었습니다')
      router.replace('/hub')
    } finally {
      setLoading(false)
    }
  }

  // ──────────────────────────────────────────
  // 세션 확인 중
  // ──────────────────────────────────────────
  if (mode === 'checking') {
    return (
      <Card variant="elevated" padding="lg" className="rounded-xl">
        <div className="flex h-40 items-center justify-center">
          <span className="border-current/30 h-5 w-5 animate-spin rounded-full border-2 border-t-current text-t3" />
        </div>
      </Card>
    )
  }

  // ──────────────────────────────────────────
  // update 모드 — 새 비밀번호 설정 (recovery 링크 진입)
  // ──────────────────────────────────────────
  if (mode === 'update') {
    return (
      <Card variant="elevated" padding="lg" className="rounded-xl">
        <div className="mb-s-8 text-center">
          <div className="mb-s-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-p-light">
            <KeyRound size={28} className="text-p" />
          </div>
          <p className="mb-s-3 font-mono text-[10px] uppercase tracking-[0.15em] text-t3">
            마지막 단계예요
          </p>
          <h1 className="mb-s-3 font-display text-2xl font-extrabold leading-[1.1] tracking-[-0.02em] text-t1 sm:text-3xl">
            새 비밀번호 설정
          </h1>
          <p className="font-body text-sm leading-relaxed text-t2">
            앞으로 사용할 새 비밀번호를 입력해주세요.
          </p>
        </div>

        <form onSubmit={handleUpdatePassword} className="space-y-s-6">
          <FormField
            label="새 비밀번호"
            required
            error={passwordError}
            helper={!passwordError ? '8자 이상 입력하세요' : undefined}
          >
            {(props) => (
              <Input
                type="password"
                placeholder="••••••••"
                state={passwordError ? 'error' : 'default'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                autoFocus
                {...props}
              />
            )}
          </FormField>

          <FormField label="새 비밀번호 확인" required error={passwordConfirmError}>
            {(props) => (
              <Input
                type="password"
                placeholder="••••••••"
                state={passwordConfirmError ? 'error' : 'default'}
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                autoComplete="new-password"
                {...props}
              />
            )}
          </FormField>

          <button
            type="submit"
            disabled={loading}
            className="group relative flex h-12 w-full items-center justify-center gap-s-2 rounded-md bg-p font-display text-sm font-semibold tracking-[-0.005em] text-ti shadow-sm transition-all duration-normal hover:bg-p-hover hover:shadow-md active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <span className="border-current/30 h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-t-current" />
                <span>변경 중...</span>
              </>
            ) : (
              <>
                <span>비밀번호 변경</span>
                <ArrowRight
                  size={16}
                  className="transition-transform duration-normal group-hover:translate-x-0.5"
                />
              </>
            )}
          </button>
        </form>
      </Card>
    )
  }

  // ──────────────────────────────────────────
  // 발송 완료 상태
  // ──────────────────────────────────────────
  if (sent) {
    return (
      <Card variant="elevated" padding="lg" className="rounded-xl">
        <div className="mb-s-6 text-center">
          {/* 성공 아이콘 — Primary 색상 */}
          <div className="mb-s-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-success-light">
            <CheckCircle2 size={28} className="text-success" />
          </div>

          <p className="mb-s-3 font-mono text-[10px] uppercase tracking-[0.15em] text-t3">
            메일함을 확인해주세요
          </p>

          <h1 className="mb-s-3 font-display text-2xl font-extrabold leading-[1.1] tracking-[-0.02em] text-t1 sm:text-3xl">
            이메일을 보냈어요
          </h1>

          <p className="mb-s-2 font-body text-sm text-t2">
            아래 주소로 비밀번호 재설정 링크를 발송했습니다.
          </p>
          <p className="mb-s-6 break-all font-mono text-sm text-t1">{email}</p>
        </div>

        {/* 안내 박스 */}
        <div className="border-info/20 mb-s-6 rounded-lg border bg-info-light p-s-4">
          <p className="mb-s-2 font-mono text-[10px] uppercase tracking-[0.15em] text-info">
            다음 단계
          </p>
          <p className="font-body text-sm leading-relaxed text-t1">
            메일함을 확인하고 링크를 클릭하세요. 5분 안에 도착하지 않으면 스팸함도 확인해주세요.
            가입된 이메일이 아닐 경우 메일이 발송되지 않습니다. 링크는 1시간 동안 유효합니다.
          </p>
        </div>

        {/* 액션 버튼 */}
        <div className="space-y-s-3">
          <button
            type="button"
            onClick={() => {
              setSent(false)
              setSubmitted(false)
            }}
            className="h-11 w-full rounded-md border border-bd bg-bg font-display text-sm font-medium text-t1 transition-all duration-normal hover:border-t2 hover:bg-bg2 active:scale-[0.99]"
          >
            다른 이메일로 다시 시도
          </button>

          <Link
            href="/login"
            className="group block flex h-12 w-full items-center justify-center gap-s-2 rounded-md bg-p font-display text-sm font-semibold tracking-[-0.005em] text-ti shadow-sm transition-all duration-normal hover:bg-p-hover hover:shadow-md active:scale-[0.99]"
          >
            <span>로그인 화면으로</span>
            <ArrowRight
              size={16}
              className="transition-transform duration-normal group-hover:translate-x-0.5"
            />
          </Link>
        </div>

        <p className="pt-s-6 text-center font-mono text-[10px] uppercase tracking-[0.1em] text-t3">
          링크는 1시간 후 만료됩니다
        </p>
      </Card>
    )
  }

  // ──────────────────────────────────────────
  // 입력 상태 (기본 — request 모드)
  // ──────────────────────────────────────────
  return (
    <Card variant="elevated" padding="lg" className="rounded-xl">
      {/* 헤더 */}
      <div className="mb-s-8 text-center">
        <p className="mb-s-3 font-mono text-[10px] uppercase tracking-[0.15em] text-t3">
          걱정마세요, 도와드릴게요
        </p>

        <h1 className="mb-s-3 font-display text-2xl font-extrabold leading-[1.1] tracking-[-0.02em] text-t1 sm:text-3xl">
          비밀번호를
          <br />
          잊으셨나요?
        </h1>

        <p className="font-body text-sm leading-relaxed text-t2">
          이메일을 입력하시면 비밀번호 재설정
          <br />
          링크를 보내드립니다.
        </p>
      </div>

      {/* 폼 */}
      <form onSubmit={handleSendLink} className="space-y-s-6">
        <FormField
          label="이메일"
          required
          error={emailError}
          helper={!emailError ? '가입 시 사용한 이메일 주소를 입력하세요' : undefined}
        >
          {(props) => (
            <Input
              type="email"
              placeholder="user@vocaflow.com"
              prefix={<Mail size={16} />}
              state={emailError ? 'error' : 'default'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
              {...props}
            />
          )}
        </FormField>

        {/* CTA */}
        <button
          type="submit"
          disabled={loading}
          className={`group relative flex h-12 w-full items-center justify-center gap-s-2 rounded-md bg-p font-display text-sm font-semibold tracking-[-0.005em] text-ti shadow-sm transition-all duration-normal hover:bg-p-hover hover:shadow-md active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {loading ? (
            <>
              <span className="border-current/30 h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-t-current" />
              <span>발송 중...</span>
            </>
          ) : (
            <>
              <span>재설정 링크 받기</span>
              <ArrowRight
                size={16}
                className="transition-transform duration-normal group-hover:translate-x-0.5"
              />
            </>
          )}
        </button>
      </form>

      {/* 하단 보조 링크 */}
      <div className="mt-s-8 flex items-center justify-between border-t border-bd pt-s-6">
        <Link
          href="/login"
          className="font-mono text-[10px] uppercase tracking-[0.1em] text-t3 transition-colors duration-normal hover:text-p"
        >
          ← 로그인으로
        </Link>
        <Link
          href="/signup"
          className="font-mono text-[10px] uppercase tracking-[0.1em] text-t3 transition-colors duration-normal hover:text-p"
        >
          회원가입 →
        </Link>
      </div>
    </Card>
  )
}
