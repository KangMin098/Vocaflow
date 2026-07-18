# 추출 품질 심층 평가 — P0 정찰 결과

> 착수 정찰 (read-only, DB SELECT + 파일 읽기만). 코드/DB 변경 0.
> 상위 설계: `docs/AI_CONTEXT/handoffs/` 추출 품질 판정 하네스 설계.
> 작성 2026-07-18 · 근거 100% DB direct query (`jajenrevcbmrpaliomxv`).

---

## 0. 한 줄 요약

세 가지가 실측으로 확정됐다:

1. **🔴 최우선 (신규 발견) — 표제어 바인딩 결함**: 파생/부정접두 표면형이 **의미가 다른 base 로 오바인딩**되어 학습자에게 **반대 뜻**을 노출. 발행 콘텐츠에서 **782 표면형 오바인딩 · 654 POS 불일치 · 36 확정 반의어 플립**(`imprudent→prudent`, `insincere→진심의`, `ungrateful→고마워하는`…). **기존 "Q1 100% 검증(40,355 표제어)" 이 커버하지 않은 축** — 검증은 표제어를, 결함은 표면→표제어 *바인딩* 을 건드린다. 판정 하네스로도 안 잡힘(이미 바인딩된 단어를 판정하므로).
2. **🟡 Q2 재현율 구멍 = 고정 V6 게이트**: 리터러리 챕터 1개에서 KICE-코어 30개가 게이트에서 차단(전량 `v_level<6` 사유). 순위(Q5)는 건강 — 손실은 전적으로 **게이트**, 순위가 아님.
3. **🟡 사전 최적화 유일 레버 = `frequency_rank`**: working set 20,678 중 필드 완비 사실상 100%, **단 `frequency_rank` 30.0%(6,204) 결측**. composite 0.40 가중이 죽어 순위 변별력 붕괴. `ipa/syn/ant` 는 추출경로 밖(dict_w0 판정 실측 재확인). Phase B per-sense v_level 백로그는 **사실상 종결**(전역 343, working set 68 — 설계의 "5,170" 은 stale).

판정 하네스(Q3/Q5)는 여전히 유효하나, **위 #1(바인딩)은 하네스로 안 잡히므로 별도 결정론 인바리언트가 필요** — 1순위가 하네스에서 바인딩 체크로 재편되어야 한다.

---

## 1. 배관 실측 — 추출 함수 계약 (검증됨)

| 함수 | 캡 | 게이트 | 노이즈 제외 register |
|---|---|---|---|
| `select_book_chapter_vocab(book)` | **없음** (전 후보 반환, `sort_order` = 챕터별 ROW_NUMBER) | `COALESCE(sense_v, v_level) >= 6` + `classified_by NOT NULL` + meaning 비어있지 않음 | archaic_literary·period_cultural·phrase_unit·brand·abbreviation·proper_noun |
| `select_article_vocab(article)` | 없음 (전 후보, `sort_order` 전역) | 동일 | 동일 |
| **cap 40** | publish 단계에서 적용 (SSoT 함수는 미적용) | — | — |

- composite = `_extract_composite_score`: **0.40 freq_rank**(`1/log10(rank+10)`, NULL→0) + 0.35 in-unit 빈도 + 0.15 v_level밴드(6-9=1.0·10=0.6·11=0.4) + 0.10 verified/예문 − 0.10 skill4×쉬운유닛.
- **in-cap = `sort_order<=40` · out-of-cap = `sort_order 41+` · gated = 챕터 등장하나 SSoT 출력에 없음**(게이트/register/meaning 차단). 3분해가 결정론적으로 산출 가능함을 확인.
- 외부 준거: **KICE 코어 = `lexicon_frequencies` source_id=1(kice_csat 2014-2026) `frequency_tier>=3` = 1,394 lemma**. kcurr2022 = `shared_dictionary.list_tags && {kcurr2022_0,_1,_2}`(≈3,025). (`word_lexicon` 엔 tier 컬럼 없음 — tier 는 `lexicon_frequencies` 에 있음.)

---

## 2. Q2/Q5 베이스라인 — 3분해 실측

### Probe A — 리터러리: Pride & Prejudice ch18 (book_v_level 8, 후보 127)

| bucket | n | KICE-코어 | KICE% | kcurr | kcurr% |
|---|---|---|---|---|---|
| **in-cap (1–40)** | 40 | 10 | 25.0 | 23 | 57.5 |
| **out-of-cap (41–127)** | 87 | **0** | 0.0 | 4 | 4.6 |
| **gated** | 73 | **30** | 41.1 | 47 | 64.4 |

- `ext_rank_lift` = 25.0/0.0 = **∞** (순위가 KICE 를 완벽히 cap 안으로 집중). `ext_recall_missed`(게이트 통과했으나 순위 탈락한 KICE) = **0**.
- **gated 분해**: `v6_gate(v<6)` 67개 중 **KICE 30개 전량** · register_noise 1 · other 5. → **KICE 손실 100% 가 고정 V6 게이트 사유**. register/meta 아님.
- 해석: **cap 안에 든 KICE(10) 보다 게이트에서 버려진 KICE(30) 가 3배**. V8 도서인데도 "V<6 = 너무 쉬움" 으로 CSAT 빈출어를 배제. 기지 이슈("고정 V6 게이트가 쉬운 책에서 수능 코어 배제")를 리터러리에서도 정량 확인.

### Probe B — news/expository: "Black hole" article (v_level 6, 후보 392)

| bucket | n | KICE-코어 | KICE% | kcurr | kcurr% |
|---|---|---|---|---|---|
| **in-cap (1–40)** | 40 | 9 | 22.5 | 13 | 32.5 |
| **out-of-cap (41–392)** | 352 | **47** | 13.4 | 86 | 24.4 |
| **gated** | 695 | **275** | 39.6 | 491 | 70.6 |

- `ext_rank_lift` = 22.5/13.4 = **1.68** (순위가 KICE 를 겨우 1.7배 집중 — 리터러리 대비 급락).
- **두 개의 서로 다른 재현율 구멍 확정**:
  - **게이트 구멍**(양 register 공통): V<6 KICE 차단. book 30 · article **275**.
  - **캡/순위 구멍**(긴 유닛 한정): 게이트 통과 후 순위 탈락. book 0 · **article 47**. → 후보 392개에 슬롯 40개인 긴 유닛에서 순위가 변별에 실패.

### P0.2 register 별 순위-lift (전 발행 아티클 집계 · Goodhart 가드 근거)

| register | in-cap KICE% | out-cap KICE% | rank_lift |
|---|---|---|---|
| argumentative | 24.2 | 13.7 | 1.77 |
| **expository** (지배적) | 17.5 | 14.3 | **1.22** ← 최약 |
| reference | 16.0 | 8.8 | 1.82 |
| book (P&P) | 25.0 | 0.0 | ≫ |

- **기대 범위 밴드**: in-cap KICE% ≈ **16–25%**, out-cap ≈ **9–14%**. 이탈만 신호로 사용(점수 아님).
- **expository(과학 위키류)가 순위 변별 최약(1.22)** — §3 의 freq_rank 결측과 직결(후보 30%가 0.40 가중 사장).
- **⚠ 구조적 발견 — "수능 트랙" register 콘텐츠는 존재하지 않음**. 발행 도서/아티클에 csat/exam/수능 register 0건. 수능은 *콘텐츠 register* 가 아니라 *준거 리스트*(KICE). → 설계의 "문학 vs 수능트랙 vs news" 3분 register 축은 재정의 필요: 실재하는 대비는 **리터러리(도서) vs news/expository(아티클)** 뿐. 수능은 전 register 에 겹쳐 재는 준거로만 사용.

---

## 3. 사전 최적 구성 — working set 실측

### working set = **20,678 lemma** (발행 도서 + 발행 아티클 등장 distinct headword, dict 매칭)

| 추출-경로 필드 | 결측 (of 20,678) | 완비율 |
|---|---|---|
| meaning_ko | 0 | 100% ✅ |
| v_level | 0 | 100% ✅ |
| cefr_level | 0 | 100% ✅ |
| pos | 0 | 100% ✅ |
| word_register | 0 | 100% ✅ |
| track_levels | 0 | 100% ✅ |
| example_en | 10 | ~100% ✅ |
| classified_by | 0 | 100% ✅ |
| **frequency_rank** | **6,204** | **70.0%** 🔴 |

- **사전DB "최적 구성" 의 조작적 정의 = working set frequency_rank 완비**. 이게 유일한 실질 구멍.
- **우선 슬라이스**: freq_rank 결측 6,204 중 **KICE-코어 238 · kcurr 333** — 이 571 을 먼저 채우면 고가치어의 순위 페널티 즉시 해소.
- Phase B per-sense v_level 백로그: 전역 **343** · **working set 교집합 68** (설계 "5,170" 은 stale — v06.256 에 per-sense v_level 종결됨). → 사전 후속에서 사실상 non-issue.
- `ipa/syn/ant` 결측은 추출경로 밖 → working set 프레임에서도 후순위(dict_w0 판정 실측 재확인).

---

## 4. 🔴 신규 최상위 결함 — 표제어 바인딩 오류 (Q1 미커버 축)

`select_*_vocab` 는 `sd.word = resolve_dict_headword(COALESCE(bv.lemma, bv.word))` 로 표면형을 표제어에 바인딩한다. **추출 시점 `library_book_vocabularies.lemma` 가 파생형을 과잉 stem** 하여 의미가 다른 base 에 묶임. 사전 표제어 자체는 정확(직접 검증) — 바인딩이 더 나은 exact-surface 매칭을 버림.

### 확정 사례 (P&P ch18, 함수 출력 vs 정본 사전)

| 표면형 | 바인딩 lemma | 학습자 노출 뜻 | 정본(사전) | 유형 |
|---|---|---|---|---|
| **imprudent** | prudent | 신중한, 분별 있는 | 경솔한, 분별없는 | **반의어** |
| **unrestrained** | restrain | 억제하다 | 억제되지 않은 | **반의어(polarity)** |
| **forbearance** | forbear | 조상, 선조 | 인내, 자제 | 무관어 |
| discernment | discern | (v) 식별하다 | (n) 식별 | POS+파생 |
| exultation | exult | (v) 환호하다 | (n) 환호 | POS+파생 |
| conciliatory | conciliate | (v) 달래다 | (adj) 유화적인 | POS+파생 |

### 블라스트 반경 (전 발행 도서+아티클)

| 지표 | 수 |
|---|---|
| surface 자체 dict 표제어 보유하나 **타 표제어로 바인딩** (오바인딩 후보) | **782** |
| 그중 **POS 불일치** (고위험) | **654** |
| 그중 **부정접두 strip** (im/un/in/dis/non → 반의어 확정) | **36** |

- **36 부정접두 전량 반의어 플립 실측**: impartiality→편애 · insincere→진심의 · ungrateful→고마워하는 · unwilling→기꺼이 · unaware→알고 있는 · unwise→현명한 · inconvenient→편리한 · insignificant→중요한 … **모두 반대 뜻을 가르침** (Empathetic Feedback 이전에 사실오류).
- 654 POS-불일치는 "검토 필요"(일부 파생형은 base 뜻 전이 OK), 36 부정접두는 "확정 결함".
- **근본 원인**: 추출 lemmatizer 가 파생 접미(-ment/-ation/-ory/-ance) + 부정 접두(im-/un-)를 base 로 축약. surface 가 이미 자체 dict 표제어인데 exact 매칭 우선순위 없음.
- **왜 중요**: 기존 "추출 신뢰(v06.248~252) 40,355 표제어 100% 검증" 은 *표제어* 를 검증했지 *표면→표제어 바인딩* 을 검증하지 않았다. 판정 하네스도 이미 바인딩된 단어를 판정하므로 못 잡는다. → **결정론 인바리언트(CP)로만 잡히는 축.** 수리 방향: `resolve_dict_headword` 에 "surface 가 자체 표제어면 exact 우선" 게이트 + 부정접두/파생 축약 차단.

---

## 5. Q3/Q5 판정 하네스 — 전제 실측

### P0.3 판정 표본 쿼리 (타당성 확인)

`select_book_chapter_vocab(book)` WHERE `chapter_idx=k` 에서 `sort_order 1..8`(in-cap 상위) + `41..48`(out-cap 경계) 단일 쿼리로 추출 성공. 셔플은 클라이언트. **경계가 실제로 다툼의 여지 = 하네스에 신호 있음**:

- in-cap 상위 8: exhibit·dignity·omit·interference·descent·blush·fatigue·ignorance (composite ~0.71)
- out-cap 경계 41–48: utter·dwell·**implicit**·**compatible**·misery·animate·patron·**probable** (composite ~0.53)
- `implicit·compatible·probable` = 고빈출 CSAT 어인데 cap 밖. composite 절벽(0.71→0.53)은 대부분 **in-chapter 빈도(0.35)** 가 만든 것 — 챕터 내 반복 여부가 학습 전이가치와 어긋남.

### P0.8 LLM 제2심판 시범 (참고치 · 결론 도출 금지)

동일 챕터 127 후보를 중립(알파벳)순으로 받아 Claude 가 CSAT-지향 V5-8 학습자용 ~40 독립 선정 → **시스템 in-cap 40 과 일치 26/40 ≈ 65%**.
- 불일치 원천: (a) 시스템이 유지한 기초/문학 V6·V10(blush·breast·glow·mortification·allusion) 을 Claude 는 탈락, (b) 시스템이 out-cap 으로 내린 고-CSAT 추상어(implicit·compatible·probable·indignant·malice) 를 Claude 는 승격.
- ⚠ 인간 라벨 확보 전 참고치. 초기 100 라벨 일치 ≥85% 검증 후에만 대량 스크리닝 투입(설계 원칙).

### P0.4 `extraction_judgments` 스키마 초안 (승인 대기 — 적용 금지)

```sql
CREATE TABLE extraction_judgments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 판정 대상
  source_kind    text NOT NULL CHECK (source_kind IN ('book','article')),
  source_id      uuid NOT NULL,              -- library_books.id | library_articles.id
  chapter_idx    integer,                    -- book 만; article 은 NULL
  word           text NOT NULL,              -- 표면형 (판정된 그대로)
  headword       text NOT NULL,              -- 바인딩된 표제어 (바인딩 결함 추적용)
  -- 판정 컨텍스트 스냅샷 (이후 가중 변경 시 회귀 대조)
  in_cap             boolean NOT NULL,       -- 판정 시점 sort_order<=40
  sort_order_at      integer NOT NULL,       -- 판정 시점 순위
  composite_at       numeric NOT NULL,       -- 판정 시점 composite (가중 변경 회귀 기준)
  v_level_at         smallint,
  -- 판정 결과
  verdict        text NOT NULL CHECK (verdict IN ('valuable','not_valuable','uncertain')),
  judge_kind     text NOT NULL DEFAULT 'human' CHECK (judge_kind IN ('human','llm')),
  mode           text NOT NULL DEFAULT 'absolute' CHECK (mode IN ('absolute','pairwise')),
  pair_word      text,                       -- pairwise 시 상대 표면형
  pair_wins      boolean,                    -- pairwise 시 word 가 pair_word 를 이겼는지
  judged_by      uuid,                       -- auth.users (human) — nullable for llm
  judged_at      timestamptz NOT NULL DEFAULT now()
);
-- 회귀 코퍼스 조회 인덱스
CREATE INDEX idx_ej_source ON extraction_judgments(source_kind, source_id, chapter_idx);
CREATE INDEX idx_ej_word   ON extraction_judgments(lower(word));
```

- **composite/sort_order 스냅샷 보존 이유**: 이후 가중·게이트 변경 PR 이 "라벨 코퍼스 일치율 Δ" 를 보고 → 골든셋 스냅샷 규약과 동형("diff = 리뷰 신호").
- headword 컬럼 추가(설계 초안 대비): §4 바인딩 결함을 라벨에서 역추적하기 위함.

---

## 6. 결정표 — 다음 결재 사항

| # | 항목 | 실측 근거 | 권장 | 상태 |
|---|---|---|---|---|
| **D1** | **바인딩 결함 수리** | 36 반의어 플립 + 654 POS 불일치 (학습자 사실오류) | 호출부 surface-first 바인딩(resolver 는 이미 exact-first) → 782 재바인딩 | ✅ **적용됨** `fix_extraction_surface_headword_binding` (2026-07-18) — 782/782 재바인딩·+143 회수·발행세트 refresh 불요 |
| **D2** | `extraction_judgments` 테이블 | §5 스키마 | 하네스 골든 라벨 저장소 | ✅ **적용됨** `create_extraction_judgments_table` (RLS enabled·정책 D3 시) |
| **D3** | 판정 하네스 P1 착수 | P0.3 쿼리 타당 · 경계 다툼 실측 | `/admin/quality/judge` + pairwise 모드 구축 | ✅ |
| **D4** | freq_rank 백로그 = 사전 1순위 (KICE/kcurr 571 먼저) | working set 6,204 결측(30%), 그중 KICE 238 | 외부 corpus 재조인 백필 | ✅ |
| **D5** | V6 게이트 register-인식화 | book 30·article 275 KICE 게이트 손실 | 수능-지향 콘텐츠엔 게이트 완화(단, 리터러리는 유지) — 설계 결정 필요 | 🟡 논의 |
| **D6** | Q2/Q5 자동지표 `quality_metrics` INSERT | §2 3분해 결정론 산출 확인 | ext_recall_gated/missed · rank_lift 계측 (register 밴드 가드) | 🟡 D1~D4 후 |

**추천 착수 순서**: **D2(스키마 승인) → D1(바인딩 수리 · 사실오류가 가장 급함) → D3(하네스) → D4(freq_rank) → D6(자동지표) → D5(게이트 논의)**.
설계 원안은 "하네스 1순위" 였으나, P0 가 **학습자에게 반대 뜻을 노출하는 확정 사실오류 36건**을 발견 → 하네스(탁월함 측정)보다 바인딩 수리(사실오류)가 선행되어야 한다. 스키마 승인(D2)은 병렬로 즉시 가능.

중단 조건 준수: SELECT + 파일 쓰기(본 리포트)만. 테이블 생성·마이그레이션·커밋 없음.
