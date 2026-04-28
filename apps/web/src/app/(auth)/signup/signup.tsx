// apps/web/src/app/(auth)/signup/page.tsx
// 회원가입 — 폼만 중앙 배치 (좌측 브랜드 패널 제거)

'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { useToast } from '@/components/ui/Toast'

// ══════════════════════════════════════════════════════════════
// 비밀번호 강도
// ══════════════════════════════════════════════════════════════
function getPasswordStrength(password: string) {
  if (!password) return { score: 0, label: '' }
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  score = Math.min(score, 4)

  if (score <= 1) return { score, label: 'Weak' }
  if (score === 2) return { score, label: 'Fair' }
  if (score === 3) return { score, label: 'Good' }
  return { score, label: 'Strong' }
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// ══════════════════════════════════════════════════════════════
// 소셜 아이콘
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

// ══════════════════════════════════════════════════════════════
// 소셜 버튼
// ══════════════════════════════════════════════════════════════
type SocialProvider = 'google' | 'apple' | 'kakao' | 'naver'

interface SocialButtonProps {
  provider: SocialProvider
  onClick: () => void
  disabled?: boolean
}

function SocialButton({ provider, onClick, disabled }: SocialButtonProps) {
  const config = {
    google: {
      icon: <GoogleIcon />,
      label: 'Continue with Google',
      className: 'bg-bg border-bd hover:border-t2 hover:bg-bg2 text-t1',
    },
    apple: {
      icon: <AppleIcon />,
      label: 'Continue with Apple',
      className: 'bg-t1 border-t1 hover:bg-t1/90 text-bg',
    },
    kakao: {
      icon: <KakaoIcon />,
      label: '카카오로 계속하기',
      className: 'bg-[#FEE500] border-[#FEE500] hover:bg-[#FADA0A] text-[#191919]',
    },
    naver: {
      icon: <NaverIcon />,
      label: '네이버로 계속하기',
      className: 'bg-[#03C75A] border-[#03C75A] hover:bg-[#02B350] text-white',
    },
  }[provider]

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex h-11 w-full items-center justify-center gap-s-3 rounded-md border px-s-4 font-display text-sm font-medium transition-all duration-normal disabled:cursor-not-allowed disabled:opacity-50 ${config.className} `}
    >
      <span className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center">
        {config.icon}
      </span>
      <span>{config.label}</span>
    </button>
  )
}

// ══════════════════════════════════════════════════════════════
// Page — 폼 중앙 배치 (좌측 패널 없음)
// ══════════════════════════════════════════════════════════════
export default function SignupPage() {
  const router = useRouter()
  const toast = useToast()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const strength = useMemo(() => getPasswordStrength(password), [password])

  const emailError =
    submitted && (!email || !isValidEmail(email))
      ? !email
        ? 'Email required'
        : 'Invalid email format'
      : ''

  const passwordError =
    submitted && (!password || password.length < 8)
      ? !password
        ? 'Password required'
        : '8+ characters required'
      : ''

  const termsError = submitted && !agreed ? 'Terms agreement required' : ''

  const handleSocial = (provider: SocialProvider) => {
    const labels: Record<SocialProvider, string> = {
      google: 'Google',
      apple: 'Apple',
      kakao: 'Kakao',
      naver: 'Naver',
    }

    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      toast.success(`${labels[provider]} 가입 (목업) — Phase 2에서 연결됩니다`)
    }, 800)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (!email || !password || !isValidEmail(email) || password.length < 8 || !agreed) return

    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      toast.success('Account created. Check your email.', {
        title: 'Welcome to Vocaflow',
      })
      router.push('/verify-email')
    }, 1200)
  }

  return (
    <div className="flex flex-1 items-center justify-center px-s-6 py-s-12 lg:py-s-16">
      <div className="w-full max-w-[420px]">
        {/* 라벨 */}
        <p className="mb-s-3 font-mono text-[10px] uppercase tracking-[0.15em] text-t3">
          — Sign up · Free 14-day trial
        </p>

        {/* 제목 */}
        <h1 className="mb-s-2 font-display text-3xl font-extrabold leading-[1.05] tracking-[-0.02em] text-t1 sm:text-4xl">
          Create your account
        </h1>
        <p className="mb-s-8 font-body text-sm text-t2">
          Already have one?{' '}
          <Link
            href="/login"
            className="text-t1 underline decoration-t3 underline-offset-4 transition-colors duration-normal hover:decoration-t1"
          >
            Sign in
          </Link>
        </p>

        {/* ──────────────────────────────────────────
             소셜 로그인 4개
             ────────────────────────────────────────── */}
        <div className="space-y-s-2">
          <SocialButton
            provider="google"
            onClick={() => handleSocial('google')}
            disabled={loading}
          />
          <SocialButton provider="apple" onClick={() => handleSocial('apple')} disabled={loading} />
          <SocialButton provider="kakao" onClick={() => handleSocial('kakao')} disabled={loading} />
          <SocialButton provider="naver" onClick={() => handleSocial('naver')} disabled={loading} />
        </div>

        {/* 구분선 */}
        <div className="my-s-6 flex items-center gap-s-4">
          <span className="h-px flex-1 bg-bd" />
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-t3">Or</span>
          <span className="h-px flex-1 bg-bd" />
        </div>

        {/* ──────────────────────────────────────────
             이메일/비밀번호
             ────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} className="space-y-s-5">
          {/* 이메일 */}
          <div>
            <label
              htmlFor="email"
              className="mb-s-2 block font-mono text-[10px] uppercase tracking-[0.15em] text-t3"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@vocaflow.com"
              autoComplete="email"
              className={`h-11 w-full border-b bg-transparent px-s-3 ${emailError ? 'border-error' : 'border-bd'} font-body text-base text-t1 transition-colors duration-normal placeholder:font-body placeholder:text-t3 focus:border-t1 focus:outline-none`}
            />
            {emailError && (
              <p className="mt-s-1 font-mono text-[10px] uppercase tracking-[0.1em] text-error">
                {emailError}
              </p>
            )}
          </div>

          {/* 비밀번호 */}
          <div>
            <div className="mb-s-2 flex items-baseline justify-between">
              <label
                htmlFor="password"
                className="block font-mono text-[10px] uppercase tracking-[0.15em] text-t3"
              >
                Password
              </label>
              {password && !passwordError && (
                <span
                  className={`font-mono text-[10px] uppercase tabular-nums tracking-[0.1em] ${
                    strength.score <= 1
                      ? 'text-error'
                      : strength.score === 2
                        ? 'text-warning'
                        : 'text-success'
                  }`}
                >
                  {strength.label}
                </span>
              )}
            </div>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8+ characters"
              autoComplete="new-password"
              className={`h-11 w-full border-b bg-transparent px-s-3 ${passwordError ? 'border-error' : 'border-bd'} font-body text-base text-t1 transition-colors duration-normal placeholder:font-body placeholder:text-t3 focus:border-t1 focus:outline-none`}
            />
            {password && !passwordError && (
              <div className="mt-s-2 flex gap-s-1">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`h-[2px] flex-1 transition-colors duration-normal ${
                      i <= strength.score
                        ? strength.score <= 1
                          ? 'bg-error'
                          : strength.score === 2
                            ? 'bg-warning'
                            : 'bg-success'
                        : 'bg-bd'
                    } `}
                  />
                ))}
              </div>
            )}
            {passwordError && (
              <p className="mt-s-1 font-mono text-[10px] uppercase tracking-[0.1em] text-error">
                {passwordError}
              </p>
            )}
          </div>

          {/* 약관 */}
          <div className="pt-s-2">
            <label className="group flex cursor-pointer items-start gap-s-3">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className={`mt-[2px] flex h-4 w-4 shrink-0 items-center justify-center border transition-all duration-normal ${agreed ? 'border-t1 bg-t1' : 'border-bd bg-transparent group-hover:border-t1'} ${termsError ? 'border-error' : ''} `}
              >
                {agreed && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path
                      d="M2 5L4 7L8 3"
                      stroke="var(--bg)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
              <span className="font-body text-xs leading-relaxed text-t2">
                I agree to the{' '}
                <Link
                  href="/terms"
                  target="_blank"
                  className="text-t1 underline underline-offset-2 hover:no-underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link
                  href="/privacy"
                  target="_blank"
                  className="text-t1 underline underline-offset-2 hover:no-underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  Privacy Policy
                </Link>
                .
              </span>
            </label>
            {termsError && (
              <p className="mt-s-2 pl-s-6 font-mono text-[10px] uppercase tracking-[0.1em] text-error">
                {termsError}
              </p>
            )}
          </div>

          {/* CTA */}
          <button
            type="submit"
            disabled={loading}
            className={`hover:bg-t1/90 group relative mt-s-2 flex h-12 w-full items-center justify-center gap-s-2 bg-t1 font-display text-sm font-semibold tracking-[-0.005em] text-bg transition-all duration-normal disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {loading ? (
              <>
                <span className="border-current/30 h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-t-current" />
                <span>Creating account…</span>
              </>
            ) : (
              <>
                <span>Create account</span>
                <span className="transition-transform duration-normal group-hover:translate-x-0.5">
                  →
                </span>
              </>
            )}
          </button>

          <p className="pt-s-2 text-center font-mono text-[9px] uppercase tracking-[0.15em] text-t3">
            No credit card · 14-day free trial · Cancel anytime
          </p>
        </form>
      </div>
    </div>
  )
}
