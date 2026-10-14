# FQ1.1 Claude Code 제품 인수인계

목적은 검수되지 않은 콘텐츠가 특정 TASK의 학습·평가 자료로 공급되는 것을 막는 것이다. 제품 DB·API·UI는 변경하지 않았다. 연구 수정안은 별도 artifact 후보이며 생산 적재·공개를 실행하지 않았다.

## 즉시 차단할 기준

- 기존 연구 5이슈가 있는 revision을 수정·검수 완료 자료로 취급하지 않는다.
- 실제 DCP B fail2/E fail4는 겹친 고유4문항이다. 해당 첫 revision의 설명/키·근거 실패를 유형 태그·다른 표본 성공으로 상쇄하지 않는다.
- TASK 태그만으로 C pass, 정답 키만으로 E pass, 오래된 cache로 현재 A/F pass를 만들지 않는다.
- artifact/source/analysis/Gold/policy revision/hash가 검수와 다르면 기존 승인을 상속하지 않는다.
- 새 연구 수정 revision의 AI 검토를 권리·인간 채점·학생 평가·실행 승인으로 승격하지 않는다.

정확한 수정/불일치는 [연구 활동](FQ11-DEFECT-REPAIRS.md), [공장 문항](FQ11-DCP-REPAIRS.md), 별도 독립 첫 원장을 따른다. 수정 저자의 기대와 독립 판정이 다르면 두 결과를 남기고 미해결 범위만 HOLD한다.

## 승인안 C 최소 보강

현재 제품 snapshot의 실제 필드와 변경 비용은 [교차 매핑](FQ11-QUALIFICATION-CROSSWALK.md)에 있다. 새 테이블을 필수로 요구하지 않는다. 기존 qualification payload/jsonb에 schema/rules version, immutable artifact subject, TASK·role, source/analysis/Gold/policy refs, A–H 상태·검수 방법·revision·evidence, approval refs·scope·limitations를 넣는 안을 우선한다. 7개 요약은 이 원장의 파생값으로 둔다.

현재 제안 importer가 상세 근거를 버리고 public/assessment boolean을 전달하는 구조는 승인 범위 검증을 대신하지 못한다. 실제 서버가 record actor의 권한·대상·철회·버전을 확인해야 한다. 사용자 입력 `decided_by` 문자열이나 연구용 승인 true를 신뢰하지 않는다. approved라는 과거 행이 존재해도 새 콘텐츠 revision에는 무효다.

현재 승인안 C의 7열에는 `gold`가 있고 `learner`가 없다. FQ1 이전 supply 요약을 그대로 복사하지 않는다. 학습자별 접근·공유/정규화 본문·설명·힌트·첫 응답·시간 조건은 공급 시점에 서버가 재검증한다. [역할 검사기](FQ11-ROLE-GATES.md)는 이 경계의 순수 참조 구현이며 실제 권한/DB/RLS를 대체하지 않는다.

[기계 계약](data/handoff-contract.json)은 최소 JSON payload의 schema와 전 축 unknown인 예시, C 요약 열, 실제 실행 0 상태를 함께 제공한다. null revision/hash 예시는 공급 가능한 검수 행이 아니다. 실제 서버 원장에 연결할 때 빈 binding을 차단하는 역할 검사기를 함께 적용한다.

## 최소 제품 E2E 수용 사례

| 시나리오 | 제품에서 확인할 결과 | 이번 연구 실행 |
|---|---|---|
| 부적격 공장 revision 공급 | 정확한 axis/revision 사유로 보류 | 명시 계약·가드 테스트만 |
| 기존 적격 R5 유지 | 현재 유효한 기존 승인·TASK·역할·노출 계약이면 정상 경로 유지 | 실제 제품 실행 미수행 |
| V2 지도 연습 후보 | 연구 후보/검수 대기; 공급 없음 | 연구 후보 경계 테스트 |
| 동일 콘텐츠 revision 변경 | 기존 검수 무효·새 검수 대기 | 변경 변이 테스트 |
| 다른 사용자 공급 이력 조회 | 서버/API/RLS 접근 거절 | pure identity check; 제품 미수행 |
| 동일 수요 중복 공급 | 원자적 unique/idempotency 보장 | pure claim check; DB 경쟁 미수행 |

연구 게이트의 fixture 양성 결과는 실제 R5 승인·제품 E2E 통과 기록이 아니다. legacy R5를 새 AI 검토가 없다는 이유만으로 폐기하지 않되 기존 승인 범위·revision·노출을 실제로 검증해야 한다.

## 원천과 생성 시점

FQ1 표본 fresh5/stale5/missing2와 생성 당시 원문 revision 부재를 그대로 보존했다. 새 후보는 지금 제공된 원문 snapshot으로 만들었다는 연구 provenance를 갖는다. 이것은 기존 DB 문항의 생성 당시 provenance를 복원했다는 뜻이 아니다. `created_at`을 source revision으로 사용하지 않는다. 변경 전/후 hash, 원천 정책, 분석/Gold revision, 검수 시각, 승인 기록 범위를 함께 저장한다.

## 정확한 완료 상태와 재현

연구 후보·AI 내용 재검토·인간 콘텐츠 검수·권리 승인·직접 평가·학습자 실행·교수 효과를 따로 기록한다. 실제 학생 응답·인간 전문가·권리/출시 승인·교수 효과 검증은 이번에 실행하지 않았다. 보고서의 검증 통과는 연구 수행/검사 경계의 결과다.

```powershell
node --test scripts/research/factory-qualification/*.test.mjs scripts/research/factory-qualification-v11/*.test.mjs
node scripts/research/factory-qualification-v11/research-repairs.mjs --check
node scripts/research/factory-qualification-v11/dcp-repairs.mjs --check
node scripts/research/factory-qualification-v11/product-audit.mjs --check
node scripts/research/factory-qualification-v11/integrity.mjs --check
```

전문·키·Gold·합성 응답은 ignored local에만 있다. 해당 봉인 입력 없는 환경에서는 metadata만으로 내용 검토를 재현할 수 없다. 제품 worktree는 다른 작업에서 계속 변할 수 있으므로 감사 시각/HEAD/파일 hash에 한정해 읽는다. 이후 실행은 새 감사와 실제 제품 권한 검증에서 시작한다.
