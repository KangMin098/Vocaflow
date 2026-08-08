// apps/web/src/app/admin/comic/[bookId]/ComicReviewClient.tsx
// CCP 검수 콘솔 — 단계 stepper(앞/뒤) + QC + 컷별 검수 + 게시/회수/보관/삭제/보완.

'use client'

import { useEffect, useMemo, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertTriangle, ArrowLeft, Archive, ArchiveRestore, CheckCircle2, ChevronLeft,
  ChevronRight, Cpu, Loader2, Palette, RefreshCw, ShieldCheck, Trash2, Undo2, Upload,
} from 'lucide-react'
import type { ComicDetail, ComicStage, ComicStyle } from '@/lib/comic/admin-queries'
import {
  archiveComicAction, deleteComicAction, enqueueComicJobsAction, setBookStyleAction, setComicPublishedAction,
} from '../actions'

const ACCENT = '#8B5CF6'
const STAGE_FLOW: ComicStage[] = ['queued', 'generating', 'review', 'published']
const STAGE_HINT: Record<ComicStage, string> = {
  none: '아직 만화가 없습니다. Comic Pipeline(Catalog)에서 이 도서를 "만화 생성 큐"에 적재하세요.',
  queued: 'Claude Code 드레인으로 컷을 생성하세요 — node scripts/lcp/generate-comic.mjs plan → content → insert. 완료 후 새로고침.',
  generating: '생성이 진행 중입니다. 진행(패널 수)이 자동으로 갱신됩니다.',
  review: '컷과 QC(정본 불일치·규칙 위반)를 확인하세요. 이상 없으면 [게시 →], 문제가 있으면 [보완]으로 재생성 큐에 되돌립니다.',
  published: '학습자에게 노출 중입니다. 내용을 고치려면 [회수(검수로)] 후 [보완], 잠시 숨기려면 [보관]하세요.',
  archived: '보관된 만화입니다. [복원(검수)]으로 검수 상태로 되돌린 뒤 다시 발행할 수 있습니다.',
}
const STAGE_META: Record<ComicStage, { label: string; tone: string }> = {
  none: { label: '없음', tone: 'var(--t3)' },
  queued: { label: '큐 대기', tone: ACCENT },
  generating: { label: '생성 중', tone: ACCENT },
  review: { label: '검수', tone: 'var(--info)' },
  published: { label: '게시됨', tone: 'var(--memory-stable)' },
  archived: { label: '보관', tone: 'var(--t3)' },
}

// 검수 그리드 썸네일 — Supabase 이미지 변환(90 full-res 로드 회피). 변환 미지원 시 원본 폴백(onError).
function thumb(url: string): string {
  if (!url.includes('/storage/v1/object/public/')) return url
  const t = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/')
  return `${t}${t.includes('?') ? '&' : '?'}width=320&quality=60&resize=contain`
}

export function ComicReviewClient({ detail, styles }: { detail: ComicDetail; styles: ComicStyle[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  const [styleBusy, setStyleBusy] = useState(false)
  const setStyle = (key: string) => {
    setStyleBusy(true); setMsg(null)
    start(async () => {
      const r = await setBookStyleAction(detail.bookId, key || null)
      setStyleBusy(false)
      if (r.ok) router.refresh(); else setMsg(`스타일 지정 실패: ${r.error}`)
    })
  }
  const curStyle = styles.find((s) => s.key === detail.header?.style_key)

  // 생성 중 실시간 진행 — 5s마다 서버 데이터 갱신(패널 수/단계)
  useEffect(() => {
    if (detail.stage !== 'generating' && detail.stage !== 'queued') return
    const id = setInterval(() => router.refresh(), 5000)
    return () => clearInterval(id)
  }, [detail.stage, router])

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

  const publish = () => run(() => setComicPublishedAction(bookId, true), '이 만화를 발행해 학습자에게 노출할까요?')
  const unpublish = () => run(() => setComicPublishedAction(bookId, false), '발행을 회수해 학습자 노출을 중단할까요?')
  const archive = () =>
    run(
      () => archiveComicAction(bookId, true),
      stage === 'published' ? '발행 중인 만화를 보관(노출 즉시 중단)할까요?' : '이 만화를 보관할까요?',
    )
  const unarchive = () => run(() => archiveComicAction(bookId, false), '보관을 해제해 검수 상태로 되돌릴까요?')
  const rework = () =>
    run(
      async () => {
        const res = await enqueueComicJobsAction([bookId])
        if (res.ok && (res.data?.queued ?? 0) === 0)
          return { ok: false, error: '큐 적재 대상이 아닙니다 (도서 상태 확인).' }
        return res
      },
      '이 도서를 재생성 큐로 되돌릴까요? (발행 중이면 자동으로 미발행됩니다)',
    )
  const del = () =>
    run(
      () => deleteComicAction(bookId),
      stage === 'published'
        ? `⚠️ 발행 중인 만화입니다. 삭제하면 학습자 열람이 즉시 중단됩니다.\n"${title}" 만화(컷 ${pages.length})를 영구 삭제할까요?`
        : `"${title}" 만화(컷 ${pages.length})를 영구 삭제할까요?`,
      'list',
    )

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
          <Link href={`/admin/comic/${bookId}/drain`} className="inline-flex items-center gap-1 rounded-[var(--r-full)] border px-2.5 py-1 font-display text-[11px] font-[700]" style={{ borderColor: `${ACCENT}55`, color: ACCENT }}>
            <Cpu size={12} /> 드레인 관측 →
          </Link>
        </div>
        {msg && (
          <span className={`font-body text-[12px] ${msg.startsWith('실패') ? 'text-[var(--memory-risk)]' : 'text-[var(--memory-stable)]'}`}>
            {msg}
          </span>
        )}
      </div>

      {/* 만화 스타일 선택 (포맷×연령×장르×난이도) */}
      <div className="flex flex-wrap items-center gap-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
        <span className="inline-flex items-center gap-1.5 font-display text-[13px] font-[700] text-[var(--t1)]">
          <Palette size={15} style={{ color: ACCENT }} /> 만화 스타일
        </span>
        <select
          aria-label="만화 스타일 선택"
          value={detail.header?.style_key ?? ''}
          disabled={styleBusy}
          onChange={(e) => setStyle(e.target.value)}
          className="min-h-11 min-w-[240px] rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg2)] px-2.5 py-1.5 font-body text-[13px] text-[var(--t1)] outline-none focus:border-[var(--active)] disabled:opacity-50"
        >
          <option value="">— 스타일 선택 —</option>
          {styles.filter((s) => s.status !== 'rejected').map((s) => (
            <option key={s.key} value={s.key}>{s.name} · {s.format}/{s.age_band}/{s.genre} · V{s.difficulty_min ?? 0}–{s.difficulty_max ?? 11}</option>
          ))}
        </select>
        {styleBusy && <Loader2 size={14} className="animate-spin text-[var(--t3)]" />}
        {curStyle && (
          <span className="font-body text-[12px] text-[var(--t3)]">{curStyle.palette} · 생성 시 이 art_prompt 적용</span>
        )}
      </div>

      {/* 파이프라인 stepper */}
      <div className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {STAGE_FLOW.map((s, i) => {
            const active = s === stage
            // archived = 발행까지 거친 종결 → 이전 단계 진행 이력 보존(전부 done 표시)
            const done = stage === 'archived' ? true : STAGE_FLOW.indexOf(stage) > i
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

        {/* 이 단계에서 할 일 */}
        <p className="mt-3 flex items-start gap-1.5 border-t border-[var(--bd)] pt-3 font-body text-[12px] text-[var(--t3)]">
          <span aria-hidden style={{ color: ACCENT }}>›</span>
          {STAGE_HINT[stage]}
        </p>
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

      {/* QC 상세 — 어떤 컷/규칙이 실패했는지 (발행/보완 판단 근거) */}
      {(verbatimN > 0 || ruleN > 0) && (
        <div className="flex flex-col gap-3 rounded-[var(--r-md)] border border-[var(--memory-shaky)]/40 bg-[color-mix(in_srgb,var(--memory-shaky)_7%,transparent)] p-4">
          {verbatimN > 0 && (
            <div>
              <p className="mb-1 font-display text-[12px] font-[700] text-[var(--memory-risk)]">정본 불일치 {verbatimN}건</p>
              <ul className="flex flex-col gap-0.5">
                {(qc.verbatim_mismatch as unknown[]).map((v, k) => (
                  <li key={k} className="font-body text-[12px] text-[var(--t2)]">
                    • {typeof v === 'string' ? v : JSON.stringify(v)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {ruleN > 0 && (
            <div>
              <p className="mb-1 font-display text-[12px] font-[700] text-[var(--memory-shaky)]">규칙 위반 {ruleN}건</p>
              <ul className="flex flex-col gap-0.5">
                {(qc.rule_violations as unknown[]).map((v, k) => (
                  <li key={k} className="font-body text-[12px] text-[var(--t2)]">
                    • {typeof v === 'string' ? v : JSON.stringify(v)}
                  </li>
                ))}
              </ul>
            </div>
          )}
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
                      src={thumb(p.image_url)}
                      alt={`컷 ${p.page_order}`}
                      loading="lazy"
                      onError={(e) => { const el = e.currentTarget; if (el.src !== p.image_url) el.src = p.image_url }}
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
