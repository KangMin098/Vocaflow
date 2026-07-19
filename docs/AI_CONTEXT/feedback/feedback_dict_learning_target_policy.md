> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/feedback_dict_learning_target_policy.md
> category: feedback

---

사용자 명시 지침(2026-07-19, CLAUDE.md §"📚 어휘 관리 원칙"에도 기재):

**1. 사전 DB 보완의 목적 = 학습 대상 누락 방지.** 파생형·굴절형(annoyingly·steepness·went·children)이 **학습 대상에서 누락되지 않도록** 사전을 보완한다. base가 사전에 있는 파생/굴절 표면형은 학습 대상으로 등재·연결(ADR 0001 Phase 6 = [[project_etymology_root_axis]] 인접 트랙).

**2. 추출되는 실단어는 전부 사전 DB에 존재해야 한다 — "실단어 미등재"는 줄여야 할 상태(결함 아님이지만 목표는 축소).** 독서 중 추출되는 단어는 학습 대상이 아니어도 **사전에 등재(뜻 포함)** 해 추출·조회되게 한다. 어휘 **이원 관리**:
- **학습 대상** = 일반 학습 어휘(파생·굴절 포함) → SRS 학습.
- **비학습 대상 = 독서 지원용** = 도서 특유 희귀어(항해 전문어 marlinspike·keelhaul, 방언 철자 babby·seein, 희귀 복합 afterdeck) → 사전에 등재하되 **학습 대상 제외**(SRS 미포함). 단어장엔 "독서 지원용" 비학습으로 보존.

**Why**: (a) 파생/굴절형을 안 넣으면 학습자가 실제 텍스트의 그 형태를 학습 못 함. (b) 전문어/방언을 미등재로 버리면 독서 중 뜻 조회 불가 → 리더 경험 저하. 추출 자체는 되게 하고 학습 여부만 구분하는 게 맞음.

**How to apply**: 추출→미등재 실단어가 나오면 "정상"으로 넘기지 말고 **사전 등재 대상**으로 본다(파생/굴절=학습, 전문어/방언/희귀복합=독서지원 비학습). 학습/비학습 구분은 **별도 플래그**(신설 필요 — v_level·register 재활용 or 신규 컬럼). Treasure Island 추출 사례가 계기: 파생형 annoyingly·steepness(base 사전有→학습대상) vs 항해어 marlinspike(독서지원 비학습). 관련 진행: 굴절 headword화(inflection-seed·[[project_dict_wave_plan_w0]] 인접), 도서사전 [[project_book_dict_registration_process]].

