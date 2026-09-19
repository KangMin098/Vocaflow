# S004 `/fit/s/[payload]` — 공유받은 지문 진단 결과

> 생성 2026-09-18 · Claude Opus 5 · 근거: 메인 워크트리 코드 읽기 + `group-public.json`. 카드 ≤ 40줄.

## 목적
- JTBD: "동료·선생님이 보낸 결과 링크를 열었을 때, 그 지문이 몇 학년 수준인지 바로 보고 싶다, 그래서 내 지문으로도 재 볼지 정한다"
- 주 사용자: 방문자(교사 동료 · 학생) · 인지 계층: 없음(공개)

## 흐름
- 진입: 외부 공유 링크만 — `buildShareUrl`(`lib/textfit/share.ts:231`) 을 S003 공유 버튼이 복사(`PublicFitClient.tsx:203`) · 구 `/fit?r=` redirect(`fit/page.tsx:129`). 화면 내 정적 링크 0 은 정상(고아 아님)
- 단계: 1. 미리보기(OG 이미지 `fit/s/[payload]/opengraph-image.tsx`)에서 결과 확인 2. 헤드라인·사다리 열람 3. 빈 입력칸에 내 지문 → 재계산하면 "공유받은 결과" 표지 해제(`PublicFitClient.tsx:123-125`)
- 완료 조건: 내 지문으로 `fit_analyzed` 발화 · 또는 `/signup`
- 1차 행동: 내 지문 붙여넣기 · 보조: 「내 기준으로 보기」 `/signup`(`LevelProfilePanel.tsx:269`), 요금제
- 나가는 길: `/signup` · `/pricing`. `/fit` 으로 가는 링크는 없음(마케팅 헤더 `(marketing)/layout.tsx:37` 만)

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | ✅ 입력칸 비어 있어도 공유 결과는 유지 | `PublicFitClient.tsx:64,97-103` | ✅ |
| 로딩 | ✅ (재계산 시) | `LevelProfilePanel.tsx:93-103` | — |
| 오류 | ✅ 망가진 페이로드 → 404 | `fit/s/[payload]/page.tsx:57-59` | △ 전역 not-found 에 의존(`/fit` 직행 안내 없음 — 추정) |
| 부분 | ✅ 레벨 미상 범위 띠 | `LevelProfilePanel.tsx:151-157` | — |
| 완료 | ✅ 공유 결과 + 출처 고지 | `LevelProfilePanel.tsx:116-124` | ✅ |

## 자산
- N1 자산: 커버리지 학년 프로파일(페이로드 자체가 데이터, 서버 저장 없음 `:10`) — 역할: 사다리 **골격 후보**
- 형태 씨앗: 없음(json seeds=[]) · S4 인접
- 학습과학 원칙: 3 · 5

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: "공유받은 결과" 라벨 + H1 = 결과 헤드라인(`:67-69`) → **빈 textarea**(placeholder) → 출처 고지 → 사다리
- 골격 판정: **폼 먼저, 결과는 그 아래** — 받은 사람이 보러 온 결과가 빈 입력칸 뒤로 밀림(추정, 캡처 확인 필요)
- 평균 신호(정적 0) · `@form` 선언 없음(`page.tsx:1-10`)

## 근거
- `apps/web/src/app/(marketing)/fit/s/[payload]/page.tsx:30-54` — noindex + 결과 요약 메타(고1·고2·고3 %)
- `apps/web/src/components/textfit/PublicFitClient.tsx:82-83` — `fit_share_opened`
