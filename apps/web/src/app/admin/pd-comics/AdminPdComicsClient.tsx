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

import { PD_STAGES, stageIndex, type PdComicAdminRow } from '@/lib/pd-comic/model'

const ACCENT = '#8B5CF6'

interface AdapterInfo {
  id: string
  label: string
  caps: Record<string, unknown>
  profile: Record<string, unknown>
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
  existingStatus: string | null
}

type Tab = 'source' | 'queue' | 'tools'

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
      <nav className="mb-4 flex gap-1 border-b border-[var(--bd)]" aria-label="PDCP 섹션">
        {(
          [
            ['source', '소스 · 대량 적재'],
            ['queue', '큐 · 드레인'],
            ['tools', '도구'],
          ] as Array<[Tab, string]>
        ).map(([k, label]) => (
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

      {msg && (
        <p role="status" className="mb-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-3 py-2 font-body text-[12.5px] text-[var(--t1)]">
          {msg}
        </p>
      )}

      {tab === 'source' && <SourceTab onMsg={setMsg} onEnqueued={refresh} schemaReady={schemaReady} />}
      {tab === 'queue' && <QueueTab rows={rows} onMsg={setMsg} onRefresh={refresh} />}
      {tab === 'tools' && <ToolsTab />}
    </>
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

  useEffect(() => {
    void fetch('/api/pdcp/sources')
      .then((r) => (r.ok ? r.json() : { adapters: [] }))
      .then((j) => setAdapters(j.adapters ?? []))
      .catch(() => setAdapters([]))
  }, [])

  const search = async () => {
    setBusy(true)
    setItems([])
    setSel(new Set())
    try {
      const r = await fetch('/api/pdcp/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, query, limit: 20 }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? '검색 실패')
      setItems(j.items ?? [])
      onMsg(`${j.source?.label ?? source} — ${j.items?.length ?? 0}건`)
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

        {!bulkOk && cur && (
          <p className="mt-2 rounded-[var(--r-md)] bg-[var(--warning-light)] px-3 py-2 font-body text-[12px] text-[var(--t1)]">
            {cur.label} 은 자동 대량 취득을 지원하지 않습니다({String(cur.caps.discovery)}). 사람이 정상 다운로드한 뒤{' '}
            <code className="font-mono">local-dir</code> 로 넣으세요 — 우회 크롤링은 하지 않습니다.
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
                      e.target.checked ? n.add(it.identifier) : n.delete(it.identifier)
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
                    <p className="mt-0.5 font-body text-[11.5px] text-[var(--t2)]">
                      PD:{' '}
                      {it.pdBasis ? (
                        <b className="text-[var(--success)]">{it.pdBasis}</b>
                      ) : (
                        <b className="text-[var(--warning)]">미확정</b>
                      )}{' '}
                      — {it.pdNote}
                    </p>
                    {it.existingStatus && (
                      <p className="mt-0.5 font-mono text-[11px] text-[var(--t3)]">이미 등록됨 · {it.existingStatus}</p>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
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
          <p className="mt-1.5 font-body text-[11.5px] text-[var(--t2)]">
            PD 근거{' '}
            {r.pdBasis ? <b className="text-[var(--success)]">{r.pdBasis}</b> : <b className="text-[var(--warning)]">미기재 — 발행 차단</b>}
          </p>
        </li>
      ))}
    </ul>
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
