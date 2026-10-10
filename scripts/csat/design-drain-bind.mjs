// scripts/csat/design-drain-bind.mjs
//
// **출제 설계 주석 드레인의 입력 결속.** (2026-10-11 · F07 후속)
//
// 전: export 청크에 분석 버전 · 지문 해시가 없었고, import 는 적재 시점의 최신 published 분석을 다시 골라
// 붙였다. 지키는 것은 「지금 지문의 문장 수 = 역할 수」 하나뿐이라, 같은 문장 수로 지문이 바뀌었거나 분석
// 버전이 올라갔어도 옛 판정이 새 분석에 그대로 붙었다.
// 이제 export 가 문항마다 `bind` 를 싣고, import 는 적재 직전 DB 의 현재 값과 대조해 하나라도 다르면 건너뛴다.
// 결속 없는 옛 산출물은 「이미 같은 값」 일 때만 통과(재실행 안전) — 다르면 재추출하라고 건너뛴다.

import crypto from 'node:crypto'

export const passageHash = (passage) => crypto.createHash('sha256').update(String(passage ?? ''), 'utf8').digest('hex')

/** export 가 문항에 싣는 결속 */
export function makeBind(analysis, passage) {
  return { analysis_id: analysis.id, analysis_version: analysis.version, passage_sha256: passageHash(passage) }
}

/**
 * 산출물의 결속이 지금 DB 상태와 맞는가.
 * @returns {{ ok: true } | { ok: false, legacy?: true, why: string }}
 */
export function checkBind(bind, current) {
  if (!bind) return { ok: false, legacy: true, why: '결속 없음(옛 산출물) — 재추출 필요' }
  if (bind.analysis_id !== current.analysis.id || bind.analysis_version !== current.analysis.version) {
    return { ok: false, why: '분석 버전이 바뀜 — 재추출 필요' }
  }
  if (bind.passage_sha256 !== passageHash(current.passage)) return { ok: false, why: '지문이 바뀜 — 재추출 필요' }
  return { ok: true }
}
