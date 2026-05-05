# Vocaflow SRS UI 통합 — VS Code Claude Code 지시문 v4

> D → A → C → B 4단계. 학습 사이클 1바퀴 완성.
> 각 단계 끝에 사용자 승인 후 다음 단계 진행.

---

## 0. 역할 및 규칙

- **SSoT**: 워크스페이스 루트 `CLAUDE.md v06.8`
- 응답: **한국어** / 코드 주석: **영문**
- 결론 먼저, 근거는 그 다음
- 절대 금지: TODO · placeholder · 미완성 코드
- 색상 하드코딩 금지 (CSS 변수 사용, `globals.css` 68~71행에 4색 정의됨)
- 다크모드 대응 항상 포함 (`data-theme="dark"`)
- 터치 타겟 최소 44×44px (WCAG AA)
- 매 단계 끝 → 사용자 승인 후 다음 단계

---

## 1. 워크스페이스 확정 사실 (사전 정찰 완료)

```
apps/web/src/
├── app/globals.css                          ← 68~71행: --memory-stable/shaky/risk/new 4색 정의
├── components/
│   ├── home/
│   │   ├── HubHero.tsx                      ← 라인 40: Today CTA 영역 주석 존재
│   │   ├── ContinueCard.tsx
│   │   └── ModuleCard.tsx
│   ├── wordvault/
│   │   ├── types.ts                         ← WordItem: mastery/lastDays/nextDays (SM-2 흔적)
│   │   ├── WordRow.tsx                      ← word: WordItem props
│   │   ├── StudyMode.tsx                    ← 5단계 RATINGS placeholder (이번 작업 격리)
│   │   └── mock-data.ts                     ← MOCK_WORDS (시드 데이터)
│   └── flashcard/
│       ├── FlashcardSession.tsx             ← 라인 121: handleSRSRating(rating: SRSRating)
│       ├── SRSBar.tsx
│       └── ForgettingCurve.tsx              ← 빈 파일 (향후 시각화 자리)
└── lib/
    ├── srs/
    │   ├── types.ts / state.ts / fsrs.ts    ← 47 tests PASS (단계 0 완료됨)
    │   ├── index.ts / queue-builder.ts
    │   └── supabase-adapter.ts
    └── text-viewer/handoff.ts               ← sessionStorage 기반 단어 인계
```

**SRSRating 타입** (`'again' | 'hard' | 'good' | 'easy'`)은 FSRS Rating 1~4와 1:1 매핑됨.
**CSS 4색 변수** 모두 `globals.css`에 정의됨 — 추가 작업 불필요.
**StudyMode의 5단계 RATINGS**(`'10분 후'` placeholder)는 이번 작업 범위 밖 — 손대지 않음.

---

## 2. 마이그레이션 전략 — 점진 wrapper

`WordItem`에 `srs?: SrsCard` 옵셔널 필드 추가. 기존 `mastery/lastDays/nextDays` 유지 (UI 호환성 보존).

```typescript
// 이렇게
export interface WordItem {
  // ...기존 필드 그대로...
  /** §17 v2.0 SRS 필드 — 진짜 학습 데이터. undefined이면 'new' 취급. */
  srs?: SrsCard
}
```

신규 단어(`handoff.ts`에서 들어오는 단어)는 `srs`를 채워서 옴.
시드 데이터(`MOCK_WORDS`)는 `srs: undefined` → MemoryBadge는 'new' 색 표시.
추후 DB 연동 시 `srs`를 실제 `vocabularies` row에서 채우는 것으로 교체.

---

## 3. 단계 D — MemoryBadge 컴포넌트 신규 생성

### 목표
DB 없이 완전 동작하는 순수 UI 컴포넌트.
`srs?: SrsCard`를 받아 `getMemoryState(srs)` → 4색 배지 렌더링.

### 파일 생성

`src/components/ui/MemoryBadge.tsx` 신규 생성:

```typescript
// src/components/ui/MemoryBadge.tsx
// Memory Decay 4색 배지 — CLAUDE.md §17.2 [2] 상태 축
// CSS 변수: globals.css 68~71행 (--memory-stable/shaky/risk/new)
// srs 없으면 'new' (gray) 표시 — 시드 데이터 및 DB 미연동 단어 처리
'use client'

import { getMemoryState, getRetrievability } from '@/lib/srs'
import type { MemoryState, SrsCard } from '@/lib/srs'
import { cn } from '@/lib/utils/cn'

export interface MemoryBadgeProps {
  /** SRS 카드 — undefined이면 'new' 취급 */
  srs?: SrsCard
  /** 배지 크기 (default: 'sm') */
  size?: 'xs' | 'sm' | 'md'
  /** 툴팁 표시 여부 (default: true) */
  showTooltip?: boolean
  className?: string
}

/** 4색 → CSS variable + 라벨 (사용자 가시 라벨은 격려형 — §17 안티패턴 5 준수) */
const STATE_CONFIG: Record<MemoryState, {
  cssVar: string
  label: string
  dot: string
}> = {
  stable: {
    cssVar: 'var(--memory-stable)',
    label: '잘 알고 있어요',
    dot: 'bg-[var(--memory-stable)]',
  },
  shaky: {
    cssVar: 'var(--memory-shaky)',
    label: '익숙해지는 중',
    dot: 'bg-[var(--memory-shaky)]',
  },
  risk: {
    cssVar: 'var(--memory-risk)',
    label: '다시 만나봐요',     // 압박 표현 금지 (§17 안티패턴)
    dot: 'bg-[var(--memory-risk)]',
  },
  new: {
    cssVar: 'var(--memory-new)',
    label: '처음 만나는 단어',
    dot: 'bg-[var(--memory-new)]',
  },
}

const SIZE_CLASS = {
  xs: 'w-1.5 h-1.5',
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
}

export function MemoryBadge({
  srs,
  size = 'sm',
  showTooltip = true,
  className,
}: MemoryBadgeProps) {
  // srs 없으면 'new' (DB 미연동 단어)
  const state: MemoryState = srs ? getMemoryState(srs) : 'new'
  const config = STATE_CONFIG[state]

  // FSRS 변수(D/S/R)는 노출 금지 — §17 안티패턴 2
  // 툴팁에 라벨만 표시
  const tooltipText = showTooltip ? config.label : undefined

  return (
    <span
      className={cn('inline-flex items-center justify-center rounded-full flex-shrink-0', SIZE_CLASS[size], className)}
      style={{ backgroundColor: config.cssVar }}
      title={tooltipText}
      aria-label={config.label}
      role="img"
    />
  )
}

/** 배지 + 텍스트 조합 — WordRow 상세 펼침 등에 사용 */
export function MemoryLabel({ srs }: { srs?: SrsCard }) {
  const state: MemoryState = srs ? getMemoryState(srs) : 'new'
  const config = STATE_CONFIG[state]

  return (
    <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: config.cssVar }}>
      <span
        className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: config.cssVar }}
      />
      {config.label}
    </span>
  )
}
```

### 검증

`src/components/ui/__tests__/MemoryBadge.test.tsx` 신규 생성:

```typescript
// src/components/ui/__tests__/MemoryBadge.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MemoryBadge } from '../MemoryBadge'
import { createNewCard } from '@/lib/srs'

describe('MemoryBadge', () => {
  it('srs 없으면 new 상태 (처음 만나는 단어)', () => {
    render(<MemoryBadge />)
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', '처음 만나는 단어')
  })

  it('신규 카드는 new 상태', () => {
    const card = createNewCard('test-1')
    render(<MemoryBadge srs={card} />)
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', '처음 만나는 단어')
  })

  it('size prop이 적용됨', () => {
    render(<MemoryBadge size="md" />)
    expect(screen.getByRole('img')).toHaveClass('w-2.5')
  })
})
```

> `@testing-library/react`가 없으면: `pnpm add -D @testing-library/react @testing-library/jest-dom`

### 단계 D 보고

```markdown
### 단계 D 완료
- src/components/ui/MemoryBadge.tsx 생성 (MemoryBadge + MemoryLabel)
- 4색 CSS 변수 사용, FSRS 변수 노출 없음
- 테스트 3개 PASS
다음: 단계 A (HubHero Today CTA) 진행할까요?
```

---

## 4. 단계 A — HubHero Today CTA에 mock 추천 결과 바인딩

### 목표
`HubHero.tsx` 라인 40의 Today CTA 영역에 추천 엔진 결과를 표시.
추천 엔진은 **mock 버전**으로 작성 — DB 없이 동작, 인터페이스는 실제와 동일.
DB 연동 시 mock 함수 4개만 실제 Supabase 쿼리로 교체.

### 2-A. 추천 엔진 타입 파일

`src/lib/recommend/types.ts` 신규 생성:

```typescript
// src/lib/recommend/types.ts
// 추천 엔진 타입 — CLAUDE.md §17.3 [3] 추천 축
// 호출 위치 정확히 3곳:
//   1. Hub Today CTA         ← 이번 단계
//   2. FloatingSparkle       ← Workspace 작업 시 추가
//   3. 세션 종료 후           ← 각 게임 종료 화면 작업 시 추가

import type { ModuleId } from '@/lib/srs'

export interface RecommendedAction {
  module: ModuleId | 'library'
  /** 격려형 라벨만 — 정확도/실패 카운트 절대 금지 (§17 안티패턴 5) */
  label: string
  wordIds?: string[]
  textId?: string
  strategy?: 'blocked' | 'hybrid' | 'interleaved'
  unit?: 'sentence' | 'paragraph' | 'full'
}

export type MasteryLevel = 'cold' | 'warm' | 'hot'

export interface MockUserContext {
  masteryLevel: MasteryLevel
  totalWords: number
  currentStreak: number
  /** R<0.6 단어 수 (mock용 직접 주입) */
  urgentWordCount: number
  /** 진행 중 텍스트 제목 (없으면 undefined) */
  inProgressTextTitle?: string
}
```

### 2-B. mock 추천 엔진

`src/lib/recommend/next-action.mock.ts` 신규 생성:

```typescript
// src/lib/recommend/next-action.mock.ts
// 추천 엔진 mock 버전 — DB 없이 동작
// DB 연동 시 이 파일을 next-action.ts(실제 Supabase 쿼리)로 교체
// 인터페이스는 완전히 동일 유지

import type { MockUserContext, RecommendedAction } from './types'

/**
 * §17.9 추천 우선순위 P1~P4 — mock 데이터 기반
 * 실제 DB 연동 후에는 이 함수만 교체, HubHero는 변경 불필요
 */
export function getMockNextAction(ctx: MockUserContext): RecommendedAction {
  // P1: 회상 위급 (R<0.6) ≥ 3개
  if (ctx.urgentWordCount >= 3) {
    return {
      module: 'flashcard',
      strategy: 'blocked',
      label: `오늘 ${ctx.urgentWordCount}개를 다시 만나보세요`,
    }
  }

  // P2: 진행 중 텍스트
  if (ctx.inProgressTextTitle) {
    return {
      module: 'workspace',
      label: `${ctx.inProgressTextTitle} 이어 듣기`,
    }
  }

  // P3: 사용자 단계별
  switch (ctx.masteryLevel) {
    case 'cold':
      return {
        module: 'flashcard',
        strategy: 'blocked',
        label: '오늘 10개 단어를 만나볼까요?',
      }
    case 'warm':
      return {
        module: 'dictation',
        unit: 'sentence',
        strategy: 'hybrid',
        label: '귀로 익혀볼 시간이에요',
      }
    case 'hot':
      return {
        module: 'scriptquiz',
        strategy: 'interleaved',
        label: '원문 전체를 점검해볼까요?',
      }
  }

  // P4: Cold start
  return { module: 'library', label: '새 원문을 만나보세요' }
}

/** 데모용 mock 컨텍스트 — Hub 개발 확인용 */
export const MOCK_USER_CONTEXTS: Record<string, MockUserContext> = {
  cold: {
    masteryLevel: 'cold',
    totalWords: 12,
    currentStreak: 2,
    urgentWordCount: 0,
  },
  warm_urgent: {
    masteryLevel: 'warm',
    totalWords: 150,
    currentStreak: 8,
    urgentWordCount: 5,
    inProgressTextTitle: undefined,
  },
  warm_inprogress: {
    masteryLevel: 'warm',
    totalWords: 200,
    currentStreak: 12,
    urgentWordCount: 1,
    inProgressTextTitle: 'Chapter 3 — The Future of AI',
  },
  hot: {
    masteryLevel: 'hot',
    totalWords: 620,
    currentStreak: 35,
    urgentWordCount: 0,
  },
}
```

### 2-C. HubHero.tsx 수정

`HubHero.tsx`를 열고 라인 40의 Today CTA 영역을 수정. 기존 정적 UI를 추천 결과로 교체.

**수정 패턴**:

```typescript
// HubHero.tsx 상단 import 추가
import { getMockNextAction, MOCK_USER_CONTEXTS } from '@/lib/recommend/next-action.mock'
import type { RecommendedAction } from '@/lib/recommend/types'

// 컴포넌트 내부 — 라인 40 영역
// 개발 중에는 MOCK_USER_CONTEXTS.warm_urgent 사용
// DB 연동 후: getMockNextAction을 실제 getNextAction(userId)으로 교체
const recommendation: RecommendedAction = getMockNextAction(MOCK_USER_CONTEXTS.warm_urgent)
```

Today CTA 영역(`{/* 우측: Today's Review CTA */}`)을 다음 UI로 교체:

```tsx
{/* 우측: Today's Review CTA — §17.3 추천 축 (3곳 중 1곳) */}
<div className="flex flex-col items-end gap-1.5">
  <span className="text-xs font-medium opacity-50 uppercase tracking-wide">
    오늘의 추천
  </span>
  <button
    className={cn(
      'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold',
      'bg-[var(--p)] text-white',
      'hover:bg-[var(--p-dark)] active:scale-95 transition-all',
      'min-h-[44px]', // WCAG 터치 타겟
    )}
    onClick={() => {
      // TODO(DB 연동 후): router.push 등 실제 라우팅 추가
      console.log('추천 실행:', recommendation)
    }}
  >
    {recommendation.label}
  </button>
</div>
```

> `HubHero.tsx` 기존 JSX 구조를 먼저 파악한 뒤, 위 패턴을 기존 구조에 맞게 통합. 기존 레이아웃 깨지지 않도록 주의.

### 단계 A 보고

```markdown
### 단계 A 완료
- src/lib/recommend/types.ts 생성
- src/lib/recommend/next-action.mock.ts 생성 (P1~P4 우선순위 로직)
- src/components/home/HubHero.tsx 수정 — Today CTA에 추천 결과 바인딩
- 브라우저에서 Hub 진입 시 '오늘 5개를 다시 만나보세요' 표시 확인
다음: 단계 C (WordVault + MemoryBadge 통합) 진행할까요?
```

---

## 5. 단계 C — WordVault + MemoryBadge 통합

### 목표
신규 단어(`handoff.ts` 경유)는 `srs` 필드를 자동으로 가짐.
`WordRow`에 `MemoryBadge` 통합 — 단어 옆에 4색 점 표시.

### 3-A. WordItem 타입 확장

`src/components/wordvault/types.ts` 수정:

```typescript
// 기존 import 아래에 추가
import type { SrsCard } from '@/lib/srs'

// WordItem 인터페이스에 필드 추가
export interface WordItem {
  // ...기존 필드 모두 유지 (mastery, lastDays, nextDays 삭제 X)...

  /**
   * §17 v2.0 SRS 필드 — FSRS 호환 (D/S/R)
   * undefined = 'new' 취급 (시드 데이터 또는 DB 미연동 단어)
   * DB 연동 후: vocabularies row에서 rowToCard()로 채움
   */
  srs?: SrsCard
}
```

### 3-B. handoff.ts 확장 — 신규 단어에 srs 자동 부여

`src/lib/text-viewer/handoff.ts` 수정:

```typescript
// 기존 import 아래에 추가
import { createNewCard } from '@/lib/srs'
```

`toWordItem` 함수에서 신규 단어 생성 시 `srs` 필드 추가:

```typescript
// toWordItem 함수 내부 — return 직전에 srs 추가
// 기존 return 패턴을 찾아서 srs 필드를 추가
// 예시 (기존 코드 구조를 먼저 확인 후 정합하게 수정):
return {
  ...기존필드,
  srs: createNewCard(String(word.id)),  // 신규 단어는 항상 'new' 상태로 시작
}
```

> **주의**: `handoff.ts`의 실제 코드 구조를 먼저 `cat src/lib/text-viewer/handoff.ts`로 확인한 뒤 정합하게 수정. 기존 로직은 건드리지 않고 `srs` 필드만 추가.

### 3-C. WordRow에 MemoryBadge 통합

`src/components/wordvault/WordRow.tsx` 수정:

```typescript
// import 추가
import { MemoryBadge } from '@/components/ui/MemoryBadge'
```

단어 행 내부 — 단어 텍스트 옆(또는 행 끝)에 배지 추가:

```tsx
{/* 기존 단어 텍스트 영역 — 정확한 위치는 기존 JSX 확인 후 결정 */}
<div className="flex items-center gap-1.5">
  <MemoryBadge srs={word.srs} size="sm" />
  {/* 기존 단어 UI */}
</div>
```

### 3-D. mock-data 일부에 srs 추가 (개발 확인용)

`src/components/wordvault/mock-data.ts` — MOCK_WORDS 처음 3개에만 srs 추가:

```typescript
// 기존 import 아래
import { createNewCard, applyReview, Rating } from '@/lib/srs'

// 단어 1: stable (며칠 전 Good 평가)
const card1 = applyReview({
  card: createNewCard('mock-1'),
  rating: Rating.Easy,
  reviewedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1일 전
  module: 'flashcard',
}).card

// 단어 2: shaky
const card2 = applyReview({
  card: createNewCard('mock-2'),
  rating: Rating.Hard,
  reviewedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5일 전
  module: 'flashcard',
}).card

// 단어 3: new (srs 없음 — 기본값)

// MOCK_WORDS 배열에서 처음 2개에 srs 추가:
// { ...기존단어1, srs: card1 },
// { ...기존단어2, srs: card2 },
// 나머지는 그대로 (srs: undefined → 'new' 색)
```

### 단계 C 보고

```markdown
### 단계 C 완료
- src/components/wordvault/types.ts — WordItem에 srs?: SrsCard 추가
- src/lib/text-viewer/handoff.ts — toWordItem에 createNewCard 호출 추가
- src/components/wordvault/WordRow.tsx — MemoryBadge 통합
- src/components/wordvault/mock-data.ts — 처음 2개에 stable/shaky srs 추가
- 브라우저에서 WordVault 진입 시 첫 2개 단어에 색 점 표시 확인
다음: 단계 B (FlashcardSession applyReview 통합) 진행할까요?
```

---

## 6. 단계 B — FlashcardSession에 applyReview 통합

### 목표
`FlashcardSession.tsx` 라인 121~123의 `handleSRSRating`에 `applyReview` 호출 추가.
결과는 sessionStorage에 임시 저장 — DB 연동 후 Supabase 쿼리로 교체.

### 4-A. SRSRating → Vocaflow Rating 변환

`FlashcardSession.tsx`에 추가:

```typescript
// import 추가
import { applyReview, Rating } from '@/lib/srs'
import type { SrsCard } from '@/lib/srs'
import { cardToUpdatePayload } from '@/lib/srs/supabase-adapter'

// SRSRating('again'|'hard'|'good'|'easy') → Vocaflow Rating(1~4) 변환
// CLAUDE.md §17.4 FSRS 4단계 1:1 매핑
function toVocaflowRating(srsRating: SRSRating): typeof Rating[keyof typeof Rating] {
  switch (srsRating) {
    case 'again': return Rating.Again  // 1
    case 'hard':  return Rating.Hard   // 2
    case 'good':  return Rating.Good   // 3
    case 'easy':  return Rating.Easy   // 4
  }
}
```

### 4-B. handleSRSRating 수정

기존 라인 121~123:

```typescript
const handleSRSRating = (rating: SRSRating) => {
  setSwipeDirection(rating === 'again' || rating === 'hard' ? 'left' : 'right')
  submitRating(rating)
}
```

수정 후:

```typescript
const handleSRSRating = (rating: SRSRating) => {
  setSwipeDirection(rating === 'again' || rating === 'hard' ? 'left' : 'right')

  // §17 [4] 기억 축 — FSRS applyReview
  // currentCard는 FlashcardSession이 현재 보여주는 단어의 SrsCard
  // 실제 card 소스는 컴포넌트 구조에 따라 조정 (아래 주석 참조)
  if (currentCard?.srs) {
    const result = applyReview({
      card: currentCard.srs,
      rating: toVocaflowRating(rating),
      reviewedAt: new Date(),
      module: 'flashcard',
    })

    // DB 연동 전: sessionStorage에 임시 저장
    // DB 연동 후: supabase.from('vocabularies').update(cardToUpdatePayload(result.card))
    //             supabase.from('learning_records').insert(resultToRecordPayload(result, userId))
    const pending = JSON.parse(sessionStorage.getItem('srs_pending') ?? '[]')
    pending.push({
      cardId: result.card.id,
      payload: cardToUpdatePayload(result.card),
      rating: result.log.rating,
      reviewedAt: result.log.reviewedAt.toISOString(),
    })
    sessionStorage.setItem('srs_pending', JSON.stringify(pending))
  }

  submitRating(rating)
}
```

> **currentCard 소스 확인 필수**: `FlashcardSession.tsx`의 전체 구조를 먼저 읽어 현재 단어 데이터가 어디서 오는지 확인. `words` 배열에서 인덱스로 접근하는 패턴이면 `words[currentIndex]`를 사용. `srs` 필드가 없으면 `if (currentCard?.srs)` 조건이 false가 되어 기존 동작은 그대로 유지됨 (안전).

### 4-C. sessionStorage 헬퍼 (선택)

`src/lib/srs/session-storage.ts` 신규 생성:

```typescript
// src/lib/srs/session-storage.ts
// SRS 평가 결과 임시 저장 — DB 연동 전 브리지
// DB 연동 후: flush 함수를 실제 Supabase 쿼리로 교체

export interface PendingSrsResult {
  cardId: string
  payload: Record<string, unknown>
  rating: number
  reviewedAt: string
}

const KEY = 'srs_pending'

export function pushPendingResult(item: PendingSrsResult): void {
  const existing = getPendingResults()
  existing.push(item)
  sessionStorage.setItem(KEY, JSON.stringify(existing))
}

export function getPendingResults(): PendingSrsResult[] {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

export function clearPendingResults(): void {
  sessionStorage.removeItem(KEY)
}
```

### 단계 B 보고

```markdown
### 단계 B 완료
- src/components/flashcard/FlashcardSession.tsx — applyReview 통합
- src/lib/srs/session-storage.ts — 임시 저장 헬퍼 생성
- Flashcard 게임에서 단어 평가 후 sessionStorage에 SRS 결과 저장 확인
  (브라우저 DevTools → Application → Session Storage → srs_pending)
- 기존 submitRating 동작 그대로 유지 확인

### 전체 완료
- D: MemoryBadge 컴포넌트 ✓
- A: Hub Today CTA mock 추천 ✓
- C: WordVault srs 통합 + 4색 배지 ✓
- B: Flashcard applyReview 통합 ✓

학습 사이클 1바퀴: 단어 등록(handoff) → 새 단어(new) → Flashcard 평가(applyReview) → SRS 결과 저장
```

---

## 7. 전체 자가 점검

단계 B까지 완료 후 다음을 확인:

- [ ] `getMemoryState(srs)` 호출 시 DB 쿼리 없이 동작
- [ ] `MemoryBadge`의 라벨이 격려형 (`'다시 만나봐요'`, 정확도 숫자 X)
- [ ] `applyReview` 결과에서 `D/S/R` 값이 사용자 UI에 노출 X
- [ ] Hub Today CTA 영역이 정확히 1개 존재 (4곳 이상 추천 금지)
- [ ] `StudyMode.tsx`는 건드리지 않음
- [ ] `ForgettingCurve.tsx`는 건드리지 않음 (빈 파일 유지)
- [ ] sessionStorage의 `srs_pending` 키에 평가 결과 누적 확인
- [ ] `MOCK_WORDS` 나머지 단어들은 `srs: undefined` → MemoryBadge 'new' 색

---

## 8. 막혔을 때

| 상황 | 대응 |
|------|------|
| `handoff.ts`의 `toWordItem` 함수 구조가 예상과 다름 | `cat src/lib/text-viewer/handoff.ts` 먼저 읽고 실제 구조에 맞게 통합. 기존 로직은 건드리지 않고 `srs` 필드만 추가. |
| `FlashcardSession`에서 `currentCard` 소스를 못 찾음 | 파일 전체 읽기 후 단어 데이터 흐름 파악. `srs` 필드가 없으면 `if (currentCard?.srs)` 조건이 false → 기존 동작 유지 (무해함). |
| `MemoryBadge` import 오류 | `@/lib/srs`가 `src/lib/srs/index.ts`를 가리키는지 `tsconfig.json`의 `paths` 확인. |
| CSS 변수가 다크모드에서 안 보임 | `globals.css`에서 `[data-theme="dark"]` 안에도 4색 변수가 정의됐는지 확인. 없으면 추가. |
| `StudyMode.tsx`의 5단계 평가와 충돌 | StudyMode는 이번 범위 밖. 건드리지 않음. CLAUDE.md에 아래 메모 추가만: `<!-- §17 미정: StudyMode 5단계 → FSRS 4단계 마이그레이션 필요 -->` |

---

이 지시문을 끝까지 읽었다면, **단계 D**부터 시작하세요.
