# Vocaflow L4b/c/d 모듈 SRS 연동 지시문 v6

> CLAUDE.md v06.9 §17 학습 모델 v3.0의 L4b(SpellForge) · L4c(Dictation) · L4d(ScriptQuiz)에 SRS 엔진을 통합합니다.
> L4a(Flashcard)는 v4 지시문에서 이미 완료. 이번에 나머지 3개를 마저 연동.
> DB 없이 sessionStorage 임시 저장 패턴 그대로 확장.

---

## 0. 역할 및 규칙

- **SSoT**: 워크스페이스 루트 `CLAUDE.md v06.9` (특히 §17.1 9계층 구조)
- 응답 언어: **한국어** / 코드 주석: **영문**
- 결론 먼저, 근거는 그 다음
- 절대 금지: TODO · placeholder · 미완성 코드
- 색상 하드코딩 금지 (CSS 변수만)
- 매 단계 끝 → 사용자 승인 후 다음 단계

---

## 1. 워크스페이스 확정 사실 (사전 정찰 완료)

```
apps/web/src/
├── components/
│   ├── spellforge/
│   │   └── SpellForge.tsx              ← 라인 120, 209: recordRating() 호출
│   ├── dictation/
│   │   ├── DictationSessionClient.tsx
│   │   └── DictationResultsClient.tsx  ← session.items[].result.accuracy
│   └── game/scriptquiz/
│       └── ScriptQuiz.tsx              ← 라인 117: screen='result' 전환
└── lib/srs/
    ├── session-storage.ts              ← v4에서 생성 (pushPendingResult)
    └── ...
```

### 발견된 모듈별 평가 패턴

| 모듈 | 평가 단위 | 결과 형태 | 통합 위치 |
|------|---------|---------|---------|
| SpellForge | 단어 1개씩 즉시 | `recordRating({ wordId, hintsUsed, finalCorrect, ... })` | 라인 120, 209 |
| Dictation | 세션 일괄 | `session.items[].result.accuracy (0~100)` | DictationResultsClient useEffect |
| ScriptQuiz | 게임 일괄 | `answers[].isCorrect` (questionId 단위) | screen='result' 전환 시 |

### 핵심 차이점

- **SpellForge**: 단어 단위 → SRS와 1:1 매핑 깔끔
- **Dictation**: 문장 단위지만 문장 안 단어들의 정답률 추출 필요
- **ScriptQuiz**: 문제 단위지만 문제 안 정답 단어가 무엇인지 매핑 필요

---

## 2. 공통 유틸 — accuracy → FSRS Rating 변환

### 단계 0 — 변환 함수 추가

`src/lib/srs/rating-mapper.ts` 신규 생성:

```typescript
// src/lib/srs/rating-mapper.ts
// CLAUDE.md §17.4 — accuracy 기반 FSRS Rating 변환 규칙
// L4a(Flashcard)는 사용자 자가판정, L4b/c/d는 시스템 자동 판정

import { Rating } from './index'
import type { RatingValue } from './index'

/**
 * Accuracy(0~100) → FSRS Rating
 * 한국 학습자 target_retention 0.85 기준
 */
export function accuracyToRating(accuracy: number): RatingValue {
  if (accuracy >= 90) return Rating.Easy   // 4
  if (accuracy >= 70) return Rating.Good   // 3
  if (accuracy >= 50) return Rating.Hard   // 2
  return Rating.Again                       // 1
}

/**
 * SpellForge 결과 → FSRS Rating
 * - 정답 + 힌트 0개 → Easy
 * - 정답 + 힌트 1개 → Good
 * - 정답 + 힌트 2~3개 → Hard
 * - 오답 (skipped 또는 errors 다수) → Again
 */
export function spellforgeResultToRating(input: {
  finalCorrect: boolean
  hintsUsed: number
  errors: number
}): RatingValue {
  if (!input.finalCorrect) return Rating.Again
  if (input.hintsUsed === 0 && input.errors === 0) return Rating.Easy
  if (input.hintsUsed <= 1 && input.errors <= 1) return Rating.Good
  return Rating.Hard
}

/**
 * ScriptQuiz 단어별 정답 여부 → FSRS Rating
 * 시간이 빨랐는지 추가 가중 (timeMs / QUESTION_TIME_LIMIT_MS)
 */
export function scriptquizResultToRating(input: {
  isCorrect: boolean
  timeMs: number
  timeLimitMs: number
}): RatingValue {
  if (!input.isCorrect) return Rating.Again
  const timeRatio = input.timeMs / input.timeLimitMs
  if (timeRatio < 0.3) return Rating.Easy   // 매우 빨랐음
  if (timeRatio < 0.7) return Rating.Good
  return Rating.Hard                         // 시간 거의 다 씀
}
```

테스트 추가 — `src/lib/srs/__tests__/rating-mapper.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  accuracyToRating,
  spellforgeResultToRating,
  scriptquizResultToRating,
} from '../rating-mapper'
import { Rating } from '../index'

describe('accuracyToRating', () => {
  it('≥90 → Easy', () => {
    expect(accuracyToRating(95)).toBe(Rating.Easy)
    expect(accuracyToRating(90)).toBe(Rating.Easy)
  })
  it('70~89 → Good', () => {
    expect(accuracyToRating(85)).toBe(Rating.Good)
    expect(accuracyToRating(70)).toBe(Rating.Good)
  })
  it('50~69 → Hard', () => {
    expect(accuracyToRating(60)).toBe(Rating.Hard)
    expect(accuracyToRating(50)).toBe(Rating.Hard)
  })
  it('<50 → Again', () => {
    expect(accuracyToRating(40)).toBe(Rating.Again)
    expect(accuracyToRating(0)).toBe(Rating.Again)
  })
})

describe('spellforgeResultToRating', () => {
  it('정답 + 힌트 0개 + 오류 0개 → Easy', () => {
    expect(spellforgeResultToRating({ finalCorrect: true, hintsUsed: 0, errors: 0 }))
      .toBe(Rating.Easy)
  })
  it('정답 + 힌트 1개 → Good', () => {
    expect(spellforgeResultToRating({ finalCorrect: true, hintsUsed: 1, errors: 0 }))
      .toBe(Rating.Good)
  })
  it('정답 + 힌트 2개 → Hard', () => {
    expect(spellforgeResultToRating({ finalCorrect: true, hintsUsed: 2, errors: 0 }))
      .toBe(Rating.Hard)
  })
  it('오답 → Again', () => {
    expect(spellforgeResultToRating({ finalCorrect: false, hintsUsed: 0, errors: 2 }))
      .toBe(Rating.Again)
  })
})

describe('scriptquizResultToRating', () => {
  it('정답 + 빠른 응답(<30%) → Easy', () => {
    expect(scriptquizResultToRating({ isCorrect: true, timeMs: 2000, timeLimitMs: 10000 }))
      .toBe(Rating.Easy)
  })
  it('정답 + 보통 응답 → Good', () => {
    expect(scriptquizResultToRating({ isCorrect: true, timeMs: 5000, timeLimitMs: 10000 }))
      .toBe(Rating.Good)
  })
  it('정답 + 느린 응답 → Hard', () => {
    expect(scriptquizResultToRating({ isCorrect: true, timeMs: 8000, timeLimitMs: 10000 }))
      .toBe(Rating.Hard)
  })
  it('오답 → Again', () => {
    expect(scriptquizResultToRating({ isCorrect: false, timeMs: 5000, timeLimitMs: 10000 }))
      .toBe(Rating.Again)
  })
})
```

### 단계 0 검증

```bash
cd apps/web
npx tsc --noEmit
npx vitest run src/lib/srs
```

기대: TSC 0 errors + 약 60 tests passed (기존 47 + rating-mapper 13)

---

## 3. 단계 1 — L4b SpellForge 통합

### 1-A. SpellForge.tsx 수정

`src/components/spellforge/SpellForge.tsx`를 수정:

#### import 추가 (파일 상단)

```typescript
import { applyReview, createNewCard } from '@/lib/srs'
import { spellforgeResultToRating } from '@/lib/srs/rating-mapper'
import { cardToUpdatePayload } from '@/lib/srs/supabase-adapter'
import { pushPendingResult, getCachedCard, cacheCard } from '@/lib/srs/session-storage'
```

#### handleSuccess 함수 수정 (라인 112~135)

기존 `recordRating({...})` 호출 직후에 SRS 통합 추가:

```typescript
const handleSuccess = useCallback(() => {
  if (!currentWord) return

  setPhase('success')

  // 발음 자동 재생
  setTimeout(() => playWordAudio(currentWord.text), 200)

  // §17 [4] 기억 축 — FSRS applyReview (L4b 시각 생성)
  // sessionStorage 기반 카드 캐시 사용 (DB 연동 전 임시)
  const wordIdStr = String(currentWord.id)
  const existingCard = getCachedCard(wordIdStr) ?? createNewCard(wordIdStr)

  const reviewResult = applyReview({
    card: existingCard,
    rating: spellforgeResultToRating({
      finalCorrect: true,
      hintsUsed: hintCount,
      errors: result?.errorPositions.length ?? 0,
    }),
    reviewedAt: new Date(),
    module: 'spellforge',
  })

  cacheCard(reviewResult.card)
  pushPendingResult({
    cardId: reviewResult.card.id,
    payload: cardToUpdatePayload(reviewResult.card),
    rating: reviewResult.log.rating,
    reviewedAt: reviewResult.log.reviewedAt.toISOString(),
  })

  // 기존 recordRating 호출 (UI 통계용 — 그대로 유지)
  recordRating({
    wordId: currentWord.id,
    attempts: 1,
    errors: result?.errorPositions.length ?? 0,
    hintsUsed: hintCount,
    finalCorrect: true,
    timeSpentMs: Date.now() - session.startedAt.getTime(),
  })

  // Micro-pause
  setTimeout(() => {
    const msg = SUCCESS_MESSAGES[Math.floor(Math.random() * SUCCESS_MESSAGES.length)]
    setPauseInfo(msg)
    setPhase('paused')
  }, 800)
}, [currentWord, hintCount, recordRating, result?.errorPositions.length, session.startedAt])
```

#### Skip(오답) 처리 — 라인 209 `recordRating` 호출도 동일 패턴

라인 200~225 영역의 `skipWord` 흐름을 확인하고, 동일하게 SRS 통합 추가. `finalCorrect: false`로 호출.

```typescript
// 기존 recordRating({...}) 직전
const wordIdStr = String(currentWord.id)
const existingCard = getCachedCard(wordIdStr) ?? createNewCard(wordIdStr)

const reviewResult = applyReview({
  card: existingCard,
  rating: spellforgeResultToRating({
    finalCorrect: false,
    hintsUsed: hintCount,
    errors: 0,
  }),
  reviewedAt: new Date(),
  module: 'spellforge',
})

cacheCard(reviewResult.card)
pushPendingResult({
  cardId: reviewResult.card.id,
  payload: cardToUpdatePayload(reviewResult.card),
  rating: reviewResult.log.rating,
  reviewedAt: reviewResult.log.reviewedAt.toISOString(),
})
```

### 1-B. session-storage.ts 확장

기존 `src/lib/srs/session-storage.ts`에 카드 캐시 함수 추가:

```typescript
// 기존 코드 아래에 추가
import type { SrsCard } from './index'

const CARD_CACHE_KEY = 'srs_card_cache'

export function getCachedCard(cardId: string): SrsCard | null {
  try {
    const cache = JSON.parse(sessionStorage.getItem(CARD_CACHE_KEY) ?? '{}') as Record<string, SrsCard>
    const cached = cache[cardId]
    if (!cached) return null
    // Date 복원
    return {
      ...cached,
      lastReviewAt: cached.lastReviewAt ? new Date(cached.lastReviewAt) : null,
      nextReviewAt: cached.nextReviewAt ? new Date(cached.nextReviewAt) : null,
    }
  } catch {
    return null
  }
}

export function cacheCard(card: SrsCard): void {
  try {
    const cache = JSON.parse(sessionStorage.getItem(CARD_CACHE_KEY) ?? '{}')
    cache[card.id] = card
    sessionStorage.setItem(CARD_CACHE_KEY, JSON.stringify(cache))
  } catch {
    // 무시
  }
}

export function clearCardCache(): void {
  sessionStorage.removeItem(CARD_CACHE_KEY)
}
```

### 1-C. 단계 1 검증

```bash
cd apps/web
npx tsc --noEmit
npm run dev
```

브라우저에서 SpellForge 게임 실행 → DevTools → Application → Session Storage 확인:
- `srs_pending`: 평가 결과 누적
- `srs_card_cache`: 카드별 stability/difficulty 갱신

### 1-D. 단계 1 보고

```markdown
### 단계 1 (L4b SpellForge) 완료
- src/lib/srs/rating-mapper.ts 신규 생성 (3개 변환 함수 + 13 tests)
- src/lib/srs/session-storage.ts 확장 (getCachedCard / cacheCard)
- src/components/spellforge/SpellForge.tsx 수정
  - handleSuccess: applyReview 통합 (정답)
  - skipWord 영역: applyReview 통합 (오답)
- TSC 0 errors, Vitest 60 tests passed
- 브라우저에서 SpellForge 플레이 후 sessionStorage에 결과 누적 확인

다음: 단계 2 (L4c Dictation) 진행할까요?
```

---

## 4. 단계 2 — L4c Dictation 통합

### 2-A. DictationResultsClient.tsx 수정

`src/components/dictation/DictationResultsClient.tsx`를 수정.

#### 전체 구조 파악

먼저 다음 명령으로 컴포넌트 구조 파악:

```bash
cat src/components/dictation/DictationResultsClient.tsx | head -50
```

기존 `useEffect`로 session 로드 + `useMemo`로 aggregateData 계산하는 패턴이 있음.

#### import 추가

```typescript
import { applyReview, createNewCard } from '@/lib/srs'
import { spellforgeResultToRating } from '@/lib/srs/rating-mapper'  // 재사용 — 패턴 동일
import { cardToUpdatePayload } from '@/lib/srs/supabase-adapter'
import { pushPendingResult, getCachedCard, cacheCard } from '@/lib/srs/session-storage'
```

#### useEffect 추가 — session 로드 직후 SRS 처리

`useMemo(() => aggregateData, ...)` 다음에 새 `useEffect` 추가:

```typescript
// §17 [4] 기억 축 — Dictation 세션 종료 시 SRS 일괄 적용 (L4c 청각 생성)
// 한 번만 실행되도록 ref로 가드
const srsAppliedRef = useRef(false)

useEffect(() => {
  if (!session || srsAppliedRef.current) return
  srsAppliedRef.current = true

  // 각 item(문장)의 wordResults에서 단어별 정답 여부 집계
  const wordAccuracyMap = new Map<string, { correct: number; total: number }>()

  for (const item of session.items) {
    const wordResults = item.result?.wordResults ?? []
    for (const wr of wordResults) {
      // wordResults의 wordId 또는 word 텍스트를 키로 사용
      // 실제 타입은 lib/dictation/types.ts 확인 필요
      const key = (wr as any).wordId ?? (wr as any).word
      if (!key) continue
      const stats = wordAccuracyMap.get(key) ?? { correct: 0, total: 0 }
      stats.total += 1
      if ((wr as any).isCorrect) stats.correct += 1
      wordAccuracyMap.set(key, stats)
    }
  }

  // 각 단어에 대해 applyReview 호출
  for (const [wordId, { correct, total }] of wordAccuracyMap) {
    if (total === 0) continue
    const accuracy = (correct / total) * 100

    const existingCard = getCachedCard(wordId) ?? createNewCard(wordId)
    const result = applyReview({
      card: existingCard,
      rating: spellforgeResultToRating({
        finalCorrect: accuracy >= 50,
        hintsUsed: 0,
        errors: total - correct,
      }),
      reviewedAt: new Date(),
      module: 'dictation',
    })

    cacheCard(result.card)
    pushPendingResult({
      cardId: result.card.id,
      payload: cardToUpdatePayload(result.card),
      rating: result.log.rating,
      reviewedAt: result.log.reviewedAt.toISOString(),
    })
  }
}, [session])
```

> **중요**: `lib/dictation/types.ts`의 `WordResult` 타입을 먼저 확인하고, 위 코드의 `wordId`, `isCorrect` 필드명이 실제와 일치하는지 검증할 것. 일치하지 않으면 실제 필드명으로 교체.

```bash
# 먼저 실행할 것
cat src/lib/dictation/types.ts | grep -A 10 "WordResult"
```

타입 확인 후 위 코드의 `(wr as any).wordId`, `(wr as any).isCorrect`를 정확한 필드명으로 교체. 가능하면 `as any` 제거하고 정식 타입 사용.

### 2-B. 단계 2 검증

```bash
cd apps/web
npx tsc --noEmit
npm run dev
```

브라우저에서 Dictation 세션 완료 → 결과 화면 진입 → DevTools에서 `srs_pending` 확인.
세션의 단어 수만큼 결과가 추가되어야 함.

### 2-C. 단계 2 보고

```markdown
### 단계 2 (L4c Dictation) 완료
- src/components/dictation/DictationResultsClient.tsx 수정
  - 결과 화면 진입 시 wordResults 집계 → applyReview 일괄 호출
  - srsAppliedRef로 중복 호출 방지
- WordResult 타입 검증 완료 (필드명: ___, ___)
- 브라우저에서 Dictation 완료 후 sessionStorage에 N개 결과 누적 확인

다음: 단계 3 (L4d ScriptQuiz) 진행할까요?
```

---

## 5. 단계 3 — L4d ScriptQuiz 통합

### 3-A. ScriptQuiz.tsx 수정

`src/components/game/scriptquiz/ScriptQuiz.tsx`를 수정.

#### 사전 확인

ScriptQuiz의 `currentQ`(Question) 타입에 단어 정보가 있는지 확인:

```bash
grep -n "interface.*Question\|type.*Question\|correctIndex\|wordId" src/components/game/scriptquiz/ScriptQuiz.tsx | head -10
grep -rn "interface.*Question\|type.*Question" src/lib/scriptquiz/ src/types/scriptquiz* 2>/dev/null | head -5
```

ScriptQuiz는 단어 단위가 아니라 문제 단위이므로, 각 문제가 어떤 단어를 검증하는지 매핑이 필요.

**가정 1**: Question에 `wordId`나 `targetWord` 필드가 있음 → 그것 사용
**가정 2**: 그런 필드가 없음 → ScriptQuiz는 텍스트 단위 검증으로 처리. 단어별 SRS 업데이트 X, 대신 textId의 모든 단어에 일괄 약한 boost.

#### 가정 1 시나리오 — 단어 단위

#### import 추가

```typescript
import { applyReview, createNewCard } from '@/lib/srs'
import { scriptquizResultToRating } from '@/lib/srs/rating-mapper'
import { cardToUpdatePayload } from '@/lib/srs/supabase-adapter'
import { pushPendingResult, getCachedCard, cacheCard } from '@/lib/srs/session-storage'
```

#### handleAnswer 또는 result 화면 진입부 수정

라인 117 `setScreen('result')` 직전에 일괄 SRS 처리 추가:

```typescript
// §17 [4] 기억 축 — ScriptQuiz 종료 시 일괄 SRS 적용 (L4d 통합 검증)
function applySrsForCompletedQuiz() {
  for (const ans of answers) {
    // questions에서 questionId로 question 찾기
    const q = questions.find((qq) => qq.id === ans.questionId)
    if (!q) continue
    // wordId 추출 — Question 타입에 따라 다름 (위 사전 확인 결과 적용)
    const wordId = (q as any).wordId ?? (q as any).targetWordId
    if (!wordId) continue

    const existingCard = getCachedCard(String(wordId)) ?? createNewCard(String(wordId))
    const result = applyReview({
      card: existingCard,
      rating: scriptquizResultToRating({
        isCorrect: ans.isCorrect,
        timeMs: ans.timeMs,
        timeLimitMs: QUESTION_TIME_LIMIT * 1000,
      }),
      reviewedAt: new Date(),
      module: 'scriptquiz',
    })

    cacheCard(result.card)
    pushPendingResult({
      cardId: result.card.id,
      payload: cardToUpdatePayload(result.card),
      rating: result.log.rating,
      reviewedAt: result.log.reviewedAt.toISOString(),
    })
  }
}
```

result 화면 진입 직전 호출:

```typescript
setTimeout(() => {
  setFeedback(null)
  setTimeout(() => {
    if (currentIdx + 1 >= totalQ) {
      applySrsForCompletedQuiz()  // ← 추가
      setScreen('result')
    } else {
      // ...
    }
  }, 200)
}, FEEDBACK_DURATION)
```

#### 가정 2 시나리오 — Question에 wordId 없음

ScriptQuiz는 텍스트 정복 판정으로 사용. 단어별 SRS 업데이트는 하지 않고, 결과만 별도 키로 저장:

```typescript
// L4d 텍스트 단위 정복 기록
import { pushPendingTextResult } from '@/lib/srs/session-storage'

// applySrsForCompletedQuiz 대체
function recordQuizCompletion() {
  pushPendingTextResult({
    textId,
    accuracy: stats.accuracy,
    completedAt: new Date().toISOString(),
  })
}
```

이 경우 `session-storage.ts`에 추가:

```typescript
export interface PendingTextResult {
  textId: string
  accuracy: number
  completedAt: string
}

const TEXT_KEY = 'srs_text_pending'

export function pushPendingTextResult(item: PendingTextResult): void {
  const existing = getPendingTextResults()
  existing.push(item)
  sessionStorage.setItem(TEXT_KEY, JSON.stringify(existing))
}

export function getPendingTextResults(): PendingTextResult[] {
  try {
    return JSON.parse(sessionStorage.getItem(TEXT_KEY) ?? '[]')
  } catch {
    return []
  }
}
```

### 3-B. 단계 3 검증

```bash
cd apps/web
npx tsc --noEmit
npm run dev
```

브라우저에서 ScriptQuiz 완주 → 결과 화면 → DevTools에서 `srs_pending` 또는 `srs_text_pending` 확인.

### 3-C. 단계 3 보고

```markdown
### 단계 3 (L4d ScriptQuiz) 완료
- Question 타입에 wordId [있음/없음] 확인
- src/components/game/scriptquiz/ScriptQuiz.tsx 수정
  - applySrsForCompletedQuiz 또는 recordQuizCompletion 함수 추가
  - result 화면 전환 직전 호출
- (가정 2일 경우) session-storage.ts에 pushPendingTextResult 추가

### 전체 작업 완료 — L4 4단계 모두 SRS 연동
- L4a Flashcard ✓ (v4 지시문)
- L4b SpellForge ✓ (단계 1)
- L4c Dictation ✓ (단계 2)
- L4d ScriptQuiz ✓ (단계 3)

학습 사이클 1바퀴 완성:
WordVault(L3) → 5종 게임(L4a~d) → SRS 갱신 → Hub(L5) Today CTA
```

---

## 6. 자가 점검 체크리스트

단계 3까지 완료 후 다음을 확인:

- [ ] L4a/b/c/d 모든 모듈에서 `applyReview` 호출됨
- [ ] 모듈별 module_history 정확히 기록됨 (flashcard / spellforge / dictation / scriptquiz)
- [ ] sessionStorage `srs_card_cache`에 카드 stability/difficulty 누적됨
- [ ] sessionStorage `srs_pending`에 평가 로그 누적됨
- [ ] 같은 단어를 여러 모듈에서 학습 시 카드가 정확히 갱신됨 (덮어쓰기 X)
- [ ] FSRS 변수(D/S/R)가 사용자 가시 영역에 노출 X (§17 안티패턴 2)
- [ ] 기존 게임 UI/UX 변경 없음 (SRS 통합은 백그라운드)
- [ ] StudyMode(WordVault)는 손대지 않음 (§17 격리)

---

## 7. 막혔을 때

| 상황 | 대응 |
|------|------|
| `WordResult` 타입 필드명이 다름 | `cat src/lib/dictation/types.ts`로 확인 → 정확한 필드명으로 교체 |
| ScriptQuiz Question에 wordId 없음 | 가정 2 시나리오로 진행 (텍스트 단위 기록) |
| `useRef` 가드가 작동하지 않음 | StrictMode에서 useEffect 2회 실행되는 정상 동작. ref 가드로 충분 |
| sessionStorage가 일관성 깨짐 | `clearPendingResults()` + `clearCardCache()` 호출 후 재시도 |
| 모듈 enum에 'spellforge' 없다는 TS 에러 | `src/lib/srs/types.ts`의 `ModuleId` 타입 확인 — 이미 8개 모듈 모두 포함되어 있어야 정상 |

---

## 8. 다음 작업 (참고용 — 본 지시문 범위 밖)

본 지시문 3단계가 끝나면, 학습 사이클 1바퀴가 완성됩니다. 다음 단계는:

1. **DB 설계** — sessionStorage → Supabase 교체 준비
2. **추천 엔진 실제 버전** — `next-action.mock.ts` → `next-action.ts`
3. **mock → 실제 쿼리 교체** (4곳)
4. **CLAUDE.md DB 스키마 섹션** v06.9 정합 확인

이 부분은 별도 지시문(v7)으로 진행 권장.

---

이 지시문을 끝까지 읽었다면, **단계 0 (rating-mapper)** 부터 시작하세요.
