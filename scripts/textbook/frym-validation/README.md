# FYM 교육적 타당도 pilot

4쌍 × 중1/고1의 8편을 실제 사람에게 평가하기 위한 로컬 도구다. 현재 전문가 판정·학생 측정은 0건이며 모두 `candidate`다. 문항·프로토콜은 초안이고 자동 생성된 응답이나 회귀 테스트의 가상 점수는 실험 결과로 사용하지 않는다.

## 역할과 사전 등록

사람 책임자가 독립 전문가의 자격, 학생의 실제 학년, 참여 절차를 확인한다. 실명 대신 가명 ID를 사용한다. JSON의 `human_domain_expert` 선언은 신원 인증을 대신하지 않는다. 책임자는 자격 확인·사전 등록의 실제 증빙을 별도로 보관하고 참조를 기록한다.

`protocol-1.json`은 전문가 최소 2명, 버전별 학생 최소 5명, 이해도/어휘/문장/추론 축별 문항 최소 3개를 제안한다. 두 학년의 현재 수치 범위는 같은 초기 제안값이며 학년별 경험적 기준이 아니다. 책임자가 목표 학년·표집·문항·채점 기준·통과 범위를 검토하고 **평가 시작 전에** 정확한 protocol/instrument 해시를 사전 등록해야 한다. 결과를 보고 나중에 문항·범위를 바꾸지 않는다. 변경 시 새로운 pilot과 새 출력 폴더로 다시 시작한다.

## 준비와 검증

저장소 루트에서 실행한다. 연구 전문 스냅샷은 ignored 증거 폴더에 있어야 한다. 다른 컴퓨터에서는 해당 스냅샷을 함께 확보해야 원본 해시를 재현할 수 있다.

```powershell
pnpm exec tsx --tsconfig apps/web/tsconfig.json scripts/textbook/frym-validation-export.mjs --pilot scripts/textbook/frym-precision/adaptation-pilot-1.json --preservation-rules scripts/textbook/frym-precision/preservation-rules-1.json --precision-review scripts/textbook/frym-precision/round-1.json --protocol scripts/textbook/frym-validation/protocol-1.json --evidence-dir .agent-logs/frym-precision-r2 --output .agent-logs/frym-validation-study-1
pnpm exec tsx --tsconfig apps/web/tsconfig.json scripts/textbook/frym-validation-verify.mjs --input .agent-logs/frym-validation-study-1/coordinator/results.json --pilot scripts/textbook/frym-precision/adaptation-pilot-1.json --preservation-rules scripts/textbook/frym-precision/preservation-rules-1.json --precision-review scripts/textbook/frym-precision/round-1.json
```

Export는 DB 접근 없이 로컬 해시·정렬 증거·쌍별 중1/고1 한 편씩을 검사한다. 무작위 opaque ID의 전문가 8개·학생 8개 패킷과 총 96개 초안 문항을 만든다. 기존 폴더가 있으면 실패하며 부분 실패한 폴더도 보존하고 새 경로로 재실행한다. Verify는 읽기 전용이며 반복해도 파일·DB가 바뀌지 않는다. 두 명령 모두 `--commit`을 지원하지 않는다.

`expert/`에는 원 연구의 검토 문맥, 각색문과 미평가 양식만 있다. 목표 학년·생성 방법·기존 관찰 판정·채점 답안은 없다. `student/`에는 각색문, 질문, 빈 응답 양식이 있다. **`coordinator/`는 평가자·학생에게 전달하지 않는다.** 이 폴더는 ID 대응, 출처 표시, 정답 기준, 실패 사례, 등록 및 결과 기록을 담는다. 출처·저작권 표시는 책임자가 보존하고 blind 평가 후 공개한다. 도구는 파일을 누구에게도 전송하지 않는다.

## 실제 평가 순서

1. 책임자가 문항 타당성과 원 연구 문맥의 충분성을 확인한다. 어휘는 단어 뜻, 문장은 문장 내부 구조/의미, 추론은 근거·조건·한계, 이해도는 명시된 정보를 따로 채점한다. 12개 초안 문항 자체는 검증된 검사 도구가 아니다.
2. 검토한 문항·target·본문·원천을 묶는 `instrument_hash`, 프로토콜의 `protocol_hash`를 등록하고 `protocol_approval`에 실제 책임자 ID·시각·증빙 참조를 기록한다. `experts`에 실제 독립 전문가의 가명 ID와 자격 증빙 참조를 등록한다.
3. 전문가는 opaque 패킷을 독립 평가한다. 핵심 주장, 인과 방향, 비교, 조건/범위, 불필요한 추가 없음, 근거 없는 추가 없음, 핵심 생략 없음, 강도 과장 없음의 8항목을 판정하고 왜곡이면 taxonomy 코드·실제 문장·이유를 기록한다. 요청한 7항목에서 지원되는 불필요한 추가와 환각을 구분하기 위해 추가 판단을 분리했다.
4. 필요한 전문가 모두 pass이고 왜곡이 없는 버전만 학생에게 제시한다. 읽기 시작/끝은 문항 답변 이전의 읽기 시간이다. 학생은 모르는 단어의 등장 횟수, 어휘/문장/추론 부담 및 체감 난도(각 1–5), 실제 응답을 기록한다. 전문가가 등록된 기준으로 각 답을 0/0.5/1로 채점한다. 같은 학생이 한 pair의 두 버전을 보거나 같은 버전을 반복 측정하지 않는다.
5. 책임자가 결과를 `coordinator/results.json` 스키마에 맞춰 합친 뒤 verify를 실행한다. 누락값을 0이나 pass로 채우지 않는다. 학년·시각·등록/전문가/학생 순서·본문 인용·현재 회차 해시가 맞아야 한다.

## 승격과 DB 적재

상태는 결과에서 계산한다. 유효하고 완전한 전문가 패널 전에는 `candidate`, 패널 완료 후 학생 측정 미완료 또는 실패가 있으면 `reviewed`, 모든 기준을 통과한 정확한 본문/target/protocol에만 `gold`다. 완전한 provenance·원 연구 링크 high·모든 전문가 항목 pass·왜곡 없음·실제 학년별 표본·모든 측정 범위 통과가 필요하다. fail/unassessed가 섞이면 승격하지 않는다.

`lexical_level`/`syntax_level`/`reasoning_level`은 각각 이 검사에서 얻은 정확도의 분리된 측정값이다. V-Level이나 학년 공인 척도로 환산하지 않는다. Gold도 해당 버전과 등록 프로토콜의 pilot 통과를 뜻하며 다른 학년·본문·모집단으로 일반화하지 않는다.

보존 규칙을 사용한 완성 Academic Reading 생성 청크의 `adapt-drain-import.mjs`에는 기존 규칙·회차 인자와 **`--educational-validation <results.json>`**을 추가해야 한다. 본문/target/source가 gold 결과와 정확히 같아야 하며 초기와 각 DB batch 직전에 최신 결과·규칙·회차를 다시 검사한다. 실행 중 인증 파일이 바뀌면 해당 행을 건너뛰고 새 예행을 요구한다. 로컬 pilot은 완성 생성 청크가 아니므로 그대로 import하지 않는다.

실제 적재는 기존 권리·분석·내용 검수, 예행, DB checkpoint, 직렬 실행 조건도 충족한 뒤 수행한다. DB 자식은 여전히 `queued`다. `production`은 현재 DB 행이 실제 published이고 본문 hash·부모 UUID·target이 인증과 일치할 때만 별도로 산출한다. 로컬 인증만으로 production이라고 표시하지 않는다. 이번 단계는 DB seed·발행·마이그레이션을 수행하지 않았다.

[실제 준비 결과와 한계](../../../docs/reports/frym-educational-validation-20261004.md)
