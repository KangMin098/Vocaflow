# AI_WORKFLOW_REQUIREMENTS.md

상태: STEP 2/6 제품 전략 승인 정본 v1.1.0 (구현 검증과 출시 승인은 별도)

## 승인된 전략 결정 — 2026-10-09 (STEP 2/6)

| 결정 ID | 확정 내용 | R0 효과 |
|---|---|---|
| SD-R0-01 | 중등 일반 영어·독해 | 중등 독해의 대표 학습 경로 1개를 우선 완결 |
| SD-R0-02 | 비로그인 체험 → 가입 → 학습 | 익명→인증 전환 및 학습 이력 연결 검증; 가입 강제 전 익명 체험 가능 |
| SD-R0-03 | PC 웹 먼저, 모바일 후속 | PC 브라우저 출시를 우선; 모바일 전용 최적화는 R0 범위 아님 |
| SD-R0-04 | 교실·결제는 첫 학습 여정 완성 후 검토 | 초기 릴리스 차단 요건에서 제외; 안전상 필요한 기존 기능 회귀 검사는 유지 |

이 결정은 **제품 전략 승인**이며, 현행 코드 구현·배포·사용성·효과 검증을 승인한 것이 아니다. 더 넓은 L0 및 기존 영역은 장기 목표로 보존한다. R0에서는 기능 수 확대보다 첫 학습 경로의 완결성과 재현 가능한 검증을 우선한다.

## 1. 사명과 권한

자동화는 **인증된 최종 목표에 필요한 빈틈을 식별·구현·검증·보고**하는 수단이다. Claude Code/Codex/ChatGPT가 스스로 제품 성공이나 학습 효과를 승인할 수 없다. 사용자에게는 최상위 전략과 되돌리기 어려운 운영 결정을 요청하고, 통상적인 작은 작업은 묶어서 진행한다.

- ChatGPT(웹/Work): 제품·교육·시스템 목표 정합성 검토, 우선순위, 이견 조정, 증거와 가설 분리. 로컬 환경 직접 접근 가능하다고 가정 금지.
- Claude Code(로컬): 리포지토리/테스트/DB 계약/화면 구현, 테스트 실행 증거 수집, 커밋/푸시(권한 내).
- Codex(로컬): 독립 diff 리뷰, 목표 추적·회귀·권한/보안/데이터 품질 검증 및 반례 발굴; 필요시 분리된 수정 브랜치.
- 사람(프로젝트 오너): L0/L1 제품 전략 승인, 배포 권한, 고위험 데이터 변경, 출판/권리/비용 정책, 학습 효과 대외 주장 승인.

## 2. 오케스트레이션 현실과 기본 전송 방식

세 에이전트 사이에 자동·실시간 API 연결이 **이미 존재한다는 증거는 없다**. `Git remote + PR + 구조화된 파일 + CI 결과`를 버전이 보장되는 **기본 비동기 교환 계약**으로 삼는다. 로컬 에이전트가 같은 공유 작업 공간에 접속하는 경우에도 브랜치/작업트리를 격리한다. ChatGPT에는 다음 중 가능한 방식으로 전달한다: 변경 문서 첨부, GitHub 연결 후 승인된 파일 읽기, Work의 지원되는 브라우저/커넥터 이용. 실재하지 않는 백그라운드 실행/접속을 전제하지 않는다.

- 원본 파일을 보내기 어렵다면 `git show <sha>:<path>` 내용 또는 작업 결과 요약+diff+CI 링크를 전달한다.
- **원칙상 Git push는 매 소규모 프롬프트마다 필수가 아니라 검증 가능한 작업 단위마다** 한다.
- 수동 복붙 경로도 정상 워크플로이고, 추후 지원되는 커넥터와 실행기가 확인되면 자동 전달로 바꾼다.

## 3. 정본과 버전 관리

권장 루트: `docs/platform-goals/`

- `PROJECT_GOAL.md`: 승인된 L0~L4 계층과 단계별 범위.
- `PRODUCT_STRATEGY.md`: 대상, 가치, 학습 환경, R0/R1/R2.
- `GOAL_ACCEPTANCE_CRITERIA.json`: 기계 판독형 목표/게이트/증거.
- `AI_WORKFLOW_REQUIREMENTS.md`: 실행자 책임 및 워크플로.
- `.agent-goal.md`: 각 작업트리의 **현재 승인 작업 단위**와 허용 범위. 역사적 제약을 전역 금지로 승격하지 않는다.

변경은 제안→독립 검토→결정 기록→버전 갱신→작업 적용 순서. 목표 버전/해시, 코드 SHA, DB 상태 ID, 테스트 실행 ID를 연결한다. 정본과 코드가 충돌하면 자동으로 정본/코드 어느 쪽도 덮어쓰지 않는다.

## 4. 실행 단위 계약

작업 단위는 `task_id, goal_id, parent_id, base_sha, objective, allowed_paths, db_scope, exclusions, acceptance_ids, verification_commands, evidence_paths, rollback, owner, reviewer, status`를 포함해야 한다.

1. **Intake**: 목표 추적 경로 및 현 상태 증거 확인. 원자료 없는 현재 상태는 `unknown`.
2. **Plan**: 꼭 필요한 차이만 계획하고 최근 작업량/미사용 자산을 우선순위의 근거로 쓰지 않는다.
3. **Scope**: 작업트리 `.agent-goal.md` 선갱신; DDL/DML 예정 시 허용 테이블·행·승인 SQL 해시를 명시한다.
4. **Implement**: 기존 학습자 경험/DB 호환성을 보존하는 최소 구현.
5. **Verify**: 실제 실행/실패/스킵 분리. 코드 검사만으로 브라우저 E2E 통과 주장을 금지.
6. **Independent Review**: Codex가 실제 diff·테스트·정본 경로를 검토. P1의 경우 현재 목표 파일과 사용자 승인 범위도 대조하고 오류 판정을 기록.
7. **Reconcile**: 발견 결함 수정과 회귀 검증. 타 브랜치 문제는 근거와 별도 책임자를 명시.
8. **Deliver**: 원자적 작업 단위로 문서·테스트·커밋·push, PR(승인 권한 범위)과 결과 증거 생성.
9. **Gate**: release 또는 DB 승격 등 보호 조치는 별도 승인. 다음 우선순위로 자동 이동하되 외부 blocker는 `blocked_external`로 두고 우회하지 않는다.

## 5. 불변 안전/정합 규칙

- 임의 파괴적 DDL/DML·자격증명 공개·TLS 우회·승인되지 않은 권한 승격 금지.
- dev DB와 prod DB를 명시적으로 구분; 운영 DB 없음이라는 과거 사실을 현재 불변 사실로 취급하지 않고 연결 환경을 재확인.
- 적용된 DB와 main migration 차이는 read-only 조사→수정 계획→백업/체크포인트→별도 승인→검증.
- 읽기 완료·복습·전이·재평가 이벤트는 기록이 실제 남고 교차 조회되는지 검증한다.
- 학습 기록의 suspicious/excluded 상태와 불확실성을 보존; 정답률을 진단 원인으로 오용하지 않는다.
- 학습자 공개 게이트와 코드 머지를 분리; 현재 노출 paused 기능은 임의로 active 전환 금지.
- 생성된 콘텐츠는 출처·권리·교육 적격·안전·검수 근거 없이 공개하지 않는다.
- AI/합성 학습자 데이터는 실제 학생 효과 증거에 산입하지 않는다.

## 6. 상태 및 증거 모델

상태: `not_started`, `in_progress`, `implemented_unverified`, `verified_technical`, `validated_usability`, `validated_learning`, `validated_causal_effect`, `blocked_external`, `failed`, `deferred`.

별도 필드 `technical_status`, `usability_status`, `learning_status`, `release_status`를 유지한다. 단일 `done=true`만으로 모든 차원을 완료 처리하는 것을 금지한다.

증거 레코드 필수 항목: `evidence_id, type, source, observed_at, commit_sha, environment, command_or_protocol, artifact_path_or_url, result, skip_count, limitations, reviewer`.

검증 없는 주장: `reported` 또는 `hypothesis`만 허용. CI green + E2E skipped는 E2E 성공이 아니다. 로그 없이 '배포됨' 주장 금지. 샘플 수 0의 학습 효과는 `not_evaluated`.

## 7. 우선순위 및 차단 처리

**우선순위** = L0에 대한 필수성 × R0 학습 여정 직접성 × 사용자 장애 심각도 × 리스크 감소 ÷ 작업량. 정량 점수는 추정이며 근거를 기록한다. 총 생성 건수/커밋 수는 가치 가중치가 아니다.

차단 요인 분류:
- `mandatory_gate`: 권한·개인정보·데이터 훼손·실제 배포의 핵심 오류. 우회 금지.
- `external_dependency`: 사용자/외부 자료·승인 대기. 가능한 독립 작업은 계속하고 의존 작업만 보류.
- `optional_scope`: 부수 디자인, 무관한 자료 수집, 추가 게임/교재 양산. R0에서 제외/연기.
- `local_failure`: 재현 및 보수 후 테스트.

불필요한 작은 결정을 반복적으로 사용자에게 묻지 않는다. 그러나 실제 학습자 검증이 막혔다고 합성 사용자 결과로 대체했다고 주장하지 않는다.

## 8. 자동 판정 로직의 요구 사항

- 모든 L4는 정확히 하나의 주 L3를 참조하며 존재하는 목표 ID여야 한다.
- L3는 모든 필수 acceptance criterion이 `pass`이며 증거 URI가 확인되기 전 완료 불가.
- `skipped`, `unknown`, `blocked`, `not_run`은 pass가 아님.
- R0 release는 기술/권한/배포/핵심 여정 필수 게이트 전부 pass 시에만 가능.
- 사용성·학습 효과의 별도 게이트 상태를 함께 보고. 기술 출시 후에도 `learning=not_evaluated` 허용, 단 효과 주장 금지.
- 상위 목표 판정은 하위 목표 증거와 제품 범위에 따르되 R0 완료로 L0 완료를 선언하지 않는다.
- review에 의한 목표 변경은 기존 목표 ID의 의미를 조용히 수정하지 말고 버전·승인 기록을 남긴다.
- 실제 테스트 실행을 증명하는 재현 스크립트와 결과 아티팩트를 검증한다.

## 9. 권장 자동 협업 파일 구조

```
docs/platform-goals/{PROJECT_GOAL.md,PRODUCT_STRATEGY.md,GOAL_ACCEPTANCE_CRITERIA.json,AI_WORKFLOW_REQUIREMENTS.md}
.agent-goal.md
docs/goal-runs/<task_id>/{plan.md,review.md,verification.json,decision.md}
```

기존 `docs/platform-audit/GOAL_HIERARCHY_DRAFT.json`은 **정본의 선행 조사 입력**이며 자동으로 정본을 대체하지 않는다. STEP 3에서는 초안 64개 항목을 새 정본 L0~L4에 일대일/일대다 매핑하고 폐기·통합·보류 사유를 기록한다. 이 단계에서 실재 코드를 다시 확인하고 acceptance의 `observed_status`를 채운다.

## 10. 역할별 보고 양식

**실행 보고**: 기준 SHA/DB, goal_id, 현재 목표, 변경 파일/마이그레이션, 검증 명령과 통과/실패/스킵 수, E2E/배포 실제 상태, 증거 경로, reviewer 결과, 미해결 blocker, 커밋·push, 후속 의존 목표.

**독립 리뷰**: 재현 가능한 P0/P1/P2, 영향받는 목표/수용 기준, 실제 diff 인용, 오탐 검토, 수정 권고. 무관한 범위 확장은 별도 티켓.

**전략 리뷰**: 제품 가설과 현장 사실 구분, 미승인 결정, R0 영향, 수집해야 할 실제 학습자 증거, 우선순위 이유.

## 11. 단계별 로드맵

- STEP 2(본 산출물): L0~L4 정본 및 SD-R0-01~04 **사용자 전략 승인**. 구현·출시 검증은 미승인.
- STEP 3: 조사 원본 10종, 목표 64개와 구현 매핑, 신뢰 수준, 중복/누락 갭 확정.
- STEP 4: R0 세부 실행 DAG 및 컴포넌트 계약, DB/배포/권한 계획.
- STEP 5: 에이전트 교환·CI 증거 자동 수집·독립 리뷰 통합.
- STEP 6: R0 종단 검증, 출시 판정과 후속 학습 효과 실험의 사전 등록.

## 12. 승인된 사용자 전략과 자동 실행 권한

SD-R0-01~04가 확정되었다. 에이전트는 같은 선택을 재질문하지 않고 STEP 3의 읽기 전용 근거 수집, 분류, 갭 분석을 수행한다. DB 쓰기, 배포, main 머지, 고위험 권한 변경 또는 실제 사용자 데이터 취급은 별도 승인 조건을 따른다.

## 13. STEP 3 전달 계약

- **입력**: 이 정본 4종, STEP 1 조사 원자료 10종 및 요약, `GOAL_HIERARCHY_DRAFT.json`(64개), `PLATFORM_GAP_ANALYSIS.md`, 감사 기준 SHA/브랜치, PR/브랜치 목록, 읽기 전용 DB 스키마·migration 비교, 테스트/Actions/배포 로그. 미제공 자료는 `not_available`로 표시한다.
- **대조**: STEP 1의 64개 목표와 확정 40개 criteria를 `mapped|split|merged|out_of_scope|unmapped`로 교차 대응한다. ID를 함부로 대체하지 않는다.
- **상태**: `reported_only`와 `directly_reproduced`를 구분하며, 테스트의 pass/fail/skip을 각각 수집한다. '미사용'을 '고장'으로, '테스트 코드 존재'를 '테스트 통과'로 바꾸지 않는다.
- **우선순위**: R0 종단 경로 차단, 보안·권한·배포, 데이터 무결성, 콘텐츠 배포 권한, 사용성 순으로 검토한다. R1·R2 범위와 공급 적체는 보존/연기/의존성 판정하되 별도 구현하지 않는다.
- **산출**: `STEP3_GOAL_CROSSWALK.csv`, `STEP3_IMPLEMENTATION_INVENTORY.json`, `STEP3_R0_GAP_REGISTER.md`, `STEP3_DEPENDENCY_DAG.json`, `STEP3_EVIDENCE_INDEX.json`, `STEP3_REVIEW_DECISIONS.md`. 실제 코드 변경 전에 사용자에게 보고할 것은 전략 재선택이 아니라 진짜 blocker 및 고위험 변경 승인 건뿐이다.
- **완료 조건**: 모든 40개 criteria에 원본 위치 또는 미확인 사유 기재, R0 필수 게이트의 장애/증거/담당/선행관계 기재, 불일치 migration 및 스킵 여부 확인, 독립 리뷰 완료. 이 검토는 R0 구현/출시 성공을 뜻하지 않는다.
