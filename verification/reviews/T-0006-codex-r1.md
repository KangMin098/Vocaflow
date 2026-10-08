# T-0006 — Codex 독립 리뷰 r1 (owner independent-review · 2026-10-09)

- 대상: feat/qa-account-separation bc7cd0340..cfc1833b9 · 실행: codex exec -s read-only (reasoning high)
- 판정: APPROVE(P0/P1 없음) · P2 2건 — 구현 담당이 반영하기로 함(run 2). P2-2 는 완료 조건 5 의 근거 과대 → 반영 전 COMPLETED 불가

## 원문

**판정: APPROVE — P0/P1 없음.** 지정 diff `bc7cd0340..cfc1833b9`를 검토했으며, 아래 P2 두 건이 있습니다. 이 판정은 VG-L3-D1-02 전체 PASS를 의미하지 않습니다.

1. **[P2] 역할 조회 페이지의 순서가 고정되지 않음** — [retention.ts:107](D:/workspace/Vocaflow-wf4-d102/apps/web/src/lib/admin/retention.ts:107)  
   프로필이 1,000개를 넘고 페이지마다 반환 순서가 달라지면 운영자 프로필이 누락될 수 있습니다. 그 운영자가 외부 목록에도 있으면 역할 충돌을 발견하지 못해 실사용으로 집계합니다. 1,001개 프로필의 순서를 바꾸는 모의 조회에서 이 오분류를 재현했습니다. 실제 DB 재현은 아닙니다.  
   **수정:** 역할 조회에 고유 키 `user_id` 정렬을 추가하고 페이지 누락 회귀를 검증하세요.

2. **[P2] `server-only` 경계 테스트 완료 주장의 근거 부족** — [retention-classification.test.ts:101](D:/workspace/Vocaflow-wf4-d102/apps/web/src/lib/admin/__tests__/retention-classification.test.ts:101), [실행 보고서:30](D:/workspace/Vocaflow-AI-Control/verification/reports/T-0006-claude-run-r1.md:30)  
   현재 테스트는 반환값의 식별자 비노출을 확인합니다. 하지만 Vitest가 `server-only`를 빈 모듈로 치환하므로, 경계 선언을 제거해도 이 테스트는 통과합니다. E01이 수용 기준 6의 경계 테스트까지 충족했다는 주장은 과합니다. 현재 코드의 경계 선언 자체는 정상입니다.  
   **수정:** 경계 선언 제거 또는 클라이언트 import를 탐지하는 검증을 추가하고 증거 범위를 정정하세요.

확인한 정상 사항은 다음과 같습니다.

- 명시적 목록·운영 역할·unknown 분류와 도메인 힌트 정책이 DL-0020에 부합합니다.
- 외부 목록과 운영 역할이 충돌하면 내부로 제외하고 경고합니다.
- `external_verified`만 모든 리텐션 계산의 입력으로 들어갑니다.
- 설정 오류는 `unavailable`, 조회 실패는 `null`이며 0으로 바꾸지 않습니다.
- KST 변환, 경과 분모, 중앙값의 null 의미, 20명 미만 비율 숨김을 유지합니다.
- 반환값과 패널 props에 계정 ID·이메일·registry 내용이 없습니다.
- 10개 변경 파일 모두 허용 범위 안입니다. diff에 DB 변경이나 쓰기 경로 추가가 없습니다.
- 보고서는 전체 목표를 PARTIAL로 유지합니다. 남은 퍼널·효과 지표 수정은 **out of scope (separate ticket)** 입니다.

파일은 수정하지 않았습니다. 읽기 전용 조건에서 정규 Vitest·typecheck·lint는 재실행하지 않았습니다. 제공 로그의 **56 passed / skip 0**을 확인했고, 별도로 파일을 생성하지 않는 메모리 검증에서 분류·KST·실사용 필터·실패 처리·비율 경계를 확인했습니다. 실제 DB의 과거 쓰기 여부는 독립 감사하지 않았습니다.
