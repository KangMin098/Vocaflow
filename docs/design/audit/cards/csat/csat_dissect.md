# S061 `/csat/dissect` — 기출 해부 (예측 → 대조 → 전이)

> 생성 2026-09-18 · Claude Opus 5 (서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD: "정답을 이미 알 때, 출제자가 근거·함정·의도를 어디에 심었는지 먼저 예측하고 대조하고 싶다, 그래서 공식 한 줄을 내 것으로 남긴다"
- 주 사용자: 학생 · 인지 계층: 없음(세션 표면, 셸 풀스크린 `SessionFrame.tsx:58`)

## 흐름
- 진입: S019 시작/문항/패턴 링크 `SessionHome.tsx:22,24` · `PatternMap.tsx:14,20` · S020 `ProgressView.tsx:19`
- 단계: 1. 훑기(scan) 2. 근거 문장 예측→대조 3. 오답 제조법 예측→대조 4. 의도 예측→대조 5. 설계도 → 공식 한 줄 (`ItemScreen.tsx:19,108-112`) · 2번째 뒤 두 문항 비교(`SessionRunner.tsx:68`) · 3번째 = 전이
- 완료 조건: 3문항 소진 → 완료 화면(`SessionRunner.tsx:72`)
- 1차 행동: 단계별 먹색 주 버튼 하나(`ItemScreen.tsx:108-112`, D10) · 보조: 「분석 바로 읽고 듣기」(`SessionRunner.tsx:84`) · 다른 문항 보기(`:81`)
- 나가는 길: 학습 허브 `/csat`(`SessionRunner.tsx:79`) · 닫기(`SessionFrame.tsx:58`) · 패턴 이력 링크(`AnalysisWorkbench.tsx:51`)

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | ○ | 문항 없음 `SessionRunner.tsx:67` · PDF 없음 → PaperDrop `:89` | ✓ 「홈으로」 · ✓ 문제지 놓기 |
| 로딩 | ○ | 「해부할 문항을 여는 중…」 `SessionRunner.tsx:66` · 「문제지를 여는 중…」 `:89` | — |
| 오류 | ○ | 문장 위치 실패 `ItemScreen.tsx:61-66` · 기기 저장 막힘 `SessionRunner.tsx:88` · 카탈로그 throw → 루트 error | ✓ 「문제지 다시 놓기」 · △ 저장 막힘은 안내만 |
| 부분 | ○ | 이어하기 `SessionRunner.tsx:37-40` · 분석 먼저 읽은 문항은 통계 제외 `:87` · 초안 복구 `ItemScreen.tsx:19` | — |
| 완료 | ○ | 예측 적중·공식 +n·새 계열 `SessionRunner.tsx:72` | ✓ 홈으로 · 한 유형 더 |

## 자산
- N1 자산: CSAT 코퍼스(근거 앵커·오답 계열·공식) + 학습자 기기의 평가원 PDF reflow — 역할: 예측 흐름에선 **칩·밑줄**, 분석 읽기에선 **골격**(`AnalysisWorkbench.tsx:37-42` 원문 ↔ 구조도)
- 형태 씨앗: S5 관계 선(분석 읽기 모드만) · 예측 흐름엔 씨앗 없음
- 학습과학 원칙: #1 Active Recall(예측 먼저) · #3 Desirable Difficulty(전이 문항) · #2 Spaced(전이 큐 `SessionRunner.tsx:75`)

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트(추천 세션): 위치 nav(`SessionRunner.tsx:78-86`) + 「정답을 알고, 지문을 봅니다.」 + 발문 + 지문 산문(`ItemScreen.tsx:70-77`). 첫 방문 기기는 PDF 가 없어 PaperDrop 이 첫 시선(추정, `SessionRunner.tsx:89`)
- 골격 판정(코드 추정): **산문(지문) + 선지 목록** — 시험지 사물에 가깝지만 G1 선언 없음. 주묵 구조도는 「분석 바로 읽고 듣기」 뒤에만
- 대조 밑줄이 `--t1` 2px(`session.module.css:49`) — DECISIONS D10 「주묵은 근거 밑줄에만」과 어긋남(재설계 중 바뀐 것 — 추정)
- 평균 신호(정적, 자기 트리): 0

## 근거
- `apps/web/src/app/(main)/csat/dissect/page.tsx:8-12` — set/formula/item/resume 파라미터
- `apps/web/src/components/csat/session/ItemScreen.tsx:59,70` — 단계별 질문 문구
- `apps/web/src/components/csat/session/AnalysisWorkbench.tsx:42` — QuestionArchitecture 재사용
