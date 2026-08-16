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

## 2026-08-16 실행 결과 (T5·T6·T7·T5b)

| 트랙 | 대상 | 결과 |
|---|---|---|
| **T5 유의어 정제** (`w0816-syncheck.mjs`) | 발행 도서 어휘 12,401단어 / 86청크 | **8,563단어 정제** · 유의어 항목 98,936 → **64,250**(−34,686) |
| **T6 예문 정합성** (`w0816-exmatch.mjs`) | 13,794단어 / 115청크 | 예문 **394건 교체** · **뜻 이상 968건 진단** |
| **T7 뜻 보완** (`w0816-meaningfix.mjs`) | T6 진단 968건 / 17청크 | **575단어 보완** · 기존 sense 소실 **0건** |
| **T5b 유의어 정제 잔여** (`w0816-syncheck2.mjs`) | 발행 도서 **밖** 15,890단어 / 133청크 | **9,551단어 정제** · 유의어 항목 64,250 → **42,495**(−21,755) |

### T5 의 대상 정의가 사각지대를 만들었다 (T5b)

T5 는 "노출되는 것부터"라는 판단으로 **발행 도서 어휘 12,401개**만 잡았다. 그런데 유의어를 가진
표제어는 **23,367개**였고, WordNet 오염은 도서 수록 여부와 무관한 **전역** 결함이다 —
1만 5천 단어가 손 안 댄 채 남아 있었다. 대상을 좁힌 근거(노출 우선순위)는 맞았지만
**"나머지는 오염이 덜하다"는 함의는 틀렸다.** T5b 실측 제거율 22~55%로 T5(34~81%)보다 낮은데,
이는 오염이 옅어서가 아니라 저빈도 구간에 유의어 1~2개짜리 깨끗한 복합명사(`police station`·
`prayer rug`)가 대량으로 섞여 분모를 눌렀기 때문이다. 오염된 항목은 대부분 **통짜로** 무너졌다 —
`keep: []`(유의어 전량 제거)가 **3,874단어**.

**T5b 가 새로 드러낸 오염 축 2종** (T5 의 10종에 추가):

| # | 유형 | 실측 사례 |
|---|---|---|
| 11 | **표제어 인접 오염** — 철자·개념이 한 끗 차이라 그대로 오학습된다 | `stepbrother`→`half-brother`(의붓≠이복) · `presbyopia`→`farsightedness`(노안≠원시) · `hummus`→`humus`(흙) · `nautical mile`→`mile`(1,852≠1,609m) · `kibibyte`→`kilobyte`(2^n≠10^n) · `benzine`→`benzene`(석유 나프타≠발암 방향족) · `tinea`→`roundworm`(곰팡이≠회충) · `litigator`→`litigant`(변호사≠당사자) |
| 12 | **synset 단위 확산** — WordNet synset 하나가 여러 표제어를 동시에 오염 | 중세 공성무기 3종(`arbalest`·`mangonel`·`ballista`) · '돈' 속어(`gelt`·`kale`·`boodle`) · 퓨마 4형제 · 상표명 약물 9종 · 정신병원 멸칭 synset(`sanatorium` 10/10) |

**양방향 오염 쌍**도 반복 확인됐다 — `turbofan`↔`turbojet`, `ragweed`↔`ragwort`, `cupric`↔`cuprous`,
`xylophone`↔`marimba`. 한쪽만 고치면 반대편이 남으므로 **쌍 단위로 잡아야 한다.**

**콘텐츠 안전 — 저빈도 구간에도 그대로 있었다**: `pouf`(발받침)→동성애 멸칭 6종 ·
`nance`→멸칭 10/10 · `guck`→`gook`(아시아인 멸칭) · `sod`→`sodomite` 3종 · `spick`→`spic` ·
`orchis`(난초)→고환 7종 · `cocotte`(무쇠 냄비)→성매매 멸칭 10종 · `peeler`(껍질칼)→스트리퍼 6종 ·
`behind`(A1 전치사)→엉덩이 비속어 10종 · `backwardness`·`retardation`→지적장애 멸칭 ·
`same`(A1)→사미족 민족명 5종 · `turn on`→마약·성적 은어 9종.

**부수 산출 — 레코드 자체 결함 496건** (`scripts/dict/w0816-syncheck2/NOTES.json`, 자동 수정 안 함):
`example_en` 자리에 WordNet 관계 메타데이터(`Near-synonyms:`·`Holonyms:`) · 뜻↔예문 sense 어긋남 ·
표제어 레코드 밀림(`mace` 는 뜻이 철퇴인데 예문은 향신료) · `meaning_ko` 잘림(`infliction` = `"가"`) ·
표제어 오역(`ortolan` = 촉새인데 "꼬까울새") · pos 오기.

**T6 의 진짜 산출물은 예문 교체가 아니라 뜻 진단이었다** — 394건 고치는 동안 968건을 찾아냈고,
그 968건이 T7 의 입력이 됐다. 결함의 대부분은 예문이 아니라 **`meaning_ko` 가 빈약한 것**이었다.

### 게이트가 실제로 막은 것
- T5 **부분집합 게이트**(삭제만 허용) 위반 **0건** — 12개 에이전트가 8,563단어를 처리하며 유의어를 추가하려 한 적이 한 번도 없다
- T5b 부분집합 위반 **0건**(9,551단어 / 133청크 / 27개 에이전트). 누적 219청크에서 게이트가 한 번도 뚫리지 않았다 —
  **"추가 불가·삭제만 가능"이 LLM 배치를 안전하게 만드는 가장 값싼 장치**라는 걸 두 트랙이 독립적으로 보여준다
- T6 예문 게이트 탈락 8건(길이·아포스트로피·표제어 미포함) 자동 폐기
- T7 **기존 sense 보존 게이트** — 소실 0건. 맞는 뜻을 덮어쓰는 사고가 이 배치 최대 위험이었다

### 하네스를 짤 때 실제로 낸 실수 4가지 (에이전트가 잡음)
1. `v_level` 컬럼을 select 하지 않고 폴백으로 사용 → 항상 `undefined` → 해당 sense 전량 거부
2. `meaning_ko ⊇ meanings_ko[0]` 게이트가 **과엄격** → 에이전트가 카드 앞면에 정의문 전문을 밀어 넣음.
   설명부(`— …`)·선행 괄호를 걷어낸 **핵심어만 비교**하도록 완화 + apply 에서 head 정규화(3구획·90자)
3. sense 재구성 시 `{pos,meaning,v_level}` 만 남겨 **`example`·`register`·`sense_en` 소실** → 청크 입력의 원본 sense 에서 부가 필드 승계
4. 수동 SQL 로 `meaning_ko` 만 고치고 `meanings_ko` 를 방치 → 두 필드 모순(`absently`). **수동 수정 경로에만 있는 위험** — apply 스크립트는 두 필드를 함께 쓴다

### 삭제 금지 규칙의 한계 (T7)
기존 sense 보존은 맞는 뜻을 지키지만 **틀린 뜻도 함께 지킨다.**
`seconders` 의 "결투 입회인"(실제로는 `second` 의 뜻)은 지울 수 없어, 맞는 뜻을 0번으로 올리고
오뜻은 **원문 보존 + 반증 주석 + 강등**으로 처리했다. `tremor`·`whereon`·`tanner` 도 동일.
`shark` 의 3중 중복 sense 처럼 **dedupe 가 필요한 항목은 별도 배치**가 있어야 한다.

### T8 — 예문 자리에 예문이 아닌 것 (`w0816-exrepair.mjs`)

T5/T5b 가 유의어를 보다가 부수적으로 계통 결함 3종을 잡아냈다. 기계로 탐지 가능해 **432건 전수**를 쳤다.

| kind | 탐지 | 규모 | 결과 |
|---|---|---|---|
| `meta` | WordNet 관계 라벨로 시작 | 93 | **93 → 0** |
| `gloss` | 소문자 시작 + 종결부호 없음(사전 뜻풀이) | 197 | **197 → 2**(멸칭 표제어 skip 분) |
| `shifted` | 표제어가 예문에 없음(레코드 밀림) | 142 | 실제 밀림만 교체 |

**교체 321 · 원본 유지 105 · agent-skip 6 · 게이트 탈락 0.**

`meta`·`gloss` 는 원본이 예문이 아니므로 비교 대상이 없다. 그래서 게이트를 **산출물 쪽에** 걸었다 —
표제어 등장 + 대문자 시작 + 종결부호 + 관계 라벨 거부 + 20~160자 + 아포스트로피 금지.

**⚠️ 이 배치의 진짜 교훈은 `shifted` 판정기가 틀렸다는 것이다.** 세 에이전트가 독립적으로 같은 오탐을 지적했다:

| 오탐 원인 | 실측 사례 |
|---|---|
| 불규칙 굴절 | `have on`→"He **had** the radio on" · `give`→"She **gave** …" · `deny`→"He **denied** …" |
| 접두 합성 불규칙 | `overcome`→`overcame` · `rewind`→`rewound` · `withstand`→`withstood` |
| 표제어가 기호로 시작 | `(every) now and again` — `\b\(ever` 는 **절대** 매치되지 않는다 |
| 비ASCII·상표기호 | `étude` · `dms™` — `\b` 가 성립하지 않아 **어떤 예문도 게이트를 통과 못 함** |

**⚠️ 되잡을 때 한 번 더 틀렸다 — 분류 오류 ≠ 원본 정상.** 에이전트가 "`kind` 분류가 틀렸다"고
보고한 항목을 전부 원본 유지로 넘겼는데, 그중 둘은 분류만 틀렸을 뿐 원본이 실제로 결함이었다:
`senior high school`("he goes to the neighborhood **highschool**" — 표제어 부재 + 오철자) ·
`pension off`("to pension off a worker…" — 문장이 아니라 to 부정사 조각). 회수해 교체했고,
그 결과 뜻풀이 예문이 **2 → 0**, WordNet 메타데이터 예문도 **0**이 됐다.
에이전트 보고를 요약으로 받지 말고 **원본 문자열을 직접 볼 것.**

멀쩡한 예문을 갈아치우는 것이 이 배치의 유일한 손실 경로였다. apply 에 **완화 매처**(`looseContains` —
기호 제거 + 불규칙 굴절표 130여 항 + 접두 합성 + y→i·f→v·자음중복)를 넣어 `kind='shifted'` 인데
원본에서 표제어가 실제로 보이면 교체를 건너뛰게 했다. 되잡은 것이 **105건**(오탐률 74%).
`meta`·`gloss` 에는 이 면제를 주지 않는다 — 원본이 예문 자체가 아니기 때문이다.

곡선 아포스트로피 **U+2019 가 ASCII `'` 필터를 통과**하던 것도 같이 막았다(에이전트가 `tear apart` 에서 발견).

**부수 산출 — 레코드 결함 106건** (`w0816-exrepair/FLAGGED.json`): 표제어에 ™ 혼입(`dms™`·`jcb™`) ·
고유명사 소문자화(`chinese new year`·`european union`·`good friday` 등) · 중복 표제어
(`fire engine`↔`fire truck`, `face recognition`↔`facial recognition`, `divided highway`↔`dual carriageway`) ·
난이도 과대(`belly button` C2/v11 · `break into` C2/v11 vs 같은 뜻 `break in` B2/v6) ·
sense 누락(원본 예문이 `all_meanings` 에 없는 뜻을 쓰던 항목 — `black eye`·`boiling point`·`chief executive`).

**같은 소스가 여러 레코드를 동시에 오염시킨 증거**도 나왔다 — `shopping centre`·`shopping mall` 이
같은 예문(`a good plaza should have a movie house`)을, `case law`·`common law` 가 또 같은 예문을 공유했다.

### T10 이 드러낸 것 — `frequency_rank` 에 순위가 아닌 값이 섞여 있다

T10 에이전트가 "청크 전체 rank 가 `x500` 버킷인데 **1986 만 반복된다**"고 보고했다. 실측하니 사실이었다.

| | |
|---|---|
| `frequency_rank` 보유 | 28,946 |
| **버킷 중앙값**(`% 1000 = 500`) | 16,497 — 1,000폭 버킷의 중앙값. **결함 아님**(저빈도 구간의 거친 근사). 실제로 `beneath`·`glance`·`ought`=1500, `accuse`·`amuse`=2500 처럼 값이 타당하고 CEFR 도 맞는다 |
| **센티널 클러스터** | **252** — `1986`(139단어) · `2089`(68) · `2354`(45). 순위가 아니라 **가져온 목록마다 상수 하나를 박은 것** |

센티널임을 확정한 근거: 코퍼스 순위를 가질 수 없는 **다어절 표현**이 같은 값에 대량으로 들어 있다 —
`in and of itself` · `take advantage of` · `point of view` · `pay attention to` · `fossil fuel` ·
`solar panel` · `eco-friendly` · `climate change`. 세 클러스터 모두 수능·학술 어휘 목록의 성격이다
(1986 = 목록 A, 2089 = 목록 B, 2354 = 목록 C).

**영향** — `frequency_rank` 로 정렬하는 모든 경로가 이 252단어를 "상위 2,000위권"으로 취급한다.
그중 `information`·`freedom`·`personal` 은 실제로 흔하지만 `respondent`·`theorist`·`in and of itself` 는
아니다. **이번 배치 시리즈(T5b·T8·T10)의 임팩트 정렬도 이 값을 썼다** — 처리 순서가 조금 뒤틀렸을 뿐
게이트나 산출물 품질에는 영향이 없다(전수 처리가 목표였으므로). 다만 **CEFR 을 빈도에서 유도하는
경로가 있다면 이 252건은 틀린 입력을 받는다.** 재산정은 데이터 출처 확인이 필요해 손대지 않았다.

⚠️ 고빈도 쪽 중복(`29119`·`30002` 등 30여 단어씩)은 **정상적인 동순위**다 — 빈도 꼬리에서는 출현 수가
같은 단어가 몰린다. 센티널과 혼동하지 말 것.

### 뜻이 통째로 비어 있던 표제어 10건 (T9 에이전트 발견)

T9 에이전트가 `went` 의 `meaning_ko` 가 **"went"** — 표제어를 그대로 적어 뜻풀이가 없다고 보고했다.
전수 조회하니 `meaning_ko ≡ word` 인 항목이 **9건**, 한글이 하나도 없는 항목이 **1건** 더 있었다.

| 유형 | 항목 |
|---|---|
| 굴절형인데 뜻이 표제어 복사 | `went` · `begun` · `tells` |
| 약어인데 뜻이 대문자 표기 복사 | `btec` · `f` · `html` · `usb` · `vip` · `xml` |
| 한글 0자 | `t20™` |

10건 모두 `meanings_ko[0]` 에는 제대로 된 한국어 뜻이 있었다 — **두 필드가 어긋난 채 카드 앞면만 비어 있던
것**이다(T7 의 게이트 (2) 가 막으려던 바로 그 사고가 T7 대상 밖에서 이미 일어나 있었다).
두 필드를 함께 채워 복구했다. 탐지 질의는 한 줄이니 **정기 점검 항목으로 둘 것**:

```sql
select word from shared_dictionary
where lower(trim(meaning_ko)) = lower(trim(word)) or meaning_ko !~ '[가-힣]';
```

### 표제어가 "단어"가 아니라 **사전 표기 틀**인 것 454건 (T10 에이전트 발견)

에이전트 여럿이 같은 것을 봤다 — `a/an/the soft/easy option` · `a rod/stick to beat somebody with` ·
`today, tomorrow, monday, etc. week` · `as from…/as of…`. Oxford 식 관용구 표제어 표기가 **그대로**
`shared_dictionary.word` 에 앉아 있다. 이건 카드 앞면에 문자열 그대로 인쇄된다.

| 표기 유형 | 수 |
|---|---|
| 슬래시 변이형 (`hit/strike pay dirt`) | 239 |
| 괄호 선택항 (`in a (tight) corner`) | 159 |
| 자리표시자 (`somebody`·`something`) | 265 |
| `, etc.` 열거 | 28 |
| 말줄임표 (`as from…`) | 20 |
| **합집합** | **454** |
| (별개) 상표 기호 `™`·`®` | 96 |
| (별개) 아포스트로피 포함 | 149 |

**오탐 0** — 40건 무작위 표본 전량이 실제 사전 표기 틀이었다. 다만 두 갈래로 나뉜다:
`leave somebody in the lurch` 처럼 **읽히는 것**과, `all the better, harder, more, etc.` 처럼
**카드로 성립하지 않는 것**. 후자만 골라내려면 사람 판단이 필요하다.

**⚠️ 학습자에게 실제로 나가고 있다** — 발행된 주제 어휘 세트 3개에 **31건**:
`개념 주제 어휘`(7) · `시간과 공간 주제 어휘`(15) · `언어 기능 주제 어휘`(9).

**즉시 고칠 수 있는 부분집합 — 거울 중복 11건.** 슬래시 순서만 바꾼 **같은 항목이 두 번** 등재돼 있다
(토큰 정렬 정규화로 기계 탐지: 10개 군 · 21표제어). 그중 **3쌍은 발행 세트 안에 있어 학습자가 같은
관용구 카드를 두 번 받는다** — FSRS 일정도 둘로 갈린다.

| 발행 세트에 있는 거울 쌍 | 세트 |
|---|---|
| `(every) now and again/then` ↔ `(every) now and then/again` | 시간과 공간 |
| `for the meantime/meanwhile` ↔ `for the meanwhile/meantime` | 시간과 공간 |
| `in the meantime/meanwhile` ↔ `in the meanwhile/meantime` | 시간과 공간 |

나머지 7건(비발행): `a/an/the soft/easy option`↔`an/a/the easy/soft option` ·
`in a (tight) corner/spot`↔`…spot/corner` · `bad/ill feeling`↔`ill/bad feeling` ·
`from that day/time forth`↔`…time/day forth` · `hit/strike pay dirt`↔`strike/hit pay dirt` ·
`slog/sweat/work your guts out`↔`sweat/slog/…` · `bust your butt/chops/hump` **3중**.

**미조치 — 발행 세트에서 행을 지우는 것은 학습자 콘텐츠 삭제라 승인 대상이다.** 제안 SQL:

```sql
-- 거울 쌍 중 뒤쪽 하나만 발행 세트에서 제거 (shared_dictionary 는 건드리지 않음 · 되돌릴 수 있음)
delete from shared_words where lower(word) in (
  '(every) now and then/again', 'for the meanwhile/meantime', 'in the meanwhile/meantime');
```

### T11 — 아포스트로피 표제어의 예문이 틀린 철자를 가르치고 있었다

T10 이 예문에 아포스트로피를 일괄 금지했다(TTS·따옴표 처리). **표제어 자체가 아포스트로피를 품고
있으면 이 규칙이 정반대로 작동한다** — 에이전트 셋이 chunk-34·44·49 에서 독립적으로 지적했다.

| 표제어 | 들어가 있던 예문 | 무엇이 망가졌나 |
|---|---|---|
| `hobson's choice` | `a Hobsons choice` | 존재하지 않는 철자를 가르침 |
| `ne'er-do-well` | `a never-do-well` | 표제어와 예문이 **다른 단어** |
| `dos and don'ts` | `a short list of dos and warnings` | 표제어 뒷부분을 다른 낱말로 바꿔치기 |
| `hors d'oeuvre` | `small hors doeuvres` | 차용어 철자 붕괴, 발음 유추 불가 |
| `director's cut` | `The director cut of the film` | 명사구가 동사구로 읽혀 **뜻이 바뀜** |
| `o'clock` (A1/v1) | (없음) | 규칙 1·4 가 배타라 **아예 못 씀** |

규칙을 "표제어에 아포스트로피가 있으면 예문에도 허용 + 곡선 `’` → ASCII `'` 정규화"로 고치고,
`w0816-apos.mjs` 로 **103건 중 102건**을 되썼다. 되쓰기 게이트는 exfill 보다 엄하다(기존 값을
덮어쓰므로) — 표제어의 아포스트로피 토큰이 예문에 없으면 거부. 단 `somebody's` 같은 **자리표시자
소유격은 실명사로 치환되는 게 정상**이라(`on somebody's coat-tails` → `on his mentor's coat-tails`)
아무 소유격이든 있으면 통과시킨다. 이 예외를 안 두면 24건이 헛되이 탈락했다.

부수로, `"He often uses the expression \"…\" in conversation."` 라는 **정의문 틀로 때운 예문 9건**도
실제 용례로 교체됐다.

### CEFR 오배정 — `frequency_rank` 유무와 상관 (별도 승인 대상)

T9 에이전트 둘이 독립적으로 "A1/A2 인데 학술 추상 파생어" 를 지적했다. 실측:

`cefr ∈ {A1,A2}` 이면서 표제어가 `-ism`·`-ity`·`-ness`·`-tion`·`-logical`·`-istic`·`-ology`·`-hood`
로 끝나는 항목 **189건**, 그중 **150건(79%)이 `frequency_rank IS NULL`**.

표본을 보면 갈림이 뚜렷하다 — **rank 가 있는 것은 맞고**(`action` 474/A2 · `activity` 432/A1 ·
`business` 211/A1 · `city` 269/A2 · `education` 531/A2), **NULL 인 것만 틀렸다**
(`behaviourism` A2 · `centralisation` A1 · `collectivity` A2 · `comparability` A2 · `computerisation` A1).

⚠️ 다만 **"rank 가 NULL 이면 낮은 CEFR 로 떨어진다"는 일괄 폴백은 아니다.** rank NULL 전체
18,191건 중 A1/A2 는 1,163건(6.4%)으로, rank 보유군(4.3%)보다 조금 높을 뿐이다.
상관은 실재하지만 **영향 범위는 수백 건 규모**다. 형태 신호(학술 접미사)와 rank NULL 을 함께 쓰면
정밀하게 골라낼 수 있다.

미조치 — **CEFR 재배정은 단어 추출 가중치와 학습자 추천 경로를 바꾼다.** 데이터 수정이 아니라
제품 동작 변경이므로 별도 승인 후 진행할 것. 한 에이전트는 `chunk-23` 120단어 중 약 45개가 같은
방향으로 밀려 있다며 **청크 단위 재산정**을 권했다.

### 시드 토큰 절단 — 영어 단어가 아닌 표제어에 뜻까지 붙어 있다 (T10 에이전트 발견)

에이전트 여러 명이 청크마다 "이건 영어 단어가 아니다" 를 보고했고, chunk-54~59 담당이 **패턴**을 짚었다:
`railro` · `relo` · `sidelo` 가 전부 **"잘린 토막 + `pos=adverb` + '~하여' 꼴 뜻풀이"** 라는 같은 모양이다.
우연이 아니라 **시드 생성 단계에서 잘린 토큰에 부사 태그를 기계적으로 부여한 흔적**이다. 확인된 12건:

| 표제어 | 원래 낱말 | 붙어 있던 뜻 | pos |
|---|---|---|---|
| `le` | less | 덜 | adverb |
| `dre` | (미상) | 곧 | adverb |
| `kne` | kneel | 꿇어앉아 | adverb |
| `behe` | behold | 보라 | adverb |
| `ple` | amply/plenty | 충분히 | adverb |
| `overlo` | overly | 지나치게 | adverb |
| `proofre` | proofread | 교정하다 | adverb ← **뜻은 동사인데 부사 태그** |
| `railro` | railroad | 철도로 | adverb |
| `relo` | relocate | 이주하여 | adverb |
| `sidelo` | sidelong | 옆으로 | adverb |
| `sce` | (없음) | SCE (자기효능감 등 약어) | abbreviation ← **없는 약어에 없는 확장** |
| `brustly` | bristly | 솔이 빳빳한 | adjective |

⚠️ **`ple` 는 발행된 도서 챕터 세트 `Ozma of Oz — Ch.6` 에 들어 있다** — 그 챕터를 학습하는 사람은
비단어 카드를 받는다. `le` 는 `library_book_vocabularies` 에 **70행**, `dre` 13행, `kne` 11행 —
도서 본문 토큰화에서 계속 재유입되고 있다는 뜻이라, 사전에서 지워도 **추출 단계를 고치지 않으면 되돌아온다.**

기계 탐지는 가능하지만 **단순 접두사 매칭은 오탐이 압도적**이다(`ago`·`also`·`here`·`now`·`far` 가
전부 걸린다). 판별 신호는 "잘린 형태 + 뜻이 더 긴 낱말의 것 + 그 형태가 실재 영어 단어가 아님" 세 개를
함께 봐야 하고, 마지막 조건은 사람이나 LLM 판단이 필요하다.

미조치 — 표제어 삭제는 PK 변경이고 발행 세트에서 행이 빠지므로 승인 대상. 제안:
```sql
-- 사전 표제어 제거 (추출 단계 수정이 선행되지 않으면 재유입된다)
delete from shared_words where lower(word) in ('ple');   -- 발행 세트 노출분
delete from shared_dictionary where word in
  ('behe','brustly','dre','kne','le','overlo','ple','proofre','railro','relo','sce','sidelo');
```

### 뜻이 정반대인 부사 4건 — 그리고 **기계 탐지가 통하지 않은 사례** (T12)

T12 에이전트가 `meaning_ko` 에서 **부정 접두사가 통째로 빠진** 항목을 잡았다. 예문은 맞는데 뜻만 반대다:

| 표제어 | 들어 있던 뜻 | 예문 (맞음) | 고친 뜻 |
|---|---|---|---|
| `impossibly` | **가능하게** | The deadline seemed impossibly short. | 불가능할 만큼 |
| `inaccurately` | **정확하게** | The article inaccurately described the event. | 부정확하게, 틀리게 |
| `inadequately` | **충분하게** | The room was inadequately heated. | 불충분하게, 미흡하게 |
| `insufficiently` | **충분하게** | The instructions were insufficiently clear. | 불충분하게, 모자라게 |

카드 앞면(뜻)과 뒷면(예문)이 정면으로 모순된 상태였다. 4건 모두 두 필드를 함께 고쳤다.

⚠️ **전수 확대를 시도했으나 기계 탐지가 통하지 않았다 — 기록해 둔다.**
`un|in|im|il|ir|non` 접두사 + `meaning_ko` 에 부정 형태소(`안·않·없·못·불·비·무·미`) 없음 으로
훑으면 **250여 건이 걸리는데 사실상 전부 오탐**이다. 한국어는 `un-` 계열을 `풀다`·`벗기다`·
`펼치다`(`unbutton`·`unlock`·`unfold`)로 옮기는 게 정상이고, `dis-` 도 `사라지다`·`버리다`·
`해산하다`처럼 부정 형태소 없이 쓴다.

더 좁은 신호("부정어의 뜻 첫 구획 = 원형의 뜻 첫 구획")로 걸러도 **4건 중 2건만** 잡히고
(`impossibly`·`insufficiently` 는 원형 뜻이 달라 빠진다) `immure` 라는 오탐이 붙는다
(`im-` 이 부정이 아니라 '안으로'인 경우).

**결론 — 이 유형은 단어별 LLM 판독으로만 잡힌다.** 정규식으로 사후 감사할 수 있는 결함이 아니다.

### T12 가 추가로 잡은 `meaning_ko` 오류 13건

노트를 쓰려면 뜻을 읽어야 하므로, T12 는 **뜻 오류 탐지기 역할을 겸했다.** 위 4건 외에 13건 더:

| 표제어 | 들어 있던 뜻 | 실제 |
|---|---|---|
| `wedding party` | 결혼 **피로연** | 결혼식 **일행**(신랑·신부와 들러리) — 예문이 이미 이 뜻이었다 |
| `sister-in-law` | **처제** | 시누이·올케·처제·형수 — 한국어 대응어가 없는데 하나로 좁혔다 |
| `reallocation` | 할당 | **재**할당 (`re-` 누락) |
| `containment` | **포함** | 억제, 봉쇄 |
| `front page` | 앞면 | (신문의) **1면** |
| `apartment block` | 아파트 **단지** | 아파트 건물 **한 동** |
| `country house` | 전원주택 | (영국) 시골 **대저택** |
| `dust storm` | **황사** | 모래폭풍 (황사는 특정 지역 현상) |
| `crime lab` | 과학수사**대** | 감식 **실험실** |
| `covering letter` | **자기소개서** | 서류에 동봉하는 첨부 편지 (영국식) |
| `death certificate` | 사망 **진단서** | 사망 **증명서**(공문서) |
| `dining room` | 식당 | 집·호텔의 **식사하는 방** |
| `first floor` | **1층** | (미) 1층 / (영) **2층** — 예문은 영국식인데 뜻은 미국식이었다 |

`first floor` 는 특히 나빴다 — `meaning_ko`("1층")는 미국식, `example_en`("Our flat is on the
first floor, just above the bakery")은 영국식, `synonyms` 에는 `ground floor` 가 들어 있었다.
**같은 레코드 안에서 세 필드가 서로 다른 변종을 말하고 있었다.**

### CEFR 접미사 단위 오배정 — 세 에이전트가 같은 결론

앞의 §"CEFR 오배정" 이 형태 신호로 189건을 잡았는데, T12 에이전트 둘이 독립적으로
**"개별 수정이 아니라 접미사 단위 재산정"** 을 권했다. 관측된 계통:
`computation`·`computational`·`computerisation` 셋 다 **A1** · `cinematic`·`counterproductive`·
`faceless`·`exercisable` A1 · `collectivity`·`comparability`·`climatic`·`connective` A2 ·
`historicist`·`historicity`·`positivist` A1(철학 전문어).
한 에이전트는 담당 청크 120단어 중 **약 45개**가 같은 방향으로 밀려 있다고 보고했다.
`-ism`/`-ity`/`-ation`/`-ational`/`-ic` 파생 접미사군에 CEFR 이 **일괄로 낮게** 부여된 것으로 보인다.

### 같은 배치에서 고친 기계적 결함 (2026-08-16)

- **`pos_set` 재구축** — `pos ∪ senses[].pos ∪ meanings_ko[].pos`. `pos` ∉ `pos_set` **4,201 → 0**,
  다품사 표제어 2,317 → **9,501**. 소비처를 먼저 확인했다(Admin `VocabularyDetailPanel.tsx` 표시 +
  `schema-presence-static.ts` 뿐 — 추출·추천 경로가 읽지 않아 회귀 위험 없음).
- **`-ly` 형용사 pos 오기 18건** — cuddly·fatherly·frilly·ghostly·motherly·prickly·scholarly·smelly·
  straggly·unholy·unsightly·unworldly·wobbly·worldly·disorderly·gentlemanly·knightly·pearly.
  `pos`·`primary_pos`·`pos_set`·`meanings_ko[].pos` 를 **함께** 갱신 — 하나만 고치면 위 불일치가 재발한다.
  `ostensibly`·`purportedly`·`superficially`·`actually`·`admittedly`·`distressfully` 는 정규식 오탐(진짜 부사).

## 남은 것 — 배치 설계 제안

`w0815-*` 하네스(chunk/apply + 게이트) 패턴을 그대로 재사용할 수 있다.

| 트랙 | 대상 규모 | 탐지 방법 | 게이트 |
|---|---|---|---|
| 굴절형·중복 표제어 정규화 | 굴절형 1,104(pos=verb 103) · 복수형 중복 299 · 하이픈 중복 123 · 소문자 고유명사 29 | 기계 탐지 | **PK 변경 + cascade** — 승인 필수 |
| CEFR 재배정 | 126(기계 탐지분, 88%가 `frequency_rank` NULL) | 빈도 백필 + LLM 판정 | v_level 과 동시 갱신, 추출 가중치 회귀 확인 필요 |
| 멸칭 표제어 노출 정책 | `nance`·`fagot`·`midget`·`negroid`·`nigger`·`spic`·`aborigine` 등 | 목록 확정 후 수동 | `register` 경고 또는 카드 제외 — **제품 정책 결정** |
| 중복 sense dedupe | `shark` 3중 중복 등 | 기계 탐지 | T7 보존 게이트가 **구조적으로 못 지우는** 영역 — 별도 게이트 필요 |
| T6 초기 청크 00~23 재판정 | 약 2,880단어 | 구 규칙(예문만 교체)으로 판정된 구간 | 원본이 입력 청크에 있어 **되돌릴 수 있음** |

⚠️ CEFR 재배정은 **단어 추출 가중치와 학습자 추천 경로를 바꾼다** — 데이터 수정이 아니라 제품 동작 변경에
가깝다. 표제어 정규화는 PK 변경이다. 둘 다 별도 승인 후 진행할 것.

관련: [[project_dict_field_completeness]](채움률 관점) · [[feedback_fix_structural_gaps]]
