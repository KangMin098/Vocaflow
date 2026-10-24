# 범위 B — 2014A#29 각주 복원과 해설 동시 정정 계획 (승인 대기 · 미적용)

> 이 문서의 SQL · 문안 · 파일 변경은 모두 **후보**다. DB 쓰기와 원본 콘텐츠 변경은 하지 않았다(SELECT 만).
> 근거: 공식 문제지 `2014_영어A-홀수형_문제.pdf`(sha256 `d770c962…7cdb7e`) — Hours 아래 각주 「* The museum is closed on the first Monday of every month.」 정답 ⑤, ③ 「매주 월요일에 휴관한다」.

## 1. 핵심 사실 — 학습자는 이미 각주를 본다

학습자 시험지 화면은 DB 지문을 읽지 않는다. 학습자가 올린 공식 문제지 PDF 를 브라우저에서 추출한다(`lib/csat/reflow/read-paper.ts`). 공개 뷰 `csat_items_public` 에는 지문 열이 없다.
→ 학습자는 **지금도** 시험지에서 「매월 첫째 월요일 휴관」을 본다. 그런데 강의 c9 · 분석 v5 · 탐구 자료는 「각주가 잘려 확인할 수 없다」고 말한다.
**학습자 화면은 이미 어긋나 있고**, 그 원인은 DB 지문이 아니라 해설이다.

## 2. 영향 대상 (현재 판본 · 해시)

| 자료 | 위치 | 현재 | 변경 후보 | 소유 |
|---|---|---|---|---|
| DB 원문 | `csat_items.passage` id=2014A#29 | md5 `354dba3d…` · 「p.m. month.」 조각 | `forward.sql` → md5 `6b4dd881…` | DB 승인 |
| 분석 v5 | `csat_item_analyses` id `74f606c7-159d-46b7-a1cd-6b7f634f3683` (published) | choice_analysis md5 `e766e2a0…` · design_intent `54172205…` · solve_procedure `49d2cd0a…` | **v6 새 행**(아래 §4) — v5 는 덮어쓰지 않는다 | DB 승인 · 콘텐츠 감수 |
| 강의 | `apps/web/src/lib/csat/lecture-data/2014A.json` 2014A#29 version 2 · c9 | 「휴관 각주가 조각만 남아 주기를 확인할 수 없습니다 …」 | c9 교체(§4) · version 3 | 콘텐츠 감수 owner `csat-lecture-content-review` |
| 탐구 자료 | `apps/web/src/lib/csat/inquiry-data.json` items.2014A#29 | note · decisive · text · limitation 4곳 「잘려」 | §4 문안 | 같음 |
| 정답 공개 경계 | owner `csat-lecture-disclosure` 의 `lib/csat/lecture/disclosure-data.json` | `{version:2, cues:13, stopBefore:4, preStopRisk:"none", digest:a2ca82e2…}` | c9 는 경계 뒤(c5~)라 **stopBefore 4 유지 예상**. digest 는 cue 문장으로 계산되므로 재생성 필요 | owner `csat-lecture-disclosure` |
| 근거 앵커 · 골격 | `lib/csat/skeleton-data/2014A.json` | 7문장 · s4 38자 | 분할기(`splitSentences`) 사본으로 계산: 정정 뒤에도 **7문장**, s4 만 38 → 90자. 정답 anchor(s5 +83) · 오답 ④(s5 +27) · 오답 ①(s2 +0) **불변** | 골격 재생성(`build-skeleton-data.mjs`) |
| 강의 문장 번호 | c9 「다섯 번째 문장」 = s4 | 그대로 | 그대로 | — |
| 원장 수리 기록 | `scripts/csat/data/kice-source-repairs.json` | 없음 | `recipe-B-2014A29.json` 을 합친다 — 재생성 원장이 DB 정정값을 만든다(검증 완료) | DB 적용과 같은 때 |
| 자동 보류 | `csat_hold_on_item_change`(학평만) · `csat_visual_source_changed`(도표 이미지 연결 문항만) | 2014A#29 에는 **둘 다 걸리지 않는다** | 지문을 바꿔도 v5 가 published 로 남는다 → 순서로 막아야 한다 | — |

## 3. 반영 순서 — 학습자 쪽 중간 상태를 만들지 않는다

| 단계 | 내용 | 학습자에게 보이는 것 |
|---|---|---|
| 0 | 사람 콘텐츠 승인(§4 문안) | 변화 없음 |
| 1 | 저장소: 강의 c9(version 3) · inquiry-data · disclosure-data(owner 재생성) 를 **한 커밋**으로 로컬 main 에 통합 | 시험지(각주 있음)와 강의·탐구가 일치. 분석 화면은 아직 v5 |
| 2 | DB: 분석 v6 행 insert(published). v1~v5 도 모두 published 로 공존하는 것이 이 DB 의 관례이고, 로더는 가장 높은 version 을 쓴다(`lib/csat/items.ts` 내림차순 · `dissect-catalog.ts` 오름차순 뒤 덮어쓰기) — v5 는 바꾸지 않는다 | 분석 화면도 각주 기준으로 일치 — 여기서 학습자 쪽 정정 완료 |
| 3 | DB 범위 B `forward.sql` → `check.sql` 이 'after' | 학습자 화면 변화 없음(DB 지문은 학습자에게 안 보인다) |
| 4 | 골격 재생성(s4 길이) · `kice-source-repairs.json` 에 B 기록 합치기 · 커밋 | 변화 없음(막대 길이만) |

- 1 → 2 사이에는 강의는 새것, 분석은 v5 다. 이 간격이 학습자에게 남는 유일한 불일치다 — 단계 1·2 를 같은 작업 창에서 연달아 실행한다.
- 지금 상태(해설 전부 「확인 불가」)보다 나빠지는 순간은 없다.
- 3 을 1·2 보다 먼저 하지 않는다: DB 지문만 고치면 내부 검사(인용 대조 등)는 각주를 보는데 공개 해설은 「잘렸다」고 말한다.

## 4. 변경 후보 문안 (사람 감수 전 · AI 작성)

**분석 v6 — v5 를 읽어 아래 키만 바꾼다(통째로 덮지 않는다)**
- `choice_analysis[n=3]`: verdict `distractor` 유지. `how_to_reject` = 「[4] Hours 의 별표(*) 각주는 휴관을 'the first Monday of every month', 곧 한 달에 한 번 첫째 월요일로 정한다. ③ '매주 월요일'은 주기가 달라 안내문과 일치하지 않는다.」
- `design_intent` 의 ③ 문장 → 「③(매주 월요일 휴관)은 Hours 별표 각주의 주기 낱말 month 를 week 로 바꾼 함정이다.」
- `solve_procedure` 의 「각주 문장이 온전히 읽히지 않으면 그 선지는 보류하고 …」 단계 → 「별표가 가리키는 각주에서 주기 낱말(every week / every month · first)을 찾아 선지의 주기와 대조한다」
- `answer_locus`(⑤ · sentence_index [6])는 그대로다.

**강의 c9(eliminate · reject:3) — version 3**
> 「삼 번, 다섯 번째 문장 끝 별표 각주를 짚어 보세요. 휴관은 매월 첫째 월요일, 한 달에 한 번이에요. 선지는 매주 월요일이라 주기가 다릅니다. 그래서 일치하지 않는 선지로 지웁니다.」

c3(전략)의 「휴관」은 항목 이름이라 그대로 둔다. 바꾼 뒤 `withFocus` 와 rubric 을 다시 계산하고, disclosure digest 를 다시 만든다.

**inquiry-data.json items.2014A#29**
- `note`: 「휴관 정보는 Hours 별표 각주(매월 첫째 월요일)에 있다. ③은 주기를 매주로 바꿔 불일치하고, 답은 모든 성분이 확인되는 ⑤다.」
- `decisive`: 「Hours 별표 각주가 휴관을 매월 첫째 월요일로 정해 '매주 월요일'과 주기가 다르다」
- `text`: 「휴관 각주의 주기 낱말 month 와 선지의 '매주'를 대조하면 3번 선지는 불일치다」
- `limitation`: 「표 형식 안내문을 문장으로 옮기며 항목 경계가 일부 합쳐졌다.」(각주 잘림 문장 삭제)

## 5. 복구 순서

학습자 쪽 일관성을 유지하려면 반영의 역순으로 되돌린다.
1. DB: `recovery.sql`(지문) → `check.sql` 이 'before'.
2. DB: v6 를 `in_review` 로 내린다(v5 는 계속 published 라 최신 공개판이 v5 로 돌아간다). 행은 지우지 않는다.
3. 저장소: 1 단계 커밋을 revert(새 커밋으로 되돌리기 — 히스토리는 지우지 않는다).
- 지문만 되돌리고 해설을 새 것으로 두면 내부 검사만 어긋난다. 학습자 화면은 시험지 기준이라 계속 일치한다.

## 6. 승인 필요

① §4 문안의 사람 콘텐츠 승인 ② 단계 2 의 분석 v6 DB 쓰기 ③ 단계 3 의 `forward.sql` ④ owner `csat-lecture-disclosure` 의 disclosure-data 재생성.
