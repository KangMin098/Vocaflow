# S045 `/practice/dcp` — 구문 연습 (순서·삽입 문항 세션)

> 생성 2026-09-18 · Claude(감사 서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD: "오늘 처방된 구문 문항을 풀 때, 문장 순서·위치로 글의 논리를 훈련하고 싶다, 그래서 독해 구조 감각을 쌓는다"
- 주 사용자: 학생(처방 stage 게이트 통과자) · 인지 계층: L5 인접(문장 단위 통합 — 추정)

## 흐름
- 진입: /hub 처방 ④ 블록 `href: '/practice/dcp'`(`lib/learner/today-blocks.ts:151` — 정적 그래프 미검출) · /practice Use 면(`app/(main)/practice/PracticeChooser.tsx:70`, 활성일 때만)
- D7 활성화 경로 밖
- 단계: 1. 문항 풀이 2. 서버 채점(grade_dcp_item) 3. 정답/오답 피드백 + 정답 공개 4. 오답이면 원인 1탭 5. 다음 → 요약
- 완료 조건: 전 문항 후 "오늘 구문 연습을 마쳤어요"(`components/practice/DcpPlayer.tsx:103-122`)
- 1차 행동: 제출/다음 · 보조: 오답 원인 선택(vocab 원인만 /flashcard/play 링크 `lib/learner/dcp.ts:92`)
- 나가는 길: `?from=` 복귀(`app/(main)/practice/dcp/page.tsx:36-38`, 기본 /hub) · /flashcard/play

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | 있음 | 잠김 vs 오늘 다 함을 구분 `dcp/page.tsx:58-80` | ○ 온 곳으로 돌아가기 CTA |
| 로딩 | 부분 | 채점 중 `submitting` `DcpPlayer.tsx:183-195` · 페이지는 전역 `app/loading.tsx` | — |
| 오류 | 있음 | 채점 실패 경고 박스 `DcpPlayer.tsx:151-170` | △ 재시도 여부 추정 |
| 부분 | 있음 | 진행률 바 `DcpPlayer.tsx:144` | — |
| 완료 | 있음 | "n문항 중 m문항을 맞혔어요. 꾸준함이 실력이 돼요." `DcpPlayer.tsx:116-118` | ○ backHref |

## 자산
- N1 자산: CTP DCP 문항(처방 practice) — 역할: **없음(콘텐츠만)**. 문항 자체가 텍스트 조작면이지만 주묵 관계선 문법(S5)은 안 씀
- 형태 씨앗: 없음
- 학습과학 원칙: #1 Active Recall · #3 Desirable Difficulty · #7 Emotional(오답 원인 격려 tip `lib/learner/dcp.ts:85-95`)
- 3중 피드백: 색 + 아이콘(Check/X `DcpPlayer.tsx:229-235`) — 애니메이션 확인 못 함

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: ← 돌아가기 + 20px 제목 "구문 연습" + 진행률 바 + 문항 카드(compact 폭 `dcp/page.tsx:41`)
- 골격 판정: **폼**(문항 카드 순차) — G1 후보는 주묵 문법이나 미적용
- 평균 신호(정적): 1 (float-hover 1)

## 근거
- `apps/web/src/app/(main)/practice/dcp/page.tsx:6-9` — 복귀 링크 `/hub` 하드코딩 결함 경위
- `apps/web/src/components/practice/DcpPlayer.tsx:4` — 흐름 정의
