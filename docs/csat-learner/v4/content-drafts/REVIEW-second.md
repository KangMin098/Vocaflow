# 두 번째 판정자 검토(맹검: REVIEW.md 읽기 전에 작성)

- 판정자: Claude(두 번째, 독립). DB 는 쓰지 않았다.
- 원문 출처: `scripts/csat/topic-blind/chunk-04.json`·`chunk-05.json`(지문 원문), `scripts/csat/choice-blind/chunk-02.json`(2025#34 선택지), 문장 경계·앵커는 `apps/web/src/lib/csat/skeleton-data/{2023,2024,2025}.json` (문장 번호는 0부터, 글자 수로 대조).
- 공통 노출 판단: 초안 파일은 `docs/` 아래에만 있고 앱 데이터 경로(`apps/web/src/lib/csat/*`)에는 없다. `provenance.status` 에 "draft … needs … release approval" 이라고 적혀 있다. 다만 `public:false`/`active:false` 같은 **기계가 읽는 플래그는 없다** — 공통으로 고칠 점이다(판정에는 반영하지 않음).

## cohesion-link

| 항목 | (a) 응집 | (b) 정답 | (c) 단서·disputed | 판정 |
|---|---|---|---|---|
| 2024#36 | cue1 s3 "In these … forms" → s2(antagonistic instances) 그대로 맞다. cue2 s1 "Areas of difference" → s5 "areas of common interest and conflict" 맞다 | C-A-B = 옵션 index 3(④) 맞다. 앵커 s3 은 skeleton 의 answer 앵커와 일치 | s6(공통 영역이 다듬어진다 → 차이는 남는다)는 오히려 대비로 가장 가까운 연결이라 disputed 로 두는 게 맞다. cueLabel "공통 이익·갈등 영역을 다시 받는" 은 반복이 아니라 대비이므로 문구가 약간 부정확하다 | accept(문구 다듬기 권고) |
| 2025#36 | cue1 s1 "Similarly, a landowner" ↔ s5 "a farmer can reduce effort" 맞다. cue2 s4 "reputations act as a bond" → s6 맞다 | C-B-A = index 4(⑤) 맞다. 앵커 s1 일치 | s7("reputations are well known") disputed 타당. 단, cue2 는 (B) 안쪽 문장이라 C→B 경계 자체의 단서는 아니다(경계는 s7→s3) | accept |
| 2025#37 | cue1 s6 "The birds in a line" → s5 "birds … feeding in a line" 맞다. cue2 s3 "birds in line were more fearful" → s6 "more nervous" 맞다 | B-C-A = index 2(③) 맞다. 앵커 s6 일치 | s5 disputed 타당. 초안이 적은 혼동 위험(두 단서가 같은 표현 공유)에 동의 | accept |

## evidence-locate-transfer

| 항목 | (a) 빈칸·문장 | (b) 근거 | (c) disputed | 판정 |
|---|---|---|---|---|
| 2024#31 | blank s5 "Reading is not simply ___" 맞다 | 정답 ② word recognition. s6(answer 앵커) + s3("more complicated kind of interpretation") 근거 타당 | s4(그림·글 보완)는 ⑤ image mapping 의 유인 앵커 문장 — disputed 로 두는 것이 맞다 | accept |
| 2024#33 | blank s3 "What is striking … is that ___" 맞다 | s4(context 부재, answer 앵커) 직접 근거 맞다 | s5 disputed 타당 | accept |
| 2023#32 | blank s5 "Cities drive taste change because they ___" 맞다 | s4(Bloomfield, answer 앵커) 맞다 | s2 "frequently exposed to one another" disputed 타당 | accept |
| 2025#34 | blank s0(37자 첫 문장 — 원문 사본에 빈칸 문장 텍스트는 없고 skeleton 글자 수로만 확인) | 정답 "facilitate productive activity by establishing roles and practices" 와 s2 일치 | 근거가 s2 하나로 좁다. 정답의 두 요소(practices·roles)를 각각 s4("make practices that create new opportunities")·s6("rules also create the roles themselves")가 직접 말한다. s4·s6 도 근거 또는 disputed 에 넣어야 하고, s3(악보)는 간접. 초안 스스로 적은 "인정 범위가 넓다" 위험이 실제다 | revise |

## 요약
accept 6 · revise 1 · reject 0 · source_unavailable 0.

## 첫 판정자와의 일치(REVIEW.md 읽은 뒤 추가)

REVIEW.md 는 문항별 accept/revise 판정을 내리지 않는다. 아래 "첫" 열은 그 서술에서 읽어 낸 입장이다(초안 유지 = 사실상 accept, 위험 표기 = 유보).

| 항목 | 첫 | 둘째 | 일치? |
|---|---|---|---|
| 2024#36 | 유지(cue2 s6 disputed) | accept | 예 |
| 2025#36 | 유지(cue2 s7 disputed) | accept | 예 |
| 2025#37 | 유지(단서 혼동 위험 표기) | accept | 예 |
| 2024#31 | 유지 | accept | 예 |
| 2024#33 | 유지 | accept | 예 |
| 2023#32 | 유지(s2 disputed) | accept | 예 |
| 2025#34 | 유지 + 인정 범위 넓음 위험(2·3·5) | revise(s4·s6 추가, 범위 재정의) | 부분 — 위험 인식은 같으나 갈린 문장 집합이 다름(첫: 3·5, 둘째: 4·6 이 더 직접) |

추가 차이: 노출 점검에서 첫 판정자는 content-candidates 의 `exposedByExam=false` 를 근거로 들었고, 둘째는 초안 JSON 자체에 기계가 읽는 비공개 플래그가 없다는 점을 지적한다.
