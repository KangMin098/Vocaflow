# Vocaflow 갈래 B 완성 — VS Code Claude Code 지시문 v7

> CLAUDE.md §17.3 추천 축 정합 완성.
> Hub Today CTA · FloatingSparkle · 세션 종료 후 — 정확히 3곳에서 mock 추천 노출.
> Hub와 Workspace는 이미 완료 — 결과 화면 4곳만 추가.

---

## 0. 역할 및 규칙

- **SSoT**: 워크스페이스 루트 `CLAUDE.md v06.9` (특히 §17.3 추천 축)
- 응답 언어: **한국어** / 코드 주석: **영문**
- 결론 먼저, 근거는 그 다음
- 절대 금지: TODO · placeholder · 미완성 코드
- 색상 하드코딩 금지 (CSS 변수만)
- 매 단계 끝 → 사용자 승인 후 다음 단계

---

## 1. 워크스페이스 확정 사실 (사전 정찰 완료)

### 이미 완료된 것

| 위치 | 상태 |
|------|------|
| **Hub Today CTA** | ✅ HubHero가 `recommendation` props 받아 `actionToHref(recommendation)` + Link로 라우팅 |
| **FloatingSparkle 컴포넌트** | ✅ `{ message, ctaLabel, ctaHref }` props 인터페이스로 풀 구현 |
| **Workspace에 마운트** | ✅ `src/app/(main)/text/[id]/page.tsx` 라인 439에서 사용 중 |
| **actionToHref 헬퍼** | ✅ 8개 모듈 모두 라우팅 매핑됨 (`next-action.mock.ts` 라인 末) |
| **getMockNextAction** | ✅ P1~P4 우선순위 로직 구현 완료 |
| **MOCK_USER_CONTEXTS** | ✅ cold/warm_urgent/warm_inprogress/hot 4개 시나리오 정의 |

### 본 지시문에서 할 일

| 위치 | 작업 |
|------|------|
| **Workspace FloatingSparkle** | 정적 message → mock 추천 데이터로 교체 |
| **Flashcard CompletionState** | "다음 추천" 영역 추가 |
| **SpellForge MicroPause(세션 마지막)** | 세션 종료 분기 + "다음 추천" 영역 추가 |
| **DictationResultsClient** | "다음 추천" 영역 추가 |
| **ScriptQuiz ResultScreen** | "다음 추천" 영역 추가 |

---

## 2. 단계 0 — 공통 NextActionCard 컴포넌트

`actionToHref`가 이미 모든 모듈 라우팅을 매핑하므로, 4개 결과 화면이 동일 추상화로 사용할 공통 컴포넌트를 먼저 만든다.

### 2-A. 컴포넌트 생성

`src/components/recommend/NextActionCard.tsx` 신규 생성:

```typescript
// src/components/recommend/NextActionCard.tsx
//
// 게임 세션 종료 후 다음 추천 노출 — CLAUDE.md §17.3 추천 축 (3곳 중 1곳)
// Hub Today CTA(Hero), FloatingSparkle(Workspace)와 동일한 RecommendedAction 사용.
//
// 안티패턴 회피:
// - 격려형 라벨만 (recommendation.label 그대로 표시)
// - 정확도/실패 카운트 노출 X
// - 자동 재출현 X (한 번만 표시, 사용자가 닫거나 클릭하면 끝)

'use client'

import { actionToHref } from '@/lib/recommend/next-action.mock'
import type { RecommendedAction } from '@/lib/recommend/types'
import { ArrowRight, Sparkles } from 'lucide-react'
import Link from 'next/link'

interface NextActionCardProps {
  /** §17.9 추천 엔진 결과 */
  recommendation: RecommendedAction
  /** 카드 위에 표시할 짧은 격려 메시지 (선택) */
  prelude?: string
}

export function NextActionCard({ recommendation, prelude }: NextActionCardProps) {
  const href = actionToHref(recommendation)

  return (
    <section
      className="rounded-[var(--r-lg)] border border-[rgba(59,130,246,0.2)] bg-gradient-to-br from-[var(--p-light)] to-[var(--bg2)] p-5"
      aria-label="다음 추천"
    >
      <div className="mb-3 flex items-center gap-2">
        <Sparkles size={14} strokeWidth={2} className="text-[var(--p)]" aria-hidden="true" />
        <span className="font-display text-[11px] font-[700] uppercase tracking-[0.10em] text-[var(--p)]">
          다음 추천
        </span>
      </div>

      {prelude && (
        <p className="mb-3 font-body text-[13px] text-[var(--t2)] leading-snug">
          {prelude}
        </p>
      )}

      <p className="mb-4 font-display text-[16px] font-[700] leading-snug text-[var(--t1)]">
        {recommendation.label}
      </p>

      <Link
        href={href}
        aria-label={recommendation.label}
        className="focus-visible:ring-[var(--p)]/40 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[var(--r-md)] bg-gradient-to-br from-[var(--p)] to-[var(--p-dark)] px-5 py-3 font-display text-[14px] font-[700] text-white no-underline shadow-[var(--sh-sm)] transition-all duration-[var(--dur-normal)] ease-[var(--ease-spring)] hover:scale-[1.01] hover:shadow-[var(--sh-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.99]"
      >
        <span>시작하기</span>
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </section>
  )
}
```

### 2-B. 검증

```bash
cd apps/web
npx tsc --noEmit
```

기대: 0 errors.

---

## 3. 단계 1 — Workspace FloatingSparkle 동적화

현재 `src/app/(main)/text/[id]/page.tsx` 라인 439~444:

```tsx
<FloatingSparkle
  message="이 페이지의 5개 새 단어를 카드로 다시 만나보면, 더 깊이 기억에 남을 거예요."
  ctaLabel="Flashcard 시작"
  ctaHref={`/text/${text.id}?mode=flashcard`}
/>
```

이걸 mock 추천 결과로 교체.

### 1-A. import 추가

```typescript
import {
  getMockNextAction,
  MOCK_USER_CONTEXTS,
  actionToHref,
} from '@/lib/recommend/next-action.mock'
```

### 1-B. 페이지 컴포넌트 본문 안에 추천 계산 추가

`<FloatingSparkle ... />` 호출 위쪽 어디든 (다른 const 선언 영역에) 추가:

```typescript
// §17.3 추천 축 (3곳 중 1곳: FloatingSparkle)
// Workspace 컨텍스트 — 현재 텍스트와 무관하게 P1~P4 결과 표시
// DB 연동 시: getMockNextAction → 실제 getNextAction(userId, { context: 'workspace', textId })
// MOCK_USER_CONTEXTS.warm_inprogress 사용 — 진행 중 텍스트가 있는 시나리오에 가장 자연스러움
const recommendation = getMockNextAction(MOCK_USER_CONTEXTS.warm_inprogress)
const recommendationHref = actionToHref(recommendation)
```

### 1-C. FloatingSparkle 호출부 교체

```tsx
<FloatingSparkle
  message={recommendation.label}
  ctaLabel="시작하기"
  ctaHref={recommendationHref}
/>
```

### 1-D. 검증

```bash
cd apps/web
npx tsc --noEmit
pnpm dev
```

브라우저에서 `/text/[id]` 진입 → 우하단 보라 Sparkle 버튼 클릭 → 카드에 mock 추천 라벨 표시되는지 확인.

### 1-E. 단계 1 보고

```markdown
### 단계 1 (Workspace FloatingSparkle 동적화) 완료
- src/app/(main)/text/[id]/page.tsx 수정
  - getMockNextAction + actionToHref import
  - recommendation 변수 추가 (MOCK_USER_CONTEXTS.warm_inprogress)
  - FloatingSparkle props를 정적 → 동적으로 교체
- TSC 0 errors
- 브라우저: Workspace에서 Sparkle 버튼 클릭 → mock 추천 표시 확인

다음: 단계 2 (Flashcard CompletionState 추천 추가) 진행할까요?
```

---

## 4. 단계 2 — Flashcard CompletionState 추천 추가

### 2-A. 사전 확인

CompletionState.tsx의 "다음 만남" 영역(라인 80 근처)이 이미 정적으로 존재. 이를 NextActionCard로 교체하거나, 그 옆에 추가.

```bash
# CompletionState 본문 전체 구조 확인
sed -n '20,150p' src/components/flashcard/CompletionState.tsx
```

`stats`, `textId`, `onRestart` props만 받고 있음. NextActionCard 사용을 위해 부모 페이지에서 `recommendation`을 주입받아야 함.

### 2-B. CompletionState props 확장

`src/components/flashcard/CompletionState.tsx` 수정:

```typescript
import type { RecommendedAction } from '@/lib/recommend/types'
import { NextActionCard } from '@/components/recommend/NextActionCard'

interface CompletionStateProps {
  stats: SessionStats
  textId: string
  onRestart: () => void
  /** §17.3 추천 축 (3곳 중 1곳: 세션 종료 직후) — 부모가 주입 */
  recommendation?: RecommendedAction
}

export function CompletionState({ stats, textId, onRestart, recommendation }: CompletionStateProps) {
  // ... 기존 본문 그대로 ...
}
```

### 2-C. JSX에 NextActionCard 추가

기존 "다음 만남" 영역(라인 78~90 근처)을 찾아서, 그 위 또는 아래에 추가:

```tsx
{/* 기존 "다음 만남" 영역 — 그대로 유지 */}
<div className="mb-8 text-left">
  <SectionTitle>다음 만남</SectionTitle>
  {/* ... 기존 내용 ... */}
</div>

{/* §17.3 추천 축 (3곳 중 1곳: 세션 종료 직후) */}
{recommendation && (
  <div className="mb-8 text-left">
    <NextActionCard
      recommendation={recommendation}
      prelude="오늘의 학습이 끝났어요. 다음으로 무엇을 해볼까요?"
    />
  </div>
)}
```

### 2-D. 부모 페이지에서 추천 주입

`src/app/(main)/flashcard/play/page.tsx` 또는 `FlashcardSession.tsx`(어디서 CompletionState를 렌더하는지에 따라)에서:

```bash
# CompletionState 사용 위치 확인
grep -rn "CompletionState" src/components/flashcard src/app/\(main\)/flashcard
```

해당 부모 컴포넌트에 추가:

```typescript
import { getMockNextAction, MOCK_USER_CONTEXTS } from '@/lib/recommend/next-action.mock'

// ... 컴포넌트 내부 ...
const recommendation = getMockNextAction(MOCK_USER_CONTEXTS.warm_urgent)

// ... CompletionState 호출 시 ...
<CompletionState
  stats={...}
  textId={...}
  onRestart={...}
  recommendation={recommendation}
/>
```

### 2-E. 검증

```bash
cd apps/web
npx tsc --noEmit
pnpm dev
```

브라우저: Flashcard 플레이 → 모든 카드 완료 → CompletionState 진입 → "다음 추천" 카드 표시 확인.

### 2-F. 단계 2 보고

```markdown
### 단계 2 (Flashcard CompletionState 추천) 완료
- src/components/recommend/NextActionCard.tsx 신규 생성 (단계 0)
- src/components/flashcard/CompletionState.tsx 수정 (recommendation prop 추가)
- (CompletionState 부모) recommendation 주입
- TSC 0 errors
- 브라우저: Flashcard 완료 화면에서 "다음 추천" 카드 표시 확인

다음: 단계 3 (SpellForge 세션 종료 추천) 진행할까요?
```

---

## 5. 단계 3 — SpellForge 세션 종료 추천

### 3-A. SpellForge 세션 종료 흐름 파악

```bash
# SpellForge에서 isComplete가 true가 되는 조건
grep -n "isComplete" src/components/spellforge/SpellForge.tsx src/hooks/useSpellForgeSession.ts 2>/dev/null
```

`isComplete`가 true가 되는 시점에 SpellForge 컴포넌트가 어떤 UI를 보여주는지 확인 필요. MicroPause인지 별도 완료 화면인지.

### 3-B. 두 가지 시나리오

**시나리오 A**: SpellForge에 별도 완료 화면이 없고 마지막 단어 후 다른 페이지로 라우팅됨
→ 라우팅 직전 또는 부모 page.tsx에서 NextActionCard 표시

**시나리오 B**: SpellForge 안에 완료 화면이 있음
→ 그 화면에 NextActionCard 추가

`SpellForge.tsx`의 본문 전체를 보고 세션 종료 처리를 파악:

```bash
sed -n '300,500p' src/components/spellforge/SpellForge.tsx
```

확인 후 적절한 시나리오로 진행. 필요하면 `MicroPause`에 `isLast` 분기를 추가하거나, 별도 `CompletionState` 컴포넌트를 SpellForge용으로 만들 수도 있음.

### 3-C. 권장 패턴 — 별도 SpellForgeCompletion 컴포넌트

가장 깔끔한 방식:

`src/components/spellforge/SpellForgeCompletion.tsx` 신규 생성:

```typescript
// src/components/spellforge/SpellForgeCompletion.tsx

'use client'

import { NextActionCard } from '@/components/recommend/NextActionCard'
import type { RecommendedAction } from '@/lib/recommend/types'
import { Sparkles } from 'lucide-react'
import Link from 'next/link'

interface SpellForgeCompletionProps {
  totalWords: number
  correctCount: number
  durationMs: number
  textId: string
  recommendation?: RecommendedAction
}

export function SpellForgeCompletion({
  totalWords,
  correctCount,
  durationMs,
  textId,
  recommendation,
}: SpellForgeCompletionProps) {
  const minutes = Math.round(durationMs / 60000)
  const accuracy = totalWords > 0 ? Math.round((correctCount / totalWords) * 100) : 0

  return (
    <section className="flex flex-1 items-center justify-center p-8">
      <div className="w-full max-w-[600px] text-center">
        <span
          className="mb-6 inline-block animate-[celebrate_1s_var(--ease-spring)] text-[72px]"
          aria-hidden="true"
        >
          🏆
        </span>

        <h1 className="mb-2 font-display text-[32px] font-[800] text-[var(--t1)]">
          오늘의 학습이 완료됐어요
        </h1>
        <p className="mb-8 font-english text-[16px] italic text-[var(--t2)]">
          {totalWords}개의 단어와 함께한 {minutes}분의 깊은 시간
        </p>

        <div className="mb-8 grid grid-cols-3 gap-3">
          <Stat value={totalWords} label="학습한 단어" />
          <Stat value={`${minutes}m`} label="학습 시간" />
          <Stat value={`${accuracy}%`} label="정확도" />
        </div>

        {/* §17.3 추천 축 (3곳 중 1곳: 세션 종료 직후) */}
        {recommendation && (
          <div className="mb-8 text-left">
            <NextActionCard
              recommendation={recommendation}
              prelude="잘 마쳤어요. 다음으로 무엇을 해볼까요?"
            />
          </div>
        )}

        <Link
          href={`/text/${textId}`}
          className="inline-flex items-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-5 py-3 font-display text-[13px] font-[700] text-[var(--t2)] no-underline transition-colors hover:border-[var(--p)] hover:text-[var(--p)]"
        >
          원문으로 돌아가기
        </Link>
      </div>
    </section>
  )
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
      <div className="mb-1 font-display text-[24px] font-[800] text-[var(--t1)]">{value}</div>
      <div className="font-body text-[11px] text-[var(--t3)]">{label}</div>
    </div>
  )
}
```

### 3-D. SpellForge.tsx에서 사용

`isComplete`가 true일 때 SpellForgeCompletion을 렌더하도록:

```typescript
// SpellForge.tsx 상단 import
import { SpellForgeCompletion } from './SpellForgeCompletion'
import { getMockNextAction, MOCK_USER_CONTEXTS } from '@/lib/recommend/next-action.mock'

// 컴포넌트 내부, return 직전에
const recommendation = useMemo(
  () => getMockNextAction(MOCK_USER_CONTEXTS.warm_urgent),
  [],
)

// return 시작 부분에 isComplete 분기 추가
if (isComplete) {
  return (
    <SpellForgeCompletion
      totalWords={session.words.length}
      correctCount={session.correctCount ?? 0}
      durationMs={Date.now() - session.startedAt.getTime()}
      textId={textId}
      recommendation={recommendation}
    />
  )
}

// 기존 return JSX 그대로
return ( ... )
```

> **주의**: `session.correctCount`가 실제 존재하는지 `useSpellForgeSession`에서 확인. 없으면 다른 필드명 사용 (예: `session.stats.correctCount`).

### 3-E. 검증 + 보고

```bash
npx tsc --noEmit
pnpm dev
```

브라우저: SpellForge 완주 → 완료 화면 진입 → "다음 추천" 카드 표시.

```markdown
### 단계 3 (SpellForge 세션 종료) 완료
- src/components/spellforge/SpellForgeCompletion.tsx 신규
- src/components/spellforge/SpellForge.tsx 수정 (isComplete 분기)
- TSC 0 errors
- 브라우저: SpellForge 완주 후 "다음 추천" 표시 확인

다음: 단계 4 (Dictation 추천) 진행할까요?
```

---

## 6. 단계 4 — DictationResultsClient 추천 추가

`src/components/dictation/DictationResultsClient.tsx` 수정.

### 4-A. import 추가

```typescript
import { NextActionCard } from '@/components/recommend/NextActionCard'
import {
  getMockNextAction,
  MOCK_USER_CONTEXTS,
} from '@/lib/recommend/next-action.mock'
```

### 4-B. 추천 변수 추가

`aggregateData` `useMemo` 다음에:

```typescript
// §17.3 추천 축 (3곳 중 1곳: 세션 종료 직후)
// useMemo로 중복 계산 방지 — Dictation 결과 화면은 sessionId 따라 한 번만 렌더
const recommendation = useMemo(
  () => getMockNextAction(MOCK_USER_CONTEXTS.warm_urgent),
  [],
)
```

### 4-C. JSX 어딘가에 NextActionCard 삽입

페이지의 자연스러운 위치 찾기 — Hero 정확도 카드 아래, 문항별 결과 위가 좋음. 본문 전체 구조 먼저 확인:

```bash
sed -n '95,200p' src/components/dictation/DictationResultsClient.tsx
```

확인 후 추가:

```tsx
{/* §17.3 추천 축 (3곳 중 1곳) */}
<section className="px-1">
  <NextActionCard
    recommendation={recommendation}
    prelude="받아쓰기 결과가 정리됐어요. 다음으로 무엇을 해볼까요?"
  />
</section>
```

### 4-D. 검증 + 보고

브라우저: `/dictate` 세션 완료 → results 화면 → "다음 추천" 카드 표시.

```markdown
### 단계 4 (Dictation 추천) 완료
- src/components/dictation/DictationResultsClient.tsx 수정
- TSC 0 errors
- 브라우저: Dictation 결과 화면에서 "다음 추천" 표시 확인

다음: 단계 5 (ScriptQuiz 추천) 진행할까요?
```

---

## 7. 단계 5 — ScriptQuiz ResultScreen 추천 추가

`src/components/game/scriptquiz/ScriptQuiz.tsx`의 `<ResultScreen>` 컴포넌트에 추천 추가.

### 5-A. ResultScreen 위치 파악

```bash
# ResultScreen 정의 위치
grep -rn "function ResultScreen\|const ResultScreen\|export.*ResultScreen" src/components/game/scriptquiz/
```

별도 파일이거나 같은 파일 안에 있을 수 있음.

### 5-B. ResultScreen props 확장

ResultScreen 시그니처에 `recommendation` 추가:

```typescript
interface ResultScreenProps {
  totalQ: number
  stats: { correct: number; wrong: number; accuracy: number; avgTimeSec: number }
  questions: Question[]
  answers: QuizAnswer[]
  onRetry: () => void
  recommendation?: RecommendedAction  // ← 추가
}
```

### 5-C. ScriptQuiz.tsx에서 추천 주입

```typescript
// import 추가
import { NextActionCard } from '@/components/recommend/NextActionCard'
import { getMockNextAction, MOCK_USER_CONTEXTS } from '@/lib/recommend/next-action.mock'

// 컴포넌트 내부
const recommendation = useMemo(
  () => getMockNextAction(MOCK_USER_CONTEXTS.hot),  // ScriptQuiz는 보통 Hot 사용자
  [],
)

// ResultScreen 호출 시 (라인 181 근처)
<ResultScreen
  totalQ={totalQ}
  stats={stats}
  questions={session.questions}
  answers={answers}
  onRetry={startQuiz}
  recommendation={recommendation}  // ← 추가
/>
```

### 5-D. ResultScreen JSX에 NextActionCard 삽입

ResultScreen 본문 안 적절한 위치(통계 표시 아래, onRetry 버튼 위 등)에:

```tsx
{recommendation && (
  <div className="mt-6 mb-6">
    <NextActionCard
      recommendation={recommendation}
      prelude="이 원문을 잘 다뤘어요. 다음으로 어떤 학습을 해볼까요?"
    />
  </div>
)}
```

### 5-E. 검증 + 전체 완료 보고

브라우저: ScriptQuiz 5문제 완주 → result 화면 → "다음 추천" 카드 표시.

```markdown
### 단계 5 (ScriptQuiz 추천) 완료
- src/components/game/scriptquiz/ResultScreen 또는 ScriptQuiz.tsx 수정
- TSC 0 errors
- 브라우저: ScriptQuiz 완주 후 "다음 추천" 표시 확인

### 갈래 B 완성 — 추천 3곳 모두 활성화
- ✓ Hub Today CTA (이미 완료)
- ✓ FloatingSparkle (Workspace) (단계 1)
- ✓ 세션 종료 직후 (단계 2~5)
  - Flashcard CompletionState
  - SpellForge SpellForgeCompletion
  - Dictation Results
  - ScriptQuiz Result

CLAUDE.md §17.3 추천 축 정합 완성:
"제안 위치 정확히 3곳" — 자율 70% / 시스템 제안 30% 보존.

다음 후보 (별도 지시문):
- DB 설계 (Supabase 초기 스키마)
- cardId 네임스페이스 통합 (단계 4 — DB 시점 자연 통합)
- 추천 엔진 실제 버전
```

---

## 8. 자가 점검 체크리스트

단계 5까지 완료 후 다음을 확인:

- [ ] 추천 노출이 정확히 3곳에서만 발생 (Hub / Workspace / 세션 종료)
- [ ] 4개 결과 화면(Flashcard/SpellForge/Dictation/ScriptQuiz) 모두 동일한 NextActionCard 사용
- [ ] 추천 라벨이 격려형만 — 정확도/실패 카운트 노출 X (§17 안티패턴 5)
- [ ] FSRS 변수(D/S/R)가 사용자 가시 영역에 노출 X (§17 안티패턴 2)
- [ ] 추천이 자동 재출현 X (사용자가 닫거나 클릭하면 끝)
- [ ] 모든 코드는 strict TypeScript
- [ ] TODO·placeholder·"나중에" 0건
- [ ] 다크모드 대응 (CSS 변수 사용)

---

## 9. 막혔을 때

| 상황 | 대응 |
|------|------|
| `session.correctCount` 필드가 없음 | `useSpellForgeSession` 훅 본문 확인, 실제 필드명 사용 |
| ResultScreen이 별도 파일 | 해당 파일을 직접 수정, props만 추가 |
| Workspace의 정적 message가 더 친화적 | mock 추천 라벨이 어색해 보일 수 있음. 그래도 추천 엔진 결과를 따르는 것이 §17.3 정합. UI/UX 개선은 추천 엔진 카피 수정으로 별도 처리. |
| Sparkle 트리거가 여전히 같은 추천만 보여줌 | mock은 `MOCK_USER_CONTEXTS.warm_inprogress` 결과 1건이라 같음. DB 연동 시 동적. |
| Dictation에 useMemo 또 추가하면 안 됨 | 기존 useMemo 내부에 동시 계산하거나, 의존 배열 빈 useMemo는 SSR 안전 |

---

## 10. 다음 작업 (참고용 — 본 지시문 범위 밖)

본 지시문 5단계가 끝나면 갈래 B(UI 정교화)가 완성됩니다. 다음 후보:

1. **갈래 A로 전환 — DB 설계** (클리티컬 패스)
2. **cardId 네임스페이스 통합** (단계 4)
3. **추천 엔진 실제 버전** (`next-action.mock.ts` → `next-action.ts`)

이 3가지는 모두 DB 연동을 수반하므로 다음 마일스톤은 **DB 설계 결정**.

---

이 지시문을 끝까지 읽었다면, **단계 0 (NextActionCard)** 부터 시작하세요.
