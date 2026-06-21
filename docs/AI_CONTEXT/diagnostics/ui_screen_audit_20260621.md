# UI 화면 구조 감사 (2026-06-21)

> read-only 정적 분석. 코드 수정 0. Playwright 미사용 (환경 부재).
> 대상 page.tsx 77 / 사용자 대면 ~40. SSoT: `docs/DESIGN_SYSTEM.md` v06.39→v06.40 Reading Room.

---

## Tier A (6) — 사용자 명시 깊은 감사

### `/hub` (`(main)/hub/page.tsx`, RSC wrapper + client children)

- **진입**: `page.tsx → Screen(wide/bg2/padX=md) → [HubHero, TodayFocus, ContinueCard, ModuleGrid, RecommendedSetsSection, RecentActivity]`
- **정보구조** (위→아래, F-pattern): ① 인사+Streak+V-Level 배지+Today CTA → ② Focus(페르소나 분기) → ③ Continue(이어하기) → ④ ModuleGrid 7개 → ⑤ Recommended(VRL RPC) → ⑥ Recent
- **레이아웃**: `<Screen width="wide" background="bg2" padX="md">` ✓ · flex-col gap-4 · `py-6 md:py-8`
- **타이포**: HubHero 의 hero 가 `font-display` (font-editorial 미사용) · 본문 `font-body`
- **색/감성**: `--p` 명시적 CTA 한정 · 추천 카드 type별 배지 색 · 진입 첫인상 = Streak+V-Level 배지
- **상태 디자인**: empty/loading/error 자식 컴포넌트별 처리 (page.tsx 자체엔 없음 — `loading.tsx`/`error.tsx` 의존)
- **데이터**: 자식 컴포넌트가 RPC (recommend_word_sets_for_user) · TodayFocus 페르소나 분기 실데이터
- **Reading Room 정합**: ⚠ HubHero hero `font-display` (v06.39 권장 `font-editorial` 미적용) — "잉크/페이퍼/금" 시각언어 약함

### `/dashboard` (`(main)/dashboard/page.tsx`, RSC)

- **진입**: `page.tsx → Screen(content/bg2/padX=md) → [TodayHero, WeeklyHeatmap, MemoryStatus, RecentActivity, footer(italic)]`
- **정보구조**: ① TodayHero(인사+오늘 진행) → ② WeeklyHeatmap(28일) → ③ MemoryStatus(기억 4상태+CTA) → ④ Recent → footer "Slow is smooth"
- **레이아웃**: `<Screen width="content">` (Hub 보다 좁음) · flex-col gap-4
- **타이포**: TodayHero `font-editorial` 1회 ✓ · footer `font-english italic` ✓ "사람의 말투"
- **색/감성**: Memory Decay 4색 사용 추정 (MemoryStatus) · footer t3 muted
- **상태 디자인**: empty(자식 위임) / loading/error(파일 의존)
- **데이터**: `todayWords={23} goal={30}` 하드코딩 ⚠ (mock — TodayHero props 가 실데이터 의존성 부재)
- **Reading Room 정합**: ✓ footer italic Lora 감성 적용 · TodayHero editorial 1곳 · Calm UI 정합 (KPI 그리드 제거 명시 코멘트)

### `/diagnostic` (`(main)/diagnostic/page.tsx`, RSC wrapper → client)

- **진입**: `page.tsx → Screen(full/bg2/padX=none) → DiagnosticClient`
- **정보구조**: 3-phase (start/question/results) · DiagnosticClient 내부 — 외부엔 wrapper 만
- **레이아웃**: `<Screen width="full" padX="none">` (몰입형) · 자체 Frame 없음
- **타이포**: DiagnosticClient 42 font-display 인용 (Lora 48px 단어 카드 코멘트 있으나 grep 미확인)
- **색/감성**: V-Level 배지 색 · type별 추천 카드
- **상태 디자인**: 3-phase 내부 분기 (start/question/results 자체가 상태)
- **데이터**: vrl_diagnostic_tests RPC + analyze_and_apply RPC 실데이터
- **Reading Room 정합**: ⚠ DiagnosticClient 의 font-display 42회 vs editorial 0회 — Reading Room 의 "단어 카드 = Lora editorial" 권장 미반영 가능

### `/library/books` (`(main)/library/books/page.tsx`, RSC, async)

- **진입**: `page.tsx (서버 fetch books + enrollment + curation) → Screen(wide/bg2/padX=md) → [header(Library icon + h1 + capsules), BooksExplorer(books)]`
- **정보구조**: ① 헤더 (Library 아이콘 8x8 bg-ios-orange + h1 + p2 + Capsule[도서/챕터/단어/내 학습])  → ② BooksExplorer(coverflow + filters)
- **레이아웃**: `<Screen width="wide" padX="md">` · header gap-3 · `font-editorial text-[44px]→[56px] font-[500]` h1 ✓
- **타이포**: ✓ **h1 font-editorial 56px Reading Room 정합** · p font-body 15px · Capsule (커스텀)
- **색/감성**: `bg-ios-orange` 아이콘 박스 (Apple Books 정합) · t1/t2 토큰
- **상태 디자인**: `totalBooks > 0` 조건부 Capsule 렌더 (empty 일부 처리) · BooksExplorer 자체 empty 처리
- **데이터**: 실데이터 (library_books + library_seed_catalog + texts user enrollment)
- **Reading Room 정합**: ✓ **best example** — editorial hero + Apple Books warm off-white 정합 + 슬림 헤더 (200px→40px 명시 코멘트)

### `/text` + `/text/[id]` (`(main)/text/page.tsx`, RSC wrapper / `/text/[id]/page.tsx`, client)

- **진입 (`/text`)**: `page.tsx → Screen(wide/bg2/padX=md) → TextHubContent` (client, 실데이터 페치 위임)
- **진입 (`/text/[id]`)**: `page.tsx (client) → [UnifiedHeader, ReadingUniverse, FloatingAudioPlayer, FloatingSparkle, InsightPanel, ChapterBottomNav, ExtractionPanel, SpellForge(modal), ShadowReadAlong]`
- **정보구조 (`/text/[id]`)**: layout 의 TextContentProvider → page 가 mock fallback (MOCK_TEXT/MOCK_PARAGRAPHS) + 실데이터 분기
- **레이아웃**: `/text` Screen wide ✓ · `/text/[id]` Screen 미사용 ❌ (자체 컨테이너) — 몰입형 reader 의도
- **타이포**: ReadingUniverse `font-display` 1회 / `font-english` 사용 (영어 본문 Lora) ✓
- **색/감성**: ReadingUniverse 의 "잉크" 본문 + tts highlight (FloatingSparkle) · UnifiedHeader 통합 chrome
- **상태 디자인**: layout.tsx 가 textId 못 찾으면 MOCK_TEXT fallback ⚠ (production 영향?)
- **데이터**: 혼합 — layout 실데이터 + page mock fallback + `MOCK_PARAGRAPHS` 90 줄 하드코딩 (개발 fallback)
- **Reading Room 정합**: ✓ `font-english` 영어 본문 Lora 적용 · ReadingUniverse 가 Reading Room 의 핵심 art direction · 다만 page.tsx 의 `MOCK_TEXT.coverGradient.from='#0F766E'` 하드코딩 hex ⚠

### `/wordvault` (`(main)/wordvault/page.tsx`, client)

- **진입**: `page.tsx (client) → GlassBar(header w/ SegmentControl 4 view) + main {hub|browse|study|review}`
- **정보구조**: 4 view (URL query param) — hub = `WordVaultHub` / browse = `[PageHeader, StatsGrid, CollectionsRow, ListenPanel, HideToggleBar, SearchRow, WordList]` / study = StudyMode / review = inline placeholder
- **레이아웃**: GlassBar + main bg2 · hub view = 자체 wrapper · 기타 view = `mx-auto max-w-[1200px] p-6`
- **타이포**: `font-display text-[15px]` h1 ⚠ (Reading Room hero 권장 = editorial) · `font-display text-[26px] font-extrabold` review h2 · `font-body` muted
- **색/감성**: review view 의 `bg-learn-mastered` (보라 gradient) · 🔁 이모지 (Reading Room 절제 위배) · `#7C3AED` 하드코딩 hover hex ⚠
- **상태 디자인**: review = placeholder (실 데이터 미연결) · browse `MOCK_WORDS` import ❌
- **데이터**: **`MOCK_WORDS` 통째 사용** (`useHubStats` 실데이터 hub 만 / 나머지 mock)
- **Reading Room 정합**: 🔴 **가장 큰 이탈** — MOCK_WORDS 의존 / 하드코딩 hex `#7C3AED` / 🔁 이모지 / Reading Room editorial 0 사용

---

## Tier B (대표 sampling)

| route | 진입 | 데이터 | Reading Room 정합 |
|---|---|---|---|
| `/settings` | Screen + 설정 폼 | 실 (preferences) | font-editorial 1회 사용 ✓ |
| `/text/new` | `page.tsx → TextInput/BookChapterInput` | mock 47 단어 sessionStorage 인계 ❌ | 추출 코어 미연결 (D2 정찰 확인) |
| `/text/[id]/echo` | EchoMatch Player | 실 (echo_sessions/attempts) | font-display 압도 (echo 12회) |
| `/library/books/[bookId]` | BookDetailClient (NetflixDetailSheet 변형) | 실 | NetflixDetailSheet 26 hex 하드코딩 ⚠ |
| `/library/vocab` | VocabSetCarousel/Matrix/Grid | mock-data 일부 import | font-editorial 1회 ✓ |
| `/library/scripts` | (similar to /text hub) | 실 | font-editorial 1회 ✓ |
| `/library/scripts/[bookId]` | scripts 상세 | 실 | (sample 미실시) |
| `/my` 3개 (`/my`, `/my/books`, `/my/words`, `/my/texts`, `/my/books/[bookId]`) | MyTabs + 자식 | 실 | MyTabs 2 font-display |
| `/wordvault/browse` | WordVaultBrowseClient | mock-data import ❌ | 4 hex 하드코딩 |
| `/diagnostic/history` | HistoryTimeline | 실 (snapshots) | font-editorial 1회 + font-display 7회 |
| `/flashcard` (hub) | FlashcardSession | mock import ⚠ | font-display 중심 |
| `/spellforge` | SpellForge | mock import ⚠ | SpellForge 6 font-display |
| `/wordblitz` | WordBlitz placeholder/hub | (sample 미실시) | (게임 스킨) |
| `/pairflip` | PairFlipHub | mock import ⚠ | PairFlip 8 font-display + 자체 logo/scorering |
| `/scriptquiz` | ScriptQuiz | mock import ⚠ | font-display 18회 (모듈 중 최대) |
| `/dictate` 4개 | DictationHubClient/Setup/Session/Results | (sample 미실시) | font-display 압도 |

---

## Tier C — 게임 스킨 정합 표

| 스킨 | 라우트 | 색계열 | 본문 정합 | 의도분리 vs 잔재 |
|---|---|---|---|---|
| WordBlitz 정글 | `(app)/play/wordblitz` + `(main)/wordblitz` | WordBlitzUI.css 5 font-display + 자체 hex | Reading Room 거리감 큼 (게임 몰입) | **의도분리** (게임 캔버스 컨텍스트) |
| Flashcard gradient | `(main)/flashcard/play` | RecallPhase/SRSBar/CardBack/CardFront/CompletionState | base Reading Room 보존 + 학습 효과 색 | **의도분리** (Memory Decay 4색 학습 정합) |
| SpellForge 파랑 | `(main)/spellforge/play` | SpellForge.tsx 6 font-display + ConfirmButton/MicroPause | Lora editorial 부재 | **부분 잔재** (Reading Room 정합 보강 여지) |
| PairFlip Editorial | `(main)/pairflip/play` + `/results` | PairFlipLogo/ScoreRing/Card/HUD/Feedback (12 컴포넌트) | font-display 압도 / 자체 logo | **부분 잔재** (의도된 게임 세계 vs Reading Room 거리) |
| Pirate Quest | `(app)/play/pirate-quest` | (별도 게임 스킨) | (sample 미실시) | **의도분리** |
| Dictation Session | `(main)/dictate/session` | DictationSessionClient 14 font-display | mock data import | **부분 잔재** |

**판정**: 게임 4 스킨 중 WordBlitz/Flashcard/PirateQuest 는 **의도분리** (게임 컨텍스트). SpellForge/PairFlip/Dictation 은 **잔재 + 일관 부족** — Reading Room 의 art direction 이 명확히 적용 안 됨.

---

## Tier D — 인증/마케팅

| route | 진입 | font | Reading Room |
|---|---|---|---|
| `(auth)/login` | login.tsx | 3 font-display | 표준 form (별 이탈 없음) |
| `(auth)/signup` | signup.tsx | 3 font-display | 동일 |
| `(auth)/reset-password` | page | 5 font-display | 동일 |
| `(auth)/verify-email` | page | 4 font-display + font-editorial 0 | **이탈** — 인증도 verify 안내문 = "사람의 말투" 적용 안 됨 |
| `(marketing)/about` | (sample 미실시) | — | — |
| `(marketing)/pricing` | LegalPage 3 font-display | (sample 미실시) | — |
| `(marketing)/privacy` | LegalPage 3 font-display | 동일 | — |
| `(marketing)/terms` | LegalPage 3 font-display | 동일 | — |
| 랜딩 `/` | page.tsx 7 font-display | dev 진입 + GROUPS 인덱스 (dev 용) | dev 페이지 (production 랜딩 별도) |

---

## 횡단 발견 (X1~X6)

### X1 — 하드코딩 hex 잔존

```
grep -rn "#[0-9A-Fa-f]{6}" apps/web/src
→ 50+ 파일 (head_limit 50, 더 많음)
```

**핵심 이탈 사례**:
- `apps/web/src/app/(main)/wordvault/page.tsx:277` — `bg-[#7C3AED]` (review CTA hover)
- `apps/web/src/app/(main)/text/[id]/page.tsx:60` — `coverGradient: { from: '#0F766E', to: '#064E3B' }` (MOCK_TEXT)
- `apps/web/src/components/library/shared/NetflixDetailSheet.tsx` — **26 hex 하드코딩** (가장 심각)
- `apps/web/src/components/admin/curation/BookDetailModal.tsx` — 12 hex
- `apps/web/src/app/admin/articles/BulkArticlesTab.tsx` — 23 hex
- `apps/web/src/app/admin/curation/preview/[bookId]/AdminReviewClient.tsx` — 6 hex

**합계**: 250+ 파일에 hex 잔존 (게임 영역 일부 의도분리 포함). admin 영역이 가장 많음 — 운영 콘솔 감성 재검토 외이지만 Reading Room 일관성 위배.

### X2 — v5 롱폼 토큰 잔재

```
grep -rn "var(--color-" apps/web/src
→ 0 매칭 ✓
```

**판정**: v5 `--color-primary` 등 롱폼 완전 폐기 확인. v6 축약형 (`--p`, `--bg`, `--t1` 등) 만 사용. ✅

### X3 — `<Screen>` 프리미티브 미사용

```
grep -rL "<Screen" apps/web/src/app/(main)/**/page.tsx
```

`(main)` 그룹의 page.tsx 들 중 `<Screen>` 미사용:
- `/text/[id]/page.tsx` ❌ (자체 컨테이너, 몰입형 reader 의도)
- `/wordvault/page.tsx` ❌ (GlassBar 직접 사용, view별 wrapper 분기)
- `(main)/pairflip/play/page.tsx`, `(main)/spellforge/play/page.tsx`, `(main)/scriptquiz/play/page.tsx`, `(main)/dictate/session/page.tsx` (게임/세션, 의도분리 가능)
- `(main)/flashcard/play/page.tsx` (동일)
- `(app)/play/wordblitz/page.tsx`, `(app)/play/pirate-quest/page.tsx` (별도 그룹)

**판정**: `<Screen>` 미사용 9 화면 중 5-7개는 의도분리 (게임/몰입). `/wordvault` 만 명확한 정합 보강 대상.

### X4 — mock 데이터 화면 목록

```
grep "MOCK_|mock-data|mockData|MOCK_WORDS|MOCK_TEXT" apps/web/src
→ 11 파일
```

**mock 의존 화면**:
1. `(main)/wordvault/page.tsx` — `MOCK_WORDS` import (browse view 전체) 🔴
2. `(main)/wordvault/hub/WordVaultHub.tsx` — mock 일부
3. `(main)/text/[id]/page.tsx` — `MOCK_TEXT` + `MOCK_PARAGRAPHS` fallback (layout 실데이터 우선)
4. `(main)/text/new` 경로 - sessionStorage 47 단어 mock (D2 정찰)
5. `(main)/flashcard/play/page.tsx` — FlashcardSession mock
6. `(main)/spellforge/play/page.tsx` — SpellForge mock
7. `(main)/spellforge/SpellForge.tsx`
8. `(main)/pairflip/PairFlipHub.tsx`
9. `game/scriptquiz/ScriptQuiz.tsx`
10. `dictation/DictationResultsClient.tsx`
11. `wordvault/CollectionsRow.tsx`

**판정**: `/wordvault` browse + 4개 학습 모듈이 mock — 사용자 진도 데이터 미연결. Phase 3 Zustand 전환 미완료 (apps/web/CLAUDE.md 명시 mock Phase 2).

### X5 — 상태 디자인 누락

`page.tsx` 자체엔 empty/loading/error 명시 처리 거의 없음 — `loading.tsx`/`error.tsx`/`not-found.tsx` 가 `src/app/` 직속에 존재 (apps/web/CLAUDE.md 명시). 자식 컴포넌트별 처리 위임.

**명시적 상태 누락 화면**:
- `/wordvault` review view = inline placeholder (FSRS 미연결 표시 없이 "12개 복습" 하드코딩) 🔴
- `/text/new` analyze 결과 = mock 47 단어 (실 분석 부재 상태 표시 0) 🔴
- `/diagnostic` interim phase = DiagnosticClient 내부 처리 (외부 처리 0)

### X6 — 게임 4 스킨 정합 판정

위 Tier C 표 참조:
- **의도분리 확정**: WordBlitz / Flashcard / PirateQuest (게임 컨텍스트 명시)
- **부분 잔재**: SpellForge / PairFlip / Dictation (Reading Room 의도 모호, font-display 압도, mock 의존)

---

## font-display vs font-editorial 사용 비율

| 토큰 | 발생 횟수 | 비율 |
|---|---:|---:|
| `font-display` | **1,029** (250+ 파일) | 99.1% |
| `font-editorial` | **9** (8 파일) | 0.9% |

**판정**: 🔴 **Reading Room v06.39 "Lora editorial 승격" 권장 거의 미적용**. editorial 사용 = `/library/books`, `/library/scripts`, `/library/vocab`, `/settings`, `/diagnostic/history`, `home/HubHero` (2회), `dashboard/TodayHero`, `wordvault/hub/VaultIdentity` 만. **전 화면의 hero/단어카드 가 font-display Plus Jakarta 로 렌더 = Reading Room 잉크/페이퍼/금 시각언어 약함**.

---

## 한 줄 총평 — Reading Room 일관성 체감

> **`/library/books` 가 표본 (editorial 56px + Apple Books warm + 슬림 헤더 + 캡슐). 나머지 화면 95% 가 v06.38 이전 font-display 상태 + WordVault 의 MOCK_WORDS + 하드코딩 hex (NetflixDetailSheet 26곳 / BulkArticlesTab 23곳 / wordvault `#7C3AED`) 가 Reading Room 일관성 가장 큰 균열. 게임 4 스킨 중 WordBlitz/Flashcard/PirateQuest 는 의도분리 OK, SpellForge/PairFlip/Dictation 은 잔재.**

**우선 개선 권장 (Tier A 화면 한정)**:
1. 🔴 **`/wordvault`** — MOCK_WORDS 실데이터 전환 + `#7C3AED` 토큰화 + hero font-editorial 승격
2. 🟡 **`/diagnostic`** — DiagnosticClient 단어 카드 = Lora editorial 적용 확인
3. 🟡 **`/hub`** — HubHero `font-display` → `font-editorial` 승격
4. 🟡 **`/text/[id]`** — MOCK_TEXT/MOCK_PARAGRAPHS 의존성 정리 + cover hex 토큰화
5. ⚪ `/dashboard` — 비교적 정합 ✓ · TodayHero `todayWords=23 goal=30` 실데이터 연결만
6. ✅ `/library/books` — 표본 유지

---

## ABORT 보고

없음. 모든 단계 read-only 완료. 컴포넌트/페이지 코드 수정 0, 산출 .md 외 파일 생성 0.

---

*감사 일자: 2026-06-21*
*SSoT 참조: `docs/DESIGN_SYSTEM.md` v06.39→v06.40 Reading Room · `docs/MODULES.md` · `docs/ROUTES.md`*
