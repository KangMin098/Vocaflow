# 다의어 sense 완성 — 멀티세션 병렬 런북 (V-Level별)

> **목적**: `shared_dictionary`의 모든 단어가 실제 표준 영어에서 쓰이는 **모든 품사(POS) sense**를 갖도록 채운다(일반 사전급). 이렇게 해야 도서 단어추출 시 `ransomed`→동사 "몸값을 치르고 풀어주다"처럼 **형태에 맞는 뜻**이 나온다. 빈도수 무관, **V-Level별 전수**.
>
> **이 런북 하나로 문맥 없는 새 세션이 그대로 실행 가능**. 자신에게 배정된 V-Level만 처리한다.

---

## 0. 사전 조건 (확인만)

- 작업 디렉터리: `c:\Users\kille\Vocaflow` (Vocaflow repo)
- env: `apps/web/.env.local` 에 `NEXT_PUBLIC_SUPABASE_URL` · `SUPABASE_SERVICE_ROLE_KEY` (스크립트가 자동 로드)
- 스크립트 존재: `scripts/dict/sense-chunk.mjs`, `scripts/dict/sense-apply.mjs` (이미 커밋됨)
- Supabase project: `jajenrevcbmrpaliomxv` (MCP 검증용)

## 1. 세션 배정 (충돌 방지 — 자기 것만)

| 세션 | 담당 V-Level | 고유 out-dir | 대략 단일-sense 수 |
|---|---|---|---|
| S1 | 1, 2, 3, 4 | `scripts/dict/sc-v1_4` | ~2,067 |
| S2 | 5, 6 | `scripts/dict/sc-v5_6` | ~2,096 |
| S3 | 7 | `scripts/dict/sc-v7` | ~1,813 |
| S4 | 8 | `scripts/dict/sc-v8` | ~2,147 |
| S5 | 9 | `scripts/dict/sc-v9` | ~4,774 |
| S6 | 10 | `scripts/dict/sc-v10` | ~4,295 |
| S7 | 11 | `scripts/dict/sc-v11` | ~10,052 (여러 wave) |

- **반드시 자기 out-dir·자기 V-Level만** 만진다. 다른 세션의 dir/기본 `scripts/dict/sense-chunks/` 는 건드리지 않는다.
- DB는 공유하지만 V-Level이 다르면 단어가 겹치지 않고, 겹쳐도 apply의 **단일-sense 가드**가 이미 완성된 단어를 스킵하므로 안전.

## 2. 실행 루프 (배정된 각 V-Level에 대해 반복)

`V`=담당 레벨, `DIR`=자기 out-dir 로 아래를 **한 레벨씩** 수행. 한 wave당 에이전트 ≤14로 제한하고, 남을 때까지 루프.

### (a) 청크 생성 (남은 단일-sense만 재생성 — 매 루프)
```
node scripts/dict/sense-chunk.mjs --v-level V --out DIR --chunk 160
```
- 출력 예: `targets: 1265 single-sense content words (rank ...)` · `chunks: 8`
- **`targets: 0` 이면 그 레벨 완료** → 다음 레벨로.

### (b) 이전 wave 산출물 정리
```
rm -f DIR/*.out.json
```

### (c) 서브에이전트 병렬 dispatch — 이번 wave는 **처음 최대 14개 청크**(chunk-00 ~ chunk-13)만
- 청크 수가 14 초과면 이번 wave는 앞 14개만. 나머지는 (a) 재생성 때 다시 잡힘(적용된 건 제외되어 자연 수렴).
- **각 청크마다 general-purpose 에이전트 1개**를, 아래 **정확한 프롬프트**로. `DIR`·`NN`(00,01,...)을 실제 경로로 치환. 한 메시지에 여러 Agent 호출을 넣어 동시 실행.

**에이전트 프롬프트 (그대로 사용, 경로만 치환):**
```
Complete a Korean–English learner dictionary. Read c:\Users\kille\Vocaflow\DIR\chunk-NN.json — an array of single-sense words {word,pos,meaning_ko,v_level,cefr_level,rank}.

For EACH word: if standard modern English gives it additional part-of-speech sense(s) beyond `pos`, OR the stored single meaning misses the word's PRIMARY common sense, output the COMPLETE meanings_ko: a JSON array of {"pos":"...","meaning":"...","v_level":N}, ordered MOST COMMON sense FIRST, including the existing sense (kept or lightly refined) plus the new sense(s).

STRICT: Be conservative and accurate. Only add senses that genuinely exist in standard English. SKIP legitimately single-POS words (most -tion/-ment/-ness/-ity nouns, most -ous/-ive adjectives, technical/proper terms) — no output for them. SKIP if unsure. High-value = noun↔verb conversions, noun↔adjective, and rare-primary fixes (stored primary was a rare sense). Korean glosses concise (comma/semicolon separated, NO sentences), style like the input. pos ∈ noun|verb|adjective|adverb. v_level integer 1-11 (reuse the word's, ±1 max).

Write ONLY the changed words as a JSON array [{"word":"...","meanings_ko":[...]}] to c:\Users\kille\Vocaflow\DIR\chunk-NN.out.json — valid JSON only, no markdown, no unchanged words. Then reply one line: "chunk-NN: <changed>/<total>". Accuracy over quantity.
```

### (d) 이번 wave 완료 대기 (dispatch한 청크 수 = K)
```
until [ $(ls DIR/*.out.json 2>/dev/null | wc -l) -ge K ]; do sleep 10; done; echo DONE
```
(백그라운드 Bash `run_in_background`로 실행 → 완료 알림 수신. 개별 에이전트 알림마다 깨지 말 것.)

### (e) 적용 (검증 + meanings_ko + flat pos/meaning_ko 동기화 + shared_words)
```
node scripts/dict/sense-apply.mjs --dir DIR --commit
```
- 출력: `files: K · valid words: N · rejected: R` → `done. applied ~N ...`
- **단일-sense 가드·멱등**: 이미 다중 sense면 스킵(사람/타세션 수정 보호). 안전하게 재실행 가능.

### (f) 루프
(a)로 돌아가 재생성. `targets`가 줄어들다 `0`이면 그 레벨 완료.

## 3. 품질 원칙 (에이전트가 지킴, 검수 시 확인)
- 표준 영어에 **실재하는** POS만. 애매/희귀/구어전용/구동사전용은 skip. 정확도 > 수량.
- most-common-first 정렬. 기존 sense 보존(경미한 다듬기 허용). Korean gloss는 짧은 구(문장 X).
- rare-primary 교정 흔함(예: `wolf` 동사만→명사 늑대 우선, `crisp` 명사만→형용사 바삭한). 오데이터도 교정(예: `clammy`가 "그리스도론"으로 저장된 경우 등).
- pos ∈ {noun,verb,adjective,adverb}, v_level 1-11 정수(±1). apply가 위반 항목 자동 reject.

## 4. 세션 종료 시
- 담당 레벨 전부 `targets: 0` 확인.
- `scripts/dict/sc-*` 는 gitignore(작업 파일). 커밋 불필요(DB 데이터가 결과).
- 완료 후 한 줄 보고: "V{X} 완료: 누적 적용 ~N 단어".

## 5. 검증 쿼리 (선택, MCP `execute_sql`)
```sql
-- 담당 V-Level 다중-sense 진행률
SELECT count(*) total, count(*) FILTER (WHERE jsonb_array_length(meanings_ko)>=2) multi
FROM shared_dictionary
WHERE v_level = V AND pos IN ('noun','verb','adjective') AND classified_by IS NOT NULL
  AND word ~ '^[a-z]+$' AND word !~ 'ing$';
```

---
**요약**: 자기 V-Level·자기 DIR → `sense-chunk(--v-level)` → `rm *.out.json` → ≤14 에이전트 dispatch(위 프롬프트) → 완료 대기 → `sense-apply(--dir --commit)` → `targets:0`까지 반복. 보수적·정확 authoring이 생명.

---

## 📌 후속 백로그 — per-sense v_level 정밀도 채우기 (Phase B · 비차단)

> **위치**: 추출 신뢰 로드맵 **3단계의 정밀도 잔여**. 신뢰 기반(경로통합·알아요몰라요·근거카드 = 1/2/4단계)은 이미 완성. **뜻·POS는 100%**라 이건 "틀림"이 아니라 "난이도 숫자 근사"를 정밀화하는 refinement — 여유 시 착수.

**문제**: 다의어(≥2 sense) 중 일부 sense에 자체 `v_level`이 없어 추출 시 flat(대표) v_level로 폴백. 그 sense가 대표와 난이도가 다르면 threshold 필터·V 배지가 근사값이 됨.

**측정(2026-07-16)**: 추출 대상 40,355 중 multi-sense 10,144 · 그중 **≥1 sense v_level 결측 7,420** · multi-POS(형태별 sense 실제 분기) **5,170**. → **우선순위 = 실사용 ∩ multi-POS**.

**대상 쿼리**:
```sql
SELECT word, v_level AS flat_v, meanings_ko FROM shared_dictionary
WHERE classified_by IS NOT NULL AND v_level IS NOT NULL
  AND COALESCE(word_register,'standard') NOT IN ('archaic_literary','period_cultural','phrase_unit','brand','abbreviation','proper_noun')
  AND jsonb_typeof(meanings_ko)='array' AND jsonb_array_length(meanings_ko)>=2
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(meanings_ko) s WHERE (s->>'v_level') IS NULL)
  AND (SELECT count(DISTINCT s->>'pos') FROM jsonb_array_elements(meanings_ko) s) >= 2  -- multi-POS 우선
ORDER BY frequency_rank NULLS LAST;
```

**신규 툴**(작성 완료 2026-07-17 · 기존 sense-chunk/apply는 단일-sense POS 추가용이라 재사용 불가):
- `sense-vlevel-chunk.mjs` — 위 대상을 청크로. 각 항목에 `word`+`flat_v`+`senses[{i,pos,meaning,v_level}]` 제시. 기본=**multi-POS 우선**(n_pos≥2), `--all-pos`로 단일-POS 다의어까지 확장. `--max-rank`·`--limit` 슬라이스.
- 에이전트 프롬프트: **각 sense에 그 sense의 실제 난이도 v_level(1-11) 부여**. 대표 sense는 flat_v ±0~1, 드문/전문/비유 sense는 더 높게. 뜻/pos는 **불변**. 반환 = `{word, v_levels:[정수, 인덱스 정렬]}`.
- `sense-vlevel-apply.mjs` — 반환 `v_levels[i]`를 현 `meanings_ko[i].v_level` **결측분에만** 주입(pos/meaning/기존 v_level 보존, flat 컬럼 무변경). 안전 가드: 배열 길이 불일치 스킵, 변화 없으면 스킵, 1-11 검증, idempotent. `--overwrite`로 기존값도 갱신.

**멀티세션 배정**: §1과 동일하게 V-Level·out-dir 분리. flat_v 기준으로 세션 배정하면 충돌 없음.

**완료 판정**: `multipos_missing`(위 카운트) → 0 또는 잔여=근사 허용 sense만.

### ✅ 진행 (2026-07-17)
- **우선순위 슬라이스 = 완료**: multi-POS(형태별 sense 분기) ∩ per-sense v_level 결측 **2,526단어 전량 적용**(16 서브에이전트 병렬). `multipos_missing_remaining: 0`. 전 sense 완비 단어 2,724 → **5,250**. 품질: sense별 분화 53.6%(예 `firm` n5/a4/v7 · `prime` a5/n6/v8), 잔여=전 sense 난이도 동일이 정확한 legit 케이스.
- **잔여 4,894 = 2차 tier(단일-POS 다의어)**: 같은 POS 내 sense 차이라 flat 폴백이 더 근접(cross-POS 난이도 점프 없음). `--all-pos`로 동일 파이프라인 실행 가능. 비차단·여유 시.
