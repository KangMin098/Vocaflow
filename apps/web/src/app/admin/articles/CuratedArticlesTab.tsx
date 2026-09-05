// apps/web/src/app/admin/articles/CuratedArticlesTab.tsx
// ACP — Curated Articles 목록 (LCP My Library 미러).
//   상태·소스 필터 + 페이지네이션 + 멀티셀렉트 + bulk actions(Dev 일괄 / → 소스 GET)
//   + 큐 자동처리(DrainBanner) + per-row 액션(검수/처리/게시/재처리/검토대기/복원/보관/삭제).
//
// ⚠️ 이 표는 **받은 배열을 세지 않는다.** `articles` 는 서버가 상태·소스로 걸러 `.range()`
//    로 잘라 준 **한 페이지**다. 예전에는 87,968행을 전부 받아 여기서 걸렀는데, PostgREST 가
//    1,000행에서 조용히 자르는 바람에 발행 293건이 목록에도 칩 카운트에도 안 잡혔다.
//    건수는 전부 `counts`(서버 카운트)에서 온다 — 여기서 length 를 세면 그 버그가 돌아온다.

'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
  SearchCheck,
  Square,
  Trash2,
  Undo2,
  Volume2,
  X,
} from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import type { ArticleAdminRow, ArticleStatusCounts } from '@/lib/articles/types'
import { classifyArticleStatus } from '@/lib/articles/types'
import { ARTICLE_DIRECT_RPC_NAMES, ARTICLE_RPC_ROUTE } from '@/lib/articles/admin-actions'
import {
  ARTICLE_STATUS_FILTERS,
  ARTICLE_STATUS_FILTER_LABEL,
  countForFilter,
  lastPageIndex,
  type ArticleStatusFilter,
} from '@/lib/articles/console-view'
import { SOURCE_LABEL } from '@/lib/articles/source-guide'
import { resolveSourcePolicy } from '@vocaflow/library-pipeline/curation-spec'
import { computeGateItems, gatePasses } from '@/lib/articles/publish-gate'

interface Props {
  /** 서버가 걸러 잘라 준 **한 페이지**. 여기서 다시 거르지 않는다. */
  articles: ArticleAdminRow[]
  /** 상태별 서버 카운트 — 칩 숫자 · 큐 처리 버튼 · 페이지 분모. */
  counts: ArticleStatusCounts
  filter: ArticleStatusFilter
  onFilter: (f: ArticleStatusFilter) => void
  source: string | null
  onSource: (s: string | null) => void
  page: number
  pageSize: number
  /** 지금 조건(상태 칩 + 소스)의 **서버 카운트** — 페이지 분모. 목록 길이가 아니다. */
  totalForFilter: number
  onPage: (p: number) => void
  /** URL 전환 중 — 칩·페이지 버튼을 잠가 이중 이동을 막는다. */
  navPending?: boolean
  onChanged: () => void
  /** 검수 stage — 정책 게이트(pass/fail) 컬럼 노출. */
  showGate?: boolean
  /** 리스트 헤더 (검수/발행 stage 구분). */
  heading?: string
  /** 프리뷰 진입 시 복귀 stage 전달 — 검수 후 콘솔이 같은 stage 로 복귀(제자리). */
  backStage?: 'review' | 'publish'
}

const PROCESSABLE = new Set<string>(['queued', 'ingesting', 'normalizing', 'analyzing', 'curating', 'ready', 'failed'])

/** 소스 필터 드롭다운 — 라벨 정본은 source-guide 하나뿐이다(중복 정의 금지). */
const SOURCE_FILTER_OPTIONS = Object.keys(SOURCE_LABEL).sort()

interface DrainState {
  running: boolean
  rounds: number
  processed: number
  succeeded: number
  failed: number
  remaining: number | null
  error?: string
}

export function CuratedArticlesTab({
  articles,
  counts,
  filter,
  onFilter,
  source,
  onSource,
  page,
  pageSize,
  totalForFilter,
  onPage,
  navPending = false,
  onChanged,
  showGate = false,
  heading = '📂 Curated Articles',
  backStage,
}: Props) {
  const previewSuffix = backStage ? `?stage=${backStage}` : ''
  const [pending, setPending] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulk, setBulk] = useState<string | null>(null)
  const [drain, setDrain] = useState<DrainState | null>(null)
  const drainStop = useRef(false)

  // 서버가 이미 상태·소스로 걸러 왔다 — 여기서 또 거르면 필터가 두 군데가 된다.
  const visible = articles
  const visibleIds = visible.map((a) => a.id)
  const selectedRows = visible.filter((a) => selected.has(a.id))
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id))
  const queuedCount = counts.byStatus.queued

  const from = page * pageSize
  const lastPage = lastPageIndex(totalForFilter, pageSize)
  const showPager = totalForFilter > pageSize || page > 0

  const setFilterReset = (f: ArticleStatusFilter): void => {
    setSelected(new Set())
    onFilter(f)
  }
  const toggleAll = (): void => setSelected(allSelected ? new Set() : new Set(visibleIds))
  const toggleOne = (id: string): void =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  async function runAction(actionLabel: string, fn: () => Promise<void>) {
    setPending(actionLabel)
    try {
      await fn()
      onChanged()
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    } finally {
      setPending(null)
    }
  }

  async function devProcess(id: string) {
    await runAction(`dev:${id}`, async () => {
      const res = await fetch('/api/acp/dev-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_id: id }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
    })
  }

  // DEV_ADMIN_BYPASS 함정 회피 — SECURITY DEFINER RPC 는 서버 라우트(requireAdmin+service_role) 경유.
  //   매핑표는 검수 화면과 **공유한다**(lib/articles/admin-actions.ts). 화면마다 따로 두던
  //   동안 검수 화면 쪽 표에 revert/delete 가 빠져 두 버튼이 죽어 있었다.
  type LooseRpcClient = {
    rpc: (n: string, p: Record<string, unknown>) => Promise<{ error: { message: string } | null }>
  }

  // 라우트를 타지 않고 브라우저에서 바로 부르는 RPC — **이름을 리터럴로 적어 둔다**.
  // 예전엔 `client.rpc(name, …)` 처럼 변수를 넘겨서, RPC 권한 감사가 코드에서 호출자를
  // 정적으로 모을 때 이 두 개를 놓쳤다("아무도 안 부르는 함수" 로 오분류 → 회수 대상이 됨).
  // 회귀 락: src/lib/auth/__tests__/rpc-call-sites.test.ts
  const DIRECT_RPC: Record<string, (c: LooseRpcClient, id: string) => Promise<{ error: { message: string } | null }>> = {
    admin_requeue_article: (c, id) => c.rpc('admin_requeue_article', { p_article_id: id }),
    admin_archive_article: (c, id) => c.rpc('admin_archive_article', { p_article_id: id }),
  }

  async function rpcAction(name: string, id: string, actionLabel: string) {
    await runAction(actionLabel, async () => {
      const route = ARTICLE_RPC_ROUTE[name]
      if (route) {
        const res = await fetch(route, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ article_id: id }),
        })
        const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string; ok?: boolean }
        if (!res.ok || !data.ok) throw new Error(data.message ?? data.error ?? `HTTP ${res.status}`)
        return
      }
      const call = ARTICLE_DIRECT_RPC_NAMES.includes(name) ? DIRECT_RPC[name] : undefined
      // 모르는 액션을 조용히 통과시키면 "눌렀는데 아무 일도 없음" 이 된다
      if (!call) throw new Error(`알 수 없는 액션: ${name}`)
      const { error } = await call(createClient() as unknown as LooseRpcClient, id)
      if (error) throw new Error(error.message)
    })
  }

  // ── Bulk: 선택분 Dev 일괄 처리 (순차 dev-process) ──
  async function bulkDev() {
    const targets = selectedRows.filter((a) => PROCESSABLE.has(a.status))
    if (targets.length === 0) {
      alert('처리 가능한(미발행) 글을 선택하세요.')
      return
    }
    setBulk('dev')
    try {
      for (const a of targets) {
        try {
          await fetch('/api/acp/dev-process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ article_id: a.id }),
          })
        } catch {
          /* 개별 실패는 건너뜀 — 재로드로 실제 반영 확인 */
        }
        onChanged()
        await sleep(300)
      }
    } finally {
      setBulk(null)
      setSelected(new Set())
    }
  }

  // ── Bulk: 선택분 → 소스 GET (DELETE + seed unlock) ──
  async function bulkRequeue() {
    if (selected.size === 0) return
    if (
      !window.confirm(
        `선택 ${selected.size}건을 "소스 GET" 으로 되돌릴까요?\n\n` +
          '· library_articles 삭제 (어휘 CASCADE)\n' +
          '· draft 단어장 삭제 · seed 완전 unlock → 재수집 가능\n' +
          '· 발행 단어장/사용자 학습 글은 스킵\n\n되돌릴 수 없습니다.',
      )
    )
      return
    setBulk('requeue')
    try {
      const res = await fetch('/api/admin/articles/bulk-requeue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_ids: [...selected] }),
      })
      const d = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        message?: string
        deleted_count?: number
        skipped_count?: number
        seed_unlocked?: number
        blocked_by_published?: number
        blocked_by_users?: number
      }
      if (!res.ok || !d.ok) throw new Error(d.message ?? d.error ?? `HTTP ${res.status}`)
      alert(
        `→ 소스 GET 완료\n\n삭제 ${d.deleted_count ?? 0} · seed unlock ${d.seed_unlocked ?? 0}\n` +
          `스킵 ${d.skipped_count ?? 0} (발행 ${d.blocked_by_published ?? 0} · 사용자 ${d.blocked_by_users ?? 0})`,
      )
      setSelected(new Set())
      onChanged()
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    } finally {
      setBulk(null)
    }
  }

  // ── 큐 자동 처리 (status=queued 전부 drain) ──
  async function runDrain() {
    drainStop.current = false
    setDrain({ running: true, rounds: 0, processed: 0, succeeded: 0, failed: 0, remaining: null })
    const MAX_ROUNDS = 50
    for (let round = 1; round <= MAX_ROUNDS; round++) {
      if (drainStop.current) break
      let d: { ok?: boolean; error?: string; processed?: number; succeeded?: number; failed?: number; remaining?: number }
      try {
        const res = await fetch('/api/acp/dev-drain-queue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ max: 5 }),
        })
        d = await res.json()
        if (!res.ok || !d.ok) {
          setDrain((s) => (s ? { ...s, running: false, error: d.error ?? `HTTP ${res.status}` } : s))
          return
        }
      } catch (e) {
        setDrain((s) => (s ? { ...s, running: false, error: e instanceof Error ? e.message : 'network' } : s))
        return
      }
      setDrain((s) =>
        s
          ? {
              ...s,
              rounds: round,
              processed: s.processed + (d.processed ?? 0),
              succeeded: s.succeeded + (d.succeeded ?? 0),
              failed: s.failed + (d.failed ?? 0),
              remaining: d.remaining ?? null,
            }
          : s,
      )
      onChanged()
      if ((d.remaining ?? 0) === 0 || (d.processed ?? 0) === 0) break
      await sleep(400)
    }
    setDrain((s) => (s ? { ...s, running: false } : s))
  }

  return (
    <section className="flex flex-col gap-4" aria-label="Curated Articles">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">{heading}</h2>
          {/* 표시 중 / 이 필터의 전체 — 전체는 서버 카운트다(목록 길이가 아니다). */}
          <span className="font-mono text-[12px] text-[var(--t2)]">
            {visible.length === 0
              ? `0 / ${totalForFilter.toLocaleString()}건`
              : `${(from + 1).toLocaleString()}–${(from + visible.length).toLocaleString()} / ${totalForFilter.toLocaleString()}건`}
            {source ? ` · ${SOURCE_LABEL[source] ?? source}` : ''}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SourceFilter value={source} onChange={onSource} disabled={navPending} />
          {queuedCount > 0 && (
            <button
              type="button"
              onClick={runDrain}
              disabled={drain?.running}
              className="inline-flex min-h-[32px] items-center gap-2 rounded-[var(--r-sm)] bg-[var(--p)] px-3 font-display text-[11px] font-[600] text-[var(--on-p)] transition-colors hover:bg-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {drain?.running ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <Play size={12} aria-hidden />}
              큐 처리 (dev · {queuedCount})
            </button>
          )}
          <FilterChips filter={filter} setFilter={setFilterReset} counts={counts} disabled={navPending} />
        </div>
      </div>

      {drain && <DrainBanner drain={drain} onStop={() => (drainStop.current = true)} onDismiss={() => setDrain(null)} />}

      {selected.size > 0 && (
        <BulkToolbar
          count={selected.size}
          bulk={bulk}
          onDev={bulkDev}
          onRequeue={bulkRequeue}
          onClear={() => setSelected(new Set())}
        />
      )}

      {visible.length === 0 ? (
        <EmptyBox
          onReset={() => {
            onSource(null)
            setFilterReset('all')
          }}
          hasAny={counts.total > 0}
          outOfRange={page > 0 && totalForFilter > 0}
          onFirstPage={() => onPage(0)}
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--r-md)] border border-[var(--bd)]">
          <table className="w-full min-w-[960px]">
            <thead className="border-b border-[var(--bd)] bg-[var(--bg2)]">
              <tr>
                <th scope="col" className="w-9 px-2 py-2 text-center">
                  <button
                    type="button"
                    onClick={toggleAll}
                    aria-label={allSelected ? '전체 선택 해제' : '전체 선택'}
                    className="inline-flex rounded-[var(--r-sm)] text-[var(--t2)] hover:text-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
                  >
                    {allSelected ? <CheckSquare size={15} /> : <Square size={15} />}
                  </button>
                </th>
                <Th>제목</Th>
                <Th align="center">소스</Th>
                <Th align="center">상태</Th>
                <Th align="center">CEFR · V</Th>
                <Th align="center">유형</Th>
                {showGate && <Th align="center">게이트</Th>}
                <Th align="right">단어</Th>
                <Th align="right">발행</Th>
                <Th align="right" srOnly>액션</Th>
              </tr>
            </thead>
            <tbody>
              {visible.map((a) => {
                const info = classifyArticleStatus(a.status)
                const isProcessable = ['queued', 'ready', 'failed'].includes(a.status)
                const isFailed = a.status === 'failed'
                const isReady = a.status === 'ready'
                const isPublished = a.status === 'published'
                const isArchived = a.status === 'archived'
                const isDeletable = ['ready', 'archived', 'queued', 'failed'].includes(a.status)
                const isSel = selected.has(a.id)

                return (
                  <tr
                    key={a.id}
                    className="border-t border-[var(--bd)] transition-colors hover:bg-[var(--bg2)]"
                    style={isSel ? { backgroundColor: 'var(--learn-known-light)' } : undefined}
                  >
                    <td className="px-2 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => toggleOne(a.id)}
                        aria-label={isSel ? '선택 해제' : '선택'}
                        aria-pressed={isSel}
                        className="inline-flex rounded-[var(--r-sm)] text-[var(--t2)] hover:text-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
                      >
                        {isSel ? (
                          <CheckSquare size={15} style={{ color: 'var(--learn-known)' }} />
                        ) : (
                          <Square size={15} />
                        )}
                      </button>
                    </td>
                    <Td>
                      <div className="flex flex-col gap-1">
                        <Link
                          href={`/admin/articles/preview/${a.id}${previewSuffix}`}
                          className="line-clamp-1 font-display text-[13px] font-[600] text-[var(--t1)] hover:text-[var(--p)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
                        >
                          {a.title}
                        </Link>
                        {a.author && (
                          <span className="line-clamp-1 font-body text-[11px] text-[var(--t2)]">{a.author}</span>
                        )}
                        {a.status_message && (
                          <span className="line-clamp-1 font-mono text-[10px] text-[var(--learn-error)]">
                            {a.status_message}
                          </span>
                        )}
                      </div>
                    </Td>
                    <Td align="center">
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase text-[var(--t2)]">
                        {a.source}
                        {a.audio_url && <Volume2 size={11} className="text-[var(--learn-known)]" aria-label="audio" />}
                      </span>
                    </Td>
                    <Td align="center">
                      <StatusPill tone={info.tone} label={info.label} />
                    </Td>
                    <Td align="center">
                      <span className="font-mono text-[11px] tabular-nums text-[var(--t2)]">
                        {a.cefr_level ?? '—'}
                        {a.article_v_level != null && (
                          <span className="ml-1 text-[var(--t2)]">· V{a.article_v_level}</span>
                        )}
                      </span>
                    </Td>
                    <Td align="center">
                      <span className="font-mono text-[10px] text-[var(--t2)]">{a.register ?? '—'}</span>
                    </Td>
                    {showGate && (
                      <Td align="center">
                        <GateCell article={a} />
                      </Td>
                    )}
                    <Td align="right">
                      <span className="font-mono text-[11px] tabular-nums text-[var(--t2)]">
                        {a.word_count?.toLocaleString() ?? '—'}
                      </span>
                    </Td>
                    <Td align="right">
                      <span className="font-mono text-[10px] text-[var(--t2)]">
                        {a.published_at ? a.published_at.slice(0, 10) : '—'}
                      </span>
                    </Td>
                    <Td align="right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/admin/articles/preview/${a.id}${previewSuffix}`}
                          className="inline-flex h-7 items-center gap-1 rounded-[var(--r-sm)] border border-[var(--p)] px-2 font-display text-[10px] font-[600] text-[var(--p)] transition-colors hover:bg-[var(--p)] hover:text-[var(--on-p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
                          aria-label="글 검수 페이지 열기"
                        >
                          <SearchCheck size={11} aria-hidden />
                          검수
                        </Link>
                        {a.source_url && (
                          <a
                            href={a.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-7 items-center gap-1 rounded-[var(--r-sm)] border border-[var(--bd)] px-2 font-mono text-[10px] text-[var(--t2)] hover:bg-[var(--bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
                            aria-label="원본 새 탭에서 열기"
                          >
                            <ExternalLink size={10} aria-hidden />
                          </a>
                        )}
                        {isProcessable && (
                          <ActionBtn label="지금 처리" icon={<Play size={11} />} pending={pending === `dev:${a.id}`} onClick={() => devProcess(a.id)} tone="primary" />
                        )}
                        {isReady && (
                          <ActionBtn label="게시" icon={<CheckCircle2 size={11} />} pending={pending === `publish:${a.id}`} onClick={() => rpcAction('admin_force_publish_article', a.id, `publish:${a.id}`)} tone="success" />
                        )}
                        {isFailed && (
                          <ActionBtn label="재처리" icon={<RefreshCw size={11} />} pending={pending === `requeue:${a.id}`} onClick={() => rpcAction('admin_requeue_article', a.id, `requeue:${a.id}`)} tone="primary" />
                        )}
                        {isPublished && (
                          <ActionBtn
                            label="검토대기"
                            icon={<Undo2 size={11} />}
                            pending={pending === `revert:${a.id}`}
                            onClick={() => {
                              if (!window.confirm(`"${a.title}" 을(를) 검토대기로 되돌릴까요?\n\n· published → ready\n· 게시 단어장 삭제 · 본문/어휘 보존(재게시 시 재생성)`)) return
                              void rpcAction('admin_revert_published_article', a.id, `revert:${a.id}`)
                            }}
                            tone="neutral"
                          />
                        )}
                        {isArchived && (
                          // 보관 20,053건에 삭제 말고도 나갈 길을 준다. admin_requeue_article 은
                          //   상태 가드가 없어 archived 에서도 돈다 — 다만 도착지는 ready 가
                          //   아니라 **queued** 다(status_message 도 지워진다). 그래서 라벨을
                          //   "검토대기" 로 쓰지 않는다: 복원 뒤 "지금 처리" 를 한 번 더 돌려야
                          //   ready 가 되고, 그 처리에는 LLM 비용이 다시 붙는다.
                          <ActionBtn
                            label="큐로 복원"
                            title="보관 해제 → 대기(queued). 검수하려면 '지금 처리'로 재분석해야 하고 LLM 비용이 다시 발생합니다."
                            icon={<RotateCcw size={11} />}
                            pending={pending === `restore:${a.id}`}
                            onClick={() => rpcAction('admin_requeue_article', a.id, `restore:${a.id}`)}
                            tone="primary"
                          />
                        )}
                        {!isArchived && !isPublished && (
                          <ActionBtn label="보관" icon={<Archive size={11} />} pending={pending === `archive:${a.id}`} onClick={() => rpcAction('admin_archive_article', a.id, `archive:${a.id}`)} tone="neutral" />
                        )}
                        {isDeletable && (
                          <ActionBtn
                            label="삭제"
                            icon={<Trash2 size={11} />}
                            pending={pending === `delete:${a.id}`}
                            onClick={() => {
                              if (!window.confirm(`"${a.title}" 을(를) 영구 삭제할까요?\n\n· 본체 + 어휘 CASCADE 삭제\n· seed 완전 unlock → 재수집 가능\n· 발행 단어장 삭제 · 사용자 진도 마커 보존\n\n되돌릴 수 없습니다.`)) return
                              void rpcAction('admin_delete_article', a.id, `delete:${a.id}`)
                            }}
                            tone="danger"
                          />
                        )}
                      </div>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showPager && (
        <Pager
          page={page}
          lastPage={lastPage}
          from={from}
          shown={visible.length}
          total={totalForFilter}
          disabled={navPending}
          onPage={(p) => {
            setSelected(new Set())
            onPage(p)
          }}
        />
      )}
    </section>
  )
}

// ── 페이지네이션 ─────────────────────────────────
//
// 보관 20,053건·대기 48,571건을 한 화면에 그리지 않는다. 분모는 서버 카운트이고
// 표는 `.range()` 한 조각이라, "다음" 을 눌러야 다음 100건이 서버에서 온다.

function Pager({
  page,
  lastPage,
  from,
  shown,
  total,
  disabled,
  onPage,
}: {
  page: number
  lastPage: number
  from: number
  shown: number
  total: number
  disabled: boolean
  onPage: (p: number) => void
}) {
  const canPrev = page > 0
  const canNext = page < lastPage
  return (
    <nav
      aria-label="목록 페이지"
      className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-3 py-2"
    >
      <span className="font-mono text-[11px] tabular-nums text-[var(--t2)]">
        {shown > 0
          ? `${(from + 1).toLocaleString()}–${(from + shown).toLocaleString()}`
          : '0'}{' '}
        / {total.toLocaleString()}건 · {page + 1}쪽 / {lastPage + 1}쪽
      </span>
      <div className="flex items-center gap-1">
        <PagerBtn
          label="이전"
          icon={<ChevronLeft size={12} aria-hidden />}
          disabled={disabled || !canPrev}
          onClick={() => onPage(page - 1)}
        />
        <PagerBtn
          label="다음"
          icon={<ChevronRight size={12} aria-hidden />}
          iconRight
          disabled={disabled || !canNext}
          onClick={() => onPage(page + 1)}
        />
      </div>
    </nav>
  )
}

function PagerBtn({
  label,
  icon,
  iconRight = false,
  disabled,
  onClick,
}: {
  label: string
  icon: React.ReactNode
  iconRight?: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'inline-flex min-h-[32px] items-center gap-1 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-3',
        'font-display text-[11px] font-[600] text-[var(--t2)]',
        'transition-colors duration-[var(--dur-normal)] ease-[var(--ease)]',
        'hover:bg-[var(--bg2)] hover:text-[var(--t1)] active:bg-[var(--bg2)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]',
        'disabled:cursor-not-allowed disabled:opacity-40',
      ].join(' ')}
    >
      {!iconRight && icon}
      {label}
      {iconRight && icon}
    </button>
  )
}

// ── 소스 필터 ────────────────────────────────────

function SourceFilter({
  value,
  onChange,
  disabled,
}: {
  value: string | null
  onChange: (s: string | null) => void
  disabled: boolean
}) {
  return (
    <label className="inline-flex items-center gap-1">
      <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--t2)]">소스</span>
      <select
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value ? e.target.value : null)}
        className={[
          'min-h-[32px] rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-2',
          'font-display text-[11px] font-[600] text-[var(--t2)]',
          'transition-colors duration-[var(--dur-normal)] ease-[var(--ease)]',
          'hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]',
          'disabled:cursor-not-allowed disabled:opacity-40',
        ].join(' ')}
      >
        <option value="">전체</option>
        {SOURCE_FILTER_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {SOURCE_LABEL[s] ?? s}
          </option>
        ))}
      </select>
    </label>
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// ── 정책 게이트 셀 (검수 stage) — pass/total + hover 상세 ──

function GateCell({ article }: { article: ArticleAdminRow }) {
  const policy = resolveSourcePolicy(article.source)
  const items = computeGateItems(policy, {
    audioUrl: article.audio_url,
    lexicalNoise: article.lexical_noise,
    articleVLevel: article.article_v_level,
    sourceUrl: article.source_url,
    author: article.author,
    license: article.license,
  })
  const passCount = items.filter((i) => i.pass).length
  const allPass = gatePasses(items)
  const title = items.map((i) => `${i.pass ? '✓' : '✕'} ${i.label}`).join('\n')
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1 font-mono text-[10px] font-[700] tabular-nums"
      style={{ color: allPass ? 'var(--learn-known)' : 'var(--learn-error)' }}
      aria-label={`게이트 ${passCount}/${items.length} 통과`}
    >
      {allPass ? <CheckCircle2 size={12} aria-hidden /> : <AlertCircle size={12} aria-hidden />}
      {passCount}/{items.length}
    </span>
  )
}

// ── Bulk toolbar ─────────────────────────────────

function BulkToolbar({
  count,
  bulk,
  onDev,
  onRequeue,
  onClear,
}: {
  count: number
  bulk: string | null
  onDev: () => void
  onRequeue: () => void
  onClear: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[var(--r-md)] border border-[var(--p)] bg-[var(--p-wash,var(--bg2))] px-3 py-2">
      <span className="font-display text-[12px] font-[700] text-[var(--p)]">{count}건 선택</span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onDev}
          disabled={bulk != null}
          className="inline-flex min-h-[32px] items-center gap-2 rounded-[var(--r-sm)] bg-[var(--p)] px-3 font-display text-[11px] font-[600] text-[var(--on-p)] transition-colors hover:bg-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {bulk === 'dev' ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <Play size={12} aria-hidden />}
          Dev 일괄 처리
        </button>
        <button
          type="button"
          onClick={onRequeue}
          disabled={bulk != null}
          className="inline-flex min-h-[32px] items-center gap-2 rounded-[var(--r-sm)] border border-[var(--learn-error)] bg-[var(--bg)] px-3 font-display text-[11px] font-[600] text-[var(--learn-error)] transition-colors hover:bg-[var(--learn-error-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {bulk === 'requeue' ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <Download size={12} aria-hidden />}
          → 소스 GET
        </button>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex min-h-[32px] items-center gap-1 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-2 font-display text-[11px] font-[600] text-[var(--t2)] hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        >
          <X size={12} aria-hidden />
          해제
        </button>
      </div>
    </div>
  )
}

// ── Drain banner ─────────────────────────────────

function DrainBanner({ drain, onStop, onDismiss }: { drain: DrainState; onStop: () => void; onDismiss: () => void }) {
  const tone = drain.error ? 'var(--learn-error)' : drain.running ? 'var(--learn-fresh)' : 'var(--learn-known)'
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-3 rounded-[var(--r-md)] border px-3 py-2"
      style={{ borderColor: tone, backgroundColor: 'var(--bg2)' }}
    >
      {drain.running ? (
        <Loader2 size={14} className="animate-spin" style={{ color: tone }} aria-hidden />
      ) : (
        <CheckCircle2 size={14} style={{ color: tone }} aria-hidden />
      )}
      <span className="font-display text-[12px] font-[600]" style={{ color: tone }}>
        {drain.error ? `큐 처리 오류: ${drain.error}` : drain.running ? '큐 처리 중…' : '큐 처리 완료'}
      </span>
      <span className="font-mono text-[11px] text-[var(--t2)]">
        라운드 {drain.rounds} · 처리 {drain.processed} · 성공 {drain.succeeded} · 실패 {drain.failed}
        {drain.remaining != null && ` · 남음 ${drain.remaining}`}
      </span>
      <div className="ml-auto flex items-center gap-2">
        {drain.running ? (
          <button
            type="button"
            onClick={onStop}
            className="inline-flex h-7 items-center gap-1 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-2 font-display text-[10px] font-[600] text-[var(--t2)] hover:bg-[var(--bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            <X size={11} aria-hidden /> 중지
          </button>
        ) : (
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex h-7 items-center gap-1 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-2 font-display text-[10px] font-[600] text-[var(--t2)] hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            닫기
          </button>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ───────────────────────────────

/**
 * 상태 칩 — 숫자는 **서버 카운트**다.
 *
 * 예전에는 받은 배열을 상태별로 세었다. 그 배열이 1,000행에서 잘린 뒤로 "게시됨 0"
 * 이라 적혀 있었고(실제 293), 관리자는 4발행 탭이 원래 비어 있는 줄 알았다.
 */
function FilterChips({
  filter,
  setFilter,
  counts,
  disabled,
}: {
  filter: ArticleStatusFilter
  setFilter: (f: ArticleStatusFilter) => void
  counts: ArticleStatusCounts
  disabled: boolean
}) {
  return (
    <div role="radiogroup" className="inline-flex flex-wrap rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg2)] p-1">
      {ARTICLE_STATUS_FILTERS.map((value) => {
        const active = filter === value
        const count = countForFilter(counts, value)
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => setFilter(value)}
            className={[
              'rounded-[var(--r-sm)] px-3 py-1 font-display text-[11px] font-[600] transition-colors duration-[var(--dur-normal)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]',
              'disabled:cursor-not-allowed disabled:opacity-50',
              active ? 'bg-[var(--bg)] text-[var(--t1)] shadow-[var(--sh-xs)]' : 'text-[var(--t2)] hover:text-[var(--t2)]',
            ].join(' ')}
          >
            {ARTICLE_STATUS_FILTER_LABEL[value]}
            {count > 0 && (
              <span className="ml-1 font-mono text-[10px] tabular-nums text-[var(--t2)]">
                {count.toLocaleString()}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function ActionBtn({
  label,
  icon,
  pending,
  onClick,
  tone,
  title,
}: {
  label: string
  icon: React.ReactNode
  pending: boolean
  /** 액션은 대부분 비동기다 — `() => void` 로 좁혀 두면 호출부가 `void` 로 덧칠하게 된다. */
  onClick: () => void | Promise<void>
  tone: 'primary' | 'success' | 'neutral' | 'danger'
  /**
   * 라벨이 말하지 않는 결과를 덧붙인다 (되돌리기 가능 여부 · 도착 상태 · 비용).
   * 라벨은 7자를 넘기면 표가 깨져서, 이 자리가 없으면 관리자가 결과를 모른 채 누른다.
   */
  title?: string
}) {
  const cls =
    tone === 'primary'
      ? 'bg-[var(--p)] hover:bg-[var(--p-hover)] text-[var(--ti)]'
      : tone === 'success'
        ? 'bg-[var(--learn-known)] hover:opacity-90 text-white'
        : tone === 'danger'
          ? 'border border-[var(--learn-error)] bg-[var(--bg)] text-[var(--learn-error)] hover:bg-[var(--learn-error-light)]'
          : 'border border-[var(--bd)] bg-[var(--bg)] hover:bg-[var(--bg2)] text-[var(--t2)]'
  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={pending}
      title={title}
      className={`inline-flex h-7 items-center gap-1 rounded-[var(--r-sm)] px-2 font-display text-[10px] font-[600] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${cls}`}
    >
      {pending ? <Loader2 size={11} className="animate-spin" aria-hidden /> : icon}
      {label}
    </button>
  )
}

function StatusPill({ tone, label }: { tone: 'success' | 'warning' | 'info' | 'danger' | 'neutral'; label: string }) {
  const colorMap: Record<typeof tone, { bg: string; fg: string }> = {
    success: { bg: 'var(--learn-known-light)', fg: 'var(--learn-known)' },
    warning: { bg: 'var(--learn-review-light)', fg: 'var(--learn-review)' },
    info: { bg: 'var(--learn-fresh-light)', fg: 'var(--learn-fresh)' },
    danger: { bg: 'var(--learn-error-light)', fg: 'var(--learn-error)' },
    neutral: { bg: 'var(--bg2)', fg: 'var(--t3)' },
  }
  const c = colorMap[tone]
  return (
    <span
      className="inline-flex items-center rounded-[var(--r-sm)] px-2 py-1 font-display text-[10px] font-[700]"
      style={{ background: c.bg, color: c.fg }}
    >
      {label}
    </span>
  )
}

function Th({ children, align = 'left', srOnly }: { children: React.ReactNode; align?: 'left' | 'center' | 'right'; srOnly?: boolean }) {
  return (
    <th
      scope="col"
      className={[
        'px-3 py-2',
        align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left',
        'font-mono text-[10px] uppercase tracking-wider text-[var(--t2)]',
      ].join(' ')}
    >
      {srOnly ? <span className="sr-only">{children}</span> : children}
    </th>
  )
}

function Td({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'center' | 'right' }) {
  return (
    <td className={['px-3 py-3', align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'].join(' ')}>
      {children}
    </td>
  )
}

/**
 * 빈 화면에는 **다음 한 걸음**이 반드시 있어야 한다(CLAUDE.md D4).
 * 여기 빈 화면은 세 가지 뜻이라 각각 다른 길을 준다:
 *   ① 페이지를 넘겨 범위 밖으로 나갔다 → 첫 쪽으로
 *   ② 필터에 걸리는 글이 없다 → 필터 초기화
 *   ③ 정말 글이 하나도 없다 → 소스 GET
 */
function EmptyBox({
  onReset,
  hasAny,
  outOfRange,
  onFirstPage,
}: {
  onReset: () => void
  hasAny: boolean
  outOfRange: boolean
  onFirstPage: () => void
}) {
  const title = outOfRange
    ? '이 쪽에는 글이 없어요'
    : hasAny
      ? '필터에 해당하는 글이 없어요'
      : '아직 추가된 글이 없어요'
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-2 rounded-[var(--r-md)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] py-12 text-center">
      <div className="select-none text-2xl" aria-hidden>
        {hasAny ? '🔍' : '📭'}
      </div>
      <h3 className="font-display text-[14px] font-[700] text-[var(--t1)]">{title}</h3>
      {outOfRange ? (
        <button
          type="button"
          onClick={onFirstPage}
          className="min-h-[36px] rounded-[var(--r-sm)] bg-[var(--p)] px-3 py-2 font-display text-[11px] font-[600] text-[var(--on-p)] transition-colors hover:bg-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
        >
          첫 쪽으로
        </button>
      ) : hasAny ? (
        <button
          type="button"
          onClick={onReset}
          className="min-h-[36px] rounded-[var(--r-sm)] bg-[var(--p)] px-3 py-2 font-display text-[11px] font-[600] text-[var(--on-p)] transition-colors hover:bg-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
        >
          필터 초기화
        </button>
      ) : (
        <p className="font-body text-[12px] text-[var(--t2)]">소스 GET 에서 기사를 골라 큐에 추가하세요.</p>
      )}
    </div>
  )
}
