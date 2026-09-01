# shared_dictionary — kaikki → WordNet **선별적 교체** 설계 (v3)

- **Status**: Proposed (2026-07-20, v3 재설계)
- **목적**: **사전 DB 보완** — kaikki(Wiktionary) 유래 컬럼의 **노이즈 제거 + 라이선스(CC BY-SA) 청정화**를 동시에. WordNet(퍼미시브/CC BY)로 교체하되, **필드마다 교체 강도를 달리**한다.
- **관련**: `scripts/dict/kaikki-enrich.mjs`(대체 대상) · `scripts/dict/wordnet-enrich.mjs`(본 구현) · [[project_dict_wave_plan_w0]]

---

> ## ⚠️ 2026-09-01 실측 — `overwritePurge` 의 전제가 더 이상 참이 아니다
>
> 이 설계의 §2 `overwritePurge` 는 **"잔여 = kaikki 전용"** 을 전제한다. 설계 시점에는
> 맞았지만 지금은 아니다. `derived_forms` 잔여 533행(카탈로그 337)의 `source` 를 세어 보니:
>
> | source | 행 | 예 |
> |---|--:|---|
> | `imported` | 325 | `admiral → admiralty` · `age → aged/ageism/ageist` |
> | `ai-generated` | 191 | `accurate → accurately/inaccurately` |
> | `derivational-seed` | 17 | `bystreet → bystreets` |
>
> **전부 멀쩡한 파생어이고 상당수가 이 저장소가 직접 만든 것이다.** WordNet 교체가 돈 뒤에
> 다른 드레인이 `cleared` 자리를 다시 채웠는데 `field_provenance` 를 안 고쳐서, 출처가
> "없음/cleared" 로 **보일 뿐**이다.
>
> 지금 `apply-der --commit` 을 돌리면 좋은 데이터 533행을 **라이선스 위험도 아닌 이유로**
> 지운다(내용 우위지수 V3 57.4% → 54.5%). 돌리려면 `source` 로 거르는 조건을 먼저 넣을 것.
>
> **라이선스 정리 자체는 사실상 끝나 있다** — `derived_forms` 14,263 · `related_terms`
> 28,574 가 `wordnet-3.1` 출처다. 남은 것은 위 533 + related 7 뿐이고 kaikki 가 아니다.

## 1. 왜 병합이 아니라 (선별적) 교체인가

kaikki 값은 **노이즈**(`bisexy`·`BUG`·`lesbigaytrans`·`"I'm bisexual"`)와 **라이선스(CC BY-SA share-alike)** 문제를 동시에 가진다. 따라서 "둘 다 살리는 병합"은 노이즈·라이선스를 그대로 안고 간다 → **교체가 옳다.**

단, **필드마다 상황이 다르다**(실측):

| 필드 | 현재 채움 | WordNet 커버 | 교체 시 손실(WordNet 없음) | 손실의 성격 | 정책 |
|---|---|---|---|---|---|
| `related_terms` | 11,529 | **28,582** | 2,152 | kaikki 전용 | **전면교체+purge** |
| `derived_forms` | 19,899 | 14,313 | 9,745 | kaikki 전용(노이즈) | **전면교체+purge** |
| `synonyms` | 32,778 | 26,176 | 11,255 | 혼합(시드/dict-fill 포함) | **교체+잔여 flag** |
| `example_en` | 41,902 | 17,314 | 24,813 | **대부분 시드 Anki 예문** | **빈칸만 채움(시드 보존)** |
| `antonyms` | 22,322 | 3,816 | 11,529 | kaikki 주(WordNet 희소) | **병합+노이즈필터** |

핵심 원리: **"교체로 없어지는 값이 kaikki 노이즈면 버리고, 멀쩡한 비-kaikki(시드)면 지킨다."**

---

## 2. 필드별 정책 (5종)

| 정책 | 동작 | 적용 필드 | 근거 |
|---|---|---|---|
| **overwritePurge** | WordNet 값으로 덮어씀. WordNet에 없으면 **NULL로 제거** | `related_terms` `derived_forms` | kaikki 전용 컬럼 → 잔여도 kaikki. 제거해도 손실=kaikki 노이즈뿐. 라이선스·노이즈 완전 청정 |
| **overwrite(flag)** | WordNet 값으로 덮어씀. WordNet에 없는 잔여는 **유지하되 `field_provenance='kaikki-unverified'` 표기** | `synonyms` | 혼합 출처 → 비-kaikki(시드/dict-fill)를 함부로 못 지움. 나중에 선택 정리 |
| **fillEmpty** | **빈칸일 때만** WordNet 예문 삽입. 기존값 절대 안 건드림 | `example_en` | 손실 24,813이 대부분 **시드 예문**(kaikki도 노이즈도 아님) → 보존 |
| **mergeDenoise** | 기존 ∪ WordNet, **실단어 필터**(WordNet lemma 사전에 있는 토큰만) 후 dedupe·cap | `antonyms` | WordNet 반의어 희소(3,816) → 교체하면 급감. 대신 kaikki 반의어의 **가짜/노이즈 토큰만 제거** + WordNet로 보강 |
| **(skip)** | WordNet 불가 | `ipa` `homophones` `rhyme_key` | 발음계열 → **Phase 2 CMUdict(PD)** |

> 결과: kaikki 노이즈·라이선스 노출이 가장 심한 **관계 컬럼은 완전 청정**, 시드 등 멀쩡한 데이터는 **무손실**, 반의어는 **품질만 개선**.

---

## 3. 소스 · 라이선스

| 소스 | 라이선스 | 상업/독점 | 형식 |
|---|---|---|---|
| **Princeton WordNet 3.1** (본 구현) | WordNet License (퍼미시브·OSI 승인) | ✅ share-alike 없음 | WNDB flat files |
| Open English WordNet 2024 (대안) | CC BY 4.0 | ✅ | WN-LMF XML |

- 배치: `scripts/dict/data/wordnet/`(**.gitignore** 확인됨). WNDB ~30MB.
- **attribution** 유지: "Includes WordNet 3.1 (Princeton University)".
- kaikki(CC BY-SA)는 교체 완료 후 `kaikki-*.mjs`를 **deprecated** 표기(재유입 차단).

---

## 4. 필드 매핑 (WordNet → 컬럼)

| 컬럼 | WordNet 원천 | 규칙 |
|---|---|---|
| `synonyms` | synset 공동 구성원 | 같은 synset 다른 lemma, cap 10 |
| `antonyms` | lemma antonym `!` | + 기존 병합·실단어 필터, cap 8 |
| `derived_forms` | derivation `+` | cap 12 |
| `related_terms` | hypernym `@` + hyponym `~` + also-see `^` | cap 10 |
| `example_en` | synset gloss `"..."` 예문 | lemma 포함 우선, 1개 (빈칸만) |

---

## 5. 파이프라인 (`scripts/dict/wordnet-enrich.mjs`)

```
extract : WNDB(data.noun/verb/adj/adv) 스트림 → lemma→{syn,ant,der,rel,ex} 맵 JSON
apply-<field|all> [--commit] [--provenance] :
          POLICY 표에 따라 필드별 교체/병합/채움. 멱등. 기본 dry-run.
```

- `--provenance`: `field_provenance` 컬럼에 출처 스탬프(마이그레이션 선행 필요, **승인 대기**).
- 안전: 기본 dry-run(측정만). `--commit` 시 5컬럼 **백업 선행 필수**.

### provenance 마이그레이션 (승인 필요)

```sql
ALTER TABLE shared_dictionary ADD COLUMN IF NOT EXISTS field_provenance JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_shared_dictionary_field_provenance ON shared_dictionary USING gin (field_provenance);
```
값 예: `{"related_terms":"wordnet-3.1","synonyms":"kaikki-unverified","antonyms":"wordnet+existing"}`.
근본 원인(필드별 출처 부재) 수정 + 향후 선택 정리 가능.

---

## 6. 실행 순서

| # | 단계 | 명령 | 되돌리기 |
|---|---|---|---|
| 1 | (승인 시) provenance 컬럼 | migration | DROP COLUMN |
| 2 | WordNet 확보 | WNDB → data/wordnet/ | 파일 삭제 |
| 3 | extract | `node wordnet-enrich.mjs extract` | JSON 삭제 |
| 4 | dry-run 측정 | `apply-all` | — |
| 5 | **백업** | 5컬럼 스냅샷 JSON | 복원용 |
| 6 | 적용 | `apply-all --commit [--provenance]` | 5의 백업 복원 |
| 7 | CMUdict(Phase 2) | ipa/homophones/rhyme | 백업 복원 |

**롤백**: 5단계 백업(word→5컬럼)으로 전 과정 원복.

---

## 7. 예상 효과 (실측 기반)

| 필드 | 교체 후 | 변화 |
|---|---|---|
| related_terms | 28,582 (전부 WordNet·청정) | +17k·노이즈 0·라이선스 청정 |
| derived_forms | 14,313 (WordNet) + 잔여 purge | 노이즈 제거·청정 |
| synonyms | 26,176 WordNet + 잔여 flag | 노이즈↓·주요부 청정 |
| example_en | 시드 41,902 유지 + 빈칸 225 보강 | 무손실·소폭 보강 |
| antonyms | ~22k(병합·denoise) | 품질↑·볼륨 유지 |

완료 시: **관계/파생 컬럼 CC BY-SA·노이즈 완전 제거**, 시드 데이터 무손실, 반의어 품질 개선.

## 8. 체크리스트

- [ ] (승인) provenance 마이그레이션
- [ ] extract + dry-run 측정
- [ ] 5컬럼 백업
- [ ] apply-all --commit (정책별)
- [ ] CMUdict Phase 2 (ipa/homophones/rhyme)
- [ ] attribution 문구
- [ ] `kaikki-*.mjs` deprecated 표기
