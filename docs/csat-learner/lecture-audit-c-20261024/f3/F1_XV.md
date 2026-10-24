# F1 교차검증 (F1_XV) — 2026-10-24

내부 검토(Claude 서브에이전트)이며 사람 콘텐츠 승인이 아니다. DB SELECT만 했고 git·DB 쓰기는 없다.

| item_id | cue | 작성자 | 교차 | 근거 위치 | 이유 |
|---|---|---|---|---|---|
| 2016#39 | c7 | ISSUE_CONFIRMED | AGREE | csat_items.passage + passage-skeleton.ts splitSentences(L96-126, ① 앞 분할) · lecture-data/2016.json c7 | 분할하면 s0 Food intake / s1 The failure / s2 Therefore / s3~s7 = ①~⑤. ④ Here 는 s6이다. c7 target sentence:2 는 도입문 「Therefore…」이고, 「세 번째 문장 안, 사 번 첫 낱말」은 틀린 안내다. 정답 3(DB answer=3)과 c7의 ③ 소거 논리는 맞다. |
| 2016#39 | c5 | ISSUE_CONFIRMED | AGREE | 같은 분할 · c5 segments[0] | 번호 문장 ①~⑤는 넷째~여덟째 막대(s3~s7)에 있다. 「세 번째 막대 안」은 틀렸다. 수정안 「넷째부터 여덟째 막대」가 맞다. |
