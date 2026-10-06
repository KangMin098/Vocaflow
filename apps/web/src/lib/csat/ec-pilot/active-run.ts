// apps/web/src/lib/csat/ec-pilot/active-run.ts
//
// 지금 활성인 Pilot run 메타 — 배포 env `CSAT_EC_ACTIVE_RUN`(봉인 메타 JSON 한 줄)에서 읽는다.
// 코드에 넣지 않는 이유: 메타를 코드에 넣으면 활성화가 새 커밋이 되어 「검증한 커밋 = 배포 빌드 커밋」을 지킬 수 없다(PILOT_PROTOCOL §16 앱 커밋 봉인).
// env 로 두면 배포는 검증 커밋 그대로이고, 메타의 진위는 봉인 해시 · live 대조(gate.ts)와 docs 정본 대조(start-check.mjs)가 지킨다.
//   · env 없음/빈 값 → 활성 run 없음(실제 Pilot 수집 닫힘 — 검증 모드만 가능)
//   · env 가 있는데 JSON 이 아니면 → 「있지만 깨진 메타」로 run 모드에서 게이트가 닫힌다(fail-closed — 검증 모드로 빠지지 않는다)

export interface ActiveRun { present: boolean; meta: unknown }

export function activeRun(env: string | undefined = process.env.CSAT_EC_ACTIVE_RUN): ActiveRun {
  const raw = (env ?? '').trim()
  if (!raw) return { present: false, meta: null }
  try {
    return { present: true, meta: JSON.parse(raw) as unknown }
  } catch {
    return { present: true, meta: { invalid: 'json' } }
  }
}
