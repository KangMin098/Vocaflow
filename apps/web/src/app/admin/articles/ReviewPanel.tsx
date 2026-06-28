// apps/web/src/app/admin/articles/ReviewPanel.tsx
// ACP §18 P4 — 검수 패널 (③ 뷰, 3패널: 큐 / 에디터 / 게이트).
//
// 게이트는 SourcePolicy 로 동적 구성(computeGateItems) — source 하드코딩 금지.
//   · media='audio'   → player + audio_url 게이트 / 'text' → player 숨김
//   · derivation='display_only' → 단어세트 미발행(ND) info + "하이라이트 미적용" 노트
//   · attribution='required' → 출처 4종 게이트
// 본문 정독 · 단어세트 검수는 딥 검수(/preview/[id]) 재사용(중복 구현 회피).

'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { BookOpen, CheckCircle2, ExternalLink, Loader2, Volume2, VolumeX, XCircle } from 'lucide-react'

import type { ArticleAdminRow } from '@/lib/articles/types'
import { ARTICLE_IN_PROGRESS_STATUSES, classifyArticleStatus } from '@/lib/articles/types'
import { useSourcePolicy, DERIVATION_LABEL } from '@/lib/articles/use-source-policy'
import { resolveSourcePolicy } from '@vocaflow/library-pipeline/curation-spec'
import {
  computeGateItems,
  gatePasses,
  queueDot,
  type GateInput,
  type QueueDot,
} from '@/lib/articles/publish-gate'

const REVIEWABLE = new Set<string>([...ARTICLE_IN_PROGRESS_STATUSES, 'ready', 'failed'])

const DOT_COLOR: Record<QueueDot, string> = {
  ok: 'var(--learn-known)',
  hold: 'var(--learn-review)',
  new: 'var(--new, var(--t4))',
}
const DOT_LABEL: Record<QueueDot, string> = {
  ok: '검수 대기',
  hold: '보류 후보',
  new: '미검수',
}

interface Props {
  articles: ArticleAdminRow[]
  onChanged: () => void
}

function gateInputOf(a: ArticleAdminRow): GateInput {
  return {
    audioUrl: a.audio_url,
    lexicalNoise: a.lexical_noise,
    articleVLevel: a.article_v_level,
    sourceUrl: a.source_url,
    author: a.author,
    license: a.license,
  }
}

export function ReviewPanel({ articles, onChanged }: Props) {
  const queue = useMemo(() => articles.filter((a) => REVIEWABLE.has(a.status)), [articles])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = queue.find((a) => a.id === selectedId) ?? queue[0] ?? null
  const policy = useSourcePolicy(selected?.source ?? 'manual')

  if (queue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-[var(--r-md)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] py-16 text-center">
        <BookOpen size={28} className="text-[var(--t3)]" aria-hidden />
        <p className="font-body text-[13px] text-[var(--t3)]">검수할 글이 없어요. 소스 GET 에서 후보를 큐에 추가하세요.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr_230px]">
      <QueueList queue={queue} selectedId={selected?.id ?? null} onSelect={setSelectedId} />
      {selected && <Editor article={selected} media={policy.media} derivation={policy.derivation} />}
      {selected && (
        <GatePanel article={selected} onChanged={onChanged} />
      )}
    </div>
  )
}

// ── 좌: 큐 ───────────────────────────────────────

function QueueList({
  queue,
  selectedId,
  onSelect,
}: {
  queue: ArticleAdminRow[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <aside aria-label="검수 큐" className="flex flex-col gap-1.5">
      {queue.map((a) => {
        const policy = resolveSourcePolicy(a.source)
        const pass = gatePasses(computeGateItems(policy, gateInputOf(a)))
        const dot = queueDot(a.status, pass)
        const active = a.id === selectedId
        return (
          <button
            key={a.id}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(a.id)}
            className="relative flex flex-col gap-1 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-2 text-left transition-colors hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
            style={active ? { backgroundColor: 'var(--bg2)' } : undefined}
          >
            {active && (
              <span
                className="absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-[var(--r-full)] bg-[var(--p)]"
                aria-hidden
              />
            )}
            <span className="line-clamp-2 font-display text-[12px] font-[600] text-[var(--t1)]">
              {a.title}
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[10px] text-[var(--t3)]">
              <span
                className="inline-block h-2 w-2 rounded-[var(--r-full)]"
                style={{ backgroundColor: DOT_COLOR[dot] }}
                aria-hidden
              />
              {DOT_LABEL[dot]} · {a.register ?? a.source}
            </span>
          </button>
        )
      })}
    </aside>
  )
}

// ── 중앙: 에디터 ─────────────────────────────────

function Editor({
  article,
  media,
  derivation,
}: {
  article: ArticleAdminRow
  media: 'audio' | 'text'
  derivation: 'full' | 'display_only'
}) {
  const a = article
  return (
    <section aria-label="본문·메타" className="flex flex-col gap-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
      <header className="flex flex-col gap-1">
        <h2 className="font-display text-[18px] font-[700] leading-snug text-[var(--t1)]">{a.title}</h2>
        <p className="font-mono text-[11px] text-[var(--t3)]">
          {a.source}
          {a.article_v_level != null ? ` · V${a.article_v_level}` : ''}
          {a.word_count != null ? ` · ${a.word_count} words` : ''}
          {a.reading_minutes != null ? ` · ${a.reading_minutes}분` : ''}
        </p>
      </header>

      {/* player — media='audio' 만. 'text' 면 렌더 자체 없음. */}
      {media === 'audio' &&
        (a.audio_url ? (
          <div className="flex flex-col gap-1.5 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-3">
            <span className="flex items-center gap-1.5 font-mono text-[11px] text-[var(--t2)]">
              <Volume2 size={13} className="text-[var(--learn-known)]" aria-hidden />
              원어민 성우 · {a.source}
            </span>
            <audio controls preload="none" src={a.audio_url} className="h-9 w-full">
              <track kind="captions" />
            </audio>
          </div>
        ) : (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-[var(--r-md)] border border-[var(--learn-error)]/30 bg-[var(--learn-error-light)] p-3"
          >
            <VolumeX size={15} className="shrink-0 text-[var(--learn-error)]" aria-hidden />
            <span className="font-body text-[12px] text-[var(--learn-error)]">
              오디오 없음 — 듣기 정체성 소스(audio)는 발행 보류
            </span>
          </div>
        ))}

      {/* 본문 — 인라인 전문 대신 딥 검수 재사용. display_only 노트. */}
      <div className="rounded-[var(--r-md)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] p-3">
        {derivation === 'display_only' ? (
          <p className="font-body text-[12px] text-[var(--learn-review)]">
            하이라이트 미적용(파생금지) · 본문은 verbatim 으로만 노출됩니다.
          </p>
        ) : (
          <p className="font-body text-[12px] text-[var(--t3)]">
            본문 정독 · 단어세트 검수는 딥 검수에서 진행합니다.
          </p>
        )}
        <Link
          href={`/admin/articles/preview/${a.id}`}
          className="mt-2 inline-flex min-h-[36px] items-center gap-1.5 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-3 font-display text-[12px] font-[600] text-[var(--t1)] transition-colors hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        >
          <ExternalLink size={12} aria-hidden />
          딥 검수 (본문·단어·메타 편집)
        </Link>
      </div>

      {/* 메타 표시 (편집은 딥 검수) */}
      <div className="flex flex-wrap gap-2">
        <MetaPill label="register" value={a.register ?? '미분류'} warn={a.register === 'course'} />
        <MetaPill label="CEFR" value={a.cefr_level ?? '—'} />
        <MetaPill label="license" value={a.license} />
      </div>
    </section>
  )
}

function MetaPill({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-[var(--r-full)] border border-[var(--bd)] px-2.5 py-1 font-mono text-[10px]"
      style={warn ? { backgroundColor: 'var(--learn-review-light)', color: 'var(--learn-review)' } : { color: 'var(--t2)' }}
    >
      <span className="text-[var(--t4)]">{label}</span>
      {value}
    </span>
  )
}

// ── 우: V-level + 단어세트 + 게이트 ──────────────

function GatePanel({ article, onChanged }: { article: ArticleAdminRow; onChanged: () => void }) {
  const a = article
  const policy = useSourcePolicy(a.source)
  const items = computeGateItems(policy, gateInputOf(a))
  const passCount = items.filter((i) => i.pass).length
  const allPass = gatePasses(items)
  const [pending, setPending] = useState(false)

  const statusReady = a.status === 'ready'
  const canPublish = allPass && statusReady && a.copyright_safe_in_kr

  async function publish(): Promise<void> {
    setPending(true)
    try {
      const res = await fetch('/api/admin/articles/force-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_id: a.id }),
      })
      const d = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; message?: string }
      if (!res.ok || !d.ok) throw new Error(d.message ?? d.error ?? `HTTP ${res.status}`)
      onChanged()
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    } finally {
      setPending(false)
    }
  }

  return (
    <aside aria-label="검수 게이트" className="flex flex-col gap-3">
      {/* V-Level */}
      <div className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-3 text-center">
        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--t3)]">article V</span>
        <div className="font-display text-[32px] font-[700] leading-none text-[var(--t1)]">
          {a.article_v_level ?? '—'}
        </div>
        {a.cefr_level && <span className="font-mono text-[11px] text-[var(--t3)]">CEFR {a.cefr_level}</span>}
      </div>

      {/* 단어세트 — derivation 분기 */}
      <div className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--t3)]">단어세트</span>
        {policy.derivation === 'display_only' ? (
          <p className="mt-1 font-body text-[12px] text-[var(--learn-review)]">
            {DERIVATION_LABEL.display_only} — 파생 금지(ND). 본문 클릭 툴팁으로만 학습.
          </p>
        ) : (
          <p className="mt-1 font-body text-[12px] text-[var(--t2)]">
            발행 예정 · 추출 단어는 딥 검수에서 미리보기/검수.
          </p>
        )}
      </div>

      {/* 게이트 */}
      <div className="flex flex-col gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--t3)]">발행 게이트</span>
          <span
            className="font-mono text-[10px] font-[700] tabular-nums"
            style={{ color: allPass ? 'var(--learn-known)' : 'var(--learn-error)' }}
          >
            {passCount} / {items.length}
          </span>
        </div>
        <ul className="flex flex-col gap-1">
          {items.map((it) => (
            <li key={it.key} className="flex items-center gap-1.5 font-body text-[11px]">
              {it.pass ? (
                <CheckCircle2 size={13} className="shrink-0 text-[var(--learn-known)]" aria-hidden />
              ) : (
                <XCircle size={13} className="shrink-0 text-[var(--learn-error)]" aria-hidden />
              )}
              <span style={{ color: it.pass ? 'var(--t2)' : 'var(--learn-error)' }}>{it.label}</span>
            </li>
          ))}
        </ul>

        {!statusReady && (
          <p className="font-mono text-[10px] text-[var(--t3)]">
            상태 {classifyArticleStatus(a.status).label} — ready 후 발행 가능
          </p>
        )}
        {statusReady && !a.copyright_safe_in_kr && (
          <p className="font-mono text-[10px] text-[var(--learn-error)]">저작권 미확인 — 발행 차단</p>
        )}

        <button
          type="button"
          onClick={publish}
          disabled={!canPublish || pending}
          className="mt-1 inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-[var(--r-sm)] bg-[var(--p)] px-4 font-display text-[12px] font-[700] text-[var(--ti)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <CheckCircle2 size={13} aria-hidden />}
          {policy.derivation === 'display_only' ? '읽기 전용 발행' : '발행'}
        </button>
      </div>
    </aside>
  )
}
