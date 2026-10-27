# T-0002 마이그레이션 대조 (dev DB ↔ 로컬 main)

- 기준: dev DB `jajenrevcbmrpaliomxv` `supabase_migrations.schema_migrations` (2026-10-28 MCP SELECT, 741행) ↔ 브랜치 `docs/t0002-migration-diff`(로컬 main `2de055ceb`) `supabase/migrations/` 558개 파일.
- 생성: `node build-table.mjs <dump>` → [TABLE.md](./TABLE.md). dump 는 `select string_agg(version||'|'||coalesce(name,''), ',' order by version) from supabase_migrations.schema_migrations` 결과.
- 이전 판: `git log --all -- docs/platform-audit/step3/migration-diff` 결과 없음 — 첫 판이다.

## 상태 정의

| 상태 | 뜻 |
|---|---|
| MATCH | 같은 버전·같은 이름이 DB 와 main 에 있다 |
| NAME_DIFF | 같은 버전, 다른 이름(버전 충돌) |
| DB_ONLY_SHIFTED | DB 에만 있는 버전이지만 같은 이름의 파일이 main 에 다른 버전으로 있다(MCP apply 가 적용 시각으로 버전을 다시 찍은 경우) |
| MAIN_ONLY_SHIFTED | 위의 반대편 — main 파일 버전은 DB 에 없지만 이름은 DB 에 있다 |
| DB_ONLY | DB 에 적용됐고 main 에 같은 버전·이름의 파일이 없다. 마지막 열에 그 버전 파일을 가진 git ref |
| MAIN_ONLY | main 파일인데 DB 에 버전도 이름도 없다(미적용 후보) |

## 요약 (2026-10-28, 파서 수정 후)

파일명 형식: 14자리 `YYYYMMDDHHMMSS_name.sql` · 8+6자리 `YYYYMMDD_HHMMSS_name.sql`(22개, 버전은 두 숫자를 이어 붙인 값) · `_pending_*.sql`(23개, 버전 없음 → 대조 제외, TABLE.md 머리에 목록). 대조 대상 535파일 / 515버전.

MATCH 167 · DB_ONLY_SHIFTED 333 · MAIN_ONLY_SHIFTED 318 · NAME_DIFF 1 · DB_ONLY 240 · MAIN_ONLY 29 · main 에서 한 버전에 파일 2개 이상 17

- DB_ONLY 240 중 216 은 어느 git ref 에도 그 버전 파일이 없다. 24 는 기능 브랜치에만 있다: `feat/csat-corpus-expansion`·`feat/csat-source-policy-v3`(0918~0919 5건), `feat/ec-*`·`feat/ec-smoke`(1005~1007 6건), `feat/textbook-factory-main`(1007~1011 11건), `fix/csat-p6-migrations`(1023~1024 2건).
- 버전 충돌(NAME_DIFF): `20260811111430` — DB `lemma_dominant_pos_materialized` / main `lemma_dominant_pos_fallback`.
- 버전이 이름에 섞인 DB 행(예 `20260814120132|20260814090000_module_id_echo`, `20261009095727|20261009120000_reading_specialized_production_gate`) 때문에 main `20260814090000_module_id_echo` · `20260815060000_dictation_session_items` · `20260816030000_dictation_attempt_unique` 는 MAIN_ONLY 로 남지만 실제로는 다른 버전으로 적용된 것이다.

### MAIN_ONLY 29 객체 확인 (to_regclass · pg_proc, 결과 [object-check.json](./object-check.json))

- object present (likely applied under other version/name): 19
- partial: 1 — `20260520120000_lexicon_phase1_expand`: `lexicon_frequencies` 있음, `reject_word_lexicon_insert` 없음(DB 의 `retire_word_lexicon_rpcs` 로 폐기된 것으로 보임)
- object absent: 0
- CREATE TABLE/FUNCTION/VIEW 가 없어 미확인: 9 (ALTER·DATA·enum 추가 등)

## 미검증

- 미확인 9건(ALTER/데이터/enum)의 효과가 DB 에 있는지는 보지 않았다.
- 객체 존재는 이름만 본다 — 함수 시그니처·본문이 main 파일과 같은지는 비교하지 않았다.
- SHIFTED 쌍의 SQL 본문이 DB 적용본과 같은지(statements 비교)는 보지 않았다.
