# FQ1.1 — 실제 제품 자격 계약과 승인안 C 교차표

2026-10-14. 제품·DB 읽기 전용 감사다. 제품 코드·DB·API를 바꾸거나 합성 계정 E2E를 실행하지 않았다. 파일별 SHA·main 포함 여부·관찰 시각은 [product-audit.json](./data/product-audit.json)에 보존했다. 작업 중 Claude 브랜치가 진행되었으므로 이 파일은 현재 상태의 영구 보장이 아닌 관찰 기록이다.

## 실제 상태와 구분

PR [#253](https://github.com/KangMin098/Vocaflow/pull/253), [#254](https://github.com/KangMin098/Vocaflow/pull/254), [#255](https://github.com/KangMin098/Vocaflow/pull/255)는 GitHub 직접 조회에서 모두 MERGED다. `origin/main`은 `431e2895644a36d7749b91c7406f5f15ee2047ef`다. Claude 작업 HEAD는 첫 조회에서 같은 값, 파일 해시 수집 시 `5b3b84433f4e7c22b32b22fb48f78be969fc3935`였다. `qualification.ts`, FQ snapshot importer/test, 연습 발행 SQL은 main에 없는 제안 파일로 읽었다.

DB `to_regclass`로 `content_qualification`, `workspace_content_demand`, `factory_order`, `factory_order_event`, `workspace_content_delivery`가 모두 없음을 확인했다. 관련 세 RPC와 대상 표 정책도 찾지 못했다. 표가 없으므로 자격 승인 행 수를 0으로 집계하지 않고 **집계 불가**로 남겼다. 기존 `learner_workspace`는 존재한다. `knowledge_applications`의 `csat_item_task`는 active 24행 모두 출시 승인자·시각 필드를 갖고, draft 5행은 갖지 않는다. 이는 필드 존재 관찰이며 승인자의 법적 권한·범위나 실제 학생 효과를 새로 입증한 수치가 아니다.

## 세 계약의 필드가 같지 않다

| 연구 축 | `supply.ts` 7요약 | 승인안 C 7열 | 손실 및 유지 방법 |
|---|---|---|---|
| A 원천·B 의미·C TASK | content | content | 서로 다른 실패 원인·판정 방법·근거를 하나로 압축. 상세 축·증거를 JSON에 보존 |
| D 교수 | teaching | teaching | 지시문/Gold 불일치와 발판 조건을 상세로 보존 |
| E Gold·루브릭 | assessment + 추가 승인 | **gold**, assessment | Gold 논리 검수와 인간/채점/학생 검증 승인을 분리 |
| F 권리·출시 | rights | rights | AI pass나 공개 boolean을 실권리 승인 기록으로 대체하지 않음 |
| G 학습자별 | **learner** | **열 없음** | 특정 사용자·공급 시점 서버 재조회. 콘텐츠 전역 true로 저장하지 않음 |
| H 실행 | runnable | runnable | 실행 화면·계약·검증 시점을 보존 |
| 공장 생산 가능 | producible | producible | A~H의 pass로 추론하지 않고 별도 공정 능력 근거 |

FQ1.0의 supply 요약을 승인안 C의 7열로 그대로 복사하면 **learner와 gold를 혼동한다**. 기존 결과를 고치지 않고 FQ1.1 새 adapter에서 명시적으로 구분한다. `unknown/not_applicable → null`, 하나의 실제 fail은 관련 요약 false, 필요한 축의 unknown은 공급 보류다. 표의 `gold=true`만으로 assessment=true를 만들 수 없다.

## 관찰된 제안 코드의 경계

`qualification.ts`의 `FqResult`는 콘텐츠 id/revision, task, role, 축별 state, eligibleRoles, publicQualified, assessmentQualified를 갖는다. `bindResult`는 id·revision·TASK·role 불일치를 거절한다. 하지만 artifact/source/analysis/Gold SHA, 증거 revision, 검토 방법, 실제 승인자 권한·범위를 받지 않는다. `toSupplyQualification`은 두 공개/평가 boolean을 신뢰하며, `supplyEligible`는 eligibleRoles 및 학습자 노출을 검사하지 않는다. 노출은 호출자가 계산한다는 경계가 코드 주석에 있으나 이 함수 자체는 그 계약 이행을 입증하지 않는다.

`import-fq1.mjs`는 20개 최초 판정의 state와 콘텐츠 revision을 옮기되 상세 evidence·method·source/Gold revision·근거 SHA를 제거한다. 연구 UI용 상태 snapshot과 승인 가능한 서버 원장은 용도가 다르다. 실제 소비자인 `TaskInspector`는 기존 `supplyFor`를 사용하며 이 제안 adapter는 해당 코드에서 소비하지 않는다.

`persist-contract.canTransition`의 delivered 진입은 qualificationId 문자열이 존재하는지만 검사한다. 실제 원장 행, 승인 범위, 콘텐츠 revision/hash, 수요 소유자·TASK·role 재검증은 제안 RPC 구현에서 추가해야 한다. SQL의 `decided_by text`와 service_role 쓰기 제한만으로 진짜 권리 승인자의 자격을 인증할 수 없다.

## 승인안 C의 최소 보강 제안

아직 실제 표가 없으므로 기존 **승인안 C 설계**의 JSON 열 하나 `qualification_payload jsonb`로 상세 계약을 보존하는 안을 우선 비교한다. 기존 `artifact_kind/ref/revision`, task_id, role, 7nullable 열, decided_by/at, note를 유지한다. 별도 원문·정답·Gold 전문은 넣지 않는다.

```json
{
  "schema_version": "FQ1.1-proposal",
  "rules_version": "FQ1.1",
  "artifact": {"kind": "dcp_item", "ref": "opaque-reference", "revision": "new-revision", "sha256": "verified-content-sha256"},
  "task_id": "v.contextual_sense",
  "role": "guided_practice",
  "versions": {"source": "bound-reference", "analysis": "bound-reference", "gold": "bound-reference", "source_policy": "policy-reference"},
  "axes": {"A": {"state": "unknown", "evidence_refs": [], "method": "not_verified", "review_revision": "review-reference"}},
  "evidence": [],
  "approval_refs": [],
  "reviewed_at": "verified-review-time",
  "claim_scope": "research_candidate",
  "limitations": ["A through H are mandatory in the complete payload; this is a shortened field illustration"]
}
```

서버는 승인 ref를 신뢰된 registry에서 읽어 실제 authority·권한 범위·유효기간·철회 상태·승인 TASK/role·artifact/source/analysis/Gold revision/hash를 검증한다. 이 JSON의 문자열·boolean만으로 검증되었다고 판단하지 않는다. 공급 시에는 세션 사용자와 수요 소유자를 확인하고, 첫 시도·같은/공유/정규화 동일 본문·해설·힌트·지연 노출 원장을 **현재 시점**에서 다시 읽는다. 최종 승인과 delivery insert 사이 경쟁 상태를 막을 원자 계약도 필요하다.

비교: 위 JSON 보강은 대량 DCP UPDATE 없이 검수된 자격만 적재하고 상세 축을 잃지 않는 이점이 있다. 실제 schema migration·validator·승인 참조 resolver·인덱스·RLS·RPC 비용은 여전히 남는다. 별도 evidence/approval 표는 독립 철회·정규화·검색을 쉽게 하지만 신규 표·참조 무결성·운영 비용이 증가한다. 우선 기존 실제 승인 기록을 참조하고, 독립 승인 관리가 필요하다는 실측이 생길 때 새 표를 비교한다. 이번 연구는 어느 안도 적용하지 않는다.

## 역할·노출·자동화 경계

같은 원천의 model_explanation은 출시 및 학습 정책이 맞으면 사용할 수 있으나, 그 해설을 본 학습자의 새 independent_check 증거로 같은 본문을 승격하지 않는다. 안내된 연습은 assisted로 보존한다. 전이는 다른 학습 본문과 같은 수행 목표, 지연은 실제 경과와 중간 노출, 같은 문제 재인은 각각 추가 관찰이 필요하다.

기존 `study-items.ts`는 아직 안 푼 확인·전이 문항의 해설 링크를 막고 `sharedPassageUnchecked=true`를 반환한다. `as-is.ts`는 과제 키가 달라도 본 문항과 기록한 시험 문항을 unseen에서 뺀다. 이는 보존해야 할 기존 R5 규칙이지만 공유·정규화 동일 본문까지 검증한 것은 아니다. 새로운 연구 보류를 기존 승인된 R5 자산 전체의 불가 판정으로 복사하지 않는다.

자동화 가능: schema·hash·revision·TASK/role·정책 버전·캐시 freshness·필수 근거 존재·허용 상태·노출 원장·중복 공급. 자연어의 참뜻·유일 정답·교육 효과·법적 권리·승인자의 진정한 권한을 hash나 AI 일치가 대신 확정하지 않는다. 인간 콘텐츠/Gold 검수, 외부 권리 승인, 실제 학생·채점 검증은 별도 상태와 승인 기록을 요구한다.

## 요청된 제품 E2E의 현재 범위

| 시나리오 | 실제 발견한 구현 | 남는 검증 |
|---|---|---|
| 부적격 공장 공급 차단 | factory_candidate 및 제안 순수 검사 | 실제 delivery 서버·DB E2E 미실행 |
| 적격 기존 R5 정상 유지 | 기존 확인/전이 공급과 e2e-map-supply 스크립트 | 이번 읽기 전용 감사에서 재실행하지 않음 |
| V2 지도 연습 검수 대기 | production pilot release=hold, 활동 단위 미지원 | 승인/실행 화면 연결 전 공급 불가 |
| revision 변경 후 재검수 | bindResult의 revision 불일치 거절 | source/analysis/Gold/hash와 원장 무효화 서버 검사 |
| 타 사용자 이력 거절 | learnerContext가 세션 user.id를 사용 | 새 factory delivery의 소유권/RLS E2E 없음 |
| 같은 수요 중복 방지 | canonical/signature 순수 계약·제안 unique | 실제 원자 delivery insert/충돌 E2E 없음 |

e2e-map-supply는 합성 사용자 생성·목표/응답 저장·삭제를 수행하므로 이번 제품/DB 불변 연구에서는 실행하지 않았다. FQ1.1 연구용 gate 테스트 통과를 제품 E2E 실행이나 학생 효과로 표시하지 않는다.

재현: `node scripts/research/factory-qualification-v11/product-audit.mjs --check`는 저장된 제품 파일 snapshot과 현재 파일의 변화를 보고한다. 변경은 다른 작업자의 정상 진행일 수 있으며 기존 관찰을 현재 승인으로 승격하는 근거가 아니다. 등록된 출력이 있으면 재수집으로 덮어쓰는 실행을 거절한다. 새 감사는 별도 revision 출력 경로와 새 SQL receipt를 마련한 뒤 수행한다.
