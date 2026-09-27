# DB 전수 조사 SQL 초안 (2026-09-23) — **검증 전 초안이다**

판정과 근거는 [../db-audit-2026-09-23.md](../db-audit-2026-09-23.md) 에 있다. 여기 있는 `.draft.sql` 은
그 조사가 만든 **원시 SQL 초안**이고, 아직 적용 가능한 마이그레이션이 아니다.

## 왜 마이그레이션이 아닌가

- 항목마다 사람 판단이 남아 있다(특히 `01` 의 DROP_CANDIDATE, `05` 의 revoke 범위).
- 일부는 `CONCURRENTLY` 가 필요해 **MCP·SQL Editor 로는 `25001` 로 거부된다** — 사람이 psql 로 돌려야 한다.
- 조사가 축약해 적은 곳이 있다("같은 ALTER 를 세 번 더"). **그대로 붙여 쓰면 빠진다.**

이미 검증해 마이그레이션으로 옮긴 것은 `supabase/migrations/_pending_*.sql` 5편이다
(`csat_items_public_readonly` · `english_irregular_forms_policy` · `db_efficiency_cron_autovacuum` ·
`rls_initplan` · `drop_dead_views`). 그쪽이 정본이고, 겹치는 부분은 **마이그레이션 쪽을 따른다.**

## 파일

| 파일 | 내용 | 남은 판단 |
|---|---|---|
| `01-dead-objects.draft.sql` | 죽은 뷰 6개 DROP · DROP_CANDIDATE 16개 | 후보 16개는 사람만 안다(`methodology_*` 는 4일 전에도 적재됨) |
| `02-dead-functions.draft.sql` | 프로젝트 함수 261개 중 DROP_SAFE 30개 | 2차 고아 주의 — `admin_record_db_health_checkpoint` 를 지우면 `record_db_health_checkpoint` 가 고아가 된다 |
| `03-indexes.draft.sql` | DROP 44개(36 MB) · 신설 6개 · 중복 13짝 | A-1·B-1 은 `CONCURRENTLY` → psql. 좁은 인덱스가 쓰이는 5짝은 DROP 후 EXPLAIN 재확인 |
| `04-rls.draft.sql` | initplan 감싸기 · 중복 정책 통합 16 · 맨몸 `is_admin*()` 35 | 감싸기는 `_pending_rls_initplan.sql` 이 이미 처리. 통합·`is_admin*` 는 미결 |
| `05-grants.draft.sql` | 테이블·뷰 136 관계 · 함수 166건 revoke | **회수하면 화면이 깨지는 것들이 섞여 있다** — 아래 |

## 회수하면 깨지는 것 (초안에 주석으로도 있지만 여기 못 박는다)

- `is_admin` · `is_admin_or_curator` · `is_class_member` · `is_class_teacher` — **RLS 정책 식 안에서
  호출자 권한으로 평가된다.** `library_books` · `library_articles` · `library_chapters_master` ·
  `shared_word_sets` 의 ALL 정책이 이 함수를 담고 있어 anon SELECT 도 평가한다.
  회수하면 `/library` · `/comics` 공개 카탈로그가 전멸한다.
- `shared_dictionary` · `english_irregular_forms` 의 anon SELECT — `lookup_word_meaning` ·
  `en_inflection_bases` 가 **SECURITY INVOKER** 로 직접 읽고 공개 만화 리더가 브라우저 anon 키로 부른다.
  지금은 RLS 로 "0행"인데 그랜트를 빼면 `permission denied` **하드 에러**가 된다.
  선행 조건은 두 함수를 SECURITY DEFINER 로 돌리는 것이다.
- `mv_lemma_dominant_pos` 의 `authenticated` SELECT — `select_book_chapter_vocab` 이 SECURITY INVOKER 로
  조인하므로 회수하면 도서 발행 게이트가 죽는다. anon 은 `20260904084631` 에서 **이미 회수됐다**.
- anon 유지 확정: `record_funnel_event` · `peek_class_by_code` · `textfit_resolve_levels_public` ·
  `curriculum_bands`(`/fit` 이 명시적 anon-key 클라이언트를 만든다) · PD·adapted 만화 RPC 11개 ·
  `lookup_word_meaning` · `list_book_support_vocab` · `resolve_dict_headword`.
