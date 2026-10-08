# 영역 감사 — 목표 · 전략 · 결정 이력 (raw)

> 기준: `D:\workspace\Vocaflow-platform-audit` HEAD `a7c986469`(origin/main) · 작성 2026-10-09 · 읽기 전용 감사.
> 문서 수치는 근거로 쓰지 않았다(AGENTS 규칙). 코드 존재 여부는 이 워크트리에서 `ls`/`grep` 으로만 확인했다. DB 질의는 이 영역에서 하지 않았다.

---

## 1. 목표 진술 연대표

| 일자 | 출처 | 진술 | 지금 유효? |
|---|---|---|---|
| (v06.2, 날짜 없음 · 2026-05 이전 추정) | `docs/00_project_brief.md` | 「영어 원문 기반 종합 학습 웹 + 앱」, 타겟 고등학생~성인, **모듈 7종**, Node+Express 백엔드, Zustand, React Query, OpenAI gpt-4o-mini·TTS-1, Railway API | **낡음** — 모듈 9+(아케이드 19종 별도), Express 없음, 런타임 LLM 0, TTS 는 브라우저 `speechSynthesis`(PLATFORM_AUDIT §6-2). 문서가 "모든 세션에서 가장 먼저 읽는 파일" 이라고 자칭 |
| 2026-05-29 | `docs/adr/0001` | 사전 파생어 보강 정책 Accepted | 유효(기술) |
| 2026-05-29 | `docs/adr/0002` | Rescue-first 노이즈 정책 **Proposed — 승인 대기** | 미결 상태로 4개월 방치(ADR 0004 가 "같은 결함을 진단했으나 미적용" 이라 기록) |
| 2026-06-01 | `docs/adr/0003` | 고전 리텔링 work-edition — PoC 가 전제 반증, "전권 리텔링 보류" | 사실상 폐기(아래 §2 고전 PD 퇴출) |
| 2026-06-08 | `docs/PROJECT.md` | 미션: 「스크립트를 만나고·이해·부호화·재인·생성·정복까지 전 과정을 하나의 플로우로」 · 9 모듈 한 사이클 · 타겟 고교~성인, **입시·TOEFL/TOEIC/IELTS·비즈니스·학술·교양 다목적** · 사용자 Phase1 0명 → Phase2 베타 30명 → Phase3 출시 | 미션 문장은 유효로 인용되나 **타겟 범위는 2026-06-28 결정과 충돌**. "현재 0명", "v06.34 시점" 등 수치 낡음 |
| 2026-06-08 | `docs/LEARNING_MODEL.md` v3.2 | 7축 구조(흐름 L0~L7 · 상태 · 추천 자율70/제안30 · FSRS · SDT · 인지 · 데이터) | 유효(정본). 추천 70/30 은 구현 확인 못 함 |
| 2026-06-08 | AGENTS.md 자동화 정책 | 문서 동반 갱신 · Admin 화면도움말 · Git · 분기 진단 standing authorization | 유효 |
| 2026-06-28 | `docs/LEARNER_MANAGEMENT.md` | **타겟 결정: 한국 수능생 단일 집중** + L3 교사/학원 B2B 로드맵(데이터 모델 선반영, 화면 Phase 2) · 비게임화 = 시장 포지션 · 수능 D-day 역산(`learning_goals`) **폐기** → 자료×활동 계획(`/plan`) | 수능 집중은 이후 CSAT 작업량으로 사실상 유효. "비게임화" 는 아케이드 19종과 충돌(§3) |
| 2026-06-28 | `docs/VOCAB_LAYERS.md` | Cold/Warm/Hot 계층 통합 완료 | 유효 |
| 2026-08-09 / 08-22 | `docs/DESIGN_DECISIONS.md` ADR-004/005 | AA 미달 글자 0 하한 고정 | 유효(가드) |
| 2026-08-10 | `docs/adr/0004` | 도서 어휘 선정 v2 — D4·D5 미적용 | 부분 |
| 2026-08-12 | `docs/adr/0005` | `select_book_chapter_vocab` 성능 — Proposed(적용 대기) | 미결 |
| 2026-08-12 | `docs/LEARNING_FRAMEWORK.md` | Phase 0 축·이름 고정, "아직 어떤 화면도 import 하지 않음", Phase 1 = 정직성 복구 | Phase 1 진행 기록 없음 |
| 2026-08-14 | `docs/adr/0006` | 셸 재설계 — 사이드바 16→6 미적용 | DD-68 에서 사이드바 자체 삭제(상단 막대)로 대체 |
| 2026-08-15 | `docs/adr/0007` | **PDCP(Vintage Comics) 트랙 전체 제거 — Accepted, 실행 대기** | 결정 유효, **실행 안 됨**(§4) |
| 2026-08-16 | `docs/PLATFORM_AUDIT.md` §0·§6 | 목표 규모 **10만 학습자**, 실패 모드 = 「공급망 비대 / 수요 검증 0」, 10만은 **교사 3,500 × 학급 30(CAC 0)** 으로만 도달 · 학습자 표면 22 → 목표 4 · 공급:수요 비 개선 안 되면 그 분기 실패 | 유효(상시 지침) |
| 2026-08-16~08-30 | PLATFORM_AUDIT §8 | F1 수요 검증 0 · F2 모바일 부재(D7 검증 **후** 앱) · F3 콘텐츠–시장 부적합 · F4 계측(해소) · F5 표면 22→4 · F6 발행률(재정의: published≥60 **이면서 절반 이상 V6–8 논설·설명문**) · F7 문서 드리프트(해소) · F8 학급 껍데기(해소) · F9 가격표가 없는 제품 판매(신규 08-29) | F1·F2·F3·F5·F6 미해소 유효. F9 는 코드상 해소(`PricingClient.tsx` 「지금은 전부 무료 · 결제 기능 없음」)인데 §8 표에 해소 표시 없음 |
| 2026-08-17 | PLATFORM_AUDIT §8 F3 진행 | BYO 축(TextFit `/fit`) — 공급이 아니라 **처리**로 내신 해결, 남은 것 교사 10명 검증 | 유효, 교사 10명 검증 기록 없음 |
| 2026-08-29 | PLATFORM_AUDIT §6-2 | 변동비 ≈ 0(런타임 LLM 0) → 낮은 ARPU 견딤, Pro ₩9,900 ARPU 로 연매출 0.6~2.1억 | **ARPU 전제가 무너짐**(가격 화면이 유료 플랜을 「준비 중」으로 내림) |
| 2026-09-16 | `docs/factory-audit/03-report.md` | 교재 공장 공정판 4/8 → 5/8, 결정 필요 10개(커버리지 목표 "시중 22 시리즈를 다 덮는가" 등) | 이후 DD-69~77 로 확장 |
| 2026-09-17 | `docs/csat-learner-brief.md` | /csat 목적 = 「풀기」가 아니라 **출제자 읽기**(예측→대조), 12분 루프, 지표 = 예측 적중률·함정 커버리지·공식 수 | 유효로 보이나 이후 해설 극장·원본 문제지 등으로 변형(csat-learner/DECISIONS 2026-09-23~10-01) |
| 2026-09-17 | `docs/dual-agent-brief.md` | Claude+Codex 병행, AGENTS.md 단일 출처 ≤200줄 | 유효 |
| 2026-09-18 | `docs/design/DECISIONS.md` DD-01·02·12 | 「목표는 오직 혁신적 디자인, **평균은 절대 안 됨**」 · Admin 액센트 Deep Ink · 보라 금지 · 평균 금지를 테스트로 강제 | DD-65/66/82 로 대부분 뒤집힘 |
| 2026-09-19 | `docs/methodology/README.md` | 영어교육 방법론 지식층 1단계 | → SYSTEM(09-28) → VNEXT(10-08) 로 확장 |
| 2026-09-20 | DD-58 | Admin 골격 「정오표」 | DD-82 로 대체 |
| 2026-09-20 | DD-60 · T6 | 밴드 정책 (b) 폐기 · 적격/적합 분리를 T6 부채로 | 유효(T6 해소 조건 = V6+ 학습자 발생) |
| 2026-09-20 | DD-62 | 「실물 우선」 — 화면이 먼저, 문서 동결 | 유효. `DESIGN.md` 맨 위 「[동결] 수정 금지」 |
| 2026-09-21 | DD-64~68 | 제약·금지 전부 삭제 → Tines 「가장 닮음」 | 유효 |
| 2026-09-23 | DD-69~77 | 교재 공장 7/22 → 22/22 · 라이선스는 탈락 기준 아님(DD-75) · 시리즈 품목 층(DD-76) · ⑨ 운영·개정(DD-77) | 유효 |
| 2026-09-24 | DD-81 | V6+ 상한 B2 → C1, DD-60 근거 정정 | 유효 |
| 2026-09-24 | DD-82 · CHANGELOG | `/admin` = `neon-currant.3b.dev`(3B) 스타일, 보라 0 | 유효 |
| 2026-09-24 | CHANGELOG | **고전 PD 도서 지문 원천 퇴출** — `gutenberg` 40,519행 삭제 | 유효 |
| 2026-09-28 | `docs/methodology/SYSTEM.md` | 「영어 학습의 본질·원리를 꿰뚫는 플랫폼」 — 5층 지식 등록부 | 유효 |
| 2026-10-01 | CHANGELOG · csat-learner/DECISIONS | 학평을 기출 분석 전체에 · 영어 진단 MVP(기록만으로 진단) | 유효 |
| 2026-10-08 | `docs/methodology/VNEXT_ARCHITECTURE.md` | 목표 순환 「탐구→출처→주장→원리→방법→학습자 적용→효과 검증→재평가」, 성공 기준 = 원리가 학습 행동을 결정 | 유효(Phase 2 스키마 적용) |
| (메모리·현 브랜치만) 2026-10-03 | 메인 작업트리 `design/replica-first` 의 AGENTS.md | `/csat`·`/admin` = 3B 앱, 그 외 = tines.com · **디자인 대상 PC 웹만, 모바일 제외** | **origin/main 에 없음** — main 의 AGENTS.md 9행은 여전히 「모바일(Expo, Phase 2)」, `docs/design/reference-scope.md` 부재 |

---

## 2. 명시적 번복 · 삭제

| 일자 | 결정 | 번복 대상 | 출처 |
|---|---|---|---|
| 2026-06-28 | 수능 D-day 역산 `learning_goals` 폐기(0 rows DROP) · 전역 `study_plan_schedule`·시간(분) 폐기 | 초기 목표 관리 설계 | LEARNER_MANAGEMENT §1·§2 |
| 2026-06-28 | 타겟 「수능생 단일 집중」 | PROJECT.md 의 다목적 타겟(TOEFL·비즈니스·학술) | LEARNER_MANAGEMENT 머리 |
| 2026-08-14 | `/my` 폐지 · FlowNav 삭제 | 기존 셸 | ADR 0006 |
| 2026-08-15 | PDCP Vintage Comics 전체 제거 | 만화 PD 트랙 | ADR 0007 (미실행) |
| 2026-08-16 | 학습자 표면 22 → 4(삭제 아닌 플래그 off) | 모듈 확장 방향 | PLATFORM_AUDIT F5 |
| 2026-08-16 | 모바일 = D7 검증 **후** 착수(순서 역전 금지) | PROJECT 의 Phase 2 Expo | PLATFORM_AUDIT F2 |
| 2026-08-17 | F6 `published ≥ 60` → 문종 조건 추가 | 숫자 목표 | PLATFORM_AUDIT §8-1 |
| 2026-08-17 | 10만 = 교사 3,500 × 학급 30 (광고 불가) · F8 학급 기구 보강 | B2C 획득 가정 | PLATFORM_AUDIT §6·F8 |
| 2026-08-26~29 | `/pricing` 하드코딩 신뢰 수치 → DB 조회 · 유료 플랜/14일 체험/환불 약속 철회 → 「전부 무료 · 준비 중」 | 가격표(F9) | `pricing/page.tsx` · `PricingClient.tsx` 주석 |
| 2026-09-18 | 외부 취향 스킬 13 → 2 + dataviz | | DD-05 |
| 2026-09-20 | DD-60 (b) CSAT 유형별 상한 폐기 | | DD-60 |
| 2026-09-21 | **DD-65** 제약 4종(6px 모서리·그림자 금지·glass 금지·무한 모션 금지)+제약 스킬 삭제 | DD-03·DD-06·DD-12 계열 | design/DECISIONS · ADR-007 |
| 2026-09-21 | **DD-66** 디자인·UX 금지·제한 전부 삭제(Calm UI 금지 · I1–I4·I6·I8 · D1·D4·D5 · 모션 예산) | DD-01·02·12, `activation-path` 회귀 | design/DECISIONS · AGENTS.md |
| 2026-09-21 | DD-67 코드로 걸린 디자인 제한 해제 | | |
| 2026-09-21 | DD-68 Tines 「가장 닮음」 | DD-24 「Tines 보라·파스텔 미채용, 주묵 단일 액센트」 · DD-30 「원고지」 | |
| 2026-09-24 | DD-81 V6+ 상한 B2 → C1 | DD-60 근거 | |
| 2026-09-24 | **DD-82 관리자 = 3B 앱** | DD-01(Deep Ink) · DD-55(주묵 도장) · DD-58(정오표) | CHANGELOG 187행 |
| 2026-09-24 | **고전 PD 도서 퇴출**(gutenberg 40,519행 삭제) | ADR 0003 고전 리텔링, F6 의 도서 발행 축 | CHANGELOG 204행 · 메모리 `project-classic-pd-books-retired` |
| 2026-09-23 | DD-75 라이선스는 탈락 기준 아님 | DD-71 원천 정책 대기안 | |
| (현 브랜치) 2026-10-03 | 관리자 3B 복귀 재확인 · **모바일 대상 제외(PC 웹만)** · 옛 「모바일 퍼스트/390px」 지침 무효 | AGENTS I7 「390px」 근거 · main AGENTS 「모바일 Phase 2」 | design/replica-first 브랜치(미머지) |

※ 「DD-」 커밋은 152건(git log --grep). design/DECISIONS 의 DD 번호는 DD-01~82(72 결번). DD-71·72 는 커밋 메시지와 문서 번호가 다르다(커밋 "DD 번호 충돌 정리 — 내 DD-71·72 → DD-73·74") — 커밋 로그의 DD-71/72/73/76 일부가 문서의 다른 결정을 가리킨다(예: 2026-09-24 "앱 스킨 토큰 (DD-76 1단계)" 은 문서상 DD-82).

---

## 3. 현재 유효한 목표 사이의 충돌

| # | 충돌 | 양쪽 근거 | 실측 |
|---|---|---|---|
| C1 | **수능 단일 집중 vs 9 모듈 범용 플랫폼** | LEARNER_MANAGEMENT 「수능생 단일 집중」 ↔ AGENTS.md 1행 「9 모듈 학습 플랫폼 · 고등학생~성인」 · PROJECT.md 다목적 타겟 | `(main)` 하위 디렉터리 24, 페이지 194. 아케이드·만화·스펠포지 등 수능과 무관한 표면 다수 |
| C2 | **공급 확장 vs 「공급망 비대」 진단** | PLATFORM_AUDIT §0(실패 모드 공급 비대, 공급:수요 비 개선 안 되면 실패) ↔ DD-74~77 교재 공장 22/22 · DD-76 「시리즈는 끝나지 않음」 · ⑨ 운영·개정 · methodology vNext · 학평 전면 적용 | 진단 이후 기록된 큰 결정 대부분이 공급 쪽. AGENTS DB 통계(2026-10-05) 가입자 4 · 학급 구성원 0 |
| C3 | **B2B 교사 채널(10만의 유일 경로) vs 학급 사용 0** | PLATFORM_AUDIT §6 · F8 해소 ↔ AGENTS 통계 학급 1 · 구성원 0 · 과제 0 | 화면은 있음(`(main)/teacher/page.tsx`, `(marketing)/join`, `class_members` 비테스트 참조 7파일). F3 해소 조건 「교사 10명 검증」 기록 없음 |
| C4 | **가격 산술 vs 가격 화면** | PLATFORM_AUDIT §6 · §6-2 ARPU = Pro ₩9,900, 연매출 0.6~2.1억 ↔ `PricingClient.tsx` 「유료 플랜 아직 없음 · 준비 중 · 가격도 날짜도 적지 않는다」 | 결제 PG 코드 0(`toss/portone/iamport/stripe` grep — 결제 의미 히트 0). 산술 모델이 존재하지 않는 가격으로 계산 중. F9 는 §8 에 미해소 표기 |
| C5 | **비게임화 포지션 vs 아케이드 19종** | LEARNER_MANAGEMENT §0 「게임화 금지는 시장 포지션」 ↔ MODULES.md 아케이드 19종 · `/arcade/ranking` | 둘 다 현행 문서 |
| C6 | **표면 4개 목표 vs 표면 증가** | F5 목표 4 ↔ 기준선 22 → 현재 `(main)` 디렉터리 24(+ `(app)/csat`·`(app)/play`) | 악화. F5 는 "새 모듈 추가 시 재진단" 트리거인데 아케이드·만화·플랜 추가 때 진단 기록 없음 |
| C7 | **모바일 범위** | main AGENTS 「모바일(Expo, Phase 2)」 · 공개 규칙 I7 「390px」 · PLATFORM_AUDIT F2 「D7 후 앱」 ↔ 현 브랜치·메모리 「PC 웹만, 모바일 제외」 | `apps/mobile` 파일 12개(기획). main 과 작업 브랜치가 서로 다른 범위를 말한다 |
| C8 | **디자인 방향 3중** | main `DESIGN.md`(동결 · 주묵·Deep Ink·Hahmlet·모서리 2–6px) ↔ DD-68 Tines(Figtree·Petrona·`#714bd0`) ↔ DD-82 Admin 3B(Inter) | DESIGN.md 는 「수정 금지」로 동결돼 낡은 값을 정본처럼 보여 준다. main AGENTS 53행은 「서체 Hahmlet · Lora」 |
| C9 | **원리 지식층 「효과 검증」 vs 학습자 0** | VNEXT 성공 기준 = 학습 결과가 원리를 재평가 ↔ 실제 학습자 없음(메모리 「합성 학습자로 진행」) | 효과 검증 루프는 구조상 데이터를 받을 수 없음 |
| C10 | **분기 진단 일정** | AGENTS ④ 「다음 2026-10」 · PLATFORM_AUDIT 「다음 2026-10 첫 주」 | 오늘 2026-10-09, §7 표는 2회차(08-29)까지. 3회차 미기록 |

---

## 4. 구현 없는 목표 / 목표 없는 코드

### 4-1. 목표는 있는데 코드가 없거나 반대

| 목표 | 출처 | 확인 |
|---|---|---|
| PDCP 전체 제거 | ADR 0007(Accepted 2026-08-15) | `(main)/comics/restored/`(page + `[slug]`) · `admin/pd-comics/` 그대로 존재 |
| 학습자 표면 4개(플래그 off) | F5 | 24개 디렉터리 |
| 결제·유료 플랜 | PLATFORM_AUDIT §6 ARPU | PG 코드 0 · `user_profiles` plan 컬럼 마이그레이션 없음 |
| Railway worker · EAS 빌드 · Express API | 00_project_brief · PROJECT 배포 표 | 저장소에 없음 |
| Mobile Expo 실구현 | PROJECT Phase 2 · AGENTS | `apps/mobile` 12파일 |
| Learning Framework 배선(Phase 1) | LEARNING_FRAMEWORK | 문서가 「아무 화면도 import 하지 않음」 — Phase 1 기록 없음(추가 grep 필요) |
| 추천 자율 70 / 제안 30 | LEARNING_MODEL [3] | 구현 위치 못 찾음 |
| 원리 등록부가 학습 행동을 결정 | VNEXT | VNEXT 문서는 「학습자 코드에서 읽기 0」이라 적었으나 main 에는 이미 `csat/item/[slug]` · `PrinciplePanel` · `CohesionPanel` · `/api/csat/item/[slug]/task` 가 읽음 — **문서가 코드보다 낡음**(반대 방향 드리프트) |
| ADR 0002 · 0005 | Proposed | 미적용 상태로 방치 |
| 교사 10명 검증 · 외부 학습자 30명 | F1 · F3 | 기록 없음 |

### 4-2. 코드는 있는데 진술된 목표가 없음(또는 진단과 충돌)

- `(main)/arcade` · `(app)/play` — 게임 19종: MODULES 에 구현 설명만 있고, 미션·F5·비게임화 포지션 어느 쪽에도 근거 없음.
- `(main)/comics/adapted` · `admin/comic` — CCP 만화: ADR 0007 이 "유지" 라고만 함, 수요 목표 없음(발행 `comic_books` 1).
- `packages/video-factory` · `admin/video` · `(marketing)/video` — 영상 공장: VIDEO_FACTORY 문서 외 전략 목표 없음.
- `(main)/hub-lab` · `admin/topic-corpus` · `admin/vrl` · VCB 계열 — 공급 파이프라인, F1·C2 와 긴장.
- `admin/billing` — PLATFORM_AUDIT §4 에서 하드코딩 MRR 적발 대상. 결제가 없는데 화면이 존재.
- 교재 공장(`/admin/csat/*` 12칸, DD-69~77) — 목표는 「공장 점수 22/22」라는 내부 지표뿐, 학습자 도달 지표와 연결 안 됨.

---

## 5. 메모

- 정본 문서 간 날짜 축이 다르다: PROJECT/LEARNING_MODEL 은 v06.34(2026-06-08) 고정, CHANGELOG Unreleased 는 3만 줄. 「v06.34 → next」 가 4개월째.
- `docs/00_project_brief.md` 는 스스로 "모든 세션에서 가장 먼저 읽는 파일" 이라 하나 가장 낡은 문서다 — 퇴역 표시 또는 삭제 후보.
- 디자인 범위 결정(2026-10-03)은 메인 작업트리 브랜치에만 있어, origin/main 기준 감사에서는 「현행 규칙」으로 볼 수 없다.
