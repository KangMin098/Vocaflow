# QualificationSpecification / QualificationResult

공장의 유형 태그는 탐색 조건이다. 자격은 특정 콘텐츠 revision·TASK·수요 줄·역할 및 근거에 결속한다. `qualification.mjs`는 원문 의미를 자동 이해하거나 승인자를 대신하지 않고, 결속·충돌·역할 조건을 실행 검사한다. 연구 후보를 학습자에게 공급하지 않는다.

| 축 | 검사 대상 | pass의 제한 |
|---|---|---|
| A | 원천·제시형·동일형 키·입력 버전 | 실제 로컬 원문 대조/결속의 범위. 권리 승인과 다름 |
| B | 주체·조건·범위·극성·강도·시점·관계 | 실제 생성물/해설의 의미 QA. 의도적으로 표시된 오답 자극과 출처 오기는 분리 |
| C | 실제 TASK 수행과 관찰 산출물 | 유형/자동 태그만으로 pass 불가 |
| D | 교수 설명·대조·힌트·피드백·응답 요구 | 교수 효과나 학생 수행의 증거가 아님 |
| E | 키·설명·부분/동등/오답/보류 rubric | AI 명세 QA와 인간/실제 응답의 평가 자격은 별도 |
| F | 이용·각색·배포·출시 권리 | usable 캐시/메타데이터 존재는 실제 승인 기록이 아님 |
| G | 역할별 학습자 노출·도움·첫 응답·시간 | 연구자 노출이나 합성 시나리오가 실제 학생 기록을 대신하지 않음 |
| H | 실제 실행 형식·아티팩트·상호작용 | 정적 runnable:false 계약과 실제 실행 검증을 구별 |

모든 축은 pass/fail/unknown/not_applicable, 이유·검수 방법·대상 revision·근거ID/hash를 가진다. pass/fail은 콘텐츠 ID/revision이 같은 검수 증거에 결속한다. unknown을 true/false로 바꾸지 않는다. 필수축의 not_applicable은 면제가 아니다.

입력은 기존 WorkspaceDemand의 key/definitionVersion/줄의task/role을 참조하고 콘텐츠·원문·분석·Gold revision, 근거, 실제 승인 참조, 노출·역할 조건을 더한다. 결과는 A–H 원장·후보 역할·차단 역할·사유·추가 검수와 제품 crosswalk를 보존한다. 연구용 demand fixture는 실제 학생 주문이라고 표시하지 않는다.

`supply.ts Qualification`의 producible은 생산 능력만이며 A와 혼동하지 않는다. rights←F+승인, content←A/B/C, teaching←D, assessment←E+인간Gold/실제채점·학생검증, learner←G, runnable←H. unknown/not_applicable은 null, fail은 false로 대응한다. 원본 A–H와 evidence를 함께 보존하여 boolean|null의 손실을 막는다.

권리·출시·인간·평가 true 플래그만으로 통과하지 않으며 실제 검증된 승인 기록의 대상/revision/hash/권한 주체를 요구한다. 검증기는 그 기록을 생성하거나 법률·인간 승인을 부여하지 않는다. 제품 적용 시 서버의 기존 권한 있는 검수 원장만 이 입력을 공급해야 한다. 연구의 모든 실제 콘텐츠는 승인 미확인으로 공개/평가0을 유지한다.

현재 FactoryOrder/ContentArtifact/WorkspaceDelivery의 제품 branch와 main 차이는 [제품 감사](FQ1-PRODUCT-AUDIT.md)에 있다. 새 테이블을 자동 요구하지 않고 기존 JSON 객체에 source_versions·qualification_rules_version·axis evidence·role eligibility·immutable artifact digest와 승인 참조를 결속하는 어댑터를 제안한다. 제품·DB에 연결하지 않았다.
