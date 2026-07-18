# coverage_lexicon 한국어 번역 — 실행 핸드오프 (2026-07-18)

> **목적**: `coverage_lexicon`(독해 커버리지 사전)의 `meaning_ko`를 채운다. 최소 context 배치 번역(word + gloss_en → 간결 한국어 뜻).
> **왜 핸드오프**: 원 세션에서 서브에이전트 스폰이 반복 실패(API/세션한도) → **새 창(fresh 세션)에서 실행**. 파이프라인·청크는 준비 완료.
> **스코프**: 빈도순 실존 롱테일 **89,393단어 = 112청크**(`scripts/dict/covtr/chunk-000.json`~`chunk-111.json`). 최상위 빈도부터.

---

## 1. 준비 상태 (이미 완료)
- `coverage_lexicon` 테이블 424,328행(gloss_en+ipa, meaning_ko NULL).
- `scripts/dict/covtr/` 에 **112 청크**(freq-ordered, 각 ~800단어 = {word, pos, gloss_en}).
- 도구: `coverage-translate-chunk.mjs`(청크·완료) · `coverage-translate-apply.mjs`(적용).

## 2. 파이프라인
```
chunk(완료) → [worker] 각 청크 번역 → chunk-NNN.out.json → apply → coverage_lexicon.meaning_ko
```
- apply 게이트: 한글 포함(영어 echo 거부)·길이 2~200·멱등(이미 있으면 skip).

## 3. 서브에이전트 authoring 프롬프트 (변경 없이 · `NNN`만 치환)
```
영어 단어의 한국어 뜻 생성(사전 표제어식). 파일 하나 처리.
입력: `C:\Users\kille\Vocaflow\scripts\dict\covtr\chunk-NNN.json` = [{word, pos, gloss_en}]. gloss_en=영어 정의.
각 단어에 gloss_en 근거로 간결한 한국어 뜻을 만든다.
규칙: (1)gloss_en 근거만·무환각. 사전식 간결한 뜻(문장 아님). 예: perspicacious→"통찰력 있는, 명민한". (2)여러 뜻이면 주요 1~2개 쉼표. (3)고유명사·불명확·번역불가·약어면 생략(억지 금지). (4)한국어로만(영어 echo 금지).
출력: `C:\Users\kille\Vocaflow\scripts\dict\covtr\chunk-NNN.out.json` = [{word, meaning_ko}](생성분만). Write로 저장. 끝에 `chunk-NNN: <생성수>/<입력수>` 한 줄만.
```

## 4. 드라이버 블록 — 새 창에 붙여넣기 (전체 112청크)
> 한 창에서 전부 돌리려면 아래를 붙여넣기. 빠르게 하려면 §5처럼 창 2~3개로 범위 분할.
```
Vocaflow coverage_lexicon 한국어 번역 실행. docs/AI_CONTEXT/handoffs/coverage_translate_20260718.md 를 먼저 읽어라.

담당 = scripts/dict/covtr/chunk-000.json ~ chunk-111.json (112청크). 빈도 낮은 번호부터(000=최빈).

현 상태: ~13,645 번역 완료 · 남은 빈도순 미번역 ~64k. covtr는 매 사이클 재생성(청크 번호 바뀜, chunk-000=남은 것 중 최빈). **한 창에서만** 돌릴 것(여러 창이 같은 covtr 재생성 시 충돌).

사이클(남은 대상 0 될 때까지 반복):
1. 청크 확인: ls scripts/dict/covtr/chunk-*.json | grep -v out | wc -l. 0이면 재생성:
   node --max-old-space-size=4096 scripts/dict/coverage-translate-chunk.mjs --out scripts/dict/covtr --chunk 800
   ("청크 대상: 0" 나오면 완료 → 종료 보고).
2. chunk-000 ~ chunk-011(최대 12, 있는 만큼) general-purpose 서브에이전트에 한 메시지 동시 디스패치(run_in_background: true). 프롬프트 = §3 그대로 + 청크번호 치환. (에이전트 ~16~40분, 정상.)
3. 대기 = Bash(run_in_background: true) until-loop:
   for i in $(seq 1 90); do n=$(ls scripts/dict/covtr/chunk-0[01][0-9].out.json 2>/dev/null | wc -l); if [ "$n" -ge {디스패치수} ]; then echo DONE; break; fi; sleep 30; done
4. apply(--prune 필수): node scripts/dict/coverage-translate-apply.mjs --dir scripts/dict/covtr --commit --prune
   (--prune = 스킵 잡음[고유명사·브랜드·약어] source='skip' 표시→재부상 차단. no-hangul 거부 정상. 멱등)
5. rm scripts/dict/covtr/chunk-*.out.json  → 1로(재생성이 완료분·skip 제외하고 남은 빈도순만 다시 청크).

절대 금지: 마이그레이션 · coverage_lexicon 스키마 변경 · main push · covtr/en_full.txt 외 파일 수정.
서브에이전트 스폰 실패(API/세션한도) 시: 잠시 후 재시도 or 다른 창.
```

## 5. 병렬(고급·선택)
§4 재생성-루프는 covtr를 통째로 재생성하므로 **한 창 전용**. 병렬을 원하면 창마다 **별도 out dir + rank 파티션**:
- 창A: `--out scripts/dict/covtr-a --max-rank 30000` · 창B: `--out covtr-b --max-rank 60000`(30000 초과분은 수동 필터) 등. 각자 자기 dir로 §4 루프.
- apply는 `--dir covtr-a` 등 자기 dir. 복잡하므로 단일 창 권장(급하지 않으면).

## 6. 종합 (전 대상 완료 후)
- 검증: `select count(*) filter(where meaning_ko is not null) as translated, count(*) filter(where source='skip') as skip from coverage_lexicon;`
- CHANGELOG v06.271 갱신(누계 번역수).
- covtr*/·en_full.txt·kowiki-en.jsonl 은 gitignore(데이터).
- **잔여**: 미랭크 극희귀 ~334k는 `coverage-translate-chunk.mjs --include-unranked`로 후속(원하면). 사실상 안 나오는 단어라 선택.

---
*근거: coverage_lexicon 424,328 · 빈도소스 hermitdave OpenSubtitles 165만 · 실존 랭크 89,393. 원 세션 서브에이전트 스폰 실패로 핸드오프.*
