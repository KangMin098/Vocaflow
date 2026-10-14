# Factory Qualification — 실제 TASK 적합성

## Q2 연구 8활동·14자료 역할

2026-10-14. 이전 v1.5 원문·Gold·첫 검수는 그대로 두고, 다른 AI 문맥에서 실제 8개 본문과 지시문·Gold 대안·32개 facet 경계, 14개 역할의 전달 계약을 읽었다. 이 결과는 인간 검수나 학생 수행 관찰이 아니다. 최초 상세 판정은 ignored local에 봉인했고, 공개 원장에는 ID·버전·해시·판정·결함 종류만 남겼다.

| 활동 | 원문 | TASK 영구 ID | A 원천 | B 의미 | C TASK | D 지시 | E Gold/루브릭 |
|---|---|---|---|---|---|---|---|
| v14-s.form_scope-1 | 2024#28 | s.form_scope | pass | pass | pass | pass | **fail** |
| v14-s.form_scope-2 | 2015#21 | s.form_scope | pass | pass | pass | pass | **fail** |
| v14-s.form_scope-3 | 2014A#32 | s.form_scope | pass | pass | pass | pass | **fail** |
| v14-v.contextual_sense-1 | 2016#23 | v.contextual_sense | pass | pass | pass | pass | pass |
| v14-v.contextual_sense-2 | 2024#34 | v.contextual_sense | pass | pass | pass | pass | pass |
| v14-v.contextual_sense-3 | 2024#23 | v.contextual_sense | pass | pass | pass | **fail** | pass |
| v15-v.contextual_sense-transfer-1 | 2021#22 | v.contextual_sense | pass | pass | pass | pass | pass |
| v15-s.form_scope-transfer-1 | 2023#20 | s.form_scope | pass | pass | pass | pass | pass |

A의 pass는 현재 연구 입력의 파일·행·기존 원천 감사 해시를 다시 확인하고, 이전 PDF·동일형 키 대조 기록을 결속했다는 범위다. 새 PDF 시각 검수 0회이며 공식 다운로드 계보는 미해결이다. B는 원천에 결속된 full/의미 동등 설명의 제한된 AI 판정이다. 잘못된 부분정답 예의 분류 문제는 E에 따로 기록했다. C는 파생 과제가 영구 TASK의 실제 풀어쓰기·범위·근거 산출을 요구한다는 의미다. 원래 기출 정답 선택은 8개 모두 해당 파생 수행을 독립적으로 관찰하는 직접 증거가 아니다.

F 권리·출시, G 실제 학습자 노출 자격, H 실제 산출물의 Workspace 실행 호환성은 **8개 모두 unknown**이다. 제품의 정적 후보 `runnable:false`와 실제 ContentArtifact 실행 검증을 구별했다. 공개 적격 0, 직접 평가 적격 0, 인간 검수자 0, 실제 학생 0을 유지한다.

## 이전 PASS 아래 남아 있던 구체적 결함

5개 이슈는 4활동에 걸쳐 있다. 하나의 활동에 여러 결함이 있을 수 있어 활동 수와 이슈 수를 합치지 않는다.

- `RQ-E01`, `RQ-E03`, `RQ-E04`: 해당 의미 산출을 관찰할 수 없는 응답을 국소 defect 예가 결함으로 분류하지만, 같은 facet의 defer와 전체 결정 규칙은 미관찰로 분류한다. 명시적 틀린 의미와 해당 의미를 아예 제출하지 않은 상태를 분리해야 한다.
- `RQ-E02`: Gold의 부분정답 대안이 명제 강도를 명시적으로 강화한다. 같은 활동의 루브릭은 이를 결함으로 분류하므로 두 기준이 충돌한다.
- `RQ-D01`: 실제 학습자 지시문이 요구하지 않은 두 수행 구별을 루브릭은 필수 출력으로 요구한다. 이 누락은 공급 지시의 결함이며 학생 실패로 처리할 수 없다.

기존 v1.4의 전체 AI 검토와 v1.5의 두 새 활동·8facet 검토 및 두 지도 역할의 전달 순서 검토는 보존한다. 이전 합의가 새 검토에서 확인한 경계 충돌을 지우지 않는다. `E=pass`인 5활동도 인간 채점 타당도나 직접 평가 자격은 **unknown**이다.

## 허용 후보와 차단 범위

14개는 8활동의 역할 재사용이다. 각각의 `candidate_id`, 원천·Gold·전달 버전, 역할별 추가 조건은 [연구 활동 원장](./data/research-activities.json)에 있다. 원문 분석 2, 원리 설명 2, 의미 대조 2, 지도 연습 2, 직접 확인 후보 2, 다른 글 적용 후보 2, 지연 재확인 후보 2다. 이들을 새 지문 14개 또는 학생 전이 14건으로 세지 않는다.

원문 분석·모형·대조는 정확한 의미와 권리·실행 적격을 갖춘 설명 후보일 수 있다. 지도 연습은 도움 노출을 기록하고 최종 지도 응답 봉인 뒤 Gold를 공개하는 설계 후보다. 직접 확인·전이·지연은 인간 채점 경계, 학습자별 무도움·미노출·첫 응답 기록 없이는 평가로 공급할 수 없다. 전이는 다른 공유/정규화 본문과 같은 TASK 수행, 지연은 실제 경과 및 중간 학습·노출 로그도 필요하다. 현재 모든 역할의 제품 전달은 **계약·테스트용 참조만 허용**되며 실제 공급·공개·평가는 차단한다.

## 수정과 독립 재검수

기존 입력·Gold·첫 QA를 덮지 않는다. 새 revision에서 이슈별 대안·지시와 facet의 결속을 고친 후, 다른 판정자가 전체 제공 원문, 실제 지시문, 모든 Gold 대안, facet의 partial/defect/defer 중복을 읽는다. 해시와 원천·분석·Gold·전달 버전을 결속한다. 역할별 권리·인간 채점·학습자 노출·실행 기록을 따로 확보해야 공개 또는 평가 자격을 다시 판단할 수 있다.

재현 명령은 `node scripts/research/factory-qualification/research-activities.mjs`다. 최초 private 판정이 이미 존재하면 동일한 결과만 허용하고 다른 내용으로 덮어쓰기를 거부한다. 재실행은 해시/결속과 고정된 AI 판정 원장을 재생성하는 검사이며 의미를 자동 판정하는 엔진이 아니다.

## 실제 공장 표본과의 연결

[주 표본 8건](FQ1-DCP-MAIN.md)은 C fail 6/unknown 2, [독립 반증 4건](FQ1-DCP-COUNTER.md)은 C pass 2/fail 2였다. 관찰된 직접 관련성은 각각 2건이지만 완전한 TASK 계약 충족과 같은 값이 아니다. 문법 선택 과제의 실제 수행은 형태 판별에 머물 수 있어 S5 범위 해석의 직접 증거가 되지 않는다. 서로 다른 문항을 검토했으므로 두 표본을 평가자 간 일치도로 계산하지 않는다.

[자격 결과](data/qualification-results.json)는 20콘텐츠와 14역할 사용을 분리하고 최초 축 판정과 엄격한 복합 자격 판정을 함께 보존한다. 공장 키·해설 검토 pass를 미관찰 루브릭 pass로 승격하지 않았으며 현재 역할 자격은 모두 보류다.
