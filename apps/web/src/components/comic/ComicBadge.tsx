// apps/web/src/components/comic/ComicBadge.tsx
//
// "이 책은 만화로도 볼 수 있어요" 포맷 표식.
// 만화 계열 액센트 = gold(--active) 유지(히어로/리더와 동일 브랜드).
// 접근성: 색상 단독 전달 금지 — tile 변형도 아이콘 + sr-only 텍스트 + title 을 항상 동반.

import { BookImage } from 'lucide-react'

/** tile = 표지 위 오버레이(아이콘만 시각 노출) · chip = 텍스트 동반 인라인 칩 */
type Variant = 'tile' | 'chip'

export function ComicBadge({ variant = 'chip' }: { variant?: Variant }) {
  if (variant === 'tile') {
    return (
      <span
        title="만화로 볼 수 있어요"
        className="inline-flex w-fit items-center justify-center rounded-full p-1 shadow-[0_2px_6px_rgba(0,0,0,0.25)] backdrop-blur-sm"
        style={{ background: 'var(--active)', color: '#231a09' }}
      >
        <BookImage size={9} aria-hidden />
        <span className="sr-only">만화 있음</span>
      </span>
    )
  }

  return (
    <span
      className="inline-flex w-fit items-center gap-1 rounded-[var(--r-full)] px-1.5 py-0.5 font-display text-[9.5px] font-[700]"
      style={{ background: 'var(--active)', color: '#231a09' }}
    >
      <BookImage size={9} aria-hidden />
      만화
    </span>
  )
}
