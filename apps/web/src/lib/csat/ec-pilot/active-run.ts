// apps/web/src/lib/csat/ec-pilot/active-run.ts
//
// 지금 활성인 Pilot run 메타 — 정본은 docs/csat-learner/pilot-runs/<run id>.json 이고, 이 값은 그 파일과 **글자 그대로 같아야** 한다
// (`run-meta-sync.test.ts` 가 지킨다 · `scripts/csat/pilot/seal-run.mjs --activate` 가 둘을 함께 쓴다).
// null = 활성 run 없음 → 실제 Pilot 수집은 닫혀 있다(게이트 fail-closed). 검증 모드(CSAT_EC_PILOT_MODE=verification)는
// 활성 run 이 없을 때만 @example.com 테스트 계정에 한해 열린다 — gate.ts 머리 참조.

import type { RunMeta } from './run-gate'

export const ACTIVE_RUN: RunMeta | null = null
