# ADR 0003 — 고전 리텔링 work-edition (v_level 기반 · 텍스트 학습 중심)

- Status: **Proposed — PoC Phase A 가 핵심 전제(노이즈)를 반증 → §D2/§D3 재설계 + "전권 리텔링 보류" 권고** (아래 "PoC Phase A 결과")
- Date: 2026-06-01
- 관련: 설계 방안 v2 (사용자 제안), [[0001-dictionary-derivational-enrichment]], [[0002-rescue-first-noise-policy]]
- 정합: 추출 3층 · v_level 밴드 · word_register · 파생 seed (신규 학습 엔진 0)

---

## Context

라이브러리 고전(PD)을 한국 학습자용으로 제공하되 **이미지/캐릭터 TTS 없이 텍스트·학습 메커니즘만으로** 흥미·학습을 만든다.

### 실측 전제 검증 (2026-06-01, 9권 bound lemma)

| 책 | v1-5 | v6-9 | v10 | v11 |
|---|---|---|---|---|
| Alice (동화·예외) | 66 | 29 | 3 | 2 |
| Frankenstein | 46 | 45 | 6 | 4 |
| Pride | 48 | 41 | 6 | 5 |
| Sherlock | 47 | 44 | 5 | 4 |
| Dorian | 49 | 42 | 5 | 4 |
| Treasure Island | 50 | 41 | 5 | 4 |
| Four Feathers | 45 | 46 | 6 | 3 |
| Twenty Years After | 39 | 48 | 7 | 6 |

→ Alice 외 8권이 **v6-9 40-48% · v11 3-6%로 거의 일정**. 고전 난이도의 원인은 v6-9(수능 핵심) 풍부가 **아니라** v11 노이즈(archaic·외국어·시대어) + 고문체 통사. **단순 다운그레이드는 v6-9 학습 타겟까지 깎아 학습 가치 0** → "분포 엔지니어링"(노이즈만 제거, v6-9 보존)이 정답. **전제 empirically 확정.**

---

## Decision

### D1. work-edition 스키마 (additive ALTER — PoC 후 적용)
```
library_books +:
  work_id        UUID       -- 작품 묶음 (Edition A/O 공유)
  edition_type   TEXT CHECK ('original'|'graded')   DEFAULT 'original'
  edition_of     UUID REFERENCES library_books(id)  -- graded → 원작
  target_v_band  int4range  -- 목표 v_level 밴드 (예: '[1,9]')
  is_retold      BOOLEAN    DEFAULT false
  retelling_meta JSONB      -- 명문장 매핑·챕터 정렬·보존/교체 어휘 로그·centroid 측정
챕터 정렬: library_book_vocabularies.chapter_idx 를 work 내 edition 간 정렬 키로 사용.
```

### D2. 차등 리텔링 규칙 (단순화 ≠ 목표)
- v11(archaic·외국어·고문체) → 현대어 교체/제거 **[노이즈 제거]**
- v10 → 더 쉬운 동의어 **[완화]**
- **v6-9(수능 핵심) → 보존** (i+1 학습 타겟 — 의도적 유지)
- v1-5 → 그대로 **[이해 기반]**
- 고문체 통사(도치·만연체) → 현대 어순·짧은 문장 **[통사 완화]**

### D3. 목표 분포 (Edition A) + 검증
```
v1-5 55-65% · v6-9 30-38% · v10 3-5% · v11 ~0%
```
단, **타겟 메트릭은 token(occurrence) 가중 밴드 분포** 로 한다 (D-risk-1 참조). `book_v_level`(distinct-lemma p75 centroid) 단독 타겟은 금지.

### D4. lexile 제거 (라이선스 리스크)
`lexile_measure`·`lexile_source` 는 **deprecate**(신규 사용 중단). 현재 5권 populated — 즉시 DROP 대신 Phase 2 에서 컬럼 제거(데이터 의존 확인 후). v_level centroid + CEFR/CEFR-J(외부 표준) 가 난이도 지표.

### D5. 흥미 — 텍스트·메커니즘 4축 (이미지/TTS 0)
1. 서사 내재(챕터 훅·대화 생동·길이 보존·장면 묘사) — 생성 단계
2. 능동 읽기(인라인 클릭·핵심어 추론 빈칸·예측 프롬프트)
3. 게임화(챕터=스테이지·어휘 정복률·스트릭·완독 배지)
4. 명문장(원문 보존 → 감상+ScriptQuiz 출제+Original 미끼)

### D6. 챕터 학습 루프 (pre-teach → read → recall → SRS)
챕터당 핵심 학습어 5-8 pre-teach → 리텔링 read → 챕터말 ScriptQuiz recall → FSRS 적재. 챕터당 학습어 30-50(Cognitive Load).

### D7. Layered Classic — 2층 시작
Work = Edition A(graded·학습 주력) + Edition O(original·도전 정독, v11은 word_register 배지). 비용 효율로 2층, 간극 큰 책만 Bridge.

### D8. 기존 인프라 재사용
추출 3층(direct/variant/inflection) · SRS(FSRS) · word_register · 파생 seed · `extract_vocabulary_for_user`(i+1) 그대로. 신규 학습 엔진 신설 X.

### D9. Claude Code = LLM 직접 생성
리텔링 생성·검증은 Claude Code 가 챕터 batch 로 직접(별도 API key 불필요). 멱등 + 챕터별 disk/DB 검증 후 진행.

---

## 품질 게이트 (생성 강제 + 검증, §5)
서사 보존 · 길이 80-110%(요약 금지) · 대화 보존 · 챕터 훅 · 고유명사 100%(grep) · v6-9 보존율 · 목표 분포 검증(미달 시 재생성) · 명문장 무손실.

---

## ★ Open Risks (PoC 에서 반드시 검증)

### R1 (최우선) — centroid 메트릭 불안정 (실측 발견)
`book_v_level`(distinct-lemma p75)은 **lemma coverage 에 민감**. Twenty Years After: token v6-9=48%(가장 어려움)인데 distinct p75=**5**(p50=2) — 이번 세션 공통어 대량 바인딩(coverage 84.88%)으로 centroid 가 V5 로 하락. Pride: token v6-9=41%인데 p75=**8**. **type(distinct) vs token(occurrence) 분포가 역전** → centroid 단독 타겟은 신뢰 불가.
→ **PoC 가 먼저 결정할 것**: 리텔링 타겟·검증 메트릭은 **token 가중 밴드 분포(§D3)** 로 하고, centroid 는 보조 지표로만. (체감/학습 난이도는 token 쪽에 가까움.)

### R2 — 학습어 보존 vs 이해도 트레이드오프
v6-9 과보존 시 안 쉬워짐. 목표 분포(D3)를 PoC 실측 튜닝.

### R3 — LLM 길이 보존 비용
요약 금지(80-110%) → 토큰↑. 챕터 batch 비용 산정 필요(고전 1권 수만~십수만 단어).

### R4 — 추론 빈칸 / 명문장 자동화 품질
빈칸: 문맥 단서 충분한 v6-9 만(좌절 방지). 명문장: 인용도·문체미 판정 — LLM + 사람 검수.

### R5 — lemma NULL 선행
리텔링·추출 전 `backfill_book_lemmas` 선행(앞 사건 재발 방지).

---

## Consequences
- retold work 당 edition 2배(스토리지·파이프라인). graded 만 retelling 비용 발생.
- 흥미를 메커니즘으로 — 검증 부담(§8 사후 측정: 완독률·이탈점·습득률·재독률·centroid 실측).
- 역할 우선순위: 현대 설명문(수능 주력) > 리텔링 Edition A(흥미 다독+수능 보조) > Original(도전 정독).

---

## Implementation Gate (중요)
**스키마 migration·리텔링 파이프라인·학습 루프 UI 는 1-챕터 PoC 통과 후에만 착수.**

PoC (Phase A~C, Sherlock 또는 Dorian 1챕터 — Alice 는 이미 v1-5 66% 라 대조군 부적합):
1. 원문 챕터 → 보존어(v6-9)/교체어(v10-11) 리스트 산출.
2. Claude Code 리텔링 생성(temp 0~0.3) + 품질 게이트 자체 검증.
3. token 밴드 분포 측정 → 목표(D3) 달성 + 서사/대화/명문장 품질 확인 + 토큰 비용 실측.
4. **PoC 결과로 D1 스키마·D3 분포·R1 메트릭 확정 후** 본 ADR Status → Accepted, migration 적용.

PoC 실패(목표 분포 미달·품질 저하·비용 과다) 시 ADR 재설계 또는 폐기.

---

## PoC Phase A 결과 (2026-06-01, Dorian Gray · LLM 생성 없이 DB만)

Phase A(저비용 prep) 가 **핵심 전제(§1 "v10-11 = 노이즈 제거")를 반증**:

1. **R1 확정 — token ≠ type**: token(frequency_in_chapter 가중) 분포는 type(distinct lemma)와 크게 다름. Dorian ch1 token v1-5=79%(읽기 쉬움)인데 전권 type v1-5=49%. → 리텔링 타겟·검증은 **token 밴드**로(§D3), centroid 단독 금지.
2. **★ v10-11 ≠ 노이즈**: Dorian V11 distinct 186개를 word_register 로 분해 = **modern_advanced 161(87%) · archaic_literary 14(8%) · period_cultural 10(5%)**. 즉 v11 의 87% 가 perplexity·exquisite 류 **정당한 C2 학습 어휘**(보존 대상). 진짜 교체할 노이즈(archaic+period) 는 **책당 ~24개(13%)** 뿐. V10 역시 standard 문학어(exquisite·tremulous·innumerable)로 보존 대상.
3. **band 기반 교체(§D2 원안)는 유해**: "v10-11 → 쉬운 동의어" 를 그대로 적용하면 perplexity·exquisite·tremulous 등 C2 어휘 161+개를 파괴 → 학습 가치 감소 + Wilde 문체 훼손.
4. **그 ~24개 노이즈는 이미 register-badge reader 가 글로싱**: 본문 클릭 → 뜻 + 📜/🏛 배지 + "읽기 참고용" 안내(이미 구현). 별도 전권 리텔링 없이 노이즈 문제 해소됨.

### 개정 결정
- **§D2 교체 규칙 → register 기반**: `archaic_literary`(📜) 만 현대어 교체 · `period_cultural`(🏛) 는 보존+gloss · `modern_advanced`/`standard`(v_level 무관) 전부 **보존**(i+1~i+2 학습어). v_level 밴드 기반 일괄 교체 폐기.
- **§D3 목표 메트릭 → token 밴드** 확정(centroid 보조).

### ★ "전권 리텔링" 보류 권고
- 노이즈 제거 = 이미 badge reader 가 처리(책당 ~24어). 전권 LLM 리텔링의 노이즈 명분 **소멸**.
- 리텔링의 **유일한 잔존 가치 = 고문체 통사 완화**(도치·만연체 — badge 가 못 함). 단 이건 전권 LLM 리텔링·dual edition·신규 스키마(D1)를 정당화하기엔 좁은 가치.
- **권고: D1 스키마 migration·§6 전권 리텔링 파이프라인·§3 챕터 루프 UI 착수 보류.** 이미 만든 register badge + i+1 추출이 핵심 가치(노이즈 글로싱 + 학습어 타게팅)를 전달. 통사 완화는 베타에서 "어휘 아닌 통사로 이탈" 데이터가 확인되면 그때 한정 도입.
- 흥미 4축(§D5) 중 능동읽기·게임화·명문장→ScriptQuiz 는 **리텔링과 무관하게** 기존 reader/추출 위에 얹을 수 있음 → 별도 검토.

## 다음 단계 (개정)
1. (본 문서) ADR 0003 — Phase A 반증 반영, **전권 리텔링 보류**.
2. 사용자 결정: (a) 보류 수용(badge+i+1 로 충분) / (b) 통사 완화만 경량 PoC / (c) 흥미 4축(게임화·명문장 ScriptQuiz)을 리텔링 없이 기존 reader 에 적용.
3. 리텔링 재고는 베타 이탈 데이터(어휘 vs 통사) 확인 후.
