> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_ctp_dcp_coverage.md
> category: project

---

CTP DCP(수능형 순서/삽입 연습). 테이블 `csat_dcp_items`(kind=book|article, type=order|insert, ref_id, payload, answer_key, paragraph_idx, v_level). 코어 생성기 `packages/library-pipeline/src/dcp/generate-items.ts` = **결정론·LLM 0**(seed 기반 Fisher-Yates 셔플 + 문단 적격 필터: 4~6문장·앵커 양호·보일러플레이트 배제 → 저품질 자기선별).

**2 드라이버**(둘 다 service-role 직접, **dev 서버 비의존**, 멱등 upsert onConflict(kind,ref_id,type,paragraph_idx)):
- `scripts/generate-book-dcp.mts [--floor=N]` — 발행 도서 챕터(content_chunks)→문항. floor 기본 7(S4 killer band), `--floor=6`로 CSAT S3 확대. 도서당 24문단 상한. paragraph_idx = chapter_idx*1000+localIdx.
- `scripts/generate-article-dcp.mts [--apply]` — 발행 아티클→문항. dry-run 기본. seed=source_id, ref_id=id. 입력 게이트(설계 §T2): published + NOT display_only + license PD/CC(pd/cc0/cc_by/cc_by_sa) + lexical_noise≤0.08. **전 register**(라우트 `/api/ctp/dev-generate-items`는 기본 register=argumentative·limit 20이라 v5 7편에 정체했음 — 드라이버가 일반화).

**현황(2026-07-12, v06.228)**: TOTAL 1374 items / 81 refs / v3~v9. article 566(64편, v3-7), book 808(17편, v4-9). 확대 전 592.

**소비 경로 = prescribe_today RPC 단일 출처**(`/practice/dcp`·hub 처방 ④ 모두 `fetchDcpPracticeItems`→prescribe_today). practice 블록은 **v_num≥3(S3+)에서만 active**. DCP 선정은 `csat_dcp_items JOIN csat_stage_catalog c ON c.id=ref_id AND c.kind`. **학습자 stage** = `derive_learner_stage`(게이트 기반, coverage reqv=stage×2 → S_n≈v_level[(n-1)×2, n×2)). prescribe_today 는 `v_band='S'||LEAST(v_num,4)`.

**카탈로그(VIEW `csat_stage_catalog`) 밴드 매핑 — v06.232 재보정**: articles·books 일관 4버킷 monotonic — **v≤2→S1 · v3-4→S2 · v5-6→S3(CSAT 핵심·활성) · v7+→S4(killer band)**, NULL→S2. (구 매핑의 `argumentative→S3` 특례·S3 부재 문제 해소.) 라이브 분포: input 후보 S1:7·S2:50·S3:114·S4:12; at-band DCP S2:48·S3:762·S4:564.

**v06.229 처방 도달성 수리**: prescribe_today **practice** 선정을 정확매칭→**누적(`substring(stage_band)::int <= LEAST(v_num,4)`) + 일자 로테이션(`md5(id||current_date)`)**으로 교체. 도달 DCP: S3 학습자 810·S4 1374. **input** 블록은 여전히 정확매칭(`stage_band=v_band`)+`v_level ASC`(at-band 읽기·i+1) — v06.232 재보정으로 각 밴드 populated이라 문제 없음. 현 사용자 3명 전원 S1(pre-launch) → practice 미노출, DCP는 provisioning 상태.

**잔여 옵션**(미실행): v5/v2 도서(6권), narrative 아티클(문단 필터가 0 산출 — 대화체·단문), reference/travel 장르 순수화(expository/argumentative 한정 = 시험급 무모호성). DCP는 결정론·멱등·가역(DELETE by kind/ref)이라 재생성 안전.

DCP 소비: hub 처방 ④ 연습 + `/practice/dcp`(prescribe_today가 stage 게이트). 관련: [[project_scriptquiz_chapter_quiz_drain]](유사 콘텐츠 드레인 관행).

**학습자 stage 게이트(derive_learner_stage) 실측**: 다차원 — coverage(v_level≥stage×2) + wpm(reading_fluency_log: S1≥100·S2≥130) + item_accuracy(csat_item_attempts: S3≥0.70·S4≥0.65) + listening(echo_match_attempts: S5≥0.80). **v_level만 높아도(예 v11) 활동 데이터 없으면 S1 고착** — csat_stage_gates 임계. practice(DCP)는 S3+.

**E2E 실증(2026-07-13, v06.232 후)**: 전원 S1이라 DCP 미구동이던 것을, runtime-test에 `reading_fluency_log` 3건(wpm~160·comprehension_ok·kind='article'·ref_id FK없음) 시드 → **S3 안착**(wpm 게이트 통과, item_accuracy NULL로 S3 미졸업). prescribe_today 결과: practice_active=true·5 items(order+insert)·75분. order 채점 로직(source_order 역순열=정답) SQL 재현 correct=true 확인. **runtime-test 현재 S3 데모-레디**(로그인 시 DCP 노출) — fluency 3건 DELETE로 S1 복귀 가능. `grade_dcp_item`은 auth.uid() 필수(서비스롤 호출 불가).

