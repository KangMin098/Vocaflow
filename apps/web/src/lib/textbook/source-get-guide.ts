// apps/web/src/lib/textbook/source-get-guide.ts
//
// 원천별 「가져오는 법」 — /admin/csat/sources 상세 패널이 그린다(2026-09-25).
//
// 원천마다 수집 스크립트가 다르다(ACP 헤드리스 · 기출 하베스터 · 교재 수집기 · 확보 원문 적재).
// 관리자가 스크립트 머리 주석을 뒤지지 않고 Claude Code 에 그대로 맡길 수 있게, 원천 키마다
// ① 쓰는 스크립트 ② 단계별 명령 ③ Claude Code 에 붙여 넣을 지시문을 한곳에 둔다.
// 명령은 각 스크립트 머리 주석의 「실행:」 줄에서 옮겼다 — 스크립트를 바꾸면 여기도 고친다.
//
// 공통 성질(스크립트 주석에 명시된 것만): 전부 `--commit` 없이는 쓰지 않고(dry-run 기본),
// (source, source_id) 로 중복을 건너뛰어 재실행 안전하다. 담긴 글은 status='queued' 로 들어가
// `process-queue.mjs` 분석을 거쳐야 적격 판정 대상이 된다.

export type SourceGetStep = {
  title: string
  command?: string
  note: string
  // 기관 서버·DB 에 실제로 쓰는 단계인가 — 화면이 표시한다.
  writes: boolean
}

export type SourceGetGuide = {
  script: string
  kind: 'acp' | 'harvest' | 'ingest' | 'import' | 'manual'
  steps: SourceGetStep[]
  caution?: string
}

const PROCESS: SourceGetStep = {
  title: '분석 큐 처리',
  command: 'pnpm dlx tsx scripts/acp/process-queue.mjs --commit --limit 50',
  note: "담긴 글은 'queued' 다. 분석(학령·CEFR)을 거쳐야 적격 판정 대상이 된다. LLM 비용이 들어 상한을 둔다. 재실행 안전(queued 만 집는다).",
  writes: true,
}
const RECOUNT: SourceGetStep = {
  title: '이 화면에서 다시 세기',
  note: '맨 위 「지금 다시 세기」를 눌러 원천별 표와 진행표가 늘었는지 확인한다. 안 늘었으면 dry-run 출력의 「건너뜀」 수부터 본다.',
  writes: false,
}

function acp(source: string, feedHint?: string): SourceGetGuide {
  const base = `pnpm dlx tsx scripts/acp/collect-daily.mjs --source ${source}`
  return {
    script: 'scripts/acp/collect-daily.mjs',
    kind: 'acp',
    steps: [
      { title: '밀린 양 보기 (읽기 전용)', command: base, note: `피드별로 새 글 수와 적합률만 센다. 아무것도 안 쓴다.${feedHint ? ` ${feedHint}` : ''}`, writes: false },
      { title: '소량 담기', command: `${base} --commit --limit 5`, note: '5편만 담아 본문·라이선스가 제대로 들어오는지 원문 검수 화면에서 눈으로 본다.', writes: true },
      { title: '본 수집', command: `${base} --commit`, note: '기관 서버에 실제 요청이 나간다 — 하루 1회면 충분하다. 이미 있는 글은 건너뛴다.', writes: true },
      PROCESS,
      RECOUNT,
    ],
  }
}

function harvest(source: string, script: string, plan: string, sample: string, full: string, caution?: string): SourceGetGuide {
  return {
    script,
    kind: 'harvest',
    steps: [
      { title: '계획 보기 (읽기 전용)', command: `pnpm dlx tsx ${script} ${plan}`.trim(), note: '열거·몫 계산만 한다. 기사 본문 GET 도, DB 쓰기도 없다.', writes: false },
      { title: '표본 채점 (읽기 전용)', command: `pnpm dlx tsx ${script} ${sample}`, note: '몇 편만 받아 채점 결과를 본다. 통과율이 낮으면 창(저널·슬롯·피드)을 바꾼다.', writes: false },
      { title: '적재', command: `pnpm dlx tsx ${script} ${full}`, note: `커서를 남겨 다음 실행이 이어서 훑는다. 커서를 지워도 (source, source_id) 중복 판정이 막는다.`, writes: true },
      PROCESS,
      RECOUNT,
    ],
    caution: caution ?? `원천 ${source} 의 몫·창 선택 근거는 스크립트 머리 주석에 있다. 다른 창의 커서를 물려받지 않게 창을 바꿀 땐 옵션을 명시한다.`,
  }
}

function ingest(script: string, sample: string, full: string, processed: boolean): SourceGetGuide {
  return {
    script,
    kind: 'ingest',
    steps: [
      { title: '표본 보기 (dry-run)', command: `pnpm dlx tsx ${script} ${sample}`.trim(), note: '본문을 받아 발췌·창 판정만 출력한다. 안 담는다.', writes: false },
      { title: '적재', command: `pnpm dlx tsx ${script} ${full}`, note: processed ? '`--process` 가 담은 직후 분석까지 돌린다(별도 분석 단계 불필요).' : '담은 글은 queued 로 들어간다.', writes: true },
      ...(processed ? [] : [PROCESS]),
      RECOUNT,
    ],
  }
}

const IMPORT: SourceGetGuide = {
  script: 'scripts/csat/source-doc-import.mjs',
  kind: 'import',
  steps: [
    { title: '읽기 판정 확인', note: '입력은 docs/reports/data/source-doc-register.json 의 read_verdict=keep 행이다. 새 원문은 먼저 원문 점검 회차(docs/source-check)로 keep 판정을 받아야 한다 — 이 원천은 자동 수집기가 없다.', writes: false },
    { title: '대조 (dry-run)', command: 'node --tls-max-v1.2 scripts/csat/source-doc-import.mjs', note: '이미 있는 source_id 를 세고 건너뛸 수를 출력한다.', writes: false },
    { title: '제약 확인용 1편', command: 'node --tls-max-v1.2 scripts/csat/source-doc-import.mjs --commit --limit 1', note: 'CHECK 제약·라이선스 칸이 통과하는지 1편으로 확인한다.', writes: true },
    { title: '적재', command: 'node --tls-max-v1.2 scripts/csat/source-doc-import.mjs --commit', note: '재실행 안전 — 건너뛴 수를 출력한다.', writes: true },
    RECOUNT,
  ],
}

/** 소스GET 3차 (2026-09-25) — 원천별 수집기가 표본 파일을 쓰고, 공용 적재기가 담는다. */
function fetchImport(source: string, sample: string, full: string, caution?: string): SourceGetGuide {
  const fetcher = `scripts/csat/source-get/${source}-fetch.mjs`
  const imp = `pnpm dlx tsx scripts/csat/source-get/import.mjs --source ${source} --dir <폴더>`
  return {
    script: fetcher,
    kind: 'import',
    steps: [
      { title: '표본 받기 (읽기 전용)', command: `node ${fetcher} --out <폴더> ${sample}`, note: '원천 서버에서 받아 <폴더>/ft-' + source + '-samples.json 에 쓴다. DB 에는 안 쓴다. 본문을 몇 편 열어 정제 상태를 눈으로 본다.', writes: false },
      { title: '대조 (dry-run)', command: imp, note: '이미 있는 source_id · 빈 본문 · 라이선스 해소 필요(NC·ND) · 사전검증(분류·제목·앞부분) 막음·표시 수를 출력한다. 아무것도 안 쓴다. 막음 사유가 많으면 적재 전에 사유별 표본을 본다.', writes: false },
      { title: '제약 확인용 1편', command: `${imp} --commit --limit 1`, note: 'CHECK 제약(library_articles_source_check)이 이 원천을 받는지 1편으로 확인한다.', writes: true },
      { title: '본 수집 → 적재', command: `node ${fetcher} --out <폴더> ${full}` + ' 뒤 ' + `${imp} --commit`, note: '재실행 안전 — source_id 로 건너뛰고 건너뛴 수를 출력한다.', writes: true },
      PROCESS,
      RECOUNT,
    ],
    caution,
  }
}

const GUIDES: Record<string, SourceGetGuide> = {
  voa: {
    ...acp('voa', '`--feed words-and-their-stories` 로 피드 하나만 볼 수 있다.'),
    caution: '과거 글을 대량으로 걷으려면 사이트맵 경로를 쓴다: `pnpm dlx tsx scripts/acp/harvest-voa-sitemap.mjs --plan` → `--limit 40`(표본) → `--limit 500 --commit`.',
  },
  nasa: acp('nasa'),
  nih: acp('nih'),
  the_conversation: acp('the_conversation'),
  eia_kids: fetchImport('eia_kids', '--limit 20', '',
    '메뉴를 따라 /kids/ 전체를 훑는다(71쪽 중 63편) — 전량이 작아 상한이 필요 없다. 본문의 「In 2025, …」 같은 최신 통계 문장은 시점이 박힌다.'),
  nih_news_in_health: fetchImport('nih_news_in_health', '--limit 20', '--limit 1000',
    '원 사이트는 Cloudflare 챌린지(JS)라 자동 접근이 막힌다 — 우회하지 않고 Internet Archive 사본(web.archive.org)에서 받는다. Wayback 503 은 재시도한다. 「Featured Website」 소개 꼭지는 뺀다.'),
  wikinews: {
    ...acp('wikinews'),
    caution: 'Wikinews 는 2026-05-04 부터 읽기 전용 고정 아카이브다. robots.txt 가 /w/(api.php)를 막으므로 대량은 덤프(dumps.wikimedia.org/enwikinews) 경로를 쓴다. 덤프 수집: `node scripts/csat/source-get/wikinews-fetch.mjs --dump --out <폴더>` → `pnpm dlx tsx scripts/csat/source-get/import.mjs --source wikinews --dir <폴더> --commit`. 2026-09-25 에 발행 22,109 중 19,366편 적재(스포츠 2,557 · 표기 잔여 100 제외) — 아카이브가 고정이라 다시 돌릴 일은 거의 없다.',
  },
  wikipedia: acp('wikipedia'),
  wikivoyage: acp('wikivoyage'),
  usgs: acp('usgs'),
  noaa: acp('noaa'),
  simple_wikipedia: acp('simple_wikipedia'),
  owid: acp('owid'),
  elife: acp('elife'),
  futurity: acp('futurity'),
  plos: harvest('plos', 'scripts/csat/harvest-plos.mjs', '', '--slot 심리·인지 --pages 4', '--slot 심리·인지 --pages 40 --commit',
    '채점은 기록만 하고 보관 여부는 내용 판정이 가른다. 재고의 대부분이 이미 PLOS 라 소재 배율(topic-gap)을 먼저 보고 슬롯을 고른다. 날마다 도는 경로는 collect-daily --source plos.'),
  frontiers: harvest('frontiers', 'scripts/csat/harvest-frontiers.mjs', '', '--journal feduc --pages 1 --max 5', '--journal feduc --pages 6 --max 400 --commit'),
  nist: harvest('nist', 'scripts/csat/harvest-nist.mjs', '--plan', '--feed news --max 12', '--feed news --max 20 --commit'),
  worldbank: harvest('worldbank', 'scripts/csat/harvest-worldbank.mjs', '--plan', '--pages 2 --max 20', '--pages 20 --max 300 --commit'),
  europe_pmc: ingest('scripts/textbook/epmc-ingest.mjs', '', '--feed psychology --commit --limit 30', false),
  frym: ingest('scripts/textbook/frym-ingest.mjs', '--band 중3 --limit 20', '--commit --process --limit 60', true),
  space_place: ingest('scripts/textbook/space-place-ingest.mjs', '--limit 20', '--commit --process --band 초6~중1', true),
  storyweaver: ingest('scripts/textbook/storyweaver-ingest.mjs', '--limit 12', '--commit --level 1 --limit 40', false),
  olh: IMPORT,
  econstor: IMPORT,
  scielo: IMPORT,
  openalex: IMPORT,
  global_voices: fetchImport('global_voices', '--limit 20', '--limit 400',
    '2026-09-25 파일럿에서 ~90요청(병렬 포함) 뒤 사이트가 응답을 끊었다. 한 프로세스로만, 요청 간격을 2초 이상 둔다.'),
  global_storybooks: fetchImport('global_storybooks', '--limit 20', '--limit 1000',
    'African Storybook 과 같은 이야기다. 이야기마다 License 줄을 읽는다 — CC-BY-NC 는 담기지만 restricted 로 막힌다.'),
  gdl: fetchImport('gdl', '--limit 20', '--limit 500',
    'EPUB 이 책당 ~1MB 다. StoryWeaver·Let\'s Read 와 같은 책이 겹친다 — 적재 뒤 제목 중복을 본다.'),
  factbook: {
    script: 'packages/library-pipeline/src/ingest-article/factbook.ts',
    kind: 'manual',
    steps: [
      { title: '헤드리스 경로 없음', note: '수집기(ingester)는 있지만 collect-daily 에 배선되지 않았다. ACP 콘솔(/admin/articles)의 수집으로 담거나, Claude Code 에 collect-daily 배선을 맡긴다.', writes: false },
      { title: '큐 상태 보기 (읽기 전용)', command: 'pnpm dlx tsx scripts/acp/process-queue.mjs', note: '콘솔로 담은 글이 queued 로 몇 편 있는지만 본다.', writes: false },
      PROCESS,
      RECOUNT,
    ],
  },
  original: {
    script: 'scripts/compose/drain-*.mjs',
    kind: 'manual',
    steps: [
      { title: '수집이 아니라 재저작', note: '자체 재저작 원문은 걷어 오지 않는다. Compose 드레인(scripts/compose/drain-*.mjs)이 발주→재저작→게이트를 거쳐 만든다. 절차는 Compose 화면 도움말의 drain 을 따른다.', writes: false },
      RECOUNT,
    ],
  },
}

export function sourceGetGuide(source: string): SourceGetGuide | null {
  return GUIDES[source] ?? null
}

/** Claude Code 에 그대로 붙여 넣을 지시문 — 단계마다 멈추고 결과를 보고하게 한다. */
export function sourceGetPrompt(source: string, label: string, guide: SourceGetGuide): string {
  const lines = guide.steps.map((step, i) =>
    `${i + 1}. ${step.title}${step.command ? ` — \`${step.command}\`` : ''}\n   ${step.note}`,
  )
  return [
    `원천 ${label}(${source}) 원문을 가져와 줘. 스크립트: ${guide.script} (먼저 머리 주석을 읽어 옵션을 확인).`,
    '아래 단계를 순서대로 하되, DB 에 쓰는 단계(--commit) 앞에서는 직전 dry-run 결과(새 글 수 · 건너뜀 수 · 통과율)를 요약해 보여 주고 내 확인을 받아.',
    ...lines,
    guide.caution ? `주의: ${guide.caution}` : '',
    '끝나면 담은 수 · 건너뛴 수 · 실패 수를 보고하고, 필요하면 pnpm docs:db-stats 로 통계 블록을 갱신해.',
  ].filter(Boolean).join('\n')
}
