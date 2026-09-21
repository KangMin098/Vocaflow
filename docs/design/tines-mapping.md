# 참조 사이트(Tines) 구간 → Vocaflow 화면 매핑

> 2026-09-21 · 작성 Claude Code · DD-68(「가장 닮음」 1단계)의 적용 지도.
> **사실의 출처**: 참조 쪽은 생성물 [`refs/tines/sections-summary.md`](refs/tines/sections-summary.md)
> (`scripts/design/extract-sections.mjs` — 33페이지 · 구간 약 200 · 팝업류 6) · 우리 쪽은 저장소의 `page.tsx`·레이아웃(같은 날 확인).
> 이 파일은 **판단**(어느 자리에 대응하나 · 적용 순서)을 적는 사람의 문서다. 참조 수치는 요약 파일이 정본이다.
>
> 상태: ✅ 적용 · ◐ 일부 · ○ 예정 · — 해당 없음(이유를 적는다)

## 0. 한 장 요약

| 층 | 참조 | 우리 대응 | 상태 |
|---|---|---|---|
| 전역 틀 | 알약 내비 + 메가메뉴 3 + 검색 모달 + 모바일 서랍 + 71링크 푸터 + 쿠키 배너 | 공개: `components/marketing/site/*`(랜딩 + `(marketing)/layout.tsx` 공통) · 학습자: `Sidebar` · `MobileTabBar` | ✅ 공개 화면 (검색 제외) |
| 공개 화면 | 홈 · 제품(3B) · 솔루션 · 산업 · 요금제 · 고객 · 도서관 · 블로그 · 이벤트 · 대학 · 법률 · 404 | `/` · `/about` · `/fit` · `/pricing` · `/library/*` · `/comics` · `/video` · `/teacher` · `/terms` · `/privacy` · `not-found` | ◐ `/` 만 |
| 앱 화면 | 제품 액자 안의 앱 UI(좌측 공간 목록 · KPI 줄 · 도넛 · 표) — `refs/tines/app-measured.json` | `/hub` · `/dashboard` · 학습 셸 | ○ |
| 삽화 | 꽃밭 · 사물 소품 · 격자 무대 | `public/illustrations/tines/` 7점(Qwen 생성) | ◐ 랜딩용 7점 |

## 1. 전역 틀 · 팝업류

| # | 참조 구간(컴포넌트) | 무엇인가 | 우리 대응 | 상태 | 메모 |
|---|---|---|---|---|---|
| C1 | `SiteNav26` 헤더 | 로고 · 알약 내비 5 · 로그인/가입 · 대문자 CTA · 검색 원 | `SiteHeader` — 랜딩 + `(marketing)/layout.tsx` 공통 | ✅ | 2026-09-21 |
| C2 | 메가메뉴 Product (1440×310, 링크 4) | 큰 기능 카드 1 + 작은 카드 2 + 오른쪽 옅은 카드 | 「학습」: 난이도 진단(큰 카드) · 보관함 · 간격 복습 + 연습 목록 | ✅ | `nav-data.ts` |
| C3 | 메가메뉴 Solutions (1440×279, 묶음 4) | 「BY FUNCTION」 색면 카드 2 + 「BY INDUSTRY」 아이콘 목록 | 「서가」 읽을 것: 도서 · 복원 만화 / 대상: 수능 · 단어장 · 교사 | ✅ | |
| C4 | 메가메뉴 Discover (1440×411, 링크 6) | 글 카드 + 이벤트 카드 + 커뮤니티 카드 + 목록 | 「알아보기」: 영상 · 소개 + 요금제 | ✅ | 우리 블로그·이벤트는 없다 — 있는 것만 |
| C5 | `GlobalSearch` 모달 (전면, 입력 1) | 사이트 전역 검색 | **없음** — 검색은 서가 안에만 있다 | ○ | 서가 검색을 전역으로 올릴지 결정 필요(기능 추가) |
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
| 제품 `/3b/` | 히어로 → 소개 → 영상 3열 → 탐색 → **벤토 3회(6–9칸)** → 코다 → FAQ → CTA | `/about` (기능 개관) | ○ |
| 솔루션 `/solutions/it/` | `SolutionHero`(2열 + 그림) → 문제 서술 → 기능 2열(그림 6) → 「Dive into the details」 5–6열 카드 → 2열 → CTA | 대상별 소개: 수능 `/csat` · 교사 `/teacher` | ○ |
| 산업 `/public-sector/` | 히어로 2단 → 층층 제품 그림 → 3열 → 가운데 인용 → 2열 → 예시 → 협력사 8열 → 4열 → 폭발 CTA | 교사 · 학교(B2B) 소개 | ○ |
| 요금제 `/pricing/` | (보라 전면) 요금 카드 2 → 인용 격자 → 배지 줄 → FAQ 5 → CTA | `/pricing` | ○ |
| 고객·사례 `/customers/` | 9열 필터 → **책 모양 사례 카드**(`CaseStudyBookCard`) 격자 → CTA | `/library/books` (진짜 책 표지 격자) | ○ |
| 사례 상세 `/case-studies/r3/` | 하이라이트 수치 히어로 → 2열 본문(곁단) → 더 보기 3열 → CTA | 도서 상세 `/library/books/[id]` | ○ |
| 도서관 `/library/` | 이야기 격자 → 임베드 3열 → How it works → (눈썹 머리 + 모음 격자) ×4 → 도구 12열 → 공동체 격자 → 제출 CTA | `/library` 허브 · `/library/vocab` · `/comics` | ○ |
| 도서관 상세 | `LibraryTable`(그림 23) | 단어장 상세 `/library/vocab/[id]` | ○ |
| 블로그 `/blog/` | 대표 글 카드 → 발췌 → 글 카드 → 뉴스레터 폼 → CTA | `/video` (목록) | ○ |
| 글 상세 | 본문(`Article`, 영상) → CTA | `/text/[id]` 읽기 · `/video/[id]` | ○ |
| 이벤트 `/events/` | 세계 지도(펼침) → 디렉터리(필터 폼, 그림 33) → 뉴스레터 → CTA | 필터 디렉터리 패턴 → `/library/books` 필터 · `/csat` 문항 목록 | ○ |
| 대학 `/university/` | 히어로 → 과정 격자(그림 53) → 라이브러리 → 부트캠프 → CTA | 학습 경로 `/plan` · `/diagnostic` | ○ |
| 팟캐스트 `/podcast/` | 시즌별 2열 목록 ×6 | `/video` 시리즈 묶음 | ○ |
| 역량 표 `/workflow-capability-matrix/` | 점 격자 → **조작 다이얼**(펼침·폼) → 14열 표 → CTA | `/fit` · `/diagnostic`(조작해서 결과 보기) | ○ |
| 긴 이야기 `/history-and-future-of-workflows/` | 시대별 22구간 · 그림 · 인용 폼 | — | — 한 번짜리 캠페인 페이지. 필요할 때 |
| 법률 `/legal/` · `/privacy/` | 펼침 목록 · 긴 글 | `/terms` · `/privacy` | ○ (서체·색만) |
| 404 | 그림 1 + 검색 입력 | `app/not-found.tsx` | ○ |
| 채용 · 파트너 · 뉴스룸 · 웨비나 · 보안 | 가치·복지·공고 목록 · 협력사 · 보도 · 등록 폼 · 준수 목록 | — | — 해당 사업이 없다 |

## 3. 구간 패턴 카탈로그 (재사용 부품 후보)

| # | 패턴 | 참조 예(컴포넌트 · 페이지) | 구조 | 우리 부품(만들 것) · 쓸 화면 | 상태 |
|---|---|---|---|---|---|
| P1 | 왼쪽 정렬 큰 제목 히어로 | `ThreeBHero` (홈 · 3B) | 배지 · 64px 2줄 · 세리프 부제 · 알약 CTA 2 · 증거 띠 | `/` | ✅ |
| P2 | 2열 히어로 + 그림 | `SolutionHero` (솔루션 · 산업) | 눈썹 · 제목 · 부제 · 오른쪽 그림 | `/about` · `/teacher` · `/csat` · `/pricing` | ○ |
| P3 | 폭 전체 삽화 + 겹치는 제품 액자 | `ThreeBHundredXBanner` + `ThreeBProductVisual` | 그림 위로 라벤더 이중 테두리 액자 | `/` (CoverageHero) | ✅ |
| P4 | 가운데 선언문 | `HomeMonitorBanner` | 모노 눈썹 · 굵은 세리프 · 세리프 문단 · 양옆 그림 | `/` · `/about` | ✅ |
| P5 | 보라 통판 | `HomeSolutionSection` | 흰 제목 · 2×2 세리프 항목 · 아래 꽃밭 · 흰 알약 | `/` · `/pricing` | ✅ |
| P6 | 색면 탭 + 제품 패널 | `HomeUseCasesSection` (탭 5) | 색면 탭 5 → 누르면 아래 패널 전환 | `/` 모듈 5 — **지금은 정적 카드**(탭 전환 없음) | ◐ |
| P7 | USP 카드 줄 | `HomeUSPSection` (4열, 그림 4) | 보라 카드 · 세리프 문장 · 구석 소품 | `/` 문 카드 2 | ◐ |
| P8 | 벤토 격자 | `ThreeBBentoSection` (6–9칸, 3회) | 크기 다른 칸 · 그림 · 짧은 문장 | `/about` 기능 개관 · `/hub` 요약 | ○ |
| P9 | FAQ 펼침 | `ThreeBFaqSection` · `PricingFaqSection` (펼침 5) | 질문 행 · 펼치면 답 | `/pricing` · `/fit` | ○ |
| P10 | 요금 카드 | `PricingPlanCards` (2) | 보라 전면 위 카드 2 | `/pricing` | ○ |
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
| P22 | 점 격자 무대 | `DotGridPattern` · `GridCanvas` | 12px 점 · 24px 선 격자 바탕 | 도구·진단 화면 바탕 | ○ |

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
