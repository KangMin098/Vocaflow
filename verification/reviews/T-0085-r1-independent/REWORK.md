# T-0085 rev1 · HEAD 7c1376875572b1bd0a2ecf4c57b35c2a39a68078

판정 **REWORK** · 현재 수정할 원인은 아래 P1 하나다.

**P1 · T0085-P1-1 — 화면 결과 라벨이 공통 근거 상태를 우회함**

- 최초 반례/정상 대조: `status=analyzed, result=supported, synthetic=true` 또는 `synthetic=false, reviewRequiredAt=undefined` 또는 `synthetic=null`을 실제 `KnowledgeDesignPage`/`KnowledgeProductPage`의 loader 대역으로 제공한다. 원장/DB를 쓰지 않는 실제 RSC 렌더다.
- 실제: opsSummary 현재 분석 수는 올바르게0인데, 두 화면은 `t.result`를 직접 읽어 각각 **합성 · 분석 완료 · 효과 지지**, **비합성 표시 · 분석 완료 · 효과 지지**, **합성 여부 미상 · 분석 완료 · 효과 지지**를 표시한다. 재계산 표지 미확인 사유도 해당 줄에 없다. 합성/미확인 결과를 학습효과 근거처럼 읽게 만드는 표시 결함이 남는다.
- 원인: `TRIAL_EVIDENCE_LABEL`과 상태 계산은 추가됐지만 화면의 `reviewRequiredAt ? ... : result ? TRIAL_RESULT_LABEL[result] : ''` 분기는 여전히 공통 상태 판정을 쓰지 않는다. 상세 trial 줄도 같은 직접 출력 분기다.
- 기대: 상태와 결과 설명을 같은 함수/동일 판정으로 렌더한다. current만 현행 분석 결과를 제시하고, stale은 재계산, unknown은 확인 불가, synthetic은 경로 검증(효과 근거 아님), pending은 분석 전이다. 과거/합성 원시 result를 보존해 보여줄 필요가 있으면 반드시 **현재 근거 아님**이라는 명시 범위를 붙여 일반 효과 결과와 구별한다. 가장 작은 수정은 세 표시 지점에서 current가 아닐 때 일반 결과 라벨을 숨기고 공통 상태 이유를 보여주는 것이다. 원시 DB/결과 삭제 또는 변경은 하지 않는다.
- 범위: 현재 허용 vnext-rules + 설계/적용 목록/상세의 trial 표시 + 관련 테스트만. 집계/순위/cohort/G2/PLAN/SQL/실제 연구 프로토콜/현재 main 화면 구조는 재구현하지 않는다.
- 독립 재현: `probe.test.tsx` **6 통과 / 6 실패 / skip0**. 6실패는 합성/재계산 표지 누락/출처 미확인 × 두 실제 화면. 최초4반례·대조는 전부 통과했고 current supported는 유지, 정상 stale 결과 숨김도 통과했다. `probe-results.json`은 실제 JSON reporter 출력이다. 최초 React JSX runtime alias 오류는 `initial-harness-error.json`에 따로 보존했으며 제품 실패로 세지 않았다.
- 재검증: 이6건 + 기존6대조 + 관련 타입/lint. 결과 종류별/계획만 있는 상태 정상 대조는 기존 시험을 재사용한다. 변경 없는463개 전체나 DB/새 CI 실행을 요구하지 않는다. UI는 해당 표시만 기존 RSC/Chromium 장치로 확인하면 된다.

**이미 수용된 범위:** 원 opsSummary 독립4/4, 현재 분석/재계산 필요 집계 분리, 비합성≠실제 참가자 문구, 기존 main 후속 변경 보존 의도는 확인했다. 재구현하지 않는다. 코드 판정과 UI 증거 형식은 별개이며 형식 반려를 이 P1의 원인으로 세지 않는다.

**P2 비차단:** trialEvidenceState가 `status` 누락/모르는 값도 pending으로 분류한다. 현재 분석으로 승격되지는 않으므로 P1 차단 조건이 아니다. 필요하면 같은 순수 함수에서 기존 TRIAL_STATUSES로 unknown을 구분하되 별도 TASK/계약/DB 변경은 만들지 않는다.

main-serving은 현재 다른 owner의 미커밋 CSAT UI 작업이 있으므로 여기서 병합하지 않는다. source 감사2파일도 보존한다. 인증 Next+DB·관리자 스킨·실제 연구 효과는 미검증 그대로다.
