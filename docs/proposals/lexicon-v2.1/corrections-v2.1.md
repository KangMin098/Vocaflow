# 정정 사항 (Prereq 이슈 3건 + 검증 한계)

## 1. SQL 검증 표현 정정

이전 메시지의 **"PG 파서 통과"** 표현은 부정확. 실제로는 `pglast` (libpg_query Python 바인딩) 로
**구문 파싱 가능 여부**만 확인 가능하며, 다음은 검증 안 됨:

- 함수 존재성 (`set_updated_at`, `sentences` 테이블 등)
- 컬럼 존재성, 외래키 참조 유효성
- 트리거 충돌, RLS 정책 충돌
- Supabase 환경 특수 제약 (search_path, RLS 권한, schema namespace)

**정확한 표현**: "구문 파싱은 가능. 의미적 검증은 Supabase 환경에서 별도 dry-run 필요."

## 2. Prereq 이슈 3건

### Issue 1: `sentences` 테이블 부재 (CRITICAL)

| | |
|---|---|
| **현황** | `userMemories` 에 v2 sentences 설계가 "확정" 으로 기록됨. `supabase/migrations/` 실제 파일에는 sentences 마이그레이션 부재. 11번까지의 마이그레이션 + 20260504/20260508 LCP 추가본 모두 sentences 없음. |
| **영향** | 이전 `schema-v2.1.sql` 의 `primary_sentence_id UUID REFERENCES sentences(id)` 가 적용 실패 |
| **해결** | `primary_sentence_id` 컬럼을 v2.1 본문에서 제거 → [15_lexicon_primary_sentence.sql](15_lexicon_primary_sentence.sql) 로 분리. sentences 마이그레이션 적용 후 별도 실행. |

### Issue 2: `set_updated_at()` 함수 존재 가정

| | |
|---|---|
| **현황** | `20251101000006_triggers_and_rls.sql` 에 정의 추정. 실제 확인 안 함. |
| **영향** | 정의 안 되어 있으면 `trg_lexicon_updated` 생성 실패 |
| **해결** | schema-v2.1.sql 상단 `DO $$ ... $$` prereq 블록에서 `pg_proc` 조회로 검증. 누락 시 RAISE EXCEPTION. |

### Issue 3: `SET search_path` 누락 (Supabase BLOCKER 3)

| | |
|---|---|
| **현황** | CLAUDE.md §18.9 BLOCKER 3 — Supabase 정책상 PL/pgSQL 함수에 `SET search_path` 명시 필요. 이전 버전 두 함수 (`compute_frequency_tier`, `auto_compute_freq_fields`) 모두 누락. |
| **영향** | Supabase database advisor 경고. 보안상 search_path injection 가능성. |
| **해결** | 두 함수에 `SET search_path = public, pg_temp` 추가. |

## 3. 정정된 마이그레이션 순서

기존 CLAUDE.md `claude-md-patch.md` 의 12·13·14 항목은 다음으로 갱신 필요:

```
12 — (별도 — userMemories v2 sentences 설계의 SQL 구현)  ★ sentences-table.sql
13 — shared_words.lexicon_id FK 만 ADD (선요건)              ★ 13_shared_words_lexicon_id.sql
14 — schema-v2.1.sql 본문 (primary_sentence_id 부재)         ★ 14_lexicon_v2_1.sql
15 — primary_sentence_id ADD COLUMN (sentences + 14 적용 후) ★ 15_lexicon_primary_sentence.sql
16 — migration-shared-words-to-lexicon.sql (별도 PR)         ★ 16_shared_words_backfill.sql
17 — shared_words 중복 컬럼 DROP (코드 전환 후, 별도 PR)      ★ 17_shared_words_drop_legacy.sql
```

번호는 PR 시점에 실제 마이그레이션 디렉토리 충돌 없는 timestamp 로 재할당.

## 4. 적용 전 사람 검토 체크리스트

본 정정 후에도 적용 전 확인:

- [ ] Supabase 로컬에서 `supabase db reset` 으로 전체 dry-run
- [ ] `20251101000006_triggers_and_rls.sql` 에 `set_updated_at()` 실제 정의 확인
- [ ] sentences 마이그레이션 (12번) 작성 — `userMemories` v2 설계의 SQL 구현
- [ ] Supabase database advisor 실행 → search_path 외 추가 경고 확인
- [ ] 기존 `shared_words` data shape 확인 (`SELECT word, part_of_speech, ... LIMIT 10`)
- [ ] RLS read-all 정책이 PII 노출 위험 없는지 재확인 (공용 자원이라 무난하나 향후 사용자 메모 추가 시 재검토)

## 5. CLAUDE.md 갱신 필요 항목

D 단계에서 적용한 CLAUDE.md 패치에 다음 추가:

- [ ] §"📋 마이그레이션 순서" 표의 12·13·14 항목을 위 §3 으로 교체 (12·13·14·15·16·17)
- [ ] 문서 헤더 v06.28 한 줄 요약 끝에 "sentences 미적용 환경 호환 — primary_sentence_id 분리 마이그레이션" 추가
- [ ] §18.9 BLOCKER 목록에 #15 추가 — "v2.1 lexicon 함수 search_path 누락 → SET search_path 추가 패턴 적용"
