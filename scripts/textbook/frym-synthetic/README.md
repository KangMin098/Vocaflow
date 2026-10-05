# F02 Synthetic Classroom Smoke v1

`node scripts/textbook/frym-synthetic/f02-synthetic.mjs export <출력 폴더>`는 F02의 고정 본문·문항·채점키와 [프로필 규칙](./f02-protocol.v1.json)을 해시로 결속한 `seal.json`, 그리고 14개 프로필(학년 2 × 능력 7) × 본문 2 = 28개 blind 패킷을 만든다. 재실행은 같은 입력에서 같은 패킷 ID를 만든다. 출력 폴더의 학생 역할 패킷에는 지문·질문·epistemic state만 있고 정답, 채점기준, 원문 분석, 출처 인용, 목표 지문 학년, 기존 검수 결과는 없다. 출력 폴더는 등록·응답 데이터로 간주하지 않는다.

응답은 별도 JSON 배열로 수집한다. 각 행은 `packet_id`, 실제 `model`·`model_family`, 독립 채점에 쓴 `scorer_model`·`scorer_family`, `replica_id`, `scoring_key_hash`, 순서대로 `{id, answer}` 12개와 `{id, score}` 12개를 갖는다. 점수는 0/0.5/1 중 하나다. 생성 모델과 채점 모델 계열은 달라야 한다. 이 계열·모델 표기는 입력자의 기록이며 API attestation을 대신하지 않는다. 같은 모델 반복은 독립 학생이나 독립 모델 수로 세지 않는다. 문항별 점수는 blind 채점자가 현재 채점키에 따라 매긴 값이어야 하며, 자기 채점 출력이나 임의 점수는 유효 근거가 아니다.

`node scripts/textbook/frym-synthetic/f02-synthetic.mjs analyze <응답.json>`은 패킷 ID·키 해시·중복·응답/점수 완결성과 모델 계열 분리를 검사한다. 지문별 단어·문장·type/token 지표, 합성 문항 정답률, 보정 item-total 상관, 같은 프로필의 두 지문 간 관측 차이와 모델 계열별 평균·범위를 **기술 통계**로 낸다. 문항별 난도와 변별도는 합성 응답의 성질일 뿐 실제 학생 모수가 아니다. 아직 외부 benchmark가 없고 응답도 0건이므로 IRT, `TARGET_FIT`, `LEVEL_SEPARATION`, Gold-S, DB seed는 판정하지 않는다. `seal.json`은 자동 산출된 입력 동일성 기록이며 교육적 승인 서명이 아니다.

기존 [F02 사람 pilot 제안본](../frym-validation/f02-student-pilot.proposed.json)은 덮어쓰지 않고 미봉인 상태로 보존한다. 합성 경로는 그 파일의 학생 N이나 gold 상태를 바꾸지 않는다. 외부 benchmark와 독립 모델 결과가 모이면 새 protocol revision을 봉인해 평가할 수 있다. 이 경로는 현재 DB importer에 연결되지 않는다.
