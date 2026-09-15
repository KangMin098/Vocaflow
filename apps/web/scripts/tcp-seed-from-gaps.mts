// apps/web/scripts/tcp-seed-from-gaps.mts
//
// TCP 갭 → VCB 시드 JSONL (1차 배치).
//
// ── 왜 손으로 고르나 ──
// 기계 필터는 여기가 한계였다. 길이·모음·하이픈·4버킷 분류를 모두 통과한 뒤에도
// 후보 상위 500개의 절반가량이 **고유명사·브랜드·외래어·조판 아티팩트**였다:
//   linda · avon · paulo · messi (문장 첫머리에만 나온 인명 — 대문자 신호로 못 잡는다)
//   linkedin · pinterest · baidu · reddit · whatsapp · bitcoin (브랜드)
//   shinkansen · ryokan · machiya · nadrazi · hlavni (외래어 표기)
//   displaystyle · hellip · mathrm · frac · articlereuse (LaTeX·HTML 엔티티 잔재)
// 이것들을 사전에 등재하면 학습자에게 "배울 단어" 로 제시된다. 그래서 마지막 판정은
// 사람이 읽고 고른다 — 이 목록이 그 결과다.
//
// ── 이 배치의 범위 ──
// 1차 200건. 전량(진성 갭 4,855)을 한 번에 태우지 않는 이유는, 이번 세션에서 반복해서
// 확인한 것이 "큰 배치를 감으로 돌리면 나중에 헛돈 것을 발견한다" 였기 때문이다.
// 파이프라인을 끝까지 돌려 산출물 품질을 눈으로 본 뒤 규모를 정한다.
//
// 사용: npx tsx scripts/tcp-seed-from-gaps.mts <출력경로>

import { writeFileSync } from 'node:fs'

type Pos = 'NOUN' | 'VERB' | 'ADJ' | 'ADV' | 'PREP' | 'CONJ' | 'PRON' | 'DET' | 'INTJ'
type Cefr = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
type Tier = 'core' | 'common' | 'moderate' | 'rare'

interface SeedListItem {
  lemma: string
  pos: Pos
  cefr_estimate: Cefr
  frequency_tier: Tier
  rationale_short: string
  confidence: number
}

/** 한 묶음에 같은 pos/cefr/tier/근거를 부여한다 — 개별 예외는 아래 OVERRIDES 로 뺀다. */
interface Group {
  pos: Pos
  cefr: Cefr
  tier: Tier
  rationale: string
  words: string[]
}

const GROUPS: Group[] = [
  {
    pos: 'NOUN',
    cefr: 'C2',
    tier: 'rare',
    rationale: '광합성·세포생물학 전문 용어. 과학 지문 독해에 필요',
    words: [
      'photosystem', 'photosystems', 'thylakoid', 'thylakoids', 'mesophyll', 'plastids',
      'photorespiration', 'photophosphorylation', 'carboxylase', 'carboxylation',
      'ribulose', 'glycolate', 'glycerate', 'glyceraldehyde', 'phosphoglycolate',
      'phosphoenolpyruvate', 'pheophytin', 'chromophore', 'photopigment', 'melanopsin',
      'anhydrase', 'malate', 'acceptor', 'acceptors', 'conductance',
    ],
  },
  {
    pos: 'ADJ',
    cefr: 'C2',
    tier: 'rare',
    rationale: '광합성·생태 전문 형용사',
    words: [
      'photosynthetic', 'photorespiratory', 'oxygenic', 'anoxygenic', 'chemiosmotic',
      'mycorrhizal', 'arbuscular', 'multicellular', 'intracellular', 'radiative',
    ],
  },
  {
    pos: 'NOUN',
    cefr: 'C2',
    tier: 'rare',
    rationale: '진화·분류학 용어',
    words: [
      'speciation', 'macroevolution', 'cladogenesis', 'gradualism', 'superorder',
      'infraclass', 'archosaurs', 'xerophytes', 'outcrossing', 'euglenids',
      'crustacea', 'alga', 'seagrass', 'turbidity', 'metagenomes', 'microbiome',
      'plasticity', 'synuclein', 'halteres',
    ],
  },
  {
    pos: 'NOUN',
    cefr: 'C2',
    tier: 'rare',
    rationale: '의학·약학 용어. 건강 지문에 등장',
    words: [
      'amoxicillin', 'clavulanate', 'ceftazidime', 'cefotaxime', 'cefoxitin',
      'cloxacillin', 'trimethoprim', 'sulfamethoxazole', 'nitroglycerin',
      'dysregulation', 'gynecologist', 'neuroimaging', 'neurodiversity',
      'stressors', 'cannabinoid', 'cannabinoids', 'superbugs', 'coagulase',
    ],
  },
  {
    pos: 'ADJ',
    cefr: 'C1',
    tier: 'rare',
    rationale: '주산기·신경 의학 형용사',
    words: ['preterm', 'peripartum', 'prepartum', 'intrapartum', 'postural', 'prefrontal', 'treatable'],
  },
  {
    pos: 'NOUN',
    cefr: 'C1',
    tier: 'moderate',
    rationale: '천문·우주 용어. 과학 지문 빈출',
    words: [
      'spacetime', 'ergosphere', 'curvature', 'microlensing', 'insolation', 'sunspot',
      'sunspots', 'faculae', 'propellant', 'spaceflight', 'landers', 'rovers',
      'polarimeter', 'fluorescence', 'fluorometer', 'paleoclimate', 'seafloor',
      'subsurface', 'resupply',
    ],
  },
  {
    pos: 'ADJ',
    cefr: 'C2',
    tier: 'rare',
    rationale: '천체물리 형용사',
    words: ['supermassive', 'ultraluminous', 'cosmogenic', 'geospatial', 'toroidal', 'equipotential', 'extremal'],
  },
  {
    pos: 'VERB',
    cefr: 'C1',
    tier: 'rare',
    rationale: '천체 강착 현상 동사',
    words: ['accrete', 'accreting', 'infalling'],
  },
  {
    pos: 'NOUN',
    cefr: 'C1',
    tier: 'moderate',
    rationale: '통계·데이터 분석 용어',
    words: [
      'collinearity', 'triangulation', 'generalizability', 'treemap', 'validators',
      'analyzers', 'forecasters', 'deflator', 'midpoint', 'separator', 'linkage',
    ],
  },
  {
    pos: 'ADJ',
    cefr: 'C1',
    tier: 'moderate',
    rationale: '연구 설계 형용사',
    words: ['multivariable', 'bivariable', 'correlational', 'predefined', 'extractable'],
  },
  {
    pos: 'NOUN',
    cefr: 'B2',
    tier: 'common',
    rationale: '현대 기술·디지털 생활 어휘. 최근 지문에 빈출',
    words: [
      'esports', 'esport', 'startup', 'startups', 'smartwatch', 'smartwatches',
      'crowdfunding', 'gamification', 'audiobook', 'flashcards', 'walkthrough',
      'wearable', 'bioplastic', 'electrolyzer', 'stormwater', 'tailpipe',
      'dumpsites', 'signage', 'livability', 'decarbonisation',
    ],
  },
  {
    pos: 'NOUN',
    cefr: 'B2',
    tier: 'common',
    rationale: '사람·직군을 가리키는 파생 명사',
    words: [
      'salespeople', 'farmworkers', 'responders', 'graders', 'schoolers', 'holders',
      'suppliers', 'makers', 'biohackers', 'grandchildren', 'homelands',
    ],
  },
  {
    pos: 'NOUN',
    cefr: 'B1',
    tier: 'common',
    rationale: '일상 생활 명사',
    words: [
      'restroom', 'restrooms', 'lifestyle', 'campground', 'campervan', 'townhouses',
      'centerpiece', 'carryout', 'chainsaw', 'teacup', 'lightbulb', 'paycheck',
      'teamwork', 'superpower', 'wingspan', 'ambiance', 'oldies', 'parkour',
      'improv', 'soybean', 'soybeans', 'fibers', 'backlash', 'ceasefire',
      'hesitancy', 'transcendence', 'humankind', 'variant', 'info', 'cyber',
    ],
  },
  {
    pos: 'ADJ',
    cefr: 'B2',
    tier: 'common',
    rationale: '일상 형용사',
    words: ['reachable', 'upscale', 'reusable', 'underused', 'classy', 'onsite', 'southbound'],
  },
  {
    pos: 'VERB',
    cefr: 'B2',
    tier: 'common',
    rationale: '일상·업무 동사',
    words: [
      'normalize', 'prioritization', 'incentivize', 'internalize', 'reprogrammed',
      'reframe', 'renamed', 'rebuilt', 'shortened', 'withheld', 'earmarked', 'redo',
    ],
  },
  {
    pos: 'ADV',
    cefr: 'B1',
    tier: 'common',
    rationale: '고빈도 부사. 사전 미등재는 명백한 갭',
    words: ['anymore', 'whenever', 'wherever', 'anytime', 'anyhow', 'sometime', 'amongst'],
  },
  {
    pos: 'PRON',
    cefr: 'B1',
    tier: 'common',
    rationale: '복합 관계대명사',
    words: ['whoever'],
  },
]

/** 개별 예외 — 묶음 기본값과 다른 품사·수준 */
const OVERRIDES: Record<string, Partial<SeedListItem>> = {
  prioritization: { pos: 'NOUN', rationale: '우선순위 결정 행위를 가리키는 명사' },
  reprogrammed: { pos: 'VERB', cefr: 'C1', rationale: '재프로그래밍 과거·과거분사' },
  cyber: { pos: 'ADJ', rationale: '사이버- 결합형이 단독 형용사로 쓰이는 용법' },
  info: { cefr: 'A2', tier: 'core', rationale: 'information 의 구어 축약형' },
  variant: { cefr: 'B1', rationale: '변종·변이형. 감염병 지문 빈출' },
}

const seen = new Set<string>()
const items: SeedListItem[] = []

for (const g of GROUPS) {
  for (const w of g.words) {
    if (seen.has(w)) continue
    seen.add(w)
    items.push({
      lemma: w,
      pos: g.pos,
      cefr_estimate: g.cefr,
      frequency_tier: g.tier,
      rationale_short: g.rationale,
      confidence: 0.8,
      ...OVERRIDES[w],
    })
  }
}

const out = process.argv[2]
if (!out) {
  console.error('사용: tcp-seed-from-gaps.mts <출력경로>')
  process.exit(1)
}

writeFileSync(out, items.map((i) => JSON.stringify(i)).join('\n') + '\n', 'utf8')
console.log(`시드 ${items.length}건 → ${out}`)
const byPos = new Map<string, number>()
for (const i of items) byPos.set(i.pos, (byPos.get(i.pos) ?? 0) + 1)
console.log([...byPos].map(([p, n]) => `${p} ${n}`).join(' · '))
