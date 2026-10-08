# T-0006 — 계정 분류가 아직 적용되지 않은 지표 (읽기 전용 감사 · 2026-10-09)

- 작업: T-0006 / VG-L3-D1-02 · 범위 승인 DL-0020 · 기획 REQ-20261009-001
- 방법: `feat/qa-account-separation`(기준 origin/main bc7cd0340)에서 학습자 활동을 읽는 관리자·분석 코드 grep. **코드·DB 변경 없음.**
- 결론: 이번 작업은 **리텐션 패널만** 고쳤다. 아래 지표는 여전히 내부·QA 계정을 학습자와 섞어 센다 → VG-L3-D1-02-AC1 은 **PARTIAL**.

| 지표 | 위치 | 읽는 것 | 내부 계정 섞임 | 비고 |
|---|---|---|---|---|
| 대시보드 KPI 「오늘 학습자」 | `lib/admin/dashboard-stats.ts:461` | `daily_activity` 오늘 행 수 | **예** | 계정 구분 없이 행 수 |
| 대시보드 「사용자 수」 | `lib/admin/dashboard-stats.ts:460` | `user_profiles` 행 수 | **예** | |
| 교사 채널 격차 | `lib/admin/teacher-funnel.ts` | `funnel_events` · `classes` · `class_members` | **예** | 분모가 이벤트 — 내부 계정 이벤트 포함 |
| 퍼널 집계 | `lib/analytics/funnel.ts` · `/admin/analytics`(목업 화면) | `funnel_events` | **예** | 익명 이벤트(user_id null) 출처 판별 불가는 별도 문제 |
| 영상 콘솔 | `lib/admin/video-console.ts` | `funnel_events` | **예** | |
| 학습 원리 효과(knowledge) | `lib/knowledge/protocol.ts:42` · `vnext-rules.ts:32,47` · `vnext-server.ts:104` | 시도·세션의 `synthetic` | **세션 단위로는 제외됨** — 단 계정 단위 내부 판정과는 별개 축 | 내부 계정의 비-synthetic 시도는 여전히 「실제」로 셈 |

## 다음 단위 제안 (PROPOSED DL-0017 과 같은 방향 · 실행 아님)

1. 분류 계약을 공통 서버 모듈로 올리고(지금은 리텐션 조회부만 사용) 위 지표가 같은 함수를 쓰게 한다.
2. 영속 근거: 사용자 승인 후 DB `user_type`(또는 중앙 목록)으로 옮긴다 — 마이그레이션 · 백필은 별도 승인(DL-0019).
3. 계정 단위(내부/외부)와 시도 단위(`synthetic`)를 효과 분석에서 **둘 다** 거른다.
