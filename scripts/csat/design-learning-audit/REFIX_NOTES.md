# 재교정 — 독립 검수 반려 반영 (2026-10-11)

입력 청크에는 이제 `sentences: [{n, text}]` 가 있다. **모든 문장 번호는 이 n** 으로 다시 맞춘다(「앞/다음 문장」 대신 번호).
출발점: 같은 문항의 직전 교정본 `chunk-redo-20261010T191130200Z-<TYPE>-<ID>.out.json` 의 분석 — 맞는 부분은 보존하고 아래만 고친다.
기준: REDO_SUPPLEMENT.md · _PROMPT.md(평가원 sentences 단락 포함). 검수 3인을 다시 붙이고, 반려가 있으면 고친 뒤 pass.
학습자 칸(measured_ability · design_intent · answer_locus.reasoning · why_correct · why_tempting · how_to_reject · trap)에 작업 용어 금지. confirmed_at.note 에도 작업 메모 대신 근거만.

| 문항 | 고칠 것(독립 검수) |
|---|---|
| 2014A#40 | 문장 번호를 sentences 기준으로(losing my patience · 마지막 문장 위치 재확인) — 모든 칸 일치 |
| 2014A#35 | measured_ability 의 「다섯 문장 앞」 → 빈칸 문장과 근거 문장의 실제 거리(sentences 번호로) |
| 2022#20 | ② trap 「인과 역전」 설명 「화살표만 반대로」 → 실제 변형(지문에 없는 목표 수립 방법을 덧붙임)에 맞게 라벨 · 유인 · 배제 |
| 2014A#29 | design_intent 의 「③이 휴관 주기를 바꿨다」 단정 ↔ ③ 보류(how_to_reject) 모순 해소 — 원문 각주가 잘려 확인 불가면 보류로 통일 |
| 2014B#26 | 문장 세는 법과 번호 불일치 — sentences 목록 번호로 통일, design_intent 의 세는 법 서술 삭제 |
| 2014B#45 | design_intent 「네 선지가 (A)(B)(C)에 하나씩」 → 실제 대응(③④ 모두 (C)) |
| 2019#42 | ① · ④ 배제 설명의 「다음 문장」 「앞 문장」 → 실제 번호(sentences) |

다른 에이전트가 함께 일한다 — 자기 청크의 .out.json 만 쓰고 DB · git · 다른 파일은 건드리지 않는다.
