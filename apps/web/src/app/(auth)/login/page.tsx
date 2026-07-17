// apps/web/src/app/(auth)/login/page.tsx
// 로그인 — Parts Kit + Linear/Vercel 미니멀
// v4: 이메일/비밀번호 단일. 소셜 버튼은 Supabase provider 전원 미설정
//     ("provider is not enabled" 실패 + 목업 토스트)이라 제거 — provider 설정 시 git 이력 복원.

'use client'

import { AlertCircle, ArrowRight, Lock, Mail } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

import { Card } from '@/components/ui/Card'
import { Checkbox } from '@/components/ui/Checkbox'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { createClient } from '@/lib/supabase/client'

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// ── Supabase 에러 메시지 → 사용자 친화 한국어 매핑 ──
function mapAuthError(message: string | undefined | null): string {
  const msg = (message ?? '').toLowerCase()
  if (msg.includes('invalid login') || msg.includes('invalid_credentials')) {
    return '이메일 또는 비밀번호가 일치하지 않습니다'
  }
  if (msg.includes('email not confirmed')) {
    return '이메일 인증이 필요합니다. 받은편지함을 확인하세요'
  }
  if (msg.includes('user not found')) {
    return '등록되지 않은 이메일입니다'
  }
  if (msg.includes('too many requests') || msg.includes('rate limit')) {
    return '너무 많은 요청입니다. 잠시 후 다시 시도해주세요'
  }
  return '로그인 중 오류가 발생했습니다. 다시 시도해주세요'
}

// ── /api/auth/callback ?error=... 코드 → 한국어 메시지 ──
function mapCallbackError(code: string | null): string | null {
  switch (code) {
    case 'oauth_failed':
      return 'Google 로그인 처리 중 오류가 발생했습니다. 다시 시도해주세요'
    case 'email_verification_failed':
      return '이메일 인증에 실패했습니다. 인증 메일을 다시 받으시거나 고객센터에 문의해주세요'
    case 'link_expired':
      return '인증 링크가 만료되었습니다. 새 인증 메일을 요청해주세요'
    case 'invalid_callback':
      return '잘못된 접근입니다'
    case 'already_verified':
      return '이미 인증이 완료된 계정입니다. 로그인해주세요'
    default:
      return null
  }
}

// ── returnTo 안전 검증 — open redirect 방지 ──
function safeRedirect(returnTo: string | null): string {
  if (!returnTo) return '/hub'
  // 내부 경로만 허용: '/' 로 시작 + '//' (protocol-relative) 차단
  if (!returnTo.startsWith('/') || returnTo.startsWith('//')) return '/hub'
  // 외부 URL 패턴 차단 ('/', 'http', '\\' 등)
  if (returnTo.includes('://') || returnTo.includes('\\')) return '/hub'
  return returnTo
}

// ══════════════════════════════════════════════════════════════
// Page
// ══════════════════════════════════════════════════════════════
export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  /** 인증 실패 인라인 배너 메시지 — null 이면 미표시 */
  const [authError, setAuthError] = useState<string | null>(() => {
    // /api/auth/callback 에서 ?error=... 코드로 redirect 됨
    const code = searchParams.get('error')
    return mapCallbackError(code)
  })

  const emailError =
    submitted && (!email || !isValidEmail(email))
      ? !email
        ? '이메일을 입력해주세요'
        : '올바른 이메일 형식이 아닙니다'
      : undefined

  const passwordError = submitted && !password ? '비밀번호를 입력해주세요' : undefined

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setAuthError(null)

    if (!email || !password || !isValidEmail(email)) return

    setLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) {
        setAuthError(mapAuthError(error.message))
        return
      }

      // 로그인 성공 → returnTo 안전 검증 후 이동
      const target = safeRedirect(searchParams.get('returnTo'))
      router.push(target)
      router.refresh() // Server Component 재실행 (인증 컨텍스트 갱신)
    } catch {
      setAuthError(mapAuthError(null))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card variant="elevated" padding="lg" className="rounded-xl">
      {/* ── 헤더 ── */}
      <div className="mb-s-8 text-center">
        <p className="mb-s-3 font-mono text-[10px] uppercase tracking-[0.15em] text-t3">
          다시 만나서 반가워요
        </p>

        <h1 className="mb-s-2 font-display text-2xl font-extrabold leading-[1.1] tracking-[-0.02em] text-t1 sm:text-3xl">
          로그인
        </h1>
        <p className="font-body text-sm text-t2">
          처음 오셨나요?{' '}
          <Link href="/signup" className="font-semibold text-p underline-offset-4 hover:underline">
            회원가입
          </Link>
        </p>
      </div>

      {/* ── 인증 에러 배너 (인라인) ── */}
      {authError && (
        <div
          role="alert"
          aria-live="assertive"
          className="mb-s-4 flex items-start gap-s-2 rounded-md border border-error/30 bg-error-light px-s-3 py-s-2.5 font-body text-sm text-error"
        >
          <AlertCircle size={16} className="mt-px shrink-0" aria-hidden />
          <span>{authError}</span>
        </div>
      )}

      {/* ── 폼 ── */}
      <form onSubmit={handleSubmit} className="space-y-s-4">
        {/* 이메일 */}
        <FormField label="이메일" required error={emailError}>
          {(props) => (
            <Input
              type="email"
              placeholder="user@vocaflow.com"
              prefix={<Mail size={16} />}
              state={emailError ? 'error' : 'default'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              {...props}
            />
          )}
        </FormField>

        {/* 비밀번호 */}
        <FormField
          label="비밀번호"
          required
          error={passwordError}
          hint={
            <Link
              href="/reset-password"
              className="font-mono text-[10px] uppercase tracking-[0.1em] text-t3 transition-colors duration-normal hover:text-p"
            >
              비밀번호 찾기
            </Link>
          }
        >
          {(props) => (
            <Input
              type="password"
              placeholder="비밀번호 입력"
              prefix={<Lock size={16} />}
              showPasswordToggle
              state={passwordError ? 'error' : 'default'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              {...props}
            />
          )}
        </FormField>

        {/* Remember me */}
        <div className="pt-s-1">
          <Checkbox
            label={<span className="font-body text-sm text-t2">30일간 로그인 유지</span>}
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
          />
        </div>

        {/* CTA */}
        <button
          type="submit"
          disabled={loading}
          className={`group relative mt-s-2 flex h-12 w-full items-center justify-center gap-s-2 rounded-md bg-p font-display text-sm font-semibold tracking-[-0.005em] text-ti shadow-sm transition-all duration-normal hover:bg-p-hover hover:shadow-md active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {loading ? (
            <>
              <span className="border-current/30 h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-t-current" />
              <span>로그인 중...</span>
            </>
          ) : (
            <>
              <span>로그인</span>
              <ArrowRight
                size={16}
                className="transition-transform duration-normal group-hover:translate-x-0.5"
              />
            </>
          )}
        </button>

        {/* 푸터 */}
        <p className="pt-s-2 text-center font-mono text-[10px] uppercase tracking-[0.1em] text-t3">
          안전한 인증 · 산업 표준 암호화
        </p>
      </form>
    </Card>
  )
}
