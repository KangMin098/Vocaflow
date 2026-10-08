# STEP 3/6 입력 기준 및 검토 착수 계약

상태: STEP 2 전략 결정 승인 / STEP 3 실행 미착수 (2026-10-09)

## 검토 목표

**64개 STEP 1 후보 목표 → 40개 정본 criteria ↔ 실제 구현/DB/배포/테스트**의 근거 추적표를 만들고, 확정 R0 중등 영어·독해 PC 웹 학습 여정을 막는 실제 갭만 추린다. 코드를 먼저 확장하거나 목표를 재정의하지 않는다.

## 필수 입력

1. 확정 정본 4종(동일 버전·SHA로 봉인).
2. STEP 1의 `docs/platform-audit/` 원본 10종, `GOAL_HIERARCHY_DRAFT.json`, `PLATFORM_GAP_ANALYSIS.md`. 없으면 누락으로 기록하고 추정치로 채우지 않는다.
3. main 및 audit 기준 SHA, 미머지 브랜치/PR 목록, 목표 작업트리의 `.agent-goal.md`.
4. 화면/라우트/이벤트/DB 객체·migration 스냅샷(조회만), CI 테스트 로그와 실제 배포/스모크 로그, 콘텐츠 사용권/출처 표본.

## 수집 표준

각 항목에 `goal_id`, `source_ref`, `baseline_sha`, `owner`, `reported_or_verified`, `implementation_status`, `pass_fail_skip`, `evidence_path`, `blocker`, `dependency`, `r0_priority`, `reviewer`를 포함한다. 근거 미확보는 `unknown`이며 통과가 아니다.

## R0 핵심 대조 경로

비로그인 PC 체험→가입 시 보안·동의 조건에 맞는 기록 연결→읽기→Practice→피드백→복습→미노출 전이→재평가→학습 이력. 진단은 R0의 독해 난도·목표를 지원하는 최소 범위로 설계한다. 강의/게임/시험 특화/교실/결제는 R0 필수 단계가 아니다.

## 중점 조사 순서

(1) 이용 가능 콘텐츠·권한 (2) 익명→인증 상태 전이 (3) 읽기 완료/Practice 이벤트 (4) 복습 및 전이/재평가의 실제 연결 (5) 공용·수능 기록 분리 영향 (6) DB-main migration 불일치 (7) 보안 및 실제 배포 E2E 스킵 (8) 미사용 공급 자산 동결/보존의 의존성.

## 필수 출력

- `STEP3_GOAL_CROSSWALK.csv`: 64개 후보 ↔ 40개 criteria 대응과 미대응 표시
- `STEP3_IMPLEMENTATION_INVENTORY.json`: 코드 경로/DB/테스트/배포 근거 목록
- `STEP3_R0_GAP_REGISTER.md`: blocker와 우선순위·최소 해결책
- `STEP3_DEPENDENCY_DAG.json`: R0 필수 순서 및 병렬 가능한 작업
- `STEP3_EVIDENCE_INDEX.json`: 근거 추적/한계/해시
- `STEP3_REVIEW_DECISIONS.md`: Claude Code와 Codex 이견·판정·미해결 사항

## 종료 게이트

목표-구현-검증 매핑의 근거/미확인 표기가 누락 없이 완성되고, R0 필수 차단과 외부 의존이 식별되고, Codex가 독립 검토하며, 우선순위/범위 이탈이 없는지 점검한다. STEP 3는 분석 단계이므로 코드 변경, 출시, 효과 검증을 완료로 보고하지 않는다.
