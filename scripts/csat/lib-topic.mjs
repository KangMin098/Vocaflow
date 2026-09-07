// scripts/csat/lib-topic.mjs
//
// **소재 분류기 — 기출과 재고를 같은 자로 잰다.**
//
// ── 왜 파일을 따로 두는가 ────────────────────────────────────────────
// 이 분류표는 원래 `measure-topic.mjs` 안에만 있었다. 그 파일은 "회차마다 소재 구성이
// 고정인가" 를 묻는 검정이라 **기출만** 잰다. 그런데 같은 물음이 반대편에서도 필요해졌다 —
// **우리 재고의 소재 구성이 기출과 같은가.** 두 값을 견주려면 분류표가 하나여야 한다.
// 복사해 두면 한쪽만 고쳐졌을 때 **격차가 아니라 분류표 차이를 재게 된다.**
//
// ⚠️ 이 분류기는 약하다 — 키워드 빈도 최다 득점이고 오분류가 있다. 그래도
//   **두 분포를 견주는 데는 성립한다**: 오류가 기출 쪽과 재고 쪽에 같은 방식으로 들어가기
//   때문이다. 개별 글의 소재를 단정하는 데는 쓰지 말 것 (margin 이 작으면 특히).
//
// ⚠️ `shared_dictionary.domain_levels` 는 쓸 수 없다 — 토픽 태그가 아니라 도메인별
//   난이도라서 거의 모든 낱말이 8개 값을 다 갖는다(34~37k/38k). 그래서 표를 여기 직접 적는다.

/** 소재 분류표 — 여기 다 적는다(숨은 규칙 없음). */
export const TOPICS = {
  '과학·자연': ['species', 'evolution', 'organism', 'cell', 'gene', 'biology', 'ecosystem', 'climate', 'physic', 'chemical', 'atom', 'energy', 'planet', 'universe', 'star', 'ocean', 'forest', 'animal', 'plant', 'bird', 'insect', 'brain', 'neuron', 'molecul', 'particle', 'quantum', 'earth', 'water', 'carbon', 'temperature', 'natural selection', 'predator', 'habitat'],
  '심리·인지': ['cognitive', 'psycholog', 'memory', 'perception', 'emotion', 'behavior', 'behaviour', 'motivation', 'attention', 'bias', 'belief', 'consciousness', 'attitude', 'mental', 'mind', 'learning', 'reasoning', 'decision', 'judgment', 'intuition', 'stress', 'happiness', 'personality'],
  '사회·경제': ['economic', 'market', 'consumer', 'trade', 'price', 'labor', 'labour', 'wealth', 'poverty', 'inequality', '政', '政策', 'policy', 'government', 'society', 'social', 'community', 'institution', 'democracy', 'law', 'political', 'capital', 'industry', 'firm', 'profit', 'employment', 'population', 'urban'],
  '기술·매체': ['technolog', 'computer', 'digital', 'internet', 'algorithm', 'data', 'software', 'machine', 'robot', 'artificial intelligence', 'network', 'media', 'smartphone', 'online', 'platform', 'engineer', 'invention', 'device', 'automation'],
  '예술·문화': ['art', 'artist', 'music', 'painting', 'literature', 'novel', 'poem', 'film', 'theater', 'theatre', 'aesthetic', 'culture', 'cultural', 'tradition', 'ritual', 'dance', 'sculpture', 'architect', 'design', 'style', 'creative', 'beauty'],
  '역사·인류': ['history', 'historical', 'ancient', 'century', 'civilization', 'archaeolog', 'anthropolog', 'medieval', 'empire', 'era', 'prehistoric', 'ancestor', 'human evolution', 'hunter', 'agricultur', 'origin'],
  '교육·언어': ['education', 'school', 'student', 'teacher', 'teaching', 'curriculum', 'language', 'linguistic', 'word', 'grammar', 'reading', 'writing', 'literacy', 'translat', 'communication', 'speech'],
  '철학·윤리': ['philosoph', 'ethic', 'moral', 'truth', 'knowledge', 'epistem', 'metaphys', 'virtue', 'justice', 'freedom', 'right', 'value', 'meaning of', 'existence', 'argument'],
}

/** 분류표 키 + 미달 라벨. 표 순서를 여기 한 곳에서 정한다. */
export const TOPIC_KEYS = [...Object.keys(TOPICS), '분류불가']

// 낱말마다 정규식을 매번 만들면 5만 편 × 200 낱말에서 그것만으로 수십 초가 든다.
// 표는 상수이므로 한 번만 만든다. (`lastIndex` 를 쓰는 `exec` 는 쓰지 않는다 — `match` 는
// 매번 0에서 시작하므로 g 플래그 정규식을 재사용해도 상태가 새지 않는다.)
const COMPILED = Object.entries(TOPICS).map(([k, kws]) => [
  k,
  kws.map((kw) => new RegExp('\\b' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')),
])

/**
 * 텍스트 → `{ topic, score, margin }`.
 * `margin` 은 1위와 2위의 득점 차 — 작으면 그 판정은 약하다.
 */
export function classify(text) {
  const t = String(text).toLowerCase()
  const score = {}
  for (const [k, res] of COMPILED) {
    let n = 0
    for (const re of res) n += (t.match(re) ?? []).length
    score[k] = n
  }
  const best = Object.entries(score).sort((a, b) => b[1] - a[1])
  if (!best[0][1]) return { topic: '분류불가', score, margin: 0 }
  return { topic: best[0][0], score, margin: best[0][1] - (best[1]?.[1] ?? 0) }
}
