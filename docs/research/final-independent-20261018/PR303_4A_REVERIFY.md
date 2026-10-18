<!-- docs/research/final-independent-20261018/PR303_4A_REVERIFY.md -->
# PR303 후속 ·9bd CI의 도달 범위와4a Workspace 수정

## CI9bd · 실패 안의 확인 범위

[run39120198955](https://github.com/KangMin098/Vocaflow/actions/runs/39120198955), HEAD9bd249dd714e4ad3125b96f25f9fd245fbe25ea0, artifact12134890221을 내려받아 report/trace/network/두 폭 screenshot을 독립 판독했다. [정제 근거](./pr303-9bd-ci-evidence.json). 전체8개 중6 pass/2 실패, flaky/skip0이다. 전체 성공으로 바꾸지 않는다.

trial 클릭 대기 수정 뒤 새9형식 루프는1280/1440 모두 각9문항의 정상 입력→실제 API200→정답 표시→G2 납품 결속 evidence=true/시도1행 단언을 지났다. trace의9개 정상 문항 요청과 오류가 난 소스 위치가 일치한다. 형식마다 후속 전체 흐름이 모두 완료된 것은 아니다.

두 폭 모두 어법의 이유 오답 처리·단서를 연 연습의 비근거·실제 서버 저장 후 응답 유실/재시도1행·별도 페이지 선행 열람의 not_first_exposure도 지났다. 특히 FI-008은 메타데이터 재생뿐 아니라 이 실행의 실제 서버 저장/응답 유실 복구 근거가 추가된다. FI-010의 정상 열기 기록 개선과 기록 실패 잔여 반례는 구별한다.

- 1440: 뒤이어 철회 화면 차단과 키보드를 거쳐 지도 복귀까지 갔지만 ws.vocab-context 버튼이 숨겨진 채 기다려 spec240에서600초 종료. 기존 FI-011의 확장 Workspace 연결과 함께 추적한다.
- 1280: 앞 폭에서 철회한 같은 sem-ind-2를 재사용해 spec218의 납품에서 권리 결정 누락/철회로 거절됐다. 새 권리/SQL 결함으로 이슈를 만들지 않는다. 이 폭의 철회 화면/키보드/지도 복귀는 미도달이다.

기존 R5 두 폭·Reveal Gate3·목표 저장1은 같은 HEAD에서 성공했으며 재사용한다. 합성 관리자/승인/학습자 fixture이므로 실제 개발 DB·사람 승인·실학생 능력/효과 증거가 아니다.

## FI-011 ·4a 수정의 좁힌 재실행

수정 HEAD `4a751eeb9215bf4c6e81f8d512b3fff432d18d67`은 적격 창작 납품이 있는 기존 content_needed/blocked 템플릿을 반환하고 preparing에서 뺀다. [실행기](../../../apps/web/scripts/final-independent/probe-authored-feedback7e.mjs)의 `--owner4a`는 이 HEAD의 소스를 추출해 바뀐17 TASK 행렬만 실행했다. 변경 없는 원래3검사는 필터 SKIPPED이며 새 PASS로 더하지 않는다. [원본](./authored-owner4a-feedback.log).

r.inference/ws.inference, s.form_scope/ws.grammar-scope, v.contextual_sense/ws.vocab-context 모두 직접 단계/반환 Workspace ready=true, preparing=false가 됐다. 기존 정본 readiness 값은 바꾸지 않았다. FI-011의 원래 중심 의미 개선 및 이 확장3개의 **FIX_VERIFIED_IN_CANDIDATE**를 인정한다.10개 비중심 TASK에는 기존 core/support 관계를 기록하고 전부 미구현이라 단정하거나 새 독립 Workspace를 강제하지 않는다.

4a는 폭별 철회 fixture도 분리했다. 최신 CI run39121633640/e2e job117658244757은 별도 추적 중이며 그 성공을 이전9bd 도달 범위나 순수 함수 검사로 대체하지 않는다. 실제 브라우저 지도 복귀/전체 PLAN 의미 갱신까지 모두 수용했다고 쓰지 않는다.

전체 A~H REWORK. FI-006/010/014와 새 PR250 FI-015/016 및 실제 공급·사람 승인·효과의 미완성 조건은 유지한다. safe-merge/병합은 수행하지 않았다.
