# 참조 사이트(Tines) 구간 → Vocaflow 화면 매핑

> 2026-09-21 · 작성 Claude Code · DD-68(「가장 닮음」 1단계)의 적용 지도.
> **사실의 출처**: 참조 쪽은 생성물 [`refs/tines/sections-summary.md`](refs/tines/sections-summary.md)
> (`scripts/design/extract-sections.mjs` — 33페이지 · 구간 약 200 · 팝업류 6) · [`components-summary.md`](refs/tines/components-summary.md)(컴포넌트 313 · DOM 실재 156) ·
> [`interactions-summary.md`](refs/tines/interactions-summary.md)(팝업·상호작용 10) · 우리 쪽은 저장소의 `page.tsx`·부품(같은 날 확인).
> 이 파일은 **판단**(어느 자리에 대응하나 · 적용 순서)을 적는 사람의 문서다. 참조 수치는 요약 파일이 정본이다.
>
> 상태: ✅ 적용 · ◐ 일부 · ○ 예정 · — 해당 없음(이유를 적는다)

## 0. 한 장 요약

| 층 | 참조 | 우리 대응 | 상태 |
|---|---|---|---|
| 전역 틀 | 알약 내비 + 메가메뉴 3 + 검색 모달 + 모바일 서랍 + 71링크 푸터 + 쿠키 배너 | 공개: `components/marketing/site/*`(랜딩 + `(marketing)/layout.tsx` 공통) · 학습자: `Sidebar` · `MobileTabBar` | ✅ 공개 화면 (검색 제외) |
| 공개 화면 | 홈 · 제품(3B) · 솔루션 · 산업 · 요금제 · 고객 · 도서관 · 블로그 · 이벤트 · 대학 · 법률 · 404 | `/` · `/about` · `/fit` · `/pricing` · `/library/*` · `/comics` · `/video` · `/teacher` · `/terms` · `/privacy` · `not-found` | ◐ `/` 만 |
| 앱 화면 | 제품 액자 안의 앱 UI(좌측 공간 목록 · KPI 줄 · 도넛 · 표) — `refs/tines/app-measured.json` | `/hub` · `/dashboard` · 학습 셸 | ○ |
| 삽화 | 꽃밭 · 사물 소품 · 격자 무대 · 만화경 무늬 | `public/illustrations/tines/` 29점(Qwen 생성 — §9 배정) | ◐ 공개 화면에 9점 사용 |
| 부품 | 컴포넌트 313(DOM 156) · 계열 13 | `components/ui/*` 20 · `marketing/site` · `marketing/sections` | ◐ §7 |

## 1. 전역 틀 · 팝업류

| # | 참조 구간(컴포넌트) | 무엇인가 | 우리 대응 | 상태 | 메모 |
|---|---|---|---|---|---|
| C1 | `SiteNav26` 헤더 | 로고 · 알약 내비 5 · 로그인/가입 · 대문자 CTA · 검색 원 | `SiteHeader` — 랜딩 + `(marketing)/layout.tsx` 공통 | ✅ | 2026-09-21 |
| C2 | 메가메뉴 Product (1440×310, 링크 4) | 큰 기능 카드 1 + 작은 카드 2 + 오른쪽 옅은 카드 | 「학습」: 난이도 진단(큰 카드) · 보관함 · 간격 복습 + 연습 목록 | ✅ | `nav-data.ts` |
| C3 | 메가메뉴 Solutions (1440×279, 묶음 4) | 「BY FUNCTION」 색면 카드 2 + 「BY INDUSTRY」 아이콘 목록 | 「서가」 읽을 것: 도서 · 복원 만화 / 대상: 수능 · 단어장 · 교사 | ✅ | |
| C4 | 메가메뉴 Discover (1440×411, 링크 6) | 글 카드 + 이벤트 카드 + 커뮤니티 카드 + 목록 | 「알아보기」: 영상 · 소개 + 요금제 | ✅ | 우리 블로그·이벤트는 없다 — 있는 것만 |
| C5 | `GlobalSearch` 모달 (전면, 입력 1) | 사이트 전역 검색 | `site/SearchDialog` + `GET /api/search` — 화면 · 도서 · 단어(로그인 시) · 영상 | ✅ | 정정: 이전 판의 「검색은 서가 안에만」은 틀렸다 — 학습자용 검색은 **어디에도 없었다**(관리자 쿼리에만) |
| C6 | 모바일 서랍 (374×329, 링크 4) | 햄버거 → 아래로 펼침 | `SiteHeader` 서랍(햄버거 → 메뉴 3묶음 + CTA) | ✅ | 390 에서 내비가 숨던 결함을 닫았다 |
| C7 | `SiteFooter26` (링크 71) | 다단 링크 묶음 + 꽃 | `SiteFooter` 5단(학습 · 서가 · 알아보기 · 시작하기 · 지원·정책) | ✅ | |
| C8 | 쿠키 배너 (하단 짙은 보라 띠, 버튼 3) | 동의 · 거부 · 설정 | — | — | 우리는 제3자 추적 쿠키를 쓰지 않는다(1차 이벤트만). 필요해지면 그때 |
| C9 | `AnnouncementBar` | 「NEW │ …→」 알약 | 랜딩 히어로 배지 | ✅ | |
| C10 | `WildCodeCTASection` (16페이지 공통, 518px) | 꽃밭 + 큰 CTA 띠 — 거의 모든 페이지 끝 | `FlowerCta` — 공개 화면 끝마다(약관·개인정보 제외) · 랜딩은 계측 붙은 자기 CTA | ✅ | |
| C11 | `ExplosionCTASection` (844px) | 「Built by you, powered by Tines」 대형 CTA | 위와 같은 자리 변형 | ○ | |

## 2. 페이지 템플릿 → 우리 화면

| 참조 템플릿 | 참조 구간 흐름(요약 파일 순서) | 우리 화면 | 상태 |
|---|---|---|---|
| 홈 `/` | 히어로 → 100× 그림 → 제품 액자 → 선언문 → 보라 통판 → 팀 탭 5 → USP → 카드 4 → CTA | `/` | ✅ |
| 제품 `/3b/` | 히어로 → 소개 → 영상 3열 → 탐색 → **벤토 3회(6–9칸)** → 코다 → FAQ → CTA | `/about` — 2열 히어로+영상 액자 · 영상 3열 · 보라 통판 · 벤토 7 · 색면 모듈 8 · 약속 | ✅ |
| 솔루션 `/solutions/it/` | `SolutionHero`(2열 + 그림) → 문제 서술 → 기능 2열(그림 6) → 「Dive into the details」 5–6열 카드 → 2열 → CTA | 대상별 소개: 수능 `/csat` · 교사 `/teacher` | ○ |
| 산업 `/public-sector/` | 히어로 2단 → 층층 제품 그림 → 3열 → 가운데 인용 → 2열 → 예시 → 협력사 8열 → 4열 → 폭발 CTA | 교사 · 학교(B2B) 소개 | ○ |
| 요금제 `/pricing/` | (보라 전면) 요금 카드 2 → 인용 격자 → 배지 줄 → FAQ 5 → CTA | `/pricing` — 보라 전면 + 요금 카드 3 · 차별점 · 영상 · FAQ 펼침(인용·배지 자리는 검증 가능한 동작) | ✅ |
| 고객·사례 `/customers/` | 9열 필터 → **책 모양 사례 카드**(`CaseStudyBookCard`) 격자 → CTA | `/library/books` (진짜 책 표지 격자) | ○ |
| 사례 상세 `/case-studies/r3/` | 하이라이트 수치 히어로 → 2열 본문(곁단) → 더 보기 3열 → CTA | 도서 상세 `/library/books/[id]` | ○ |
| 도서관 `/library/` | 이야기 격자 → 임베드 3열 → How it works → (눈썹 머리 + 모음 격자) ×4 → 도구 12열 → 공동체 격자 → 제출 CTA | `/library` 허브 · `/library/vocab` · `/comics` | ○ |
| 도서관 상세 | `LibraryTable`(그림 23) | 단어장 상세 `/library/vocab/[id]` | ○ |
| 블로그 `/blog/` | 대표 글 카드 → 발췌 → 글 카드 → 뉴스레터 폼 → CTA | `/video` — 2열 히어로(scene-video) · 종류별 머리 + 액자 격자 | ✅ |
| 글 상세 | 본문(`Article`, 영상) → CTA | `/text/[id]` 읽기 · `/video/[id]` | ○ |
| 이벤트 `/events/` | 세계 지도(펼침) → 디렉터리(필터 폼, 그림 33) → 뉴스레터 → CTA | 필터 디렉터리 패턴 → `/library/books` 필터 · `/csat` 문항 목록 | ○ |
| 대학 `/university/` | 히어로 → 과정 격자(그림 53) → 라이브러리 → 부트캠프 → CTA | 학습 경로 `/plan` · `/diagnostic` | ○ |
| 팟캐스트 `/podcast/` | 시즌별 2열 목록 ×6 | `/video` 시리즈 묶음 | ○ |
| 역량 표 `/workflow-capability-matrix/` | 점 격자 → **조작 다이얼**(펼침·폼) → 14열 표 → CTA | `/fit` — 왼쪽 정렬 제목 · 점 격자 무대 위 액자 속 도구 · FAQ 펼침 · 근거 카드 (`/diagnostic` 은 ○) | ◐ |
| 긴 이야기 `/history-and-future-of-workflows/` | 시대별 22구간 · 그림 · 인용 폼 | — | — 한 번짜리 캠페인 페이지. 필요할 때 |
| 법률 `/legal/` · `/privacy/` | 펼침 목록 · 긴 글 | `/terms` · `/privacy` | ○ (서체·색만) |
| 404 | 그림 1 + 검색 입력 | `app/not-found.tsx` — 공통 헤더 · 큰 제목 · 알약 출구 · scene-404 (검색 입력은 전역 검색이 생기면) | ◐ |
| 채용 · 파트너 · 뉴스룸 · 웨비나 · 보안 | 가치·복지·공고 목록 · 협력사 · 보도 · 등록 폼 · 준수 목록 | — | — 해당 사업이 없다 |

## 3. 구간 패턴 카탈로그 (재사용 부품 후보)

| # | 패턴 | 참조 예(컴포넌트 · 페이지) | 구조 | 우리 부품(만들 것) · 쓸 화면 | 상태 |
|---|---|---|---|---|---|
| P1 | 왼쪽 정렬 큰 제목 히어로 | `ThreeBHero` (홈 · 3B) | 배지 · 64px 2줄 · 세리프 부제 · 알약 CTA 2 · 증거 띠 | `/` | ✅ |
| P2 | 2열 히어로 + 그림 | `SolutionHero` (솔루션 · 산업) | 눈썹 · 제목 · 부제 · 오른쪽 그림 | `/about` · `/teacher` · `/csat` · `/pricing` | ◐ |
| P3 | 폭 전체 삽화 + 겹치는 제품 액자 | `ThreeBHundredXBanner` + `ThreeBProductVisual` | 그림 위로 라벤더 이중 테두리 액자 | `/` (CoverageHero) | ✅ |
| P4 | 가운데 선언문 | `HomeMonitorBanner` | 모노 눈썹 · 굵은 세리프 · 세리프 문단 · 양옆 그림 | `/` · `/about` | ✅ |
| P5 | 보라 통판 | `HomeSolutionSection` | 흰 제목 · 2×2 세리프 항목 · 아래 꽃밭 · 흰 알약 | `/` · `/pricing` | ✅ |
| P6 | 색면 탭 + 제품 패널 | `HomeUseCasesSection` (탭 5) | 색면 탭 5 → 누르면 아래 패널 전환 | `/` 모듈 5 — **지금은 정적 카드**(탭 전환 없음) | ◐ |
| P7 | USP 카드 줄 | `HomeUSPSection` (4열, 그림 4) | 보라 카드 · 세리프 문장 · 구석 소품 | `/` 문 카드 2 | ◐ |
| P8 | 벤토 격자 | `ThreeBBentoSection` (6–9칸, 3회) | 크기 다른 칸 · 그림 · 짧은 문장 | `/about` 기능 개관 · `/hub` 요약 | ◐ |
| P9 | FAQ 펼침 | `ThreeBFaqSection` · `PricingFaqSection` (펼침 5) | 질문 행 · 펼치면 답 | `/pricing` · `/fit` | ◐ |
| P10 | 요금 카드 | `PricingPlanCards` (2) | 보라 전면 위 카드 2 | `/pricing` | ◐ |
| P11 | 눈썹 머리 + 모음 격자 | `PageSectionHeader` + `CollectionsGridPageSection` (5–6열) | 모노 눈썹 · 제목 · 「모두 보기」 · 카드 격자 | `/library` 허브 · `/library/vocab` · `/comics` | ○ |
| P12 | 이야기 카드 격자 | `StoryGridPageSection` · `LibraryStoryCard` (9열, 그림 30) | 색 머리 카드 · 제목 · 태그 | 단어장 카드 · 도서 카드 | ○ |
| P13 | 책 모양 카드 | `CaseStudyBookCard` | 책 등 · 표지 · 제목 | `/library/books` 표지 — 우리는 **진짜 책**이라 자리가 딱 맞는다 | ○ |
| P14 | How it works 3단 | `HowItWorksPageSection` | 동사 3개 × 사물 그림 | `/fit` 사용법 · `/about` | ○ |
| P15 | 하이라이트 수치 히어로 | `CaseStudyHeroSection` | 큰 수치 3 · 제목 | 도서 상세(단어 수 · 레벨 · 챕터) — **DB 실측만** | ○ |
| P16 | 2열 본문 + 곁단 | `CaseStudyContent` · `Article` | 본문 단 · 붙어 있는 곁단 | `/text/[id]` 읽기 · `/library/books/[id]` | ○ |
| P17 | 필터 디렉터리 | `EventsDirectory` (폼 · 그림 33) | 왼쪽 필터 · 오른쪽 목록 | `/library/books` · `/csat` | ○ |
| P18 | 조작 다이얼 · 표 | `WcmDial` (펼침 · 폼 · 14열) | 조작 → 표가 바뀐다 | `/fit` · `/diagnostic` | ○ |
| P19 | 뉴스레터 폼 띠 | `NewsletterSection` | 문장 + 이메일 입력 | — | — 우편 발송 기능이 없다 |
| P20 | 꽃밭 CTA 띠 | `WildCodeCTASection` (16페이지) | 꽃밭 + 제목 + 알약 CTA | **모든 공개 화면 끝** | ◐ |
| P21 | 인용 · 배지 · 협력사 격자 | `CenteredQuoteSection` · `PricingQuotesGrid` · `G2BadgeList` · 협력사 8열 | 후기 · 수상 · 고객 로고 | — | — **지어낸 후기·수상 금지(I5)**. 대신 콘텐츠 출처(퍼블릭 도메인 원문 공급처)를 실제 목록으로 |
| P22 | 점 격자 무대 | `DotGridPattern` · `GridCanvas` | 12px 점 · 24px 선 격자 바탕 | 도구·진단 화면 바탕 — `/fit` | ◐ |

## 4. 앱 화면 — 참조의 제품 액자 안 UI

참조 홈의 제품 액자(`ThreeBProductVisual`)는 **앱 화면 자체**를 보여 준다(실측 `refs/tines/app-measured.json` · 복제 `/dev/replica/tines-app`).

| 참조 앱 부분 | 우리 대응 | 상태 |
|---|---|---|
| 좌측 레일: 워크스페이스 · 공간 목록(# IT · # Security …) · 선택 행 라벤더 면 | `components/layout/Sidebar.tsx` (학습 흐름 레일) | ○ |
| 상단 KPI 줄(Estimated spend · Tokens · Turns · Cache) | `/dashboard` 상단 요약 · `/hub` | ○ |
| 도넛(한도 대비) · 색 점 범례 | `/dashboard` 기억 상태 4색 분포 | ○ |
| 표(모델 · 수치 열 · 행 괘선) | `/wordvault` 목록 · 교사 학급 표 | ○ |
| 재생 막대(타임라인 스크러버) | — (마케팅 연출) | — |

## 5. 적용 순서 제안

1. **공통 틀**: C1 헤더 + C6 모바일 서랍 + C7 푸터 + C10 꽃밭 CTA 를 `(marketing)/layout.tsx` 로. 공개 화면 전체가 한 번에 바뀌고, 모바일 내비가 없던 결함도 이 단계에서 닫힌다.
2. **메가메뉴 C2–C4**: 헤더에 붙인다. 카드 그림은 기존 소품 5점을 쓴다.
3. **공개 화면**: `/about`(P2 · P4 · P8 · P14) → `/pricing`(P10 · P9 · P5) → `/fit`(P18 · P9) → `/library` 허브(P11 · P12 · P13).
4. **앱 셸**: §4 — 레일 · KPI · 도넛 · 표.
5. **학습 중 화면**(카드 · 퀴즈 · 읽기): 참조에 대응물이 없다. 스킨 토큰만 받은 지금 상태를 보고 따로 정한다.

## 6. 이 목록의 한계 (측정 방법에서 오는 것)

- 헤더 안에 그려지는 히어로(요금제 상단 보라 띠 등)는 구간에서 빠진다 — 틀 안(`header · nav`)을 구간으로 세지 않기 때문이다.
- `/contact/` · 블로그 글 본문처럼 이름 없는 요소로만 된 본문은 구간이 1개(마지막 CTA)로 잡힌다.
- 이전 세대 페이지(enterprise · university · careers · podcast 등)는 CSS 모듈 이름이 없어 `<section>`·`<div>` 로 적혔다.
- 로그인해야 보이는 참조 앱 화면은 제품 액자에 보이는 만큼만 안다.

## 7. 부품 단위 매칭 — 참조 컴포넌트 계열 → 우리 부품

> 출처: [`refs/tines/components-summary.md`](refs/tines/components-summary.md)(33페이지 · 시트 42 · 이름 313 · DOM 실재 156).
> 「상태」 칸은 참조 CSS 에 실제로 있는 상호작용 선택자다 — 우리 부품이 같은 상태를 가져야 한다.

| 계열 | 참조 대표(페이지 수) | 참조 상태 | 우리 부품 | 할 일 | 상태 |
|---|---|---|---|---|---|
| 내비 | `SiteNav26`(21) · `AreaNav`(18, 구역 하위 내비) · `NavSearch` | :hover · ::placeholder | `marketing/site/SiteHeader` · 학습자 `layout/Sidebar` | 공개 ✅. `AreaNav` → `layout/AreaNav`(라벤더 알약 막대 · 구역 이름 알약 · 선택 면 흰 알약 · 50px) — 서가 · 만화 탭 ✅ · 수능 하위 탭 ○ | ◐ |
| 푸터 | `SiteFooter26`(21) | aria-expanded(모바일 접힘) | `SiteFooter` | 390 에서 묶음 접힘(aria-expanded) | ◐ |
| 버튼 | `Button`(19) · `CtaButtons`(15) · `CollectionViewToggle` · `DocsThemeToggle` | :hover · :focus · :disabled | `ui/Button` · `marketing/pill.ts` | `ui/Button` 에 알약 변형 → 앱 전체가 같은 단추 · 격자/목록 보기 전환 ↔ 서가 보기 전환 | ○ |
| 폼 · 입력 | `TextInput` · `Textarea` · `Checkbox` · `ConsentCheckboxes` · `ContactSupportForm` | :hover · :focus · ::placeholder · :checked | `ui/Input` · `Textarea` · `Checkbox` · `FormField` · `Select` · `Radio` · `Toggle` | 스킨 토큰만 받은 상태 → 참조 입력 모양(라벤더 테두리 · 14px 모서리 · 보라 포커스 링) | ○ |
| 탭 · 펼침 · 캐러셀 | `HomeUseCasesSection`(role=tab · aria-selected) · `ThreeBFaqSection`/`PricingFaqSection`([open]) · `HomeLogoMarquee` · `TimelineScrubber` · `WcmDial` | aria-selected · [open] · :focus-visible | `sections/Faq` ✅ · 탭 **부품 없음** · `ui/ButtonGroup` | `ui/Tabs`(aria-selected · 방향키) 신설 → 랜딩 모듈 5 를 탭 전환으로 · 학습 화면 필터 탭 | ◐ |
| 표 · 목록 · 격자 | `LibraryTable` · `EventsDirectory` · `PartnerDirectory` · `CaseStudyGridSection` · `ThreeBBentoSection` · `DotGridPattern`(5) | :hover · :active · :focus | `sections/Bento` ✅ · 서가 격자 · 관리자 표 | 서가 필터 디렉터리(왼쪽 `LibrarySidebar` + 위 `LibraryFindAndFilterBar`) · 관리자 표 행 | ◐ |
| 카드 | `CaseStudyBookCard`(3, :hover · :active) · `LibraryStoryCard` · `ContentCard*` · `WhatsNewCard` · `LibraryToolCard` · `PricingPlanCards` · `ThreeBExampleCard` | :hover · :active · :focus-visible | `ui/Card` · 서가 `VocabSetCard` · 표지 · `sections/ToneCards` ✅ | `ui/Card` 에 콘텐츠 · 책 · 도구 카드 변형 | ○ |
| 히어로 · 머리 | `SectionHeading2`(5) · `SolutionHero`(3) · `SolutionPageAllcapsHeading` · `ComboFontHeading`(산세리프+세리프 한 제목) · `HeroHeadlineDecoration` | — | `sections/Hero2Col` · `SectionHead` ✅ · 앱 구역 머리 `layout/AreaHero`(2열 · 틴트 면 위 장면 · 수치 알약) ✅ | `ComboFontHeading` 변형 | ◐ |
| CTA 띠 | `WildCodeCTASection`(15) · `ExplosionCTASection`(3) · `ThreeBCodaSection` | — | `site/FlowerCta` ✅ | 폭발형 변형(큰 세리프 + 방사 그림) | ◐ |
| 매체 · 삽화 | `WildCodeFlowers`(15) · `InteractiveCursor`(15) · `CurrentColorRemoteSvg`(6, 글자색 따라가는 아이콘) · `VideoPlayer` · `ThreeBMascot` | :hover · :focus-visible | `public/illustrations/tines/*`(29점) · `ComponentVideo` · lucide | 영상 액자 ✅ · 마스코트 자리 · 커서 연출 보류 | ◐ |
| 본문 · 서식 | `Article`(3) · `StructuredTextBlock` · `PullQuote` · `CenteredQuoteSection` · `DefaultSidebarContent` | :hover | 읽기 `text-viewer` · 약관 본문 | 본문 단 · 인용 · 곁단 → `/terms` `/privacy` `/text/[id]` | ○ |
| 모달 · 팝업 | `GlobalSearch`(role=dialog) · 쿠키 설정 패널 | Esc · focus | `ui/Modal` · `ui/Toast` · `ui/Tooltip` | `ui/Modal` 을 참조 검색 모달 모양(전면 · 상단 입력 · 결과 목록)으로 | ○ |
| 서가 전용 | `LibrarySidebar`(2) · `LibraryFindAndFilterBar` · `LibraryDirectoryHero`(2) · `RatingStars` | :focus · ::placeholder | 서가 목록 화면 | 왼쪽 필터 곁단 + 위 검색·필터 막대 — `/library/*` | ○ |

## 8. 전체 라우트 매칭 (우리 약 170 라우트 → 참조 템플릿 · 구간 패턴 · 삽화)

| 우리 묶음 | 라우트 | 참조 템플릿 | 쓸 패턴 | 삽화 | 상태 |
|---|---|---|---|---|---|
| 랜딩 | `/` | 홈 | P1 · P3 · P4 · P5 · P6 · P7 · C10 | hero-book-field · bed-flowers · spot 5 | ✅ |
| 소개 | `/about` | 제품(3B) | P2 · P5 · P8 · P6 | hero-book-field · spot | ✅ |
| 요금제 | `/pricing` | 요금제 | 보라 전면 · P10 · P9 | — | ✅ |
| 진단 | `/fit` · `/fit/s/[payload]` | 역량 표 | P18 · P22 · P9 | — (도구가 주인공) | ◐ (`/fit/s` ○) |
| 영상 | `/video` · `/video/[id]` | 블로그 · 팟캐스트 · 글 상세 | P11 · P12 · P16 | scene-video | ○ |
| 약관 | `/terms` · `/privacy` | 법률 | 본문 서식 · 펼침 | — | ○ |
| 인증 | `/login` · `/signup` · `/reset-password` · `/verify-email` · `/join/[code]` | 문의 폼(`ContactSupportForm`) | 2열(폼 + 틴트 면 위 scene-hub) — `(auth)/layout.tsx` | scene-hub | ◐ (`/join` · 폼 부품 ○) |
| 서가 | `/library/books` · `/library/books/[bookId]` · `/library/vocab` · `/library/textbooks/*` · `/library/scripts/*` | 도서관 · 고객/사례 · 사례 상세 | `AreaNav` · P11 · P12 · P13 · P15 · P16 · P17 | scene-library · card-books · card-vocab · spot-dictionary | ◐ (`/library/books` 머리 · 탭 ✅, 격자·필터 ○) |
| 만화 | `/comics` · `/comics/restored/*` · `/comics/adapted/*` | 도서관 · 글 상세 | P11 · P12 · P16 | scene-comics · spot-comic | ◐ (두 면 머리 · 탭 ✅) |
| 수능 | `/csat` · `/csat/dissect` · `/csat/formulas` · `/practice` · `/practice/dcp` | 솔루션 · 이벤트 디렉터리 | P2 · P17 · `AreaNav` | scene-csat | ○ |
| 교사 | `/teacher` · `/reports` | 산업(B2B) | P2 · 표 | scene-teacher · spot-teacher | ◐ (`/teacher` 머리 ✅ — 액자형 장면이라 `fit="cover"`) |
| 셸 · 허브 | `/hub` · `/dashboard` · `/plan` · `/my/*` · `/settings` | 제품 액자 속 앱 UI(§4) | 레일 · KPI 줄 · 도넛 · 표 | scene-hub · spot-dashboard | ◐ (`/hub` 첫 지면 카드 · `/dashboard` 머리 + 틴트 카드 순환 ✅) |
| 학습 모듈 | `/text*` · `/wordvault*` · `/flashcard*` · `/spellforge*` · `/scriptquiz*` · `/dictate*` · `/pairflip*` · `/text/[id]/echo` · `/diagnostic*` · `/wordblitz` | 대응 없음(참조는 마케팅 사이트) | 입구 화면만 P2 + 소품 · 학습 중 화면은 스킨 토큰 | spot-reading · vault · flashcard · spellforge · quiz · listening · pairflip · echomatch · wordblitz | ○ |
| 빈 상태 | 각 모듈 빈 목록 | 404 · 빈 결과 | 소품 + 문장 + 다음 한 걸음 | spot-empty-vault · spot-review-done · spot-search | ○ |
| 404 | `not-found.tsx` | 404 | 그림 + 검색 입력 | scene-404 | ○ |
| 아케이드 | `/arcade*` · `/play/*`(19) | — | — | — | — 게임은 자기 미술을 가진다 |
| 관리자 | `/admin/*`(60) | 제품 액자 속 앱 UI | 레일 · 표 · 필터 막대 | — | ○ (스킨 토큰만) |
| 개발 | `/dev/*` · `/hub-lab` · `/sitemap` | — | — | — | — |

## 9. 삽화 배정 (`public/illustrations/tines/` 29점 — `scripts/design/illo-tines-gen.mjs`)

| 규격(참조 dna §6) | 파일 | 쓰는 자리 |
|---|---|---|
| 장면(폭 전체) | hero-book-field · scene-library · scene-comics · scene-csat · scene-teacher · scene-video · scene-hub · scene-404 | 랜딩 히어로 · 서가 · 만화 · 수능 · 교사 · 영상 · 허브/인증 · 404 |
| 띠(아래 꽃밭) | bed-flowers | 보라 통판 · 꽃밭 CTA |
| 카드 머리 | card-books · card-vocab | 메가메뉴 서가 카드 · 서가 모음 격자 머리 |
| 소품(카드 구석) | spot-reading · vault · memory · listening · quiz · comic · flashcard · spellforge · wordblitz · pairflip · echomatch · dashboard · dictionary · teacher | 모듈 카드 · 메가메뉴 · 입구 화면 |
| 빈 상태 소품 | spot-empty-vault · spot-review-done · spot-search | 보관함 빈 목록 · 오늘 복습 끝 · 검색 결과 없음 |
| 패턴 타일 | pattern-kaleido-1 · pattern-kaleido-2 | 참조 `HomeAiTangleBanner` 모니터 액자 속 무늬 자리 — 영상 포스터 · 로딩 바탕 |

## 10. 팝업 · 상호작용 매칭

> 출처: [`refs/tines/interactions-summary.md`](refs/tines/interactions-summary.md)(시나리오 11 · 기록 10). 스크린샷은 `tmp/tines-capture/interactions/`(커밋 안 함).

| 참조 상호작용 | 관찰 | 우리 대응 | 상태 |
|---|---|---|---|
| 메가메뉴 Product | 1440×310 · 포커스 4 · 꽃 그림 포함 | `SiteHeader` 메가메뉴 | ✅ |
| 검색 모달 | role=dialog · 전면 · 입력 1 · 입력하면 결과 목록 | `SearchDialog` — role=dialog · aria-modal · Esc/바깥 닫기 · 포커스 복귀 · Tab 가둠 · Ctrl/⌘+K · 빈 결과에 소품 + 다음 한 걸음 | ✅ |
| 쿠키 설정 | 1212×108 패널 · 토글 4 | — (제3자 쿠키 없음) | — |
| 홈 팀 탭 전환 | role=tab · 전환 시 패널 1360×939 교체 · 포커스 11 | 랜딩 모듈 5 — 정적 카드 → `ui/Tabs` 전환형 | ○ |
| FAQ 펼침 | `[open]` 선택자(details 계열) | `sections/Faq`(`<details>`) | ✅ |
| 영상 재생 | `VideoPlayer` 1344×755 인라인 | `ComponentVideo`(인라인) | ✅ |
| 문의 폼 | `ContactSupportForm` 552×539 · 입력 5 · 파일 첨부 | 인증 폼 · 문의는 mailto | ◐ |
| 모바일 메뉴 · 하위 메뉴 | 374×329 → 하위 펼침 374×769 · 포커스 11 | `SiteHeader` 서랍(하위 묶음 접힘 없이 전부 펼친 목록) | ◐ |
| 404 | 전면 · 검색 입력 1 · 링크 다수 | `not-found.tsx` | ○ |
| 이벤트 필터 | 기록 실패(누를 요소를 못 찾았다) | — | 재측정 필요 |

**기록의 한계**: FAQ 시나리오는 고정 헤더를 층으로 잡았다(값 무효 — `[open]` 선택자로 대신 확인). 이벤트 필터는 누를 요소를 찾지 못했다.

## 11. 색 구성 — 참조와 우리(2026-09-21 실측)

같은 방법(전체 페이지 캡처 · 7픽셀마다 · HSL 계열)으로 잰 면적 %. 「보라 계열」= 진한 보라 + 보라 틴트.

| 짝 | 보라 계열(우리/참조) | 진한 보라 | 보라 틴트 | 참조에만 있는 것 |
|---|---|---|---|---|
| 홈 | 26.9 / 23.3 | 26.1 / 19.7 | 0.8 / 3.6 | 초록 5.3 |
| 소개 ↔ 3B | 21.1 / 56.4 | 20.2 / 4.1 | 0.9 / **52.3** | — |
| 요금제 | 25.6 / 92.5 | 18.1 / 92.0 | 7.5 / 0.5 | — |
| 진단 ↔ 솔루션 | 11.1 / 8.4 | 8.8 / 5.1 | 2.3 / 3.3 | 분홍 틴트 8.5 · 주황 틴트 2.2 · 청록 1.9 |

**조치(같은 날)**: 스킨에 틴트 6 · 글자 두 단(`--t1` `#5d38ae` / `--t2` `#714bd0`)을 넣고 벤토 칸에 틴트를 돌렸다.

**읽는 법**: 우리가 보라를 「더 많이」 쓴 게 아니다 — **진한 보라 면**을 많이 쓰고 **틴트 면**(라벤더 · 분홍 · 주황 · 초록 · 청록 옅은 면)을 거의 안 쓴다. 참조의 글자색도 한 색이 아니다(제목 `#5D38AE` 40회 · `#714BD0` 은 홈 4회 — dna §2). 다음 회차의 색 조정 근거다.
