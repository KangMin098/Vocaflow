<!-- docs/implementation/learning-outcomes-20261021/02D-CANONICAL-CYCLE-SPEC.md -->
# 2D — 실제 단계 순서에 원문 교수 활동을 연결

2026-10-21 · 기준 `3cc1e78d4`. 2C의 저장 기능은 통과했으나 전체 순서를 검증하지 못했다. 새 화면 확대 전 이 결함을 수정한다.

## 확인한 결함

- `loadMapPage`는 창작 guided 납품만 repairTargets에 넣고, learning_task_attempts/G2 결속만 guided lifecycle로 읽는다. 새 source DCP/설명 원장은 빠져 있어 원문 교수 활동을 마쳐도 `repairGate`가 진전하지 않는다.
- 2C 시험은 초기 check 계획에 수동 guided 수요부터 만든다. 실제 buildDemand는 check에서 independent_check만 만들므로 현실의 요청 순서가 아니다. 실제 흐름은 `check→repair→transfer(정본2지문)→recheck(미노출2개)`다.
- 새 plan 버전은 기존 DCP의 신규 열기를 막는다. 이미 끝난 교수 활동의 같은 목표·같은 회차 수행 사실까지 사라지게 하면 repair로 되돌아가는 순환이 된다. 과거 수행 인정과 구자료 신규 학습 허용을 분리해야 한다.
- 기존 검수5개에는 independent2개·transfer1개뿐이다. 처음 확인2 + 다시 확인2 + transfer2를 위해 **독립2개/전이1개만 추가**한다. root가 별도 자체 창작3문항과 실제 Claude/Codex 검토를 runtime에 준비한다. 기존 v3 파일/5문항 영수증을 바꾸지 않는다.

## 최소 구현

1. source 안내 연습의 **정확한 본인·목표·Workspace·회차·납품·원문/문항/교수 판본·승인·실제 채점·설명 저장**을 확인해 기존 지도 loader의 바로잡기 자료/수행에 연결한다. source를 authored로 위장하거나 Gold/G2를 만들지 않는다. 새 소프트웨어 근거는 수행 사실이며 독립 능력/향상 근거가 아니다.
2. 교수 시범을 보기만 했거나 설명 미저장/누락/오답뿐인 상태를 완료로 만들지 않는다. 전체 의도 활동 완료 조건과 기존 repairSuccess의 실제 정오를 함께 지킨다. 자유 설명을 키워드로 정답 채점하지 않는다. 회차 전·다른 목표·다른 사용자·철회/원문변경은 제외한다.
3. 현재 같은 목표의 다음 계획을 저장한 뒤에도 끝난 바로잡기 사실은 보존해 transfer/recheck가 repair로 되돌아가지 않게 한다. 구계획 자료를 새로 열어 풀 수 있게 완화하지 않는다. 실제 원장 시각을 만들거나 다시 쓰지 않고, projection의 완료/수신 시각 의미를 명시한다. 과거 asOf에 미래 완료가 유입되지 않는 시험도 둔다.
4. 수요는 **실제 buildDemand**에서 만들고 실제 1A 계획/1B/1C 호출 계약을 따른다. 수량도 일치해야 한다: 현재 fallback guided1인데 의도 source 교수 활동은3개라는 차이를 확인한다. 재고 수/목표 숙달량을 꾸미지 말고 필요하면 실제 교수 청사진의 활동 수에서 최소 수량을 산출하는 좁은 계약을 추가한다. 정본 전이2/재확인2·점수 임계값은 바꾸지 않는다. stage가 check인 입력을 repair인 것처럼 꾸미지 않는다.
5. 실제 `composeV4`/`nextActionOf`와 실제 `/api/csat/diagnosis/map/plan` POST를 호출해 저장한다. 인증/기타 도메인 입력은 격리 대역을 명시할 수 있지만 compose·단계·G2·계획 RPC와 저장 결과를 대역으로 바꾸지 않는다. 핸들러 순서를 복사한 시험은 충분하지 않다.
6. 한 결합 설치 DB에서 정상 요청 순서대로 초기 독립2(합성 오답 회귀임을 명시)→repair 계획/수요→source 교수→바로잡기 인정→transfer 계획/미노출2지문 수행→recheck 계획/새 독립2→결과→새 계획 저장을 끝낸다. 동일 지문 다른 문항은 transfer2지문이 아니다. 미노출 재사용, 계획/목표 충돌, 응답 유실 재시도, 구원천/철회, 실패/없음/미상, guided가독립G2에 섞이지 않음을 반례로 확인한다.

## 입력과 결과

추가 창작 패킷 `D:/workspace/Vocaflow-AI-Control/runtime/learning-outcomes-20261021/cycle-supplement.v1.json` 및 `cycle-supplement-ai-review.json`은 root가 이 세션과 병행해 외부 runtime에 작성·실제 두 AI 검토한다. 준비 전에는 독립 코드 작업을 계속하고, 자리 채우는 가짜 파일/검수를 만들지 않는다. 기존 `recordAiReviewedSupply`는 세트별 영수증으로 추가 등록할 수 있다. 같은 판본 기존 결정에 바뀐 영수증을 덮지 않는다. 정본 세트에 추가해야 할 때는 실제 수락 바이트·증거를 복사한다.

새 SQL은 pending, 공유 DB 쓰기/계정/발행/원격 작업은 없다. 테스트 시각은 주입하거나 Date fakeTimers로 고정한다(기존 world()의 Date.now 의존도 제거). 관련 타입/lint·정본 순서 SQL 통합·브라우저 실제 다음 행동/재시도와 캡처를 확인하고 문서/도움말(해당 시)/CHANGELOG/로드맵/02D 결과를 갱신한다. 기존 사람 원장/역사 문서는 보존하지만 이번 사람 검토 행0. <30파일의 범위로 처리한다. 실제 Supabase 인증/RLS/동시성 미실행은 NOT_RUN.
