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

위 후보 수정 확인은 적격 링크가 입력된 계산 함수에 한정한다. 아래 최신 실제 로더/CI 반례 때문에 FI-011 전체 상태는 **PARTIAL_FIX / OPEN**이다.

## 4a CI 종료 · 지도 로더에서의 누락

[run39121633640](https://github.com/KangMin098/Vocaflow/actions/runs/39121633640), artifact12135540326을 직접 판독했다. verify/build/faultclosed는 성공했지만 일반 E2E는8개 중6 pass/2 timeout이다. [정제 근거](./pr303-4a-ci-evidence.json). 두 폭의 실제 report/network·1440 screenshot·error context와 고정 spec의 단언 순서를 대조했다.

1280/1440 모두 정상9형식 API200, 잘못된 어법 이유, 도움받은 연습의 비근거, 실제 저장 뒤 응답 유실/재시도1행, 별도 페이지 선행 열람의 비근거를 지났다. 폭별 철회 fixture 분리로 양쪽 모두 철회 화면 차단과 키보드 초점/Enter까지 도달했다. 두 테스트 모두241행의 ws.vocab-context 열기에서600초 종료했다. 버튼은 닫힌 「자료 준비 중」 details 안에 남아 있었고, 「풀었어요」 복귀 단언은 미도달이다. 전체 성공으로 세지 않는다.

같은 HEAD의 loadMapPage는 창작 납품을 읽고도 `practiceLinks[c.task]`가 있을 때만 추가한다. 기존 loadMapPracticeLinks의 키는 적용 surface_ref의 대문자 지도 과제 id이고, c.task는 소문자 정본 TASK id다. 기존 슬롯이 없는 적격 창작 TASK는 입력 단계에서 사라지므로 계산 함수의 목록 수정을 통과할 수 없다.

[실행기](../../../apps/web/scripts/final-independent/probe-authored-map-loader4a.mjs)는 실제 고정 loadAuthoredConfirms 선언과 병합 블록을 추출해 실행했다. DB/현재성 판정은 이 실행 범위가 아니며 이미 적격인 합성 납품을 입력으로 공급한다. [결과](./authored-owner4a-loader.json):17 TASK 모두 입력1개가 병합0개이고, 정본 TASK 슬롯을 미리 만든 인위적 대조군에서는 각각1개가 추가됐다. 이는 전체 로더17 TASK 브라우저 성공/실패를 새로 실행한 검사가 아니다. 실제 CI의 문맥 어휘 복귀 실패와 일치하는 입력 누락을 좁혀 재현했다.

기대: 기존 기출 적용 슬롯의 존재와 관계없이 본인에게 현재 적격으로 납품된 TASK의 확인 링크가 지도/Workspace 계산에 보존되어야 한다. 기존 기출 적용의 chain/application 메타데이터를 꾸며 넣지 말고 창작 납품 계약에 맞게 연결해야 한다. 단순 details 강제 열기로 단언만 통과시키는 것으로 이 입력 누락을 해결했다고 세지 않는다. 동일 #304에서 수정 후 실제 로더와 두 폭 복귀를 다시 확인한다.

## 후속964 · 유효성 RPC 경로 개선과 잔여 병합 누락

총괄은 `9647b45e1db1f719b8f778c22cbefa7e742fc689`에서 학습자 세션에 본인 납품 현재성 RPC를 사용하고 service_role에서는 기존 현재성 판정으로 이어지도록 수정했다. [동일 실행기](../../../apps/web/scripts/final-independent/probe-authored-map-loader4a.mjs)의 `--owner964`로 바뀐 실제 선언만 추출해 정상 학습자·철회·service_role의 uid 없음·양쪽 RPC 오류4개를 확인했다. [결과](./authored-owner964-loader.json). 조회/RPC transport는 합성이며 실제 역할 권한/DB 검사를 다시 실행한 것은 아니다.

정상 학습자는 현재성 true로1개를 보존하고, false는 fallback 없이0개, uid 없는 service_role의 null은 기존 판정 true로1개, 양쪽 오류는0개였다. 본인 user_id 필터도 유지됐다. 다만 위 납품 병합 블록 SHA는4a와 동일하다.17 TASK 반례를 그대로 반복 실행하지 않고 원본 결과를 재사용하며 FI-011 전체는 PARTIAL_FIX / OPEN이다. 새 CI run39123873682/e2e job117664841710은 실행 중이며 종료 전 성공으로 세지 않는다.

## 964 CI 종료와71a 실제 병합 수정

[run39123873682](https://github.com/KangMin098/Vocaflow/actions/runs/39123873682)는 FAILURE로 종료했다. artifact12135338310의 report/trace/network/error context를 독립 판독했다. [정제 근거](./pr303-964-ci-evidence.json):6 pass/2 timeout이고 두 폭 모두9형식 정상 API200·이유 오답/도움/응답 유실/선행 열람·철회·키보드 뒤241행의 준비 중 Workspace 버튼에서 실패했다. 두 실패 screenshot은4a와 SHA256이 같아 앞선 시각 판독을 재사용했다. 전체 성공이나 새 권리 결함으로 세지 않는다.

실제 수정 HEAD `71a653ef66dc9202e4dc656828de0d3465fe6d5f`는 기존 정본 TASK 슬롯이 없을 때 창작 납품의 확인 링크를 만든다. [실행기](../../../apps/web/scripts/final-independent/probe-authored-map-loader4a.mjs)의 `--owner71a`는 바뀐 실제 선언/병합 블록을 실행했다. [17 TASK 결과](./authored-owner71a-loader.json): 이전0개 누락이 모두1개 보존으로 바뀌었고 기존 슬롯 대조군도 보존됐다. 서로 다른2개 대상은 유지하고 같은 대상 반복은1개로 모으며, 지식 적용 원장에 없는 chain/application은 만들지 않았다.

위17 TASK 확인은 합성 적격 입력을 준 실제 병합 구간이다. 후속 CI는 아래에서 따로 확인했다. 이전 이미 확인한4a 계산 함수·964 현재성 분기는 반복 실행하지 않았다.

## 71a CI 성공 · FI-011 후보 수정 확인

[run39126159146](https://github.com/KangMin098/Vocaflow/actions/runs/39126159146)의 verify/build/e2e/faultclosed가 성공했다. e2e job117671623257의 artifact12136805272 내부 Playwright report를 직접 판독했다. [정제 근거](./pr303-71a-ci-evidence.json):8 expected/0 unexpected/0 flaky/0 skipped다.9형식1440/1280 모두241행 Workspace 클릭과242행 `풀었어요` 결과 표시 단언을 통과했다.4a/964에서 실패했던 복귀가 실제 격리 브라우저에서도 개선됐으므로 FI-011은 **FIX_VERIFIED_IN_CANDIDATE**다. 전체 제품의 다른 미완성을 이 결함의 수정 미확인 사유로 삼지 않는다.

9형식의 정답/G2 결속, 잘못된 이유, 도움 연습, 실제 저장 뒤 응답 유실 재시도1행, 선행 열람, 철회 차단과 키보드 단계도 통과했다. 키보드는 버튼 focus 후 Enter이며 전체 Tab 이동 검증은 아니다. 별도 R5 공급 두 폭·교수 공개/보류3건·목표 저장1건을 합쳐8건이다.9형식은 합성 적격 demand/delivery를 실제 격리 RPC로 만들며 R5 공급 요청은 별도 사례다. 서로 다른 사례를 한 학습자의 A→H 흐름으로 합치지 않는다.

passing screenshot/trace/HAR 첨부는0이다. 새 시각 판독이나 네트워크 캡처 분석을 주장하지 않는다. 자동화 응답은 Gold를 사용한 합성 입력이며 사람 독립 수행/효과가 아니다. 실제 개발 DB·새 PLAN 의미 버전/학습 요구 변화·전체 TASK 관통은 여전히 미검증이다. 최신14446db10은 관찰 TASK 계약/UI와 장부를 추가했으며 해당 CI는 별도 진행 중이다.71a의 녹색 결과를 최신 HEAD 전체 성공으로 쓰지 않는다.

전체 A~H REWORK. FI-006/010/014와 PR250 FI-015/016 및 FI-017/018, 실제 공급·사람 승인·효과의 미완성 조건은 유지한다. safe-merge/병합은 수행하지 않았다.

## 144 관찰 TASK 계약 · 좁힌 독립 확인

후속14446db1048258752acb22ba08171196e8b33566은22de94acf의 관찰 계약/UI와 장부 수정이다. [독립 실행기](../../../apps/web/scripts/final-independent/probe-integrated-observation144.mjs)는 고정 HEAD의 observation/definition/실제 정의 데이터/authored TASK 모듈만 실행한다. [104조합/3 null 결과](./integrated-observation144.json)는 비보류 통합 TASK3개의 실제 승인 PART_OF에서 모든 하위 직접 확인, 직접 확인된 필요, 한 하위 누락·proxy·만료·진행·미측정·직접 근거 없는 resolved를 대조했다. 축 proxy·상태명만으로 관찰 가능을 만들지 않고 점수 필드도 없다. 모두 직접 확인돼도 숙달/통합 수행 입증이 아닌 관찰 시작 가능으로 안내한다.

처음 실행기의 통합 TASK3개 가정은 보류 X-O1까지 포함해 실패했다. 비보류3개로 범위를 바로잡았으며 제품 결함으로 세지 않았다. X-O1의 제안 관계는 실제 partsOf에서 제외돼 null이다. 도구 존재는 정본/창작 키의 정적 정의이며 실제 적격 출시 공급이 있다는 뜻은 아니다. JSX 연결은 코드로 확인했으나 신규 화면 렌더링·브라우저·실제 학습자 데이터는 이 순수 함수 실행 범위가 아니다. 기존 가로 넘침/CI 결과를 신규 UI 전체 검증으로 확대하지 않는다.

후속 종료 관찰:144 run39127042596은 verify/build/e2e/faultclosed 성공, shared-dev SKIPPED다. authored-formats/authored-supply 두 주요 spec의71a→144 바이트 변경이 없어 기존 직접 판독을 재사용한다. 새 artifact12135699816의 내부 report/시각 판독을 반복했다고 쓰지 않는다. [게시/인계 영수증](./GITHUB_HANDOFF.md)을 남겼다.
