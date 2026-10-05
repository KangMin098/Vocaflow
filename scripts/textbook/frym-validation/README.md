# FYM 사람 평가 v2 실행 절차

[사람 운영 프로토콜](../../../docs/FYM_HUMAN_VALIDATION_PROTOCOL.md)을 실행기에 연결했다. 기존 4쌍×중1/고1 8편은 **calibration 전용**이다. band 20개·사람 책임자·배정·사전 등록·실제 응답은 미확정이며 candidate 8, gold/production/DB 쓰기 0이다. 가상 회귀 점수는 실제 평가 결과가 아니다.

## Calibration 문항 revision 3

기존 96문항을 전수 검토한 [개정 문항/채점 검토본](../../../docs/reports/frym-calibration-instruments-3-review.md)과 [운영 안내](../../../docs/FYM_CALIBRATION_OPERATIONS.md)를 준비했다. `calibration-instruments-3.draft.json`은 record ID별 배열이며 export에 `--instruments scripts/textbook/frym-validation/calibration-instruments-3.draft.json`을 명시한다. 8편·96문항, 지문별 12문항·축별 3문항을 유지했다. 기존 default/v1 문항과 pilot 본문은 보존했다. 개정안은 사람 미승인 초안이다.

새 protocol-2.draft.json은 student_instructions_revision=2로 한국어 v2 안내를 선택한다. 이 필드는 protocol/manifest 봉인에 포함된다. 필드가 없는 기존 v2 연구 또는 revision=1은 당시 영문 안내·패킷을 유지하며 기존 응답을 계속 읽고 수집한다. 새 안내와 개정 질문은 한국어이며 영어 본문/축별 측정값은 그대로다. 안내도 packet_hash에 포함되므로 변경은 새로운 회차·등록 후 재생성된 패킷을 사용한다. 학생 JSON은 전체 질문을 가진 진행자 원본이며 학생에게 한 번에 공개하지 않는다. 지문만 읽기 → 추론 → 명시 정보 → 어휘 → 문장 순서로 나누어 제시하고 매 단계 답을 회수한다. 문장 인용이 앞 문항의 답을 알려주지 않도록 이전 답의 수정을 막는 운영 방식·재열람·위반/결측 처리 규칙을 `protocol.operations`에 사전 확정한다. 현재 수집기는 단계 잠금/실제 열람 순서를 인증하지 않는다. 상세 자료 배포 구분과 절차는 운영 안내에 있다.

## 준비와 봉인

실행 설정은 protocol-2.draft.json이다. pass-bands-2.draft.json은 사람 검토용이다. v2는 4점 척도만 지원한다. 원본 스냅샷은 ignored 증거 폴더에 보존한다. 다음 명령은 저장소 루트의 PowerShell에서 실행한다.

~~~powershell
$study = '.agent-logs/frym-validation-v2-sealed-packets-20261005'
$pilot = 'scripts/textbook/frym-precision/adaptation-pilot-1.json'
$rules = 'scripts/textbook/frym-precision/preservation-rules-1.json'
$round = 'scripts/textbook/frym-precision/round-1.json'
$evidence = '.agent-logs/frym-precision-r2'
pnpm exec tsx --tsconfig apps/web/tsconfig.json scripts/textbook/frym-validation-export.mjs --pilot $pilot --preservation-rules $rules --precision-review $round --protocol scripts/textbook/frym-validation/protocol-2.draft.json --study-id fym-v2-packet-draft-20261005 --evidence-dir $evidence --output $study
~~~

이 폴더는 실제 예행에서 이미 만들었으므로 재실행은 새 경로를 사용한다. Export는 DB 접근 없이 원본 본문/원 연구 hash·검토 범위·규칙·쌍별 두 학년을 대조하고 opaque ID 순서로 전문가/학생 패킷을 만든다. expert에는 원 연구 문맥·각색문·4점 anchor·빈 rating, student에는 지문·문항·빈 응답만 있다. **coordinator는 평가자/학생에게 보내지 않는다.** 목표 학년·제작 방법·이전 판정·정답 기준·실명 대응과 출처 표시는 책임자가 보관한다. 도구는 패킷을 발송하지 않는다.

사람 책임자는 결과 초안을 **새 파일**에 복사하고 다음을 실제 증빙으로 채운다.

- protocol: 두 학년 각 10개 band, 학년별 근거, 모집/제외·세션·결측 처리 운영 규칙. 정확도 0~1, 부담 1~5, 읽기 시간 초. 문항/채점 기준도 사전 검토한다.
- experts: 사람 자격/작성 독립성, screened_by/credential_verified_by, screened_at, 사전 노출 확인·증빙. v2 blind_eligible는 노출 없는 사람만 허용한다.
- 각 record의 expert_assignment: 최초 독립 2명과 다른 제3 adjudicator. 세 ID는 모두 등록되어야 한다. topic/source_family는 사람이 실제 분류를 확인하며 복제된 라벨로 재현을 주장하지 않는다.
- participants: 가명 ID·실제 학년·책임자의 학년 확인·같은 학년 전체 지문 record_order. 학년당 최소15~최대30명, 각 지문의 순서 위치별 인원 차이는 최대1. 네 지문은 ABCD/BDAC/CADB/DCBA 등을 사용한다. 학생은 한 pair의 두 버전을 읽지 않는다.

~~~powershell
pnpm exec tsx --tsconfig apps/web/tsconfig.json scripts/textbook/frym-validation-register.mjs --input <사람이_확정한_새draft.json> --precision-review $round --evidence-dir $evidence --prepare --output <새prepared.json>
pnpm exec tsx --tsconfig apps/web/tsconfig.json scripts/textbook/frym-validation-register.mjs --input <새prepared.json> --precision-review $round --evidence-dir $evidence --approval <실제_사전등록증빙.json> --output <새registered.json>
~~~

prepare는 hash를 갱신하고 새 출력 및 .registration-request.json의 책임자/시각/증빙을 null로 둔다. **등록 완료가 아니다.** 사람은 평가·응답 열람 전에 실제 외부 등록 증빙과 시각을 보관하고 요청 JSON의 human_lead_id/approved_at/manifest_hash/registration_evidence를 채운다. approval은 형식·시각·exact manifest·미확정 항목·배정/노출을 검사한다. 승인 성공 시 봉인된 bundle에서 **새 출력의 .packets/expert·student**를 다시 만든다. 이 새 패킷만 배포하며 export 당시 초안 패킷은 배포하지 않는다. 이미 응답이 있거나 봉인되었으면 등록을 거절한다. hash/JSON만으로 신원·외부 등록 시각을 인증하지 않는다.

봉인은 프로토콜/anchor·지문·원 연구 문맥·문항/채점 기준·pair/source/target/revision·전문가/학생 배정·사전 노출·calibration 제외 명세에 묶인다. 변경은 새 회차/파일/등록으로 남긴다. 이전 응답에 새 band를 적용하지 않는다.

## 독립 평가와 실제 응답 수집

~~~powershell
pnpm exec tsx --tsconfig apps/web/tsconfig.json scripts/textbook/frym-validation-collect.mjs --input <registered.json> --precision-review $round --evidence-dir $evidence --prepare --output <새batch.json>
pnpm exec tsx --tsconfig apps/web/tsconfig.json scripts/textbook/frym-validation-collect.mjs --input <registered.json> --precision-review $round --evidence-dir $evidence --pilot $pilot --responses <실제batch.json> --output <새collected.json>
~~~

빈 batch는 미등록 초안에서도 변경0 예행이 가능하다. 실제 batch의 manifest_hash는 봉인과 같아야 하며 전문가/학생 응답의 packet_hash는 **등록 후 다시 만든 패킷**과 같아야 한다. 질문/anchor를 바꾼 뒤 옛 패킷의 응답을 새 manifest로 옮겨도 거절한다. 사람이 완성한 [독립 rating](./expert-rating-2.blank.json)은 expert_reviews 배열, [중재](./adjudication-2.blank.json)는 adjudications 배열, 채점/학년 확인이 있는 학생 세션은 student_sessions 배열에 넣는다. 빈 양식의 null은 평가 결과가 아니며 전문가 판정은 8항목/인용/이유를 모두 채워 한 번 제출한다.

최초 2명은 서로의 판정을 보지 않는다. score/critical/왜곡 코드·severity가 다르면 제3 사람이 먼저 동일 자료를 blind로 평가한다. 그 리뷰를 보존한 뒤 최초 두 리뷰를 공개하고, 이후 항목별 최종 판정과 final_distortions를 중재 양식에 쓴다. 초기 리뷰 2개와 제3 독립 리뷰의 canonical SHA256, 공개/중재 시각을 대조한다. digestV2는 canonicalJson 결과의 SHA256이며 helper는 educational-validation-v2.ts에 있다. 중재 양식의 hash를 수동 추측하지 않는다.

각 항목 최종 score≥3, 미평가 없음, 최종 major 왜곡0이 필요하다. 핵심 claim/관계/범위/강도의 critical은 최초/제3 어느 판정에서든 현재 버전을 탈락시키며 중재나 평균으로 구제하지 않는다. 비치명 왜곡의 불일치는 중재에서 해소할 수 있고 최초 기록은 남는다. distortion마다 code/severity(major 또는 minor)/실제 지문 quote/reason을 기록한다.

학생은 의미 통과가 끝난 뒤 읽는다. 순서를 바꿔 앞 지문을 건너뛸 수 없으며 앞 지문이 확정 의미 실패일 때만 봉인된 skip 규칙을 적용한다. 중재 전 2점/4점 불일치는 확정 실패가 아니다. 부분 학생 측정·시각·무응답은 null/빈 값으로 보존하고 완전 측정 수에서 제외한다. 이미 기록된 값은 바꾸지 않고 누락만 후속 batch로 채운다.

같은 응답은 skip, 충돌은 전체 수집을 거절한다. 원 입력/응답 파일은 수정하지 않는다. 새 결과와 .receipt.json에 입력/응답/출력 SHA256·추가/보충/중복 수를 남긴다. duplicate 수는 연구 참가자 수가 아니다. 일부 파일만 생긴 실패도 보존하고 새 경로로 재실행한다.

## 보고와 후속 validation

~~~powershell
pnpm exec tsx --tsconfig apps/web/tsconfig.json scripts/textbook/frym-validation-verify.mjs --input <collected.json> --pilot $pilot --preservation-rules $rules --precision-review $round --evidence-dir $evidence --report <새report.json>
~~~

Verify는 현재 원본 스냅샷을 다시 읽어 hash와 원 연구 문맥을 검사한다. 읽기 전용·반복 안전이며 --report는 새 파일만 쓴다. 보고서는 단계·불일치·실제 리뷰/중재/세션 수, 학생별 4축 정확도 분포/유효 n, 시간/부담 사분위, 문항별 반응, 순서 위치, 전문가 항목별 일치, 미완료/미수집 수를 나눈다. null을 0점으로 만들지 않는다. lexical/syntax/reasoning_level은 서로 다른 측정값이며 V-Level/학년 규준으로 환산하지 않는다.

calibration은 candidate → expert_validated → student_validated까지만 가능하다. 표본/항목/band를 고친 뒤 플랫폼 타당도를 주장하려면 **새 validation sample**을 준비한다. export에 study_purpose=validation 또는 replication 프로토콜과 --instruments <record ID별 문항 JSON>을 제공하고, 해당 새 pilot/precision/rules/evidence를 사용한다. 기존8 pilot을 validation으로 export하면 거절한다.

새 validation/replication register의 prepare/approval 모두 --calibration-results <실제완료된calibration.json>을 지정한다. 도구가 원천UUID/DOI/본문/학생/전문가 목록과 실제 파일 hash를 추출한다. 최초2명 pass·학생0, 부족표본, 미해결 중재는 완료가 아니다. 확정 의미 탈락 또는 완전 학생 표본으로 모든 지문이 끝나야 한다. band 밖 측정은 완료된 발견이지만 통과는 아니다. 새 원천/DOI/본문/학생을 요구하고 전문가 재사용 여부는 먼저 봉인한다.

## Gold · DB seed · production

별도 validation/replication의 실제 독립 의미 판정·학생 목표 band/완전 표본·최종 major 왜곡0·현재 provenance/high 연결을 모두 만족해야 exact passage/target/protocol gold다. calibration/v1/미봉인 결과는 새 seed에 사용할 수 없다.

완성 Academic Reading 청크의 adapt-drain-import.mjs에 --educational-validation <v2 gold results.json> --evidence-dir <원본폴더> 및 기존 규칙/회차 인자를 지정한다. 동일 본문/target/source만 허용하며 최초와 batch 직전 최신 인증·규칙·원 연구 문맥을 대조한다. 인증이 바뀌면 새 예행을 요구한다. 기존 권리·분석·내용검수·DB checkpoint·직렬 적재 조건도 충족해야 한다. 로컬 pilot은 완성 청크가 아니므로 직접 import하지 않는다. 적재는 queued이며 이번 작업은 DB seed/발행을 실행하지 않았다.

production 확인은 verify에 --production --replication <후속v2결과> --replication-pilot <새pilot> --replication-precision-review <새회차> --replication-evidence-dir <새증거폴더>를 추가한다. 이때만 실제 DB의 현재 published 행을 읽는다. 후속 회차는 기존 gold 학생 측정이 끝난 뒤 등록되어야 하고 다른 주제·원천·연구·학생으로 gold 기준을 재현해야 한다. expert_reuse_allowed=false이면 원 validation의 전문가도 재사용하지 못한다. 현재 행의 본문/부모/target/저장된 manifest·validation hash까지 같아야 production이다. published만으로 승격하지 않는다. 실제 DB query 오류를 성공/0건으로 삼키지 않는다.

모든 명령은 --commit을 거절하며 기존 출력도 덮지 않는다. v1 protocol/results는 과거 재현·읽기/빈 수집에 남기되 새 기준으로 인증하지 않는다. 실제 새 v2 예행과 한계는 [완료 보고서](../../../docs/reports/frym-human-validation-v2-20261005.md)에 기록한다.

# F02 고정 pair 학생 pilot (미봉인)

현재 F02 재검수 본문은 `f02-calibration-freeze.json`에 고정했다. `f02-student-pilot.proposed.json`의 숫자와 모집 상한은 사람 책임자가 모집 전에 검토·봉인할 제안이다. 기존 8편 문항은 수정 전 F02를 가리켜 재사용하지 않는다. 새 F02 문항과 v2 사람 평가·학생 응답이 생긴 뒤 `pnpm.cmd exec tsx --tsconfig apps/web/tsconfig.json scripts/textbook/frym-validation/f02-pilot-evaluate.mjs <ignored-local-study.json> <sealed-v2-bundle.json>`을 실행한다. 이 명령은 F02 freeze·문항·배정·학생 세션을 확인하고 두 학년 목표 arm을 기존 v2의 `evaluateV2` 결과와 대조한다. 고1 학생의 중1판 비교 arm은 v2의 학년 일치 수집기에 넣지 않고 별도 봉인 자료로 수집한다. 재실행은 읽기 전용이며 결과를 DB에 쓰지 않는다. 미봉인·결측·v2 불일치는 `INSUFFICIENT_EVIDENCE`; 사람·학생 관측 전 gold/seed는 0이다. 상세 [F02 준비 기록](../../../docs/reports/academic-reading-f02-student-calibration-20261005.md).
