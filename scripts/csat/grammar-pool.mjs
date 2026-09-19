// scripts/csat/grammar-pool.mjs
//
// **어법 문법 풀 10종 — 단일 출처.**
//
// P3.5("어법 밑줄은 문법 풀 10종 안에 100% 든다")는 대장에 **재검 필요** 로 적혀 있었다:
// "풀을 사후에 정의했으므로 반증 불가 위험(G3)".
//
// 그 우려의 절반은 이미 답이 있다 — 이 표는 **10칸으로 선언**돼 있고 실제로는 6칸만 쓰인다.
// **네 칸(G4 태 · G7 병렬 · G8 전치사vs접속사 · G10 도치)이 한 번도 안 걸린다.**
// 항진명제라면 그럴 수 없다.
//
// 나머지 절반은 홀드아웃이다 — verify-h3-h7.mjs 는 2014A 와 모평을 제외했다.
// 그 20개 밑줄에 **이 표를 손대지 않고** 걸어 보는 것이 test-p35-grammar-pool.mjs 다.
//
// ⚠️ **이 표를 고치면 P3.5 의 홀드아웃 결과가 무효가 된다.** 고칠 일이 있으면
//    고친 사실과 이유를 문서에 적고 홀드아웃을 다시 돌려야 한다.

export const POOL = [
  ['G4 태', /^(be|been|is|are|was|were|being|get|gets)\s+\w+(ed|en)\b/i],
  ['G8 전치사 vs 접속사', /^(because|although|though|despite|in\s+spite\s+of|while|during|since|unless|whereas)\b/i],
  ['G2 관계사·접속사', /^(which|who|whom|whose|what|where|when|why|how|that)\b|^(in|of|for|on|with|to|by|from|at)\s+which\b/i],
  ['G9 시제·조동사·가정법', /^(would|could|should|might|must|will|shall|had\s+to\b|ha[sve]+\s+to\b|had\s+\w+(ed|en)\b)/i],
  ['G3 수일치', /^(is|are|was|were|has|have|does|do|did|seems?|exists?|remains?|appears?|makes?|takes?|comes?|gives?|knows?|continues?|differentiates?|means?|allows?|requires?|involves?|includes?|leads?|tends?)\b/i],
  ['G1 준동사 vs 정동사', /^(to\s+[a-z]+|being|having\s+\w+|\w+ing\b|\w+ed\b|\w+en\b|built|brought|kept|left|found|held|made|sent|told|thought|caught|taught|bought|sought|felt|meant|dealt|spent|lost|paid|laid|said|set|put|cut|shown|grown|drawn|known|taken|given|written|driven|chosen|frozen|worn|torn|born)\b/i],
  ['G5 대명사', /^(it|its|they|them|their|theirs|he|him|his|she|her|hers|one|ones|those|these|itself|themselves|himself|herself|oneself|ourselves)\b/i],
  ['G6 형용사·부사', /^(\w+ly)\b|^(most|much|very|so|too|such|as|more|less|far|well|good|bad|close|responsible|able|likely|possible|available|similar|different|important|difficult|necessary|aware|capable|useful|common|likely|sufficient)\b/i],
  ['G7 병렬', /^(and|or|but|nor)\b/i],
  ['G10 도치·강조·생략', /^(neither|only|not\s+until|little|never|rarely|hardly|seldom|no\s+sooner)\b/i],
]
