# 단어추출 커버리지 ~100% · 라이선스 청정 Lexicon 아키텍처 설계

- **Status**: Proposed (2026-07-22)
- **목표**: 단어추출/읽기에서 **커버리지 ~100%** 를 유지하면서 **kaikki(Wiktionary, CC BY-SA)를 전량 제거**한 청정 소스 구성.
- **전제**: 한국어 뜻 생성(LLM)은 **오프라인 사전작업**. **런타임은 100% DB 조회**(LLM 없음).
- **선행/관련**: [wordnet-replacement-design.md](./wordnet-replacement-design.md) (shared_dictionary 청정 — 완료) · `scripts/dict/wordnet-enrich.mjs` · `scripts/dict/cmudict-enrich.mjs`

---

## 1. 배경 · 문제

`coverage_lexicon`(독해 폴백 사전, 409k)은 **gloss_en 전량 kaikki(CC BY-SA)**, meaning_ko는 그 gloss의 번역(파생물). 상업 배포 시 share-alike 리스크. 그러나:

- **커버리지 ~100% 는 Wiktionary tail 없이는 불가** — 퍼미시브 사전(WordNet+Webster)은 우선순위 단어의 **37%** 만 커버(실측). 광물명·분류군·폐어는 퍼미시브 등가물 부재.
- 따라서 **정적 사전만으로 100% 는 불가능** → **정적 청정 사전 + LLM 오프라인 생성**의 2-phase 로 해결.

핵심 재정의: **"모든 단어가 즉시 뜻"** 을 정적 소스로 달성하려면, tail 뜻은 **LLM 이 사전에 생성해 DB 에 적재**해야 한다. 런타임은 그 DB 를 조회만 한다.

---

## 2. 핵심 원칙

1. **kaikki 전량 제거** — gloss_en·meaning_ko·ipa·예문 모두 청정 소스로 대체/재생성.
2. **LLM = 오프라인 사전작업** — 런타임 hot path 에 LLM 0 → 추출 성능 = 현재와 동일(~ms).
3. **계층 소스** — 목록(유효성) / 코어 / 퍼미시브 정의 / LLM 뜻 을 역할별 분리, 조회는 **단일 통합 테이블**로 병합.
4. **정적 확정 용량** — LLM 캐시 성장 없음. 대상 word set 이 곧 용량.

---

## 3. 아키텍처 (2-phase)

```
━━━ [사전작업 · 오프라인] ━━━━━━━━━━━━━━━━━━━━━━━━━━━
 (a) L2 청정 gloss 구축   WordNet(155k)+Webster1913(102k) → word→영어정의(정제)
 (b) LLM 한국어 생성      대상 word set 에 meaning_ko 채움
                          입력우선: WordNet/Webster gloss 번역(청정)
                                    없으면 word 원본 생성(kaikki 미입력)
 (c) materialize          통합 lexicon 테이블에 적재
━━━ [런타임 · DB only] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 추출/읽기 → 통합 lexicon 단일 인덱스 JOIN → 즉시 뜻 (LLM 0)
```

## 4. 소스 구성 (계층별)

| 계층 | 소스 | 라이선스 | 역할 | 규모 |
|---|---|---|---|---|
| **L0 단어목록** | Moby Words II · dwyl/english-words · SCOWL | PD/퍼미시브 | **유효성 판정 + 노이즈 필터**(고유명사·OCR·외래어) | 610k·466k (합집합 ~750k) |
| **L1 학습코어** | `shared_dictionary` | 청정(완료) | 학습 대상 단어 뜻 | 45,682 |
| **L2 정의** | WordNet + Webster 1913 | 퍼미시브/PD | **영어 정의** + 한국어 생성 원천 | 155k·102k (∪ ~200k) |
| **뜻(ko)** | LLM 사전생성 | 원본/PD번역 | meaning_ko | 대상 set |
| **발음** | CMUdict | PD | IPA (없으면 드롭) | 125k |
| ~~kaikki~~ | **제거** | ~~CC BY-SA~~ | — | — |

### L0 vs L2 역할 구분 (혼동 주의)

- **L0(목록)** = "이게 단어인가?" — 단어 많음·뜻 없음 → **문지기/필터**
- **L2(사전)** = "뜻이 뭔가?" — 단어 적음·뜻 있음 → **의미 제공**
- 대체재 아님, **상보 관계**. 목록으로 걸러 통과 → 사전으로 뜻 → 사전에도 없는 진짜 단어만 LLM.

### WordNet vs Webster (L2 내부)

| | WordNet | Webster 1913 |
|---|---|---|
| 성격 | 현대·깔끔·구조화 | 고어·희귀어 다수 |
| 역할 | **흔한/현대어 1순위** | **희귀/고어 폴백 2순위** |
| 주의 | 첫 synset 편향(지배 sense 선택 로직 필요) | 1913 고어·노이즈(인용·상호참조·번호) 정제 필요 |

---

## 5. 통합 lexicon 테이블 (제안 스키마)

기존 `coverage_lexicon`(kaikki)을 대체하는 청정 테이블. 조회 성능 위해 **단일 테이블에 병합**(다중 JOIN 회피).

```sql
create table lexicon_clean (
  word          text primary key,           -- 소문자 표제어
  pos           text,
  gloss_en      text,                        -- WordNet/Webster 정제 정의 (없을 수 있음)
  meaning_ko    text,                        -- LLM 사전생성 (핵심)
  ipa           text,                        -- CMUdict
  gloss_source  text,                        -- wordnet | webster | llm-original
  ko_source     text,                        -- translated-wordnet | translated-webster | llm-original
  frequency_rank integer,                    -- 빈도(우선순위)
  is_valid_word boolean default true,        -- L0 유효성(노이즈 아님)
  updated_at    timestamptz default now()
);
create index on lexicon_clean (word text_pattern_ops); -- 접두/정확
-- 조회: extraction lemma → lexicon_clean.word 단일 인덱스 JOIN
```

- L0(유효성)은 이 테이블의 `is_valid_word` + 별도 lean **노이즈 blocklist** 로 표현(거대 목록 테이블 회피 가능).
- L1(shared_dictionary)은 유지 — 조회 체인: **L1 우선 → lexicon_clean 폴백**.

---

## 6. 용량 분석 (실측 기반)

| 항목 | 현재 | 변경 후 |
|---|---|---|
| `shared_dictionary` | **218MB** (bloat — 대량 update 잔여) | **VACUUM FULL → ~120-150MB** (선결) |
| `coverage_lexicon`(kaikki) | 78MB | **제거 -78MB** |
| `lexicon_clean` 신규 | — | +50~78MB (대상 set 비례) |
| L0 노이즈 blocklist | — | +~5MB (lean) |
| **순증** | — | **≈ 0 or 감소** (VACUUM 감안 시 총 DB 감소) |

- LLM 캐시 성장 없음 → 용량 확정적.
- Webster raw(22MB)·WordNet(WNDB)·Moby 는 **build-time 만** 사용(gitignore), DB 미적재.

---

## 7. 성능 분석

| 항목 | 결과 |
|---|---|
| 추출 조회 | `lexicon_clean` **단일 인덱스 JOIN**(배치) → 현재와 동일(~ms) |
| 런타임 LLM | **0** — 성능 변수 제거(원안의 유일 리스크였음) |
| 인덱스 | word(text) b-tree, ~µs/word · 200k 행 인덱스 스캔 |
| 다중 계층 | L1+L2+뜻 **한 테이블 병합**으로 순차 다중조회 회피 |
| 온-미스 | 사전 materialize 라 런타임 미스 최소 → 미스 시 영어 gloss 폴백(또는 공백), **비동기 생성 불요** |

→ **성능 회귀 없음.** 추출은 지금처럼 배치 SQL 로 즉시.

---

## 8. 설계 결정 (선택 필요)

**① materialize 대상 word set**
| 안 | 대상 | 실효 커버 | LLM 사전작업 |
|---|---|---|---|
| **A (권장)** | 빈도상위(실제 등장) ~78-150k | ~99% | 적음(기존 78k 재활용 가능) |
| B | 전체 408k+ | 리터럴 100% | 큼(tail 330k 추가) |

**② 한국어 생성 입력 (라이선스)**
- WordNet/Webster gloss 있음(37%) → **그걸 번역**(청정) ✅
- 없음(tail) → **word 원본 생성**. **kaikki gloss 미입력**(입력 시 파생물=CC BY-SA). 극희귀어 **환각 주의**(문맥/검증).

---

## 9. 구축 순서

| # | 작업 | 성능/용량 고려 |
|---|---|---|
| 0 | **`shared_dictionary` VACUUM FULL** | bloat 회수(선결) |
| 1 | L2 gloss 구축: **WordNet 정의 추출**(WNDB `\|` 이후) + **Webster 정제**(고어/노이즈/단일sense/지배sense) → `word→gloss` 맵 | build-time raw만 |
| 2 | `lexicon_clean` 테이블 생성 + L2 gloss·ipa(CMUdict) 적재 | 단일 인덱스 |
| 3 | 대상 set 확정(A/B) → **LLM 한국어 사전작업** → meaning_ko 적재 | 캐시성장 없음 |
| 4 | L0 노이즈 blocklist 구성(고유명사·OCR·외래어) + `is_valid_word` | lean |
| 5 | 추출/읽기 RPC = **L1 우선 → lexicon_clean 폴백** 단일 JOIN + **벤치마크(글당 지연)** | 회귀 검증 |
| 6 | 기존 `coverage_lexicon`(kaikki) 폐기 + VACUUM | -78MB |

## 10. 마이그레이션 · 롤백

- `coverage_lexicon` 은 폐기 전 **스냅샷 백업**(또는 rename 보관) → 문제 시 복원.
- `lexicon_clean` 은 신규 테이블이라 기존 조회에 영향 없음. RPC 전환(5단계)에서 스위치.
- 단계별 독립 커밋 → 중간 롤백 가능.

## 11. 리스크 · 트레이드오프

- **LLM 사전작업 비용/품질**: tail 원본 생성은 환각 위험 → 대상 A(빈도상위) 로 한정하면 위험·비용 최소. 로컬 NLLB 초벌 → Claude 정교화로 비용↓.
- **Webster 정제 부담**: 1913 고어·노이즈 정리 + 지배 sense 선택 로직 필요.
- **커버리지 정의**: 대상 A 는 "실사용 ~99%"(등장하는 단어). 리터럴 100% 는 B(비용 큼).
- **shared_dictionary bloat**: VACUUM 선결 필수(현재 218MB).

---

## 12. 요약

- **런타임 = 100% DB**(LLM 오프라인) → **추출 성능 현재 유지**, 용량 확정적.
- **kaikki 전량 제거** → CC BY-SA·출처표기 의무 소멸.
- **L0(목록)로 유효성 ~100% + L2(사전)+LLM 으로 의미** → 2단 커버리지.
- **단일 `lexicon_clean` 병합**이 성능·단순성 핵심.
- 선결: **VACUUM**. 결정: **대상 set(A 권장)** · **생성 입력(kaikki 미입력)**.
