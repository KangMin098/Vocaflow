# S007 `/pricing` — 요금제 ("지금은 전부 무료")

> 생성 2026-09-18 · Claude Opus 5 · 근거: 메인 워크트리 코드 읽기 + `group-public.json`. 카드 ≤ 40줄.

## 목적
- JTBD: "쓰기 전에 비용이 드는지 확인하고 싶다, 그래서 부담 없이 시작하거나 학교 도입을 문의한다"
- 주 사용자: 방문자 · 교사/학원(도입 문의) · 인지 계층: 없음(공개)

## 흐름
- 진입: 셸 헤더(`(marketing)/layout.tsx:40`) · S001(`page.tsx:63,160`) · S002(`about/page.tsx:419`) · S003/S004(`LevelProfilePanel.tsx:278`)
- 단계: 1. "지금은 전부 무료입니다" 히어로 2. DB 신뢰 지표 3수치 3. 3 플랜 카드(지금·준비 중·학교) 4. 다른 점 5. 영상 6. FAQ 7. 보라 CTA
- 완료 조건: `/fit` 또는 `/signup` 이동 — 이 화면 자체 계측 0(추정: `PricingClient.tsx` 에 `track` 없음)
- 1차 행동: 「먼저 지문 하나로 확인」 `/fit`(`PricingClient.tsx:435`) vs 1번 카드 `/signup`(`:172`) — **1차 행동이 둘로 갈림**
- 나가는 길: `/signup`(`:172,441`) · `/login?next=/teacher`(`:269`) · mailto 2(`:221,275`) · `/video/[id]`(`:370`)

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | ✅ 지표 못 읽으면 섹션 생략 | `PricingClient.tsx:125` | ✅ 카드 CTA 유지 |
| 로딩 | 전역만(`revalidate` 하루 `pricing/page.tsx:28`) | `app/loading.tsx` | — |
| 오류 | 전역만 | `app/error.tsx` | ✅ |
| 부분 | ✅ 영상 없으면 영상 절 생략(추정 `:342` 조건) | `PricingClient.tsx:342-359` | — |
| 완료 | n/a | — | — |

## 자산
- N1 자산: DB 실측 3수치(표제어·도서–어휘 연결·수능 문항, `lib/marketing/trust-signals.ts:121-123`) — 역할: **칩·숫자**
- 형태 씨앗: 없음
- 학습과학 원칙: 해당 없음

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: 그라디언트 히어로(`:108`) + pill 배지 Sparkles(`:110-111`) + 48px H1 → 숫자 3칸 띠(`:128`) → (추정) 플랜 카드 상단
- 골격 판정: **3열 가격 카드 격자**(`:148`) — SaaS 요금표 표준형. G1 축 없음
- 평균 신호(정적 11): 3열 격자 4(`:128,148,313,364`) · 그라디언트 2(`:108,425`) · AI purple 1 = **하드코딩 `#6D28D9`**(`:425`) — `/about` 은 같은 색을 "지면 팔레트 밖, 다크에서 안 따라옴"이라 걷어냄(`about/page.tsx:399-400`) · 강조 카드 `sh-lg` + `r-2xl`(`:150`)
- 정직성: 가격·체험 없음 명시(`:118-119,213-214`) — 좋은 점

## 근거
- `apps/web/src/app/(marketing)/pricing/page.tsx:5-13` — 수치 상수 → DB 조회 전환 경위
- `apps/web/src/components/marketing/PricingClient.tsx:26` — 클라이언트 아님(토글 제거)
