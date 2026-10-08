# PLATFORM_GAP_ANALYSIS — 빈틈·중복·미완성

> 2026-10-09 · 기준 a7c986469 · 각 항목 근거는 해당 영역 문서와 `_raw/`.
> 이 문서는 **측정**까지만 한다. 고치기는 STEP 2 이후다(PLATFORM_AUDIT §0: 같은 턴에 고치면 측정이 오염된다).

## 1. 심각도 순 빈틈

| # | 빈틈 | 영향 | 근거 | 연결 목표 |
|---|---|---|---|---|
| P0-1 | **등록 학습자 중 외부인 0** — 가입 5 전부 검증 계정, 최근 30일 학습자 2. 익명 이벤트 2,847건은 출처 판별 불가 | 모든 상태 판정이 「동작함」까지만 가능 | `_raw/db-demand.md` | G1 |
| P0-2 | **main 으로 DB 를 재현할 수 없다** — DB 적용·main 밖 마이그레이션 ≥17건, 번호 충돌 1건 | 재해 복구·새 환경·리뷰가 불가능 | REPOSITORY_INVENTORY §3 | G7.1 |
| P0-3 | **배포·e2e 가 모두 건너뛰어진다** — deploy·ci e2e 가 초록인데 로그는 「시크릿 미설정 — 건너뜀」 | main 이 사용자에게 나가는지, 화면이 실제로 도는지 CI 가 말해 주지 않는다 | run 2026-10-08 로그 · `_raw/db-demand.md` | G7.3 |
| P1-1 | CSAT 학습이 공용 회고(Dashboard)에 안 나타난다 · 복습 큐가 둘 | 학습자가 보는 「내 학습」이 갈라진다 | `recent-activity-query.ts:113` · PLATFORM_SHARED_SYSTEMS §3 | G5.1 |
| P1-2 | 루프 미검증: 읽기 완료 0(texts) · SpellForge·EchoMatch 기록 0(경로는 있음) · 전이 0 | 9 계층 중 L0-2·L4b·L4c·전이가 한 번도 기록되지 않았다 — 결함인지는 재현 전 미정 | LEARNING_ENVIRONMENTS §1 | G2 |
| P1-3 | L0 후보가 셋(범용 루프 · 수능 · 교사)이고 **상위 전략 안의 관계가 정해지지 않았다** | 결정마다 서로 다른 목표를 근거로 든다(인과는 미입증) | GOAL_DECISION_HISTORY §3 | L0 |
| P1-4 | 공급의 학습자 미도달 — 미발행(ACP 92.3%) · 접근 가능하나 미사용(CTP/DCP · 도서) · 소비처 없음(topic) | 운영·저장 비용은 공급이 만든다(PLATFORM_AUDIT §6-2) | CONTENT_PIPELINE_ATLAS §2 | G4 |
| P1-5 | 브랜치 55 ahead · 34 수명 초과 · dirty worktree 27 | 병합 비용 증가 · 같은 화면을 겹쳐 고침 | REPOSITORY_INVENTORY §2·§4 | G7.2 |
| P2-1 | 실패 중인 자동 작업 무알림(csat-source-audit 3회) · 마이그레이션에 없는 cron 2개 | 조용한 부패 | `_raw/area-admin-ops.md` · `_raw/db-demand.md` | G8.1 |
| P2-2 | 교사 채널 실사용 0(학급 1 · 구성원 0 · 과제 0) | 10만 경로가 가설로 남음 | PLATFORM_SHARED_SYSTEMS §2 | G6 |
| P2-3 | 결제 0 vs 산술 모델 ARPU | 사업 목표 계산이 무근거 | GOAL_DECISION_HISTORY C4 | G10 |
| P2-4 | 문서 드리프트: 00_project_brief · PROJECT.md 「현재 0명·v06.34」 · main AGENTS.md 의 모바일 · 깨진 SKILL 링크 · VNEXT 「읽는 곳 0」 | 에이전트가 낡은 목표로 일한다 | GOAL_DECISION_HISTORY §4 | L4-08 |
| P2-5 | Admin 목업 6화면 · `/dev/*` 일부 프로덕션 가드 없음 | 운영 판단 오류 · 노출 | `_raw/area-admin-ops.md` · `_raw/area-learning.md` | G8.2 |
| P3-1 | 중복 시스템: lexicon 2 · dict 스크립트 3곳 · CCP/PDCP · DCP 생성 2곳 · knowledge/methodology · `text-viewer`/`textviewer` | 유지 비용 | CONTENT_PIPELINE_ATLAS §2 | G4.3 G9.1 |

## 2. 조사 누락 감사 (이번 조사가 보지 못한 것)

| 항목 | 이유 | 상태 |
|---|---|---|
| 화면 실제 렌더링·사용 흐름 | 서버를 띄우지 않았다 — 판정은 DB 기록 + 코드 + CI 로그 | 다음 단계에서 `/run` 으로 확인 필요 |
| e2e 79스펙 통과 여부 | 저장소에 결과 없음 · CI 도 건너뜀 | UNKNOWN |
| SpellForge·EchoMatch·읽기 완료의 기록 0 원인 | 저장 경로는 코드로 확인, 재현은 안 함 | 결함/미사용 미정 |
| Compose 재저작 단계별 산출량 | Codex 리뷰가 발견 — 이번 회차에 측정하지 않음 | IMPLEMENTED_UNVERIFIED |
| 로컬 전용 worktree 브랜치 내용 | 원격에 없음 | UNKNOWN(F-U05) |
| methodology_* 정확한 행 수 | reltuples -1 | 8/10 은 count(*) 0 확인, 나머지 근사 |
| WLP · CSAT 강의/TTS 데이터 경로 | Codex 리뷰로 확인 — WLP 는 NLP 공용 패키지, 강의는 대본+Web Speech | 해소 |
| PDCP 발행 규모 | comic 발행 테이블과 PDCP 이슈의 연결 미확인 | UNKNOWN |
| 미조사 영역 탐색 | `scripts/` 63개 항목 · `packages/` 9개 중 영역 문서에 이름이 없는 것: `scripts/ux` · `ux-bench` · `security` · `seed` · `srs` · `extract-coverage` | 개별 조사 필요 |
| 경쟁 지형·외부 시장 | 이번 범위 밖(PLATFORM_AUDIT §5) | 미수행 |

## 3. 독립 리뷰(Codex) 처리 기록 — 2026-10-09

Codex(`codex exec -s read-only`, 이 worktree 대상)가 정정 17건(P1 2 · P2 15)을 냈다. **오탐은 0건**이고, 전부 반영했다. 숫자로 판정이 갈리는 것은 DB·Actions 로 다시 쟀다([_raw/db-demand.md](./_raw/db-demand.md) 「재측정」).

| # | 지적 | 처리 |
|---|---|---|
| 1 | 읽기 완료 정본은 `texts`, `reading_sessions` 완료값은 `done` | 반영 — texts completed **0** 재측정(결론 유지, 근거 교체) |
| 2 | SpellForge·EchoMatch 저장 경로가 있다 | 반영 — 「결함」→「기록 0 · 재현 필요」, PARTIAL→IMPLEMENTED_UNVERIFIED |
| 3 | teacher 권한은 `classes.teacher_id` 소유 | 반영 — 결함 근거에서 제외 |
| 4 | WLP 는 NLP 공용 패키지 | 반영 — UNKNOWN→IMPLEMENTED_UNVERIFIED |
| 5 | CTP/DCP 는 일반 기사 기반 · 기출 세션은 학습자 PDF | 반영 — P11/P11b 분리, csat_session_attempts 1 재측정 |
| 6 | 영상이 교재 화면에 삽입됨 | 반영 |
| 7 | CSAT 강의 재생은 구현됨 | 반영 — 재생/서버 음성 분리 |
| 8 | 만화 진도 기록 있음 · CCP/PDCP 계통 다름 | 반영 — comic_read_progress 2 재측정 |
| 9 | 「99%」 분모 없음 · ACP ready 는 92.3% | 반영 — 미발행/미사용/소비처 없음 3분류 |
| 10 | TextFit 누락 | 반영 — F-L23 · L3-09 |
| 11 | Compose 재저작 누락 | 반영 — P13b · F-C13b · G4.8 |
| 12 | 교재 공장 main 경로 · F-C12 누락 | 반영 — F-C12/F-C12b 분리 |
| 13 | cron 「10개」 재계수 필요 | 반영 — job 이름 대조로 **2개**로 정정 |
| 14 | CI 초록 ≠ 스모크 통과 | 반영 — Actions 로그로 e2e 건너뜀 **확인** |
| 15 | 완료 조건이 구현 방식을 선결정 | 반영 — G2·G5 를 결과 조건으로 재작성 |
| 16 | 목표 충돌의 인과·「목표 없음」 과잉 단정 | 반영 — 「관계 미정·지표 없음」으로, L0 를 조합 가능한 후보로 |
| 17 | landing 이벤트 출처 단정 근거 부족 | 반영 — 익명 2,847건 재측정, 「외부 유입 판별 불가」로 |

Codex 가 코드로 **맞다고 확인한 주장**: `/video` 는 (marketing) 그룹 · role 허용값에 teacher 없음 · `lib/learner` 는 `learning_task_attempts` 를 읽지 않음 · CSAT 는 공용 FSRS 에 합류하지 않음(자체 복습 큐는 있음) · deploy 는 시크릿 부재 시 건너뜀.
