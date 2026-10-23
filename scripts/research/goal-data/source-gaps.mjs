// scripts/research/goal-data/source-gaps.mjs
//
// 확인된 원천 결손 문항(유형과 무관) — DB 지문이 잘려 판정 근거가 원문에 없다. D2(agree · 독립 후보)와 D3(source_gap) 가 이 목록 하나를 읽는다(T-0133 B20-P1-01).
//   복구 · 두 트랙 재판정 뒤 여기서 뺀다. 복구 패키지: docs/research/goal-data-batches/D1-source-audit/footnote-repair-20261023.md
export const SOURCE_GAP_ITEMS = {
  '2014A#29': 'footnote_truncated', // 각주 첫 줄 소실 — 「month.」 만 남음(T-0132)
  'M1809#26': 'footnote_dropped', //   각주 「No cash donations will be accepted.」 통째 소실 — 정답 근거(T-0132 · T-0133)
}
