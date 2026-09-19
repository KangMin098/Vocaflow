# 외국어 독해 지원 — 선제형(pre-built) 사전 설계

- **Status**: Proposed (2026-07-23, rev2 — 반응형→선제형 전환)
- **목표**: 프랑스어·라틴어·그리스어 등 외국어 사전을 **미리 DB에 구축**해 두고, 이후 **어떤 입력(도서·스크립트)** 이 들어와도 단어추출 시 이미 준비된 외국어를 **식별 + 한글뜻 + 언어라벨**로 해소. (Google 사전 방식)
- **원칙**: 런타임 100% DB 조회. 감지·번역은 오프라인 사전작업. 비용 0. 청정(배포 가능).
- **관련**: [lexicon-coverage-clean-architecture.md](./lexicon-coverage-clean-architecture.md) (본체 영어 사전) — 그 위에 `lang` 축 추가.

---

## 1. 패러다임 — 반응형 ❌ → 선제형 ✅

| | 반응형 (구안, 폐기) | **선제형 (본안)** |
|---|---|---|
| 소스 | 현재 도서의 외국어 잔여 | **외국어 빈도 사전(코퍼스 무관)** |
| 커버 | 현재 코퍼스에 등장한 것만 | **미래 입력 포함 전면** |
| 비유 | 도서마다 뒤처리 | **Google 다국어 사전을 미리 적재** |
| 신규 도서 | 매번 재처리 필요 | **재처리 0** — 이미 사전에 있음 |
| franc 런타임 | 필요(문맥 감지) | **불요** — 단어 존재 자체가 해소 |

→ 영어 본체 사전(`lexicon_clean`)을 WordNet/Webster로 **미리** 구축했듯, 외국어도 **외국어 빈도 사전으로 미리** 구축한다. 도서는 소비자일 뿐 소스가 아니다.

---

## 2. 핵심 원칙

1. **소스 = 외국어 빈도 사전** — 도서 잔여 아님. 언어별 상위 빈도 N개를 통째로 적재 → 미래 입력 대비.
2. **뜻 = Google 오프라인 번역** — `sl=<lang>` 힌트로 언어별 정확 번역(무료·배치). 청정(기계번역, 저작권 무관).
3. **저장 = `lexicon_clean` + `lang` 태그** — 별도 테이블 없이 단일 병합(이미 `lang` 컬럼 추가됨).
4. **런타임 = 감지 없음** — 토큰을 조회: 영어 사전 우선 → 외국어 사전 폴백. 단어가 프랑스어 사전에 있으면 그게 곧 해소. **동형이의어는 영어 우선**(영어 독해 맥락 기본값).
5. **정밀 = 빈도 상위로 한정** — 극희귀·노이즈 배제. 상위 N이 실사용 대부분 커버.

---

## 3. 아키텍처

```
━━━ [사전작업 · 오프라인] ━━━━━━━━━━━━━━━━━━━━━━
 (a) 언어별 빈도 사전 획득   fr/la/el/de/it/es … 상위 N lemma
 (b) Google 번역             sl=<lang>&tl=ko 배치(무료) → meaning_ko
 (c) lexicon_clean 적재      word + lang + meaning_ko + ko_source
━━━ [런타임 · DB only] ━━━━━━━━━━━━━━━━━━━━━━━━
 추출/읽기 토큰 → 영어(shared_dictionary→lexicon_clean en) 우선
              → 외국어(lexicon_clean lang≠en) 폴백 → 식별+뜻+lang
 (franc·MT 0 — 존재 자체가 해소)
```

---

## 4. 소스 획득 (언어별)

| 언어 | 소스 | 라이선스 | 규모(권장 상위) | 비고 |
|---|---|---|---|---|
| 프랑스어 fr | hermitdave FrequencyWords (OpenSubtitles) | 빈도목록=사실 | 30k~50k | 최우선(레미제라블 등) |
| 독일어 de | 동상 | 동상 | 20k | |
| 이탈리아어 it | 동상 | 동상 | 20k | |
| 스페인어 es | 동상 | 동상 | 20k | |
| 네덜란드어 nl | 동상 | 동상 | 10k | |
| **라틴어 la** | Latin lemma 빈도(Perseus/DCC core) 또는 위키낱말 라틴 lemma | PD/퍼미시브 | 10k~15k | 고전어 — OpenSubtitles 부재, 별도 소스 |
| **고대 그리스어 el/grc** | Perseus Greek lemma | PD | 8k~10k | 동상 |

**핵심**: 우리가 적재하는 건 `word + lang + 우리 기계번역 meaning_ko`. 외부 사전의 **정의문(gloss)은 가져오지 않는다** → 빈도 목록(사실 데이터) + 자체 MT 뜻 → 배포 청정.

---

## 5. 런타임 해소 — 감지 없는 다국어 조회

`lookup_word_meaning` 체인에 외국어 tier 추가. 순서:

```
토큰 lemma
 → 1-5 shared_dictionary (영어 학습코어)
 → 6-7 lexicon_clean 영어 (lang='en')
 → (신규) 8 lexicon_clean 외국어 (lang≠'en') — 여기서 faute→'잘못' + lang='fr'
 → not_found
```

- **감지 불요**: 토큰이 `faute`면 조회 결과에 lang='fr'가 붙어 나옴. 별도 franc 실행 없음.
- **동형이의어**: `pain`(영 아픔 / 불 빵) → 영어가 먼저 매치되어 영어 뜻 반환. 영어 독해 기본 맥락상 타당. (희귀, 필요 시 도서 lang prior 후처리 — v1 범위 밖.)
- **UI**: 외국어 해소분은 뜻 옆 언어 배지(🇫🇷 fr) → 학습자가 "이건 프랑스어"임을 인지.

---

## 6. 스키마 (확정)

`lexicon_clean`에 `lang text not null default 'en'` + partial index(`lang<>'en'`) — **이미 적용**.

```sql
-- 적재 레코드 예
{ word:'faute', lang:'fr', meaning_ko:'잘못', gloss_source:'mt', ko_source:'google-mt-fr', is_valid_word:true }
```

- 영어 256k는 `lang='en'` 무변경.
- 외국어는 `lang<>'en'` partial index로 격리 조회 가능.

---

## 7. 구축 순서

| # | 작업 | 산출 |
|---|---|---|
| 1 | 언어 우선순위 확정 (fr→la→el→de/it/es …) | 대상 언어셋 |
| 2 | 언어별 빈도 사전 다운로드 (build-time, gitignore) | word 목록 |
| 3 | `foreign-dict-build.mjs` — 목록 로드 + Google 배치번역(sl=lang) + 진행/재개 | JSONL 캐시 |
| 4 | `lexicon_clean` 적재 (word+lang+meaning_ko) — 멱등 upsert | DB 외국어 행 |
| 5 | `lookup_word_meaning` 외국어 tier 확인/추가 + lang 반환 | RPC |
| 6 | 추출/읽기 UI 언어 배지 | 프런트 |
| 7 | 검증 — 신규 도서 없이 외국어 해소율 측정 | 리포트 |

**증분**: 언어 추가·상위 N 확대는 3-4단계 재실행만(멱등). 도서와 무관.

---

## 8. 규모·비용

| 항목 | 값 |
|---|---|
| 총 외국어 행(권장) | ~120k (fr50k+de/it/es 각20k+la15k+el10k…) |
| Google 번역 비용 | **0** (무료 endpoint, 배치) |
| 소요(추정) | 120k / 배치15 / ~0.1s = ~수십분(재개 가능) |
| DB 증가 | ~15~25MB (word+ko, gloss 없음) |
| 런타임 | 단일 인덱스 조회 — 회귀 0 |

---

## 9. 결정 (확정 · 데이터 기반)

**① 대상 = French 50k + Italian 50k** (Italian 2026-07-24 추가)

### Italian 추가 (2026-07-24)
- 200권 Standard Ebooks 평가에서 이탈리아어 잔여 289 lemma/617 등장 확인 → **French 파이프라인 그대로 복제**.
- hermitdave it_50k(표면형) + Google sl=it → `lexicon_clean` lang='it' **36,015 적재**(영어 충돌 자동 skip). 코드/마이그레이션 변경 0(기존 foreign tier·lang 배지 재사용).
- 검증: contadina→농부·fanciulla→소녀·malinconia→우울·cantare→노래하다. pain 영어 유지(동형이의어 안전).
- **핵심**: Google가 이탈리아어는 물론 **라틴어 굴절 표면형도 정확 번역**(aeternitatis→영원의) → 번역 장벽 없음. 남은 건 표면형 wordlist 소스뿐. 모던 언어(it/de/es/pt/nl)는 hermitdave로 즉시 확장 가능.

### Latin 보류 (표면 소스 미확보)
- 번역은 됨(Google 굴절 처리). 그러나 hermitdave에 라틴 없음·위키빈도 404 → **표면형 wordlist 소스 부재**. Whitaker(PD)는 stem이라 굴절 표면(virtutis) 미스(23%).
- 소규모(258 등장) 대비 L2(코퍼스 표면빈도 가공) 비용 큼 → **보류**. 필요 시 Latin Library/Leipzig 코퍼스 처리.

---

**(이전 결정)** French 단독 확정 배경:

착수 시 fr+la+el(최소안)을 후보로 검토했으나, **실측으로 라틴/그리스 폐기**:

| 언어 | 실측 | 결론 |
|---|---|---|
| **French** | 도서 잔여 감지 fr 235(vs 타 언어 합 <20). hermitdave가 **표면형** 빈도라 굴절형 그대로 매칭. | ✅ **50k 구축** |
| **라틴** | Roman+Dialogues 잔여 ~290 중 실제 라틴 후보 94(32%), 나머지는 OCR잡음·영어오타·그리스/아랍 음역. 그 94조차 Whitaker(stem) 매칭 **23%**(굴절형 aeternitatis·veterum·libros 미매칭). **실효 해소 ≈ 7.5%.** | ❌ **스킵** |
| **그리스** | 추출 필터 `^[a-z]` → **그리스문자 토큰 애초에 추출 안 됨**(잔여 el≈0). 현대 그리스 목록은 스크립트 불일치. | ❌ **스킵** |

- 라틴 정식 지원은 **CLTK lemmatizer(굴절→표제어)** 를 추출 파이프라인에 통합해야 유효 → **별도 프로젝트로 분리**(현 범위 밖).
- French 표면형은 이 문제가 없음(자막 빈도 = 표면형).

**② 동형이의어 정책**
- v1: 영어 우선(단순·안전, `ignore-duplicates`로 영어 표제어 절대 미변경 — 검증 완료: son/pain/chat/de 영어 유지). v2(선택): 도서 lang prior로 프랑스어 도서 내 `pain`→프랑스어 우선.

---

## 10. 요약

- **선제형** — 외국어 빈도 사전을 **미리** 적재. 도서는 소비자, 소스 아님.
- **런타임 감지 0** — 단어가 사전에 있으면 곧 해소(영어 우선 → 외국어 폴백). Google식.
- **청정** — 빈도 목록(사실) + 자체 기계번역 뜻. 외부 gloss 미사용.
- **단일 `lexicon_clean` + lang** — 스키마 이미 준비. 증분 멱등.
- 결정: **대상 언어·규모(①)** · **라틴/그리스 소스(②)**.
