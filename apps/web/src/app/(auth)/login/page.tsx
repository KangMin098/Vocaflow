// apps/web/src/app/(auth)/login/page.tsx
// 로그인 — Parts Kit + Linear/Vercel 미니멀
// v3: 이메일/비밀번호 + Google OAuth 실제 연결 (Apple/Kakao/Naver 는 mock)

'use client'

import { AlertCircle, ArrowRight, Lock, Mail } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

import { Card } from '@/components/ui/Card'
import { Checkbox } from '@/components/ui/Checkbox'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
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
// 소셜 아이콘 (signup과 동일 — 별도 파일로 추출 권장하지만 일관성 위해 인라인)
// ══════════════════════════════════════════════════════════════
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
    <g fill="none">
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </g>
  </svg>
)

const AppleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" fill="currentColor">
    <path d="M14.94 9.56c-.02-2.28 1.86-3.38 1.95-3.43-1.06-1.55-2.71-1.76-3.3-1.79-1.41-.14-2.74.83-3.46.83-.72 0-1.83-.81-3-.79-1.55.02-2.97.9-3.77 2.28-1.6 2.78-.41 6.91 1.16 9.18.77 1.11 1.69 2.36 2.9 2.32 1.16-.05 1.6-.75 3.01-.75 1.4 0 1.8.75 3.03.72 1.25-.02 2.04-1.13 2.81-2.25.88-1.29 1.25-2.55 1.27-2.62-.03-.01-2.43-.93-2.45-3.7zM12.95 3.05c.64-.78 1.07-1.86.95-2.93-.92.04-2.04.61-2.7 1.39-.59.69-1.11 1.79-.97 2.84 1.03.08 2.08-.52 2.72-1.3z" />
  </svg>
)

const KakaoIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
    <path d="M12 3C6.48 3 2 6.58 2 11c0 2.86 1.85 5.36 4.62 6.78-.2.71-.71 2.62-.83 3.04-.14.51.19.5.39.36.16-.11 2.5-1.7 3.51-2.39.76.11 1.53.18 2.31.18 5.52 0 10-3.58 10-8s-4.48-8-10-8z" />
  </svg>
)

const NaverIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
    <path d="M11.5 8.5L4.5 0H0v16h4.5V7.5L11.5 16H16V0h-4.5v8.5z" />
  </svg>
)

type SocialProvider = 'google' | 'apple' | 'kakao' | 'naver'

function SocialButton({
  provider,
  onClick,
  disabled,
}: {
  provider: SocialProvider
  onClick: () => void
  disabled?: boolean
}) {
  const config = {
    google: {
      icon: <GoogleIcon />,
      label: 'Google로 로그인',
      className: 'bg-bg border border-bd hover:border-t2 hover:bg-bg2 text-t1',
    },
    apple: {
      icon: <AppleIcon />,
      label: 'Apple로 로그인',
      className: 'bg-t1 border border-t1 hover:opacity-90 text-bg',
    },
    kakao: {
      icon: <KakaoIcon />,
      label: '카카오로 로그인',
      className: 'bg-[#FEE500] border border-[#FEE500] hover:bg-[#FADA0A] text-[#191919]',
    },
    naver: {
      icon: <NaverIcon />,
      label: '네이버로 로그인',
      className: 'bg-[#03C75A] border border-[#03C75A] hover:bg-[#02B350] text-white',
    },
  }[provider]

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex h-11 w-full items-center justify-center gap-s-3 rounded-md px-s-4 font-display text-sm font-medium transition-all duration-normal active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 ${config.className} `}
    >
      <span className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center">
        {config.icon}
      </span>
      <span>{config.label}</span>
    </button>
  )
}

// ══════════════════════════════════════════════════════════════
// Page
// ══════════════════════════════════════════════════════════════
export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const toast = useToast()

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

  const handleSocial = async (provider: SocialProvider) => {
    setAuthError(null)

    // ── Google: 실제 Supabase OAuth ──
    if (provider === 'google') {
      setLoading(true)
      try {
        const supabase = createClient()
        const origin = window.location.origin
        const next = safeRedirect(searchParams.get('returnTo'))

        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            // callback 라우트로 돌아온 뒤 next 로 redirect
            redirectTo: `${origin}/api/auth/callback?next=${encodeURIComponent(next)}`,
          },
        })

        if (error) {
          setAuthError('Google 로그인을 시작할 수 없어요. 잠시 후 다시 시도해주세요')
          setLoading(false)
          return
        }
        // signInWithOAuth 가 자체 redirect 수행 — setLoading(false) 불필요
        // (Google → Supabase → /api/auth/callback → /hub)
      } catch {
        setAuthError('Google 로그인 중 오류가 발생했습니다')
        setLoading(false)
      }
      return
    }

    // ── Apple/Kakao/Naver: mock 유지 (외부 설정 미완료) ──
    const labels: Record<SocialProvider, string> = {
      google: 'Google',
      apple: 'Apple',
      kakao: 'Kakao',
      naver: 'Naver',
    }
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      toast.success(`${labels[provider]} 로그인 (목업) — Phase 3 에서 연결됩니다`)
    }, 800)
  }

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

      {/* ── 소셜 4개 ── */}
      <div className="space-y-s-2">
        <SocialButton provider="google" onClick={() => handleSocial('google')} disabled={loading} />
        <SocialButton provider="apple" onClick={() => handleSocial('apple')} disabled={loading} />
        <SocialButton provider="kakao" onClick={() => handleSocial('kakao')} disabled={loading} />
        <SocialButton provider="naver" onClick={() => handleSocial('naver')} disabled={loading} />
      </div>

      {/* ── 구분선 ── */}
      <div className="my-s-6 flex items-center gap-s-3">
        <div className="h-px flex-1 bg-bd" />
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-t3">
          또는 이메일로
        </span>
        <div className="h-px flex-1 bg-bd" />
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
