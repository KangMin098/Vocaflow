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
  /**
   * 표지 **맨 위 시리즈 줄** (예: `Vocaflow 3`).
   *
   * ── 왜 필요한가 (실측 2026-09-01) ─────────────────────────────────
   * 서가를 브랜딩했는데도 "아직 시중 단어장이 아니다" 라는 지적을 받았다. 표지를 늘어놓고
   * 보니 **권마다 낱장으로 보였다** — 시리즈명이 어디에도 없었기 때문이다.
   *
   * 시중 단어장은 표지 맨 위에 시리즈를 싣는다(능률VOCA 고등 기본 / 수능 필수 …).
   * 그 한 줄이 있어야 여러 권이 **한 출판사의 서가**로 읽힌다 — `vocab/brand.ts` 가
   * 스스로 목적으로 적어 둔 바로 그것이고, 정작 표지에는 없었다.
   *
   * 값을 여기서 짓지 않는다 — 호출부가 정본 사다리(`vocabRungs().volumeTitle`)에서 읽어 넘긴다.
   */
  series?: string | null
  /** 작은 카드(그리드 타일)용 축소 타이포 */
  compact?: boolean
  /**
   * 제목 줄 수 상한 — **규격이 정한 값**을 받는다(단어장은 `brandLockup.titleMaxLines`).
   *
   * 안 주면 종전대로 compact 4줄 / 큰 표지 5줄이다. 그 값은 규격이 없는 표지(도서·스크립트)의
   * 하한이고, 여기서 새로 정하지 않는다 — 표지가 규격보다 한 줄 더 보여 주면 그 순간
   * 규격은 규격이 아니게 된다.
   */
  titleMaxLines?: number
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
  series,
  compact = false,
  titleMaxLines,
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

  /*
    ⚠️ 클래스 이름을 **문자열로 조립하지 않는다**(`line-clamp-${n}`). Tailwind 는 소스에서
    완성된 문자열만 훑으므로 조립한 이름은 CSS 가 생성되지 않고, **클램프가 조용히 사라진다** —
    화면은 멀쩡히 뜨고 제목만 끝없이 늘어난다.
  */
  const CLAMP: Record<number, string> = {
    1: 'line-clamp-1', 2: 'line-clamp-2', 3: 'line-clamp-3', 4: 'line-clamp-4', 5: 'line-clamp-5',
  }
  const clamp = CLAMP[titleMaxLines ?? (compact ? 4 : 5)] ?? (compact ? 'line-clamp-4' : 'line-clamp-5')
  const titleCls = compact
    ? `${clamp} font-english text-[15px] font-[600] leading-[1.26] tracking-[0.005em] ${titleInk}`
    : `${clamp} font-english text-[20px] font-[600] leading-[1.28] tracking-[0.005em] ${titleInk}`
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

      {/*
        시리즈 줄 — 표지 **맨 위**. 여러 권이 한 서가에 섰을 때 같은 자리에 같은 이름이
        반복돼야 시리즈로 읽힌다. 제목보다 훨씬 작고 자간을 넓혀, 제목의 자리를 뺏지 않는다.
      */}
      {series && (
        <p
          className={
            // `truncate` — 시리즈명이 길어도 표지를 넘지 않게. 그리드 타일은 폭이 150px 대라
            //   자간을 넓히면 금방 넘친다(넘치면 표지가 깨져 보인다).
            compact
              ? `absolute left-0 right-0 top-[22px] truncate px-4 font-display text-[7.5px] font-[700] uppercase tracking-[0.14em] ${subInk}`
              : `absolute left-0 right-0 top-[30px] truncate px-6 font-display text-[9.5px] font-[700] uppercase tracking-[0.22em] ${subInk}`
          }
        >
          {series}
        </p>
      )}

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
