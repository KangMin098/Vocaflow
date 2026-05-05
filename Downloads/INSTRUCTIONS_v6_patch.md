# Vocaflow L4b/c/d 통합 — v6 패치 지시문

> v6 지시문에 두 가지 시그니처 오류가 있었습니다. 이 패치를 v6과 함께 사용하세요.
> v6 단계 0(rating-mapper)은 그대로 진행 가능 — 본 패치는 단계 1 진입 직전에 적용.

---

## 패치 적용 시점

```
v6 단계 0 (rating-mapper.ts + 13 tests) 완료 ←  여기까지는 v6 그대로
    ↓
[ 본 패치 적용 — v6 단계 1-B 보강 ]
    ↓
v6 단계 1 (SpellForge 통합) ← 본 패치의 시그니처로
v6 단계 2 (Dictation 통합) ← 본 패치의 시그니처로
v6 단계 3 (ScriptQuiz 통합) ← 본 패치의 시그니처로
```

---

## 패치 1 — session-storage.ts에 카드 캐시 함수 추가

`src/lib/srs/session-storage.ts` 끝에 다음 코드를 추가합니다. 기존 `pushPendingResult` 등은 건드리지 않습니다.

```typescript
// ─────────────────────────────────────────────────────
// Card cache — 모듈 간 SRS stability 누적용
// 같은 단어를 Flashcard → SpellForge → Dictation 순으로 학습할 때
// 매번 신규 카드로 시작하면 stability가 초기화됨. 이 캐시가 모듈 간 다리 역할.
// DB 연동 후엔 supabase.from('vocabularies').select() 결과로 대체.
// ─────────────────────────────────────────────────────

/**
 * 캐시된 카드 1건 조회 — 없으면 null
 * 호출자는 null이면 createNewCard() 사용
 */
export function getCachedCard(cardId: string): SrsCard | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(CARD_CACHE_KEY)
    if (!raw) return null
    const cache = JSON.parse(raw) as Record<string, SrsCard>
    const cached = cache[cardId]
    if (!cached) return null
    // Date 복원 — JSON.parse는 Date를 string으로 변환하므로
    return {
      ...cached,
      lastReviewAt: cached.lastReviewAt ? new Date(cached.lastReviewAt) : null,
      nextReviewAt: cached.nextReviewAt ? new Date(cached.nextReviewAt) : null,
    }
  } catch {
    return null
  }
}

/**
 * 카드 1건 캐시 — applyReview 결과를 다음 모듈에서 이어 사용 가능
 */
export function cacheCard(card: SrsCard): void {
  if (typeof window === 'undefined') return
  try {
    const raw = sessionStorage.getItem(CARD_CACHE_KEY)
    const cache = raw ? (JSON.parse(raw) as Record<string, SrsCard>) : {}
    cache[card.id] = card
    sessionStorage.setItem(CARD_CACHE_KEY, JSON.stringify(cache))
  } catch {
    // quota 초과 등 — 학습 흐름은 유지, 캐시만 누락
  }
}

/**
 * 카드 캐시 전체 초기화 — 디버깅 또는 사용자 로그아웃 시
 */
export function clearCardCache(): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(CARD_CACHE_KEY)
}
```

### 검증

```bash
cd apps/web
npx tsc --noEmit
```

기대: TSC 0 errors. 신규 함수 3개가 export 되었는지 확인:

```bash
grep -n "export function" src/lib/srs/session-storage.ts
```

기대 출력 — 6개 함수:
- `pushPendingResult` (기존)
- `getPendingResults` (기존)
- `clearPendingResults` (기존)
- `getCachedCard` ← 신규
- `cacheCard` ← 신규
- `clearCardCache` ← 신규

---

## 패치 2 — v6 지시문의 모든 `pushPendingResult` 호출 패턴 교정

v6 지시문에 다음과 같은 패턴이 여러 번 나옵니다 (단계 1, 2, 3 모두):

```typescript
// ❌ v6 지시문 — 잘못됨
pushPendingResult({
  cardId: result.card.id,
  payload: cardToUpdatePayload(result.card),     // ← 'payload' 키
  rating: result.log.rating,
  reviewedAt: result.log.reviewedAt.toISOString(),
})
```

### 정정된 패턴 — 항상 이 시그니처 사용

```typescript
// ✅ 실제 코드 정합
pushPendingResult({
  cardId: result.card.id,
  cardUpdate: cardToUpdatePayload(result.card),  // ← 'cardUpdate' 키
  rating: result.log.rating,
  reviewedAt: result.log.reviewedAt.toISOString(),
  module: result.log.module,                      // ← 필수 필드
})
```

### 변경 규칙 — v6 지시문 안의 모든 통합 코드에 적용

| v6 지시문 | 실제 사용 |
|----------|---------|
| `payload: cardToUpdatePayload(...)` | `cardUpdate: cardToUpdatePayload(...)` |
| (module 필드 없음) | `module: result.log.module` 추가 |

이 두 가지만 바꾸면 v6 단계 1, 2, 3 그대로 진행 가능.

---

## 패치 3 — 단계 1, 2, 3 정정된 통합 코드 (참조용)

복사해서 그대로 사용 가능합니다. v6 지시문의 해당 영역 대체.

### 단계 1 — SpellForge `handleSuccess` 정정 코드

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
    cardUpdate: cardToUpdatePayload(reviewResult.card),
    rating: reviewResult.log.rating,
    reviewedAt: reviewResult.log.reviewedAt.toISOString(),
    module: reviewResult.log.module,
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

### 단계 1 — SpellForge skipWord 영역 정정 코드

라인 209 근처의 두 번째 `recordRating` 호출 영역에 추가:

```typescript
// 기존 recordRating({...}) 호출 직전에 추가
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
  cardUpdate: cardToUpdatePayload(reviewResult.card),
  rating: reviewResult.log.rating,
  reviewedAt: reviewResult.log.reviewedAt.toISOString(),
  module: reviewResult.log.module,
})
```

### 단계 2 — Dictation useEffect 정정 코드

`DictationResultsClient.tsx`의 `useMemo(() => aggregateData, ...)` 다음에 추가:

```typescript
// §17 [4] 기억 축 — Dictation 세션 종료 시 SRS 일괄 적용 (L4c 청각 생성)
// useRef로 중복 호출 방지 (StrictMode 대응)
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
      // 실제 필드명은 src/lib/dictation/types.ts의 WordResult 인터페이스 확인 후 정합하게 사용
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
    const reviewResult = applyReview({
      card: existingCard,
      rating: spellforgeResultToRating({
        finalCorrect: accuracy >= 50,
        hintsUsed: 0,
        errors: total - correct,
      }),
      reviewedAt: new Date(),
      module: 'dictation',
    })

    cacheCard(reviewResult.card)
    pushPendingResult({
      cardId: reviewResult.card.id,
      cardUpdate: cardToUpdatePayload(reviewResult.card),
      rating: reviewResult.log.rating,
      reviewedAt: reviewResult.log.reviewedAt.toISOString(),
      module: reviewResult.log.module,
    })
  }
}, [session])
```

### 단계 3 — ScriptQuiz applySrsForCompletedQuiz 정정 코드 (가정 1: wordId 있음)

```typescript
function applySrsForCompletedQuiz() {
  for (const ans of answers) {
    const q = questions.find((qq) => qq.id === ans.questionId)
    if (!q) continue
    const wordId = (q as any).wordId ?? (q as any).targetWordId
    if (!wordId) continue

    const existingCard = getCachedCard(String(wordId)) ?? createNewCard(String(wordId))
    const reviewResult = applyReview({
      card: existingCard,
      rating: scriptquizResultToRating({
        isCorrect: ans.isCorrect,
        timeMs: ans.timeMs,
        timeLimitMs: QUESTION_TIME_LIMIT * 1000,
      }),
      reviewedAt: new Date(),
      module: 'scriptquiz',
    })

    cacheCard(reviewResult.card)
    pushPendingResult({
      cardId: reviewResult.card.id,
      cardUpdate: cardToUpdatePayload(reviewResult.card),
      rating: reviewResult.log.rating,
      reviewedAt: reviewResult.log.reviewedAt.toISOString(),
      module: reviewResult.log.module,
    })
  }
}
```

---

## 패치 4 — 검증 명령

각 단계 완료 후:

```bash
cd apps/web
npx tsc --noEmit
npx vitest run src/lib/srs
```

브라우저 sessionStorage 확인 (DevTools → Application → Session Storage):

| 키 | 들어있는 것 | 누가 채우는가 |
|---|------------|------------|
| `srs_pending` | 평가 로그 (PendingSrsResult[]) | 모든 모듈 |
| `srs_card_cache` | 카드 1건씩 (Record<id, SrsCard>) | 모든 모듈 |

같은 단어를 SpellForge → Dictation 순으로 학습 후 `srs_card_cache`에서 해당 단어의 `stability`가 두 번 갱신됐는지 확인.

---

## 보고 형식 (단계 1 예시)

```markdown
### 단계 1 (L4b SpellForge) 완료
- src/lib/srs/session-storage.ts 확장 (getCachedCard / cacheCard / clearCardCache 3 함수 추가)
- src/components/spellforge/SpellForge.tsx 수정
  - handleSuccess: applyReview 통합 (정답, hintsUsed/errors 반영)
  - skipWord 영역: applyReview 통합 (오답, Again rating)
- pushPendingResult 시그니처 정합 (cardUpdate + module 5필드)
- TSC 0 errors, Vitest 60 tests passed
- 브라우저 검증: srs_pending에 module='spellforge' 결과 누적, srs_card_cache 갱신 확인

다음: 단계 2 (L4c Dictation) 진행할까요?
```

---

## 향후 영향 — Flashcard 백워드 호환성 검토 (선택)

v4에서 만든 `FlashcardSession.tsx`는 카드 캐시를 사용하지 않습니다 (매번 새 카드). 이 때문에 사용자가 같은 단어를 Flashcard → SpellForge로 학습할 때 stability가 누적되지 않을 수 있습니다.

**개선 옵션 (권장)**: FlashcardSession의 통합 코드도 `getCachedCard` 패턴으로 업데이트.

기존 코드:
```typescript
const result = applyReview({
  card: existingCard,           // ← 어디서 왔는지 확인 필요
  rating: ...
})
```

개선 후:
```typescript
const wordIdStr = String(currentCard.id)
const existingCard = getCachedCard(wordIdStr) ?? currentCard.srs ?? createNewCard(wordIdStr)
const result = applyReview({ card: existingCard, ... })
cacheCard(result.card)  // ← 추가
pushPendingResult({ ..., module: result.log.module })  // module 필드 확인
```

이 개선은 v6 단계 1 시작 전에 해도 되고, 단계 3 후에 통합 점검으로 처리해도 됩니다. **사용자가 결정**.

---

## 막혔을 때

| 상황 | 대응 |
|------|------|
| TS 에러: `cardUpdate` 필드 없다 | 본 패치의 시그니처 다시 확인 — `cardUpdate`는 `Partial<VocabularyRow>` |
| TS 에러: `module` 필드 없다 | `result.log.module` 사용 — `result.log`는 `applyReview` 반환값의 한 필드 |
| getCachedCard import 안 됨 | 본 패치의 단계 1 (session-storage 확장) 먼저 완료 |
| v4 FlashcardSession이 깨짐 | 본 패치는 FlashcardSession을 건드리지 않음 — 기존 동작 유지. 깨졌다면 v4 시점부터 문제 있던 것 |

---

이 패치를 적용한 후 v6 단계 1부터 다시 시작하시면 됩니다.
