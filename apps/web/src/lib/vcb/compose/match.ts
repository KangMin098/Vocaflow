// apps/web/src/lib/vcb/compose/match.ts
//
// 예문이 표제어를 실제로 담고 있는가 — 판정 한 곳.
//
// 별 파일로 뺀 이유: 이 판정을 **선별(facets.hasField)과 평가(market)** 둘 다 쓴다.
// 한쪽에만 두면 순환 import 가 되고, 복사하면 두 곳이 갈라진다 —
// 그러면 "필터는 통과했는데 평가에서는 실패" 같은 설명 불가한 상태가 생긴다.

/**
 * 굴절·구를 감안한 포함 판정.
 *
 * 어간 자르기만으로는 **불규칙 굴절**을 놓친다 (come/came · say/said · bring/brought).
 * 사전이 `inflected_forms` 를 15,217행에 들고 있으므로 추측 대신 그 데이터를 먼저 본다
 * (Round 9 실측: 원서 세트 예문 실패 6% 가 전부 불규칙이었다).
 */
export function exampleContainsHeadword(
  word: string,
  example: string,
  inflections: string[] = [],
): boolean {
  const ex = example.toLowerCase()
  const w = word.toLowerCase().trim()
  if (ex.includes(w)) return true

  for (const f of inflections) {
    const form = f.toLowerCase().trim()
    if (form.length >= 2 && ex.includes(form)) return true
  }

  // 구(phrase) — 낱말이 따로 떨어져 나타난다("give it up"). 머리 동사는 굴절할 수 있고
  // 나머지 조각(불변사·전치사)은 그대로 나타난다.
  if (w.includes(' ')) {
    const tokens = w.split(/\s+/)
    const head = tokens[0]!
    const rest = tokens.slice(1).filter((p) => p.length >= 2)
    const headOk =
      ex.includes(head) || inflections.some((f) => f.length >= 2 && ex.includes(f.toLowerCase()))
    if (headOk && rest.every((p) => ex.includes(p))) return true
    const parts = tokens.filter((p) => p.length >= 2)
    if (parts.length > 0 && parts.every((p) => ex.includes(p))) return true
  }

  // 규칙 굴절 — 어간 기준 (drive/driving · study/studies · run/running)
  const stem = w.length > 4 ? w.replace(/(e|y|ie)$/, '').slice(0, Math.max(4, w.length - 2)) : w
  return stem.length >= 4 && ex.includes(stem)
}
