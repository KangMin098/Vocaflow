# DB Schema

> Supabase PostgreSQL — `project_id=jajenrevcbmrpaliomxv` (vocaflow-dev).
> 본 문서의 모든 테이블·view·function·migration 카운트는 **DB direct query** 로 검증된 사실. 작성 시점: 2026-06-08.

---

## 요약

- **테이블**: **107** · **Views**: **11**(+ matview 4) · **Functions**: **360** · **인덱스**: **340** · **Migrations**: **528** · **용량 7,665 MB** (2026-08-31 DB 직접 쿼리 실측)
- RLS: 107 중 **106** enabled. 유일한 예외 `textbook_shelf_stats_meta` 는 anon 에 GRANT 되어 있지 않다.
- 주요 계열 — CTP 3종 `reading_fluency_log`·`csat_stage_gates`·`csat_item_attempts` · 추출신뢰 `word_familiarity` · 어원 `word_roots`·`word_root_links` · 추출품질 `extraction_judgments`
- 이전 기재(테이블 77 · view 7 · 함수 262 · migrations 72+)는 실측과 어긋나 있었다. **이 요약은 DB 쿼리로 재생성 가능한 값만 적는다.**

### 📏 `quality_drift_checks` — M7 회전 표본 상태 (2026-08-31 신설)

[20260831130000](../supabase/migrations/20260831130000_quality_drift_rotating_sample.sql).
`book_id`(PK, FK→library_books CASCADE) · `checked_at` · `drift` · `failed_reason`.
RLS 켜고 **정책 없음 = service_role 전용**. 인덱스 `idx_qdc_rotation(checked_at)`.

야간 M7 이 전권(312) 대신 `checked_at` 이 가장 오래된 **40권/밤**만 다시 재고, 이 표가 그 순서를
기억한다. `drift IS NULL AND failed_reason IS NOT NULL` = 그 책은 30초 안에 못 쟀다는 뜻이다 —
**빈칸으로 두지 않는다**(조용한 실패 금지). 지표는 이번 밤 표본이 아니라 이 표 **전체**에서 낸다.

### 🧹 인덱스 정리 — 798 MB 회수, 그리고 **지우면 안 되는 "미사용" 인덱스** (2026-08-31)

[20260831093411](../supabase/migrations/20260831093411_drop_unused_and_duplicate_indexes.sql) 로
8,463 MB → **7,665 MB**. 지운 8개는 근거를 세 갈래로 교차 확인했다 — 누적 스캔 0회
(`pg_stat_database.stats_reset` 이 NULL 이라 DB 생애 전체 누적이다) · 소비자 RPC 본문 · 생성 시점.

가장 큰 `idx_lav_lv` 754 MB 는 `(library_article_id, base_learning_value DESC)` 였는데,
**`base_learning_value` 로 정렬하는 소비자가 하나도 없었다**(RPC 4개 본문 전수 확인).
같은 `WHERE library_article_id = X` 를 형제 UNIQUE 가 3,252,863회 처리 중이다.

⚠️ **여기서 배운 것 — "스캔 0회" 만 보고 지우면 안 된다.** 0회 인덱스 중 넷은 **FK 자식 쪽**이라
남겼다(약 56 MB):

| 남긴 인덱스 | 받치는 FK | 지웠다면 |
|---|---|---|
| `idx_shared_words_vocab_ref` | `shared_words_library_book_vocabulary_id_fkey` SET NULL | 부모 1행 삭제 → `shared_words` 664,227행 seq scan |
| `idx_lbv_lemma` | `library_book_vocabularies_lemma_fkey` SET NULL | 사전 낱말 삭제마다 1,678,478행 |
| `idx_shared_words_lemma` | `shared_words_lemma_fkey` SET NULL | 〃 |
| `idx_shared_words_source_run` | `shared_words_source_run_id_fkey` SET NULL | 〃 |

**스캔 0회는 그 삭제가 아직 안 일어났다는 뜻이지 필요 없다는 뜻이 아니다.** 큐레이션
"→ 소스 GET" 이 `library_books` 를 DELETE 하는 구조라 실제로 밟는 경로다.
FK 판정은 `pg_constraint.conindid` 로 한다 — 한 인덱스가 **여러 FK** 를 받칠 수 있으므로
서브쿼리가 아니라 집계로 물어야 한다(`more than one row returned by a subquery`).

### 🔒 SECURITY DEFINER 뷰의 anon 노출 차단 (2026-08-31)

[20260831093427](../supabase/migrations/20260831093427_close_anon_exposure_on_definer_views.sql) —
`word_mislevel_signal` · `v_topic_word_salience` 가 `security_invoker` 가 꺼진 채 **anon 에 GRANT**
되어 있었다. 익명 키만으로 밑단 RLS 를 우회해 읽혔다는 뜻이다. 특히 전자는 `word_familiarity` —
**학습자의 known/unknown 응답**을 읽는다(가입자 3명이라 lemma별 집계라도 사실상 개인 이력).
`security_invoker = on` + `REVOKE` 두 겹으로 막았다. `service_role` 은 `rolbypassrls = true` 라
어드민·스크립트는 그대로 동작하고, 앱 코드 참조는 0건이었다.

과거 [20260614011809](../supabase/migrations/20260614011809_views_security_invoker.sql) ·
[20260709132237](../supabase/migrations/20260709132237_advisor_revoke_anon_definer.sql) 이 같은 일을
했는데 이 둘은 그물에 걸리지 않았다 — **뷰를 새로 만들 때마다 재확인이 필요하다.**

⚠️ 반대로 어드바이저 INFO "RLS 켜졌는데 정책 0개" 6종(`archaic_candidates` ·
`english_irregular_forms` · `noise_blacklist` · `st17_timetables` · `sw_comments` · `sw_players`)은
**의도된 상태다.** 뒤 셋은 과거 `FOR ALL TO anon USING(true)` 로 `sw_players.pass_hash` 가
anon 키에 읽히던 사고의 수정 결과이고, 회귀 테스트
`apps/web/src/lib/auth/__tests__/rls-surface.integration.test.ts` 가 그렇게 고정해 두었다.
앞 셋은 service_role 전용(RPC·스크립트)이다. **고치려 들면 사고를 되돌리는 셈이 된다.**

### ⛔ 스키마 드리프트 — RPC 8개가 없는 테이블을 참조 중 (2026-08-12 발견)

`20260719161409_drop_unused_empty_tables` 가 "빈 테이블 정리"로 13개를 `CASCADE` 삭제했다.
**비어 있음 ≠ 미사용** 이었다. 그리고 `DROP TABLE ... CASCADE` 의 함수 처리가 **두 갈래**로 갈려 결함이 두 종류로 나타났다:

| 함수의 반환 타입 | CASCADE 결과 | 증상 |
|---|---|---|
| `RETURNS int` · `void` 등 (본문에서만 테이블 참조) | **살아남는다** | RPC 가 남아 런타임에 `relation ... does not exist` |
| `RETURNS public.<table>` (테이블 **복합 타입**에 의존) | **함께 지워진다** | RPC 자체가 사라져 `function ... does not exist` |

`pending_words` 가 두 경우를 한 테이블에서 다 보여줬다 — `record_pending_words`(`RETURNS INT`)는 남고 `update_pending_word_status`(`RETURNS public.pending_words`)는 사라졌다. **테이블만 복원하면 후자는 여전히 없다.**

| 지워진 테이블 | 참조하는 RPC | 코드 접근 | 상태 |
|---|---|--:|---|
| `word_familiarity` | `extract_vocabulary_for_user_v2` · `set_word_familiarity` | RPC 경유 | ✅ **복원** ([20260812093000](../supabase/migrations/20260812093000_restore_word_familiarity.sql)) |
| `vocab_raw_texts` | — | 8곳 | ✅ **복원** ([20260812101500](../supabase/migrations/20260812101500_restore_vocab_raw_texts.sql)) — `publish.ts` 가 발행 세트 **출처 인용**을 이 테이블로 붙인다(라이선스 표기) |
| `word_lexicon` | `regenerate_auto_curated_set` · `reject_word_lexicon_insert` | 9곳 | ⚖️ **복구 안 함** — 삭제가 정당했다(의도적 동결). 단 유물이 남았다 → 아래 §word_lexicon |
| `classes` · `class_members` | `join_class_by_code` · `is_class_member` · `is_class_teacher` | 3곳 | ✅ **복원** ([20260812124500](../supabase/migrations/20260812124500_restore_class_data_model.sql)) — 원본이 **선반영**(화면보다 먼저 만든 테이블)이라 비어 있었고, 그 뒤 P4.2 에서 화면이 생겼다 |
| `pending_words` | `record_pending_words` (생존) · `update_pending_word_status` (**CASCADE 로 함께 삭제**) | 3곳 | ✅ **복원** ([20260812133000](../supabase/migrations/20260812133000_restore_pending_words.sql)) — 테이블 + 사라진 RPC 둘 다. ⚠️ RLS 가 own 뿐이라 **admin 이 남의 항목을 못 본다**(별건) |
| **`csat_item_attempts`** | `grade_dcp_item` · `derive_learner_stage` | 2곳 | ✅ **복원** ([20260812113000](../supabase/migrations/20260812113000_restore_csat_item_attempts.sql)) — **가장 심각했다**: `derive_learner_stage` → `prescribe_today` 로 전파돼 **hub "오늘" 처방이 전 학습자에게 실패**했다 |
| `reports` | — | 1곳 | ⚠️ `admin/layout` 은 try/catch 로 안전(뱃지만 0) |
| `dictation_sessions`·`dictation_items`·`achievements`·`user_level_progress` | — | 0곳 | ✅ 정당한 삭제 |
| `assignments` | — | 0곳 | ⏸ **의도적 미복원** — classes 와 같은 선반영이나 P4.3(과제 배포) 미구현. 지금 되살리면 또 지워질 빈 테이블이 하나 늘 뿐이다. DDL 은 원본 마이그레이션 21~29행 |

**교훈**: 테이블을 지우기 전에 `pg_proc.prosrc` 를 검색해야 한다. 행 수 0 은 미사용의 증거가 아니다.

`vocab_raw_texts` 는 그 이유를 가장 잘 보여준다 — 실제로 **비어 있었던 것은 사실**이었다(VCB 런 1건이 Method B = AI 생성 시드라 파일 업로드가 없었다). 틀린 것은 판정이 아니라 **추론**이었고, 정작 그 테이블은 발행 세트의 출처 인용을 붙이는 현행 경로였다.

```sql
-- 지우기 전 필수 점검 ①: 본문에서 참조하는 함수 (CASCADE 가 **지우지 않아** 남아서 깨진다)
select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prosrc ilike '%<table>%';

-- 필수 점검 ②: 그 테이블 타입을 반환하는 함수 (CASCADE 가 **함께 지운다** → 복원 시 같이 살려야 한다)
select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prorettype = 'public.<table>'::regtype;

-- 필수 점검 ③: 앱·패키지·스크립트 코드 참조
--   grep -rn "from('<table>')" apps packages scripts
```

**점검 ②를 빠뜨리면 복원이 절반만 된다** — `pending_words` 를 복원했는데
`update_pending_word_status` 가 없어 admin 상태 전환이 여전히 실패하는 상황이 그것이다.

#### csat_item_attempts — 가장 심각했던 항목 (hub "오늘" 전면 실패)

전파 경로:

```
csat_item_attempts (없음)
  └─ derive_learner_stage    SELECT avg(is_correct::int) FROM csat_item_attempts → 42P01
       └─ prescribe_today    line 9 에서 전파 → hub "오늘" 처방이 모든 학습자에게 실패
  └─ grade_dcp_item          INSERT ... RETURNING → 42P01 (DCP 구문 연습 채점 불가)
```

**왜 3주 넘게 아무도 몰랐나** — `prescription-actions.ts` 가 실패 시 하드코딩 폴백을 반환한다:
`stage 'S1' · 0분 · due 0 · 후보 [] · DCP 비활성`. 그 값이 **신규 학습자의 정상 상태와
완전히 같아서** 화면상 구별이 불가능했다. mock 보다 나쁘다 — mock 은 가짜임을 코드가
인정하지만 이건 **계산 실패를 계산 결과처럼** 반환했다.

**검증에서 배운 것**: 복원 후 첫 사용자의 stage 가 `'S1'` 으로 나왔는데 **그건 폴백값과 같아
아무것도 증명하지 못한다.** 시드 계정(`runtime-test-0705`, wpm 160 · fluency 3행)으로
다시 재서 **`'S3'`** 을 받은 뒤에야 "계산이 실제로 돌았다" 가 증명됐다. 복원 검증은
**폴백과 다른 값이 나오는 입력**으로 해야 한다.

##### ⚠️ 그 복원은 절반만 맞았다 — 채점은 10일 더 죽어 있었다 (2026-08-22)

복원이 원본 DDL 을 **그대로** 되살리면서 `question_id → quiz_questions` FK 도 함께 왔다.
그런데 `grade_dcp_item` 은 그 컬럼에 `csat_dcp_items.id` 를 넣는다. 그래서 42P01(테이블 없음)이
**23503(FK 위반)** 으로 바뀌었을 뿐 INSERT 는 여전히 100% 실패했다:

```
insert or update on table "csat_item_attempts" violates foreign key constraint
"csat_item_attempts_question_id_fkey"
DETAIL: Key (question_id)=(5d268e14-…) is not present in table "quiz_questions".
```

`gradeDcpItem` 이 이 예외를 `{correct:false}` 로 바꾸므로 **학습자가 정답을 맞혀도 화면은
"아쉬워요" 를 띄웠다.** 관측 0행은 "아무도 안 풀었다" 가 아니라 **"풀어도 안 남았다"** 였다.

당시 검증이 놓친 이유는 분명하다 — `derive_learner_stage` 와 `prescribe_today` 만 확인하고
**채점을 한 번도 돌려 보지 않았다.** 두 함수는 `csat_item_attempts` 를 *읽기만* 하므로
테이블이 있으면 통과한다.

수정: [20260822013136](../supabase/migrations/20260822013136_dcp_attempts_and_choice_grading.sql) 이
`dcp_item_id`(FK → `csat_dcp_items`, `ON DELETE SET NULL`)를 신설하고 `grade_dcp_item` 이
그쪽에 쓰게 했다. **두 문항 세계가 한 컬럼을 나눠 쓰면 FK 를 어느 쪽에도 못 건다.**
`SET NULL` 인 이유는 `refresh-dcp-items` 가 문항을 재생성하면 id 가 바뀌기 때문 —
링크만 끊고 행은 남겨야 `derive_learner_stage` 의 정답률이 유지된다.

회귀: [dcp-grade-records.integration.test.ts](../apps/web/src/lib/learner/__tests__/dcp-grade-records.integration.test.ts) —
**실제 학습자 세션으로 채점을 돌려 행이 생기는지 센다.** 정의를 읽지 않는다.

**침묵 제거**: `TodayPrescription.unavailable` 플래그 신설 + 카드가 폴백임을 고지 +
[회귀 테스트](../apps/web/src/components/home/__tests__/TodayPrescriptionCard.test.tsx)가
"정상 화면과 실패 화면이 실제로 달라야 한다"를 강제한다.

#### word_lexicon — 삭제는 정당했고, 남은 것은 유물과 고아 데이터다

13개 중 유일하게 마이그레이션이 **"frozen table"** 로 따로 분류한 항목이고, 그 판단이 맞았다.
남아 있던 트리거 함수가 자기 사유를 적어 두었다:

> `word_lexicon is FROZEN since lexicon-phase-1 (20260520). New words must go to shared_dictionary instead.`

[docs/proposals/lexicon-unification/README.md](./proposals/lexicon-unification/README.md) 가 *"v2.1과 v3.1은 양립 불가 → v2.1 폐기 또는 보존 결정 필요"* 라 했고 **v3.1이 채택**됐다. 이관은 끝나 있다 — `shared_dictionary` 45,682행 · `lexicon_clean` 455,152행 · `lexicon_clean` 을 쓰는 RPC 8개.

**정리한 것**
- `apps/web/src/lib/lexicon/` (4파일 806줄) **삭제** — 폐기된 v2.1 클라이언트. import 0곳(심볼 단위 전수 확인: `CefrLevel`·`FrequencyTier` 는 다른 5곳에 각자 정의돼 있어 무관).
- 시드 스크립트 2개는 **지우지 않고 동결 명시** — KICE 빈도를 되살리는 유일한 경로다.

**남긴 것 (별도 판단 필요)**

| 유물 | 왜 남겼나 |
|---|---|
| `word_frequency_stats` 5,421행 · `lexicon_source_tags` 5,421행 | **KICE 수능 13년 출현 통계**인데 `lexicon_id`(uuid)가 가리킬 부모가 없고 `lexicon_clean` 은 `word`(text) 키라 연결 불가. → **2026-08-15 부분 정정**(아래) |
| `regenerate_auto_curated_set` | 앱 호출 0곳(service_role 전용)이나 `word_lexicon JOIN lexicon_source_tags JOIN word_frequency_stats` 를 읽는다. → **2026-08-15 확인: KICE csat 세트 4개의 재생성 경로이고, `word_lexicon` 부재로 지금 실패한다**(컴포저가 대체) |

**정정 — 단어 정체가 다 유실된 것은 아니었다 (2026-08-15)**

위 표는 `metadata` 에 `years_appeared` 만 있다고 적었으나 실측하면 **`question_history`**
({연도: [문항번호]})도 5,421행 전부에 있고, `lexicon_id` → 단어를 잇는 **다리가 하나 살아 있었다**:
`shared_words.lexicon_id` (깨진 RPC 가 발행 시 넣어 둔 값).

| 조치 | 결과 |
|---|---|
| 다리로 이을 수 있는 lemma 를 `lexicon_frequencies.metadata.question_history` (lemma 키·생존)로 이관 | **673 lemma 구조** (`question_history_rescue` 표시 부착) |
| 이을 수 없는 것 | 5,421 중 **87% 영구 소실** — 발행 세트에 없던 단어의 문항 이력 |
| 구조 후 | KICE 4 세트를 컴포저로 **정확 재현**(430·361·234·362) — `exam-items` blueprint 의 `question_nos` 필터 |

⚠️ `scripts/lexicon-v2.2/kice-csat-seed.ts` 를 다시 돌려 `lexicon_frequencies.metadata` 를 덮어쓰면
구조한 것도 함께 날아간다. 상세: [VCB_REDESIGN.md §3.5](./VCB_REDESIGN.md)
| `reject_word_lexicon_insert` | 트리거는 이미 사라졌고(CASCADE) 함수만 남은 유물. 무해하나 오해를 부른다 |


**원문 실측으로 교체 — 목록이 빈도를 자처하고 있었다 (2026-08-21 · v06.330)**

위 구조 작업이 살린 `question_history` 는 그대로 살아 있지만, 같은 행의 **빈도 컬럼들은 빈도가 아니었다.**
`kice_csat`(source_id=1)은 문항별로 골라 적은 **핵심어 목록**이었고 컬럼 이름만 빈도였다:

| 컬럼 | 실제로 들어 있던 값 | 근거 |
|---|---|---|
| `raw_count` | 등장 **연도 수** (최댓값 9 — 13개년인데) | 컨슈머 `resolve.ts` 도 그렇게 읽는다 |
| `normalized_freq` | 연도비율 × 10000 (9/13→6923.08) | 토큰과 무관 |
| `appears_every_year` | **3,369행 전부 false** | 매년 나오는 낱말이 하나도 없다는 뜻 |
| 수록 범위 | `social` 은 2014 한 해만. `people`·`time`·`make`·`world` 는 **아예 없음** | 원문에는 13개년 전부 등장 |

원본 .txt 13개년(2014~2026)을 WLP 로 토큰화해 **실측으로 교체**했다
(`scripts/dict/csat-corpus-build.mjs` → `-diff.mjs` → `-apply.mjs`, 셋 다 재실행 안전).

| | 이전 | 이후 |
|---|---|---|
| 행 수 | 3,369 | **5,300** (실측 5,046 + 원문 미확인 254) |
| `raw_count` (연도 수) | 최대 9 · 불일치 1,366 | 최대 **13** · 실측 정정 |
| `normalized_freq` | 연도비율×10000 | **토큰 per 10k** (0.33~68.95) |
| `appears_every_year` | 0건 | **58건** |
| `question_history` | 673 | **673 보존** |

⚠️ **`raw_count` 에 토큰 빈도를 넣지 말 것.** `resolve.ts` 의 `spec.min_years` 가 이 컬럼을 읽는다 —
축을 바꾸면 `min_years: 3` 이 조용히 "3회 이상 등장" 이 되어 **오류 없이 세트만 헐거워진다.**
토큰 빈도는 `normalized_freq` 와 `metadata.token_count`·`by_year` 에 있다.

**원본의 함정 둘** (같은 자료를 다시 세는 사람을 위해): `2023`·`2024`·`2026` .txt 는 **홀수형+짝수형이 한 파일**에
들어 있어 그대로 세면 그 세 해만 빈도가 2배가 된다(연도 수는 안 변해서 눈에 안 띈다). `2014_B.txt` 는
`2014_A.txt` 와 **바이트 동일** — B형 추출 사고이고 B형 지문은 확보돼 있지 않다. 둘 다 빌더가 처리한다.

**한계 (실측)**: `scientists`·`workers` 처럼 문장 중간에서도 대문자로만 관측된 굴절형 77종(**159토큰 · 0.53%**)은


**정정 — 2014 는 두 회분인데 한 회분만, 그것도 이름과 반대로 들어 있었다 (2026-08-22)**

2014학년도는 영어가 **수준별 A/B 로 나뉜 유일한 해**다(2015학년도부터 통합). 원본 폴더의
`2014_A.txt` · `2014_B.txt` 는 바이트가 같아 "B형 추출 사고" 로 보고 B 를 버렸는데, PDF 에서
다시 뽑아 어휘 일치도를 재니 **반대**였다:

| 비교 | 어휘 일치도 |
|---|---|
| 기존 `2014_A.txt` ↔ **B형 PDF** | **99.8%** |
| 기존 `2014_A.txt` ↔ A형 PDF | 25.3% |

두 파일 모두 **B형**이고 **A형은 한 번도 추출된 적이 없었다.** ⚠️ 파일 이름을 근거로 쓰지 말 것 —
여기서는 이름이 내용과 반대였다. A형을 `pdftotext` 로 뽑아(`2014_Aform.txt`) 코퍼스에 더했다.

| | 이전 | 이후 |
|---|---|---|
| 내용어 토큰 | 29,876 | **31,359** |
| `kice_csat` 실측 행 | 5,192 | **5,254** |
| 전 연도(13개년) 등장 | 58 | **65** |

A형에만 있던 **표면형 521종**이 새로 들어왔지만 원형으로 접으면 **새 lemma 는 83종**이다
(books→book 처럼 대부분 기존 표제어로 접힌다). 추정 521 을 그대로 적었으면 6배 부풀린 수치가 됐다.

한글은 `pdftotext` 가 Adobe-Korea1 CMap 을 못 찾아 유실되지만, 어휘 추출은 영문만 쓰므로 무해하다.


**나머지 13개년도 같은 방법으로 검증했다 (2026-08-22)** — `scripts/dict/csat-source-verify.mjs`
(각 PDF 를 `pdftotext` 로 뽑아 .txt 와 어휘 Jaccard 일치도 비교, 읽기 전용).
2014 에서 이름이 내용과 **반대**인 사례가 실제로 나왔으므로, 코퍼스가 서 있는 원본 전체를 다시 봤다.

| 결과 | |
|---|---|
| 이름과 내용이 맞는 파일 | **14/15** (일치도 99.1~100%) |
| 새로 발견된 불일치 | **0건** |
| 알려진·처리된 불일치 | 1건 (`2014_A.txt` — 내용은 B형, `KNOWN` 에 명시) |
| 대응하는 .txt 가 없는 PDF | **0건** (빠진 회분 없음) |

2위 후보와의 일치도가 21~25% 로 크게 벌어져(1위 99%+) 오탐 여지가 없다.
검사는 **새 불일치에만 실패**하도록 `KNOWN` 예외를 둔다 — 영구 실패로 두면 아무도 안 본다.

**후속 — 결손 낱말 146 등재 (2026-08-21)**

위 결손 272종을 `scripts/dict/csat-dict-drain.mjs` 로 처리했다(`drain-article-lemmas.mjs` 와 같은 청크 형식).

| 단계 | 수 |
|---|---|
| 결손 후보 | 272 |
| `unresolved_dict_words` 해소기가 푼 것 | **44** (굴절·철자 변이 — `math`→`mathematics` 등) |
| Claude Code 가 판정 | 228 |
| `skip` (인명 `plato`·`napoleon` · URL 조각 `fffbg`·`goldbeachseaworld` · 굴절형 `advertisers`) | **82** |
| **사전 등재** | **146** (`source='ai-generated'` · `classified_by='claude_code_opus_5'` · `verified=false`) |

**해소기를 반드시 먼저 통과시킨다** — 결손 목록은 "표제어가 없다" 까지만 보는데 학습자 경로는
`resolve_dict_headword` 로 굴절형을 푼다. 안 거치면 이미 풀리는 낱말을 중복 등재해 품질을 되레 깎는다.

등재 후 `csat-corpus-diff` → `-apply --commit` 을 다시 돌려 빈도를 붙였다
(`lexicon_frequencies.lemma` 가 `shared_dictionary(word)` FK 라 **표제어가 먼저 있어야 빈도가 들어간다**).
결과: `shared_dictionary` 47,591 → **47,737** · `kice_csat` 5,300 → **5,446행**(실측 5,192 + 미확인 254) ·
`kice-csat-13y` **5,192** · **등장연도 불일치 0**.

남은 결손 125종은 인명·URL 조각·OCR 파편이라 등재 대상이 아니다.
인명(`charles`·`rhodes`)과 형태만으로 갈리지 않아 접지 않았다. 원형(`scientist`)에 그만큼 과소 반영된다.

**부수 발견 — vendor 목록에 기출 근거가 없다.** `csat-prep-core-2k` 1,838 중 **678(37%)**,
`csat-prep-ext-1.8k` 1,097 중 **424(39%)** 가 13개년 원문에 없다. 지우지 않고 `frequency_data_sources.citation`
에 비율을 적었다 — 출처 미확정 placeholder 라 교육적 타당성 판단은 별개다.

새 태그: `kice-csat-13y` **5,046** (기출 원문 등장) · `kice-csat-core-4y` **1,378** (4개년 이상 반복).
사전 결손 **272종**(`math`·`uncover`·`internalize`·`forager`·`upcycling` 등)은 `scripts/dict/csat-corpus/diff.json`
에 남겼다 — 별도 드레인 대상.

**재생성 방향(보류)**: 원천(`data/seed/kice-csat/*.xlsx` · `data/import/kice-csat-*.csv` — 둘 다 gitignore)이 있으면 parse → aggregate → seed 3단계로 되살릴 수 있다. 단 적재 대상을 **`lexicon_clean`(word 키)으로 재배선**해야 한다 — `word_lexicon` 복원은 동결 결정에 역행한다.

**부수 원칙 — 보조 지표가 본체를 죽이지 않게.** `/admin/vocab/sources` 가 통째로 500 이었던 직접 원인은 테이블 부재가 아니라 `fetchSources` 가 `run_count` 뱃지 집계 실패를 `throw` 한 것이었다(이미 손에 든 소스 목록까지 버렸다). `admin/layout.tsx` 가 `reports` 뱃지를 try/catch 로 감싸 0을 반환하는 쪽이 옳은 형태다. 계약은 [sources-resilience.test.ts](../apps/web/src/lib/vcb/__tests__/sources-resilience.test.ts) 5건이 고정한다.

### 🎯 추출 품질 — 바인딩 수리 + 판정 하네스 (2026-07-18)

P0 심층 평가(`docs/AI_CONTEXT/diagnostics/ext_quality_p0_20260718.md`)로 발견·수리. **표제어 바인딩 결함**: `select_*_vocab` 가 pre-stem 된 `bv.lemma`(파생/부정접두 과잉 축약)를 바인딩 → 학습자에게 반대 뜻 노출(발행 782 오바인딩·36 반의어 플립).

| 객체 | 종류 | 역할 |
|---|---|---|
| `select_book_chapter_vocab`·`select_article_vocab` | 함수(수정) | JOIN 시 **표면형이 자체 quality 표제어이면 그것으로 바인딩**(아니면 `resolve_dict_headword` 폴백). 782/782 재바인딩·+143 회수. migration `fix_extraction_surface_headword_binding` |
| `extraction_judgments` | 테이블(RLS enabled) | Q3/Q5 판정 하네스 골든 라벨. blind in-cap/out-of-cap 판정 + composite/sort_order 스냅샷(가중 변경 회귀 대조). migration `create_extraction_judgments_table` · RLS 정책은 하네스 UI(D3) 착수 시 admin grant |

### 🎯 추출 신뢰 — 학습자 교정 계층 (2026-07-16, 2단계)

3 추출 경로(책 `select_book_chapter_vocab`·글 `select_article_vocab`·BYO `extract_vocabulary_for_user_v2`)를 공유 해소기 `resolve_dict_headword`(direct→cluster→규칙역굴절→파생strip) + `infer_form_pos`(형태→POS sense 선택)로 **통합**. 그 위에 학습자 교정:

| 객체 | 종류 | 역할 |
|---|---|---|
| `word_familiarity` | 테이블(RLS·PK user+lemma) | 학습자 알아요/몰라요 판정 — **lemma 단위**(형태 무관). verdict·판정당시 v_level |
| `set_word_familiarity` | RPC(DEFINER) | `auth.uid()` upsert. authenticated만 |
| `word_mislevel_signal` | VIEW | known_ct/unknown_ct ↔ dict_v_level → 과대/과소난이도 후보 집계 |
| `extract_vocabulary_for_user_v2` | 함수(수정) | `verdict='known'` 단어 추출 제외(BYO) |

### 🏛️ 어원(root) 축 (2026-07-17, migration `20260717140000`)

시중 어원 단어장 대응 + 파생어 인식. 공개 표준 어근(무저작권).

| 객체 | 종류 | 역할 |
|---|---|---|
| `word_roots` | 테이블(RLS 공개읽기) | 라틴/그리스 어근 인벤토리. origin·meaning_en·gloss_ko·variants. **181행 시드** |
| `word_root_links` | 테이블(RLS·PK word+root_id) | 단어↔어근 매핑(멱등·다중 root). affix_type·confidence. **2,767 링크** |
| `shared_word_sets` `etymology-core` | 발행 세트 | "어원으로 익히는 핵심 영단어" 1,500단어·159 어근 챕터(category `etymology` — first-class, migration `20260717150000`) |

> 생성 도구: `scripts/dict/roots-seed.mjs`(어근 시드) · `roots-map.mjs`(파생어 매핑) · `roots-publish-set.mjs`(세트 발행). curation_query `{org:'root'}` 문서화(RPC 실행축 확장은 후속).

### 🧭 CTP — CSAT Track Pipeline 데이터모델 (2026-07-10, migration 3건)

기존 4 파이프라인(LCP·ACP·VCB·VRL) 산출물의 **소비자** 계층. 근거: [ctp_p0_20260709.md](./AI_CONTEXT/diagnostics/ctp_p0_20260709.md).

| 객체 | 종류 | 역할 |
|---|---|---|
| `library_articles/books.syntax_score` | jsonb 컬럼 | ① 구문 난이도(문장 p90·절 깊이) — 자체 정규식 산출 |
| `csat_stage_catalog` | VIEW | ② stage_band(S1–S4) 파생 — article=register 우선, 도서 v7-9=S4. 139항목 |
| `quiz_questions.type` +`order`/`insert` · `+item_role` | CHECK·컬럼 | ③ DCP 결정론 문항(order/insert) + 역할(practice/verify) |
| `reading_fluency_log` | 테이블(RLS) | ④ 유효 WPM(comprehension_ok). ⚠ 기존 `reading_sessions`(읽기플랜)와 별개 |
| `csat_stage_gates` | 테이블 | ⑤ 게이트 임계(stage×metric · is_locked=false 권장값 9행) |
| `csat_item_attempts` | 테이블(RLS) | ⑦ per-item 응답 + error_cause(vocab/parsing/structure/inference/timing) |

> **학습자 stage 는 컬럼 저장 금지** — `csat_stage_gates` 전 지표 통과 최대 단계를 매 요청 실시간 파생(§9 R(t) 동형). stage_band(콘텐츠 메타)만 저장 OK.

### 🔒 RLS 보안 상태 (v06.117 — security advisor ERROR 0)

`public` 스키마 RLS 비활성 8 테이블(전부 anon SELECT+INSERT 권한 노출)을 하드닝. 마이그레이션 `20260703120000_p0_security_rls_hardening` + `20260703120010_p0_drop_p5a_backup_table`.

| 테이블 | 조치 | read 정책 |
|---|---|---|
| `vocaflow_levels`·`vocaflow_tracks`·`vocaflow_domains`·`vocaflow_skills` | RLS on | authenticated read (앱 DiagnosticClient·admin) |
| `vrl_data_integrity_concerns` | RLS on | admin 전용 read (`user_profiles.role='admin'`) |
| `noise_blacklist`·`english_irregular_forms` | RLS on, 정책 없음(락) | 클라이언트 직접 read 없음 — SECURITY DEFINER RPC·service_role bypass |
| `shared_dictionary_p5a_backup_20260620` | **DROP** | 추출 P1~P4 백업본 목적 종료 |

(`archaic_candidates` 는 기존 RLS on·정책 0 유지 — 서비스롤/DEFINER 경유 read.)

**`lookup_word_meaning(text)` 단계 순서 (v06.36 · [20260816045450](../supabase/migrations/20260816045450_publish_lookup_prefers_registered_inflections.sql))** — `direct` → **`cluster`(사전 등재 굴절형)** → `inflection`(규칙 생성) → `variant` → `derivation` → … 순. **`cluster` 가 `inflection` 보다 앞이어야 한다** — 뒤에 있던 동안 발행 세트 210행이 틀린 표제어에 묶였다(`dying`→dye "염색하다" · `lying`→lye "양잿물" · `riper`→rip "찢다"). `resolve_dict_headword` 의 L2→L3 순서와 같은 정책이다: **명시된 데이터가 생성된 추측을 이긴다.** 백필분 원본은 `backup.published_lemma_rebind_20260815`(190행).

**`regexp_quote(text)` (v06.36 · [20260815092528](../supabase/migrations/20260815092528_template_examples_residue_escaped_headwords.sql))** — POSIX ERE 메타문자 이스케이프. IMMUTABLE·STRICT·`search_path=''`. **`shared_dictionary.word` 를 정규식에 문자열 연결하는 모든 경로는 이 함수를 경유한다** — 표제어 216종이 괄호·물음표를 갖고 있어, 안 거치면 괄호가 그룹으로 해석돼 조용히 매칭을 벗어난다(20260815093000 이 이 이유로 39행을 놓쳤다).

**`backup` 스키마 (v06.36 · [20260815082723](../supabase/migrations/20260815082723_backup_template_examples_before_purge.sql))** — 되돌릴 수 없는 대량 DML 직전 원본을 담는 곳. 현재 `backup.template_examples_20260815` 1종(8,403행 · 2.3 MB · 템플릿 예문 퍼지 원본). **public 이 아닌 이유**: PostgREST 노출 대상이 아니라 새 클라이언트 표면·RLS 정책이 생기지 않는다. 위 `shared_dictionary_p5a_backup_20260620` 처럼 public 에 두면 하드닝 대상이 된다. 목적 종료 시 `DROP SCHEMA backup CASCADE`.

**v06.148 admin read 정책 4건** (`20260706010000_vrl_admin_read_policies`): `is_admin()` SECURITY DEFINER 헬퍼(자기참조 재귀 방지) 기반으로 `user_level_snapshots`·`user_profiles`·`user_diagnostic_results`·`vrl_diagnostic_tests`(비활성 포함)에 admin SELECT 추가 — `/admin/vrl/*` 하위 페이지 직접 read 정상화. 본인(own) 정책은 유지.

**v06.164 DEFINER 함수 EXECUTE 잠금** (`20260708120000` + `20260708120500`): 보안 advisor 후속 — anon 키 공개로 앱 인증 우회 호출 가능하던 무가드 SECURITY DEFINER 9종 잠금. 쓰기 3종(`enrich_shared_dictionary`·`regenerate_auto_curated_set`·`process_library_pipeline_batch`) → service_role 전용. admin 읽기 6종(`admin_vrl_*`) → anon 회수·authenticated 유지. ⚠️ 함수 EXECUTE 기본 PUBLIC grant라 `REVOKE FROM anon` 무효 → `REVOKE FROM PUBLIC` 필수.

## 도메인별 테이블 분류

각 테이블의 row count + size 는 검증 시점(2026-06-08) 기준 — 운영 중 변동.

### 1️⃣ 사용자·인증 (auth schema 별도)

| 테이블 | rows | size | 비고 |
|---|---:|---:|---|
| `user_profiles` | 2 | 56 kB | role · display_name · locale · theme · tts_voice · daily_word_goal · notify_* · current_v_level · current_track_levels |
| `user_stats` | 0 | 16 kB | mastery_level · total_words · current_streak · fsrs_target_retention · `known_word_count`(P0 · LingQ형 Implicit, stability≥21, flush→refresh_user_known_word_count) (Hub 진입 1쿼리 캐시) |
| `daily_activity` | 0 | 24 kB | (user_id, date) PK · total_minutes · total_words · total_reviews · by_module JSONB · avg_accuracy · **P0 자동 집계**(learning_records→총복습/모듈별 · scores→분/단어 트리거, KST date) |
| `achievements` | 0 | 24 kB | kind · module · value · metadata JSONB · achieved_at |
| `reports` | 0 | 24 kB | kind · subject · message · status · admin_note (admin /reports) |
| `study_plan_items` | 3 | — | **P1(재설계 2026-06-28)** 학습 계획 — material_type(**book/article/word_set/script**) · material_id(다형) · modules text[](활동 10종) · **chapters int[]**(도서 선택 챕터) · **weekdays int[]**(학습 요일 1=월..7=일, 빈=미정) · 본인 RLS 4정책 · updated_at 트리거. **다중 엔트리(2026-07-06 `UNIQUE` 제거)** — 한 자료가 여러 배치(요일×챕터)로 → 챕터=최하위 단위 일별 배치. (수능 `learning_goals` 폐기 / 전역 일정 `study_plan_schedule` 폐기 — 요일은 항목별) |
| `weekly_reports` | 0 | — | **P2** 주간 Report Card — week_start(월,KST) · total_minutes/words/reviews · by_module · empathetic_note(격려 코멘트) · UNIQUE(user_id,week_start) · 본인 RLS · daily_activity 주간 집계 |
| `classes` | 0 | — | **P4.1 L3 B2B 선반영**(화면 Phase 2) — teacher_id · name · invite_code UNIQUE · RLS(교사 전권 + 멤버 읽기) |
| `class_members` | 0 | — | **P4.1** class_id+user_id PK · role(student/assistant) · RLS(본인·교사 읽기, 본인 가입, 교사/본인 삭제) |
| `assignments` | 0 | — | **P4.1** class_id · kind(text/word_set) · ref_id · due_at · RLS(교사 전권 + 멤버 읽기). 순환 차단 헬퍼 `is_class_teacher`/`is_class_member`(SECURITY DEFINER) |

### 2️⃣ 학습 콘텐츠 (사용자 자산)

| 테이블 | rows | size | 비고 |
|---|---:|---:|---|
| `texts` | 238 | 256 kB | 사용자 스크립트 · `library_book_id` (curated) OR `user_book_group_id` (v06.34 신규) 그룹 식별 · CHECK 동시 사용 차단 |
| `vocabularies` | 5,896 | 2.4 MB | 사용자 단어장 (FSRS 6컬럼) · UNIQUE(user_id, word) · `lemma` REFERENCES `shared_dictionary(word)` |
| `learning_records` | 0 | 40 kB | 모든 모듈 공통 — rating SMALLINT 1-4 (FSRS) · is_correct · metadata JSONB |
| `scores` | 0 | 32 kB | 게임 결과 (Flashcard·SpellForge·WordBlitz·PairFlip·ScriptQuiz·Dictation) · metadata JSONB · **v07 `content_ref` 3컬럼**(`content_type` CHECK book/text/set/article/comic/mine · `content_id` uuid 다형(FK 없음) · `content_chapter`) — `text_id`(texts FK)로는 큐레이션 도서·단어장을 가리킬 수 없어 49행 전부 NULL 이던 것을 해소. idx 2본(partial) |
| `quiz_questions` | 5 | 24 kB | ScriptQuiz **개인** 문제 (per user+text · type · question/`question_ko`(A3.4b) · options JSONB(textKo) · correct_index · source_snippet) — A3.4 첫 콘텐츠 5문제(Ammachi Ch1) |
| `library_chapter_quiz` | 360 | — | **v06.114** ScriptQuiz **큐레이션 공유** 챕터 퀴즈 (키 library_book_id+chapter_idx+q_order UNIQUE · type · question/question_ko · options JSONB(textKo) · correct_index · source_snippet · book_v_level 스냅샷) · RLS admin-only, 학습자는 `select_book_chapter_quiz` RPC read · 6권 360문항(live-verified) |
| `book_quiz_jobs` | 0 | — | **v06.114** 퀴즈 생성 작업 큐 (book_id UNIQUE · status · book_v_level/target_per_chapter 스냅샷 · chapters_total/done · questions_created) · RLS admin-only · `enqueue_quiz_jobs` 적재 → Claude Code 드레인 갱신 |
| `dictation_sessions` | 0 | — | **v07 재신설** (`20260812150000_dictation_persistence`) — 세션 헤더. `source_kind` CHECK(book/text/set/daily/custom) + 출처 좌표(text_id · library_book_id · chapter_idx · shared_set_id) · config JSONB · avg_accuracy · `longest_perfect_words`(청취 폭) · `items` JSONB(문항 목록 — **없으면 다른 기기에서 세션 URL 을 못 연다**, `20260815060000`) · RLS auth.uid() |
| `dictation_attempts` | 0 | — | **v07 신설** — 문항 1시도. word_results JSONB · `error_tags TEXT[]`(GIN, 약점 리포트 원천) · `target_words`/`target_hits TEXT[]`(FSRS 등급 근거) · replay_count · skipped · 세션 FK CASCADE · **UNIQUE(session_id,item_idx)**(`20260816030000` — 이중 제출·두 탭 중복 차단. ⚠️ 호출부 upsert 가 이 인덱스에 의존, 없으면 적재 0행) · RLS auth.uid() |
| `echo_match_sessions` | 2 | 48 kB | v06.33 — avg/best/worst 점수 · retried_sentence_ids TEXT[] |
| `echo_match_attempts` | 5 | 64 kB | 3축 점수 (intonation/stress/rhythm) · duration_ms · idx user_date |
| `reading_sessions` | 217 | 128 kB | LCP v2.0 — 사용자별 chapter 동적 분할 |
| `pending_words` | 11,081 | 80 kB | 사전 해석 실패 큐. 출처 둘 — 학습자 추출(`user_id` 있음, 실측 39행)과 주제 코퍼스 적재(`context_snippet=corpus:<소스>`). `doc_freq`(20260825114639) = 몇 편의 글에 나왔나, 0 = 미집계 |

### 3️⃣ 공용 단어장 / 사전 마스터

| 테이블 | rows | size | 비고 |
|---|---:|---:|---|
| `shared_dictionary` | **47,737** | **183 MB** | 영단어 마스터 캐시 — 11개 통합 컬럼 (Phase 1). **채움률은 2026-08-21 실측**(아래 주): meaning_ko 100% · pos_set 99.1% · primary_pos 97.2% · senses 81.3% · ipa 77.1% · inflected_forms 31.9%(15,219) · mnemonic_ko 15.5%(7,405) · **ipa_uk/ipa_us 0%** · `inflected_forms` text[] GIN (`scripts/dict/clean-inflected-forms.mjs` · NULL→규칙 fallback) · kaikki 보완(v06.269): `homophones`·`rhyme_key`·`derived_forms`·`related_terms` 4컬럼(마이그 `add_kaikki_extra_columns`) · **`example_ko`**(대표 예문 `example_en` 의 한국어 짝, 마이그 `20260830170000`) — ⚠️ **뜻마다 붙은 예문의 번역은 여기가 아니라 `senses[].examples_ko`** 다. 둘을 섞으면 짝이 어긋난다(대표 예문이 몇 번 뜻의 것인지 알 수 없음). 채우는 곳: `scripts/vocab/example-ko-drain-*` |

#### `meanings_ko` 원소 계약 + `field_provenance` 판정 표식 (D0830 · 2026-08-30)

`meanings_ko` 는 jsonb 배열이고 원소는 `{pos, meaning, v_level, example?, example_ko?}` 다.
**컬럼을 늘리지 않고 원소에 키만 더한다** — 그래서 D0830 배치(뜻별 예문·해석)에 마이그레이션이 없다.
⚠️ 통째로 덮지 말 것: `meaning`·`v_level` 이 같이 날아간다. 원소별로 키 하나만 더한다.

| 키 | 뜻 | 채운 배치 |
|---|---|---|
| `example` | **그 뜻으로만 읽히는** 문장. 뜻 목록만으로는 다의어가 갈리지 않는다 | `w0830-senseex` |
| `example_ko` | 그 예문의 한국어 해석. 국내 교재는 예문마다 해석을 단다 | `w0830-senseex` · `w0830-exko` |

**소비**: `lib/flashcard/dict-extras.ts` 가 senses 와 `exampleTranslations` 표를 만들고
CardBack·WordLookupPopover 가 그린다. 카드가 어떤 예문을 고를지 사전 계층은 알 수 없으므로 **표를
넘기고 소비 측이 찾는다**. 관리자 사전 건강 R3 의 '예문 해석' 지표는 `meanings_ko->0->>example_ko`
만 세는 **하한 추정치**다(jsonb 배열 순회는 카운트 쿼리로 못 한다).

`field_provenance` 는 필드별 출처를 적는 jsonb다(`ipa: cmudict-0.7b` 등). D0830 이 둘을 더했다:

| 값 | 뜻 |
|---|---|
| `cefr_level: 'cefrj-wordlist-1.6'` | CEFR-J 를 정본으로 화해시킨 행(3,862) — 되돌릴 손잡이 |
| `<field>: 'none:d0830'` | **물어봤고 "없다" 로 판정된 필드.** 빈 배열과 구별하려고 남긴다 |

⚠️ `'none:'` 표식이 없으면 `antonyms = {}` 하나가 "아직 안 물어봄" 과 "물어봤고 없다" 를 똑같이
표현한다 → **다음 export 가 같은 낱말을 영원히 다시 묻는다.** `rice`·`elephant`·`oxygen` 에는
반의어가 없고, 수능 밴드에서만 그런 낱말이 2,301개였다.

⚠️ `enforce_base_word_depth1` 트리거 — `base_word` 는 **계열의 뿌리**를 가리켜야 한다.
`leadership → leader` 는 거부된다(leader 자신이 파생어라서). `leadership → lead` 가 맞다.

**채움률 주장은 실측으로만 (2026-08-21)** — 위 줄은 오래 `senses/primary_pos/pos_set/ipa_uk/us 100% (Phase 2)` 라고
적고 있었으나 **실측하면 senses 81.3% · ipa_uk 0행 · ipa_us 0행** 이었다. Phase 2 가 채우려던 컬럼 중 발음 두 개는
한 행도 채워진 적이 없다(`ipa` 단일 컬럼만 36,790행). 낡은 100% 주장은 "이미 다 됐다" 로 읽혀 **보강 작업을 건너뛰게**
만든다 — 이 저장소가 반복해 겪은 실패 형태다. 채움률을 다시 적을 때는 `scripts/dict/csat-dict-health.mjs` 로 재서 적는다.
| `coverage_lexicon` | **424,328** | — | **독해 커버리지 참조 사전 (학습 core와 분리, v06.271)** — 도서·스크립트의 비학습 롱테일 단어 뜻 조회용. kaikki 단일어·content POS·form_of(굴절) 제외 벌크. `word`(PK)·`pos`·`gloss_en`(즉시 폴백)·`ipa`·`meaning_ko`(demand LLM·NULL 시작)·`frequency_rank`·`source`·`seen_count`(승격 신호). RLS 공개읽기. 마이그 `create_coverage_lexicon`. **학습 로직(단어장·i+1·추천)은 조회 금지** — 오직 reader 폴백. |
| `shared_words` | 13,437 | 46 MB | 공용 단어장 — `source_queue_id` FK to vocab_enrichment_queue (cast-2000 audit) · `source_sentence`(원문 출현 문장 · 도서 단어장 예문, 렌더는 source_sentence→example_en 폴백) · **`chapter` smallint**(세트 내 챕터 1..N, NULL=미분할 — 하나의 세트를 여러 챕터로 내부 구성, 챕터별 발행 아님. idx `set_id,chapter,sort_order`, 2026-07-09) |
| `shared_word_sets` | 277 | 2.8 MB | 단어장 헤더 — category(8 enum)+`category_id`/`additional_category_ids[]` (브릿지) · is_published · curation_query JSONB · **`subscriber_count`**(구독수 denormalized · `user_word_set_subscriptions` INSERT/DELETE 트리거 `trg_maintain_set_subscriber_count` 유지 · 사용빈도/인기 랭킹, RLS 본인전용 집계 회피, 2026-07-09) · **`brand_fingerprint`**(발행 당시 브랜드 규격 해시 FNV-1a 8자리 — 색은 복사하지 않는다, 토큰이 정본) + **`ladder_step`**(사다리 1~7 · CHECK 제약 · **파생 캐시가 아니라 컴포저가 정하는 값**, NULL 이면 화면이 category/cefr 로 추정, migration `20260830160000`) |
| `user_word_set_subscriptions` | 225 | 104 kB | 다중 구독 · source_book_id ref (자동 import 추적) |
| `dictionary_categories` | 566 | 288 kB | 3계층 카테고리 트리 (H1=18 / H2=76 / H3=472) · self-ref parent_id |
| `dictionary_word_categories` | 28,079 | 7.7 MB | 단어↔카테고리 M:N 매핑 |
| `lexicon_frequencies` | 8,382 | 1.7 MB | Phase 2 사이드카 — KICE+WM+EBS+NGSL+AWL+COCA 다중 출처. `kice_csat` 은 2026-08-21 원문 실측 5,300행 (§ 위 참조) |
| `lexicon_source_tags` | 5,421 | 2.8 MB | source 태그 매핑 |
| `word_lexicon` | 5,421 | 1.7 MB | **FROZEN** since 20260520 — Phase E DROP 예정 |
| `word_frequency_stats` | 5,421 | 2.4 MB | 빈도 통계 (legacy) |
| `noise_blacklist` | 24,321 | 3.9 MB | VCB pipeline 필터 |
| `archaic_dictionary` | 810 | 272 kB | 고어 사전 |
| `archaic_candidates` | 32,427 | 9.5 MB | 미바인딩 고어 후보 — `first_seen_book_id` FK SET NULL (v06.34) |
| `english_irregular_forms` | 337 | 80 kB | 불규칙 변화형 |

### 4️⃣ 라이브러리 도서 (LCP — Library Curation Pipeline)

| 테이블 | rows | size | 비고 |
|---|---:|---:|---|
| `library_books` | 20 | 760 kB | 도서 마스터 — status 10 단계 · 4축 난이도 (book_v_level · cefr_band · cefrj_level · flesch_kincaid_grade) · `librivox_audio` JSONB · `cover_image_url` · `copyright_safe_in_kr` · `is_picture_book` (GENERATED · 삽화≥4+단어<5000 · judgeIPlusOne -7pp 보정) |
| `library_chapters_master` | 1,296 | 1.4 MB | chapter 정본 — `content_hash` ref content_chunks · paragraph_offsets · sentence_offsets · word_count · `group_label` · `source_href`(원본 챕터 deep-link, SE TOC 매핑 · NULL→도서 TOC fallback) · `chapter_v_level`(챕터별 어휘 V-level p75·V11 제외 · 1,295/1,296 · book_v_level 편차 노출 · migration `20260709145433`) |
| `content_chunks` | 1,174 | 13 MB | SHA-256 dedup 본문 저장 — PK=hash only · TOAST 대형 |
| `library_book_vocabularies` | 96,636 | 39 MB | chapter별 사전계산 단어 (v06.34 VACUUM FULL 후 233→39 MB) · **v06.35** 진단 4컬럼 `resolved_via` / `resolved_lang` / `resolved_word` / `noise_kind` (`lemma IS NULL` 행에 `lookup_word_meaning` 해석 결과 기록 — `lemma` 자체는 불변) + 부분 인덱스 `idx_lbv_unbound_book WHERE lemma IS NULL` |
| `library_articles` | 4 | 104 kB | ACP — 짧은 글 · `license_class` / `register` / `lexical_noise` / `display_only` (ACP §18 게이트 · BEFORE INSERT/UPDATE 트리거 `acp_apply_license_gate` 자동 도출 · `trg_la_require_audio` = VOA 발행 시 `audio_url` 필수 게이트, 듣기 정체성 · `source` CHECK 19종 — 2026-08-30 마이그레이션 `20260830020000` 이 `futurity` 추가(어댑터는 2026-08-21 부터 있었는데 제약만 빠져 INSERT 가 전량 거절되고 있었다)) |
| `library_article_vocabularies` | 11,011,463 | **3,850 MB** | article 단어 — **DB 최대 테이블**(전체 7.6 GB 의 절반). 19,384편 × 편당 568행. **원문에서 재현 가능한 캐시다** — `content` 에 `normalizePunctuation`→`reflowSoftHyphens`→`extractBookLemmas`→`computeLearningValue`(전부 순수 동기 함수·LLM 0)를 돌리면 낱말·빈도·`first_sentence` 가 **비트 단위로 일치**(6편 2,565행 대조·불일치 0 · 편당 46.5 ms · 실측 2026-09-01). 고유 정보 0 → 보관 범위는 비용 문제이지 데이터 손실 문제가 아니다.<br>**v06.35** 마이그레이션 `20260901040000` 이 죽은 컬럼 3개 제거 → 4,249→3,850 MB(−399 MB): `id`(uuid 대리키 · `idx_scan=0` 인 399 MB PK 인덱스 · 참조 FK 0) · `lemma`(11,011,463행 **전량 NULL** · FK+부분인덱스 동반 제거 · RPC 3종의 `COALESCE(lav.lemma, lav.word)` 정리) · `created_at`(읽는 코드 0 · 기사에 `vrl_calculated_at` 있음). **PK 없음** — 실제 키 `UNIQUE (library_article_id, word)`(6,410,326 scans)가 대신한다(승격 시 650 MB 재빌드라 안 함 · 논리복제 대상 아님). 남은 컬럼 6: `library_article_id` · `word` · `frequency_in_article` · `first_sentence` · `base_learning_value` · `context_pos`.<br>⚠️ heap 3,199 MB 는 `VACUUM FULL` 전까지 안 준다(예상 −385 MB · 305→268 B/행).<br>⚠️ `library_book_vocabularies.lemma` 는 **94.8% 채워진 살아있는 컬럼**이다 — 혼동 금지 |
| `library_seed_catalog` | 1,843 | 4 MB | seed 후보 — `imported_book_id` FK ON DELETE SET NULL (소스 GET 복귀 핵심) · curation_meta JSONB |
| `library_source_catalogs` | 11 | 80 kB | 9 소스 (gutenberg / standard_ebooks / wikibooks / wikisource / librivox / openstax / open_library / hathitrust / simple_wikipedia) + manual + voa_learning · composite_score · S/A/B/C/M tier |
| `book_curation_jobs` | 1 | 136 kB | v06.34 — admin /curation dev 일괄 처리 큐 · task_type(voice_map/quiz_gen/level_verify/vocab_audit/**comic_gen**) + panels_total/done |
| `comic_books` | 0 | — | **CCP** 만화 헤더(발행 게이트) — library_book_id PK/FK · status(draft/published/archived) · qc_verdict JSONB(지속) · panels_pass · panels_total · style/backend · RLS admin-only. 마이그레이션 `20260808120000` **적용됨(2026-08-08)** |
| `comic_pages` | — | — | **CCP** 컷 — (library_book_id,chapter_idx,page_order) UNIQUE · image_url(외부 URL) · bubbles JSONB · target_vocab[] · RLS admin-only, 학습자는 `select_book_comic`/`select_book_comic_all` RPC(published 게이트) read |
| `comic_read_progress` | — | — | **CCP** 만화 진도(기기 간 이어보기) — (user_id, library_book_id) PK · RLS **user-owns** · `save_comic_progress` RPC. 마이그레이션 `20260808160000` |
| `comic_gen_runs` | 1 | — | **CCP 관측** 드레인 실행 — backend/site/model·status·진행·iterations(자기발전)·비용·verbatim/rule · RLS admin. `20260808180000` |
| `comic_panel_events` | 90 | — | **CCP 관측** 컷 작업/평가 이력 — chapter/page·attempt·phase·status·score·verdict jsonb · RLS admin |
| `comic_gen_tests` | 1 | — | **CCP 관측** 생성 파이프라인 실험(A/B) — backend/model/params/result jsonb · RLS admin |
| `comic_gen_models` | 17 | — | **CCP** 이미지 생성 모델 레지스트리(시장조사) — run_envs[](runpod/kaggle/api)·min_vram·comic_fit·능력·상태 · RLS admin. `20260808200000/220000` |
| `comic_styles` | 20 | — | **CCP** 만화 스타일 프리셋 — 포맷×연령×장르×난이도 → art_prompt/negative/lettering · RLS admin. `comic_books.style_key` FK. `20260808240000` |

CCP RPC: `enqueue_comic_jobs` · `admin_set_comic_published`(panels_pass 강제) · `select_book_comic` · `select_book_comic_all` · `list_book_comic_catalog` · `book_comic_available` · `get_comic_format`(리더 구성 방식 → 웹툰=세로스크롤 자동, `20260809` 적용) — 학습자 read 전부 `comic_books.status='published' AND library_books.status='published'` 게이트(DEFINER + authenticated).

### 5️⃣ VCB (Vocabulary Curation Build) Pipeline

cast-2000 audit chain — 4 테이블 cascade:

| 테이블 | rows | size | 비고 |
|---|---:|---:|---|
| `vocab_runs` | 1 | 64 kB | run header (cast-2000) |
| `vocab_seed_candidates` | 2,000 | 576 kB | run FK CASCADE |
| `vocab_dict_hits` | 2,000 | 904 kB | seed FK CASCADE |
| `vocab_enrichment_queue` | 2,000 | 4.6 MB | seed FK CASCADE · `shared_words.source_queue_id` 가 역참조 (SET NULL) |
| `vocab_curation_decisions` | 2,000 | 344 kB | queue FK CASCADE |
| `vocab_sources` | 1 | 48 kB | source registry |
| `vocab_collections` | 1 | 64 kB | collection 그룹 |
| `vocab_raw_texts` | 0 | 32 kB | content_hash ref content_chunks |
| `frequency_data_sources` | 11 | 48 kB | 11 출처 메타 |

**발행 RPC** `vcb_publish_commit(p_run_id, p_slug, p_version, p_title, p_category, p_source_attributions jsonb, p_words jsonb, p_published_by)` — 세트→단어→컬렉션→`vocab_runs.status='published'` 를 단일 트랜잭션으로 원자 발행(실패 시 전량 롤백, orphan 불가). `SECURITY DEFINER` · `search_path=public` · 실행권한 `service_role` 한정. (P0-7 트랜잭션화)

### 6️⃣ VRL (Vocabulary Reading Level) 분류 시스템

| 테이블 | rows | size | 비고 |
|---|---:|---:|---|
| `vocaflow_levels` | 12 | 64 kB | V-Level 0-11 |
| `vocaflow_tracks` | 6 | 32 kB | 영역 중립 트랙 ID |
| `vocaflow_domains` | 8 | 32 kB | 도메인 |
| `vocaflow_skills` | 5 | 32 kB | 스킬 |
| `vrl_diagnostic_tests` | 5 | 32 kB | base + csat + business + academic + comprehensive |
| `vrl_diagnostic_questions` | 185 | 64 kB | 40 base + 31 csat + 32 biz + 32 acad + 50 comprehensive |
| `vrl_data_integrity_concerns` | 82 | 120 kB | 분류 정합 의심 row |
| `user_diagnostic_results` | 6 | 56 kB | 진단 결과 |
| `user_level_progress` | 0 | 32 kB | 학습 진행 |
| `user_level_snapshots` | 5 | 96 kB | audit chain — taken_reason · snapshot_type · snapshot_meta JSONB |

---

### 7️⃣ TCP (Topic Corpus Pipeline) — 주제별 어휘 관측 (2026-08-16, migration `20260816160000`)

**왜 만들었나**: 사전 주제 분류의 집은 이미 있었다 — `dictionary_categories` 566개(Oxford 3계층
18/76/472) + `dictionary_word_categories` 28,079 링크. 그런데 커버리지가 **21,712 / 47,137 = 46%**
이고, 링크가 전부 `source='imported'` 한 덩어리라 **한 번 부어 넣은 뒤로 자라지 않았다**.
게다가 그 taxonomy 는 사전 편찬 판정이라 "실제 담론에서 어떤 단어가 어떤 주제와 함께 나타나는가"
에 대한 증거가 없다. TCP 는 주제가 붙은 실제 글을 훑어 그 증거를 만든다.

| 테이블 | 용도 |
|---|---|
| `topic_corpus_sources` | 코퍼스 소스 레지스트리. TED 15주제 시드. `category_id` = 승격 목표(NULL 이면 통계만) |
| `topic_corpus_queue` | 드레인 큐. `claim`(SKIP LOCKED) → `ingest` → `done`. 30분 초과 claim 자동 회수 |
| `topic_corpus_docs` | 수확 원장. **본문 컬럼이 없다** — 아래 참조 |
| `topic_word_stats` | (source_id, word) → `doc_freq` · `term_freq`. **원시 카운트만** |

⚠️ **원문을 저장하지 않는 것은 누락이 아니라 설계다.** 대상 코퍼스(TED 자막)는 CC BY-NC-ND 4.0
(비영리·2차적저작물 금지)이라 보관이 불가하다. 그래서 토큰화는 메모리에서 끝내고 카운트만 남기며,
`topic_corpus_docs` 에는 URL·제목·`content_hash`(중복 수확 판정용)·집계 수치만 있다.
본문 컬럼을 추가하는 변경은 조용한 실수여선 안 되고 **라이선스 판단을 다시 해야 하는 사안**이다.

**두드러짐은 저장하지 않고 계산한다** — `v_topic_word_salience` 가 배경(다른 모든 주제) 대비
로그오즈비를 Dirichlet 평활로 낸다. 임계값을 바꿀 때 수천 편을 재수확하지 않기 위함이다.
승격 기본값 `doc_freq≥3` · `salience≥1.0`(≈2.7배 과대표집) — 강연 한 편의 특이 어휘가 카테고리를
만들지 못하게 하는 문턱.

**승격 출처 분리** — `dictionary_word_categories.source` CHECK 에 `'corpus-derived'` 추가.
관측 유래 링크만 출처로 골라 되돌릴 수 있고, 기존 `imported` 판정은 덮어쓰지 않는다(RPC 안에서 제외).

---

## Views (7)

| view | 용도 |
|---|---|
| `v_topic_word_salience` | **2026-08-16 신규** — TCP 주제×표제어 두드러짐(배경 대비 로그오즈비). `salience>0` = 그 주제에서 과대표집 |
| `v_text_content` | `texts` + `library_chapters_master` + `content_chunks` JOIN — 워크스페이스 본문 fetch (v06.34: `user_book_group_id` 컬럼 추가) |
| `v_book_extraction_stats` | 도서별 추출 어휘 집계. **v06.35**: 기존 `lemma_*` 5컬럼 + 해석률 5컬럼(`noise_count` · `resolved_other_count` · `unresolved_count` · `resolved_pct` · `learnable_coverage_pct`) |
| `v_book_extraction_reasons` | **v06.35 신규** — 도서별 어휘를 `bound` / `noise_person` / `noise_geo` / `foreign_{lang}` / `dialect_spelling` / `morphology` / `lexicon_only` / `unresolved` 버킷으로 분해 |
| `v_user_book_progress` | 사용자별 도서 진행도 |
| `library_seed_catalog_view` | seed catalog UI 용 가공 |
| `user_vocab_enriched` | 사용자 단어장 + 사전 메타 enriched |

**보안 옵션 (v06.47)**: 5 view 모두 `SECURITY INVOKER` (`ALTER VIEW ... SET (security_invoker = true)`) — 호출자 권한으로 기반 테이블 RLS 적용. SECURITY DEFINER (PG15 default) 의 RLS 우회 위험 차단. Supabase advisor "Security Definer View" 경고 해결 migration `20260614150000_views_security_invoker`.

---

## Functions (요약)

357 함수(`pg_proc` × `nspname='public'` 실측 2026-08-26 — 앞 판의 223 은 낡은 값이었다). 카테고리별:

### 표제어 해석 — 의미 보존 원칙 (v06.35 · 마이그레이션 4건)

| 함수 | 시그니처 | 용도 |
|---|---|---|
| `resolve_dict_headword(p_surface text)` | RETURNS text | 표면형 → 사전 표제어 **5계층** |
| `unresolved_dict_words(p_words text[])` | RETURNS text[] | 해석 실패분만 반환 (pending_words 기록용) |
| `textfit_resolve_levels(p_words text[])` | RETURNS TABLE(surface·headword·v_level) | TextFit 커버리지 — **필터 없음**(아는 단어도 세야 분자가 나온다). STABLE · SECURITY INVOKER · 입력 상한 4000. [20260826102758](../supabase/migrations/20260826102758_textfit_resolve_levels.sql) |

**5계층**: ① 정확 일치 → ② 사전 등재 굴절형(`inflected_forms`) → ③ 규칙 굴절 역생성(`en_inflection_bases`)
→ ④ 의미 보존 파생 접미사 → ⑤ **영/미 철자 변이**.

**의도적으로 해석하지 않는 것** — 전부 실측 근거가 있다:

| 미해석 대상 | 근거 (2026-08-13 실측) |
|---|---|
| `-less` · `-iless` (④에서 **제거**) | `sugarless`→sugar("설탕") · `carbonless`→carbon("탄소") · `leaderless`→leader("지도자") — 뜻이 정반대 |
| 부정 접두사 `un-`/`mis-`/`non-` | 같은 극성 반전 |
| 학술 접두사 `geo-`/`bio-` 등 | `geochemist`→chemist→**"약사"**. 형태론적 부분집합이어도 **어기 다의성**에서 무너짐 |
| 어근 절단 `-ize` | `mineralized`→mineral — 근사 의미만 줌. `mineralize` 는 진성 사전 갭이라 미해결이 옳음 |

⑤ 철자 변이가 필요한 이유: 영국식 표제어에 대응하는 **미국식 철자 214개 누락**
(`-ise` 203 중 137 · `-our` 95 중 52 · `-isation` 48 중 11 · `-logue` 13 중 7 · `-yse` 9 중 7).
`optimize` 는 없고 `optimise` 만 있었다. 철자 변이는 같은 단어라 **의미 위험 0**.

> **원칙**: 틀린 뜻을 주느니 미해결로 남긴다. 해석 실패는 `pending_words` 로 쌓여 사전 확장의
> 근거가 되지만, 뒤집힌 해석은 되돌릴 수 없는 오학습이다.
> 회귀: `apps/web/src/lib/text-extract/__tests__/resolve-headword.integration.test.ts` (20건)

### admin_* (18)

| 함수 | 시그니처 | 용도 |
|---|---|---|
| `admin_enqueue_book(source, source_id, title, ...)` | RETURNS uuid | BulkFetch / ID 입력으로 도서 큐 등록 |
| `admin_requeue_book(p_book_id uuid)` | RETURNS text | 단일 도서 → queued. **pgmq 발행은 트리거가 한다** — 이 함수가 직접 넣는 것은 `이미 queued` 였을 때뿐(그때는 트리거가 발화하지 않는다). 없는 도서는 예외. [20260826103132](../supabase/migrations/20260826103132_admin_requeue_book_single_enqueue.sql) |
| `admin_bulk_set_books_curating(uuid[])` | RETURNS (updated, skipped, sets_deleted, blocked_users, blocked_published) | ready → curating, draft 단어장만 삭제 |
| `admin_bulk_requeue_books(uuid[])` | RETURNS (deleted, skipped, sets_deleted, **seed_unlocked**, blocked_users, blocked_published) | (ready ∪ in_progress) → DELETE library_books (소스 GET 복귀) — v06.34 시맨틱 |
| `admin_delete_book(p_book_id uuid)` | RETURNS table | 실패 도서 영구 삭제 (제한 status) |
| `admin_force_publish_book(p_book_id uuid)` | RETURNS void | cefr_confidence 낮아도 강제 publish |
| `admin_revert_published_book` | — | published 되돌리기 |
| `admin_requeue_article` | — | ACP article requeue |
| `unenroll_library_book(p_book_id uuid)` | RETURNS (texts_deleted, subs_deleted, vocabs_deleted) | 사용자 enroll 해제 (도서 단위 unenroll) |
| 나머지 | … | (admin_bulk_* / admin_pending_* / admin_concerns_* / VRL 분류 등) |

**큐 발행 규칙** — `status` 가 `queued` 로 **바뀌면** 큐에 들어간다 (2026-08-26 실측):

| 트리거 | 시점 | |
|---|---|---|
| `trg_lb_enqueue` | `AFTER INSERT` | 새 도서 |
| `trg_lb_requeue` | `AFTER UPDATE OF status` · `WHEN (NEW.status='queued' AND OLD.status IS DISTINCT FROM 'queued')` | 되살리기 ([20260826102742](../supabase/migrations/20260826102742_lcp_requeue_failed.sql)) |

⚠️ **`WHEN` 절이 없으면 안 된다** — `UPDATE OF status` 는 SET 목록에 status 가 있기만 하면
값이 같아도 발화하므로, 가드가 없으면 queued 행을 건드릴 때마다 중복 메시지가 쌓인다.

⚠️ **함수가 직접 `pgmq.send` 하면 트리거와 겹친다** — 실제로 `admin_requeue_book` 이 그랬고
([20260826103132](../supabase/migrations/20260826103132_admin_requeue_book_single_enqueue.sql)에서
해소), 새 경로를 만들 때 send 를 손으로 붙이면 같은 일이 반복된다. **status 만 바꾸면 된다.**

⚠️ **재큐 전에 묵은 메시지를 치울 것** — 큐는 처리 시점에만 archive 된다. dev 는
`get_lcp_config()` 가 NULL 이라 워커가 early return 하므로 메시지가 쌓인다
(2026-08-26 실측 **572건**). 실패 도서를 되살리면 옛 메시지 위에 새것이 얹혀 같은 도서가
두 번 처리된다 — `archive_book_pipeline_messages(book_id)` 를 먼저 부른다.

### Pipeline RPC

| 함수 | 용도 |
|---|---|
| `process_library_pipeline_batch(p_batch_size int)` | pg_cron worker — pgmq read N → POST /api/lcp/process (dev 환경에선 `get_lcp_config()` NULL → early return 0) |
| `archive_book_pipeline_messages(p_book_id uuid)` | dev-process 후 pgmq archive |
| `auto_curate_book(p_book_id uuid)` | RETURNS 'auto_publish' / 'admin_review' / 'reject' — cefr_confidence 게이트 (0.85 / 0.60) |
| `compute_book_vrl(p_book_id uuid)` | V-Level type-based p75 centroid (v06.34: token → type) |
| `compute_book_cefrj(p_book_id uuid)` | CEFR-J 12-band (internal heuristic) + cefr_band auto |
| `compute_book_coverage(p_book_id uuid)` | 레벨별 기지어 커버리지 (i+1 판정) |
| `backfill_book_lemmas(p_book_id uuid)` | direct-bind / 추출 / percentile 정상화 게이트 |
| `fill_lbv_resolution(p_book_id uuid, p_only_new boolean)` | **v06.35** — `lemma IS NULL` 행에 `lookup_word_meaning` 해석(`resolved_via`/`lang`/`word`) + `noise_kind` 기록. `trg_lbv_fill_lemma` 가 INSERT 시 동일 로직 수행. **v06.36** ([20260813104500](../supabase/migrations/20260813104500_foreign_citation_marking.sql)) — `noise_kind` 에 `'foreign_citation'` 추가 (person/geo_noise 가 우선) |
| `en_inflection_bases(p text)` | 굴절 base 후보. **v06.36** ([20260814113000](../supabase/migrations/20260814113000_inflection_ves_and_ish_derivation.sql)) — `-ves` 복수 규칙 추가(`-f`/`-fe`). 동사 3인칭 `-ves` 와 충돌하므로 **`-ve` base 가 사전에 있으면 후보를 내지 않는다**(`saves→safe`·`caves→cafe`·`serves→serf` 차단). 실측 차단 182 / 통과 28 · 미바인딩 486행 회수 |
| `en_derivational_bases(p text)` | 파생 base 후보 — **재현율 우선**. seed 후보 생성과 진단 `deriv_base` 전용이며 뒤에서 사람/배치가 검수하는 것을 전제로 한다. ⚠️ **`lookup_word_meaning` 의 derivation 티어(12 규칙)와 일부러 분리돼 있다** — 통합하면 `ation→at`·`barant→bar`·`bative→bat` 류 오탐이 학습자에게 그대로 노출된다(ADR 0004 D4). **v06.36** — `-ish` 에 `+e` 복원 추가(`epicurish→epicure`) |
| `is_quoted_foreign_citation(p_sentence text, p_word text)` | **v06.36** IMMUTABLE — `<"인용문" ("번역>` 패턴을 찾아 단어가 인용문에만 있고 번역문에 없으면 true. 닫는 괄호를 요구하지 않는다(`first_sentence` 가 문장 단위라 번역이 잘리는 실측 사례). 전 카탈로그 79권 대상 마킹 17단어/1권 · 오탐 0 |
| `collect_archaic_candidates(p_book_id uuid)` | 미바인딩 단어를 archaic_candidates 로 수집 |
| `classify_archaic_candidates()` | 재출현 게이트 — derivational / inflection / variant 분류 |
| `run_content_quality_gates(p_scope text, p_id uuid)` | 불변식 게이트 (global/dict/book/article/word_set). **v06.35 수정** ([20260812160000](../supabase/migrations/20260812160000_fix_i10_gate_drop_cap40.sql)) — I10 비교 CTE 의 `sort_order<=40` 제거. 발행은 `republish_book_word_sets(p_cap DEFAULT NULL)`=무제한인데 비교만 40위로 잘라 **발행 도서 12권 전부 오탐 FAIL**(P&P 195 = `sort_order>40` 행 수와 일치). 수정 후 8권 PASS · 실드리프트 4권만 잔존. **v06.34 수정** ([20260815120000](../supabase/migrations/20260815120000_i7_phrase_unit_carveout.sql)) — I7 이 `phrase_unit` 을 전 세트 공통 노이즈로 하드코딩해 **구동사·관용어 단어장**(표제어가 곧 구)과 충돌(실측 52건). `curation_query->>'blueprint' = 'phrasal-idiom'` 인 세트의 `phrase_unit` **한 종류만** 면제 — global·word_set 두 scope 를 같이 고쳤다(갈리면 화면과 전역 리포트가 서로 다른 말을 한다). 예외가 유형을 안 가리고 넓어지는 것을 [content-quality-gate.integration.test.ts](../apps/web/src/lib/library/__tests__/content-quality-gate.integration.test.ts) 의 대조 2건(같은 단어 · 유형만 다름 → PASS/FAIL)이 막는다 |

### Dictation RPC (v07 · `20260812150000`)

모두 `security invoker` + `auth.uid()` 기준 — 파라미터로 남의 기록을 볼 수 없다.

| 함수 | 용도 |
|---|---|
| `dictation_overview()` | 허브 요약 jsonb — `streak`(받아쓰기 자체 연속일, KST 기준 · 오늘 미실시면 어제부터 계산 · 상한 400) · `span`(최장 무힌트 100% 문장 단어 수) · `weekly_accuracy` · `total_sentences` · `total_sessions` · `best_accuracy` |
| `dictation_weakness(p_days int default 14)` | 오류 태그 빈도 Top6 + 태그별 최근 예시 1쌍 (`error_tags` unnest 집계) |
| `dictation_recent_misses(p_limit int default 5)` | 최근 30일 정확도 85% 미만 문장(문장별 최신 1건) — 오늘의 받아쓰기 '재도전' 슬롯 원천 |

### VRL RPC

| 함수 | 용도 |
|---|---|
| `analyze_diagnostic_result` / `analyze_and_apply_diagnostic_result` | base V-Level 진단 분석 + apply (snapshot + Krashen i+1) |
| `analyze_track_diagnostic_result` / `analyze_and_apply_track_diagnostic_result` | track 진단 (csat/biz/academic) |
| `analyze_and_apply_comprehensive_diagnostic_result` | 4축 동시 분석 (base + 3 tracks) |
| `recommend_word_sets_for_user(uuid, text[])` | 6-tier 추천 (primary/stretch/review + track + specialty + book_iplus1: lexical_coverage 85~95% 도서 입문 챕터 세트, v06.129). **v06.34 수정** ([20260815150000](../supabase/migrations/20260815150000_recommend_by_blueprint.sql)) — 슬러그 하드코딩(`auto-vlevel-v*`·`etymology-core`·`kice-%`) 때문에 컴포저 발행 29세트가 hub 추천에 **하나도 뜨지 않았다**. 판정 근거를 `curation_query.blueprint`·`recipe.select.filters.v_level_*`·`source_book_id` 로 옮겨 7블록 추가(composer_level·track ×3·etymology·unlock·uncovered). 새 유형이 늘어도 추천이 따라온다. 함께: `DISTINCT ON (set_id)` 중복 제거 + `LIMIT 8`(화면이 전량 렌더하므로 여기서 막는다). 회귀 [recommend-blueprint.integration.test.ts](../apps/web/src/lib/library/__tests__/recommend-blueprint.integration.test.ts) 5건 |
| `auto_promote_v_level_for_user(uuid)` | i+1 zone ≥20 mastered → V+1 |
| `auto_promote_track_level_for_user(uuid, text)` | track promote (threshold 15) |
| `cron_auto_promote_all_users()` | pg_cron 새벽 03 KST 일괄 promote |

### Workflow / RLS Helper

| 함수 | 용도 |
|---|---|
| `is_admin_or_curator()` | RLS / SECURITY DEFINER 게이트 |
| `get_lcp_config()` | vercel_base_url + internal_token (dev 환경에선 NULL) |
| `enroll_library_book(p_book_id uuid)` | 사용자 enroll + 챕터 단어장 auto-subscribe + vocabulary auto-import |
| `extract_vocabulary_for_user(uuid, text[], text)` | Phase 3A 다축 추출 — user/text/auto level 선택 + composite scoring |
| `publish_book_word_sets(p_book_id uuid)` | 챕터 단어장 일괄 발행 trigger (L1 후보 풀, `p_cap` 기본 40) |
| `maintain_reference_stats()` | **읽기 전용 참조 테이블 ANALYZE**(화이트리스트 10종, `statement_timeout=0`). 사전 계열은 갱신이 없어 **autoanalyze 가 영원히 안 돈다** — `shared_dictionary`(219MB)가 `n_live_tup=0` 으로 방치돼 플래너가 계획을 잘못 세웠고 120권 배치의 83번 이후 37건이 연속 타임아웃했다. 대량 적재·사전 갱신 후 필수 |
| `audit_book_extraction(p_book_id uuid)` | 도서 1권의 결함 6종 계산 → `book_extraction_audit` 저장(멱등). 전수 뷰가 300권에서 타임아웃해 **증분으로 전환** |
| `books_needing_audit(p_limit int)` | 미감사/낡은 도서 목록 — 증분 감사 배치(`scripts/lcp/audit-books.mjs`)의 입력 |
| `deliver_chapter_vocab(p_book_id uuid, p_chapter_idx int)` | **L2 개인화 전달**(읽기 전용, ADR 0004 D7) — L1 풀에서 기보유 제외 + i+1 가우시안 재랭킹 + 밀도 기반 분량 `clamp(round(wc/1000×8), 8, 30)` |
| `commit_chapter_vocab(p_book_id uuid, p_chapter_idx int)` | 위 결과를 `vocabularies` 에 담는다(멱등). **삽입 건수 반환** — 쓰기를 별도 함수로 둔 이유는 `RETURNS TABLE(word …)` 의 출력 파라미터가 `INSERT … ON CONFLICT (user_id, word)` 와 이름 충돌(42702)을 일으켜서다 |
| `en_inflection_bases(text)` | 규칙 역굴절 후보 배열. `-men → -man` 은 그 형태가 사전 표제어일 때만 `-en` 규칙을 밀어낸다 (`seamen`→seaman ○ / `becomen`→become 보존) |

---

## Critical FK & Cascade 정합

도서 큐레이션 사이클의 핵심 cascade:

```
library_books (DELETE)
  ├─→ library_book_vocabularies (CASCADE)
  ├─→ library_chapters_master (CASCADE)
  ├─→ library_seed_catalog.imported_book_id (SET NULL — seed unlock!)
  ├─→ user_word_set_subscriptions.source_book_id (SET NULL)
  ├─→ echo_match_sessions.library_book_id (SET NULL)
  ├─→ archaic_candidates.first_seen_book_id (SET NULL — v06.34)
  └─→ texts.library_book_id (NO ACTION — RPC 안전 가드로 차단)

shared_word_sets (DELETE)
  ├─→ shared_words (CASCADE)
  └─→ user_word_set_subscriptions (CASCADE)

vocab_runs (DELETE)
  └─→ vocab_seed_candidates (CASCADE)
       ├─→ vocab_dict_hits (CASCADE)
       └─→ vocab_enrichment_queue (CASCADE)
            ├─→ vocab_curation_decisions (CASCADE)
            └─→ shared_words.source_queue_id (SET NULL — cast-2000 lineage)
```

---

## ENUM / CHECK constraints (선별)

```sql
-- module_id ENUM (실측 2026-08-14: 29 값 — 학습 모듈 9 + 아케이드 19 + echo)
CREATE TYPE module_id AS ENUM (
  'flashcard','spellforge','wordblitz','pairflip',
  'scriptquiz','dictation','wordvault','workspace','textviewer',
  'pirate-quest'
  -- … 아케이드 19종 …
  -- 'echo'  ← 20260814090000. EchoMatch 를 청각 면(F3) 기록 경로로 잇는다.
  --           **기록만 남기고 FSRS 카드는 안 움직인다** (문장이 화면에 떠 있으므로
  --           발화 모방이지 인출이 아니다 — apps/web/src/lib/echo/word-signal.ts).
  -- ⚠️ Postgres 는 enum 값 DROP 을 지원하지 않는다 — 'pirate_quest' 가 0행인 채 남아 있는 이유.
);

-- text_source ENUM
CREATE TYPE text_source AS ENUM ('library','direct-script','direct-file','shared-set');

-- library_books.status TEXT CHECK
'queued','ingesting','normalizing','segmenting','analyzing','curating',
'ready','published','archived','failed',
-- + 세분화 실패: fetch_failed / preview_failed / ingest_failed / enrich_failed

-- texts.user_book_group_id mutual exclusive (v06.34)
CONSTRAINT texts_book_group_exclusive
  CHECK (library_book_id IS NULL OR user_book_group_id IS NULL);

-- texts.cefr_level (A1-C2)
-- vocabularies.difficulty REAL CHECK BETWEEN 1.0 AND 10.0
-- learning_records.rating SMALLINT CHECK BETWEEN 1 AND 4 (FSRS)
-- user_profiles.role text DEFAULT 'user' (admin / curator / user)
-- user_profiles.theme TEXT CHECK ('light','dark','system')
-- user_profiles.locale TEXT CHECK ('ko','en')
-- shared_word_sets.category TEXT CHECK (8 enum)
-- vrl_diagnostic_tests.test_type TEXT (base_v_level / track / comprehensive)

-- shared_dictionary.classified_by TEXT CHECK — 생성 주체 화이트리스트 (v06.36 에 opus_5 추가)
'rule_v1','claude_code_opus_4_7','claude_code_sonnet_4_6',
'claude_code_derivational','claude_code_opus_4_8','claude_code_fable_5',
'claude_code_opus_5'
-- 새 모델로 드레인하려면 이 목록을 먼저 넓혀야 한다 (안 넓히면 INSERT 가 23514 로 막힌다)
-- ⚠️ NULL 도 CHECK 를 통과한다 — 그래서 `classified_by` 를 빠뜨린 INSERT 는 조용히 성공한다.
--    `resolve_dict_headword()` 는 L1~L5 **모든 경로**에서 `classified_by IS NOT NULL` 을 요구하므로
--    그 행은 사전에 존재하되 학습자 해석에는 한 번도 잡히지 않는 유령이 된다.
--    실제 발생: [20260815090000](../supabase/migrations/20260815090000_ngsl_top2000_basic_gaps.sql) 이
--    기초어 11종을 넣고도 해석 0건이었고 [20260815082641](../supabase/migrations/20260815082641_ngsl_basic_gaps_set_classified_by.sql) 로 보정.
--    **shared_dictionary 에 행을 넣는 모든 경로는 classified_by 를 함께 쓴다.**

-- noise_blacklist.category TEXT CHECK
'foreign_word','archaic_grammar','interjection_noise','proper_noun_marker','corrupt_token'
```

---

## RLS 정책 요약

모든 사용자 데이터 테이블 (`texts`, `vocabularies`, `learning_records`, `scores`, `dictation_*`, `echo_match_*`, `user_*`, `achievements`, `daily_activity`, `user_word_set_subscriptions`):

```sql
CREATE POLICY "own data" ON {table}
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

공용 자원 (`shared_word_sets`, `shared_words`, `shared_dictionary`, `dictionary_*`, `library_*`, `vocaflow_*`):
- 모든 인증 사용자 SELECT 가능
- INSERT/UPDATE/DELETE 는 admin/curator 만 (SECURITY DEFINER RPC + `is_admin_or_curator()`)

### 발행 세트는 원본 발행 상태를 상속한다 (v06.35 · [20260813110729](../supabase/migrations/20260813110729_word_set_rls_inherit_source_gate.sql))

`shared_word_sets` / `shared_words` 의 SELECT 정책은 `is_published` 만으로는 부족하다 —
소스 종속 세트(`library_book` · `library_article`)는 **원본이 발행됐는지**까지 본다.

```sql
is_published AND (
  category NOT IN ('library_book','library_article')
  OR (category='library_book'    AND EXISTS(SELECT 1 FROM library_books    b
        WHERE b.id::text = curation_query->>'book_id'
          AND b.status='published' AND b.copyright_safe_in_kr))
  OR (category='library_article' AND EXISTS(SELECT 1 FROM library_articles a
        WHERE a.id::text = curation_query->>'article_id'
          AND a.status='published' AND a.copyright_safe_in_kr))
)
```

**왜** — 이전 정책(`is_published` 단독)에서는 UI 3경로가 전부 막던 세트가 **공개 anon 키로는 읽혔다**.
실측: 미발행 도서 27권의 발행 세트 587개(20,907단어)가 anon 조회로 반환됐다(같은 키로 `library_books`
행 자체는 0 — 책은 막히는데 그 책의 단어장은 열려 있었다). `subscribeSet` 도 `is_published` 만 봐서
set id 만 알면 구독됐다. **화면 게이트는 노출 경계의 증거가 아니다.**

- 기준선은 `applyBookReadGate`(status only) — 카탈로그 게이트의 `published_at IS NOT NULL` 은
  요구하지 않는다([publish-gate.ts](../apps/web/src/lib/library/publish-gate.ts) 가 "카탈로그 ≠ 열람" 을 의도적으로 분리).
- ⚠️ 두 정책의 조건은 **같아야 한다**. 한쪽만 고치면 세트는 가려지는데 단어는 읽힌다.
- 적용 실측: anon 가시 세트 도서 993 → **406** · 아티클 135 유지 · 기타 176 무영향 ·
  service_role 1,169 전부 유지. 기존 구독 71건은 admin 계정이라 영향 0.
- 회귀: [word-set-rls.integration.test.ts](../apps/web/src/lib/library/__tests__/word-set-rls.integration.test.ts) 8건 (anon/service/일반 학습자 실조회).

#### ⚠️ RLS 만으로는 반쪽 — DEFINER RPC 는 별도로 게이트해야 한다 ([20260814024656](../supabase/migrations/20260814024656_rpc_inherit_book_gate.sql))

`SECURITY DEFINER` 함수는 정의자 권한으로 돌아 **RLS 를 통째로 우회한다**. 위 정책을 적용한
뒤에도 일반 학습자(role=user)가 `deliver_chapter_vocab(미발행 Dialogues, ch10)` 를 부르면
**단어 30개가 그대로 나왔다**(같은 세트를 PostgREST 로 조회하면 0행). 같은 데이터에 문이 둘이다.

| 함수 | 문제 | 조치 |
|---|---|---|
| `deliver_chapter_vocab` | 원본 발행 여부 미검사 | pool WHERE 에 `EXISTS(library_books … published+kr_safe)` → **0행 반환**. RAISE 금지 — 호출부가 "0행 = 단어장 없는 도서" 로 읽고 폴백을 탄다 |
| `_enroll_book_subscribe_word_sets` | `p_user_id` 를 **호출자가 지정**하는 DEFINER 쓰기 함수인데 anon·authenticated 에 EXECUTE 부여 → 남의 계정에 구독·단어 주입 가능 | `REVOKE EXECUTE`. 정당한 호출자 `enroll_library_book` 은 DEFINER 라 무영향 |
| `subscribe_article_word_set` | 글 발행 여부 미검사 (현재 135/135 발행이라 노출 0) | `display_only` 와 같은 계약으로 조용히 `RETURN` |

**새 DEFINER 함수를 만들 때 점검**: 그 함수가 읽는 테이블의 RLS 에 원본 발행 조건이 있다면,
같은 조건을 함수 본문에도 **직접** 넣어야 한다. RLS 는 DEFINER 를 지켜 주지 않는다.

`reports`: 본인 INSERT/SELECT, admin UPDATE. ⚠️ 단 테이블이 실재하지 않는다(§요약 드리프트 표 참조).

---

## 최근 마이그레이션 (20개)

```
20260830140000  textbook_volume_renders                    ← TBP 조판 기록(권당 1행 · admin 읽기). 아래 참조
20260822013136  dictionary_categories_public_read           ← 분류 트리 anon 읽기(is_active 만)
20260822090000  textbook_shelf_sources                     ← 지문 출처 집계 + 교육과정 어휘 개수 (둘 다 anon 실행 가능)
20260821140000  user_textbook_selections                   ← 내가 고른 교재(step 번호만). RLS 본인 전용
20260821120000  textbook_shelf_inventory                   ← 학습자용 재고 집계 RPC (테이블은 admin 전용 유지)
20260815020000  close_client_writable_gaps                 ← 🔴 고아 테이블 anon 개방 + 초대코드 우회 (아래 참조)
20260814150000  user_profiles_privilege_escalation_guard   ← 🔴 권한 상승 차단 (아래 참조)
20260813090000  scores_content_ref                         ← v07 "어떤 자료로 학습했나" (프레임워크 Phase 1)
20260812150000  dictation_persistence                      ← v07 받아쓰기 영속화 (2 table + 3 RPC)
20260608222931  v_text_content_user_book_group_v2          ← v06.34
20260608222229  texts_user_book_group_id
20260608221508  book_curation_jobs
20260607014233  improve_library_seed_dedup_key_first_author_surname
20260607010118  archaic_candidates_first_seen_book_set_null
20260607005258  admin_bulk_return_to_source                ← DELETE 시맨틱
20260606231723  admin_bulk_book_rollback_cascade
20260606225815  admin_bulk_book_status
20260606142006  add_library_books_cover_image_url
20260606140316  unenroll_library_book
20260606020213  unify_book_vocab_selection
20260606003450  drop_unused_indexes
20260605235722  add_library_books_librivox_audio
20260605234511  reattach_publish_book_word_sets_trigger
20260605154321  enroll_book_auto_subscribe_word_sets
20260604221512  copyright_gate_us_license
20260604142316  add_simple_wikipedia_source
20260603154813  drop_unused_and_duplicate_indexes_v06_34
20260603145827  extract_book_vocab_cache_fastpath
20260603143502  find_unbound_perf_prefilter
```

전체 누적 115건 (파일 기준 실측 2026-06-28). 디렉토리: `supabase/migrations/`. (최신: `20260628220000_p1_plan_weekday_per_item` — study_plan_items weekdays int[] 추가 + study_plan_schedule DROP(요일을 항목별로·시간 제거) · 직전: `20260628210000_p1_plan_rich_compose`)

v06.140 이후 추가: `20260706000000_admin_collect_quality_metrics` — `admin_collect_quality_metrics()` RPC(SECURITY DEFINER, role='admin' 검사 후 `collect_quality_metrics()` 위임, EXECUTE→authenticated). `/admin/quality` 수동 수집 버튼용.

v06.35: `collect_quality_metrics()` 에 **M7 SSoT 드리프트** 추가 ([20260814015130](../supabase/migrations/20260814015130_quality_metrics_ssot_drift.sql)) —
`published_set_ssot_drift_books` · `_words` 2행(stage=publish). 발행 도서의 발행 세트를 현
`select_book_chapter_vocab` 결과와 대칭차집합으로 비교한다(I10 과 같은 정의). `dims.drifted` =
`{도서명: 건수}`. **왜 필요했나** — I10 은 `run_content_quality_gates('book', id)` 에만 있어
전역 게이트에도 `/admin/quality` 에도 뜨지 않았고, 그래서 발행 도서 전권이 어긋난 채 몇 주가 갔다.
비용: 도서당 추출 1회 — 발행 12권 기준 수집 전체가 9행/즉시 → **11행/21.9초**로 늘어난다(야간 03:10).
⚠️ 드리프트 서브쿼리는 **temp table 로 1회만** 평가할 것 — CTE 로 두면 outer 참조 수만큼 재실행돼
19초가 37.9초가 된다(`EXPLAIN ANALYZE` 로 SubPlan 2개 확인).

---

### TBP 조판 기록 ([20260830140000](../supabase/migrations/20260830140000_textbook_volume_renders.sql))

`textbook_volume_renders` — **교재 한 권을 조판했다는 사실**을 남긴다. `band` 가 PK 라 권당 한 행이고,
`render-volume.mjs` 가 다시 돌 때마다 **덮어쓴다**(재실행 안전 — 열 번 찍어도 행이 안 늘고
`render_count` 만 오른다).

왜 필요했나: 브랜딩(`packages/library-pipeline/src/textbook/brand.ts` — 팔레트·서체·판권면)과
조판기는 코드로만 있었고 결과는 `--out volume-v5.html` 로컬 파일이라, `/admin/textbook` 이 읽을
레코드가 **하나도 없었다.**

| 컬럼 | 무엇 |
|---|---|
| `band` (PK) | 사다리의 한 권 = V-Level (`SERIES_SPINE`) |
| `volume_title` · `step` · `school_band` | 판권면에 실린 그대로 |
| `units` · `items` | 단원 수 · 인쇄된 문항 수 |
| `auto_passed` / `auto_total` · `failed_checks` | 자동 검수. **떨어진 항목의 이름까지** 남긴다 |
| `explained_batch` · `explained_rule` | 해설 출처별 수. 없음 = `items` − 둘의 합 |
| `type_mix_fit` | 시중 밀도 대비 적합도(0~1). 못 쟀으면 **NULL** — 0 으로 뭉개지 않는다 |
| `distinct_volumes` | 겹치지 않게 줄 수 있는 권수. 원글을 안 쓰는 권(초등 3종)은 **NULL**(20260830141000) |
| `articles_with_items` · `articles_idle` | 문항이 붙은 원글 / 안 붙은 원글(20260830230000). 조판이 세는 재고는 앞의 것이고, 뒤의 것이 0 이 아니면 **집필보다 `store-new-types --band N` 이 먼저**다 |
| `brand_fingerprint` | `brandFingerprint()` — 조판 CSS 변수 + 서체 스택의 8자리 해시 |
| `colophon` (jsonb) | 판권면 전체 |

⚠️ **색을 저장하지 않는다.** 값의 정본은 `@vocaflow/design-tokens` 하나이고, 기록은 "언제 규격의
것이냐" 만 안다. 토큰이 바뀌면 지문이 달라져 화면이 그 권을 **"옛 규격 — 재조판"** 으로 표시한다.

RLS: `SELECT` 는 `is_admin_or_curator()`. 쓰기 정책은 없다 — 조판기(service role)만 쓴다.

---

### 내가 고른 교재 ([20260821140000](../supabase/migrations/20260821140000_user_textbook_selections.sql))

```
user_textbook_selections (user_id uuid, step smallint, selected_at timestamptz)
  PK (user_id, step) · FK user_id → auth.users ON DELETE CASCADE
  CHECK step BETWEEN 1 AND 99
  RLS ON · 정책 1개: "own textbook selections" FOR ALL USING/WITH CHECK (auth.uid() = user_id)
```

**step 번호 하나만 저장한다.** 권의 제목·학령·V레벨·유형은 `SERIES_SPINE`(코드,
`packages/library-pipeline`)이 소유하므로 복사하지 않는다 — 복사하면 시리즈를 고칠 때
DB 가 낡은 이름을 계속 말한다("눈금이 둘이면 갈린다").

기존 표를 재사용하지 않은 이유(먼저 재 봤다):
- `study_plan_items` — `material_type` CHECK 가 `book|article|word_set|script` 4종이고
  `material_id` 가 **uuid** 다. 교재 권은 DB 행이 아니라 step 번호라 넣을 uuid 가 없다.
- V-Level 자동 매칭 — 실측(2026-08-21) 전 계정 `current_v_level` 이 0(미진단) 2명 · 11 1명.
  **V1~V7 에 아무도 없고** 시리즈는 V8+(성인)을 일부러 제외한다. 동작하지도 않고 "선택" 도 아니다.

되돌리기: `DROP TABLE public.user_textbook_selections;` 하나. 다른 표를 건드리지 않는다.

## DB 사이즈 현황 (v06.34 VACUUM FULL 후, 2026-06-08)

| 카테고리 | 사용 | 비고 |
|---|---:|---|
| 전체 DB | **350 MB** | (이전 606 MB → 42% 감소) |
| shared_dictionary | 183 MB | 마스터 사전 (45,292 row · 100% meaning_ko) |
| shared_words | 46 MB | 공용 단어장 |
| library_book_vocabularies | 39 MB | VACUUM FULL 후 (233→39) |
| content_chunks | 13 MB | (58→13) — orphan 정리 + TOAST |
| archaic_candidates | 9.5 MB | (21→9.5) |
| dictionary_word_categories | 7.7 MB | M:N 28k 매핑 |

---

## 검증 방법

본 문서의 사실은 다음 SQL 로 재현 가능 (Supabase MCP `execute_sql`):

```sql
-- 테이블 + row + size
SELECT c.relname, s.n_live_tup, pg_size_pretty(pg_total_relation_size(c.oid))
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
LEFT JOIN pg_stat_user_tables s ON s.relid=c.oid
WHERE c.relkind='r' AND n.nspname='public' ORDER BY c.relname;

-- 함수 카운트
SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public';

-- 마이그레이션 이력
SELECT version, name FROM supabase_migrations.schema_migrations
ORDER BY version DESC LIMIT 20;
```

## PDCP — 퍼블릭도메인 스캔 만화 (2026-08-09)

**CCP(`comic_books`/`comic_pages`)와 완전 별도 테이블.** 왜 합치지 않았나: PDCP 는 발행 전에
**저작권 근거를 사람이 입증**해야 하고 CCP 는 그럴 필요가 없다. 한 테이블에 조건부 게이트를
얹으면 판별 컬럼 하나가 틀리는 순간 게이트가 통째로 무너진다.

| 테이블 | 키 | 비고 |
|---|---|---|
| `pd_comic_issues` | `slug` unique · `(source_adapter, source_identifier)` unique | 호 헤더 + 파이프라인 상태 + 발행 게이트 |
| `pd_comic_panels` | `(issue_id, panel_order)` | 컷 단위 이미지 + 말풍선 jsonb |
| `pd_comic_kinds` | `key` PK | **유형 마스터 12행** — 어휘 도메인 축 + `learner_note`(팝업이 읽음) |
| `pd_comic_series` | `key` PK · `kind` FK | **시리즈 마스터** — 행은 `ingest-bulk.mjs` 가 규칙표에서 upsert |

### 분류 축 ([20260816200000](../supabase/migrations/20260816200000_pd_comic_taxonomy.sql))

`pd_comic_issues.kind` · `series_key` (둘 다 FK). 자유 텍스트 `series_title` 은 **원본 표기 보존용**으로 남긴다.

왜 필요했나: 원본 제목이 `Fawcett Comics: Whiz Comics 022 (b and w) (coverless)` 처럼 들어와
자유 텍스트 한 칸으로는 같은 시리즈가 표기마다 갈렸다 — **실측 1,020건에서 자유 텍스트 값 168개 vs 실제 시리즈 90개.**

분류 정본은 `scripts/comic/pd/taxonomy.mjs` 의 **순서 있는 규칙표**(휴리스틱 금지 — 우연히 맞는 것과
규칙으로 맞는 것을 구분할 수 없으면 조용히 갈라져도 모른다). `kind` FK 가 규칙표↔DB 드리프트를
**적재 시점에 실패**시킨다. 파생 카운터(`issues_total`)는 **컬럼으로 두지 않고** RPC 에서 집계한다.

실측 적재(2026-08-16): **969호 · 101시리즈 · 10유형 · 미분류 0**.

### 상태 (`pd_issues_status_chk`)

`queued → acquired → restored → segmented → ocr → [modernized] → review → published` (+ `archived`).

`modernized` 는 **선택 단계**다 — 드레인 체인에 없고 별도 트리거(`/api/pdcp/modernize`)로만 들어간다.
건너뛸 수 있고(ocr→review 직행이 기본), 산출물은 `panels/` 를 덮지 않고 `modern/` 에 따로 쓴다.

`failed` 는 CHECK 에 남아 있지만 **드레인이 쓰지 않는다** — status 를 덮으면 어느 단계에서
멈췄는지가 사라져 재시도 지점을 복원할 수 없기 때문. 실패는 `last_error` 로만 표시하고
단계는 보존한다(재시도 = `last_error` 를 NULL 로).

### 발행 게이트 (`pd_issues_publish_gate`)

```
status <> 'published' OR (pd_basis IS NOT NULL AND pd_checked_at IS NOT NULL
                          AND pd_checked_by IS NOT NULL AND source_url IS NOT NULL)
```

근거·검증자·시각·출처URL 없이는 **DB 가 발행을 거부한다**. 애플리케이션 검증이 아니라 제약이다.

### PD 근거 토큰 (`pd_issues_basis_chk`)

`term-expired` · `no-renewal` · `explicit-license` (+ 레거시 `pre-1929`).

`pre-1929` 처럼 연도를 박은 토큰은 **매년 1월 1일에 거짓**이 된다(2026-01-01 부로 1930년물도 PD).
연도 상한은 코드의 `PD_YEAR_CUTOFF` 한 곳에만 둔다.

### 어댑터 (`pd_issues_adapter_chk`)

`internet-archive` · `browser-assist` · `local-dir` · `iiif`.

### 현대화 기록

`modernize_track`(preserve=CPU 보존 / restyle=모델 재작화) · `modernize_model` · `modernize_env`.

**restyle 이면 모델·환경이 반드시 남는다**(CHECK 강제) — 없으면 어느 모델 산출물인지
나중에 알 방법이 없어 재현도 라이선스 감사도 불가능하다.

CCP 의 `comic_gen_runs` 를 PDCP 도 쓴다: `library_book_id` 를 nullable 로 완화하고
`pd_issue_id` 를 추가, 둘 중 하나는 반드시 있어야 한다(앵커 없는 고아 run 차단).

### 관측 컬럼

`last_error` · `last_run_at` · `attempts` · `acquire_pages`(테스트 모드 — NULL 이면 전권).
큐 부분 인덱스 `pd_issues_queue_idx (status, created_at) WHERE status IN (미완 5단계)`.

### 학습자 RPC (SECURITY DEFINER · 발행 게이트)

`list_pd_comic_shelf()` · `list_pd_comics(p_series_key)` · `select_pd_comic(slug)` ·
`select_pd_comic_info(slug)` · `select_pd_comic_provenance(slug)`.

**같은 호의 여러 스캔본은 보이는 지점에서만 접는다** ([20260817120000](../supabase/migrations/20260817120000_pd_comic_dedupe_scans.sql)).
실측 969건에 **32그룹·36행**이 중복이다(`atomic-war #3` 3본 · `whiz-comics #2` 원본/Millennium reprint/legal notice).
전부 `(adapter, identifier)` 가 달라 유니크 제약에 안 걸린다 — **다른 파일이지만 같은 만화**다.
지우지 않는 이유: 어느 스캔이 온전한지는 취득해 봐야 안다(coverless·흑백·페이지 수가 제각각).
그래서 파이프라인에는 전부 남기고 학습자 RPC 3개에서만 `DISTINCT ON (series_key, coalesce(issue_no::text, id::text))`
로 호당 1본(컷 많은 순 → 먼저 등록 순)을 고른다. ⚠️ `coalesce(…, id)` 가 핵심 —
NULL 은 `DISTINCT ON` 상 서로 같게 취급돼 **번호 없는 별책 75건이 한 권으로 사라진다**.
권수 집계도 같은 기준이어야 한다(카드가 "9권"인데 열면 4권이면 그 숫자는 거짓말이다).

- `list_pd_comic_shelf()` — **유형 → 시리즈** 평면 행(발행본 있는 것만). 화면이 접는다(`foldShelf`).
- `list_pd_comics(p_series_key)` — ⚠️ 20260816200000 에서 **반환 컬럼이 늘어 drop 후 재생성**했다.
  무인자 오버로드를 남기면 `list_pd_comics()` 호출이 42725 ambiguous 로 죽으므로 함께 삭제한다.
- `select_pd_comic_info(slug)` — 학습자 콘텐츠 정보 팝업(서지 + 유형 학습노트 + 출처·PD 근거 + 대사 수).
  출처·근거를 학습자에게 **내보이는 것이 요건**이다 — 숨기면 정당한 PD 콘텐츠가 해적판처럼 보인다.

RLS 는 `status='published'` 읽기만 허용하고, 컷은 **부모 호의 발행 상태**를 따른다
(`EXISTS (SELECT 1 FROM pd_comic_issues i WHERE i.id = issue_id AND i.status='published')`).
anon 세션으로 실측 검증: 미발행 호 0건 노출.

---

## 🔴 user_profiles 권한 상승 차단 ([20260814150000](../supabase/migrations/20260814150000_user_profiles_privilege_escalation_guard.sql))

**실측한 결함** (2026-08-14, anon key 만으로 재현). RLS 정책 `"own data"` 가
`FOR ALL / USING (auth.uid() = user_id)` 라서 컬럼 구분이 없었다. 로그인한 일반 사용자가
브라우저에서 한 줄로 스스로 관리자가 됐다:

```js
await supabase.from('user_profiles').update({ role: 'admin' }).eq('user_id', <본인>)
// error NONE → role: 'user' → 'admin'
```

승격 직후 `profiles_admin_read` → `is_admin()` 이 통과해 **전 사용자 프로필이 열렸고**,
`is_admin()`/role 검사에 걸린 **RLS 정책 24개**(`library_books` · `comic_*` ·
`book_curation_jobs` · `library_seed_catalog` 등)의 쓰기 권한과 `/admin/*` 전 화면이 열렸다.
같은 경로로 `status='suspended' → 'active'` 자가 해제도 됐다.

**방어 2겹**

| 층 | 수단 | 성격 |
|---|---|---|
| 1차 | 컬럼 단위 `GRANT` — `REVOKE INSERT,UPDATE,DELETE FROM anon, authenticated` 후 설정 컬럼 17개만 `GRANT UPDATE` | Postgres 엔진이 RLS 앞단에서 차단. 정책이 바뀌어도 뚫리지 않는다 |
| 2차 | `guard_user_profiles_privileged_columns()` BEFORE UPDATE 트리거 | `GRANT` 가 되돌려져도 남는 안전망. `role`·`status`·`user_id` 변경 시 `42501` |

- **트리거는 반드시 SECURITY INVOKER**(기본). `DEFINER` 로 만들면 `current_user` 가 함수
  소유자(postgres)로 바뀌어 판정이 **항상 통과**한다 — 방어가 조용히 무력해진다.
- 통과 조건은 `current_user NOT IN ('anon','authenticated')` — service_role · 마이그레이션 ·
  SECURITY DEFINER RPC 는 그대로 동작한다.
- `DELETE` 는 주지 않는다. 프로필만 지우면 `auth.users` 는 남아 계정이 반쪽이 되고,
  미들웨어의 프로필 조회가 null 이 되어 **정지 판정까지 무력화**된다.

**적용 전 안전성 실측** — 앱/스크립트에 `user_profiles` 직접 INSERT/UPDATE/UPSERT **0건**,
쓰는 함수 6개(`handle_new_user` · `apply_diagnostic_result` · `update_user_v_level` ·
`auto_promote_track_level_for_user` · `analyze_and_apply_track_diagnostic_result` ·
`analyze_and_apply_comprehensive_diagnostic_result`)는 **전부 SECURITY DEFINER + owner=postgres**
라 컬럼 ACL 을 우회한다. 진단·레벨 승급 파이프라인 영향 없음.

**회귀 락** — `apps/web/src/lib/auth/__tests__/privilege-escalation.integration.test.ts`
(실 DB 에 anon key 로 붙어 공격 6종 + 정상 self-service 2종). 이 테스트가 실패하면
"테스트를 고치지" 말고 **권한을 원복**할 것.

---

## 클라이언트 쓰기 표면 스윕 ([20260815020000](../supabase/migrations/20260815020000_close_client_writable_gaps.sql))

위 `user_profiles` 결함이 **한 건짜리 사고가 아닐 수 있다**고 보고 public 스키마 전수를 훑었다.

**스윕 쿼리** (같은 계열 결함을 다시 찾을 때 그대로 재사용할 것):

```sql
-- ① RLS 자체가 꺼진 테이블 (결과 0건이어야 한다)
select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' and not c.relrowsecurity;

-- ② 클라이언트 역할에 쓰기를 허용하면서 조건이 느슨한 정책
select tablename, policyname, cmd, roles::text, qual, with_check
from pg_policies
where schemaname='public'
  and cmd in ('ALL','INSERT','UPDATE','DELETE')
  and (roles::text[] && array['public','anon','authenticated'])
  and (qual = 'true' or qual is null or with_check = 'true');
```

**실측 결과 (2026-08-15)**

| 대상 | 판정 |
|---|---|
| RLS 미적용 테이블 | **0건** — 87 테이블 전부 활성 |
| `shared_dictionary` `FOR ALL qual=true` | ✅ 정상 — `{service_role}` 로 한정. `authenticated` 는 SELECT 정책뿐이라 GRANT 가 열려 있어도 RLS 가 쓰기를 막는다 |
| `sw_players` · `sw_comments` · `st17_timetables` | 🔴 **`FOR ALL TO anon USING(true)`** — 아래 참조 |
| `class_members.cm_self_join` | 🔴 초대코드 우회 — 아래 참조 |

### 🔴 고아 테이블 3종이 전 인터넷에 열려 있었다

`sw_players` · `sw_comments` · `st17_timetables` 는 **이 제품 코드가 전혀 참조하지 않는다**
(생성물 `packages/types/src/database.ts` 외 참조 0건 — 같은 인스턴스를 쓰던 다른 실험의 잔여물).
정책이 `FOR ALL TO anon USING(true) WITH CHECK(true)` 였고, anon key 는 브라우저 번들에 그대로
들어 있으므로 사실상 공개였다. 실측으로 **`sw_players.pass_hash` 를 anon key 만으로 읽어냈다**(해시 16자 확인).

→ 정책 제거 + `REVOKE ALL FROM anon, authenticated`. **테이블은 DROP 하지 않았다** —
데이터 삭제는 소유자 확인이 필요한 별도 결정이다. service_role 접근은 유지.

### 🔴 class_members — 초대코드를 우회한 직접 가입

`cm_self_join` 이 `WITH CHECK (user_id = auth.uid())` 로만 막아, 클래스 존재 여부도 초대코드도
보지 않고 **role 을 직접 적어 넣을 수 있었다**. class_id(UUID)만 알면 남의 클래스에 스스로
들어가고(`classes_member_read` → `is_class_member()` 로 클래스가 열린다) `role='teacher'` 로 기록됐다.

- 다행히 `is_class_teacher()` 는 `classes.teacher_id` 를 보므로 **교사 권한 자체는 넘어가지 않았다**.
- 앱의 유일한 가입 경로는 `join_class_by_code(p_code)`(SECURITY DEFINER → RLS 우회, invite_code
  검증 + `role='student'` 고정)이라 이 정책은 **쓰이지 않는 우회로**였다. 그래서 그냥 제거했다.
- 현재 `classes`·`class_members` 0행 (B2B 기능 미출시) — 잠재 결함이었다.

#### `vocabularies.origin` 에 `'assignment'` 추가 (20260826123000)

`CHECK (origin = ANY (ARRAY['ai','shared_set','imported','manual','library','assignment']))`.

**값마다 삭제 의미가 다르다** — `unenroll_library_book` 은 도서 해지 시 그 학습자의
`origin='shared_set'` 낱말을 지운다. 교사 과제 낱말에 그 값을 쓰면 **무관한 도서를
해지했을 뿐인데 선생님이 보낸 단어가 함께 사라진다.** `'manual'` 은 "학습자가 직접 넣었다"
는 뜻이라 사실과 다르고 `'imported'` 는 파일 가져오기의 자리다. 그래서 자기 값을 준다.

⚠️ **`vocabularies.lemma` 는 `shared_dictionary(word)` 를 참조한다**(`vocabularies_lemma_fkey`,
`ON DELETE SET NULL`). 사전에 없는 표제어를 적으면 **그 한 행 때문에 일괄 upsert 전체가
거부된다.** 과제 담기는 먼저 사전에 물어보고 있는 것만 채운다(없으면 NULL).

**회귀 락** — `apps/web/src/lib/teacher/__tests__/assignment-vocab.test.ts` (8건).

#### `peek_class_by_code(p_code text)` — 초대 링크가 가입 **전에** 학급을 보여준다 (20260826120000)

`RETURNS TABLE(class_name text, member_count integer)` · `STABLE SECURITY DEFINER` ·
`GRANT EXECUTE TO anon, authenticated`.

교사가 공유하는 것이 코드에서 **링크(`/join/[code]`)** 로 바뀌면서 필요해졌다. 그 화면은
익명 방문자에게 열리는데 `classes` 의 RLS 는 비멤버에게 닫혀 있다(`join_class_by_code` 가
SECURITY DEFINER 인 것과 같은 이유).

- **왜 가입 전인가**: 코드가 틀렸을 때 가입을 마친 뒤 알려 주면 그 사람은 계정만 만들고 떠난다.
- **무엇을 감추나**: 교사의 신원(id·이메일·이름)은 돌려주지 않는다. 이름과 인원뿐이다.
- **노출 범위**: 코드를 아는 사람은 이미 `join_class_by_code` 로 그 학급에 들어갈 수 있다.
  이름을 보는 것은 그보다 **좁은** 권한이다. 코드는 32자 알파벳 6자리(약 10.7억)라
  열거해도 얻는 것이 학급 이름 하나다.

**회귀 락** — `apps/web/src/lib/teacher/__tests__/invite-rpc.integration.test.ts` (4건):
익명 실행 권한 · 없는 코드에 0행 · 반환 컬럼이 `class_name`/`member_count` 뿐 ·
비로그인 `join_class_by_code` 가 NULL(공개 GET 만으로 가입되지 않는다).
**GRANT 는 마이그레이션 한 줄이라 다음 함수 교체 때 조용히 빠질 수 있고, 빠지면
유효한 초대까지 전부 "확인할 수 없어요" 로 보인다** — 정상 실패 화면과 구별되지 않는다.

**회귀 락** — `apps/web/src/lib/auth/__tests__/rls-surface.integration.test.ts` (14건).
고아 테이블 anon/authenticated 읽기·쓰기 차단 + `pass_hash` 컬럼 지정 조회 차단 +
직접 가입/역할 자칭 차단 + **정상 초대코드 경로가 살아 있는지**(과잉 차단 방지)까지 단언한다.

---

## ⚠️ 미해결 — SECURITY DEFINER RPC 가 anon 에 열려 있다 (2026-08-15 조사, 수정 보류)

Supabase security advisor + 직접 조사로 확인했다. **이번 패스에서 고치지 않았다** — 아래 "왜
보류했나" 참조. 별도 작업으로 다뤄야 한다.

### 실측

| 항목 | 수 |
|---|---|
| `public` SECURITY DEFINER 함수 | 119 |
| 그중 `anon` 에 EXECUTE 부여 | **98** |
| 그중 `authenticated` 에 EXECUTE 부여 | 111 |
| 함수 본문에 `auth.uid()`·`is_admin()` 류 가드가 **없는** anon 호출 가능 함수 | **58** |

DEFINER 함수는 소유자(postgres) 권한으로 실행되어 **RLS 를 우회**한다. 즉 가드가 없으면
로그인 없이 `/rest/v1/rpc/<이름>` 으로 호출된다. 실증(2026-08-15, anon key 만으로):

```
await anon.rpc('get_lcp_config')   // → 에러 없이 호출됨 (내부 파이프라인 설정 함수)
```

`admin_*` 19종은 전부 본문에 role 가드가 있어 **직접적인 관리자 행위 탈취는 확인되지 않았다**.
위험군은 가드 없는 유지보수·학습 파이프라인 함수다 — `update_user_v_level` ·
`apply_diagnostic_result` · `purge_ghost_vocab` · `decode_entities_in_stored_sentences` ·
`fix_chapter_html_entities` · `republish_article_word_set` 등. 다수가 `p_user_id` 를 인자로 받아
**남의 계정 데이터를 대상으로 호출될 수 있다**.

### 왜 보류했나 (그냥 REVOKE 하면 안 되는 이유)

"앱이 호출하지 않는 함수만 회수" 로 접근했다가 **틀렸다는 것을 확인했다.**
`.rpc('리터럴')` grep 은 **동적 호출을 놓친다**:

```ts
// components/diagnostic/DiagnosticClient.tsx:321
const rpcName = selectedTest.test_type === 'track'
  ? 'analyze_and_apply_track_diagnostic_result' : ...
await supabase.rpc(rpcName, { p_result_id: ... })   // ← 리터럴 grep 에 안 잡힌다
```

같은 패턴이 `api/lcp/process`(`compute_book_*` 4종) · `admin/articles/*`(`admin_*_article`) ·
`scripts/lcp/*` 에도 있다. 리터럴 grep 기준 "미사용" 41종을 회수했다면 **진단 흐름과 LCP
파이프라인이 조용히 깨졌을 것**이다. 후보 21종을 레포 전체(코드·스크립트·문서) 참조로 다시
검사한 결과 **전부 어딘가에서 참조** — 안전하게 죽었다고 말할 수 있는 부분집합이 없다.

### 다음 패스에서 할 일

1. 함수별로 **정당한 호출자**를 확정한다 (브라우저 학습자 / 브라우저 관리자 / API route(service_role) / 내부 SQL·트리거·cron). 동적 호출 지점을 먼저 리터럴로 펴 두면 자동 분석이 가능해진다.
2. 내부 전용 = `REVOKE EXECUTE FROM anon, authenticated` (service_role·소유자는 유지).
3. 학습자 호출용인데 `p_user_id`/`p_result_id` 를 받는 함수는 본문에 **소유권 검사**를 넣는다 (`auth.uid()` 와 대조).
4. ⚠️ **회수하면 안 되는 것**: `is_admin` · `is_admin_or_curator` · `is_class_member` · `is_class_teacher` 는 RLS 정책 본문에서 호출된다. `authenticated` 의 EXECUTE 를 뺏으면 정책 평가가 에러 나 앱 전체가 멈춘다. 트리거 반환 함수는 PostgREST 가 노출하지 않으므로 대상 외.

### 함께 확인된 Auth 설정

- `auth_leaked_password_protection` **비활성** — Supabase Auth 가 HaveIBeenPwned 로 유출 비밀번호를
  차단하는 기능. 대시보드(Authentication → Policies)에서 켜면 되고 코드 변경은 필요 없다.
- 조사 명령: `mcp__supabase__get_advisors({ type: 'security' })` (2026-08-15 기준 ERROR 1 · WARN 458 · INFO 6).
  ERROR 1건은 `word_mislevel_signal` 뷰가 SECURITY DEFINER 로 정의된 것.
