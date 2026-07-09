> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_sw_tables_external_app.md
> category: project

---

`sw_players`(nick·pass_hash·save·updated_at) · `sw_comments`(id·nick·txt·created_at) 두 테이블은 **Vocaflow 코드베이스와 무관한 별개 앱**("snake word" 류 미니게임 추정)이 같은 Supabase 프로젝트(`jajenrevcbmrpaliomxv`)를 공유해 쓰는 것. Vocaflow apps/packages/scripts 전수 grep 참조 0. 자체 nick+pass_hash 인증(auth.users 무관).

**보안 advisor `rls_policy_always_true` 2건 = 이 테이블들** (`sw_anon_all`/`swc_anon`: anon `USING(true) FOR ALL`). anon 이 전 pass_hash read + 세이브 수정/삭제 가능(실제 노출). 단 그 앱이 anon 전권을 전제로 설계돼 있어 **RLS 잠그면 그 앱이 깨짐** → Vocaflow 세션에서 손대지 말 것(2026-07-09 활성: 플레이어 5·오늘 갱신).

**권고(사용자 결정)**: 그 앱을 별도 Supabase 프로젝트로 분리하거나 인증 재설계. Vocaflow 보안 advisor 관점에선 "외부 앱 소유, 조치 대상 아님"으로 종결.

관련: [[feedback_definer_execute_public_grant]]

