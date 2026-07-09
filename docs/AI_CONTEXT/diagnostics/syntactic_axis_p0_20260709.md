# P0 정찰 — 통사 축(syntactic axis) 신설 정당성 실측

> **read-only 진단** (SELECT만 · apply_migration·쓰기 0). 작성 2026-07-09.
> **질문**: `book_v_level`(어휘) + F-K(가독성) 2축 위에 **통사 축**(도치·절 깊이·고문 구문)을
> 별도 신설해야 하는가? — 실측이 결정한다.
> **대상**: 적재 완료 도서 **26권** (book_v_level NOT NULL). *20권이 아니라 26권 — 카탈로그 성장.*

---

## TL;DR — 판정

> **현 카탈로그에서 통사 축 신설은 실측상 정당화되지 않는다 (DEFER).**
> F-K가 "어휘 대비 구조가 어려운" 책을 **전부 이미 포착**한다. 통사 축이 노릴 유일한 사각지대
> (**짧은 문장 + 도치/고문**)에 해당하는 책이 26권 중 **0권**.
>
> 대신 실측이 드러낸 **진짜 결함 2건**이 더 높은 ROI:
> 1. **챕터 편차 3~5 V-level** — 단일 book_v_level이 챕터 난이도를 뭉갬 (ADR Dorian 패턴 **재현 확정**).
> 2. **F-K NULL 4권** — 기존 가독성 축의 데이터 공백.

---

## 1. 축 구분 재확인 (실측)

| 축 | 컬럼 | 측정 대상 | 상태 |
|---|---|---|---|
| 어휘 | `book_v_level` (distinct lemma p75, V11 제외) | 단어 레벨 | ✅ 완비 |
| 가독성 | `flesch_kincaid_grade` / `flesch_reading_ease` | 문장 길이 + 음절 | △ 4권 NULL |
| **통사** | **없음** | 도치·절 깊이·고문 | ✗ 미측정 |
| i+1 배치 | `lexical_coverage` (jsonb) | V-band 누적 커버리지 곡선 | ✅ (챕터별 아님) |

`lexical_coverage`는 **챕터별이 아니라** V-band 누적 곡선 — 예: Alice `{V6:90.8, V8:95.3, V9:98.3}`,
Les Mis `{V6:77.9, V8:89.2, V9:95.5}` (k=V레벨까지 알 때 본문 토큰 %). i+1 판정용이지 챕터 편차 지표 아님.

---

## 2. 전권 매트릭스 — 어휘(V) vs 가독성(F-K)

F-K 내림차순. `Δ` = F-K가 어휘보다 높으면(구조가 어휘보다 어렵다) 통사 후보.

| 책 | 어휘 V | F-K | ease | 해석 |
|---|---|---|---|---|
| Decline and Fall (Gibbon) | 9 | **20.0** | 28 | 둘 다 최상 — 일치 |
| **Foundational Observations** (Wikibooks 정책서) | **6** | **14.55** | 32 | ⬅ 어휘 낮음·구조 최난 → **F-K가 포착** |
| Pride and Prejudice | 8 | 12.44 | 55 | 일치 |
| Dialogues (Plato) | 9 | 12.30 | 56 | 일치 |
| Jane Eyre | 9 | 11.73 | 62 | 일치 |
| Twenty Years After (Dumas) | 9 | 10.80 | 63 | 일치 |
| Great Expectations | 9 | 10.67 | 66 | 일치 |
| **Alice in Wonderland** ×2 | **6** | **10.5~10.7** | 68~70 | ⬅ 어휘 낮음·문장 긺 → **F-K가 포착** |
| Marvelous Land of Oz | 7 | 9.93 | 67 | 일치 |
| Pinocchio | 7 | 9.70 | 70 | 일치 |
| Fables (Aesop) | 7 | 9.65 | 73 | 일치 |
| Wind in the Willows | 8 | 9.49 | 69 | 일치 |
| Poetry (Stevenson) | 9 | 9.28 | 72 | 어휘 높음·F-K 중 (역방향 경미) |
| Sherlock Holmes | 8 | 9.03 | 70 | 일치 |
| Just So Stories | 7 | 9.03 | 74 | 일치 |
| **Les Misérables** | **9** | **8.92** | 65 | ⬅ **어휘 최난·문장 평이** = 통사 축 방향과 반대 |
| Huckleberry Finn | 7 | 8.69 | 78 | 일치 |
| Wonderful Wizard of Oz | 6 | 8.67 | 76 | 둘 다 쉬움 — 일치 |
| Railway Children | 7 | 6.77 | 79 | 어휘 중·F-K 낮음 (역방향) |
| Tell Me What is a Drone | 3 | 2.87 | 87 | 둘 다 최쉬움 — 일치 |
| Ammachi's Amazing Machines | 4 | 2.98 | 86 | 일치 |
| Book of Tea · Short Fiction · Intro Sociology · Alice Adams | 7·7·8·9 | **NULL** | — | ⬅ **가독성 미산출** |

### 판정 논리 (사용자 결정 규칙 그대로)

- 통사 축의 **유일한 사각지대** = *어휘 쉬움 + 문장 짧음(F-K 낮음)인데 실제로는 도치/고문으로 어려운 책*.
  F-K는 문장 길이를 재므로, **긴 만연체는 자동 포착**하고 오직 **짧은 문장 속 구조 난이도**만 놓친다.
- 실측: 그런 책이 **0권**.
  - "어휘 낮음 + 구조 어려움" 후보 2종(Wikibooks V6/F-K14.55, Alice V6/F-K10.5)은 **F-K가 이미 크게 플래그** → 통사 축이 **중복**.
  - 역방향(Les Mis V9/F-K8.9, Railway V7/F-K6.8)은 *어휘가 어렵고 문장은 평이* — 통사 축이 노리는 방향의 반대.
- ∴ **F-K + book_v_level 2축이 현 26권의 모든 케이스를 판별**. 통사 스코어러의 한계효용을 입증할 반례가 카탈로그에 없음. — **단정**

> 단, F-K **절대값**은 신뢰 못 함(상대 플래그로만 유효): 동화 Alice를 grade 10.5로 **과대**, 번역 산문 Les Mis(V9)를 grade 8.9로 **과소**. F-K가 원어민 학년 지표라 EFL 미보정이라는 사용자 지적 그대로 재현. — **단정**

---

## 3. 챕터 편차 — ADR "Dorian 단일점수 뭉갬" 재현 (확정)

챕터별 p75를 `library_book_vocabularies`(122,935행) ⋈ `shared_dictionary.v_level`로 재계산
(챕터당 lemma≥20, V11 제외 — compute_book_vrl 동일 규칙).

| 책 | 단일 book_v | **챕터 범위** | 편차 | 챕터 SD |
|---|---|---|---|---|
| Fables | 7 | **V4 → V9** | **5** | 1.19 |
| Poetry (Stevenson) | 9 | **V5 → V10** | **5** | 1.12 |
| Pride and Prejudice | 8 | V5 → V9 | 4 | 1.07 |
| Pinocchio | 7 | V5 → V9 | 4 | 1.06 |
| Alice in Wonderland | 6 | V4 → V8 | 4 | 1.00 |
| Short Fiction (Potter) | 7 | V5 → V9 | 4 | 0.98 |
| Marvelous Land of Oz | 7 | V5 → V9 | 4 | 0.92 |
| Foundational Observations | 6 | V4 → V8 | 4 | 0.92 |
| Les Misérables | 9 | V6 → V10 | 4 | 0.66 |
| (그 외 12권) | — | 대부분 spread **3** | 3 | 0.4~1.0 |
| Book of Tea (7ch) | 7 | V7 → V8 | 1 | 0.53 |

- **거의 전권 챕터 편차 3~5 V-level.** Fables(V7 라벨) 안에 V4 챕터와 V9 챕터가 공존. 학습자가 "V7 도서"를
  열면 챕터마다 V4~V9를 오간다 → **단일 book_v_level이 챕터 난이도를 구조적으로 뭉갬**. — **단정 (ADR 패턴 재현)**
- 이 결함은 **통사 축과 무관**하며, 통사 축 부재보다 **체감 오차가 크다**. 챕터별 v-level은 **이미 lbv에서 산출 가능**
  (본 쿼리가 증명) — 저장/노출만 하면 됨.

---

## 4. 결론 & 권장 (우선순위)

| 우선 | 조치 | 근거 | 비용 |
|---|---|---|---|
| **P1** | **챕터별 v-level 노출** (reader/picker에 챕터 난이도 표시) — lbv 기반 산출을 `texts.text_v_level` 백필 또는 뷰로 | §3 편차 3~5 실측 | 중 (쓰기·승인 필요) |
| **P2** | **F-K NULL 4권 백필** (기존 가독성 축 완결) | §2 4권 공백 | 소 |
| **DEFER** | **통사 스코어러 신설** | §2 반례 0 — 현 카탈로그서 중복 | — |
| 재검토 트리거 | **짧은문장+고문 코퍼스 적재 시** (KJV·법률문·조밀 운문) — 이때 F-K가 구조적으로 실패 → 통사 축 정당화 | 현재 미존재 | — |

### 만약 그래도 통사 축을 적용한다면 (조건부 설계 스케치)

파서 없이 JS 프록시로 ingest 단계(`packages/library-pipeline` readability step, F-K 옆)에서:
- **종속절 밀도** = (종속접속사 that/which/who/whom/because/although/whereas + 관계사 + 쉼표) / 문장수
- **도치 탐지** = 부정어-선두 / 조동사-주어 선행 패턴 카운트
- **고문 마커** = ere/thee/thou/'tis/hath/whom / 1000단어
- → 0~100 `syntactic_score` + `syntactic_components` jsonb. **F-K와 어휘가 근접(|Δband| 작음)할 때만 tiebreaker로** 합성(동일 길이에서 구조 조밀 vs 단순 분리). Gibbon/Plato(조밀) vs Huck Finn(단순)이 유사 F-K에서 갈리는지로 캘리브레이션.

**단, §2에서 반례가 0이므로 지금 만들면 검증 대상이 없다 — 트리거 코퍼스 적재 후 착수 권장.**

---

## 부록 — 실행 쿼리 (재현용, 전부 read-only)

1. 전권 덤프: `library_books` book_v_level·flesch_kincaid_grade·flesch_reading_ease·vrl_components·lexical_coverage.
2. 이상치: `book_v_level<=6 AND flesch_kincaid_grade>=10` → 4행 (Wikibooks·Alice×2 + Wikibooks).
3. 챕터 편차: `library_book_vocabularies ⋈ shared_dictionary(word=lemma)` per (book,chapter) PERCENTILE_DISC(0.75), V11 제외, lemma≥20.

*산출물 성격: 진단. 본 문서는 쓰기 조치를 포함하지 않으며, P1/P2 실행은 별도 승인 게이트.*
