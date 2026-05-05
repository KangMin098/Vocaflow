# Vocaflow 학습 프로세스 마스터 검토 + 재설계

> **뇌과학 + 인지심리학 + 효율성 + 디자인 4축 검토**

---

## 0. 검토 대상 (현재 프로세스)

```
[원문 입력]
    ├─ 라이브러리에서 선택
    └─ 직접 입력 (스크립트 / 파일)
         ↓
[원문 학습] (옵션)
    ├─ 듣기
    └─ 말하기
         ↓
[단어 학습] (5가지 모듈)
    ├─ 단어장 (LexiVault)
    ├─ 플래시카드 (Flashcard)
    ├─ Dictation (받아쓰기)
    ├─ SpellForge (스펠링 게임)
    └─ WordBlitz (인형뽑기 게임)
         ↓
[원문 퀴즈] (ScriptQuiz)
```

---

## 1. 학술적 분석 - 4가지 검토 축

### 1-1. 뇌과학적 검토 (Neuroscience)

#### A. 언어 처리의 뇌 영역 (Leonard et al. 2013)

```
청각 입력 (듣기)
    ↓
1차 청각 피질 (Primary Auditory Cortex) - 100ms
    ↓
음운 처리 (Phonological Processing) - 200ms
    ↓
어휘 인식 (Lexical Recognition) - 300-400ms
    ↓
의미 통합 (Semantic Integration) - 400-600ms (N400)
    ↓
구문 분석 (Syntactic Analysis) - 600-900ms
    ↓
장기 기억 (Long-term Memory) - Hippocampus → Cortex
```

#### B. 입력 vs 산출의 뇌 활성 차이 (Frontiers 2025)

```
입력 (Input - 듣기/읽기):
  - 좌측 상측두회 (Superior Temporal Gyrus)
  - 좌측 하전두회 (Inferior Frontal Gyrus - Broca's)
  - 작업 기억 ↓

산출 (Output - 말하기/쓰기):
  - 위 영역 + 우측 전두엽/측두엽
  - 작업 기억 ↑↑
  - 운동 피질 (Motor Cortex) 활성
  
→ 산출이 입력보다 더 깊은 신경 활성
→ 더 강한 기억 흔적
```

#### C. 시각-청각-운동 통합 (RHR Theory)

```
듣기만 → 청각 처리만
듣기+읽기 → 청각 + 시각 통합
듣기+읽기+쓰기 → 청각 + 시각 + 운동 통합
듣기+읽기+쓰기+말하기 → 4중 통합 ★

★ 4중 통합 = 가장 강한 기억 흔적
   (Hebbian Learning: "Neurons that fire together, wire together")
```

#### D. 망각 곡선 + 재공고화 (Ebbinghaus + Reconsolidation 2017)

```
학습 직후: 100%
20분 후:    58% (망각률 42%)
1시간 후:   44%
1일 후:     33%
1주일 후:   25%
1달 후:     21%

★ 핵심 메커니즘:
  - 단기기억 → 해마 (Hippocampus)
  - 수면 중 → 신피질 (Neocortex) 전이 = 장기기억
  - 재인출 → 재공고화 (Reconsolidation)
  - 적절한 간격 = 강화 ↑
```

#### E. 인지 부하 (Cognitive Load Theory - Sweller)

```
유형:
  1. Intrinsic Load (본질적 부하) - 학습 자료 자체의 복잡도
  2. Extraneous Load (외재적 부하) - UI/UX 디자인 부담
  3. Germane Load (효과적 부하) - 학습 처리에 사용

★ 작업 기억 한계: 4±1 chunks (Cowan 2001)
  → 한 번에 처리할 수 있는 정보 제한
  → 인지 부하 분산 필요
```

---

### 1-2. 심리학적 검토 (Psychology)

#### A. 자기결정이론 (Self-Determination Theory - Deci & Ryan)

```
3가지 심리 욕구 (지속 학습의 핵심):
  1. 자율성 (Autonomy) - 선택권
  2. 유능감 (Competence) - 성공 경험
  3. 관계성 (Relatedness) - 연결감

★ Vocaflow 적용:
  - 자율성: 학습 순서/모듈 선택권 제공
  - 유능감: 단계별 성취 표시
  - 관계성: 진열장 (인형 컬렉션) - WordBlitz
```

#### B. 흐름 (Flow Theory - Csikszentmihalyi)

```
몰입 조건:
  1. 명확한 목표
  2. 즉각 피드백
  3. 능력과 도전의 균형
  4. 행동과 의식 융합
  5. 시간 감각 왜곡

★ Vocaflow 적용:
  - SpellForge: 명확한 목표 + 즉각 피드백
  - WordBlitz: 도전 + 보상 (Variable Reward)
  - Focus Mode: 몰입 유도
```

#### C. 가치 있는 어려움 (Desirable Difficulty - Bjork)

```
역설: 어려운 학습 = 더 잘 기억됨
  → 너무 쉬우면 지나가버림
  → 적절한 어려움 = 깊은 처리

전략:
  - 분산 학습 (Spaced Practice)
  - 교차 학습 (Interleaved Practice)
  - 다양한 맥락 (Varied Context)
  - 검사 효과 (Testing Effect)
```

#### D. 능동 인출 (Active Recall - Roediger)

```
실험 결과:
  - 단순 재읽기: 재시험 정답률 55%
  - 능동 인출: 재시험 정답률 80%
  - 차이: 25% 향상

★ Vocaflow 적용:
  - Flashcard: 한국어 → 영어 인출
  - Dictation: 듣기 → 쓰기 인출
  - SpellForge: 의미 → 스펠링 인출
  - WordBlitz: 한국어 → 단어 선택
```

#### E. 변동 보상 (Variable Reward - Skinner)

```
가장 강한 학습 강화:
  - 고정 보상: 동기 ↓
  - 변동 보상: 동기 ↑↑↑ (도파민 분비 정점)

★ Vocaflow 적용:
  - WordBlitz: 랜덤 인형 색상
  - Flashcard: 랜덤 카드 순서
  - 일일 챌린지: 변동 보상
```

---

### 1-3. 효율성 검토 (Efficiency)

#### A. 80/20 법칙 (Pareto Principle)

```
영어 어휘 분포:
  - 가장 빈번한 1,000 단어 = 일상 대화 80% 커버
  - 가장 빈번한 3,000 단어 = 90% 커버
  - 가장 빈번한 8,000 단어 = 98% 커버

★ Vocaflow 함의:
  - 우선순위 어휘 학습 시스템 필요
  - 모든 단어 평등하게 학습 X
  - 빈도 + 중요도 가중치 적용
```

#### B. 분산 학습 (Spaced Practice)

```
실험 결과 (Cepeda et al. 2008):
  - 한꺼번에 5번 학습: 1주일 후 30% 기억
  - 5일에 걸쳐 학습: 1주일 후 80% 기억
  
★ 차이: 50% 효율성 차이!

최적 간격:
  - 첫 복습: 24시간 이내
  - 두 번째: 3일 후
  - 세 번째: 7일 후
  - 네 번째: 14일 후
  - 다섯 번째: 30일 후
```

#### C. SM-2 알고리즘 (Anki/SuperMemo)

```typescript
interface SM2Item {
  EF: number;          // Easiness Factor (1.3~3.0)
  interval: number;    // 다음 복습 간격 (일)
  repetitions: number; // 반복 횟수
  
  nextReview: Date;
}

// 채점 후 업데이트
function updateSM2(item, quality: 0|1|2|3|4|5) {
  if (quality < 3) {
    item.repetitions = 0;
    item.interval = 1;
  } else {
    item.repetitions++;
    if (item.repetitions === 1) item.interval = 1;
    else if (item.repetitions === 2) item.interval = 6;
    else item.interval = Math.round(item.interval * item.EF);
  }
  
  item.EF += 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  item.EF = Math.max(1.3, item.EF);
}
```

#### D. 시간 대비 효과 (Time-on-Task)

```
같은 30분 학습 시 효과 비교:
  - 영상만 시청: 기억률 10%
  - 읽기만: 기억률 20%
  - 듣기 + 읽기: 기억률 40%
  - 듣기 + 읽기 + 받아쓰기: 기억률 70%
  - 듣기 + 읽기 + 받아쓰기 + 말하기: 기억률 90%

★ 다중 모드 학습 = 시간 대비 효과 9배
```

---

### 1-4. 디자인적 검토 (Design)

#### A. Vocaflow "Quiet UI" 철학

```
원칙:
  - 메타데이터 숨김 (호버 시 표시)
  - 인지 부하 최소화
  - 단조로움 회피 (시각적 다양성)
  - 그라디언트, 그림자, 글로우 사용
```

#### B. 단계적 노출 (Progressive Disclosure)

```
신규 사용자 → 단순 UI
숙련 사용자 → 고급 옵션 노출
  ↓
초기 학습 부담 ↓
숙련도 증가에 따라 자율성 ↑
```

#### C. 게이미피케이션 (Gamification)

```
효과적 요소:
  ✓ 진행률 표시 (Progress Bar)
  ✓ 성취 (Achievements)
  ✓ 컬렉션 (Collection)
  ✓ 레벨업 (Leveling)
  ✓ 변동 보상 (Variable Reward)
  ✓ 사회적 비교 (Leaderboard) - 옵션
```

---

## 2. 현재 프로세스 진단 - 문제점

### 2-1. 중복/비효율 부분

#### 🔴 문제 1: 단어 학습 모듈 5개 - 역할 중복

```
현재 구성:
  ├─ 단어장 (LexiVault)        - 단어 + 의미
  ├─ 플래시카드 (Flashcard)     - 단어 → 의미 인출
  ├─ Dictation (받아쓰기)       - 듣기 → 쓰기
  ├─ SpellForge (스펠링)        - 단어 스펠링
  └─ WordBlitz (단어 선택)      - 한국어 → 단어 선택

⚠️ 중복:
  - Flashcard ≈ WordBlitz (한국어 → 영어 인출)
  - SpellForge ≈ Dictation (단어 단위)
  
⚠️ 누락:
  - 발음 (Pronunciation)
  - 문맥 사용 (Contextual Usage)
  - 콜로케이션 (Collocation)
```

#### 🔴 문제 2: 학습 순서 불명확

```
현재: 모듈 순서 사용자 자율 선택
문제: 
  - 신규 학습자: 어디서 시작할지 모름
  - 학술 근거 없는 자유 순서
  - 최적 효과 보장 X
```

#### 🔴 문제 3: 모듈 간 단절

```
현재: 각 모듈 독립 작동
문제:
  - 학습 진행 상태 공유 X
  - 모듈 간 데이터 흐름 없음
  - "전체 학습 진척도" 측정 어려움
```

#### 🔴 문제 4: 원문 ↔ 단어 학습 단절

```
현재: 원문 → 단어 추출 → 학습
문제:
  - 단어를 원문 문맥에서 분리
  - 이미 알던 단어도 다시 학습
  - 어려운 단어 우선순위 X
```

### 2-2. 누락된 학습 단계

```
❌ 단계 1: 사전 평가 (Pre-Assessment)
   → 현재 알고 있는 단어 vs 모르는 단어 분류
   → 학습 목표 설정 (목표 어휘 수)

❌ 단계 2: 발음 학습 (Pronunciation)
   → 음성 인식 (Speak Back)
   → IPA 학습
   → 액센트 (강세) 인식

❌ 단계 3: 문맥 학습 (Contextual Usage)
   → 단어가 실제 어떻게 쓰이는지
   → 콜로케이션 (with whom)
   → 동의어/반의어

❌ 단계 4: 산출 (Production)
   → 작문 (Writing)
   → 말하기 (Speaking)

❌ 단계 5: 자동 복습 (Auto Review)
   → 망각 곡선 기반 자동 알림
   → 모듈 통합 SRS
```

---

## 3. 재설계 - 최적 학습 프로세스

### 3-1. 기존 프로세스 → 신규 프로세스 (CASCADE Model)

```
기존 (선형):
  원문 → 듣기/말하기 → 단어학습 → 퀴즈

신규 CASCADE (계단식):
  
  Phase 1: ASSESS (평가)
    ├─ 사전 평가 (이미 아는 단어 vs 새 단어)
    └─ 학습 목표 설정
  
  Phase 2: ENCODE (입력)
    ├─ 청각 입력 (듣기) - 의미 짐작
    ├─ 시각 입력 (읽기) - 의미 확정
    └─ 다중 감각 통합
  
  Phase 3: ELABORATE (정교화)
    ├─ 단어 의미 (Meaning)
    ├─ 발음 (Pronunciation)
    ├─ 문맥 (Context)
    └─ 연결 (Linking - 기존 지식과)
  
  Phase 4: RETRIEVE (인출)
    ├─ Active Recall (Flashcard 변형)
    ├─ Spelling (SpellForge)
    ├─ Dictation (받아쓰기)
    └─ Production (말하기/쓰기)
  
  Phase 5: APPLY (적용)
    ├─ 원문 퀴즈 (ScriptQuiz)
    ├─ 새 문장 만들기
    └─ 실전 응용
  
  Phase 6: REVIEW (자동 복습)
    ├─ 망각 곡선 기반 알림
    ├─ SRS 알고리즘
    └─ 통합 SRS 큐
```

### 3-2. 학술 근거

```
Phase 1 ASSESS - Krashen i+1 가설
  → 적절한 도전 영역 (ZPD - Vygotsky)

Phase 2 ENCODE - Dual Coding Theory (Paivio)
  → 시각 + 청각 동시 인코딩 = 기억 강화

Phase 3 ELABORATE - Levels of Processing (Craik & Lockhart)
  → 깊은 처리 = 강한 기억

Phase 4 RETRIEVE - Testing Effect (Roediger)
  → 인출 행위 자체가 학습

Phase 5 APPLY - Transfer-Appropriate Processing
  → 학습한 맥락 = 활용할 맥락

Phase 6 REVIEW - Forgetting Curve (Ebbinghaus)
  → 적정 간격 복습 = 영구 기억
```

---

## 4. 모듈 재배치 + 역할 명확화

### 4-1. 단계별 모듈 매핑

```
Phase 1: ASSESS
  └─ 신규 모듈: WordCheck (사전 평가)
     - 빠른 단어 체크 (10초/단어)
     - 알고 있음 / 모름 / 헷갈림 분류
     - 학습 우선순위 자동 결정

Phase 2: ENCODE
  ├─ 듣기 (Listen) - 원문 청각 입력
  ├─ 읽기 (Read) - 원문 시각 입력
  └─ 단어장 (LexiVault) - 단어+의미 첫 노출

Phase 3: ELABORATE
  └─ 단어장 확장 (LexiVault Plus)
     - 발음 (IPA + TTS)
     - 예문 (다양한 맥락)
     - 동의어/반의어
     - 콜로케이션
     - 어원 (가능한 경우)

Phase 4: RETRIEVE (4가지 인출 방식)
  ├─ Flashcard (의미 인출)
  ├─ SpellForge (스펠링 인출)
  ├─ Dictation (듣기→쓰기 인출)
  └─ WordBlitz (선택 인출 - 게임)

Phase 5: APPLY
  ├─ ScriptQuiz (원문 퀴즈)
  └─ 신규: WriteCraft (작문)
     - 학습한 단어로 문장 만들기
     - AI 첨삭 (OpenAI)

Phase 6: REVIEW
  └─ 신규: AutoReview (자동 복습 시스템)
     - 모든 모듈 통합 SRS
     - 망각 곡선 기반 알림
     - 우선순위 큐
```

### 4-2. 모듈 역할 명확화 + 중복 제거

#### 🔧 변경 1: WordBlitz → 인출 강화 게임

```
이전: 한국어 → 영어 선택 (Flashcard와 중복)
변경: 다양한 인출 방식 (게임화)
  - 한국어 → 영어 (기본)
  - 영어 → 한국어
  - 발음 → 단어 (듣고 선택)
  - 정의 → 단어 (영영)
  - 콜로케이션 → 단어
  
역할: Flashcard의 게임 버전 (동기 부여)
      어려운 단어 빠른 재노출
```

#### 🔧 변경 2: SpellForge → Dictation 단어 단위

```
이전: 단어 스펠링 게임 (Dictation과 부분 중복)
변경: Dictation의 단어 단위 모드
  - Dictation: 문장/단락/전체
  - SpellForge: 단어 단위 (Dictation의 하위 모드)

또는 SpellForge 폐지하고 Dictation에 통합
```

#### 🔧 변경 3: Flashcard → 다중 인출 카드

```
이전: 단순 카드 뒤집기
변경: 다양한 인출 방식
  - 의미 인출 (한 → 영)
  - 발음 인출 (영 → 발음)
  - 문맥 인출 (예문 → 단어)
  - 정의 인출 (정의 → 단어)
  
+ SM-2 알고리즘 강화
```

---

## 5. 자동 암기/장기 기억 시스템 설계

### 5-1. 통합 SRS (Spaced Repetition System)

```typescript
// apps/web/src/lib/srs/integrated-srs.ts

interface VocaflowSRSItem {
  // 기본
  id: string;
  word: string;
  meaning: string;
  resourceId: string;        // 원문 ID
  resourceTitle: string;     // 원문 제목
  
  // SM-2 알고리즘
  EF: number;                // 1.3 ~ 3.0
  interval: number;          // 다음 복습 간격 (일)
  repetitions: number;       // 반복 횟수
  lastReviewed: Date;
  nextReview: Date;
  
  // 다양한 학습 차원의 정확도
  retention: {
    meaning: number;         // 의미 인출 (0~1)
    spelling: number;        // 스펠링 (0~1)
    pronunciation: number;   // 발음 (0~1)
    listening: number;       // 듣기 (0~1)
    context: number;         // 문맥 (0~1)
    production: number;      // 산출 (0~1)
  };
  
  // 모듈별 학습 이력
  history: {
    module: 'flashcard' | 'spellforge' | 'wordblitz' | 'dictation' | 'scriptquiz';
    timestamp: Date;
    correct: boolean;
    duration: number;        // ms
    confidence: number;      // 0~1 (사용자 자기 평가)
  }[];
  
  // 메타데이터
  difficulty: 'easy' | 'medium' | 'hard';  // 자동 계산
  priority: number;          // 0~100 (학습 우선순위)
  cefrLevel: 'A1'|'A2'|'B1'|'B2'|'C1'|'C2';
  frequency: number;         // 영어 빈도 순위
  
  // 자동화 트리거
  isStable: boolean;         // 30일 이상 정확도 90%+ → 안정
  needsReview: boolean;      // nextReview <= now
  isBlocked: boolean;        // 자주 오답 → 우선 학습
}
```

### 5-2. 자동 암기 흐름

```typescript
// apps/web/src/lib/srs/auto-memorization.ts

class AutoMemorizationEngine {
  
  // 1. 학습 후 자동 SRS 추가
  async onLearningComplete(
    word: string,
    module: ModuleName,
    quality: 0|1|2|3|4|5,  // 0=완전 잊음, 5=완벽
    duration: number
  ) {
    const item = await this.getOrCreateSRSItem(word);
    
    // 모듈별 차원 업데이트
    item.retention[this.getDimension(module)] = quality / 5;
    
    // 이력 추가
    item.history.push({
      module, 
      timestamp: new Date(),
      correct: quality >= 3,
      duration,
      confidence: quality / 5,
    });
    
    // SM-2 업데이트
    this.updateSM2(item, quality);
    
    // 우선순위 계산
    item.priority = this.calculatePriority(item);
    
    // 안정 여부 판단
    item.isStable = this.checkStability(item);
    
    await this.save(item);
    
    // 트리거: 자동 알림 예약
    if (item.needsReview) {
      this.scheduleNotification(item);
    }
  }
  
  // 2. 우선순위 계산 (가장 중요)
  calculatePriority(item: VocaflowSRSItem): number {
    let priority = 50;  // 기본값
    
    // 인출 정확도 평균
    const avgRetention = Object.values(item.retention)
      .reduce((sum, v) => sum + v, 0) / 6;
    
    // 정확도 낮음 → 우선순위 ↑
    priority += (1 - avgRetention) * 30;
    
    // 다음 복습 임박 → 우선순위 ↑
    const daysUntilReview = differenceInDays(item.nextReview, new Date());
    if (daysUntilReview <= 0) priority += 20;
    else priority -= daysUntilReview * 2;
    
    // 빈도 높은 단어 → 우선순위 ↑
    if (item.frequency < 1000) priority += 15;
    else if (item.frequency < 3000) priority += 10;
    else if (item.frequency < 8000) priority += 5;
    
    // 어려운 단어 → 우선순위 ↑
    if (item.difficulty === 'hard') priority += 10;
    
    // 자주 오답 → 우선순위 ↑↑
    const recentWrongs = item.history
      .filter(h => isRecent(h.timestamp, 7))  // 최근 7일
      .filter(h => !h.correct).length;
    priority += recentWrongs * 5;
    
    return Math.min(100, Math.max(0, priority));
  }
  
  // 3. 안정성 판단 (장기 기억 진입)
  checkStability(item: VocaflowSRSItem): boolean {
    // 30일 이상 학습 + 정확도 90%+ → 안정
    if (item.repetitions < 5) return false;
    
    const recentHistory = item.history.filter(h => isRecent(h.timestamp, 30));
    if (recentHistory.length < 3) return false;
    
    const accuracy = recentHistory.filter(h => h.correct).length / recentHistory.length;
    
    if (accuracy >= 0.9 && item.interval >= 30) {
      // 장기 기억 진입 표시
      return true;
    }
    
    return false;
  }
  
  // 4. 망각 알림 (자동)
  async scheduleNotification(item: VocaflowSRSItem) {
    const now = new Date();
    
    // 망각 곡선 기반 알림 시점
    const notificationTimes = [
      addHours(item.lastReviewed, 24),    // 1일 후
      addDays(item.lastReviewed, 3),       // 3일 후
      addDays(item.lastReviewed, 7),       // 1주일 후
      addDays(item.lastReviewed, 14),      // 2주일 후
      addDays(item.lastReviewed, 30),      // 1달 후
    ];
    
    // 다음 알림 시점 예약
    for (const time of notificationTimes) {
      if (time > now) {
        await this.scheduleNotification({
          time,
          title: `복습: ${item.word}`,
          body: `${item.meaning}을(를) 다시 떠올려보세요`,
          itemId: item.id,
        });
        break;
      }
    }
  }
  
  // 5. 일일 학습 큐 생성
  async generateDailyQueue(userId: string): Promise<LearningQueue> {
    const items = await this.getAllItems(userId);
    
    // 카테고리별 분류
    const overdue = items.filter(i => i.nextReview <= new Date());
    const dueToday = items.filter(i => isSameDay(i.nextReview, new Date()));
    const upcoming = items.filter(i => isWithinDays(i.nextReview, 3));
    const stable = items.filter(i => i.isStable);
    
    // 우선순위 정렬
    const queue = [
      ...overdue.sort((a, b) => b.priority - a.priority),
      ...dueToday.sort((a, b) => b.priority - a.priority),
      ...upcoming.slice(0, 5),
    ].slice(0, 30);  // 일일 30개 제한
    
    return {
      items: queue,
      stats: {
        overdue: overdue.length,
        dueToday: dueToday.length,
        upcoming: upcoming.length,
        stable: stable.length,
      },
      estimatedTime: queue.length * 30,  // 단어당 30초 추정
    };
  }
}
```

### 5-3. 5단계 자동 암기 시스템

```
Stage 1: 학습 (Learning)
  - 첫 노출 ~ 24시간 이내
  - 모든 모듈 사용
  - 빈번한 노출 (3회 이상)
  → 단기 기억 → 작업 기억

Stage 2: 강화 (Reinforcement)
  - 1일 ~ 7일
  - 다양한 모듈로 인출 연습
  - SRS 알고리즘 시작
  → 작업 기억 → 단기 기억

Stage 3: 통합 (Consolidation)
  - 1주 ~ 1달
  - 간격 늘려서 복습
  - 문맥 다양화
  → 단기 기억 → 중기 기억

Stage 4: 안정화 (Stabilization)
  - 1달 ~ 6달
  - 드문드문 복습
  - 응용 (작문, 말하기)
  → 중기 기억 → 장기 기억

Stage 5: 마스터 (Mastery)
  - 6달 이상
  - 자동 복습 거의 X
  - 자연 노출 시 재활성
  → 영구 기억 (Permanent Memory)
```

### 5-4. 시각적 진척도 (사용자 피드백)

```
HUD 표시:
  - 학습 중 단어: 142개
  - 강화 중: 67개
  - 통합 중: 89개
  - 안정 중: 34개
  - 마스터: 12개 ⭐

모듈별:
  Flashcard:    [█████████▒] 92%
  SpellForge:   [████████▒▒] 85%
  Dictation:    [██████▒▒▒▒] 67%
  WordBlitz:    [████████▒▒] 80%
  ScriptQuiz:   [█████▒▒▒▒▒] 56%

차원별 정확도:
  의미:    ████████████ 92%
  스펠링:  ██████████▒▒ 85%
  발음:    ████████▒▒▒▒ 73%
  듣기:    ██████▒▒▒▒▒▒ 56% ★ 보강 필요
  문맥:    ███████▒▒▒▒▒ 64%
  산출:    ███▒▒▒▒▒▒▒▒▒ 28% ★ 약점
```

---

## 6. UX 흐름 - 자동 학습 진행

### 6-1. 신규 사용자 진입 (Onboarding)

```
1. 영어 레벨 테스트 (3분)
   → CEFR 자동 판정 (A1~C2)

2. 학습 목표 설정
   → 일일 목표 시간 (15분 / 30분 / 1시간)
   → 핵심 어휘 목표 (1,000 / 3,000 / 8,000)
   → 시험 목표 (TOEIC, IELTS, 또는 일반)

3. 첫 자료 선택
   → AI 추천 (레벨에 맞는 자료)
   → 또는 직접 선택

4. 학습 흐름 안내
   → CASCADE 6단계 시각화
   → 첫 단계 자동 시작
```

### 6-2. 일일 사용 흐름

```
Day 1 (월요일)
  09:00 알림: "오늘의 학습 (15분)"
   ↓
  앱 진입 → 일일 큐 표시
   ↓
  [복습 우선] 어제 학습한 12개 단어
    └ 모두 통과 → 다음
   ↓
  [학습 진행 중] 67개 → 오늘 5개 추가
    ├─ 듣기 (Listen)
    ├─ 읽기 (Read)
    ├─ Flashcard (의미 인출)
    └─ Dictation (듣기 → 쓰기)
   ↓
  [신규] 오늘 새 자료 (AI 추천)
    └ 새 단어 8개 추가
   ↓
  완료 → 통계 + 내일 미리보기

Day 2 (화요일)
  09:00 알림: "어제 단어 12개 + 1일 전 단어 8개 = 20개"
   ↓
  반복...

★ 7일 사이클로 망각 곡선 통제
```

### 6-3. 위클리 사이클

```
월: 신규 단어 + 어제 복습
화: 신규 단어 + 어제 + 그제 복습
수: 신규 단어 + 1일/3일 복습
목: 신규 단어 + 1일 복습
금: 신규 단어 + 1일/3일 복습
토: 약점 보강 (가장 어려운 단어)
일: 주간 리뷰 (전체 통계)
```

---

## 7. 디자인 시스템 통합

### 7-1. 모듈 간 디자인 일관성

```
모든 모듈 공통:
  ✓ 동일 폰트 시스템 (Lora, Plus Jakarta Sans)
  ✓ 동일 색상 시스템 (CSS Variables)
  ✓ 동일 진행률 표시 (Progress)
  ✓ 동일 결과 토스트
  ✓ 동일 키보드 단축키 (가능한 한)
  ✓ 동일 다크모드 대응
```

### 7-2. 학습 진척 시각화 (대시보드)

```
홈 화면 (Dashboard):
  
  ┌────────────────────────────────────┐
  │  오늘의 진척도                       │
  │  ████████░░ 82%   목표 15분 중 12분  │
  └────────────────────────────────────┘
  
  ┌─────────────┬──────────────┬───────┐
  │ 학습 중      │ 안정 중       │ 마스터  │
  │ 142개       │ 34개         │ 12 ⭐  │
  └─────────────┴──────────────┴───────┘
  
  ┌────────────────────────────────────┐
  │  📊 차원별 정확도                    │
  │  의미    ████████████ 92%           │
  │  스펠링   ██████████░░ 85%           │
  │  발음    ████████░░░░ 73% ⚠         │
  │  듣기    ██████░░░░░░ 56% ⚠⚠        │
  └────────────────────────────────────┘
  
  ┌────────────────────────────────────┐
  │  🎯 추천: 오늘 듣기 강화하세요         │
  │  [Dictation 시작]                   │
  └────────────────────────────────────┘
```

---

## 8. 종합 결론 - 새 프로세스

### 8-1. 핵심 변화

```
이전: 모듈 자유 선택 + 단편적 학습
신규: CASCADE 6단계 + 자동 진행

기존 모듈 5개 → 역할 명확화:
  - WordBlitz: Flashcard 게임 버전 (인출 강화)
  - SpellForge: Dictation 단어 모드로 통합
  - 신규: WordCheck (사전 평가)
  - 신규: WriteCraft (작문 산출)
  - 신규: AutoReview (자동 복습)
```

### 8-2. 학술 근거 매핑

```
Phase 1 ASSESS - Krashen i+1 + Vygotsky ZPD
Phase 2 ENCODE - Dual Coding (Paivio)
Phase 3 ELABORATE - Levels of Processing (Craik)
Phase 4 RETRIEVE - Testing Effect (Roediger)
Phase 5 APPLY - Transfer-Appropriate (Morris)
Phase 6 REVIEW - Forgetting Curve (Ebbinghaus)
```

### 8-3. 자동 암기 시스템

```
✓ 통합 SRS (모든 모듈 데이터 통합)
✓ 6차원 정확도 추적 (의미/스펠링/발음/듣기/문맥/산출)
✓ 5단계 메모리 진화 (학습→강화→통합→안정→마스터)
✓ 자동 알림 (망각 곡선 기반)
✓ 우선순위 큐 (어려운 단어 우선)
✓ 시각적 진척도 (사용자 동기 부여)
```

### 8-4. 기대 효과

```
학습 효율:
  - 시간 대비 효과 9배 (다중 모드)
  - 망각률 50% 감소 (분산 학습)
  - 장기 기억 전이율 80%+ (자동 복습)

사용자 경험:
  - 자동화로 부담 감소
  - 명확한 진척도 → 동기 유지
  - 게임화 + 학술 깊이 균형

차별화:
  - 단순 단어장 X
  - 학술 검증 통합 시스템
  - "진짜 영어 실력 향상" 약속
```

---

## 9. 다음 단계 제안

### 9-1. 우선순위

```
1순위 (가장 중요):
  ✓ 통합 SRS 시스템 구축 (lib/srs/integrated-srs.ts)
  ✓ 모듈 간 데이터 통합
  ✓ 자동 알림 시스템

2순위:
  ✓ WordCheck 모듈 (사전 평가)
  ✓ AutoReview 모듈 (자동 복습)
  ✓ 통합 대시보드 (6차원 정확도)

3순위:
  ✓ WriteCraft 모듈 (작문 + AI 첨삭)
  ✓ 음성 인식 (발음 평가)
  ✓ 사회적 기능 (선택)
```

### 9-2. 마이그레이션 계획

```
Step 1: 데이터 모델 정비
  - 통합 SRS 테이블 (Supabase)
  - 모듈별 데이터 통합 마이그레이션

Step 2: 모듈 역할 재정의
  - WordBlitz: 게임 인출 명확화
  - SpellForge → Dictation 통합
  - 또는 SpellForge 폐지

Step 3: 신규 모듈 추가
  - WordCheck
  - AutoReview
  - WriteCraft

Step 4: UX 통합
  - CASCADE 흐름 시각화
  - 자동 학습 큐
  - 통합 대시보드

Step 5: 검증
  - A/B 테스트
  - 학습 효과 측정
  - 사용자 피드백
```

---

## 10. CLAUDE.md 업데이트 사항

```markdown
## Vocaflow 학습 프로세스 (CASCADE Model)

### 6단계 학습 흐름
1. ASSESS - 사전 평가 (WordCheck)
2. ENCODE - 입력 (Listen + Read + LexiVault)
3. ELABORATE - 정교화 (LexiVault Plus)
4. RETRIEVE - 인출 (Flashcard, SpellForge, Dictation, WordBlitz)
5. APPLY - 적용 (ScriptQuiz, WriteCraft)
6. REVIEW - 자동 복습 (AutoReview)

### 통합 SRS
- 6차원 정확도 추적
- 5단계 메모리 진화
- 자동 알림 (망각 곡선)
- 우선순위 큐

### 학술 근거
- Krashen, Vygotsky, Paivio, Craik, Roediger, Ebbinghaus
- Bjork (Desirable Difficulty)
- Csikszentmihalyi (Flow)
- Deci & Ryan (SDT)
```

---

## 결론

현재 Vocaflow는 좋은 모듈들을 갖췄지만 **모듈 간 통합 부족** + **자동 암기 시스템 부재**가 가장 큰 약점입니다.

핵심 개선:
1. **CASCADE 6단계** 명확한 흐름
2. **통합 SRS** 모든 모듈 데이터 통합
3. **6차원 정확도** 약점 자동 감지
4. **5단계 메모리 진화** 자동 장기 기억
5. **자동 알림** 망각 곡선 기반

이 시스템을 구축하면 사용자는:
- 무엇을 학습할지 고민 X
- 어디까지 진행했는지 명확
- 자동으로 장기 기억 진입
- "진짜 영어 실력 향상" 체감

이게 Vocaflow의 차별화 핵심이 될 것입니다.
