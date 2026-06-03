# ADR 0002 — Rescue-First Noise Policy

- **Status**: Proposed (2026-05-29) — 승인 대기
- **Deciders**: 서준 (PM), Claude Code (구현)
- **Scope**: 미바인딩 단어 진단 분류기의 노이즈 판정 방향 + 접사 규칙 확장
- **Relates to**: [ADR 0001](./0001-dictionary-derivational-enrichment.md) §2.D1 (굴절·파생 분류) · §D4 (archaic 경계) · §5.Phase 2 (파생어 seed) · §6.Phase 5 (노이즈 fix)
- **Supersedes**: ADR 0001 §6 Phase 5 (좁은 "false positive 수정" 보다 강한 정책 변경 필요)

---

## 1. Context

ADR 0001 Phase 1-5 적용 후 도서 1권 2차 진단(516건) 데이터:

| 분류 | 1차 (Phase 1 전) | 2차 (Phase 1-5 후) | 해석 |
|---|---|---|---|
| 철자 변형 | 27 | **0** | ✅ Phase 1 정책 성공 |
| 실단어 미등재 | 783 | 149 | ✅ Phase 2 seed 부분 작동 |
| **노이즈** | **190** | **367** | ❌ **악화** |

핵심 발견 — 노이즈 367건 해부:

| 그룹 | 추정 비율 | 예시 |
|---|---|---|
| **(A) 진짜 노이즈** | ~38% (140건) | `louis`·`avant`·`twas`·`hadst`·`mayst`·`ugh`·`pshaw` (외국어·고어 조동사·감탄사) |
| **(B) 파생어 false positive** | ~49% (180건) | `admirably`·`humbly`·`gaily`·`deepen`·`widen`·`possessor`·`liberator`·`martyrdom`·`peasantry`·`abler`·`sixth`·`tenth` (-ly·-en·-or·-dom·-ry·비교급·서수) |
| **(C) 실단어 직접 오분류** | ~11% (40건) | `necessarily`·`defensive`·`vigilant`·`philosophical`·`accuracy`·`strategic`·`systematic`·`enclosure`·`metamorphosis` |

→ **(B)+(C) ≈ 220건의 학습 자산이 노이즈로 폐기 중**.

### Root cause

현재 `find_unbound_book_lemmas` 분류기 fallback 로직:

```sql
WHEN sd.word match → 'ok'
WHEN spelling_variants @> ... → 'ok'  
WHEN inflection base → 'ok'
WHEN archaic_dictionary → 'ok'
WHEN ac_class = noise/spelling/etc → 분류 반영
WHEN deriv_likely → 'genuine_miss'
WHEN suffix regex / prefix regex / -ed/-ing → 'genuine_miss'
ELSE 'noise'   ★ 폐기 우선 구조
```

**구조적 결함**: 모든 구제 시도 실패 → 자동 노이즈. seed 가 못 잡은 패턴 (-ly·-en·-or·비교급·서수·-dom·-ry) 이 전부 노이즈로 누출. seed 를 확장해도 또 다른 패턴이 누출. 본질적으로 "구제 못한 것은 폐기" 정책이 학습 자산 손실 원인.

올바른 방향: **노이즈는 적극 식별된 것에만 부여, 미스는 기본적으로 실단어 후보로 보존.**

---

## 2. Decisions

### D1 — Noise 정의를 positive 매칭으로 반전

```
[변경 전] 미스 + suffix/prefix 매칭 실패 = noise
[변경 후] 다음 4 그룹 중 하나에 적극 매칭되어야 noise
```

**Noise 확정 조건** (셋 중 하나):
1. **블랙리스트 매칭** — 신설 `noise_blacklist` 테이블의 form 또는 pattern
2. **`archaic_candidates.classification IN ('geo_noise','person_noise')`** — 기존 (변경 없음)
3. **구조적 noise 패턴** — 로마숫자 (`^[ivxlcdm]+$`), 길이 < 3, 아포스트로피 포함 (계약형/방언)

**미스 기본 분류**: 위 셋 다 매칭 안 되면 → `genuine_miss` (실단어 후보). 노이즈 아님.

### D2 — Blacklist 카테고리 정의

신설 `noise_blacklist` 테이블 (form PK, category, note):

| 카테고리 | 예시 | 처리 방향 |
|---|---|---|
| `foreign_word` | 프랑스어 stopword (`la`·`de`·`du`·`en`·`avant`·`demi`·`mordieu`), 라틴어 (`ante`·`siete`) | 학습 단어장 제외 |
| `archaic_grammar` | 고어 조동사·2인칭 (`hadst`·`mayst`·`shouldst`·`sayest`·`wert`·`doest`·`thinkest`·`sayest`·`liest`·`twould`·`twas`) | 학습 단어장 제외 |
| `interjection_noise` | `bah`·`pshaw`·`ugh`·`hey`·`ha`·`ho`·`hurrah`·`halloo` | 학습 단어장 제외 |
| `proper_noun` | (`archaic_candidates.classification='person_noise'` 가 이미 처리 — 블랙리스트 보조) | — |

**Note**: archaic_grammar 와 archaic_dictionary 의 경계는 명확히 — archaic_dictionary 는 **학습 가치 있는 archaic 단어** (`whilst`·`yonder`·`besought` — 19세기 문학에서 만나면 의미 알면 좋음), noise_blacklist 의 archaic_grammar 는 **학습 불필요한 조동사·2인칭 굴절형** (`hadst`·`mayst` — 학습자가 이걸 따로 외울 필요 없음).

### D3 — Suffix 규칙 확장 (Phase 2/3/5 함수 공통 갱신)

기존 `en_derivational_bases` 에 추가:

| suffix | 패턴 | 예시 | POS 매핑 | base 위치 |
|---|---|---|---|---|
| **-ly** | 이미 있음 | `admirably→admirable` | adverb | -2 strip |
| **-en** (동사화) | `widen→wide`·`deepen→deep`·`thicken→thick` | adjective→verb | adverb | -2 strip + 'e' if needed |
| **-or** / **-er** (행위자) | `possessor→possess`·`liberator→liberate`·`debtor→debt`·`counselor→counsel` | verb→noun | noun | -2/-3 strip |
| **-dom** | `martyrdom→martyr`·`kingdom→king` | noun→noun | noun | -3 strip |
| **-ry** | `peasantry→peasant`·`debauchery→debauch`·`butchery→butcher` | noun→noun | noun | -2 strip |

### D4 — 굴절(-er/-en) 모호성 처리

`-er` 과 `-en` 은 굴절(비교급/과거분사) 과 파생(행위자/동사화) 양쪽에 해당.

**판정 규칙** (D1 ADR §D1 정합):

```
-er:
  base 가 형용사  → 비교급 굴절 (예: abler = able+er) → 굴절 회수, 별 row 없음
  base 가 동사    → 행위자 파생 (예: possessor = possess+or) → 독립 row
  base 가 명사    → 도구·종사자 파생 (예: gardener = garden+er) → 독립 row

-en:
  base 가 형용사  → 동사화 파생 (예: widen = wide+en, deepen = deep+en) → 독립 row
  base 가 동사    → 과거분사 굴절 (예: written = write+en, broken = break+en) → 굴절 회수
                   (대부분 영어 동사 -en 과거분사는 불규칙이라 english_irregular_forms 가 흡수)
  base 가 명사    → 명사 형용사화 파생 (예: golden = gold+en, wooden = wood+en) → 독립 row
```

**판정 신호**: shared_dictionary 의 base.pos 확인. 모호한 경우 (base 가 multi-POS, 예: `dark` 형용사+명사) **파생 default** (보수적 — 별 row 생성).

**서수 (-th)** 는 굴절 (별 row 없음, base 회수): `sixth=six+th`, `seventh=seven+th`, ..., `nineteenth=nineteen+th`. en_inflection_bases 에 -th 규칙 추가.

---

## 3. Phase 2.5 신설 — 노이즈 판정 정책 반전 (긴급)

ADR 0001 Phase 5 ("노이즈 분류기 fix") 의 좁은 수정이 아닌, 정책 전반 변경. **ADR 0001 의 Phase 5 폐기 + Phase 2.5 로 신설** (Phase 2 와 동급 긴급도).

### 3.1 작업

```
[1] noise_blacklist 테이블 신설 + 시드 적재 (~200건)
    foreign_word (프랑스어 ~50, 라틴어 ~20)
    archaic_grammar (고어 조동사·2인칭 ~50)
    interjection_noise (감탄사 ~30)
    
[2] find_unbound_book_lemmas 분류 로직 반전
    [변경 전] ELSE 'noise'
    [변경 후] ELSE 'genuine_miss'  -- 미스 기본 = 실단어 후보
    
    + WHEN noise_blacklist 매칭 THEN 'noise'  (적극 매칭만 노이즈)
    + WHEN ac_class IN (geo_noise, person_noise) THEN 'noise'  (기존 유지)
    + WHEN 구조적 noise (roman/length<3/apostrophe) THEN 'noise'  (기존 유지)

[3] en_derivational_bases 확장 (D3 신규 suffix 추가)
    -en (-en → strip 2, optionally +e)
    -or, -er (행위자) — strip 2/3 (별 처리 — D4 판정)
    -dom (martyrdom → martyr)
    -ry (peasantry → peasant, debauchery → debauch)

[4] en_inflection_bases 확장 (D4 -th 서수 + -en 과거분사 추가)
    -th (sixth → six, ninth → nine, eleventh → eleven, ...)
    -en (과거분사 — broken → break, hidden → hide 등은 english_irregular_forms 가 흡수)
```

### 3.2 검증

- 도서 1권 재진단 → 노이즈 367 → **~140 감소** (블랙리스트 ~140 + 구조적 노이즈 ~10) 예상
- genuine_miss 증가 → ~220건 즉시 구제 (이전 노이즈에서 이동)
- 진단 신뢰도 향상: noise 그릇은 admin 이 무시 가능, genuine_miss 그릇은 admin 이 검수 → 학습 자산 보존

### 3.3 Abort 조건

- noise_blacklist 시드가 너무 광범위 → 정당한 학습 단어가 차단됨 (목록 좁히기 필요)
- 정책 반전 후 admin 진단 표가 압도적으로 genuine_miss 로 채워져 검수 불가 → 임계 빈도(f≥2) 필터 추가

---

## 4. Schema Changes

```sql
-- noise_blacklist: 적극적으로 노이즈로 확정할 형태
CREATE TABLE noise_blacklist (
  form TEXT PRIMARY KEY,                          -- 단어 형태 (소문자)
  category TEXT NOT NULL CHECK (category IN (
    'foreign_word',                               -- 외국어 (학습 불요)
    'archaic_grammar',                            -- 고어 조동사·2인칭 굴절
    'interjection_noise',                         -- 감탄사 noise
    'proper_noun_marker'                          -- archaic_candidates 보조 (예: 특수)
  )),
  note TEXT,                                      -- 출처·이유 메모
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_nbl_category ON noise_blacklist(category);

GRANT SELECT ON noise_blacklist TO authenticated;
```

---

## 5. Open Questions

| Q | 검토 필요 |
|---|---|
| `accuracy`·`enclosure`·`strategic` 같은 **(C) 직접 실단어** 가 왜 derivational lookup 에서 안 잡혔나? base 가 사전에 있으면 잡혀야 함. | 실제 케이스별 디버그 (특정 word 의 `en_derivational_bases()` 결과 + dict lookup 확인) — 발견된 갭은 D3 suffix 규칙 추가 또는 shared_dictionary base 보강 |
| 블랙리스트 정밀도 — `wert` 가 고어인 동시에 실명사 'wort'(약초) 와 혼동? | 모든 블랙리스트 후보를 dictionary 표제어와 교차 검증 후 적재 |
| `-er` 비교급 vs 행위자 판정에서 base POS 가 모호한 경우 default 가 파생 (별 row) — 비교급이 별 row 로 잘못 등재될 위험 | 검증 필요. 만약 잘못 등재 다수 발견 시 default 를 굴절로 변경 |

---

## 6. 적용 순서 체크리스트

- [ ] 본 ADR 0002 승인
- [ ] Phase 2.5: `noise_blacklist` 테이블 + 시드 적재
- [ ] Phase 2.5: `find_unbound_book_lemmas` 정책 반전
- [ ] Phase 2.5: `en_derivational_bases` 확장 (-en/-or/-er/-dom/-ry)
- [ ] Phase 2.5: `en_inflection_bases` 확장 (-th 서수)
- [ ] 검증: 도서 1권 재진단 → noise 367 → ~140 감소 확인
- [ ] 검증: genuine_miss 의 (C) 실단어 (necessarily/accuracy/strategic) 가 derivational 회수되는지 확인

---

## 7. ADR 0001 정합 조정

ADR 0001 §6 Phase 5 항목 **"폐기"** (본 ADR 2.5 가 대체). ADR 0001 §2.D1 의 D4(-er/-en) 모호성 처리는 본 ADR §D4 가 구체화 — 모순 없음.

---

*ADR 0002 — 2026-05-29 초안. 정책 반전 합의 후 봉인.*
