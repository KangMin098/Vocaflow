// scripts/lcp/safety/slur-roots.mjs
//
// 발행 단어장 멸칭 선별용 **어근 목록** — 판정이 아니라 *후보 추출*이다.
//
// 왜 어근인가: 회귀 테스트(`slur-not-published.integration.test.ts`)는 완성된 형태 19개를
//   못 박지만, 실제 노출은 굴절형에서 샌다. 2026-08-30 실측 —
//   발행 단어장의 서로 다른 표면형 39,103 중 **13,394 가 표제어가 아닌 굴절형**이고,
//   추출 RPC 는 그런 표면형을 **lemma 의 register 로만** 판정한다
//   (`select_book_chapter_vocab` 의 CASE — 표면형이 사전에 분류돼 있으면 그것을 표제어로 쓰고,
//    아니면 lemma 로 내려간다). 그래서 lemma 가 중립이면(savage="흉포한", retard="지연시키다")
//   멸칭 굴절형(savages · retarded)이 그대로 학습 카드가 된다.
//
// ⚠️ 이 목록에 걸린다고 멸칭인 것이 아니다. `idiot` · `lunatic` · `wretch` 처럼
//   문학 독해에 필요한 낱말이 대거 걸린다. 그래서 **자동 삭제·자동 재분류를 하지 않는다** —
//   후보를 뽑아 Claude Code 가 뜻과 용례를 보고 한 건씩 판정한다(드레인 3단 구조).
//
// 판정 기준(저장소 기존 결정과 동일 — 회귀 테스트 주석 참조):
//   주된 뜻이 **집단 멸칭**이면 학습 카드에서 뺀다. 경멸 뉘앙스가 있어도 등재된 뜻이
//   중립이면(chink="좁은 틈") 남긴다. 어느 쪽이든 **사전에서 지우지 않는다** — 원문을 읽다
//   눌렀을 때 뜻은 떠야 한다.

/** 어근(부분 문자열 매칭). 굴절·복합형을 함께 잡기 위해 일부러 짧게 둔다. */
export const SLUR_ROOTS = [
  // 인종·민족
  'nigger', 'niggard', 'negro', 'negress', 'darkie', 'darky', 'coon', 'chink',
  'jap', 'gook', 'wop', 'dago', 'kike', 'redskin', 'squaw', 'halfbreed', 'half-breed',
  'mulatto', 'quadroon', 'octoroon', 'savage', 'heathen', 'oriental', 'gypsy', 'gipsy',
  'hottentot', 'kaffir', 'pickaninny', 'blackamoor', 'moorish', 'barbarian', 'aborigine',
  // 장애·정신
  'retard', 'imbecile', 'moron', 'cretin', 'idiot', 'lunatic', 'midget', 'dwarf',
  'feeble-minded', 'feebleminded', 'spastic', 'cripple', 'deaf-mute', 'deafmute', 'mongoloid',
  // 성·젠더
  'whore', 'harlot', 'hussy', 'slut', 'wench', 'spinster', 'effeminate', 'sodomite',
  'catamite', 'concubine', 'strumpet', 'trollop', 'jezebel', 'eunuch',
  // 계급·기타
  'bastard', 'vagabond', 'beggarly', 'papist', 'infidel', 'savagery',
]

/** 이미 판정이 끝나 **의도적으로 남긴** 표제어 — 후보에서 제외해 재검토 소음을 줄인다. */
export const ALREADY_KEPT = new Set([
  'chink', 'retard', 'faggot', 'fag', 'queer', 'savage', 'cripple', 'heathen',
])

/** 이미 노이즈 register 로 옮겨진 것(재분류 완료) — 후보에서 제외. */
export const NOISE_REGISTERS = [
  'archaic_literary', 'period_cultural', 'phrase_unit', 'brand', 'abbreviation', 'proper_noun',
]

/** 표면형이 어근 중 하나를 포함하는가. */
export function matchRoots(surface) {
  const s = surface.toLowerCase()
  return SLUR_ROOTS.filter((r) => s.includes(r))
}
