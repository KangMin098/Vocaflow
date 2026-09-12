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
// ── 2026-09-07 개정 — 「약하다」가 아니라 **틀려 있었다** ────────────
// 손판독 144편(소스 15곳)으로 처음 재 봤다. **오분류율 23.6%.** 그리고 오류가 무작위가
// 아니라 **한 방향으로 쏠려 있었다** — 인문학 원문이 과학으로 갔다(예술·문화 재현율 50% ·
// 역사·인류 43%). 원인은 셋이고 전부 코드에 있었다.
//
//   ① **오른쪽 경계가 없었다.** `new RegExp('\\b' + kw)` 는 왼쪽만 잠근다. 그래서
//      `gene` 가 **general·generous·generic** 에, `art` 가 **article·artery·arthritis** 에,
//      `star` 가 **start** 에, `era` 가 **eran** 에 걸렸다. 실측: 타키투스 『역사』가
//      「general」 한 번으로 **과학·자연**이 됐고, 루소 『엘로이즈』는 「generous·generosity」
//      두 번으로 그렇게 됐다. PMC 정찰이 본 「생의학 논문 → 예술·문화」도 같은 자국이다
//      (`article` · `artery` · `design`).
//
//   ② **한 낱말이 무한히 득점했다.** 「Preventing Bias in Cluster Randomised Trials」은
//      `design` 이 11번 나온 것만으로 예술·문화 13점을 받았다. 연구방법 논문이다.
//      이제 낱말당 기여를 `1 + log2(빈도)` 로 눌러 **반복이 아니라 폭(distinct)** 이
//      이기게 한다.
//
//   ③ **동점이 조용히 첫 칸으로 갔다.** `sort` 가 안정 정렬이라 동점이면 **선언 순서 1위**
//      (과학·자연)가 이겼다. 1점 대 1점을 판정이라 부르지 않는다 — 이제 `분류불가`다.
//      「부족 0」이 인문 칸에서 나온 데에는 이 조용한 편향도 섞여 있었다.
//
// ⚠️ 여전히 키워드 분류기다. 개별 글의 소재를 **단정**하는 데 쓰지 말 것(margin 이 작으면
//   특히). 다만 이제는 **얼마나 틀리는지 아는 자**다 — `topic-accuracy.mjs --score` 가
//   손판독 144편으로 언제든 다시 잰다. 표를 고치면 그 수치가 같이 움직여야 한다.
//
// ⚠️ `shared_dictionary.domain_levels` 는 쓸 수 없다 — 토픽 태그가 아니라 도메인별
//   난이도라서 거의 모든 낱말이 8개 값을 다 갖는다(34~37k/38k). 그래서 표를 여기 직접 적는다.

/**
 * 소재 분류표 — 여기 다 적는다(숨은 규칙 없음).
 *
 * **표기 규약**
 *   `'word'`   낱말 전체로만 맞춘다. 규칙 굴절만 함께 허용한다 — `s · es · ed · d · ing`.
 *              그래서 `star` 는 stars 를 잡고 **start 를 안 잡는다.**
 *   `'stem*'`  **접두 일치**를 일부러 허용한다. 불규칙 파생이 많아 다 적을 수 없는 것만
 *              (`psycholog*` → psychology·psychological·psychologist). `*` 는 **의도의 표시**이지
 *              기본값이 아니다 — 옛 코드는 전부가 이것이었고 그래서 틀렸다.
 *   여러 낱말   `'natural selection'` 처럼 띄어쓰기 그대로 쓴다.
 */
export const TOPICS = {
  '과학·자연': [
    'species', 'evolution*', 'organism*', 'cell', 'gene', 'genetic*', 'genome*', 'biolog*',
    'ecosystem', 'ecolog*', 'climate', 'climatic', 'physics', 'physicist*', 'chemical*',
    'chemistry', 'atom', 'atomic', 'energy', 'planet', 'universe', 'galax*', 'star', 'stellar',
    'ocean*', 'forest', 'animal', 'plant', 'bird', 'insect', 'brain', 'neuron*', 'neural',
    'molecul*', 'particle', 'quantum', 'earth', 'water', 'carbon', 'temperature',
    'natural selection', 'predator*', 'habitat', 'fossil*', 'virus*', 'viral', 'bacteri*',
    'protein*', 'enzyme*', 'disease*', 'patient', 'clinical', 'medic*', 'therap*', 'symptom*',
    'diagnos*', 'tissue*', 'mutation*', 'chromosom*', 'metabolic', 'metabolism', 'earthquake*',
    'glacier*', 'seismic', 'orbit*', 'telescope*', 'atmosphere', 'atmospheric',
  ],
  '심리·인지': [
    'cognitive', 'cognition', 'psycholog*', 'memory', 'memories', 'perception', 'perceive',
    'emotion', 'emotional', 'behavior*', 'behaviour*', 'motivation', 'attention', 'bias',
    'belief', 'consciousness', 'attitude', 'mental', 'mind', 'reasoning', 'intuition',
    'stress', 'happiness', 'personality', 'anxiety', 'depression', 'empathy', 'self-esteem',
    'subconscious', 'unconscious', 'habit',
  ],
  '사회·경제': [
    'economic*', 'economy', 'economies', 'market', 'consumer', 'trade', 'price', 'labor',
    'labour', 'wealth', 'poverty', 'inequality', 'inequalities', 'policy', 'policies',
    'government*', 'society', 'societies', 'social', 'community', 'communities', 'institution',
    'democracy', 'democratic', 'law', 'political', 'politics', 'capital', 'industry',
    'industrial', 'firms', 'profit', 'employment', 'unemployment', 'population', 'urban',
    'tax', 'taxes', 'welfare', 'migration', 'migrant', 'election', 'voter', 'citizen',
    'household', 'income', 'wage',
  ],
  '기술·매체': [
    'technolog*', 'computer', 'computing', 'digital', 'internet', 'algorithm', 'software',
    'hardware', 'machine learning', 'robot', 'robotic*', 'artificial intelligence',
    'ai model', 'ai system', 'language model', 'chatbot', 'neural network*', 'network',
    'media', 'smartphone', 'online', 'platform', 'engineer*', 'invention', 'invent', 'device',
    'automation', 'automated', 'sensor', 'semiconductor*', 'programming', 'dataset',
    'database', 'simulation*', 'prototype*',
  ],
  '예술·문화': [
    'art', 'artist', 'artistic', 'music', 'musical', 'musician', 'painting', 'painter',
    'literature', 'literary', 'novels', 'novelist', 'poem', 'poet', 'poetry', 'poetic',
    'fiction', 'film', 'cinema', 'theater', 'theatre', 'theatrical', 'aesthetic*', 'culture',
    'cultural', 'tradition', 'traditional', 'ritual', 'dance', 'dancer', 'sculpture',
    'sculptor', 'architect*', 'museum', 'gallery', 'galleries', 'exhibition', 'drama',
    'dramatic', 'opera', 'symphony', 'composer', 'orchestra*', 'ballet', 'folklore', 'myth',
    'mythology', 'festival', 'craft', 'ornament*', 'style', 'creative', 'creativity', 'beauty',
    'portrait', 'genre', 'canvas', 'stage',
    // 산문 문예 — 발췌본은 「예술」이라는 낱말을 쓰지 않고 **그 갈래의 이름**을 쓴다
    'essay', 'prose', 'verse', 'stanza', 'satire', 'satirical', 'epigram', 'proverb',
    'romance', 'tragedy', 'comedy', 'author', 'writer', 'melody', 'harmony', 'song',
  ],
  '역사·인류': [
    'history', 'histories', 'historical', 'historian', 'ancient', 'century', 'centuries', 'civilization*',
    'civilisation*', 'archaeolog*', 'anthropolog*', 'medieval', 'mediaeval', 'empire',
    'emperor', 'era', 'prehistoric', 'ancestor', 'ancestral', 'human evolution', 'hunter',
    'agricultur*', 'dynasty', 'dynasties', 'kingdom', 'king', 'queen', 'monarch*', 'colonial',
    'colony', 'colonies', 'war', 'battle', 'treaty', 'treaties', 'tribe', 'tribal', 'nomad*',
    'artefact', 'artifact', 'excavation', 'manuscript', 'chronicle', 'feudal', 'reign',
    'conquest', 'invasion', 'peasant', 'nobility', 'aristocra*', 'antiquity',
    // 군사·고고 — 사서와 발굴 보고서가 실제로 쓰는 말. 이것이 없어서 타키투스 『역사』와
    // 『고대 석기』가 **분류불가**로 떨어졌다(2026-09-07 실측).
    'army', 'armies', 'soldier', 'troops', 'legion', 'regiment', 'commander', 'siege',
    'rebellion', 'revolt', 'senate', 'burial', 'tomb', 'neolithic', 'palaeolithic',
    'paleolithic', 'flint', 'relic', 'ruins', 'expedition', 'voyage', 'explorer',
  ],
  '교육·언어': [
    'education', 'educational', 'school', 'student', 'teacher', 'teaching', 'curriculum',
    'curricula', 'language', 'linguistic*', 'word', 'grammar', 'grammatical', 'reading',
    'writing', 'literacy', 'translat*', 'communication', 'speech', 'vocabulary', 'classroom',
    'pedagog*', 'learner', 'learning', 'dialect', 'syntax', 'semantic*', 'bilingual*',
    'textbook', 'tutor', 'tuition',
  ],
  '철학·윤리': [
    'philosoph*', 'ethic*', 'moral', 'morality', 'truth', 'knowledge', 'epistem*', 'metaphys*',
    'ontolog*', 'virtue', 'justice', 'freedom', 'liberty', 'rights', 'existence', 'argument',
    'dilemma', 'normative', 'skeptic*', 'sceptic*', 'autonomy', 'duty', 'duties', 'obligation',
    'conscience', 'meaning of life', 'metaphysical', 'dialectic*',
    // 논증의 말 — 이것이 없어서 아리스토텔레스·헤겔·플루타르코스가 **심리·인지**로 갔다.
    // (`reason` 은 일부러 뺀다 — "for this reason" 이 모든 산문에 있다. 굴절형만 쓴다.)
    'logic', 'logical', 'rational*', 'contradiction', 'proposition', 'premise', 'syllogism',
    'doctrine', 'wisdom', 'soul', 'essence', 'intellect*', 'idealism', 'materialism',
    'a priori', 'inference',
  ],
}

/**
 * **점수 매기기 전에 지우는 관용구.**
 *
 * 같은 철자가 두 소재에서 서로 다른 것을 뜻하는데, **앞뒤 한 낱말이 어느 쪽인지 이미
 * 말해 주는** 경우가 있다. 그런 것만 지운다 — 규칙이 아니라 **관측된 충돌**의 목록이고,
 * 새로 관측될 때만 는다.
 *
 *   cell culture   세포 배양 ≠ 문화        (PMC/PLOS 전 분야)
 *   oxidative stress 산화 스트레스 ≠ 심리 스트레스
 *   tropical depression 열대저기압 ≠ 우울    (USGS·NOAA 실측)
 *   informed consent 연구윤리 상용구 — 논문마다 나오므로 소재 신호가 아니다
 *   culture medium/media 배지 — `media`(기술·매체)까지 함께 오염시킨다
 */
const MASKS = [
  /\b(?:cell|bacterial|tissue|blood|cultured?\s+)?cultures?\s+(?:medium|media|supernatants?|dish(?:es)?|plates?)\b/g,
  /\b(?:cell|bacterial|tissue|blood|primary|stem\s+cell)\s+cultures?\b/g,
  /\b(?:oxidative|shear|heat|thermal|salt|drought|abiotic|mechanical)\s+stress\b/g,
  /\btropical\s+depressions?\b/g,
  /\binformed\s+consent\b/g,
  /\bstudy\s+designs?\b/g,
]

/** 분류표 키 + 미달 라벨. 표 순서를 여기 한 곳에서 정한다. */
export const TOPIC_KEYS = [...Object.keys(TOPICS), '분류불가']

/**
 * **분류판 번호 — 표나 규칙을 고치면 여기를 올린다.**
 *
 * 이 번호가 `csat_fit.topicV` 로 행에 함께 적히고, `topic-gap.mjs` 는 **이 번호가 맞는 행만**
 * 전수 집계로 센다. 올리지 않으면 무슨 일이 벌어지는가: 표를 고쳐도 DB 에는 옛 자로 잰
 * 라벨이 남아 있고, 격차 리포트는 **고치기 전 분류로 「부족 0」을 계속 답한다** —
 * 오류 없이, 조용히. 번호를 올리면 `topic-gap` 이 스스로 "표본으로 물러선다" 고 말한다.
 *
 *   1 → 2  (2026-09-07) 오른쪽 경계·빈도 감쇠·동점 처리·제목 가중·표 확장
 */
export const TOPIC_V = 2

/**
 * 판정 하한 — **이 밑은 판정이 아니라 우연이다.**
 *
 * 실측(2026-09-07): 타키투스 『역사』 6,000자에서 걸린 낱말은 **단 하나**(`general` 오탐)였고
 * 그 1점이 로마사 책을 과학·자연으로 보냈다. 오탐을 없애도 **1점짜리 승리는 신뢰할 수 없다.**
 *   · `MIN_SCORE` 2  — 서로 다른 낱말이 최소 둘은 걸려야 한다
 *   · `MIN_MARGIN` 1 — 동점은 판정이 아니다(옛 코드는 동점을 선언 순서로 몰래 깼다)
 * 기출 지문은 150어 안팎이라 하한을 더 올리면 `분류불가`가 급증한다 — 실측으로 정한 값이다.
 */
const MIN_SCORE = 2
const MIN_MARGIN = 0.001

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * 낱말 하나 → 정규식.
 *   `stem*` → `\bstem[a-z]*`      (접두 일치를 **일부러** 허용한 것)
 *   `word`  → `\bword(?:s|es|ed|d|ing)?\b`  (규칙 굴절까지만)
 *
 * ⚠️ 오른쪽 `\b` 가 이 파일의 핵심 수정이다. 빠지면 `gene` 가 `general` 을 먹는다 —
 *   회귀 `topic-classifier.test.ts` 가 그 변이를 잡는다.
 */
function compile(kw) {
  if (kw.endsWith('*')) return new RegExp('\\b' + escape(kw.slice(0, -1)) + '[a-z]*', 'g')
  return new RegExp('\\b' + escape(kw) + '(?:s|es|ed|d|ing)?\\b', 'g')
}

// 낱말마다 정규식을 매번 만들면 7만 편 × 300 낱말에서 그것만으로 수십 초가 든다.
// 표는 상수이므로 한 번만 만든다. (`lastIndex` 를 쓰는 `exec` 는 쓰지 않는다 — `match` 는
// 매번 0에서 시작하므로 g 플래그 정규식을 재사용해도 상태가 새지 않는다.)
const COMPILED = Object.entries(TOPICS).map(([k, kws]) => [k, kws.map(compile)])

/**
 * 제목을 본문에 몇 번 얹는가.
 *
 * 도서 발췌(gutenberg 25,740편 — 적합 재고의 37%)는 **책의 한가운데를 잘라 온 것**이라
 * 본문에 소재어가 거의 없다. 실측: 『고대 석기·무기·장식』 6,000자에서 걸린 소재어 **0개**,
 * 타키투스 『역사』 **1개**. 그런데 제목은 소재를 그대로 말하고 있었고 분류기는 그것을
 * **한 번도 보지 않았다.** 손판독 144편에서 제목을 3번 얹자 오분류 10.4% → **8.3%**,
 * 분류불가 6 → 3. 5번까지 늘려도 더 나아지지 않아 3으로 둔다.
 */
const TITLE_REPEAT = 3

/**
 * 텍스트 → `{ topic, score, margin }`.
 *
 * `score` 는 소재별 점수 객체, `margin` 은 1위와 2위의 차 — 작으면 그 판정은 약하다.
 * 낱말 하나의 기여는 **`1 + log2(빈도)`** 로 누른다: 같은 낱말이 11번 나온 것과 서로 다른
 * 낱말 11개가 한 번씩 나온 것은 같은 근거가 아니다(전자는 4.5점, 후자는 11점).
 *
 * `opts.title` 을 주면 제목을 가중해 함께 읽는다 — 있으면 반드시 넘길 것(위 `TITLE_REPEAT`).
 * 기출 지문에는 제목이 없으므로 선택 인자다.
 */
export function classify(text, opts = {}) {
  const title = String(opts.title ?? '').trim()
  let t = (title ? `${Array(TITLE_REPEAT).fill(title).join('. ')}. ` : '') + String(text)
  t = t.toLowerCase()
  for (const m of MASKS) t = t.replace(m, ' ')
  // 주석이 아니라 **타입**이다 — 이게 없으면 score 가 {} 로 추론돼 이 모듈을 읽는 회귀
  // (apps/web/src/lib/csat/__tests__/topic-classifier.test.ts)가 score['과학·자연'] 한 줄마다
  // TS7053 으로 죽는다(실측 13건). 검사가 못 도는 회귀는 회귀가 아니다.
  /** @type {Record<string, number>} */
  const score = {}
  for (const [k, res] of COMPILED) {
    let n = 0
    for (const re of res) {
      const hits = t.match(re)
      if (hits) n += 1 + Math.log2(hits.length)
    }
    score[k] = Math.round(n * 100) / 100
  }
  const best = Object.entries(score).sort((a, b) => b[1] - a[1])
  const margin = best[0][1] - (best[1]?.[1] ?? 0)
  if (best[0][1] < MIN_SCORE || margin < MIN_MARGIN) return { topic: '분류불가', score, margin }
  return { topic: best[0][0], score, margin }
}
