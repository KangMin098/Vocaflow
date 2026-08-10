// apps/web/src/app/admin/pd-comics/AdminPdComicsClient.tsx
//
// PDCP 운영 콘솔 — 읽기 전용 목록이 아니라 **조작면**.
//   소스(대량 검색·적재) / 큐(드레인·라이브 모니터링) / 도구(환경 점검)
//
// 무거운 이미지 작업은 앱이 하지 않는다. 드레인 API 가 파이프라인 CLI 를 호출하고
// 이 화면은 **한 단계씩 반복 호출하며 진행을 보여준다** (CCP dev-drain 과 같은 구조).
// 한 호 52페이지를 한 요청에 처리하면 어떤 타임아웃에도 안 들어가기 때문이다.

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { PD_STAGES, stageIndex, type PdComicAdminRow, type PdPanelAdmin } from '@/lib/pd-comic/model'

const ACCENT = '#8B5CF6'

interface Preset {
  key: string
  label: string
  note: string
  query?: string
  filters?: Record<string, unknown>
  count?: number
}

interface AssistSite {
  key: string
  label: string
  url: string
  policy: string
}

interface AdapterInfo {
  id: string
  label: string
  caps: Record<string, unknown>
  profile: Record<string, unknown>
  presets?: Preset[] | null
  sites?: AssistSite[] | null
}

interface SearchItem {
  identifier: string
  title: string
  seriesTitle: string | null
  issueNo: number | null
  publishedYear: number | null
  pageCount: number | null
  url: string
  pdBasis: string | null
  pdNote: string
  /** 어댑터가 매긴 저작권 위험도 — 목록은 이미 이 순서로 정렬돼 온다 */
  pdRisk: 'ok' | 'caution' | 'high' | null
  pdRiskReason: string | null
  pdCurated: boolean
  existingStatus: string | null
}

/** 위험도 배지 — 색만으로 구분하지 않고 라벨을 함께 둔다(색맹 대응). */
const RISK_UI: Record<string, { label: string; fg: string; bg: string }> = {
  ok: { label: 'PD 확정', fg: 'var(--success)', bg: 'var(--success-light)' },
  caution: { label: '확인 필요', fg: 'var(--warning)', bg: 'var(--warning-light)' },
  high: { label: '위험', fg: 'var(--error)', bg: 'var(--error-light)' },
}

type Tab = 'source' | 'queue' | 'monitor' | 'tools'

/**
 * 탭 라벨 — 화면 표시와 화면도움말 조회 키가 같은 문자열이어야 한다
 * (AdminScreenHelp 가 라벨로 tabs[] 를 찾는다). 그래서 한 곳에서만 정의한다.
 */
const TABS: Array<[Tab, string]> = [
  ['source', '소스 · 대량 적재'],
  ['queue', '큐 · 드레인'],
  ['monitor', '테스트 · 모니터'],
  ['tools', '도구'],
]

export function AdminPdComicsClient({
  initialRows,
  schemaReady,
}: {
  initialRows: PdComicAdminRow[]
  schemaReady: boolean
}) {
  const [tab, setTab] = useState<Tab>(initialRows.length ? 'queue' : 'source')
  const [rows, setRows] = useState(initialRows)
  const [msg, setMsg] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const r = await fetch('/api/pdcp/queue', { cache: 'no-store' })
    if (r.ok) setRows((await r.json()).rows ?? [])
  }, [])

  return (
    <>
      <nav className="mb-3 flex gap-1 border-b border-[var(--bd)]" aria-label="PDCP 섹션">
        {TABS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className="-mb-px min-h-[44px] border-b-2 px-3 font-display text-[13px] font-[700] transition-colors"
            style={{
              borderColor: tab === k ? ACCENT : 'transparent',
              color: tab === k ? ACCENT : 'var(--t3)',
            }}
            aria-current={tab === k ? 'page' : undefined}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* 탭을 옮기면 도움말도 그 탭 것으로 바뀐다 — 라벨 문자열이 조회 키다. */}
      <AdminScreenHelp
        screen="pd-comics"
        tab={TABS.find(([k]) => k === tab)?.[1]}
        className="mb-4"
      />

      {msg && (
        <p role="status" className="mb-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-3 py-2 font-body text-[12.5px] text-[var(--t1)]">
          {msg}
        </p>
      )}

      {tab === 'source' && <SourceTab onMsg={setMsg} onEnqueued={refresh} schemaReady={schemaReady} />}
      {tab === 'queue' && <QueueTab rows={rows} onMsg={setMsg} onRefresh={refresh} />}
      {tab === 'monitor' && <MonitorTab rows={rows} onMsg={setMsg} onRefresh={refresh} active={tab === 'monitor'} />}
      {tab === 'tools' && <ToolsTab />}
    </>
  )
}

// ─── 추천 소재 (자동 큐레이션) — 사전 지식 없이 아는 명작만 고르면 자동 랭킹·적재 ──────
// curate-core(CLI 와 동일 로직)로 CANON 매칭 + CI 감지 + 분량 + PD 위험도 자동 점수.
// 사용자가 컬렉션 ID·연도 상한·검색어를 몰라도 된다 — 명작 칩 하나 누르면 끝.
type CurateCand = { identifier: string; title: string; canon: string | null; isCI: boolean; fit: number; why: string[]; pageCount: number | null; publishedYear: number | null; pdRisk: string | null; existingStatus: string | null }
function RecommendPanel({ source, onMsg, onEnqueued, schemaReady }: { source: string; onMsg: (s: string) => void; onEnqueued: () => void; schemaReady: boolean }) {
  const [tracks, setTracks] = useState<Array<{ key: string; label: string; query: string; note: string }>>([])
  const [canon, setCanon] = useState<string[]>([])
  const [cands, setCands] = useState<CurateCand[]>([])
  const [busy, setBusy] = useState(false)
  const [pages, setPages] = useState(6)
  const [activeQuery, setActiveQuery] = useState<string | null>(null)

  useEffect(() => {
    void fetch('/api/pdcp/curate').then((r) => (r.ok ? r.json() : { tracks: [], canon: [] })).then((j) => { setTracks(j.tracks ?? []); setCanon(j.canon ?? []) }).catch(() => { /* noop */ })
  }, [])

  const run = async (query: string) => {
    setBusy(true); setActiveQuery(query); setCands([])
    try {
      const r = await fetch('/api/pdcp/curate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source, query, top: 12 }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? '추천 실패')
      setCands(j.candidates ?? [])
      onMsg(`"${query}" — 학습 적합 후보 ${j.candidates?.length ?? 0}건 (자동 랭킹)`)
    } catch (e) { onMsg((e as Error).message) } finally { setBusy(false) }
  }

  const enqueueTop = async (n: number) => {
    const pick = cands.filter((c) => !c.existingStatus).slice(0, n).map((c) => c.identifier)
    if (!pick.length) { onMsg('적재할 신규 후보가 없습니다'); return }
    setBusy(true)
    try {
      const r = await fetch('/api/pdcp/enqueue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source, identifiers: pick, pages }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? '적재 실패')
      onMsg(`추천 ${j.enqueued}건 큐 적재 (앞 ${pages}장)${j.failed ? ` · 중복 ${j.failed}` : ''}`)
      onEnqueued()
    } catch (e) { onMsg((e as Error).message) } finally { setBusy(false) }
  }

  const newCount = cands.filter((c) => !c.existingStatus).length

  return (
    <section className="rounded-[var(--r-lg)] border p-4" style={{ borderColor: `${ACCENT}30`, background: `${ACCENT}08` }}>
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="font-display text-[14px] font-[800] text-[var(--t1)]">추천 소재 — 아는 명작만 고르세요</h3>
        <span className="font-body text-[11.5px] text-[var(--t2)]">컬렉션 ID·연도·검색어 몰라도 됩니다. 학습 적합·PD 안전 순으로 자동 랭킹됩니다.</span>
      </div>

      {/* 자동 적용 가드레일 — 사용자가 규칙을 몰라도 됨을 명시 */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {['1964년+ 자동 제외', 'PD 위험 재정렬', '학습 부적합(문법서·주니어) 제외', '표지-only 제외', '중복 제외', '명작 canon 가중'].map((g) => (
          <span key={g} className="rounded-[var(--r-full)] bg-[var(--bg)] px-2 py-0.5 font-mono text-[9.5px] text-[var(--t3)]">✓ {g}</span>
        ))}
      </div>

      {/* 트랙 + 명작 칩 */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {tracks.map((t) => (
          <button key={t.key} type="button" title={t.note} disabled={busy} onClick={() => void run(t.query)} className="min-h-[34px] rounded-[var(--r-full)] px-3 font-display text-[12px] font-[800] text-white disabled:opacity-50" style={{ background: ACCENT }}>{t.label}</button>
        ))}
        <span className="mx-1 font-mono text-[10px] text-[var(--t3)]">또는 명작:</span>
        {canon.slice(0, 14).map((c) => (
          <button key={c} type="button" disabled={busy} onClick={() => void run(c)} className="min-h-[32px] rounded-[var(--r-full)] border border-[var(--bd)] bg-[var(--bg)] px-2.5 font-display text-[11.5px] font-[700] text-[var(--t2)] transition-colors hover:border-[var(--t3)] disabled:opacity-50">{c}</button>
        ))}
      </div>

      {busy && !cands.length && <p className="mt-3 font-body text-[12px] text-[var(--t3)]">랭킹 중…</p>}

      {cands.length > 0 && (
        <div className="mt-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)]">
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--bd)] px-3 py-2">
            <span className="font-display text-[12px] font-[700] text-[var(--t1)]">&ldquo;{activeQuery}&rdquo; 추천 {cands.length}건</span>
            <span className="font-mono text-[11px] text-[var(--t3)]">신규 {newCount}</span>
            <label className="ml-auto flex items-center gap-1 font-body text-[11.5px] text-[var(--t2)]">앞
              <input type="number" min={1} max={60} value={pages} onChange={(e) => setPages(Number(e.target.value))} className="w-14 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-1.5 py-1 text-right tabular-nums" />장</label>
            <button type="button" disabled={busy || !schemaReady || newCount === 0} onClick={() => void enqueueTop(6)} className="min-h-[34px] rounded-[var(--r-md)] px-3 font-display text-[12px] font-[800] text-white disabled:opacity-50" style={{ background: ACCENT }}>추천 상위 {Math.min(6, newCount)} 큐 적재 (앞 {pages}장)</button>
          </div>
          <ul className="divide-y divide-[var(--bd)]">
            {cands.map((c) => (
              <li key={c.identifier} className="flex items-center gap-2.5 px-3 py-2">
                <span className="w-10 shrink-0 text-center font-mono text-[13px] font-[800] tabular-nums" style={{ color: ACCENT }}>{c.fit.toFixed(1)}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[12.5px] font-[700] text-[var(--t1)]">{c.title}{c.publishedYear && <span className="ml-2 font-mono text-[10.5px] text-[var(--t3)]">{c.publishedYear}</span>}{c.pageCount && <span className="ml-1.5 font-mono text-[10.5px] text-[var(--t3)]">{c.pageCount}p</span>}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 font-body text-[11px] text-[var(--t2)]">
                    {c.pdRisk && RISK_UI[c.pdRisk] && <span className="rounded-[var(--r-full)] px-1.5 py-0.5 font-mono text-[9.5px] font-[700]" style={{ color: RISK_UI[c.pdRisk].fg, background: RISK_UI[c.pdRisk].bg }}>{RISK_UI[c.pdRisk].label}</span>}
                    {c.why.map((w) => <span key={w} className="rounded-[var(--r-full)] bg-[var(--bg2)] px-1.5 py-0.5 font-mono text-[9.5px] text-[var(--t3)]">{w}</span>)}
                  </p>
                </div>
                {c.existingStatus && <span className="shrink-0 font-mono text-[10px] text-[var(--t3)]">등록됨 · {c.existingStatus}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

// ─── 소스 탭 — 능력표 + 검색 + 대량 적재 ────────────────────────────
function SourceTab({
  onMsg,
  onEnqueued,
  schemaReady,
}: {
  onMsg: (s: string) => void
  onEnqueued: () => void
  schemaReady: boolean
}) {
  const [adapters, setAdapters] = useState<AdapterInfo[]>([])
  const [source, setSource] = useState('internet-archive')
  const [query, setQuery] = useState('classics illustrated')
  const [items, setItems] = useState<SearchItem[]>([])
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  // 테스트 모드 — 전권(52p) 대신 앞 N장만 받아 파라미터를 먼저 확인한다
  const [testMode, setTestMode] = useState(true)
  const [pages, setPages] = useState(6)
  // 발견 필터 — 자유 검색만으로는 저작권 살아 있는 자료가 상위에 섞인다(실측)
  const [collection, setCollection] = useState('')
  const [yearTo, setYearTo] = useState<number | ''>(1963)
  const [sort, setSort] = useState('relevance')
  const [page, setPage] = useState(1)
  const [totalFound, setTotalFound] = useState(0)

  useEffect(() => {
    void fetch('/api/pdcp/sources')
      .then((r) => (r.ok ? r.json() : { adapters: [] }))
      .then((j) => setAdapters(j.adapters ?? []))
      .catch(() => setAdapters([]))
  }, [])

  const search = async (opts: { page?: number; preset?: Preset } = {}) => {
    const p = opts.page ?? 1
    setBusy(true)
    setItems([])
    setSel(new Set())
    setPage(p)
    // 프리셋은 질의와 필터를 한 번에 갈아끼운다 — 눌렀는데 이전 필터가 남아 있으면 결과가 어긋난다
    const q = opts.preset ? (opts.preset.query ?? '') : query
    const f = opts.preset
      ? { ...opts.preset.filters, page: p }
      : {
          ...(collection ? { collection } : {}),
          ...(yearTo === '' ? {} : { yearTo: Number(yearTo) }),
          ...(sort !== 'relevance' ? { sort } : {}),
          page: p,
        }
    if (opts.preset) {
      setQuery(q)
      setCollection(String(opts.preset.filters?.collection ?? ''))
      setYearTo((opts.preset.filters?.yearTo as number) ?? '')
      setSort(String(opts.preset.filters?.sort ?? 'relevance'))
    }
    try {
      const r = await fetch('/api/pdcp/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, query: q, limit: 20, filters: f }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? '검색 실패')
      setItems(j.items ?? [])
      setTotalFound(Number(j.totalFound) || 0)
      onMsg(
        `${j.source?.label ?? source} — 전체 ${Number(j.totalFound) || 0}건 중 ${j.items?.length ?? 0}건 표시`,
      )
    } catch (e) {
      onMsg((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const enqueue = async () => {
    if (sel.size === 0) return
    setBusy(true)
    try {
      const r = await fetch('/api/pdcp/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source,
          identifiers: [...sel],
          pages: testMode ? pages : null,
        }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? '적재 실패')
      onMsg(`큐 적재 ${j.enqueued}건${j.failed ? ` · 실패/중복 ${j.failed}건` : ''}`)
      setSel(new Set())
      onEnqueued()
    } catch (e) {
      onMsg((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const cur = adapters.find((a) => a.id === source)
  const bulkOk = cur ? (cur.caps.bulk as boolean) : true

  return (
    <div className="flex flex-col gap-4">
      {/* 추천 소재 — 사전 지식 없이도 아는 명작만 고르면 자동 랭킹·적재 */}
      <RecommendPanel source={source} onMsg={onMsg} onEnqueued={onEnqueued} schemaReady={schemaReady} />

      <details className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)]">
        <summary className="cursor-pointer px-4 py-2.5 font-display text-[12.5px] font-[700] text-[var(--t2)]">직접 검색 · 능력표 (고급)</summary>
        <div className="flex flex-col gap-4 border-t border-[var(--bd)] p-4">
      {/* 능력표 — 사이트마다 취득 방식이 근본적으로 다르다 */}
      <section className="overflow-x-auto rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)]">
        <table className="w-full min-w-[640px] text-left">
          <thead>
            <tr className="border-b border-[var(--bd)] font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--t3)]">
              {['소스', '발견', '인증', '단위', '대량', 'OCR', '간격', '복원 프로파일'].map((h) => (
                <th key={h} className="px-3 py-2 font-[700]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="font-body text-[12px] text-[var(--t2)]">
            {adapters.map((a) => (
              <tr key={a.id} className="border-b border-[var(--bd)] last:border-0">
                <td className="px-3 py-2 font-display font-[700] text-[var(--t1)]">{a.label}</td>
                <td className="px-3 py-2">{String(a.caps.discovery)}</td>
                <td className="px-3 py-2">{String(a.caps.auth)}</td>
                <td className="px-3 py-2">{String(a.caps.unit)}</td>
                <td className="px-3 py-2">{a.caps.bulk ? 'O' : 'X'}</td>
                <td className="px-3 py-2">{a.caps.ocrBoxes ? '좌표O' : a.caps.ocr ? '텍스트' : 'X'}</td>
                <td className="px-3 py-2 tabular-nums">{String(a.caps.minDelayMs)}ms</td>
                <td className="px-3 py-2 font-mono text-[11px]">
                  sat {String(a.profile.saturation)} · ×{String(a.profile.upscale)} · {String(a.profile.ocrStrategy)}
                </td>
              </tr>
            ))}
            {adapters.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-4 text-center text-[var(--t3)]">어댑터를 불러오는 중…</td></tr>
            )}
          </tbody>
        </table>
      </section>

      {/* 검색 + 테스트 모드 */}
      <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] px-4 py-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--t3)]">소스</span>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="min-h-[40px] rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-2 font-body text-[13px]"
            >
              {adapters.map((a) => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[220px] flex-1 flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--t3)]">검색어</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void search()}
              className="min-h-[40px] rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 font-body text-[13px]"
              placeholder="classics illustrated"
            />
          </label>
          <button
            type="button"
            onClick={() => void search()}
            disabled={busy || !bulkOk}
            className="min-h-[40px] rounded-[var(--r-md)] px-4 font-display text-[13px] font-[700] text-white disabled:opacity-50"
            style={{ background: ACCENT }}
          >
            {busy ? '…' : '검색'}
          </button>
        </div>

        {/* 프리셋 — 자유 검색은 관련 없는 도서를 끌고 온다. PD 확률 높은 출발점을 먼저 준다. */}
        {(cur?.presets?.length ?? 0) > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--t3)]">
              출발점
            </span>
            {cur!.presets!.map((pr) => (
              <button
                key={pr.key}
                type="button"
                title={pr.note}
                onClick={() => void search({ preset: pr })}
                disabled={busy}
                className="min-h-[32px] rounded-[var(--r-full)] border border-[var(--bd)] bg-[var(--bg2)] px-3 font-display text-[12px] font-[700] text-[var(--t2)] transition-colors hover:border-[var(--t3)] disabled:opacity-50"
              >
                {pr.label}
                {pr.count != null && (
                  <span className="ml-1.5 font-mono text-[10.5px] tabular-nums text-[var(--t3)]">
                    ~{pr.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* 필터 — 연도 상한이 없으면 1990·2008년 자료가 결과 상단을 채운다(실측) */}
        <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-[var(--bd)] pt-3">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--t3)]">컬렉션</span>
            <input
              value={collection}
              onChange={(e) => setCollection(e.target.value)}
              placeholder="fawcett-comics"
              className="min-h-[36px] w-[170px] rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-2 font-mono text-[12px]"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--t3)]">발행 상한</span>
            <input
              type="number"
              value={yearTo}
              onChange={(e) => setYearTo(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="1963"
              className="min-h-[36px] w-[100px] rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-2 text-right font-mono text-[12px] tabular-nums"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--t3)]">정렬</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="min-h-[36px] rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-2 font-body text-[12.5px]"
            >
              <option value="relevance">관련도</option>
              <option value="downloads">인기</option>
              <option value="year-asc">오래된 순</option>
              <option value="year-desc">최신 순</option>
            </select>
          </label>
          <span className="font-body text-[11.5px] text-[var(--t3)]">
            1964년 이후는 저작권이 자동 갱신되어 사용할 수 없습니다 — 상한을 1963 이하로 두세요.
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[var(--bd)] pt-3">
          <label className="flex items-center gap-2 font-body text-[12.5px] text-[var(--t1)]">
            <input type="checkbox" checked={testMode} onChange={(e) => setTestMode(e.target.checked)} />
            <b>테스트 모드</b>
          </label>
          {testMode && (
            <label className="flex items-center gap-1.5 font-body text-[12.5px] text-[var(--t2)]">
              앞
              <input
                type="number"
                min={1}
                max={60}
                value={pages}
                onChange={(e) => setPages(Number(e.target.value))}
                className="w-16 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-2 py-1 text-right tabular-nums"
              />
              장만 취득
            </label>
          )}
          <span className="font-body text-[11.5px] text-[var(--t3)]">
            한 호가 50장 넘는다. 파라미터를 확인하기 전 전권을 돌리면 시간도 버리고 외부 사이트에 부담을 준다.
          </span>
        </div>

        {!bulkOk && cur && !cur.caps.assisted && (
          <p className="mt-2 rounded-[var(--r-md)] bg-[var(--warning-light)] px-3 py-2 font-body text-[12px] text-[var(--t1)]">
            {cur.label} 은 자동 대량 취득을 지원하지 않습니다({String(cur.caps.discovery)}). 사람이 정상 다운로드한 뒤{' '}
            <code className="font-mono">local-dir</code> 로 넣거나 아래 <b>브라우저 보조</b>를 쓰세요.
          </p>
        )}
      </section>

      {/* 검색 결과 · 대량 선택 */}
      {items.length > 0 && (
        <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)]">
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--bd)] px-4 py-2">
            <button
              type="button"
              onClick={() =>
                setSel(new Set(items.filter((i) => !i.existingStatus).map((i) => i.identifier)))
              }
              className="min-h-[36px] rounded-[var(--r-md)] border border-[var(--bd)] px-3 font-display text-[12px] font-[700] text-[var(--t2)]"
            >
              신규 전체 선택
            </button>
            <button
              type="button"
              onClick={() => setSel(new Set())}
              className="min-h-[36px] rounded-[var(--r-md)] border border-[var(--bd)] px-3 font-display text-[12px] font-[700] text-[var(--t2)]"
            >
              해제
            </button>
            <span className="font-mono text-[12px] tabular-nums text-[var(--t2)]">{sel.size} 선택</span>
            <button
              type="button"
              onClick={() => void enqueue()}
              disabled={busy || sel.size === 0 || !schemaReady}
              className="ml-auto min-h-[36px] rounded-[var(--r-md)] px-4 font-display text-[12px] font-[800] text-white disabled:opacity-50"
              style={{ background: ACCENT }}
            >
              큐에 적재{testMode ? ` (앞 ${pages}장)` : ' (전권)'}
            </button>
          </div>
          <ul className="divide-y divide-[var(--bd)]">
            {items.map((it) => {
              const checked = sel.has(it.identifier)
              return (
                <li key={it.identifier} className="flex gap-3 px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!!it.existingStatus}
                    onChange={(e) => {
                      const n = new Set(sel)
                      if (e.target.checked) n.add(it.identifier)
                      else n.delete(it.identifier)
                      setSel(n)
                    }}
                    className="mt-1 shrink-0"
                    aria-label={`${it.title} 선택`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-[13px] font-[700] text-[var(--t1)]">
                      {it.title}
                      {it.publishedYear && <span className="ml-2 font-mono text-[11px] text-[var(--t3)]">{it.publishedYear}</span>}
                      {it.pageCount && <span className="ml-2 font-mono text-[11px] text-[var(--t3)]">{it.pageCount}p</span>}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 font-body text-[11.5px] text-[var(--t2)]">
                      {it.pdRisk && RISK_UI[it.pdRisk] && (
                        <span
                          className="rounded-[var(--r-full)] px-2 py-0.5 font-mono text-[10px] font-[700]"
                          style={{ color: RISK_UI[it.pdRisk].fg, background: RISK_UI[it.pdRisk].bg }}
                        >
                          {RISK_UI[it.pdRisk].label}
                        </span>
                      )}
                      {it.pdCurated && (
                        <span className="rounded-[var(--r-full)] border border-[var(--bd)] px-2 py-0.5 font-mono text-[10px] text-[var(--t3)]">
                          큐레이션
                        </span>
                      )}
                      <span>{it.pdRiskReason ?? it.pdNote}</span>
                    </p>
                    {it.existingStatus && (
                      <p className="mt-0.5 font-mono text-[11px] text-[var(--t3)]">이미 등록됨 · {it.existingStatus}</p>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
          {totalFound > items.length && (
            <div className="flex items-center justify-between border-t border-[var(--bd)] px-4 py-2">
              <button
                type="button"
                disabled={busy || page <= 1}
                onClick={() => void search({ page: page - 1 })}
                className="min-h-[36px] rounded-[var(--r-md)] border border-[var(--bd)] px-3 font-display text-[12px] font-[700] text-[var(--t2)] disabled:opacity-40"
              >
                이전
              </button>
              <span className="font-mono text-[11.5px] tabular-nums text-[var(--t2)]">
                {page} 페이지 · 전체 {totalFound}건
              </span>
              <button
                type="button"
                disabled={busy || page * 20 >= totalFound}
                onClick={() => void search({ page: page + 1 })}
                className="min-h-[36px] rounded-[var(--r-md)] border border-[var(--bd)] px-3 font-display text-[12px] font-[700] text-[var(--t2)] disabled:opacity-40"
              >
                다음
              </button>
            </div>
          )}
        </section>
      )}
        </div>
      </details>

      <AssistPanel onMsg={onMsg} />
    </div>
  )
}

// ─── 브라우저 보조 — 자동 수집이 금지·불가한 소스를 사람이 운전 ────────
//
// 왜 스크래퍼가 아닌가: Comic Book Plus 는 robots.txt 에서 ClaudeBot·anthropic-ai 를
// 전면 차단하고 목록 엔드포인트까지 Disallow 했다. Digital Comic Museum 은 403 + 계정,
// LoC·HathiTrust 는 Cloudflare 챌린지다. 명시된 거부를 뚫는 대신 사람이 직접 받고,
// 도구는 **저장·압축해제·정렬·매니페스트**만 자동화한다.
function AssistPanel({ onMsg }: { onMsg: (s: string) => void }) {
  const [sites, setSites] = useState<AssistSite[]>([])
  const [available, setAvailable] = useState(false)
  const [site, setSite] = useState('')
  const [slug, setSlug] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void fetch('/api/pdcp/assist')
      .then((r) => (r.ok ? r.json() : { sites: [], available: false }))
      .then((j) => {
        setSites(j.sites ?? [])
        setAvailable(Boolean(j.available))
        if ((j.sites ?? []).length) setSite(j.sites[0].key)
      })
      .catch(() => setSites([]))
  }, [])

  if (sites.length === 0) return null
  const cur = sites.find((s) => s.key === site)

  const start = async () => {
    setBusy(true)
    try {
      const r = await fetch('/api/pdcp/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site, slug, timeout: 900 }),
      })
      const j = await r.json()
      onMsg(r.ok ? j.message : (j.error ?? '세션 시작 실패'))
    } catch (e) {
      onMsg((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] px-4 py-3">
      <h3 className="font-display text-[13px] font-[800] text-[var(--t1)]">
        브라우저 보조 취득 — 로그인·선택은 사람, 정리는 자동
      </h3>
      <p className="mt-1 font-body text-[12px] leading-relaxed text-[var(--t2)]">
        자동 수집을 거부하거나 계정이 필요한 사이트용입니다. 창이 뜨면 직접 로그인해 원하는 호를
        내려받고 창을 닫으면, 받은 CBZ/ZIP/이미지를 풀어 <code className="font-mono">pages/</code> 로
        정규화합니다. 로그인 세션은 다음 회차에 재사용됩니다.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--t3)]">사이트</span>
          <select
            value={site}
            onChange={(e) => setSite(e.target.value)}
            className="min-h-[36px] rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-2 font-body text-[12.5px]"
          >
            {sites.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--t3)]">작업명</span>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="whiz-comics-002"
            className="min-h-[36px] w-[200px] rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-2 font-mono text-[12px]"
          />
        </label>
        <button
          type="button"
          onClick={() => void start()}
          disabled={busy || !available || !slug}
          className="min-h-[36px] rounded-[var(--r-md)] px-4 font-display text-[12.5px] font-[800] text-white disabled:opacity-50"
          style={{ background: ACCENT }}
        >
          {busy ? '여는 중…' : '브라우저 열기'}
        </button>
      </div>

      {cur && (
        <p className="mt-2 rounded-[var(--r-md)] bg-[var(--bg2)] px-3 py-2 font-body text-[11.5px] text-[var(--t2)]">
          <b className="text-[var(--t1)]">{cur.label}</b> — {cur.policy}
        </p>
      )}
      {!available && (
        <p className="mt-2 font-body text-[11.5px] text-[var(--warning)]">
          창은 <b>서버가 도는 컴퓨터</b>에 열립니다 — 배포 환경에서는 사용할 수 없습니다.
        </p>
      )}
    </section>
  )
}

// ─── 큐 탭 — 드레인 + 라이브 모니터링 ───────────────────────────────
const DRAINABLE = new Set(['queued', 'acquired', 'restored', 'segmented', 'ocr'])

function QueueTab({
  rows,
  onMsg,
  onRefresh,
}: {
  rows: PdComicAdminRow[]
  onMsg: (s: string) => void
  onRefresh: () => void
}) {
  const [running, setRunning] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const stopRef = useRef(false)

  // 실패해도 status 는 멈춘 단계 그대로다 — 실패 여부는 last_error 로만 판단한다.
  const pending = rows.filter((r) => DRAINABLE.has(r.status) && !r.lastError)
  const failed = rows.filter((r) => r.lastError)

  const drainOnce = async (issueId?: string, dryRun = false) => {
    const r = await fetch('/api/pdcp/drain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issueId, dryRun }),
    })
    return r.json()
  }

  /** 드레인 루프 — 한 호출 = 한 단계. 큐가 빌 때까지 반복하며 진행을 로그로 보여준다. */
  const drainLoop = async () => {
    setRunning(true)
    stopRef.current = false
    setLog([])
    try {
      for (let i = 0; i < 200 && !stopRef.current; i++) {
        const j = await drainOnce()
        if (j.done) {
          setLog((l) => [...l, `완료 — ${j.message}`])
          break
        }
        if (j.error || j.ok === false) {
          setLog((l) => [...l, `실패 ${j.slug}: ${String(j.error ?? '').slice(0, 160)}`])
        } else {
          setLog((l) => [
            ...l,
            `${j.slug}  ${j.from} → ${j.to}${j.tookMs ? ` (${Math.round(j.tookMs / 1000)}s)` : ''}`,
            ...(j.tail ?? []).map((t: string) => `    ${t}`),
          ])
        }
        onRefresh()
      }
    } catch (e) {
      setLog((l) => [...l, `중단: ${(e as Error).message}`])
    } finally {
      setRunning(false)
      onRefresh()
    }
  }

  /** 실패 표시만 지운다 — 단계는 그대로라 멈춘 지점부터 이어진다. */
  const retry = async (issueId?: string) => {
    const r = await fetch('/api/pdcp/retry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issueId }),
    })
    const j = await r.json()
    onMsg(r.ok ? `재시도 대기 ${j.cleared}건` : (j.error ?? '재시도 실패'))
    onRefresh()
  }

  const counts = PD_STAGES.map((s) => ({ ...s, n: rows.filter((r) => r.status === s.key).length }))

  return (
    <div className="flex flex-col gap-4">
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {counts.map((s) => (
          <div key={s.key} className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--t3)]">{s.key}</p>
            <p className="mt-0.5 flex items-baseline gap-1.5">
              <span className="font-display text-[19px] font-[800] tabular-nums text-[var(--t1)]">{s.n}</span>
              <span className="font-body text-[11.5px] text-[var(--t2)]">{s.label}</span>
            </p>
          </div>
        ))}
      </section>

      <section className="flex flex-wrap items-center gap-2 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] px-4 py-3">
        <button
          type="button"
          onClick={() => void drainLoop()}
          disabled={running || pending.length === 0}
          className="min-h-[40px] rounded-[var(--r-md)] px-4 font-display text-[13px] font-[800] text-white disabled:opacity-50"
          style={{ background: ACCENT }}
        >
          {running ? '드레인 중…' : `드레인 실행 (${pending.length}건 대기)`}
        </button>
        {running && (
          <button
            type="button"
            onClick={() => { stopRef.current = true }}
            className="min-h-[40px] rounded-[var(--r-md)] border border-[var(--bd)] px-4 font-display text-[13px] font-[700] text-[var(--t2)]"
          >
            중지
          </button>
        )}
        <button
          type="button"
          onClick={async () => {
            const j = await drainOnce(undefined, true)
            onMsg(j.command ? `계획: ${j.command}` : (j.message ?? '대상 없음'))
          }}
          disabled={running}
          className="min-h-[40px] rounded-[var(--r-md)] border border-[var(--bd)] px-4 font-display text-[13px] font-[700] text-[var(--t2)]"
        >
          다음 단계 미리보기 (dry-run)
        </button>
        <button type="button" onClick={onRefresh} className="min-h-[40px] rounded-[var(--r-md)] border border-[var(--bd)] px-3 font-display text-[13px] font-[700] text-[var(--t2)]">
          새로고침
        </button>
        <span className="font-body text-[11.5px] text-[var(--t3)]">
          호출 1회 = 호 1개의 다음 단계 1개. 이미지 작업은 CLI 가 수행합니다(dev 전용).
        </span>
      </section>

      {log.length > 0 && (
        <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] px-4 py-3">
          <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--t3)]">드레인 로그</p>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap font-mono text-[11.5px] leading-relaxed text-[var(--t2)]">
            {log.join('\n')}
          </pre>
        </section>
      )}

      {failed.length > 0 && (
        <section className="rounded-[var(--r-lg)] border border-[var(--error)] bg-[var(--error-light)] px-4 py-3">
          <p className="font-display text-[13px] font-[800] text-[var(--t1)]">실패 {failed.length}건</p>
          <ul className="mt-1.5 flex flex-col gap-2">
            {failed.map((r) => (
              <li key={r.id} className="font-body text-[12px] text-[var(--t2)]">
                <div className="flex flex-wrap items-baseline gap-2">
                  <b className="text-[var(--t1)]">{r.title}</b>
                  <span className="font-mono text-[11px] text-[var(--t3)]">{r.status} 단계에서 중단 · {r.attempts ?? 0}회 시도</span>
                  <button
                    type="button"
                    onClick={() => void retry(r.id)}
                    className="min-h-[32px] rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-2.5 font-display text-[11.5px] font-[700] text-[var(--t2)]"
                  >
                    이 호 재시도
                  </button>
                </div>
                <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-[var(--t3)]">
                  {r.lastError}
                </pre>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void retry()}
              className="min-h-[36px] rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 font-display text-[12px] font-[700] text-[var(--t2)]"
            >
              전체 재시도
            </button>
            <span className="font-body text-[11.5px] text-[var(--t3)]">
              단계는 보존됩니다 — 멈춘 지점부터 이어서 진행합니다. 대부분 외부 도구 부재이니{' '}
              <b>도구</b> 탭을 먼저 확인하세요.
            </span>
          </div>
        </section>
      )}

      <IssueList rows={rows} />
    </div>
  )
}

// ─── 테스트 · 모니터 탭 ──────────────────────────────────────────────
// 파이프라인이 지금 "무엇을 · 어떤 상태로 · 어떻게" 처리 중인지 실시간 관측 + 이슈별 테스트 실행.
//   라이브 자동 새로고침 · 단계 분포 · 진행/멈춤 신호 · 이슈별 관측(테스트 플래그·시도·최근 실행·QC)
//   · 컷 콘텐츠(대사/OCR) 드릴다운 · dry-run 미리보기 / 한 단계 진행.

function relTime(iso: string | null): string {
  if (!iso) return '—'
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return '—'
  const s = Math.max(0, Math.round((Date.now() - t) / 1000))
  if (s < 60) return `${s}초 전`
  if (s < 3600) return `${Math.floor(s / 60)}분 전`
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`
  return `${Math.floor(s / 86400)}일 전`
}
const RECENT_MS = 30_000 // 최근 실행 = "방금 진행 중" 신호 (DRAINABLE 은 큐 탭 정의 재사용)

function MonitorTab({ rows, onMsg, onRefresh, active }: {
  rows: PdComicAdminRow[]; onMsg: (s: string) => void; onRefresh: () => Promise<void>; active: boolean
}) {
  const [live, setLive] = useState(true)
  const [lastPoll, setLastPoll] = useState<number>(Date.now())
  const [open, setOpen] = useState<string | null>(null)
  const [openLive, setOpenLive] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [zoom, setZoom] = useState<{ issueId: string; rels: string[]; index: number } | null>(null) // 라이트박스

  // 라이브 자동 새로고침 (활성 탭 + LIVE 일 때만 — 드레인 없이도 상태가 갱신됨)
  useEffect(() => {
    if (!active || !live) return
    const id = setInterval(() => { void onRefresh().then(() => setLastPoll(Date.now())) }, 4000)
    return () => clearInterval(id)
  }, [active, live, onRefresh])

  const dist = PD_STAGES.map((s) => ({ ...s, n: rows.filter((r) => r.status === s.key).length }))
  const drainable = rows.filter((r) => DRAINABLE.has(r.status) && !r.lastError)
  const stuck = rows.filter((r) => r.lastError)
  const runningNow = rows.filter((r) => r.lastRunAt && Date.now() - new Date(r.lastRunAt).getTime() < RECENT_MS && !r.lastError)
  // 관리자 주의 우선순위 정렬: 멈춤(수정 필요) → 방금 진행(관찰) → 진행 대상 → 완료
  const rank = (r: PdComicAdminRow) => r.lastError ? 0 : (r.lastRunAt && Date.now() - new Date(r.lastRunAt).getTime() < RECENT_MS ? 1 : (DRAINABLE.has(r.status) ? 2 : 3))
  const sortedRows = [...rows].sort((a, b) => rank(a) - rank(b))

  const drainOne = async (issueId: string, dryRun: boolean) => {
    setBusy(issueId)
    try {
      const r = await fetch('/api/pdcp/drain', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ issueId, dryRun }) })
      const j = await r.json()
      if (!r.ok) { onMsg(`드레인 실패: ${j.error ?? r.status}`); return }
      if (j.dryRun) onMsg(`[미리보기] ${j.from ?? '?'} → ${j.to ?? '?'} · ${j.command ?? ''}`)
      else if (j.ok) onMsg(`진행: ${j.from} → ${j.to} (${j.tookMs}ms)`)
      else onMsg(`드레인: ${j.message ?? j.error ?? '완료'}`)
      await onRefresh(); setLastPoll(Date.now())
    } finally { setBusy(null) }
  }

  // 현대화 콘솔 트리거 — CLI 를 spawn 하고 결과를 갤러리에 반영(드레인과 같은 구조).
  const modernize = async (issueId: string, track: 'preserve' | 'restyle') => {
    setBusy(issueId)
    onMsg(track === 'restyle' ? 'AI 리스타일 실행 중… (GPU·COMFY_URL 필요, 수 분 소요)' : '작화보존 현대화 실행 중… (page-modern → page-html)')
    try {
      const r = await fetch('/api/pdcp/modernize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ issueId, track }) })
      const j = await r.json()
      const name = track === 'restyle' ? 'AI 리스타일' : '작화보존 현대화'
      if (j.ok) { onMsg(`${name} 완료 — ${(j.steps ?? []).map((s: { script: string }) => s.script).join(' → ')}`); setOpenLive(issueId) }
      else onMsg(`${name} 실패: ${j.error ?? r.status}${j.steps?.length ? ` · ${j.steps.at(-1)?.tail?.at(-1) ?? ''}` : ''}`)
      await onRefresh(); setLastPoll(Date.now())
    } catch (e) { onMsg((e as Error).message) } finally { setBusy(null) }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 rounded-[var(--r-md)] border px-3.5 py-2.5" style={{ borderColor: `${ACCENT}30`, background: `${ACCENT}0a` }}>
        <span className="font-display text-[12.5px] font-[700] text-[var(--t1)]">테스트 · 모니터</span>
        <span className="font-body text-[11.5px] text-[var(--t2)]">파이프라인이 지금 무엇을 · 어떤 상태로 · 어떻게 처리 중인지 실시간 관측</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="font-mono text-[11px] text-[var(--t3)]">{live ? `자동 새로고침 · ${relTime(new Date(lastPoll).toISOString())}` : '수동'}</span>
          <button type="button" onClick={() => setLive((v) => !v)} className="min-h-9 rounded-[var(--r-full)] border px-2.5 font-display text-[11px] font-[700] transition-colors" style={{ borderColor: live ? ACCENT : 'var(--bd)', color: live ? ACCENT : 'var(--t3)' }} aria-pressed={live}>
            {live ? '● LIVE' : '○ 정지'}
          </button>
          <button type="button" onClick={() => { void onRefresh().then(() => setLastPoll(Date.now())) }} className="min-h-9 rounded-[var(--r-full)] border border-[var(--bd)] px-2.5 font-display text-[11px] font-[700] text-[var(--t2)]">새로고침</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {dist.map((s) => (
          <div key={s.key} className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-2 text-center">
            <div className="font-display text-[18px] font-[800] tabular-nums text-[var(--t1)]">{s.n}</div>
            <div className="font-body text-[11px] text-[var(--t3)]">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 font-body text-[11.5px]">
        <span className="rounded-[var(--r-full)] px-2 py-0.5" style={{ background: 'var(--success-light)', color: 'var(--success)' }}>드레인 대상 {drainable.length}</span>
        <span className="rounded-[var(--r-full)] px-2 py-0.5" style={{ background: 'var(--p-light)', color: 'var(--p)' }}>방금 진행 {runningNow.length}</span>
        {stuck.length > 0 && <span className="rounded-[var(--r-full)] px-2 py-0.5" style={{ background: 'var(--error-light)', color: 'var(--error)' }}>멈춤 {stuck.length}</span>}
      </div>

      <SelfDevTimeline active={active} />

      <ModernizationMethods />

      {rows.length === 0 ? (
        <p className="rounded-[var(--r-md)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] px-4 py-8 text-center font-body text-[13px] text-[var(--t3)]">큐가 비어 있습니다 — 소스 탭에서 담고(테스트 모드=앞 N쪽), 여기서 진행을 지켜보세요.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sortedRows.map((r) => {
            const running = Boolean(r.lastRunAt && Date.now() - new Date(r.lastRunAt).getTime() < RECENT_MS && !r.lastError)
            const ocr = (r.qc?.ocr ?? null) as { bubbles?: number; needsReview?: number } | null
            const tookMs = typeof r.qc?.tookMs === 'number' ? (r.qc.tookMs as number) : null
            // 원본 텍스트 품질 = 그대로 쓸 수 있는 대사 비율(스캔 깨끗함·OCR 경로의 지표). 콘텐츠 간 품질 비교 근거.
            const usablePct = ocr?.bubbles ? Math.round((100 * (ocr.bubbles - (ocr.needsReview ?? 0))) / ocr.bubbles) : null
            const usableTone = usablePct == null ? 'var(--t3)' : usablePct >= 70 ? 'var(--success)' : usablePct >= 45 ? 'var(--warning)' : 'var(--error)'
            const method = (r.qc?.method ?? null) as { textSource?: string; ocrStrategy?: string; hocrUsed?: boolean; format?: string; restore?: { crop?: boolean; sat?: number; scale?: number } } | null
            return (
              <li key={r.id} className="rounded-[var(--r-lg)] border bg-[var(--bg)] px-4 py-3" style={{ borderColor: r.lastError ? 'var(--error)' : running ? ACCENT : 'var(--bd)' }}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {running && <span className="inline-block h-2 w-2 rounded-full" style={{ background: ACCENT }} aria-label="방금 진행" />}
                  <h3 className="font-display text-[14px] font-[700] text-[var(--t1)]">{r.title}</h3>
                  <span className="font-mono text-[11px] text-[var(--t3)]">{r.sourceAdapter}</span>
                  {r.acquirePages != null && <span className="rounded-[var(--r-full)] px-2 py-0.5 font-display text-[10px] font-[700]" style={{ background: `${ACCENT}1a`, color: ACCENT }}>테스트 · 앞 {r.acquirePages}쪽</span>}
                  <span className="ml-auto font-mono text-[11px] tabular-nums text-[var(--t2)]">{r.panelsTotal}컷</span>
                </div>
                <Stepper status={r.status} failed={Boolean(r.lastError)} />
                <ModernBadges modern={r.modern} />
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-[var(--t2)]">
                  <span>시도 {r.attempts}</span>
                  <span>최근 실행 {relTime(r.lastRunAt)}</span>
                  {tookMs != null && <span>{(tookMs / 1000).toFixed(1)}s</span>}
                  {ocr?.bubbles != null && <span className="text-[var(--t3)]">OCR {ocr.bubbles}대사 · 검수 {ocr.needsReview ?? 0}</span>}
                  {usablePct != null && <span className="rounded-[var(--r-full)] px-1.5 py-0.5 font-[700]" style={{ color: usableTone, background: 'var(--bg2)' }} title="그대로 쓸 수 있는 대사 비율 — 콘텐츠 품질 비교 지표(높을수록 스캔·OCR 양호)">사용가능 {usablePct}%</span>}
                  <span className="text-[var(--t3)]">PD {r.pdBasis ?? '미기재'}</span>
                </div>
                {/* 작업 방식 — 콘텐츠별 처리 경로(품질 개선 판단). 텍스트 소스(hOCR vs 이미지 OCR)·형식·복원 프로파일 */}
                {method && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="font-display text-[10px] font-[700] text-[var(--t3)]">작업 방식</span>
                    <span className="inline-flex items-center gap-1 rounded-[var(--r-full)] px-2 py-0.5 font-display text-[10px] font-[700]" style={{ color: method.hocrUsed ? 'var(--success)' : ACCENT, background: method.hocrUsed ? 'var(--success-light)' : `${ACCENT}1a` }} title={method.hocrUsed ? '원본에 텍스트/OCR 레이어가 있어 그대로 추출 — 품질 높음' : '이미지 스캔뿐이라 tesseract 로 OCR — 오탈자·파편 가능'}>
                      {method.textSource ?? (method.hocrUsed ? 'hOCR' : 'tesseract OCR')}
                    </span>
                    {method.format && <span className="rounded-[var(--r-full)] bg-[var(--bg2)] px-2 py-0.5 font-mono text-[10px] text-[var(--t3)]">형식 {method.format}</span>}
                    {method.ocrStrategy && <span className="rounded-[var(--r-full)] bg-[var(--bg2)] px-2 py-0.5 font-mono text-[10px] text-[var(--t3)]">전략 {method.ocrStrategy}</span>}
                    {method.restore && <span className="rounded-[var(--r-full)] bg-[var(--bg2)] px-2 py-0.5 font-mono text-[10px] text-[var(--t3)]">복원 crop:{String(method.restore.crop)} ·sat{method.restore.sat} ·x{method.restore.scale}</span>}
                  </div>
                )}
                {r.lastError && <p className="mt-1.5 rounded-[var(--r-sm)] bg-[var(--error-light)] px-2.5 py-1.5 font-mono text-[11px] text-[var(--error)]">멈춤: {r.lastError.slice(0, 220)}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button type="button" disabled={busy === r.id} onClick={() => void drainOne(r.id, true)} className="min-h-9 rounded-[var(--r-full)] border border-[var(--bd)] px-2.5 font-display text-[11px] font-[700] text-[var(--t2)] disabled:opacity-50">다음 단계 미리보기</button>
                  {DRAINABLE.has(r.status) && <button type="button" disabled={busy === r.id} onClick={() => void drainOne(r.id, false)} className="min-h-9 rounded-[var(--r-full)] px-2.5 font-display text-[11px] font-[700] text-white disabled:opacity-50" style={{ background: ACCENT }}>이 이슈 한 단계 진행</button>}
                  <button type="button" onClick={() => setOpenLive((o) => (o === r.id ? null : r.id))} className="min-h-9 rounded-[var(--r-full)] border px-2.5 font-display text-[11px] font-[700] transition-colors" style={{ borderColor: openLive === r.id ? ACCENT : 'var(--bd)', color: openLive === r.id ? ACCENT : 'var(--t2)' }} aria-expanded={openLive === r.id}>{openLive === r.id ? '진행 닫기' : '라이브 진행'}</button>
                  <button type="button" onClick={() => setOpen((o) => (o === r.id ? null : r.id))} className="min-h-9 rounded-[var(--r-full)] border border-[var(--bd)] px-2.5 font-display text-[11px] font-[700] text-[var(--t2)]" aria-expanded={open === r.id}>{open === r.id ? '콘텐츠 닫기' : '컷 대사'}</button>
                  <button type="button" disabled={busy === r.id} onClick={() => void modernize(r.id, 'preserve')} title="원작 작화 보존 + 색채·대사 현대화 (CPU·$0)" className="min-h-9 rounded-[var(--r-full)] border px-2.5 font-display text-[11px] font-[700] transition-colors disabled:opacity-50" style={{ borderColor: '#2E7D5A', color: '#2E7D5A' }}>{busy === r.id ? '…' : '작화보존 현대화'}</button>
                  <button type="button" disabled={busy === r.id} onClick={() => void modernize(r.id, 'restyle')} title="원작 재작화 (GPU 모델·COMFY_URL 필요)" className="min-h-9 rounded-[var(--r-full)] border px-2.5 font-display text-[11px] font-[700] transition-colors disabled:opacity-50" style={{ borderColor: `${ACCENT}`, color: ACCENT }}>AI 리스타일</button>
                  <a href={`/admin/pd-comics/reader/${r.id}`} className="min-h-9 inline-flex items-center rounded-[var(--r-full)] px-2.5 font-display text-[11px] font-[700] text-white transition-opacity hover:opacity-90" style={{ background: ACCENT }}>모던 리더 ↗</a>
                </div>
                {openLive === r.id && <LiveProgress issueId={r.id} onZoom={(rels, index) => setZoom({ issueId: r.id, rels, index })} />}
                {open === r.id && <PanelDrill issueId={r.id} />}
              </li>
            )
          })}
        </ul>
      )}
      {zoom && <Lightbox issueId={zoom.issueId} rels={zoom.rels} index={zoom.index} onIndex={(i) => setZoom((z) => (z ? { ...z, index: i } : z))} onClose={() => setZoom(null)} />}
    </div>
  )
}

// 라이트박스 — 중간 결과 이미지를 크게 보기(썸네일이 작아 세부 확인 불가). ←/→ 이동 · Esc/배경 닫기.
function Lightbox({ issueId, rels, index, onIndex, onClose }: { issueId: string; rels: string[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const clamp = (i: number) => Math.max(0, Math.min(rels.length - 1, i))
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') onIndex(clamp(index - 1))
      else if (e.key === 'ArrowRight') onIndex(clamp(index + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, rels.length])
  const rel = rels[index]
  return (
    <div role="dialog" aria-modal="true" aria-label="이미지 크게 보기" onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 p-6" style={{ background: 'rgba(0,0,0,0.82)' }}>
      <div className="flex w-full max-w-[1100px] items-center justify-between font-mono text-[12px] text-white/80" onClick={(e) => e.stopPropagation()}>
        <span>{rel} · {index + 1}/{rels.length}</span>
        <button type="button" onClick={onClose} className="rounded-[var(--r-full)] border border-white/30 px-3 py-1 font-display text-[12px] font-[700] text-white hover:bg-white/10">닫기 ✕</button>
      </div>
      <div className="flex max-h-[78vh] w-full max-w-[1100px] items-center justify-center gap-3" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => onIndex(clamp(index - 1))} disabled={index <= 0} className="min-h-11 min-w-11 rounded-[var(--r-full)] border border-white/30 text-[18px] text-white disabled:opacity-30 hover:bg-white/10" aria-label="이전">‹</button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/pdcp/artifact?issueId=${encodeURIComponent(issueId)}&rel=${encodeURIComponent(rel)}`} alt={rel} className="max-h-[78vh] max-w-full rounded-[var(--r-md)] object-contain" style={{ background: '#fff' }} />
        <button type="button" onClick={() => onIndex(clamp(index + 1))} disabled={index >= rels.length - 1} className="min-h-11 min-w-11 rounded-[var(--r-full)] border border-white/30 text-[18px] text-white disabled:opacity-30 hover:bg-white/10" aria-label="다음">›</button>
      </div>
    </div>
  )
}

// 라이브 진행 — 어디 콘텐츠의 몇 번째 아이템이 진행 중인지(진행율) + 중간 결과 이미지(원본/복원/컷)를 수시 폴링.
interface Prog { stage?: string; current?: string; done?: number; total?: number; pct?: number }
// ── 현대화 방법 (2트랙) 안내 ───────────────────────────────────────────────
// 콘솔에서 "어떤 방법으로 현대화하는지"와 실행법을 보여준다. 기본=작화 보존(Claude Code/CPU),
// 선택=AI 리스타일(GPU 모델, Kaggle 파일럿→RunPod 양산). 실제 실행은 CLI(GPU 는 외부 Kaggle/RunPod).
function ModernizationMethods() {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)]">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
        <span className="font-display text-[12.5px] font-[800] text-[var(--t1)]">현대화 방법 (2트랙)</span>
        <span className="rounded-[var(--r-full)] px-1.5 py-0.5 font-mono text-[9.5px] font-[700]" style={{ color: '#2E7D5A', background: '#2E7D5A18' }}>기본 · 작화 보존</span>
        <span className="rounded-[var(--r-full)] px-1.5 py-0.5 font-mono text-[9.5px] font-[700]" style={{ color: '#8B5CF6', background: '#8B5CF618' }}>선택 · AI 리스타일</span>
        <span className="ml-auto font-mono text-[11px] text-[var(--t3)]">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="grid gap-2.5 border-t border-[var(--bd)] p-3 md:grid-cols-2">
          <div className="rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg2)] p-2.5">
            <p className="font-display text-[12px] font-[800] text-[var(--t1)]">① 작화 보존 <span className="font-body font-[500] text-[var(--t3)]">— Claude Code / CPU · $0</span></p>
            <p className="mt-1 font-body text-[11.5px] leading-snug text-[var(--t2)]">원작 그림 <b>그대로</b> + 색채·디자인(ffmpeg)·대사(HTML)만 현대화. 저작권 안전. <b>발행 기본.</b></p>
            <pre className="mt-1.5 overflow-x-auto rounded-[var(--r-xs,4px)] bg-[var(--bg3)] p-2 font-mono text-[10px] leading-relaxed text-[var(--t2)]">page-modern.mjs --workdir work/&lt;slug&gt; --level MAX
page-html.mjs --workdir work/&lt;slug&gt;
render-check.cjs --workdir work/&lt;slug&gt;</pre>
          </div>
          <div className="rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg2)] p-2.5">
            <p className="font-display text-[12px] font-[800] text-[var(--t1)]">② AI 리스타일 <span className="font-body font-[500] text-[var(--t3)]">— GPU 모델 · 선택</span></p>
            <p className="mt-1 font-body text-[11.5px] leading-snug text-[var(--t2)]">원작을 <b>다시 그림</b>(화풍 변경, 구도 유지). <b>말풍선 지우기 → 모델 재작화 → page-letter 재부착</b>. 모델 <span className="font-mono">qwen-image-edit-2511</span>, 환경 Kaggle-t4(무료 터널)·RunPod-4090. CCP 카탈로그(<span className="font-mono">model-runners</span>) 재사용.</p>
            <pre className="mt-1.5 overflow-x-auto rounded-[var(--r-xs,4px)] bg-[var(--bg3)] p-2 font-mono text-[10px] leading-relaxed text-[var(--t2)]">connect-check.mjs        # 연결 점검(Kaggle/RunPod/ComfyUI)
# COMFY_URL 설정: Kaggle=cloudflared 터널 / RunPod=pod.mjs start
pd/modernize.mjs --workdir work/&lt;slug&gt; --model qwen-image-edit-2511 --env kaggle-t4
page-letter.mjs --workdir work/&lt;slug&gt;   # 대사 재부착</pre>
          </div>
          <p className="md:col-span-2 font-body text-[11px] text-[var(--t3)]">두 트랙 결과는 아래 각 이슈 <b>라이브 진행 → 현대화 산출물</b>에서 원작 대비로 나란히 보이고, 비교 후 <span className="font-mono">oplog</span> 로 채택/반려를 타임라인에 기록합니다. GPU 실행은 자가호스트(Kaggle 터널/RunPod)라 콘솔은 트리거·회수·비교·판정을 담당합니다. 설계: <span className="font-mono">PD_MODERNIZE_MODEL.md</span>.</p>
        </div>
      )}
    </div>
  )
}

// ── 자기발전 타임라인 ─────────────────────────────────────────────────────
// "무엇을 시도 → 단계별 평가 → 평가 기반 자기발전(개선/채택/반려/피벗)" 흐름을 한눈에.
type OpStep = { seq: number; ts: string | null; slug: string; content: string; phase: string; action: 'evaluate' | 'adopt' | 'reject' | 'improve' | 'pivot' | 'note'; title: string; detail: string; verdict: string | null; next: string | null }
type OpContent = { slug: string; content: string; total: number; lastAction: string; lastVerdict: string | null; next: string | null }

const OP_META: Record<OpStep['action'], { label: string; color: string; bg: string }> = {
  adopt: { label: '채택', color: '#2E7D5A', bg: '#2E7D5A18' },
  reject: { label: '반려', color: '#9C3A30', bg: '#9C3A3018' },
  improve: { label: '개선', color: '#B5803A', bg: '#B5803A18' },
  pivot: { label: '피벗', color: '#8B5CF6', bg: '#8B5CF618' },
  evaluate: { label: '평가', color: '#5B6470', bg: '#5B647018' },
  note: { label: '메모', color: '#8A8278', bg: '#8A827818' },
}

function SelfDevTimeline({ active }: { active: boolean }) {
  const [data, setData] = useState<{ steps: OpStep[]; contents: OpContent[] } | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    const poll = async () => {
      try { const r = await fetch('/api/pdcp/oplog', { cache: 'no-store' }); const j = await r.json(); if (alive) setData(j) } catch { /* noop */ }
    }
    void poll()
    if (!active) return () => { alive = false }
    const id = setInterval(poll, 5000)
    return () => { alive = false; clearInterval(id) }
  }, [active])

  if (!data || data.contents.length === 0) return null
  const contents = [...data.contents].sort((a, b) => b.total - a.total)

  return (
    <div className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="font-display text-[12.5px] font-[800] text-[var(--t1)]">자기발전 타임라인</span>
        <span className="font-body text-[11px] text-[var(--t3)]">시도 → 단계별 평가 → 평가 기반 자기발전. 콘텐츠 클릭 시 전체 흐름.</span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {contents.map((c) => {
          const steps = data.steps.filter((s) => s.slug === c.slug).sort((a, b) => a.seq - b.seq)
          const isOpen = open === c.slug
          const lm = OP_META[(c.lastAction as OpStep['action']) in OP_META ? (c.lastAction as OpStep['action']) : 'note']
          return (
            <li key={c.slug} className="rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg2)]">
              <button type="button" onClick={() => setOpen(isOpen ? null : c.slug)} className="flex w-full items-center gap-2 px-2.5 py-2 text-left">
                <span className="min-w-0 flex-1 truncate font-body text-[12.5px] font-[600] text-[var(--t1)]">{c.content}</span>
                {/* 단계 흐름 미니맵(한눈) — 각 스텝을 액션색 점으로 */}
                <span className="hidden items-center gap-0.5 sm:flex">
                  {steps.map((s) => <span key={s.seq} title={`${OP_META[s.action].label} · ${s.title}`} className="h-2 w-2 rounded-full" style={{ background: OP_META[s.action].color }} />)}
                </span>
                <span className="rounded-[var(--r-full)] px-1.5 py-0.5 font-mono text-[9.5px] font-[700]" style={{ color: lm.color, background: lm.bg }}>{c.lastVerdict ? c.lastVerdict.split('—')[0].trim() : lm.label}</span>
                <span className="font-mono text-[10px] tabular-nums text-[var(--t3)]">{steps.length}스텝</span>
                <span className="font-mono text-[11px] text-[var(--t3)]">{isOpen ? '▾' : '▸'}</span>
              </button>
              {isOpen && (
                <ol className="flex flex-col gap-0 border-t border-[var(--bd)] px-2.5 py-2">
                  {steps.map((s, i) => {
                    const m = OP_META[s.action]
                    return (
                      <li key={s.seq} className="relative flex gap-2.5 pb-2.5 last:pb-0">
                        {/* 세로 연결선 */}
                        {i < steps.length - 1 && <span className="absolute left-[5px] top-4 h-full w-px" style={{ background: 'var(--bd)' }} />}
                        <span className="relative z-10 mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-[var(--bg)]" style={{ background: m.color }} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="rounded-[var(--r-full)] px-1.5 py-0.5 font-mono text-[9px] font-[700]" style={{ color: m.color, background: m.bg }}>{m.label}</span>
                            <span className="font-mono text-[9.5px] text-[var(--t3)]">{s.phase}</span>
                            <span className="font-body text-[12px] font-[600] text-[var(--t1)]">{s.title}</span>
                            {s.verdict && <span className="font-mono text-[10px] font-[700]" style={{ color: m.color }}>· {s.verdict}</span>}
                          </div>
                          {s.detail && <p className="mt-0.5 font-body text-[11px] leading-snug text-[var(--t2)]">{s.detail}</p>}
                          {s.next && <p className="mt-0.5 font-body text-[10.5px] text-[var(--t3)]">→ 다음: {s.next}</p>}
                        </div>
                      </li>
                    )
                  })}
                </ol>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

type ModernArt = { key: string; label: string; preview: string | null; strip: string | null; verdict: { result?: string; [k: string]: unknown } | null }

function LiveProgress({ issueId, onZoom }: { issueId: string; onZoom: (rels: string[], index: number) => void }) {
  const [data, setData] = useState<{ workDir?: boolean; status?: string | null; panelsTotal?: number | null; progress?: Prog | null; artifacts?: Record<string, string[]>; modern?: ModernArt[] } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    const poll = async () => {
      try { const r = await fetch(`/api/pdcp/progress?issueId=${encodeURIComponent(issueId)}`, { cache: 'no-store' }); const j = await r.json(); if (alive) setData(j) }
      catch { if (alive) setErr('진행 조회 실패') }
    }
    poll(); const id = setInterval(poll, 2500) // 수시 갱신
    return () => { alive = false; clearInterval(id) }
  }, [issueId])
  if (err) return <p className="mt-2 font-body text-[11.5px] text-[var(--error)]">{err}</p>
  if (!data) return <p className="mt-2 font-body text-[11.5px] text-[var(--t3)]">불러오는 중…</p>
  if (!data.workDir) return <p className="mt-2 rounded-[var(--r-sm)] bg-[var(--bg2)] px-2.5 py-1.5 font-body text-[11.5px] text-[var(--t3)]">work 산출물이 없습니다 — 중간 이미지를 보려면 <code className="font-mono">--record</code> 로 실행하세요(<code className="font-mono">--out work/&lt;slug&gt;</code> 면 재부팅 후에도 유지).</p>
  const p = data.progress
  const KINDS: Array<[string, string]> = [['pages', '원본'], ['restored', '복원'], ['panels', '컷']]
  const anyArt = KINDS.some(([k]) => (data.artifacts?.[k]?.length ?? 0) > 0)
  return (
    <div className="mt-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-2.5">
      {p && typeof p.done === 'number' && (
        <div className="mb-2.5">
          <div className="flex items-center justify-between font-mono text-[11px] text-[var(--t2)]">
            <span>{p.stage} · {p.current ?? ''}</span>
            <span className="tabular-nums">{p.done}/{p.total} ({p.pct ?? 0}%)</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-[var(--r-full)] bg-[var(--bg3)]">
            <div className="h-full rounded-[var(--r-full)] transition-all" style={{ width: `${p.pct ?? 0}%`, background: ACCENT }} />
          </div>
        </div>
      )}
      {KINDS.map(([kind, label]) => {
        const files = data.artifacts?.[kind] ?? []
        if (!files.length) return null
        const rels = files.map((f) => `${kind}/${f}`)
        return (
          <div key={kind} className="mb-2">
            <p className="mb-1 font-mono text-[10.5px] text-[var(--t3)]">{label} {files.length}장 · 클릭하면 크게</p>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {files.slice(0, 30).map((f, idx) => (
                <button key={f} type="button" onClick={() => onZoom(rels, idx)} title={`${f} — 크게 보기`} className="shrink-0 cursor-zoom-in overflow-hidden rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] transition-shadow hover:shadow-[0_0_0_2px_var(--p)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/pdcp/artifact?issueId=${encodeURIComponent(issueId)}&rel=${encodeURIComponent(rels[idx])}`} alt={f} loading="lazy" className="h-28 w-auto object-contain" />
                </button>
              ))}
            </div>
          </div>
        )
      })}
      {(data.modern?.length ?? 0) > 0 && (
        <div className="mt-3 border-t border-[var(--bd)] pt-2.5">
          <p className="mb-1.5 font-mono text-[10.5px] font-semibold text-[var(--t2)]">현대화 산출물 (Claude Code 오퍼레이터 판정)</p>
          <div className="flex flex-col gap-2">
            {data.modern!.map((m) => {
              const res = typeof m.verdict?.result === 'string' ? m.verdict.result : null
              const tone = res?.includes('채택') ? 'var(--success,#2E7D5A)' : res?.includes('반려') ? 'var(--error,#9C3A30)' : res?.includes('현대적') ? 'var(--success,#2E7D5A)' : 'var(--warn,#B5803A)'
              const rel = m.preview ?? m.strip
              return (
                <div key={m.key} className="flex gap-2.5 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] p-2">
                  {rel && (
                    <button type="button" onClick={() => onZoom([rel], 0)} title={`${m.label} — 크게 보기`} className="shrink-0 cursor-zoom-in overflow-hidden rounded-[var(--r-xs,4px)] border border-[var(--bd)] bg-[var(--bg2)] transition-shadow hover:shadow-[0_0_0_2px_var(--p)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/pdcp/artifact?issueId=${encodeURIComponent(issueId)}&rel=${encodeURIComponent(rel)}`} alt={m.label} loading="lazy" className="h-32 w-auto object-contain" />
                    </button>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-body text-[12px] font-semibold text-[var(--t1)]">{m.label}</span>
                      {res && <span className="rounded-[var(--r-full)] px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-white" style={{ background: tone }}>{res.split('—')[0].trim()}</span>}
                    </div>
                    {res && <p className="mt-1 font-body text-[11px] leading-snug text-[var(--t2)]">{res}</p>}
                    {!res && <p className="mt-1 font-body text-[11px] text-[var(--t3)]">판정 대기 — 오퍼레이터가 프리뷰 검토 후 verdict 기록.</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {!p && !anyArt && (data.modern?.length ?? 0) === 0 && <p className="font-body text-[11.5px] text-[var(--t3)]">아직 산출물이 없습니다 — 드레인이 진행되면 여기 원본→복원→컷 이미지가 수시로 채워집니다.</p>}
    </div>
  )
}

// 컷 콘텐츠 드릴다운 — 발행 전 이슈의 대사/OCR 상태(어떤 컨텐츠가 어떻게 됐나)
function PanelDrill({ issueId }: { issueId: string }) {
  const [panels, setPanels] = useState<PdPanelAdmin[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    setPanels(null); setErr(null)
    fetch(`/api/pdcp/panels?issueId=${encodeURIComponent(issueId)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => { if (alive) setPanels((j.panels ?? []) as PdPanelAdmin[]) })
      .catch(() => { if (alive) setErr('불러오기 실패') })
    return () => { alive = false }
  }, [issueId])
  if (err) return <p className="mt-2 font-body text-[11.5px] text-[var(--error)]">{err}</p>
  if (panels === null) return <p className="mt-2 font-body text-[11.5px] text-[var(--t3)]">불러오는 중…</p>
  if (panels.length === 0) return <p className="mt-2 rounded-[var(--r-sm)] bg-[var(--bg2)] px-2.5 py-1.5 font-body text-[11.5px] text-[var(--t3)]">아직 컷 콘텐츠가 없습니다 — 컷 분할(segment) 이후 생성됩니다.</p>
  const totalBubbles = panels.reduce((a, p) => a + p.bubbles.length, 0)
  return (
    <div className="mt-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-2.5">
      <p className="mb-1.5 font-mono text-[11px] text-[var(--t2)]">컷 {panels.length} · 대사 {totalBubbles}개</p>
      <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
        {panels.map((p) => (
          <li key={p.panelOrder} className="flex gap-2.5 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] p-1.5">
            {p.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/pdcp/artifact?issueId=${encodeURIComponent(issueId)}&rel=${encodeURIComponent(p.imageUrl)}`} alt={`컷 ${p.panelOrder}`} loading="lazy" className="h-20 w-16 shrink-0 rounded-[var(--r-xs,4px)] border border-[var(--bd)] bg-[var(--bg2)] object-cover" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 font-mono text-[10.5px] text-[var(--t3)]">
                <span>#{p.panelOrder}</span>
                {p.sourcePageNo != null && <span>p.{p.sourcePageNo}</span>}
                <span className="ml-auto">대사 {p.bubbles.length}</span>
              </div>
              {p.bubbles.length > 0 ? (
                <ul className="mt-1 flex flex-col gap-0.5">
                  {p.bubbles.map((b, i) => {
                    const refined = (b as { refined?: boolean }).refined
                    return (
                      <li key={i} className="flex items-baseline gap-1.5 font-body text-[11.5px] text-[var(--t1)]">
                        <span className="shrink-0 font-mono text-[9.5px]" style={{ color: refined ? 'var(--success)' : 'var(--t4)' }}>{b.kind ?? 'speech'}{refined ? '·정제' : (typeof b.confidence === 'number' ? ` ${Math.round(b.confidence * 100)}%` : '')}</span>
                        <span className="flex-1">{b.text || <em className="text-[var(--t4)]">(빈 대사)</em>}</span>
                      </li>
                    )
                  })}
                </ul>
              ) : <p className="mt-1 font-body text-[11px] text-[var(--t4)]">대사 없음</p>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function IssueList({ rows }: { rows: PdComicAdminRow[] }) {
  if (rows.length === 0) {
    return (
      <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] px-5 py-8 text-center">
        <p className="font-display text-[15px] font-[700] text-[var(--t1)]">큐가 비어 있습니다</p>
        <p className="mt-1.5 font-body text-[13px] text-[var(--t2)]">
          <b>소스 · 대량 적재</b> 탭에서 검색해 담으세요.
        </p>
      </section>
    )
  }
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <li key={r.id} className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] px-4 py-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="font-display text-[14px] font-[700] text-[var(--t1)]">{r.title}</h3>
            <span className="font-mono text-[11px] text-[var(--t3)]">{r.sourceAdapter} · {r.sourceIdentifier}</span>
            <span className="ml-auto font-mono text-[11px] tabular-nums text-[var(--t2)]">{r.panelsTotal}컷</span>
          </div>
          <Stepper status={r.status} failed={Boolean(r.lastError)} />
          <ModernBadges modern={r.modern} />
          <p className="mt-1.5 font-body text-[11.5px] text-[var(--t2)]">
            PD 근거{' '}
            {r.pdBasis ? <b className="text-[var(--success)]">{r.pdBasis}</b> : <b className="text-[var(--warning)]">미기재 — 발행 차단</b>}
          </p>
        </li>
      ))}
    </ul>
  )
}

// 현대화 트랙 배지 — 이슈별 "어디까지 현대화됐나" 한눈에. 작화보존/AI리스타일 2트랙 상태(산출물 판정).
function ModernBadges({ modern }: { modern?: { preserve: boolean; reader: boolean; restyle: boolean } }) {
  if (!modern) return null
  const done = modern.preserve || modern.reader || modern.restyle
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      <span className="font-display text-[10px] font-[700] text-[var(--t3)]">현대화</span>
      {!done && <span className="rounded-[var(--r-full)] bg-[var(--bg2)] px-2 py-0.5 font-mono text-[10px] text-[var(--t3)]">아직 안 함</span>}
      {modern.preserve && <span className="rounded-[var(--r-full)] px-2 py-0.5 font-display text-[10px] font-[700]" style={{ color: '#2E7D5A', background: '#2E7D5A18' }}>작화보존 ✓</span>}
      {modern.reader && <span className="rounded-[var(--r-full)] px-2 py-0.5 font-display text-[10px] font-[700]" style={{ color: '#2E7D5A', background: '#2E7D5A18' }}>리더 ✓</span>}
      {modern.restyle && <span className="rounded-[var(--r-full)] px-2 py-0.5 font-display text-[10px] font-[700]" style={{ color: ACCENT, background: `${ACCENT}18` }}>AI 리스타일 ✓</span>}
    </div>
  )
}

function Stepper({ status, failed }: { status: string; failed?: boolean }) {
  // 실패해도 status 는 멈춘 단계 그대로다 — 그 단계 칩을 켜되 전체를 error 색으로 물들여
  // "여기서 멈췄다"를 한눈에 보이게 한다(정상 진행처럼 보이면 안 된다).
  const cur = stageIndex(status)
  return (
    <ol className="mt-2 flex flex-wrap items-center gap-1.5" aria-label="파이프라인 단계">
      {PD_STAGES.map((s, i) => (
        <li key={s.key}>
          <span
            className="rounded-[var(--r-full)] px-2 py-0.5 font-mono text-[10px] font-[700]"
            style={
              failed
                ? { background: 'var(--error-light)', color: 'var(--error)' }
                : i < cur
                  ? { background: 'var(--success-light)', color: 'var(--success)' }
                  : i === cur
                    ? { background: 'var(--p-light)', color: 'var(--p)' }
                    : { background: 'var(--bg2)', color: 'var(--t4)' }
            }
          >
            {s.label}
          </span>
        </li>
      ))}
    </ol>
  )
}

// ─── 도구 탭 ────────────────────────────────────────────────────────
function ToolsTab() {
  const [out, setOut] = useState<string>('')
  const [env, setEnv] = useState<Record<string, string> | null>(null)
  const [busy, setBusy] = useState(false)
  const [conn, setConn] = useState<string>('')
  const [connBusy, setConnBusy] = useState(false)

  const check = async () => {
    setBusy(true)
    try {
      const r = await fetch('/api/pdcp/doctor', { cache: 'no-store' })
      const j = await r.json()
      setOut(j.output ?? j.error ?? '')
      setEnv(j.env ?? null)
    } finally {
      setBusy(false)
    }
  }
  const connectCheck = async () => {
    setConnBusy(true)
    try {
      const r = await fetch('/api/pdcp/connect-check', { cache: 'no-store' })
      const j = await r.json()
      setConn(j.output ?? j.error ?? '')
    } finally {
      setConnBusy(false)
    }
  }
  useEffect(() => { void check() }, [])

  return (
    <div className="flex flex-col gap-3">
      <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] px-4 py-3">
        <p className="font-body text-[12.5px] leading-relaxed text-[var(--t2)]">
          드레인 실패의 대부분은 코드가 아니라 <b className="text-[var(--t1)]">외부 도구 부재</b>입니다
          (ffmpeg 없음 · TESSERACTJS_DIR 미설정 · 소스 차단). 큐가 계속 실패하면 여기부터 보세요.
        </p>
        <button
          type="button"
          onClick={() => void check()}
          disabled={busy}
          className="mt-3 min-h-[40px] rounded-[var(--r-md)] px-4 font-display text-[13px] font-[700] text-white disabled:opacity-50"
          style={{ background: ACCENT }}
        >
          {busy ? '점검 중…' : '환경 점검 실행'}
        </button>
      </section>

      {/* GPU 연결 점검 — AI 리스타일(선택 트랙)용 자가호스트 연결 */}
      <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] px-4 py-3">
        <p className="font-body text-[12.5px] leading-relaxed text-[var(--t2)]">
          <b className="text-[var(--t1)]">AI 리스타일</b>(선택 트랙)은 자가호스트 GPU(Kaggle 터널·RunPod ComfyUI)가 필요합니다.
          아래로 <b className="text-[var(--t1)]">Kaggle · RunPod · ComfyUI</b> 연결을 read-only 로 점검합니다(과금 없음).
        </p>
        <button
          type="button"
          onClick={() => void connectCheck()}
          disabled={connBusy}
          className="mt-3 min-h-[40px] rounded-[var(--r-md)] border px-4 font-display text-[13px] font-[700] disabled:opacity-50"
          style={{ borderColor: ACCENT, color: ACCENT }}
        >
          {connBusy ? '점검 중…' : 'GPU 연결 점검 (connect-check)'}
        </button>
        {conn && (
          <pre className="mt-3 overflow-auto rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-3 py-2 font-mono text-[11px] leading-relaxed text-[var(--t2)]">
            {conn}
          </pre>
        )}
      </section>

      {env && (
        <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] px-4 py-3">
          <dl className="grid gap-1 font-mono text-[11.5px] text-[var(--t2)]">
            {Object.entries(env).map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="w-[110px] shrink-0 text-[var(--t3)]">{k}</dt>
                <dd className="min-w-0 break-all text-[var(--t1)]">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {out && (
        <pre className="overflow-auto rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] px-4 py-3 font-mono text-[11px] leading-relaxed text-[var(--t2)]">
          {out}
        </pre>
      )}
    </div>
  )
}
