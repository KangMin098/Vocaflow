# S051 `/teacher` — 클래스 (교사: 개설·초대·단어 보내기 / 학생: 참여·받은 단어)

> 생성 2026-09-18 · Claude(감사 서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD(교사): "우리 반에 단어를 내주고 싶을 때, 학급을 만들어 초대 링크로 학생을 모으고 싶다, 그래서 지문 단어를 과제로 보낸다"
- JTBD(학생): "초대코드를 받았을 때, 학급에 들어가 받은 단어를 담고 싶다"
- 주 사용자: 교사(B2B) + 학생 — 한 화면 역할 분기(`app/(main)/teacher/page.tsx:5-7`) · 인지 계층: 없음(과제는 L3 로 유입 — 추정)

## 흐름
- 진입: 셸 Class(`components/layout/sidebar-config.ts:319`) · / 랜딩 · /join/[code] · /text/new·/text/[id]
- D7 활성화 경로 밖(교사 채널 퍼널: `teacher_hub_view` 기록 `page.tsx:30`)
- 단계(교사): 1. 클래스 이름 입력 → 개설 2. 초대코드 탭 → 링크 복사 3. "다음 — 학생 부르기" 4. 학생 생기면 "다음 — 우리 반에 단어 보내기" → /text/new
- 완료 조건: 과제 발송(SentAssignments 에 나타남)
- 1차 행동: 상태 따라 하나 — 개설 → 초대 복사 → 「지문 붙여넣기」(`components/teacher/TeacherClient.tsx:262-290`) · 보조: 초대코드로 참여
- 나가는 길: /text/new(`TeacherClient.tsx:284`) · /text/[id]

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | 있음 | "아직 만든 클래스가 없어요. 위에서 첫 클래스를 만들어 보세요." `TeacherClient.tsx:193-195` · 학생 0 안내 `:262-272` | ○ 상태별 "다음 —" 블록 |
| 로딩 | 부분 | 전역 `app/loading.tsx` · 개설/참여 `pending` 비활성 `:160,180` | — |
| 오류 | 있음 | 조회 실패 고지(`unavailable`) `:128-139` · 액션 실패 `role="alert"` `:140-144` · 받은 과제 실패 `failed` `page.tsx:61` | ○ 조회 실패와 "없음" 구분 |
| 부분 | 있음 | 보낸 과제 0이면 SentAssignments 소멸(`TeacherClient.tsx:248` 주석) | — |
| 완료 | 부분 | 발송 결과는 SentAssignments 목록(추정) | — |

## 자산
- N1 자산: 없음(과제 단어는 /text/new 추출 쪽 자산) — 역할: **없음**
- 형태 씨앗: 없음
- 학습과학 원칙: 해당 약함 — #5 Context(교과서 지문에서 단어 추출, 추정)

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: 아이콘 칩 + 20px "클래스" + 2열 폼 카드(만들기/참여 `TeacherClient.tsx:147-187`) + 내 클래스 목록
- 골격 판정: **폼 + 카드 목록** — G1 축 없음
- 평균 신호(정적): 1 (float-hover 1). 입력은 시각 라벨이 `<label>` 아닌 `span` + `aria-label`, `focus:outline-none` 에 테두리색만(`:149-156`) — 포커스 링 약함(추정)

## 근거
- `apps/web/src/app/(main)/teacher/page.tsx:32-43` — 5개 조회 병렬 + 보낸 것 제외
- `apps/web/src/components/teacher/TeacherClient.tsx:246-258` — 나가는 링크 0 이던 결함 경위
