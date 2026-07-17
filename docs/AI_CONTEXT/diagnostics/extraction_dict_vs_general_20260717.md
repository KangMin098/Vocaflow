# 단어추출 사전DB ↔ 일반 사전 비교 분석 — 보완/개선/우위 (2026-07-17)

> 목적: `shared_dictionary`(단어추출용 사전)를 시중 일반 사전(Oxford/Merriam/네이버 사전류)과 비교해, **추출 목적** 관점의 보완 필요·개선·우위를 면밀히 판정.
> 근거: shared_dictionary 실측(2026-07-17) + 추출 파이프라인(resolve_dict_headword·infer_form_pos·per-sense 매칭). 저작권: 벤더 중립.

---

## 1. 진행 상태 (현재 보완 수준 — 실측)

**추출 풀 = classified 45,667행 · 추출 대상(노이즈 register 제외) 40,355행.**

| 축 | 값 | 비고 |
|---|---|---|
| 핵심(뜻·품사·CEFR·v_level) | **100%** (45,667) | 맞는 단어·그 형태의 맞는 뜻 보장 |
| per-sense v_level(다의어) | **100%** (10,144 완비) | Phase B 종결 |
| 형태 해소 inflected_forms | 33% (15,210) | 굴절형→표제어 |
| example_en(추출대상) | 96% (38,720) | 단일어 100% |
| frequency_rank | 63% (28,673) | 외부 코퍼스 매칭분 |
| ipa | 64% · syn 58% · ant 31% · **coll 31%** | kaikki 병목(후술) |
| mnemonic_ko | 2,623 | 어원 근거·발음말장난 0 |
| korean_learner_note | 27% · list_tags 30% | 학습 차별화 |

**이미 수행한 비교·보완**(직전 세션 종합): 외부 빈도코퍼스(NGSL 교차검증)·CEFR-J·시드사전·lexicon_frequencies 통합 → 커버리지·빈도·레벨 골격 · dict-fill로 5~9필드 · per-sense v_level 100% · sense/POS 근본수리 · 어원 root+니모닉. **kaikki(Wiktionary dump) 부재로 syn/ant/ipa/sense추가의 외부검증 채움은 의도적 보류.**

---

## 2. 일반 사전 vs 추출 사전DB — 차원별 비교

| 차원 | 일반 사전 | 추출 사전DB | 판정 |
|---|---|---|---|
| **표제어 수** | 10만+ | 45,667 | 🔴 일반사전 우세(단, 추출대상 한정=일부 의도) |
| **sense 깊이** | 표제어당 **3~5+** sense·세분 계층 | **avg 1.28** (단일 75%·3+ 2.6%) | 🔴 얕음 — 추출 정확도 리스크 |
| **문법(가산/타동/패턴)** | 상세 | 없음(POS만) | 🔴 없음 |
| **IPA/발음** | US/UK + 음성 | ipa 64%·음성 TTS만 | 🟡 부분 |
| **동의/반의/연어** | ~100% | syn 58·ant 31·coll 31% | 🔴 부분(kaikki 병목) |
| **예문** | sense별 다수 | 단일어 100%·문맥 예문 | 🟢 대등 |
| **어원** | 있음(설명) | root 분해 + **니모닉** | 🟢 학습형 우위 |
| **난이도(학습자)** | 없음 | **v_level(sense별)·CEFR·CEFR-J** | 🟢 고유 우위 |
| **문맥 sense 해소** | 나열만(사람이 고름) | **자동 POS-sense 매칭** | 🟢 고유 우위 |
| **개인화(i+1)** | 없음(정적) | v_level+빈도+track/domain | 🟢 고유 우위 |
| **형태 해소** | 표제어 링크 | inflected_forms→lemma 자동 | 🟢 추출형 우위 |
| **학습자 교정** | 없음 | word_familiarity(알아요/몰라요) | 🟢 고유 우위 |

---

## 3. 🟢 우위 — 일반 사전이 **구조적으로 못 하는** 것 (추출/학습 목적)

일반 사전은 "참조(reference)" 도구, 추출 사전DB는 "학습-추출(learning-extraction)" 엔진. 후자만의 우위:

1. **per-sense v_level (sense별 한국 학습자 난이도)** — 일반 사전엔 학습자 난이도가 아예 없음. 다의어 10,144개 sense별 v_level 100% → 추출 시 **그 sense의 정확한 난이도**로 i+1 필터·V 배지.
2. **문맥-POS sense 자동 해소** — 일반 사전은 모든 sense를 나열하고 사람이 고름. 추출DB는 `resolve_dict_headword`+`infer_form_pos`로 **텍스트에 나온 형태의 맞는 sense/POS를 자동 선택**(ransomed→동사 "몸값 치르고 풀어주다", children→아동 복수). 추출의 핵심 지능.
3. **i+1 개인화 추출** — v_level + frequency_rank + track/domain 4축으로 **학습자 수준에 맞춘 단어만** 추출. 일반 사전은 one-size 정적.
4. **형태 해소(굴절→표제어)** — inflected_forms/base_word로 surface→lemma 자동 해소(불규칙 포함). 추출 회수율 98%+.
5. **학습자 교정 루프** — `word_familiarity`(알아요/몰라요)가 추출 제외·오난이도 신호로 되먹임. 사전이 학습자에 적응.
6. **어원 니모닉** — 2,623개 어근 근거 니모닉(발음 말장난 0). 일반 사전은 어원을 "설명"만, 학습형 기억장치 아님.
7. **추출 근거(투명성)** — score_breakdown → "왜 이 단어" 근거 카드(트랙빈출·i+1·형태해소). 일반 사전엔 없는 개념.
8. **시험/레벨 타깃 태깅** — NGSL·CSAT·교육과정 list_tags로 목적별 추출.

→ **핵심**: 추출 사전DB는 "얼마나 많은 정보"가 아니라 "학습자에게 맞는 단어를, 맞는 뜻으로, 맞는 난이도에" 뽑는 데 최적화. 이 축들은 일반 사전이 원리상 제공 불가.

---

## 4. 🔴 보완 필요 — 일반 사전이 더 풍부하고, **추출에 영향**

1. **sense 깊이(최대 갭)** — avg 1.28 sense(일반 3~5+). 단일-sense 75%·3+ sense 2.6%. **텍스트가 드문 sense를 쓰면**(spring=용수철/샘, bank=둑) 그 sense가 없어 대표 뜻으로 오해소 위험. 문맥-POS 매칭도 **sense가 존재해야** 작동 → 없으면 무력. **근본 해결 = 다의어 sense 추가**(권위 소스=kaikki 필요, 현 보류).
2. **동의/반의/연어(kaikki 병목)** — syn 58·ant 31·coll 31%. 일반 사전 ~100%. 추출 툴팁·플래시카드 노출 시 결측. 특히 **연어 꼬리(8천위+ 25~33%)**·미랭크 IPA 9%.
3. **표제어 커버리지** — 45k vs 10만+. 고급/전문/다어절은 추출 대상에서 누락 가능. **추출대상 한정은 일부 의도**(학습 무관어 배제)이나, 고난도 원서·전문 지문엔 miss 발생.
4. **문법 정보 부재** — 가산/불가산·자/타동·문형 패턴 없음. 추출엔 영향 적으나(POS로 충분) 학습 심화엔 갭.

---

## 5. 🟡 개선 — 품질 정밀화 (있는 데이터로)

1. **문맥-POS 라이브 parity** — context-POS sense 매칭이 **배치 스크립트엔 있으나 BYO 라이브 추출 RPC엔 미배선**(winkNLP deferred). 라이브 `/text/new` 추출에서 "문맥 뜻 먼저" 미적용. → 라이브 RPC에 문맥-sense 경로 연결.
2. **per-sense v_level = 다의어 100%지만 sense 자체가 얕음** — 정밀도는 완비, 남은 건 sense **개수**(§4-1).
3. **미랭크 tail 16,994** — 추출 노출 낮으나 희소. 노출 단어 우선 보강.

---

## 6. 종합 판정 + 우선순위

**결론**: 추출 사전DB를 일반 사전과 "정보량"으로 비교하면 apples-to-oranges. **추출/학습 목적 축(per-sense 난이도·문맥해소·i+1·형태해소·교정·니모닉)에선 일반 사전을 압도**하고, 이는 원리상 대체 불가한 우위다. **약점은 (a) sense 깊이 (b) parity 필드(syn/ant/coll/ipa)**이며, 둘 다 **권위 sense/어휘 소스(kaikki) 부재가 근본 병목** — 자가생성은 품질 원칙상 보류 중이라 "미완"이 아니라 **의도적 보류**.

| 우선순위 | 항목 | 가치 | 병목 |
|---|---|---|---|
| **1** | 문맥-POS 라이브 RPC parity(§5-1) | 높음(라이브 추출 정확도) | 없음 — 배선만 |
| **2** | 연어/동의 노출단어 우선 보강 | 중(툴팁·카드) | kaikki(부분 우회 가능) |
| **3** | 다의어 sense 추가(§4-1) | 높음(추출 정확도) | **kaikki 확보 필요** |
| 4 | 표제어 커버리지 확대 | 중 | kaikki/코퍼스 |
| 5 | 문법 정보 | 저(학습 심화) | 소스 |

**즉시 actionable = §5-1(라이브 문맥-POS 배선)** — 소스 병목 없이 라이브 추출의 "문맥 뜻" 정확도를 올림. 나머지(sense 깊이·parity)는 kaikki 확보가 선결이라 [[project_dict_wave_plan_w0]] 재개 조건과 동일.

---

## 7. kaikki 확보 + 진행 (2026-07-17) — W0 블로커 해소

**확보**: kaikki(Wiktionary 파생, **CC BY-SA 3.0**) `kaikki.org-dictionary-English-words.jsonl` **3.19GB** 다운로드(`scripts/dict/data/`, gitignore). 상용 벤더 아님·무료 라이선스 → 사용 가능.
**파이프라인**(`scripts/dict/kaikki-enrich.mjs`): `extract`(3.19GB·148만 줄 스트림 → 45k 표제어 필터) → `apply-ipa/syn/ant`(결측만·멱등·**외부검증 사실=무환각**).
**커버리지**: 45,667 표제어 중 **43,692(95.7%)가 kaikki 존재**. 추출: IPA 29,199·audio(mp3) 30,902·**avg 4.5 sense**(≥5 sense 12,131).

**적용(PoC)**: **IPA 5,879 결측 채움** → ipa **64%→76.9%**(29,230→35,109). 자가생성 아닌 외부 사전 사실. 0 실패.

**kaikki가 열어준 후속(§4 근본해소 자원)**:
- **sense 깊이(최대 갭 해소)**: kaikki avg 4.5 sense·≥5 sense 12,131 → 다의어에 kaikki 영어 gloss를 **근거로** 한국어 sense 추가(per-sense pos/v_level) authoring. 추출 정확도(드문 sense 오해소) 근본 개선. **대량 batch — 별도 착수.**
- **audio**: mp3 URL 30,902 → 원어민 발음(스키마 컬럼 `audio_url` 신설=마이그 필요).
- syn/ant: kaikki 구조화 필드 희소(4,636/3,510)라 기존 dict-fill이 우세 — 저우선.

**갱신 결론**: §6의 "kaikki 확보 선결" 병목이 **해소됨**. 이제 sense 깊이·IPA·audio의 외부검증 보완이 buildable. [[project_dict_wave_plan_w0]] 재개 조건 충족.

---
*분석 + kaikki 확보/IPA PoC 적용. 근거 = shared_dictionary 실측 + kaikki EN words 3.19GB. IPA 5,879행 보완.*
