# LM-W1 — PR #270 독립 디자인 수용

2026-10-15 · Codex 검토. **최초 제출 HEAD 그대로의 수용과 보강판 수용을 구별한다.** 최초 `cd6a83974c911072d457d1989cec2044794321c2`에는 핵심 사용 흐름의 P2가 있어 보강이 필요했다. 아래 수정과 실제 브라우저 재검증을 포함한 소스에 한해 수용한다. 최종 제출 HEAD·CI·병합 SHA는 [PR #270 원장](https://github.com/KangMin098/Vocaflow/pull/270)에 결속하며, 이 문서는 CI 전의 결과를 CI 통과로 대신하지 않는다.

## 1. 기준·환경·경계

- 기준 main `c6ff1ea8cd79a01399cc9a0a2bec2b6f1a9bf07d`. 기준 설계는 [LM-W1](../../csat-learner/v62/LM-W1_MAP_WORKSPACE.md), 교육·제품 정본은 [v6.2 CANON](../../csat-learner/v62/LEARNING_MAP_V6_2_CANON.md). 화면 목표는 **TASK 관계를 이해하는 지도 → 바로 아래 Workspace에서 실행**이다.
- 별도 worktree `Vocaflow-lm-w1-design-review`, 대표 경로 `/csat/diagnosis?tab=map&view=full`, Chromium 실제 viewport 1280×900·1440×900, DPR 1. 2094×950는 참조 기하만 별도 측정했다. 모바일/1024 수용은 하지 않았다.
- 연결 브라우저 surface가 제공되지 않아 저장소의 브라우저 E2E와 독립 Chromium probe를 실행했다. 새 개발 서버 3007에서 지정 HEAD를 먼저 재현한 뒤 같은 worktree의 보강판을 검증했다. 서버·합성 계정·테스트 수행은 실제 학생 표본이 아니다.
- 초기 공유 서버의 캔버스 대기 실패는 정상 화면 증거로 쓰지 않았다. 독립 서버에서도 첫 복귀 실행에 타임아웃이 있었고, 계측 복사본과 원본 순차 재실행에서는 같은 7개 단정이 통과했다. 중간 probe의 selector 오류·frame 대기 누락·추가 브라우저 기동 타임아웃도 PASS에 포함하지 않았다. 이를 제품 P0/P1로 단정하지 않았다.
- [소스/실행 결속](manifest.json), [최초 probe](evidence/pinned-final/results.json), [최종 probe](evidence/final-acceptance/results.json), [기존 회귀](regressions.json). 최초 단정·실패 관찰을 성공 값으로 덮지 않았다. probe는 검토 중 확대됐으므로 최초/최종 사례 수의 차이를 성공률 개선으로 해석하지 않는다.
- 30개 TASK ID, composeV4, NeedRank/ActionRank, taskPlan/workspacePlan, 저장 API·DB/RPC/RLS·공장 내부는 바꾸지 않았다. 소스 hash 대조에 이 경계를 포함했다.

## 2. 독립 수용 게이트

| 게이트 | 판정 | 근거와 한계 |
|---|---|---|
| DESIGN_FIDELITY | PASS — 확인 가능한 참조 범위 | 3B의 캔버스·선택/비선택 위계·알약·행·중앙 모달 패턴과 대조. 기하 8/8 차이 0. 살아 있는 3B 사이트의 키보드·숨은 메뉴·전체 22화면을 이 검토가 확인했다고 주장하지 않음 |
| UX_INTEGRATION | PASS — 보강 후 | 첫 화면의 Workspace 이동 단서, 첫 클릭의 상세 affordance, 팝업 키보드 진입, TASK→행·행→TASK의 실제 노출, PLAN/근거의 단계적 열기 |
| FUNCTIONAL_REGRESSION | PASS — 아래 대조표의 범위 | 기존 통합·복귀·해부·공급과 신규 의미 조건을 검사. 삭제된 FocusStrip/상시 Inspector DOM을 되살리지 않음. 실제 타인 Workspace UUID 공격·R5 전체 수행 순환은 별도 범위 |
| GOAL_ALIGNMENT | PASS — 화면 구조 PR | 지도 중심성과 아래 실행 목록을 유지. 새 카드/대시보드·새 추천/판정·콘텐츠 승격 없음. LM-G1.1부터 이어갈 수 있으나 그 과제가 완료된 것은 아님 |

이 판정은 전문가·학생 사용성 실험이나 학습 효과 수용이 아니다. 처음 보는 실제 학습자의 탐색 시간·성공률은 측정하지 않았다. 검토자는 단서의 가시성, 실제 입력 경로와 결과, 정보 위계를 평가했다.

## 3. 1280/1440 실측과 발견 가능성

| 항목 | 1280×900 | 1440×900 |
|---|---:|---:|
| 지도 시작 y | 362 | 306.44 |
| 지도 사각형 w×h | 1092×596 | 1252×556 |
| Workspace 목록 시작 y, 전/후 동일 | 991 | 895.44 |
| 첫 화면에서 보이는 지도 사각형 면적/viewport | 약 51.0% | 약 53.7% |
| 기존 안내 알약 y | 914 — 첫 화면 밖 | 818.44 |
| 보강한 Workspace 이동 링크 y / 높이 | 308 / 44 | 252.44 / 44 |
| 팝업의 연결 Workspace 선택 후 행 y | 약 481.55 | 약 481.98 |
| 최종 페이지 가로 넘침 | 0 | 0 |

최초에는 1440에서도 목록 제목이 사실상 첫 화면 아래였고 1280은 안내 알약도 밖이었다. 단지 y가 크다는 이유로 지도를 축소하지 않았다. 지도 머리의 **Workspace n개 ↓** 텍스트 링크로 목록 존재와 이동을 알리고, 클릭/Enter 뒤 목록 제목에 초점을 준다. 지도·목록의 면적과 시작 위치는 그대로다.

TASK 선택 후 검은 테두리/중심·지원 표지와 노드의 ⋮가 나타난다. 접근 가능한 이름은 첫 누름·다시 누름·Esc의 의미를 알린다. 팝업의 연결 Workspace는 해당 행으로 초점/스크롤을 이동한다. 행의 ‘지도에서 관련 TASK 보기’는 선택을 보존하면서 해당 TASK를 실제 viewport로 이동한다. 대표 행 외의 실행 대상 4개 행을 각 해상도에서 검사했다. 자료 준비 중 목록은 실행 가능으로 승격하지 않는다.

전체 보기의 L/X는 캔버스 내부 가로 이동으로 접근한다. 노드/영역 이름 자체의 잘림 0, DOM의 6영역·30 TASK, 캔버스 내부 scrollLeft 이동, 페이지 넘침 0을 함께 검사했다. ‘첫 화면에 30개가 모두 보인다’는 주장은 하지 않는다.

화면: [1280 첫 화면](evidence/final-acceptance/1280-initial.png) · [1440 첫 화면](evidence/final-acceptance/1440-initial.png) · [Workspace](evidence/final-acceptance/1280-workspace.png) · [TASK 팝업](evidence/final-acceptance/1440-popup.png).

## 4. 결함 원장과 최소 수정

| ID | 심각도 | 재현/영향 | 수정·재검증 |
|---|---|---|---|
| D01 | P2, 핵심 | 최초 1280 목록 y991/1440 y895.44. 첫 화면의 이동 단서 없음. 팝업에서 관련 묶음을 누르면 팝업만 닫히고 행은 y1046.55/y950.98 밖에 남음 | 지도 머리의 작은 텍스트 링크와 목록 제목 focus, 팝업→관련 행 focus. 지도 축소 없음. 양쪽 해상도에서 링크 동작·실제 행 노출 PASS |
| D02 | P2, 핵심 | 키보드로 팝업을 열어도 초점이 노드에 남아 팝업에 Tab 34회. 1280에서는 아래 안내까지 보이지 않아 두 번째 동작 단서도 약함 | 배치된 비모달 dialog에 초점, 다음 Tab은 바로 버튼. 노드에 ⋮/접근 가능한 동작 안내. 비모달을 focus trap으로 바꾸지 않음. Enter/Tab/Esc·노드 복귀 PASS |
| D03 | P2, 핵심 | 대표 외 행의 역방향 경로 확대 검사에서 중심 TASK가 화면 밖: 1280은 4개 중 3개, 1440은 2개. 선택 값은 맞아도 사용자가 결과를 볼 수 없음 | 행 선택에만 기존 선택 규칙+해당 TASK scroll/focus. 모달 열기에는 불필요한 배경 이동을 추가하지 않음. 4/4 행×두 해상도 PASS |
| D04 | P2, 회귀 | 과거 기준 전날 화면에 미래의 ‘최근 70점’이 기준 설명 없이 표시됨. 기존 P-M4b가 보호하던 전체 기록/기준일 구별이 빠짐 | 과거 보기만 ‘전체 기록의 최근 70점’으로 표시. 집계·목표·과거 판정 계산은 변경하지 않음. 읽기 전용·현재 목표 수정·뒤로가기 PASS |

D03은 보강 중 테스트 범위를 모든 행으로 넓혀 발견했다. 그때까지 해당 행 선택 로직은 최초 HEAD와 같았으며, 앞선 팝업 focus 수정이 만든 문제로 분류하지 않았다. selector 착오로 빠졌던 Inspector 제목은 실제로 존재했고, 올바른 id로 재검증했으므로 결함으로 세지 않았다.

P0/P1은 검토 범위에서 발견하지 않았다. 위 P2 4건은 수정·재검증으로 닫았다. 별도 P3나 디자인 취향 차이를 결함 수에 채워 넣지 않았다. LM-G1.1의 실패 REPAIR 단계 판단 불일치는 이 원장에 새 디자인 결함으로 넣지 않는다.

## 5. 구성별 시각·동작 평가

| 구성 | 실제 평가 | 수용 근거/차이 |
|---|---|---|
| 컴팩트 목표 띠 | 1440 한 줄, 1280 두 줄. 지도 위의 대형 우선 카드 없음 | 목표·기록·지금 행동을 구분하며 과거 보기의 기준을 복원. 1280에서 한 줄을 강제해 잘라내지 않음 |
| 6영역·30 TASK | 고정 노드/피치, 관계선·보류/통합 관찰, 중심/지원 표시 | 노드 반복은 그래프 객체의 일관된 표현. 일반 설명 카드 반복과 다름. L/X 내부 이동은 의도된 차이 |
| 안내/선택 요약 알약 | 초점 전 안내, 초점 후 TASK/근거/묶음/⋮/해제 | 1280에서는 알약만으로 안내할 수 없어 노드 ⋮와 상단 이동 링크로 보완 |
| 범례 알약 | 캔버스 안, 번호·선·중심/지원·보류 의미 표시 | 학습자의 관계 해석에 필요. 기하 일치와 의미 이해의 효과는 별개 |
| Workspace 목록 | 제목·연결 TASK·단계·수행량·상태·다음 행동의 행 | 실행/잠김/준비 중 구별, 카드 더미 없음. 선택 효과를 이제 화면에서 확인 가능 |
| TASK 빠른 팝업 | 좁은 요약+연결 묶음+행동+자세한 근거 | 3B의 access 동작 메뉴와 내용은 다르지만 TASK→학습 실행에 필요한 차이. 키보드 진입 보완 |
| Workspace 상세 모달 | 중앙 680px, 목적/관계/단계/자료, 내부 스크롤, 고정 바닥 행동 | 3B Skill 모달의 머리·탭·구획·바닥 패턴과 대조. 네 구획은 서로 다른 질문이며 대형 소개 카드 반복으로 평가하지 않음 |
| PLAN 편집 탭 | 기존 PlanSection, 계획량/정성 기준/저장 이유/버전 | 실행 화면에 편집 내용을 상시 쌓지 않음. 개요와 PLAN의 정보 겹침은 역할이 달라 별도 탭에 둠 |
| 근거 드로어 | 현재/목표→학습 경로→접힌 근거/지원 범위 | 팝업이 닫힌 후 열림. 상시 Inspector와 설명 중복을 재도입하지 않음. 화면 안·Esc 복귀 검증 |

사진: [모달](evidence/final-acceptance/1280-modal.png) · [PLAN](evidence/final-acceptance/1440-plan.png) · [근거 드로어](evidence/final-acceptance/1440-drawer.png) · [과거 보기](evidence/final-acceptance/past-readonly.png). 생성한 파일을 실제로 열어 위계·가독성·중복·스크롤을 평가했다.

3B는 저장소 밖의 제공된 캡처 `survey/20-access-node-click.png`, `32-node-click.png`, `22-skill-modal-settings.png`와 기존 spec을 확인했다. 외부 계정 정보가 있는 원본은 커밋하지 않았다. live DOM의 폰트·그림자·동작 메뉴 전체는 비교 완료로 주장하지 않는다.

### 기하 대조 — 기존 ref-compare와 같은 8개 측정 계약

추가 브라우저를 띄우는 기존 CLI 실행은 타임아웃이 있어 PASS로 세지 않았다. 동일한 8개 측정식을 [독립 helper](../../../scripts/research/lm-w1/geometry.mjs)로, 이미 인증된 실행 소유 계정의 실제 2094×950 페이지에서 대조했다. [실측 JSON](evidence/final-acceptance/ref-compare.json).

| 항목 | 참조 px | 실측 px | 차이 |
|---|---:|---:|---:|
| 노드 폭 | 206 | 206 | 0 |
| 노드 높이 | 46 | 46 | 0 |
| 열 피치 | 272 | 272 | 0 |
| 행 피치 | 60 | 60 | 0 |
| 머리 줄 높이 | 49 | 49 | 0 |
| 머리 줄→첫 노드 | 25 | 25 | 0 |
| 열 머리 글자→노드 열 | 8 | 8 | 0 |
| 열 머리 피치 | 272 | 272 | 0 |

8/8은 위의 시각·동작 평가를 대신하지 않는다.

## 6. 기존 테스트 대체성

F=`e2e-learner-focus`, P=`e2e-pm4b-acceptance`, W=`e2e-map-workspace`, R=`e2e-map-return`, S=`e2e-map-study`, U=`e2e-map-supply`, N=[이번 독립 probe](../../../scripts/research/lm-w1/acceptance.mjs). **두 옛 테스트를 실행했다고 하지 않는다.** 각 소스의 단정에서 계속 필요한 의미만 옮겨 검증했다.

| 옛 조건 | 유지/의도된 변경 | 현재 검증/판정 |
|---|---|---|
| F-A 목표/기록 없음 | no_goal·목표 입력·지도 탐색 유지, 상시 Inspector/선택 카드는 삭제 | N legacy-no-goal PASS; 삭제 DOM은 제외 |
| F-A2 목표만 있고 기록 없음 | 근거 부족·기록 CTA·약점 확정 금지 유지 | N legacy-no-record PASS |
| F-B 우선 카드 1~3/자동 첫 카드 선택 | 카드 삭제, 번호 1~3·상단 행동으로 대체. 처음부터 초점을 강제하지 않음 | W16/17·30노드 및 실제 화면 확인. 카드 수/기본 선택 일치는 의도된 삭제 |
| F-B 카드 2→Inspector | TASK→초점→팝업→드로어로 대체 | W07/10/15, N first-click/selected-affordance/keyboard-entry PASS |
| F-B Inspector 의미 순서·근거 접힘 | 내부 DTO/내용 재사용, 열리는 위치만 드로어 | N legacy-inspector-disclosure 양쪽 PASS |
| F-G 미저장 PLAN·오류 없이 편집 열기 | 목록→모달 PLAN, no_workspace는 정상 미저장 상태 | W13, N PLAN 실제 캡처, U ledger no_workspace PASS |
| F-C 행동→문항→같은 TASK 복귀 | 유지 | R7건(저장 PLAN 포함), S 해부 복귀 PASS |
| F-D V2/S5 미지원·독해 과제 대체 금지 | 유지 | U④, 공급/자격 단위 테스트 PASS |
| F-E 테스트 교재 자동 학습 승격 금지 | 유지 | qualification/factory-integration/supply-ledger 단위, U의 실제 기존 자산 공급 PASS. 실제 공장 공급 수용 아님 |
| F-F 과거 보기 학습 시작 없음 | 모든 새 행동 표면에서도 유지 | R⑥+N legacy-past-readonly PASS |
| F-F 목표 변경 후 재계산/기록 보존 | 목표 변경·표시/복귀 유지. 자동 첫 카드 재선택은 삭제 | R④, N current-goal-edit, 기존 계약 unit PASS |
| P-영역 이름·개수/보류 표시·잘림 | 유지, 전체 보기의 내부 수평 이동 허용 | N geometry(clippedDomains=0), 내부 pan, W02 PASS |
| P-과거 기준 vs 전체 최근 기록 | 유지해야 하나 기준 표시가 누락됐음 | D04 수정; N past-current-record-label PASS |
| P-과거 목표/기록 직접 편집 금지·현재 링크 | 유지 | N past-readonly/current-goal-edit PASS |
| P-과거 PLAN 저장 차단 | 유지 | N past-plan-no-save PASS |
| P-과거 새로고침·뒤로가기 | 유지 | N past-reload/back-past PASS |
| P-H01 주요 조작의 44px 범위 | 기존 버튼/노드 재사용, 새 이동 링크도 높이 44 | 실제 기하·CSS/화면 확인. 모든 픽셀의 hit-test/전체 접근성 인증을 의미하지 않음 |
| P-H05 키보드 활성·focus 표시 | 카드 Space는 삭제, 노드/팝업/모달 키보드로 대체 | W09/10/15, N popup-first-action/Esc/modal-focus-trap, 실제 focus ring 확인 PASS |
| P-H05 전체/개요·뒤로가기·새로고침 | 유지. 새로고침시 자동 우선 1번 초점은 의도적으로 없음 | N legacy-view-history, W11/12/18 PASS |
| P-H05 캔버스 내부 가로 이동·페이지 넘침 0 | 유지 | N internal-horizontal-scroll 양쪽 PASS |
| P-H05 계정별 목표/기록 분리 | 유지 | N legacy-account-separation PASS, U⑤ 미노출 공급 분리 PASS |

원래 테스트를 ‘CI가 대신했다’고 처리하지 않았다. 초기 새 W/R/S/U만으로 직접 확인하지 못하던 목표 없음/기록 없음, Inspector 접힘 순서, 과거 편집/기준 설명, 계정 목표·기록, view history, 실제 역방향 노출과 팝업 진입은 N으로 보강했다. 학습 효과·도구 미지원·실제 Factory 미연결은 화면 테스트의 누락을 메워 완료할 대상이 아니다.

## 7. 복귀 7/7이 검증한 것과 검증하지 않은 것

원본 R은 합성 계정에 M2409 기록/목표를 입력하고 **E2 `e.evidence_location`/`ws.evidence-locate`**의 계획을 UI/API로 v1 저장한다. 다음 링크의 TASK·template·Workspace UUID·plan/goal 버전을 검사하고, 확인 모드 문항에서 해설을 열어 홈으로 돌아온다. 같은 묶음/계획 탭/v1 복귀, 다른 탭에서 v2 저장 뒤 최신 v2+변경 안내, 목표 변경 안내, 임의의 존재하지 않는 UUID 처리, 과거 행동 링크 차단을 검사한다.

따라서 **실제 PLAN 저장/버전/화면 복귀의 제한된 제품 경로는 실행됐다.** 예전 NOT_TESTED를 이 좁은 경로에 계속 붙일 필요는 없다. 반면 다음 주장은 금한다.

- R5의 실패 REPAIR→TRANSFER→CHECK, 지연 확인, 학습자 도달 또는 효과가 입증됐다는 주장.
- R에서 문항 수행을 원자 제출해 상태/NeedRank/PLAN 변화까지 검증했다는 주장. R은 해설 열람과 복귀이며 별도의 S/U가 한 수행 저장·미노출 변화만 검사한다.
- 존재하지 않는 UUID를 **실제로 존재하는 타인 Workspace**의 공격 테스트라고 부르는 것. R은 그 보안 시나리오를 포함하지 않는다.
- 과거 PLAN 내용을 복원하는 새 append-only 버전, 모든 충돌/네트워크 실패/권한 조합, 이전 목표 전체 복원까지 수용했다는 주장.

위 범위는 [LM-G1 감사](../../csat-learner/v62/GOAL_GAP_AUDIT.md)·[R5 수직 수용](../../csat-learner/v62/R5_VERTICAL_ACCEPTANCE.md)의 별도 과제로 남긴다. 이번 보강은 그 판정 함수/저장 구조를 수정하지 않았다.

## 8. 재현과 후속 진행

독립 probe는 기존 main용 환경 파일을 **출력하지 않고** 로드하고 실행별 소유 합성 계정만 생성·정리한다. 최신 실행의 cleanup 결과와 소스 hash를 보존한다. 공개 보고서에는 인증값·실제 학생 응답을 넣지 않았다.

```powershell
node --tls-max-v1.2 --env-file=<승인된 환경 파일> scripts/research/lm-w1/acceptance.mjs --base http://localhost:3007 --out <새 증거 디렉터리>
node scripts/research/lm-w1/verify.mjs
```

R/W/S/U는 기존 `scripts/csat/map/v62/e2e-*.mjs`를 같은 서버에 순차 실행한다. 지정 HEAD의 최초 관찰과 새 코드의 검증 출력을 분리한다. 렌더/로그인/리소스 실패를 정상 캡처나 계약 PASS로 바꾸지 않는다.

**LM-G1.1 진행 가능:** 이 화면 껍데기를 유지하며 `lifecycle-evidence.ts`, `v4/plan.ts`의 진행량/단계 준비 조건을 일치시키는 다음 작업으로 진행할 수 있다. LM-G1.2 전체 원자 저장 환류, 모든 저장 PLAN 수직 복귀, V2/S5 학습 도구, Factory 실제 연결, 학습 효과는 미완료로 남는다. 불필요한 새 화면·카드·대시보드는 권고하지 않는다.

## 9. 최종 실행 결과

| 검증 | 결과 |
|---|---|
| 독립 실제 Chromium, PC 1280/1440 | 42/42 PASS |
| 기존 Workspace / 저장 PLAN 복귀 / 해부 / 공급 | 36/36 · 7/7 · 6/6 · 6/6 PASS |
| 기하·계약·복귀·리스트 / 자격·공급 단위 | 45/45 · 49/49 PASS, skip 0 |
| TypeScript / 대상 TSX lint / diff 공백 검사 | PASS |

16개 소스 hash 중 11개 교육·저장·공급 엔진 파일은 지정 HEAD와 동일하다. 위 로컬 결과는 최신 PR HEAD의 필수 CI를 대신하지 않는다. 병합 커밋은 PR #270의 기록을 최종 기준으로 삼는다.
