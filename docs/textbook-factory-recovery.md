# Textbook Factory 합성 실행·복구 절차

이 문서는 Product Order에서 합성 조판·게시 예행까지의 실패를 복구하는 절차다. 합성 fixture는 `synthetic_fixture=true`, `non_production=true`로만 사용하며 실제 Gold-S·seed·게시를 만들지 않는다.

| 실패 시점 | 확인할 현재 증거 | 복구 방법 | 기존 결과 취급 |
|---|---|---|---|
| 기획·주문 | brief hash, order revision/hash, capability | brief를 다시 계산하고 새 revision으로 주문을 봉인한다 | 이전 주문 revision의 하위 산출물은 stale |
| source·각색 | 원문/권리/각색 해시, source route | 변경된 원천·타겟으로 후보를 다시 생성·검수한다 | 이전 검수·후보를 덮어쓰지 않는다 |
| benchmark·Gold-S·seed | 각각의 snapshot/certificate/eligibility hash와 만료·철회 | 최신 증거로 다시 평가하고 새 승인 증거를 발급한다 | 기존 서명·승인을 재사용하지 않는다 |
| queued→ready | 현재 주문/원천/권리/승격 요청·감사 | 승인된 동일 요청의 재시도 결과가 이미 ready인지 확인한다. 변경이 있으면 새 요청을 만든다 | 혼합·만료 요청은 RPC가 거부하며 수동 UPDATE하지 않는다 |
| item·explanation·editorial | 현재 ready 지문, 완전한 factory lineage, 문항 digest | 변경된 단계부터 재생성하고 해설과 검수를 다시 받는다 | 옛 문항·해설·검수는 후속 조립에서 제외한다 |
| unit·volume | 주문/학년별 unit hash, 균형·진도 계획 | 영향받은 단원부터 다시 조립한 뒤 권 전체를 다시 검증한다 | 다른 학년·revision의 단원을 섞지 않는다 |
| atomic capture·render | snapshot ID/hash, 만료, approved output hash | capture 전 실패는 현재 입력을 재검증한다. 승인된 capture 뒤 finalize가 실패하면 같은 승인은 이미 소비됐다. 새 그룹 revision 등록 → 미승인 capture·조판·finalize → 그 출력에 대한 독립 관리자 승인 → 승인 소비용 새 capture·finalize 순서로 재발행한다 | 실패 HTML을 게시하지 않는다. 소비된 승인·snapshot을 재사용하지 않는다 |
| publish simulation | snapshot/output hash, 현재 권리·인증·ready | 게시 RPC가 실패하면 현재 증거를 재조회한다. 변경이 있으면 새 snapshot과 새 출력으로 재발행한다 | 이미 게시된 동일 snapshot을 재게시하지 않는다 |
| catalog/revision | 변경된 artifact ID와 source→publication 의존 그래프 | `planFactoryImpact`로 영향 범위를 계산해 stale 또는 invalidated로 제안한다. 새 revision을 만들고 재검증한다 | 제안만으로 실제 게시 상태를 바꾸거나 재발행하지 않는다 |

재실행 안전성: 읽기·계획·검증은 같은 입력에 재실행 가능하다. 제한 승격은 동일 승인·동일 요청의 idempotent 결과를 확인한 뒤에만 재시도한다. 출력 승인이 결속된 원자 snapshot capture는 그 승인을 소비한다. finalize 실패 후 단순 재호출은 막히므로 새 그룹 revision의 미승인 조판을 먼저 완료한 뒤 그 snapshot/output hash에 대한 독립 승인을 받아야 한다. publish도 1회 경로다. 합성 테스트는 소비된 승인 재사용 거부와 새 revision→미승인 조판→독립 승인→승인 소비용 snapshot의 복구 순서를 검증했다. 실제 DB 롤백은 진행 중인 테스트 트랜잭션에만 적용한다. 이미 커밋된 승격·게시를 임의 DELETE/UPDATE로 되돌리지 않는다.

운영 판정: `TEXTBOOK_FACTORY_PIPELINE_COMPLETE`는 합성 공정의 구현·검증 상태다. `TEXTBOOK_FACTORY_PRODUCTION_VERIFIED`는 실제 증거를 사용한 별도 운영 E2E 이후에만 참이다.

개정 영향 예행은 `inspectProductionRevisionImpact`로 이전·새 manifest의 변경 범위를 계산한 뒤 `beginSyntheticRevisionWorkflow`로 시작한다. 변경은 `needs_review → revise → republish → complete` 순서로만 진행한다. 재구축 실패는 `needs_review`로 돌아가며 같은 이벤트 ID의 다른 내용은 거부한다. 권리 철회는 `withdraw`에서 종료하고 이전 revision을 다시 발행하지 않는다. 모든 이벤트는 동일 group ID와 새 manifest hash에 결속하며 최종 출력 hash가 재구축 hash와 다르면 발행 예행도 거부한다. 이 journal은 합성·비운영 검사이며 실제 카탈로그나 게시 행을 수정하지 않는다.
