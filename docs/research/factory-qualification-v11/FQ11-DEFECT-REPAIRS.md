# FQ1.1 연구 활동 결함 수정 — 새 연구용 revision

FQ1에서 발견한 **4활동의 5결함**을 별도 `FQ1.1-research-repair1`로 수정했다. 기존 v14/v15 패키지, FQ1 첫 판정, 정답 및 원문은 변경하지 않았다. 수정 작성자의 검토이며 독립 재검증 완료를 뜻하지 않는다. 인간 전문가·실제 학생·권리 승인·제품 실행 증거는 각각 0이다.

| 기존 활동 | 첫 결함 ID | 새 revision의 수정 | 보존한 범위 |
|---|---|---|---|
| S5-1 / `v14-s.form_scope-1` / 2024#28 | RQ-E01 | operator의 문법 이름만 있는 응답은 관찰 불가/defer. 명시적 의미 역전·강화는 defect로 정의 | 원문·목표·발문·Gold 및 나머지 3facet |
| S5-2 / `v14-s.form_scope-2` / 2015#21 | RQ-E02, RQ-E03 | 강도 확대를 잘못 포함한 partial Gold를 올바른 생략 사례로 교체. strength에서 명시적 강화·동일 facet 내 모순을 defect로 규정. examples에서 사례 없는 문법 이름은 defer | 원문·목표·발문·full/equivalent Gold 및 condition/reverse |
| S5-3 / `v14-s.form_scope-3` / 2014A#32 | RQ-E04 | boundary에서 부착 설명만 있는 응답은 defer. 실제 제출된 경계 의미의 역전은 defect | 원문·파생 도표·목표·발문·Gold 및 나머지 3facet |
| V2-3 / `v14-v.contextual_sense-3` / 2024#23 | RQ-D01 | 기존 limit rubric이 요구한 두 수행 구별을 발문에 각각 명시. 실제 다른 수행의 성공이나 노출 자격을 내용 답으로 요구하지 않음 | 원문·V2 목표·Gold 및 전체 4facet |

수정 규칙은 필요한 입력 없음/해석 불가능 → defer, 관찰 가능한 명시적 왜곡 → defect, 해당 facet의 모든 요구 내용 충족 → meets, 모순 없이 올바른 내용의 비어 있지 않은 진부분집합 → partial이다. 자유 응답의 의미 성분을 식별하는 NLP 채점기는 만들지 않았다. `facetDecision`은 이미 해석된 관찰값의 상태 경계를 검사하는 연구용 함수다.

S5-2에서 전체 응답의 기술용 partial 예시를 각 facet에 일괄 적용하지 않는다. 올바른 조건 응답은 해당 facet에서 판정하고, 미제출 강도·사례는 각각 따로 기록한다. 원문이 조건 밖의 행동을 결정하지 않는다는 올바른 답과 학생이 아무 답도 제출하지 않는 경우도 분리한다.

V2-3의 limit은 핵심 문맥 의미 설명과 다른 수행 범위를 구별하는 보조 출력이다. 이 출력을 추가했다고 중심 생성·선지 전체 검수·학생별 미노출 수행까지 직접 평가하는 것으로 TASK를 넓히지 않았다.

## 재검증 입력과 보존

수정에 사용한 작성자 반례 7개와 **새 합성 검증 사례 13개**를 분리했다. 모두 연구자가 만든 응답이며 실제 학생 응답이 아니다. 새 사례는 올바른 부분 생략, 빈 응답, 옳은 설명과 명시적 모순의 동시 제출, 완전한 경계 판정을 포함한다. 독립 검토에는 원문·새 발문·Gold·rubric·응답만 제공하고 작성자 기대 판정과 성분값을 제거했다. 기존 결함을 알고 수정한 작성자의 확인을 독립 검토로 세지 않는다.

공개 [연구 원장](./data/research-repairs.json)은 각 활동의 원본/새 revision hash, 결함 ID, 바뀌지 않은 facet, 작성자 기대 상태와 미해결 경계를 기록한다. 원문·구체 Gold·실제 반례 응답은 ignored local에만 둔다. 이 공개 원장에는 기대 상태가 있으므로 독립 최초 판정 전에는 검토자에게 제공하지 않는다.

- `local/research-repairs-config.json`: 새 수정 필드·작성자 반례·별도 새 사례·기대 판정
- `local/research-repairs-packet.json`: 원본과 수정본·실제 원문·첫 결함·작성자 기대 판정
- `local/research-repairs-blind.json`: 독립 검토용 새 자료와 응답, 기대 판정 없음

위 경로의 기준 디렉터리는 `scripts/research/factory-qualification-v11/`이다. 파일 전체 hash는 공개 원장에 보존했다. 단순 파일 hash뿐 아니라 원문 row hash, 이전 전체 패키지 hash 및 FQ1 첫 검토 hash가 일치해야 재실행된다. 재실행은 이미 존재하는 새 결과를 덮지 않고 동일 bytes인지 확인한다.

```powershell
node scripts/research/factory-qualification-v11/research-repairs.mjs --check
node --test scripts/research/factory-qualification-v11/research-repairs.test.mjs
```

회귀 검사는 공백을 결함으로 바꾸기, 같은 facet의 모순을 partial로 바꾸기, 내용의 완전/부분 충족 혼용, 기존 목표·자료 변경, 원본 객체 덮어쓰기 및 기대 판정의 blind packet 누출을 탐지한다. 이 검사는 교수 효과·인간 채점 타당도·AI 판정의 객관적 정답성을 검증하지 않는다.

## 남은 해석 경계

의미 동등 표현은 실제 해석 검토가 필요하다. S5-3의 합성/파생 셀 과제로 원도표 시각 읽기를 확인하지 않는다. V2-3의 수행 범위 설명으로 학생의 노출 자격을 확인하지 않는다. 모든 활동의 F/G/H와 인간 검수·측정 타당도·권리 승인은 독립적으로 남는다. 따라서 이 수정만으로 공개 또는 직접 평가 자격을 부여하지 않는다.

## 독립 첫 검토 후 별도 revision2

독립 첫 검토의 표적 판정은 작성자와 **20/20 일치**했지만, 전체 4활동은 모두 **HOLD**였다. 응답 상태가 일치하는 것과 자료의 발문·Gold·rubric 전체가 타당한 것은 별개다. 그 첫 판정과 첫 수정본을 그대로 두고 새 `FQ1.1-research-repair2`를 만들었다.

| 새 발견 | 별도 수정 | 관찰과 논리의 경계 |
|---|---|---|
| IR-R01 결합 partial/defer 중복 | 첫 절·둘째 절·전체 결합의 세 판정 중 올바른 비어 있지 않은 진부분집합은 partial, 어느 판정도 없으면 defer | 두 절 판정으로 결합 결과를 추론할 수 있어도 전체 판정 응답이 실제 제출된 것은 아님 |
| IR-R02 위험 물건과 즉각 위험 혼동 | full/equivalent 사례에 실제 즉각 위험을 명시. 단순 위험 물건만으로 안/밖을 결정하지 않는 기준 추가 | 물건의 위험 가능성은 현재 즉각 위험의 관찰을 대신하지 않음 |
| IR-R03 추가 발문과 좁은 limit Gold 불일치 | 첫 수정에서 새로 덧붙인 수행의 구체적 차이 설명 요구를 제거하고 두 성공 확정 여부 판정만 요청 | 핵심 문맥 뜻 풀이와 다른 수행의 성공을 인증하는 것은 다름 |
| IR-R04 units의 연도 생략 경로 없음 | 연도·지표/연간 기준·시간 단위·참여율 구별의 올바른 부분집합을 partial에 명시 | 연도 생략은 올바른 연간 시간 내용을 미관찰로 바꾸거나 오답으로 만들지 않음 |
| IR-R05 명시 사례와 함의 불명확 | boundary는 질문의 두 사례를 명시 판정해야 관찰됨. 일반식은 operator에서 판단 | 올바른 일반식의 함의와 명시적인 경계 사례 수행 관찰을 구별 |

V2의 교육 목표를 바꾸지 않았다. 원래 v15 발문은 문맥 의미의 대상/결정, 두 물리적 대안과의 비교, 시장 보상·비시장 편익 근거를 요청했다. 구체적인 다른 수행의 작업 절차 설명은 원래 발문에 없고 첫 수정에서 새로 추가된 요구였다. revision2는 이 추가 요구만 제거했으며 원래 세 요청, 고정 `v.contextual_sense` TASK, 전체 4facet 및 limit의 두 성공 확정 여부 판정은 보존했다. 따라서 단어 뜻 풀이를 메타 판정만 하는 과제로 교체하지 않았다.

두 번째 패킷에는 발견에 사용한 반례 5개와 새 합성 사례 12개를 분리했다. 앞선 20개·독립 검토자가 만든 stress 사례와 합쳐 하나의 독립 검증 표본으로 세지 않는다. 모두 합성 응답이다. revision2의 새 blind에는 기대 상태가 없으며, 별도 fresh AI 검토의 첫 결과를 기다린다. 아직 새 독립 검토 완료·인간 타당도·학생 효과를 주장하지 않는다.

추가 원장 [research-repairs-v2.json](./data/research-repairs-v2.json)은 이전 수정 패킷·독립 첫 검토의 정확한 hash, 네 새 활동 hash, 다섯 새 결함 ID, 변경 facet, 작성자 기대 상태와 잔여 경계를 보존한다. 기존 원장의 첫 independent-review 수치는 새 결과로 덮지 않는다.

```powershell
node scripts/research/factory-qualification-v11/research-repairs-v2.mjs --check
node --test scripts/research/factory-qualification-v11/research-repairs-v2.test.mjs
```

새 회귀 5개는 결합 판정 생략의 partial/defer 경계, 연도 생략과 단위 왜곡의 구별, 일반식에서 경계 사례 응답을 임의 생성하는 오류, 위험 물건에서 즉각 위험을 임의 추론하는 오류, 원문·TASK 변경 및 blind의 기대 판정 유출을 검사한다. 이 기계 검사는 이미 해석된 의미 성분에 대한 상태 규칙이며 자유 응답 자동 채점이나 인간 검증이 아니다.

## 최종 독립 내용 재검토 선택

두 번째 독립 문맥의 S5-1/2 제한적 지지와 세 번째 독립 문맥의 S5-3/V2-3 제한적 지지를 결속했다. 기존 5이슈는 이 수정 범위에서 지지를 받았으나 V2 일반 안내 표현의 partial 경계는 별도 모호성으로 남는다. [세 번째 첫 검토](data/revision3-review.json)와 [최종 선택](data/final-qualification.json)을 함께 읽는다. 최초 20/20 목표 일치·4활동 HOLD와 각 단계의 저자 pending snapshot은 그대로 보존했다. 이는 신규 기출 확인적 일반화·인간/학생 채점·교수 효과 검증이 아니며 공개/직접 평가0이다.
