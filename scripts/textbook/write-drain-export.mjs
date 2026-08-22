// scripts/textbook/write-drain-export.mjs
//
// **집필 드레인 ①/③ — Claude Code 가 쓸 지문 몫을 청크로 뽑는다.**
//
// ── 왜 집필인가 ──────────────────────────────────────────────────────
// 사다리 아래쪽이 비어 있는 이유는 **문항이 모자라서가 아니라 원글이 모자라서**다.
// 한 단원 안에서는 원글이 겹칠 수 없으므로(같은 글을 두 번 읽히면 단원이 아니다),
// 조합기는 문항 수보다 **원글 수**에서 먼저 바닥난다. 2026-08-21 실측:
//
//   V2  원글 5편  → 0단원        V3  원글 8편  → 0단원
//   V4  원글 27편 → 8단원        V5·V6 은 20단원(한 권)
//
// 문항을 더 만들어도 소용없다 — 같은 원글에서 나온 문항은 한 단원에 하나만 들어간다.
// **글을 새로 써야 한다.** 그게 Claude Code 의 몫이다(CLAUDE.md §🤖).
//
// ── 길이는 밴드를 못 정한다 ──────────────────────────────────────────
// 처음에는 어수 규격만 주면 될 줄 알았다. **아니었다.** 기존 집필분 6편의 목표 밴드와
// 실제 배정을 대조하니 맞은 것이 2편뿐이었다(2026-08-21 실측):
//
//   170어 목표 V3 → 실제 V2      149어 목표 V8 → 실제 V4      108어 목표 V2 → 실제 V2 ✅
//   183어 목표 V4 → 실제 V4 ✅   179어 목표 V6 → 실제 V4      188어 목표 V6 → 실제 V3
//
// 밴드를 정하는 것은 `compute_article_vrl` 이고, 그 방법은 `p75_type_v11_excluded_article` —
// **글에 쓰인 서로 다른 낱말의 V-Level 75분위**다. 길이는 거기 안 들어간다.
// 그래서 지침은 어휘로 준다: 그 밴드 사전 낱말을 실제로 뽑아 청크에 실어 보낸다.
//
// 어수는 밴드가 아니라 **문항이 나오는지**를 좌우한다 — 조합기가 쓰는 창이 90~200어이므로
// 그 안에 들어야 한다. 그건 규격이지 측정이 아니고, 아래 상수에 근거를 적어 둔다.
//
// ── 저작권 ───────────────────────────────────────────────────────────
// 창작이므로 `source='original'` · `license='CC0-1.0 (Vocaflow Original)'` 이다.
// **시중 교재를 입력으로 쓰지 않는다** — 소재만 정하고 문장은 새로 쓴다.
//
// 재실행 안전: 읽기만 한다. 청크 파일은 덮어쓴다. 이미 있는 제목은 슬롯에서 뺀다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/write-drain-export.mjs --band 3 --need 40 --size 5

import fs from 'node:fs'
import path from 'node:path'

import { loadEnv, fetchAllIn } from './volume-pool.mjs'

loadEnv()
const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const BAND = Number(arg('band') ?? 3)
const SIZE = Number(arg('size') ?? 5)
/**
 * 글의 갈래. 기본은 설명문(`expository`), 다른 하나가 **서사문**(`narrative`)이다.
 *
 * ⚠️ 갈래를 나눈 이유는 취향이 아니라 **수율 0 이 실측됐기 때문**이다. 분위기(mood) 유형은
 *   배치를 돌려도 **0/16** 이 나왔다 — 재고가 전부 설명문이라 "글의 분위기" 를 물을 지문이
 *   하나도 없었다. 장문 43~45(서사 지문 전제)도 같은 벽에 막혀 있다.
 *   **지문 풀을 바꾸지 않는 한 배치를 더 돌려도 같은 결과다**(`csat-types.ts` mood 주석).
 */
const MODE_ARG = arg('mode')
const MODE =
  MODE_ARG === 'narrative' ? 'narrative' : MODE_ARG === 'long-narrative' ? 'long-narrative' : 'expository'
/** 서사 갈래인가 — 축·짜임·규칙을 공유한다. 길이만 다르다. */
const IS_NARRATIVE = MODE === 'narrative' || MODE === 'long-narrative'
const MODE_SUFFIX = MODE === 'narrative' ? '-narr' : MODE === 'long-narrative' ? '-long' : ''
const DIR = path.resolve(
  // 갈래마다 청크 디렉터리를 나눈다 — 섞이면 배치가 어느 지침으로 쓸지 알 수 없다.
  arg('dir') ?? `scripts/textbook/write-drain/v${BAND}${MODE_SUFFIX}`,
)

/**
 * 한 권(20단원)에 필요한 원글 수.
 *
 * ⚠️ **처음에 60 으로 잡았다가 틀렸다.** 근거로 삼은 것이 "V6 는 원글 58편으로 20단원" 이었는데,
 *   V6 의 원글은 평균 3,000어짜리 외부 기사라 문단이 많아 **편당 문항이 9개**다(517/58).
 *   반면 우리가 쓰는 교재 지문은 130~190어라 문단이 둘뿐이고 **편당 문항이 4개**를 넘지 못한다
 *   (순서 2 + 삽입 2). 원글 하나가 한 단원에 문항 하나만 낼 수 있으므로, 짧은 지문으로 책을
 *   채우려면 **원글 수 자체가 훨씬 많아야 한다.**
 *
 *   실측(2026-08-21): V3 는 문항 붙은 원글 40편으로 **8단원**에서 멈췄다 — 단원당 약 5편이다.
 *   20단원이면 **80편 이상**이 필요하다. 그래서 85 로 올린다.
 *
 * 이 수를 낮게 잡으면 export 가 "다 썼다" 고 말하는데 책은 안 나온다 — 가장 나쁜 종류의 거짓말이다.
 */
const VOLUME_ARTICLES = 85

/**
 * 소재 축.
 *
 * 시중 독해 교재가 한 권 안에서 소재를 흩는 이유는 **한 분야를 아는 학습자만 유리해지는 것을
 * 막기 위해서**다. 축을 고정해 두고 슬롯을 돌려 배분한다 — 그래야 쏠림이 우연에 안 맡겨진다.
 * (수능 지문의 실제 분포를 모사한 것이 아니라, 분야가 겹치지 않게 나눈 것이다.
 *  "수능과 같은 비율" 이라고 주장하려면 기출을 세어야 하는데 그건 아직 안 했다.)
 */
// ⚠️ **축만으로는 모자란다.** 축 8개 × 짜임 5개 = 40조합으로 150편을 쓰자 집필 배치가 잡은
//   소재가 기존 글과 겹치기 시작했다(한 배치가 다섯 편을 통째로 갈아탔다고 보고했다).
//   축이 넓을수록 배치는 "그 축에서 가장 떠오르기 쉬운 소재" 로 수렴한다 — 개구리·별·다리처럼.
//   그래서 축마다 **하위 주제**를 두고 슬롯마다 다른 것을 준다. 조합 공간이 40 → 320 이 된다.
const TOPIC_AXES = [
  {
    key: 'life_science',
    label: '생명·자연',
    hint: '동식물의 행동·적응, 생태계의 관계, 몸의 작동',
    subs: ['먹이를 찾는 방식', '추위·더위를 견디는 몸', '무리 지어 사는 규칙', '씨앗과 번식', '위장과 신호', '기생과 공생', '밤에 활동하는 동물', '되살아나는 숲'],
  },
  {
    key: 'earth_space',
    label: '지구·우주',
    hint: '날씨·지형·바다·행성, 관측으로 알아낸 것',
    subs: ['해류와 기온', '흙과 침식', '지하수와 샘', '조수와 달', '얼음과 빙하', '화산과 온천', '대기의 층', '먼 곳을 재는 법'],
  },
  {
    key: 'technology',
    label: '기술·공학',
    hint: '도구와 재료가 문제를 푸는 방식, 설계의 절충',
    subs: ['접합과 이음', '열을 다루는 구조', '무게를 견디는 형태', '물을 막고 흘리는 법', '소리를 다루는 설계', '일부러 약하게 만든 부품', '규격이 생긴 이유', '오래 쓰기 위한 정비'],
  },
  {
    key: 'society',
    label: '사회·경제',
    hint: '사람들이 모여 정하는 규칙, 자원의 배분, 도시',
    subs: ['줄 서기와 차례', '공유지의 관리', '가격이 정해지는 자리', '길과 통행', '쓰레기와 재사용', '이웃 간의 소음', '공공장소의 규칙', '일과 휴식의 배분'],
  },
  {
    key: 'history',
    label: '역사·문화',
    hint: '옛 사람들의 생활과 그것이 남긴 흔적, 관습의 유래',
    subs: ['이름과 호칭의 유래', '옛 저장 기술', '길과 표지의 역사', '측정 단위의 통일', '기록을 남기는 방법', '축제와 계절', '옷과 신분', '옛 지도의 오류'],
  },
  {
    key: 'arts',
    label: '예술·매체',
    hint: '음악·미술·건축·이야기의 형식과 그 형식이 하는 일',
    subs: ['반복이 하는 일', '여백과 침묵', '색을 섞는 규칙', '시점과 거리', '무대와 관객의 자리', '제목이 하는 일', '모작과 변주', '재료가 정하는 형식'],
  },
  {
    key: 'mind',
    label: '심리·학습',
    hint: '주의·기억·습관·판단이 작동하는 방식',
    subs: ['익숙함과 앎의 차이', '방해를 받은 뒤 돌아오기', '순서가 기억에 남기는 것', '한꺼번에 담을 수 있는 양', '미루는 이유', '남의 판단을 따라가기', '틀린 기억이 만들어지는 법', '쉬는 동안 일어나는 정리'],
  },
  {
    key: 'health_sport',
    label: '건강·운동',
    hint: '몸을 쓰는 일과 회복, 음식과 수면',
    subs: ['준비 운동이 하는 일', '땀과 체온', '자세와 부담', '회복에 걸리는 시간', '물과 갈증', '잠의 단계', '나이와 유연성', '통증이 알리는 것'],
  },
]

/**
 * 글의 짜임.
 *
 * `order`(순서)와 `insert`(삽입) 문항은 **문장 사이의 결속**으로 답이 정해진다. 짜임을
 * 지정하지 않고 쓰면 결속이 약한 나열문이 나오고, 그러면 문항을 만들 수 없거나 답이 둘이 된다.
 */
const SHAPES = [
  {
    key: 'phenomenon_cause',
    label: '현상 → 원인 → 의의',
    hint: '눈에 보이는 일을 먼저 말하고, 왜 그런지 밝히고, 그래서 무엇이 달라지는지로 맺는다.',
  },
  {
    key: 'problem_attempt_result',
    label: '문제 → 시도 → 결과',
    hint: '무엇이 곤란했는지, 어떻게 해 봤는지, 무엇이 남았는지. 시도가 둘이면 순서가 분명해진다.',
  },
  {
    key: 'general_example',
    label: '총론 → 사례 → 되짚기',
    hint: '일반적인 말을 먼저 놓고 구체적인 사례로 받은 뒤, 그 사례가 무엇을 보여 주는지로 닫는다.',
  },
  {
    key: 'before_after',
    label: '이전 → 변화 → 이후',
    hint: '시간 순서가 곧 글의 순서다. 연도나 단계 표시를 문장 안에 넣어 순서를 붙들어 둔다.',
  },
  {
    key: 'claim_counter',
    label: '통념 → 반전 → 수정된 결론',
    hint: '흔히 그렇게 안다고 말한 뒤 However 로 뒤집고, 그래서 어떻게 봐야 하는지로 맺는다.',
  },
]

/**
 * 서사문의 축 — **사람과 그날**이 소재다.
 *
 * 설명문 축(`TOPIC_AXES`)을 그대로 쓰면 안 된다. 「접합과 이음」을 1인칭으로 쓰라고 하면
 * 설명문에 'I' 만 붙는다. 분위기 유형이 묻는 것은 **장면이 주는 인상**이므로,
 * 축 자체가 장면이어야 한다.
 */
const NARRATIVE_AXES = [
  {
    key: 'first_day',
    label: '처음 해 보는 일',
    hint: '서툰 첫날. 무엇을 몰랐고 무엇에 놀랐는지가 장면으로 남는다.',
    subs: ['낯선 교실의 첫 시간', '처음 맡은 심부름', '혼자 타 본 먼 길', '처음 서 본 무대', '새 이웃과의 첫 인사', '처음 만든 음식', '처음 돌본 동물', '처음 고쳐 본 물건'],
  },
  {
    key: 'waiting',
    label: '기다리는 시간',
    hint: '아직 일어나지 않은 일을 기다리는 동안의 마음. 시간이 늘어지는 감각을 장면으로.',
    subs: ['결과 발표 전날', '늦는 사람을 기다리며', '비가 그치기를', '진료실 앞 복도', '기차가 오기까지', '편지의 답을 기다리며', '씨앗이 돋기를', '차례가 오기까지'],
  },
  {
    key: 'loss_and_find',
    label: '잃음과 되찾음',
    hint: '잃어버린 것을 찾는 과정. 찾는 동안 다른 것이 보인다.',
    subs: ['잃어버린 열쇠', '이름을 잊은 얼굴', '없어진 사진', '길을 잃은 오후', '집을 나간 반려동물', '망가진 오래된 물건', '두고 온 우산', '잊고 있던 약속'],
  },
  {
    key: 'work_beside',
    label: '곁에서 일하는 사람',
    hint: '누군가의 일하는 모습을 곁에서 지켜본 기록. 관찰이 곧 인물의 성격이 된다.',
    subs: ['새벽에 문을 여는 가게', '고치는 사람의 손', '가르치는 사람의 침묵', '길에서 파는 사람', '밤에 일하는 사람', '오래 한 자리를 지킨 사람', '남을 대신 기다려 주는 사람', '떠나는 날의 인수인계'],
  },
  {
    key: 'weather_day',
    label: '날씨가 만든 하루',
    hint: '날씨가 계획을 바꾼 날. 바깥의 변화가 안의 기분을 끌고 간다.',
    subs: ['갑자기 내린 눈', '오래 이어진 가뭄', '바람이 심한 저녁', '안개 낀 아침', '길게 이어진 장마', '너무 이른 더위', '천둥이 치던 밤', '오랜만의 맑은 날'],
  },
  {
    key: 'returning',
    label: '돌아온 자리',
    hint: '오랜만에 돌아간 곳이 달라져 있다. 기억과 지금을 겹쳐 보는 시선.',
    subs: ['옛 학교 운동장', '이사 간 동네', '문 닫은 가게 앞', '자란 나무 아래', '오래된 방', '다시 만난 친구', '고향의 정류장', '남아 있는 낙서'],
  },
  {
    key: 'small_kindness',
    label: '작은 호의',
    hint: '크지 않은 도움을 주고받은 일. 과장하지 않아야 장면이 산다.',
    subs: ['우산을 나눠 쓴 길', '자리를 양보한 순간', '이름을 기억해 준 사람', '두고 간 물건을 챙겨 준 이', '말없이 도운 손', '길을 알려 준 사람', '몫을 남겨 둔 그릇', '기다려 준 몇 분'],
  },
  {
    key: 'making_and_failing',
    label: '만들다 실패한 것',
    hint: '공들여 만들었으나 뜻대로 안 된 일. 실패가 남긴 것이 결말이 된다.',
    subs: ['무너진 모형', '타 버린 빵', '어긋난 이음매', '지워진 그림', '끊어진 줄', '맞지 않은 치수', '늦어 버린 준비', '고치다 더 망친 것'],
  },
]

/**
 * 서사문의 짜임.
 *
 * 순서·삽입 문항은 **문장 사이의 결속**으로 답이 정해진다. 서사문은 시간 순서라는 강한
 * 결속을 이미 갖고 있어 오히려 유리하지만, **시간 표지가 없으면** 어느 문장이든 앞뒤가
 * 되어 답이 둘이 된다. 그래서 짜임마다 표지를 명시한다.
 */
const NARRATIVE_SHAPES = [
  {
    key: 'that_day',
    label: '1인칭 회상 — 그날의 장면',
    hint:
      '나(I)가 과거형으로 그날을 되짚는다. 첫 문장에서 언제·어디인지 밝히고, 시간 표지' +
      '(that morning · by noon · later · at last)로 순서를 붙들어 둔다. 마지막 문장은 그날이 남긴 것.',
  },
  {
    key: 'watching_someone',
    label: '3인칭 관찰 — 한 사람을 지켜봄',
    hint:
      '한 인물을 밖에서 지켜본다. 이름을 정해 그 이름으로 부르고, 동작과 말만 적는다. ' +
      '속마음을 직접 설명하지 않는다 — 분위기는 동작에서 나와야 문항이 성립한다.',
  },
  {
    key: 'turn_of_mood',
    label: '분위기의 전환 — 앞과 뒤가 다르다',
    hint:
      '앞부분과 뒷부분의 인상이 뚜렷이 갈린다(고요→소란, 불안→안도 같은 방향). ' +
      '전환점이 되는 문장을 하나 두고, 그 앞뒤로 쓰는 낱말의 결을 바꾼다.',
  },
]

/**
 * 장문(수능 43~45)의 짜임 — **네 토막으로 갈라 읽히는 이야기.**
 *
 * 43번이 "(A) 다음에 올 순서" 를 묻기 때문에, 글이 (A)(B)(C)(D) **네 문단**으로 갈리고
 * 각 문단이 스스로 한 장면이어야 한다. 문단이 셋이면 답지가 6가지뿐이라 문항이 안 서고,
 * 다섯이면 시험지 형식에서 벗어난다.
 *
 * ⚠️ **문단마다 6문장**이어야 한다. 적재기의 `repaginate` 가 "모든 문단이 6~10문장" 일 때만
 *   원문 문단을 그대로 두기 때문이다 — 5문장으로 쓰면 적재하면서 문단이 다시 합쳐져
 *   네 토막 구조가 사라진다(그러면 43번을 만들 수 없다).
 */
const LONG_NARRATIVE_SHAPES = [
  {
    key: 'four_scenes',
    label: '네 장면 — (A) 발단 → (B)(C)(D) 전개·전환·매듭',
    hint:
      '문단 넷이 각각 한 장면이다. (A) 는 인물과 상황을 세우고 **끝을 열어 둔다**(다음 장면이 궁금해지게). ' +
      '나머지 셋은 시간 표지로 순서를 못 박는다 — 순서를 바꾸면 말이 안 되어야 43번이 성립한다. ' +
      '**인물이 둘 이상**이고 각자 이름이 있어야 한다(44번 지칭이 그 둘을 헷갈리게 묻는다). ' +
      '대명사(he/she/him/her)를 문단마다 여러 번 쓰되, 누구를 가리키는지 문맥으로 분명해야 한다.',
  },
  {
    key: 'two_people',
    label: '두 사람 — 한 사건을 사이에 두고',
    hint:
      '이름 있는 두 인물이 번갈아 초점이 된다. (A) 에서 둘을 세우고, (B)(C)(D) 에서 한 사람의 행동이 ' +
      '다른 사람에게 닿는 순서로 잇는다. 각 문단에 상대를 가리키는 대명사가 최소 두 번 나와야 한다. ' +
      '시간 표지(that afternoon · the next day · a week later)로 순서를 고정한다.',
  },
  {
    key: 'return_and_learn',
    label: '되찾음 — 잃음 → 찾아 나섬 → 만남 → 남은 것',
    hint:
      '(A) 에서 무엇을 잃었는지 보이고, (B)(C) 에서 찾아 나선 과정을 시간 순으로, (D) 에서 무엇이 남았는지로 닫는다. ' +
      '도와주는 인물을 하나 두어 이름을 붙인다(지칭 문항의 대조군). 마지막 문단이 앞 세 문단을 되짚지 않게 — ' +
      '되짚으면 45번 일치 문항의 근거가 한곳에 몰린다.',
  },
]

/** 이번 실행이 쓸 축·짜임. 갈래를 섞지 않는다. */
const AXES = IS_NARRATIVE ? NARRATIVE_AXES : TOPIC_AXES
const SHAPE_POOL =
  MODE === 'long-narrative' ? LONG_NARRATIVE_SHAPES : MODE === 'narrative' ? NARRATIVE_SHAPES : SHAPES

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// ── 재고 실측 ───────────────────────────────────────────────────────
const { data: arts, error } = await db
  .from('library_articles')
  .select('id, title, article_v_level, display_only, status, word_count, source')
  .in('status', ['ready', 'published'])
if (error) throw new Error('기사 조회 실패: ' + error.message)
const usable = (arts ?? []).filter((a) => !a.display_only)
const inBand = usable.filter((a) => a.article_v_level === BAND)

/**
 * 어수 규격.
 *
 * **측정값이 아니라 규격이다.** 근거는 둘이다:
 *   · 조합기가 지문으로 쓰는 창이 90~200어(`selectPassageWindow`)라 그 밖이면 문항이 안 나온다.
 *   · 기존 집필분 중 목표 밴드에 실제로 떨어진 두 편이 108어·183어였다.
 * 밴드와는 무관하다 — 밴드는 아래 어휘층이 정한다.
 */
// ⚠️ **처음에 130~190 으로 잡았다가 틀렸다.** 조합기가 거르는 것은 글 전체가 아니라
//   **문항 하나의 지문**, 즉 문단이다(`CSAT_ITEM_WORDS` 90~200어). 12문장 글을 6+6 으로
//   나누면 문단이 각각 절반이므로, 글이 180어 미만이면 **문단이 90어를 못 넘겨 통째로 걸린다.**
//   실측(2026-08-21): V2 풀 282개 중 **154개가 "지문 짧음" 으로 탈락**했다 — 삽입 본문 규격
//   탈락(45)보다 세 배 넘게 큰 병목인데, 그동안 이 숫자를 안 보고 있었다.
//   두 문단이 각각 90어를 넘으려면 글이 **최소 185어**여야 한다.
// ⚠️ **장문(43~45)은 규격이 다르다.** 수능 장문은 지문 하나가 300어 안팎이고, 그 한 편에
//   순서·지칭·일치 세 문항이 붙는다. 짧은 지문의 창(90~200어)을 그대로 대면 장문이 통째로 걸린다.
//   문단 넷 × 6문장이면 대략 300~340어가 된다 — 그 규격으로 준다.
const IS_LONG = MODE === 'long-narrative'
const WORDS_MIN = IS_LONG ? 300 : 185
const WORDS_MAX = IS_LONG ? 340 : 200

/**
 * 어휘 조건 — **꼬리 낱말 수가 곧 계단이다.**
 *
 * 목표 밴드에 떨어뜨리는 법을 세 점으로 실측했다(`article_v_level` 대 목표, 2026-08-21):
 *
 *   | 꼬리(V+1~V+2 낱말) | 편수 | 적중률 | 아래로 | 위로 | 평균 어긋남 |
 *   |---|---|---|---|---|---|
 *   | 0개  (V3 목표) | 10 | 20%   | 6 | 2  | **−0.40** |
 *   | 4~5개 (V2 목표) | 12 | **75%** | 0 | 3  | **+0.33** |
 *   | 7~9개 (V3 목표) | 52 | 13.5% | 1 | 44 | **+1.00** |
 *
 * 평균 어긋남이 꼬리 수에 **단조롭게** 따라간다(−0.40 → +0.33 → +1.00). 낱말 하나당
 * 약 0.17계단이다. 그래서 기본을 4 로 둔다 — 적중 75% 가 실측된 유일한 값이다.
 *
 * ⚠️ **한계**: 가운데 점만 목표가 V2 이고 나머지 둘은 V3 이다. 꼬리 수만 다른 것이 아니므로
 *   기울기는 믿되 최적값 4 는 아직 한 밴드에서만 확인됐다. V3 대량 집필이
 *   같은 조건의 재확인을 겸한다 — 거기서 어긋나면 이 기본값을 다시 잰다.
 */
const TAIL_MIN = Number(arg('tail') ?? 4)
const TAIL_MAX = TAIL_MIN + 1
const AT_MIN = Number(arg('at') ?? 12)
const AT_MAX = AT_MIN + 2

// ── 그 밴드의 어휘층 — 여기가 밴드를 정한다 ─────────────────────────
// `compute_article_vrl` 은 글에 쓰인 **서로 다른 낱말의 V-Level 75분위**로 밴드를 매긴다.
// 그러니 "V3 글을 써라" 는 지시는 "쓰는 낱말의 75%가 V3 이하가 되게 써라" 와 같다.
// 짐작하지 않도록 사전에서 실제 낱말을 뽑아 청크에 실어 보낸다.
//
// ⚠️ **"75% 가 V<밴드> 이하" 는 지침이 못 된다.** 파일럿 10편에서 적중 2편(20%)이었고,
//   떨어진 8편은 전부 **아래로** 떨어졌다(V2 6 · V4 2). 안전하게 쉬운 낱말만 써서
//   p75 가 2 로 주저앉은 것이다.
//
//   재고 실측을 보면 V3 글의 프로필은 이렇다 — p50 **1.5** · p75 **3** · p90 **5.2**.
//   즉 **절반은 아주 쉬운 낱말이고, 상위 10% 는 V5 까지 올라간다.** 그 꼬리가 있어야
//   p75 가 3 이 된다. "이하로 유지" 만 시키면 꼬리가 안 생긴다.
//
//   그래서 아래에서 **셀 수 있는 목표**로 바꾼다 — 몇 낱말을 어느 층에서 쓸지.
const lexicon = { at: [], below: [], avoid: [] }
/** 그 밴드 재고의 실제 프로필. 짐작하지 않는다. */
let profile = null
{
  const { data, error } = await db
    .from('library_articles')
    .select('vrl_components')
    .eq('article_v_level', BAND)
    .in('status', ['ready', 'published'])
    .eq('display_only', false)
    .not('vrl_components', 'is', null)
    .limit(200)
  if (error) throw new Error('프로필 조회 실패: ' + error.message)
  const rows = (data ?? []).filter((r) => r.vrl_components?.p75 != null)
  if (rows.length) {
    const avg = (k) => rows.reduce((s, r) => s + Number(r.vrl_components[k] ?? 0), 0) / rows.length
    profile = {
      samples: rows.length,
      p50: Math.round(avg('p50') * 10) / 10,
      p75: Math.round(avg('p75') * 10) / 10,
      p90: Math.round(avg('p90') * 10) / 10,
    }
  }
}
{
  /**
   * 그 층의 낱말을 **알파벳 전 구간에서 고르게** 뽑는다.
   *
   * ⚠️ 앞에서부터 120개를 받으면 전부 `a…` 로 시작한다 — 실제로 그렇게 나왔다.
   *   그런 목록은 어휘층을 보여 주지 못하고, 그걸 지침이라고 주면 집필이 한쪽으로 쏠린다.
   *   그래서 총수를 먼저 세고 창을 여러 개로 나눠 흩어 뽑는다.
   */
  const pick = async (min, max, limit) => {
    // ⚠️ 카운트 질의는 **따로 만든다.** 이미 `.select('word')` 가 붙은 빌더에 다시
    //   `.select(…, {count})` 를 겹치면 질의가 망가져 count 가 null 로 오고, 그러면
    //   낱말 목록이 조용히 빈 채로 나간다.
    const base = () =>
      db.from('shared_dictionary').select('word').gte('v_level', min).lte('v_level', max).not('meaning_ko', 'is', null)
    const { count, error: ce } = await db
      .from('shared_dictionary')
      .select('word', { count: 'exact', head: true })
      .gte('v_level', min)
      .lte('v_level', max)
      .not('meaning_ko', 'is', null)
    if (ce) throw new Error('사전 조회 실패: ' + ce.message)
    if (!count) return []
    const WINDOWS = 12
    const per = Math.max(1, Math.ceil(limit / WINDOWS))
    const out = []
    for (let w = 0; w < WINDOWS && out.length < limit; w++) {
      const from = Math.min(count - 1, Math.floor((count * w) / WINDOWS))
      const { data, error } = await base().order('word').range(from, from + per - 1)
      if (error) throw new Error('사전 조회 실패: ' + error.message)
      for (const r of data ?? []) if (out.length < limit) out.push(r.word)
    }
    return out
  }
  lexicon.at = await pick(BAND, BAND, 120)
  lexicon.below = await pick(Math.max(0, BAND - 2), Math.max(0, BAND - 1), 120)
  lexicon.avoid = await pick(BAND + 1, BAND + 3, 80)
}

// 문항이 실제로 나오는지 — 원글마다 order/insert 가 몇 개 붙었나.
const items = await fetchAllIn(
  db,
  'csat_dcp_items',
  'id, ref_id, type, kind',
  'ref_id',
  inBand.map((a) => a.id),
  ['id'],
)
const withItems = new Set(
  items.filter((r) => r.kind === 'article' && (r.type === 'order' || r.type === 'insert')).map((r) => r.ref_id),
)

const need = arg('need') ? Number(arg('need')) : Math.max(0, VOLUME_ARTICLES - withItems.size)

// 이미 있는 제목 — 소재가 겹치면 한 권 안에서 같은 이야기를 두 번 읽힌다.
const takenTitles = new Set(usable.map((a) => String(a.title).toLowerCase().trim()))

// ── 슬롯 번호는 **이어 붙인다** ─────────────────────────────────────
//
// ⚠️ 슬롯 번호가 실행마다 1 부터 다시 시작하면 `import` 의 유일키(`original:v<밴드>-<슬롯>`)가
//   지난 실행과 겹친다. 그러면 새로 쓴 글이 "이미 있음" 으로 **조용히 버려진다** —
//   집필은 다 해 놓고 적재만 0 이 되는데, 로그는 정상으로 보인다.
//   그래서 이미 쓰인 번호 다음부터 매긴다.
let slotBase = 0
{
  const { data, error } = await db
    .from('library_articles')
    .select('source_id')
    .eq('source', 'original')
    .like('source_id', `original:v${BAND}-%`)
  if (error) throw new Error('슬롯 조회 실패: ' + error.message)
  for (const r of data ?? []) {
    const n = Number(String(r.source_id).split('-').pop())
    if (Number.isFinite(n) && n > slotBase) slotBase = n
  }
}

// 축·짜임·하위 주제를 **서로 다른 주기로** 돌린다. 8·5·8 이라 슬롯 320 개까지 조합이 겹치지 않는다.
// 하위 주제까지 지정하는 이유는 위 주석 참조 — 축만 주면 배치가 같은 소재로 수렴한다.
// 슬롯 번호는 지난 실행에서 이어지므로 **다시 뽑아도 같은 하위 주제가 반복되지 않는다.**
const tasks = []
for (let i = 0; i < need; i++) {
  const n = slotBase + i
  const axis = AXES[n % AXES.length]
  const shape = SHAPE_POOL[n % SHAPE_POOL.length]
  const sub = axis.subs[Math.floor(n / AXES.length) % axis.subs.length]
  tasks.push({
    slot: slotBase + i + 1,
    v_level: BAND,
    topic_axis: axis.label,
    topic_sub: sub,
    topic_hint: `${axis.hint} — 이번 슬롯은 **${sub}** 를 다룬다. 다른 슬롯과 소재가 겹치지 않게 이 범위 안에서 쓴다.`,
    shape: shape.label,
    shape_hint: shape.hint,
    mode: MODE,
    // 서사문일 때만 붙는 규칙. 설명문 지침과 섞이면 'I' 만 붙은 설명문이 나온다.
    narrative_rule: IS_NARRATIVE
      ? '사람이 등장하고 시간이 흐르는 **이야기**를 쓴다. 과거형으로 쓰고, 시간 표지로 ' +
        '순서를 붙들어 둔다. 정의·통계·일반론 문장을 쓰지 않는다 — 그런 문장이 들어가면 ' +
        '설명문이 되고, 분위기·심경 문항이 성립하지 않는다.'
      : null,
    // 장문에만 붙는 형식 규칙. 이걸 어기면 43번(순서)을 아예 못 만든다.
    long_rule: IS_LONG
      ? '문단을 정확히 **넷**으로 나눈다(빈 줄로 구분). **각 문단은 정확히 6문장**이다 — ' +
        '적재기가 "모든 문단이 6~10문장" 일 때만 원문 문단을 그대로 두므로, 5문장으로 쓰면 ' +
        '문단이 다시 합쳐져 네 토막 구조가 사라진다. 이름 있는 인물이 **둘 이상**이어야 하고, ' +
        '대명사(he/she/him/her/his/her)가 문단마다 두 번 이상 나와야 한다 — 44번 지칭 문항이 ' +
        '그 대명사들을 묻는다. 첫 문단은 나머지 셋보다 **먼저 와야만 말이 되게** 쓴다.'
      : null,
    words_min: WORDS_MIN,
    words_max: WORDS_MAX,
    // 이번 실행의 어휘 조건. **import 가 이 값을 글에 기록해야** 나중에 조건별 적중률을
    // 비교할 수 있다 — 안 남기면 "어떤 지침으로 쓴 글인지" 를 영영 알 수 없다.
    tail_min: TAIL_MIN,
    tail_max: TAIL_MAX,
    at_band_min: AT_MIN,
    at_band_max: AT_MAX,
    title: '',
    content: '',
  })
}

fs.mkdirSync(DIR, { recursive: true })
for (const f of fs.readdirSync(DIR)) if (/^chunk-\d+\.json$/.test(f)) fs.unlinkSync(path.join(DIR, f))

const chunks = []
for (let i = 0; i < tasks.length; i += SIZE) {
  const n = String(chunks.length).padStart(2, '0')
  const file = path.join(DIR, `chunk-${n}.json`)
  fs.writeFileSync(file, JSON.stringify(tasks.slice(i, i + SIZE), null, 1), 'utf8')
  chunks.push(file)
}
// 제목 중복을 막으려면 집필하는 쪽이 기존 제목을 알아야 한다.
fs.writeFileSync(
  path.join(DIR, 'taken-titles.json'),
  JSON.stringify([...takenTitles].sort(), null, 1),
  'utf8',
)
// **밴드를 정하는 것은 이 파일이다** — 어수가 아니라 어휘층.
fs.writeFileSync(
  path.join(DIR, 'lexicon.json'),
  JSON.stringify(
    {
      band: BAND,
      method: 'compute_article_vrl = 사전에 잡힌 서로 다른 낱말들의 V-Level 75분위',
      // 지침을 "이하로 유지" 로 주면 꼬리가 안 생겨 p75 가 주저앉는다 — 파일럿 실측.
      profile_of_real_articles: profile,
      counts: {
        note:
          `130~190어 지문의 서로 다른 낱말은 대략 100개, 그중 사전에 잡히는 것이 대략 75개다. ` +
          `아래는 그 75개를 어느 층에 몇 개 두어야 75분위가 V${BAND} 이 되는지다.`,
        [`V${BAND}`]: `${AT_MIN}~${AT_MAX}개`,
        [`V${BAND + 1}~V${BAND + 2}`]:
          `${TAIL_MIN}~${TAIL_MAX}개  ← **이 수를 지켜라. 적으면 한 계단 아래로, 많으면 위로 떨어진다**`,
        [`V${BAND - 1} 이하`]: '나머지 전부 (절반 이상)',
      },
      rule:
        `서로 다른 낱말 기준으로 V${BAND} 을 ${AT_MIN}~${AT_MAX}개, ` +
        `V${BAND + 1}~V${BAND + 2} 를 **${TAIL_MIN}~${TAIL_MAX}개** 쓰고 나머지는 쉬운 층으로 채운다. ` +
        `쉽게만 쓰면 아래로 떨어지고, 어려운 낱말을 더 넣으면 위로 떠오른다 — **꼬리 수가 곧 계단이다.**`,
      at_band: lexicon.at,
      above_band_tail: lexicon.avoid,
      below_band: lexicon.below,
    },
    null,
    1,
  ),
  'utf8',
)

console.log(`V${BAND} 재고 — 원글 ${inBand.length}편 · 그중 문항이 붙은 것 ${withItems.size}편  [갈래 ${MODE}]`)
console.log(`  한 권 실무 하한 ${VOLUME_ARTICLES}편 → **더 써야 할 몫 ${need}편**  → 청크 ${chunks.length}개 (${SIZE}편씩)`)
console.log(`  슬롯 번호 ${slotBase + 1}~${slotBase + need} (지난 실행과 겹치지 않게 이어 붙였다)`)
console.log(
  `  어수 규격 ${WORDS_MIN}~${WORDS_MAX}어 ` +
    (IS_LONG
      ? '(수능 장문 규격 — 짧은 지문 창 90~200어 **밖**이다. 장문 유형 전용)'
      : '(조합기 창 90~200어 안 — 밴드와 무관)'),
)
if (IS_LONG) console.log('  형식 — 문단 4 × 6문장 (적재기 repaginate 가 안 건드리는 유일한 구성)')
console.log(`  어휘층 — V${BAND} ${lexicon.at.length}낱말 · 그 아래 ${lexicon.below.length} · 꼬리 ${lexicon.avoid.length}`)
if (profile) console.log(`  V${BAND} 재고 프로필(${profile.samples}편) — p50 ${profile.p50} · p75 ${profile.p75} · p90 ${profile.p90}`)
else console.log(`  ⚠️ V${BAND} 재고가 없어 프로필을 못 냈다 — 집필 목표를 실측으로 못 준다.`)
if (!lexicon.at.length) console.log(`  ⚠️ 사전에 V${BAND} 낱말이 없다 — 어휘 지침이 성립하지 않는다.`)
console.log(`\n  ${path.relative(process.cwd(), DIR)}/chunk-NN.json`)
console.log(`  각 슬롯의 title·content 를 채운 뒤 같은 이름 + .out.json 으로 저장하면`)
console.log(`  write-drain-import.mjs 가 library_articles 에 넣는다.`)
