# CCP × Library — 만화의 학습자 카탈로그 편입 설계

> book→comic 파이프라인(CCP)이 만든 만화를 `/library` 에서 **학습자가 스스로 고르는 정식 학습 포맷**으로 편입하는 설계.
> 도서 · 스크립트 · 단어장 3종 체계와 같은 규칙(발행 게이트 → 카탈로그 → 등록 → 진도)으로 관리·제시한다.
>
> 작성 2026-08-08 · 근거: 코드 실측(`apps/web/src` 그렙/리드) + 마이그레이션 6종 + 학술·시장 딥서치.
> 관련: [scripts/comic/docs/COMIC_PIPELINE_DESIGN.md](../scripts/comic/docs/COMIC_PIPELINE_DESIGN.md) · [LIBRARY_PIPELINE.md](./LIBRARY_PIPELINE.md) · [LEARNING_MODEL.md](./LEARNING_MODEL.md) · [ROUTES.md](./ROUTES.md)

---

## 0. 요약 (TL;DR)

| 질문 | 판정 |
|---|---|
| 만화는 "새 장르"인가? | **아니다 — 같은 책(Work)의 또 다른 표현형(Expression)**. 데이터는 도서에 앵커, **탐색 UI 에서만 장르처럼 독립 코너로 제시**한다. |
| 그럼 왜 메뉴를 따로 두나? | 학습자의 멘탈 모델(=무엇을 할지 고르는 입구)과 데이터 축(=무엇에 속하는지)은 다른 축이기 때문. 메뉴는 **입구**, 데이터는 **포맷 facet**. (2026-08-09: `/library` 탭 → 최상위 `Comics` 메뉴, 안에서 Adapted/Restored 로 분기) |
| 지금 무엇이 빠졌나? | ① 만화 전용 진입점 없음(히어로 4장뿐, 알파벳순) ② 필터·검색으로 만화를 찾을 수 없음 ③ **미등록 학습자는 만화를 볼 수 없음**(라우트가 `texts.id` 요구) ④ 만화 ↔ 단어장 연결 미배선 ⑤ 진도가 대시보드/모듈 체계에 미반영 |
| 교육학 리스크는? | 그림 의존 → 본문 회피(seductive details). **만화는 스캐폴드이지 대체재가 아니다**를 코드 계약으로 강제(§6). |
| 산출 | 만화 단일 메뉴(Adapted·Restored) + 포맷 facet + 도서 단위 만화 라우트 + 단어장 정합 게이트. P0~P3 로드맵(§13). |

---

## 1. 현행 실측 (코드 근거)

### 1.1 이미 있는 것 — 파이프라인·리더는 성숙함

| 층 | 자산 | 위치 |
|---|---|---|
| 저장 | `comic_books`(발행 게이트 헤더 + `qc_verdict` + `panels_pass`) · `comic_pages`(자연키 `book/chapter/page_order`, `bubbles jsonb`, `target_vocab text[]`) | [20260808120000_comic_pipeline.sql](../supabase/migrations/20260808120000_comic_pipeline.sql) |
| 진도 | `comic_read_progress`(user-owns RLS) + `save_comic_progress` | [20260808160000_comic_read_progress.sql](../supabase/migrations/20260808160000_comic_read_progress.sql) |
| 관측 | `comic_gen_runs` · `comic_panel_events` · `comic_gen_tests` · `comic_gen_models` | 180000 / 200000 / 220000 |
| 학습자 RPC | `select_book_comic` · `select_book_comic_all` · `list_book_comic_catalog` · `book_comic_available` — **전부 published 이중 게이트** | 120000 / 140000 |
| 리더 | `ComicReader` — 페이지/세로스크롤(웹툰형) 전환 · verbatim 버블 blur→tap-reveal · 회상 마킹 · vocab 칩→WordVault 추가 · dim · stave 레일 · 진도 저장 | [ComicReader.tsx](../apps/web/src/components/comic/ComicReader.tsx) |
| 진입 | 워크스페이스 ModePills `만화`(input 그룹, gold underline) → `/text/[id]/comic` | [ModePills.tsx:109](../apps/web/src/components/workspace/ModePills.tsx#L109) |
| 발견 | `/library/books` 상단 `ComicHeroCard` | [library/books/page.tsx:227-269](../apps/web/src/app/(main)/library/books/page.tsx#L227-L269) |

### 1.2 빠진 것 — 카탈로그 편입은 아직 아님 (본 설계의 대상)

| # | 결함 | 실측 근거 | 영향 |
|---|---|---|---|
| G1 | **만화 전용 진입점 부재.** `LibraryTabs` 는 도서/스크립트/공용 단어장 3탭 | [LibraryTabs.tsx:13-17](../apps/web/src/components/library/LibraryTabs.tsx#L13-L17) | 만화는 도서 페이지 스크롤 상단 한 덩어리로만 존재 → 재방문 경로 없음 |
| G2 | **탐색 불가.** `BookFilterBar` facet 은 V밴드/장르/주제/연령/길이/오디오뿐, 만화 없음 | [BooksExplorer.tsx:120-154](../apps/web/src/components/library/browse/BooksExplorer.tsx#L120-L154) | "만화 되는 책만 보기" 불가. 검색어로도 못 찾음 |
| G3 | **미등록 학습자 차단.** 리더 라우트가 `/text/[textId]/comic` → `texts` 행(=enroll) 필요. 히어로도 미등록이면 도서 상세로 우회 | [comic/page.tsx:53-75](../apps/web/src/app/(main)/text/[id]/comic/page.tsx#L53-L75) · [books/page.tsx:252-255](../apps/web/src/app/(main)/library/books/page.tsx#L252-L255) | **가장 강력한 유입 자산을 유입 전에 못 보여준다**(전환 손실) |
| G4 | **노출이 큐레이션이 아님.** `list_book_comic_catalog` 는 `ORDER BY b.title`, 페이지는 `slice(0,4)` | [migration:165](../supabase/migrations/20260808120000_comic_pipeline.sql#L165) | 알파벳 앞 4권 고정. 신작/적합도/이어보기 반영 0 |
| G5 | **커버 로드 과다.** 히어로 4권 각각 `select_book_comic_all`(전권 컷 전량)을 호출해 첫 컷 URL 1개만 사용 | [books/page.tsx:241-250](../apps/web/src/app/(main)/library/books/page.tsx#L241-L250) | 목록 렌더에 전권 payload ×4. 도서 수 증가 시 악화 |
| G6 | **배지 없음.** `BookGridCard`/`NetflixDetailSheet`/rails 에 만화 표식 없음(코드 그렙상 comic 참조 0) | 그렙: comic 참조 파일 16개 중 해당 없음 | 도서 탐색 중 "이 책은 만화도 있어요"를 알 수 없음 |
| G7 | **단어장 미연계.** `comic_pages.target_vocab` 은 리더 칩으로만 소비. 챕터 단어장(`shared_word_sets.category='library_book'`)과의 정합 검증 없음 | 스키마 + [vocab/page.tsx](../apps/web/src/app/(main)/library/vocab/page.tsx) | 만화에서 만난 단어가 단어장 체계로 승계되지 않음(고아 위험) |
| G8 | **진도 이원화.** `comic_read_progress` 는 있으나 `module_history`/대시보드/도서 카드 진행률에 미반영 | [books/page.tsx:184-205](../apps/web/src/app/(main)/library/books/page.tsx#L184-L205) 는 `texts.status` 만 사용 | "만화 3/5 보는 중"이 어디에도 안 보임 |

---

## 2. 딥서치 — 판단 근거

### 2.1 정보구조: 포맷은 장르가 아니라 "표현형"이다 (도서관학 FRBR)

FRBR/RDA 는 자료를 **Work → Expression → Manifestation → Item** 4층으로 본다. 번역·오디오북·전자책은 같은 Work 의 **다른 Expression/Manifestation** 이며, 성숙한 discovery layer 는 이를 하나의 Work 카드 아래 "이용 가능한 형식" 으로 묶는다(FRBRization). 만화(각색+삽화)는 원문 텍스트의 각색이므로 **같은 Work 의 새 Expression** 이다.

→ **결론**: `comic_books.library_book_id` 를 PK 로 둔 현행 스키마가 정답이다. 만화를 `library_books` 와 나란한 별도 콘텐츠 테이블로 승격하면 제목/저자/V레벨/저작권 판정이 이중화되어 드리프트가 난다. 반대로 `GenreBucket` 9번째 값으로 넣는 것도 오답 — 한 책은 *추리이면서 동시에 만화* 이므로 장르 축을 오염시키고 교차 필터가 불가능해진다.

### 2.2 제품 선례: 같은 책, 형식 전환 (Kindle ↔ Audible Whispersync)

Whispersync for Voice 는 같은 책의 읽기/듣기 사이를 **위치를 잃지 않고** 전환시킨다. UI 는 별도 상품이 아니라 **책 안의 전환 버튼 + "가장 멀리 읽은 위치로 동기화"** 프롬프트다.

→ **결론**: 만화는 도서 상세/워크스페이스 안에서 **형식 전환**으로 제시하되(ModePills 가 이미 그 형태), 발견 단계에서는 별도 코너가 필요하다. 전환 시 **위치 연속성**(만화 컷 ↔ 챕터)이 품질의 핵심.

### 2.3 교육학 (+): 만화는 EFL 독해·어휘에 유효

그래픽 노블/코믹의 ESL·EFL 활용 연구는 ① 읽기 동기 ② 시각 단서에 의한 어려운 어휘의 이해·유지 ③ 관용표현 학습에서 전통 연습 대비 우위 ④ 다독(ER)의 어휘·이해 이득을 보고한다. 이는 Vocaflow 7원칙의 **Dual Coding(Paivio)** · **Context-Dependent** · **Emotional Encoding** 과 직결된다.

### 2.4 교육학 (−): 그림은 본문 처리를 밀어낼 수 있다 (seductive details)

Harp & Mayer 계열 연구는 흥미롭지만 본질과 무관한 시각 요소가 **본문 문장에 쓰는 읽기 시간을 줄이고** 회상·전이를 떨어뜨림을 반복 보고한다(Rey 2012 메타분석: 회상 small~medium, 전이 medium 부적 효과). 장식적 이미지가 인지부하를 올린다는 EEG·시선추적 연구도 있다.

→ **결론(설계 제약)**: 만화 컷은 **장식이 아니라 본문 명제와 1:1 대응**해야 하고(=verbatim 버블·정본 vocab 계약이 이미 그 장치), 학습 회계상 **만화 완주는 챕터 완료로 인정하지 않는다**(§6).

### 2.5 리더 UX: 세로 스크롤(웹툰)은 모바일 기본값

웹툰형 세로 스크롤은 엄지 스크롤에 최적화되어 제스처→진행 매핑이 직접적이고 진행 피드백이 즉시적이다. 패널 간격이 곧 pacing 이며(연속 동작 400~800px, 장면 전환은 더 큰 여백), 텍스트는 확대 없이 읽혀야 한다.

→ `ComicReader` 의 `view: 'page' | 'scroll'` 이 이미 존재. **모바일 기본을 scroll 로** 두는 것이 정합(§8.4).

---

## 3. 설계 결정 (D1–D6)

| # | 결정 | 근거 | 기각한 대안 |
|---|---|---|---|
| **D1** | 만화 = **도서의 포맷(Expression)**. 데이터는 `library_books` 앵커 유지, 콘텐츠 복제 금지 | §2.1 FRBR | 별도 `comic_catalog` 테이블(메타 이중화·드리프트) |
| **D2** | 발견 UI 는 **독립 코너**로 — **사이드바 최상위 메뉴 `/comics`** (2026-08-09 사용자 결정으로 `/library` 4번째 탭에서 승격) | 사용자 요구("또 다른 장르로 제시" → "별도 메뉴로") + G1/G4. 메뉴=입구 축, facet=데이터 축으로 분리하면 둘 다 만족 | `/library` 4번째 탭(사용자 기각) / 히어로 확장만(재방문 경로 없음) / GenreBucket 추가(축 오염, D1 위배) |
| **D3** | 동시에 도서 축에 **포맷 facet(`만화`·`오디오`·`퀴즈`)** 추가 — 교차 필터 가능 | G2·G6. "SF이면서 만화" 질의 성립 | 만화 탭만 두고 도서 탐색은 방치(같은 책이 두 세계로 갈라짐) |
| **D4** | **도서 단위 만화 라우트 `/comics/adapted/[bookId]`** 신설 — 미등록·미로그인도 프리뷰 N컷 열람, "이어서 보기"는 자동 enroll 후 `/text/[id]/comic` | G3. 유입 자산은 유입 전에 보여야 함 | 현행(등록 후에만 열람) |
| **D5** | 선택은 **처방(prescription)** 으로 제시 — i+1 판정·진도에 따라 "지금 당신에겐 이 입구" 1개를 권장하고 나머지는 동등 노출 | Progressive Disclosure + Cognitive Load(4항목) | 3형식 동급 나열(선택 피로) / 자동 강제 이동(주체성 박탈) |
| **D6** | 만화 진도는 **별도 회계**. 챕터 `completed` 판정에 미포함, 대시보드엔 "미리 본 이야기"로 표기 | §2.4 seductive details | 만화 완주=챕터 완료(본문 회피 유도, 학습 손실) |

---

## 4. 정보 구조 (IA)

### 4.1 메뉴 구조 — 만화는 `/library` 밖의 최상위 메뉴 (2026-08-09 개정)

```
사이드바 Scripts 그룹
├── Library   /library   ├── /books    도서       장편 원서 (Work 원본)
│                        ├── /scripts  스크립트   ACP 짧은 글
│                        └── /vocab    공용 단어장 어휘 세트          ← 3탭 유지
├── Comics    /comics    만화 단일 메뉴 (→ /comics/adapted 리다이렉트) ← D2
│             ├── Adapted  /comics/adapted   도서 각색 (CCP)
│             │            └── /[bookId]     만화 상세(프리뷰+포맷 선택)
│             └── Restored /comics/restored  원본 복원 (PDCP)
│                          └── /[slug]       복원 만화 리더
└── My Scripts /text
```

**만화 메뉴는 하나, 안에서 출처로 나눈다** (2026-08-09 사용자 결정). 학습자에겐 둘 다 "만화"라 입구를 쪼개면
어느 쪽을 눌러야 할지 알 수 없다. 대신 안에서 원작에 무슨 일이 있었는지로 구분한다:

| 탭 | 한국어 | 무엇인가 | 원작 | 파이프라인 |
|---|---|---|---|---|
| **Adapted** | 도서 각색 | 우리가 가진 원서를 모델로 각색해 그린 만화 | 원서 텍스트(정본) | CCP |
| **Restored** | 원본 복원 | 저작권 만료 만화 원본을 수집·디지털 복원 | 만화 자체 | PDCP |

명명 근거 — **기술이 아니라 원작에 일어난 일**로 지었다. "AI Comics"는 기술이 바뀌면 낡고, 학습자에게
품질 신호도 주지 못하며, 각색의 정본 정합(R4)이라는 이 만화의 핵심 가치를 가린다. 과거분사 쌍
(Adapted/Restored)은 문법적으로 대칭이라 탭으로 나란히 놓기 좋다.
검토한 대안: `Booktoon`(친근하나 CCP 전용이라 쌍이 안 맞음) · `Generated`(기술 노출) · `Classics`(복원 쪽이
고전이 아닐 수 있음) · `Reimagined`(각색보다 과장).

처음 설계는 `/library` 4번째 탭이었으나 사용자 결정으로 **최상위 메뉴로 승격**했다. 데이터 축(D1)은 그대로 —
만화는 여전히 `library_books` 앵커이고, 도서 카드의 만화 배지·포맷 필터·상세 시트 CTA 는 `/library` 에 남는다.
즉 **입구만 밖으로 나오고, 진실은 여전히 포맷 facet 하나**다.

메뉴 설명: `만화 — 도서를 그림으로 먼저 만나는 입구`.
아이콘 `BookImage`(리더/히어로와 동일), 액센트는 gold `var(--active)`.

⚠️ **경로에 `book/` 이 낀 이유**: 같은 레벨에 PDCP 의 `/comics/[slug]`(복원 만화 리더)가 있어
`[bookId]`/`[slug]` 형제 동적 세그먼트 충돌로 Next.js 빌드가 깨진다. `book/` 정적 세그먼트로 분리.

### 4.2 축 정의 (혼동 차단)

| 축 | 값 | 저장 | 용도 |
|---|---|---|---|
| **종류(kind)** | book · article · word_set | 테이블 자체 | `/library` 탭(도서/스크립트/단어장) |
| **포맷(format)** | text · audio · comic · quiz | 파생(`librivox_audio` / `comic_books` / `library_chapter_quiz`) | facet 칩 · 카드 배지 · 형식 전환 |
| **장르(genre)** | 8버킷 | `curation_meta.genre_norm` → `bucketOf()` | 취향 필터 |
| **레벨(V-Level)** | V1–V11 → 5밴드 | `book_v_level` | i+1 처방 |

`만화` 메뉴는 **kind=book ∧ format∋comic** 의 저장된 뷰(saved view)로 정의된다. 즉 메뉴는 UI 편의이고, 진실은 facet 하나다 — 이것이 D1·D2 를 동시에 만족시키는 장치다(메뉴가 탭이든 최상위든 데이터 축은 불변).

### 4.3 통합 카탈로그 계약 (도서·스크립트·단어장 정합)

3종 콘텐츠의 **발행 게이트가 제각각**이라 페이지마다 조건이 흩어져 있다(실측):

| 종류 | 현행 발행 조건 | 위치 |
|---|---|---|
| 도서 | `status='published' AND copyright_safe_in_kr AND published_at IS NOT NULL` | books/page.tsx:60-70 |
| 스크립트 | `status='published' AND copyright_safe_in_kr` | scripts/page.tsx:26-32 |
| 단어장 | `is_published` | lib/library/vocab/queries |
| 만화 | `comic_books.status='published' AND library_books.status='published'`(+ 발행 시 `panels_pass` 강제) | RPC 내부 |

→ **`v_library_catalog` 뷰**로 단일화(§7.3). 한 곳만 고치면 4종의 노출 규칙이 함께 움직이고, `/library` 루트를 "오늘 무엇을 할까" 통합 홈으로 승격할 때(P3) 그대로 재사용된다.

---

## 5. 학습자 여정 — 선택 아키텍처

### 5.1 진입 지점 5개

| 지점 | 화면 | 동작 |
|---|---|---|
| ① 만화 메뉴 | `/comics/adapted` (Comics 메뉴 · Adapted 탭) | 카탈로그 그리드 + 이어서 보기 레인 + 레벨 필터 |
| ② 도서 탐색 중 | `BookGridCard` / rails / 상세 시트 | `만화` 배지 → 탭하면 형식 선택 |
| ③ 만화 상세 | `/comics/adapted/[bookId]` | 프리뷰 3컷(무료·미등록 허용) + 형식 선택 3종 |
| ④ 워크스페이스 | ModePills `만화` | 챕터 위치 유지한 채 전환 (기존) |
| ⑤ 도서 히어로 | `/library/books` 상단 | 유지하되 큐레이션 정렬로 교체(G4) |

### 5.2 형식 선택 컴포넌트 (`ComicFormatChoice`)

한 화면에 3개 카드, **권장 1개만 gold 테두리 + "지금 추천"**:

```
┌─ 만화로 먼저          ┐  ┌─ 원문으로 읽기      ┐  ┌─ 들으며 읽기        ┐
│ 42컷 · 약 8분          │  │ 5챕터 · 약 62분      │  │ LibriVox 낭독        │
│ 그림으로 줄거리를      │  │ 정본 텍스트로        │  │ 귀와 눈을 함께       │
│ 먼저 잡아요            │  │ 정독해요             │  │                      │
└────────────────────────┘  └──────────────────────┘  └──────────────────────┘
```

### 5.3 처방 규칙 (기존 `judgeIPlusOne` 재사용 — 새 엔진 만들지 않음)

| 학습자 상태 | 권장 | 문구(Empathetic Feedback) |
|---|---|---|
| 미진단 | 만화 | "레벨 진단 전이라면, 그림으로 가볍게 시작해도 좋아요" |
| `tier='hard'` (coverage 낮음) | 만화 | "이 책은 지금 조금 어려워요. 그림으로 이야기를 먼저 잡으면 본문이 쉬워져요" |
| `tier='ideal'` | 원문 | "지금 딱 맞는 난이도예요. 본문으로 바로 시작해볼까요?" (만화는 "막히면 여기서" 보조 표기) |
| `tier='easy'` | 원문 + 듣기 | "쉬운 편이에요. 들으며 읽으면 속도가 붙어요" |
| 챕터 완독 이력 있음 | 만화 | "읽은 이야기를 그림으로 되짚으면 기억이 오래 가요" (복습 프레이밍) |
| 만화 진행 중(`comic_read_progress`) | 이어서 보기 | "3/5 스테이브까지 보셨어요" |

### 5.4 미등록 → 등록 전환 (D4 상세)

```
비로그인 ──▶ /library/comics/[id] 프리뷰 3컷 ──▶ "이어서 보려면 로그인" ──▶ 로그인 후 복귀
로그인·미등록 ─▶ 프리뷰 3컷 ─▶ "이어서 보기" ─▶ enroll_library_book(멱등) ─▶ /text/[ch1]/comic
로그인·등록 ──▶ 바로 /text/[resume]/comic (컷 위치 복원: comic_read_progress)
```

프리뷰 컷 수 = 3(스포일러/비용 방어). 프리뷰 전용 RPC 로 **published 게이트 유지한 채 anon 허용**(§7.2) — `anon` 에 전권 RPC 를 열지 않는다.

---

## 6. 교육학 가드레일 (코드 계약)

§2.4 의 리스크를 문구가 아니라 **강제 규칙**으로 못 박는다.

| # | 규칙 | 구현 지점 |
|---|---|---|
| R1 | 만화 완주는 챕터 `texts.status='completed'` 를 만들지 않는다 | `save_comic_progress` 는 `comic_read_progress` 만 갱신 — **현행 유지 · 문서화** |
| R2 | 진행률 표시는 "만화 3/5 미리 봄"으로 **본문 진도와 분리 표기** | 도서 카드/대시보드 |
| R3 | 정본 버블은 blur→tap-reveal 기본(회상 유도, Desirable Difficulty) | `ComicReader` 현행 유지 |
| R4 | `target_vocab` 은 `verbatim=true` 버블에서만 — 각색 대사 단어 금지 | 파이프라인 계약 + **발행 시 검증 추가(§7.4)** |
| R5 | 만화 마지막 컷 = 본문/퀴즈 유입 CTA (폭죽·트로피 금지) | `ComicReader` 현행 + 문구 강화 |
| R6 | 만화 단독 세션이 임계(예: 2회) 넘게 본문 없이 반복되면, 다음 진입 시 권장을 **원문으로 전환** | P3 · `comic_read_progress` + `texts.status` 조합 |

---

## 7. 데이터 · 계약 설계

> 모든 SQL 은 **초안**. CLAUDE.md 정책상 자동 적용 금지 — 승인 후 `apply_migration`.

### 7.1 `list_comic_catalog()` — 히어로/탭 공용 카탈로그 (G4·G5 해소)

첫 컷 커버를 **RPC 안에서** 뽑아 전권 payload 왕복을 없앤다. 정렬은 큐레이션 신호(최신 발행 → 컷 수) 기준.

```sql
CREATE OR REPLACE FUNCTION public.list_comic_catalog()
RETURNS TABLE(
  library_book_id uuid, title text, author text, book_v_level smallint,
  panels_total int, chapters_total int, cover_url text,
  genre_norm text, lexical_coverage numeric, published_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.id, b.title, b.author, cb.book_v_level, cb.panels_total,
         (SELECT count(DISTINCT p.chapter_idx)::int FROM comic_pages p WHERE p.library_book_id = b.id),
         (SELECT p.image_url FROM comic_pages p
            WHERE p.library_book_id = b.id
            ORDER BY p.chapter_idx, p.page_order LIMIT 1),
         b.curation_metadata->>'genre_norm', b.lexical_coverage, cb.published_at
  FROM comic_books cb
  JOIN library_books b ON b.id = cb.library_book_id AND b.status = 'published'
  WHERE cb.status = 'published'
  ORDER BY cb.published_at DESC NULLS LAST, cb.panels_total DESC;
$$;
GRANT EXECUTE ON FUNCTION public.list_comic_catalog() TO authenticated, anon;
```

### 7.2 `preview_book_comic(p_book_id uuid, p_limit int)` — 미등록 프리뷰 (D4)

```sql
CREATE OR REPLACE FUNCTION public.preview_book_comic(p_book_id uuid, p_limit int DEFAULT 3)
RETURNS TABLE(page_order int, chapter_idx int, image_url text, bubbles jsonb, stave_label text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.page_order, p.chapter_idx, p.image_url, p.bubbles, p.stave_label
  FROM comic_pages p
  JOIN comic_books cb ON cb.library_book_id = p.library_book_id AND cb.status = 'published'
  JOIN library_books b ON b.id = p.library_book_id AND b.status = 'published'
  WHERE p.library_book_id = p_book_id
  ORDER BY p.chapter_idx, p.page_order
  LIMIT greatest(1, least(coalesce(p_limit, 3), 5));
$$;
GRANT EXECUTE ON FUNCTION public.preview_book_comic(uuid, int) TO authenticated, anon;
```

`target_vocab` 미노출(프리뷰는 감정 유입 전용) · 상한 5 하드캡.

### 7.3 `v_library_catalog` — 4종 통합 카탈로그 뷰 (§4.3)

```sql
CREATE OR REPLACE VIEW v_library_catalog AS
  SELECT 'book'::text AS kind, b.id, b.title, b.author, b.book_v_level AS v_level,
         b.reading_minutes, b.published_at,
         ARRAY_REMOVE(ARRAY[
           'text',
           CASE WHEN b.librivox_audio IS NOT NULL THEN 'audio' END,
           CASE WHEN EXISTS (SELECT 1 FROM comic_books c
                             WHERE c.library_book_id = b.id AND c.status='published') THEN 'comic' END,
           CASE WHEN EXISTS (SELECT 1 FROM library_chapter_quiz q
                             WHERE q.library_book_id = b.id) THEN 'quiz' END
         ], NULL) AS formats
  FROM library_books b
  WHERE b.status='published' AND b.copyright_safe_in_kr AND b.published_at IS NOT NULL
UNION ALL
  SELECT 'article', a.id, a.title, a.author, a.article_v_level, a.reading_minutes, a.published_at,
         ARRAY_REMOVE(ARRAY['text', CASE WHEN a.audio_url IS NOT NULL THEN 'audio' END], NULL)
  FROM library_articles a
  WHERE a.status='published' AND a.copyright_safe_in_kr;
```

- 단어장(`shared_word_sets`)은 카드 형태·필터 축이 달라 **뷰에 합치지 않고** 별도 유지(과잉 일반화 회피). 통합 홈(P3)에서 레인 단위로만 합류.
- `formats` 배열이 **facet(D3)의 단일 진실**이 된다. `library_chapter_quiz` 는 v06.114 챕터 퀴즈 테이블(앱 8개 파일에서 사용 중).

### 7.4 발행 시 단어장 정합 검증 (G7 · R4)

`admin_set_comic_published` 에 경고 산출을 추가한다(차단이 아니라 **판정 기록**):

```sql
-- qc_verdict.vocab_orphans[] 로 기록: 챕터 단어장에 없는 target_vocab
WITH tv AS (
  SELECT DISTINCT unnest(p.target_vocab) AS w
  FROM comic_pages p WHERE p.library_book_id = p_book_id
)
SELECT array_agg(tv.w) FROM tv
WHERE NOT EXISTS (
  SELECT 1 FROM shared_word_sets s
  JOIN shared_words sw ON sw.set_id = s.id
  WHERE s.category = 'library_book'
    AND s.curation_query->>'book_id' = p_book_id::text
    AND (lower(sw.word) = lower(tv.w) OR lower(sw.lemma) = lower(tv.w))
);
```

세트 아이템 테이블은 `shared_words(set_id, word, lemma, chapter, sort_order)` — [scoped-words.ts:101-105](../apps/web/src/lib/workspace/scoped-words.ts#L101-L105) 기준. 표제어 변형을 감안해 `word`/`lemma` 양쪽으로 대조한다.
→ Admin 리뷰 화면에 "단어장 미등록 단어 N개" 로 표시. 0 이 목표(정본 정합).

### 7.5 진도·배지 배치 조회 (G6·G8)

- `list_comic_available_book_ids()` → `uuid[]` 1회 호출로 도서 그리드 전체 배지 처리(N+1 금지).
- `/library/comics` 는 `comic_read_progress` 를 `user_id = auth.uid()` 로 1회 select 하여 레인 구성.

---

## 8. 화면 · 컴포넌트 명세

### 8.1 신규 파일

| 파일 | 역할 |
|---|---|
| `apps/web/src/app/(main)/library/comics/page.tsx` | RSC — `list_comic_catalog()` + 진도 + V레벨 fetch → `ComicsBrowser` |
| `apps/web/src/app/(main)/library/comics/[bookId]/page.tsx` | RSC — `preview_book_comic()` + 도서 메타 → 프리뷰 + `ComicFormatChoice` (미로그인 허용) |
| `apps/web/src/components/library/browse/ComicsBrowser.tsx` | 클라 — 레인 3종 + 필터(V밴드/장르/길이) + 그리드. `BooksExplorer` 패턴 재사용 |
| `apps/web/src/components/comic/ComicFormatChoice.tsx` | 형식 선택 3카드 + 처방 배지 (§5.2·5.3) |
| `apps/web/src/components/comic/ComicBadge.tsx` | `만화` 포맷 배지(gold, 아이콘+텍스트 — 색상 단독 정보전달 금지) |
| `apps/web/src/lib/comic/catalog.ts` | RPC 래퍼 + 타입 (`ComicCatalogItem`) |
| `apps/web/src/lib/comic/prescribe.ts` | §5.3 처방 규칙 순수 함수 (테스트 가능) |

### 8.2 수정 파일

| 파일 | 변경 |
|---|---|
| `components/library/LibraryTabs.tsx` | 4탭 + 만화 항목(`BookImage`) |
| `components/library/browse/BookFilterBar.tsx` | `formats` facet 칩(만화/오디오/퀴즈) + `BookFilters.formats` |
| `components/library/browse/BooksExplorer.tsx` | facet 계산에 `formats` 추가, 필터 반영 |
| `components/library/browse/BookGridCard.tsx` · `BookShelfRail` · `NetflixDetailSheet` | `ComicBadge` 노출 + 상세 시트에 "만화로 읽기" 보조 CTA |
| `lib/library/published-book.ts` | `PublishedBook.has_comic: boolean` 추가 |
| `app/(main)/library/books/page.tsx` | 히어로를 `list_comic_catalog()` 로 교체(G4·G5), `has_comic` 주입 |
| `components/comic/ComicReader.tsx` | 모바일 기본 `view='scroll'`(§2.5) · 종료 CTA 문구 R5 |
| `docs/ROUTES.md` · `MODULES.md` · `LIBRARY_PIPELINE.md` · `CHANGELOG.md` | 자동 갱신 매트릭스 대상 |

### 8.3 디자인 토큰 · 접근성 (CLAUDE.md 준수)

- 만화 액센트 = `var(--active)` gold. **CTA·eyebrow 2곳만** (히어로 카드 기존 규칙 계승).
- 배지는 아이콘+텍스트 동반 — 색상 단독 전달 금지.
- 모든 인터랙션 hover/active/focus/disabled 4상태 + `--dur-normal`/`--ease` transition.
- 터치 타겟 ≥44px, 탭은 `role="tab"` + `aria-selected`(기존 패턴 유지).
- `prefers-reduced-motion` — 카드 lift/이미지 scale 무효화(기존 히어로 패턴 계승).
- `data-theme="dark"` 양 테마 검증.

### 8.4 리더 정합

세로 스크롤 기본화는 **모바일 뷰포트에서만**(데스크톱은 페이지 넘김 유지) — 웹툰 근거는 엄지 스크롤 맥락에 한정된다.

---

## 9. 도서 · 스크립트 · 단어장 3종 체계와의 정합

### 9.1 공통 수명주기에 만화 얹기

| 단계 | 도서 | 스크립트 | 단어장 | **만화** |
|---|---|---|---|---|
| 수집 | LCP 9소스 → `library_seed_catalog` | ACP 4피드 | VCB seed | (없음 — 도서에서 파생) |
| 생성 | 챕터 분할 | 본문 정제 | enrichment | **CCP 드레인**(`book_curation_jobs.task_type='comic_gen'`) |
| 판정 | 4축 난이도 · VRL | article_v_level | QA flag | **QC 게이트**(`panels_pass` + `qc_verdict`) |
| 발행 | `status=published`+`published_at` | `status=published` | `is_published` | `admin_set_comic_published`(panels_pass 강제) |
| 카탈로그 | `/library/books` | `/library/scripts` | `/library/vocab` | **`/library/comics`** |
| 등록 | `enroll_library_book` | (즉시) | 구독 | **부모 도서 등록 승계**(별도 등록 개념 없음) |
| 진도 | `texts.status` | `texts.status` | FSRS | **`comic_read_progress`(분리 회계 · R1)** |

**핵심**: 만화는 수집·등록 단계를 갖지 않는다 — 도서에 종속되기 때문. 이 비대칭이 D1 의 실무적 증거다.

### 9.2 단어장 승계 경로 (G7 해소)

```
comic_pages.target_vocab (verbatim 정본만)
   └─▶ 검증: 챕터 단어장(shared_word_sets category='library_book') 부분집합인가?  ← §7.4
         ├─ Yes → 리더 vocab 칩 → WordVault 추가 → FSRS 진입 (기존 addWordToVault)
         └─ No  → qc_verdict.vocab_orphans 기록 → Admin 리뷰에서 해소
```

만화 상세 화면에 **"이 만화의 핵심 단어 N개 → 단어장에서 보기"** 링크를 두어 3종 체계를 잇는다.

### 9.3 스크립트(ACP)와의 관계

짧은 글은 현재 만화화 대상이 아니다(파이프라인 입력이 챕터 구조 전제). 향후 확장 시 `comic_books` 를 `source_kind('book'|'article') + source_id` 로 일반화해야 하므로, **지금 `library_book_id` PK 를 유지하되 확장 지점을 문서에 남긴다**(조기 일반화 회피).

---

## 10. 운영(Admin) 체계

기존 `/admin/comic`(카탈로그·발행·드레인) 위에 **카탈로그 큐레이션**만 추가한다.

| 추가 | 내용 |
|---|---|
| 노출 순서 | `comic_books` 에 `feature_rank smallint` 추가 → 히어로/탭 정렬 1순위(현재 알파벳순 G4 해소) |
| 단어장 정합 | 리뷰 화면에 `vocab_orphans` 표시(§7.4) |
| 프리뷰 지정 | 프리뷰 3컷의 시작 오프셋(기본 0) — 스포일러 회피용 `preview_from int` |
| 발행 체크리스트 | panels_pass · vocab_orphans=0 · cover 존재 · V레벨 스냅샷 일치 |

---

## 11. 성공 지표

| 지표 | 정의 | 목표 방향 |
|---|---|---|
| 만화 발견율 | `/library/comics` 또는 배지 클릭 / 라이브러리 세션 | ↑ |
| **전환율(핵심)** | 만화 열람 후 **7일 내 같은 책 본문 세션** 발생 비율 | ↑ (D6·R6 의 실효 검증) |
| 단독 이탈률 | 만화만 보고 본문 0인 사용자 비율 | ↓ (seductive details 방어 지표) |
| 만화 경유 완주율 | 만화 선행 학습자의 챕터 완독률 vs 비경유 | 비경유 이상 |
| vocab 승계율 | 리더 vocab 칩 → WordVault 추가 수 / 노출 수 | ↑ |
| 미등록 전환 | 프리뷰 → enroll 전환율 | ↑ (D4 의 ROI) |

---

## 12. 리스크

| 리스크 | 영향 | 대응 |
|---|---|---|
| 이미지 외부 URL 만료 | 카탈로그 깨짐(리더는 `broken` 상태 처리 존재) | 카탈로그 커버 실패 시 `BookImage` 폴백(현행) + 발행 시 HEAD 검증 잡 |
| anon RPC 확대 | 미발행 유출 | 프리뷰 RPC 는 published 이중 게이트 + LIMIT 5 하드캡 + `target_vocab` 미포함 |
| **(2026-08-09 실측) Supabase 기본 권한이 anon EXECUTE 를 자동 부여** | `select_book_comic_all` 로 **전권 90컷 + bubbles + target_vocab** 이 비로그인에 노출. 프리뷰 하드캡이 무력화 | `REVOKE EXECUTE ON select_book_comic_all(uuid), select_book_comic(uuid,int) FROM anon` — 리더는 authenticated 전용이고 프리뷰는 `preview_book_comic` 이 담당하므로 안전. **승인 대기** |
| 콘텐츠 편중(현재 2권: Frankenstein·A Christmas Carol) | 탭이 빈약해 보임 | 카탈로그 <3권이면 탭 대신 도서 히어로만 노출(자동 degrade) |
| 생성 비용 | 확장 제약 | 자가호스트 우선 정책 유지(RunPod/Kaggle) — [RUN_ENVIRONMENTS.md](../scripts/comic/docs/RUN_ENVIRONMENTS.md) |
| 각색 정확도 | 오독 유발 | verbatim 버블 + `verbatim-audit` 래칫(기존) + `vocab_orphans` 게이트 |
| 저작권 | PD 원문은 안전, 생성 이미지 귀속 | `library_books.copyright_safe_in_kr` 승계 + [DATA_ATTRIBUTION.md](./DATA_ATTRIBUTION.md) 에 생성 모델·라이선스 기재 |

---

## 13. 로드맵

### P0 — 발견 ✅ 완료 (2026-08-08 · 마이그레이션 없음)
- [x] `LibraryTabs` 4탭 + `/library/comics` 페이지 — 기존 `list_book_comic_catalog` 로 동작, 이어서 보기 레인 + 레벨 밴드 필터
- [x] `lib/comic/catalog.ts` 단일 출처 — 도서 히어로/만화 탭 공유. 커버 조회는 `coverLimit`(실제 렌더 카드 수)로 상한
- [x] `ComicBadge` + `PublishedBook.has_comic`/`comic_href` + `BookFilterBar` "포맷" 구획 + QuickPick "만화로"
- [x] `NetflixDetailSheet` gold 보조 CTA(만화로 읽기 / 만화 미리보기) — spotlight·rail·그리드 공통(`toBookDetailVariant`)
- [x] 회귀 `tests/e2e/11-comic-discovery.spec.ts` — 탭 이동 · 카드 진입 경로 · 포맷 칩이 배지 보유 도서만 남기는지
- 남은 G4/G5: 노출 순서(알파벳)와 커버 payload 는 `list_comic_catalog` RPC 가 필요 → P1

### P1 — 선택 · 프리뷰 ✅ 코드 완료 (2026-08-08) · ⏳ 마이그레이션 승인 대기
- [x] 마이그레이션 **작성**: [20260808240000_comic_catalog_p1.sql](../supabase/migrations/20260808240000_comic_catalog_p1.sql) — `list_comic_catalog` · `preview_book_comic` · `comic_books.feature_rank`/`preview_from` · anon GRANT. **미적용**(승인 후 SQL Editor)
- [x] `/library/comics/[bookId]` — 미등록·비로그인 프리뷰 3컷 + 포맷 선택
- [x] `lib/comic/prescribe.ts` + 단위 테스트 9종 — 권장 1개(만화는 "어려울 때/복습할 때"만)
- [x] `ComicFormatChoice` — 미등록은 `enroll_library_book`(멱등) 후 리더 직행, 비로그인은 `?next=` 로 복귀
- [x] 진입 경로 재배선: 만화 탭·히어로·상세 시트의 미등록 href → `/library/comics/[bookId]`
- [x] e2e 4종 — 마이그레이션 **미적용 상태에서 통과**(2단 폴백 검증). 적용 후 동일 스펙이 P1 경로를 검증
- 계약: 조회는 `list_comic_catalog` 우선, 실패 시 `list_book_comic_catalog`+전권 RPC 폴백 → 적용 전후 모두 동작

### P2 — 체계 정합 ✅ 완료 (2026-08-08 · 마이그레이션 없음)
- [x] **발행 조건 단일화** — `lib/library/publish-gate.ts`(도서 카탈로그 / 도서 열람 / 아티클 카탈로그 3종). `v_library_catalog` **뷰는 P3 로 연기**: 소비자(통합 홈)가 없는 상태에서 뷰만 추가하면 정의가 하나 더 느는 것뿐이라, 실제 쿼리 지점을 먼저 묶었다. 카탈로그 게이트(published_at 요구)와 열람 게이트(status만)가 **의도적으로 다르다**는 사실도 이 파일에 문서화 — 만화 RPC 게이트와 맞춘 것.
- [x] **vocab 정합 검증** — `lib/comic/vocab-integrity.ts`(+ 단위 테스트 8종). SQL 함수 대신 TS: 마이그레이션 없이 작동하고 표제어 변형 규칙(word/lemma 양방향 대조)을 테스트로 고정할 수 있다. Admin 검수에 "단어장 미등록" QC 타일 + 고아 단어 목록(≤40 표시).
- [x] **학습자 3종 연결** — 만화 상세에 "이 책의 단어장 보기" → `/library/books/[id]?preview=1`
- [x] **R2 분리 표기** — 도서 상세 시트에 "만화 미리 봄 42% / 다 봤어요" 행(본문 진도와 별도 블록) + CTA 라벨 분기(만화 이어서 보기 / 다시 보기)

### P3 — 통합 홈 · 적응
- [ ] `/library` 루트를 통합 홈으로 승격(현재 `/library/books` 리다이렉트) + 이때 `v_library_catalog` 뷰 도입(소비자와 함께)
- [ ] R6 적응 처방(만화 편식 감지 → 원문 권장 전환)
- [ ] 대시보드 회고에 만화 회계 반영 · 모바일 셸

---

## 14. 자가 검토 로그 (반대 의견 → 반영)

| 반대 의견 | 판정 |
|---|---|
| "탭 4개는 인지부하다 — Calm UI 위반 아닌가?" | 탭은 **동일 축의 4항목**이며 작업기억 4항목 한계 내. 대신 각 탭 카드 컴포넌트를 재사용해 시각 신규성을 최소화 |
| "만화를 GenreBucket 에 넣으면 코드 1줄이면 끝난다" | 축 오염 + 교차 필터 불가 + `genre_norm` 이 큐레이션 자유텍스트라 파이프라인 오염. **기각**(D1) |
| "미등록 프리뷰는 콘텐츠 유출" | 3컷·published 게이트·vocab 미포함이면 마케팅 손실 < 전환 이득. 상한은 서버 하드캡 |
| "만화 완주도 챕터 완료로 쳐야 참여가 는다" | 단기 참여 ↑ / 학습 성과 ↓(§2.4). **기각**(D6·R1). 대신 별도 회계로 성취감은 보존 |
| "통합 뷰는 과잉 추상" | 단어장은 뷰에서 제외해 범위를 좁혔고, 4종 발행 조건 산개(§4.3)라는 **실재 결함**이 근거 |
| (P2 구현 중 재검토) "뷰를 지금 만들면 소비자가 없다" | **수용** — 뷰는 P3 통합 홈과 함께. 대신 실제 쿼리 지점을 `publish-gate.ts` 로 묶어 §4.3 의 목적(한 곳만 고치면 함께 움직임)은 지금 달성 |

---

## 15. 출처 (딥서치)

**교육학 — 긍정**
- [Teaching Vocabulary with Graphic Novels (ERIC EJ1110011)](https://files.eric.ed.gov/fulltext/EJ1110011.pdf)
- [The Effect of Graphic Novels on EFL Learners' Reading Comprehension](https://www.researchgate.net/publication/347598778_The_Effect_of_Graphic_Novels_on_EFL_Learners'_Reading_Comprehension)
- [Derrick, Using Comics with ESL/EFL Students (TESL/TEFL)](http://iteslj.org/Techniques/Derrick-UsingComics.html)
- [Reading in a Foreign Language, Vol 34 No 2 (extensive reading)](https://scholarspace.manoa.hawaii.edu/server/api/core/bitstreams/48fe8833-9ca2-473b-93af-4ca785abcdf3/content)

**교육학 — 리스크(seductive details)**
- [Rey 계열 리뷰: The Seductive Details Effect in Multimedia Learning](https://www.researchgate.net/publication/383759460_The_Seductive_Details_Effect_in_Multimedia_Learning)
- [When and how seductive details harm learning (Bender 2021, Applied Cognitive Psychology)](https://onlinelibrary.wiley.com/doi/full/10.1002/acp.3822)
- [Task-irrelevant decorative pictures increase cognitive load (EEG·eye-tracking, PMC11142986)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11142986/)

**정보구조(FRBR)**
- [Tillett, The FRBR Model (Library of Congress)](https://www.loc.gov/catdir/cpso/frbreng.pdf)
- [FRBR: Application of the Model to Textual Documents (LRTS)](https://journals.ala.org/index.php/lrts/article/view/6747/9168)
- [Karen Coyle, FRBR Work in practice](http://kcoyle.net/FRBRWorkinpractice.html)

**제품 선례 · 리더 UX**
- [What is Whispersync for Voice (형식 전환 UX)](https://www.viwizard.com/audiobook-tips/whispersync-for-voice.html)
- [The UX of Webtoons: Reading Comics in the Digital Age](https://medium.com/@theshyreveal/the-ux-of-webtoons-reading-comics-in-the-digital-age-aefbd95620e5)
- [Webtoon Paneling Guide: Vertical Scroll (2026)](https://comistitch.com/blog/webtoon-vertical-scroll-paneling-guide/)
- [Design Critique: WEBTOON iOS App (IXD@Pratt)](https://ixd.prattsi.org/2026/02/design-critique-webtoon-ios-app/)

**시장**
- [6 Best Reading Apps for Language Learning (2026)](https://eppika.com/en/blog/best-reading-apps-language-learning-2026)
- [5 Best AI Comic Generators for Education in 2026](https://studyglen.com/guides/best-ai-comic-maker)

---

*CCP × Library 편입 설계 v1 — 2026-08-08. 구현 착수 시 P0부터, 마이그레이션은 승인 후 적용.*
