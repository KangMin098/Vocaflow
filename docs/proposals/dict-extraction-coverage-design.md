# 사전 추출 커버리지 설계 — 굴절형·파생형 (2026-07-13)

> ⚠️ **교정(2026-07-13, 본 문서 이후 발견)**: 본 설계는 `select_book_chapter_vocab`(라이브러리 큐레이션)만 보고 "굴절형은 winkNLP가 처리해 작업 불필요"라 결론냈으나, **리더/‌text 경로엔 이미 굴절 해소 인프라가 완비**돼 있었다(2026-06-13 v06.41: `en_inflection_bases()` 규칙 역굴절 + `inflected_forms text[]` + `english_irregular_forms`, `lookup_word_meaning` 4-tier·`extract_vocabulary_for_user_v2` L2). 굴절형은 **이 인프라가 뜻 그대로 해소**(galloped→gallop·children→child 검증). 파생형은 **headword**로 처리(`derivational-candidates.json` 빈도 검증 소스 100% 커버). 아래 4-bucket "value-aware 미매칭 채움" 설계는 **채택 안 함**(규칙 표제어 대량 생성은 `abashederness` 쓰레기 날조로 롤백됨). 실제 결론·인프라는 [[project_extraction_coverage_design]] 참조. 아래 §1~2의 **매칭 메커니즘·실측 진단은 유효**하나 §3~9 처방은 무효.

> 목적: `shared_dictionary` 전체를 대상으로 **굴절형·파생형이 단어 추출에 온전히 반영**되도록 하는 작업 설계.
> 원칙: 추측 금지 — 추출 파이프라인의 실제 매칭 메커니즘 + 실측 gap(28권 ground truth)에서 역산.

---

## 1. 추출 매칭 메커니즘 (검증된 사실)

`select_book_chapter_vocab` / `select_article_vocab` 본문 확인 결과:

```sql
JOIN shared_dictionary sd ON sd.word = COALESCE(bv.lemma, bv.word)   -- INNER JOIN
```

- **매칭 키 = winkNLP가 산출한 `bv.lemma`** (없으면 표면형 `bv.word` 폴백).
- **INNER JOIN** — 키가 표제어에 없으면 그 토큰은 **통째로 탈락**(추출·뜻·레벨 부여 불가).
- **`inflections` 컬럼은 이 함수에서 전혀 참조되지 않음** — 추출 관점에선 죽은 컬럼.
- 따라서 "추출이 되려면" = **winkNLP lemma가 표제어로 존재**해야 함. 이 한 문장이 전체 설계의 기준.

---

## 2. 실측 gap (28권 curated ground truth)

`library_book_vocabularies`의 distinct lemma를 표제어와 대조:

| 지표 | 값 |
|---|---|
| distinct lemma | 27,334 |
| 매칭 | 20,930 (76.6%) |
| **미매칭** | **6,404 (23.4%)** |

### 2-1. 굴절형(inflections) — **작업 불필요**

미매칭 alpha≥4(5,540) 중 굴절 miss(접미사 제거 base가 표제어) 측정:

| -ies→y | -s | -ed | -ing |
|---|---|---|---|
| 0 | 4 | 0 | 0 |

→ **winkNLP가 복수·과거·현재분사·비교급을 이미 base로 환원**. 굴절 표면형이 미매칭으로 남는 사례 ≈ 0.
**결론: 굴절형은 추출 관점에서 이미 해결된 비이슈.** `inflections` 컬럼 채움/보완은 추출 회수율을 1건도 못 올림 → **본 작업에서 제외**. (컬럼은 미래 다른 기능용으로 보존하되 추출 SSoT 아님을 문서화.)

### 2-2. 파생형·잔여 — 접미사별 분포 (미매칭 alpha≥4 = 5,540)

| bucket | 개수 | 학습 가치 |
|---|---|---|
| 불투명 고가치 파생 (-tion/sion 155·ment 49·ance/ence 54·ity 83·ous 52·ive 37·able/ible 84) | **514** | 높음 — base와 뜻 상이, 별도 학습 어휘 |
| 투명 저가치 (-ly 314·ness 195) | 509 | 낮음 — base에서 뜻 유추 |
| 무접미사 (희귀 실단어·고유명사·OCR·방언) | **4,350 (78%)** | 파생 아님 — 별개 축 |

**중요**: 514개 고가치 파생조차 **전부 저빈도(28권 중 ≤4권 등장)**. 고빈도 명사화(transformation·government·education·information…)는 이미 3,353개 표제어로 존재(품질 100%). 미매칭은 **롱테일**(stateliness·ebullition·omniscience 류 C2 문어) — 앞선 sense 채굴과 동일한 포화 구조.

---

## 3. 설계 원칙 — 가치 인지 분류 (value-aware)

추출은 "학습 대상 단어"를 뽑는 것 → 모든 미매칭을 채우는 게 목표가 **아님**. 학습 과학 원칙(Cognitive Load ~4항목·Desirable Difficulty) 적용:

1. **파생형은 불투명할 때만 study 대상** — 뜻이 base에서 예측 안 될 때(nominalization·의미 특화 형용사). `quick→quickly`는 배울 필요 없음(투명), `transform→transformation`은 별도 어휘(불투명).
2. **투명 파생형·노이즈·고유명사의 미매칭은 gap이 아니라 정상** — 추출에서 빠지는 게 올바른 동작. 23.4%를 0%로 만드는 것은 오히려 학습셋 bloat(Calm UI 위반).
3. **진짜 gap = 불투명·재등장·실단어인데 표제어 결측** — 이것만 채운다.

---

## 4. 4-bucket 분류기 (자동 규칙 + word_register)

미매칭 lemma를 다음으로 자동 분류:

| bucket | 판정 규칙 | 조치 |
|---|---|---|
| **B1 굴절 miss** | base-strip(-s/-ed/-ing/-ies) 결과가 표제어 | 모니터만(현재 ≈0). 발생 시 lemmatizer 사전 보정 or 추출 JOIN에 de-inflect 폴백(§6 옵션) |
| **B2 투명 파생** | `-ly`/`-ness` + base 표제어 존재 | **비추출 정당 → 스킵**. (옵션: `base_lemma` 매핑만, 표제어 생성 X) |
| **B3 불투명 실파생·실단어** | 고가치 접미사(-tion/ment/ance/ity/ous/ive/able) **or** 무접미사 실단어, base 근거 or 사전류 검증 | **표제어 생성**(핵심 작업) — meaning_ko·meanings_ko·v_level·cefr·pos·example_en·word_register |
| **B4 노이즈** | 비알파·길이≤3·고유명사(france·지명·인명)·OCR(willin·tonque) | `word_register` 배제 확장(`proper_noun` 분류 포함) — 추출 영구 제외 |

무접미사 4,350의 세부(B3 실단어 vs B4 노이즈)는 정적 규칙으로 완전 분리 불가 → **채굴 루프에서 등장 빈도 + 사전 검증**으로 판별(freq≥2 & 실 단어 형태 = B3 후보, 나머지 = B4).

---

## 5. 실행 메커니즘 — 채굴 루프 확장 (전체 사전 대상)

이미 검증된 `scripts/lcp/dict-mine-batch.mjs`(sense 채굴)에 **미매칭 lemma 수집 모드**를 추가. 전체 학습대상 도서를 순회하며 미매칭을 누적 → 전 사전 단일 후보 풀 → 1회 채움(= "사전 전체 대상" 작업의 실체).

**단계**:
1. 각 배치 도서 적재 후, `lbv LEFT JOIN sd ON sd.word=COALESCE(bv.lemma,bv.word) WHERE sd.word IS NULL` 로 미매칭 lemma + chapter 빈도 수집.
2. §4 분류기로 B1~B4 태깅. **B2/B4는 카운트만**(스킵 근거 기록), **B3만 후보 JSON에 등장 도서수 합산 누적**(`data/coverage-candidates.json`).
3. 도서 삭제(transient·용량 절약) — sense 채굴과 동일.
4. 누적 후보를 등장 도서수 순으로 **LLM(Claude=MCP)이 표제어 생성**: 실 단어 검증(사전적 실재) → 7필드 INSERT + shared_words 동기화. 노이즈·고유명사 판별분은 B4로 재분류(`proper_noun`).

**품질 게이트**: 신규 표제어는 반드시 `classified_by IS NOT NULL`(추출 필터 통과 조건) + v_level·cefr·meanings_ko·example 완비. 미검증 표면형 대량 INSERT 금지(스텁 재발 방지 — [[project_dict_field_completeness]]).

---

## 6. 추출 함수 아키텍처 옵션

| 옵션 | 내용 | 판정 |
|---|---|---|
| **A. 표제어 채움 (권장)** | JOIN 그대로. B3 결측 표제어만 생성 | 불투명 파생을 "별도 학습 어휘"로 정확히 취급. 최소 변경 |
| B. JOIN de-inflect/derivation 폴백 | 매칭 실패 시 base-strip·`inflections` 재조회 | 굴절 miss≈0라 이득 미미 + 파생은 base 뜻(품사 불일치) 노출 → 부정확. 기각 |
| C. `base_lemma` 매핑 컬럼 | 투명 파생형을 base에 연결(표제어 X) | B2를 미래에 base 레벨로 노출하고 싶을 때만. 현재 불요(투명형은 비추출이 정상) |

→ **A 채택**. B/C는 향후 필요 시 재검토.

---

## 7. 커버리지 메트릭 (영속 추적)

추출 품질을 상시 관측하도록 지표화(향후 view/함수):

```
extraction_coverage(book) = matched_lemmas / (distinct_lemmas − noise − transparent)
```

- 분모에서 **노이즈(B4)·투명 파생(B2) 제외** → "실 커버리지"(현재 raw 76.6%보다 높음).
- 채굴 후 재측정으로 B3 채움 효과 추적. 목표: 실 커버리지 ≥ 95%.

---

## 8. 범위·우선순위·예상 규모

| 축 | 작업 | 예상 규모 |
|---|---|---|
| 굴절형 | **0** (winkNLP 처리, 검증 완료) | — |
| 파생형 B3 | 채굴 기반 표제어 생성, 등장≥2권 우선 | 28권 기준 고가치 파생 514(전 저빈도) + 무접미사 실단어 일부. **전체 학습대상 누적 시 수백~1천 규모**(정밀치는 채굴이 산출) |
| 투명 B2 | 스킵(정상) | 509 미채움 정당 |
| 노이즈 B4 | `proper_noun` 분류 + register 배제 | 4,350의 대부분(고유명사·OCR) |

**전체 사전 일괄 규칙 생성은 지양** — 투명 저가치 대량 추가 + 불규칙 오류 + bloat. **책 등장 빈도 = 학습 임팩트** 정렬로 실등장분만 채우는 것이 sense 채굴에서 이미 검증된 고효율 경로.

---

## 9. 실행 Phase (제안)

- **P0 (설계·본 문서)**: 메커니즘 확정 + gap 실측 + 분류기 규격. ✅
- **P1 커버리지 메트릭 view + 분류기 SQL**: 미매칭 자동 B1~B4 태깅 view. 안전(읽기 전용).
- **P2 채굴 스크립트 확장**: `dict-mine-batch.mjs`에 미매칭 수집 모드 + `coverage-candidates.json`.
- **P3 B3 표제어 생성**: 등장 도서수 순 LLM 채움(배치, shared_words 동기화). 재측정.
- **P4 B4 proper_noun 분류**: 고유명사 LLM 패스(§4·[[project_dict_field_completeness]] 항목1 잔여) → register 배제.

각 Phase는 독립 승인. P1은 부작용 0(관측용)이라 즉시 착수 가능.
