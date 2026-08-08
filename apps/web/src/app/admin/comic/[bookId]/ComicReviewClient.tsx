// apps/web/src/app/admin/comic/[bookId]/ComicReviewClient.tsx
// CCP 검수 콘솔 — 단계 stepper(앞/뒤) + QC + 컷별 검수 + 게시/회수/보관/삭제/보완.

'use client'

import { useMemo, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertTriangle, ArrowLeft, Archive, ArchiveRestore, CheckCircle2, ChevronLeft,
  ChevronRight, Loader2, RefreshCw, ShieldCheck, Trash2, Undo2, Upload,
} from 'lucide-react'
import type { ComicDetail, ComicStage } from '@/lib/comic/admin-queries'
import {
  archiveComicAction, deleteComicAction, enqueueComicJobsAction, setComicPublishedAction,
} from '../actions'

const ACCENT = '#8B5CF6'
const STAGE_FLOW: ComicStage[] = ['queued', 'generating', 'review', 'published']
const STAGE_META: Record<ComicStage, { label: string; tone: string }> = {
  none: { label: '없음', tone: 'var(--t3)' },
  queued: { label: '큐 대기', tone: ACCENT },
  generating: { label: '생성 중', tone: ACCENT },
  review: { label: '검수', tone: 'var(--info)' },
  published: { label: '게시됨', tone: 'var(--memory-stable)' },
  archived: { label: '보관', tone: 'var(--t3)' },
}

export function ComicReviewClient({ detail }: { detail: ComicDetail }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  const { bookId, title, author, bookStatus, vLevel, header, job, pages, stage } = detail
  const qc = (header?.qc_verdict ?? {}) as {
    verbatim_mismatch?: unknown[]
    rule_violations?: unknown[]
  }
  const verbatimN = Array.isArray(qc.verbatim_mismatch) ? qc.verbatim_mismatch.length : 0
  const ruleN = Array.isArray(qc.rule_violations) ? qc.rule_violations.length : 0

  // stave(chapter)별 그룹
  const byStave = useMemo(() => {
    const m = new Map<number, typeof pages>()
    for (const p of pages) {
      if (!m.has(p.chapter_idx)) m.set(p.chapter_idx, [])
      m.get(p.chapter_idx)!.push(p)
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0])
  }, [pages])

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, confirmText?: string, after?: 'list') => {
    if (confirmText && !window.confirm(confirmText)) return
    setMsg(null)
    start(async () => {
      const res = await fn()
      if (res.ok) {
        setMsg('완료되었습니다.')
        if (after === 'list') router.push('/admin/comic')
        else router.refresh()
      } else setMsg(`실패: ${res.error}`)
    })
  }

  const publish = () => run(() => setComicPublishedAction(bookId, true))
  const unpublish = () => run(() => setComicPublishedAction(bookId, false))
  const archive = () => run(() => archiveComicAction(bookId, true))
  const unarchive = () => run(() => archiveComicAction(bookId, false))
  const rework = () => run(() => enqueueComicJobsAction([bookId]), '이 도서를 재생성 큐로 되돌릴까요? (보완)')
  const del = () => run(() => deleteComicAction(bookId), `"${title}" 만화(컷 ${pages.length})를 영구 삭제할까요?`, 'list')

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/comic"
            className="inline-flex items-center gap-1.5 font-body text-[12px] font-[500] text-[var(--t3)] hover:text-[var(--t1)]"
          >
            <ArrowLeft size={14} /> Comic Pipeline
          </Link>
          <span className="text-[var(--t4)]">/</span>
          <h1 className="font-display text-[18px] font-[800] text-[var(--t1)]">{title}</h1>
          <span className="font-body text-[12px] text-[var(--t3)]">{author}</span>
          {vLevel != null && (
            <span className="rounded-[var(--r-full)] bg-[var(--bg2)] px-2 py-0.5 font-mono text-[11px] text-[var(--t2)]">V{vLevel}</span>
          )}
        </div>
        {msg && (
          <span className={`font-body text-[12px] ${msg.startsWith('실패') ? 'text-[var(--memory-risk)]' : 'text-[var(--memory-stable)]'}`}>
            {msg}
          </span>
        )}
      </div>

      {/* 파이프라인 stepper */}
      <div className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {STAGE_FLOW.map((s, i) => {
            const active = s === stage
            const done = STAGE_FLOW.indexOf(stage) > i
            const m = STAGE_META[s]
            return (
              <div key={s} className="flex items-center gap-2">
                {i > 0 && <ChevronRight size={14} className="shrink-0 text-[var(--t4)]" />}
                <span
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-[var(--r-full)] px-3 py-1 font-display text-[12px] font-[700] transition-all"
                  style={
                    active
                      ? { backgroundColor: m.tone, color: '#fff' }
                      : done
                        ? { color: m.tone, backgroundColor: `color-mix(in srgb, ${m.tone} 12%, transparent)` }
                        : { color: 'var(--t3)', backgroundColor: 'var(--bg2)' }
                  }
                >
                  {done && <CheckCircle2 size={12} />}
                  {active && (s === 'generating' || s === 'queued') && <Loader2 size={12} className="animate-spin" />}
                  {m.label}
                </span>
              </div>
            )
          })}
          {stage === 'archived' && (
            <>
              <ChevronRight size={14} className="shrink-0 text-[var(--t4)]" />
              <span className="rounded-[var(--r-full)] bg-[var(--bg2)] px-3 py-1 font-display text-[12px] font-[700] text-[var(--t3)]">
                보관됨
              </span>
            </>
          )}
        </div>

        {/* 단계 제어 (앞/뒤 + 보완/삭제) */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--bd)] pt-4">
          {/* 뒤로 */}
          {stage === 'published' && (
            <Btn onClick={unpublish} disabled={pending} icon={ChevronLeft} tone="var(--info)">회수(검수로)</Btn>
          )}
          {(stage === 'review' || stage === 'published') && (
            <Btn onClick={rework} disabled={pending} icon={Undo2}>보완(재생성 큐)</Btn>
          )}
          {stage === 'archived' && (
            <Btn onClick={unarchive} disabled={pending} icon={ArchiveRestore} tone="var(--info)">복원(검수)</Btn>
          )}

          {/* 앞으로 */}
          {stage === 'review' && (
            <Btn
              onClick={publish}
              disabled={pending || !header?.panels_pass}
              icon={Upload}
              primary
              title={!header?.panels_pass ? 'QC 미통과 — 발행 불가' : undefined}
            >
              게시 →
            </Btn>
          )}

          <div className="flex-1" />

          {/* 보관/삭제 */}
          {stage !== 'archived' && stage !== 'none' && (
            <Btn onClick={archive} disabled={pending} icon={Archive}>보관</Btn>
          )}
          <Btn onClick={del} disabled={pending} icon={Trash2} tone="var(--memory-risk)">삭제</Btn>
          <Btn onClick={() => router.refresh()} disabled={pending} icon={RefreshCw}>새로고침</Btn>
        </div>
      </div>

      {/* QC 카드 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <QcTile label="컷 수" value={String(pages.length)} />
        <QcTile
          label="QC 게이트"
          value={header?.panels_pass ? '통과' : '미통과'}
          tone={header?.panels_pass ? 'var(--memory-stable)' : 'var(--memory-risk)'}
          Icon={header?.panels_pass ? ShieldCheck : AlertTriangle}
        />
        <QcTile label="정본 불일치" value={String(verbatimN)} tone={verbatimN ? 'var(--memory-risk)' : 'var(--t2)'} />
        <QcTile label="규칙 위반" value={String(ruleN)} tone={ruleN ? 'var(--memory-shaky)' : 'var(--t2)'} />
      </div>
      {(header?.style || header?.backend || job?.error) && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 font-body text-[12px] text-[var(--t3)]">
          {header?.style && <span>화풍: <b className="text-[var(--t2)]">{header.style}</b></span>}
          {header?.backend && <span>백엔드: <b className="text-[var(--t2)]">{header.backend}</b></span>}
          {header?.published_at && <span>발행: <b className="text-[var(--t2)]">{new Date(header.published_at).toLocaleString('ko-KR')}</b></span>}
          {job?.error && <span className="text-[var(--memory-risk)]">잡 오류: {job.error}</span>}
        </div>
      )}

      {/* 컷 검수 — stave별 */}
      {pages.length === 0 ? (
        <div className="rounded-[var(--r-md)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] px-4 py-10 text-center font-body text-[13px] text-[var(--t3)]">
          아직 생성된 컷이 없습니다. 큐 적재 → Claude Code 드레인(generate-comic.mjs)으로 생성하세요.
        </div>
      ) : (
        byStave.map(([ch, list]) => (
          <section key={ch} className="flex flex-col gap-3">
            <h2 className="flex items-center gap-2 font-display text-[13px] font-[700] text-[var(--t1)]">
              <span className="rounded-[var(--r-sm)] bg-[color-mix(in_srgb,var(--info)_14%,transparent)] px-2 py-0.5 text-[var(--info)]">
                {list[0]?.stave_label ?? `Chapter ${ch}`}
              </span>
              <span className="font-body text-[12px] font-[400] text-[var(--t3)]">{list.length}컷</span>
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {list.map((p) => (
                <figure key={p.page_order} className="overflow-hidden rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)]">
                  <div className="relative bg-[var(--bg2)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.image_url}
                      alt={`컷 ${p.page_order}`}
                      loading="lazy"
                      className="aspect-[3/4] w-full object-cover"
                    />
                    <span className="absolute left-1.5 top-1.5 rounded-[var(--r-sm)] bg-black/60 px-1.5 py-0.5 font-mono text-[10px] font-[700] text-white">
                      #{p.page_order}
                    </span>
                  </div>
                  <figcaption className="flex flex-col gap-1 p-2">
                    {p.bubbles.length === 0 ? (
                      <span className="font-body text-[11px] text-[var(--t4)]">(대사 없음)</span>
                    ) : (
                      p.bubbles.map((b, bi) => (
                        <div key={bi} className="font-body text-[11px] leading-snug">
                          {b.speaker && <span className="font-[700] text-[var(--p)]">{b.speaker}: </span>}
                          <span className={b.kind === 'caption' ? 'italic text-[var(--t3)]' : 'text-[var(--t2)]'}>{b.text}</span>
                          {b.verbatim && <span title="정본(Dickens)" className="ml-1 text-[var(--memory-stable)]">✓</span>}
                        </div>
                      ))
                    )}
                    {p.target_vocab.length > 0 && (
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {p.target_vocab.map((w) => (
                          <span key={w} className="rounded-[var(--r-full)] bg-[var(--bg2)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--t3)]">{w}</span>
                        ))}
                      </div>
                    )}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}

function Btn({
  children, onClick, disabled, icon: Icon, primary, tone, title,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  icon: typeof Upload
  primary?: boolean
  tone?: string
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex items-center gap-1.5 rounded-[var(--r-full)] border px-3.5 py-1.5 font-display text-[12px] font-[700] transition-all disabled:opacity-40"
      style={
        primary
          ? { backgroundColor: ACCENT, color: '#fff', borderColor: ACCENT }
          : { color: tone ?? 'var(--t2)', borderColor: 'var(--bd)', backgroundColor: 'var(--bg)' }
      }
    >
      <Icon size={13} />
      {children}
    </button>
  )
}

function QcTile({ label, value, tone = 'var(--t1)', Icon }: { label: string; value: string; tone?: string; Icon?: typeof Upload }) {
  return (
    <div className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-4 py-3">
      <div className="flex items-center gap-1.5">
        {Icon && <Icon size={14} style={{ color: tone }} />}
        <p className="font-display text-[18px] font-[800] tabular-nums" style={{ color: tone }}>{value}</p>
      </div>
      <p className="mt-0.5 font-body text-[11px] text-[var(--t3)]">{label}</p>
    </div>
  )
}
