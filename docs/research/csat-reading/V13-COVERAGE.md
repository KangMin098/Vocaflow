# v1.3 v6.2 Goal Coverage 연구 근거

2026-10-14. [6 Ledger/4 TASK×8공백 원장](./data/v13/coverage.json). 연구 검증 수준과 제품 실행 가능성, 학생 수행을 서로 다른 차원으로 기록한다. 분모를 합쳐 전체 지원율을 만들지 않는다.

| Ledger | 이번 근거 | 상태·제한 |
|---|---|---|
| ExamInventory | DB기간적격774/운영KICE읽기802 ID 범위 재확인 | unknown. 전체 시험·회차·형별45문항/배점 inventory 전수 대조 아님 |
| Reasoning | 선정12 source대조, 노출제외1 후 새11 분류·반증 | partial. 완전 입력과 충분성의 논리 검증은 별도 |
| TaskLink | 고유74: 직접30/간접39/실검토무관5, 미검토23506 | partial. 23580은 감사 프레임, 모든 조합이 필수 링크라는 뜻 아님 |
| Instruction | 기존30참조, 우선4패키지/40방법설계/24자료역할 | partial. 자료 공개·권리·효과·실제 실행 검증 아님 |
| Assessment | 우선4 루브릭·응답·노출 계약 | partial. 직접 과제/채점 자격 실증 검증0 |
| GoalSupport | 실제 개인 TargetSpec/전체시험/적격재고/학생반응 없음 | unknown, denominator=null. 목표 달성·총필요량 계산 불가 |

CONCEPT/METHOD/CONTENT/ASSESSMENT는 제한된 연구 설계가 있어 partial이다. LEVEL 해석·실제 TRANSFER·VERIFICATION(지연/반복)은 연구 범위에서 unsupported이다. EXECUTION은 연구에서 런타임 검사를 하지 않아 unknown이며 제품 미구현 판정이 아니다. 기존 R5 합성E2E나 static live와 연구적 미검증을 한 상태로 합치지 않는다.

독립 확인·전이·지연은 자료 역할 및 후보 계약이 존재하지만 학생별 적격 풀과 실제 독립 반응을 검증하지 않았다. 기출11분류 또는 cross-type5비교를 학생의 전이 성공으로 계산하지 않는다. `U/S1~S4`는 관찰조건 설계 후보이며 학생의 확정 레벨로 자동 배정하지 않는다.

자동 후보6310는 검수 대기 프레임이다. 실제 검토74와 합산하지 않고, missing/unknown을 학생 결손 또는 not_applicable로 전환하지 않는다. 정적 교육 자료 수량은 개인 학습 필요량이 아니며 실행수/정답수/문항내후보수는 서로 다른 분모다.

재현: `node scripts/research/csat-reading/v13-handoff.mjs`. 파일/명세 개수 재계산은 논리·도구 타당성·실제학생효과의 인증이 아니다.
