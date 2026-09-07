// apps/web/src/components/admin/curation/OpenStaxIdTab.tsx
// LCP v2.0 Phase 17 — OpenStax book slug 입력 + 미리보기

'use client'

import { useState, useTransition } from 'react'
import { AlertCircle, BookOpen, ExternalLink, Layers, Loader2, Search } from 'lucide-react'

export interface OpenStaxPreview {
  source: 'openstax'
  source_id: string
  title: string
  author: string
  author_birth_year: null
  author_death_year: null
  language: string
  license: string
  preview_text: string
  source_url: string
  chapter_count: number
  fetched_at: string
}

interface OpenStaxIdTabProps {
  onPickPreview: (preview: OpenStaxPreview) => void
}

export function OpenStaxIdTab({ onPickPreview }: OpenStaxIdTabProps) {
  const [slugInput, setSlugInput] = useState('')
  const [preview, setPreview] = useState<OpenStaxPreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isLoading, setIsLoading] = useState(false)

  async function handleFetch() {
    const slug = slugInput.trim().toLowerCase()
    if (!slug) {
      setError('OpenStax book slug 를 입력해 주세요.')
      return
    }
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug) || slug.length > 100) {
      setError('소문자·숫자·하이픈만 허용됩니다.')
      return
    }

    setError(null)
    setPreview(null)
    setIsLoading(true)

    try {
      const res = await fetch(
        `/api/admin/library/preview-openstax?slug=${encodeURIComponent(slug)}`,
      )
      const data = await res.json()
      if (!res.ok) {
        setError(data.message ?? '미리보기를 가져오지 못했습니다.')
        return
      }
      startTransition(() => setPreview(data as OpenStaxPreview))
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
    <section className="flex flex-col gap-4" aria-label="OpenStax 교과서 직접 입력">
      <div className="flex items-baseline gap-2">
        <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">
          📚 OpenStax 교과서 슬러그 입력
        </h2>
        <span className="font-mono text-[12px] text-[var(--t2)]">openstax.org book slug</span>
      </div>

      <div className="flex flex-col gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-4">
        <label
          htmlFor="openstax-slug-input"
          className="font-display text-[12px] font-[600] text-[var(--t2)]"
        >
          Book slug
        </label>

        <div className="flex flex-wrap items-stretch gap-2">
          <input
            id="openstax-slug-input"
            type="text"
            value={slugInput}
            onChange={(e) => setSlugInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="예: college-physics-2e 또는 introduction-business"
            className={[
              'min-h-[44px] flex-1 min-w-[240px] rounded-[var(--r-sm)]',
              'border border-[var(--bd)] bg-[var(--bg)]',
              'px-3 font-mono text-[13px] text-[var(--t1)]',
              'transition-colors duration-[var(--dur-normal)] ease-[var(--ease)]',
              'placeholder:text-[var(--t5)]',
              'hover:border-[var(--t3)]',
              'focus-visible:border-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]',
            ].join(' ')}
            aria-describedby={error ? 'openstax-slug-error' : undefined}
            aria-invalid={!!error}
          />

          <button
            type="button"
            onClick={handleFetch}
            disabled={isLoading || !slugInput.trim()}
            className={[
              'min-h-[44px] inline-flex items-center justify-center gap-2',
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
            id="openstax-slug-error"
            role="alert"
            className="flex items-center gap-2 rounded-[var(--r-sm)] bg-[var(--learn-error-light)] px-3 py-2"
          >
            <AlertCircle size={12} className="text-[var(--learn-error)]" aria-hidden />
            <span className="font-body text-[11px] text-[var(--learn-error)]">{error}</span>
          </div>
        )}

        <p className="font-body text-[11px] text-[var(--t2)]">
          OpenStax 책 페이지 URL 의 마지막 segment 입니다. 예:{' '}
          <code className="font-mono text-[var(--t2)]">
            https://openstax.org/books/<strong>college-physics-2e</strong>
          </code>
        </p>

        <p className="rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-2 font-body text-[11px] text-[var(--t2)]">
          📚 OpenStax 교과서는 모두 CC BY 4.0 — 한국 저작권 안전 ✓. 최대 30 챕터 자동
          수집됩니다. 수식(MathML)은 <code>[수식]</code> 으로 치환되고, 표·이미지·캡션은
          단어 추출 노이즈를 줄이기 위해 제거됩니다.
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
  preview: OpenStaxPreview
  isPickPending: boolean
  onPick: () => void
}) {
  return (
    <article className="flex flex-col overflow-hidden rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] shadow-[var(--sh-sm)]">
      <header className="border-b border-[var(--bd)] bg-[var(--bg2)] px-5 py-3">
        <div className="mb-1 flex items-start justify-between gap-3">
          <h3 className="flex items-center gap-2 font-display text-[15px] font-[700] text-[var(--t1)]">
            <BookOpen size={14} className="text-[var(--t2)]" aria-hidden />
            {preview.title}
          </h3>
          <a
            href={preview.source_url}
            target="_blank"
            rel="noreferrer"
            className="min-h-[44px] inline-flex shrink-0 items-center gap-1 rounded-[var(--r-sm)] px-2 py-1 font-mono text-[10px] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
            aria-label="OpenStax 페이지 새 탭에서 열기"
          >
            {preview.source_id}
            <ExternalLink size={10} aria-hidden />
          </a>
        </div>
        <p className="font-body text-[12px] text-[var(--t2)]">
          {preview.author}
          <span className="ml-2 font-mono text-[10px] text-[var(--t5)]">· {preview.license}</span>
          {preview.chapter_count > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 font-mono text-[10px] text-[var(--t5)]">
              <Layers size={9} aria-hidden /> 챕터 {preview.chapter_count}개
            </span>
          )}
        </p>
      </header>

      <div className="px-5 py-4">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-[var(--t2)]">
          책 설명
        </div>
        <p className="line-clamp-6 font-body text-[13px] leading-relaxed text-[var(--t1)]">
          {preview.preview_text}
        </p>
      </div>

      <footer className="border-t border-[var(--bd)] bg-[var(--bg2)] px-5 py-3">
        <button
          type="button"
          onClick={onPick}
          disabled={isPickPending}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--r-sm)] bg-[var(--p)] px-4 font-display text-[12px] font-[600] text-[var(--on-p)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          ➕ 큐에 추가
        </button>
      </footer>
    </article>
  )
}
