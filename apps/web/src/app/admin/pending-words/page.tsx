// apps/web/src/app/admin/pending-words/page.tsx
// Pending Words 큐 — 사용자가 추출 시 미매칭된 lemma 누적 → admin 리뷰
//
// 데이터 흐름:
//   1. ExtractionPanel 추출 시 L1+L2 모두 miss → record_pending_words(lemmas)
//   2. 본 페이지: status='pending' + encounter_count DESC 정렬 노출
//   3. admin 액션 (Phase 2): reviewing/auto-classify/rejected/added 상태 전환

import type { SupabaseClient } from '@supabase/supabase-js'
import { Database as DatabaseIcon, Hash, Clock3 } from 'lucide-react'

import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createClient } from '@/lib/supabase/server'
import { PendingWordActions } from './PendingWordActions'

export const metadata = {
  title: 'Pending Words — Vocaflow Admin',
  description: '미매칭 lemma 큐 — 추출 시 shared_dictionary 부재 lemma 누적',
}

export const revalidate = 30 // 30초마다 fresh (운영 큐)

interface PendingWordRow {
  id: string
  lemma: string
  surface: string | null
  encounter_count: number
  status: 'pending' | 'reviewing' | 'auto-classify' | 'rejected' | 'added'
  admin_note: string | null
  created_at: string
  updated_at: string
}

const STATUS_META: Record<
  PendingWordRow['status'],
  { label: string; color: string; bg: string }
> = {
  pending: { label: '대기', color: 'var(--error)', bg: 'var(--error-light)' },
  reviewing: { label: '검토중', color: 'var(--active)', bg: 'var(--warning-light)' },
  'auto-classify': { label: 'AI 분류 예약', color: 'var(--info)', bg: 'var(--info-light)' },
  rejected: { label: '거절', color: 'var(--t3)', bg: 'var(--bg3)' },
  added: { label: '추가됨', color: 'var(--success)', bg: 'var(--success-light)' },
}

export default async function AdminPendingWordsPage() {
  await requireAdmin('/admin/pending-words')
  const client = (await createClient()) as unknown as SupabaseClient

  const [{ data: rows }, { count: pendingCount }, { count: addedCount }] = await Promise.all([
    client
      .from('pending_words')
      .select('id, lemma, surface, encounter_count, status, admin_note, created_at, updated_at')
      .order('encounter_count', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200),
    client
      .from('pending_words')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
    client
      .from('pending_words')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'added'),
  ])

  const list = ((rows ?? []) as unknown) as PendingWordRow[]
  const total = list.length
  const sumEncounters = list.reduce((acc, r) => acc + r.encounter_count, 0)
  const topLemma = list[0]?.lemma ?? '—'

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 md:px-8">
      <AdminPageHeader
        icon={DatabaseIcon}
        title="Pending Words"
        description="추출 시 L1+L2 모두 miss 한 lemma 큐 — shared_dictionary 보강 후보"
      />

      <AdminScreenHelp screen="pending-words" className="-mt-3 mb-6" />

      {/* KPI strip */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="대기 중"
          value={(pendingCount ?? 0).toLocaleString()}
          accent="var(--error)"
          bg="var(--error-light)"
        />
        <KpiCard
          label="추가됨 (누적)"
          value={(addedCount ?? 0).toLocaleString()}
          accent="var(--success)"
          bg="var(--success-light)"
        />
        <KpiCard
          label="누적 encounter"
          value={sumEncounters.toLocaleString()}
          accent="var(--info)"
          bg="var(--info-light)"
          hint="top 200 row 기준"
        />
        <KpiCard
          label="최다 발견"
          value={topLemma}
          accent="var(--p)"
          bg="var(--p-light)"
          hint={`${list[0]?.encounter_count ?? 0}회 누적`}
        />
      </div>

      {total === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[var(--r-lg)] border border-dashed border-[var(--bd)] py-12 text-center">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--success-light)] text-[var(--success)]">
            <DatabaseIcon size={18} aria-hidden />
          </span>
          <p className="font-body text-[13px] text-[var(--t2)]">큐가 비어있습니다.</p>
          <p className="font-body text-[11px] text-[var(--t2)]">
            사용자가 추출 시 미매칭 lemma 누적 시 자동으로 여기에 표시됩니다.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--r-xl)] border border-[var(--bd)] bg-[var(--bg)] shadow-[var(--sh-sm)]">
          <table className="w-full min-w-[700px] border-collapse">
            <thead>
              <tr className="border-b border-[var(--bd)] bg-[var(--bg2)]">
                <Th>lemma</Th>
                <Th align="right">encounter</Th>
                <Th align="center">status</Th>
                <Th>admin note</Th>
                <Th>updated</Th>
                <Th align="right">actions</Th>
              </tr>
            </thead>
            <tbody>
              {list.map((row) => {
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
                    <td className="px-3 py-2 text-right">
                      <span className="inline-flex items-center gap-1 font-mono text-[12px] font-[700] tabular-nums text-[var(--t1)]">
                        <Hash size={10} aria-hidden className="text-[var(--t2)]" />
                        {row.encounter_count.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className="inline-flex items-center gap-1 rounded-[var(--r-full)] px-2 py-0.5 font-display text-[10px] font-[700]"
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
      )}

      <p className="mt-4 font-mono text-[10px] text-[var(--t2)]">
        ※ admin 액션 — 각 row 우측에서 상태 전환 (검토 · AI 분류 · 추가 · 거절). RPC `update_pending_word_status` 가 user_profiles.role=&apos;admin&apos; 검증 수행.
      </p>
    </div>
  )
}

function KpiCard({
  label,
  value,
  accent,
  bg,
  hint,
}: {
  label: string
  value: string | number
  accent: string
  bg: string
  hint?: string
}) {
  return (
    <div
      className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-3 shadow-[var(--sh-sm)]"
      style={{ borderLeft: `3px solid ${accent}`, background: `linear-gradient(180deg, ${bg} 0%, var(--bg) 100%)` }}
    >
      <p className="font-display text-[10px] font-[700] uppercase tracking-[0.06em] text-[var(--t2)]">
        {label}
      </p>
      <p className="mt-0.5 font-display text-[20px] font-[800] tabular-nums text-[var(--t1)]">
        {value}
      </p>
      {hint && <p className="mt-0.5 font-body text-[10px] text-[var(--t2)]">{hint}</p>}
    </div>
  )
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' | 'center' }) {
  return (
    <th
      className="px-3 py-2 font-display text-[10px] font-[700] uppercase tracking-[0.06em] text-[var(--t2)]"
      style={{ textAlign: align }}
    >
      {children}
    </th>
  )
}
