# S011 `/terms` — 이용약관

> 생성 2026-09-18 · Claude Opus 5 · 근거: 메인 워크트리 코드 읽기 + `group-public.json`. 카드 ≤ 40줄.

## 목적
- JTBD: "가입 동의 전에, 이용 조건·권리·의무를 확인하고 싶다, 그래서 동의 체크를 누를 수 있다"
- 주 사용자: 방문자 · 가입 중 학생 · 인지 계층: 없음

## 흐름
- 진입: S010 가입 동의 체크 라벨(`(auth)/signup/page.tsx:315`) · S001 푸터(`page.tsx:161`) · 마케팅 셸 푸터(`(marketing)/layout.tsx:109`)
- 단계: 1. 제목·시행일·버전 2. sticky 목차 3. 본문 9절
- 완료 조건: 읽기(측정 없음)
- 1차 행동: 목차 앵커 이동(`components/marketing/LegalPage.tsx:91`) · 보조: 문의 mailto(`LegalPage.tsx:150`)
- 나가는 길: 셸 헤더·푸터. 가입 폼 복귀 링크 없음(추정)

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | n/a(정적 상수) | `terms/page.tsx:6` | — |
| 로딩 | 전역만 | `app/loading.tsx` | — |
| 오류 | 전역만 | `app/error.tsx` | ✅ |
| 부분 | n/a | — | — |
| 완료 | n/a | — | — |

## 자산
- N1 자산: **없음** — 역할: 없음
- 형태 씨앗: 없음
- 학습과학 원칙: 해당 없음

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: H1 + intro + "시행일 2026-05-01 · v1.0"(`terms/page.tsx:100-101`) → 좌 목차 / 우 본문(`LegalPage.tsx:78-83`)
- 골격 판정: **산문(법률 문서) + sticky 목차** — 합당
- 평균 신호(정적 0)
- **내용-제품 불일치**: "소셜 계정(Google 등)으로 가입"(`terms/page.tsx:30`) — provider 미설정(`(auth)/signup/page.tsx:2`); "무료 및 유료(Pro·Team) 플랜 … 14일 전액 환불"(`terms/page.tsx:46-49`) — 요금제 화면은 "유료 플랜을 아직 만들지 않았습니다"(`components/marketing/PricingClient.tsx:117-119`). 가입 화면은 같은 이유로 "14일 무료 체험" 문구를 내렸음(`signup/page.tsx:186-189`) — 약관만 남음
- 오탈자: "스크립트을"(`terms/page.tsx:23` 「AI 분석」 정의)

## 근거
- `apps/web/src/components/marketing/LegalPage.tsx:2` — 약관·정책 공통 레이아웃
- `apps/web/src/app/(marketing)/terms/page.tsx:88` — 변경 공지 기간
