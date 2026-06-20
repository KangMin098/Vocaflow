// apps/web/src/components/admin/curation/StoryWeaverIdTab.tsx
// LCP — StoryWeaver story id/slug 입력 + 미리보기 (그림책 — 표지·페이지수·낭독)

'use client'

import { useState, useTransition } from 'react'
import { AlertCircle, ExternalLink, Headphones, ImageIcon, Loader2, Search } from 'lucide-react'

export interface StoryWeaverPreview {
  source: 'storyweaver'
  source_id: string
  title: string
  author: string
  license: string
  preview_text: string
  source_url: string
  page_count: number
  has_audio: boolean
  cover_image_url: string | null
  fetched_at: string
}

interface StoryWeaverIdTabProps {
  onPickPreview: (preview: StoryWeaverPreview) => void
}

export function StoryWeaverIdTab({ onPickPreview }: StoryWeaverIdTabProps) {
  const [idInput, setIdInput] = useState('')
  const [preview, setPreview] = useState<StoryWeaverPreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isLoading, setIsLoading] = useState(false)

  async function handleFetch() {
    const id = idInput.trim().replace(/^.*storyweaver\.org\.in\/stories\//, '').replace(/[/?#].*$/, '')
    if (!id) {
      setError('StoryWeaver story id 또는 slug 를 입력해 주세요.')
      return
    }
    if (!/^[a-z0-9][a-z0-9-]*$/i.test(id) || id.length > 120) {
      setError('영숫자·하이픈만 허용됩니다 (예: 2 또는 2-smile-please).')
      return
    }

    setError(null)
    setPreview(null)
    setIsLoading(true)
    try {
      const res = await fetch(`/api/admin/library/preview-storyweaver?id=${encodeURIComponent(id)}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.message ?? '미리보기를 가져오지 못했습니다.')
        return
      }
      startTransition(() => setPreview(data as StoryWeaverPreview))
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
    <section className="flex flex-col gap-4" aria-label="StoryWeaver 그림책 직접 입력">
      <div className="flex items-baseline gap-2">
        <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">
          📄 StoryWeaver 그림책 입력
        </h2>
        <span className="font-mono text-[12px] text-[var(--t3)]">story id 또는 slug</span>
      </div>

      <div className="flex flex-col gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-4">
        <label htmlFor="sw-id-input" className="font-display text-[12px] font-[600] text-[var(--t2)]">
          Story id / slug
        </label>

        <div className="flex flex-wrap items-stretch gap-2">
          <input
            id="sw-id-input"
            type="text"
            value={idInput}
            onChange={(e) => setIdInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="예: 2-smile-please 또는 10118 또는 전체 URL"
            className={[
              'min-h-[40px] flex-1 min-w-[240px] rounded-[var(--r-sm)]',
              'border border-[var(--bd)] bg-[var(--bg)]',
              'px-3 font-mono text-[13px] text-[var(--t1)]',
              'transition-colors duration-[var(--dur-normal)] ease-[var(--ease)]',
              'placeholder:text-[var(--t5)] hover:border-[var(--t3)]',
              'focus-visible:border-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]',
            ].join(' ')}
            aria-invalid={!!error}
          />
          <button
            type="button"
            onClick={handleFetch}
            disabled={isLoading || !idInput.trim()}
            className={[
              'min-h-[40px] inline-flex items-center justify-center gap-2 rounded-[var(--r-sm)] px-4',
              'bg-[var(--p)] hover:bg-[var(--p-hover)] font-display text-[12px] font-[600] text-[var(--ti)]',
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
            role="alert"
            className="flex items-center gap-1.5 rounded-[var(--r-sm)] bg-[var(--learn-error-light)] px-3 py-2"
          >
            <AlertCircle size={12} className="text-[var(--learn-error)]" aria-hidden />
            <span className="font-body text-[11px] text-[var(--learn-error)]">{error}</span>
          </div>
        )}

        <p className="font-body text-[11px] text-[var(--t3)]">
          StoryWeaver story URL 의 id 부분입니다. 예:{' '}
          <code className="font-mono text-[var(--t2)]">
            storyweaver.org.in/stories/<strong>2-smile-please</strong>
          </code>
        </p>

        <p className="rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-2 font-body text-[11px] text-[var(--t3)]">
          📄 StoryWeaver 그림책은 모두 CC BY 4.0 — 한국 저작권 안전 ✓. 페이지별 삽화(링크)와 낭독
          오디오가 자동 수집되어 학습자에게 노출됩니다.
        </p>
      </div>

      {preview && (
        <PreviewCard preview={preview} isPickPending={isPending} onPick={() => onPickPreview(preview)} />
      )}
    </section>
  )
}

function PreviewCard({
  preview,
  isPickPending,
  onPick,
}: {
  preview: StoryWeaverPreview
  isPickPending: boolean
  onPick: () => void
}) {
  return (
    <article className="flex flex-col overflow-hidden rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] shadow-[var(--sh-sm)]">
      <header className="flex gap-4 border-b border-[var(--bd)] bg-[var(--bg2)] px-5 py-4">
        {preview.cover_image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview.cover_image_url}
            alt=""
            className="h-20 w-20 shrink-0 rounded-[var(--r-sm)] border border-[var(--bd)] object-cover"
            loading="lazy"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-start justify-between gap-3">
            <h3 className="font-display text-[15px] font-[700] text-[var(--t1)]">{preview.title}</h3>
            <a
              href={preview.source_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center gap-1 rounded-[var(--r-sm)] px-2 py-1 font-mono text-[10px] text-[var(--t2)] transition-colors hover:bg-[var(--bg)] hover:text-[var(--t1)]"
              aria-label="StoryWeaver 페이지 새 탭에서 열기"
            >
              {preview.source_id}
              <ExternalLink size={10} aria-hidden />
            </a>
          </div>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-body text-[12px] text-[var(--t3)]">
            {preview.author}
            <span className="font-mono text-[10px] text-[var(--t5)]">· {preview.license}</span>
            <span className="inline-flex items-center gap-0.5 font-mono text-[10px] text-[var(--t5)]">
              <ImageIcon size={9} aria-hidden /> {preview.page_count}페이지
            </span>
            {preview.has_audio && (
              <span className="inline-flex items-center gap-0.5 font-mono text-[10px] text-[var(--learn-review)]">
                <Headphones size={9} aria-hidden /> 낭독
              </span>
            )}
          </p>
        </div>
      </header>

      <div className="px-5 py-4">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-[var(--t3)]">
          줄거리 / 본문 미리보기
        </div>
        <p className="line-clamp-5 font-body text-[13px] leading-relaxed text-[var(--t1)]">
          {preview.preview_text}
        </p>
      </div>

      <footer className="border-t border-[var(--bd)] bg-[var(--bg2)] px-5 py-3">
        <button
          type="button"
          onClick={onPick}
          disabled={isPickPending}
          className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-[var(--r-sm)] bg-[var(--p)] px-4 font-display text-[12px] font-[600] text-[var(--ti)] transition-colors hover:bg-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          ➕ 큐에 추가
        </button>
      </footer>
    </article>
  )
}
