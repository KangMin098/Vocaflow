# learning-map 받은 편지함 (AI-Control 배정)

작업을 시작할 때 `node bin/vfc.mjs task start <id> --owner learning-map --agent <claude|codex> --session <세션명>` 로 인수한다(인수 기록 = 배정 확인). 증거는 `task evidence`, 끝나면 `task submit` — 리뷰·완료 판정은 AI-Control(독립 리뷰)이 한다.

## 2026-10-10T03:54:02.041Z · new_task · T-0019
- 목표: UG-c8315ad8-0002 「한국 영어학습 맵 — LEARNING_MAP_VNEXT rev2.1 최종 목표 달성(감사 4d21f60fe 기준)」 · 설계 v8 · 기준 [0,1,2,3,4,5,6,7,8,9]
- 작업: UG-c8315ad8-0002 설계 v8 구현(자동)
- 허용 경로: apps/web/src/lib/csat/map/core.ts, apps/web/src/lib/csat/map/__tests__/vnext-alignment.test.ts, apps/web/src/components/csat/diagnosis/map/LearnerMap.tsx
- 금지: supabase/**, **/*.sql, **/.env*, docs/csat-learner/LEARNING_MAP_VNEXT.md, goals/**, .github/workflows/**, **/package.json, **/pnpm-lock.yaml
- 수용 기준 0: GRADE_EXPOSURE_GUIDE는 정본 rev2.1의 초등 고학년 main LP1·LP2/preview LP3, 중등 LP2·LP3·LP4, 고등 LP3·LP4·LP5·LP6·LP7 배열을 정확히 반환한다.
- 수용 기준 1: 축은 기존 CoreCode/CORE_AXES 식별자를 참조하며 V/S/R/E/L/X를 복제 정의하지 않는다.
- 수용 기준 2: 가이드는 advisory=true와 출처 버전을 가지되 start/end inclusive 계산, StepKey, 진단 상태, 잠금, 완료 값을 만들지 않는다.
- 수용 기준 3: LearnerMap은 세 학교급을 모두 표시하고 ‘학년별 권장 참고’, ‘실제 경로는 진단 결과가 결정’, ‘듣기는 별도 트랙’을 화면과 접근성 트리에 제공한다.
- 수용 기준 4: 권장 범위 밖 카드도 숨김·비활성화·재정렬·강조 해제하지 않고 학교급 정보가 learnerPath·routeAction·stepSkillProjection에 전달되지 않는다.
- 수용 기준 5: 동일 model/settings 입력에서 구현 전후 learnerPath의 steps, focus, evidence, coreSummary와 FocusStep CTA target이 동일하다.
- 수용 기준 6: vnext-alignment 테스트는 정본 LP 배열과 기존 8단계 LEARNING_PROGRESSION·7단계 READ_PATH가 동일 계약으로 취급되지 않음을 검증한다.
- 수용 기준 7: findAttempts undefined/빈 배열과 다섯 SkillView 상태에서 기존 카드·StepSheet의 상태·행동 문구가 변하지 않는다.
- 수용 기준 8: core, axis-routing, vnext-alignment, learner-path, skill-diagnosis, skill-prescription 회귀와 TypeScript 검사를 실행해 기준 commit, 전체 명령, pass/fail/skip을 기록하고 fail=0, skip=0을 확인한다.
- 수용 기준 9: 새 네트워크 호출·DB 쓰기·스키마·정본·인증 변경이 없고 db_changes=false를 유지한다.
- 인수: `node bin/vfc.mjs task start T-0019 --owner learning-map --agent claude --session <세션명>` (worktree 미지정이면 먼저 `task assign-worktree T-0019 <경로> --by learning-map --branch <브랜치>`)
