# GOAL_DECISION_HISTORY — 목표·전략 결정 이력과 충돌

> 기준 a7c986469 · 2026-10-09 · 전체 연대표(35행)·번복표 원문: [_raw/area-goals.md](./_raw/area-goals.md)
> 문서 진술은 「언제 누가 무엇을 목표로 적었는가」의 근거로만 쓰고, 수치는 DB 로 다시 쟀다.

## 1. 목표 진술의 다섯 시대

| 시기 | 지배적 목표 | 대표 출처 |
|---|---|---|
| ~2026-05 | 영어 원문 기반 종합 학습 웹+앱, 모듈 7종, OpenAI TTS·LLM 런타임 | `docs/00_project_brief.md` (**낡았는데 「가장 먼저 읽는 파일」이라 자칭**) |
| 2026-06 | **9 모듈 단일 사이클 · 다목적 타겟**(입시·TOEFL·비즈니스·학술) · 학습 과학 7 · FSRS | `docs/PROJECT.md` · `LEARNING_MODEL.md` v3.2 |
| 2026-06-28 | **타겟을 한국 수능생 단일 집중**으로 좁힘 · 비게임화 = 시장 포지션 · 교사 B2B 로드맵 | `docs/LEARNER_MANAGEMENT.md` |
| 2026-08-16~29 | **10만 학습자 · 교사 3,500 × 학급 30(CAC 0)** · 실패 모드 「공급망 비대 / 수요 검증 0」 · 표면 22→4 · 모바일은 D7 뒤 | `docs/PLATFORM_AUDIT.md` §0·§6·§8 |
| 2026-09-17~10-08 | CSAT「출제자 읽기」 · 교재 공장 22/22 · 학평 전면 · **원리가 학습 행동을 결정**(methodology vNext) · 디자인 3B/Tines | `csat-learner-brief` · `design/DECISIONS` DD-01~82 · `methodology/VNEXT_ARCHITECTURE.md` |

## 2. 명시적 번복 (요약)

- 2026-06-28: 수능 D-day 역산(`learning_goals`) 폐기 · 타겟 다목적 → 수능 집중.
- 2026-08-14~15: `/my`·FlowNav 폐지(ADR 0006) · **PDCP 전체 제거(ADR 0007 Accepted — 아직 실행 안 됨)**.
- 2026-08-16: 학습자 표면 22→4 · 모바일 = D7 검증 후.
- 2026-08-17: F6 목표에 문종 조건(V6–8 논설·설명문)을 붙임.
- 2026-08-26~29: `/pricing` 유료 플랜·체험 약속 철회(F9).
- 2026-09-18~24: DD-01·02·12 「혁신 디자인·평균 금지」 → DD-65(제약 삭제) · DD-66(금지 전부 삭제) · DD-68(Tines 「가장 닮음」) · DD-82(관리자 3B).
- 2026-09-24: 고전 PD 도서 원천 퇴출(gutenberg 40,519행 삭제).
- 2026-10-03(**main 에 없음**): 디자인 대상 PC 웹만·모바일 제외 · 3B/Tines 범위 — `design/replica-first` 브랜치에만 있다. main 의 AGENTS.md 는 아직 「모바일(Expo, Phase 2)」.

## 3. 현재 유효한 목표끼리의 충돌

| ID | 충돌 | 실측 근거 |
|---|---|---|
| C1 | **수능 단일 집중** vs **9 모듈·고교~성인 범용** | 학습자 page 194 · 아케이드 21종 기록 · CSAT 이벤트가 상위 |
| C2 | **「공급 비대」 진단** vs 이후 결정 대부분이 공급 확장 | 커밋 scope 상위 csat 652 · textbook 570 · DB 공급 수십만~백만 행 vs 학습자 4 |
| C3 | **교사 채널이 10만의 유일 경로** vs 채널 실사용 0 | classes 1 · members 0 · assignments 0 · 교사 10명 검증 기록 없음 |
| C4 | 산술 모델 ARPU ₩9,900 vs 「전부 무료 · 결제 없음」 | 결제 테이블 0 · F9 는 코드상 해소인데 §8 미갱신 |
| C5 | 비게임화 포지션 vs 아케이드 19종 + 3D (Game Lab 은 MODULES.md 에 목적이 있으나 포지션 문서와 화해되지 않음) | learning_records 상위가 ghost-race · cascade |
| C6 | 표면 목표 4개 vs 실제 22개 이상 | page 194(리다이렉트 9 포함) · 재진단 기록 없음 |
| C7 | 모바일 범위를 main 과 작업 브랜치가 다르게 말함 | main AGENTS.md vs replica-first AGENTS.md |
| C8 | 디자인 정본 셋(동결 DESIGN.md · Tines · 관리자 3B) | `DESIGN.md` 「[동결]」 · DD-68 · DD-82 |
| C9 | 원리 효과 검증 루프 vs 실제 학습자 0 | methodology_* 8/10 0행 · 효과 측정 표본 없음 |
| C10 | 분기 진단 3회차(2026-10 첫 주) 미기록 | PLATFORM_AUDIT §7 마지막 행 2026-08-29 |

## 4. 목표 ↔ 코드 대조

- **목표는 있는데 코드가 없거나 반대**: ADR 0007 은 PDCP 제거인데 `/comics/restored`·`admin/pd-comics`·`/api/pdcp` 22개가 남아 있다 · 결제·plan 컬럼 없음 · `apps/mobile` 12파일 · Railway/Express/EAS 없음 · 추천 자율70/제안30 구현 위치 미발견 · LEARNING_FRAMEWORK Phase 1 기록 없음 · ADR 0002·0005 Proposed 방치.
- **상위 전략과의 관계가 미정이거나 성과 지표가 없는 코드**: 아케이드/play(목적·계층·소비 경로는 `docs/MODULES.md` Game Lab 절에 있으나 「비게임화 포지션」과의 관계 미정) · CCP 만화 · 영상 팩토리 · `admin/billing` · 교재 공장(내부 점수만 있고 학습자 도달 지표 없음) · hub-lab · VRL·VCB 대형 공급.
- **반대 방향 드리프트**: VNEXT 문서는 「학습자 코드가 등록부를 읽는 곳 0」이라 하지만, main 에서 `csat/item` PrinciplePanel·CohesionPanel 이 이미 읽는다.
