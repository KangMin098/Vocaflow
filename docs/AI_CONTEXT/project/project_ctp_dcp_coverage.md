> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_ctp_dcp_coverage.md
> category: project

---

CTP DCP(수능형 순서/삽입 연습). 테이블 `csat_dcp_items`(kind=book|article, type=order|insert, ref_id, payload, answer_key, paragraph_idx, v_level). 코어 생성기 `packages/library-pipeline/src/dcp/generate-items.ts` = **결정론·LLM 0**(seed 기반 Fisher-Yates 셔플 + 문단 적격 필터: 4~6문장·앵커 양호·보일러플레이트 배제 → 저품질 자기선별).

**2 드라이버**(둘 다 service-role 직접, **dev 서버 비의존**, 멱등 upsert onConflict(kind,ref_id,type,paragraph_idx)):
- `scripts/generate-book-dcp.mts [--floor=N]` — 발행 도서 챕터(content_chunks)→문항. floor 기본 7(S4 killer band), `--floor=6`로 CSAT S3 확대. 도서당 24문단 상한. paragraph_idx = chapter_idx*1000+localIdx.
- `scripts/generate-article-dcp.mts [--apply]` — 발행 아티클→문항. dry-run 기본. seed=source_id, ref_id=id. 입력 게이트(설계 §T2): published + NOT display_only + license PD/CC(pd/cc0/cc_by/cc_by_sa) + lexical_noise≤0.08. **전 register**(라우트 `/api/ctp/dev-generate-items`는 기본 register=argumentative·limit 20이라 v5 7편에 정체했음 — 드라이버가 일반화).

**현황(2026-07-12, v06.228)**: TOTAL 1374 items / 81 refs / v3~v9. article 566(64편, v3-7), book 808(17편, v4-9). 확대 전 592.

**잔여 옵션**(미실행): v5/v2 도서(6권), narrative 아티클(문단 필터가 0 산출 — 대화체·단문), reference/travel 장르 순수화(expository/argumentative 한정 = 시험급 무모호성). DCP는 결정론·멱등·가역(DELETE by kind/ref)이라 재생성 안전.

DCP 소비: hub 처방 ④ 연습 + `/practice/dcp`([[project_p6_handoff_pending]] 관련 없음, prescribe_today가 v-level 게이트). 관련: [[project_scriptquiz_chapter_quiz_drain]](유사 콘텐츠 드레인 관행).

