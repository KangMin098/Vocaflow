# S003 `/fit` — 지문 난이도 진단 (공개 도구)

> 생성 2026-09-18 · Claude Opus 5 · 근거: 메인 워크트리 코드 읽기 + `group-public.json`. 카드 ≤ 40줄.

## 목적
- JTBD: "수업·자습용 지문을 골랐을 때, 몇 학년에게 몇 %가 읽히는지 알고 싶다, 그래서 이 지문을 쓸지·어떤 단어를 먼저 짚을지 정한다"
- 주 사용자: 교사(1차) · 학생/방문자 · 인지 계층: 없음(공개, L0 전 단계)

## 흐름
- 진입: 셸 헤더 첫 자리(`(marketing)/layout.tsx:37`) · S001 CTA(`LandingCta.tsx:34`) · S007·S013·S014 · 구버전 `?r=` 은 S004 로 redirect(`fit/page.tsx:128-129`)
- 단계: 1. 예시 지문이 채워진 채 결과가 이미 보임 2. 지문 붙여넣기 → 700ms 디바운스 후 분석(`PublicFitClient.tsx:116,148`) 3. 학년 사다리·어려운 단어 확인 4. 공유/복사/인쇄
- 완료 조건: `fit_analyzed` 발화(`PublicFitClient.tsx:129-136`) — 예시 그대로면 발화 안 함(`:108`)
- 1차 행동: 지문 붙여넣기(textarea `PublicFitClient.tsx:227`) · 보조: 결과 링크 복사, 단어·뜻 복사, 워크시트 인쇄, 「내 기준으로 보기」 `/signup`
- 나가는 길: `/signup`(`LevelProfilePanel.tsx:269`) · `/pricing`(`:278`) · `/about`(`fit/page.tsx:208`)

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | ✅ 빈 입력이면 결과 사라짐 + 「예시 지문」 버튼 | `PublicFitClient.tsx:97-104,244-251` | ✅ 예시 복원 |
| 로딩 | ✅ "학년축에 올려보는 중…" | `LevelProfilePanel.tsx:93-103` | — |
| 오류 | ✅ 레이트리밋/일반 분리 문구 | `PublicFitClient.tsx:141-145,265-271` | △ 재시도 버튼 없음(대기 안내만) |
| 부분 | ✅ 레벨 미상 범위 띠·잘림 고지 | `LevelProfilePanel.tsx:151-157,128` | — |
| 완료 | ✅ 사다리 + 다음 단계 블록 | `LevelProfilePanel.tsx:258-290` | ✅ 가입·공유 |

## 자산
- N1 자산: 커버리지 · V-Level · 사전 표제어 수(`fit/page.tsx:195-199`) — 역할: **골격 후보**(학년 사다리), 사전 수치는 칩
- 형태 씨앗: S4 인접(적합도 눈금) — 단 고스트 마커 코드 없음(`TextFitVerdict.tsx` 미사용, `PublicFitClient.tsx:23-26` import 목록)
- 학습과학 원칙: 3(95–98% 구간), 6(어려운 단어 16개 제한 `LevelProfilePanel.tsx:183`), 5
- **@form 선언 불일치**: "지문이 칠해지고 … 고스트로 선다"(`fit/page.tsx:2`) — 입력은 칠해지지 않는 평문 textarea, 고스트는 "로그인하면" 문구뿐(`LevelProfilePanel.tsx:260-262`)

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: 라벨+H1 "이 지문, 우리 반에 맞을까?" → 9행 textarea(예시 채움) → 예시/지우기 버튼 → (추정) 사다리 상단 일부
- 골격 판정: **폼**(입력칸 먼저) + 막대 사다리. 선언된 G1 채색 지문은 코드상 없음
- 평균 신호(정적 0) · 이후 FAQ 카드 3(`fit/page.tsx:159-168`)

## 근거
- `apps/web/src/components/textfit/PublicFitClient.tsx:81-83` — `fit_viewed`/`fit_share_opened`
- `apps/web/src/components/textfit/LevelProfilePanel.tsx:116-138` — 공유/예시 출처 고지
- `apps/web/src/components/textfit/CurriculumPanel.tsx:37` — 조회 실패 시 무표시
