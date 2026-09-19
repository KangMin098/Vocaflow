// scripts/csat/pdf-anchors.mjs
//
// **평가원 문제지 PDF 에서 좌표를 뽑는다 — 문항 번호와 선지 기호의 자리.**
//
// 왜 `pdfjs-dist` 인가: 오버레이를 그리는 쪽도 브라우저의 PDF.js 다. **뽑는 쪽과 그리는 쪽이
// 같은 라이브러리면 좌표계가 같다** — Poppler 로 뽑으면 둘이 미묘하게 어긋나고, 그 어긋남은
// 박스가 한 줄 위에 그려지는 식으로 조용히 나타난다.
//
// 여기서 다루지 않는 것: 오버레이 렌더·앵커 DB·형(form) 대조. 이 스크립트는 **잴 수 있는지**만
// 답한다 — 문항 번호와 ①~⑤ 를 몇 %나 찾아내는가. 그 수치 없이 프로토타입을 만들면
// "되는 것처럼 보이는 화면" 이 나온다.
//
// ⚠️ 좌표는 PDF 좌표계(왼아래 원점 · 1/72 인치)로 돌려준다. 화면 좌표로 바꾸는 일은
//    그리는 쪽이 자기 배율로 한다 — 여기서 픽셀로 바꾸면 확대율이 박혀 버린다.
//
// 실행:
//   node scripts/csat/pdf-anchors.mjs <PDF 경로>            (측정만 — 아무것도 안 쓴다)
//   node scripts/csat/pdf-anchors.mjs <PDF 경로> --json <출력.json>

import fs from 'node:fs'
import path from 'node:path'

const arg = (n, d = null) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : d
}

const CIRC = ['①', '②', '③', '④', '⑤']

/**
 * 한 페이지의 글자 조각을 좌표와 함께.
 *
 * PDF.js 의 `getTextContent()` 는 조각(item)마다 `transform`(6원소 행렬)과 `width`·`height` 를
 * 준다. 조각은 **낱말 단위가 아니다** — 조판이 자른 대로라 `①` 이 홀로 오기도 하고
 * `① her mother dealt` 처럼 붙어 오기도 한다. 그래서 문자 위치를 조각 안에서 비례 배분한다.
 * 글꼴 폭을 모르므로 비례 배분은 근사다 — 기호 한 글자의 자리를 재는 데는 충분하고,
 * 문장 전체를 재려면 부족하다(그때는 조각 경계를 그대로 쓴다).
 */
async function pageItems(page) {
  const content = await page.getTextContent()
  const out = []
  for (const it of content.items) {
    if (typeof it.str !== 'string' || !it.str.length) continue
    const [a, , , d, e, f] = it.transform
    // `transform` 의 e·f 가 기준선(baseline) 왼쪽 끝이다. 높이는 d(글꼴 크기)로 본다.
    out.push({
      str: it.str,
      x: e,
      y: f,
      w: it.width,
      h: it.height || Math.abs(d) || Math.abs(a),
    })
  }
  return out
}

/** 조각 안 `index` 번째 글자의 x 구간 — 조각 폭을 글자 수로 비례 배분한 근사 */
function charBox(frag, index, len = 1) {
  const per = frag.w / Math.max(1, frag.str.length)
  return {
    x: frag.x + per * index,
    y: frag.y,
    w: per * len,
    h: frag.h,
  }
}

export async function extractAnchors(pdfPath) {
  // ⚠️ Node 에서는 **legacy 빌드**를 써야 한다 — 기본 빌드는 브라우저 전용 API 를 건드린다.
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await getDocument({ data, useSystemFonts: false, isEvalSupported: false }).promise

  // **쪽수를 먼저 잡아 둔다** — 문서를 닫은 뒤에 읽으면 프록시가 죽어 있다
  const numPages = doc.numPages
  const pages = []
  for (let p = 1; p <= numPages; p += 1) {
    const page = await doc.getPage(p)
    const vp = page.getViewport({ scale: 1 })
    const frags = await pageItems(page)

    // 문항 번호 — 줄머리의 `31.` 꼴. 조각 시작에서만 찾는다(본문 속 숫자·쪽번호를 피한다).
    const items = []
    for (const f of frags) {
      const m = f.str.match(/^\s*(\d{1,2})\s*[.．]/)
      if (!m) continue
      const no = Number(m[1])
      if (no < 1 || no > 45) continue
      items.push({ no, ...charBox(f, m[0].indexOf(m[1]), m[1].length) })
    }

    // 선지 기호 — 조각 어디에 있든 찾는다(본문에 박히는 유형이 있다)
    const marks = []
    for (const f of frags) {
      for (let i = 0; i < f.str.length; i += 1) {
        const k = CIRC.indexOf(f.str[i])
        if (k < 0) continue
        marks.push({ n: k + 1, ...charBox(f, i) })
      }
    }

    pages.push({ page: p, width: vp.width, height: vp.height, frags: frags.length, items, marks })
  }
  // 판마다 정리 메서드 이름이 다르다(`destroy` 가 없는 빌드가 있다). 있는 것만 부른다 —
  // 없다고 던지면 측정이 끝난 뒤에 스크립트가 죽는다.
  if (typeof doc.cleanup === 'function') await doc.cleanup()
  if (typeof doc.destroy === 'function') await doc.destroy()
  return { file: path.basename(pdfPath), pages: numPages, data: pages }
}

/**
 * **단의 왼쪽 여백을 재서 정한다 — 못박으면 회차가 바뀔 때 조용히 틀린다.**
 *
 * 실측 2026-09-13: 경계를 x=400 으로 못박았더니 2026 은 44/45 였는데 2019 에서 25번의 본문 속
 * 기호 셋이 옆 단으로 넘어갔다. 쪽 크기(842×1191)는 같은데 조판이 달랐다.
 *
 * 문항 번호는 단마다 **같은 x** 에서 시작한다(실측 2026: 88 과 437). 그래서 후보 x 의 최빈값
 * 두 개가 두 단의 왼쪽 여백이고, 그 사이가 단 경계다.
 */
export function columnsOf(pages) {
  const count = new Map()
  for (const p of pages) for (const i of p.items) {
    const k = Math.round(i.x)
    count.set(k, (count.get(k) ?? 0) + 1)
  }
  const top = [...count].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([x]) => x).sort((a, b) => a - b)
  if (top.length < 2) return { margins: top, gutter: Infinity }
  // ⚠️ **두 여백의 중간이 아니다.** 왼 단의 본문은 오른 단 여백 **가까이까지** 뻗는다
  //    (실측 2026: 왼 단 기호가 x=363 까지 가고 오른 단은 x=448 부터 시작한다). 중간값
  //    (88+437)/2 = 262 로 가르면 왼 단 본문 속 기호 절반이 오른 단으로 넘어간다 —
  //    실제로 그렇게 해서 2026 이 28/28 에서 17/28 로 떨어졌다.
  //    경계는 **오른 단 여백 바로 왼쪽**이다.
  return { margins: top, gutter: top[1] - 10 }
}

/**
 * **가짜 문항 번호를 걸러 낸다.**
 *
 * 실측 2026-09-13: 2019#28(안내문)이 기호 0개로 나왔다. 원인은 글리프가 아니라 — ①~⑤ 는
 * U+2460 으로 제대로 뽑힌다 — **안내문 안의 번호 목록**(`1.` `2.` `3.`)이 문항 번호로 잡혀,
 * 28번의 기호가 그 가짜 `3.` 것으로 붙은 것이다. 34번도 같았다.
 *
 * 진짜 문항 번호는 둘을 다 만족한다:
 *   ① 단의 **왼쪽 여백**에서 시작한다 (본문 속 목록은 들여쓰여 있다 — 실측 x=191·456)
 *   ② 읽기 순서로 **커진다** (같은 번호가 다시 나오거나 작아지면 그것은 본문이다)
 *
 * ⚠️ **짐을 지는 것은 ②다.** 변이 검사(2026-09-13)에서 ①을 떼어 내도 회귀가 통과했다 —
 *    안내문 속 목록은 `1.` `2.` `3.` 처럼 **작은 수**라 단조 검사에 먼저 걸린다.
 *    ①은 「28번 뒤에 `30.` 이 본문으로 나오는」 경우를 막지만 문제지 30개에 그런 예가 없다.
 *    남겨 두되 **검증된 척하지 않는다** — 지우려면 그 판단만 하면 된다.
 */
export function realItems(pages, cols, tol = 4) {
  const all = []
  for (const p of pages) for (const i of p.items) {
    const col = i.x < cols.gutter ? 0 : 1
    const margin = cols.margins[col]
    if (margin === undefined || Math.abs(i.x - margin) > tol) continue
    all.push({ page: p.page, col, ...i })
  }
  // 읽기 순서: 쪽 → 단 → y 내림차순
  all.sort((a, b) => a.page - b.page || a.col - b.col || b.y - a.y)
  const kept = []
  for (const it of all) {
    if (kept.length && it.no <= kept[kept.length - 1].no) continue
    kept.push(it)
  }
  return kept
}

/**
 * 기호를 문항에 붙인다 — 같은 쪽·같은 단에서 **그 기호 위에 있는 가장 가까운 문항**.
 * 주인을 못 찾은 기호(고아)는 세어서 돌려준다 — 0이 아니면 단 판정이 틀린 것이다.
 */
export function assignMarks(pages, cols, items) {
  const key = (i) => `${i.page}|${i.col}|${i.no}`
  const owner = new Map(items.map((i) => [key(i), []]))
  const orphans = []
  for (const p of pages) for (const m of p.marks) {
    const col = m.x < cols.gutter ? 0 : 1
    const cand = items.filter((i) => i.page === p.page && i.col === col && i.y >= m.y)
    if (!cand.length) { orphans.push({ page: p.page, col, ...m }); continue }
    owner.get(key(cand.reduce((a, b) => (a.y < b.y ? a : b)))).push({ ...m, col })
  }
  return { owner, orphans }
}

/**
 * 형(홀수/짝수)이 한 PDF 에 이어 붙은 회차가 있다(2023·2024·2026). 쪽수가 **정확히 두 배**로
 * 대칭이면 앞 절반이 첫 형이다 — 실측 2026: 16쪽이 1~8 / 9~16 으로 쪽마다 개수까지 같았다.
 * 어느 쪽이 홀수형인지는 `scripts/csat/data/answers.json` 의 `form_used` 와 1쪽 표기가 정한다.
 */
export function firstFormPages(pages) {
  const n = pages.length
  if (n % 2 || n < 16) return pages
  const half = n / 2
  const same = pages.slice(0, half).every((p, k) =>
    p.items.length === pages[half + k].items.length && p.marks.length === pages[half + k].marks.length)
  return same ? pages.slice(0, half) : pages
}

/** 한 문제지의 앵커 품질 — 사정권(18~45)에서 기호 5개가 붙은 문항이 몇인가 */
export function grade(extracted) {
  const pages = firstFormPages(extracted.data)
  const cols = columnsOf(pages)
  const items = realItems(pages, cols)
  const { owner, orphans } = assignMarks(pages, cols, items)
  const reading = [...owner].filter(([k]) => Number(k.split('|')[2]) >= 18)
  const five = reading.filter(([, v]) => v.length === 5)
  return {
    file: extracted.file,
    pages: extracted.pages,
    formPages: pages.length,
    gutter: cols.gutter,
    margins: cols.margins,
    numbersFound: new Set(items.map((i) => i.no)).size,
    reading: reading.length,
    fiveMarks: five.length,
    orphans: orphans.length,
    bad: reading.filter(([, v]) => v.length !== 5).map(([k, v]) => `${k.split('|')[2]}번(${v.length})`),
  }
}

// ⚠️ `endsWith('pdf-anchors.mjs')` 로 재면 안 된다 — `test-pdf-anchors.mjs` 도 그 접미사로
//    끝나서, 회귀 테스트가 이 모듈을 import 하는 순간 CLI 가 발동해 사용법을 찍고 exit 2 한다
//    (실측 2026-09-13). **파일명 일치**로 잰다.
if (process.argv[1] && path.basename(process.argv[1]) === 'pdf-anchors.mjs') {
  const pdfPath = process.argv[2]
  if (!pdfPath || !fs.existsSync(pdfPath)) {
    console.error('사용: node scripts/csat/pdf-anchors.mjs <PDF 경로> [--json 출력.json]')
    process.exit(2)
  }
  const r = await extractAnchors(pdfPath)
  const allItems = r.data.flatMap((p) => p.items.map((i) => ({ page: p.page, ...i })))
  const allMarks = r.data.flatMap((p) => p.marks.map((m) => ({ page: p.page, ...m })))

  console.log(`\n── ${r.file} · ${r.pages}쪽 ──`)
  console.log(`  글자 조각 ${r.data.reduce((s, p) => s + p.frags, 0)}`)
  console.log(`  문항 번호 후보 ${allItems.length} (고유 번호 ${new Set(allItems.map((i) => i.no)).size})`)
  console.log(`  선지 기호 ${allMarks.length}`)

  // 1~45 중 몇 번을 찾았나 — 이것이 오버레이가 쓸 수 있는 분모다
  const found = new Set(allItems.map((i) => i.no))
  const missing = Array.from({ length: 45 }, (_, i) => i + 1).filter((n) => !found.has(n))
  console.log(`  1~45 중 찾은 번호 ${found.size}/45${missing.length ? ` · 못 찾은 번호: ${missing.join(' ')}` : ''}`)

  const byN = CIRC.map((_, k) => allMarks.filter((m) => m.n === k + 1).length)
  console.log(`  기호별: ① ${byN[0]} · ② ${byN[1]} · ③ ${byN[2]} · ④ ${byN[3]} · ⑤ ${byN[4]}`)

  const g = grade(r)
  console.log(`\n  ── 앵커 품질 (첫 형 ${g.formPages}쪽 · 단 여백 ${g.margins.join('/')} · 경계 ${g.gutter}) ──`)
  console.log(`  진짜 문항 번호 ${g.numbersFound}/45 · 고아 기호 ${g.orphans}`)
  console.log(`  사정권(18~45) 기호 5개 붙은 문항 ${g.fiveMarks}/${g.reading}`)
  if (g.bad.length) console.log(`  어긋난 문항: ${g.bad.join(' ')}`)

  const out = arg('json')
  if (out) {
    fs.writeFileSync(out, JSON.stringify(r, null, 1))
    console.log(`\n→ ${out}`)
  } else {
    console.log('\n  측정만 했다 — 파일로 남기려면 --json <경로>')
  }
}
