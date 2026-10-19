// apps/web/src/lib/admin/navigation.ts
import { PLAIN_STEPS } from '@/lib/csat/factory-plain'
import { WORKSPACES } from '@/lib/knowledge/vnext-labels'

export interface AdminLink {
  id: string
  label: string
  href: string
  paths?: readonly string[]
}
export interface AdminWorkspace extends AdminLink {
  tools?: readonly AdminLink[]
}
export interface AdminSection extends AdminLink {
  description: string
  workspaces: readonly AdminWorkspace[]
}
const step = (key: string): AdminLink => {
  const value = PLAIN_STEPS.find((item) => item.key === key)!
  return { id: key, label: value.name, href: value.href.split('?')[0]! }
}

/** Stable IDs and explicit ownership keep legacy URLs independent of menu structure. */
export const ADMIN_SECTIONS: readonly AdminSection[] = [
  {
    id: 'home',
    label: '작업 홈',
    href: '/admin',
    description: '처리할 일과 최근 작업을 확인합니다.',
    workspaces: [],
  },
  {
    id: 'content',
    label: '콘텐츠',
    href: '/admin/curation',
    description: '자료 종류를 고르고 수집·검토·발행합니다.',
    workspaces: [
      {
        id: 'books',
        label: '도서',
        href: '/admin/curation',
        paths: ['/admin/library', '/admin/curation'],
      },
      {
        id: 'articles',
        label: '짧은 글',
        href: '/admin/articles',
        paths: ['/admin/articles', '/admin/compose'],
        tools: [
          { id: 'collect', label: '원문 수집', href: '/admin/articles' },
          { id: 'compose', label: '사실 재저작', href: '/admin/compose' },
        ],
      },
      {
        id: 'comics',
        label: '만화',
        href: '/admin/comic',
        paths: ['/admin/comic', '/admin/pd-comics'],
        tools: [
          { id: 'digital', label: '디지털 제작', href: '/admin/comic' },
          { id: 'scan', label: '스캔 복원', href: '/admin/pd-comics' },
        ],
      },
      { id: 'corpus', label: '주제 코퍼스', href: '/admin/topic-corpus' },
    ],
  },
  {
    id: 'factory',
    label: '교재 제작',
    href: '/admin/csat',
    description: '한 권의 목표부터 검수·발행까지 이어갑니다.',
    workspaces: [
      {
        id: 'factory-overview',
        label: '제작 현황',
        href: '/admin/csat',
        paths: ['/admin/csat/details', '/admin/csat/help'],
        tools: [
          { id: 'map', label: '공장 지도', href: '/admin/csat' },
          { id: 'details', label: '상세 수치', href: '/admin/csat/details' },
          { id: 'help', label: '용어집', href: '/admin/csat/help' },
        ],
      },
      {
        id: 'make',
        label: '한 권 만들기',
        href: '/admin/csat/new',
        paths: [
          '/admin/csat/new',
          '/admin/csat/sources',
          '/admin/csat/sourcing',
          '/admin/csat/authoring',
          '/admin/csat/explain',
          '/admin/csat/review',
          '/admin/csat/press',
        ],
        tools: [
          step('order'),
          { id: 'sources', label: '글감 모으기·고르기', href: '/admin/csat/sources' },
          step('passage'),
          {
            id: 'writing',
            label: '문항·해설',
            href: '/admin/csat/authoring',
            paths: ['/admin/csat/explain'],
          },
          step('check'),
          step('publish'),
        ],
      },
      { id: 'catalog', label: '발행 교재', href: '/admin/csat/catalog' },
    ],
  },
  {
    id: 'words',
    label: '어휘·사전',
    href: '/admin/vocabulary',
    description: '사전, 단어장 제작과 사전 보강을 관리합니다.',
    workspaces: [
      { id: 'dictionary', label: '사전', href: '/admin/vocabulary' },
      { id: 'decks', label: '단어장 제작', href: '/admin/vocab/studio', paths: ['/admin/vocab'] },
      { id: 'pending', label: '사전 보강', href: '/admin/pending-words' },
      {
        id: 'word-quality',
        label: '품질·분류',
        href: '/admin/vrl',
        tools: [
          { id: 'health', label: '사전 품질', href: '/admin/vrl' },
          { id: 'taxonomy', label: '분류 기준', href: '/admin/vrl/taxonomy' },
          { id: 'concerns', label: '의심 단어', href: '/admin/vrl/concerns' },
          { id: 'automation', label: '분류 자동화', href: '/admin/vrl/automation' },
        ],
      },
    ],
  },
  {
    id: 'learners',
    label: '학습자·진단',
    href: '/admin/users',
    description: '학습자 현황과 진단·활동 기록을 확인합니다.',
    workspaces: [
      { id: 'users', label: '사용자 현황', href: '/admin/users' },
      { id: 'english-diagnosis', label: '영어 진단', href: '/admin/csat/diagnosis' },
      {
        id: 'word-diagnosis',
        label: '어휘 진단·수준',
        href: '/admin/vrl/diagnostic',
        paths: ['/admin/vrl/diagnostic', '/admin/vrl/users', '/admin/vrl/snapshots'],
        tools: [
          { id: 'tests', label: '어휘 진단', href: '/admin/vrl/diagnostic' },
          { id: 'levels', label: '사용자 수준', href: '/admin/vrl/users' },
          { id: 'snapshots', label: '수준 변경 이력', href: '/admin/vrl/snapshots' },
        ],
      },
      { id: 'activity', label: '활동 분석', href: '/admin/analytics' },
    ],
  },
  {
    id: 'research',
    label: '연구·기준',
    href: '/admin/knowledge',
    description: '학습 원리와 제작·진단의 근거를 검토합니다.',
    workspaces: [
      ...WORKSPACES.map((workspace) => ({
        id: `knowledge-${workspace.key}`,
        label: workspace.label,
        href: workspace.href,
        paths: [
          workspace.href,
          ...workspace.tabs.map((tab) => tab.href),
          ...(workspace.key === 'map' ? ['/admin/knowledge/item'] : []),
        ],
      })),
      {
        id: 'kice',
        label: '기출 분석',
        href: '/admin/kice',
        paths: ['/admin/kice', '/admin/csat/evidence'],
        tools: [
          { id: 'read', label: '분석 읽기', href: '/admin/kice' },
          { id: 'evidence', label: '분석 운영', href: '/admin/csat/evidence' },
          { id: 'origins', label: '기출 원천', href: '/admin/knowledge/sources/csat' },
        ],
      },
      {
        id: 'textbook-criteria',
        label: '교재 기준',
        href: '/admin/csat/strategy',
        paths: ['/admin/csat/strategy', '/admin/csat/blueprint'],
        tools: [
          { id: 'market', label: '시중 교재 비교', href: '/admin/csat/strategy' },
          { id: 'blueprint', label: '설계 기준', href: '/admin/csat/blueprint' },
        ],
      },
    ],
  },
  {
    id: 'operations',
    label: '운영·시스템',
    href: '/admin/quality',
    description: '콘텐츠 품질·DB·홍보 영상과 연결 상태를 확인합니다.',
    workspaces: [
      {
        id: 'quality',
        label: '콘텐츠 품질',
        href: '/admin/quality',
        tools: [
          { id: 'metrics', label: '품질 지표', href: '/admin/quality' },
          { id: 'gates', label: '품질 기준', href: '/admin/quality/gates' },
          { id: 'judge', label: '추출 판정', href: '/admin/quality/judge' },
        ],
      },
      { id: 'database', label: 'DB 상태', href: '/admin/db' },
      { id: 'video', label: '홍보 영상', href: '/admin/video' },
      {
        id: 'connections',
        label: '연결·지원 상태',
        href: '/admin/settings',
        paths: ['/admin/settings', '/admin/billing', '/admin/reports'],
      },
    ],
  },
]

const OWNERS: readonly [string, string][] = [
  ['/admin/csat/diagnosis', 'learners'],
  ['/admin/csat/evidence', 'research'],
  ['/admin/csat/strategy', 'research'],
  ['/admin/csat/blueprint', 'research'],
  ['/admin/vrl/diagnostic', 'learners'],
  ['/admin/vrl/users', 'learners'],
  ['/admin/vrl/snapshots', 'learners'],
  ...['library', 'curation', 'articles', 'compose', 'comic', 'pd-comics', 'topic-corpus'].map(
    (value): [string, string] => [`/admin/${value}`, 'content']
  ),
  ['/admin/csat', 'factory'],
  ...['vocabulary', 'vocab', 'pending-words', 'vrl'].map((value): [string, string] => [
    `/admin/${value}`,
    'words',
  ]),
  ...['users', 'analytics'].map((value): [string, string] => [`/admin/${value}`, 'learners']),
  ...['knowledge', 'kice', 'methodology'].map((value): [string, string] => [
    `/admin/${value}`,
    'research',
  ]),
  ...['quality', 'db', 'video', 'settings', 'reports', 'billing'].map((value): [string, string] => [
    `/admin/${value}`,
    'operations',
  ]),
]
export function adminPath(href: string): string {
  return href.split(/[?#]/)[0]!.replace(/\/$/, '') || '/'
}
export function matchesAdminPath(pathname: string, href: string): boolean {
  const target = adminPath(href),
    current = adminPath(pathname)
  return current === target || (target !== '/admin' && current.startsWith(`${target}/`))
}
export function getAdminLocation(pathname: string) {
  const id =
    adminPath(pathname) === '/admin'
      ? 'home'
      : [...OWNERS]
          .sort((a, b) => b[0].length - a[0].length)
          .find(([prefix]) => matchesAdminPath(pathname, prefix))?.[1]
  const section = ADMIN_SECTIONS.find((item) => item.id === id)
  if (!section) return null
  const candidates = section.workspaces.flatMap((workspace) =>
    [
      workspace.href,
      ...(workspace.paths ?? []),
      ...(workspace.tools ?? []).map((tool) => tool.href),
    ].map((prefix) => ({ prefix, workspace }))
  )
  const workspace =
    candidates
      .filter(({ prefix }) => matchesAdminPath(pathname, prefix))
      .sort((a, b) => adminPath(b.prefix).length - adminPath(a.prefix).length)[0]?.workspace ??
    section.workspaces[0] ??
    null
  const tool =
    workspace?.tools
      ?.filter((item) => matchesAdminPath(pathname, item.href))
      .sort((a, b) => adminPath(b.href).length - adminPath(a.href).length)[0] ?? null
  return { section, workspace, tool }
}
const CONTEXT_KEYS = ['series', 'band', 'grade', 'type', 'volume'] as const
export function withFactoryContext(
  href: string,
  search: Pick<URLSearchParams, 'get'> | null
): string {
  const [pathname, initial] = href.split('?'),
    params = new URLSearchParams(initial)
  for (const key of CONTEXT_KEYS) {
    const value = search?.get(key)
    if (value && !params.has(key)) params.set(key, value)
  }
  return `${pathname}${params.size ? `?${params}` : ''}`
}

export type AdminSearchParams = Record<string, string | string[] | undefined>
export function adminCompatibilityHref(target: string, search: AdminSearchParams = {}): string {
  const [withoutHash, hash] = target.split('#')
  const [pathname, query] = withoutHash!.split('?')
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(search)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value])
      params.append(key, item)
  }
  for (const [key, value] of new URLSearchParams(query)) params.set(key, value)
  return `${pathname}${params.size ? `?${params}` : ''}${hash ? `#${hash}` : ''}`
}

/** Let Next copy its internal history state and notify useSearchParams itself. */
export function updateAdminUrl(href: string | URL, mode: 'push' | 'replace' = 'replace') {
  window.history[mode === 'push' ? 'pushState' : 'replaceState'](null, '', href)
}
