// apps/web/src/components/admin/curation/BookIllustrationsPanel.tsx
// LCP 큐레이션 프리뷰 — 그림책 삽화 검수 패널 (StoryWeaver 등).
//
// library_books.illustrations([{idx,url,alt}]) + cover_image_url 를 학습자 뷰와 동일하게
// 페이지(문단 idx) 순서로 표시 — 큐레이터가 발행 전 그림책 전체를 검수.
//   · alt = 해당 페이지 본문 텍스트(ingester 가 저장) → 이미지+문장 정합 확인.

'use client'

import { ImageOff, Images } from 'lucide-react'

import { ZoomableImage } from '@/components/ui/ZoomableImage'

export interface BookIllustration {
  idx: number
  url: string
  alt?: string
}

interface Props {
  illustrations: BookIllustration[] | null
  coverImageUrl?: string | null
  sourceUrl?: string | null
}

export function BookIllustrationsPanel({ illustrations, coverImageUrl, sourceUrl }: Props) {
  const items = (illustrations ?? [])
    .filter((i) => i && typeof i.url === 'string')
    .slice()
    .sort((a, b) => a.idx - b.idx)

  // 삽화·표지 모두 없으면 패널 자체 미표시 (그림책 아님)
  if (items.length === 0 && !coverImageUrl) return null

  return (
    <section
      aria-labelledby="illus-panel-title"
      className="flex flex-col gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4"
    >
      <header className="flex items-center justify-between gap-3">
        <h2
          id="illus-panel-title"
          className="inline-flex items-center gap-2 font-display text-[14px] font-[700] text-[var(--t1)]"
        >
          <Images size={15} aria-hidden className="text-[var(--p)]" />
          삽화 미리보기
          <span className="font-mono text-[12px] font-[400] text-[var(--t2)]">
            {items.length}장 · 페이지 idx 정합 (학습자 뷰와 동일)
          </span>
        </h2>
        {sourceUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[11px] text-[var(--t2)] underline-offset-2 hover:text-[var(--p)] hover:underline"
          >
            원본 ↗
          </a>
        )}
      </header>

      {/* 표지 */}
      {coverImageUrl && (
        <figure className="flex flex-col items-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-3">
          <ZoomableImage
            src={coverImageUrl}
            alt="표지"
            className="h-auto w-full max-w-[320px] rounded-[var(--r-sm)] object-contain"
          />
          <figcaption className="font-mono text-[10px] uppercase tracking-wider text-[var(--t2)]">
            표지 (cover)
          </figcaption>
        </figure>
      )}

      {/* 페이지별 삽화 + 본문 (idx 순) */}
      {items.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {items.map((it) => (
            <figure
              key={`${it.idx}-${it.url}`}
              className="flex flex-col overflow-hidden rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)]"
            >
              <ZoomableImage
                src={it.url}
                alt={it.alt ?? ''}
                className="block h-44 w-full object-cover"
              />
              <figcaption className="flex flex-col gap-1 p-3">
                <span className="font-mono text-[10px] font-[700] uppercase tracking-wider text-[var(--p)]">
                  페이지 {it.idx + 1}
                </span>
                {it.alt && it.alt.trim().length > 0 && (
                  <span className="font-english text-[12px] leading-snug text-[var(--t2)]">
                    {it.alt}
                  </span>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <p className="inline-flex items-center gap-2 font-body text-[12px] text-[var(--t2)]">
          <ImageOff size={13} aria-hidden /> 페이지 삽화 없음 (표지만)
        </p>
      )}
    </section>
  )
}
