# sense 깊이 확대 — 멀티 세션 지시문 (2026-07-17)

> **목적**: `shared_dictionary`의 얕은(≤2 sense) 다의어에 kaikki(Wiktionary) 영어 gloss를 **근거**로 한국어 sense를 추가.
> 추출 정확도의 근본 갭 해소 — 대표뜻이 통째로 빠진 엔트리(`crow`에 "까마귀"가 없고 동사만 있던 식)를 복원.
> **완료분**: freq ≤6,000 = 1,088단어 (slice1 315 + slice2 773). **본 문서 = freq >6,000 잔여 8,320 대상 · 6세션 분할(청크 생성 완료).**

---

## 1. 왜 멀티 세션인가 / 어떻게 격리되는가

| 축 | 설계 |
|---|---|
| **분할 기준** | **rank 대역**(청크가 rank 정렬 → 인덱스 분할 = 대역 분할). 세션 간 **단어 중복 0** |
| **DB 충돌** | 없음 — 각 세션이 서로 다른 단어행만 UPDATE. apply는 멱등 + 가드(신규 sense > 현 sense 일 때만) |
| **git 충돌** | 없음 — **워커 세션은 커밋 금지**. 데이터 dir gitignore, 툴은 이미 커밋됨 → 커밋할 코드 변경 0 |
| **워크트리** | **미사용**. 코드 변경이 없고 3.19GB kaikki 원본이 `scripts/dict/data/`에 있어 워크트리는 복제/경로깨짐만 유발 |
| **청크 생성** | **이미 완료** — 세션은 3.19GB 재스트림 **하지 말 것**(디스크 경합). 자기 dir의 청크만 사용 |

---

## 2. 세션 배정표

각 세션은 **자기 dir만** 건드린다. 다른 dir은 읽지도 쓰지도 않는다.

**생성 완료 — 70청크 · 8,320단어 · 세션당 12청크**(1회 스트림 후 rank 정렬 분할).

| 세션 | dir | 청크 | 단어 | 실 rank 대역 | 가치 |
|---|---|---|---|---|---|
| **S1** | `scripts/dict/ksense-s1` | 12 | 1,440 | 6,005–8,463 | 높음 |
| **S2** | `scripts/dict/ksense-s2` | 12 | 1,440 | 8,463–10,500 | 높음 |
| **S3** | `scripts/dict/ksense-s3` | 12 | 1,440 | 10,500–13,500 | 중 |
| **S4** | `scripts/dict/ksense-s4` | 12 | 1,440 | 13,500–16,676 | 중 |
| **S5** | `scripts/dict/ksense-s5` | 12 | 1,440 | 16,676–21,500 | 중·하 |
| **S6** | `scripts/dict/ksense-s6` | 10 | 1,120 | 21,500–31,100 | 하(롱테일) |

> **실측 기대치**: yield ≈ **36%**(slice2 실적 24%→45%→38%) → 전 세션 합계 **≈3,000단어** 예상. rank 하락 시 yield 하락 경향.
> **소요**: 청크 1개(120단어) ≈ 8–13분 · 웨이브(6청크 동시) ≈ 15분 · **세션당 12청크 = 2웨이브 ≈ 30분**.
> **주의**: 대상 8,320은 §1의 DB 추정(10,959)보다 적다 — 형태-포인터(`plural of` 등) 제외 후 실 sense ≥3 을 만족한 실제 수. 8,320이 정확한 모수다.

---

## 3. 세션별 지시문 (그대로 붙여넣기)

> 아래 블록에서 **`{{S}}` 를 자기 세션 번호(1~6)로 치환**해 새 Claude Code 세션에 붙여넣는다.

```
Vocaflow sense 깊이 확대 작업 — 세션 S{{S}} 담당.

지시문 전문: docs/AI_CONTEXT/handoffs/ksense_multisession_20260717.md 를 먼저 읽어라.

내 담당 = scripts/dict/ksense-s{{S}}/ 디렉터리 하나뿐이다. 다른 ksense-* dir 은 절대 건드리지 마라(다른 세션 소유).

내 dir 은 12청크(chunk-00 ~ chunk-11, 각 120단어)다. 6청크씩 2웨이브로 처리한다.

작업 루프:
1. ls scripts/dict/ksense-s{{S}}/ 로 확인 (*.out.json 이 이미 있는 청크 = 완료분 → 건너뜀).
2. 웨이브1 = chunk-00~05 를 general-purpose 서브에이전트 6개에 **한 메시지에서 동시** 디스패치(run_in_background: true).
   프롬프트는 지시문 §4 를 그대로 복사해 청크 번호만 치환(내용 변경 금지 — 품질 게이트가 그 안에 있다).
3. 웨이브 완료를 background bash until-loop 로 대기(개별 알림 폭주 방지):
   for i in $(seq 1 120); do n=$(ls scripts/dict/ksense-s{{S}}/chunk-0[0-5].out.json 2>/dev/null | wc -l); if [ "$n" -ge 6 ]; then echo ALL6; break; fi; sleep 15; done
   ※ Bash 도구 run_in_background: true 로 실행할 것.
4. 완료 시: node scripts/dict/kaikki-sense-apply.mjs --dir scripts/dict/ksense-s{{S}} --commit
   (가드가 적용완료분을 자동 skip → dir 전체 재실행해도 안전. "skipped N" 은 정상이다)
5. 웨이브2 = chunk-06~11 로 2~4 반복 (대기 패턴: chunk-0[6-9] + chunk-1[01]).
6. 12청크 소진 시 종료 보고.

절대 금지:
- git commit / push (충돌원 = CHANGELOG. 워커 세션은 DB 쓰기만 한다)
- 문서(.md) 수정 — CLAUDE.md 자동갱신 정책의 예외. 문서는 종합 세션이 한 번만 갱신
- kaikki-sense-chunk.mjs 재실행(3.19GB 재스트림 = 디스크 경합. 청크는 이미 생성됨)
- 다른 ksense-* dir 의 파일 읽기/쓰기/apply
- 마이그레이션 — 이 작업은 스키마 변경 0

완료 시 보고: 세션번호 · 처리 청크수 · 입력 단어수 · enriched 단어수 · yield% · 실패수 · 대표 교정 예 5개.
```

---

## 4. 서브에이전트 authoring 프롬프트 (변경 없이 사용)

`chunk-NN` 부분만 실제 청크 번호로 치환. `{{S}}` 는 세션 번호.

```
한국어 학습자용 영어 사전 sense 깊이 확대 작업. 파일 하나를 처리한다.

입력: `C:\Users\kille\Vocaflow\scripts\dict\ksense-s{{S}}\chunk-NN.json` — 배열 `[{word, rank, current:[{pos,meaning}], kaikki:[{pos,gloss}]}]`.
- `current` = 우리 사전의 현 한국어 뜻(얕음, ≤2 sense).
- `kaikki` = Wiktionary 영어 gloss(근거). 표준 현대 뜻만 담겨 있음.

각 단어에 대해, current 한국어 sense를 **보존**하면서 kaikki gloss가 보여주는 **결측된 흔한/대표 sense를 한국어로 추가**해 완전한 `meanings_ko`를 만든다.

규칙(엄수):
1. **근거 기반만** — kaikki gloss로 확인되는 뜻만. gloss가 애매하거나 네가 그 한국어 번역을 확신 못 하면 그 sense는 넣지 마라. 환각 절대 금지.
2. **투명한 뜻만** — 흔하고 명료한 뜻 위주. 폐어·희귀·비속어·방언·전문 극단은 제외(kaikki가 이미 대부분 걸러냄).
3. 각 sense = `{pos, meaning, v_level}`.
   - `pos` ∈ noun|verb|adjective|adverb|interjection|preposition|conjunction|pronoun|determiner (영어 소문자).
   - `meaning` = 자연스러운 한국어 뜻(간결, 예: "부분적인", "좌표", "질병을 전염시키다").
   - `v_level` = 그 sense의 한국 학습자 체감 난이도 1–11 정수(1=매우 쉬움 ~ 11=매우 어려움). 흔한 뜻일수록 낮게.
4. **대표(가장 흔한) sense를 meanings_ko[0]에** 둔다.
5. sense 순서 = 흔한 것 → 드문 것. 중복 뜻 병합.
6. **출력 조건**: 최종 `meanings_ko.length ≥ 2` **이고** current보다 sense가 실제로 늘어난 단어만 출력. 개선 여지가 없으면(이미 충분하거나 kaikki가 새 뜻을 안 줌) **그 단어는 아예 생략**. 무리하게 채우지 마라 — 품질이 개수보다 우선.

출력: `C:\Users\kille\Vocaflow\scripts\dict\ksense-s{{S}}\chunk-NN.out.json` 에 배열 `[{word, meanings_ko:[{pos,meaning,v_level}]}]` (JSON만, 개선한 단어만). Write 도구로 저장.

작업 후 마지막 메시지에 `chunk-NN: <출력 단어수>/<입력 단어수>` 한 줄만.
```

---

## 5. 품질 원칙 (모든 세션 공통 · 타협 금지)

1. **무환각** — kaikki gloss로 확인 안 되는 뜻은 넣지 않는다. 스킵률 ~64%가 정상이며 **품질의 증거**다(억지로 채우면 사전이 오염된다).
2. **손실 금지** — apply 가드가 `신규 sense 수 > 현 sense 수` 일 때만 UPDATE. 기존 뜻은 서브에이전트가 보존한다.
3. **발음 연상·소리 말장난 절대 금지** — 이 작업엔 니모닉이 없지만, 플랫폼 전역 원칙이다. 어원 근거만 허용.
4. **자가생성 금지** — 외부 검증 소스(kaikki) 근거만. 이 원칙 때문에 kaikki 확보 전까지 이 작업이 보류됐었다.

---

## 6. 파이프라인 레퍼런스

| 파일 | 역할 |
|---|---|
| `scripts/dict/kaikki-sense-chunk.mjs` | 청크 생성(**세션은 실행 금지** — 이미 생성됨). `--min-rank/--max-rank/--max-cur/--min-k/--chunk` |
| `scripts/dict/kaikki-sense-apply.mjs` | `.out.json` → DB. 검증(POS 화이트리스트·v_level 1–11) + 가드 + `shared_words` 동기화. 멱등 |
| `scripts/dict/data/kaikki-en-words.jsonl` | 3.19GB 원본(CC BY-SA 3.0, gitignore) |
| `scripts/dict/data/kaikki-enrich.json` | 45k 표제어 추출 맵(senses 카운트 등) |

**DB 검증 쿼리**(종합 세션용):
```sql
select count(*) filter (where jsonb_array_length(meanings_ko) = 1) as single,
       count(*) filter (where jsonb_array_length(meanings_ko) >= 3) as three_plus,
       round(avg(jsonb_array_length(meanings_ko))::numeric, 3) as avg_senses
from shared_dictionary
where classified_by is not null and meanings_ko is not null and jsonb_typeof(meanings_ko)='array';
```
**기준선(2026-07-17 slice2 종료 시점)**: single 34,636 · 3+ sense **1,850** · avg **1.290**.

---

## 7. 종합 세션 (전 세션 종료 후 1회)

1. 위 DB 쿼리로 최종 수치 확인.
2. `docs/CHANGELOG.md` Unreleased 갱신(누계 enriched·3+ sense·avg).
3. 메모리 `project_dict_wave_plan_w0.md` 갱신.
4. 커밋 1건 + `feat/plan-ui` push (main 직접 push 금지).
5. `scripts/dict/ksense-s*/` 는 gitignore — 커밋 대상 아님.

---

## 8. 알려진 함정

- **에이전트 stall** — 큰 청크(160+)를 다수 동시 디스패치 시 "no progress for 600s" 발생 이력. **청크 120 · 웨이브 6개**가 검증된 안전 조합. stall 시 그 청크만 재디스패치(멱등).
- **개별 완료 알림 폭주** — until-loop 대기로 묶을 것.
- **apply 재실행** — 전체 dir 재실행해도 가드가 완료분을 skip(실적: skipped 498 정확). 두려워 말 것.
- **unranked 3,979** — `frequency_rank IS NULL` 대상은 현 청크 툴이 제외(rank 필수). 최저 노출 tail이라 **범위 밖**. 필요 시 툴에 `--include-unranked` 추가가 선결.

---

*근거: shared_dictionary 실측(2026-07-17) + slice1/slice2 실적(1,088단어·0 실패). 라이선스: kaikki = CC BY-SA 3.0.*
