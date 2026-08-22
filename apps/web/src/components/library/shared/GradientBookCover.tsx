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
  /**
   * 표지 위 글자색 — `bookCover().textTone` 을 그대로 넘긴다.
   *
   * ⚠️ 이 컴포넌트는 오래 `text-white` 를 **박아 두고** 있었고, `bookCover` 가 계산해 주는
   *    `textTone` 을 **아무도 읽지 않았다**(실측 2026-08-22). DB 가 옅은 표지색을 주면
   *    흰 제목이 **1.1:1** 로 사라졌다 — `drop-shadow` 가 가려 주고 있었지만
   *    그림자는 WCAG 가 세지 않는다.
   *    기본값이 `'light'` 인 것은 기존 호출부를 깨지 않기 위해서이고,
   *    표지색을 아는 호출부는 **반드시 넘겨야 한다.**
   */
  textTone?: 'light' | 'dark'
}

export function GradientBookCover({
  title,
  author,
  subtitle,
  ornament,
  compact = false,
  textTone = 'light',
}: GradientBookCoverProps) {
  // 옅은 표지에는 어두운 잉크. 프레임·장식 룰도 같은 쪽으로 뒤집어야 테두리가 사라지지 않는다.
  const dark = textTone === 'dark'
  const ink = dark ? 'text-[#1A1714]' : 'text-white'
  const frame1 = dark ? 'border-black/25' : 'border-white/30'
  const frame2 = dark ? 'border-black/10' : 'border-white/12'
  const rule = dark ? 'bg-black/35' : 'bg-white/40'
  const sub = subtitle ?? author
  const hasEmoji = !!ornament

  const pad = compact ? 'px-5' : 'px-7'
  const ornamentCls = hasEmoji
    ? compact
      ? 'mb-2 text-[17px] leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]'
      : 'mb-3 text-[22px] leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]'
    : compact
      ? `mb-2 font-english text-[12px] leading-none ${dark ? 'text-black/60' : 'text-white/55'}`
      : `mb-3 font-english text-[15px] leading-none ${dark ? 'text-black/60' : 'text-white/55'}`

  // ⚠️ 제목·부제의 흰색도 잉크를 따라가야 한다. 그림자는 **읽히게 도와줄 뿐 대비로 세지 않는다** —
  //    옅은 표지에서는 그림자가 있어도 흰 제목이 1.1:1 이었다.
  const titleInk = dark
    ? 'text-[#1A1714] drop-shadow-[0_1px_2px_rgba(255,255,255,0.45)]'
    : 'text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]'
  const subInk = dark ? 'text-black/75' : 'text-white/85'

  const titleCls = compact
    ? `line-clamp-4 font-english text-[15px] font-[600] leading-[1.26] tracking-[0.005em] ${titleInk}`
    : `line-clamp-5 font-english text-[20px] font-[600] leading-[1.28] tracking-[0.005em] ${titleInk}`
  const subCls = compact
    ? `line-clamp-1 font-display text-[9px] font-[600] uppercase tracking-[0.14em] ${subInk}`
    : `line-clamp-1 font-display text-[10px] font-[600] uppercase tracking-[0.16em] ${subInk}`

  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center text-center ${ink} ${pad}`}
    >
      {/* 안쪽 이중 프레임 — 클래식 표지 테두리 */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-[10px] rounded-[2px] border ${frame1}`}
      />
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-[14px] rounded-[1px] border ${frame2}`}
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
            className={`h-px ${rule} ${compact ? 'my-2 w-7' : 'my-3 w-9'}`}
          />
          {/* 부제 — small caps */}
          <p className={subCls}>{sub}</p>
        </>
      )}
    </div>
  )
}
