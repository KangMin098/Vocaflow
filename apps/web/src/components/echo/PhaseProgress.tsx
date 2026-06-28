// apps/web/src/components/echo/PhaseProgress.tsx
'use client'

type Phase = 'idle' | 'listening' | 'recording' | 'comparing' | 'scored'

interface Props {
  phase: Phase
  currentSentence: number
  totalSentences: number
}

const PHASES: { key: Phase; label: string }[] = [
  { key: 'listening', label: '① Listen' },
  { key: 'recording', label: '② Repeat' },
  { key: 'comparing', label: '③ Compare' },
  { key: 'scored', label: '④ Score' },
]

const PHASE_ORDER: Phase[] = ['idle', 'listening', 'recording', 'comparing', 'scored']

export function PhaseProgress({ phase, currentSentence, totalSentences }: Props) {
  const pct = totalSentences > 0 ? Math.round((currentSentence / totalSentences) * 100) : 0
  const activeIdx = PHASE_ORDER.indexOf(phase)

  return (
    <section className="flex flex-col gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-4 py-3">
      {/* Phase pills */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {PHASES.map((p) => {
            const isActive = phase === p.key
            const isPassed = activeIdx > PHASE_ORDER.indexOf(p.key)
            return (
              <span
                key={p.key}
                className={`inline-flex items-center rounded-[var(--r-full)] px-2 py-0.5 font-display text-[10px] font-[700] transition-colors ${
                  isActive
                    ? 'bg-[var(--p)] text-[var(--ti)]'
                    : isPassed
                      ? 'bg-[var(--success-light)] text-[var(--success)]'
                      : 'bg-[var(--bg3)] text-[var(--t3)]'
                }`}
              >
                {p.label}
              </span>
            )
          })}
        </div>
        <span className="font-mono text-[11px] text-[var(--t3)] tabular-nums">
          {currentSentence}/{totalSentences} · {pct}%
        </span>
      </div>
      {/* Sentence 진행 bar */}
      <div className="h-1 overflow-hidden rounded-full bg-[var(--bg3)]">
        <div
          className="h-full bg-[var(--p)] transition-[width] duration-[var(--dur-slow)]"
          style={{ width: `${pct}%` }}
          aria-hidden
        />
      </div>
    </section>
  )
}
