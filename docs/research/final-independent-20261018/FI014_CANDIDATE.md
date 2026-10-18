<!-- docs/research/final-independent-20261018/FI014_CANDIDATE.md -->
# FI-014 · 문항별 대체 구조 이유의 격리 수정 후보

제품 기준14446db1048258752acb22ba08171196e8b33566. **제품 FI-014는 OPEN**이며 아래 후보는 제품/DB에 적용하지 않았다. Gold와 권리는 사람 승인 전 초안이다. 기존 #307로 인계하며 중복 이슈를 만들지 않는다.

[실행기](../../../apps/web/scripts/final-independent/probe-segment-alternatives-candidate.mjs) · [선택 패치](./fi014-segment-alternatives-candidate.patch) · [결과](./fi014-segment-alternatives-candidate.json). 제품 소유권을 건드리지 않고 고정 소스의 무시되는 복사본에서 실행했다. 패치는 formats.ts/AuthoredRunner.tsx/s-chunk-boundary.v1.json의3경로를 대상으로 하며 격리 원본에 `git apply --check`가 통과했다.

현재 단일 이유와 정답 덩어리는 유지한다. Gold의 문항별 `reasonAlternatives`에 이유 코드와 설명을 추가하며, 응답 뒤 해설에도 「함께 맞는 이유」를 표시한다. 빈/중복/알 수 없는 이유·설명 없는 대안·기본 이유 중복은 등록 검증과 채점에서 거절한다. 일반적인 이유 전체를 허용하거나 위치만 맞으면 정답으로 만들지 않는다.

|문항|보존하는 기존 이유|후보 대체 이유|근거|
|---|---|---|---|
|cb-guided-1|clause_boundary|main_verb|refused는 주절 정형 본동사의 시작이며 발문도 그 시작을 묻는다|
|cb-ind-1|ellipsis_restored|clause_boundary|their children에서 believe의 목적어절이 시작된다|
|cb-ind-2|phrase_boundary|main_subject|선택한 명사구 전체가 worried의 주어이며 주어 전체를 묻는다|
|cb-delayed-1|ellipsis_restored|clause_boundary|the family had forgotten에서 box의 관계절이 시작된다|

실제24개 segment_choice 문항의 가능한 덩어리×14개 이유 **1,596조합**을 비교했다. 바뀐 것은 위4개 정답 덩어리/대체 이유 조합뿐이다. 기존 기본 정답은24개 모두 유지하며 다른20문항은 판정이 동일하다. 잘못된 덩어리와 무관한 이유는 오답이고, 형식 밖 응답은 null이다. 잘못된 Gold 대안7종도 검증 오류/채점 null이었다. 이 검사 결과를 학습자 능력이나 효과로 환산하지 않는다.

`--browser`는 실제 후보 Runner/CSS와 실제 후보 채점기를 로컬 합성 API로 연결했다.1280/1440 각각 대체 이유4건·틀린 덩어리1건·무관한 이유1건, 총12건의 입력→제출→결과/대안 설명 표시와 가로 넘침0을 확인했다. 런타임 오류/외부 요청0, authored Gold JSON의 브라우저 번들 입력0이다. [1280 정답 화면](./fi014-candidate-ui/1280-cb-ind-2.png)과 [1440 무관한 이유 거절](./fi014-candidate-ui/1440-unrelated-reason.png)은 직접 육안 확인했다. 전체 셸·라우트 인증·실제 저장/G2·PLAN·참조 디자인 정합은 이 실행 범위 밖이다.

후보 준비 중 실행기 앵커/경로 가정 오류는 바로잡았다. 최종 실행 PASS만 후보의 기능 근거이며 초기 도구 오류를 제품 결함으로 추가하지 않는다. 실행기 ESLint도 통과했다. 실제 제품 TypeScript/CI/DB 수정 확인은 담당 세션의 채택 후 별도다.

Gold 내용 변경은 실제 등록의 gold hash/revision과 그 revision에 대한 사람 검수가 필요하다. 여기의 파일 SHA는 소스 추적용이며 PostgreSQL Gold hash 실행 결과가 아니다. 기존 승인/자격을 새 Gold로 이월하거나 AI 판단으로 출시 승인하지 않는다. 후보가 채택되면 같은 #307에서 실제 HEAD·채점·UI와 관련 자격 결속을 독립 재검증한다. 전체 A~H REWORK는 유지한다.
