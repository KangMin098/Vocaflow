# 사전 필드 정합성 진단 — w0815 배치 부산물 (2026-08-15)

> 출처: T3b(학습자 노트) 배치의 서브에이전트 31개가 발행 도서 어휘 11,040단어를 **한 단어씩 읽으며**
> 보고한 이상 항목 + 그중 표본을 DB direct query 로 재확인한 결과.
> 이 진단은 배치의 **목표가 아니라 부산물**이다 — 노트를 쓰려면 뜻·품사·예문을 다 읽어야 했고,
> 그 과정에서 드러났다. 채움률 지표로는 하나도 보이지 않던 결함들이다.

## 왜 이게 지금까지 안 보였나

기존 사전 건강 지표는 **채움률**이다 — `meaning_ko` 100% · `cefr_level` 100% · `example_en` 90%.
전부 초록불이다. 그런데 채워진 값이 **맞는지**는 아무도 보지 않았다.
`inappropriately` 의 뜻이 "적절하게" 로 채워져 있어도 채움률은 100% 다.

## 결함 유형 5종

### ① 뜻 자체가 틀림 (가장 위험)
| 단어 | 저장된 뜻 | 실제 |
|---|---|---|
| `inappropriately` | **적절하게** | 부적절하게 — `in-` 부정이 통째로 소실 |
| `polygamy` | 일부다처제 | 복혼 전체 (일부다처 = polygyny) |
| `heretic` | 이교자 | 이단자 (이교도 = pagan/heathen) |
| `unintelligent` | 이해력 없는, 멍한 | 지능이 낮은 (unintelligible 과 혼동) |
| `charlotte` | 샬럿 (사람 이름) | 사과 샤를로트(디저트) — 예문도 디저트 |
| `redistribution`·`reintegration`·`reinterpretation`·`renegotiation` | 분배·통합·해석·협상 | **`re-` 접두사가 뜻에서 소실** |

→ `in-`/`re-` 같은 **접두사가 한국어 뜻에서 누락되는 패턴**이 반복된다.
   기계 탐지(파생어 뜻 = 어근어 뜻 완전 일치)로는 7건만 잡힌다 — 부분 일치라 대부분 빠져나간다.

### ② `example_en` 이 다른 뜻·다른 품사를 보여줌
카드 앞뒤가 서로 모순된다. 확인된 것만:
`manifold`(다양한 ↔ 배기 다기관) · `lent`(빌려주다 ↔ 사순절) · `parade`(행진 ↔ 과시하다) ·
`sequence`(순서 ↔ 염기서열 분석) · `peripheral`(지엽적인 ↔ 주변기기) · `sleeper`(잠자는 사람 ↔ 침대차) ·
`sty`(돼지우리 ↔ 눈 다래끼) · `mace`(철퇴 ↔ 향신료) · `amber`(호박 ↔ 신호등 황색) ·
`caravan`(대상 ↔ 이동식 주택) · `cartridge`(탄약통 ↔ 프린터 잉크) · `quail`(메추라기 ↔ 움츠러들다) ·
`carrier`(운송회사 ↔ 보균자) · `burr`(거스러미 ↔ 스코틀랜드 r 발음) · `streak`(줄무늬 ↔ 연속 기록) ·
`re-examination`(재검토 ↔ 재시험) · `starter`(시작하는 사람 ↔ 전채) · `oatmeal`(음식 ↔ 색) ·
`hazel`(나무 ↔ 눈 색) · `tank`(탱크 ↔ 어항) · `icon`(컴퓨터 아이콘 ↔ 문화적 우상) 등 60+ 건

### ③ `pos` 불일치
`section`(noun/예문 동사) · `serial`(adjective/예문 명사) · `still`(adverb/예문 형용사) ·
`clog`(동사 뜻/예문 명사) · `aids`(verb/예문은 질병) · `download`·`upload`(verb/예문 명사) ·
`scholarly`(adverb → 실제 형용사) · `disorderly`(adverb → 실제 형용사) · `quintuple`(adjective/실제 동사) ·
`mute`·`oblong`·`helm`·`parody`·`wince`·`skipper`·`tape`·`phone`·`layer`·`plod`·`squeal`·`fume`·`mire`·
`honeycomb`·`ferry`·`swindle`·`inflatable`·`facing`·`strand`·`overall`·`elitist`·`dispersal`·`censor`·`carbonate`

### ④ `synonyms` 오염 (WordNet 자동 수입 잔재)
동음이의·속어·고유명사·반대 개념이 통째로 딸려왔다. **학습자 카드에 그대로 노출된다.**

| 단어 | 오염된 synonyms |
|---|---|
| `trash` | methamphetamine · meth · crank · ice … (전량 마약 은어) |
| `lettuce` | boodle · cabbage (속어 "돈") |
| `curry` | dress · groom (말 손질) |
| `gravy` | boom · bonanza |
| `hob` | elf · gremlin · pixie |
| `falsifiable` | confirmable · verifiable (**반대 개념**) |
| `extracurricular` | adulterous · extramarital |
| `herder` | johann gottfried von herder (인명) |
| `heron` | hero · Hero of Alexandria |
| `midway` | battle of midway |
| `peacemaker` | browning machine gun |
| `be` | beryllium · glucinium (원소 기호 Be) |
| `adjutant` | adjutant stork · leptoptilus dubius |
| `honesty` | money plant · satin flower |
| `interpolate` | extrapolate (**반대 개념**) · falsify |

**규모 — 최초 추정(11%)은 크게 빗나갔다. 2026-08-16 전수 검토 실측:**

| 구간(등장 도서수 순) | 원본 유의어 | 유지 | **제거율** | 전량 폐기 표제어 |
|---|---|---|---|---|
| 청크 00–02 (**최다 노출 단어**) | 2,948 | 545 | **81.5%** | 109 / 360 |
| 청크 06–08 | 2,479 | 824 | **66.8%** | 72 / 360 |

⚠️ **가장 자주 노출되는 단어일수록 오염이 심하다.** 빈도 상위 구간이 81.5% 다.
기계 탐지(3어 이상 항목 2,196개)는 하한선일 뿐 — 단어 하나짜리 오염이 대부분이다.

**콘텐츠 안전 사례** (전부 학습자 플래시카드 뒷면에 노출되던 값):
- `far`(멀리) → 르완다 무장단체 `army for the liberation of rwanda`·`interahamwe` (FAR 약어 충돌)
- `let`(허락하다) → `lashkar-e-taiba`·`army of the pure` (LeT 약어 충돌)
- `pot`(냄비) → 대마 은어 10개 전량 · `go` → `ecstasy`·`xtc` · `speed` → `amphetamine` · `glass` → `methamphetamine`
- `egg`(달걀) → 고환 속어 8개 전량 · `come` → `semen`·`cum` · `head` → oral sex · `breast` → `tit`·`boob`
- `make` → `urinate`·`piss`·`pee` · `alter` → `castrate` · `clap` → `gonorrhea`
- `young` → 인명 8개(brigham young·cy young) · `day` → `clarence day` · `hum` → 무장단체 약어

**통짜 오염**(표제어 뜻과 전혀 다른 sense 가 유의어 전량을 차지):
`sing`(노래하다) → 전부 "밀고하다"(spill the beans·blab) · `bear`(곰) → 전부 동사 "낳다/참다" ·
`desert`(사막) → 전부 동사 "버리다"

### ⑤ CEFR 난이도 오배정
학술 파생 추상명사가 A1/A2 로 매겨져 **초급 학습자 추천 경로에 올라온다**.

- `centrality`·`centralization`·`computerisation`·`comparability`·`behaviourism`·`expressiveness`·
  `officialdom`·`preparedness`·`powerlessness`·`predictability`·`purposive`·`familial`·`classless`·`betterment` …
- **기계 탐지**: `cefr_level IN ('A1','A2')` AND 추상 파생 접미사(`-ness`/`-dom`/`-ability`/`-ation`/`-ism`/`-itude`/`-ency`) AND 길이≥8 → **126건**
- 그중 **111건(88%)이 `frequency_rank IS NULL`** — 빈도 근거가 없을 때 낮은 CEFR 이 기본값으로 붙은 것으로 보인다
- 반대 방향도 있다: `sunny`·`teatime`·`batch`·`backside` 가 C1/C2

### ⑥ 과거 AI 배치가 만든 비표제어 (환각)
`unpaving`(pos=verb·C2) · `unconducted` · `over-precaution` · `re-conducting` 은 영어에 굳어지지 않은
조어인데 표제어로 등재돼 있다. 전부 `source='ai-generated'` · `classified_by='claude_code_opus_4_7'`.

**기계 탐지법 (검증됨)** — `lexicon_clean`(455,152 표제어)에도 없고 발행 도서 본문에도 안 나오는 단어:

```sql
with pub as (select id from library_books where status='published'),
lex as (select distinct lower(coalesce(nullif(lbv.lemma,''), lbv.word)) w
        from library_book_vocabularies lbv join pub on pub.id=lbv.library_book_id
        where lbv.noise_kind is null)
select d.word from shared_dictionary d
left join lexicon_clean l on l.word = d.word
left join lex on lex.w = d.word
where d.source='ai-generated' and l.word is null and lex.w is null;
```

| 생성 배치 | lexicon 미등재 | 그중 도서에 실재 | **둘 다 없음(환각 의심)** |
|---|---|---|---|
| `claude_code_opus_4_7` (과거) | 187 | 62 | **125** |
| `claude_code_opus_5` (w0815 오늘) | 339 | 339 | **0** |

→ 오늘 배치가 0인 이유는 대상을 `library_book_vocabularies` 에서 뽑았기 때문이다 —
   **저작 대상을 코퍼스에서 길어오면 환각이 구조적으로 불가능하다.** 과거 배치는 그 제약이 없었다.
   앞으로 사전 표제어를 LLM 으로 만들 때는 이 제약을 하네스에 넣을 것.

## 즉시 수정한 것 (2026-08-15)

학습자에게 직접 오학습을 일으키는 확인분 9건만 DB 수정:
`inappropriately`(뜻 정반대) · `unintelligent` · `trash`·`falsifiable`·`extracurricular`·`herder`·`biotechnology`(synonyms) ·
`curry`·`ar`(synonyms 전량 제거) · `familial`·`centrality`·`centralization`(→C1) · `classless`·`betterment`(→B2)

## 남은 것 — 배치 설계 제안

세 트랙 모두 `w0815-*` 하네스(chunk/apply + 게이트) 패턴을 그대로 재사용할 수 있다.

| 트랙 | 대상 규모 | 탐지 방법 | 게이트 |
|---|---|---|---|
| 뜻↔예문 정합성 | 발행 도서 어휘 약 16,000 (전체는 4.2만) | 단어별 LLM 대조 (기계 불가) | 수정 시 기존 뜻 보존 + 추가 sense 로만 |
| synonyms 정제 | 1,691(기계 하한) ~ 약 2,900(11% 추정) | 3어 이상 = 기계 · 단어 오염 = LLM | 유의어는 **사전 실재어 + 동일 pos** 만 채택 |
| CEFR 재배정 | 126(기계 탐지분) | 빈도 백필 + LLM 판정 | v_level 과 동시 갱신, 추출 가중치 회귀 확인 필요 |

⚠️ CEFR 재배정은 **단어 추출 가중치와 학습자 추천 경로를 바꾼다** — 데이터 수정이 아니라 제품 동작 변경에
가깝다. 별도 승인 후 진행할 것.

관련: [[project_dict_field_completeness]](채움률 관점) · [[feedback_fix_structural_gaps]]
