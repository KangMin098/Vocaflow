// scripts/csat/compose-drain-export.mjs
//
// **작문 드레인 1단 — 지을 몫을 청크로 뽑는다.**
//
// ── 왜 짓는가 ────────────────────────────────────────────────────────
// 균형 사정권은 병목 소재가 정한다. 실측 2026-09-03: 적합 원문을 **3,370편 늘렸는데
// 균형 사정권은 28편** 늘었다 — 수확이 병목(역사·인류 147편)을 못 건드리기 때문이다.
// 그리고 그 병목 칸들에는 **수확할 수 있는 CC BY 영어 전문 공급선이 없다**
// (OpenStax 미술사 없음 · Smarthistory NC · MDPI 403 · DOAJ 는 HTML 27%·영어 33%).
//
// 그래서 **짓는다.** 저작권이 처음부터 깨끗하고, 소재를 원하는 칸에 정확히 놓을 수 있고,
// 수확 원문과 **같은 자**(`lib-fit.mjs`)로 검수된다. 파일럿 10편에서 한 번에 70% 가 붙었고
// 떨어진 것은 측정-수정 한 바퀴로 붙었다(`docs/reports/csat-source-fit-20260903.md` §15).
//
// ── 3단 구조 (CLAUDE.md §🤖) ─────────────────────────────────────────
//   ① 이 파일        — 지을 몫을 `compose-drain/chunk-NN.json` 으로 뽑는다
//   ② Claude Code    — 읽고 채워 `chunk-NN.out.json` 으로 저장
//   ③ import --commit — 채점해서 **붙은 것만** 적재, 떨어진 것은 재작성 큐로
//
// **재실행 안전: 이미 채운 청크는 건너뛴다.** 몇 번을 돌려도 같은 결과다.
//
// ⚠️ 몫의 근거인 `docs/reports/topic-gap.json` 은 **표본 추정**이다. 적재 후에는 다시 재야
//   몫이 어긋나지 않는다 — import 가 끝에 그 명령을 찍는다.
//
// 실행:
//   node scripts/csat/compose-drain-export.mjs                 # 현황만
//   node scripts/csat/compose-drain-export.mjs --chunks 4      # 4청크 뽑는다
//   node scripts/csat/compose-drain-export.mjs --chunks 4 --per 12

import fs from 'node:fs'
import path from 'node:path'

import { SHAPE, FLOOR, TYPE } from './lib-fit.mjs'
import { TOPIC_KEYS } from './lib-topic.mjs'

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const CHUNKS = Number(arg('chunks') ?? 0)
const PER = Number(arg('per') ?? 12)
const STAGE = Number(arg('stage') ?? 3)
const STAGE_GOAL = { 1: 10000, 2: 30000, 3: 50000 }[STAGE] ?? 50000

const DIR = path.resolve('scripts/csat/compose-drain')
const DATA = path.resolve('scripts/csat/data')

/**
 * 지어서 채울 칸 — **PLOS 로 못 채우는 넷**.
 *
 * ⚠️ 과학·자연·심리·사회·기술은 여기 넣지 않는다. 그 칸들은 수확으로 채워지고 있고,
 *   지어서 채우면 **더 싼 경로를 놔두고 비싼 경로를 쓰는 것**이다.
 */
const ALL_COMPOSE_SLOTS = ['예술·문화', '역사·인류', '철학·윤리', '교육·언어']

/**
 * `--only <칸>` — 그 칸만 뽑는다.
 *
 * ⚠️ 기본 배분은 **병목 우선**이라, 아직 안 열어 본 칸은 병목이 될 때까지 한 편도 안 나온다.
 *   그런데 칸마다 **조준이 맞는지 첫 청크로 확인해야** 한다(§19·§20 — 역사에서 1/12,
 *   철학에서 1/4 로 빗나갔고 둘 다 소재·어휘를 바꿔서야 맞았다). 병목이 된 뒤에야
 *   그 사실을 알면 그때 12편을 버리게 되므로, **미리 한 청크만 열어 보는 길**을 둔다.
 */
const ONLY = arg('only')
const COMPOSE_SLOTS = ONLY ? ALL_COMPOSE_SLOTS.filter((k) => k === ONLY) : ALL_COMPOSE_SLOTS
if (ONLY && !COMPOSE_SLOTS.length) {
  console.error(`"${ONLY}" 은 작문 칸이 아니다. 가능한 칸: ${ALL_COMPOSE_SLOTS.join(' · ')}`)
  process.exit(1)
}
const SUBJECTS = {
  /**
   * ⚠️ **그 칸의 「내용」을 쓰게 해야 한다 — 그 분야의 「방법론」이 아니라.**
   *
   * 실측 2026-09-03: 첫 판의 역사·인류 소재는 「사료 비판」·「구전 계보의 정확성」처럼
   * **역사학의 방법론**이었다. 그렇게 쓰면 글이 인식론·사회학 어휘로 채워져 12편 중
   * **역사·인류 판정이 1편**뿐이었다. 청동기 붕괴·중세 삼포식 농업처럼 **시대·문명·변화
   * 자체**로 바꾸자 12편 중 **7편**이 됐다 — 자를 건드리지 않고 입력만 바꿔 7배다.
   *
   * (길이 편향은 아니었다 — 같은 글을 앞 150어만 잘라 재도 판정이 같았다.)
   *
   * ⚠️ 「예술·문화」는 앨범 리뷰가 아니라 **미학·예술론·문화인류학**이다
   *   (위키백과 게이트가 실패한 이유가 정확히 이것이다 — *True Blue (album)* 이
   *   예술·문화 1위로 올라왔다).
   */
  '예술·문화': [
    '재현과 모방 — 회화가 무엇을 어떻게 지시하는가', '예술의 정의와 제도론',
    '음악 청취의 역사성 — 침묵하는 청중은 언제 생겼나', '공연의 일회성과 기록의 한계',
    '진품과 위작 — 감상은 무엇을 보고 있는가', '장식과 기능, 그리고 정직함이라는 수사',
    '번역에서 옮겨지지 않는 것', '박물관이 사물에 부여하는 맥락',
    '즉흥연주 — 준비의 산물로서의 자유', '취향의 사회적 형성',
    '사진이 회화에 남긴 문제', '공예와 예술의 경계는 누가 그었나',
    '서사의 시간 — 이야기와 사건의 순서', '건축과 신체의 척도',
    '원근법은 발견인가 약속인가', '색채 이름과 그것이 나눈 스펙트럼',
    '가면과 배우 — 연기의 인류학', '민속 음악의 채집과 그 왜곡',
    '초상화가 기록한 권력', '풍경화는 자연을 어떻게 발명했나',
    '악보가 연주에 남긴 여백', '무용 기보법의 시도와 실패',
    '도자기 문양의 전파', '직물의 문양과 집단 정체성',
    '문학 장르는 어떻게 굳는가', '운율과 기억 — 시가 외워지는 이유',
    '희극과 비극의 사회적 기능', '축제와 일상의 시간 구분',
    '음식의 조리법과 문화 경계', '정원 설계에 담긴 자연관',
    '캐리커처와 풍자의 한계', '조각의 재료가 형태에 거는 제약',
    '영화 편집이 만드는 인과', '만화의 칸과 시간 표현',
    '광고 이미지의 수사학', '건축 양식의 부흥과 인용',
    '악기의 개량과 음색의 변화', '공공 미술과 장소의 의미',
    '수집과 분류 — 진열장의 논리', '복제 기술과 감상의 변화',
    '무대 조명이 바꾼 연기', '도시의 소리 풍경',
    '전통 공예의 전수 방식', '의상과 사회적 신호',
    '서예와 필적의 미학', '판화의 다중성과 원본 개념',
    '기념 조형물과 집단 기억', '민담의 변이와 전승',
    '건축 재료의 지역성', '음악의 조성과 정서 연결',
  ],
  '역사·인류': [
    '청동기 문명의 붕괴와 그 이후', '고대 도시의 상수도와 위생',
    '중세 유럽의 삼포식 농업', '실크로드를 오간 것은 비단만이 아니었다',
    '고대 제국의 도로망과 전령', '수렵채집에서 정착으로 — 초기 농경 마을',
    '고고학이 밝힌 초기 야금술', '흑사병 이후의 임금과 토지',
    '문자 이전의 셈법과 점토 표식', '고대 문명의 관개와 국가 형성',
    '유목 제국의 흥망', '항해술의 발달과 원거리 교역',
    '인류의 확산 — 화석과 유전자가 말하는 경로', '신석기 혁명은 건강에 어떤 영향을 주었나',
    '고대의 화폐와 주조권', '중세 도시의 길드와 기술 전수',
    '제국의 변경과 이주민', '고대 이집트의 노동 조직',
    '선사시대 동굴 벽화와 그 연대', '농경의 확산과 언어 계통',
    '기후 변동이 바꾼 고대 정착 양상', '고대 문명의 역법과 천문 관측',
    '초기 국가의 조세와 곡물 창고', '고대 전쟁과 야금 기술의 관계',
    '고대의 노예제와 노동 형태', '중세 수도원의 필사와 지식 보존',
    '향신료 무역이 바꾼 항로', '화약의 전파와 축성의 변화',
    '인쇄술 이전의 책 유통', '고대 올림픽과 도시국가의 경쟁',
    '로마 콘크리트와 건축의 규모', '고대 중국의 운하와 조운',
    '이슬람 세계의 학문 전승', '몽골 제국의 역참과 정보',
    '대항해 시대의 질병 교환', '감자와 옥수수가 바꾼 인구',
    '중세 온난기와 북방 정착', '고대 인도의 도시 계획',
    '유럽 봉건제의 성립 조건', '고대 그리스의 식민 도시',
    '메소포타미아의 법전과 분쟁', '고대의 광산과 노동 동원',
    '초원길과 정주 세계의 접촉', '중세 흑해 교역망',
    '고대 페루의 계단식 경작', '아프리카 왕국의 금 교역',
    '태평양 항해와 섬의 정착', '고대의 도량형과 교역',
    '문명 간 문자 차용의 사례', '기근과 이주의 역사적 연쇄',
  ],
  '철학·윤리': [
    '지식과 정당화 — 참인 믿음으로 충분한가', '개인 동일성과 시간',
    '자유의지와 결정론의 양립 가능성', '결과주의와 그 반례들',
    '의무의 근거는 어디에 있는가', '타인의 마음을 어떻게 아는가',
    '언어와 세계의 대응', '분배 정의와 운의 문제',
    '동물의 도덕적 지위', '기술이 만드는 새로운 책임',
    '약속은 왜 구속력을 갖는가', '처벌의 정당화 근거',
    '덕과 규칙 — 두 윤리의 대립', '보편적 인권 주장의 난점',
    '거짓말이 언제나 그른가', '자율과 후견적 개입',
    '미래 세대에 대한 의무', '집단 책임은 성립하는가',
    '규범은 사실에서 도출되는가', '관용의 역설',
    '사적 소유의 정당화', '평등은 무엇의 평등인가',
    '용서와 정의의 긴장', '위험 감수와 도덕적 운',
    '진실을 말할 의무와 해악', '전문가 신뢰의 조건',
    '동의는 무엇을 정당화하는가', '가치 다원주의와 비교 불가능성',
    '행복과 좋은 삶의 구분', '이성과 감정의 도덕적 역할',
    '규칙 따르기란 무엇인가', '개념은 어떻게 경계를 갖는가',
    '설명과 인과의 관계', '과학 이론의 미결정성',
    '수학적 대상은 존재하는가', '시간의 흐름은 실재하는가',
    '인격과 신체의 관계', '의식의 주관성 문제',
    '해악 원리와 자유의 한계', '시민 불복종의 조건',
    '세대 간 정의와 자원 배분', '익명성과 도덕적 책임',
  ],
  '교육·언어': [
    '모어 습득과 규칙의 발견', '문해력은 사고를 어떻게 바꾸는가',
    '표준어와 방언의 위계', '기억과 인출 — 시험이 학습인 이유',
    '설명과 이해의 차이', '전문어가 만드는 진입 장벽',
    '언어 변화는 쇠퇴인가 적응인가', '통역과 문화적 함축',
    '이중언어 사용자의 언어 전환', '문법 규칙과 실제 용법의 간극',
    '어휘 크기와 읽기 이해', '읽기 곤란은 어디서 오는가',
    '수화는 어떻게 언어인가', '언어 소멸과 기록',
    '은유가 사고에 미치는 영향', '철자법 개혁의 성패',
    '연습의 분산과 학습 효과', '오개념은 왜 끈질긴가',
    '피드백의 시점과 효과', '동기와 학습 지속',
    '문자 체계의 차이와 읽기', '외국어 습득의 결정적 시기',
    '교과서 서술과 이해 부담', '설명문의 구조와 독해',
    '어원 지식은 학습을 돕는가', '구어와 문어의 문법 차이',
    '언어 접촉과 혼성어의 형성', '이름 붙이기와 범주 학습',
    '평가가 교육 내용을 바꾸는 방식', '협동 학습의 조건',
    '학습 전이는 왜 어려운가', '개념 지도와 지식 구조',
    '경청과 이해의 인지 부담', '어린이 문법 오류의 규칙성',
  ],
}

fs.mkdirSync(DIR, { recursive: true })

// ── 몫 계산 ──────────────────────────────────────────────────────────
const dist = JSON.parse(fs.readFileSync(path.join(DATA, 'topic-distribution.json'), 'utf8'))
const TARGET_KEYS = TOPIC_KEYS.filter((k) => k !== '분류불가')
const denom = TARGET_KEYS.reduce((s, k) => s + (dist.total[k] ?? 0), 0)
const share = Object.fromEntries(TARGET_KEYS.map((k) => [k, (dist.total[k] ?? 0) / denom]))

const gapFile = path.resolve('docs/reports/topic-gap.json')
if (!fs.existsSync(gapFile)) {
  console.error('소재별 재고를 모른다 — 먼저: node scripts/csat/topic-gap.mjs --out docs/reports/topic-gap.json')
  process.exit(1)
}
const gap = JSON.parse(fs.readFileSync(gapFile, 'utf8'))
const stock = Object.fromEntries(gap.rows.map((r) => [r.topic, r.estStock]))

// ── 이미 있는 청크 세기 (재실행 안전) ────────────────────────────────
const existing = fs.readdirSync(DIR).filter((f) => /^chunk-\d+\.json$/.test(f))
const done = fs.readdirSync(DIR).filter((f) => /^chunk-\d+\.out\.json$/.test(f))
const doneNums = new Set(done.map((f) => f.match(/chunk-(\d+)/)[1]))
const pending = existing.filter((f) => !doneNums.has(f.match(/chunk-(\d+)/)[1]))

/**
 * 채웠지만 **아직 적재 안 된** 청크가 각 칸에 기여할 몫 — 그만큼 미리 뺀다.
 *
 * ⚠️ **적재된 청크는 여기서 세면 안 된다.** `stock`(= `topic-gap.json`)이 이미 DB 를
 *   세고 있으므로 두 번 세게 되고, 그러면 그 칸이 실제보다 찬 것으로 보여 **병목 순서가
 *   어긋난다.** 실측 2026-09-03: 역사·인류가 195(실제)인데 195+22=217 로 세어져,
 *   진짜 병목인 철학·윤리를 제치고 역사가 먼저 배분됐다.
 *   import 가 적재 후 `chunk-NN.imported` 를 남기므로 그 표식으로 가른다.
 */
const filled = {}
for (const f of done) {
  if (fs.existsSync(path.join(DIR, f.replace('.out.json', '.imported')))) continue
  try {
    for (const it of JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))) {
      if ((it.content ?? '').trim().length > 400) filled[it.topic] = (filled[it.topic] ?? 0) + 1
    }
  } catch {
    // 손상된 out 파일은 세지 않는다 — import 가 따로 걸러 낸다.
  }
}

console.log(`작문 드레인 export — 지을 몫을 뽑는다\n${'='.repeat(78)}`)
console.log(`  목표 ${STAGE}단계 ${STAGE_GOAL.toLocaleString()}편 · 재고 ${gap.measuredAt.slice(0, 10)} 실측\n`)
console.log(`  ${'소재'.padEnd(11)}${'목표'.padStart(8)}${'재고'.padStart(8)}${'채운 것'.padStart(8)}${'남은 몫'.padStart(9)}`)
console.log('  ' + '-'.repeat(50))
const need = {}
for (const k of COMPOSE_SLOTS) {
  const want = Math.round(STAGE_GOAL * share[k])
  const have = (stock[k] ?? 0) + (filled[k] ?? 0)
  need[k] = Math.max(0, want - have)
  console.log(
    `  ${k.padEnd(11)}${want.toLocaleString().padStart(8)}${(stock[k] ?? 0).toLocaleString().padStart(8)}` +
      `${String(filled[k] ?? 0).padStart(8)}${need[k].toLocaleString().padStart(9)}`,
  )
}
const total = Object.values(need).reduce((a, b) => a + b, 0)
console.log('  ' + '-'.repeat(50))
console.log(`  남은 몫 합계 **${total.toLocaleString()}편**`)

// 병목 순서 — 이 순서로 채워야 균형 사정권이 오른다(절대 부족분 순서와 다르다).
const holding = Object.fromEntries(COMPOSE_SLOTS.map((k) => [k, (stock[k] ?? 0) + (filled[k] ?? 0)]))
const order = [...COMPOSE_SLOTS].sort((a, b) => holding[a] / share[a] - holding[b] / share[b])
console.log(
  `  병목 순서(재고÷목표비율): ` +
    order.map((k) => `${k} ${Math.round(holding[k] / share[k]).toLocaleString()}`).join(' < '),
)
console.log(`  → 이 순서로 채운다. 절대 부족분 순서로 채우면 사정권이 안 오른다.`)
console.log(`  청크 ${existing.length}개 (채움 ${done.length} · 대기 ${pending.length})\n`)

if (pending.length) {
  console.log(`  ⚠️ 아직 안 채운 청크가 ${pending.length}개 있다 — 그것부터 채운다:`)
  for (const f of pending.slice(0, 8)) console.log(`     ${path.join('scripts/csat/compose-drain', f)}`)
  if (!CHUNKS) process.exit(0)
}
if (!CHUNKS) {
  console.log(`  뽑으려면: node scripts/csat/compose-drain-export.mjs --chunks 4 [--per ${PER}]`)
  process.exit(0)
}

// ── 청크 뽑기 — 남은 몫에 비례해 칸을 배분한다 ───────────────────────
let next = existing.reduce((m, f) => Math.max(m, Number(f.match(/chunk-(\d+)/)[1])), 0) + 1
const spec = {
  type: TYPE,
  words: { lo: SHAPE.words.lo, mid: SHAPE.words.mid, hi: SHAPE.words.hi },
  sentLen: { lo: SHAPE.sentLen.lo, mid: SHAPE.sentLen.mid, hi: SHAPE.sentLen.hi },
  wordLen: { lo: SHAPE.wordLen.lo, mid: SHAPE.wordLen.mid, hi: SHAPE.wordLen.hi },
  discourseFloor: { connective: FLOOR.conn, anaphora: FLOOR.ana },
}
// 풀이 몫보다 작으면 **여기서 말한다** — 조용히 같은 소재를 되풀이하면 비슷한 글이 쌓인다.
for (const k of COMPOSE_SLOTS) {
  if (need[k] > SUBJECTS[k].length) {
    console.log(
      `  ⚠️ ${k}: 남은 몫 ${need[k].toLocaleString()}편인데 소재 풀은 ${SUBJECTS[k].length}개다. ` +
        `청크마다 다른 소재를 주려면 풀을 넓혀야 한다(SUBJECTS 표).`,
    )
  }
}

// 이미 뽑힌 모든 청크(채운 것 · 대기 중인 것 둘 다)의 소재 — 다시 내지 않는다.
const usedBefore = new Set()
for (const f of existing) {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))
    for (const it of raw.items ?? []) usedBefore.add(`${it.topic}|${it.subject}`)
  } catch {
    // 손상된 청크는 무시한다 — 최악의 경우 소재가 한 번 겹칠 뿐이다.
  }
}

const made = []
const cursorBySlot = {}
for (let c = 0; c < CHUNKS; c++) {
  const items = []
  const exhausted = new Set()
  for (let i = 0; i < PER; i++) {
    /**
     * ⚠️ **남은 몫이 큰 칸부터가 아니다.** 균형 사정권은 `min_t (재고_t / 목표비율_t)` 이므로
     *   그 최솟값을 만드는 칸 — **지금 병목인 칸** — 에 넣어야 수치가 오른다.
     *
     *   실측 2026-09-03 로 재면 두 기준이 갈린다:
     *     절대 부족  예술·문화 5,961 > 교육·언어 2,745 > 철학·윤리 2,368 > 역사·인류 1,607
     *     병목 순서  역사·인류 4,200 < 철학·윤리 4,981 < 예술·문화 7,550 < 교육·언어 10,914
     *   부족분 기준으로 예술·문화를 5,961편 채워도 **균형 사정권은 4,200 에서 안 움직인다** —
     *   역사·인류가 그대로이기 때문이다. 앞서 수확 3,370편이 사정권을 28편밖에 못 올린 것과
     *   같은 함정이고, 여기서 다시 밟으면 12,681편을 짓고도 수치가 제자리다.
     */
    // ⚠️ **소재를 다 쓴 칸은 후보에서 뺀다.** 안 빼면 선택기가 그 칸을 계속 다시 골라
    //   `i -= 1; continue` 와 함께 **무한 루프**가 된다(실측 2026-09-03: export 가 180초를
    //   넘겨 죽지 않고 돌았다). 종료 조건만으로는 못 막는다 — 다른 칸에 몫이 남아 있으면
    //   그 조건이 안 걸리는데, 선택기는 여전히 소진된 칸을 고르기 때문이다.
    const slot = COMPOSE_SLOTS.filter((k) => need[k] > 0 && !exhausted.has(k)).sort(
      (a, b) => (holding[a] ?? 0) / share[a] - (holding[b] ?? 0) / share[b],
    )[0]
    if (!slot) break
    need[slot] -= 1
    holding[slot] = (holding[slot] ?? 0) + 1
    /**
     * ⚠️ 한 청크 안에서 소재가 겹치면 **비슷한 글이 나온다.** 첫 판에서 실제로 겹쳤다
     *   (역사·인류 풀 10개인데 청크당 12편 → 2개가 두 번). 청크 안에서는 안 겹치게 하고,
     *   그래도 모자라면 **청크를 줄인다** — 채울 자리를 억지로 만들지 않는다.
     */
    const pool = SUBJECTS[slot]
    const usedHere = items.filter((x) => x.topic === slot).map((x) => x.subject)
    // ⚠️ **이미 뽑아 둔 청크의 소재도 뺀다.** 청크 안 중복만 막았더니 chunk-003 이
    //   chunk-001·002 에서 이미 쓴 소재(청동기 붕괴 · 삼포식 농업 · 초기 야금술 …)를
    //   그대로 다시 냈다. 그대로 채우면 **DB 에 거의 같은 글이 두 벌 들어간다**
    //   (내용 해시 dedup 은 글자가 다르면 못 잡는다).
    const free = pool.filter((s) => !usedHere.includes(s) && !usedBefore.has(`${slot}|${s}`))
    if (!free.length) {
      // 이 칸의 소재를 다 썼다 — 다른 칸으로 넘어가되, 이 칸의 몫은 되돌린다.
      need[slot] += 1
      holding[slot] -= 1
      exhausted.add(slot)
      if (COMPOSE_SLOTS.every((k) => exhausted.has(k) || need[k] <= 0)) break
      i -= 1
      continue
    }
    const subject = free[(cursorBySlot[slot] = (cursorBySlot[slot] ?? -1) + 1) % free.length]
    // ⚠️ **만들면서 바로 표시한다.** `usedBefore` 를 루프 앞에서 한 번만 채웠더니 같은 실행에서
    //   만든 chunk-003 과 chunk-004 가 서로 6개나 겹쳤다 — 디스크에 쓰기 전이라 안 보였다.
    usedBefore.add(`${slot}|${subject}`)
    items.push({ topic: slot, subject, title: '', content: '' })
  }
  if (!items.length) break
  const file = path.join(DIR, `chunk-${String(next).padStart(3, '0')}.json`)
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        // 지침을 청크 안에 넣는다 — 채우는 쪽이 파일 하나만 열면 되게.
        instructions: [
          '각 항목의 title 과 content 를 채운다. content 는 영어 설명문 산문이다.',
          `길이는 **300~340어** — 실측: 붙은 글은 280~310어였고, 떨어진 글은 231~242어였다. 짧으면 창(${SHAPE.words.lo}~${SHAPE.words.hi}어)이 한 개 반밖에 안 나와 한 번 실패하면 그대로 끝난다.`,
          `문장 길이를 **고르게** — 실측: 떨어진 글의 문장이 8·36·49어로 튀었다. 18~25어로 유지하면 창 평균이 대역 안에 머문다.`,
          `문장 평균 ${SHAPE.sentLen.lo.toFixed(0)}~${SHAPE.sentLen.hi.toFixed(0)}어 · 낱말 평균 ${SHAPE.wordLen.lo.toFixed(2)}~${SHAPE.wordLen.hi.toFixed(2)}자 (중앙 ${SHAPE.wordLen.mid.toFixed(2)} 겨냥).`,
          '연결사(however·therefore·although·because…)와 지시어(this·these·its·their…)를 반드시 섞는다.',
          '⚠️ **첫 문단부터 섞는다.** 실측: 떨어진 글의 대부분이 「문장 1~6 창에 연결사·지시어가 없다」였다. 서두를 설명만으로 시작하면 첫 창이 담화 하한에 걸려, 뒤가 아무리 좋아도 그 창은 못 쓴다.',
          '숫자·인용·URL·고유명 약어를 피한다 — 산문 게이트가 서지 블록으로 보고 버린다.',
          'subject 는 무엇을 쓸지에 대한 지시다. 그대로 번역하지 말고 그 주제의 영어 설명문을 쓴다.',
          '⚠️ 낱말 길이가 가장 자주 어긋난다 — 학술어를 몰아 쓰면 상한을 넘고, 쉬운 말만 쓰면 하한에 못 미친다.',
          '⚠️ **그 칸의 내용을 써야 그 칸으로 떨어진다.** 실측: 「사료 비판」처럼 그 분야의 방법론을 쓰면 인식론·사회학 어휘가 되어 12편 중 1편만 의도한 칸에 떨어졌다. 시대·문명·작품·논증 자체를 쓴다.',
        ],
        band: spec,
        items,
      },
      null,
      1,
    ),
  )
  made.push(path.relative(process.cwd(), file))
  next += 1
}

console.log(`  ${made.length}청크 뽑았다 (청크당 ${PER}편):`)
for (const f of made) console.log(`    ${f}`)
console.log(`\n  다음: 각 청크를 읽고 채워 같은 이름 + .out.json 으로 저장 → import --commit`)
