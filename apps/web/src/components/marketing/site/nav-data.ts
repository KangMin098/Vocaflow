// apps/web/src/components/marketing/site/nav-data.ts
//
// 공개 화면 내비 · 메가메뉴 · 푸터의 **단일 출처**(DD-68 · docs/design/tines-mapping.md C1–C7).
// 참조 사이트의 메가메뉴 세 칸(Product · Solutions · Discover)과 같은 골격에 우리 실제 경로만 넣는다 —
// 없는 기능(블로그 · 이벤트 · 커뮤니티)은 자리를 만들지 않는다.

/**
 * 카드 면 — 참조 메가메뉴 카드 색(tines-mapping §19). `deep-*` = 원색 면 + 크림 글자, 나머지 = 옅은 면 + 같은 색상 글자.
 * 클래스는 globals.css `.tone-*`(글자 그대로 SiteHeader 의 TONE 표에서 고른다).
 */
export type CardTone = 'deep-purple' | 'deep-green' | 'deep-orange' | 'deep-magenta' | 'deep-ink' | 'lavender' | 'green' | 'peach'

export type MenuCard = {
  href: string
  title: string
  body: string
  /** `public/illustrations/tines/<illo>.webp` — 물건 소품(투명) */
  illo?: string
  /** 카드 머리 그림(참조 Discover 의 이미지 카드) — 패턴 · 타일 */
  image?: string
  tone: CardTone
  /** → 안쪽 이동 · ↗ 다른 구역(참조 화살표 두 종) */
  arrow?: 'in' | 'out'
}

/** 목록 행 — 아이콘 칩(소품) + 제목 + 한 줄. `col` 은 discover 레이아웃에서 몇 번째 열 아래에 붙는지. */
export type MenuLink = { href: string; title: string; body: string; illo?: string; col?: number }

/**
 * 메가메뉴 레이아웃 — 참조 세 메뉴의 골격을 그대로(사용자 스크린샷 2026-09-22):
 *   product   = 큰 진한 카드(가운데 소품 + 아래 꽃밭 띠) + 작은 진한 카드 세로 + 떨어진 옅은 카드(list[0])
 *   solutions = 옅은 틀(모노 눈썹) 안 원색 카드들 + 떨어진 살구 패널(모노 눈썹 · 아이콘 칩 목록)
 *   discover  = 열마다 옅은 틀(이미지 카드 + 아래 목록 행) + 마지막 원색 카드(둥근 소품 · ↗)
 */
export type MenuLayout = 'product' | 'solutions' | 'discover'

export type Menu = {
  id: 'learn' | 'shelf' | 'discover'
  label: string
  layout: MenuLayout
  /** 모노 대문자 눈썹(참조 BY FUNCTION 자리) */
  cardsLabel?: string
  cards: MenuCard[]
  /** 모노 대문자 눈썹(참조 BY INDUSTRY 자리) */
  listLabel?: string
  list: MenuLink[]
}

export const MENUS: Menu[] = [
  {
    id: 'learn',
    label: '학습',
    layout: 'product',
    cards: [
      { href: '/fit', title: '난이도 진단', body: '로그인 없이, 이 글에서 내가 아는 비율을 잽니다.', illo: 'spot-topic-data', tone: 'deep-purple' },
      { href: '/wordvault', title: '단어 보관함', body: '담은 단어를 기억 상태 네 색으로 봅니다.', tone: 'deep-purple', arrow: 'in' },
      { href: '/flashcard', title: '간격 복습', body: '잊을 때쯤 다시 꺼냅니다(FSRS).', tone: 'deep-purple', arrow: 'in' },
      { href: '/scriptquiz', title: '지문 퀴즈', body: '읽은 글을 문항으로 다시 확인합니다.', tone: 'deep-purple', arrow: 'in' },
    ],
    list: [
      { href: '/dictate', title: '받아쓰기', body: '소리를 글로 옮기며 듣기를 잡습니다.', illo: 'spot-listening' },
    ],
  },
  {
    id: 'shelf',
    label: '서가',
    layout: 'solutions',
    cardsLabel: '자료별',
    cards: [
      { href: '/library/books', title: '도서', body: '퍼블릭 도메인 고전을 챕터별 어휘와 함께.', illo: 'spot-reading', tone: 'deep-green', arrow: 'in' },
      { href: '/comics', title: '복원 만화', body: '옛 만화를 다시 칠해 읽기 쉽게.', illo: 'spot-comic', tone: 'deep-orange', arrow: 'in' },
      { href: '/library/vocab', title: '단어장', body: '레벨·주제별로 묶인 단어 세트.', illo: 'spot-vault', tone: 'deep-magenta', arrow: 'in' },
    ],
    listLabel: '대상별',
    list: [
      { href: '/csat', title: '수능 준비', body: '평가원 기출 지문과 유형별 연습.', illo: 'spot-cat-exam' },
      { href: '/library/textbooks', title: '교재', body: '학년 계단으로 세운 교재 서가.', illo: 'spot-dictionary' },
      { href: '/teacher', title: '교사 · 학급', body: '초대코드로 학생 어휘 진행을 한 화면에.', illo: 'spot-teacher' },
    ],
  },
  {
    id: 'discover',
    label: '알아보기',
    layout: 'discover',
    cards: [
      { href: '/video', title: '3분 안에 보는 Vocaflow', body: '영상 보기', image: 'pattern-kaleido-1', illo: 'spot-listening', tone: 'lavender' },
      { href: '/pricing', title: '무료로 시작하고, 필요할 때 넓힙니다', body: '요금제 보기', image: 'pattern-kaleido-2', illo: 'spot-topic-data', tone: 'green' },
      { href: '/teacher', title: '학급으로 쓰기', body: '교사 · 학교 · 기관', illo: 'spot-teacher', tone: 'deep-orange', arrow: 'out' },
    ],
    list: [
      { href: '/about', title: '소개', body: '왜 「아는 비율」을 재는지.', illo: 'spot-reading', col: 0 },
      { href: '/signup', title: '회원가입', body: '가입하고 담은 단어를 이어 가요.', illo: 'spot-welcome', col: 1 },
      { href: '/login', title: '로그인', body: '이미 계정이 있어요.', illo: 'spot-settings', col: 1 },
    ],
  },
]

/** 메뉴 밖 최상위 링크 */
export const TOP_LINKS = [{ href: '/pricing', label: '요금제' }] as const

export const FOOTER_COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  { title: '학습', links: [
    { label: '난이도 진단', href: '/fit' }, { label: '단어 보관함', href: '/wordvault' }, { label: '간격 복습', href: '/flashcard' },
    { label: '받아쓰기', href: '/dictate' }, { label: '지문 퀴즈', href: '/scriptquiz' },
  ] },
  { title: '서가', links: [
    { label: '도서', href: '/library/books' }, { label: '복원 만화', href: '/comics' }, { label: '단어장', href: '/library/vocab' }, { label: '수능 준비', href: '/csat' },
  ] },
  { title: '알아보기', links: [
    { label: '소개', href: '/about' }, { label: '영상', href: '/video' }, { label: '요금제', href: '/pricing' }, { label: '교사 · 학급', href: '/teacher' },
  ] },
  { title: '시작하기', links: [
    { label: '회원가입', href: '/signup' }, { label: '로그인', href: '/login' }, { label: '비밀번호 재설정', href: '/reset-password' },
  ] },
  { title: '지원 · 정책', links: [
    { label: '문의', href: 'mailto:hello@vocaflow.app' }, { label: '학교 · 기관', href: 'mailto:hello@vocaflow.app?subject=Team' },
    { label: '이용약관', href: '/terms' }, { label: '개인정보처리방침', href: '/privacy' },
  ] },
]
