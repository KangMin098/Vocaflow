# 브리프 — `/hub` 오늘 (S028)

> 생성 2026-09-18 · Claude Code · 근거: [카드](../cards/home/hub.md) · [판정](../verdict.md) · DB 질의(아래 표). §G3 발산의 **입력**이다 — 4안은 만들지 않았다.

## 목적 · 여정 위치
- JTBD: "앱을 열었을 때, 오늘 무엇을 해야 하는지 한 번에 알고 싶다, 그래서 바로 시작한다"
- **여정 ② 활성화 1·2단계**(가입 → `/hub` → 미진단이면 `/diagnostic`) + **여정 ③ 복습 루프의 출발점**. `screen_viewed` 400(표본 부족 — flows.md).

## 현재 골격 (판정: 평균)
- 첫 시선 = 왼쪽 남색 세로 막대가 달린 **단어 카드 1장** + 아이콘 박스·문단·빨간 CTA 유도 블록. 1280 에서 아래 약 25% 빈 공간.
- 선언 `@form 망각 — 밑줄 두께 3/2/1px` 이 **첫 시선의 표제어에 렌더되지 않는다**(검증 계정 단어 8개 — new 상태 분기일 수 있음, 데이터 있는 계정으로 재확인 필요).

## 자산 (2026-09-18 DB 실측)

| 자산 | 값 | 어디 |
|---|---|---|
| FSRS 상태 | `vocabularies` 2,249행 **전부** stability 보유(계정 3) | `stability · difficulty · last_review_at · next_review_at` |
| R(t) 계산 | 코드 | `lib/srs/fsrs.ts` |
| 7일 망각 곡선 | 코드 — 지금은 사이드바 곁가지 | 씨앗 **S1** `components/layout/MemorySparkline.tsx` |
| 밑줄 두께 | 코드 | 씨앗 **S2** `DecayUnderline` |
| 오늘 블록 | 코드 | `lib/learner/today-blocks.ts` |

## G1 축 후보 (둘 이상)
1. **망각** — 첫 시선이 **7일 감쇠 곡선**(S1 승격): "오늘 안 하면 목요일에 몇 단어가 흐려진다" 가 선으로. 오늘 할 일 = 곡선을 들어 올리는 행동.
2. **채색 지문** — 오늘 읽을 글(TodayReading)의 첫 문단이 **내 기억 상태로 칠해진 채** 첫 시선에(`vocabularies.text_id` 조인).
3. **환경 변형** — 허브 배경/판면 자체가 어제보다 차오른 서가(S8 계열).

## 서명 후보 (화면당 하나)
- 곡선 위 오늘 점을 누르면 "이 단어 N개를 보면" 곡선이 들어 올려지는 고스트 선 — 200ms(`--dur-normal`), 모션 7종 밖이면 §5.2 개정 먼저(G4).

## 제약
- Part 2: 학습 화면 모션 7종 · 4색은 형태로 쓰되 색 단독 정보 금지(두께·라벨 병행) · 44px · 다크.
- D7: 미진단 학습자의 1차 CTA 는 `/diagnostic` 유지 — 곡선은 **진단 전에도** 예시 학습자 곡선으로(렌즈 4, `lib/marketing/hero-demo.ts` 방식) 보여야 빈 상태가 전시장이 된다.

## 성공 지표
- 기존: `screen_viewed`(screen=hub) · `wayfinder_opened` · `wayfinder_cta_clicked`.
- **신설 필요**(D2 · D3 숫자/열거형만): `hub_curve_interacted { horizonDays: number }` · 허브 → 세션 시작 전환(파생 가능하면 수집하지 않는다 — D4).
