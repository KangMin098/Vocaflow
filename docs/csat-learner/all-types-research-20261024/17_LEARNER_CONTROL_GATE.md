# 17 — 강의 학습자 제어: 검증 결과와 main 통합 게이트

> 상태: **통합 대기(미승인)**. 공식 수용 아님. 정답 공개 계약(14 결정 1)은 **미구현** — 이 게이트와 별개로 미완료 유지.

## 1. 대상

| 항목 | 값 |
|---|---|
| 브랜치 | `feat/lecture-learner-control` (worktree `D:/workspace/Vocaflow-lecture-learner-control`) |
| HEAD | `2bd99a0f1` |
| 기준 | `main` = `e3e0a6a0e` (브랜치가 main 대비 뒤처진 커밋 0) |
| 커밋 | d9fd35a66 · d3a304ada · a019f78d3 · 6f7fbe1ce · 2bd99a0f1 |
| 차이 파일 | `apps/web/src/components/csat/lecture/LectureStage.tsx` · `apps/web/src/components/csat/theater/AnalysisTheater.tsx` · `apps/web/src/components/csat/theater/theater.module.css` · `apps/web/src/components/csat/__tests__/theater-delivery-guard.test.ts` · `apps/web/tests/e2e/csat-lecture-learner-control.spec.ts` (5 files changed, 254 insertions(+), 14 deletions(-)) |
| 다른 작업자 충돌 | T-0136 은 `apps/` 금지 · 같은 두 파일을 바꾼 로컬 브랜치 0 (2026-10-24 실측). 공유 인덱스의 다른 세션 staged 201건 · 방치 worktree 삭제 상태는 건드리지 않음 |

## 2. 검증 결과

| 검증 | 결과 | 주체 |
|---|---|---|
| 타입 검사(tsc) | 통과 | 작성자 · 독립 R2 재현(a019f78d3) |
| 변경 파일 lint | 통과 | 작성자 |
| 해설 극장 소스 계약 가드 | 9/9 | 작성자 · 독립 R2 재현 |
| 격리 브라우저 하네스(LectureStage 단독 · Chromium · 1280/1440 · 실제 강의 데이터 2026#34 · 스크롤바 표시) | **32/32** (6f7fbe1ce) — R2 시점 30/30 독립 재현 | 작성자 · 독립 R2 |
| 실계정 E2E(`csat-lecture-learner-control.spec.ts`, 1280/1440 · 실제 문항 화면 · 장면 안내 · 선택 보존) | **BLOCKED** — `PLAYWRIGHT_RUNTIME_PASSWORD` 가 `.env.local` · main-serving · 셸 어디에도 없음. 우회 · 임의 변경 안 함 | — |
| 기존 실패 2건(HomeLanding T-0079 문구 · 학습 지도 CSS px font-size) | **회귀 아님** — main e3e0a6a0e 분리 worktree 에서 같은 2건 실패 재현 | 작성자 |

하네스 검사 항목(1280 · 1440 각각): 재생 시작 시 따라가기 · 따라가기 중 이동 · 휠 해제 · 해제 뒤 큐 진행에도 스크롤 유지 · 해제 뒤 접힌 층 대상을 **실제로 지나가도** 열지 않음 · 학습자 선택 유지 · 「지금 설명 위치로」 이동(접힌 층이면 펴고) · **학습자가 닫은 층에 같은 큐로 돌아와도 다시 열지 않음** · Space(본문) 해제 · Space(재생 토글이 가져감) 유지 · Space(단추 위) 유지 · Tab 해제 · 큐 진행이 포커스를 옮기지 않음 · 스크롤바 표시 전제 · 스크롤바 끌기 해제 · 페이지 오류 0. 결과 `harness/harness-results.json`, 화면 `harness/harness-1280.png` · `-1440.png`.

하네스가 **못 보는 것**: AnalysisTheater 의 장면 안내 단추 · 고정 안내 줄 · 포커스 이동(6f7fbe1ce 의 화면 변경) · 실제 문항 데이터 · 로그인 · 실제 TTS 음성.

## 3. 독립 검증 이력

| 회차 | 판정 | 처리 |
|---|---|---|
| R1 (15) | 코드 PARTIAL — P1 접힌 층 자동 열림 | d3a304ada 해소 |
| R2 (18) | PARTIAL(조건부 ACCEPT) · P0/P1 없음 | P2-c 안내 줄 레이아웃·포커스 → 6f7fbe1ce · P2-d 장면 안내 낭독 → 6f7fbe1ce · P2-e 하네스 무의미 검사 → 하네스 보강(32/32) |
| 남은 P2 | a) 스크롤바 판정이 RTL·왼쪽 스크롤바·중클릭 자동 스크롤 미감지(오탐은 해제 쪽이라 안전) · b) Tab 만으로 해제되는 키보드 불편 | 유지 — 제품 판단 필요 |
| R3 (19) · 6f7fbe1ce | PARTIAL · P0/P1 없음 · tsc · eslint · 가드 9/9 · 하네스 32/32 독립 재현 | P2-1 강의 종료 시 안내 줄 소멸 · P2-2 aria-pressed+라벨 교체 이중 낭독 · P2-3 알림 영역 조건부 렌더 → **2bd99a0f1** 해소(작성자 tsc · lint · 가드 9/9) |
| 남은 P2(R3) | P2-4 하네스는 AnalysisTheater(안내 줄 · 장면 단추 · 포커스)를 실행하지 않음 — 화면 변경의 실행 증거는 실계정 E2E 에만 있음 | 실계정 E2E 로 확인 |
| 2bd99a0f1 | **독립 재검증 없음**(소규모: 표시 조건 · 라벨 · 알림 위치) | 통합 전 필요 |

## 4. 통합 게이트 판정

**지금은 통합하지 않는다.** 사용자 조건 「실제 브라우저 · 키보드 검증과 독립 검증 통과」 중
- 실제 브라우저(실계정) 검증: BLOCKED
- 독립 검증: R1 → R2 → R3 모두 PARTIAL(P0/P1 0, 지적 P2 는 커밋으로 해소), 마지막 커밋 2bd99a0f1 은 미검증
- 화면(AnalysisTheater) 변경의 실행 증거: 없음 — 하네스 범위 밖

통합 절차(조건 충족 시): 검증 SHA 고정 → `D:/workspace/Vocaflow-main-serving` 가 main · 깨끗함 · 진행 중 Git 작업 없음 · 다른 세션 소유 없음 확인 → `lock.mjs acquire` → `git merge --no-ff <SHA>` → release. 사용자 main 통합 확인 후.
