# P-M4 기능·경계·회귀 검증

2026-10-15 · 고정 입력 · DB/실제 계정 쓰기 없음

## 독립 실행

**122/122 PASS**, 실패 0. [원 결과](data/unit-results.json). factory-integration 19, qualification 23, contracts 24, supply-ledger 7, demand-supply 10, return-ctx 9, PLAN 14, goal-view 10, 새 acceptance 6.

새 6건: 큰 재고의 공급 차단, 실제 Inspector 후보 DTO 렌더, 명세/주문 구분, Focus 네 상태·과거 링크, 실제 Inspector 단계·진행·과거 링크, 과거 상단 경계 관찰. 마지막은 결함 재현 검사다. 테스트 PASS를 읽기 전용 수용 PASS로 바꾸지 않는다. 별도 acceptance-ledger에 기대/실제/FAIL/HOLD를 기록했다.

SSR 대체: analytics, learnerPath(빈 상세 단계), StepSheet, useTaskDone(네트워크 없는 빈 집합), GoalPopover(닫힌 trigger). 실제 FocusStrip/TaskInspector/GoalRecordBar와 rank/DTO/공급/ledger 함수를 가져온다. E Inspector에만 공급 반환 DTO를 주입한다. CSS·hydration·포커스·라우팅·저장 성공을 검증한 것은 아니다.

## E SKIP 보완 범위

기존 learner E는 실제 수요에 guided_practice 줄이 없어 SKIP다. 원장을 유지했다. 새 합성 V2 수요의 첫 줄 역할을 명시적으로 guided_practice로 바꿨다. 자연 발생 제품 상태라고 하지 않는다. 실제 supplyFor에 재고 1/50000/MAX_SAFE_INTEGER를 넣으면 factory_candidate/납품 0/runnable false/assessment false다. supplyStep은 stock_review_wait다. 실제 Inspector에 이 DTO를 넣어 검수 대기 표시와 다음 링크 없음도 확인했다.

함수·SSR 경계 PASS, **실제 제품 E 브라우저 HOLD**. 현재 Inspector는 factoryStock=null이므로 재고를 조회하는 실사용 사례가 생겼다고 주장하지 않는다. factory-integration 19건을 독립 실행해 test_fixture가 신뢰 문맥만으로 승격되지 않는 것도 확인했다. 실제 승인/공장 연결 실행은 아니다.

## 시나리오 대조

| 요구 | 기존 구현자 증거 | 독립 증거·판정 |
|---|---|---|
| 목표 없음/기록 없음 | A/A2 | Focus SSR PASS, 저장 미실행 |
| 근거 부족/약점 아님 | ready/A2 | Inspector/Focus 렌더 PASS |
| 복수 후보/선택 | B/두 번째 선택 | 같은 rank/DTO 소스·기존 이미지 일치. 독립 클릭 HOLD |
| 행동 없음/준비 부족 | V2/S5 실제 화면 | 빈 ActionRank 렌더·공급 함수 PASS |
| 목표 80→92 | F, 기록 수 불변 | goal-view 회귀 PASS. 다른 추천이 되는 실제 경계 HOLD |
| 과거 보기 | 기존 시작 링크 0 | Focus/Inspector 차단 PASS, 상단 범위 P2-02 |
| PLAN 수행/성취 구별 | G | PLAN 회귀 14 PASS, 저장 API 미실행 |
| R5 진입/복귀/다음 문항 | learner C와 R5 6 PASS | 복귀 context 9 PASS. 새 브라우저 HOLD |
| 재고/테스트 교재 | E SKIP, 기존 계약 | 함수·SSR·계약 PASS, 제품 E HOLD |
| 세 요청 경로/full | map·/csat 복귀 일부 | full 독립 증거 없음, HOLD |
| Tab/Enter/Space/focus | CSS/네이티브 button | 실제 동작 HOLD |
| 계정 분리/서버 오류 | 이번 직접 증거 없음 | HOLD. DB 없이 통과로 표시하지 않음 |

기존 learner 12 PASS/1 SKIP와 R5 6 PASS를 새 독립 122개에 더하지 않는다. PNG 20장은 모두 직접 열람했다. 기준일 뒤의 최근 시험 표시는 시간 범위 관찰이며 점수 자체의 오류라는 뜻이 아니다.

## 재실행

의존성을 설치한 루트를 VF_REVIEW_DEP_ROOT에 지정한다. 이번에는 기존 map-v62 worktree의 설치된 의존성을 읽기 재사용했다.

    $env:VF_REVIEW_DEP_ROOT='D:/workspace/Vocaflow-map-v62'
    node D:/workspace/Vocaflow/node_modules/.pnpm/vitest@1.6.1_@types+node@20.19.39_terser@5.51.2/node_modules/vitest/vitest.mjs run --config scripts/research/pm4-ux-review/vitest.config.mjs --reporter=json --outputFile=docs/research/pm4-ux-review/data/unit-results.json
    node scripts/research/pm4-ux-review/verify.mjs

HTML은 scripts/research/pm4-ux-review/local/에 ignored로 생성한다. 합성 렌더 artifact이며 실제 캡처가 아니다. 실제 API/DB 호출은 없다. 결과 JSON의 실행 시간·경로는 환경에 따라 달라도 판정 입력 시각은 고정이다.
