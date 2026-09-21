// apps/web/src/components/marketing/site/nav-data.ts
//
// 공개 화면 내비 · 메가메뉴 · 푸터의 **단일 출처**(DD-68 · docs/design/tines-mapping.md C1–C7).
// 참조 사이트의 메가메뉴 세 칸(Product · Solutions · Discover)과 같은 골격에 우리 실제 경로만 넣는다 —
// 없는 기능(블로그 · 이벤트 · 커뮤니티)은 자리를 만들지 않는다.

export type MenuCard = {
  href: string
  title: string
  body: string
  /** `public/illustrations/tines/<illo>.webp` */
  illo?: string
  /** 카드 면 — 의미 토큰 이름(스킨이 참조 색을 준다) */
  tone: 'feature' | 'soft' | 'success' | 'ju' | 'warning' | 'info'
}

export type MenuLink = { href: string; title: string; body: string }

export type Menu = {
  id: 'learn' | 'shelf' | 'discover'
  label: string
  /** 큰 카드들(참조의 BY FUNCTION · 대표 카드 자리) */
  cardsLabel?: string
  cards: MenuCard[]
  /** 오른쪽 목록(참조의 BY INDUSTRY 자리) */
  listLabel?: string
  list: MenuLink[]
}

export const MENUS: Menu[] = [
  {
    id: 'learn',
    label: '학습',
    cards: [
      { href: '/fit', title: '난이도 진단', body: '로그인 없이, 이 글에서 내가 아는 비율을 잽니다.', illo: 'spot-reading', tone: 'feature' },
      { href: '/wordvault', title: '단어 보관함', body: '담은 단어를 기억 상태 네 색으로 봅니다.', illo: 'spot-vault', tone: 'ju' },
      { href: '/flashcard', title: '간격 복습', body: '잊을 때쯤 다시 꺼냅니다(FSRS).', illo: 'spot-memory', tone: 'info' },
    ],
    listLabel: '연습',
    list: [
      { href: '/dictate', title: '받아쓰기', body: '소리를 글로 옮기며 듣기를 잡습니다.' },
      { href: '/scriptquiz', title: '지문 퀴즈', body: '읽은 글을 문항으로 다시 확인합니다.' },
    ],
  },
  {
    id: 'shelf',
    label: '서가',
    cardsLabel: '읽을 것',
    cards: [
      { href: '/library/books', title: '도서', body: '퍼블릭 도메인 고전을 챕터별 어휘와 함께.', illo: 'spot-reading', tone: 'success' },
      { href: '/comics', title: '복원 만화', body: '옛 만화를 다시 칠해 읽기 쉽게.', illo: 'spot-comic', tone: 'warning' },
    ],
    listLabel: '대상',
    list: [
      { href: '/csat', title: '수능 준비', body: '평가원 기출 지문과 유형별 연습.' },
      { href: '/library/vocab', title: '단어장', body: '레벨·주제별로 묶인 단어 세트.' },
      { href: '/teacher', title: '교사 · 학급', body: '초대코드로 학생 어휘 진행을 한 화면에.' },
    ],
  },
  {
    id: 'discover',
    label: '알아보기',
    cards: [
      { href: '/video', title: '영상', body: '3분 안에 보는 Vocaflow.', illo: 'spot-listening', tone: 'soft' },
      { href: '/about', title: '소개', body: '왜 「아는 비율」을 재는지.', illo: 'spot-quiz', tone: 'soft' },
    ],
    listLabel: '더 보기',
    list: [
      { href: '/pricing', title: '요금제', body: '무료로 시작하고, 필요할 때 넓힙니다.' },
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
