// apps/web/src/components/wordvault/hub/VaultIdentity.tsx
//
// WordVault Section 1 (v06.36) — Activity Ring + 거대한 hero + 캡슐 메타.
// iOS Foundation 프리미티브 사용 (Card / Capsule / ActivityRing / PrimaryButton / StatPill).

import { ActivityRing, Capsule, Card, PrimaryButton, StatPill } from '@/components/ui/ios'
import type { MemoryState } from '@/lib/srs'
import { MEMORY_LABEL } from '@/lib/framework/memory-labels'

export interface VaultIdentityProps {
  total: number
  buckets: Record<MemoryState, number>
  collections: number
  accumulatedDays: number
  weeklyDone: number
  weeklyTarget: number
  /** 진단으로 정해진 현재 V-Level. 없으면 캡슐을 내지 않는다(없는 것을 지어내지 않는다). */
  vLevel: number | null
}

const NF = new Intl.NumberFormat('en-US')

// 4 메모리 상태 색 = iOS systemColor 1:1 (--memory-{stable/shaky/risk/new} 토큰과 정합)
// 학습 효과 — 의미별 명확 매핑 (green=달성, orange=주의, red=회복, gray=중립)
const BUCKET_META: Record<
  MemoryState,
  { label: string; color: string; accent: 'green' | 'orange' | 'red' | 'neutral' }
> = {
  stable: { label: MEMORY_LABEL.stable.label, color: 'var(--memory-stable)', accent: 'green' },
  shaky: { label: MEMORY_LABEL.shaky.label, color: 'var(--memory-shaky)', accent: 'orange' },
  risk: { label: MEMORY_LABEL.risk.label, color: 'var(--memory-risk)', accent: 'red' },
  new: { label: MEMORY_LABEL.new.label, color: 'var(--memory-new)', accent: 'neutral' },
}

export function VaultIdentity({
  total,
  buckets,
  collections,
  accumulatedDays,
  weeklyDone,
  weeklyTarget,
  vLevel,
}: VaultIdentityProps) {
  const goalPct = weeklyTarget > 0 ? Math.min(100, (weeklyDone / weeklyTarget) * 100) : 0
  const goalReached = weeklyTarget > 0 && weeklyDone >= weeklyTarget

  // CTA — **버튼은 한 자리에 한 행동이다. 상태에 따라 색을 바꾸지 않는다.**
  //
  // 이전에는 risk→critical(`--error`) · shaky→warning · new→info 로 세 색이 돌았다. 둘 다 문제였다:
  //   ① `--error` 는 **오류 색**인데 여기서 가리키는 것은 오류가 아니다. 밀린 복습은 FSRS 가
  //      정상 동작한 결과다. 잘못된 것이 없는데 잘못된 것처럼 칠하면, 학습자는 자기 학습을
  //      실패로 읽는다(§디자인철학3 Empathetic Feedback · §절대금지 "압박").
  //   ② 차분한 지면에서 **가장 큰 채도 덩어리**가 이 배너 하나였다. 화면 전체가 그쪽으로
  //      기울어 나머지 여섯 섹션이 배경처럼 밀렸다(실측 2026-08-16 캡처).
  // 긴급도는 이미 **문구**("지금 다시 만나기" vs "새 단어 익히기")와 바로 위 4버킷 수치가
  // 말한다. 같은 정보를 버튼 색으로 한 번 더 소리칠 이유가 없다.
  let ctaLabel = '단어 둘러보기'
  let ctaHref = '/wordvault/browse'
  let ctaCount = 0
  if (buckets.risk > 0) {
    ctaLabel = '지금 다시 만나기'
    ctaHref = `/wordvault/browse?filter=state:risk`
    ctaCount = buckets.risk
  } else if (buckets.shaky > 0) {
    ctaLabel = '익숙해지는 단어 다지기'
    ctaHref = `/wordvault/browse?filter=state:shaky`
    ctaCount = buckets.shaky
  } else if (buckets.new > 0) {
    ctaLabel = '새 단어 익히기'
    ctaHref = `/wordvault/browse?filter=state:new`
    ctaCount = buckets.new
  }

  return (
    <Card aria-label="내 어휘 자산" size="lg">
      {/* Hero row */}
      <div className="grid items-center gap-6 sm:grid-cols-[auto_1fr]">
        <ActivityRing
          pct={goalPct}
          reached={goalReached}
          capLabel="이번 주"
          centerValue={weeklyDone}
          centerSub={`/ ${weeklyTarget}`}
          ariaLabel={`이번 주 ${weeklyDone} / ${weeklyTarget}`}
        />

        <div className="flex flex-col gap-3">
          <div className="flex items-end gap-3">
            <span className="font-editorial text-[72px] font-[500] tabular-nums leading-[0.95] tracking-[-0.022em] text-[var(--t1)] md:text-[96px]">
              {NF.format(total)}
            </span>
            <span className="mb-2 font-body text-[14px] font-[500] text-[var(--t2)]">단어</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {vLevel != null && <Capsule label="수준" value={`V${vLevel}`} tone="brand" />}
            <Capsule label="단어장" value={`${NF.format(collections)}권`} />
            <Capsule label="누적" value={`${NF.format(accumulatedDays)}일`} />
          </div>
        </div>
      </div>

      {/* 4 bucket — iOS Health Categories */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(['stable', 'shaky', 'risk', 'new'] as MemoryState[]).map((state) => {
          const meta = BUCKET_META[state]
          const count = buckets[state]
          const sharePct = total > 0 ? Math.round((count / total) * 100) : 0
          return (
            <StatPill
              key={state}
              label={meta.label}
              value={NF.format(count)}
              ratio={`${sharePct}%`}
              accent={meta.accent}
              dotColor={meta.color}
            />
          )
        })}
      </div>

      {/* 이 화면의 1차 행동 — 상태와 무관하게 항상 브랜드 색(위 주석 참조) */}
      <PrimaryButton href={ctaHref} tone="brand" count={ctaCount} className="mt-5">
        {ctaLabel}
      </PrimaryButton>
    </Card>
  )
}
