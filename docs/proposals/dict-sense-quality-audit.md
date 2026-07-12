# shared_dictionary sense/POS 품질 감사 — 다의어 primary 오선정

> 상태: **감사 + 부분 수리 완료** (2026-07-12) · 전수 sweep 잔여
> 배경: 큐레이션 단어추출 검증에서 `creep="변태"` 등 문맥과 다른 뜻 발견 → 근본이 추출 로직이 아니라 **shared_dictionary sense 선정 품질**로 규명.

## 근본 원인 (RC1)
`shared_dictionary`의 다의어에서 enrichment(Claude classification)가 **흔한 sense를 누락하고 특수·희귀 sense를 primary로 선정**한 경우가 존재. 단어세트는 `meaning_ko`(평면 primary)를 그대로 표시 → 학습자가 문맥과 다른 뜻을 학습.

### 패턴 — primary가 특수 sense, 흔한 sense 누락
| 단어 | 오류 primary | 누락된 흔한 뜻 |
|---|---|---|
| creep | 변태(noun) | **기어가다(verb)** |
| nettle | 짜증나게하다(verb) | **쐐기풀(noun·식물)** |
| founder | 침몰하다(verb) | **창립자(noun)** |
| spiritual | 흑인 영가(noun) | **영적인(adjective)** |
| bay | 적갈색의(말털·adj) | **만(灣)(noun)** |
| steam | 찌다(verb) | **증기(noun)** |

특징: **primary POS가 그 단어의 지배적 POS가 아님** + 특수 도메인(말털·항해·종교민요) sense가 앞섬.

## 규모
- V≥6 분류어 **34,076** · 다의어(≥2 sense) **7,157(21%)** · multi-POS 인벤토리 **2,171(6.4%)**.
- 감사 표본(발행 노출 mid-rank 다의어 ~135개) 오류율 **~8%**(egregious+부분누락). 상위 흔한어(rank<2800)는 대부분 정상 — mid-rank(2800-16000) 군집.

## 수리 완료 (11 단어 · 사전 교정 + 발행 세트 전파)
creep·nettle·founder·spiritual·bay·steam (primary 교정) + shed·sacrifice·grip·echo·faint (누락 sense 보강). 발행 `shared_words` ~130 appearance 전파(creep 19·faint 23·echo 18·shed 17·steam 14 등). `meaning_ko`+`part_of_speech` 갱신.

## 전수 근절 계획 (잔여)
탐지가 **기계적으로 어려움**(특수 sense를 primary로 고른 건 Claude 판단 필요). 방법:
1. **후보 축소**: 발행 노출 다의어(mid-rank) 우선 → 학습자 임팩트 큰 순.
2. **배치 Claude 재검수**: `dict-enrich`/`vcb-reenrich` 스킬로 각 다의어의 (a) 흔한 sense가 primary인가 (b) 흔한 sense 누락 없나 검수 → 교정.
3. **탐지 프록시(보조)**: winkNLP 코퍼스 POS 분포 vs 저장 primary POS 불일치 = 후보 플래그(예: bay 실사용은 noun 지배인데 저장 adj).
4. **발행 전파**: 교정 후 `shared_words` 갱신(위 패턴).

## 자동 탐지기 (2026-07-12) — `scripts/audit-dict-pos-mismatch.mts`
winkNLP(파이프라인 동일)로 추출 단어의 실제 문맥 sentence(146,831개) POS 태깅 → 단어별 지배 POS 집계 → 저장 primary POS 대조. **804건 불일치**(지배 POS ≠ 저장, 확신≥0.7, 표본≥3). 재사용 QA 자산.

## ⚠ 더 깊은 근본 원인 (탐지기가 규명) — 단어당 1행 + 최난이도 sense V-Level
탐지 결과 top(high·small·mean·like·help)이 드러낸 진짜 근본:
- shared_dictionary는 **단어당 1행 + v_level = 가장 어려운 sense 기준**.
- 다의어가 **기본 sense(저-V) + 고급 sense(V≥6)**를 가지면(high: 높은 V2 + 황홀감 V7), 행의 v_level은 V7 → **V≥6 필터 통과**, primary는 고급 sense(황홀감).
- 추출이 텍스트의 **기본 용법(높은)**을 잡아도 → 사전 행은 고급 gloss(황홀감) → **기본 용법이 고급 뜻으로 오추출**.

### 두 부류
| 부류 | 예 | 성격 | 수리 |
|---|---|---|---|
| **A** | creep·founder·bay·nettle·spiritual | 두 sense 다 비기본, primary 오선정 | 사전 재-enrichment (11건 완료) |
| **B** | high·small·mean·like·help·show (685건) | 기본 sense 저-V → V≥6 항목이 고급 sense뿐 → 기본 용법 오추출·오gloss | **아키텍처** (아래) |

## 근본 해결책 — sense별 V-Level 아키텍처 (최고 품질 목표)
1. **sense별 v_level**: `meanings_ko` 각 sense에 `v_level` 부여(기본 sense=저-V, 고급 sense=고-V). 이미 {pos, meaning} 구조 존재 → v_level 필드 추가.
2. **문맥 POS 저장(RC3)**: 추출 시 winkNLP 문맥 POS를 `library_book_vocabularies`에 저장(현재 폐기).
3. **문맥-sense 매칭 추출**: 추출 JOIN이 문맥 POS로 `meanings_ko`에서 sense 선택 → **그 sense의 v_level로 V≥6 필터** + 그 sense의 gloss 표시.
   - 효과: high(높은=V2 sense)는 V≥6 탈락(오추출 근절) · high(황홀감=V7 sense)만 통과(정확 gloss) · venture(문맥 verb)는 동사 sense 선택.
4. **A류 재-enrichment**: 위와 별도로 primary 오선정(creep류)은 배치 Claude 재검수(`dict-enrich`).

이로써 **기본 용법 오추출·오gloss(B) + 다의어 primary 오류(A)** 모두 근절 → 사전 최고 품질. 단 (1)(2)(3)은 스키마+추출+파이프라인 변경이라 단계적 구현 필요.

## Phase 1 진행 — sense별 v_level 모델 (2026-07-12)
- **탐지기 V≥6 한정 재측정**: 실 study word POS 불일치 **488건**(비-study 기본어 제외 804→488).
- **모델 확립**: `meanings_ko` 각 sense에 `v_level` 필드. 예: `swallow=[{verb,"삼키다",v_level:4},{noun,"제비",v_level:6}]` · `sole=[{adj,"유일한",v_level:5},{noun,"발바닥",v_level:6},{noun,"서대",v_level:9}]`.
- **적용(누적 17단어)**: creep·nettle·founder·spiritual·bay·steam(A류 primary) + shed·sacrifice·grip·echo·faint(누락보강) + **swallow·swift·crush·spoil·sole·stern(sense v_level 모델)**. 발행 세트 ~220 appearance 교정.
- **잔여 sweep**: 488 study-word 후보 배치 Claude 재검수(`dict-enrich`) — 각 다의어 (a) 흔한 sense primary화 (b) sense별 v_level 부여 (c) 누락 sense 보강. 탐지기 `audit-dict-pos-mismatch.mts`가 후보 자동 생성.

## Phase 2 — 문맥 POS 저장 (2026-07-12 · 완료)
- **스키마**: `library_book_vocabularies` + `library_article_vocabularies` 에 `context_pos text` 추가(additive·nullable). 마이그 `20260712160000_vocab_context_pos.sql`.
- **백필**: `scripts/backfill-context-pos.mts` — multi-POS(≥2 POS·V≥6) 단어 1,020개 대상, 각 추출 행의 `first_sentence` 를 winkNLP(파이프라인 동일) 태깅 → 단어 POS 저장. **book 1,507 + article 212 행** 백필.
- **파이프라인 forward-wiring**: `extract-lemmas.ts` 가 chapter 지배 POS(최다 등장) 계산 → `ChapterWord.context_pos` → `insert_book_analysis` RPC(`20260712170000`) + article 직삽입이 저장. **신규 도서/아티클은 백필 없이 파이프라인에서 바로 채움**.

## Phase 3 — 문맥-sense 매칭 추출 (2026-07-12 · 완료)
- **추출 함수 재설계**: `select_book_chapter_vocab` + `select_article_vocab` 에 LATERAL JOIN 추가(`20260712165000`) — `context_pos` 로 `meanings_ko` 에서 문맥 POS 일치 sense 선택 → **그 sense 의 v_level 로 V≥6 필터** + 그 sense 의 gloss·pos 표시. 미백필(NULL)은 row 값 폴백(하위호환).
- **검증(실동작)**:
  - `creep`(문맥 verb) → gloss "기어가다"(verb sense) 표시 — 오gloss "변태" 근절.
  - `sole`(문맥 adjective, sense v5) → Gibbon/Les Mis 추출에서 **0건**(V≥6 탈락) — 기본 용법 오추출(B류) 근절 실증.
- **효과**: A류(primary 오선정) = 사전 재-enrichment로 근절 · B류(기본 sense 저-V 다의어) = 문맥 sense v_level 필터로 근절. 사전 단일-행 한계를 sense별 v_level + 문맥 매칭으로 우회.

## 잔여 sweep 배치 1 — 40단어 sense 보강 (2026-07-12 · 완료)
- **후보 재측정**: 코퍼스 확대(146,831 sentence)로 POS 불일치 **504건**(🔴누락 441·🟡선택 63). content↔content POS + rank≤8000 + 비-ing 필터 → **고가치 179건** 선별.
- **배치 1 적용(40단어)**: 각 단어에 누락 POS sense 추가 + **모든 sense에 v_level 부여** + 지배 sense로 flat primary 정렬. 검증 40/40(전 sense v_level·multi-POS). 발행 `shared_words` 424 appearance gloss 동기화.
  - 예: `yield`→동사"산출/양보"(v6) · `noble`→형용사"고귀한"(v6) · `grasp`→동사"이해하다"(v6) · `disguise`·`drain`·`halt`·`reign`·`sack`·`wax`·`hedge`·`tuck` 등.
  - **B류 근본 실증**: `minor`(형용사"사소한" **v5** + 명사"미성년자" v6) · `idle`(형용사"한가한" v5) · `damp`(형용사 v5) — 기본 sense v5로 Phase 3가 문맥 형용사 용법을 **V≥6 탈락**(오추출 근절), 특수 명사 sense만 study.
- **context_pos 재백필**: 40단어가 신규 multi-POS화 → `backfill-context-pos.mts` 재실행으로 lbv/lav 문맥 POS 채움(Phase 3 sense-matching 활성).

## 잔여 sweep 배치 2 — 109단어 sense 보강 (2026-07-12 · 완료)
- **고가치 179 중 잔여 139 처리**: 실 누락 sense **109단어** 교정 + 형식 오류 정규화(string-array/enrichment-schema → `{pos,meaning,v_level}`). 나머지 ~30은 스킵(형용사 primary가 이미 정답: prior·secular·temporal·nasal·aquatic 등 속성적 명사 오태깅 / lo·ironed 노이즈).
- **flat primary 대량 교정(지배 sense로 flip)**: `breeze`→명사"산들바람" · `pine`→명사"소나무"(v5) · `coral`→명사"산호" · `vacuum`→명사"진공,공백" · `crumble`→동사"부서지다" · `refrain`→동사"삼가다" · `orderly`→형용사"질서정연한" · `trumpet`→명사"트럼펫" · `courtesy`→명사"예의" · `homeless`/`peripheral`/`collective`/`compact`/`invalid`/`thermal`/`unemployed`→형용사 · `dictate`/`tread`/`underscore`/`rinse`→동사 등.
- **A류 오데이터 근절**: `wan` 저장값 "광역 통신망 WAN"(약어 오분류) → **"창백한, 핏기 없는"(형용사)** 교정.
- **검증 109/109**(전 sense v_level) · 발행 `shared_words` 동기화(불일치 0) · context_pos 재백필.
- `pine`(소나무 v5)·`orderly`/`homeless`/`peripheral`(기본 형용사 저-V) 등도 B류 자동 제외 대상 확대.

## 배치 3 — 잔여 tail 5단어 + sweep 종결 판정 (2026-07-12 · 완료)
- **재탐지(154 수리 후)**: 438후보(🔴누락 293·🟡선택 145). 🔴 441→293(수리분 탈락), 🟡 63→145 **증가**(sense 추가했으나 flat primary 미flip분이 🟡로 전환).
- **핵심 판정 — 🟡 145는 대부분 이미 인벤토리 완성**: grave·damp·bound·faithful·comb·glare·hum·usher·overflow·haunt·plow 등은 배치1/2에서 양쪽 sense를 이미 보강. Phase 3가 `context_pos`로 sense-매칭하므로 **추출은 이미 정확**. flat primary는 대체로 합당한 학습자 기본값(grave→무덤·stem→줄기·damp→축축한)이라 noisy한 first_sentence 코퍼스로 flip하면 오히려 악화 위험 → **flat flip 미실시**.
- **🔴 293 잔여 성격**: 명사화(the unconscious/eldest/infinite)·형용사-primary-정답(prior·temporal·jagged·brittle·oval)·participle 노이즈(trample/horrified)·기능어(lo)가 압도. 실 누락은 소수.
- **배치3=실 누락 5단어**: brood(+명사"한배 새끼")·tug(+동사)·inevitable(명사→형용사 flip"불가피한")·dummy(+형용사)·unconscious(+명사"무의식"). shared_words 동기화.

## 종결 요약 (문맥-매칭 sweep)
- **고가치 후보(179) 전량 종결** + tail 5 = **누적 사전 수리 154단어**(초기 17 + 배치1 40 + 배치2 109 + 배치3 5, 일부 중복). 전 sense v_level 부여.
- **남은 🟡·🔴는 (a) 인벤토리 완성돼 Phase 3가 이미 처리 (b) flat-primary가 정답 (c) 명사화/participle 노이즈** — 추가 배치 실익 낮음.
- row `v_level`은 VRL 4축 산출물이라 불변 — Phase 3는 sense별 v_level로 우회(문맥 매칭), NULL은 row 폴백.

## Phase 4 — 사전 전역 구조/POS 정규화 (2026-07-12 · 완료)
> 문맥-매칭 sweep(책 등장 단어)과 별개로 **사전 45,496단어 전수**의 구조·POS 표기 결함을 스캔·근절. 다수가 Phase 3 sense-매칭을 **구조적으로 무력화**하고 있었음.

| 결함 | 이전 | 현재 | 성격 |
|---|---|---|---|
| no_meanings (sense 인벤토리 없음) | 6,964 | **0** | flat만 존재 → 단일 sense `{pos,meaning,v_level}` 백필(무손실) |
| legacy string-array `["뜻"]` (pos 없음) | 773 | **0** | 단일 POS 동의어 뉘앙스 → flat pos+뉘앙스 join 단일 sense |
| enrichment schema (`sense_ko` 키, `meaning` 없음) | 2,045 | **0** | 고품질이나 Phase 3가 `meaning` 못 읽음 → `meaning`=`sense_ko` additive |
| **sense POS 약어** (`n.`·`adj.`·`v.` 등) | ~5,000 | **0** | **context_pos(`noun` 풀폼)와 절대 매칭 안 됨** → 풀폼 정규화(핵심) |
| flat pos 표기 흔들림 (`phrasal verb`·`numeral`) | 16 | **0** | `phrasal_verb`·`number` |

- **효과**: ~9,800단어(21%)가 구조/POS 결함으로 Phase 3 sense-매칭 불가였던 것을 **전량 정합** → 사전 전역이 균일 `{pos, meaning, v_level?}` + 전 POS 풀폼. 특히 sense POS 약어 근절이 이미 백필된 context_pos와 결합해 **수천 단어 sense-매칭 즉시 활성화**(재백필 불요 — 약어는 이미 multi-POS로 집계돼 backfill됐고 값만 못 맞췄음).
- **안전**: 전부 additive/무손실 변환(기존 sense_en·register 보존) · 추출 함수 회귀 정상(715 rows) · multi-POS 단어 2,764.
- 백필은 발행 도서/아티클 실행 완료 · 신규는 파이프라인 자동(`insert_book_analysis` context_pos 갱신).

## Phase 5 — 레벨별 필드 완비 감사 + 예문 전수 채움 (2026-07-13 · 완료)
> 사용자 지시 "빈도수 상관없이 레벨별 있어야 할 단어 정보 항목 모두 점검". sense/POS와 별개로 학습자-대면 **필드 완비**를 v_level별 전수 점검.
- **감사(45,496 전체)**: meaning_ko·meanings_ko·pos·cefr·v_level = **100%**(Phase 4). example 84.5%·ipa 64.2%·synonyms 58.5%·inflections 55.3%·collocations 30.8%·antonyms 30.7%·learner_note 27.3%. audio/image/mnemonic 0%(별도 에셋, 스코프 외). 결측은 레벨이 아니라 과거 빈도-기반 dict-fill 잔재로 전 레벨 산재.
- **예문 전수 채움(사용자 "전체 계속" 선택)**: 실 단일어(idiom·phrasal·다어절·고어 제외) **2,548개** 결측 → Claude(=LLM) 문맥·sense 예문 생성 15배치. **전 레벨 V1~V11 example 100%**. 전체 사전 example 84.5%→**90.1%**. 잔여 결측 4,517 = **전량 관용구/구동사/다어절/고어**(독립 예문이 부적절한 단위).
- **다음 결측(후속)**: ipa(실 단일어 ~10,594)·synonyms·collocations(V11 거의 전무) — 후속 배치 대상.

## Phase 6 — 추출 품질 개선 항목 도출 (2026-07-13)
> 사용자 지시 "발음 제외, 단어추출 품질 높이는 사전DB 개선 항목 도출". 추출 함수가 실제 쓰는 게이트·스코어·조인 필드 데이터 품질을 근거로 계량.
- **게이트 건전성**: classified_by/v_level/word_register NULL = **0**(추출 조용한 제외 없음).
- **🔴 항목1 — word_register 노이즈 카테고리(구현 완료 아래)**: 고유명사·브랜드·약어 전용 register 부재 → 추출 노이즈. ™브랜드 68 + 약어 133 V≥6 추출가능, 23개 발행 세트 노출.
- **🔴 항목2 — frequency_rank NULL 14,442(V≥6)**: `_extract_composite_score`는 NULL rank→0.40 가중 **완전 0점**. study-tier plain 5,890이 최대 0.40 불이익→cap-40 하락. (V11 6,616은 진짜 희귀 OK.)
- **🔴 항목3 — 사전 커버리지 갭 19.5%**: 발행 도서 단어 4,669가 사전 미등록→추출 불가. 성격=OCR/방언 오류(willin·tonque) + 고유명사 + 희귀 실단어. 상류 tokenization/OCR-clean 갭도 노출.
- **🟡 항목4 — 다의어 sense 완성도**: rank≤5000 단일-sense 3,027(light 빛·match 성냥/경기 등 동일-POS 다의어 사각).
- **🟡 항목5 — spelling_variants 미활용(114만)**: 영/미 변형 dedup 부재.
- **⚪ 항목6 — verified false 73%**: composite 0.10이나 예문 90% 커버로 상쇄, 저우선.

## 항목1 구현 — word_register 노이즈 제외 (2026-07-13 · 완료)
- **스키마**: `sd_word_register_check` CHECK에 `brand`·`abbreviation`·`proper_noun` 추가(마이그 `20260713100000`, additive).
- **분류**: 브랜드(™) **96** → `brand` · 약어(2~5자 무모음, y제외) **129** → `abbreviation`. (proper_noun은 값만 준비, 분류는 후속 LLM 패스 — 고유명사는 소문자화돼 패턴 탐지 어려움.)
- **추출 제외**: `select_book_chapter_vocab`+`select_article_vocab` WHERE `word_register NOT IN (…, 'brand','abbreviation','proper_noun')`(마이그 `20260713100500`).
- **검증**: 3개 도서 추출 정상(2393/585/5 rows) · brand/abbreviation 노이즈 **0**. RegisterBadge는 새 값 graceful 미표시(Calm UI 유지).
- **잔여**: 발행 세트의 노이즈 23개는 재발행 시 자동 제거([[발행 세트 재발행 보류]]). 고유명사 분류는 후속.
