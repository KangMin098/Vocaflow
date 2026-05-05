# Claude Code 작업 지시문 — PairFlip 신규 모듈 v06.17

> 이 문서를 Claude Code에 그대로 입력하면 단계별로 작업이 진행됩니다.
> 작업 위치: `C:\Users\kille\Vocaflow\` (모노레포 루트)
> 단일 진실 소스: `CLAUDE.md` — 충돌 시 CLAUDE.md 우선
> 사전 적용 권장: v06.16 Sidebar Refactor (없어도 진행 가능, PR 1에서 호환 처리)

---

## 작업 개요

**PairFlip** — 짝맞추기 카드 뒤집기 게임 모듈 신규 추가.

- 영단어 ↔ 한글 뜻 짝 맞추기 (Memory Match 게임)
- 익히기 그룹 (L4a 계층) 4번째 모듈
- 토도수학 수준의 그래픽 + Vocaflow 디자인 시스템 정합
- 5단계 난이도 (Easy 4장 ~ Master 20장)
- Default 카드 수: **10장 (5쌍)** — Working Memory 한계 정밀 매칭 (Cowan 2010)

검증 관점 5가지:
- **뇌과학**: Sweller 인지 부하 · Cowan WM 3~5 chunk · spatial memory
- **심리학**: Skinner Variable Ratio · SDT 자율성 · Flow State 도전·기술 균형
- **디자인**: Calm UI · Vocaflow 5색 accent · Flashcard·SpellForge 시각 정합
- **흥미**: 마스코트 캐릭터 · Idle 애니메이션 · 콤보 단계별 보상
- **접근성**: WCAG AA · 44×44 Fitts · 색맹 대응(색+형태+모션)

---

## 사전 작업 — 컨텍스트 로딩

```
다음 파일을 먼저 읽고 PairFlip 통합 컨텍스트를 파악해줘:

1. CLAUDE.md
   - §17.1 학습 모델 v3.2 — L4a Recognize 계층
   - §17.6 모듈 매트릭스
   - §17.10 IA 원칙 — Sidebar 5그룹
   - "디자인 철학·학습 과학 원칙" 섹션
   - Color System (CSS Variables · 게임 전용 하드코딩 예외)
   - Motion / Animation 토큰

2. Flashcard.html
   - 3D flip 카드 CSS 패턴 (perspective 1200px · rotateY 0.55s)
   - 앞면/뒷면 gradient 색상 (재사용 예정)
   - 잔디·구름 환경 디자인 패턴

3. WordBlitz_Jungle.html
   - 게임 점수·콤보 시스템
   - correctPop·wrongShake 애니메이션
   - HUD bar · feedback overlay 패턴

4. apps/web/src/components/layout/Sidebar.tsx (v06.16 적용 시)
   또는 apps/web/src/components/layout/sidebar-config.ts
   - 익히기 그룹 정의 위치 확인
   - SpellForge·Flashcard·WordBlitz 항목 구조 파악

5. apps/web/src/components/flashcard/ 폴더 전체 구조
   - 컴포넌트 파일 분리 패턴 학습 (Card.tsx · CardFront.tsx 등)
   - Session 컨테이너 패턴

읽은 후 보고:
- CLAUDE.md 의 §17.6 모듈 매트릭스에 L4a 계층 모듈이 몇 개 있는가
- Flashcard 의 3D flip CSS 정확한 변수 (perspective · transition duration · easing)
- Sidebar 익히기 그룹 현재 항목과 정렬 순서
- Flashcard 컴포넌트 폴더의 파일 개수와 명명 규칙

작업 시작은 내가 "PR1 시작" 이라고 입력하면 진행해줘.
```

---

## PR 1 — 사이드바 + 라우트 골격

### 작업 명령

```
다음 작업을 순서대로 수행해줘:

1. apps/web/src/components/layout/sidebar-config.ts 수정
   (만약 이 파일이 없으면 Sidebar.tsx 직접 수정)

   익히기 그룹의 items 배열에 PairFlip 추가.
   정렬 순서 = 인지 깊이 (Flashcard → WordBlitz → PairFlip → SpellForge)
   Lucide 아이콘: Shuffle (셔플 아이콘 — 카드 섞기 의미 정합)
   ariaLabel: "PairFlip — 짝맞추기 카드 게임"

2. 신규 라우트 4개 생성 (모두 stub):
   - apps/web/src/app/(main)/pairflip/page.tsx           ← Hub
   - apps/web/src/app/(main)/pairflip/play/page.tsx      ← Session
   - 둘 다 일단 placeholder ("PairFlip Hub" / "PairFlip Session")로 두기

3. apps/web/src/components/pairflip/ 폴더 생성
   - 일단 빈 폴더 (PR 2 에서 컴포넌트 작성)
   - .gitkeep 파일 추가

4. CLAUDE.md 의 §17.10 FlowNav 표시 정책에 PairFlip 진입 시 "익히기" 단계 활성 표시 확인
   (URL 매칭 패턴 ^/pairflip 추가 필요 시 components/layout/FlowNav.tsx 수정)

작업 후 검증:
- Sidebar 익히기 그룹에 4개 항목 표시되는가
- /pairflip 접근 시 Hub stub 페이지 보이는가
- /pairflip/play 접근 시 Session stub 페이지 보이는가
- FlowNav 가 /pairflip 진입 시 "익히기" 단계 활성화하는가
- pnpm typecheck 오류 없는가
```

### 작업 종료 시 보고 형식

```
✅ PR 1 완료
- 변경 파일: N개
- 사이드바 익히기 그룹: Flashcard → WordBlitz → PairFlip → SpellForge ✓
- 라우트 stub: /pairflip, /pairflip/play ✓
- FlowNav 익히기 단계 매핑: ✓
- 다음 작업: PR 2 디자인 토큰 + 핵심 타입

확인 후 "PR2 시작" 이라고 입력해주세요.
```

---

## PR 2 — 디자인 토큰 + 핵심 타입

### 작업 명령

```
다음 파일을 신규 생성해줘:

1. apps/web/src/components/pairflip/types.ts
2. apps/web/src/components/pairflip/constants.ts
3. apps/web/src/components/pairflip/theme.ts
4. apps/web/src/components/pairflip/mock-data.ts

내용 규격은 아래 명세 그대로 적용.
```

### types.ts 작성 규격

```typescript
// apps/web/src/components/pairflip/types.ts
// CLAUDE.md §17.6 모듈 매트릭스 정합 — L4a Recognize

export type PairFlipLevel = 'easy' | 'normal' | 'hard' | 'expert' | 'master';

export type PairFlipMode = 'word_meaning' | 'word_definition';
// word_image (이미지 모드) 는 Phase 2 — 이미지 자산 준비 후 추가

export interface PairFlipLevelConfig {
  id: PairFlipLevel;
  label: string;
  emoji: string;
  pairCount: number;       // 2, 5, 6, 8, 10
  cardCount: number;       // pairCount * 2
  timeLimit: number;       // seconds
  gridCols: number;        // 모바일·데스크톱 동일 (Calm UI: layout shift 회피)
  description: string;     // "워밍업 / 기본 추천 / 챌린지" 등
}

export type PairFlipCardState =
  | 'covered'      // 뒤집혀 있음 (default)
  | 'flipped'      // 사용자가 클릭하여 잠시 보이는 중
  | 'matched'      // 매칭 성공 (사라지기 전 1.2s 애니메이션)
  | 'shaking'      // 매칭 실패 (잠시 흔들림)
  | 'gone';        // 완전히 사라짐

export type PairFlipCardType = 'word' | 'meaning';

export interface PairFlipCard {
  id: string;                    // unique
  pairId: string;                // 짝의 공통 식별자
  type: PairFlipCardType;
  content: string;               // 영단어 또는 한글 뜻
  partOfSpeech?: string;         // noun, verb, adj, adv
  phonetic?: string;             // IPA (Phase 2 사전 API 연동 시)
  state: PairFlipCardState;
  position: number;              // 0..N-1 (그리드 위치)
  attempts: number;              // 이 카드가 시도된 횟수 (FSRS rating 계산용)
  patternIndex?: number;         // 뒷면 패턴 0..4 (시각 다양성)
}

export type PairFlipPhase =
  | 'idle'         // 클릭 가능
  | 'reveal_first' // 첫 카드 뒤집힘
  | 'reveal_second'// 두 번째 카드 뒤집힘 (검증 대기)
  | 'matched'      // 매칭 성공 애니메이션 중
  | 'mismatched'   // 매칭 실패 애니메이션 중
  | 'won'          // 모든 쌍 매칭 완료
  | 'lost';        // 시간 초과

export interface PairFlipSession {
  level: PairFlipLevel;
  mode: PairFlipMode;
  cards: PairFlipCard[];
  startedAt: number;             // Date.now()
  endedAt?: number;
  matchedPairs: number;
  totalAttempts: number;         // 카드 클릭 총 횟수
  combo: number;
  maxCombo: number;
  hintsUsed: number;
  score: number;
  phase: PairFlipPhase;
  selectedCardIds: string[];     // [] | [first] | [first, second]
  // FSRS 통합 (CLAUDE.md §17.4)
  pairResults: PairFlipPairResult[];
}

export interface PairFlipPairResult {
  pairId: string;
  word: string;
  meaning: string;
  attempts: number;             // 이 쌍이 시도된 횟수
  matchedAt: number;            // 매칭 완료 시각 (Date.now())
  fsrsRating: 1 | 2 | 3 | 4;   // Again | Hard | Good | Easy
}
```

### constants.ts 작성 규격

```typescript
// apps/web/src/components/pairflip/constants.ts
// CLAUDE.md §17.5 SDT 자율성 + §17.6 인지 부하 정합

import type { PairFlipLevelConfig } from './types';

/**
 * 5단계 난이도 — 카드 수 결정 근거 (뇌과학)
 *
 * Easy   2쌍  4장  → 첫 진입 / Cold 사용자 / 작업 기억 1/2 사용
 * Normal 5쌍 10장  → ★ DEFAULT — Cowan WM 한계 (3~5 chunk) 정밀 매칭
 * Hard   6쌍 12장  → 워밍업 후 / Warm 사용자 / spatial memory 시작
 * Expert 8쌍 16장  → Hot 사용자 / 인지 부하 도전
 * Master 10쌍 20장 → 챌린지 / 깊은 학습자
 *
 * 시간 제한: 카드 수 × 12초 + 30초 버퍼
 * 근거: 평균 카드 인지 시간 4초 + 매칭 결정 8초 (Hick의 법칙)
 */
export const PAIRFLIP_LEVELS: PairFlipLevelConfig[] = [
  { id: 'easy',   label: 'Easy',   emoji: '🌱', pairCount: 2,  cardCount: 4,  timeLimit: 60,  gridCols: 2, description: '워밍업' },
  { id: 'normal', label: 'Normal', emoji: '🌟', pairCount: 5,  cardCount: 10, timeLimit: 90,  gridCols: 5, description: '기본 추천' },
  { id: 'hard',   label: 'Hard',   emoji: '🔥', pairCount: 6,  cardCount: 12, timeLimit: 120, gridCols: 4, description: '도전' },
  { id: 'expert', label: 'Expert', emoji: '💎', pairCount: 8,  cardCount: 16, timeLimit: 180, gridCols: 4, description: '심화' },
  { id: 'master', label: 'Master', emoji: '👑', pairCount: 10, cardCount: 20, timeLimit: 240, gridCols: 5, description: '마스터' },
];

/**
 * 점수 시스템 — Skinner Variable Ratio 정합
 *
 * 매번 같은 보상은 도파민 둔화 → 콤보 단계별 보상 가속
 */
export const PAIRFLIP_SCORE = {
  matchBase: 100,                  // 기본 매칭 성공
  comboMultiplier: {
    1: 1.0,   // 첫 매칭
    2: 1.2,   // 콤보 2 (+20%)
    3: 1.5,   // 콤보 3 (+50%) ← 시각 보상 단계 1
    4: 1.8,   // 콤보 4 (+80%)
    5: 2.5,   // 콤보 5 (+150%) ← 시각 보상 단계 2
    7: 4.0,   // 콤보 7 (+300%) ← 시각 보상 단계 3 (무지개 폭발)
  } as Record<number, number>,
  hintPenalty: -30,
  timeBonus: 2,                    // 남은 시간 1초당 (게임 종료 시)
  perfectBonus: 500,               // 첫 시도 100% 매칭 (실패 0회)
};

/**
 * 콤보 시각 보상 단계 (도파민 가속)
 */
export const COMBO_TIERS = {
  3: 'sparkle',     // 별 1개 폭발
  5: 'burst',       // 별 6개 폭발 + 텍스트 "GREAT!"
  7: 'rainbow',     // 무지개 별 8개 + 텍스트 "AMAZING!"
} as const;

/**
 * FSRS rating 매핑 (CLAUDE.md §17.4 정합)
 *
 * 첫 시도 매칭     → 4 (Easy)
 * 2회 시도 매칭    → 3 (Good)
 * 3~4회 시도 매칭  → 2 (Hard)
 * 5회+ 또는 미매칭 → 1 (Again)
 */
export function pairAttemptsToFSRSRating(attempts: number, matched: boolean): 1 | 2 | 3 | 4 {
  if (!matched) return 1;
  if (attempts <= 1) return 4;
  if (attempts <= 2) return 3;
  if (attempts <= 4) return 2;
  return 1;
}

/**
 * Empathetic Feedback 카피 (CLAUDE.md "공감 피드백" 정합)
 */
export function getResultCopy(accuracy: number): { title: string; sub: string } {
  if (accuracy >= 100) return { title: '완벽해요!', sub: '모든 짝을 찾았어요' };
  if (accuracy >= 70)  return { title: '잘했어요!',   sub: '거의 다 맞췄네요' };
  if (accuracy >= 40)  return { title: '좋은 도전이었어요', sub: '다시 만나봐요' };
  return { title: '한 번 더 해볼까요', sub: '곧 익숙해질 거예요' };
}
```

### theme.ts 작성 규격

```typescript
// apps/web/src/components/pairflip/theme.ts
// CLAUDE.md "게임 전용 하드코딩 예외" 규칙 적용 — 반드시 주석 명시

/**
 * PairFlip 전용 색상 — 변경 금지
 *
 * 익히기 그룹 핑크(#EC4899)를 메인 액센트로 + 따뜻한 크림 환경
 * Flashcard(파란 하늘) · SpellForge(파란 패널) · WordBlitz(정글 녹색) 와 시각 차별화
 */
export const PF_COLORS = {
  // 환경 (따뜻한 크림 → 호박 → 마호가니 책상)
  envTop:    '#FFF5E6',
  envMid:    '#FFE0B3',
  envBottom: '#FFCC80',
  desk:      '#8B4513',

  // 카드 뒷면 (익히기 그룹 핑크 그라디언트)
  coverFrom: '#EC4899',
  coverMid:  '#DB2777',
  coverTo:   '#BE185D',

  // 카드 앞면 — 영단어 (Flashcard 앞면 재사용 — 디자인 시스템 정합)
  wordFrom: '#FFFDE7',
  wordMid:  '#FFF9C4',
  wordTo:   '#FFF59D',

  // 카드 앞면 — 뜻 (Flashcard 뒷면 재사용)
  meaningFrom: '#E8F5E9',
  meaningMid:  '#C8E6C9',
  meaningTo:   '#A5D6A7',

  // 매칭 성공
  matchedGold:  '#FFE234',     // WordBlitz 황금 정합
  matchedGreen: '#22C55E',
  matchedDark:  '#16A34A',

  // 매칭 실패
  shakeRed:    '#EF4444',

  // 텍스트
  textWord:    '#1F2937',      // 노란 카드 위 영단어
  textMeaning: '#065F46',      // 녹색 카드 위 뜻
} as const;

export const PF_DIMS = {
  cardAspectRatio: '3 / 4',
  cardRadius: 'var(--r-2xl)',  // 24px (Flashcard 정합)
  perspective: 1200,
  flipDuration: 550,           // ms
  matchedDuration: 1200,       // ms (사라지기 애니메이션)
  shakeDuration: 600,          // ms
  mismatchHoldDuration: 800,   // ms (실패 시 다시 뒤집히기 전 대기)
} as const;

/**
 * 카드 뒷면 패턴 5종 — 시각 다양성 (Variable Reward)
 * 매번 다른 패턴 노출 → 기대감 유발
 */
export type PFBackPattern = 'diamond' | 'wave' | 'star' | 'grid' | 'logo';
export const PF_BACK_PATTERNS: PFBackPattern[] = ['diamond', 'wave', 'star', 'grid', 'logo'];
```

### mock-data.ts 작성 규격

```typescript
// apps/web/src/components/pairflip/mock-data.ts
// 5쌍 default + 10쌍까지 확장 가능한 풀

export interface PairFlipMockWord {
  pairId: string;
  word: string;
  meaning: string;
  partOfSpeech?: string;
  phonetic?: string;
}

export const MOCK_PAIRS: PairFlipMockWord[] = [
  { pairId: 'p1',  word: 'evolution',  meaning: '진화, 발전', partOfSpeech: 'noun', phonetic: '/ˌiː.vəˈluː.ʃən/' },
  { pairId: 'p2',  word: 'adapt',      meaning: '적응하다',   partOfSpeech: 'verb', phonetic: '/əˈdæpt/' },
  { pairId: 'p3',  word: 'thrive',     meaning: '번창하다',   partOfSpeech: 'verb', phonetic: '/θraɪv/' },
  { pairId: 'p4',  word: 'predator',   meaning: '포식자',     partOfSpeech: 'noun', phonetic: '/ˈpred.ə.tər/' },
  { pairId: 'p5',  word: 'survive',    meaning: '살아남다',   partOfSpeech: 'verb', phonetic: '/sərˈvaɪv/' },
  { pairId: 'p6',  word: 'habitat',    meaning: '서식지',     partOfSpeech: 'noun', phonetic: '/ˈhæb.ɪ.tæt/' },
  { pairId: 'p7',  word: 'prey',       meaning: '먹이',       partOfSpeech: 'noun', phonetic: '/preɪ/' },
  { pairId: 'p8',  word: 'extinct',    meaning: '멸종된',     partOfSpeech: 'adj',  phonetic: '/ɪkˈstɪŋkt/' },
  { pairId: 'p9',  word: 'species',    meaning: '종, 종류',   partOfSpeech: 'noun', phonetic: '/ˈspiː.ʃiːz/' },
  { pairId: 'p10', word: 'mutation',   meaning: '돌연변이',   partOfSpeech: 'noun', phonetic: '/mjuːˈteɪ.ʃən/' },
];

/**
 * 카드 셔플 + 짝 분리 + 랜덤 위치 배치
 */
export function buildPairFlipCards(pairs: PairFlipMockWord[]) {
  const cards = pairs.flatMap((p, idx) => [
    {
      id: `${p.pairId}-w`,
      pairId: p.pairId,
      type: 'word' as const,
      content: p.word,
      partOfSpeech: p.partOfSpeech,
      phonetic: p.phonetic,
      state: 'covered' as const,
      position: 0,
      attempts: 0,
      patternIndex: idx % 5,
    },
    {
      id: `${p.pairId}-m`,
      pairId: p.pairId,
      type: 'meaning' as const,
      content: p.meaning,
      partOfSpeech: p.partOfSpeech,
      state: 'covered' as const,
      position: 0,
      attempts: 0,
      patternIndex: idx % 5,
    },
  ]);

  // Fisher-Yates shuffle
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  cards.forEach((c, idx) => (c.position = idx));
  return cards;
}
```

### 작업 종료 시 보고 형식

```
✅ PR 2 완료
- 변경 파일: 4개 (types.ts · constants.ts · theme.ts · mock-data.ts)
- Default 카드 수: 10장 (5쌍) — Cowan WM 한계 정밀 매칭 ✓
- 5단계 난이도 정의 완료 ✓
- FSRS rating 매핑 함수 구현 ✓
- 콤보 시각 보상 단계 (3·5·7) 정의 ✓
- 게임 전용 색상 주석 명시 ✓
- 다음 작업: PR 3 Start Screen + 마스코트

확인 후 "PR3 시작" 이라고 입력해주세요.
```

---

## PR 3 — Start Screen + 마스코트 + 환경

### 작업 명령

```
다음 컴포넌트를 신규 생성해줘:

1. apps/web/src/components/pairflip/PairFlipEnv.tsx
   ← 따뜻한 크림 → 호박 그라디언트 환경
   ← 좌상단 마법 모자 SVG (4s slow bounce)
   ← 우상단 별 파티클 4개 (twinkle 2~3s 각각 다른 주기)
   ← 좌하단 펼친 책 SVG · 우하단 깃펜+잉크병 SVG (정적)
   ← 하단 마호가니 책상 (h-[60px] · linear-gradient #8B4513 → #5D2F0A)

2. apps/web/src/components/pairflip/PairFlipMascot.tsx
   ← 부엉이 마스코트 SVG (영어 학습 상징)
   ← 4가지 상태: 'idle' (졸음) · 'cheer' (응원) · 'happy' (환호) · 'clap' (박수)
   ← idle 상태 default · 시작 화면에서 사용
   ← 각 상태별 부드러운 morphing 애니메이션 (200ms ease)
   ← 우측 하단 fixed 위치 (mobile: 80×80 / desktop: 100×100)

3. apps/web/src/components/pairflip/PairFlipLogo.tsx
   ← "PairFlip" 텍스트 (Plus Jakarta Sans · 900 · clamp(40px, 10vw, 56px))
   ← 글자별 색상: P:#EF4444 · a:#F59E0B · i:#EC4899 · r:#8B5CF6 · F:#F59E0B · l:#EC4899 · i:#8B5CF6 · p:#EF4444
   ← drop-shadow(2px 2px 0 rgba(0,0,0,0.1))
   ← 한글 부제 "짝맞추기" (DM Sans · 500 · 14px · opacity-70)
   ← 글자별 hover 시 살짝 위로 (translateY -2px) 순차 애니메이션 (Idle 상태)

4. apps/web/src/components/pairflip/PairFlipLevelSelector.tsx
   ← 5단계 난이도 가로 카드 그리드 (모바일 가로 스크롤)
   ← 각 카드: 88×88 min size · 이모지 + 라벨 + 쌍 수 + 시간
   ← 선택 카드: 핑크 그라디언트 + translateY(-4px) + shadow-lg
   ← 비선택: bg-white + border 1.5px var(--bd)
   ← 클릭 시 spring scale 1.0→1.05→1.0 (180ms · var(--ease-spring))
   ← Default selected: 'normal' (5쌍)

5. apps/web/src/components/pairflip/PairFlipModeSelector.tsx
   ← 2가지 모드 (word_meaning / word_definition)
   ← Toggle 버튼 그룹 (Parts Kit ButtonGroup 재사용)
   ← Default: 'word_meaning'
   ← word_definition 은 Phase 2 — disabled 상태로 "준비 중" 표기

6. apps/web/src/components/pairflip/PairFlipStartScreen.tsx
   ← 위 5개 컴포넌트 통합
   ← 레이아웃 (모바일 stack):
       ① PairFlipEnv (전체 배경)
       ② PairFlipLogo (상단 중앙)
       ③ PairFlipMascot (우측 하단 fixed)
       ④ PairFlipLevelSelector (중앙)
       ⑤ PairFlipModeSelector (레벨 아래)
       ⑥ "시작하기" 버튼 (하단 sticky, w-full max-w-[320px])
   ← 시작 버튼 디자인:
       background: linear-gradient(135deg, #EC4899, #F59E0B)
       boxShadow: 0 5px 0 #BE185D, var(--sh-lg)
       padding: py-5 / 18px font-[800]
       hover: translateY(-3px) + shadow ↑
       active: translateY(1px)
   ← 시작 버튼 클릭 시:
       - 선택된 레벨·모드를 sessionStorage 에 저장 ('pairflip-config')
       - router.push('/pairflip/play')

7. apps/web/src/app/(main)/pairflip/page.tsx 업데이트
   ← PairFlipStartScreen 통합
   ← 페이지 메타: "PairFlip — 짝맞추기 카드 게임"
   ← Sidebar + FlowNav 표시 (게임 play 가 아니라 Hub 이므로)

검증 사항:
- 환경 그라디언트가 위에서 아래로 자연스러운가
- 마스코트가 너무 크지 않은가 (모바일 80×80 한도 준수)
- 로고 글자 색이 사이드바 익히기 그룹 핑크와 정합되는가
- 레벨 카드 터치 타겟 ≥ 88×88 (Calm UI · Fitts 정합)
- 다크모드 동작 (data-theme="dark")
- pnpm typecheck 오류 없는가
- pnpm lint 통과하는가
```

### 작업 종료 시 보고 형식

```
✅ PR 3 완료
- 변경 파일: 6개 (Env · Mascot · Logo · LevelSelector · ModeSelector · StartScreen)
- 마스코트 4가지 상태 SVG 구현 ✓
- 5단계 난이도 + Default Normal ✓
- 시작 버튼 sessionStorage 연동 ✓
- 환경 그라디언트 + 장식 SVG 5종 ✓
- 다크모드 정합 ✓
- 다음 작업: PR 4 Game Screen 핵심 (카드 + 매칭 로직)

확인 후 "PR4 시작" 이라고 입력해주세요.
```

---

## PR 4 — Game Screen 카드 + 매칭 로직

### 작업 명령

```
다음 컴포넌트와 훅을 신규 생성해줘:

1. apps/web/src/components/pairflip/PairFlipCard.tsx
   ← 단일 카드 (3D flip · 5가지 상태 처리)
   ← Flashcard.html 의 .fc-card · .fc-face 패턴 정확히 재사용
   ← perspective: 1200px (theme.ts PF_DIMS.perspective)
   ← flip transition: 0.55s cubic-bezier(0.4, 0, 0.2, 1)
   ← 상태별 클래스:
       'covered'  → 뒷면만 보임
       'flipped'  → 앞면 보임 (사용자 클릭 후)
       'matched'  → 매칭 성공 애니메이션 (1.2s · scale + rotate + fade)
       'shaking'  → 600ms shake (translateX ±8px)
       'gone'     → opacity 0 + pointer-events none
   ← Idle 애니메이션:
       뒷면 카드만 부유 (translateY 2px / 4s ease-in-out)
       staggered delay = position * 0.1s
       motion-safe 만 적용 (prefers-reduced-motion 대응)
   ← 뒷면 패턴 5종 SVG (theme.ts PF_BACK_PATTERNS):
       diamond · wave · star · grid · logo
       props.patternIndex 에 따라 분기
   ← 앞면 (영단어):
       gradient #FFFDE7 → #FFF59D
       Lora serif · clamp(20px, 5vw, 26px) · 700
       단어 + 발음 (있으면) · 좌상단 작은 별 ★
   ← 앞면 (뜻):
       gradient #E8F5E9 → #A5D6A7
       Plus Jakarta Sans · clamp(15px, 4vw, 20px) · 700 · #065F46
       뜻 + 좌상단 품사 뱃지
   ← onClick props · disabled 상태 처리 (matched·gone·다른 카드 reveal 중)
   ← aria-label: 상태에 따라 동적
       covered: "${카드 위치}번째 카드, 뒤집기"
       flipped: "${카드 내용}, 짝을 찾고 있는 중"
       matched: "${카드 내용}, 매칭 성공"

2. apps/web/src/components/pairflip/PairFlipGrid.tsx
   ← 카드 그리드 컨테이너
   ← gridCols 레벨에 따라 동적 (constants.ts PAIRFLIP_LEVELS.gridCols)
   ← gap-3 (12px) 일관
   ← max-width 제한 (모바일: 100% / 데스크톱: 600px)
   ← aspect-ratio 보존 (3/4)

3. apps/web/src/hooks/usePairFlipSession.ts
   ← 게임 상태 머신 (PairFlipPhase)
   ← 카드 클릭 핸들러:
       - phase === 'idle' && card.state === 'covered' → 첫 카드 flip
       - phase === 'reveal_first' && 다른 카드 클릭 → 두 번째 flip · 검증
   ← 매칭 검증:
       - 두 카드 pairId 동일 → matched 상태로 전환
         → 1.2s 후 gone 상태 (사라짐)
         → matchedPairs++, combo++, score 증가 (constants.ts PAIRFLIP_SCORE)
         → 모든 쌍 매칭 → phase 'won'
       - 다르면 → mismatched 상태 800ms hold
         → 두 카드 다시 covered 로 복귀
         → combo = 0, attempts++
   ← 타이머:
       - 게임 시작 시 timeLimit 만큼 카운트다운
       - 0 도달 → phase 'lost'
       - useEffect setInterval 1s
   ← 점수 계산:
       - 매칭 성공: matchBase × comboMultiplier[combo]
       - 시간 보너스 (게임 종료 시): 남은 초 × timeBonus
       - Perfect bonus (실패 0회): +500
   ← 힌트 사용 (선택):
       - 무작위 매칭 안 된 1쌍을 1초간 동시 reveal
       - hintsUsed++, score += hintPenalty (-30)
       - 게임당 최대 2회

4. apps/web/src/components/pairflip/PairFlipHUD.tsx
   ← 상단 sticky bar (h-[60px])
   ← 좌측: 타이머 ⏱
       JetBrains Mono 18px / 700
       10초 미만: 빨간색 + pulse 1s 무한
   ← 중앙: 점수 ⭐
       JetBrains Mono 20px / 800 / #F59E0B
       점수 증가 시: scale 1.0→1.2→1.0 spring (180ms)
   ← 우측: 콤보 ×N
       콤보 1: 미표시
       콤보 2~4: 핑크 뱃지
       콤보 5~6: 보라 뱃지 (시각 보상 단계 2)
       콤보 7+: 무지개 그라디언트 + sparkle 아이콘 (시각 보상 단계 3)
   ← 힌트 버튼 (우측 끝): 💡 + 남은 횟수
       클릭 시 onUseHint() 호출

5. apps/web/src/components/pairflip/PairFlipFeedback.tsx
   ← 매칭 성공/실패 오버레이 (1초)
   ← 성공: ✓ 아이콘 + 초록 + 별 폭발 파티클 6개
   ← 실패: ✗ 아이콘 + 빨강 + shake (no particle)
   ← 색맹 대응: 색 + 형태(아이콘) + 모션 3중 표현
   ← 콤보 단계 도달 시 (3·5·7):
       추가 텍스트 표시 ("GREAT!" / "AMAZING!" / "INCREDIBLE!")
       Plus Jakarta · 28px · 800 · drop-shadow

6. apps/web/src/components/pairflip/PairFlipProgress.tsx
   ← 하단 진행바 (h-[50px])
   ← 진행바 6px / rounded-full / 핑크 그라디언트
   ← width: (matchedPairs / totalPairs) * 100%
   ← transition: width 0.6s ease-out
   ← 우측: "2/5 쌍" Plus Jakarta 14px / 700

7. apps/web/src/components/pairflip/PairFlipGameScreen.tsx
   ← 위 5개 컴포넌트 통합
   ← Sidebar 숨김 (게임 play 라우트 — CLAUDE.md §17.10 정합)
   ← FlowNav 자동 숨김 (`*/play` 패턴)
   ← 레이아웃:
       ┌──────────────────────────┐
       │ PairFlipHUD              │ 60px sticky top
       ├──────────────────────────┤
       │ PairFlipGrid (flex:1)    │
       │ + PairFlipFeedback (overlay)
       │ + PairFlipMascot (cheer 상태)
       ├──────────────────────────┤
       │ PairFlipProgress         │ 50px
       └──────────────────────────┘
   ← phase 'won' / 'lost' → router.replace('/pairflip/results')
       sessionStorage 에 결과 저장 ('pairflip-result')

8. apps/web/src/app/(main)/pairflip/play/page.tsx 업데이트
   ← PairFlipGameScreen 통합
   ← 진입 시 sessionStorage 에서 'pairflip-config' 읽음
   ← 없으면 /pairflip 으로 redirect (config 없이 진입 방지)

검증 사항:
- 카드 클릭 → flip 0.55s 부드럽게 작동
- 두 카드 같으면 1.2s 후 사라짐
- 두 카드 다르면 800ms 후 다시 뒤집힘
- 콤보 3·5·7 도달 시 시각 보상 단계 변화
- 타이머 10초 미만 빨간 pulse
- prefers-reduced-motion 사용자는 idle 부유 애니메이션 비활성
- 모든 카드 매칭 → 결과 페이지로 자동 이동
- 시간 초과 → 결과 페이지로 자동 이동
- pnpm typecheck · lint 통과
```

### 작업 종료 시 보고 형식

```
✅ PR 4 완료
- 변경 파일: 8개 (Card · Grid · Hook · HUD · Feedback · Progress · GameScreen · play/page)
- 카드 5상태 머신 동작 ✓
- 매칭 로직 (성공·실패) ✓
- 콤보 시각 보상 3·5·7 ✓
- 색맹 대응 (색+형태+모션) ✓
- prefers-reduced-motion 대응 ✓
- FlowNav 자동 숨김 ✓
- 다음 작업: PR 5 Result Screen + 학습 모델 통합

확인 후 "PR5 시작" 이라고 입력해주세요.
```

---

## PR 5 — Result Screen + 학습 모델 통합

### 작업 명령

```
다음 컴포넌트를 신규 생성해줘:

1. apps/web/src/app/(main)/pairflip/results/page.tsx (신규 라우트)
   ← 진입 시 sessionStorage 에서 'pairflip-result' 읽음
   ← 없으면 /pairflip 으로 redirect

2. apps/web/src/components/pairflip/PairFlipResultScreen.tsx
   ← 환경: PairFlipEnv 재사용 (따뜻한 크림 톤)
   ← 마스코트: 'happy' 또는 'clap' 상태 (정확도에 따라)
   ← 중앙 결과 카드 구조:

   ┌────────────────────────────────────┐
   │       🌟 [마스코트 happy]            │
   │                                    │
   │   [원형 점수 링 SVG 120×120]        │
   │      정확도 87%                     │
   │      총 점수: 1,240                 │
   │                                    │
   │  Empathetic Feedback 카피            │
   │   "잘했어요!"                        │
   │   "거의 다 맞췄네요"                  │
   ├────────────────────────────────────┤
   │  통계 3분할                          │
   │   ⏱  시간    0:48                   │
   │   🎯  매칭    5/5                   │
   │   🔥  최고 콤보 ×4                   │
   ├────────────────────────────────────┤
   │  학습한 단어 (펼침 가능)             │
   │   ✓ evolution — 진화 (1회 시도)      │
   │   ✓ adapt — 적응하다 (2회 시도)      │
   │   ...                              │
   ├────────────────────────────────────┤
   │  [한 번 더] [난이도 변경] [WordVault] │
   └────────────────────────────────────┘

3. apps/web/src/components/pairflip/PairFlipScoreRing.tsx
   ← SVG 원형 진행 링 (120×120)
   ← strokeWidth: 12 / strokeLinecap: round
   ← 배경 원: var(--bg3)
   ← 진행 호: 정확도(matchedPairs/totalPairs)에 따라
       ≥90%: 핑크 그라디언트 (#EC4899 → #F59E0B)
       ≥70%: 앰버 (#F59E0B)
       ≥40%: 시안 (#06B6D4)
       <40%: 회색 (var(--t3))
   ← strokeDashoffset 애니메이션 1s ease-out (마운트 시)
   ← 중앙 텍스트:
       정확도 % (Plus Jakarta 32px / 800)
       그 아래 "Score: N" (DM Sans 14px / 600 / var(--t3))

4. apps/web/src/components/pairflip/PairFlipPairsList.tsx
   ← 매칭한 단어 펼침 가능 리스트 (Disclosure 컴포넌트)
   ← 각 행:
       ✓ 아이콘 + word — meaning + 시도 횟수 뱃지
       시도 1회: "한 번에" (초록 뱃지)
       시도 2회: "두 번 만에" (앰버 뱃지)
       시도 3+회: "여러 번 시도" (회색 뱃지)
   ← 미매칭 단어 (시간 초과 시): 회색 + ✗ 아이콘

5. apps/web/src/lib/pairflip/learning-records.ts (신규)
   ← FSRS rating 매핑 함수 (constants.ts pairAttemptsToFSRSRating 재사용)
   ← saveLearningRecords(session: PairFlipSession): Promise<void>
       각 pairResult 를 learning_records 테이블에 INSERT (Phase 2 — Supabase 연동 시)
       module: 'pairflip'
       rating: pairResult.fsrsRating
       is_correct: matched
       response_time_ms: matchedAt - startedAt
   ← FSRS Stability 갱신은 별도 lib/srs/fsrs.ts (이미 존재) 호출

6. apps/web/src/components/pairflip/PairFlipNextActionCard.tsx
   ← 결과 카드 하단 추천 액션 3개
   ← cold (단어 적음): "WordVault 로 단어 더 추가"
   ← warm (이번 정확도 높음): "다른 단어로 한 번 더"
   ← hot (이번 정확도 낮음): "Flashcard 로 차분히 익히기"
   ← CLAUDE.md §17.5 SDT 자율성 — 강제 X · 제안만

7. CLAUDE.md 갱신:
   - §17.6 모듈 매트릭스에 PairFlip 행 추가:
     | L4a | PairFlip | 한쪽 카드 (단어 또는 뜻) | 짝 카드 클릭 | 재인 + 공간 기억 + 매칭 인식 | 시각+공간 | new → shaky / shaky → stable |
   - §17.10 Sidebar 익히기 그룹: 4개 항목 명시 (Flashcard·WordBlitz·PairFlip·SpellForge)
   - 핵심 모듈 8개 → 9개
   - 변경 이력 v06.17 한 줄 추가

검증 사항:
- 정확도에 따라 마스코트 상태가 달라지는가 (happy / clap / cheer)
- 점수 링 애니메이션이 부드럽게 카운트업되는가
- 매칭 단어 리스트가 펼침/접힘 정상 동작하는가
- "한 번 더" 버튼 클릭 시 같은 레벨로 재시작되는가
- "난이도 변경" 클릭 시 /pairflip Hub 로 이동하는가
- "WordVault" 클릭 시 /wordvault 로 이동하는가
- pnpm typecheck · lint · build 모두 통과
```

### 작업 종료 시 보고 형식

```
✅ PR 5 완료
- 변경 파일: 7개 (results/page · ResultScreen · ScoreRing · PairsList · learning-records · NextActionCard · CLAUDE.md)
- FSRS rating 매핑 (1·2·3·4) 정확히 적용 ✓
- Empathetic Feedback 카피 4단계 ✓
- 마스코트 결과 상태 분기 ✓
- 학습 모델 v3.2 §17.6 모듈 매트릭스 갱신 ✓
- CLAUDE.md v06.17 변경 이력 추가 ✓
- 다음 작업: PR 6 Hub 페이지 통합 + 빌드 검증

확인 후 "PR6 시작" 이라고 입력해주세요.
```

---

## PR 6 — Hub 페이지 + 최종 빌드 검증

### 작업 명령

```
다음 작업을 수행해줘:

1. apps/web/src/components/pairflip/PairFlipHub.tsx (신규)
   ← Vocaflow Hub 디자인 패턴 정합 (다른 모듈 Hub 와 통일감)
   ← ModuleHero 재사용 — 익히기 그룹 핑크 그라디언트
       title: "PairFlip"
       subtitle: "짝맞추기 카드 게임"
       note: "Best ${bestScore} · 평균 콤보 ${avgCombo}"
              (cold 사용자: "첫 게임을 시작해 보세요" · warm 이상: 위 통계)
   ← StatCard inline 3분할:
       Best 점수 / 최고 콤보 / 완료 게임 수
   ← Continue Card (선택):
       마지막 플레이 레벨 표시 + "이어 도전" 버튼
   ← Level 미리보기 grid:
       PairFlipLevelSelector 재사용 (작은 사이즈)
       클릭 시 sessionStorage 저장 + /pairflip/play 진입
   ← Recent Activity:
       최근 5게임 결과 (간략)

2. apps/web/src/app/(main)/pairflip/page.tsx 최종 업데이트
   ← PairFlipHub 통합 (Start Screen 은 별도 라우트로 분리)
   ← 또는: Hub + Start Screen 한 페이지에서 토글 (현재 Flashcard 패턴 정합)
   → 검토 후 결정: Flashcard 가 어떤 패턴인지 먼저 확인

3. apps/web/src/components/pairflip/index.ts (배럴 익스포트)
   ← 모든 컴포넌트 export

4. CLAUDE.md 추가 갱신:
   - 모노레포 구조 트리에 components/pairflip/ 추가
   - "독립 레퍼런스 HTML" 섹션에 PairFlip 항목 추가 (또는 React 구현 직접 표시)

5. README 또는 docs/MODULES.md 갱신 (있다면):
   - PairFlip 모듈 한 줄 설명 추가

빌드 검증 명령어 순서로 실행:

1. cd C:\Users\kille\Vocaflow
2. pnpm install
3. pnpm --filter @vocaflow/web typecheck
4. pnpm --filter @vocaflow/web lint
5. pnpm --filter @vocaflow/web build

오류 발생 시 자동 수정 시도하고 변경 사항 보고.

다음 검증 항목 16개를 점검:

[ ] 1. Sidebar 익히기 그룹에 4개 항목 (Flashcard·WordBlitz·PairFlip·SpellForge)
[ ] 2. 정렬 순서 = 인지 깊이 (L4a → L4a → L4a → L4b)
[ ] 3. /pairflip Hub 진입 가능 (Sidebar + FlowNav 표시)
[ ] 4. /pairflip/play 게임 진입 가능 (Sidebar 숨김 · FlowNav 자동 숨김)
[ ] 5. /pairflip/results 결과 페이지 정상 동작
[ ] 6. Default 레벨 = Normal (5쌍 10장) — Cowan WM 정합
[ ] 7. 카드 3D flip 0.55s 부드러움
[ ] 8. 매칭 성공 → 1.2s 사라짐 애니메이션
[ ] 9. 매칭 실패 → 800ms 후 다시 뒤집힘
[ ] 10. 콤보 3·5·7 도달 시 시각 보상 단계 변화
[ ] 11. 색맹 대응 (색+형태+모션 3중)
[ ] 12. prefers-reduced-motion 대응
[ ] 13. 다크모드 (data-theme="dark") 정상
[ ] 14. 모든 터치 타겟 ≥ 44×44 (CLAUDE.md WCAG AA)
[ ] 15. FSRS rating 매핑 (시도 횟수에 따라 1·2·3·4)
[ ] 16. CLAUDE.md v06.17 변경 이력 + §17.6 모듈 매트릭스 갱신

각 항목 ✓ / ✗ / ⚠️ 와 근거 파일/라인 번호 함께 보고.
```

### 작업 종료 시 최종 보고 형식

```
🎉 PairFlip v06.17 통합 완료

전체 변경 파일 수: N개
신규 컴포넌트: M개
신규 훅: 1개 (usePairFlipSession)
신규 라이브러리: 1개 (lib/pairflip/learning-records.ts)
CLAUDE.md 갱신: §17.6 + §17.10 + 변경 이력 + 모노레포 트리

검증 결과 (16/16):
- ✓ 모든 항목 통과 (또는 ⚠️ 미해결 N개 보고)

빌드 결과:
- typecheck: ✓
- lint: ✓
- build: ✓

다음 단계 권장:
- 사용자 테스트 (실제 게임 플레이 5분)
- Phase 2 — 사전 API 연동 (발음 IPA 자동 채우기)
- Phase 2 — 그림 모드 (word_image) 자산 준비 후 활성화
- Phase 2 — 멀티플레이어 모드 검토
```

---

## CLAUDE.md 갱신 사양 (PR 5 + PR 6 통합)

### v06.17 변경 이력 추가

```markdown
**v06.17** PairFlip 신규 모듈 — 짝맞추기 카드 뒤집기 게임

핵심 모듈 8 → 9개. 익히기 그룹 (L4a Recognize) 4번째 모듈로 추가.

설계 근거 5관점:
- 뇌과학: Default 5쌍(10장) — Cowan WM 한계 (3~5 chunk) 정밀 매칭 / spatial memory 활용
- 심리학: Skinner Variable Ratio — 콤보 3·5·7 시각 보상 단계 가속 / SDT 자율성 5단계 자유 선택
- 디자인: 따뜻한 크림 톤 환경 + 부엉이 마스코트 (Flashcard 하늘·SpellForge 파란·WordBlitz 정글 시각 차별화) / 익히기 그룹 핑크(#EC4899) 메인 액센트
- 흥미: 카드 뒷면 5종 패턴 + Idle 부유 애니메이션 + 마스코트 4상태 (idle·cheer·happy·clap)
- 접근성: 색맹 대응 (색+형태+모션 3중) / prefers-reduced-motion / 44×44 Fitts / aria-label 동적

5단계 난이도: Easy 4장 · Normal 10장 ★ · Hard 12장 · Expert 16장 · Master 20장
2가지 모드: word_meaning (default) · word_definition (Phase 2)

FSRS 통합:
- 첫 시도 매칭 → rating 4 (Easy)
- 2회 시도 매칭 → rating 3 (Good)
- 3~4회 시도 매칭 → rating 2 (Hard)
- 5회+ 또는 미매칭 → rating 1 (Again)

라우트:
- /pairflip — Hub (Best 점수 · 콤보 통계 · 레벨 미리보기 · 최근 게임)
- /pairflip/play — 게임 세션 (Sidebar·FlowNav 자동 숨김)
- /pairflip/results — 결과 (점수 링 · 매칭 단어 · 다음 액션 추천)

Sidebar 익히기 그룹 4개 항목 정렬 = 인지 깊이:
Flashcard (L4a 자가판정) → WordBlitz (L4a 속도) → PairFlip (L4a 공간기억+매칭) → SpellForge (L4b 시각생성)

§17.6 모듈 매트릭스 PairFlip 행 추가.
§17.10 Sidebar 5그룹 익히기 그룹 항목 명시 갱신 (4개).
모노레포 구조 트리 components/pairflip/ 추가.
```

### §17.6 모듈 매트릭스 PairFlip 행 추가

```markdown
| 계층 | 모듈 | 단서 | 응답 | 회상 깊이 | 적합 단어 상태 |
|------|------|------|------|----------|--------------|
| L4a | Flashcard | 단어 1개 (시각) | 자가판정 (Again/Hard/Good/Easy) | 재인 + 메타인지 | new → shaky |
| L4a | WordBlitz | 4지선다 | 클릭/탭 (속도) | 재인 + 자동화 | shaky → stable 가속 |
| **L4a** | **PairFlip** | **카드 한쪽 (단어 또는 뜻)** | **짝 카드 위치 식별·클릭** | **재인 + 공간 기억 + 매칭 인식** | **new → shaky / shaky → stable** |
| L4b | SpellForge | 뜻 + 첫 글자 | 타이핑 (시각 생성) | 시각·의미 생성 인출 | shaky → stable 검증 |
```

PairFlip 의 인지 유형 차별점:
- Flashcard 는 단어를 **알고 있는지** 자가판정 (메타인지 중심)
- WordBlitz 는 보기에서 **빠르게 인식** (자동화 중심)
- PairFlip 은 카드 위치를 **공간적으로 기억** + **시각·언어 매칭** (Tversky spatial memory)
- SpellForge 는 뜻을 보고 **철자를 생성** (생성 인출)

같은 L4a 안에서 PairFlip 은 Working Memory · Spatial Memory · Recognition 3중 인지 활성화 — Flashcard·WordBlitz 보다 인지 채널이 다양.

---

## 작업 시작

```
"PR1 시작"
```

위 한 줄을 입력하면 PR 1부터 순차 진행.
각 PR 완료 후 정형 보고 → 사용자 확인 후 다음 PR → 최종 PR 6 에서 16개 검증.

전체 한 번에 진행하려면: `"전체 진행"`

---

## 미정 항목 (Phase 2 결정 필요)

```
- 사운드 효과 (Web Audio API · howler.js) — Calm UI default off 제안
- 멀티플레이 모드 — 친구와 1:1 대결 또는 turn-based
- word_image 모드 — 명사 단어 + 일러스트 매칭 (이미지 자산 출처 결정 필요)
- 일일 챌린지 — 매일 1게임 무료 + Streak 정합
- 리더보드 — 글로벌 vs 친구 vs 비공개 (CLAUDE.md "Calm UI 위반" 우려 검토)
- 카드 셔플 강도 — 매 턴 셔플 (Hard mode 옵션) vs 위치 고정 (Easy)
```

---

*이 지시문은 CLAUDE.md v06.17 (예정) 의 부속 문서입니다.*
*충돌 시 CLAUDE.md 가 우선합니다.*
