// apps/web/src/components/wordvault/hub/VaultBar.tsx
//
// VaultBar — Hero 내부 슬림 4색 누적 막대 (자산 규모 한눈에 인지)
// CLAUDE.md §17.2 [2] 상태 축 — 자산 분포 시각화 (Endowment Effect 강화)
//
// MemoryDecayDistribution 과 의도적 차별화:
//   VaultBar (Hero 내부)         | MemoryDecayDistribution (Tier 6)
//   ─────────────────────────────|──────────────────────────────────
//   목적: 자산 규모 한눈에 인지   | 건강 진단 + 추세 (TrendIndicator)
//   시각: 슬림 8px                | 큰 막대 + Bucket 4 카드
//   인터랙션: display only        | (Phase 2) Bucket 클릭 → 필터 진입
//
// 디자인 의도:
//   - 다크 배경(Hero) 위에 onDark=true → ti/15 트랙
//   - 라이트 배경 위에 onDark=false → bg3 트랙
//   - 색상: var(--memory-*) 토큰만 (하드코딩 X)
//   - role="img" + aria-label 풀텍스트 (스크린리더 정합)

import { MEMORY_LABEL } from '@/lib/framework/memory-labels'

interface VaultBarProps {
  stable: number
  shaky: number
  risk: number
  new: number
  /** 다크 배경(Hero) 위에서 렌더 시 true */
  onDark?: boolean
}

export function VaultBar({
  stable,
  shaky,
  risk,
  new: newCount,
  onDark = false,
}: VaultBarProps) {
  const total = stable + shaky + risk + newCount
  if (total === 0) return null

  const segments = [
    // 이름은 레지스트리에서 — 같은 화면 안에서 어휘가 갈리던 것을 막는다
    { key: 'stable', count: stable, color: 'var(--memory-stable)', label: MEMORY_LABEL.stable.label },
    { key: 'shaky', count: shaky, color: 'var(--memory-shaky)', label: MEMORY_LABEL.shaky.label },
    { key: 'risk', count: risk, color: 'var(--memory-risk)', label: MEMORY_LABEL.risk.label },
    { key: 'new', count: newCount, color: 'var(--memory-new)', label: MEMORY_LABEL.new.label },
  ].filter((s) => s.count > 0)

  const trackClass = onDark ? 'bg-[var(--ti)]/15' : 'bg-[var(--bg3)]'
  const labelClass = onDark ? 'text-[var(--ti)]/90' : 'text-[var(--t2)]'

  const a11yLabel = `총 ${total}단어 (안정 ${stable}, 흔들림 ${shaky}, 위급 ${risk}, 신규 ${newCount})`

  return (
    <div>
      {/* Bar */}
      <div
        role="img"
        aria-label={a11yLabel}
        className={`flex h-2 overflow-hidden rounded-[var(--r-full)] ${trackClass}`}
      >
        {segments.map((seg) => (
          <span
            key={seg.key}
            className="block h-full transition-[width] duration-[var(--dur-normal)]"
            style={{
              width: `${(seg.count / total) * 100}%`,
              backgroundColor: seg.color,
            }}
          />
        ))}
      </div>

      {/* Inline labels */}
      <div
        className={`mt-2 flex flex-wrap gap-x-3 gap-y-1 font-body text-[11px] font-[600] tracking-[-0.01em] ${labelClass}`}
      >
        {segments.map((seg) => (
          <span key={seg.key} className="inline-flex items-center gap-2">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: seg.color }}
              aria-hidden="true"
            />
            <span className="tabular-nums">{seg.count}</span>
            <span>{seg.label}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
