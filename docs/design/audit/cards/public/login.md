# S006 `/login` — 로그인

> 생성 2026-09-18 · Claude Opus 5 · 근거: 메인 워크트리 코드 읽기 + `group-public.json`. 카드 ≤ 40줄.

## 목적
- JTBD: "돌아왔을 때, 이메일·비밀번호로 막힘 없이 들어가 원래 가려던 곳으로 가고 싶다"
- 주 사용자: 기존 학생·교사 · 인지 계층: 없음(인증)

## 흐름
- 진입: 셸(마케팅 헤더 `(marketing)/layout.tsx:51`, 랜딩 `page.tsx:65`) · 11개 화면(보호 라우트 복귀 포함) · 미들웨어 정지계정 `?error=`(`login/page.tsx:39-46`)
- 단계: 1. 이메일 2. 비밀번호 3. 제출 → 계정 상태 확인(`:80-92`) 4. 복귀 경로로 `replace`(`:102`)
- 완료 조건: `router.replace(resolveReturnTo(searchParams))` — 기본 `/hub`(`lib/auth/redirect.ts:26`)
- 1차 행동: 「로그인」 제출(`:193-212`) · 보조: 비밀번호 찾기(`:168`), 회원가입(`:124`)
- 나가는 길: `/signup` · `/reset-password` · 로고 `/`(`(auth)/layout.tsx:47`)

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | ✅ 제출 시 필드별 오류 | `:48-55` | ✅ |
| 로딩 | ✅ Suspense 스켈레톤 · 버튼 "로그인 중..." | `:224-235,198-202` | — |
| 오류 | ✅ 인라인 배너(role=alert) · 정지/해지 문구 | `:131-142,88-91` | △ 정지 계정 다음 행동 없음(문구뿐, 추정) |
| 부분 | n/a | — | — |
| 완료 | 이 화면엔 없음(즉시 이동) | `:102-103` | — |

## 자산
- N1 자산: **없음** — 역할: 없음
- 형태 씨앗: 없음
- 학습과학 원칙: 해당 없음

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: 로고 헤더 + 중앙 elevated 카드 — "다시 만나서 반가워요" · H1 로그인 · 입력 2 · 버튼 · "안전한 인증 · 산업 표준 암호화"(`:215-217`)
- 골격 판정: **폼(중앙 카드)** — 파일 첫 줄 주석이 스스로 "Linear/Vercel 미니멀"(`:2`)
- 평균 신호(정적 6): heavy shadow 3(Card `variant="elevated"` `:112` · 버튼 shadow `:196`) · big radius 2(`rounded-xl` `:112,226`) · float-hover 1(`:208` translate-x)
- 누락: 「회원가입」 링크가 `next` 를 들고 가지 않음(`:124`) — `verify-email` 은 들고 감(`verify-email/page.tsx:196`). 로그인 성공·실패 계측 없음(추정)

## 근거
- `apps/web/src/app/(auth)/login/page.tsx:3-4` — 소셜 버튼 제거(provider 미설정)
- `apps/web/src/app/(auth)/layout.tsx:22-32` — OS 다크 선호 반영
