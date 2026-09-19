// apps/web/src/lib/textbook/shelf-status.ts
//
// 권 상태의 **학습자용 라벨** — 단일 출처.
//
// 왜 떼어 냈나: 이 라벨이 목록 진열(`VolumeRow`)과 격자 진열(`VolumeCard`) 두 곳에 나온다.
// 화면마다 적으면 반드시 갈린다 — 특히 `unmeasured` 는 문구 하나가 이 화면의 정직성을
// 통째로 좌우하는 자리라(0 과 '못 잼' 을 구별하는 규칙) 두 벌로 두면 안 된다.

import type { ShelfStatus } from './shelf'

export const STATUS_LABEL: Record<ShelfStatus, string> = {
  ready: '지금 펼치기',
  building: '준비 중',
  empty: '근간 예정',
  // '없음' 과 절대 같은 말을 쓰지 않는다 — 못 잰 것을 없다고 적는 것이 이 화면의 첫 결함이었다.
  unmeasured: '재고 확인 중',
}
