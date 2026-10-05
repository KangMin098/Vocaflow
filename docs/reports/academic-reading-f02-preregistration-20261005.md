# F02 학생 pilot 사전등록 검토본 (2026-10-05)

**현재 상태: `candidate_unsealed` / `educational-validation-pending`.** F02는 본문 생성 성능의 대표 표본이 아니라, 난도 측정 방식의 calibration 사례다. 이 문서와 JSON은 학생 응답을 보기 전에 책임자가 검토할 **제안**이다. 사람 승인, 학생 관측, gold, DB seed는 아직 0건이다.

## 독립 고정 단위

[`f02-preregistration.proposed.json`](../../scripts/textbook/frym-validation/f02-preregistration.proposed.json)은 현재 중1·고1 본문의 `passage_hash` 각각과 전체 `item_set_hash`, `scoring_key_hash`, `pilot_protocol_hash`를 따로 기록한다. [`f02-items.proposed.json`](../../scripts/textbook/frym-validation/f02-items.proposed.json)은 학생에게 제시할 12문항/버전(이해·어휘·구문·추론 각 3문항)의 질문과 정확한 본문 근거를 담는다. [`f02-scoring-key.proposed.json`](../../scripts/textbook/frym-validation/f02-scoring-key.proposed.json)은 학생 패킷과 분리된 1/0.5/0점 판정안이다. 기존 revision 3은 수정 **전** F02 본문이므로 사용하지 않는다. 두 파일의 결합으로 생성한 v2 형식의 중1·고1 instrument도 별도 SHA-256으로 묶는다.

`node scripts/textbook/frym-validation/f02-preregistration.mjs --check`는 로컬 원본 F02 본문과 freeze 해시, 문항 인용, 각 축의 문항 수, 문항·채점 ID, 네 해시 및 생성 instrument를 대조한다. 문항이나 채점 기준을 수정하면 본문 해시는 유지되고 해당 해시와 등록 manifest만 새로 만들어야 한다. 이 검사 통과는 **사람 문항 검토가 끝났다는 뜻이 아니다.** 사람이 문항의 명료성·정답 타당성·두 버전의 공통 구성개념·힌트/순서효과를 검토한 뒤, 실제 등록 시각과 근거를 새 봉인 기록에 남겨야 한다.

## 사전 판정 규칙

[`f02-student-pilot.proposed.json`](../../scripts/textbook/frym-validation/f02-student-pilot.proposed.json)의 수치는 한국 학년 규준이 아닌 pilot 제안값이다. 세 arm(`middle_target`: 중1→중1판, `high_target`: 고1→고1판, `middle_anchor`: 고1→중1판) 각각 완결 표본 최소 15명, 배정 최대 30명이다. 고1 두 arm은 사전 무작위 배정하며 **학생 한 명은 F02의 한 버전만** 본다. 학년 간 평균을 직접 빼서 separation이라고 부르지 않는다.

`TARGET_FIT`의 비대체 hard gate는 **핵심 이해도 평균 ≥0.65**이다. 어휘·구문·추론 정확도, 읽기시간, 세 부담 평정, 체감난도는 supporting으로 범위 이탈을 각각 보고하지만 합산 점수나 단독 탈락 사유로 쓰지 않는다. 미지 단어 비율은 diagnostic이다. 이 배치는 작은 calibration 표본에서 무엇을 통과 조건으로 삼을지 미리 제한하기 위한 것이다. 어휘·구문·추론의 큰 이탈은 다음 연구의 문항·밴드 재설계 근거이며, gold의 근거가 아니다.

`LEVEL_SEPARATION`은 고1 학생에게 배정된 두 arm에서 고1판의 추론 부담 중위값이 중1판보다 ≥0.5, 문장 부담 중위값도 ≥0.5 높고, **양쪽 이해도 평균이 각각 ≥0.65**여야 pass다. 어휘 부담만 높은 경우 fail이다. 부담 평정의 차이만으로 원인이 입증되지는 않으므로 사람 책임자가 문항 난도·구문·추론 구성개념의 대응을 사전 검토하고 그 근거를 봉인해야 한다. 실제 분석에는 문항별 정답률과 부담 분포도 함께 보고해 희귀 어휘나 문항 차이만의 효과를 따로 점검한다.

## 결측·노출·중단

완료하지 못했거나 필수 시각·답·측정치가 빠진 세션은 기록을 남기고 완결 표본에서 제외한다. 무응답을 0점으로 바꾸거나 결측값을 보간하지 않는다. 본문 읽기 30초 미만, 확인된 무활동 구간 300초 초과, 사전 F02 본문·문항 노출, 동일 학생의 두 번째 버전 노출은 각각 사유별 제외한다. 무활동을 계측하지 못했다면 그 한계를 보고하며 경과시간만으로 중단이 없었다고 주장하지 않는다. 같은 선택을 반복한 경우는 blind 수동 검토 대상으로 표시하되 동일한 부담 평정이나 자유응답 문구만으로 자동 제외하지 않는다. 배정·본문·instrument 해시 불일치, 중복, 비정상 시각/값은 `measurement_invalid`로 처리한다. 제외 후 arm별 유효 n이 미달하면 `inconclusive_sample`이며 표본을 보충하려고 사후 기준을 바꾸지 않는다.

결과에는 학년별 `target_fit_pass/fail`, 공통 학년 `separation_pass/fail`, `inconclusive_sample`, `measurement_invalid`를 구분한다. 두 학년 target fit과 separation이 모두 사전 기준을 통과하고 v2 사람 의미 검수·원 연구 출처까지 재대조된 경우에만 F02의 `educationally_validated`를 검토한다. 이 calibration 결과는 플랫폼 성능, gold 또는 seed 자격이 아니다. Gold에는 다른 원천·주제에 대한 별도 등록·검증과 사람 의미 판정이, `seed-eligible`에는 현재 권리·provenance·hash·검수 및 적재 gate가 추가로 필요하다. F06·F14·F18 확장은 F02에서 측정 문항과 응답 해석을 먼저 점검한 뒤 결정한다.

## 책임자 봉인 전 남은 확인

책임자는 문항과 채점 기준을 독립 검토하고, 0.65·0.5 및 시간/결측 경계를 결과 열람 전에 확정한다. 세 arm의 실제 모집·학년 확인·무작위 배정·사전 노출 질문·읽기/질문 단계·무활동 계측·동의/철회·blind 채점과 불일치 처리 방법을 운영안으로 봉인한다. 실제 승인 ID·시각·사전등록 위치·문항 및 구성개념 검토 근거를 기록한 뒤에만 `pilot-preregistered`로 부른다. 수정이 필요하면 새 item/key/protocol 해시와 새 등록 회차를 만들고 이전 응답과 섞지 않는다.
