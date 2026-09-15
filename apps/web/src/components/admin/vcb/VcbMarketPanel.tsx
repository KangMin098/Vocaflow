// apps/web/src/components/admin/vcb/VcbMarketPanel.tsx
//
// **시중 대비 지수 패널 — 콘솔에서 우위 여부를 본다.**
//
// 값을 여기서 계산하지 않는다. `readVcbMarketStatus()` 가 리포트를 읽고, 이 파일은 그린다 —
// 계산을 두 벌 두면 화면과 리포트가 다른 수를 말하게 된다.
//
// 낡음을 숨기지 않는다: 며칠 지났는지, 무엇을 잰 값인지(렌더된 화면인가 DB 조건인가),
// 표본이 몇 권인지 함께 적는다. 숫자만 크게 띄우면 그 숫자가 언제 것인지 아무도 모른다.

import { ceilingNote } from '@/lib/vcb/market-panel-text'
import { ageInDays, type VcbMarketStatus } from '@/lib/vcb/server/market-status'

export function VcbMarketPanel({ status }: { status: VcbMarketStatus }) {
  if (status.problem) {
    return (
      <section
        aria-label="시중 대비 지수"
        className="mb-6 rounded-[var(--r-md)] border border-[var(--bd)] px-4 py-3"
      >
        <p className="font-display text-[12px] font-[700] text-[var(--t2)]">시중 대비 지수</p>
        <p className="mt-1 font-body text-[12px] text-[var(--t3)]">{status.problem}</p>
      </section>
    )
  }

  const age = ageInDays(status.generatedAt)
  const stale = age != null && age >= 7

  return (
    <section
      aria-label="시중 대비 지수"
      className="mb-6 rounded-[var(--r-md)] border border-[var(--bd)] px-4 py-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-display text-[12px] font-[700] uppercase tracking-wider text-[var(--t2)]">
          시중 단어장 대비
        </p>
        <p className="font-body text-[11px] text-[var(--t3)]">
          {status.generatedAt ? status.generatedAt.slice(0, 10) : '시각 미상'}
          {age != null && ` · ${age}일 전`}
          {stale && ' · 낡았다'}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span
          className="font-mono text-[28px] font-[700] leading-none"
          style={{ color: status.pass ? 'var(--success)' : 'var(--warning)' }}
        >
          {status.overall?.toFixed(3) ?? '—'}
        </span>
        <span className="font-body text-[12px] text-[var(--t2)]">
          종합 (기하평균 {status.axes.length}축) · 목표 {status.goal}
        </span>
      </div>

      <ul className="mt-3 flex flex-col gap-1.5">
        {status.axes.map((a) => (
          <li key={a.id} className="grid grid-cols-[16px_84px_64px_minmax(0,1fr)] items-baseline gap-2">
            <span aria-hidden style={{ color: a.ok ? 'var(--success)' : 'var(--warning)' }}>
              {a.ok ? '●' : '○'}
            </span>
            <span className="font-body text-[12px] text-[var(--t1)]">{a.label}</span>
            <span className="font-mono text-[12px] text-[var(--t2)]">{a.index.toFixed(3)}</span>
            <span className="font-body text-[11px] text-[var(--t3)]">
              {ceilingNote(a.ceiling)}
              {a.says ? ` · ${a.says}` : ''}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 font-body text-[11px] leading-relaxed text-[var(--t3)]">
        {status.choiceBasis === 'rendered'
          ? `선택·지면 지수는 학습자가 실제로 여는 화면에서 잰 값입니다 (표본 ${status.sheetsMeasured ?? '?'}권).`
          : status.choiceBasis === 'catalog'
            ? '⚠️ 선택 지수가 DB 조건으로 세어졌습니다 — 학습자가 그 화면을 여는지는 확인하지 않은 값입니다.'
            : '선택 지수 리포트가 없어 무엇을 잰 값인지 알 수 없습니다.'}
      </p>
    </section>
  )
}
