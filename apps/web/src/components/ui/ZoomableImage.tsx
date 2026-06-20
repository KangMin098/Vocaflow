// apps/web/src/components/ui/ZoomableImage.tsx
// 클릭 시 전체화면 확대(라이트박스) 이미지. 그림책 삽화 자세히 보기 공용.
//   리더(ReadingUniverse)·큐레이션 프리뷰·단어 카드에서 재사용.
//   닫기: 오버레이 클릭 · Esc. body scroll lock.

'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

interface Props {
  src: string
  alt?: string
  /** 썸네일(인라인) 이미지 className */
  className?: string
}

export function ZoomableImage({ src, alt = '', className = '' }: Props) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onClick={() => setOpen(true)}
        className={`cursor-zoom-in ${className}`}
      />
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={alt || '삽화 확대'}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
        >
          <button
            type="button"
            aria-label="닫기"
            onClick={() => setOpen(false)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <X size={20} aria-hidden />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="max-h-[92vh] max-w-[92vw] cursor-zoom-out rounded-[var(--r-md)] object-contain shadow-[0_8px_40px_rgba(0,0,0,0.6)]"
          />
          {alt && (
            <p className="pointer-events-none absolute inset-x-0 bottom-4 mx-auto max-w-[80vw] text-center font-body text-[13px] text-white/80">
              {alt}
            </p>
          )}
        </div>
      )}
    </>
  )
}
