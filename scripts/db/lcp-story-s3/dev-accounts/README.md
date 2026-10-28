# LCP Story 개발 인증 계정 적용 기록

2026-10-26 사용자가 개발 Auth 계정 4개와 `forward.sql`의 정확한 적용을 승인했다. 이는 자동 마이그레이션이 아닌 일회성 운영 기록이다. 기존 S3/S5 마이그레이션과 발행·권리 게이트를 변경하지 않는다.

- Auth Admin API로 새 계정만 생성한 뒤, 정상 비밀번호 로그인을 사용한다. 보호된 `app_metadata.vfc_dev_run=lcp-story-dev-e2e-20261026-01`과 `vfc_actor=ai_development`로 구분한다.
- `producer`: curator · `reviewer`: admin · `learner_a`/`learner_b`: user, 모두 active. 새 admin은 기존 플랫폼 전체 관리자 권한을 가지며, 기존 관리자·계정·비밀번호는 변경하지 않았다.
- 비밀값은 AI-Control의 Git 제외 `.env.lcp-story-dev-e2e.local`에만 보관한다. 계정은 AI 개발 검증용이며 사람 검수·실사용 학습자로 표시하지 않는다.
- 전후 검사에서 원래 86개 Auth/프로필 행 지문이 일치했다. 적용 직후 총계는 90/90이었고, 이후 다른 cohort 계정 1개가 추가된 91/91 관찰을 별도로 기록했다.
- 정상 Auth·새 SSR 쿠키 `getUser()`·역할·스태프 RPC 권한·A 로그아웃 후 B 로그인 검사 23/23 통과. 이 검사는 로그인 UI나 발행본 진도 격리 검증을 대신하지 않는다.

| 파일 | SHA-256 | 실행 상태 |
|---|---|---|
| `forward.sql` | `0fe31cfd2ee1643be5cab0dcc666fab8c2d196ffb4d968560cd0f1643b18a0f4` | 승인된 2,308바이트 원문을 dev MCP `execute_sql`로 적용 |
| `recovery.sql` | `eb41f03ed6aed1f435a90f15be655aa12e1e8c136eedc01d026bb6f49076bc34` | 미실행·별도 승인 필요. 신규 cohort만 일반 사용자로 강등·정지하며 계정·이력은 보존 |

원문 SQL의 제안 시점 주석은 승인 바이트를 보존하기 위해 그대로 둔다. 현재 상태는 이 기록을 따른다. `auth.users` 생성·비밀번호는 SQL에 포함하지 않는다. 보호된 cohort가 없는 환경에서 forward를 실행하면 거부된다. 계정 구성은 권리 `confirmed`·콘텐츠 발행·사람 검수를 승인하거나 만들지 않는다.

로컬 검증 원본: `D:/workspace/Vocaflow-AI-Control/runtime/lcp-story-20261025/`의 `s5-dev-account-user-approval.json`, `s5-dev-account-{before,after}-raw.json`, `s5-dev-account-sql-applied-raw.json`, `dev-account-auth-verification.json`. 정확한 SQL의 격리 PostgreSQL 검사 8/8, 인증 목적지 검사 9/9를 거쳤다. 실제 후속 상태는 [파일럿 기록](../../../../docs/lcp-story/S7_PILOT.md)을 따른다.
