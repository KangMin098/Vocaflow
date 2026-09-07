// apps/web/src/app/(auth)/login/page.tsx
// 로그인 — Parts Kit + Linear/Vercel 미니멀
// v5: 복귀 경로·에러 매핑·입력 검증을 lib/auth/* 공유 모듈로 이관 (중복 3벌 제거).
//     소셜 버튼은 Supabase provider 전원 미설정이라 제거 — provider 설정 시 git 이력 복원.

'use client'

import { AlertCircle, ArrowRight, Lock, Mail } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'

import { Card } from '@/components/ui/Card'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { blockedReasonCode, isUsableAccount } from '@/lib/auth/account'
import {
  DELETED_MESSAGE,
  SUSPENDED_MESSAGE,
  mapAuthError,
  mapCallbackError,
} from '@/lib/auth/errors'
import { resolveReturnTo } from '@/lib/auth/redirect'
import { isValidEmail } from '@/lib/auth/validation'
import { createClient } from '@/lib/supabase/client'

// ══════════════════════════════════════════════════════════════
// Form — useSearchParams 를 쓰므로 Suspense 안쪽에 둔다
// ══════════════════════════════════════════════════════════════
function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  /** 인증 실패 인라인 배너 메시지 — null 이면 미표시 */
  const [authError, setAuthError] = useState<string | null>(() => {
    // /api/auth/callback 에서 ?error=... 코드로 redirect 됨
    // 미들웨어가 정지 계정을 되돌려보낼 때도 같은 파라미터를 쓴다
    const code = searchParams.get('error')
    if (code === 'suspended') return SUSPENDED_MESSAGE
    if (code === 'deleted') return DELETED_MESSAGE
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
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) {
        setAuthError(mapAuthError(error.message))
        return
      }

      // ── 계정 상태 확인 — 정지·해지 계정은 자격증명이 맞아도 들여보내지 않는다 ──
      // (미들웨어도 매 요청 검사하지만, 여기서 막아야 사용자가 사유를 즉시 본다)
      if (data.user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('status')
          .eq('user_id', data.user.id)
          .maybeSingle()

        const status = (profile as { status?: string | null } | null)?.status
        if (!isUsableAccount(status)) {
          await supabase.auth.signOut()
          setAuthError(blockedReasonCode(status) === 'deleted' ? DELETED_MESSAGE : SUSPENDED_MESSAGE)
          return
        }
      }

      // 로그인 성공 → 복귀 경로 (next·returnTo·redirect 별칭 모두 수용, open redirect 차단)
      //
      // ⚠️ `push` 가 아니라 `replace` 다 — 히스토리에서 로그인 화면을 지운다.
      //    `push` 였을 때는 복귀 직후 **뒤로가기 한 번**이면 `/login?next=…` 가 다시 떴다:
      //    이미 로그인한 사람에게 로그인 폼이 보이고(미들웨어는 인증 사용자를 인증 화면에서
      //    내보내지 않는다), 거기서 다시 제출하면 무의미한 재인증이다.
      //    같은 저장소의 `reset-password/page.tsx` 는 이 자리에서 이미 `replace` 를 쓴다.
      router.replace(resolveReturnTo(searchParams))
      router.refresh() // Server Component 재실행 (인증 컨텍스트 갱신)
    } catch (err) {
      setAuthError(mapAuthError(err instanceof Error ? err.message : null))
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
          // Next 의 __next-route-announcer__ 도 role=alert 라 테스트에서 충돌한다 — 고유 훅을 준다
          data-testid="auth-error"
          className="mb-s-4 flex items-start gap-s-2 rounded-md border border-error/30 bg-error-light px-s-3 py-s-3 font-body text-sm text-error"
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
              /* 73×13 이었다 — 44px 미만 탭 대상이었다(CLAUDE.md 절대 금지 · 실측 390px). 비밀번호를 잊은 사람이 누르는 유일한 길이다. */
              className="inline-flex min-h-[44px] items-center font-mono text-[10px] uppercase tracking-[0.1em] text-t3 transition-colors duration-normal hover:text-p"
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

        {/* CTA */}
        <button
          type="submit"
          disabled={loading}
          className={`group relative mt-s-2 flex h-12 w-full items-center justify-center gap-s-2 rounded-md bg-p font-display text-sm font-semibold tracking-[-0.005em] text-[var(--on-p)] shadow-sm transition-all duration-normal hover:bg-p-hover hover:shadow-md active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60`}
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

        {/* 푸터 — 세션은 Supabase refresh token 이 자동 연장한다 (별도 "로그인 유지" 토글 없음) */}
        <p className="pt-s-2 text-center font-mono text-[10px] uppercase tracking-[0.1em] text-t3">
          안전한 인증 · 산업 표준 암호화
        </p>
      </form>
    </Card>
  )
}

/** useSearchParams 사용 컴포넌트를 감싸는 로딩 골격 (Suspense fallback). */
function LoginSkeleton() {
  return (
    <Card variant="elevated" padding="lg" className="rounded-xl">
      <div className="flex h-72 items-center justify-center">
        <span
          className="border-current/30 h-5 w-5 animate-spin rounded-full border-2 border-t-current text-t3"
          role="status"
          aria-label="로그인 화면 준비 중"
        />
      </div>
    </Card>
  )
}

// ══════════════════════════════════════════════════════════════
// Page
// ══════════════════════════════════════════════════════════════
export default function LoginPage() {
  // useSearchParams 는 Suspense 경계가 없으면 페이지 전체가 CSR 로 이탈한다 (Next 14).
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginForm />
    </Suspense>
  )
}
