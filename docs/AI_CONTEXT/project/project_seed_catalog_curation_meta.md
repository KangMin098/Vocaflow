> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_seed_catalog_curation_meta.md
> category: project

---

2026-06-01 — `/admin/curation` "소스 GET(대량)"(BulkFetchTab) 의 `library_seed_catalog`(ingest 전 소스 후보, ~1,484) 에 큐레이션 선택용 메타 추가. admin 큐잉 → Claude Code drain 패턴(dict-queue 와 동일).

**스키마**: `library_seed_catalog` + `est_v_level smallint`(추정 난이도) + `curation_meta JSONB`(est_cefr·est_basis·age_band·learning_value·synopsis_ko·genre_norm·themes) + `curation_status`(pending/queued/done). `library_seed_catalog_view` 는 컬럼 명시 나열이라 재생성 필요(3컬럼 append). 인기도=기존 popularity_rank·유형=기존 genre 재사용.

**난이도 = est_v_level (추정)**: seed catalog 는 ingest 전이라 vocab 없음 → 실측 V-Level(centroid) 불가. Claude Code 가 제목·저자 시대·description 으로 추정, **ingest 후 `book_v_level` 실측으로 대체**. ingested 동일작(Dorian/Sherlock=V8)으로 calibrate.

**큐잉 RPC** `queue_seed_catalog_for_curation(p_limit, p_source, p_not_imported_only)` — pending → queued, popularity_rank ASC NULLS LAST 우선, cap. admin-queries `queueSeedCatalogForCuration` 래퍼 + BulkFetchTab "정보 없는 도서 큐에 추가(top 100)" 버튼. 행 칩 ~V8·B2·연령·유형 + DetailPanel 줄거리/학습도움/근거/테마.

**drain (Claude Code)**: curation_status='queued' 행을 직접 UPDATE(est_v_level + curation_meta + done). 비영어(Die Traumdeutung 독일어)는 est_v_level NULL + learning_value "영어 학습 대상 아님". 참고서(CIA Factbook)는 학습 부적합 표기.

**✅ DRAIN 100% 완료 (2026-06-01)**: 미적재 소스 후보(`imported_to_books=false`) **전량 1,481건 curation_meta 채움** (인기순 50권 batch × ~26회). 잔여 3건(Romeo and Juliet · Twenty Years After · The Four Feathers)은 `imported_to_books=true` — 이미 library_books 적재, 실측 `book_v_level` 보유 → seed 추정 메타 불요. est_v_level 분포 (monotonic V↔CEFR 정합): V5/B1=19 · V6=92 · V7/B2=451(최다, 펄프·모험·추리) · V8/C1=490(빅토리아·고전 문학) · V9/C1=278 · V10/C2=136(셰익스피어 운문·철학·서사시) · V11/C2=14(극고급: Paradise Lost·Divine Comedy·Canterbury Tales·Ulysses·Faerie Queene·Wealth of Nations·City of God·Gibbon·Magic Mountain·Proust·Nietzsche·Tractatus 등) · NULL=1(비영어). 시리즈(Tarzan/Oz/Hardy Boys/Nancy Drew/Father Brown/Lupin) + 작가별 Poetry/Short Fiction 묶음은 작가 보정. 번역 고전은 syn 에 "(번역)" 명시 + genre_norm "번역 산문/운문".

cf. [[project_book_dict_registration_process]](동일 stage→drain 패턴), [[project_4axis_difficulty_done]](실측 난이도). 잘못 타겟한 library_books `queue_books_for_curation_metadata` 함수는 제거(컬럼 dormant 보존).

