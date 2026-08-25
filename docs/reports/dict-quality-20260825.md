# 사전 DB 품질 점검 — 전 파이프라인 대조 (2026-08-25)

읽기 전용 실측. 근거는 전부 `shared_dictionary` 및 소비 테이블 직접 질의 —
문서(.md)의 수치는 근거로 쓰지 않았다.

- 대상: `shared_dictionary` **47,737행** (최신 행 2026-08-21 · 최근 30일 +2,067)
- **D-1 · D-4 해소 · D-3 부분 해소**(아래 §4). D-2 · D-5 · D-6 미해소.
- 출처 6종: imported 34,706 · ai-generated 6,589 · derivational-seed 6,178 · manual 183 · kice-orphan 66 · inflection-seed 15
- VRL 마지막 계산 2026-08-25 · 마지막 품질 감사 2026-07-12

---

## 1. 판정 요약

| | 항목 | 실측 |
|---|---|---|
| 🟢 | 내용 정확도 | 3출처 34행 눈검사 전원 정확. 표제어 중복 0 · 공백/대소문자 오염 0 · base_word 끊김 0 |
| 🟢 | 도서 파이프라인 커버리지 | 상위 3,000 lemma 중 미등재 **2** |
| ✅ | **발행 단어장 예문 공백** | 발행 세트 998개 · 8,171행 → **0행** (백필 8,123 + 사전 표제어 34개 신규 작성 후 48). 재발 차단 게이트 I12 신설 |
| ◐ | VRL | `v_level` 459 **해소**(게이트 I1 → PASS · 기사 423낱말 추출 복귀). 3축 9,352는 **의도적 미충전** — 채워진 값의 62%가 v_level 상수이고 소비처 행동도 안 바뀐다 |
| 🟠 | 해석기 구멍 (고빈도 기능어) | `whenever` `wherever` `whoever` `amongst` `anymore` `nowhere` → **NULL 반환** |
| ✅ | 정확일치 조인 소비처 | 표면형으로 사전을 찾던 두 곳(WordBlitz 후보 28.7% 유실 · Flashcard 부가정보 4,620행)을 **lemma 키로 교정** + 회귀 4종 |
| 🟠 | 미등재 실수요 | `pending_words` 진성 갭 **2,169 lemma / 9,673 encounter** |
| ⚪ | 자산 부재 (설계상 이연) | audio_url 0% · image_url 0% — compose 청사진 2종 구조적 0건 |

---

## 2. 필드 채움률 (47,737 기준)

| 필드 | 채움 | 필드 | 채움 |
|---|--:|---|--:|
| meaning_ko | **100%** | rhyme_key | 60.7% |
| cefr_level · word_register · classified_by | **100%** | frequency_rank | 60.6% |
| example_en | 99.4% | collocations | 48.9% |
| meanings_ko | 98.7% | synonyms | 41.0% |
| v_level | 99.0% (459 null) | inflected_forms | 31.9% |
| cefr_confidence | 94.9% | mnemonic_ko | 15.5% |
| senses | 81.7% (8,729 빈 배열) | homophones | 10.9% |
| ipa(3종 중 1) | 80.7% | base_word | 7.2% |
| VRL track/domain/skill | 80.4% | register | 3.2% (D2 이연) |
| korean_learner_note | 61.9% | audio_url · image_url | **0%** |

출처별 편차 — `senses` 는 derivational-seed 6,178행 **전량 0%**, ai-generated 64.1%,
imported 100%. `list_tags` 는 **32,847행(68.8%)이 빈 배열**.

---

## 3. 파이프라인별 대조

### LCP (도서 큐레이션)
`lookup-enrich.ts` 가 읽는 8필드 기준. 상위 3,000 lemma 미등재 2건으로 **사실상 완전 커버**.
전체 not_found 는 5,816 lemma / 6,124행(전체 1.68M행의 0.36%).
열화 지점은 커버리지가 아니라 **가중치 필드**다 — `frequency_rank` 39% null,
`list_tags` 68.8% 빈 배열이라 LV 수식과 세그먼트 필터가 부분 신호로 돈다.

### ACP (기사)
distinct lemma 18,857 중 정확일치 11,339(**60.1%**). 상위 1,200 표본을
`resolve_dict_headword` 로 통과시키면 **96.3%** 해소(미해소 occurrence 3.6%).
코드 주석의 "정확일치 miss 를 사전 구멍으로 읽지 말라"는 경고가 실측으로 재확인된다.

### VCB compose
`DICT_COLUMNS` 22필드. 스윕 55조합은 전부 통과(`vcb-compose-sweep.md`).
필드 상한에 막힌 청사진은 셋 —
`mnemonic_ko` 15.5%(청사진 자체 주석은 11%/5,062로 **낡음**),
`image_url`·`audio_url` 0%로 구조적 0건(TTS 결정으로 우회 중).

### VRL
`v_level` 99.0%지만 track/domain/skill 3축은 80.4%. 다만 이 수치는 품질을 재지 못한다 — §4 D-3.

### 학습 모듈 (Flashcard · WordBlitz · TextViewer)
`.in('word', …)` **정확일치 조인**을 표면형으로 하던 곳이 둘이었다 — 아래 D-4. 전수 확인 결과
`reader-queries.ts`(단어 툴팁)는 `lookup_word_meaning` 이 돌려준 `resolved_word` 로,
`chapter-words-queries.ts` 는 lemma 로 이미 올바르게 조인하고 있었다. **소비처 전체가 아니라 두 곳이다.**

---

## 4. 확정 결함

### D-1 (P0) 발행 단어장 8,171행이 예문 없이 나가고 있었다 — **해소 완료**
998개 **발행** 세트. 최대 피해는 `Les Misérables` 챕터 세트들로 **100% 공백**(세트당 40행 전량),
`Dialogues — Ch.10` 276행. 사전에 예문이 이미 있는 것이 **8,123행(99.4%)**.
CHANGELOG Unreleased 에 기록된 2026-05 백필(1,946행)과 **같은 결함이 4배 규모로 재발**했다.

**원인은 조인 누락이 아니라 순서였다.** `select_book_chapter_vocab` 은 `sd.example_en` 을
이미 조인하고 있다. `shared_words` 가 발행 시점의 **스냅샷**인 것이 문제다 — 세트는
2026-08-11/12 에 발행됐고 그 낱말들의 사전 예문은 08-16~22 에 드레인으로 채워졌다.
스냅샷을 다시 맞추는 수단이 없어 그 사이에 발행된 것은 영구히 비어 있었다.
(표본: oratory · altar · velvet … 전부 `sw.created_at` 08-11 < `d.updated_at` 08-16~22)

**조치 (2026-08-25)**

| | |
|---|---|
| 백필 | 사전에서 **8,123행** 채움 |
| 사전 자체 결손 | 남은 48행이 가리키던 표제어 **34개**(negress·shorn·shipbuilding …)에 예문 작성 → 재전파 48행 |
| 결과 | `shared_words` **81,409행 전부 예문 보유 · 공백 0** |
| 재발 차단 | `sync_published_set_examples()` 멱등 재동기화 + 게이트 `I12 발행세트 예문 공백` (마이그레이션 `20260824231552`) |
| 배선 | `example-fill.mjs apply --commit` 이 적재 직후 전파를 호출하고 전파 행수를 출력 |

게이트가 **재료가 사전에 있는 것만** 세는 이유: 사전에도 없는 낱말은 재동기화로 못 고치므로
포함시키면 게이트가 영구히 붉게 남아 신호가 죽는다.

### D-2 (P1) 해석기가 고빈도 기능어에서 NULL을 낸다
`whatever` `anywhere` `nobody` `somewhere` 는 표제어인데
`whenever` `wherever` `whoever` `amongst` `anymore` `nowhere` 는 없고 해석도 실패한다.
설계 결정이 아니라 **표제어 목록의 구멍**이다. 재귀대명사도 갈렸다 —
`myself`·`itself`·`ourselves` 는 표제어, `herself`·`himself`·`themselves`·`yourself` 는
she/he/they/you 로 떨어져 "그녀 자신"이 "그녀"로 나간다.

### D-3 (P1) VRL — v_level 459 **해소 완료** · 3축 9,352는 **채우지 않기로**

초판에 "분류가 사전 증가를 못 따라간다(미분류 9,352 중 9,150이 최근 90일 유입)"고 적었다.
**그 프레이밍이 틀렸다.** 90일 창(05-27 기준)이 만든 착시였고, `classified_by` 로 쪼개면
"못 따라간 것"이 아니라 **특정 배치가 3축 패스를 통째로 건너뛴 것**이다.

| classified_by | 행 | 3축 미분류 | 기간 |
|---|--:|--:|---|
| claude_code_opus_4_7 | 39,305 | 920 | 05-04~07-04 |
| **claude_code_derivational** | 6,350 | **6,350 (100%)** | 05-30~07-13 |
| **claude_code_opus_5** | 2,067 | **2,067 (100%)** | 08-13~08-21 |
| claude_code_opus_4_8 | 15 | 15 (100%) | 07-18 |

#### 채움률 80.4%는 품질 지표가 아니다

`track_levels` 를 v_level 별로 가르면 **V11 17,296행이 서로 다른 벡터를 딱 1개**밖에 갖지 않는다
(100% 동일). V10 은 77.4%, V9 는 52.3%가 같은 한 벡터다. 채워진 38,385행 중 **약 24,000행(62%)이
per-word 판단이 아니라 v_level 로 찍은 상수**다. 미분류 9,352를 같은 상수로 채우면
지표는 100%가 되고 정보는 0이 된다.

#### skill 축은 채워도 소비처 행동이 안 바뀐다

- 형태 규칙(pos=idiom/phrasal_verb · 공백 유무)이 기존 라벨의 **97.2%** 를 재현한다.
  형태로 볼 수 없는 것은 `polysemy` 1,050행뿐.
- 유일한 소비처 `_extract_composite_score` 는 **`skill_level = 4 AND unit_v_level < 6`** 일 때만
  −0.10 페널티를 건다. 그런데 미분류 9,350행은 **전부 단일어**(다어절 0건 실측) → 채우면 전부 3 →
  페널티 분기에 안 걸린다. **행동 변화 0.**
- `calc_skill_level()` 은 v_level 밴드로 계산하는데 실데이터와 **32,761행(85%) 불일치** — 죽은 함수다.
  실제 `skill_level` 은 v_level 이 아니라 `skill_type` 을 따른다(단일어→3 · 구/관용어→4).

**판단**: 3축 9,352는 채우지 않는다. `register` 축을 "실소비처 확정 시 재개"로 이연해 둔 것과 같은 이유다.

#### v_level 459 — 여기만 실제 결함이었다

`select_book_chapter_vocab` 은 `sd.v_level BETWEEN` 밴드로, `select_article_vocab` 은
`COALESCE(sense_v, sd.v_level) >= 6` 으로 거른다. **NULL 은 두 비교 모두 통과하지 못한다** —
이 459 낱말은 도서·기사 어휘 추출에서 통째로 빠져 있었다. 게이트 `I1 필드완비` critical FAIL 도 이것.

459행 전부 `frequency_rank` 가 NULL 이라 per-word 근거가 CEFR 과 형태뿐이었다. 그래서
**같은 조건(frequency_rank NULL)의 기분류 11,000여 행이 실제로 몇을 받았는지** 재서 그 중심에 맞췄다:

| CEFR | 기분류 평균 | 배정 |
|---|--:|--:|
| A1 | 1.46 | 1 |
| A2 | 2.33 | 2 |
| B1 | 4.96 | 5 |
| B2 | 6.38 | 6 |
| C1 | 8.12 | 8 |
| C2 | 10.05 | 10 |

형태 투명성(non-/co-/multi- 접두 · -able/-less) 효과도 쟀는데 C2 −0.45 · C1 −0.11 로 작았고
**A1/A2 에서는 반대 방향**(2.15 vs 1.46)이었다 — 통짜 −1 은 근거가 없어 A1·A2 에만 +1 을 뒀다.

| | |
|---|---|
| 적용 | 459행 (V1 6 · V2 11 · V5 19 · V6 109 · V8 135 · V10 179) |
| 출처 표기 | `field_provenance.v_level = 'cefr-fit-20260825'` — per-word 판단이 아니라 **코퍼스 적합 규칙**임을 명시 |
| 게이트 | `I1 필드완비` 459 FAIL → **0 PASS** |
| 실효 | 기사 어휘 **423낱말 / 160편**이 `v_level >= 6` 을 넘어 추출 후보로 복귀 · 도서 쪽 94낱말 / 206권 |

### D-4 (P1) 사전 조회를 표면형으로 하던 두 곳 — **해소 완료**

**WordBlitz 챕터 보충** ([word-pool.ts](../../apps/web/src/lib/wordblitz/word-pool.ts)) 이
`library_book_vocabularies.word`(표면형)로 사전을 찾고 있었다. 실측 — lemma 보유 **1,591,690행**
중 표면형 정확일치는 **71.3%**, lemma 는 **100%**. 나머지 **28.7%** 는 "뜻 없음"으로 걸러졌다.
게다가 자르기(`slice(0, need)`)를 사전 조회 **전에** 해서, 버퍼를 `need*3` 만큼 뽑아 두고도
걸러진 만큼을 메우지 못했다 — 목표 12개를 못 채운 채 게임이 시작됐다.
(리포트 초판에 "`(의미 미등록)` 을 띄운다" 고 적었으나 그 문자열은 필터로 걸러지고 있었다.
 실제 증상은 표시가 아니라 **풀 부족**이다.)

**Flashcard 스코프 진입** ([flashcard/scoped-words.ts](../../apps/web/src/lib/flashcard/scoped-words.ts))
가 `fetchDictExtras` 를 표면형으로 호출하고 결과도 표면형으로 꺼내고 있었다.
발행 `shared_words` 표면형 **3,005종 / 4,620행**(abased · abated · abbreviated …)에서
연어 · 니모닉 · 다의어가 조용히 비었다.

**재료는 이미 있었다** — 두 테이블 모두 `lemma` 컬럼을 갖고 있고 채움률과 해소율이 100% 다
(`library_book_vocabularies` 1,591,690/1,591,690 · `shared_words` 4,620/4,620).
RPC 도 마이그레이션도 필요 없이 **조회 키만 lemma 로 바꾸면 되는 문제**였다.

| | |
|---|---|
| 조치 | `ScopedWord.lemma` 신설 · flashcard·wordblitz 조회 키를 lemma 로 · 거르기→자르기 순서 교정 |
| 회귀 | `wordblitz/__tests__/word-pool.test.ts` 4종 (lemma 키 · 풀 12 충족 · lemma 중복 제거 · lemma NULL 제외) |
| 손 안 댄 곳 | `reader-queries.ts` · `chapter-words-queries.ts` — 이미 올바른 키를 쓰고 있었다 |

### D-5 (P2) 템플릿 예문 약 350행
`He often uses the expression "…" in conversation.` 형태 140행,
`This word/term/phrase …` 70행, `… in conversation.` 143행.
맥락 의존 인출(학습 원칙 5)을 무효화한다. 표제어를 예문에 포함하지 않는 행도 763.

### D-6 (P2) pending_words 큐 구성
11,081 lemma / 38,810 encounter. 성격별로 갈라 보면:

| 버킷 | lemma | encounter | 예 |
|---|--:|--:|---|
| unknown_token (베트남어·LaTeX·OCR 파편) | 4,051 | 12,019 | cua · nhung · displaystyle |
| hyphen_compound | 3,277 | 10,641 | well-being · decision-making |
| **genuine_gap_en (등재 1순위)** | **2,169** | **9,673** | esports · photosynthetic · supermassive · whenever |
| foreign_noise | 1,162 | 3,584 | voi · cai · minh |
| resolvable_now (큐 잔재) | 210 | 1,442 | lifestyle · teamwork |
| short_or_digit | 112 | 1,137 | hr · ca |
| derived_negation | 100 | 314 | nonstop · unintended |

노이즈가 **47%**라 평평한 목록으로는 처리 판단이 안 선다(`triage.ts` 의 문제의식이 실측으로 확인).
`resolvable_now` 210건은 이미 해소됐는데 큐에 남은 것 — 정리 대상.

---

## 5. 오탐으로 확인된 것 (조치 불필요)

- `meaning_ko` 2자 미만 137행 — 감 · 뼈 · 칼 처럼 정당한 1음절 번역
- placeholder 정규식 7행 — 전부 "에미상/미상엽" 오탐
- inflected_forms 충돌 12건 — leaves(leaf/leave) · lives(life/live) 등 진성 중의어. L1 정확일치가 우선이라 무해
- spelling_variants 그림자 44건 · 굴절형이 표제어인 경우 199건 — 같은 이유로 무해
