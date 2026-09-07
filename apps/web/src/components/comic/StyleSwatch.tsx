// apps/web/src/components/comic/StyleSwatch.tsx
// CCP 스타일 프리셋 비주얼 스와치 — 실 샘플 호스팅/생성 없이 각 스타일의 시각 DNA(포맷·팔레트·장르)를
// 절차적 SVG 로 표현. 국내외 스타일 피커(COMICPAD/Mangii/Clip Studio) 관행 = 대표 모티프 썸네일.
//   포맷 → 구성/텍스처: webtoon(세로 시네마틱 그라데이션) · manga-page(스크린톤+스피드라인 2컷)
//   · comic-page(벤데이 하프톤 굵은 외곽) · graphic-novel(크로스해치 명암) · manhwa-page(회화적 듀오톤)
//   팔레트 → 종이/잉크/악센트 · 장르 → 색상(color/pastel/duotone 틴트)
'use client'

const GENRE_HUE: Record<string, string> = {
  romance: '#e86a9c', action: '#e0533a', fantasy: '#8b5cf6', mystery: '#4f5fb0', horror: '#7a2233',
  comedy: '#f2b23a', adventure: '#2fa88a', literary: '#8a7a5c', historical: '#b08640',
  thriller: '#4a6274', 'slice-of-life': '#f0885d', educational: '#3d8fd1',
}
export function genreHue(genre?: string | null): string { return (genre && GENRE_HUE[genre]) || '#8B5CF6' }

type Pal = { paper: string; ink: string; accent: string; g0: string; g1: string }
function palColors(palette: string | null, genre: string | null): Pal {
  const hue = genreHue(genre)
  switch (palette) {
    case 'sepia': return { paper: '#f0e4cf', ink: '#4a3320', accent: '#8a6234', g0: '#e6d3b0', g1: '#f4ead6' }
    case 'duotone': return { paper: '#e7edf3', ink: '#1f3350', accent: '#3f6fa5', g0: '#2b4a66', g1: '#dfe8f1' }
    case 'pastel': return { paper: '#fbf1f5', ink: '#5b4a55', accent: hue, g0: `${hue}44`, g1: '#fbf1f5' }
    case 'color': return { paper: '#fdfdff', ink: '#242730', accent: hue, g0: `${hue}55`, g1: '#fdfdff' }
    default: return { paper: '#f4f2ee', ink: '#1c1c1c', accent: '#5f5f5f', g0: '#d8d8d4', g1: '#f4f2ee' } // bw
  }
}

// 공용 모티프: 흉상(머리+어깨) — 화풍별 채움/외곽 다르게
function Figure({ ink, accent, fill = false, stroke = 2 }: { ink: string; accent: string; fill?: boolean; stroke?: number }) {
  return (
    <g>
      <path d="M50,92 Q80,60 110,92 Z" fill={fill ? accent : 'none'} stroke={ink} strokeWidth={stroke} strokeLinejoin="round" />
      <circle cx="80" cy="46" r="14" fill={fill ? accent : 'none'} stroke={ink} strokeWidth={stroke} />
    </g>
  )
}

export function StyleSwatch({ format, palette, genre, styleKey }: { format: string | null; palette: string | null; genre: string | null; styleKey: string }) {
  const c = palColors(palette, genre)
  const uid = styleKey.replace(/[^a-z0-9]/gi, '')
  const common = { width: '100%', height: '100%', viewBox: '0 0 160 100', preserveAspectRatio: 'xMidYMid slice' as const, role: 'img' as const, 'aria-label': `${format ?? ''} ${genre ?? ''} 스타일 미리보기` }

  // ── 포맷별 구성 ──
  if (format === 'webtoon') {
    // 세로 스크롤 시네마틱: 그라데이션 + 소프트 흉상 + 얇은 클린 라인 + 스크롤 힌트
    return (
      <svg {...common}>
        <defs>
          <linearGradient id={`wg-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={c.g0} /><stop offset="1" stopColor={c.g1} />
          </linearGradient>
        </defs>
        <rect width="160" height="100" fill={c.paper} />
        <rect x="54" y="0" width="52" height="100" fill={`url(#wg-${uid})`} />
        <Figure ink={c.ink} accent={c.accent} stroke={1.6} />
        <line x1="54" y1="0" x2="54" y2="100" stroke={c.ink} strokeWidth="1" opacity="0.25" />
        <line x1="106" y1="0" x2="106" y2="100" stroke={c.ink} strokeWidth="1" opacity="0.25" />
        <circle cx="80" cy="46" r="21" fill="none" stroke={c.accent} strokeWidth="1.2" opacity="0.5" />
      </svg>
    )
  }
  if (format === 'manhwa-page') {
    // 회화적 듀오톤 페이지: 라운드 프레임 + 부드러운 명암 + 채운 흉상
    return (
      <svg {...common}>
        <defs>
          <linearGradient id={`mh-${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={c.g0} /><stop offset="1" stopColor={c.g1} />
          </linearGradient>
        </defs>
        <rect width="160" height="100" fill={c.g1} />
        <rect x="10" y="8" width="140" height="84" rx="6" fill={`url(#mh-${uid})`} stroke={c.ink} strokeWidth="1.5" />
        <ellipse cx="80" cy="98" rx="60" ry="26" fill={c.accent} opacity="0.18" />
        <Figure ink={c.ink} accent={c.accent} fill stroke={2} />
      </svg>
    )
  }
  if (format === 'manga-page') {
    // B&W 다컷: 대각 분할 + 스크린톤 + 스피드라인
    return (
      <svg {...common}>
        <defs>
          <pattern id={`st-${uid}`} width="5" height="5" patternUnits="userSpaceOnUse">
            <circle cx="1.4" cy="1.4" r="1.1" fill={palette === 'bw' ? c.ink : c.accent} opacity={palette === 'bw' ? 0.4 : 0.5} />
          </pattern>
        </defs>
        <rect width="160" height="100" fill={c.paper} />
        {/* 상단 컷: 스피드라인 + 흉상 */}
        <g clipPath={`url(#mgc-${uid})`}>
          <clipPath id={`mgc-${uid}`}><polygon points="4,4 156,4 156,52 4,64" /></clipPath>
          <rect x="4" y="4" width="152" height="60" fill={c.paper} />
          {Array.from({ length: 12 }).map((_, i) => <line key={i} x1="80" y1="34" x2={i * 15} y2={i % 2 ? 2 : 66} stroke={c.ink} strokeWidth="0.6" opacity="0.5" />)}
          <circle cx="80" cy="34" r="12" fill={c.paper} stroke={c.ink} strokeWidth="2" />
        </g>
        {/* 하단 컷: 스크린톤 */}
        <polygon points="4,68 156,56 156,96 4,96" fill={`url(#st-${uid})`} stroke={c.ink} strokeWidth="1.5" />
        <path d="M40,96 Q80,74 120,96 Z" fill={c.paper} stroke={c.ink} strokeWidth="2" strokeLinejoin="round" />
        {/* 컷 경계 */}
        <line x1="4" y1="64" x2="156" y2="53" stroke={c.paper} strokeWidth="3" />
        <line x1="4" y1="66" x2="156" y2="55" stroke={c.ink} strokeWidth="1.5" />
      </svg>
    )
  }
  if (format === 'graphic-novel') {
    // 크로스해치 명암 + 고대비 흉상 + 드라마틱 섀도
    return (
      <svg {...common}>
        <defs>
          <pattern id={`ch-${uid}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke={c.ink} strokeWidth="0.8" opacity="0.45" />
          </pattern>
          <pattern id={`ch2-${uid}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke={c.ink} strokeWidth="0.7" opacity="0.35" />
          </pattern>
        </defs>
        <rect width="160" height="100" fill={c.paper} />
        <rect x="8" y="6" width="144" height="88" fill={`url(#ch-${uid})`} stroke={c.ink} strokeWidth="2" />
        <rect x="8" y="6" width="72" height="88" fill={`url(#ch2-${uid})`} opacity="0.8" />
        <path d="M50,92 Q80,58 110,92 Z" fill={c.paper} stroke={c.ink} strokeWidth="2.4" strokeLinejoin="round" />
        <circle cx="80" cy="46" r="14" fill={c.paper} stroke={c.ink} strokeWidth="2.4" />
        <path d="M80,32 A14,14 0 0,1 80,60 Z" fill={c.ink} opacity="0.8" />
      </svg>
    )
  }
  // comic-page (기본): 벤데이 하프톤 + 굵은 균일 외곽 + 말풍선
  return (
    <svg {...common}>
      <defs>
        <pattern id={`bd-${uid}`} width="7" height="7" patternUnits="userSpaceOnUse">
          <rect width="7" height="7" fill={c.g1} />
          <circle cx="2" cy="2" r="1.6" fill={c.accent} opacity="0.55" />
        </pattern>
      </defs>
      <rect width="160" height="100" fill={`url(#bd-${uid})`} />
      <rect x="7" y="6" width="146" height="88" rx="3" fill="none" stroke={c.ink} strokeWidth="3" />
      <path d="M48,94 Q80,58 112,94 Z" fill={c.accent} stroke={c.ink} strokeWidth="3" strokeLinejoin="round" />
      <circle cx="80" cy="46" r="15" fill={c.paper} stroke={c.ink} strokeWidth="3" />
      <g>
        <rect x="104" y="14" width="42" height="22" rx="7" fill={c.paper} stroke={c.ink} strokeWidth="2.2" />
        <path d="M116,34 l-4,8 l10,-7 Z" fill={c.paper} stroke={c.ink} strokeWidth="2.2" strokeLinejoin="round" />
        <line x1="110" y1="22" x2="140" y2="22" stroke={c.ink} strokeWidth="1.6" opacity="0.5" />
        <line x1="110" y1="28" x2="134" y2="28" stroke={c.ink} strokeWidth="1.6" opacity="0.5" />
      </g>
    </svg>
  )
}
