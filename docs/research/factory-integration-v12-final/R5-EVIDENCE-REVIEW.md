# R5 원시 브라우저 증거 검토

**기록된 기존 R5 경로 보존 범위에서 PASS.** 이번 검토는 제출 증거의 읽기·대조이며 새로운 브라우저/계정/DB 실행이 아닙니다.

원본: docs/csat-learner/v62/evidence/r5-e2e-20261015/results.json 및7 PNG. 기록 HEAD be97543e9058c1660bcae17739daeaccdee2b968, Chromium viewport1440×1000,6 PASS/0 FAIL/0 SKIP. 실행 스크립트와 제품 코드는 현재 검토 main과 같은 blob입니다. HEAD 자기 기록·tracked 변경0·동일 코드·명세/결과 일치를 확인했습니다. 서버 프로세스의 별도 서명/attestation을 확인한 것은 아닙니다.

| 기록 | 명세와 실제 detail | 판단 |
|---|---|---|
| ① R5 공급 | independent_check available, next2022-20.01/02 화면 링크와 일치 | PASS |
| ①b 주문 위장 방지 | ledger no_workspace, steps learn_now만 있음 | PASS |
| ② 동일 수요 | 새로 연 동일 계정의 demand 키가 같음 | PASS |
| ③ 응답 후 재공급 방지 | task 응답 HTTP200 후 next2025-20,03의 같은 R5 Inspector와 일치 | PASS |
| ④ 부족/보류 유지 | V2/S5 detail 모두 unsupported, L1 rows0.04/05 내용 준비 안내,06 보류 | PASS |
| ⑤ 다른 계정 | 두번째 계정은2022-20 선택,07 링크와 일치 | PASS(이 두 계정의 선택 행동) |

7장은 Inspector element crop입니다. PNG의 폭이360px 부근인 것은1440×1000 viewport 전체 캡처가 아니라 요소 캡처이기 때문입니다. URL이 이미지 자체에 있는 것은 아니며 view()의 route/data-task selector와 파일명·내용을 대조했습니다. 아래 공급 표 전체가 crop에 보이지 않는 화면도 있어 rows/ledger의 판정은 results detail과 명세를 함께 사용했습니다.

S5의 자동 predicate는 rows 존재까지만 요구합니다. 하지만 실제 기록에는unsupported가 남았고 이번 읽기 검사는 그 값을 별도로 확인했습니다. 재공급 predicate는 다른 slug만 비교하지만 실제 next가2025-20으로 존재하는 것도 확인했습니다. 이를 향후 모든 잘못된 S5 상태/빈next를 탐지하는 완전한 시험이라고 표현하지 않습니다.

동일 TASK는 view()로 해당 Inspector를 다시 열었습니다. 실제 복귀 버튼 클릭과 저장 PLAN 버전 복귀를 시험한 것은 아닙니다. 저장 PLAN 복귀는NOT_TESTED로 남습니다. 이번 승인 범위는 연계 계약 설계·기존 경로 보존이며 실제 B/C 원장/저장 PLAN을 이용한 납품 회귀를 요구하지 않았으므로 종료를 차단하지 않습니다. 순수 returnTo 결속은 별도 실행 검사로 확인했습니다.

정리 record는 created2/remaining0입니다. 삭제/조회 API의 오류를 엄격하게 보존하는 감사 로그가 아니며 현재 DB를 다시 확인하지 않았습니다. 기록된 정리0을 확인했다고 쓰되 독립적인 포렌식 삭제 보증으로 승격하지 않습니다. 다른 사용자 격리는 위 두 계정의 다음 문항 선택 범위이며 모든 RLS/API 접근의 전수 보안 증거는 아닙니다.

[기계 원장](data/r5-evidence-review.json)은7개 파일 해시·크기·시각적 관찰·명세 대조·미검증 범위를 보존합니다. 실제 학생 효과나 신규 교재 적격성을 이 브라우저 결과에서 도출하지 않습니다.
