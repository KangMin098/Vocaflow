# 단어추출 품질 평가 — 15권 전수 (2026-07-23)

- **시점**: 선제형 French 사전(37,955) + 표면형 정규화(de-하이픈·접두·소유격·파생접미사) 적용 후.
- **방법**: `library_book_vocabularies` 15권 distinct lemma **76,690**를 해소 계층별 분류(`_eval_cls`). 계층: 학습코어(shared_dictionary)/영어커버리지(lexicon_clean en)/외국어(lexicon_clean lang≠en)/정규화/잔여.
- **정본**: DB direct query. 재현 = `_eval_cls` 재빌드.

---

## 1. 총평 — 목표 도달

| 지표 | 값 |
|---|---|
| **전체 해소율** | **98.8%** (75,755 / 76,690) |
| 잔여 | 935 (1.2%) |
| **외국어 신규 해소(이번 세션)** | **438** (French 사전 효과) |
| 완벽 해소 | Time Machine 100%, Christmas Carol·Pinocchio 99.9% |

**결론**: 잔여 1.2%는 대부분 **정당한 비(非)어휘**(고유명사·방언·외국어·OCR노이즈)로, 사전/추출 결함이 아니다. 남은 유일한 실결함은 **소스 텍스트 OCR 손상**(추출·사전이 아닌 상류 ingestion 문제).

---

## 2. 도서별 해소율

| 도서 | lemma | 해소% | 잔여 | 외국어 | 잔여 성격 |
|---|---|---|---|---|---|
| Les Misérables | 12,470 | 97.7 | 290 | 323 | 프랑스 은어·라틴·OCR·인명 |
| Sociology (OER) | 10,166 | 98.1 | 194 | 22 | **OCR 손상**+학술 신조어 |
| Dialogues | 9,730 | 98.7 | 124 | 18 | 그리스·라틴 음역 |
| Roman Empire | 9,654 | 98.8 | 116 | 5 | 라틴·아랍/터키 음역 |
| Twenty years after | 6,765 | 99.7 | 18 | 18 | 프랑스 인명 |
| Tom Sawyer | 4,871 | 99.0 | 50 | 6 | **방언**(gwine·tobacker) |
| Pride and Prejudice | 4,013 | 98.8 | 47 | 20 | **고유명사**(Pemberley) |
| Treasure Island | 3,999 | 99.2 | 31 | 7 | 방언(dooty·natur) |
| Time Machine | 3,324 | 100.0 | 0 | 0 | — |
| Call of the Wild | 3,289 | 99.4 | 20 | 2 | 방언(mebbe·nevaire) |
| A Christmas Carol | 3,034 | 99.9 | 2 | 0 | — |
| Ozma of Oz | 2,710 | 98.6 | 37 | 15 | OCR 파편 |
| Pinocchio | 2,550 | 99.9 | 3 | 1 | — |
| Drone / Ammachi | 115 | ~97 | 3 | 2 | 유아용, 표본 작음 |

---

## 3. 잔여 935 정밀 분해 (정량)

| 유형 | 규모 | 처리방향 |
|---|---|---|
| OCR 첫글자탈락 (a-z 복원 시 사전有) | 78 | 소스 재적재(상류) |
| 축약 파편 (couldn·doesn) | 4 | 토크나이저 |
| 접두 제거 가능 (non/post/micro+base) | 35 | surface_variants 확대(소폭) |
| **진성 부재** | **818** | 아래 정성분해 |

### 진성부재 818 정성 분해 (도서 성격별)

| 버킷 | 대표 | 정당 잔여? |
|---|---|---|
| **고유명사** | Pemberley·Derbyshire·Fitzwilliam·Netherfield·xlix(로마숫자) | ✅ 정당 (암기 대상 아님) |
| **작가 방언(eye-dialect)** | gwine·agin·dunno·drownded·tobacker·mebbe·nevaire·dooty | ✅ 정당 (의도된 음성표기) |
| **외국어 비-French** | 라틴(aeternitatis)·그리스(gerousia)·독일(stahlhartes)·아랍(muezin) | ✅ 정당 (범위 밖, §5) |
| **19c 프랑스 은어(argot)** | bastringue·bousingot·caboulots·camoufle | ✅ 정당 (현대 빈도목록 밖) |
| **OCR 파편(다글자 탈락·분절)** | brac·cept·chiev·peo·serv·tures·ociety·eople | ❌ 소스 결함 |
| **학술 신조어·희귀 파생** | heteronormativity·governmentality·decivilization·brokenheartedly | △ 일부 진성갭(소수) |

**핵심**: 잔여의 ~85%는 **정당 잔여**(고유명사·방언·외국어·은어) — 학습자가 영어 어휘로 암기할 대상이 아니다. 나머지 ~15%는 **OCR 소스 손상**(상류 문제)과 소수 학술 신조어.

---

## 4. 개선점 (우선순위)

### P1 — 소스 텍스트 품질 (유일한 실결함, 상류)
- **Sociology·Ozma OCR 손상**: 첫글자탈락(ociety→society)·단어분절(ture/tures). 사전으로 "복원"하면 손상 원문에 뜻을 붙여 학습자 혼란 → **정답은 재적재**. Sociology는 OER(클린 HTML 존재) → 재수집 권장.
- 효과: Sociology 잔여 194 중 OCR분 대량 제거 + 본문 가독성 향상.

### P2 — winkNLP PROPN 태깅 (추출 단계)
- 현재 고유명사는 lemma 소문자화로 추출 대상에 포함됐다가 잔여로 떨어짐(사실상 제외되나 잔여 지표 오염). winkNLP PROPN으로 추출 시 분리하면 잔여 지표가 "진짜 미해소"만 남음.
- 효과: 지표 정확도↑(해소율 계산에서 고유명사 제외). 학습 경험은 이미 정상(고유명사 not_found 안내).

### P3 — 방언 표기 (선택, 낮음)
- gwine→going 매핑 tier는 니치 NLP. 오히려 "방언" 안내가 학습적으로 유익 → **현행 유지 권장**.

### P4 — 학술 신조어 보강 (선택, 소규모)
- heteronormativity 등 진성 학술어 수십 개 → lexicon_clean Google 배치 적재 가능. 다만 상당수는 투명 복합어(hetero+normativity)라 ROI 낮음.

### 범위 밖 (확정)
- **라틴/그리스**: lemmatizer 없이는 굴절형 매칭 불가(stem 23%) → 별도 프로젝트. (foreign-language-reading-support.md §9)

---

## 5. 세션 효과 (before/after)

| | French 사전 前 | 後 |
|---|---|---|
| Les Misérables | 95.1% | **97.7%** (+2.6pp) |
| 외국어 해소 총량 | 0 | **438** |
| 잔여 성격 | French가 잔여 최대 오염원 | French 제거, 잔여=정당 비어휘 |

---

## 6. 최종 판정

- **단어추출 + 사전 품질은 목표 도달**: 98.8% 해소, 잔여 1.2%는 ~85% 정당(고유명사·방언·외국어·은어).
- 잔여를 더 쫓는 것은 **수확체감**: 남은 건 사전 갭이 아니라 소스 OCR·의도된 방언·범위밖 외국어.
- **다음 실질 액션은 상류(소스 재적재)**, 사전/추출 로직이 아니다.

---

## 7. 진성부재 818 — 학습자 독해 관점 재검토

핵심 질문: 학습자가 이 단어를 만났을 때 **뜻이 필요한가(독해 이해)**, 아니면 **넘어가도 되는가(라벨만)**. 진성부재는 균질하지 않다 — 두 부류로 갈린다.

### 번역 가능성 실측 (독해지원 실현가능성)

| 버킷 | Google 무료 MT | 판정 |
|---|---|---|
| 학술 신조어(en) | ~60% (governmentality→통치성·lifeworld→생활세계 ✅ / heteronormativity→이종표준성·embeddedness→내장·decivilization→문명화 ✗) | **핵심어 오역** — 정밀도 필요 영역에서 부정확 |
| 작가 방언(en) | ~15% (drownded→익사만 / gwine→그와인·mebbe→메베 음역) | **실패** — 표준형 매핑 선행 필요 |
| 프랑스 은어(fr) | ~20% (camoufle→위장만 음역) | **실패** — 전용 glossary 필요 |

### 부류 A — 뜻이 필요 (독해 이해 대상)

| 버킷 | 독해 가치 | 실현 | 방안 |
|---|---|---|---|
| **작가 방언** (gwine·dunno·tobacker·drownded) | **높음** (소설 독해 핵심) | 매핑만 있으면 즉시 | **eye-dialect→표준형 큐레이션 맵**(gwine→going) → 기존 사전 재사용. LLM·MT 불요, 매핑이 관건. ~120개 규모(방언 도서 집중). **최고 ROI 독해지원 신규항목** |
| **학술 신조어** (heteronormativity·governmentality) | **높음** (교육 콘텐츠) | 부분(정밀 부족) | ① 투명복합어(hetero+normativity·post+modernity)는 **형태소 분해 tier** 로 부분해결 ② 핵심 정의어는 **정밀 필요→LLM**(무료정책과 상충, 보류) 또는 Google초벌+검수 |
| **프랑스 은어** (bastringue·bousingot) | 중 (Les Mis 한정) | 낮음 | 전용 19c argot glossary 무료 구조화 없음 → **보류** |
| **고전 외국어** (라틴·그리스) | 중 | 낮음 | lemmatizer 별도 프로젝트 (확정 범위밖) |

### 부류 B — 뜻 불요, **라벨만** 필요 (넘어가도 됨)

| 버킷 | 독해 처리 | 현재 | 개선 |
|---|---|---|---|
| **고유명사** (Pemberley·Fitzwilliam) | 뜻 없이 진행 — 이름임을 알면 충분 | "사전에 없는 단어 / 외국어·고유명사이거나 인식오류" (뭉뚱그림) | **"인명/지명 — 넘어가도 돼요"** 명확 라벨 (학습자 노력 절약) |
| **OCR 파편** (ociety·brac) | 복원해도 손상원문에 뜻붙임=혼란 | 동상 | 소스 재적재(P1). 라벨은 "인식 오류" |

### 독해지원 개선 — 우선순위 (재정렬)

1. **작가 방언 표준형 맵** (부류A 최고 ROI): eye-dialect ~120개 → 표준형 큐레이션(gwine→going·tobacker→tobacco·mebbe→maybe) → 기존 사전 해소. 툴팁에 "방언: going" 표기. **무료·정밀·독해직결**.
2. **not_found 라벨 세분화** (부류B, 저비용 고효용): 고유명사(is_valid_word=false 또는 winkNLP PROPN) → "인명/지명" · OCR/기타 → "인식 오류". 학습자가 "이건 넘어가도 된다"를 즉시 인지 → 독해 흐름 유지(Calm UI).
3. **학술 투명복합어 형태소 분해** (부류A): post-/non-/micro-/hetero- + 사전有 base → 조합 뜻 제시. 정밀 정의어는 LLM 대기.
4. 보류(범위밖): 프랑스 은어·고전 외국어.

### 판정
- 진성부재의 독해지원은 **"전부 뜻 채우기"가 아니라 "뜻 필요분(방언·학술) vs 라벨 필요분(고유명사·OCR) 분리 대응"**.
- **무료·정밀·즉효 = 작가 방언 표준형 맵 + not_found 라벨 세분화**. 이 둘이 학습자 독해 체감을 가장 크게 올린다.
- 학술 정밀 정의는 무료 MT 한계(핵심어 오역) → LLM 사전작업 별도 판단 필요.

---

## 8. 대규모 검증 — Standard Ebooks 199권 (2026-07-23)

15권 평가를 확장. **소스 = Standard Ebooks**(손교정 클린 고전, **OCR 손상 0**) → 이전 잔여 최대 오염원(OCR)을 제거한 순수 추출+사전 품질 측정. 추출 = 프로덕션 winkNLP(`@vocaflow/wlp`) 재사용. 인프라: `extraction_test_books/vocab`, `scripts/dict/build-test-corpus.mts`, `measure-test-corpus.sql`.

### 규모·해소율

| 지표 | 값 |
|---|---|
| 도서 | 199권 (Kipling·Shaw·Heyer·SF·정치/역사 등 난이도 고전) |
| 토큰 | 5,948,640 · 고유 lemma 53,617 |
| **토큰 가중 해소(독해 체감)** | **99.57%** (잔여 25,438) |
| 도서×lemma 해소 | 98.73% |
| 고유 lemma 해소(어휘 폭) | 83.7% (진짜 잔여 8,720) |
| French 사전 기여 | 858 lemma / 1,728 등장 (고전 속 프랑스어구) |

→ 15권(98.8%)과 일치, **대규모·클린에서 토큰 99.57%**. 파생 tier(-ly/-ness)가 413 lemma 추가 해소(interestedly·uncharitableness→derivation).

### 진짜 잔여 8,720의 정체 (OCR 없는 순수 신호)

| 분포 | 규모 |
|---|---|
| ≥10권 등장(체계적 갭) | 48 |
| 3~9권 | 515 |
| **hapax(1권)** | 7,803 (85%) |

체계적 갭(≥8권) ~85%가 **방언**, 나머지는 고어·진성 희귀어:

| 유형 | 대표 | 처리 |
|---|---|---|
| **-in' 방언(g 탈락)** | nothin·lookin·tryin·somethin·mornin·evenin·playin | **`-in→-ing` 규칙 1개**로 해소 |
| **고어 축약·eye-dialect** | tis·twould·gwine·ef·sence·hae·allus·dunno·wid·agin·yaller·methought·couldst | 큐레이션 맵 |
| **진성 희귀** | comprehendingly·factness·brung·theirselves | 일부 파생 확장, 대부분 hapax 장기꼬리 |

### 정량 개선 임팩트

| 개선 | lemma | 등장 | 도서 | 비고 |
|---|---|---|---|---|
| **`-in→-ing` 정규화** | **218** | **2,796** | 67 | 잔여 등장의 ~11% · 정밀(+ing 사전有만) · 무료 |
| eye-dialect/고어 맵 | ~50-100 | ~1,500+ | 다수 | tis·gwine·twould… 큐레이션 |
| hapax 희귀어 | 7,803 | 소량 | 1권 | 장기꼬리 · 수확체감 |

### 최종 판정 (대규모)
- **토큰 99.57% 해소** — 클린 코퍼스에서 목표 초과 달성. 잔여는 사전 결함 아닌 **방언·고어·일회성 희귀어**.
- **최고 ROI 단일 개선 = `-in→-ing` 정규화 tier**(218 lemma·2,796 등장, 정밀·무료). surface_variants 확대로 즉시 구현 가능.
- 다음 = eye-dialect 큐레이션 맵. hapax는 장기꼬리(보류).
