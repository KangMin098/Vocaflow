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

## 2026-10-11 추가 — 275문항 교정 검수(`redo275-review-plan.json`, 출력 `redo275-review-G<GG>.json`)

교정 작성자의 3인 검수는 **같은 작성자가 한 것**이라 독립이 아니다. 아래를 반드시 본다.

6. **칸 사이 문장 번호**: design_intent · answer_locus · why_correct · how_to_reject · confirmed_at · solve_procedure 가 같은 문장을 같은 번호로 부르는가. 번호는 입력 청크 `sentences` 목록 번호(1부터)만. 범위 밖 번호는 사실 오류.
7. **발문 극성**: 선택≠참거짓 유형이라도 발문이 긍정형(「일치하는 것은?」 · 네모 어휘 「가장 적절한 것은?」)이면 오답이 **틀린** 진술이다 — trap · why_tempting 이 있어야 하고, 「맞는 진술」이라 쓰면 사실 오류. 부정형이면 반대.
8. **틀로 찍은 설명**: 같은 파일의 여러 문항에서 how_to_reject · design_intent 가 문항 내용 없이 같은 꼴이면 `templated` 로 적는다.
9. **`body_recovered: true`**: 입력 청크의 `passage` · `raw_block` 과 분석 인용이 실제로 맞는지 대조한다. 맞지 않으면 사실 오류.
10. 원문 확인 없이 정할 수 없는 판단(밑줄 범위 · 도표 값 · 깨진 선지)을 확정처럼 쓰면 `needs_source` 로 적는다.
11. **`confirmed_at.note` 는 학습자 칸이 아니다** — 학습자 화면 코드는 `confirmed_at` 을 읽지 않는다(grep 확인 · 3차 정독 README 정정). 원문 결손 · 문장 목록 사정 같은 작업 메모는 _PROMPT 가 **바로 이 칸에** 쓰라고 지시한다. 여기 있는 작업 메모는 결함이 아니다(원장의 M2106#38·#39 `other` 도 같은 오해 — 해소로 본다). 학습자 칸은 measured_ability · design_intent · answer_locus.reasoning · 선지 why_correct · why_tempting · how_to_reject · trap.
