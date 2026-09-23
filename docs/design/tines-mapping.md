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
| 앱 화면(3B 제품) | 공간 화면(좌측 레일 · 무늬 띠 + 명령 상자 · 탭 · workflow 표 · 펼친 카드 넷) | **`/csat/space`** — `SpaceScreen.tsx` · `space-model.ts` | ✅ 2026-09-23 (§4-1) |
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
| 솔루션 `/solutions/it/` | `SolutionHero`(2열 + 그림) → 문제 서술 → 기능 2열(그림 6) → 「Dive into the details」 5–6열 카드 → 2열 → CTA | 대상별 소개: 수능 `/csat`(「기출 홈」 절) · 교사 `/teacher` | ◐ |
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

### 4-1. 3B 공간 화면 → `/csat/space` (2026-09-23 · DD-73)

§4 위의 표는 **마케팅 페이지 히어로 안의 앱 목업**이 출처다. 그것 말고 제품 자체(3B)의 공간 화면이 있고,
그 골격은 히어로 목업과 다르다 — 레일 · 무늬 띠 · 명령 상자 · 탭 · **한 줄이 한 작업인 표**다.
그 골격을 통째로 옮긴 것이 `/csat/space` 이고, 대응은 아래와 같다.

| 참조(3B 공간 화면) | 우리 대응 | 메모 |
|---|---|---|
| 좌측 레일: Recents · Favorites · Chat · Personal workflows / Monitoring · Links · Connectors · Skills / Spaces(# General) | 기출 홈 · 오늘의 해부 · 내 공식 / 유형 · 함정 · 예시 있는 것만 · 최근만 / 회차 29 | 없는 기능은 만들지 않았다 — 링크는 **있는 라우트**만이고 나머지는 실제로 거르는 토글이다 |
| 히어로 무늬 띠(겹친 원 · 돔 · 네모별 · 화면마다 다른 팔레트) | `PatternBand` — 원 하나 = 표의 한 줄, 지름 = 그 줄의 양 | 참조는 그림, 우리는 **표의 그림자**. 탭을 바꾸면 팔레트와 무늬가 함께 바뀐다(참조도 화면마다 다른 팔레트를 쓴다) |
| 명령 상자 두 장(뒷장 질문 + 앞장 입력 · Plan 칩 · 보내기 단추) | 같은 두 장. 입력은 **실제로 거르는 찾기**이고 칩 둘은 축 토글이다 | 참조는 AI 에게 시키는 자리다. 안 되는 것을 되는 것처럼 그리지 않는다 |
| 탭 `Workflows 1` · `Links 3` + 오른쪽 `Leaderboard` | `유형 26` · `함정 32` + 오른쪽 `채움 현황` | 개수는 **거른 뒤**의 수다 |
| 표: 이름 + `● Live · ⑂ 1 branch · Last updated` / Connectors / Trigger / Created / Created by | 이름 + `● 출제 중 · 문항 · 오답` / 갖춘 것 / 걸친 범위 / 최근 / 예시 기출 | 참조의 「누가 만들었나」 자리에 **실제 기출 한 문항**을 둔다 |
| 상세 화면 바닥의 색 카드 넷 | 줄을 펼치면 나오는 카드 넷 | 화면을 하나 더 만들지 않고 같은 판 안에서 편다 |

**옮기지 않은 것**: 참조 상세 화면의 Readme/Monitor/Runs/Links/Browser 탭과 왼쪽 대화 패널. 대응하는 우리 자산이
없다(실행 기록도 대화도 이 도메인에 없다) — 빈 껍데기를 그리면 그 자리가 영영 거짓말로 남는다.

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

> 출처 [`refs/ours-corpus-summary.md`](refs/ours-corpus-summary.md) — `scripts/design/ours-corpus.mjs`(검증 계정 · 정적 77 + 동적 6 · 주요 40화면은 390 도). 다시 재면 표가 새로 쓰인다.

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

## 17. 목록 · 빈 상태 마무리 (2026-09-22)

- 단어장 사다리(1~7단) 칸마다 옅은 면 순환(`TINT_ROTATION`) — 면 안 글자는 그 색상. 내 단계는 테두리 + 링 + 「지금」 + `aria-current`.
- 기사 「먼저 이걸로」 카드 구석에 `tile-articles`(참조 사례 카드 구석 타일).
- 따로 만든 빈 상태 5곳 더 → `SpotState`: 이어하기 카드 · 도서 필터 0건(「필터 초기화」 누르는 높이 44 미만이었다) · 교재 필터 0건 · 교사 클래스 없음 · 내 서재 캐러셀. 남은 점선 상자는 빈 상태가 아니다(도서 상세 펼침 안내 한 줄 · 드롭존 · 계획 안내 · 교사 다음 단계 안내).
- 코퍼스 평균은 그대로(보라 외 색 8% · 소품 1.5) — 이번 변경은 첫 화면 아래이거나 검증 계정에서 안 뜨는 빈 상태라 첫 화면 측정에 잡히지 않는다.

## 18. Kaggle 무료 GPU 삽화 경로 + 목록 소품 (2026-09-22)

DashScope 무료 한도(100장)를 다 써서 **Kaggle T4 + Qwen-Image GGUF Q3 + Lightning 4-step**(ComfyUI headless 스크립트 커널, 주 30 GPU시간 무료)으로 옮겼다. 실증 레시피는 8월 만화 파이프라인(`scripts/comic/kaggle/_gen-kernel.py` · 메모리 project-comic-free-backend) 그대로.

- `scripts/design/lib/illo-tines-scenes.mjs` — 화풍 · 장면 · 후처리(`keyAndEncode`) **단일 출처**. DashScope(`illo-tines-gen.mjs`)와 Kaggle(`illo-kaggle.mjs`)이 같이 읽는다 — 한쪽만 고치면 두 경로 그림이 갈린다.
- `scripts/design/illo-kaggle.mjs` — 커널 소스 생성 → push(`machineShape: NvidiaTeslaT4` 강제 · 모델 Dataset `minkang123/vocaflow-qwen-comic` 연결, 다운로드 0) → status 폴링 → output PNG → 같은 바탕 빼기 + WebP. 키는 `~/.kaggle/kaggle.json`(저장소 밖). 재실행 안전(없는 장면만).
- 4회차 소품 18: 기사 주제 6(라디오 · 그림책 · 망원경 · 말풍선 · 막대그래프 · 지구본) · 단어장 분류 8(답안지 · 학교 · 가방 · 크레용 · 증서 · 뿌리 · 서류가방 · 지도) · 설정 · 그리고 한도로 못 만든 404(떠오르는 책) · 환영 · 달력.
- **4스텝 Lightning 은 cfg=1 이라 부정 프롬프트가 안 먹는다** — 금지어를 긍정문에 넣으면(「no card or panel」) 오히려 그 형태를 그렸다(9장 전부 카드 바탕). 그래서 `--variants N`: 장면마다 시드 N개 → 바탕을 뺀 뒤 **투명 비율 최고**를 자동 선택(카드가 깔린 결과가 탈락). 9장 재생성 7장 통과 · 서류가방은 두 번째 물건을 빼고 4후보 → 통과 · 답안지는 반복 실패(글자 · 카드)라 장면에서 빼고 DashScope `spot-quiz` 로 대체.
- 배치: 기사 「다른 주제로 읽기」 행마다 주제 소품(44px, 참조 목록 행 아이콘 자리) · 단어장 분류 격자 칸의 낙관 → 소품(소품 없는 전체 · 유아 · 공무원은 낙관 유지) · 404 → spot-lost.

## 19. 상단 메뉴 재설계 — 참조 메가메뉴 3종 (2026-09-22)

사용자 스크린샷(Product · Solutions · Discover)의 골격을 **데이터 + 레이아웃 셋**으로 옮겼다. `nav-data.ts` 가 메뉴마다 `layout` · 카드 면(`CardTone`: deep-* 원색 / 옅은 틴트) · 그림(`illo` 소품 · `image` 머리 그림) · 화살표(`→` 안쪽 · `↗` 다른 구역)를 갖고, `SiteHeader` 가 그대로 그린다(검색이 읽는 `cards` · `list` 는 그대로).

| 우리 메뉴 | 참조 | 골격 |
|---|---|---|
| 학습 | Product | 진한 보라 틀: 큰 카드(난이도 진단 · 가운데 소품 · 아래 꽃밭 띠) + 작은 카드 3 세로(보관함 · 복습 · 퀴즈, →) · 떨어진 라벤더 카드(받아쓰기) |
| 서가 | Solutions | 라벤더 틀 모노 눈썹 「자료별」 + 원색 카드 3(도서 초록 · 만화 주황 · 단어장 자홍, 구석 소품 · →) · 떨어진 살구 패널 「대상별」(수능 · 교재 · 교사 — 소품 칩 + 제목 + 한 줄) |
| 알아보기 | Discover | 라벤더 열(패턴 머리 + 소품 카드 「영상」 + 행 「소개」) · 초록 열(「요금제」 카드 + 행 가입 · 로그인) · 주황 원색 카드(학급으로 쓰기 · 둥근 소품 · ↗) |

그 밖에: **공지 띠**(참조 「NEW! … [Get the guide]」 — 짙은 보라 · 크림 · 흰 알약, 띠 전체 44px 링크 → `/fit`) · **모바일 서랍** = 반투명 라벤더 알약 아코디언(`<details>`, 스크립트 없이 열림) + 로그인·가입 반반 알약 + CTA 둘 · 메뉴 그림은 `loading="eager"`(닫힌 패널 안 지연 로딩이 열린 직후 빈칸을 만들었다).

## 20. 꽃무늬는 홈 전용 — 남은 장면 교체 · 끝 CTA (2026-09-22)

- **끝 CTA = 흩어진 물건 띠**(`site/ScatterCta` — 참조 「Built by you, powered by Tines」): 폭 전체 `band-scatter` 한가운데 크림 카드(로고 · 세리프 제목 · 알약 둘 · 「이미 계정이 있나요? 로그인」). 공개 레이아웃 꼬리(`MarketingTail`)가 쓴다. 꽃밭 CTA(`FlowerCta`)는 지웠다 — 랜딩은 자기 꽃밭 구간을 따로 갖는다.
- **머리 타일**: `/video` 꽃 장면 → `tile-video`(영사기, 보라) · `/about` 영상 없을 때의 대체 그림 → `tile-about`(전구 꽂힌 책, 초록). Kaggle 생성.
- Kaggle 타일은 안쪽에 둥근 테두리 액자를 한 겹 더 그린다(앱 아이콘 모양) → `illo-kaggle.mjs` 후처리가 `tile-*` 를 사방 10% 잘라 면이 가장자리까지 차게 한다.
- 안 쓰게 된 2회차 꽃 장면 · 카드 머리 9점 삭제(scene-hub · 404 · library · comics · csat · teacher · video · card-books · card-vocab)와 생성기 목록에서 제거(남기면 다시 만든다).
- 단어장 표지 넘기기의 분류 탭에도 분류 소품(24px) + 알약 모양.

## 21. 플랫폼 메인 `/hub` — 참조 홈 골격 (2026-09-22)

1회차(같은 날)는 포털 문법(자동 넘김 배너 · 원형 바로 가기 · 크기 다른 칸 격자)이었고 참조에는 그런 구간이 없다. 참조 홈 캡처 8장 · `components-summary` · `dna` 를 다시 읽고 띠 순서를 그대로 옮겼다.

| 참조 구간 | 실측 | `/hub` |
|---|---|---|
| ThreeBHero | NEW 알약 · 64px/400 · 세리프 부제 · 알약 둘 | 같은 자리 — 첫 알약은 셸 나침반의 「지금」 CTA(오늘 정의 하나) |
| 고객 로고 줄(흐름) | 양 끝 잘림 · 자동 흐름 | `TitleMarquee` — 발행된 고전 제목(세리프) · 멈춤 단추 · reduce 에서 정지 |
| ThreeBProductVisual | 라벤더 이중 테두리 · 레일 · KPI 줄 · 도넛 · 표 · 그림자 0 | `ProductFrame` — 오늘의 흐름 레일 · KPI 4 · 기억 4색 도넛 · 7일 예보 분절 막대 · 새 고전 표 |
| HomeUseCasesSection | 색 탭 5 · 고른 탭 색이 패널로 | `ToneTabs` — 서가 · 만화 · 수능 · 아케이드 · 단어장(패널 안 실물 표지 · 목록) |
| HomeSolutionSection | 보라 통판 · 모서리 48px · 2×2 세리프 굵은 제목 | 제목 = DB 서가 규모 · 가치 넷 · 왼쪽 아래 삽화는 **플랫폼 타일**(꽃밭은 §20 랜딩 전용) |
| HomeUSPSection | WHY 눈썹 · 보라 카드 4 · 굵은 첫 문장 + 소품 | 진단 · 기억 4색 · 듣기 · 학급 |
| 끝 CTA | — | §20 흩어진 물건 띠 + 크림 카드(학습자 알약) |
| 공통 | 구획 156px · 눈썹 모노 13/700 · 제목 56/400 · 부제 세리프 24/400 | `sections.tsx` 의 `KICKER` · `SectionHead` |

## 21. 참조 홈 확대 대조 — 대표 표현 다섯 이식 (2026-09-22)

수치(색 · 그림 수)를 맞춘 뒤에도 「스타일이 모자라다」 — 참조 홈과 우리 랜딩을 1280 으로 나란히 찍어 **구간 구조는 같은데 참조를 특징짓는 표현이 없다**는 것을 확인했다. `components/marketing/signature.tsx` 로 다섯을 옮겼다.

| 참조 | 우리 |
|---|---|
| 히어로 아래 **꽃무늬 채움 거대 글자** 「100×」 + 걸친 **리본**(100× FASTER · SIMPLER · EASIER TO ADOPT) | `PatternWord` 「아는 비율」(hero-book-field 로 채움, 26vw/300px · 800) + `Ribbon` 셋 — 로그인 없이 · 문맥 그대로 · 간격 복습 FSRS |
| CTA 아래 **고객 로고 흐름 띠** | `SourceMarquee` — 로고를 지어내지 않고 **실제 콘텐츠 출처 이름 15**(도서 수집 · 기사 트랙 소스). 서체를 돌려 로고 줄 리듬, 움직임 줄이기면 멈추고 줄바꿈 |
| 제품 액자 위 **탭 이름표 + 재생 막대** | `FrameBar` 「이 글, 지금 재 보는 중」 |
| 선언 구간 좌우 **선화 모니터 무리**(무늬 화면 · 안테나 · 덩굴) · **같은 세리프로 앞 문장 가늘게 / 뒷 문장 굵게** | `MonitorCluster`(kaleido 무늬 45% · 라벤더 액자 · 안테나 · 초록 덩굴) · 제목 300/800 두 굵기(Hahmlet 800 추가) · 모노 눈썹 · 가운데 소품 |
| 마감 **「Start today」 보라 모자이크 채움 거대 글자** | `PatternWord` 「오늘 읽을 글부터.」(pattern-kaleido-1) |

`.pattern-text`(globals.css) 는 background-clip:text 를 지원할 때만 글자를 투명하게 하고, 지원하지 않거나 고대비 모드면 보라 글자로 남는다.

## 22. 소개(/about) ↔ 참조 제품 페이지(3B)

같은 폭(1280)으로 나란히 찍어 대조했다. 이전 /about 은 공용 `Hero2Col`(왼쪽 글 · 오른쪽 영상)이라 **참조 제품 페이지 상단의 네 겹**이 없었다.

| 참조 3B | 우리 |
|---|---|
| 머리 아래 **라벤더 면 전체**(히어로 ~ 탐색 구간까지 한 면) | `tone-lavender` 한 겹이 구역 막대 ~ 「알아보기」 구간을 감싼다 |
| **구역 막대** — 왼쪽 제품명 알약 · 오른쪽 링크 + GET STARTED 알약 | 「소개」 알약 · 영상 / 요금제 / 지문 진단 · 「시작하기」(모노 대문자 알약) |
| 히어로 오른쪽 **반투명 고객 인용 카드 + 아래 꽃밭** | 추천사를 지어내지 않는다 → **연구 근거 카드**(Karpicke & Roediger 2008 · Science, 출처 명기) + 카드 아래로 꽃밭(bed-flowers, 카드 뒤로 80px 파고든다) |
| 폭 전체 영상 위 **장 이름표 + 재생 막대** | `FrameBar` 「Vocaflow 소개」 + 폭 전체 소개 영상(없으면 tile-about) |
| 「EXPLORE」 **문단형 세리프 제목**(앞 문장 굵게, 뒤는 같은 크기 보통) + 오른쪽 모니터 무리 | 「Vocaflow 알아보기」 · 800/400 두 굵기 문단 · `MonitorCluster side="right"` |

카드에 backdrop-blur 를 두면 뒤 꽃밭이 번져 얼룩이 된다 — 카드는 불투명 혼합색(bg 60% + 라벤더)으로 두고 꽃은 카드 **아래**에 둔다.

## 기출 홈 `/csat` — 솔루션 템플릿 (2026-09-22)

> 번호 없는 절 — 여러 세션이 같은 날 절 번호를 동시에 매겨 20 · 21 · 22 가 겹쳤다. 이 절은 이름(「기출 홈」)으로 가리킨다.

사용자 스크린샷 셋(솔루션 「Dive into the details」 · 산업 히어로 + 색 탭 · 제품 카드 + What's new)의 골격을 **화면 용도별로** 옮겼다. 학습자 홈이라 참조의 전환 CTA 자리에 「오늘의 해부 시작」이 온다.

| 구간 | 용도 | 참조 부품 | 우리 |
|---|---|---|---|
| ① 히어로 | 오늘 할 일 한 번에 | `SolutionHero` 2열 + 제품 카드(Storyboard — 면 · 안쪽 액자 · 구석 아이콘 타일) | 눈썹 알약 · 세리프 h1 · 1차/2차 알약 · 이어하기 공지 알약 / 분홍(기출 범주) 카드 안 액자에 세 단계 노드 + tile-csat |
| ② 증명 | 「다른 지문, 같은 설계」를 보여 준다 | 「Smart, secure workflows」 세로 색 탭 + 패널(고른 탭이 패널로 이어지는 꺾쇠) | 패턴마다 면 색 탭(문항 수) · 패널 머리 = 그 색 · 몸 = 비교 구조도 |
| ③ 방법 | 네 단계를 한눈에 | 「Dive into the details」 진한 면 타일 카드 + 두 줄 띠 + 옅은 이름 칸 | 예측 tile-quiz · 설계 읽기 tile-read · 전이 tile-articles · 패턴 축적 tile-textbooks |
| ④ 기록 | 어디까지 읽었나 | 제품 카드 3열(면마다 다른 색) | 패턴 색 카드 · 문항 행(기호 + 상태 글자) · 「이 원리로 해부하기」 |
| ⑤ 탐색 | 궁금한 문항부터 | 이벤트 디렉터리(왼쪽 필터) + What's new 목록(행 소품 타일 · 「범주 | 날짜」) | 붙는 왼쪽 필터 · 행 = 패턴 색 소품 타일 + 세리프 제목 + 「패턴 | 회차 · 번」 |

- 색 규칙: 패턴 순서대로 `TINT_ROTATION`(라벤더 · 초록 · 살구 …) — ②④⑤가 같은 표를 읽는다(`patternTone`). 오늘 카드는 기출 범주 색(분홍)이라 패턴 색과 겹치지 않는다.
- 한글 눈썹에 모노를 쓰지 않는다 — 모노는 한글 사이를 벌려 「오늘의  해부」가 된다(참조의 모노 대문자는 영문 전용).
- 셸 머리띠(`ModuleBanner`)는 `/csat` 에서 빠진다(`route-art.ts` NO_BANNER) — 히어로가 그림을 가진다.
- 확인: 1440 · 390 × 라이트 · 다크 axe 위반 0 · 가로 넘침 0 · 1440 시작 버튼 y 300 · 탭 전환 · 필터 빈 상태.

**내 공식 `/csat/formulas`** — 참조 사례 상세(하이라이트 수치 히어로 → 본문) 골격: 히어로(눈썹 알약 · 세리프 h1 · 오른쪽 spot-vault) → 강조 수치 3칸(라벤더 공식 수 · 초록 적중률 · 살구 함정 계열 커버리지 + 막대 — 390 에서도 3열) → 유형별 계보 카드(`details open` · 공식 행 펼침 · 출처 알약 · 「이 공식으로 해부하기」). 빈 상태는 `SpotState`(empty-vault). 셸 머리띠 제외 · 판면 60rem. 확인: 1440 · 390 × 빈/채움 × 라이트/다크 axe 0 · 넘침 0(채움은 기기 저장소에 표본 기록을 넣고 찍은 뒤 지웠다).

**2회차 — 참조에 더 가깝게(사용자 요청 「최대한 tines 스타일」)** — 스크린샷 셋과 구간을 하나씩 대조해 고쳤다.

| 참조 | 1회차 | 2회차 |
|---|---|---|
| 산업 히어로: 가운데 · 모노 대문자 눈썹 · 가는 세리프 · 양옆에 흩어진 물건 | 2열 왼쪽 정렬 | 가운데 · `CSAT · DISSECT`(영문만 모노) · 400 세리프 · 소품 4개 기울여 흩음(900px 이상) |
| 「High stakes…」 가는 줄 사이 2열 선언 | 없음 | 선언 구간 추가 |
| 제품 카드 안쪽 액자가 오른쪽 · 아래 가장자리로 흘러나감 · 점 격자 | 카드 안에 갇힌 액자 | 액자를 가장자리 밖으로 · 점 격자 · 노드를 가운데 |
| 색 탭 패널 = 고른 탭 색 면 · 안에 UI 액자 | 크림 패널 | 패널 면 = 패턴 색(`--tone`) · 안쪽 크림 액자는 기본 글자색(면 클래스를 쓰면 도식 글자까지 물든다) |
| 「Dive into the details」 좁은 격자 · 작은 산세리프 이름 | 넓은 카드 · 세리프 | 880px 격자 · 정사각 그림 · 15px 산세리프 |
| 「What's new」 머리 · 목록을 한 테두리 안에 · 끝에 가로 전체 외곽선 알약 · 행 화살표 없음 | 머리가 카드 밖 | 한 카드 · 필터 중일 때 「전체 N문항 보기」 알약 · 화살표 제거 |

- **패턴 소품 8**(Kaggle 6회차 · `lib/csat/pattern-art.ts`): 부정문 반대 이정표 · 재진술 메아리 말풍선 · 주장과 사례 큰 카드 + 작은 카드 셋 · 원인과 목적 과녁 · 결과와 조건 열쇠와 자물쇠 · 방향과 문법 나침반 · 조건과 거래 저울 · 양보와 대조 시소. 목록 행 · 패널 머리 · 지도 카드 머리가 같은 소품을 쓴다(없는 형식은 spot-reading).
- **Kaggle 커널 충돌**: 두 세션이 같은 커널 이름을 쓰면 나중 push 가 앞 실행을 덮는다(이번 16장이 다른 세션의 타일 4장으로 바뀌어 「후처리 0장」으로 조용히 끝났다). `illo-kaggle.mjs` — push 전 같은 커널이 돌고 있으면 멈춤 · 받은 출력이 요청과 하나도 안 맞으면 실패 · `--slug` 로 커널을 나눔(제목도 slug 에서 — 같은 제목은 409).
- 확인: 1440 · 390 × 라이트 · 다크 axe 0 · 넘침 0 · 삽화 404 0 · 탭 전환 · 필터 빈 상태 · 1440 시작 버튼 y 256.

## 23. 요금제(/pricing) ↔ 참조 요금제

같은 폭으로 대조했다. 이전 화면은 **둥근 보라 판 안** 왼쪽 정렬 제목 + 흰·라벤더 카드 3이었고, 참조의 네 표현이 없었다.

| 참조 | 우리 |
|---|---|
| **폭 전체 보라 띠** · 가운데 큰 제목 · 양옆 기계 소품 + 흩어진 색 막대 | 폭 전체 `bg-[var(--ju)]` 띠 · 가운데 제목 72px · spot-dashboard / spot-quiz + 틴트 막대 8(lg 이상, 장식) |
| 카드 **윗변 가운데 이름표**(EXPLORE · DEPLOY) · 옅은 초록 / 진한 보라 면 · 가운데 정렬 머리 · **버튼 한가운데를 지나는 구분선** · 왼쪽 아래 목록 · **오른쪽 아래 소품** | `PlanCard` + `CardAction` — 지금(tone-green · spot-welcome) · 준비 중(진한 보라 · spot-locked) · 선생님·학원(tone-peach · spot-teacher). 버튼은 면 글자색 채움(`--ju`/`--on-ju`) |
| 카드 아래 **고객 로고 흐름 띠** | `SourceMarquee` — 실제 콘텐츠 출처 이름(`lib/marketing/sources.ts` 로 랜딩과 공유), 글자는 크림 |
| **접힌 모서리 인용 카드**(고객 추천사) | 추천사를 지어내지 않는다 → 이 화면의 **요금 약속**(결제 화면 없음 · 소급 청구 없음)을 같은 카드에 |
| G2 배지 줄 | 없음 — 받은 평가가 없다 |

진한 카드는 보라 띠보다 어두워야 한다. `--deep-purple`(#6956a8)은 띠(#714bd0)와 명도가 거의 같아 묻혀서 카드에서만 `--deep-purple` 을 `color-mix(--p 70%, --deep-ink)` 로 덮는다.

## 24. 앱 구역 머리 ↔ 참조 도서관 머리

참조 도서관(/library)은 **진한 보라 둥근 판** 한 장 안에 눈썹 · 흰 제목 · 부제 · 오른쪽 삽화를 두고, 판 **아랫변에 폴더 탭**
(Featured · All stories 1213)을 붙인다. 고른 탭은 화면 바탕색이라 판 아래 본문과 이어진다. 우리 `AreaHero` 는 크림 바탕 2열이었다.

- `AreaHero` 를 판으로 바꿨다 — 판 색은 `tint` 의 진한 계열(`DEEP_OF`: green → deep-green · peach/yellow → deep-orange · pink → deep-magenta · teal → deep-charcoal · lavender → deep-purple), `deep` 으로 직접 고를 수도 있다. 부르는 곳 넷(도서 · 책 만화 · 옛 만화 · 교사)이 그대로 따라온다.
- 수치 알약은 판 위 크림 14% 면. 타일은 240px(판 높이 ~350px, 참조 410px).
- `tabs` — 판 아랫변 폴더 탭(`data-shape="keep"` 로 알약화 제외). 도서: 둘러보기 / 전체 보기 N(= `?show=all`, 이미 있던 전량 보기 주소). 고른 탭 면은 `--bg2` — 부르는 화면이 `Screen background="bg2"` 여야 이어져 보인다.
- 눈썹은 모노가 아니라 산세리프 굵게 — 모노 대체 서체에 한글이 없어 공백만 모노 폭이 된다.

### 24-2. 서가 넷이 같은 판을 쓴다 (2026-09-23)

참조 도서관은 **모든 하위 서가가 같은 판**을 쓴다. 우리는 도서만 판이었고 기사·교재·단어장이 제각각이었다 — 기사는 아이콘+제목 줄, 교재는 **보이는 제목이 아예 없었고**(sr-only h1), 단어장은 크림 바탕 사다리 머리.

| 화면 | 바뀐 것 |
|---|---|
| 기사(`/library/scripts`) | 아이콘+제목 줄 → 판(deep-orange · tile-articles · 기사 수 · 단어 수) |
| 교재(`/library/textbooks[/series]`) | sr-only h1 → 판 제목(시리즈 브랜드 · 카탈로그의 물음 · 권 수 · 펼칠 수 있는 권). 시리즈 탭은 물음·조판 여부를 달고 있어 판 아랫변으로 접지 않고 그대로 아래 둔다 |
| 단어장(`/library/vocab`) | 크림 머리 → 판(deep-magenta · tile-decks · 전체 · 표제어 · 사다리 · 학령 밖). 학령 사다리는 판 아래 그대로 |

판을 갖게 된 화면은 `NO_BANNER` 에 넣는다 — 머리띠(`ModuleBanner`)와 판이 겹치면 머리가 두 개가 된다.

**390px 에서는 타일을 숨긴다.** 참조는 모바일에서도 큰 그림을 싣고 제품 카드가 첫 화면 밖으로 나간다. 우리 서가는 매대라 그 손해가 실측돼 있다(2026-09-01 단어장 390px: 첫 상품 y=913 · 첫 화면 상품 0개, 시중 앱은 0.29화면 · 3개). 그래서 그림은 sm 이상, 제목은 28 → 38 → 52px. 바꾼 뒤 단어장 첫 상품은 ~450px 로 첫 화면 안에 든다.

## 25. 점 격자 질감 · 항목마다 다른 면 색

참조 도서관의 featured 카드는 **옅은 면마다 다른 색 + 점 격자**다(초록 카드 · 라벤더 카드 · 살구 카드…). 우리 「다른 주제로 읽기」 줄은 다섯 줄 전부 크림 한 색이었다.

- `.dots`(globals.css) — 면 글자색 12% 점 · 12px 간격. `.tone-*` 어느 면에 얹어도 같은 세기다(색을 고정하지 않고 `--t1` 을 섞는다).
- `ScriptsBrowser` 의 `SeriesRow` 가 `TINT_ROTATION` 으로 줄마다 면 색을 돌린다 — 이웃 줄이 같은 계열이 되지 않는다.
- 면 위 상호작용 색도 면을 따른다: 누름·호버는 `--t1` 8% / 14%, 초점 테두리는 `--t1`. 크림 기준 `--bg2`·`--p` 를 그대로 두면 색 있는 면에서 안 보인다.

## 26. 쓰는 법 세 단계 (참조 「How it works」)

참조 도서관 아래쪽에는 **옅은 분홍 패널**이 있다 — 왼쪽에 제목과 한 줄, 오른쪽에 단계 셋(Explore · Import · Adapt)이 물건 하나씩과 이름으로. 순서를 글이 아니라 그림으로 먼저 읽게 하는 자리다.

`/fit`(지문 난이도 진단)에 같은 패널을 넣었다. 이 화면은 **공개 유입의 관문**인데 코퍼스 측정에서 소품 0 · 색 면 0이었다 — 글자만 있는 화면이라 무엇을 하는 곳인지 그림으로 읽히지 않았다.

- `tone-peach dots` 면 · 왼쪽 「세 단계면 끝납니다.」 · 오른쪽 3열(소품 88px + 01/02/03 + 이름 + 한 줄).
- 소품은 단계마다 달라야 한다 — 처음에 1번과 3번이 둘 다 공책·연필이라 구별되지 않았다(붙여넣기 spot-empty-page · 학년 spot-teacher · 결과 spot-dashboard).
- 내용은 화면이 실제로 하는 일만 적는다(가입·설치·저장 없음은 이 화면의 사실이다).

## 27. 학습자 셸 — 왼쪽 레일 → 상단 막대 + 메가메뉴 (2026-09-23)

공개 화면은 §19 에서 이미 참조 막대 + 메가메뉴를 쓰고 있었는데, **로그인 뒤의 셸만 왼쪽 240px 레일**이었다(`components/layout/Sidebar.tsx`). 같은 제품 안에서 내비 문법이 둘이었고, 레일은 1440 에서 가로 17%를 상시 점유하면서 열세 개 주소를 어느 화면에서나 펴 놓고 있었다. 사용자 지시(2026-09-23)로 셸을 하나로 맞췄다.

**IA 는 그대로다.** 항목·주소·순서·`owns` 의 정본은 여전히 `components/layout/sidebar-config.ts` 이고, 새 파일 둘은 그것을 **배치**만 한다.

| 파일 | 하는 일 |
|---|---|
| `layout/top-nav-data.ts` | 설정 → 막대 칸 · 패널(열 · 큰 블록 · 목록 행 · 하단 링크 줄) |
| `layout/AppHeader.tsx` | 막대 + 메가메뉴 렌더. 참조와 같은 동작(올리면 열림 · 누르면 토글 · Esc · 바깥 누름 · 140ms 유예 · `vf-dropdown-in`) |
| `layout/nav-match.ts` | 「지금 어디」 판정 한 벌. 구체성 점수로 **후보 중 하나만** `aria-current="page"` 를 갖는다 |

### 27-1. 1차(v08.6)와 무엇이 달랐나 — 「더 보기」를 없앤 이유

1차는 사이드바의 세로 순서를 그대로 눕혀 **막대에 여덟 칸**(메타 2 + 흐름 5 + 더 보기)을 세웠다. 사용자가 참조 캡처 3장(Solutions · Resources · Company)을 다시 주며 「더 보기로 하지 말 것」을 지시했고, 실제로 두 가지가 문제였다:

- **「더 보기」는 이름이 아니라 남은 것 통이다.** 만화 · 기출 · 학급 · 설정 · 사이트맵이 공통점 없이 한 칸에 들어갔다 — 열기 전에는 무엇이 있는지 알 수 없다.
- **칸이 여덟이라** 1024 아래에서 번호를 접어야 했고, 820px 에서 마지막 단계가 화면 밖으로 밀렸다.

참조는 **가운데 알약 다섯**(Platform · Solutions · Resources · Company · Pricing)이고 각 메뉴는 **옅은 면 한 장 안에 2~3열**이다. 같은 체계로 옮겼다.

### 27-2. 막대 — 가운데 알약 다섯 + 오른쪽 하나

```
[V Vocaflow]        ( Today · Read ▾ · Practice ▾ · CSAT · Growth ▾ )        [ Class ↗ ]
```

| 칸 | 참조 자리 | 담는 것 |
|---|---|---|
| Today | Platform | `/hub` — 오늘 할 것 하나. 메뉴를 열지 않는다(화면 자체가 그 답이다) |
| Read ▾ | Solutions(초록) | 흐름 ① — 서가 · 내 라이브러리 + 각 네 면, 하단 줄에 만화 |
| Practice ▾ | Resources(살구) | 흐름 ②~⑤ — WordVault · Practice · Game Lab · ScriptQuiz · Dictation |
| CSAT | Pricing | `/csat` — 한 화면이라 링크 |
| Growth ▾ | Company(분홍) | 기록 + 학습 관리(Level · Plan · Report) + 도구(Settings · Sitemap) |
| Class ↗ | Book a demo | `/teacher` — 학습자 동선이 아니라 **역할이 바뀌는 곳**이라 가운데 다섯에 끼우지 않는다 |

- 메뉴 이름은 **흐름 단계 이름**을 쓴다(`Read` · `Practice`). 「Library」로 부르면 그 안의 항목(Library · My Library)과 이름이 겹쳐 층위가 안 읽힌다.
- 지금 있는 구역의 알약만 면을 갖는다(참조와 같다). 색만으로 알리지 않으므로 글자가 굵어지고 sr-only 「(현재 구역)」이 붙는다.

### 27-3. 패널 — 옅은 면 한 장 + 열 + 얇은 선

1차의 **원색 카드 격자**는 참조의 이 메뉴들과 다른 문법이었다. 참조 캡처를 다시 재면 한 메뉴는 **면 한 장**(메뉴마다 색이 다르다)이고, 그 안이 이렇게 나뉜다:

- 열 사이 **1px 세로선**(면 글자색 14%) · 첫 열이 나머지보다 넓다
- 열마다 **모노 대문자 눈썹**(BY TEAM · TINES FOR ↔ 우리: 읽을 곳 · 공용 서가 · 내 라이브러리)
- 첫 열은 **큰 블록**(세리프 21px 제목 + 한 줄 + 그림), 나머지는 **선 아이콘 목록**(행 사이 얇은 가로선)
- 맨 아래 **텍스트 링크 줄**(Events · Podcast … ↔ 우리: 만화 둘)

### 27-4. 흐름 다섯 단계는 어디로 갔나

**번호가 막대에서 패널 안으로 들어갔다.** ① 은 Read 패널 첫 열 눈썹의 배지, ②~⑤ 는 Practice 패널의 블록·행마다 붙는 배지다. 각 배지는 sr-only 「흐름 N번째 · 이름」을 함께 갖는다 — 화면에서는 숫자가, 스크린리더에서는 문장이 순서를 말한다. 패널의 **열 순서 = 번호 순서**(회귀가 검사한다: ②③ → ③ → ④⑤).

번호는 여전히 순서일 뿐 진도·자격·잠금이 아니다(LEARNING_FRAMEWORK §4①). **만화는 열 밖 · 번호 밖**(하단 링크 줄)이라 여섯 번째 단계로 읽히지 않는다 — 2026-08-16 결정의 문장 그대로("만화는 학습 단계가 아니라 읽는 방식이다").

### 27-5. 그 밖

- Growth 의 `owns`(Level · Plan · Report) → **`children`**. 패널을 열면 그 안이 다 보이므로 소유만 선언하는 것보다 이름으로 파는 것이 정확하다. ⚠️ 둘을 같이 두면 「owns 가 남의 href 를 가로챈다」로 회귀가 잡는다.
- **모바일은 그대로다.** 레일도 `hidden md:flex` 였고, 폰 셸은 이미 세 줄(유틸리티 바 · 나침반 띠 · 하단 탭)이다 — 메가메뉴 서랍을 더하면 같은 주소가 두 벌이 된다.
- `--sidebar-w` 는 0 으로 알린다(하단 player 가 `md:left-[var(--sidebar-w,240px)]` 로 읽는다).
- 회귀: `components/layout/__tests__/top-nav.test.tsx`(정본의 모든 주소가 그려지는가 · 막대 다섯 칸 · 번호 = 순서 · 만화는 번호 밖 · 현재 위치 표식 정확히 하나 · 패널마다 다른 면 색 · 빈 열 없음) · e2e `12-navigation` · `09-arcade-access` · `11-comic-discovery`.

## 28. 팝업 골격 — 참조 예제 모달 (2026-09-23)

참조(3B 라이브러리 예제)의 팝업은 **크림 종이 한 장**이다. 우리 팝업 14개는 껍데기를 저마다 손으로
그리고 있었다 — 배경막이 `rgba(23,17,10,.55)` · `--t1` 50% · `black/50` · `black/40` 네 가지였고,
모서리는 `--r-lg`·`--r-xl`·`--r-2xl` 이 섞였으며, 닫기 버튼은 네 모양이었다. 「닮게」 를 한 번 하려면
14곳을 똑같이 고쳐야 했고 다음 팝업은 또 자기 껍데기를 그렸다.

### 28-1. 참조에서 가져온 것 (첨부 캡처 2장 + `refs/tines/ui-kit-summary.md`)

| # | 참조 | 우리 적용 |
|---|---|---|
| ① | **배경막이 밝다** — 뒤 화면을 어둡게 덮지 않고 지면 색으로 씻는다 | `--bg` 72% + blur 6px. 팝업은 「덮개」가 아니라 「앞으로 나온 종이」다 |
| ② | 패널: 크림 · 1px 라벤더(`--bd`) · 24px(`--r-2xl`) · 떠 있는 그림자(`--sh-float`) | 같음. 밝은 막 위에서는 테두리가 윤곽을 맡는다(참조는 그림자를 거의 안 쓴다) |
| ③ | 머리 차례: 빵부스러기 **알약 → `›` 글자** → 큰 제목 → 작성자 줄 → 윤곽선 태그 + 오른쪽 메타 | 같음. 제목 26/34/40px — 팝업 제목이 페이지 제목만큼 크다(참조 40px) |
| ④ | 머리 아래 가로선 1px, 본문 2열(넓은 왼쪽 + 좁은 오른쪽, 656:366 ≒ 1.8:1) | `DialogColumns` |
| ⑤ | 왼쪽 칸 맨 위 **틴트 패널** — 면 색 + 같은 색상 테두리 + 제목줄 오른쪽 버튼 | `DialogTintPanel`(`.tone-*` 이 안쪽 `--t1`·`--bd` 를 그 색상으로 바꾼다) |
| ⑥ | 오른쪽 칸 맨 위 **액자** — 미리보기(제품 화면 · 표지) | 도서·씨앗은 표지 액자, 아케이드 브리핑은 짙은 액자(`bf-stage`) 안에 게임 보드 |
| ⑦ | 오른쪽 위 **원형 아이콘 버튼**(바깥 열기 · 닫기, 1px 테두리 44px) | `DIALOG.iconBtn` · `headerActions` 로 추가 버튼 |
| ⑧ | 패널 **바깥** 좌우 원형 이전/다음 | `onPrev`/`onNext`(lg 이상에서만 — 좁은 화면에는 놓을 자리가 없다) |
| ⑨ | 「COPY PROMPT」 — 크림 면 · 대문자 모노 · **색이 어긋나 겹친 그림자** | `BTN_STACKED`(노랑 → 분홍 → 라벤더 2/4/6px). 누르면 그림자만큼 내려간다 |

### 28-2. 한 부품으로 모았다

`components/ui/Dialog.tsx` — 껍데기의 단일 출처. 호출부는 내용과 `onClose` 만 준다.
Esc · 바깥 누르기 · 뒤로가기(`useCloseOnBack`) · 포커스 가둠·복원(`useFocusTrap`) · 배경 스크롤 잠금 ·
포털 · `role="dialog"` + `aria-modal` + `aria-labelledby` 가 전부 그 계약이다.
**마운트 = 열림**이다(`isOpen` 을 받지 않는다) — "열렸는데 훅이 안 걸린" 상태가 생기지 않는다.

| 옮긴 팝업 | 머리에 올린 것 | 본문 구성 |
|---|---|---|
| `NetflixDetailSheet`(도서·기사·단어장 상세) | 제목(40px) · 저자 · 테마 태그 | 2열 — 왼쪽 판단 근거, 오른쪽 **표지 액자** + 수치 |
| `SeriesInfoModal`(시리즈 학습안내) | 제목 · 한 줄 · **능력 태그**(아이콘 포함) | 왼쪽 판정 틴트 패널(게이지) + 로드맵, 오른쪽 스탯·출처 |
| `GameBriefModal`(아케이드 브리핑) | 게임 표식 타일 · 계층·참조 태그 | Objective(크림) → **짙은 액자**(보드 3장 + 트라이얼) → Notes |
| `VocabSetPreviewModal` | 이모지 타일 · 단어 수·챕터 태그 | 학습 플랜 · 챕터 아코디언 |
| `ComicInfoDialog` | 시리즈·발행사·연도 · 호수·쪽수 태그 | 살구 틴트 패널(배우는 것) + 서지 + 출처 |
| Admin 6종 | `Admin › 구역 › 상태` 빵부스러기 | 도서 상세·씨앗은 2열(표지 액자), 나머지는 한 칸 |

**표지 히어로를 없앤 이유**(도서 상세): 예전에는 200~240px 짙은 그라디언트 위에 흰 제목을 얹고
`drop-shadow` 로 읽히게 했다. 실 표지는 밝은 것이 많아 대비가 표지마다 달랐고, 제목이 두 줄을 넘으면
표지를 가렸다. 크림 머리로 내리면 대비가 한 값으로 고정되고 제목은 40px 까지 커진다.

**아케이드만 짙은 면을 남긴 이유**: 참조 팝업의 오른쪽 칸도 **짙은 제품 화면**이다. 규칙을 읽는 글은
크림 위가 읽기 편하고, 게임 보드는 게임 화면 그대로여야 한다 — 그래서 껍데기는 크림, 보드는 액자 안.
무드 액센트는 짙은 판에서 고른 색이라 **옅은 면에 얹으면 사라진다** — 머리의 게임 표식 타일도
짙게 둔 이유다(첫 시도에 Ghost Race 표식이 빈 분홍 사각형으로 찍혔다).

### 28-3. 회귀

- `components/admin/__tests__/touch-target-scan.ts` 가 **공유 키트를 읽는다**. 클래스가 화면에서
  `tines-kit.ts` 로 옮겨 가자 `className={BTN.primary}` 가 전부 "판정 불가" 로 빠졌다(70 → 73).
  키트가 퍼질수록 44px 규칙이 조용히 꺼지므로, 상한을 올리는 대신 **스캐너가 키트를 풀도록** 고쳤다
  (점 경로 이름 + `export const NAME = { key: '…' }` 해석).
- e2e `31-popup-return` 의 분모는 이제 "`role="dialog"` 를 그리는 파일" 이 아니라
  **"팝업을 띄우는 컴포넌트"** 다 — 껍데기가 공용이라도 트리거·복귀는 화면마다 다르다.

## 29. 살아 있는 화면 — 참조 모션 체계와 `/hub` 적용 (2026-09-23)

사용자 관찰: 「참조는 **이미지가 움직여서** 살아 있는 플랫폼처럼 느껴진다」. 우리 `/hub` 는 같은 골격
(§21)에 같은 화풍의 삽화를 놓았는데도 정지 화면이다(지금 상태: `docs/design/shots/motion-before/hub@1440.png`).
무엇이 다른지 **참조의 작성 CSS·JS 를 직접 읽어** 값으로 옮겼다.

### 29-1. 재료 — 무엇을 읽었나

`www.tines.com/3b/` 의 작성 스타일시트 8장(**517,871 B**)과 JS 청크 19개(1.8 MB)를 받아 셌다.

| 센 것 | 수 |
|---|---|
| `@keyframes`(고유) | **47** |
| `animation` 선언 | 66 — 그중 `infinite` **25** |
| `@media (prefers-reduced-motion: …)` | **32** — `reduce` 21 · `no-preference` **9** |
| 스크롤 타임라인(`animation-timeline`) | 4곳 — `scroll(root)` 3 · `view()` 1 |
| 결정론 갈고리(`[data-3b-deterministic]`) | **12곳** |
| `IntersectionObserver` 를 쓰는 청크 | 4 |

사본은 저장소에 두지 않는다(세션 임시 폴더). **그림·서체가 아니라 비율·시간·이징만** 가져온다
— DD-62 ③ · DD-68 의 넘지 않는 선 2개.

### 29-2. 실측 — 모션 47종은 다섯 갈래뿐이다

| 갈래 | 참조 예 | 실측값 | 무엇을 말하는가 |
|---|---|---|---|
| ① **상시 루프**(살아 있음) | `tileFloat` — 벤토 칸 삽화 | `4s ease-in-out infinite` · `translateY(0 → -6%)` | 그림이 숨을 쉰다. **진폭 6%** — 읽기를 방해하지 않는 크기 |
| | `radarSweep` — 제품 목업 | `4s linear infinite` · `rotate(360deg)` | 목업 안에서 무언가 돌고 있다 |
| | `labelDotBreathe` — 영상 「LIVE」 점 | `1.8s ease-in-out` · `opacity 1→.5` + `scale 1→.55` | 지금 살아 있다는 신호 |
| | `promptCaretBlink` · `chatCaretBlink` | `1.1s step-end infinite` | 목업이 **입력을 기다린다** |
| | `breathe` · `blink` — 마스코트 | `±0.8px` · 깜빡임은 `4s` 중 **90–95% 구간**에만 `scaleY(.05)` | 눈은 주기의 5%만 움직인다. 나머지 95%는 정지 |
| | `keyPulse` — 게임 키 3개 | `1.8s` · 지연 `0 / .2s / .4s` | **계단 지연**이 셋을 한 물결로 만든다 |
| ② **데이터가 흐른다** | `depGraphFlow` · `accessMapFlow` | `0.7s linear infinite` · `stroke-dashoffset: 0 → -8px` | 연결선의 점선이 흐른다 = 「지금 돌고 있는 플랫폼」. **가장 싼 생동감** |
| ③ **스크롤 = 타임라인** | `heroQuoteSink` · `hundredXSink` | `animation-timeline: scroll(root)` · `animation-range: 0 80vh` · `translateY(0 → 7rem / 4.5rem)` | 히어로의 글자와 그림이 **다른 속도로** 가라앉는다. JS 0줄 |
| | `heroBedDrift` — 꽃밭 | `scroll(root)` · `0 100vh` · `translateY(0 → 10rem)` | 배경이 느리게 따라온다 |
| | `quoteFlowerParallax` | `view-timeline-name: --quoteFlowerView` · `-8rem → 8rem` | **그 요소가 화면을 지나는 동안**만 움직인다 |
| ④ **진입 한 번** | `snappyIn` · `threeBVisualAppear` | `.4–.6s cubic-bezier(.22,1,.36,1) both` · `opacity 0→1` 이 **0.1% 지점에서 끝난다** · `translateY 12–16px → 0` | 투명도는 시작 직후 끝나고 **이동만 보인다** — 크로스페이드 중의 흐릿한 글자가 없다 |
| | 메가메뉴 패널의 자식들 | `nth-child` 지연 `0 / 50 / 100 / 150 / 200ms` | 한 덩어리가 아니라 차례로 선다 |
| ⑤ **질감** | `grainShimmer` · `scanlineRoll` | `0.6s step-end` 배경 위치 흔들기 · `8s linear` 96px 굴리기 | 움직임이라기보다 소재(종이·브라운관) |

**이징은 사실상 하나다** — `cubic-bezier(.22, 1, .36, 1)`, 즉 우리 `--ease-out-quint`(DD-64 로 이미 토큰에 있다).
루프는 `ease-in-out`, 흐름·회전은 `linear`, 깜빡임은 `step-end`. 그 밖의 이징은 쓰지 않는다.
지속시간도 `--dur-quick` 150ms(마이크로) · `.4–.6s`(진입) · `1.8–4s`(루프) 세 무리뿐이다.

### 29-3. 값보다 중요한 것 — 규율 네 가지

값은 베껴도 이 넷을 빼면 「움직이는 화면」이 아니라 「산만한 화면」이 된다.

① **켜는 쪽으로 쓴다.** 루프·시차는 전부 `@media (prefers-reduced-motion: no-preference)` **안에서만**
   정의된다(9곳). 끄는 코드를 따로 쓰지 않는다.
   → **우리에게 특히 중요하다.** `globals.css` §4.4 의 전역 규칙이 `animation-duration: .01ms !important`
   로 모든 애니메이션을 죽인다(그 주석 스스로 "정본과 어긋난다"고 적어 두었다). `no-preference` 안에
   두면 **싸울 일 자체가 없다** — `reduce` 사용자에게는 그 규칙이 존재하지 않는다. 전역 규칙은 건드리지 않는다.

② **스크롤 타임라인은 점진 향상이다.** `@supports (animation-timeline: scroll())` 로 감싼다.
   지원: Chrome·Edge 115+ · Safari 26+ · **Firefox 안정판은 아직 플래그 뒤**(전역 약 83%).
   미지원 브라우저에서는 그냥 정지 상태로 보인다 — 폴백을 따로 쓰지 않는다.

③ **결정론 갈고리**(12곳) — 참조는 캡처할 때 애니메이션을 **끄지 않고 정해진 시각에 세운다**.

```css
[data-3b-deterministic] { animation: none }
[data-3b-deterministic] .radarDial {
  animation-play-state: paused;
  animation-delay: calc(var(--sceneTime, 0) * -1s);   /* 음수 지연 = 그 시각으로 감기 */
}
```

   이 저장소에는 `capture-learner.mjs` · `replica-diff.mjs` · `style-gate.mjs` 가 있다. 갈고리 없이
   루프를 넣으면 **기준선 캡처가 찍을 때마다 달라진다**(픽셀 diff 가 무의미해진다). 나중 일이 아니라
   모션과 **같은 커밋**에 들어가야 하는 것이다.

④ **메인 스레드 청구.** 히어로가 mount 에서 main thread 를 claim 하고, 아래 무거운 장면들은
   subscribe 해서 release 뒤에야 만들어진다(타임아웃 폴백 있음). rAF 루프는 `IntersectionObserver`
   `rootMargin: "50% 0px"` 안에 있을 때만 돈다. **우리는 지금 필요 없다**(§29-6 — JS 를 안 늘린다).
   규율만 적어 둔다: 나중에 캔버스·rAF 장면을 넣는다면 그때 이 구조가 전제다.

### 29-4. 우리가 가져올 수 없는 것 — 그래서 결론이 뒤집힌다

참조의 마스코트·드론은 **DOM/SVG 부품**이다. 눈·고리·날개가 각각 다른 주기로 움직이고, 드론은
스프라이트 띠를 `steps(frameCount)` 로 넘긴다. 우리 삽화 **73점은 평면 `.webp` 한 장**이라 안쪽을
움직일 수 없다. 통째로 움직이는 것(뜨기 · 시차 · 기울기)만 된다.

**그래서**: 참조의 「살아 있음」에서 큰 몫은 삽화가 아니라 **제품 목업(DOM·SVG)** 이 낸다 —
레이더 · 흐르는 연결선 · 깜빡이는 캐럿 · 굴러가는 숫자. 우리 `/hub` 의 그 자리는 `ProductFrame`
이고, 그 안은 전부 DOM·SVG 다(레일 · KPI 숫자 · `<svg>` 도넛 · 예보 막대 · 새 고전 표).
**가장 큰 이득이 거기 있고, 비용도 거기가 가장 싸다.** 삽화 뜨기는 그다음이다.

### 29-5. `/hub` 자리별 배정

위에서 아래로, 지금 코드 기준(`app/(main)/hub/page.tsx` · `components/hub/portal/sections.tsx`).

| 자리 | 지금 | 넣을 것 | 갈래 | JS |
|---|---|---|---|---|
| NEW 알약 → h1 → 부제 → CTA 둘 | 정지 | 차례로 서기 — `12px ↑` · 지연 `0/50/100/150ms` | ④ | 0 |
| `TitleMarquee` | **이미 흐른다**(40s · 멈춤 단추) | 그대로 — 참조 로고 줄과 같은 자리 | — | — |
| `ProductFrame` 액자 전체 | 정지 | `threeBVisualAppear` 그대로 — `16px ↑` · `.6s` · `both` | ④ | 0 |
| ↳ 액자 안쪽 라벤더 선 | 정지 실선 | **점선 흐름** — 선 하나를 `0.7s linear infinite` 로 흘린다 | ② | 0 |
| ↳ `FrameRail` 「지금 할 차례」 항목 | 색만 다름 | 왼쪽 점이 `1.8s` 숨쉰다(`labelDotBreathe`) | ① | 0 |
| ↳ `KpiRow` 숫자 4개 | 정지 | 굴러 올라와 앉는다(`rollUp` `.5s`) · 지연 `0/60/120/180ms` | ④ | 0 |
| ↳ `MemoryCard` 도넛 | `stroke-dasharray` 로 이미 그린다 | **그려지며 들어온다** — `stroke-dashoffset` 를 호 길이에서 0 으로(`.9s` · 색마다 `80ms` 계단) | ④ | 0 |
| ↳ `ForecastCard` 분절 막대 | 정지 | 폭이 0 → 최종으로 자란다(`.7s`) | ④ | 0 |
| ↳ `NewBooksTable` 행 7개 | 정지 | 행마다 `40ms` 계단 진입 | ④ | 0 |
| `ToneTabs` 만화 탭 `tile-comics` · 수능 탭 `tile-csat` | 정지 | `4s` 뜨기(`-6%`) | ① | 0 |
| ↳ 단어장 탭 `spot-cat-*` 격자 | 정지 | 같은 뜨기 · 칸마다 지연 `0/.25/.5/…` | ① | 0 |
| ↳ **서가 탭** 표지 격자 | 정지 | **아무것도 안 한다** — 진짜 책 표지다. 흔들면 상품이 흔들린다 | — | — |
| `SolutionSlab` 타일 삽화 3점 | 정지 | 더 느린 뜨기(`6s` · `-4%`) — 보라 통판은 읽는 면이다 | ① | 0 |
| `ReadingSection` 시리즈 카드의 56px spot | 정지 | **뜨기 없음** — 6%가 3px 라 떨림으로 보인다 | — | 0 |
| `UspCards` 108px spot | 정지 | **시차 → 뜨기로 바꿨다**(`5s` · `7%` · `0.3s` 계단) | ① | 0 |
| `FinalCta` 흩어진 물건 띠 | 정지 | `view()` 시차 `±0.6rem` — 액자를 두르고 그림을 **6% 균일 확대**(§29-11) | ③ | 0 |
| 히어로 ↔ 액자 시차 | 정지 | **보류** — 참조의 히어로 시차는 꽃밭이 받쳐 준다. §20 에 따라 `/hub` 에는 꽃밭이 없다 | — | — |

**넣지 않는 것**: 배경 질감(⑤ grain · scanline) — 우리 지면은 크림 단색이고 거기에 노이즈를 얹으면
읽는 글의 대비가 흔들린다. 자동 재생 캐러셀 · 콘페티는 DD-65 가 남긴 금지에 그대로 있다.

### 29-6. 부품 계약 — CSS 한 절과 속성 하나

`/hub` 는 서버 컴포넌트다(클라이언트 경계는 `PromoLink` · `TitleMarquee` · `ToneTabs` 셋뿐).
**JS 를 한 줄도 늘리지 않는다** — 진입 연출까지 `animation-timeline: view()` 로 하면
`IntersectionObserver` 가 필요 없고, 페이지가 `'use client'` 로 내려오지 않는다.

`globals.css` §4.5 「살아 있는 표면」. 클래스 일곱 + 지역 변수:

| 클래스 | 하는 일 | 호출부가 인라인으로 주는 변수 |
|---|---|---|
| `.vf-rise` | 진입 — `12px ↑` · `--dur-slower` · `--ease-out-quint` · 투명도는 `0.1%` 에 끝난다 | `--rise-delay` · `--rise-y` · `--rise-dur` |
| `.vf-arc` | SVG 호가 그려진다 — **시작 지점만** 호 길이만큼 밀어 숨긴다(기하는 그대로) | `--arc-offset` · `--arc-len` · `--arc-delay` |
| `.vf-grow` | 막대가 왼쪽에서 자란다 — `scaleX(0 → 1)` · 700ms | `--grow-delay` |
| `.vf-float` | 상시 뜨기 — `translateY(0 → calc(-1 * var(--float-y)))` | `--float-dur`(기본 `--dur-loop` 4s) · `--float-y`(기본 6%) · `--float-delay` |
| `.vf-flow` | 점선이 흐른다 — 반복 그라디언트 + `background-position-y` · 700ms linear | `--flow-step`(기본 9px) · 색은 `currentColor` |
| `.vf-breathe` | 「지금」 점이 숨쉰다 — `opacity 1→.45` + `scale 1→.6` · `--dur-loop-fast` | — |
| `.vf-parallax` | 시차 — `view()` 타임라인 | `--par-from` · `--par-to` |

진입 셋(`rise`·`arc`·`grow`)은 한 번만 돌아서 조건 없이 정의하고, **상시 루프 셋과 시차는
`no-preference` 안에서만 정의한다**:

```css
@media (prefers-reduced-motion: no-preference) {
  :root:not([data-reduced-motion='on']) .vf-float { animation: vf-float var(--float-dur, var(--dur-loop)) ease-in-out infinite; }
}
@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference) {
    :root:not([data-reduced-motion='on']) .vf-parallax { animation-timeline: view(); /* … */ }
  }
}
```

**끄는 손잡이는 둘, 후크는 하나.** 설계 초안은 새 `data-motion="calm"` 을 두려 했으나, 저장소에
**이미 같은 것이 있었다** — `/settings` 「모션 감소」 → `<html data-reduced-motion="on">`
(`components/layout/DevicePreferences.tsx`, 3상태 `system/on/off` · `localStorage` · OS 변경 추종).
후크를 둘로 나누면 한쪽만 꺼진다. 그래서 **새 속성을 만들지 않고 그것을 쓴다.**

| 손잡이 | 후크 | 효과 |
|---|---|---|
| OS 설정 | `prefers-reduced-motion: reduce` | 루프·시차 규칙이 **존재하지 않는다**. 진입은 페이드(`--dur-fast`)로 낮춘다 |
| 앱 토글 `/settings` 「모션 감소」 | `<html data-reduced-motion="on">` | 같음. 흐름선은 **점선 자체도 없앤다**(멈춘 점선은 고장으로 읽힌다) |
| 캡처 하네스 | `<html data-motion-freeze>` + `--scene-time` | `animation-play-state: paused` + 음수 지연 — 끄는 게 아니라 **그 시각에 세운다**(§29-3 ③) |

앱 토글이 필요한 이유는 취향이 아니라 요건이다: 5초 넘게 자동으로 움직이는 것에는 멈출 수단이
있어야 한다(WCAG 2.2.2) — OS 설정을 바꿀 수 없는 사람에게 `prefers-reduced-motion` 하나로는 수단이 없다.
`TitleMarquee` 의 멈춤 단추는 **그대로 둔다**(제자리에 있는 조작이 더 발견하기 쉽다).

**첫 페인트 전에 칠한다**: 토글은 원래 마운트 뒤(`useEffect`)에 칠해졌다 — 전환만 낮추던 때는
"첫 프레임에 늦어도 색이 틀리지 않는다"가 맞았지만, 상시 루프가 생기면 **끈 사람에게 한 프레임
움직임이 번쩍인다.** `app/layout.tsx` 의 선행 스크립트(테마를 칠하는 그것)가 같이 칠하도록 옮겼다.

**시차 캡처만 다르다**: `.vf-parallax` 는 스크롤 위치에 묶인 값이라 「어느 시각」이 없다 —
freeze 에서는 세우지 않고 `animation: none` 으로 끈다(fill 이 사라져 offset 0 으로 돌아간다).

### 29-7. 회귀 — 무엇이 조용히 깨지는가

| 깨지는 것 | 왜 | 막는 법 |
|---|---|---|
| **기준선 캡처가 흔들린다** | 루프가 돌면 `docs/design/golden/` 과의 픽셀 diff 가 매번 다르다 | 캡처 하네스가 `data-motion-freeze` + `--scene-time` 을 심는다(`scripts/design/lib/freeze-motion.mjs`). **모션과 같은 커밋에서** — 아래 §29-9 가 실측이다 |
| 전역 `reduce` 규칙과 충돌 | `!important` 가 새 규칙을 이긴다 | 애초에 `no-preference` 안에만 쓴다 — 충돌이 생길 수 없다. 유닛 테스트가 이것을 센다 |
| 삽화가 칸 밖으로 샌다 | `translateY(-6%)` 는 이웃을 밀지는 않지만 겹칠 수 있다 | 뜨는 삽화의 부모에 여백을 두고, 칸 경계를 넘는지 e2e 에서 `boundingBox` 로 본다 |
| `ToneTabs` 탭을 바꿀 때마다 지연이 다시 흐른다 | 패널이 새로 mount 된다 | 탭 패널 삽화의 뜨기는 **지연 0** 으로 시작한다. 계단 지연은 탭 사이가 아니라 **한 패널 안의 여러 그림**에만 |
| 도넛 「그려짐」이 값 변화와 섞인다 | 같은 `stroke-dashoffset` 를 진입과 데이터가 함께 쓴다 | 진입은 키프레임, 값은 서버가 찍은 정적 속성 — 진입 끝(`both`)이 값을 덮지 않도록 `--draw-len` 만 애니메이트 |

회귀 둘 — **CSS 쪽과 마크업 쪽이 각각** 있어야 계약이 닫힌다:

- `lib/a11y/__tests__/motion-contract`(CSS 파싱) — ① 루프·시차가 전부 `no-preference` 안에 있다 ② 앱 토글 후크가 `data-reduced-motion` **하나뿐**이다 ③ `@supports` 없이 쓰인 `animation-timeline` 이 0이다 ④ 캡처 freeze 가 **전체 선택자**다(목록이 아니라) ⑤ `reduce` 에서도 진입은 페이드로 남는다.
- `components/hub/portal/__tests__/product-frame`(렌더) — 클래스가 **붙는 자리**를 본다. 단계가 둘 이상일 때만 연결선 · 숨쉬는 점은 「지금 할 차례」 **하나에만** · 도넛 호가 자리잡기용 `strokeDashoffset` 를 잃지 않는다.

**왜 렌더 테스트가 따로 필요했나**: 「오늘의 흐름」 레일은 `model.steps.length > 0` 일 때만
그려지는데, 이 저장소의 검증 계정 둘(`runtime-test-*` · `lexicon-test`)이 **둘 다 진단 전**이라
캡처에는 그 레일이 아예 안 나온다 — 흐르는 선과 숨쉬는 점은 **화면으로 확인할 수 없다.**
계정 데이터를 한 번 바꿔 찍는 것보다 조건을 세워 두고 매번 확인하는 쪽이 싸다.
(유효성 확인: `s.current` 를 `true` 로 바꿔 보면 숨쉬는 점이 3개가 되어 테스트가 떨어진다.)

### 29-8. 단계 (평가 지점 포함)

| 단계 | 범위 | 끝 판정 |
|---|---|---|
| **A. 껍데기** | `globals.css` §4.5 · `data-motion` · 캡처 하네스 freeze · `motion-contract` 테스트. **화면 변화 0** | 같은 라우트 2회 캡처 픽셀 차 0 |
| **B. 목업이 산다** | `ProductFrame` — 액자 진입 · 도넛 그려짐 · KPI 굴림 · 표 계단 · 액자 선 흐름 · 「지금 할 차례」 점 | `/hub` 1440·390 전후 캡처 · 사용자 평가 |
| **C. 삽화가 뜬다** | `ToneTabs` · `SolutionSlab` 뜨기, `UspCards` · `FinalCta` 시차 | 같은 방식 평가 |
| **D. 넓히기** | 평가 통과 시 `/`(랜딩) · `/about` · `/library` 로. **같은 다섯 클래스만** 쓴다 | — |

**B 를 먼저 하는 이유**: 삽화 뜨기는 눈에 띄지만 「플랫폼이 돌고 있다」는 말을 하지 않는다.
참조에서 그 말을 하는 것은 목업 안의 흐르는 선과 도는 레이더다(§29-4). 우리 목업은 **진짜 학습자
데이터**를 그리므로 같은 연출이 참조보다 정직하다 — 숫자가 굴러 앉는 것은 그 값이 방금 계산됐다는
뜻이고, 실제로 그렇다.

### 29-9. 실측 — 「두 번 찍으면 같아야 한다」가 두 가지를 드러냈다 (2026-09-23)

A 단계의 끝 판정은 「같은 라우트 2회 캡처 픽셀 차 0」이었다. 실제로 재 보니 **0이 아니었고,
원인이 둘**이었다. 설계가 예상한 것은 하나뿐이었다.

| 회차 | 차이 | 무엇이 남아 있었나 |
|---|---|---|
| 1 | **0.89%** | freeze 선택자를 `.vf-*` 일곱으로 **열거**했더니, §4.5 밖에 있던 **제목 마키**(`.hub-mq`, 40초 무한)가 안 섰다 |
| 2 | **0.70%** | 마키는 섰다(브라우저에서 확인: `animation-play-state: paused` · `animation-delay: -3s`). 남은 것은 **표지** — `loading="lazy"` 인 도서 표지가 외부 호스트(standardebooks.org)에서 오는데 실행마다 도착 수가 달랐다(못 받음 9 → 3). 빈 칸이 되면 **쪽 높이까지 바뀐다** |
| 3 | 측정 불가 | 다른 세션이 같은 워크트리에 올린 `lib/csat/review-defects.ts`(`import 'server-only'`)가 dev 빌드를 깨서 `/hub` 가 Build Error 화면을 찍었다. 캡처를 지우고 측정을 멈췄다 — **못 잰 것을 통과로 세지 않는다** |

**고친 것 둘** (둘 다 이 작업 안에서):

① **freeze 선택자를 `*` 로.** 목록을 손으로 유지하면 새 루프가 생길 때마다 조용히 빠지고,
   아무도 안 알린다 — 기준선 diff 가 조금씩 시끄러워질 뿐이다. 이제 스피너·마키·스켈레톤까지
   전부 선다. 회귀 `motion-contract` ④ 가 **전체 선택자인지**를 센다.

② **표지를 다 받고 찍는다.** `settleImages()` — `loading="lazy"` 를 `eager` 로 바꿔 강제로 부르고
   최대 9초 기다린다. 다 못 받으면 **수를 출력한다**(`⚠ 그림 3/43 못 받음`). 죽은 호스트 하나가
   캡처 전체를 멈추면 안 되므로 기다림에는 한도를 둔다.

**왜 표지 문제를 여기서 고쳤나**: 「같은 화면을 두 번 찍으면 같아야 한다」는 **하나의 요건**이고,
그걸 깨는 원인이 둘이었을 뿐이다. 모션만 고치고 넘어가면 기준선 diff 는 여전히 시끄럽고,
다음 사람은 원인을 모션에서 찾는다(찾을 수 없다).

### 29-10. 세 번째 원인 — **음수 지연은 이미 돌고 있는 것을 되감지 못한다** (2026-09-23)

빌드가 풀린 뒤 다시 재니 **0.14%** 였고, 차이가 **띠 한 줄**(y 573–601)로 좁혀졌다 — 제목 마키다.
브라우저에서 확인하면 분명히 `animation-play-state: paused` · `animation-delay: -3s` 인데도
실행마다 다른 위치에서 멈췄다.

원인: `paused` 는 **「지금 위치에서 멈춰라」** 로 동작하고, 그때 뒤늦게 준 음수 지연은 그 위치를
되돌리지 못한다. 그래서 40초 마키는 **페이지가 열린 뒤 흐른 시간**(실행마다 다르다)에서 섰다.
진입 애니메이션은 `both` 로 이미 끝나 있어 어느 시각에 세워도 같은 프레임이라 증상이 안 보였다 —
**긴 주기의 무한 루프에서만** 드러난다. 그래서 늦게 발견됐고, 앞으로 `.vf-float`(4초)를 삽화에
붙이는 C 단계에서 같은 문제가 더 크게 나왔을 것이다.

참조는 이 문제가 없다. `[data-3b-deterministic]` 이 **서버에서 찍혀 나오므로** 애니메이션이
처음부터 멈춘 채 시작한다. 같은 조건을 만든다 — `installFreezeMotion()` 이 `addInitScript` 로
**문서가 생기자마자** 속성을 단다(`<html>` 이 아직 없으면 `MutationObserver` 로 기다린다).
페이지를 만든 직후·`goto` 전에 한 번 부른다. 연 뒤에 거는 `freezeMotion()` 은 보조로 남긴다
(SPA 이동으로 새로 생긴 루프용) — **그것만으로는 부족하다**는 것이 이 절의 내용이다.

| 회차 | 차이 | 고친 것 |
|---|---|---|
| 1 | 0.89% | freeze 선택자 열거 → `*` |
| 2 | 0.70% | 지연 표지 → `settleImages()` |
| 3 | — | (다른 세션이 dev 빌드를 깨 측정 불가) |
| 4 | **0.14%** | 남은 것은 마키 한 줄 |
| 5 | 0.44% (**모션 아님**) | `installFreezeMotion()` 뒤 — 마키 띠가 **사라졌다**. 남은 차이는 **데이터**다 |

**5회차를 「나빠졌다」로 읽으면 안 된다.** 차이가 난 자리를 잘라 보니 셸의 나침반 띠가
두 캡처에서 **다른 문장**이었다 — 「먼저 · 5분 진단이 끝나면 312권 중…」 → 「다음 · 기억이
흐려진 단어 252개를…」. 이 워크트리는 **검증 계정 하나를 여러 세션이 공유한다**(AGENTS.md
「공유 워크스페이스」). 띠 높이가 달라지면서 아래 전체가 2px 밀렸고, 그래서 표의 행마다
42px 간격으로 차이 띠가 생겼다(내용·표지는 동일). 같은 이유로 액자 레일의 「오늘의 흐름」이
있다가 없다 — 그 계정의 오늘이 실제로 바뀌었다.

**그래서 이 판정의 유효 범위**: 모션·그림 로딩에서 온 흔들림은 **0** 이다(마키·도넛·표지 띠가
전부 사라졌다). 픽셀 0 을 말하려면 **계정 상태를 고정한 캡처**가 있어야 한다 —
`seed-empty-account.mjs` 가 있는 자리이고, 기준선 캡처의 다음 숙제다(모션 범위 밖).

### 29-11. C 단계에서 설계가 바뀐 두 자리 (2026-09-23)

붙여 보니 §29-5 의 배정 둘이 **그대로는 성립하지 않았다.** 값이 아니라 **얹는 자리**의 문제였다.

| 자리 | 설계 | 실제 | 왜 |
|---|---|---|---|
| `SolutionSlab` 타일 더미 | `<li>` 에 뜨기 | **`<Image>` 에** 뜨기 | `<li>` 는 이미 `transform: rotate(…) translateY(…)` 로 타일을 기울여 쌓는다. 거기에 애니메이션을 걸면 **애니메이션의 transform 이 그 값을 덮어** 더미가 평평해진다. 한 층 안쪽에 건다 |
| `UspCards` 108px spot | `view()` 시차 `±2rem` | **뜨기**(`5s` · `7%`) | 카드는 `min-h-[320px]` 에 `mt-auto` 로 그림이 바닥에 붙어 있다. 아래로 2rem 밀면 카드 밖으로 나간다. 담으려면 카드에 `overflow-hidden` 을 더해야 하는데, **장식 때문에 카드의 자르기 규칙을 바꾸는 것**은 순서가 거꾸로다 |
| `FinalCta` 띠 | `scroll(root)` `6rem` | `view()` `±0.6rem` + 액자 + **6% 균일 확대** | 딱 맞는 배경을 옮기면 가장자리에 **빈 줄**이 생기므로 여백이 필요하다. 그런데 **위아래로만 늘리면**(첫 시도 `h-[calc(100%+6rem)]`) 상자 비율이 달라져 `object-cover` 가 **다른 데를 자르고**, 삽화에 그려져 있던 회색 액자선이 띠 안으로 들어왔다(실측). **균일 확대**는 크롭 구도를 그대로 둔 채 사방에 3%(≈17px)만 남긴다 |

**규칙 하나로 남긴다**: 뜨기·시차는 **자기 transform 을 이미 쓰고 있는 요소에 겹쳐 걸지 않는다**
(겹치면 덮는다 — 합쳐지지 않는다). 한 층 안쪽의 그림에 걸거나, 자를 액자를 하나 두른다.
