// apps/web/src/app/(auth)/signup/page.tsx
// 회원가입 v4 — 실제 Supabase 연결 (이메일 단일. 소셜 provider 전원 미설정이라 제거)
//
// 가입 흐름:
//   1) 폼 검증 (email/password/displayName/약관) — lib/auth/validation.ts 공유 규칙
//   2) supabase.auth.signUp({ email, password, options: { data, emailRedirectTo } })
//   3) DB 트리거 handle_new_user() 가 auth.users INSERT 후 public.user_profiles row 생성
//      (display_name_b64 를 우선 디코드 — 한글 이름 보존. 실측 확인)
//   4) **세션 유무로 분기** (v06.140 수정):
//        - session 있음 → 이미 로그인 완료 (프로젝트가 mailer_autoconfirm=true) → /hub
//        - session 없음 → 메일 인증 대기 → /verify-email
//      예전엔 무조건 /verify-email 로 보내서, 자동 확인이 켜진 현재 설정에선
//      **이미 로그인된 사용자에게 "메일을 확인하세요" 라는 오지 않을 메일을 기다리게** 했다.
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
import { mapSignupError } from '@/lib/auth/errors'
import {
  DISPLAY_NAME_MAX_LENGTH,
  encodeDisplayNameB64,
  getPasswordStrength,
  isAsciiPrintable,
  isValidEmail,
  validateDisplayName,
  validatePassword,
} from '@/lib/auth/validation'
import { createClient } from '@/lib/supabase/client'

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

  const passwordError = submitted ? (validatePassword(password) ?? undefined) : undefined
  const nameError = submitted ? (validateDisplayName(displayName) ?? undefined) : undefined
  const termsError =
    submitted && (!agreeTerms || !agreePrivacy) ? '필수 약관에 동의해주세요' : undefined

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setAuthError(null)

    const trimmedName = displayName.trim()

    if (
      !isValidEmail(email) ||
      validatePassword(password) !== null ||
      validateDisplayName(trimmedName) !== null ||
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
      // 이전 시도가 남긴 세션 토큰의 user_metadata 한글이 다음 fetch 헤더로 흘러
      // ISO-8859-1 검증을 실패시키는 케이스 방지. signUp 은 unauth 요청이므로 먼저 비운다.
      try {
        await supabase.auth.signOut({ scope: 'local' })
      } catch {
        // 세션이 없으면 그냥 진행
      }

      const consentTimestamp = new Date().toISOString()
      // 한글 등 비-ASCII 이름은 base64 로 (트리거가 display_name_b64 를 우선 디코드)
      const asciiName = isAsciiPrintable(trimmedName)

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${origin}/api/auth/callback`,
          // raw_user_meta_data — handle_new_user() 트리거가 user_profiles 생성 시 사용
          data: {
            ...(asciiName
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
        setAuthError(mapSignupError(error.message))
        return
      }

      // ── 이미 가입된 이메일의 "조용한 가짜 성공" 방어 ──
      // 이메일 확인이 켜진 설정에서 Supabase 는 계정 열거를 막으려고 에러 대신
      // identities: [] 인 사용자를 돌려준다. 이 신호를 놓치면 기존 회원이
      // 오지 않을 메일을 기다리게 된다. (현 프로젝트는 autoconfirm=true 라 422 가
      // 오지만, 설정이 바뀌어도 깨지지 않도록 두 경로를 모두 처리한다.)
      if (data.user && (data.user.identities?.length ?? 0) === 0) {
        setAuthError('이미 가입된 이메일입니다')
        return
      }

      // ── 세션 유무로 분기 ──
      if (data.session) {
        // 자동 확인(mailer_autoconfirm) — 이미 로그인 상태다. 대기 화면은 거짓말이 된다.
        toast.success('가입이 완료되었어요. 바로 시작해볼까요?', { title: '환영합니다 🎉' })
        router.push('/hub')
        router.refresh()
        return
      }

      // 메일 인증 대기 — /verify-email 에서 재발송 안내
      toast.success('가입 완료! 이메일을 확인해주세요.', { title: '환영합니다 🎉' })
      router.push(`/verify-email?email=${encodeURIComponent(email.trim())}`)
    } catch (err) {
      setAuthError(mapSignupError(err instanceof Error ? err.message : null))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card variant="elevated" padding="lg" className="rounded-xl">
      {/* ── 헤더 영역 ── */}
      <div className="mb-s-8 text-center">
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
          // Next 의 __next-route-announcer__ 도 role=alert 라 테스트에서 충돌한다 — 고유 훅을 준다
          data-testid="auth-error"
          className="mb-s-4 flex items-start gap-s-2 rounded-md border border-error/30 bg-error-light px-s-3 py-s-3 font-body text-sm text-error"
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
              maxLength={DISPLAY_NAME_MAX_LENGTH}
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
