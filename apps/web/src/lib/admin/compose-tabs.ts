// apps/web/src/lib/admin/compose-tabs.ts
//
// ACP §20 재저작 콘솔의 단계 이름 — **단일 출처**.
//
// 왜 별도 파일인가: AdminScreenHelp 는 탭을 **라벨 문자열로** 조회한다. 화면과 도움말이
// 각자 문자열을 들고 있으면 라벨을 바꾸는 순간 도움말이 조용히 사라진다(에러도 안 난다).
// 둘 다 여기서 가져오게 하고, 테스트가 도움말 레지스트리와의 일치를 잠근다.

export const COMPOSE_TABS = ['소스', '피드', '발견', '원장', '작성', '가공', '발행'] as const

export type ComposeTab = (typeof COMPOSE_TABS)[number]

/** 단계별로 뒤를 받치는 자산 — 아직 화면이 없는 단계에서 "무엇이 준비돼 있는지" 를 보여 준다. */
export const COMPOSE_TAB_BACKING: Record<ComposeTab, string> = {
  소스: 'compose/sources.ts · compose/learning-types.ts',
  피드: 'article_compose_feeds · compose/access.ts',
  발견: 'compose/collect.ts · compose/cluster.ts · compose/news-feed.ts',
  원장: 'article_fact_ledger · article_fact_attestation',
  작성: 'article_compose_jobs · acp_claim_compose_jobs() · compose/learning-types.ts',
  가공: 'compose/activities.ts · dcp/generate-items.ts',
  발행: 'article_compose_gates · trg_la_require_compose_gates',
}
