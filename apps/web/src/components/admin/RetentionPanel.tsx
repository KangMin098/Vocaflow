// apps/web/src/components/admin/RetentionPanel.tsx
//
// 학습자 활성화·리텐션 패널 — `docs/PLATFORM_AUDIT.md` F4 의 계측 표면.
//
// 이 패널의 규칙은 둘이다.
//   1. **표본이 작으면 비율을 그리지 않는다.** 3명 중 1명을 "33%" 로 인쇄하는 순간 그 숫자는 근거처럼 읽히고,
//      진단 문서가 경계하는 "문서의 수치를 근거로 쓰는" 사고가 시작된다. 분모가 기준 미만이면 **원수(N/M)** 만 낸다.
//   2. **검증된 외부 학습자만 센다**(VG-L3-D1-02). 내부(운영·개발·QA)·미분류 계정은 수만 따로 보인다.
//      외부 0 은 「외부 학습자가 없다」가 아니라 「**확인된** 외부 학습자가 없다」다 — 미분류가 있으면 그렇게 말한다.
//
// 순수 재방문(학습 없는 조회)은 재지 않는다 — 이유는 `lib/admin/retention-math.ts` 머리주석.
// 이 컴포넌트는 계정 ID·이메일·분류 목록을 **받지 않는다**(props 는 수만 담는다).

import { AlertTriangle } from 'lucide-react'

// ⚠️ **순수 모듈에서 직접 가져온다.** `@/lib/admin/retention` 은 `server-only` 라, 컴포넌트가 그쪽을
//    import 하면 vitest 가 스위트째 죽는다(이 리포에서 세 번째로 겪은 같은 함정 — `growth-math` · `gateway-state` 와 동일).
import type { AccountSummary } from '@/lib/admin/account-classification'
import { MIN_DENOMINATOR_FOR_RATE, rateOrNull, type RetentionResult } from '@/lib/admin/retention-math'

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4">
      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[var(--warning)]" aria-hidden />
      <div className="font-body text-[13px] leading-relaxed text-[var(--t2)] [word-break:keep-all]">{children}</div>
    </div>
  )
}

export function RetentionPanel({ report: result }: { report: RetentionResult | null }) {
  if (!result) {
    return (
      <Notice>
        리텐션을 계산하지 못했어요. <code className="font-mono text-[12px]">SUPABASE_SERVICE_ROLE_KEY</code> 가 없으면
        가입자 목록을 읽을 수 없습니다 — <strong>0 이 아니라 &quot;못 쟀음&quot;</strong> 입니다.
      </Notice>
    )
  }

  if (result.status === 'unavailable') {
    return (
      <Notice>
        <p>
          <strong>계산 불가 — 계정 분류 설정이 잘못됐습니다.</strong> 실사용 학습자를 가를 수 없어서 0 으로 내리지
          않고 멈췄습니다.
        </p>
        <ul className="mt-1 list-disc pl-5">
          {result.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      </Notice>
    )
  }

  const { accounts, report } = result
  const { signups, activated, medianDaysToFirstLearn, returned, eligible, active } = report

  return (
    <div className="flex flex-col gap-3">
      <AccountsRow accounts={accounts} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Cell label="실사용 가입자 (검증된 외부)" value={signups.toLocaleString()} />
        <Cell
          label="활성화 (한 번이라도 학습)"
          value={`${activated.toLocaleString()} / ${signups.toLocaleString()}`}
          rate={rateOrNull(activated, signups)}
        />
        <Cell
          label="가입 → 첫 학습"
          value={
            medianDaysToFirstLearn === null
              ? '—'
              : medianDaysToFirstLearn === 0
                ? '당일'
                : `중앙값 ${medianDaysToFirstLearn}일`
          }
          hint="이 값이 크면 리텐션이 아니라 활성화 문제다"
        />
        <Cell
          label="최근 7일 학습자"
          value={`${active.d7.toLocaleString()}명`}
          hint={`28일 ${active.d28.toLocaleString()}명`}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {(['d1', 'd7', 'd30'] as const).map((k) => (
          <Cell
            key={k}
            label={`${k.toUpperCase()} 복귀 학습`}
            value={`${returned[k].toLocaleString()} / ${eligible[k].toLocaleString()}`}
            rate={rateOrNull(returned[k], eligible[k])}
            hint={
              eligible[k] === 0
                ? '아직 이 창이 지난 가입자가 없다'
                : '분모 = 가입 후 그만큼 지난 사람만'
            }
          />
        ))}
      </div>

      <p className="font-body text-[11.5px] leading-relaxed text-[var(--t3)] [word-break:keep-all]">
        <strong>활동 리텐션</strong>입니다 — 돌아와서 실제로 학습했는가. 학습 없는 페이지 조회는
        수집하지 않습니다. 분모가 {MIN_DENOMINATOR_FOR_RATE}명 미만이면 비율 대신 원수만
        표시합니다(작은 표본의 퍼센트는 근거가 아니라 착시). 내부·미분류 계정의 학습은 이 수치에 들어가지 않습니다.
      </p>
    </div>
  )
}

/** 계정 분류 요약 — 실사용(검증된 외부) · 내부 · 미분류. 수만 보인다. */
function AccountsRow({ accounts }: { accounts: AccountSummary }) {
  const warnings: string[] = []
  if (accounts.registry === 'not_configured') {
    warnings.push('계정 분류 목록이 설정되지 않았습니다 — 운영 역할만 내부로 빠지고 나머지는 미분류입니다.')
  }
  if (accounts.unknown > 0) {
    warnings.push(
      `미분류 ${accounts.unknown.toLocaleString()}명은 실사용 지표에서 제외했습니다 — 실사용 ${accounts.externalVerified.toLocaleString()}명은 「확인된」 외부 학습자 수입니다.` +
        (accounts.unknownInternalHint > 0
          ? ` 그중 ${accounts.unknownInternalHint.toLocaleString()}명은 이메일 도메인이 내부처럼 보입니다(목록 정비 대상 · 자동 판정 아님).`
          : ''),
    )
  }
  if (accounts.conflicts > 0) {
    warnings.push(
      `운영 역할인데 검증된 외부 목록에 오른 계정 ${accounts.conflicts.toLocaleString()}개를 내부로 판정했습니다 — 목록을 확인하세요.`,
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-3 sm:grid-cols-3" aria-label="계정 분류">
        <Cell
          label="실사용 (검증된 외부)"
          value={`${accounts.externalVerified.toLocaleString()}명`}
          hint={`전체 계정 ${accounts.total.toLocaleString()}개 중`}
        />
        <Cell label="내부 (운영·개발·QA)" value={`${accounts.internal.toLocaleString()}명`} hint="지표에서 제외" />
        <Cell label="미분류" value={`${accounts.unknown.toLocaleString()}명`} hint="지표에서 제외 — 확인되면 목록에 추가" />
      </div>
      {warnings.length > 0 && (
        <Notice>
          <ul className="list-disc pl-5">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Notice>
      )}
    </div>
  )
}

function Cell({
  label,
  value,
  rate,
  hint,
}: {
  label: string
  value: string
  rate?: number | null
  hint?: string
}) {
  return (
    <div className="flex flex-col gap-1 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4">
      <span className="font-mono text-[9.5px] font-[700] uppercase tracking-[0.12em] text-[var(--t3)]">
        {label}
      </span>
      <span className="flex items-baseline gap-2">
        <span className="font-display text-[19px] font-[800] leading-none tabular-nums text-[var(--t1)]">
          {value}
        </span>
        {/* 퍼센트는 **한 텍스트 노드**로 만든다 — `{expr}%` 로 두면 React 가 사이에 주석
            노드를 넣어 `40<!-- -->%` 가 되고, 문자열 단언·복사·스크린리더 낭독이 어긋난다. */}
        {rate !== null && rate !== undefined && (
          <span className="font-display text-[13px] font-[700] tabular-nums text-[var(--p)]">
            {`${Math.round(rate * 100)}%`}
          </span>
        )}
      </span>
      {hint && (
        <span className="font-body text-[11px] leading-snug text-[var(--t3)] [word-break:keep-all]">
          {hint}
        </span>
      )}
    </div>
  )
}
