// apps/web/src/lib/admin/navigation.ts

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
  utilities?: readonly AdminLink[]
  workspaces: readonly AdminWorkspace[]
}
/** Stable IDs and explicit ownership keep legacy URLs independent of menu structure. */
export const ADMIN_SECTIONS: readonly AdminSection[] = [
  {
    "id": "home",
    "label": "작업 홈",
    "href": "/admin",
    "description": "지금 처리할 작업과 결과 확인으로 이동합니다.",
    "workspaces": []
  },
  {
    "id": "content",
    "label": "콘텐츠",
    "href": "/admin/curation",
    "description": "자료별 수집·검토·발행을 대상에 맞게 관리합니다.",
    "workspaces": [
      {
        "id": "content.books",
        "label": "도서",
        "href": "/admin/curation",
        "paths": [
          "/admin/curation",
          "/admin/curation/preview",
          "/admin/library"
        ]
      },
      {
        "id": "content.articles",
        "label": "짧은 글",
        "href": "/admin/articles",
        "paths": [
          "/admin/articles",
          "/admin/articles/preview",
          "/admin/compose"
        ],
        "tools": [
          {
            "id": "collect",
            "label": "원문 수집",
            "href": "/admin/articles"
          },
          {
            "id": "compose",
            "label": "사실 재저작",
            "href": "/admin/compose"
          }
        ]
      },
      {
        "id": "content.comics",
        "label": "만화",
        "href": "/admin/comic",
        "paths": [
          "/admin/comic",
          "/admin/pd-comics",
          "/admin/pd-comics/reader"
        ],
        "tools": [
          {
            "id": "digital",
            "label": "디지털 제작",
            "href": "/admin/comic"
          },
          {
            "id": "scan",
            "label": "스캔 복원",
            "href": "/admin/pd-comics"
          }
        ]
      }
    ]
  },
  {
    "id": "factory",
    "label": "교재 제작",
    "href": "/admin/csat",
    "description": "제작 기준과 실제 조회 범위를 확인하고 공정을 이어갑니다.",
    "workspaces": [
      {
        "id": "factory.overview",
        "label": "제작 현황",
        "href": "/admin/csat",
        "paths": [
          "/admin/csat",
          "/admin/csat/details",
          "/admin/csat/help"
        ],
        "tools": [
          {
            "id": "overview",
            "label": "전체 제작 현황",
            "href": "/admin/csat"
          },
          {
            "id": "details",
            "label": "전체 재고 상세",
            "href": "/admin/csat/details"
          },
          {
            "id": "help",
            "label": "공정 도움말",
            "href": "/admin/csat/help"
          }
        ]
      },
      {
        "id": "factory.process",
        "label": "제작 공정",
        "href": "/admin/csat/new",
        "paths": [
          "/admin/csat/authoring",
          "/admin/csat/explain",
          "/admin/csat/new",
          "/admin/csat/press",
          "/admin/csat/review",
          "/admin/csat/sources",
          "/admin/csat/sourcing"
        ],
        "tools": [
          {
            "id": "criteria",
            "label": "제작 기준",
            "href": "/admin/csat/new"
          },
          {
            "id": "sources",
            "label": "교재 글감 선택",
            "href": "/admin/csat/sources"
          },
          {
            "id": "passage",
            "label": "지문 제작",
            "href": "/admin/csat/sourcing"
          },
          {
            "id": "writing",
            "label": "문항·해설",
            "href": "/admin/csat/authoring"
          },
          {
            "id": "review",
            "label": "검수",
            "href": "/admin/csat/review"
          },
          {
            "id": "press",
            "label": "발행 승인",
            "href": "/admin/csat/press"
          }
        ]
      },
      {
        "id": "factory.catalog",
        "label": "발행 교재",
        "href": "/admin/csat/catalog",
        "paths": [
          "/admin/csat/catalog"
        ]
      }
    ]
  },
  {
    "id": "words",
    "label": "어휘·사전",
    "href": "/admin/vocabulary",
    "description": "관측·사전 보강·단어장 제작 결과를 연결합니다.",
    "workspaces": [
      {
        "id": "words.dictionary",
        "label": "사전",
        "href": "/admin/vocabulary",
        "paths": [
          "/admin/vocabulary"
        ]
      },
      {
        "id": "words.decks",
        "label": "단어장",
        "href": "/admin/vocab/studio",
        "paths": [
          "/admin/vocab",
          "/admin/vocab/collections",
          "/admin/vocab/curate",
          "/admin/vocab/runs",
          "/admin/vocab/runs/new",
          "/admin/vocab/sources",
          "/admin/vocab/sources/new",
          "/admin/vocab/studio"
        ]
      },
      {
        "id": "words.pending",
        "label": "사전 보강",
        "href": "/admin/pending-words",
        "paths": [
          "/admin/pending-words"
        ]
      },
      {
        "id": "words.observations",
        "label": "관측·분류",
        "href": "/admin/topic-corpus",
        "paths": [
          "/admin/topic-corpus",
          "/admin/vrl",
          "/admin/vrl/automation",
          "/admin/vrl/concerns",
          "/admin/vrl/taxonomy"
        ],
        "tools": [
          {
            "id": "corpus",
            "label": "주제 관측",
            "href": "/admin/topic-corpus"
          },
          {
            "id": "taxonomy",
            "label": "분류 기준",
            "href": "/admin/vrl/taxonomy"
          },
          {
            "id": "health",
            "label": "품질 점검",
            "href": "/admin/vrl"
          },
          {
            "id": "concerns",
            "label": "의심 단어",
            "href": "/admin/vrl/concerns"
          },
          {
            "id": "automation",
            "label": "분류 자동화",
            "href": "/admin/vrl/automation"
          }
        ]
      }
    ]
  },
  {
    "id": "learners",
    "label": "학습자·진단",
    "href": "/admin/csat/diagnosis/learners",
    "description": "원천별 학습자 기록과 진단·저장 계획을 확인합니다.",
    "workspaces": [
      {
        "id": "learners.records",
        "label": "학습자 기록",
        "href": "/admin/csat/diagnosis/learners",
        "paths": [
          "/admin/csat/diagnosis/learners",
          "/admin/users",
          "/admin/vrl/snapshots",
          "/admin/vrl/users"
        ],
        "tools": [
          {
            "id": "english-records",
            "label": "영어 진단 참여자",
            "href": "/admin/csat/diagnosis/learners"
          },
          {
            "id": "word-levels",
            "label": "어휘 수준",
            "href": "/admin/vrl/users"
          },
          {
            "id": "history",
            "label": "수준 이력",
            "href": "/admin/vrl/snapshots"
          },
          {
            "id": "accounts",
            "label": "사용자 집계",
            "href": "/admin/users"
          }
        ]
      },
      {
        "id": "learners.diagnostics",
        "label": "진단 운영",
        "href": "/admin/csat/diagnosis",
        "paths": [
          "/admin/csat/diagnosis",
          "/admin/csat/diagnosis/exams",
          "/admin/csat/diagnosis/settings",
          "/admin/vrl/diagnostic"
        ],
        "tools": [
          {
            "id": "english",
            "label": "영어 진단 운영",
            "href": "/admin/csat/diagnosis"
          },
          {
            "id": "words",
            "label": "어휘 검사 현황",
            "href": "/admin/vrl/diagnostic"
          }
        ]
      },
      {
        "id": "learners.analytics",
        "label": "활동 분석",
        "href": "/admin/analytics",
        "paths": [
          "/admin/analytics"
        ]
      }
    ]
  },
  {
    "id": "research",
    "label": "연구·기준",
    "href": "/admin/knowledge",
    "description": "출제 사고와 연구 근거를 원리·설계·제품 적용으로 연결합니다.",
    "workspaces": [
      {
        "id": "research.overview",
        "label": "연구 현황",
        "href": "/admin/knowledge",
        "paths": [
          "/admin/knowledge"
        ]
      },
      {
        "id": "research.evidence",
        "label": "탐구·근거",
        "href": "/admin/knowledge/lab",
        "paths": [
          "/admin/knowledge/experts",
          "/admin/knowledge/gaps",
          "/admin/knowledge/lab",
          "/admin/knowledge/lab/compare",
          "/admin/knowledge/lab/research",
          "/admin/knowledge/review",
          "/admin/knowledge/sources",
          "/admin/knowledge/sources/csat",
          "/admin/methodology"
        ]
      },
      {
        "id": "research.kice",
        "label": "기출 분석",
        "href": "/admin/kice",
        "paths": [
          "/admin/csat/evidence",
          "/admin/kice",
          "/admin/kice/item",
          "/admin/kice/map",
          "/admin/kice/plan",
          "/admin/kice/predict"
        ],
        "tools": [
          {
            "id": "analysis",
            "label": "출제 사고·유형 분석",
            "href": "/admin/kice"
          },
          {
            "id": "evidence",
            "label": "근거 검수·분석 운영",
            "href": "/admin/csat/evidence"
          },
          {
            "id": "origins",
            "label": "기출 원문·출처",
            "href": "/admin/knowledge/sources/csat"
          }
        ]
      },
      {
        "id": "research.principles",
        "label": "역량·원리",
        "href": "/admin/knowledge/map",
        "paths": [
          "/admin/knowledge/item",
          "/admin/knowledge/map",
          "/admin/knowledge/methods",
          "/admin/knowledge/principles"
        ],
        "tools": [
          {
            "id": "map",
            "label": "관계 지도",
            "href": "/admin/knowledge/map"
          },
          {
            "id": "principles",
            "label": "기제·원리",
            "href": "/admin/knowledge/principles"
          },
          {
            "id": "methods",
            "label": "방법·과제",
            "href": "/admin/knowledge/methods"
          }
        ]
      },
      {
        "id": "research.design",
        "label": "설계·검증",
        "href": "/admin/knowledge/design",
        "paths": [
          "/admin/csat/blueprint",
          "/admin/csat/strategy",
          "/admin/knowledge/design"
        ],
        "tools": [
          {
            "id": "learning",
            "label": "학습 설계·검증",
            "href": "/admin/knowledge/design"
          },
          {
            "id": "market",
            "label": "교재 설계·시장 비교",
            "href": "/admin/csat/strategy"
          },
          {
            "id": "blueprint",
            "label": "교재 설계 기준",
            "href": "/admin/csat/blueprint"
          }
        ]
      },
      {
        "id": "research.application",
        "label": "적용·성과",
        "href": "/admin/knowledge/product",
        "paths": [
          "/admin/knowledge/product",
          "/admin/knowledge/signals"
        ],
        "tools": [
          {
            "id": "applications",
            "label": "제품 적용",
            "href": "/admin/knowledge/product"
          },
          {
            "id": "signals",
            "label": "성과 재검토",
            "href": "/admin/knowledge/signals"
          }
        ]
      }
    ]
  },
  {
    "id": "operations",
    "label": "운영·시스템",
    "href": "/admin/quality",
    "description": "품질 검사·실행·복구와 DB·홍보 영상을 관리합니다.",
    "workspaces": [
      {
        "id": "operations.quality",
        "label": "품질·실행",
        "href": "/admin/quality",
        "paths": [
          "/admin/billing",
          "/admin/quality",
          "/admin/quality/gates",
          "/admin/quality/judge",
          "/admin/reports",
          "/admin/settings"
        ],
        "tools": [
          {
            "id": "metrics",
            "label": "품질 현황",
            "href": "/admin/quality"
          },
          {
            "id": "gates",
            "label": "검사 실행",
            "href": "/admin/quality/gates"
          },
          {
            "id": "judge",
            "label": "추출 판정",
            "href": "/admin/quality/judge"
          }
        ]
      },
      {
        "id": "operations.database",
        "label": "DB 점검",
        "href": "/admin/db",
        "paths": [
          "/admin/db"
        ]
      },
      {
        "id": "operations.video",
        "label": "홍보 영상",
        "href": "/admin/video",
        "paths": [
          "/admin/video",
          "/admin/video/requests"
        ]
      }
    ],
    "utilities": [
      {
        "id": "connections",
        "label": "연결·지원 상태",
        "href": "/admin/settings"
      }
    ]
  }
]

const OWNERS: readonly [string, string][] = [
  ['/admin/csat/diagnosis', 'learners'],
  ['/admin/csat/evidence', 'research'],
  ['/admin/csat/strategy', 'research'],
  ['/admin/csat/blueprint', 'research'],
  ['/admin/vrl/diagnostic', 'learners'],
  ['/admin/vrl/users', 'learners'],
  ['/admin/vrl/snapshots', 'learners'],
  ...['library', 'curation', 'articles', 'compose', 'comic', 'pd-comics'].map(
    (value): [string, string] => [`/admin/${value}`, 'content']
  ),
  ['/admin/csat', 'factory'],
  ...['vocabulary', 'vocab', 'pending-words', 'vrl', 'topic-corpus'].map((value): [string, string] => [
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
      .sort((a, b) => adminPath(b.prefix).length - adminPath(a.prefix).length)[0]?.workspace ?? null
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
