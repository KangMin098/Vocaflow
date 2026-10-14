# Factory Qualification 연구 인수인계

T-0030, FQ1.0. 제품 구현 PR과 분리한 연구 산출물이다. 콘텐츠 후보를 공급 자격·학생 평가 자격으로 자동 승격하지 않는다.

## 기존 제품 계약에 연결할 정보

| 기존 경계 | 연구에서 보존할 정보 |
|---|---|
| WorkspaceDemand / line | key, definitionVersion, 정확한 TASK·role, 요구 산출물; 유형 검색 조건과 수행 근거 분리 |
| FactoryOrder | 콘텐츠·원천·분석·Gold revision/hash, qualification rules version, 생성 당시 원천 결속 |
| ContentArtifact | immutable artifact digest, A–H 상태/이유/방법/근거, 역할 후보·차단 사유, 실제 승인 기록 참조 |
| WorkspaceDelivery | 해당 artifact와 수요의 결속, 실제 실행 형식·지원 여부, guided/independent 노출 조건 |
| 학생 평가 기록 | 첫 응답 봉인, 힌트·해설 전 노출, 공유/동일 본문 노출, 실제 경과 시간·중간 활동 |

이는 필드·계약 제안이며 새 DB 테이블·RPC·제품 저장 기능을 구현한 결과가 아니다. 실제 권한을 가진 검수/권리/출시 기록은 제품 서버가 검증해서 제공해야 한다. 연구용 true 플래그나 AI 설명은 승인 기록이 아니다.

[QualificationSpecification](data/qualification-specification.schema.json)과 [QualificationResult](data/qualification-result.schema.json)를 제공한다. 생성 결과는 입력과 다시 계산해 TASK·revision·축·근거·역할·출시 플래그 전체가 같은지 검사한다. 자연어 원문 의미와 실제 승인 기록의 진위를 자동 판정하는 기능은 아니다.

기존 `supply.ts Qualification`에는 producible을 생산 가능성으로 유지하고 rights=F+실제 권리 승인, content=A/B/C, teaching=D, assessment=E+인간 Gold/채점/학생 검증, learner=G, runnable=H로 연결한다. unknown/not_applicable은 null이다. 요약 객체만 전달하면 A/B/C의 차이가 사라지므로 상세 원장을 함께 전달한다. 역할별 최종 자격은 이 요약 boolean만으로 결정하지 않는다.

## 보존과 재현

기존 v12–v15 파일·첫 판정을 변경하지 않았다. `registration.json`은 기존 보존 대상과 TASK 코드북의 hash를 고정한다. 신규 첫 검토는 연구 활동/공장 주·반증/Gold 저자·독립 검토 각각 별도 hash로 보존한다. 원본 전문·정답·Gold·응답은 `scripts/research/factory-qualification/local/`와 기존 ignored 연구 입력에만 있으며 Git에 포함하지 않는다.

```powershell
node --test scripts/research/factory-qualification/*.test.mjs
node scripts/research/factory-qualification/research-activities.mjs --check
node scripts/research/factory-qualification/gold-review.mjs --check
node scripts/research/factory-qualification/gold-comparison.mjs --check
node scripts/research/factory-qualification/runner.mjs --check
node scripts/research/factory-qualification/source-fixtures.mjs --check
node scripts/research/factory-qualification/integrity.mjs --check
node scripts/research/factory-qualification/public-validation.mjs
node agents/scripts/check.mjs
```

실제 입력이 필요한 재현은 봉인한 private 파일이 있어야 한다. DB 원천을 새로 조회하는 작업은 같은 snapshot 재현이 아니므로 신규 감사 버전으로 남긴다. 제품 브랜치는 다른 작업에서 변할 수 있으므로 보존된 감사 시각/HEAD/파일 hash를 사용한다.

최종 검사: FQ 회귀 49/49, 에이전트 설정 15/15, 실제 입력 재계산·공개 메타데이터·문서 링크 검사 통과. source guard 9개는 예상 fail 7/unknown 2를 올바르게 감지한 결과이며 해당 원천의 적격 승인이 아니다. 보존 hash 검사는 v15 공개 59/private 7, v14 공개 metadata 82, 최초 private 봉인 7, 표본 metadata chunk 13을 확인했다. v14 전체 전문의 재검수 완료를 뜻하지 않는다.

## 완료 범위와 보류

실제 연구 콘텐츠 8개·14역할, 공장 12문항, 새 합성 Gold 10응답·40facet를 검토하고 자격 경계를 실행 가능하게 만들었다. 연구용 검사 통과와 실제 공개·평가 자격은 별도이며 후자는 모두 0이다. 세부 결함은 [결과 보고서](FQ1-REPORT.md)와 최초 판정 원장을 따른다.

후속 제품 작업은 현재 후보의 지시/의미/Gold 결함을 새 revision에서 수정하고, 원천 결속·권리 승인·역할별 실제 노출 계약·실행기 지원을 확보한 뒤 자격 입력을 다시 검토해야 한다. 직접 평가 승격에는 인간 Gold와 실제 학생 채점·측정 검증이 추가로 필요하다. 본 연구는 이 절차를 대신 수행했다는 승인을 제공하지 않는다.
