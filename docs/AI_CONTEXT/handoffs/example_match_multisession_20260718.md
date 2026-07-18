# per-sense 예문 매칭 — 멀티 세션 지시문 (2026-07-18)

> **목적**: 다의어(meanings_ko ≥2 sense)의 **각 한국어 sense에 kaikki 실용 예문을 매칭**. 어떤 예문이 어떤 뜻을 보여주는지 = 판단 필요 → LLM authoring(멀티 세션 적합).
> **무환각**: 예문은 제공된 kaikki 풀에서 **그대로(verbatim)** 선택. 편집·창작·번역 절대 금지. apply 게이트가 풀 밖 예문을 거부.
> **규모**: 대상 5,288 다의어(예문 ≥2 보유) → 45청크 → 6세션.

---

## 1. 왜 멀티 세션인가 (이번엔 진짜 authoring)

앞선 kaikki 추출(#5)은 기계적이라 단일 스트림이 빨랐다. 하지만 **예문↔뜻 매칭은 판단**이다 — "He deposited money in the bank"가 `은행` sense인지 `둑` sense인지는 영어 문장을 읽고 결정해야 한다. 이건 병렬 서브에이전트가 동시에 "생각"하면 빨라진다.

---

## 2. 격리 (세션 간 충돌 0)

| 축 | 설계 |
|---|---|
| 분할 | rank 대역(청크 rank 정렬). 세션 간 단어 중복 0 |
| DB 충돌 | 없음 — 서로 다른 단어행 meanings_ko UPDATE. apply 멱등(example 있으면 skip) |
| git | **워커 세션 커밋 금지**. 데이터 gitignore, 툴 이미 커밋 |
| 워크트리 | 미사용 |
| 청크 | **이미 생성 완료** — 재생성 금지 |

---

## 3. 세션 배정표

**생성 완료 — 45청크·5,288단어.**

| 세션 | dir | 청크 | 단어 | rank |
|---|---|---|---|---|
| X1 | `exmatch-s1` | 8 | 960 | 2–1,688 |
| X2 | `exmatch-s2` | 8 | 960 | 1,688–4,177 |
| X3 | `exmatch-s3` | 8 | 960 | 4,185–6,867 |
| X4 | `exmatch-s4` | 8 | 960 | 6,869–10,654 |
| X5 | `exmatch-s5` | 8 | 960 | 10,663–27,249 |
| X6 | `exmatch-s6` | 5 | 488 | 27,249+ |

> 8청크 세션 = 2웨이브(00-03·04-07). X6 = 1웨이브(00-04). 웨이브당 4~5 동시.
> yield: 다의어 sense 중 매칭 가능한 것만(억지 금지) → sense 기준 60~80% 예상.

---

## 4. 서브에이전트 authoring 프롬프트 (변경 없이 사용 · `chunk-NN`·`sN`만 치환)

```
per-sense 예문 매칭 작업. 파일 하나를 처리한다.

입력: `C:\Users\kille\Vocaflow\scripts\dict\exmatch-sN\chunk-NN.json`
  = [{word, senses:[{pos,meaning}], examples:[영어 실용문 풀]}].
  senses = 우리 사전의 한국어 뜻(다의어). examples = 그 단어의 kaikki 실용 예문 풀.

각 단어에 대해, 각 한국어 sense에 **그 뜻을 가장 잘 보여주는 영어 예문**을 examples 풀에서 골라 매칭한다.

규칙(엄수):
1. 예문은 examples 풀에 있는 문장을 **그대로(verbatim) 복사**. 편집·번역·창작·축약 절대 금지.
2. 한 sense = 가장 잘 맞는 예문 1개. 같은 뜻 예문이 여럿이면 가장 명확·자연스러운 것.
3. 매칭 안 되는 sense는 **생략**(억지 배정 금지). 안 쓰이는 예문이 남아도 됨.
4. 예문이 어떤 뜻인지 애매하면 그 sense 생략. 확신 있는 매칭만.
5. 한 예문을 여러 sense에 중복 배정하지 마라(가장 맞는 하나에만).

출력: `C:\Users\kille\Vocaflow\scripts\dict\exmatch-sN\chunk-NN.out.json`
  = [{word, senses:[{meaning, example}]}] (매칭된 sense만).
  meaning = 입력 meaning 그대로 echo(수정 금지). example = 풀에서 그대로 복사. Write 도구로 저장.

작업 후 마지막 메시지에 `chunk-NN: <매칭 sense 수>/<입력 단어수>` 한 줄만.
```

---

## 5. 세션별 지시문 — 복사해서 붙여넣기

> X1~X6 블록 중 하나를 통째로 복사 → 새 Claude Code 세션 첫 메시지로. 치환 불필요.

### ▸ X1 (rank 2–1,688 · 8청크)
```
Vocaflow per-sense 예문 매칭 — 세션 X1 담당.

먼저 docs/AI_CONTEXT/handoffs/example_match_multisession_20260718.md 를 읽어라. 지시문 전문이다. 특히 §4(authoring 프롬프트).

내 담당 = scripts/dict/exmatch-s1/ 하나뿐. 다른 exmatch-* dir 은 다른 세션 소유이니 건드리지 마라.
내 dir = 8청크(chunk-00 ~ chunk-07). 2웨이브(00-03, 04-07)로 처리한다.

작업 루프:
1. ls scripts/dict/exmatch-s1/ 확인 (*.out.json 있으면 완료분 → 건너뜀).
2. 웨이브1 = chunk-00~03 를 general-purpose 서브에이전트 4개에 한 메시지에서 동시 디스패치(run_in_background: true). 프롬프트 = 지시문 §4 그대로 + 청크 번호만 치환.
3. 완료 대기 = Bash(run_in_background: true) until-loop:
   for i in $(seq 1 120); do n=$(ls scripts/dict/exmatch-s1/chunk-0[0-3].out.json 2>/dev/null | wc -l); if [ "$n" -ge 4 ]; then echo W1; break; fi; sleep 15; done
4. 웨이브2 = chunk-04~07 동일. 대기: chunk-0[4-7].out.json -ge 4.
5. apply(grounding 게이트 내장): node scripts/dict/example-match-apply.mjs --dir scripts/dict/exmatch-s1 --commit
   (rejected 에 ungrounded-ex 뜨면 = 풀 밖 예문이 차단된 것. 정상)
6. 종료 보고.

절대 금지: git commit/push · 문서(.md) 수정 · example-match-chunk.mjs 재실행 · 다른 exmatch-* dir · 마이그레이션.
완료 보고: 세션·청크수·입력 단어수·매칭 sense수·apply된 단어수·게이트 거부수.
```

### ▸ X2 (rank 1,688–4,177 · 8청크)
```
Vocaflow per-sense 예문 매칭 — 세션 X2 담당.

먼저 docs/AI_CONTEXT/handoffs/example_match_multisession_20260718.md 를 읽어라. 지시문 전문이다. 특히 §4(authoring 프롬프트).

내 담당 = scripts/dict/exmatch-s2/ 하나뿐. 다른 exmatch-* dir 은 다른 세션 소유이니 건드리지 마라.
내 dir = 8청크(chunk-00 ~ chunk-07). 2웨이브(00-03, 04-07)로 처리한다.

작업 루프:
1. ls scripts/dict/exmatch-s2/ 확인 (*.out.json 있으면 완료분 → 건너뜀).
2. 웨이브1 = chunk-00~03 를 general-purpose 서브에이전트 4개에 한 메시지에서 동시 디스패치(run_in_background: true). 프롬프트 = 지시문 §4 그대로 + 청크 번호만 치환.
3. 완료 대기 = Bash(run_in_background: true) until-loop:
   for i in $(seq 1 120); do n=$(ls scripts/dict/exmatch-s2/chunk-0[0-3].out.json 2>/dev/null | wc -l); if [ "$n" -ge 4 ]; then echo W1; break; fi; sleep 15; done
4. 웨이브2 = chunk-04~07 동일. 대기: chunk-0[4-7].out.json -ge 4.
5. apply(grounding 게이트 내장): node scripts/dict/example-match-apply.mjs --dir scripts/dict/exmatch-s2 --commit
   (rejected 에 ungrounded-ex 뜨면 = 풀 밖 예문이 차단된 것. 정상)
6. 종료 보고.

절대 금지: git commit/push · 문서(.md) 수정 · example-match-chunk.mjs 재실행 · 다른 exmatch-* dir · 마이그레이션.
완료 보고: 세션·청크수·입력 단어수·매칭 sense수·apply된 단어수·게이트 거부수.
```

### ▸ X3 (rank 4,185–6,867 · 8청크)
```
Vocaflow per-sense 예문 매칭 — 세션 X3 담당.

먼저 docs/AI_CONTEXT/handoffs/example_match_multisession_20260718.md 를 읽어라. 지시문 전문이다. 특히 §4(authoring 프롬프트).

내 담당 = scripts/dict/exmatch-s3/ 하나뿐. 다른 exmatch-* dir 은 다른 세션 소유이니 건드리지 마라.
내 dir = 8청크(chunk-00 ~ chunk-07). 2웨이브(00-03, 04-07)로 처리한다.

작업 루프:
1. ls scripts/dict/exmatch-s3/ 확인 (*.out.json 있으면 완료분 → 건너뜀).
2. 웨이브1 = chunk-00~03 를 general-purpose 서브에이전트 4개에 한 메시지에서 동시 디스패치(run_in_background: true). 프롬프트 = 지시문 §4 그대로 + 청크 번호만 치환.
3. 완료 대기 = Bash(run_in_background: true) until-loop:
   for i in $(seq 1 120); do n=$(ls scripts/dict/exmatch-s3/chunk-0[0-3].out.json 2>/dev/null | wc -l); if [ "$n" -ge 4 ]; then echo W1; break; fi; sleep 15; done
4. 웨이브2 = chunk-04~07 동일. 대기: chunk-0[4-7].out.json -ge 4.
5. apply(grounding 게이트 내장): node scripts/dict/example-match-apply.mjs --dir scripts/dict/exmatch-s3 --commit
   (rejected 에 ungrounded-ex 뜨면 = 풀 밖 예문이 차단된 것. 정상)
6. 종료 보고.

절대 금지: git commit/push · 문서(.md) 수정 · example-match-chunk.mjs 재실행 · 다른 exmatch-* dir · 마이그레이션.
완료 보고: 세션·청크수·입력 단어수·매칭 sense수·apply된 단어수·게이트 거부수.
```

### ▸ X4 (rank 6,869–10,654 · 8청크)
```
Vocaflow per-sense 예문 매칭 — 세션 X4 담당.

먼저 docs/AI_CONTEXT/handoffs/example_match_multisession_20260718.md 를 읽어라. 지시문 전문이다. 특히 §4(authoring 프롬프트).

내 담당 = scripts/dict/exmatch-s4/ 하나뿐. 다른 exmatch-* dir 은 다른 세션 소유이니 건드리지 마라.
내 dir = 8청크(chunk-00 ~ chunk-07). 2웨이브(00-03, 04-07)로 처리한다.

작업 루프:
1. ls scripts/dict/exmatch-s4/ 확인 (*.out.json 있으면 완료분 → 건너뜀).
2. 웨이브1 = chunk-00~03 를 general-purpose 서브에이전트 4개에 한 메시지에서 동시 디스패치(run_in_background: true). 프롬프트 = 지시문 §4 그대로 + 청크 번호만 치환.
3. 완료 대기 = Bash(run_in_background: true) until-loop:
   for i in $(seq 1 120); do n=$(ls scripts/dict/exmatch-s4/chunk-0[0-3].out.json 2>/dev/null | wc -l); if [ "$n" -ge 4 ]; then echo W1; break; fi; sleep 15; done
4. 웨이브2 = chunk-04~07 동일. 대기: chunk-0[4-7].out.json -ge 4.
5. apply(grounding 게이트 내장): node scripts/dict/example-match-apply.mjs --dir scripts/dict/exmatch-s4 --commit
   (rejected 에 ungrounded-ex 뜨면 = 풀 밖 예문이 차단된 것. 정상)
6. 종료 보고.

절대 금지: git commit/push · 문서(.md) 수정 · example-match-chunk.mjs 재실행 · 다른 exmatch-* dir · 마이그레이션.
완료 보고: 세션·청크수·입력 단어수·매칭 sense수·apply된 단어수·게이트 거부수.
```

### ▸ X5 (rank 10,663–27,249 · 8청크)
```
Vocaflow per-sense 예문 매칭 — 세션 X5 담당.

먼저 docs/AI_CONTEXT/handoffs/example_match_multisession_20260718.md 를 읽어라. 지시문 전문이다. 특히 §4(authoring 프롬프트).

내 담당 = scripts/dict/exmatch-s5/ 하나뿐. 다른 exmatch-* dir 은 다른 세션 소유이니 건드리지 마라.
내 dir = 8청크(chunk-00 ~ chunk-07). 2웨이브(00-03, 04-07)로 처리한다.

작업 루프:
1. ls scripts/dict/exmatch-s5/ 확인 (*.out.json 있으면 완료분 → 건너뜀).
2. 웨이브1 = chunk-00~03 를 general-purpose 서브에이전트 4개에 한 메시지에서 동시 디스패치(run_in_background: true). 프롬프트 = 지시문 §4 그대로 + 청크 번호만 치환.
3. 완료 대기 = Bash(run_in_background: true) until-loop:
   for i in $(seq 1 120); do n=$(ls scripts/dict/exmatch-s5/chunk-0[0-3].out.json 2>/dev/null | wc -l); if [ "$n" -ge 4 ]; then echo W1; break; fi; sleep 15; done
4. 웨이브2 = chunk-04~07 동일. 대기: chunk-0[4-7].out.json -ge 4.
5. apply(grounding 게이트 내장): node scripts/dict/example-match-apply.mjs --dir scripts/dict/exmatch-s5 --commit
   (rejected 에 ungrounded-ex 뜨면 = 풀 밖 예문이 차단된 것. 정상)
6. 종료 보고.

절대 금지: git commit/push · 문서(.md) 수정 · example-match-chunk.mjs 재실행 · 다른 exmatch-* dir · 마이그레이션.
완료 보고: 세션·청크수·입력 단어수·매칭 sense수·apply된 단어수·게이트 거부수.
```

### ▸ X6 (rank 27,249+ · 5청크)
```
Vocaflow per-sense 예문 매칭 — 세션 X6 담당.

먼저 docs/AI_CONTEXT/handoffs/example_match_multisession_20260718.md 를 읽어라. 지시문 전문이다. 특히 §4(authoring 프롬프트).

내 담당 = scripts/dict/exmatch-s6/ 하나뿐. 다른 exmatch-* dir 은 다른 세션 소유이니 건드리지 마라.
내 dir = 5청크(chunk-00 ~ chunk-04). 1웨이브로 처리한다.

작업 루프:
1. ls scripts/dict/exmatch-s6/ 확인 (*.out.json 있으면 완료분 → 건너뜀).
2. chunk-00~04 를 general-purpose 서브에이전트 5개에 한 메시지에서 동시 디스패치(run_in_background: true). 프롬프트 = 지시문 §4 그대로 + 청크 번호만 치환.
3. 완료 대기 = Bash(run_in_background: true) until-loop:
   for i in $(seq 1 120); do n=$(ls scripts/dict/exmatch-s6/chunk-0[0-4].out.json 2>/dev/null | wc -l); if [ "$n" -ge 5 ]; then echo ALL5; break; fi; sleep 15; done
4. apply(grounding 게이트 내장): node scripts/dict/example-match-apply.mjs --dir scripts/dict/exmatch-s6 --commit
   (rejected 에 ungrounded-ex 뜨면 = 풀 밖 예문이 차단된 것. 정상)
5. 종료 보고.

절대 금지: git commit/push · 문서(.md) 수정 · example-match-chunk.mjs 재실행 · 다른 exmatch-* dir · 마이그레이션.
완료 보고: 세션·청크수·입력 단어수·매칭 sense수·apply된 단어수·게이트 거부수.
```

---

## 6. apply grounding 게이트

`example-match-apply.mjs`가 out.json을 DB 반영 전 검사:
1. example 이 그 단어의 **제공 예문 풀(chunk-NN.json)에 정확히 존재**(편집·창작 거부 = ungrounded-ex).
2. meaning 문자열로 meanings_ko sense 찾아 `example` 필드만 추가(pos/v_level 보존, 기존 example 있으면 skip).
멱등 — dir 전체 재실행 안전.

---

## 7. 종합 세션 (전 세션 종료 후 1회)
1. 검증: `select count(*) filter(where meanings_ko::text like '%\"example\"%') from shared_dictionary` — per-sense example 보유 단어 확인.
2. CHANGELOG(v06.270) 갱신.
3. 커밋 1건 + feat/plan-ui push. `scripts/dict/exmatch-s*/` gitignore.

---

*근거 = shared_dictionary 다의어 5,288(예문 ≥2) + kaikki-extra.jsonl 예문 풀. grounding 게이트=무환각.*
