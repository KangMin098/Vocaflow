<!-- docs/research/final-independent-20261018/FI011_REPAIR_SUPPLY_WORK_ORDER.md -->
# FI-011 바로잡기 자료 공급 구현 지시

## PRODUCT-FIRST FAST LOOP v3 — 현재 실행 지시

2026-10-19 사용자 v3 지시를 적용한다. **아래 A/B가 현재 구현 범위이며 이전 상세안은 참고다.** 별도 배정 표·새 오케스트레이터·추가 설계 승인·추가 문서는 필수 게이트가 아니다. 기존 FI-011/#304/PR303·세션·VG/LM/TASK 정본을 유지하고 구현 가능한 최소 변경으로 진행한다.

### A. 지금 구현: 별도 교수 자료로 바로잡기 실행

- **목적/필요 변화:** 독립2오답→보완 필요 이후, 평가 지문 재풀이 대신 실제 원리 설명·안내 연습으로 넘어간다. 자료가 없으면 정확한 대기 상태를 보인다.
- **선택안:** f079의 평가 재사용 제외를 유지/복원한다. 기존 stage_repair 수요의 model_explanation/guided_practice와 서버 공급·현재 자격·Runner·채점·G2를 재사용한다. guidance 결과는 practice/도움받은 수행, G2 evidence=false다. 도움을 independent로 표기해 과거 근거 변화를 피하는 우회 대신, 실제 수행 의미를 보존한다.
- **최소 구현 범위:** loader에 역할 있는 repair 링크를 별도로 전달하고, plan/lifecycle의 공통 성공 판정에 현재 회차의 적격 guided 정답을 연결한다. 기존 API의 인증·본인 delivery·TASK·현재 repairWindow 검증 뒤 서버가 작성한 attempt.response 계보(원인 시도/회차 시작/정확한 delivery)를 우선 재사용한다. 임의 client extra는 신뢰하지 않는다. 기존 원장으로 보장이 가능하면 새 배정 표/SQL을 만들지 않는다. 보장이 안 되는 구체 이유가 있을 때만 보류 SQL이 필요하다.
- **핵심 수용:** 실제 화면에서 자료 요청→교수/안내 연습→오답/재시도→정답→MAP/PLAN 다음 단계. 납품·읽음·시도 횟수만으로 성공 처리하지 않는다. 최초 독립 오답/G2·목표/PLAN 이력 불변, 연습은 독립/전이/재확인 수에 더하지 않는다. 기존 기출 repair 정책은 보존한다. 수요·계획량·가용량·진행·성공 준비를 섞지 않는다.
- **위험/검증:** 현재 사용자 수용 기준은 평가 자료 재사용 없음이다. c45fe30c2의 workspace/plan blob은 실패한8eaf와 동일하므로 그 반례를 재사용한다(같은 시험을 다시 돌리지 않는다). 수정 후에는 변경된 서버/공통 판정 검사와 같은 합성 계정의 실제1280/1440 대표 경로를 확인한다. 실제 DB 쓰기·사람 Gold/권리·정책 채택은 하지 않는다.

Claude는 이 방향으로 바로 착수하고, 구현 중 계약 조정이 필요하면 같은 FI/PR에서 근거를 반환한다. 일반 코드·UI 구현을 별도 사용자 기획 승인 때문에 멈추지 않는다. 아래 기존 「서버 발행 배정」은 필요한 신뢰 결속을 설명한 것이며 새 테이블 자체가 목적은 아니다.

### B. 선행 준비/독립 구현 가능: 새 독립 재확인 자료 공급

- **병목 근거:** actual c45fe30c2의 R5 초안은 model1/guided2/independent2/transfer2/delayed2다. `v62/demand.ts`의 recheck는 independent_check를 요청하며 `authoredStock`은 역할을 정확히 일치시킨다. 첫 확인2개를 이미 풀었다면 추가 독립 재확인 후보가 남지 않는다. delayed 자료가 있다는 사실을 자동 대체 공급으로 계산하지 않는다. 이는 **저장소 후보 재고 분석**이며 실제 적격 공급 실측이 아니다.
- **목적/선택안:** 현재 수요 역할을 바꾸는 대신, 같은 원리를 다른 지문에서 묻는 **새 independent_check 최소2개**를 추가한다. 기존 평가 ref/그룹/본문·Gold/hash는 변경하지 않는다. 새 항목은 현재 central_meaning 형식과 등록·자격·공급 경로를 그대로 사용한다. 새 정본·TASK·채점 형식은 필요 없다.
- **구현 소유:** Claude가 R5 창작 JSON/관련 validator·등록 fixture·승인 패키지의 새 항목 목록을 맡는다. A의 loader/Runner/판정 파일과 분리되므로 자료 작성·형식 검증은 A 완료 전 진행할 수 있다. 다른 TASK 전체 확장과 대규모 콘텐츠 생산은 이번 최소 경로 이후다.
- **핵심 수용:** 기존9개 항목의 내용/주석 정체성 불변. 새2개는 서로 다른 지문이며 교수·기존 확인·전이 지문과 ref/그룹/본문 정체성 충돌 없음. 문항별 정당한 대체 이유를 기존 Gold/채점 규칙으로 허용한다. 첫2오답 뒤 같은 학습자의 새 수요에 새2개만 공급되고, 정확한 첫 수행/G2→기존 CHECK 해소 또는 재보완→같은 목표의 새 PLAN·과거 불변으로 이어진다.
- **위험/검증:** 새 초안은 사람 Gold/권리/출시 승인 전이다. 실제 공급은 금지하고, 격리 DB의 명시적 합성 승인 fixture에서만 종단 실행한다. A 성공 이벤트 이후의 UI 연결만 A에 의존한다. 즉시 재확인과 지연 재확인을 구분하고 새 시간/성취 규칙을 만들지 않는다. 처음 추가한2개가 다시 부족해지면 부족 상태를 보존하며 무한 분량을 이번 게이트로 만들지 않는다.

### 병목 개선: 우선 CI 재설계 없이 반복 비용 줄이기

실제 Actions 기록 두 개를 읽었다([f079](https://github.com/KangMin098/Vocaflow/actions/runs/39201324730), [10ed](https://github.com/KangMin098/Vocaflow/actions/runs/39208426486)). f079 e2e554초 중 build222초·브라우저 설치25초·브라우저 실행120초, 별도 build278초·faultclosed build279초다.10ed는 e2e478초 중 build160초·설치19초·시험108초였다. job은 병렬이므로 이 시간을 더해 사용자 대기 절감량으로 주장하지 않는다.

지금은 방향 인계 미확인과 연속 진단 커밋의 전체 CI가 우선 병목이다. Claude는 진단 로그·최소 실패 spec을 가능한 기존 격리 환경에서 먼저 묶어 확인하고, 논리적 수정 단위로 최종 CI를 실행한다. 로컬 환경이 불가하면 그 사실과 실제 대체 경로만 기록한다. 지원되는 GitHub/VFC/handoff를 재사용하며 새 세션·오케스트레이터를 만들지 않는다. 브라우저 설치 캐시·빌드 공유·DB 공유·필수 job 생략은 이번 A/B의 선행 조건이 아니다. 특히 faultclosed 환경 격리와 최신 HEAD 최종 CI·safe-merge 보호는 유지한다.

**반납은 짧게:** 실제 세션/owner/task ID, 고정 HEAD, A/B 변경 범위, 핵심 검사/실제 브라우저 결과, DB/콘텐츠 승인 경계와 남은 결함. Codex는 변경 영향만 재검증하며 PRODUCT_CORE_READY / RELEASE_READY / FINAL_COMPLETE를 따로 판정한다.

---

## 이전 상세 설계 근거 — 참고/이력

[VF-TASK FINAL-FI011-REPAIR] Codex → 기존 Claude FINAL-OWNER

같은 FI-011 / #304 / PR303의 다음 구현 단위다. 새 목표/TASK/교육 기준을 만들지 않는다. Codex가 설계·독립 수용을, Claude `c513ff5b-86ef-44a3-8efd-7925a229614b`가 제품 구현·통합을 소유한다. **선택 설계안이며 Claude의 실제 구현 가능성/충돌 검토를 거쳐 확정한다.** 별도 Codex 세션은 UNBOUND이며 임의 생성하지 않는다. 현재 저장소의 `review.mjs`는 branch diff 리뷰만 구현하고 `--plan` 검토 기능은 없어 계획 교차 리뷰를 통과했다고 기록하지 않는다. 기존 Claude에 이 구체 문서의 구현 가능성/목적 대조를 요청하며, 사용자에게 같은 기획 승인을 다시 요구하지 않는다.

## 목적과 현재 코드 근거

서로 다른 독립 첫 확인2오답으로 열린 REPAIR에서 **평가 자료와 지문이 분리된 model_explanation / guided_practice**를 받고, 실제 안내 연습의 성공 기록으로 기존 바로잡기 운영 조건을 충족한 뒤 적용·새 독립 확인·PLAN에 연결한다. 교육 효과·숙달·사람 승인은 주장하지 않는다.

기준 제품은 `f0790c5cc91ad7988d14cf7605d31917d5ee5c21`다. 구현 전 최신 main/#250/#303 결합과 변경 파일 소유권을 대조한다.

|실제 근거|현재 의미와 필요한 연결|
|---|---|
|`map/v62/demand.ts` STAGE_ROLES.repair|이미 source_analysis/model_explanation/guided_practice·reason=stage_repair를 만든다. 이 역할 체계를 재사용한다. guided 현재 기본n=1은 전체 바로잡기 양을 구현한 값이 아니다.|
|`authored/server.ts` requestAuthoredSupply/attemptShape|기존 서버 재계산 수요·납품·현재 자격 검사를 재사용한다. 교수/안내 연습은 practice/practice로 기록한다.|
|`map/load.ts` loadAuthoredDeliveries|현재 평가3역할만 읽는다. 교수 자료를 읽어도 confirmLinks/독립 첫 시도에 섞지 않는 별도 repair 입력이 필요하다.|
|`map/v4/workspace.ts` repairable/stageItems|f079은 모든 authored 평가 ref를 제외한다. 이 제외를 풀어서 교수 링크를 끼워 넣지 말고 역할 있는 repair 후보 입력을 추가한다.|
|`map/lifecycle-evidence.ts` repairWindow/repairAttempts|현재 같은 막힌 ref의 뒤 시도만 받는다. **다른 ref인 새 guided를 납품만 해서는 성공에 도달하지 않는다.** 회차에 연결된 별도 instruction 경로가 필요하다.|
|`map/v4/plan.ts` repairGate/doneOf/stageLink|같은 회차/원리·성공 true가 기준이다. lifecycle과 PLAN이 같은 판정 함수를 쓰도록 함께 연결한다.|
|동일 파일의 doneOf(recheck), lifecycle의 transferAt|새 practice ref를 무조건 세면 교수 수행을 재확인 진행/전이 경험으로 오인할 수 있다. 역할/회차가 검증된 기록만 각 칸에 포함한다.|
|`authored/AuthoredRunner.tsx` done/finished|현재 완료 페이지는 새 시도를 막는다. 교수/안내 연습의 재시도는 별도 새 mutation·append-only 수행으로 허용하고 평가 완료 기록은 보존한다.|
|`knowledge/authored/authored-items.ts`, 보류 SQL|교수/평가 지문 그룹·본문 동일성 분리, intended_role, 사람 결정, 현재 자격, G2의 role_not_evidence 경계를 유지한다.|

관련 정본: [Workspace 계약](../../csat-learner/LEARNING_MAP_WORKSPACE_CONTRACT.md), [LM-G1.1 단계 준비](../../csat-learner/v62/LM-G1_1_R5_STAGE_READINESS.md), [LM-G1.2 운영량](../../csat-learner/v62/LM-G1.2_R5_VERTICAL_INTEGRATION.md). 해당 규칙과 충돌하는 구현은 같은 작업에서 근거를 반환하고 조정한다.

## 대안과 선택

|대안|판정|
|---|---|
|방금 틀린 authored 평가 ref를 practice로 바꾸어 재제출|채택하지 않음. 평가/교수 지문 분리와 충돌하며 최초 수행·노출 보존도 복잡해진다. 앞선 인계의 이 제안은 이 문서로 대체한다.|
|아무 다른 ref의 정답이면 바로잡기 완료|채택하지 않음. 다른 TASK·이전 회차·다른 Workspace의 성공이 섞일 수 있다.|
|새 teach/guided 납품 + 서버가 현재 바로잡기 회차에 결속한 수행|**선택.** 기존 역할/공급/G2를 재사용하고 부족한 회차 결속만 추가한다. 기출의 기존 바로잡기는 호환 경로로 보존한다.|

## 공급과 수요 줄

1. 저장된 동일 학습자/Workspace/목표 버전/PLAN을 서버에서 다시 읽고 현재 TASK가 repair인지 재계산한다. 서버의 repairWindow(verifiedAt 또는 이후 lastWrongAt, blocked refs)를 회차 근거로 쓴다. 클라이언트의 stage/role/episode/success/수요 본문은 권위가 없다. 오래된 PLAN·목표 충돌은 기존409/CAS 정책으로 반환한다.
2. 기존 `stage_repair` 줄을 유지한다. model_explanation은 현재 기본1의 설명 공급, guided_practice는 **이번 회차의 서로 다른 막힌 문항 수에 근거한 운영 요구량**이다. 원래의 「막힌 문항 수만큼」 계획을 재고0 때문에 줄이지 않는다. teach 읽기를 guided 완료 수에 더하지 않는다. planned/available/done/remaining·성공 준비를 분리하고, 이 양을 숙달 필요 총량으로 표시하지 않는다.
3. source_analysis 수요는 별도 기출 자산 필요로 남긴다. authored 자료를 csat_item/source_analysis로 위장하지 않는다. 해당 줄 공급0이 실제 있는 teach/guided 링크까지 무조건 숨기거나 전체 완료로 바꾸지 않도록 역할별 상태를 표시한다.
4. 수요·납품은 기존 canonicalDemand/멱등 키/사용자 결속을 따른다. 같은 요청 재전송은 같은 영수증, 같은 키 다른 본문은 충돌이다. 새 회차/목표/PLAN에 이전 수요를 몰래 덮어쓰지 않는다. 수요는 재고0이어도 남고 실제 유효 납품만 available로 센다.
5. 교수 역할별 적격 자격·public 출시 승인·정확한 revision/hash·권리 범위를 납품과 공개 시점에 다시 확인한다. 평가용 Gold/assess 자격을 교수 자격으로 대체하거나 반대로 승격하지 않는다. `requires.gold=false`는 평가 Gold 자격을 요구하지 않는 역할 정의이지 사람 검수 완료 표식이 아니다. 이번 작업으로 사람 Gold/권리·콘텐츠 출시를 승인하지 않는다.
6. 교수 그룹/본문은 모든 평가 그룹/본문과 분리한다. 새 ref/그룹 이름만 바꿔 같은 본문을 돌려주지 않는다. teacher와 guided는 교수 클래스 안에서 기존 규칙에 따라 공유할 수 있으나 그것을 새 지문 전이로 세지 않는다.

## 회차와 실제 수행의 결속

**서버가 발행한 추가 전용 바로잡기 배정**을 기존 수요/납품·원장에 연결한다. 임의 client extra만 보고 성공을 인정하는 방식은 금지한다. 기존 표로 동일 신뢰 경계가 구현 가능하면 재사용 근거를 반환하고, 없으면 최소 보류 SQL로 `workspace_repair_assignment`(가칭) 관계를 추가한다.

배정은 user/workspace/template/task/goal-version/생성 PLAN-version, 원래 독립 실패 attempt IDs와 blocked refs, 회차 시작 시각, 역할별 demand-line/delivery/qualification/revision/hash를 결속한다. 교수 자료 자체 ref는 원래 평가 ref로 위장하지 않는다. 하나의 배정 항목이 어떤 막힘을 다루는지 서버가 정하고, 문항 ref만 맞는다고 TASK/회차를 건너 결속하지 않는다.

- 발행 권한은 인증된 실제 사용자 요청을 검증하는 기존 서버 경로에 한정한다. 학습자가 직접 배정/성공/episode를 INSERT·UPDATE하거나 service_role 자격을 얻는 경로는 만들지 않는다. DB도 FK·사용자·Workspace·TASK·delivery role·현재 revision 경계를 확인한다. 새 SECURITY DEFINER/RLS/GRANT는 역할별 부정 대조를 포함한다.
- 학습자 조회는 본인 배정만. UPDATE/DELETE로 이전 배정/attempt/PLAN을 고치지 않는다. SQL이 필요하면 **보류 파일·원본 hash·검증·승인 패키지**까지 작성하고 개발 DB에 적용하지 않는다. 이미 적용된 migration 바이트는 바꾸지 않는다.
- guided 제출은 기존 서버 Gold 채점과 G2 writer를 사용한다. attempt에는 배정 계보와 정확한 delivery를 서버에서 연결하고, practice/practice·실제 도움·세션·hash·synthetic·수신 시각을 남긴다. `workspace_delivery_attempt.evidence=false`이며 이유는 기존 practice/role 규칙을 따른다. binding 장애는 성공처럼 숨기지 않고 복구 상태를 보인다.
- 같은 답 응답 유실 재전송은 같은 mutation/시각/본문으로 한 번만 저장한다. 피드백 뒤 다시 풀기는 명시적 재시도이며 새 mutation/새 응답·시도 행이다. 첫 평가 시도/노출/G2와 지난 guided 결과는 수정하지 않는다. 두 기기·동시 제출도 서로의 다른 시도를 잃지 않는다.
- 새 회차가 열리면 옛 배정 성공은 새 회차 성공이 아니다. 서버가 현재 회차를 확인하며, 더 최근 PLAN에서 같은 회차가 유지되는 정상 진행까지 불필요하게 막지 않는다. 폐기/다른 목표의 배정은 현재 계획 성공으로 쓰지 않는다. 과거 결과는 과거 회차/목표 화면에 남는다.

## 단계와 화면의 동작

공유하는 repair 판정 함수에 **기출 기존 경로 + 검증된 instruction 배정 경로**를 둔다. instruction 성공은 현재 회차·같은 TASK·정확한 배정/납품의 guided 서버 채점 `isCorrect===true`인 실제 수행이다. 틀림/null·teach 읽음·납품됨·해설 열람·binding 실패·다른 TASK/회차는 성공이 아니다.

기존 LM-G1.1의 「이번 회차 정답 하나 이상이면 준비」 정책과 `repairAt`을 그대로 따른다. 모든 계획 문항 정답을 새 필수 기준으로 추가하지 않는다. 수행량이 계획량에 닿았다는 이유만으로 stage를 넘기지 않는다. 해당 성공은 **안내받은 바로잡기 성공**이며 독립 능력 해소/목표 달성이 아니다. 해소는 기존 새로운 미노출 독립 CHECK가 판정한다.

|상태|사용자에게 보이는 행동·진행|
|---|---|
|유효 자료0/미설치/사람 검수 대기|repair_material_needed 또는 정확한 설치/검수 대기 이유. 서버 수요는 남고, 실행 가능한 공급 요청·지도 복귀 안내를 제공한다. 평가 재사용 CTA 없음.|
|teacher만 유효|「원리 다시 보기」를 열 수 있다. 읽기 완료는 설명 읽음으로만 남고 guided 가용0·성공 미확인은 그대로다.|
|guided 유효|「안내받아 바로잡기」. 도우미·자기 설명·형식별 실제 응답과 피드백. 평가/독립 확인 명칭을 사용하지 않는다.|
|guided 오답/null|바로잡는 중. 힌트/해설·새 재시도 가능, 이전 답과 기록을 보존한다.|
|guided 정답·정상 결속|바로잡기 성공 기록. 같은 원리의 다른 적격 지문에 적용으로 연결한다. 독립 확인 수·정답률·숙달률을 올리지 않는다.|
|적용 자료 부족/적용 수행|기존 전이2지문 운영량·가용 부족·경험/독립 근거 분리를 유지한다. 없는 자료를 완료 처리하지 않는다.|
|새 독립 CHECK와 이후 실패|기존 미노출·도움 없음·서로 다른 지문·시간/회차 규칙. 다시 막히면 새 repairWindow/배정으로 돌아간다.|

`TaskInspector`, `WorkspaceList`, `PlanSection`, Runner 결과/복귀는 같은 TaskPlan·서버 판정을 표시한다. 설명 읽음/안내 연습 완료/독립 확인 근거를 별도 문구로 보여 준다. 교수 링크는 confirmLinks, independentItems, CHECK/recheck 진행, transferredKeys, transferAt/transferDone에 섞이지 않는다. 기존 넓은 ref/phase 필터를 그대로 재사용하지 않는다.

PC1280/1440의 기존3B 화면 골격을 유지한다. 새 팝업/탭을 늘리기보다 현재 단계 안에서 다음 행동·차단 이유·기록 보존·지도 복귀를 연결한다. 키보드 focus·닫기·재시도·새로고침·다른 탭 복귀를 검증한다. 제품 화면에 DB 용어/AI 승인 정책을 노출하지 않는다.

## 구현 소유 범위와 최소 검증

Claude가 실제 변경이 필요한 파일만 소유한다: `map/load.ts`, `lifecycle-evidence.ts`, `v4/{workspace,plan,compose}.ts`, evidence 계보 어댑터, `v62/{demand,persist-contract}.ts`, `authored/server.ts`, 공급/attempt API, authored page/Runner, 위 지도 컴포넌트, 해당 테스트. 파일명/의존은 실제 트리를 따른다. DB 필요 시 보류 SQL과 역할별 테스트만 추가한다. Codex는 이 제품 파일을 동시에 수정하지 않는다.

1. 현재 f079 양성 경로를 이어 **같은 합성 사용자**의 repair 대기→실제 공급 API→teacher→guided 오답→새 guided 정답→지도/PLAN→다른 적격 전이→새 독립 CHECK→PLAN을 연결한다. fixture가 도와주는 것은 재고/자격뿐, stage/정오/evidence/성공 응답을 mock해서 종단 통과시키지 않는다.1280/1440 모두 실제 Runner/DB 단언을 제출한다.
2. 평가 ref/그룹/본문 재사용 거절, instruction 정답에도 독립 수/transfer/recheck 진행 불변, 읽음만으로 성공 없음, 같은TASK 다른회차/목표/사용자/Workspace 혼입 거절, 재확인 실패 이후 옛 성공 무효를 대조한다. 기존 기출 repair 성공 대조도 유지한다.
3. 실제 격리 PostgreSQL에서 사용자별 RLS/GRANT·배정 발행 권한·원자성·동시 납품·철회/revision·새 요청/역사 영수증을 검증한다. 실제 서버 API의 무권한 배정·클라이언트 성공 위조를 거절한다. 민감한 공격 절차는 기존 비공개 경로만 사용한다.
4. 서버가 커밋한 뒤 응답 유실→동일 재전송, 반복 실패→새 시도 성공, 두 기기 동시 서로 다른 답, binding 실패→복구, 새로고침/복귀에서 모든 과거 기록과 PLAN v2/v3 불변을 확인한다.
5. 실제 최신 main/#250/#303 통합 소스에서 타입·lint·관련 단위·빌드·최종 CI·목적 리뷰를 제출한다. 변경 없는 기존 검증은 재사용한다. #314는 PROPOSED로 유지하며 안전 보호 경로·DB/Gold/권리 승인 정책을 이 작업에서 바꾸지 않는다.

반납: 작업 태그·실제 세션/owner/task ID·구현 가능성/계약 조정 이유·고정 HEAD·변경 파일·원본 SQL hash/개발 DB 미적용·실제 CI·두 폭 브라우저/격리 DB 증거·최초 실패/정상 대조·남은 A~H를 제출한다. 합성 교수·수행 성공은 실제 콘텐츠 승인·실학습 효과가 아니다. 설계/구현 조정은 같은 FI/PR에서 근거와 함께 되돌려 주고 새 사용자 기획 승인을 반복 요청하지 않는다.
