# 2014A#29 — 사람 내용 감수 제출 (콘텐츠 owner `csat-lecture-content-review`)

> 이 문서는 **감수 요청**이다. 아래 교체안은 AI 작성 후보이며 사람의 내용 승인 전에는 발행하지 않는다. 분석 v5 는 보존한다(v6 는 새 행).
> 판단 기준: 공식 문제지 `2014_영어A-홀수형_문제.pdf`(sha256 `d770c96243ee38ef…`) — 학습자도 이 시험지를 화면에서 본다.

## 감수 항목 — 각 칸에 승인 / 수정 / 반려

| # | 대상 | 현재(요지) | 교체안 | 판정 |
|---|---|---|---|---|
| 1 | 강의 c9(eliminate · `reject:3` · focus [4] · version 2 → 3) | 「휴관 각주가 조각만 남아 주기를 확인할 수 없습니다. 그래서 판정을 보류하고 …」 | 「삼 번, 다섯 번째 문장 끝 별표 각주를 짚어 보세요. 휴관은 매월 첫째 월요일, 한 달에 한 번이에요. 선지는 매주 월요일이라 주기가 다릅니다. 그래서 일치하지 않는 선지로 지웁니다.」 | |
| 2 | 분석 v6 `choice_analysis[n=3].how_to_reject` | 「… 'month.' 조각으로만 남아 휴관 주기를 확인할 수 없다 … 보류」 | 「[4] Hours 의 별표(*) 각주는 휴관을 'the first Monday of every month', 곧 한 달에 한 번 첫째 월요일로 정한다. ③ '매주 월요일'은 주기가 달라 안내문과 일치하지 않는다.」 | |
| 3 | 분석 v6 `design_intent` 의 ③ 문장 | 「③ … 원문을 확인할 수 없으므로 판정을 보류하고 …」 | 「③(매주 월요일 휴관)은 Hours 별표 각주의 주기 낱말 month 를 week 로 바꾼 함정이다.」 | |
| 4 | 분석 v6 `solve_procedure` 의 한 단계 | 「각주 문장이 온전히 읽히지 않으면 그 선지는 보류하고 …」 | 「별표가 가리키는 각주에서 주기 낱말(every week / every month · first)을 찾아 선지의 주기와 대조한다」 | |
| 5 | 탐구 `inquiry-data.json` items.2014A#29 `note` · `decisive` · `text` · `limitation` | 4곳 모두 「각주가 잘려 확인 불가」 | `B-2014A29/README.md` §4 문안 | |
| 6 | 정답 공개 경계(owner `csat-lecture-disclosure`) | `stopBefore 4` · digest `a2ca82e2…` | c9 는 경계 뒤 → stopBefore 4 유지 예상, digest 재생성 | owner 확인 |

변하지 않는 것: 정답 ⑤ · `answer_locus`(sentence_index [6]) · c3(전략의 「휴관」은 항목 이름) · 다른 cue.

## 반영 절차 검증 결과 (2026-10-24, 읽기 전용)

| 점검 | 결과 | 근거 |
|---|---|---|
| 학습자 시험지의 원문 출처 | 공식 PDF 를 브라우저에서 추출한다 — DB 지문을 쓰지 않는다 | `lib/csat/reflow/read-paper.ts` · 공개 뷰에 지문 열 없음 |
| 분석 로더 · 캐시 | 매 요청 DB 를 읽는다(`force-dynamic`, 캐시 없음). 최신 published version 1개를 쓴다 → v6 insert 즉시 반영, v5 는 보존 | `app/(app)/csat/item/[slug]/page.tsx:56` · `lib/csat/items.ts` `order('version', desc).limit(1)` |
| 강의 · 탐구 · 골격 · 공개 경계 | 저장소 파일 — 로컬 main 통합 시점에 바뀐다 | `lecture-data` · `inquiry-data.json` · `skeleton-data` · `disclosure-data.json` |
| 문장 골격 · 앵커 | 지문 정정 뒤에도 7문장. s4 길이만 38 → 90. 정답(s5 +83) · 오답④(s5 +27) · 오답①(s2 +0) 불변 → c9 focus [4] 그대로 | `splitSentences` 사본 실행 |
| 자동 보류 | 2014A#29 는 학평 아님 · 도표 이미지 연결 없음 → 지문을 바꿔도 분석이 자동 보류되지 않는다 | 트리거 정의 SELECT |
| 중간 상태 | 해설 먼저(강의·탐구 → 분석 v6) → 지문(범위 B) 순서면 학습자 쪽 모순 구간은 강의 통합과 v6 insert 사이뿐이고, 지금보다 나빠지지 않는다 | README §3 |

## 감수 뒤 실행 순서 (승인 항목별)

1. 1 · 5 승인 → 강의 c9(version 3, focus · rubric 재계산) · 탐구 4곳을 한 커밋으로 → owner 6 의 digest 재생성과 함께 로컬 main 통합
2. 2~4 승인 → 분석 v6 insert(published, DB 쓰기 승인 필요)
3. 범위 B `forward.sql`(별도 승인) → `check.sql` after → 골격 재생성 → `recipe-B-2014A29.json` 을 수리 목록에 합치기

**현재 상태: 사람 감수 0/6 · 발행 0 · DB 범위 B 미적용.**
