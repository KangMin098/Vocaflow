# 최종 검토 — 세 fixture 입력 정정 판정

**정정 ACCEPT.** 기대값82개와 safety predicate82개는 그대로이고, 현재 코드에서 생성한 입력79개는 동일했다. 입력이 달라진 것은 지정된3개뿐이다. [자동 비교](data/fixture-comparison.json)는 역사 원장·최초 입력의 최신 코드 재실행·독립 정정·Claude 정정을 분리한다.

| fixture | 정당한 입력 보강 | 기대값 |
|---|---|---|
| G-three-one-candidate | 판정 map에 각 artifact의 id/kind/revision/hash/source·analysis·Gold subject를 결속 | 후보1·부분충족 유지 |
| G-assessment-fulfillment | subject 결속 및 roleCandidates를 요청 independent_check와 일치 | 후보1·부분충족 유지 |
| G-candidate-not-delivery | subject 결속 | 후보1·learnerGate 유지, 실제delivery 아님 |

최초 G-stale의 manifest revision과 정상 대조의 revision은 서로 다르므로 함수 입력이 문자 그대로 같다는 말이나 어떤 구현도 동시에 만족할 수 없다는 말은 엄밀하게 과도하다. **일관된 근거 기준의 충돌**은 있었다. ID-only 판정에는 이전/current revision을 구별할 판정 주체 근거가 없는데, 정상 대조는 그 상태로 후보1을 요구했다. 임의 revision 문자열을 보고 특별 취급하는 규칙은 독립 근거 결속을 검증하지 않는다. 평가 대조의 roleCandidates도 guided_practice여서 요청 independent_check와 충돌했다.

따라서 정상 대조의 전제를 보강하고 ID-only/stale 차단을 유지하는 수정은 안전 기준 완화가 아니다. 최초42 PASS/40 FAIL 원장을 보존하고, 원본 입력의 v1.1 결과79 PASS/3 FAIL과 정정 입력82 PASS/0 FAIL을 함께 남겼다. 실패3개를 사후 성공으로 덮지 않았다.

signature가 canonicalDemand v2로 바뀌므로 역사 실행과 현재 실행의 계산된 requestId/body가 달라진다. 이는 fixture 연산을 수정했다는 뜻이 아니다. 79건 불변은 같은 최신 코드에서 원본/Claude 입력을 비교한 결과이며 역사 데이터의 모든 literal이 동일하다는 주장이 아니다. 기대문구/판정 함수 불변도 확인했다.

정정82개의 PASS만으로 I05/I06 전체 종료를 결정하지 않는다. 대부분 무신뢰 입력은 branded context 검사를 먼저 실패해 뒤 조건까지 도달하지 않는다. 최종 검토는 별도46개의 정상/공격 진단을 실행했으며 그중4개가 두 P1을 재현했다. [실제 결과](data/adversarial.json)를 참조한다.
