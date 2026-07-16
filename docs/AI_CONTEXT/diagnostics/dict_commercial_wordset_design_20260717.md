# 시중 단어장 대응 — 사전DB 보완/추가 설계 분석 (2026-07-17)

> 목적: 시중 영단어장을 유형/학년/목적으로 분류하고, 플랫폼이 **원리 기반으로 대응 단어장을 파이프라인 생성**하려면 `shared_dictionary`에 무엇이 더 필요한지 판정.
> 방법: 시중 단어장 조직 원리 taxonomy(지식) × 현재 사전DB 역량(2026-07-17 실측). 표기 **단정**(실측)/추정/확인필요.
> ⚠️ **저작권 경계**: "대응" = 동일 **조직 원리·커버리지**를 플랫폼 자체 축(VRL/frequency/KICE)에서 생성. 특정 상용서의 **단어 선별·배열 복제 금지**(편집저작물). 빈도·레벨·기출·주제는 fact라 무저작권. 벤더명 미사용(코드/DB).

---

## 1. 시중 단어장 3축 분류

시중 단어장은 **조직 원리(유형) × 학년 × 목적**의 조합. 대표 시리즈는 원리 예시일 뿐.

### 1-A. 유형 (조직 원리)
| 유형 | 원리 | 대표(예시) |
|---|---|---|
| **빈도순** | 사용 빈도 rank | 능률보카 빈도, COCA 기반 |
| **레벨별** | 난이도 밴드 | 중등/고등/수능 단계별 |
| **시험 기출** | 특정 시험 기출 코퍼스 빈도 | 수능 기출, 토익 빈출, 공무원 기출 |
| **어원별** | 라틴·그리스 root/접사 묶음 | Word Smart, 배런스 어원, 어원편 |
| **주제별** | 의미 도메인/소주제 | 주제별(음식·여행·의학…) |
| **문맥/예문** | 예문 속 학습 | 뜯어먹는, 어휘끝, 수능특강 어휘 |
| **연상/니모닉** | 발음·이미지 연상 | 경선식 |
| **교과서/내신 연계** | 교과서·교육과정 어휘 | 내신 대비, 교육과정 |
| **word family** | 어근+파생 묶음 | 파생어 계열 |
| **유의어/반의어** | 의미망 묶음 | 뉘앙스·동의어 |

### 1-B. 학년
초등 · 중등(중1–3) · 고등(고1–3/예비고) · 수능 · 성인.

### 1-C. 목적
내신 · 수능 · 토익/토플/텝스 · 공무원 · 편입 · 회화 · 독해 · 어휘력 확장.

---

## 2. 현재 사전DB 단어장-생성 역량 (실측 2026-07-17) — **단정**

플랫폼은 이미 강력한 다축 인프라 + 자동 큐레이션 파이프라인 보유:

| 축 | 구현 | 커버리지 |
|---|---|---|
| **난이도** | `v_level`(V1–11) · `cefr_level`(A1–C2) | 100% classified |
| **빈도** | `frequency_rank` · list_tags `ngsl_1.2`(12,181)·`ngsl_gr`·`ngsl_spoken` | rank 일부 NULL |
| **시험/목적 리스트** | list_tags: `csat-prep-core-2k`(1,838)·`csat-prep-ext-1.8k` · `tsl`(TOEIC 887) · `nawl`(학술 633) · `bsl`/`bel`/`fel`(비즈/금융) · `kcurr2022_0/1/2`(교육과정) · `moel`·`ndl` | 리스트 태깅 |
| **track (VRL)** | literary 31,484 · academic_english 17,407 · general_proficiency 8,482 · **csat_korean 7,232** · conversational 6,904 · business_english 6,414 | level-graded |
| **domain** | literature 27,739 · academic 12,842 · science_tech 3,771 · business 3,067 · news_media 2,704 · travel_culture 775 · entertainment 706 · general | 68–85% band별 |
| **시험 기출 코퍼스** | `word_lexicon`(KICE 수능 5,421 lemma) + `lexicon_frequencies`(기출빈도 `frequency_tier` 2/3/4 · `appears_every_year` · 연도 2014–2026 · `rank_in_source`) | **KICE만** |
| **학년** | `kcurr2022_0/1/2`(교육과정 3밴드, CEFR 프로파일 상이) + `shared_word_sets` category `elementary/middle/high` | 부분 |
| **자동 큐레이션** | `shared_word_sets`(category·subcategory·**curation_query**·auto_curated) + `regenerate_auto_curated_set` RPC | **1,066 auto sets 이미 생성** |
| **의미/예문/POS** | `meanings_ko`(sense) · `example_en`(단일어 100%) · `pos` · `ipa`(부분) | |
| **연어/파생/유의** | `collocations`(31%) · derivational-candidates(형태 파생) · `synonyms`(부분) · `antonyms`(31%) | |

**핵심**: `curation_query`(JSON)가 이미 `select_*_vocab` / `kice_csat`(`question_nos`·`raw_count_min`·`min_years`) 필터를 실행 → **수능 문항유형별 세트**(`q18_24_purpose`·`q31_34_blank`·`q41_43_long`)·**기출 tier 세트**(`frequent_8plus`·`frequent_tier4`)를 이미 생성 중.

---

## 3. 대응 매핑 — 시중 유형 → 현재 역량

| 시중 유형 | 필요 축 | 현재 역량 | 판정 |
|---|---|---|---|
| 빈도순 | freq rank | `frequency_rank`+NGSL | ✅ 커버 (rank NULL 갭 보정 필요) |
| 레벨별(중/고/수능) | 난이도+학년 | V-Level+CEFR+kcurr2022 | ✅ 커버 |
| **수능 기출 빈출** | 기출 코퍼스 | KICE `lexicon_frequencies`(tier·year·문항) | ✅ **커버 (문항유형까지, 시중 이상)** |
| 문맥/예문 | 예문 | `example_en` 100%+`source_sentence` | ✅ 커버 |
| EBS/수능특강 연계 | 특정 지문 어휘 | ACP article 세트+csat track | 🔶 부분 (특정 교재 미연동) |
| **토익/토플/텝스** | 시험 기출 빈도 | TSL/NAWL/BSL **리스트만**, 기출빈도 코퍼스 없음 | 🔶 부분 (리스트 O·기출빈도 X) |
| 주제별 | domain subtopic | domain 8개(거침), subtopic 없음 | 🔶 부분 |
| 교과서/내신 | 교과서·교육과정 | kcurr2022 O, 특정 교과서 미연동 | 🔶 부분 |
| word family | 어근+파생 | derivational(형태)만 | 🔶 부분 |
| 유의어/반의어 | 의미망 | syn 부분·ant 31% | 🔶 부분 |
| **어원별(root/접사)** | 라틴·그리스 root | **word_roots 없음** | ❌ 갭 |
| **공무원/편입** | 해당 시험 기출 | **코퍼스 없음** | ❌ 갭 |
| **연상/니모닉** | mnemonic | `mnemonic_ko` **0%** | ❌ 갭 |

**요지**: 레벨별·빈도순·수능기출·문맥예문은 **이미 생성 가능**. 갭은 **① 어원 축 ② 시험별 기출 코퍼스 ③ 니모닉 ④ 주제 subtopic ⑤ 학년 정밀화**.

---

## 4. 갭별 사전DB 보완/추가 설계

### G1. 어원(etymology) root 축 — **최대 갭** (❌)
시중 핵심 카테고리(Word Smart류)인데 전무. 형태 파생(`derivational-candidates`)은 있으나 라틴/그리스 **root 묶음**(spect/port/dict…)은 없음.
- **스키마**: `word_roots`(id·root·origin(latin/greek)·gloss_ko·meaning_en) + `word_root_links`(word·root_id·affix_type prefix/root/suffix) — (word,root) PK 자연 멱등.
- **소스**: kaikki etymology(**부재** — [[dict_w0_20260716]]) 또는 **표준 학술 root 리스트 300–500개 시드**(공개 라틴/그리스 어근) + LLM 단어↔root 매핑(외부 root 리스트를 증거로 쥐면 검증 가능).
- **이중배당**: 어원 단어장 생성 + 추출 시 파생어 인식·미바인딩 감소 + 니모닉 품질↑.
- **비용**: 소스 확보가 병목. W0 어근 성립 판정(형태 base ≥3=116<200)은 어원 root와 별개 — 어원 root는 시드 리스트로 우회 가능.

### G2. 시험별 기출 코퍼스 확장 — **높은 가치** (🔶→❌)
KICE 수능만 실제 기출빈도 코퍼스 보유. 토익/토플/텝스는 list_tag만(빈출 순위·연도 없음), 공무원/편입은 전무.
- **스키마**: 기존 `lexicon_frequencies`(source_id·raw_count·tier·year·question_no) **재사용** — 소스만 추가(`toeic`/`gongmuwon`/`pyunip`).
- **소스**: 각 시험 공개 기출/샘플 코퍼스 확보(라이선스 확인 필수) → KICE 파이프라인 복제.
- **이중배당**: 목적별 단어장 + track_levels(business/academic) 정밀화.
- **비용**: 코퍼스 확보(외부·라이선스)가 병목 = W0 kaikki와 동일 계열 문제.

### G3. 학년 정밀 축 (🔶)
kcurr2022_0/1/2(교육과정 3밴드) + elementary/middle/high 세트는 있으나 중1/중2/고1 세분·정규화 미흡.
- **스키마**: `shared_dictionary.grade_band`(파생 컬럼 금지 원칙 주의 — 저장 대신 kcurr2022+CEFR+v_level 조합으로 **런타임 파생** 권장) 또는 `grade_axis` 뷰.
- **소스**: 이미 보유(kcurr2022 = 2022 개정 교육과정). 매핑 규칙만 확립(kcurr2022_1≈기초/중등, _2≈고교기본, _0≈고교심화 — CEFR 프로파일로 검증).
- **비용**: 낮음(내부 자산). **저작권 안전**(교육과정=공공).

### G4. 주제 subtopic 세분 (🔶)
domain 8개는 거침. 시중 주제별(음식/여행/의학/법률/IT/환경/스포츠…)은 더 세분.
- **스키마**: `list_tags` 확장(`topic:food`·`topic:medicine`…) 또는 `domain_subtopics` jsonb.
- **소스**: LLM 주제 태깅(도메인 내 세분은 자가생성 허용 가능 — 저위험).
- **이중배당**: 주제 단어장 + 도서/글 추출 도메인 정밀화.

### G5. 니모닉/연상 (❌)
`mnemonic_ko` 0%. 경선식류 차별화 요소.
- **소스**: LLM 생성(어원 root G1 연계 시 품질↑ — "spect=보다 → inspect 안을 보다"). 단독 발음연상은 품질 편차 큼.
- **비용**: LLM 적합하나 품질 관건. G1 이후 권장.

### G6. 단어장 메타 정규화 (🔶)
`shared_word_sets.category/subcategory`는 자유텍스트. 시중 대응 세트 카탈로그화 위해 정규 축 필요.
- **스키마**: `purpose`(csat/toeic/…)·`grade_band`·`org_principle`(freq/level/exam/root/theme…) 명시 컬럼 + `curation_query` 템플릿화.
- **비용**: 낮음. 파이프라인 관리성↑.

---

## 5. 우선순위 (가치 × 구축가능성 × 이중배당)

| 순위 | 항목 | 가치 | 구축가능성 | 병목 |
|---|---|---|---|---|
| **1** | G3 학년 정밀화 | 중 | **높음**(내부 자산) | 없음 — 즉시 가능 |
| **2** | G4 주제 subtopic | 중 | **높음**(LLM 저위험) | 없음 |
| **3** | G6 메타 정규화 | 중 | 높음 | 없음(migration+승인) |
| **4** | G1 어원 root | **높음** | 중 | 소스(root 리스트 시드로 우회 가능) |
| 5 | G2 시험 코퍼스 확장 | 높음 | 낮음 | **외부 코퍼스·라이선스** |
| 6 | G5 니모닉 | 중 | 중 | 품질(G1 선행) |

**즉시 착수 가능(소스 불요)**: G3·G4·G6 = 학년/주제/메타. 이것만으로 시중 **레벨·학년·주제·목적(수능)** 대응이 체계화됨.
**소스 확보 후**: G1(어원 root 리스트)·G2(시험 코퍼스) — W0 kaikki 계열 병목과 동일.

---

## 6. 파이프라인 설계 — curation_query 확장

기존 `curation_query`(JSON) + `regenerate_auto_curated_set`를 시중 유형 템플릿으로 확장:

```jsonc
// 예시 템플릿 (org_principle별)
"빈도순 고교 2000":   {"org":"freq",  "filters":{"cefr_in":["B1","B2"]}, "order":"frequency_rank", "cap":2000}
"수능 기출 빈출":     {"org":"exam",  "source_key":"kice_csat", "filters":{"raw_count_min":8}, "cap":1500}   // ✅ 이미 가능
"수능 문항유형 빈칸": {"org":"exam",  "source_key":"kice_csat", "filters":{"question_nos":[31,32,33,34]}}     // ✅ 이미 가능
"학년 중2":           {"org":"grade", "filters":{"list_tag":"kcurr2022_1","cefr_in":["A1","A2"]}}            // G3 후
"주제 의학":          {"org":"theme", "filters":{"topic":"medicine"}}                                        // G4 후
"어원 con- 접두사":   {"org":"root",  "filters":{"root":"con","affix":"prefix"}}                             // G1 후 (신축 필요)
"토익 빈출":          {"org":"exam",  "source_key":"toeic", "filters":{"raw_count_min":N}}                   // G2 후
```

- generate: `regenerate_auto_curated_set` 확장(org별 selection 로직) → `shared_word_sets` INSERT.
- 검증: cap·중복·밴드 정합 = 기존 publish 파이프라인 재사용.

---

## 7. 적대 검토 (오류 우선)

1. **저작권 (최대)** — 시중 단어장 "대응"이 특정서 단어 리스트 복제로 흐르면 편집저작물 침해. **완화**: 반드시 플랫폼 자체 축(VRL/NGSL/KICE/교육과정)에서 파생, 특정 상용서 매핑 금지. 빈도·기출·교육과정은 fact. — **단정**
2. **소스 병목이 G1·G2·G5 발목** — 어원·시험코퍼스·(니모닉 품질)은 외부 증거 없이는 자가생성 저품질(W0 결론 재적용). **G3·G4·G6부터** 착수해 소스-독립 가치 선확보. — **단정**
3. **학년 매핑 검증 필요** — kcurr2022_0/1/2 ↔ 실제 학년 대응은 CEFR 프로파일 기반 **추정**. 실제 2022 개정 교육과정 어휘 등급표와 대조 필요. — 확인필요
4. **G3 컬럼 저장 안티패턴** — `grade_band` 컬럼 저장은 CLAUDE.md 파생-저장 금지 원칙(memory_state류)과 충돌 가능 → **런타임 파생/뷰** 권장. — **단정**
5. **domain subtopic 자가생성 범위** — 도메인 내 세분(food/medicine)은 저위험이나, 경계 모호어(예: apple=food/tech) 다중 태깅 필요. — 추정

---

## → 결론

플랫폼은 시중 단어장의 **레벨·빈도·수능기출·문맥예문**을 **이미 생성 가능**(curation_query 파이프라인 + 4축 VRL + KICE 코퍼스, 1,066 auto sets). 시중 대비 **우위**는 수능 문항유형별·기출연도별 세트(시중 이상 정밀).

진짜 보완은 5개: **어원 root(G1)·시험코퍼스 확장(G2)·학년 정밀(G3)·주제 subtopic(G4)·니모닉(G5)** + 메타 정규화(G6). 이 중 **G3·G4·G6은 소스 없이 즉시** 착수 가능하고, **G1·G2·G5는 외부 소스 확보가 선결**(W0 kaikki 병목과 동일 계열).

**권장 착수 순서**: G3(학년)→G4(주제)→G6(메타) 먼저 = 소스-독립으로 시중 학년/주제/목적 대응 체계화. 이후 소스 확보 시 G1(어원)·G2(시험) — 가장 가치 크나 병목.

---
*분석 종료. 실측 근거 = shared_dictionary/shared_word_sets/word_lexicon/lexicon_frequencies/list_tags/track·domain_levels (2026-07-17). 코드 변경 없음(설계 분석).*
