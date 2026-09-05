// apps/web/src/components/admin/curation/WikibooksIdTab.tsx
// LCP v2.0 Phase 14 — Wikibooks page title 직접 입력 + 미리보기

'use client'

import { useState, useTransition } from 'react'
import { AlertCircle, ExternalLink, Layers, Loader2, Search } from 'lucide-react'

export interface WikibooksPreview {
  source: 'wikibooks'
  source_id: string
  title: string
  author: 'Wikibooks contributors'
  author_birth_year: null
  author_death_year: null
  language: 'en'
  license: 'CC-BY-SA-3.0'
  preview_text: string
  source_url: string
  subpage_count: number
  fetched_at: string
}

interface WikibooksIdTabProps {
  onPickPreview: (preview: WikibooksPreview) => void
}

export function WikibooksIdTab({ onPickPreview }: WikibooksIdTabProps) {
  const [titleInput, setTitleInput] = useState('')
  const [preview, setPreview] = useState<WikibooksPreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isLoading, setIsLoading] = useState(false)

  async function handleFetch() {
    const title = titleInput.trim().replace(/\s+/g, '_')
    if (!title) {
      setError('페이지 제목을 입력해 주세요.')
      return
    }
    if (!/^[A-Za-z0-9_/().,:'\-]+$/.test(title) || title.length > 200) {
      setError("허용되지 않는 문자가 포함되어 있습니다.")
      return
    }

    setError(null)
    setPreview(null)
    setIsLoading(true)

    try {
      const res = await fetch(
        `/api/admin/library/preview-wikibooks?title=${encodeURIComponent(title)}`,
      )
      const data = await res.json()

      if (!res.ok) {
        setError(data.message ?? '미리보기를 가져오지 못했습니다.')
        return
      }

      startTransition(() => {
        setPreview(data as WikibooksPreview)
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
    <section className="flex flex-col gap-4" aria-label="Wikibooks 페이지 직접 입력">
      <div className="flex items-baseline gap-2">
        <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">
          📖 Wikibooks 페이지 직접 입력
        </h2>
        <span className="font-mono text-[12px] text-[var(--t2)]">
          en.wikibooks.org 페이지 제목
        </span>
      </div>

      <div className="flex flex-col gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-4">
        <label
          htmlFor="wikibooks-title-input"
          className="font-display text-[12px] font-[600] text-[var(--t2)]"
        >
          페이지 제목
        </label>

        <div className="flex flex-wrap items-stretch gap-2">
          <input
            id="wikibooks-title-input"
            type="text"
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="예: English_in_Use 또는 Wikijunior:Animal_Alphabet"
            className={[
              'min-h-[44px] flex-1 min-w-[240px] rounded-[var(--r-sm)]',
              'border border-[var(--bd)] bg-[var(--bg)]',
              'px-3 font-mono text-[13px] text-[var(--t1)]',
              'transition-colors duration-[var(--dur-normal)] ease-[var(--ease)]',
              'placeholder:text-[var(--t5)]',
              'hover:border-[var(--t3)]',
              'focus-visible:border-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]',
            ].join(' ')}
            aria-describedby={error ? 'wikibooks-title-error' : undefined}
            aria-invalid={!!error}
          />

          <button
            type="button"
            onClick={handleFetch}
            disabled={isLoading || !titleInput.trim()}
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
            id="wikibooks-title-error"
            role="alert"
            className="flex items-center gap-2 rounded-[var(--r-sm)] bg-[var(--learn-error-light)] px-3 py-2"
          >
            <AlertCircle size={12} className="text-[var(--learn-error)]" aria-hidden />
            <span className="font-body text-[11px] text-[var(--learn-error)]">{error}</span>
          </div>
        )}

        <p className="font-body text-[11px] text-[var(--t2)]">
          Wikibooks 페이지 URL 의 마지막 부분입니다. 공백은 자동으로 <code>_</code> 로 변환됩니다.<br />
          상위 페이지를 입력하면 sub-page 트리(최대 50개) 가 자동 수집됩니다. 예:{' '}
          <code className="font-mono text-[var(--t2)]">
            https://en.wikibooks.org/wiki/<strong>English_in_Use</strong>
          </code>
        </p>

        <p className="rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-2 font-body text-[11px] text-[var(--t2)]">
          ⚠️ Wikibooks 는 CC-BY-SA-3.0 협업 저작물 — 자동 KR 저작권 룰(저자 사후 70년)
          이 적용되지 않아 기본적으로 <code>copyright_safe_in_kr=false</code> 로 큐잉됩니다.
          publish 하려면 큐레이션 단계에서 별도 정책 검토 후 강제 publish 가 필요합니다.
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
  preview: WikibooksPreview
  isPickPending: boolean
  onPick: () => void
}) {
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
            className="min-h-[44px] inline-flex shrink-0 items-center gap-1 rounded-[var(--r-sm)] px-2 py-1 font-mono text-[10px] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
            aria-label="Wikibooks 페이지 새 탭에서 열기"
          >
            {preview.source_id}
            <ExternalLink size={10} aria-hidden />
          </a>
        </div>
        <p className="font-body text-[12px] text-[var(--t2)]">
          {preview.author}
          <span className="ml-2 font-mono text-[10px] text-[var(--t5)]">
            · CC-BY-SA-3.0
          </span>
          {preview.subpage_count > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 font-mono text-[10px] text-[var(--t5)]">
              <Layers size={9} aria-hidden /> sub-page {preview.subpage_count}개
            </span>
          )}
        </p>
      </header>

      <div className="px-5 py-4">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-[var(--t2)]">
          본문 미리보기
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
