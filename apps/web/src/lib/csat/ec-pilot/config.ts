// apps/web/src/lib/csat/ec-pilot/config.ts
//
// 오답 원인 Pilot — 학생 증거 수집 설정(저장소 설정 · 2026-10-05 사용자 결정). DB 상수가 아니라 서비스 설정이다.
//   · taxonomyVersion 은 고정한다 — 「최신 봉인 버전」을 고르는 로직을 만들지 않는다(TEST 버전 v99.* 이 섞이지 않게).
//   · 실제 참가자 계정 id 는 **저장소에 넣지 않는다**(G5 프로토콜 · 2026-10-06 — 계정 id 도 식별정보다). 배포 환경의 서버 env
//     CSAT_EC_PILOT_USER_IDS(쉼표 구분, 저장소 밖)로만 등록한다. participants 는 비워 둔다 — 둘 다 비어 있으면 기능이 꺼진다.
//     저장소에는 익명 key(P001…)만 run 메타에 남긴다(docs/csat-learner/codebook/PILOT_PROTOCOL.md §2 · §16).
//   · probeCapPerSession · correctControls 는 Pilot 규모 · UX 승인 때 정한다 — null = 미정(probe 는 문항당 1개만 · 정답 대조 없음).
//     G6 게이트(gate.ts)는 probeCapPerSession 이 run 메타 값(결정 C = 3)과 같을 때만 연다 — null 이면 실제 run 은 닫혀 있다.
//   · 참가자 env 만으로는 열리지 않는다 — 봉인 run 메타(배포 env CSAT_EC_ACTIVE_RUN — active-run.ts) 또는 검증 모드(CSAT_EC_PILOT_MODE=verification · @example.com)가 있어야 한다.

import 'server-only'

export interface EcPilotConfig {
  taxonomyVersion: string
  participants: readonly string[]
  probeCapPerSession: number | null
  correctControls: number | null
}

export const EC_PILOT: EcPilotConfig = {
  taxonomyVersion: 'v0.1',
  participants: [],
  probeCapPerSession: null,
  correctControls: null,
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** 설정 목록 + env 목록. 형식이 틀린 항목은 버린다(오타가 다른 사람을 참가자로 만들지 않게) */
export function pilotParticipants(cfg: EcPilotConfig = EC_PILOT, env: string | undefined = process.env.CSAT_EC_PILOT_USER_IDS): Set<string> {
  const extra = (env ?? '').split(',').map((x) => x.trim()).filter((x) => UUID.test(x))
  return new Set([...cfg.participants.filter((x) => UUID.test(x)), ...extra].map((x) => x.toLowerCase()))
}

export function isPilotParticipant(userId: string, cfg: EcPilotConfig = EC_PILOT, env?: string): boolean {
  return pilotParticipants(cfg, env ?? process.env.CSAT_EC_PILOT_USER_IDS).has(userId.toLowerCase())
}

/** 설정 자체가 TEST 버전을 가리키면 쓰지 않는다(DB 확인 전의 첫 관문) */
export function configTaxonomyAllowed(version: string): boolean {
  return /^v[0-9]+\.[0-9]+$/.test(version) && !/^v99\./.test(version)
}
