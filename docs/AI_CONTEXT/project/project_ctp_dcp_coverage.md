> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_ctp_dcp_coverage.md
> category: project

---

CTP DCP(수능형 순서/삽입 연습). 테이블 `csat_dcp_items`(kind=book|article, type=order|insert, ref_id, payload, answer_key, paragraph_idx, v_level). 코어 생성기 `packages/library-pipeline/src/dcp/generate-items.ts` = **결정론·LLM 0**(seed 기반 Fisher-Yates 셔플 + 문단 적격 필터: 4~6문장·앵커 양호·보일러플레이트 배제 → 저품질 자기선별).

**2 드라이버**(둘 다 service-role 직접, **dev 서버 비의존**, 멱등 upsert onConflict(kind,ref_id,type,paragraph_idx)):
- `scripts/generate-book-dcp.mts [--floor=N]` — 발행 도서 챕터(content_chunks)→문항. floor 기본 7(S4 killer band), `--floor=6`로 CSAT S3 확대. 도서당 24문단 상한. paragraph_idx = chapter_idx*1000+localIdx.
- `scripts/generate-article-dcp.mts [--apply]` — 발행 아티클→문항. dry-run 기본. seed=source_id, ref_id=id. 입력 게이트(설계 §T2): published + NOT display_only + license PD/CC(pd/cc0/cc_by/cc_by_sa) + lexical_noise≤0.08. **전 register**(라우트 `/api/ctp/dev-generate-items`는 기본 register=argumentative·limit 20이라 v5 7편에 정체했음 — 드라이버가 일반화).

**현황(2026-07-12, v06.228)**: TOTAL 1374 items / 81 refs / v3~v9. article 566(64편, v3-7), book 808(17편, v4-9). 확대 전 592.

**소비 경로 = prescribe_today RPC 단일 출처**(`/practice/dcp`·hub 처방 ④ 모두 `fetchDcpPracticeItems`→prescribe_today). practice 블록은 **v_num≥3(S3+)에서만 active**. DCP 선정은 `csat_dcp_items JOIN csat_stage_catalog c ON c.id=ref_id AND c.kind`. **카탈로그(VIEW) 밴드 매핑**: 아티클 argumentative→S3·v≥7→S4·v≤4→S1·else(v5-6)→S2; 도서 v≥7→S4·v≤4→S1·else→S2. ⚠️ **도서/비-argumentative는 S3로 못 감** — S3는 argumentative 아티클 전용.

**v06.229 도달성 수리**: prescribe_today practice 선정을 정확매칭(`stage_band=v_band`)→**누적(`substring(stage_band)::int <= LEAST(v_num,4)`) + 일자 로테이션(`md5(id||current_date)`)**으로 교체. 정확매칭이 S3(argumentative 7편)를 굶기고 v5-6·v6도서를 비활성 S2에 사장하던 것 해소. 도달 DCP: S3 학습자 64→810 items(12.7×), S4 564→1374. VIEW 매핑·input 블록 불변(잔여: v5-6이 S2 매핑이라 여전히 "at-band"는 아님 — 근본 매핑 재보정은 미실행 옵션).

**잔여 옵션**(미실행): v5/v2 도서(6권), narrative 아티클(문단 필터가 0 산출 — 대화체·단문), reference/travel 장르 순수화(expository/argumentative 한정 = 시험급 무모호성). DCP는 결정론·멱등·가역(DELETE by kind/ref)이라 재생성 안전.

DCP 소비: hub 처방 ④ 연습 + `/practice/dcp`([[project_p6_handoff_pending]] 관련 없음, prescribe_today가 v-level 게이트). 관련: [[project_scriptquiz_chapter_quiz_drain]](유사 콘텐츠 드레인 관행).

