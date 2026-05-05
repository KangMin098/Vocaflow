# Vocaflow Dictation 모듈 - 마스터 설계 지시문

> **영어 받아쓰기 학습 모듈을 인지심리학 + 신경과학 기반으로 완전 설계**

---

## 0. 메타 - 이 작업의 본질

### 받아쓰기란 무엇인가 (학술 정의)

받아쓰기(Dictation)는 **청각 입력을 음운 표상 → 어휘 인식 → 문법 구조 → 텍스트 산출**로 변환하는 다중 인지 처리 과제입니다. 단순 듣기보다 훨씬 깊은 학습 효과를 제공합니다.

### 학술 근거 (반드시 반영)

```
1. Spaced Dictation (Edelman & McClung 2017)
   → 구간 반복 받아쓰기는 작업기억 부담 감소 + 청각 처리 강화
   
2. Phonological Loop (Martin & Ellis 2012, Baddeley)
   → 음운 회로 활성화 → 작업기억 → 장기기억 전이
   
3. Forgetting Curve (Ebbinghaus)
   → 받아쓰기 직후 24시간 내 재시도 → 망각 곡선 완화
   
4. Multiword Items (Nation 1991)
   → 친숙한 어휘를 익숙하지 않은 결합으로 받아쓰기 → 효과 극대
   
5. Auditory-Motor Network (Vaquero 2018)
   → 듣기 + 쓰기 → 청각-운동 신경 연결 강화 → 발음/리스닝 동시 향상
   
6. Decoding & Segmentation (LEiA 2017)
   → 받아쓰기는 음운 분절 능력 직접 훈련
   
7. Dictogloss (Wajnryb 1990)
   → 의미 우선 받아쓰기 (메모 → 재구성) → 깊은 처리
```

### Vocaflow에서의 의미

Vocaflow는 영어 학습 플랫폼이고, 받아쓰기는 **가장 강력한 통합 학습 도구**입니다:
- 듣기 (청각 처리)
- 어휘 (단어 인식)
- 문법 (구조 분석)
- 쓰기 (산출)
- 발음 (음운 회로)

다른 모듈(Flashcard, SpellForge, WordBlitz, ScriptQuiz)과 차별화: **문장/단락 단위 통합 학습**.

---

## 1. 프로젝트 컨텍스트

### Vocaflow 기본
```
경로: C:\Users\kille\Vocaflow\
구조: Turborepo 모노레포
스택: Next.js 14 + React + TypeScript + Tailwind + Supabase + OpenAI
플랫폼: 웹 + iOS/Android (Expo)
```

### 디자인 SSoT
프로젝트 루트의 `CLAUDE.md` v06.4가 디자인 단일 기준.

### 폰트 (필수)
- Display/UI: Plus Jakarta Sans
- Body: DM Sans
- 영어 텍스트: Lora (serif)
- 코드/스펠링: JetBrains Mono

### 색상
CSS Variables 우선 (`--p`, `--bg`, `--t1` 등).

### 기존 학습 모듈 (참고)
```
✅ LexiVault    - 단어장
✅ Flashcard    - 카드 학습 (SM-2)
✅ SpellForge   - 스펠링 게임
✅ WordBlitz    - 인형뽑기 단어 게임
✅ ScriptQuiz   - 원문 퀴즈
✅ Dashboard    - 통계
🆕 Dictation    - 문장 받아쓰기 ★ 이번 작업
```

---

## 2. 받아쓰기 모듈 비전 (UX/UI 철학)

### 핵심 원칙

#### 1. **점진적 도전** (Zone of Proximal Development - Vygotsky)
- 너무 쉽지도 어렵지도 않은 학습 영역 유지
- 자동 난이도 조정 (오답률 기반)

#### 2. **Quiet UI** (Vocaflow 시그니처)
- 받아쓰기 세션은 **집중 모드** - UI 최소화
- 메타 정보는 호버/요청 시만 표시
- 단어 강조는 의미 있는 순간만 (정답 후 등)

#### 3. **즉각 피드백 + 지연 평가**
- 단어 단위 즉각 시각 피드백 (인지 부담 ↓)
- 문장 완성 후 종합 평가 (메타 인지 ↑)

#### 4. **다중 감각 통합** (Multimodal Learning)
- 듣기 + 쓰기 + 시각 (스펠링) + 의미 (번역)
- 발음 표시 (IPA + 음절 분절)

#### 5. **자율성** (Self-Determination Theory - Deci & Ryan)
- 사용자가 속도, 반복 횟수, 채점 모드 선택
- 자율성 → 내적 동기 → 지속

---

## 3. 모듈 아키텍처

### 3-1. 전체 구조

```
Dictation 모듈
├─ Hub (진입점)
│  ├─ 이력 (Session History)
│  ├─ 리소스 선택 (Library / Direct Input)
│  ├─ 추천 (SRS 기반)
│  └─ 통계 (정확도 추이)
│
├─ Setup (설정)
│  ├─ 단위 (문장 / 단락)
│  ├─ 갯수 (5/10/20/all)
│  ├─ 순서 (순차 / 랜덤)
│  ├─ 채점 모드 (스마트 / 엄격)
│  ├─ 난이도 (CEFR A1~C2)
│  └─ 옵션 (속도, 반복, 힌트)
│
├─ Session (받아쓰기 세션)
│  ├─ 진행률 표시
│  ├─ 오디오 컨트롤 (재생/구간/속도)
│  ├─ 입력 영역 (실시간 피드백)
│  ├─ 힌트 시스템
│  └─ 즉각 채점 + 해설
│
└─ Results (결과)
   ├─ 정확도 + 시간 + 시도 횟수
   ├─ 오답 단어 추출 (SRS 큐 추가)
   ├─ 청각 패턴 분석 (어떤 음운에서 실수)
   └─ 다음 단계 추천
```

### 3-2. 라우트 구조

```
apps/web/src/app/(app)/dictate/
├─ page.tsx                       # /dictate (Hub)
├─ setup/
│  └─ [resourceId]/
│     └─ page.tsx                 # /dictate/setup/[id] (Setup)
├─ session/
│  └─ [sessionId]/
│     └─ page.tsx                 # /dictate/session/[id] (Session)
└─ results/
   └─ [sessionId]/
      └─ page.tsx                 # /dictate/results/[id] (Results)
```

### 3-3. 컴포넌트 + 훅 구조

```
apps/web/src/lib/dictation/
├─ data.ts                        # 타입 + 상수 + 샘플 데이터
├─ types.ts                       # GameState, DictationSession 등
├─ scoring.ts                     # 채점 알고리즘 (Levenshtein + 단어 단위)
├─ audio-control.ts               # TTS + 구간 제어
└─ analyzer.ts                    # 오답 패턴 분석

apps/web/src/components/learning/dictation/
├─ Hub/
│  ├─ DictationHub.tsx
│  ├─ ResourceSelector.tsx
│  ├─ SessionHistory.tsx
│  └─ DictationStats.tsx
├─ Setup/
│  ├─ DictationSetup.tsx
│  ├─ UnitSelector.tsx          # 문장/단락
│  ├─ CountSelector.tsx          # 5/10/20/all
│  ├─ OrderSelector.tsx          # 순차/랜덤
│  ├─ ScoringModeSelector.tsx    # 스마트/엄격
│  └─ DifficultySelector.tsx     # CEFR A1~C2
├─ Session/
│  ├─ DictationSession.tsx       # 메인 컨테이너
│  ├─ AudioPlayer.tsx            # 재생 컨트롤
│  ├─ SegmentRepeater.tsx        # 구간 반복
│  ├─ DictationInput.tsx         # 입력 + 실시간 피드백
│  ├─ HintSystem.tsx             # 단계적 힌트
│  ├─ WordFeedback.tsx           # 단어별 피드백
│  ├─ ProgressBar.tsx            # 진행률
│  └─ FocusMode.tsx              # 집중 모드 토글
├─ Results/
│  ├─ DictationResults.tsx
│  ├─ AccuracyChart.tsx
│  ├─ ErrorAnalysis.tsx          # 오답 패턴
│  ├─ MistakenWords.tsx          # 오답 단어 (SRS 추가)
│  └─ NextStepRecommendation.tsx
└─ shared/
   ├─ DictationSidebar.tsx        # 사이드바 메뉴 추가
   └─ DictationProgressIndicator.tsx

apps/web/src/hooks/dictation/
├─ useDictationSession.ts         # 세션 상태
├─ useAudioControl.ts             # 재생 + 속도 + 구간
├─ useSegmentRepeat.ts            # A-B 반복 + 카운트
├─ useDictationScoring.ts         # 채점 + 피드백
├─ useDictationHistory.ts         # Supabase 이력
└─ useHintSystem.ts               # 단계적 힌트
```

---

## 4. 사이드바 메뉴 추가

### 4-1. 위치

```
기존 사이드바 메뉴:
  📚 Library
  🎴 Flashcard
  ⚒️  SpellForge
  🎯 WordBlitz
  📜 ScriptQuiz
  📊 Dashboard

✨ 추가:
  ✍️  Dictation       ★ NEW (새 항목)
```

### 4-2. 사이드바 컴포넌트 수정

기존 사이드바 컴포넌트를 찾아서 (`apps/web/src/components/layout/Sidebar.tsx` 또는 유사 위치) 다음 항목 추가:

```tsx
{
  href: '/dictate',
  label: 'Dictation',
  icon: '✍️',  // 또는 lucide-react 아이콘
  description: '문장 받아쓰기',
  badge: isNew ? 'NEW' : undefined,
}
```

### 4-3. 아이콘 추천

`lucide-react`에서:
- `PencilLine` (1순위 - 받아쓰기 직관)
- `Mic` (2순위 - 듣기 강조)
- `Headphones` + `Pencil` 조합 (3순위)

---

## 5. Phase 1 - HUB 화면 상세 설계

### 5-1. UX 흐름

```
사용자 진입
  ↓
[추천 섹션] - SRS 기반 가장 효과적인 받아쓰기 추천
  ↓
[리소스 선택] - 두 가지 경로
  ├─ 라이브러리에서 (기존 등록 자료)
  └─ 직접 입력 (스크립트 텍스트 / 파일 업로드)
  ↓
[이력] - 최근 세션 (재시도 가능)
  ↓
[통계] - 정확도 추이 (간단한 차트)
```

### 5-2. HUB 레이아웃

```
┌──────────────────────────────────────────────────────┐
│  [사이드바]│ Dictation                            ⚙️  │
│            ├──────────────────────────────────────── │
│  📚 Library│                                          │
│  🎴 Flash  │  📊 통계 카드 (작게)                     │
│  ⚒️  Spell │  ┌──────────────────────────────┐      │
│  🎯 Blitz  │  │ 이번주 정확도: 87% ↑          │      │
│  📜 Script │  │ 받아쓴 문장: 142개            │      │
│  ✍️ Dictate│  │ 연속 학습: 5일 🔥            │      │
│  📊 Stats  │  └──────────────────────────────┘      │
│            │                                          │
│            │  ⭐ 오늘의 추천 (Smart Suggestion)        │
│            │  ┌──────────────────────────────┐      │
│            │  │ "BBC News: Climate Change"     │      │
│            │  │ A2 · 12 sentences · 5 min     │      │
│            │  │ 마지막 정확도 73% → 이번엔!    │      │
│            │  │              [▶ 시작하기]      │      │
│            │  └──────────────────────────────┘      │
│            │                                          │
│            │  📂 리소스 선택                           │
│            │  ┌────────────┬──────────────┐         │
│            │  │ 📚 라이브러리│ ✍️ 직접입력 │         │
│            │  └────────────┴──────────────┘         │
│            │                                          │
│            │  📜 최근 세션                             │
│            │  ┌──────────────────────────────┐      │
│            │  │ TED: Inequality (Yesterday)  │      │
│            │  │ 정확도 81% · 다시 시도        │      │
│            │  ├──────────────────────────────┤      │
│            │  │ News: Tech Trends (3일 전)   │      │
│            │  │ 정확도 92% · 잘 마무리        │      │
│            │  └──────────────────────────────┘      │
│            │                                          │
│            │  📈 정확도 추이 (간단 차트)              │
│            │  ┌──────────────────────────────┐      │
│            │  │  지난 7일                    │      │
│            │  │  ▁▃▆█▇█▇                    │      │
│            │  └──────────────────────────────┘      │
└──────────────────────────────────────────────────────┘
```

### 5-3. HUB 핵심 기능

#### A. Smart Suggestion (Variable Reward 적용)
```typescript
// useDictationSuggestion.ts
function getSuggestion(history) {
  // 최근 정확도 70~90% 자료 우선
  // 마지막 시도 24시간~7일 자료
  // SRS 큐에 있는 자료
  // 진행 중이지만 미완료 자료
  
  return {
    resource,
    reason: '지난번 73% → 더 잘할 수 있어요',
    estimatedTime: 5 * 60,
  };
}
```

#### B. 리소스 선택 - 3가지 경로

```typescript
// 1. 라이브러리에서 (기존 자료)
<ResourcePicker mode="library">
  <SearchBar />
  <FilterBar levels={['A1', 'A2', 'B1', 'B2']} />
  <ResourceGrid resources={libraryResources} />
</ResourcePicker>

// 2. 직접 입력 - 스크립트
<ResourcePicker mode="direct-script">
  <Textarea placeholder="영어 스크립트 붙여넣기" />
  <Button>분석 + 시작</Button>
</ResourcePicker>

// 3. 직접 입력 - 파일 업로드
<ResourcePicker mode="direct-file">
  <Dropzone accept=".pdf,.docx,.txt,.srt" />
  <Button>업로드 + 시작</Button>
</ResourcePicker>
```

#### C. 세션 이력 (재시도 가능)

```typescript
// 최근 10개 세션
<SessionHistory>
  {sessions.map(session => (
    <SessionCard
      key={session.id}
      title={session.resourceTitle}
      accuracy={session.accuracy}
      date={session.completedAt}
      onRetry={() => retrySession(session.id)}
      onContinue={() => session.isPartial && continueSession(session.id)}
    />
  ))}
</SessionHistory>
```

#### D. 통계 (간단)

```typescript
<DictationStats>
  <StatCard
    label="이번 주 정확도"
    value={`${weeklyAccuracy}%`}
    trend={trendVsLastWeek}  // 화살표 + 변화량
  />
  <StatCard
    label="받아쓴 문장"
    value={totalSentences}
  />
  <StatCard
    label="연속 학습"
    value={`${streak}일`}
    icon="🔥"
  />
  <AccuracyTrendChart data={last7Days} />
</DictationStats>
```

---

## 6. Phase 2 - SETUP 화면 상세 설계

### 6-1. 설정 옵션 (반드시 제공)

```
┌──────────────────────────────────────┐
│  Dictation Setup                     │
│  📜 BBC News: Climate Change          │
├──────────────────────────────────────┤
│                                      │
│  📏 단위                              │
│  ○ 문장 단위 (Sentence)              │
│  ● 단락 단위 (Paragraph)             │
│  ○ 전체 (Whole Script)               │
│                                      │
│  🔢 갯수                              │
│  [ 5 ][ 10 ][ 20 ][ all ]            │
│                                      │
│  🔀 순서                              │
│  ● 순차 (Sequential)                 │
│  ○ 랜덤 (Random)                     │
│  ○ 어려운 것 우선 (Difficult-First)  │
│                                      │
│  ✅ 채점 방식                          │
│  ● 스마트 (대소문자/구두점 무시)      │
│  ○ 엄격 (모두 체크)                  │
│                                      │
│  🎚️ 난이도 (CEFR)                    │
│  [▼ B1 (자동 감지)]                  │
│                                      │
│  ⚙️ 고급 옵션 ▼                       │
│  ┌──────────────────────────────┐  │
│  │ 재생 속도: 0.75x (slow)       │  │
│  │ 자동 반복: 3회                │  │
│  │ 힌트 사용: 허용 (-10점/회)    │  │
│  │ TTS 음성: 미국 영어 (US-F)    │  │
│  │ 한국어 뜻 표시: 정답 후만      │  │
│  │ 발음 표시 (IPA): 정답 후      │  │
│  └──────────────────────────────┘  │
│                                      │
│  [▶ 시작하기]      [← 이전]          │
└──────────────────────────────────────┘
```

### 6-2. 옵션 별 설명 + 권장값

#### 단위 (Unit) - 학술 근거

```typescript
const UNIT_OPTIONS = [
  {
    value: 'sentence',
    label: '문장 단위',
    description: '한 문장씩 받아쓰기. 초보자 추천.',
    cognitiveLoad: 'low',
    recommendedLevel: ['A1', 'A2', 'B1'],
  },
  {
    value: 'paragraph',
    label: '단락 단위',
    description: '단락 전체 받아쓰기. 중급+.',
    cognitiveLoad: 'medium',
    recommendedLevel: ['B1', 'B2'],
  },
  {
    value: 'whole',
    label: '전체',
    description: '전체 텍스트 받아쓰기. 고급.',
    cognitiveLoad: 'high',
    recommendedLevel: ['B2', 'C1', 'C2'],
  },
];
```

#### 갯수 - 학습량 권장

```typescript
const COUNT_OPTIONS = [
  { value: 5,   label: '5개',  duration: '5분',   purpose: '워밍업' },
  { value: 10,  label: '10개', duration: '10분',  purpose: '집중 학습' },
  { value: 20,  label: '20개', duration: '20분',  purpose: '딥 워크' },
  { value: 'all', label: '전체', duration: '~',  purpose: '완주 모드' },
];

// 권장: 10개 (Pomodoro 친화적)
```

#### 순서

```typescript
const ORDER_OPTIONS = [
  {
    value: 'sequential',
    label: '순차',
    description: '원문 순서대로. 맥락 학습.',
    benefit: 'Context preservation',
  },
  {
    value: 'random',
    label: '랜덤',
    description: '무작위 순서. 인지 부담 ↑.',
    benefit: 'Interleaved practice (Bjork 2014)',
  },
  {
    value: 'difficulty-first',
    label: '어려운 것 우선',
    description: '오답률 높은 문장 먼저.',
    benefit: 'Desirable difficulty',
  },
];
```

#### 채점 방식

```typescript
const SCORING_MODES = [
  {
    value: 'smart',
    label: '스마트',
    description: '대소문자, 구두점 무시. 단어만 평가.',
    rules: {
      caseSensitive: false,
      punctuationSensitive: false,
      whitespaceTolerant: true,
      contractionTolerant: true,  // "don't" = "do not"
    },
  },
  {
    value: 'strict',
    label: '엄격',
    description: '모든 것 정확히. 시험 준비.',
    rules: {
      caseSensitive: true,
      punctuationSensitive: true,
      whitespaceTolerant: false,
      contractionTolerant: false,
    },
  },
];
```

#### 고급 옵션

```typescript
const ADVANCED_OPTIONS = {
  playbackSpeed: [0.5, 0.75, 1.0, 1.25, 1.5],  // 권장 0.75 (학습용)
  autoRepeat: 3,  // 자동 반복 횟수
  hintAllowed: true,
  hintPenalty: -10,  // 점수 차감
  voice: ['en-US-Female', 'en-US-Male', 'en-GB-Female', 'en-GB-Male'],
  showKoreanMeaning: 'after-answer',  // never / after-answer / always
  showIPA: 'after-answer',
};
```

---

## 7. Phase 3 - SESSION 화면 상세 설계 (가장 중요)

### 7-1. 세션 화면 레이아웃

```
┌──────────────────────────────────────────────────────┐
│ ← Setup                          [Focus 🎯] [Exit ✕] │
│ Progress: ████████░░ 8/10                            │
├──────────────────────────────────────────────────────┤
│                                                      │
│   📜 Sentence 8 of 10                                │
│                                                      │
│   ┌──────────────────────────────────────┐         │
│   │  🔊 Audio Player                       │         │
│   │  ┌─────────────────────────┐  [⚙️]   │         │
│   │  │ ▶ 0:08 ━━━━○━━━━ 0:24  │  speed   │         │
│   │  └─────────────────────────┘  0.75x   │         │
│   │                                        │         │
│   │  [⏮ -3s] [▶/⏸] [⏭ +3s] [🔁 Loop]    │         │
│   │  Repeat: 2/3   [Segment: A-B]         │         │
│   └──────────────────────────────────────┘         │
│                                                      │
│   ✏️ Type what you hear:                             │
│   ┌──────────────────────────────────────┐         │
│   │                                        │         │
│   │  Climate change is one of the most_    │         │
│   │  ───────────────────────────────────   │         │
│   │  pressing issues facing humanity.      │         │
│   │                                        │         │
│   └──────────────────────────────────────┘         │
│                                                      │
│   💡 Hints (optional, -10점)                          │
│   [첫 글자 보기] [길이 보기] [한국어 뜻]              │
│                                                      │
│   [✓ Submit (Enter)]   [⏭ Skip (Tab)]                │
│                                                      │
│   📊 Score: 850   ⏱ 2:34   ❤️ 3 hints                │
└──────────────────────────────────────────────────────┘
```

### 7-2. 핵심 인터랙션

#### A. 오디오 컨트롤 (CRITICAL - 학습의 90%)

```typescript
// useAudioControl.ts

interface AudioControl {
  // 기본 재생
  play(): void;
  pause(): void;
  toggle(): void;
  
  // 속도 조절 (학습 핵심)
  setSpeed(speed: 0.5 | 0.75 | 1.0 | 1.25 | 1.5): void;
  
  // 구간 점프 (Spaced Dictation)
  jumpBackward(seconds: number): void;  // 기본 3초
  jumpForward(seconds: number): void;
  jumpToStart(): void;
  
  // 구간 반복 (A-B Loop)
  setLoopRange(startMs: number, endMs: number): void;
  clearLoop(): void;
  
  // 자동 반복
  enableAutoRepeat(times: number): void;
  
  // 단어 단위 점프 (음운 분석용)
  jumpToWord(wordIndex: number): void;
  
  // 키보드 단축키
  // Space: play/pause
  // ← →: -3s / +3s
  // Shift+← →: -10s / +10s
  // L: loop toggle
  // 1-5: speed (0.5/0.75/1/1.25/1.5)
}
```

#### B. 입력 영역 (실시간 피드백)

```typescript
// DictationInput.tsx

interface InputProps {
  expectedText: string;           // 정답
  scoringMode: 'smart' | 'strict';
  onSubmit: (text: string) => void;
}

// 핵심 기능:
// 1. 실시간 단어 단위 채점 (입력 중)
// 2. 단어별 색상 피드백:
//    - 흰색: 입력 중 (평가 안 함)
//    - 노란색: 부분 일치 (이어서 입력)
//    - 초록색: 정답
//    - 빨간색: 오답 (Submit 후)
// 3. 자동 완성 끄기 (브라우저 기본 끄기)
// 4. IME 한글 입력 차단 (영어만)
// 5. 모바일 키보드 최적화
```

#### C. 단계적 힌트 시스템 (Scaffolding)

```typescript
// HintSystem.tsx

const HINT_STAGES = [
  {
    level: 1,
    name: '첫 글자 보기',
    penalty: -5,
    show: (sentence) => sentence.split(' ').map(w => w[0] + '_'.repeat(w.length - 1)).join(' '),
    // "C_______ c_____ i_ o__ o_ ___..."
  },
  {
    level: 2,
    name: '길이 표시',
    penalty: -3,
    show: (sentence) => sentence.split(' ').map(w => '_'.repeat(w.length)).join(' '),
    // "________ ______ __ ___ __ ___..."
  },
  {
    level: 3,
    name: '한국어 뜻',
    penalty: -10,
    show: (translation) => translation,
    // "기후변화는 인류가 직면한 가장 시급한 문제 중 하나입니다."
  },
  {
    level: 4,
    name: '발음 (IPA)',
    penalty: -15,
    show: (sentence) => getIPA(sentence),
    // /ˈklaɪmət tʃeɪndʒ ɪz wʌn ɒv ðə.../
  },
];

// 사용자가 막혔을 때 단계별로 제공
// 점수 차감으로 남용 방지 (Token economy)
```

#### D. Focus Mode (집중 모드)

```typescript
// FocusMode.tsx

// F 키 또는 버튼으로 토글
// 활성 시:
// - 사이드바 숨김
// - 헤더 최소화
// - HUD 투명도 ↓ (호버 시만)
// - 배경 어둡게
// - 입력 영역만 강조

const FocusStyles = {
  sidebar: { display: 'none' },
  header: { opacity: 0.3, transition: 'opacity 200ms' },
  hud: { opacity: 0.4 },
  background: { backgroundColor: 'rgba(0,0,0,0.6)' },
  inputArea: { 
    transform: 'scale(1.05)', 
    boxShadow: '0 0 60px rgba(255,217,61,0.3)' 
  },
};
```

#### E. 키보드 단축키 (필수)

```
음성 컨트롤:
  Space          - 재생/일시정지
  ←  /  →        - -3초 / +3초
  Shift + ←/→   - -10초 / +10초
  Shift + Space  - 처음으로 돌아가기
  L              - 구간 반복 ON/OFF
  1-5            - 속도 (0.5/0.75/1/1.25/1.5)

입력 컨트롤:
  Enter          - 제출
  Tab            - 건너뛰기
  Esc            - 일시정지

힌트:
  H              - 첫 글자 힌트
  Shift + H      - 한국어 뜻 힌트
  
화면:
  F              - Focus Mode 토글
  ?              - 키보드 힌트 표시
```

### 7-3. 채점 알고리즘 (CRITICAL)

```typescript
// scoring.ts

interface ScoringResult {
  totalScore: number;          // 0~100
  wordResults: WordResult[];
  errorPatterns: ErrorPattern[];
  timeBonusMultiplier: number;
}

interface WordResult {
  expected: string;
  actual: string;
  status: 'correct' | 'misspelled' | 'wrong' | 'missing' | 'extra';
  similarity: number;          // 0~1 (Levenshtein)
  errorType?: 'capitalization' | 'punctuation' | 'spelling' | 'word-choice';
}

function scoreSentence(
  expected: string,
  actual: string,
  mode: 'smart' | 'strict'
): ScoringResult {
  // 1. 전처리
  const expectedWords = tokenize(expected, mode);
  const actualWords = tokenize(actual, mode);
  
  // 2. Word-level alignment (Needleman-Wunsch)
  const alignment = alignWords(expectedWords, actualWords);
  
  // 3. 단어별 채점
  const wordResults = alignment.map(({ expected, actual }) => {
    if (!expected) return { ...extra };
    if (!actual) return { ...missing };
    
    const similarity = levenshteinSimilarity(expected, actual);
    
    if (similarity === 1.0) return { ...correct };
    if (similarity >= 0.8) return { ...misspelled };
    return { ...wrong };
  });
  
  // 4. 오류 패턴 분석 (학습 피드백용)
  const errorPatterns = analyzeErrors(wordResults);
  // 예: "동사 -ed 발음 인식 어려움" 등
  
  // 5. 점수 계산
  const correctCount = wordResults.filter(w => w.status === 'correct').length;
  const baseScore = (correctCount / wordResults.length) * 100;
  
  // 6. 시간 보너스 (적정 시간 이내 완성)
  const timeBonus = calculateTimeBonus(elapsedTime, expectedTime);
  
  return {
    totalScore: baseScore * timeBonus,
    wordResults,
    errorPatterns,
    timeBonusMultiplier: timeBonus,
  };
}
```

### 7-4. 시각 피드백 (단어별)

```typescript
// WordFeedback.tsx

// Submit 직후 단어별 색상 표시
const WORD_STYLES = {
  correct: {
    color: 'var(--success-text)',
    backgroundColor: 'var(--success-bg)',
    fontWeight: 'bold',
  },
  misspelled: {
    color: 'var(--warning-text)',
    backgroundColor: 'var(--warning-bg)',
    textDecoration: 'underline wavy',
  },
  wrong: {
    color: 'var(--error-text)',
    backgroundColor: 'var(--error-bg)',
    textDecoration: 'line-through',
  },
  missing: {
    color: 'var(--error-text)',
    backgroundColor: 'transparent',
    border: '1px dashed var(--error-text)',
  },
  extra: {
    color: 'var(--warning-text)',
    backgroundColor: 'transparent',
    textDecoration: 'line-through',
  },
};

// 정답 보여주기 (오답 후)
<div className="correction">
  <div className="user-input">
    {wordResults.map((w, i) => (
      <span key={i} style={WORD_STYLES[w.status]}>
        {w.actual}{' '}
      </span>
    ))}
  </div>
  
  <div className="correct-answer">
    Correct: {expected}
  </div>
  
  {/* 한국어 뜻 (정답 후 자동 표시) */}
  <div className="translation">
    {translation}
  </div>
  
  {/* 발음 (옵션) */}
  <div className="ipa">
    {ipa}
  </div>
  
  {/* 오류 패턴 분석 */}
  {errorPatterns.length > 0 && (
    <div className="error-tips">
      <h4>이번에 어려웠던 것:</h4>
      {errorPatterns.map(pattern => (
        <p>{pattern.description}</p>
      ))}
    </div>
  )}
</div>
```

---

## 8. Phase 4 - RESULTS 화면

### 8-1. 결과 레이아웃

```
┌──────────────────────────────────────────────────────┐
│  Session Complete! 🎉                                │
├──────────────────────────────────────────────────────┤
│                                                      │
│         87%  📈 +5%                                  │
│         정확도                                         │
│                                                      │
│  ┌──────────────┬─────────────┬─────────────┐      │
│  │ 정답          │ 시간          │ 힌트        │      │
│  │ 8 / 10       │ 12:34        │ 3회         │      │
│  └──────────────┴─────────────┴─────────────┘      │
│                                                      │
│  🎯 잘한 점                                           │
│  ✓ 일반 어휘 정확도 95%                              │
│  ✓ 시간 단축 (3분 ↓)                                 │
│  ✓ 첫 시도 정답 6개                                  │
│                                                      │
│  📌 보강 필요                                          │
│  ⚠ 동사 -ed 발음 (3건)                               │
│  ⚠ 약형 (the, a) 누락 (2건)                          │
│  ⚠ 복수형 -s 누락 (2건)                              │
│                                                      │
│  📚 오답 단어 (Flashcard로 학습 추천)                 │
│  ┌─────────────────────────────────────┐           │
│  │ • pressing  (×2)  [→ Flashcard]      │           │
│  │ • humanity   (×1)  [→ Flashcard]      │           │
│  │ • pressing   (×1)  [→ Flashcard]      │           │
│  │              [모두 Flashcard에 추가]  │           │
│  └─────────────────────────────────────┘           │
│                                                      │
│  📊 정확도 추이                                        │
│  지난 5회: 73 → 78 → 82 → 81 → 87%                  │
│                                                      │
│  💡 다음 단계 추천                                     │
│  ┌─────────────────────────────────────┐           │
│  │ 1. 동일 자료 한 번 더 (확실히 마스터)   │           │
│  │ 2. 비슷한 난이도 새 자료 도전          │           │
│  │ 3. 오답 단어 Flashcard 학습             │           │
│  └─────────────────────────────────────┘           │
│                                                      │
│  [↻ 다시 도전]  [📂 새 자료]  [🏠 Hub]                │
└──────────────────────────────────────────────────────┘
```

### 8-2. 오답 패턴 분석 (가장 가치 있는 기능)

```typescript
// analyzer.ts

interface ErrorPattern {
  type: 'phonetic' | 'morphological' | 'syntactic' | 'lexical';
  description: string;
  examples: { expected: string; actual: string }[];
  frequency: number;
  suggestion: string;
}

function analyzeSession(session: DictationSession): ErrorPattern[] {
  const patterns: ErrorPattern[] = [];
  
  // 1. 음운 오류 패턴
  const phoneticErrors = detectPhoneticPatterns(session);
  // 예:
  // - 동사 과거형 -ed: "asked" → "ask"
  // - 약형: "the" → ""
  // - 자음군: "asks" → "ask"
  
  // 2. 형태론 오류 (Morphology)
  const morphologicalErrors = detectMorphologicalPatterns(session);
  // 예:
  // - 복수형 -s 누락
  // - 3인칭 단수 -s 누락
  // - 소유격 's 누락
  
  // 3. 구문 오류
  const syntacticErrors = detectSyntacticPatterns(session);
  // 예:
  // - 관사 누락 (a, an, the)
  // - 전치사 혼동 (in/on/at)
  // - 어순 오류
  
  // 4. 어휘 오류
  const lexicalErrors = detectLexicalPatterns(session);
  // 예:
  // - 유사 발음 단어 혼동 (their/there/they're)
  // - 동음이의어
  
  return [...phoneticErrors, ...morphologicalErrors, ...syntacticErrors, ...lexicalErrors]
    .sort((a, b) => b.frequency - a.frequency);
}
```

### 8-3. SRS 통합 (오답 → 다음 학습)

```typescript
// 오답 단어 자동 SRS 추가

async function addMistakenWordsToSRS(session: DictationSession) {
  const mistakenWords = extractMistakenWords(session);
  
  for (const word of mistakenWords) {
    await supabase.from('flashcards').insert({
      user_id: userId,
      word: word.text,
      meaning: word.translation,
      source: `Dictation: ${session.resourceTitle}`,
      sm2_data: createInitialSM2Data({ difficulty: 'hard' }),
      // 오답 단어는 빠르게 재노출
    });
  }
}
```

---

## 9. 학술적 디자인 결정 (필수 반영)

### 9-1. Spaced Dictation 구현

```typescript
// useSegmentRepeat.ts

const SPACED_DICTATION_PATTERN = {
  // 자동 구간 반복 패턴
  initialPlay: 1,        // 첫 재생: 1회
  pauseAfterEach: 1500,  // 각 재생 사이 1.5초 정지
  totalRepeats: 3,       // 총 3회 반복 (학습 효과 정점)
  finalPause: 5000,      // 마지막 재생 후 5초 정지 (입력 시간)
};

// 사용자가 구간 ('A-B') 설정 가능
// 작업기억 부담 ↓ + 청각 처리 강화
```

### 9-2. Phonological Loop 활성화

```typescript
// 입력 중 자동 음성 재생 비활성화 옵션
// (음운 회로 활성 유지)

const PHONO_LOOP_PROTECTION = {
  // 사용자 입력 시작 시 자동 일시정지
  pauseOnInputStart: true,
  
  // 구간 반복 후 입력 시작 시까지 충분한 시간
  preInputSilence: 1500,
};
```

### 9-3. Forgetting Curve 적용

```typescript
// 세션 완료 후 24시간/3일/7일 알림

const SPACED_REVIEW = {
  intervals: [
    { hours: 24, label: '내일 다시' },
    { hours: 72, label: '3일 후 다시' },
    { hours: 168, label: '1주일 후 다시' },
  ],
  
  // Push notification (나중에 모바일 추가)
  triggerReview(session) {
    schedulePushNotification({
      title: 'Dictation 복습',
      body: `${session.resourceTitle} 다시 도전!`,
      time: addHours(now, 24),
    });
  },
};
```

### 9-4. Desirable Difficulty (Bjork)

```typescript
// 적정 난이도 자동 조정

function adjustDifficulty(history: SessionHistory): DifficultyAdjustment {
  const recentAccuracy = avg(history.last5Sessions);
  
  if (recentAccuracy > 92) {
    // 너무 쉬움 → 난이도 ↑
    return {
      suggestedAction: 'increase',
      methods: ['random-order', 'faster-speed', 'higher-cefr'],
    };
  }
  
  if (recentAccuracy < 70) {
    // 너무 어려움 → 난이도 ↓
    return {
      suggestedAction: 'decrease',
      methods: ['slower-speed', 'sentence-unit', 'lower-cefr'],
    };
  }
  
  return { suggestedAction: 'maintain' };
}
```

### 9-5. Flow State (Csikszentmihalyi)

```typescript
// 몰입 유지 요소

const FLOW_DESIGN = {
  // 1. 명확한 목표 (다음 문장)
  clearGoal: 'Next sentence is X words',
  
  // 2. 즉각 피드백 (단어별 채점)
  instantFeedback: true,
  
  // 3. 적절한 도전 (자동 난이도 조정)
  optimalChallenge: 'Adjust based on accuracy',
  
  // 4. 방해 요소 제거 (Focus Mode)
  distractionFree: 'Focus Mode F key',
  
  // 5. 시간 감각 왜곡 (몰입의 신호)
  // - 진행률 표시 최소화
  // - 카운트다운 타이머 X
  // - 세션 길이 사용자 선택
};
```

---

## 10. 데이터 모델 (Supabase)

### 10-1. Tables

```sql
-- 받아쓰기 세션
CREATE TABLE dictation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  
  -- 리소스
  resource_id UUID REFERENCES library_resources,
  resource_type TEXT CHECK (resource_type IN ('library', 'direct-script', 'direct-file')),
  resource_title TEXT NOT NULL,
  
  -- 설정
  unit TEXT CHECK (unit IN ('sentence', 'paragraph', 'whole')),
  count INTEGER NOT NULL,
  order_mode TEXT CHECK (order_mode IN ('sequential', 'random', 'difficulty-first')),
  scoring_mode TEXT CHECK (scoring_mode IN ('smart', 'strict')),
  difficulty TEXT CHECK (difficulty IN ('A1','A2','B1','B2','C1','C2')),
  
  -- 옵션
  playback_speed REAL DEFAULT 0.75,
  auto_repeat INTEGER DEFAULT 3,
  hints_allowed BOOLEAN DEFAULT true,
  
  -- 결과
  total_accuracy REAL,             -- 0~100
  total_time_ms INTEGER,
  hints_used INTEGER DEFAULT 0,
  is_complete BOOLEAN DEFAULT false,
  
  -- 분석
  error_patterns JSONB,
  mistaken_words JSONB,
  
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- 받아쓰기 항목 (문장/단락별)
CREATE TABLE dictation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES dictation_sessions ON DELETE CASCADE,
  
  -- 컨텐츠
  index INTEGER NOT NULL,          -- 세션 내 순서
  expected_text TEXT NOT NULL,
  audio_url TEXT,
  start_ms INTEGER,                -- 원본 오디오 내 위치
  end_ms INTEGER,
  
  -- 결과
  user_input TEXT,
  word_results JSONB,              -- WordResult[]
  accuracy REAL,                   -- 0~100
  attempt_count INTEGER DEFAULT 0,
  hints_used INTEGER DEFAULT 0,
  time_ms INTEGER,
  
  -- 한국어 뜻
  translation TEXT,
  ipa TEXT,                        -- 발음 기호
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- 사용자 받아쓰기 통계 (집계, 캐시)
CREATE TABLE dictation_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users,
  
  total_sessions INTEGER DEFAULT 0,
  total_sentences INTEGER DEFAULT 0,
  total_time_ms BIGINT DEFAULT 0,
  
  weekly_accuracy REAL,
  monthly_accuracy REAL,
  all_time_accuracy REAL,
  
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  
  -- 가장 어려운 패턴 (top 5)
  difficult_patterns JSONB,
  
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 10-2. Indexes

```sql
CREATE INDEX dictation_sessions_user_idx ON dictation_sessions(user_id, created_at DESC);
CREATE INDEX dictation_sessions_resource_idx ON dictation_sessions(resource_id);
CREATE INDEX dictation_items_session_idx ON dictation_items(session_id, index);
```

---

## 11. 모바일 (apps/mobile) 적용

### 11-1. 핵심 차이점

```
웹 vs 모바일:
  웹: 키보드 + 마우스 + 큰 화면
  모바일: 터치 + 작은 화면 + 가상 키보드

조정 필요:
  - 가상 키보드 영역 확보 (입력 필드 위로 자동 스크롤)
  - 터치 친화적 버튼 (44×44px 최소)
  - 키보드 단축키 → 제스처로 대체
  - Audio control 큰 버튼
  - Focus Mode 자동 (가상 키보드 올라오면)
```

### 11-2. 모바일 라우트

```
apps/mobile/src/app/(main)/dictate/
├─ index.tsx                      # Hub
├─ setup/[resourceId].tsx         # Setup
├─ session/[sessionId].tsx        # Session
└─ results/[sessionId].tsx        # Results
```

### 11-3. 모바일 인터랙션 차이

```typescript
// React Native 컴포넌트 (apps/mobile)

// 키보드 단축키 → 제스처
- 좌→우 스와이프: -3초
- 우→좌 스와이프: +3초
- 더블탭: 재생/일시정지
- 핀치 줌: 글자 크기 조절

// 큰 오디오 컨트롤
const MOBILE_AUDIO_CONTROLS = {
  size: 56,          // 44px 최소 + 여유
  playButton: 72,    // 메인 버튼은 더 크게
  spacing: 16,
};

// 모바일 입력
- 자동 대문자 끄기
- 자동 완성 끄기
- 글로벌 단어 추천 끄기
- 한영 자동 전환 차단
```

---

## 12. 작업 흐름 (Step-by-Step)

### Step 1: 사이드바 메뉴 추가 (5분)

```bash
# 사이드바 컴포넌트 위치 확인
find apps/web/src -name "Sidebar*" -type f
```

찾으면 Dictation 항목 추가:
```tsx
{
  href: '/dictate',
  label: 'Dictation',
  icon: <PencilLine size={20} />,
  badge: 'NEW',
}
```

### Step 2: 폴더 구조 생성 (3분)

```bash
mkdir -p apps/web/src/app/\(app\)/dictate/setup/\[resourceId\]
mkdir -p apps/web/src/app/\(app\)/dictate/session/\[sessionId\]
mkdir -p apps/web/src/app/\(app\)/dictate/results/\[sessionId\]
mkdir -p apps/web/src/components/learning/dictation/Hub
mkdir -p apps/web/src/components/learning/dictation/Setup
mkdir -p apps/web/src/components/learning/dictation/Session
mkdir -p apps/web/src/components/learning/dictation/Results
mkdir -p apps/web/src/components/learning/dictation/shared
mkdir -p apps/web/src/hooks/dictation
mkdir -p apps/web/src/lib/dictation
```

### Step 3: 데이터 모델 + 타입 (10분)

```
✓ apps/web/src/lib/dictation/types.ts
✓ apps/web/src/lib/dictation/data.ts
✓ Supabase migration (dictation_sessions, dictation_items, dictation_stats)
```

### Step 4: 채점 + 분석 라이브러리 (20분)

```
✓ apps/web/src/lib/dictation/scoring.ts (Levenshtein + alignment)
✓ apps/web/src/lib/dictation/analyzer.ts (오류 패턴)
✓ apps/web/src/lib/dictation/audio-control.ts (TTS + 구간)
```

### Step 5: 훅 (Hook) 작성 (30분)

```
✓ useDictationSession.ts
✓ useAudioControl.ts
✓ useSegmentRepeat.ts
✓ useDictationScoring.ts
✓ useDictationHistory.ts
✓ useHintSystem.ts
```

### Step 6: HUB 화면 (30분)

```
✓ DictationHub.tsx (메인)
✓ ResourceSelector.tsx
✓ SessionHistory.tsx
✓ DictationStats.tsx
✓ /app/(app)/dictate/page.tsx
```

### Step 7: SETUP 화면 (30분)

```
✓ DictationSetup.tsx
✓ UnitSelector.tsx
✓ CountSelector.tsx
✓ OrderSelector.tsx
✓ ScoringModeSelector.tsx
✓ DifficultySelector.tsx
✓ /app/(app)/dictate/setup/[resourceId]/page.tsx
```

### Step 8: SESSION 화면 (60분 - 가장 중요)

```
✓ DictationSession.tsx (메인 컨테이너)
✓ AudioPlayer.tsx
✓ SegmentRepeater.tsx
✓ DictationInput.tsx
✓ HintSystem.tsx
✓ WordFeedback.tsx
✓ ProgressBar.tsx
✓ FocusMode.tsx
✓ /app/(app)/dictate/session/[sessionId]/page.tsx
```

### Step 9: RESULTS 화면 (30분)

```
✓ DictationResults.tsx
✓ AccuracyChart.tsx
✓ ErrorAnalysis.tsx
✓ MistakenWords.tsx
✓ NextStepRecommendation.tsx
✓ /app/(app)/dictate/results/[sessionId]/page.tsx
```

### Step 10: 모바일 (apps/mobile) (60분)

```
✓ apps/mobile/src/app/(main)/dictate/index.tsx
✓ apps/mobile/src/app/(main)/dictate/setup/[id].tsx
✓ apps/mobile/src/app/(main)/dictate/session/[id].tsx
✓ apps/mobile/src/app/(main)/dictate/results/[id].tsx
```

### Step 11: 통합 검증 (30분)

체크리스트 (모두 통과):

#### 기능 검증
- [ ] 사이드바에서 Dictation 진입
- [ ] HUB에서 라이브러리 자료 선택
- [ ] HUB에서 직접 입력 (스크립트)
- [ ] HUB에서 직접 입력 (파일 업로드)
- [ ] SETUP에서 모든 옵션 변경 가능
- [ ] 세션 시작 → 오디오 재생
- [ ] 키보드 단축키 작동 (Space, ←→, L, F, H 등)
- [ ] 입력 중 실시간 단어 피드백
- [ ] 힌트 단계별 (3단계)
- [ ] Submit 후 단어별 채점 결과
- [ ] Focus Mode 토글
- [ ] 다음 문장 자동 진행
- [ ] 결과 화면 (정확도, 시간, 패턴 분석)
- [ ] 오답 단어 SRS 추가
- [ ] 다시 도전 / 새 자료 / Hub

#### UX 검증
- [ ] 모든 화면 다크모드 대응
- [ ] 모바일 반응형 (390px / 768px / 1280px)
- [ ] 로딩 상태 표시
- [ ] 에러 상태 처리
- [ ] 접근성 (WCAG AA)

#### 학술 검증
- [ ] Spaced Dictation (구간 자동 반복)
- [ ] Phonological Loop (입력 중 음성 정지 옵션)
- [ ] Variable Reward (Smart Suggestion)
- [ ] Forgetting Curve (24h/3d/7d 알림)
- [ ] Flow State (Focus Mode)
- [ ] Active Recall (받아쓰기)
- [ ] Desirable Difficulty (자동 난이도 조정)

### Step 12: CLAUDE.md 업데이트 (10분)

다음 섹션 추가:

```markdown
## Dictation 모듈

### 학습 원리
- Spaced Dictation, Phonological Loop, Forgetting Curve
- Multimodal Learning, Active Recall, Desirable Difficulty

### 라우트
- /dictate (Hub)
- /dictate/setup/[id] (Setup)
- /dictate/session/[id] (Session)
- /dictate/results/[id] (Results)

### 주요 컴포넌트
- DictationHub, DictationSetup, DictationSession, DictationResults
- AudioPlayer, SegmentRepeater (Spaced Dictation)
- DictationInput, WordFeedback (실시간 채점)
- HintSystem (단계적 힌트, -5/-3/-10/-15점)

### 옵션
- 단위: 문장/단락/전체
- 갯수: 5/10/20/all
- 순서: 순차/랜덤/어려운것 우선
- 채점: 스마트/엄격
- 난이도: CEFR A1~C2
- 속도: 0.5~1.5x

### 키보드 단축키
- Space: 재생/일시정지
- ←→: ±3초
- Shift+←→: ±10초
- 1-5: 속도
- L: 구간 반복
- F: Focus Mode
- H: 힌트
- Enter: 제출
- Tab: 건너뛰기

### 데이터 모델
- dictation_sessions
- dictation_items
- dictation_stats
```

---

## 13. 디자인 시스템 준수 (필수)

### 13-1. 색상 (CSS Variables 우선)

```css
/* 게임/모듈 전용 색상 (받아쓰기) */
--dictation-correct: var(--success-text);
--dictation-misspelled: var(--warning-text);
--dictation-wrong: var(--error-text);
--dictation-hint: var(--info-text);
--dictation-progress: var(--p);
```

### 13-2. 폰트

```css
.dictation-text {
  font-family: var(--font-english, 'Lora'), serif;  /* 영어 본문 */
}

.dictation-input {
  font-family: var(--font-english, 'Lora'), serif;
  font-size: 1.2em;
  line-height: 1.7;
  letter-spacing: 0.01em;
}

.dictation-ipa {
  font-family: var(--font-mono, 'JetBrains Mono');
}
```

### 13-3. 간격 (4px 기반)

```css
/* 4px 기반 스케일 사용 */
.session-spacing {
  padding: var(--space-6);     /* 24px */
  gap: var(--space-4);          /* 16px */
}
```

### 13-4. 반응형

```css
/* Mobile 390px → Tablet 768px → Desktop 1280px */
.dictation-session {
  /* Mobile (default) */
  padding: var(--space-4);
  font-size: 16px;
}

@media (min-width: 768px) {
  .dictation-session {
    padding: var(--space-8);
    font-size: 18px;
  }
}

@media (min-width: 1280px) {
  .dictation-session {
    padding: var(--space-12);
    font-size: 20px;
    max-width: 1024px;
    margin: 0 auto;
  }
}
```

### 13-5. 다크모드 (필수)

```css
[data-theme='dark'] .dictation-input {
  background: var(--bg-2);
  color: var(--t1);
  border: 1px solid var(--border-strong);
}

[data-theme='dark'] .word-correct {
  background: rgba(34, 197, 94, 0.15);
  color: rgb(74, 222, 128);
}
```

### 13-6. 접근성 (WCAG AA)

```html
<!-- 모든 인터랙티브 요소 -->
<button aria-label="재생">
  <PlayIcon aria-hidden="true" />
</button>

<!-- 키보드 단축키 -->
<button onClick={...} aria-keyshortcuts="Space">
  Play (Space)
</button>

<!-- 라이브 영역 -->
<div role="status" aria-live="polite">
  {currentSentence} of {totalSentences}
</div>

<!-- 입력 필드 -->
<textarea
  aria-label="받아쓰기 입력"
  aria-describedby="hint-1 sentence-info"
  autoComplete="off"
  autoCorrect="off"
  spellCheck="false"
  inputMode="text"
/>
```

---

## 14. 절대 금지 사항

```
✗ TODO 주석
✗ placeholder 코드 (// 여기에 구현)
✗ 미완성 코드
✗ 임의 클래스명 변경 (Parts Kit)
✗ 색상 하드코딩 (게임 전용 예외 외)
✗ Inter, Roboto, Arial 폰트
✗ 검증 없이 완료 보고
✗ 학술 원리 무시
```

---

## 15. 보고 형식

작업 완료 후:

```markdown
## Dictation 모듈 구현 완료

### 추가된 파일 (35개+)
[전체 파일 목록]

### 학술 원리 적용
- ✅ Spaced Dictation (구간 자동 반복)
- ✅ Phonological Loop (입력 중 음성 정지 옵션)
- ✅ Forgetting Curve (24h/3d/7d 알림)
- ✅ Flow State (Focus Mode)
- ✅ Active Recall (단어별 채점)
- ✅ Desirable Difficulty (자동 조정)
- ✅ Variable Reward (Smart Suggestion)

### UX 검증
[캡처 첨부]
- HUB 화면
- SETUP 화면
- SESSION 화면 (Focus Mode On/Off)
- RESULTS 화면

### 키보드 단축키 검증
[모든 단축키 테스트 결과]

### 모바일 적용
[apps/mobile 캡처]

### 데이터베이스
- ✅ dictation_sessions, dictation_items, dictation_stats
- ✅ RLS 정책 적용

### CLAUDE.md 업데이트
[v06.5 패치 사항]

### 다음 단계 추천
- 자동 SRS 큐 통합
- 음성 인식 Speak Back 기능 (사용자 발음 평가)
- 그룹 받아쓰기 (Dictogloss 협업)
```

---

## 16. 시간 예산

```
Step 1 사이드바: 5분
Step 2 폴더: 3분
Step 3 데이터/타입: 10분
Step 4 라이브러리: 20분
Step 5 훅: 30분
Step 6 HUB: 30분
Step 7 SETUP: 30분
Step 8 SESSION: 60분 (가장 중요)
Step 9 RESULTS: 30분
Step 10 모바일: 60분
Step 11 검증: 30분
Step 12 CLAUDE.md: 10분

총 318분 (약 5시간 30분)
```

---

## 결론

이 모듈은 단순 받아쓰기가 아니라 **인지심리학 + 신경과학 기반의 통합 학습 시스템**입니다.

핵심 차별화:
1. **Spaced Dictation** - 학술 검증된 구간 반복
2. **단계적 힌트** - 점수 차감으로 자율성 + 도전 균형
3. **오답 패턴 분석** - 음운/형태론/구문/어휘 분류
4. **SRS 자동 통합** - 오답 → Flashcard 자동 추가
5. **Focus Mode** - Flow State 유도
6. **다중 채점 모드** - 초보부터 시험 준비까지
7. **CEFR 자동 매핑** - 적절한 도전 유지

체크리스트 모두 통과 후 캡처와 함께 보고.
"진짜 영어 학습에 도움 됨" 피드백 받을 때까지 미세 조정.
