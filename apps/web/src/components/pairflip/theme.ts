// apps/web/src/components/pairflip/theme.ts
// PC는 Tines UI 역할 변수. fallback은 디자인 작업에서 제외된 기존 모바일 값.

export const PF_COLORS = {
  // ── 환경: warm ivory → champagne → soft amber ──
  envTop: '#FFFBF5',
  envMid: '#FEF6E1',
  envBottom: '#FDE9C2',
  desk: '#78350F', // rich walnut

  // ── 카드 뒷면: deep navy with gold sheen ──
  coverFrom: 'var(--pf-coverFrom, #1E3A8A)',
  coverMid: 'var(--pf-coverMid, #1E1B4B)',
  coverTo: 'var(--pf-coverTo, #0F172A)',

  // 골드 액센트 (테두리·패턴·★)
  gold: 'var(--pf-gold, #F59E0B)',
  goldLight: 'var(--pf-goldLight, #FCD34D)',
  goldDeep: 'var(--pf-goldDeep, #B45309)',

  // ── 카드 앞면 — 영단어 (paper white with warm undertone) ──
  wordFrom: 'var(--pf-wordFrom, #FFFFFF)',
  wordMid: 'var(--pf-wordMid, #FEFCE8)',
  wordTo: 'var(--pf-wordTo, #FEF3C7)',
  wordBorder: 'var(--pf-wordBorder, #E7D9A8)',

  // ── 카드 앞면 — 뜻 (soft sage) ──
  meaningFrom: 'var(--pf-meaningFrom, #F0FDF4)',
  meaningMid: 'var(--pf-meaningMid, #DCFCE7)',
  meaningTo: 'var(--pf-meaningTo, #A7F3D0)',
  meaningBorder: 'var(--pf-meaningBorder, #86EFAC)',

  // ── 매칭 성공 (emerald) ──
  matchedEmerald: 'var(--pf-matchedEmerald, #10B981)',
  matchedDeep: 'var(--pf-matchedDeep, #047857)',
  matchedGlow: 'var(--pf-matchedGlow, rgba(16, 185, 129, 0.35))',

  // ── 매칭 실패 (warm coral) ──
  shakeCoral: 'var(--pf-shakeCoral, #DC2626)',
  shakeDeep: 'var(--pf-shakeDeep, #991B1B)',
  shakeGlow: 'var(--pf-shakeGlow, rgba(220, 38, 38, 0.35))',

  // ── 텍스트 ──
  textWord: 'var(--pf-textWord, #0F172A)',
  textMeaning: 'var(--pf-textMeaning, #064E3B)',
  textMuted: 'var(--pf-textMuted, #475569)',
} as const

export const PF_DIMS = {
  cardAspectRatio: '3 / 4',
  cardRadius: '14px',
  perspective: 1400,
  flipDuration: 600,
  matchedDuration: 1300,
  shakeDuration: 600,
  mismatchHoldDuration: 850,
  // 그리드 컨테이너 — 모든 레벨 2줄 (최대 10 cols × 2 rows = Master 20장 수용)
  gridMaxWidth: 1280,
  gridGap: 14,
  // 매칭 후 잠시 강조 애니메이션 (사라지지 않음)
  matchedCelebrateDuration: 700,
} as const

/** 카드 뒷면 패턴 5종 — 시각 다양성 (Variable Reward), 정제된 라인 워크 */
export type PFBackPattern = 'diamond' | 'wave' | 'star' | 'grid' | 'logo'
export const PF_BACK_PATTERNS: PFBackPattern[] = [
  'diamond',
  'wave',
  'star',
  'grid',
  'logo',
]
