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

## 9. 삽화 배정 (`public/illustrations/tines/` — `scripts/design/illo-tines-gen.mjs`, 3회차 기준 · 규격 근거 §13-2)

| 규격(참조 실측) | 파일 | 쓰는 자리 |
|---|---|---|
| **진한 면 타일** 1328² (표시 220~300px, 바탕이 그림의 일부) | tile-books · articles · decks · textbooks · comics · read · vault · flashcard · wordblitz · pairflip · spellforge · echo · quiz · dictation · dashboard · csat · teacher · hub | 구역 머리(`AreaHero` — 서가 · 만화 · 교사) · `/practice` 강조 카드 · 앞으로 모듈 입구 · 서가 모음 격자 |
| **물건 소품** 1328² (표시 64~150px, 투명) | spot-reading · vault · memory · listening · comic · flashcard · spellforge · wordblitz · pairflip · echomatch · dashboard · dictionary · teacher · empty-vault · review-done · search · quiz | `/practice` 면 카드 구석 · 메가메뉴 · 랜딩/소개 모듈 카드 · 오늘 · 성장 머리 · 검색 빈 결과 · 빈 상태 |
| **용도별 소품** 1328² (투명, 표시 104~180px — `ui/SpotState`) | spot-empty-shelf · spot-empty-page · spot-offline · spot-error · spot-loading · spot-locked (+ 기존 empty-vault · search · review-done) | 서가 빈 상태(비었음 = 빈 책장 · 걸러짐 = 돋보기 · 못 읽음 = 플러그) · 읽기/보관함 빈 상태 · 전역 오류 · 404 — spot-lost · welcome · calendar 는 무료 한도 소진으로 미생성 |
| **흩어진 물건 띠** 1664×928 (투명, 가운데 빈 자리) | band-scatter | 마감 CTA 둘레(참조 「Built by you」) |
| 꽃무늬(홈 전용) | hero-book-field · bed-flowers | 랜딩 히어로 · 보라 통판 · 꽃밭 CTA |
| 꽃 장면(2회차 · 교체 대상) | scene-hub · scene-video · scene-404 (library · comics · csat · teacher 는 타일로 대체돼 안 쓴다) | 인증 · 영상 · 404 |
| 카드 머리 · 패턴 | card-books · card-vocab · pattern-kaleido-1/2 | 메가메뉴 서가 카드 · 영상 포스터 |

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

## 12. 「왜 전부 보라인가」 진단 (2026-09-21 실측 2회차)

같은 방법(캡처 5픽셀마다 · HSL 계열 · 바탕 제외 면적 %)으로 참조 캡처 17장과 우리 캡처 14장을 쟀다. 스크립트는 1회용(세션 scratch) — 입력은 `tmp/tines-capture/**` · `docs/design/shots/replica/*`.

| 참조 화면 | 보라계 | **보라 외 색** | 주된 보라 외 색 |
|---|---|---|---|
| 서가(library) | 12.9 | **24.4** | 자홍 틴트 9.5 · 초록 틴트 4.6 · 주황 틴트 4.2 · 진초록 `#008855` · 자홍 `#cc3388` · 빨강 `#dd3333` 카드 |
| 블로그 | 13.3 | **20.0** | 진자홍 `#441133` 8.1 · 초록 4.1 · 주황 3.5 |
| 이벤트 필터 | 16.9 | **50.6** | 청록 `#66ddee` 32.0 |
| 검색 팝업 | 12.6 | **23.5** | 노랑 `#ffcc66` · 살구 `#ffbb99` · 라임 `#ccdd55` |
| 문의 폼 | 15.7 | **22.2** | 틴트 6색 고루(초록 8.6 · 분홍 4.4 · 노랑 4.3 · 주황 4.1) |
| 홈 | 25.1 | 8.7 | 초록 통판 `#007744` 4.9 · 팀 탭 파랑 `#3366cc` · 주황 `#cc5500` · 청록 `#008888` |
| 요금제 · FAQ · 404 · 영상 | 75~100 | 0~5 | **여기만 보라가 주인공**(보라 통판) |

| 우리 화면 | 보라계 | 보라 외 색 |
|---|---|---|
| `/library/books` | 17.0 | **4.0** |
| `/hub` | 12.9 | **1.6** |
| `/comics/adapted` | 6.5 | **1.0** |
| `/teacher` | 6.8 | 5.0 |
| 랜딩(6장) | 14~39 | 1.2~9.6 |
| `/pricing` | 67.8 | 1.0 |
| `/dashboard` | 18.5 | 21.6 (틴트 순환 적용 뒤) |

**결론 — 참조는 「보라 브랜드 + 구간·카드마다 다른 원색 면」이고, 우리는 보라만 옮겼다.**

1. **채도 높은 면 색을 안 가져왔다(가장 큰 원인).** 참조는 카드·통판 바탕에 진초록 `#007f4a` · 자홍 `#be327e`/`#cc3388` · 빨강 `#c12f2e` · 청록 `#008784` · 주황 `#c05100` · 파랑 `#3565cc` 를 깔고 흰 글자를 얹는다(서가 use-case 카드 · 홈 팀 탭 · 블로그). 우리 스킨에는 같은 값이 `--success/--warning/--info/--error` 로 **이미 있지만 상태색으로만** 쓰이고 면으로는 한 번도 안 쓰였다.
2. **중립 면까지 라벤더다.** `--bg2 #f5f2fb` · `--bg3 #ece8fd` · `--p-light` · `--bd #c3b5ff` 가 전부 보라 계열이라, 색을 안 칠한 카드·칩·테두리도 보라가 된다. 새 부품(`AreaNav` · `AreaHero` 기본값 · 수치 알약)도 라벤더를 기본으로 골랐다.
3. **색을 범주에 붙이지 않았다.** 참조는 팀(IT 보라 · Security 파랑 · Finance 초록 · People 분홍 · Operations 청록)과 use-case 마다 고유 색을 준다. 우리에게도 범주가 있다(모듈 9 · 자료 4 · CEFR · 장르) — 색이 붙어 있지 않다.
4. **삽화 팔레트가 보라 편향이다.** `illo-tines-gen.mjs` 의 `PALETTE` 7색 중 3색이 보라 + 윤곽선 보라 + 카드 머리 바탕 라벤더. 참조 소품은 노랑·살구·라임·초록 비중이 크다(검색 팝업 상위 3색이 전부 노랑·살구·라임). 라임 · 청록 · 빨강이 우리 팔레트에 없다.
5. **측정이 색을 빠뜨렸다.** `extract-css-authored.mjs` 는 모션·모서리·그림자만 모았고 색은 안 모았다. 색 근거는 계산 스타일(`computed-summary.md` — 색 변수 467개, 12계열: lime 24 · yellow 14 · orange 14 · purple 14 · pink 12 · green 12 · teal 8 · red 8 · magenta 8 · blue 6 …)뿐인데 그중 보라 + 옅은 틴트 6만 토큰으로 옮겼다. §11 비교도 보라 계열 면적만 보고, 가장 색이 많은 서가 · 블로그 · 이벤트 · 검색은 짝을 짓지 않았다.

글자색은 원인이 아니다 — 참조도 제목·본문이 보라(`#5d38ae` · `#714bd0`)다. 다른 점은 **원색 카드 위에서는 흰 글자**라는 것이다.

## 13. 151페이지 코퍼스 — 색 짝 · 삽화 규격 (2026-09-21)

> 출처 [`refs/tines/corpus-summary.md`](refs/tines/corpus-summary.md) · `corpus.json` — 사이트맵 6,439 URL → 템플릿 80 · 151페이지(`scripts/design/tines-corpus.mjs`), 그림 2,510 · 바탕색 93. 원본 캡처·모음판은 `tmp/tines-corpus/`(저장소 밖).

### 13-1. 색은 「면 + 같은 색상의 글자」 짝이다

글자의 83.6% 는 `#5d38ae`(보라)다 — 보라 글자는 맞다. 다른 것은 **면**이다: 옅은 면 위에서는 **같은 색상의 짙은 글자**, 진한 면 위에서는 크림/흰 글자.

| 색상 | 옅은 면 → 글자 (대비) | 진한 면 → 글자 (대비) | 본문 AA 되는 진한 면 |
|---|---|---|---|
| 보라 | `#ece8fd` → `#5d38ae` (6.6) · `#eadff8` → `#4d3e78` (7.2) | `#7a56e0` → `#fcf9f5` (4.7) · `#8d75e6` → 흰 (3.6) | `#6956a8` (6.0) · `#4d3e78` (9.2) · `#32274b` (13.7) |
| 초록 | `#e4eee7` → `#005d35` (6.8) · `#d6edd9` → `#195642` (6.9) | `#25a871` → 흰 (3.0) · `#008b53` → 크림 (4.2) | `#1f7a57` (5.3) |
| 주황 | `#ffe1c4` → `#8a3701` (6.4) · `#ffe0cc` → `#803218` (7.0) | `#d15c08` → 크림 (3.8) · `#f47e3f` → 흰 (2.7) | `#b74d1a` (5.1) |
| 자홍 | `#ffdeee` → `#8a1f57` (7.0) · `#ffdce8` → `#763359` (7.0) | `#e269a4` → 흰 (3.1) · `#cd3d8b` → 크림 (4.3) | `#a54b7a` (5.4) |
| 청록 | `#ddf1ed` → `#006d6d` (5.2) | — | — |
| 무채 | 크림 `#fcf9f5` · `#f3efea` · 흰 | 숯 `#32313b` → 크림 (12.2) | 〃 |

진한 면 위 3.0~4.3 은 참조가 **큰 제목에만** 쓰는 값이다 — 우리는 본문이 올라가는 진한 면에 오른쪽 열(AA)을 쓴다.

### 13-2. 삽화 규격 — 쓰임별

| 쓰임 | 페이지당 | 크기 p10/중앙/p90 | 위치 | 참조 화풍 | 우리 지금 |
|---|---|---|---|---|---|
| **소품(spot)** | **7.8** | 51 / 81 / 137 정사각 | 오른쪽 54% · 왼쪽 28% | 굵은 짙은보라 윤곽 **물건 하나**(학사모·머그·방패·컴퓨터·램프·로봇팔), 약간 입체, 꽃 없음. 크림 바탕 또는 **옅은 정사각 타일**(라벤더·살구·민트, 135×135) 위 | 꽃밭 딸린 소품 · 화면당 0~2 |
| **카드 타일** | 2.6 | 218 / 382 / 680 × 146 / 250 / 409 | 고르게 | **진한 단색 정사각 면**(초록 `#00894f` · 자홍 `#cd3d8b` · 주황 `#c75a1a` · 보라 `#7a56e0`)을 꽉 채우고 가운데에 물건·기계 하나(전구 문어 · 조명 아래 보석 · 톱니 기계 · 레일) — 300×300 / 170×170 | 없음 |
| 히어로 | 0.8 | 331 / 457 / 861 × 128 / 319 / 547 | 오른쪽 43% | 카드 타일과 같은 문법, 또는 흩어진 물건 | 투명 바탕 꽃 장면 |
| 띠(band) | 1.3 | 1240 × 540 | 가운데 91% | 가운데 CTA 카드 둘레에 **작은 물건이 흩어진** 판(「Built by you, powered by Tines」) | 꽃밭 띠 |
| 본문 삽입(inline) | 3.6 | 221 / 603 / 933 | 고르게 | 진한 면 타일 · 제품 화면 조각 · 도표 | 없음 |
| 꽃무늬 | — | — | — | **홈 히어로 글자 · 마감 CTA 에만**. 나머지 화면은 물건 삽화 | 전 화면 |

**조치**: ① 스킨에 색 짝 토큰과 `.tone-*` 면 클래스(면 안의 `--t1/--t2/--bd` 를 그 색상 글자로 바꾼다) ② 범주 색 배정(자료 4 · 모듈 9) ③ 삽화 생성기에 「물건 소품」 · 「진한 면 타일」 · 「흩어진 물건 띠」 화풍 추가, 꽃무늬는 랜딩 히어로·마감 띠만 ④ 화면당 소품 수를 참조 수준(서가·모듈 입구·빈 상태·카드 구석)으로.

## 14. UI 부품 — 참조 80개 템플릿 실측과 적용 (2026-09-21)

> 출처 [`refs/tines/ui-kit-summary.md`](refs/tines/ui-kit-summary.md) · `ui-kit.json` — `scripts/design/extract-ui-kit.mjs`(코퍼스 템플릿마다 첫 페이지, 버튼 호버까지). 부품 클래스는 `components/ui/tines-kit.ts` 한 곳.

| 부품 | 참조 실측 | 우리 적용 |
|---|---|---|
| 1차 버튼 | `#542f9c` · 크림 · 990px · 35 · 모노 13/700 대문자(69/80) · 호버 `#6741bf` | `BTN.primary`(`--p` → 호버 `--ju`) · 한글이라 산세리프 14/700 |
| 2차 · 연한 버튼 | 크림 + 보라(호버 `#d1c7ff`) · 라벤더 `#ece8fd` + `#6741bf`(33/80, 호버 `#ded8ff`) | `BTN.secondary` · `BTN.soft` · 진한 면 위 `BTN.onDeep` |
| **버튼 모양 전역** | 버튼은 모두 알약 | globals.css 스킨 모양 층: `inline-flex` + 44px 하한 링크·단추 → 999px(모서리 토큰은 카드와 공유라 값은 그대로). 지킬 곳은 `data-shape="keep"` |
| 색 탭 | 홈 팀 탭: 탭마다 원색 카드(초록·보라·청록·주황·파랑) · 14px · 167 · 고른 탭 색이 패널로 | `ui/ToneTabs`(role=tab · 방향키 · 자동 활성) → 랜딩 모듈 다섯 |
| 구역 탭(위) | `AreaNav` 라벤더 알약 막대 · 붙음 top 68 · h 62 | `layout/AreaNav`(서가 · 만화) |
| 아래 탭 | (참조 홈 제품 액자의 떠 있는 막대) | `MobileTabBar` 떠 있는 유리 막대(라벤더 82% · blur 12 · 28px · 선택 = 흰 알약) · `--tabbar-h` 86px |
| 분절 | 반투명 보라 트랙 · 켠 칸 크림 · 10.5px · 45 | `SEG` 클래스(새 코드용) |
| 칩 | 라벤더 알약 24 · 14/600(38/80) · 모노 대문자 28 | `ios/Capsule` neutral = 라벤더 + `--ju` · `CHIP.*` |
| 입력 | 투명 · 1px `#d7c4fa` · 6px · 46 · 검색은 라벤더 알약 | 스킨 모양 층: 테두리 있는 input/textarea/select → `--bd-input` · `INPUT.*` |
| 카드 | **그림자 없음** · 크림+`#aa94ff` 12 · 웜그레이 10 · 틴트+같은색 테두리 8 · 숯 14 | `CARD.*` · `--bd-strong` · 스킨이 iOS 글로우·다크 실그림자를 링/없음으로 |
| 팝업 막 | 검색은 검은 막 없이 유리 막대(모서리 14 · 얇은 테두리) | 검색 모달 = 라벤더 막 + 유리 패널 · 스킨 모양 층이 `fixed bg-black/40~60` 막을 라벤더 55% + blur 12 로 |
| 층 | 붙는 헤더 68(z 1000+) · 구역 내비 top 68 · 곁단 붙음 top 100~155 · 그림자 4건뿐 | 그림자 토큰 링 유지 · 떠 있는 층만 `--sh-overlay` |
| 빈 상태 · 오류 · 404 | 가운데 소품(UFO) · 세리프 제목 · 알약 | `ui/SpotState` → 서가 빈 상태 · 읽기/보관함 빈 상태 · 전역 오류 · 404 |

곁일: 조사 오류 「스크립트을/이」 5곳(약관 · 스크립트 퀴즈 2 · 이어하기 카드 · 읽기 빈 상태) — 파일별 가드만 있어 재발했다 → 저장소 전역 가드 `components/__tests__/korean-particle.test.ts`. 삽화 이름 ↔ 파일 가드 `illustration-files.test.ts`(생성 한도로 일부가 빠져도 깨진 그림이 새지 않게). 새 공개 상호작용(색 탭)의 계측 이벤트는 funnel 허용 목록(DB CHECK) 마이그레이션이 필요해 붙이지 않았다 — 승인 대기.

## 15. 「왜 아직 보라인가」 2차 진단 — 캔버스 토큰 (2026-09-21)

DOM 실측(화면 격자 20px 마다 가장 위 칠한 바탕 · 글자 · 테두리)으로 보라가 **어느 층**에서 오는지 갈랐다. 원인은 면·삽화가 아니라 **페이지 바탕**이었다 — 앱 화면은 `--bg2` 를 캔버스로 쓰는데 스킨이 그것을 참조의 라벤더 보조색 `#f5f2fb` 로, 중립 칸 `--bg3` 을 `#ece8fd` 로 옮겨 두었다. 참조의 캔버스는 크림 `#fcf9f5`(72페이지 · 면적 1위)이고 중립 칸은 웜 `#f8f4f0` · `#f3efea` 다.

| 화면 | 보이는 면적 중 보라 바탕 (전 → 후) |
|---|---|
| `/library/books` | 83% → 5% |
| `/hub` | 58% → 10% |
| `/wordvault` | 53% → 4% |
| `/practice` | 74% → 18% (진한 보라 강조 카드) |
| `/dashboard` | 72% → 16% (라벤더 카드 1) |

조치: 스킨 `--bg2 #f8f4f0` · `--bg3 #f3efea`(보라 글자 대비 5.07~7.26). 연보라가 필요한 자리는 `--tint-lavender` 로만. 글자는 여전히 보라 ~100% 인데 참조도 보라 계열 ~95%(`#5d38ae` 84% · `#4d3e78` · `#542f9c`) + 진한 면 위 크림이다 — 글자는 원인이 아니다.

## 16. 우리 화면 코퍼스 — 79화면 · 117회, 참조 151페이지와 같은 기준 (2026-09-21)

> 출처 [`refs/ours-corpus-summary.md`](../refs/ours-corpus-summary.md) — `scripts/design/ours-corpus.mjs`(검증 계정 · 정적 77 + 동적 6 · 주요 40화면은 390 도). 다시 재면 표가 새로 쓰인다.

§15(캔버스 교정) 뒤에도 「보라만 보인다」의 원인은 **보라가 많아서가 아니라 다른 색이 없어서**였다 — 캔버스가 무채가 되자 남는 색이 글자 · 테두리 · 버튼의 보라뿐이었다. 학습 화면 대부분이 그림 0 · 보라 외 색 0%.

| 지표 (학습자 화면 평균) | 처음 | 셸 적용 뒤 | 참조 |
|---|---|---|---|
| 보라 바탕 % | 4 | 5 | 칠한 면 중 11 |
| **보라 외 색 바탕 %** | **2** | **8** | 칠한 면 중 12 |
| 화면당 tines 삽화 파일 | 1.7 | 13.9 | — |
| 소품(40–180px) / 화면 | 0.7 | 1.5 | 7.8 |
| 카드 그림 / 화면 | 2.2 | 2.2 | 2.6 |

조치(화면 40여 곳을 하나씩 고치지 않고 셸 두 곳 + 공용 틀):
- `lib/design/route-art.ts` — 경로 → 타일 · 소품 · 범주 색 한 곳.
- **사이드바 아이콘 → 모듈 색 타일 썸네일**(28px / 하위 20px). 참조 앱 레일도 항목마다 색 아이콘이다.
- **`layout/ModuleBanner`** — 경로의 범주 색 면 + 진한 면 타일 + 소품 머리띠. 문구는 사이드바 흐름 단계 이름 · 한 줄(`says`)을 그대로. 세션 · 본문 · 이미 그림 머리가 있는 화면은 스스로 빠진다. 서가는 구역 탭 아래(`slot="library"`).
- **구역 내비 막대 = 경로 범주 색**(서가: 도서 초록 · 기사 살구 · 단어장 분홍 · 교재 라벤더 / 만화 노랑) — 보라 바탕 출처 1위였다.
- 따로 만든 빈 상태 5곳 → `SpotState`(스크립트 퀴즈 · 받아쓰기 · 내 책 · 단어 둘러보기 2 — 그중 하나는 버튼 40px, 하한 미만이었다).

남은 차이: 소품 1.5 ↔ 7.8. 참조의 소품은 목록 행 · 카드 구석 · 사람 사진 · 로고가 채운다 — 우리 목록 행(도서 · 단어장 · 기사 카드)에 범주 소품을 넣는 것이 다음 단계다. 생성 한도 소진으로 새 그림 없이 기존 소품 26점으로 채워야 한다.
