// apps/web/src/components/admin/TeacherFunnelPanel.tsx
//
// 교사 채널이 **어디서 끊기는가** — `RetentionPanel` 이 못 보는 두 구간.
//
// 리텐션 패널은 기존 테이블에서 파생한다. 그래서 **일어난 일**만 보인다.
// 여기는 반대로 **일어나지 않은 일**을 본다:
//   · 허브까지 왔는데 학급을 만들지 않았다
//   · 초대코드를 공유했는데 아무도 오지 않았다
// 10만 산술(교사 3,500명 × 학급 30명)이 성립하는지는 이 두 격차가 말한다.
//
// 규칙은 `RetentionPanel` 과 같다 — **표본이 작으면 비율을 그리지 않는다.**
// 몇 명 중 몇 명을 퍼센트로 인쇄하면 그 숫자가 근거처럼 읽힌다.
//
// ⚠️ 순수 모듈에서만 가져온다. `@/lib/admin/teacher-funnel` 은 `server-only`+`cache` 라
//    컴포넌트가 import 하면 vitest 가 스위트째 죽는다(이 리포에서 네 번째 같은 함정).

import { AlertTriangle } from 'lucide-react'

import { MIN_DENOMINATOR_FOR_RATE, rateOrNull } from '@/lib/admin/retention-math'

export interface TeacherFunnelGapsView {
  hubVisitors: number
  createdClass: number
  sharedInvite: number
  gotStudent: number
}

export function TeacherFunnelPanel({ gaps }: { gaps: TeacherFunnelGapsView | null }) {
  if (!gaps) {
    return (
      <div className="flex items-start gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[var(--warning)]" aria-hidden />
        <p className="font-body text-[13px] leading-relaxed text-[var(--t2)]">
          교사 구간을 읽지 못했어요 — <strong>0 이 아니라 &quot;못 쟀음&quot;</strong> 입니다.
        </p>
      </div>
    )
  }

  const { hubVisitors, createdClass, sharedInvite, gotStudent } = gaps
  const nothingYet = hubVisitors === 0 && sharedInvite === 0

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <GapCell
          label="허브에 왔고 → 학급을 만들었다"
          numerator={createdClass}
          denominator={hubVisitors}
          emptyHint="아직 /teacher 에 도달한 기록이 없어요"
        />
        <GapCell
          label="초대코드를 공유했고 → 학생이 왔다"
          numerator={gotStudent}
          denominator={sharedInvite}
          emptyHint="아직 초대코드를 공유한 기록이 없어요"
        />
      </div>

      <p className="font-body text-[11px] leading-relaxed text-[var(--t3)]">
        {nothingYet ? (
          <>
            두 수치는 <strong>배포 이후</strong>부터 쌓입니다. 이 화면이 0 인 것은 &quot;교사가
            안 온다&quot; 가 아니라 아직 <strong>관측 구간이 시작되지 않았다</strong>는 뜻입니다.
          </>
        ) : (
          <>
            분모는 기록(<code className="font-mono">funnel_events</code>), 분자는 실제 결과
            (<code className="font-mono">classes</code> ·{' '}
            <code className="font-mono">class_members</code>)에서 파생합니다 — 같은 수치를 두 곳에서
            세지 않습니다.
          </>
        )}
      </p>
    </div>
  )
}

function GapCell({
  label,
  numerator,
  denominator,
  emptyHint,
}: {
  label: string
  numerator: number
  denominator: number
  emptyHint: string
}) {
  const rate = rateOrNull(numerator, denominator)

  return (
    <div className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4">
      <p className="mb-2 font-body text-[11px] leading-snug text-[var(--t2)]">{label}</p>
      {denominator === 0 ? (
        <p className="font-body text-[12px] text-[var(--t3)]">{emptyHint}</p>
      ) : (
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[20px] font-[700] tabular-nums text-[var(--t1)]">
            {numerator.toLocaleString()} / {denominator.toLocaleString()}
          </span>
          {/* 표본이 작으면 비율을 그리지 않는다 — RetentionPanel 과 같은 규칙 */}
          {rate !== null && (
            <span className="font-mono text-[12px] tabular-nums text-[var(--t2)]">
              {Math.round(rate * 100)}%
            </span>
          )}
        </div>
      )}
      {denominator > 0 && denominator < MIN_DENOMINATOR_FOR_RATE && (
        <p className="mt-1 font-body text-[10px] text-[var(--t3)]">
          표본 {denominator} — 비율을 내기엔 적어 원수만 보여줍니다
        </p>
      )}
    </div>
  )
}
