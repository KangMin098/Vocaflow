# Learning Modules

> 9개 학습 모듈 + 베타. 각 모듈의 목적·라우트·인지 깊이·데이터 모델. 작성 시점: 2026-06-08 (v06.34).
>
> 학습 모델 9계층 (L0~L7) 자세한 설계는 [LEARNING_MODEL.md](./LEARNING_MODEL.md) 참조.

---

## 모듈 카탈로그

| # | 모듈 | 계층 | 인지 유형 | 라우트 | 구현 상태 |
|---|---|---|---|---|---|
| 1 | **TextViewer** | L0~L2 | 획득·이해 | `/text`, `/text/new`, `/text/[id]` | ✅ v06.34 (책 모드 추가) |
| 2 | **WordVault** | L3 | 능동 부호화 | `/wordvault`, `/wordvault/browse` | ✅ v06.22 (Browse 풀스크린 분리) |
| 3 | **Flashcard** | L4a 재인 | Recognition + 메타인지 | `/flashcard`, `/flashcard/play` | ✅ React + FSRS |
| 4 | **SpellForge** | L4b 시각생성 | Generation Effect | `/spellforge`, `/spellforge/play` | ✅ React + IME 분리 |
| 5 | **WordBlitz** | L4a 자동화 | Recognition + 속도 | `/wordblitz`, `/play/wordblitz` | 진행 중 (3D 정글) |
| 6 | **PairFlip** | L4a 공간기억 | Recognition + Spatial | `/pairflip`, `/pairflip/play`, `/pairflip/results` | ✅ MVP (v06.21) |
| 7 | **ScriptQuiz** | L5 정복 | Recognition + Transfer | `/scriptquiz`, `/scriptquiz/play` | ✅ React + AI 생성 |
| 8 | **Dictation** | L6 완성 | Free Recall + Production | `/dictate`, `/dictate/setup`, `/dictate/session`, `/dictate/results` | ✅ MVP (v06.7) |
| 9 | **Dashboard** | L7 회고 | 메타인지 | `/dashboard` | ✅ 설계 완료 |
| 10 | **EchoMatch** ★v06.33 | L4c 청각생성 | Shadow Reading | `/text/[id]/echo` | ✅ v06.33 PoC (4 한계) |
| (베타) | **Pirate Quest** | — | 단어 모험 | `/play/pirate-quest` | 베타 (R3F) |

---

## 1. TextViewer (L0~L2)

### 목적
사용자가 영어 스크립트을 라이브러리에 추가·관리하고, 워크스페이스에서 통독·통청 + 단어 hover 능동 학습.

### 라우트
- `/text` — 허브 (내 스크립트 그리드)
- `/text/new` — 입력 (단일 / 책 모드 — v06.34)
- `/text/[id]` — 워크스페이스 (ReadingUniverse + ChapterSidebar)
- `/text/[id]/echo` — EchoMatch 따라읽기

### v06.34 — 책 모드 추가

기존 단일 스크립트만 지원하던 입력에 **챕터별 책 모드** 추가. 데이터 모델:
- `texts.user_book_group_id` UUID — 그룹 식별 token (FK 없음)
- CHECK 가 `library_book_id` + `user_book_group_id` 동시 사용 차단
- `chapter_idx` + `chapter_title` (기존 컬럼 재활용)

저장 helper: [`lib/text-viewer/save-user-book.ts`](../apps/web/src/lib/text-viewer/save-user-book.ts) — UUID 생성 + N row 일괄 INSERT + 부분 실패 rollback.

집계: [`useTexts.ts`](../apps/web/src/hooks/useTexts.ts) `aggregateUserBookChapters` — 그룹 → 1 LibraryText 카드 (category="내 책").

### 컴포넌트 (`components/textviewer/`)
- `TextCard.tsx` — 3-way 카드 (도서 library_book / 사용자 책 user_book_group / 단일 텍스트)
- `TextStatusBadge.tsx` — 4단계 상태 (미시작/진행중/정복/완성)
- `MyTextsGrid.tsx` — 필터 + 검색 + 그리드
- `EmptyState.tsx` — Cold 첫 진입
- `DiscoveryFooter.tsx` — Library 전환

### 입력 폼 (`components/text-viewer/`)
- `InputModeTabs.tsx` — 직접/파일/URL 탭
- `TextInput.tsx` / `FileUploadArea.tsx` / `UrlInput.tsx`
- `BookChapterInput.tsx` — v06.34 책 모드 워크벤치 (가로 레일 + Alt+←/→)
- `SampleScripts.tsx` — 샘플 스크립트
- `ScriptDisplay.tsx` / `AnalysisResult.tsx` / `WordList.tsx` / `WordCard.tsx`

### 워크스페이스 (`/text/[id]/`)
- `layout.tsx` — RSC 진입, `v_text_content` 1쿼리 + `library_book_id` / `user_book_group_id` 분기
- `page.tsx` — `'use client'` ReadingUniverse
- `text-content-context.tsx` — TextContentProvider
- `text-content-helpers.ts` — buildParagraphsFromContent
- `echo/page.tsx` — EchoMatch 라우트

### 컴포넌트 (`components/workspace/`)
- `ContextBar.tsx` (sticky · 북마크·타이포·인사이트·집중)
- `ReadingUniverse.tsx` (Lora 본문 + hover/click + 문장 재생)
- `RecallCard.tsx` (의미 회상 카드, 3단계 판정)
- `ModePills.tsx` (7모듈 진입 — read/listen/shadow/words/flashcard/spellforge/wordblitz/quiz)
- `Pagination.tsx`
- `FloatingAudioPlayer.tsx` (v06.35 풀 재설계) — 하단 dock + 글라스 + Step Hero
  - **하단 dock**: `fixed inset-x-0 bottom-0` 전체 폭, max-w 920px 콘텐츠, `border-t` + `backdrop-blur-2xl` 글라스
  - **4 mode**: 문장 / 단락 / 전체 / **따라하기** (underline 탭 style)
  - **Step (따라하기)** mode: 문장 hero (Lora 17-19px) + countdown ring (play button 주변 SVG) + pulsing 상태 dot (듣는 중 / 따라 말해 보세요)
  - **듀얼 소스**: 브라우저 TTS + LibriVox (별도 source 토글 row)
- `FloatingSparkle.tsx` (다음 단계 추천)
- `InsightPanel.tsx` (북마크·기억 상태)
- `KeyboardHints.tsx`

### Sidebar (v06.32)
`components/wordvault/WordSetSidebar.tsx` — lg breakpoint 이상 320px 고정 · focus mode 시 자동 숨김.

---

## 2. WordVault (L3 Encode)

### 목적
사용자 자산(단어) 차원별 관리. Memory Decay 4색 분포 시각화 + 자산 정체성 강화.

### 라우트
- `/wordvault` — 허브 v6 (6 Tier IA)
- `/wordvault/browse` — 풀스크린 브라우즈 세션 (v06.22)
- `/wordvault?view=study` / `?view=review` — 학습/복습 모드

### 데이터 모델
`vocabularies` 테이블:
- FSRS 6 컬럼: difficulty (1.0~10.0) · stability · last_review_at · next_review_at · module_history TEXT[] · review_count
- UNIQUE(user_id, word) — 중복 방지
- `lemma` REFERENCES `shared_dictionary(word)` — 사전 연결

### Memory Decay 4색 (R(t) 동적 계산)
```
신규 등록(D/S 미부여)  → new      #94A3B8 (회색)
R ≥ 0.95              → stable   #22C55E (초록)
0.70 ≤ R < 0.95       → shaky    #F59E0B (주황)
R < 0.70              → risk     #EF4444 (빨강)
```

**중요**: `memory_state` 컬럼 의도적 부재 — DB 저장 X, R(t) 동적 계산만 (저장 + 시간 흐름 = 데이터 stale).

### Hub 컴포넌트 (`components/wordvault/hub/`) — v06.35 4 Zone Editorial 재설계

**현재 활성 (4 Zone)**:
- `WordVaultHub.tsx` — 4 Zone 조립 + 주간 목표 fetch
- `VaultIdentity.tsx` ★v06.35 — Zone 1 큰 숫자 + 4색 bar + 주간 목표 진행 바 + 단일 CTA (risk→shaky→new→browse 우선순위)
- `NextStepList.tsx` ★v06.35 — Zone 2 `recommend_word_sets_for_user` 3-5개 text list, 진단 미완료 시 `/diagnostic` CTA
- `AssetGrid.tsx` ★v06.35 — Zone 3 검색 + 단어장 grid (1/2/3 col, 카드별 4색 mini bar)
- `FlowStripe.tsx` ★v06.35 — Zone 4 28일 sparkline (`daily_activity`) + 평균/활동/총합 + 마지막 활동

**보존 (현재 hub 미사용 — Phase 2 추가 view 재활용 가능)**:
- `VaultBar.tsx` — Hero 슬림 8px 4색 막대 (v06.18)
- `AssetCollectionsRow.tsx` — 출처별 컬렉션 카드
- `BookShelfSection.tsx` — 5 Book Type 카드 (v06.20) · `VaultBook` 타입은 AssetGrid 가 재사용
- `CEFRDistribution.tsx` — 6단계 horizontal bar (v06.19)
- `FindAndMore.tsx` — 인라인 검색 진입 (AssetGrid 검색바로 흡수)
- `LearningDimensionSection.tsx` — module_history 3그룹
- `MemoryDecayDistribution.tsx` — 4색 stacked bar + Bucket 카드 (VaultIdentity 가 통합)
- `TrendIndicator.tsx` — week-over-week 추세 (FlowStripe 가 통합)
- `WordPeekStrip.tsx` — 데스크톱 최근 단어 5개 chip
- `RecommendedSetsSection.tsx` — 진단 후 추천 (NextStepList 가 단순화)
- `VLevelPromotionCheck.tsx` — i+1 자동 promotion 확인

**Editorial 디자인 톤** (v06.35):
- gradient · 이모지 · 큰 그림자 모두 제거
- 회색 (`--t1`/`--t2`/`--t3`/`--t4`) + brand `--p` 액센트만
- 큰 여백 + 1px border (`--bd`)
- 수치는 모두 `tabular-nums` (전문 인상)
- 4 Memory Decay 색은 정보 전달용으로만 유지 (`#22C55E`/`#F59E0B`/`#EF4444`/`#94A3B8`)

### Browse (`/wordvault/browse`)
- `WordVaultBrowseClient.tsx` — 풀스크린 클라이언트
- `ScriptsChipNav.tsx` — 스크립트 칩 nav (전체+스크립트별 단어 수)
- `WordRow.tsx` v4 — 16px 컴팩트
- `HideToggleBar.tsx` — Active Recall 토글
- `ListenPanel.tsx` — 듣기 패널 (설정 항상 노출)

---

## 3. Flashcard (L4a 재인)

### 목적
단어 단어 1개 시각 단서 → 자가 판정 (Active Recall). SM-2 SRS 기반 (실 구현: `ts-fsrs` 패키지 wrapper).

### 라우트
- `/flashcard` — Hub (Continue · Queue · 정확도 · 시작 설정)
- `/flashcard/play` — 세션 (SM-2 SRS · 4단계 평가: Again/Hard/Good/Easy)

### FSRS 한국 학습자 파라미터
| | FSRS 표준 | Vocaflow 초기값 | 근거 |
|---|---|---|---|
| Target Retention | 0.90 | **0.85** | 한국 학습자 평균 학습 시간 부족 |
| Initial Difficulty | 5.0 | **6.0** | 외국어 처리 어려움 |
| Maximum Interval | 36500일 | **365일** | 1년 이상 무의미 |
| Learning Steps | [1m, 10m] | **[1d, 3d]** | 게임 세션 단위 |

### 컴포넌트 (`components/flashcard/`)
- `FlashcardSession.tsx` — 세션 컨테이너
- `Card.tsx` / `CardFront.tsx` / `CardBack.tsx` — 3D flip (CSS perspective + rotateY)
- `RecallPhase.tsx` / `FirstJudge.tsx` — 능동 회상 단계
- `HonestyHint.tsx` / `MicroPause.tsx` — 학습 과학 보조
- `SRSBar.tsx` / `ForgettingCurve.tsx` — 진행 가시화
- `CompletionState.tsx`

### 환경
- 하늘 배경 (`from-[#87CEEB] via-[#56CCF2] to-[#1A9898]`)
- 카드 황금 gradient (앞면) ↔ 초록 gradient (뒷면)
- 레인보우 FLASHCARDS 로고 (글자별 색상)

---

## 4. SpellForge (L4b 시각생성)

### 목적
뜻 → 철자 직접 생성 (시각+운동). Generation Effect 활용.

### 라우트
- `/spellforge` — Hub (Memory Decay · Best 점수)
- `/spellforge/play` — 세션 (스펠링 타이핑 · IME 분리)

### 컴포넌트 (`components/spellforge/`)
- `SpellForge.tsx` — 메인 컨테이너
- `ModeSelector.tsx` — 단어→철자 / 뜻→철자
- `MeaningDisplay.tsx` / `InputSlots.tsx` / `SingleBox.tsx`
- `ConfirmButton.tsx` / `IMEIndicator.tsx`
- `ReflectionHint.tsx` / `MicroPause.tsx`

### 환경
- 파란 패널 (`from-[#5CB8E0] via-[#4A9FCF] to-[#3A7FAF]`)
- 전구 힌트 바 (`#FFE234 → #F59E0B` gradient + bulbGlow 애니메이션)
- JetBrains Mono 셀 (50×54px)

### 입력
- 자동 제출 (typed.length === word.length → checkAnswer)
- 힌트 (-20점 / 첫 빈 칸 정답 글자 삽입)
- 숨김 input (`opacity:0 left:-9999px`, autocorrect off)

---

## 5. WordBlitz (L4a 자동화)

### 목적
4지선다 빠른 인식. 시간 압박으로 자동화 형성.

### 라우트
- `/wordblitz` — Hub
- `/play/wordblitz` — 풀스크린 (사이드바 X · SessionFrame 자동 주입)

### 환경 — 정글 어드벤처
- 배경: `linear-gradient(180deg, #2d6a2d → #5ab540)`
- 나무 기둥 (좌/우): `#3d2010 → #7a4520`
- SVG 크리처 4종 (creatureBob 2.5s ease-in-out infinite)
- 타이틀: Fredoka One · `#FFE234` 황금 + text-shadow

### HUD
- bg: `rgba(30,60,10,.92)` / border: `2px solid #5a9a2a`
- SCORE/COMBO: `#FFE234`
- 타이머 바: h-12px 색상 변화 JS
- 콤보 점 4개

### 컴포넌트
`lib/wordblitz/theme.ts` — WB_COLORS · WB_DIMS (박스 6.5×5.2×3.0 · 콘솔 기울임)

---

## 6. PairFlip (L4a 공간기억 · v06.21)

### 목적
짝맞추기 카드 게임 — Working Memory + Spatial + Recognition 3중 활성화.

### 라우트
- `/pairflip` — Hub (Hero + StartScreen 통합)
- `/pairflip/play` — 세션 (3D flip + O/X 코너 배지)
- `/pairflip/results` — 결과 (ScoreRing · PairsList · NextActionCard)

### 디자인
- Editorial 네이비/골드/크림 팔레트 (`#1E3A8A → #1E1B4B + #F59E0B`)
- 카드 1px 골드 테두리 + 4 모서리 코너 장식 + 페이퍼 인셋 그림자
- 부엉이 마스코트 4상태 (idle/cheer/happy/clap)
- 5단계 난이도 (Easy 8장 ~ Master 20장) — 모든 레벨 2줄 고정

### 컴포넌트 (`components/pairflip/`, 16개)
- `PairFlipEnv.tsx` — warm ivory + 골드 라디얼 + 미세 폴카
- `PairFlipMascot.tsx` (부엉이 4상태)
- `PairFlipLogo.tsx` — Editorial 네이비/골드 글자별 라이즈
- `PairFlipLevelSelector.tsx` (5단계)
- `PairFlipModeSelector.tsx` (word_meaning / word_definition Phase 2)
- `PairFlipStartScreen.tsx` / `PairFlipHub.tsx`
- `PairFlipCard.tsx` (3D flip + 5상태 + O/X 코너 배지)
- `PairFlipGrid.tsx` (cols × 2 rows + 좁은 viewport 가로 스크롤)
- `PairFlipHUD.tsx` (타이머·점수·콤보·힌트 sticky)
- `PairFlipFeedback.tsx` / `PairFlipProgress.tsx`
- `PairFlipGameScreen.tsx` / `PairFlipScoreRing.tsx` / `PairFlipPairsList.tsx`
- `PairFlipNextActionCard.tsx` / `PairFlipResultScreen.tsx`

### FSRS rating 매핑
- 1회 = Easy / 2 = Good / 3-4 = Hard / 5+ = Again
- `lib/pairflip/learning-records.ts` — Phase 2 Supabase 적재

### 매칭 카드 영구 유지
`gone` 전환 X — 시각적 진행도 누적.

---

## 7. ScriptQuiz (L5 정복)

### 목적
스크립트 맥락 4지선다. Recognition + Transfer — 텍스트 단위 의미 통합 검증.

### 라우트
- `/scriptquiz` — Hub (Chapter grid · 한영 토글)
- `/scriptquiz/play` — 3-screen flow

### 3-Screen Flow
1. **Start Screen** — QUIZ 로고 (gradient text `#5BC8F5→#1A7AB8`) + 스크립트 제목/챕터 + Start
2. **Question Screen** — HUD 바 (Time + Score JetBrains Mono 22px) + 문제 박스 (Lora) + 선택지 5상태
3. **Result Screen** — SVG 점수 링 + 정확도 s2 (40px/800) + 통계 3칸 + 오답 복습

### 선택지 5상태
- idle / selected / correct / wrong / other (opacity-45)

### O/X 피드백 오버레이
- `fixed inset-0 pointer-events-none z-50`
- 컨테이너: 140×140 · `bg-white/90 backdrop-blur`
- O: border-10 solid var(--p) · opacity-60
- X: 80px · error · opacity-70

### AI 문제 생성
```typescript
const QUIZ_GENERATION_PROMPT = `
다음 영어 스크립트을 읽고 독해 퀴즈 ${count}개를 생성하세요.
[규칙]
- 문제 유형: multiple(4지선다) 위주, truefalse(OX) 혼합
- 스크립트 내용 근거 문제만 출제 (추론 금지)
- 각 문제에 sourceSnippet(근거 문장) 포함
[출력 — JSON only]
{ "questions": [{ "type":"multiple","question":"...","options":[{"text":"..."}],"correctIndex":0,"sourceSnippet":"..." }] }
`;
```

### DB
`quiz_questions` 테이블 — type CHECK ('multiple'/'truefalse'/'blank') · options JSONB · correct_index · source_snippet · source_sentence_idx.

---

## 8. Dictation (L6 완성 · v06.7)

### 목적
스크립트 단위 다중 채널 재생산 (음운+의미+문법+철자). Free Recall + Production — 학습의 정점.

### 라우트
- `/dictate` — Hub (CEFR 자동 감지 · 리소스 선택)
- `/dictate/setup` — Setup (단위/갯수/순서/채점/속도/힌트)
- `/dictate/session` — 세션 (TTS · 단어별 채점 · 4단계 힌트 · Focus Mode)
- `/dictate/results` — 결과 (Hero 정확도 · 오류 패턴 분석 · 오답 단어)

### 설정
- 단위 3종: 문장 / 단락 / 전체 (Dictogloss)
- 채점 2종: Smart / Strict
- CEFR A1~C2 자동 감지 (v06.22 수동 선택 제거)
- 순서: 순차 / 랜덤 (v06.22 difficulty-first 제거)

### 인프라 (`lib/dictation/`, 8 파일)
- `types.ts` — Config · Session · Item · WordResult · ErrorPattern
- `cefr.ts` — A1~C2 + 그룹별 자동 감지
- `text-splitter.ts` — 약어 처리 + 문장/단락/전체 분리
- `scoring.ts` — Levenshtein + Word alignment + Smart/Strict
- `analyzer.ts` — 6개 패턴 (-ed·관사·복수·동음이의·스펠·단어선택)
- `audio-control.ts` — Web Speech API + autoRepeat + 무음 간격
- `hint.ts` — 4단계 (-5/-3/-10/-25)
- `storage.ts` — localStorage + 시드 (A2/B1/B2 3종)

### Hooks
- `useAudioControl.ts` — TTS 재생/반복/정지
- `useDictationSession.ts` — 세션 상태 머신 (sessionStorage)

### 컴포넌트 (`components/dictation/`)
- `DictationHubClient.tsx` (Hub: ModuleHero + Smart Suggestion + 리소스 + 최근 세션)
- `DictationSetupClient.tsx`
- `DictationSessionClient.tsx`
- `DictationResultsClient.tsx`

### 키보드
- Space (재생/정지) / 1-5 (속도) / F (Focus) / Tab / Enter / Esc

### Phonological Loop 보호
입력 시 음성 자동 정지.

### Smart Suggestion
70~90% 우선 추천 (정서적 부호화).

---

## 9. Dashboard (L7 회고)

### 목적
학습 통계 시각화 + 다음 제안. 메타인지 활성화.

### 라우트
- `/dashboard` — page.tsx ('use client') + layout.tsx (metadata server)

### 컴포넌트 (`components/dashboard/`)
- `StatCard.tsx` — KPI 카드 (5 variant: today/streak/total/accuracy/inline)
- `WeeklyHeatmap.tsx` — 28일 sparkline + Streak 배지 (v06.22 재설계 · 300px → 120px)
- `ModuleAccuracyRing.tsx` — 모듈별 도넛 링 4개
- `ScoreTrendChart.tsx` — 7일 라인 차트
- `RecentActivity.tsx` — 컴팩트 칩 행 (v06.21 재설계 · ~300px → ~70px)

### 4영역 레이아웃
1. Header — "📊 학습 현황"
2. StatCard ×4 — 오늘 학습 / 연속 일수 / 총 단어 / 정확도
3. WeeklyHeatmap (28일)
4. AccuracyRing + ScoreTrend 좌우 분할
5. RecentActivity

---

## 10. EchoMatch (v06.33 · L4c 청각생성)

### 목적
Shadow Reading — 원어민 발화 따라하기. 음운+발화 쌍둥이.

### 라우트
- `/text/[id]/echo` — 별도 라우트 (ModePills 'shadow' → 이 라우트)

### 4-Phase Cycle
1. **idle** — 대기
2. **listening** — TTS 재생 (Web Speech API)
3. **recording** — MediaRecorder (getUserMedia: echoCancel/noiseSuppress/AGC + webm/opus)
4. **comparing** — DTW (Dynamic Time Warping)
5. **scored** — 3축 점수 + 격려 메시지

### 3축 점수 (40/30/30 가중)
| 축 | 측정 | Threshold |
|---|---|---|
| 인토네이션 (40) | 피치 contour DTW (`pitchfinder` YIN) | PITCH_THRESHOLD=80Hz |
| 강세 (30) | RMS energy DTW | ENERGY_THRESHOLD=0.08 |
| 리듬 (30) | durationMs ratio | MAX 2.5 |

### 인프라 (`lib/echo/`)
- `pitch-extractor.ts` — YIN frame 2048 / hop 512 + voicedFrames
- `dtw-comparator.ts` — 3축 + `scoreFeedback` (great/good/fair/try)
- `audio-recorder.ts` — getUserMedia + MediaRecorder + playBothOverlay
- `tts-player.ts` — Web Speech API + voice 선택
- `sentence-splitter.ts` — 약어 Mr/Dr 처리
- `save-attempt.ts` — 세션 캐시 + attempt INSERT + finalize 통계 집계

### 컴포넌트 (`components/echo/`)
- `EchoMatchPlayer.tsx` — 4-Phase 컨트롤러 + sessionCache + attemptCountRef
- `MicPermissionGate.tsx` — 권한 요청 + 음성 즉시 삭제 안내
- `PhaseProgress.tsx` — 4 pill + 진행 %
- `SentenceCarousel.tsx` — Lora 18-22px
- `PitchVisualizer.tsx` — Canvas 2D devicePixelRatio + 원어민 var(--p) vs 사용자 var(--success) overlay + 정규화 min×0.9 max×1.1
- `ScoreCard.tsx` — overall 48px mono + 3축 weight % + tone 색

### DB (2 migrations)
- `echo_match_sessions` — user/text/library_book FK + avg/best/worst + retried_sentence_ids TEXT[] + RLS
- `echo_match_attempts` — session FK + sentence_id TEXT + attempt_number + 3축 점수 + duration_ms + RLS + idx user_date

### 알려진 한계 (4건)
1. Web Speech API TTS 출력 직접 audio 추출 불가 — `buildSyntheticRefContour` 합성 reference (자기 발화 변동성 측정에 가까움). Phase 2 에서 cloud TTS + Storage 캐싱으로 진짜 비교.
2. DTW threshold (80Hz/0.08) PoC 후 사용자 베타 데이터로 보정 필요.
3. DTW Web Worker 미적용 (22 문장 챕터는 main thread OK · 100+ 문장에서 분리 필요).
4. iOS Safari 실 검증 미수행.

---

## 베타 — Pirate Quest

### 목적
단어 모험 3D 게임 (R3F · @react-three/fiber + drei).

### 라우트
- `/play/pirate-quest` — 풀스크린 (사이드바 X · SessionFrame ✓)

### 컴포넌트 (`components/pirate-quest/`)
- `PirateQuestGame.tsx` / `PirateQuestUI.tsx` / `PirateQuestUI.css`
- `PirateScene.tsx` — R3F 3D 씬
- `PirateModel.tsx` — GLB 모델

### Data
- `lib/pirate-quest/data.ts` — 단어 풀 + 스테이지 매핑
- `lib/pirate-quest/types.ts`

---

## 인지 깊이 매트릭스

같은 L4a 안에서도 인지 채널이 다름:

| 모듈 | 단서 | 응답 | 회상 깊이 | 적합 단어 상태 |
|---|---|---|---|---|
| Flashcard (L4a) | 단어 1개 (시각) | 자가판정 | 재인 + 메타인지 | new → shaky |
| WordBlitz (L4a) | 4지선다 | 클릭/탭 (속도) | 재인 + 자동화 | shaky → stable 가속 |
| PairFlip (L4a) | 카드 한쪽 (단어/뜻) | 짝 위치 식별·클릭 | 재인 + 공간 기억 + 매칭 인지 | new → shaky / shaky → stable |
| SpellForge (L4b) | 뜻 + 첫 글자 | 타이핑 (시각 생성) | 시각·의미 생성 인출 | shaky → stable 검증 |
| EchoMatch (L4c) | TTS 청취 | 발화 (청각 재생산) | 음운 + 발화 쌍둥이 | shaky 견고화 |
| ScriptQuiz (L5) | 스크립트 맥락 전체 | 4지선다 | 의미 통합 (Recognition + Transfer) | 텍스트 단위 검증 |
| Dictation (L6) | TTS (청각) | 타이핑 (자유 재생산) | 음운+의미+문법+철자 통합 | 텍스트 단위 완성 |
