// apps/web/src/components/admin/vcb/VcbProductionPanel.tsx
//
// **제작 단계 콘솔 — 발행 뒤에 남은 일이 어디까지 됐나.**
//
// 8-step run 은 `VcbRunProgress` 가 국면을 보여 준다. 그 뒤의 제작(각인·브랜드)은 전부
// Claude Code 드레인으로 도는데 **어디에도 진행이 안 보였다** — 아는 방법이 로컬 파일과
// SQL 뿐이었다. 이 패널이 그 자리다.
//
// 세 가지를 말한다: ① 단계마다 몇 권이 됐나 ② **지금 누구 차례인가**(사용자 ↔ Claude Code)
// ③ 아직인 권의 **이름**과 다음 한 걸음. 개수만 세면 무엇을 고칠지 알 수 없다.

import { Check, Terminal, User } from 'lucide-react'

import type { ProductionStatus } from '@/lib/vcb/server/production'
import { currentStage } from '@/lib/vcb/production-stages'

const ACTOR = {
  user: { icon: User, label: '사람 차례' },
  'claude-code': { icon: Terminal, label: 'Claude Code 차례' },
} as const

export function VcbProductionPanel({ status }: { status: ProductionStatus }) {
  if (status.problem) {
    return (
      <section
        aria-label="제작 단계"
        className="mb-6 rounded-[var(--r-md)] border border-[var(--bd)] px-4 py-3"
      >
        <p className="font-display text-[12px] font-[700] text-[var(--t2)]">제작 단계</p>
        <p className="mt-1 font-body text-[12px] text-[var(--t3)]">{status.problem}</p>
      </section>
    )
  }

  const now = currentStage(status.stages)

  return (
    <section
      aria-label="제작 단계"
      className="mb-6 rounded-[var(--r-md)] border border-[var(--bd)] px-4 py-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-display text-[12px] font-[700] uppercase tracking-wider text-[var(--t2)]">
          제작 단계 · 발행 {status.sets}권
        </p>
        <p className="font-body text-[11px] text-[var(--t3)]">
          {now ? `지금 ${ACTOR[now.actor].label} — ${now.label}` : '남은 단계 없음'}
        </p>
      </div>

      <ol className="mt-3 flex flex-col gap-2">
        {status.stages.map((s) => {
          const complete = s.doneCount >= s.total
          const Icon = ACTOR[s.actor].icon
          const isNow = now?.id === s.id
          return (
            <li
              key={s.id}
              className="rounded-[var(--r-sm)] px-2 py-1.5"
              style={isNow ? { background: 'var(--bg2)' } : undefined}
            >
              <div className="grid grid-cols-[16px_minmax(0,1fr)_auto] items-baseline gap-2">
                <span
                  aria-hidden
                  style={{ color: complete ? 'var(--success)' : 'var(--warning)' }}
                  className="text-[11px]"
                >
                  {complete ? <Check size={12} /> : '○'}
                </span>
                <span className="font-body text-[12.5px] text-[var(--t1)]">
                  {s.label}
                  <span className="ml-2 inline-flex items-center gap-1 font-body text-[10.5px] text-[var(--t3)]">
                    <Icon size={10} aria-hidden />
                    {ACTOR[s.actor].label}
                  </span>
                </span>
                <span className="font-mono text-[11.5px] text-[var(--t2)] tabular-nums">
                  {s.doneCount}/{s.total}
                </span>
              </div>

              {/*
                아직인 단계만 이유와 다음 걸음을 편다. 끝난 단계까지 다 펴면 콘솔이
                할 일을 가린다 — 화면은 "남은 것" 을 먼저 말해야 한다.
              */}
              {!complete && (
                <div className="mt-1 pl-[24px]">
                  <p className="font-body text-[11.5px] leading-relaxed text-[var(--t3)]">{s.says}</p>
                  {s.pending.length > 0 && (
                    <p className="mt-0.5 font-body text-[11.5px] text-[var(--t2)]">
                      아직: {s.pending.join(' · ')}
                      {s.pendingMore > 0 && ` 외 ${s.pendingMore}권`}
                    </p>
                  )}
                  <p className="mt-1 break-all rounded-[3px] bg-[var(--bg3)] px-2 py-1 font-mono text-[10.5px] leading-relaxed text-[var(--t2)]">
                    {s.next}
                  </p>
                </div>
              )}
            </li>
          )
        })}
      </ol>

      <p className="mt-3 font-body text-[11px] leading-relaxed text-[var(--t3)]">
        표지·지면·설명은 단계가 아니다 — 각인 없이 <b>요청 시 코드가 그린다</b>. 늘 100%인 줄을
        세 개 더 두면 이 콘솔이 실제 할 일을 가린다.
      </p>
    </section>
  )
}
