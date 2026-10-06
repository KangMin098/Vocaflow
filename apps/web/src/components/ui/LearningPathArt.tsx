// apps/web/src/components/ui/LearningPathArt.tsx
// 학습 화면 히어로 옆 그림 — Tines 개념 삽화(path-*.webp, scripts/design/lib/illo-tines-scenes.mjs 의 STYLE_CONCEPT).
// 2026-10-06: 손으로 그린 SVG(구름 · 별 · 점선 궤적)가 유아적이라는 사용자 지적으로 생성 삽화로 바꿨다. 변형 이름과 호출부는 그대로다.
import Image from 'next/image'
import type { CSSProperties } from 'react'

/** 생성 그림은 물건이 화면 밖까지 이어질 때가 있다(계단 · 케이블) — 네 변을 흐려 칼로 자른 끝을 감춘다. */
const EDGE_FADE: CSSProperties = {
  maskImage: 'linear-gradient(to right, transparent, #000 10%, #000 90%, transparent), linear-gradient(to bottom, transparent, #000 10%, #000 90%, transparent)',
  maskComposite: 'intersect',
  WebkitMaskComposite: 'source-in',
}

export type LearningPathVariant = 'books' | 'cards' | 'growth' | 'calendar' | 'report'

export function LearningPathArt({ variant = 'books', className = '' }: { variant?: LearningPathVariant; className?: string }) {
  return (
    <Image
      src={`/illustrations/tines/path-${variant}.webp`}
      alt=""
      aria-hidden="true"
      width={1024}
      height={1024}
      sizes="280px"
      className={`h-auto w-full select-none ${className}`}
      style={EDGE_FADE}
    />
  )
}
