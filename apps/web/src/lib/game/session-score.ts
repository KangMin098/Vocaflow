// apps/web/src/lib/game/session-score.ts
//
// "결과 화면이 보여 준 점수" 를 세션 기록기로 넘기는 **단일 통로**.
//
// 왜 생겼나 (v08.7 결함 M2):
//   `useGameSessionRecorder` 는 `computeScore` 를 받으면 그것으로, 안 받으면 `정답×100`
//   으로 `scores.score` 를 적재한다. 그런데 `GamePlayScaffold` 는 `computeScore` 를
//   props 로 받지도 넘기지도 않아서 **18/19 게임이 기본값**으로 적재됐다.
//   결과 화면은 "점수 870" 을 크게 보여 주는데 DB 와 `/arcade/ranking` 은 그 수를 모른다 —
//   학습자가 **본 적 없는 숫자로 순위가 매겨졌다**.
//
// 왜 게임마다 prop 을 뚫지 않았나:
//   19종이 이미 결과 화면 진입 때 `usePersonalBest().submit(<화면에 띄우는 그 수>)` 를
//   부른다. 그 호출이 곧 "이 판의 대표 점수" 의 정의이고, 게임당 딱 한 번 일어난다.
//   거기서 같은 수를 여기로 흘리면 19개 파일을 건드리지 않고도 **표시=저장**이 성립한다.
//   (게임이 점수를 두 번 정의하지 않는다는 점이 이 설계의 핵심이다 — prop 을 새로 뚫으면
//    "결과 화면에 쓰는 수" 와 "저장하려고 넘기는 수" 가 갈릴 자리가 생긴다.)
//
// 모듈 싱글턴인 이유: 게임 세션은 한 번에 하나뿐이고, 기록기가 마운트할 때 초기화한다.
// 아무도 보고하지 않으면 값은 null 이고 기존 산식(정답×100)이 그대로 쓰인다.

let reported: number | null = null

/** 결과 화면이 띄우는 대표 점수를 보고한다. 유한한 값만 받는다. */
export function reportSessionScore(value: number): void {
  if (!Number.isFinite(value)) return
  reported = Math.round(value)
}

/** 기록기 전용 — 이번 세션에 보고된 점수(없으면 null). */
export function readSessionScore(): number | null {
  return reported
}

/** 기록기 전용 — 새 세션 시작. 이전 판의 점수가 다음 판에 새지 않게 한다. */
export function resetSessionScore(): void {
  reported = null
}
