// apps/web/src/app/admin/vrl/_components/ResponsibilityCard.tsx
//
// R1-R4 공통 책임 카드.
// 사전DB 모니터링 v3 — Section 2 ResponsibilitiesSection 의 자식 컴포넌트.
//
// 역할:
//   - score (0-100) 큰 표시 + progress bar
//   - factors 분해 (weight + score + evidence)
//   - affected defects chip (Step 3 결함 자동 매핑)
//   - improvement primary action
//
// 색상 (LexiVault 정합 + 사용자 spec):
//   R1 blue gradient
//   R2 green gradient
//   R3 red gradient + glow ⭐ (본질 페인 부각)
//   R4 amber gradient

import { AlertTriangle, CheckCircle2, Clock3, BookOpen, FileText, Layers, Workflow, BookMarked } from 'lucide-react'
import type {
  CriticalDefect,
  ResponsibilityReadiness,
  ResponsibilityId,
} from '@/lib/admin/dict/types'

interface ResponsibilityCardProps {
  readiness: ResponsibilityReadiness
  /** snapshot.defects 전체 — id 기반 필터링 */
  defects: CriticalDefect[]
}

const ID_META: Record<
  ResponsibilityId,
  {
    label: string
    icon: typeof BookOpen
    accent: string
    accentSoft: string
    gradient: string
    ringClass: string
    description: string
  }
> = {
  R1: {
    label: 'Library Extraction',
    icon: BookOpen,
    accent: 'var(--p)', // blue
    accentSoft: 'var(--p-light)',
    gradient:
      'linear-gradient(135deg, var(--p) 0%, var(--p-dark) 100%)',
    ringClass: '',
    description: 'LCP 책 chapter 진입 시 단어 추출 (adaptive-extract.ts)',
  },
  R2: {
    label: 'Script Extraction',
    icon: FileText,
    accent: 'var(--success)', // green
    accentSoft: 'var(--success-light)',
    gradient:
      'linear-gradient(135deg, var(--success) 0%, #16a34a 100%)',
    ringClass: '',
    description: '사용자 텍스트 토큰화 후 lemma 매칭 (winkNLP + inflections)',
  },
  R3: {
    label: 'Wordset Publishing',
    icon: BookMarked,
    accent: 'var(--error)', // red — 본질 페인
    accentSoft: 'var(--error-light)',
    gradient:
      'linear-gradient(135deg, var(--error) 0%, #b91c1c 100%)',
    ringClass:
      'ring-2 ring-[var(--error)] shadow-[0_0_28px_rgba(239,68,68,0.18)]',
    description: 'VCB Pipeline — V-Level/CEFR/Track/Domain 별 단어장 빌드',
  },
  R4: {
    label: 'User Learning Content',
    icon: Layers,
    accent: 'var(--active)', // amber
    accentSoft: 'var(--warning-light)',
    gradient: 'linear-gradient(135deg, var(--active) 0%, #d97706 100%)',
    ringClass: '',
    description: 'Flashcard/SpellForge/WordBlitz/Dictation 학습 자산',
  },
}

const STATUS_META: Record<
  ResponsibilityReadiness['status'],
  { label: string; icon: typeof CheckCircle2; color: string; bg: string }
> = {
  excellent: { label: '우수', icon: CheckCircle2, color: 'var(--success)', bg: 'var(--success-light)' },
  ok: { label: '안정', icon: CheckCircle2, color: 'var(--success)', bg: 'var(--success-light)' },
  warning: { label: '주의', icon: Clock3, color: 'var(--active)', bg: 'var(--warning-light)' },
  critical: { label: '위급', icon: AlertTriangle, color: 'var(--error)', bg: 'var(--error-light)' },
}

const SEVERITY_DOT: Record<CriticalDefect['severity'], string> = {
  critical: 'var(--error)',
  warning: 'var(--active)',
  info: 'var(--info)',
}

export function ResponsibilityCard({ readiness, defects }: ResponsibilityCardProps) {
  const meta = ID_META[readiness.id]
  const status = STATUS_META[readiness.status]
  const StatusIcon = status.icon
  const Icon = meta.icon

  // 본 책임에 영향 주는 결함 추출 — impactsOn 직접 매칭
  const relatedDefects = defects.filter((d) => d.impactsOn.includes(readiness.id))

  // 최우선 improvement — 첫 번째 P0 결함의 improvement (없으면 P1, 그것도 없으면 null)
  const primaryImprovement =
    relatedDefects.find((d) => d.priority === 'P0' && d.improvement)?.improvement ??
    relatedDefects.find((d) => d.priority === 'P1' && d.improvement)?.improvement ??
    null

  return (
    <article
      aria-label={`${readiness.id} ${meta.label} readiness card`}
      className={`relative flex flex-col gap-4 rounded-[var(--r-xl)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)] transition-shadow duration-[var(--dur-normal)] hover:shadow-[var(--sh-md)] ${meta.ringClass}`}
    >
      {/* ── 헤더 ── */}
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--r-lg)] text-white shadow-[var(--sh-sm)]"
            style={{ background: meta.gradient }}
            aria-hidden
          >
            <Icon size={20} strokeWidth={1.75} />
          </span>
          <div>
            <p
              className="font-mono text-[10px] font-[700] uppercase tracking-[0.12em]"
              style={{ color: meta.accent }}
            >
              {readiness.id}
            </p>
            <h3 className="font-display text-[15px] font-[700] leading-tight text-[var(--t1)]">
              {meta.label}
            </h3>
          </div>
        </div>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-display text-[10px] font-[700]"
          style={{ backgroundColor: status.bg, color: status.color }}
        >
          <StatusIcon size={11} strokeWidth={2} aria-hidden />
          {status.label}
        </span>
      </header>

      {/* ── Score + Bar ── */}
      <div className="flex items-end gap-3">
        <p
          className="font-display text-[40px] font-[800] leading-none"
          style={{ color: meta.accent }}
        >
          {readiness.score}
        </p>
        <p className="mb-1 font-body text-[12px] text-[var(--t3)]">/ 100</p>
        <div className="ml-auto h-2 flex-1 max-w-[140px] overflow-hidden rounded-full bg-[var(--bg3)]">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{
              width: `${Math.max(0, Math.min(100, readiness.score))}%`,
              background: meta.gradient,
            }}
            aria-hidden
          />
        </div>
      </div>

      {/* ── Description ── */}
      <p className="font-body text-[12px] leading-relaxed text-[var(--t2)]">
        {meta.description}
      </p>

      {/* ── Factors ── */}
      <section
        className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-3"
        aria-label="readiness factors"
      >
        <h4 className="mb-2 font-display text-[10px] font-[700] uppercase tracking-[0.08em] text-[var(--t3)]">
          Factors ({readiness.factors.length})
        </h4>
        <ul className="flex flex-col gap-1.5">
          {readiness.factors.map((f) => {
            const fScorePct = Math.round(f.score * 100)
            const wPct = Math.round(f.weight * 100)
            const lowAlert = fScorePct < 30
            return (
              <li
                key={f.label}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 font-body text-[11px]"
              >
                <div className="min-w-0">
                  <p className="truncate font-display text-[11px] font-[600] text-[var(--t1)]">
                    {f.label}{' '}
                    <span className="font-mono text-[9px] font-[500] text-[var(--t3)]">
                      w={wPct}%
                    </span>
                  </p>
                  <p className="truncate text-[10px] text-[var(--t3)]">{f.evidence}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1 w-12 overflow-hidden rounded-full bg-[var(--bg3)]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${fScorePct}%`,
                        backgroundColor: lowAlert ? 'var(--error)' : meta.accent,
                      }}
                      aria-hidden
                    />
                  </div>
                  <span
                    className="w-9 text-right font-mono text-[10px] font-[700]"
                    style={{ color: lowAlert ? 'var(--error)' : 'var(--t2)' }}
                  >
                    {fScorePct}%
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      {/* ── Affected Defects ── */}
      {relatedDefects.length > 0 && (
        <section aria-label="affected critical defects">
          <h4 className="mb-2 font-display text-[10px] font-[700] uppercase tracking-[0.08em] text-[var(--t3)]">
            Affected Defects ({relatedDefects.length})
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {relatedDefects.map((d) => (
              <span
                key={d.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--bd)] bg-[var(--bg2)] px-2 py-1 font-mono text-[10px] text-[var(--t2)]"
                title={d.title}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: SEVERITY_DOT[d.severity] }}
                  aria-hidden
                />
                <span className="font-display font-[700]">[{d.priority}]</span>
                {d.id}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* ── Primary Improvement ── */}
      {primaryImprovement && (
        <section
          className="rounded-[var(--r-md)] border-l-[3px] p-3"
          style={{
            borderLeftColor: meta.accent,
            backgroundColor: meta.accentSoft,
          }}
          aria-label="primary improvement action"
        >
          <div className="flex items-center gap-2">
            <Workflow size={13} strokeWidth={2} style={{ color: meta.accent }} aria-hidden />
            <h4
              className="font-display text-[10px] font-[700] uppercase tracking-[0.08em]"
              style={{ color: meta.accent }}
            >
              Primary Action
              {primaryImprovement.backlogId && (
                <span className="ml-1.5 rounded-full bg-[var(--bg)] px-1.5 py-0.5 text-[9px]">
                  {primaryImprovement.backlogId}
                </span>
              )}
            </h4>
          </div>
          <p className="mt-1.5 font-body text-[12px] font-[600] leading-snug text-[var(--t1)]">
            {primaryImprovement.action}
          </p>
          <div className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 font-body text-[10px] text-[var(--t2)]">
            <span className="font-mono text-[var(--t3)]">cost</span>
            <span>{primaryImprovement.cost}</span>
            <span className="font-mono text-[var(--t3)]">effect</span>
            <span>{primaryImprovement.effect}</span>
          </div>
        </section>
      )}
    </article>
  )
}
