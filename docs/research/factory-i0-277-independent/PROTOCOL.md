# PR #277 I0 독립 수용 프로토콜

등록: 2026-10-17. 제출 200bfdeacd55af39f35c5d3a9648ffe050b7e3ed, main 9c19f15b1fc911b13040dc01fe5a12fef5af592f, merge-base 5e2aff89d01e25b959647f25e8a0e02115e41dd4. 검토 branch review/factory-i0-277-acceptance, task T-0044.

## 사전 기대 조건
1. 공용 shareKey는 개인 식별자/PLAN 버전을 제외하되 실제 생산 명세·정책 6종의 revision/hash·수요/부족/생산 수량·단위 환산 근거·TASK/역할/유형 조건에 결속한다. 단순 그룹화를 수량 집계/주문 실행으로 해석하지 않는다.
2. recorded boolean/산출물 수/형식 hash만으로 run·내용 검증 또는 ARTIFACT_CANDIDATE를 인정하지 않는다. 실제 공장 검증기가 미연결이면 보류한다.
3. 음수·비유한수·비정수·안전 범위 밖 수량과 비유한/부적격 환산을 거절한다. 값을 조용히 0 또는 내림 수로 바꾸지 않는다.
4. 동일 산출물 중복으로 적격 재고·충족량을 부풀리지 않는다. 같은 산출물의 상충 revision/판정을 순서에 따라 선택하지 않는다. 평가 자료의 같은 지문 중복·노출은 계속 차단한다.
5. lineage는 구조·참조·형식만 검증한다면 그 한계를 명시한다. 실제 산출물 본문 hash 검증이나 출시 승인을 지어내지 않는다.
6. TASK 영구 ID와 E2/E1 정본을 대조한다. 잘못된 후보는 제거, 관계 미검증은 search_only로 유지한다.
7. C/B 노출·승인·부분 납품·단위·공용 주문 계보·RLS의 미적용 blocker를 유지한다. SQL과 실제 데이터는 바꾸지 않는다.

## 증거와 종료
원본 28개와 독립 반례의 최초 실패 JSON/hash를 보존한 뒤 최소 보완하고 동일 반례를 재실행한다. fixture 통과는 실제 공장·내용·교수 타당성 증거가 아니다. T1–T4·V2 1280/1440와 기존 Workspace/복귀/해부/공급의 완결 실행·소스 hash·계정 정리를 확인한다. 최종 목적 리뷰·최신 HEAD 필수 CI 뒤 safe-merge만 사용한다. 출시·실제 주문/생산/납품은 CONTRACT_ONLY / NOT_CONNECTED로 남긴다. PR278 및 비공개 맹검 자료는 읽거나 바꾸지 않는다.

## 충돌
CHANGELOG만 충돌했다. 독립 worktree에서 main 병합으로 양쪽 이력을 보존했다. force push하지 않는다. Git은 진행 중 merge에서 부분 커밋을 허용하지 않으므로 이 merge commit은 해당 worktree의 main 유입 변경과 명시 해결한 CHANGELOG만 포함한다. 일반 후속 커밋은 --only로 자기 파일만 담는다.

## 사용자 최초 지시 보충 반영
S01–S16 원문/기대는 삭제·완화하지 않는다. 기존 28개 중 S01–S16 밖의 안전하지 않은 run 승격 기대 1개와 lineage 범위 명시 기대 1개만 강화한다. #276 제품 코드는 변경하지 않는다. 최초 28개·45반례 실행은 main 통합 HEAD 9e6393e42에서 했으며, bridge 원본 파일은 제출 200bfdeac와 바이트 동일함을 git diff 및 hash로 확인했다. 이를 제출 HEAD 자체에서 실행했다고 바꾸어 적지 않는다. C/B/delta의 SECURITY DEFINER·search_path·RLS·사용자 소유권·부분 공급·잔여 부족·공용 주문 N 계보를 정적/읽기 전용으로 감사한다. 실제 DB 원자성/RLS/실납품은 NOT_TESTED·BLOCKED_APPROVAL로 남긴다. 최초 지시의 A–G 및 최신 추가 A–G를 모두 최종 보고에 대조한다.
