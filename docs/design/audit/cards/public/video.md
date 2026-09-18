# S013 `/video` — 영상 서가 (종류별 목록)

> 생성 2026-09-18 · Claude Opus 5 · 근거: 메인 워크트리 코드 읽기 + `group-public.json`. 카드 ≤ 40줄.

## 목적
- JTBD: "읽을 시간 없이 판단해야 할 때(교사 3분), 제품이 하는 일을 짧은 영상으로 보고 싶다, 그래서 써 볼지 정한다"
- 주 사용자: 교사(1차 `:5-8`) · 방문자 · 인지 계층: 없음(공개)

## 흐름
- 진입: 셸 헤더 「영상」(`(marketing)/layout.tsx:47`) · S001 푸터(`page.tsx:159`) · S014 빵부스러기(`video/[id]/page.tsx:87`)
- 단계: 1. 종류(KIND_ORDER)별 섹션 스크롤 2. 포스터 눌러 재생(누르기 전 `<video>` 없음 `ComponentVideo.tsx:13-15`) 3. 제목 → 편별 페이지
- 완료 조건: `video_started`/`video_completed`(`ComponentVideo.tsx:57,70`) — 화면 진입 이벤트는 없음(추정)
- 1차 행동: 영상 재생 · 보조: 제목 → `/video/[id]`(`video/page.tsx:75`)
- 나가는 길: `/video/[id]` · 빈 상태에서 `/fit`(`:50`). 목록 상태엔 `/fit`·가입 CTA 없음

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | ✅ 미발행/0편 → 안내 + `/fit` | `video/page.tsx:42-55` | ✅ 「내 지문으로 재 보기」 |
| 로딩 | 전역만(정적 manifest) | `app/loading.tsx` | — |
| 오류 | 재생 실패 처리 미확인(추정) | `components/video/ComponentVideo.tsx:93-97` | ? |
| 부분 | ✅ 편 없는 종류는 생략 | `:57` | — |
| 완료 | n/a | — | — |

## 자산
- N1 자산: 없음(영상 공장 산출물 — 영상 안 수치는 출처 표기, 화면 골격엔 없음) — 역할: 없음
- 형태 씨앗: 없음
- 학습과학 원칙: 4(Dual Coding — 영상+자막, 추정)

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: H1 "영상으로 보기" + 한 줄 → 첫 종류 제목·편수 → 포스터 3열
- 골격 판정: **3열 썸네일 격자**(`:65` `lg:grid-cols-3`) — 동영상 사이트 표준형
- 평균 신호(정적 1): 3열 격자 1(`:65`)
- 목록 끝에 다음 한 걸음 없음 — 62편(주석 `:71`)을 다 본 뒤 `/fit` 로 가는 길이 헤더뿐

## 근거
- `apps/web/src/app/(marketing)/video/page.tsx:23-25` — 순서는 `KIND_ORDER` 단일 출처
- `apps/web/src/lib/video/catalog.ts:70` — `VIDEO_PUBLISHED` = baseUrl && 편수>0
