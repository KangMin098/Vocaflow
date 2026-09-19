# S008 `/privacy` — 개인정보처리방침

> 생성 2026-09-18 · Claude Opus 5 · 근거: 메인 워크트리 코드 읽기 + `group-public.json`. 카드 ≤ 40줄.

## 목적
- JTBD: "가입 전·후에, 내 정보가 무엇이 어떻게 쓰이는지 확인하고 싶다, 그래서 안심하고 동의한다"
- 주 사용자: 방문자 · 가입 중 학생(보호자 포함, 추정) · 인지 계층: 없음

## 흐름
- 진입: S010 가입 동의 체크(`(auth)/signup/page.tsx:334`) · S001 푸터(`page.tsx:162`) · 셸 푸터(`(marketing)/layout.tsx:109`)
- 단계: 1. 제목·시행일·버전 2. sticky 목차에서 절 선택 3. 본문 8절
- 완료 조건: 읽기(측정 없음)
- 1차 행동: 목차 앵커 이동(`components/marketing/LegalPage.tsx:91`) · 보조: 문의 mailto(`LegalPage.tsx:150`)
- 나가는 길: 헤더 · mailto. 가입 폼으로 돌아가는 링크 없음(새 탭 여부 미확인 — 추정)

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | n/a(정적 상수) | `privacy/page.tsx:6` | — |
| 로딩 | 전역만 | `app/loading.tsx` | — |
| 오류 | 전역만 | `app/error.tsx` | ✅ |
| 부분 | n/a | — | — |
| 완료 | n/a | — | — |

## 자산
- N1 자산: **없음** — 역할: 없음
- 형태 씨앗: 없음
- 학습과학 원칙: 해당 없음

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: H1 40px + intro + "시행일 2026-05-01 · v1.0"(`privacy/page.tsx:131-132`) → 좌 200px 목차 / 우 본문(`LegalPage.tsx:78-83`)
- 골격 판정: **산문(법률 문서) + sticky 목차** — 이 화면엔 합당
- 평균 신호(정적 0)
- **내용-제품 불일치**: 수집 항목에 "결제(유료 플랜) 카드 정보", "소셜 로그인 Google OAuth"(`privacy/page.tsx:23-24`), 목적에 "결제 처리"(`:33`) — 그러나 결제 화면 없음(`PricingClient.tsx:118-119`), 소셜 provider 미설정(`(auth)/login/page.tsx:4`, `signup/page.tsx:2`). 공개 화면의 사실 불일치(표시광고/개인정보 고지 정확성 사안, 추정)

## 근거
- `apps/web/src/components/marketing/LegalPage.tsx:27-68` — 공통 레이아웃(약관과 공유)
- `apps/web/src/app/(marketing)/privacy/page.tsx:117` — 변경 7일 전 공지 문구, 이력 링크 없음(추정)
