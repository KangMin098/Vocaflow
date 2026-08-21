// apps/web/src/app/admin/textbook/TextbookConsoleClient.tsx
// TBP(교재) 콘솔 — 사다리 · 문항 건강 · 평가 우위. 조작은 없다(생성은 Claude Code 드레인).

'use client'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import type { TextbookConsoleStats } from '@/lib/textbook/console-stats'

const TYPE_KO: Record<string, string> = {
  order: '순서',
  insert: '삽입',
  irrelevant: '흐름 무관',
  vocab_choice: '어휘',
  grammar_choice: '어법',
  word_order: '영작 배열',
}

const STANDING_KO: Record<string, { mark: string; label: string; color: string }> = {
  superior: { mark: '🟢', label: '우위', color: 'var(--ok)' },
  parity: { mark: '⚪', label: '대등', color: 'var(--t2)' },
  inferior: { mark: '🔴', label: '열위', color: 'var(--danger)' },
  absent: { mark: '⛔', label: '없음', color: 'var(--danger)' },
  unmeasured: { mark: '❔', label: '못 잼', color: 'var(--t3)' },
}

/** 카이제곱 임계 — 자유도 4, 유의수준 0.05. 통계표 값이지 우리가 고른 숫자가 아니다. */
const CHI2_CRITICAL = 9.488

export function TextbookConsoleClient({ stats }: { stats: TextbookConsoleStats }) {
  const { evaluation: ev, series } = stats
  const superiorPct = ev.total ? Math.round((100 * ev.byStanding.superior) / ev.total) : 0

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-[800] text-[var(--t1)]">교재 (TBP)</h1>
          <p className="font-body text-[13px] text-[var(--t2)]">
            학령 사다리 · 문항 건강 · 시중 대비 평가 우위. 생성은 이 화면이 아니라 Claude Code 드레인이다.
          </p>
        </div>
        <AdminScreenHelp screen="textbook" />
      </header>

      {stats.loadError ? (
        <p
          role="alert"
          className="rounded-[var(--r-md)] border border-[var(--danger)] bg-[var(--bg)] p-4 font-body text-[13px] text-[var(--danger)]"
        >
          {stats.loadError}
        </p>
      ) : null}

      {/* ── 요약 ─────────────────────────────────────────────── */}
      <section aria-label="요약" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="저장 문항" value={stats.totalItems.toLocaleString()} />
        <Stat label="사다리 계단" value={`${series.rungs.length - series.brokenSteps.length}/${series.rungs.length}`} />
        <Stat label="평가 우위" value={`${superiorPct}%`} sub={`${ev.byStanding.superior}/${ev.total}`} />
        <Stat
          label="학습자 관측"
          value={stats.observations.toLocaleString()}
          sub={stats.observations === 0 ? '난이도·변별도 못 냄' : undefined}
          warn={stats.observations === 0}
        />
      </section>

      {/* ── 유형별 ────────────────────────────────────────────── */}
      <section aria-label="유형별 문항" className="flex flex-col gap-2">
        <h2 className="font-display text-[15px] font-[700] text-[var(--t1)]">유형별 문항</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse font-body text-[13px]">
            <thead>
              <tr className="border-b border-[var(--bd)] text-left text-[var(--t2)]">
                <th className="py-2 pr-3 font-[600]">유형</th>
                <th className="py-2 pr-3 text-right font-[600] tabular-nums">문항</th>
                <th className="py-2 pr-3 font-[600]">정답 번호</th>
              </tr>
            </thead>
            <tbody>
              {stats.byType.map((t) => (
                <tr key={t.type} className="border-b border-[var(--bd)]">
                  <td className="py-2 pr-3 text-[var(--t1)]">{TYPE_KO[t.type] ?? t.type}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-[var(--t1)]">
                    {t.count.toLocaleString()}
                  </td>
                  <td className="py-2 pr-3">
                    {t.chi2 == null ? (
                      <span className="text-[var(--t3)]">저장 형식에 번호 없음</span>
                    ) : (
                      <span style={{ color: t.answerBiased ? 'var(--danger)' : 'var(--ok)' }}>
                        {t.answerBiased ? '⚠️ 쏠림' : '✅ 고름'} · χ²={t.chi2.toFixed(1)} (임계 {CHI2_CRITICAL})
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="font-body text-[12px] text-[var(--t3)]">
          초등 3종(파닉스 운율·기본어휘 뜻·철자 완성)은 사전의 순수 함수라 저장하지 않는다 — 여기 표에 없다.
        </p>
      </section>

      {/* ── 사다리 ────────────────────────────────────────────── */}
      <section aria-label="학령 사다리" className="flex flex-col gap-2">
        <h2 className="font-display text-[15px] font-[700] text-[var(--t1)]">
          학령 사다리 — {series.brand}
        </h2>
        <ul className="flex flex-col gap-1">
          {series.rungs.map((r) => (
            <li
              key={r.rung.step}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-[var(--r-sm)] border border-[var(--bd)] px-3 py-2 font-body text-[13px]"
            >
              <span className="font-[700] text-[var(--t1)]">{r.rung.step}단</span>
              <span className="text-[var(--t2)]">V{r.rung.vLevels.join(',')}</span>
              <span className="text-[var(--t1)]">{r.rung.schoolBand}</span>
              <span className="ml-auto tabular-nums text-[var(--t1)]">{r.total.toLocaleString()}</span>
              {r.emptyTypes.length ? (
                <span className="basis-full text-[12px] text-[var(--warn)]">
                  재고 0: {r.emptyTypes.map((t) => TYPE_KO[t] ?? t).join(' · ')}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {/* ── 평가 우위 ─────────────────────────────────────────── */}
      <section aria-label="평가 요소" className="flex flex-col gap-2">
        <h2 className="font-display text-[15px] font-[700] text-[var(--t1)]">시중 교재 대비 평가 요소</h2>
        <p className="font-body text-[12px] text-[var(--t3)]">
          분모는 요소 전체다 — 못 잰 것을 빼고 세면 숫자가 거짓말이 된다.
        </p>
        <div className="flex flex-wrap gap-2">
          {(['superior', 'parity', 'inferior', 'absent', 'unmeasured'] as const).map((s) => (
            <span
              key={s}
              className="rounded-[var(--r-sm)] border border-[var(--bd)] px-2 py-1 font-body text-[12px]"
              style={{ color: STANDING_KO[s]!.color }}
            >
              {STANDING_KO[s]!.mark} {STANDING_KO[s]!.label} {ev.byStanding[s]}
            </span>
          ))}
        </div>
        {ev.losing.length ? (
          <div className="mt-1 flex flex-col gap-1">
            <h3 className="font-display text-[13px] font-[700] text-[var(--t1)]">
              지고 있는 요소 {ev.losing.length}개
            </h3>
            <ul className="flex flex-col gap-1 font-body text-[13px] text-[var(--t2)]">
              {ev.losing.map((d) => (
                <li key={d.key}>
                  <span style={{ color: STANDING_KO[d.standing]!.color }}>
                    {STANDING_KO[d.standing]!.mark}
                  </span>{' '}
                  <span className="text-[var(--t1)]">{d.label}</span> — {d.ours}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  )
}

function Stat({
  label,
  value,
  sub,
  warn,
}: {
  label: string
  value: string
  sub?: string
  warn?: boolean
}) {
  return (
    <div className="flex flex-col gap-1 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-3">
      <span className="font-body text-[12px] text-[var(--t2)]">{label}</span>
      <span className="font-display text-[20px] font-[800] tabular-nums text-[var(--t1)]">{value}</span>
      {sub ? (
        <span
          className="font-body text-[11px]"
          style={{ color: warn ? 'var(--warn)' : 'var(--t3)' }}
        >
          {sub}
        </span>
      ) : null}
    </div>
  )
}
