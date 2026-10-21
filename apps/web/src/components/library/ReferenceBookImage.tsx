// apps/web/src/components/library/ReferenceBookImage.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { BookOpen, BookImage, ImageOff } from 'lucide-react'

/** PC 참조 화면의 실제 표지. 외부 호스트 실패 시 장식용 가짜 표지 대신 서명을 표시한다. */
export function ReferenceBookImage({ src, title, className, compact = false, kind = 'book' }: {
  src: string
  title: string
  className: string
  compact?: boolean
  kind?: 'book' | 'comic' | 'preview'
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null)
  const image = useRef<HTMLImageElement>(null)
  useEffect(() => {
    // 외부 이미지가 hydration 전에 이미 실패한 경우도 처리한다.
    if (image.current?.complete && image.current.naturalWidth === 0) setFailedSource(src)
  }, [src])
  const failed = !src || failedSource === src
  const Icon = kind === 'preview' ? ImageOff : kind === 'comic' ? BookImage : BookOpen
  return (
    <span aria-hidden={kind === 'preview' ? undefined : true} data-reference-cover className={`block overflow-hidden ${className}`}>
      <span className="relative block h-full w-full">
      {/* eslint-disable-next-line @next/next/no-img-element -- 여러 외부 표지 호스트의 원본. */}
      {src && <img ref={image} src={src} alt="" loading="lazy" onError={() => setFailedSource(src)} className={`h-full w-full object-cover ${failed ? 'lg:invisible' : ''}`} />}
      {failed && <span data-cover-fallback className="absolute inset-0 hidden flex-col items-center justify-center gap-3 bg-[var(--tint-lavender)] p-2 text-center font-serif text-[14px] leading-tight text-[var(--tint-lavender-ink)] lg:flex">
        <Icon aria-hidden size={compact ? 14 : 28} strokeWidth={1.3} className="shrink-0" />
        {!compact && <span className="line-clamp-4">{title}</span>}
        {kind !== 'book' && <span className="break-keep text-[11px] leading-relaxed">{kind === 'preview' ? '미리보기 그림을 불러오지 못했어요.' : '표지를 불러오지 못했어요.'}</span>}
      </span>}
      </span>
    </span>
  )
}
