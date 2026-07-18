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

루프(청크 000부터 순서대로):
1. 미처리 청크(=out.json 없음)를 10~12개씩 웨이브로 묶어 general-purpose 서브에이전트에 동시 디스패치(run_in_background: true). 각 프롬프트 = 지시문 §3 그대로 + 청크번호 치환.
2. 웨이브 완료를 Bash(run_in_background: true) until-loop로 대기(개별 알림 폭주 방지):
   for i in $(seq 1 120); do n=$(ls scripts/dict/covtr/chunk-{범위}.out.json 2>/dev/null | wc -l); if [ "$n" -ge {웨이브수} ]; then echo DONE; break; fi; sleep 20; done
3. apply: node scripts/dict/coverage-translate-apply.mjs --dir scripts/dict/covtr --commit
   (rejected에 no-hangul 뜨면 영어 echo가 걸러진 것·정상. 멱등이라 웨이브마다 재실행 안전)
4. 남은 청크 있으면 1로. 112청크 소진까지.
5. 종료 보고: 처리 청크수·적용 단어수·거부수.

절대 금지: 마이그레이션 · coverage_lexicon 스키마 변경 · git push(작업 브랜치 커밋은 OK) · covtr 외 파일 수정.
서브에이전트 스폰 실패(API 에러) 시: 청크 크기 문제 아니라 세션 한도 → 잠시 후 재시도 or 창 나눔.
```

## 5. (선택) 창 분할 — 빠른 완료
112청크를 범위로 나눠 창마다 하나씩. 각 창은 §4 루프를 자기 범위로:
- 창A: chunk-000~037 · 창B: chunk-038~074 · 창C: chunk-075~111
- out.json은 같은 covtr/에 모임(파일명 안 겹침). apply는 아무 창에서나(멱등).

## 6. 종합 (전 청크 완료 후)
- 검증: `select count(*) filter(where meaning_ko is not null) from coverage_lexicon;` (89,393 목표).
- CHANGELOG v06.271 갱신(누계 번역수).
- covtr/·en_full.txt·kowiki-en.jsonl 은 gitignore(데이터).
- **잔여**: 미랭크 극희귀 334,935는 `coverage-translate-chunk.mjs --include-unranked`로 후속(원하면).

---
*근거: coverage_lexicon 424,328 · 빈도소스 hermitdave OpenSubtitles 165만 · 실존 랭크 89,393. 원 세션 서브에이전트 스폰 실패로 핸드오프.*
