// apps/web/src/lib/pd-comic/display-title.ts
//
// **복원 만화의 표시 제목** — 화면·`<title>`·구조화 데이터가 같은 규칙을 쓰게 한다.
//
// ── 왜 규칙이 필요한가 (2026-08-26 실측) ────────────────────────────
// 아카이브가 준 제목(`pd_comic_issues.title`)은 들쭉날쭉하고 때로 틀렸다:
//
//   ATOMIC WAR! No. 1 - Comic Book, 1952      ← 대문자·설명·연도가 뒤섞임
//   Atomic War Issue #1 (Ace Comics)          ← 같은 만화의 다른 스캔본
//   Bafflng Mysteries (Ace Comics) Issue #18  ← **오타** (아카이브 쪽 오타)
//
// 우리 `pd_comic_series` 에는 `Baffling Mysteries` 라고 바르게 있다. 그런데 화면과
// `<title>` 은 원본 문자열을 그대로 썼고, 그 결과 오타가 검색 결과로 나갔다.
// 게다가 원본이 이미 호수를 품고 있는데 코드가 `#18` 을 또 붙여
// `Bafflng Mysteries (Ace Comics) Issue #18 #18 (1953)` 이 됐다.
//
// ── 규칙 ────────────────────────────────────────────────────────────
//   1. 시리즈 정본이 있으면 그것을 쓴다 (없으면 아카이브 제목으로 떨어진다)
//   2. 호수는 **아직 안 들어 있을 때만** 붙인다
//   3. 연도는 호출하는 쪽이 필요할 때만 (읽기 화면 헤더에는 군더더기다)
//
// 아카이브 원본 제목을 버리지는 않는다 — 출처 블록에서 "원본에 이렇게 적혀 있다" 로
// 보이는 것이 PD 자료의 정직함이다. 다만 **우리 화면의 이름표**로는 쓰지 않는다.

export interface PdComicTitleParts {
  title: string
  seriesTitle: string | null
  issueNo: number | null
  publishedYear?: number | null
}

/** 시리즈 정본 + 호수. 중복된 호수는 붙이지 않는다. */
export function pdComicDisplayTitle(p: PdComicTitleParts): string {
  const base = p.seriesTitle?.trim() || p.title
  const needsIssue = p.issueNo != null && !base.includes(`#${p.issueNo}`)
  return needsIssue ? `${base} #${p.issueNo}` : base
}

/** 위에 발행연도까지 — 검색 결과에서 "1953년 원본" 이 이 콘텐츠의 값이다. */
export function pdComicDisplayTitleWithYear(p: PdComicTitleParts): string {
  const base = pdComicDisplayTitle(p)
  return p.publishedYear ? `${base} (${p.publishedYear})` : base
}
