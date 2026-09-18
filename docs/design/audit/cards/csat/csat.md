# S019 `/csat` — 기출 홈 「다른 지문, 같은 설계」

> 생성 2026-09-18 · Claude Opus 5 (서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD: "기출을 공부할 때, 두 문항이 같은 출제 공식으로 묶이는 걸 먼저 보고 싶다, 그래서 오늘 해부할 3문항을 바로 시작한다"
- 주 사용자: 학생(수능 준비) · 인지 계층: 없음(학습 모듈 계층 밖, L5 인접 — 추정)

## 흐름
- 진입: 셸 사이드바 `sidebar-config.ts:313` · `/csat/formulas` 뒤로가기 `ProgressView.tsx:17` · 해부 닫기 `SessionFrame.tsx:58`
- 단계: 1. 패턴 버튼으로 A·B 비교 판면 전환 2. 정답/오답 노드를 눌러 관계 설명 3. 「오늘의 해부」 시작
- 완료 조건: `/csat/dissect?set=…` 로 이동(`SessionHome.tsx:47-53`)
- 1차 행동: 「시작」(`SessionHome.tsx:75`) · 보조: 하던 학습 이어가기(`:57`) · 실제 근거 확인(`:66`) · 자유 탐색 목록(`:93`)
- 나가는 길: `/csat/formulas`(`:56`,`:88`) · 패턴 지도 노드 `/csat/dissect?formula=`(`PatternMap.tsx:14`)

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | ○ | 비교 없음 `SessionHome.tsx:67` · 추천 없음 `:78` · 필터 빈 `:93` | ✗ `:67` 문장뿐 · △ `:78` 「다시 확인」(새로고침) · ✓ `:93` 전체 보기 |
| 로딩 | ○ | 기기 기록 대기 `aria-busy` `SessionHome.tsx:69,78` (비교 판면은 SSR 로 먼저 보임 `:41`) | — |
| 오류 | △ | 카탈로그 실패 시 throw `lib/csat/dissect-catalog.ts:30,33` → 루트 `app/error.tsx` 만. 화면 전용 없음 | ✗ |
| 부분 | ○ | PDF 부족 `SessionHome.tsx:77`(PaperDrop 접힘) · 이어하기 `:57` | — |
| 완료 | — | 홈 자체엔 완료 없음(해부 완료는 S061) | — |

## 자산
- N1 자산: CSAT 코퍼스(문장 길이·근거/오답 앵커·출제 공식) — 역할: **골격**. `QuestionArchitecture.tsx:27-34` 가 실제 문장 길이 막대(`:29`)와 근거→정답 실선·오답 점선(`:33-34`)을 그린다
- 형태 씨앗: S7 비교 판면(`PatternComparison.tsx:19-24`, 합류 `=` `:23`) · S5 관계 선 · S6 기록 지도(`PatternMap.tsx:20`, ○•✓↻)
- 학습과학 원칙: #1 Active Recall(예측 먼저) · #5 Context-Dependent(같은 공식, 다른 소재) · #6 Cognitive Load(두 문항만 `PatternComparison.tsx:15`)

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: 마스트헤드 + `opening` 2열(데스크톱 `1fr 248px`, `learning-home.module.css:78`) — 왼쪽 h1 + A·B 구조도 비교, 오른쪽 오늘의 해부
- 골격 판정(코드 추정): **G1 축 「주묵 문법」 — 이미 서명됨.** 구조도 SVG 는 CSAT 앵커 없이 못 그린다(N4 통과). 서명 = 두 구조도가 `=` 로 합류하는 판면(`PatternComparison.tsx:23-24`)
- 단, `page.tsx:1-7` 에 `// @form:` 선언이 없다(기준선 화면이라 라쳇 통과 — 추정). 모바일에선 1열로 쌓여 구조도가 h1 아래로 밀린다(`learning-home.module.css:15,65`)
- 평균 신호(정적, 자기 트리): 0 — 8종 모두 0

## 근거
- `apps/web/src/app/(main)/csat/page.tsx:7` — SSR 카탈로그 → SessionHome
- `apps/web/src/components/csat/session/SessionHome.tsx:59-79` — 비교 증명 + 오늘의 해부 두 칸
- `apps/web/src/components/csat/session/QuestionArchitecture.tsx:22-38` — 막대 길이=문장 길이, 실선/점선 관계
- `apps/web/src/components/csat/session/visual-analysis.module.css:22-23` — `--ju` 실선 · `--t2` 점선(F2) · 범례 `PatternComparison.tsx:26` 「막대 길이 = 실제 문장 길이」
