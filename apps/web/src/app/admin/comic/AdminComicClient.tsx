// apps/web/src/app/admin/comic/AdminComicClient.tsx
// CCP admin 콘솔 클라이언트 — Catalog(큐 적재) / Published(발행·회수).
// 보라 액센트(#8B5CF6) · QC 게이트(panels_pass) 강제 발행.

'use client'

import { useMemo, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { BookImage, CheckCircle2, CircleSlash, Clock, Cpu, FlaskConical, Loader2, Plus, ShieldCheck } from 'lucide-react'
import type { ComicCatalogRow, ComicStats, ComicTest } from '@/lib/comic/admin-queries'
import { createComicTestAction, enqueueComicJobsAction, setComicPublishedAction } from './actions'

const ACCENT = '#8B5CF6'
type TabKey = 'catalog' | 'published' | 'tests'

const COMIC_STATUS_META: Record<ComicCatalogRow['comicStatus'], { label: string; tone: string }> = {
  none: { label: '없음', tone: 'var(--t3)' },
  draft: { label: '초안', tone: 'var(--info)' },
  published: { label: '발행됨', tone: 'var(--memory-stable)' },
  archived: { label: '보관', tone: 'var(--t3)' },
}

export function AdminComicClient({ rows, stats, tests }: { rows: ComicCatalogRow[]; stats: ComicStats; tests: ComicTest[] }) {
  const router = useRouter()
  const [tab, setTab] = useState<TabKey>('catalog')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pending, start] = useTransition()

  const eligibleToQueue = useMemo(
    () => rows.filter((r) => selected.has(r.bookId)),
    [rows, selected],
  )
  const publishedRows = useMemo(
    () => rows.filter((r) => r.comicStatus !== 'none'),
    [rows],
  )

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  const runEnqueue = () => {
    if (eligibleToQueue.length === 0) return
    if (!window.confirm(`${eligibleToQueue.length}권을 만화 생성 큐에 적재할까요?`)) return
    start(async () => {
      const res = await enqueueComicJobsAction(eligibleToQueue.map((r) => r.bookId))
      if (res.ok) {
        window.alert(`적재 ${res.data?.queued ?? 0}권 · 스킵 ${res.data?.skipped ?? 0}권`)
        setSelected(new Set())
        router.refresh()
      } else window.alert(`실패: ${res.error}`)
    })
  }

  const runPublish = (row: ComicCatalogRow, publish: boolean) => {
    if (!window.confirm(`"${row.title}" 만화를 ${publish ? '발행' : '회수'}할까요?`)) return
    start(async () => {
      const res = await setComicPublishedAction(row.bookId, publish)
      if (res.ok) router.refresh()
      else window.alert(`실패: ${res.error}`)
    })
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <span
          className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--r-md)] text-white"
          style={{ background: `linear-gradient(135deg, #A78BFA, ${ACCENT})` }}
          aria-hidden
        >
          <BookImage size={18} />
        </span>
        <div>
          <h1 className="font-display text-[20px] font-[800] text-[var(--t1)]">Comic Pipeline</h1>
          <p className="font-body text-[12px] text-[var(--t3)]">
            도서 → 만화 큐레이션 · 생성 · QC 게이트 · 발행 (CCP)
          </p>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="대상 도서" value={stats.eligible} Icon={BookImage} />
        <StatTile label="초안" value={stats.drafts} Icon={Clock} tone="var(--info)" />
        <StatTile label="발행됨" value={stats.published} Icon={CheckCircle2} tone="var(--memory-stable)" />
        <StatTile label="큐 대기" value={stats.queued} Icon={Loader2} tone={ACCENT} />
      </div>

      {/* 순차 작업 가이드 */}
      <div className="rounded-[var(--r-md)] border px-4 py-3" style={{ borderColor: `${ACCENT}40`, background: `${ACCENT}0a` }}>
        <p className="mb-1.5 font-display text-[12px] font-[700] text-[var(--t1)]">작업 순서</p>
        <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 font-body text-[12px] text-[var(--t2)]">
          <Step n={1}>대상 도서 선택 → <b>만화 생성 큐</b> 적재</Step>
          <Arrow />
          <Step n={2}>Claude Code 드레인(<code className="font-mono text-[11px]">generate-comic.mjs</code>)으로 컷 생성</Step>
          <Arrow />
          <Step n={3}>제목 클릭 → <b>검수</b>에서 QC·컷 확인</Step>
          <Arrow />
          <Step n={4}>QC 통과 시 <b>발행</b> → 학습자 노출</Step>
        </ol>
      </div>

      {rows.length === 0 && (
        <div className="rounded-[var(--r-md)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] px-4 py-8 text-center font-body text-[13px] text-[var(--t3)]">
          표시할 도서가 없습니다. 마이그레이션(<code className="font-mono text-[12px]">20260808120000_comic_pipeline.sql</code>) 적용 후
          ready/published 도서가 나타납니다.
        </div>
      )}

      {/* 탭 */}
      <div role="tablist" className="flex gap-1 border-b border-[var(--bd)]">
        {(['catalog', 'published', 'tests'] as TabKey[]).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-4 py-2 font-display text-[13px] font-[700] transition-colors ${
              tab === k ? 'text-[var(--t1)]' : 'border-transparent text-[var(--t3)] hover:text-[var(--t1)]'
            }`}
            style={tab === k ? { borderColor: ACCENT } : undefined}
          >
            {k === 'catalog' ? 'Catalog' : k === 'published' ? 'Published' : '테스트'}
          </button>
        ))}
      </div>

      {/* Catalog */}
      {tab === 'catalog' && (
        <div className="flex flex-col gap-3">
          {selected.size > 0 && (
            <div
              className="flex items-center justify-between rounded-[var(--r-md)] border px-4 py-2.5"
              style={{ borderColor: `${ACCENT}55`, background: `${ACCENT}0f` }}
            >
              <span className="font-display text-[13px] font-[700] text-[var(--t1)]">
                {selected.size}권 선택됨
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelected(new Set())}
                  className="rounded-[var(--r-full)] px-3 py-1.5 font-display text-[12px] font-[600] text-[var(--t3)] hover:text-[var(--t1)]"
                >
                  해제
                </button>
                <button
                  onClick={runEnqueue}
                  disabled={pending}
                  className="inline-flex items-center gap-1.5 rounded-[var(--r-full)] px-3.5 py-1.5 font-display text-[12px] font-[700] text-white disabled:opacity-50"
                  style={{ backgroundColor: ACCENT }}
                >
                  {pending ? <Loader2 size={13} className="animate-spin" /> : <BookImage size={13} />}
                  만화 생성 큐
                </button>
              </div>
            </div>
          )}
          <CatalogTable rows={rows} selected={selected} onToggle={toggle} />
        </div>
      )}

      {/* Published */}
      {tab === 'published' && (
        <div className="overflow-x-auto rounded-[var(--r-md)] border border-[var(--bd)]">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="border-b border-[var(--bd)] bg-[var(--bg2)] font-display text-[11px] uppercase tracking-wide text-[var(--t3)]">
                <Th>제목</Th><Th>만화</Th><Th>컷</Th><Th>QC</Th><Th>액션</Th>
              </tr>
            </thead>
            <tbody>
              {publishedRows.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center font-body text-[13px] text-[var(--t3)]">아직 생성된 만화가 없습니다.</td></tr>
              )}
              {publishedRows.map((r) => (
                <tr key={r.bookId} className="border-b border-[var(--bd)]/60 last:border-0">
                  <Td>
                <Link
                  href={`/admin/comic/${r.bookId}`}
                  className="font-display text-[13px] font-[600] text-[var(--t1)] underline-offset-2 hover:text-[#8B5CF6] hover:underline"
                >
                  {r.title}
                </Link>
              </Td>
                  <Td><StatusPill status={r.comicStatus} /></Td>
                  <Td className="font-mono text-[12px] tabular-nums text-[var(--t2)]">{r.panelsTotal}</Td>
                  <Td>
                    {r.panelsPass ? (
                      <span className="inline-flex items-center gap-1 font-display text-[12px] font-[700] text-[var(--memory-stable)]">
                        <ShieldCheck size={13} /> 통과
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-display text-[12px] font-[700] text-[var(--memory-risk)]">
                        <CircleSlash size={13} /> 미통과
                      </span>
                    )}
                  </Td>
                  <Td>
                    {r.comicStatus === 'published' ? (
                      <button
                        onClick={() => runPublish(r, false)}
                        disabled={pending}
                        className="rounded-[var(--r-full)] border border-[var(--bd)] px-3 py-1 font-display text-[12px] font-[700] text-[var(--t2)] hover:border-[var(--memory-risk)] hover:text-[var(--memory-risk)] disabled:opacity-50"
                      >
                        회수
                      </button>
                    ) : (
                      <button
                        onClick={() => runPublish(r, true)}
                        disabled={pending || !r.panelsPass}
                        title={!r.panelsPass ? 'QC 미통과 — 발행 불가' : undefined}
                        className="rounded-[var(--r-full)] px-3 py-1 font-display text-[12px] font-[700] text-white disabled:opacity-40"
                        style={{ backgroundColor: ACCENT }}
                      >
                        발행
                      </button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'tests' && <TestsTab tests={tests} />}
    </div>
  )
}

function TestsTab({ tests }: { tests: ComicTest[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [form, setForm] = useState({ label: '', backend: '', model: '', site: '', note: '' })
  const [msg, setMsg] = useState<string | null>(null)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const submit = () => {
    if (!form.label.trim()) { setMsg('테스트 이름을 입력하세요.'); return }
    setMsg(null)
    start(async () => {
      const res = await createComicTestAction(form)
      if (res.ok) { setForm({ label: '', backend: '', model: '', site: '', note: '' }); router.refresh() }
      else setMsg(`실패: ${res.error}`)
    })
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[var(--r-md)] border px-4 py-3" style={{ borderColor: `${ACCENT}30`, background: `${ACCENT}0a` }}>
        <p className="font-body text-[12px] leading-relaxed text-[var(--t2)]">
          <b className="text-[var(--t1)]">테스트 모드</b> — 더 나은 생성 파이프라인을 위한 실험(백엔드/모델/사이트/파라미터 A·B)을 <b>계획·기록·비교</b>합니다.
          실행은 드레인 스크립트(Claude Code)로 돌리고, 점수·비용·샘플 결과를 이 카드에 축적해 백엔드 판정(예: R30 GPT vs FLUX.2) 근거로 삼습니다.
        </p>
      </div>

      {/* 새 테스트 계획 */}
      <div className="flex flex-col gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
        <p className="font-display text-[12px] font-[700] text-[var(--t1)]">새 테스트 계획</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Field label="이름*" value={form.label} onChange={set('label')} placeholder="예: Qwen-2512 vs GPT 화풍 일관성" />
          <Field label="백엔드" value={form.backend} onChange={set('backend')} placeholder="gpt-image-2 / flux2-dev / qwen-2512" />
          <Field label="모델" value={form.model} onChange={set('model')} placeholder="체크포인트/버전" />
          <Field label="사이트" value={form.site} onChange={set('site')} placeholder="openai-api / runpod-comfyui / dashscope" />
        </div>
        <Field label="메모" value={form.note} onChange={set('note')} placeholder="가설·파라미터·기대 결과" />
        <div className="flex items-center gap-3">
          <button onClick={submit} disabled={pending} className="inline-flex items-center gap-1.5 rounded-[var(--r-full)] px-3.5 py-1.5 font-display text-[12px] font-[700] text-white disabled:opacity-50" style={{ backgroundColor: ACCENT }}>
            {pending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} 계획 추가
          </button>
          {msg && <span className="font-body text-[12px] text-[var(--memory-risk)]">{msg}</span>}
        </div>
      </div>

      {/* 테스트 목록 */}
      {tests.length === 0 ? (
        <p className="rounded-[var(--r-md)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] px-4 py-8 text-center font-body text-[13px] text-[var(--t3)]">아직 테스트가 없습니다.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {tests.map((t) => (
            <div key={t.id} className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <FlaskConical size={14} style={{ color: ACCENT }} />
                <span className="font-display text-[13px] font-[700] text-[var(--t1)]">{t.label}</span>
                <span className="rounded-[var(--r-full)] px-2 py-0.5 font-display text-[11px] font-[700]" style={{ color: t.status === 'done' ? 'var(--memory-stable)' : ACCENT, background: 'var(--bg2)' }}>{t.status}</span>
                <div className="flex-1" />
                <span className="font-mono text-[11px] text-[var(--t4)]">{new Date(t.created_at).toLocaleDateString('ko-KR')}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-[var(--t3)]">
                {t.backend && <span className="inline-flex items-center gap-1"><Cpu size={11} />{t.backend}</span>}
                {t.model && <span>· {t.model}</span>}
                {t.site && <span>· {t.site}</span>}
              </div>
              {t.result && (
                <p className="mt-2 rounded-[var(--r-sm)] bg-[var(--bg2)] px-2.5 py-1.5 font-body text-[12px] text-[var(--t2)]">
                  {Object.entries(t.result).map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join(' · ')}
                </p>
              )}
              {t.note && <p className="mt-1 font-body text-[12px] italic text-[var(--t3)]">{t.note}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-display text-[11px] font-[700] text-[var(--t3)]">{label}</span>
      <input value={value} onChange={onChange} placeholder={placeholder} className="rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg2)] px-2.5 py-1.5 font-body text-[13px] text-[var(--t1)] outline-none focus:border-[var(--active)]" />
    </label>
  )
}

function CatalogTable({
  rows,
  selected,
  onToggle,
}: {
  rows: ComicCatalogRow[]
  selected: Set<string>
  onToggle: (id: string) => void
}) {
  return (
    <div className="overflow-x-auto rounded-[var(--r-md)] border border-[var(--bd)]">
      <table className="w-full min-w-[760px] text-left">
        <thead>
          <tr className="border-b border-[var(--bd)] bg-[var(--bg2)] font-display text-[11px] uppercase tracking-wide text-[var(--t3)]">
            <Th></Th><Th>제목</Th><Th>저자</Th><Th>V</Th><Th>도서</Th><Th>만화</Th><Th>컷</Th><Th>큐</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.bookId} className="border-b border-[var(--bd)]/60 last:border-0 hover:bg-[var(--bg2)]/40">
              <Td>
                <input
                  type="checkbox"
                  checked={selected.has(r.bookId)}
                  onChange={() => onToggle(r.bookId)}
                  aria-label={`${r.title} 선택`}
                  className="h-4 w-4 accent-[#8B5CF6]"
                />
              </Td>
              <Td>
                <Link
                  href={`/admin/comic/${r.bookId}`}
                  className="font-display text-[13px] font-[600] text-[var(--t1)] underline-offset-2 hover:text-[#8B5CF6] hover:underline"
                >
                  {r.title}
                </Link>
              </Td>
              <Td className="font-body text-[12px] text-[var(--t3)]">{r.author ?? '—'}</Td>
              <Td className="font-mono text-[12px] tabular-nums text-[var(--t2)]">{r.vLevel ?? '—'}</Td>
              <Td className="font-body text-[12px] text-[var(--t3)]">{r.bookStatus}</Td>
              <Td><StatusPill status={r.comicStatus} /></Td>
              <Td className="font-mono text-[12px] tabular-nums text-[var(--t2)]">
                {r.jobStatus === 'running' && r.panelsDone != null
                  ? `${r.panelsDone}/${r.panelsTotal || '?'}`
                  : r.panelsTotal || '—'}
              </Td>
              <Td>
                {r.jobStatus ? (
                  <span
                    className="inline-flex items-center gap-1 font-display text-[11px] font-[700]"
                    style={{ color: r.jobStatus === 'failed' ? 'var(--memory-risk)' : ACCENT }}
                  >
                    {r.jobStatus === 'running' && <Loader2 size={11} className="animate-spin" />}
                    {r.jobStatus}
                  </span>
                ) : (
                  <span className="text-[var(--t4)]">—</span>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StatusPill({ status }: { status: ComicCatalogRow['comicStatus'] }) {
  const m = COMIC_STATUS_META[status]
  return (
    <span
      className="inline-flex items-center rounded-[var(--r-full)] px-2 py-0.5 font-display text-[11px] font-[700]"
      style={{ color: m.tone, backgroundColor: `color-mix(in srgb, ${m.tone} 12%, transparent)` }}
    >
      {m.label}
    </span>
  )
}

function StatTile({
  label,
  value,
  Icon,
  tone = 'var(--t2)',
}: {
  label: string
  value: number
  Icon: typeof BookImage
  tone?: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-4 py-3">
      <span
        className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--r-sm)]"
        style={{ backgroundColor: `color-mix(in srgb, ${tone} 12%, transparent)`, color: tone }}
        aria-hidden
      >
        <Icon size={15} />
      </span>
      <div>
        <p className="font-display text-[19px] font-[800] tabular-nums text-[var(--t1)]">{value}</p>
        <p className="font-body text-[11px] text-[var(--t3)]">{label}</p>
      </div>
    </div>
  )
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="inline-flex items-center gap-1.5">
      <span
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full font-display text-[10px] font-[800] text-white"
        style={{ backgroundColor: ACCENT }}
        aria-hidden
      >
        {n}
      </span>
      <span>{children}</span>
    </li>
  )
}
function Arrow() {
  return <span aria-hidden className="text-[var(--t4)]">→</span>
}

function Th({ children }: { children?: ReactNode }) {
  return <th className="px-3 py-2 font-[700]">{children}</th>
}
function Td({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 ${className}`}>{children}</td>
}
