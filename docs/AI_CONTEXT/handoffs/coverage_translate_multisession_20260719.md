# coverage_lexicon 한국어 번역 — 멀티 세션 지시문 (2026-07-19)

> **목적**: `coverage_lexicon.meaning_ko`를 채운다(word + gloss_en → 간결 한국어 뜻). 남은 빈도순 **65,996단어 = 83청크**.
> **왜 멀티**: 원 세션 에이전트 열화(16→41분) + 세션 토큰 한도. 여러 fresh 창으로 분산.
> **방식**: 청크 **사전 생성 완료**(고정·재생성 금지). 각 세션이 청크 **범위 소유** → out.json 생성만. **apply·prune·재생성은 코디네이터(원 세션)가 담당** → 워커는 번역만.

---

## 1. 준비 상태 (완료)
- `scripts/dict/covtr/` 에 **83청크**(chunk-000.json ~ chunk-082.json, 각 ~800단어 = {word, pos, gloss_en}). 빈도순.
- 이미 13,645 번역 완료·잡음 정리됨(굴절·포인터gloss 삭제·skip 표시). 이 83청크는 그 이후 남은 순수 대상.

## 2. 세션 배정표 (6세션 · 청크 범위 소유)
각 세션은 **자기 범위만** 처리. out.json은 공유 covtr/에 모임(파일명 안 겹침).

| 세션 | 담당 청크 | 개수 |
|---|---|---|
| **C1** | chunk-000 ~ chunk-013 | 14 |
| **C2** | chunk-014 ~ chunk-027 | 14 |
| **C3** | chunk-028 ~ chunk-041 | 14 |
| **C4** | chunk-042 ~ chunk-055 | 14 |
| **C5** | chunk-056 ~ chunk-069 | 14 |
| **C6** | chunk-070 ~ chunk-082 | 13 |

> 창을 더/덜 쓰려면 범위를 조정. 병렬성은 머신 동시 에이전트(~12)에 묶이니 6이면 충분.

## 3. 워커 규칙
- **자기 범위 청크만** 서브에이전트에 디스패치 → chunk-NNN.out.json 생성.
- **금지**: apply·--prune·재생성(chunk.mjs)·git·마이그레이션·covtr 외 파일·다른 범위 청크.
- 청크당 에이전트 ~16~40분(정상). 스폰 실패 시 잠시 후 재시도.

## 4. 서브에이전트 authoring 프롬프트 (변경 없이 · `NNN`만 치환)
> **모델**: 번역은 경량 작업 → 디스패치 시 **`model: "haiku"`** 지정(Opus 대비 비용 ~1/10, 근거 있는 번역이라 정확도 유지). 애매한 gloss 많으면 `model: "sonnet"`. (Agent 도구 model 파라미터)
```
영어 단어의 한국어 뜻 생성(사전 표제어식). 파일 하나 처리.
입력: `C:\Users\kille\Vocaflow\scripts\dict\covtr\chunk-NNN.json` = [{word, pos, gloss_en}]. gloss_en=영어 정의.
각 단어에 gloss_en 근거로 간결한 한국어 뜻을 만든다.
규칙: (1)gloss_en 근거만·무환각. 사전식 간결한 뜻(문장 아님). 예: perspicacious→"통찰력 있는, 명민한". (2)여러 뜻이면 주요 1~2개 쉼표. (3)고유명사·불명확·번역불가·약어면 생략(억지 금지). (4)한국어로만(영어 echo 금지).
출력: `C:\Users\kille\Vocaflow\scripts\dict\covtr\chunk-NNN.out.json` = [{word, meaning_ko}](생성분만). Write로 저장. 끝에 `chunk-NNN: <생성수>/<입력수>` 한 줄만.
```

## 5. 세션별 지시문 — 복사해서 붙여넣기 (치환 불필요)

### ▸ C1 (chunk-000 ~ 013)
```
Vocaflow coverage 한국어 번역 — 세션 C1 담당.
먼저 docs/AI_CONTEXT/handoffs/coverage_translate_multisession_20260719.md 를 읽어라(특히 §3 규칙·§4 프롬프트).
담당 = scripts/dict/covtr/chunk-000.json ~ chunk-013.json (14개). 다른 범위·apply·재생성·git 금지. out.json 생성까지만.
루프:
1. 미처리(=out.json 없음) 담당 청크를 최대 12개 general-purpose 서브에이전트에 한 메시지 동시 디스패치(run_in_background: true). 프롬프트=§4 그대로+청크번호.
2. 대기 = Bash(run_in_background: true): for i in $(seq 1 90); do n=$(ls scripts/dict/covtr/chunk-00[0-9].out.json scripts/dict/covtr/chunk-01[0-3].out.json 2>/dev/null | wc -l); if [ "$n" -ge 14 ]; then echo DONE; break; fi; sleep 30; done
3. 14개 다 되면 "C1 done: 처리 청크수" 보고.
```

### ▸ C2 (chunk-014 ~ 027)
```
Vocaflow coverage 한국어 번역 — 세션 C2 담당.
먼저 docs/AI_CONTEXT/handoffs/coverage_translate_multisession_20260719.md 를 읽어라(특히 §3 규칙·§4 프롬프트).
담당 = scripts/dict/covtr/chunk-014.json ~ chunk-027.json (14개). 다른 범위·apply·재생성·git 금지. out.json 생성까지만.
루프:
1. 미처리 담당 청크를 최대 12개 general-purpose 서브에이전트에 동시 디스패치(run_in_background: true). 프롬프트=§4 그대로+청크번호.
2. 대기: for i in $(seq 1 90); do n=$(ls scripts/dict/covtr/chunk-01[4-9].out.json scripts/dict/covtr/chunk-02[0-7].out.json 2>/dev/null | wc -l); if [ "$n" -ge 14 ]; then echo DONE; break; fi; sleep 30; done
3. "C2 done" 보고.
```

### ▸ C3 (chunk-028 ~ 041)
```
Vocaflow coverage 한국어 번역 — 세션 C3 담당.
먼저 docs/AI_CONTEXT/handoffs/coverage_translate_multisession_20260719.md 를 읽어라(특히 §3 규칙·§4 프롬프트).
담당 = scripts/dict/covtr/chunk-028.json ~ chunk-041.json (14개). 다른 범위·apply·재생성·git 금지. out.json 생성까지만.
루프:
1. 미처리 담당 청크를 최대 12개 general-purpose 서브에이전트에 동시 디스패치(run_in_background: true). 프롬프트=§4 그대로+청크번호.
2. 대기: for i in $(seq 1 90); do n=$(ls scripts/dict/covtr/chunk-02[89].out.json scripts/dict/covtr/chunk-03[0-9].out.json scripts/dict/covtr/chunk-04[01].out.json 2>/dev/null | wc -l); if [ "$n" -ge 14 ]; then echo DONE; break; fi; sleep 30; done
3. "C3 done" 보고.
```

### ▸ C4 (chunk-042 ~ 055)
```
Vocaflow coverage 한국어 번역 — 세션 C4 담당.
먼저 docs/AI_CONTEXT/handoffs/coverage_translate_multisession_20260719.md 를 읽어라(특히 §3 규칙·§4 프롬프트).
담당 = scripts/dict/covtr/chunk-042.json ~ chunk-055.json (14개). 다른 범위·apply·재생성·git 금지. out.json 생성까지만.
루프:
1. 미처리 담당 청크를 최대 12개 general-purpose 서브에이전트에 동시 디스패치(run_in_background: true). 프롬프트=§4 그대로+청크번호.
2. 대기: for i in $(seq 1 90); do n=$(ls scripts/dict/covtr/chunk-04[2-9].out.json scripts/dict/covtr/chunk-05[0-5].out.json 2>/dev/null | wc -l); if [ "$n" -ge 14 ]; then echo DONE; break; fi; sleep 30; done
3. "C4 done" 보고.
```

### ▸ C5 (chunk-056 ~ 069)
```
Vocaflow coverage 한국어 번역 — 세션 C5 담당.
먼저 docs/AI_CONTEXT/handoffs/coverage_translate_multisession_20260719.md 를 읽어라(특히 §3 규칙·§4 프롬프트).
담당 = scripts/dict/covtr/chunk-056.json ~ chunk-069.json (14개). 다른 범위·apply·재생성·git 금지. out.json 생성까지만.
루프:
1. 미처리 담당 청크를 최대 12개 general-purpose 서브에이전트에 동시 디스패치(run_in_background: true). 프롬프트=§4 그대로+청크번호.
2. 대기: for i in $(seq 1 90); do n=$(ls scripts/dict/covtr/chunk-05[6-9].out.json scripts/dict/covtr/chunk-06[0-9].out.json 2>/dev/null | wc -l); if [ "$n" -ge 14 ]; then echo DONE; break; fi; sleep 30; done
3. "C5 done" 보고.
```

### ▸ C6 (chunk-070 ~ 082)
```
Vocaflow coverage 한국어 번역 — 세션 C6 담당.
먼저 docs/AI_CONTEXT/handoffs/coverage_translate_multisession_20260719.md 를 읽어라(특히 §3 규칙·§4 프롬프트).
담당 = scripts/dict/covtr/chunk-070.json ~ chunk-082.json (13개). 다른 범위·apply·재생성·git 금지. out.json 생성까지만.
루프:
1. 미처리 담당 청크를 최대 12개 general-purpose 서브에이전트에 동시 디스패치(run_in_background: true). 프롬프트=§4 그대로+청크번호.
2. 대기: for i in $(seq 1 90); do n=$(ls scripts/dict/covtr/chunk-07[0-9].out.json scripts/dict/covtr/chunk-08[0-2].out.json 2>/dev/null | wc -l); if [ "$n" -ge 13 ]; then echo DONE; break; fi; sleep 30; done
3. "C6 done" 보고.
```

## 6. 코디네이터 (원 세션 = 이 세션)
- 워커들이 out.json을 쌓는 동안 주기적으로: `node scripts/dict/coverage-translate-apply.mjs --dir scripts/dict/covtr --commit --prune` (멱등·안전, 있는 out.json만 적용+skip표시).
- 전 세션 done 후 최종 apply + 검증 + CHANGELOG v06.271 + 커밋.
- covtr*/·en_full.txt gitignore(데이터).

---
*근거: coverage_lexicon 남은 빈도순 65,996(83청크) · 사전 생성 고정 청크(재생성/충돌 없음) · 워커=번역만·코디네이터=apply.*
