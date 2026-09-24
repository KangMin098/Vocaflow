// apps/web/src/lib/csat/make-guide.ts
//
// **새 교재를 만드는 다섯 갈래 — 사용자가 화면만 보고 끝까지 갈 수 있게.**
//
// ── 왜 생겼나 (2026-09-24 · 사용자 지적) ─────────────────────────────
// 「새 브랜드 · 시리즈 · 단행본은 어떻게 만드나」에 답이 **도움말 산문과 코드 주석**에만 있었다
// (`help/csat.ts` 의 cautions 한 문단 · `series-catalog.ts` 머리말). 화면에 없는 것은 사용자가 모른다.
// 여기는 그 절차를 **걸음마다 「어느 화면에서 무엇을 누르나」 또는 「Claude Code 에 무엇을 붙여 넣나」**
// 둘 중 하나로 적는다. 둘 다 없는 걸음은 만들지 않는다 — 그것이 이 파일의 규칙이다(회귀가 잰다).
//
// 지시문은 **그대로 붙여 넣으면 일이 되는** 문장이다: 무엇을 · 어느 파일에서 · 무엇을 확인하고 ·
// 무엇을 알려 달라는지까지 적는다. 「시리즈 만들어 줘」만 보내면 Claude 가 절차(근거 · 빈 계단 ·
// 재고 먼저)를 건너뛸 수 있다 — 그 절차가 지켜 온 사고는 `series-catalog.ts` 머리말에 있다.

export type CaseKey = 'volume' | 'revise' | 'series' | 'brand' | 'single'

export interface GuideStep {
  title: string
  /** 사람이 여는 화면. */
  where?: { href: string; label: string }
  /** 그 화면에서 할 일 — 무엇을 누르고 무엇을 보나. */
  doThis: string
  /** Claude Code 에 붙여 넣을 지시문을 만드는 키. 폼 값이 들어간다. */
  claude?: PromptKey
  /** 사람이 결정하는 걸음 — 자동으로 넘어가지 않는다. */
  decides?: boolean
}

export interface MakeCase {
  key: CaseKey
  letter: string
  name: string
  /** 언제 이 갈래인가 — 한 줄. */
  when: string
  /** 이 갈래에 폼이 필요한가 — 지시문에 들어갈 값. */
  form: 'none' | 'series' | 'single' | 'rename'
  steps: GuideStep[]
}

export type PromptKey = 'defineSeries' | 'designLadder' | 'renameBrand' | 'defineSingle'

const BIND_STEPS: GuideStep[] = [
  {
    title: '권 고르기',
    where: { href: '/admin/csat/new#wizard', label: '아래 「한 권 고르기」' },
    doThis: '시리즈 줄에서 학년 칸을 누르세요. 칸의 숫자는 「그 권이 쓸 수 있는 문제 / 한 권에 필요한 문제」예요.',
  },
  {
    title: '재료 확인',
    doThis: '그 권이 쓰는 문제 유형마다 문제 수 · 해설 수 · 근거가 나와요. 0 인 유형이 있으면 그 권은 아직 못 묶어요.',
  },
  {
    title: '규격 정하기',
    doThis:
      '단원 수를 고르세요(시중 교재 실측 범위 안). 문제 수는 「단원 수 × 한 단원 문제 수」로 따라 바뀌어요. 표지 그림은 실제로 찍힐 표지와 같아요.',
    decides: true,
  },
  {
    title: '발주 — 모자란 것 채우기',
    doThis:
      '확인 네 가지(문제 수 → 유형 배합 → 해설 → 근거) 중 처음 막힌 하나만 보여요. 그 아래 「Claude 에게 맡기기」를 눌러 지시문을 복사해 Claude Code 에 붙여 넣으세요. 다 채우면 다시 이 걸음으로 와요(숫자는 30분마다 갱신돼요).',
  },
  {
    title: '책으로 묶기 · 목차 굽기',
    doThis:
      '넷 다 통과하면 「책으로 묶기」와 「목차 굽기」 두 줄이 나와요. 순서대로 「Claude 에게 맡기기」로 복사해 붙여 넣으세요. 목차를 안 구우면 학습자 화면에 목차가 없어요.',
  },
  {
    title: '확인하기',
    where: { href: '/admin/csat/review', label: '확인하기 화면' },
    doThis: '네 겹 확인이 모두 채워졌는지 보세요. 빈 겹이 있으면 그 화면의 「Claude 차례」 줄을 맡기세요.',
    decides: true,
  },
  {
    title: '내보내기 결재',
    where: { href: '/admin/csat/press', label: '책으로 내기 화면' },
    doThis: '그 권의 「발행 승인」을 누르면 학습자에게 나가요. 누르지 않으면 나가지 않아요 — 자동으로 넘어가지 않아요.',
    decides: true,
  },
]

export const MAKE_CASES: readonly MakeCase[] = [
  {
    key: 'volume',
    letter: 'A',
    name: '있는 시리즈의 한 권',
    when: '독해 · 어휘 · 구문 시리즈에서 아직 안 낸 학년 권을 낼 때',
    form: 'none',
    steps: BIND_STEPS,
  },
  {
    key: 'revise',
    letter: 'B',
    name: '낸 책 다시 내기 (개정)',
    when: '이미 낸 권의 내용이나 규격이 바뀌었을 때 — 「냈음」 칸도 누를 수 있어요',
    form: 'none',
    steps: [
      {
        title: '다시 낼 권 찾기',
        where: { href: '/admin/csat/press', label: '책으로 내기 화면' },
        doThis: '「예전 규격」 표시가 붙은 권이 다시 묶어야 할 권이에요.',
      },
      ...BIND_STEPS.map((s, i) =>
        i === 0 ? { ...s, doThis: '「냈음」 칸을 누르세요. 다시 묶으면 그 권의 기록과 파일을 덮어써요 — 권 수는 늘지 않아요.' } : s,
      ),
    ],
  },
  {
    key: 'series',
    letter: 'C',
    name: '새 시리즈',
    when: '독해 · 어휘 · 구문 밖의 새 줄(예: 문법 · 듣기)을 열 때',
    form: 'series',
    steps: [
      {
        title: '근거 적기',
        doThis:
          '아래 칸을 채우세요. 「왜 여나(계기)」 · 「그때 본 숫자」 · 「잰 날」이 비면 등록이 안 돼요 — 근거 없는 시리즈는 빈 책을 낸 적이 있어요.',
        decides: true,
      },
      {
        title: '시리즈 등록 맡기기',
        doThis: '「지시문 복사」를 눌러 Claude Code 에 붙여 넣으세요. 학년 계단은 비운 채 등록돼요.',
        claude: 'defineSeries',
      },
      {
        title: '등록 확인',
        where: { href: '/admin/csat/catalog', label: '낸 뒤 살피기 화면' },
        doThis: '새 시리즈 줄이 「발의」로 떠 있으면 등록된 거예요.',
      },
      {
        title: '학년 계단 설계 맡기기',
        doThis:
          '넣을 학년을 고르고 「지시문 복사」 → Claude Code. Claude 가 학년마다 재고를 먼저 재고, 모자란 학년은 넣지 않고 알려 줘요.',
        claude: 'designLadder',
      },
      {
        title: '설계 확인',
        where: { href: '/admin/csat/blueprint', label: '학년 계단 설계 화면' },
        doThis: '새 시리즈의 계단이 보이고 끊긴 곳이 없는지 보세요. 한 권 몫(문제 수)이 찬 학년은 「생산」이 돼요.',
      },
      {
        title: '한 권씩 내기',
        where: { href: '/admin/csat/new#wizard', label: '아래 「한 권 고르기」' },
        doThis: '이제 새 시리즈 줄이 보여요. 그다음은 A 갈래와 같아요.',
      },
    ],
  },
  {
    key: 'brand',
    letter: 'D',
    name: '새 브랜드 · 이름 바꾸기',
    when: '브랜드는 시리즈의 이름이에요. 새 이름으로 새 책을 내면 C, 있는 시리즈의 이름만 바꾸면 여기예요',
    form: 'rename',
    steps: [
      {
        title: '바꿀 시리즈와 새 이름 정하기',
        doThis: '아래에서 시리즈를 고르고 새 이름을 적으세요.',
        decides: true,
      },
      {
        title: '이름 바꾸기 맡기기',
        doThis: '「지시문 복사」 → Claude Code. 끝나면 다시 묶어야 할 권 목록을 받아요.',
        claude: 'renameBrand',
      },
      {
        title: '낸 권 모두 다시 묶기',
        where: { href: '/admin/csat/new#wizard', label: '아래 「한 권 고르기」' },
        doThis: '받은 목록의 권마다 「냈음」 칸 → B 갈래. 안 묶은 권은 옛 이름 그대로 매대에 남아요.',
      },
    ],
  },
  {
    key: 'single',
    letter: 'E',
    name: '단행본 (한 권짜리)',
    when: '학년 하나만 겨냥한 책 — 「학년 계단이 한 칸인 시리즈」로 만들어요',
    form: 'single',
    steps: [
      {
        title: '근거 적기',
        doThis:
          '아래 칸을 채우세요. 시중 교재 표본 75편이 전부 시리즈 소속이라 단행본은 일부러 안 만들어 온 모양이에요 — 근거가 특히 중요해요.',
        decides: true,
      },
      {
        title: '단행본 등록 맡기기',
        doThis: '「지시문 복사」 → Claude Code. 재고를 먼저 재고, 한 권 몫이 안 되면 등록하지 않고 모자란 몫을 알려 줘요.',
        claude: 'defineSingle',
      },
      {
        title: '한 권 내기',
        where: { href: '/admin/csat/new#wizard', label: '아래 「한 권 고르기」' },
        doThis: '새 줄에 칸 하나가 보여요. 그다음은 A 갈래와 같아요.',
      },
    ],
  },
]

/* ───────────────────────── 지시문 ───────────────────────── */

export const TRIGGERS: { key: string; label: string; asks: string }[] = [
  { key: 'institution', label: '제도', asks: '교육과정·시험 체제가 바뀌었다' },
  { key: 'season', label: '시기', asks: '달력이 지금 이 책을 부른다' },
  { key: 'segment', label: '대상', asks: '다른 학습자에게 판다' },
  { key: 'competition', label: '경쟁', asks: '시중이 차지한 자리가 있다' },
  { key: 'supply', label: '공급', asks: '담을 책이 없는 재고가 쌓였다' },
  { key: 'demand', label: '수요', asks: '학습자가 실제로 고른다' },
]

export interface SeriesForm {
  name: string
  /** 표지에 크게 찍히는 영문 짧은 이름 — READING · VOCAB · SYNTAX 처럼. */
  short: string
  kind: string
  accent: string
  question: string
  trigger: string
  evidence: string
  measuredOn: string
  /** 넣을 학년들(설계 지시문). 단행본은 하나. */
  grades: string[]
}

export interface RenameForm {
  seriesId: string
  oldName: string
  newName: string
}

/** 폼이 모자라면 무엇이 모자란지 — 빈 지시문을 복사하게 두지 않는다. */
export function missingFields(key: PromptKey, f: SeriesForm | RenameForm): string[] {
  if (key === 'renameBrand') {
    const r = f as RenameForm
    return [!r.seriesId && '바꿀 시리즈', !r.newName.trim() && '새 이름'].filter(Boolean) as string[]
  }
  const s = f as SeriesForm
  const need: [boolean, string][] = [
    [!s.name.trim(), '이름'],
    [!s.question.trim(), '답하는 질문'],
    [!s.trigger, '계기'],
    [!s.evidence.trim(), '그때 본 숫자'],
    [!/^\d{4}-\d{2}-\d{2}$/.test(s.measuredOn), '잰 날(YYYY-MM-DD)'],
  ]
  if (key === 'designLadder' && s.grades.length === 0) need.push([true, '넣을 학년'])
  if (key === 'defineSingle' && s.grades.length !== 1) need.push([true, '학년 하나'])
  return need.filter(([miss]) => miss).map(([, label]) => label)
}

const CATALOG = 'packages/library-pipeline/src/textbook/series-catalog.ts'

export function buildPrompt(key: PromptKey, f: SeriesForm | RenameForm): string {
  if (key === 'renameBrand') {
    const r = f as RenameForm
    return [
      `교재 시리즈 「${r.oldName}」(id: ${r.seriesId})의 브랜드 이름을 「${r.newName}」로 바꿔 줘.`,
      '',
      '절차:',
      `1. ${CATALOG} 에서 그 시리즈의 brand 를 고쳐. 표지 짧은 이름이 바뀌어야 하면 함께 고쳐.`,
      '2. 이 이름을 쓰는 회귀(시리즈·카탈로그·표지)를 돌려 통과시켜.',
      '3. 다시 묶어야 하는 권(이미 낸 권) 목록을 textbook_volume_renders 에서 실측으로 뽑아 줘 — 시리즈 · 단 · 권 제목.',
      '4. 커밋은 `git commit --only` 로 이 변경 파일만.',
      '',
      '끝나면 알려 줘: 바꾼 파일 · 회귀 결과 · 다시 묶을 권 목록.',
    ].join('\n')
  }
  const s = f as SeriesForm
  const trig = TRIGGERS.find((t) => t.key === s.trigger)
  const head = [
    `- 이름(브랜드): ${s.name}`,
    `- 표지 짧은 이름: ${s.short || '(정해 줘 — 영문 대문자 한 낱말)'}`,
    `- 시장 칸(kind): ${s.kind || '(정해 줘 — 기존 칸과 같으면 같은 시장 분모를 나눠 쓴다)'}`,
    `- 표지 색: ${s.accent || '(정해 줘 — 기존 시리즈 색과 겹치지 않게)'}`,
    `- 답하는 질문: ${s.question}`,
    `- 계기: ${trig ? `${trig.label}(${trig.key})` : s.trigger} · 근거: ${s.evidence} · 잰 날: ${s.measuredOn}`,
  ]
  if (key === 'defineSeries') {
    return [
      '새 교재 시리즈를 발의해 줘.',
      ...head,
      '',
      '절차:',
      `1. ${CATALOG} 의 SERIES_CATALOG 에 SeriesDef 를 더해. SeriesId 타입도 넓혀. intent 는 'active', origin 은 위 계기·근거·날짜 그대로.`,
      '2. rungs 는 **비워 둬** — 발의 상태로 등록한다. 계단은 다음 지시로 설계한다.',
      '3. 표지 색이 기존 시리즈 accent 와 겹치거나 가까우면 멈추고 알려 줘.',
      '4. 시리즈 관련 회귀를 돌려 통과시키고, /admin/csat/catalog 에 새 줄이 「발의」로 뜨는지 확인해.',
      '5. 커밋은 `git commit --only` 로 이 변경 파일만.',
      '',
      '끝나면 알려 줘: 더한 SeriesDef · 회귀 결과 · 카탈로그에 뜬 상태.',
    ].join('\n')
  }
  if (key === 'designLadder') {
    return [
      `「${s.name}」 시리즈의 학년 계단을 설계해 줘.`,
      `- 넣을 학년: ${s.grades.join(' · ')}`,
      `- 이 시리즈가 답하는 질문: ${s.question}`,
      '',
      '절차:',
      '1. 학년마다 쓸 문제 유형을 정해 — 시중 교재 코퍼스와 기출 유형 근거를 함께 적어.',
      '2. **넣기 전에** 그 학년 × 유형의 문제 재고와 해설 수를 DB 에서 실측해. 수를 rungs 옆 주석에 날짜와 함께 적어.',
      '3. 한 권 몫(단원 수 × 한 단원 문제 수)에 못 미치는 학년은 **넣지 말고** 모자란 몫을 보고해.',
      `4. ${CATALOG} 의 그 시리즈 rungs 를 채우고 회귀를 돌려. /admin/csat/blueprint 에 끊긴 계단이 없는지 확인해.`,
      '5. 커밋은 `git commit --only` 로.',
      '',
      '끝나면 알려 줘: 넣은 학년과 유형 · 학년별 재고 · 뺀 학년과 이유.',
    ].join('\n')
  }
  return [
    '한 권짜리 교재(단행본)를 등록해 줘 — 학년 계단이 한 칸인 시리즈로 만든다.',
    ...head,
    `- 학년: ${s.grades[0] ?? '(정해 줘)'}`,
    '',
    '절차:',
    '1. 그 학년에서 쓸 문제 유형을 정하고, **먼저** 학년 × 유형의 문제 재고와 해설 수를 DB 에서 실측해.',
    '2. 한 권 몫에 못 미치면 **등록하지 말고** 모자란 몫과 채우는 방법을 보고해.',
    `3. 몫이 되면 ${CATALOG} 에 SeriesDef 를 더하되 rungs 는 그 한 칸만. 재고 수를 주석에 날짜와 함께 적어.`,
    '4. 회귀를 돌리고 /admin/csat/new 에 새 줄이 칸 하나로 뜨는지 확인해.',
    '5. 커밋은 `git commit --only` 로.',
    '',
    '끝나면 알려 줘: 더한 SeriesDef · 실측 재고 · 회귀 결과.',
  ].join('\n')
}
