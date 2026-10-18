<!-- docs/research/final-independent-20261018/APP_REPAIR_REVERIFY.md -->
# 앱·환류·내용 수정 독립 재검증

고정 제품 수정 `7e638e63d28791dcc4f886431c0205743dc3310a`. 최신 CI 관찰은 후속 `9bd249dd714e4ad3125b96f25f9fd245fbe25ea0`이며 두 커밋 사이 제품 함수는 그대로다. **FI-008/012/013과 FI-005의 원래 모집단/측정 서술은 후보 수정 확인, FI-011은 중심 의미 경로 개선과 확장 TASK 잔여 결함을 함께 기록한다. 전체 REWORK**. 실제 DB 쓰기·사람 승인·병합은 없다.

## FI-008 · 실제 화면의 재시도 → 기존 G2 함수

[실행기](../../../apps/web/scripts/final-independent/probe-authored-formats7e.mjs)는 실제 AuthoredRunner/채점기/CSS를 Chromium1280/1440에서 실행했다. API 응답만 합성 transport로 대체했다. 첫 응답 유실을 오류 응답으로 모델링하고 가상 시계를2초 진행한 뒤 같은 답을 다시 제출했다. 제출 id·세션·판단 시각·응답·납품 id를 포함한 요청 전체가 동일했다. [브라우저 결과/요청](./formats7e/results.json).

이 두 폭의 요청을 [설치 G2 함수 본문을 재사용한 격리 재생기](../../../apps/web/scripts/final-independent/probe-authored-retry7e.mjs)에 넣었다. [결과](./authored-owner7e-retry.json): 첫 제출 inserted, 동일 원문 재전송 duplicate, 실제 브라우저 재시도 duplicate, 판단 시각을 바꾼 같은 키 요청 conflict. 시각 보존 수정이 원자 원문 비교 계약과 맞는다. 사용한 계약 SHA와 함수별 SHA를 결과에 보존했다. 최소 스키마 PGlite이며 실제 운영 trigger/RLS/동시성이나 응답 유실을 실제 네트워크에서 만든 전체 서버 시험은 아니다. StructurePredict의 별도 UI 경로까지 이 결과로 수용하지 않는다.

판정: **FIX_VERIFIED_IN_CANDIDATE**, AuthoredRunner 재시도 경로.

## FI-012 · 동등한 결정 근거와 불완전 근거 구분

기존 봉인 독립 판독의 inf-guided-1 응답(문장3·4, 문장4가 대체 결정 근거)이 새 decisiveAlt와 실제 채점기에서 정답이다. 기존 봉인 파일을 수정하지 않았고 새로운 맹검이라고 부르지 않는다. 두 폭의 실제 Runner도 같은 응답에 정답을 표시했다. [1280](./formats7e/1280-equivalent-evidence-fixed.png) · [1440](./formats7e/1440-equivalent-evidence-fixed.png).

합성 의미 대조군은 주된 시간 진술 또는 '막차 시각 + 막차 때 폐관'의 두 전제를 완전한 대안으로 두었다. 주근거/완전 대안은 정답, 대안의 전제 하나만 선택·보조 단서만 선택·무관 문장 추가·틀린 선택지는 오답, 주근거+허용 보조는 정답이었다. 빈 대안 목록은 허용하고 빈 집합/범주 밖 대안은 validator가 거절했다. 브라우저에는 완전/불완전 대안도 실제 렌더링·입력·피드백으로 대조했다.

이 실행의31개 관찰은 전부 기대와 일치했다. 런타임 오류·외부 요청·가로 넘침0, bundle에 authored Gold JSON 입력0. 직접 shell/인증/DB/전체 학습 흐름이나 모든 문항의 Gold 타당성으로 확대하지 않는다. 판정: **FIX_VERIFIED_IN_CANDIDATE**.

## FI-011 · 중심 의미 개선, 확장 Workspace는 부분 미완료

[실제 함수 실행기](../../../apps/web/scripts/final-independent/probe-authored-feedback7e.mjs)·[원본4건](./authored-owner7e-feedback.log). 적격 납품 링크/수행을 공급받았다는 합성 계약 입력이며 실제 DB 승인 행은 아니다. 실제 asIsMap/toBeMap/planWorkspaces/loadPassageKeys/transferDoneOf를 사용했다.

- 원래 중심 의미 반례: 확인 링크가 To-Be 실행 링크와 Workspace check/next로 연결됐다. 링크가 없는 대조군은 열리지 않는다.
- 전이의 authored key가 다음 필요를 MAINTAIN으로 바꾼다. 기존 legacy key 정상 대조군과 일치한다.
- 로더가 authored passage_key를 읽어 서로 다른2지문을2로 계산한다. 동일 key의 두 기록은1, 정체성 미확인은0이다. 이 검사는 로더/집계이며 DB 해시 생성 알고리즘 자체는 앞선 SQL 검증을 재사용한다.

그러나17세트의 연결을 대조하니 **r.inference/ws.inference, s.form_scope/ws.grammar-scope, v.contextual_sense/ws.vocab-context**는 check 미노출2건과 적격 링크가 있어 stagesOf(check)=ready:true인데 planWorkspaces의 반환 목록에는 없다. 같은 정의가 preparing에 남는다. 원인은 함수 시작에서 readiness=live/ready만 views에 넣어 content_needed를 먼저 제외하기 때문이다. 안쪽 authoredLive guard를 고쳐도 호출 대상에서 빠진다. 기대: 정본의 준비 상태 자체를 임의 변경하지 않으면서 적격 납품이 있는 기존 Workspace는 실제 경로에서 실행 가능해야 한다.

원장에는17 TASK의 중심(core 첫 항목) 템플릿 및 기존 core/support 관계를 함께 출력했다. 중심 템플릿이 없는10개를 모두 '미구현'으로 확정하거나 각 TASK에 새 독립 Workspace를 만들라는1:1 게이트로 쓰지 않는다. 연결이 확인되지 않는 부분은 UNMAPPED/NOT_VERIFIED다. 위3개는 이미 있는 템플릿과 명백한 함수 불일치의 반례이므로 기존 #304에서 추적한다. **PARTIAL_FIX / OPEN**. PLAN 저장·버전 충돌·전체 브라우저 복귀까지 이 순수 함수 검사를 확대하지 않는다.

## FI-005/013 · 수정 뒤 내용 검토

새 Gold/수정 사유를 이미 본 상태에서 수행한 delta 검토다. 새 맹검·사람 Gold가 아니며 기존 봉인 판독 파일은 보존했다.

- FI-005: R5 ind-1의 아동/더 독창적인 응답 서술은 성인/응답 수 증가로 바뀌었다. 원논문 Study1의 모집단과 결과 구분에 맞게 원래 두 오기를 수정했다. 원논문은 성인80명,15분 전화번호 필사 뒤 응답 수 증가를 보고하며 창의성 평정 차이는 유의하지 않았다. [저자 승인 원고 p9~11/17](https://knowledge.lancashire.ac.uk/id/eprint/22263/1/22263%20Does%2520being%2520bored%2520make%2520us%2520more%2520creativeV2.pdf). 본문의 paper cup 표현은 원논문의 두 polystyrene cups와 완전히 같은 절차 기술은 아니므로 이를 정확한 연구 전사/아동 인과 효과 근거로 승인하지 않는다. 이 부수 차이를 새 코드 병합 필수 게이트나 중복 결함으로 늘리지 않는다.
- FI-013: gs-transfer-1의 the simple irrigation ditch를 복수 irrigation ditches로 바꾸고 첫 밑줄도 are로 맞췄다. 두 번째 문장도 복수 rivers/ditches/fields로 재작성해 원래 its를 받을 수 있던 단수 ditch 대안을 제거했다. 기존 핵심 반례는 수정 확인했다. 정답/설명·현재 본문 전체의 최종 사람 Gold는 여전히 별도다.

각 판정은 원래 결함 범위의 **FIX_VERIFIED_IN_CANDIDATE**이며 두 세트의 출시 승인이 아니다. 수정된 본문·Gold와 결속되는 최신 revision/hash에 사람 검수 근거가 필요하다. FI-014(#307)의 주어/본동사 이유 대안은 제품 소스에 새 수정이 없어 기존 증거를 재사용하며 OPEN을 유지한다.

## 최신 CI · 실패는 검사기 대기와 구별

[run39118279343](https://github.com/KangMin098/Vocaflow/actions/runs/39118279343), HEAD689d25694, artifact12133469347을 직접 내려받아 report/trace/network/두 폭 screenshot을 판독했다. [정제된 증거](./pr303-689-ci-evidence.json). 총8건 중6 pass/2 timeout이다. R5 두 폭·Reveal Gate3건·목표 저장1건의 성공은 재사용한다.

새9형식 루프는 첫 e.evidence_location 문항 제출 POST가200이고 두 폭 screenshot 모두 정답 결과를 표시한다. 그 뒤 spec136의 두 번째 `submit.click({trial:true})`가 timeout=0으로 시작해 after 이벤트 없이 테스트600초를 소진한다. 사라진 버튼을 기다리는 검사기 문제이며 trial은 실제 두 번째 클릭도 아니다. 이를 채점 실패나 실제 중복 클릭 검증 성공으로 보고하지 않는다. 남은8형식/후속 근거·철회·키보드·지도 단언은 이 실행에서 도달하지 않았으므로 PASS로 세지 않는다.

총괄9bd249dd7은 해당 trial 대기에 제한을 추가했다. 새 [run39120198955](https://github.com/KangMin098/Vocaflow/actions/runs/39120198955)의 verify/build는 성공, e2e는 관찰 시 진행 중이다. 새 HEAD 성공을 이전 결과로 대체하지 않는다. shared-dev SKIPPED는 실제 개발 DB 성공이 아니다.

## 외부 승인 패키지의 현재성

[저장소 바이트 감사](./approval-package-currentness.json):9bd의 APPROVAL_PACKAGE에 적힌 SQL/R5 전체 SHA와 추론/어법 B2 축약 SHA는 실제 수정 파일과 다르다. B2가 승인 직전 최종 SHA 재측정을 요구하는 사실도 함께 기록했다. C의 요청 범위는 store/display/transmit이며 새 SQL이 평가에 요구하는 assess가 명시돼 있지 않다.

이전 문자열에 대한 승인을 최신 파일에 적용하거나 Gold assess를 이용 권리 assess로 대신하지 않아야 한다. 승인 제출·실행 전에 실제 대상 바이트와 요청 범위를 맞추는 것은 기존 외부 승인 조건이다. 문서 정리를 별도 신규 제품 게이트로 늘리는 것이 아니다. 현재 미승인 상태와 개발 DB authored 미설치는 유지하며 실제 적용 완료로 판정하지 않는다.
