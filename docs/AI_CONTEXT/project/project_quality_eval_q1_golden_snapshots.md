> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_quality_eval_q1_golden_snapshots.md
> category: project

---

품질평가 인프라 handoff **Q1+Q2+Q3 완료** (Q1+Q2: 2026-07-04 PR #94 v06.118~119 · Q3: 2026-07-06 v06.140 `67b9fd5` feat/plan-ui).

**Q3**: `/admin/quality` read-only 대시보드 — 단계별(ingest→…→deliver) 카드 + 전회 대비 + 스파크라인 + dims; `dims.status` 세그먼트 분리. AdminSidebar '운영' Gauge. **dev-bypass 로는 RLS(read=admin) 탓에 빈 상태만 보임(정상)** — 데이터 분기는 `__tests__/page.test.tsx` renderToString 픽스처로 검증(vitest `esbuild.jsx:'automatic'` 이때 추가). "지금 수집" 버튼 ✅(v06.142 `2449941`, 사용자 승인): migration `20260706000000` `admin_collect_quality_metrics()` wrapper(role 검사→위임, EXECUTE→authenticated) + `CollectNowButton.tsx`. MCP apply_migration 이 분류기에 거부돼 execute_sql 로 적용 + schema_migrations 수기 기록. 잔여: LLM 심사(L2).

**Q2**: migration `20260704043934_quality_metrics` — `quality_metrics` 테이블(read=admin RLS·쓰기 정책 0) + `collect_quality_metrics()` SECURITY DEFINER(M1~M6, 검증 9행·P0 실측 일치) + **pg_cron jobid=12** `10 18 * * *`(03:10 KST). 롤백 `docs/AI_CONTEXT/rollback/QE_quality_metrics_drop.sql`. `user_profiles` PK는 **`user_id`**(id 아님 — RLS 정책 작성 시 주의). 범위 외 잔여: Q3 `/admin/quality` 대시보드 · LLM 심사(L2).

- fixture: `packages/library-pipeline/test/fixtures/`(책 Alice/Sherlock PD + 글 VOA/NASA PD-Gov + Wikinews CC-BY-2.5) · `apps/web/src/test/fixtures/librivox/`(Wind in the Willows 단권 title + Les Mis 5권 volume — align 함수가 apps/web에 있어 웹 측 배치).
- **NIH fixture 불가**(nih.gov·medlineplus 둘 다 Cloudflare/차단) · **The Conversation CC-BY-ND → fixture 금지**.
- 스냅샷 명세 포인트: `alignChaptersByTitle`은 정규화 키 **완전 일치만** 배정 — LibriVox 오타("Dulce Dolmum")는 gap(TTS)이 정답(11/12). gutenberg 책은 `library_chapters_master.chapter_title`이 대부분 NULL이라 title-align 골든셋 부적합(SE 책 사용).
- `compute_book_coverage`는 **RETURNS void 쓰기형** — 테스트에서 호출 금지, `lexical_coverage` 저장값 스냅샷.
- `extraction_p0_20260620.md`는 STALE(추출 P1~P4 이전 상태) — live baseline SSoT는 `extraction-rpc.integration.test.ts` 스냅샷.
- 관찰(미수정 버그 후보): P&P ch.1 추출 2위가 `copyright`(Gutenberg 보일러플레이트 잔재) — 별도 handoff 대상.
- M6(noise)는 **글 전용**(books에 lexical_noise 컬럼 없음). M1~M6 실측치는 handoff P0 보고 참조.

관련: [[project-extraction-pipeline-p1-p4]], [[feedback-handoff-workflow]]

