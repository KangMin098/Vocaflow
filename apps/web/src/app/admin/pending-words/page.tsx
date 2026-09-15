// apps/web/src/app/admin/pending-words/page.tsx
// Pending Words 큐 — 사전이 해석하지 못한 lemma 누적 → admin 리뷰
//
// 데이터 흐름 (v06.35 갱신):
//   1. ExtractionPanel 추출 시 `unresolved_dict_words` 로 **해석 실패분만** 골라
//      record_pending_words(lemmas). 예전엔 "추출 결과에 없는 단어" 를 전부 보내
//      92.5% 가 오탐이었다(실측 2026-08-13).
//   2. 본 페이지: 상태 필터 + 페이지네이션으로 큐를 훑고, **조치별 분류**
//      (lib/admin/pending-words/triage)로 무엇을 해야 하는지 가른다.
//   3. admin 액션: pending/reviewing/auto-classify/rejected/added 상태 전환 (되돌리기 포함)
//
// 분류가 필요한 이유: 신호는 깨끗해졌지만 성격이 다른 항목이 섞여 있다.
// 진성 갭은 등재하면 되지만, 철자 변이는 **해석기 버그 신호**라 사전에 넣으면 안 된다.
//
// ⚠️ 이 화면은 **질의 실패를 0 으로 그리지 않는다.** 수치와 목록은 전부
//   lib/admin/pending-words/queue.ts 에서 오고, 거기서 실패는 null(모름)로 온다.
//   예전엔 세 질의의 error 를 버려 DB 장애가 "큐가 비어있습니다." 로 보였다.

import type { SupabaseClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { AlertTriangle, Database as DatabaseIcon, Hash, Clock3 } from 'lucide-react'

import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { requireAdmin } from '@/lib/auth/require-admin'
import { BUCKET_META, type PendingBucket } from '@/lib/admin/pending-words/triage'
import {
  STATUS_FILTERS,
  loadPendingQueue,
  parsePendingQueueQuery,
  pendingQueueHref,
  type Measured,
  type PendingWordStatus,
  type StatusFilter,
} from '@/lib/admin/pending-words/queue'
import { createClient } from '@/lib/supabase/server'
import { PendingWordActions } from './PendingWordActions'

export const metadata = {
  title: 'Pending Words — Vocaflow Admin',
  description: '미매칭 lemma 큐 — 추출 시 shared_dictionary 부재 lemma 누적',
}

// 상태 필터·페이지가 URL 로 오므로 정적 캐시를 쓰지 않는다.
export const dynamic = 'force-dynamic'

const STATUS_META: Record<PendingWordStatus, { label: string; color: string; bg: string }> = {
  pending: { label: '대기', color: 'var(--error)', bg: 'var(--error-light)' },
  reviewing: { label: '검토중', color: 'var(--active)', bg: 'var(--warning-light)' },
  'auto-classify': { label: 'AI 분류 예약', color: 'var(--info)', bg: 'var(--info-light)' },
  rejected: { label: '거절', color: 'var(--t3)', bg: 'var(--bg3)' },
  added: { label: '추가됨', color: 'var(--success)', bg: 'var(--success-light)' },
}

const FILTER_LABEL: Record<StatusFilter, string> = {
  pending: '대기',
  reviewing: '검토중',
  'auto-classify': 'AI 분류 예약',
  added: '추가됨',
  rejected: '거절',
  all: '전체',
}

export default async function AdminPendingWordsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  await requireAdmin('/admin/pending-words')
  const client = (await createClient()) as unknown as SupabaseClient

  const query = parsePendingQueueQuery(searchParams)
  const view = await loadPendingQueue(client, query)

  const rows = view.rows.value
  const { bucketCounts } = view
  const firstIndex = (query.page - 1) * query.pageSize + 1
  const lastIndex = firstIndex + (rows?.length ?? 0) - 1

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 md:px-8">
      <AdminPageHeader
        icon={DatabaseIcon}
        title="Pending Words"
        description="추출 시 L1+L2 모두 miss 한 lemma 큐 — shared_dictionary 보강 후보"
      />

      <AdminScreenHelp screen="pending-words" className="-mt-3 mb-6" />

      {/* KPI strip — null 은 0 이 아니라 "못 쟀음" 으로 그린다 */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="대기 중"
          measured={view.pendingCount}
          accent="var(--error)"
          bg="var(--error-light)"
          hint="status=pending 전체"
        />
        <KpiCard
          label="진성 갭 — 등재 1순위"
          measured={{
            value: bucketCounts ? bucketCounts.genuine_gap : null,
            error: view.triageError ?? view.rows.error,
          }}
          accent="var(--p)"
          bg="var(--p-light)"
          hint="이 페이지 안에서 — 사전에 정말로 없는 단어"
        />
        <KpiCard
          label="철자 변이 — 해석기 버그"
          measured={{
            value: bucketCounts ? bucketCounts.spelling_variant : null,
            error: view.triageError ?? view.rows.error,
          }}
          accent="var(--warning)"
          bg="var(--warning-light)"
          hint="이 페이지 안에서 — 0 이 아니면 resolve_dict_headword 를 고칠 것"
        />
        <KpiCard
          label="추가됨 (누적)"
          measured={view.addedCount}
          accent="var(--success)"
          bg="var(--success-light)"
          hint="status=added 전체"
        />
      </div>

      {/* 상태 필터 — 처리한 행이 목록을 잠식하지 않도록 기본은 '대기' */}
      <nav aria-label="상태 필터" className="mb-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => {
          const active = s === query.status
          return (
            <Link
              key={s}
              href={pendingQueueHref({ ...query, status: s, page: 1 })}
              aria-current={active ? 'page' : undefined}
              className={`inline-flex h-11 items-center rounded-[var(--r-full)] border px-4 font-display text-[12px] font-[700] transition-all duration-[var(--dur-normal)] ${
                active
                  ? 'border-[var(--p)] bg-[var(--p)] text-[var(--on-p)]'
                  : 'border-[var(--bd)] bg-[var(--bg)] text-[var(--t2)] hover:border-[var(--p)] hover:text-[var(--p)] active:scale-[0.98]'
              }`}
            >
              {FILTER_LABEL[s]}
            </Link>
          )
        })}
      </nav>

      {/* 목록 자체를 못 읽은 경우 — "0건" 과 절대 섞지 않는다 */}
      {view.rows.error && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-2 rounded-[var(--r-lg)] border border-[var(--error)] bg-[var(--error-light)] p-4"
        >
          <AlertTriangle size={16} aria-hidden className="mt-0.5 shrink-0 text-[var(--error)]" />
          <p className="font-body text-[13px] text-[var(--error)]">
            큐를 읽지 못했습니다 — {view.rows.error}
            <br />
            <span className="text-[var(--t2)]">
              큐가 빈 것이 아니라 <strong>못 읽은 것</strong>입니다. 처리할 항목이 없다고 판단하지
              마세요.
            </span>
          </p>
        </div>
      )}

      {/* 분류 판정 불가 — 사전 조회가 실패하면 결론이 통째로 뒤집힌다 */}
      {view.triageError && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-2 rounded-[var(--r-lg)] border border-[var(--warning)] bg-[var(--warning-light)] p-4"
        >
          <AlertTriangle size={16} aria-hidden className="mt-0.5 shrink-0 text-[var(--warning-ink)]" />
          <p className="font-body text-[13px] text-[var(--warning-ink)]">
            분류 판정 불가 — 사전 조회(<code className="font-mono">unresolved_dict_words</code>)가
            실패했습니다: {view.triageError}
            <br />
            <span className="text-[var(--t2)]">
              이 상태에서는 <strong>진성 갭 · 철자 변이 수치를 믿으면 안 됩니다</strong>. 조회가
              실패하면 모든 후보가 &quot;사전에 있음&quot; 으로 뒤집혀 없는 버그를 쫓게 됩니다.
            </span>
          </p>
        </div>
      )}

      {/* 분류 요약 — 버킷마다 조치가 다르다 */}
      {bucketCounts && rows && rows.length > 0 && (
        <ul className="mb-6 grid gap-2 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] p-4 md:grid-cols-2">
          {(Object.keys(BUCKET_META) as PendingBucket[])
            .sort((a, b) => BUCKET_META[a].priority - BUCKET_META[b].priority)
            .map((b) => (
              <li key={b} className="flex items-baseline gap-2 font-body text-[11px]">
                <span className="min-w-[74px] shrink-0 font-display font-[700] text-[var(--t1)]">
                  {BUCKET_META[b].label}
                </span>
                <span className="shrink-0 font-mono tabular-nums text-[var(--p)]">
                  {bucketCounts[b]}
                </span>
                <span className="text-[var(--t2)]">{BUCKET_META[b].action}</span>
              </li>
            ))}
        </ul>
      )}

      {rows && rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[var(--r-lg)] border border-dashed border-[var(--bd)] py-12 text-center">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--success-light)] text-[var(--success)]">
            <DatabaseIcon size={18} aria-hidden />
          </span>
          <p className="font-body text-[13px] text-[var(--t2)]">
            {query.status === 'all'
              ? '큐가 비어있습니다.'
              : `'${FILTER_LABEL[query.status]}' 상태인 항목이 없습니다.`}
          </p>
          <p className="font-body text-[11px] text-[var(--t2)]">
            {query.status === 'all'
              ? '사용자가 추출 시 미매칭 lemma 누적 시 자동으로 여기에 표시됩니다.'
              : '다른 상태에는 남아 있을 수 있습니다 — 위 필터에서 전체를 보세요.'}
          </p>
          {query.page > 1 && (
            <Link
              href={pendingQueueHref({ ...query, page: 1 })}
              className="inline-flex h-11 items-center rounded-[var(--r-md)] border border-[var(--bd)] px-4 font-display text-[12px] font-[700] text-[var(--t2)] transition-all duration-[var(--dur-normal)] hover:border-[var(--p)] hover:text-[var(--p)] active:scale-[0.98]"
            >
              첫 페이지로
            </Link>
          )}
        </div>
      ) : rows && rows.length > 0 ? (
        <div className="overflow-x-auto rounded-[var(--r-xl)] border border-[var(--bd)] bg-[var(--bg)] shadow-[var(--sh-sm)]">
          <table className="w-full min-w-[700px] border-collapse">
            <thead>
              <tr className="border-b border-[var(--bd)] bg-[var(--bg2)]">
                <Th>lemma</Th>
                <Th align="center">분류 / 조치</Th>
                <Th align="right">문서</Th>
                <Th align="right">encounter</Th>
                <Th align="center">status</Th>
                <Th>admin note</Th>
                <Th>updated</Th>
                <Th align="right">actions</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const status = STATUS_META[row.status]
                return (
                  <tr
                    key={row.id}
                    className="border-b border-[var(--bd)] transition-colors duration-[var(--dur-fast)] hover:bg-[var(--bg2)]"
                  >
                    <td className="px-3 py-2">
                      <p className="font-english text-[14px] font-[700] text-[var(--t1)]">
                        {row.lemma}
                      </p>
                      {row.surface && row.surface !== row.lemma && (
                        <p className="font-mono text-[10px] text-[var(--t2)]">
                          surface ← {row.surface}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {row.bucket ? (
                        <span
                          title={BUCKET_META[row.bucket].action}
                          className={`inline-flex items-center rounded-[var(--r-full)] px-2 py-1 font-display text-[10px] font-[700] ${
                            row.bucket === 'genuine_gap'
                              ? 'bg-[var(--p-light)] text-[var(--on-p-tint)]'
                              : row.bucket === 'spelling_variant'
                                ? 'bg-[var(--warning-light)] text-[var(--warning-ink)]'
                                : 'bg-[var(--bg3)] text-[var(--t2)]'
                          }`}
                        >
                          {BUCKET_META[row.bucket].label}
                        </span>
                      ) : (
                        <span
                          title="사전 조회가 실패해 이 lemma 의 조치를 판정하지 못했다"
                          className="inline-flex items-center gap-1 rounded-[var(--r-full)] bg-[var(--bg3)] px-2 py-1 font-display text-[10px] font-[700] text-[var(--t2)]"
                        >
                          <AlertTriangle size={9} aria-hidden />
                          판정 불가
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {/* 0 은 "문서 0편" 이 아니라 미집계다 — 2026-08-25 이전 적재분·학습자 추출분 */}
                      <span
                        title={
                          row.doc_freq > 0
                            ? `${row.doc_freq}편의 글에 등장`
                            : '미집계 (2026-08-25 이전 적재분 또는 학습자 추출분)'
                        }
                        className="font-mono text-[12px] font-[700] tabular-nums text-[var(--t1)]"
                      >
                        {row.doc_freq > 0 ? row.doc_freq.toLocaleString() : '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className="inline-flex items-center gap-1 font-mono text-[12px] font-[700] tabular-nums text-[var(--t1)]">
                        <Hash size={10} aria-hidden className="text-[var(--t2)]" />
                        {row.encounter_count.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className="inline-flex items-center gap-1 rounded-[var(--r-full)] px-2 py-1 font-display text-[10px] font-[700]"
                        style={{ backgroundColor: status.bg, color: status.color }}
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: status.color }}
                          aria-hidden
                        />
                        {status.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-body text-[11px] text-[var(--t2)]">
                      {row.admin_note ?? <span className="text-[var(--t2)]">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] text-[var(--t2)]">
                        <Clock3 size={10} aria-hidden />
                        {new Date(row.updated_at).toLocaleDateString('ko-KR', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end">
                        <PendingWordActions id={row.id} currentStatus={row.status} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* 페이지네이션 — 200행 상한 시절엔 큐의 꼬리가 화면에 도달하지 못했다 */}
      {rows && rows.length > 0 && (
        <nav
          aria-label="페이지 이동"
          className="mt-4 flex flex-wrap items-center justify-between gap-3"
        >
          <p className="font-mono text-[11px] tabular-nums text-[var(--t2)]">
            {firstIndex.toLocaleString()}–{lastIndex.toLocaleString()}
            {view.matched.value === null
              ? ' / 전체 수 모름'
              : ` / ${view.matched.value.toLocaleString()}`}
            {view.totalPages !== null && ` · ${query.page} / ${view.totalPages} 쪽`}
          </p>
          <div className="flex gap-2">
            <PageLink
              href={pendingQueueHref({ ...query, page: query.page - 1 })}
              disabled={query.page <= 1}
              label="이전"
            />
            <PageLink
              href={pendingQueueHref({ ...query, page: query.page + 1 })}
              disabled={
                view.totalPages !== null
                  ? query.page >= view.totalPages
                  : rows.length < query.pageSize
              }
              label="다음"
            />
          </div>
        </nav>
      )}

      <p className="mt-4 font-mono text-[10px] text-[var(--t2)]">
        ※ admin 액션 — 각 row 우측에서 상태 전환 (되돌리기 · 검토 · AI 분류 · 추가 · 거절). RPC
        `update_pending_word_status` 가 user_profiles.role=&apos;admin&apos; 검증 수행.
      </p>
    </div>
  )
}

function PageLink({
  href,
  disabled,
  label,
}: {
  href: string
  disabled: boolean
  label: string
}) {
  if (disabled) {
    return (
      <span
        aria-disabled="true"
        className="inline-flex h-11 cursor-not-allowed items-center rounded-[var(--r-md)] border border-[var(--bd)] px-4 font-display text-[12px] font-[700] text-[var(--t3)] opacity-40"
      >
        {label}
      </span>
    )
  }
  return (
    <Link
      href={href}
      className="inline-flex h-11 items-center rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-4 font-display text-[12px] font-[700] text-[var(--t2)] transition-all duration-[var(--dur-normal)] hover:border-[var(--p)] hover:text-[var(--p)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:scale-[0.98]"
    >
      {label}
    </Link>
  )
}

/**
 * 수치 카드. `measured.value === null` 이면 0 이 아니라 **못 쟀음**을 그린다 —
 * 여기서 0 을 그리면 "할 일이 없다" 는 거짓 안심이 화면에 박힌다.
 */
function KpiCard({
  label,
  measured,
  accent,
  bg,
  hint,
}: {
  label: string
  measured: Measured<number>
  accent: string
  bg: string
  hint?: string
}) {
  const unknown = measured.value === null
  return (
    <div
      className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-3 shadow-[var(--sh-sm)]"
      style={{
        borderLeft: `3px solid ${unknown ? 'var(--t3)' : accent}`,
        background: `linear-gradient(180deg, ${unknown ? 'var(--bg2)' : bg} 0%, var(--bg) 100%)`,
      }}
    >
      <p className="font-display text-[10px] font-[700] uppercase tracking-[0.06em] text-[var(--t2)]">
        {label}
      </p>
      <p
        className="mt-0.5 font-display text-[20px] font-[800] tabular-nums"
        style={{ color: unknown ? 'var(--t3)' : 'var(--t1)' }}
      >
        {unknown ? '—' : measured.value!.toLocaleString()}
      </p>
      {unknown ? (
        <p className="mt-0.5 flex items-start gap-1 font-body text-[10px] text-[var(--t2)]">
          <AlertTriangle size={9} aria-hidden className="mt-0.5 shrink-0" />
          <span>못 쟀음{measured.error ? ` — ${measured.error}` : ''} (0 이 아닙니다)</span>
        </p>
      ) : (
        hint && <p className="mt-0.5 font-body text-[10px] text-[var(--t2)]">{hint}</p>
      )}
    </div>
  )
}

function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode
  align?: 'left' | 'right' | 'center'
}) {
  return (
    <th
      className="px-3 py-2 font-display text-[10px] font-[700] uppercase tracking-[0.06em] text-[var(--t2)]"
      style={{ textAlign: align }}
    >
      {children}
    </th>
  )
}
