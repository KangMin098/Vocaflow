# Claude Code 인수인계 — P-M4 UX 수용 보류

main ea3f052986fa8d56b01d781aabe74ac4197df08f · T-0036 · 2026-10-15

**최종 HOLD.** A PASS(범위 한정), B FAIL, C HOLD. 확정 P1 0/P2 2. 독립 122개가 통과해도 실제 UX 수용 완료는 아니다.

1. 1280 기본 지도 영역 이름을 온전히 읽게 한다(P2-01). 기존 colHead/colName·토큰을 재사용한다. 관계도/Inspector 폭을 함께 검토하고 선택·보류 표현을 보존한다.
2. 과거 화면의 목표 편집/기록 행동과 보기 전용 범위를 구별한다(P2-02). 현재 기준으로 돌아가 변경하게 하거나 현재 설정 영역임을 명시한다. PLAN past와 시작 링크 차단도 함께 검증한다.
3. summary/chip의 실제 클릭 영역을 측정한다(H01). 44px 미만이면 공통 버튼·토큰으로 보완한다. CSS 최소값만으로 실측 완료라고 하지 않는다.
4. 실제 브라우저에서 /csat, /csat/diagnosis?tab=map, /csat/diagnosis?tab=map&view=full을 확인한다. 1440/1280 우선, 1024/390 별도 범위. Tab/Enter/Space/focus/full/새로고침/뒤로가기/목표 저장 성공·실패/기록 제외/계정 분리를 기록한다.
5. 실제 3B 원본을 확보해 구현과 측정·캡처 대조한다. spec만으로 참조 충실도 PASS를 주지 않는다.
6. 원 E SKIP를 유지한다. 자연 수요에서 guided_practice가 생기는 지원 상태를 재현하거나 현재 화면에서 재고를 조회하지 않는 경계를 명시한다. 합성 DTO 렌더를 공장 연결 증거로 바꾸지 않는다.

보존할 회귀: 목표/근거 판정·NeedRank/ActionRank·확인→바로잡기→적용→재확인·진행/성취 구별·R5 기존 문항/복귀·미노출 다음 문항·미검수 공급 차단. 연구 사례는 사람 검수 전 표시를 유지한다. 기본 연구 목록(H02)은 P3 관찰이며 광범위한 재설계 지시가 아니다.

이번 브랜치는 검증 문서·fixture·스크립트만 포함한다. 제품 변경은 하지 않았다. 실제 공장/SQL/콘텐츠/계정 생성·DB 적용을 승인하지 않는다. main에 자동 병합하지 않는다. 수정 후 새 SHA와 동작·시각 증거를 제출하면 이번 원장과 구분한 새 revision으로 재판정한다.

근거: PM4-UX-REVIEW.md / PM4-UX-FINDINGS.md / PM4-UX-VISUAL-AUDIT.md / PM4-UX-REGRESSION.md / data/acceptance-ledger.json. 독립 새 브라우저 캡처가 없다는 제한을 보존한다.
