# T-0083 rev1 독립 REWORK

HEAD e5ff5d165e4b719cbce8a2cb94cfc07180cdcb20 · 판정 REWORK.

P1 T0083-P1-1 — 학습 전용 카드가 기존 평가 납품을 실행 링크로 노출합니다.

- 최초 반례: 본인 s.attachment 목록 GET 응답에 현재 유효한 model_explanation/guided_practice와 independent_check at-ind-1 한 행을 함께 제공합니다. 유효한 API 목록 계약이며, 다른 사용자 자료나 잘못된 응답 모양을 주입한 반례가 아닙니다.
- 실제: AuthoredSupplyCard kind=instructional이 rows를 필터하지 않고 모든 행을 순회하여 at-ind-1의 「혼자 확인」 링크를 만듭니다. 같은 카드에는 받은 풀이가 연습 기록만 남는다고 표시돼 있어 역할 경계·안내가 어긋납니다. 실제 React/Chromium 1440/1280 두 경우 모두 링크3개(교수2+평가1), 실패2/2. 자동POST·넘침·브라우저 오류 문제는 없습니다.
- 기대: 이 학습 전용 진입은 model_explanation/guided_practice만 실행 가능하게 보여야 합니다. independent_check/transfer/delayed_check 또는 미지 역할은 이 카드의 학습 링크가 되지 않아야 합니다. 원장 행을 지우거나 전역 학습 권한을 바꾸는 요구가 아닙니다.
- 원인/최소 수정: kind는 제목/testid/문구만 바꾸며 목록 projection에는 쓰이지 않습니다. 해당 kind에서 교수 역할만 남기는 최소 projection을 사용하세요(가능하면 기존 닫힌 역할 표 재사용). 목록·노트에 넘기는 범위도 일관되게 하되 기존 core/support 카드의 모든 정상 역할과 철회/미확인 처리는 유지하세요. SQL/server 수요/채점/G2/정본 변경은 불필요합니다.
- 재검증: 교수+세 평가 역할이 섞인 목록, 평가만 있는 목록, 미지 역할, 교수만 정상 대조; 실제 두 PC 너비에서 평가 링크0/교수2와 기존 core/support 평가 링크 정상. 기존 서버·PGlite 통과 증거는 재사용하고 변경 관련 단위/lint/타입만 실행합니다. 새 PR/CI/워크트리/승인 불필요.

독립 관련 시험55/55(skip0): instructional-supplement3 + supply route6 + authored-flow PGlite46. 실제 개발 DB 쓰기0. 인증 Next+DB 및 전역3B 브라우저는 NOT_VERIFIED. 제출된10/10은 교수만 있는 목록 등 정상 범위 증거로 재사용하며 위 혼합 역할 반례를 덮지는 않습니다.

최신 main18129b11b와의 merge-tree는 WorkspaceModal 한 곳 충돌입니다. 이는 구현자에게 main 강제병합을 요구하는 새 결함이 아니며 수용 시 Codex가 기존 FactoryDcpCard/교수 경로와 신규 카드를 모두 보존해 해결·검증합니다.

P2 (비차단): 미실행 attachment-instructional 인증 시험은 응답 status를 단언하지 않고 공급0도 통과할 수 있습니다. 현시점 성공 증거로 제출하지 않았으므로 코드 수용을 차단하지 않습니다. 정식 통합 묶음에서 실행할 때 승인된 합성 교수 fixture를 넣고 status/실제 공급/교수 수행·노트·복귀를 확인하기 전에는 역할 차단/빈 재고 대조로만 분류하세요.
