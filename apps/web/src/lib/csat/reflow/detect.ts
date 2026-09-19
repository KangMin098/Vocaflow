// apps/web/src/lib/csat/reflow/detect.ts
//
// **해시가 모르는 문제지 — 문항 번호 자리를 그 자리에서 찾는다.**
//
// 커밋된 좌표 색인은 우리가 가진 원본 30개의 sha256 에만 맞는다. 학습자가 EBSi 등에서 받은 파일은
// 같은 회차라도 바이트가 다를 수 있다(워터마크·재저장). 그때는 색인을 만든 규칙
// (`scripts/csat/pdf-anchors.mjs` 의 `columnsOf` · `realItems` · `firstFormPages`)을 브라우저에서
// 그대로 돌린다. 규칙을 새로 짜지 않고 옮긴 이유는 그 규칙이 이미 두 번 틀린 끝에 얻은 것이라서다
// (x=400 못박기 · 두 여백의 중간). 회귀 `detect.test.ts` 가 색인과 같은 답을 내는지 본다.

import type { PageFrags, PdfFrag, ReflowAnchorItem, ReflowAnchors } from './types'

const CIRC = '①②③④⑤'

interface Cand extends ReflowAnchorItem {
  marks: number
}

function charBox(f: PdfFrag, index: number, len = 1) {
  const per = f.w / Math.max(1, f.str.length)
  return { x: f.x + per * index, y: f.y, w: per * len, h: f.h }
}

function pageNumbers(pg: PageFrags) {
  const out: { no: number; x: number; y: number; w: number; h: number }[] = []
  for (const f of pg.frags) {
    const m = f.str.match(/^\s*(\d{1,2})\s*[.．]/)
    if (!m) continue
    const no = Number(m[1])
    if (no < 1 || no > 45) continue
    out.push({ no, ...charBox(f, m[0].indexOf(m[1]), m[1].length) })
  }
  return out
}

function pageMarks(pg: PageFrags): number {
  let n = 0
  for (const f of pg.frags) for (const ch of f.str) if (CIRC.includes(ch)) n += 1
  return n
}

/** 형(홀수/짝수)이 이어 붙은 파일 — 쪽수가 정확히 두 배이고 앞뒤가 대칭이면 앞 절반만 */
export function firstFormPageCount(pages: PageFrags[]): number {
  const n = pages.length
  if (n % 2 || n < 16) return n
  const half = n / 2
  const same = pages
    .slice(0, half)
    .every(
      (p, k) =>
        pageNumbers(p).length === pageNumbers(pages[half + k]).length && pageMarks(p) === pageMarks(pages[half + k]),
    )
  return same ? half : n
}

/**
 * 문항 번호 자리를 찾는다. 결과 모양은 커밋된 색인과 같다 — reflow 가 둘을 구분하지 않는다.
 * 번호를 20개도 못 찾으면 null(문제지가 아니거나 스캔본이다).
 */
export function detectAnchors(pages: PageFrags[]): ReflowAnchors | null {
  const formPages = firstFormPageCount(pages)
  const scoped = pages.slice(0, formPages)
  const all = scoped.flatMap((pg) => pageNumbers(pg).map((i) => ({ ...i, p: pg.p })))

  // 단 여백 — 번호 x 의 최빈값 둘. 경계는 오른 단 여백 **바로 왼쪽**(중간값이 아니다)
  const count = new Map<number, number>()
  for (const i of all) count.set(Math.round(i.x), (count.get(Math.round(i.x)) ?? 0) + 1)
  const margins = [...count]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([x]) => x)
    .sort((a, b) => a - b)
  if (margins.length < 2) return null
  const gutter = margins[1] - 10

  const cands: Cand[] = []
  for (const i of all) {
    const col = i.x < gutter ? 0 : 1
    if (Math.abs(i.x - margins[col]) > 4) continue // 들여쓴 목록(안내문 속 1. 2. 3.)
    cands.push({ ...i, col, marks: 0 })
  }
  // 읽기 순서: 쪽 → 단 → 위에서 아래. 번호는 커져야 한다(작아지거나 되풀이되면 본문이다)
  cands.sort((a, b) => a.p - b.p || a.col - b.col || b.y - a.y)
  const kept: ReflowAnchorItem[] = []
  for (const c of cands) {
    if (kept.length && c.no <= kept[kept.length - 1].no) continue
    kept.push({ no: c.no, p: c.p, col: c.col, x: c.x, y: c.y, w: c.w, h: c.h })
  }
  if (new Set(kept.map((k) => k.no)).size < 20) return null
  return { form_pages: formPages, items: kept }
}

/**
 * 첫 쪽 글자에서 회차를 읽는다 — 해시가 모를 때만 쓴다.
 * `2026학년도 대학수학능력시험` → `2026` · `2027학년도 … 6월 모의평가` → `M2706`.
 * A/B 형이 갈리던 2014 는 글자로 못 가른다 → null(학습자가 고른다).
 */
export function examIdFromText(firstPage: string): string | null {
  const t = firstPage.replace(/\s+/g, ' ')
  const year = t.match(/(20\d{2})\s*학년도/)
  if (!year) return null
  const y = Number(year[1])
  const mock = t.match(/(6|9)\s*월\s*(?:모의\s*평가|모의평가|모평)/)
  if (mock) return `M${String(y).slice(2)}${mock[1] === '6' ? '06' : '09'}`
  if (/대학수학능력시험/.test(t)) return y === 2014 ? null : String(y)
  return null
}
