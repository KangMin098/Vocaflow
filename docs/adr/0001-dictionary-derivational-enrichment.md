# ADR 0001 — Dictionary Derivational Enrichment

- **Status**: Accepted (2026-05-29)
- **Deciders**: 서준 (PM), Claude Code (구현)
- **Scope**: `shared_dictionary` 스키마 + 파생어/굴절형/철자변형 처리 정책
- **Supersedes**: 없음
- **Superseded by**: —

---

## 1. Context

큐레이션 진단(`find_unbound_book_lemmas`) 결과, 도서 1권당 평균 ~1,000건의 미바인딩 단어 중 **약 60-70%(600-700건)가 흔한 영어 파생어**임이 발견됨 (Dumas 소설 실측). 구체적으로:

- **-ness 명사**: calmness · politeness · tenderness · gentleness — base(calm/polite) 는 사전에 있음
- **-tion 명사**: consolation · inclination · recollection — base(console/incline/recollect) 있음
- **-ity 명사**: extremity · generosity · tranquility — base(extreme/generous/tranquil) 있음
- **-ful/-less 형용사**: frightful · ungrateful · motionless — base 있음
- **-ed 과거형**: pronounced · kissed · fastened — base 있으나 굴절 매핑 실패
- **US 철자**: ardor · valor · somber — UK 형(ardour/valour/sombre) 만 있음

기존 처리 한계:
- `shared_dictionary` 21,740 row 는 base 중심으로 시드됨 — 파생형 누락
- `inflections` JSONB 는 굴절(-ed/-ing/-s) 위주, 파생어 미포함
- 임시방편으로 `archaic_dictionary` 에 적재 시 의미 오염 (frightful 은 archaic 아님)

이 상태로는 도서 추가 시마다 큐레이터가 수백 건을 손으로 처리해야 함.

### 비목표 (Non-goals)

- shared_dictionary 의 **base 단어 자체 보강** — 본 ADR 범위 밖. 파생어 처리만 다룸.
- 형태소 분석기 교체 (winkNLP → 다른 라이브러리) — 파이프라인 안정성 우선.
- 자동 LLM-driven 사전 전체 재구축 — 비용·검수 부담.

---

## 2. Decisions

### D1 — 굴절 vs 파생 분류 경계

| 분류 | 어미 | 처리 방식 |
|---|---|---|
| **굴절 (inflection)** | `-ed` · `-ing` · `-s` · `-es` · `-er`(비교급) · `-est`(최상급) | 독립 row 생성 **안 함**. `inflections` JSONB 에 surface form 만 추가, base 의 메타로 회수. |
| **파생 (derivation)** | `-ness` · `-tion` · `-sion` · `-ity` · `-ful` · `-less` · `-able` · `-ible` · `-ment` · `-ly`(부사) · `-er`(명사 행위자) · `-or` · `-ish` · `-hood` · `-ship` | **독립 row 생성**. base 와 별개 의미·품사 보유. |
| **복합어 (compound)** | `horse+man`·`farm+house`·`school+master` | **독립 row 생성** (파생 동급). base 가 양쪽 다 사전에 있어야 인정. |

**근거**:
- 굴절은 같은 단어의 변형(품사·의미 동일). 별 row 는 중복.
- 파생은 품사/의미 변환(`fright`(n)→`frightful`(adj)). 학습자는 새 단어로 인지.
- **-ly 부사는 파생**: 의미·품사 변환 명백 (`previous`(adj)→`previously`(adv)).
- **-er 모호**: `quicker`(굴절 비교급) vs `teacher`(파생 행위자) — 문맥상 구분. base 가 동사면 행위자 파생, 형용사면 비교급 굴절.

### D2 — 파생어 등록 임계값

**규칙**: 다음 두 조건을 **모두 만족**할 때만 신규 row 등록.

1. base 가 `shared_dictionary` 에 존재 (`v_level IS NOT NULL` + `classified_by IS NOT NULL` + `meaning_ko IS NOT NULL`)
2. 표면형(파생어)이 실제 텍스트에서 출현 — `library_book_vocabularies.word` OR `archaic_candidates.word` 에 등장

**근거**: base-only 자동 생성(빈도 무관 전량) 은 21,740 → 70만+ row 폭증 위험 + 사전에서 안 쓰일 파생형 다수(`agile→agilely`?) false positive. 실 출현 기반은 false positive 0 + 자산 구제 효과는 동등.

### D3 — 메타 상속 정책

| 필드 | 출처 |
|---|---|
| `meaning_ko` | **Claude Code 가 직접 생성** (base 의미 + 파생 접사 의미 합성) |
| `cefr_level` | base 에서 상속 (대체로 동일 — `frightful`/`fright` 둘 다 B1 수준) |
| `v_level` | **base v_level + 0 또는 +1** — 휴리스틱: 파생 접사가 학술적(-ity/-ment/-tion) 이면 +1, 일상적(-ful/-less/-ly) 이면 +0 |
| `pos` | 어미별 결정 — `-ness/-tion/-ity/-ment/-hood/-ship/-er/-or` → noun, `-ful/-less/-able/-ible/-ish` → adjective, `-ly` → adverb |
| `frequency_rank` | NULL (base 와 다름) |
| `pronunciation` · `example_en` · `synonyms` · `antonyms` | NULL (Phase 별 enrichment 큐에 위임) |
| `base_word` | base 의 `word` (FK 자기참조) |
| `source` | `'derivational-seed'` |
| `classified_by` | `'claude_code_derivational'` |

### D4 — `archaic_dictionary` 경계 운영 정의

다음 **셋 중 하나**라도 해당하면 `archaic_dictionary` 적재 대상:

1. **현대 사전(Merriam-Webster/Oxford) 에 `archaic`/`literary`/`obsolete` 라벨**
   - 예: `thee`·`thy`·`thou`·`dost`·`hast`·`shalt`·`whilst`·`yonder`·`knowest`·`besought`·`canst`
2. **19세기 이전 시대·계급 고유 어휘** (현대 영어에 거의 없음)
   - 예: `musketeer`·`pistole`·`comte`·`fronde`·`coadjuteur`·`halberdier`·`cuirassier`
3. **비영어 외래어 차용** (작품 안에 영어로 동화 안 된 채 쓰임)
   - 예: `madame`·`monsieur`·`de la`·`du`·`hypocras`·`schiavi`

**제외** (절대 archaic_dictionary 에 들어가지 않음):
- 현대 영어에서 살아있는 파생어 — `frightful`·`agreeable`·`motionless`·`recollection` 등 (D1·D2 로 `shared_dictionary` 에 들어감)
- US/UK 철자 변형 — `ardor`·`valor`·`somber` (Phase 1 에서 `shared_dictionary.spelling_variants[]` 로 흡수)
- 굴절형 — `pronounced`·`kissed` (D1 에 따라 inflections 으로 회수)

---

## 3. Schema Changes

### 3.1 `shared_dictionary` ALTER

```sql
ALTER TABLE shared_dictionary
  ADD COLUMN base_word TEXT,                        -- 파생어 → base 자기참조 (단순 컬럼, FK는 별도)
  ADD COLUMN spelling_variants TEXT[] DEFAULT '{}', -- US/UK 등 동일 의미 다른 철자
  ADD COLUMN derivation_suffix TEXT;                -- '-ness'·'-tion' 등 — 통계·검증용

-- FK는 deferred (시드 적재 순서 무관)
ALTER TABLE shared_dictionary
  ADD CONSTRAINT shared_dictionary_base_word_fkey
  FOREIGN KEY (base_word) REFERENCES shared_dictionary(word)
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX idx_sd_base_word ON shared_dictionary(base_word) WHERE base_word IS NOT NULL;
CREATE INDEX idx_sd_spelling_variants ON shared_dictionary USING gin(spelling_variants);
CREATE INDEX idx_sd_derivation_suffix ON shared_dictionary(derivation_suffix) WHERE derivation_suffix IS NOT NULL;
```

### 3.2 데이터 무결성 가드

```sql
-- 자기 자신 base 금지 (순환 방지)
ALTER TABLE shared_dictionary
  ADD CONSTRAINT shared_dictionary_no_self_base
  CHECK (base_word IS NULL OR base_word <> word);

-- base 가 다시 파생어인 깊이 2 순환 — 트리거로 차단
CREATE OR REPLACE FUNCTION enforce_base_word_depth1()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.base_word IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM shared_dictionary WHERE word = NEW.base_word AND base_word IS NOT NULL) THEN
      RAISE EXCEPTION 'base_word "%" 가 다시 파생어임 — 깊이 1 만 허용', NEW.base_word;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_sd_base_word_depth1
  BEFORE INSERT OR UPDATE OF base_word ON shared_dictionary
  FOR EACH ROW EXECUTE FUNCTION enforce_base_word_depth1();
```

### 3.3 보존 보장

- 기존 21,740 row 의 `meaning_ko` 100% 채움 상태는 **변경 안 함** (ADD COLUMN 만, UPDATE 없음).
- 신규 컬럼 모두 nullable + default → 기존 row 영향 0.
- 마이그레이션 후 `SELECT COUNT(*) FROM shared_dictionary WHERE meaning_ko IS NULL` 가 0 유지 확인.

---

## 4. Phase 1 — 철자 정규화 (Phase 2 선행조건)

### 4.1 작업 명세

1. **정규화 함수** `normalize_spelling(text) → text` — US → UK 표준화
   - 규칙: `-or`→`-our` · `-er`→`-re` · `-ize`→`-ise` · `-yze`→`-yse` · `-log`→`-logue` · `-ense`→`-ence` · `-eled`/`-eling`→`-elled`/`-elling`
   - **safety**: 변형 후보가 사전에 실재할 때만 채택 (오변환 차단)
2. **예외 사전** — 규칙으로 안 잡히는 동의 철자 manual map
   - `mustache`/`moustache` · `gray`/`grey` · `aluminum`/`aluminium` · `mom`/`mum`
3. **누적 적재**:
   - 매칭된 변형 발견 → 표준형 row 의 `spelling_variants[]` 에 ARRAY_APPEND (멱등 — `ARRAY_REMOVE` 후 재추가)
4. **토큰화 통합** — 추출 파이프라인의 사전 조회 **직전** 에 normalize 호출

### 4.2 검증

- US 철자 27개 probe (ardor·valor·somber·sepulcher·succor·dishonor 등) → 전량 매칭 + `spelling_variants[]` 에 누적 확인
- 기존 unbound 카운트 (Dumas 1000건) → 철자_변형 분류가 spelling_variants 적재 후 사라짐 확인

### 4.3 비용

반나절 (스크립트 + 멱등 적용 + probe 검증)

---

## 5. Phase 2 — 파생어 seed (본체)

### 5.1 작업 흐름

```
[1] 미스 수집 — library_book_vocabularies.word WHERE lemma IS NULL
                + archaic_candidates.word WHERE classification IN ('pending', 'genuine_miss')
[2] 접사 분해 — 표면형에서 D1 의 파생 접사 추출
       calmness → calm + -ness
       consolation → console + -tion (-ation 의 변형은 -ate 동사 + -ion)
[3] base 검증 — base 가 shared_dictionary 에 존재 + 메타 완전한지 확인
                Phase 1 정규화 적용 (somberness → sombre 매칭)
[4] 신규 row 후보 생성 — D2 임계값 통과 시
       word: 'calmness', base_word: 'calm',
       cefr_level: base.cefr_level,
       v_level: base.v_level + (suffix가 학술적이면 +1 else +0),
       pos: 접사별 결정 (D3 매핑),
       derivation_suffix: '-ness',
       source: 'derivational-seed',
       classified_by: NULL  -- meaning_ko 채우기 전 단계
[5] LLM (Claude Code) 의미 생성 — base 의미 + 접사 의미 합성
       calm(고요한, 차분한) + -ness → '고요함, 평정'
[6] 배치 INSERT (멱등, ON CONFLICT DO NOTHING)
       classified_by = 'claude_code_derivational' 로 마무리
```

### 5.2 재사용 인프라

기존 `scripts/dict-*.mjs` 그대로 활용:
- `dict-common.mjs` — service-role 클라이언트
- `dict-fetch-batch.mjs` — 50개씩 batch (NULL meaning_ko 추출 패턴 그대로)
- `dict-update-batch.mjs` — 멱등 UPDATE
- `dict-status.mjs` — 진행률 보고

신규 추가: `scripts/derivational-seed.mjs` (Phase 2 진입점만, 나머지는 위 재활용)

### 5.3 검증

- Dumas 783건 probe → 600-700건 `shared_dictionary` 히트 (~80%)
- 각 신규 row `meaning_ko IS NOT NULL` AND `base_word IS NOT NULL` AND `derivation_suffix IS NOT NULL`
- `EXPLAIN ANALYZE` 로 `idx_sd_base_word` 인덱스 활용 확인
- 21,740 기존 row → 변동 0 (count + checksum)

### 5.4 Abort 조건

- 자기참조 순환 시도 (CHECK 위반 또는 깊이>1 트리거 발화) → 즉시 중단, 입력 lemma 격리
- base 단어가 사전에 존재하나 `meaning_ko IS NULL` → seed 보류, 큐레이터 알림
- LLM 의미 생성이 base 의미와 의미적 거리 큼 (수동 검수 sample 10% 에서 30% 이상 reject) → 정책 재검토

### 5.5 비용

1-2일 (스크립트 0.5일 + LLM 의미 생성 batch 0.5일 + 표본 검수 0.5일)

---

## 6. Phase 3-5 (요약 — 별도 ADR 또는 본 ADR 후속)

- **Phase 3 — 굴절 회수**: D1 의 inflection 어미 회수 강화. winkNLP lemmatizer 결과를 규칙 레이어로 보정.
- **Phase 4 — archaic_dictionary**: D4 경계 적용. Phase 2 완료 후 잔존하는 archaic 만 한정 적재.
- **Phase 5 — 노이즈 분류기 fix**: `scarcely`·`loyalty`·`royalty`·`necessarily`·`sufficiently` 류 false positive 수정. Phase 1-2 후 자동 구제분 확인 후 잔존만 정밀 수정.

각 Phase 는 본 ADR 의 D1-D4 결정을 전제로 함. 별도 ADR 불필요 — 본 문서로 충분히 봉인됨.

---

## 7. 적용 순서 체크리스트

- [ ] **Phase 0**: 본 ADR 승인 (now)
- [ ] **Phase 0.5**: 스키마 마이그레이션 — `0001_shared_dictionary_derivational_columns.sql` 적용 후 `meaning_ko IS NULL` count = 0 검증
- [ ] **Phase 1**: 철자 정규화 함수 + spelling_variants[] 누적 — 27건 probe 통과
- [ ] **Phase 2**: derivational seed 스크립트 + LLM 의미 생성 — Dumas 783건 중 600+ 자산 구제 확인
- [ ] **Phase 3**: 굴절 회수 — `-ed/-ing` probe 회수율 검증
- [ ] **Phase 4**: archaic_dictionary 한정 적재 — D4 경계 위반 0 확인
- [ ] **Phase 5**: 노이즈 분류기 false positive 수정 — `scarcely` 류 확인

---

## 8. 결과 모니터링 지표

| 지표 | 현재 | 목표 (Phase 2 완료 후) |
|---|---|---|
| Dumas 1권 unbound 카운트 | 1,000 | < 150 (85% 감소) |
| 도서 평균 unbound | (미측정) | < 100 |
| `shared_dictionary` row 수 | 21,740 | 22,500 ± 200 (파생 ~750 신규) |
| `meaning_ko IS NULL` 비율 | 0% | 0% (불변) |
| spelling_variants[] 누적 | 0 | 27+ (Phase 1) |
| base_word FK 정합 | — | depth ≤ 1, 순환 0 |

---

*ADR 0001 — 2026-05-29 봉인. 본 문서는 Phase 1-5 의 단일 진실 소스.*
