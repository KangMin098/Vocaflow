<!-- docs/implementation/learning-outcomes-20261021/04-EXISTING-DCP-REUSE-SPEC.md -->
# 기존 DCP를 보존하는 명시적 재사용 입고

2026-10-21 실제 개발 DB SELECT에서 원문003946dd의 title/0과 topic/0 자리가 이미 있고 main_point/0은 비어 있음을 확인했다. 현재 1C는 기존 자리를 보존하며 거절하므로 새 3문항을 그대로 입고할 수 없다. 삭제·덮어쓰기·가짜 문단번호·중복 원문 없이, 검토한 기존 2문항을 정확한 현재 행으로 재사용하고 새 요지 1개만 추가하는 경로가 필요하다.

## 계약

- 원래 신규 입고 경로는 같은 자리를 계속 거절한다. 재사용은 관리자 별도 preview_reuse/admit_reuse 동작이다. 클라이언트는 item_id→existing DCP UUID만 지정하며 실제 payload/answer_key를 보내 권한을 주장하지 않는다. 서버가 현재 행을 읽는다.
- 기존 행은 practice·같은 source/type/paragraph_idx이고, 산출물의 발문·선지 순서·정답이 실제 행과 같아야 한다. 기존 passage는 현재 원문의 공백 정규화된 정확한 전체 또는 연속 발췌여야 한다(legacy title은 첫6문장). 원문 전체와 문항 발췌를 같은 것으로 표시하지 않는다.
- 새 AI 검수는 정확한 기존 행 UUID와 JS canonical row SHA도 결속한다. 기존 출력·원천·패킷·주문·문항 SHA 결속도 유지한다. 원본 payload/answer_key·기존 해설을 검토자에게 제공한다. 옛 검수만으로 재사용을 승인하지 않는다. 원저작 관측은 새 권리 부여가 아니며 미상 축은 미상이다.
- pending 1C SQL은 명시적 existing id가 있을 때만 그 현재 행을 잠그고 자연키·practice·payload/answer_key의 JSONB 동등성을 재검증해 **기존 id에 입고 영수증만 추가**한다. 해당 csat_dcp_items 행은 수정하지 않는다. 새 요지는 원래 INSERT 경로다. 이전 입고/다른 본문/다른 사용자/낡은 원천·제품주문은 거절한다. 후보/영수증의 원자성과 재시도 안전을 유지한다.
- 자격·승인·D3·수령·실제 채점·연습 영수증·교수 진행은 기존 경로다. 독립 G2/사람 검토를 만들지 않는다. 기존 학습 기록도 보존한다.
- CLI/API로 실제 패킷·출력/검수 대상 요청을 내보내고 새 검수 JSON으로 preview할 수 있어야 한다. 리뷰용 패킷은 합성 계보 후보임을 명시하며 live 등록 가능으로 위장하지 않는다.

## 수용

정본 SQL 격리 DB에 실제 관측과 같은 topic/title 행을 먼저 둔다. 기존 신규 입고는 충돌 거절, 재사용 검수와 현재 행 결속 뒤 같은 id 2 + 신규 요지1로 공급/실제 채점까지 확인한다. 기존 두 행의 payload/answer_key SHA·id·기존 시도 행수 불변, 새 DCP행 증가1, 재전송 증가0. 사전 확인 뒤 payload/Gold 변경·다른 source/type/assessment·잘못된 UUID·발췌/원천 변경·새 검수 없음·임의 검수 hash·비관리자 반례를 시험한다. 실제 HTTP 경계·현재 읽기 adapter 오류도 구분한다.

이 기능은 공유 DB에 적용하지 않는다. 최종 승인 패키지에 새 SQL SHA·현재 점유 자리·보존 영향·복구를 반영한다. FAST는 별도 작업 공간에서 진행 중이며 코드 소유권을 나눈다. 실제 DB 쓰기·삭제·계정·push·main merge·발행 없음.
