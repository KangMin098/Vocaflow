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
| 5 | **WordBlitz** | L4a 자동화 | Recognition + 속도 | `/wordblitz`, `/play/wordblitz` | 완료 (2D 속사 인지) |
| 6 | **PairFlip** | L4a 공간기억 | Recognition + Spatial | `/pairflip`, `/pairflip/play`, `/pairflip/results` | ✅ MVP (v06.21) |
| 7 | **ScriptQuiz** | L5 정복 | Recognition + Transfer | `/scriptquiz`, `/scriptquiz/play` | ✅ React + AI 생성 |
| 8 | **Dictation** | L6 완성 | Free Recall + Production | `/dictate`, `/dictate/setup`, `/dictate/session`, `/dictate/results` | ✅ MVP (v06.7) |
| 9 | **Dashboard** | L7 회고 | 메타인지 | `/dashboard` | ✅ 설계 완료 |
| 10 | **EchoMatch** ★v06.33 | L4c 청각생성 | Shadow Reading | `/text/[id]/echo` | ✅ v06.33 PoC (4 한계) |
| 11 | **Comic Reader** ★CCP | L0~L2 입력/프리뷰 | Dual Coding 정독 프리뷰 | `/text/[id]/comic` | ✅ P1 (리더 실 · 발행 시 노출) |
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

**현재 활성 (6 Section — 단어 관점 종합 포트폴리오)** v06.35 Portfolio 재설계:
- `WordVaultHub.tsx` — 6 Section 조립 + 주간 목표 fetch · max-w 5xl
- `VaultIdentity.tsx` ★v06.35 — Section 1 Mastery Hero (큰 숫자 + V-Level 메타 칩 + 4 bucket 가로 비교 막대 + 단일 CTA + 주간 목표)
- `VocabularyLevelMap.tsx` ★v06.35 — Section 2 단어 수준 지도 (V0-V11 분포 + i+1 zone 강조 + 트랙별 수준)
- `ResourcePortfolio.tsx` ★v06.35 — Section 3 학습 자산 (도서/스크립트/공용 단어장 3-col grid)
- `RecommendedBooks.tsx` ★v06.35 — Section 4 i+1 권장 도서 4권 (`scoreBook` + `judgeIPlusOne`)
- `NextStepList.tsx` ★v06.35 — Section 5 단어장 추천 (`recommend_word_sets_for_user`)
- `FlowStripe.tsx` ★v06.35 — Section 6 28일 sparkline + 평균/활동/총합 + 마지막 활동

**보존 (현재 hub 미사용)**:
- `AssetGrid.tsx` ★v06.35 — 단어장 grid (browse view 등에서 재활용 가능)

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
4지선다 빠른 인지(ko 뜻 → en 단어). 시간 압박·콤보로 자동화 형성.

### 라우트
- `/wordblitz` — Hub
- `/play/wordblitz` — 풀스크린 (사이드바 X · SessionFrame 자동 주입)

### 게임 — 속사 인지 (v07 재설계, 2026-07)
- ko 뜻 프롬프트 → 4개 en 타일(2×2) 중 정답을 탭/키(`1`–`4`)로 선택.
- 문항별 타이머 바(레벨 상승 시 단축) · 콤보(연속 정답 → 배수·레벨업) · 점수(시간보너스×콤보배수).
- 절제된 게임 주스: 정답 초록+체크, 오답 앰버 shake, 콤보 범프. 차분한 종료("오늘 잘 마쳤어요" — 폭죽 없음).
- **이전 Three.js 3D 인형뽑기 대체** — ~5초/단어 → ~1-2초/단어, 모바일 우선(3D 자산·useWordBlitzGame·WordBlitzUI.css 삭제).

### 디자인
- 순수 2D DOM · **테마 토큰(라이트/다크 자동)** · 게임 예외 토큰 `--combo`/`--streak`.
- 접근성: 키보드 `1`–`4` · aria-live · `prefers-reduced-motion` · 44px+ 타일.

### 컴포넌트
`components/game/wordblitz/WordBlitzGame.tsx`(게임 본체 · 계약 wordPool/onExit/onCorrect/onWrong FSRS) · `WordBlitzUI.tsx`(로딩 폴백) · `lib/wordblitz/data.ts`(Word/SAMPLE_WORDS/POINTS).

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
- `/scriptquiz` — Hub (실 카탈로그 도서·챕터 grid · 한영 토글) — server `page.tsx` fetch `list_book_chapter_quiz_catalog` → client `ScriptQuizHub`
- `/scriptquiz/play` — 3-screen flow · `?book=&ch=` 큐레이션 공유 챕터 퀴즈(`select_book_chapter_quiz`) · `?text=` 개인 퀴즈(`quiz_questions`) · 미지정 시 MOCK

### 문제 출처 (v06.114)
- **큐레이션 공유** — `library_chapter_quiz` (도서 챕터별 스토리 퀴즈, 문항 수 = 도서 V-Level 곡선 3~10). LCP 큐레이션 드레인(Claude Code, `scripts/lcp/generate-chapter-quiz.mjs`)이 챕터 본문을 읽어 생성 → 전 학습자 공유. Admin `/admin/curation` "스크립트 퀴즈 큐" → `book_quiz_jobs`.
- **개인** — `quiz_questions` (per user+text) 는 개인 스크립트용으로 병행 유지.
- 앱 런타임 LLM 0 — 문항은 드레인 시 사전 생성.

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

## 8. Dictation (L6 완성 · v07 — 학습 자산 연결)

### 목적
스크립트 단위 다중 채널 재생산 (음운+의미+문법+철자). Free Recall + Production — 학습의 정점.
**v07 부터 문장 안의 "내 단어"(타깃)를 인출 대상으로 삼아 받아쓰기가 곧 그 단어의 복습이 된다.**

### 라우트
- `/dictate` — Hub (오늘의 받아쓰기 CTA · 자료 3탭 · 약점 · 최근)
- `/dictate/setup?text=|set=|custom=1` — Setup (미리보기 3지표 + 분량/문항수/순서/채점/듣기)
- `/dictate/session?sessionId=` — 세션 (TTS · 단어별 채점 · 4단계 힌트 · Focus Mode)
- `/dictate/results?sessionId=` — 결과 (**DB 조회** · 복습 반영 단어 · 청취 폭 · 반복된 태그)

### 자료 4소스 (v07)
| 소스 | 스코프 | 문장 출처 | 타깃 단어 |
|---|---|---|---|
| 도서 챕터 | `?text=`(library_book_id 有) | `get_chapter_content` RPC (content_chunks) | 그 챕터 vocabularies |
| 내 스크립트 | `?text=` | `texts.content` | text_id 로 묶인 vocabularies |
| 공용 단어장 | `?set=`(+`?chapter=`) | `shared_words.source_sentence` → `example_en` | 그 단어 자체 |
| 오늘의 받아쓰기 | 기본값 | 복습 임박 예문 3 + 재도전 1 + 읽던 자료 1 | 복습 임박 단어 |
| 붙여넣기 | `?custom=1` | sessionStorage (자료로 저장 안 함) | 내 vocabularies 중 등장하는 것 |

### 설정
- **한 번에 받아쓸 분량 1·2·3문장** (v07 — 기존 '단위 문장/단락/전체' 대체. 단락·전체는
  연속 본문에서만 성립해 단어장·오늘에는 적용 불가였다). 단어장·오늘은 1문장 고정.
- 채점 2종: Smart / Strict · 순서: 순차 / 섞기
- CEFR A1~C2 자동 감지 (v06.22 수동 선택 제거) → 분량·속도·반복·힌트 추천값 자동 적용

### 인프라 (`lib/dictation/`, 11 파일)
- `types.ts` — Config(chunkSize) · Session · Item(targetWords·maxHintLevel·replayCount) · WordResult
- `source.ts` — **자료 해석 단일 출처**. 4소스 → `DictationSentence[]` + 타깃 단어 부착
- `daily.ts` — 오늘의 받아쓰기 조립 (due 3 / retry 1 / fresh 1 · 오늘 받아쓴 문장 제외)
- `catalog.ts` — 허브 자료 목록 (내 도서 · 스크립트 · 구독 단어장)
- `targets.ts` — 타깃 적중 판정 → FSRS 1~4 (힌트 4단계 사용 시 Again)
- `error-tags.ts` — 누적 가능한 오류 태그 9종 + 처방 문구
- `persist.ts` — 세션/문항 적재 · 완주(scores + FSRS flush) · 통계 RPC 3종 read
- `cefr.ts` — A1~C2 + 그룹별 추천(chunkSize)
- `text-splitter.ts` — 약어 처리 + 문장 분리
- `scoring.ts` — Levenshtein + Word alignment + Smart/Strict
- `analyzer.ts` — 세션 내 설명용 패턴 6종 (누적은 error-tags 가 담당)
- `audio-control.ts` — Web Speech API + autoRepeat + 무음 간격
- `hint.ts` — 4단계
- `storage.ts` — **진행 중 세션 런타임 캐시만** (기록 원본은 DB)

### Hooks
- `useAudioControl.ts` — TTS 재생/반복/정지
- `useDictationSession.ts` — 문항 진행 + 채점 + 적재 3시점 (`createDictationSession` 포함)

### 컴포넌트 (`components/dictation/`)
- `DictationHubClient.tsx` — 오늘의 받아쓰기 카드 + 이어하기 + 최근 세션
- `SourcePicker.tsx` — 도서/스크립트/단어장 3탭 + 붙여넣기
- `WeaknessPanel.tsx` — 최근 2주 오류 태그 Top3 + 처방 + 예시
- `DictationSetupClient.tsx` · `DictationSessionClient.tsx` · `DictationResultsClient.tsx`

### 영속화 (v07)
`dictation_sessions` / `dictation_attempts` (RLS) · 완주 시 `scores`(module='dictation') +
`vocabularies`/`learning_records`(FSRS). `learning_records` INSERT 트리거가 `daily_activity`
를 갱신하므로 streak 도 자동. 상세: [DB_SCHEMA.md](./DB_SCHEMA.md)

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

## 11. Comic Reader (CCP · L0~L2 입력/프리뷰)

### 목적
도서를 만화(그림+정본 대사)로 읽는 **동기부여 프리뷰 정독**. Dual Coding(그림+언어) + Emotional Encoding(서사). 읽기 전 schema 형성 → 본문/ScriptQuiz/Dictation 유입 (소비 time-sink 아닌 방향성 있는 진입).

### 라우트
- `/text/[id]/comic` — ModePills input 그룹 "만화" 진입 (라이브러리 도서 + 발행 만화 존재 시). 없으면 EmptyState.
- `/comics` — **만화 단일 메뉴**(사이드바 Scripts 그룹 최상위 · `/library` 하위 탭 아님). redirect → `/comics/adapted`. 메뉴 안에서 **출처**로 나뉜다(ComicsTabs):
  - **Adapted `/comics/adapted`** — 도서 각색(CCP). 우리가 가진 원서를 모델로 각색. 카탈로그 + 이어서 보기(`comic_read_progress`). 등록 도서면 리더 직행, 미등록이면 상세로.
  - **Restored `/comics/restored`** — 원본 복원(PDCP). 저작권 만료 만화 원본을 수집·복원. 호 단위 독립 콘텐츠(원작이 만화 자체).
- `/comics/adapted/[bookId]` — 만화 상세. **미등록·비로그인도 프리뷰 3컷 열람**(아트만 — 정본 대사/vocab 은 리더 자산) + 포맷 선택. 시작 시 `enroll_library_book`(멱등) 후 리더 직행.
  - 명명: 기술(AI/스캔)이 아니라 **원작에 무슨 일이 있었는지**로 지은 과거분사 쌍 — 기술이 바뀌어도 이름이 낡지 않는다.

### 발견 (v07 CCP × Library — `docs/CCP_LIBRARY_INTEGRATION.md`)
만화는 **별도 콘텐츠가 아니라 같은 책(Work)의 다른 표현형(Expression)** — 데이터는 `library_books` 앵커, 탐색 UI 만 독립 코너화.
- **메뉴**: 사이드바 Scripts 그룹의 `Comics`(최상위). 2026-08-09 사용자 결정으로 LibraryTabs 4번째 탭에서 승격 — `/library` 탭은 3탭(도서/스크립트/공용 단어장)으로 복귀. 만화 액센트 = gold `--active`.
- **포맷 facet**: 장르 축과 직교. `BookFilterBar` "포맷" 구획(만화/원어민 음성) + QuickPick "만화로" + `BookGridCard` 배지(아이콘+sr-only).
- **선택**: `NetflixDetailSheet` 도서 상세에 gold 보조 CTA(만화로 읽기 / 만화 미리보기) + 만화 상세의 `ComicFormatChoice`(만화/원문/듣기 3카드, **권장 1개만** "지금 추천").
- **처방**: `lib/comic/prescribe.ts` — 이어보기 > 복습 > 난이도 > 미진단 순. 적정 난이도(ideal)에선 **본문을 권장**(만화는 스캐폴드).
- **조회 단일 출처**: `lib/comic/catalog.ts` (`fetchComicCatalog` / `fetchComicPreview` / `comicBookIdsOf`) — 도서 히어로 · 만화 탭 · 만화 상세 공유. `list_comic_catalog`(P1) 우선 + 구 RPC 폴백 2단.
- **분리 회계**: 만화 완주는 챕터 완료(`texts.status`)를 만들지 않음 — `comic_read_progress` 만 갱신(seductive details 방어).

### 리더 (`components/comic/ComicReader.tsx`)
- **Calm UI**: 앱 토큰 재스킨 · 2D 페이지 전환 + `prefers-reduced-motion` 즉시 컷 (아티팩트 3D 쇼케이스와 분리).
- **대사 non-cover**: 아트는 contain(온전) · 대사는 아래 대사존 (캐릭터 안 가림).
- **Desirable Difficulty**: verbatim(정본) 버블 blur→tap-reveal **기본**(회상 유도).
- **Context-Dependent vocab**: `target_vocab`(verbatim 버블 정합) 칩 → 단어 팝오버. 원문/퀴즈와 단어 일치.
- **Journey**: 마지막 = 본문 읽기 / 퀴즈 CTA. 폭죽/트로피 없음(차분한 "잘 읽었어요").

### 데이터 (발행 게이트 DEFINER RPC)
- `select_book_comic(book, chapter)` — published 만화만. 리더 RSC(`comic/page.tsx`)가 texts→library_book 분기 후 호출, 실패/미발행 EmptyState degrade.
- 생성/발행은 Admin `/admin/comic`(CCP). 상세: `scripts/comic/docs/COMIC_PIPELINE_DESIGN.md`.

### Phase
- P1: 리더 실 구현 + 안전 degrade. P2: blur→reveal 자가판정→`learning_records`(FSRS) + 이해 micro-check. P3: 진도(module_history 'comic') + FloatingSparkle 유입.

---

## 아케이드 스위트 — Game Lab (게임 19종 · v08.3)

### 목적
9모듈이 커버하지 않는 인지 채널(문맥 추론 · 철자 규칙 귀납 · 의미망 · 형태론 · 청각)을
검증된 인디 게임 원형으로 훈련. 모듈이 아니라 **모듈 위에 얹히는 놀이 표면**.

### 라우트
- `(main)/arcade` — 허브 (Sidebar Practice 그룹 등재 · `/hub` ArcadeEntryCard)
- `(app)/play/<slug>` — 게임 본체 19종 (풀스크린 · SessionFrame 자동 주입)

### 카탈로그 SSoT — `lib/game/catalog.tsx`
게임 정의(이름 · 태그라인 · 인지계층 · 무드 4색 · 라인 마크 · `source` · `minWords` · `closeHref`)의 유일한 출처.
`GameMark`(gamekit) · `SESSION_META`(SessionFrame) · 진입 카드 문구 · 아케이드 그리드가 전부 여기서 파생된다.
**게임을 추가할 때 손대는 곳은 카탈로그 1곳 + `/play/<slug>/page.tsx` + `ArcadeGameId`/`ModuleId` enum.**

### 계열(family) — 같은 인지 루프는 한 장으로 접는다
실측 대조 결과 **`wordblitz`·`daily-blitz`·`word-economy`·`ghost-race` 4종(1,604줄)이 완전히 같은 루프**였다 —
`target.ko` 프롬프트 → 4지선다 en 타일 → `o.en === target.en`. 다른 건 게임이 아니라 위에 얹은 메타(타이머·데일리·경제·경쟁)뿐.

지우지 않는 이유: 학습적으로 같아도 **동기 장치로는 다르고**, 같은 문답 위에 모드를 얹는 구조는 Gimkit이 검증했다.
진짜 문제는 존재가 아니라 **19장을 동급 카드로 평평하게 깔아 "또 같은 거네"로 읽힌 것** → 허브에서 계열 1장으로 접는다.

- `GAME_FAMILIES` (계열 정의) + `GameEntry.family` / `modeLabel` / `modeNote` / `modeOrder`
- `hubSections()` → 섹션별 `HubItem[]`(`{kind:'game'}` | `{kind:'family', modes}`). `countHubGames()` 로 배지 산출
- 계열은 **쪼개지지 않는다** — 멤버 다수가 속한 섹션으로 통째 이동(blitz = mine). 소수파 모드는 칩 설명에 명시(데일리 = 내장 뱅크)
- 계열 카드는 `<a>` 가 아니다(중첩 앵커 금지) — 카드는 컨테이너, **모드 칩 하나하나가 플레이 링크**
- 멤버가 1개면 접지 않는다. 게임 코드는 무변경 — 접기는 순수 표시 계층

**유지한 약한 중복** — `letter-forge`(글자 제공) → `wordsmith-vigil`(무단서 타이핑)는 Desirable Difficulty 계단,
`connections`(선택 분류) ↔ `lexicon-estate`(공간 배치)는 입력 방식이 달라 학습 경험이 구분된다.

### 데이터 소스 (`source`) — 옛 1차 분류축, 지금은 죽어 있다
| source | 수 | 의미 |
|---|---|---|
| `mine` | 19 | 내 단어로 플레이 → FSRS 갱신 (`minWords` 1~8) |
| `bank` | 0 | 내장 뱅크 전용 — v07.8 에서 전 게임이 학습자 단어를 쓰게 되며 소멸 |

v07.8 이후 19종 전부가 `mine` 이라 이 축으로는 아무것도 갈리지 않는다(허브 분류축이
학습 동사 = `HUB_TRACKS` 로 교체된 이유). 필드 자체는 `pickDailyGame`·타입 호환을 위해 남아 있다.

### 스코프 3단 (`lib/game/use-word-scope.ts`)
1. **explicit** — `?set=` / `?text=` (+`?chapter=`) → `fetchScopedWords`. 단어 부족 시 `NotEnoughWords` 안내(몰래 바꿔치지 않음).
2. **mine** — 스코프 없음 + `minWords>0` → `fetchDueGameWords`(due 우선 cap 40). **아케이드 기본값.**
3. **demo** — ①②로 최소 단어 미달 → 게임 내장 맛보기 풀. 브레드크럼에 "맛보기 단어"로 명시(기록되지 않는 플레이를 오인시키지 않음).

**훅으로 뽑은 이유** — 스캐폴드(17종)와 독립 3D `/play/wordblitz` 가 스코프 로직을 각자 복제하고 있었다.
카탈로그가 `source:'mine'` 이라 광고하는데 실제로는 내 단어를 안 쓰는 불일치가 실제로 발생했으므로,
두 경로가 같은 훅을 쓰게 강제한다. 브레드크럼 매핑은 `lib/game/scope-resource.ts`.

### 세션 기록 (`lib/game/use-session-recorder.ts`)
정/오답 집계 → `scores` 적재 + 아케이드 XP·스트릭 적립. **언마운트에서도 flush**(1회 가드).
게임 내부 종료 버튼뿐 아니라 세션 셸 X·Esc·브라우저 뒤로까지 덮는다 —
예전엔 `onExit` 에만 걸려 있어 X 로 나가면 `learning_records` 만 남고 `scores`·XP 는 통째로 유실됐다.

### 허브 IA — Game Lab (v08.3)
① **Lab Status**(스트릭·랭크·오늘의 할당량·앰비언트) → ② **Lab Index**(구역 목차) →
③ **Today's Experiment** 1종(KST 날짜 시드 결정론 회전) → ④ **Bay 01/02/03**.
근거: choice overload(선택지 과다 = 마비) vs SDT 자율성 → "추천 하나 + 전부 열람".
19장이 한 화면에 깔리므로 목차(Lab Index)가 앞에 선다.

**연구소 은유 · 영문 구조 라벨** — 이 화면이 실제로 하는 일은 19개의 서로 다른 실험 장치 중
오늘 어느 것을 돌릴지 고르게 하는 것이다. "아케이드(오락실)" 은 각 게임이 왜 다른 판돈 구조
(시계·거리·자본·박)를 갖는지 말할 자리를 주지 못했다. 구역(Bay) · 실험 코드(`RC-01`) ·
프로토콜(브리핑) · 시운전(Trial Run) 이 그 자리를 만든다.
**구조 라벨만 영문**이고 설명 문장은 한국어다 — 대상 독자(한국 고등학생~성인)에게
설명까지 영어로 주면 비용만 는다.

- `HUB_TRACKS[].code` = 구역 접두(`RC`/`SY`/`IN`) → 카드 코드는 표시 순번에서 파생(`labCode`)
- 카드 = `.arc-slot`(컨테이너) > `<a class="arc-card">` + `<button class="arc-brief">` **형제**
  (중첩 인터랙티브 금지 · e2e 가 `.arc-grid a[href^="/play/"]` 수로 도달 가능 게임 수를 못박는다)

### Protocol 브리핑 — `lib/game/brief/` + `components/game/brief/*`
게임을 고르는 근거가 이름·색·태그라인뿐이라 선택이 사실상 찍기였다. 카드 우상단 `(?)` 가
**보드 그림 3장 + 눌러서 통과하는 Trial Run** 을 연다.

- `GAME_BRIEFS` — 게임당 `objective` · `board` · `figures[3]` · `trial` · `facts`. 문구는 전부
  각 게임 소스 헤더의 계약에서 끌어왔고, 추측한 수치 대신 게임이 정의한 단위(3랩·20틱·4회랑)로 말한다.
- **아키타입 5개** `pick` / `group` / `assemble` / `judge` / `type` — 19종의 표면은 다 달라도
  학습자의 손동작은 다섯으로 수렴한다. 하나의 렌더러(`BriefBoard`)가 `figure`(정적 삽화)와
  `trial`(실제 클릭) 두 모드로 쓰인다 — 설명에서 본 그림과 눌러 보는 그림이 같아야 배운 것이 이어진다.
- 스크린샷을 쓰지 않는 이유: 게임이 바뀌면 조용히 거짓이 되고, 스크린리더·대비·터치 타겟을 통제할 수 없다.
- 계열은 탭으로 4모드 전환(`GameBriefModal entries[]`). `Launch` 는 허브가 계산한 **스코프 포함 URL**.
- 모달 금지 규칙(CLAUDE.md)과의 관계: 금지 대상은 **세션 중** 인출을 끊는 오버레이다.
  이 다이얼로그는 세션 진입 **전** 국면에만 열린다.

#### v08.4 — 전수 평가 → 표현력 확장 → 19종 재설계

읽기 전용 평가자 5명이 소스 대조로 채점한 결과 **평균 9.6/20**(결함 132건), 축별로
identity 2.32 · motion 2.32 · **decisive 1.11** · truth 2.05 · surface 1.79. 다섯 평가자가
독립적으로 같은 결론에 도달했다 — **계열 안에서 브리핑이 구별되지 않는다.** 19종 중 11종이
`pick` + 1스텝 "뜻 고르기"라서 trial 을 서로 바꿔 끼워도 통과했다(그건 19종 공통 동작이므로
그 게임을 아무것도 구별해 주지 못한다).

원인은 문안이 아니라 **데이터 모델**이었다. 게이지가 하나뿐이라 판돈의 절반이 지워지고,
프롬프트가 판 전체에 고정이라 국면 전환을 말로만 알리고, 판돈 2택을 정답 타일과 같은 격자에
섞어야 했고, 타이핑 표면이 없어 세 게임(`wordsmith-vigil` · `ghost-race` 아웃코스 ·
`silent-rule` 봉인)의 손동작을 **거짓으로 적을 수밖에 없었다**(motion 0점).

| 확장 프리미티브 | 여는 것 | 채택 |
|---|---|--:|
| `hud: BriefGauge[]` + `pips` + `value` | 압력이 둘 이상인 게임 · 셀 수 있는 예산(촛불 3·목숨 3·기회 4) | 게이지 48개 · 핍 14종 |
| `BriefSurface`(스텝·프레임별 `prompt`/`doc`/`headword`/`hud`) | "D 를 누르면 화면이 바뀐다" 같은 국면 전환 | 19종 |
| `board.choices` 결정 스트립(격자 **밖**) | 판돈 2택 — 답이 아니라 결정임을 형태로 구별 · `lines` 로 손익 수치 대비 | 18종 |
| `token.at: [row, col]` 좌표 격자 | 위치 자체가 결정(cascade "가장 낮은 장/돌 옆/뭉친 장" · lexicon-estate 도면 인접) | 2종 |
| `token.effect` 비용 타일 | 대가를 내고 정보를 사는 타일 — 누르면 게이지가 실제로 깎이고 **오답이 아니라 지출**로 처리 | 7종 |
| `kind:'type'` + `step.type` 타이핑 | 후보 없이 칸 수만 보고 철자를 치는 게임 | 3종 |

결과: trial 스텝 평균 **1.1 → 2.7**. 1스텝 재인만 시키는 게임 0.

- 파일을 계열별로 나눴다(`brief/{recall,stake,assemble,rule,special}.ts` + `types.ts` + `index.ts`).
  한 파일에 19종을 몰면 **옆 게임의 브리핑이 보이지 않아 서로 베낀 튜토리얼이 된다** — 실제 원인.
- 무결성은 `__tests__/brief.test.ts` **33개**가 강제 — `want`/`focus` 참조 무결성(누를 수 있는 것
  = 토큰 + 결정 카드), 슬롯 수 = 정답 길이, ok 고아 검출, 비용 타일의 `want` 금지, 좌표 충돌,
  핍 `left ≤ total`. 오타 하나가 "영원히 통과 못 하는 튜토리얼"을 만들기 때문에 눈으로는 안 잡힌다.
- **최적합 계약 4개**(같은 파일)가 회귀를 막는다 — ① 1스텝 재인 금지 ② 판돈이 화면에 보임
  ③ 두 게임의 트라이얼 서명이 겹치면 실패 ④ objective 가 19종 공통 서술이면 실패.
  ③은 계열을 가로지르는 충돌(`daily-blitz` ↔ `word-economy`)을 실제로 잡았고, 확인해 보니
  구별은 실재했다 — 전자는 선택지를 **보기 전에** 걸고 후자는 체결에 **성공한 뒤에만** 열린다.
  서명이 결정의 위치를 담지 않아 생긴 오탐이라 서명에 그 차원을 넣었다.
- `tests/e2e/15-arcade-brief.spec.ts` — **19종 전수**를 브리핑 데이터로 구동한다(`want` 를
  순서대로 누르고 타이핑 스텝은 실제 입력). 데이터와 화면이 어긋나면 즉시 실패한다.
  단위 테스트가 잡지 못하는 것 — 렌더러가 그 프리미티브를 실제로 그리는지, 판정이 결정 카드·
  타이핑·비용 타일을 받는지 — 은 눌러 봐야만 안다. 22/22 통과(1.7분).
  타일 셀렉터는 `data-id` — cascade 는 같은 정답이 세 자리에 깔려 텍스트로 구별이 불가능하다.

### 리텐션 메타
`lib/game/arcade-meta.ts` — localStorage 스트릭(하루 유예) · XP/레벨(√곡선) · 데일리 목표 30XP.
`ArcadeMetaStrip` 노출(v08.3 라벨: Streak · Rank · Daily quota · Ambient).

### 배경음악
### v07.8 — 19종 전수 재설계 (감사 → 재설계 → 적대적 반증 → 강화)

게임별 병렬 에이전트로 4라운드를 돌렸다. 루브릭 10축 평균 **23.1 → 34.8 / 50**.

**1R 감사** — 재미 이전에 **제품 유효성** 결함이 나왔다. 게임 7종 이상이 영어를 한 글자도
몰라도 이길 수 있었고(정답이 화면에 인쇄돼 있었다) 그 결과가 FSRS 로 "학습했다"고 기록됐다.
축 평균 tensionCurve 1.42 · decisions 1.47 · streakHook 1.79 · learningIntegrity 1.95.

**2R 적대적 반증** — 재설계 결과를 점수 재측정이 아니라 **싸게 이기는 방법 찾기**로 검증했다.
익스플로잇 **42건**, 구현자 주장 중 **불성립 27건**. 전부 코드 근거 + 시뮬 수치 동반
(예: word-economy 의 "지분 상시 매입"이 7개 정답률 밴드 전부에서 자산 2~3배).

**3R 강화** — 수정 후 같은 시뮬로 재계산해 숫자로 확인: 지분 자산비 2.25~2.95 → 0.62~1.28 ·
정답률 0.5~0.7 학습자 파산률 83% → 17% · ghost-race 리빌 후 4문항 내 재출제율 100% → 2% ·
word-orrery 소거 확정 문항 16.67% → 0%.

⚠️ **분류축 교체** — 19종이 전부 학습자 단어를 쓰게 되면서 `source`(mine/bank) 축이 죽었다.
그대로 두면 "큐레이션 세계" 섹션이 비고, `pickDailyGame` 이 빈 후보로 크래시한다
(`from[NaN]` → undefined → 단어 6개 미만 학습자의 `/arcade` 사망). 새 축은 **학습 동사**
(L계층 진행과 같은 순서): `빠르게 떠올리기(6)` · `직접 만들어 내기(6)` · `읽고 추론하기(7)`.
`HUB_TRACKS` + `trackOf()` 로 카탈로그에 명시 — layer 문자열 파싱 금지(오분류가 조용히 생긴다).

**FSRS 무결성 (중앙 · `lib/game/record-result.ts`)** — 가장 큰 남은 결함은 재미가 아니라
학습 스케줄 오염이었다. 게임마다 판단하게 두면 19가지 기준이 생기므로 중앙에서 막는다:
- `assisted: true` → 카드 미갱신. 정답을 이미 보여준 뒤의 입력은 인출이 아니다.
- **같은 카드 10분 재채점 금지.** FSRS 는 독립 인출 1회를 전제하는데 실측상 ghost-race 는
  레이스당 36회 채점, word-economy 는 방치만으로 90초에 lapse 7회였다.
- 스캐폴드 계약 `onCorrect(word, { assisted })` — 기존 호출은 그대로 동작.
- ⚠️ 게임이 `onCorrect/onWrong` 을 **아예 안 부르는 쪽으로 도망가면 안 된다**. letter-forge 가
  그랬고 결과는 "합리적 플레이어일수록 모르는 단어를 FSRS 에서 지운다"였다.

**minWords 와 자료 크기** — 강화로 요구 단어가 올라가면 도서 챕터가 게임을 못 연다
(`useGameWordScope` 는 explicit 스코프 미달 시 NotEnoughWords 로 **차단**한다).
DB 실측 653세트: ≥24단어 371(57%) · ≥20 414 · ≥16 448 · ≥12 487 · ≥8 554(85%) · 최소 1.
게임은 **풀 크기의 함수로 스케일 다운**해야 한다(cascade 가 goal·장수·시간 곡선을 전부
함수화해 5단어 챕터도 성립시킨 것이 모범). 카탈로그 `minWords` 는 라우트 실값과 반드시 일치.

**회귀 스펙** — `07-arcade-games`(19종 마운트+첫 입력+콘솔에러 0 · 준비 마커는 **조작 가능한
요소**로 잡을 것) · `13-arcade-integrity`(자료 연계 — A 라벨 · **A3 실제 단어 노출** ·
B 허브 팬아웃 · C 스크립트 진입).
⚠️ A3 가 필요한 이유: 라벨만 맞고 실제 문제는 내장 콘텐츠인 경우를 A 가 못 잡는다
(morpheme-rules 가 그랬고 `onCorrect/onWrong` 의 99.7% 가 silent skip 됐다).

---

**v07.7 — 측정으로 선곡 + 마디 정렬 루프.** 요구는 "웅장하면서 긴장감과 긴박감, 빠른 템포".
v07.6 의 Scott Buckley 세트가 이를 못 맞춘 이유는 **측정 가능했다**: 후보 118곡
(Buckley 72 + Nakarada 46)을 재보니 Buckley 라이브러리 대부분이 `pulse`(자기상관 피크 선명도)
≈ 1.0 — 박이 노이즈와 구별되지 않는 앰비언트였다. 제목이 아무리 장엄해도 몰아치지 않는다.

측정 축: `bpm`(온셋 포락선 자기상관) · `onset/s`(초당 어택 = **긴박**) · `pulse`(박 선명도 = 추진) ·
`low%`(150Hz 이하 온셋 에너지 = 타격) · `full%`(RMS 가 피크 60% 이상인 시간 비율 = **웅장**) ·
`tension`(2~6kHz 시간 변동 = 트레몰로·스타카토·불협).
**Alexander Nakarada**(creatorchords.com · CC-BY 4.0)가 전 축에서 크게 앞서 19슬롯 중 16을 가져갔다.
전 곡 **129~161 BPM**, 19종 고유 트랙(재사용 0), 총 33.3 MB.

루프는 **마디 정수배**로 자른다 — `loopLen = bars × 4 × 60/bpm`, 크로스페이드도 1마디.
그래야 꼬리(start+loopLen)와 머리(start)의 **박 위상이 같아져** 크로스페이드가 박 위에 얹힌다.
임의 길이로 자르면 겹박(플램)이 나 추진력이 뭉개진다. 길이는 템포에 따라 109.5~110.6초(59~74마디).
정규화 -16 LUFS / TP -1.5 dBTP → VBR MP3(-q:a 5) 44.1kHz 스테레오.

⚠️ 루프를 다시 구울 때 **크로스페이드가 조용히 사라지는 경로가 둘** 있다. 둘 다 파일은 HTTP 200 이고
재생도 되는데 딱 1마디 짧고 루프마다 클릭이 난다:
① 한 입력을 `asplit=3` 으로 쪼개 `atrim` 셋을 물리면 `acrossfade` 가 빈 스트림을 받는다 →
head/tail/body 를 각각 별도 `-i` 로 열 것.
② `-t X` 로 뜬 조각이 MP3 프레임 경계 때문에 X 보다 살짝 짧으면 `acrossfade=d=X` 가 성립하지 않는다 →
`X+0.4`초를 떠서 필터 안에서 `atrim` 으로 정확히 자를 것.
빌드 스크립트에 출력 길이 == loopLen 단언을 두고, 회귀는 `tests/e2e/12-arcade-audio.spec.ts` 가 잡는다.

트랙은 카탈로그 `GameEntry.music`(`public/audio/games/<slug>.mp3`). 크레딧은 같은 폴더 `CREDITS.txt`
+ `/arcade` 푸터 표기(CC-BY 4.0 은 표기 의무 — 두 아티스트 모두 명시).
선호는 `lib/game/music-pref.ts` 단일 키(`vocaflow-arcade-music`) — **허브 토글**(`ArcadeMetaStrip`)과 **게임 내 버튼**(`GameMusic`)이 공유.
**기본 ON**(v07.6 사용자 결정 — 단어 게임에 음악이 중요). 이전 기본 OFF 는 Calm UI 근거였지만 결과가
무음이었다(토글 전에는 트랙을 내려받지도 않음). 자동재생 정책은 `play()` 거부 시
다음 제스처(`pointerdown`/`keydown`)에 시작하는 방식으로 처리 — 타이핑 전용 게임 때문에 `keydown` 이 필수.
미결정 상태에선 게임 내 버튼이 "배경음악" 라벨을 펼쳐 지금 나는 소리의 출처와 끄는 길을 알린다.
`readMusicPref()` 는 미설정을 `null` 로 유지하고, 실제 on/off 판단은 `readMusicOn()`(= `?? DEFAULT_MUSIC_ON`)을 쓴다
— 명시적 OFF 를 기본값 변경이 덮어쓰지 않게 하기 위해서.

**효과음(v07.6)** — Kenney "Interface Sounds"(CC0) → **Mixkit 실녹음**. FFT 실측상 기존 6종은 전부 모노 ·
8 kHz 이상 에너지 0~0.6% · `correct`/`complete` 는 스펙트럴 평탄도 0.0000 인 대역제한 합성음이었다.
교체본은 스테레오 실녹음(벨 · 나무 타격 · 반짝임 · 타자기 타건 · 실제 동전 · 금관 합주 · 총 494 KB).
`useSfx` API·`SFX_SRC` 확장자 매핑 불변 → 게임 코드 변경 0. 오답이 버저가 아니라 나무 타격인 것은
Empathetic Feedback(오답에 비난조 금지).

⚠️ `.gk-root > :not(...)` / `.wbz-root > :not(...)` 같은 자식 일괄 규칙에 **반드시 `:not(.gk-music-btn)` 을 넣을 것** —
빠뜨리면 명시도에 밀려 `position: fixed` 가 죽고 버튼이 흐름에 박힌다(v07.4 이전 전 게임 증상).
gamekit 을 쓰지 않는 게임(WordBlitz · Pirate's Bounty)은 `GameKitStyles` 를 함께 렌더해야 버튼 스타일이 적용된다.

---

## 베타 — Pirate Quest

### 목적
단어 모험 3D 게임 (R3F · @react-three/fiber + drei). 아케이드 카탈로그 `source: bank` · `beta`.

### 라우트
- `/play/pirate-quest` — 풀스크린 (사이드바 X · SessionFrame ✓ · 복귀 `/arcade`)

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
