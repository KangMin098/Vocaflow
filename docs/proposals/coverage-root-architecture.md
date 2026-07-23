# 사전 커버리지 ~100% 근본 아키텍처 검토

- **Status**: Review (2026-07-23)
- **문제 정의(사용자 방향성)**: 도서에서 잔여를 수집·저장하는 방식 ❌. **미관찰 입력에도 일반화되는 근본적 사전 DB + 해소 함수**로 커버리지 100%에 수렴 ✅. 도서 추출 테스트는 **소스가 아니라 검증 수단**.
- **판정 기준**: "이 방안이 관찰 안 된 새 입력에도 작동하는가?" (Yes = 근본 / No = 밴드에이드)
- **관련**: [extraction-evaluation-2026-07-23.md](./extraction-evaluation-2026-07-23.md)(200권 평가 · 잔여 분해) · `lookup_word_meaning`

---

## 0. 재판정 — 현 `dialect_map`은 밴드에이드인가?

부분적으로 그렇다. **관찰된 74개를 수집**한 것이라, 미관찰 방언엔 무력. 단, 결론은 "맵을 버려라"가 **아니다**:

- 영어 eye-dialect·고어는 **닫힌 언어 부류(closed class)** — 유한하고 문헌으로 정립됨(수백 개). 불규칙동사표(go→went)를 규칙으로 못 만들 듯, `gwine·dunno·twould·betwixt`도 **열거가 정답**.
- **밴드에이드 vs 근본의 진짜 경계**: "우리 도서에서 나온 것만 수집"(밴드에이드) vs "**언어학적 폐쇄집합을 사전에 완비**"(근본). 후자는 사전 구축이다.

→ 방향: 맵을 **관찰 기반 → 언어학 인벤토리 기반 완비**로 승격 + 규칙/음성 생성엔진으로 규칙적 부분 흡수.

---

## 1. 잔여의 3부류 (200권 클린 실측)

| 부류 | 예 | 성격 | 근본 해법 축 |
|---|---|---|---|
| **A. 비표준 철자** | 방언(gwine·yaller·nothin·drownded)·고어철자 | 발음 보존, 철자 변형 | **생성 규칙 + 음성 + 폐쇄집합** |
| **B. 생산적 형태론** | heteronormativity·decivilization·uncharitableness | 접사 조합(무한 생산적) | **재귀 형태소 분석 엔진** |
| **C. 진성 희귀 어휘** | betwixt·quoth·wroth·phthisis·chirurgeon | 실제 표제어 필요 | **사전 베이스 완비(Webster 고어 + 생성)** |

---

## 2. Area A — 비표준 철자: 생성 3층 하이브리드

### 실측: 단일 알고리즘 불가
음성 매칭(Double Metaphone + 편집거리) 12개 방언 검증 → **~3개만 성공**:

| 방언 | dmetaphone 일치 | lev | 판정 |
|---|---|---|---|
| drownded→drowned | ✅ | 1 | 음성 OK |
| sartin→certain | ✅ | 3 | 음성 OK(느슨) |
| critter→creature | ✅ | 4 | 음성 OK(과대) |
| yaller→yellow · furder→further | ❌ | 2-3 | 음성 실패 |
| gwine·twould·dunno·betwixt·methinks | ❌ | 1-4 | 음성 실패 |

→ dmetaphone은 **인명 매칭용**이라 eye-dialect 왜곡(y탈락·th→d·축약)엔 부적합. **알고리즘 단일 대체 불가**.

### 근본 = 생성 3층 (규칙 → 음성 → 폐쇄집합)

```
미해소 토큰
 1층 생성 철자규칙   -in→-ing(완료)·-a'→-ing·이중자음·gh탈락 등 규칙적 패턴 → 사전조회
 2층 음성 근접       Double Metaphone 일치 ∧ Levenshtein≤2(엄격) → 사전조회  ※느슨매칭 배제
 3층 폐쇄집합 오버라이드  언어학 인벤토리 기반 eye-dialect/고어 맵(불규칙 전용)
 → not_found
```

- **1층(규칙)**: 규칙적 방언은 생성적으로 흡수(미관찰도 작동). 최대 커버·정밀.
- **2층(음성)**: drownded·sartin류. **Levenshtein≤2 엄격 게이트**로 오탐 차단(there/their는 tier1서 이미 exact 해소돼 여기 안 옴). `fuzzystrmatch` 확장 활성 완료.
- **3층(맵)**: gwine·dunno·twould 등 **불규칙**만. 관찰이 아닌 **문헌 eye-dialect 목록**(예: Wright 방언사전·표준 archaic 목록)에서 **완비** → 근본. 현 74개 → 목표 ~300-400 폐쇄집합.

**정밀 원칙**: 3층 모두 **exact/굴절/형태소 tier 실패 후에만** 진입(비단어만 대상) + 편집거리·접사유효성 게이트.

---

## 3. Area B — 생산적 형태론: 재귀 형태소 분석 엔진

### 근본 원인
영어 파생은 **생산적·재귀적**: `hetero+normativ+ity`·`de+civil+ization`·`un+charitable+ness`. 현 tier 5는 **12개 접미사 고정·단층·접두 없음** → 학술 신조어 미해소.

### 근본 = 재귀 접사 분석
```
토큰 → [접두 스트립*] + base + [접미 스트립*] (재귀)
  접두: non un de re pre post anti inter intra sub super over under
        micro macro hetero homo multi semi counter trans hyper pseudo neo co ...
  접미: -ness -ity -tion/-ation -ization -ism -ist -ic -al -ly -less -ful
        -ish -ment -able/-ible -er -ing -ed -ize -ify ...
  종료조건: base ∈ 사전(분류·뜻有) ∧ length(base)≥3 ∧ 접사 유효
```
- **일반화**: `post-X·non-X·X-ization·hetero-X`가 base만 알면 무한 해소(열거 불요).
- **뜻 조합**: 접사 체계 의미로 합성 — non=비/불·de=탈·-ness/-ity=~성/~함·-ization=~화·-ist=~주의자·hetero=이질. 투명복합어는 "이질규범성"류로 근사 제시(정밀 sense는 "파생·근사" 플래그).
- **오탐 게이트**: base 실재+최소길이+알려진 접사(unit≠un+it 차단).
- **위치**: exact/굴절 뒤. 현 tier5 + surface_variants(-ization/-ism/-ist)를 **흡수·확장**.

### 한계
- 정밀 학술 정의(governmentality의 푸코적 의미)는 형태소 합성으로 불가 → Area C(생성)로 위임. 형태소는 **투명 복합어**를 커버(대다수).

---

## 4. Area C — 진성 희귀 어휘: 사전 베이스 완비

### 근본 원인
betwixt·quoth·wroth·methinks·ere·thither·phthisis 등은 방언도 파생도 아닌 **실제 표제어** → 사전에 있어야 함. 현 lexicon_clean(WordNet 147k + Webster 58k)에 누락.

### 근본 = 오프라인 사전 완비 (도서 무관)
1. **Webster 1913(PD) 완전 재적재**: 1913판은 고어·문어·폐어 풍부(~100k+ 표제어). 현 58k는 부분 → **완전 추출** 시 betwixt·quoth·wroth류 정의 확보 → Google/LLM 한국어.
2. **포괄 표제어 리스트 → 생성 파이프라인**: 남은 tail은 오프라인 뜻 생성(무료 MT 초벌 / 정밀필요분 LLM). **일회성 사전 구축** — 미관찰 입력도 커버.
3. Area B(형태소)가 tail을 축소 → C는 **환원 불가 진성 표제어**만.

핵심: **per-book 수집이 아니라 퍼미시브 소스(Webster) + 생성으로 사전을 포괄 구축** → 사용자 방향성 정합.

---

## 5. 통합 해소 파이프라인 (근본형)

```
토큰
 1 exact           shared_dictionary(포괄 베이스) · lexicon_clean
 2 inflection      en_inflection_bases (기존)
 3 형태소 엔진      재귀 접두/접미 분석 (Area B · 생성)         ← 확장
 4 철자규칙        -in→-ing 등 생성 규칙 (Area A-1)            ← 확장
 5 음성 근접       dmetaphone ∧ lev≤2 (Area A-2)              ← 신규(엄격)
 6 폐쇄집합 맵     eye-dialect/고어 완비 인벤토리 (Area A-3)    ← 승격
 7 not_found
```
+ **베이스 완비**(Area C): 1층 사전을 Webster 완전판 + tail 생성으로 포괄화(오프라인).

**원칙**: 생성 엔진(형태소·규칙·음성) + 포괄 베이스(사전 구축) + 폐쇄집합 완비(언어학 인벤토리). 셋 다 **언어학/사전 소스에서 오프라인 구축**, 도서 테스트는 **검증 전용**.

---

## 6. 우선순위 · 근본성 · 예상 효과

| # | 방안 | 근본성 | 난이도 | 잔여 축소 기여 |
|---|---|---|---|---|
| 1 | **재귀 형태소 엔진**(B) | ★★★ 생성 | 중 | 학술·파생 대다수(생산적) |
| 2 | **Webster 완전 재적재**(C) | ★★★ 베이스 | 중 | 고어·희귀 표제어 큰 덩어리 |
| 3 | **음성 근접 tier**(A-2) | ★★☆ 생성 | 하 | 방언 ~30%(drownded류) |
| 4 | **철자 규칙 확대**(A-1) | ★★★ 생성 | 하 | -in 외 규칙 방언 |
| 5 | **eye-dialect 완비**(A-3) | ★★☆ 폐쇄집합 | 하(목록확보) | 불규칙 방언·고어 |

**권장 순서**: ② Webster 완전판(베이스가 최우선 — 형태소·음성의 base 실재율↑) → ① 형태소 엔진 → ③④ 철자/음성 → ⑤ 폐쇄집합 완비.

---

## 7. 트레이드오프 · 리스크

- **정밀 vs 재현**: 음성/형태소 tier는 오탐 위험 → 엄격 게이트(lev≤2·base실재·접사유효) + 후순위 배치. 학습자에 "파생·근사/방언" 플래그로 신뢰 표시.
- **뜻 품질**: 형태소 합성·MT 초벌은 근사 → 정밀 정의는 LLM 오프라인(비용 판단 필요). 다만 "근사 뜻이라도 있음" ≫ not_found(독해 지원 목적).
- **베이스 용량**: Webster 완전판 +수만 표제어 → lexicon_clean 증가(수십 MB). 청정(PD).
- **"100% 수렴"의 정의**: 리터럴 100%는 불가(신조어·외국어 무한). **실사용 토큰 99.x% + 미해소는 근사/플래그**가 현실 목표. 200권 실측 현재 99.69% → 위 5종으로 99.9%+ 도달 가능.

---

## 8. ★ 실측 교정 (2026-07-23 재검증) — 방안이 실제로 되는가?

사용자 질의("방언·희귀어 실제 대응되나?")에 **데이터로 자기검증한 결과, 초안 일부가 틀렸다**:

### 교정 1 — "희귀어" 범주는 대체로 허상. Area C(Webster) 오판.
- betwixt·quoth·wroth·thither·ere·phthisis → **전부 이미 `direct` 해소**(사전에 있음).
- 즉 "Webster가 고어 누락"은 **거짓**. 진짜 잔여는 "누락된 사전 표제어"가 아님 → **Webster 완전판 재적재는 저효용**(우선순위 강등).

### 교정 2 — 진짜 잔여는 대부분 **철자변형(방언/고어굴절)** 이고, 상당수가 **생성 규칙**으로 잡힘.
장단어 미해소 표본의 실제 정체 + 규칙 실효(distinct lemma):

| 유형 | 예 | 규칙 | 실효 |
|---|---|---|---|
| -in' 방언 | nothin·lookin | -in→-ing | 218 (적용완료) |
| **a-VERBin'** | a-fightin·a-standin | a- 제거 + -in→-ing | **42** |
| **고어 굴절** | abhorreth·makest·doth | -eth/-est→base | **450** |
| 복합어 | abovenamed·airminded | split(앞+뒤 사전) | 다수(생성) |
| **음성 오철자** | ackshally·aixcellent·affydavit | 음성(~30%)+맵 | 부분 |
| 외국어·nonce·OCR | aeternitatis·abbaratta | — | **환원불가** |

→ **생성 규칙(–in·a-·-eth/-est·복합분해)만으로 ~700+ lemma 추가 해소** = 방언/고어의 규칙적 대다수는 **진짜 생성적으로 대응됨**.

### 교정 3 — 정직한 판정
| 대상 | 되는가? |
|---|---|
| **고어 정칙 어휘**(betwixt류) | ✅ **이미 됨** |
| **규칙적 방언/고어굴절**(-in·a-·-eth/-est·복합) | ✅ **생성 규칙으로 됨** (~700+) |
| **불규칙 음성 방언**(yaller·gwine·ackshally) | △ 부분(음성 30% + 폐쇄집합 맵) |
| **외국어(라틴/독일)** | ✗ 범위밖(별도) |
| **nonce·OCR·author 조어**(abbaratta) | ✗ **환원불가**(어떤 사전도 불가, 정답=플래그) |

## 9. 결론 (교정본)

- **"방언·희귀어 대응되나?" → 조건부 YES**: 규칙적 대다수(–in·a-·-eth/-est·복합·정칙고어)는 **생성적으로 대응**. 불규칙 음성방언은 부분. **nonce·외국어·OCR는 환원불가**(=억지 뜻 부여 금지, "독해참고/건너뛰기" 플래그가 정답).
- **초안 오류 정정**: ~~Webster 완전 재적재(Area C)~~ 는 **저효용**(고어 이미 커버) → 강등.
- **근본 우선순위(교정)**:
  1. **생성 규칙 확대** — a- 제거·-eth/-est·복합분해(–in 완료). 최대 생성 효과(~700+), 미관찰 일반화.
  2. **음성 tier**(엄격 lev≤2) — 불규칙 방언 ~30%.
  3. **eye-dialect 폐쇄집합**(문헌 인벤토리) — 나머지 불규칙.
  4. ~~Webster 완전판~~ → 보류(marginal).
- **"100% 수렴"의 현실**: nonce·외국어·OCR는 원리적 환원불가 → **토큰 ~99.9% + 환원불가 tail은 플래그**가 도달 목표(억지 100% 아님).
