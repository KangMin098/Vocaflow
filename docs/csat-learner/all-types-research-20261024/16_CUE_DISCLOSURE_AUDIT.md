# 16 — 강의 cue 정답 공개 수준 감사(읽기 전용)

> 상태: 연구 산출물. 원본 대본(`apps/web/src/lib/csat/lecture-data/*.json`)은 바꾸지 않았다. 판정은 **작성자 측(스크립트 + 판정 서브에이전트 4)** 이며 독립 감수 전이다.
> 대상: main e3e0a6a0e 와 같은 내용의 강의 데이터(feat/lecture-learner-control 은 이 파일을 바꾸지 않음) · 강의 796 · cue 10,131 · 29회차.
> 공식 정답: DB `csat_items.answer`(2026-10-24 SELECT, `cue-audit/official-answers.txt`).

## 1. 전수 결정적 태깅(`cue-audit/cue-tag.mjs` → `deterministic.json`)

규칙: 대본은 TTS 용으로 선지 번호를 한글 수사(「이 번」 「삼 번」)로 쓴다. 「정답은 N 번」 · 「N 번이 정답」 의 N 이 **공식 정답과 같을 때만** 직접 공개로 센다(첫 실행은 오답 소거 문장의 「…답이 … 오 번」 을 공개로 오탐 — 감사 중 발견해 정정).

| 지표 | 값 |
|---|---|
| 정답 번호를 직접 말하는 강의 | **790 / 796** |
| 그 cue 의 위치 | 4번째 cue 398 · 5번째 329 · 6번째 59 · 1번째 3 · 7번째 1 (0부터 셀 때 3·4·5·0·6) |
| 그 cue 의 역할 | evidence 787 · intro 3 |
| 오답 4개 소거(`reject:N` 대상)로 정답이 확정되는 강의 | **796 / 796** |
| 소거 확정이 직접 낭독보다 먼저인 강의 | 6 (직접 낭독 패턴 없음: 2018#19 · 2023#45 · 2024#45 · M2109#19 · M2306#45 · M2409#45) |
| 직접 낭독 전에 정답 번호를 다른 문장에서 먼저 부르는 강의 | 118 |
| 직접 낭독 전에 어떤 선지 번호라도 부르는 강의 | 156 |
| 「정답」 구문인데 공식 정답과 다른 번호 | 0 |

## 2. 간접 암시 표본 판정(`cue-audit/chunks/*.out.json` · `sample-summary.json`)

표본: 유형 26종 층화 122강(유형별 강의 수 비례, 최소 3, id 정렬 균등 간격). 정답 공개 전 cue 432개를 서브에이전트 4개가 판정(입력·출력 cue 수 일치 4/4).
정의 — none: 답을 좁히지 않음 · hint: 답의 성질 · 방향 · 위치를 좁힘(학습자 판단은 남음) · decisive: 이 cue(앞 cue 포함)만으로 답이 정해짐.
판정 뒤 정정된 공개 경계로 다시 잘라 13 cue 를 제외했다(감사자가 「공개 전」 으로 받았으나 실제로는 직접 낭독 cue 였던 것 — 2017#23 · M1809#22 등. 감사자 보고의 「번호 불일치」 는 대본 오류가 아니라 이 경계 오류였고, DB 정답과 대본 번호는 일치).

| 지표 | 값 |
|---|---|
| cue 수준 | none 136 · hint 251 · decisive 45 |
| 강의 최고 수준 | none **6** · hint 73 · decisive **43** (/122) |
| 첫 암시 위치 | 1번째 cue 45 · 2번째 61 · 3번째 10 · 없음 6 |
| 역할별 | intro: none 80 · hint 83 · decisive 2 / strategy: none 26 · hint 90 · decisive 8 / structure: none 30 · hint 75 · decisive 26 / evidence: hint 3 · decisive 9 |

유형별 강의 최고 수준은 `sample-summary.json` 의 `by_type`. decisive 비율이 높은 유형(표본 수 작음, 경향만): R-INSERT 5/8 · R-NOTICE 5/9 · R-TITLE 4/5 · R-BLANK 5/17. X-계열(장문)은 hint 위주.
대표 사례(감사자 인용, 원본 미수정): 2026#27 c5 「이것이 답입니다」(공개 전) · M2509#28 c3 「정답은 표 아래 줄에」 · M2209#20 c4 「여섯 번째가 답을 줍니다」 · 2026#34 c1 「빈칸에 들어갈 말은 지문이 거부하는 견해」.

한계: 표본 판정은 서브에이전트 1인 판정(교차 판정 없음) · 일치율 미측정 · 표본 밖 674강은 결정적 지표만.

## 3. 설계 결론 — 결정 1(14) 에 대한 함의

1. **현 대본은 「정답을 보지 않는 경로」 를 지원하지 못한다.** 표본 122강 중 116강이 첫 1~2 cue 안에서 답을 좁히고, 전수 796강 모두 소거 순서로 답이 확정된다. cue 하나를 숨기는 방식으로는 충분하지 않다.
2. 공개 수준 태그는 **cue 단위 + 누적** 이어야 한다. 제안 스키마(데이터 파일 추가 키, DB 변경 없음):
   `disclosure: { level: 'none' | 'hint' | 'decisive' | 'answer', channels: ('speech' | 'target' | 'elimination_order')[], cumulative_decisive_at: number }`
   - `answer`: 정답 번호 직접 · `target analysis:answer`
   - `elimination_order`: 소거 cue 는 하나하나는 hint 지만 4번째에서 누적 decisive
3. 재생 정책(결정 1 R1~R4 에 맞춤 — 강제 순서 없음):
   - 학습자가 「정답 보기 전」 상태로 강의를 고르면, 첫 `hint` 이상 cue **직전에** 안내(「다음 구간부터 답을 좁혀요 — 계속 / 답 없이 볼 수 있는 곳까지만 / 멈춤」). 현 데이터로는 대부분 1~2번째 cue 앞이다.
   - 같은 공개 상태를 화면 강조(target) · 소거 표시 순서 · 역할 라벨 · ARIA 에도 적용(어느 하나만 막으면 나머지로 샌다).
   - 「답 없이 볼 수 있는 강의」 가 실제로 필요하면 기존 대본 재사용이 아니라 **새 대본 층**(관찰 · 관계 차례만)이 필요하다 — 내용 생성이라 원본 콘텐츠 승인 절차 대상.
4. 태깅 경로: 결정적 태그(`answer` · `elimination_order` · 번호 언급)는 스크립트로 전수, `hint/decisive` 는 드레인(export → 판정 → import, 재실행 안전) — 판정은 2인 이상 · 일치율 기준(0.85) 후 반영. 대본 JSON 에 키를 더하는 일은 원본 콘텐츠 변경이므로 사용자 승인 후.

## 4. 재현

```
node cue-audit/cue-tag.mjs <worktree>/apps/web/src/lib/csat/lecture-data cue-audit cue-audit/official-answers.txt
```
표본은 `node cue-audit/sample.mjs <lecture-data dir>`(같은 규칙을 파일로 옮긴 것). 주의: 판정에 쓴 청크는 **오탐 정정 전** 경계로 뽑았다 — 지금 다시 뽑으면 경계가 정정되어 일부 강의의 「공개 전 cue」 수가 다르다. 판정 결과는 정정 경계로 다시 잘라 집계했다(§2).
