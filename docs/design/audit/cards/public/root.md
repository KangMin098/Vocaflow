# S001 `/` — 랜딩 (채색 지문 히어로)

> 생성 2026-09-18 · Claude Opus 5 · 근거: 메인 워크트리 코드 읽기 + `group-public.json`. 카드 ≤ 40줄.

## 목적
- JTBD: "검색·공유 링크로 처음 들어왔을 때, 이 도구가 무엇을 재는지 눈으로 확인하고 싶다, 그래서 내 지문으로 재 볼지 정한다"
- 주 사용자: 방문자(학생·교사) · 인지 계층: 없음(공개)

## 흐름
- 진입: 셸(sitemap 1.0, `page.tsx:7-11` 주석) · S005 `/join/[code]` 무효 코드 출구(`(marketing)/join/[code]/page.tsx:146`)
- 단계: 1. 히어로 지문이 고1 기준으로 이미 칠해져 있음 2. 레벨 슬라이더 조작 → 색·% 즉시 변화 3. CTA
- 완료 조건: `/fit` 이동(`landing_cta_clicked` target=fit, `LandingCta.tsx:34-35`)
- 1차 행동: 「지문 난이도 재 보기」 → `/fit` · 보조: 「무료로 시작하기」 `/signup`, 서가 `/library/books`, 교사 `/teacher`
- 나가는 길: 헤더 소개·요금제·로그인(`page.tsx:62-65`), 푸터 5링크(`page.tsx:158-162`)

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | △ 데모 없으면 히어로 증명이 통째로 사라짐(대체 없음) | `page.tsx:85` · `lib/marketing/hero-demo.ts:81,102` | ✅ CTA 는 남음 `page.tsx:88` |
| 로딩 | ✅ 전역 스피너 | `app/loading.tsx:11-15` | — |
| 오류 | ✅ 전역 오류 + `/` 출구 | `app/error.tsx:58-70` | ✅ |
| 부분 | ✅ 신뢰 지표 못 읽으면 섹션 생략 | `page.tsx:110` · `trust-signals.ts:89-104` | — |
| 완료 | n/a (관문 화면) | — | — |

## 자산
- N1 자산: 커버리지(8레벨 사전계산) · V-Level · DB 실측 3수치 — 역할: **골격**(히어로), 신뢰 지표는 칩·숫자
- 형태 씨앗: S3 채색 지문 + 레벨 슬라이더(`components/marketing/CoverageHero.tsx:66-86,120`)
- 학습과학 원칙: 3(Desirable Difficulty — 95% 커버리지 구간 제시), 5(Context — 지문 안에서 낱말 판정)

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: H1 2줄 + 부제 1줄(`page.tsx:76-83`) → 칠해진 영어 지문 + 슬라이더 + 큰 % (`CoverageHero.tsx:138-146`) → CTA 2개
- 골격 판정: **G1 채색 지문**(`page.tsx:2` @form 선언과 일치). 아래 섹션은 3열 격자(`page.tsx:94`)·2열 문 카드(`page.tsx:133`)
- 평균 신호(정적 3): 3열 격자 2(`page.tsx:94,113`) · glass 1(`page.tsx:54` backdrop-blur)
- 불일치: 헤더 로고가 `Sparkles`(`page.tsx:57`) — `(marketing)/layout.tsx:13-15`·`(auth)/layout.tsx:52-54` 는 "AI 생성 UI 출신 표시"라며 주묵 V 워드마크로 교체함. 랜딩만 남음

## 근거
- `apps/web/src/app/page.tsx:50` — 신뢰지표·데모 병렬 서버 조회, `revalidate` 하루(`:47`)
- `apps/web/src/components/marketing/CoverageHero.tsx:54` — `landing_demo_moved` 계측
- `apps/web/src/components/marketing/SectionBeacon` — 섹션 도달 계측(`page.tsx:86,93,132`)
