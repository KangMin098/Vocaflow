// apps/web/src/app/(auth)/signup/page.tsx
// 회원가입 v3 — 실제 Supabase 연결 (이메일 단일. 소셜 버튼은 provider 전원
// 미설정 — "provider is not enabled" 실패 + 목업 토스트 — 이라 제거,
// provider 설정 시 git 이력 복원)
//
// 가입 흐름:
//   1) 폼 검증 (email/password/displayName/약관)
//   2) supabase.auth.signUp({ email, password, options: { data, emailRedirectTo } })
//   3) DB 트리거 (handle_new_user) 가 auth.users INSERT 후
//      public.user_profiles 에 자동으로 row 생성 (display_name/locale 포함)
//   4) /verify-email 로 이동 (email 인증 대기 안내)
//
// ⚠️ 약관 동의 시각: user_consents 테이블이 아직 없어 raw_user_meta_data 에 임시 저장.
//    TODO Phase 3: user_consents 테이블 정식 마이그레이션 후 분리 저장.

'use client'

import { AlertCircle, ArrowRight, Lock, Mail, User as UserIcon } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { Card } from '@/components/ui/Card'
import { Checkbox } from '@/components/ui/Checkbox'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'

// ── 한글 display_name → base64 (브라우저 fetch ISO-8859-1 헤더 검증 우회) ──
//
// 일부 supabase-js / 미들웨어 / 쿠키 조합에서 raw_user_meta_data 의 비-ASCII 가
// RequestInit.headers 경로로 흘러 "String contains non ISO-8859-1 code point" 에러 발생.
// → 클라이언트에서 UTF-8 → base64 인코드 → 트리거에서 디코드하여 우회.
//
// 트리거 (handle_new_user_decode_display_name) 가 display_name_b64 marker 우선 처리.
function encodeDisplayNameB64(name: string): string {
  // btoa 는 Latin-1 만 받으므로 TextEncoder 로 UTF-8 바이트 → binary string → btoa
  // (deprecated `unescape` 패턴 회피)
  const bytes = new TextEncoder().encode(name)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

// ── Supabase 에러 → 한국어 매핑 ──
function mapSignupError(message: string | undefined | null): string {
  const msg = (message ?? '').toLowerCase()

  // 사용자 측 입력 오류
  if (msg.includes('already registered') || msg.includes('user already')) {
    return '이미 가입된 이메일입니다'
  }
  if (msg.includes('password should be') || msg.includes('password is too') || msg.includes('weak password')) {
    return '비밀번호는 최소 8자 이상이어야 합니다'
  }
  if (msg.includes('unable to validate email') || msg.includes('invalid email')) {
    return '올바른 이메일 형식이 아닙니다'
  }
  if (msg.includes('email rate limit')) {
    return '이메일 발송 한도에 도달했습니다. 약 1시간 후 다시 시도하거나 다른 이메일을 사용해주세요'
  }
  if (msg.includes('rate limit') || msg.includes('too many')) {
    return '너무 많은 요청입니다. 잠시 후 다시 시도해주세요'
  }

  // 서버 / 인프라 오류 — 사용자에게도 단서 제공
  if (msg.includes('database error') || msg.includes('saving new user')) {
    return '서버 설정 오류 — 관리자에게 문의해주세요 (DB 트리거 미적용 가능성)'
  }
  if (msg.includes('signups not allowed') || msg.includes('disabled')) {
    return '회원가입이 일시 중단되었습니다. 잠시 후 다시 시도해주세요'
  }
  if (msg.includes('email signups are disabled') || msg.includes('email auth is disabled')) {
    return '이메일 가입이 비활성화되어 있습니다 (관리자 설정 확인 필요)'
  }
  if (msg.includes('network') || msg.includes('failed to fetch')) {
    return '네트워크 연결을 확인해주세요'
  }

  // 디버그용 — 매칭되지 않은 메시지 일부 노출 (보안상 50자 제한)
  if (message && process.env.NODE_ENV !== 'production') {
    return `회원가입 오류: ${message.slice(0, 80)}`
  }
  return '회원가입 중 오류가 발생했습니다. 다시 시도해주세요'
}

// ══════════════════════════════════════════════════════════════
// 비밀번호 강도
// ══════════════════════════════════════════════════════════════
function getPasswordStrength(password: string) {
  if (!password) return { score: 0, label: '' as const, color: 'error' as const }
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  score = Math.min(score, 4)

  if (score <= 1) return { score, label: '약함', color: 'error' as const }
  if (score === 2) return { score, label: '보통', color: 'warning' as const }
  if (score === 3) return { score, label: '좋음', color: 'success' as const }
  return { score, label: '강함', color: 'success' as const }
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// ══════════════════════════════════════════════════════════════
// Page
// ══════════════════════════════════════════════════════════════
export default function SignupPage() {
  const router = useRouter()
  const toast = useToast()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)
  const [agreeMarketing, setAgreeMarketing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  /** 가입 실패 인라인 배너 — null 이면 미표시 */
  const [authError, setAuthError] = useState<string | null>(null)

  const strength = useMemo(() => getPasswordStrength(password), [password])

  const emailError =
    submitted && (!email || !isValidEmail(email))
      ? !email
        ? '이메일을 입력해주세요'
        : '올바른 이메일 형식이 아닙니다'
      : undefined

  const passwordError =
    submitted && (!password || password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password))
      ? !password
        ? '비밀번호를 입력해주세요'
        : password.length < 8
          ? '8자 이상 입력해주세요'
          : '영문과 숫자를 모두 포함해주세요'
      : undefined

  const nameError =
    submitted && (displayName.trim().length < 2 || displayName.trim().length > 20)
      ? displayName.trim().length < 2
        ? '이름은 2자 이상이어야 해요'
        : '이름은 20자 이하로 입력해주세요'
      : undefined

  const termsError =
    submitted && (!agreeTerms || !agreePrivacy) ? '필수 약관에 동의해주세요' : undefined

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setAuthError(null)

    const trimmedName = displayName.trim()

    if (
      !email ||
      !password ||
      !isValidEmail(email) ||
      password.length < 8 ||
      !/[A-Za-z]/.test(password) ||
      !/\d/.test(password) ||
      trimmedName.length < 2 ||
      trimmedName.length > 20 ||
      !agreeTerms ||
      !agreePrivacy
    ) {
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()
      const origin = typeof window !== 'undefined' ? window.location.origin : ''

      // ── stale 세션 차단 ──
      // 이전 가입 시도가 남긴 세션 토큰의 user_metadata 한글이 다음 fetch 헤더로
      // 흘러들어가 ISO-8859-1 검증 실패시키는 케이스 방지. signUp 은 unauth 요청이므로
      // 기존 세션을 먼저 비우고 진행.
      try {
        await supabase.auth.signOut({ scope: 'local' })
      } catch {
        // 세션 없으면 그냥 진행
      }
      // localStorage 의 supabase 키 강제 정리 (storageKey = `sb-<projectRef>-auth-token`)
      if (typeof window !== 'undefined') {
        Object.keys(window.localStorage)
          .filter((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
          .forEach((k) => window.localStorage.removeItem(k))
      }

      const consentTimestamp = new Date().toISOString()

      // 한글 등 비-ASCII display_name 은 base64 로 인코드해서 전송.
      // 트리거 (handle_new_user_decode_display_name) 가 display_name_b64 우선 디코드.
      // 순수 ASCII 이름이면 base64 도 같이 보내지만 트리거에서 자연스럽게 처리됨.
      const isAscii = /^[\x20-\x7E]*$/.test(trimmedName)

      // ── 🔍 진단: 어떤 입력/환경변수에 비-ASCII 가 들어갔는지 검출 ──
      // (운영에서는 자동 비활성화)
      if (process.env.NODE_ENV !== 'production') {
        const checkAscii = (label: string, s: string | undefined | null) => {
          if (s == null) return
          for (let i = 0; i < s.length; i++) {
            const code = s.charCodeAt(i)
            if (code > 127) {
              // eslint-disable-next-line no-console
              console.warn(
                `[diag] ⚠️ NON-ASCII in ${label} at index ${i}: ` +
                  `U+${code.toString(16).toUpperCase().padStart(4, '0')} (${s[i]}) ` +
                  `· length=${s.length}`,
              )
              return
            }
          }
          // eslint-disable-next-line no-console
          console.log(`[diag] ✓ ${label}: ${s.length} chars, all ASCII`)
        }
        checkAscii('email', email.trim())
        checkAscii('password (length only)', '*'.repeat(password.length))
        checkAscii('displayName(raw)', trimmedName)
        checkAscii('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL)
        checkAscii('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
        // eslint-disable-next-line no-console
        console.log('[diag] cookies length:', document.cookie.length, 'cookies:', document.cookie.slice(0, 200))
        // eslint-disable-next-line no-console
        console.log('[diag] isAscii(displayName)=', isAscii, ', will send b64=', !isAscii)
      }

      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          // 이메일 인증 완료 후 OAuth callback 라우트로 (Phase 2 — Supabase 자동 처리)
          emailRedirectTo: `${origin}/api/auth/callback`,
          // raw_user_meta_data — handle_new_user() 트리거가 user_profiles 생성 시 사용
          data: {
            // ASCII: 직접 / 비-ASCII (한글 등): base64 marker 만 (헤더 ISO-8859-1 안전)
            ...(isAscii
              ? { display_name: trimmedName }
              : { display_name_b64: encodeDisplayNameB64(trimmedName) }),
            locale: 'ko',
            // TODO Phase 3: user_consents 테이블 정식 마이그레이션 후 분리 저장
            consented_terms_at: consentTimestamp,
            consented_privacy_at: consentTimestamp,
            consented_marketing_at: agreeMarketing ? consentTimestamp : null,
          },
        },
      })

      if (error) {
        // 개발 환경에서만 원본 에러 노출 — 디버깅 편의
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.error('[signup] Supabase error:', {
            message: error.message,
            status: error.status,
            name: error.name,
          })
        }
        setAuthError(mapSignupError(error.message))
        return
      }

      // 성공 → /verify-email (이메일 인증 안내 화면)
      toast.success('가입 완료! 이메일을 확인해주세요.', {
        title: '환영합니다 🎉',
      })
      router.push(`/verify-email?email=${encodeURIComponent(email.trim())}`)
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.error('[signup] unexpected:', err)
      }
      setAuthError(mapSignupError(err instanceof Error ? err.message : null))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card variant="elevated" padding="lg" className="rounded-xl">
      {/* ── 헤더 영역 ── */}
      <div className="mb-s-8 text-center">
        {/* 미니멀 라벨 (Linear 톤) */}
        <p className="mb-s-3 font-mono text-[10px] uppercase tracking-[0.15em] text-t3">
          14일 무료 체험 · 결제 정보 불필요
        </p>

        <h1 className="mb-s-2 font-display text-2xl font-extrabold leading-[1.1] tracking-[-0.02em] text-t1 sm:text-3xl">
          영어 학습을
          <br />
          시작하세요
        </h1>
        <p className="font-body text-sm text-t2">
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="font-semibold text-p underline-offset-4 hover:underline">
            로그인
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

      {/* ── 이메일/비밀번호 폼 ── */}
      <form onSubmit={handleSubmit} className="space-y-s-4">
        {/* 이름 (display_name) */}
        <FormField
          label="이름"
          required
          error={nameError}
          helper={!nameError ? '학습 화면에 표시됩니다 (2~20자)' : undefined}
        >
          {(props) => (
            <Input
              type="text"
              placeholder="홍길동"
              prefix={<UserIcon size={16} />}
              state={nameError ? 'error' : 'default'}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="name"
              maxLength={20}
              {...props}
            />
          )}
        </FormField>

        {/* 이메일 */}
        <FormField
          label="이메일"
          required
          error={emailError}
          helper={!emailError ? '로그인에 사용됩니다' : undefined}
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
              {...props}
            />
          )}
        </FormField>

        {/* 비밀번호 */}
        <div>
          <FormField
            label="비밀번호"
            required
            error={passwordError}
            helper={!passwordError && !password ? '8자 이상, 영문과 숫자 포함' : undefined}
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
                autoComplete="new-password"
                {...props}
              />
            )}
          </FormField>

          {/* 비밀번호 강도 */}
          {password && !passwordError && (
            <div className="mt-s-2 space-y-s-1">
              <ProgressBar value={strength.score} max={4} color={strength.color} size="xs" />
              <p
                className={`text-right font-mono text-[10px] uppercase tracking-[0.1em] ${
                  strength.color === 'error'
                    ? 'text-error'
                    : strength.color === 'warning'
                      ? 'text-warning'
                      : 'text-success'
                }`}
              >
                강도: {strength.label}
              </p>
            </div>
          )}
        </div>

        {/* 약관 — 미니멀 박스 */}
        <div className="space-y-s-2 rounded-lg border border-bd bg-bg2 p-s-4">
          <Checkbox
            label={
              <span className="font-body text-sm text-t1">
                <span className="mr-s-1 text-error">*</span>
                <Link
                  href="/terms"
                  target="_blank"
                  className="text-p underline-offset-2 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  이용약관
                </Link>
                에 동의합니다
              </span>
            }
            checked={agreeTerms}
            onChange={(e) => setAgreeTerms(e.target.checked)}
            error={!!termsError && !agreeTerms}
          />
          <Checkbox
            label={
              <span className="font-body text-sm text-t1">
                <span className="mr-s-1 text-error">*</span>
                <Link
                  href="/privacy"
                  target="_blank"
                  className="text-p underline-offset-2 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  개인정보 처리방침
                </Link>
                에 동의합니다
              </span>
            }
            checked={agreePrivacy}
            onChange={(e) => setAgreePrivacy(e.target.checked)}
            error={!!termsError && !agreePrivacy}
          />
          <Checkbox
            label={<span className="font-body text-sm text-t2">마케팅 정보 수신 동의 (선택)</span>}
            checked={agreeMarketing}
            onChange={(e) => setAgreeMarketing(e.target.checked)}
          />
          {termsError && (
            <p className="pt-s-1 font-mono text-[10px] uppercase tracking-[0.1em] text-error">
              {termsError}
            </p>
          )}
        </div>

        {/* CTA — Primary 강조 */}
        <button
          type="submit"
          disabled={loading}
          className={`group relative mt-s-2 flex h-12 w-full items-center justify-center gap-s-2 rounded-md bg-p font-display text-sm font-semibold tracking-[-0.005em] text-ti shadow-sm transition-all duration-normal hover:bg-p-hover hover:shadow-md active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {loading ? (
            <>
              <span className="border-current/30 h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-t-current" />
              <span>가입 중...</span>
            </>
          ) : (
            <>
              <span>가입하고 학습 시작하기</span>
              <ArrowRight
                size={16}
                className="transition-transform duration-normal group-hover:translate-x-0.5"
              />
            </>
          )}
        </button>

        {/* 푸터 안내 */}
        <p className="pt-s-2 text-center font-mono text-[10px] uppercase tracking-[0.1em] text-t3">
          14일 무료 · 언제든 해지 가능
        </p>
      </form>
    </Card>
  )
}
