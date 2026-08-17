// apps/web/src/components/admin/PdBasisPanel.tsx
//
// PD 근거 확인 작업면 — **발행을 막고 있는 유일한 관문**을 실제로 통과할 수 있게 만드는 화면.
//
// ── 이 화면이 하지 않는 것 ───────────────────────────────────────
//   PD 여부를 판정하지 않는다. 판정은 사람이 갱신 기록을 보고 한다. 화면이 하는 일은 셋이다:
//     ① 어디를 봐야 하는지 계산해 준다 (갱신 창 = 발행 27~28년 뒤 · 정기간행물 편)
//     ② 확인 단위를 맞춰 준다 (갱신은 호가 아니라 **간행물 단위**로 등록된다)
//     ③ 근거 URL 없이는 기록되지 않게 한다 (재검증 불가능한 기록은 게이트를 형식으로 만든다)
//
// ⚠️ 만화는 Stanford 판권갱신 DB 에 없다 — 그 DB 는 도서(Class A)만 담는다.
//    만화책은 정기간행물(Class B)이라 Catalog of Copyright Entries 를 봐야 한다.
//    틀린 조회처를 안내하면 "찾아봤는데 없더라"는 **틀린 확신**을 만든다.

'use client'

import { useCallback, useEffect, useState } from 'react'

import type { PdBasisSpec } from '@/lib/pd-comic/model'

const ACCENT = '#8B5CF6'

interface Lookup { label: string; note: string; url: string }
interface IssueRow {
  id: string
  slug: string
  title: string
  issueNo: number | null
  publishedYear: number | null
  status: string
  pdBasis: string | null
  pdEvidenceUrl: string | null
  pdCheckedAt: string | null
  panelsTotal: number
  renewalWindow: [number, number] | null
  renewal?: RenewalVerdict
}
interface RenewalVerdict { level: string; note: string; blocking: boolean }
interface SeriesRow {
  seriesKey: string
  seriesTitle: string
  publisher: string | null
  kind: string | null
  yearFrom: number | null
  yearTo: number | null
  renewalRange: [number, number] | null
  lookups: Lookup[]
  total: number
  confirmed: number
  /** 갱신된 것으로 알려진 호 수 — 0 이 아니면 시리즈 일괄 확정을 막는다 */
  renewalBlocked: number
  renewalNote: string
  issues: IssueRow[]
}

export function PdBasisPanel({ onMsg }: { onMsg: (s: string) => void }) {
  const [series, setSeries] = useState<SeriesRow[]>([])
  const [bases, setBases] = useState<PdBasisSpec[]>([])
  const [totals, setTotals] = useState<{ issues: number; confirmed: number; series: number } | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setBusy(true)
    try {
      const r = await fetch('/api/pdcp/pd-check', { cache: 'no-store' })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? '조회 실패')
      setSeries(j.series ?? [])
      setBases(j.bases ?? [])
      setTotals(j.totals ?? null)
    } catch (e) {
      onMsg((e as Error).message)
    } finally {
      setBusy(false)
    }
  }, [onMsg])

  useEffect(() => { void load() }, [load])

  return (
    <div className="flex flex-col gap-4">
      <section
        className="rounded-[var(--r-lg)] border p-4"
        style={{ borderColor: `${ACCENT}30`, background: `${ACCENT}08` }}
      >
        <h3 className="font-display text-[14px] font-[800] text-[var(--t1)]">
          PD 근거 확인 — 발행을 막고 있는 관문
        </h3>
        <p className="mt-1.5 max-w-[80ch] font-body text-[12.5px] leading-relaxed text-[var(--t2)]">
          1930~1963 발행물은 <b>저작권 갱신 등록이 없었을 때만</b> 퍼블릭도메인입니다. 갱신은 호가 아니라{' '}
          <b>간행물 단위</b>로 등록되므로 시리즈 하나를 확인하면 그 시리즈의 여러 호에 적용됩니다.
          확인 후 근거 URL과 함께 기록하면 발행 게이트가 열립니다.
        </p>
        <p className="mt-2 rounded-[var(--r-md)] bg-[var(--warning-light)] px-3 py-2 font-body text-[12px] text-[var(--t1)]">
          ⚠️ <b>만화는 Stanford 판권갱신 DB에 없습니다</b> — 그 DB는 도서(Class A) 전용입니다.
          만화책은 정기간행물(Class B)이라 <b>Catalog of Copyright Entries</b>의 정기간행물 갱신 편을 봐야 합니다.
        </p>
        {totals && (
          <p className="mt-2 font-mono text-[11.5px] tabular-nums text-[var(--t2)]">
            시리즈 {totals.series} · 호 {totals.issues} · 근거 확정 {totals.confirmed}/{totals.issues}
          </p>
        )}
      </section>

      {busy && series.length === 0 && (
        <p className="font-body text-[12.5px] text-[var(--t3)]">불러오는 중…</p>
      )}
      {!busy && series.length === 0 && (
        <p className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] px-4 py-6 text-center font-body text-[12.5px] text-[var(--t2)]">
          확인 대상이 없습니다 — 드레인으로 검수 단계까지 올라온 호가 있어야 합니다.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {series.map((s) => (
          <SeriesCard
            key={s.seriesKey}
            s={s}
            bases={bases}
            expanded={open === s.seriesKey}
            onToggle={() => setOpen(open === s.seriesKey ? null : s.seriesKey)}
            onDone={(m) => { onMsg(m); void load() }}
          />
        ))}
      </ul>
    </div>
  )
}

function SeriesCard({
  s, bases, expanded, onToggle, onDone,
}: {
  s: SeriesRow
  bases: PdBasisSpec[]
  expanded: boolean
  onToggle: () => void
  onDone: (msg: string) => void
}) {
  // 기본 근거는 발행 연도가 정한다 — 1930년 이전이면 연도만으로 확정된다.
  const defaultBasis = s.yearFrom && s.yearFrom <= 1929 ? 'term-expired' : 'no-renewal'
  const [basis, setBasis] = useState(defaultBasis)
  const [evidence, setEvidence] = useState('')
  const [saving, setSaving] = useState(false)
  const spec = bases.find((b) => b.key === basis)
  const done = s.confirmed >= s.total
  // 갱신된 호가 섞인 시리즈는 **일괄 확정을 막는다** — 한 번의 클릭이 침해를 만들 수 있다.
  const hasRenewed = s.renewalBlocked > 0

  const confirm = async () => {
    setSaving(true)
    try {
      const r = await fetch('/api/pdcp/pd-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seriesKey: s.seriesKey, pdBasis: basis, pdEvidenceUrl: evidence || undefined }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? '기록 실패')
      onDone(`${s.seriesTitle} — ${j.updated}호에 근거 기록 (${basis})`)
    } catch (e) {
      onDone((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <li className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex min-h-[52px] w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-left"
      >
        <span className="font-display text-[13.5px] font-[700] text-[var(--t1)]">{s.seriesTitle}</span>
        {s.publisher && (
          <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-[var(--t3)]">{s.publisher}</span>
        )}
        <span className="font-mono text-[11.5px] tabular-nums text-[var(--t2)]">
          {s.yearFrom}
          {s.yearTo && s.yearTo !== s.yearFrom ? `–${s.yearTo}` : ''} · {s.total}호
        </span>
        {/* 색만으로 구분하지 않는다 — 라벨을 함께 둔다 */}
        <span
          className="rounded-[var(--r-full)] px-2 py-0.5 font-mono text-[10px] font-[700]"
          style={{
            color: done ? 'var(--success)' : 'var(--warning)',
            background: done ? 'var(--success-light)' : 'var(--warning-light)',
          }}
        >
          {done ? `근거 확정 ${s.confirmed}/${s.total}` : `미확정 ${s.total - s.confirmed}`}
        </span>
        {/* 갱신된 구간이 있으면 그것부터 보여준다 — 발행하면 안 되는 호다 */}
        {s.renewalBlocked > 0 && (
          <span
            className="rounded-[var(--r-full)] px-2 py-0.5 font-mono text-[10px] font-[700]"
            style={{ color: 'var(--error)', background: 'var(--error-light)' }}
          >
            갱신됨 {s.renewalBlocked}호 · 발행 불가
          </span>
        )}
        <span className="ml-auto font-mono text-[11px] text-[var(--t3)]">{expanded ? '접기' : '확인하기'}</span>
      </button>

      {expanded && (
        <div className="flex flex-col gap-3 border-t border-[var(--bd)] px-4 py-3">
          {/* 갱신 경고가 최우선 — 이걸 못 보고 일괄 확정하면 그 클릭이 침해가 된다 */}
          {hasRenewed && (
            <p className="rounded-[var(--r-md)] border border-[var(--error)] bg-[var(--error-light)] px-3 py-2 font-body text-[12px] leading-relaxed text-[var(--t1)]">
              <b>이 시리즈에는 저작권이 갱신된 호가 {s.renewalBlocked}개 있습니다.</b> {s.renewalNote}
              <br />
              갱신된 호는 퍼블릭도메인이 아니므로 발행할 수 없습니다 — 시리즈 일괄 확정을 막아 두었습니다.
              아래 목록에서 갱신 구간 밖의 호만 골라 확정하세요.
            </p>
          )}

          {/* ① 어디를 봐야 하는가 */}
          <div>
            <p className="font-display text-[12.5px] font-[700] text-[var(--t1)]">
              ① 갱신 기록 확인
              {s.renewalRange && (
                <span className="ml-2 font-mono text-[11.5px] font-[500] tabular-nums text-[var(--t2)]">
                  {s.renewalRange[0]}~{s.renewalRange[1]}년 갱신 편을 봅니다 (발행 27~28년 뒤)
                </span>
              )}
            </p>
            <ul className="mt-1.5 flex flex-col gap-1">
              {s.lookups.map((l) => (
                <li key={l.url}>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[36px] items-center gap-2 font-body text-[12.5px] text-[var(--t1)] underline underline-offset-2 hover:text-[var(--active-ink)]"
                  >
                    {l.label}
                  </a>
                  <span className="ml-2 font-body text-[11.5px] text-[var(--t3)]">{l.note}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* ② 무엇으로 기록하는가 */}
          <div className="flex flex-wrap items-end gap-2 border-t border-[var(--bd)] pt-3">
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--t3)]">근거</span>
              <select
                value={basis}
                onChange={(e) => setBasis(e.target.value)}
                className="min-h-[38px] rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-2 font-body text-[12.5px]"
              >
                {bases.filter((b) => !b.key.startsWith('pre-')).map((b) => (
                  <option key={b.key} value={b.key}>{b.label}</option>
                ))}
              </select>
            </label>
            <label className="flex min-w-[280px] flex-1 flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--t3)]">
                근거 URL {spec?.needsEvidence ? '(필수)' : '(선택)'}
              </span>
              <input
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                placeholder="https://onlinebooks.library.upenn.edu/cce/..."
                className="min-h-[38px] rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-2.5 font-mono text-[12px]"
              />
            </label>
            <button
              type="button"
              onClick={() => void confirm()}
              disabled={saving || hasRenewed || (spec?.needsEvidence && !evidence)}
              title={hasRenewed ? '갱신된 호가 섞여 있어 일괄 확정을 막았습니다' : undefined}
              className="min-h-[38px] rounded-[var(--r-md)] px-4 font-display text-[12.5px] font-[800] text-white disabled:opacity-50"
              style={{ background: ACCENT }}
            >
              {saving ? '기록 중…' : hasRenewed ? '일괄 확정 불가 (갱신된 호 포함)' : `이 시리즈 ${s.total}호에 기록`}
            </button>
          </div>
          {spec && (
            <p className="font-body text-[11.5px] leading-relaxed text-[var(--t2)]">
              <b className="text-[var(--t1)]">{spec.label}</b> — {spec.when}
              {spec.needsEvidence && ' 확인한 페이지 주소를 남겨야 나중에 재검증할 수 있습니다.'}
            </p>
          )}

          {/* ③ 어떤 호에 적용되는가 */}
          <details className="border-t border-[var(--bd)] pt-2">
            <summary className="cursor-pointer font-display text-[12px] font-[700] text-[var(--t2)]">
              적용 대상 {s.total}호
            </summary>
            <ul className="mt-1.5 flex flex-col gap-0.5">
              {s.issues.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-[var(--t2)]">
                  <span className="w-12 shrink-0 tabular-nums">{i.issueNo != null ? `#${i.issueNo}` : '—'}</span>
                  <span className="tabular-nums">{i.publishedYear ?? '연도미상'}</span>
                  {i.renewalWindow && (
                    <span className="text-[var(--t3)]">갱신확인 {i.renewalWindow[0]}~{i.renewalWindow[1]}</span>
                  )}
                  <span className="tabular-nums text-[var(--t3)]">{i.panelsTotal}컷</span>
                  {i.renewal?.blocking ? (
                    <span className="font-[700] text-[var(--error)]">갱신됨 · 발행불가</span>
                  ) : (
                    <span className={i.pdBasis ? 'text-[var(--success)]' : 'text-[var(--warning)]'}>
                      {i.pdBasis ? `✓ ${i.pdBasis}` : '미확정'}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-[var(--t3)]">{i.title}</span>
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </li>
  )
}
