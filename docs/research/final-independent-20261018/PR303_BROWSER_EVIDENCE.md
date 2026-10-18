<!-- docs/research/final-independent-20261018/PR303_BROWSER_EVIDENCE.md -->
# PR303 격리 브라우저 증거의 독립 확인

[CI run39114115991](https://github.com/KangMin098/Vocaflow/actions/runs/39114115991), 고정 HEAD `e91377575f75b6099d342605db1f0ca4b16a9d47`. 실제 e2e-isolated-report artifact12131229870을 내려받아 Playwright HTML 내부 report JSON을 해독했다. [식별자·해시·검사 결과](./pr303-e913-ci-evidence.json)는 비밀값/학습자 응답 없이 요약한 증거다.

전체6 expected/0 unexpected/0 flaky/0 skipped. **R5 창작 공급은 그중2건(1280/1440)**이며 나머지는 meaning/reveal gate3건과 학습지도 목표 저장1건이다. verify/build/e2e/e2e-gate-faultclosed는 성공했고 e2e-shared-dev는 SKIPPED다. 임시 CI Supabase에 보류 SQL을 적용한 결과이며 실제 개발 DB 적용으로 세지 않는다.

## R5 두 폭에서 증명한 것

실제 로그인→계획 API 확정→학습지도 Workspace 열기→빈 자료→공급 요청→납품 출처가 있는 링크→실제 Runner→키보드 선택/제출→결과→DB 시도1행·열었던 delivery_id 결속→새로고침 결과 유지→다른 학습자 본문 열기 거절/위조 시도403→지도 복귀 후 풀었어요 표기를 확인했다. 세 화면 단계의 가로 넘침도 단언했다. 소스와 artifact의 통과 단계를 함께 확인한 결과다.

## 증명하지 않은 것

- 선택 링크는 independent_check가 없으면 첫 자료로 대체하며, 답도 첫 문장/첫 선택지를 고른다. isCorrect=true/evidence=true/유효한 전이 판정/지연 간격은 단언하지 않는다. 경로·결속 성공을 숙달 증거로 확대하지 않는다.
- 계획 확정은 API 호출이다. 실제 시험 기록/목표 설정→필요 TASK/량 계산→실제 수행 후 새 PLAN 버전/need 변화까지 하나의 학습자 여정으로 연결하지 않았다. 별도 목표 저장 테스트가 이를 대신하지 않는다.
- 주석의 중복 클릭 검사는 두 번째 click이 trial:true이므로 실제 두 요청 경합을 재현한 증거가 아니다. 실제 SQL 동시성 FI-006과 구별한다.
- passing test의 첨부 screenshot은0이다. CI 실제 브라우저/DOM 단언은 인정하되 미제공 화면 이미지를 독립 육안 검토했다고 쓰지 않는다. 별도 격리 컴포넌트 캡처는 전체 셸의 이미지가 아니다.
- 이후4655/22b5/957c의 새 TASK 콘텐츠·형식·구조 상호작용 수용은 이 HEAD의 결과로 대체하지 않는다. 실제 개발 DB의 현재 적격 공급/납품/결속은 [READ ONLY 집계](./task-runtime-expansion-snapshot.json)에서0이다.

따라서 F의 실제 브라우저 경로/결속 근거는 진전됐으나 A→H 전체 연결, G 독립 전이, H PLAN 의미 갱신은 여전히 PARTIAL이다. P1/핵심 P2 재검증·최신 HEAD CI·사람 Gold/권리/DB 적용 증거 없이 전체 ACCEPT나 병합 승인을 하지 않는다.
