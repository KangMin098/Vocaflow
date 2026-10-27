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

## 요약 (2026-10-28)

MATCH 167 · DB_ONLY_SHIFTED 314 · MAIN_ONLY_SHIFTED 299 · NAME_DIFF 1 · DB_ONLY 259 · MAIN_ONLY 37 · main 에서 한 버전에 파일 2개 이상 22

- DB_ONLY 259 중 235 는 어느 git ref 에도 그 버전 파일이 없다(대부분 2026-05~08 대시보드/MCP 직접 적용). 24 는 기능 브랜치에만 있다: `feat/csat-corpus-expansion`·`feat/csat-source-policy-v3`(0918~0919 5건), `feat/ec-*`·`feat/ec-smoke`(1005~1007 6건), `feat/textbook-factory-main`(1007~1011 11건), `fix/csat-p6-migrations`(1023~1024 2건).
- 버전 충돌(NAME_DIFF): `20260811111430` — DB `lemma_dominant_pos_materialized` / main `lemma_dominant_pos_fallback`.
- main 의 같은 버전 다중 파일 22건(예 `20260924150000` 3개) — DB 버전 하나로 대응할 수 없다.
- 버전이 이름에 섞인 DB 행: `20261009095727|20261009120000_reading_specialized_production_gate`, `20260814120132|20260814090000_module_id_echo` 등 — 이름 대조가 실패해 DB_ONLY/MAIN_ONLY 로 잡힌다.
- MAIN_ONLY 37 은 미적용 후보다. 다만 8자리 날짜 버전 파일(`20260521_140000_…` 등)은 스크립트가 버전을 `20260521` 로 읽어 MAIN_ONLY 로 분류된다 — 실제로는 대부분 SHIFTED 와 같은 이름이다(미검증).

## 미검증

- MAIN_ONLY 37 의 객체가 실제 DB 에 있는지(to_regclass·pg_proc)는 보지 않았다 — 이름 대조만 했다.
- SHIFTED 쌍의 SQL 본문이 DB 적용본과 같은지(statements 비교)는 보지 않았다.
