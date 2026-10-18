<!-- docs/research/final-independent-20261018/ACCEPTANCE.md -->
# 최종 제품 독립 수용 — 현재 기준선

2026-10-18 · Codex-VOCAFLOW-FINAL-ACCEPT · 기준 main **c3a03d1680c1b064598fdc1ab319b645f370e68c**.

**현재 전체 수용 상태: REWORK. 최종 임무는 진행 중이다.** FI-001 핵심 P2가 재현됐고, 실제 적격 공급·독립 전이·납품 G2 결속은 개발 DB에 아직 없다. 사람 Gold·권리는 별도의 BLOCKED_EXTERNAL 조건이다. R5 또는 개별 코드 PR 수용을 전체 완료로 확대하지 않는다.

## A~H의 의미와 판정

사용자가 2026-10-18 이 채팅에서 정의한 상위 제품 수용 관점이다. VG-L0~L4, LM-G1/T1~T6와 TASK 분류를 대체하지 않는다. 아래는 코드/계약이 확인된 연결이며 1:1 대응 정본을 새로 만들지 않는다. 영역 전체를 VERIFIED로 올리려면 실제 학습자 경험의 연결 증거가 필요하다.

| 영역 · 사용자 정의 | 현재 판정 | 연결되는 근거 · 남은 것 |
|---|---|---|
| A 시험 기록과 현재 능력 이해 | PARTIAL | map/load.ts의 시험·정오·직접 수행 읽기, v4/as-is·skill-diagnosis, [T4 독립 결과](../lm-g1-4-independent/ACCEPTANCE.md) 재사용. 기록/직접 확인/불확실성은 구분한다. 전체 TASK와 실제 대상 학습자 근거까지 검증된 상태는 아니다. |
| B 목표 설정 | PARTIAL | v62/target-goal.ts·목표 API·[T3 독립 결과](../lm-g1-3a-independent/ACCEPTANCE.md). 점수·평가원 단일 시험 범위 계산과 버전 연결 범위 수용. 등급·일정은 저장/표시이며 해당 기준의 계산, 등급 단독·복합/회차·시간 예산은 완료 아님. 오래된 target-spec.ts 주석만으로 현재 미저장이라고 판정하지 않는다. |
| C 개인화 학습지도 | PARTIAL | v4/to-be·plan·workspace, v62/rank·coverage, [T1](../lm-g1-1-independent/ACCEPTANCE.md)·[T2](../lm-g1-2-independent/ACCEPTANCE.md). 운영 시도량과 도달 근거 구분. [현재 정의 30 TASK](./task-support.json): live 표기5/ready2/content_needed14/blocked9는 메타데이터이며 실제 지원 보증이 아니다. |
| D 기출 출제 원리 학습 | PARTIAL | 기출 theater·reasoning·learner-guide 경로 및 [기존 R5 화면 증거](../r5-e2e-20261018/). 측정 의도·주장/근거/관계·정오답·자기 설명의 연결을 재사용. 전체 원리의 교수 타당성과 대체 정답 처리는 완료 아님. [2020#24 Gold 쟁점](../r5-2020-24-review-packet-20261018/AI-VERIFICATION.md)은 유지. |
| E 적합한 학습 콘텐츠 공급 | BLOCKED_EXTERNAL | DB-1/2/I2/G2 설치 이력 SHA를 로컬 파일과 대조. [현재 DB](./db-baseline.json)의 자격·승인·등록부·수요·주문·납품 전부0. 사람 Gold·권리 근거 미승인. active application은 FQ가 아니다. 새로운 창작물도 기출로 가장하거나 Gold/권리를 자동 충족했다고 볼 수 없다. |
| F 실제 학습 실행 | PARTIAL | Workspace·기출/연습·G2 writer와 [기존 T2](../lm-g1-2-independent/ACCEPTANCE.md)·[#289 상태](../r5-screen-states-20261018/STATES.md) 재사용. 실제 적격 공급을 받은 실행은 아직0. FI-001은 Workspace 정체성 보존을 깨뜨린다. |
| G 독립 전이 | PARTIAL | prior-help·노출 원장·revision/annotation·역할 계약 및 [#285 독립 경계](../r5-285-independent-20261017/ACCEPTANCE.md) 재사용. 연습/도움/같은 지문을 독립 전이로 승격하지 않는 범위를 검증했다. 실제 적격 미노출 전이와 지연 효과는 미검증. |
| H 증거 기반 환류 | PARTIAL | G2→map/load→composeV4→NeedRank/Workspace/PLAN, 저장 PLAN·목표 버전 보존의 T2~T4 결과 재사용. [FI-001](./FINDINGS.md): 최신 납품 추측으로 다른 Workspace에 비근거 결속. #291의 결속 오류 재시도 부재도 기존 미해결 조건. 실제 납품부터 전체 환류의 완료 증거 없음. |

현재 확인된 연결은 위 항목에 한정한다. 이 표 밖의 정본/구현 관계와 전체 지원 TASK의 미검증 영역은 **UNMAPPED/NOT_VERIFIED**이며 강제 대응하지 않는다. 새 로드맵이나 신규 필수 게이트를 만들지 않는다.

## A→B→C→D→E→F→G→H 관통 증거

기존 합성 계정/격리 시험은 일부 기능 연결의 기술 근거다. 현재 개발 DB의 적격 공급·납품·결속0은 **관통 성공 증거가 아직 없다는 관찰**이다. 전체 사용자 경로를 성공했다고 판정할 수 없다. 실제 학생 효과, 유지/전이 향상, 인과 효과는 각각 미검증이다. 합성 계정이나 fixture를 효과 표본으로 계산하지 않는다.

새로 수행한 시험은 FI-001의 다중 Workspace/역할 결속 조합뿐이다. [실제 SQL 격리 결과](./delivery-provenance.log)는 앱의 최신 transfer 납품 선택 시 evidence=false, 같은 데이터에서 명시한 CHECK 납품은 evidence=true임을 보인다. 개발 DB 쓰기0. 전체 Supabase·실제 동시성으로 확대하지 않는다.

## PR · CI · 적용 이력

[#286~#292 원장](./pr-baseline.json)에 HEAD·체크 URL·병합 SHA를 보존했다. 각 HEAD의 필수8종은 SUCCESS다. e2e-shared-dev의 SKIPPED는 실DB PASS로 세지 않는다. 병합됐다는 사실만으로 safe-merge 실행을 추정하지 않는다. 확인되지 않은 실행 영수증은 미확인이다. 이후 통합 PR은 새 HEAD별로 목적 리뷰·필수 CI·safe-merge를 확인한다.

| PR | 범위 | 실제 병합 SHA(앞9자리) |
|---|---|---|
| [286](https://github.com/KangMin098/Vocaflow/pull/286) | DB-1 배포 기반 | 9de24bcff |
| [287](https://github.com/KangMin098/Vocaflow/pull/287) | 승인형 배포 경로 | 0b2a35451 |
| [288](https://github.com/KangMin098/Vocaflow/pull/288) | R5 reader·안내·격리 SQL | d3b32c902 |
| [289](https://github.com/KangMin098/Vocaflow/pull/289) | Inspector 상태 fixture | 635cc4460 |
| [290](https://github.com/KangMin098/Vocaflow/pull/290) | I2·G2 버전 SQL/적용 정합 | 47f600401 |
| [291](https://github.com/KangMin098/Vocaflow/pull/291) | 앱 결속·첫 공급 패키지 | e3d2ae6f2 |
| [292](https://github.com/KangMin098/Vocaflow/pull/292) | Gold·권리 AI 기록 | c3a03d168 |

[DB 질의](./db-baseline.sql)는 READ ONLY 트랜잭션이다. 4개 적용 이력 본문 SHA는 DB-1/DB-2/I2/G2의 저장소 바이트와 일치한다. 실제 자격 행·승인 행·출시 콘텐츠와는 다른 증거다. 세션은 DB 변경·Gold 승인·권리 승인을 수행하지 않았다.

## 남은 사람 조건과 개발 수정

- 사람: 해당 revision에 대한 Gold 판정, 정당한 대체 정답·루브릭 일관성, 상업적 저장/배포/평가 이용을 포괄하는 권리 근거. AI 합의/기출 정답 일치로 대신하지 않는다.
- 개발 총괄: FI-001의 수행 출발점 정체성 및 결속 복구를 통합 연결하고 PR 제출. 독립 세션은 수정 HEAD를 재현·검증한다. 실제 개발 DB 쓰기가 필요한 검증은 담당 실행자의 증거를 읽기 전용으로 대조한다.
- 독립 검증: 새 통합 PR의 변경 범위와 최종 전체 TASK·PC 브라우저·격리 E2E·DB 증거를 연결한다. 현재 원장은 최종 전체 ACCEPT 보고가 아니다.
