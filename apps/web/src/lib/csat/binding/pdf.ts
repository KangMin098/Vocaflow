// apps/web/src/lib/csat/binding/pdf.ts
// 학습자가 기기에서 연 PDF ↔ 플랫폼 근거의 탐색 구조.
//
// 좌표 정본은 lib/csat/anchor-data/<회차>.json(공식 문제지 PDF 의 sha256 에 묶인 문항 번호·선지 표지 위치)이다.
// 학습자 PDF 의 sha256 이 그 값과 같을 때만 「이 쪽 이 자리」를 정확한 위치로 말한다. 해시가 다르거나 모르면
// 문항 번호로 찾아가는 안내(navigate_by_number)만 주고, 좌표를 정확한 근거처럼 그리지 않는다.
// PDF 파일 자체는 저장소·서버에 두지 않는다 — 해시와 좌표만 다룬다.

export type PdfBox = { p: number; x: number; y: number; w: number; h: number }
export type PdfItemAnchor = PdfBox & { no: number; col: number; marks: (PdfBox & { n: number })[] }
export type PdfAnchorFile = {
  exam_id: string
  sha256: string
  pages: { p: number; w: number; h: number }[]
  form_pages: number
  total_pages: number
  items: PdfItemAnchor[]
}

export type PdfLocation =
  /** 학습자 PDF 해시가 정본과 같다 — 쪽·좌표가 그 파일에서 정확하다 */
  | { status: 'exact'; examId: string; no: number; page: number; item: PdfBox; choice: (PdfBox & { n: number }) | null; sha256: string }
  /** 해시는 맞지만 그 문항/선지 좌표가 없다 */
  | { status: 'no_anchor'; examId: string; no: number; sha256: string; reason: 'item_missing' | 'choice_mark_missing' }
  /** 학습자 PDF 가 다른 판본이거나 해시를 모른다 — 번호로만 찾게 한다 */
  | { status: 'navigate_by_number'; examId: string; no: number; reason: 'hash_mismatch' | 'hash_unknown' | 'no_reference_pdf' }

const HEX64 = /^[0-9a-f]{64}$/

/**
 * @param ref         그 회차의 정본 좌표(없으면 null — 정본 PDF 를 확보하지 못한 회차)
 * @param learnerSha  학습자 기기에서 계산한 PDF sha256(브라우저 SubtleCrypto). 모르면 null
 * @param choice      선지 표지까지 가리키려면 1–5
 */
export function locateInPdf(ref: PdfAnchorFile | null, examId: string, no: number, learnerSha: string | null, choice?: number): PdfLocation {
  if (!ref) return { status: 'navigate_by_number', examId, no, reason: 'no_reference_pdf' }
  if (ref.exam_id !== examId) throw new Error(`좌표 파일 회차 불일치: ${ref.exam_id} ≠ ${examId}`)
  const sha = learnerSha?.toLowerCase() ?? null
  if (!sha || !HEX64.test(sha)) return { status: 'navigate_by_number', examId, no, reason: 'hash_unknown' }
  if (sha !== ref.sha256) return { status: 'navigate_by_number', examId, no, reason: 'hash_mismatch' }
  const it = ref.items.find((x) => x.no === no)
  if (!it) return { status: 'no_anchor', examId, no, sha256: sha, reason: 'item_missing' }
  let mark: (PdfBox & { n: number }) | null = null
  if (choice != null) {
    const ms = it.marks.filter((m) => m.n === choice)
    // 표지가 0개거나 2개 이상이면(같은 번호가 두 번 잡힘) 정확한 자리라 말할 수 없다
    if (ms.length !== 1) return { status: 'no_anchor', examId, no, sha256: sha, reason: 'choice_mark_missing' }
    mark = ms[0]
  }
  return { status: 'exact', examId, no, page: it.p, item: { p: it.p, x: it.x, y: it.y, w: it.w, h: it.h }, choice: mark, sha256: sha }
}

/** 좌표 파일 자체 검사 — 쪽 범위 · 문항 번호 중복 · 선지 표지 수 */
export function auditAnchorFile(ref: PdfAnchorFile): { no: number; problem: 'page_out_of_range' | 'duplicate_item' | 'marks_not_5' | 'mark_page_out_of_range' }[] {
  const out: { no: number; problem: 'page_out_of_range' | 'duplicate_item' | 'marks_not_5' | 'mark_page_out_of_range' }[] = []
  const pages = new Set(ref.pages.map((p) => p.p))
  const seen = new Set<number>()
  for (const it of ref.items) {
    if (seen.has(it.no)) out.push({ no: it.no, problem: 'duplicate_item' })
    seen.add(it.no)
    if (!pages.has(it.p)) out.push({ no: it.no, problem: 'page_out_of_range' })
    if (it.marks.length && new Set(it.marks.map((m) => m.n)).size !== 5) out.push({ no: it.no, problem: 'marks_not_5' })
    if (it.marks.some((m) => !pages.has(m.p))) out.push({ no: it.no, problem: 'mark_page_out_of_range' })
  }
  return out
}
