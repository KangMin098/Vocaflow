// apps/web/src/components/admin/curation/LibriVoxIdTab.tsx
// LCP v2.0 Phase 16 — LibriVox book id 직접 입력 + 미리보기

'use client'

import { useState, useTransition } from 'react'
import { AlertCircle, BookOpen, Clock, ExternalLink, Headphones, Loader2, Search } from 'lucide-react'

import { LibriVoxAudioPlayer, type LibriVoxAudio } from './LibriVoxAudioPlayer'

export type { LibriVoxAudio, LibriVoxAudioSection } from './LibriVoxAudioPlayer'

export interface LibriVoxPreview {
  source: 'librivox'
  source_id: string
  title: string
  author: string | null
  author_birth_year: number | null
  author_death_year: number | null
  language: string
  license: 'PD'
  preview_text: string
  source_url: string
  text_source_url: string | null
  text_source_kind: 'gutenberg' | 'other' | 'none'
  totaltime: string | null
  /** 챕터별 archive.org 스트리밍 — 본문 검수 시 낭독 청취용 (없으면 null) */
  audio: LibriVoxAudio | null
  fetched_at: string
}

interface LibriVoxIdTabProps {
  onPickPreview: (preview: LibriVoxPreview) => void
}

export function LibriVoxIdTab({ onPickPreview }: LibriVoxIdTabProps) {
  const [idInput, setIdInput] = useState('')
  const [preview, setPreview] = useState<LibriVoxPreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isLoading, setIsLoading] = useState(false)

  async function handleFetch() {
    const id = idInput.trim()
    if (!id) {
      setError('LibriVox id 를 입력해 주세요.')
      return
    }
    if (!/^[A-Za-z0-9_\-]+$/.test(id) || id.length > 50) {
      setError('허용되지 않는 문자가 포함되어 있습니다.')
      return
    }

    setError(null)
    setPreview(null)
    setIsLoading(true)

    try {
      const res = await fetch(
        `/api/admin/library/preview-librivox?id=${encodeURIComponent(id)}`,
      )
      const data = await res.json()

      if (!res.ok) {
        setError(data.message ?? '미리보기를 가져오지 못했습니다.')
        return
      }

      startTransition(() => {
        setPreview(data as LibriVoxPreview)
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : '네트워크 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleFetch()
    }
  }

  return (
    <section className="flex flex-col gap-4" aria-label="LibriVox book id 직접 입력">
      <div className="flex items-baseline gap-2">
        <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">
          🎧 LibriVox book id 직접 입력
        </h2>
        <span className="font-mono text-[12px] text-[var(--t2)]">librivox.org book id</span>
      </div>

      <div className="flex flex-col gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-4">
        <label
          htmlFor="librivox-id-input"
          className="font-display text-[12px] font-[600] text-[var(--t2)]"
        >
          Book ID
        </label>

        <div className="flex flex-wrap items-stretch gap-2">
          <input
            id="librivox-id-input"
            type="text"
            inputMode="numeric"
            value={idInput}
            onChange={(e) => setIdInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="예: 253 (Pride and Prejudice) · 47 (몬테크리스토 백작)"
            className={[
              'min-h-[40px] flex-1 min-w-[240px] rounded-[var(--r-sm)]',
              'border border-[var(--bd)] bg-[var(--bg)]',
              'px-3 font-mono text-[13px] text-[var(--t1)]',
              'transition-colors duration-[var(--dur-normal)] ease-[var(--ease)]',
              'placeholder:text-[var(--t5)]',
              'hover:border-[var(--t3)]',
              'focus-visible:border-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]',
            ].join(' ')}
            aria-describedby={error ? 'librivox-id-error' : undefined}
            aria-invalid={!!error}
          />

          <button
            type="button"
            onClick={handleFetch}
            disabled={isLoading || !idInput.trim()}
            className={[
              'min-h-[40px] inline-flex items-center justify-center gap-2',
              'rounded-[var(--r-sm)] px-4',
              'bg-[var(--p)] hover:bg-[var(--p-hover)]',
              'font-display text-[12px] font-[600] text-[var(--ti)]',
              'transition-colors duration-[var(--dur-normal)] ease-[var(--ease)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
            ].join(' ')}
          >
            {isLoading ? (
              <Loader2 size={14} className="animate-spin" aria-hidden />
            ) : (
              <Search size={14} aria-hidden />
            )}
            {isLoading ? '불러오는 중…' : '미리보기'}
          </button>
        </div>

        {error && (
          <div
            id="librivox-id-error"
            role="alert"
            className="flex items-center gap-2 rounded-[var(--r-sm)] bg-[var(--learn-error-light)] px-3 py-2"
          >
            <AlertCircle size={12} className="text-[var(--learn-error)]" aria-hidden />
            <span className="font-body text-[11px] text-[var(--learn-error)]">{error}</span>
          </div>
        )}

        <p className="font-body text-[11px] text-[var(--t2)]">
          LibriVox 페이지 URL 의 <code>?p=</code> 뒤 숫자입니다. 예:{' '}
          <code className="font-mono text-[var(--t2)]">
            https://librivox.org/?p=<strong>253</strong>
          </code>{' '}
          (작은 숫자 1·13 등은 존재하지 않는 id 입니다)
        </p>

        <p className="rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-2 font-body text-[11px] text-[var(--t2)]">
          🎧 LibriVox 는 오디오북 카탈로그 — 텍스트 본문은 외부 (Gutenberg 등) 에 의존합니다.
          미리보기에서 <code>text_source_kind</code> 를 확인하세요: <strong>gutenberg</strong>{' '}
          (정밀 파싱) / <strong>other</strong> (외부 HTML best-effort) / <strong>none</strong>{' '}
          (텍스트 없음 — 처리 불가).
        </p>
      </div>

      {preview && (
        <PreviewCard
          preview={preview}
          isPickPending={isPending}
          onPick={() => onPickPreview(preview)}
        />
      )}
    </section>
  )
}

// ── PreviewCard ──────────────────────────────────

function PreviewCard({
  preview,
  isPickPending,
  onPick,
}: {
  preview: LibriVoxPreview
  isPickPending: boolean
  onPick: () => void
}) {
  const yearRange =
    preview.author_birth_year != null && preview.author_death_year != null
      ? ` (${formatYear(preview.author_birth_year)}–${formatYear(preview.author_death_year)})`
      : ''
  const cannotIngest = preview.text_source_kind === 'none'
  const kindBadge = TEXT_SOURCE_BADGES[preview.text_source_kind]

  return (
    <article className="flex flex-col overflow-hidden rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] shadow-[var(--sh-sm)]">
      <header className="border-b border-[var(--bd)] bg-[var(--bg2)] px-5 py-3">
        <div className="mb-1 flex items-start justify-between gap-3">
          <h3 className="font-display text-[15px] font-[700] text-[var(--t1)]">
            {preview.title}
          </h3>
          <a
            href={preview.source_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1 rounded-[var(--r-sm)] px-2 py-1 font-mono text-[10px] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
            aria-label="LibriVox 페이지 새 탭에서 열기"
          >
            id {preview.source_id}
            <ExternalLink size={10} aria-hidden />
          </a>
        </div>
        <p className="font-body text-[12px] text-[var(--t2)]">
          {(preview.author ?? '저자 미상') + yearRange}
          <span className="ml-2 font-mono text-[10px] text-[var(--t5)]">· PD</span>
          {preview.totaltime && (
            <span className="ml-2 inline-flex items-center gap-1 font-mono text-[10px] text-[var(--t5)]">
              <Clock size={9} aria-hidden /> {preview.totaltime}
            </span>
          )}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-[var(--r-sm)] px-2 py-1 font-mono text-[10px] font-[700]"
            style={{ background: kindBadge.bg, color: kindBadge.fg }}
          >
            {kindBadge.icon}
            text source: {kindBadge.label}
          </span>
          {preview.text_source_url && (
            <a
              href={preview.text_source_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-mono text-[10px] text-[var(--t2)] hover:text-[var(--p)] hover:underline"
            >
              원본 열기
              <ExternalLink size={9} aria-hidden />
            </a>
          )}
        </div>
      </header>

      <div className="px-5 py-4">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-[var(--t2)]">
          본문 미리보기
        </div>
        <p className="line-clamp-6 font-body text-[13px] leading-relaxed text-[var(--t1)]">
          {preview.preview_text}
        </p>
      </div>

      {preview.audio && <LibriVoxAudioPlayer audio={preview.audio} />}

      <footer className="border-t border-[var(--bd)] bg-[var(--bg2)] px-5 py-3">
        <div className="flex items-center justify-between gap-3">
          {cannotIngest ? (
            <span className="font-body text-[11px] text-[var(--learn-error)]">
              ⚠️ 이 LibriVox 항목은 텍스트 원본이 없어 LCP 파이프라인 처리 불가
            </span>
          ) : (
            <span className="font-body text-[11px] text-[var(--t2)]">
              {preview.text_source_kind === 'gutenberg'
                ? 'Gutenberg 텍스트 원본을 사용합니다 (정밀 파싱).'
                : '외부 텍스트 원본 — best-effort 파싱이라 챕터 분절이 부정확할 수 있어요.'}
            </span>
          )}
          <button
            type="button"
            onClick={onPick}
            disabled={isPickPending || cannotIngest}
            className="inline-flex min-h-[36px] shrink-0 items-center justify-center gap-2 rounded-[var(--r-sm)] bg-[var(--p)] px-4 font-display text-[12px] font-[600] text-[var(--on-p)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ➕ 큐에 추가
          </button>
        </div>
      </footer>
    </article>
  )
}

const TEXT_SOURCE_BADGES: Record<
  LibriVoxPreview['text_source_kind'],
  { label: string; bg: string; fg: string; icon: React.ReactNode }
> = {
  gutenberg: {
    label: 'Gutenberg',
    bg: 'var(--learn-known-light)',
    fg: 'var(--learn-known)',
    icon: <BookOpen size={9} aria-hidden />,
  },
  other: {
    label: 'external',
    bg: 'var(--learn-review-light)',
    fg: 'var(--learn-review)',
    icon: <Headphones size={9} aria-hidden />,
  },
  none: {
    label: 'none',
    bg: 'var(--learn-error-light)',
    fg: 'var(--learn-error)',
    icon: <AlertCircle size={9} aria-hidden />,
  },
}

function formatYear(year: number): string {
  return year < 0 ? `BC ${-year}` : `${year}`
}
