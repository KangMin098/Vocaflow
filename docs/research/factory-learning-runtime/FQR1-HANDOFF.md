# FQR1 Claude Code P-F8 인수인계

제품 중복 구현 없이, 현재 어휘·구문을 무엇으로 제시하고 어떤 응답·채점·피드백을 받아야 하는지 계약을 제공한다. 실제 제품/DB/RPC/RLS/교재/DCP/Gold/학생 기록 변경과 생산·공개는0이다.

## 구현 전에 고정할 사항

- 7유형은 현재 `TEXTBOOK_ONLY`이며 기존 파서와 실제 `grade_dcp_item`의17유형 경로에 포함되지 않는다. 타입 목록만 바꿔 지문5지선다 플레이어로 보내지 않는다.
- marked position, unit choice answer, 수정 낱말 text, 배열 sentence는 서로 다른 키다. 같은 `answer` 하나로 추측해 변환하지 않는다.
- actual14는 모두5보기지만 원래 개수를 유지한다. 새로운3보기·중복 token·단답 대안도 계약의 검사를 거친다.
- 신규표본의 실패·불일치 원장은 보존한다. key 존재·구조 pass·published 렌더 기록만으로 공급하지 않는다.
- S3는 현행 코드북 `s.attachment`이며 피수식어 지목을 요구한다. 예전 연구의 별도 ID/label을 현재 S3 정의로 자동 상속하지 않는다.

[유형 감사](FQR1-DCP-TYPE-AUDIT.md), [실행 계약](FQR1-RUNNER-CONTRACT.md), [JSON Schema](data/learning-activity.schema.json), [실제14 metadata 계약](data/runtime-contracts.json)을 사용한다. 실제 source/presentation 명세는 ignored local에 있으며 공개 Git에 추가하지 않았다.

## 최소 재사용 구현 순서

| 우선순위 | 구현·검수 단위 | 재사용/제약 |
|---|---|---|
| 1 | 권의 실제 type filter + 미지원/채점 실패 보호 | existing book catalog/오류 UX/로그인/복귀 구조 재사용. 해당 유형이 없을 때 독해17유형으로 fallback하지 않음 |
| 2 | unit_vocab/unit_grammar 선택형 adapter | choice 버튼/상태/수정 UX 재사용, 실제 choices·answer 단위와 검수된 피드백을 별도 매핑 |
| 3 | vocab_choice/grammar_choice 표시 선택 | sentences/underlines·문장/token 주소의 표시 adapter, 문맥·어법 유일성과 해설 검수 우선 |
| 4 | blank_word/grammar_fix 단답 | 입력 UI 재사용, 명시 응답 단위·정규화·대안·defer 계약과 새 scorer 필요 |
| 5 | word_order 전체 token 배열 | paragraph order 채점 재사용 금지. occurrence/permutation/동일 token·대안 의미 검사 후 격리 실행 |

재고량은 구현 우선순위의 효과 증거가 아니다. 선택형은 입력 재사용 비용이 상대적으로 작지만 실제 scorer7유형 미지원·source/내용/rights/노출 자격이 공통 차단 조건이다. 4개의 국소 dual-pass 후보도 공개 승인된 시험 자료가 아니다. [재사용 비교](FQR1-REUSE-MATRIX.md)와 [13권 공백](FQR1-BOOK-GAPS.md)의 실제 분모를 따른다.

## 최소 수직 E2E 수용

어휘: 승인된 격리 권 선택→해당 type/단계의 실제 배정 후보→artifact/FQ 확인→choice/marked/short input→지원된 scorer 또는 명시 guided-reference→봉인 뒤 해설→응답·힌트·revision 기록→같은 권/Workspace 복귀.

구문: 실제 form/attachment/structural/scope 수행 구별→지원된 input→검수된 키/대안/해설→시스템 실패 보호→기록·복귀. 정답 선택만으로 S3/S5 숙달을 업데이트하지 않는다.

제품이 검증할 실패 경로는 unsupported scorer의 오답 attempt 없음, RPC/null/malformed의 오답 없음, source/key/revision mismatch 공급 보류, 사전 Gold 노출/힌트의 assisted 표시, 전체 token permutation, 잘못된 source 해설 차단, 권 type의 독해 fallback 금지, 다른 사용자 이력 접근 거절, 같은 submission의 중복 기록 방지다. 실제 E2E/학생/인간 검증은 이번에 수행하지 않았다.

## 서버 기록과 복귀

현재 attempt9열에는 원응답·content/source/Gold revision·hint/feedback exposure·부분/defer/systemfailure·origin 정보가 없다. 현행 is_correct boolean에 partial/defer/error를 false로 밀어 넣지 않는다. 서버가 보호된 response reference와 digest, first/final freeze, role/assisted, scorer/rules/source/Gold version, origin book/Workspace reference, idempotency nonce를 기록하는 보강 계약이 필요하다. 기존 객체/json payload 재사용 여부를 제품팀이 비용·권한에 맞춰 결정하고 DB 변경은 별도 승인한다. 새 테이블을 무조건 요구하거나 SQL을 적용하지 않는다.

복귀 목적지는 서버에서 해석할 권/Workspace ID로 결속한다. 임의 클라이언트 URL·다른 user의 context를 공급/학습 기록과 연결하지 않는다. 공개 presentation과 서버 secret을 분리하고 현재 whitelist의 키 제외 보호를 유지한다.

## 전달 자료와 완료 경계

- [어휘 교수 조건](FQR1-VOCAB.md) · [구문/문법 조건](FQR1-SYNTAX.md) · [채점 경계](FQR1-SCORING.md)
- [독립 첫 판정 비교](data/independent-review.json): 실제14개·불일치6·보수적 content repair8·dual-pass4
- prototype는 stored-reference 비교와 구조/오류/순서만 검사하며 의미 Gold·권리·학생·숙달을 자동 인증하지 않는다.
- 원문/키/해설/private first가 없는 환경에서는 실제 내용 재검토를 metadata만으로 재현할 수 없다.

```powershell
node --test scripts/research/factory-qualification/*.test.mjs scripts/research/factory-qualification-v11/*.test.mjs scripts/research/factory-learning-runtime/*.test.mjs
node scripts/research/factory-learning-runtime/code-audit.mjs --check
node scripts/research/factory-learning-runtime/content-review.mjs --check
node scripts/research/factory-learning-runtime/contracts.mjs --check
node scripts/research/factory-learning-runtime/review-comparison.mjs --check
node scripts/research/factory-learning-runtime/integrity.mjs --check
```

모든 공개/직접 평가/인간/실제 학생 자격은0이다. 구조와 제한된 내용 검토가 있는 연구 후보를 실제 supplyEligible 또는 숙달 증거로 자동 승격하지 않는다. 실제 P-F8 구현·승인된 격리 실행·기록·권한·학생 측정은 제품팀의 후속 검증이다.
