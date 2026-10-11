# 교정(redo) 보충 기준 — 출제 설계 학습 (2026-10-11)

정본 프롬프트 `scripts/csat/analysis-drain/_PROMPT.md` 를 그대로 따르고, 아래를 **더한다**(서로 모순되면 _PROMPT.md 의 안전 규칙이 우선).

1. 목적: 이 분석은 학습자가 문항을 마치고 **출제 설계를 설명**하게 만드는 자료다 — 발문이 요구한 판단, 정답만 발문을 충족시키는 근거 조건,
   지문 표현 → 정답 표현의 변환, 각 오답이 그럴듯한 실제 단서와 바뀐 성분, 원리의 적용 조건과 한계.
2. 유형 교수 계약 `apps/web/src/lib/csat/teaching-contract.ts` 에서 이 문항 유형의 모델(relation · answerDesign · lureDesign · choiceTruth · pitfalls)을 읽고 그 관계로 쓴다.
3. 원장 결함: `scripts/csat/design-learning-audit/redo-plan.json` 의 `rest[]` 에서 이 문항 id 의 `defects` 를 읽고 **모두 해소**한다. 원장이 맞다고 본 부분(정답 근거 등)은 보존한다 — 다시 쓰기보다 고친다.
4. 금지(validate 가 막는다): V12 학습자 칸 작업 용어(코퍼스 · 파싱 · OCR · 청크 · 원문 창 · 파일 경로) · V13 도표 정답표 역추론 ·
   V14 선택≠참거짓 유형(R-GRAMMAR · R-VOCAB · X-VOCAB · R-NOTICE · R-FACT · X-FACT · R-CHART)의 오답에 trap/why_tempting — 대신 how_to_reject 에 대응 위치와 「왜 답이 아닌가」. 발문이 긍정형(「일치하는 것은?」 · 네모 어휘)이면 오답이 틀린 진술이라 함정 서술을 그대로 쓴다.
5. 무조건 규칙 금지: 「선지 번호 = 지문 순서」 「총론은 각론 뒤」 「주어진 문장 바로 다음이 근거」 같은 요령은 이 문항에서 성립하는 조건과 함께만.
6. 문장 번호: 청크의 문장 목록 번호만 쓰고, 해설 칸마다 같은 문장을 같은 번호로 부른다. 지문 범위 밖 번호 금지.
7. 근거 없는 통계 금지: 「가장 많이 고르는」 「흔한」 같은 선택률 주장.
8. 다른 에이전트가 함께 일한다 — 자기 청크의 `.out.json` 만 쓰고, DB · git · 다른 파일은 건드리지 않는다.
