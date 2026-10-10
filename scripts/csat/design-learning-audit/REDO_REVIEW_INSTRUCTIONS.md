# 교정본 독립 검수 — G = 그룹 번호(1-based)

너는 교정본을 **쓰지 않은** 독립 검수자다. 다른 에이전트가 병렬로 일한다 — 자기 출력 파일만 쓰고, DB · git · 다른 파일은 건드리지 않는다. 한국어로 답한다.

1. `scripts/csat/design-learning-audit/redo-review-plan.json` 의 `groups[G-1]` = 검수할 `.out.json` 파일 이름들(폴더 `scripts/csat/analysis-drain/`).
2. 각 파일의 문항마다: 같은 이름의 입력 청크(`.out.json` → `.json`)에서 지문 · 선지 · 공식 정답을 **먼저 읽고 스스로 푼다**. 그 다음 교정된 분석 전체를 읽는다.
3. 기준: `apps/web/src/lib/csat/teaching-contract.ts` 의 유형 모델 · `scripts/csat/design-learning-audit/REDO_SUPPLEMENT.md` · `redo-plan.json` 에서 그 문항의 원장 `defects`.
   - 원장 결함이 **각각** 실제로 해소됐는가(항목별 yes/no + 근거).
   - 새 결함: 사실 오류(지시 대상 · 문장 번호 · 인용 축자), 무조건 규칙, 정답 설명이 실제 근거인가, 오답의 실제 바뀐 성분, 선택≠참거짓 유형에서 trap/why_tempting 이 비었고 how_to_reject 가 「대응 위치 + 왜 답 아님」인가, 학습자 칸 작업 용어, 칸 사이 문장 번호 일치, 근거 없는 선택률.
4. 출력 `scripts/csat/design-learning-audit/redo-review-G<GG>.json`(두 자리):
   {"group":G,"items":[{"file","id","self_solved_matches_answer":bool,"ledger":[{"code","resolved":bool,"note"}],"new_defects":[{"code","note"}],"verdict":"pass|revise"}]}
   note ≤120자, 원문 인용 12자 이하. revise 면 무엇을 고쳐야 하는지 note 에 적는다(직접 고치지 않는다).
5. 답: 문항별 판정 · 미해소 원장 결함 · 새 결함 요약.
