# Reading controlled promotion Phase 2: 개발 DB 검증 기록

2026-10-08 개발 DB에서 제한 승격 migration과 보강 migration을 적용했다. 저장소 파일명의 버전은 `supabase_migrations.schema_migrations`에 기록된 실제 적용 버전과 일치시켰다. DB migration을 재적용하지 않고 파일명만 정렬했다.

| 적용 내용 | DB 적용 버전 / 저장소 migration |
|---|---|
| 제한 승격 | `20261007205705_reading_controlled_promotion.sql` |
| 5개 테이블 RLS 활성화 | `20261007211638_reading_promotion_tables_rls.sql` |
| 명시적 restrictive deny 정책 | `20261007213310_reading_promotion_explicit_deny_policies.sql` |

마지막 정책 적용 전후 DB checkpoint는 `reading-promotion-deny-policy-20261008`이다. 직접 조회 결과 `reading_promotion_audit`, `reading_promotion_permit`, `reading_promotion_authority`, `reading_product_order_revision`, `reading_promotion_approval` 모두 RLS가 켜져 있고, 각각 `TO PUBLIC FOR ALL AS RESTRICTIVE USING (false) WITH CHECK (false)` 정책 하나를 가진다. `anon`과 `authenticated`에 이 테이블들의 직접 읽기·쓰기 권한이 없고, `service_role`은 permit 외 4개 테이블의 SELECT ACL만 갖는다. `service_role`은 BYPASSRLS이므로 이 제한은 RLS가 아니라 ACL로 유지한다.

DB health checkpoint에서 `rls_missing_tables`는 65→60, `anon_exposed_without_rls`는 0→0, `exposed_secdef_funcs`는 131→131이었다. Security Advisor에서 이 다섯 테이블의 `rls_enabled_no_policy` INFO는 사라졌다. 관리자 `SECURITY DEFINER` RPC 3개의 기존 WARN은 남아 있다. 세 RPC는 고정 search path 및 현재 사용자·활성 관리자 검사를 사용한다. 실제 비관리자 신원으로 각 함수를 호출한 롤백형 시험은 모두 `insufficient_privilege`로 거부됐다. 이 시험은 권한 게이트 확인이며 모든 보안 경로를 증명하지는 않는다.

`scripts/textbook/reading-promotion/db-smoke.sql`을 정책 적용 후 다시 롤백형으로 실행했다. 승인된 합성 승격·감사·동일 요청 재시도는 통과했고 일반 승격, stale/mixed evidence, 만료·철회는 차단됐다. 시험 후 synthetic article·audit·permit·approval·authority·order 행은 모두 0건이다. 실제 `reading:` 승격, Gold-S, DB seed도 0건이다.

운영 rollback은 먼저 승격을 중지한다. 정책만 되돌리면 5개 정책을 한 트랜잭션에서 제거하되 RLS는 유지한다. RLS 활성화까지 되돌리는 것은 별도 승인 후 같은 트랜잭션에서 정책 제거와 5개 테이블의 RLS 비활성화를 수행하고, ACL·RPC 접근과 DB 스모크를 재검증한다. 제한 승격 전체 rollback은 [통합 계약](../TEXTBOOK_FACTORY_INTEGRATION.md)의 이전 차단 트리거 복원 및 데이터별 감사 절차를 따른다.
