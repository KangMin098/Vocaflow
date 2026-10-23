# 18 · 독립 검증 R2 — 강의 학습자 제어(feat/lecture-learner-control)

- 검증자: 독립 읽기 전용(작성 관여 없음) · 2026-10-24
- 대상: `D:/workspace/Vocaflow-lecture-learner-control` · d9fd35a66 · d3a304ada · a019f78d3 (`git diff main...HEAD`, 5파일 +220/−14)
- 판정: **PARTIAL → 조건부 ACCEPT** — 「실브라우저 E2E 대기 상태로 main 통합 준비」 기준에서 P0·P1 없음. 남은 것은 P2 와 실계정 E2E(BLOCKED).

## 1. 직접 재실행

| 항목 | 결과 |
|---|---|
| `pnpm exec tsc --noEmit -p .` (apps/web) | exit 0 |
| `vitest run theater-delivery-guard.test.ts` | 9/9 통과 |
| 격리 하네스 `run.mjs` → `scratchpad/harness/out-r2/` | 30/30 통과 (1280·1440). bundle.js(02:15:55)가 LectureStage.tsx(02:15:50)·AnalysisTheater.tsx(02:02) 이후 빌드 — 최신 소스 |

## 2. R1(15번) 지적 해소 여부

| R1 | 상태 | 근거 |
|---|---|---|
| P1 details 자동 열림 | **해소** | `LectureStage.tsx:284` `if (active && following)` — 따라가기 꺼지면 열지 않음 |
| P2 Space·스크롤바·Tab | **해소(한계 있음)** | `LectureStage.tsx:316–349`. 아래 §3 |
| P2 일시정지 중 차례 줄 스크롤 | **해소** | 일시정지 중 cursor 는 학습자(move/블록)만 바꾸고 재생 중 동기화(`AnalysisTheater.tsx:776`)는 playing 한정. `:871` 가드와 합쳐 강의 주도 스크롤 없음 |
| P2 role=status 소음 | **해소** | 안내 줄(`AnalysisTheater.tsx:1020`)에 role 없음. 대신 알림 자체가 없음(P2-d) |
| P2 E2E 선택 보존 단언 | **부분 해소** | spec 에 `choices()`(aria-pressed/checked/selected·details.open·주소 meaning/rel/depth) 단언 추가. 미실행(BLOCKED) |

## 3. 새 수정 점검

- **Space + setTimeout + defaultPrevented**: AnalysisTheater 전역 keydown(`:884–890`)은 `lec` 이 있고 대상이 BUTTON/A/SUMMARY/입력이 아니면 **모든 강의 상태**에서 Space 를 preventDefault(idle/error=start, 그 외 toggle). 따라서 학습자 Space 는 「재생 토글」로 소비되어 따라가기 유지 — 페이지도 안 내려가므로 옳다. `lec` 없음 → `sessionOn` 거짓이라 감시 effect 자체가 비활성. setTimeout(0)은 같은 이벤트 디스패치가 끝난 뒤 읽으므로 등록 순서 비의존 — 타당. 단 `role="separator"` 위 Space 는 Theater 가 건너뛰어 stop 됨(무해).
- **스크롤바 판정 수식**(`:332–340`): 문서 스크롤바는 대상이 `<html>`, rect.left=0 이라 `x >= clientWidth` 가 성립 — 하네스가 실제 15px 스크롤바로 확인. 내부 스크롤 컨테이너도 같은 식으로 동작. 한계(P2-a): RTL·`scrollbar-gutter: both-edges`/왼쪽 스크롤바는 놓침(제품 LTR이라 영향 작음), 줌 시 소수 rect vs 정수 client* 로 ±1px 경계 오탐 — 오탐 방향이 「따라가기 끔」(안전 쪽). overflow:hidden 요소 오른쪽 테두리 클릭도 stop(무해). 키보드 이외 자동 스크롤(중클릭 오토스크롤)은 여전히 미감지.
- **Tab = stop**: 포커스 이동이 브라우저 스크롤을 일으키므로 타당. 다만 키보드 사용자가 재생 단추로 가려 Tab 만 눌러도 따라가기가 꺼진다(P2-b, UX 비용 — 「지금 설명 위치로」로 복구 가능).
- **follow() 가 접힌 details 를 연다**(`:358–366`): 학습자가 명시적으로 누른 단추의 결과 — 결정과 합치. 수용.
- **남은 강의 주도 변화**:
  - 블록 클릭 시 큐 이동/start(via 'block') — 학습자 동작. 수용.
  - `data-lecture-state` 흐림/강조 — 시각 표시만, 선택·스크롤·포커스 불변. 수용.
  - **P2-c 안내 줄 출현/소멸에 의한 레이아웃 이동**: `AnalysisTheater.tsx:1020` 안내 줄이 `.body` 위에 강의 진행(lectureElsewhere 변화)에 따라 끼었다 빠진다(≈56px). 따라가기가 꺼진 학습자에게도 본문 높이·보이는 영역이 강의 때문에 바뀐다. 또 포커스가 「그 장면 보기」 위에 있을 때 단추가 사라지면 포커스가 body 로 떨어진다(강의가 포커스를 바꾸는 사례). 자리 예약(고정 높이) 또는 disabled 유지 권장.
  - **P2-d** 안내 줄에 알림이 전혀 없어 스크린리더 사용자는 「강의가 다른 장면」을 알 수 없다(장면 변경 시 1회 polite 권장).
  - 재생 재개(Space/toggle) 시 following 은 false 유지 — 의도와 합치(재생 시작만 켬).

## 4. 하네스 판정(각 검사가 주장을 실제로 증명하는가)

- 휠·Space(본문)·Tab·스크롤바·follow·포커스 불변·aria-pressed 유지: 의미 있음. 스크롤바 검사는 전제(스크롤바 폭 15px)를 별도 단언해 유효.
- 「Space(처리기가 가져감)」: 합성 `preventDefault` 리스너로 Theater 를 흉내 — 실제 Theater 처리기와 동치이지만 Theater 자체는 번들에 없음(`keys={false}`).
- **P2-e 약함**: 「꺼진 뒤 접힌 층을 열지 않음」은 openBefore=0·openAfter=0 — 따라가기 중에도 열린 층이 0이었으므로 이후 4큐가 실제로 접힌 층 블록을 가리켰는지 증명하지 못한다(공허 통과 가능). 「학습자가 닫은 층을 다시 열지 않음」 시나리오(열림→학습자 닫음→다음 큐)도 없다.
- 커버 못 함: AnalysisTheater 장면 안내(`lecture-offer-scene`)·장면 불변, 실제 문항 데이터, 로그인, 차례 줄, msPick 등 실제 선택 보존. 실계정 E2E `csat-lecture-learner-control.spec.ts` 는 **BLOCKED(자격 증명 없음, 우회 시도 안 함)**.

## 5. 결론

P0 0 · P1 0 · P2 5(a–e). 결정의 핵심(장면·스크롤·층·선택을 강의가 저절로 바꾸지 않음)은 코드상 충족. P2-c(안내 줄 레이아웃·포커스 소실)는 통합 전 손보는 것이 바람직하나 차단 사유는 아님. 실브라우저 실계정 E2E 통과 전 「완료」 주장 금지.
