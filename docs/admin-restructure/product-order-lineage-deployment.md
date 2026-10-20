# Product Order 계보 — 개발 DB 적용 기록

2026-10-20 · D3 적용 완료 · T-0058은 사후 읽기 검증과 저장소 이력 정리 작업이다.

## 승인과 실제 실행

직전 ‘공유 DB 적용은 별도 승인 대기’ 안내에 사용자가 ‘승인’이라고 응답했다. [전체 적용 SQL](../../scripts/db/factory-i1/d3-package/apply.sql)의 정확한 바이트를 기존 `scripts/db/apply-approved-sql.mjs`로 실행했다. DB1/2 러너의 stage를 재사용하거나 승인 티켓을 발급하지 않았다. 실행 전 프로젝트·명시적 5432 포트·TLS 인증서/호스트 검증·196개 선행 객체 지문을 확인했다. 원격 GitHub/CI 호출은 없다.

| 항목 | 실제 확인 |
|---|---|
| 대상 | 개발 프로젝트 `jajenrevcbmrpaliomxv` |
| 이력 | `20261020063000_factory_product_order_lineage_v1` |
| 전체 apply SHA-256 | `0883d34411911e9bd703bd90d09560ece9214528bed4e8a8f371766f0efe9a3e` |
| 이력 정본/source SHA-256 | `f94bf27f7c00ff5054a7bc2efdf61a55d83aefd98c2502e895c8332001aae3d8` |
| 체크포인트 | `factory-lineage-d3-20261020-approved` before/after 모두 존재 |
| 적용 시각 | 2026-10-20 11:05 KST |
| 실제 카탈로그 diff | 추가 73 · 기존 변경 0 · 삭제 0 |
| 사후 verify | 이력 1 + 표/RLS/쓰기 금지 4 + RPC 권한/설정 4 = 9/9 |

[저장소 버전 파일](../../supabase/migrations/20261020063000_factory_product_order_lineage_v1.sql)은 실제 이력에 기록된 source와 바이트가 같다. apply 파일은 전후 가드와 이력 기록까지 포함하므로 source와 해시가 다르다. 이 버전을 재적용하지 않는다. 새 표 4개는 모두 0행이며 등록·연결·철회 테스트 데이터를 공유 DB에 만들지 않았다. 기존 수요·줄·주문·납품·납품 시도 5표의 행 수는 전후 모두 0이다. 전체 데이터 불변을 행 수만으로 증명했다고 주장하지 않는다.

## 권한과 실제 API 도달

주요 등록/연결/철회/조회 RPC는 `service_role`만 실행할 수 있다. 일반 관리자 JWT도 직접 호출할 수 없고 서버 인증 게이트를 거쳐야 한다. 새 표의 직접 쓰기 권한은 `service_role`에도 없다. 모든 새 함수의 익명 실행은 금지됐다. 실제 PostgREST에서 익명 호출과 허용되지 않은 actor를 넣은 서비스 조회가 모두 `42501`로 거절돼, RPC 미설치(`PGRST202`)와 구분됨을 확인했다. 쓰기는 수행하지 않았다.

실제 계획이 저장된 Workspace는 0개다. 따라서 실제 계보가 채워진 관리자 화면, 정상 주문 등록·개인 연결·실제 납품은 이번 적용의 검증 결과에 포함하지 않는다. 기존 격리 PostgreSQL 23검사와 PC fixture 화면 검증은 [계약 문서](product-order-lineage.md)의 범위 그대로다.

## 체크포인트와 advisor 변화

체크포인트의 표본 bloat 항목은 `content_chunks`에서 사라지고 `csat_item_units`에 나타났다. 서로 다른 표의 회전 표본이며 축 수집 실패로 판정하지 않았다. DB 크기는 6342.7→6343.0 MB, 연결 사용률은 21.7→23.3%, authenticated 실행 가능 SECURITY DEFINER 함수는 144→145다. 마지막 변화는 아래 RLS용 boolean helper 한 개와 일치한다.

| 신규 advisor | 수 | 분석·남은 조치 |
|---|---:|---|
| `pg_graphql_authenticated_table_exposed` WARN | 4 | admin/curator의 RLS 조회를 위해 authenticated SELECT를 준 새 표 4개의 스키마 발견 가능성이다. RLS가 사라지거나 익명 SELECT가 허용된 것은 아니다. 메타데이터까지 숨기는 별도 권한/스키마 변경은 이번 승인 SQL에 추가하지 않았다. [설명](https://supabase.com/docs/guides/database/database-linter?lint=0027_pg_graphql_authenticated_table_exposed) |
| `authenticated_security_definer_function_executable` WARN | 1 | `factory_lineage_actor(uuid,boolean)`는 RLS가 사용하는 역할·상태 boolean 판정이다. 행/주문 원문을 반환하지 않는다. 나머지 새 함수의 authenticated 실행은 금지됨을 실제 ACL로 확인했다. [설명](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) |
| `auth_rls_initplan` WARN | 4 | RLS의 행별 `auth.uid()` 평가 최적화 항목. 실제 표는 비어 있다. 성능 개선용 정책 변경은 후속 SQL 승인 범위다. [설명](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan) |
| `unindexed_foreign_keys` INFO | 6 | 행위자 FK 4개와 공용 주문 복합 FK 2개의 covering index 부족. 조회/삭제 계획과 데이터 크기를 측정한 뒤 후속 인덱스 SQL을 결정한다. 이번 승인에 인덱스를 몰래 추가하지 않았다. [설명](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) |

보안 advisor는 567→572(+5 WARN), 성능은 400→410(+4 WARN/+6 INFO)다. 신규 보안 ERROR는 0이다. 경고가 없다고 보고하지 않는다. 새 정책·인덱스 또는 메타데이터 노출 변경은 원래 apply/source를 수정해 소급하지 않고 별도 SQL로 검토한다.

## 복구와 증거

문제가 생기면 [stop-writes.sql](../../scripts/db/factory-i1/d3-package/stop-writes.sql)로 주요 쓰기 RPC만 멈추고 기존 행과 읽기를 보존한다. 이번에는 복구 SQL을 실행하지 않았다. DROP/DELETE/TRUNCATE 복구는 없다.

로컬 원증거는 `.agent-logs/d3-approved-preflight.json`, `d3-approved-postflight.json`, `d3-approved-postgrest.json`, `d3-approved-advisors.json`에 보존한다. 전후 지문·실제 이력·체크포인트·ACL과 권한 거부 응답을 포함한다. `pnpm docs:db-stats`도 실제 실행해 AGENTS 통계 블록을 자동 갱신했다. 이전 T-0057의 공유 DB 미적용 증거는 당시의 기록으로 보존하며 덮어쓰지 않는다.
