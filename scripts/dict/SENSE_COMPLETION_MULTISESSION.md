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
