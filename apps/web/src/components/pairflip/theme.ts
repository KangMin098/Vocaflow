// apps/web/src/components/pairflip/theme.ts
// CLAUDE.md "게임 전용 하드코딩 색상 예외" 규칙 적용 — 반드시 주석 명시
//
// PairFlip 전용 색상 v2 (v06.17.1) — 변경 금지
//
// 디자인 방향: Editorial card game · 네이비/골드/크림 premium 팔레트
//   - Flashcard(하늘) · SpellForge(파란 패널) · WordBlitz(정글) 와 시각 차별
//   - Sidebar 익히기 그룹 액센트(#EC4899) 는 네비게이션 식별용 — 모듈 스킨은 독자

export const PF_COLORS = {
  // ── 환경: warm ivory → champagne → soft amber ──
  envTop: '#FFFBF5',
  envMid: '#FEF6E1',
  envBottom: '#FDE9C2',
  desk: '#78350F', // rich walnut

  // ── 카드 뒷면: deep navy with gold sheen ──
  coverFrom: '#1E3A8A',
  coverMid: '#1E1B4B',
  coverTo: '#0F172A',

  // 골드 액센트 (테두리·패턴·★)
  gold: '#F59E0B',
  goldLight: '#FCD34D',
  goldDeep: '#B45309',

  // ── 카드 앞면 — 영단어 (paper white with warm undertone) ──
  wordFrom: '#FFFFFF',
  wordMid: '#FEFCE8',
  wordTo: '#FEF3C7',
  wordBorder: '#E7D9A8', // 페이퍼 가장자리

  // ── 카드 앞면 — 뜻 (soft sage) ──
  meaningFrom: '#F0FDF4',
  meaningMid: '#DCFCE7',
  meaningTo: '#A7F3D0',
  meaningBorder: '#86EFAC',

  // ── 매칭 성공 (emerald) ──
  matchedEmerald: '#10B981',
  matchedDeep: '#047857',
  matchedGlow: 'rgba(16, 185, 129, 0.35)',

  // ── 매칭 실패 (warm coral) ──
  shakeCoral: '#DC2626',
  shakeDeep: '#991B1B',
  shakeGlow: 'rgba(220, 38, 38, 0.35)',

  // ── 텍스트 ──
  textWord: '#0F172A', // deep navy on ivory
  textMeaning: '#064E3B', // deep emerald on sage
  textMuted: '#475569',
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
