// apps/web/src/components/library/shared/GradientBookCover.tsx
//
// 실 표지가 없는 도서/단어장/스크립트의 "디자인된 표지" — Penguin Clothbound
// Classics 풍. 그라디언트 + placeholder 가 아니라, 안쪽 이중 프레임 + 중앙 정렬
// serif 제목 + 장식 룰 + 부제(small caps) 로 실제 책 표지처럼.
//
// 적용처: /library/books · /text(도서·스크립트·단어장) · /library/vocab(공용 단어장).

interface GradientBookCoverProps {
  title: string
  /** 저자 — subtitle 미지정 시 하단 small-caps 라인에 사용 */
  author?: string | null
  /** author 대신 표시할 부제 (예: "1,234 단어"). 주어지면 author 보다 우선 */
  subtitle?: string | null
  /** ❧ 대신 표시할 상단 장식 (예: 단어장 이모지) */
  ornament?: string | null
  /** 작은 카드(그리드 타일)용 축소 타이포 */
  compact?: boolean
}

export function GradientBookCover({
  title,
  author,
  subtitle,
  ornament,
  compact = false,
}: GradientBookCoverProps) {
  const sub = subtitle ?? author
  const hasEmoji = !!ornament

  const pad = compact ? 'px-5' : 'px-7'
  const ornamentCls = hasEmoji
    ? compact
      ? 'mb-2 text-[17px] leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]'
      : 'mb-3 text-[22px] leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]'
    : compact
      ? 'mb-2 font-english text-[12px] leading-none text-white/55'
      : 'mb-3 font-english text-[15px] leading-none text-white/55'
  const titleCls = compact
    ? 'line-clamp-4 font-english text-[15px] font-[600] leading-[1.26] tracking-[0.005em] text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]'
    : 'line-clamp-5 font-english text-[20px] font-[600] leading-[1.28] tracking-[0.005em] text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]'
  const subCls = compact
    ? 'line-clamp-1 font-display text-[9px] font-[600] uppercase tracking-[0.14em] text-white/85'
    : 'line-clamp-1 font-display text-[10px] font-[600] uppercase tracking-[0.16em] text-white/85'

  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center text-center text-white ${pad}`}
    >
      {/* 안쪽 이중 프레임 — 클래식 표지 테두리 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-[10px] rounded-[2px] border border-white/30"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-[14px] rounded-[1px] border border-white/12"
      />

      {/* 상단 장식 — fleuron(❧) 또는 단어장 이모지 */}
      <span aria-hidden className={ornamentCls}>
        {ornament ?? '❧'}
      </span>

      {/* 제목 — Lora serif, 중앙 정렬 */}
      <h3 className={titleCls}>{title}</h3>

      {sub && (
        <>
          {/* 장식 룰 */}
          <span
            aria-hidden
            className={`h-px bg-white/40 ${compact ? 'my-2 w-7' : 'my-3 w-9'}`}
          />
          {/* 부제 — small caps */}
          <p className={subCls}>{sub}</p>
        </>
      )}
    </div>
  )
}
