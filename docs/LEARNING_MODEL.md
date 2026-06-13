# Learning Model v3.2

> Vocaflow 학습 모델 — 9 모듈을 하나의 흐름으로 묶는 메타-모델. 7원칙 + 4철학이 어디서 어떻게 작동하는지의 단일 진실 소스.
> 작성 시점: 2026-06-08 (v06.34).
>
> 새 학습 기능은 **이 모델의 어느 계층/축에 속하는가**를 먼저 답한 뒤 설계.

---

## 7축 구조

```
[1] 흐름 축      L0 발견 → L1 획득 → L2 이해 → L3 부호화
                 → L4a 재인 → L4b 시각생성 → L4c 청각생성 → L4d 통합검증
                 → L5 정복 → L6 완성 → L7 회고
[2] 상태 축      단어(D/S/R 3변수 → 4색) + 스크립트(4단계) + 사용자(Cold/Warm/Hot)
[3] 추천 축      자율 70% / 시스템 제안 30% — SDT 자율성 보존
[4] 기억 축      FSRS 호환 — Difficulty · Stability · Retrievability
[5] 동기 축      SDT(자율성·유능감·관계성) × 사용자 단계 매트릭스
[6] 인지 축      Blocked → Hybrid → Interleaved 자동 전환 (단어 Stability 기반)
[7] 데이터 축    texts · vocabularies · learning_records · scores + user_stats
```

---

## [1] 흐름 축 — 9계층 (v3.2)

> **설계 원칙**: 인지 부하 순서 = 계층 순서. 낮은 부하(수동 이해)에서 높은 부하(통합 생성)로.

| 계층 | 라우트 | 사용자 행위 | 인지 유형 | 출력 |
|---|---|---|---|---|
| **L0 Discover** | `/library/books` `/library/vocab` | 큐레이션 카드 탐색 · 도서 선택 결정 | 수동 탐색 | 진입 결정 |
| **L1 Acquire** | `/text` 허브 + `/text/new` | 스크립트 확정 + CEFR 자동감지 + 자기 자산 누적 | 수동 획득 | `texts` 1건 (또는 `user_book_group_id` 그룹) |
| **L2 Comprehend** | `/text/[id]` (Workspace) | 청취 · 통독 · 단어 hover | 수동→능동 전환 | 이해도 마커 |
| **L3 Encode** | `/wordvault` 허브 + `/wordvault/browse` | Memory Decay 4색 자산 시각화 + 풀스크린 세션 | 능동 부호화 | `vocabularies` N건 (state=new) |
| **L4a Recognize (재인)** | `/flashcard` · `/wordblitz` · `/pairflip` | 단어 보기 → 아는지 판단 | Recognition | `learning_records` |
| **L4b Generate-Visual (시각 생성)** | `/spellforge` | 뜻 → 철자 직접 생성 (시각+운동) | Generation | `learning_records` |
| **L4c Generate-Auditory (청각 생성)** | `/text/[id]/echo` | TTS → 발화 (Shadow Reading) | Generation + Production | `echo_match_attempts` |
| **L5 Conquer (정복 · 의미 통합)** | `/scriptquiz` | 스크립트 맥락 4지선다 — 텍스트 단위 검증 | Recognition + Transfer | `scores` + 텍스트 정복 |
| **L6 Complete (완성 · 다중 채널 재생산)** | `/dictate` | TTS 청취 → 받아쓰기 (음운+의미+문법+철자) | Free Recall + Production | `learning_records` + 텍스트 완성 |
| **L7 Reflect (회고)** | `/hub` · `/dashboard` | 메타인지 + 다음 제안 수신 | 메타인지 | 다음 사이클 진입점 |

### L4 4 Sub-layers (인지 채널 분리)

| 계층 | 모듈 | 단서 | 응답 | 뇌과학 | 감각 채널 | 적합 단어 상태 |
|---|---|---|---|---|---|---|
| L4a | Flashcard | 단어 1개 (시각) | 자가 판정 | 패턴 완성 · 메타인지 | 시각 | new → shaky |
| L4a | WordBlitz | 4지선다 | 클릭/탭 (속도) | 자동화 형성 · 각성↑ | 시각+시간압박 | shaky → stable 가속 |
| L4a | PairFlip | 카드 한쪽 | 짝 카드 위치 식별·클릭 | 재인 + 공간 기억 + 매칭 인지 | 시각+공간 | new → shaky / shaky → stable |
| L4b | SpellForge | 뜻 + 첫 글자 | 타이핑 (시각 생성) | 운동 부호화 · Generation Effect | 시각+운동 | shaky → stable 검증 |
| L4c | EchoMatch | TTS 청취 | 발화 (청각 생성) | Triple Coding · Phonological Loop | 청각+발성 | shaky 견고화 |
| L4d (= L5) | ScriptQuiz | 스크립트 맥락 전체 | 4지선다 | 의미망 + 에피소드 통합 | 시각+맥락 | stable → 텍스트 정복 |

### v3.2 변경 (v06.13)
- **Dictation 을 L6 Complete (텍스트 단위 다중 채널 재생산)** 로 격상
- ScriptQuiz 를 **L5 Conquer (텍스트 단위 의미 통합)** 로 재배치

근거: Dictation 은 4지선다 인식이 아닌 자유 재생산 (Free Recall + Production), 음운+의미+문법+철자를 동시 검증하는 통합 행위 — 학습의 정점.

---

## [2] 상태 축 — 3중 상태 모델

### 단어 상태 — FSRS 3변수 → 4색

| 변수 | 범위 | 의미 | UI |
|---|---|---|---|
| **Difficulty (D)** | 1.0~10.0 | 단어 자체 난이도 (mean reversion 으로 ease hell 방지) | 표시 안함 |
| **Stability (S)** | 일 단위 | 100%→90% 감쇠까지의 일수 | 표시 안함 |
| **Retrievability (R)** | 0.0~1.0 | 현재 시점 회상 확률 = `exp(ln(0.9) × t / S)` | **4색으로 변환** |

#### 4색 매핑 규칙

```
신규 등록(D/S 미부여)  → new      #94A3B8 (회색)
R ≥ 0.95              → stable   #22C55E (초록)
0.70 ≤ R < 0.95       → shaky    #F59E0B (주황)
R < 0.70              → risk     #EF4444 (빨강)
```

→ 사용자에게는 **여전히 4색만** 노출 (Progressive Disclosure), 백엔드는 더 정확한 스케줄링.

### 스크립트 상태 — 4단계

```
미시작 → 듣는 중(progress > 0) → 단어 추출 완료(wordvault_done) → 정복(quiz + dictation 통과)
```

### 사용자 상태 — 3단계

| 단계 | 조건 | 학습 전략 |
|---|---|---|
| **Cold** | 등록 7일 이내 OR 단어 < 50개 | Blocked 강제 · 한 텍스트 정복 권장 |
| **Warm** | 단어 50~500개 OR Streak 7~30일 | Blocked → Interleaved 점진 전환 |
| **Hot** | 단어 500개+ OR Streak 30일+ | Full Interleaved · 다중 텍스트 병행 |

→ Hub 진입 시 `user_stats.mastery_level` 1쿼리로 분기.

---

## [3] 추천 축 — 자율 70% / 제안 30%

**자기결정성 이론(SDT) 정합** — 자율성 박탈은 동기 파괴이므로 시스템 제안은 30% 제한.

### 제안 위치 (정확히 3곳만)

1. **Hub Today CTA** — 1개 제안 (수락/무시 자유)
2. **FloatingSparkle** (워크스페이스) — 1개 제안 (자동 재출현 X)
3. **세션 종료 직후** "다음 추천" — 1개 제안 (Reflect 단계)

### 자율 영역

- ModuleCard 9개 항상 동등 노출
- Library 카드는 큐레이션 순서만 영향, 차단 X
- Settings 에서 "추천 끄기" 가능 (Hot 사용자 default)

### 추천 엔진 의사코드

```typescript
// apps/web/src/lib/recommend/next-action.ts

function getNextBestAction(userId: string, userStats: UserStats): Action {
  // P1. 회상 위급 (R < 0.6) — 격려형 라벨로만 표시
  const urgentWords = await getWordsByRetrievability(userId, { lt: 0.6 });
  if (urgentWords.length >= 3) {
    return {
      module: 'flashcard',
      queue: urgentWords,
      strategy: 'blocked',
      label: `오늘 ${urgentWords.length}개를 다시 만나보세요`
    };
  }

  // P2. 진행 중 스크립트 (Context-Dependent 보존)
  const lastText = await getLastOpenedText(userId);
  if (lastText && lastText.progress_percent < 100) {
    return { module: 'workspace', textId: lastText.id, label: `${lastText.title} 이어 듣기` };
  }

  // P3. 사용자 단계별 분기
  switch (userStats.mastery_level) {
    case 'cold':
      const newWords = await getWordsByState(userId, 'new');
      if (newWords.length >= 5) return {
        module: 'flashcard', queue: newWords.slice(0, 10),
        strategy: 'blocked', label: '오늘 10개 단어를 만나볼까요?'
      };
      break;
    case 'warm':
      const noDictation = await getShakyWordsWithoutModule(userId, 'dictation');
      if (noDictation.length >= 5) return {
        module: 'dictation', unit: 'sentence', queue: noDictation,
        strategy: 'hybrid', label: '귀로 익혀볼 시간이에요'
      };
      break;
    case 'hot':
      const stableTexts = await getTextsReadyForQuiz(userId);
      if (stableTexts.length >= 1) return {
        module: 'scriptquiz', textId: stableTexts[0].id,
        strategy: 'interleaved', label: '스크립트 전체를 점검해볼까요?'
      };
      break;
  }

  // P4. Cold start
  return { module: 'library', label: '새 스크립트을 만나보세요' };
}
```

---

## [4] 기억 축 — FSRS 호환

### 핵심 수식

```
회상 확률:         R(t) = exp(ln(0.9) × t / S)
성공 후 Stability: S_new = S × (1 + α × (D-1) × ...)
실패 후 Stability: S_new = S_failed × R^β
Difficulty 회귀:   D_new = w × D_old + (1-w) × D_baseline    -- ease hell 방지
```

### 구현

- **`ts-fsrs` npm 패키지 채택** — 직접 구현 금지 (Anki 23.10+ 검증)
- 위치: `apps/web/src/lib/srs/fsrs.ts` + `lib/srs/state.ts` (R→4색) + `packages/ui-shared/src/srs/` (웹·앱 공유)
- 기존 `lib/srs/sm2.ts` 인터페이스는 wrapper 로 유지

### 한국 학습자 특화 초기 파라미터

| 파라미터 | FSRS 표준 | Vocaflow 초기값 | 근거 |
|---|---|---|---|
| Target Retention | 0.90 | **0.85** | 한국 학습자 평균 학습 시간 부족 |
| Initial Difficulty | 5.0 | **6.0** | 외국어 처리 어려움 |
| Maximum Interval | 36500일 | **365일** | 1년 이상 무의미 |
| Learning Steps | [1m, 10m] | **[1d, 3d]** | 게임 세션 단위 |

→ 출시 후 review 1,000건 누적 시 `fsrs-optimizer` 로 사용자별 자동 재최적화.

---

## [5] 동기 축 — SDT × 사용자 단계 매트릭스

### SDT 3요소

| SDT | Cold | Warm | Hot |
|---|---|---|---|
| **자율성** | "스크립트 자유 선택" 강조 · Library 큐레이션 노출 | 학습 모듈 자유 조합 | 다중 텍스트 병행 + 추천 OFF 옵션 |
| **유능감** | Streak 1일도 시각화 · Memory Decay 첫 변화 강조 | 50/100/500 단어 마일스톤 (차분히) | mastery 그래프 · 자기 통계 비교 |
| **관계성** | 격려 카피 ("좋은 시작이에요") | 학습 회고 ("3주째 함께해요") | (Phase 2) 친구 Streak 비교 옵션 |

### 보상 장치 4종 — 작동 시점

| 장치 | Cold | Warm | Hot | 안티패턴 회피 |
|---|:---:|:---:|:---:|---|
| Streak 카운터 | 표시 | 강조 (`s2` 크기) | 잠금 가능 | 끊겨도 비난 X — "다시 만나봐요" |
| 색 변화 (4색) | **핵심 보상** | **핵심 보상** | **핵심 보상** | 빨강 = 압박 X (자연스러운 알림) |
| 격려 카피 | 자주 | 가끔 | 최소 | 과잉 시 진정성 손실 |
| Memory Decay 환경 | 약하게 | 표준 | 강하게 | 모달/빨간 카운터 절대 X |

> 보상은 **고정 비율(VR) 스케줄** — 매번 X, 가끔 O (도파민 시스템 정합).

---

## [6] 인지 축 — Blocked → Hybrid → Interleaved 자동 전환

### 연구 근거

- **Hwang (2025) Language Learning**: 인터리빙만 적용 시 저성취 학습자에게 undesirable difficulty 야기. **초기 blocked → 후기 interleaved 하이브리드** 가 강한 장기 보유율.
- **Brunmair 메타분석**: 인터리빙은 토픽이 유사하지만 예시가 다를 때 가장 효과적 — 어휘 학습은 토픽이 너무 달라지면 효과 역전 가능.

### 자동 전환 규칙 (단어 Stability 기반)

```
큐 A (Stability < 1일):    BLOCKED 강제
  - 같은 단어를 한 게임에서 N회 반복
  - 한 게임 끝낸 후 다음 단어
  - Cold 사용자 default

큐 B (1일 ≤ Stability < 7일):  HYBRID
  - 같은 단어 2회 반복 후 다음 단어로
  - 한 세션에 5~10단어 mix
  - Warm 사용자 default

큐 C (Stability ≥ 7일):    INTERLEAVED
  - 매 회 다른 단어 (셔플)
  - 다른 모듈도 mix 가능 (Flashcard + WordBlitz 교차)
  - Hot 사용자 default
```

---

## [7] 데이터 축

[DB_SCHEMA.md](./DB_SCHEMA.md) 참조.

### 핵심 결정

| 영역 | 결정 | 근거 |
|---|---|---|
| Memory Decay 4색 | DB 컬럼 X — R(t) 동적 계산만 | 일관성 (저장 + 시간 흐름 = 데이터 stale) |
| `vocabularies` FSRS 6 컬럼 | difficulty · stability · last_review_at · next_review_at · module_history (TEXT[]) · review_count | FSRS 호환 |
| `vocabularies` UNIQUE(user_id, word) | 같은 단어 중복 등록 방지 | Phase 2 Import 시 충돌 회피 |
| `learning_records.rating` | SMALLINT 1~4 | FSRS 4단계 (Again/Hard/Good/Easy) |
| `learning_records.metadata` JSONB | PairFlip pair_id, ScriptQuiz question_id 등 | 모듈별 부가 컨텍스트 |
| `scores.metadata` JSONB | 모듈별 stage·level·maxCombo 등 | 모듈별 차이 흡수 |
| `user_stats` 캐시 | mastery_level · total_words · current_streak · fsrs_target_retention | Hub 진입 1쿼리 분기 |
| `module_id` ENUM | 9 모듈 (pairflip 포함) + pirate-quest | 정합성 + 가독성 |

---

## 사용자 여정 — 4시나리오

### A. 신규 사용자 (Library 진입, 권장 경로)

```
Hub  →  Today CTA "첫 학습 시작하기"
  ↓
Library /library  →  CEFR A2 카테고리 → LibraryCard 선택
  ↓
Workspace /text/[id]  →  L2 통독 + 단어 hover (RecallCard 1~2회)
  ↓
FloatingSparkle "받아쓰기로 익혀볼까요?"
  ↓
Dictation /dictate (문장 단위, A2 자동감지)
  ↓
Results "AI로 단어 추출"
  ↓
WordVault /wordvault 허브  →  /wordvault/browse 단어장 확정 (state=new)
  ↓
Flashcard (Blocked 큐 — Cold 사용자)
  ↓
Hub 갱신 — Streak +1 · ContinueCard 등장
```

### B. 신규 사용자 (직접 입력 진입)

```
Hub  →  ModuleCard "스크립트" 클릭
  ↓
TextViewer /text 허브  →  /text/new 입력  →  단일 / 책 (챕터별) 선택  →  본문 입력
  ↓ CEFR 자동감지 (B1)
Workspace L2 통독
  ↓ "AI로 단어 추출" (lib/text-viewer/handoff.ts)
WordVault
  ↓
Flashcard → Dictation → SpellForge → WordBlitz → ScriptQuiz (자율)
  ↓
Dashboard 정확도 링 갱신
```

### C. 복귀 사용자 (Today CTA 따르기 — Warm)

```
Hub
  │ HubHero: Streak 5일 · Today CTA = risk 단어 N개
  │ ContinueCard: "Chapter 3 — 65%"
  ↓ (3가지 자율 분기)
  ├─ Today CTA → Flashcard (risk 우선 큐, Blocked 강제)
  ├─ ContinueCard → Workspace L2 이어 듣기
  └─ ModuleCard "Dictation" → 어제 단락 받아쓰기 (Hybrid 큐)
  ↓
Dashboard 갱신
```

### D. 깊은 학습자 (Hot — 단일 스크립트 정복)

```
Workspace L2 통독
  → WordVault L3 (15단어)
  → Flashcard L4 (Interleaved · 자가판정)
  → Dictation 문장 단위 (음운 인출)
  → WordBlitz (속도 검증)
  → SpellForge (생성 인출)
  → EchoMatch (Shadow Reading)
  → Dictation 전체 (Dictogloss · 통합 검증)
  → ScriptQuiz (스크립트 통합 검증, 87%)
  → Dashboard "Chapter 1 — 단어 9/15 stable"
```

---

## 7원칙 × 9계층 적용 매트릭스

| 원칙 | L0 | L1 | L2 | L3 | L4a 재인 | L4b 시각생성 | L4c 청각생성 | L5 | L6 |
|---|---|---|---|---|---|---|---|---|---|
| Calm UI | 광고 X · 카드 정렬 | 입력 양식 차분 | 자동재생 X | progress 차분 | 정답 spring · 비난 X | 타이핑 완성 spring | TTS 입력 시 정지 | 3-screen 차분 | "오늘 잘 마쳤어요" |
| Progressive Disclosure | CategoryChip 토글 | 입력 단순화 | hover→RecallCard | 예문 토글 | 힌트 점진 노출 | 첫 글자 힌트 | 4단계 힌트 | 스크립트 인용 단서 | InsightPanel 토글 |
| Empathetic Feedback | "추천해드려요" | "직접 입력해 보세요" | "좋은 흐름이에요" | "12개를 만났어요" | "다시 만나봐요" | "정확해요!" | "다시 들어볼까요?" | "스크립트을 정복했어요" | "20분의 깊은 시간" |
| Implicit Progress | 본 카드 흐림 | — | progressPercent | Memory Decay 4색 | ● 회색→주황 | ● 주황→초록 | 단어별 색 갱신 | 텍스트 정복 표시 | WeeklyHeatmap |
| Active Recall | — | — | hover 능동 | **● SRS 시작** | **● 핵심** | **● 핵심** | **● 핵심** | **● 핵심** | — |
| Spaced Repetition | — | — | — | nextReviewAt 부여 | risk 큐 surface | shaky→stable 계산 | autoRepeat+무음 | 텍스트 단위 | Memory Decay 색 |
| Desirable Difficulty | CEFR 매칭 | — | Step 분절 | 뜻 숨김 토글 | 속도 압박 | 보기 없이 생성 | random 순서 | 스크립트 맥락 압박 | — |
| Dual Coding | — | — | TTS + Lora 시각 | 영-한 폰트 분리 | 시각 단일 | 시각+운동 | **청각+운동** | 시각+맥락 | — |
| Context-Dependent | 카테고리 맥락 | 스크립트이 앵커 | 스크립트 안 의미 | exampleEn 강제 | 단어 단독 | 뜻→철자 맥락 | 문장/단락/전체 | ScriptQuiz 인용 | — |
| Cognitive Load | 카드 수 제한 | 옵션 3개만 | Step 분절 | 한 번에 N=10 | 한 번에 1단어 | 첫 글자 완충 | **음운 루프 보호** | 4지선다 단순화 | StatCard 3분할 |
| Emotional Encoding | CEFR 배지 | — | — | "12개 발견" 보상색 | spring 애니 | 완성 순간 피드백 | Smart 70~90% 우선 | 정복 배지 | Streak 강조 |

> 빈 칸은 의도 — 모든 원칙이 모든 계층에 작용하지 않음.

---

## §IA 학습 흐름 노출 원칙

> **모델 흐름은 UI에 직접 보여야 한다. 단, 강제하지 않는다.**

### 3가지 노출 위치

1. **Sidebar 5그룹 + META + FOOTER** (`components/layout/sidebar-config.ts`)
   - 5그룹: 스크립트 / 단어 / 익히기 / 정복 / 완성
   - 그룹 라벨이 흐름 축과 1:1 매핑
   - 그룹 색상도 FlowNav 단계 accent 와 동일
   - 익히기 그룹 4 항목 (인지 깊이 정렬): Flashcard → WordBlitz → PairFlip → SpellForge

2. **FlowNav (전역)** — 모든 페이지 상단 흐름 표시기 v2
   - 6단계 가로 (라이브러리 → 스크립트 → 단어 → 익히기 → 정복 → 완성)
   - 진척도 SVG ring — 각 단계 익힘%
   - 세션 라우팅 — 클릭 시 활동 진입점 직행

3. **각 화면 다음 액션 가이드** — 허브 + 게임 결과 NextActionCard
   - 흐름 순 우선 추천 (cold → 익히기 시작 / warm → 익히기 다지기 / hot → 정복 도전)
   - SDT 자율성 보존 (제안 X 강제, 자유 무시 가능)

### 풀스크린 세션 정책

`lib/layout/full-screen-routes.ts` `isFullScreenRoute(pathname)` — Sidebar 와 FlowNav 공유:

| 페이지 유형 | Sidebar | FlowNav | SessionFrame |
|---|:---:|:---:|:---:|
| 허브 / 메타 | ✅ | ✅ | ❌ |
| 워크스페이스 | ✅ (focus 시 dim 0.3) | ✅ | ❌ |
| 게임 play (`*/play`) | ❌ | ❌ | ✅ |
| Dictation session | ❌ | ❌ | ✅ |
| WordVault Browse (v06.22) | ❌ | ❌ | ✅ |
| (app) 풀스크린 | ❌ | ❌ | ✅ |

자동 숨김 근거: 세션 중에는 working memory 전체를 학습에 할당 (Sweller).

---

## 미정 항목 (코드로 측정·조정 필요)

| 항목 | 현재 추정값 | 해결 시점 |
|---|---|---|
| FSRS 한국 학습자 파라미터 | Target=0.85, D=6.0 | review 1,000건 누적 시 `fsrs-optimizer` |
| Cold/Warm/Hot 임계값 | 단어 50/500개 | A/B 테스트 |
| Blocked → Interleaved 전환 시점 | Stability 1일/7일 | 사용자 retention 데이터 |
| 다중 텍스트 병행 우선순위 | last_opened DESC | 사용 데이터 검증 |
| 모바일 5분 짧은 세션 축약형 | 미정 | Phase 2 |
| L4b(SpellForge) vs L4c(EchoMatch) 추천 우선순위 | shaky 단어 상태 기반 | 사용 데이터 검증 |

---

## 안티패턴 (모델 위반 — 절대 금지)

- 추천을 4곳 이상에 노출 — SDT 자율성 박탈
- FSRS 변수(D/S/R)를 사용자에게 직접 노출 — Progressive Disclosure 위반
- Cold 사용자에게 Interleaved 강제 — undesirable difficulty
- `state` 컬럼을 DB에 저장하고 직접 사용 — Memory Decay 색 일관성 깨짐 (반드시 R(t) 동적 계산)
- 추천 라벨에 정확도/실패 카운트 노출 — Empathetic Feedback 위반
