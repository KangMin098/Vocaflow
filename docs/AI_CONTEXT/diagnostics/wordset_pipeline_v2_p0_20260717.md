# 단어장 파이프라인 v2 — P0 정찰 (2026-07-17)

> 위임받은 read-only 정찰 3건(+curation_query). 데이터가 v2 설계 전제를 판정. 표기 **단정**(실측)/확인필요.
> ⚠️ 정찰이 사용자 self-critique의 **전제 2건을 정정**함(아래 §정정).

---

## 정찰 판정표

| # | 항목 | 결과 | 판정 |
|---|---|---|---|
| **1★** | 학년 노드 (dictionary_categories) | **없음** — H1 18노드 전부 **의미 주제**(음식·여행·건강·과학·정치·동물…). "학교 종류/생활/구성원" 6개는 학교를 *주제*로 다룬 L3(학년 밴드 아님) | dictionary_categories로는 학년 미해소 |
| **1-b** | 학년 데이터 (다른 소스) | **존재** — `kcurr2022_1/2/0` list_tags = 2022 개정 교육과정 기본어휘 3,000 **별표 3단**(초/중/고). `curriculum-2022-elem/mid/high` 세트 **이미 발행**(729/1,184/1,000) | **갭2 실제로 미개방** |
| **1-c** | 주제(thematic) 데이터 | **존재** — `dictionary_categories` 566노드(L1 18·L2 76·L3 472) + `dictionary_word_categories` **28,079 word→cat**(pos·cefr·rank in context) | **주제별 단어장 축 확보**(G4, 플랜에 없던 기회) |
| **2** | shared_words 구조 | `set_id` FK ✅ (멤버십 확정). 그룹 슬롯 = **`chapter`(smallint)뿐**, `day_no`/`group_key` 없음. `sort_order` 존재 | day/group 정박 = chapter 재사용 or 신규 컬럼 |
| **3** | familiarity 뷰 재사용 | `word_familiarity`=**per-user**(user·lemma·verdict), `word_mislevel_signal`=**cross-user 집계**. 세트단위 per-user "몰라요 N개"엔 **재사용 불가** | 신규 조인/집계 필요(오류7 예측대로) |
| **4** | curation_query 스키마 | **불일치** — kice `{filters,source_key}` / vlevel·specialty `{qty,criteria[]}` / etymology `{org,source,filters}`. 공통 스키마 없음 | GENERATED projection(오류2) **전 정규화 선결** |

---

## 🔴 사용자 self-critique 전제 정정 (정찰이 뒤집음) — **단정**

1. **오류5 전제 오류** — `shared_word_sets.category_id`는 **존재하지 않음**(실측: 제안 9컬럼 중 `subcategory`만 존재). 따라서 "8 enum + category_id + 신규 3축 = 3중 장부"는 **틀린 전제** — 현재는 enum `category`(11종) + `subcategory`뿐. queries.ts가 category_id를 select하나 컬럼 부재로 **항상 fallback**(기존 확인). → 오류5는 실재 부채가 아님(과설계 예방은 여전히 유효).

2. **오류1 과잉진단** — "학년 세트 = 단어 단위 데이터 0"은 **부분 오류**. dictionary_categories엔 학년이 없지만 **kcurr2022(교육과정 3000 별표)가 정당한 word-level 학년 소스**이고 grade 세트가 이미 그걸로 발행됨. V-Level→학년 프록시(금지)가 아니라 **교육과정 고시 기반**이라 합법. → **학년 세트를 S-A에서 제외할 근거 없음**(교육과정 3000 범위 내). 단 "고등 필수 1800"처럼 3000 초과 대형은 추가 소스 필요.

---

## Wave 영향 (개정 착수 순서 재조정)

| 세트 | 근거 | 성립 |
|---|---|---|
| 수능 빈출 2000/1000/심화 | `lexicon_frequencies`(kice_csat) | ✅ |
| V-Level 밴드 (V4-5/6-7/8+) | `v_level` | ✅ |
| **학년 (초/중/고)** | **`kcurr2022` 교육과정 별표** | ✅ **(정정 — 데이터 있음, 이미 발행)** |
| **주제별 (음식/여행/건강…)** | **`dictionary_categories` 566노드 + 28,079 매핑** | ✅ **(신규 기회 — 플랜 밖)** |
| 3000 초과 대형 학년 | 교육과정 부록 or 추가 코퍼스 | 🔴 (소스 선결) |
| 어원(S-E) | word_root_links | ✅ **이미 구축**(v06.253) |

**나머지 오류(2·3·4·6·7·8·9)**: 대체로 구현 세부로 타당. 단 **오류2는 curation_query 정규화가 선결**(현 1,066 세트가 `filters.grade_band` 경로 미준수 → GENERATED 컬럼이 대부분 NULL). 오류3(set_family_id/version)·오류4(grouping×day CHECK)·오류6(preview_/generate_ 헬퍼 공유)·오류7(세트단위 카운트 신규 집계)는 실측과 정합.

---

## → 결론 / 권장

- **최대 분기(1★) 판정**: dictionary_categories = **주제축**(학년 아님). 학년은 **kcurr2022로 이미 해소·발행됨** → 시중 대응 범위는 이미 **빈출+학년+주제(신규)** 로 넓음.
- **v2 설계에서 바뀌는 것**:
  1. 오류5(3중 장부) 철회 — category_id 부재로 전제 소멸.
  2. 오류1 완화 — 학년 세트 S-A 유지(교육과정 3000). 대형만 소스 대기.
  3. **주제별 단어장을 S-A에 추가**(dictionary_categories 데이터 이미 존재 — 플랜에 없던 즉시 가능 축).
  4. 오류2 GENERATED는 **curation_query 정규화 migration 선결**(안 하면 sparse).
- **정찰 3(카운트)**: 세션 뷰 재사용 불가 → 세트단위 per-user 집계 신설(오류7대로).

**미결(확인필요)**: 오류7 카운트 캐시 저장 위치(집계 뷰 vs 카드 추정치) — R(t) 원칙과 무충돌(파생 캐시)이나 위치는 구현 판단.

---

## ✅ 후속 실현 — 주제별 단어장 PoC (2026-07-17, v06.254)
정찰 1-c(주제축 데이터 이미 존재) 즉시 실현: `topics-publish-set.mjs`로 L1 테마=세트·L2=챕터 발행. **6주제 2,484단어**(음식/여행/건강/비즈니스/과학/자연) category `themed`/subcategory `topic`. e2e 09 소주제 챕터 렌더 통과. **migration 불요**(주제는 기존 themed 카테고리). 잔여 12주제는 `topics-publish-set.mjs all`로 확장. → 시중 주제별 단어장 대응(빈출+학년+어원+주제 완비).

---
*P0 정찰 종료(read-only). 주제 PoC는 정찰 발견의 소스-독립 즉시 실현. migration(GENERATED 3축 전 curation_query 정규화 포함)은 별도 승인 게이트.*
