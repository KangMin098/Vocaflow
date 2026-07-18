# kaikki 자료 사전DB 업그레이드 기회 — 면밀 분석 (2026-07-18)

> 목적: 확보한 kaikki(Wiktionary, CC BY-SA 3.0, 3.19GB) 자료로 `shared_dictionary`를 더 최적화할 여지(업그레이드·기능·자료·구조)를 **실측 대조**로 판정·우선순위화.
> 근거: shared_dictionary 컬럼/채움률 실측 + kaikki 원본 필드 인벤토리(200k 샘플) + 45k 표제어 교차 정밀 산정(1회 스트림). 저작권: 벤더 중립.

> **진행 상태(2026-07-18 갱신)**: **E 어원 니모닉 ✅ 완료**(v06.268, +2,433 → 5,062·경선식 0). sense 깊이 ✅ 완료(v06.267, +6,494). 아래는 **잔여 기회 재검토 + 심층검증 수치 교정**(per-sense 예문·오디오 UK는 초기 추정이 과대였음).

---

## 1. 현 사전DB 채움 상태 (추출 대상 40,355)

| 필드 | 채움률 | 비고 |
|---|---|---|
| example_en | 95.9% | **단어당 1개 flat** (sense별 아님) |
| synonyms | 64.5% · antonyms 34.1% · collocations 34.7% | parity 부분 |
| ipa | 84.3% | **단일** (`ipa_us`/`ipa_uk` = **0%**) |
| audio_url / _us / _uk | **0%** | 컬럼 존재·비어있음 |
| image_url | **0%** | 컬럼 존재·비어있음 |
| senses (jsonb) | 100% | VRL 4축 구조(meanings_ko와 별개) |
| meanings_ko sense 깊이 | avg 1.475 | v06.267 확대 후 |
| korean_learner_note | 29.4% · mnemonic_ko **6.5%** | 학습 차별화 저채움 |

**핵심**: 스키마는 이미 `audio_url(_us/_uk)`·`ipa_us`·`ipa_uk`·`image_url` 컬럼을 **갖추고 있으나 0%**다 = 마이그레이션 없이 즉시 채울 여지.

---

## 2. kaikki 원본 필드 인벤토리 (미활용 자료)

**엔트리(top) 존재율**: etymology_text 55.9% · forms 60.9% · derived 15.6% · related 8.7% · sounds(다수) · translations 3.3%.
**sense-level 존재율**: glosses 99.9% · **categories 76.8%** · **tags 64.3%** · **examples 42.6%** · topics 18.1% · synonyms 14.4% · form_of 12%.
**sounds 필드**: ipa 197k · **audio/mp3_url 104k** · rhymes 58.7k · homophone 16.5k · enpr 14.8k.

우리가 이미 뽑아 쓰는 것(`kaikki-enrich.json`): ipa · syn · ant · senses(count) · **audio(mp3 URL)**. → audio는 이미 추출돼 있는데 DB 미반영.

---

## 3. 기회 정밀 산정 (43,692 표제어 = 45k ∩ kaikki, 1회 스트림 실측)

| # | 기회 | 규모 | 대상 컬럼 | 마이그 | 환각위험 | 가치 |
|---|---|---|---|---|---|---|
| **A** | **원어민 audio(mp3)** | **30,703 (70.3%)** · US 15,407 · UK **1,628(3.7%)** | audio_url(_us/_uk) 존재·0% | ❌ 없음 | 없음(외부사실) | 🟢🟢 dual-coding·EchoMatch |
| **D** | **문법 정보(가산/불가산·타동)** | **uncnt 30,253+cnt 25,904+타동 8,292** | meanings_ko sense별(jsonb) | ❌ jsonb | 없음(태그 사실) | 🟢🟢 **명시 갭·한국인 최대 약점** |
| **B** | US/UK IPA 분리 | ipa US 15,407 / UK ~15,695 | ipa_us/ipa_uk 존재·0% | ❌ 없음 | 없음 | 🟢 지역 발음 |
| **C** | per-sense 예문 | **clean 13,489 (30.9%)** ←32k는 인용문 포함 과대 | meanings_ko jsonb | ❌ jsonb | 중(인용/연어 필터 필수) | 🟢 문맥의존·sense깊이 시너지 |
| ~~E~~ | ~~어원 니모닉~~ | ✅ **완료 v06.268** (+2,433→5,062·경선식0) | mnemonic_ko | — | — | (done) |
| F | 동음이의 페어(homophone) | 2,713 (6.2%) | 신규 컬럼 | ✅ 필요 | 없음 | 🟡 dictation/spelling |
| G | 라이밍(rhymes) | 16,208 (37.1%) | 신규 컬럼 | ✅ 필요 | 없음 | 🟡 EchoMatch/phonics |
| H | 파생 가족(derived/related) | 18,382 / 10,047 | 신규 컬럼 or jsonb | 🟡 | 없음 | 🟡 형태·어휘망 |
| I | per-sense synonyms | 16,735 (38.3%) | synonyms 보강 | ❌ | 낮음 | 🟡 parity↑ |

---

## 4. Tier별 판정

### 🟢 Tier 1 — 즉시 실행 (마이그 0·컬럼 존재·무환각 외부사실)
- **A. 원어민 audio 30,902** — `kaikki-enrich.json`에 mp3 URL 이미 추출됨. `audio_url`(+US/UK 태그별 _us/_uk) 채움만 하면 됨. **최고 ROI**: 순수 사실·컬럼 준비·학습가치 최상(dual coding 원칙 4 + EchoMatch 청각 입력). Wikimedia Commons 호스팅(CC) → `next/image`/audio 태그 remotePattern만.
- **B. US/UK IPA 분리** — 같은 스트림에서 sounds 태그(US/RP)별 IPA를 `ipa_us`/`ipa_uk`로. 단일 `ipa`는 유지, 지역 구분 추가.

### 🟢 Tier 2 — 높은 학습가치 (jsonb·마이그 0, 품질 게이트 필요)
- **C. per-sense 예문 32,236** — 현 `example_en`은 단어당 1개. kaikki sense.examples를 **meanings_ko 각 sense에 예문 첨부**(방금 확대한 6,494 다의어와 직접 시너지 — "그 sense의 예문"). **게이트**: `type=example`(짧은 실용문)만, `type=quotation`(출전 인용·고문)·`tags=collocation` 별도 취급, offset로 표제어 강조 가능. 학습 원칙 5(문맥의존) 정면 충족.
- **D. 문법 정보 16,571** — sense.tags의 `transitive/intransitive/countable/uncountable/auxiliary…`를 meanings_ko sense별 문법 라벨로. **vs-general 분석 §4-4가 명시한 "문법 정보 부재" 갭을 정면 해소**. 부수효과: 타동성이 문맥-POS sense 해소 정확도를 올림.

### ✅ Tier 2.5 — 어원 근거 니모닉 (완료 v06.268)
- **E. 어원 근거 니모닉 확대 — 완료**: etymology_text 근거 6세션 병렬 +2,433 → **니모닉 5,062**(커버 11.08%). 경선식 차단 게이트(로마자 어근 필수+etymology_text 대조) → **pure_hangul(경선식) 0 검증**. 도구 `mnemonic-etym-{chunk,apply}.mjs`, 지시문 `mnemonic_etym_multisession_20260718.md`. [[feedback_mnemonic_etymology_only]].

### 🟡 Tier 3 — 신규 기능 (마이그 필요, 중가치)
- **F. 동음이의 페어**(2,713) — their/there류. Dictation·SpellForge의 confusable 페어, 오답 유도용. 신규 테이블/컬럼.
- **G. 라이밍**(16,208) — EchoMatch 청각 확장·phonics. 신규 컬럼.
- **H. 파생 가족**(derived 18,382) — meticulous→meticulously/meticulousness. "단어 가족" 학습 + 형태 해소 보강.
- **I. per-sense synonyms**(16,735) — Thesaurus 출처·dialectal 태그 포함. 기존 entry-level syn보다 정밀. parity 보강.

### ⬜ 제외 (희소·불필요)
translations 3.3%(한국어 뜻은 자체 meanings_ko가 우월) · hypernyms/hyponyms 0.9~1.3%(너무 희소) · descendants·wikidata·wikipedia(추출 무관).

---

## 5. 권장 실행 순서 (E 완료 후 재순위)

1. **A 오디오** (즉시·최고 ROI·컬럼 준비·순수 사실) — `kaikki-enrich.json` → audio_url 채움 스크립트 + remotePattern. **30,703** 원어민 발음(US 15,407·UK 1,628). 마이그 0.
2. **D 문법 정보** (재순위↑·명시 갭·한국인 최대 약점) — 가산/불가산(5.6만)·타동성(1.2만) sense.tags → meanings_ko sense별 라벨. **순수 사실·환각 0·jsonb**. 부수효과: 타동성이 문맥-POS 해소 정확도↑. 가산/불가산은 시중 사전 대비 학습 차별화 최강 포인트.
3. **B US/UK IPA** (A와 같은 스트림) — ipa_us/ipa_uk.
4. **C per-sense 예문** (sense 깊이 직접 연장·문맥의존) — **clean 13,489**만(인용문 67.7% 제외). meanings_ko sense별 example. 게이트: type=example·3~22단어·연어/ISBN 제외.
5. F/G/H/I — 신규 기능, 마이그 동반, 별도 판단.

~~E 어원 니모닉~~ ✅ 완료(v06.268).

**즉시 착수 최적 = A(오디오)** → 다음 **D(문법)**. 둘 다 마이그 0·무환각·순수 사실. A는 자료 추출 완료라 30분 내 탑재, D는 한국인 학습자 최대 약점(가산/불가산)을 시중 사전보다 정밀하게 채우는 차별화 카드.

---

## 6. 리스크·주의

- **audio 라이선스**: Wikimedia Commons 파일(CC/PD). URL 저장·핫링크는 관례상 허용이나, 안정성 위해 향후 자가 호스팅 검토(당장은 URL로 충분).
- **per-sense 예문 인용문**: `type=quotation`은 출전 문학 인용(고문·긴 문장·저작권 연도 표기)이라 학습 부적합 다수 → `type=example`(짧은 실용문)만 채택, 나머지 별도.
- **문법 태그 매핑**: kaikki 태그 어휘가 방대(transitive~usually-plural). 학습 유의미한 소집합만 화이트리스트.
- **니모닉**: etymology_text가 근거지만 authoring 시 [[feedback_mnemonic_etymology_only]] 재확인 — 발음 유사 연상 절대 배제, 어근 다리 형식만.
- **무환각 원칙**: A/B/F/G/I는 순수 외부 사실(환각 0). C/D는 필터·매핑(저위험). E만 authoring(중위험·근거 파일 강제).

---

*분석 근거 = shared_dictionary 실측(2026-07-18) + kaikki 원본 필드 인벤토리 + 43,692 교차 정밀 산정. 읽기전용 스크립트: `scripts/dict/_kaikki_fields.mjs`·`_kaikki_opps.mjs`·`_kaikki_sample.mjs`.*
