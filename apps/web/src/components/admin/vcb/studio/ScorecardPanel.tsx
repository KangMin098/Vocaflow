// apps/web/src/components/admin/vcb/studio/ScorecardPanel.tsx
// 채점 결과 — 총점 · 7지표 · 면별 준비도 · 미달 원인 · 목차 미리보기.
//
// 미달 원인을 접어 두지 않는 이유: 이 화면의 값은 "지금 무엇을 고쳐야 하는가" 다.
// 점수만 보여주면 어드민은 왜 막혔는지 모르고, 모르면 force 로 넘긴다.

'use client'

import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import type { PreviewResult } from '@/lib/vcb/server/compose-studio'

const METRIC_LABEL: Record<string, string> = {
  fill: '면 충전',
  level_fit: '레벨 적합',
  noise: '잡음 없음',
  novelty: '신규성',
  organize: '목차 균형',
  blueprint_fit: '유형 적합',
  value: '학습 가치',
}

const FACET_SAYS: Record<string, string> = {
  recognize: '뜻을 보면 고를 수 있다',
  spell: '직접 쓸 수 있다',
  sound: '듣고 알 수 있다',
  build: '조각으로 나눌 수 있다',
  use: '문장에서 쓸 수 있다',
  fluency: '바로 나온다',
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`
}

export function ScorecardPanel({
  preview,
  passThreshold,
}: {
  preview: PreviewResult
  passThreshold: number
}) {
  if (!preview.ok) {
    return (
      <section
        className="rounded-[var(--r-lg)] border p-5"
        style={{ background: 'var(--error-light)', borderColor: 'var(--error)' }}
      >
        <p
          className="font-display text-sm font-semibold m-0 inline-flex items-center gap-2"
          style={{ color: 'var(--error)' }}
        >
          <AlertTriangle className="w-4 h-4" aria-hidden />
          조립 실패
        </p>
        <p className="font-body text-xs mt-2 mb-0" style={{ color: 'var(--error)' }}>
          {preview.error}
        </p>
      </section>
    )
  }

  const card = preview.scorecard
  if (!card) return null

  const passed = card.passed
  const accent = passed ? 'var(--success)' : 'var(--warning)'
  const funnel = preview.funnel as
    | {
        population: number
        after_filters: number
        after_subtract: number
        after_objective: number
        final: number
        dropped: Record<string, number>
      }
    | undefined

  const droppedTop = funnel
    ? Object.entries(funnel.dropped)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
    : []

  return (
    <section className="grid gap-5">
      {/* 총점 */}
      <div
        className="rounded-[var(--r-lg)] border p-5"
        style={{ background: 'var(--bg)', borderColor: accent }}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="flex items-center gap-3">
            {passed ? (
              <CheckCircle2 className="w-5 h-5" style={{ color: accent }} aria-hidden />
            ) : (
              <AlertTriangle className="w-5 h-5" style={{ color: accent }} aria-hidden />
            )}
            <span className="font-display text-2xl font-semibold" style={{ color: accent }}>
              {card.total.toFixed(2)}
            </span>
            <span className="font-body text-xs" style={{ color: 'var(--t3)' }}>
              통과선 {passThreshold.toFixed(2)}
            </span>
          </div>
          <span className="font-body text-xs" style={{ color: 'var(--t2)' }}>
            {preview.entry_count}단어 · {preview.group_count}개 목차
            {preview.timing_ms
              ? ` · 조립 ${Math.round((preview.timing_ms['resolve'] ?? 0) + (preview.timing_ms['compose'] ?? 0))}ms`
              : ''}
          </span>
        </div>

        {preview.evidence_line ? (
          <p
            className="font-body text-xs mt-3 mb-0 rounded-[var(--r-md)] p-2.5"
            style={{ background: 'var(--p-light)', color: 'var(--admin)' }}
          >
            {preview.evidence_line}
          </p>
        ) : null}

        {/* 7지표 */}
        <div
          className="mt-4 grid gap-2"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}
        >
          {card.metrics
            .filter((m) => m.weight > 0)
            .map((m) => (
              <div
                key={m.id}
                className="rounded-[var(--r-md)] p-2.5"
                style={{ background: 'var(--bg2)' }}
                title={m.note}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-display text-xs font-medium" style={{ color: 'var(--t2)' }}>
                    {METRIC_LABEL[m.id] ?? m.id}
                  </span>
                  <span
                    className="font-display text-sm font-semibold"
                    style={{ color: m.score >= 0.8 ? 'var(--success)' : m.score >= 0.5 ? 'var(--warning)' : 'var(--error)' }}
                  >
                    {m.score.toFixed(2)}
                  </span>
                </div>
                <div
                  className="mt-1.5 h-1 w-full overflow-hidden rounded-full"
                  style={{ background: 'var(--bd)' }}
                >
                  <div
                    className="h-full transition-[width] duration-[var(--dur-normal)]"
                    style={{
                      width: pct(m.score),
                      background: m.score >= 0.8 ? 'var(--success)' : m.score >= 0.5 ? 'var(--warning)' : 'var(--error)',
                    }}
                  />
                </div>
                <p className="font-body text-[10px] mt-1.5 mb-0" style={{ color: 'var(--t3)' }}>
                  가중 {pct(m.weight)}
                </p>
              </div>
            ))}
        </div>
      </div>

      {/* 미달 원인 */}
      {card.blockers.length > 0 ? (
        <div
          className="rounded-[var(--r-lg)] border p-4"
          style={{ background: 'var(--error-light)', borderColor: 'var(--error)' }}
        >
          <p
            className="font-display text-sm font-semibold m-0 mb-2 inline-flex items-center gap-2"
            style={{ color: 'var(--error)' }}
          >
            <AlertTriangle className="w-4 h-4" aria-hidden />
            발행을 막는 것 {card.blockers.length}건
          </p>
          <ul className="font-body text-xs m-0 pl-4" style={{ color: 'var(--error)' }}>
            {card.blockers.map((b, i) => (
              <li key={i} className="mb-1">
                {b}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* 면별 준비도 */}
      <div
        className="rounded-[var(--r-lg)] border p-4"
        style={{ background: 'var(--bg)', borderColor: 'var(--bd)' }}
      >
        <p className="font-display text-sm font-semibold m-0 mb-3" style={{ color: 'var(--t1)' }}>
          선언한 면이 실제로 훈련 가능한가
        </p>
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          {card.facets.map((f) => (
            <div key={f.facet} className="rounded-[var(--r-md)] p-2.5" style={{ background: 'var(--bg2)' }}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-display text-xs font-medium" style={{ color: 'var(--t1)' }}>
                  {f.code} {f.name}
                </span>
                <span
                  className="font-display text-xs font-semibold"
                  style={{ color: f.ready_ratio >= 1 ? 'var(--success)' : 'var(--warning)' }}
                >
                  {pct(f.ready_ratio)}
                </span>
              </div>
              <p className="font-body text-[10px] mt-1 mb-0" style={{ color: 'var(--t3)' }}>
                {FACET_SAYS[f.facet] ?? ''}
                {f.missing_count > 0 ? ` · 결측 ${f.missing_count}건` : ''}
                {f.full_ratio < f.ready_ratio ? ' · 일부 TTS 대체' : ''}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 경고 */}
      {card.warnings.length > 0 ? (
        <div
          className="rounded-[var(--r-lg)] border p-4"
          style={{ background: 'var(--bg)', borderColor: 'var(--bd)' }}
        >
          <p
            className="font-display text-sm font-semibold m-0 mb-2 inline-flex items-center gap-2"
            style={{ color: 'var(--t2)' }}
          >
            <Info className="w-4 h-4" aria-hidden />
            알고 있어야 하는 것 {card.warnings.length}건
          </p>
          <ul className="font-body text-xs m-0 pl-4" style={{ color: 'var(--t3)' }}>
            {card.warnings.slice(0, 8).map((w, i) => (
              <li key={i} className="mb-1">
                {w}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* 깔때기 */}
      {funnel ? (
        <div
          className="rounded-[var(--r-lg)] border p-4"
          style={{ background: 'var(--bg)', borderColor: 'var(--bd)' }}
        >
          <p className="font-display text-sm font-semibold m-0 mb-2" style={{ color: 'var(--t1)' }}>
            어디서 몇 개가 떨어졌나
          </p>
          <p className="font-body text-xs m-0 mb-2" style={{ color: 'var(--t2)' }}>
            모집단 {funnel.population} → 필터 통과 {funnel.after_filters} → 차감 후{' '}
            {funnel.after_subtract} → 목표 적용 {funnel.after_objective} → 최종 {funnel.final}
          </p>
          {droppedTop.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {droppedTop.map(([reason, n]) => (
                <span
                  key={reason}
                  className="rounded-[var(--r-sm)] px-2 py-0.5 font-body text-[11px]"
                  style={{ background: 'var(--bg2)', color: 'var(--t3)' }}
                >
                  {reason} {n}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* 목차 미리보기 */}
      {preview.groups && preview.groups.length > 0 ? (
        <div
          className="rounded-[var(--r-lg)] border p-4"
          style={{ background: 'var(--bg)', borderColor: 'var(--bd)' }}
        >
          <p className="font-display text-sm font-semibold m-0 mb-3" style={{ color: 'var(--t1)' }}>
            목차 미리보기 {preview.group_count && preview.group_count > preview.groups.length
              ? `(앞 ${preview.groups.length}개 / 전체 ${preview.group_count}개)`
              : ''}
          </p>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
            {preview.groups.map((g) => (
              <div key={g.key} className="rounded-[var(--r-md)] p-3" style={{ background: 'var(--bg2)' }}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-display text-xs font-semibold" style={{ color: 'var(--t1)' }}>
                    {g.label || g.key}
                  </span>
                  <span className="font-body text-[11px]" style={{ color: 'var(--t3)' }}>
                    {g.count}개
                  </span>
                </div>
                <ul className="mt-2 mb-0 list-none p-0">
                  {g.sample.map((w) => (
                    <li key={w.word} className="font-body text-[11px] mb-0.5" style={{ color: 'var(--t2)' }}>
                      <span className="font-display font-medium">{w.word}</span>
                      {w.v_level != null ? (
                        <span style={{ color: 'var(--t3)' }}> V{w.v_level}</span>
                      ) : null}
                      {w.meaning_ko ? <span style={{ color: 'var(--t3)' }}> — {w.meaning_ko}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
