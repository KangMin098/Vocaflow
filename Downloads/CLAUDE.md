# Vocaflow — CLAUDE.md
# English Learning App · Design System · Single Source of Truth

> Quizlet Parts Kit v06 분석 기반, 영어 학습앱에 최적화된 디자인 시스템  
> **이 문서는 모든 컴포넌트 구현의 단일 기준(Single Source of Truth)입니다.**  
> 기술스택: Next.js 14 (App Router) · React Native (Expo) · Tailwind · Supabase · OpenAI · Vercel · Railway  
> **문서 버전: v06.9** (§17 학습 모델 v3.0 — 흐름 축 9계층 재설계 · L2.5 Bridge 폐지 · L4를 인지 부하 순서 4단계로 분리(L4a 재인/L4b 시각생성/L4c 청각생성/L4d 통합검증) · Dictation L4c 정착 · 7원칙×9계층 매트릭스 갱신 · 체크리스트 갱신) · v06.8 (§17 학습 모델 v2.0 신설 — 7축 메타-모델 · 6계층) · v06.7 (§16 Dictation 모듈) · v06.6 (§"디자인 철학·학습 과학 원칙" — 7원칙 + Memory Decay 4색 + Flow State 5조건)

---

## 📋 Quizlet Parts Kit v06 원본 분석 결과

### 원본 디자인 노트
- 폰트: Hurme Geometric Sans No.3 (로고), No.2 (UI) — 유료 전용
- teal: 인터랙티브 / yellow: 호버·프레스 / coral: 에러 / green: 정답
- gray30: 기본 텍스트 / gray70: 비활성화

### 원본 컴포넌트 (10개 카테고리)
1. Typography (Desktop 8단계 + Mobile 8단계 + Body 4종 + Link 3종 + Special 4종)
2. Selectors (Radio, Checkbox, Toggle, Combined Toggle, Binary Switch)
3. Buttons (Primary, Secondary, Icon, Link, Text Link, Bordered Icon, Special Char, Social)
4. Colors (Primary 3색, Secondary 4색, Grays 5+색)
5. Icons (Large 7종 + Small 7종)
6. Form Fields (5가지 상태 + Alt 테이블형 + 에러)
7. Dropdowns (단일, 정렬옵션, Popover, Popover with Divider)
8. Tool Tips (Desktop, Mobile, Macro — 4색 변형)
9. Social Buttons (Google 연동)
10. Alt Form Fields (용어-정의 테이블)

### 🔍 개선 사항 (15개 → v6에서 전부 해결)

| # | 영역 | v5 문제점 | v6 해결 |
|---|------|-----------|---------|
| 1 | 폰트 | Hurme Geometric Sans 유료 | Plus Jakarta Sans / DM Sans / Lora / JetBrains Mono |
| 2 | 다크모드 | 미지원 | data-theme="dark" 완전 대응 |
| 3 | 스페이싱 | 미정의 | 4px 기반 스케일 (--s-1 ~ --s-16) |
| 4 | 그림자 | 미정의 | 5단계 shadow (--sh-xs ~ --sh-xl) |
| 5 | 애니메이션 | 미정의 | duration + easing + 사용 규칙 |
| 6 | 반응형 | Desktop/Mobile만 | 390/768/1280px 3단계 |
| 7 | 접근성 | 미정의 | WCAG AA + 터치 타겟 44px |
| 8 | 로딩 | 미정의 | Skeleton / Spinner / Progress |
| 9 | 게임 UI | 미정의 | Flashcard / SpellForge / WordBlitz / ScriptQuiz 전용 |
| 10 | 오디오 | 미정의 | TTS 컨트롤 완전 정의 |
| 11 | 진행률 | 미정의 | 선형 / 원형 프로그레스 |
| 12 | 토스트 | 미정의 | 성공/에러/정보/경고 4종 |
| 13 | 모달 | 미정의 | 확인 / 경고 / 전체화면 |
| 14 | 네비게이션 | 미정의 | 하단 탭바 + 헤더 |
| 15 | 아이콘 | 7종 부족 | Lucide React 채택 |

---

## 🎯 프로젝트 개요

- **서비스명**: Vocaflow
- **목적**: 영어 원문(스크립트) 기반 종합 학습 플랫폼
- **기술스택**: Next.js 14 (App Router) · React Native (Expo) · Tailwind CSS · Supabase · OpenAI · Vercel · Railway
- **타겟**: 영어 학습자 (한국 고등학생~성인)
- **플랫폼**: 웹(데스크톱+모바일 브라우저) + iOS/Android 앱 동시 지원

### 핵심 모듈 8개

| 모듈 | 설명 | 상태 |
|------|------|------|
| **TextViewer** | 원문 입력(직접입력·PDF·DOCX·TXT·URL), 전체/Step 듣기 | 설계 완료 |
| **WordVault** | 단어장 생성 — AI 분석 → 단어/뜻/예문/TTS | 설계 완료 |
| **Flashcard** | SM-2 SRS 플래시카드 · 하늘 배경 환경 · 양방향 모드 | React 구현 |
| **SpellForge** | 스펠링 타이핑 게임 · 파란 패널 테마 | React 구현 |
| **WordBlitz** | 인형뽑기 3D 받아쓰기 · GLB 집게 · 풀스크린 | 진행 중 (3D 디자인 반복) |
| **ScriptQuiz** | 원문 독해 퀴즈 · AI 자동 생성 · 3-screen flow | React 구현 |
| **Dashboard** | 학습 통계 · 진행률 · 점수 · 히트맵 | 설계 완료 (v06.0 신규) |
| **Dictation** | 받아쓰기 · CEFR 자동 감지 · TTS · 단어별 채점 · 4단계 힌트 | **MVP 구현 (v06.7 신규)** |

---

## 🧠 디자인 철학 · 학습 과학 원칙

> 모든 화면·컴포넌트·인터랙션은 아래 원칙을 따른다.
> 새 기능 설계 시 "어느 원칙에 기여하는가"를 먼저 답할 것.
> 디자인 토큰·타이포·컬러는 모두 이 원칙을 구현하기 위한 도구.
> **이 원칙들이 8개 학습 모듈에서 어떤 흐름·상태·추천 구조로 작동하는지는 §17 "학습 모델 v3.0"을 참조.**

### 디자인 철학 4개

| # | 원칙 | 의미 | 구현 예시 |
|---|------|------|-----------|
| 1 | **차분한 인터페이스 (Calm UI)** | 학습 중 시각·청각 자극 최소화. 광고·뱃지 알림·과한 애니메이션 금지 | 집중 모드(`useFocusMode` · 30초 무활동 자동 진입) · sidebar dim · 정답 spring 한정 |
| 2 | **점진적 공개 (Progressive Disclosure)** | 본질만 먼저 노출, 깊이는 사용자 요청 시 | 단어 hover/click → RecallCard · 인사이트 패널 토글 · ContinueCard 미리보기 line-clamp |
| 3 | **공감 피드백 (Empathetic Feedback)** | 비난·압박 대신 격려·맥락. Lora italic으로 "사람의 말투" | "20분의 깊은 시간 · 오늘 좋은 페이스예요" · "Page 3까지 왔어요. 좋은 흐름이에요" · 오답 텍스트는 "다시 만나봐요" |
| 4 | **암묵적 진행 표시 (Implicit Progress)** | 숫자 게이지보다 환경 변화로 성장 시각화 | Streak 카운터 · WeeklyHeatmap · Memory Decay 색 변화 · `progressPercent` 1.5px 얇은 바 |

### 학습 과학 원칙 7개

| # | 원칙 | 근거 | 구현 위치 |
|---|------|------|-----------|
| 1 | **능동적 회상 (Active Recall)** | Karpicke & Roediger 2008 — 인출이 재인보다 강한 기억 형성 | `RecallCard` 3단계 판정(knew/unsure/didnt) · Flashcard 양방향 · SpellForge 타이핑 · Dictation 단어별 즉각 채점 |
| 2 | **간격 반복 (Spaced Repetition)** | Ebbinghaus 망각곡선 + SM-2 알고리즘 | `lib/srs/sm2.ts` · `WordItem.nextDays` · "오늘 만나주세요" risk 단어 surface · Dictation Spaced Dictation(autoRepeat + 무음 간격) |
| 3 | **바람직한 어려움 (Desirable Difficulty)** | Bjork — 약간의 인지적 분투가 보유율 향상 | SpellForge 타이핑(보기 X) · Flashcard 답 확인 전 회상 · WordVault 영단어/뜻 숨김 토글 · Dictation random 순서 옵션 |
| 4 | **이중 부호화 (Dual Coding)** | Paivio — 언어 + 시각·청각 동시 자극은 단일 자극보다 강한 기억 | TTS + 영어 원문 + 한글 의미 동시 표시 · Lora(영어 serif) vs DM Sans(한글) 시각 분리 · Dictation TTS + 텍스트 입력 동시 |
| 5 | **맥락 의존 기억 (Context-Dependent)** | 단어를 학습한 맥락에서 다시 만났을 때 인출 강화 | `/text/[id]` 워크스페이스 — 단어를 원문 안에서 hover · 단어장은 항상 `exampleEn`과 결합 · Dictation 문장/단락/전체 단위 |
| 6 | **인지 부하 관리 (Cognitive Load)** | Sweller — 작업기억 ~4 항목 한계 | 한 번에 한 단어(Flashcard) · ModuleCard 7개 정사각 그리드 · Hero Stats 3분할 · Dictation Phonological Loop 보호(입력 시 음성 멈춤) |
| 7 | **정서적 부호화 (Emotional Encoding)** | 도파민 보상 + 자기효능감 → 해마 기억 강화 | Streak `s2` 폰트 시각 강조 · 정답 spring 애니메이션 · 친근한 격려 텍스트 · 보라/금빛 보상색 · Dictation Smart Suggestion(70~90% 우선 추천) |

### Memory Decay 색 체계 (앱 전용 토큰)

> 위치: `apps/web/src/app/globals.css` `@layer base { :root { ... } }` (앱 도메인 토큰)
> 4단계 색은 **모든 학습 모듈에서 동일** — 상태 일관성이 학습자 멘탈 모델의 핵심.

| 상태 | 토큰 | 색 | 학습자 인식 | 시각 표현 |
|------|------|-----|-------------|-----------|
| stable | `--memory-stable` | `#22C55E` | "이건 알아요" | 1px solid border-bottom |
| shaky | `--memory-shaky` | `#F59E0B` | "익숙해요 (가끔 헷갈림)" | 1.5px dashed border-bottom |
| risk | `--memory-risk` | `#EF4444` | "흐릿해요 — 즉시 복습" | 1.5px dashed + `word-pulse` 애니메이션 |
| new | `--memory-new` | `#94A3B8` | "처음 만나는 단어" | gradient 하이라이트 (배경 65~100%) |

### Flow State 보조 — `/text/[id]` 워크스페이스 핵심 설계

미하이 칙센트미하이 Flow 진입 5조건을 UX로 환기:

| Flow 조건 | 워크스페이스 구현 |
|-----------|-------------------|
| 명료한 목표 | ContextBar 상단 "Page X / Y · Chapter Z" |
| 즉각적 피드백 | 단어 hover → 250ms 후 RecallCard 등장 |
| 도전·기술 균형 | CEFR 기반 콘텐츠 추천 + 사용자 mastery 매칭 (예정) |
| 방해 최소화 | 30초 무활동 → 집중 모드 자동 진입(`useFocusMode`) · sidebar opacity 0.3 |
| 시간 감각 망각 보조 | "20분의 깊은 시간 · 오늘 좋은 페이스예요" Ambient Footer (남은 시간 X — 흐름 깨지 않음) |

### 적용 체크리스트 (새 기능 설계·리뷰 시)

PR 머지 전 자가 점검:

- [ ] **학습 과학 원칙 중 최소 1개에 명시적으로 기여**하는가? (없으면 재고)
- [ ] **Calm UI 위반** 없는가? — 색·소리·애니메이션 과잉 / 깜빡이는 알림 / 빨간 카운터 (admin 외)
- [ ] **회상 부담을 명시적으로** 만드는가? — 답 보여주기 전에 시도 기회 제공
- [ ] **실패가 비난적이지 않은가?** — "틀렸어요/오답입니다" 대신 "다시 만나봐요/곧 익숙해질 거예요"
- [ ] **진행을 환경으로** 보여주는가? — 숫자만이 아닌 색·아이콘·여백 변화
- [ ] **맥락**을 보존하는가? — 단어/표현은 원문이나 예문과 결합

### 안티패턴 (절대 금지)

- 정답률 빨간 글씨로 압박 ("정확도 67% 😢")
- 모달 오버레이로 학습 중단 ("3일 연속 학습이 끊겼어요!")
- "오답"을 부정적 색(빨강)으로만 표시 — 색맹 + 정서 모두 위반
- "Are you still there?" 식 inactivity 도발 알림
- 학습 흐름 중 광고·업셀 모달
- 진행률 100% 도달 시 폭죽·트로피 등 과장 보상 — 차분한 "오늘 잘 마쳤어요" 선호

---

## 🧭 학습 모델 v3.0 (Learning Pipeline) — v06.9 재설계

> 8개 핵심 모듈(TextViewer · WordVault · Flashcard · SpellForge · WordBlitz · ScriptQuiz · Dashboard · Dictation)을 **하나의 학습 흐름**으로 묶는 메타-모델.
> §"디자인 철학·학습 과학 원칙" 7원칙이 **어느 단계에서 어떻게 작동하는지** 구체화한 단일 진실 소스.
> 본 섹션은 **모델 레이어(흐름·상태·추천·기억·동기·인지·데이터 7축)**를 정의하며, 컴포넌트 레이어(§14 Hub · §16 Dictation 등)는 이 모델을 구현한다.
> 새 학습 기능은 **이 모델의 어느 계층/축에 속하는가**를 먼저 답한 뒤 설계할 것.
>
> **v3.0 핵심 변경**: L2.5 Bridge(Dictation 억지 배치) 폐지 · L4를 인지 부하 순서 4단계로 분리 · Dictation → L4c(청각 생성) 정착. 근거: 뇌과학(인지 부하 계단) · 심리학(Testing/Generation Effect) · 디자인(Progressive Disclosure).

### 7축 구조

```
[1] 흐름 축      L0 발견 → L1 획득 → L2 이해 → L3 부호화
                 → L4a 재인 → L4b 시각생성 → L4c 청각생성 → L4d 통합검증 → L5 회고
[2] 상태 축      단어(D/S/R 3변수 → 4색) + 원문(4단계) + 사용자(Cold/Warm/Hot)
[3] 추천 축      자율 70% / 시스템 제안 30% — SDT 자율성 보존
[4] 기억 축      FSRS 호환 — Difficulty · Stability · Retrievability
[5] 동기 축      SDT(자율성·유능감·관계성) × 사용자 단계 매트릭스
[6] 인지 축      Blocked → Hybrid → Interleaved 자동 전환 (단어 Stability 기반)
[7] 데이터 축    texts · vocabularies · learning_records · scores + user_stats(신규)
```

---

### [1] 흐름 축 — 9계층 (v3.0 재설계)

> **설계 원칙**: 인지 부하 순서 = 계층 순서. 낮은 부하(수동 이해)에서 높은 부하(통합 생성)로.
> L4가 4개 하위 계층으로 분리된 것은 각 모듈이 뇌과학적으로 다른 인지 처리 수준에 있기 때문.

| 계층 | 라우트 | 사용자 행위 | 인지 유형 | 출력 |
|------|--------|------------|----------|------|
| **L0 Discover** | `/library` | 큐레이션 카드 탐색 · 원문 선택 결정 | 수동 탐색 | 진입 결정 |
| **L1 Acquire** | `/text` (TextViewer) | 원문 확정 + CEFR 자동감지 | 수동 획득 | `texts` 1건 |
| **L2 Comprehend** | `/text/[id]` (Workspace) | 청취 · 통독 · 단어 hover | 수동→능동 전환 | 이해도 마커 |
| **L3 Encode** | `/wordvault` | AI 단어 추출 → 단어장 확정 | 능동 부호화 | `vocabularies` N건 (state=new) |
| **L4a Recognize** | `/flashcard` · `/wordblitz` | 단어 보기 → 아는지 판단 (재인) | 재인 Recognition | `learning_records` |
| **L4b Generate-Visual** | `/spellforge` | 뜻 → 철자 직접 생성 (시각+운동) | 생성 Generation | `learning_records` |
| **L4c Generate-Audio** | `/dictate` | TTS 듣기 → 타이핑 생성 (청각+운동) | 생성 + 음운 인출 | `learning_records` |
| **L4d Integrate** | `/scriptquiz` | 원문 맥락 전체 → 통합 검증 | 통합 Integration | `scores` + 텍스트 정복 |
| **L5 Reflect** | `/hub` · `/dashboard` | 메타인지 + 다음 제안 수신 | 메타인지 | 다음 사이클 진입점 |

#### L4 하위 계층 상세 — 왜 분리하는가

| 계층 | 모듈 | 단서 | 응답 | 뇌과학 | 감각 채널 | 적합 단어 상태 |
|------|------|------|------|--------|----------|--------------|
| **L4a** | Flashcard | 단어 1개 (시각) | 자가 판정 | 패턴 완성 · 메타인지 | 시각 | new → shaky |
| **L4a** | WordBlitz | 4지선다 | 클릭/탭 (속도) | 자동화 형성 · 각성↑ | 시각+시간압박 | shaky → stable 가속 |
| **L4b** | SpellForge | 뜻 + 첫 글자 | 타이핑 (생성) | 운동 부호화 · Generation Effect | 시각+운동 | shaky → stable 검증 |
| **L4c** | Dictation | TTS 청취 | 타이핑 (생성) | Triple Coding · Phonological Loop | 청각+운동 | shaky 견고화 |
| **L4d** | ScriptQuiz | 원문 맥락 전체 | 4지선다 | 의미망 + 에피소드 통합 | 시각+맥락 | stable → 텍스트 정복 |

#### L4b와 L4c — 쌍둥이 계층

SpellForge(L4b)와 Dictation(L4c)은 동일한 생성 인출이지만 감각 채널이 다름:
- **L4b SpellForge**: 시각(뜻) → 운동(타이핑) — 철자·형태 중심
- **L4c Dictation**: 청각(TTS) → 운동(타이핑) — 음운·리듬 중심

두 모듈을 모두 거친 단어는 시각·청각·운동 3채널에 기억 경로가 생겨 가장 강한 장기 기억을 형성.

#### L2.5 Bridge 폐지 이유 (v2.0 → v3.0)

v2.0에서 Dictation을 L2.5(L3 이전)에 배치한 것은 잘못된 설계:
1. **피드백 루프 부재** — WordVault(L3) 확정 전에는 어떤 단어를 틀렸는지 SRS가 기록할 수 없음
2. **인지 순서 역행** — 생성 인출(Dictation)은 재인(L4a)보다 인지 부하가 높음 — L3 이전 배치는 부하 역전
3. **자리 혼동** — Dictation은 청각 생성 모듈로 SpellForge(시각 생성)와 같은 계층이 정확함

---

### [2] 상태 축 — 3중 상태 모델

#### 단어 상태 — FSRS 3변수 (백엔드) → 4색 (UI)

| 변수 | 범위 | 의미 | UI |
|------|------|------|-----|
| **Difficulty (D)** | 1.0~10.0 | 단어 자체 난이도 (mean reversion으로 ease hell 방지) | 표시 안함 |
| **Stability (S)** | 일 단위 | 100%→90% 감쇠까지의 일수 | 표시 안함 |
| **Retrievability (R)** | 0.0~1.0 | 현재 시점 회상 확률 = `exp(ln(0.9) × t / S)` | **§"Memory Decay 색 체계" 4색으로 변환** |

**4색 매핑 규칙**:

```
신규 등록(D/S 미부여)  → new      #94A3B8 (회색)
R ≥ 0.95              → stable   #22C55E (초록)
0.70 ≤ R < 0.95       → shaky    #F59E0B (주황)
R < 0.70              → risk     #EF4444 (빨강)
```

→ 사용자에게는 **여전히 4색만** 노출 (§"Progressive Disclosure" 정합), 백엔드는 더 정확한 스케줄링.

#### 원문 상태 — 4단계

```
미시작 → 듣는 중(progress > 0) → 단어 추출 완료(wordvault_done) → 정복(quiz + dictation 통과)
```

#### 사용자 상태 — 3단계 (★신규 — 추천·인지 축의 분기 기준)

| 단계 | 조건 | 학습 전략 |
|------|------|----------|
| **Cold** | 등록 7일 이내 OR 단어 < 50개 | Blocked 강제 · 한 텍스트 정복 권장 |
| **Warm** | 단어 50~500개 OR Streak 7~30일 | Blocked → Interleaved 점진 전환 |
| **Hot** | 단어 500개+ OR Streak 30일+ | Full Interleaved · 다중 텍스트 병행 |

→ Hub 진입 시 `user_stats.mastery_level` 1쿼리로 분기 (성능)

---

### [3] 추천 축 — 자율 70% / 제안 30%

**자기결정성 이론(SDT) 정합** — 자율성 박탈은 동기 파괴이므로 시스템 제안은 30%로 제한.

#### 제안 위치 (정확히 3곳만)

1. **Hub Today CTA** — 1개 제안 (수락/무시 자유)
2. **FloatingSparkle** (워크스페이스) — 1개 제안 (자동 재출현 X)
3. **세션 종료 직후** "다음 추천" — 1개 제안 (Reflect 단계)

#### 자율 영역

- ModuleCard 8개 항상 동등 노출 (§14 Home Hub 정합)
- Library 카드는 큐레이션 순서만 영향, 차단 X
- Settings에서 "추천 끄기" 가능 (Hot 사용자 default)

---

### [4] 기억 축 — FSRS 호환 알고리즘

#### 핵심 수식

```
회상 확률:        R(t) = exp(ln(0.9) × t / S)
성공 후 Stability: S_new = S × (1 + α × (D-1) × ...)
실패 후 Stability: S_new = S_failed × R^β
Difficulty 회귀:   D_new = w × D_old + (1-w) × D_baseline    -- ease hell 방지
```

#### 구현

- **`ts-fsrs` npm 패키지 채택** — 직접 구현 금지 (Anki 23.10+ 검증 구현)
- 위치: `apps/web/src/lib/srs/fsrs.ts` + `lib/srs/state.ts`(R→4색 매핑) + `packages/ui-shared/src/srs/`(웹·앱 공유)
- 기존 `lib/srs/sm2.ts` 인터페이스는 wrapper로 유지 (호환성)

#### 한국 학습자 특화 초기 파라미터

| 파라미터 | FSRS 표준 | Vocaflow 초기값 | 근거 |
|---------|----------|----------------|------|
| Target Retention | 0.90 | **0.85** | 한국 학습자 평균 학습 시간 부족 — 부담 완화 |
| Initial Difficulty | 5.0 | **6.0** | 외국어 처리는 모국어보다 어려움 |
| Maximum Interval | 36500일 | **365일** | 1년 이상은 의미 없음 |
| Learning Steps | [1m, 10m] | **[1d, 3d]** | Vocaflow는 게임 세션 단위 — 분 단위 X |

→ 출시 후 review 1,000건 누적 시 `fsrs-optimizer`로 사용자별 자동 재최적화.

---

### [5] 동기 축 — SDT × 사용자 단계 매트릭스

#### 자기결정성 이론(SDT) 3요소 매핑

| SDT 요소 | Cold | Warm | Hot |
|---------|------|------|-----|
| **자율성** | "원문 자유 선택" 강조 · Library 큐레이션 노출 | 학습 모듈 자유 조합 | 다중 텍스트 병행 + 추천 OFF 옵션 |
| **유능감** | Streak 1일도 시각화 · Memory Decay 첫 변화 강조 | 50/100/500 단어 마일스톤 (차분히) | mastery 그래프 · 자기 통계 비교 |
| **관계성** | 격려 카피 ("좋은 시작이에요") | 학습 회고 ("3주째 함께해요") | (Phase 2) 친구 Streak 비교 옵션 |

#### 보상 장치 4종 — 작동 시점

| 장치 | Cold | Warm | Hot | 안티패턴 회피 |
|------|:---:|:---:|:---:|---------------|
| Streak 카운터 | 표시 | 강조 (`s2` 크기) | 잠금 가능 | 끊겨도 비난 X — "다시 만나봐요" |
| 색 변화 (4색) | **핵심 보상** | **핵심 보상** | **핵심 보상** | 빨강 = 압박 X (자연스러운 알림) |
| 격려 카피 | 자주 | 가끔 | 최소 | 과잉 시 진정성 손실 |
| Memory Decay 환경 | 약하게 | 표준 | 강하게 | 모달/빨간 카운터 절대 X |

> 보상은 **고정 비율(VR) 스케줄** — 매번 X, 가끔 O (도파민 시스템 정합).

---

### [6] 인지 축 — Blocked → Hybrid → Interleaved 자동 전환

#### 연구 근거

- **Hwang(2025) Language Learning**: 인터리빙만 적용 시 저성취 학습자에게 undesirable difficulty 야기. **초기 blocked → 후기 interleaved 하이브리드**가 단독 방식보다 강한 장기 보유율.
- **Brunmair 메타분석**: 인터리빙은 토픽이 유사하지만 예시가 다를 때 가장 효과적 — 어휘 학습은 토픽이 너무 달라지면 효과 역전 가능.

#### 자동 전환 규칙 (단어 Stability 기반)

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

→ **인지 부하 곡선이 단어별로 다르게 작동** — 같은 사용자라도 단어마다 다른 큐 사용.

#### 모듈 ↔ 인지 깊이 매트릭스 (v3.0 — 계층별 정렬)

| 계층 | 모듈 | 단서 | 응답 | 회상 깊이 | 적합 단어 상태 |
|------|------|------|------|----------|--------------|
| L4a | Flashcard | 단어 1개 (시각) | 자가판정 (Again/Hard/Good/Easy) | 재인 + 메타인지 | new → shaky |
| L4a | WordBlitz | 4지선다 | 클릭/탭 (속도) | 재인 + 자동화 | shaky → stable 가속 |
| L4b | SpellForge | 뜻 + 첫 글자 | 타이핑 (시각 생성) | 시각·의미 생성 인출 | shaky → stable 검증 |
| L4c | Dictation (문장) | TTS (청각만) | 타이핑 (청각 생성) | 음운 인출 | shaky 견고화 |
| L4c | Dictation (전체) | TTS + 맥락 | 타이핑 (청각 생성) | 통합 음운 인출 | stable 검증 |
| L4d | ScriptQuiz | 원문 맥락 전체 | 4지선다 | 통합 이해 | 텍스트 단위 최종 검증 |

---

### [7] 데이터 축 — 스키마 변경

#### `vocabularies` — FSRS 호환 컬럼 추가

```sql
ALTER TABLE vocabularies ADD COLUMN difficulty FLOAT DEFAULT 6.0;        -- FSRS D
ALTER TABLE vocabularies ADD COLUMN stability FLOAT DEFAULT 0;            -- FSRS S (일)
ALTER TABLE vocabularies ADD COLUMN last_review_at TIMESTAMPTZ;
ALTER TABLE vocabularies ADD COLUMN next_review_at TIMESTAMPTZ;
ALTER TABLE vocabularies ADD COLUMN module_history TEXT[] DEFAULT '{}';
ALTER TABLE vocabularies ADD COLUMN review_count INT DEFAULT 0;
-- state(4색)는 R(t) 동적 계산 — 저장 X
```

#### `texts` — CEFR + 진행률 컬럼

```sql
ALTER TABLE texts ADD COLUMN cefr_level TEXT;                   -- A1~C2
ALTER TABLE texts ADD COLUMN last_opened TIMESTAMPTZ;
ALTER TABLE texts ADD COLUMN progress_percent FLOAT DEFAULT 0;
```

#### `learning_records` — FSRS rating + dictation 모듈

```sql
-- module enum에 'dictation' 추가 (v06.7 정합)
ALTER TABLE learning_records ADD COLUMN rating SMALLINT;  -- FSRS 4단계: 1=Again 2=Hard 3=Good 4=Easy
```

#### `user_stats` — 신규 테이블 (사용자 단계 캐시)

```sql
CREATE TABLE user_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  mastery_level TEXT DEFAULT 'cold',          -- 'cold' | 'warm' | 'hot'
  total_words INT DEFAULT 0,
  current_streak INT DEFAULT 0,
  fsrs_target_retention FLOAT DEFAULT 0.85,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own data" ON user_stats FOR ALL USING (auth.uid() = user_id);
```

---

### 사용자 여정 — 4시나리오

#### A. 신규 사용자 (Library 진입, 권장 경로)

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
WordVault  →  단어장 확정 (모두 state=new)
  ↓
Flashcard (Blocked 큐 — Cold 사용자)
  ↓
Hub 갱신 — Streak +1 · ContinueCard 등장
```

#### B. 신규 사용자 (직접 입력 진입)

```
Hub  →  ModuleCard "원문" 클릭
  ↓
TextViewer /text  →  PDF 업로드
  ↓ CEFR 자동감지(B1)
Workspace L2 통독
  ↓ "AI로 단어 추출" (lib/text-viewer/handoff.ts)
WordVault
  ↓
Flashcard → Dictation → SpellForge → WordBlitz → ScriptQuiz (자율)
  ↓
Dashboard 정확도 링 갱신
```

#### C. 복귀 사용자 (Today CTA 따르기 — Warm)

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

#### D. 깊은 학습자 (Hot — 단일 원문 정복)

```
Workspace L2 통독
  → WordVault L3 (15단어)
  → Flashcard L4 (Interleaved · 자가판정)
  → Dictation 문장 단위 (음운 인출)
  → WordBlitz (속도 검증)
  → SpellForge (생성 인출)
  → Dictation 전체 (Dictogloss · 통합 검증)
  → ScriptQuiz (원문 통합 검증, 87%)
  → Dashboard "Chapter 1 — 단어 9/15 stable"
```

---

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

  // P2. 진행 중 원문 (Context-Dependent 보존)
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
        strategy: 'interleaved', label: '원문 전체를 점검해볼까요?'
      };
      break;
  }

  // P4. Cold start
  return { module: 'library', label: '새 원문을 만나보세요' };
}
```

---

### 7원칙 × 9계층 적용 매트릭스 (v3.0 검증)

| 원칙 | L0 | L1 | L2 | L3 | L4a 재인 | L4b 시각생성 | L4c 청각생성 | L4d 통합 | L5 |
|---|---|---|---|---|---|---|---|---|---|
| Calm UI | 광고 X · 카드 정렬 | 입력 양식 차분 | 자동재생 X | progress 차분 | 정답 spring · 비난 X | 타이핑 완성 spring | TTS 입력 시 정지 | 3-screen 차분 | "오늘 잘 마쳤어요" |
| Progressive Disclosure | CategoryChip 토글 | 입력 단순화 | hover→RecallCard | 예문 토글 | 힌트 점진 노출 | 첫 글자 힌트 | 4단계 힌트 | 원문 인용 단서 | InsightPanel 토글 |
| Empathetic Feedback | "추천해드려요" | "직접 입력해 보세요" | "좋은 흐름이에요" | "12개를 만났어요" | "다시 만나봐요" | "정확해요!" | "다시 들어볼까요?" | "원문을 정복했어요" | "20분의 깊은 시간" |
| Implicit Progress | 본 카드 흐림 | — | progressPercent | Memory Decay 4색 | ● 회색→주황 | ● 주황→초록 | 단어별 색 갱신 | 텍스트 정복 표시 | WeeklyHeatmap |
| Active Recall | — | — | hover 능동 | **● SRS 시작** | **● 핵심** | **● 핵심** | **● 핵심** | **● 핵심** | — |
| Spaced Repetition | — | — | — | nextReviewAt 부여 | risk 큐 surface | shaky→stable 계산 | autoRepeat+무음 | 텍스트 단위 | Memory Decay 색 |
| Desirable Difficulty | CEFR 매칭 | — | Step 분절 | 뜻 숨김 토글 | 속도 압박(WordBlitz) | 보기 없이 생성 | random 순서 | 원문 맥락 압박 | — |
| Dual Coding | — | — | TTS + Lora 시각 | 영-한 폰트 분리 | 시각 단일 | 시각+운동 | **청각+운동** | 시각+맥락 | — |
| Context-Dependent | 카테고리 맥락 | 원문이 앵커 | 원문 안 의미 | exampleEn 강제 | 단어 단독 | 뜻→철자 맥락 | 문장/단락/전체 | ScriptQuiz 인용 | — |
| Cognitive Load | 카드 수 제한 | 옵션 3개만 | Step 분절 | 한 번에 N=10 | 한 번에 1단어 | 첫 글자 완충 | **음운 루프 보호** | 4지선다 단순화 | StatCard 3분할 |
| Emotional Encoding | CEFR 배지 | — | — | "12개 발견" 보상색 | spring 애니 | 완성 순간 피드백 | Smart 70~90% 우선 | 정복 배지 | Streak 강조 |

> 빈 칸은 의도 — 모든 원칙이 모든 계층에 작용하지 않음.

---

### 미정 항목 (코드로 측정·조정 필요)

| 항목 | 현재 추정값 | 해결 시점 |
|------|----------|----------|
| FSRS 한국 학습자 파라미터 | Target=0.85, D=6.0 | review 1,000건 누적 시 `fsrs-optimizer` |
| Cold/Warm/Hot 임계값 | 단어 50/500개 | A/B 테스트 |
| Blocked → Interleaved 전환 시점 | Stability 1일/7일 | 사용자 retention 데이터 |
| 다중 텍스트 병행 우선순위 | last_opened DESC | 사용 데이터 검증 |
| 모바일 5분 짧은 세션 축약형 | 미정 | Phase 2 |
| L4b(SpellForge) vs L4c(Dictation) 추천 우선순위 | shaky 단어 상태 기반 | 사용 데이터 검증 |

---

### 모델 적용 체크리스트 (PR 자가 점검)

- [ ] 새 화면/기능이 **9계층(L0~L4d~L5) 중 어디**에 속하는가?
- [ ] L4 계층이라면 **L4a/b/c/d 중 어느 인지 유형**인가? (재인/시각생성/청각생성/통합)
- [ ] **사용자 단계(Cold/Warm/Hot)별로 다르게** 동작하는가?
- [ ] 추천이 **자율 70%** 한도를 지키는가? (제안 위치 3곳 외 추가 X)
- [ ] 단어 상태는 **R(t) 동적 계산** 결과를 사용하는가? (저장된 state 직접 사용 X)
- [ ] Blocked/Hybrid/Interleaved 큐가 **단어 Stability**에 따라 자동 분기되는가?
- [ ] FSRS 파라미터 변경 시 `user_stats.fsrs_target_retention` 업데이트하는가?

### 안티패턴 (모델 위반 — 절대 금지)

- 추천을 4곳 이상에 노출 — SDT 자율성 박탈
- FSRS 변수(D/S/R)를 사용자에게 직접 노출 — Progressive Disclosure 위반
- Cold 사용자에게 Interleaved 강제 — undesirable difficulty (Hwang 2025)
- `state` 컬럼을 DB에 저장하고 직접 사용 — Memory Decay 색 일관성 깨짐 (반드시 R(t)로 동적 계산)
- 추천 라벨에 정확도/실패 카운트 노출 — Empathetic Feedback 위반

---

## 🔤 Typography

### 폰트 체계 (Quizlet Hurme Geometric Sans 대안)

```
Display / UI  : 'Plus Jakarta Sans'  — Geometric Sans, 무료 Google Fonts
Body          : 'DM Sans'            — 깔끔한 산세리프, 무료
영어 원문     : 'Lora'               — 가독성 우수 세리프, 영어 원문 전용
코드 / 게임   : 'JetBrains Mono'     — SpellForge 스펠링 셀 전용
```

**⚠ 절대 사용 금지: Inter · Roboto · Arial**

### Google Fonts Import

```html
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
```

### Tailwind Config

```js
// tailwind.config.js
fontFamily: {
  display: ['"Plus Jakarta Sans"', 'sans-serif'],
  body:    ['"DM Sans"', 'sans-serif'],
  english: ['"Lora"', 'serif'],
  mono:    ['"JetBrains Mono"', 'monospace'],
}
```

### 타이포 스케일

```
Desktop (1280px+)                     Mobile (390px)
──────────────────────────────────    ──────────────────────────────
h1-lg:  36px / 700 / 1.18 / -0.022em  h1-lg:  28px / 700 / 1.2
h1-md:  30px / 700 / 1.20 / -0.016em  h1-md:  24px / 700 / 1.25
h1-sm:  26px / 700 / 1.28 / -0.010em  h1-sm:  22px / 700 / 1.3
h2:     22px / 600 / 1.32             h2:     20px / 600 / 1.3
h3:     18px / 600 / 1.40             h3:     17px / 600 / 1.4
h4:     16px / 600 / 1.40             h4:     15px / 600 / 1.4
h5:     14px / 700 / 1.40 / UPPER     h5:     13px / 700 / UPPER
h6:     12px / 700 / 1.50 / UPPER     h6:     11px / 700 / UPPER
```

### Body (DM Sans)

```
body-1:          16px / 400 / 1.6           — 기본 본문
body-1-semi:     16px / 600 / 1.6           — 강조 본문
body-2:          14px / 400 / 1.5           — 보조 본문
body-3:          13px / 400 / 1.5           — 캡션
body-3-oblique:  13px / 400 / italic        — 이탤릭 캡션
body-3-spaced:   13px / 400 / tracking 0.05em
body-4:          12px / 400 / 1.5           — 최소 텍스트
```

### 영어 원문 전용 (Lora Serif)

```
english-body:      20px / 400 / 1.8    — 원문 읽기 영역
english-highlight: 20px / 400 / 1.8 / bg: --p-light  — 재생 중 하이라이트
english-word:      18px / 600          — 단어 강조
```

### Special (s1~s4)

```
s1:  14px / 700 / UPPERCASE / tracking 0.10em  — 섹션 레이블
s2:  40px / 800 / 1.1                          — 히어로/점수 대형 표시
s3:  16px / 400                                — 일반 특수
s4:  14px / 400                                — 소형 특수
```

---

## 🎨 Colors — CSS Variables (단일 체계)

> **v6 확정: 축약형 변수를 공식 SSoT로 채택.**  
> Parts Kit v05 HTML에서 사용 중인 `--p`, `--bg`, `--t1` 체계를 전체 통일.  
> 기존 `--color-primary` 계열은 폐기 — 축약형만 사용.

```css
/* ─────────────────────────────────────────────
   globals.css — CSS Variables (SSoT)
───────────────────────────────────────────── */
:root {
  /* Brand */
  --p:       #3B82F6;   /* primary — 메인 인터랙티브 */
  --p-hover: #2563EB;   /* primary hover */
  --p-light: #EFF6FF;   /* primary 배경 틴트 */
  --p-dark:  #1D4ED8;   /* primary 강조 */

  /* Active (yellow — Quizlet yellow 역할) */
  --active:       #F59E0B;
  --active-light: #FEF3C7;

  /* Semantic */
  --success:       #22C55E;
  --success-light: #DCFCE7;
  --error:         #EF4444;
  --error-light:   #FEE2E2;
  --warning:       #F59E0B;
  --warning-light: #FEF3C7;
  --info:          #06B6D4;
  --info-light:    #CFFAFE;

  /* Surface */
  --bg:  #FFFFFF;   /* 기본 배경 */
  --bg2: #F8FAFC;   /* 카드/섹션 배경 */
  --bg3: #F1F5F9;   /* 입력 필드 배경 */

  /* Text */
  --t1: #0F172A;   /* 기본 텍스트 */
  --t2: #475569;   /* 보조 텍스트 */
  --t3: #94A3B8;   /* 비활성 텍스트 */
  --t4: #CBD5E1;   /* 완전 비활성 */
  --ti: #FFFFFF;   /* 반전 (어두운 배경 위) */

  /* Border */
  --bd:  #E2E8F0;   /* 기본 테두리 */
  --bdf: #3B82F6;   /* 포커스 테두리 */
  --bde: #EF4444;   /* 에러 테두리 */

  /* Game Specific — 게임 전용, 변경 금지 */
  --gold:   #EAB308;
  --silver: #94A3B8;
  --bronze: #D97706;
  --combo:  #8B5CF6;
  --streak: #EC4899;

  /* Shadow */
  --sh-xs: 0 1px 2px rgba(0,0,0,.05);
  --sh-sm: 0 1px 3px rgba(0,0,0,.10), 0 1px 2px rgba(0,0,0,.06);
  --sh-md: 0 4px 6px rgba(0,0,0,.07), 0 2px 4px rgba(0,0,0,.06);
  --sh-lg: 0 10px 15px rgba(0,0,0,.10), 0 4px 6px rgba(0,0,0,.05);
  --sh-xl: 0 20px 25px rgba(0,0,0,.10), 0 10px 10px rgba(0,0,0,.04);

  /* Radius */
  --r-sm:   6px;
  --r-md:   8px;
  --r-lg:   12px;
  --r-xl:   16px;
  --r-2xl:  24px;
  --r-full: 9999px;

  /* Motion */
  --dur-fast:   100ms;
  --dur-normal: 200ms;
  --dur-slow:   300ms;
  --dur-slower: 500ms;
  --ease:        cubic-bezier(.4, 0, .2, 1);
  --ease-in:     cubic-bezier(.4, 0, 1, 1);
  --ease-out:    cubic-bezier(0, 0, .2, 1);
  --ease-spring: cubic-bezier(.34, 1.56, .64, 1);
}

/* Dark Mode */
[data-theme="dark"] {
  --p:       #60A5FA;
  --p-hover: #93C5FD;
  --p-light: #1E3A5F;
  --p-dark:  #3B82F6;

  --active-light: #451A03;
  --success:       #4ADE80;
  --success-light: #052E16;
  --error:         #F87171;
  --error-light:   #3B0A0A;
  --info-light:    #083344;
  --warning-light: #3B2000;

  --bg:  #0B1120;
  --bg2: #141E30;
  --bg3: #1E2D42;

  --t1: #F1F5F9;
  --t2: #CBD5E1;
  --t3: #64748B;
  --t4: #334155;

  --bd:  #1E2D42;
  --bdf: #60A5FA;
}
```

### 게임 전용 하드코딩 색상 예외

> 아래 색상만 CSS 변수 대신 하드코딩 허용 — **반드시 주석 명시**

```css
/* ── WordBlitz 정글 전용 — 변경 금지 ── */
#FFE234  /* 황금 점수 텍스트 */
#3d8a3d  /* 정글 배경 기본 그린 */

/* ── Flashcard 카드 gradient — 변경 금지 ── */
/* 앞면: #FFFDE7 → #FFF9C4 → #FFF59D */
/* 뒷면: #E8F5E9 → #C8E6C9 → #A5D6A7 */

/* ── SpellForge 파란 패널 — 변경 금지 ── */
#4A9FCF  /* 패널 메인 컬러 */
#3A7FAF  /* 패널 다크 */
```

---

## 📐 Spacing — 4px 기반 스케일

```
--s-0:   0px
--s-1:   4px    (Tailwind: p-1)   — 아이콘 내부 패딩
--s-2:   8px    (p-2)             — 버튼 내부 최소
--s-3:   12px   (p-3)             — 작은 컴포넌트
--s-4:   16px   (p-4)             — 기본 패딩 ★
--s-5:   20px   (p-5)
--s-6:   24px   (p-6)             — 카드 내부 패딩 ★
--s-8:   32px   (p-8)             — 섹션 간격
--s-10:  40px   (p-10)
--s-12:  48px   (p-12)            — 페이지 상하 패딩
--s-16:  64px   (p-16)            — 히어로 섹션
```

---

## 🌑 Elevation / Shadow

```css
/* 사용 규칙 */
카드 기본:   --sh-sm
카드 호버:   --sh-md
드롭다운:    --sh-lg
모달:        --sh-xl
툴팁:        --sh-md
```

---

## 🔲 Border Radius

```
--r-sm:   6px    — 입력 필드, 작은 버튼, 태그
--r-md:   8px    — 버튼, 배지, 셀렉트
--r-lg:   12px   — 카드, 드롭다운
--r-xl:   16px   — 모달, 큰 카드, 바텀시트
--r-2xl:  24px   — 플래시카드, 팝업
--r-full: 9999px — 아이콘 버튼, 뱃지, 아바타, 진행바
```

---

## 🎬 Motion / Animation

```css
/* Duration */
--dur-fast:   100ms   /* 토글, 체크박스 */
--dur-normal: 200ms   /* 버튼 호버, 색상 변화 */
--dur-slow:   300ms   /* 카드 뒤집기, 페이드 인 */
--dur-slower: 500ms   /* 페이지 전환, 모달 */

/* Easing */
--ease:        cubic-bezier(.4, 0, .2, 1)     /* 일반 전환 */
--ease-in:     cubic-bezier(.4, 0, 1, 1)      /* 퇴장 */
--ease-out:    cubic-bezier(0, 0, .2, 1)      /* 등장 */
--ease-spring: cubic-bezier(.34, 1.56, .64, 1) /* 바운스 (정답 피드백) */

/* 사용 매핑 */
버튼 호버:      transition: all var(--dur-normal) var(--ease)
카드 뒤집기:    rotateY(180deg), 0.55s var(--ease)
정답 피드백:    scale(1.05)→scale(1), --dur-slow, --ease-spring
오답 피드백:    translateX shake 3회, --dur-slow
페이지 전환:    opacity 0→1 + translateY 20→0, stagger 50ms
진행률 바:      width 전환, --dur-slow, --ease-out
점수 카운트업:  0→실제값, 1s, --ease-out
```

---

## 📱 Breakpoints — v6 확정 기준

> **SSoT 기준: 390 / 768 / 1280px** (v5의 640/1024px → 폐기)

```
mobile:   390px    — 1열 레이아웃, 앱 셸 max-width: 480px
tablet:   768px    — 2열 가능
desktop:  1280px   — 최대 너비 제한

최대 콘텐츠 너비: max-w-2xl (672px) — 학습 콘텐츠
최대 페이지 너비: max-w-6xl (1152px) — 대시보드
```

### Tailwind Config

```js
// tailwind.config.js
screens: {
  'sm':  '390px',
  'md':  '768px',
  'lg':  '1280px',
}
```

---

## 🔘 Buttons

### 8종 체계 (웹 — JSX/Tailwind)

```jsx
// src/components/ui/Button.jsx

/* ── Primary ── */
"bg-[var(--p)] text-[var(--ti)]
 px-6 py-3 rounded-[var(--r-md)] font-display font-[600]
 hover:bg-[var(--p-hover)] active:scale-[0.97]
 transition-all duration-[var(--dur-normal)]
 disabled:opacity-50 disabled:cursor-not-allowed"

/* ── Secondary ── */
"border-2 border-[var(--p)] text-[var(--p)] bg-transparent
 px-6 py-3 rounded-[var(--r-md)] font-display font-[600]
 hover:bg-[var(--p-light)] active:scale-[0.97]"

/* ── Danger ── */
"bg-[var(--error)] text-[var(--ti)]
 px-6 py-3 rounded-[var(--r-md)] font-[600]
 hover:opacity-90"

/* ── Ghost ── */
"bg-[var(--bg3)] text-[var(--t1)]
 px-6 py-3 rounded-[var(--r-md)] font-[600]
 hover:bg-[var(--bd)]"

/* ── Icon Button ── */
"w-10 h-10 rounded-full flex items-center justify-center
 bg-[var(--p-light)] text-[var(--p)]
 hover:bg-[var(--p)] hover:text-[var(--ti)]
 transition-all duration-[var(--dur-normal)]"

/* ── Link Button ── */
"text-[var(--p)] font-[600] uppercase tracking-wider text-sm
 hover:underline"

/* ── Social (Google) ── */
"w-full border border-[var(--bd)] rounded-[var(--r-md)]
 px-6 py-3 flex items-center justify-center gap-3
 hover:bg-[var(--bg3)]
 font-display font-[500]"

/* ── Text Link ── */
"text-[var(--p)] font-[500] underline hover:text-[var(--p-dark)]"

/* 크기 변형 */
btn-sm:  px-4 py-2 text-sm rounded-[var(--r-sm)]
btn-md:  px-6 py-3 text-base rounded-[var(--r-md)]  /* 기본 */
btn-lg:  px-8 py-4 text-lg rounded-[var(--r-lg)]
```

### React Native 버전

```tsx
// src/mobile/components/ui/Button.tsx
import { Pressable, Text, StyleSheet } from 'react-native';
import { tokens } from '../tokens';

const styles = StyleSheet.create({
  base: {
    minHeight: 44,       // 터치 타겟 최소 44px
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.r.md,
    paddingHorizontal: tokens.s[6],
    paddingVertical: tokens.s[3],
  },
  primary: {
    backgroundColor: tokens.p,
  },
  primaryText: {
    color: tokens.ti,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 16,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: tokens.p,
  },
  secondaryText: {
    color: tokens.p,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 16,
  },
  disabled: {
    opacity: 0.5,
  },
});
```

---

## ☑️ Selectors

```jsx
// src/components/ui/Checkbox.jsx

/* 4가지 상태 */
Unselected:   "w-[22px] h-[22px] border-2 border-[var(--bd)] rounded-[4px]"
Selected:     "w-[22px] h-[22px] border-2 border-[var(--p)] bg-[var(--p)] rounded-[4px]"
              체크 아이콘 bounce 애니메이션
Indeterminate:"w-[22px] h-[22px] bg-[var(--p)] border-[var(--p)] — 가로줄"
Disabled:     opacity-50 cursor-not-allowed

/* Toggle */
Off:  "bg-[var(--bd)] w-11 h-6"
On:   "bg-[var(--p)] w-11 h-6" + 흰색 원 spring 이동
크기: 최소 44×44px 터치 타겟 확보
```

---

## 📝 Form Fields

```jsx
// src/components/ui/Input.jsx

/* Default */
"w-full px-4 py-3
 border border-[var(--bd)] rounded-[var(--r-md)]
 bg-[var(--bg)] text-[var(--t1)]
 placeholder:text-[var(--t3)]
 font-body text-base
 transition-all duration-[var(--dur-normal)]"

/* Focus */
"focus:border-[var(--bdf)] focus:ring-2 focus:ring-[var(--p)]/20 focus:outline-none"

/* Error */
"border-[var(--bde)] ring-2 ring-[var(--error)]/20"
에러 메시지: "text-[var(--error)] text-sm mt-1"

/* Success */
"border-[var(--success)] ring-2 ring-[var(--success)]/20"

/* Disabled */
"opacity-50 cursor-not-allowed bg-[var(--bg3)]"

/* Alt Form (용어-정의 2열 테이블) */
기본:  "border-b border-[var(--bg3)]"
선택:  "bg-[var(--p-light)] border-b-2 border-[var(--p)]"
```

---

## 🔽 Dropdowns & Popovers

```
Dropdown:   Radix UI Select 기반, 키보드 네비게이션
Popover:    Radix UI Popover, 외부 클릭 닫기
Mobile:     바텀시트 형태, 드래그 핸들 포함
검색:       Dropdown 내 검색 필터 (단어장 선택 시)
```

---

## 💬 Tooltips

```jsx
"absolute px-3 py-2 rounded-[var(--r-md)]
 bg-[var(--t1)] text-[var(--ti)] text-sm
 shadow-[var(--sh-md)]
 animate-in fade-in duration-[var(--dur-normal)]"

방향: top(기본) | bottom | left | right  — caret 포함
색상 변형: default(dark) · info · warning · error
```

---

## 🆕 추가 컴포넌트

### Progress Bar

```jsx
// src/components/ui/ProgressBar.jsx

/* 선형 */
<div className="w-full h-1.5 bg-[var(--bg3)] rounded-[var(--r-full)] overflow-hidden">
  <div className="h-full bg-[var(--p)] rounded-[var(--r-full)]
                  transition-[width] duration-[var(--dur-slow)] ease-out"
       style={{ width: `${progress}%` }} />
</div>

/* 색상 변형: bg-[var(--p)] | bg-[var(--success)] | bg-[var(--error)] */
/* 텍스트 포함 시: 상단 "{current} / {total}" + 퍼센트 표시 */
```

### Toast

```jsx
// src/components/ui/Toast.jsx

/* 성공 */  "bg-[var(--success-light)] border-l-[3.5px] border-[var(--success)]"
/* 에러 */  "bg-[var(--error-light)]   border-l-[3.5px] border-[var(--error)]"
/* 정보 */  "bg-[var(--info-light)]    border-l-[3.5px] border-[var(--info)]"
/* 경고 */  "bg-[var(--warning-light)] border-l-[3.5px] border-[var(--warning)]"

위치: 화면 상단 중앙 fixed / auto-dismiss 3초
```

### Modal

```jsx
// src/components/ui/Modal.jsx

/* 배경 */  "fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
/* 모달 */  "bg-[var(--bg)] rounded-[var(--r-2xl)] shadow-[var(--sh-xl)] p-6 max-w-md mx-auto"
/* 진입 */  scale(0.95)→scale(1) + opacity 0→1, --dur-slow, --ease-spring
```

### Bottom Tab Bar (웹 모바일 + RN)

```jsx
// src/components/layout/BottomTabBar.jsx (웹)

/* 5개 탭: 📖 원문 | 📝 단어 | 🃏 카드 | 🎮 게임 | 📊 통계 */
"fixed bottom-0 w-full bg-[var(--bg)] border-t border-[var(--bd)]
 flex safe-bottom"
/* 각 탭: min-h-[56px] flex-1 flex flex-col items-center justify-center py-2 */
/* 활성:  text-[var(--p)], 아이콘 채움 */
/* 비활성: text-[var(--t3)], 아이콘 아웃라인 */
```

```tsx
// src/mobile/components/layout/BottomTabBar.tsx (RN)
import { Platform } from 'react-native';

const tabBarStyle = {
  height: Platform.OS === 'ios' ? 83 : 60,
  paddingBottom: Platform.OS === 'ios' ? 28 : 8,
  backgroundColor: tokens.bg,
  borderTopColor: tokens.bd,
  borderTopWidth: 0.5,
};
```

### Audio Player (TTS)

```jsx
/* 미니 버튼 (문장 옆 인라인) */
"w-8 h-8 rounded-full bg-[var(--p-light)] text-[var(--p)]
 flex items-center justify-center"
아이콘: Play ▶ / Pause ⏸ (Lucide 16px)

/* 전체 플레이어 (하단 고정) */
"fixed bottom-[56px] w-full bg-[var(--bg)] border-t border-[var(--bd)] px-4 py-3"
컨트롤: [◀이전] [▶재생/⏸일시정지] [▶다음]
속도: 0.5x / 0.75x / 1x / 1.25x / 1.5x
진행바 + 현재 문장 텍스트
```

### Loading Overlay

```jsx
// src/components/ui/LoadingOverlay.jsx

"fixed inset-0 z-[200] bg-[rgba(15,23,42,0.5)] backdrop-blur-[4px]
 flex items-center justify-center"

/* 내부 카드 */
"bg-[var(--bg)] rounded-[var(--r-xl)] px-12 py-10 text-center
 shadow-[0_12px_40px_rgba(0,0,0,0.12)]"

/* 스피너: w-10 h-10 / border-t → --p / 0.7s linear infinite */
```

### Badge

```jsx
// src/components/ui/Badge.jsx

"inline-flex items-center font-body text-[11px] font-[600]
 px-2.5 py-0.5 rounded-[var(--r-full)]"

/* green: bg-[var(--success-light)] text-[#065f46] */
/* blue:  bg-[var(--p-light)] text-[var(--p)] */
/* gray:  bg-[var(--bg3)] text-[var(--t3)] */
```

### ButtonGroup

```jsx
// src/components/ui/ButtonGroup.jsx

"flex items-center border border-[var(--bd)] rounded-[var(--r-md)] overflow-hidden"
/* 레이블: font-body 11px / 600 / text-muted / px-2 pl-2.5 */
/* 버튼:   border-r border-[var(--bd)] / hover:bg-[var(--bg2)] / last:border-r-0 */
```

---

## 📱 React Native — 토큰 & 패턴

> **v6 신규 섹션** — 웹(Next.js)과 동일한 설계 기준을 RN/Expo에 적용

### 토큰 파일

```typescript
// src/mobile/tokens.ts

export const tokens = {
  /* Brand */
  p:       '#3B82F6',
  pHover:  '#2563EB',
  pLight:  '#EFF6FF',
  pDark:   '#1D4ED8',

  /* Semantic */
  success:      '#22C55E',
  successLight: '#DCFCE7',
  error:        '#EF4444',
  errorLight:   '#FEE2E2',
  warning:      '#F59E0B',
  warningLight: '#FEF3C7',
  info:         '#06B6D4',
  infoLight:    '#CFFAFE',

  /* Surface */
  bg:  '#FFFFFF',
  bg2: '#F8FAFC',
  bg3: '#F1F5F9',

  /* Text */
  t1: '#0F172A',
  t2: '#475569',
  t3: '#94A3B8',
  t4: '#CBD5E1',
  ti: '#FFFFFF',

  /* Border */
  bd:  '#E2E8F0',
  bdf: '#3B82F6',

  /* Radius */
  r: { sm: 6, md: 8, lg: 12, xl: 16, '2xl': 24 },

  /* Spacing */
  s: { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48 },
} as const;

/* Dark mode 토큰 */
export const tokensDark = {
  ...tokens,
  p:      '#60A5FA',
  pLight: '#1E3A5F',
  bg:  '#0B1120',
  bg2: '#141E30',
  bg3: '#1E2D42',
  t1:  '#F1F5F9',
  t2:  '#CBD5E1',
  t3:  '#64748B',
  bd:  '#1E2D42',
} as const;
```

### 다크모드 훅

```typescript
// src/mobile/hooks/useTokens.ts
import { useColorScheme } from 'react-native';
import { tokens, tokensDark } from '../tokens';

export function useTokens() {
  const scheme = useColorScheme();
  return scheme === 'dark' ? tokensDark : tokens;
}
```

### 공통 패턴

```typescript
// SafeAreaView 필수 적용
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';

// Pressable — 터치 타겟 최소 44×44px
<Pressable
  style={({ pressed }) => [
    styles.button,
    pressed && { opacity: 0.7 },
  ]}
  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
>

// Platform.select — 플랫폼별 분기
import { Platform } from 'react-native';
const shadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  android: {
    elevation: 3,
  },
});

// 폰트 로딩 (Expo)
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold } from '@expo-google-fonts/dm-sans';
import { Lora_400Regular, Lora_600SemiBold, Lora_700Bold } from '@expo-google-fonts/lora';
import { JetBrainsMono_400Regular, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
```

### RN 폰트 역할 매핑

```typescript
export const fonts = {
  display: {
    regular:    'PlusJakartaSans_400Regular',
    semibold:   'PlusJakartaSans_600SemiBold',
    bold:       'PlusJakartaSans_700Bold',
    extrabold:  'PlusJakartaSans_800ExtraBold',
  },
  body: {
    regular:    'DMSans_400Regular',
    medium:     'DMSans_500Medium',
    semibold:   'DMSans_600SemiBold',
  },
  english: {
    regular:    'Lora_400Regular',
    semibold:   'Lora_600SemiBold',
    bold:       'Lora_700Bold',
  },
  mono: {
    regular:    'JetBrainsMono_400Regular',
    bold:       'JetBrainsMono_700Bold',
  },
} as const;
```

### RN 접근성

```typescript
// 모든 버튼에 accessibilityLabel 필수
<Pressable accessibilityLabel="단어 발음 듣기" accessibilityRole="button">

// 최소 터치 타겟
style={{ minHeight: 44, minWidth: 44 }}

// 스크린리더 힌트
accessibilityHint="탭하면 단어 발음을 들을 수 있습니다"
```

---

## 🖥 프로젝트 모노레포 구조 (Turborepo)

> 웹(Next.js 14) + 앱(Expo) + 공유 패키지를 단일 레포에서 관리.
> 상업 서비스 표준에 맞춰 도메인 단위로 분리하고, 공통 디자인 토큰·타입을 패키지화.

```
vocaflow/                                     ← 모노레포 루트
├── apps/
│   ├── web/                                  ← Next.js 14 (App Router)
│   └── mobile/                               ← React Native (Expo)
├── packages/
│   ├── design-tokens/                        ← CSS Variables + RN tokens 단일 출처
│   ├── ui-shared/                            ← 플랫폼 무관 로직 (스코어 계산 등)
│   ├── types/                                ← 공유 TypeScript 타입 (DB·API)
│   └── eslint-config/                        ← 공통 린트 규칙
├── supabase/
│   ├── migrations/                           ← SQL 마이그레이션
│   ├── functions/                            ← Edge Functions
│   └── seed.sql
├── .github/
│   └── workflows/                            ← CI/CD (lint·test·deploy)
├── .vscode/
├── docs/                                     ← 운영/온보딩 문서
├── scripts/                                  ← 워크스페이스 유틸 스크립트
│   ├── smoke-tokens.mjs                      ← @vocaflow/design-tokens 런타임 검증
│   ├── verify-tokens.mjs                     ← 토큰 export 일관성 검증
│   ├── fix-mojibake.mjs                      ← 한글 깨짐 일괄 복구
│   ├── fix-mojibake-runs.mjs                 ← Slate runs 한글 깨짐 복구
│   └── marketing-ref-transform.mjs           ← 마케팅 레퍼런스 변환
├── turbo.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── tsconfig.base.json                        ← 워크스페이스 공통 TS 설정
├── package.json
├── .editorconfig · .prettierrc · .nvmrc      ← 코드 스타일·런타임 설정
├── CLAUDE.md                                 ← 디자인 시스템 SSoT (이 문서)
└── README.md
```

---

### 📂 apps/web — Next.js 14 (App Router)

```
apps/web/
├── public/                                   ← 정적 자산 (favicon, og-image, manifest.json)
│   ├── icons/
│   ├── images/
│   ├── fonts/                                ← self-hosted 백업용
│   ├── favicon.ico
│   ├── robots.txt
│   ├── sitemap.xml
│   └── manifest.json                         ← PWA
├── src/
│   ├── app/                                  ← App Router
│   │   ├── (auth)/                           ← 인증 라우트 그룹
│   │   │   ├── layout.tsx                    ← 인증 전용 레이아웃 (헤더 없음)
│   │   │   ├── login/page.tsx
│   │   │   ├── signup/page.tsx
│   │   │   ├── reset-password/page.tsx
│   │   │   └── verify-email/page.tsx
│   │   ├── (marketing)/                      ← 랜딩/공개 페이지
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx                      ← 랜딩 (= 루트 /)
│   │   │   ├── pricing/page.tsx
│   │   │   ├── about/page.tsx
│   │   │   ├── terms/page.tsx
│   │   │   └── privacy/page.tsx
│   │   ├── (app)/                            ← 게임 풀스크린 라우트 그룹 (사이드바 X)
│   │   │   └── play/
│   │   │       └── wordblitz/page.tsx        ← WordBlitz 풀스크린 플레이
│   │   ├── (main)/                           ← 로그인 후 앱 (라우트 그룹 — URL 비포함)
│   │   │   ├── layout.tsx                    ← Sidebar + main 레이아웃
│   │   │   ├── hub/page.tsx                  ← Hub (Home+Dashboard 통합) ★ 진입점
│   │   │   ├── library/page.tsx              ← 라이브러리 (콘텐츠 카드 · 큐레이션)
│   │   │   ├── text/page.tsx                 ← TextViewer (입력 → AI 분석 → /wordvault 인계)
│   │   │   ├── text/[id]/page.tsx            ← 학습 워크스페이스 (Reading + Recall + Audio)
│   │   │   ├── wordvault/page.tsx            ← WordVault 단어장
│   │   │   ├── dashboard/page.tsx            ← 대시보드 (StatCard·Heatmap·Ring·Trend·Activity)
│   │   │   ├── flashcard/page.tsx            ← Flashcard Hub (Continue·Queue·정확도·시작 설정)
│   │   │   ├── flashcard/play/page.tsx       ← Flashcard 세션 (SM-2 SRS · 4단계 평가)
│   │   │   ├── spellforge/page.tsx           ← SpellForge Hub (Memory Decay · Best 점수)
│   │   │   ├── spellforge/play/page.tsx      ← SpellForge 세션 (스펠링 타이핑 · IME 분리)
│   │   │   ├── wordblitz/page.tsx            ← WordBlitz Hub (게임 소개 · 최근 점수)
│   │   │   ├── scriptquiz/page.tsx           ← ScriptQuiz Hub (Chapter grid · 한영 토글)
│   │   │   ├── scriptquiz/play/page.tsx      ← ScriptQuiz 세션 (3-screen · 영어 immersion)
│   │   │   ├── dictate/page.tsx              ← Dictation Hub (CEFR 자동 감지 · 리소스 선택) ★v06.7
│   │   │   ├── dictate/setup/page.tsx        ← Dictation Setup (단위/갯수/순서/채점/속도/힌트)
│   │   │   ├── dictate/session/page.tsx      ← Dictation 세션 (TTS · 단어별 채점 · 4단계 힌트 · Focus)
│   │   │   ├── dictate/results/page.tsx      ← Dictation 결과 (오류 패턴 · 오답 단어 · 다음 단계)
│   │   │   └── settings/page.tsx             ← 설정 (계정·테마·TTS·알림·데이터)
│   │   ├── (app)/                            ← 게임 풀스크린 라우트 그룹 (사이드바 X)
│   │   │   └── play/wordblitz/page.tsx       ← WordBlitz 3D 풀스크린 (인형뽑기 · GLB)
│   │   ├── admin/                            ← 관리자 콘솔 (§15 / route group 미사용 → URL = /admin/*)
│   │   │   ├── layout.tsx                    ← AdminSidebar 적용
│   │   │   ├── page.tsx                      ← 관리자 대시보드 (KPI · 섹션 · 최근 활동)
│   │   │   ├── users/page.tsx                ← stub · 사용자 관리
│   │   │   ├── library/page.tsx              ← stub · 콘텐츠 관리
│   │   │   ├── vocabulary/page.tsx           ← stub · 단어장 마스터
│   │   │   ├── analytics/page.tsx            ← stub · 플랫폼 분석
│   │   │   ├── reports/page.tsx              ← stub · 신고/문의
│   │   │   ├── billing/page.tsx              ← stub · 결제/구독
│   │   │   └── settings/page.tsx             ← stub · 시스템 설정
│   │   ├── dev/                              ← 개발 검증
│   │   │   └── components/page.tsx           ← Parts Kit 컴포넌트 카탈로그
│   │   ├── api/                              ← Route Handlers (현재 auth/callback 폴더만 존재)
│   │   │   ├── auth/
│   │   │   │   └── callback/                 ← Supabase OAuth 콜백 (route.ts 미구현 — Phase 2)
│   │   │   /* 예정: analyze · tts · quiz · upload · health */
│   │   ├── page.tsx                          ← 루트 / — 화면 인덱스 + 진행률 대시보드 (Phase 1.5 dev 진입점)
│   │   ├── error.tsx                         ← 전역 에러 바운더리 (필수)
│   │   ├── not-found.tsx                     ← 404 (필수)
│   │   ├── loading.tsx                       ← 전역 로딩 스피너 (필수)
│   │   ├── globals.css                       ← CSS Variables (이 문서 §Colors)
│   │   ├── favicon.ico
│   │   └── layout.tsx                        ← Root layout + 폰트 + Provider
│   ├── components/
│   │   ├── ui/                               ← Parts Kit 기반 공통 (재사용 가능)
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Checkbox.tsx
│   │   │   ├── Radio.tsx
│   │   │   ├── Toggle.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Toast.tsx
│   │   │   ├── Tooltip.tsx
│   │   │   ├── ProgressBar.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── ButtonGroup.tsx
│   │   │   ├── LoadingOverlay.tsx
│   │   │   ├── Skeleton.tsx
│   │   │   └── EmptyState.tsx
│   │   ├── layout/                           ← 페이지 골격
│   │   │   ├── Header.tsx
│   │   │   ├── BottomTabBar.tsx
│   │   │   ├── Sidebar.tsx                   ← 데스크톱 전용
│   │   │   ├── PageContainer.tsx
│   │   │   └── Footer.tsx
│   │   ├── dictation/                        ← Dictation 모듈 전용 (v06.7 신규)
│   │   │   ├── DictationHubClient.tsx        ← Hub: ModuleHero · Smart Suggestion · 리소스 · 최근 세션
│   │   │   ├── DictationSetupClient.tsx      ← Setup: CEFR 6레벨 · 단위 3 · 갯수 4 · 순서 3 · 채점 2 · 고급
│   │   │   ├── DictationSessionClient.tsx    ← Session: TTS 재생 · 단어별 채점 · 4단계 힌트 · Focus Mode
│   │   │   └── DictationResultsClient.tsx    ← Results: Hero 정확도 · 오류 패턴 분석 · 오답 단어 · 다음 단계
│   │   ├── text-viewer/                      ← TextViewer 모듈 전용 (v06.1 분리)
│   │   │   ├── InputModeTabs.tsx             ← 직접 입력 / 파일 / URL 탭
│   │   │   ├── TextInput.tsx                 ← 직접 입력
│   │   │   ├── FileUploadArea.tsx            ← PDF · DOCX · TXT 업로드
│   │   │   ├── UrlInput.tsx                  ← URL 가져오기 (Phase 2)
│   │   │   ├── SampleScripts.tsx             ← 샘플 원문 카드
│   │   │   ├── ScriptDisplay.tsx             ← 본문 렌더링
│   │   │   ├── AnalysisResult.tsx            ← AI 단어 분석 결과 + WordVault 인계
│   │   │   ├── WordList.tsx                  ← 분석된 단어 리스트
│   │   │   ├── WordCard.tsx                  ← 단어 카드
│   │   │   └── analysis-types.ts             ← 도메인 타입
│   │   ├── wordvault/                        ← WordVault 단어장 전용
│   │   │   ├── PageHeader.tsx                ← 단어장 헤더 (Hero)
│   │   │   ├── CollectionsRow.tsx            ← 단어장 모음 가로 스크롤
│   │   │   ├── SearchRow.tsx                 ← 검색 + 필터
│   │   │   ├── HideToggleBar.tsx             ← 영단어/뜻 숨김 토글 (Desirable Difficulty)
│   │   │   ├── StatsGrid.tsx                 ← 단어장 통계 그리드
│   │   │   ├── WordList.tsx                  ← 단어 5열 그리드
│   │   │   ├── WordRow.tsx                   ← 단어 행
│   │   │   ├── ListenPanel.tsx               ← 전체 듣기 패널
│   │   │   ├── StudyMode.tsx                 ← 학습 모드 진입 패널
│   │   │   ├── hooks/                        ← 단어장 도메인 훅
│   │   │   ├── mock-data.ts
│   │   │   └── types.ts
│   │   ├── flashcard/                        ← Flashcard 게임 (top-level · v06.5 위치 변경)
│   │   │   ├── FlashcardSession.tsx          ← 세션 컨테이너 (SM-2 SRS)
│   │   │   ├── Card.tsx · CardFront.tsx · CardBack.tsx  ← 3D flip 카드
│   │   │   ├── RecallPhase.tsx · FirstJudge.tsx        ← 능동적 회상 단계
│   │   │   ├── HonestyHint.tsx · MicroPause.tsx        ← 학습 과학 보조
│   │   │   ├── SRSBar.tsx · ForgettingCurve.tsx        ← 진행 가시화
│   │   │   ├── CompletionState.tsx
│   │   │   └── mock-data.ts
│   │   ├── spellforge/                       ← SpellForge 게임 (top-level · v06.5 위치 변경)
│   │   │   ├── SpellForge.tsx                ← 메인 컨테이너
│   │   │   ├── ModeSelector.tsx              ← 단어→철자 / 뜻→철자 모드
│   │   │   ├── MeaningDisplay.tsx · InputSlots.tsx · SingleBox.tsx
│   │   │   ├── ConfirmButton.tsx · IMEIndicator.tsx
│   │   │   ├── ReflectionHint.tsx · MicroPause.tsx     ← 학습 과학 보조
│   │   ├── game/                             ← 게임 공통 + 미이동 모듈 (예정 분리)
│   │   │   ├── shared/                       ← 게임 공통 (현재 빈 폴더 — GameTimer/ScoreCircle 등 예정)
│   │   │   ├── flashcard/                    ← 빈 폴더 (top-level components/flashcard/ 사용)
│   │   │   ├── spellforge/                   ← 빈 폴더 (top-level components/spellforge/ 사용)
│   │   │   ├── wordblitz/                    ← 예정
│   │   │   │   ├── WordBlitzGame.tsx
│   │   │   │   ├── WordBlitzOption.tsx
│   │   │   │   └── WordBlitzReaction.tsx     ← 정글 환경
│   │   │   └── scriptquiz/                   ← 예정
│   │   │       ├── ScriptQuizStart.tsx
│   │   │       ├── ScriptQuizQuestion.tsx
│   │   │       ├── ScriptQuizFeedback.tsx
│   │   │       └── ScriptQuizResult.tsx
│   │   ├── dashboard/                        ← Dashboard 전용
│   │   │   ├── StatCard.tsx
│   │   │   ├── WeeklyHeatmap.tsx
│   │   │   ├── ModuleAccuracyRing.tsx
│   │   │   ├── ScoreTrendChart.tsx
│   │   │   └── RecentActivity.tsx
│   │   ├── home/                             ← Home Hub 전용 (§14, v06.4)
│   │   │   ├── HubHero.tsx                   ← 인사 + Streak + Today CTA + inline Stats
│   │   │   ├── ModuleCard.tsx                ← 7모듈 정사각 카드 (아이콘·마지막 학습)
│   │   │   └── ContinueCard.tsx              ← 이어하기 (Lora 제목·진행률·CTA)
│   │   ├── library/                          ← 라이브러리 전용
│   │   │   ├── CEFRBadge.tsx
│   │   │   ├── CategoryChip.tsx
│   │   │   ├── ContinueCard.tsx
│   │   │   ├── CurationCard.tsx
│   │   │   └── LibraryCard.tsx
│   │   ├── workspace/                        ← /text/[id] 학습 워크스페이스 전용
│   │   │   ├── ContextBar.tsx                ← 상단 sticky 바 (북마크·타이포·인사이트·집중)
│   │   │   ├── ReadingUniverse.tsx           ← Lora 영어 본문 + 단어 hover/click + 문장 재생
│   │   │   ├── RecallCard.tsx                ← 단어 의미 회상 카드 (3단계 판정)
│   │   │   ├── ModePills.tsx                 ← 7모듈 진입 pill (read/listen/words/...)
│   │   │   ├── Pagination.tsx
│   │   │   ├── FloatingAudioPlayer.tsx       ← 하단 고정 오디오 플레이어
│   │   │   ├── FloatingSparkle.tsx           ← 다음 단계 추천 카드
│   │   │   ├── InsightPanel.tsx              ← 우측 슬라이드 패널 (북마크·기억 상태)
│   │   │   ├── KeyboardHints.tsx
│   │   │   └── TypePopover.tsx
│   │   ├── admin/                            ← 관리자 콘솔 전용 (§15, v06.5)
│   │   │   └── AdminSidebar.tsx              ← 보라 액센트 · 신고 뱃지 · 사용자 앱 복귀
│   │   ├── dev/                              ← 개발 도구 (배포 시 함께 빌드)
│   │   │   └── StubPage.tsx                  ← 미구현 페이지 placeholder (제목·예정 기능·CTA)
│   │   └── marketing/                        ← 랜딩/공개 페이지 전용
│   │       ├── HeroSection.tsx
│   │       ├── FeatureGrid.tsx
│   │       ├── PricingTable.tsx
│   │       ├── TestimonialList.tsx
│   │       └── FAQAccordion.tsx
│   ├── hooks/                                ← React 훅 (UI 연결용)
│   │   ├── useTheme.ts                       ← 다크모드 토글 (localStorage + data-theme)
│   │   ├── useFocusMode.ts                   ← /text/[id] 집중 모드 (30초 무활동)
│   │   ├── useKeyboardShortcuts.ts           ← /text/[id] 키보드 단축키
│   │   ├── useDelayedFeedback.ts             ← Recall 단계 지연 피드백 (250ms)
│   │   ├── useActiveHint.ts                  ← 활성 힌트 표시
│   │   ├── useFlashcardSession.ts            ← Flashcard SM-2 세션
│   │   ├── useFlashcardKeyboard.ts           ← Flashcard 키보드 (1/2/3·Space)
│   │   ├── useRecallPhase.ts                 ← 능동적 회상 단계 상태머신
│   │   ├── useStudyingMode.ts                ← 학습 모드 진입/이탈
│   │   ├── useSpeechSynthesis.ts             ← Web Speech API TTS 폴백
│   │   ├── useSpellForgeSession.ts           ← SpellForge 세션
│   │   ├── useTypingMode.ts                  ← 타이핑 모드 상태
│   │   ├── useIMEDetection.ts                ← 한글 IME 입력 감지 (스펠링 게임)
│   │   └── dictation/                        ← Dictation 훅 (v06.7)
│   │       ├── useAudioControl.ts            ← TTS 재생/반복/정지 (Web Speech API)
│   │       └── useDictationSession.ts        ← Dictation 세션 상태 머신 (sessionStorage)
│   │   /* 예정: useAuth · useVocabulary · useTTS · useGameScore
│   │            · useDashboard · useSupabase · useMediaQuery · useDebounce */
│   ├── lib/                                  ← 외부 통합 + 유틸 (서버사이드 OK)
│   │   ├── supabase/
│   │   │   ├── server.ts                     ← Server Component / Route Handler
│   │   │   ├── queries.ts                    ← 공통 쿼리
│   │   │   /* 예정: client.ts(브라우저) · middleware.ts(세션 갱신) */
│   │   ├── text-viewer/                      ← TextViewer 도메인 유틸
│   │   │   └── handoff.ts                    ← /text → /wordvault 단어 인계 (sessionStorage)
│   │   ├── srs/                              ← 간격 반복 알고리즘
│   │   │   └── sm2.ts                        ← Flashcard SM-2 알고리즘
│   │   ├── spellforge/                       ← SpellForge 도메인 로직
│   │   │   ├── scoring.ts                    ← 점수 계산
│   │   │   ├── adaptiveDifficulty.ts         ← 적응형 난이도
│   │   │   └── typoPattern.ts                ← 오타 패턴 분석
│   │   ├── wordblitz/                        ← WordBlitz 3D 도메인
│   │   │   ├── theme.ts                      ← WB_COLORS · WB_DIMS (박스 6.5×5.2×3.0 · 콘솔 기울임)
│   │   │   ├── data.ts                       ← 단어 풀 + 인형 슬롯 + GLB 매핑
│   │   │   └── types.ts                      ← Dictation 타입
│   │   ├── dictation/                        ← Dictation 도메인 (v06.7 신규)
│   │   │   ├── types.ts                      ← Config·Session·Item·WordResult·ErrorPattern
│   │   │   ├── cefr.ts                       ← A1~C2 + 그룹별 (초/중/고) + 자동 감지
│   │   │   ├── text-splitter.ts              ← 약어 처리 + 문장/단락/전체 분리
│   │   │   ├── scoring.ts                    ← Levenshtein + Word alignment + Smart/Strict
│   │   │   ├── analyzer.ts                   ← 6개 패턴 (-ed·관사·복수·동음이의·스펠·단어선택)
│   │   │   ├── audio-control.ts              ← Web Speech API + 자동반복 + 무음 간격
│   │   │   ├── hint.ts                       ← 4단계 힌트 (-5/-3/-10/-25)
│   │   │   └── storage.ts                    ← localStorage + 시드 (A2/B1/B2 3종)
│   │   └── utils/                            ← cn · format · validation · constants (예정)
│   ├── types/                                ← TypeScript 타입
│   │   ├── database.ts                       ← Supabase 자동 생성
│   │   ├── flashcard.ts                      ← Flashcard 도메인 타입
│   │   ├── library.ts                        ← Library 도메인 타입
│   │   └── spellforge.ts                     ← SpellForge 도메인 타입
│   │   /* 예정: api.ts · index.ts */
│   ├── styles/
│   │   └── fonts.css                         ← @font-face self-host (백업)
│   └── middleware.ts                         ← Next.js 미들웨어 (Auth 보호)
├── tests/
│   ├── unit/                                 ← Vitest
│   ├── integration/
│   └── e2e/                                  ← Playwright
├── .env.local                                ← gitignore
├── .env.example
├── next.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

#### ✅ 정리 완료 (v06.7 청소)

| 항목 | 처리 |
|------|------|
| 잘못 위치한 훅 5개 (`src/use*.ts` 중복) | 삭제 — `src/hooks/` 단일 출처 |
| 잘못 위치한 페이지 `components/workspace/text/[id]/page.tsx` (0 bytes) | 삭제 — 실제 라우트는 `app/(main)/text/[id]/page.tsx` |
| 빈 placeholder 폴더 9개 (`components/audio` · `components/game/{flashcard,shared,spellforge}` · `lib/{analytics,openai,parsers,scoring}` · `config` · `stores`) | 삭제 — 사용 시점에 재생성 |
| 빈 API 라우트 폴더 5개 (`api/{analyze,health,quiz,tts,upload}`) | 삭제 — 구현 시 재생성. `api/auth/callback`은 OAuth 필수라 `.gitkeep` 유지 |

#### 🚧 남은 정리 후보

| 항목 | 위치 | 처리 방향 |
|------|------|-----------|
| 개인 파일 커밋 | 루트 `Downloads/` (GLB·PDF·zip 5.2MB) | `git rm -r --cached Downloads/` + `.gitignore`에 `Downloads/` 추가 |

---

### 📂 apps/mobile — React Native (Expo)

```
apps/mobile/
├── assets/
│   ├── icons/
│   ├── images/
│   ├── fonts/                                ← @expo-google-fonts 외 self-host
│   ├── splash.png
│   ├── icon.png
│   └── adaptive-icon.png
├── src/
│   ├── app/                                  ← Expo Router (file-based)
│   │   ├── (auth)/
│   │   │   ├── _layout.tsx
│   │   │   ├── login.tsx
│   │   │   └── signup.tsx
│   │   ├── (main)/
│   │   │   ├── _layout.tsx                   ← Tab Navigator
│   │   │   ├── index.tsx                     ← Home
│   │   │   ├── text.tsx
│   │   │   ├── wordvault.tsx
│   │   │   ├── flashcard.tsx
│   │   │   ├── spellforge.tsx
│   │   │   ├── wordblitz.tsx
│   │   │   ├── scriptquiz.tsx
│   │   │   ├── dashboard.tsx
│   │   │   └── settings.tsx
│   │   └── _layout.tsx                       ← Root + 폰트 로드
│   ├── components/                           ← 웹 components/ 와 동일 구조
│   │   ├── ui/
│   │   ├── layout/
│   │   ├── audio/
│   │   ├── text-viewer/
│   │   ├── wordvault/
│   │   ├── game/
│   │   │   ├── shared/
│   │   │   ├── flashcard/
│   │   │   ├── spellforge/
│   │   │   ├── wordblitz/
│   │   │   └── scriptquiz/
│   │   ├── dashboard/
│   │   └── marketing/
│   ├── hooks/                                ← 웹과 동일 (RN 호환만 다르게)
│   ├── stores/                               ← 웹과 동일 (Zustand 그대로 사용)
│   ├── lib/                                  ← 웹과 동일 + RN 전용
│   │   ├── supabase/                         ← AsyncStorage 어댑터
│   │   ├── openai/
│   │   ├── tts/                              ← expo-speech 폴백
│   │   ├── audio/                            ← expo-av
│   │   ├── storage/                          ← expo-secure-store
│   │   └── utils/
│   ├── theme/                                ← RN 전용 토큰 (CSS Var → JS 객체)
│   │   ├── tokens.ts                         ← @vocaflow/design-tokens 임포트
│   │   ├── colors.ts
│   │   └── ThemeProvider.tsx
│   └── types/
├── app.json                                  ← Expo 설정
├── eas.json                                  ← EAS Build/Submit
├── babel.config.js
├── metro.config.js
├── tsconfig.json
├── package.json
└── README.md
```

---

### 📂 packages/ — 공유 패키지 (모노레포 핵심)

```
packages/
├── design-tokens/                            ← 웹·앱 토큰 단일 출처
│   ├── src/
│   │   ├── colors.ts                         ← CSS Vars + RN 동시 export
│   │   ├── spacing.ts
│   │   ├── radius.ts
│   │   ├── shadow.ts
│   │   ├── motion.ts
│   │   ├── typography.ts
│   │   └── index.ts
│   ├── package.json                          ← name: "@vocaflow/design-tokens"
│   └── tsconfig.json
├── ui-shared/                                ← 플랫폼 무관 로직
│   ├── src/
│   │   ├── scoring/                          ← SM-2, 게임 점수 계산
│   │   ├── validation/                       ← Zod 스키마 공유
│   │   └── index.ts
│   └── package.json                          ← name: "@vocaflow/ui-shared"
├── types/                                    ← DB·API 타입 공유
│   ├── src/
│   │   ├── database.ts                       ← Supabase 자동 생성
│   │   ├── api.ts
│   │   └── index.ts
│   └── package.json                          ← name: "@vocaflow/types"
└── eslint-config/
    ├── index.js                              ← 공통 린트 규칙
    └── package.json
```

---

### 📂 supabase/ — DB & 서버리스

```
supabase/
├── migrations/
│   ├── 20251001000000_init_schema.sql        ← texts, vocabularies 등
│   ├── 20251015000000_add_rls.sql
│   └── 20251101000000_add_dashboard_views.sql
├── functions/                                ← Edge Functions (선택)
│   ├── analyze-text/
│   └── generate-quiz/
├── seed.sql                                  ← 시드 데이터
└── config.toml
```

---

### 📂 docs/ — 운영 문서

```
docs/
├── 00_project_brief.md                       ← 프로젝트 브리프 (기획·범위)
├── ONBOARDING.md                             ← 신규 개발자 셋업
├── DEPLOY.md                                 ← Vercel + Railway + EAS 배포
├── API.md                                    ← API Route 명세
├── ARCHITECTURE.md                           ← 시스템 다이어그램
├── DESIGN_DECISIONS.md                       ← ADR (Architecture Decision Records)
└── references/                               ← 외부 레퍼런스 (Quizlet Parts Kit·게임 프로토타입 HTML 등)
```

---

### 파일 경로 주석 규칙 (코드 작성 시 첫 줄 필수)

```typescript
// 웹 (Next.js)
// apps/web/src/components/ui/Button.tsx              ← 공통 UI
// apps/web/src/components/game/spellforge/SpellForgeGrid.tsx  ← 게임
// apps/web/src/components/wordvault/WordList.tsx     ← 단어장
// apps/web/src/components/dashboard/StatCard.tsx     ← 대시보드
// apps/web/src/app/(main)/hub/page.tsx               ← 페이지 (Home+Dashboard 통합)
// apps/web/src/lib/supabase/client.ts                ← Supabase 클라이언트
// apps/web/src/stores/authStore.ts                   ← Zustand 스토어

// 앱 (Expo)
// apps/mobile/src/components/ui/Button.tsx           ← 공통 UI (RN 버전)
// apps/mobile/src/app/(main)/dashboard.tsx           ← 페이지

// 공유 패키지
// packages/design-tokens/src/colors.ts               ← 토큰
// packages/types/src/database.ts                     ← 공유 타입
```

### 폴더 분리 원칙 (Single Responsibility)

| 폴더 | 책임 | 들어가는 것 / 들어가면 안 되는 것 |
|------|------|------|
| `components/ui` | 디자인 시스템 원자 | Parts Kit 컴포넌트만. 비즈니스 로직 금지 |
| `components/{도메인}` | 도메인별 합성 컴포넌트 | API 호출 OK. 다른 도메인 컴포넌트 import 금지 |
| `components/admin` | 관리자 콘솔 전용 | AdminSidebar 등. 사용자 앱과 격리 (보라 액센트로 시각 구분) |
| `components/dev` | 개발 도구 | StubPage 등 placeholder. 프로덕션 의미 부여 금지 |
| `hooks` | UI ↔ 데이터 연결 | React 훅만. 순수 함수는 `lib/utils` |
| `stores` | 전역 클라이언트 상태 | Zustand 스토어. 서버 상태는 React Query/SWR로 |
| `lib` | 외부 통합 + 유틸 | API SDK 래핑·파서·계산. React 훅 금지 |
| `types` | TS 타입 | 인터페이스·타입·enum. 실행 코드 금지 |
| `config` | 환경 설정 | env 검증·사이트 메타. 비즈니스 로직 금지 |

---

## 📊 Dashboard — v6 신규 섹션

> Parts Kit §13 신규 추가. 학습 통계·진행률·점수 시각화 컴포넌트 전체 정의.

### 레이아웃 구조

```
┌─────────────────────────────────────┐
│  Header: "📊 학습 현황"              │
├──────┬──────┬──────┬────────────────┤
│ 오늘 │ 연속 │ 총   │ 정확도         │ ← StatCard ×4
│ 학습 │ 일수 │ 단어 │                │
├─────────────────────────────────────┤
│  주간 학습 히트맵 (7일 × 24칸)       │ ← WeeklyHeatmap
├──────────────┬──────────────────────┤
│ 모듈별 정확도 │ 점수 추이 라인차트    │ ← AccuracyRing + ScoreTrend
│ (도넛 링 ×4) │                      │
├─────────────────────────────────────┤
│  최근 학습 활동                       │ ← RecentActivity
└─────────────────────────────────────┘
```

### StatCard 컴포넌트

```jsx
// src/components/dashboard/StatCard.tsx

<div className="
  flex flex-col gap-1
  p-5 rounded-[var(--r-lg)]
  bg-[var(--bg)] border border-[var(--bd)]
  shadow-[var(--sh-sm)]
">
  {/* 레이블: s1 스케일 / text-muted */}
  <span className="font-display text-[11px] font-[700] uppercase
                   tracking-[0.06em] text-[var(--t3)]">
    {label}
  </span>

  {/* 값: s2 스케일 — 40px / 800 */}
  <span className="font-display text-[40px] font-[800] leading-none
                   text-[var(--t1)]">
    {value}
  </span>

  {/* 보조 정보 */}
  {sub && (
    <span className="font-body text-[12px] text-[var(--t3)]">{sub}</span>
  )}

  {/* 트렌드 표시 (선택) */}
  {trend && (
    <span className={`font-body text-[12px] font-[600] ${
      trend > 0 ? 'text-[var(--success)]' : 'text-[var(--error)]'
    }`}>
      {trend > 0 ? '▲' : '▼'} {Math.abs(trend)}%
    </span>
  )}
</div>

/* 5가지 변형 */
variant="today"    — 오늘 학습 단어 수    — 기본 (Card)
variant="streak"   — 연속 학습 일수       — --streak 포인트 컬러
variant="total"    — 누적 학습 단어       — 기본
variant="accuracy" — 전체 정확도 %        — --success / --error 조건부
variant="inline"   — Hero 내부 임베드용   — 카드 박스 제거 / 값 = s2 흰색 / 레이블 = opacity-80
                                          — Home Hub HubHero 내 1열 3분할에서 사용 (v06.4)

/* inline variant 패턴 */
<div className="flex flex-col gap-0.5">
  <span className="font-display text-[11px] font-[700] uppercase
                   tracking-[0.06em] opacity-80">{label}</span>
  <span className="font-display text-[40px] font-[800] leading-none">{value}</span>
  {sub && <span className="font-body text-[12px] opacity-70">{sub}</span>}
</div>
```

### WeeklyHeatmap

```jsx
// src/components/dashboard/WeeklyHeatmap.tsx

/* 7열(요일) × 4행(주) 그리드 */
/* 각 셀: 12px×12px / rounded-sm / 색상 강도 — 학습량에 따라 4단계 */

/* 색상 강도 (light 모드) */
학습 없음: bg-[var(--bg3)]              /* #F1F5F9 */
1~3개:    bg-[var(--p-light)]           /* #EFF6FF */
4~8개:    bg-[var(--p)]/40              /* primary 40% */
9+개:     bg-[var(--p)]                 /* primary 100% */

/* 렌더 */
<div className="grid grid-cols-7 gap-1">
  {weeks.map((week) =>
    week.map((day) => (
      <Tooltip key={day.date} content={`${day.date}: ${day.count}개`}>
        <div
          className="w-3 h-3 rounded-sm"
          style={{ backgroundColor: getIntensityColor(day.count) }}
        />
      </Tooltip>
    ))
  )}
</div>
```

### ModuleAccuracyRing

```jsx
// src/components/dashboard/ModuleAccuracyRing.tsx

/* 모듈별 도넛 링 차트 — 4개 (Flashcard / SpellForge / WordBlitz / ScriptQuiz) */

/* SVG 도넛 링 */
<svg width="80" height="80" viewBox="0 0 80 80">
  {/* 배경 원 */}
  <circle cx="40" cy="40" r="30"
    fill="none" stroke="var(--bg3)" strokeWidth="8"/>
  {/* 정확도 원 */}
  <circle cx="40" cy="40" r="30"
    fill="none"
    stroke={moduleColor}          /* 모듈별 고정 컬러 */
    strokeWidth="8"
    strokeDasharray={`${2 * Math.PI * 30}`}
    strokeDashoffset={`${2 * Math.PI * 30 * (1 - accuracy)}`}
    strokeLinecap="round"
    transform="rotate(-90 40 40)"
    style={{ transition: 'stroke-dashoffset 1s var(--ease-out)' }}
  />
  {/* 중앙 퍼센트 */}
  <text x="40" y="40" textAnchor="middle" dominantBaseline="central"
    fill="var(--t1)"
    style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 14, fontWeight: 700 }}>
    {Math.round(accuracy * 100)}%
  </text>
</svg>

/* 모듈별 색상 */
Flashcard:  var(--p)       /* 파랑 */
SpellForge: #4A9FCF        /* 게임 전용 파란 패널 */
WordBlitz:  #22C55E        /* 초록 — 정글 테마 */
ScriptQuiz: var(--active)  /* 앰버 */
```

### ScoreTrendChart

```jsx
// src/components/dashboard/ScoreTrendChart.tsx

/* 최근 7일 점수 라인 차트 */
/* Recharts 또는 순수 SVG polyline */

/* SVG 라인 차트 패턴 */
<svg className="w-full" height="120" viewBox="0 0 300 120">
  {/* 그리드 선: stroke-[var(--bg3)] strokeDasharray="4 4" */}
  {/* 라인: stroke-[var(--p)] strokeWidth="2" fill="none" */}
  {/* 점: cx/cy fill-[var(--p)] r="4" — hover: r="6" */}
  {/* 영역: fill-[var(--p)]/10 — 라인 아래 채움 */}
</svg>

/* 범례: 모듈별 컬러 + 이름 */
/* x축: 날짜 (MM/DD) / y축: 점수 (0~100) */
```

### RecentActivity

```jsx
// src/components/dashboard/RecentActivity.tsx

/* 최근 학습 활동 타임라인 */
<div className="flex flex-col divide-y divide-[var(--bg3)]">
  {activities.map((act) => (
    <div key={act.id} className="flex items-center gap-3 py-3">

      {/* 모듈 아이콘 */}
      <div className="w-9 h-9 rounded-[var(--r-md)] flex items-center justify-center
                      bg-[var(--p-light)] text-[var(--p)] flex-shrink-0 text-[16px]">
        {moduleIcon[act.module]}
      </div>

      {/* 내용 */}
      <div className="flex-1 min-w-0">
        {/* 모듈명: body-2 / 600 */}
        <p className="font-body text-[14px] font-[600] text-[var(--t1)] truncate">
          {moduleLabel[act.module]}
        </p>
        {/* 원문 제목: body-4 / text-muted */}
        <p className="font-body text-[12px] text-[var(--t3)] truncate">
          {act.textTitle}
        </p>
      </div>

      {/* 우측: 점수 + 시간 */}
      <div className="text-right flex-shrink-0">
        <p className="font-display text-[14px] font-[700] text-[var(--t1)]">
          {act.score}점
        </p>
        <p className="font-body text-[11px] text-[var(--t3)]">
          {act.relativeTime}
        </p>
      </div>

    </div>
  ))}
</div>

/* 모듈 아이콘 매핑 */
const moduleIcon = {
  flashcard:  '🃏',
  spellforge: '⚡',
  wordblitz:  '🌴',
  scriptquiz: '📝',
} as const;
```

### Dashboard Supabase 쿼리

```typescript
// src/hooks/useDashboard.ts

// 오늘 학습 단어 수
const { data: todayCount } = await supabase
  .from('learning_records')
  .select('id', { count: 'exact' })
  .eq('user_id', userId)
  .gte('attempted_at', todayStart);

// 연속 학습 일수 (streak)
// learning_records에서 날짜별 그룹핑 → 연속 날짜 계산

// 주간 히트맵 데이터
const { data: weeklyData } = await supabase
  .from('learning_records')
  .select('attempted_at')
  .eq('user_id', userId)
  .gte('attempted_at', sevenDaysAgo);

// 모듈별 정확도
const { data: moduleStats } = await supabase
  .from('learning_records')
  .select('module, is_correct')
  .eq('user_id', userId);

// 점수 추이 (최근 7일 scores)
const { data: scoreTrend } = await supabase
  .from('scores')
  .select('score, module, created_at')
  .eq('user_id', userId)
  .order('created_at', { ascending: true })
  .gte('created_at', sevenDaysAgo);
```

---

## 🏠 Home Hub — v6.4 신규 섹션

> v06.3에서 신설된 `(main)/hub/page.tsx` 의 본문 컴포넌트 정의.
> Home(인사·이어하기·빠른 진입)과 Dashboard(통계·활동) 통합 진입점.
> **설계 원칙**: F-pattern 시선 정합 + Flow State 진입 보조 — 첫 화면에서 "지금 무엇을 할지" 결정 부담을 최소화하고 한 클릭 안에 학습 진입 유도.

### 레이아웃 구조 — 4영역

```
┌──────────────────────────────────────────────────┐
│  ① Hero                                          │ ← HubHero (full-width gradient)
│     인사 + Streak + Today CTA                    │
│     하단 inline Stats 3분할 (StatCard inline)     │
├──────────────────────────────────────────────────┤
│  ② Module                                        │ ← ModuleCard ×7
│     [원문][단어][카드][스펠][블리츠][퀴즈][통계]    │   정사각·아이콘·"마지막 학습"
├──────────────────────────────────────────────────┤
│  ③ Continue                                      │ ← ContinueCard
│     이어하기 (Lora 제목 + 진행률 + CTA)            │
├──────────────────────────────────────────────────┤
│  ④ Reflection                                    │ ← RecentActivity (§13 재사용)
│     최근 학습 활동 회고                            │
└──────────────────────────────────────────────────┘

전체 컨테이너: max-w-6xl · mx-auto · gap-6 · p-4 md:p-8
```

### 페이지 진입점

```tsx
// apps/web/src/app/(main)/hub/page.tsx
import { HubHero } from '@/components/home/HubHero';
import { ModuleCard } from '@/components/home/ModuleCard';
import { ContinueCard } from '@/components/home/ContinueCard';
import { RecentActivity } from '@/components/dashboard/RecentActivity';

export default function HubPage() {
  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto p-4 md:p-8">
      {/* ① Hero — full-width (Stats inline 내장) */}
      <HubHero />

      {/* ② Module — 7열 (모바일 2열 / 태블릿 4열) */}
      <section aria-label="학습 모듈">
        <h2 className="sr-only">학습 모듈</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <ModuleCard module="text"       />
          <ModuleCard module="wordvault"  />
          <ModuleCard module="flashcard"  />
          <ModuleCard module="spellforge" />
          <ModuleCard module="wordblitz"  />
          <ModuleCard module="scriptquiz" />
          <ModuleCard module="dashboard"  />
        </div>
      </section>

      {/* ③ Continue — 이어하기 */}
      <ContinueCard />

      {/* ④ Reflection — 최근 학습 활동 (§13 재사용) */}
      <RecentActivity />
    </div>
  );
}
```

### ① HubHero — 인사 + Streak + Today CTA + inline Stats

```tsx
// apps/web/src/components/home/HubHero.tsx
import { StatCard } from '@/components/dashboard/StatCard';

<header className="
  relative overflow-hidden
  bg-gradient-to-br from-[var(--p-dark)] to-[var(--p)]
  rounded-[var(--r-2xl)] shadow-[var(--sh-md)]
  px-6 py-8 md:px-10 md:py-10 text-[var(--ti)]
">
  {/* 상단: 좌(인사+Streak) | 우(Today CTA) */}
  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">

    {/* 좌측: 인사 + Streak */}
    <div className="flex flex-col gap-2">
      <span className="font-display text-[14px] font-[700] uppercase
                       tracking-[0.10em] opacity-80">
        Welcome back
      </span>
      {/* 인사 — s2 스케일 (40px / 800) — Flow State 진입 시각 강조 */}
      <h1 className="font-display text-[32px] md:text-[40px] font-[800] leading-[1.1]">
        안녕하세요, {userName}님 👋
      </h1>
      <p className="font-body text-[14px] md:text-[16px] opacity-90">
        🔥 <strong className="font-[700]">{streak}일</strong> 연속 학습 중이에요
      </p>
    </div>

    {/* 우측: Today's Review CTA */}
    <button className="
      shrink-0
      bg-[var(--ti)] text-[var(--p)]
      px-6 py-3 rounded-[var(--r-md)]
      font-display font-[700]
      shadow-[var(--sh-sm)]
      hover:scale-[1.02] active:scale-[0.97]
      transition-all duration-[var(--dur-normal)] ease-[var(--ease-spring)]
      flex items-center gap-2
    ">
      <span>오늘의 복습</span>
      <span className="
        bg-[var(--active)] text-[var(--ti)]
        text-[12px] font-[700] px-2 py-0.5 rounded-[var(--r-full)]
      ">{reviewCount}</span>
    </button>
  </div>

  {/* 하단: inline Stats 3분할 — StatCard variant="inline" */}
  <div className="
    mt-6 md:mt-8 pt-5
    border-t border-[var(--ti)]/20
    grid grid-cols-3 gap-4 md:gap-8
  ">
    <StatCard variant="inline" label="오늘 학습"   value={todayCount} />
    <StatCard variant="inline" label="연속 일수"   value={`${streak}일`} />
    <StatCard variant="inline" label="전체 정확도" value={`${accuracy}%`} />
  </div>

  {/* 장식: 우상단 원형 광택 */}
  <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full
                  bg-[var(--ti)]/10 blur-2xl pointer-events-none" />
</header>

/* 빈 상태 (Today's Review === 0):
   CTA 라벨 → "새 단어 추가하기" / 숫자 배지 숨김 / 링크 → /text */
```

### ② ModuleCard — 7모듈 정사각 카드

```tsx
// apps/web/src/components/home/ModuleCard.tsx

type Module = 'text' | 'wordvault' | 'flashcard' | 'spellforge'
            | 'wordblitz' | 'scriptquiz' | 'dashboard';

const MODULE_META: Record<Module, {
  icon: string; label: string; href: string; color: string;
}> = {
  text:       { icon: '📖', label: '원문',       href: '/text',       color: 'var(--p)'      },
  wordvault:  { icon: '📝', label: '단어장',     href: '/wordvault',  color: 'var(--p-dark)' },
  flashcard:  { icon: '🃏', label: '플래시카드', href: '/flashcard',  color: 'var(--p)'      },
  spellforge: { icon: '⚡', label: 'SpellForge', href: '/spellforge', color: '#4A9FCF'       },
  wordblitz:  { icon: '🌴', label: 'WordBlitz',  href: '/wordblitz',  color: '#22C55E'       },
  scriptquiz: { icon: '📝', label: 'ScriptQuiz', href: '/scriptquiz', color: 'var(--active)' },
  dashboard:  { icon: '📊', label: '통계',       href: '/dashboard',  color: 'var(--info)'   },
};

<a
  href={MODULE_META[module].href}
  aria-label={`${MODULE_META[module].label} 모듈로 이동`}
  className="
    group relative
    flex flex-col items-center justify-center gap-2
    aspect-square min-h-[110px]
    bg-[var(--bg)] border border-[var(--bd)]
    rounded-[var(--r-lg)] shadow-[var(--sh-sm)]
    hover:shadow-[var(--sh-md)] hover:-translate-y-0.5
    active:scale-[0.97]
    transition-all duration-[var(--dur-normal)] ease-[var(--ease)]
  "
>
  {/* 아이콘 (32px) */}
  <span className="text-[32px] leading-none">{MODULE_META[module].icon}</span>

  {/* 라벨 */}
  <span className="font-display text-[13px] font-[600] text-[var(--t1)]">
    {MODULE_META[module].label}
  </span>

  {/* 마지막 학습 시간 (선택적, 데이터 있을 때만) */}
  {lastStudiedAt && (
    <span className="font-body text-[11px] text-[var(--t3)]">
      {relativeTime(lastStudiedAt)}
    </span>
  )}

  {/* 호버 시 컬러 바 (하단) */}
  <span
    className="absolute bottom-0 left-0 right-0 h-[3px] rounded-b-[var(--r-lg)]
               opacity-0 group-hover:opacity-100
               transition-opacity duration-[var(--dur-normal)]"
    style={{ backgroundColor: MODULE_META[module].color }}
  />
</a>

/* 접근성: aria-label / 터치 타겟 110px ≥ 44px / 키보드 포커스 ring */
```

### ③ ContinueCard — 이어하기

```tsx
// apps/web/src/components/home/ContinueCard.tsx

<a
  href={`/text?id=${recentText.id}`}
  className="
    group flex flex-col gap-3 p-6
    bg-[var(--bg)] border border-[var(--bd)]
    rounded-[var(--r-lg)] shadow-[var(--sh-sm)]
    hover:shadow-[var(--sh-md)] hover:border-[var(--p)]
    transition-all duration-[var(--dur-normal)]
  "
>
  {/* 상단: 레이블 + 진행률 % */}
  <div className="flex items-center justify-between">
    <span className="font-display text-[11px] font-[700] uppercase
                     tracking-[0.06em] text-[var(--t3)]">
      이어하기
    </span>
    <span className="font-body text-[13px] font-[600] text-[var(--p)]">
      {progressPercent}%
    </span>
  </div>

  {/* 제목 — Lora (영어 원문 폰트 직접 노출) */}
  <h3 className="font-english text-[20px] font-[600] text-[var(--t1)]
                 leading-tight line-clamp-1">
    {recentText.title}
  </h3>

  {/* 미리보기 (Lora body) */}
  <p className="font-english text-[14px] text-[var(--t2)]
                leading-relaxed line-clamp-2">
    {recentText.preview}
  </p>

  {/* ProgressBar 재사용 (§Extras) */}
  <div className="w-full h-1.5 bg-[var(--bg3)] rounded-[var(--r-full)] overflow-hidden">
    <div
      className="h-full bg-[var(--p)] rounded-[var(--r-full)]
                 transition-[width] duration-[var(--dur-slow)] ease-out"
      style={{ width: `${progressPercent}%` }}
    />
  </div>

  {/* 하단: 메타 + Primary CTA */}
  <div className="flex items-center justify-between mt-2 pt-3 border-t border-[var(--bg3)]">
    <span className="font-body text-[12px] text-[var(--t3)]">
      {relativeTime} · {moduleLabel}
    </span>
    {/* CTA — Primary 버튼 축소 */}
    <span className="
      bg-[var(--p)] text-[var(--ti)]
      font-display text-[13px] font-[600]
      px-4 py-2 rounded-[var(--r-md)]
      group-hover:bg-[var(--p-hover)]
      transition-colors duration-[var(--dur-normal)]
      flex items-center gap-1
    ">
      이어하기
      <span className="group-hover:translate-x-0.5 transition-transform">→</span>
    </span>
  </div>
</a>

/* 빈 상태: "아직 학습한 원문이 없어요" + Primary CTA "원문 추가" → /text */
```

### 재사용 컴포넌트

| 컴포넌트 | 출처 | 사용 위치 | 비고 |
|----------|------|-----------|------|
| `StatCard` (variant="inline") | §13 | Hero 하단 3분할 | 카드 박스 제거 / 흰색 텍스트 / s2 값 |
| `RecentActivity` | §13 | ④ Reflection | 최근 5개로 제한 권장 |
| `ProgressBar` 패턴 | §Extras | ContinueCard 진행률 | 1.5px 높이 · `--p` 색 |

### 반응형 동작

```
mobile (390px):  Hero(stack: 인사→CTA→Stats 3열) → Module(2열) → Continue → Reflection
tablet (768px):  Hero(좌우 2열 + Stats 3열)       → Module(4열) → Continue → Reflection
desktop (1280px):Hero(좌우 2열 + Stats 3열)       → Module(7열) → Continue → Reflection
```

### 접근성 / UX 원칙

- **F-pattern 시선 정합**: ① 좌상단 인사(s2 시각 닻) → ② 가로 모듈 그리드 → ③ 좌측 이어하기 → ④ 하단 회고 (위→아래·좌→우 자연 흐름)
- **Flow State 진입 보조**:
  - 첫 화면 결정 부담 최소화 — Today CTA 1순위, Continue 2순위, Module 3순위
  - 인사+Streak으로 정서적 진입(`s2` 크기로 자기 효능감 환기)
  - inline Stats는 "성취 가시화" 역할 — 카드 박스 제거로 Hero와 시각 일체
- 모든 카드 터치 타겟 최소 110×110 (44px 기준 충족)
- HubHero CTA 배지는 색상 + 숫자 + 레이블 3중 표현 (색맹 대응)
- ModuleCard는 `<a>` 태그로 prefetch 활용 (Next.js `Link`로 교체 가능)
- 빈 상태: HubHero (review=0) / ContinueCard (원문 없음) 모두 정의
- 페이지 폭: `max-w-6xl` (1152px) — Dashboard와 동일 기준

---

## 🛡️ Admin Console — v6.5 신규 섹션

> 플랫폼 운영 전용 영역. 사용자 앱과 라우트·레이아웃·시각 컨텍스트 모두 분리.
> **설계 원칙**: 시각적 구분(보라 액센트) + 명시적 모드 알림 + 한 클릭 사용자 앱 복귀.

### 라우트 구조 — route group 미사용

```
/admin              → 관리자 대시보드 (KPI 4 · 섹션 7 · 최근 활동)
/admin/users        → 사용자 관리
/admin/library      → 콘텐츠 관리
/admin/vocabulary   → 단어장 마스터
/admin/analytics    → 플랫폼 분석
/admin/reports      → 신고/문의
/admin/billing      → 결제/구독
/admin/settings     → 시스템 설정
```

`(admin)` 라우트 그룹 대신 평문 `/admin/*` 사용 — URL 명시성 + 단일 layout scope.

### 시각 컨텍스트 분리

| 요소 | 사용자 앱 | Admin Console |
|------|-----------|---------------|
| 액센트 | `var(--p)` (#3B82F6) | **#8B5CF6 → #6D28D9** (보라 그라디언트) |
| 로고 아이콘 | `V` (Plus Jakarta) | `ShieldCheck` |
| 사이드바 헤더 | "Vocaflow" | "Vocaflow" + **"Admin"** mono 배지 |
| 알림 박스 | Streak | **"관리자 모드 · 시스템 데이터 접근 중"** |
| 사이드바 하단 | 사용자 프로필 → /settings | **"사용자 앱으로 ← /hub"** |

### AdminSidebar 네비게이션 그룹

```
[ 단독 ]   대시보드 (LayoutDashboard)
[ 사용자 & 콘텐츠 ]   사용자 / 콘텐츠 / 단어장 마스터        — accent: #8B5CF6
[ 운영 ]              플랫폼 분석 / 신고·문의(뱃지) / 결제   — accent: var(--info)
[ 시스템 ]            시스템 설정                            — accent: var(--active)
```

신고·문의 항목엔 **빨간 카운트 뱃지** (미처리 건수). 0건일 때 숨김.

### 관리자 대시보드 (`/admin`) 레이아웃

```
┌──────────────────────────────────────────┐
│ [ShieldCheck]  Admin Console             │
│                대시보드                    │
├──────────────────────────────────────────┤
│ KPI ×4 — 총 사용자 / 활성 / 콘텐츠 / 신고  │
├──────────────────────────────────────────┤
│ 관리 섹션 ×7 — 카드 그리드 (3열)          │
├──────────────────────────────────────────┤
│ 최근 활동 — 타임라인 (실시간 마커)         │
└──────────────────────────────────────────┘
```

KPI 카드는 §13 StatCard와 다른 디자인 — delta 변화율 (`▲ 12%`) 강조 + 작은 아이콘 박스. 모듈별 색상 액센트로 빠른 스캔.

### 권한·보안 (Phase 2~3 예정)

- `middleware.ts`에 `/admin/*` RBAC 가드 — Supabase `users.role = 'admin'` 검증
- 관리자 액션은 별도 `audit_logs` 테이블에 기록 (settings 페이지 통합)
- 관리자 전용 로그인 분리 검토 (`/admin/login` — 2FA 필수)

### 접근성 / UX 원칙

- 보라 액센트는 색상 + 형태(ShieldCheck) + 텍스트("Admin") 3중 표현
- "사용자 앱으로" 링크 항상 visible — 컨텍스트 전환 비용 최소화
- 신고 뱃지는 색상 + 숫자 + aria-label 3중 표현 (색맹 대응)
- 모든 stub 페이지는 `components/dev/StubPage`로 통일 — 일관된 검증 경험

---

## 🃏 게임 모듈 — Flashcard

> 독립 레퍼런스: `Flashcard.html` (648줄) — 완전 동작  
> 3-Screen flow: Start(하늘 환경) → Game(카드 flip) → Result

### ① Start Screen — 하늘 환경

```jsx
// src/components/game/FlashcardEnv.tsx

/* 하늘 배경 */
"bg-gradient-to-b from-[#87CEEB] via-[#56CCF2] to-[#1A9898]"

/* 구름 4개: bg-white/78 rounded-[50px] / cloudDrift 18~26s */
/* 잔디 하단: absolute bottom-0 / h-[90px] / #5CE870→#2A9030 / border-radius 50% 50% 0 0 */

/* FLASHCARDS 레인보우 로고 */
/* font-display / clamp(36px,9vw,46px) / 900 / 각 글자 개별 색상 */
F:#ef4444 L:#f97316 A:#eab308 S:#22c55e H:#3b82f6 C:#8b5cf6 A:#ef4444 R:#f97316 D:#eab308 S:#22c55e

/* 시작 버튼 */
/* 단어로: from-[#5B9CF6] via-[#3B82F6] to-[#2563EB] / shadow-[0_5px_0_#1D4ED8] */
/* 뜻으로: from-[#A78BFA] via-[#8B5CF6] to-[#7C3AED] / shadow-[0_5px_0_#5B21B6] */
```

### ② Game Screen — CSS 3D Flip

```jsx
/* perspective: 1200px / transformStyle: preserve-3d */
/* transform: flipped ? rotateY(180deg) : rotateY(0) */
/* transition: .55s cubic-bezier(.4,0,.2,1) */

/* 앞면 (황금 gradient) */
"from-[#FFFDE7] via-[#FFF9C4] to-[#FFF59D]"
/* 단어: Lora / clamp(28px,8vw,36px) / 700 */

/* 뒷면 (초록 gradient) */
"from-[#E8F5E9] via-[#C8E6C9] to-[#A5D6A7]"
/* 뜻: font-display / clamp(18px,5vw,24px) / 700 / #065f46 */
/* 예문: Lora / 13px / italic / bg-white/45 */

/* 정답/오답 버튼 */
/* 알아요:      from-[#22c55e] to-[#16a34a] / shadow-[0_4px_0_#15803d] */
/* 모르겠어요:  from-[#f97316] to-[#ef4444] / shadow-[0_4px_0_#b91c1c] */
```

### 상태 관리

```typescript
type FCMode   = 'word' | 'meaning';   // 단어→뜻 / 뜻→단어
type FCScreen = 'start' | 'game' | 'result';
// SM-2 SRS: 알아요(+) / 모르겠어요(-) → easeFactor/interval 업데이트
// 피드백 chip: 0.7s 후 자동 소멸
```

---

## ⚡ 게임 모듈 — SpellForge

> 독립 레퍼런스: `SpellForge.html` (811줄) — 완전 동작  
> 3-Screen flow: Start → Game(파란 패널) → Result

### ② Game Screen — 파란 패널

```jsx
// src/components/game/SpellForgePanel.tsx

/* 파란 패널 배경 — 게임 전용 하드코딩 */
"bg-gradient-to-br from-[#5CB8E0] via-[#4A9FCF] to-[#3A7FAF]"

/* 뜻 표시 박스: bg-white/97 / rounded-xl */
/* 뜻: Lora / 19px / 600 */

/* 전구 힌트 바 */
/* fill: linear-gradient(90deg, #FFE234, #F59E0B) */
/* bulbGlow: drop-shadow rgba(255,220,0,.3→.7) 2s infinite */

/* 스펠링 셀 */
/* 기본:   w-[50px] h-[54px] / bg-white/92 / JetBrains Mono / 22px / 800 */
/* active: border-3 error / scale(1.06) / ring-4 error/20 */
/* correct:border-[var(--success)] / bg-[var(--success-light)] */
/* hint:   border-[var(--active)] / bg-[var(--active-light)] */

/* 파티클 색상 */
#FFE234 / #F59E0B / #22C55E / #3B82F6 / #8B5CF6
```

### 입력 처리

```typescript
// 자동 제출: typed 길이 === word 길이 → 즉시 checkAnswer()
// 힌트: 점수 -20 / 첫 빈 칸에 정답 글자 삽입
// 숨김 input: opacity:0 / left:-9999px / autocorrect off
```

---

## 🌴 게임 모듈 — WordBlitz

> 독립 레퍼런스: `WordBlitz_Jungle.html` (1,020줄) — 완전 동작  
> 정글 어드벤처 테마 / 3-Screen flow

### 환경 — 정글 배경

```jsx
// src/components/game/WordBlitzGame.tsx

/* 배경: linear-gradient(180deg, #2d6a2d→#5ab540) */
/* 나무 기둥(좌/우): #3d2010→#7a4520 / border: 4px solid #8B5E2A */
/* 크리처 SVG 4종: creatureBob 2.5s ease-in-out infinite */

/* 타이틀: Fredoka One / clamp(48px,8vw,72px) */
/* 색상: #FFE234 / text-shadow: 3px 3px 0 #B8860B, 5px 5px 0 #8B6500 */

/* HUD */
/* bg: rgba(30,60,10,.92) / border: 2px solid #5a9a2a */
/* SCORE/COMBO: #FFE234 + text-shadow */
/* 타이머 바: h-12px / 색상 변화 JS 타이머 */
/* 콤보 점 4개: on=radial-gradient(#ffe234,#f5a623) / off=rgba(0,0,0,.3) */

/* 선택지 버튼 */
/* from-[#3a8a20] via-[#2a6a10] to-[#1a4a08] */
/* border: 3px solid #5ab830 / border-radius: 18px */
/* hover: translateY(-3px) / active: translateY(2px) */
/* correct: correctPop / wrong: wrongShake .38s */
```

### 애니메이션

```css
@keyframes creatureBob  { 0%,100%{transform:translateY(0) rotate(-3deg)} 50%{transform:translateY(-12px) rotate(3deg)} }
@keyframes starSpin     { from{transform:rotate(0)} to{transform:rotate(360deg)} }
@keyframes correctPop   { 0%{transform:scale(1)} 50%{transform:scale(1.08) translateY(-3px)} 100%{transform:scale(1)} }
@keyframes wrongShake   { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-5px)} 80%{transform:translateX(5px)} }
@keyframes particleFly  { from{opacity:1;transform:translate(0,0)} to{opacity:0;transform:translate(var(--dx),var(--dy))} }
```

---

## 📝 게임 모듈 — ScriptQuiz

> 독립 레퍼런스: `ScriptQuiz.html` (1,027줄) — 완전 동작  
> Little Fox Quiz UI 스타일 참조 · 3-Screen flow

### ① Start Screen

```jsx
/* QUIZ 로고: gradient text #5BC8F5→#1A7AB8 / drop-shadow / 900 */
/* 원문 제목 h2 / 챕터 h3 / 섹션 body-2 타이포 계층 */
/* Start 버튼: bg-[var(--p)] / rounded-[var(--r-full)] / shadow-[0_4px_0_var(--p-dark)] */
```

### ② Question Screen

```jsx
/* HUD 바: bg-[var(--p)] / Time+Score: JetBrains Mono / 22px / 700 */
/* 문제 박스: bg-[var(--bg2)] / border / font-english 18px / 600 */

/* 선택지 5가지 상태 */
idle:     "border-[var(--bd)] bg-[var(--bg)] hover:border-[var(--p)] hover:bg-[var(--p-light)]"
selected: "border-[var(--p)] bg-[var(--p-light)]"
correct:  "border-[var(--success)] bg-[var(--success-light)]"
wrong:    "border-[var(--error)] bg-[var(--error-light)]"
other:    "opacity-45"

/* 정답 체크: 노란 SVG 체크마크 (#FFE234) — Little Fox 스타일 */
/* 오답: ✕ 흰색 / border-error */
```

### ③ O/X 피드백 오버레이

```jsx
/* fixed inset-0 / pointer-events-none / z-50 */
/* 컨테이너: w-[140px] h-[140px] / bg-white/90 / backdrop-blur */
/* O: border-10 solid var(--p) / opacity-60 */
/* X: font-display / 80px / error / opacity-70 */
/* 진입: feedbackPop .3s ease-spring */
/* 소멸: setTimeout 800ms */
```

### ④ Result Screen

```jsx
/* SVG 점수 링: strokeDashoffset 1s var(--ease-out) */
/* 정확도: s2 스케일 (40px/800) / var(--p) */
/* 통계 3칸: success-light / error-light / bg2 */
/* 오답 복습: bg-[var(--active-light)] / border-l-3 var(--active) */
/* 원문 근거 하이라이트: Lora italic */
```

### 상태 타입

```typescript
type QuizState  = 'start' | 'question' | 'feedback' | 'result';
type AnswerState = 'idle' | 'selected' | 'answered';

interface QuizQuestion {
  id: string;
  type: 'multiple' | 'truefalse' | 'blank';
  question: string;
  options: { text: string }[];
  correctIndex: number;
  sourceSnippet: string;
  sourceSentenceIdx: number;
}
```

### AI 문제 생성 프롬프트

```typescript
const QUIZ_GENERATION_PROMPT = `
다음 영어 원문을 읽고 독해 퀴즈 ${count}개를 생성하세요.

[규칙]
- 문제 유형: multiple(4지선다) 위주, truefalse(OX) 혼합
- 원문 내용 근거 문제만 출제 (추론 금지)
- 각 문제에 sourceSnippet(근거 문장) 포함
- 난이도: 내용 이해 70% + 세부 사항 30%
- 한국어로 문제 작성, 선택지 한국어

[출력 — JSON only]
{ "questions": [{ "type":"multiple","question":"...","options":[{"text":"..."}],"correctIndex":0,"sourceSnippet":"..." }] }

[원문]
${scriptContent}
`;
```

---

## 📖 WordVault 단어장 컴포넌트

### Hero Header

```jsx
// src/components/wordvault/HeroHeader.tsx

<div className="
  relative overflow-hidden
  bg-gradient-to-br from-[var(--p-dark)] to-[var(--p)]
  px-6 pt-10 pb-14 text-[var(--ti)]
">
  {/* 물결 하단 */}
  <div className="absolute -bottom-10 -left-[10%] w-[120%] h-20
                  bg-[var(--bg2)] rounded-[50%_50%_0_0]" />

  {/* 제목: h1-sm mobile / 800 */}
  <h1 className="font-display text-[26px] font-[800] leading-tight mb-1">
    📖 WordVault
  </h1>
  {/* 부제: body-3 / opacity-85 */}
  <p className="font-body text-[13px] opacity-85">
    스크립트 붙여넣기 → AI 단어 분석 → 단어장 · 플래시카드 · SpellForge · WordBlitz
  </p>
</div>
```

### Word List

```jsx
// src/components/wordvault/WordList.tsx

/* 5열 그리드 */
"grid grid-cols-[44px_1fr_auto_1fr_44px]"

/* 헤더: h-[40px] bg-[var(--bg2)] / font-display 11px / 700 / UPPER */
/* 행: hover:bg-[var(--bg2)] */

/* 단어: Plus Jakarta Sans / 15px / 700 */
/* 품사 배지: DM Sans / 11px / 600 / bg-[var(--bg3)] / rounded-md */
/* 뜻: DM Sans / 13px / 500 / text-[var(--t2)] */
/* 예문: DM Sans / 12px / bg-[var(--bg2)] / border-l-[3px] #C7D2FE */
/* 예문 하이라이트: font-[700] text-[var(--p-dark)] */
```

### SP-Bar (문장 플레이어)

```jsx
// src/components/wordvault/SPBar.tsx

/* 어두운 둥근 바 */
"bg-[#16213e] rounded-[40px] px-3 py-1.5 border border-white/[0.06]"

/* 전체 재생: bg-[var(--p)] / 재생 중: bg-orange-500 */
/* 문장 점: bg-[var(--p)] active / bg-white/10 default */
/* spPulse: box-shadow 0→8px, 0.9s ease-in-out infinite */
```

---

## 🖼 Icons — Lucide React

```bash
pnpm add lucide-react
```

```
네비게이션: Home, BookOpen, CreditCard, Gamepad2, BarChart3
학습:       Play, Pause, SkipForward, SkipBack, Volume2, VolumeX
단어장:     Plus, Trash2, Edit3, Search, Star, BookMarked
게임:       Trophy, Target, Zap, Timer, CheckCircle, XCircle
일반:       Settings, User, LogOut, Moon, Sun, ChevronDown, X, Menu
피드백:     ThumbsUp, ThumbsDown, RefreshCw

크기 규칙:
네비게이션 아이콘:  size={24}
버튼 내 아이콘:    size={20}
인라인 아이콘:     size={16}
대형 표시:        size={32}
색상: currentColor 상속
```

---

## 🗄 Supabase DB 스키마

```sql
-- 원문
CREATE TABLE texts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 단어장
CREATE TABLE vocabularies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text_id UUID REFERENCES texts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  word TEXT NOT NULL,
  meaning TEXT NOT NULL,
  example_sentence TEXT,
  pronunciation TEXT,
  difficulty INT DEFAULT 0,   -- 0: 미학습, 1~5: 난이도
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 학습 기록
CREATE TABLE learning_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  vocabulary_id UUID REFERENCES vocabularies(id) ON DELETE CASCADE,
  module TEXT NOT NULL,       -- 'flashcard' | 'spellforge' | 'wordblitz' | 'scriptquiz'
  is_correct BOOLEAN NOT NULL,
  response_time_ms INT,
  attempted_at TIMESTAMPTZ DEFAULT now()
);

-- ScriptQuiz 문제 (AI 생성)
CREATE TABLE quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text_id UUID REFERENCES texts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  type TEXT NOT NULL DEFAULT 'multiple',
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_index INT NOT NULL,
  source_snippet TEXT,
  source_sentence_idx INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 게임 점수
CREATE TABLE scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  text_id UUID REFERENCES texts(id),
  module TEXT NOT NULL,
  score INT NOT NULL,
  total_questions INT NOT NULL,
  accuracy DECIMAL(5,2),
  duration_seconds INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS 정책 (모든 테이블)
ALTER TABLE texts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocabularies     ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores           ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own data" ON texts            FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own data" ON vocabularies     FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own data" ON learning_records FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own data" ON quiz_questions   FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own data" ON scores           FOR ALL USING (auth.uid() = user_id);
```

---

## 📦 독립 레퍼런스 HTML 파일

> 완전 동작 프로토타입 — React 구현 시 CSS 변수명·클래스 구조·애니메이션·로직 기준으로 사용.  
> 모든 파일: `data-theme="dark"` 완전 지원 · 4종 폰트 역할별 적용 · 3-Screen flow

| 파일 | 줄수 | 핵심 구현 |
|------|------|-----------|
| `Flashcard.html` | 648줄 | 하늘환경·구름·잔디·레인보우로고·CSS 3D flip·양방향모드 |
| `SpellForge.html` | 811줄 | 파란패널·전구힌트바·JetBrains Mono 셀·파티클·자동입력 |
| `ScriptQuiz.html` | 1,027줄 | Little Fox 스타일·O/X 피드백·원문 하이라이트·SVG 링 |
| `WordBlitz_Jungle.html` | 1,020줄 | 정글테마·SVG 크리처 4종·Fredoka One·파티클·콤보 |

> **참고**: 레퍼런스 HTML 파일 내 `CLAUDE_v4.md` 등 구버전 언급은 모두 `CLAUDE.md`로 간주할 것

---

## 🎮 게임 모듈 요약

| 모듈 | 테마 | 폰트 포인트 | 핵심 컬러 | 레퍼런스 |
|------|------|-------------|-----------|---------|
| Flashcard | 하늘·구름·잔디 | Lora (단어) | 황금→초록 카드 | `Flashcard.html` |
| SpellForge | 파란 패널 | JetBrains Mono (셀) | #4A9FCF 패널 | `SpellForge.html` |
| WordBlitz | 정글 어드벤처 | Fredoka One (타이틀) | #3d8a3d + #FFE234 | `WordBlitz_Jungle.html` |
| ScriptQuiz | 화이트 + 파란 HUD | Lora (문제·선택지) | var(--p) HUD | `ScriptQuiz.html` |

---

## 🚫 절대 하지 않을 것

- Inter · Roboto · Arial 사용
- `--color-primary` 등 v5 롱폼 변수 사용 (v6 이후 `--p` 축약형만)
- 보라색 그라디언트 배경
- Quizlet 로고·아이콘·브랜드색(#4255FF teal) 그대로 복사
- 학습 중 화면 광고 배치
- 애니메이션 없는 상태 전환
- 44px 미만 터치 타겟
- placeholder만으로 레이블 대체
- 색상만으로 정보 전달 (접근성 위반)
- 웹 전용 또는 앱 전용 단방향 설계
- Parts Kit v01~v05 기준으로 코드 작성

---

## ✅ 항상 지킬 것

- 모든 인터랙티브 요소에 hover + active + focus + disabled 4상태 구현
- 모든 카드·버튼에 transition 적용 (`--dur-normal`, `--ease`)
- 정답/오답 피드백: 색상 + 아이콘 + 애니메이션 3중 피드백
- 모바일 퍼스트 → 데스크톱 확장 (390 → 768 → 1280)
- 공통 컴포넌트 `components/ui/` 재사용 우선
- CSS Variables(`--p`, `--bg`, `--t1` 등) 로 테마 제어 — 하드코딩 금지 (게임 전용 예외 제외)
- `data-theme="dark"` 모든 컴포넌트 대응 필수
- 이미지 대신 Lucide 아이콘 우선
- RN 컴포넌트: `minHeight: 44, minWidth: 44` 터치 타겟 필수
- 파일 첫 줄에 경로 주석 필수 (`// src/components/ui/Button.tsx`)
- 코드는 완성형만 — TODO·생략·placeholder 절대 금지

---

## 📋 Parts Kit v06 섹션 구성

```
01 Typography       — 4종 폰트 · Desktop/Mobile 8단계 스케일
02 Colors           — CSS Variables (--p 축약형) · 다크모드 · 게임 예외
03 Tokens           — Spacing · Shadow · Radius · Motion
04 Buttons          — 8종 변형 · 3크기 · RN StyleSheet 포함
05 Selectors        — Radio · Checkbox(indeterminate) · Toggle
06 Form Fields      — 6가지 상태 · Alt Form
07 Dropdowns        — Select · Popover · Bottom Sheet
08 Tooltips         — 4방향 · 4색 변형
09 Extras           — Progress · Toast · Modal · Audio · Icons · Loading
10 Game UI          — Flashcard · SpellForge · WordBlitz · ScriptQuiz · Score
11 WordVault       — WordVault 단어장 전용 컴포넌트 (Hero · TTS · SP-Bar · WordList 등)
12 ScriptQuiz       — 3-screen flow · 선택지 5상태 · O/X 피드백
13 Dashboard        — StatCard · WeeklyHeatmap · AccuracyRing · ScoreTrend · Activity
14 Home Hub          — HubHero · ModuleCard · ContinueCard / 4영역(Hero·Module·Continue·Reflection) · StatCard inline · F-pattern · Flow State
15 Admin Console     — 8 라우트(/admin/*) · AdminSidebar(보라 액센트) · 관리자 대시보드(KPI·섹션·활동) · components/admin · components/dev/StubPage
16 Dictation        — 받아쓰기 모듈 · 4 라우트(/dictate/*) · CEFR A1~C2 자동 감지 · 단위 3(문장/단락/전체) · Smart/Strict 채점 · 4단계 힌트 · 6개 오류 패턴 · TTS · Focus Mode · Spaced Dictation
17 Learning Model ★v06.9 — 학습 모델 v3.0 (9계층: L0~L4a/b/c/d~L5) · L2.5 Bridge 폐지 · L4 인지 부하 4단계 분리(재인/시각생성/청각생성/통합검증) · Dictation L4c 정착 · 7원칙×9계층 매트릭스 · 체크리스트 갱신
00 Philosophy        — 디자인 철학 4(Calm/Progressive/Empathetic/Implicit) · 학습 과학 7(Recall·SR·Difficulty·Dual·Context·Load·Emotion) · Memory Decay 4단계 · Flow State 5조건 · 안티패턴
```

---

*CLAUDE.md — Vocaflow Design System · Single Source of Truth*  
*변경 이력: 파일명 CLAUDE.md로 통일 / 기술스택 Next.js 14 확정 / CSS 변수 축약형(--p·--bg·--t1) 통일 / React Native 토큰 신설 / Breakpoint 390/768/1280px / Dashboard §13 신설 / Parts Kit v06 / **v06.1** Turborepo 모노레포 구조 + text-viewer/marketing 분리 + game 하위 분리 + lib 폴더화 + stores 추가 / **v06.2** 서비스명 LexiVault → Vocaflow · 단어장 모듈 LexiVault → WordVault · 폴더 vocab → wordvault / **v06.3** (main)/page.tsx 삭제 → (main)/hub/page.tsx 신설 (Home+Dashboard 통합) · URL 충돌로 인한 빌드 실패 해소 (✅ 정상 빌드) · 인증 분기 middleware.ts 일괄 처리 / **v06.4** §14 Home Hub 신설 — HubHero(인사+Streak+Today CTA, gradient + s2) · ModuleCard(7모듈 정사각·아이콘·마지막 학습) · ContinueCard(Lora 제목·진행률·CTA) / StatCard `variant="inline"` 추가 (§13) / 재사용: StatCard·RecentActivity·ProgressBar / 레이아웃 4영역(Hero·Module·Continue·Reflection) · max-w-6xl · F-pattern 시선 정합 · Flow State 진입 보조 / components/home/ 폴더 추가 / **v06.6** "디자인 철학·학습 과학 원칙" 섹션 신설 (§핵심 모듈 직후 · §Typography 직전) — 디자인 철학 4(Calm UI / Progressive Disclosure / Empathetic Feedback / Implicit Progress) · 학습 과학 7(Active Recall / Spaced Repetition / Desirable Difficulty / Dual Coding / Context-Dependent / Cognitive Load / Emotional Encoding) · Memory Decay 색 체계 4단계(stable/shaky/risk/new) 명시 · Flow State 5조건 매핑(워크스페이스) · 적용 체크리스트(PR 자가점검) · 안티패턴 6개 / 기존 코드의 산재된 학습 과학 단서들(vmPFC 텍스트·focus-mode·softQuote·memory 토큰) 통합 정리 / **v06.5** §15 Admin Console 신설 — 8 라우트(/admin/*, route group 미사용) · AdminSidebar(#8B5CF6 보라 액센트 · "관리자 모드" 알림) · 관리자 대시보드(KPI 4 + 섹션 7 + 활동 피드) / components/admin/ · components/dev/StubPage 폴더 추가 / 루트 / 페이지를 임시 진입점 → 화면 인덱스+진행률 대시보드로 전면 개편 (28화면 자동 집계) / (main) 누락 6개(dashboard·flashcard·spellforge·wordblitz·scriptquiz·settings) StubPage로 채움 / error.tsx · not-found.tsx · loading.tsx 전역 바운더리 신설 (이전 "missing required error components" 무한 새로고침 해결) / hooks/useTheme · useFocusMode · useKeyboardShortcuts 추가 / lib/text-viewer/handoff.ts 신설 — TextViewer "AI로 단어 추출" → /wordvault 인계(sessionStorage) / 사이드바 "직접 입력" /input → /text 통합 · /input 라우트 삭제 / components 폴더에 library · workspace 명시 / **v06.7** §16 Dictation 모듈 신설 — 4 라우트(/dictate · /dictate/setup · /dictate/session · /dictate/results) · CEFR A1~C2 자동 감지 (어휘+문장 기반) · 단위 3종(문장/단락/전체 + Dictogloss) · Smart/Strict 채점 (Levenshtein + Word alignment) · 6개 오류 패턴 분석(음성/형태/구문/어휘) · 4단계 힌트(-5/-3/-10/-25) · TTS Web Speech API + Spaced Dictation(autoRepeat + 무음 간격) · Phonological Loop 보호 · Focus Mode(F키, 사이드바 dim) · 키보드 Space/1-5/F/Tab/Enter/Esc · localStorage 기반(Phase 2 Supabase 교체 예정) / lib/dictation/(types·cefr·text-splitter·scoring·analyzer·audio-control·hint·storage 8 파일) · hooks/dictation/(useAudioControl·useDictationSession) · components/dictation/(Hub·Setup·Session·Results 4 클라이언트) · 시드 리소스 3종(A2/B1/B2) / 사이드바 학습 그룹에 Dictation(PencilLine) 항목 추가 / 화면 인덱스에 4 라우트 등록 / 핵심 모듈 7개 → 8개 / **청소(v06.7 동시)** — 잘못 위치한 훅 5개(`src/use*.ts`) · 빈 페이지(`components/workspace/text/[id]/page.tsx` 0bytes) · 빈 placeholder 9폴더(components/audio · components/game/{flashcard,shared,spellforge} · lib/{analytics,openai,parsers,scoring} · config · stores) · 빈 API 5폴더(api/{analyze,health,quiz,tts,upload}) 모두 삭제 · `api/auth/callback`만 `.gitkeep`으로 유지 (OAuth 필수) / **v06.8** §17 학습 모델 v2.0 신설 (상세 내역 v06.8 참조) / **v06.9** §17 학습 모델 v3.0 재설계 — L2.5 Bridge 폐지(Dictation 억지 배치 제거) / L4를 인지 부하 순서 4단계로 분리(L4a 재인: Flashcard+WordBlitz · L4b 시각생성: SpellForge · L4c 청각생성: Dictation · L4d 통합검증: ScriptQuiz) / L4b(SpellForge)와 L4c(Dictation)은 쌍둥이 계층 — 감각 채널만 다른 생성 인출 / 7원칙×9계층 적용 매트릭스 전면 갱신 / PR 체크리스트 "6계층" → "9계층(L0~L4d~L5)" 갱신 / 미정 항목 6개로 확장(L4b vs L4c 추천 우선순위 추가)*
